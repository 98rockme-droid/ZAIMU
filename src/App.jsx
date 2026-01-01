// src/App.js
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
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
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
  Bug,
} from 'lucide-react';

/* --- FIREBASE CONFIG --- */
const firebaseConfig = {
  apiKey: 'AIzaSyD_MMX3Irb-xN1Tql5L0kWJo6BoO_rFX7g',
  authDomain: 'zaimu-4f79b.firebaseapp.com',
  projectId: 'zaimu-4f79b',
  storageBucket: 'zaimu-4f79b.firebasestorage.app',
  messagingSenderId: '388166181792',
  appId: '1:388166181792:web:d3ccef2742dca358d3bac5',
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

/* --- UTILS --- */
const CASH = '現金';

const pad2 = (n) => String(n).padStart(2, '0');

// ✅ UTCに引っ張られない「ローカル月文字列」
const getMonthStringLocal = (date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;

// ✅ ローカルの今日
const getTodayStringLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

const formatMonthJP = (monthStr) => {
  if (!monthStr) return '';
  const [y, m] = monthStr.split('-');
  return `${y}年 ${Number(m)}月`;
};

const toNumber = (val) => {
  if (val === null || val === undefined || val === '') return 0;
  const num = Number(String(val).replace(/,/g, ''));
  return Number.isNaN(num) ? 0 : num;
};

// ✅ 保存用：ローカル正午でISO化（split('T')[0]でも日付ズレない）
const toISODateNoonLocal = (yyyyMmDd) => {
  // "YYYY-MM-DDT12:00:00" をローカルとして解釈 -> toISOString()
  return new Date(`${yyyyMmDd}T12:00:00`).toISOString();
};

// ✅ 既存のISO(Z)でもローカル日付に戻す（編集モーダルで1日前にならない）
const isoToLocalYMD = (isoString) => {
  if (!isoString) return getTodayStringLocal();
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return getTodayStringLocal();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

const formatDateShort = (isoOrDateString) => {
  const d = new Date(isoOrDateString);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

const monthStartISO = (monthStr) => {
  const [y, m] = monthStr.split('-').map(Number);
  return new Date(y, m - 1, 1, 0, 0, 0).toISOString();
};

const monthNextStartISO = (monthStr) => {
  const [y, m] = monthStr.split('-').map(Number);
  return new Date(y, m, 1, 0, 0, 0).toISOString();
};

const shiftMonth = (monthStr, delta) => {
  const [y, m] = monthStr.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  d.setMonth(d.getMonth() + delta);
  return getMonthStringLocal(d);
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
    console.error('Uncaught error:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-full bg-[#121212] text-zinc-200 flex flex-col items-center justify-center p-6 gap-4">
          <h1 className="text-xl font-black text-red-400">エラーが発生しました</h1>
          <p className="text-xs text-zinc-500 text-center">再読み込みで直ることが多いです。</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-white text-black rounded-full font-black text-sm active:scale-95 transition-transform"
          >
            再読み込み
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const SimpleCard = ({ children, className = '', onClick }) => (
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
      <span className="text-xs font-black tracking-wider">{message}</span>
    </div>
  </div>
);

const ModalOverlay = ({ onClose, children, z = 60 }) => (
  <div
    className={`fixed inset-0 z-[${z}] flex items-end sm:items-center justify-center sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200`}
    onClick={onClose}
  >
    <div
      className="w-full max-h-[90vh] sm:h-auto sm:max-w-md bg-[#1E1E1E] sm:rounded-lg rounded-t-2xl border border-white/5 shadow-2xl flex flex-col overflow-hidden"
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  </div>
);

const RowItem = ({ title, right, sub, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full flex items-center justify-between p-4 active:bg-white/5 transition-colors text-left"
  >
    <div className="min-w-0">
      <div className="text-sm font-black text-white truncate">{title}</div>
      {sub && <div className="text-[10px] text-zinc-500 font-black mt-1 truncate">{sub}</div>}
    </div>
    <div className="flex items-center gap-2">
      {right && <div className="text-xs font-black text-zinc-300 tabular-nums">{right}</div>}
      <ChevronRight size={16} className="text-zinc-400" />
    </div>
  </button>
);

/* --- Calculator --- */
const safeCalculate = (expression) => {
  if (!expression || /[^0-9+\-*/.]/.test(expression)) return '0';
  try {
    const tokens = expression.match(/(\d+(\.\d+)?|[\+\-\*\/])/g);
    if (!tokens) return 0;

    const stack = [];
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
      const op = stack[i];
      const v = parseFloat(stack[i + 1]);
      if (op === '+') result += v;
      if (op === '-') result -= v;
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
    if (isResult && !['+', '-', '*', '/'].includes(val)) {
      setDisplay(String(val));
      setIsResult(false);
      return;
    }
    setDisplay((prev) => (prev === '0' && !['+', '-', '*', '/', '.'].includes(val) ? String(val) : prev + val));
    setIsResult(false);
  };

  const btns = [
    { l: 'C', act: () => setDisplay('0'), style: 'text-red-400' },
    { l: '/', act: () => handlePush('/'), style: 'text-emerald-400' },
    { l: '*', act: () => handlePush('*'), style: 'text-emerald-400' },
    { l: <Delete size={18} />, act: () => setDisplay((p) => (p.length > 1 ? p.slice(0, -1) : '0')), style: 'text-zinc-400' },
    { l: '7', act: () => handlePush('7') },
    { l: '8', act: () => handlePush('8') },
    { l: '9', act: () => handlePush('9') },
    { l: '-', act: () => handlePush('-'), style: 'text-emerald-400' },
    { l: '4', act: () => handlePush('4') },
    { l: '5', act: () => handlePush('5') },
    { l: '6', act: () => handlePush('6') },
    { l: '+', act: () => handlePush('+'), style: 'text-emerald-400' },
    { l: '1', act: () => handlePush('1') },
    { l: '2', act: () => handlePush('2') },
    { l: '3', act: () => handlePush('3') },
    {
      l: '=',
      act: () => {
        setDisplay(String(safeCalculate(display)));
        setIsResult(true);
      },
      style: 'bg-emerald-500/20 text-emerald-400 row-span-2',
    },
    { l: '0', act: () => handlePush('0'), style: 'col-span-2' },
    { l: '.', act: () => handlePush('.') },
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
            className={`rounded-lg bg-zinc-800 border border-white/5 text-lg font-black active:scale-95 transition-all flex items-center justify-center ${
              b.style || 'text-white'
            }`}
          >
            {b.l}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onConfirm(toNumber(display))}
        className="w-full h-12 bg-white text-black rounded-lg font-black uppercase tracking-widest active:scale-95 shadow-lg"
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

  // ✅ ローカルで初期化（1/1に「今月」押して12月になる問題対策）
  const [month, setMonth] = useState(getMonthStringLocal(new Date()));

  const [toast, setToast] = useState({ visible: false, message: '' });

  // tx modal
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [editingTx, setEditingTx] = useState(null);

  const [inputDate, setInputDate] = useState(getTodayStringLocal());
  const [inputAmount, setInputAmount] = useState('');
  const [inputTitle, setInputTitle] = useState('');
  const [inputCategory, setInputCategory] = useState('');
  const [inputMethod, setInputMethod] = useState('');

  // settings modal
  const [editingItem, setEditingItem] = useState(null); // {type, index, data...}
  const [isDebugOpen, setIsDebugOpen] = useState(false);

  // data
  const [transactions, setTransactions] = useState([]);
  const [lastMonthTransactions, setLastMonthTransactions] = useState([]);
  const [monthlyData, setMonthlyData] = useState(normalizeMonthlyData({}));
  const [config, setConfig] = useState(normalizeConfig({}));

  // list filter
  const [searchText, setSearchText] = useState('');
  const [filter, setFilter] = useState({ category: 'ALL', method: 'ALL' });

  const mainRef = useRef(null);

  const showToastMsg = (msg) => {
    setToast({ visible: true, message: msg });
    setTimeout(() => setToast({ visible: false, message: '' }), 2500);
  };

  const paymentMethodsSafe = useMemo(
    () => (config?.paymentMethods?.length ? config.paymentMethods : [CASH]),
    [config]
  );

  const getCategoryNames = () => (config?.categories || []).map((c) => c.name);
  const getCategoryIcon = (name) => {
    const c = (config?.categories || []).find((x) => x.name === name);
    return c?.icon || '🏷';
  };

  /* --- AUTH --- */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  /* --- DATA SUBS --- */
  useEffect(() => {
    if (!user) return;

    const start = monthStartISO(month);
    const end = monthNextStartISO(month);

    const qTx = query(
      collection(db, 'users', user.uid, 'transactions'),
      where('date', '>=', start),
      where('date', '<', end)
    );

    const unsub = onSnapshot(qTx, (s) => {
      const list = s.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => new Date(b.date) - new Date(a.date));
      setTransactions(list);
    });

    return () => unsub();
  }, [month, user]);

  useEffect(() => {
    if (!user) return;

    const prevMonth = shiftMonth(month, -1);
    const prevStart = monthStartISO(prevMonth);
    const curStart = monthStartISO(month);

    const fetchLast = async () => {
      const qLast = query(
        collection(db, 'users', user.uid, 'transactions'),
        where('date', '>=', prevStart),
        where('date', '<', curStart)
      );
      const s = await getDocs(qLast);
      setLastMonthTransactions(s.docs.map((d) => ({ id: d.id, ...d.data() })));
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
    const fixedCashTotal = fixedCosts.filter((f) => !f.method || f.method === CASH).reduce((s, i) => s + (Number(i.amount) || 0), 0);
    const fixedCardTotal = fixedCosts.filter((f) => f.method && f.method !== CASH).reduce((s, i) => s + (Number(i.amount) || 0), 0);
    const fixedTotal = fixedCashTotal + fixedCardTotal;

    const totalBudget = Number(monthlyData?.budget) || 0;
    const spentCard = transactions.filter((t) => t.paymentMethod !== CASH).reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const cardRemaining = totalBudget - fixedTotal - spentCard;

    const cashBudgetTotal = Number(monthlyData?.cashBudget) || 0;
    const spentCash = transactions.filter((t) => t.paymentMethod === CASH).reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const cashRemaining = cashBudgetTotal - spentCash;

    const billTotal = Object.values(monthlyData?.cardBills || {}).reduce((s, v) => s + (Number(v) || 0), 0);
    const totalWithdrawal = fixedCashTotal + billTotal;
    const bankBalanceProjected = (Number(monthlyData?.salary) || 0) - totalWithdrawal;

    const getCatTotals = (txs) =>
      (txs || []).reduce((acc, t) => {
        acc[t.category] = (acc[t.category] || 0) + (Number(t.amount) || 0);
        return acc;
      }, {});

    const catBudgetSum = (config?.categories || []).reduce((sum, c) => sum + (monthlyData?.catBudgets?.[c.name] || 0), 0);

    const now = new Date();
    const isCurrentMonth = month === getMonthStringLocal(now);
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
      cardRemainingPercent: totalBudget - fixedTotal > 0 ? Math.round((cardRemaining / (totalBudget - fixedTotal)) * 100) : 0,
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
      }, {}),
    };
  }, [monthlyData, transactions, lastMonthTransactions, month, config]);

  /* --- ✅ 引き落としアラート（B: 期限切れも表示 / 今月 / 金額あり / 未完了） --- */
  const activeAlerts = useMemo(() => {
    const now = new Date();
    const isCurrentMonth = month === getMonthStringLocal(now);
    if (!isCurrentMonth) return [];

    const today = now.getDate();
    const bills = monthlyData?.cardBills || {};
    const dueDates = monthlyData?.cardDueDates || {};
    const confirmed = monthlyData?.confirmedPayments || [];

    // ルール：bill > 0 && dueDay有り && 未完了
    // 表示：dueDay < today は期限切れ、それ以外は「あと◯日」
    const items = Object.entries(dueDates)
      .map(([card, day]) => [card, Number(day)])
      .filter(([card, dueDay]) => {
        if (!dueDay || Number.isNaN(dueDay)) return false;
        const bill = Number(bills[card]) || 0;
        const isConfirmed = confirmed.includes(card);
        return bill > 0 && !isConfirmed;
      })
      .map(([card, dueDay]) => {
        const bill = Number(bills[card]) || 0;
        const overdue = dueDay < today;
        const days = overdue ? today - dueDay : dueDay - today;
        return { card, dueDay, bill, overdue, days };
      })
      .sort((a, b) => {
        // 期限切れを上に、同じなら近い順
        if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
        return a.days - b.days;
      });

    return items;
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

  const unconfirmPayment = async (cardName) => {
    if (!user) return;
    const confirmed = monthlyData?.confirmedPayments || [];
    if (!confirmed.includes(cardName)) return;

    await setDoc(
      doc(db, 'users', user.uid, 'months', month),
      { confirmedPayments: confirmed.filter((c) => c !== cardName) },
      { merge: true }
    );
    showToastMsg('完了を解除しました');
  };

  /* --- TX CRUD --- */
  const resetTxInputs = (dateStr = getTodayStringLocal()) => {
    const cats = getCategoryNames();
    const methods = paymentMethodsSafe;
    setInputDate(dateStr);
    setInputAmount('');
    setInputTitle('');
    setInputCategory(cats[0] || '食費');
    setInputMethod(methods[0] || CASH);
    setShowCalculator(false);
  };

  const openTxModalNew = () => {
    setEditingTx(null);
    resetTxInputs(getTodayStringLocal());
    setIsTxModalOpen(true);
  };

  const openTxModalWithDate = (dateStr) => {
    setEditingTx(null);
    resetTxInputs(dateStr);
    setIsTxModalOpen(true);
  };

  const startEditingTx = (t) => {
    const cats = getCategoryNames();
    const methods = paymentMethodsSafe;

    setEditingTx(t);
    setInputDate(isoToLocalYMD(t.date)); // ✅ 1日前問題ここで解消
    setInputAmount(String(t.amount ?? ''));
    setInputTitle(t.title || '');
    setInputCategory(cats.includes(t.category) ? t.category : (cats[0] || '食費'));
    setInputMethod(methods.includes(t.paymentMethod) ? t.paymentMethod : (methods[0] || CASH));
    setShowCalculator(false);
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
      date: toISODateNoonLocal(inputDate), // ✅ 正午保存
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
      setIsTxModalOpen(false);
      setEditingTx(null);
    } catch (err) {
      console.error(err);
      showToastMsg('保存に失敗しました');
    }
  };

  /* --- SETTINGS SAVE HELPERS --- */
  const saveMonthMerge = async (patch) => {
    await setDoc(doc(db, 'users', user.uid, 'months', month), patch, { merge: true });
  };

  const saveConfigMerge = async (patch) => {
    await setDoc(doc(db, 'users', user.uid, 'settings', 'config'), patch, { merge: true });
  };

  // ✅ 引き落とし日/額が保存されない問題対策：
  // setDocの "cardDueDates.xxx" みたいなドットキーを使わず、Mapを丸ごと更新する
  const setCardBill = async (cardName, bill) => {
    const next = { ...(monthlyData.cardBills || {}), [cardName]: bill };
    await saveMonthMerge({ cardBills: next });
  };
  const setCardDueDate = async (cardName, dueDayStr) => {
    const next = { ...(monthlyData.cardDueDates || {}), [cardName]: String(dueDayStr || '') };
    await saveMonthMerge({ cardDueDates: next });
  };

  /* --- FILTERED LIST --- */
  const finalFilteredTx = useMemo(() => {
    return transactions.filter((t) => {
      const matchSearch = searchText === '' || (t.title || '').includes(searchText);
      const matchCat = filter.category === 'ALL' || t.category === filter.category;
      const matchMethod = filter.method === 'ALL' || t.paymentMethod === filter.method;
      return matchSearch && matchCat && matchMethod;
    });
  }, [transactions, searchText, filter]);

  const calendarDaysList = useMemo(() => {
    if (!month) return [];
    const [y, m] = month.split('-').map(Number);
    const d = new Date(y, m - 1, 1);
    const first = d.getDay();
    const last = new Date(y, m, 0).getDate();
    return [...Array(first).fill(null), ...Array.from({ length: last }, (_, i) => i + 1)];
  }, [month]);

  /* --- SETTINGS: actions --- */
  const copyLastMonthSettings = async () => {
    if (!user) return;
    if (!window.confirm('先月の設定をコピーしますか？')) return;

    const lastMonthStr = shiftMonth(month, -1);
    try {
      const snap = await getDoc(doc(db, 'users', user.uid, 'months', lastMonthStr));
      if (!snap.exists()) return showToastMsg('先月のデータがありません');

      const last = snap.data();
      await setDoc(
        doc(db, 'users', user.uid, 'months', month),
        {
          budget: last.budget || 0,
          cashBudget: last.cashBudget || 0,
          salary: last.salary || 0,
          fixedCosts: last.fixedCosts || [],
          catBudgets: last.catBudgets || {},
          cardBills: last.cardBills || {},
          cardDueDates: last.cardDueDates || {},
          confirmedPayments: [], // 今月はリセット
        },
        { merge: true }
      );
      showToastMsg('コピーしました');
    } catch (e) {
      console.error(e);
      showToastMsg('エラーが発生しました');
    }
  };

  const handleExportCSV = async () => {
    if (!user) return;
    if (!window.confirm('全データをCSV出力しますか？')) return;

    try {
      const qAll = query(collection(db, 'users', user.uid, 'transactions'), orderBy('date', 'desc'));
      const s = await getDocs(qAll);

      let csv = '\uFEFF日付,タイトル,カテゴリ,金額,支払方法\n';
      s.forEach((dd) => {
        const d = dd.data();
        const day = isoToLocalYMD(d.date);
        const title = String(d.title || '').replace(/"/g, '""');
        csv += `${day},"${title}",${d.category || ''},${d.amount || 0},${d.paymentMethod || ''}\n`;
      });

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `zaimu_export_${getTodayStringLocal()}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showToastMsg('CSVを出力しました');
    } catch (e) {
      console.error(e);
      showToastMsg('エラーが発生しました');
    }
  };

  const handleMoveCategory = async (index, direction) => {
    const cats = [...(config.categories || [])];
    if (direction === 'up' && index > 0) [cats[index], cats[index - 1]] = [cats[index - 1], cats[index]];
    else if (direction === 'down' && index < cats.length - 1) [cats[index], cats[index + 1]] = [cats[index + 1], cats[index]];
    else return;

    setConfig((prev) => ({ ...prev, categories: cats }));
    await saveConfigMerge({ categories: cats });
  };

  /* --- SETTINGS: open edit modals --- */
  const openEditBudgetField = (fieldKey) => {
    const labelMap = { salary: '手取り給与', budget: '生活費予算（総枠）', cashBudget: '現金予算（口座用）' };
    setEditingItem({
      type: 'budgetField',
      fieldKey,
      label: labelMap[fieldKey] || '編集',
      value: Number(monthlyData?.[fieldKey] || 0),
    });
  };

  const openEditCardSchedule = (cardName) => {
    setEditingItem({
      type: 'cardSchedule',
      cardName,
      bill: Number(monthlyData?.cardBills?.[cardName] || 0),
      dueDay: String(monthlyData?.cardDueDates?.[cardName] || ''),
    });
  };

  const openEditFixed = (idx) => {
    const f = (monthlyData.fixedCosts || [])[idx];
    setEditingItem({ type: 'fixed', index: idx, data: { ...f } });
  };

  const openAddFixed = () => {
    setEditingItem({ type: 'fixed', index: -1, data: { id: Date.now(), name: '', amount: '', method: CASH } });
  };

  const openEditCategory = (idx) => {
    const c = (config.categories || [])[idx];
    const n = c?.name || '';
    const b = monthlyData?.catBudgets?.[n] || 0;
    setEditingItem({ type: 'category', index: idx, data: { name: n, icon: c?.icon || '🏷', budget: b } });
  };

  const openAddCategory = () => {
    setEditingItem({ type: 'category', index: -1, data: { name: '', icon: '🏷', budget: '' } });
  };

  const openEditTemplate = (idx) => {
    const t = (config.templates || [])[idx];
    setEditingItem({ type: 'template', index: idx, data: { ...t } });
  };

  const openAddTemplate = () => {
    setEditingItem({
      type: 'template',
      index: -1,
      data: {
        title: '',
        amount: '',
        category: getCategoryNames()[0] || '食費',
        method: paymentMethodsSafe[0] || CASH,
      },
    });
  };

  const openEditPayment = (idx) => {
    const p = (config.paymentMethods || [])[idx];
    setEditingItem({ type: 'payment', index: idx, data: { name: p } });
  };

  const openAddPayment = () => {
    setEditingItem({ type: 'payment', index: -1, data: { name: '' } });
  };

  /* --- SETTINGS: save/delete --- */
  const handleSettingsSave = async () => {
    if (!editingItem || !user) return;

    try {
      if (editingItem.type === 'budgetField') {
        const v = toNumber(editingItem.value);
        await saveMonthMerge({ [editingItem.fieldKey]: v });
        showToastMsg('保存しました');
        setEditingItem(null);
        return;
      }

      if (editingItem.type === 'cardSchedule') {
        const bill = toNumber(editingItem.bill);
        const due = String(editingItem.dueDay || '');
        // billとdueが両方空はやめる（間違い防止）
        if (!editingItem.cardName) return;

        await setCardBill(editingItem.cardName, bill);
        await setCardDueDate(editingItem.cardName, due);
        showToastMsg('保存しました');
        setEditingItem(null);
        return;
      }

      if (editingItem.type === 'fixed') {
        const list = [...(monthlyData.fixedCosts || [])];
        const d = editingItem.data || {};
        const next = {
          id: d.id || Date.now(),
          name: String(d.name || '').trim(),
          amount: toNumber(d.amount),
          method: d.method || CASH,
        };
        if (!next.name) return showToastMsg('名前を入力してね');

        if (editingItem.index === -1) list.unshift(next);
        else list[editingItem.index] = next;

        await saveMonthMerge({ fixedCosts: list });
        showToastMsg('保存しました');
        setEditingItem(null);
        return;
      }

      if (editingItem.type === 'category') {
        const cats = [...(config.categories || [])];
        const d = editingItem.data || {};
        const name = String(d.name || '').trim();
        const icon = String(d.icon || '🏷');

        if (!name) return showToastMsg('カテゴリ名を入力してね');

        // rename時：catBudgetsのキー移動
        const prevName = editingItem.index !== -1 ? (cats[editingItem.index]?.name || '') : '';
        if (editingItem.index === -1) cats.push({ name, icon });
        else cats[editingItem.index] = { name, icon };

        await saveConfigMerge({ categories: cats });

        // budget
        const b = toNumber(d.budget);
        const nextBudgets = { ...(monthlyData.catBudgets || {}) };
        if (prevName && prevName !== name) {
          // 旧キーを移して削除
          if (nextBudgets[prevName] !== undefined && nextBudgets[name] === undefined) nextBudgets[name] = nextBudgets[prevName];
          delete nextBudgets[prevName];
        }
        nextBudgets[name] = b;

        await saveMonthMerge({ catBudgets: nextBudgets });

        showToastMsg('保存しました');
        setEditingItem(null);
        return;
      }

      if (editingItem.type === 'template') {
        const t = [...(config.templates || [])];
        const d = editingItem.data || {};
        const next = {
          title: String(d.title || '').trim(),
          amount: toNumber(d.amount),
          category: d.category || (getCategoryNames()[0] || '食費'),
          method: d.method || (paymentMethodsSafe[0] || CASH),
        };
        if (!next.title) return showToastMsg('テンプレート名を入力してね');

        if (editingItem.index === -1) t.unshift(next);
        else t[editingItem.index] = next;

        await saveConfigMerge({ templates: t });
        showToastMsg('保存しました');
        setEditingItem(null);
        return;
      }

      if (editingItem.type === 'payment') {
        const p = [...(config.paymentMethods || [CASH])];
        const name = String(editingItem.data?.name || '').trim();
        if (!name) return showToastMsg('支払方法名を入力してね');

        if (editingItem.index === -1) p.push(name);
        else p[editingItem.index] = name;

        // 現金は必ず含める
        if (!p.includes(CASH)) p.unshift(CASH);

        await saveConfigMerge({ paymentMethods: p });
        showToastMsg('保存しました');
        setEditingItem(null);
        return;
      }
    } catch (e) {
      console.error(e);
      showToastMsg('保存に失敗しました');
    }
  };

  const handleDeleteItem = async () => {
    if (!editingItem || !user) return;
    if (!window.confirm('削除しますか？')) return;

    try {
      if (editingItem.type === 'fixed') {
        const list = (monthlyData.fixedCosts || []).filter((_, i) => i !== editingItem.index);
        await saveMonthMerge({ fixedCosts: list });
        showToastMsg('削除しました');
        setEditingItem(null);
        return;
      }

      if (editingItem.type === 'category') {
        const cats = [...(config.categories || [])];
        const removed = cats[editingItem.index];
        const name = removed?.name;

        const nextCats = cats.filter((_, i) => i !== editingItem.index);
        await saveConfigMerge({ categories: nextCats });

        // 予算も消す（任意だけど、基本は一緒に消した方が混乱しない）
        const nextBudgets = { ...(monthlyData.catBudgets || {}) };
        if (name) delete nextBudgets[name];
        await saveMonthMerge({ catBudgets: nextBudgets });

        showToastMsg('削除しました');
        setEditingItem(null);
        return;
      }

      if (editingItem.type === 'template') {
        const next = (config.templates || []).filter((_, i) => i !== editingItem.index);
        await saveConfigMerge({ templates: next });
        showToastMsg('削除しました');
        setEditingItem(null);
        return;
      }

      if (editingItem.type === 'payment') {
        const name = config.paymentMethods?.[editingItem.index];
        if (name === CASH) return showToastMsg('「現金」は削除できません');

        const next = (config.paymentMethods || []).filter((_, i) => i !== editingItem.index);
        await saveConfigMerge({ paymentMethods: next.includes(CASH) ? next : [CASH, ...next] });
        showToastMsg('削除しました');
        setEditingItem(null);
        return;
      }
    } catch (e) {
      console.error(e);
      showToastMsg('削除に失敗しました');
    }
  };

  /* --- DEBUG DATA --- */
  const debugPayload = useMemo(() => {
    const now = new Date();
    return {
      meta: {
        nowLocal: now.toString(),
        tzOffsetMinutes: now.getTimezoneOffset(),
        month,
        today: getTodayStringLocal(),
        isCurrentMonth: month === getMonthStringLocal(now),
      },
      monthsDoc: monthlyData,
      configDoc: config,
      computed: {
        paymentMethodsSafe,
        cardBills: monthlyData?.cardBills || {},
        cardDueDates: monthlyData?.cardDueDates || {},
        confirmedPayments: monthlyData?.confirmedPayments || [],
        activeAlerts,
        note:
          '⚠️ アラートは「今月」「cardBills[カード] > 0」「cardDueDates[カード]がある」「confirmedPaymentsに含まれない」で表示します。期限切れも表示します。',
      },
    };
  }, [month, monthlyData, config, paymentMethodsSafe, activeAlerts]);

  const copyDebugToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(debugPayload, null, 2));
      showToastMsg('デバッグ情報をコピーしました');
    } catch {
      showToastMsg('コピーできませんでした');
    }
  };

  /* --- RENDER GUARDS --- */
  if (authLoading) {
    return (
      <div className="h-screen bg-[#121212] flex items-center justify-center text-zinc-600 font-black">
        認証を確認中…
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
          className="w-full max-w-xs h-14 bg-white text-black rounded-full font-black uppercase flex items-center justify-center gap-3 active:scale-95 transition-transform"
        >
          <Lock size={18} /> Googleでログイン
        </button>
      </div>
    );
  }

  const SETTING_MENU_ITEMS = [
    { id: 'budget', label: '資金計画・引落日', icon: <Landmark size={18} /> },
    { id: 'fixed', label: '固定費管理', icon: <CreditCard size={18} /> },
    { id: 'category', label: 'カテゴリ管理', icon: <Tags size={18} /> },
    { id: 'template', label: 'テンプレート', icon: <Zap size={18} /> },
    { id: 'payment', label: '支払方法', icon: <Wallet size={18} /> },
  ];
  const currentSettingTitle = SETTING_MENU_ITEMS.find((i) => i.id === settingTab)?.label || '設定';

  return (
    <div className="fixed inset-0 w-full bg-[#121212] text-zinc-200 font-sans font-black flex flex-col justify-center overflow-hidden">
      <Toast message={toast.message} isVisible={toast.visible} />

      <div className="w-full max-w-md h-full flex flex-col relative bg-[#121212] shadow-2xl mx-auto">
        {/* HEADER */}
        <header className="flex-none h-16 border-b border-white/5 px-4 flex items-center justify-between bg-[#121212]/80 backdrop-blur-xl z-50">
          {activeTab === 'settings' && settingTab !== 'menu' ? (
            <>
              <button onClick={() => setSettingTab('menu')} className="text-zinc-300 active:text-white">
                <ArrowLeft size={24} />
              </button>

              <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center">
                <span className="text-xs font-black text-white uppercase">{currentSettingTitle}</span>
                {(settingTab === 'fixed' || settingTab === 'category') && (
                  <span className="text-[10px] text-zinc-500 tabular-nums">
                    計 ¥{(settingTab === 'fixed' ? summary.fixedTotal : summary.catBudgetSum).toLocaleString()}
                  </span>
                )}
              </div>
              <div className="w-6" />
            </>
          ) : (
            <>
              <div className="w-8 h-8 rounded-xl bg-white/5 p-1">
                <img src="/favicon.ico" referrerPolicy="no-referrer" alt="logo" className="w-full h-full" />
              </div>

              <div className="flex items-center gap-4">
                <button type="button" onClick={() => setMonth((m) => shiftMonth(m, -1))}>
                  <ChevronLeft size={20} />
                </button>

                <span className="text-sm font-black text-white tabular-nums">{formatMonthJP(month)}</span>

                <button type="button" onClick={() => setMonth((m) => shiftMonth(m, +1))}>
                  <ChevronRight size={20} />
                </button>
              </div>

              {/* ✅ 今月（ローカル月で確実に） */}
              <button
                type="button"
                onClick={() => setMonth(getMonthStringLocal(new Date()))}
                className="text-zinc-400 active:text-white"
              >
                <Calendar size={20} />
              </button>
            </>
          )}
        </header>

        {/* MAIN */}
        <main
          ref={mainRef}
          className="flex-1 overflow-y-auto scrollbar-hide pt-4 overscroll-none"
        >
          {/* pbは必要最小限。スクロールの「余白感」軽減 + フッター被り防止 */}
          <div className="p-4 pb-24">
            {/* HOME */}
            {activeTab === 'home' && (
              <div className="space-y-4 animate-in fade-in duration-300">
                <div className="bg-[#1E1E1E] p-1 rounded-xl flex gap-1 mb-2 border border-white/5">
                  <button
                    type="button"
                    onClick={() => setHomeView('spending')}
                    className={`flex-1 py-2 rounded-lg text-xs font-black flex items-center justify-center gap-2 ${
                      homeView === 'spending' ? 'bg-white text-black shadow-lg' : 'text-zinc-500'
                    }`}
                  >
                    <LayoutGrid size={14} /> 支出管理
                  </button>

                  <button
                    type="button"
                    onClick={() => setHomeView('forecast')}
                    className={`flex-1 py-2 rounded-lg text-xs font-black flex items-center justify-center gap-2 ${
                      homeView === 'forecast' ? 'bg-white text-black shadow-lg' : 'text-zinc-500'
                    }`}
                  >
                    <ListChecks size={14} /> 収支・予定
                  </button>
                </div>

                {homeView === 'spending' ? (
                  <div className="space-y-4 animate-in slide-in-from-left-2">
                    <SimpleCard className="p-6">
                      <div className="flex justify-between mb-4">
                        <div>
                          <p className="text-[10px] text-zinc-500 uppercase">今月あと使える（カード）</p>
                          <h2 className={`text-4xl font-black mt-1 tabular-nums ${summary.cardRemaining < 0 ? 'text-red-400' : 'text-white'}`}>
                            ¥{summary.cardRemaining.toLocaleString()}
                          </h2>
                        </div>
                        <div className="text-right text-[9px] text-zinc-600 uppercase">
                          軍資金
                          <p className="text-zinc-400 font-black tabular-nums">¥{summary.cardBudget.toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-white transition-all duration-1000" style={{ width: `${summary.cardRemainingPercent}%` }} />
                      </div>
                    </SimpleCard>

                    <SimpleCard className="p-6">
                      <div className="flex justify-between mb-4">
                        <div>
                          <p className="text-[10px] text-zinc-500 uppercase">今月あと使える（口座）</p>
                          <h2 className={`text-4xl font-black mt-1 tabular-nums ${summary.cashRemaining < 0 ? 'text-red-400' : 'text-white'}`}>
                            ¥{summary.cashRemaining.toLocaleString()}
                          </h2>
                        </div>
                        <div className="text-right text-[9px] text-zinc-600 uppercase">
                          軍資金
                          <p className="text-zinc-400 font-black tabular-nums">¥{summary.cashBudget.toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-zinc-500 transition-all duration-1000" style={{ width: `${summary.cashRemainingPercent}%` }} />
                      </div>
                    </SimpleCard>
                  </div>
                ) : (
                  <div className="space-y-4 animate-in slide-in-from-right-2">
                    {/* ✅ 引き落としアラート（B:期限切れも表示） */}
                    {activeAlerts.length > 0 && (
                      <SimpleCard className="bg-red-500/10 border-red-500/30 p-4">
                        <div className="flex items-center gap-2 text-red-300 mb-2 font-black text-xs">
                          <Calendar size={14} /> 引き落としの注意
                        </div>

                        <div className="space-y-2">
                          {activeAlerts.map((a) => (
                            <div key={a.card} className="flex justify-between items-center bg-black/20 p-2 rounded">
                              <div className="min-w-0">
                                <div className="text-xs font-black text-white truncate">
                                  {a.card}（{a.dueDay}日）
                                </div>
                                <div className="text-[10px] text-zinc-400 tabular-nums">
                                  {a.overdue ? `期限切れ：${a.days}日` : `あと${a.days}日`} / ¥{a.bill.toLocaleString()}
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                {a.overdue ? (
                                  <span className="text-[10px] px-2 py-1 rounded-full bg-red-500/20 text-red-200 font-black">
                                    期限切れ
                                  </span>
                                ) : (
                                  <span className="text-[10px] px-2 py-1 rounded-full bg-white/10 text-zinc-200 font-black">
                                    予定
                                  </span>
                                )}

                                <button
                                  type="button"
                                  onClick={() => confirmPayment(a.card)}
                                  className="text-[10px] bg-red-500 text-white px-3 py-1 rounded-full font-black active:scale-95"
                                >
                                  完了
                                </button>
                              </div>
                            </div>
                          ))}

                          {/* 完了済みを戻せる（地味に便利） */}
                          {(monthlyData.confirmedPayments || []).length > 0 && (
                            <div className="pt-2 border-t border-white/10">
                              <div className="text-[10px] text-zinc-500 font-black mb-2">完了済み</div>
                              <div className="flex flex-wrap gap-2">
                                {(monthlyData.confirmedPayments || []).map((c) => (
                                  <button
                                    key={c}
                                    type="button"
                                    onClick={() => unconfirmPayment(c)}
                                    className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] text-zinc-300 font-black active:bg-white/10"
                                  >
                                    {c}（戻す）
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </SimpleCard>
                    )}

                    <SimpleCard className="p-5 space-y-3">
                      <div className="flex justify-between items-end">
                        <p className="text-[10px] text-zinc-500 uppercase">口座残高見込み（引落後）</p>
                        <Banknote size={16} className="text-zinc-600" />
                      </div>

                      <div className="flex justify-between items-center text-xs text-zinc-400">
                        給与収入
                        <span className="text-sm font-black text-white tabular-nums">+ ¥{Number(monthlyData.salary || 0).toLocaleString()}</span>
                      </div>

                      <div className="flex justify-between items-center text-xs text-zinc-400">
                        引き落とし計
                        <span className="text-sm font-black text-red-300 tabular-nums">- ¥{summary.totalWithdrawal.toLocaleString()}</span>
                      </div>

                      <div className="pt-2 border-t border-white/5 flex justify-between items-end text-xs font-black text-zinc-500">
                        残高予想
                        <span className="text-2xl font-black text-white tabular-nums">¥{summary.bankBalanceProjected.toLocaleString()}</span>
                      </div>
                    </SimpleCard>

                    <div className="grid grid-cols-2 gap-3">
                      {getCategoryNames().map((n) => {
                        const spent = summary.catTotals[n] || 0;
                        const budget = monthlyData.catBudgets?.[n] || 0;
                        if (budget === 0) return null;
                        return (
                          <SimpleCard key={n} className="p-3 space-y-2">
                            <div className="flex justify-between items-center text-[9px] font-black">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span>{getCategoryIcon(n)}</span>
                                <span className="text-zinc-400 truncate">{n}</span>
                              </div>
                              <span className="text-white tabular-nums">
                                ¥{spent.toLocaleString()} / ¥{budget.toLocaleString()}
                              </span>
                            </div>
                            <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                              <div className="h-full bg-zinc-500" style={{ width: `${Math.min(100, (spent / budget) * 100)}%` }} />
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
                          onChange={(e) => setSearchText(e.target.value)}
                          placeholder="検索…"
                          className="w-full h-10 bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 text-xs text-white outline-none font-black"
                        />
                        <Search size={14} className="absolute left-3 top-3 text-zinc-500" />
                      </div>

                      <div className="flex bg-[#1E1E1E] rounded-lg border border-white/10 p-0.5">
                        <button
                          type="button"
                          onClick={() => setLogView('list')}
                          className={`p-2 rounded ${logView === 'list' ? 'bg-white text-black' : 'text-zinc-500'}`}
                        >
                          <AlignJustify size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setLogView('calendar')}
                          className={`p-2 rounded ${logView === 'calendar' ? 'bg-white text-black' : 'text-zinc-500'}`}
                        >
                          <CalendarDays size={16} />
                        </button>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <select
                        onChange={(e) => setFilter({ ...filter, category: e.target.value })}
                        className="bg-black/40 border border-white/10 rounded-lg px-2 h-9 text-[10px] flex-1 text-zinc-300 outline-none font-black"
                        value={filter.category}
                      >
                        <option value="ALL">全てのカテゴリ</option>
                        {getCategoryNames().map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>

                      <select
                        onChange={(e) => setFilter({ ...filter, method: e.target.value })}
                        className="bg-black/40 border border-white/10 rounded-lg px-2 h-9 text-[10px] flex-1 text-zinc-300 outline-none font-black"
                        value={filter.method}
                      >
                        <option value="ALL">全ての支払方法</option>
                        {paymentMethodsSafe.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="pt-24">
                  {logView === 'list' ? (
                    <SimpleCard>
                      {finalFilteredTx.length === 0 ? (
                        <div className="py-20 flex flex-col items-center gap-3 text-zinc-600">
                          <Sparkles size={48} className="opacity-20" />
                          <p className="text-xs uppercase font-black">まだ支出がありません</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-white/5">
                          {finalFilteredTx.map((t) => (
                            <div
                              key={t.id}
                              onClick={() => startEditingTx(t)}
                              className="flex items-center justify-between p-4 cursor-pointer active:bg-white/5 transition-colors"
                            >
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className="w-10 text-[10px] text-zinc-500 tabular-nums">
                                  {formatDateShort(t.date)}
                                </div>
                                <div className="w-12 text-center text-[9px] bg-white/5 text-zinc-400 rounded py-0.5 truncate">
                                  {t.category}
                                </div>
                                <div className="flex-1 truncate text-sm font-black text-white">{t.title}</div>
                              </div>
                              <span className="text-sm font-black tabular-nums text-white pl-2">
                                ¥{Number(t.amount || 0).toLocaleString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </SimpleCard>
                  ) : (
                    <SimpleCard className="p-4">
                      <div className="grid grid-cols-7 gap-1 text-center mb-2 text-[10px] text-zinc-600 uppercase font-black">
                        {['日', '月', '火', '水', '木', '金', '土'].map((d) => (
                          <div key={d}>{d}</div>
                        ))}
                      </div>

                      <div className="grid grid-cols-7 gap-1">
                        {calendarDaysList.map((day, i) => {
                          if (!day) return <div key={i} />;
                          const a = summary.dailyTotals[day] || 0;

                          const now = new Date();
                          const isCurrentMonth = month === getMonthStringLocal(now);
                          const isToday = isCurrentMonth && day === now.getDate();

                          const dateStr = `${month}-${pad2(day)}`;
                          const clickedDate = new Date(`${dateStr}T12:00:00`);
                          const todayNoon = new Date(`${getTodayStringLocal()}T12:00:00`);
                          const isPastOrToday = clickedDate.getTime() <= todayNoon.getTime();

                          // ✅ ノーマネーデー演出（シンプル1パターン）
                          const showNoMoneyEmoji = a === 0 && isPastOrToday;

                          return (
                            <div
                              key={i}
                              onClick={() => openTxModalWithDate(dateStr)}
                              className={`aspect-square rounded-lg border flex flex-col items-center justify-center relative transition-transform active:scale-95 ${
                                isToday
                                  ? 'border-white bg-white/10 shadow-[0_0_10px_rgba(255,255,255,0.1)]'
                                  : 'border-white/5 bg-black/20'
                              }`}
                            >
                              <span className={`text-[9px] font-black ${isToday ? 'text-white' : 'text-zinc-500'} tabular-nums`}>
                                {day}
                              </span>

                              {a > 0 ? (
                                <span className="text-[8px] text-zinc-300 tabular-nums">
                                  ¥{(a / 1000).toFixed(1)}k
                                </span>
                              ) : (
                                showNoMoneyEmoji && <span className="text-[10px] absolute">✨</span>
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
                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-4 font-black">先月との比較</p>
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <h3 className="text-4xl font-black text-white tabular-nums">¥{summary.totalSpent.toLocaleString()}</h3>
                      <div
                        className={`flex items-center gap-1.5 mt-2 text-xs font-black ${
                          summary.totalSpent <= summary.lastTotalSpent ? 'text-emerald-300' : 'text-red-300'
                        }`}
                      >
                        {summary.totalSpent <= summary.lastTotalSpent ? <TrendingDown size={16} /> : <TrendingUp size={16} />}
                        <span className="tabular-nums">
                          先月より ¥{Math.abs(summary.totalSpent - summary.lastTotalSpent).toLocaleString()}{' '}
                          {summary.totalSpent <= summary.lastTotalSpent ? '減少' : '増加'}
                        </span>
                      </div>
                    </div>

                    <div className="text-right text-[10px] text-zinc-600 uppercase font-black">
                      先月総支出
                      <p className="text-sm font-black text-zinc-500 tabular-nums">¥{summary.lastTotalSpent.toLocaleString()}</p>
                    </div>
                  </div>
                </SimpleCard>

                <SimpleCard className="p-6 space-y-6">
                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-black">カテゴリ別 比較</p>
                  <div className="space-y-6">
                    {getCategoryNames().map((n) => {
                      const c = summary.catTotals[n] || 0;
                      const l = summary.lastCatTotals[n] || 0;
                      const max = Math.max(c, l, 1);
                      return (
                        <div key={n} className="space-y-2">
                          <div className="flex justify-between items-center font-black text-[10px]">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-sm">{getCategoryIcon(n)}</span>
                              <span className="text-zinc-300 truncate">{n}</span>
                            </div>
                            <div className="tabular-nums">
                              <span className="text-zinc-600">先月 ¥{l.toLocaleString()}</span>
                              <span className="text-white ml-2">今月 ¥{c.toLocaleString()}</span>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                              <div className="h-full bg-zinc-500 transition-all duration-1000" style={{ width: `${(c / max) * 100}%` }} />
                            </div>
                            <div className="h-1 bg-white/5 rounded-full overflow-hidden opacity-30">
                              <div className="h-full bg-zinc-400" style={{ width: `${(l / max) * 100}%` }} />
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
                  <div className="space-y-6 pb-6">
                    <div className="flex items-center justify-between px-2">
                      <div className="flex items-center gap-3">
                        {user.photoURL ? (
                          <img
                            src={user.photoURL}
                            referrerPolicy="no-referrer"
                            alt="icon"
                            className="w-8 h-8 rounded-full border border-white/10"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center">
                            <User size={16} />
                          </div>
                        )}
                        <span className="text-xs font-black text-white truncate max-w-[220px]">{user.email}</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm('ログアウトしますか？')) signOut(auth);
                        }}
                        className="text-zinc-400 text-[10px] flex items-center gap-1.5 active:text-white uppercase font-black"
                      >
                        <LogOut size={14} /> ログアウト
                      </button>
                    </div>

                    <div className="bg-[#1E1E1E] rounded-xl border border-white/5 overflow-hidden">
                      <div className="divide-y divide-white/5">
                        {SETTING_MENU_ITEMS.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setSettingTab(item.id)}
                            className="w-full flex items-center justify-between p-4 active:bg-white/5 text-zinc-300 transition-colors"
                          >
                            <div className="flex items-center gap-4">
                              {item.icon}
                              <span className="text-sm font-black">{item.label}</span>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-zinc-500 tabular-nums font-black">
                              {item.id === 'fixed'
                                ? `¥${summary.fixedTotal.toLocaleString()}`
                                : item.id === 'category'
                                ? `¥${summary.catBudgetSum.toLocaleString()}`
                                : ''}
                              {/* ✅ 矢印が薄すぎ問題：色濃く */}
                              <ChevronRight size={16} className="text-zinc-400" />
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col items-center gap-4 pt-2">
                      <button
                        type="button"
                        onClick={copyLastMonthSettings}
                        className="px-6 py-3 border border-white/10 text-zinc-300 rounded-full text-xs font-black active:bg-white/5 transition-all"
                      >
                        <CopyCheck className="inline mr-2" size={16} /> 先月の設定をコピー
                      </button>

                      <button
                        type="button"
                        onClick={handleExportCSV}
                        className="text-zinc-500 text-[10px] underline flex items-center gap-2 active:text-white font-black"
                      >
                        <FileText size={12} /> 全データをCSV出力
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsDebugOpen(true)}
                        className="text-zinc-500 text-[10px] underline flex items-center gap-2 active:text-white font-black"
                      >
                        <Bug size={12} /> デバッグ
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* ✅ 追加ボタンは「詳細ページの一番上」採用 */}
                    {settingTab === 'budget' && (
                      <div className="space-y-4 animate-in slide-in-from-right-2">
                        <SimpleCard className="overflow-hidden">
                          <div className="p-4 border-b border-white/5">
                            <div className="text-[10px] text-zinc-500 uppercase font-black">基本</div>
                          </div>
                          <div className="divide-y divide-white/5">
                            <RowItem
                              title="手取り給与"
                              right={`¥${Number(monthlyData.salary || 0).toLocaleString()}`}
                              onClick={() => openEditBudgetField('salary')}
                            />
                            <RowItem
                              title="生活費予算（総枠）"
                              right={`¥${Number(monthlyData.budget || 0).toLocaleString()}`}
                              onClick={() => openEditBudgetField('budget')}
                            />
                            <RowItem
                              title="現金予算（口座用）"
                              right={`¥${Number(monthlyData.cashBudget || 0).toLocaleString()}`}
                              onClick={() => openEditBudgetField('cashBudget')}
                            />
                          </div>
                        </SimpleCard>

                        <SimpleCard className="overflow-hidden">
                          <div className="p-4 border-b border-white/5">
                            <div className="text-[10px] text-zinc-500 uppercase font-black">カード引き落とし</div>
                          </div>
                          <div className="divide-y divide-white/5">
                            {paymentMethodsSafe
                              .filter((m) => m !== CASH)
                              .map((m) => {
                                const bill = Number(monthlyData.cardBills?.[m] || 0);
                                const due = String(monthlyData.cardDueDates?.[m] || '');
                                return (
                                  <RowItem
                                    key={m}
                                    title={m}
                                    sub={`引落日：${due ? `${due}日` : '未設定'} / 引落額：¥${bill.toLocaleString()}`}
                                    onClick={() => openEditCardSchedule(m)}
                                  />
                                );
                              })}
                          </div>
                        </SimpleCard>

                        <SimpleCard className="p-4 text-[10px] text-zinc-500 font-black">
                          ※ 「引き落としの注意」は、今月・金額あり・引落日あり・未完了のものを表示します（期限切れも出ます）。
                        </SimpleCard>
                      </div>
                    )}

                    {settingTab === 'fixed' && (
                      <div className="space-y-3 animate-in slide-in-from-right-2">
                        <button
                          type="button"
                          onClick={openAddFixed}
                          className="w-full h-11 bg-zinc-200 text-black rounded-lg text-[10px] font-black uppercase shadow-lg active:scale-95"
                        >
                          固定費を追加
                        </button>

                        <SimpleCard className="p-5">
                          {(monthlyData.fixedCosts || []).length === 0 ? (
                            <div className="py-10 text-center text-zinc-600 text-xs font-black">固定費がありません</div>
                          ) : (
                            <div className="divide-y divide-white/5">
                              {(monthlyData.fixedCosts || []).map((f, idx) => (
                                <button
                                  key={f.id || idx}
                                  type="button"
                                  onClick={() => openEditFixed(idx)}
                                  className="w-full flex justify-between items-center py-3 active:bg-white/5 transition-colors text-left"
                                >
                                  <div className="min-w-0">
                                    <div className="text-xs text-zinc-200 font-black truncate">{f.name}</div>
                                    <div className="text-[9px] text-zinc-500 uppercase font-black truncate">{f.method || '未設定'}</div>
                                  </div>
                                  <div className="text-sm font-black tabular-nums text-white">¥{Number(f.amount || 0).toLocaleString()}</div>
                                </button>
                              ))}
                            </div>
                          )}
                        </SimpleCard>
                      </div>
                    )}

                    {settingTab === 'category' && (
                      <div className="space-y-3 animate-in slide-in-from-right-2">
                        <button
                          type="button"
                          onClick={openAddCategory}
                          className="w-full h-11 bg-zinc-200 text-black rounded-lg text-[10px] font-black uppercase shadow-lg active:scale-95"
                        >
                          カテゴリを追加
                        </button>

                        <SimpleCard className="p-5">
                          <div className="divide-y divide-white/5">
                            {(config.categories || []).map((c, idx) => {
                              const n = c.name;
                              const b = Number(monthlyData.catBudgets?.[n] || 0);
                              return (
                                <div key={n} className="flex items-center justify-between py-3">
                                  <button
                                    type="button"
                                    onClick={() => openEditCategory(idx)}
                                    className="flex items-center gap-3 flex-1 min-w-0 active:bg-white/5 rounded-md px-2 py-2 -mx-2 transition-colors text-left"
                                  >
                                    <span className="text-xl w-8 text-center">{c.icon || '🏷'}</span>
                                    <div className="min-w-0">
                                      <div className="text-xs font-black text-white truncate">{n}</div>
                                      <div className="text-[10px] text-zinc-500 font-black tabular-nums">
                                        月間予算：¥{b.toLocaleString()}
                                      </div>
                                    </div>
                                  </button>

                                  <div className="flex items-center gap-1 pl-2">
                                    <button
                                      type="button"
                                      onClick={() => handleMoveCategory(idx, 'up')}
                                      className="p-1 text-zinc-500 hover:text-white active:scale-95"
                                      aria-label="up"
                                    >
                                      <ArrowUp size={14} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleMoveCategory(idx, 'down')}
                                      className="p-1 text-zinc-500 hover:text-white active:scale-95"
                                      aria-label="down"
                                    >
                                      <ArrowDown size={14} />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </SimpleCard>
                      </div>
                    )}

                    {settingTab === 'template' && (
                      <div className="space-y-3 animate-in slide-in-from-right-2">
                        <button
                          type="button"
                          onClick={openAddTemplate}
                          className="w-full h-11 bg-zinc-200 text-black rounded-lg text-[10px] font-black uppercase shadow-lg active:scale-95"
                        >
                          テンプレートを追加
                        </button>

                        <SimpleCard className="p-5">
                          {(config.templates || []).length === 0 ? (
                            <div className="py-10 text-center text-zinc-600 text-xs font-black">テンプレートがありません</div>
                          ) : (
                            <div className="divide-y divide-white/5">
                              {(config.templates || []).map((t, idx) => (
                                <button
                                  key={`${t.title}-${idx}`}
                                  type="button"
                                  onClick={() => openEditTemplate(idx)}
                                  className="w-full flex justify-between items-center py-4 active:bg-white/5 transition-colors text-left"
                                >
                                  <div className="min-w-0">
                                    <div className="text-xs font-black text-white truncate">{t.title}</div>
                                    <div className="text-[9px] text-zinc-500 font-black tabular-nums truncate">
                                      ¥{Number(t.amount || 0).toLocaleString()} / {t.category} / {t.method}
                                    </div>
                                  </div>
                                  <ChevronRight size={14} className="text-zinc-400" />
                                </button>
                              ))}
                            </div>
                          )}
                        </SimpleCard>
                      </div>
                    )}

                    {settingTab === 'payment' && (
                      <div className="space-y-3 animate-in slide-in-from-right-2">
                        <button
                          type="button"
                          onClick={openAddPayment}
                          className="w-full h-11 bg-zinc-200 text-black rounded-lg text-[10px] font-black uppercase shadow-lg active:scale-95"
                        >
                          支払方法を追加
                        </button>

                        <SimpleCard className="p-5">
                          <div className="flex flex-wrap gap-2">
                            {(config.paymentMethods || []).map((m, idx) => (
                              <button
                                key={m}
                                type="button"
                                onClick={() => openEditPayment(idx)}
                                className="px-3 py-1.5 bg-white/5 rounded-lg border border-white/10 text-xs text-zinc-300 font-black active:scale-95 transition-all"
                              >
                                {m}
                              </button>
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

        {/* FOOTER */}
        <footer className="flex-none h-24 border-t border-white/5 flex justify-between items-center px-6 pb-6 bg-[#121212]/80 backdrop-blur-xl z-50">
          <NavButton active={activeTab === 'home'} onClick={() => setActiveTab('home')} icon={<Home size={24} />} />
          <NavButton active={activeTab === 'log'} onClick={() => setActiveTab('log')} icon={<History size={24} />} />
          <NavButton active={activeTab === 'analysis'} onClick={() => setActiveTab('analysis')} icon={<BarChart3 size={24} />} />
          <NavButton
            active={activeTab === 'settings'}
            onClick={() => {
              setActiveTab('settings');
              setSettingTab('menu');
            }}
            icon={<Settings size={24} />}
          />

          <button
            type="button"
            onClick={openTxModalNew}
            className="flex items-center justify-center w-14 h-14 bg-white text-black rounded-full shadow-[0_0_20px_rgba(255,255,255,0.2)] active:scale-90 ml-2 transition-transform"
          >
            <Plus size={28} />
          </button>
        </footer>
      </div>

      {/* ✅ TRANSACTION MODAL */}
      {isTxModalOpen && (
        <ModalOverlay onClose={() => setIsTxModalOpen(false)} z={60}>
          {showCalculator ? (
            <div className="flex-1 p-5">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-[10px] font-black uppercase text-white tracking-widest">電卓</h2>
                <button type="button" onClick={() => setShowCalculator(false)} className="text-zinc-400 active:text-white">
                  <X size={18} />
                </button>
              </div>
              <CalculatorPad
                initialValue={inputAmount}
                onConfirm={(val) => {
                  setInputAmount(String(val));
                  setShowCalculator(false);
                }}
              />
              {/* ✅ ボタン下余白 20px */}
              <div className="h-5" />
            </div>
          ) : (
            <>
              <div className="flex-none p-4 border-b border-white/5 flex justify-between items-center">
                <h2 className="text-xs font-black uppercase text-white tracking-widest">{editingTx ? '支出を編集' : '支出を入力'}</h2>
                <button type="button" onClick={() => setIsTxModalOpen(false)} className="p-2 text-zinc-400 active:text-white">
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 pb-8">
                <form onSubmit={handleTxSubmit} className="space-y-6">
                  {/* amount */}
                  <div className="flex gap-2 items-center">
                    <div className="relative flex-1">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 text-lg font-black">¥</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={inputAmount ? Number(toNumber(inputAmount)).toLocaleString() : ''}
                        onChange={(e) => {
                          const v = e.target.value.replace(/,/g, '');
                          if (!Number.isNaN(Number(v))) setInputAmount(v);
                        }}
                        className="w-full h-12 bg-black/20 border border-white/10 rounded-lg text-lg font-black pl-8 pr-4 text-white tabular-nums outline-none"
                        autoFocus
                        required
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowCalculator(true)}
                      className="w-12 h-12 bg-white/10 rounded-lg text-white flex items-center justify-center active:bg-white/20"
                    >
                      <Calculator size={20} />
                    </button>
                  </div>

                  {/* title */}
                  <input
                    type="text"
                    value={inputTitle}
                    onChange={(e) => setInputTitle(e.target.value)}
                    className="w-full h-11 bg-black/20 border border-white/10 rounded-lg px-4 text-sm text-white font-black outline-none"
                    placeholder="タイトル（例：ランチ）"
                    required
                  />

                  {/* ✅ 日付 & カテゴリ：間隔0問題を完全解消 */}
                  <div className="grid grid-cols-2 gap-4 w-full">
                    <div className="flex flex-col">
                      <label className="text-[9px] text-zinc-500 uppercase font-black pl-1 mb-2">日付</label>
                      <input
                        type="date"
                        value={inputDate}
                        onChange={(e) => setInputDate(e.target.value)}
                        className="w-full h-11 bg-black/20 border border-white/10 rounded-lg text-xs px-2 text-white outline-none font-black"
                        required
                      />
                    </div>

                    <div className="flex flex-col">
                      <label className="text-[9px] text-zinc-500 uppercase font-black pl-1 mb-2">カテゴリ</label>
                      <select
                        value={inputCategory}
                        onChange={(e) => setInputCategory(e.target.value)}
                        className="w-full h-11 bg-black/20 border border-white/10 rounded-lg text-xs px-2 text-white outline-none font-black"
                        required
                      >
                        {getCategoryNames().map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* payment method */}
                  <div className="flex flex-wrap gap-2">
                    {paymentMethodsSafe.map((m) => (
                      <label key={m} className="cursor-pointer">
                        <input
                          type="radio"
                          value={m}
                          checked={inputMethod === m}
                          onChange={(e) => setInputMethod(e.target.value)}
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
                            setIsTxModalOpen(false);
                            setEditingTx(null);
                            showToastMsg('削除しました');
                          } catch (err) {
                            console.error(err);
                            showToastMsg('削除に失敗しました');
                          }
                        }}
                        className="w-12 h-12 flex items-center justify-center bg-red-900/20 text-red-300 rounded-lg active:bg-red-900/40"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}

                    <button
                      type="submit"
                      className="flex-1 h-12 bg-white text-black font-black rounded-lg text-xs uppercase tracking-widest active:bg-zinc-200 shadow-xl"
                    >
                      保存する
                    </button>
                  </div>

                  {/* ✅ ボタン下余白 20px */}
                  <div className="h-5" />
                </form>
              </div>
            </>
          )}
        </ModalOverlay>
      )}

      {/* ✅ SETTINGS EDIT MODAL */}
      {editingItem && (
        <ModalOverlay onClose={() => setEditingItem(null)} z={70}>
          <div className="p-4 border-b border-white/5 flex justify-between items-center">
            <h2 className="text-xs font-black uppercase text-white tracking-widest">編集</h2>
            <button type="button" onClick={() => setEditingItem(null)} className="p-2 text-zinc-400 active:text-white">
              <X size={20} />
            </button>
          </div>

          <div className="p-5 pb-8 space-y-6 overflow-y-auto">
            {/* budgetField */}
            {editingItem.type === 'budgetField' && (
              <div className="space-y-2">
                <div className="text-[10px] text-zinc-500 font-black">{editingItem.label}</div>
                <input
                  type="text"
                  inputMode="decimal"
                  value={Number(editingItem.value || 0).toLocaleString()}
                  onChange={(e) => setEditingItem((p) => ({ ...p, value: toNumber(e.target.value) }))}
                  className="w-full h-12 bg-black/20 border border-white/10 rounded-lg px-3 text-sm text-white outline-none tabular-nums font-black"
                />
              </div>
            )}

            {/* cardSchedule */}
            {editingItem.type === 'cardSchedule' && (
              <div className="space-y-4">
                <div className="text-xs font-black text-white">{editingItem.cardName}</div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[9px] text-zinc-500 uppercase font-black pl-1">引き落とし額</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={Number(editingItem.bill || 0).toLocaleString()}
                      onChange={(e) => setEditingItem((p) => ({ ...p, bill: toNumber(e.target.value) }))}
                      className="w-full h-12 bg-black/20 border border-white/10 rounded-lg px-3 text-sm text-white outline-none tabular-nums font-black"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[9px] text-zinc-500 uppercase font-black pl-1">引き落とし日</label>
                    <input
                      type="number"
                      placeholder="日"
                      value={editingItem.dueDay}
                      onChange={(e) => setEditingItem((p) => ({ ...p, dueDay: e.target.value }))}
                      className="w-full h-12 bg-black/20 border border-white/10 rounded-lg px-3 text-sm text-white outline-none font-black tabular-nums"
                    />
                  </div>
                </div>

                <div className="text-[10px] text-zinc-500 font-black">
                  ※ ドットキー保存はしないので、変な「cardDueDates.xxx」みたいなキーは増えません（安心）。
                </div>
              </div>
            )}

            {/* category */}
            {editingItem.type === 'category' && (
              <>
                <div className="flex gap-2">
                  <input
                    value={editingItem.data.icon || ''}
                    onChange={(e) => setEditingItem((p) => ({ ...p, data: { ...p.data, icon: e.target.value } }))}
                    className="w-12 h-12 text-center bg-black/20 border border-white/10 rounded-lg text-xl text-white outline-none"
                  />
                  <input
                    value={editingItem.data.name || ''}
                    onChange={(e) => setEditingItem((p) => ({ ...p, data: { ...p.data, name: e.target.value } }))}
                    className="flex-1 h-12 bg-black/20 border border-white/10 rounded-lg px-3 text-sm text-white outline-none font-black"
                    placeholder="カテゴリ名"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[9px] text-zinc-500 font-black uppercase pl-1">月間予算</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={editingItem.data.budget !== '' ? Number(toNumber(editingItem.data.budget)).toLocaleString() : ''}
                    onChange={(e) => setEditingItem((p) => ({ ...p, data: { ...p.data, budget: e.target.value.replace(/,/g, '') } }))}
                    className="w-full h-12 bg-black/20 border border-white/10 rounded-lg px-3 text-sm text-white outline-none tabular-nums font-black"
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
                  onChange={(e) => setEditingItem((p) => ({ ...p, data: { ...p.data, name: e.target.value } }))}
                  className="w-full h-12 bg-black/20 border border-white/10 rounded-lg px-3 text-sm text-white outline-none font-black"
                  placeholder="固定費名"
                />
                <input
                  type="text"
                  inputMode="decimal"
                  value={editingItem.data.amount !== '' ? Number(toNumber(editingItem.data.amount)).toLocaleString() : ''}
                  onChange={(e) => setEditingItem((p) => ({ ...p, data: { ...p.data, amount: e.target.value.replace(/,/g, '') } }))}
                  className="w-full h-12 bg-black/20 border border-white/10 rounded-lg px-3 text-sm text-white outline-none tabular-nums font-black"
                  placeholder="金額"
                />
                <select
                  value={editingItem.data.method || ''}
                  onChange={(e) => setEditingItem((p) => ({ ...p, data: { ...p.data, method: e.target.value } }))}
                  className="w-full h-12 bg-black/20 border border-white/10 rounded-lg px-3 text-sm text-white outline-none font-black"
                >
                  {paymentMethodsSafe.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </>
            )}

            {/* template */}
            {editingItem.type === 'template' && (
              <>
                <input
                  value={editingItem.data.title || ''}
                  onChange={(e) => setEditingItem((p) => ({ ...p, data: { ...p.data, title: e.target.value } }))}
                  className="w-full h-12 bg-black/20 border border-white/10 rounded-lg px-3 text-sm text-white outline-none font-black"
                  placeholder="テンプレート名"
                />
                <input
                  type="text"
                  inputMode="decimal"
                  value={editingItem.data.amount !== '' ? Number(toNumber(editingItem.data.amount)).toLocaleString() : ''}
                  onChange={(e) => setEditingItem((p) => ({ ...p, data: { ...p.data, amount: e.target.value.replace(/,/g, '') } }))}
                  className="w-full h-12 bg-black/20 border border-white/10 rounded-lg px-3 text-sm text-white outline-none tabular-nums font-black"
                  placeholder="金額"
                />
                <div className="grid grid-cols-2 gap-4">
                  <select
                    value={editingItem.data.category || ''}
                    onChange={(e) => setEditingItem((p) => ({ ...p, data: { ...p.data, category: e.target.value } }))}
                    className="w-full h-12 bg-black/20 border border-white/10 rounded-lg px-2 text-xs text-white outline-none font-black"
                  >
                    {getCategoryNames().map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <select
                    value={editingItem.data.method || ''}
                    onChange={(e) => setEditingItem((p) => ({ ...p, data: { ...p.data, method: e.target.value } }))}
                    className="w-full h-12 bg-black/20 border border-white/10 rounded-lg px-2 text-xs text-white outline-none font-black"
                  >
                    {paymentMethodsSafe.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {/* payment */}
            {editingItem.type === 'payment' && (
              <input
                value={editingItem.data.name || ''}
                onChange={(e) => setEditingItem((p) => ({ ...p, data: { ...p.data, name: e.target.value } }))}
                className="w-full h-12 bg-black/20 border border-white/10 rounded-lg px-3 text-sm text-white outline-none font-black"
                placeholder="支払方法名"
              />
            )}

            <div className="flex gap-2 pt-2">
              {editingItem.index !== -1 && !['budgetField', 'cardSchedule'].includes(editingItem.type) && (
                <button
                  type="button"
                  onClick={handleDeleteItem}
                  className="w-12 h-12 flex items-center justify-center bg-red-900/20 text-red-300 rounded-lg active:bg-red-900/40"
                >
                  <Trash2 size={18} />
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

            {/* ✅ ボタン下余白 20px */}
            <div className="h-5" />
          </div>
        </ModalOverlay>
      )}

      {/* ✅ DEBUG MODAL */}
      {isDebugOpen && (
        <ModalOverlay onClose={() => setIsDebugOpen(false)} z={80}>
          <div className="p-4 border-b border-white/5 flex justify-between items-center">
            <h2 className="text-xs font-black uppercase text-white tracking-widest">デバッグ</h2>
            <button type="button" onClick={() => setIsDebugOpen(false)} className="p-2 text-zinc-400 active:text-white">
              <X size={20} />
            </button>
          </div>

          <div className="p-5 pb-8 space-y-4 overflow-y-auto">
            <div className="text-[10px] text-zinc-500 font-black">
              「今月が12月になる」/「引き落としが保存されない」/「アラートが出ない」系の確認に使ってね。
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={copyDebugToClipboard}
                className="flex-1 h-11 bg-white text-black rounded-lg font-black text-xs uppercase active:bg-zinc-200"
              >
                JSONをコピー
              </button>
              <button
                type="button"
                onClick={() => showToastMsg(`今月: ${month} / 今日: ${getTodayStringLocal()}`)}
                className="w-12 h-11 bg-white/10 rounded-lg text-white flex items-center justify-center active:bg-white/20"
                title="サクッと確認"
              >
                <Calendar size={18} />
              </button>
            </div>

            <pre className="text-[10px] leading-4 bg-black/30 border border-white/10 rounded-lg p-3 text-zinc-200 whitespace-pre-wrap break-words">
{JSON.stringify(debugPayload, null, 2)}
            </pre>

            {/* ✅ ボタン下余白 20px */}
            <div className="h-5" />
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}

/* EXPORT */
export default function AppWrapper() {
  return (
    <ErrorBoundary>
      <AppMain />
    </ErrorBoundary>
  );
}
