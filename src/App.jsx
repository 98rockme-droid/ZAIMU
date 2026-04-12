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
  return `${y}年 ${Number(m)}月`;
};

const formatDateShort = (isoDateStr) => {
  if (!isoDateStr) return '';
  const d = new Date(isoDateStr);
  return isNaN(d.getTime()) ? '' : `${d.getMonth() + 1}/${d.getDate()}`;
};

const formatFullDateJP = (isoDateStr) => {
  if (!isoDateStr) return '';
  const d = new Date(isoDateStr);
  return isNaN(d.getTime()) ? '' : `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
};

const getTodayString = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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
    budget: d.budget || 0, // クレカ目安
    cashBudget: d.cashBudget || 0, // 月初現金
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
const getCategoryColor = (index) => GRAY_PALETTE[index % GRAY_PALETTE.length];

/* --- COMPONENTS --- */
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) return (
      <div className="h-screen w-full bg-[#121212] text-zinc-200 flex flex-col items-center justify-center p-6 gap-4">
        <h1 className="text-xl font-bold text-red-400">エラーが発生しました</h1>
        <button onClick={() => window.location.reload()} className="px-6 py-3 bg-white text-black rounded-full font-bold text-sm">再読み込み</button>
      </div>
    );
    return this.props.children;
  }
}

const SimpleCard = ({ children, className = "", onClick }) => (
  <div onClick={onClick} className={`bg-[#1E1E1E] rounded-xl border border-white/5 shadow-lg overflow-hidden w-full box-border ${className}`}>{children}</div>
);

const NavButton = ({ active, onClick, icon }) => (
  <button onClick={onClick} className={`flex items-center justify-center w-16 h-16 transition-all duration-300 ${active ? 'text-white scale-110 drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]' : 'text-zinc-600 hover:text-zinc-400'}`}>{icon}</button>
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
// evalを使わない安全な計算機ロジック
const safeCalculate = (expression) => {
  if (!expression || /[^0-9+\-*/.]/g.test(String(expression))) return '0';
  try {
    const tokens = String(expression).match(/(\d+(\.\d+)?|[\+\-\*\/])/g);
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
  const [transactions, setTransactions] = useState([]);
  const [lastMonthTransactions, setLastMonthTransactions] = useState([]);
  const [monthlyData, setMonthlyData] = useState(normalizeMonthlyData());
  const [config, setConfig] = useState(normalizeConfig());
  const [savingsTotalToMonth, setSavingsTotalToMonth] = useState(0);
  const [viewingTx, setViewingTx] = useState(null);
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [calcInitialValue, setCalcInitialValue] = useState(0);
  const [calcOnConfirm, setCalcOnConfirm] = useState(null);
  const [editingTx, setEditingTx] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [inputDate, setInputDate] = useState(getTodayString());
  const [inputAmount, setInputAmount] = useState('');
  const [inputTitle, setInputTitle] = useState('');
  const [inputCategory, setInputCategory] = useState('');
  const [inputMethod, setInputMethod] = useState('');
  const [inputIsSpecial, setInputIsSpecial] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [filter, setFilter] = useState({ category: 'ALL', method: 'ALL', special: false });
  const [toast, setToast] = useState({ visible: false, message: '' });
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [copySourceMonth, setCopySourceMonth] = useState('');
  const [memoText, setMemoText] = useState('');
  const [isMemoExpanded, setIsMemoExpanded] = useState(false);
  const [isMemoModalOpen, setIsMemoModalOpen] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState(null);
  const [faqSearchText, setFaqSearchText] = useState('');

  const FAQ_DATA = [
    {
      category: '⚙️ 1. 設定で入力する金額の使い道',
      items: [
        { q: '手取り給与 (salary)', a: '家計のすべてのベース（収入）として使われます。\n影響する場所: ホーム画面の「今月の自由な現金」「来月末の着地予想」の計算のスタート金額になります。' },
        { q: 'クレジットカード利用目安 (budget)', a: 'クレカを使いすぎていないかの「ペースメーカー」になります。\n影響する場所: ホーム画面左上の「今のカード利用額」のプログレスバーと「AIアドバイス」の判定基準に使われます。' },
        { q: '月初のスタート現金 (cashBudget)', a: '毎月1日に、お財布と口座にある「今月使える現金の実数」を入力します。\n影響する場所: ホーム画面の「今の現金残り」の計算元になります。' },
        { q: '今月の積立額 (savings)', a: '「絶対に使ってはいけないお金（先取り）」として差し引かれます。\n影響する場所: ホームの各予測値からマイナスされ、積立総額に加算されます。' },
        { q: '引落予定のカード（引落額）', a: '「先月使った分のツケ」として扱われます。\n影響する場所: ホーム画面の「今月の自由な現金」からマイナスされます。' },
        { q: '固定費管理', a: '現金払いのものは「今月の自由な現金」から引かれ、全固定費の合計は「来月末の着地予想」から引かれます。' }
      ]
    },
    {
      category: '🏠 2. ホーム画面の計算式',
      items: [
        { q: '今のカード利用額', a: '今月カード決済した合計。目安に対して何％使っているかバーで表示します。' },
        { q: '今の現金残り', a: '【意味】今月、手元にリアルに残っている現金の実数\n【計算式】月初のスタート現金 － 今月「現金」で使った金額' },
        { q: '今月の自由な現金', a: '【意味】給与から確定支払いを終えた直後に残る、今月中に使っていい現金の総枠。\n【計算式】給与 － 引落予定のカード(先月のツケ) － 固定費(現金) － 積立額' },
        { q: '来月末の着地予想', a: '【意味】今のペースを続けた場合、来月末に手元にいくら純利益が残るかの予想。\n【計算式】給与 － 今のカード利用額 － 固定費(全額) － 積立額' }
      ]
    }
  ];

  const filteredFaqData = useMemo(() => {
    if (!faqSearchText) return FAQ_DATA;
    const lowerText = faqSearchText.toLowerCase();
    return FAQ_DATA.map(cat => ({ ...cat, items: cat.items.filter(item => item.q.toLowerCase().includes(lowerText) || item.a.toLowerCase().includes(lowerText)) })).filter(cat => cat.items.length > 0);
  }, [faqSearchText]);

  useEffect(() => onAuthStateChanged(auth, u => { setUser(u); setAuthLoading(false); }), []);

  useEffect(() => {
    if (!user) return;
    const start = new Date(`${month}-01T00:00:00`).toISOString();
    const nextDate = new Date(`${month}-01T00:00:00`); nextDate.setMonth(nextDate.getMonth() + 1);
    return onSnapshot(query(collection(db, 'users', user.uid, 'transactions'), where('date', '>=', start), where('date', '<', nextDate.toISOString())), s => {
      setTransactions(s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => new Date(b.date) - new Date(a.date)));
    });
  }, [month, user]);

  useEffect(() => {
    if (!user) return;
    onSnapshot(doc(db, 'users', user.uid, 'months', month), s => setMonthlyData(normalizeMonthlyData(s.data())));
    onSnapshot(doc(db, 'users', user.uid, 'settings', 'config'), s => s.exists() && setConfig(normalizeConfig(s.data())));
  }, [month, user]);

  useEffect(() => {
    if (!user) return;
    const prevDate = new Date(`${month}-01T00:00:00`); prevDate.setMonth(prevDate.getMonth() - 1);
    const prevStart = new Date(`${getMonthString(prevDate)}-01T00:00:00`).toISOString();
    const currentStart = new Date(`${month}-01T00:00:00`).toISOString();
    getDocs(query(collection(db, 'users', user.uid, 'transactions'), where('date', '>=', prevStart), where('date', '<', currentStart)))
      .then(s => setLastMonthTransactions(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    getDocs(query(collection(db, 'users', user.uid, 'months'), where(documentId(), '<=', month), orderBy(documentId(), 'asc')))
      .then(s => { let sum = 0; s.forEach(d => { sum += Number(d.data().savings || 0); }); setSavingsTotalToMonth(sum); });
  }, [user, month]);

  useEffect(() => { setMemoText(monthlyData?.memo || ''); }, [monthlyData?.memo]);

  const summary = useMemo(() => {
    const d = monthlyData;
    const fixedCosts = d.fixedCosts || [];
    const fixedCash = fixedCosts.filter(f => !f.method || f.method === CASH).reduce((s, i) => s + toNumber(i.amount), 0);
    const fixedTotal = fixedCosts.reduce((s, i) => s + toNumber(i.amount), 0);
    const salary = toNumber(d.salary);
    const savings = toNumber(d.savings);
    const cashBudget = toNumber(d.cashBudget);
    const billTotal = Object.values(d.cardBills).reduce((s, v) => s + toNumber(v), 0);
    const normalTx = transactions.filter(t => !t.isSpecial);
    const lastNormalTx = lastMonthTransactions.filter(t => !t.isSpecial);
    const spentCard = normalTx.filter(t => t.paymentMethod !== CASH).reduce((s, t) => s + toNumber(t.amount), 0);
    const spentCash = normalTx.filter(t => t.paymentMethod === CASH).reduce((s, t) => s + toNumber(t.amount), 0);
    const withdrawalOnly = fixedCash + billTotal;
    const cardTarget = Number(d.budget) > 0 ? Number(d.budget) : 100000;
    const currentFreeCash = salary - withdrawalOnly - savings;
    const projectedCash = salary - spentCard - fixedTotal - savings;
    const cashRemaining = cashBudget - spentCash;
    return {
      cardTarget, spentCard, cardPacePercent: Math.min(100, (spentCard / cardTarget) * 100),
      cashBudget, spentCash, cashRemaining, currentFreeCash, projectedCash, savingsAmount: savings,
      totalSpent: normalTx.reduce((s, t) => s + toNumber(t.amount), 0),
      lastTotalSpent: lastNormalTx.reduce((s, t) => s + toNumber(t.amount), 0),
      catTotals: normalTx.reduce((acc, t) => { acc[t.category] = (acc[t.category] || 0) + toNumber(t.amount); return acc; }, {}),
      lastCatTotals: lastNormalTx.reduce((acc, t) => { acc[t.category] = (acc[t.category] || 0) + toNumber(t.amount); return acc; }, {}),
      dailyTotals: normalTx.reduce((acc, t) => { if(!t.date) return acc; const dIdx = new Date(t.date).getDate(); acc[dIdx] = (acc[dIdx]||0) + toNumber(t.amount); return acc; }, {}),
      specialTotalSpent: transactions.filter(t => t.isSpecial).reduce((s, t) => s + toNumber(t.amount), 0)
    };
  }, [monthlyData, transactions, lastMonthTransactions]);

  const aiMessage = useMemo(() => {
    const d = new Date(); const isCurrent = month === getMonthString(d);
    const progress = d.getDate() / new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    if (summary.totalSpent === 0) return { icon: '📝', text: '黄金パターンを目指して記録を始めましょう！', color: 'text-zinc-400', bg: 'bg-white/5', border: 'border-white/10' };
    if (summary.cashRemaining < 0 && summary.cashBudget > 0) return { icon: '💸', text: '現金残高がマイナスです！支出の打ち間違えか、カード払いを検討しましょう。', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' };
    if (summary.projectedCash < 0) return { icon: '⚠️', text: '赤字予測が出ています。今月後半はカード利用を控えめに！', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' };
    const topCat = Object.entries(summary.catTotals).sort((a,b)=>b[1]-a[1])[0];
    if (isCurrent) {
        if (progress < 0.5 && summary.cardPacePercent > 60) return { icon: '🐢', text: '前半でカードを使いすぎかも。少しペースを落としましょう。', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' };
        if (summary.projectedCash >= 60000) return { icon: '✨', text: `黄金パターン維持！来月末も ¥${summary.projectedCash.toLocaleString()} の黒字予測です。`, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' };
        return { icon: '💡', text: `カード利用は目安の ${Math.round(summary.cardPacePercent)}% です。順調ですね。`, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' };
    }
    return { icon: '🏁', text: `この月は ¥${summary.projectedCash.toLocaleString()} の黒字予測で着地しました！`, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' };
  }, [summary, month]);

  const activeCategories = (config?.categories || []).map(c=>c.name).filter(n => (monthlyData.catBudgets?.[n] || 0) > 0 || (summary.catTotals[n] || 0) > 0);
  const showToastMsg = (m) => { setToast({ visible: true, message: m }); setTimeout(() => setToast({ visible: false, message: '' }), 2500); };
  const getCategoryNames = () => (config?.categories || []).map(c => c.name);
  const getCategoryIcon = (n) => (config?.categories || []).find(x => x.name === n)?.icon || '🏷';
  const paymentMethodsSafe = config?.paymentMethods?.length ? config.paymentMethods : [CASH];
  const clearLogFilters = () => { setSearchText(''); setFilter({ category: 'ALL', method: 'ALL', special: false }); };
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
    } catch (e) { console.error(e); showToastMsg('エラー'); }
  };

  /* --- SETTINGS OPERATIONS --- */
  const openEdit = (type, data, index) => setEditingItem({ type, data: { ...data }, index });

  const handleSettingsSave = async () => {
    if (!user || !editingItem) return;
    const { type, data, index } = editingItem;
    try {
      if (type === 'salary' || type === 'totalBudget' || type === 'cashBudget' || type === 'savings') {
        const fieldMap = { salary: 'salary', totalBudget: 'budget', cashBudget: 'cashBudget', savings: 'savings' };
        await setDoc(doc(db, 'users', user.uid, 'months', month), { [fieldMap[type]]: toNumber(data.value) }, { merge: true });
      } else if (type === 'memo') {
        await setDoc(doc(db, 'users', user.uid, 'months', month), { memo: data.memo || '' }, { merge: true });
      } else if (type === 'bill') {
        const newBills = { ...(monthlyData.cardBills || {}), [data.name]: toNumber(data.bill) };
        const newDues = { ...(monthlyData.cardDueDates || {}), [data.name]: data.due };
        await setDoc(doc(db, 'users', user.uid, 'months', month), { cardBills: newBills, cardDueDates: newDues }, { merge: true });
      } else if (type === 'fixed') {
        const list = [...(monthlyData.fixedCosts || [])];
        const item = { ...data, amount: toNumber(data.amount) };
        if (index === -1) list.unshift({ ...item, id: Date.now() }); else list[index] = item;
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
        if (index === -1) list.push(data.name); else list[index] = data.name;
        await setDoc(doc(db, 'users', user.uid, 'settings', 'config'), { ...config, paymentMethods: list }, { merge: true });
      }
      setEditingItem(null); showToastMsg('保存しました');
    } catch (e) { console.error(e); showToastMsg('エラー'); }
  };

  const handleDeleteItem = async () => {
    if (!editingItem || !window.confirm('削除しますか？')) return;
    const { type, index, data } = editingItem;
    if (type === 'fixed') {
      await setDoc(doc(db, 'users', user.uid, 'months', month), { fixedCosts: (monthlyData.fixedCosts || []).filter((_, i) => i !== index) }, { merge: true });
    } else if (type === 'category') {
      await setDoc(doc(db, 'users', user.uid, 'settings', 'config'), { ...config, categories: (config.categories || []).filter((_, i) => i !== index) }, { merge: true });
    } else if (type === 'template') {
      await setDoc(doc(db, 'users', user.uid, 'settings', 'config'), { ...config, templates: (config.templates || []).filter((_, i) => i !== index) }, { merge: true });
    } else if (type === 'payment') {
      await setDoc(doc(db, 'users', user.uid, 'settings', 'config'), { ...config, paymentMethods: (config.paymentMethods || []).filter((_, i) => i !== index) }, { merge: true });
    } else if (type === 'bill') {
      const newBills = { ...(monthlyData.cardBills || {}) }; const newDues = { ...(monthlyData.cardDueDates || {}) };
      delete newBills[data.name]; delete newDues[data.name];
      await setDoc(doc(db, 'users', user.uid, 'months', month), { cardBills: newBills, cardDueDates: newDues }, { merge: true });
    }
    setEditingItem(null); showToastMsg('削除しました');
  };

  const copySettingsFromSelectedMonth = async () => {
    if (!user || !copySourceMonth) return;
    if (!window.confirm(`${formatMonthJP(copySourceMonth)} の設定をコピーしますか？`)) return;
    try {
      const snap = await getDoc(doc(db, 'users', user.uid, 'months', copySourceMonth));
      if (snap.exists()) {
        const d = snap.data();
        await setDoc(doc(db, 'users', user.uid, 'months', month), {
          budget: d.budget || 0, fixedCosts: d.fixedCosts || [], catBudgets: d.catBudgets || {},
          cardBills: d.cardBills || {}, cardDueDates: d.cardDueDates || {}, savings: d.savings || 0, salary: d.salary || 0
        }, { merge: true });
        showToastMsg('コピーしました'); setIsCopyModalOpen(false);
      } else showToastMsg('データがありません');
    } catch (e) { showToastMsg('エラー'); }
  };
  /* --- RENDER HELPER --- */
  if (authLoading) return <div className="h-screen w-full bg-[#121212] flex items-center justify-center"><div className="w-8 h-8 border-4 border-white/10 border-t-white rounded-full animate-spin" /></div>;
  if (!user) return (
    <div className="h-screen w-full bg-[#121212] flex flex-col items-center justify-center p-8 text-center">
      <div className="w-20 h-20 bg-white/5 rounded-[2rem] flex items-center justify-center mb-8 border border-white/10 shadow-2xl">
        <Sparkles size={40} className="text-white" />
      </div>
      <h1 className="text-4xl font-black text-white mb-3 tracking-tighter">ZAIMU</h1>
      <p className="text-zinc-500 text-sm mb-12 font-medium">ミニマルで強靭な家計管理</p>
      <button onClick={() => signInWithPopup(auth, new GoogleAuthProvider())} className="w-full max-w-xs h-16 bg-white text-black rounded-2xl font-black text-sm flex items-center justify-center gap-3 shadow-xl active:scale-95 transition-all">
        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/layout/google.svg" className="w-5 h-5" alt=""/>
        Googleでログイン
      </button>
    </div>
  );

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#121212] text-zinc-200 font-sans pb-32 selection:bg-white/10 overflow-x-hidden">
        {/* --- TOP NAV --- */}
        <div className="sticky top-0 z-40 bg-[#121212]/80 backdrop-blur-xl border-b border-white/5">
          <div className="max-w-2xl mx-auto px-5 h-20 flex items-center justify-between">
            <div className="flex items-center gap-3 group">
              <div className="w-10 h-10 bg-white text-black rounded-xl flex items-center justify-center shadow-lg group-active:scale-90 transition-transform">
                <Sparkles size={20} weight="fill" />
              </div>
              <div>
                <div className="text-[10px] font-black text-zinc-500 tracking-[0.2em] leading-none mb-1 uppercase">Smart Finance</div>
                <div className="text-lg font-black text-white leading-none tracking-tight">ZAIMU</div>
              </div>
            </div>
            <div className="flex items-center bg-white/5 rounded-full px-2 py-1 border border-white/5 shadow-inner">
              <button onClick={() => { const d = new Date(`${month}-01`); d.setMonth(d.getMonth() - 1); setMonth(getMonthString(d)); }} className="p-2 text-zinc-400 hover:text-white"><ChevronLeft size={18} /></button>
              <div className="px-3 text-xs font-black text-zinc-200 min-w-[100px] text-center tracking-tighter">{formatMonthJP(month)}</div>
              <button onClick={() => { const d = new Date(`${month}-01`); d.setMonth(d.getMonth() + 1); setMonth(getMonthString(d)); }} className="p-2 text-zinc-400 hover:text-white"><ChevronRight size={18} /></button>
            </div>
          </div>
        </div>

        <main className="max-w-2xl mx-auto px-5 pt-8 space-y-8">
          {activeTab === 'home' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
              {/* AI INSIGHT */}
              <div className={`p-5 rounded-3xl border ${aiMessage.border} ${aiMessage.bg} flex items-start gap-4 shadow-sm`}>
                <div className="text-2xl mt-0.5">{aiMessage.icon}</div>
                <div className={`text-[13px] font-bold leading-relaxed ${aiMessage.color}`}>{aiMessage.text}</div>
              </div>

              {/* HERO STATS */}
              <div className="grid grid-cols-2 gap-4">
                <SimpleCard className="p-5 flex flex-col justify-between min-h-[140px] relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform"><CreditCard size={48} /></div>
                  <div className="space-y-1">
                    <div className="text-[10px] font-black text-zinc-500 tracking-widest uppercase">今のカード利用額</div>
                    <div className="text-2xl font-black text-white tracking-tighter">¥{summary.spentCard.toLocaleString()}</div>
                  </div>
                  <div className="space-y-2">
                    <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className={`h-full transition-all duration-1000 ${summary.cardPacePercent > 90 ? 'bg-red-500' : 'bg-white'}`} style={{ width: `${summary.cardPacePercent}%` }} />
                    </div>
                    <div className="text-[10px] font-bold text-zinc-500">目安: ¥{summary.cardTarget.toLocaleString()}</div>
                  </div>
                </SimpleCard>

                <SimpleCard className="p-5 flex flex-col justify-between min-h-[140px] relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform"><Wallet size={48} /></div>
                  <div className="space-y-1">
                    <div className="text-[10px] font-black text-zinc-500 tracking-widest uppercase">今の現金残り</div>
                    <div className={`text-2xl font-black tracking-tighter ${summary.cashRemaining < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                      ¥{summary.cashRemaining.toLocaleString()}
                    </div>
                  </div>
                  <div className="text-[10px] font-bold text-zinc-500">月初: ¥{summary.cashBudget.toLocaleString()}</div>
                </SimpleCard>
              </div>

              {/* CASH FLOW PREDICTION */}
              <SimpleCard className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-zinc-400 tracking-[0.2em] uppercase">Cash Flow Prediction</h3>
                  <div className="px-2 py-1 bg-white/5 rounded text-[10px] font-bold text-zinc-500">予測</div>
                </div>
                <div className="grid grid-cols-1 gap-6 divide-y divide-white/5">
                  <div className="pt-0">
                    <div className="flex justify-between items-end mb-2">
                      <div className="text-xs font-bold text-zinc-300 flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-500" />今月の自由な現金</div>
                      <div className="text-xl font-black text-white tabular-nums">¥{summary.currentFreeCash.toLocaleString()}</div>
                    </div>
                    <p className="text-[10px] text-zinc-500 leading-relaxed font-medium">給与から確定した支払額を引いた、今月使える最大枠です。</p>
                  </div>
                  <div className="pt-6">
                    <div className="flex justify-between items-end mb-2">
                      <div className="text-xs font-bold text-zinc-300 flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />来月末の着地予想</div>
                      <div className={`text-xl font-black tabular-nums ${summary.projectedCash < 0 ? 'text-red-400' : 'text-white'}`}>¥{summary.projectedCash.toLocaleString()}</div>
                    </div>
                    <p className="text-[10px] text-zinc-500 leading-relaxed font-medium">今の支出ペースを続けた場合に残る「純利益」の予測です。</p>
                  </div>
                </div>
              </SimpleCard>

              {/* QUICK ACTIONS */}
              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => setIsMemoModalOpen(true)} className="flex items-center justify-center gap-3 p-5 bg-[#1E1E1E] rounded-2xl border border-white/5 hover:bg-white/5 transition-all group">
                  <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-zinc-400 group-hover:text-white transition-colors"><FileText size={20} /></div>
                  <div className="text-left"><div className="text-[10px] font-black text-zinc-500 uppercase">Memo</div><div className="text-xs font-bold text-zinc-300">月次メモ</div></div>
                </button>
                <button onClick={() => setActiveTab('analysis')} className="flex items-center justify-center gap-3 p-5 bg-[#1E1E1E] rounded-2xl border border-white/5 hover:bg-white/5 transition-all group">
                  <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-zinc-400 group-hover:text-white transition-colors"><BarChart3 size={20} /></div>
                  <div className="text-left"><div className="text-[10px] font-black text-zinc-500 uppercase">Analysis</div><div className="text-xs font-bold text-zinc-300">支出分析</div></div>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'log' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-black text-white tracking-tighter">履歴</h2>
                <div className="flex bg-white/5 p-1 rounded-xl border border-white/5">
                  <button onClick={() => setLogView('list')} className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${logView === 'list' ? 'bg-white text-black shadow-lg' : 'text-zinc-500'}`}>リスト</button>
                  <button onClick={() => setLogView('calendar')} className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${logView === 'calendar' ? 'bg-white text-black shadow-lg' : 'text-zinc-500'}`}>カレンダー</button>
                </div>
              </div>
              
              {/* 検索 & フィルタ */}
              <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                <div className="relative shrink-0">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={14} />
                  <input value={searchText} onChange={e => setSearchText(e.target.value)} placeholder="検索..." className="bg-[#1E1E1E] border border-white/5 rounded-xl pl-9 pr-4 py-2 text-xs font-bold focus:outline-none focus:border-white/20 w-40" />
                </div>
                {getCategoryNames().map(cat => (
                  <button key={cat} onClick={() => setFilter(f => ({ ...f, category: f.category === cat ? 'ALL' : cat }))} className={`shrink-0 px-4 py-2 rounded-xl text-xs font-bold border transition-all ${filter.category === cat ? 'bg-white text-black border-white' : 'bg-[#1E1E1E] text-zinc-500 border-white/5'}`}>{cat}</button>
                ))}
              </div>

              {logView === 'list' ? (
                <div className="space-y-2">
                  {transactions.filter(t => (filter.category === 'ALL' || t.category === filter.category) && (t.title.includes(searchText) || t.category.includes(searchText))).map(t => (
                    <button key={t.id} onClick={() => startEditingTx(t)} className="w-full flex items-center justify-between p-4 bg-[#1E1E1E] rounded-2xl border border-white/5 active:scale-[0.98] transition-all group">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-white/5 flex flex-col items-center justify-center text-zinc-500 group-hover:bg-white/10 transition-colors">
                          <span className="text-[10px] font-black">{formatDateShort(t.date).split('/')[0]}</span>
                          <span className="text-sm font-black text-zinc-300">{formatDateShort(t.date).split('/')[1]}</span>
                        </div>
                        <div className="text-left">
                          <div className="text-[13px] font-black text-white mb-0.5">{t.title}</div>
                          <div className="text-[10px] font-bold text-zinc-500 flex items-center gap-2">
                            <span className="flex items-center gap-1">{getCategoryIcon(t.category)} {t.category}</span>
                            <span>•</span>
                            <span>{t.paymentMethod}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-black text-white mb-0.5">¥{t.amount?.toLocaleString()}</div>
                        {t.isSpecial && <div className="text-[9px] font-black text

                                  {activeTab === 'analysis' && (
            <div className="space-y-8 animate-in fade-in duration-500 pb-20">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-black text-white tracking-tighter">分析</h2>
                <div className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Summary</div>
              </div>

              <SimpleCard className="p-6">
                <div className="flex justify-between items-start mb-8">
                  <div>
                    <div className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">今月の総支出</div>
                    <div className="text-3xl font-black text-white tracking-tighter">¥{summary.totalSpent.toLocaleString()}</div>
                  </div>
                  <div className={`px-3 py-1.5 rounded-lg text-[10px] font-black border ${summary.totalSpent <= summary.lastTotalSpent ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                    {summary.totalSpent <= summary.lastTotalSpent ? <TrendingDown size={12} className="inline mr-1"/> : <TrendingUp size={12} className="inline mr-1"/>}
                    先月比 {summary.totalSpent <= summary.lastTotalSpent ? '-' : '+'}¥{Math.abs(summary.totalSpent - summary.lastTotalSpent).toLocaleString()}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex h-3 w-full rounded-full overflow-hidden bg-white/5 border border-white/5">
                    {Object.entries(summary.catTotals).map(([name, amount], idx) => (
                      <div key={name} style={{ width: `${(amount / summary.totalSpent) * 100}%`, backgroundColor: getCategoryColor(idx) }} />
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                    {Object.entries(summary.catTotals).sort((a,b)=>b[1]-a[1]).map(([name, amount], idx) => (
                      <div key={name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: getCategoryColor(idx) }} />
                          <span className="text-[11px] font-bold text-zinc-400 truncate">{name}</span>
                        </div>
                        <span className="text-[11px] font-black text-zinc-200 tabular-nums">¥{amount.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </SimpleCard>

              <div className="space-y-4">
                <h3 className="text-xs font-black text-zinc-500 uppercase tracking-widest pl-1">Category Budget</h3>
                <div className="grid grid-cols-1 gap-3">
                  {activeCategories.map(n => {
                    const c = summary.catTotals[n] || 0; const b = monthlyData.catBudgets?.[n] || 0;
                    const percent = b > 0 ? Math.min(100, (c/b)*100) : 0;
                    return (
                      <SimpleCard key={n} className="p-4">
                        <div className="flex justify-between items-center mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{getCategoryIcon(n)}</span>
                            <span className="text-xs font-black text-white">{n}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-black text-white">¥{c.toLocaleString()}</span>
                            <span className="text-[10px] font-bold text-zinc-500 ml-1">/ ¥{b.toLocaleString()}</span>
                          </div>
                        </div>
                        <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                          <div className={`h-full transition-all duration-1000 ${c > b && b > 0 ? 'bg-red-500' : 'bg-white'}`} style={{ width: `${percent}%` }} />
                        </div>
                      </SimpleCard>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-6 animate-in fade-in duration-500 pb-20">
              {settingTab === 'menu' ? (
                <div className="space-y-6">
                  <div className="flex items-center justify-between p-6 bg-white/5 rounded-[2rem] border border-white/5">
                    <div className="flex items-center gap-4">
                      {user.photoURL ? <img src={user.photoURL} alt="" className="w-12 h-12 rounded-2xl border border-white/10" /> : <div className="w-12 h-12 rounded-2xl bg-zinc-800 flex items-center justify-center text-zinc-500"><User size={24}/></div>}
                      <div>
                        <div className="text-sm font-black text-white">{user.displayName || 'User'}</div>
                        <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">{user.email}</div>
                      </div>
                    </div>
                    <button onClick={() => signOut(auth)} className="p-3 text-zinc-500 hover:text-red-400 transition-colors"><LogOut size={20} /></button>
                  </div>
                  <div className="space-y-2">
                    {SETTING_MENU_ITEMS.map(item => (
                      <SettingsRow key={item.id} onClick={() => setSettingTab(item.id)} left={<div className="flex items-center gap-4">{item.icon}<span className="text-sm font-black">{item.label}</span></div>} showChevron={true} />
                    ))}
                  </div>
                  <div className="flex flex-col items-center gap-6 pt-6">
                    <button onClick={() => setIsCopyModalOpen(true)} className="px-8 py-4 bg-[#1E1E1E] border border-white/10 text-zinc-200 rounded-2xl text-xs font-black shadow-lg active:scale-95 transition-all"><CopyCheck className="inline mr-2" size={16}/> 先月の設定をコピー</button>
                    <button onClick={handleExportCSV} className="text-zinc-600 text-[10px] font-black underline uppercase tracking-widest">Export CSV Data</button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* --- 各設定の詳細 --- */}
                  {settingTab === 'faq' && (
                    <div className="space-y-6">
                      <div className="relative"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={16}/><input value={faqSearchText} onChange={e=>setFaqSearchText(e.target.value)} placeholder="検索..." className="w-full h-14 bg-white/5 rounded-2xl pl-12 pr-4 text-sm font-bold focus:outline-none"/></div>
                      {filteredFaqData.map((sec, sIdx) => (
                        <div key={sIdx} className="space-y-3">
                          <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] pl-2">{sec.category}</h3>
                          <div className="space-y-2">
                            {sec.items.map((item, idx) => (
                              <SimpleCard key={idx} className="p-0 overflow-hidden">
                                <button onClick={() => setExpandedFaq(expandedFaq === `${sIdx}-${idx}` ? null : `${sIdx}-${idx}`)} className="w-full p-5 text-left flex justify-between items-start gap-4">
                                  <span className="text-[13px] font-black text-zinc-200 leading-tight">{item.q}</span>
                                  <ChevronDown size={18} className={`shrink-0 text-zinc-600 transition-transform ${expandedFaq === `${sIdx}-${idx}` ? 'rotate-180' : ''}`} />
                                </button>
                                {expandedFaq === `${sIdx}-${idx}` && <div className="px-5 pb-5 text-xs text-zinc-500 leading-relaxed font-medium whitespace-pre-wrap border-t border-white/5 pt-4">{item.a}</div>}
                              </SimpleCard>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {settingTab === 'budget' && (
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest pl-2">資金計画</h3>
                        <SimpleCard className="divide-y divide-white/5">
                          <SettingsRow onClick={()=>openEdit('salary',{value:monthlyData.salary},0)} left="手取り給与" right={`¥${Number(monthlyData.salary).toLocaleString()}`} />
                          <SettingsRow onClick={()=>openEdit('totalBudget',{value:monthlyData.budget},0)} left="クレジットカード利用目安" right={`¥${Number(monthlyData.budget).toLocaleString()}`} />
                          <SettingsRow onClick={()=>openEdit('cashBudget',{value:monthlyData.cashBudget},0)} left="月初のスタート現金" right={`¥${Number(monthlyData.cashBudget).toLocaleString()}`} />
                          <SettingsRow onClick={()=>openEdit('savings',{value:monthlyData.savings},0)} left="今月の積立額" right={`¥${Number(monthlyData.savings).toLocaleString()}`} />
                        </SimpleCard>
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest pl-2">引落予定のカード</h3>
                        <SimpleCard className="divide-y divide-white/5">
                          {config.paymentMethods.filter(m=>m!==CASH).map(m => (
                            <SettingsRow key={m} onClick={()=>openEdit('bill',{name:m, bill:monthlyData.cardBills?.[m]||0, due:monthlyData.cardDueDates?.[m]||''},0)} left={m} right={`¥${Number(monthlyData.cardBills?.[m]||0).toLocaleString()} (${monthlyData.cardDueDates?.[m]||'-'}日)`} />
                          ))}
                        </SimpleCard>
                      </div>
                    </div>
                  )}

                  {settingTab === 'fixed' && (
                    <div className="space-y-4">
                      <button onClick={()=>openEdit('fixed',{name:'',amount:'',method:CASH},-1)} className="w-full h-16 bg-white text-black rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-xl active:scale-[0.98] transition-all"><Plus size={20}/>固定費を追加</button>
                      <div className="space-y-2">
                        {monthlyData.fixedCosts.map((f, i) => (
                          <SimpleCard key={i} onClick={()=>openEdit('fixed',f,i)} className="p-5 flex justify-between items-center active:bg-white/5 transition-colors cursor-pointer">
                            <div className="flex items-center gap-4">
                              <div className="px-2 py-1 bg-white/5 rounded text-[10px] font-black text-zinc-500">{f.method}</div>
                              <div className="text-sm font-black text-white">{f.name}</div>
                            </div>
                            <div className="text-sm font-black text-white tabular-nums">¥{Number(f.amount).toLocaleString()}</div>
                          </SimpleCard>
                        ))}
                      </div>
                    </div>
                  )}

                  {settingTab === 'category' && (
                    <div className="space-y-4">
                      <button onClick={()=>openEdit('category',{name:'',icon:'🏷',budget:''},-1)} className="w-full h-16 bg-white text-black rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-xl active:scale-[0.98] transition-all"><Plus size={20}/>カテゴリを追加</button>
                      <div className="space-y-2">
                        {config.categories.map((c, i) => (
                          <SimpleCard key={i} onClick={()=>openEdit('category',{...c, budget:monthlyData.catBudgets?.[c.name]||0},i)} className="p-5 flex justify-between items-center active:bg-white/5 transition-colors cursor-pointer">
                            <div className="flex items-center gap-4"><span className="text-xl">{c.icon}</span><span className="text-sm font-black text-white">{c.name}</span></div>
                            <div className="text-sm font-black text-white tabular-nums">¥{Number(monthlyData.catBudgets?.[c.name]||0).toLocaleString()}</div>
                          </SimpleCard>
                        ))}
                      </div>
                    </div>
                  )}

                  {settingTab === 'template' && (
                    <div className="space-y-4">
                      <button onClick={()=>openEdit('template',{title:'',amount:'',category:getCategoryNames()[0],method:CASH},-1)} className="w-full h-16 bg-white text-black rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-xl active:scale-[0.98] transition-all"><Plus size={20}/>テンプレートを追加</button>
                      <div className="space-y-2">
                        {config.templates.map((t, i) => (
                          <SimpleCard key={i} onClick={()=>openEdit('template',t,i)} className="p-5 flex justify-between items-center active:bg-white/5 transition-colors cursor-pointer">
                            <div className="text-left"><div className="text-sm font-black text-white mb-1">{t.title}</div><div className="text-[10px] font-bold text-zinc-500">{t.category} • {t.method}</div></div>
                            <div className="text-sm font-black text-white tabular-nums">¥{Number(t.amount).toLocaleString()}</div>
                          </SimpleCard>
                        ))}
                      </div>
                    </div>
                  )}

                  {settingTab === 'payment' && (
                    <div className="space-y-4">
                      <button onClick={()=>openEdit('payment',{name:''},-1)} className="w-full h-16 bg-white text-black rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-xl active:scale-[0.98] transition-all"><Plus size={20}/>支払方法を追加</button>
                      <div className="space-y-2">
                        {config.paymentMethods.map((m, i) => (
                          <SimpleCard key={i} onClick={()=>openEdit('payment',{name:m},i)} className="p-5 flex justify-between items-center active:bg-white/5 transition-colors cursor-pointer">
                            <span className="text-sm font-black text-white">{m}</span><ChevronRight size={16} className="text-zinc-700"/>
                          </SimpleCard>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </main>

        {/* --- BOTTOM TAB BAR --- */}
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#121212]/90 backdrop-blur-2xl border-t border-white/5 pb-8 pt-4">
          <div className="max-w-2xl mx-auto flex items-center justify-around px-4">
            <NavButton active={activeTab === 'home'} onClick={() => setActiveTab('home')} icon={<Home size={24} />} />
            <NavButton active={activeTab === 'log'} onClick={() => setActiveTab('log')} icon={<History size={24} />} />
            <button onClick={openTxModalNew} className="w-16 h-16 bg-white text-black rounded-[1.75rem] flex items-center justify-center shadow-[0_20px_50px_rgba(255,255,255,0.2)] active:scale-90 transition-all">
              <Plus size={32} />
            </button>
            <NavButton active={activeTab === 'analysis'} onClick={() => setActiveTab('analysis')} icon={<BarChart3 size={24} />} />
            <NavButton active={activeTab === 'settings'} onClick={() => { setActiveTab('settings'); setSettingTab('menu'); }} icon={<Settings size={24} />} />
          </div>
        </div>

        {/* --- MODALS --- */}
        {isTxModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4 bg-black/90 backdrop-blur-md animate-in fade-in" onClick={()=>setIsTxModalOpen(false)}>
            <div className="w-full max-h-[95vh] sm:max-w-md bg-[#1E1E1E] rounded-t-[2.5rem] sm:rounded-[2.5rem] border border-white/10 shadow-2xl flex flex-col overflow-hidden" onClick={e=>e.stopPropagation()}>
              <div className="p-8 pb-32 overflow-y-auto space-y-8">
                <div className="flex justify-between items-center mb-4"><h2 className="text-xl font-black text-white tracking-tighter">{editingTx ? '支出を編集' : '支出を入力'}</h2><button onClick={()=>setIsTxModalOpen(false)} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-zinc-400"><X size={20}/></button></div>
                <form onSubmit={handleTxSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Amount</label>
                    <div className="flex gap-2">
                      <div className="flex-1 h-16 bg-white/5 rounded-2xl flex items-center px-5 border border-white/5 focus-within:border-white/20 transition-all">
                        <span className="text-xl font-black text-zinc-500 mr-2">¥</span>
                        <input type="text" inputMode="decimal" value={inputAmount ? Number(inputAmount).toLocaleString() : ''} onChange={e=>{const v=e.target.value.replace(/,/g,''); if(!isNaN(v)) setInputAmount(v)}} className="flex-1 bg-transparent text-2xl font-black text-white outline-none tabular-nums" required autoFocus />
                      </div>
                      <button type="button" onClick={()=>{setCalcInitialValue(inputAmount); setCalcOnConfirm(v=>setInputAmount(String(v))); setShowCalculator(true)}} className="w-16 h-16 bg-white/5 rounded-2xl border border-white/5 flex items-center justify-center text-zinc-400 active:bg-white/10"><Calculator size={24}/></button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Description</label>
                    <input value={inputTitle} onChange={e=>setInputTitle(e.target.value)} placeholder="例: スーパーでお買い物" className="w-full h-16 bg-white/5 rounded-2xl px-5 text-sm font-black text-white border border-white/5 focus:border-white/20 outline-none" required />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Category</label>
                      <div className="relative"><select value={inputCategory} onChange={e=>setInputCategory(e.target.value)} className="w-full h-16 bg-white/5 rounded-2xl px-5 text-sm font-black text-white border border-white/5 appearance-none">{getCategoryNames().map(c=><option key={c} value={c}>{c}</option>)}</select><ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600" size={16}/></div>
                    </div>
                    <div className="space-y-2"><label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Date</label>
                      <input type="date" value={inputDate} onChange={e=>setInputDate(e.target.value)} className="w-full h-16 bg-white/5 rounded-2xl px-4 text-sm font-black text-white border border-white/5 outline-none"/>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Payment Method</label>
                    <div className="grid grid-cols-2 gap-3">
                      {paymentMethodsSafe.slice(0, 4).map(m => (
                        <button key={m} type="button" onClick={()=>setInputMethod(m)} className={`h-12 rounded-xl text-[11px] font-black transition-all ${inputMethod === m ? 'bg-white text-black shadow-lg' : 'bg-white/5 text-zinc-500 border border-white/5'}`}>{m}</button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-white/5 rounded-2xl border border-white/5">
                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-3">特別費として記録</span>
                    <button type="button" onClick={()=>setInputIsSpecial(p=>!p)} className={`w-12 h-7 rounded-full relative transition-all ${inputIsSpecial?'bg-white':'bg-zinc-800'}`}><div className={`absolute top-1 w-5 h-5 rounded-full transition-all ${inputIsSpecial?'left-6 bg-black':'left-1 bg-zinc-600'}`}/></button>
                  </div>
                  {!editingTx && config.templates.length > 0 && (
                    <div className="space-y-2"><label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Quick Templates</label>
                      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                        {config.templates.map((t, idx) => (
                          <button key={idx} type="button" onClick={()=>{setInputAmount(String(t.amount)); setInputTitle(t.title); setInputCategory(t.category); setInputMethod(t.method);}} className="shrink-0 px-4 py-3 bg-white/5 border border-white/5 rounded-xl text-[10px] font-black text-zinc-400 hover:text-white transition-all"><Zap size={10} className="inline mr-1 text-yellow-500"/> {t.title}</button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex gap-3 pt-4">
                    {editingTx && <button type="button" onClick={async ()=>{if(window.confirm('削除しますか？')){await deleteDoc(doc(db,'users',user.uid,'transactions',editingTx.id)); setIsTxModalOpen(false); showToastMsg('削除しました');}}} className="w-16 h-16 bg-red-900/20 text-red-500 rounded-2xl flex items-center justify-center active:scale-95"><Trash2 size={24}/></button>}
                    <button type="submit" className="flex-1 h-16 bg-white text-black rounded-[1.25rem] font-black text-sm shadow-xl active:scale-[0.98] transition-all">支出を保存する</button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {showCalculator && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-6 bg-black/95 backdrop-blur-xl animate-in zoom-in-95" onClick={()=>setShowCalculator(false)}>
            <div className="w-full max-w-xs" onClick={e=>e.stopPropagation()}><CalculatorPad initialValue={calcInitialValue} onConfirm={v=>{calcOnConfirm(v); setShowCalculator(false)}} /></div>
          </div>
        )}

        {isMemoModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4 bg-black/90 backdrop-blur-md animate-in fade-in" onClick={()=>setIsMemoModalOpen(false)}>
            <div className="w-full sm:max-w-md bg-[#1E1E1E] rounded-t-[2.5rem] border border-white/10 shadow-2xl p-8" onClick={e=>e.stopPropagation()}>
              <div className="flex justify-between items-center mb-6"><h2 className="text-xl font-black text-white tracking-tighter">月次メモ</h2><button onClick={()=>setIsMemoModalOpen(false)} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-zinc-400"><X size={20}/></button></div>
              <textarea value={memoText} onChange={e=>setMemoText(e.target.value)} placeholder="今月の振り返りや、来月の目標などを自由に書き込めます。" className="w-full h-48 bg-white/5 rounded-3xl p-5 text-sm font-medium text-zinc-200 border border-white/5 outline-none focus:border-white/20 transition-all resize-none mb-6 leading-relaxed" autoFocus />
              <button onClick={handleMemoSave} className="w-full h-16 bg-white text-black rounded-2xl font-black text-sm shadow-xl active:scale-95 transition-all">メモを保存する</button>
            </div>
          </div>
        )}

        {isCopyModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4 bg-black/90 backdrop-blur-md animate-in fade-in" onClick={()=>setIsCopyModalOpen(false)}>
            <div className="w-full sm:max-w-md bg-[#1E1E1E] rounded-t-[2.5rem] border border-white/10 shadow-2xl p-8" onClick={e=>e.stopPropagation()}>
              <div className="flex justify-between items-center mb-8"><h2 className="text-xl font-black text-white tracking-tighter">設定をコピー</h2><button onClick={()=>setIsCopyModalOpen(false)} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-zinc-400"><X size={20}/></button></div>
              <div className="space-y-4 mb-8">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Copy Source Month</label>
                <input type="month" value={copySourceMonth} onChange={e=>setCopySourceMonth(e.target.value)} className="w-full h-16 bg-white/5 rounded-2xl px-5 text-sm font-black text-white border border-white/5 outline-none" />
                <p className="text-[10px] text-zinc-500 font-medium px-2 leading-relaxed">指定した月の「予算目安・固定費・カテゴリ予算・カード引落設定」を今月に引き継ぎます。</p>
              </div>
              <div className="flex gap-3"><button onClick={()=>setIsCopyModalOpen(false)} className="flex-1 h-16 bg-white/5 text-zinc-400 rounded-2xl font-black text-sm">キャンセル</button><button onClick={copySettingsFromSelectedMonth} className="flex-1 h-16 bg-white text-black rounded-2xl font-black text-sm shadow-xl active:scale-95 transition-all">実行する</button></div>
            </div>
          </div>
        )}

        {editingItem && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4 bg-black/90 backdrop-blur-md animate-in fade-in" onClick={()=>setEditingItem(null)}>
            <div className="w-full max-h-[95vh] sm:max-w-md bg-[#1E1E1E] rounded-t-[2.5rem] sm:rounded-[2.5rem] border border-white/10 shadow-2xl flex flex-col overflow-hidden" onClick={e=>e.stopPropagation()}>
              <div className="p-8 pb-32 overflow-y-auto space-y-6">
                <div className="flex justify-between items-center mb-2"><h2 className="text-xl font-black text-white tracking-tighter">編集する</h2><button onClick={()=>setEditingItem(null)} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-zinc-400"><X size={20}/></button></div>
                
                {['salary','totalBudget','cashBudget','savings'].includes(editingItem.type) && (
                  <div className="space-y-4"><label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">{editingItem.type==='salary'?'手取り給与':editingItem.type==='totalBudget'?'クレカ利用目安':editingItem.type==='cashBudget'?'月初のスタート現金':'今月の積立額'}</label>
                    <div className="flex gap-2"><div className="flex-1 h-16 bg-white/5 rounded-2xl flex items-center px-5 border border-white/5"><span className="text-xl font-black text-zinc-500 mr-2">¥</span><input type="text" inputMode="decimal" value={String(editingItem.data.value??'')} onChange={e=>setEditingItem({...editingItem,data:{value:e.target.value}})} className="flex-1 bg-transparent text-2xl font-black text-white outline-none tabular-nums" /></div><button onClick={()=>{setCalcInitialValue(editingItem.data.value??0); setCalcOnConfirm(v=>setEditingItem(p=>({...p,data:{value:String(v)}}))); setShowCalculator(true);}} className="w-16 h-16 bg-white/5 rounded-2xl border border-white/5 flex items-center justify-center text-zinc-400"><Calculator size={24}/></button></div>
                  </div>
                )}

                {editingItem.type==='bill' && (
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 p-4 bg-white/5 rounded-2xl border border-white/5"><CreditCard size={20} className="text-zinc-500"/><span className="text-sm font-black text-white">{editingItem.data.name}</span></div>
                    <div className="space-y-4"><label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">引落予定額</label>
                      <div className="flex gap-2"><div className="flex-1 h-16 bg-white/5 rounded-2xl flex items-center px-5 border border-white/5"><span className="text-xl font-black text-zinc-500 mr-2">¥</span><input type="text" inputMode="decimal" value={String(editingItem.data.bill??'')} onChange={e=>setEditingItem({...editingItem,data:{...editingItem.data,bill:e.target.value}})} className="flex-1 bg-transparent text-2xl font-black text-white outline-none tabular-nums" /></div><button onClick={()=>{setCalcInitialValue(editingItem.data.bill??0); setCalcOnConfirm(v=>setEditingItem(p=>({...p,data:{...p.data,bill:String(v)}}))); setShowCalculator(true);}} className="w-16 h-16 bg-white/5 rounded-2xl border border-white/5 flex items-center justify-center text-zinc-400"><Calculator size={24}/></button></div>
                    </div>
                    <div className="space-y-2"><label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">引落日</label><input type="number" value={String(editingItem.data.due??'')} onChange={e=>setEditingItem({...editingItem,data:{...editingItem.data,due:e.target.value}})} placeholder="例: 27" className="w-full h-16 bg-white/5 rounded-2xl px-5 text-sm font-black text-white border border-white/5 outline-none" /></div>
                  </div>
                )}

                {editingItem.type==='fixed' && (
                  <div className="space-y-6">
                    <div className="space-y-2"><label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Description</label><input value={editingItem.data.name||''} onChange={e=>setEditingItem({...editingItem,data:{...editingItem.data,name:e.target.value}})} className="w-full h-16 bg-white/5 rounded-2xl px-5 text-sm font-black text-white border border-white/5 outline-none"/></div>
                    <div className="space-y-2"><label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Amount</label><div className="flex gap-2"><div className="flex-1 h-16 bg-white/5 rounded-2xl flex items-center px-5 border border-white/5"><span className="text-xl font-black text-zinc-500 mr-2">¥</span><input type="text" inputMode="decimal" value={String(editingItem.data.amount??'')} onChange={e=>setEditingItem({...editingItem,data:{...editingItem.data,amount:e.target.value}})} className="flex-1 bg-transparent text-2xl font-black text-white outline-none tabular-nums"/></div><button onClick={()=>{setCalcInitialValue(editingItem.data.amount??0); setCalcOnConfirm(v=>setEditingItem(p=>({...p,data:{...p.data,amount:String(v)}}))); setShowCalculator(true);}} className="w-16 h-16 bg-white/5 rounded-2xl border border-white/5 flex items-center justify-center text-zinc-400"><Calculator size={24}/></button></div></div>
                    <div className="space-y-2"><label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Payment Method</label><select value={editingItem.data.method||''} onChange={e=>setEditingItem({...editingItem,data:{...editingItem.data,method:e.target.value}})} className="w-full h-16 bg-white/5 rounded-2xl px-5 text-sm font-black text-white border border-white/5 outline-none appearance-none">{config.paymentMethods.map(m=><option key={m} value={m}>{m}</option>)}</select></div>
                  </div>
                )}

                {editingItem.type==='category' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-4 gap-3"><div className="space-y-2 col-span-1"><label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Icon</label><input value={editingItem.data.icon||''} onChange={e=>setEditingItem({...editingItem,data:{...editingItem.data,icon:e.target.value}})} className="w-full h-16 bg-white/5 rounded-2xl text-center text-xl border border-white/5 outline-none"/></div><div className="space-y-2 col-span-3"><label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Name</label><input value={editingItem.data.name||''} onChange={e=>setEditingItem({...editingItem,data:{...editingItem.data,name:e.target.value}})} className="w-full h-16 bg-white/5 rounded-2xl px-5 text-sm font-black text-white border border-white/5 outline-none"/></div></div>
                    <div className="space-y-2"><label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Monthly Budget</label><div className="flex gap-2"><div className="flex-1 h-16 bg-white/5 rounded-2xl flex items-center px-5 border border-white/5"><span className="text-xl font-black text-zinc-500 mr-2">¥</span><input type="text" inputMode="decimal" value={editingItem.data.budget?Number(editingItem.data.budget).toLocaleString():''} onChange={e=>{const v=e.target.value.replace(/,/g,''); if(!isNaN(v)) setEditingItem({...editingItem,data:{...editingItem.data,budget:v}})}} className="flex-1 bg-transparent text-2xl font-black text-white outline-none tabular-nums"/></div><button onClick={()=>{setCalcInitialValue(editingItem.data.budget??0); setCalcOnConfirm(v=>setEditingItem(p=>({...p,data:{...p.data,budget:String(v)}}))); setShowCalculator(true);}} className="w-16 h-16 bg-white/5 rounded-2xl border border-white/5 flex items-center justify-center text-zinc-400"><Calculator size={24}/></button></div></div>
                  </div>
                )}

                {editingItem.type==='template' && (
                  <div className="space-y-6">
                    <div className="space-y-2"><label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Name</label><input value={editingItem.data.title||''} onChange={e=>setEditingItem({...editingItem,data:{...editingItem.data,title:e.target.value}})} className="w-full h-16 bg-white/5 rounded-2xl px-5 text-sm font-black text-white border border-white/5 outline-none"/></div>
                    <div className="space-y-2"><label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Default Amount</label><div className="flex gap-2"><div className="flex-1 h-16 bg-white/5 rounded-2xl flex items-center px-5 border border-white/5"><span className="text-xl font-black text-zinc-500 mr-2">¥</span><input type="text" inputMode="decimal" value={String(editingItem.data.amount??'')} onChange={e=>setEditingItem({...editingItem,data:{...editingItem.data,amount:e.target.value}})} className="flex-1 bg-transparent text-2xl font-black text-white outline-none tabular-nums"/></div><button onClick={()=>{setCalcInitialValue(editingItem.data.amount??0); setCalcOnConfirm(v=>setEditingItem(p=>({...p,data:{...p.data,amount:String(v)}}))); setShowCalculator(true);}} className="w-16 h-16 bg-white/5 rounded-2xl border border-white/5 flex items-center justify-center text-zinc-400"><Calculator size={24}/></button></div></div>
                    <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Category</label><select value={editingItem.data.category||''} onChange={e=>setEditingItem({...editingItem,data:{...editingItem.data,category:e.target.value}})} className="w-full h-16 bg-white/5 rounded-2xl px-5 text-sm font-black text-white border border-white/5 outline-none appearance-none">{getCategoryNames().map(c=><option key={c} value={c}>{c}</option>)}</select></div><div className="space-y-2"><label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Method</label><select value={editingItem.data.method||''} onChange={e=>setEditingItem({...editingItem,data:{...editingItem.data,method:e.target.value}})} className="w-full h-16 bg-white/5 rounded-2xl px-5 text-sm font-black text-white border border-white/5 outline-none appearance-none">{config.paymentMethods.map(m=><option key={m} value={m}>{m}</option>)}</select></div></div>
                  </div>
                )}

                {editingItem.type==='payment' && (
                  <div className="space-y-4"><label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Method Name</label><input value={editingItem.data.name||''} onChange={e=>setEditingItem({...editingItem,data:{name:e.target.value}})} className="w-full h-16 bg-white/5 rounded-2xl px-5 text-sm font-black text-white border border-white/5 outline-none" autoFocus /></div>
                )}

                <div className="flex gap-4 pt-8">
                  {editingItem.index!==-1 && !['salary','totalBudget','cashBudget','savings','bill','memo'].includes(editingItem.type) && (
                    <button onClick={handleDeleteItem} className="w-16 h-16 bg-red-900/20 text-red-500 rounded-2xl flex items-center justify-center active:scale-95 transition-all shadow-inner"><Trash2 size={24}/></button>
                  )}
                  <button onClick={handleSettingsSave} className="flex-1 h-16 bg-white text-black rounded-[1.25rem] font-black text-sm shadow-xl active:scale-[0.98] transition-all">変更を保存する</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}

// カレンダー表示用コンポーネント
const CalendarView = ({ transactions, onDateClick }) => {
  const d = new Date();
  const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const firstDay = new Date(d.getFullYear(), d.getMonth(), 1).getDay();
  const days = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const dailyTotals = transactions.reduce((acc, t) => {
    const day = new Date(t.date).getDate(); acc[day] = (acc[day] || 0) + Number(t.amount); return acc;
  }, {});
  return (
    <div className="grid grid-cols-7 gap-2">
      {['日','月','火','水','木','金','土'].map(day => <div key={day} className="text-center text-[10px] font-black text-zinc-600 mb-2 uppercase">{day}</div>)}
      {days.map((day, i) => {
        if(!day) return <div key={i} />;
        const total = dailyTotals[day] || 0;
        const isToday = day === new Date().getDate();
        return (
          <button key={i} onClick={() => onDateClick(`${getMonthString(new Date())}-${String(day).padStart(2,'0')}`)} className={`aspect-square rounded-2xl border flex flex-col items-center justify-center gap-1 transition-all active:scale-90 ${isToday ? 'bg-white border-white' : 'bg-[#1E1E1E] border-white/5'}`}>
            <span className={`text-[11px] font-black ${isToday ? 'text-black' : 'text-zinc-500'}`}>{day}</span>
            {total > 0 && <span className={`text-[8px] font-black tabular-nums ${isToday ? 'text-black/60' : 'text-zinc-300'}`}>¥{(total/1000).toFixed(0)}k</span>}
          </button>
        );
      })}
    </div>
  );
};

export default function AppWrapper() { return <AppMain />; }

