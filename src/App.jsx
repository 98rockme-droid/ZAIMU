import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import {
  getFirestore, collection, doc, setDoc, onSnapshot, query, deleteDoc,
  where, getDocs, getDoc, orderBy, addDoc, updateDoc, serverTimestamp,
  runTransaction, documentId
} from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth';
import {
  Wallet, CreditCard, Landmark, Plus, Settings, Trash2, History,
  ChevronLeft, ChevronRight, X, Tags, ArrowLeft, CopyCheck, Calendar,
  CheckCircle2, BarChart3, TrendingDown, TrendingUp, Banknote,
  LayoutGrid, ListChecks, Search, CalendarDays, AlignJustify, Zap,
  Calculator, Delete, LogOut, Lock, User, FileText, Home, Sparkles,
  ChevronDown, PiggyBank, HelpCircle, Pencil
} from 'lucide-react';

/* --- FIREBASE CONFIG --- */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_GOOGLE_API_KEY,
  authDomain: "zaimu-4f79b.firebaseapp.com",
  projectId: "zaimu-4f79b",
  storageBucket: "zaimu-4f79b.firebasestorage.app",
  messagingSenderId: "388166181792",
  appId: "1:388166181792:web:d3ccef2742dca358d3bac5"
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

/* --- UTILS --- */
const CASH = '現金';

const getMonthString = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
};

const formatMonthJP = (monthStr) => {
  if (!monthStr) return "";
  const [y, m] = monthStr.split('-');
  if (!y || !m) return "";
  return `${y}年 ${Number(m)}月`;
};

const formatDateShort = (isoDateStr) => {
  if (!isoDateStr) return '';
  const d = new Date(isoDateStr);
  if (isNaN(d.getTime())) return '';
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

const formatFullDateJP = (isoDateStr) => {
  if (!isoDateStr) return '';
  const d = new Date(isoDateStr);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
};

const getTodayString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const toNumber = (val) => {
  if (val === null || val === undefined || val === '') return 0;
  const num = Number(String(val).replace(/,/g, ''));
  return Number.isFinite(num) ? num : 0;
};

const toISODateSafe = (yyyyMmDd) => {
  if (!yyyyMmDd) return new Date().toISOString();
  return new Date(`${yyyyMmDd}T12:00:00`).toISOString();
};

const isoToLocalYMD = (iso) => {
  if (!iso) return getTodayString();
  const d = new Date(iso);
  if (isNaN(d.getTime())) return getTodayString();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// 🌟 cashBudgetを復活させました
const normalizeMonthlyData = (data) => {
  const d = data || {};
  const absorbedDueDates = { ...(d.cardDueDates || {}) };
  const absorbedCardBills = { ...(d.cardBills || {}) };

  Object.keys(d).forEach(k => {
    if (k.startsWith('cardDueDates.')) absorbedDueDates[k.split('.')[1]] = d[k];
    if (k.startsWith('cardBills.')) absorbedCardBills[k.split('.')[1]] = d[k];
  });

  return {
    salary: d.salary || 0,
    budget: d.budget || 0,
    cashBudget: d.cashBudget || 0, // <- ここ
    cardBills: absorbedCardBills,
    fixedCosts: d.fixedCosts || [],
    catBudgets: d.catBudgets || {},
    cardDueDates: absorbedDueDates,
    confirmedPayments: d.confirmedPayments || [],
    savings: d.savings || 0,
    memo: d.memo || ''
  };
};

const normalizeConfig = (data) => ({
  categories: data?.categories || [{ name: '食費', icon: '🍔' }],
  paymentMethods: data?.paymentMethods || [CASH],
  templates: data?.templates || []
});

const GRAY_PALETTE = ['#F4F4F5', '#D4D4D8', '#A1A1AA', '#71717A', '#52525B', '#3F3F46', '#27272A'];
const getCategoryColor = (index) => {
  return GRAY_PALETTE[index % GRAY_PALETTE.length];
};

/* --- COMPONENTS --- */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, errorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-full bg-[#121212] text-zinc-200 flex flex-col items-center justify-center p-6 gap-4">
          <h1 className="text-xl font-bold text-red-400">エラーが発生しました</h1>
          <p className="text-xs text-zinc-400 text-center">画面を再読み込みしてください。</p>
          <button onClick={() => window.location.reload()} className="px-6 py-3 bg-white text-black rounded-full font-bold text-sm">再読み込み</button>
        </div>
      );
    }
    return this.props.children;
  }
}

const SimpleCard = ({ children, className = "", onClick }) => (
  <div onClick={onClick} className={`bg-[#1E1E1E] rounded-xl border border-white/5 shadow-lg overflow-hidden w-full box-border ${className}`}>
    {children}
  </div>
);

const NavButton = ({ active, onClick, icon }) => (
  <button onClick={onClick} className={`flex items-center justify-center w-16 h-16 transition-all duration-300 ${active ? 'text-white scale-110 drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]' : 'text-zinc-600 hover:text-zinc-400'}`}>
    {icon}
  </button>
);

const Toast = ({ message, isVisible }) => (
  <div className={`fixed bottom-28 left-1/2 -translate-x-1/2 z-[80] transition-all duration-300 pointer-events-none ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
    <div className="bg-zinc-800/90 backdrop-blur-md text-white px-6 py-3 rounded-full border border-white/10 flex items-center gap-2 shadow-2xl">
      <CheckCircle2 size={16} className="text-emerald-400" />
      <span className="text-xs font-bold tracking-wider">{message}</span>
    </div>
  </div>
);

const SettingsRow = ({ left, right, onClick, showChevron = false }) => (
  <button type="button" onClick={onClick} className="w-full flex items-center justify-between px-4 py-4 active:bg-white/5 text-zinc-300 transition-colors">
    <div className="flex items-center gap-3 text-left min-w-0 flex-1 font-bold text-zinc-200">{left}</div>
    <div className="flex items-center gap-2 shrink-0 ml-3">
      {right ? <div className="text-[11px] text-zinc-500 font-normal">{right}</div> : null}
      {showChevron ? <ChevronRight size={18} className="text-zinc-500" /> : null}
    </div>
  </button>
);

const safeCalculate = (expression) => {
  if (!expression || /[^0-9+\-*/.]/.test(expression)) return '0';
  try {
    const tokens = expression.match(/(\d+(\.\d+)?|[\+\-\*\/])/g);
    if (!tokens) return 0;
    let stack = [];
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (token === '*' || token === '/') {
        const prev = parseFloat(stack.pop());
        const next = parseFloat(tokens[++i]);
        if (token === '*') stack.push(prev * next);
        if (token === '/') stack.push(prev / next);
      } else { stack.push(token); }
    }
    let result = parseFloat(stack[0]);
    for (let i = 1; i < stack.length; i += 2) {
      const operator = stack[i];
      const operand = parseFloat(stack[i + 1]);
      if (operator === '+') result += operand;
      if (operator === '-') result -= operand;
    }
    return isNaN(result) ? '0' : result;
  } catch { return '0'; }
};

const CalculatorPad = ({ initialValue, onConfirm }) => {
  const [display, setDisplay] = useState(String(initialValue || '0'));
  const [isResult, setIsResult] = useState(false);
  const handlePush = (val) => {
    if (isResult && !['+','-','*','/'].includes(val)) { setDisplay(String(val)); setIsResult(false); }
    else { setDisplay(prev => (prev === '0' && !['+','-','*','/','.'].includes(val)) ? String(val) : prev + val); setIsResult(false); }
  };
  const btns = [
    { l: 'C', act: () => setDisplay('0'), style: 'text-red-400' }, { l: '/', act: () => handlePush('/'), style: 'text-emerald-400' }, { l: '*', act: () => handlePush('*'), style: 'text-emerald-400' }, { l: <Delete size={18}/>, act: () => setDisplay(prev => prev.length > 1 ? prev.slice(0, -1) : '0'), style: 'text-zinc-400' },
    { l: '7', act: () => handlePush('7') }, { l: '8', act: () => handlePush('8') }, { l: '9', act: () => handlePush('9') }, { l: '-', act: () => handlePush('-'), style: 'text-emerald-400' },
    { l: '4', act: () => handlePush('4') }, { l: '5', act: () => handlePush('5') }, { l: '6', act: () => handlePush('6') }, { l: '+', act: () => handlePush('+'), style: 'text-emerald-400' },
    { l: '1', act: () => handlePush('1') }, { l: '2', act: () => handlePush('2') }, { l: '3', act: () => handlePush('3') },
    { l: '=', act: () => { setDisplay(String(safeCalculate(display))); setIsResult(true); }, style: 'bg-emerald-500/20 text-emerald-400 row-span-2' },
    { l: '0', act: () => handlePush('0'), style: 'col-span-2' }, { l: '.', act: () => handlePush('.') },
  ];
  return (
    <div className="w-full flex flex-col gap-3">
      <div className="bg-black/40 rounded-lg p-3 text-right border border-white/5 font-mono text-2xl text-white break-all tabular-nums">{display}</div>
      <div className="grid grid-cols-4 gap-2 h-64">
        {btns.map((b, i) => (
          <button key={i} type="button" onClick={b.act} className={`rounded-lg bg-zinc-800 border border-white/5 text-lg font-bold active:scale-95 transition-all flex items-center justify-center ${b.style || 'text-white'}`}>{b.l}</button>
        ))}
      </div>
      <button type="button" onClick={() => onConfirm(toNumber(display))} className="w-full h-12 bg-white text-black rounded-lg font-bold uppercase tracking-widest active:scale-95 shadow-lg">決定</button>
    </div>
  );
};

/* --- MAIN APP --- */
function AppMain() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [activeTab, setActiveTab] = useState('home');
  const [logView, setLogView] = useState('list');
  const [settingTab, setSettingTab] = useState('menu');
  const [month, setMonth] = useState(getMonthString(new Date()));

  const [viewingTx, setViewingTx] = useState(null);
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [calcInitialValue, setCalcInitialValue] = useState(0);
  const [calcOnConfirm, setCalcOnConfirm] = useState(null);

  const [toast, setToast] = useState({ visible: false, message: '' });

  const [inputDate, setInputDate] = useState(getTodayString());
  const [inputAmount, setInputAmount] = useState('');
  const [inputTitle, setInputTitle] = useState('');
  const [inputCategory, setInputCategory] = useState('');
  const [inputMethod, setInputMethod] = useState('');
  const [inputIsSpecial, setInputIsSpecial] = useState(false);

  const [editingTx, setEditingTx] = useState(null);
  const [editingItem, setEditingItem] = useState(null);

  const [expandedFaq, setExpandedFaq] = useState(null);
  const [faqSearchText, setFaqSearchText] = useState('');

  const [transactions, setTransactions] = useState([]);
  const [lastMonthTransactions, setLastMonthTransactions] = useState([]);
  const [monthlyData, setMonthlyData] = useState(normalizeMonthlyData({}));
  const [config, setConfig] = useState(normalizeConfig({}));
  const [savingsTotalToMonth, setSavingsTotalToMonth] = useState(0);

  const [searchText, setSearchText] = useState('');
  const [filter, setFilter] = useState({ category: 'ALL', method: 'ALL', special: false });

  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [copySourceMonth, setCopySourceMonth] = useState('');
  
  const [memoText, setMemoText] = useState('');
  const [isMemoExpanded, setIsMemoExpanded] = useState(false);
  const [isMemoModalOpen, setIsMemoModalOpen] = useState(false);

  // 🌟 現在見ている月と来月の数値を算出
  const currentMonthNum = month ? Number(month.split('-')[1]) : new Date().getMonth() + 1;
  const nextMonthNum = currentMonthNum === 12 ? 1 : currentMonthNum + 1;

  // 🌟 ブラッシュアップしたFAQ
  const FAQ_DATA = [
    {
      category: '⚙️ 1. 設定タブで入力する金額の使い道',
      items: [
        { q: '手取り給与 (salary)', a: `家計のすべてのベース（収入）として使われます。ホーム画面の「${currentMonthNum}月の自由な現金」「${nextMonthNum}月の着地予想」の計算のスタート金額になります。` },
        { q: 'クレジットカード利用目安 (budget)', a: 'クレカを使いすぎていないかの「ペースメーカー」になります。ホーム画面左上の「今月の利用額」のプログレスバーや、分析タブの AI判定基準に使われます。' },
        { q: '月初のスタート現金 (cashBudget)', a: '毎月1日に、お財布と口座にある「今月使える現金の実数」を入力します。ホーム画面の「今の現金残り」の計算元になります。' },
        { q: '今月の積立額 (savings)', a: '「絶対に使ってはいけないお金（先取り）」として真っ先に差し引かれます。ホームの各予測値からマイナスされ、積立総額に加算されます。' },
        { q: '引落予定のカード（引落額） (cardBills)', a: `「先月使った分のツケ（今月確実に口座から消えるお金）」として扱われます。ホーム画面の「${currentMonthNum}月の自由な現金」からマイナスされます。` },
        { q: '固定費管理 (fixedCosts)', a: `現金払いのものは「${currentMonthNum}月の自由な現金」から引かれ、全固定費の合計は「${nextMonthNum}月の着地予想」から引かれます。` },
        { q: 'カテゴリ予算 (catBudgets)', a: 'カテゴリごとの使いすぎ防止枠です。ホームと分析タブの「カテゴリ別予算状況」の分母に使われます。' }
      ]
    },
    {
      category: '🏠 2. ホーム画面の金額（アウトプット）の計算式',
      items: [
        { q: '① 今月の利用額', a: '今月の支出の合計です。内訳として「カード利用額」と「現金利用額」が表示されます。\n設定した「クレジットカード利用目安」に対して、カード利用額が何％まで来ているかでバーが伸びます。' },
        { q: '② 今の現金残り', a: '【意味】今月、手元にリアルに残っている現金の実数です。\n【計算式】月初のスタート現金 － 今月「現金」で使った金額' },
        { q: `③ ${currentMonthNum}月の自由な現金`, a: `【意味】給与から確定支払いを終えた直後に残る、${currentMonthNum}月中に使っていい現金の総枠です。\n【計算式】手取り給与 － 引落予定のカード(先月のツケ) － 固定費(現金分) － 積立額` },
        { q: `④ ${nextMonthNum}月の着地予想`, a: '【意味】今のペースを続けた場合、来月末に手元にいくら純利益が残るかのシミュレーションです。\n【計算式】手取り給与 － 今のカード利用額 － 固定費(全額) － 積立額' },
        { q: '⑤ 積立貯金（総額）', a: 'ZAIMUを使い始めてから今までに貯まったお金の合計です。\n【計算式】過去の月の積立額の合計 ＋ 今月の積立額' }
      ]
    },
    {
      category: '💡 その他・操作',
      items: [
        { q: '来月の設定はどうすればいいですか？', a: '月が変わったら、設定タブの下部にある「先月の設定をコピー」ボタンを押してください。過去の月の設定（目安、固定費、積立額など）をそのまま引き継げます。' },
        { q: 'データのバックアップはできますか？', a: '設定タブの「全データをCSV出力」から、これまでの全取引データをダウンロードできます。Excelなどで管理したい場合にご利用ください。' },
      ]
    }
  ];

  const filteredFaqData = useMemo(() => {
    if (!faqSearchText) return FAQ_DATA;
    const lowerText = faqSearchText.toLowerCase();
    return FAQ_DATA.map(cat => ({
      ...cat,
      items: cat.items.filter(item => 
        item.q.toLowerCase().includes(lowerText) || item.a.toLowerCase().includes(lowerText)
      )
    })).filter(cat => cat.items.length > 0);
  }, [faqSearchText]);

  const showToastMsg = (msg) => {
    setToast({ visible: true, message: msg });
    setTimeout(() => setToast({ visible: false, message: '' }), 2500);
  };

  const openCalculator = (initial, onConfirm) => {
    setCalcInitialValue(initial);
    setCalcOnConfirm(() => onConfirm);
    setShowCalculator(true);
  };

  const getCategoryNames = () => (config?.categories || []).map(c => c.name);
  const getCategoryIcon = (name) => {
    const c = (config?.categories || []).find(x => x.name === name);
    return c?.icon || '🏷';
  };
  const paymentMethodsSafe = config?.paymentMethods?.length ? config.paymentMethods : [CASH];
  const clearLogFilters = () => { setSearchText(''); setFilter({ category: 'ALL', method: 'ALL', special: false }); };

  /* --- AUTH --- */
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  /* --- DATA SUBSCRIPTIONS --- */
  useEffect(() => {
    if (!user) return;
    const start = new Date(`${month}-01T00:00:00`).toISOString();
    const nextDate = new Date(`${month}-01T00:00:00`);
    nextDate.setMonth(nextDate.getMonth() + 1);
    const end = nextDate.toISOString();
    const q = query(collection(db, 'users', user.uid, 'transactions'), where('date', '>=', start), where('date', '<', end));
    const unsub = onSnapshot(q, (s) => {
      const list = s.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => new Date(b.date) - new Date(a.date));
      setTransactions(list);
    });
    return () => unsub();
  }, [month, user]);

  useEffect(() => {
    if (!user) return;
    const prevDate = new Date(`${month}-01T00:00:00`);
    prevDate.setMonth(prevDate.getMonth() - 1);
    const prevStart = new Date(`${getMonthString(prevDate)}-01T00:00:00`).toISOString();
    const currentStart = new Date(`${month}-01T00:00:00`).toISOString();
    const fetchLast = async () => {
      const q = query(collection(db, 'users', user.uid, 'transactions'), where('date', '>=', prevStart), where('date', '<', currentStart));
      const s = await getDocs(q);
      setLastMonthTransactions(s.docs.map(d => ({ id: d.id, ...d.data() })));
    };
    fetchLast();
  }, [month, user]);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(doc(db, 'users', user.uid, 'months', month), (s) => setMonthlyData(normalizeMonthlyData(s.exists() ? s.data() : {})));
  }, [month, user]);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(doc(db, 'users', user.uid, 'settings', 'config'), (s) => setConfig(normalizeConfig(s.exists() ? s.data() : {})));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const fetchSavingsTotalToMonth = async () => {
      try {
        const q = query(
          collection(db, 'users', user.uid, 'months'),
          where(documentId(), '<=', month),
          orderBy(documentId(), 'asc')
        );
        const s = await getDocs(q);
        let sum = 0;
        s.forEach(d => {
          const md = normalizeMonthlyData(d.data());
          sum += Number(md.savings || 0);
        });
        setSavingsTotalToMonth(sum);
      } catch (e) {
        console.error(e);
      }
    };
    fetchSavingsTotalToMonth();
  }, [user, month]);

  useEffect(() => {
    setMemoText(monthlyData?.memo || '');
  }, [monthlyData?.memo]);

  /* --- SUMMARY --- */
  const summary = useMemo(() => {
    const fixedCosts = monthlyData?.fixedCosts || [];
    const fixedCash = fixedCosts.filter(f => !f.method || f.method === CASH).reduce((s, i) => s + (Number(i.amount) || 0), 0);
    const fixedCard = fixedCosts.filter(f => f.method && f.method !== CASH).reduce((s, i) => s + (Number(i.amount) || 0), 0);
    const fixedTotal = fixedCash + fixedCard;

    const salary = Number(monthlyData?.salary) || 0;
    const savingsAmount = Number(monthlyData?.savings || 0);
    const cashBudget = Number(monthlyData?.cashBudget) || 0; // 🌟 復活
    const billTotal = Object.values(monthlyData?.cardBills || {}).reduce((s, v) => s + (Number(v) || 0), 0);
    
    const withdrawalOnly = fixedCash + billTotal;

    const normalTx = transactions.filter(t => t.isSpecial !== true);
    const normalLastTx = (lastMonthTransactions || []).filter(t => t.isSpecial !== true);

    const spentCard = normalTx.filter(t => t.paymentMethod !== CASH).reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const spentCash = normalTx.filter(t => t.paymentMethod === CASH).reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const totalSpent = normalTx.reduce((s, t) => s + (Number(t.amount) || 0), 0);
    
    const cardTarget = Number(monthlyData?.budget) > 0 ? Number(monthlyData?.budget) : 100000;
    const cardPacePercent = cardTarget > 0 ? Math.min(100, (spentCard / cardTarget) * 100) : 0;
    
    // 🌟 今月使った現金は引かないように修正
    const currentFreeCash = salary - withdrawalOnly - savingsAmount;

    // 🌟 今の現金残り: 月初の現金 - 使った現金
    const cashRemaining = cashBudget - spentCash;

    const projectedCash = salary - spentCard - fixedTotal - savingsAmount;

    const catTotals = normalTx.reduce((acc, t) => { 
      const cat = t.category || '未分類';
      acc[cat] = (acc[cat] || 0) + (Number(t.amount) || 0); 
      return acc; 
    }, {});
    const catBudgetSum = (config?.categories || []).reduce((sum, c) => sum + (monthlyData?.catBudgets?.[c.name] || 0), 0);
    
    const lastCatTotals = normalLastTx.reduce((acc, t) => { 
      const cat = t.category || '未分類';
      acc[cat] = (acc[cat] || 0) + (Number(t.amount) || 0); 
      return acc; 
    }, {});

    const specialTotalSpent = transactions.filter(t => t.isSpecial === true).reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const lastSpecialTotalSpent = (lastMonthTransactions || []).filter(t => t.isSpecial === true).reduce((s, t) => s + (Number(t.amount) || 0), 0);

    return {
      cardTarget,
      cardPacePercent,
      currentFreeCash,
      cashRemaining, // 🌟 追加
      projectedCash,
      fixedTotal,
      withdrawalOnly: withdrawalOnly || 0,
      catBudgetSum,
      savingsAmount,
      catTotals,
      lastCatTotals,
      totalSpent,
      lastTotalSpent: normalLastTx.reduce((s, t) => s + (Number(t.amount) || 0), 0),
      spentCard, 
      spentCash,
      dailyTotals: normalTx.reduce((acc, t) => { 
        if (!t.date) return acc;
        const dObj = new Date(t.date);
        if (isNaN(dObj.getTime())) return acc;
        const d = dObj.getDate(); 
        acc[d] = (acc[d] || 0) + (Number(t.amount) || 0); 
        return acc; 
      }, {}),
      specialTotalSpent,
      lastSpecialTotalSpent
    };
  }, [monthlyData, transactions, lastMonthTransactions, config]);

  const activeCategories = getCategoryNames().filter(n => (monthlyData.catBudgets?.[n] || 0) > 0 || (summary.catTotals[n] || 0) > 0);

  const aiMessage = useMemo(() => {
    if (summary.totalSpent === 0) return null;
    if (summary.spentCard > summary.cardTarget) {
      return { icon: '🚨', text: `カード利用が目安の ¥${summary.cardTarget.toLocaleString()} を超えました！`, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' };
    }
    if (summary.projectedCash >= 60000) {
      return { icon: '🌟', text: `素晴らしいペースです！来月も大きな黒字が見込めそうです！`, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' };
    }
    return { icon: '💡', text: `現在の${nextMonthNum}月の着地予想は ¥${summary.projectedCash.toLocaleString()} です。`, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' };
  }, [summary, nextMonthNum]);

  const donutChartData = useMemo(() => {
    const total = summary.totalSpent;
    if (total === 0) return { items: [], total: 0 };

    const catTotalsCopy = { ...summary.catTotals };
    const explicitOtherAmount = catTotalsCopy['その他'] || 0;
    delete catTotalsCopy['その他'];

    const arr = Object.entries(catTotalsCopy)
      .map(([name, amount]) => ({ name, amount }))
      .filter(item => item.amount > 0);
    arr.sort((a, b) => b.amount - a.amount);

    let items = [];
    if (arr.length + (explicitOtherAmount > 0 ? 1 : 0) <= 6) {
      items = arr.map((item, idx) => ({ ...item, color: getCategoryColor(idx) }));
      if (explicitOtherAmount > 0) {
        items.push({ name: 'その他', amount: explicitOtherAmount, color: getCategoryColor(items.length) });
      }
    } else {
      const top5 = arr.slice(0, 5);
      const remainingAmount = arr.slice(5).reduce((sum, item) => sum + item.amount, 0);
      const finalOtherAmount = remainingAmount + explicitOtherAmount;
      
      items = top5.map((item, idx) => ({ ...item, color: getCategoryColor(idx) }));
      if (finalOtherAmount > 0) {
        items.push({ name: 'その他', amount: finalOtherAmount, color: getCategoryColor(5) });
      }
    }
    return { items, total };
  }, [summary.totalSpent, summary.catTotals]);

  const activeAlerts = useMemo(() => {
    const today = new Date().getDate();
    return Object.entries(monthlyData?.cardDueDates || {}).filter(([card, day]) => {
      const dueDay = Number(day);
      const isConfirmed = (monthlyData?.confirmedPayments || []).includes(card);
      const hasBill = (Number(monthlyData?.cardBills?.[card]) || 0) > 0;
      return hasBill && !isConfirmed && dueDay >= today && (dueDay - today) <= 7;
    });
  }, [monthlyData]);

  const confirmPayment = async (cardName) => {
    if (!user) return;
    const confirmed = monthlyData?.confirmedPayments || [];
    if (!confirmed.includes(cardName)) {
      await setDoc(doc(db, 'users', user.uid, 'months', month), { confirmedPayments: [...confirmed, cardName] }, { merge: true });
      showToastMsg('支払いを完了しました');
    }
  };

  /* --- TX OPERATIONS --- */
  const resetTxInputs = (dateStr) => {
    setInputDate(dateStr || getTodayString());
    setInputAmount('');
    setInputTitle('');
    setInputCategory(getCategoryNames()[0] || '食費');
    setInputMethod(paymentMethodsSafe[0] || CASH);
    setInputIsSpecial(false);
  };
  const startEditingTx = (t) => {
    setEditingTx(t);
    setInputDate(isoToLocalYMD(t.date));
    setInputAmount(String(t.amount ?? ''));
    setInputTitle(t.title || '');
    setInputCategory(t.category || '食費');
    setInputMethod(t.paymentMethod || CASH);
    setInputIsSpecial(t.isSpecial === true);
    setIsTxModalOpen(true);
  };
  const openTxModalNew = () => { setEditingTx(null); resetTxInputs(); setIsTxModalOpen(true); };
  const openTxModalWithDate = (d) => { setEditingTx(null); resetTxInputs(d); setIsTxModalOpen(true); };
  const applyTemplate = (t) => {
    setInputAmount(String(t.amount));
    setInputTitle(t.title);
    setInputCategory(t.category);
    setInputMethod(t.method);
  };

  const handleTxSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;
    const amount = toNumber(inputAmount);
    if (!inputDate || !amount || !inputTitle) return showToastMsg('入力内容を確認してください');
    const payload = {
      date: toISODateSafe(inputDate),
      amount,
      title: inputTitle,
      category: inputCategory,
      paymentMethod: inputMethod,
      isSpecial: inputIsSpecial,
      updatedAt: serverTimestamp()
    };
    try {
      if (editingTx?.id) {
        await updateDoc(doc(db, 'users', user.uid, 'transactions', editingTx.id), payload);
        showToastMsg('更新しました');
      } else {
        await addDoc(collection(db, 'users', user.uid, 'transactions'), { ...payload, createdAt: serverTimestamp() });
        showToastMsg('追加しました');
      }
      setIsTxModalOpen(false);
    } catch (e) { console.error(e); showToastMsg('エラー'); }
  };
  
  const handleMemoSave = async () => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'users', user.uid, 'months', month), { memo: memoText }, { merge: true });
      showToastMsg('メモを保存しました');
      setIsMemoModalOpen(false);
    } catch (e) {
      console.error(e);
      showToastMsg('メモの保存に失敗しました');
    }
  };

  /* --- SETTINGS OPERATIONS --- */
  const openEdit = (type, data, index) => setEditingItem({ type, data: { ...data }, index });

  const handleSettingsSave = async () => {
    if (!user || !editingItem) return;
    const { type, data, index } = editingItem;
    try {
      if (['salary', 'totalBudget', 'cashBudget', 'savings'].includes(type)) {
        const fieldMap = { salary: 'salary', totalBudget: 'budget', cashBudget: 'cashBudget', savings: 'savings' };
        await setDoc(doc(db, 'users', user.uid, 'months', month), { [fieldMap[type]]: toNumber(data.value) }, { merge: true });
      } else if (type === 'memo') {
        await setDoc(doc(db, 'users', user.uid, 'months', month), { memo: data.memo || '' }, { merge: true });
      } else if (type === 'bill') {
        const newBills = { ...(monthlyData.cardBills || {}), [data.name]: toNumber(data.bill) };
        const newDues = { ...(monthlyData.cardDueDates || {}), [data.name]: data.due };
        await setDoc(doc(db, 'users', user.uid, 'months', month), {
          cardBills: newBills,
          cardDueDates: newDues
        }, { merge: true });
      } else if (type === 'fixed') {
        const list = [...(monthlyData.fixedCosts || [])];
        const item = { ...data, amount: toNumber(data.amount) };
        if (index === -1) list.unshift({ ...item, id: Date.now() }); else list[index] = { ...list[index], ...item };
        await setDoc(doc(db, 'users', user.uid, 'months', month), { fixedCosts: list }, { merge: true });
      } else if (type === 'category') {
        const list = [...(config.categories || [])];
        const item = { name: data.name, icon: data.icon };
        if (index === -1) list.unshift(item); else list[index] = item;
        await setDoc(doc(db, 'users', user.uid, 'settings', 'config'), { ...config, categories: list }, { merge: true });
        if (data.budget !== undefined) {
          const newBudgets = { ...(monthlyData.catBudgets || {}), [data.name]: toNumber(data.budget) };
          await setDoc(doc(db, 'users', user.uid, 'months', month), { catBudgets: newBudgets }, { merge: true });
        }
      } else if (type === 'template') {
        const list = [...(config.templates || [])];
        const item = { ...data, amount: toNumber(data.amount) };
        if (index === -1) list.unshift(item); else list[index] = item;
        await setDoc(doc(db, 'users', user.uid, 'settings', 'config'), { ...config, templates: list }, { merge: true });
      } else if (type === 'payment') {
        const list = [...(config.paymentMethods || [CASH])];
        if (index === -1) list.unshift(data.name); else list[index] = data.name;
        await setDoc(doc(db, 'users', user.uid, 'settings', 'config'), { ...config, paymentMethods: list }, { merge: true });
      }
      setEditingItem(null); showToastMsg('保存しました');
    } catch (e) { console.error(e); showToastMsg('エラー'); }
  };

  const handleDeleteItem = async () => {
    if (!editingItem || !window.confirm('削除しますか？')) return;
    const { type, index, data } = editingItem;
    if (type === 'fixed') {
      const list = (monthlyData.fixedCosts || []).filter((_, i) => i !== index);
      await setDoc(doc(db, 'users', user.uid, 'months', month), { fixedCosts: list }, { merge: true });
    } else if (type === 'category') {
      const list = (config.categories || []).filter((_, i) => i !== index);
      await setDoc(doc(db, 'users', user.uid, 'settings', 'config'), { ...config, categories: list }, { merge: true });
    } else if (type === 'template') {
      const list = (config.templates || []).filter((_, i) => i !== index);
      await setDoc(doc(db, 'users', user.uid, 'settings', 'config'), { ...config, templates: list }, { merge: true });
    } else if (type === 'payment') {
      const list = (config.paymentMethods || []).filter((_, i) => i !== index);
      await setDoc(doc(db, 'users', user.uid, 'settings', 'config'), { ...config, paymentMethods: list }, { merge: true });
    } else if (type === 'bill') {
      const newBills = { ...(monthlyData.cardBills || {}) };
      const newDues = { ...(monthlyData.cardDueDates || {}) };
      delete newBills[data.name];
      delete newDues[data.name];
      await setDoc(doc(db, 'users', user.uid, 'months', month), { cardBills: newBills, cardDueDates: newDues }, { merge: true });
    }
    setEditingItem(null); showToastMsg('削除しました');
  };

  /* --- OTHERS --- */
  const finalFilteredTx = transactions.filter(t => {
    const matchSearch = searchText === '' || String(t.title || '').includes(searchText);
    const matchCat = filter.category === 'ALL' || t.category === filter.category;
    const matchMethod = filter.method === 'ALL' || t.paymentMethod === filter.method;
    const matchSpecial = !filter.special || t.isSpecial === true;
    return matchSearch && matchCat && matchMethod && matchSpecial;
  });

  const filteredCashTotal = useMemo(() => {
    return finalFilteredTx.filter(t => t.paymentMethod === CASH).reduce((s, t) => s + toNumber(t.amount), 0);
  }, [finalFilteredTx]);

  const filteredCardTotal = useMemo(() => {
    return finalFilteredTx.filter(t => t.paymentMethod !== CASH).reduce((s, t) => s + toNumber(t.amount), 0);
  }, [finalFilteredTx]);

  const calendarDaysList = useMemo(() => {
    if (!month) return [];
    const d = new Date(month + "-01");
    if (isNaN(d.getTime())) return [];
    const first = d.getDay();
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    return [...Array(first).fill(null), ...Array.from({ length: last }, (_, i) => i + 1)];
  }, [month]);

  const openCopySettingsModal = () => {
    const d = new Date(month + "-01");
    d.setMonth(d.getMonth() - 1);
    setCopySourceMonth(getMonthString(d));
    setIsCopyModalOpen(true);
  };
  const copySettingsFromSelectedMonth = async () => {
    if (!user || !copySourceMonth) return;
    if (!window.confirm(`${formatMonthJP(copySourceMonth)} の設定を ${formatMonthJP(month)} にコピーしますか？`)) return;
    try {
      const snap = await getDoc(doc(db, 'users', user.uid, 'months', copySourceMonth));
      if (snap.exists()) {
        const d = snap.data();
        await setDoc(doc(db, 'users', user.uid, 'months', month), {
          salary: d.salary || 0, budget: d.budget || 0, cashBudget: d.cashBudget || 0, 
          fixedCosts: d.fixedCosts || [], catBudgets: d.catBudgets || {},
          cardBills: d.cardBills || {}, cardDueDates: d.cardDueDates || {}, savings: d.savings || 0
        }, { merge: true });
        showToastMsg('コピーしました');
        setIsCopyModalOpen(false);
      } else showToastMsg('データがありません');
    } catch (e) { showToastMsg('エラー'); }
  };
  const handleExportCSV = async () => {
    if (!window.confirm('CSV出力しますか？')) return;
    const q = query(collection(db, 'users', user.uid, 'transactions'), orderBy('date', 'desc'));
    const s = await getDocs(q);
    let csv = "\uFEFF日付,タイトル,カテゴリ,金額,支払方法\n";
    s.forEach(d => { const v = d.data(); csv += `${isoToLocalYMD(v.date)},"${v.title}",${v.category},${v.amount},${v.paymentMethod}\n` });
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a'); link.href = url; link.download = `zaimu_${getTodayString()}.csv`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };
  /* --- RENDER --- */
  if (authLoading) return <div className="h-screen bg-[#121212] flex items-center justify-center text-zinc-600 font-black">Loading...</div>;
  if (!user) return (
    <div className="h-screen w-full bg-[#121212] flex flex-col items-center justify-center p-6 space-y-8 animate-in fade-in">
      <div className="text-center">
        <Sparkles size={48} className="text-white mx-auto mb-6" />
        <h1 className="text-4xl font-black text-white">ZAIMU</h1>
      </div>
      <button onClick={() => signInWithPopup(auth, new GoogleAuthProvider())} className="w-full max-w-xs h-16 bg-white text-black rounded-2xl font-black flex items-center justify-center gap-3 shadow-xl active:scale-95 transition-transform">
        <Lock size={20} /> Google Login
      </button>
    </div>
  );

  const SETTING_MENU_ITEMS = [
    { id: 'budget', label: '資金計画・引落日', icon: <Landmark size={20} /> },
    { id: 'fixed', label: '固定費管理', icon: <CreditCard size={20} /> },
    { id: 'category', label: 'カテゴリ予算', icon: <Tags size={20} /> },
    { id: 'template', label: 'テンプレート', icon: <Zap size={20} /> },
    { id: 'payment', label: '支払方法', icon: <Wallet size={20} /> },
    { id: 'faq', label: 'お金の設計図・FAQ', icon: <HelpCircle size={20} /> },
  ];
  const currentSettingTitle = SETTING_MENU_ITEMS.find(item => item.id === settingTab)?.label || '設定';

  return (
    <div className="fixed inset-0 w-full bg-[#121212] text-zinc-200 font-sans flex flex-col justify-center overflow-hidden">
      <Toast message={toast.message} isVisible={toast.visible} />

      <div className="w-full max-w-md h-full flex flex-col relative bg-[#121212] shadow-2xl mx-auto">
        <header className="flex-none h-16 border-b border-white/5 px-4 flex items-center justify-between bg-[#121212]/80 backdrop-blur-xl z-50 relative">
          {activeTab === 'settings' && settingTab !== 'menu' ? (
            <>
              <button onClick={() => setSettingTab('menu')} className="text-zinc-400 p-2"><ArrowLeft size={24} /></button>
              <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center">
                <span className="text-xs font-bold text-white uppercase">{currentSettingTitle}</span>
                {(settingTab === 'fixed' || settingTab === 'category') && (
                  <span className="text-[10px] text-zinc-500 font-mono">計 ¥{(settingTab === 'fixed' ? summary.fixedTotal : summary.catBudgetSum).toLocaleString()}</span>
                )}
              </div>
              <div className="w-10" />
            </>
          ) : (
            <>
              <div className="w-8 h-8 p-1 flex items-center justify-center bg-white/10 rounded-lg text-white"><Sparkles size={16} /></div>
              <div className="flex items-center gap-2 bg-white/5 rounded-full px-1 py-1">
                <button onClick={() => { const d = new Date(month + "-01"); d.setMonth(d.getMonth() - 1); setMonth(getMonthString(d)) }} className="p-2 text-zinc-400 hover:text-white"><ChevronLeft size={18} /></button>
                <span className="text-sm font-black text-white tabular-nums min-w-[100px] text-center">{formatMonthJP(month)}</span>
                <button onClick={() => { const d = new Date(month + "-01"); d.setMonth(d.getMonth() + 1); setMonth(getMonthString(d)) }} className="p-2 text-zinc-400 hover:text-white"><ChevronRight size={18} /></button>
              </div>
              <button onClick={() => setMonth(getMonthString(new Date()))} className="p-2 text-zinc-500 hover:text-white"><Calendar size={20} /></button>
            </>
          )}
        </header>

        <main className="flex-1 relative flex flex-col overflow-hidden">
          
          {/* ✅ ホーム画面 */}
          {activeTab === 'home' && (
            <div className="flex-1 overflow-y-auto scrollbar-hide flex flex-col relative pb-32">
              {monthlyData.memo && (
                <div onClick={() => setIsMemoExpanded(!isMemoExpanded)} className="sticky top-0 bg-zinc-900 border-b border-white/10 px-4 py-3 flex flex-col cursor-pointer transition-all duration-300 z-30 shadow-md">
                  <div className="flex items-start gap-3">
                    <span className="text-sm mt-0.5">📌</span>
                    <div className={`flex-1 text-[13px] text-zinc-300 font-medium leading-relaxed transition-all duration-300 ${isMemoExpanded ? 'whitespace-pre-wrap break-all' : 'truncate block'}`}>
                      {monthlyData.memo}
                    </div>
                    <ChevronDown size={16} className={`text-zinc-500 shrink-0 transition-transform mt-0.5 ${isMemoExpanded ? 'rotate-180' : ''}`} />
                  </div>
                </div>
              )}

              <div className="px-5 space-y-6 pt-6 animate-in fade-in duration-300">
                {aiMessage && (
                  <div className={`p-4 rounded-2xl border ${aiMessage.border} ${aiMessage.bg} flex items-start gap-3 shadow-sm`}>
                    <span className="text-xl shrink-0 mt-0.5">{aiMessage.icon}</span>
                    <span className={`text-[13px] font-bold leading-snug ${aiMessage.color}`}>{aiMessage.text}</span>
                  </div>
                )}

                {/* 🌟 予測とペース確認の完全版UI 🌟 */}
                <div className="space-y-4">
                  <SimpleCard className="p-0">
                    <div className="grid grid-cols-2 divide-x divide-white/5">
                      
                      {/* 左側：今月の利用額とペース */}
                      <div className="p-5 flex flex-col">
                        <div>
                          <div className="flex items-center gap-1.5 mb-2 text-[10px] text-zinc-400 font-black uppercase tracking-wider">
                            <CreditCard size={14} className="shrink-0" />
                            <p className="truncate">今月の利用額</p>
                          </div>
                          <h2 className="text-3xl font-black tracking-tighter text-white mb-3">
                            ¥{summary.totalSpent.toLocaleString()}
                          </h2>
                          <div className="space-y-1.5">
                            <p className="text-[10px] text-zinc-400 font-bold flex items-center gap-1">💳 カード: <span className="text-white">¥{summary.spentCard.toLocaleString()}</span></p>
                            <p className="text-[10px] text-zinc-400 font-bold flex items-center gap-1">💴 現金: <span className="text-white">¥{summary.spentCash.toLocaleString()}</span></p>
                          </div>
                        </div>
                        <div className="mt-6 flex-1 flex flex-col justify-end space-y-1.5">
                          <div className="flex justify-between text-[9px] text-zinc-500 pb-0.5 font-bold">
                            <span>カード目安</span><span className="text-zinc-400">¥{summary.cardTarget.toLocaleString()}</span>
                          </div>
                          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden shrink-0 mt-1">
                            <div className={`h-full transition-all duration-1000 ${summary.spentCard > summary.cardTarget ? 'bg-amber-400' : 'bg-white'}`} style={{ width: `${summary.cardPacePercent}%` }} />
                          </div>
                        </div>
                      </div>
                      
                      {/* 右側：今の現金残りと各予測 🌟 */}
                      <div className="p-5 flex flex-col justify-between gap-5 bg-[#161616]">
                        <div>
                          <div className="flex items-center gap-1.5 mb-1.5 text-[10px] text-zinc-400 font-black uppercase tracking-wider">
                            <Wallet size={14} className="shrink-0" />
                            <p className="truncate">今の現金残り</p>
                          </div>
                          <h2 className={`text-xl font-black tracking-tighter leading-none ${summary.cashRemaining < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                            ¥{summary.cashRemaining.toLocaleString()}
                          </h2>
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 mb-1.5 text-[10px] text-zinc-400 font-black uppercase tracking-wider">
                            <Banknote size={14} className="shrink-0" />
                            <p className="truncate">{currentMonthNum}月の自由な現金</p>
                          </div>
                          <h2 className="text-xl font-black tracking-tighter text-emerald-400 leading-none">
                            ¥{summary.currentFreeCash.toLocaleString()}
                          </h2>
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 mb-1.5 text-[10px] text-zinc-400 font-black uppercase tracking-wider">
                            <Sparkles size={14} className="shrink-0" />
                            <p className="truncate">{nextMonthNum}月の着地予想</p>
                          </div>
                          <h2 className="text-xl font-black tracking-tighter text-white leading-none">
                            ¥{summary.projectedCash.toLocaleString()}
                          </h2>
                        </div>
                      </div>

                    </div>
                  </SimpleCard>
                </div>

                {/* ② カテゴリセクション */}
                <div className="space-y-3">
                  <h3 className="text-[10px] text-zinc-500 uppercase font-black tracking-widest pl-1">カテゴリ別 予算状況</h3>
                  <SimpleCard className="p-0 overflow-hidden">
                    <div className="grid grid-cols-2 gap-px bg-white/5">
                      {activeCategories.map(n => {
                        const c = summary.catTotals[n] || 0;
                        const b = monthlyData.catBudgets?.[n] || 0;
                        const isOver = b > 0 && c > b;
                        const percent = b > 0 ? Math.min(100, (c / b) * 100) : 0;
                        return (
                          <div key={n} className="bg-[#1E1E1E] p-4 flex flex-col justify-center">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-lg shrink-0">{getCategoryIcon(n)}</span>
                              <span className="text-xs font-black text-zinc-200 truncate">{n}</span>
                            </div>
                            <div className="flex items-baseline gap-1 mb-2">
                              <span className={`text-sm font-black leading-none ${isOver ? 'text-red-400' : 'text-white'}`}>¥{c.toLocaleString()}</span>
                              <span className="text-[9px] text-zinc-500 font-bold">/ ¥{b.toLocaleString()}</span>
                            </div>
                            <div className="h-1 bg-white/5 rounded-full overflow-hidden shrink-0 mt-auto">
                              <div className={`h-full transition-all duration-1000 ${isOver ? "bg-red-400" : "bg-white"}`} style={{ width: `${percent}%` }} />
                            </div>
                          </div>
                        );
                      })}
                      {activeCategories.length % 2 !== 0 && (
                        <div className="bg-[#1E1E1E]" />
                      )}
                    </div>
                  </SimpleCard>
                </div>

                {/* ③ 引落アラート */}
                {activeAlerts.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-[10px] text-zinc-500 uppercase font-black tracking-widest pl-1">引落予定</h3>
                    <SimpleCard className="bg-red-500/10 border-red-500/30 p-5">
                      <div className="flex items-center gap-2 text-red-400 mb-3 font-bold text-xs"><Calendar size={16} /> 支払期日が迫っています</div>
                      <div className="space-y-2">
                        {activeAlerts.map(([card, day]) => (
                          <div key={card} className="flex justify-between items-center bg-black/20 p-3 rounded-xl border border-red-500/10">
                            <span className="text-sm font-black text-white">{card} ({day}日)</span>
                            <button onClick={() => confirmPayment(card)} className="text-xs px-4 py-1.5 bg-red-500 text-white rounded-full font-black active:scale-95 transition-transform shadow-lg">完了</button>
                          </div>
                        ))}
                      </div>
                    </SimpleCard>
                  </div>
                )}

                {/* ④ 貯金セクション */}
                <div className="space-y-3">
                  <h3 className="text-[10px] text-zinc-500 uppercase font-black tracking-widest pl-1">積立貯金</h3>
                  <SimpleCard className="p-6">
                    <div className="flex items-end justify-between">
                       <div>
                         <p className="text-[10px] text-zinc-400 font-black uppercase tracking-wider mb-1.5">総額</p>
                         <h3 className="text-3xl font-black text-white tracking-tighter">¥{Number(savingsTotalToMonth || 0).toLocaleString()}</h3>
                       </div>
                       <div className="text-right">
                         <p className="text-[10px] text-zinc-400 font-black uppercase tracking-wider mb-1.5">今月の積立</p>
                         <p className="text-base font-black text-white">+ ¥{summary.savingsAmount.toLocaleString()}</p>
                       </div>
                    </div>
                  </SimpleCard>
                </div>
              </div>
            </div>
          )}

          {/* 🔽 Logタブ */}
          {activeTab === 'log' && (
            <div className="flex-1 flex flex-col h-full pt-4 overflow-hidden animate-in fade-in">
              <div className="flex-none px-5 pb-3 z-10 space-y-4">
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <input type="text" value={searchText} onChange={e => setSearchText(e.target.value)} placeholder="検索..." className="w-full h-12 bg-white/5 border border-white/10 rounded-2xl pl-10 pr-4 text-sm font-bold text-white outline-none focus:border-white/30 transition-colors" />
                    <Search size={16} className="absolute left-4 top-4 text-zinc-500" />
                  </div>
                  <div className="flex bg-[#1E1E1E] rounded-2xl border border-white/10 p-1 shadow-lg">
                    <button onClick={() => setLogView('list')} className={`p-3 rounded-xl transition-colors ${logView === 'list' ? 'bg-white text-black' : 'text-zinc-500 hover:text-white'}`}><AlignJustify size={18} /></button>
                    <button onClick={() => setLogView('calendar')} className={`p-3 rounded-xl transition-colors ${logView === 'calendar' ? 'bg-white text-black' : 'text-zinc-500 hover:text-white'}`}><CalendarDays size={18} /></button>
                  </div>
                </div>

                <div className="flex gap-2 items-center">
                  <div className="relative flex-[1] min-w-0">
                    <select value={filter.category} onChange={e => setFilter({ ...filter, category: e.target.value })} className="w-full h-12 bg-white/5 border border-white/10 rounded-2xl pl-4 pr-8 text-xs font-bold text-white outline-none appearance-none focus:border-white/30 transition-colors">
                      <option value="ALL">すべて</option>
                      {getCategoryNames().map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-[19px] text-zinc-500 pointer-events-none" />
                  </div>
                  <div className="relative flex-[1] min-w-0">
                    <select value={filter.method} onChange={e => setFilter({ ...filter, method: e.target.value })} className="w-full h-12 bg-white/5 border border-white/10 rounded-2xl pl-4 pr-8 text-xs font-bold text-white outline-none appearance-none focus:border-white/30 transition-colors">
                      <option value="ALL">すべて</option>
                      {(config?.paymentMethods || []).map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-[19px] text-zinc-500 pointer-events-none" />
                  </div>
                  <button type="button" onClick={() => setFilter(prev => ({ ...prev, special: !prev.special }))} className={`h-12 px-4 rounded-2xl border text-[10px] font-black tracking-widest shrink-0 transition-colors ${filter.special ? 'bg-white text-black border-white shadow-lg' : 'bg-white/5 text-zinc-400 border-white/10'}`}>特別費</button>
                  <button type="button" onClick={clearLogFilters} className="w-12 h-12 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center hover:bg-white/10 transition-colors shrink-0"><X size={18} className="text-zinc-500" /></button>
                </div>
                
                <div className="flex justify-between items-center px-2 text-[10px] text-zinc-500 font-black tracking-wider uppercase">
                  <span>表示中の合計</span>
                  <div className="flex gap-4">
                    <span>現金: ¥{filteredCashTotal.toLocaleString()}</span>
                    <span>カード: ¥{filteredCardTotal.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="flex-1 px-5 pb-24 overflow-hidden flex flex-col">
                {logView === 'list' ? (
                  <SimpleCard className="flex-1 flex flex-col overflow-hidden p-0">
                    {finalFilteredTx.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-zinc-600">
                        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center border border-white/10"><Sparkles size={24} /></div>
                        <p className="text-xs uppercase font-black tracking-widest">No Records</p>
                      </div>
                    ) : (
                      <div className="flex-1 overflow-y-auto divide-y divide-white/5 scrollbar-hide">
                        {finalFilteredTx.map(t => (
                          <div key={t.id} onClick={() => setViewingTx(t)} className="flex items-center justify-between p-5 cursor-pointer hover:bg-white/5 active:bg-white/10 transition-colors group">
                            <div className="flex items-center gap-4 flex-1 min-w-0">
                              <div className="flex flex-col items-center justify-center w-10 h-10 rounded-xl bg-black/40 border border-white/5 group-hover:border-white/20 transition-colors">
                                <span className="text-[10px] font-black text-zinc-500 leading-none">{formatDateShort(t.date).split('/')[0]}</span>
                                <span className="text-[13px] font-black text-zinc-300 leading-none mt-0.5">{formatDateShort(t.date).split('/')[1]}</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="truncate text-[15px] font-black text-white mb-1">{t.title}</div>
                                <div className="flex items-center gap-2">
                                  <div className={`text-[10px] px-2 py-0.5 rounded-md font-bold truncate ${t.isSpecial === true ? 'border border-blue-500/30 text-blue-400 bg-blue-500/10' : 'bg-white/10 text-zinc-400'}`}>
                                    {t.category}
                                  </div>
                                  <span className="text-[10px] font-bold text-zinc-600">•</span>
                                  <span className="text-[10px] font-bold text-zinc-500">{t.paymentMethod}</span>
                                </div>
                              </div>
                            </div>
                            <span className="text-base font-black tabular-nums text-white pl-4">¥{Number(t.amount || 0).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </SimpleCard>
                ) : (
                  <SimpleCard className="flex-1 flex flex-col overflow-hidden p-5">
                    <div className="flex-none grid grid-cols-7 gap-2 text-center mb-4 text-[10px] text-zinc-600 font-black uppercase">
                      {['日', '月', '火', '水', '木', '金', '土'].map(d => <div key={d}>{d}</div>)}
                    </div>
                    <div className="flex-1 overflow-y-auto scrollbar-hide">
                      <div className="grid grid-cols-7 gap-2 pb-2">
                        {calendarDaysList.map((day, i) => {
                          if (!day) return <div key={i} />;
                          const a = summary.dailyTotals[day] || 0;
                          const isT = day === new Date().getDate() && month === getMonthString(new Date());
                          return (
                            <div key={i} onClick={() => openTxModalWithDate(`${month}-${String(day).padStart(2, '0')}`)} className={`aspect-square rounded-2xl border flex flex-col items-center justify-center relative transition-transform hover:scale-105 active:scale-95 cursor-pointer ${isT ? 'border-white bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.3)]' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}>
                              <span className={`text-xs font-black ${isT ? 'text-black' : 'text-zinc-400'}`}>{day}</span>
                              {a > 0 && <span className={`text-[9px] font-black tabular-nums mt-1 ${isT ? 'text-black/60' : 'text-emerald-400'}`}>¥{(a / 1000).toFixed(0)}k</span>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </SimpleCard>
                )}
              </div>
            </div>
          )}

          {/* ✅ Analysis タブ */}
          {activeTab === 'analysis' && (
            <div className="flex-1 overflow-y-auto scrollbar-hide px-5 pt-6 pb-32 space-y-8 animate-in fade-in">
              <SimpleCard className="p-0 overflow-hidden">
                 <div className="p-6 flex flex-col gap-6">
                   <div className="flex justify-between items-start">
                     <div>
                       <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mb-1.5">総支出</p>
                       <h3 className="text-4xl font-black text-white tracking-tighter">¥{summary.totalSpent.toLocaleString()}</h3>
                     </div>
                     <div className={`flex items-center gap-1 px-3 py-1.5 rounded-xl border text-[10px] font-black ${summary.totalSpent <= summary.lastTotalSpent ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                       {summary.totalSpent <= summary.lastTotalSpent ? <TrendingDown size={14} /> : <TrendingUp size={14} />}
                       先月比 {summary.totalSpent <= summary.lastTotalSpent ? '-' : '+'}¥{Math.abs(summary.totalSpent - summary.lastTotalSpent).toLocaleString()}
                     </div>
                   </div>

                   {donutChartData.total > 0 ? (
                     <div className="space-y-4">
                       <div className="flex w-full h-4 rounded-full overflow-hidden gap-[2px]">
                         {donutChartData.items.map(item => (
                           <div key={item.name} className="h-full transition-all duration-1000" style={{ width: `${(item.amount / donutChartData.total) * 100}%`, backgroundColor: item.color }} />
                         ))}
                       </div>
                       <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                         {donutChartData.items.map(item => (
                           <div key={item.name} className="flex items-center gap-3">
                             <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                             <span className="text-[11px] text-zinc-300 font-bold truncate flex-1">{item.name}</span>
                             <span className="text-xs font-black text-white tabular-nums">¥{item.amount.toLocaleString()}</span>
                           </div>
                         ))}
                       </div>
                     </div>
                   ) : (
                     <div className="text-center py-8 text-xs text-zinc-500 font-black tracking-widest uppercase">No Data Available</div>
                   )}
                 </div>
              </SimpleCard>

              {summary.specialTotalSpent > 0 && (
                <SimpleCard className="p-6">
                  <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mb-2">特別費（別枠）</p>
                  <div className="flex items-end gap-3">
                    <span className="text-2xl font-black text-white tabular-nums">¥{summary.specialTotalSpent.toLocaleString()}</span>
                    <span className="text-xs text-zinc-500 font-bold mb-1">/ 先月 ¥{summary.lastSpecialTotalSpent.toLocaleString()}</span>
                  </div>
                </SimpleCard>
              )}

              <div className="space-y-3">
                <h3 className="text-[10px] text-zinc-500 uppercase font-black tracking-widest pl-1">Category Comparison</h3>
                <SimpleCard className="p-0 overflow-hidden">
                  <div className="grid grid-cols-2 gap-px bg-white/5">
                    {activeCategories.map(n => {
                      const c = summary.catTotals[n] || 0;
                      const l = summary.lastCatTotals[n] || 0;
                      const b = monthlyData.catBudgets?.[n] || 0;
                      if (b === 0 && c === 0) return null;
                      const isOver = b > 0 && c > b;
                      const percent = b > 0 ? Math.min(100, (c / b) * 100) : 0;
                      return (
                        <div key={n} className="bg-[#1E1E1E] p-4 flex flex-col justify-between">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2 min-w-0 pr-1">
                              <span className="text-lg shrink-0">{getCategoryIcon(n)}</span>
                              <span className="text-[11px] font-black text-zinc-200 truncate">{n}</span>
                            </div>
                            <div className="text-[9px] text-zinc-500 font-bold shrink-0 mt-1">先月 ¥{l.toLocaleString()}</div>
                          </div>
                          <div className="flex items-baseline gap-1 mb-2">
                            <span className={`text-sm font-black leading-none ${isOver ? 'text-red-400' : 'text-white'}`}>¥{c.toLocaleString()}</span>
                            <span className="text-[9px] text-zinc-500 font-bold">/ ¥{b.toLocaleString()}</span>
                          </div>
                          <div className="h-1 bg-white/5 rounded-full overflow-hidden shrink-0 mt-auto">
                            <div className={`h-full transition-all duration-1000 ${isOver ? "bg-red-400" : "bg-white"}`} style={{ width: `${percent}%` }} />
                          </div>
                        </div>
                      );
                    })}
                    {activeCategories.length % 2 !== 0 && <div className="bg-[#1E1E1E]" />}
                  </div>
                </SimpleCard>
              </div>
            </div>
          )}

          {/* ✅ Settings タブ */}
          {activeTab === 'settings' && (
            <div className="flex-1 overflow-y-auto scrollbar-hide px-5 pt-6 pb-32 animate-in fade-in">
              {settingTab === 'menu' ? (
                <div className="space-y-8 pb-10">
                  <div className="flex items-center justify-between p-6 bg-[#1E1E1E] border border-white/5 rounded-[2rem] shadow-xl">
                    <div className="flex items-center gap-4">
                      {user.photoURL ? <img src={user.photoURL} referrerPolicy="no-referrer" alt="icon" className="w-12 h-12 rounded-2xl border border-white/10 shadow-lg" /> : <div className="w-12 h-12 rounded-2xl bg-zinc-800 flex items-center justify-center shadow-lg"><User size={20} className="text-zinc-400" /></div>}
                      <div>
                        <div className="text-sm font-black text-white">{user.displayName || 'User'}</div>
                        <div className="text-[10px] font-bold text-zinc-500 tracking-wider mt-0.5">{user.email}</div>
                      </div>
                    </div>
                    <button onClick={() => { if (window.confirm('Logout?')) signOut(auth); }} className="w-10 h-10 bg-red-500/10 text-red-400 rounded-xl flex items-center justify-center hover:bg-red-500/20 transition-colors"><LogOut size={16} /></button>
                  </div>
                  
                  <div className="space-y-3">
                    <h3 className="text-[10px] text-zinc-500 uppercase font-black tracking-widest pl-2">Preferences</h3>
                    <SimpleCard className="divide-y divide-white/5 p-0">
                      {SETTING_MENU_ITEMS.map(item => (
                        <SettingsRow key={item.id} onClick={() => setSettingTab(item.id)} left={<div className="flex items-center gap-4 text-zinc-300">{item.icon}<span className="text-sm font-black text-white">{item.label}</span></div>} showChevron={true} />
                      ))}
                    </SimpleCard>
                  </div>

                  <div className="flex flex-col items-center gap-5 pt-6">
                    <button onClick={openCopySettingsModal} className="w-full h-16 bg-white/5 border border-white/10 text-white rounded-2xl text-xs font-black hover:bg-white/10 transition-all flex items-center justify-center gap-2"><CopyCheck size={18} /> 先月の設定をコピー</button>
                    <button onClick={handleExportCSV} className="text-zinc-500 hover:text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-colors"><FileText size={14} /> Export CSV Data</button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* 🌟 FAQ / お金の設計図 タブ 🌟 */}
                  {settingTab === 'faq' && (
                      <div className="space-y-6 animate-in slide-in-from-right-2">
                          <div className="relative">
                              <input type="text" value={faqSearchText} onChange={(e) => setFaqSearchText(e.target.value)} placeholder="キーワードで検索..." className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 text-sm font-bold text-white outline-none focus:border-white/30 transition-colors" />
                              <Search size={18} className="absolute left-4 top-4 text-zinc-500" />
                              {faqSearchText && <button onClick={() => setFaqSearchText('')} className="absolute right-4 top-4 text-zinc-500 hover:text-white transition-colors"><X size={18} /></button>}
                          </div>
                          <div className="space-y-6">
                              {filteredFaqData.length > 0 ? (
                                  filteredFaqData.map((section, sIdx) => (
                                      <div key={sIdx} className="space-y-3">
                                          <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest pl-2">{section.category}</h3>
                                          <SimpleCard className="divide-y divide-white/5 p-0">
                                              {section.items.map((item, idx) => (
                                                  <div key={idx} className="p-5 cursor-pointer hover:bg-white/5 transition-colors" onClick={() => setExpandedFaq(expandedFaq === `${sIdx}-${idx}` ? null : `${sIdx}-${idx}`)}>
                                                      <div className="flex justify-between items-start gap-4">
                                                          <div className="flex items-start gap-3"><HelpCircle size={20} className="text-zinc-600 mt-0.5 shrink-0" /><span className="text-[13px] font-black text-white leading-snug">{item.q}</span></div>
                                                          <ChevronDown size={18} className={`text-zinc-600 transition-transform shrink-0 ${expandedFaq === `${sIdx}-${idx}` ? 'rotate-180' : ''}`} />
                                                      </div>
                                                      {expandedFaq === `${sIdx}-${idx}` && <div className="mt-4 pt-4 border-t border-white/5 pl-8 text-[11px] font-medium text-zinc-400 leading-relaxed whitespace-pre-wrap">{item.a}</div>}
                                                  </div>
                                              ))}
                                          </SimpleCard>
                                      </div>
                                  ))
                              ) : <div className="text-center py-12 text-zinc-500 text-xs font-black uppercase tracking-widest">No Results Found</div>}
                          </div>
                      </div>
                  )}

                  {/* Settings: Budget */}
                  {settingTab === 'budget' && (
                    <div className="space-y-6 animate-in slide-in-from-right-2">
                      <div className="space-y-3">
                        <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest pl-2">資金計画</h3>
                        <SimpleCard className="divide-y divide-white/5 p-0">
                          <SettingsRow onClick={() => openEdit('salary', { value: monthlyData.salary }, 0)} left="手取り給与" right={`¥${Number(monthlyData.salary || 0).toLocaleString()}`} />
                          <SettingsRow onClick={() => openEdit('totalBudget', { value: monthlyData.budget }, 0)} left="クレジットカード利用目安" right={`¥${Number(monthlyData.budget || 0).toLocaleString()}`} />
                          <SettingsRow onClick={() => openEdit('cashBudget', { value: monthlyData.cashBudget }, 0)} left="月初のスタート現金" right={`¥${Number(monthlyData.cashBudget || 0).toLocaleString()}`} />
                          <SettingsRow onClick={() => openEdit('savings', { value: monthlyData.savings }, 0)} left="今月の積立額" right={`¥${Number(monthlyData.savings || 0).toLocaleString()}`} />
                          <SettingsRow onClick={() => openEdit('memo', { memo: monthlyData.memo }, 0)} left="今月のメモ" right={<span className="truncate max-w-[100px]">{monthlyData.memo ? '設定済み' : '未設定'}</span>} />
                        </SimpleCard>
                      </div>
                      <div className="space-y-3">
                        <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest pl-2">引落予定のカード</h3>
                        <SimpleCard className="divide-y divide-white/5 p-0">
                          {(config?.paymentMethods || []).filter(m => m !== CASH).map(m => (
                            <SettingsRow
                              key={m}
                              onClick={() => openEdit('bill', { name: m, bill: monthlyData.cardBills?.[m] ?? 0, due: monthlyData.cardDueDates?.[m] ?? '' }, 0)}
                              left={m}
                              right={`¥${Number(monthlyData.cardBills?.[m] || 0).toLocaleString()} (${monthlyData.cardDueDates?.[m] || '-'}日)`}
                            />
                          ))}
                        </SimpleCard>
                      </div>
                    </div>
                  )}

                  {/* Settings: Fixed Costs */}
                  {settingTab === 'fixed' && (
                    <div className="space-y-4 animate-in slide-in-from-right-2">
                      <button type="button" onClick={() => openEdit('fixed', { name: '', amount: '', method: CASH }, -1)} className="w-full h-16 bg-white text-black rounded-2xl text-xs font-black tracking-widest uppercase flex items-center justify-center gap-2 shadow-xl active:scale-[0.98] transition-all"><Plus size={18} /> 固定費を追加</button>
                      <SimpleCard className="divide-y divide-white/5 p-0">
                        {(monthlyData.fixedCosts || []).map((f, idx) => (
                          <SettingsRow key={f.id || idx} onClick={() => openEdit('fixed', f, idx)} left={<div className="flex items-center gap-3 min-w-0"><span className="text-[10px] px-2 py-1 rounded-md bg-white/10 text-white font-bold shrink-0">{f.method || '未設定'}</span><span className="text-sm font-black text-white truncate">{f.name}</span></div>} right={`¥${Number(f.amount || 0).toLocaleString()}`} />
                        ))}
                      </SimpleCard>
                    </div>
                  )}

                  {/* Settings: Categories */}
                  {settingTab === 'category' && (
                    <div className="space-y-4 animate-in slide-in-from-right-2">
                      <button type="button" onClick={() => openEdit('category', { name: '', icon: '🏷', budget: '' }, -1)} className="w-full h-16 bg-white text-black rounded-2xl text-xs font-black tracking-widest uppercase flex items-center justify-center gap-2 shadow-xl active:scale-[0.98] transition-all"><Plus size={18} /> カテゴリを追加</button>
                      <SimpleCard className="divide-y divide-white/5 p-0">
                        {(config?.categories || []).map((c, idx) => {
                          const b = monthlyData.catBudgets?.[c.name] || 0;
                          return <SettingsRow key={c.name} onClick={() => openEdit('category', { ...c, budget: b }, idx)} left={<div className="flex items-center gap-3"><span className="text-xl w-8 text-center">{c.icon || '🏷'}</span><span className="text-sm font-black text-white">{c.name}</span></div>} right={`¥${Number(b).toLocaleString()}`} />
                        })}
                      </SimpleCard>
                    </div>
                  )}

                  {/* Settings: Templates */}
                  {settingTab === 'template' && (
                    <div className="space-y-4 animate-in slide-in-from-right-2">
                      <button type="button" onClick={() => openEdit('template', { title: '', amount: '', category: getCategoryNames()[0] || '食費', method: config?.paymentMethods?.[0] || '現金' }, -1)} className="w-full h-16 bg-white text-black rounded-2xl text-xs font-black tracking-widest uppercase flex items-center justify-center gap-2 shadow-xl active:scale-[0.98] transition-all"><Plus size={18} /> テンプレートを追加</button>
                      <SimpleCard className="divide-y divide-white/5 p-0">
                        {(config?.templates || []).map((t, idx) => (
                          <SettingsRow key={idx} onClick={() => openEdit('template', t, idx)} left={<div className="flex flex-col items-start gap-1 min-w-0"><span className="text-sm font-black text-white truncate">{t.title}</span><span className="text-[10px] font-bold text-zinc-500">{t.category} • {t.method}</span></div>} right={`¥${Number(t.amount || 0).toLocaleString()}`} />
                        ))}
                      </SimpleCard>
                    </div>
                  )}

                  {/* Settings: Payment Methods */}
                  {settingTab === 'payment' && (
                    <div className="space-y-4 animate-in slide-in-from-right-2">
                      <button type="button" onClick={() => openEdit('payment', { name: '' }, -1)} className="w-full h-16 bg-white text-black rounded-2xl text-xs font-black tracking-widest uppercase flex items-center justify-center gap-2 shadow-xl active:scale-[0.98] transition-all"><Plus size={18} /> 支払方法を追加</button>
                      <SimpleCard className="divide-y divide-white/5 p-0">
                        {(config?.paymentMethods || []).map((m, idx) => (
                          <SettingsRow key={m} onClick={() => openEdit('payment', { name: m }, idx)} left={<span className="text-sm font-black text-white">{m}</span>} right={null} />
                        ))}
                      </SimpleCard>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </main>

        <footer className="fixed bottom-0 left-0 right-0 z-50 bg-[#121212]/90 backdrop-blur-2xl border-t border-white/5 h-24 flex items-center justify-around px-6 pb-6 pt-2">
          <NavButton active={activeTab === 'home'} onClick={() => setActiveTab('home')} icon={<Home size={24} />} />
          <NavButton active={activeTab === 'log'} onClick={() => setActiveTab('log')} icon={<History size={24} />} />
          <button onClick={openTxModalNew} className="w-16 h-16 bg-white text-black rounded-[1.75rem] flex items-center justify-center ml-2 shadow-[0_20px_50px_rgba(255,255,255,0.2)] active:scale-90 transition-transform"><Plus size={32} /></button>
          <NavButton active={activeTab === 'analysis'} onClick={() => setActiveTab('analysis')} icon={<BarChart3 size={24} />} />
          <NavButton active={activeTab === 'settings'} onClick={() => { setActiveTab('settings'); setSettingTab('menu') }} icon={<Settings size={24} />} />
        </footer>
      </div>

      {/* MODALS */}
      {viewingTx && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200" onClick={() => setViewingTx(null)}>
          <div className="w-full sm:max-w-md bg-[#1E1E1E] rounded-t-[2.5rem] sm:rounded-[2.5rem] border border-white/10 shadow-2xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex-none p-6 border-b border-white/5 flex justify-between items-center">
              <h2 className="text-sm font-black uppercase text-white tracking-widest">支出の詳細</h2><button type="button" onClick={() => setViewingTx(null)} className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 text-zinc-400 hover:text-white transition-colors"><X size={20} /></button>
            </div>
            <div className="p-8 pb-32 space-y-8 overflow-y-auto">
              <div className="flex flex-col items-center justify-center space-y-4 mt-2">
                <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10"><span className="text-xl">{getCategoryIcon(viewingTx.category)}</span><span className="text-sm font-black text-white">{viewingTx.category}</span></div>
                <h3 className="text-5xl font-black text-white tracking-tighter">¥{Number(viewingTx.amount).toLocaleString()}</h3>
              </div>
              <div className="bg-black/40 rounded-2xl border border-white/5 divide-y divide-white/5">
                <div className="p-5 flex justify-between items-center"><span className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">内容</span><span className="text-sm font-black text-white">{viewingTx.title}</span></div>
                <div className="p-5 flex justify-between items-center"><span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">日付</span><span className="text-sm font-black text-white">{formatFullDateJP(viewingTx.date)}</span></div>
                <div className="p-5 flex justify-between items-center"><span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">支払方法</span><span className="text-sm font-black text-white">{viewingTx.paymentMethod}</span></div>
                {viewingTx.isSpecial && <div className="p-5 flex justify-between items-center"><span className="text-[10px] text-blue-500 font-black uppercase tracking-widest">特別費</span><span className="text-sm font-black text-blue-400">該当する</span></div>}
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={async () => { if (window.confirm('この支出を削除しますか？')) { await deleteDoc(doc(db, 'users', user.uid, 'transactions', viewingTx.id)); setViewingTx(null); showToastMsg('削除しました'); } }} className="w-16 h-16 bg-red-500/10 text-red-500 font-black rounded-2xl flex items-center justify-center active:scale-95 transition-transform"><Trash2 size={24} /></button>
                <button type="button" onClick={() => { const tx = viewingTx; setViewingTx(null); startEditingTx(tx); }} className="flex-1 h-16 bg-white text-black font-black rounded-2xl text-sm shadow-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"><Pencil size={18} /> 編集する</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCalculator && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-6 bg-black/95 backdrop-blur-xl animate-in zoom-in-95 duration-200" onClick={() => setShowCalculator(false)}>
          <div className="w-full max-w-xs" onClick={e => e.stopPropagation()}>
            <CalculatorPad initialValue={calcInitialValue} onConfirm={(val) => { if (calcOnConfirm) calcOnConfirm(val); setShowCalculator(false); }} />
          </div>
        </div>
      )}

      {isMemoModalOpen && (
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center sm:p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200" onClick={() => setIsMemoModalOpen(false)}>
          <div className="w-full sm:max-w-md bg-[#1E1E1E] rounded-t-[2.5rem] sm:rounded-[2.5rem] border border-white/10 shadow-2xl flex flex-col p-8" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6"><h2 className="text-xl font-black text-white tracking-tighter">月次メモ</h2><button type="button" onClick={() => setIsMemoModalOpen(false)} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-zinc-400"><X size={20} /></button></div>
            <div className="flex flex-col gap-6">
              <div className="w-full bg-black/40 border border-white/5 rounded-2xl p-4"><textarea value={memoText} onChange={(e) => setMemoText(e.target.value)} placeholder="今月のやりくりや、特別費の理由などをメモしておけます。" className="w-full h-40 bg-transparent text-white font-medium text-sm outline-none resize-none leading-relaxed" autoFocus /></div>
              <button type="button" onClick={handleMemoSave} className="w-full h-16 bg-white text-black font-black rounded-2xl text-sm shadow-xl active:scale-[0.98] transition-transform">保存する</button>
            </div>
          </div>
        </div>
      )}

      {isCopyModalOpen && (
        <div className="fixed inset-0 z-[65] flex items-end sm:items-center justify-center sm:p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200" onClick={() => setIsCopyModalOpen(false)}>
          <div className="w-full sm:max-w-md bg-[#1E1E1E] rounded-t-[2.5rem] sm:rounded-[2.5rem] border border-white/10 shadow-2xl overflow-hidden p-8" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-8"><h2 className="text-xl font-black text-white tracking-tighter">設定をコピー</h2><button type="button" onClick={() => setIsCopyModalOpen(false)} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-zinc-400"><X size={20} /></button></div>
            <div className="space-y-6">
              <div className="space-y-3">
                <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest pl-1">Copy Source Month</label>
                <input type="month" value={copySourceMonth} onChange={e => setCopySourceMonth(e.target.value)} className="w-full h-16 bg-white/5 border border-white/10 rounded-2xl px-5 text-sm font-black text-white outline-none focus:border-white/30 transition-all" />
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setIsCopyModalOpen(false)} className="flex-1 h-16 bg-white/5 text-zinc-300 rounded-2xl font-black text-sm active:bg-white/10 transition-colors">キャンセル</button>
                <button type="button" onClick={copySettingsFromSelectedMonth} className="flex-1 h-16 bg-white text-black rounded-2xl font-black text-sm shadow-xl active:scale-[0.98] transition-transform">実行する</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isTxModalOpen && (
        <div className="fixed inset-0 z-[65] flex items-end sm:items-center justify-center sm:p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200" onClick={() => setIsTxModalOpen(false)}>
          <div className="w-full max-h-[95vh] sm:max-w-md bg-[#1E1E1E] rounded-t-[2.5rem] sm:rounded-[2.5rem] border border-white/10 shadow-2xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex-none p-6 border-b border-white/5 flex justify-between items-center">
              <h2 className="text-xl font-black text-white tracking-tighter">{editingTx ? '支出を編集' : '支出を入力'}</h2><button type="button" onClick={() => setIsTxModalOpen(false)} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 pb-32">
              <form onSubmit={handleTxSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Amount</label>
                  <div className="flex gap-3">
                    <div className="flex-1 flex items-center bg-white/5 border border-white/5 rounded-2xl h-16 px-5 focus-within:border-white/20 transition-colors">
                      <span className="text-xl font-black text-zinc-500 mr-3">¥</span>
                      <input type="text" inputMode="decimal" value={inputAmount ? Number(inputAmount).toLocaleString() : ''} onChange={e => { const v = e.target.value.replace(/,/g, ''); if (!isNaN(v)) setInputAmount(v) }} className="flex-1 w-full bg-transparent text-2xl font-black text-white outline-none tabular-nums" autoFocus required />
                    </div>
                    <button type="button" onClick={() => openCalculator(inputAmount, (val) => setInputAmount(String(val)))} className="w-16 h-16 bg-white/5 border border-white/5 rounded-2xl flex items-center justify-center text-zinc-400 active:bg-white/10 transition-colors"><Calculator size={24} /></button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Description</label>
                  <input type="text" value={inputTitle} onChange={e => setInputTitle(e.target.value)} className="w-full h-16 bg-white/5 border border-white/5 rounded-2xl px-5 text-sm font-black text-white outline-none focus:border-white/20 transition-colors" placeholder="例: スーパーでお買い物" required />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2 relative">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Category</label>
                    <select value={inputCategory} onChange={e => setInputCategory(e.target.value)} className="w-full h-16 bg-white/5 border border-white/5 rounded-2xl px-5 text-sm font-black text-white outline-none appearance-none focus:border-white/20 transition-colors">
                      {getCategoryNames().map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <ChevronDown size={16} className="absolute right-4 top-[42px] text-zinc-500 pointer-events-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Date</label>
                    <input type="date" value={inputDate} onChange={e => setInputDate(e.target.value)} className="w-full h-16 bg-white/5 border border-white/5 rounded-2xl px-4 text-sm font-black text-white outline-none focus:border-white/20 transition-colors" required />
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Payment Method</label>
                  <div className="grid grid-cols-2 gap-3">
                    {paymentMethodsSafe.slice(0, 4).map(m => (
                      <button key={m} type="button" onClick={() => setInputMethod(m)} className={`h-14 rounded-xl text-xs font-black transition-all ${inputMethod === m ? 'bg-white text-black shadow-lg' : 'bg-[#1E1E1E] text-zinc-400 border border-white/5'}`}>{m}</button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-[#1E1E1E] rounded-2xl border border-white/5 mt-4">
                  <span className="text-[11px] font-black text-zinc-300 ml-1">特別費として記録する</span>
                  <button type="button" onClick={() => setInputIsSpecial(prev => !prev)} className={`w-12 h-7 rounded-full relative transition-colors ${inputIsSpecial ? 'bg-blue-500' : 'bg-black/50 border border-white/10'}`}>
                    <div className={`absolute top-1 w-5 h-5 rounded-full transition-transform ${inputIsSpecial ? 'translate-x-[22px] bg-white' : 'translate-x-1 bg-zinc-500'}`} />
                  </button>
                </div>

                {!editingTx && config.templates.length > 0 && (
                  <div className="space-y-3 pt-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Quick Templates</label>
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                      {config.templates.map((t, idx) => (
                        <button key={idx} type="button" onClick={() => applyTemplate(t)} className="shrink-0 px-4 py-3 bg-[#1E1E1E] border border-white/5 rounded-xl text-[11px] font-black text-zinc-300 hover:text-white hover:bg-white/5 transition-all flex items-center gap-1.5">
                          <Zap size={12} className="text-yellow-400" /> {t.title}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-6 mt-4 flex gap-4 border-t border-white/5">
                  <button type="submit" className="w-full h-16 bg-white text-black font-black rounded-2xl text-sm shadow-xl active:scale-[0.98] transition-transform">保存する</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {editingItem && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200" onClick={() => setEditingItem(null)}>
          <div className="w-full max-h-[90vh] sm:h-auto sm:max-w-md bg-[#1E1E1E] rounded-t-[2.5rem] sm:rounded-[2.5rem] border border-white/10 shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-white/5 flex justify-between items-center">
              <h2 className="text-xl font-black text-white tracking-tighter">編集する</h2><button type="button" onClick={() => setEditingItem(null)} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"><X size={20} /></button>
            </div>
            <div className="p-8 pb-32 space-y-6 overflow-y-auto">

              {['salary', 'totalBudget', 'cashBudget', 'savings'].includes(editingItem.type) && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">
                    {editingItem.type === 'salary' ? '手取り給与' : editingItem.type === 'totalBudget' ? 'クレカ利用目安' : editingItem.type === 'savings' ? '今月の積立額' : '月初のスタート現金'}
                  </label>
                  <div className="flex gap-3">
                    <div className="flex-1 flex items-center bg-white/5 border border-white/5 rounded-2xl h-16 px-5 focus-within:border-white/20 transition-colors">
                      <span className="text-xl font-black text-zinc-500 mr-3">¥</span>
                      <input type="text" inputMode="decimal" value={String(editingItem.data.value ?? '')} onChange={e => setEditingItem({ ...editingItem, data: { value: e.target.value } })} className="flex-1 w-full bg-transparent text-2xl font-black text-white outline-none tabular-nums" autoFocus />
                    </div>
                    <button type="button" onClick={() => openCalculator(editingItem.data.value ?? 0, (val) => setEditingItem(prev => ({ ...prev, data: { value: String(val) } })))} className="w-16 h-16 bg-white/5 border border-white/5 rounded-2xl flex items-center justify-center text-zinc-400 active:bg-white/10 transition-colors"><Calculator size={24} /></button>
                  </div>
                </div>
              )}

              {editingItem.type === 'memo' && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">今月のメモ</label>
                  <div className="w-full bg-black/40 border border-white/5 rounded-2xl p-4">
                    <textarea value={editingItem.data.memo || ''} onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, memo: e.target.value } })} className="w-full h-40 bg-transparent text-white font-medium text-sm outline-none resize-none leading-relaxed" autoFocus />
                  </div>
                </div>
              )}

              {editingItem.type === 'bill' && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 p-4 bg-white/5 rounded-2xl border border-white/5">
                    <CreditCard size={20} className="text-zinc-500" />
                    <span className="text-base font-black text-white">{editingItem.data.name}</span>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">引落予定額</label>
                    <div className="flex gap-3">
                      <div className="flex-1 flex items-center bg-white/5 border border-white/5 rounded-2xl h-16 px-5 focus-within:border-white/20 transition-colors">
                        <span className="text-xl font-black text-zinc-500 mr-3">¥</span>
                        <input type="text" inputMode="decimal" value={String(editingItem.data.bill ?? '')} onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, bill: e.target.value } })} className="flex-1 w-full bg-transparent text-2xl font-black text-white outline-none tabular-nums" autoFocus />
                      </div>
                      <button type="button" onClick={() => openCalculator(editingItem.data.bill ?? 0, (val) => setEditingItem(prev => ({ ...prev, data: { ...prev.data, bill: String(val) } })))} className="w-16 h-16 bg-white/5 border border-white/5 rounded-2xl flex items-center justify-center text-zinc-400 active:bg-white/10 transition-colors"><Calculator size={24} /></button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">引落日</label>
                    <div className="flex items-center bg-white/5 border border-white/5 rounded-2xl h-16 px-5 focus-within:border-white/20 transition-colors w-1/2">
                      <input type="number" value={String(editingItem.data.due ?? '')} onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, due: e.target.value } })} className="w-full bg-transparent text-xl font-black text-white outline-none tabular-nums" />
                      <span className="text-zinc-500 font-black text-sm ml-2">日</span>
                    </div>
                  </div>
                </div>
              )}

              {editingItem.type === 'category' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-4 gap-3">
                    <div className="space-y-2 col-span-1">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Icon</label>
                      <input value={editingItem.data.icon || ''} onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, icon: e.target.value } })} className="w-full h-16 bg-white/5 border border-white/5 rounded-2xl text-center text-2xl outline-none focus:border-white/20 transition-colors" />
                    </div>
                    <div className="space-y-2 col-span-3">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Name</label>
                      <input value={editingItem.data.name || ''} onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, name: e.target.value } })} className="w-full h-16 bg-white/5 border border-white/5 rounded-2xl px-5 text-sm font-black text-white outline-none focus:border-white/20 transition-colors" autoFocus />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Monthly Budget</label>
                    <div className="flex gap-3">
                      <div className="flex-1 flex items-center bg-white/5 border border-white/5 rounded-2xl h-16 px-5 focus-within:border-white/20 transition-colors">
                        <span className="text-xl font-black text-zinc-500 mr-3">¥</span>
                        <input type="text" inputMode="decimal" value={editingItem.data.budget ? Number(editingItem.data.budget).toLocaleString() : ''} onChange={e => { const v = e.target.value.replace(/,/g, ''); if (!isNaN(v)) setEditingItem({ ...editingItem, data: { ...editingItem.data, budget: v } }) }} className="flex-1 w-full bg-transparent text-2xl font-black text-white outline-none tabular-nums" placeholder="0" />
                      </div>
                      <button type="button" onClick={() => openCalculator(editingItem.data.budget ?? 0, (val) => setEditingItem(prev => ({ ...prev, data: { ...prev.data, budget: String(val) } })))} className="w-16 h-16 bg-white/5 border border-white/5 rounded-2xl flex items-center justify-center text-zinc-400 active:bg-white/10 transition-colors"><Calculator size={24} /></button>
                    </div>
                  </div>
                </div>
              )}

              {editingItem.type === 'fixed' && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Description</label>
                    <input value={editingItem.data.name || ''} onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, name: e.target.value } })} className="w-full h-16 bg-white/5 border border-white/5 rounded-2xl px-5 text-sm font-black text-white outline-none focus:border-white/20 transition-colors" autoFocus />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Amount</label>
                    <div className="flex gap-3">
                      <div className="flex-1 flex items-center bg-white/5 border border-white/5 rounded-2xl h-16 px-5 focus-within:border-white/20 transition-colors">
                        <span className="text-xl font-black text-zinc-500 mr-3">¥</span>
                        <input type="text" inputMode="decimal" value={editingItem.data.amount ? Number(editingItem.data.amount).toLocaleString() : ''} onChange={e => { const v = e.target.value.replace(/,/g, ''); if (!isNaN(v)) setEditingItem({ ...editingItem, data: { ...editingItem.data, amount: v } }) }} className="flex-1 w-full bg-transparent text-2xl font-black text-white outline-none tabular-nums" />
                      </div>
                      <button type="button" onClick={() => openCalculator(editingItem.data.amount ?? 0, (val) => setEditingItem(prev => ({ ...prev, data: { ...prev.data, amount: String(val) } })))} className="w-16 h-16 bg-white/5 border border-white/5 rounded-2xl flex items-center justify-center text-zinc-400 active:bg-white/10 transition-colors"><Calculator size={24} /></button>
                    </div>
                  </div>
                  <div className="space-y-2 relative">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Payment Method</label>
                    <select value={editingItem.data.method || ''} onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, method: e.target.value } })} className="w-full h-16 bg-white/5 border border-white/5 rounded-2xl px-5 text-sm font-black text-white outline-none appearance-none focus:border-white/20 transition-colors">
                      {config.paymentMethods.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <ChevronDown size={16} className="absolute right-4 top-[42px] text-zinc-500 pointer-events-none" />
                  </div>
                </div>
              )}

              {editingItem.type === 'template' && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Template Name</label>
                    <input value={editingItem.data.title || ''} onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, title: e.target.value } })} className="w-full h-16 bg-white/5 border border-white/5 rounded-2xl px-5 text-sm font-black text-white outline-none focus:border-white/20 transition-colors" autoFocus />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Default Amount</label>
                    <div className="flex gap-3">
                      <div className="flex-1 flex items-center bg-white/5 border border-white/5 rounded-2xl h-16 px-5 focus-within:border-white/20 transition-colors">
                        <span className="text-xl font-black text-zinc-500 mr-3">¥</span>
                        <input type="text" inputMode="decimal" value={editingItem.data.amount ? Number(editingItem.data.amount).toLocaleString() : ''} onChange={e => { const v = e.target.value.replace(/,/g, ''); if (!isNaN(v)) setEditingItem({ ...editingItem, data: { ...editingItem.data, amount: v } }) }} className="flex-1 w-full bg-transparent text-2xl font-black text-white outline-none tabular-nums" />
                      </div>
                      <button type="button" onClick={() => openCalculator(editingItem.data.amount ?? 0, (val) => setEditingItem(prev => ({ ...prev, data: { ...prev.data, amount: String(val) } })))} className="w-16 h-16 bg-white/5 border border-white/5 rounded-2xl flex items-center justify-center text-zinc-400 active:bg-white/10 transition-colors"><Calculator size={24} /></button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2 relative">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Category</label>
                      <select value={editingItem.data.category || ''} onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, category: e.target.value } })} className="w-full h-16 bg-white/5 border border-white/5 rounded-2xl px-5 text-sm font-black text-white outline-none appearance-none focus:border-white/20 transition-colors">
                        {getCategoryNames().map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <ChevronDown size={16} className="absolute right-4 top-[42px] text-zinc-500 pointer-events-none" />
                    </div>
                    <div className="space-y-2 relative">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Method</label>
                      <select value={editingItem.data.method || ''} onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, method: e.target.value } })} className="w-full h-16 bg-white/5 border border-white/5 rounded-2xl px-5 text-sm font-black text-white outline-none appearance-none focus:border-white/20 transition-colors">
                        {config.paymentMethods.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                      <ChevronDown size={16} className="absolute right-4 top-[42px] text-zinc-500 pointer-events-none" />
                    </div>
                  </div>
                </div>
              )}

              {editingItem.type === 'payment' && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Method Name</label>
                  <input value={editingItem.data.name || ''} onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, name: e.target.value } })} className="w-full h-16 bg-white/5 border border-white/5 rounded-2xl px-5 text-sm font-black text-white outline-none focus:border-white/20 transition-colors" autoFocus />
                </div>
              )}

              <div className="flex gap-4 pt-6 border-t border-white/5 mt-4">
                {editingItem.index !== -1 && !['salary', 'totalBudget', 'cashBudget', 'savings', 'bill', 'memo'].includes(editingItem.type) && (
                  <button onClick={handleDeleteItem} className="w-16 h-16 bg-red-900/20 text-red-500 rounded-2xl flex items-center justify-center active:scale-95 transition-transform"><Trash2 size={24} /></button>
                )}
                <button onClick={handleSettingsSave} className="flex-1 h-16 bg-white text-black rounded-2xl font-black text-sm shadow-xl active:scale-[0.98] transition-transform">変更を保存する</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AppWrapper() {
  return (
    <ErrorBoundary>
      <AppMain />
    </ErrorBoundary>
  );
}
