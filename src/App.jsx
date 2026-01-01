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
  Sparkles
} from 'lucide-react';

/* --- FIREBASE CONFIG --- */
const firebaseConfig = {
  apiKey: "AIzaSyD_MMX3Irb-xN1Tql5L0kWJo6BoO_rFX7g",
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

// ✅ UTCズレしない「ローカル年月」
const getMonthString = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
};

const formatMonthJP = (monthStr) => {
  if (!monthStr) return "";
  const [y, m] = monthStr.split('-');
  return `${y}年 ${Number(m)}月`;
};

// ✅ Firestore ISO -> ローカル yyyy-mm-dd
const isoToLocalYYYYMMDD = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const formatDateShort = (isoDateStr) => {
  if (!isoDateStr) return '';
  const d = new Date(isoDateStr);
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
  return isNaN(num) ? 0 : num;
};

// ✅ 00:00だとTZで前日にズレる事があるので正午固定
const toISODateSafe = (yyyyMmDd) => new Date(`${yyyyMmDd}T12:00:00`).toISOString();

/* --- NORMALIZERS --- */
const normalizeMonthlyData = (raw) => {
  const data = raw || {};

  // ✅ 既存の「cardDueDates.三井住友」みたいなドットキーを救済して cardDueDates に吸収
  const absorbedDueDates = { ...(data.cardDueDates || {}) };
  Object.keys(data).forEach((k) => {
    if (k.startsWith('cardDueDates.')) {
      const card = k.replace('cardDueDates.', '');
      absorbedDueDates[card] = String(data[k] ?? '');
    }
  });

  const absorbedCardBills = { ...(data.cardBills || {}) };
  Object.keys(data).forEach((k) => {
    if (k.startsWith('cardBills.')) {
      const card = k.replace('cardBills.', '');
      absorbedCardBills[card] = Number(data[k] ?? 0);
    }
  });

  return {
    salary: data.salary || 0,
    budget: data.budget || 0,
    cashBudget: data.cashBudget || 0,
    cardBills: absorbedCardBills,
    fixedCosts: data.fixedCosts || [],
    catBudgets: data.catBudgets || {},
    cardDueDates: absorbedDueDates,
    confirmedPayments: data.confirmedPayments || []
  };
};

const normalizeConfig = (data) => ({
  categories: data?.categories || [{ name: '食費', icon: '🍔' }],
  paymentMethods: data?.paymentMethods || [CASH],
  templates: data?.templates || []
});

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
          <p className="text-xs text-zinc-500 text-center">再読み込みで復帰することが多いです。</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-white text-black rounded-full font-bold text-sm active:scale-95 transition-transform"
          >
            再読み込み
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const SimpleCard = ({ children, className = "", onClick }) => (
  <div
    onClick={onClick}
    className={`bg-[#1E1E1E] rounded-lg border border-white/5 shadow-lg overflow-hidden w-full box-border ${className}`}
  >
    {children}
  </div>
);

const NavButton = ({ active, onClick, icon }) => (
  <button
    onClick={onClick}
    className={`flex items-center justify-center w-16 h-16 transition-all duration-300 ${
      active ? 'text-white scale-110 drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]' : 'text-zinc-600 hover:text-zinc-400'
    }`}
  >
    {icon}
  </button>
);

const Toast = ({ message, isVisible }) => (
  <div
    className={`fixed bottom-28 left-1/2 -translate-x-1/2 z-[80] transition-all duration-300 pointer-events-none ${
      isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
    }`}
  >
    <div className="bg-zinc-800/90 backdrop-blur-md text-white px-6 py-3 rounded-full border border-white/10 flex items-center gap-2 shadow-2xl">
      <CheckCircle2 size={16} className="text-emerald-400" />
      <span className="text-xs font-bold tracking-wider">{message}</span>
    </div>
  </div>
);

/* --- Calculator --- */
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
      } else {
        stack.push(token);
      }
    }

    let result = parseFloat(stack[0]);
    for (let i = 1; i < stack.length; i += 2) {
      const operator = stack[i];
      const operand = parseFloat(stack[i + 1]);
      if (operator === '+') result += operand;
      if (operator === '-') result -= operand;
    }

    return isNaN(result) ? '0' : result;
  } catch {
    return '0';
  }
};

const CalculatorPad = ({ initialValue, onConfirm }) => {
  const [display, setDisplay] = useState(String(initialValue || '0'));
  const [isResult, setIsResult] = useState(false);

  const handlePush = (val) => {
    if (isResult && !['+','-','*','/'].includes(val)) {
      setDisplay(String(val));
      setIsResult(false);
      return;
    }
    setDisplay(prev => (prev === '0' && !['+','-','*','/','.'].includes(val)) ? String(val) : prev + val);
    setIsResult(false);
  };

  const btns = [
    { l: 'C', act: () => setDisplay('0'), style: 'text-red-400' },
    { l: '/', act: () => handlePush('/'), style: 'text-emerald-400' },
    { l: '*', act: () => handlePush('*'), style: 'text-emerald-400' },
    { l: <Delete size={18}/>, act: () => setDisplay(prev => prev.length > 1 ? prev.slice(0, -1) : '0'), style: 'text-zinc-400' },
    { l: '7', act: () => handlePush('7') }, { l: '8', act: () => handlePush('8') }, { l: '9', act: () => handlePush('9') }, { l: '-', act: () => handlePush('-'), style: 'text-emerald-400' },
    { l: '4', act: () => handlePush('4') }, { l: '5', act: () => handlePush('5') }, { l: '6', act: () => handlePush('6') }, { l: '+', act: () => handlePush('+'), style: 'text-emerald-400' },
    { l: '1', act: () => handlePush('1') }, { l: '2', act: () => handlePush('2') }, { l: '3', act: () => handlePush('3') },
    { l: '=', act: () => { setDisplay(String(safeCalculate(display))); setIsResult(true); }, style: 'bg-emerald-500/20 text-emerald-400 row-span-2' },
    { l: '0', act: () => handlePush('0'), style: 'col-span-2' }, { l: '.', act: () => handlePush('.') },
  ];

  return (
    <div className="w-full flex flex-col gap-3">
      <div className="bg-black/40 rounded-lg p-3 text-right border border-white/5 font-mono text-2xl text-white break-all">
        {display}
      </div>
      <div className="grid grid-cols-4 gap-2 h-64">
        {btns.map((b, i) => (
          <button
            key={i}
            type="button"
            onClick={b.act}
            className={`rounded-lg bg-zinc-800 border border-white/5 text-lg font-bold active:scale-95 transition-all flex items-center justify-center ${b.style || 'text-white'}`}
          >
            {b.l}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onConfirm(toNumber(display))}
        className="w-full h-12 bg-white text-black rounded-lg font-bold tracking-widest active:scale-95 shadow-lg"
      >
        決定
      </button>
    </div>
  );
};

/* --- MODAL SHELL --- */
const ModalShell = ({ title, onClose, children }) => (
  <div
    className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
    onClick={onClose}
  >
    <div
      className="w-full max-h-[90vh] sm:h-auto sm:max-w-md bg-[#1E1E1E] sm:rounded-lg rounded-t-2xl border border-white/5 shadow-2xl flex flex-col overflow-hidden"
      onClick={e => e.stopPropagation()}
    >
      <div className="flex-none p-4 border-b border-white/5 flex justify-between items-center">
        <h2 className="text-xs text-white tracking-widest">{title}</h2>
        <button type="button" onClick={onClose} className="p-2 text-zinc-500">
          <X size={20}/>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-5 pb-10">
        {children}
      </div>
    </div>
  </div>
);

/* --- MAIN APP --- */
function AppMain() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [activeTab, setActiveTab] = useState('home');
  const [homeView, setHomeView] = useState('spending');
  const [logView, setLogView] = useState('list');
  const [settingTab, setSettingTab] = useState('menu');

  const [month, setMonth] = useState(getMonthString(new Date()));

  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: '' });

  const [inputDate, setInputDate] = useState(getTodayString());
  const [inputAmount, setInputAmount] = useState('');
  const [inputTitle, setInputTitle] = useState('');
  const [inputCategory, setInputCategory] = useState('');
  const [inputMethod, setInputMethod] = useState('');

  const [editingTx, setEditingTx] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [lastMonthTransactions, setLastMonthTransactions] = useState([]);

  const [monthlyData, setMonthlyData] = useState(normalizeMonthlyData({}));
  const [config, setConfig] = useState(normalizeConfig({}));

  const [searchText, setSearchText] = useState('');
  const [filter, setFilter] = useState({ category: 'ALL', method: 'ALL' });

  // --- Settings modals ---
  const [modal, setModal] = useState({ type: null, payload: null }); // fixed/category/template/payment

  const mainRef = useRef(null);

  const showToastMsg = (msg) => {
    setToast({ visible: true, message: msg });
    setTimeout(() => setToast({ visible: false, message: '' }), 2500);
  };

  const paymentMethodsSafe = config?.paymentMethods?.length ? config.paymentMethods : [CASH];
  const getCategoryNames = () => (config?.categories || []).map(c => c.name);
  const getCategoryIcon = (name) => {
    const c = (config?.categories || []).find(x => x.name === name);
    return c?.icon || '🏷';
  };

  /* --- AUTH --- */
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
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

    const q = query(
      collection(db, 'users', user.uid, 'transactions'),
      where('date', '>=', start),
      where('date', '<', end)
    );

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
      const q = query(
        collection(db, 'users', user.uid, 'transactions'),
        where('date', '>=', prevStart),
        where('date', '<', currentStart)
      );
      const s = await getDocs(q);
      setLastMonthTransactions(s.docs.map(d => ({ id: d.id, ...d.data() })));
    };

    fetchLast();
  }, [month, user]);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(doc(db, 'users', user.uid, 'months', month), (s) => {
      setMonthlyData(normalizeMonthlyData(s.exists() ? s.data() : {}));
    });
  }, [month, user]);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(doc(db, 'users', user.uid, 'settings', 'config'), (s) => {
      setConfig(normalizeConfig(s.exists() ? s.data() : {}));
    });
  }, [user]);

  /* --- SUMMARY --- */
  const summary = useMemo(() => {
    const fixedCosts = monthlyData?.fixedCosts || [];
    const fixedCashTotal = fixedCosts
      .filter(f => !f.method || f.method === CASH)
      .reduce((s, i) => s + (Number(i.amount) || 0), 0);

    const fixedCardTotal = fixedCosts
      .filter(f => f.method && f.method !== CASH)
      .reduce((s, i) => s + (Number(i.amount) || 0), 0);

    const fixedTotal = fixedCashTotal + fixedCardTotal;

    const totalBudget = Number(monthlyData?.budget) || 0;
    const spentCard = transactions
      .filter(t => t.paymentMethod !== CASH)
      .reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const cardRemaining = totalBudget - fixedTotal - spentCard;

    const cashBudgetTotal = Number(monthlyData?.cashBudget) || 0;
    const spentCash = transactions
      .filter(t => t.paymentMethod === CASH)
      .reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const cashRemaining = cashBudgetTotal - spentCash;

    const billTotal = Object.values(monthlyData?.cardBills || {}).reduce((s, v) => s + (Number(v) || 0), 0);
    const totalWithdrawal = fixedCashTotal + billTotal;
    const bankBalanceProjected = (Number(monthlyData?.salary) || 0) - totalWithdrawal;

    const getCatTotals = (txs) => (txs || []).reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + (Number(t.amount) || 0);
      return acc;
    }, {});

    const catBudgetSum = (config?.categories || []).reduce(
      (sum, c) => sum + (monthlyData?.catBudgets?.[c.name] || 0),
      0
    );

    const now = new Date();
    const isCurrentMonth = month === getMonthString(now);
    const daysLeft = isCurrentMonth
      ? Math.max(1, new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate() + 1)
      : 30;

    return {
      cardRemaining,
      cashRemaining,
      cardBudget: totalBudget,
      cashBudget: cashBudgetTotal,
      bankBalanceProjected,
      fixedTotal,
      totalWithdrawal,
      catBudgetSum,
      cardRemainingPercent: (totalBudget - fixedTotal) > 0 ? Math.round((cardRemaining / (totalBudget - fixedTotal)) * 100) : 0,
      cashRemainingPercent: cashBudgetTotal > 0 ? Math.round((cashRemaining / cashBudgetTotal) * 100) : 0,
      dailyBudget: daysLeft > 0 ? Math.floor(cardRemaining / daysLeft) : 0,
      daysLeft,
      catTotals: getCatTotals(transactions),
      lastCatTotals: getCatTotals(lastMonthTransactions),
      totalSpent: transactions.reduce((s, t) => s + (Number(t.amount) || 0), 0),
      lastTotalSpent: lastMonthTransactions.reduce((s, t) => s + (Number(t.amount) || 0), 0),
      dailyTotals: transactions.reduce((acc, t) => {
        const d = new Date(t.date);
        const day = d.getDate();
        acc[day] = (acc[day] || 0) + (Number(t.amount) || 0);
        return acc;
      }, {})
    };
  }, [monthlyData, transactions, lastMonthTransactions, month, config]);

  /* --- ✅ 引き落としアラート（今月＋7日以内のみ） --- */
  const activeAlerts = useMemo(() => {
    const now = new Date();
    const isCurrentMonth = month === getMonthString(now);
    if (!isCurrentMonth) return [];

    const today = now.getDate();
    const bills = monthlyData?.cardBills || {};
    const dueDates = monthlyData?.cardDueDates || {};
    const confirmed = monthlyData?.confirmedPayments || [];

    return Object.entries(dueDates)
      .map(([card, day]) => [card, Number(day)])
      .filter(([card, dueDay]) => {
        if (!dueDay || Number.isNaN(dueDay)) return false;
        const hasBill = (Number(bills[card]) || 0) > 0;
        const isConfirmed = confirmed.includes(card);
        const within7 = dueDay >= today && (dueDay - today) <= 7;
        return hasBill && !isConfirmed && within7;
      });
  }, [monthlyData, month]);

  const confirmPayment = async (cardName) => {
    if (!user) return;
    const confirmed = monthlyData?.confirmedPayments || [];
    if (confirmed.includes(cardName)) return;

    await setDoc(
      doc(db, 'users', user.uid, 'months', month),
      { confirmedPayments: [...confirmed, cardName] },
      { merge: true }
    );
    showToastMsg('支払いを完了しました');
  };

  /* --- TX CRUD --- */
  const resetTxInputs = (dateStr = getTodayString()) => {
    const cats = getCategoryNames();
    const methods = paymentMethodsSafe;

    setInputDate(dateStr);
    setInputAmount('');
    setInputTitle('');
    setInputCategory(cats[0] || '食費');
    setInputMethod(methods[0] || CASH);
    setShowCalculator(false);
  };

  const startEditing = (t) => {
    const cats = getCategoryNames();
    const methods = paymentMethodsSafe;

    setEditingTx(t);
    setInputDate(isoToLocalYYYYMMDD(t.date) || getTodayString());
    setInputAmount(String(t.amount ?? ''));
    setInputTitle(t.title || '');
    setInputCategory(cats.includes(t.category) ? t.category : (cats[0] || '食費'));
    setInputMethod(methods.includes(t.paymentMethod) ? t.paymentMethod : (methods[0] || CASH));
    setShowCalculator(false);
    setIsTxModalOpen(true);
  };

  const openModalWithDate = (dateStr) => {
    setEditingTx(null);
    resetTxInputs(dateStr);
    setIsTxModalOpen(true);
  };

  const openModalNew = () => {
    setEditingTx(null);
    resetTxInputs(getTodayString());
    setIsTxModalOpen(true);
  };

  const handleTxSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;

    const amount = toNumber(inputAmount);
    const title = (inputTitle || '').trim();
    const category = inputCategory || (getCategoryNames()[0] || '食費');
    const method = inputMethod || (paymentMethodsSafe?.[0] || CASH);

    if (!inputDate) return showToastMsg('日付が未入力です');
    if (!amount || amount <= 0) return showToastMsg('金額が不正です');
    if (!title) return showToastMsg('タイトルを入力してね');

    const payload = {
      date: toISODateSafe(inputDate),
      amount,
      title,
      category,
      paymentMethod: method
    };

    try {
      if (editingTx?.id) {
        await updateDoc(doc(db, 'users', user.uid, 'transactions', editingTx.id), payload);
        showToastMsg('更新しました');
      } else {
        await addDoc(collection(db, 'users', user.uid, 'transactions'), payload);
        showToastMsg('追加しました');
      }
      setIsTxModalOpen(false);
      setEditingTx(null);
    } catch (err) {
      console.error(err);
      showToastMsg('保存に失敗しました');
    }
  };

  /* --- LIST FILTER --- */
  const finalFilteredTx = useMemo(() => {
    return transactions.filter(t => {
      const matchSearch = searchText === '' || (t.title || '').includes(searchText);
      const matchCat = filter.category === 'ALL' || t.category === filter.category;
      const matchMethod = filter.method === 'ALL' || t.paymentMethod === filter.method;
      return matchSearch && matchCat && matchMethod;
    });
  }, [transactions, searchText, filter]);

  const calendarDaysList = useMemo(() => {
    if (!month) return [];
    const d = new Date(`${month}-01T00:00:00`);
    const first = d.getDay();
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    return [...Array(first).fill(null), ...Array.from({ length: last }, (_, i) => i + 1)];
  }, [month]);

  /* --- SETTINGS HELPERS --- */
  const saveConfig = async (patch) => {
    if (!user) return;
    await setDoc(doc(db, 'users', user.uid, 'settings', 'config'), patch, { merge: true });
  };

  const saveMonthDoc = async (patch) => {
    if (!user) return;
    await setDoc(doc(db, 'users', user.uid, 'months', month), patch, { merge: true });
  };

  const copyLastMonthSettings = async () => {
    if (!user || !window.confirm('先月の設定をコピーしますか？')) return;

    const d = new Date(`${month}-01T00:00:00`);
    d.setMonth(d.getMonth() - 1);
    const lastMonthStr = getMonthString(d);

    try {
      const snap = await getDoc(doc(db, 'users', user.uid, 'months', lastMonthStr));
      if (!snap.exists()) return showToastMsg('先月のデータがありません');

      const last = normalizeMonthlyData(snap.data());
      await setDoc(doc(db, 'users', user.uid, 'months', month), {
        budget: last.budget || 0,
        cashBudget: last.cashBudget || 0,
        fixedCosts: last.fixedCosts || [],
        catBudgets: last.catBudgets || {},
        cardBills: last.cardBills || {},
        cardDueDates: last.cardDueDates || {},
        confirmedPayments: []
      }, { merge: true });

      showToastMsg('コピーしました');
    } catch (e) {
      console.error(e);
      showToastMsg('エラーが発生しました');
    }
  };

  const handleExportCSV = async () => {
    if (!user || !window.confirm('全データをCSV出力しますか？')) return;
    try {
      const q = query(collection(db, 'users', user.uid, 'transactions'), orderBy('date', 'desc'));
      const s = await getDocs(q);

      let csv = "\uFEFF日付,タイトル,カテゴリ,金額,支払方法\n";
      s.forEach(dd => {
        const d = dd.data();
        const day = isoToLocalYYYYMMDD(d.date || '');
        const title = String(d.title || '').replace(/"/g, '""');
        csv += `${day},"${title}",${d.category || ''},${d.amount || 0},${d.paymentMethod || ''}\n`;
      });

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `zaimu_export_${getTodayString()}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error(e);
      showToastMsg('エラーが発生しました');
    }
  };

  /* --- RENDER GUARDS --- */
  if (authLoading) {
    return (
      <div className="h-screen bg-[#121212] flex items-center justify-center text-zinc-600">
        読み込み中...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen w-full bg-[#121212] flex flex-col items-center justify-center p-6 space-y-8 animate-in fade-in">
        <div className="text-center">
          <h1 className="text-4xl text-white tracking-tighter">ZAIMU</h1>
        </div>
        <button
          onClick={() => signInWithPopup(auth, new GoogleAuthProvider())}
          className="w-full max-w-xs h-14 bg-white text-black rounded-full flex items-center justify-center gap-3"
        >
          <Lock size={18} /> Googleでログイン
        </button>
      </div>
    );
  }

  const SETTING_MENU_ITEMS = [
    { id: 'budget', label: '資金計画・引落日', icon: <Landmark size={18}/> },
    { id: 'fixed', label: '固定費', icon: <CreditCard size={18}/> },
    { id: 'category', label: 'カテゴリ', icon: <Tags size={18}/> },
    { id: 'template', label: 'テンプレート', icon: <Zap size={18}/> },
    { id: 'payment', label: '支払方法', icon: <Wallet size={18}/> },
  ];

  const currentSettingTitle = SETTING_MENU_ITEMS.find(item => item.id === settingTab)?.label || '設定';

  /* --- SETTINGS UI PIECES --- */
  const SettingsListCard = ({ children }) => (
    <div className="bg-[#1E1E1E] rounded-xl border border-white/5 overflow-hidden">
      <div className="divide-y divide-white/5">
        {children}
      </div>
    </div>
  );

  const SettingsRow = ({ left, right, onClick }) => (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center justify-between px-4 py-4 active:bg-white/5 text-zinc-300 transition-colors"
    >
      <div className="flex items-center gap-3 text-left">
        {left}
      </div>
      {right ? <div className="text-[11px] text-zinc-500">{right}</div> : <div />}
    </button>
  );

  /* --- SETTINGS MODALS (fixed/category/template/payment) --- */
  const closeModal = () => setModal({ type: null, payload: null });

  // Fixed modal
  const FixedModal = () => {
    const isEdit = !!modal.payload?.id;
    const [name, setName] = useState(modal.payload?.name || '');
    const [amount, setAmount] = useState(String(modal.payload?.amount ?? ''));
    const [method, setMethod] = useState(modal.payload?.method || CASH);

    const save = async () => {
      if (!name.trim()) return showToastMsg('名前を入力してね');
      const a = toNumber(amount);
      if (!a || a <= 0) return showToastMsg('金額が不正です');

      const list = [...(monthlyData.fixedCosts || [])];
      const id = isEdit ? modal.payload.id : Date.now();

      const nextItem = { id, name: name.trim(), amount: a, method: method || CASH };

      const next = isEdit
        ? list.map(x => (x.id === id ? nextItem : x))
        : [nextItem, ...list];

      await saveMonthDoc({ fixedCosts: next });
      showToastMsg(isEdit ? '更新しました' : '追加しました');
      closeModal();
    };

    const del = async () => {
      if (!window.confirm('削除しますか？')) return;
      const next = (monthlyData.fixedCosts || []).filter(x => x.id !== modal.payload.id);
      await saveMonthDoc({ fixedCosts: next });
      showToastMsg('削除しました');
      closeModal();
    };

    return (
      <ModalShell title={isEdit ? '固定費を編集' : '固定費を追加'} onClose={closeModal}>
        <div className="space-y-5">
          <div className="space-y-2">
            <label className="text-[10px] text-zinc-500">名前</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full h-11 bg-black/20 border border-white/10 rounded-lg px-4 text-sm text-white outline-none"
              placeholder="例: 家賃"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] text-zinc-500">金額</label>
            <input
              value={amount ? Number(toNumber(amount)).toLocaleString() : ''}
              onChange={e => {
                const v = e.target.value.replace(/,/g, '');
                if (!isNaN(v)) setAmount(v);
              }}
              inputMode="decimal"
              className="w-full h-11 bg-black/20 border border-white/10 rounded-lg px-4 text-sm text-white outline-none tabular-nums"
              placeholder="例: 80000"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] text-zinc-500">支払方法（1行表示）</label>
            <select
              value={method}
              onChange={e => setMethod(e.target.value)}
              className="w-full h-11 bg-black/20 border border-white/10 rounded-lg px-3 text-sm text-white outline-none"
            >
              {paymentMethodsSafe.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div className="flex gap-2 pt-2">
            {isEdit && (
              <button
                type="button"
                onClick={del}
                className="w-12 h-12 flex items-center justify-center bg-red-900/20 text-red-500 rounded-lg active:bg-red-900/40"
              >
                <Trash2 size={18}/>
              </button>
            )}
            <button
              type="button"
              onClick={save}
              className="flex-1 h-12 bg-white text-black rounded-lg text-xs tracking-widest active:bg-zinc-200 shadow-xl"
            >
              保存する
            </button>
          </div>

          <div className="h-5" />
        </div>
      </ModalShell>
    );
  };

  // Category modal
  const CategoryModal = () => {
    const isEdit = !!modal.payload?.name;
    const [name, setName] = useState(modal.payload?.name || '');
    const [icon, setIcon] = useState(modal.payload?.icon || '🏷');

    const save = async () => {
      const n = name.trim();
      if (!n) return showToastMsg('カテゴリ名を入力してね');
      if (n.length > 20) return showToastMsg('カテゴリ名が長すぎます');
      const list = [...(config.categories || [])];

      if (isEdit) {
        // rename: update categories + catBudgets + tx.category
        const old = modal.payload.name;
        const nextCats = list.map(c => (c.name === old ? { ...c, name: n, icon } : c));

        // catBudgets rename
        const cb = { ...(monthlyData.catBudgets || {}) };
        if (old !== n) {
          cb[n] = cb[old] || 0;
          delete cb[old];
        }

        await saveConfig({ categories: nextCats });
        await saveMonthDoc({ catBudgets: cb });

        // tx rename (best-effort)
        try {
          const qAll = query(collection(db, 'users', user.uid, 'transactions'), where('category', '==', old));
          const s = await getDocs(qAll);
          await Promise.all(s.docs.map(d => updateDoc(d.ref, { category: n })));
        } catch {}

        showToastMsg('更新しました');
      } else {
        if (list.some(c => c.name === n)) return showToastMsg('同じ名前のカテゴリがあります');
        await saveConfig({ categories: [{ name: n, icon }, ...list] });

        // catBudgets initial 0
        const cb = { ...(monthlyData.catBudgets || {}) };
        if (cb[n] === undefined) cb[n] = 0;
        await saveMonthDoc({ catBudgets: cb });

        showToastMsg('追加しました');
      }

      closeModal();
    };

    const del = async () => {
      if (!window.confirm('このカテゴリを削除しますか？（履歴のカテゴリはそのまま残ります）')) return;
      const old = modal.payload.name;
      const nextCats = (config.categories || []).filter(c => c.name !== old);

      const cb = { ...(monthlyData.catBudgets || {}) };
      delete cb[old];

      await saveConfig({ categories: nextCats });
      await saveMonthDoc({ catBudgets: cb });
      showToastMsg('削除しました');
      closeModal();
    };

    return (
      <ModalShell title={isEdit ? 'カテゴリを編集' : 'カテゴリを追加'} onClose={closeModal}>
        <div className="space-y-5">
          <div className="space-y-2">
            <label className="text-[10px] text-zinc-500">アイコン</label>
            <input
              value={icon}
              onChange={e => setIcon(e.target.value)}
              className="w-full h-11 bg-black/20 border border-white/10 rounded-lg px-4 text-sm text-white outline-none"
              placeholder="例: 🍖"
            />
            <p className="text-[10px] text-zinc-600">絵文字1文字がおすすめ</p>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] text-zinc-500">カテゴリ名</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full h-11 bg-black/20 border border-white/10 rounded-lg px-4 text-sm text-white outline-none"
              placeholder="例: 食費"
            />
          </div>

          <div className="flex gap-2 pt-2">
            {isEdit && (
              <button
                type="button"
                onClick={del}
                className="w-12 h-12 flex items-center justify-center bg-red-900/20 text-red-500 rounded-lg active:bg-red-900/40"
              >
                <Trash2 size={18}/>
              </button>
            )}
            <button
              type="button"
              onClick={save}
              className="flex-1 h-12 bg-white text-black rounded-lg text-xs tracking-widest active:bg-zinc-200 shadow-xl"
            >
              保存する
            </button>
          </div>

          <div className="h-5" />
        </div>
      </ModalShell>
    );
  };

  // Template modal
  const TemplateModal = () => {
    const isEdit = typeof modal.payload?.index === 'number';
    const [title, setTitle] = useState(modal.payload?.title || '');
    const [category, setCategory] = useState(modal.payload?.category || (getCategoryNames()[0] || '食費'));
    const [amount, setAmount] = useState(String(modal.payload?.amount ?? ''));
    const [method, setMethod] = useState(modal.payload?.method || (paymentMethodsSafe[0] || CASH));

    const save = async () => {
      if (!title.trim()) return showToastMsg('タイトルを入力してね');
      const a = toNumber(amount);
      if (!a || a <= 0) return showToastMsg('金額が不正です');

      const list = [...(config.templates || [])];
      const item = { title: title.trim(), category, amount: a, method };

      if (isEdit) {
        list[modal.payload.index] = item;
        await saveConfig({ templates: list });
        showToastMsg('更新しました');
      } else {
        await saveConfig({ templates: [item, ...list] });
        showToastMsg('追加しました');
      }
      closeModal();
    };

    const del = async () => {
      if (!window.confirm('削除しますか？')) return;
      const list = [...(config.templates || [])];
      list.splice(modal.payload.index, 1);
      await saveConfig({ templates: list });
      showToastMsg('削除しました');
      closeModal();
    };

    return (
      <ModalShell title={isEdit ? 'テンプレートを編集' : 'テンプレートを追加'} onClose={closeModal}>
        <div className="space-y-5">
          <div className="space-y-2">
            <label className="text-[10px] text-zinc-500">タイトル</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full h-11 bg-black/20 border border-white/10 rounded-lg px-4 text-sm text-white outline-none"
              placeholder="例: ランチ"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] text-zinc-500">カテゴリ</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full h-11 bg-black/20 border border-white/10 rounded-lg px-3 text-sm text-white outline-none"
              >
                {getCategoryNames().map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] text-zinc-500">支払方法</label>
              <select
                value={method}
                onChange={e => setMethod(e.target.value)}
                className="w-full h-11 bg-black/20 border border-white/10 rounded-lg px-3 text-sm text-white outline-none"
              >
                {paymentMethodsSafe.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] text-zinc-500">金額</label>
            <input
              value={amount ? Number(toNumber(amount)).toLocaleString() : ''}
              onChange={e => {
                const v = e.target.value.replace(/,/g, '');
                if (!isNaN(v)) setAmount(v);
              }}
              inputMode="decimal"
              className="w-full h-11 bg-black/20 border border-white/10 rounded-lg px-4 text-sm text-white outline-none tabular-nums"
              placeholder="例: 1000"
            />
          </div>

          <div className="flex gap-2 pt-2">
            {isEdit && (
              <button
                type="button"
                onClick={del}
                className="w-12 h-12 flex items-center justify-center bg-red-900/20 text-red-500 rounded-lg active:bg-red-900/40"
              >
                <Trash2 size={18}/>
              </button>
            )}
            <button
              type="button"
              onClick={save}
              className="flex-1 h-12 bg-white text-black rounded-lg text-xs tracking-widest active:bg-zinc-200 shadow-xl"
            >
              保存する
            </button>
          </div>

          <div className="h-5" />
        </div>
      </ModalShell>
    );
  };

  // Payment method modal
  const PaymentModal = () => {
    const isEdit = typeof modal.payload?.index === 'number';
    const [name, setName] = useState(modal.payload?.name || '');

    const save = async () => {
      const n = name.trim();
      if (!n) return showToastMsg('支払方法を入力してね');
      const list = [...paymentMethodsSafe];

      if (isEdit) {
        const old = list[modal.payload.index];
        if (old !== n && list.includes(n)) return showToastMsg('同じ支払方法があります');

        list[modal.payload.index] = n;
        await saveConfig({ paymentMethods: list });

        // fixedCosts method rename
        const fixed = (monthlyData.fixedCosts || []).map(f => (f.method === old ? { ...f, method: n } : f));
        await saveMonthDoc({ fixedCosts: fixed });

        // cardBills / dueDates key rename
        const bills = { ...(monthlyData.cardBills || {}) };
        const dues = { ...(monthlyData.cardDueDates || {}) };
        const conf = [...(monthlyData.confirmedPayments || [])];

        if (old !== n) {
          if (bills[old] !== undefined) { bills[n] = bills[old]; delete bills[old]; }
          if (dues[old] !== undefined) { dues[n] = dues[old]; delete dues[old]; }
          const idx = conf.indexOf(old);
          if (idx >= 0) conf[idx] = n;
        }

        await saveMonthDoc({ cardBills: bills, cardDueDates: dues, confirmedPayments: conf });

        // tx paymentMethod rename (best-effort)
        try {
          const qAll = query(collection(db, 'users', user.uid, 'transactions'), where('paymentMethod', '==', old));
          const s = await getDocs(qAll);
          await Promise.all(s.docs.map(d => updateDoc(d.ref, { paymentMethod: n })));
        } catch {}

        showToastMsg('更新しました');
      } else {
        if (list.includes(n)) return showToastMsg('同じ支払方法があります');
        await saveConfig({ paymentMethods: [n, ...list] });

        // create bills/due slot (optional)
        const bills = { ...(monthlyData.cardBills || {}) };
        const dues = { ...(monthlyData.cardDueDates || {}) };
        if (bills[n] === undefined) bills[n] = 0;
        if (dues[n] === undefined) dues[n] = '';
        await saveMonthDoc({ cardBills: bills, cardDueDates: dues });

        showToastMsg('追加しました');
      }

      closeModal();
    };

    const del = async () => {
      if (!window.confirm('削除しますか？（履歴・固定費の支払方法はそのまま残ります）')) return;
      const list = [...paymentMethodsSafe];
      const old = list[modal.payload.index];
      list.splice(modal.payload.index, 1);

      await saveConfig({ paymentMethods: list });

      const bills = { ...(monthlyData.cardBills || {}) };
      const dues = { ...(monthlyData.cardDueDates || {}) };
      const conf = (monthlyData.confirmedPayments || []).filter(x => x !== old);
      delete bills[old];
      delete dues[old];
      await saveMonthDoc({ cardBills: bills, cardDueDates: dues, confirmedPayments: conf });

      showToastMsg('削除しました');
      closeModal();
    };

    return (
      <ModalShell title={isEdit ? '支払方法を編集' : '支払方法を追加'} onClose={closeModal}>
        <div className="space-y-5">
          <div className="space-y-2">
            <label className="text-[10px] text-zinc-500">支払方法名</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full h-11 bg-black/20 border border-white/10 rounded-lg px-4 text-sm text-white outline-none"
              placeholder="例: 三井住友"
            />
          </div>

          <div className="flex gap-2 pt-2">
            {isEdit && (
              <button
                type="button"
                onClick={del}
                className="w-12 h-12 flex items-center justify-center bg-red-900/20 text-red-500 rounded-lg active:bg-red-900/40"
              >
                <Trash2 size={18}/>
              </button>
            )}
            <button
              type="button"
              onClick={save}
              className="flex-1 h-12 bg-white text-black rounded-lg text-xs tracking-widest active:bg-zinc-200 shadow-xl"
            >
              保存する
            </button>
          </div>

          <div className="h-5" />
        </div>
      </ModalShell>
    );
  };

  /* --- UI --- */
  return (
    <div className="fixed inset-0 w-full bg-[#121212] text-zinc-200 font-sans flex flex-col justify-center overflow-hidden">
      <Toast message={toast.message} isVisible={toast.visible} />

      <div className="w-full max-w-md h-full flex flex-col relative bg-[#121212] shadow-2xl mx-auto">
        <header className="flex-none h-16 border-b border-white/5 px-4 flex items-center justify-between bg-[#121212]/80 backdrop-blur-xl z-50">
          {activeTab === 'settings' && settingTab !== 'menu' ? (
            <>
              <button onClick={() => setSettingTab('menu')} className="text-zinc-400">
                <ArrowLeft size={24}/>
              </button>

              <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center">
                <span className="text-xs text-white tracking-widest">{currentSettingTitle}</span>
                {(settingTab === 'fixed' || settingTab === 'category') && (
                  <span className="text-[10px] text-zinc-500 tabular-nums">
                    計 ¥{(settingTab === 'fixed' ? summary.fixedTotal : summary.catBudgetSum).toLocaleString()}
                  </span>
                )}
              </div>
              <div className="w-6"/>
            </>
          ) : (
            <>
              <div className="w-8 h-8 rounded-xl bg-white/5 p-1">
                <img src="/favicon.ico" referrerPolicy="no-referrer" alt="logo" className="w-full h-full" />
              </div>

              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date(`${month}-01T00:00:00`);
                    d.setMonth(d.getMonth() - 1);
                    setMonth(getMonthString(d));
                  }}
                >
                  <ChevronLeft size={20}/>
                </button>

                <span className="text-sm text-white tabular-nums">
                  {formatMonthJP(month)}
                </span>

                <button
                  type="button"
                  onClick={() => {
                    const d = new Date(`${month}-01T00:00:00`);
                    d.setMonth(d.getMonth() + 1);
                    setMonth(getMonthString(d));
                  }}
                >
                  <ChevronRight size={20}/>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setMonth(getMonthString(new Date()))}
                className="text-zinc-500 active:text-white"
              >
                <Calendar size={20}/>
              </button>
            </>
          )}
        </header>

        <main ref={mainRef} className="flex-1 overflow-y-auto scrollbar-hide pt-4">
          {/* ✅ 余計な下スクロールを減らす：pb-24（footer分） */}
          <div className="p-4 pb-24">

            {/* HOME */}
            {activeTab === 'home' && (
              <div className="space-y-4 animate-in fade-in duration-300">
                <div className="bg-[#1E1E1E] p-1 rounded-xl flex gap-1 mb-2 border border-white/5">
                  <button
                    type="button"
                    onClick={() => setHomeView('spending')}
                    className={`flex-1 py-2 rounded-lg text-xs flex items-center justify-center gap-2 ${
                      homeView === 'spending' ? 'bg-white text-black shadow-lg' : 'text-zinc-500'
                    }`}
                  >
                    <LayoutGrid size={14}/> 支出
                  </button>

                  <button
                    type="button"
                    onClick={() => setHomeView('forecast')}
                    className={`flex-1 py-2 rounded-lg text-xs flex items-center justify-center gap-2 ${
                      homeView === 'forecast' ? 'bg-white text-black shadow-lg' : 'text-zinc-500'
                    }`}
                  >
                    <ListChecks size={14}/> 収支
                  </button>
                </div>

                {homeView === 'spending' ? (
                  <div className="space-y-4 animate-in slide-in-from-left-2">
                    <SimpleCard className="p-6">
                      <div className="flex justify-between mb-4">
                        <div>
                          <p className="text-[10px] text-zinc-500">今月あと使える（カード）</p>
                          <h2 className={`text-4xl mt-1 ${summary.cardRemaining < 0 ? 'text-red-400' : 'text-white'}`}>
                            ¥{summary.cardRemaining.toLocaleString()}
                          </h2>
                        </div>
                        <div className="text-right text-[9px] text-zinc-600">
                          軍資金
                          <p className="text-zinc-400">¥{summary.cardBudget.toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-white transition-all duration-1000" style={{ width: `${summary.cardRemainingPercent}%` }}/>
                      </div>
                    </SimpleCard>

                    <SimpleCard className="p-6">
                      <div className="flex justify-between mb-4">
                        <div>
                          <p className="text-[10px] text-zinc-500">今月あと使える（口座）</p>
                          <h2 className={`text-4xl mt-1 ${summary.cashRemaining < 0 ? 'text-red-400' : 'text-white'}`}>
                            ¥{summary.cashRemaining.toLocaleString()}
                          </h2>
                        </div>
                        <div className="text-right text-[9px] text-zinc-600">
                          軍資金
                          <p className="text-zinc-400">¥{summary.cashBudget.toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-zinc-500 transition-all duration-1000" style={{ width: `${summary.cashRemainingPercent}%` }}/>
                      </div>
                    </SimpleCard>
                  </div>
                ) : (
                  <div className="space-y-4 animate-in slide-in-from-right-2">
                    {/* ✅ 引き落としアラート：7日以内だけ */}
                    {activeAlerts.length > 0 && (
                      <SimpleCard className="bg-red-500/10 border-red-500/30 p-4">
                        <div className="flex items-center gap-2 text-red-400 mb-2 text-xs">
                          <Calendar size={14}/> 支払期日が迫っています
                        </div>

                        <div className="space-y-2">
                          {activeAlerts.map(([card, day]) => (
                            <div key={card} className="flex justify-between items-center bg-black/20 p-2 rounded">
                              <span className="text-xs text-white">
                                {card}（{day}日）
                              </span>

                              <button
                                type="button"
                                onClick={() => confirmPayment(card)}
                                className="text-[10px] bg-red-500 text-white px-3 py-1 rounded-full active:scale-95"
                              >
                                完了
                              </button>
                            </div>
                          ))}
                        </div>
                      </SimpleCard>
                    )}

                    <SimpleCard className="p-5 space-y-3">
                      <div className="flex justify-between items-end">
                        <p className="text-[10px] text-zinc-500">口座残高見込み（引落後）</p>
                        <Banknote size={16} className="text-zinc-600"/>
                      </div>

                      <div className="flex justify-between items-center text-xs text-zinc-400">
                        給与収入
                        <span className="text-sm text-white tabular-nums">+ ¥{monthlyData.salary.toLocaleString()}</span>
                      </div>

                      <div className="flex justify-between items-center text-xs text-zinc-400">
                        引き落とし計
                        <span className="text-sm text-red-400 tabular-nums">- ¥{summary.totalWithdrawal.toLocaleString()}</span>
                      </div>

                      <div className="pt-2 border-t border-white/5 flex justify-between items-end text-xs text-zinc-500">
                        残高予想
                        <span className="text-2xl text-white tabular-nums">¥{summary.bankBalanceProjected.toLocaleString()}</span>
                      </div>
                    </SimpleCard>

                    {/* ✅ ここ戻した：カテゴリ予算 / 消化 */}
                    <div className="grid grid-cols-2 gap-3">
                      {getCategoryNames().map(n => {
                        const spent = summary.catTotals[n] || 0;
                        const budget = monthlyData.catBudgets?.[n] || 0;
                        if (budget === 0) return null;
                        return (
                          <SimpleCard key={n} className="p-3 space-y-2">
                            <div className="flex justify-between items-center text-[10px]">
                              <div className="flex items-center gap-1.5">
                                <span>{getCategoryIcon(n)}</span>
                                <span className="text-zinc-400">{n}</span>
                              </div>
                              <span className="text-white tabular-nums">¥{spent.toLocaleString()} / ¥{budget.toLocaleString()}</span>
                            </div>
                            <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                              <div className="h-full bg-zinc-500" style={{ width: `${Math.min(100, (spent / budget) * 100)}%` }}/>
                            </div>
                          </SimpleCard>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* LOG */}
            {activeTab === 'log' && (
              <div className="animate-in fade-in space-y-4">
                {/* ✅ 絞り込みUIは元の形のまま */}
                <div className="fixed top-16 left-0 right-0 z-40 bg-[#121212]/95 backdrop-blur w-full max-w-md mx-auto border-b border-white/5 px-4 py-3">
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <div className="flex-1 relative">
                        <input
                          type="text"
                          value={searchText}
                          onChange={e => setSearchText(e.target.value)}
                          placeholder="検索..."
                          className="w-full h-10 bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 text-xs text-white outline-none"
                        />
                        <Search size={14} className="absolute left-3 top-3 text-zinc-500"/>
                      </div>

                      <div className="flex bg-[#1E1E1E] rounded-lg border border-white/10 p-0.5">
                        <button
                          type="button"
                          onClick={() => setLogView('list')}
                          className={`p-2 rounded ${logView === 'list' ? 'bg-white text-black' : 'text-zinc-500'}`}
                        >
                          <AlignJustify size={16}/>
                        </button>
                        <button
                          type="button"
                          onClick={() => setLogView('calendar')}
                          className={`p-2 rounded ${logView === 'calendar' ? 'bg-white text-black' : 'text-zinc-500'}`}
                        >
                          <CalendarDays size={16}/>
                        </button>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <select
                        onChange={e => setFilter({ ...filter, category: e.target.value })}
                        className="bg-black/40 border border-white/10 rounded-lg px-2 h-9 text-[10px] flex-1 text-zinc-300 outline-none"
                        value={filter.category}
                      >
                        <option value="ALL">全てのカテゴリ</option>
                        {getCategoryNames().map(c => <option key={c} value={c}>{c}</option>)}
                      </select>

                      <select
                        onChange={e => setFilter({ ...filter, method: e.target.value })}
                        className="bg-black/40 border border-white/10 rounded-lg px-2 h-9 text-[10px] flex-1 text-zinc-300 outline-none"
                        value={filter.method}
                      >
                        <option value="ALL">全ての支払方法</option>
                        {paymentMethodsSafe.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="pt-24">
                  {logView === 'list' ? (
                    <SimpleCard>
                      {finalFilteredTx.length === 0 ? (
                        <div className="py-20 flex flex-col items-center gap-3 text-zinc-400">
                          <Sparkles size={48} className="opacity-70"/>
                          <p className="text-xs">履歴がありません</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-white/5">
                          {finalFilteredTx.map(t => (
                            <div
                              key={t.id}
                              onClick={() => startEditing(t)}
                              className="flex items-center justify-between p-4 cursor-pointer active:bg-white/5 transition-colors"
                            >
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className="w-10 font-mono text-[10px] text-zinc-500">{formatDateShort(t.date)}</div>
                                <div className="w-12 text-center text-[9px] bg-white/5 text-zinc-400 rounded py-0.5 truncate">
                                  {t.category}
                                </div>
                                {/* ✅ 左寄せ固定 */}
                                <div className="flex-1 truncate text-sm text-white text-left">{t.title}</div>
                              </div>
                              <span className="text-sm tabular-nums text-white pl-2">¥{Number(t.amount || 0).toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </SimpleCard>
                  ) : (
                    <SimpleCard className="p-4">
                      <div className="grid grid-cols-7 gap-1 text-center mb-2 text-[10px] text-zinc-600">
                        {['日','月','火','水','木','金','土'].map(d => <div key={d}>{d}</div>)}
                      </div>

                      <div className="grid grid-cols-7 gap-1">
                        {calendarDaysList.map((day, i) => {
                          if (!day) return <div key={i}/>;
                          const a = summary.dailyTotals[day] || 0;
                          const isT = day === new Date().getDate() && month === getMonthString(new Date());
                          const dateStr = `${month}-${String(day).padStart(2, '0')}`;

                          // ✅ ノーマネーデー演出（1パターンだけ）
                          const isNoMoneyDay = a === 0;

                          return (
                            <div
                              key={i}
                              onClick={() => openModalWithDate(dateStr)}
                              className={`aspect-square rounded-lg border flex flex-col items-center justify-center relative transition-transform active:scale-95 ${
                                isT ? 'border-white bg-white/10 shadow-[0_0_10px_rgba(255,255,255,0.1)]' : 'border-white/5 bg-black/20'
                              }`}
                            >
                              <span className={`text-[9px] ${isT ? 'text-white' : 'text-zinc-500'}`}>{day}</span>

                              {a > 0 ? (
                                <span className="text-[8px] text-zinc-300 tabular-nums">
                                  ¥{(a / 1000).toFixed(1)}k
                                </span>
                              ) : (
                                <span className={`text-[12px] ${isNoMoneyDay ? 'opacity-70' : 'opacity-0'}`}>🌿</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </SimpleCard>
                  )}
                </div>
              </div>
            )}

            {/* ANALYSIS */}
            {activeTab === 'analysis' && (
              <div className="space-y-4 animate-in fade-in">
                <SimpleCard className="p-6">
                  <p className="text-[10px] text-zinc-500 tracking-widest mb-4">先月との比較</p>
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <h3 className="text-4xl text-white tabular-nums">¥{summary.totalSpent.toLocaleString()}</h3>
                      <div className={`flex items-center gap-1.5 mt-2 text-xs ${summary.totalSpent <= summary.lastTotalSpent ? 'text-green-400' : 'text-red-400'}`}>
                        {summary.totalSpent <= summary.lastTotalSpent ? <TrendingDown size={16}/> : <TrendingUp size={16}/>}
                        <span>
                          先月より ¥{Math.abs(summary.totalSpent - summary.lastTotalSpent).toLocaleString()} {summary.totalSpent <= summary.lastTotalSpent ? '減少' : '増加'}
                        </span>
                      </div>
                    </div>

                    <div className="text-right text-[10px] text-zinc-600">
                      先月総支出
                      <p className="text-sm text-zinc-500 tabular-nums">¥{summary.lastTotalSpent.toLocaleString()}</p>
                    </div>
                  </div>
                </SimpleCard>

                <SimpleCard className="p-6 space-y-6">
                  <p className="text-[10px] text-zinc-500 tracking-widest">カテゴリ別 比較</p>
                  <div className="space-y-6">
                    {getCategoryNames().map(n => {
                      const c = summary.catTotals[n] || 0;
                      const l = summary.lastCatTotals[n] || 0;
                      const max = Math.max(c, l, 1);
                      return (
                        <div key={n} className="space-y-2">
                          <div className="flex justify-between items-center text-[10px]">
                            <div className="flex items-center gap-2">
                              <span className="text-sm">{getCategoryIcon(n)}</span>
                              <span className="text-zinc-300">{n}</span>
                            </div>
                            <div className="tabular-nums">
                              <span className="text-zinc-600">先月 ¥{l.toLocaleString()}</span>
                              <span className="text-white ml-2">今月 ¥{c.toLocaleString()}</span>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                              <div className="h-full bg-zinc-500 transition-all duration-1000" style={{ width: `${(c / max) * 100}%` }}/>
                            </div>
                            <div className="h-1 bg-white/5 rounded-full overflow-hidden opacity-30">
                              <div className="h-full bg-zinc-400" style={{ width: `${(l / max) * 100}%` }}/>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </SimpleCard>
              </div>
            )}

            {/* SETTINGS */}
            {activeTab === 'settings' && (
              <div className="animate-in fade-in">
                {settingTab === 'menu' ? (
                  <div className="space-y-6 pb-10">
                    <div className="flex items-center justify-between px-2">
                      <div className="flex items-center gap-3">
                        {user.photoURL ? (
                          <img src={user.photoURL} referrerPolicy="no-referrer" alt="icon" className="w-8 h-8 rounded-full border border-white/10"/>
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center">
                            <User size={16}/>
                          </div>
                        )}
                        <span className="text-xs text-white">{user.email}</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => { if (window.confirm('ログアウトしますか？')) signOut(auth); }}
                        className="text-zinc-500 text-[10px] flex items-center gap-1.5 active:text-white"
                      >
                        <LogOut size={14}/> ログアウト
                      </button>
                    </div>

                    <div className="bg-[#1E1E1E] rounded-xl border border-white/5 overflow-hidden">
                      <div className="divide-y divide-white/5">
                        {SETTING_MENU_ITEMS.map(item => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setSettingTab(item.id)}
                            className="w-full flex items-center justify-between px-4 py-5 active:bg-white/5 text-zinc-300 transition-colors"
                          >
                            <div className="flex items-center gap-4">
                              {item.icon}
                              <span className="text-sm">{item.label}</span>
                            </div>
                            {/* ✅ 矢印は薄すぎ問題を回避して、ここは数値だけ（矢印なしでも分かる） */}
                            <div className="flex items-center gap-2 text-[10px] text-zinc-500 tabular-nums">
                              {(item.id === 'fixed' ? `¥${summary.fixedTotal.toLocaleString()}` :
                                item.id === 'category' ? `¥${summary.catBudgetSum.toLocaleString()}` : '')}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col items-center gap-4 pt-4">
                      <button
                        type="button"
                        onClick={copyLastMonthSettings}
                        className="px-6 py-3 border border-white/10 text-zinc-300 rounded-full text-xs active:bg-white/5 transition-all"
                      >
                        <CopyCheck className="inline mr-2" size={16}/> 先月の設定をコピー
                      </button>

                      <button
                        type="button"
                        onClick={handleExportCSV}
                        className="text-zinc-600 text-[10px] underline flex items-center gap-2 active:text-white"
                      >
                        <FileText size={12}/> 全データをCSV出力
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">

                    {/* 資金計画・引落日（戻した構成：資金計画 / カード支払いでエリア分割、矢印なし） */}
                    {settingTab === 'budget' && (
                      <div className="space-y-4 animate-in slide-in-from-right-2">

                        <SimpleCard className="p-5 space-y-4">
                          <p className="text-[10px] text-zinc-500 tracking-widest">資金計画</p>

                          <div className="space-y-3">
                            <div className="flex flex-col gap-1">
                              <label className="text-[10px] text-zinc-600">手取り給与</label>
                              <input
                                type="text"
                                inputMode="decimal"
                                defaultValue={Number(monthlyData.salary || 0).toLocaleString()}
                                onBlur={e => saveMonthDoc({ salary: toNumber(e.target.value) })}
                                className="w-full h-11 bg-black/20 border border-white/10 rounded-lg px-4 text-sm text-white tabular-nums outline-none"
                              />
                            </div>

                            <div className="flex flex-col gap-1">
                              <label className="text-[10px] text-zinc-600">生活費予算（総枠）</label>
                              <input
                                type="text"
                                inputMode="decimal"
                                defaultValue={Number(monthlyData.budget || 0).toLocaleString()}
                                onBlur={e => saveMonthDoc({ budget: toNumber(e.target.value) })}
                                className="w-full h-11 bg-black/20 border border-white/10 rounded-lg px-4 text-sm text-white tabular-nums outline-none"
                              />
                            </div>

                            <div className="flex flex-col gap-1">
                              <label className="text-[10px] text-zinc-600">現金予算（口座用）</label>
                              <input
                                type="text"
                                inputMode="decimal"
                                defaultValue={Number(monthlyData.cashBudget || 0).toLocaleString()}
                                onBlur={e => saveMonthDoc({ cashBudget: toNumber(e.target.value) })}
                                className="w-full h-11 bg-black/20 border border-white/10 rounded-lg px-4 text-sm text-white tabular-nums outline-none"
                              />
                            </div>
                          </div>
                        </SimpleCard>

                        <SimpleCard className="p-5 space-y-4">
                          <p className="text-[10px] text-zinc-500 tracking-widest">カード支払い</p>

                          <div className="space-y-3">
                            {paymentMethodsSafe.filter(m => m !== CASH).map(m => (
                              <div key={m} className="flex gap-2 items-center">
                                <span className="text-[10px] text-zinc-400 w-16 truncate text-left">{m}</span>

                                <input
                                  type="text"
                                  inputMode="decimal"
                                  defaultValue={Number(monthlyData.cardBills?.[m] || 0).toLocaleString()}
                                  onBlur={e => saveMonthDoc({ cardBills: { ...(monthlyData.cardBills || {}), [m]: toNumber(e.target.value) } })}
                                  className="flex-1 h-10 bg-black/20 border border-white/10 rounded-lg px-3 text-xs text-white tabular-nums outline-none"
                                />

                                <input
                                  type="number"
                                  placeholder="日"
                                  defaultValue={monthlyData.cardDueDates?.[m] || ''}
                                  onBlur={e => {
                                    const v = String(e.target.value || '');
                                    saveMonthDoc({ cardDueDates: { ...(monthlyData.cardDueDates || {}), [m]: v } });
                                  }}
                                  className="w-12 h-10 bg-black/20 border border-white/10 rounded-lg text-xs text-center text-white outline-none"
                                />
                              </div>
                            ))}
                          </div>
                        </SimpleCard>

                      </div>
                    )}

                    {/* 固定費 */}
                    {settingTab === 'fixed' && (
                      <div className="space-y-3 animate-in slide-in-from-right-2">
                        <button
                          type="button"
                          onClick={() => setModal({ type: 'fixed', payload: null })}
                          className="w-full h-12 bg-white text-black rounded-lg text-xs tracking-widest active:scale-95 flex items-center justify-center gap-2"
                        >
                          <Plus size={16}/> 追加
                        </button>

                        <SettingsListCard>
                          {(monthlyData.fixedCosts || []).length === 0 ? (
                            <div className="p-6 text-xs text-zinc-600">固定費がまだありません</div>
                          ) : (
                            (monthlyData.fixedCosts || []).map(item => (
                              <SettingsRow
                                key={item.id}
                                onClick={() => setModal({ type: 'fixed', payload: item })}
                                left={
                                  <div className="flex flex-col text-left">
                                    <span className="text-sm text-white">{item.name}</span>
                                    <span className="text-[10px] text-zinc-500">{item.method || CASH}</span>
                                  </div>
                                }
                                right={<span className="tabular-nums">¥{Number(item.amount || 0).toLocaleString()}</span>}
                              />
                            ))
                          )}
                        </SettingsListCard>
                      </div>
                    )}

                    {/* カテゴリ */}
                    {settingTab === 'category' && (
                      <div className="space-y-3 animate-in slide-in-from-right-2">
                        <button
                          type="button"
                          onClick={() => setModal({ type: 'category', payload: null })}
                          className="w-full h-12 bg-white text-black rounded-lg text-xs tracking-widest active:scale-95 flex items-center justify-center gap-2"
                        >
                          <Plus size={16}/> 追加
                        </button>

                        <SettingsListCard>
                          {(config.categories || []).map(c => (
                            <SettingsRow
                              key={c.name}
                              onClick={() => setModal({ type: 'category', payload: c })}
                              left={
                                <div className="flex items-center gap-3 text-left">
                                  <span className="text-lg">{c.icon || '🏷'}</span>
                                  <span className="text-sm text-white">{c.name}</span>
                                </div>
                              }
                              right={<span className="tabular-nums">¥{Number(monthlyData.catBudgets?.[c.name] || 0).toLocaleString()}</span>}
                            />
                          ))}
                        </SettingsListCard>
                      </div>
                    )}

                    {/* テンプレ */}
                    {settingTab === 'template' && (
                      <div className="space-y-3 animate-in slide-in-from-right-2">
                        <button
                          type="button"
                          onClick={() => setModal({ type: 'template', payload: null })}
                          className="w-full h-12 bg-white text-black rounded-lg text-xs tracking-widest active:scale-95 flex items-center justify-center gap-2"
                        >
                          <Plus size={16}/> 追加
                        </button>

                        <SettingsListCard>
                          {(config.templates || []).length === 0 ? (
                            <div className="p-6 text-xs text-zinc-600">テンプレートがまだありません</div>
                          ) : (
                            (config.templates || []).map((t, idx) => (
                              <SettingsRow
                                key={`${t.title}-${idx}`}
                                onClick={() => setModal({ type: 'template', payload: { ...t, index: idx } })}
                                left={
                                  <div className="flex flex-col text-left">
                                    <span className="text-sm text-white">{t.title}</span>
                                    <span className="text-[10px] text-zinc-500">{t.category} / {t.method}</span>
                                  </div>
                                }
                                right={<span className="tabular-nums">¥{Number(t.amount || 0).toLocaleString()}</span>}
                              />
                            ))
                          )}
                        </SettingsListCard>
                      </div>
                    )}

                    {/* 支払方法 */}
                    {settingTab === 'payment' && (
                      <div className="space-y-3 animate-in slide-in-from-right-2">
                        <button
                          type="button"
                          onClick={() => setModal({ type: 'payment', payload: null })}
                          className="w-full h-12 bg-white text-black rounded-lg text-xs tracking-widest active:scale-95 flex items-center justify-center gap-2"
                        >
                          <Plus size={16}/> 追加
                        </button>

                        <SettingsListCard>
                          {paymentMethodsSafe.map((m, idx) => (
                            <SettingsRow
                              key={m}
                              onClick={() => setModal({ type: 'payment', payload: { name: m, index: idx } })}
                              left={<span className="text-sm text-white text-left">{m}</span>}
                              right={null}
                            />
                          ))}
                        </SettingsListCard>
                      </div>
                    )}

                  </div>
                )}
              </div>
            )}

          </div>
        </main>

        <footer className="flex-none h-24 border-t border-white/5 flex justify-between items-center px-6 pb-6 bg-[#121212]/80 backdrop-blur-xl z-50">
          <NavButton active={activeTab==='home'} onClick={() => setActiveTab('home')} icon={<Home size={24}/>}/>
          <NavButton active={activeTab==='log'} onClick={() => setActiveTab('log')} icon={<History size={24}/>}/>
          <NavButton active={activeTab==='analysis'} onClick={() => setActiveTab('analysis')} icon={<BarChart3 size={24}/>}/>
          <NavButton active={activeTab==='settings'} onClick={() => { setActiveTab('settings'); setSettingTab('menu'); }} icon={<Settings size={24}/>}/>
          <button
            type="button"
            onClick={openModalNew}
            className="flex items-center justify-center w-14 h-14 bg-white text-black rounded-full shadow-[0_0_20px_rgba(255,255,255,0.2)] active:scale-90 ml-2 transition-transform"
          >
            <Plus size={28}/>
          </button>
        </footer>
      </div>

      {/* ✅ SETTINGS MODALS */}
      {modal.type === 'fixed' && <FixedModal />}
      {modal.type === 'category' && <CategoryModal />}
      {modal.type === 'template' && <TemplateModal />}
      {modal.type === 'payment' && <PaymentModal />}

      {/* ✅ TRANSACTION MODAL */}
      {isTxModalOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setIsTxModalOpen(false)}
        >
          <div
            className="w-full max-h-[90vh] sm:h-auto sm:max-w-md bg-[#1E1E1E] sm:rounded-lg rounded-t-2xl border border-white/5 shadow-2xl flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {showCalculator ? (
              <div className="flex-1 p-5">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-[10px] tracking-widest text-white">電卓</h2>
                  <button type="button" onClick={() => setShowCalculator(false)} className="text-zinc-500">
                    <X size={18}/>
                  </button>
                </div>
                <CalculatorPad
                  initialValue={inputAmount}
                  onConfirm={val => { setInputAmount(String(val)); setShowCalculator(false); }}
                />
              </div>
            ) : (
              <>
                <div className="flex-none p-4 border-b border-white/5 flex justify-between items-center">
                  <h2 className="text-xs tracking-widest text-white">{editingTx ? '編集' : '入力'}</h2>
                  <button type="button" onClick={() => setIsTxModalOpen(false)} className="p-2 text-zinc-500">
                    <X size={20}/>
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 pb-10">
                  <form onSubmit={handleTxSubmit} className="space-y-6">

                    {/* amount */}
                    <div className="flex gap-2 items-center">
                      <div className="relative flex-1">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 text-lg">¥</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={inputAmount ? Number(toNumber(inputAmount)).toLocaleString() : ''}
                          onChange={e => {
                            const v = e.target.value.replace(/,/g, '');
                            if (!isNaN(v)) setInputAmount(v);
                          }}
                          className="w-full h-12 bg-black/20 border border-white/10 rounded-lg text-lg pl-8 pr-4 text-white tabular-nums outline-none"
                          autoFocus
                          required
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => setShowCalculator(true)}
                        className="w-12 h-12 bg-white/10 rounded-lg text-white flex items-center justify-center active:bg-white/20"
                      >
                        <Calculator size={20}/>
                      </button>
                    </div>

                    {/* title */}
                    <input
                      type="text"
                      value={inputTitle}
                      onChange={e => setInputTitle(e.target.value)}
                      className="w-full h-11 bg-black/20 border border-white/10 rounded-lg px-4 text-sm text-white outline-none text-left"
                      placeholder="タイトル（例: ランチ）"
                      required
                    />

                    {/* date & category (gap戻した) */}
                    <div className="grid grid-cols-2 gap-4 w-full">
                      <div className="flex flex-col">
                        <label className="text-[10px] text-zinc-500 pl-1 mb-2">日付</label>
                        <input
                          type="date"
                          value={inputDate}
                          onChange={e => setInputDate(e.target.value)}
                          className="w-full h-11 bg-black/20 border border-white/10 rounded-lg text-xs px-2 text-white outline-none"
                          required
                        />
                      </div>

                      <div className="flex flex-col">
                        <label className="text-[10px] text-zinc-500 pl-1 mb-2">カテゴリ</label>
                        <select
                          value={inputCategory}
                          onChange={e => setInputCategory(e.target.value)}
                          className="w-full h-11 bg-black/20 border border-white/10 rounded-lg text-xs px-2 text-white outline-none"
                          required
                        >
                          {getCategoryNames().map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* payment method */}
                    <div className="flex flex-wrap gap-2">
                      {paymentMethodsSafe.map(m => (
                        <label key={m} className="cursor-pointer">
                          <input
                            type="radio"
                            value={m}
                            checked={inputMethod === m}
                            onChange={e => setInputMethod(e.target.value)}
                            className="peer hidden"
                            required
                          />
                          <div className="px-3 py-2 text-[10px] rounded-lg border border-zinc-800 text-zinc-400 peer-checked:bg-white peer-checked:text-black transition-all">
                            {m}
                          </div>
                        </label>
                      ))}
                    </div>

                    {/* actions */}
                    <div className="flex gap-2 pt-2">
                      {editingTx && (
                        <button
                          type="button"
                          onClick={async () => {
                            if (!window.confirm('削除しますか？')) return;
                            try {
                              await deleteDoc(doc(db, 'users', user.uid, 'transactions', editingTx.id));
                              setIsTxModalOpen(false);
                              setEditingTx(null);
                              showToastMsg('削除しました');
                            } catch (err) {
                              console.error(err);
                              showToastMsg('削除に失敗しました');
                            }
                          }}
                          className="w-12 h-12 flex items-center justify-center bg-red-900/20 text-red-500 rounded-lg active:bg-red-900/40"
                        >
                          <Trash2 size={18}/>
                        </button>
                      )}

                      <button
                        type="submit"
                        className="flex-1 h-12 bg-white text-black rounded-lg text-xs tracking-widest active:bg-zinc-200 shadow-xl"
                      >
                        保存する
                      </button>
                    </div>

                    {/* ✅ ボタン下に余白20px */}
                    <div className="h-5" />
                  </form>
                </div>
              </>
            )}
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
