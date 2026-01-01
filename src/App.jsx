import React, { useEffect, useMemo, useRef, useState } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
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
  ArrowUp,
  ArrowDown,
  Home,
  Sparkles,
} from 'lucide-react';

/* --- FIREBASE CONFIG --- */
const firebaseConfig = {
  apiKey: "AIzaSyD_MMX3Irb-xN1Tql5L0kWJo6BoO_rFX7g",
  authDomain: "zaimu-4f79b.firebaseapp.com",
  projectId: "zaimu-4f79b",
  storageBucket: "zaimu-4f79b.firebasestorage.app",
  messagingSenderId: "388166181792",
  appId: "1:388166181792:web:d3ccef2742dca358d3bac5",
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

/* --- UTILS --- */
const CASH = '現金';
const NO_MONEY_EMOJI = '✨'; // ノーマネーデー演出（1パターン）

const pad2 = (n) => String(n).padStart(2, '0');

/** ✅ JST/ローカル基準の YYYY-MM */
const getMonthString = (date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;

/** YYYY-MM -> Date(ローカル) */
const monthToDate = (monthStr) => {
  const [y, m] = monthStr.split('-').map(Number);
  return new Date(y, (m || 1) - 1, 1, 0, 0, 0);
};

/** 月を±nする（ローカル安全） */
const addMonths = (monthStr, delta) => {
  const d = monthToDate(monthStr);
  d.setMonth(d.getMonth() + delta);
  return getMonthString(d);
};

const formatMonthJP = (monthStr) => {
  if (!monthStr) return "";
  const [y, m] = monthStr.split('-');
  return `${y}年 ${Number(m)}月`;
};

const getTodayString = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

const toNumber = (val) => {
  if (val === null || val === undefined || val === '') return 0;
  const num = Number(String(val).replace(/,/g, ''));
  return Number.isNaN(num) ? 0 : num;
};

/** ✅ ISO(UTC) -> ローカル YYYY-MM-DD（編集モーダルで1日前になる問題対策） */
const isoToLocalYmd = (isoStr) => {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

/**
 * ✅ FirestoreのdateはISO文字列で範囲検索してる前提
 * ただし JST 00:00 だと toISOString() が前日になることがあるので
 * 「ローカル正午」で固定して保存（ズレ対策）
 */
const toISOFromLocalMidday = (yyyyMmDd) => {
  // "YYYY-MM-DDT12:00:00" をローカル解釈 → toISOString() でUTC化
  return new Date(`${yyyyMmDd}T12:00:00`).toISOString();
};

const formatDateShort = (isoOrDateStr) => {
  const d = new Date(isoOrDateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

// Data Normalizers
const normalizeMonthlyData = (data) => ({
  salary: data?.salary || 0,
  budget: data?.budget || 0,
  cashBudget: data?.cashBudget || 0,
  cardBills: data?.cardBills || {},
  fixedCosts: data?.fixedCosts || [],
  catBudgets: data?.catBudgets || {},
  cardDueDates: data?.cardDueDates || {},
  confirmedPayments: data?.confirmedPayments || [],
});

const normalizeConfig = (data) => ({
  categories: data?.categories || [{ name: '食費', icon: '🍔' }],
  paymentMethods: data?.paymentMethods || [CASH],
  templates: data?.templates || [],
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
          <p className="text-xs text-zinc-500 text-center">再読み込みで直ることが多いです。</p>
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

// Calculator Logic
const safeCalculate = (expression) => {
  if (!expression || /[^0-9+\-*/.]/.test(expression)) return '0';
  try {
    const tokens = expression.match(/(\d+(\.\d+)?|[\+\-\*\/])/g);
    if (!tokens) return '0';

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

    return Number.isNaN(result) ? '0' : result;
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

/* --- MAIN APP --- */
function AppMain() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [activeTab, setActiveTab] = useState('home');
  const [homeView, setHomeView] = useState('spending');
  const [logView, setLogView] = useState('list');
  const [settingTab, setSettingTab] = useState('menu');

  const [month, setMonth] = useState(getMonthString(new Date()));

  // Transaction modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [editingTx, setEditingTx] = useState(null);

  const [inputDate, setInputDate] = useState(getTodayString());
  const [inputAmount, setInputAmount] = useState('');
  const [inputTitle, setInputTitle] = useState('');
  const [inputCategory, setInputCategory] = useState('');
  const [inputMethod, setInputMethod] = useState('');

  // Settings edit modal
  const [editingItem, setEditingItem] = useState(null);

  // Data
  const [transactions, setTransactions] = useState([]);
  const [lastMonthTransactions, setLastMonthTransactions] = useState([]);
  const [monthlyData, setMonthlyData] = useState(normalizeMonthlyData({}));
  const [config, setConfig] = useState(normalizeConfig({}));

  // UI
  const [toast, setToast] = useState({ visible: false, message: '' });
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
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  /* --- DATA SUBSCRIPTIONS --- */
  useEffect(() => {
    if (!user) return;

    const startDate = monthToDate(month);
    const endDate = monthToDate(addMonths(month, 1));
    const start = startDate.toISOString();
    const end = endDate.toISOString();

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

    const prevMonth = addMonths(month, -1);
    const prevStart = monthToDate(prevMonth).toISOString();
    const curStart = monthToDate(month).toISOString();

    const fetchLast = async () => {
      const q = query(
        collection(db, 'users', user.uid, 'transactions'),
        where('date', '>=', prevStart),
        where('date', '<', curStart)
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
    const fixedCashTotal = fixedCosts.filter(f => !f.method || f.method === CASH).reduce((s, i) => s + (Number(i.amount) || 0), 0);
    const fixedCardTotal = fixedCosts.filter(f => f.method && f.method !== CASH).reduce((s, i) => s + (Number(i.amount) || 0), 0);
    const fixedTotal = fixedCashTotal + fixedCardTotal;

    const totalBudget = Number(monthlyData?.budget) || 0;
    const spentCard = transactions.filter(t => t.paymentMethod !== CASH).reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const cardRemaining = totalBudget - fixedTotal - spentCard;

    const cashBudgetTotal = Number(monthlyData?.cashBudget) || 0;
    const spentCash = transactions.filter(t => t.paymentMethod === CASH).reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const cashRemaining = cashBudgetTotal - spentCash;

    const billTotal = Object.values(monthlyData?.cardBills || {}).reduce((s, v) => s + (Number(v) || 0), 0);
    const totalWithdrawal = fixedCashTotal + billTotal;
    const bankBalanceProjected = (Number(monthlyData?.salary) || 0) - totalWithdrawal;

    const getCatTotals = (txs) => (txs || []).reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + (Number(t.amount) || 0);
      return acc;
    }, {});

    const catBudgetSum = (config?.categories || []).reduce((sum, c) => sum + (monthlyData?.catBudgets?.[c.name] || 0), 0);

    const now = new Date();
    const isCurrentMonth = month === getMonthString(now);
    const daysLeft = isCurrentMonth
      ? Math.max(1, new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate() + 1)
      : 30;

    const dailyTotals = transactions.reduce((acc, t) => {
      const d = new Date(t.date);
      const day = d.getDate();
      acc[day] = (acc[day] || 0) + (Number(t.amount) || 0);
      return acc;
    }, {});

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
      dailyTotals,
    };
  }, [monthlyData, transactions, lastMonthTransactions, month, config]);

  /* --- ✅ 引き落としアラート（当月のみ・7日以内・金額あり・未完了） --- */
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
    showToastMsg('支払いを完了にしました');
  };

  /* --- TRANSACTION CRUD --- */
  const resetTxInputs = (dateStr = getTodayString()) => {
    const cats = getCategoryNames();
    setInputDate(dateStr);
    setInputAmount('');
    setInputTitle('');
    setInputCategory(cats[0] || '食費');
    setInputMethod(paymentMethodsSafe[0] || CASH);
    setShowCalculator(false);
  };

  const openModalNew = () => {
    setEditingTx(null);
    resetTxInputs(getTodayString());
    setIsModalOpen(true);
  };

  const openModalWithDate = (dateStr) => {
    setEditingTx(null);
    resetTxInputs(dateStr);
    setIsModalOpen(true);
  };

  const startEditingTx = (t) => {
    const cats = getCategoryNames();
    const methods = paymentMethodsSafe;

    setEditingTx(t);

    // ✅ ISO -> ローカル YYYY-MM-DD
    const ymd = isoToLocalYmd(t.date) || getTodayString();

    setInputDate(ymd);
    setInputAmount(String(t.amount ?? ''));
    setInputTitle(t.title || '');
    setInputCategory(cats.includes(t.category) ? t.category : (cats[0] || '食費'));
    setInputMethod(methods.includes(t.paymentMethod) ? t.paymentMethod : (methods[0] || CASH));
    setShowCalculator(false);
    setIsModalOpen(true);
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
      date: toISOFromLocalMidday(inputDate), // ✅ ズレない保存
      amount,
      title,
      category,
      paymentMethod: method,
    };

    try {
      if (editingTx?.id) {
        await updateDoc(doc(db, 'users', user.uid, 'transactions', editingTx.id), payload);
        showToastMsg('更新しました');
      } else {
        await addDoc(collection(db, 'users', user.uid, 'transactions'), payload);
        showToastMsg('追加しました');
      }
      setIsModalOpen(false);
      setEditingTx(null);
    } catch (err) {
      console.error(err);
      showToastMsg('保存に失敗しました');
    }
  };

  /* --- LOG FILTER --- */
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
    const d = monthToDate(month);
    const first = d.getDay();
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    return [...Array(first).fill(null), ...Array.from({ length: last }, (_, i) => i + 1)];
  }, [month]);

  /* --- SETTINGS LOGIC --- */
  const handleSettingsSave = async () => {
    if (!user || !editingItem) return;
    const { type, data, index } = editingItem;

    try {
      if (type === 'category') {
        const newCats = [...(config.categories || [])];
        const name = (data.name || '').trim();
        const icon = (data.icon || '🏷').trim() || '🏷';
        if (!name) return showToastMsg('カテゴリ名が空です');

        // 既存名リネーム対応（予算Keyも追随）
        const oldName = index !== -1 ? (newCats[index]?.name || '') : '';
        if (index === -1) newCats.push({ name, icon });
        else newCats[index] = { name, icon };

        await setDoc(doc(db, 'users', user.uid, 'settings', 'config'), { ...config, categories: newCats });

        const budgetVal = toNumber(data.budget);
        const nextCatBudgets = { ...(monthlyData.catBudgets || {}) };

        // リネーム時: oldKey -> newKey 移動
        if (oldName && oldName !== name) {
          if (nextCatBudgets[oldName] !== undefined) {
            nextCatBudgets[name] = nextCatBudgets[oldName];
            delete nextCatBudgets[oldName];
          }
        }
        nextCatBudgets[name] = budgetVal;

        await setDoc(doc(db, 'users', user.uid, 'months', month), { catBudgets: nextCatBudgets }, { merge: true });
      }

      if (type === 'fixed') {
        const newFixed = [...(monthlyData.fixedCosts || [])];
        const next = {
          id: data.id || Date.now(),
          name: (data.name || '').trim(),
          amount: toNumber(data.amount),
          method: data.method || CASH,
        };
        if (!next.name) return showToastMsg('固定費名が空です');

        if (index === -1) newFixed.unshift(next);
        else newFixed[index] = next;

        await setDoc(doc(db, 'users', user.uid, 'months', month), { fixedCosts: newFixed }, { merge: true });
      }

      if (type === 'template') {
        const tpl = [...(config.templates || [])];
        const next = {
          title: (data.title || '').trim(),
          amount: toNumber(data.amount),
          category: data.category || (getCategoryNames()[0] || '食費'),
          method: data.method || (paymentMethodsSafe[0] || CASH),
        };
        if (!next.title) return showToastMsg('テンプレート名が空です');

        if (index === -1) tpl.unshift(next);
        else tpl[index] = next;

        await setDoc(doc(db, 'users', user.uid, 'settings', 'config'), { ...config, templates: tpl });
      }

      if (type === 'payment') {
        const p = [...(config.paymentMethods || [CASH])];
        const name = (data.name || '').trim();
        if (!name) return showToastMsg('支払方法名が空です');

        if (index === -1) p.unshift(name);
        else p[index] = name;

        // 現金は必ず残す（事故防止）
        const unique = Array.from(new Set([CASH, ...p.filter(Boolean)]));

        await setDoc(doc(db, 'users', user.uid, 'settings', 'config'), { ...config, paymentMethods: unique });
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

    const { type, index, data } = editingItem;
    const ok = window.confirm('削除しますか？');
    if (!ok) return;

    try {
      if (type === 'fixed') {
        const next = (monthlyData.fixedCosts || []).filter((_, i) => i !== index);
        await setDoc(doc(db, 'users', user.uid, 'months', month), { fixedCosts: next }, { merge: true });
      }

      if (type === 'category') {
        const nextCats = (config.categories || []).filter((_, i) => i !== index);
        await setDoc(doc(db, 'users', user.uid, 'settings', 'config'), { ...config, categories: nextCats });

        // 予算キー削除（任意だけど整合性保つ）
        const name = data?.name;
        if (name) {
          const nextBudgets = { ...(monthlyData.catBudgets || {}) };
          delete nextBudgets[name];
          await setDoc(doc(db, 'users', user.uid, 'months', month), { catBudgets: nextBudgets }, { merge: true });
        }
      }

      if (type === 'template') {
        const nextTpl = (config.templates || []).filter((_, i) => i !== index);
        await setDoc(doc(db, 'users', user.uid, 'settings', 'config'), { ...config, templates: nextTpl });
      }

      if (type === 'payment') {
        // 現金は消させない
        if ((data?.name || '') === CASH) return showToastMsg('「現金」は削除できません');

        const next = (config.paymentMethods || []).filter((_, i) => i !== index);
        const unique = Array.from(new Set([CASH, ...next.filter(Boolean)]));
        await setDoc(doc(db, 'users', user.uid, 'settings', 'config'), { ...config, paymentMethods: unique });
      }

      setEditingItem(null);
      showToastMsg('削除しました');
    } catch (e) {
      console.error(e);
      showToastMsg('削除に失敗しました');
    }
  };

  const handleMoveCategory = async (idx, direction, e) => {
    e?.stopPropagation?.();
    if (!user) return;

    const newCats = [...(config.categories || [])];
    if (direction === 'up' && idx > 0) [newCats[idx], newCats[idx - 1]] = [newCats[idx - 1], newCats[idx]];
    else if (direction === 'down' && idx < newCats.length - 1) [newCats[idx], newCats[idx + 1]] = [newCats[idx + 1], newCats[idx]];
    else return;

    setConfig({ ...config, categories: newCats });
    await setDoc(doc(db, 'users', user.uid, 'settings', 'config'), { ...config, categories: newCats }, { merge: true });
  };

  const copyLastMonthSettings = async () => {
    if (!user || !window.confirm('先月の設定をコピーしますか？')) return;

    const lastMonthStr = addMonths(month, -1);

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
        confirmedPayments: [], // 今月の完了はリセット
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
        const day = isoToLocalYmd(d.date) || '';
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

      showToastMsg('CSVを出力しました');
    } catch (e) {
      console.error(e);
      showToastMsg('エラーが発生しました');
    }
  };

  /* --- RENDER GUARDS --- */
  if (authLoading) {
    return (
      <div className="h-screen bg-[#121212] flex items-center justify-center text-zinc-600 font-bold">
        読み込み中...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen w-full bg-[#121212] flex flex-col items-center justify-center p-6 space-y-8 animate-in fade-in">
        <div className="text-center">
          <h1 className="text-4xl font-black text-white uppercase tracking-tighter">ZAIMU</h1>
        </div>
        <button
          onClick={() => signInWithPopup(auth, new GoogleAuthProvider())}
          className="w-full max-w-xs h-14 bg-white text-black rounded-full font-bold uppercase flex items-center justify-center gap-3 active:scale-95 transition-transform"
        >
          <Lock size={18} /> Googleでログイン
        </button>
      </div>
    );
  }

  const SETTING_MENU_ITEMS = [
    { id: 'budget', label: '資金計画・引落日', icon: <Landmark size={18}/> },
    { id: 'fixed', label: '固定費管理', icon: <CreditCard size={18}/> },
    { id: 'category', label: 'カテゴリ予算', icon: <Tags size={18}/> },
    { id: 'template', label: 'テンプレート', icon: <Zap size={18}/> },
    { id: 'payment', label: '支払方法', icon: <Wallet size={18}/> },
  ];
  const currentSettingTitle = SETTING_MENU_ITEMS.find(item => item.id === settingTab)?.label || '設定';

  return (
    <div className="fixed inset-0 w-full bg-[#121212] text-zinc-200 font-sans font-bold flex flex-col justify-center overflow-hidden">
      <Toast message={toast.message} isVisible={toast.visible} />

      <div className="w-full max-w-md h-full flex flex-col relative bg-[#121212] shadow-2xl mx-auto">
        <header className="flex-none h-16 border-b border-white/5 px-4 flex items-center justify-between bg-[#121212]/80 backdrop-blur-xl z-50">
          {activeTab === 'settings' && settingTab !== 'menu' ? (
            <>
              <button onClick={() => setSettingTab('menu')} className="text-zinc-400">
                <ArrowLeft size={24}/>
              </button>

              <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center">
                <span className="text-xs font-bold text-white uppercase">{currentSettingTitle}</span>
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
                  onClick={() => setMonth(addMonths(month, -1))}
                >
                  <ChevronLeft size={20}/>
                </button>

                <span className="text-sm font-bold text-white tabular-nums">
                  {formatMonthJP(month)}
                </span>

                <button
                  type="button"
                  onClick={() => setMonth(addMonths(month, +1))}
                >
                  <ChevronRight size={20}/>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setMonth(getMonthString(new Date()))}
                className="text-zinc-500 active:text-white"
                title="今月へ"
              >
                <Calendar size={20}/>
              </button>
            </>
          )}
        </header>

        <main ref={mainRef} className="flex-1 overflow-y-auto scrollbar-hide pt-4">
          <div className="p-4 pb-32">

            {/* HOME */}
            {activeTab === 'home' && (
              <div className="space-y-4 animate-in fade-in duration-300">
                <div className="bg-[#1E1E1E] p-1 rounded-xl flex gap-1 mb-2 border border-white/5">
                  <button
                    type="button"
                    onClick={() => setHomeView('spending')}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 ${
                      homeView === 'spending' ? 'bg-white text-black shadow-lg' : 'text-zinc-500'
                    }`}
                  >
                    <LayoutGrid size={14}/> 支出管理
                  </button>

                  <button
                    type="button"
                    onClick={() => setHomeView('forecast')}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 ${
                      homeView === 'forecast' ? 'bg-white text-black shadow-lg' : 'text-zinc-500'
                    }`}
                  >
                    <ListChecks size={14}/> 収支・予定
                  </button>
                </div>

                {homeView === 'spending' ? (
                  <div className="space-y-4 animate-in slide-in-from-left-2">
                    <SimpleCard className="p-6">
                      <div className="flex justify-between mb-4">
                        <div>
                          <p className="text-[10px] text-zinc-500 uppercase">今月あと使える（カード）</p>
                          <h2 className={`text-4xl font-bold mt-1 tabular-nums ${summary.cardRemaining < 0 ? 'text-red-400' : 'text-white'}`}>
                            ¥{summary.cardRemaining.toLocaleString()}
                          </h2>
                        </div>
                        <div className="text-right text-[9px] text-zinc-600 uppercase">
                          軍資金
                          <p className="text-zinc-400 font-bold tabular-nums">¥{summary.cardBudget.toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-white transition-all duration-1000" style={{ width: `${summary.cardRemainingPercent}%` }}/>
                      </div>
                    </SimpleCard>

                    <SimpleCard className="p-6">
                      <div className="flex justify-between mb-4">
                        <div>
                          <p className="text-[10px] text-zinc-500 uppercase">今月あと使える（口座）</p>
                          <h2 className={`text-4xl font-bold mt-1 tabular-nums ${summary.cashRemaining < 0 ? 'text-red-400' : 'text-white'}`}>
                            ¥{summary.cashRemaining.toLocaleString()}
                          </h2>
                        </div>
                        <div className="text-right text-[9px] text-zinc-600 uppercase">
                          軍資金
                          <p className="text-zinc-400 font-bold tabular-nums">¥{summary.cashBudget.toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-zinc-500 transition-all duration-1000" style={{ width: `${summary.cashRemainingPercent}%` }}/>
                      </div>
                    </SimpleCard>
                  </div>
                ) : (
                  <div className="space-y-4 animate-in slide-in-from-right-2">
                    {/* 引き落としアラート */}
                    {activeAlerts.length > 0 && (
                      <SimpleCard className="bg-red-500/10 border-red-500/30 p-4">
                        <div className="flex items-center gap-2 text-red-400 mb-2 font-bold text-xs">
                          <Calendar size={14}/> 支払期日が迫っています
                        </div>

                        <div className="space-y-2">
                          {activeAlerts.map(([card, day]) => (
                            <div key={card} className="flex justify-between items-center bg-black/20 p-2 rounded">
                              <span className="text-xs font-bold text-white">
                                {card}（{day}日）
                              </span>

                              <button
                                type="button"
                                onClick={() => confirmPayment(card)}
                                className="text-[10px] bg-red-500 text-white px-3 py-1 rounded-full font-bold active:scale-95 transition-transform"
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
                        <p className="text-[10px] text-zinc-500 uppercase">口座残高見込み（引落後）</p>
                        <Banknote size={16} className="text-zinc-600"/>
                      </div>

                      <div className="flex justify-between items-center text-xs text-zinc-400">
                        給与収入
                        <span className="text-sm font-bold text-white tabular-nums">+ ¥{monthlyData.salary.toLocaleString()}</span>
                      </div>

                      <div className="flex justify-between items-center text-xs text-zinc-400">
                        引き落とし計
                        <span className="text-sm font-bold text-red-400 tabular-nums">- ¥{summary.totalWithdrawal.toLocaleString()}</span>
                      </div>

                      <div className="pt-2 border-t border-white/5 flex justify-between items-end text-xs font-bold text-zinc-500">
                        残高予想
                        <span className="text-2xl font-black text-white tabular-nums">¥{summary.bankBalanceProjected.toLocaleString()}</span>
                      </div>
                    </SimpleCard>

                    <div className="grid grid-cols-2 gap-3">
                      {getCategoryNames().map(n => {
                        const spent = summary.catTotals[n] || 0;
                        const budget = monthlyData.catBudgets?.[n] || 0;
                        if (budget === 0) return null;
                        return (
                          <SimpleCard key={n} className="p-3 space-y-2">
                            <div className="flex justify-between items-center text-[9px] font-bold">
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
                          title="一覧"
                        >
                          <AlignJustify size={16}/>
                        </button>
                        <button
                          type="button"
                          onClick={() => setLogView('calendar')}
                          className={`p-2 rounded ${logView === 'calendar' ? 'bg-white text-black' : 'text-zinc-500'}`}
                          title="カレンダー"
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
                        {(paymentMethodsSafe || []).map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="pt-24">
                  {logView === 'list' ? (
                    <SimpleCard>
                      {finalFilteredTx.length === 0 ? (
                        <div className="py-20 flex flex-col items-center gap-3 text-zinc-600">
                          <Sparkles size={48} className="opacity-20"/>
                          <p className="text-xs uppercase font-black">支出なし！🎉</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-white/5">
                          {finalFilteredTx.map(t => (
                            <div
                              key={t.id}
                              onClick={() => startEditingTx(t)}
                              className="flex items-center justify-between p-4 cursor-pointer active:bg-white/5 transition-colors"
                            >
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className="w-10 text-[10px] text-zinc-500 tabular-nums">{formatDateShort(t.date)}</div>
                                <div className="w-12 text-center text-[9px] bg-white/5 text-zinc-400 rounded py-0.5 truncate">
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
                    <SimpleCard className="p-4">
                      <div className="grid grid-cols-7 gap-1 text-center mb-2 text-[10px] text-zinc-600 uppercase">
                        {['日','月','火','水','木','金','土'].map(d => <div key={d}>{d}</div>)}
                      </div>

                      <div className="grid grid-cols-7 gap-1">
                        {calendarDaysList.map((day, i) => {
                          if (!day) return <div key={i}/>;

                          const d = monthToDate(month);
                          const dateObj = new Date(d.getFullYear(), d.getMonth(), day, 12, 0, 0);
                          const todayObj = new Date();
                          const isCurrentMonth = month === getMonthString(todayObj);
                          const isToday = isCurrentMonth && day === todayObj.getDate();

                          const a = summary.dailyTotals[day] || 0;
                          const dateStr = `${month}-${pad2(day)}`;

                          // ✅ ノーマネーデー演出：過去日 & 0円
                          const isPastOrToday = dateObj <= new Date(todayObj.getFullYear(), todayObj.getMonth(), todayObj.getDate(), 23, 59, 59);
                          const showNoMoney = isPastOrToday && a === 0 && !isToday;

                          return (
                            <div
                              key={i}
                              onClick={() => openModalWithDate(dateStr)}
                              className={`aspect-square rounded-lg border flex flex-col items-center justify-center relative transition-transform active:scale-95 ${
                                isToday ? 'border-white bg-white/10 shadow-[0_0_10px_rgba(255,255,255,0.1)]' : 'border-white/5 bg-black/20'
                              }`}
                            >
                              <span className={`text-[9px] tabular-nums ${isToday ? 'text-white' : 'text-zinc-500'}`}>{day}</span>

                              {a > 0 && (
                                <span className="text-[8px] text-zinc-300 tabular-nums">
                                  ¥{(a / 1000).toFixed(1)}k
                                </span>
                              )}

                              {showNoMoney && (
                                <span className="absolute bottom-1 text-[10px] opacity-80">{NO_MONEY_EMOJI}</span>
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
                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-4">先月との比較</p>
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <h3 className="text-4xl font-black text-white tabular-nums">¥{summary.totalSpent.toLocaleString()}</h3>
                      <div className={`flex items-center gap-1.5 mt-2 text-xs font-bold ${summary.totalSpent <= summary.lastTotalSpent ? 'text-green-400' : 'text-red-400'}`}>
                        {summary.totalSpent <= summary.lastTotalSpent ? <TrendingDown size={16}/> : <TrendingUp size={16}/>}
                        <span className="tabular-nums">
                          先月より ¥{Math.abs(summary.totalSpent - summary.lastTotalSpent).toLocaleString()} {summary.totalSpent <= summary.lastTotalSpent ? '減少' : '増加'}
                        </span>
                      </div>
                    </div>

                    <div className="text-right text-[10px] text-zinc-600 uppercase font-black">
                      先月総支出
                      <p className="text-sm font-bold text-zinc-500 tabular-nums">¥{summary.lastTotalSpent.toLocaleString()}</p>
                    </div>
                  </div>
                </SimpleCard>

                <SimpleCard className="p-6 space-y-6">
                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest">カテゴリ別 比較</p>
                  <div className="space-y-6">
                    {getCategoryNames().map(n => {
                      const c = summary.catTotals[n] || 0;
                      const l = summary.lastCatTotals[n] || 0;
                      const max = Math.max(c, l, 1);

                      return (
                        <div key={n} className="space-y-2">
                          <div className="flex justify-between items-center font-bold text-[10px]">
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
                        <span className="text-xs font-bold text-white">{user.email}</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => { if (window.confirm('ログアウトしますか？')) signOut(auth); }}
                        className="text-zinc-500 text-[10px] flex items-center gap-1.5 active:text-white uppercase"
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
                            className="w-full flex items-center justify-between p-4 active:bg-white/5 text-zinc-300 transition-colors"
                          >
                            <div className="flex items-center gap-4">
                              {item.icon}
                              <span className="text-sm font-bold">{item.label}</span>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-zinc-500 tabular-nums">
                              {(item.id === 'fixed' ? `¥${summary.fixedTotal.toLocaleString()}` :
                                item.id === 'category' ? `¥${summary.catBudgetSum.toLocaleString()}` : '')}
                              <ChevronRight size={16} className="text-zinc-800"/>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col items-center gap-4 pt-4">
                      <button
                        type="button"
                        onClick={copyLastMonthSettings}
                        className="px-6 py-3 border border-white/10 text-zinc-300 rounded-full text-xs font-bold active:bg-white/5 transition-all"
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
                  <div className="space-y-4 pb-10">
                    {/* --- budget --- */}
                    {settingTab === 'budget' && (
                      <SimpleCard className="p-5 space-y-4 animate-in slide-in-from-right-2">
                        <div className="space-y-3">
                          <div className="flex flex-col gap-1">
                            <label className="text-[9px] text-zinc-600 font-bold uppercase pl-1">手取り給与</label>
                            <input
                              type="text"
                              inputMode="decimal"
                              defaultValue={Number(monthlyData.salary || 0).toLocaleString()}
                              onBlur={e => setDoc(doc(db,'users',user.uid,'months',month), { salary: toNumber(e.target.value) }, { merge:true })}
                              className="w-full h-11 bg-black/20 border border-white/10 rounded-lg px-4 text-sm text-white font-bold tabular-nums outline-none"
                            />
                          </div>

                          <div className="flex flex-col gap-1">
                            <label className="text-[9px] text-zinc-600 font-bold uppercase pl-1">生活費予算（総枠）</label>
                            <input
                              type="text"
                              inputMode="decimal"
                              defaultValue={Number(monthlyData.budget || 0).toLocaleString()}
                              onBlur={e => setDoc(doc(db,'users',user.uid,'months',month), { budget: toNumber(e.target.value) }, { merge:true })}
                              className="w-full h-11 bg-black/20 border border-white/10 rounded-lg px-4 text-sm text-white font-bold tabular-nums outline-none"
                            />
                          </div>

                          <div className="flex flex-col gap-1">
                            <label className="text-[9px] text-zinc-600 font-bold uppercase pl-1">現金予算（口座用）</label>
                            <input
                              type="text"
                              inputMode="decimal"
                              defaultValue={Number(monthlyData.cashBudget || 0).toLocaleString()}
                              onBlur={e => setDoc(doc(db,'users',user.uid,'months',month), { cashBudget: toNumber(e.target.value) }, { merge:true })}
                              className="w-full h-11 bg-black/20 border border-white/10 rounded-lg px-4 text-sm text-white font-bold tabular-nums outline-none"
                            />
                          </div>
                        </div>

                        <div className="pt-4 border-t border-white/5 space-y-3">
                          <p className="text-[10px] text-zinc-500 font-black uppercase">カード引き落とし額設定</p>

                          {(paymentMethodsSafe || []).filter(m => m !== CASH).map(m => (
                            <div key={m} className="flex gap-2 items-center">
                              <span className="text-[10px] text-zinc-400 w-16 truncate">{m}</span>

                              <input
                                type="text"
                                inputMode="decimal"
                                defaultValue={Number(monthlyData.cardBills?.[m] || 0).toLocaleString()}
                                onBlur={e => setDoc(doc(db,'users',user.uid,'months',month), { [`cardBills.${m}`]: toNumber(e.target.value) }, { merge:true })}
                                className="flex-1 h-10 bg-black/20 border border-white/10 rounded-lg px-3 text-xs text-white tabular-nums outline-none"
                              />

                              <input
                                type="number"
                                placeholder="日"
                                defaultValue={monthlyData.cardDueDates?.[m] || ''}
                                onBlur={e => setDoc(doc(db,'users',user.uid,'months',month), { [`cardDueDates.${m}`]: String(e.target.value || '') }, { merge:true })}
                                className="w-10 h-10 bg-black/20 border border-white/10 rounded-lg text-xs text-center text-white outline-none"
                              />
                            </div>
                          ))}
                        </div>
                      </SimpleCard>
                    )}

                    {/* --- fixed --- */}
                    {settingTab === 'fixed' && (
                      <div className="space-y-3 animate-in slide-in-from-right-2">
                        {/* ✅ 追加ボタンは上 */}
                        <button
                          type="button"
                          onClick={() => setEditingItem({ type:'fixed', index:-1, data:{ name:'', amount:'', method: (paymentMethodsSafe[0] || CASH) } })}
                          className="w-full h-11 bg-zinc-200 text-black rounded-lg text-[10px] font-black uppercase shadow-lg active:scale-95 transition-transform"
                        >
                          固定費を追加
                        </button>

                        <SimpleCard className="p-5">
                          {(monthlyData.fixedCosts || []).length === 0 ? (
                            <div className="py-10 text-center text-zinc-600 text-xs">固定費がまだありません</div>
                          ) : (
                            <div className="divide-y divide-white/5">
                              {(monthlyData.fixedCosts || []).map((f, idx) => (
                                <div
                                  key={idx}
                                  onClick={() => setEditingItem({ type:'fixed', index: idx, data: f })}
                                  className="flex justify-between items-center py-3 cursor-pointer active:bg-white/5 transition-colors"
                                >
                                  <div className="flex flex-col">
                                    <span className="text-xs text-zinc-200 font-bold">{f.name}</span>
                                    <span className="text-[9px] text-zinc-500 uppercase">{f.method || '未設定'}</span>
                                  </div>
                                  <span className="text-sm font-bold tabular-nums text-white">¥{Number(f.amount || 0).toLocaleString()}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </SimpleCard>
                      </div>
                    )}

                    {/* --- category --- */}
                    {settingTab === 'category' && (
                      <div className="space-y-3 animate-in slide-in-from-right-2">
                        {/* ✅ 追加ボタンは上 */}
                        <button
                          type="button"
                          onClick={() => setEditingItem({ type:'category', index:-1, data:{ name:'', icon:'🏷', budget:'' } })}
                          className="w-full h-11 bg-zinc-200 text-black rounded-lg text-[10px] font-black uppercase shadow-lg active:scale-95 transition-transform"
                        >
                          カテゴリを追加
                        </button>

                        <SimpleCard className="p-5">
                          <div className="divide-y divide-white/5">
                            {(config.categories || []).map((c, idx) => {
                              const name = c.name;
                              const budget = monthlyData?.catBudgets?.[name] || 0;

                              return (
                                <div
                                  key={idx}
                                  onClick={() => setEditingItem({ type:'category', index: idx, data: { name, icon: c.icon, budget } })}
                                  className="flex justify-between items-center py-3 cursor-pointer active:bg-white/5 transition-colors"
                                >
                                  <div className="flex items-center gap-3">
                                    <span className="text-xl w-8 text-center">{c.icon || '🏷'}</span>
                                    <span className="text-xs font-bold text-white">{name}</span>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-zinc-500 tabular-nums">¥{Number(budget).toLocaleString()}</span>

                                    <div className="flex gap-1">
                                      <button onClick={(e)=>handleMoveCategory(idx,'up',e)} className="p-1 text-zinc-600 hover:text-white" title="上へ">
                                        <ArrowUp size={14}/>
                                      </button>
                                      <button onClick={(e)=>handleMoveCategory(idx,'down',e)} className="p-1 text-zinc-600 hover:text-white" title="下へ">
                                        <ArrowDown size={14}/>
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </SimpleCard>
                      </div>
                    )}

                    {/* --- template --- */}
                    {settingTab === 'template' && (
                      <div className="space-y-3 animate-in slide-in-from-right-2">
                        {/* ✅ 追加ボタンは上 */}
                        <button
                          type="button"
                          onClick={() => setEditingItem({
                            type:'template', index:-1,
                            data:{ title:'', amount:'', category:(getCategoryNames()[0] || '食費'), method:(paymentMethodsSafe[0] || CASH) }
                          })}
                          className="w-full h-11 bg-zinc-200 text-black rounded-lg text-[10px] font-black uppercase shadow-lg active:scale-95 transition-transform"
                        >
                          テンプレートを追加
                        </button>

                        <SimpleCard className="p-5">
                          {(config.templates || []).length === 0 ? (
                            <div className="py-10 text-center text-zinc-600 text-xs">テンプレートがまだありません</div>
                          ) : (
                            <div className="divide-y divide-white/5">
                              {(config.templates || []).map((t, idx) => (
                                <div
                                  key={idx}
                                  onClick={() => setEditingItem({ type:'template', index: idx, data: t })}
                                  className="flex justify-between items-center py-4 cursor-pointer active:bg-white/5 transition-colors"
                                >
                                  <div className="flex flex-col">
                                    <span className="text-xs font-bold text-white">{t.title}</span>
                                    <span className="text-[9px] text-zinc-500 font-bold tabular-nums">
                                      ¥{Number(t.amount || 0).toLocaleString()} / {t.category} / {t.method}
                                    </span>
                                  </div>
                                  <ChevronRight size={14} className="text-zinc-800"/>
                                </div>
                              ))}
                            </div>
                          )}
                        </SimpleCard>
                      </div>
                    )}

                    {/* --- payment --- */}
                    {settingTab === 'payment' && (
                      <div className="space-y-3 animate-in slide-in-from-right-2">
                        {/* ✅ 追加ボタンは上 */}
                        <button
                          type="button"
                          onClick={() => setEditingItem({ type:'payment', index:-1, data:{ name:'' } })}
                          className="w-full h-11 bg-zinc-200 text-black rounded-lg text-[10px] font-black uppercase shadow-lg active:scale-95 transition-transform"
                        >
                          支払方法を追加
                        </button>

                        <SimpleCard className="p-5">
                          <div className="flex flex-wrap gap-2">
                            {(config.paymentMethods || [CASH]).map((m, idx) => (
                              <div
                                key={`${m}-${idx}`}
                                onClick={() => setEditingItem({ type:'payment', index: idx, data:{ name:m } })}
                                className="px-3 py-1.5 bg-white/5 rounded-lg border border-white/10 text-xs text-zinc-300 font-bold cursor-pointer active:scale-95 transition-transform"
                              >
                                {m}
                              </div>
                            ))}
                          </div>
                        </SimpleCard>
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

      {/* --- TRANSACTION MODAL --- */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="w-full max-h-[90vh] sm:h-auto sm:max-w-md bg-[#1E1E1E] sm:rounded-lg rounded-t-2xl border border-white/5 shadow-2xl flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {showCalculator ? (
              <div className="flex-1 p-5">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-[10px] font-black uppercase text-white tracking-widest">電卓</h2>
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
                  <h2 className="text-xs font-black uppercase text-white tracking-widest">{editingTx ? '編集' : '入力'}</h2>
                  <button type="button" onClick={() => setIsModalOpen(false)} className="p-2 text-zinc-500">
                    <X size={20}/>
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 pb-8">
                  <form onSubmit={handleTxSubmit} className="space-y-6">
                    {/* amount */}
                    <div className="flex gap-2 items-center">
                      <div className="relative flex-1">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 text-lg font-bold">¥</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={inputAmount ? Number(toNumber(inputAmount)).toLocaleString() : ''}
                          onChange={e => {
                            const v = e.target.value.replace(/,/g, '');
                            if (!Number.isNaN(Number(v)) || v === '') setInputAmount(v);
                          }}
                          className="w-full h-12 bg-black/20 border border-white/10 rounded-lg text-lg font-bold pl-8 pr-4 text-white tabular-nums outline-none"
                          autoFocus
                          required
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => setShowCalculator(true)}
                        className="w-12 h-12 bg-white/10 rounded-lg text-white flex items-center justify-center active:bg-white/20"
                        title="電卓"
                      >
                        <Calculator size={20}/>
                      </button>
                    </div>

                    {/* title */}
                    <input
                      type="text"
                      value={inputTitle}
                      onChange={e => setInputTitle(e.target.value)}
                      className="w-full h-11 bg-black/20 border border-white/10 rounded-lg px-4 text-sm text-white font-bold outline-none"
                      placeholder="タイトル（例：ランチ）"
                      required
                    />

                    {/* ✅ date & category spacing fixed */}
                    <div className="grid grid-cols-2 gap-4 w-full">
                      <div className="flex flex-col">
                        <label className="text-[9px] text-zinc-500 uppercase font-black pl-1 mb-2">
                          日付
                        </label>
                        <input
                          type="date"
                          value={inputDate}
                          onChange={e => setInputDate(e.target.value)}
                          className="w-full h-11 bg-black/20 border border-white/10 rounded-lg text-xs px-2 text-white outline-none font-bold"
                          required
                        />
                      </div>

                      <div className="flex flex-col">
                        <label className="text-[9px] text-zinc-500 uppercase font-black pl-1 mb-2">
                          カテゴリ
                        </label>
                        <select
                          value={inputCategory}
                          onChange={e => setInputCategory(e.target.value)}
                          className="w-full h-11 bg-black/20 border border-white/10 rounded-lg text-xs px-2 text-white outline-none font-bold"
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
                          <div className="px-3 py-2 text-[10px] rounded-lg border border-zinc-800 font-black text-zinc-500 peer-checked:bg-white peer-checked:text-black transition-all">
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
                            if (!window.confirm('この支出を削除しますか？')) return;
                            try {
                              await deleteDoc(doc(db, 'users', user.uid, 'transactions', editingTx.id));
                              setIsModalOpen(false);
                              setEditingTx(null);
                              showToastMsg('削除しました');
                            } catch (err) {
                              console.error(err);
                              showToastMsg('削除に失敗しました');
                            }
                          }}
                          className="w-12 h-12 flex items-center justify-center bg-red-900/20 text-red-500 rounded-lg active:bg-red-900/40"
                          title="削除"
                        >
                          <Trash2 size={18}/>
                        </button>
                      )}

                      <button
                        type="submit"
                        className="flex-1 h-12 bg-white text-black font-black rounded-lg text-xs uppercase tracking-widest active:bg-zinc-200 shadow-xl"
                      >
                        保存する
                      </button>
                    </div>

                    {/* ✅ ボタン下 20px */}
                    <div className="h-5" />
                  </form>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* --- SETTINGS EDIT MODAL --- */}
      {editingItem && (
        <div
          className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setEditingItem(null)}
        >
          <div
            className="w-full max-h-[90vh] sm:h-auto sm:max-w-md bg-[#1E1E1E] sm:rounded-lg rounded-t-2xl border border-white/5 shadow-2xl flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 border-b border-white/5 flex justify-between items-center">
              <h2 className="text-xs font-black uppercase text-white tracking-widest">編集</h2>
              <button onClick={() => setEditingItem(null)} className="p-2 text-zinc-500" type="button">
                <X size={20}/>
              </button>
            </div>

            <div className="p-5 pb-8 space-y-6 overflow-y-auto">
              {/* category */}
              {editingItem.type === 'category' && (
                <>
                  <div className="flex gap-2">
                    <input
                      value={editingItem.data.icon || ''}
                      onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, icon: e.target.value } })}
                      className="w-12 h-12 text-center bg-black/20 border border-white/10 rounded-lg text-xl text-white outline-none"
                      placeholder="🏷"
                    />
                    <input
                      value={editingItem.data.name || ''}
                      onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, name: e.target.value } })}
                      className="flex-1 h-12 bg-black/20 border border-white/10 rounded-lg px-3 text-sm text-white outline-none font-bold"
                      placeholder="カテゴリ名"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] text-zinc-500 font-bold uppercase pl-1">月間予算</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={editingItem.data.budget ? Number(toNumber(editingItem.data.budget)).toLocaleString() : ''}
                      onChange={e => {
                        const v = e.target.value.replace(/,/g, '');
                        if (!Number.isNaN(Number(v)) || v === '') setEditingItem({ ...editingItem, data: { ...editingItem.data, budget: v } });
                      }}
                      className="w-full h-12 bg-black/20 border border-white/10 rounded-lg px-3 text-sm text-white outline-none tabular-nums font-bold"
                      placeholder="0"
                    />
                  </div>
                </>
              )}

              {/* fixed */}
              {editingItem.type === 'fixed' && (
                <>
                  <input
                    value={editingItem.data.name || ''}
                    onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, name: e.target.value } })}
                    className="w-full h-12 bg-black/20 border border-white/10 rounded-lg px-3 text-sm text-white outline-none font-bold"
                    placeholder="固定費名"
                  />
                  <input
                    type="text"
                    inputMode="decimal"
                    value={editingItem.data.amount ? Number(toNumber(editingItem.data.amount)).toLocaleString() : ''}
                    onChange={e => {
                      const v = e.target.value.replace(/,/g, '');
                      if (!Number.isNaN(Number(v)) || v === '') setEditingItem({ ...editingItem, data: { ...editingItem.data, amount: v } });
                    }}
                    className="w-full h-12 bg-black/20 border border-white/10 rounded-lg px-3 text-sm text-white outline-none tabular-nums font-bold"
                    placeholder="金額"
                  />
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] text-zinc-500 font-bold uppercase pl-1">支払方法</label>
                    <select
                      value={editingItem.data.method || ''}
                      onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, method: e.target.value } })}
                      className="w-full h-12 bg-black/20 border border-white/10 rounded-lg px-3 text-sm text-white outline-none font-bold"
                    >
                      {paymentMethodsSafe.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                </>
              )}

              {/* template */}
              {editingItem.type === 'template' && (
                <>
                  <input
                    value={editingItem.data.title || ''}
                    onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, title: e.target.value } })}
                    className="w-full h-12 bg-black/20 border border-white/10 rounded-lg px-3 text-sm text-white outline-none font-bold"
                    placeholder="テンプレート名"
                  />
                  <input
                    type="text"
                    inputMode="decimal"
                    value={editingItem.data.amount ? Number(toNumber(editingItem.data.amount)).toLocaleString() : ''}
                    onChange={e => {
                      const v = e.target.value.replace(/,/g, '');
                      if (!Number.isNaN(Number(v)) || v === '') setEditingItem({ ...editingItem, data: { ...editingItem.data, amount: v } });
                    }}
                    className="w-full h-12 bg-black/20 border border-white/10 rounded-lg px-3 text-sm text-white outline-none tabular-nums font-bold"
                    placeholder="金額"
                  />

                  {/* ✅ 「カテゴリ」「支払方法」入力欄の間もgap付ける */}
                  <div className="grid grid-cols-2 gap-4 w-full">
                    <div className="flex flex-col">
                      <label className="text-[9px] text-zinc-500 uppercase font-black pl-1 mb-2">カテゴリ</label>
                      <select
                        value={editingItem.data.category || ''}
                        onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, category: e.target.value } })}
                        className="w-full h-12 bg-black/20 border border-white/10 rounded-lg px-2 text-xs text-white outline-none font-bold"
                      >
                        {getCategoryNames().map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>

                    <div className="flex flex-col">
                      <label className="text-[9px] text-zinc-500 uppercase font-black pl-1 mb-2">支払方法</label>
                      <select
                        value={editingItem.data.method || ''}
                        onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, method: e.target.value } })}
                        className="w-full h-12 bg-black/20 border border-white/10 rounded-lg px-2 text-xs text-white outline-none font-bold"
                      >
                        {paymentMethodsSafe.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                  </div>
                </>
              )}

              {/* payment */}
              {editingItem.type === 'payment' && (
                <>
                  <input
                    value={editingItem.data.name || ''}
                    onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, name: e.target.value } })}
                    className="w-full h-12 bg-black/20 border border-white/10 rounded-lg px-3 text-sm text-white outline-none font-bold"
                    placeholder="支払方法名"
                  />
                  <p className="text-[10px] text-zinc-500">
                    ※ 「現金」は削除できないようにしています
                  </p>
                </>
              )}

              <div className="flex gap-2 pt-2">
                {editingItem.index !== -1 && (
                  <button
                    type="button"
                    onClick={handleDeleteItem}
                    className="w-12 h-12 flex items-center justify-center bg-red-900/20 text-red-500 rounded-lg active:bg-red-900/40"
                    title="削除"
                  >
                    <Trash2 size={18}/>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleSettingsSave}
                  className="flex-1 h-12 bg-white text-black rounded-lg font-black text-xs uppercase active:bg-zinc-200"
                >
                  保存
                </button>
              </div>

              {/* ✅ ボタン下 20px */}
              <div className="h-5" />
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// Export
export default function AppWrapper() {
  return (
    <ErrorBoundary>
      <AppMain />
    </ErrorBoundary>
  );
}
