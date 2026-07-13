import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import {
  getFirestore, collection, doc, setDoc, onSnapshot, query, deleteDoc,
  where, getDocs, getDoc, orderBy, addDoc, updateDoc, serverTimestamp, documentId, arrayUnion
} from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth';
import {
  Wallet, CreditCard, Landmark, Plus, Settings, Trash2, History,
  ChevronLeft, ChevronRight, X, Tags, ArrowLeft, CopyCheck, Calendar,
  BarChart3, TrendingDown, TrendingUp, Search, CalendarDays, AlignJustify,
  Zap, Calculator, LogOut, Lock, User, FileText, Home, ChevronDown,
  HelpCircle, Pencil, ChevronUp, PiggyBank, Repeat
} from 'lucide-react';
import {
  ErrorBoundary, Card, Label, Row, Separator, NavButton, Toast, OfflineBanner,
  SettingsRow, CalculatorPad, useConfirm, toNumber,
  PrimaryButton, SecondaryButton, DangerIconButton,
  EditFormSalaryLike, EditFormMemo, EditFormBill, EditFormSavingsBucket,
  EditFormCategory, EditFormTemplate, EditFormPayment, EditFormRecurring
} from './components.jsx';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_GOOGLE_API_KEY,
  authDomain: 'zaimu-4f79b.firebaseapp.com',
  projectId: 'zaimu-4f79b',
  storageBucket: 'zaimu-4f79b.firebasestorage.app',
  messagingSenderId: '388166181792',
  appId: '1:388166181792:web:d3ccef2742dca358d3bac5'
};
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);
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
const getSpendType = t => t?.fromSavings ? 'savings' : t?.isSpecial ? 'special' : 'normal';

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
    skippedRecurring: d.skippedRecurring || []
  };
};
const normalizeConfig = data => ({
  categories: data?.categories || [{ name: '食費' }],
  paymentMethods: data?.paymentMethods || [CASH],
  templates: data?.templates || [],
  recurring: data?.recurring || []
});

const GRAYS = ['#F4F4F5', '#D4D4D8', '#A1A1AA', '#71717A', '#52525B', '#3F3F46', '#27272A'];
const catColor = i => GRAYS[i % GRAYS.length];

/* ── Modal類はAppMainの外に定義（再マウント防止） ── */
const Modal = ({ children, onClose, zIndex = 'z-[65]' }) => (
  <div
    className={`fixed inset-0 ${zIndex} flex items-end sm:items-center justify-center sm:p-4 bg-black/50 backdrop-blur-sm`}
    onClick={onClose}
  >
    <div
      className="w-full sm:max-w-md bg-[#1C1C1E]/80 backdrop-blur-2xl backdrop-saturate-150 rounded-t-3xl sm:rounded-3xl border border-white/[0.12] shadow-2xl flex flex-col overflow-hidden overflow-x-hidden max-h-[92vh]"
      onClick={e => e.stopPropagation()}
    >
      {children}
    </div>
  </div>
);

const ModalHeader = ({ title, onClose }) => (
  <div className="flex-none px-5 py-4 flex items-center justify-between border-b border-white/[0.06]">
    <span className="text-[16px] font-semibold text-white">{title}</span>
    <button
      onClick={onClose}
      className="w-8 h-8 flex items-center justify-center rounded-full bg-[#2C2C2E] text-[#8E8E93]"
    >
      <X size={15} />
    </button>
  </div>
);

const AddButton = ({ label, onClick }) => (
  <button
    onClick={onClick}
    className="w-full h-11 bg-[#1C1C1E] border border-white/[0.06] text-[#8E8E93] rounded-[14px] text-[13px] font-medium flex items-center justify-center gap-2 mb-3 active:bg-white/[0.04] transition-colors"
  >
    <Plus size={14} /> {label}
  </button>
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
  const [viewingTx, setViewingTx] = useState(null);
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
  const [inSpendType, setInSpendType] = useState('normal');
  const [inSavingsBucket, setInSavingsBucket] = useState('');
  const [txFormKey, setTxFormKey] = useState(0);

  const [editingTx, setEditingTx] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [expandedFaq, setExpandedFaq] = useState(null);
  const [faqQ, setFaqQ] = useState('');
  const [savingsExpanded, setSavingsExpanded] = useState(false);

  const [txList, setTxList] = useState([]);
  const [txLoadedMonth, setTxLoadedMonth] = useState(null);
  const recProcessedRef = useRef(new Set());
  const [prevTxList, setPrevTxList] = useState([]);
  const prevFetchRef = useRef(null);
  const [monthly, setMonthly] = useState(normalizeMonthly({}));
  const [mLoadedMonth, setMLoadedMonth] = useState(null);
  const [config, setConfig] = useState(normalizeConfig({}));
  const [savingsTotal, setSavingsTotal] = useState(0);
  const [savingsWithdrawn, setSavingsWithdrawn] = useState(0);
  const [withdrawnByBucket, setWithdrawnByBucket] = useState({});
  const [savingsBreakdown, setSavingsBreakdown] = useState({});
  const [cumSavingsExpanded, setCumSavingsExpanded] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [filter, setFilter] = useState({ cat: 'ALL', method: 'ALL', spendType: 'ALL' });
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyFrom, setCopyFrom] = useState('');
  const [memoText, setMemoText] = useState('');
  const [memoExpanded, setMemoExpanded] = useState(false);

  const mn = month ? Number(month.split('-')[1]) : new Date().getMonth() + 1;
  const nextMn = mn === 12 ? 1 : mn + 1;
  const catNames = useMemo(() => (config?.categories || []).map(c => c.name), [config?.categories]);
  const methods = useMemo(() => config?.paymentMethods?.length ? config.paymentMethods : [CASH], [config?.paymentMethods]);
  const buckets = useMemo(() => getSavingsBuckets(monthly), [monthly]);
  // 貯金取り崩し時に選べるバケット候補（積立実績のある名前 + 今月の設定名）
  const bucketOptions = useMemo(() => {
    const set = new Set([...Object.keys(savingsBreakdown), ...buckets.map(b => b.name)]);
    return [...set].filter(Boolean);
  }, [savingsBreakdown, buckets]);

  const FAQ = useMemo(() => [
    { category: '設定タブの金額', items: [
      { q: '手取り給与', a: `家計のベース収入です。${mn}月の今月の予算・${nextMn}月の着地予想の起点になります。` },
      { q: '月初のスタート現金', a: '毎月1日時点の現金実数です。現金残高の計算元になり、今月の予算（カード）からも差し引かれます。ATMで追加でおろした場合はこの金額に足して更新してください。' },
      { q: '先取り設定', a: '毎月最初に避けておくお金です。先取り後の残り・今月の予算の計算に使われます。' },
      { q: '定期支出', a: '家賃やサブスクなど毎月決まった支出です。指定日に自動でログに記録され、未記録の分は「固定費予定」として実質あと使える額から差し引かれます。' },
      { q: 'カテゴリ予算', a: '使いすぎ防止枠です。分析タブの比較に使われます。' }
    ]},
    { category: 'ホーム画面の見方', items: [
      { q: '実質あと使える（カード）', a: '残り全体から、まだ記録されていない固定費（定期支出）の予定額を差し引いた、本当に自由に使える金額です。', formula: '今月の予算（カード） − カード支出 − 固定費予定' },
      { q: '先取り後の残り', a: '手取りから先取りを引いた金額です。', formula: '手取り給与 − 先取り合計' },
      { q: '今月の予算（カード）', a: '先取り後の残りから月初のスタート現金を引いた、カードで使える予算の上限です。固定費もこの中から実支出として記録されます。', formula: '先取り後の残り − 月初のスタート現金' },
      { q: '固定費予定とは？', a: '定期支出のうち、今月まだ記録されていないものの合計です。記録された時点で予定から実績（カード支出）へ自動的に移ります。' },
      { q: '現金残高', a: '月初のスタート現金から今月の現金支出を引いた残高です。', formula: '月初のスタート現金 − 現金支出' },
      { q: '先取り累計', a: 'これまで積み上げた先取りの累計額から、貯金からの支払いを差し引いた現在高です。', formula: '先取りの積立合計 − 貯金からの支払い合計' },
      { q: `${nextMn}月の着地予想`, a: `カードをこれ以上使わなかった場合に月末残る金額のシミュレーションです。実質あと使える額と現金残高の合計です。`, formula: '実質あと使える（カード） + 現金残高' },
      { q: '今日までの目安とは？', a: '自由に使える枠（予算から定期支出の総額を除いた分）を月の日数で均等に使った場合、今日までに使っていてよい金額です。進捗バーの小さな縦線はこの位置を示します。', formula: '（今月の予算 − 定期支出の総額） × 経過日数 ÷ 月の日数' }
    ]},
    { category: '支出の種別', items: [
      { q: '通常と特別費の違いは？', a: '通常は今月の可変費に含まれる支出です。特別費は冠婚葬祭など臨時の支出で、可変費とは別枠で集計されます。' },
      { q: '「貯金から」とは？', a: '積み立てた貯金を取り崩して支払う支出です。今月の可変費や進捗には影響せず、先取り累計から差し引かれます。どの先取り項目から出すか指定でき、ホームの先取り累計をタップすると項目別の残高を確認できます。' }
    ]},
    { category: '操作', items: [
      { q: '定期支出とは？', a: 'サブスクや家賃など毎月決まった支出を登録しておくと、指定日を迎えたタイミングで自動的にログへ記録されます。記録された支出は「定期」バッジ付きで表示され、通常の支出と同じように編集・削除できます。' },
      { q: '定期支出を今月だけ止めたい', a: '自動記録されたログを削除すると、その定期支出は今月分だけスキップされます。来月からは通常どおり自動記録が再開されます。' },
      { q: '来月の設定はどうすればいいですか？', a: '設定タブの「先月の設定をコピー」で引き継げます。' },
      { q: 'データのバックアップはできますか？', a: '設定タブのCSVを書き出すから全取引データをダウンロードできます。' }
    ]}
  ], [mn, nextMn]);

  const filteredFaq = useMemo(() => {
    if (!faqQ) return FAQ;
    const q = faqQ.toLowerCase();
    return FAQ.map(s => ({ ...s, items: s.items.filter(i => i.q.toLowerCase().includes(q) || i.a.toLowerCase().includes(q) || (i.formula || '').toLowerCase().includes(q)) })).filter(s => s.items.length);
  }, [faqQ, FAQ]);

  const showToast = msg => { setToast({ visible: true, message: msg }); setTimeout(() => setToast({ visible: false, message: '' }), 2500); };
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
      s => { setMonthly(normalizeMonthly(s.exists() ? s.data() : {})); if (!s.metadata.fromCache) setMLoadedMonth(fm); }, console.error);
  }, [month, user]);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(doc(db, 'users', user.uid, 'settings', 'config'),
      s => setConfig(normalizeConfig(s.exists() ? s.data() : {})), console.error);
  }, [user]);

  /* 先取り累計（積立合計） */
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getDocs(query(collection(db, 'users', user.uid, 'months'), where(documentId(), '<=', month), orderBy(documentId(), 'asc')))
      .then(s => {
        if (cancelled) return;
        let total = 0; const bd = {};
        s.forEach(d => {
          const md = normalizeMonthly(d.data()); total += getSavingsTotal(md);
          getSavingsBuckets(md).forEach(b => { const n = b.name || '未設定'; bd[n] = (bd[n] || 0) + (Number(b.amount) || 0); });
        });
        setSavingsTotal(total); setSavingsBreakdown(bd);
      }).catch(console.error);
    return () => { cancelled = true; };
  }, [user, month, monthly.savingsBuckets, monthly.savings]);

  /* 貯金取り崩し累計（表示中の月末までの fromSavings 支出合計） */
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const end = new Date(`${month}-01T00:00:00Z`); end.setUTCMonth(end.getUTCMonth() + 1);
    const endIso = end.toISOString();
    getDocs(query(collection(db, 'users', user.uid, 'transactions'), where('fromSavings', '==', true)))
      .then(s => {
        if (cancelled) return;
        let total = 0; const byBucket = {};
        s.docs.map(d => d.data()).filter(t => t.date && t.date < endIso).forEach(t => {
          const amt = Number(t.amount) || 0;
          total += amt;
          const b = t.savingsBucket || '指定なし';
          byBucket[b] = (byBucket[b] || 0) + amt;
        });
        setSavingsWithdrawn(total);
        setWithdrawnByBucket(byBucket);
      }).catch(console.error);
    return () => { cancelled = true; };
  }, [user, month, txList]);

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
      const recDay = Math.min(Number(r.day) || 1, lastDay);
      if (recDay > todayD) return;
      const key = `${month}_${r.id}`;
      if (recProcessedRef.current.has(key)) return;
      if (txList.some(t => t.recurringId === r.id)) return;
      recProcessedRef.current.add(key);
      const dateStr = `${month}-${String(recDay).padStart(2, '0')}`;
      addDoc(collection(db, 'users', user.uid, 'transactions'), {
        date: toISODateSafe(dateStr), amount: Number(r.amount) || 0, title: r.title,
        category: r.category || catNames[0] || '食費', paymentMethod: r.method || CASH,
        isSpecial: false, fromSavings: false, recurringId: r.id,
        createdAt: serverTimestamp(), updatedAt: serverTimestamp()
      }).then(() => showToast(`定期支出「${r.title}」を記録しました`)).catch(console.error);
    });
  }, [user, txLoadedMonth, mLoadedMonth, txList, config.recurring, month, monthly.skippedRecurring]);

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
          if (getSpendType(t) !== 'normal') return;
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
    const norm = txList.filter(t => getSpendType(t) === 'normal');
    const normPrev = prevTxList.filter(t => getSpendType(t) === 'normal');
    const spCard = norm.filter(t => t.paymentMethod !== CASH).reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const spCash = norm.filter(t => t.paymentMethod === CASH).reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const spent = norm.reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const savTotal = getSavingsTotal(monthly);
    const lifeBudget = salary - savTotal;
    // 今月の予算 = 手取り − 先取り − スタート現金（固定費は実支出として計上）
    const varBudget = lifeBudget - cashBudget;
    const varRemain = varBudget - spCard;
    // 定期支出（固定費）: カード払いのみ予算計算の対象（現金払いは現金残高の軸で管理）
    const recCard = (config?.recurring || []).filter(r => (r.method || CASH) !== CASH);
    const recTotalAll = recCard.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const recordedIds = new Set(norm.filter(t => t.recurringId).map(t => t.recurringId));
    const pendingFixed = recCard.filter(r => !recordedIds.has(r.id)).reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const recRecorded = norm.filter(t => t.recurringId && t.paymentMethod !== CASH).reduce((s, t) => s + (Number(t.amount) || 0), 0);
    // 実質自由 = 残り全体 − 固定費予定
    const freeBudget = varBudget - recTotalAll;
    const freeSpent = spCard - recRecorded;
    const freeRemain = varRemain - pendingFixed;
    const cashRemain = cashBudget - spCash;
    const cats = norm.reduce((a, t) => { const c = t.category || '未分類'; a[c] = (a[c] || 0) + (Number(t.amount) || 0); return a; }, {});
    const catBudSum = (config?.categories || []).reduce((s, c) => s + (monthly?.catBudgets?.[c.name] || 0), 0);
    const spSpecial = txList.filter(t => getSpendType(t) === 'special').reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const spSpecialPrev = prevTxList.filter(t => getSpendType(t) === 'special').reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const spSavings = txList.filter(t => getSpendType(t) === 'savings').reduce((s, t) => s + (Number(t.amount) || 0), 0);
    return {
      cashBudget,
      cashRemain, projCash: freeRemain + cashRemain,
      catBudSum, savTotal, lifeBudget, varBudget, varRemain,
      pendingFixed, recTotalAll, recRecorded, freeBudget, freeSpent, freeRemain,
      cats, spent, prevSpent: normPrev.reduce((s, t) => s + (Number(t.amount) || 0), 0),
      spCard, spCash,
      daily: norm.reduce((a, t) => { if (!t.date) return a; const d = new Date(t.date); if (isNaN(d)) return a; a[d.getUTCDate()] = (a[d.getUTCDate()] || 0) + (Number(t.amount) || 0); return a; }, {}),
      spSpecial, spSpecialPrev, spSavings
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

  const filteredTx = useMemo(() => txList.filter(t => {
    const ms = searchText === '' || String(t.title || '').includes(searchText);
    const mc = filter.cat === 'ALL' || t.category === filter.cat;
    const mm = filter.method === 'ALL' || t.paymentMethod === filter.method;
    const msp = filter.spendType === 'ALL' || getSpendType(t) === filter.spendType;
    return ms && mc && mm && msp;
  }), [txList, searchText, filter]);

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
    setInSpendType('normal');
    setInSavingsBucket('');
    setTxFormKey(k => k + 1);
  }, [catNames, methods]);

  const startEdit = t => {
    setEditingTx(t);
    setInDate(isoToLocalYMD(t.date));
    setInAmount(String(t.amount ?? ''));
    setInTitle(t.title || '');
    setInCat(t.category || catNames[0] || '食費');
    setInMethod(t.paymentMethod || CASH);
    setInSpendType(getSpendType(t));
    setInSavingsBucket(t.savingsBucket || '');
    setTxFormKey(k => k + 1);
    setIsTxOpen(true);
  };

  const openNew = () => { setEditingTx(null); resetInputs(); setIsTxOpen(true); };
  const openWithDate = d => { setEditingTx(null); resetInputs(d); setIsTxOpen(true); };
  const closeTx = useCallback(() => { setIsTxOpen(false); setEditingTx(null); }, []);
  const applyTpl = t => { setInAmount(String(t.amount)); setInTitle(t.title); setInCat(t.category); setInMethod(t.method); };

  const submitTx = async e => {
    e.preventDefault(); if (!user) return;
    const amount = toNumber(inAmount);
    if (!inDate || !amount || !inTitle) return showToast('入力内容を確認してください');
    const payload = {
      date: toISODateSafe(inDate), amount, title: inTitle, category: inCat, paymentMethod: inMethod,
      isSpecial: inSpendType === 'special',
      fromSavings: inSpendType === 'savings',
      savingsBucket: inSpendType === 'savings' ? (inSavingsBucket || null) : null,
      updatedAt: serverTimestamp()
    };
    try {
      if (editingTx?.id) { await updateDoc(doc(db, 'users', user.uid, 'transactions', editingTx.id), payload); showToast('更新しました'); }
      else { await addDoc(collection(db, 'users', user.uid, 'transactions'), { ...payload, createdAt: serverTimestamp() }); showToast('追加しました'); }
      closeTx();
    } catch (e) { console.error(e); showToast('エラー'); }
  };

  const openEdit = (type, data, index) => setEditingItem({ type, data: { ...data }, index });

  const saveSettings = async () => {
    if (!user || !editingItem) return;
    const { type, data, index } = editingItem;
    try {
      const mRef = doc(db, 'users', user.uid, 'months', month);
      const cRef = doc(db, 'users', user.uid, 'settings', 'config');
      if (['salary', 'cashBudget'].includes(type)) {
        const fm = { salary: 'salary', cashBudget: 'cashBudget' };
        await setDoc(mRef, { [fm[type]]: toNumber(data.value) }, { merge: true });
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
        const item = { ...data, amount: toNumber(data.amount), day: Math.min(31, Math.max(1, toNumber(data.day) || 1)), id: data.id || `rec_${Date.now()}` };
        if (index === -1) list.unshift(item); else list[index] = item;
        await setDoc(cRef, { ...config, recurring: list }, { merge: true });
      } else if (type === 'payment') {
        const list = [...(config.paymentMethods || [CASH])];
        if (index === -1) list.unshift(data.name); else list[index] = data.name;
        await setDoc(cRef, { ...config, paymentMethods: list }, { merge: true });
      }
      setEditingItem(null); showToast('保存しました');
    } catch (e) { console.error(e); showToast('エラー'); }
  };

  const deleteItem = async () => {
    if (!editingItem) return;
    const ok = await confirm({ title: '削除しますか？', message: 'この操作は取り消せません。', confirmLabel: '削除する', danger: true });
    if (!ok) return;
    const { type, index, data } = editingItem;
    const mRef = doc(db, 'users', user.uid, 'months', month);
    const cRef = doc(db, 'users', user.uid, 'settings', 'config');
    try {
      if (type === 'category') await setDoc(cRef, { ...config, categories: (config.categories || []).filter((_, i) => i !== index) }, { merge: true });
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
          fixedCosts: d.fixedCosts || [], catBudgets: d.catBudgets || {}, cardBills: d.cardBills || {},
          cardDueDates: d.cardDueDates || {}, savings: d.savings || 0, savingsBuckets: d.savingsBuckets || []
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
    const pending = recCard.filter(r => r.id && r.title && !recordedIds.has(r.id));
    if (!pending.length) return showToast('未記録の定期支出はありません');
    const total = pending.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const ok = await confirm({ title: `${pending.length}件の定期支出を記録しますか？`, message: `${formatMonthJP(month)} のログに合計 ¥${total.toLocaleString()} を追加します。`, confirmLabel: '記録する' });
    if (!ok) return;
    const [y, m] = month.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    try {
      await Promise.all(pending.map(r => {
        const recDay = Math.min(Number(r.day) || 1, lastDay);
        const dateStr = `${month}-${String(recDay).padStart(2, '0')}`;
        return addDoc(collection(db, 'users', user.uid, 'transactions'), {
          date: toISODateSafe(dateStr), amount: Number(r.amount) || 0, title: r.title,
          category: r.category || catNames[0] || '食費', paymentMethod: r.method || CASH,
          isSpecial: false, fromSavings: false, recurringId: r.id,
          createdAt: serverTimestamp(), updatedAt: serverTimestamp()
        });
      }));
      showToast(`${pending.length}件を記録しました`);
    } catch (e) { console.error(e); showToast('エラー'); }
  };

  const exportCSV = async () => {
    const ok = await confirm({ title: 'CSV出力しますか？', confirmLabel: 'ダウンロード' });
    if (!ok) return;
    const s = await getDocs(query(collection(db, 'users', user.uid, 'transactions'), orderBy('date', 'desc')));
    let csv = '\uFEFF日付,タイトル,カテゴリ,金額,支払方法,種別\n';
    s.forEach(d => {
      const v = d.data();
      const typeLabel = v.fromSavings ? '貯金から' : v.isSpecial ? '特別費' : '通常';
      csv += `${isoToLocalYMD(v.date)},"${v.title}",${v.category},${v.amount},${v.paymentMethod},${typeLabel}\n`;
    });
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a'); a.href = url; a.download = `zaimu_${getTodayString()}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  if (authLoading) return <div className="h-screen bg-black flex items-center justify-center text-[#8E8E93] text-[14px]">読み込み中...</div>;

  if (!user) return (
    <div className="h-screen w-full bg-black flex flex-col items-center justify-center p-8 gap-10">
      <h1 className="text-[32px] font-semibold tracking-tight text-white">ZAIMU</h1>
      <PrimaryButton onClick={() => signInWithPopup(auth, new GoogleAuthProvider())}>
        <Lock size={15} /> Googleでログイン
      </PrimaryButton>
    </div>
  );

  const MENU = [
    { id: 'budget', label: '資金計画', icon: <Landmark size={17} /> },
    { id: 'category', label: 'カテゴリ予算', icon: <Tags size={17} /> },
    { id: 'template', label: 'テンプレート', icon: <Zap size={17} /> },
    { id: 'recurring', label: '定期支出', icon: <Repeat size={17} /> },
    { id: 'payment', label: '支払方法', icon: <Wallet size={17} /> },
    { id: 'faq', label: 'ヘルプ・FAQ', icon: <HelpCircle size={17} /> },
  ];
  const menuTitle = MENU.find(m => m.id === settingTab)?.label || '設定';
  const today = getTodayLocal();
  const savingsBalance = savingsTotal - savingsWithdrawn;

  // 理想ペース（自由に使える枠を日割り）
  const curMonthStr = getMonthString(new Date());
  const isCurrentMonth = month === curMonthStr;
  const daysInViewMonth = (() => { const [y, m] = month.split('-').map(Number); return new Date(y, m, 0).getDate(); })();
  const idealPct = isCurrentMonth ? Math.min(100, (today.d / daysInViewMonth) * 100) : (month < curMonthStr ? 100 : 0);
  const idealSpend = Math.round(S.freeBudget * idealPct / 100);
  const paceDiff = S.freeSpent - idealSpend;
  const showPaceMarker = isCurrentMonth && idealPct > 2 && idealPct < 98;

  const SPEND_TYPES = [
    { value: 'normal', label: '通常' },
    { value: 'special', label: '特別費' },
    { value: 'savings', label: '貯金から' },
  ];

  return (
    <div className="fixed inset-0 w-full bg-black text-white font-sans flex flex-col overflow-hidden">
      {confirmDialog}
      <Toast message={toast.message} isVisible={toast.visible} />
      <OfflineBanner isOffline={isOffline} />

      <div className="w-full max-w-md h-full flex flex-col bg-black mx-auto relative">

        {/* HEADER */}
        <header className="flex-none h-14 px-4 flex items-center justify-between bg-black/60 backdrop-blur-2xl backdrop-saturate-150 border-b border-white/[0.08] z-50">
          {activeTab === 'settings' && settingTab !== 'menu' ? (
            <>
              <button onClick={() => setSettingTab('menu')} className="p-2 text-[#8E8E93]"><ArrowLeft size={18} /></button>
              <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center">
                <span className="text-[14px] font-semibold text-white">{menuTitle}</span>
                {settingTab === 'category' && (
                  <span className="text-[11px] text-[#8E8E93]">¥{S.catBudSum.toLocaleString()}</span>
                )}
              </div>
              <div className="w-10" />
            </>
          ) : (
            <>
              <div className="w-8" />
              <div className="flex items-center gap-0.5">
                <button onClick={() => { const d = new Date(month + '-01T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() - 1); setMonth(getMonthString(d)); }} className="p-2 text-[#8E8E93]"><ChevronLeft size={16} /></button>
                <span className="text-[14px] font-semibold text-white min-w-[96px] text-center tabular-nums">{formatMonthJP(month)}</span>
                <button onClick={() => { const d = new Date(month + '-01T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() + 1); setMonth(getMonthString(d)); }} className="p-2 text-[#8E8E93]"><ChevronRight size={16} /></button>
              </div>
              <button onClick={() => setMonth(getMonthString(new Date()))} className="p-2 text-[#8E8E93]"><Calendar size={16} /></button>
            </>
          )}
        </header>

        <main className="flex-1 flex flex-col overflow-hidden">

          {/* HOME */}
          {activeTab === 'home' && (
            <div className="flex-1 overflow-y-auto scrollbar-hide pb-32">
              {monthly.memo && (
                <button onClick={() => setMemoExpanded(!memoExpanded)} className="w-full px-4 py-3 flex items-start gap-3 text-left border-b border-white/[0.06] bg-[#1C1C1E]/60">
                  <span className="text-[13px] mt-0.5 shrink-0">📌</span>
                  <span className={`flex-1 text-[12px] text-[#8E8E93] leading-relaxed ${memoExpanded ? 'whitespace-pre-wrap' : 'truncate'}`}>{monthly.memo}</span>
                  <ChevronDown size={13} className={`text-[#48484A] shrink-0 mt-0.5 transition-transform ${memoExpanded ? 'rotate-180' : ''}`} />
                </button>
              )}
              <div className="px-4 pt-6 space-y-7">
                <div>
                  <Label>今月</Label>
                  <Card>
                    <div className="px-5 pt-6 pb-5 border-b border-white/[0.06]">
                      <p className="text-[11px] text-[#8E8E93] mb-1">実質あと使える（カード）</p>
                      <p className={`text-[36px] font-semibold tracking-tight leading-none mt-1.5 ${S.freeRemain < 0 ? 'text-[#FF453A]' : 'text-white'}`}>
                        ¥{S.freeRemain.toLocaleString()}
                      </p>
                      <p className="mt-2.5 text-[11px] text-[#48484A] tabular-nums">
                        予算 ¥{S.varBudget.toLocaleString()} − 使用 ¥{S.spCard.toLocaleString()} − 固定費予定 ¥{S.pendingFixed.toLocaleString()}
                      </p>
                      {isCurrentMonth && S.freeBudget > 0 && (
                        <div className="flex items-center justify-between mt-3.5 pt-3 border-t border-white/[0.06]">
                          <span className="text-[11px] text-[#8E8E93]">今日までの目安 ¥{idealSpend.toLocaleString()}<span className="text-[#48484A] ml-1">（自由に使った分 ¥{S.freeSpent.toLocaleString()}）</span></span>
                          <span className={`text-[11px] font-medium tabular-nums shrink-0 ${paceDiff <= 0 ? 'text-[#30D158]' : 'text-[#FF453A]'}`}>
                            {paceDiff <= 0 ? `−¥${Math.abs(paceDiff).toLocaleString()}` : `+¥${paceDiff.toLocaleString()}`}
                          </span>
                        </div>
                      )}
                    </div>

                    <Row label="手取り給与" value={`¥${Number(monthly.salary || 0).toLocaleString()}`} />
                    <div className="border-b border-white/[0.04]" />

                    <button
                      type="button"
                      onClick={() => setSavingsExpanded(v => !v)}
                      className="w-full flex items-center justify-between px-4 py-3.5 gap-4 active:bg-white/[0.03] transition-colors"
                    >
                      <span className="text-[14px] text-[#636366]">先取り合計</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[#636366] text-[13px] tabular-nums">−¥{S.savTotal.toLocaleString()}</span>
                        {buckets.length > 0 && (
                          savingsExpanded
                            ? <ChevronUp size={13} className="text-[#48484A]" />
                            : <ChevronDown size={13} className="text-[#48484A]" />
                        )}
                      </div>
                    </button>

                    {savingsExpanded && buckets.length > 0 && (
                      <div className="px-4 pb-3 space-y-2">
                        {buckets.map(b => (
                          <div key={b.id} className="flex items-center justify-between pl-3">
                            <span className="text-[12px] text-[#48484A]">{b.name}</span>
                            <span className="text-[12px] text-[#636366] tabular-nums">¥{Number(b.amount || 0).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <Separator />
                    <Row label="先取り後の残り" value={`¥${S.lifeBudget.toLocaleString()}`} muted />
                    <div className="border-b border-white/[0.04]" />
                    <Row label="月初のスタート現金" value={`−¥${S.cashBudget.toLocaleString()}`} muted />
                    <Separator />
                    <Row label="今月の予算（カード）" value={`¥${S.varBudget.toLocaleString()}`} accent />
                  </Card>
                </div>

                <div>
                  <Label>進捗</Label>
                  <Card>
                    <div className="px-5 py-5 space-y-4 border-b border-white/[0.06]">
                      {[
                        { label: '実質自由（カード）', spent: S.spCard + S.pendingFixed, remain: S.freeRemain, target: S.varBudget, pace: S.varBudget > 0 ? Math.min(100, ((S.spCard + S.pendingFixed) / S.varBudget) * 100) : 0, over: S.freeRemain < 0, noTarget: false },
                      ].map(({ label, spent, remain, target, pace, over, noTarget }) => (
                        <div key={label}>
                          <div className="flex justify-between items-center mb-1.5 gap-3">
                            <span className="text-[11px] text-[#8E8E93] truncate">{label}</span>
                            <span className="text-[11px] text-[#8E8E93] tabular-nums shrink-0 whitespace-nowrap">
                              {noTarget ? '未設定' : `¥${remain.toLocaleString()} / ¥${target.toLocaleString()}`}
                            </span>
                          </div>
                          <div className="relative">
                            <div className="h-1 bg-white/[0.08] rounded-full overflow-hidden">
                              <div className={`h-full rounded-full transition-all duration-700 ${over ? 'bg-[#FF453A]' : 'bg-white/60'}`} style={{ width: `${pace}%` }} />
                            </div>
                            {showPaceMarker && !noTarget && (
                              <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-[2px] h-2.5 bg-white/50 rounded-full" style={{ left: `${idealPct}%` }} />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    <Row label="現金残高" value={`¥${S.cashRemain.toLocaleString()}`} danger={S.cashRemain < 0} />
                    <div className="border-b border-white/[0.04]" />
                    <Row label={`${nextMn}月の着地予想`} value={`¥${S.projCash.toLocaleString()}`} />
                    <div className="border-b border-white/[0.04]" />
                    <button
                      type="button"
                      onClick={() => setCumSavingsExpanded(v => !v)}
                      className="w-full flex items-center justify-between px-4 py-3.5 gap-4 active:bg-white/[0.03] transition-colors"
                    >
                      <span className="text-[14px] text-[#EBEBF5]/80">先取り累計</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-white text-[14px] font-medium tabular-nums">¥{Number(savingsBalance || 0).toLocaleString()}</span>
                        {cumSavingsExpanded
                          ? <ChevronUp size={13} className="text-[#48484A]" />
                          : <ChevronDown size={13} className="text-[#48484A]" />}
                      </div>
                    </button>
                    {cumSavingsExpanded && (
                      <div className="px-4 pb-3 space-y-2">
                        {Object.keys(savingsBreakdown).map(name => {
                          const balance = (savingsBreakdown[name] || 0) - (withdrawnByBucket[name] || 0);
                          return (
                            <div key={name} className="flex items-center justify-between pl-3">
                              <span className="text-[12px] text-[#48484A]">{name}</span>
                              <span className={`text-[12px] tabular-nums ${balance < 0 ? 'text-[#FF453A]' : 'text-[#636366]'}`}>¥{balance.toLocaleString()}</span>
                            </div>
                          );
                        })}
                        {(withdrawnByBucket['指定なし'] || 0) > 0 && (
                          <div className="flex items-center justify-between pl-3">
                            <span className="text-[12px] text-[#48484A]">取り崩し（指定なし）</span>
                            <span className="text-[12px] text-[#4A7BA6] tabular-nums">−¥{withdrawnByBucket['指定なし'].toLocaleString()}</span>
                          </div>
                        )}
                        {savingsWithdrawn > 0 && (
                          <p className="pl-3 pt-1 text-[11px] text-[#48484A]">積立 ¥{savingsTotal.toLocaleString()} − 取り崩し ¥{savingsWithdrawn.toLocaleString()}</p>
                        )}
                      </div>
                    )}
                  </Card>
                </div>
              </div>
            </div>
          )}

          {/* LOG */}
          {activeTab === 'log' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-none px-4 pt-3 pb-2 space-y-2">
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <input value={searchText} onChange={e => setSearchText(e.target.value)} placeholder="検索..."
                      className="w-full h-10 bg-[#1C1C1E] border border-white/[0.06] rounded-[14px] pl-9 pr-3 text-[13px] text-white outline-none placeholder-[#48484A]" />
                    <Search size={14} className="absolute left-3 top-3 text-[#48484A]" />
                  </div>
                  <div className="flex bg-[#1C1C1E] border border-white/[0.06] rounded-[14px] p-1 gap-0.5">
                    {[['list', <AlignJustify size={14} />], ['calendar', <CalendarDays size={14} />]].map(([v, icon]) => (
                      <button key={v} onClick={() => setLogView(v)} className={`w-8 h-8 rounded-[10px] flex items-center justify-center transition-colors ${logView === v ? 'bg-white/10 text-white' : 'text-[#48484A]'}`}>{icon}</button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  {[{ key: 'cat', val: filter.cat, opts: catNames }, { key: 'method', val: filter.method, opts: methods }].map(({ key, val, opts }) => (
                    <div key={key} className="flex-1 relative">
                      <select value={val} onChange={e => setFilter(p => ({ ...p, [key]: e.target.value }))}
                        className="w-full h-9 bg-[#1C1C1E] border border-white/[0.06] rounded-[12px] pl-3 pr-7 text-[12px] text-white outline-none appearance-none">
                        <option value="ALL">すべて</option>
                        {opts.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                      <ChevronDown size={12} className="absolute right-2.5 top-[10px] text-[#48484A] pointer-events-none" />
                    </div>
                  ))}
                  <div className="flex-1 relative">
                    <select value={filter.spendType} onChange={e => setFilter(p => ({ ...p, spendType: e.target.value }))}
                      className="w-full h-9 bg-[#1C1C1E] border border-white/[0.06] rounded-[12px] pl-3 pr-7 text-[12px] text-white outline-none appearance-none">
                      <option value="ALL">全種別</option>
                      {SPEND_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    <ChevronDown size={12} className="absolute right-2.5 top-[10px] text-[#48484A] pointer-events-none" />
                  </div>
                  <button onClick={() => { setSearchText(''); setFilter({ cat: 'ALL', method: 'ALL', spendType: 'ALL' }); }}
                    className="w-9 h-9 bg-[#1C1C1E] border border-white/[0.06] rounded-[12px] flex items-center justify-center text-[#48484A] shrink-0">
                    <X size={14} />
                  </button>
                </div>
              </div>

              <div className="flex-1 px-4 pt-1 pb-32 overflow-y-auto scrollbar-hide">
                {logView === 'list' ? (
                  filteredTx.length === 0 ? (
                    <p className="text-center text-[13px] text-[#48484A] py-16">履歴がありません</p>
                  ) : (
                    <div>
                        {filteredTx.map((t, idx) => {
                          const dateStr = formatDateShort(t.date);
                          const [mo, da] = dateStr.split('/');
                          const st = getSpendType(t);
                          return (
                            <div key={t.id}>
                              <div onClick={() => setViewingTx(t)} className="flex items-center gap-3 px-1 py-3.5 active:bg-white/[0.03] transition-colors cursor-pointer rounded-xl">
                                <div className="flex flex-col items-center justify-center w-9 shrink-0">
                                  <span className="text-[10px] font-medium text-[#48484A] leading-none">{mo}月</span>
                                  <span className="text-[18px] font-semibold text-[#8E8E93] leading-tight tabular-nums">{da}</span>
                                </div>
                                <div className="w-px h-8 bg-white/[0.06] shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-[14px] font-medium text-white truncate leading-snug">{t.title}</p>
                                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                    <span className="text-[11px] text-[#48484A]">{t.category}</span>
                                    <span className="text-[#3A3A3C]">·</span>
                                    <span className="text-[11px] text-[#48484A]">{t.paymentMethod}</span>
                                    {st === 'special' && (<><span className="text-[#3A3A3C]">·</span><span className="text-[11px] text-[#636366] font-medium">特別費</span></>)}
                                    {st === 'savings' && (<><span className="text-[#3A3A3C]">·</span><span className="text-[11px] text-[#4A7BA6] font-medium">貯金から{t.savingsBucket ? `（${t.savingsBucket}）` : ''}</span></>)}
                                    {t.recurringId && (<><span className="text-[#3A3A3C]">·</span><span className="text-[11px] text-[#636366] font-medium flex items-center gap-0.5"><Repeat size={9} />定期</span></>)}
                                  </div>
                                </div>
                                <span className="text-[15px] font-semibold text-white tabular-nums shrink-0">¥{Number(t.amount || 0).toLocaleString()}</span>
                              </div>
                              {idx < filteredTx.length - 1 && <div className="h-px bg-white/[0.04]" />}
                            </div>
                          );
                        })}
                    </div>
                  )
                ) : (
                  <Card className="p-4">
                    <div className="grid grid-cols-7 text-center mb-2">
                      {['日','月','火','水','木','金','土'].map(d => <span key={d} className="text-[10px] text-[#48484A]">{d}</span>)}
                    </div>
                    <div className="grid grid-cols-7 gap-y-1">
                      {calDays.map((day, i) => {
                        if (!day) return <div key={i} className="h-14" />;
                        const amt = S.daily[day] || 0;
                        const cy = Number(month.split('-')[0]), cm = Number(month.split('-')[1]);
                        const isToday = day === today.d && cm === today.m && cy === today.y;
                        return (
                          <button key={i} onClick={() => openWithDate(`${month}-${String(day).padStart(2, '0')}`)}
                            className="h-14 flex flex-col items-center justify-start pt-1 rounded-xl active:bg-white/[0.04] transition-colors">
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-medium ${isToday ? 'bg-[#0A84FF] text-white' : 'text-[#8E8E93]'}`}>{day}</span>
                            {amt > 0 && <span className="text-[9px] text-[#48484A] mt-0.5 tabular-nums">¥{(amt / 1000).toFixed(0)}k</span>}
                          </button>
                        );
                      })}
                    </div>
                  </Card>
                )}
              </div>
            </div>
          )}

          {/* ANALYSIS */}
          {activeTab === 'analysis' && (
            <div className="flex-1 overflow-y-auto scrollbar-hide px-4 pt-6 pb-32 space-y-5">
              {/* 月間/年間 切替 */}
              <div className="flex bg-[#1C1C1E] border border-white/[0.06] rounded-[14px] p-1 gap-1">
                {[['month', '月間'], ['year', '年間']].map(([v, l]) => (
                  <button key={v} onClick={() => setAnalysisView(v)}
                    className={`flex-1 h-9 rounded-[10px] text-[13px] font-medium transition-colors ${analysisView === v ? 'bg-white/10 text-white' : 'text-[#48484A]'}`}>
                    {l}
                  </button>
                ))}
              </div>

              {/* 年間ビュー */}
              {analysisView === 'year' && (
                !yearData ? (
                  <p className="text-[13px] text-[#48484A] text-center py-10">読み込み中...</p>
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
                          <div className="flex items-end gap-1.5 h-32">
                            {yearData.months.map(m => {
                              const h = Math.max(2, (yearData.spend[m] / maxSpend) * 100);
                              const isCur = m === getMonthString(new Date());
                              return (
                                <div key={m} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                                  <div className={`w-full rounded-t-[4px] ${isCur ? 'bg-[#0A84FF]' : 'bg-white/25'}`} style={{ height: `${h}%` }} />
                                  <span className="text-[9px] text-[#48484A] tabular-nums">{Number(m.split('-')[1])}</span>
                                </div>
                              );
                            })}
                          </div>
                        </Card>
                      </div>
                      <div>
                        <Label>年間サマリー</Label>
                        <Card>
                          <Row label="年間支出合計" value={`¥${totalSpend.toLocaleString()}`} />
                          <div className="border-b border-white/[0.04] mx-4" />
                          <Row label="月平均支出" value={`¥${Math.round(totalSpend / activeMonths).toLocaleString()}`} />
                          <div className="border-b border-white/[0.04] mx-4" />
                          <Row label="年間先取り合計" value={`¥${totalSave.toLocaleString()}`} accent />
                        </Card>
                      </div>
                      <div>
                        <Label>月別の内訳</Label>
                        <Card>
                          {yearData.months.slice().reverse().map((m, i, arr) => (
                            <div key={m}>
                              <div className="px-4 py-3 flex items-center justify-between gap-3">
                                <span className="text-[13px] text-[#8E8E93] shrink-0">{formatMonthJP(m)}</span>
                                <div className="flex gap-4 tabular-nums">
                                  <span className="text-[13px] text-white">¥{yearData.spend[m].toLocaleString()}</span>
                                  <span className="text-[12px] text-[#636366] w-20 text-right">積立 ¥{yearData.save[m].toLocaleString()}</span>
                                </div>
                              </div>
                              {i < arr.length - 1 && <div className="border-b border-white/[0.04] mx-4" />}
                            </div>
                          ))}
                        </Card>
                      </div>
                    </>
                  );
                })()
              )}

              {analysisView === 'month' && (<>
              <Card>
                <div className="p-5 space-y-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] text-[#8E8E93] mb-1.5">通常支出</p>
                      <p className="text-[32px] font-semibold text-white tracking-tight leading-none">¥{S.spent.toLocaleString()}</p>
                    </div>
                    <div className={`flex items-center gap-1 px-3 py-1.5 rounded-[10px] text-[11px] font-medium ${S.spent <= S.prevSpent ? 'bg-[#30D158]/10 text-[#30D158]' : 'bg-[#FF453A]/10 text-[#FF453A]'}`}>
                      {S.spent <= S.prevSpent ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
                      {S.spent <= S.prevSpent ? '-' : '+'}¥{Math.abs(S.spent - S.prevSpent).toLocaleString()}
                    </div>
                  </div>
                  {donut.total > 0 ? (
                    <div className="space-y-4">
                      <div className="flex w-full h-2 rounded-full overflow-hidden gap-px">
                        {donut.items.map(item => <div key={item.name} className="h-full" style={{ width: `${(item.amount / donut.total) * 100}%`, backgroundColor: item.color }} />)}
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                        {donut.items.map(item => (
                          <div key={item.name} className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                            <span className="text-[12px] text-[#8E8E93] truncate flex-1">{item.name}</span>
                            <span className="text-[12px] font-medium text-white tabular-nums">¥{item.amount.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : <p className="text-[13px] text-[#48484A] text-center py-6">データがありません</p>}
                </div>
              </Card>
              <div>
                <Label>予算の進捗</Label>
                <Card>
                  <Row label="今月の予算（カード）" value={`¥${S.varBudget.toLocaleString()}`} />
                  <div className="border-b border-white/[0.04] mx-4" />
                  <Row label="今月使った分（カード）" value={`¥${S.spCard.toLocaleString()}`} />
                  <div className="border-b border-white/[0.04] mx-4" />
                  <Row label="固定費予定（未記録）" value={`−¥${S.pendingFixed.toLocaleString()}`} muted />
                  <div className="border-b border-white/[0.04] mx-4" />
                  <Row label="実質あと使える" value={`¥${S.freeRemain.toLocaleString()}`} danger={S.freeRemain < 0} accent={S.freeRemain >= 0} />
                </Card>
              </div>
              <div>
                <Label>支出の内訳</Label>
                <Card>
                  <Row label="カード支出" value={`¥${S.spCard.toLocaleString()}`} />
                  <div className="border-b border-white/[0.04] mx-4" />
                  <Row label="うち定期支出（記録済み）" value={`¥${S.recRecorded.toLocaleString()}`} muted />
                  <div className="border-b border-white/[0.04] mx-4" />
                  <Row label="現金支出" value={`¥${S.spCash.toLocaleString()}`} />
                  <div className="border-b border-white/[0.04] mx-4" />
                  <Row label="今月の先取り" value={`¥${S.savTotal.toLocaleString()}`} />
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
                          <div className="px-4 py-4">
                            <div className="flex justify-between mb-2">
                              <span className="text-[14px] text-white">{n}</span>
                              <span className={`text-[13px] font-medium tabular-nums ${over ? 'text-[#FF453A]' : 'text-[#8E8E93]'}`}>¥{cur.toLocaleString()} / ¥{bud.toLocaleString()}</span>
                            </div>
                            <div className="h-1 bg-white/[0.08] rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${over ? 'bg-[#FF453A]' : 'bg-white/50'}`} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                          {idx < activeCats.length - 1 && <div className="border-b border-white/[0.04] mx-4" />}
                        </div>
                      );
                    })}
                  </Card>
                </div>
              )}
              {S.spSpecial > 0 && (
                <Card className="p-5">
                  <p className="text-[11px] text-[#8E8E93] mb-2">特別費（別枠）</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-[22px] font-semibold text-white tabular-nums">¥{S.spSpecial.toLocaleString()}</span>
                    <span className="text-[12px] text-[#48484A]">先月 ¥{S.spSpecialPrev.toLocaleString()}</span>
                  </div>
                </Card>
              )}
              {S.spSavings > 0 && (
                <Card className="p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <PiggyBank size={13} className="text-[#4A7BA6]" />
                    <p className="text-[11px] text-[#8E8E93]">貯金からの支払い（今月）</p>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-[22px] font-semibold text-white tabular-nums">¥{S.spSavings.toLocaleString()}</span>
                    <span className="text-[12px] text-[#48484A]">先取り累計から差し引き済み</span>
                  </div>
                </Card>
              )}
              </>)}
            </div>
          )}

          {/* SETTINGS */}
          {activeTab === 'settings' && (
            <div className="flex-1 overflow-y-auto scrollbar-hide px-4 pt-6 pb-32 space-y-5">
              {settingTab === 'menu' && (
                <>
                  <div className="flex items-center gap-3.5 p-4 bg-[#1C1C1E] rounded-[20px] border border-white/[0.06]">
                    {user.photoURL ? <img src={user.photoURL} referrerPolicy="no-referrer" alt="" className="w-10 h-10 rounded-[14px]" /> : <div className="w-10 h-10 rounded-[14px] bg-[#2C2C2E] flex items-center justify-center"><User size={16} className="text-[#8E8E93]" /></div>}
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-medium text-white truncate">{user.displayName || 'User'}</p>
                      <p className="text-[12px] text-[#8E8E93] truncate">{user.email}</p>
                    </div>
                    <button onClick={async () => { const ok = await confirm({ title: 'ログアウトしますか？', confirmLabel: 'ログアウト', danger: true }); if (ok) signOut(auth); }} className="w-9 h-9 bg-[#FF453A]/10 text-[#FF453A] rounded-[12px] flex items-center justify-center shrink-0"><LogOut size={15} /></button>
                  </div>
                  <div>
                    <Label>メニュー</Label>
                    <Card>
                      <div>
                        {MENU.map((item, idx) => (
                          <div key={item.id}>
                            <SettingsRow onClick={() => setSettingTab(item.id)} left={<div className="flex items-center gap-3"><span className="text-[#8E8E93]">{item.icon}</span><span>{item.label}</span></div>} showChevron />
                            {idx < MENU.length - 1 && <div className="border-b border-white/[0.04] mx-4" />}
                          </div>
                        ))}
                      </div>
                    </Card>
                  </div>
                  <div className="space-y-2 pt-1">
                    <button onClick={() => { const d = new Date(month + '-01T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() - 1); setCopyFrom(getMonthString(d)); setCopyOpen(true); }} className="w-full h-12 bg-[#1C1C1E] border border-white/[0.06] text-white rounded-[14px] text-[14px] font-medium flex items-center justify-center gap-2 active:bg-white/[0.04] transition-colors">
                      <CopyCheck size={15} className="text-[#8E8E93]" /> 先月の設定をコピー
                    </button>
                    <button onClick={recordAllRecurring} className="w-full h-12 bg-[#1C1C1E] border border-white/[0.06] text-white rounded-[14px] text-[14px] font-medium flex items-center justify-center gap-2 active:bg-white/[0.04] transition-colors">
                      <Repeat size={15} className="text-[#8E8E93]" /> 今月の定期支出を記録{S.pendingFixed > 0 ? `（¥${S.pendingFixed.toLocaleString()}）` : ''}
                    </button>
                    <button onClick={exportCSV} className="w-full h-12 bg-[#1C1C1E] border border-white/[0.06] text-white rounded-[14px] text-[14px] font-medium flex items-center justify-center gap-2 active:bg-white/[0.04] transition-colors">
                      <FileText size={15} className="text-[#8E8E93]" /> CSVを書き出す
                    </button>
                  </div>
                </>
              )}
              {settingTab === 'faq' && (
                <div className="space-y-4">
                  <div className="relative">
                    <input value={faqQ} onChange={e => setFaqQ(e.target.value)} placeholder="検索..." className="w-full h-11 bg-[#1C1C1E] border border-white/[0.06] rounded-[14px] pl-9 pr-4 text-[13px] text-white outline-none placeholder-[#48484A]" />
                    <Search size={14} className="absolute left-3 top-3.5 text-[#48484A]" />
                    {faqQ && <button onClick={() => setFaqQ('')} className="absolute right-3 top-3 text-[#48484A]"><X size={14} /></button>}
                  </div>
                  {filteredFaq.length > 0 ? filteredFaq.map((sec, si) => (
                    <div key={si}>
                      <Label>{sec.category}</Label>
                      <Card>
                        <div>
                          {sec.items.map((item, ii) => (
                            <div key={ii}>
                              <div onClick={() => setExpandedFaq(expandedFaq === `${si}-${ii}` ? null : `${si}-${ii}`)} className="px-4 py-4 cursor-pointer active:bg-white/[0.03] transition-colors">
                                <div className="flex justify-between items-start gap-3">
                                  <div className="flex items-start gap-2.5"><HelpCircle size={14} className="text-[#48484A] mt-0.5 shrink-0" /><span className="text-[13px] text-white leading-snug">{item.q}</span></div>
                                  <ChevronDown size={14} className={`text-[#48484A] transition-transform shrink-0 mt-0.5 ${expandedFaq === `${si}-${ii}` ? 'rotate-180' : ''}`} />
                                </div>
                                {expandedFaq === `${si}-${ii}` && (
                                  <div className="mt-3 pl-6 space-y-2">
                                    <p className="text-[12px] text-[#8E8E93] leading-relaxed">{item.a}</p>
                                    {item.formula && (
                                      <div className="px-3 py-2.5 bg-white/[0.04] rounded-[10px] border border-white/[0.06]">
                                        <p className="text-[10px] text-[#48484A] mb-1">計算式</p>
                                        <p className="text-[12px] text-[#EBEBF5]/80 tabular-nums leading-relaxed">{item.formula}</p>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                              {ii < sec.items.length - 1 && <div className="border-b border-white/[0.04] mx-4" />}
                            </div>
                          ))}
                        </div>
                      </Card>
                    </div>
                  )) : <p className="text-center text-[13px] text-[#48484A] py-8">見つかりませんでした</p>}
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
                            {idx < 1 && <div className="border-b border-white/[0.04] mx-4" />}
                          </div>
                        ))}
                        <div className="border-b border-white/[0.04] mx-4" />
                        <SettingsRow onClick={() => openEdit('memo', { memo: monthly.memo }, 0)} left="今月のメモ" right={monthly.memo ? '設定済み' : '未設定'} />
                      </div>
                    </Card>
                  </div>
                  <div>
                    <Label trailing={`合計 ¥${S.savTotal.toLocaleString()}`}>先取り設定</Label>
                    <AddButton label="先取り項目を追加" onClick={() => openEdit('savingsBucket', { id: '', name: '', amount: '' }, -1)} />
                    {buckets.length > 0 && (
                      <Card><div>
                        {buckets.map((b, i) => (
                          <div key={b.id || i}>
                            <SettingsRow onClick={() => openEdit('savingsBucket', b, i)} left={b.name} right={`¥${Number(b.amount || 0).toLocaleString()}`} />
                            {i < buckets.length - 1 && <div className="border-b border-white/[0.04] mx-4" />}
                          </div>
                        ))}
                      </div></Card>
                    )}
                  </div>
                  <div>
                    <Label>引落予定のカード</Label>
                    <Card><div>
                      {methods.filter(m => m !== CASH).map((m, i, arr) => (
                        <div key={m}>
                          <SettingsRow onClick={() => openEdit('bill', { name: m, bill: monthly.cardBills?.[m] ?? 0, due: monthly.cardDueDates?.[m] ?? '' }, 0)} left={m} right={`¥${Number(monthly.cardBills?.[m] || 0).toLocaleString()} (${monthly.cardDueDates?.[m] || '-'}日)`} />
                          {i < arr.length - 1 && <div className="border-b border-white/[0.04] mx-4" />}
                        </div>
                      ))}
                    </div></Card>
                  </div>
                </div>
              )}
              {settingTab === 'category' && (
                <div>
                  <AddButton label="カテゴリを追加" onClick={() => openEdit('category', { name: '', budget: '' }, -1)} />
                  <Card><div>
                    {(config?.categories || []).map((c, i, arr) => {
                      const b = monthly.catBudgets?.[c.name] || 0;
                      return (
                        <div key={c.name}>
                          <SettingsRow onClick={() => openEdit('category', { name: c.name, budget: b }, i)} left={c.name} right={`¥${Number(b).toLocaleString()}`} />
                          {i < arr.length - 1 && <div className="border-b border-white/[0.04] mx-4" />}
                        </div>
                      );
                    })}
                  </div></Card>
                </div>
              )}
              {settingTab === 'template' && (
                <div>
                  <AddButton label="テンプレートを追加" onClick={() => openEdit('template', { title: '', amount: '', category: catNames[0] || '食費', method: methods[0] || CASH }, -1)} />
                  <Card><div>
                    {(config?.templates || []).map((t, i, arr) => (
                      <div key={i}>
                        <SettingsRow onClick={() => openEdit('template', t, i)} left={<div className="flex flex-col"><span className="text-[14px] text-white">{t.title}</span><span className="text-[11px] text-[#48484A]">{t.category} · {t.method}</span></div>} right={`¥${Number(t.amount || 0).toLocaleString()}`} />
                        {i < arr.length - 1 && <div className="border-b border-white/[0.04] mx-4" />}
                      </div>
                    ))}
                  </div></Card>
                </div>
              )}
              {settingTab === 'recurring' && (
                <div>
                  <AddButton label="定期支出を追加" onClick={() => openEdit('recurring', { id: '', title: '', amount: '', category: catNames[0] || '食費', method: methods[0] || CASH, day: 1 }, -1)} />
                  {(monthly.fixedCosts || []).length > 0 && (
                    <button onClick={migrateFixed}
                      className="w-full h-11 mb-3 bg-[#0A84FF]/10 border border-[#0A84FF]/30 text-[#0A84FF] rounded-[14px] text-[13px] font-medium flex items-center justify-center gap-2 active:bg-[#0A84FF]/20 transition-colors">
                      <CopyCheck size={14} /> 旧・固定費リストから一括移行（{(monthly.fixedCosts || []).length}件）
                    </button>
                  )}
                  <Card><div>
                    {(config?.recurring || []).map((r, i, arr) => (
                      <div key={r.id || i}>
                        <SettingsRow onClick={() => openEdit('recurring', r, i)}
                          left={<div className="flex flex-col"><span className="text-[14px] text-white">{r.title}</span><span className="text-[11px] text-[#48484A]">毎月{r.day}日 · {r.category} · {r.method}</span></div>}
                          right={`¥${Number(r.amount || 0).toLocaleString()}`} />
                        {i < arr.length - 1 && <div className="border-b border-white/[0.04] mx-4" />}
                      </div>
                    ))}
                    {(config?.recurring || []).length === 0 && (
                      <p className="text-[12px] text-[#48484A] text-center py-6 px-4">サブスクや家賃など、毎月決まった支出を登録すると指定日に自動でログへ記録されます</p>
                    )}
                  </div></Card>
                </div>
              )}
              {settingTab === 'payment' && (
                <div>
                  <AddButton label="支払方法を追加" onClick={() => openEdit('payment', { name: '' }, -1)} />
                  <Card><div>
                    {methods.map((m, i, arr) => (
                      <div key={m}>
                        <SettingsRow onClick={() => openEdit('payment', { name: m }, i)} left={m} />
                        {i < arr.length - 1 && <div className="border-b border-white/[0.04] mx-4" />}
                      </div>
                    ))}
                  </div></Card>
                </div>
              )}
            </div>
          )}
        </main>

        {/* FOOTER — Liquid Glass風フローティングバー */}
        <footer className="fixed bottom-5 left-5 right-5 z-50 max-w-[400px] mx-auto rounded-[30px] bg-white/[0.08] backdrop-blur-2xl backdrop-saturate-150 border border-white/[0.12] shadow-2xl shadow-black/40 flex items-center justify-around px-3 py-2">
          {[[<Home size={22} />, 'home'], [<History size={22} />, 'log']].map(([icon, tab]) => (
            <NavButton key={tab} active={activeTab === tab} onClick={() => setActiveTab(tab)} icon={icon} />
          ))}
          <button onClick={openNew} className="w-12 h-12 bg-[#0A84FF] text-white rounded-full flex items-center justify-center active:scale-90 transition-transform shadow-lg shadow-[#0A84FF]/30">
            <Plus size={20} />
          </button>
          {[[<BarChart3 size={22} />, 'analysis'], [<Settings size={22} />, 'settings']].map(([icon, tab]) => (
            <NavButton key={tab} active={activeTab === tab} onClick={() => { setActiveTab(tab); if (tab === 'settings') setSettingTab('menu'); }} icon={icon} />
          ))}
        </footer>
      </div>

      {/* 支出詳細モーダル */}
      {viewingTx && (
        <Modal onClose={() => setViewingTx(null)} zIndex="z-[60]">
          <ModalHeader title="支出の詳細" onClose={() => setViewingTx(null)} />
          <div className="flex-1 overflow-y-auto overflow-x-hidden p-5 pb-10 space-y-5">
            <div className="flex flex-col items-center gap-2 py-2">
              <span className="text-[12px] text-[#8E8E93] px-3 py-1 rounded-[10px] bg-white/[0.06]">{viewingTx.category}</span>
              <p className="text-[40px] font-semibold text-white tracking-tight">¥{Number(viewingTx.amount).toLocaleString()}</p>
            </div>
            <Card>
              {[['内容', viewingTx.title], ['日付', formatFullDateJP(viewingTx.date)], ['支払方法', viewingTx.paymentMethod], ['種別', getSpendType(viewingTx) === 'savings' ? `貯金から${viewingTx.savingsBucket ? `（${viewingTx.savingsBucket}）` : ''}` : getSpendType(viewingTx) === 'special' ? '特別費' : '通常']].map(([l, v], idx, arr) => (
                <div key={l}>
                  <div className="px-4 py-3 flex justify-between gap-4">
                    <span className="text-[12px] text-[#8E8E93]">{l}</span>
                    <span className="text-[13px] text-white">{v}</span>
                  </div>
                  {idx < arr.length - 1 && <div className="border-b border-white/[0.04] mx-4" />}
                </div>
              ))}
            </Card>
            <div className="flex gap-2">
              <DangerIconButton onClick={async () => {
                const isRec = !!viewingTx.recurringId;
                const ok = await confirm({
                  title: 'この支出を削除しますか？',
                  message: isRec ? '定期支出の今月分はスキップされます（来月から自動記録が再開されます）。' : undefined,
                  confirmLabel: '削除する', danger: true
                });
                if (!ok) return;
                try {
                  await deleteDoc(doc(db, 'users', user.uid, 'transactions', viewingTx.id));
                  if (isRec) {
                    await setDoc(doc(db, 'users', user.uid, 'months', month), { skippedRecurring: arrayUnion(viewingTx.recurringId) }, { merge: true });
                  }
                  setViewingTx(null); showToast('削除しました');
                } catch (e) { console.error(e); showToast('エラー'); }
              }}><Trash2 size={17} /></DangerIconButton>
              <PrimaryButton onClick={() => { const tx = viewingTx; setViewingTx(null); startEdit(tx); }}><Pencil size={14} /> 編集する</PrimaryButton>
            </div>
          </div>
        </Modal>
      )}

      {/* 計算機モーダル */}
      {showCalc && (
        <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center sm:p-6 bg-black/60 backdrop-blur-sm" onClick={() => setShowCalc(false)}>
          <div className="w-full sm:max-w-xs bg-[#1C1C1E]/80 backdrop-blur-2xl backdrop-saturate-150 rounded-t-3xl sm:rounded-3xl border border-white/[0.12] p-5 pb-8" onClick={e => e.stopPropagation()}>
            <CalculatorPad initialValue={calcInit} onConfirm={val => { if (calcCb) calcCb(val); setShowCalc(false); }} />
          </div>
        </div>
      )}

      {/* 支出入力モーダル */}
      {isTxOpen && (
        <Modal onClose={closeTx}>
          <ModalHeader title={editingTx ? '支出を編集' : '支出を入力'} onClose={closeTx} />
          <div className="flex-1 overflow-y-auto overflow-x-hidden p-5 pb-10">
            <form onSubmit={submitTx} className="space-y-4 w-full min-w-0">
              <div>
                <label className="text-[11px] font-medium text-[#8E8E93] uppercase tracking-wide ml-1 block mb-1.5">金額</label>
                <div className="flex gap-1.5 items-center w-full min-w-0">
                  <div className="flex-1 min-w-0 flex items-center bg-[#2C2C2E] rounded-[14px] h-14 px-4 gap-2 border border-white/[0.06] focus-within:border-white/20 transition-colors">
                    <span className="text-[16px] text-[#8E8E93] shrink-0">¥</span>
                    <input
                      key={`amount-${txFormKey}`}
                      type="text" inputMode="decimal"
                      value={inAmount ? Number(inAmount).toLocaleString() : ''}
                      onChange={e => { const v = e.target.value.replace(/,/g, ''); if (!isNaN(v)) setInAmount(v); }}
                      className="flex-1 min-w-0 w-full bg-transparent text-[22px] font-semibold text-white outline-none tabular-nums"
                      required
                    />
                  </div>
                  <button type="button" onClick={() => openCalc(inAmount, val => setInAmount(String(val)))}
                    className="w-10 h-10 flex items-center justify-center text-[#8E8E93] active:text-white transition-colors shrink-0">
                    <Calculator size={20} />
                  </button>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-medium text-[#8E8E93] uppercase tracking-wide ml-1 block mb-1.5">内容</label>
                <input
                  key={`title-${txFormKey}`}
                  value={inTitle}
                  onChange={e => setInTitle(e.target.value)}
                  placeholder="例: スーパーでお買い物"
                  className="w-full h-12 bg-[#2C2C2E] border border-white/[0.06] rounded-[14px] px-4 text-[14px] text-white outline-none placeholder-[#48484A] focus:border-white/20 transition-colors"
                  required
                />
              </div>
              <div className="relative">
                <label className="text-[11px] font-medium text-[#8E8E93] uppercase tracking-wide ml-1 block mb-1.5">カテゴリ</label>
                <select value={inCat} onChange={e => setInCat(e.target.value)} className="w-full h-12 bg-[#2C2C2E] border border-white/[0.06] rounded-[14px] px-4 text-[14px] text-white outline-none appearance-none">
                  {catNames.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <ChevronDown size={13} className="absolute right-4 bottom-4 text-[#48484A] pointer-events-none" />
              </div>
              <div>
                <label className="text-[11px] font-medium text-[#8E8E93] uppercase tracking-wide ml-1 block mb-1.5">日付</label>
                <div className="relative h-12 bg-[#2C2C2E] border border-white/[0.06] rounded-[14px] overflow-hidden">
                  <div className="absolute inset-0 flex items-center px-4 pointer-events-none">
                    <span className="text-[14px] text-white">{inDate ? inDate.split('-').join('/') : '日付を選択'}</span>
                  </div>
                  <input type="date" value={inDate} onChange={e => setInDate(e.target.value)} className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" required />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-medium text-[#8E8E93] uppercase tracking-wide ml-1 block mb-1.5">支払方法</label>
                <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                  {methods.map(m => (
                    <button key={m} type="button" onClick={() => setInMethod(m)}
                      className={`shrink-0 h-10 px-4 rounded-[12px] text-[13px] font-medium transition-colors ${inMethod === m ? 'bg-[#0A84FF] text-white' : 'bg-[#2C2C2E] text-[#8E8E93] border border-white/[0.06]'}`}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[11px] font-medium text-[#8E8E93] uppercase tracking-wide ml-1 block mb-1.5">種別</label>
                <div className="flex gap-2">
                  {SPEND_TYPES.map(({ value, label }) => (
                    <button key={value} type="button" onClick={() => setInSpendType(value)}
                      className={`flex-1 h-10 rounded-[12px] text-[13px] font-medium transition-colors ${inSpendType === value ? 'bg-[#0A84FF] text-white' : 'bg-[#2C2C2E] text-[#8E8E93] border border-white/[0.06]'}`}>
                      {label}
                    </button>
                  ))}
                </div>
                {inSpendType === 'savings' && (
                  <div className="mt-2 space-y-2">
                    <p className="ml-1 text-[11px] text-[#4A7BA6] flex items-center gap-1.5">
                      <PiggyBank size={12} /> 可変費には含まれず、先取り累計から差し引かれます
                    </p>
                    {bucketOptions.length > 0 && (
                      <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                        <button type="button" onClick={() => setInSavingsBucket('')}
                          className={`shrink-0 h-9 px-3.5 rounded-[12px] text-[12px] font-medium transition-colors ${inSavingsBucket === '' ? 'bg-[#4A7BA6] text-white' : 'bg-[#2C2C2E] text-[#8E8E93] border border-white/[0.06]'}`}>
                          指定なし
                        </button>
                        {bucketOptions.map(name => (
                          <button key={name} type="button" onClick={() => setInSavingsBucket(name)}
                            className={`shrink-0 h-9 px-3.5 rounded-[12px] text-[12px] font-medium transition-colors ${inSavingsBucket === name ? 'bg-[#4A7BA6] text-white' : 'bg-[#2C2C2E] text-[#8E8E93] border border-white/[0.06]'}`}>
                            {name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              {!editingTx && config.templates.length > 0 && (
                <div>
                  <label className="text-[11px] font-medium text-[#8E8E93] uppercase tracking-wide ml-1 block mb-1.5">テンプレート</label>
                  <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                    {config.templates.map((t, i) => (
                      <button key={i} type="button" onClick={() => applyTpl(t)} className="shrink-0 h-9 px-3.5 bg-[#2C2C2E] border border-white/[0.06] rounded-[12px] text-[12px] text-[#8E8E93] flex items-center gap-1.5">
                        <Zap size={11} /> {t.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="pt-2">
                <PrimaryButton type="submit">保存する</PrimaryButton>
              </div>
            </form>
          </div>
        </Modal>
      )}

      {/* 設定コピーモーダル */}
      {copyOpen && (
        <Modal onClose={() => setCopyOpen(false)}>
          <ModalHeader title="設定をコピー" onClose={() => setCopyOpen(false)} />
          <div className="p-5 pb-10 space-y-4">
            <div>
              <label className="text-[11px] font-medium text-[#8E8E93] uppercase tracking-wide ml-1 block mb-1.5">コピー元の月</label>
              <div className="relative w-full h-12 bg-[#2C2C2E] border border-white/[0.06] rounded-[14px] overflow-hidden">
                <div className="absolute inset-0 flex items-center px-4 pointer-events-none">
                  <span className="text-[14px] text-white">{copyFrom ? formatMonthJP(copyFrom) : '月を選択'}</span>
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
      {editingItem && (
        <Modal onClose={() => setEditingItem(null)} zIndex="z-[70]">
          <ModalHeader title="編集する" onClose={() => setEditingItem(null)} />
          <div className="flex-1 overflow-y-auto overflow-x-hidden p-5 pb-10 space-y-4">
            {['salary', 'cashBudget'].includes(editingItem.type) && <EditFormSalaryLike editingItem={editingItem} setEditingItem={setEditingItem} openCalculator={openCalc} />}
            {editingItem.type === 'memo' && <EditFormMemo editingItem={editingItem} setEditingItem={setEditingItem} />}
            {editingItem.type === 'bill' && <EditFormBill editingItem={editingItem} setEditingItem={setEditingItem} openCalculator={openCalc} />}
            {editingItem.type === 'savingsBucket' && <EditFormSavingsBucket editingItem={editingItem} setEditingItem={setEditingItem} openCalculator={openCalc} />}
            {editingItem.type === 'category' && <EditFormCategory editingItem={editingItem} setEditingItem={setEditingItem} openCalculator={openCalc} />}
            {editingItem.type === 'template' && <EditFormTemplate editingItem={editingItem} setEditingItem={setEditingItem} openCalculator={openCalc} categoryNames={catNames} paymentMethods={config.paymentMethods} />}
            {editingItem.type === 'recurring' && <EditFormRecurring editingItem={editingItem} setEditingItem={setEditingItem} openCalculator={openCalc} categoryNames={catNames} paymentMethods={config.paymentMethods} />}
            {editingItem.type === 'payment' && <EditFormPayment editingItem={editingItem} setEditingItem={setEditingItem} />}
            <div className="flex gap-2 pt-2">
              {editingItem.index !== -1 && !['salary', 'cashBudget', 'bill', 'memo'].includes(editingItem.type) && (
                <DangerIconButton onClick={deleteItem}><Trash2 size={17} /></DangerIconButton>
              )}
              <PrimaryButton onClick={saveSettings}>変更を保存する</PrimaryButton>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default function AppWrapper() {
  return <ErrorBoundary><AppMain /></ErrorBoundary>;
}
