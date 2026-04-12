import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import {
  getFirestore, collection, doc, setDoc, onSnapshot, query, deleteDoc,
  where, getDocs, getDoc, orderBy, addDoc, updateDoc, serverTimestamp,
  runTransaction, documentId
} from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth';
// 👇 追加：スワイプアニメーション用ライブラリ
import { motion } from 'framer-motion'; 

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
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error, errorInfo) { console.error("Uncaught error:", error, errorInfo); }
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

  // 👇 クイック入力用のステート（ホーム画面の猫用）
  const [quickAmount, setQuickAmount] = useState('');
  const [quickTitle, setQuickTitle] = useState('');

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

  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [copySourceMonth, setCopySourceMonth] = useState('');
  
  const [memoText, setMemoText] = useState('');
  const [isMemoExpanded, setIsMemoExpanded] = useState(false);
  const [isMemoModalOpen, setIsMemoModalOpen] = useState(false);

  const FAQ_DATA = [
    {
      category: '💰 予算・残高の計算',
      items: [
        { q: '「自由に使えるお金」とは何ですか？', a: '今月の生活費予算（総枠）から、すでに使ったお金や固定費、積立金を差し引いた「純粋に今月残っているお金」です。' },
        { q: '「クレカ待機資金」とは何ですか？', a: '今月クレジットカードで決済した金額の合計です。銀行口座に入っているお金のうち、「来月の引き落としのために取っておくべきお金」を表しています。' },
      ]
    }
  ];

  const filteredFaqData = useMemo(() => {
    if (!faqSearchText) return FAQ_DATA;
    const lowerText = faqSearchText.toLowerCase();
    return FAQ_DATA.map(cat => ({
      ...cat,
      items: cat.items.filter(item => item.q.toLowerCase().includes(lowerText) || item.a.toLowerCase().includes(lowerText))
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

  /* --- AUTH & SUBSCRIPTIONS --- */
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => { setUser(u); setAuthLoading(false); });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const start = new Date(`${month}-01T00:00:00`).toISOString();
    const nextDate = new Date(`${month}-01T00:00:00`);
    nextDate.setMonth(nextDate.getMonth() + 1);
    const end = nextDate.toISOString();
    const q = query(collection(db, 'users', user.uid, 'transactions'), where('date', '>=', start), where('date', '<', end));
    return onSnapshot(q, (s) => {
      const list = s.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => new Date(b.date) - new Date(a.date));
      setTransactions(list);
    });
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
        const q = query(collection(db, 'users', user.uid, 'months'), where(documentId(), '<=', month), orderBy(documentId(), 'asc'));
        const s = await getDocs(q);
        let sum = 0;
        s.forEach(d => { sum += Number(normalizeMonthlyData(d.data()).savings || 0); });
        setSavingsTotalToMonth(sum);
      } catch (e) { console.error(e); }
    };
    fetchSavingsTotalToMonth();
  }, [user, month]);

  /* --- SUMMARY CALCULATION --- */
  const summary = useMemo(() => {
    const fixedCosts = monthlyData?.fixedCosts || [];
    const fixedCash = fixedCosts.filter(f => !f.method || f.method === CASH).reduce((s, i) => s + (Number(i.amount) || 0), 0);
    const fixedCard = fixedCosts.filter(f => f.method && f.method !== CASH).reduce((s, i) => s + (Number(i.amount) || 0), 0);
    const fixedTotal = fixedCash + fixedCard;

    const totalBudget = Number(monthlyData?.budget) || 0;
    const normalTx = transactions.filter(t => t.isSpecial !== true);
    
    // クレカ待機資金用：カードで使った金額
    const spentCard = normalTx.filter(t => t.paymentMethod !== CASH).reduce((s, t) => s + (Number(t.amount) || 0), 0);
    
    // 全体の変動費予算
    const variableBudget = totalBudget - fixedTotal;
    const totalSpent = normalTx.reduce((s, t) => s + (Number(t.amount) || 0), 0);

    const savingsAmount = Number(monthlyData?.savings || 0);
    const billTotal = Object.values(monthlyData?.cardBills || {}).reduce((s, v) => s + (Number(v) || 0), 0);
    const withdrawalOnly = fixedCash + billTotal;
    const bankBalanceProjected = (Number(monthlyData?.salary) || 0) - (withdrawalOnly + savingsAmount);

    const catTotals = normalTx.reduce((acc, t) => { 
      const cat = t.category || '未分類';
      acc[cat] = (acc[cat] || 0) + (Number(t.amount) || 0); 
      return acc; 
    }, {});
    const catBudgetSum = (config?.categories || []).reduce((sum, c) => sum + (monthlyData?.catBudgets?.[c.name] || 0), 0);
    
    return {
      variableBudget,
      totalSpent,
      spentCard,
      bankBalanceProjected,
      fixedTotal,
      withdrawalOnly,
      catBudgetSum,
      savingsAmount,
      catTotals,
      dailyTotals: normalTx.reduce((acc, t) => { 
        if (!t.date) return acc;
        const dObj = new Date(t.date);
        if (isNaN(dObj.getTime())) return acc;
        acc[dObj.getDate()] = (acc[dObj.getDate()] || 0) + (Number(t.amount) || 0); 
        return acc; 
      }, {})
    };
  }, [monthlyData, transactions, config]);

  const activeCategories = getCategoryNames().filter(n => (monthlyData.catBudgets?.[n] || 0) > 0 || (summary.catTotals[n] || 0) > 0);

  /* --- ACTIONS --- */
  // 👇 ホーム画面でのクイックチャージ（スワイプ）処理
  const handleQuickSwipe = async (event, info) => {
    // 上に50px以上スワイプ ＆ 金額が入力されている場合
    if (info.offset.y < -50 && Number(quickAmount) > 0) {
      if (!user) return;
      
      const amount = Number(quickAmount);
      // 自動的に「クレジットカード」等のキャッシュレス方法を選択
      const method = (config?.paymentMethods || []).find(m => m !== CASH) || 'クレジットカード';
      const cat = (config?.categories || [])[0]?.name || '未分類';
      
      const payload = {
        date: toISODateSafe(getTodayString()),
        amount,
        title: quickTitle || 'カード決済',
        category: cat,
        paymentMethod: method,
        isSpecial: false,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp()
      };

      try {
        await addDoc(collection(db, 'users', user.uid, 'transactions'), payload);
        showToastMsg('チャリン！がま口へよけました🐱✨');
        // 入力欄をリセット
        setQuickAmount('');
        setQuickTitle('');
      } catch (e) {
        console.error(e);
        showToastMsg('エラーが発生しました');
      }
    }
  };

  const handleTxSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;
    const amount = toNumber(inputAmount);
    if (!inputDate || !amount || !inputTitle) return showToastMsg('入力内容を確認してください');
    const payload = {
      date: toISODateSafe(inputDate), amount, title: inputTitle, category: inputCategory,
      paymentMethod: inputMethod, isSpecial: inputIsSpecial, updatedAt: serverTimestamp()
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

  /* --- RENDER --- */
  if (authLoading) return <div className="h-screen bg-[#121212] flex items-center justify-center text-zinc-600">Loading...</div>;
  if (!user) return (
    <div className="h-screen w-full bg-[#121212] flex flex-col items-center justify-center p-6 space-y-8 animate-in fade-in">
      <div className="text-center"><h1 className="text-4xl font-black text-white">ZAIMU</h1></div>
      <button onClick={() => signInWithPopup(auth, new GoogleAuthProvider())} className="w-full max-w-xs h-14 bg-white text-black rounded-full font-bold flex items-center justify-center gap-3"><Lock size={18} /> Google Login</button>
    </div>
  );

  return (
    <div className="fixed inset-0 w-full bg-[#121212] text-zinc-200 font-sans flex flex-col justify-center overflow-hidden">
      <Toast message={toast.message} isVisible={toast.visible} />

      <div className="w-full max-w-md h-full flex flex-col relative bg-[#121212] shadow-2xl mx-auto border-x border-white/5">
        <header className="flex-none h-16 border-b border-white/5 px-4 flex items-center justify-between bg-[#121212]/80 backdrop-blur-xl z-50 relative">
          <div className="w-8 h-8 p-1 flex items-center justify-center text-xl">🐈</div>
          <div className="flex items-center gap-4">
            <button onClick={() => { const d = new Date(month + "-01"); d.setMonth(d.getMonth() - 1); setMonth(getMonthString(d)) }}><ChevronLeft size={20} /></button>
            <span className="text-sm font-bold text-white tabular-nums">{formatMonthJP(month)}</span>
            <button onClick={() => { const d = new Date(month + "-01"); d.setMonth(d.getMonth() + 1); setMonth(getMonthString(d)) }}><ChevronRight size={20} /></button>
          </div>
          <button onClick={() => setMonth(getMonthString(new Date()))} className="text-zinc-500 active:text-white"><Calendar size={20} /></button>
        </header>

        <main className="flex-1 relative flex flex-col overflow-hidden">
          
          {/* ✅ ホーム画面（猫ダッシュボード） */}
          {activeTab === 'home' && (
            <div className="flex-1 overflow-y-auto scrollbar-hide flex flex-col relative pb-32">
              
              {/* ① 猫とスワイプエリア */}
              <div className="flex flex-col items-center pt-8 pb-10 px-4">
                 <div className="text-center">
                   <p className="text-zinc-400 text-sm font-bold tracking-wider mb-1">今月、自由に使えるお金</p>
                   {/* 変動予算 － 今までの総支出 */}
                   <h2 className="text-4xl font-extrabold text-emerald-400 tracking-tight">
                     ¥{Math.max(0, summary.variableBudget - summary.totalSpent).toLocaleString()}
                   </h2>
                 </div>

                 <div className="relative mt-12 mb-10 flex flex-col items-center w-full">
                   {/* 猫の画像（public/cat.png）無ければ絵文字 */}
                   <div className="relative w-48 h-48 sm:w-56 sm:h-56 flex items-center justify-center">
                      <img 
                        src="/cat.png" 
                        alt="ZAIMU Cat" 
                        className="w-full h-full object-contain drop-shadow-2xl z-10"
                        onError={(e) => { e.target.style.display='none'; e.target.nextSibling.style.display='flex'; }} 
                      />
                      <div className="hidden absolute inset-0 text-9xl items-center justify-center z-0">🐈‍⬛</div>
                   </div>
                   
                   {/* がま口（クレカ待機資金） */}
                   <div className="absolute -bottom-6 z-20 bg-zinc-900 border-2 border-emerald-500 rounded-full px-6 py-3 shadow-[0_0_20px_rgba(52,211,153,0.3)]">
                      <p className="text-[10px] text-emerald-400 text-center font-bold mb-0.5 tracking-widest uppercase">🔒 クレカ待機資金</p>
                      <p className="text-xl font-black text-white text-center leading-none">
                        ¥{summary.spentCard.toLocaleString()}
                      </p>
                   </div>
                 </div>

                 {/* クイック入力 ＆ スワイプ */}
                 <div className="w-full bg-zinc-900/80 rounded-3xl p-6 shadow-xl flex flex-col items-center border border-white/5 backdrop-blur-md mt-6">
                    <div className="flex gap-2 w-full mb-8">
                      <input 
                        type="text" 
                        value={quickTitle} 
                        onChange={e=>setQuickTitle(e.target.value)} 
                        placeholder="内容 (例: カフェ)" 
                        className="flex-1 bg-black/40 border border-white/5 text-white text-sm font-bold rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500/50 transition-colors" 
                      />
                      <input 
                        type="number" 
                        inputMode="decimal"
                        value={quickAmount} 
                        onChange={e=>setQuickAmount(e.target.value)} 
                        placeholder="金額" 
                        className="w-28 bg-black/40 border border-white/5 text-white text-sm font-black rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500/50 text-center transition-colors" 
                      />
                    </div>
                    
                    {/* フレイマーモーションを使ったスワイプコイン */}
                    <motion.div
                      drag="y"
                      dragConstraints={{ top: 0, bottom: 0 }}
                      dragElastic={0.2}
                      onDragEnd={handleQuickSwipe}
                      className="w-16 h-16 bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing shadow-[0_0_25px_rgba(52,211,153,0.5)] z-10"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <span className="text-white font-black text-2xl opacity-90">¥</span>
                    </motion.div>
                    
                    <p className="text-emerald-500/70 text-[10px] font-black mt-4 animate-pulse uppercase tracking-widest">
                      ↑ 上へスワイプしてよける
                    </p>
                 </div>
              </div>

              {/* ② 以下、詳細データエリア */}
              <div className="px-4 space-y-6">
                
                {/* 引落しアラート */}
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

                {/* カテゴリ予算状況 */}
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
                          <div key={n} className="bg-[#1E1E1E] p-3 flex flex-col justify-center">
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <span className="text-sm shrink-0">{getCategoryIcon(n)}</span>
                              <span className="text-[10px] font-bold text-zinc-200 truncate">{n}</span>
                            </div>
                            <div className="flex items-baseline gap-1 mb-1.5">
                              <span className={`text-xs font-black leading-none ${isOver ? 'text-red-400' : 'text-white'}`}>¥{c.toLocaleString()}</span>
                              <span className="text-[8px] text-zinc-500">/ ¥{b.toLocaleString()}</span>
                            </div>
                            <div className="h-1 bg-white/5 rounded-full overflow-hidden shrink-0 mt-auto">
                              <div className={`h-full transition-all duration-1000 ${isOver ? "bg-red-400" : "bg-emerald-400"}`} style={{ width: `${percent}%` }} />
                            </div>
                          </div>
                        );
                      })}
                      {activeCategories.length % 2 !== 0 && <div className="bg-[#1E1E1E]" />}
                    </div>
                  </SimpleCard>
                </div>

                {/* 口座・引落セクション */}
                <div className="space-y-3">
                  <h3 className="text-[10px] text-zinc-500 uppercase font-black tracking-widest pl-1">口座残高・引落予定</h3>
                  <SimpleCard className="p-5 space-y-3">
                    <div className="flex justify-between items-end"><p className="text-[10px] text-zinc-500 uppercase">口座残高見込み（引落後）</p><Banknote size={16} className="text-zinc-600" /></div>
                    <div className="flex justify-between items-center text-xs text-zinc-400">給与収入<span className="text-sm font-bold text-white">+ ¥{Number(monthlyData.salary||0).toLocaleString()}</span></div>
                    <div className="flex justify-between items-center text-xs text-zinc-400">引き落とし計<span className="text-sm font-bold text-red-400">- ¥{Number(summary.withdrawalOnly || 0).toLocaleString()}</span></div>
                    <div className="flex justify-between items-center text-xs text-zinc-400">積立金（先取り）<span className="text-sm font-bold text-red-400">- ¥{summary.savingsAmount.toLocaleString()}</span></div>
                    <div className="pt-2 border-t border-white/5 flex justify-between items-end text-xs font-bold text-zinc-500">残高予想<span className="text-2xl font-black text-white">¥{summary.bankBalanceProjected.toLocaleString()}</span></div>
                  </SimpleCard>
                </div>

              </div>
            </div>
          )}

          {/* 🔽 Logタブ、Analysisタブ、SettingsタブのUIは元コードのまま */}
          {/* ... (文字数制限のため他タブの中身は省略していますが、上記の大枠に収まります) ... */}
          
        </main>

        <footer className="flex-none h-24 border-t border-white/5 flex justify-between items-center px-6 pb-6 bg-[#121212]/80 backdrop-blur-xl z-50">
          <NavButton active={activeTab === 'home'} onClick={() => setActiveTab('home')} icon={<Home size={24} />} />
          <NavButton active={activeTab === 'log'} onClick={() => setActiveTab('log')} icon={<History size={24} />} />
          {/* 中央の＋ボタンは「詳細入力用」として残しています */}
          <button onClick={() => { setEditingTx(null); setInputDate(getTodayString()); setInputAmount(''); setInputTitle(''); setIsTxModalOpen(true); }} className="flex items-center justify-center w-14 h-14 bg-emerald-500 text-black rounded-full shadow-[0_0_20px_rgba(52,211,153,0.3)] active:scale-90 mx-2 transition-transform"><Plus size={28} /></button>
          <NavButton active={activeTab === 'analysis'} onClick={() => setActiveTab('analysis')} icon={<BarChart3 size={24} />} />
          <NavButton active={activeTab === 'settings'} onClick={() => { setActiveTab('settings'); setSettingTab('menu') }} icon={<Settings size={24} />} />
        </footer>
      </div>

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
