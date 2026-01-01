import React, { useEffect, useMemo, useRef, useState } from 'react';
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

const formatDateShort = (dateStr) => {
  const d = new Date(dateStr);
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

const toISODateStart = (yyyyMmDd) => new Date(`${yyyyMmDd}T00:00:00`).toISOString();

const isoToLocalYMD = (iso) => {
  if (!iso) return getTodayString();
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const normalizeMonthlyData = (data) => ({
  salary: data?.salary || 0,
  budget: data?.budget || 0,
  cashBudget: data?.cashBudget || 0,
  cardBills: data?.cardBills || {},
  fixedCosts: data?.fixedCosts || [],
  catBudgets: data?.catBudgets || {},
  cardDueDates: data?.cardDueDates || {},
  confirmedPayments: data?.confirmedPayments || []
});

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
          <h1 className="text-xl font-semibold text-red-400">エラーが発生しました</h1>
          <p className="text-xs text-zinc-500 text-center">再読み込みで復帰することが多いです。</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-white text-black rounded-full font-semibold text-sm active:scale-95 transition-transform"
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
    className={`bg-[#1E1E1E] rounded-xl border border-white/5 shadow-lg overflow-hidden w-full box-border ${className}`}
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
      <span className="text-xs font-semibold tracking-wide">{message}</span>
    </div>
  </div>
);

const RowItem = ({ left, right, onClick, className = "" }) => (
  <button
    type="button"
    onClick={onClick}
    className={`w-full flex items-center justify-between px-4 py-4 active:bg-white/5 transition-colors ${className}`}
  >
    <div className="min-w-0 text-left">{left}</div>
    {right ? <div className="flex items-center gap-2 shrink-0">{right}</div> : <div />}
  </button>
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
      <div className="bg-black/40 rounded-lg p-3 text-right border border-white/5 text-2xl text-white break-all tabular-nums">
        {display}
      </div>
      <div className="grid grid-cols-4 gap-2 h-64">
        {btns.map((b, i) => (
          <button
            key={i}
            type="button"
            onClick={b.act}
            className={`rounded-lg bg-zinc-800 border border-white/5 text-lg font-semibold active:scale-95 transition-all flex items-center justify-center ${b.style || 'text-white'}`}
          >
            {b.l}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onConfirm(toNumber(display))}
        className="w-full h-12 bg-white text-black rounded-lg font-semibold tracking-wide active:scale-95 shadow-lg"
      >
        決定
      </button>
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
  const [toast, setToast] = useState({ visible: false, message: '' });

  const [inputDate, setInputDate] = useState(getTodayString());
  const [inputAmount, setInputAmount] = useState('');
  const [inputTitle, setInputTitle] = useState('');
  const [inputCategory, setInputCategory] = useState('');
  const [inputMethod, setInputMethod] = useState('');

  const [editingTx, setEditingTx] = useState(null);
  const [editingItem, setEditingItem] = useState(null);

  const [transactions, setTransactions] = useState([]);
  const [lastMonthTransactions, setLastMonthTransactions] = useState([]);
  const [monthlyData, setMonthlyData] = useState(normalizeMonthlyData({}));
  const [config, setConfig] = useState(normalizeConfig({}));

  // ✅ 履歴：キーワード検索を戻す
  const [searchText, setSearchText] = useState('');
  const [filter, setFilter] = useState({ category: 'ALL', method: 'ALL' });

  const mainRef = useRef(null);

  const showToastMsg = (msg) => {
    setToast({ visible: true, message: msg });
    setTimeout(() => setToast({ visible: false, message: '' }), 2500);
  };

  const getCategoryNames = () => (config?.categories || []).map(c => c.name);
  const getCategoryIcon = (name) => {
    const c = (config?.categories || []).find(x => x.name === name);
    return c?.icon || '🏷';
  };

  const paymentMethodsSafe = config?.paymentMethods?.length ? config.paymentMethods : [CASH];

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
    const nextDate = new Date(`${month}-01`);
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
    const prevDate = new Date(`${month}-01`);
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
      cardRemainingPercent: (totalBudget - fixedTotal) > 0 ? Math.round((cardRemaining / (totalBudget - fixedTotal)) * 100) : 0,
      cashRemainingPercent: cashBudgetTotal > 0 ? Math.round((cashRemaining / cashBudgetTotal) * 100) : 0,
      dailyBudget: daysLeft > 0 ? Math.floor(cardRemaining / daysLeft) : 0,
      daysLeft,
      catTotals: getCatTotals(transactions),
      lastCatTotals: getCatTotals(lastMonthTransactions),
      totalSpent: transactions.reduce((s, t) => s + (Number(t.amount) || 0), 0),
      lastTotalSpent: lastMonthTransactions.reduce((s, t) => s + (Number(t.amount) || 0), 0),
      dailyTotals: transactions.reduce((acc, t) => {
        const day = new Date(t.date).getDate();
        acc[day] = (acc[day] || 0) + (Number(t.amount) || 0);
        return acc;
      }, {})
    };
  }, [monthlyData, transactions, lastMonthTransactions, month]);

  /* --- 引き落としアラート（この先7日以内のみ / 今月のみ） --- */
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
        return hasBill && !isConfirmed && dueDay >= today && (dueDay - today) <= 7;
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

  const startEditingTx = (t) => {
    const cats = getCategoryNames();
    const methods = paymentMethodsSafe;

    setEditingTx(t);
    setInputDate(isoToLocalYMD(t.date));
    setInputAmount(String(t.amount ?? ''));
    setInputTitle(t.title || '');
    setInputCategory(cats.includes(t.category) ? t.category : (cats[0] || '食費'));
    setInputMethod(methods.includes(t.paymentMethod) ? t.paymentMethod : (methods[0] || CASH));
    setShowCalculator(false);
    setIsTxModalOpen(true);
  };

  const openTxModalWithDate = (dateStr) => {
    setEditingTx(null);
    resetTxInputs(dateStr);
    setIsTxModalOpen(true);
  };

  const openTxModalNew = () => {
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
    const method = inputMethod || (paymentMethodsSafe[0] || CASH);

    if (!inputDate) return showToastMsg('日付が未入力です');
    if (!amount || amount <= 0) return showToastMsg('金額が不正です');
    if (!title) return showToastMsg('タイトルを入力してね');

    const payload = {
      date: toISODateStart(inputDate),
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
    const s = (searchText || '').trim();
    return transactions.filter(t => {
      const title = String(t.title || '');
      const matchSearch = s === '' || title.toLowerCase().includes(s.toLowerCase());
      const matchCat = filter.category === 'ALL' || t.category === filter.category;
      const matchMethod = filter.method === 'ALL' || t.paymentMethod === filter.method;
      return matchSearch && matchCat && matchMethod;
    });
  }, [transactions, searchText, filter]);

  const calendarDaysList = useMemo(() => {
    if (!month) return [];
    const d = new Date(month + "-01");
    const first = d.getDay();
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    return [...Array(first).fill(null), ...Array.from({ length: last }, (_, i) => i + 1)];
  }, [month]);

  /* --- CSV/コピー --- */
  const copyLastMonthSettings = async () => {
    if (!user || !window.confirm('先月の設定をコピーしますか？')) return;

    const d = new Date(month + "-01");
    d.setMonth(d.getMonth() - 1);
    const lastMonthStr = getMonthString(d);

    try {
      const snap = await getDoc(doc(db, 'users', user.uid, 'months', lastMonthStr));
      if (!snap.exists()) return showToastMsg('先月のデータがありません');

      const last = snap.data();
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
        const day = (d.date || '').split('T')[0] || '';
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

  /* --- SETTINGS: CRUD --- */
  const openEdit = (type, data, index = -1) => setEditingItem({ type, data: { ...data }, index });

  const handleSettingsSave = async () => {
    if (!user || !editingItem) return;
    const { type, data, index } = editingItem;

    try {
      if (type === 'budget') {
        await setDoc(doc(db, 'users', user.uid, 'months', month), {
          salary: toNumber(data.salary),
          budget: toNumber(data.budget),
          cashBudget: toNumber(data.cashBudget),
        }, { merge: true });
      }

      if (type === 'bill') {
        const key = data.name;
        await setDoc(doc(db, 'users', user.uid, 'months', month), {
          cardBills: { ...(monthlyData.cardBills || {}), [key]: toNumber(data.bill) },
          cardDueDates: { ...(monthlyData.cardDueDates || {}), [key]: String(data.due || '') }
        }, { merge: true });
      }

      if (type === 'fixed') {
        const list = [...(monthlyData.fixedCosts || [])];
        const item = { ...data, amount: toNumber(data.amount) };
        if (index === -1) list.unshift({ ...item, id: Date.now() });
        else list[index] = { ...list[index], ...item };
        await setDoc(doc(db, 'users', user.uid, 'months', month), { fixedCosts: list }, { merge: true });
      }

      if (type === 'category') {
        const list = [...(config.categories || [])];
        const item = { name: (data.name || '').trim(), icon: data.icon || '🏷' };
        if (!item.name) return showToastMsg('カテゴリ名が空です');
        if (index === -1) list.unshift(item);
        else list[index] = item;

        await setDoc(doc(db, 'users', user.uid, 'settings', 'config'), { ...config, categories: list }, { merge: true });

        if (data.budget !== undefined) {
          await setDoc(doc(db, 'users', user.uid, 'months', month), {
            catBudgets: { ...(monthlyData.catBudgets || {}), [item.name]: toNumber(data.budget) }
          }, { merge: true });
        }
      }

      if (type === 'template') {
        const list = [...(config.templates || [])];
        const item = { ...data, amount: toNumber(data.amount) };
        if (index === -1) list.unshift(item);
        else list[index] = item;
        await setDoc(doc(db, 'users', user.uid, 'settings', 'config'), { ...config, templates: list }, { merge: true });
      }

      if (type === 'payment') {
        const list = [...(config.paymentMethods || [CASH])];
        const name = (data.name || '').trim();
        if (!name) return showToastMsg('支払方法名が空です');
        if (index === -1) list.unshift(name);
        else list[index] = name;
        await setDoc(doc(db, 'users', user.uid, 'settings', 'config'), { ...config, paymentMethods: list }, { merge: true });
      }

      setEditingItem(null);
      showToastMsg('保存しました');
    } catch (e) {
      console.error(e);
      showToastMsg('保存に失敗しました');
    }
  };

  const handleDeleteItem = async () => {
    if (!user || !editingItem) return;
    if (!window.confirm('削除しますか？')) return;

    const { type, index, data } = editingItem;

    try {
      if (type === 'fixed') {
        const list = (monthlyData.fixedCosts || []).filter((_, i) => i !== index);
        await setDoc(doc(db, 'users', user.uid, 'months', month), { fixedCosts: list }, { merge: true });
      }

      if (type === 'category') {
        const list = (config.categories || []).filter((_, i) => i !== index);
        await setDoc(doc(db, 'users', user.uid, 'settings', 'config'), { ...config, categories: list }, { merge: true });
      }

      if (type === 'template') {
        const list = (config.templates || []).filter((_, i) => i !== index);
        await setDoc(doc(db, 'users', user.uid, 'settings', 'config'), { ...config, templates: list }, { merge: true });
      }

      if (type === 'payment') {
        const list = (config.paymentMethods || []).filter((_, i) => i !== index);
        await setDoc(doc(db, 'users', user.uid, 'settings', 'config'), { ...config, paymentMethods: list }, { merge: true });
      }

      if (type === 'bill') {
        const key = data.name;
        const nextBills = { ...(monthlyData.cardBills || {}) };
        const nextDue = { ...(monthlyData.cardDueDates || {}) };
        delete nextBills[key];
        delete nextDue[key];

        await setDoc(doc(db, 'users', user.uid, 'months', month), {
          cardBills: nextBills,
          cardDueDates: nextDue,
          confirmedPayments: (monthlyData.confirmedPayments || []).filter(x => x !== key)
        }, { merge: true });
      }

      setEditingItem(null);
      showToastMsg('削除しました');
    } catch (e) {
      console.error(e);
      showToastMsg('削除に失敗しました');
    }
  };

  /* --- RENDER GUARDS --- */
  if (authLoading) {
    return (
      <div className="h-screen bg-[#121212] flex items-center justify-center text-zinc-600 font-semibold">
        認証を確認しています…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen w-full bg-[#121212] flex flex-col items-center justify-center p-6 space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-semibold text-white tracking-tight">ZAIMU</h1>
        </div>
        <button
          onClick={() => signInWithPopup(auth, new GoogleAuthProvider())}
          className="w-full max-w-xs h-14 bg-white text-black rounded-full font-semibold flex items-center justify-center gap-3 active:scale-95 transition-transform"
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

  // ✅ ホーム＞収支：カテゴリ予算＆消化UI用
  const categoryBudgetRows = useMemo(() => {
    const budgets = monthlyData?.catBudgets || {};
    const names = getCategoryNames();

    const rows = names.map((name) => {
      const budget = Number(budgets[name] || 0);
      const spent = transactions
        .filter(t => t.category === name && t.paymentMethod !== CASH)
        .reduce((s, t) => s + (Number(t.amount) || 0), 0);

      const remaining = budget - spent;
      const pct = budget > 0 ? Math.max(0, Math.min(100, Math.round((spent / budget) * 100))) : 0;

      return {
        name,
        icon: getCategoryIcon(name),
        budget,
        spent,
        remaining,
        pct
      };
    });

    // 予算があるものを上に（なければ並び順そのまま）
    rows.sort((a, b) => (b.budget > 0) - (a.budget > 0));
    return rows;
  }, [monthlyData, transactions, config]);

  return (
    <div className="fixed inset-0 w-full bg-[#121212] text-zinc-200 font-sans font-normal flex flex-col justify-center overflow-hidden">
      <Toast message={toast.message} isVisible={toast.visible} />

      <div className="w-full max-w-md h-full flex flex-col relative bg-[#121212] shadow-2xl mx-auto">
        <header className="flex-none h-16 border-b border-white/5 px-4 flex items-center justify-between bg-[#121212]/80 backdrop-blur-xl z-50">
          {activeTab === 'settings' && settingTab !== 'menu' ? (
            <>
              <button onClick={() => setSettingTab('menu')} className="text-zinc-300 active:text-white">
                <ArrowLeft size={24}/>
              </button>

              <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center">
                <span className="text-xs text-white">{currentSettingTitle}</span>
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
                    const d = new Date(month + "-01");
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
                    const d = new Date(month + "-01");
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
                className="text-zinc-400 active:text-white"
              >
                <Calendar size={20}/>
              </button>
            </>
          )}
        </header>

        <main ref={mainRef} className="flex-1 overflow-y-auto scrollbar-hide pt-4">
          <div className="p-4 pb-28">

            {/* HOME */}
            {activeTab === 'home' && (
              <div className="space-y-4">
                <div className="bg-[#1E1E1E] p-1 rounded-xl flex gap-1 border border-white/5">
                  <button
                    type="button"
                    onClick={() => setHomeView('spending')}
                    className={`flex-1 py-2 rounded-lg text-xs flex items-center justify-center gap-2 ${
                      homeView === 'spending' ? 'bg-white text-black shadow-lg' : 'text-zinc-500'
                    }`}
                  >
                    <LayoutGrid size={14}/> 支出管理
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
                  <div className="space-y-4">
                    <SimpleCard className="p-6">
                      <div className="flex justify-between mb-4">
                        <div>
                          <p className="text-[10px] text-zinc-500">今月あと使える（カード）</p>
                          <h2 className={`text-4xl mt-1 tabular-nums ${summary.cardRemaining < 0 ? 'text-red-400' : 'text-white'}`}>
                            ¥{summary.cardRemaining.toLocaleString()}
                          </h2>
                        </div>
                        <div className="text-right text-[9px] text-zinc-600">
                          軍資金
                          <p className="text-zinc-400 tabular-nums">¥{summary.cardBudget.toLocaleString()}</p>
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
                          <h2 className={`text-4xl mt-1 tabular-nums ${summary.cashRemaining < 0 ? 'text-red-400' : 'text-white'}`}>
                            ¥{summary.cashRemaining.toLocaleString()}
                          </h2>
                        </div>
                        <div className="text-right text-[9px] text-zinc-600">
                          軍資金
                          <p className="text-zinc-400 tabular-nums">¥{summary.cashBudget.toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-zinc-500 transition-all duration-1000" style={{ width: `${summary.cashRemainingPercent}%` }}/>
                      </div>
                    </SimpleCard>
                  </div>
                ) : (
                  <div className="space-y-4">

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
                        <p className="text-[10px] text-zinc-500 tracking-wide">口座残高見込み（引落後）</p>
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

                    {/* ✅ 戻した：カテゴリ別の予算＆消化UI */}
                    <SimpleCard className="p-5">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-[10px] text-zinc-500 tracking-wide">カテゴリ別（カード）</p>
                        <span className="text-[9px] text-zinc-600">予算 / 消化</span>
                      </div>

                      <div className="space-y-4">
                        {categoryBudgetRows.map(r => (
                          <div key={r.name} className="space-y-1">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2 min-w-0 text-left">
                                <span className="text-sm">{r.icon}</span>
                                <span className="text-xs text-zinc-200 truncate">{r.name}</span>
                              </div>

                              <div className="text-right shrink-0 tabular-nums">
                                <div className="text-[10px] text-white">
                                  ¥{r.spent.toLocaleString()} / <span className="text-zinc-400">¥{r.budget.toLocaleString()}</span>
                                </div>
                                <div className={`text-[9px] ${r.remaining < 0 ? 'text-red-400' : 'text-zinc-500'}`}>
                                  残り ¥{r.remaining.toLocaleString()}
                                </div>
                              </div>
                            </div>

                            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                              <div className="h-full bg-white transition-all duration-700" style={{ width: `${r.pct}%` }}/>
                            </div>
                          </div>
                        ))}

                        {categoryBudgetRows.length === 0 && (
                          <div className="py-8 text-center text-xs text-zinc-500">
                            カテゴリがありません
                          </div>
                        )}
                      </div>
                    </SimpleCard>
                  </div>
                )}
              </div>
            )}

            {/* LOG */}
            {activeTab === 'log' && (
              <div className="space-y-4">

                {/* ✅ 戻した：絞り込み + キーワード検索 */}
                <SimpleCard className="p-3 space-y-2">
                  <div className="flex gap-2 items-center">
                    <select
                      onChange={e => setFilter({ ...filter, category: e.target.value })}
                      className="bg-black/40 border border-white/10 rounded-lg px-2 h-10 text-[10px] flex-1 text-zinc-300 outline-none"
                      value={filter.category}
                    >
                      <option value="ALL">カテゴリ</option>
                      {getCategoryNames().map(c => <option key={c} value={c}>{c}</option>)}
                    </select>

                    <select
                      onChange={e => setFilter({ ...filter, method: e.target.value })}
                      className="bg-black/40 border border-white/10 rounded-lg px-2 h-10 text-[10px] flex-1 text-zinc-300 outline-none"
                      value={filter.method}
                    >
                      <option value="ALL">支払方法</option>
                      {(paymentMethodsSafe || []).map(m => <option key={m} value={m}>{m}</option>)}
                    </select>

                    <div className="flex bg-black/30 rounded-lg border border-white/10 p-0.5 shrink-0">
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

                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input
                      value={searchText}
                      onChange={(e) => setSearchText(e.target.value)}
                      className="w-full h-10 bg-black/40 border border-white/10 rounded-lg pl-9 pr-3 text-[10px] text-zinc-200 outline-none"
                      placeholder="キーワード検索（例：ランチ / Amazon）"
                    />
                  </div>
                </SimpleCard>

                {logView === 'list' ? (
                  <SimpleCard>
                    {finalFilteredTx.length === 0 ? (
                      <div className="py-20 flex flex-col items-center gap-3 text-zinc-400">
                        <Sparkles size={48} className="opacity-60"/>
                        <p className="text-xs">履歴がまだありません</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-white/5">
                        {finalFilteredTx.map(t => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => startEditingTx(t)}
                            className="w-full flex items-center justify-between px-4 py-4 active:bg-white/5 transition-colors"
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0 text-left">
                              <div className="w-10 text-[10px] text-zinc-500 tabular-nums text-left">
                                {formatDateShort(t.date)}
                              </div>
                              <div className="w-12 text-center text-[9px] bg-white/5 text-zinc-400 rounded py-0.5 truncate">
                                {t.category}
                              </div>
                              <div className="flex-1 truncate text-sm text-white text-left">
                                {t.title}
                              </div>
                            </div>
                            <span className="text-sm text-white tabular-nums pl-2">¥{Number(t.amount || 0).toLocaleString()}</span>
                          </button>
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
                        const isPastOrToday = new Date(dateStr) <= new Date(getTodayString());

                        return (
                          <div
                            key={i}
                            onClick={() => openTxModalWithDate(dateStr)}
                            className={`aspect-square rounded-lg border flex flex-col items-center justify-center relative transition-transform active:scale-95 ${
                              isT ? 'border-white bg-white/10' : 'border-white/5 bg-black/20'
                            }`}
                          >
                            <span className={`text-[9px] ${isT ? 'text-white' : 'text-zinc-500'}`}>{day}</span>
                            {a > 0 && (
                              <span className="text-[8px] text-zinc-300 tabular-nums">
                                ¥{(a / 1000).toFixed(1)}k
                              </span>
                            )}
                            {a === 0 && isPastOrToday && !isT && <span className="absolute text-[10px]">✨</span>}
                          </div>
                        );
                      })}
                    </div>
                  </SimpleCard>
                )}
              </div>
            )}

            {/* ANALYSIS */}
            {activeTab === 'analysis' && (
              <div className="space-y-4">
                <SimpleCard className="p-6">
                  <p className="text-[10px] text-zinc-500 tracking-wide mb-4">先月との比較</p>
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <h3 className="text-4xl text-white tabular-nums">¥{summary.totalSpent.toLocaleString()}</h3>
                      <div className={`flex items-center gap-1.5 mt-2 text-xs ${summary.totalSpent <= summary.lastTotalSpent ? 'text-green-400' : 'text-red-400'}`}>
                        {summary.totalSpent <= summary.lastTotalSpent ? <TrendingDown size={16}/> : <TrendingUp size={16}/>}
                        <span className="tabular-nums">
                          先月より ¥{Math.abs(summary.totalSpent - summary.lastTotalSpent).toLocaleString()} {summary.totalSpent <= summary.lastTotalSpent ? '減少' : '増加'}
                        </span>
                      </div>
                    </div>

                    <div className="text-right text-[10px] text-zinc-600">
                      先月総支出
                      <p className="text-sm text-zinc-400 tabular-nums">¥{summary.lastTotalSpent.toLocaleString()}</p>
                    </div>
                  </div>
                </SimpleCard>

                <SimpleCard className="p-6 space-y-6">
                  <p className="text-[10px] text-zinc-500 tracking-wide">カテゴリ別 比較</p>
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
              <div>
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
                        <span className="text-xs text-white truncate">{user.email}</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => { if (window.confirm('ログアウトしますか？')) signOut(auth); }}
                        className="text-zinc-400 text-[10px] flex items-center gap-1.5 active:text-white"
                      >
                        <LogOut size={14}/> ログアウト
                      </button>
                    </div>

                    <SimpleCard className="overflow-hidden">
                      <div className="divide-y divide-white/5">
                        {SETTING_MENU_ITEMS.map(item => (
                          <RowItem
                            key={item.id}
                            onClick={() => setSettingTab(item.id)}
                            left={
                              <div className="flex items-center gap-4">
                                <div className="text-zinc-300">{item.icon}</div>
                                <span className="text-sm text-zinc-200">{item.label}</span>
                              </div>
                            }
                            right={<ChevronRight size={16} className="text-zinc-400"/>}
                          />
                        ))}
                      </div>
                    </SimpleCard>

                    <div className="flex flex-col items-center gap-4 pt-2">
                      <button
                        type="button"
                        onClick={copyLastMonthSettings}
                        className="px-6 py-3 border border-white/10 text-zinc-300 rounded-full text-xs active:bg-white/5 transition-colors"
                      >
                        <CopyCheck className="inline mr-2" size={16}/> 先月の設定をコピー
                      </button>

                      <button
                        type="button"
                        onClick={handleExportCSV}
                        className="text-zinc-500 text-[10px] underline flex items-center gap-2 active:text-white"
                      >
                        <FileText size={12}/> 全データをCSV出力
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* 追加ボタン（上） */}
                    <div className="mb-3">
                      {settingTab === 'fixed' && (
                        <button
                          type="button"
                          onClick={() => openEdit('fixed', { name: '', amount: '', method: CASH }, -1)}
                          className="w-full h-11 bg-white text-black rounded-lg text-xs active:scale-95 transition-transform"
                        >
                          固定費を追加
                        </button>
                      )}

                      {settingTab === 'category' && (
                        <button
                          type="button"
                          onClick={() => openEdit('category', { name: '', icon: '🏷', budget: '' }, -1)}
                          className="w-full h-11 bg-white text-black rounded-lg text-xs active:scale-95 transition-transform"
                        >
                          カテゴリを追加
                        </button>
                      )}

                      {settingTab === 'template' && (
                        <button
                          type="button"
                          onClick={() => openEdit('template', { title: '', amount: '', category: getCategoryNames()[0] || '食費', method: paymentMethodsSafe[0] || CASH }, -1)}
                          className="w-full h-11 bg-white text-black rounded-lg text-xs active:scale-95 transition-transform"
                        >
                          テンプレートを追加
                        </button>
                      )}

                      {settingTab === 'payment' && (
                        <button
                          type="button"
                          onClick={() => openEdit('payment', { name: '' }, -1)}
                          className="w-full h-11 bg-white text-black rounded-lg text-xs active:scale-95 transition-transform"
                        >
                          支払方法を追加
                        </button>
                      )}
                    </div>

                    {/* ✅ 戻した：資金計画 / カード支払いを分ける、右端矢印なし */}
                    {settingTab === 'budget' && (
                      <div className="space-y-4">
                        <SimpleCard className="overflow-hidden">
                          <div className="px-4 pt-4 pb-2">
                            <div className="text-[10px] text-zinc-500 tracking-wide">資金計画</div>
                          </div>
                          <div className="divide-y divide-white/5">
                            <RowItem
                              onClick={() => openEdit('budget', {
                                salary: monthlyData.salary,
                                budget: monthlyData.budget,
                                cashBudget: monthlyData.cashBudget
                              }, 0)}
                              left={<span className="text-sm text-zinc-200">手取り・予算</span>}
                              right={
                                <div className="text-right">
                                  <div className="text-[10px] text-zinc-400 tabular-nums">
                                    給与 ¥{Number(monthlyData.salary || 0).toLocaleString()}
                                  </div>
                                  <div className="text-[10px] text-zinc-500 tabular-nums">
                                    生活費 ¥{Number(monthlyData.budget || 0).toLocaleString()} / 現金 ¥{Number(monthlyData.cashBudget || 0).toLocaleString()}
                                  </div>
                                </div>
                              }
                            />
                          </div>
                        </SimpleCard>

                        <SimpleCard className="overflow-hidden">
                          <div className="px-4 pt-4 pb-2">
                            <div className="text-[10px] text-zinc-500 tracking-wide">カード支払い</div>
                          </div>
                          <div className="divide-y divide-white/5">
                            {(paymentMethodsSafe || []).filter(m => m !== CASH).map(m => (
                              <RowItem
                                key={m}
                                onClick={() => openEdit('bill', {
                                  name: m,
                                  bill: monthlyData.cardBills?.[m] ?? 0,
                                  due: monthlyData.cardDueDates?.[m] ?? ''
                                }, 0)}
                                left={<span className="text-sm text-zinc-200">{m}</span>}
                                right={
                                  <div className="flex items-center gap-4">
                                    <span className="text-xs text-zinc-400 tabular-nums">
                                      ¥{Number(monthlyData.cardBills?.[m] || 0).toLocaleString()}
                                    </span>
                                    <span className="text-xs text-zinc-500 tabular-nums">
                                      {String(monthlyData.cardDueDates?.[m] || '-') }日
                                    </span>
                                  </div>
                                }
                              />
                            ))}
                          </div>
                        </SimpleCard>
                      </div>
                    )}

                    {settingTab === 'fixed' && (
                      <SimpleCard className="overflow-hidden">
                        <div className="divide-y divide-white/5">
                          {(monthlyData.fixedCosts || []).map((f, idx) => (
                            <RowItem
                              key={f.id || idx}
                              onClick={() => openEdit('fixed', f, idx)}
                              left={
                                <div className="flex items-center gap-2 min-w-0 text-left">
                                  <span className="text-[9px] px-2 py-1 rounded bg-white/5 text-zinc-400 shrink-0">
                                    {f.method || '未設定'}
                                  </span>
                                  <span className="text-sm text-zinc-200 truncate text-left">
                                    {f.name}
                                  </span>
                                </div>
                              }
                              right={<span className="text-sm text-white tabular-nums">¥{Number(f.amount || 0).toLocaleString()}</span>}
                            />
                          ))}
                        </div>
                      </SimpleCard>
                    )}

                    {settingTab === 'category' && (
                      <SimpleCard className="overflow-hidden">
                        <div className="divide-y divide-white/5">
                          {(config.categories || []).map((c, idx) => {
                            const n = c.name;
                            const b = monthlyData.catBudgets?.[n] || 0;
                            return (
                              <RowItem
                                key={n}
                                onClick={() => openEdit('category', { ...c, budget: b }, idx)}
                                left={
                                  <div className="flex items-center gap-3">
                                    <span className="text-xl w-8 text-center">{c.icon || '🏷'}</span>
                                    <span className="text-sm text-zinc-200 text-left">{n}</span>
                                  </div>
                                }
                                right={<span className="text-xs text-zinc-400 tabular-nums">¥{Number(b).toLocaleString()}</span>}
                              />
                            );
                          })}
                        </div>
                      </SimpleCard>
                    )}

                    {settingTab === 'template' && (
                      <SimpleCard className="overflow-hidden">
                        <div className="divide-y divide-white/5">
                          {(config.templates || []).map((t, idx) => (
                            <RowItem
                              key={idx}
                              onClick={() => openEdit('template', t, idx)}
                              left={
                                <div className="flex flex-col items-start text-left min-w-0">
                                  <span className="text-sm text-zinc-200 truncate text-left">{t.title}</span>
                                  <span className="text-[10px] text-zinc-500">
                                    {t.category} / {t.method}
                                  </span>
                                </div>
                              }
                              right={<span className="text-xs text-zinc-400 tabular-nums">¥{Number(t.amount || 0).toLocaleString()}</span>}
                            />
                          ))}
                        </div>
                      </SimpleCard>
                    )}

                    {settingTab === 'payment' && (
                      <SimpleCard className="overflow-hidden">
                        <div className="divide-y divide-white/5">
                          {(paymentMethodsSafe || []).map((m, idx) => (
                            <RowItem
                              key={m}
                              onClick={() => openEdit('payment', { name: m }, idx)}
                              left={<span className="text-sm text-zinc-200 text-left">{m}</span>}
                              right={null}
                            />
                          ))}
                        </div>
                      </SimpleCard>
                    )}
                  </>
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
            onClick={openTxModalNew}
            className="flex items-center justify-center w-14 h-14 bg-white text-black rounded-full shadow-[0_0_20px_rgba(255,255,255,0.2)] active:scale-90 ml-2 transition-transform"
          >
            <Plus size={28}/>
          </button>
        </footer>
      </div>

      {/* TX MODAL */}
      {isTxModalOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setIsTxModalOpen(false)}
        >
          <div
            className="w-full max-h-[90vh] sm:h-auto sm:max-w-md bg-[#1E1E1E] sm:rounded-lg rounded-t-2xl border border-white/5 shadow-2xl flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {showCalculator ? (
              <div className="flex-1 p-5">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-[10px] text-white tracking-widest">電卓</h2>
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
                  <h2 className="text-xs text-white tracking-widest">{editingTx ? '編集' : '入力'}</h2>
                  <button type="button" onClick={() => setIsTxModalOpen(false)} className="p-2 text-zinc-500">
                    <X size={20}/>
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 pb-8">
                  <form onSubmit={handleTxSubmit} className="space-y-6">
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

                    <input
                      type="text"
                      value={inputTitle}
                      onChange={e => setInputTitle(e.target.value)}
                      className="w-full h-11 bg-black/20 border border-white/10 rounded-lg px-4 text-sm text-white outline-none text-left"
                      placeholder="タイトル（例：ランチ）"
                      required
                    />

                    <div className="grid grid-cols-2 gap-4 w-full">
                      <div className="flex flex-col">
                        <label className="text-[9px] text-zinc-500 pl-1 mb-2">日付</label>
                        <input
                          type="date"
                          value={inputDate}
                          onChange={e => setInputDate(e.target.value)}
                          className="w-full h-11 bg-black/20 border border-white/10 rounded-lg text-xs px-2 text-white outline-none"
                          required
                        />
                      </div>

                      <div className="flex flex-col">
                        <label className="text-[9px] text-zinc-500 pl-1 mb-2">カテゴリ</label>
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

                    <div className="flex flex-wrap gap-2">
                      {(paymentMethodsSafe || []).map(m => (
                        <label key={m} className="cursor-pointer">
                          <input
                            type="radio"
                            value={m}
                            checked={inputMethod === m}
                            onChange={e => setInputMethod(e.target.value)}
                            className="peer hidden"
                            required
                          />
                          <div className="px-3 py-2 text-[10px] rounded-lg border border-zinc-800 text-zinc-500 peer-checked:bg-white peer-checked:text-black transition-all">
                            {m}
                          </div>
                        </label>
                      ))}
                    </div>

                    <div className="flex gap-2 pt-2 pb-2">
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

                    <div className="h-5" />
                  </form>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* SETTINGS EDIT MODAL */}
      {editingItem && (
        <div
          className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setEditingItem(null)}
        >
          <div
            className="w-full max-h-[90vh] sm:h-auto sm:max-w-md bg-[#1E1E1E] sm:rounded-lg rounded-t-2xl border border-white/5 shadow-2xl flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 border-b border-white/5 flex justify-between items-center">
              <h2 className="text-xs text-white tracking-widest">編集</h2>
              <button onClick={() => setEditingItem(null)} className="p-2 text-zinc-500">
                <X size={20}/>
              </button>
            </div>

            <div className="p-5 pb-8 space-y-6 overflow-y-auto">
              {editingItem.type === 'budget' && (
                <>
                  <div className="space-y-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] text-zinc-500 pl-1">手取り給与</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={String(editingItem.data.salary ?? '')}
                        onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, salary: e.target.value } })}
                        className="w-full h-11 bg-black/20 border border-white/10 rounded-lg px-4 text-sm text-white tabular-nums outline-none"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] text-zinc-500 pl-1">生活費予算（総枠）</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={String(editingItem.data.budget ?? '')}
                        onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, budget: e.target.value } })}
                        className="w-full h-11 bg-black/20 border border-white/10 rounded-lg px-4 text-sm text-white tabular-nums outline-none"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text_[9px] text-zinc-500 pl-1">現金予算（口座用）</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={String(editingItem.data.cashBudget ?? '')}
                        onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, cashBudget: e.target.value } })}
                        className="w-full h-11 bg-black/20 border border-white/10 rounded-lg px-4 text-sm text-white tabular-nums outline-none"
                      />
                    </div>
                  </div>
                </>
              )}

              {editingItem.type === 'bill' && (
                <>
                  <div className="text-xs text-zinc-300">{editingItem.data.name}</div>
                  <div className="flex gap-2 items-center">
                    <div className="flex-1 flex flex-col gap-1">
                      <label className="text-[9px] text-zinc-500 pl-1">引き落とし額</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={String(editingItem.data.bill ?? '')}
                        onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, bill: e.target.value } })}
                        className="w-full h-11 bg-black/20 border border-white/10 rounded-lg px-3 text-sm text-white tabular-nums outline-none"
                      />
                    </div>
                    <div className="w-20 flex flex-col gap-1">
                      <label className="text-[9px] text-zinc-500 pl-1">引き落とし日</label>
                      <input
                        type="number"
                        value={String(editingItem.data.due ?? '')}
                        onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, due: e.target.value } })}
                        className="w-full h-11 bg-black/20 border border-white/10 rounded-lg px-3 text-sm text-white tabular-nums outline-none"
                      />
                    </div>
                  </div>
                </>
              )}

              {editingItem.type === 'fixed' && (
                <>
                  <input
                    value={editingItem.data.name || ''}
                    onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, name: e.target.value } })}
                    className="w-full h-11 bg-black/20 border border-white/10 rounded-lg px-3 text-sm text-white outline-none text-left"
                    placeholder="固定費名"
                  />
                  <input
                    type="text"
                    inputMode="decimal"
                    value={String(editingItem.data.amount ?? '')}
                    onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, amount: e.target.value } })}
                    className="w-full h-11 bg-black/20 border border-white/10 rounded-lg px-3 text-sm text-white tabular-nums outline-none"
                    placeholder="金額"
                  />
                  <select
                    value={editingItem.data.method || CASH}
                    onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, method: e.target.value } })}
                    className="w-full h-11 bg-black/20 border border-white/10 rounded-lg px-3 text-sm text-white outline-none"
                  >
                    {(paymentMethodsSafe || []).map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </>
              )}

              {editingItem.type === 'category' && (
                <>
                  <div className="flex gap-2">
                    <input
                      value={editingItem.data.icon || ''}
                      onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, icon: e.target.value } })}
                      className="w-12 h-11 text-center bg-black/20 border border-white/10 rounded-lg text-xl text-white outline-none"
                      placeholder="🏷"
                    />
                    <input
                      value={editingItem.data.name || ''}
                      onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, name: e.target.value } })}
                      className="flex-1 h-11 bg-black/20 border border-white/10 rounded-lg px-3 text-sm text-white outline-none text-left"
                      placeholder="カテゴリ名"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] text-zinc-500 pl-1">月間予算</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={String(editingItem.data.budget ?? '')}
                      onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, budget: e.target.value } })}
                      className="w-full h-11 bg-black/20 border border-white/10 rounded-lg px-3 text-sm text-white tabular-nums outline-none"
                      placeholder="0"
                    />
                  </div>
                </>
              )}

              {editingItem.type === 'template' && (
                <>
                  <input
                    value={editingItem.data.title || ''}
                    onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, title: e.target.value } })}
                    className="w-full h-11 bg-black/20 border border-white/10 rounded-lg px-3 text-sm text-white outline-none text-left"
                    placeholder="テンプレート名"
                  />
                  <input
                    type="text"
                    inputMode="decimal"
                    value={String(editingItem.data.amount ?? '')}
                    onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, amount: e.target.value } })}
                    className="w-full h-11 bg-black/20 border border-white/10 rounded-lg px-3 text-sm text-white tabular-nums outline-none"
                    placeholder="金額"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={editingItem.data.category || ''}
                      onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, category: e.target.value } })}
                      className="h-11 bg-black/20 border border-white/10 rounded-lg px-2 text-xs text-white outline-none"
                    >
                      {getCategoryNames().map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <select
                      value={editingItem.data.method || ''}
                      onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, method: e.target.value } })}
                      className="h-11 bg-black/20 border border-white/10 rounded-lg px-2 text-xs text-white outline-none"
                    >
                      {(paymentMethodsSafe || []).map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                </>
              )}

              {editingItem.type === 'payment' && (
                <input
                  value={editingItem.data.name || ''}
                  onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, name: e.target.value } })}
                  className="w-full h-11 bg-black/20 border border-white/10 rounded-lg px-3 text-sm text-white outline-none text-left"
                  placeholder="支払方法名"
                />
              )}

              <div className="flex gap-2 pt-2">
                {(editingItem.index !== -1 || editingItem.type === 'bill') && (
                  <button
                    type="button"
                    onClick={handleDeleteItem}
                    className="w-12 h-12 flex items-center justify-center bg-red-900/20 text-red-500 rounded-lg active:bg-red-900/40"
                  >
                    <Trash2 size={18}/>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleSettingsSave}
                  className="flex-1 h-12 bg-white text-black rounded-lg text-xs tracking-widest active:bg-zinc-200"
                >
                  保存
                </button>
              </div>

              <div className="h-5" />
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
