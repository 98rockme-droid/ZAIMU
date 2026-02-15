import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  onSnapshot,
  query,
  deleteDoc,
  where,
  getDocs,
  getDoc,
  orderBy,
  addDoc,
  updateDoc,
  serverTimestamp,
  runTransaction,
  documentId
} from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth';
import {
  Wallet,
  CreditCard,
  Landmark,
  Plus,
  Settings,
  Trash2,
  History,
  ChevronLeft,
  ChevronRight,
  X,
  Tags,
  ArrowLeft,
  CopyCheck,
  Calendar,
  CheckCircle2,
  BarChart3,
  TrendingDown,
  TrendingUp,
  Banknote,
  LayoutGrid,
  ListChecks,
  Search,
  CalendarDays,
  AlignJustify,
  Zap,
  Calculator,
  Delete,
  LogOut,
  Lock,
  User,
  FileText,
  Home,
  Sparkles,
  ChevronDown,
  PiggyBank,
  HelpCircle,
  Pencil
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

// Data Normalizers
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
    cashBudget: d.cashBudget || 0,
    cardBills: absorbedCardBills,
    fixedCosts: d.fixedCosts || [],
    catBudgets: d.catBudgets || {},
    cardDueDates: absorbedDueDates,
    confirmedPayments: d.confirmedPayments || [],
    savings: d.savings || 0,
    isSavingsDone: d.isSavingsDone || false,
    memo: d.memo || ''
  };
};

const normalizeConfig = (data) => ({
  categories: data?.categories || [{ name: '食費', icon: '🍔' }],
  paymentMethods: data?.paymentMethods || [CASH],
  templates: data?.templates || []
});

// ✅ 名前からブレない色を生成する関数（ハッシュ値を利用）
const CAT_COLORS = ['#60A5FA', '#34D399', '#FBBF24', '#F472B6', '#C084FC', '#F87171', '#2DD4BF', '#FCD34D', '#A855F7'];
const getCategoryColor = (name) => {
  if (name === 'その他') return '#A1A1AA';
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return CAT_COLORS[Math.abs(hash) % CAT_COLORS.length];
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
  const [cashBalance, setCashBalance] = useState(0);
  const [savingsBalance, setSavingsBalance] = useState(0);
  const [savingsTotalToMonth, setSavingsTotalToMonth] = useState(0);

  const [searchText, setSearchText] = useState('');
  const [filter, setFilter] = useState({ category: 'ALL', method: 'ALL', special: false });

  const mainRef = useRef(null);
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [copySourceMonth, setCopySourceMonth] = useState('');
  
  const [memoText, setMemoText] = useState('');
  const [isMemoExpanded, setIsMemoExpanded] = useState(false);
  const [isMemoModalOpen, setIsMemoModalOpen] = useState(false);

  // ✅ SVGドーナツチャート用の選択状態
  const [selectedDonutSlice, setSelectedDonutSlice] = useState(null);

  const FAQ_DATA = [
    {
      category: '💰 予算・残高の計算',
      items: [
        { q: '「今月あと使える（カード）」の計算式は？', a: '生活費予算（総枠） － 固定費（全額） － 今のカード出費 です。\nこれは「固定費を除いた、今月カードで使って良い変動費の予算」を表しています。' },
        { q: '「変動費予算」って何ですか？', a: '生活費予算（総枠）から、固定費（全額）を引いた金額です。\n食費や日用品など、自身のやりくりでコントロール可能な出費の上限目安となります。' },
        { q: '「口座残高見込み」の計算式は？', a: '手取り給与 － (現金の固定費 + カード引き落とし額 + 今月の積立額) です。\n※食費などの変動費はここからは引かれていません。あくまで「毎月自動的に出ていくお金」を引いた残高予測です。' },
        { q: '「今月あと使える（口座）」から積立金は引かれていますか？', a: 'はい、引かれています。\n本当に使えるお金を把握するため、現金予算から「今の出費」と「積立額」を差し引いた残高を表示しています。' },
        { q: '「引き落とし計」には何が含まれますか？', a: '「現金払いの固定費」と「カードの引き落とし額」の合計です。\n積立金はここには含まれず、別の行で計算されています。' },
      ]
    },
    {
      category: '🐷 積立・特別費',
      items: [
        { q: '積立はどうやるの？入金ボタンがないです', a: '設定した積立額は、毎月自動的に「支出」として計算され、積立総額に加算された状態で表示されます。手動での入金操作は不要です。' },
        { q: '積立金はいつ残高から引かれますか？', a: '設定タブで金額を入力した時点で、即座に「今月あと使える（口座）」や「口座残高見込み」からマイナスされます。「先取り貯金」として計算するためです。' },
        { q: '積立総額が増えていない気がします', a: '積立総額は「先月までの積立完了分 ＋ 今月の積立予定額」で表示しています。\n毎月1日になると、自動的に今月分が加算されて表示されます。' },
        { q: '特別費ってなに？', a: '冠婚葬祭や旅行など、通常の月予算とは別枠で管理したい出費です。\n支出入力時に「特別」ボタンをONにすると、通常の予算バーからは引かれずに記録されますが、現金残高からは減算されます。' },
      ]
    },
    {
      category: '⚙️ 設定・操作',
      items: [
        { q: 'カードの引き落とし額はどこで設定するの？', a: '設定タブの「資金計画・引落日」からカードごとに設定できます。' },
        { q: 'カード払いの固定費はどこで引かれていますか？', a: '「カードの引き落とし額」の中に含まれている前提で計算しています。\nそのため、「引き落とし計」の中の「現金の固定費」からは除外されています（二重計上防止のため）。' },
        { q: '来月の設定はどうすればいいですか？', a: '月が変わったら、設定タブの下部にある「設定をコピー」ボタンを押してください。\n先月や過去の月の設定（予算、固定費、積立額など）をそのまま引き継げます。' },
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
    return onSnapshot(doc(db, 'users', user.uid, 'wallet', 'cash'), (s) => { if (s.exists()) setCashBalance(s.data().balance); });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(doc(db, 'users', user.uid, 'wallet', 'savings'), (s) => { if (s.exists()) setSavingsBalance(s.data().balance || 0); });
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
        setSavingsTotalToMonth(0);
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

    const totalBudget = Number(monthlyData?.budget) || 0;

    const normalTx = transactions.filter(t => t.isSpecial !== true);
    const normalLastTx = (lastMonthTransactions || []).filter(t => t.isSpecial !== true);

    const spentCard = normalTx.filter(t => t.paymentMethod !== CASH).reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const cardRemaining = totalBudget - fixedTotal - spentCard;
    const variableBudget = totalBudget - fixedTotal;

    const cashBudget = Number(monthlyData?.cashBudget) || 0;
    const spentCash = transactions.filter(t => t.paymentMethod === CASH).reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const savingsAmount = Number(monthlyData?.savings || 0);

    const cashRemaining = cashBudget - spentCash - savingsAmount;

    const billTotal = Object.values(monthlyData?.cardBills || {}).reduce((s, v) => s + (Number(v) || 0), 0);
    const totalWithdrawal = fixedCash + billTotal + savingsAmount;
    const withdrawalOnly = fixedCash + billTotal;
    const bankBalanceProjected = (Number(monthlyData?.salary) || 0) - totalWithdrawal;

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
      cardRemaining,
      variableBudget, 
      cashRemaining,
      cardBudget: totalBudget,
      cashBudget,
      bankBalanceProjected,
      fixedTotal,
      fixedCard,
      totalWithdrawal,
      withdrawalOnly: withdrawalOnly || 0,
      catBudgetSum,
      savingsAmount,
      cardRemainingPercent: (totalBudget - fixedTotal) > 0 ? Math.round((cardRemaining / (totalBudget - fixedTotal)) * 100) : 0,
      cashRemainingPercent: cashBudget > 0 ? Math.round((cashRemaining / cashBudget) * 100) : 0,
      catTotals,
      lastCatTotals,
      totalSpent: normalTx.reduce((s, t) => s + (Number(t.amount) || 0), 0),
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
  }, [monthlyData, transactions, lastMonthTransactions, month, config]);

  // ✅ 有効なカテゴリのみ抽出（予算設定されているもの、または支出があったもの）
  const activeCategories = getCategoryNames().filter(n => (monthlyData.catBudgets?.[n] || 0) > 0 || (summary.catTotals[n] || 0) > 0);

  // ✅ 最重要なAIコメントを1つだけ選出する
  const aiMessage = useMemo(() => {
    const d = new Date();
    const isCurrentMonth = month === getMonthString(d);
    const today = d.getDate();
    const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const progress = today / daysInMonth;
    const variableBudget = summary.variableBudget;
    const spent = summary.totalSpent;
    const spentRatio = variableBudget > 0 ? spent / variableBudget : 0;

    if (isCurrentMonth && variableBudget > 0) {
      if (spent > variableBudget) {
        return { icon: '🚨', text: `予算オーバー！残りは0円を意識して乗り切りましょう。`, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' };
      }
      if (spentRatio > progress + 0.15) {
        return { icon: '⚠️', text: `支出ペースが早めです！予算の${Math.round(spentRatio * 100)}%を消費しました。`, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' };
      }
      if (spentRatio < progress - 0.1) {
        return { icon: '🌟', text: `素晴らしいペース！予算に対してかなりゆとりがあります。`, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' };
      }
      const remainingDays = daysInMonth - today + 1;
      const dailyAvailable = Math.max(0, variableBudget - spent) / remainingDays;
      return { icon: '💡', text: `今月は残り${remainingDays}日。1日あたり約${Math.floor(dailyAvailable).toLocaleString()}円使えます！`, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' };
    }
    
    if (!isCurrentMonth && variableBudget > 0) {
       if (spent > variableBudget) {
         return { icon: '👀', text: `この月は変動費予算を ¥${(spent - variableBudget).toLocaleString()} オーバーしていました。`, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' };
       }
       return { icon: '🎉', text: `この月は予算内に収まりました！（黒字: ¥${(variableBudget - spent).toLocaleString()}）`, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' };
    }
    
    return { icon: '📝', text: `生活費予算を設定すると、ここにAIアドバイスが表示されます。`, color: 'text-zinc-400', bg: 'bg-white/5', border: 'border-white/10' };
  }, [summary, month]);

  // ✅ SVGドーナツチャート用のデータ作成
  const donutChartData = useMemo(() => {
    const total = summary.totalSpent;
    if (total === 0) return { items: [], total: 0 };

    // 金額が大きい順にソートしてその他にまとめる処理
    const arr = Object.entries(summary.catTotals)
      .map(([name, amount]) => ({ name, amount }))
      .filter(item => item.amount > 0);
    arr.sort((a, b) => b.amount - a.amount);

    let items = [];
    if (arr.length <= 6) {
      items = arr.map(item => ({ ...item, color: getCategoryColor(item.name) }));
    } else {
      const top5 = arr.slice(0, 5);
      const otherAmount = arr.slice(5).reduce((sum, item) => sum + item.amount, 0);
      items = top5.map(item => ({ ...item, color: getCategoryColor(item.name) }));
      items.push({ name: 'その他', amount: otherAmount, color: getCategoryColor('その他') });
    }
    return { items, total };
  }, [summary.totalSpent, summary.catTotals]);


  /* --- ALERTS --- */
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

  const executeSavings = async () => {
    if (!user || monthlyData.isSavingsDone) return;
    const amount = Number(monthlyData.savings || 0);
    if (amount <= 0) return showToastMsg('積立額が設定されていません');

    try {
      await runTransaction(db, async (t) => {
        const monthRef = doc(db, 'users', user.uid, 'months', month);
        t.set(monthRef, { isSavingsDone: true }, { merge: true });
        const savingsRef = doc(db, 'users', user.uid, 'wallet', 'savings');
        const savingsDoc = await t.get(savingsRef);
        t.set(savingsRef, { balance: (savingsDoc.exists() ? savingsDoc.data().balance : 0) + amount }, { merge: true });
        const cashRef = doc(db, 'users', user.uid, 'wallet', 'cash');
        const cashDoc = await t.get(cashRef);
        t.set(cashRef, { balance: (cashDoc.exists() ? cashDoc.data().balance : 0) - amount }, { merge: true });
      });
      showToastMsg('積立を完了しました！🎉');
    } catch (e) {
      console.error(e);
      showToastMsg('エラーが発生しました');
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
      if (type === 'budget') {
        await setDoc(doc(db, 'users', user.uid, 'months', month), {
          salary: toNumber(data.salary), budget: toNumber(data.budget), cashBudget: toNumber(data.cashBudget)
        }, { merge: true });
      } else if (type === 'salary') {
        await setDoc(doc(db, 'users', user.uid, 'months', month), { salary: toNumber(data.value) }, { merge: true });
      } else if (type === 'totalBudget') {
        await setDoc(doc(db, 'users', user.uid, 'months', month), { budget: toNumber(data.value) }, { merge: true });
      } else if (type === 'cashBudget') {
        await setDoc(doc(db, 'users', user.uid, 'months', month), { cashBudget: toNumber(data.value) }, { merge: true });
      } else if (type === 'savings') {
        await setDoc(doc(db, 'users', user.uid, 'months', month), { savings: toNumber(data.value) }, { merge: true });
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

  const handleMoveCategory = async (index, direction, e) => {
    e.stopPropagation();
    const newCats = [...(config.categories || [])];
    if (direction === 'up' && index > 0) [newCats[index], newCats[index - 1]] = [newCats[index - 1], newCats[index]];
    else if (direction === 'down' && index < newCats.length - 1) [newCats[index], newCats[index + 1]] = [newCats[index + 1], newCats[index]];
    else return;
    setConfig({ ...config, categories: newCats });
    await setDoc(doc(db, 'users', user.uid, 'settings', 'config'), { ...config, categories: newCats }, { merge: true });
  };

  /* --- OTHERS --- */
  const finalFilteredTx = transactions.filter(t => {
    const matchSearch = searchText === '' || String(t.title || '').includes(searchText);
    const matchCat = filter.category === 'ALL' || t.category === filter.category;
    const matchMethod = filter.method === 'ALL' || t.paymentMethod === filter.method;
    const matchSpecial = !filter.special || t.isSpecial === true;
    return matchSearch && matchCat && matchMethod && matchSpecial;
  });

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
          budget: d.budget || 0, cashBudget: d.cashBudget || 0, fixedCosts: d.fixedCosts || [], catBudgets: d.catBudgets || {},
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
  if (authLoading) return <div className="h-screen bg-[#121212] flex items-center justify-center text-zinc-600">Loading...</div>;
  if (!user) return (
    <div className="h-screen w-full bg-[#121212] flex flex-col items-center justify-center p-6 space-y-8 animate-in fade-in">
      <div className="text-center"><h1 className="text-4xl font-black text-white">ZAIMU</h1></div>
      <button onClick={() => signInWithPopup(auth, new GoogleAuthProvider())} className="w-full max-w-xs h-14 bg-white text-black rounded-full font-bold flex items-center justify-center gap-3"><Lock size={18} /> Google Login</button>
    </div>
  );

  const SETTING_MENU_ITEMS = [
    { id: 'budget', label: '資金計画・引落日', icon: <Landmark size={18} /> },
    { id: 'fixed', label: '固定費管理', icon: <CreditCard size={18} /> },
    { id: 'category', label: 'カテゴリ予算', icon: <Tags size={18} /> },
    { id: 'template', label: 'テンプレート', icon: <Zap size={18} /> },
    { id: 'payment', label: '支払方法', icon: <Wallet size={18} /> },
    { id: 'faq', label: 'よくある質問・計算ロジック', icon: <HelpCircle size={18} /> },
  ];
  const currentSettingTitle = SETTING_MENU_ITEMS.find(item => item.id === settingTab)?.label || '設定';

  // ✅ SVG円グラフの描画用コンポーネント
  const InteractiveDonutChart = ({ data, total, selectedSlice, onSelect }) => {
    const radius = 42;
    const circumference = 2 * Math.PI * radius;
    let currentOffset = 0;

    return (
      <div className="relative w-48 h-48 flex items-center justify-center">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          {data.map(item => {
            const strokeLength = (item.amount / total) * circumference;
            const offset = currentOffset;
            currentOffset += strokeLength;
            const isSelected = selectedSlice?.name === item.name;

            return (
              <circle
                key={item.name}
                cx="50"
                cy="50"
                r={radius}
                fill="transparent"
                stroke={item.color}
                strokeWidth={isSelected ? "14" : "10"}
                strokeDasharray={`${Math.max(strokeLength - 1, 0)} ${circumference}`}
                strokeDashoffset={-offset}
                className="transition-all duration-300 cursor-pointer drop-shadow-md hover:opacity-80"
                onClick={() => onSelect(isSelected ? null : item)}
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
           {selectedSlice ? (
             <>
               <span className="text-[10px] text-zinc-400 font-bold mb-0.5">{selectedSlice.name}</span>
               <span className="text-xl font-black text-white" style={{ color: selectedSlice.color }}>¥{selectedSlice.amount.toLocaleString()}</span>
               <span className="text-[9px] text-zinc-500 mt-0.5">{Math.round((selectedSlice.amount / total) * 100)}%</span>
             </>
           ) : (
             <>
               <span className="text-[10px] text-zinc-500 font-bold uppercase mb-0.5">総支出</span>
               <span className="text-2xl font-black text-white tracking-tight leading-none mb-1">¥{total.toLocaleString()}</span>
               <div className={`flex items-center gap-0.5 text-[9px] font-bold ${summary.totalSpent <= summary.lastTotalSpent ? 'text-green-400' : 'text-red-400'}`}>
                 {summary.totalSpent <= summary.lastTotalSpent ? <TrendingDown size={10} /> : <TrendingUp size={10} />}
                 <span>先月比 {summary.totalSpent <= summary.lastTotalSpent ? '-' : '+'}¥{Math.abs(summary.totalSpent - summary.lastTotalSpent).toLocaleString()}</span>
               </div>
             </>
           )}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 w-full bg-[#121212] text-zinc-200 font-sans flex flex-col justify-center overflow-hidden">
      <Toast message={toast.message} isVisible={toast.visible} />

      <div className="w-full max-w-md h-full flex flex-col relative bg-[#121212] shadow-2xl mx-auto">
        <header className="flex-none h-16 border-b border-white/5 px-4 flex items-center justify-between bg-[#121212]/80 backdrop-blur-xl z-50 relative">
          {activeTab === 'settings' && settingTab !== 'menu' ? (
            <>
              <button onClick={() => setSettingTab('menu')} className="text-zinc-400"><ArrowLeft size={24} /></button>
              <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center">
                <span className="text-xs font-bold text-white uppercase">{currentSettingTitle}</span>
                {(settingTab === 'fixed' || settingTab === 'category') && (
                  <span className="text-[10px] text-zinc-500 font-mono">計 ¥{(settingTab === 'fixed' ? summary.fixedTotal : summary.catBudgetSum).toLocaleString()}</span>
                )}
              </div>
              <div className="w-6" />
            </>
          ) : (
            <>
              <div className="w-8 h-8 p-1"><img src="/favicon.ico" referrerPolicy="no-referrer" alt="logo" className="w-full h-full" /></div>
              <div className="flex items-center gap-4">
                <button onClick={() => { const d = new Date(month + "-01"); d.setMonth(d.getMonth() - 1); setMonth(getMonthString(d)) }}><ChevronLeft size={20} /></button>
                <span className="text-sm font-bold text-white tabular-nums">{formatMonthJP(month)}</span>
                <button onClick={() => { const d = new Date(month + "-01"); d.setMonth(d.getMonth() + 1); setMonth(getMonthString(d)) }}><ChevronRight size={20} /></button>
              </div>
              <button onClick={() => setMonth(getMonthString(new Date()))} className="text-zinc-500 active:text-white"><Calendar size={20} /></button>
            </>
          )}
        </header>

        <main ref={mainRef} className={`flex-1 relative ${activeTab === 'log' ? 'flex flex-col overflow-hidden' : 'overflow-y-auto scrollbar-hide'}`}>
          
          {/* ✅ ホーム画面（1ページ化） */}
          {activeTab === 'home' && (
            <div className="flex flex-col relative">
              {monthlyData.memo && (
                <div 
                  onClick={() => setIsMemoExpanded(!isMemoExpanded)}
                  className="sticky top-0 bg-zinc-900 border-b border-white/10 px-4 py-2.5 flex flex-col cursor-pointer transition-all duration-300 z-30 shadow-md"
                >
                  <div className="flex items-start gap-2">
                    <span className="text-[12px] mt-0.5">📌</span>
                    <div className={`flex-1 text-xs text-zinc-300 leading-relaxed transition-all duration-300 ${isMemoExpanded ? 'whitespace-pre-wrap break-all' : 'truncate block'}`}>
                      {monthlyData.memo}
                    </div>
                    <ChevronDown size={14} className={`text-zinc-500 shrink-0 transition-transform mt-0.5 ${isMemoExpanded ? 'rotate-180' : ''}`} />
                  </div>
                </div>
              )}

              <div className="px-4 pb-32 space-y-6 pt-4 animate-in fade-in duration-300">
                
                {/* ① 残高セクション */}
                <div className="space-y-4">
                  <SimpleCard className="p-0">
                    <div className="grid grid-cols-2 divide-x divide-white/5">
                      {/* カード */}
                      <div className="p-4 flex flex-col">
                        <div>
                          <div className="flex items-center gap-1 mb-1 text-[9px] text-zinc-400 font-bold uppercase tracking-wider">
                            <CreditCard size={12} className="shrink-0" />
                            <p className="truncate">使える (カード)</p>
                          </div>
                          <h2 className={`text-2xl font-bold tracking-tight ${summary.cardRemaining < 0 ? 'text-red-400' : 'text-white'}`}>
                            ¥{summary.cardRemaining.toLocaleString()}
                          </h2>
                        </div>
                        <div className="mt-4 flex-1 flex flex-col justify-end space-y-1">
                          <div className="flex justify-between text-[8px] text-zinc-500">
                            <span>変動予算</span><span>¥{summary.variableBudget.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between text-[8px] text-zinc-500">
                            <span>利用済</span><span>¥{summary.spentCard.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between text-[8px] text-zinc-500 pb-0.5">
                            <span>総枠</span><span className="text-zinc-400 font-bold">¥{summary.cardBudget.toLocaleString()}</span>
                          </div>
                          <div className="h-1 bg-white/5 rounded-full overflow-hidden shrink-0 mt-1">
                            <div className="h-full bg-white transition-all duration-1000" style={{ width: `${summary.cardRemainingPercent}%` }} />
                          </div>
                        </div>
                      </div>

                      {/* 口座 */}
                      <div className="p-4 flex flex-col">
                        <div>
                          <div className="flex items-center gap-1 mb-1 text-[9px] text-zinc-400 font-bold uppercase tracking-wider">
                            <Wallet size={12} className="shrink-0" />
                            <p className="truncate">使える (口座)</p>
                          </div>
                          <h2 className={`text-2xl font-bold tracking-tight ${summary.cashRemaining < 0 ? 'text-red-400' : 'text-white'}`}>
                            ¥{summary.cashRemaining.toLocaleString()}
                          </h2>
                        </div>
                        <div className="mt-4 flex-1 flex flex-col justify-end space-y-1">
                          <div className="flex justify-between text-[8px] text-zinc-500">
                            <span>利用済</span><span>¥{summary.spentCash.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between text-[8px] text-zinc-500 pb-0.5">
                            <span>軍資金</span><span className="text-zinc-400 font-bold">¥{summary.cashBudget.toLocaleString()}</span>
                          </div>
                          <div className="h-1 bg-white/5 rounded-full overflow-hidden shrink-0 mt-1">
                            <div className="h-full bg-zinc-500 transition-all duration-1000" style={{ width: `${summary.cashRemainingPercent}%` }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </SimpleCard>
                </div>

                {/* ② カテゴリセクション */}
                <div className="space-y-3">
                  <h3 className="text-[10px] text-zinc-500 uppercase font-black tracking-widest pl-1">カテゴリ別 予算</h3>
                  <SimpleCard className="p-0 overflow-hidden">
                    <div className="grid grid-cols-2 gap-px bg-white/5">
                      {activeCategories.map(n => {
                        const s = summary.catTotals[n] || 0;
                        const b = monthlyData.catBudgets?.[n] || 0;
                        const isOver = b > 0 && s > b;
                        return (
                          <div key={n} className="bg-[#1E1E1E] p-4 space-y-2">
                            <div className="flex justify-between items-center text-[9px] font-bold">
                              <div className="flex items-center gap-1.5"><span>{getCategoryIcon(n)}</span><span className="text-zinc-400">{n}</span></div>
                              <span className={isOver ? "text-red-400" : "text-white"}>¥{s.toLocaleString()} / ¥{b.toLocaleString()}</span>
                            </div>
                            <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                              {/* ✅ プログレスバーをシンプルな色に修正 */}
                              <div className={`h-full ${isOver ? "bg-red-400" : "bg-zinc-500"} transition-all duration-1000`} style={{ width: `${b > 0 ? Math.min(100, (s / b) * 100) : 0}%` }} />
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

                {/* ③ 口座・引落セクション */}
                <div className="space-y-3">
                  <h3 className="text-[10px] text-zinc-500 uppercase font-black tracking-widest pl-1">口座残高・引落予定</h3>
                  {activeAlerts.length > 0 && (
                    <SimpleCard className="bg-red-500/10 border-red-500/30 p-4">
                      <div className="flex items-center gap-2 text-red-400 mb-2 font-bold text-xs"><Calendar size={14} /> 支払期日が迫っています</div>
                      <div className="space-y-2">
                        {activeAlerts.map(([card, day]) => (
                          <div key={card} className="flex justify-between items-center bg-black/20 p-2 rounded">
                            <span className="text-xs font-bold text-white">{card} ({day}日)</span>
                            <button onClick={() => confirmPayment(card)} className="text-[10px] bg-red-500 text-white px-3 py-1 rounded-full font-bold active:scale-95">完了</button>
                          </div>
                        ))}
                      </div>
                    </SimpleCard>
                  )}
                  <SimpleCard className="p-5 space-y-3">
                    <div className="flex justify-between items-end"><p className="text-[10px] text-zinc-500 uppercase">口座残高見込み（引落後）</p><Banknote size={16} className="text-zinc-600" /></div>
                    <div className="flex justify-between items-center text-xs text-zinc-400">給与収入<span className="text-sm font-bold text-white">+ ¥{monthlyData.salary.toLocaleString()}</span></div>
                    <div className="flex justify-between items-center text-xs text-zinc-400">引き落とし計<span className="text-sm font-bold text-red-400">- ¥{Number(summary.withdrawalOnly || 0).toLocaleString()}</span></div>
                    <div className="flex justify-between items-center text-xs text-zinc-400">積立金<span className="text-sm font-bold text-red-400">- ¥{summary.savingsAmount.toLocaleString()}</span></div>
                    <div className="pt-2 border-t border-white/5 flex justify-between items-end text-xs font-bold text-zinc-500">残高予想<span className="text-2xl font-black text-white">¥{summary.bankBalanceProjected.toLocaleString()}</span></div>
                  </SimpleCard>
                </div>

                {/* ④ 貯金セクション */}
                <div className="space-y-3">
                  <h3 className="text-[10px] text-zinc-500 uppercase font-black tracking-widest pl-1">積立貯金</h3>
                  <SimpleCard className="p-5 bg-emerald-500/10 border-emerald-500/30">
                    <div className="flex items-end justify-between">
                       <div>
                         <p className="text-[10px] text-zinc-400 font-bold uppercase mb-1">総額</p>
                         <h3 className="text-2xl font-black text-white">¥{Number(savingsTotalToMonth || 0).toLocaleString()}</h3>
                       </div>
                       <div className="text-right">
                         <p className="text-[10px] text-zinc-400 font-bold uppercase mb-1">今月の積立</p>
                         <p className="text-sm font-bold text-emerald-400">+ ¥{summary.savingsAmount.toLocaleString()}</p>
                       </div>
                    </div>
                  </SimpleCard>
                </div>

              </div>
            </div>
          )}

          {/* 🔽 Logタブ */}
          {activeTab === 'log' && (
            <div className="animate-in fade-in flex flex-col h-full pt-3">
              <div className="flex-none px-4 pb-3 space-y-3 z-10">
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <input type="text" value={searchText} onChange={e => setSearchText(e.target.value)} placeholder="検索..." className="w-full h-10 bg-black/20 border border-white/10 rounded-lg pl-9 pr-3 text-xs text-white outline-none focus:border-white/30 transition-colors" />
                    <Search size={14} className="absolute left-3 top-3 text-zinc-500" />
                  </div>
                  <div className="flex bg-[#1E1E1E] rounded-lg border border-white/10 p-0.5">
                    <button onClick={() => setLogView('list')} className={`p-2 rounded ${logView === 'list' ? 'bg-white text-black' : 'text-zinc-500'}`}><AlignJustify size={16} /></button>
                    <button onClick={() => setLogView('calendar')} className={`p-2 rounded ${logView === 'calendar' ? 'bg-white text-black' : 'text-zinc-500'}`}><CalendarDays size={16} /></button>
                  </div>
                </div>

                <div className="flex gap-2 items-center">
                  <div className="relative flex-[1] min-w-0">
                    <select
                      value={filter.category}
                      onChange={e => setFilter({ ...filter, category: e.target.value })}
                      className="w-full h-10 bg-black/20 border border-white/10 rounded-lg pl-3 pr-7 text-xs text-white outline-none appearance-none focus:border-white/30 transition-colors"
                    >
                      <option value="ALL">すべて</option>
                      {getCategoryNames().map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-2.5 top-3 text-zinc-500 pointer-events-none" />
                  </div>

                  <div className="relative flex-[1] min-w-0">
                    <select
                      value={filter.method}
                      onChange={e => setFilter({ ...filter, method: e.target.value })}
                      className="w-full h-10 bg-black/20 border border-white/10 rounded-lg pl-3 pr-7 text-xs text-white outline-none appearance-none focus:border-white/30 transition-colors"
                    >
                      <option value="ALL">すべて</option>
                      {(config?.paymentMethods || []).map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-2.5 top-3 text-zinc-500 pointer-events-none" />
                  </div>

                  <button
                    type="button"
                    onClick={() => setFilter(prev => ({ ...prev, special: !prev.special }))}
                    className={`h-10 px-3 rounded-lg border text-[10px] font-black tracking-widest shrink-0 transition-colors ${
                      filter.special ? 'bg-white text-black border-white' : 'bg-black/20 text-zinc-400 border-white/10'
                    }`}
                  >
                    特別費
                  </button>

                  <button type="button" onClick={clearLogFilters} className="w-10 h-10 bg-black/20 border border-white/10 rounded-lg flex items-center justify-center active:bg-white/10 transition-colors shrink-0">
                    <X size={16} className="text-zinc-500" />
                  </button>
                </div>
              </div>

              <div className="flex-1 px-4 pb-6 overflow-hidden flex flex-col">
                {logView === 'list' ? (
                  <SimpleCard className="flex-1 flex flex-col overflow-hidden p-0">
                    {finalFilteredTx.length === 0 ? (
                      <div className="py-20 flex flex-col items-center gap-3 text-zinc-600">
                        <Sparkles size={48} className="text-zinc-600" />
                        <p className="text-xs uppercase font-black">No Spending! 🎉</p>
                      </div>
                    ) : (
                      <div className="flex-1 overflow-y-auto divide-y divide-white/5 scrollbar-hide pb-20">
                        {finalFilteredTx.map(t => (
                          <div key={t.id} onClick={() => startEditingTx(t)} className="flex items-center justify-between p-4 cursor-pointer active:bg-white/5 transition-colors">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className="w-8 font-bold font-mono text-[10px] text-zinc-500">{formatDateShort(t.date)}</div>
                              <div className={`w-12 text-center text-[9px] rounded py-0.5 truncate ${t.isSpecial === true ? 'bg-transparent border border-white/10 text-zinc-400' : 'bg-white/5 text-zinc-400'}`}>
                                {t.category}
                              </div>
                              <div className="flex-1 truncate text-sm font-bold text-white">{t.title}</div>
                            </div>
                            <span className="text-sm font-bold tabular-nums text-white pl-2">¥{Number(t.amount || 0).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </SimpleCard>
                ) : (
                  <SimpleCard className="flex-1 flex flex-col overflow-hidden p-4">
                    <div className="flex-none grid grid-cols-7 gap-1 text-center mb-2 text-[10px] text-zinc-600 uppercase">
                      {['日', '月', '火', '水', '木', '金', '土'].map(d => <div key={d}>{d}</div>)}
                    </div>
                    <div className="flex-1 overflow-y-auto scrollbar-hide pb-20">
                      <div className="grid grid-cols-7 gap-1">
                        {calendarDaysList.map((day, i) => {
                          if (!day) return <div key={i} />;
                          const a = summary.dailyTotals[day] || 0;
                          const isT = day === new Date().getDate() && month === getMonthString(new Date());
                          return (
                            <div
                              key={i}
                              onClick={() => openTxModalWithDate(`${month}-${String(day).padStart(2, '0')}`)}
                              className={`aspect-square rounded-lg border flex flex-col items-center justify-center relative transition-transform active:scale-95 ${isT ? 'border-white bg-white/10 shadow-[0_0_10px_rgba(255,255,255,0.1)]' : 'border-white/5 bg-black/20'}`}
                            >
                              <span className={`text-[9px] ${isT ? 'text-white' : 'text-zinc-500'}`}>{day}</span>
                              {a > 0 && <span className="text-[8px] text-zinc-300 tabular-nums">¥{(a / 1000).toFixed(1)}k</span>}
                              {(a === 0 && !isT && new Date(month + '-' + String(day).padStart(2, '0')) <= new Date()) && <span className="absolute text-[10px]">✨</span>}
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

          {/* ✅ Analysis タブ（大進化！） */}
          {activeTab === 'analysis' && (
            <div className="px-4 pt-4 pb-32 space-y-6 animate-in fade-in">
              
              {/* 💡 AI 家計診断（1行のコンパクト版） */}
              {aiMessage && (
                <div className={`p-3 rounded-xl border flex items-center gap-3 ${aiMessage.bg} ${aiMessage.border}`}>
                   <span className="text-xl shrink-0">{aiMessage.icon}</span>
                   <span className={`text-xs font-bold leading-snug ${aiMessage.color}`}>{aiMessage.text}</span>
                </div>
              )}

              {/* 🍩 今月のダッシュボード（1つの巨大カードに完全統合） */}
              <div className="space-y-3">
                 <h3 className="text-[10px] text-zinc-500 uppercase font-black tracking-widest pl-1">今月のサマリー</h3>
                 <SimpleCard className="p-0 overflow-hidden">
                    
                    {/* ドーナツチャート ＆ 総支出エリア */}
                    <div className="p-6 flex flex-col items-center border-b border-white/5">
                      {/* ✅ インタラクティブなSVG円グラフ */}
                      <InteractiveDonutChart 
                        data={donutChartData.items} 
                        total={donutChartData.total} 
                        selectedSlice={selectedDonutSlice} 
                        onSelect={setSelectedDonutSlice} 
                      />

                      {/* ✅ 独立した特別費表示 */}
                      {summary.specialTotalSpent > 0 && (
                        <div className="mt-5 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-[9px] text-zinc-400 font-bold text-center">
                          上記のうち特別費: ¥{summary.specialTotalSpent.toLocaleString()} <br className="sm:hidden" />(先月: ¥{summary.lastSpecialTotalSpent.toLocaleString()})
                        </div>
                      )}
                    </div>

                    {/* カテゴリ別比較リスト（ドーナツの色とリンク） */}
                    <div className="divide-y divide-white/5">
                      {getCategoryNames().map(n => {
                        const c = summary.catTotals[n] || 0;
                        const l = summary.lastCatTotals[n] || 0;
                        const b = monthlyData.catBudgets?.[n] || 0;
                        
                        // 予算もなく支出もない項目は非表示にしてスッキリさせる
                        if (b === 0 && c === 0) return null;

                        const color = getCategoryColor(n);
                        const isOver = b > 0 && c > b;
                        // ✅ リスト内のプログレスバーはシンプルな白/グレーに戻す
                        const percent = b > 0 ? Math.min(100, (c / b) * 100) : 0;

                        return (
                          <div key={n} className="p-4 flex flex-col gap-2.5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                {/* 色玉 */}
                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                                <span className="text-lg w-6 text-center">{getCategoryIcon(n)}</span>
                                <span className="text-xs font-bold text-zinc-200">{n}</span>
                              </div>
                              <div className="text-right">
                                <span className={`text-sm font-black ${isOver ? 'text-red-400' : 'text-white'}`}>¥{c.toLocaleString()}</span>
                                <span className="text-[10px] text-zinc-500 ml-1">/ ¥{b.toLocaleString()}</span>
                              </div>
                            </div>
                            <div className="pl-12 flex flex-col gap-1.5">
                              {/* プログレスバー（白/赤/グレー） */}
                              <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full transition-all duration-1000 ${isOver ? "bg-red-400" : "bg-zinc-500"}`} 
                                  style={{ width: `${percent}%` }} 
                                />
                              </div>
                              {/* 先月比テキスト */}
                              <div className="flex justify-between text-[9px] font-bold">
                                <span className="text-zinc-600">先月: ¥{l.toLocaleString()}</span>
                                <span className={c > l ? 'text-red-400/80' : 'text-green-400/80'}>
                                  {c > l ? `+¥${(c - l).toLocaleString()}` : `-¥${(l - c).toLocaleString()}`}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                 </SimpleCard>
              </div>

              {/* ✅ 特別費が全くない時用、または完全に分けて見たい時のための予備カード（不要なら削除可ですが、全体像として残します） */}
              {summary.specialTotalSpent === 0 && summary.lastSpecialTotalSpent > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-[10px] text-zinc-500 uppercase font-black tracking-widest pl-1">特別費（別枠）</h3>
                    <SimpleCard className="p-4">
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between items-center text-zinc-400">
                          <span className="font-bold">今月の特別費</span>
                          <span className="text-white font-black tabular-nums">¥{Number(summary.specialTotalSpent || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center text-zinc-400">
                          <span className="font-bold">先月の特別費</span>
                          <span className="text-white font-black tabular-nums">¥{Number(summary.lastSpecialTotalSpent || 0).toLocaleString()}</span>
                        </div>
                      </div>
                    </SimpleCard>
                  </div>
              )}

            </div>
          )}

          {activeTab === 'settings' && (
            <div className="px-4 pt-4 pb-32 animate-in fade-in">
              {settingTab === 'menu' ? (
                <div className="space-y-6 pb-10">
                  <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-3">
                      {user.photoURL ? <img src={user.photoURL} referrerPolicy="no-referrer" alt="icon" className="w-8 h-8 rounded-full border border-white/10" /> : <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center"><User size={16} /></div>}
                      <span className="text-xs font-bold text-white">{user.email}</span>
                    </div>
                    <button onClick={() => { if (window.confirm('Logout?')) signOut(auth); }} className="text-zinc-500 text-[10px] flex items-center gap-1.5 active:text-white uppercase"><LogOut size={14} /> Logout</button>
                  </div>
                  <div className="bg-[#1E1E1E] rounded-xl border border-white/5 overflow-hidden">
                    <div className="divide-y divide-white/5">
                      {SETTING_MENU_ITEMS.map(item => (
                        <SettingsRow
                          key={item.id}
                          onClick={() => setSettingTab(item.id)}
                          left={<div className="flex items-center gap-4">{item.icon}<span className="text-sm font-bold">{item.label}</span></div>}
                          right={(item.id === 'fixed' ? `¥${summary.fixedTotal.toLocaleString()}` : item.id === 'category' ? `¥${summary.catBudgetSum.toLocaleString()}` : '')}
                          showChevron={true}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-4 pt-4">
                    <button onClick={openCopySettingsModal} className="px-6 py-3 border border-white/10 text-zinc-300 rounded-full text-xs font-bold active:bg-white/5 transition-all"><CopyCheck className="inline mr-2" size={16} /> 先月の設定をコピー</button>
                    <button onClick={handleExportCSV} className="text-zinc-600 text-[10px] underline flex items-center gap-2 active:text-white"><FileText size={12} /> 全データをCSV出力</button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {settingTab === 'faq' && (
                      <div className="space-y-3 animate-in slide-in-from-right-2">
                          <div className="relative mb-4">
                              <input
                                  type="text"
                                  value={faqSearchText}
                                  onChange={(e) => setFaqSearchText(e.target.value)}
                                  placeholder="キーワードで検索 (例: 積立, カード)"
                                  className="w-full h-10 bg-black/20 border border-white/10 rounded-lg pl-9 pr-3 text-xs text-white outline-none focus:border-white/30 transition-colors"
                              />
                              <Search size={14} className="absolute left-3 top-3 text-zinc-500" />
                              {faqSearchText && (
                                <button 
                                  onClick={() => setFaqSearchText('')}
                                  className="absolute right-3 top-2.5 text-zinc-500 hover:text-white transition-colors"
                                >
                                  <X size={14} />
                                </button>
                              )}
                          </div>

                          <div className="space-y-4">
                              {filteredFaqData.length > 0 ? (
                                  filteredFaqData.map((section, sIdx) => (
                                      <div key={sIdx}>
                                          <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 pl-2">{section.category}</h3>
                                          <SimpleCard className="overflow-hidden">
                                              <div className="divide-y divide-white/5">
                                                  {section.items.map((item, idx) => (
                                                      <div key={idx} className="p-4 cursor-pointer hover:bg-white/5 transition-colors" onClick={() => setExpandedFaq(expandedFaq === `${sIdx}-${idx}` ? null : `${sIdx}-${idx}`)}>
                                                          <div className="flex justify-between items-start gap-4">
                                                              <div className="flex items-start gap-3">
                                                                  <HelpCircle size={18} className="text-zinc-500 mt-0.5 shrink-0" />
                                                                  <span className="text-sm font-bold text-zinc-200 leading-snug">{item.q}</span>
                                                              </div>
                                                              <ChevronDown size={16} className={`text-zinc-500 transition-transform shrink-0 ${expandedFaq === `${sIdx}-${idx}` ? 'rotate-180' : ''}`} />
                                                          </div>
                                                          {expandedFaq === `${sIdx}-${idx}` && (
                                                              <div className="mt-3 pl-8 text-xs text-zinc-400 leading-relaxed whitespace-pre-wrap">
                                                                  {item.a}
                                                              </div>
                                                          )}
                                                      </div>
                                                  ))}
                                              </div>
                                          </SimpleCard>
                                      </div>
                                  ))
                              ) : (
                                  <div className="text-center py-10 text-zinc-500 text-xs">見つかりませんでした</div>
                              )}
                          </div>
                      </div>
                  )}
                  {settingTab === 'budget' && (
                    <div className="space-y-4 animate-in slide-in-from-right-2">
                      <div className="text-[10px] text-zinc-500 uppercase font-black pl-1">資金計画</div>
                      <SimpleCard className="overflow-hidden">
                        <div className="divide-y divide-white/5">
                          <SettingsRow onClick={() => openEdit('salary', { value: monthlyData.salary }, 0)} left={<span className="text-sm text-zinc-200 font-bold">手取り給与</span>} right={<span>¥{Number(monthlyData.salary || 0).toLocaleString()}</span>} />
                          <SettingsRow onClick={() => openEdit('totalBudget', { value: monthlyData.budget }, 0)} left={<span className="text-sm text-zinc-200 font-bold">生活費予算（総枠）</span>} right={<span>¥{Number(monthlyData.budget || 0).toLocaleString()}</span>} />
                          <SettingsRow onClick={() => openEdit('cashBudget', { value: monthlyData.cashBudget }, 0)} left={<span className="text-sm text-zinc-200 font-bold">現金予算（口座用）</span>} right={<span>¥{Number(monthlyData.cashBudget || 0).toLocaleString()}</span>} />
                          <SettingsRow onClick={() => openEdit('savings', { value: monthlyData.savings }, 0)} left={<span className="text-sm text-zinc-200 font-bold">今月の積立額</span>} right={<span>¥{Number(monthlyData.savings || 0).toLocaleString()}</span>} />
                          <SettingsRow 
                            onClick={() => openEdit('memo', { memo: monthlyData.memo }, 0)} 
                            left={<span className="text-sm text-zinc-200 font-bold">今月のメモ</span>} 
                            right={<span className="text-[10px] text-zinc-500 truncate max-w-[100px]">{monthlyData.memo ? '設定済み' : '未設定'}</span>} 
                          />
                        </div>
                      </SimpleCard>
                      <div className="text-[10px] text-zinc-500 uppercase font-black pl-1">カード設定</div>
                      <SimpleCard className="overflow-hidden">
                        <div className="divide-y divide-white/5">
                          {(config?.paymentMethods || []).filter(m => m !== CASH).map(m => (
                            <SettingsRow
                              key={m}
                              onClick={() => openEdit('bill', { name: m, bill: monthlyData.cardBills?.[m] ?? 0, due: monthlyData.cardDueDates?.[m] ?? '' }, 0)}
                              left={<span className="text-sm text-zinc-200 font-bold">{m}</span>}
                              right={<div className="flex items-center gap-2"><span className="text-xs text-zinc-400 tabular-nums">¥{Number(monthlyData.cardBills?.[m] || 0).toLocaleString()}</span><span className="text-xs text-zinc-500 tabular-nums">{String(monthlyData.cardDueDates?.[m] || '-') }日</span></div>}
                            />
                          ))}
                        </div>
                      </SimpleCard>
                    </div>
                  )}

                  {settingTab === 'fixed' && (
                    <div className="space-y-3 animate-in slide-in-from-right-2">
                      <button type="button" onClick={() => openEdit('fixed', { name: '', amount: '', method: CASH }, -1)} className="w-full h-12 bg-white text-black rounded-lg text-xs tracking-widest active:scale-95 flex items-center justify-center gap-2"><Plus size={16} /> 追加</button>
                      <SimpleCard className="overflow-hidden">
                        <div className="divide-y divide-white/5">
                          {(monthlyData.fixedCosts || []).map((f, idx) => (
                            <SettingsRow
                              key={f.id || idx}
                              onClick={() => openEdit('fixed', f, idx)}
                              left={<div className="flex items-center gap-2 min-w-0 text-left"><span className="text-[9px] px-2 py-1 rounded bg-white/5 text-zinc-400 shrink-0 font-bold">{f.method || '未設定'}</span><span className="text-sm text-zinc-200 truncate text-left font-bold">{f.name}</span></div>}
                              right={<span className="text-sm text-white tabular-nums">¥{Number(f.amount || 0).toLocaleString()}</span>}
                            />
                          ))}
                        </div>
                      </SimpleCard>
                    </div>
                  )}

                  {settingTab === 'category' && (
                    <div className="space-y-3 animate-in slide-in-from-right-2">
                      <button type="button" onClick={() => openEdit('category', { name: '', icon: '🏷', budget: '' }, -1)} className="w-full h-12 bg-white text-black rounded-lg text-xs tracking-widest active:scale-95 flex items-center justify-center gap-2"><Plus size={16} /> 追加</button>
                      <SimpleCard className="overflow-hidden">
                        <div className="divide-y divide-white/5">
                          {(config?.categories || []).map((c, idx) => {
                            const n = c.name;
                            const b = monthlyData.catBudgets?.[n] || 0;
                            return (
                              <SettingsRow
                                key={n}
                                onClick={() => openEdit('category', { ...c, budget: b }, idx)}
                                left={<div className="flex items-center gap-3"><span className="text-xl w-8 text-center">{c.icon || '🏷'}</span><span className="text-sm text-zinc-200 text-left font-bold">{n}</span></div>}
                                right={<span className="text-xs text-zinc-400 tabular-nums">¥{Number(b).toLocaleString()}</span>}
                              />
                            );
                          })}
                        </div>
                      </SimpleCard>
                    </div>
                  )}

                  {settingTab === 'template' && (
                    <div className="space-y-3 animate-in slide-in-from-right-2">
                      <button type="button" onClick={() => openEdit('template', { title: '', amount: '', category: getCategoryNames()[0] || '食費', method: config?.paymentMethods?.[0] || '現金' }, -1)} className="w-full h-12 bg-white text-black rounded-lg text-xs tracking-widest active:scale-95 flex items-center justify-center gap-2"><Plus size={16} /> 追加</button>
                      <SimpleCard className="overflow-hidden">
                        <div className="divide-y divide-white/5">
                          {(config?.templates || []).map((t, idx) => (
                            <SettingsRow
                              key={idx}
                              onClick={() => openEdit('template', t, idx)}
                              left={<div className="flex flex-col items-start text-left min-w-0"><span className="text-sm text-zinc-200 truncate text-left font-bold">{t.title}</span><span className="text-[10px] text-zinc-500 font-bold">{t.category} / {t.method}</span></div>}
                              right={<span className="text-xs text-zinc-400 tabular-nums">¥{Number(t.amount || 0).toLocaleString()}</span>}
                            />
                          ))}
                        </div>
                      </SimpleCard>
                    </div>
                  )}

                  {settingTab === 'payment' && (
                    <div className="space-y-3 animate-in slide-in-from-right-2">
                      <button type="button" onClick={() => openEdit('payment', { name: '' }, -1)} className="w-full h-12 bg-white text-black rounded-lg text-xs tracking-widest active:scale-95 flex items-center justify-center gap-2"><Plus size={16} /> 追加</button>
                      <SimpleCard className="overflow-hidden">
                        <div className="divide-y divide-white/5">
                          {(config?.paymentMethods || []).map((m, idx) => (
                            <SettingsRow key={m} onClick={() => openEdit('payment', { name: m }, idx)} left={<span className="text-sm text-zinc-200 text-left font-bold">{m}</span>} right={null} />
                          ))}
                        </div>
                      </SimpleCard>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </main>

        <footer className="flex-none h-24 border-t border-white/5 flex justify-between items-center px-6 pb-6 bg-[#121212]/80 backdrop-blur-xl z-50">
          <NavButton active={activeTab === 'home'} onClick={() => setActiveTab('home')} icon={<Home size={24} />} />
          <NavButton active={activeTab === 'log'} onClick={() => setActiveTab('log')} icon={<History size={24} />} />
          <NavButton active={activeTab === 'analysis'} onClick={() => setActiveTab('analysis')} icon={<BarChart3 size={24} />} />
          <NavButton active={activeTab === 'settings'} onClick={() => { setActiveTab('settings'); setSettingTab('menu') }} icon={<Settings size={24} />} />
          <button onClick={openTxModalNew} className="flex items-center justify-center w-14 h-14 bg-white text-black rounded-full shadow-[0_0_20px_rgba(255,255,255,0.2)] active:scale-90 ml-2 transition-transform"><Plus size={28} /></button>
        </footer>
      </div>

      {/* ✅ GLOBAL CALCULATOR MODAL */}
      {showCalculator && (
        <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowCalculator(false)}>
          <div className="w-full sm:max-w-md bg-[#1E1E1E] sm:rounded-lg rounded-t-2xl border border-white/5 shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-white/5 flex justify-between items-center">
              <h2 className="text-[10px] font-black uppercase text-white tracking-widest">電卓</h2>
              <button type="button" onClick={() => setShowCalculator(false)} className="p-2 text-zinc-500"><X size={20} /></button>
            </div>
            <div className="p-5 pb-16">
              <CalculatorPad
                initialValue={calcInitialValue}
                onConfirm={(val) => {
                  if (calcOnConfirm) calcOnConfirm(val);
                  setShowCalculator(false);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ✅ MEMO MODAL */}
      {isMemoModalOpen && (
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setIsMemoModalOpen(false)}>
          <div className="w-full sm:max-w-md bg-[#1E1E1E] sm:rounded-lg rounded-t-2xl border border-white/5 shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-white/5 flex justify-between items-center">
              <h2 className="text-xs font-black uppercase text-white tracking-widest flex items-center gap-2"><Pencil size={14} /> 今月のメモ</h2>
              <button type="button" onClick={() => setIsMemoModalOpen(false)} className="p-2 text-zinc-500"><X size={20} /></button>
            </div>
            <div className="p-5 pb-12 flex flex-col gap-4">
              <div className="w-full bg-black/20 rounded-lg p-3">
                <textarea
                  value={memoText}
                  onChange={(e) => setMemoText(e.target.value)}
                  placeholder="今月のやりくりや、特別にお金を使った理由などをメモしておけます。"
                  className="w-full h-32 bg-transparent text-white font-bold text-sm outline-none resize-none leading-relaxed"
                  autoFocus
                />
              </div>
              <button 
                type="button" 
                onClick={handleMemoSave} 
                className="w-full h-12 bg-white text-black font-black rounded-lg text-xs uppercase tracking-widest active:scale-95 transition-transform shadow-xl"
              >
                保存する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✅ COPY SETTINGS MODAL */}
      {isCopyModalOpen && (
        <div className="fixed inset-0 z-[65] flex items-end sm:items-center justify-center sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setIsCopyModalOpen(false)}>
          <div className="w-full sm:max-w-md bg-[#1E1E1E] sm:rounded-lg rounded-t-2xl border border-white/5 shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-white/5 flex justify-between items-center">
              <h2 className="text-xs font-black uppercase text-white tracking-widest">設定をコピー</h2>
              <button type="button" onClick={() => setIsCopyModalOpen(false)} className="p-2 text-zinc-500"><X size={20} /></button>
            </div>

            <div className="p-5 pb-12 space-y-4">
              <div className="text-[10px] text-zinc-500 uppercase font-black pl-1">コピー元の年月</div>
              <div className="w-full overflow-hidden">
                <input
                  type="month"
                  value={copySourceMonth}
                  onChange={e => setCopySourceMonth(e.target.value)}
                  className="w-full max-w-full min-w-0 box-border h-12 bg-black/20 border border-white/10 rounded-lg px-3 text-sm text-white outline-none font-bold"
                />
              </div>
              <div className="text-[10px] text-zinc-600 font-bold">
                {copySourceMonth ? `コピー元：${formatMonthJP(copySourceMonth)} → コピー先：${formatMonthJP(month)}` : '年月を選択してください'}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCopyModalOpen(false)}
                  className="flex-1 h-12 bg-white/5 border border-white/10 text-zinc-300 rounded-lg font-black text-xs uppercase active:bg-white/10"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  onClick={copySettingsFromSelectedMonth}
                  className="flex-1 h-12 bg-white text-black rounded-lg font-black text-xs uppercase active:bg-zinc-200"
                >
                  コピー
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ✅ TX MODAL */}
      {isTxModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setIsTxModalOpen(false)}>
          <div className="w-full max-h-[90vh] sm:h-auto sm:max-w-md bg-[#1E1E1E] sm:rounded-lg rounded-t-2xl border border-white/5 shadow-2xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <>
              <div className="flex-none p-4 border-b border-white/5 flex justify-between items-center">
                <h2 className="text-xs font-black uppercase text-white tracking-widest">{editingTx ? '編集' : '入力'}</h2>
                <button type="button" onClick={() => setIsTxModalOpen(false)} className="p-2 text-zinc-500"><X size={20} /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-5 pb-12">
                <form onSubmit={handleTxSubmit} className="space-y-3">
                  
                  {/* 金額 */}
                  <div className="flex items-center">
                    <label className="w-16 shrink-0 text-[10px] text-zinc-500 font-black uppercase pl-1">金額</label>
                    <div className="flex-1 flex items-center bg-black/20 rounded-lg h-11 px-3">
                      <span className="text-zinc-500 font-bold mr-1">¥</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={inputAmount ? Number(inputAmount).toLocaleString() : ''}
                        onChange={e => { const v = e.target.value.replace(/,/g, ''); if (!isNaN(v)) setInputAmount(v) }}
                        className="flex-1 w-full bg-transparent text-white font-black text-lg outline-none tabular-nums"
                        autoFocus
                        required
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => openCalculator(inputAmount, (val) => setInputAmount(String(val)))}
                      className="text-zinc-400 p-2 ml-1 active:text-white"
                    >
                      <Calculator size={18} />
                    </button>
                  </div>

                  {/* 内容 */}
                  <div className="flex items-center">
                    <label className="w-16 shrink-0 text-[10px] text-zinc-500 font-black uppercase pl-1">内容</label>
                    <div className="flex-1 bg-black/20 rounded-lg h-11 flex items-center px-3">
                      <input 
                        type="text" 
                        value={inputTitle} 
                        onChange={e => setInputTitle(e.target.value)} 
                        className="w-full bg-transparent text-white font-bold text-sm outline-none" 
                        placeholder="例: ランチ" 
                      />
                    </div>
                  </div>

                  {/* 日付 */}
                  <div className="flex items-center">
                    <label className="w-16 shrink-0 text-[10px] text-zinc-500 font-black uppercase pl-1">日付</label>
                    <div className="flex-1 bg-black/20 rounded-lg h-11 flex items-center px-3">
                      <input
                        type="date"
                        value={inputDate}
                        onChange={e => setInputDate(e.target.value)}
                        className="w-full bg-transparent text-white font-bold text-sm outline-none appearance-none text-left block"
                      />
                    </div>
                  </div>

                  {/* カテゴリ */}
                  <div className="flex items-center relative">
                    <label className="w-16 shrink-0 text-[10px] text-zinc-500 font-black uppercase pl-1">カテゴリ</label>
                    <div className="flex-1 bg-black/20 rounded-lg h-11 flex items-center px-3 relative">
                      <select
                        value={inputCategory}
                        onChange={e => setInputCategory(e.target.value)}
                        className="w-full bg-transparent text-white font-bold text-sm outline-none appearance-none pr-6 truncate text-left"
                      >
                        {getCategoryNames().map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <ChevronDown size={14} className="absolute right-3 text-zinc-500 pointer-events-none" />
                    </div>
                  </div>

                  {/* 特別費 */}
                  <div className="flex items-center">
                    <label className="w-16 shrink-0 text-[10px] text-zinc-500 font-black uppercase pl-1">特別費</label>
                    <div className="flex-1 flex items-center h-11">
                      <button
                        type="button"
                        onClick={() => setInputIsSpecial(prev => !prev)}
                        className="w-10 h-6 rounded-full transition-colors relative flex items-center shrink-0 border border-white/10"
                        style={{ backgroundColor: inputIsSpecial ? 'white' : 'rgba(0,0,0,0.4)' }}
                      >
                        <div className={`absolute left-0.5 w-4 h-4 rounded-full transition-transform ${inputIsSpecial ? 'translate-x-[18px] bg-black' : 'translate-x-0 bg-zinc-400'}`} />
                      </button>
                    </div>
                  </div>

                  {/* 支払方法 */}
                  <div className="flex flex-col gap-2 pt-2">
                    <label className="text-[10px] text-zinc-500 font-black uppercase pl-1">支払方法</label>
                    <div className="flex flex-wrap gap-2">
                      {paymentMethodsSafe.map(m => (
                        <label key={m} className="cursor-pointer">
                          <input type="radio" value={m} checked={inputMethod === m} onChange={e => setInputMethod(e.target.value)} className="peer hidden" required />
                          <div className="px-3 py-2 text-[10px] rounded-lg border font-black text-zinc-400 bg-white/5 border-transparent peer-checked:border-white peer-checked:text-white peer-checked:bg-transparent transition-all">
                            {m}
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* テンプレート */}
                  {!editingTx && (
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] text-zinc-500 font-black uppercase pl-1">テンプレート</label>
                      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                        {(config.templates || []).map((t, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => applyTemplate(t)}
                            className="flex-shrink-0 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-[10px] font-bold text-zinc-400 flex items-center gap-1.5 active:bg-white/10 transition-colors"
                          >
                            <Zap size={10} className="text-yellow-400" /> {t.title}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 保存ボタンエリア */}
                  <div className="flex gap-2 pt-4 border-t border-white/5 mt-2">
                    {editingTx && (
                      <button type="button" onClick={async () => {
                        if (window.confirm('削除しますか？')) {
                          await deleteDoc(doc(db, 'users', user.uid, 'transactions', editingTx.id));
                          setIsTxModalOpen(false);
                          showToastMsg('削除しました');
                        }
                      }} className="w-11 h-11 flex items-center justify-center bg-red-900/20 text-red-500 rounded-lg active:bg-red-900/40"><Trash2 size={18} /></button>
                    )}
                    <button type="submit" className="flex-1 h-11 bg-white text-black font-black rounded-lg text-xs uppercase tracking-widest active:bg-zinc-200 shadow-xl">保存する</button>
                  </div>
                </form>
              </div>
            </>
          </div>
        </div>
      )}

      {/* ✅ SETTINGS EDIT MODAL */}
      {editingItem && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setEditingItem(null)}>
          <div className="w-full max-h-[90vh] sm:h-auto sm:max-w-md bg-[#1E1E1E] sm:rounded-lg rounded-t-2xl border border-white/5 shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-white/5 flex justify-between items-center"><h2 className="text-xs font-black uppercase text-white tracking-widest">編集</h2><button type="button" onClick={() => setEditingItem(null)} className="p-2 text-zinc-500"><X size={20} /></button></div>
            <div className="p-5 pb-12 space-y-3">

              {/* Salary / Budgets / Savings */}
              {['salary', 'totalBudget', 'cashBudget', 'savings'].includes(editingItem.type) && (
                <div className="flex items-center">
                  <label className="w-20 shrink-0 text-[10px] text-zinc-500 font-black uppercase pl-1">
                    {editingItem.type === 'salary' ? '手取り給与' : editingItem.type === 'totalBudget' ? '生活費予算' : editingItem.type === 'savings' ? '積立額' : '現金予算'}
                  </label>
                  <div className="flex-1 flex items-center bg-black/20 rounded-lg h-11 px-3">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={String(editingItem.data.value ?? '')}
                      onChange={e => setEditingItem({ ...editingItem, data: { value: e.target.value } })}
                      className="flex-1 w-full bg-transparent text-white font-bold text-sm outline-none tabular-nums text-left"
                    />
                  </div>
                  <button type="button" onClick={() => openCalculator(editingItem.data.value ?? 0, (val) => setEditingItem(prev => ({ ...prev, data: { value: String(val) } })))} className="text-zinc-400 p-2 ml-1 active:text-white"><Calculator size={18} /></button>
                </div>
              )}

              {/* ✅ Memo Edit */}
              {editingItem.type === 'memo' && (
                <div className="flex items-start">
                  <label className="w-20 shrink-0 text-[10px] text-zinc-500 font-black uppercase pl-1 pt-3">今月のメモ</label>
                  <div className="flex-1 bg-black/20 rounded-lg p-3">
                    <textarea
                      value={editingItem.data.memo || ''}
                      onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, memo: e.target.value } })}
                      className="w-full h-32 bg-transparent text-white font-bold text-sm outline-none resize-none leading-relaxed"
                      placeholder="今月のやりくりや、特別にお金を使った理由などをメモしておけます。"
                      autoFocus
                    />
                  </div>
                </div>
              )}

              {/* Bills */}
              {editingItem.type === 'bill' && (
                <>
                  <div className="flex items-center">
                    <label className="w-20 shrink-0 text-[10px] text-zinc-500 font-black uppercase pl-1">カード名</label>
                    <div className="flex-1 h-11 flex items-center px-3">
                      <span className="text-sm text-white font-bold">{editingItem.data.name}</span>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <label className="w-20 shrink-0 text-[10px] text-zinc-500 font-black uppercase pl-1">引落額</label>
                    <div className="flex-1 flex items-center bg-black/20 rounded-lg h-11 px-3">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={String(editingItem.data.bill ?? '')}
                        onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, bill: e.target.value } })}
                        className="flex-1 w-full bg-transparent text-white font-bold text-sm outline-none tabular-nums text-left"
                      />
                    </div>
                    <button type="button" onClick={() => openCalculator(editingItem.data.bill ?? 0, (val) => setEditingItem(prev => ({ ...prev, data: { ...prev.data, bill: String(val) } })))} className="text-zinc-400 p-2 ml-1 active:text-white"><Calculator size={18} /></button>
                  </div>
                  <div className="flex items-center">
                    <label className="w-20 shrink-0 text-[10px] text-zinc-500 font-black uppercase pl-1">引落日</label>
                    <div className="flex-1 bg-black/20 rounded-lg h-11 flex items-center px-3">
                      <input
                        type="number"
                        value={String(editingItem.data.due ?? '')}
                        onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, due: e.target.value } })}
                        className="w-16 bg-transparent text-white font-bold text-sm outline-none tabular-nums text-left"
                      />
                      <span className="text-zinc-500 text-xs font-bold ml-1">日</span>
                    </div>
                  </div>
                </>
              )}

              {/* Category */}
              {editingItem.type === 'category' && (
                <>
                  <div className="flex items-center">
                    <label className="w-20 shrink-0 text-[10px] text-zinc-500 font-black uppercase pl-1">アイコン</label>
                    <div className="flex-1 bg-black/20 rounded-lg h-11 flex items-center px-3">
                      <input value={editingItem.data.icon || ''} onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, icon: e.target.value } })} className="flex-1 bg-transparent text-xl text-white outline-none text-left" />
                    </div>
                  </div>
                  <div className="flex items-center">
                    <label className="w-20 shrink-0 text-[10px] text-zinc-500 font-black uppercase pl-1">名前</label>
                    <div className="flex-1 bg-black/20 rounded-lg h-11 flex items-center px-3">
                      <input value={editingItem.data.name || ''} onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, name: e.target.value } })} className="flex-1 w-full bg-transparent text-white font-bold text-sm outline-none text-left" placeholder="名前" />
                    </div>
                  </div>
                  <div className="flex items-center">
                    <label className="w-20 shrink-0 text-[10px] text-zinc-500 font-black uppercase pl-1">月間予算</label>
                    <div className="flex-1 flex items-center bg-black/20 rounded-lg h-11 px-3">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={editingItem.data.budget ? Number(editingItem.data.budget).toLocaleString() : ''}
                        onChange={e => { const v = e.target.value.replace(/,/g, ''); if (!isNaN(v)) setEditingItem({ ...editingItem, data: { ...editingItem.data, budget: v } }) }}
                        className="flex-1 w-full bg-transparent text-white font-bold text-sm outline-none tabular-nums text-left"
                        placeholder="0"
                      />
                    </div>
                    <button type="button" onClick={() => openCalculator(editingItem.data.budget ?? 0, (val) => setEditingItem(prev => ({ ...prev, data: { ...prev.data, budget: String(val) } })))} className="text-zinc-400 p-2 ml-1 active:text-white"><Calculator size={18} /></button>
                  </div>
                </>
              )}

              {/* Fixed Costs */}
              {editingItem.type === 'fixed' && (
                <>
                  <div className="flex items-center">
                    <label className="w-20 shrink-0 text-[10px] text-zinc-500 font-black uppercase pl-1">固定費名</label>
                    <div className="flex-1 bg-black/20 rounded-lg h-11 flex items-center px-3">
                      <input value={editingItem.data.name || ''} onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, name: e.target.value } })} className="flex-1 w-full bg-transparent text-white font-bold text-sm outline-none text-left" placeholder="固定費名" />
                    </div>
                  </div>
                  <div className="flex items-center">
                    <label className="w-20 shrink-0 text-[10px] text-zinc-500 font-black uppercase pl-1">金額</label>
                    <div className="flex-1 flex items-center bg-black/20 rounded-lg h-11 px-3">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={editingItem.data.amount ? Number(editingItem.data.amount).toLocaleString() : ''}
                        onChange={e => { const v = e.target.value.replace(/,/g, ''); if (!isNaN(v)) setEditingItem({ ...editingItem, data: { ...editingItem.data, amount: v } }) }}
                        className="flex-1 w-full bg-transparent text-white font-bold text-sm outline-none tabular-nums text-left"
                        placeholder="金額"
                      />
                    </div>
                    <button type="button" onClick={() => openCalculator(editingItem.data.amount ?? 0, (val) => setEditingItem(prev => ({ ...prev, data: { ...prev.data, amount: String(val) } })))} className="text-zinc-400 p-2 ml-1 active:text-white"><Calculator size={18} /></button>
                  </div>
                  <div className="flex items-center relative">
                    <label className="w-20 shrink-0 text-[10px] text-zinc-500 font-black uppercase pl-1">支払方法</label>
                    <div className="flex-1 bg-black/20 rounded-lg h-11 flex items-center px-3 relative">
                      <select value={editingItem.data.method || ''} onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, method: e.target.value } })} className="flex-1 w-full bg-transparent text-white font-bold text-sm outline-none appearance-none pr-6 truncate text-left">
                        {config.paymentMethods.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                      <ChevronDown size={14} className="absolute right-3 text-zinc-500 pointer-events-none" />
                    </div>
                  </div>
                </>
              )}

              {/* Template */}
              {editingItem.type === 'template' && (
                <>
                  <div className="flex items-center">
                    <label className="w-20 shrink-0 text-[10px] text-zinc-500 font-black uppercase pl-1">名称</label>
                    <div className="flex-1 bg-black/20 rounded-lg h-11 flex items-center px-3">
                      <input value={editingItem.data.title || ''} onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, title: e.target.value } })} className="flex-1 w-full bg-transparent text-white font-bold text-sm outline-none text-left" placeholder="テンプレート名" />
                    </div>
                  </div>
                  <div className="flex items-center">
                    <label className="w-20 shrink-0 text-[10px] text-zinc-500 font-black uppercase pl-1">金額</label>
                    <div className="flex-1 flex items-center bg-black/20 rounded-lg h-11 px-3">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={editingItem.data.amount ? Number(editingItem.data.amount).toLocaleString() : ''}
                        onChange={e => { const v = e.target.value.replace(/,/g, ''); if (!isNaN(v)) setEditingItem({ ...editingItem, data: { ...editingItem.data, amount: v } }) }}
                        className="flex-1 w-full bg-transparent text-white font-bold text-sm outline-none tabular-nums text-left"
                        placeholder="金額"
                      />
                    </div>
                    <button type="button" onClick={() => openCalculator(editingItem.data.amount ?? 0, (val) => setEditingItem(prev => ({ ...prev, data: { ...prev.data, amount: String(val) } })))} className="text-zinc-400 p-2 ml-1 active:text-white"><Calculator size={18} /></button>
                  </div>
                  <div className="flex items-center relative">
                    <label className="w-20 shrink-0 text-[10px] text-zinc-500 font-black uppercase pl-1">カテゴリ</label>
                    <div className="flex-1 bg-black/20 rounded-lg h-11 flex items-center px-3 relative">
                      <select value={editingItem.data.category || ''} onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, category: e.target.value } })} className="flex-1 w-full bg-transparent text-white font-bold text-sm outline-none appearance-none pr-6 truncate text-left">
                        {getCategoryNames().map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <ChevronDown size={14} className="absolute right-3 text-zinc-500 pointer-events-none" />
                    </div>
                  </div>
                  <div className="flex items-center relative">
                    <label className="w-20 shrink-0 text-[10px] text-zinc-500 font-black uppercase pl-1">支払方法</label>
                    <div className="flex-1 bg-black/20 rounded-lg h-11 flex items-center px-3 relative">
                      <select value={editingItem.data.method || ''} onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, method: e.target.value } })} className="flex-1 w-full bg-transparent text-white font-bold text-sm outline-none appearance-none pr-6 truncate text-left">
                        {config.paymentMethods.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                      <ChevronDown size={14} className="absolute right-3 text-zinc-500 pointer-events-none" />
                    </div>
                  </div>
                </>
              )}

              {/* Payment Method */}
              {editingItem.type === 'payment' && (
                <div className="flex items-center">
                  <label className="w-20 shrink-0 text-[10px] text-zinc-500 font-black uppercase pl-1">名称</label>
                  <div className="flex-1 bg-black/20 rounded-lg h-11 flex items-center px-3">
                    <input value={editingItem.data.name || ''} onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, name: e.target.value } })} className="flex-1 w-full bg-transparent text-white font-bold text-sm outline-none text-left" placeholder="支払方法名" />
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-4 border-t border-white/5">
                {editingItem.index !== -1 && !['salary', 'totalBudget', 'cashBudget', 'savings', 'bill', 'memo'].includes(editingItem.type) && (
                  <button onClick={handleDeleteItem} className="w-11 h-11 flex items-center justify-center bg-red-900/20 text-red-500 rounded-lg active:bg-red-900/40"><Trash2 size={18} /></button>
                )}
                <button onClick={handleSettingsSave} className="flex-1 h-11 bg-white text-black rounded-lg font-black text-xs uppercase active:bg-zinc-200">保存</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// エクスポート（ErrorBoundaryでラップ）
export default function AppWrapper() {
  return (
    <ErrorBoundary>
      <AppMain />
    </ErrorBoundary>
  );
}
