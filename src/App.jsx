import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import {
  getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  collection, doc, setDoc, onSnapshot, query, deleteDoc,
  where, getDocs, getDoc, orderBy, addDoc, updateDoc, serverTimestamp, documentId, arrayUnion, arrayRemove, limit, startAfter, runTransaction, writeBatch
} from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth';
import {
  Wallet, CreditCard, Landmark, Plus, Settings, Trash2, History,
  ChevronLeft, ChevronRight, X, Tags, ArrowLeft, CopyCheck, Calendar,
  BarChart3, TrendingDown, TrendingUp, Search, CalendarDays, AlignJustify,
  Zap, Calculator, LogOut, Lock, User, FileText, Home, ChevronDown,
  HelpCircle, Pencil, PiggyBank, Repeat, Check
} from 'lucide-react';
import {
  ErrorBoundary, Card, Label, Row, Separator, NavButton, Toast, OfflineBanner,
  SettingsRow, CalculatorPad, useConfirm, toNumber,
  ExpandableRow, SubRow, EmptyState, AddRow,
  PrimaryButton, SecondaryButton, DangerIconButton,
  EditFormSalaryLike, EditFormMemo, EditFormBill, EditFormSavingsBucket,
  EditFormCategory, EditFormTemplate, EditFormPayment, EditFormRecurring,
  EditFormAccount, EditFormAccountPicker, EditFormTransfer
} from './components.jsx';
import { cashTopupTotals, forecastAccount, remainingCashBudget, methodTimingOf, spendableFromBalance, transferEffectOnLiving, billForMethod, walletMoveTotal } from './balanceModel.js';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_GOOGLE_API_KEY,
  authDomain: 'zaimu-4f79b.firebaseapp.com',
  projectId: 'zaimu-4f79b',
  storageBucket: 'zaimu-4f79b.firebasestorage.app',
  messagingSenderId: '388166181792',
  appId: '1:388166181792:web:d3ccef2742dca358d3bac5'
};
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
// 端末にデータをキャッシュ（起動時に前回のデータを即表示・オフラインでも閲覧可）
let db;
try {
  db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
} catch {
  db = getFirestore(app); // 既に初期化済みの場合（開発中の再読み込みなど）
}
const auth = getAuth(app);

const CASH = '現金';
const getMonthString = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const formatMonthJP = s => { if (!s) return ''; const [y, m] = s.split('-'); return `${y}年${Number(m)}月`; };
const formatDateShort = iso => { if (!iso) return ''; const d = new Date(iso); return isNaN(d) ? '' : `${d.getUTCMonth() + 1}/${d.getUTCDate()}`; };
const formatFullDateJP = iso => { if (!iso) return ''; const d = new Date(iso); return isNaN(d) ? '' : `${d.getUTCFullYear()}年${d.getUTCMonth() + 1}月${d.getUTCDate()}日`; };
const getTodayString = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const getTodayLocal = () => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() }; };
const toISODateSafe = s => s ? new Date(`${s}T12:00:00Z`).toISOString() : new Date().toISOString();
const isoToLocalYMD = iso => {
  if (!iso) return getTodayString();
  const d = new Date(iso);
  return isNaN(d) ? getTodayString() : `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
};

const getSavingsBuckets = md => {
  if (md?.savingsBuckets?.length) return md.savingsBuckets;
  const n = Number(md?.savings || 0);
  return n > 0 ? [{ id: 'legacy', name: '貯金', amount: n }] : [];
};
const getSavingsTotal = md => getSavingsBuckets(md).reduce((s, b) => s + (Number(b.amount) || 0), 0);
const getPace = (spent, target) => (!target || target <= 0) ? 0 : Math.min(100, (spent / target) * 100);

// 支出の種別判定: 'normal' | 'special' | 'savings'
// 支出は「種類（通常/特別費）」と「充当元（予算/貯金）」の2軸で持つ。
// 旧データは片方しか記録していないため、推測できない軸は null（未設定）として区別する。
//   旧「通常」    → 種類=通常 / 充当元=予算   （従来と同じ扱い）
//   旧「特別費」  → 種類=特別費 / 充当元=未設定（予算から引かない＝過去の残額を変えない）
//   旧「貯金から」→ 種類=未設定 / 充当元=貯金  （従来と同じ扱い）
const getKind = t => t?.kind || (t?.isSpecial ? 'special' : (t?.fromSavings ? null : 'normal'));
const getSource = t => t?.source || (t?.fromSavings ? 'savings' : (t?.isSpecial ? null : 'budget'));
const KIND_LABELS = { normal: '通常', special: '特別費' };
const SOURCE_LABELS = { budget: '今月の予算', savings: '貯金' };
// 履歴などに出すタグ（通常×予算は当たり前なので出さない）
const txTags = t => {
  const out = [];
  const src = getSource(t);
  if (src === 'savings') out.push({ text: `貯金から${t.savingsBucket ? `（${t.savingsBucket}）` : ''}`, cls: 'text-[#4A7BA6] font-medium' });
  if (src === null) out.push({ text: '未設定', cls: 'text-[#FF453A] font-medium' });
  return out;
};
const SOURCES = [{ value: 'budget', label: '今月の予算' }, { value: 'savings', label: '貯金' }];

const normalizeMonthly = (data) => {
  const d = data || {};
  const dues = { ...(d.cardDueDates || {}) }, bills = { ...(d.cardBills || {}) };
  Object.keys(d).forEach(k => {
    if (k.startsWith('cardDueDates.')) dues[k.split('.')[1]] = d[k];
    if (k.startsWith('cardBills.')) bills[k.split('.')[1]] = d[k];
  });
  return {
    salary: d.salary || 0, budget: d.budget || 0,
    cashBudget: d.cashBudget || 0, cardBills: bills, fixedCosts: d.fixedCosts || [],
    catBudgets: d.catBudgets || {}, cardDueDates: dues, savings: d.savings || 0,
    savingsBuckets: d.savingsBuckets || [], memo: d.memo || '',
    skippedRecurring: d.skippedRecurring || [],
    cashTopups: d.cashTopups || [],
    accountBalances: d.accountBalances || {},
    moves: d.moves || [],   // 単発の振替（ATM含む）[{ id, date, from, to, amount, memo }]
    salaryConfirmed: d.salaryConfirmed,   // false のときは先月の額で仮置き中
    inheritedFrom: d.inheritedFrom || ''
  };
};
const normalizeConfig = data => ({
  categories: data?.categories || [{ name: '食費' }],
  paymentMethods: data?.paymentMethods || [CASH],
  templates: data?.templates || [],
  recurring: data?.recurring || [],
  // 口座（銀行）— 残高は月ごとに monthly.accountBalances で持つ
  accounts: data?.accounts || [],
  methodAccounts: data?.methodAccounts || {},   // 支払方法 → 引落口座
  methodTimings: data?.methodTimings || {},     // 支払方法 → 'next'(翌月払い) / 'same'(当月払い)
  transfers: data?.transfers || [],             // 毎月の口座間の振替 [{ id, from, to, amount, day, title }]
  salaryAccountId: data?.salaryAccountId || '', // 給与の入金先
  savingsAccountId: data?.savingsAccountId || '', // 先取りの移動先
  cashAccountId: data?.cashAccountId || ''      // ATMでおろす元の口座
});

const GRAYS = ['#F4F4F5', '#D4D4D8', '#A1A1AA', '#71717A', '#52525B', '#3F3F46', '#27272A'];
const catColor = i => GRAYS[i % GRAYS.length];
// カレンダー用: 1万未満はそのまま、以上はk表記（丸めで誤解を生まない）
const fmtCompact = n => n < 10000 ? n.toLocaleString() : n < 100000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : `${Math.round(n / 1000)}k`;
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];
// 全期間検索の取得上限（新しい順に最大10,000件 = Firestoreの読み取り20回分）
const SEARCH_PAGE_SIZE = 500;
const SEARCH_MAX_PAGES = 20;
// 履歴の絞り込み用のボタン。見た目とタップ領域を同じ44pxにそろえる
const FilterPill = ({ active, onClick, children, label, grow = true }) => (
  <button type="button" onClick={onClick} aria-label={label}
    className={`h-11 px-3 rounded-[14px] flex items-center justify-center gap-1 text-[13px] font-medium whitespace-nowrap transition-colors min-w-0 ${grow ? 'flex-1' : 'w-11 shrink-0'} ${active ? 'bg-[#0A84FF]/20 text-[#0A84FF]' : 'bg-[#2C2C2E] text-[#98989D]'}`}>
    {children}
  </button>
);

// 定期支出がその月に発生するか（毎月 / 毎年その月のみ）
const isRecurringDueIn = (r, monthStr) => {
  if ((r.freq || 'monthly') === 'yearly') return Number(r.month) === Number(monthStr.split('-')[1]);
  return true;
};

// 同じ月・同じ定期支出は端末が違っても同じドキュメントを使う。
const recurringTransactionId = (monthStr, id) => `rec_${monthStr}_${encodeURIComponent(id)}`;
const createRecurringTransaction = (userId, monthStr, r, fallbackCategory) => {
  const [y, m] = monthStr.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const recDay = Math.min(Number(r.day) || 1, lastDay);
  const dateStr = `${monthStr}-${String(recDay).padStart(2, '0')}`;
  const ref = doc(db, 'users', userId, 'transactions', recurringTransactionId(monthStr, r.id));
  return runTransaction(db, async transaction => {
    if ((await transaction.get(ref)).exists()) return false;
    transaction.set(ref, {
      date: toISODateSafe(dateStr), amount: Number(r.amount) || 0, title: r.title,
      category: r.category || fallbackCategory || '食費', paymentMethod: r.method || CASH,
      kind: 'normal', source: 'budget', savingsBucket: null,
      isSpecial: false, fromSavings: false, recurringId: r.id,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    });
    return true;
  });
};

const csvField = value => {
  const text = String(value ?? '');
  // 表計算ソフトで入力文字列が数式として実行されないようにする。
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
};

/* ── Modal類はAppMainの外に定義（再マウント防止） ── */
const Modal = ({ children, onClose, zIndex = 'z-[65]' }) => (
  <div
    className={`fixed inset-0 ${zIndex} flex items-end sm:items-center justify-center sm:p-4 bg-black/50 backdrop-blur-sm`}
    onClick={onClose}
  >
    <div
      className="w-full sm:max-w-md bg-[#1C1C1E]/80 backdrop-blur-2xl backdrop-saturate-150 rounded-t-3xl sm:rounded-3xl border border-white/[0.12] shadow-2xl flex flex-col overflow-hidden overflow-x-hidden max-h-[92vh]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      onClick={e => e.stopPropagation()}
    >
      {children}
    </div>
  </div>
);

const ModalHeader = ({ title, onClose }) => (
  <div className="flex-none px-5 py-3 flex items-center justify-between border-b border-white/[0.06]">
    <span className="text-[16px] font-semibold text-white">{title}</span>
    <button
      onClick={onClose}
      className="w-11 h-11 -mr-2 flex items-center justify-center rounded-full text-[#98989D] active:bg-white/[0.06] transition-colors"
    >
      <X size={15} />
    </button>
  </div>
);

function AppMain() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [activeTab, setActiveTab] = useState('home');
  const [analysisView, setAnalysisView] = useState('month');
  const [yearData, setYearData] = useState(null);
  const [logView, setLogView] = useState('list');
  const [settingTab, setSettingTab] = useState('menu');
  const [month, setMonth] = useState(getMonthString(new Date()));
  const [isTxOpen, setIsTxOpen] = useState(false);
  const [showCalc, setShowCalc] = useState(false);
  const [calcInit, setCalcInit] = useState(0);
  const [calcCb, setCalcCb] = useState(null);
  const [toast, setToast] = useState({ visible: false, message: '' });
  const { confirm, dialog: confirmDialog } = useConfirm();

  const [inDate, setInDate] = useState(getTodayString());
  const [inAmount, setInAmount] = useState('');
  const [inTitle, setInTitle] = useState('');
  const [inCat, setInCat] = useState('');
  const [inMethod, setInMethod] = useState('');
  const [inSource, setInSource] = useState('budget');
  const [inSavingsBucket, setInSavingsBucket] = useState('');
  const [txFormKey, setTxFormKey] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  // 入力モーダルのモード（支出 / 振替）と、振替の入力値
  const [txMode, setTxMode] = useState('expense');
  const [editingMove, setEditingMove] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false); // 日付・支払方法・充当元の開閉
  const [mv, setMv] = useState({ from: '', to: 'wallet', amount: '', date: '', memo: '' });
  const touchRef = useRef(null);

  const [editingTx, setEditingTx] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [expandedFaq, setExpandedFaq] = useState(null);
  const [faqQ, setFaqQ] = useState('');
  const [budgetExpanded, setBudgetExpanded] = useState(false);
  const [cashExpanded, setCashExpanded] = useState(false);
  const [histTx, setHistTx] = useState(null); // 入力候補用の過去の支出
  const [allTx, setAllTx] = useState(null); // 全期間検索用
  const [allTxLoading, setAllTxLoading] = useState(false);
  const [allTxTruncated, setAllTxTruncated] = useState(false);
  const [selDay, setSelDay] = useState(null);
  const [selYearMonth, setSelYearMonth] = useState(null);

  const [txList, setTxList] = useState([]);
  const [txLoadedMonth, setTxLoadedMonth] = useState(null);
  const recProcessedRef = useRef(new Set());
  const [prevTxList, setPrevTxList] = useState([]);
  const prevFetchRef = useRef(null);
  const [monthly, setMonthly] = useState(normalizeMonthly({}));
  const [mLoadedMonth, setMLoadedMonth] = useState(null);
  const [mEmpty, setMEmpty] = useState(false);
  const inheritRef = useRef(new Set());
  const [config, setConfig] = useState(normalizeConfig({}));
  const [pastSavingsBucketNames, setPastSavingsBucketNames] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [filter, setFilter] = useState({ type: 'ALL', cat: 'ALL', method: 'ALL', source: 'ALL' });
  const [filterSheet, setFilterSheet] = useState(null); // 'cat' | 'method' | 'source'
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyFrom, setCopyFrom] = useState('');
  const [memoText, setMemoText] = useState('');
  const [memoExpanded, setMemoExpanded] = useState(false);

  const mn = month ? Number(month.split('-')[1]) : new Date().getMonth() + 1;
  const nextMn = mn === 12 ? 1 : mn + 1;
  const catNames = useMemo(() => (config?.categories || []).map(c => c.name), [config?.categories]);
  const methods = useMemo(() => config?.paymentMethods?.length ? config.paymentMethods : [CASH], [config?.paymentMethods]);
  const buckets = useMemo(() => getSavingsBuckets(monthly), [monthly]);
  // 貯金からの支出で選べる項目（過去と今月の設定名）
  const bucketOptions = useMemo(() => {
    const set = new Set([...pastSavingsBucketNames, ...buckets.map(b => b.name)]);
    return [...set].filter(Boolean);
  }, [pastSavingsBucketNames, buckets]);

  const FAQ = useMemo(() => [
    { category: '設定タブの金額', items: [
      { q: '手取り給与', a: `家計のベース収入です。${mn}月の今月の予算・${nextMn}月の着地予想の起点になります。` },
      { q: '月初のスタート現金', a: '毎月1日時点で財布にある現金です。ホームの「資産」の財布の計算元になります。月の途中でATMからおろした分は、＋ボタンの「振替・ATM」から記録できます。' },
      { q: '先取り設定', a: '毎月最初に避けておくお金です。先取り後の残り・今月の予算の計算に使われます。' },
      { q: '定期支出', a: '家賃やサブスクなど毎月決まった支出です。指定日に自動でログに記録され、未記録の分は「固定費予定」として実質あと使える額から差し引かれます。' },
      { q: 'カテゴリ予算', a: '使いすぎ防止枠です。分析タブの比較に使われます。' }
    ]},
    { category: 'ホーム画面の見方', items: [
      { q: '実質あと使える（カード）', a: '残り全体から、まだ記録されていない固定費（定期支出）の予定額を差し引いた、本当に自由に使える金額です。', formula: '今月の予算（カード） − カード支出 − 固定費予定' },
      { q: '先取り後の残り', a: '手取りから先取りを引いた金額です。', formula: '手取り給与 − 先取り合計' },
      { q: '今月の予算（カード）', a: '先取り後の残りから月初のスタート現金と、ATM記録で明示的にカード予算から現金へ回した額を引いた上限です。単に銀行から現金をおろすだけならカード予算は減りません。', formula: '先取り後の残り − 月初のスタート現金 − カード予算から現金へ回した額' },
      { q: '固定費予定とは？', a: '定期支出のうち、今月まだ記録されていないものの合計です。記録された時点で予定から実績（カード支出）へ自動的に移ります。' },
      { q: '財布', a: '手元にあるはずの現金です。ホームの「資産」にある財布をタップすると内訳を確認でき、ATMの記録をタップすると編集できます。', formula: '月初のスタート現金 + ATMなどで財布に入れた現金 − 現金支出' },
      { q: '「今月の予算」と「資産」の違いは？', a: '今月の予算は「今月あといくら使っていいか」という計画の数字です。資産は「お金が今どこにいくらあるか」という実物の数字で、財布と各口座の月末の見込みを表示します。今月カードで使った分は来月引き落とされるため、予算からはすでに引かれていても、口座にはまだ残っています。そのため2つの数字は一致しません。' },
      { q: '「今月あと使える」はどう計算している？', a: '口座の月初残高を入力した月は、貯金用以外の口座と財布にあるお金を起点に計算します。三井住友などの生活用の口座に余っているお金も含まれます。給与が月の後半まで分からないときは先月の額で仮計算し、振り込まれたら資金計画で上書きできます。今月引き落とされる先月のカード分は、先月の使った分として計算済みなので差し引きません。月初残高が未入力の月は、従来どおり給与をもとに計算します。', formula: '生活用の口座と財布の月初残高 ＋ 給与 − 先取り − 今月使った分 − 固定費予定' },
      { q: '口座から口座へお金を移しているときは？', a: '毎月決まっている振替は、設定タブの「口座」→「毎月の振替」に登録してください（例: 楽天カードの引落用に三井住友から楽天銀行へ移す）。1回だけの振替は、＋ボタンの「振替・ATM」から記録できます。どちらも口座の見込みに反映され、生活用の口座どうしなら「今月あと使える」には影響しません。' },
      { q: '当月払いと翌月払いの違いは？', a: 'クレジットカードは使った翌月に引き落とされる翌月払い、口座振替やデビットは使った月に引き落とされる当月払いです。設定タブの「口座」で支払方法ごとに変更できます。当月払いの分は使った時点で差し引くので、引落予定と二重に引かれることはありません。' },
      { q: '銀行口座の残高も管理できる？', a: '設定タブの「口座」で銀行を登録し、月初残高を入力すると管理できます。給与の入金・カードの引落・ATMでの出金・先取りの移動を差し引いた、今月末の見込み残高を計算します。銀行との自動連携はないので、月初に残高を1回入力してください。' },
      { q: '口座の見込みと今月の予算の関係は？', a: 'カードは使った月の翌月に引き落とされるため、口座の見込みは「今月出ていくお金」で計算しています。一方で今月の予算は「今月使った分」で計算します。時間のずれがあるので別々の数字として見てください。' },
      { q: 'ATMで現金をおろしたら？', a: '＋ボタンを押して「振替・ATM」に切り替え、振替元をおろした口座、振替先を財布にして記録します。口座から財布へお金の置き場所が変わるだけなので、「今月あと使える」は変わりません。記録は履歴にも表示され、タップすると金額・日付・口座を編集したり削除したりできます。' },
      { q: `${nextMn}月の着地予想`, a: `カードをこれ以上使わなかった場合に月末残る予算のシミュレーションです。銀行から現金をおろしただけでは増えません。`, formula: '実質あと使える（カード） + 予算として確保した現金の残り' },
      { q: '今日までの目安とは？', a: '固定費以外で使ってよいお金（今月の予算から固定費の合計を除いた分）を、月の日数で均等に使った場合に、今日までに使っていてよい金額です。ホームでは「今日までに使った額」と並べて表示し、目安より少なければ「余裕」、多ければ「オーバー」と表示します。進捗バーも同じ基準で、縦線が今日の位置です。', formula: '（今月の予算 − 固定費の合計） × 経過日数 ÷ 月の日数' }
    ]},
    { category: '支出の記録', items: [
      { q: '「充当元」とは？', a: 'その支出をどこから出したかです。「今月の予算」を選ぶと今月の予算から引かれます。「貯金」を選ぶと今月の予算には影響せず、資産の見込みでは支払方法に関係なく貯金用の口座から出たものとして計算します（カードで払って、あとで貯金から補填する場合も同じ扱いです）。' },
      { q: '現金で払った場合はどうなる？', a: '口座の月初残高を入れた月は、充当元が今月の予算なら、カードと同じく今月の予算から引かれ、同時に財布の現金も減ります（月初残高が未入力の月は、予算から月初のスタート現金を先に差し引く従来の計算です）。予算は「計画」、財布は「実物」の数字なので、両方で減っても二重に数えているわけではありません。' },
      { q: 'カードの支払予定と予算残額の関係', a: '予算の残額は「今月の予算から充当したカード払い」を引いた金額です。一方カードの引落予定は、充当元を問わずそのカードで使った全額が対象になります。別の目的の数字なので一致しないことがあります。' },
      { q: '「未設定」と出る支出は何？', a: '旧バージョンで記録した支出です。当時は充当元を記録していなかったため、予算・貯金のどちらの残額からも引かず、過去の数字をそのまま保っています。分析タブの「充当元が未設定の支出」からまとめて確認し、1件ずつ開いて充当元を選べば分類できます。' }
    ]},
    { category: '操作', items: [
      { q: '定期支出とは？', a: 'サブスクや家賃など決まった支出を登録しておくと、指定日を迎えたタイミングで自動的にログへ記録されます。周期は「毎月」と「毎年」から選べるので、年会費のような年1回の支出も登録できます。記録された支出は「定期」バッジ付きで表示され、通常の支出と同じように編集・削除できます。' },
      { q: '履歴の検索はどこまで探せる？', a: '検索欄に文字を入れると、表示中の月だけでなく全期間の支出から探します。件数が多い場合は読み込みに時間がかかります。結果は日付ごとにまとまって表示されます。' },
      { q: 'カレンダーの「・金額」は何？', a: 'まだ記録されていない定期支出の予定額です。日付をタップすると、その日に予定されている定期支出を確認できます。' },
      { q: '定期支出を今月だけ止めたい', a: '自動記録されたログを削除すると、その定期支出は今月分だけスキップされます。来月からは通常どおり自動記録が再開されます。' },
      { q: '来月の設定はどうすればいいですか？', a: '新しい月にアプリを開くと、直近の月の手取り給与・先取り・スタート現金などが自動で引き継がれます。金額が変わる項目だけ資金計画で編集してください。手動で引き継ぎたいときは設定タブの「先月の設定をコピー」も使えます。' },
      { q: '今月の引落予定はどう計算される？', a: '支払方法ごとに、前月にその方法で使った金額を今月の引落予定として自動で表示します。カード明細と金額が違うときは、資金計画の「今月の引落予定」から手入力で上書きできます（空欄に戻すと自動に戻ります）。' },
      { q: '日付や支払方法を変えたいときは？', a: '入力画面の「今日 · 三井住友 · 予算から」のような行をタップすると、日付・支払方法・充当元を変更できます。' },
      { q: '入力画面に出る候補は？', a: '内容が空のときはテンプレートとよく使う内容、入力を始めると一致する過去の内容が表示されます。タップするとカテゴリや支払方法などもまとめて入力されます。' },
      { q: '支出を編集・複製したい', a: '履歴で支出をタップすると編集画面が開きます。下のボタンから削除や、同じ内容での新規入力（複製）ができます。' },
      { q: '支出を間違えて削除したら？', a: '削除した直後に表示される「元に戻す」をタップすると、そのまま復元できます（数秒間表示されます）。' },
      { q: 'データのバックアップはできますか？', a: '設定タブの「JSONバックアップ」で取引・月別設定・共通設定を書き出せます。アプリ内への一括復元機能はありません。取引だけを表計算ソフトで見る場合はCSVを書き出してください。' }
    ]}
  ], [mn, nextMn]);

  const filteredFaq = useMemo(() => {
    if (!faqQ) return FAQ;
    const q = faqQ.toLowerCase();
    return FAQ.map(s => ({ ...s, items: s.items.filter(i => i.q.toLowerCase().includes(q) || i.a.toLowerCase().includes(q) || (i.formula || '').toLowerCase().includes(q)) })).filter(s => s.items.length);
  }, [faqQ, FAQ]);

  const toastTimer = useRef(null);
  const showToast = (msg, action = null) => {
    clearTimeout(toastTimer.current);
    setToast({ visible: true, message: msg, action });
    toastTimer.current = setTimeout(() => setToast({ visible: false, message: '', action: null }), action ? 5000 : 2500);
  };
  const hideToast = () => { clearTimeout(toastTimer.current); setToast({ visible: false, message: '', action: null }); };
  const openCalc = (init, cb) => { setCalcInit(init); setCalcCb(() => cb); setShowCalc(true); };

  useEffect(() => {
    const on = () => setIsOffline(false), off = () => setIsOffline(true);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  useEffect(() => onAuthStateChanged(auth, u => { setUser(u); setAuthLoading(false); }), []);

  useEffect(() => {
    if (!user) return;
    const fm = month;
    setTxLoadedMonth(null);
    const start = new Date(`${month}-01T00:00:00Z`).toISOString();
    const nd = new Date(`${month}-01T00:00:00Z`); nd.setUTCMonth(nd.getUTCMonth() + 1);
    const q = query(collection(db, 'users', user.uid, 'transactions'), where('date', '>=', start), where('date', '<', nd.toISOString()));
    return onSnapshot(q,
      s => {
        const l = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => new Date(b.date) - new Date(a.date));
        setTxList(l);
        // サーバー確定データが届いたときだけ「この月のロード完了」を記録
        if (!s.metadata.fromCache) setTxLoadedMonth(fm);
      },
      err => { console.error(err); showToast('データ取得エラー'); }
    );
  }, [month, user]);

  useEffect(() => {
    if (!user) return;
    const fm = month; prevFetchRef.current = fm; setPrevTxList([]);
    const pd = new Date(`${month}-01T00:00:00Z`); pd.setUTCMonth(pd.getUTCMonth() - 1);
    const ps = new Date(`${getMonthString(pd)}-01T00:00:00Z`).toISOString();
    const cs = new Date(`${month}-01T00:00:00Z`).toISOString();
    getDocs(query(collection(db, 'users', user.uid, 'transactions'), where('date', '>=', ps), where('date', '<', cs)))
      .then(s => { if (prevFetchRef.current === fm) setPrevTxList(s.docs.map(d => ({ id: d.id, ...d.data() }))); })
      .catch(console.error);
  }, [month, user]);

  useEffect(() => {
    if (!user) return;
    const fm = month;
    setMLoadedMonth(null);
    return onSnapshot(doc(db, 'users', user.uid, 'months', month),
      s => {
        const raw = s.exists() ? s.data() : {};
        setMonthly(normalizeMonthly(raw));
        // 手取り・先取り・スタート現金がどれも未設定なら「空の月」
        setMEmpty(!(Number(raw.salary) > 0) && !(raw.savingsBuckets || []).length && !(Number(raw.cashBudget) > 0));
        if (!s.metadata.fromCache) setMLoadedMonth(fm);
      }, console.error);
  }, [month, user]);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(doc(db, 'users', user.uid, 'settings', 'config'),
      s => setConfig(normalizeConfig(s.exists() ? s.data() : {})), console.error);
  }, [user]);

  /* 貯金からの支出で選べる過去の先取り項目名 */
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getDocs(query(collection(db, 'users', user.uid, 'months'), where(documentId(), '<=', month), orderBy(documentId(), 'asc')))
      .then(s => {
        if (cancelled) return;
        const names = new Set();
        s.forEach(d => {
          getSavingsBuckets(normalizeMonthly(d.data())).forEach(b => { if (b.name) names.add(b.name); });
        });
        setPastSavingsBucketNames([...names]);
      }).catch(console.error);
    return () => { cancelled = true; };
  }, [user, month, monthly.savingsBuckets, monthly.savings]);

  useEffect(() => setMemoText(monthly?.memo || ''), [monthly?.memo]);

  /* 定期支出の自動記録（表示月とロード済みデータの月が完全一致するときだけ動く） */
  useEffect(() => {
    if (!user) return;
    // 表示中の月のデータが（取引・月設定とも）サーバー確定で揃っているときのみ実行
    if (txLoadedMonth !== month || mLoadedMonth !== month) return;
    const now = new Date();
    if (month !== getMonthString(now)) return;
    const todayD = now.getDate();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const skipped = monthly.skippedRecurring || [];
    (config.recurring || []).forEach(r => {
      if (!r.id || !r.title) return;
      if (skipped.includes(r.id)) return;
      if (!isRecurringDueIn(r, month)) return;
      const recDay = Math.min(Number(r.day) || 1, lastDay);
      if (recDay > todayD) return;
      const key = `${month}_${r.id}`;
      if (recProcessedRef.current.has(key)) return;
      if (txList.some(t => t.recurringId === r.id)) return;
      recProcessedRef.current.add(key);
      createRecurringTransaction(user.uid, month, r, catNames[0])
        .then(created => { if (created) showToast(`定期支出「${r.title}」を記録しました`); })
        .catch(e => { console.error(e); recProcessedRef.current.delete(key); });
    });
  }, [user, txLoadedMonth, mLoadedMonth, txList, config.recurring, month, monthly.skippedRecurring]);

  /* 月設定の自動引き継ぎ: 今月が未設定なら、直近の設定済みの月からコピー */
  useEffect(() => {
    if (!user || mLoadedMonth !== month || !mEmpty) return;
    if (month !== getMonthString(new Date())) return; // 実際の今月だけ（閲覧しただけの未来月は作らない）
    if (inheritRef.current.has(month)) return;
    inheritRef.current.add(month);
    (async () => {
      try {
        const snap = await getDocs(query(
          collection(db, 'users', user.uid, 'months'),
          where(documentId(), '<', month), orderBy(documentId(), 'desc'), limit(6)
        ));
        const src = snap.docs.find(d => Number(d.data().salary) > 0);
        if (!src) return;
        const d = src.data();
        await setDoc(doc(db, 'users', user.uid, 'months', month), {
          salary: d.salary || 0, cashBudget: d.cashBudget || 0,
          catBudgets: d.catBudgets || {}, cardDueDates: d.cardDueDates || {},
          savings: d.savings || 0, savingsBuckets: d.savingsBuckets || [],
          inheritedFrom: src.id, salaryConfirmed: false
        }, { merge: true });
        showToast(`${formatMonthJP(src.id)}の設定を引き継ぎました`);
      } catch (e) { console.error(e); }
    })();
  }, [user, mLoadedMonth, mEmpty, month]);

  /* 全期間検索: 500件ずつ最後まで取得（初回のみ） */
  useEffect(() => {
    if (!user || !searchText.trim() || allTx || allTxLoading) return;
    setAllTxLoading(true);
    (async () => {
      try {
        const items = [];
        let cursor = null;
        let truncated = false;
        // 上限を設けて、読み取り数と待ち時間が際限なく増えないようにする
        for (let page = 0; ; page++) {
          if (page >= SEARCH_MAX_PAGES) { truncated = true; break; }
          const constraints = [orderBy('date', 'desc'), ...(cursor ? [startAfter(cursor)] : []), limit(SEARCH_PAGE_SIZE)];
          const snapshot = await getDocs(query(collection(db, 'users', user.uid, 'transactions'), ...constraints));
          items.push(...snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
          if (snapshot.size < SEARCH_PAGE_SIZE) break;
          cursor = snapshot.docs[snapshot.docs.length - 1];
        }
        setAllTx(items);
        setAllTxTruncated(truncated);
        if (truncated) showToast(`直近${items.length.toLocaleString()}件の中から検索しています`);
      } catch (e) { console.error(e); showToast('検索データの取得に失敗しました'); }
      finally { setAllTxLoading(false); }
    })();
  }, [user, searchText, allTx, allTxLoading]);

  /* 入力候補: 入力モーダルを初めて開いたときに過去の支出を取得 */
  useEffect(() => {
    if (!user || !isTxOpen || histTx) return;
    getDocs(query(collection(db, 'users', user.uid, 'transactions'), orderBy('date', 'desc'), limit(300)))
      .then(s => setHistTx(s.docs.map(d => ({ id: d.id, ...d.data() }))))
      .catch(e => { console.error(e); setHistTx([]); });
  }, [user, isTxOpen, histTx]);

  // タイトルごとに「最新の内容」と「使った回数」をまとめる
  const titleIndex = useMemo(() => {
    const map = new Map();
    const seen = new Set();
    [...txList, ...(histTx || [])]
      .filter(t => t.title && !seen.has(t.id) && seen.add(t.id))
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .forEach(t => {
        const k = t.title.trim();
        if (!k) return;
        const cur = map.get(k);
        if (cur) cur.count += 1;
        else map.set(k, { title: k, amount: Number(t.amount) || 0, category: t.category, paymentMethod: t.paymentMethod, count: 1 });
      });
    return [...map.values()];
  }, [txList, histTx]);

  /* 年間ビューのデータ取得（直近12ヶ月） */
  useEffect(() => {
    if (!user || activeTab !== 'analysis' || analysisView !== 'year' || yearData) return;
    (async () => {
      try {
        const now = new Date();
        const monthsArr = [];
        for (let i = 11; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          monthsArr.push(getMonthString(d));
        }
        const startIso = new Date(`${monthsArr[0]}-01T00:00:00Z`).toISOString();
        const txSnap = await getDocs(query(collection(db, 'users', user.uid, 'transactions'), where('date', '>=', startIso)));
        const spend = {}; monthsArr.forEach(m => { spend[m] = 0; });
        txSnap.forEach(d => {
          const t = d.data();
          if (getSource(t) !== 'budget') return; // 予算から充当した分のみ（旧データの未設定は従来どおり対象外）
          const mk = (t.date || '').slice(0, 7);
          if (mk in spend) spend[mk] += Number(t.amount) || 0;
        });
        const mSnap = await getDocs(query(collection(db, 'users', user.uid, 'months'), where(documentId(), '>=', monthsArr[0]), where(documentId(), '<=', monthsArr[11])));
        const save = {}; monthsArr.forEach(m => { save[m] = 0; });
        mSnap.forEach(d => { if (d.id in save) save[d.id] = getSavingsTotal(normalizeMonthly(d.data())); });
        setYearData({ months: monthsArr, spend, save });
      } catch (e) { console.error(e); showToast('年間データの取得エラー'); }
    })();
  }, [user, activeTab, analysisView, yearData]);

  const S = useMemo(() => {
    const salary = Number(monthly?.salary) || 0;
    const cashBudget = Number(monthly?.cashBudget) || 0;
    // ATMは現金の移動。カード予算からの配分変更は個々の記録で選ぶ。
    const { cash: cashTopupTotal, cardToCash: cashBudgetShiftTotal } = cashTopupTotals(monthly?.cashTopups);
    // 財布に入った現金: 旧ATM記録 ＋ 振替で財布に入った分（財布から出た分は引く）
    const cashAvail = cashBudget + cashTopupTotal + walletMoveTotal(monthly?.moves);
    const sum = list => list.reduce((s, t) => s + (Number(t.amount) || 0), 0);
    // 充当元ごとに引き当て先を分ける（同じ1円が2つの残額から引かれないようにする）
    //   予算×カード → 今月の予算の残額から引く
    //   予算×現金   → 現金残高から引く（予算からは月初に現金を差し引いてあるため二重に引かない）
    //   貯金        → 今月の予算からは引かない（貯金の実残高は別途口座で確認する）
    //   未設定      → どこからも引かない（旧データの数字を変えないため）
    const budgetTx = txList.filter(t => getSource(t) === 'budget');
    const budgetTxPrev = prevTxList.filter(t => getSource(t) === 'budget');
    const norm = budgetTx; // 予算から充当した支出（通常・特別費の両方）
    const normPrev = budgetTxPrev;
    const spCard = sum(budgetTx.filter(t => t.paymentMethod !== CASH));
    const spCash = sum(budgetTx.filter(t => t.paymentMethod === CASH));
    const spent = spCard + spCash;
    // 現金・カードの「実際の出入り」は予算残額とは別軸（充当元を問わず合計）
    const cashOutAll = sum(txList.filter(t => t.paymentMethod === CASH));
    const cardOutAll = sum(txList.filter(t => t.paymentMethod !== CASH));
    const spUnset = sum(txList.filter(t => getSource(t) === null));
    const spUnsetCount = txList.filter(t => getSource(t) === null).length;
    const savTotal = getSavingsTotal(monthly);
    const lifeBudget = salary - savTotal;
    // 今月のカード予算 = 手取り − 先取り − スタート現金 − 明示的に移した現金枠
    const varBudget = lifeBudget - cashBudget - cashBudgetShiftTotal;
    const varRemain = varBudget - spCard;
    // 定期支出（固定費）: カード払いのみ予算計算の対象（現金払いは現金残高の軸で管理）
    const recCard = (config?.recurring || []).filter(r =>
      (r.method || CASH) !== CASH && isRecurringDueIn(r, month) && !(monthly.skippedRecurring || []).includes(r.id));
    const recTotalAll = recCard.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const recordedIds = new Set(norm.filter(t => t.recurringId).map(t => t.recurringId));
    const pendingFixed = recCard.filter(r => !recordedIds.has(r.id)).reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const recRecorded = norm.filter(t => t.recurringId && t.paymentMethod !== CASH).reduce((s, t) => s + (Number(t.amount) || 0), 0);
    // 実質自由 = 残り全体 − 固定費予定
    const freeBudget = varBudget - recTotalAll;
    const freeSpent = spCard - recRecorded;
    const freeRemain = varRemain - pendingFixed;
    const cashRemain = cashAvail - spCash;
    const cashBudgetRemain = remainingCashBudget(cashBudget, cashBudgetShiftTotal, spCash);
    const cats = norm.reduce((a, t) => { const c = t.category || '未分類'; a[c] = (a[c] || 0) + (Number(t.amount) || 0); return a; }, {});
    const prevCats = normPrev.reduce((a, t) => { const c = t.category || '未分類'; a[c] = (a[c] || 0) + (Number(t.amount) || 0); return a; }, {});
    const catBudSum = (config?.categories || []).reduce((s, c) => s + (monthly?.catBudgets?.[c.name] || 0), 0);
    const spSpecial = sum(txList.filter(t => getKind(t) === 'special'));
    const spSpecialPrev = sum(prevTxList.filter(t => getKind(t) === 'special'));
    const spSavings = sum(txList.filter(t => getSource(t) === 'savings'));
    return {
      cashBudget, cashTopupTotal, cashBudgetShiftTotal, cashAvail,
      cashOutAll, cardOutAll, spUnset, spUnsetCount,
      cashRemain, projCash: freeRemain + cashBudgetRemain,
      catBudSum, savTotal, lifeBudget, varBudget, varRemain,
      pendingFixed, recTotalAll, recRecorded, freeBudget, freeSpent, freeRemain,
      cats, spent, prevSpent: normPrev.reduce((s, t) => s + (Number(t.amount) || 0), 0),
      spCard, spCash,
      daily: norm.reduce((a, t) => { if (!t.date) return a; const d = new Date(t.date); if (isNaN(d)) return a; a[d.getUTCDate()] = (a[d.getUTCDate()] || 0) + (Number(t.amount) || 0); return a; }, {}),
      spSpecial, spSpecialPrev, spSavings, prevCats
    };
  }, [monthly, txList, prevTxList, config]);

  const activeCats = useMemo(() => catNames.filter(n => (monthly.catBudgets?.[n] || 0) > 0 || (S.cats[n] || 0) > 0), [catNames, monthly.catBudgets, S.cats]);

  const donut = useMemo(() => {
    if (S.spent === 0) return { items: [], total: 0 };
    const cp = { ...S.cats }; const other = cp['その他'] || 0; delete cp['その他'];
    const arr = Object.entries(cp).map(([n, a]) => ({ n, a })).filter(x => x.a > 0).sort((a, b) => b.a - a.a);
    let items = [];
    if (arr.length + (other > 0 ? 1 : 0) <= 6) {
      items = arr.map((x, i) => ({ name: x.n, amount: x.a, color: catColor(i) }));
      if (other > 0) items.push({ name: 'その他', amount: other, color: catColor(items.length) });
    } else {
      items = arr.slice(0, 5).map((x, i) => ({ name: x.n, amount: x.a, color: catColor(i) }));
      const rest = arr.slice(5).reduce((s, x) => s + x.a, 0) + other;
      if (rest > 0) items.push({ name: 'その他', amount: rest, color: catColor(5) });
    }
    return { items, total: S.spent };
  }, [S.spent, S.cats]);

  const isSearching = searchText.trim() !== '';
  const searchPool = isSearching ? (allTx || txList) : txList;
  const filteredTx = useMemo(() => searchPool.filter(t => {
    const ms = searchText === '' || String(t.title || '').includes(searchText);
    const mc = filter.cat === 'ALL' || t.category === filter.cat;
    const mm = filter.method === 'ALL' || t.paymentMethod === filter.method;
    const msr = filter.source === 'ALL' || (filter.source === 'UNSET' ? getSource(t) === null : getSource(t) === filter.source);
    return filter.type !== 'move' && ms && mc && mm && msr;
  }), [searchPool, searchText, filter]);

  // 履歴を日付ごとにグループ化（新しい日付順）
  // 表示中の月の振替（ATM含む）。旧形式のATM記録も「口座→財布」の振替として並べる
  const moveItems = useMemo(() => {
    const legacyFrom = config.cashAccountId || config.salaryAccountId || '';
    const legacy = (monthly.cashTopups || []).map(c => ({
      id: c.id, date: c.date, from: legacyFrom, to: 'wallet', amount: Number(c.amount) || 0, memo: '',
      _legacy: true, _original: c, _month: month
    }));
    const moves = (monthly.moves || []).map(m => ({ ...m, amount: Number(m.amount) || 0, _original: m, _month: month }));
    return [...legacy, ...moves];
  }, [monthly.cashTopups, monthly.moves, config.cashAccountId, config.salaryAccountId, month]);
  const placeName = useCallback(id => id === 'wallet' ? '財布' : ((config.accounts || []).find(a => a.id === id)?.name || '未設定'), [config.accounts]);

  const logGroups = useMemo(() => {
    const groups = [];
    const idx = {};
    filteredTx.forEach(t => {
      const key = isoToLocalYMD(t.date);
      if (idx[key] === undefined) { idx[key] = groups.length; groups.push({ key, total: 0, items: [] }); }
      const g = groups[idx[key]];
      g.total += Number(t.amount) || 0;
      g.items.push(t);
    });
    // 振替はカテゴリ・支払方法・充当元を持たないので、それらで絞り込んでいるときは出さない
    const q = searchText.trim();
    const showMoves = filter.type !== 'expense' && filter.cat === 'ALL' && filter.method === 'ALL' && filter.source === 'ALL';
    if (showMoves) {
      moveItems.filter(m => !q || `${placeName(m.from)} ${placeName(m.to)} ${m.memo || ''}`.includes(q)).forEach(m => {
        const key = m.date;
        if (!key) return;
        if (idx[key] === undefined) { idx[key] = groups.length; groups.push({ key, total: 0, items: [] }); }
        groups[idx[key]].items.push({ ...m, _move: true });
      });
      groups.sort((a, b) => (a.key < b.key ? 1 : -1));
    }
    return groups;
  }, [filteredTx, moveItems, searchText, filter, placeName]);

  // カレンダー用: 日ごとの支出（全種別）と明細
  const dayMap = useMemo(() => {
    const m = {};
    txList.forEach(t => {
      if (!t.date) return;
      const d = new Date(t.date);
      if (isNaN(d)) return;
      const k = d.getUTCDate();
      if (!m[k]) m[k] = { total: 0, items: [] };
      m[k].total += Number(t.amount) || 0;
      m[k].items.push(t);
    });
    return m;
  }, [txList]);
  const dayMax = useMemo(() => Math.max(1, ...Object.values(dayMap).map(v => v.total)), [dayMap]);

  // 今月の引落予定（支払方法ごと）: 前月の利用額から自動、手入力があればそちら
  const billRows = useMemo(() => {
    // 貯金用の口座が設定されていれば、充当元が貯金の支出は貯金用の口座から出たものとして扱うので、
    // 支払方法ごとの引落からは外す（二重に引かない）
    const routeSavings = !!config.savingsAccountId;
    // 支払方法ごとに、予算から（living）と貯金から（savings）を分けて集計
    const byMethod = list => list.reduce((a, t) => {
      const m = t.paymentMethod || CASH;
      if (m === CASH) return a;
      if (!a[m]) a[m] = { living: 0, savings: 0 };
      const key = routeSavings && getSource(t) === 'savings' ? 'savings' : 'living';
      a[m][key] += Number(t.amount) || 0;
      return a;
    }, {});
    const prevByMethod = byMethod(prevTxList);
    const curByMethod = byMethod(txList);
    // 今月まだ記録されていない定期支出（月末までに確実に出ていく分）を支払方法ごとに集計
    const recordedIds = new Set(txList.filter(t => t.recurringId).map(t => t.recurringId));
    const skipped = monthly.skippedRecurring || [];
    const pendingByMethod = (config.recurring || []).reduce((a, r) => {
      if (!r.id || recordedIds.has(r.id) || skipped.includes(r.id) || !isRecurringDueIn(r, month)) return a;
      const m = r.method || CASH;
      a[m] = (a[m] || 0) + (Number(r.amount) || 0);
      return a;
    }, {});
    return methods.filter(m => m !== CASH).map(m => {
      const timing = methodTimingOf(m, config.methodTimings);
      const manual = Number(monthly.cardBills?.[m]) || 0;
      // 当月払い（口座振替など）: 今月使った分 ＋ 今月まだ記録されていない定期支出
      // 翌月払い（カード）: 先月使った分（今月の定期支出は来月の引落になるので含めない）
      const pending = timing === 'same' ? (pendingByMethod[m] || 0) : 0;
      const bill = billForMethod({ timing, manual, cur: curByMethod[m], prev: prevByMethod[m], pending });
      // shown: 明細の請求額 / fromLinked: 引落口座から出る額 / savingsPortion: 貯金用の口座から補填する額
      return { m, timing, manual, pending, ...bill, due: monthly.cardDueDates?.[m] };
    });
  }, [prevTxList, txList, methods, config.methodTimings, config.recurring, config.savingsAccountId, monthly.cardBills, monthly.cardDueDates, monthly.skippedRecurring, month]);
  const billTotal = useMemo(() => billRows.reduce((s, r) => s + r.shown, 0), [billRows]);

  // 残高ベースの「今月あと使える」
  // 貯金用以外の口座（生活用）と財布の月初残高がすべて入っている月だけ使う。
  // 1つでも未入力なら null を返し、従来の給与ベースの計算を使う（過去の月の数字を変えない）。
  const balanceMode = useMemo(() => {
    const living = (config.accounts || []).filter(a => a.id !== config.savingsAccountId);
    if (!living.length) return null;
    const bal = monthly.accountBalances || {};
    const missing = living.filter(a => !(a.id in bal));
    if (missing.length) return { active: false, missing };
    const livingIds = new Set(living.map(a => a.id));
    const sum = list => list.reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const bankStart = living.reduce((s, a) => s + (Number(bal[a.id]) || 0), 0);
    const walletStart = Number(monthly.cashBudget) || 0;
    const salary = Number(monthly.salary) || 0;
    const savings = getSavingsTotal(monthly);
    // 貯金用の口座からATMでおろした現金は、生活のお金に加わる
    const atmAcc = config.cashAccountId || config.salaryAccountId;
    const atmTotal = (monthly.cashTopups || []).reduce((s, c) => s + (Number(c.amount) || 0), 0);
    const cashFromSavings = atmAcc && !livingIds.has(atmAcc) ? atmTotal : 0;
    // 振替: 生活用どうしは0、貯金用→生活用は増える、生活用→貯金用は減る
    const transferEffect = transferEffectOnLiving([...(config.transfers || []), ...(monthly.moves || [])], new Set([...livingIds, 'wallet']));
    const budgetTx = txList.filter(t => getSource(t) === 'budget');
    const spentBudget = sum(budgetTx);
    const due = (config.recurring || []).filter(r => isRecurringDueIn(r, month) && !(monthly.skippedRecurring || []).includes(r.id));
    const recordedIds = new Set(budgetTx.filter(t => t.recurringId).map(t => t.recurringId));
    const fixedPlanned = due.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const pendingFixed = due.filter(r => !recordedIds.has(r.id)).reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const fixedRecorded = sum(budgetTx.filter(t => t.recurringId));
    const res = spendableFromBalance({ bankStart, walletStart, salary, savings, spentBudget, fixedPlanned, fixedRecorded, pendingFixed, cashFromSavings: cashFromSavings + transferEffect });
    return {
      active: true, ...res, living: living.map(a => ({ ...a, start: Number(bal[a.id]) || 0 })),
      bankStart, walletStart, salary, savings, spentBudget, pendingFixed, cashFromSavings,
      // 見込みで計算している部分（実額が分かったら上書きしてもらう）
      salaryProvisional: monthly.salaryConfirmed === false
    };
  }, [config.accounts, config.savingsAccountId, config.cashAccountId, config.salaryAccountId, config.recurring, config.transfers, monthly, txList, month]);
  const BM = balanceMode?.active ? balanceMode : null;

  // 口座ごとの今月の見込み（月初残高 ＋ 入金 − 出ていくお金）
  const accountStats = useMemo(() => {
    const accounts = config.accounts || [];
    const salary = Number(monthly?.salary) || 0;
    const savTotal = getSavingsTotal(monthly);
    const atmTotal = (monthly?.cashTopups || []).reduce((s, c) => s + (Number(c.amount) || 0), 0);
    // 貯金から払った支出は、お金が実際に出るタイミングで貯金用の口座から引く
    //   カード（翌月払い）→ 引落の月 / 口座振替など（当月払い）→ その月（billRows の savingsPortion）
    //   現金 → その月
    const savingsSpent = billRows.reduce((s, r) => s + (r.savingsPortion || 0), 0)
      + txList.filter(t => getSource(t) === 'savings' && (t.paymentMethod || CASH) === CASH).reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const rows = accounts.map(a => {
      const start = Number(monthly.accountBalances?.[a.id]) || 0;
      const bills = billRows.filter(r => (config.methodAccounts || {})[r.m] === a.id).reduce((s, r) => s + r.fromLinked, 0);
      const forecast = forecastAccount({
        accountId: a.id, start, salary, savings: savTotal, bills, atm: atmTotal,
        salaryAccountId: config.salaryAccountId, savingsAccountId: config.savingsAccountId,
        cashAccountId: config.cashAccountId, savingsSpent, transfers: [...(config.transfers || []), ...(monthly.moves || [])]
      });
      return {
        ...a, start, bills, ...forecast
      };
    });
    return { rows, total: rows.reduce((s, r) => s + r.projected, 0) };
  }, [config.accounts, config.methodAccounts, config.salaryAccountId, config.savingsAccountId, config.cashAccountId, config.transfers, monthly, billRows, txList]);

  // カレンダー用: まだ記録されていない定期支出を「予定」として日別にまとめる
  const plannedByDay = useMemo(() => {
    const recorded = new Set(txList.filter(t => t.recurringId).map(t => t.recurringId));
    const [y, m] = month.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    const out = {};
    (config.recurring || []).forEach(r => {
      if (!r.id || !r.title) return;
      if (recorded.has(r.id)) return;
      if ((monthly.skippedRecurring || []).includes(r.id)) return;
      if (!isRecurringDueIn(r, month)) return;
      const d = Math.min(Number(r.day) || 1, lastDay);
      if (!out[d]) out[d] = { total: 0, items: [] };
      out[d].total += Number(r.amount) || 0;
      out[d].items.push(r);
    });
    return out;
  }, [txList, config.recurring, monthly.skippedRecurring, month]);

  // 月を切り替えたら、今月なら今日を・それ以外は未選択に
  useEffect(() => {
    const now = new Date();
    setSelDay(month === getMonthString(now) ? now.getDate() : null);
  }, [month]);

  const calDays = useMemo(() => {
    if (!month) return [];
    const d = new Date(month + '-01T00:00:00Z');
    if (isNaN(d)) return [];
    const first = d.getUTCDay(), last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    return [...Array(first).fill(null), ...Array.from({ length: last }, (_, i) => i + 1)];
  }, [month]);

  const resetInputs = useCallback((dateStr) => {
    setInDate(dateStr || getTodayString());
    setInAmount('');
    setInTitle('');
    setInCat(catNames[0] || '食費');
    setInMethod(methods[0] || CASH);
    setInSource('budget');
    setInSavingsBucket('');
    setTxFormKey(k => k + 1);
  }, [catNames, methods]);

  // 分析 → 指定カテゴリで絞り込んだ履歴へ移動
  const jumpToCat = name => {
    setSearchText('');
    setFilter({ type: 'expense', cat: name, method: 'ALL', source: 'budget' });
    setLogView('list');
    setActiveTab('log');
  };

  // 同じ内容で今日の日付の新規支出として開く
  const duplicateTx = t => {
    setEditingTx(null);
    setInDate(getTodayString());
    setInAmount(String(t.amount ?? ''));
    setInTitle(t.title || '');
    setInCat(t.category || catNames[0] || '食費');
    setInMethod(t.paymentMethod || CASH);
    setInSource(getSource(t));
    setInSavingsBucket(t.savingsBucket || '');
    setTxFormKey(k => k + 1);
    setEditingMove(null);
    setTxMode('expense');
    setDetailsOpen(false);
    setIsTxOpen(true);
    showToast('同じ内容で新しい支出を入力できます');
  };

  const startEdit = t => {
    setEditingTx(t);
    setInDate(isoToLocalYMD(t.date));
    setInAmount(String(t.amount ?? ''));
    setInTitle(t.title || '');
    setInCat(t.category || catNames[0] || '食費');
    setInMethod(t.paymentMethod || CASH);
    setInSource(getSource(t));
    setInSavingsBucket(t.savingsBucket || '');
    setEditingMove(null);
    setTxMode('expense');
    setDetailsOpen(getSource(t) === null); // 旧データで充当元が未設定なら最初から開いておく
    setTxFormKey(k => k + 1);
    setIsTxOpen(true);
  };

  const openNew = () => { setEditingTx(null); setEditingMove(null); setTxMode('expense'); setDetailsOpen(false); resetInputs(); setIsTxOpen(true); };
  // 振替の初期値（ATMでおろすのが一番多いので「口座→財布」）
  const defaultMove = () => ({ from: config.cashAccountId || config.salaryAccountId || (config.accounts || [])[0]?.id || '', to: 'wallet', amount: '', date: getTodayString(), memo: '' });
  const switchTxMode = mode => { setTxMode(mode); if (mode === 'move' && !editingMove) setMv(defaultMove()); };
  const openMove = item => {
    setEditingTx(null);
    setEditingMove(item);
    setMv({ from: item.from || '', to: item.to || 'wallet', amount: String(item.amount || ''), date: item.date || getTodayString(), memo: item.memo || '' });
    setTxMode('move');
    setTxFormKey(k => k + 1);
    setIsTxOpen(true);
  };
  const openWithDate = d => { setEditingTx(null); resetInputs(d); setIsTxOpen(true); };
  const closeTx = useCallback(() => { setIsTxOpen(false); setEditingTx(null); setEditingMove(null); setTxMode('expense'); }, []);
  const applyTpl = t => { setInAmount(String(t.amount)); setInTitle(t.title); setInCat(t.category); setInMethod(t.method); };

  // 振替の保存: 日付の月のデータに保存。編集時は元の記録を消してから追加（月が変わっても対応）
  const submitMove = async e => {
    e.preventDefault(); if (!user || isSaving) return;
    const amount = toNumber(mv.amount);
    if (!mv.from || !mv.to) return showToast('振替元と振替先を選んでください');
    if (mv.from === mv.to) return showToast('振替元と振替先が同じです');
    if (amount <= 0) return showToast('金額を入力してください');
    if (!mv.date) return showToast('日付を選んでください');
    const item = {
      id: editingMove && !editingMove._legacy ? editingMove.id : `mv_${Date.now()}`,
      date: mv.date, from: mv.from, to: mv.to, amount, memo: (mv.memo || '').trim()
    };
    const monthRef = m => doc(db, 'users', user.uid, 'months', m);
    setIsSaving(true);
    try {
      const batch = writeBatch(db);
      if (editingMove) {
        batch.set(monthRef(editingMove._month), editingMove._legacy
          ? { cashTopups: arrayRemove(editingMove._original) }
          : { moves: arrayRemove(editingMove._original) }, { merge: true });
      }
      batch.set(monthRef(item.date.slice(0, 7)), { moves: arrayUnion(item) }, { merge: true });
      await batch.commit();
      showToast(editingMove ? '更新しました' : '振替を記録しました');
      closeTx();
    } catch (err) { console.error(err); showToast('エラー'); }
    finally { setIsSaving(false); }
  };

  const deleteMove = async () => {
    if (!user || !editingMove) return;
    const target = editingMove;
    const monthRef = doc(db, 'users', user.uid, 'months', target._month);
    const field = target._legacy ? 'cashTopups' : 'moves';
    try {
      await setDoc(monthRef, { [field]: arrayRemove(target._original) }, { merge: true });
      closeTx();
      showToast('削除しました', {
        label: '元に戻す',
        onClick: async () => {
          hideToast();
          try { await setDoc(monthRef, { [field]: arrayUnion(target._original) }, { merge: true }); showToast('元に戻しました'); }
          catch (err) { console.error(err); showToast('復元できませんでした'); }
        }
      });
    } catch (err) { console.error(err); showToast('エラー'); }
  };

  // 支出の削除（定期支出はその月だけスキップ扱い）。「元に戻す」で取引とスキップ設定をまとめて復元する
  const deleteTx = async tx => {
    if (!user || !tx?.id) return;
    const isRec = !!tx.recurringId;
    const ok = await confirm({
      title: 'この支出を削除しますか？',
      message: isRec ? '定期支出の今月分はスキップされます（来月から自動記録が再開されます）。' : undefined,
      confirmLabel: '削除する', danger: true
    });
    if (!ok) return;
    try {
      const { id: delId, ...delData } = tx;
      // 日付がISO文字列でもTimestampでも安全に「その支出の月」を求める
      const delMonth = tx.date ? isoToLocalYMD(tx.date).slice(0, 7) : month;
      const batch = writeBatch(db);
      batch.delete(doc(db, 'users', user.uid, 'transactions', delId));
      if (isRec) batch.set(doc(db, 'users', user.uid, 'months', delMonth), { skippedRecurring: arrayUnion(tx.recurringId) }, { merge: true });
      await batch.commit();
      closeTx();
      showToast('削除しました', {
        label: '元に戻す',
        onClick: async () => {
          hideToast();
          try {
            const restore = writeBatch(db);
            restore.set(doc(db, 'users', user.uid, 'transactions', delId), delData);
            if (isRec) restore.set(doc(db, 'users', user.uid, 'months', delMonth), { skippedRecurring: arrayRemove(delData.recurringId) }, { merge: true });
            await restore.commit();
            showToast('元に戻しました');
          } catch (e) { console.error(e); showToast('復元できませんでした'); }
        }
      });
    } catch (e) { console.error(e); showToast('エラー'); }
  };

  const submitTx = async e => {
    e.preventDefault(); if (!user) return;
    if (isSaving) return; // 二重送信の防止
    const amount = toNumber(inAmount);
    if (!inDate || !amount || !inTitle) return showToast('入力内容を確認してください');
    if (!inSource) return showToast('充当元を選んでください');
    // 支出の種類（特別費）は廃止。既存データの値は保持し、新規は通常にする
    const keepKind = editingTx ? (getKind(editingTx) || 'normal') : 'normal';
    const payload = {
      date: toISODateSafe(inDate), amount, title: inTitle, category: inCat, paymentMethod: inMethod,
      kind: keepKind, source: inSource,
      savingsBucket: inSource === 'savings' ? (inSavingsBucket || null) : null,
      // 旧項目も併記（貯金の集計クエリと、古い版のアプリとの互換のため）
      isSpecial: keepKind === 'special',
      fromSavings: inSource === 'savings',
      updatedAt: serverTimestamp()
    };
    setIsSaving(true);
    try {
      if (editingTx?.id) { await updateDoc(doc(db, 'users', user.uid, 'transactions', editingTx.id), payload); showToast('更新しました'); }
      else { await addDoc(collection(db, 'users', user.uid, 'transactions'), { ...payload, createdAt: serverTimestamp() }); showToast('追加しました'); }
      closeTx();
    } catch (e) { console.error(e); showToast('エラー'); }
    finally { setIsSaving(false); }
  };

  // 月の移動（ヘッダーのボタンと横スワイプで共用）
  const shiftMonth = diff => {
    const d = new Date(`${month}-01T00:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + diff);
    setMonth(getMonthString(d));
  };

  // 横スワイプで前月・翌月へ（縦スクロールと誤認しないよう角度と距離で判定）
  const onTouchStart = e => {
    if (e.touches.length !== 1) return (touchRef.current = null);
    touchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
  };
  const onTouchEnd = e => {
    const st = touchRef.current;
    touchRef.current = null;
    if (!st || !e.changedTouches.length) return;
    const dx = e.changedTouches[0].clientX - st.x;
    const dy = e.changedTouches[0].clientY - st.y;
    if (Date.now() - st.t > 600) return;              // ゆっくりの操作は無視
    if (Math.abs(dx) < 60) return;                     // 短い動きは無視
    if (Math.abs(dx) < Math.abs(dy) * 1.8) return;     // 縦方向が強い動きは無視
    shiftMonth(dx < 0 ? 1 : -1);                       // 左スワイプ→翌月 / 右→前月
  };

  const openEdit = (type, data, index) => setEditingItem({ type, data: { ...data }, index });

  const saveSettings = async () => {
    if (!user || !editingItem || isSaving) return;
    setIsSaving(true);
    const { type, data, index } = editingItem;
    try {
      const mRef = doc(db, 'users', user.uid, 'months', month);
      const cRef = doc(db, 'users', user.uid, 'settings', 'config');
      if (['salary', 'cashBudget'].includes(type)) {
        const fm = { salary: 'salary', cashBudget: 'cashBudget' };
        await setDoc(mRef, { [fm[type]]: toNumber(data.value), ...(type === 'salary' ? { salaryConfirmed: true } : {}) }, { merge: true });
      } else if (type === 'account') {
        const list = [...(config.accounts || [])];
        const item = { id: data.id || `acc_${Date.now()}`, name: (data.name || '').trim() };
        if (!item.name) return showToast('口座名を入力してください');
        if (index === -1) list.push(item); else list[index] = { ...list[index], ...item };
        // 口座名（共通設定）と、表示中の月の月初残高（月データ）をまとめて保存する
        await setDoc(cRef, { ...config, accounts: list }, { merge: true });
        await setDoc(mRef, { accountBalances: { ...(monthly.accountBalances || {}), [item.id]: toNumber(data.value) } }, { merge: true });
      } else if (type === 'transfer') {
        const amount = toNumber(data.amount);
        if (!data.from || !data.to) return showToast('振替元と振替先を選んでください');
        if (data.from === data.to) return showToast('振替元と振替先が同じです');
        if (amount <= 0) return showToast('金額を入力してください');
        const list = [...(config.transfers || [])];
        const item = { id: data.id || `tr_${Date.now()}`, from: data.from, to: data.to, amount, day: Math.min(31, Math.max(1, toNumber(data.day) || 1)), title: (data.title || '').trim() };
        if (index === -1) list.push(item); else list[index] = item;
        await setDoc(cRef, { ...config, transfers: list }, { merge: true });
      } else if (type === 'methodAccount') {
        await setDoc(cRef, {
          ...config,
          methodAccounts: { ...(config.methodAccounts || {}), [data.method]: data.accountId || '' },
          methodTimings: { ...(config.methodTimings || {}), [data.method]: data.timing === 'same' ? 'same' : 'next' }
        }, { merge: true });
      } else if (type === 'accountRole') {
        await setDoc(cRef, { ...config, [data.role]: data.accountId || '' }, { merge: true });
      } else if (type === 'cashTopup') {
        const amt = toNumber(data.value);
        if (amt <= 0) return showToast('金額を入力してください');
        const list = [...(monthly.cashTopups || [])];
        if (index === -1) list.push({ id: `ct_${Date.now()}`, amount: amt, date: getTodayString(), shiftCardBudget: data.shiftCardBudget === true });
        else list[index] = { ...list[index], amount: amt, shiftCardBudget: data.shiftCardBudget === true };
        await setDoc(mRef, { cashTopups: list }, { merge: true });
      } else if (type === 'memo') {
        await setDoc(mRef, { memo: data.memo || '' }, { merge: true });
      } else if (type === 'bill') {
        await setDoc(mRef, { cardBills: { ...(monthly.cardBills || {}), [data.name]: toNumber(data.bill) }, cardDueDates: { ...(monthly.cardDueDates || {}), [data.name]: data.due } }, { merge: true });
      } else if (type === 'savingsBucket') {
        const list = [...buckets]; const item = { id: data.id || `sb_${Date.now()}`, name: data.name || '', amount: toNumber(data.amount) };
        if (index === -1) list.unshift(item); else list[index] = item;
        await setDoc(mRef, { savingsBuckets: list, savings: list.reduce((s, b) => s + (Number(b.amount) || 0), 0) }, { merge: true });
      } else if (type === 'category') {
        const list = [...(config.categories || [])];
        if (index === -1) list.unshift({ name: data.name }); else list[index] = { name: data.name };
        await setDoc(cRef, { ...config, categories: list }, { merge: true });
        if (data.budget !== undefined) await setDoc(mRef, { catBudgets: { ...(monthly.catBudgets || {}), [data.name]: toNumber(data.budget) } }, { merge: true });
      } else if (type === 'template') {
        const list = [...(config.templates || [])], item = { ...data, amount: toNumber(data.amount) };
        if (index === -1) list.unshift(item); else list[index] = item;
        await setDoc(cRef, { ...config, templates: list }, { merge: true });
      } else if (type === 'recurring') {
        const list = [...(config.recurring || [])];
        const freq = data.freq === 'yearly' ? 'yearly' : 'monthly';
        const item = {
          ...data, amount: toNumber(data.amount),
          day: Math.min(31, Math.max(1, toNumber(data.day) || 1)),
          freq,
          month: freq === 'yearly' ? Math.min(12, Math.max(1, toNumber(data.month) || 1)) : null,
          id: data.id || `rec_${Date.now()}`
        };
        if (index === -1) list.unshift(item); else list[index] = item;
        await setDoc(cRef, { ...config, recurring: list }, { merge: true });
      } else if (type === 'payment') {
        const list = [...(config.paymentMethods || [CASH])];
        if (index === -1) list.unshift(data.name); else list[index] = data.name;
        await setDoc(cRef, { ...config, paymentMethods: list }, { merge: true });
      }
      setEditingItem(null); showToast('保存しました');
    } catch (e) { console.error(e); showToast('エラー'); }
    finally { setIsSaving(false); }
  };

  const deleteItem = async () => {
    if (!editingItem) return;
    const ok = await confirm({ title: '削除しますか？', message: 'この操作は取り消せません。', confirmLabel: '削除する', danger: true });
    if (!ok) return;
    const { type, index, data } = editingItem;
    const mRef = doc(db, 'users', user.uid, 'months', month);
    const cRef = doc(db, 'users', user.uid, 'settings', 'config');
    try {
      if (type === 'transfer') await setDoc(cRef, { ...config, transfers: (config.transfers || []).filter((_, i) => i !== index) }, { merge: true });
      else if (type === 'account') {
        const acc = (config.accounts || [])[index];
        const methodAccounts = { ...(config.methodAccounts || {}) };
        Object.keys(methodAccounts).forEach(k => { if (methodAccounts[k] === acc?.id) methodAccounts[k] = ''; });
        const roles = {};
        ['salaryAccountId', 'savingsAccountId', 'cashAccountId'].forEach(r => { if (config[r] === acc?.id) roles[r] = ''; });
        const transfers = (config.transfers || []).filter(t => t.from !== acc?.id && t.to !== acc?.id);
        await setDoc(cRef, { ...config, accounts: (config.accounts || []).filter((_, i) => i !== index), methodAccounts, ...roles, transfers }, { merge: true });
      }
      else if (type === 'cashTopup') await setDoc(mRef, { cashTopups: (monthly.cashTopups || []).filter((_, i) => i !== index) }, { merge: true });
      else if (type === 'category') await setDoc(cRef, { ...config, categories: (config.categories || []).filter((_, i) => i !== index) }, { merge: true });
      else if (type === 'template') await setDoc(cRef, { ...config, templates: (config.templates || []).filter((_, i) => i !== index) }, { merge: true });
      else if (type === 'recurring') await setDoc(cRef, { ...config, recurring: (config.recurring || []).filter((_, i) => i !== index) }, { merge: true });
      else if (type === 'payment') await setDoc(cRef, { ...config, paymentMethods: (config.paymentMethods || []).filter((_, i) => i !== index) }, { merge: true });
      else if (type === 'bill') {
        const nb = { ...(monthly.cardBills || {}) }, nd = { ...(monthly.cardDueDates || {}) };
        delete nb[data.name]; delete nd[data.name];
        await setDoc(mRef, { cardBills: nb, cardDueDates: nd }, { merge: true });
      } else if (type === 'savingsBucket') {
        const list = buckets.filter((_, i) => i !== index);
        await setDoc(mRef, { savingsBuckets: list, savings: list.reduce((s, b) => s + (Number(b.amount) || 0), 0) }, { merge: true });
      }
      setEditingItem(null); showToast('削除しました');
    } catch (e) { console.error(e); showToast('エラー'); }
  };

  const copySetting = async () => {
    const ok = await confirm({ title: '設定をコピーしますか？', message: `${formatMonthJP(copyFrom)} から ${formatMonthJP(month)} へ`, confirmLabel: '実行する' });
    if (!ok) return;
    try {
      const snap = await getDoc(doc(db, 'users', user.uid, 'months', copyFrom));
      if (snap.exists()) {
        const d = snap.data();
        await setDoc(doc(db, 'users', user.uid, 'months', month), {
          salary: d.salary || 0, budget: d.budget || 0, cashBudget: d.cashBudget || 0,
          catBudgets: d.catBudgets || {},
          cardDueDates: d.cardDueDates || {}, savings: d.savings || 0, savingsBuckets: d.savingsBuckets || [],
          salaryConfirmed: false
        }, { merge: true });
        showToast('コピーしました'); setCopyOpen(false);
      } else showToast('データがありません');
    } catch { showToast('エラー'); }
  };

  /* 旧・固定費リストを定期支出へ一括移行 */
  const migrateFixed = async () => {
    const list = monthly.fixedCosts || [];
    if (!list.length) return;
    const ok = await confirm({ title: '固定費を定期支出へ移行しますか？', message: `${list.length}件をコピーします。記録日（初期値: 1日）はあとから編集できます。`, confirmLabel: '移行する' });
    if (!ok) return;
    try {
      const cRef = doc(db, 'users', user.uid, 'settings', 'config');
      const newRecs = list.map((f, i) => ({
        id: `rec_${Date.now()}_${i}`,
        title: f.name || '固定費',
        amount: Number(f.amount) || 0,
        category: '固定費',
        method: f.method || CASH,
        day: 1
      }));
      const cats = [...(config.categories || [])];
      if (!cats.some(c => c.name === '固定費')) cats.push({ name: '固定費' });
      await setDoc(cRef, { ...config, categories: cats, recurring: [...(config.recurring || []), ...newRecs] }, { merge: true });
      showToast(`${list.length}件を移行しました`);
    } catch (e) { console.error(e); showToast('エラー'); }
  };

  /* 表示中の月に、未記録の定期支出を一括登録 */
  const recordAllRecurring = async () => {
    if (!user) return;
    const recCard = (config.recurring || []);
    const recordedIds = new Set(txList.filter(t => t.recurringId).map(t => t.recurringId));
    const pending = recCard.filter(r =>
      r.id && r.title && !recordedIds.has(r.id) && isRecurringDueIn(r, month)
      && !(monthly.skippedRecurring || []).includes(r.id));
    if (!pending.length) return showToast('未記録の定期支出はありません');
    const total = pending.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const ok = await confirm({ title: `${pending.length}件の定期支出を記録しますか？`, message: `${formatMonthJP(month)} のログに合計 ¥${total.toLocaleString()} を追加します。`, confirmLabel: '記録する' });
    if (!ok) return;
    try {
      const results = await Promise.all(pending.map(r => createRecurringTransaction(user.uid, month, r, catNames[0])));
      const created = results.filter(Boolean).length;
      showToast(created === pending.length ? `${created}件を記録しました` : `${created}件を記録しました（${pending.length - created}件は既に記録済み）`);
    } catch (e) { console.error(e); showToast('エラー'); }
  };

  const downloadData = (content, filename, mimeType) => {
    const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
    const a = document.createElement('a'); a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const exportCSV = async () => {
    const ok = await confirm({ title: '取引CSVを出力しますか？', confirmLabel: 'ダウンロード' });
    if (!ok) return;
    try {
      const s = await getDocs(query(collection(db, 'users', user.uid, 'transactions'), orderBy('date', 'desc')));
      const rows = [['日付', 'タイトル', 'カテゴリ', '金額', '支払方法', '充当元', '貯金の積立先']];
      s.forEach(d => {
        const v = d.data();
        rows.push([isoToLocalYMD(v.date), v.title, v.category, v.amount, v.paymentMethod,
          SOURCE_LABELS[getSource(v)] || '未設定',
          getSource(v) === 'savings' ? (v.savingsBucket || '指定なし') : '']);
      });
      downloadData('\uFEFF' + rows.map(row => row.map(csvField).join(',')).join('\n') + '\n',
        `zaimu_transactions_${getTodayString()}.csv`, 'text/csv;charset=utf-8;');
    } catch (e) { console.error(e); showToast('CSV出力に失敗しました'); }
  };

  const exportBackup = async () => {
    const ok = await confirm({ title: '全データをJSONで書き出しますか？', confirmLabel: 'ダウンロード' });
    if (!ok) return;
    try {
      const base = doc(db, 'users', user.uid);
      const [tx, months, settings] = await Promise.all([
        getDocs(collection(base, 'transactions')),
        getDocs(collection(base, 'months')),
        getDocs(collection(base, 'settings'))
      ]);
      const entries = snapshot => snapshot.docs.map(d => ({ id: d.id, data: d.data() }));
      const backup = { format: 'zaimu-backup', version: 1, exportedAt: new Date().toISOString(),
        transactions: entries(tx), months: entries(months), settings: entries(settings) };
      downloadData(JSON.stringify(backup, null, 2),
        `zaimu_backup_${getTodayString()}.json`, 'application/json;charset=utf-8;');
    } catch (e) { console.error(e); showToast('バックアップに失敗しました'); }
  };

  if (authLoading) return <div className="h-screen bg-[#1C1C1E] flex items-center justify-center text-[#98989D] text-[14px]">読み込み中...</div>;

  if (!user) return (
    <div className="h-screen w-full bg-[#1C1C1E] flex flex-col items-center justify-center p-8 gap-10">
      <h1 className="text-[32px] font-semibold tracking-tight text-white">ZAIMU</h1>
      <PrimaryButton onClick={() => signInWithPopup(auth, new GoogleAuthProvider())}>
        <Lock size={15} /> Googleでログイン
      </PrimaryButton>
    </div>
  );

  const MENU = [
    { id: 'budget', label: '資金計画', icon: <Landmark size={17} /> },
    { id: 'accounts', label: '口座', icon: <Wallet size={17} /> },
    { id: 'category', label: 'カテゴリ予算', icon: <Tags size={17} /> },
    { id: 'template', label: 'テンプレート', icon: <Zap size={17} /> },
    { id: 'recurring', label: '定期支出', icon: <Repeat size={17} /> },
    { id: 'payment', label: '支払方法', icon: <Wallet size={17} /> },
    { id: 'faq', label: 'ヘルプ・FAQ', icon: <HelpCircle size={17} /> },
  ];
  const menuTitle = MENU.find(m => m.id === settingTab)?.label || '設定';
  const today = getTodayLocal();

  // 理想ペース（自由に使える枠を日割り）
  const curMonthStr = getMonthString(new Date());
  const isCurrentMonth = month === curMonthStr;
  const daysInViewMonth = (() => { const [y, m] = month.split('-').map(Number); return new Date(y, m, 0).getDate(); })();
  const idealPct = isCurrentMonth ? Math.min(100, (today.d / daysInViewMonth) * 100) : (month < curMonthStr ? 100 : 0);
  // 残高ベースの月はそちらの数字でペースを出す
  const H0 = BM
    ? { remain: BM.freeRemain, base: BM.pool, freeBudget: BM.freeBudget }
    : { remain: S.freeRemain, base: S.varBudget, freeBudget: S.freeBudget };
  // 固定費以外に使った額は「自由に使える額 − あと使える」で求める。
  // 固定費が予定より多く記録された分も使った扱いになり、バーの残りと「今月あと使える」が必ず一致する
  const H = { ...H0, freeSpent: H0.freeBudget - H0.remain };
  const idealSpend = Math.round(H.freeBudget * idealPct / 100);
  const paceDiff = H.freeSpent - idealSpend;
  const showPaceMarker = isCurrentMonth && idealPct > 2 && idealPct < 98;

  return (
    <div className="fixed inset-0 w-full bg-[#1C1C1E] text-white font-sans flex flex-col overflow-hidden">
      {confirmDialog}
      <Toast message={toast.message} isVisible={toast.visible} action={toast.action} />
      <OfflineBanner isOffline={isOffline} />

      <div className="w-full max-w-md h-full flex flex-col bg-[#1C1C1E] mx-auto relative">

        {/* HEADER */}
        <header className="flex-none px-4 flex items-center justify-between bg-[#1C1C1E]/75 backdrop-blur-2xl backdrop-saturate-150 border-b border-white/[0.08] z-50" style={{ paddingTop: 'env(safe-area-inset-top)', height: 'calc(3.5rem + env(safe-area-inset-top))' }}>
          {activeTab === 'settings' && settingTab !== 'menu' ? (
            <>
              <button onClick={() => setSettingTab('menu')} className="w-11 h-11 -ml-2 flex items-center justify-center text-[#98989D]"><ArrowLeft size={18} /></button>
              <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center">
                <span className="text-[14px] font-semibold text-white">{menuTitle}</span>
                {settingTab === 'category' && (
                  <span className="text-[11px] text-[#98989D]">¥{S.catBudSum.toLocaleString()}</span>
                )}
              </div>
              <div className="w-10" />
            </>
          ) : (
            <>
              <div className="w-8" />
              <div className="flex items-center gap-0.5">
                <button onClick={() => shiftMonth(-1)} aria-label="前の月" className="w-11 h-11 flex items-center justify-center text-[#98989D]"><ChevronLeft size={16} /></button>
                <span className="text-[14px] font-semibold text-white min-w-[96px] text-center tabular-nums">{formatMonthJP(month)}</span>
                <button onClick={() => shiftMonth(1)} aria-label="次の月" className="w-11 h-11 flex items-center justify-center text-[#98989D]"><ChevronRight size={16} /></button>
              </div>
              <button onClick={() => setMonth(getMonthString(new Date()))} className="w-11 h-11 -mr-2 flex items-center justify-center text-[#98989D]"><Calendar size={16} /></button>
            </>
          )}
        </header>

        <main className="flex-1 flex flex-col overflow-hidden"
          onTouchStart={activeTab === 'settings' ? undefined : onTouchStart}
          onTouchEnd={activeTab === 'settings' ? undefined : onTouchEnd}>

          {/* HOME */}
          {activeTab === 'home' && (
            <div className="flex-1 overflow-y-auto scrollbar-hide pb-36">
              {monthly.memo && (
                <button onClick={() => setMemoExpanded(!memoExpanded)} className="w-full px-4 py-3 flex items-start gap-3 text-left border-b border-white/[0.06] bg-[#2C2C2E]/60">
                  <span className="text-[13px] mt-0.5 shrink-0">📌</span>
                  <span className={`flex-1 text-[13px] text-[#98989D] leading-relaxed ${memoExpanded ? 'whitespace-pre-wrap' : 'truncate'}`}>{monthly.memo}</span>
                  <ChevronDown size={13} className={`text-[#636366] shrink-0 mt-0.5 transition-transform ${memoExpanded ? 'rotate-180' : ''}`} />
                </button>
              )}
              <div className="px-4 pt-4 space-y-5">
                <div>
                  <Label>今月の予算</Label>
                  <Card>
                    {/* メイン数字 + 進捗バー */}
                    <div className="px-5 pt-5 pb-4">
                      <p className="text-[11px] text-[#98989D] mb-1">{BM ? '今月あと使える' : '実質あと使える（カード）'}</p>
                      <p className={`text-[36px] font-semibold tracking-tight leading-none mt-1.5 ${H.remain < 0 ? 'text-[#FF453A]' : 'text-white'}`}>
                        ¥{H.remain.toLocaleString()}
                      </p>
                      <div className="mt-3.5 relative">
                        <div className="h-1 bg-white/[0.08] rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all duration-700 ${H.remain < 0 ? 'bg-[#FF453A]' : 'bg-white/60'}`}
                            style={{ width: `${H.freeBudget > 0 ? Math.min(100, Math.max(0, H.freeSpent) / H.freeBudget * 100) : 0}%` }} />
                        </div>
                        {showPaceMarker && (
                          <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-[2px] h-2.5 bg-white/50 rounded-full" style={{ left: `${idealPct}%` }} />
                        )}
                      </div>
                      <p className="mt-2.5 text-[11px] text-[#636366] tabular-nums">
                        {BM
                          ? <>予算 ¥{BM.pool.toLocaleString()} − 使った分 ¥{BM.spentBudget.toLocaleString()} − 固定費予定 ¥{BM.pendingFixed.toLocaleString()}</>
                          : <>予算 ¥{S.varBudget.toLocaleString()} − 使用 ¥{S.spCard.toLocaleString()} − 固定費予定 ¥{S.pendingFixed.toLocaleString()}</>}
                      </p>
                      {BM?.salaryProvisional && (
                        <p className="mt-1.5 text-[11px] text-[#98989D] leading-relaxed">
                          給与は{monthly.inheritedFrom ? formatMonthJP(monthly.inheritedFrom) : '先月'}の額で仮計算中
                        </p>
                      )}
                      {isCurrentMonth && H.freeBudget > 0 && (
                        <div className="flex items-baseline justify-between gap-3 mt-3.5 pt-3 border-t border-white/[0.08]">
                          <span className="text-[13px] text-[#98989D] shrink-0">今日までに使った</span>
                          <span className="tabular-nums whitespace-nowrap">
                            <span className={`text-[14px] font-medium ${paceDiff <= 0 ? 'text-[#30D158]' : 'text-[#FF453A]'}`}>¥{Math.max(0, H.freeSpent).toLocaleString()}</span>
                            <span className="text-[13px] text-[#636366]"> / 目安 ¥{idealSpend.toLocaleString()}</span>
                          </span>
                        </div>
                      )}
                    </div>

                    <Separator />

                    {BM ? (
                      /* 残高ベース: 今月の予算の内訳（折りたたみ） */
                      <ExpandableRow
                        label="今月の予算"
                        value={`¥${BM.pool.toLocaleString()}`}
                        accent
                        expanded={budgetExpanded}
                        onToggle={() => setBudgetExpanded(v => !v)}
                      >
                        {BM.living.map(a => <SubRow key={a.id} label={`${a.name}（月初）`} value={`¥${a.start.toLocaleString()}`} />)}
                        <SubRow label="財布（月初）" value={`¥${BM.walletStart.toLocaleString()}`} />
                        <SubRow label={`給与${BM.salaryProvisional ? '（仮）' : ''}`} value={`＋¥${BM.salary.toLocaleString()}`} />
                        {BM.cashFromSavings > 0 && <SubRow label="貯金口座からおろした現金" value={`＋¥${BM.cashFromSavings.toLocaleString()}`} />}
                        <SubRow label="先取り（貯金へ）" value={`−¥${BM.savings.toLocaleString()}`} />
                      </ExpandableRow>
                    ) : (
                      <>
                        {/* 給与ベース: 予算の計算フロー（折りたたみ） */}
                        <ExpandableRow
                          label="今月の予算（カード）"
                          value={`¥${S.varBudget.toLocaleString()}`}
                          accent
                          expanded={budgetExpanded}
                          onToggle={() => setBudgetExpanded(v => !v)}
                        >
                          <SubRow label="手取り給与" value={`¥${Number(monthly.salary || 0).toLocaleString()}`} />
                          <SubRow label="先取り合計" value={`−¥${S.savTotal.toLocaleString()}`} />
                          {buckets.map(b => (
                            <div key={b.id} className="flex items-center justify-between pl-7 gap-3">
                              <span className="text-[11px] text-[#545458] truncate">{b.name}</span>
                              <span className="text-[11px] text-[#636366] tabular-nums shrink-0">¥{Number(b.amount || 0).toLocaleString()}</span>
                            </div>
                          ))}
                          <SubRow label="月初のスタート現金" value={`−¥${S.cashBudget.toLocaleString()}`} />
                          {S.cashBudgetShiftTotal > 0 && <SubRow label="カード予算から現金へ" value={`−¥${S.cashBudgetShiftTotal.toLocaleString()}`} />}
                        </ExpandableRow>
                        <Separator />
                        <Row label={`${nextMn}月の着地予想`} value={`¥${S.projCash.toLocaleString()}`} />
                        {balanceMode && !balanceMode.active && isCurrentMonth && (
                          <>
                            <Separator />
                            <button type="button" onClick={() => { setActiveTab('settings'); setSettingTab('accounts'); }}
                              className="w-full px-4 py-3 min-h-[44px] text-left active:bg-white/[0.04] transition-colors">
                              <p className="text-[13px] text-[#0A84FF]">口座の月初残高を入れると、口座に余っているお金も含めて計算します</p>
                              <p className="mt-0.5 text-[11px] text-[#636366]">未入力：{balanceMode.missing.map(a => a.name).join('・')}</p>
                            </button>
                          </>
                        )}
                      </>
                    )}
                  </Card>
                </div>

                <div>
                  <Label trailing={accountStats.rows.length ? '月末の見込み' : ''}>資産</Label>
                  <Card>
                    {accountStats.rows.length > 0 && (
                      <>
                        <Row label="合計" value={`¥${(S.cashRemain + accountStats.total).toLocaleString()}`} accent />
                        <Separator />
                      </>
                    )}
                    {/* 財布（ATMの記録もここから） */}
                    <ExpandableRow
                      label="財布"
                      value={`¥${S.cashRemain.toLocaleString()}`}
                      danger={S.cashRemain < 0}
                      expanded={cashExpanded}
                      onToggle={() => setCashExpanded(v => !v)}
                    >
                      <SubRow label="月初のスタート現金" value={`¥${S.cashBudget.toLocaleString()}`} />
                      {moveItems.filter(m => m.to === 'wallet' || m.from === 'wallet').map(m => (
                        <button key={m.id} type="button" onClick={() => openMove(m)}
                          className="w-full flex items-center justify-between pl-3 gap-3 min-h-[36px] text-left active:opacity-60">
                          <span className="text-[13px] text-[#636366] truncate">
                            {formatDateShort(`${m.date}T12:00:00Z`)} {m.to === 'wallet' ? `${placeName(m.from)}からおろした` : `${placeName(m.to)}へ入金`}
                          </span>
                          <span className="text-[13px] text-[#7C7C80] tabular-nums shrink-0">{m.to === 'wallet' ? '+' : '−'}¥{Number(m.amount || 0).toLocaleString()}</span>
                        </button>
                      ))}
                      <SubRow label="今月の現金支出" value={`−¥${S.spCash.toLocaleString()}`} />
                    </ExpandableRow>
                    {/* 各口座は金額だけ（計算の内訳は設定の口座ページで確認できる） */}
                    {accountStats.rows.map(a => (
                      <div key={a.id}>
                        <Separator />
                        <Row
                          label={a.name}
                          value={`¥${a.projected.toLocaleString()}`}
                          danger={a.projected < 0} />
                      </div>
                    ))}
                    {(() => {
                      // 生活用の口座が月末にマイナスになりそうなときだけ警告する
                      const short = accountStats.rows.filter(a => a.id !== config.savingsAccountId && a.projected < 0);
                      if (!short.length) return null;
                      return (
                        <>
                          <Separator />
                          <p className="px-4 py-3 text-[13px] text-[#FF453A] leading-relaxed">
                            {short.map(a => a.name).join('・')}が月末に足りなくなりそうです。引落の前に残高を確認してください
                          </p>
                        </>
                      );
                    })()}
                    {accountStats.rows.length === 0 && (
                      <>
                        <Separator />
                        <button type="button" onClick={() => { setActiveTab('settings'); setSettingTab('accounts'); }}
                          className="w-full px-4 py-3 min-h-[44px] text-left active:bg-white/[0.04] transition-colors">
                          <p className="text-[13px] text-[#0A84FF]">口座を登録すると、銀行を含めた資産の合計を表示します</p>
                        </button>
                      </>
                    )}
                  </Card>
                </div>
              </div>
            </div>
          )}

          {/* LOG */}
          {activeTab === 'log' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-none px-4 pt-3 pb-2 space-y-1.5">
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <input value={searchText} onChange={e => setSearchText(e.target.value)} placeholder="検索..."
                      className="w-full h-11 bg-[#2C2C2E] rounded-[14px] pl-9 pr-3 text-[16px] text-white outline-none placeholder-[#636366]" />
                    <Search size={14} className="absolute left-3 top-3.5 text-[#636366]" />
                  </div>
                  <div className="flex bg-[#2C2C2E] rounded-[14px] gap-0.5">
                    {[['list', <AlignJustify size={14} />], ['calendar', <CalendarDays size={14} />]].map(([v, icon]) => (
                      <button key={v} onClick={() => setLogView(v)} className={`w-11 h-11 rounded-[10px] flex items-center justify-center transition-colors ${logView === v ? 'bg-white/10 text-white' : 'text-[#636366]'}`}>{icon}</button>
                    ))}
                  </div>
                </div>
                {(() => {
                  // 見た目は小さいピル（高さ32px・13px）にして、タップ領域は44pxを確保する
                  const isActive = filter.type !== 'ALL' || filter.cat !== 'ALL' || filter.method !== 'ALL' || filter.source !== 'ALL';
                  const sourceLabel = filter.source === 'UNSET' ? '未設定' : SOURCE_LABELS[filter.source];
                  return (
                    // 横スクロールにすると月のスワイプと取り合うので、2段に分ける
                    <div className="space-y-2">
                      <div className="h-11 p-1 bg-[#2C2C2E] rounded-[14px] flex">
                        {[['ALL', 'すべて'], ['expense', '支出'], ['move', '振替']].map(([v, l]) => (
                          <button key={v} type="button" onClick={() => setFilter(p => ({ ...p, type: v }))}
                            className={`flex-1 rounded-[10px] text-[13px] font-medium transition-colors ${filter.type === v ? 'bg-[#3A3A3C] text-white' : 'text-[#98989D]'}`}>
                            {l}
                          </button>
                        ))}
                      </div>
                      {(filter.type !== 'move' || isActive) && (
                        <div className="flex gap-2">
                          {filter.type !== 'move' && (
                            <>
                              <FilterPill active={filter.cat !== 'ALL'} onClick={() => setFilterSheet('cat')}><span className="truncate">{filter.cat !== 'ALL' ? filter.cat : 'カテゴリ'}</span><ChevronDown size={12} className="shrink-0" /></FilterPill>
                              <FilterPill active={filter.method !== 'ALL'} onClick={() => setFilterSheet('method')}><span className="truncate">{filter.method !== 'ALL' ? filter.method : '支払方法'}</span><ChevronDown size={12} className="shrink-0" /></FilterPill>
                              <FilterPill active={filter.source !== 'ALL'} onClick={() => setFilterSheet('source')}><span className="truncate">{filter.source !== 'ALL' ? sourceLabel : '充当元'}</span><ChevronDown size={12} className="shrink-0" /></FilterPill>
                            </>
                          )}
                          {isActive && (
                            <FilterPill grow={false} onClick={() => { setSearchText(''); setFilter({ type: 'ALL', cat: 'ALL', method: 'ALL', source: 'ALL' }); }} label="絞り込みをクリア"><X size={14} /></FilterPill>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {isSearching && (
                <p className="flex-none px-5 pb-1 text-[11px] text-[#636366]">
                  {allTxLoading ? '全期間から検索中...' : `${allTxTruncated ? `直近${(allTx || []).length.toLocaleString()}件から` : '全期間から'} ${filteredTx.length}件`}
                </p>
              )}
              <div className="flex-1 px-4 pt-1 pb-36 overflow-y-auto scrollbar-hide">
                {logView === 'list' ? (
                  logGroups.length === 0 ? (
                    <Card><EmptyState>履歴がありません</EmptyState></Card>
                  ) : (
                    <div className="space-y-4">
                      {logGroups.map(g => {
                        const [gy, gm, gd] = g.key.split('-').map(Number);
                        const dow = new Date(Date.UTC(gy, gm - 1, gd)).getUTCDay();
                        const isTodayG = g.key === getTodayString();
                        return (
                          <div key={g.key}>
                            <Label trailing={`¥${g.total.toLocaleString()}`}>
                              {isTodayG ? '今日' : `${g.key.slice(0, 7) === month ? '' : `${gy}年`}${gm}月${gd}日`}（{WEEKDAYS[dow]}）
                            </Label>
                            <Card>
                              {g.items.map((t, idx) => {
                                if (t._move) {
                                  // 振替（ATM含む）: 支出ではないので金額はグレー、日別合計にも含めない
                                  return (
                                    <div key={`mv_${t.id}`}>
                                      <button type="button" onClick={() => openMove(t)}
                                        className="w-full flex items-center gap-3 px-4 py-2.5 min-h-[52px] active:bg-white/[0.04] transition-colors text-left">
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-1.5 min-w-0">
                                            <span className="shrink-0 px-1.5 rounded-[5px] border border-white/[0.15] text-[11px] leading-[18px] text-[#98989D]">{t.to === 'wallet' && t.from !== 'wallet' ? 'ATM' : '振替'}</span>
                                            <p className="text-[14px] text-[#EBEBF5]/80 truncate leading-snug">{placeName(t.from)} → {placeName(t.to)}</p>
                                          </div>
                                          {t.memo && <p className="text-[11px] text-[#636366] truncate mt-0.5">{t.memo}</p>}
                                        </div>
                                        <span className="text-[16px] text-[#98989D] tabular-nums shrink-0 whitespace-nowrap">¥{Number(t.amount || 0).toLocaleString()}</span>
                                      </button>
                                      {idx < g.items.length - 1 && <Separator />}
                                    </div>
                                  );
                                }
                                return (
                                  <div key={t.id}>
                                    <button type="button" onClick={() => startEdit(t)}
                                      className="w-full flex items-center gap-3 px-4 py-2.5 min-h-[52px] active:bg-white/[0.04] transition-colors text-left">
                                      <div className="flex-1 min-w-0">
                                        <p className="text-[14px] text-white truncate leading-snug">{t.title}</p>
                                        <div className="flex items-center gap-1.5 mt-0.5 overflow-hidden whitespace-nowrap text-[11px]">
                                          <span className="text-[#636366]">{t.category}</span>
                                          <span className="text-[#545458]">·</span>
                                          <span className="text-[#636366] truncate">{t.paymentMethod}</span>
                                          {txTags(t).map(g => (<React.Fragment key={g.text}><span className="text-[#545458]">·</span><span className={g.cls}>{g.text}</span></React.Fragment>))}
                                          {t.recurringId && (<><span className="text-[#545458]">·</span><span className="text-[#7C7C80] font-medium flex items-center gap-0.5"><Repeat size={10} />定期</span></>)}
                                        </div>
                                      </div>
                                      <span className="text-[16px] font-semibold text-white tabular-nums shrink-0 whitespace-nowrap">¥{Number(t.amount || 0).toLocaleString()}</span>
                                    </button>
                                    {idx < g.items.length - 1 && <Separator />}
                                  </div>
                                );
                              })}
                            </Card>
                          </div>
                        );
                      })}
                    </div>
                  )
                ) : (
                  <div className="space-y-4">
                    <Card className="p-3">
                      <div className="grid grid-cols-7 text-center mb-1">
                        {WEEKDAYS.map((d, i) => (
                          <span key={d} className={`text-[11px] py-1 ${i === 0 ? 'text-[#FF453A]/60' : i === 6 ? 'text-[#0A84FF]/70' : 'text-[#636366]'}`}>{d}</span>
                        ))}
                      </div>
                      <div className="grid grid-cols-7 gap-1">
                        {calDays.map((day, i) => {
                          if (!day) return <div key={i} className="h-[52px]" />;
                          const amt = dayMap[day]?.total || 0;
                          const planned = plannedByDay[day]?.total || 0;
                          const dow = i % 7;
                          const dStr = `${month}-${String(day).padStart(2, '0')}`;
                          const isToday = dStr === getTodayString();
                          const isFuture = dStr > getTodayString();
                          const isSel = selDay === day;
                          const level = amt > 0 ? Math.min(1, amt / dayMax) : 0;
                          const numColor = isToday ? 'text-white' : dow === 0 ? 'text-[#FF453A]/80' : dow === 6 ? 'text-[#0A84FF]' : 'text-[#EBEBF5]/80';
                          return (
                            <button key={i} onClick={() => setSelDay(isSel ? null : day)}
                              aria-label={`${day}日 ${amt > 0 ? `¥${amt.toLocaleString()}` : '支出なし'}`}
                              className={`h-[52px] flex flex-col items-center justify-center gap-0.5 rounded-[10px] transition-colors ${isSel ? 'ring-1 ring-white/50' : ''} ${isFuture ? 'opacity-40' : ''}`}
                              style={{ backgroundColor: amt > 0 ? `rgba(10,132,255,${0.08 + level * 0.32})` : 'transparent' }}>
                              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[13px] font-medium ${isToday ? 'bg-[#0A84FF]' : ''} ${numColor}`}>{day}</span>
                              <span className={`text-[11px] leading-none tabular-nums h-3 ${amt > 0 ? 'text-[#EBEBF5]/70' : 'text-[#7C7C80]'}`}>
                                {amt > 0 ? fmtCompact(amt) : planned > 0 ? `・${fmtCompact(planned)}` : ''}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </Card>

                    {selDay ? (() => {
                      const info = dayMap[selDay] || { total: 0, items: [] };
                      const [cy, cm] = month.split('-').map(Number);
                      const dow = new Date(Date.UTC(cy, cm - 1, selDay)).getUTCDay();
                      const dStr = `${month}-${String(selDay).padStart(2, '0')}`;
                      return (
                        <div>
                          <Label trailing={`合計 ¥${info.total.toLocaleString()}`}>{cm}月{selDay}日（{WEEKDAYS[dow]}）</Label>
                          <Card>
                            {info.items.length === 0 && (<><EmptyState>この日の支出はありません</EmptyState><Separator /></>)}
                            {info.items.map(t => {
                              const tags = [t.category, t.paymentMethod, ...txTags(t).map(g => g.text), t.recurringId && '定期'].filter(Boolean).join(' · ');
                              return (
                                <div key={t.id}>
                                  <button type="button" onClick={() => startEdit(t)}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 min-h-[48px] active:bg-white/[0.04] transition-colors text-left">
                                    <div className="flex-1 min-w-0">
                                      <p className="text-[14px] text-white truncate">{t.title}</p>
                                      <p className="text-[11px] text-[#636366] truncate">{tags}</p>
                                    </div>
                                    <span className="text-[14px] font-medium text-white tabular-nums shrink-0 whitespace-nowrap">¥{Number(t.amount || 0).toLocaleString()}</span>
                                  </button>
                                  <Separator />
                                </div>
                              );
                            })}
                            {(plannedByDay[selDay]?.items || []).map(r => (
                              <div key={`p_${r.id}`}>
                                <div className="w-full flex items-center gap-3 px-4 py-2.5 min-h-[48px]">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[14px] text-[#98989D] truncate">{r.title}</p>
                                    <p className="text-[11px] text-[#636366] truncate flex items-center gap-1"><Repeat size={10} />定期支出の予定 · {r.method}</p>
                                  </div>
                                  <span className="text-[14px] text-[#98989D] tabular-nums shrink-0 whitespace-nowrap">¥{Number(r.amount || 0).toLocaleString()}</span>
                                </div>
                                <Separator />
                              </div>
                            ))}
                            <AddRow label="この日に支出を追加" onClick={() => openWithDate(dStr)} />
                          </Card>
                        </div>
                      );
                    })() : (
                      <EmptyState>日付をタップすると、その日の明細を表示します</EmptyState>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ANALYSIS */}
          {activeTab === 'analysis' && (
            <div className="flex-1 overflow-y-auto scrollbar-hide px-4 pt-4 pb-36 space-y-4">
              {/* 月間/年間 切替 */}
              <div className="flex bg-[#2C2C2E] rounded-[14px] p-1 gap-1">
                {[['month', '月間'], ['year', '年間']].map(([v, l]) => (
                  <button key={v} onClick={() => setAnalysisView(v)}
                    className={`flex-1 h-11 rounded-[10px] text-[13px] font-medium transition-colors ${analysisView === v ? 'bg-white/10 text-white' : 'text-[#636366]'}`}>
                    {l}
                  </button>
                ))}
              </div>

              {/* 年間ビュー */}
              {analysisView === 'year' && (
                !yearData ? (
                  <EmptyState>読み込み中...</EmptyState>
                ) : (() => {
                  const maxSpend = Math.max(...yearData.months.map(m => yearData.spend[m]), 1);
                  const totalSpend = yearData.months.reduce((s, m) => s + yearData.spend[m], 0);
                  const totalSave = yearData.months.reduce((s, m) => s + yearData.save[m], 0);
                  const activeMonths = yearData.months.filter(m => yearData.spend[m] > 0).length || 1;
                  return (
                    <>
                      <div>
                        <Label>月別支出（直近12ヶ月）</Label>
                        <Card className="p-5">
                          {(() => {
                            const sel = selYearMonth && yearData.months.includes(selYearMonth) ? selYearMonth : yearData.months[yearData.months.length - 1];
                            const selIdx = yearData.months.indexOf(sel);
                            const prevM = selIdx > 0 ? yearData.months[selIdx - 1] : null;
                            const diff = prevM ? yearData.spend[sel] - yearData.spend[prevM] : null;
                            return (
                              <>
                                <div className="mb-4">
                                  <p className="text-[11px] text-[#98989D]">{formatMonthJP(sel)}</p>
                                  <div className="flex items-baseline gap-2 mt-1">
                                    <p className="text-[28px] font-semibold text-white tracking-tight tabular-nums leading-none">¥{yearData.spend[sel].toLocaleString()}</p>
                                    {diff !== null && yearData.spend[prevM] > 0 && (
                                      <span className={`text-[13px] font-medium tabular-nums ${diff <= 0 ? 'text-[#30D158]' : 'text-[#FF453A]'}`}>
                                        前月比 {diff <= 0 ? '−' : '+'}¥{Math.abs(diff).toLocaleString()}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[11px] text-[#636366] mt-1.5 tabular-nums">積立 ¥{yearData.save[sel].toLocaleString()}</p>
                                </div>
                                <div className="flex items-end gap-1 h-32">
                                  {yearData.months.map(m => {
                                    const h = Math.max(2, (yearData.spend[m] / maxSpend) * 100);
                                    const isSel = m === sel;
                                    return (
                                      <button key={m} type="button" onClick={() => setSelYearMonth(m)}
                                        aria-label={`${formatMonthJP(m)} ¥${yearData.spend[m].toLocaleString()}`}
                                        className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end min-w-0">
                                        <div className={`w-full rounded-t-[4px] transition-colors ${isSel ? 'bg-[#0A84FF]' : 'bg-white/20'}`} style={{ height: `${h}%` }} />
                                        <span className={`text-[11px] tabular-nums ${isSel ? 'text-white font-medium' : 'text-[#636366]'}`}>{Number(m.split('-')[1])}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </>
                            );
                          })()}
                        </Card>
                      </div>
                      <div>
                        <Label>年間サマリー</Label>
                        <Card>
                          <Row label="年間支出合計" value={`¥${totalSpend.toLocaleString()}`} />
                          <Separator />
                          <Row label="月平均支出" value={`¥${Math.round(totalSpend / activeMonths).toLocaleString()}`} />
                          <Separator />
                          <Row label="年間先取り合計" value={`¥${totalSave.toLocaleString()}`} accent />
                        </Card>
                      </div>
                      <div>
                        <Label>月別の内訳</Label>
                        <Card>
                          {yearData.months.slice().reverse().map((m, i, arr) => (
                            <div key={m}>
                              <div className="px-4 py-3.5 flex items-center justify-between gap-3">
                                <div className="flex flex-col min-w-0">
                                  <span className="text-[14px] text-[#EBEBF5]/80 truncate">{formatMonthJP(m)}</span>
                                  <span className="text-[11px] text-[#636366] tabular-nums">積立 ¥{yearData.save[m].toLocaleString()}</span>
                                </div>
                                <span className="text-[14px] font-medium text-white tabular-nums shrink-0 whitespace-nowrap">¥{yearData.spend[m].toLocaleString()}</span>
                              </div>
                              {i < arr.length - 1 && <Separator />}
                            </div>
                          ))}
                        </Card>
                      </div>
                    </>
                  );
                })()
              )}

              {analysisView === 'month' && (<>
              <div>
                <Label>カテゴリ別の支出（予算から）</Label>
                <Card>
                <div className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] text-[#98989D] mb-1.5">通常支出</p>
                      <p className="text-[28px] font-semibold text-white tracking-tight tabular-nums leading-none">¥{S.spent.toLocaleString()}</p>
                    </div>
                    <div className={`flex items-center gap-1 px-3 py-1.5 rounded-[10px] text-[11px] font-medium ${S.spent <= S.prevSpent ? 'bg-[#30D158]/10 text-[#30D158]' : 'bg-[#FF453A]/10 text-[#FF453A]'}`}>
                      {S.spent <= S.prevSpent ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
                      {S.spent <= S.prevSpent ? '-' : '+'}¥{Math.abs(S.spent - S.prevSpent).toLocaleString()}
                    </div>
                  </div>
                  {donut.total > 0 && (
                    <div className="flex w-full h-2 rounded-full overflow-hidden gap-px">
                      {donut.items.map(item => <div key={item.name} className="h-full" style={{ width: `${(item.amount / donut.total) * 100}%`, backgroundColor: item.color }} />)}
                    </div>
                  )}
                </div>
                {donut.total > 0 ? (() => {
                  const colorOf = Object.fromEntries(donut.items.map(i => [i.name, i.color]));
                  const catList = Object.entries(S.cats).filter(([, a]) => a > 0).sort((a, b) => b[1] - a[1]);
                  return (
                    <div className="border-t border-white/[0.08]">
                      {catList.map(([name, amt], i) => {
                        const prev = S.prevCats[name] || 0;
                        const d = amt - prev;
                        return (
                          <div key={name}>
                            <button type="button" onClick={() => jumpToCat(name)}
                              className="w-full flex items-center gap-3 px-4 py-2.5 min-h-[48px] active:bg-white/[0.04] transition-colors text-left">
                              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: colorOf[name] || GRAYS[5] }} />
                              <span className="text-[14px] text-[#EBEBF5]/80 truncate flex-1 min-w-0">{name}</span>
                              {prev > 0 && d !== 0 && (
                                <span className={`text-[11px] tabular-nums shrink-0 whitespace-nowrap ${d < 0 ? 'text-[#30D158]' : 'text-[#FF453A]'}`}>
                                  {d < 0 ? '−' : '+'}¥{Math.abs(d).toLocaleString()}
                                </span>
                              )}
                              <span className="text-[14px] font-medium text-white tabular-nums shrink-0 whitespace-nowrap">¥{amt.toLocaleString()}</span>
                              <ChevronDown size={14} className="text-[#636366] -rotate-90 shrink-0" />
                            </button>
                            {i < catList.length - 1 && <Separator />}
                          </div>
                        );
                      })}
                    </div>
                  );
                })() : <EmptyState>データがありません</EmptyState>}
                </Card>
              </div>
              <div>
                <Label>予算の進捗</Label>
                <Card>
                  {BM ? (
                    <>
                      <Row label="今月の予算（口座＋財布）" value={`¥${BM.pool.toLocaleString()}`} />
                      <Separator />
                      <Row label="使った分（カード・現金など）" value={`¥${BM.spentBudget.toLocaleString()}`} />
                      <Separator />
                      <Row label="固定費予定（未記録）" value={`−¥${BM.pendingFixed.toLocaleString()}`} muted />
                      <Separator />
                      <Row label="今月あと使える" value={`¥${BM.freeRemain.toLocaleString()}`} danger={BM.freeRemain < 0} accent={BM.freeRemain >= 0} />
                    </>
                  ) : (
                    <>
                      <Row label="今月の予算（カード）" value={`¥${S.varBudget.toLocaleString()}`} />
                      <Separator />
                      <Row label="使った分（予算×カード）" value={`¥${S.spCard.toLocaleString()}`} />
                      <Separator />
                      <Row label="固定費予定（未記録）" value={`−¥${S.pendingFixed.toLocaleString()}`} muted />
                      <Separator />
                      <Row label="実質あと使える" value={`¥${S.freeRemain.toLocaleString()}`} danger={S.freeRemain < 0} accent={S.freeRemain >= 0} />
                    </>
                  )}
                </Card>
              </div>
              <div>
                <Label>支出の内訳</Label>
                <Card>
                  <Row label="予算から（カード）" value={`¥${S.spCard.toLocaleString()}`} />
                  <Separator />
                  <Row label="うち定期支出（記録済み）" value={`¥${S.recRecorded.toLocaleString()}`} muted />
                  <Separator />
                  <Row label="予算から（現金）" value={`¥${S.spCash.toLocaleString()}`} />
                  <Separator />
                  <Row label="貯金から" value={`¥${S.spSavings.toLocaleString()}`} />
                  <Separator />
                  <Row label="今月の先取り" value={`¥${S.savTotal.toLocaleString()}`} />
                  <Separator />
                  <Row label="カードの支払予定（全充当元）" value={`¥${S.cardOutAll.toLocaleString()}`} muted />
                  <Separator />
                  <Row label="現金の出金（全充当元）" value={`¥${S.cashOutAll.toLocaleString()}`} muted />
                </Card>
              </div>
              {activeCats.length > 0 && (
                <div>
                  <Label>カテゴリ予算</Label>
                  <Card>
                    {activeCats.map((n, idx) => {
                      const cur = S.cats[n] || 0, bud = monthly.catBudgets?.[n] || 0;
                      const over = bud > 0 && cur > bud, pct = bud > 0 ? Math.min(100, cur / bud * 100) : 0;
                      return (
                        <div key={n}>
                          <div className="px-4 py-3">
                            <div className="flex justify-between mb-2">
                              <span className="text-[14px] text-white">{n}</span>
                              <span className={`text-[13px] font-medium tabular-nums ${over ? 'text-[#FF453A]' : 'text-[#98989D]'}`}>¥{cur.toLocaleString()} / ¥{bud.toLocaleString()}</span>
                            </div>
                            <div className="h-1 bg-white/[0.08] rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${over ? 'bg-[#FF453A]' : 'bg-white/50'}`} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                          {idx < activeCats.length - 1 && <Separator />}
                        </div>
                      );
                    })}
                  </Card>
                </div>
              )}
              {S.spUnsetCount > 0 && (
                <Card>
                  <button type="button"
                    onClick={() => { setSearchText(''); setFilter({ type: 'expense', cat: 'ALL', method: 'ALL', source: 'UNSET' }); setLogView('list'); setActiveTab('log'); }}
                    className="w-full px-5 py-4 text-left active:bg-white/[0.04] transition-colors">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[13px] text-[#FF453A]">充当元が未設定の支出</p>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[16px] font-semibold text-white tabular-nums">¥{S.spUnset.toLocaleString()}</span>
                        <ChevronDown size={14} className="text-[#636366] -rotate-90" />
                      </div>
                    </div>
                    <p className="mt-1 text-[11px] text-[#636366] leading-relaxed">
                      {S.spUnsetCount}件。旧バージョンで記録した支出です。どこから出したお金かが未記録のため、予算・貯金のどちらの残額からも引いていません。タップして分類できます
                    </p>
                  </button>
                </Card>
              )}
              {S.spSavings > 0 && (
                <Card className="p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <PiggyBank size={13} className="text-[#4A7BA6]" />
                    <p className="text-[11px] text-[#98989D]">貯金からの支払い（今月）</p>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-[22px] font-semibold text-white tabular-nums">¥{S.spSavings.toLocaleString()}</span>
                    <span className="text-[13px] text-[#636366]">今月の予算には計上しません</span>
                  </div>
                </Card>
              )}
              </>)}
            </div>
          )}

          {/* SETTINGS */}
          {activeTab === 'settings' && (
            <div className="flex-1 overflow-y-auto scrollbar-hide px-4 pt-4 pb-36 space-y-4">
              {settingTab === 'menu' && (
                <>
                  <div className="flex items-center gap-3 p-3.5 bg-[#2C2C2E] rounded-[20px]">
                    {user.photoURL ? <img src={user.photoURL} referrerPolicy="no-referrer" alt="" className="w-10 h-10 rounded-[14px]" /> : <div className="w-10 h-10 rounded-[14px] bg-[#3A3A3C] flex items-center justify-center"><User size={16} className="text-[#98989D]" /></div>}
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-medium text-white truncate">{user.displayName || 'User'}</p>
                      <p className="text-[13px] text-[#98989D] truncate">{user.email}</p>
                    </div>
                    <button onClick={async () => { const ok = await confirm({ title: 'ログアウトしますか？', confirmLabel: 'ログアウト', danger: true }); if (ok) signOut(auth); }} className="w-11 h-11 bg-[#FF453A]/10 text-[#FF453A] rounded-[14px] flex items-center justify-center shrink-0"><LogOut size={15} /></button>
                  </div>
                  <div>
                    <Label>メニュー</Label>
                    <Card>
                      <div>
                        {MENU.map((item, idx) => (
                          <div key={item.id}>
                            <SettingsRow onClick={() => setSettingTab(item.id)} left={<div className="flex items-center gap-3"><span className="text-[#98989D]">{item.icon}</span><span>{item.label}</span></div>} showChevron />
                            {idx < MENU.length - 1 && <Separator />}
                          </div>
                        ))}
                      </div>
                    </Card>
                  </div>
                  <div>
                    <Label>データ</Label>
                    <Card>
                      <SettingsRow
                        onClick={() => { const d = new Date(`${month}-01T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() - 1); setCopyFrom(getMonthString(d)); setCopyOpen(true); }}
                        left={<div className="flex items-center gap-3"><CopyCheck size={17} className="text-[#98989D] shrink-0" /><span>先月の設定をコピー</span></div>}
                        showChevron />
                      <Separator />
                      <SettingsRow
                        onClick={recordAllRecurring}
                        left={<div className="flex items-center gap-3"><Repeat size={17} className="text-[#98989D] shrink-0" /><span>今月の定期支出を記録</span></div>}
                        showChevron />
                      <Separator />
                      <SettingsRow
                        onClick={exportCSV}
                        left={<div className="flex items-center gap-3"><FileText size={17} className="text-[#98989D] shrink-0" /><span>取引CSVを書き出す</span></div>}
                        showChevron />
                      <Separator />
                      <SettingsRow
                        onClick={exportBackup}
                        left={<div className="flex items-center gap-3"><FileText size={17} className="text-[#98989D] shrink-0" /><span>JSONバックアップを書き出す</span></div>}
                        showChevron />
                    </Card>
                  </div>
                </>
              )}
              {settingTab === 'faq' && (
                <div className="space-y-4">
                  <div className="relative">
                    <input value={faqQ} onChange={e => setFaqQ(e.target.value)} placeholder="検索..." className="w-full h-11 bg-[#2C2C2E] rounded-[14px] pl-9 pr-4 text-[16px] text-white outline-none placeholder-[#636366]" />
                    <Search size={14} className="absolute left-3 top-3.5 text-[#636366]" />
                    {faqQ && <button onClick={() => setFaqQ('')} className="absolute right-1 top-0 w-11 h-11 flex items-center justify-center text-[#636366]"><X size={14} /></button>}
                  </div>
                  {filteredFaq.length > 0 ? filteredFaq.map((sec, si) => (
                    <div key={si}>
                      <Label>{sec.category}</Label>
                      <Card>
                        <div>
                          {sec.items.map((item, ii) => (
                            <div key={ii}>
                              <div onClick={() => setExpandedFaq(expandedFaq === `${si}-${ii}` ? null : `${si}-${ii}`)} className="px-4 py-3 cursor-pointer active:bg-white/[0.03] transition-colors">
                                <div className="flex justify-between items-start gap-3">
                                  <div className="flex items-start gap-2.5"><HelpCircle size={14} className="text-[#636366] mt-0.5 shrink-0" /><span className="text-[13px] text-white leading-snug">{item.q}</span></div>
                                  <ChevronDown size={14} className={`text-[#636366] transition-transform shrink-0 mt-0.5 ${expandedFaq === `${si}-${ii}` ? 'rotate-180' : ''}`} />
                                </div>
                                {expandedFaq === `${si}-${ii}` && (
                                  <div className="mt-3 pl-6 space-y-2">
                                    <p className="text-[13px] text-[#98989D] leading-relaxed">{item.a}</p>
                                    {item.formula && (
                                      <div className="px-3 py-2.5 bg-white/[0.04] rounded-[10px]">
                                        <p className="text-[11px] text-[#636366] mb-1">計算式</p>
                                        <p className="text-[13px] text-[#EBEBF5]/80 tabular-nums leading-relaxed">{item.formula}</p>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                              {ii < sec.items.length - 1 && <Separator />}
                            </div>
                          ))}
                        </div>
                      </Card>
                    </div>
                  )) : <EmptyState>見つかりませんでした</EmptyState>}
                </div>
              )}
              {settingTab === 'budget' && (
                <div className="space-y-5">
                  <div>
                    <Label>資金計画</Label>
                    <Card>
                      <div>
                        {[
                          { key: 'salary', label: '手取り給与', val: monthly.salary },
                          { key: 'cashBudget', label: '月初のスタート現金', val: monthly.cashBudget },
                        ].map((item, idx) => (
                          <div key={item.key}>
                            <SettingsRow onClick={() => openEdit(item.key, { value: item.val }, 0)} left={item.label} right={`¥${Number(item.val || 0).toLocaleString()}`} />
                            {idx < 1 && <Separator />}
                          </div>
                        ))}
                        <Separator />
                        <SettingsRow onClick={() => openEdit('memo', { memo: monthly.memo }, 0)} left="今月のメモ" right={monthly.memo ? '設定済み' : '未設定'} />
                      </div>
                    </Card>
                  </div>
                  <div>
                    <Label trailing={`合計 ¥${S.savTotal.toLocaleString()}`}>先取り設定</Label>
                    <Card>
                      {buckets.map((b, i) => (
                        <div key={b.id || i}>
                          <SettingsRow onClick={() => openEdit('savingsBucket', b, i)} left={b.name} right={`¥${Number(b.amount || 0).toLocaleString()}`} />
                          <Separator />
                        </div>
                      ))}
                      <AddRow label="先取り項目を追加" onClick={() => openEdit('savingsBucket', { id: '', name: '', amount: '' }, -1)} />
                    </Card>
                  </div>
                  <div>
                    {(() => {
                      const rows = billRows;
                      const total = billTotal;
                      return (
                        <>
                          <Label trailing={`合計 ¥${total.toLocaleString()}`}>今月の引落予定</Label>
                          <Card>
                            {rows.map((r, i) => (
                              <div key={r.m}>
                                <SettingsRow
                                  onClick={() => openEdit('bill', { name: r.m, bill: r.manual || '', due: r.due ?? '' }, 0)}
                                  left={<div className="flex flex-col min-w-0"><span className="text-[14px] text-white truncate">{r.m}</span><span className="text-[11px] text-[#636366] truncate">{r.manual > 0 ? '手入力' : '前月の利用額から自動'}{r.due ? ` · ${r.due}日` : ''}</span></div>}
                                  right={`¥${r.shown.toLocaleString()}`} />
                                {i < rows.length - 1 && <Separator />}
                              </div>
                            ))}
                          </Card>
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}
              {settingTab === 'accounts' && (
                <div className="space-y-5">
                  <div>
                    <Label>口座と月初残高</Label>
                    <Card>
                      {accountStats.rows.length === 0 && (
                        <><EmptyState>銀行口座を登録して月初残高を入力できます。月末の参考見込みはホームに表示します</EmptyState><Separator /></>
                      )}
                      {accountStats.rows.map(a => (
                        <div key={a.id}>
                          <SettingsRow
                            onClick={() => openEdit('account', { id: a.id, name: a.name, value: a.start || '', monthLabel: formatMonthJP(month) }, (config.accounts || []).findIndex(x => x.id === a.id))}
                            left={<div className="flex flex-col min-w-0"><span className="text-[14px] text-white truncate">{a.name}</span><span className="text-[11px] text-[#636366] truncate">{formatMonthJP(month)}の月初残高</span></div>}
                            right={`¥${a.start.toLocaleString()}`} showChevron />
                          <Separator />
                        </div>
                      ))}
                      <AddRow label="口座を追加" onClick={() => openEdit('account', { id: '', name: '', value: '', monthLabel: formatMonthJP(month) }, -1)} />
                    </Card>
                  </div>

                  {accountStats.rows.length > 0 && (
                    <>
                      <div>
                        <Label>月末の見込み（計算の内訳）</Label>
                        <Card>
                          {accountStats.rows.map((a, idx, arr) => (
                            <div key={a.id}>
                              <div className="px-4 py-3">
                                <div className="flex items-center justify-between gap-3">
                                  <span className="text-[14px] text-[#EBEBF5]/80 truncate">{a.name}{a.id === config.savingsAccountId ? '（貯金）' : ''}</span>
                                  <span className={`text-[14px] font-medium tabular-nums shrink-0 ${a.projected < 0 ? 'text-[#FF453A]' : 'text-white'}`}>¥{a.projected.toLocaleString()}</span>
                                </div>
                                <p className="mt-1 text-[11px] text-[#636366] tabular-nums leading-relaxed">
                                  月初 ¥{a.start.toLocaleString()}
                                  {a.inSalary > 0 && ` ＋給与 ¥${a.inSalary.toLocaleString()}`}
                                  {a.inSavings > 0 && ` ＋先取り ¥${a.inSavings.toLocaleString()}`}
                                  {a.bills > 0 && ` −引落 ¥${a.bills.toLocaleString()}`}
                                  {a.outSavings > 0 && ` −先取り ¥${a.outSavings.toLocaleString()}`}
                                  {a.outAtm > 0 && ` −ATM ¥${a.outAtm.toLocaleString()}`}
                                  {a.outSavingsSpent > 0 && ` −貯金から払った支出 ¥${a.outSavingsSpent.toLocaleString()}`}
                                  {a.transferIn > 0 && ` ＋振替 ¥${a.transferIn.toLocaleString()}`}
                                  {a.transferOut > 0 && ` −振替 ¥${a.transferOut.toLocaleString()}`}
                                </p>
                              </div>
                              {idx < arr.length - 1 && <Separator />}
                            </div>
                          ))}
                        </Card>
                        <p className="mt-2 px-1.5 text-[11px] text-[#636366] leading-relaxed">
                          登録済みの給与・引落・先取り・ATMからの試算です。記録していない入出金は含まないため、銀行の実際の残高とずれることがあります
                        </p>
                      </div>

                      <div>
                        <Label>口座の役割</Label>
                        <Card>
                          {[
                            { role: 'salaryAccountId', label: '給与の入金先', note: '手取り給与が入る口座' },
                            { role: 'savingsAccountId', label: '先取りの移動先', note: '毎月の先取りを移す口座' },
                            { role: 'cashAccountId', label: 'ATMでおろす口座', note: '未設定なら給与の入金先を使います' },
                          ].map((r, i, arr) => (
                            <div key={r.role}>
                              <SettingsRow
                                onClick={() => openEdit('accountRole', { role: r.role, accountId: config[r.role] || '', label: r.label }, 0)}
                                left={<div className="flex flex-col min-w-0"><span className="text-[14px] text-white truncate">{r.label}</span><span className="text-[11px] text-[#636366] truncate">{r.note}</span></div>}
                                right={(config.accounts || []).find(a => a.id === config[r.role])?.name || '未設定'} />
                              {i < arr.length - 1 && <Separator />}
                            </div>
                          ))}
                        </Card>
                      </div>

                      <div>
                        <Label>支払方法の引落口座</Label>
                        <Card>
                          {methods.filter(m => m !== CASH).map((m, i, arr) => (
                            <div key={m}>
                              <SettingsRow
                                onClick={() => openEdit('methodAccount', { method: m, accountId: (config.methodAccounts || {})[m] || '', timing: methodTimingOf(m, config.methodTimings), label: `${m} の引落口座` }, 0)}
                                left={<div className="flex flex-col min-w-0"><span className="text-[14px] text-white truncate">{m}</span><span className="text-[11px] text-[#636366] truncate">{methodTimingOf(m, config.methodTimings) === 'same' ? '当月払い（使った月に引き落とし）' : '翌月払い（使った翌月に引き落とし）'}</span></div>}
                                right={(config.accounts || []).find(a => a.id === (config.methodAccounts || {})[m])?.name || '未設定'} />
                              {i < arr.length - 1 && <Separator />}
                            </div>
                          ))}
                        </Card>
                      </div>

                      <div>
                        <Label>毎月の振替</Label>
                        <Card>
                          {(config.transfers || []).length === 0 && (
                            <><EmptyState>カードの引落用に別の口座へ移しているお金などを登録すると、各口座の見込みが実際の残高と合うようになります</EmptyState><Separator /></>
                          )}
                          {(config.transfers || [])
                            .map((t, idx) => ({ t, idx }))
                            .sort((a, b) => (Number(a.t.day) || 0) - (Number(b.t.day) || 0))
                            .map(({ t, idx }) => {
                              const nameOf = id => (config.accounts || []).find(a => a.id === id)?.name || '未設定';
                              return (
                                <div key={t.id || idx}>
                                  <button type="button" onClick={() => openEdit('transfer', { ...t }, idx)}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 min-h-[52px] active:bg-white/[0.04] transition-colors text-left">
                                    <span className="w-12 shrink-0 text-[13px] font-medium text-[#98989D] tabular-nums">{t.day}日</span>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-[14px] text-white truncate">{nameOf(t.from)} → {nameOf(t.to)}</p>
                                      {t.title && <p className="text-[11px] text-[#636366] truncate">{t.title}</p>}
                                    </div>
                                    <span className="text-[14px] font-medium text-white tabular-nums shrink-0 whitespace-nowrap">¥{Number(t.amount || 0).toLocaleString()}</span>
                                  </button>
                                  <Separator />
                                </div>
                              );
                            })}
                          <AddRow label="振替を追加" onClick={() => openEdit('transfer', { id: '', from: config.salaryAccountId || '', to: '', amount: '', day: 25, title: '' }, -1)} />
                        </Card>
                      </div>

                    </>
                  )}
                </div>
              )}
              {settingTab === 'category' && (
                <Card>
                  {(config?.categories || []).length === 0 && (
                    <><EmptyState>カテゴリごとに予算を設定すると、分析タブで使いすぎをチェックできます</EmptyState><Separator /></>
                  )}
                  {(config?.categories || []).map((c, i) => {
                    const b = monthly.catBudgets?.[c.name] || 0;
                    return (
                      <div key={c.name}>
                        <SettingsRow onClick={() => openEdit('category', { name: c.name, budget: b }, i)} left={c.name} right={`¥${Number(b).toLocaleString()}`} />
                        <Separator />
                      </div>
                    );
                  })}
                  <AddRow label="カテゴリを追加" onClick={() => openEdit('category', { name: '', budget: '' }, -1)} />
                </Card>
              )}
              {settingTab === 'template' && (
                <Card>
                  {(config?.templates || []).length === 0 && (
                    <><EmptyState>よく使う支出を登録すると、入力時にワンタップで呼び出せます</EmptyState><Separator /></>
                  )}
                  {(config?.templates || []).map((t, i) => (
                    <div key={i}>
                      <SettingsRow onClick={() => openEdit('template', t, i)} left={<div className="flex flex-col min-w-0"><span className="text-[14px] text-white truncate">{t.title}</span><span className="text-[11px] text-[#636366] truncate">{t.category} · {t.method}</span></div>} right={`¥${Number(t.amount || 0).toLocaleString()}`} />
                      <Separator />
                    </div>
                  ))}
                  <AddRow label="テンプレートを追加" onClick={() => openEdit('template', { title: '', amount: '', category: catNames[0] || '食費', method: methods[0] || CASH }, -1)} />
                </Card>
              )}
              {settingTab === 'recurring' && (() => {
                // 並べ替えても編集・削除の対象がずれないよう、元の並び順（idx）を保持しておく
                const all = (config?.recurring || []).map((r, idx) => ({ r, idx }));
                const monthlyItems = all.filter(x => (x.r.freq || 'monthly') !== 'yearly')
                  .sort((a, b) => (Number(a.r.day) || 0) - (Number(b.r.day) || 0) || String(a.r.title).localeCompare(String(b.r.title), 'ja'));
                const yearlyItems = all.filter(x => x.r.freq === 'yearly')
                  .sort((a, b) => (Number(a.r.month) || 0) - (Number(b.r.month) || 0) || (Number(a.r.day) || 0) - (Number(b.r.day) || 0));
                const monthlyTotal = monthlyItems.reduce((s, x) => s + (Number(x.r.amount) || 0), 0);
                const yearlyTotal = yearlyItems.reduce((s, x) => s + (Number(x.r.amount) || 0), 0);
                const [vy, vm] = month.split('-').map(Number);
                const lastDay = new Date(vy, vm, 0).getDate();
                const recordedIds = new Set(txList.filter(t => t.recurringId).map(t => t.recurringId));
                const skipped = monthly.skippedRecurring || [];
                const isPastMonth = month < getMonthString(new Date());

                // 表示中の月での状況
                const statusOf = r => {
                  if (!isRecurringDueIn(r, month)) return { text: `次回 ${r.month}月${r.day}日`, cls: 'text-[#636366]' };
                  if (skipped.includes(r.id)) return { text: `${vm}月はスキップ`, cls: 'text-[#636366]' };
                  if (recordedIds.has(r.id)) return { text: '✓ 記録済み', cls: 'text-[#30D158]' };
                  const d = Math.min(Number(r.day) || 1, lastDay);
                  if (isPastMonth || (isCurrentMonth && d < today.d)) return { text: '未記録', cls: 'text-[#FF453A]' };
                  return { text: `${vm}/${d} 予定`, cls: 'text-[#98989D]' };
                };

                const renderRow = ({ r, idx }, dayLabel) => {
                  const st = statusOf(r);
                  return (
                    <button type="button" onClick={() => openEdit('recurring', r, idx)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 min-h-[52px] active:bg-white/[0.04] transition-colors text-left">
                      <span className="w-12 shrink-0 text-[13px] font-medium text-[#98989D] tabular-nums">{dayLabel}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] text-white truncate">{r.title}</p>
                        <p className="text-[11px] text-[#636366] truncate">{r.category} · {r.method}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-[14px] font-medium text-white tabular-nums whitespace-nowrap">¥{Number(r.amount || 0).toLocaleString()}</p>
                        <p className={`text-[11px] whitespace-nowrap ${st.cls}`}>{st.text}</p>
                      </div>
                    </button>
                  );
                };

                // 今日の区切り: 表示中が今月のときだけ、今日以前と明日以降の間に入れる
                const splitAt = isCurrentMonth ? monthlyItems.findIndex(x => Math.min(Number(x.r.day) || 1, lastDay) > today.d) : -1;

                return (
                  <div className="space-y-5">
                    <div>
                      <Label trailing={monthlyItems.length ? `合計 ¥${monthlyTotal.toLocaleString()}` : ''}>毎月</Label>
                      <Card>
                        {!all.length && (
                          <><EmptyState>サブスクや家賃など、毎月決まった支出を登録すると指定日に自動でログへ記録されます</EmptyState><Separator /></>
                        )}
                        {monthlyItems.map((x, i) => (
                          <div key={x.r.id || x.idx}>
                            {i === splitAt && i > 0 && (
                              <div className="flex items-center gap-2 px-4 py-1.5">
                                <div className="flex-1 h-px bg-[#0A84FF]/40" />
                                <span className="text-[11px] font-medium text-[#0A84FF] tabular-nums">今日 {today.m}/{today.d}</span>
                                <div className="flex-1 h-px bg-[#0A84FF]/40" />
                              </div>
                            )}
                            {renderRow(x, `${x.r.day}日`)}
                            <Separator />
                          </div>
                        ))}
                        {(monthly.fixedCosts || []).length > 0 && (
                          <><SettingsRow onClick={migrateFixed} left={<div className="flex items-center gap-3"><CopyCheck size={15} className="text-[#0A84FF] shrink-0" /><span className="text-[#0A84FF]">旧・固定費リストから一括移行</span></div>} right={`${(monthly.fixedCosts || []).length}件`} /><Separator /></>
                        )}
                        <AddRow label="定期支出を追加" onClick={() => openEdit('recurring', { id: '', title: '', amount: '', category: catNames[0] || '食費', method: methods[0] || CASH, day: 1, freq: 'monthly', month: mn }, -1)} />
                      </Card>
                      {monthlyItems.length > 0 && (
                        <p className="mt-2 px-1.5 text-[11px] text-[#636366] leading-relaxed">{vm}月の状況を表示しています。記録済みの支出を削除すると、その月だけスキップになります</p>
                      )}
                    </div>

                    {yearlyItems.length > 0 && (
                      <div>
                        <Label trailing={`月あたり ¥${Math.round(yearlyTotal / 12).toLocaleString()}`}>毎年</Label>
                        <Card>
                          {yearlyItems.map((x, i) => (
                            <div key={x.r.id || x.idx}>
                              {renderRow(x, `${x.r.month}/${x.r.day}`)}
                              {i < yearlyItems.length - 1 && <Separator />}
                            </div>
                          ))}
                        </Card>
                        <p className="mt-2 px-1.5 text-[11px] text-[#636366] leading-relaxed">年間合計 ¥{yearlyTotal.toLocaleString()}。記録される月だけ予算から差し引かれます</p>
                      </div>
                    )}
                  </div>
                );
              })()}
              {settingTab === 'payment' && (
                <Card>
                  {methods.map((m, i) => (
                    <div key={m}>
                      <SettingsRow onClick={() => openEdit('payment', { name: m }, i)} left={m} />
                      <Separator />
                    </div>
                  ))}
                  <AddRow label="支払方法を追加" onClick={() => openEdit('payment', { name: '' }, -1)} />
                </Card>
              )}
            </div>
          )}
        </main>

        {/* FOOTER — Liquid Glass風フローティングバー */}
        <footer
          className="fixed left-5 right-5 z-50 max-w-[400px] mx-auto rounded-[30px] bg-white/[0.08] backdrop-blur-2xl backdrop-saturate-150 border border-white/[0.12] shadow-2xl shadow-black/40 flex items-center justify-around px-3 py-2"
          style={{ bottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
        >
          {[[<Home size={20} />, 'home', 'ホーム'], [<History size={20} />, 'log', '履歴']].map(([icon, tab, label]) => (
            <NavButton key={tab} active={activeTab === tab} onClick={() => setActiveTab(tab)} icon={icon} label={label} />
          ))}
          <button onClick={openNew} aria-label="支出を入力" className="w-12 h-12 bg-[#0A84FF] text-white rounded-full flex items-center justify-center active:scale-90 transition-transform shadow-lg shadow-[#0A84FF]/30 shrink-0">
            <Plus size={22} />
          </button>
          {[[<BarChart3 size={20} />, 'analysis', '分析'], [<Settings size={20} />, 'settings', '設定']].map(([icon, tab, label]) => (
            <NavButton key={tab} active={activeTab === tab} onClick={() => { setActiveTab(tab); if (tab === 'settings') setSettingTab('menu'); }} icon={icon} label={label} />
          ))}
        </footer>
      </div>

      {/* 支出詳細モーダル */}

      {/* 計算機モーダル */}
      {showCalc && (
        <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center sm:p-6 bg-black/60 backdrop-blur-sm" onClick={() => setShowCalc(false)}>
          <div className="w-full sm:max-w-xs bg-[#1C1C1E]/80 backdrop-blur-2xl backdrop-saturate-150 rounded-t-3xl sm:rounded-3xl border border-white/[0.12] p-5" style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }} onClick={e => e.stopPropagation()}>
            <CalculatorPad initialValue={calcInit} onConfirm={val => { if (calcCb) calcCb(val); setShowCalc(false); }} />
          </div>
        </div>
      )}

      {/* 支出入力モーダル */}
      {filterSheet && (() => {
        const conf = {
          cat: { title: 'カテゴリ', all: 'すべてのカテゴリ', opts: catNames.map(c => ({ value: c, label: c })) },
          method: { title: '支払方法', all: 'すべての支払方法', opts: methods.map(m => ({ value: m, label: m })) },
          source: { title: '充当元', all: 'すべての充当元', opts: [...SOURCES, { value: 'UNSET', label: '未設定' }] },
        }[filterSheet];
        const current = filter[filterSheet];
        const pick = v => { setFilter(p => ({ ...p, [filterSheet]: v })); setFilterSheet(null); };
        return (
          <Modal onClose={() => setFilterSheet(null)}>
            <ModalHeader title={conf.title} onClose={() => setFilterSheet(null)} />
            <div className="flex-1 overflow-y-auto px-4 pt-3 pb-8">
              <Card>
                {[{ value: 'ALL', label: conf.all }, ...conf.opts].map((o, i, arr) => (
                  <div key={o.value}>
                    <button type="button" onClick={() => pick(o.value)}
                      className="w-full flex items-center justify-between px-4 min-h-[44px] text-left active:bg-white/[0.04] transition-colors">
                      <span className={`text-[14px] ${current === o.value ? 'text-[#0A84FF] font-medium' : 'text-white'}`}>{o.label}</span>
                      {current === o.value && <Check size={15} className="text-[#0A84FF] shrink-0" />}
                    </button>
                    {i < arr.length - 1 && <Separator />}
                  </div>
                ))}
              </Card>
            </div>
          </Modal>
        );
      })()}
      {isTxOpen && (
        <Modal onClose={closeTx}>
          <ModalHeader title={txMode === 'move' ? (editingMove ? '振替を編集' : '振替を記録') : (editingTx ? '支出を編集' : '支出を入力')} onClose={closeTx} />
          <div className="flex-1 overflow-y-auto overflow-x-hidden px-5 pt-4 pb-8">
            {/* 支出 / 振替 の切り替え（新規のときだけ） */}
            {!editingTx && !editingMove && (
              <div className="flex p-1 mb-4 bg-[#2C2C2E] rounded-[14px]">
                {[['expense', '支出'], ['move', '振替・ATM']].map(([v, l]) => (
                  <button key={v} type="button" onClick={() => switchTxMode(v)}
                    className={`flex-1 h-10 rounded-[11px] text-[14px] font-medium transition-colors ${txMode === v ? 'bg-[#3A3A3C] text-white' : 'text-[#98989D]'}`}>
                    {l}
                  </button>
                ))}
              </div>
            )}
            {txMode === 'move' ? (
              <form id="mv-form" onSubmit={submitMove} className="space-y-3.5 w-full min-w-0">
                {[['from', '振替元（お金が出る）'], ['to', '振替先（お金が入る）']].map(([key, label]) => (
                  <div key={key}>
                    <label className="text-[11px] font-medium text-[#98989D] ml-1 block mb-1">{label}</label>
                    <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-5 px-5">
                      {[{ id: 'wallet', name: '財布' }, ...(config.accounts || [])].map(a => (
                        <button key={a.id} type="button" onClick={() => setMv(p => ({ ...p, [key]: a.id }))}
                          className={`shrink-0 h-11 px-4 rounded-[14px] text-[13px] font-medium transition-colors ${mv[key] === a.id ? 'bg-[#0A84FF] text-white' : 'bg-[#2C2C2E] text-[#98989D] border border-white/[0.06]'}`}>
                          {a.name}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                <div>
                  <label className="text-[11px] font-medium text-[#98989D] ml-1 block mb-1">金額</label>
                  <div className="flex gap-1.5 items-center w-full min-w-0">
                    <div className="flex-1 min-w-0 flex items-center bg-[#2C2C2E] rounded-[14px] h-14 px-4 gap-2 border border-white/[0.06] focus-within:border-white/20 transition-colors">
                      <span className="text-[16px] text-[#98989D] shrink-0">¥</span>
                      <input key={`mv-amount-${txFormKey}`} type="text" inputMode="decimal"
                        value={mv.amount ? Number(mv.amount).toLocaleString() : ''}
                        onChange={e => { const v = e.target.value.replace(/,/g, ''); if (!isNaN(v)) setMv(p => ({ ...p, amount: v })); }}
                        className="flex-1 min-w-0 w-full bg-transparent text-[22px] font-semibold text-white outline-none tabular-nums" />
                    </div>
                    <button type="button" aria-label="計算機" onClick={() => openCalc(mv.amount, val => setMv(p => ({ ...p, amount: String(val) })))}
                      className="w-11 h-11 flex items-center justify-center text-[#98989D] active:text-white transition-colors shrink-0">
                      <Calculator size={20} />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-medium text-[#98989D] ml-1 block mb-1">日付</label>
                  <div className="relative h-11 bg-[#2C2C2E] border border-white/[0.06] rounded-[14px] overflow-hidden">
                    <div className="absolute inset-0 flex items-center px-4 pointer-events-none">
                      <span className="text-[16px] text-white">{mv.date ? mv.date.split('-').join('/') : '日付を選択'}</span>
                    </div>
                    <input type="date" value={mv.date} onChange={e => setMv(p => ({ ...p, date: e.target.value }))} className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-medium text-[#98989D] ml-1 block mb-1">メモ（任意）</label>
                  <input value={mv.memo} onChange={e => setMv(p => ({ ...p, memo: e.target.value }))}
                    placeholder="例: 10月用の現金"
                    className="w-full h-11 bg-[#2C2C2E] border border-white/[0.06] rounded-[14px] px-4 text-[16px] text-white outline-none placeholder-[#636366] focus:border-white/20 transition-colors" />
                </div>
              </form>
            ) : (
            <form id="tx-form" onSubmit={submitTx} className="space-y-4 w-full min-w-0">
              {/* 金額（主役） */}
              <div className="flex gap-1.5 items-center w-full min-w-0">
                <div className="flex-1 min-w-0 flex items-center bg-[#2C2C2E] rounded-[14px] h-16 px-4 gap-2 border border-white/[0.06] focus-within:border-white/20 transition-colors">
                  <span className="text-[20px] text-[#98989D] shrink-0">¥</span>
                  <input
                    key={`amount-${txFormKey}`}
                    type="text" inputMode="decimal" placeholder="0" aria-label="金額"
                    value={inAmount ? Number(inAmount).toLocaleString() : ''}
                    onChange={e => { const v = e.target.value.replace(/,/g, ''); if (!isNaN(v)) setInAmount(v); }}
                    className="flex-1 min-w-0 w-full bg-transparent text-[28px] font-semibold text-white outline-none tabular-nums placeholder-[#48484A]"
                    required
                  />
                </div>
                <button type="button" aria-label="計算機" onClick={() => openCalc(inAmount, val => setInAmount(String(val)))}
                  className="w-11 h-11 flex items-center justify-center text-[#98989D] active:text-white transition-colors shrink-0">
                  <Calculator size={20} />
                </button>
              </div>

              {/* 内容 ＋ よく使う・候補（テンプレートと入力履歴をひとつに） */}
              <div>
                <input
                  key={`title-${txFormKey}`}
                  value={inTitle}
                  onChange={e => setInTitle(e.target.value)}
                  placeholder="内容（例: スーパーでお買い物）" aria-label="内容"
                  className="w-full h-11 bg-[#2C2C2E] border border-white/[0.06] rounded-[14px] px-4 text-[16px] text-white outline-none placeholder-[#636366] focus:border-white/20 transition-colors"
                  required
                />
                {!editingTx && (() => {
                  const q = inTitle.trim().toLowerCase();
                  let chips;
                  if (!q) {
                    // 空のとき: テンプレート → よく使う内容（入力履歴の回数順）
                    const tplTitles = new Set(config.templates.map(t => t.title));
                    const frequent = [...titleIndex].filter(x => !tplTitles.has(x.title)).sort((a, b) => b.count - a.count).slice(0, Math.max(0, 8 - config.templates.length));
                    chips = [
                      ...config.templates.map(t => ({ key: `tpl_${t.title}`, title: t.title, amount: Number(t.amount) || 0, category: t.category, tpl: t })),
                      ...frequent.map(x => ({ key: `h_${x.title}`, ...x }))
                    ];
                  } else {
                    // 入力中: 前方一致 → よく使う順
                    chips = titleIndex
                      .filter(x => x.title.toLowerCase().includes(q) && x.title !== inTitle.trim())
                      .sort((a, b) => (b.title.toLowerCase().startsWith(q) - a.title.toLowerCase().startsWith(q)) || (b.count - a.count))
                      .slice(0, 6).map(x => ({ key: `h_${x.title}`, ...x }));
                  }
                  if (!chips.length) return null;
                  return (
                    <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-5 px-5 mt-2">
                      {chips.map(c => (
                        <button key={c.key} type="button"
                          onClick={() => {
                            if (c.tpl) return applyTpl(c.tpl);
                            setInTitle(c.title);
                            if (catNames.includes(c.category)) setInCat(c.category);
                            if (methods.includes(c.paymentMethod)) setInMethod(c.paymentMethod);
                            if (!inAmount) setInAmount(String(c.amount));
                          }}
                          className="shrink-0 h-11 px-3.5 rounded-[14px] bg-[#2C2C2E] flex flex-col justify-center text-left active:bg-[#3A3A3C] transition-colors">
                          <span className="text-[13px] text-white leading-tight whitespace-nowrap flex items-center gap-1">{c.tpl && <Zap size={11} className="text-[#0A84FF]" />}{c.title}</span>
                          <span className="text-[11px] text-[#636366] leading-tight whitespace-nowrap tabular-nums">¥{Number(c.amount || 0).toLocaleString()}</span>
                        </button>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* カテゴリ */}
              <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-5 px-5">
                {catNames.map(c => (
                  <button key={c} type="button" onClick={() => setInCat(c)}
                    className={`shrink-0 h-11 px-4 rounded-[14px] text-[13px] font-medium transition-colors ${inCat === c ? 'bg-[#0A84FF] text-white' : 'bg-[#2C2C2E] text-[#98989D] border border-white/[0.06]'}`}>
                    {c}
                  </button>
                ))}
              </div>

              {/* 日付・支払方法・充当元（ふだんは変えないので1行にまとめる） */}
              <div className="space-y-3">
                <button type="button" onClick={() => setDetailsOpen(v => !v)} aria-expanded={detailsOpen}
                  className="w-full h-11 px-4 flex items-center justify-between gap-3 bg-[#2C2C2E] border border-white/[0.06] rounded-[14px] text-left">
                  <span className="text-[14px] text-white truncate">
                    {inDate === getTodayString() ? '今日' : (inDate ? `${Number(inDate.slice(5, 7))}/${Number(inDate.slice(8, 10))}` : '日付未設定')}
                    <span className="text-[#636366]"> · </span>{inMethod}
                    <span className="text-[#636366]"> · </span>
                    {inSource === 'budget' ? '予算から'
                      : inSource === 'savings' ? `貯金${inSavingsBucket ? `（${inSavingsBucket}）` : ''}から`
                      : <span className="text-[#FF453A]">充当元が未設定</span>}
                  </span>
                  <ChevronDown size={14} className={`text-[#636366] shrink-0 transition-transform ${detailsOpen ? 'rotate-180' : ''}`} />
                </button>
                {detailsOpen && (
                  <>
                    <div>
                      <label className="text-[11px] font-medium text-[#98989D] ml-1 block mb-1">支払方法</label>
                      <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-5 px-5">
                        {methods.map(m => (
                          <button key={m} type="button" onClick={() => setInMethod(m)}
                            className={`shrink-0 h-11 px-4 rounded-[14px] text-[13px] font-medium transition-colors ${inMethod === m ? 'bg-[#0A84FF] text-white' : 'bg-[#2C2C2E] text-[#98989D] border border-white/[0.06]'}`}>
                            {m}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-[#98989D] ml-1 block mb-1">日付</label>
                      <div className="relative h-11 bg-[#2C2C2E] border border-white/[0.06] rounded-[14px] overflow-hidden">
                        <div className="absolute inset-0 flex items-center px-4 pointer-events-none">
                          <span className="text-[16px] text-white">{inDate ? inDate.split('-').join('/') : '日付を選択'}</span>
                        </div>
                        <input type="date" value={inDate} onChange={e => setInDate(e.target.value)} className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" required />
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-[#98989D] ml-1 block mb-1">充当元</label>
                      <div className="flex gap-2">
                        {SOURCES.map(({ value, label }) => (
                          <button key={value} type="button" onClick={() => setInSource(value)}
                            className={`flex-1 h-11 rounded-[14px] text-[13px] font-medium transition-colors ${inSource === value ? 'bg-[#0A84FF] text-white' : 'bg-[#2C2C2E] text-[#98989D] border border-white/[0.06]'}`}>
                            {label}
                          </button>
                        ))}
                      </div>
                      {inSource === 'savings' && bucketOptions.length > 0 && (
                        <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-5 px-5 mt-2">
                          {['', ...bucketOptions].map(name => (
                            <button key={name || '__none'} type="button" onClick={() => setInSavingsBucket(name)}
                              className={`shrink-0 h-11 px-3.5 rounded-[14px] text-[13px] font-medium transition-colors ${inSavingsBucket === name ? 'bg-[#4A7BA6] text-white' : 'bg-[#2C2C2E] text-[#98989D] border border-white/[0.06]'}`}>
                              {name || '指定なし'}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </form>
            )}
          </div>
          {/* 保存ボタンは画面下に固定（スクロールしなくても押せる） */}
          <div className="flex-none px-5 pt-3 pb-3 border-t border-white/[0.06] flex gap-2">
            {txMode === 'move' ? (
              <>
                {editingMove && <DangerIconButton onClick={deleteMove}><Trash2 size={17} /></DangerIconButton>}
                <PrimaryButton type="submit" form="mv-form" disabled={isSaving}>{isSaving ? '保存中...' : editingMove ? '保存する' : '記録する'}</PrimaryButton>
              </>
            ) : (
              <>
                {editingTx && <DangerIconButton onClick={() => deleteTx(editingTx)}><Trash2 size={17} /></DangerIconButton>}
                {editingTx && (
                  <button type="button" onClick={() => duplicateTx(editingTx)}
                    className="h-12 px-4 rounded-[14px] bg-[#2C2C2E] text-[14px] font-medium text-[#EBEBF5]/80 shrink-0 active:bg-[#3A3A3C] transition-colors">
                    複製
                  </button>
                )}
                <PrimaryButton type="submit" form="tx-form" disabled={isSaving}>{isSaving ? '保存中...' : editingTx ? '保存する' : '追加する'}</PrimaryButton>
              </>
            )}
          </div>
        </Modal>
      )}

      {/* 設定コピーモーダル */}
      {copyOpen && (
        <Modal onClose={() => setCopyOpen(false)}>
          <ModalHeader title="設定をコピー" onClose={() => setCopyOpen(false)} />
          <div className="px-5 pt-4 pb-8 space-y-3.5">
            <div>
              <label className="text-[11px] font-medium text-[#98989D] ml-1 block mb-1">コピー元の月</label>
              <div className="relative w-full h-11 bg-[#2C2C2E] border border-white/[0.06] rounded-[14px] overflow-hidden">
                <div className="absolute inset-0 flex items-center px-4 pointer-events-none">
                  <span className="text-[16px] text-white">{copyFrom ? formatMonthJP(copyFrom) : '月を選択'}</span>
                </div>
                <input type="month" value={copyFrom} onChange={e => setCopyFrom(e.target.value)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <SecondaryButton onClick={() => setCopyOpen(false)}>キャンセル</SecondaryButton>
              <PrimaryButton onClick={copySetting}>実行する</PrimaryButton>
            </div>
          </div>
        </Modal>
      )}

      {/* 設定編集モーダル */}
      {editingItem && (() => {
        const TYPE_LABELS = {
          salary: '手取り給与', cashBudget: '月初のスタート現金', cashTopup: 'ATMでおろした現金', memo: '今月のメモ', account: '口座', accountBalance: '月初残高', methodAccount: '引落口座', accountRole: '口座の役割', transfer: '毎月の振替',
          bill: '引落予定', savingsBucket: '先取り項目', category: 'カテゴリ',
          template: 'テンプレート', recurring: '定期支出', payment: '支払方法'
        };
        const isNew = editingItem.index === -1;
        const name = TYPE_LABELS[editingItem.type] || '項目';
        return (
        <Modal onClose={() => setEditingItem(null)} zIndex="z-[70]">
          <ModalHeader title={isNew ? `${name}を追加` : name} onClose={() => setEditingItem(null)} />
          <div className="flex-1 overflow-y-auto overflow-x-hidden px-5 pt-4 pb-8 space-y-3.5">
            {['salary', 'cashBudget', 'cashTopup'].includes(editingItem.type) && <EditFormSalaryLike editingItem={editingItem} setEditingItem={setEditingItem} openCalculator={openCalc} />}
            {editingItem.type === 'memo' && <EditFormMemo editingItem={editingItem} setEditingItem={setEditingItem} />}
            {editingItem.type === 'bill' && <EditFormBill editingItem={editingItem} setEditingItem={setEditingItem} openCalculator={openCalc} />}
            {editingItem.type === 'savingsBucket' && <EditFormSavingsBucket editingItem={editingItem} setEditingItem={setEditingItem} openCalculator={openCalc} />}
            {editingItem.type === 'category' && <EditFormCategory editingItem={editingItem} setEditingItem={setEditingItem} openCalculator={openCalc} />}
            {editingItem.type === 'template' && <EditFormTemplate editingItem={editingItem} setEditingItem={setEditingItem} openCalculator={openCalc} categoryNames={catNames} paymentMethods={config.paymentMethods} />}
            {editingItem.type === 'recurring' && <EditFormRecurring editingItem={editingItem} setEditingItem={setEditingItem} openCalculator={openCalc} categoryNames={catNames} paymentMethods={config.paymentMethods} />}
            {editingItem.type === 'transfer' && <EditFormTransfer editingItem={editingItem} setEditingItem={setEditingItem} accounts={config.accounts || []} openCalculator={openCalc} />}
            {editingItem.type === 'account' && <EditFormAccount editingItem={editingItem} setEditingItem={setEditingItem} openCalculator={openCalc} />}
            {['methodAccount', 'accountRole'].includes(editingItem.type) && (
              <EditFormAccountPicker editingItem={editingItem} setEditingItem={setEditingItem} accounts={config.accounts || []} showTiming={editingItem.type === 'methodAccount'}
                note={editingItem.type === 'methodAccount' ? 'この支払方法の引落が、選んだ口座から出ていくものとして計算します' : undefined} />
            )}
            {editingItem.type === 'payment' && <EditFormPayment editingItem={editingItem} setEditingItem={setEditingItem} />}
            <div className="flex gap-2 pt-2">
              {!isNew && !['salary', 'cashBudget', 'bill', 'memo', 'accountBalance', 'methodAccount', 'accountRole'].includes(editingItem.type) && (
                <DangerIconButton onClick={deleteItem}><Trash2 size={17} /></DangerIconButton>
              )}
              <PrimaryButton onClick={saveSettings} disabled={isSaving}>{isSaving ? '保存中...' : isNew ? '追加する' : '保存する'}</PrimaryButton>
            </div>
          </div>
        </Modal>
        );
      })()}
    </div>
  );
}

export default function AppWrapper() {
  return <ErrorBoundary><AppMain /></ErrorBoundary>;
}
