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
  CheckCircle2, BarChart3, TrendingDown, TrendingUp,
  Search, CalendarDays, AlignJustify, Zap,
  Calculator, Delete, LogOut, Lock, User, FileText, Home,
  ChevronDown, HelpCircle, Pencil
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
    memo: d.memo || ''
  };
};

const normalizeConfig = (data) => ({
  categories: data?.categories || [{ name: '食費', icon: '' }],
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
        <div className="h-screen w-full bg-black text-zinc-200 flex flex-col items-center justify-center p-6 gap-4">
          <h1 className="text-lg font-semibold text-red-400">エラーが発生しました</h1>
          <p className="text-xs text-zinc-500 text-center">画面を再読み込みしてください。</p>
          <button onClick={() => window.location.reload()} className="px-6 h-10 bg-[#0A84FF] text-white rounded-2xl font-medium text-sm">
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
    className={`bg-[#1C1C1E] rounded-[16px] border border-white/5 shadow-[0_1px_2px_rgba(0,0,0,0.18)] overflow-hidden w-full box-border ${className}`}
  >
    {children}
  </div>
);

const SectionTitle = ({ children, subText }) => (
  <div className="flex items-end justify-between gap-3 px-1">
    <h3 className="text-[10px] text-[#8E8E93] font-medium">{children}</h3>
    {subText ? <span className="text-[10px] text-[#8E8E93] font-medium">{subText}</span> : null}
  </div>
);

const NavButton = ({ active, onClick, icon }) => (
  <button
    onClick={onClick}
    className={`flex items-center justify-center w-10 h-10 rounded-2xl transition-all duration-200 ${
      active ? 'text-[#0A84FF]' : 'text-[#8E8E93] hover:text-zinc-300'
    }`}
  >
    {icon}
  </button>
);

const Toast = ({ message, isVisible }) => (
  <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-[80] transition-all duration-300 pointer-events-none ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
    <div className="bg-[#2C2C2E]/95 backdrop-blur-xl text-white px-4 py-2 rounded-full border border-white/10 flex items-center gap-2 shadow-[0_8px_24px_rgba(0,0,0,0.28)]">
      <CheckCircle2 size={14} className="text-[#30D158]" />
      <span className="text-[11px] font-medium tracking-wide">{message}</span>
    </div>
  </div>
);

const SettingsRow = ({ left, right, onClick, showChevron = false }) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full flex items-center justify-between px-4 py-3 active:bg-white/[0.03] text-zinc-300 transition-colors"
  >
    <div className="flex items-center gap-3 text-left min-w-0 flex-1 font-medium text-zinc-100">
      {left}
    </div>
    <div className="flex items-center gap-2 shrink-0 ml-3">
      {right ? <div className="text-[11px] text-[#8E8E93] font-medium">{right}</div> : null}
      {showChevron ? <ChevronRight size={17} className="text-[#636366]" /> : null}
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
    } else {
      setDisplay(prev => (prev === '0' && !['+','-','*','/','.'].includes(val)) ? String(val) : prev + val);
      setIsResult(false);
    }
  };
  const btns = [
    { l: 'C', act: () => setDisplay('0'), style: 'text-[#FF453A]' },
    { l: '/', act: () => handlePush('/'), style: 'text-zinc-300' },
    { l: '*', act: () => handlePush('*'), style: 'text-zinc-300' },
    { l: <Delete size={18} />, act: () => setDisplay(prev => prev.length > 1 ? prev.slice(0, -1) : '0'), style: 'text-[#8E8E93]' },
    { l: '7', act: () => handlePush('7') },
    { l: '8', act: () => handlePush('8') },
    { l: '9', act: () => handlePush('9') },
    { l: '-', act: () => handlePush('-'), style: 'text-zinc-300' },
    { l: '4', act: () => handlePush('4') },
    { l: '5', act: () => handlePush('5') },
    { l: '6', act: () => handlePush('6') },
    { l: '+', act: () => handlePush('+'), style: 'text-zinc-300' },
    { l: '1', act: () => handlePush('1') },
    { l: '2', act: () => handlePush('2') },
    { l: '3', act: () => handlePush('3') },
    { l: '=', act: () => { setDisplay(String(safeCalculate(display))); setIsResult(true); }, style: 'bg-[#0A84FF] text-white row-span-2' },
    { l: '0', act: () => handlePush('0'), style: 'col-span-2' },
    { l: '.', act: () => handlePush('.') },
  ];
  return (
    <div className="w-full flex flex-col gap-3">
      <div className="bg-[#1C1C1E] rounded-[16px] p-4 text-right border border-white/5 font-mono text-2xl text-white break-all tabular-nums">
        {display}
      </div>
      <div className="grid grid-cols-4 gap-2.5 h-64">
        {btns.map((b, i) => (
          <button
            key={i}
            type="button"
            onClick={b.act}
            className={`rounded-2xl bg-[#1C1C1E] border border-white/5 text-lg font-medium active:scale-95 transition-all flex items-center justify-center ${b.style || 'text-white'}`}
          >
            {b.l}
          </button>
        ))}
      </div>
      <button type="button" onClick={() => onConfirm(toNumber(display))} className="w-full h-10 bg-[#0A84FF] text-white rounded-2xl font-medium text-sm active:scale-95">
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

  const currentMonthNum = month ? Number(month.split('-')[1]) : new Date().getMonth() + 1;
  const nextMonthNum = currentMonthNum === 12 ? 1 : currentMonthNum + 1;

  const FAQ_DATA = [
    {
      category: '⚙️ 1. 設定タブで入力する金額の使い道',
      items: [
        { q: '手取り給与', a: `家計のベース収入です。ホーム画面の「${currentMonthNum}月の自由な現金」「${nextMonthNum}月の着地予想」の計算の起点になります。` },
        { q: 'クレジットカード利用目安', a: 'カードを使いすぎていないかを見る目安です。ホーム画面の「今月の利用額」のプログレスバーに使われます。' },
        { q: '月初のスタート現金', a: '毎月1日時点で、お財布や口座にある今月使える現金の実数です。ホーム画面の「今の現金残り」の計算元になります。' },
        { q: '今月の積立額', a: '先に避けておくお金です。ホームの各予測値から差し引かれ、積立総額に加算されます。' },
        { q: '引落予定のカード（引落額）', a: `先月使った分のツケとして扱われます。ホーム画面の「${currentMonthNum}月の自由な現金」から差し引かれます。` },
        { q: '固定費管理', a: `現金払いの固定費は「${currentMonthNum}月の自由な現金」から引かれ、全固定費の合計は「${nextMonthNum}月の着地予想」に反映されます。` },
        { q: 'カテゴリ予算', a: 'カテゴリごとの使いすぎ防止枠です。ホームと分析タブの金額比較に使われます。' }
      ]
    },
    {
      category: '🏠 2. ホーム画面の金額の見方',
      items: [
        { q: '今月の利用額', a: '今月の通常支出の合計です。カード利用額と現金利用額の内訳が表示されます。' },
        { q: '今の現金残り', a: '月初のスタート現金から、今月「現金」で使った金額を引いたものです。' },
        { q: `${currentMonthNum}月の自由な現金`, a: `給与から確定支払いを終えた直後に残る、${currentMonthNum}月中に使ってよい現金の総枠です。` },
        { q: `${nextMonthNum}月の着地予想`, a: '今のペースを続けた場合に、来月末時点でどれくらい残りそうかのシミュレーションです。' },
        { q: '積立総額', a: 'ZAIMUを使い始めてから今までの積立合計です。' }
      ]
    },
    {
      category: '💡 その他・操作',
      items: [
        { q: '来月の設定はどうすればいいですか？', a: '月が変わったら、設定タブの下部にある「先月の設定をコピー」を使うと、目安・固定費・積立額などをそのまま引き継げます。' },
        { q: 'データのバックアップはできますか？', a: '設定タブの「全データをCSV出力」から、これまでの全取引データをダウンロードできます。' },
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
    const savingsAmount = Number(monthlyData?.savings) || 0;
    const cashBudget = Number(monthlyData?.cashBudget) || 0;
    const billTotal = Object.values(monthlyData?.cardBills || {}).reduce((s, v) => s + (Number(v) || 0), 0);

    const withdrawalOnly = fixedCash + billTotal;

    const normalTx = transactions.filter(t => t.isSpecial !== true);
    const normalLastTx = (lastMonthTransactions || []).filter(t => t.isSpecial !== true);

    const spentCard = normalTx.filter(t => t.paymentMethod !== CASH).reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const spentCash = normalTx.filter(t => t.paymentMethod === CASH).reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const totalSpent = normalTx.reduce((s, t) => s + (Number(t.amount) || 0), 0);

    const cardTarget = Number(monthlyData?.budget) > 0 ? Number(monthlyData?.budget) : 100000;
    const cardPacePercent = cardTarget > 0 ? Math.min(100, (spentCard / cardTarget) * 100) : 0;

    const currentFreeCash = salary - withdrawalOnly - savingsAmount;
    const cashRemaining = cashBudget - spentCash;
    const projectedCash = salary - spentCard - fixedTotal - savingsAmount;

    const catTotals = normalTx.reduce((acc, t) => {
      const cat = t.category || '未分類';
      acc[cat] = (acc[cat] || 0) + (Number(t.amount) || 0);
      return acc;
    }, {});
    const catBudgetSum = (config?.categories || []).reduce((sum, c) => sum + (monthlyData?.catBudgets?.[c.name] || 0), 0);

    const specialTotalSpent = transactions.filter(t => t.isSpecial === true).reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const lastSpecialTotalSpent = (lastMonthTransactions || []).filter(t => t.isSpecial === true).reduce((s, t) => s + (Number(t.amount) || 0), 0);

    return {
      cardTarget,
      cardPacePercent,
      currentFreeCash,
      cashRemaining,
      projectedCash,
      fixedTotal,
      fixedCash,
      fixedCard,
      withdrawalOnly: withdrawalOnly || 0,
      catBudgetSum,
      savingsAmount,
      catTotals,
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

  const openTxModalNew = () => {
    setEditingTx(null);
    resetTxInputs();
    setIsTxModalOpen(true);
  };

  const openTxModalWithDate = (d) => {
    setEditingTx(null);
    resetTxInputs(d);
    setIsTxModalOpen(true);
  };

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
    } catch (e) {
      console.error(e);
      showToastMsg('エラー');
    }
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
        const item = { name: data.name, icon: '' };
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
      setEditingItem(null);
      showToastMsg('保存しました');
    } catch (e) {
      console.error(e);
      showToastMsg('エラー');
    }
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
    setEditingItem(null);
    showToastMsg('削除しました');
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
          salary: d.salary || 0,
          budget: d.budget || 0,
          cashBudget: d.cashBudget || 0,
          fixedCosts: d.fixedCosts || [],
          catBudgets: d.catBudgets || {},
          cardBills: d.cardBills || {},
          cardDueDates: d.cardDueDates || {},
          savings: d.savings || 0
        }, { merge: true });
        showToastMsg('コピーしました');
        setIsCopyModalOpen(false);
      } else {
        showToastMsg('データがありません');
      }
    } catch (e) {
      showToastMsg('エラー');
    }
  };

  const handleExportCSV = async () => {
    if (!window.confirm('CSV出力しますか？')) return;
    const q = query(collection(db, 'users', user.uid, 'transactions'), orderBy('date', 'desc'));
    const s = await getDocs(q);
    let csv = "\uFEFF日付,タイトル,カテゴリ,金額,支払方法\n";
    s.forEach(d => {
      const v = d.data();
      csv += `${isoToLocalYMD(v.date)},"${v.title}",${v.category},${v.amount},${v.paymentMethod}\n`;
    });
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `zaimu_${getTodayString()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  /* --- RENDER --- */
  if (authLoading) return <div className="h-screen bg-black flex items-center justify-center text-[#8E8E93] font-medium">Loading...</div>;

  if (!user) return (
    <div className="h-screen w-full bg-black flex flex-col items-center justify-center p-6 space-y-8 animate-in fade-in">
      <div className="text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-white">ZAIMU</h1>
      </div>
      <button
        onClick={() => signInWithPopup(auth, new GoogleAuthProvider())}
        className="w-full max-w-xs h-10 bg-[#0A84FF] text-white rounded-2xl font-medium flex items-center justify-center gap-3 active:scale-[0.98] transition-transform"
      >
        <Lock size={16} /> Google Login
      </button>
    </div>
  );

  const SETTING_MENU_ITEMS = [
    { id: 'budget', label: '資金計画・引落日', icon: <Landmark size={18} /> },
    { id: 'fixed', label: '固定費管理', icon: <CreditCard size={18} /> },
    { id: 'category', label: 'カテゴリ予算', icon: <Tags size={18} /> },
    { id: 'template', label: 'テンプレート', icon: <Zap size={18} /> },
    { id: 'payment', label: '支払方法', icon: <Wallet size={18} /> },
    { id: 'faq', label: 'お金の設計図・FAQ', icon: <HelpCircle size={18} /> },
  ];
  const currentSettingTitle = SETTING_MENU_ITEMS.find(item => item.id === settingTab)?.label || '設定';

  return (
    <div className="fixed inset-0 w-full bg-black text-zinc-200 font-sans flex flex-col justify-center overflow-hidden">
      <Toast message={toast.message} isVisible={toast.visible} />

      <div className="w-full max-w-md h-full flex flex-col relative bg-black mx-auto">
        <header className="flex-none h-14 border-b border-white/5 px-4 flex items-center justify-between bg-black/85 backdrop-blur-xl z-50 relative">
          {activeTab === 'settings' && settingTab !== 'menu' ? (
            <>
              <button onClick={() => setSettingTab('menu')} className="text-[#8E8E93] p-2 rounded-xl hover:bg-white/[0.04] transition-colors">
                <ArrowLeft size={19} />
              </button>
              <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center">
                <span className="text-sm font-medium text-white">{currentSettingTitle}</span>
                {(settingTab === 'fixed' || settingTab === 'category') && (
                  <span className="text-[10px] text-[#8E8E93]">計 ¥{(settingTab === 'fixed' ? summary.fixedTotal : summary.catBudgetSum).toLocaleString()}</span>
                )}
              </div>
              <div className="w-10" />
            </>
          ) : (
            <>
              <div className="w-8" />
              <div className="flex items-center gap-1">
                <button onClick={() => { const d = new Date(month + "-01"); d.setMonth(d.getMonth() - 1); setMonth(getMonthString(d)); }} className="p-2 text-[#8E8E93] hover:text-white rounded-full transition-colors">
                  <ChevronLeft size={16} />
                </button>
                <span className="text-sm font-medium text-white tabular-nums min-w-[100px] text-center">{formatMonthJP(month)}</span>
                <button onClick={() => { const d = new Date(month + "-01"); d.setMonth(d.getMonth() + 1); setMonth(getMonthString(d)); }} className="p-2 text-[#8E8E93] hover:text-white rounded-full transition-colors">
                  <ChevronRight size={16} />
                </button>
              </div>
              <button onClick={() => setMonth(getMonthString(new Date()))} className="p-2 text-[#8E8E93] hover:text-white rounded-xl transition-colors">
                <Calendar size={17} />
              </button>
            </>
          )}
        </header>

        <main className="flex-1 relative flex flex-col overflow-hidden">
          {activeTab === 'home' && (
            <div className="flex-1 overflow-y-auto scrollbar-hide flex flex-col relative pb-28">
              {monthlyData.memo && (
                <div
                  onClick={() => setIsMemoExpanded(!isMemoExpanded)}
                  className="sticky top-0 bg-[#111113]/95 backdrop-blur-xl border-b border-white/5 px-4 py-2.5 flex flex-col cursor-pointer transition-all duration-300 z-30"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-sm mt-0.5">📌</span>
                    <div className={`flex-1 text-[12px] text-zinc-300 font-medium leading-relaxed transition-all duration-300 ${isMemoExpanded ? 'whitespace-pre-wrap break-all' : 'truncate block'}`}>
                      {monthlyData.memo}
                    </div>
                    <ChevronDown size={14} className={`text-[#8E8E93] shrink-0 transition-transform mt-0.5 ${isMemoExpanded ? 'rotate-180' : ''}`} />
                  </div>
                </div>
              )}

              <div className="px-4 space-y-4 pt-4 animate-in fade-in duration-300">
                <div className="space-y-2.5">
                  <SectionTitle>今月</SectionTitle>
                  <SimpleCard className="p-0 overflow-hidden">
                    <div className="p-4">
                      <div className="flex items-end justify-between gap-4">
                        <div>
                          <p className="text-[10px] text-[#8E8E93] font-medium mb-1">利用額</p>
                          <h2 className="text-[29px] leading-none font-semibold tracking-tight text-white">
                            ¥{summary.totalSpent.toLocaleString()}
                          </h2>
                        </div>
                      </div>

                      <div className="mt-3 space-y-2">
                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-1000 ${summary.spentCard > summary.cardTarget ? 'bg-[#FF453A]' : 'bg-white'}`}
                            style={{ width: `${summary.cardPacePercent}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-[#8E8E93]">
                          <span>カード ¥{summary.spentCard.toLocaleString()} / ¥{summary.cardTarget.toLocaleString()}</span>
                          <span>現金 ¥{summary.spentCash.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    <div className="divide-y divide-white/5">
                      <div className="px-4 py-3 flex items-center justify-between gap-4">
                        <p className="text-[13px] text-zinc-300">今の現金残り</p>
                        <div className={`text-[15px] leading-none font-semibold tabular-nums ${summary.cashRemaining < 0 ? 'text-[#FF453A]' : 'text-white'}`}>
                          ¥{summary.cashRemaining.toLocaleString()}
                        </div>
                      </div>

                      <div className="px-4 py-3 flex items-center justify-between gap-4">
                        <p className="text-[13px] text-zinc-300">{currentMonthNum}月の自由な現金</p>
                        <div className="text-[15px] leading-none font-semibold tabular-nums text-white">
                          ¥{summary.currentFreeCash.toLocaleString()}
                        </div>
                      </div>

                      <div className="px-4 py-3 flex items-center justify-between gap-4">
                        <p className="text-[13px] text-zinc-300">{nextMonthNum}月の着地予想</p>
                        <div className="text-[15px] leading-none font-semibold tabular-nums text-white">
                          ¥{summary.projectedCash.toLocaleString()}
                        </div>
                      </div>

                      <div className="px-4 py-3 flex items-center justify-between gap-4">
                        <p className="text-[13px] text-zinc-300">積立総額</p>
                        <div className="text-right">
                          <div className="text-[15px] leading-none font-semibold tabular-nums text-white">
                            ¥{Number(savingsTotalToMonth || 0).toLocaleString()}
                          </div>
                          <div className="text-[10px] text-[#8E8E93] mt-1">今月 +¥{summary.savingsAmount.toLocaleString()}</div>
                        </div>
                      </div>
                    </div>
                  </SimpleCard>
                </div>

                {activeCategories.length > 0 && (
                  <div className="space-y-2.5">
                    <SectionTitle>カテゴリ予算</SectionTitle>
                    <SimpleCard className="divide-y divide-white/5 p-0">
                      {activeCategories.map((n) => {
                        const current = summary.catTotals[n] || 0;
                        const budget = monthlyData.catBudgets?.[n] || 0;
                        const isOver = budget > 0 && current > budget;
                        const percent = budget > 0 ? Math.min(100, (current / budget) * 100) : 0;

                        return (
                          <div key={n} className="px-4 py-3">
                            <div className="flex items-center justify-between gap-3 mb-2">
                              <span className="text-[13px] font-medium text-white truncate">{n}</span>
                              <div className={`text-[12px] font-semibold tabular-nums whitespace-nowrap ${isOver ? 'text-[#FF453A]' : 'text-white'}`}>
                                ¥{current.toLocaleString()} / ¥{budget.toLocaleString()}
                              </div>
                            </div>
                            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                              <div className={`h-full transition-all duration-1000 ${isOver ? 'bg-[#FF453A]' : 'bg-white'}`} style={{ width: `${percent}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </SimpleCard>
                  </div>
                )}

                {activeAlerts.length > 0 && (
                  <div className="space-y-2.5">
                    <SectionTitle>引落予定</SectionTitle>
                    <SimpleCard className="p-4">
                      <div className="space-y-2">
                        {activeAlerts.map(([card, day]) => (
                          <div key={card} className="flex justify-between items-center bg-black/15 p-3 rounded-2xl border border-white/5">
                            <span className="text-[13px] font-medium text-white">{card} ({day}日)</span>
                            <button onClick={() => confirmPayment(card)} className="text-[11px] px-3.5 h-8 bg-[#0A84FF] text-white rounded-full font-medium active:scale-95 transition-transform">
                              完了
                            </button>
                          </div>
                        ))}
                      </div>
                    </SimpleCard>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'log' && (
            <div className="flex-1 flex flex-col h-full pt-2 overflow-hidden animate-in fade-in">
              <div className="flex-none px-4 pb-2 z-10 space-y-2.5">
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={searchText}
                      onChange={e => setSearchText(e.target.value)}
                      placeholder="検索..."
                      className="w-full h-9 bg-[#1C1C1E] border border-white/5 rounded-xl pl-9 pr-3 text-[12px] font-medium text-white outline-none focus:border-[#0A84FF]/40 transition-colors"
                    />
                    <Search size={14} className="absolute left-3 top-[11px] text-[#8E8E93]" />
                  </div>
                  <div className="flex bg-[#1C1C1E] rounded-xl border border-white/5 p-1">
                    <button onClick={() => setLogView('list')} className={`w-8 h-8 rounded-lg transition-colors flex items-center justify-center ${logView === 'list' ? 'bg-[#0A84FF] text-white' : 'text-[#8E8E93] hover:text-white'}`}>
                      <AlignJustify size={15} />
                    </button>
                    <button onClick={() => setLogView('calendar')} className={`w-8 h-8 rounded-lg transition-colors flex items-center justify-center ${logView === 'calendar' ? 'bg-[#0A84FF] text-white' : 'text-[#8E8E93] hover:text-white'}`}>
                      <CalendarDays size={15} />
                    </button>
                  </div>
                </div>

                <div className="flex gap-2 items-center">
                  <div className="relative flex-[1] min-w-0">
                    <select value={filter.category} onChange={e => setFilter({ ...filter, category: e.target.value })} className="w-full h-9 bg-[#1C1C1E] border border-white/5 rounded-xl pl-3 pr-7 text-[11px] font-medium text-white outline-none appearance-none focus:border-[#0A84FF]/40 transition-colors">
                      <option value="ALL">すべて</option>
                      {getCategoryNames().map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <ChevronDown size={13} className="absolute right-2.5 top-[12px] text-[#8E8E93] pointer-events-none" />
                  </div>
                  <div className="relative flex-[1] min-w-0">
                    <select value={filter.method} onChange={e => setFilter({ ...filter, method: e.target.value })} className="w-full h-9 bg-[#1C1C1E] border border-white/5 rounded-xl pl-3 pr-7 text-[11px] font-medium text-white outline-none appearance-none focus:border-[#0A84FF]/40 transition-colors">
                      <option value="ALL">すべて</option>
                      {(config?.paymentMethods || []).map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <ChevronDown size={13} className="absolute right-2.5 top-[12px] text-[#8E8E93] pointer-events-none" />
                  </div>
                  <button type="button" onClick={() => setFilter(prev => ({ ...prev, special: !prev.special }))} className={`h-9 px-3 rounded-xl border text-[11px] font-medium shrink-0 transition-colors ${filter.special ? 'bg-[#0A84FF] text-white border-[#0A84FF]' : 'bg-[#1C1C1E] text-[#8E8E93] border-white/5'}`}>
                    特別費
                  </button>
                  <button type="button" onClick={clearLogFilters} className="w-9 h-9 bg-[#1C1C1E] border border-white/5 rounded-xl flex items-center justify-center hover:bg-white/[0.07] transition-colors shrink-0">
                    <X size={15} className="text-[#8E8E93]" />
                  </button>
                </div>

                <div className="flex justify-between items-center px-1 text-[10px] text-[#8E8E93] font-medium">
                  <span>表示中の合計</span>
                  <div className="flex gap-3">
                    <span>現金: ¥{filteredCashTotal.toLocaleString()}</span>
                    <span>カード: ¥{filteredCardTotal.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="flex-1 px-4 pb-20 overflow-hidden flex flex-col">
                {logView === 'list' ? (
                  <SimpleCard className="flex-1 flex flex-col overflow-hidden p-0">
                    {finalFilteredTx.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-[#8E8E93]">
                        <p className="text-sm font-medium">No Records</p>
                      </div>
                    ) : (
                      <div className="flex-1 overflow-y-auto divide-y divide-white/5 scrollbar-hide">
                        {finalFilteredTx.map(t => (
                          <div key={t.id} onClick={() => setViewingTx(t)} className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/[0.03] active:bg-white/[0.05] transition-colors group">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className="flex flex-col items-center justify-center w-10 h-10 rounded-2xl bg-[#2C2C2E] border border-white/5 group-hover:border-white/10 transition-colors">
                                <span className="text-[9px] font-medium text-[#8E8E93] leading-none">{formatDateShort(t.date).split('/')[0]}</span>
                                <span className="text-[12px] font-semibold text-zinc-300 leading-none mt-0.5">{formatDateShort(t.date).split('/')[1]}</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="truncate text-[14px] font-medium text-white mb-1">{t.title}</div>
                                <div className="flex items-center gap-2">
                                  <div className="text-[10px] px-2 py-1 rounded-lg font-medium truncate bg-white/[0.06] text-[#8E8E93]">
                                    {t.category}
                                  </div>
                                  {t.isSpecial === true && (
                                    <>
                                      <span className="text-[10px] font-medium text-[#636366]">•</span>
                                      <span className="text-[10px] font-medium text-white">特別費</span>
                                    </>
                                  )}
                                  <span className="text-[10px] font-medium text-[#636366]">•</span>
                                  <span className="text-[10px] font-medium text-[#8E8E93]">{t.paymentMethod}</span>
                                </div>
                              </div>
                            </div>
                            <span className="text-[14px] font-semibold tabular-nums text-white pl-3">¥{Number(t.amount || 0).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </SimpleCard>
                ) : (
                  <SimpleCard className="flex-1 flex flex-col overflow-hidden p-4">
                    <div className="flex-none grid grid-cols-7 gap-1 text-center mb-2 text-[10px] text-[#8E8E93] font-medium">
                      {['日', '月', '火', '水', '木', '金', '土'].map(d => <div key={d}>{d}</div>)}
                    </div>
                    <div className="flex-1 overflow-y-auto scrollbar-hide">
                      <div className="grid grid-cols-7 gap-y-2 gap-x-1 pb-2">
                        {calendarDaysList.map((day, i) => {
                          if (!day) return <div key={i} className="min-h-[52px]" />;
                          const a = summary.dailyTotals[day] || 0;
                          const isT = day === new Date().getDate() && month === getMonthString(new Date());
                          return (
                            <button
                              key={i}
                              type="button"
                              onClick={() => openTxModalWithDate(`${month}-${String(day).padStart(2, '0')}`)}
                              className="min-h-[52px] rounded-xl px-1 py-1 hover:bg-white/[0.04] active:bg-white/[0.06] transition-colors flex flex-col items-center justify-start"
                            >
                              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-medium ${isT ? 'bg-[#0A84FF] text-white' : 'text-zinc-300'}`}>
                                {day}
                              </span>
                              <span className="text-[9px] text-[#8E8E93] mt-1 tabular-nums leading-none">
                                {a > 0 ? `¥${(a / 1000).toFixed(0)}k` : ''}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </SimpleCard>
                )}
              </div>
            </div>
          )}

          {activeTab === 'analysis' && (
            <div className="flex-1 overflow-y-auto scrollbar-hide px-4 pt-4 pb-28 space-y-5 animate-in fade-in">
              <SimpleCard className="p-0 overflow-hidden">
                <div className="p-4 flex flex-col gap-5">
                  <div className="flex justify-between items-start gap-3">
                    <div>
                      <p className="text-[10px] text-[#8E8E93] font-medium mb-1.5">総支出</p>
                      <h3 className="text-[30px] leading-none font-semibold text-white tracking-tight">¥{summary.totalSpent.toLocaleString()}</h3>
                    </div>
                    <div className={`flex items-center gap-1 px-3 py-2 rounded-2xl border text-[10px] font-medium whitespace-nowrap ${summary.totalSpent <= summary.lastTotalSpent ? 'bg-[#30D158]/10 text-[#30D158] border-[#30D158]/10' : 'bg-[#FF453A]/10 text-[#FF453A] border-[#FF453A]/10'}`}>
                      {summary.totalSpent <= summary.lastTotalSpent ? <TrendingDown size={13} /> : <TrendingUp size={13} />}
                      先月比 {summary.totalSpent <= summary.lastTotalSpent ? '-' : '+'}¥{Math.abs(summary.totalSpent - summary.lastTotalSpent).toLocaleString()}
                    </div>
                  </div>

                  {donutChartData.total > 0 ? (
                    <div className="space-y-4">
                      <div className="flex w-full h-3 rounded-full overflow-hidden gap-[2px]">
                        {donutChartData.items.map(item => (
                          <div key={item.name} className="h-full transition-all duration-1000" style={{ width: `${(item.amount / donutChartData.total) * 100}%`, backgroundColor: item.color }} />
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                        {donutChartData.items.map(item => (
                          <div key={item.name} className="flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                            <span className="text-[11px] text-zinc-300 font-medium truncate flex-1">{item.name}</span>
                            <span className="text-[11px] font-semibold text-white tabular-nums">¥{item.amount.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-sm text-[#8E8E93] font-medium">No Data Available</div>
                  )}
                </div>
              </SimpleCard>

              <SimpleCard className="p-0 overflow-hidden">
                <div className="divide-y divide-white/5">
                  <div className="px-4 py-3 flex items-center justify-between">
                    <span className="text-[13px] text-zinc-300">カード支出</span>
                    <span className="text-[13px] font-semibold text-white tabular-nums">¥{summary.spentCard.toLocaleString()}</span>
                  </div>
                  <div className="px-4 py-3 flex items-center justify-between">
                    <span className="text-[13px] text-zinc-300">現金支出</span>
                    <span className="text-[13px] font-semibold text-white tabular-nums">¥{summary.spentCash.toLocaleString()}</span>
                  </div>
                  <div className="px-4 py-3 flex items-center justify-between">
                    <span className="text-[13px] text-zinc-300">固定費合計</span>
                    <span className="text-[13px] font-semibold text-white tabular-nums">¥{summary.fixedTotal.toLocaleString()}</span>
                  </div>
                  <div className="px-4 py-3 flex items-center justify-between">
                    <span className="text-[13px] text-zinc-300">積立額</span>
                    <span className="text-[13px] font-semibold text-white tabular-nums">¥{summary.savingsAmount.toLocaleString()}</span>
                  </div>
                </div>
              </SimpleCard>

              {summary.specialTotalSpent > 0 && (
                <SimpleCard className="p-4">
                  <p className="text-[10px] text-[#8E8E93] font-medium mb-2">特別費（別枠）</p>
                  <div className="flex items-end gap-3">
                    <span className="text-xl font-semibold text-white tabular-nums">¥{summary.specialTotalSpent.toLocaleString()}</span>
                    <span className="text-[10px] text-[#8E8E93] font-medium mb-1">/ 先月 ¥{summary.lastSpecialTotalSpent.toLocaleString()}</span>
                  </div>
                </SimpleCard>
              )}
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="flex-1 overflow-y-auto scrollbar-hide px-4 pt-4 pb-28 animate-in fade-in">
              {settingTab === 'menu' ? (
                <div className="space-y-6 pb-8">
                  <div className="flex items-center justify-between p-4 bg-[#1C1C1E] border border-white/5 rounded-[18px]">
                    <div className="flex items-center gap-3.5 min-w-0">
                      {user.photoURL ? (
                        <img src={user.photoURL} referrerPolicy="no-referrer" alt="icon" className="w-11 h-11 rounded-2xl border border-white/5" />
                      ) : (
                        <div className="w-11 h-11 rounded-2xl bg-[#2C2C2E] border border-white/5 flex items-center justify-center">
                          <User size={18} className="text-[#8E8E93]" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="text-[13px] font-medium text-white truncate">{user.displayName || 'User'}</div>
                        <div className="text-[10px] font-medium text-[#8E8E93] truncate mt-0.5">{user.email}</div>
                      </div>
                    </div>
                    <button onClick={() => { if (window.confirm('Logout?')) signOut(auth); }} className="w-10 h-10 bg-[#FF453A]/10 text-[#FF453A] rounded-xl flex items-center justify-center hover:bg-[#FF453A]/20 transition-colors shrink-0">
                      <LogOut size={15} />
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    <SectionTitle>Preferences</SectionTitle>
                    <SimpleCard className="divide-y divide-white/5 p-0">
                      {SETTING_MENU_ITEMS.map(item => (
                        <SettingsRow
                          key={item.id}
                          onClick={() => setSettingTab(item.id)}
                          left={<div className="flex items-center gap-4 text-zinc-300"><span>{item.icon}</span><span className="text-[13px] font-medium text-white">{item.label}</span></div>}
                          showChevron={true}
                        />
                      ))}
                    </SimpleCard>
                  </div>

                  <div className="flex flex-col items-center gap-4 pt-2">
                    <button onClick={openCopySettingsModal} className="w-full h-10 bg-[#2C2C2E] border border-white/5 text-white rounded-2xl text-[13px] font-medium hover:bg-white/[0.07] transition-all flex items-center justify-center gap-2">
                      <CopyCheck size={15} /> 先月の設定をコピー
                    </button>
                    <button onClick={handleExportCSV} className="text-[#0A84FF] hover:text-[#64D2FF] text-[10px] font-medium flex items-center gap-2 transition-colors">
                      <FileText size={13} /> Export CSV Data
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  {settingTab === 'faq' && (
                    <div className="space-y-5 animate-in slide-in-from-right-2">
                      <div className="relative">
                        <input type="text" value={faqSearchText} onChange={(e) => setFaqSearchText(e.target.value)} placeholder="キーワードで検索..." className="w-full h-10 bg-[#1C1C1E] border border-white/5 rounded-2xl pl-10 pr-4 text-[12px] font-medium text-white outline-none focus:border-[#0A84FF]/40 transition-colors" />
                        <Search size={15} className="absolute left-4 top-[12px] text-[#8E8E93]" />
                        {faqSearchText && <button onClick={() => setFaqSearchText('')} className="absolute right-4 top-[12px] text-[#8E8E93] hover:text-white transition-colors"><X size={15} /></button>}
                      </div>
                      <div className="space-y-5">
                        {filteredFaqData.length > 0 ? (
                          filteredFaqData.map((section, sIdx) => (
                            <div key={sIdx} className="space-y-2.5">
                              <SectionTitle>{section.category}</SectionTitle>
                              <SimpleCard className="divide-y divide-white/5 p-0">
                                {section.items.map((item, idx) => (
                                  <div key={idx} className="p-4 cursor-pointer hover:bg-white/[0.03] transition-colors" onClick={() => setExpandedFaq(expandedFaq === `${sIdx}-${idx}` ? null : `${sIdx}-${idx}`)}>
                                    <div className="flex justify-between items-start gap-4">
                                      <div className="flex items-start gap-3">
                                        <HelpCircle size={17} className="text-[#636366] mt-0.5 shrink-0" />
                                        <span className="text-[12px] font-medium text-white leading-snug">{item.q}</span>
                                      </div>
                                      <ChevronDown size={16} className={`text-[#636366] transition-transform shrink-0 ${expandedFaq === `${sIdx}-${idx}` ? 'rotate-180' : ''}`} />
                                    </div>
                                    {expandedFaq === `${sIdx}-${idx}` && <div className="mt-4 pt-4 border-t border-white/5 pl-7 text-[11px] font-medium text-zinc-400 leading-relaxed whitespace-pre-wrap">{item.a}</div>}
                                  </div>
                                ))}
                              </SimpleCard>
                            </div>
                          ))
                        ) : <div className="text-center py-10 text-[#8E8E93] text-sm font-medium">No Results Found</div>}
                      </div>
                    </div>
                  )}

                  {settingTab === 'budget' && (
                    <div className="space-y-5 animate-in slide-in-from-right-2">
                      <div className="space-y-2.5">
                        <SectionTitle>資金計画</SectionTitle>
                        <SimpleCard className="divide-y divide-white/5 p-0">
                          <SettingsRow onClick={() => openEdit('salary', { value: monthlyData.salary }, 0)} left="手取り給与" right={`¥${Number(monthlyData.salary || 0).toLocaleString()}`} />
                          <SettingsRow onClick={() => openEdit('totalBudget', { value: monthlyData.budget }, 0)} left="クレジットカード利用目安" right={`¥${Number(monthlyData.budget || 0).toLocaleString()}`} />
                          <SettingsRow onClick={() => openEdit('cashBudget', { value: monthlyData.cashBudget }, 0)} left="月初のスタート現金" right={`¥${Number(monthlyData.cashBudget || 0).toLocaleString()}`} />
                          <SettingsRow onClick={() => openEdit('savings', { value: monthlyData.savings }, 0)} left="今月の積立額" right={`¥${Number(monthlyData.savings || 0).toLocaleString()}`} />
                          <SettingsRow onClick={() => openEdit('memo', { memo: monthlyData.memo }, 0)} left="今月のメモ" right={<span className="truncate max-w-[100px]">{monthlyData.memo ? '設定済み' : '未設定'}</span>} />
                        </SimpleCard>
                      </div>
                      <div className="space-y-2.5">
                        <SectionTitle>引落予定のカード</SectionTitle>
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

                  {settingTab === 'fixed' && (
                    <div className="space-y-3 animate-in slide-in-from-right-2">
                      <SectionTitle subText={`現金合計 ¥${summary.fixedCash.toLocaleString()} / カード合計 ¥${summary.fixedCard.toLocaleString()}`}>固定費</SectionTitle>
                      <button type="button" onClick={() => openEdit('fixed', { name: '', amount: '', method: CASH }, -1)} className="w-full h-10 bg-[#0A84FF] text-white rounded-2xl text-[13px] font-medium flex items-center justify-center gap-2 active:scale-[0.98] transition-all">
                        <Plus size={15} /> 固定費を追加
                      </button>
                      <SimpleCard className="divide-y divide-white/5 p-0">
                        {(monthlyData.fixedCosts || []).map((f, idx) => (
                          <SettingsRow key={f.id || idx} onClick={() => openEdit('fixed', f, idx)} left={<div className="flex items-center gap-3 min-w-0"><span className="text-[10px] px-2 py-1 rounded-lg bg-[#2C2C2E] text-white font-medium shrink-0">{f.method || '未設定'}</span><span className="text-[13px] font-medium text-white truncate">{f.name}</span></div>} right={`¥${Number(f.amount || 0).toLocaleString()}`} />
                        ))}
                      </SimpleCard>
                    </div>
                  )}

                  {settingTab === 'category' && (
                    <div className="space-y-3 animate-in slide-in-from-right-2">
                      <button type="button" onClick={() => openEdit('category', { name: '', budget: '' }, -1)} className="w-full h-10 bg-[#0A84FF] text-white rounded-2xl text-[13px] font-medium flex items-center justify-center gap-2 active:scale-[0.98] transition-all">
                        <Plus size={15} /> カテゴリを追加
                      </button>
                      <SimpleCard className="divide-y divide-white/5 p-0">
                        {(config?.categories || []).map((c, idx) => {
                          const b = monthlyData.catBudgets?.[c.name] || 0;
                          return (
                            <SettingsRow
                              key={c.name}
                              onClick={() => openEdit('category', { name: c.name, budget: b }, idx)}
                              left={<span className="text-[13px] font-medium text-white">{c.name}</span>}
                              right={`¥${Number(b).toLocaleString()}`}
                            />
                          );
                        })}
                      </SimpleCard>
                    </div>
                  )}

                  {settingTab === 'template' && (
                    <div className="space-y-3 animate-in slide-in-from-right-2">
                      <button type="button" onClick={() => openEdit('template', { title: '', amount: '', category: getCategoryNames()[0] || '食費', method: config?.paymentMethods?.[0] || '現金' }, -1)} className="w-full h-10 bg-[#0A84FF] text-white rounded-2xl text-[13px] font-medium flex items-center justify-center gap-2 active:scale-[0.98] transition-all">
                        <Plus size={15} /> テンプレートを追加
                      </button>
                      <SimpleCard className="divide-y divide-white/5 p-0">
                        {(config?.templates || []).map((t, idx) => (
                          <SettingsRow key={idx} onClick={() => openEdit('template', t, idx)} left={<div className="flex flex-col items-start gap-1 min-w-0"><span className="text-[13px] font-medium text-white truncate">{t.title}</span><span className="text-[10px] font-medium text-[#8E8E93]">{t.category} • {t.method}</span></div>} right={`¥${Number(t.amount || 0).toLocaleString()}`} />
                        ))}
                      </SimpleCard>
                    </div>
                  )}

                  {settingTab === 'payment' && (
                    <div className="space-y-3 animate-in slide-in-from-right-2">
                      <button type="button" onClick={() => openEdit('payment', { name: '' }, -1)} className="w-full h-10 bg-[#0A84FF] text-white rounded-2xl text-[13px] font-medium flex items-center justify-center gap-2 active:scale-[0.98] transition-all">
                        <Plus size={15} /> 支払方法を追加
                      </button>
                      <SimpleCard className="divide-y divide-white/5 p-0">
                        {(config?.paymentMethods || []).map((m, idx) => (
                          <SettingsRow key={m} onClick={() => openEdit('payment', { name: m }, idx)} left={<span className="text-[13px] font-medium text-white">{m}</span>} right={null} />
                        ))}
                      </SimpleCard>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </main>

        <footer className="fixed bottom-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-2xl border-t border-white/5 h-20 flex items-center justify-around px-5 pb-4 pt-2">
          <NavButton active={activeTab === 'home'} onClick={() => setActiveTab('home')} icon={<Home size={20} />} />
          <NavButton active={activeTab === 'log'} onClick={() => setActiveTab('log')} icon={<History size={20} />} />
          <button onClick={openTxModalNew} className="w-11 h-11 bg-[#0A84FF] text-white rounded-[15px] flex items-center justify-center active:scale-90 transition-transform shadow-[0_4px_12px_rgba(10,132,255,0.18)]">
            <Plus size={22} />
          </button>
          <NavButton active={activeTab === 'analysis'} onClick={() => setActiveTab('analysis')} icon={<BarChart3 size={20} />} />
          <NavButton active={activeTab === 'settings'} onClick={() => { setActiveTab('settings'); setSettingTab('menu'); }} icon={<Settings size={20} />} />
        </footer>
      </div>

      {/* MODALS */}
      {viewingTx && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200" onClick={() => setViewingTx(null)}>
          <div className="w-full sm:max-w-md bg-[#1C1C1E] rounded-t-[22px] sm:rounded-[22px] border border-white/5 shadow-[0_20px_60px_rgba(0,0,0,0.4)] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex-none p-4 border-b border-white/5 flex justify-between items-center">
              <h2 className="text-sm font-medium text-white">支出の詳細</h2>
              <button type="button" onClick={() => setViewingTx(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-[#2C2C2E] text-[#8E8E93] hover:text-white transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="p-5 pb-24 space-y-5 overflow-y-auto">
              <div className="flex flex-col items-center justify-center space-y-3 mt-1">
                <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-[#2C2C2E] border border-white/5">
                  <span className="text-sm font-medium text-white">{viewingTx.category}</span>
                </div>
                <h3 className="text-[40px] leading-none font-semibold text-white tracking-tight">¥{Number(viewingTx.amount).toLocaleString()}</h3>
              </div>
              <div className="bg-[#2C2C2E] rounded-[16px] border border-white/5 divide-y divide-white/5">
                <div className="p-4 flex justify-between items-center gap-4"><span className="text-[11px] text-[#8E8E93] font-medium">内容</span><span className="text-[13px] font-medium text-white text-right">{viewingTx.title}</span></div>
                <div className="p-4 flex justify-between items-center gap-4"><span className="text-[11px] text-[#8E8E93] font-medium">日付</span><span className="text-[13px] font-medium text-white text-right">{formatFullDateJP(viewingTx.date)}</span></div>
                <div className="p-4 flex justify-between items-center gap-4"><span className="text-[11px] text-[#8E8E93] font-medium">支払方法</span><span className="text-[13px] font-medium text-white text-right">{viewingTx.paymentMethod}</span></div>
                {viewingTx.isSpecial && <div className="p-4 flex justify-between items-center gap-4"><span className="text-[11px] text-white font-medium">特別費</span><span className="text-[13px] font-medium text-white">該当する</span></div>}
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={async () => { if (window.confirm('この支出を削除しますか？')) { await deleteDoc(doc(db, 'users', user.uid, 'transactions', viewingTx.id)); setViewingTx(null); showToastMsg('削除しました'); } }} className="w-11 h-11 bg-[#FF453A]/10 text-[#FF453A] font-medium rounded-2xl flex items-center justify-center active:scale-95 transition-transform">
                  <Trash2 size={19} />
                </button>
                <button type="button" onClick={() => { const tx = viewingTx; setViewingTx(null); startEditingTx(tx); }} className="flex-1 h-11 bg-[#0A84FF] text-white font-medium rounded-2xl text-[13px] flex items-center justify-center gap-2 active:scale-[0.98] transition-transform">
                  <Pencil size={15} /> 編集する
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCalculator && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-6 bg-black/90 backdrop-blur-xl animate-in zoom-in-95 duration-200" onClick={() => setShowCalculator(false)}>
          <div className="w-full max-w-xs" onClick={e => e.stopPropagation()}>
            <CalculatorPad initialValue={calcInitialValue} onConfirm={(val) => { if (calcOnConfirm) calcOnConfirm(val); setShowCalculator(false); }} />
          </div>
        </div>
      )}

      {isMemoModalOpen && (
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200" onClick={() => setIsMemoModalOpen(false)}>
          <div className="w-full sm:max-w-md bg-[#1C1C1E] rounded-t-[22px] sm:rounded-[22px] border border-white/5 shadow-[0_20px_60px_rgba(0,0,0,0.4)] flex flex-col p-5" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4"><h2 className="text-lg font-semibold text-white tracking-tight">月次メモ</h2><button type="button" onClick={() => setIsMemoModalOpen(false)} className="w-8 h-8 rounded-full bg-[#2C2C2E] flex items-center justify-center text-[#8E8E93]"><X size={16} /></button></div>
            <div className="flex flex-col gap-4">
              <div className="w-full bg-[#2C2C2E] border border-white/5 rounded-[16px] p-4">
                <textarea value={memoText} onChange={(e) => setMemoText(e.target.value)} placeholder="今月のやりくりや、特別費の理由などをメモしておけます。" className="w-full h-36 bg-transparent text-white font-medium text-sm outline-none resize-none leading-relaxed" autoFocus />
              </div>
              <button type="button" onClick={handleMemoSave} className="w-full h-10 bg-[#0A84FF] text-white font-medium rounded-2xl text-[13px] active:scale-[0.98] transition-transform">
                保存する
              </button>
            </div>
          </div>
        </div>
      )}

      {isCopyModalOpen && (
        <div className="fixed inset-0 z-[65] flex items-end sm:items-center justify-center sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200" onClick={() => setIsCopyModalOpen(false)}>
          <div className="w-full sm:max-w-md bg-[#1C1C1E] rounded-t-[22px] sm:rounded-[22px] border border-white/5 shadow-[0_20px_60px_rgba(0,0,0,0.4)] overflow-hidden p-5" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-5"><h2 className="text-lg font-semibold text-white tracking-tight">設定をコピー</h2><button type="button" onClick={() => setIsCopyModalOpen(false)} className="w-8 h-8 rounded-full bg-[#2C2C2E] flex items-center justify-center text-[#8E8E93]"><X size={16} /></button></div>
            <div className="space-y-4">
              <div className="space-y-2.5">
                <label className="text-[11px] text-[#8E8E93] font-medium pl-1">コピー元の月</label>
                <input type="month" value={copySourceMonth} onChange={e => setCopySourceMonth(e.target.value)} className="w-full h-10 bg-[#2C2C2E] border border-white/5 rounded-2xl px-4 text-[12px] font-medium text-white outline-none focus:border-[#0A84FF]/40 transition-all" />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setIsCopyModalOpen(false)} className="flex-1 h-10 bg-[#2C2C2E] text-zinc-300 rounded-2xl font-medium text-[13px] active:bg-white/[0.08] transition-colors">
                  キャンセル
                </button>
                <button type="button" onClick={copySettingsFromSelectedMonth} className="flex-1 h-10 bg-[#0A84FF] text-white rounded-2xl font-medium text-[13px] active:scale-[0.98] transition-transform">
                  実行する
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isTxModalOpen && (
        <div className="fixed inset-0 z-[65] flex items-end sm:items-center justify-center sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200" onClick={() => setIsTxModalOpen(false)}>
          <div className="w-full max-h-[95vh] sm:max-w-md bg-[#1C1C1E] rounded-t-[22px] sm:rounded-[22px] border border-white/5 shadow-[0_20px_60px_rgba(0,0,0,0.4)] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex-none p-4 border-b border-white/5 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-white tracking-tight">{editingTx ? '支出を編集' : '支出を入力'}</h2>
              <button type="button" onClick={() => setIsTxModalOpen(false)} className="w-8 h-8 rounded-full bg-[#2C2C2E] flex items-center justify-center text-[#8E8E93] hover:text-white transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 pb-24">
              <form onSubmit={handleTxSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[11px] font-medium text-[#8E8E93] ml-1">金額</label>
                  <div className="flex gap-3">
                    <div className="flex-1 flex items-center bg-[#2C2C2E] border border-white/5 rounded-2xl h-10 px-4 focus-within:border-[#0A84FF]/40 transition-colors">
                      <span className="text-lg font-semibold text-[#8E8E93] mr-3">¥</span>
                      <input type="text" inputMode="decimal" value={inputAmount ? Number(inputAmount).toLocaleString() : ''} onChange={e => { const v = e.target.value.replace(/,/g, ''); if (!isNaN(v)) setInputAmount(v); }} className="flex-1 w-full bg-transparent text-lg font-semibold text-white outline-none tabular-nums" autoFocus required />
                    </div>
                    <button type="button" onClick={() => openCalculator(inputAmount, (val) => setInputAmount(String(val)))} className="w-10 h-10 bg-[#2C2C2E] border border-white/5 rounded-2xl flex items-center justify-center text-[#8E8E93] active:bg-white/[0.08] transition-colors">
                      <Calculator size={18} />
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-medium text-[#8E8E93] ml-1">内容</label>
                  <input type="text" value={inputTitle} onChange={e => setInputTitle(e.target.value)} className="w-full h-10 bg-[#2C2C2E] border border-white/5 rounded-2xl px-4 text-[13px] font-medium text-white outline-none focus:border-[#0A84FF]/40 transition-colors" placeholder="例: スーパーでお買い物" required />
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <div className="space-y-2 relative min-w-0">
                    <label className="text-[11px] font-medium text-[#8E8E93] ml-1">カテゴリ</label>
                    <select value={inputCategory} onChange={e => setInputCategory(e.target.value)} className="w-full h-10 bg-[#2C2C2E] border border-white/5 rounded-2xl px-4 text-[13px] font-medium text-white outline-none appearance-none focus:border-[#0A84FF]/40 transition-colors">
                      {getCategoryNames().map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-4 top-[36px] text-[#8E8E93] pointer-events-none" />
                  </div>
                  <div className="space-y-2 min-w-0">
                    <label className="text-[11px] font-medium text-[#8E8E93] ml-1">日付</label>
                    <input type="date" value={inputDate} onChange={e => setInputDate(e.target.value)} className="w-full h-10 bg-[#2C2C2E] border border-white/5 rounded-2xl px-4 text-[13px] font-medium text-white outline-none focus:border-[#0A84FF]/40 transition-colors" required />
                  </div>
                </div>

                <div className="space-y-2.5 pt-1">
                  <label className="text-[11px] font-medium text-[#8E8E93] ml-1">支払方法</label>
                  <div className="grid grid-cols-2 gap-2.5">
                    {paymentMethodsSafe.slice(0, 4).map(m => (
                      <button key={m} type="button" onClick={() => setInputMethod(m)} className={`h-9 rounded-2xl text-[12px] font-medium transition-all ${inputMethod === m ? 'bg-[#0A84FF] text-white' : 'bg-[#2C2C2E] text-[#8E8E93] border border-white/5'}`}>
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between p-3.5 bg-[#2C2C2E] rounded-2xl border border-white/5 mt-1">
                  <span className="text-[12px] font-medium text-zinc-300 ml-1">特別費として記録する</span>
                  <button type="button" onClick={() => setInputIsSpecial(prev => !prev)} className={`w-11 h-6 rounded-full relative transition-colors ${inputIsSpecial ? 'bg-[#0A84FF]' : 'bg-black/30 border border-white/5'}`}>
                    <div className={`absolute top-[3px] w-4.5 h-4.5 rounded-full transition-transform ${inputIsSpecial ? 'translate-x-[21px] bg-white' : 'translate-x-1 bg-[#8E8E93]'}`} />
                  </button>
                </div>

                {!editingTx && config.templates.length > 0 && (
                  <div className="space-y-2.5 pt-1">
                    <label className="text-[11px] font-medium text-[#8E8E93] ml-1">テンプレート</label>
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                      {config.templates.map((t, idx) => (
                        <button key={idx} type="button" onClick={() => applyTemplate(t)} className="shrink-0 px-3.5 h-8.5 bg-[#2C2C2E] border border-white/5 rounded-2xl text-[10px] font-medium text-zinc-300 hover:text-white hover:bg-white/[0.07] transition-all flex items-center gap-1.5">
                          <Zap size={11} className="text-[#8E8E93]" /> {t.title}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-4 mt-1 flex gap-4 border-t border-white/5">
                  <button type="submit" className="w-full h-10 bg-[#0A84FF] text-white font-medium rounded-2xl text-[13px] active:scale-[0.98] transition-transform">
                    保存する
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {editingItem && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200" onClick={() => setEditingItem(null)}>
          <div className="w-full max-h-[90vh] sm:h-auto sm:max-w-md bg-[#1C1C1E] rounded-t-[22px] sm:rounded-[22px] border border-white/5 shadow-[0_20px_60px_rgba(0,0,0,0.4)] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-white/5 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-white tracking-tight">編集する</h2>
              <button type="button" onClick={() => setEditingItem(null)} className="w-8 h-8 rounded-full bg-[#2C2C2E] flex items-center justify-center text-[#8E8E93] hover:text-white transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="p-5 pb-24 space-y-4 overflow-y-auto">

              {['salary', 'totalBudget', 'cashBudget', 'savings'].includes(editingItem.type) && (
                <div className="space-y-2">
                  <label className="text-[11px] font-medium text-[#8E8E93] ml-1">
                    {editingItem.type === 'salary' ? '手取り給与' : editingItem.type === 'totalBudget' ? 'クレカ利用目安' : editingItem.type === 'savings' ? '今月の積立額' : '月初のスタート現金'}
                  </label>
                  <div className="flex gap-3">
                    <div className="flex-1 flex items-center bg-[#2C2C2E] border border-white/5 rounded-2xl h-10 px-4 focus-within:border-[#0A84FF]/40 transition-colors">
                      <span className="text-lg font-semibold text-[#8E8E93] mr-3">¥</span>
                      <input type="text" inputMode="decimal" value={String(editingItem.data.value ?? '')} onChange={e => setEditingItem({ ...editingItem, data: { value: e.target.value } })} className="flex-1 w-full bg-transparent text-lg font-semibold text-white outline-none tabular-nums" autoFocus />
                    </div>
                    <button type="button" onClick={() => openCalculator(editingItem.data.value ?? 0, (val) => setEditingItem(prev => ({ ...prev, data: { value: String(val) } })))} className="w-10 h-10 bg-[#2C2C2E] border border-white/5 rounded-2xl flex items-center justify-center text-[#8E8E93] active:bg-white/[0.08] transition-colors">
                      <Calculator size={18} />
                    </button>
                  </div>
                </div>
              )}

              {editingItem.type === 'memo' && (
                <div className="space-y-2">
                  <label className="text-[11px] font-medium text-[#8E8E93] ml-1">今月のメモ</label>
                  <div className="w-full bg-[#2C2C2E] border border-white/5 rounded-[16px] p-4">
                    <textarea value={editingItem.data.memo || ''} onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, memo: e.target.value } })} className="w-full h-36 bg-transparent text-white font-medium text-sm outline-none resize-none leading-relaxed" autoFocus />
                  </div>
                </div>
              )}

              {editingItem.type === 'bill' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 bg-[#2C2C2E] rounded-2xl border border-white/5">
                    <CreditCard size={18} className="text-[#8E8E93]" />
                    <span className="text-base font-medium text-white">{editingItem.data.name}</span>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-medium text-[#8E8E93] ml-1">引落予定額</label>
                    <div className="flex gap-3">
                      <div className="flex-1 flex items-center bg-[#2C2C2E] border border-white/5 rounded-2xl h-10 px-4 focus-within:border-[#0A84FF]/40 transition-colors">
                        <span className="text-lg font-semibold text-[#8E8E93] mr-3">¥</span>
                        <input type="text" inputMode="decimal" value={String(editingItem.data.bill ?? '')} onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, bill: e.target.value } })} className="flex-1 w-full bg-transparent text-lg font-semibold text-white outline-none tabular-nums" autoFocus />
                      </div>
                      <button type="button" onClick={() => openCalculator(editingItem.data.bill ?? 0, (val) => setEditingItem(prev => ({ ...prev, data: { ...prev.data, bill: String(val) } })))} className="w-10 h-10 bg-[#2C2C2E] border border-white/5 rounded-2xl flex items-center justify-center text-[#8E8E93] active:bg-white/[0.08] transition-colors">
                        <Calculator size={18} />
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-medium text-[#8E8E93] ml-1">引落日</label>
                    <div className="flex items-center bg-[#2C2C2E] border border-white/5 rounded-2xl h-10 px-4 focus-within:border-[#0A84FF]/40 transition-colors w-1/2">
                      <input type="number" value={String(editingItem.data.due ?? '')} onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, due: e.target.value } })} className="w-full bg-transparent text-lg font-semibold text-white outline-none tabular-nums" />
                      <span className="text-[#8E8E93] font-medium text-sm ml-2">日</span>
                    </div>
                  </div>
                </div>
              )}

              {editingItem.type === 'category' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[11px] font-medium text-[#8E8E93] ml-1">カテゴリ名</label>
                    <input value={editingItem.data.name || ''} onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, name: e.target.value } })} className="w-full h-10 bg-[#2C2C2E] border border-white/5 rounded-2xl px-4 text-[13px] font-medium text-white outline-none focus:border-[#0A84FF]/40 transition-colors" autoFocus />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-medium text-[#8E8E93] ml-1">月の予算</label>
                    <div className="flex gap-3">
                      <div className="flex-1 flex items-center bg-[#2C2C2E] border border-white/5 rounded-2xl h-10 px-4 focus-within:border-[#0A84FF]/40 transition-colors">
                        <span className="text-lg font-semibold text-[#8E8E93] mr-3">¥</span>
                        <input type="text" inputMode="decimal" value={editingItem.data.budget ? Number(editingItem.data.budget).toLocaleString() : ''} onChange={e => { const v = e.target.value.replace(/,/g, ''); if (!isNaN(v)) setEditingItem({ ...editingItem, data: { ...editingItem.data, budget: v } }); }} className="flex-1 w-full bg-transparent text-lg font-semibold text-white outline-none tabular-nums" placeholder="0" />
                      </div>
                      <button type="button" onClick={() => openCalculator(editingItem.data.budget ?? 0, (val) => setEditingItem(prev => ({ ...prev, data: { ...prev.data, budget: String(val) } })))} className="w-10 h-10 bg-[#2C2C2E] border border-white/5 rounded-2xl flex items-center justify-center text-[#8E8E93] active:bg-white/[0.08] transition-colors">
                        <Calculator size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {editingItem.type === 'fixed' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[11px] font-medium text-[#8E8E93] ml-1">内容</label>
                    <input value={editingItem.data.name || ''} onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, name: e.target.value } })} className="w-full h-10 bg-[#2C2C2E] border border-white/5 rounded-2xl px-4 text-[13px] font-medium text-white outline-none focus:border-[#0A84FF]/40 transition-colors" autoFocus />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-medium text-[#8E8E93] ml-1">金額</label>
                    <div className="flex gap-3">
                      <div className="flex-1 flex items-center bg-[#2C2C2E] border border-white/5 rounded-2xl h-10 px-4 focus-within:border-[#0A84FF]/40 transition-colors">
                        <span className="text-lg font-semibold text-[#8E8E93] mr-3">¥</span>
                        <input type="text" inputMode="decimal" value={editingItem.data.amount ? Number(editingItem.data.amount).toLocaleString() : ''} onChange={e => { const v = e.target.value.replace(/,/g, ''); if (!isNaN(v)) setEditingItem({ ...editingItem, data: { ...editingItem.data, amount: v } }); }} className="flex-1 w-full bg-transparent text-lg font-semibold text-white outline-none tabular-nums" />
                      </div>
                      <button type="button" onClick={() => openCalculator(editingItem.data.amount ?? 0, (val) => setEditingItem(prev => ({ ...prev, data: { ...prev.data, amount: String(val) } })))} className="w-10 h-10 bg-[#2C2C2E] border border-white/5 rounded-2xl flex items-center justify-center text-[#8E8E93] active:bg-white/[0.08] transition-colors">
                        <Calculator size={18} />
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2 relative">
                    <label className="text-[11px] font-medium text-[#8E8E93] ml-1">支払方法</label>
                    <select value={editingItem.data.method || ''} onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, method: e.target.value } })} className="w-full h-10 bg-[#2C2C2E] border border-white/5 rounded-2xl px-4 text-[13px] font-medium text-white outline-none appearance-none focus:border-[#0A84FF]/40 transition-colors">
                      {config.paymentMethods.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-4 top-[36px] text-[#8E8E93] pointer-events-none" />
                  </div>
                </div>
              )}

              {editingItem.type === 'template' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[11px] font-medium text-[#8E8E93] ml-1">テンプレート名</label>
                    <input value={editingItem.data.title || ''} onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, title: e.target.value } })} className="w-full h-10 bg-[#2C2C2E] border border-white/5 rounded-2xl px-4 text-[13px] font-medium text-white outline-none focus:border-[#0A84FF]/40 transition-colors" autoFocus />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-medium text-[#8E8E93] ml-1">初期金額</label>
                    <div className="flex gap-3">
                      <div className="flex-1 flex items-center bg-[#2C2C2E] border border-white/5 rounded-2xl h-10 px-4 focus-within:border-[#0A84FF]/40 transition-colors">
                        <span className="text-lg font-semibold text-[#8E8E93] mr-3">¥</span>
                        <input type="text" inputMode="decimal" value={editingItem.data.amount ? Number(editingItem.data.amount).toLocaleString() : ''} onChange={e => { const v = e.target.value.replace(/,/g, ''); if (!isNaN(v)) setEditingItem({ ...editingItem, data: { ...editingItem.data, amount: v } }); }} className="flex-1 w-full bg-transparent text-lg font-semibold text-white outline-none tabular-nums" />
                      </div>
                      <button type="button" onClick={() => openCalculator(editingItem.data.amount ?? 0, (val) => setEditingItem(prev => ({ ...prev, data: { ...prev.data, amount: String(val) } })))} className="w-10 h-10 bg-[#2C2C2E] border border-white/5 rounded-2xl flex items-center justify-center text-[#8E8E93] active:bg-white/[0.08] transition-colors">
                        <Calculator size={18} />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    <div className="space-y-2 relative">
                      <label className="text-[11px] font-medium text-[#8E8E93] ml-1">カテゴリ</label>
                      <select value={editingItem.data.category || ''} onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, category: e.target.value } })} className="w-full h-10 bg-[#2C2C2E] border border-white/5 rounded-2xl px-4 text-[13px] font-medium text-white outline-none appearance-none focus:border-[#0A84FF]/40 transition-colors">
                        {getCategoryNames().map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <ChevronDown size={14} className="absolute right-4 top-[36px] text-[#8E8E93] pointer-events-none" />
                    </div>
                    <div className="space-y-2 relative">
                      <label className="text-[11px] font-medium text-[#8E8E93] ml-1">支払方法</label>
                      <select value={editingItem.data.method || ''} onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, method: e.target.value } })} className="w-full h-10 bg-[#2C2C2E] border border-white/5 rounded-2xl px-4 text-[13px] font-medium text-white outline-none appearance-none focus:border-[#0A84FF]/40 transition-colors">
                        {config.paymentMethods.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                      <ChevronDown size={14} className="absolute right-4 top-[36px] text-[#8E8E93] pointer-events-none" />
                    </div>
                  </div>
                </div>
              )}

              {editingItem.type === 'payment' && (
                <div className="space-y-2">
                  <label className="text-[11px] font-medium text-[#8E8E93] ml-1">支払方法名</label>
                  <input value={editingItem.data.name || ''} onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, name: e.target.value } })} className="w-full h-10 bg-[#2C2C2E] border border-white/5 rounded-2xl px-4 text-[13px] font-medium text-white outline-none focus:border-[#0A84FF]/40 transition-colors" autoFocus />
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t border-white/5 mt-1">
                {editingItem.index !== -1 && !['salary', 'totalBudget', 'cashBudget', 'savings', 'bill', 'memo'].includes(editingItem.type) && (
                  <button onClick={handleDeleteItem} className="w-11 h-11 bg-[#FF453A]/10 text-[#FF453A] rounded-2xl flex items-center justify-center active:scale-95 transition-transform">
                    <Trash2 size={19} />
                  </button>
                )}
                <button onClick={handleSettingsSave} className="flex-1 h-10 bg-[#0A84FF] text-white rounded-2xl font-medium text-[13px] active:scale-[0.98] transition-transform">
                  変更を保存する
                </button>
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
