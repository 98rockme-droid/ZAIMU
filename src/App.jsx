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
  PiggyBank
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
  return Number.isFinite(num) ? num : 0;
};

const toISODateSafe = (yyyyMmDd) => new Date(`${yyyyMmDd}T12:00:00`).toISOString();

const isoToLocalYMD = (iso) => {
  if (!iso) return getTodayString();
  const d = new Date(iso);
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
    isSavingsDone: d.isSavingsDone || false
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
  const [homeView, setHomeView] = useState('spending');
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

    const cashBudget = Number(monthlyData?.cashBudget) || 0;
    const spentCash = normalTx.filter(t => t.paymentMethod === CASH).reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const savingsAmount = Number(monthlyData?.savings || 0);

    const specialCash = transactions
      .filter(t => t.isSpecial === true && t.paymentMethod === CASH)
      .reduce((s, t) => s + (Number(t.amount) || 0), 0);

    const cashRemaining = cashBudget - spentCash - savingsAmount - specialCash;

    const billTotal = Object.values(monthlyData?.cardBills || {}).reduce((s, v) => s + (Number(v) || 0), 0);
    const totalWithdrawal = fixedCash + billTotal + savingsAmount;
    const bankBalanceProjected = (Number(monthlyData?.salary) || 0) - totalWithdrawal;

    const catTotals = normalTx.reduce((acc, t) => { acc[t.category] = (acc[t.category] || 0) + (Number(t.amount) || 0); return acc; }, {});
    const catBudgetSum = (config?.categories || []).reduce((sum, c) => sum + (monthlyData?.catBudgets?.[c.name] || 0), 0);
    const lastCatTotals = normalLastTx.reduce((acc, t) => { acc[t.category] = (acc[t.category] || 0) + (Number(t.amount) || 0); return acc; }, {});

    const specialTotalSpent = transactions.filter(t => t.isSpecial === true).reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const lastSpecialTotalSpent = (lastMonthTransactions || []).filter(t => t.isSpecial === true).reduce((s, t) => s + (Number(t.amount) || 0), 0);

    return {
      cardRemaining,
      cashRemaining,
      cardBudget: totalBudget,
      cashBudget,
      bankBalanceProjected,
      fixedTotal,
      totalWithdrawal,
      catBudgetSum,
      savingsAmount,
      cardRemainingPercent: (totalBudget - fixedTotal) > 0 ? Math.round((cardRemaining / (totalBudget - fixedTotal)) * 100) : 0,
      cashRemainingPercent: cashBudget > 0 ? Math.round((cashRemaining / cashBudget) * 100) : 0,
      catTotals,
      lastCatTotals,
      totalSpent: normalTx.reduce((s, t) => s + (Number(t.amount) || 0), 0),
      lastTotalSpent: normalLastTx.reduce((s, t) => s + (Number(t.amount) || 0), 0),
      dailyTotals: normalTx.reduce((acc, t) => { const d = new Date(t.date).getDate(); acc[d] = (acc[d] || 0) + (Number(t.amount) || 0); return acc; }, {}),
      specialTotalSpent,
      lastSpecialTotalSpent
    };
  }, [monthlyData, transactions, lastMonthTransactions, month, config]);

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
    const matchSearch = searchText === '' || (t.title || '').includes(searchText);
    const matchCat = filter.category === 'ALL' || t.category === filter.category;
    const matchMethod = filter.method === 'ALL' || t.paymentMethod === filter.method;
    const matchSpecial = !filter.special || t.isSpecial === true;
    return matchSearch && matchCat && matchMethod && matchSpecial;
  });

  const calendarDaysList = useMemo(() => {
    if (!month) return [];
    const d = new Date(month + "-01");
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
  ];
  const currentSettingTitle = SETTING_MENU_ITEMS.find(item => item.id === settingTab)?.label || '設定';

  return (
    <div className="fixed inset-0 w-full bg-[#121212] text-zinc-200 font-sans flex flex-col justify-center overflow-hidden">
      <Toast message={toast.message} isVisible={toast.visible} />

      <div className="w-full max-w-md h-full flex flex-col relative bg-[#121212] shadow-2xl mx-auto">
        <header className="flex-none h-16 border-b border-white/5 px-4 flex items-center justify-between bg-[#121212]/80 backdrop-blur-xl z-50">
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

        <main ref={mainRef} className="flex-1 overflow-y-auto scrollbar-hide pt-4">
          <div className="p-4 pb-32">
            {/* ...（以下、あなたのコードのまま変更なし）... */}
          </div>
        </main>

        {/* ...（以下、あなたのコードのまま変更なし）... */}
      </div>

      {/* ...（以下、あなたのコードのまま変更なし）... */}
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
