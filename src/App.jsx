import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, onSnapshot, query, deleteDoc, serverTimestamp, where, updateDoc, writeBatch, getDocs, getDoc, orderBy } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth';
import { Wallet, CreditCard, Landmark, Plus, Settings, Trash2, History, ChevronLeft, ChevronRight, X, Tags, ArrowLeft, CopyCheck, Calendar, CheckCircle2, BarChart3, TrendingDown, TrendingUp, Banknote, LayoutGrid, ListChecks, Search, CalendarDays, AlignJustify, Zap, Calculator, Delete, LogOut, Lock, User, FileText, ArrowUp, ArrowDown, Home, Sparkles } from 'lucide-react';

/* --- FIREBASE CONFIG --- */
const firebaseConfig = {
  apiKey: "AIzaSyD_MMX3Irb-xN1Tql5L0kWJo6BoO_rFX7g",
  authDomain: "zaimu-4f79b.firebaseapp.com",
  projectId: "zaimu-4f79b",
  storageBucket: "zaimu-4f79b.firebasestorage.app",
  messagingSenderId: "388166181792",
  appId: "1:388166181792:web:d3ccef2742dca358d3bac5"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

/* --- UTILS --- */
const CASH = '現金';

const getMonthString = (date) => date.toISOString().slice(0, 7);
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
  if (!val) return 0;
  const num = Number(String(val).replace(/,/g, ''));
  return isNaN(num) ? 0 : num;
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
  static getDerivedStateFromError(error) {
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
          <button onClick={() => window.location.reload()} className="px-6 py-3 bg-white text-black rounded-full font-bold text-sm uppercase">再読み込み</button>
        </div>
      );
    }
    return this.props.children;
  }
}

const SimpleCard = ({ children, className = "", onClick }) => (
  <div onClick={onClick} className={`bg-[#1E1E1E] rounded-lg border border-white/5 shadow-lg overflow-hidden w-full box-border ${className}`}>
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

// Calculator Logic
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
  } catch (e) { return 'Error'; }
};

const CalculatorPad = ({ initialValue, onConfirm }) => {
  const [display, setDisplay] = useState(String(initialValue || '0'));
  const [isResult, setIsResult] = useState(false);
  const handlePush = (val) => {
    if (isResult && !['+','-','*','/'].includes(val)) { setDisplay(String(val)); setIsResult(false); } 
    else { setDisplay(prev => (prev === '0' && !['+','-','*','/','.'] .includes(val)) ? String(val) : prev + val); setIsResult(false); }
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
      <div className="bg-black/40 rounded-lg p-3 text-right border border-white/5 font-mono text-2xl text-white break-all">{display}</div>
      <div className="grid grid-cols-4 gap-2 h-64">
        {btns.map((b, i) => (
          <button key={i} type="button" onClick={b.act} className={`rounded-lg bg-zinc-800 border border-white/5 text-lg font-bold active:scale-95 transition-all flex items-center justify-center ${b.style || 'text-white'}`}>{b.l}</button>
        ))}
      </div>
      <button onClick={() => onConfirm(toNumber(display))} className="w-full h-12 bg-white text-black rounded-lg font-bold uppercase tracking-widest active:scale-95 shadow-lg">決定</button>
    </div>
  );
};

/* --- SETTINGS ROW ITEM --- */
const SettingsRow = ({ left, right, onClick }) => (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center justify-between px-4 py-4 active:bg-white/5 text-zinc-300 transition-colors"
    >
      <div className="flex items-center gap-3 text-left">
        {left}
      </div>
      {/* 矢印は削除（rightがある場合のみ表示） */}
      {right ? <div className="text-[11px] text-zinc-500">{right}</div> : <div />}
    </button>
);

/* --- MAIN APP LOGIC --- */
function AppMain() {
  const [user, setUser] = useState(null); 
  const [authLoading, setAuthLoading] = useState(true); 
  const [loading, setLoading] = useState(true); 
  const [activeTab, setActiveTab] = useState('home');
  const [homeView, setHomeView] = useState('spending');
  const [logView, setLogView] = useState('list');
  const [settingTab, setSettingTab] = useState('menu');
  const [month, setMonth] = useState(getMonthString(new Date()));
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: '' });

  const [inputDate, setInputDate] = useState(getTodayString()); 
  const [inputAmount, setInputAmount] = useState(''); 
  const [inputTitle, setInputTitle] = useState('');
  const [inputCategory, setInputCategory] = useState('');
  const [inputMethod, setInputMethod] = useState('');
  const [editingItem, setEditingItem] = useState(null); 
  const [editingTx, setEditingTx] = useState(null);

  const [transactions, setTransactions] = useState([]);
  const [lastMonthTransactions, setLastMonthTransactions] = useState([]);
  const [monthlyData, setMonthlyData] = useState(normalizeMonthlyData({}));
  const [cashBalance, setCashBalance] = useState(0);
  const [config, setConfig] = useState(normalizeConfig({}));

  const [searchText, setSearchText] = useState('');
  const [filter, setFilter] = useState({ category: 'ALL', method: 'ALL' });
  const mainRef = useRef(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const start = new Date(`${month}-01T00:00:00`).toISOString();
    const nextDate = new Date(`${month}-01`);
    nextDate.setMonth(nextDate.getMonth() + 1);
    const end = nextDate.toISOString();

    const unsub = onSnapshot(query(collection(db, 'users', user.uid, 'transactions'), where('date', '>=', start), where('date', '<', end)), (s) => {
      setTransactions(s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => new Date(b.date) - new Date(a.date)));
      setLoading(false);
    });
    return () => unsub();
  }, [month, user]);

  useEffect(() => {
    if (!user) return;
    const prevDate = new Date(`${month}-01`);
    prevDate.setMonth(prevDate.getMonth() - 1);
    const prevStart = new Date(getMonthString(prevDate)+"-01T00:00:00").toISOString();
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
    return onSnapshot(doc(db, 'users', user.uid, 'months', month), (s) => {
      setMonthlyData(normalizeMonthlyData(s.exists() ? s.data() : {}));
    });
  }, [month, user]);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(doc(db, 'users', user.uid, 'wallet', 'cash'), (s) => { 
      if(s.exists()) setCashBalance(s.data().balance); 
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(doc(db, 'users', user.uid, 'settings', 'config'), (s) => { 
      setConfig(normalizeConfig(s.exists() ? s.data() : {}));
    });
  }, [user]);

  const summary = useMemo(() => {
    const fixedCosts = monthlyData.fixedCosts || [];
    const fixedCashTotal = fixedCosts.filter(f => !f.method || f.method === CASH).reduce((s, i) => s + (Number(i.amount)||0), 0);
    const fixedCardTotal = fixedCosts.filter(f => f.method && f.method !== CASH).reduce((s, i) => s + (Number(i.amount)||0), 0);
    const fixedTotal = fixedCashTotal + fixedCardTotal;

    const totalBudget = Number(monthlyData.budget) || 0;
    const spentCard = transactions.filter(t => t.paymentMethod !== CASH).reduce((s, t) => s + (Number(t.amount)||0), 0);
    const cardRemaining = totalBudget - fixedTotal - spentCard;

    const cashBudgetTotal = Number(monthlyData.cashBudget) || 0;
    const spentCash = transactions.filter(t => t.paymentMethod === CASH).reduce((s, t) => s + (Number(t.amount)||0), 0);
    const cashRemaining = cashBudgetTotal - spentCash;

    const billTotal = Object.values(monthlyData.cardBills || {}).reduce((s, v) => s + (Number(v) || 0), 0);
    const totalWithdrawal = fixedCashTotal + billTotal; 
    const bankBalanceProjected = (Number(monthlyData.salary) || 0) - totalWithdrawal;

    const getCatTotals = (txs) => (txs || []).reduce((acc, t) => { acc[t.category] = (acc[t.category] || 0) + t.amount; return acc; }, {});
    const catBudgetSum = (config.categories || []).reduce((sum, c) => sum + (monthlyData.catBudgets?.[c.name] || 0), 0);

    const now = new Date();
    const isCurrentMonth = month === getMonthString(now);
    const daysLeft = isCurrentMonth ? Math.max(1, new Date(now.getFullYear(), now.getMonth()+1, 0).getDate() - now.getDate() + 1) : 30;

    return { 
      cardRemaining, cashRemaining, cardBudget: totalBudget, cashBudget: cashBudgetTotal, bankBalanceProjected, 
      fixedTotal, totalWithdrawal, catBudgetSum,
      cardRemainingPercent: (totalBudget - fixedTotal) > 0 ? Math.round((cardRemaining / (totalBudget - fixedTotal)) * 100) : 0,
      cashRemainingPercent: cashBudgetTotal > 0 ? Math.round((cashRemaining / cashBudgetTotal) * 100) : 0,
      dailyBudget: daysLeft > 0 ? Math.floor(cardRemaining / daysLeft) : 0, daysLeft,
      catTotals: getCatTotals(transactions), lastCatTotals: getCatTotals(lastMonthTransactions),
      totalSpent: transactions.reduce((s,t)=>s+t.amount,0), lastTotalSpent: lastMonthTransactions.reduce((s,t)=>s+t.amount,0),
      dailyTotals: transactions.reduce((acc,t)=>{acc[new Date(t.date).getDate()] = (acc[new Date(t.date).getDate()]||0)+t.amount; return acc;}, {})
    };
  }, [monthlyData, transactions, lastMonthTransactions, month, config]);

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
    const confirmed = monthlyData.confirmedPayments || [];
    if (!confirmed.includes(cardName)) {
      await setDoc(doc(db, 'users', user.uid, 'months', month), { confirmedPayments: [...confirmed, cardName] }, { merge: true });
      showToastMsg('支払いを完了しました');
    }
  };

  const showToastMsg = (msg) => { setToast({ visible: true, message: msg }); setTimeout(() => setToast({ visible: false, message: '' }), 3000); };
  const getCategoryIcon = (n) => { const c = (config.categories || []).find(x => x.name === n); return c?.icon || '🏷'; };
  const getCategoryNames = () => (config.categories || []).map(c => c.name);

  // FIX: Safe Handlers & Array Ops
  const handleSettingsSave = async () => {
    if(!editingItem) return;
    const { type, data, index } = editingItem;
    if (type === 'category') {
        const newCats = [...(config.categories || [])];
        if (index === -1) newCats.push({ name: data.name, icon: data.icon }); else newCats[index] = { name: data.name, icon: data.icon };
        await setDoc(doc(db,'users',user.uid,'settings','config'),{...config, categories: newCats});
        if (data.budget) await setDoc(doc(db,'users',user.uid,'months',month), { catBudgets: { ...(monthlyData.catBudgets || {}), [data.name]: toNumber(data.budget) } }, { merge: true });
    } else if (type === 'fixed') {
        const newFixed = [...(monthlyData.fixedCosts || [])];
        if (index === -1) newFixed.push({ id: Date.now(), ...data, amount: toNumber(data.amount) }); else newFixed[index] = { ...data, amount: toNumber(data.amount) };
        await setDoc(doc(db,'users',user.uid,'months',month),{fixedCosts: newFixed},{merge:true});
    } else if (type === 'template') {
        const t = [...(config.templates || [])];
        if (index === -1) t.push({ ...data, amount: toNumber(data.amount) }); else t[index] = { ...data, amount: toNumber(data.amount) };
        await setDoc(doc(db,'users',user.uid,'settings','config'),{...config, templates: t});
    } else if (type === 'payment') {
        const p = [...(config.paymentMethods || ['現金'])];
        if (index === -1) p.push(data.name); else p[index] = data.name;
        await setDoc(doc(db,'users',user.uid,'settings','config'),{...config, paymentMethods: p});
    }
    setEditingItem(null); showToastMsg('保存しました');
  };

  const handleDeleteItem = async () => {
    if (!editingItem || !window.confirm('削除しますか？')) return;
    const { type, index } = editingItem;
    if (type === 'fixed') { await setDoc(doc(db,'users',user.uid,'months',month),{fixedCosts:(monthlyData.fixedCosts || []).filter((_, i) => i !== index)},{merge:true}); }
    else if (type === 'category') { await setDoc(doc(db,'users',user.uid,'settings','config'),{...config,categories:(config.categories || []).filter((_, i) => i !== index)}); }
    else if (type === 'template') { await setDoc(doc(db,'users',user.uid,'settings','config'),{...config, templates: (config.templates || []).filter((_, i) => i !== index)}); }
    else if (type === 'payment') { await setDoc(doc(db,'users',user.uid,'settings','config'),{...config,paymentMethods:(config.paymentMethods || []).filter((_, i) => i !== index)}); }
    setEditingItem(null); showToastMsg('削除しました');
  };

  const startEditing = (t) => {
    setEditingTx(t); setInputDate(t.date.split('T')[0]); setInputAmount(String(t.amount)); setInputTitle(t.title); setInputCategory(t.category); setInputMethod(t.paymentMethod); setIsModalOpen(true);
  };
  const openModalWithDate = (dateStr) => {
    setEditingTx(null); setInputDate(dateStr); setInputAmount(''); setInputTitle(''); setInputCategory(getCategoryNames()[0] || '食費'); setInputMethod(config.paymentMethods[0] || CASH); setShowCalculator(false); setIsModalOpen(true);
  };
  const applyTemplate = (tpl) => { setInputAmount(String(tpl.amount)); setInputTitle(tpl.title); setInputCategory(tpl.category); setInputMethod(tpl.method); };

  const finalFilteredTx = transactions.filter(t => {
      const matchSearch = searchText === '' || t.title.includes(searchText);
      const matchCat = filter.category === 'ALL' || t.category === filter.category;
      const matchMethod = filter.method === 'ALL' || t.paymentMethod === filter.method;
      return matchSearch && matchCat && matchMethod;
  });

  const calendarDaysList = (() => {
    if(!month) return [];
    const d = new Date(month + "-01");
    const first = d.getDay();
    const last = new Date(d.getFullYear(), d.getMonth()+1, 0).getDate();
    return [...Array(first).fill(null), ...Array.from({length:last}, (_,i)=>i+1)];
  })();

  const copyLastMonthSettings = async () => {
    if(!user || !window.confirm('先月の設定をコピーしますか？')) return;
    const d = new Date(month + "-01"); d.setMonth(d.getMonth() - 1);
    const lastMonthStr = getMonthString(d);
    try {
        const snap = await getDoc(doc(db, 'users', user.uid, 'months', lastMonthStr));
        if (snap.exists()) {
            const d = snap.data();
            await setDoc(doc(db, 'users', user.uid, 'months', month), {
                budget: d.budget || 0, cashBudget: d.cashBudget || 0,
                fixedCosts: d.fixedCosts || [], catBudgets: d.catBudgets || {},
                cardBills: d.cardBills || {}, cardDueDates: d.cardDueDates || {}
            }, { merge: true });
            showToastMsg('コピーしました');
        } else {
            showToastMsg('先月のデータがありません');
        }
    } catch (e) { console.error(e); showToastMsg('エラーが発生しました'); }
  };

  const handleExportCSV = async () => {
      if(!window.confirm('全データをCSV出力しますか？')) return;
      try {
          const q = query(collection(db, 'users', user.uid, 'transactions'), orderBy('date', 'desc'));
          const s = await getDocs(q);
          let csv = "\uFEFF日付,タイトル,カテゴリ,金額,支払方法\n";
          s.forEach(doc => {
              const d = doc.data();
              csv += `${d.date.split('T')[0]},"${d.title.replace(/"/g,'""')}",${d.category},${d.amount},${d.paymentMethod}\n`;
          });
          const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `zaimu_export_${getTodayString()}.csv`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
      } catch(e) { console.error(e); showToastMsg('エラーが発生しました'); }
  };

  const handleMoveCategory = async (index, direction, e) => {
      e.stopPropagation();
      const newCats = [...(config.categories || [])];
      if (direction === 'up' && index > 0) [newCats[index], newCats[index-1]] = [newCats[index-1], newCats[index]];
      else if (direction === 'down' && index < newCats.length-1) [newCats[index], newCats[index+1]] = [newCats[index+1], newCats[index]];
      else return;
      setConfig({ ...config, categories: newCats });
      await setDoc(doc(db,'users',user.uid,'settings','config'),{ ...config, categories: newCats }, { merge: true });
  };

  if (authLoading) return <div className="h-screen bg-[#121212] flex items-center justify-center text-zinc-600 font-bold uppercase">Loading Auth...</div>;
  if (!user) return (
    <div className="h-screen w-full bg-[#121212] flex flex-col items-center justify-center p-6 space-y-8 animate-in fade-in">
      <div className="text-center"><h1 className="text-4xl font-black text-white uppercase tracking-tighter">ZAIMU</h1></div>
      <button onClick={() => signInWithPopup(auth, new GoogleAuthProvider())} className="w-full max-w-xs h-14 bg-white text-black rounded-full font-bold uppercase flex items-center justify-center gap-3"><Lock size={18} /> Google Login</button>
    </div>
  );

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
            <><button onClick={() => setSettingTab('menu')} className="text-zinc-400"><ArrowLeft size={24}/></button>
            <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center">
                <span className="text-xs font-bold text-white uppercase">{currentSettingTitle}</span>
                {(settingTab === 'fixed' || settingTab === 'category') && (
                    <span className="text-[10px] text-zinc-500 font-mono">計 ¥{(settingTab==='fixed' ? summary.fixedTotal : summary.catBudgetSum).toLocaleString()}</span>
                )}
            </div><div className="w-6"/></>
          ) : (
            <><div className="w-8 h-8 rounded-xl bg-white/5 p-1"><img src="/favicon.ico" referrerPolicy="no-referrer" alt="logo" className="w-full h-full" /></div>
            <div className="flex items-center gap-4"><button onClick={()=>{const d=new Date(month+"-01");d.setMonth(d.getMonth()-1);setMonth(getMonthString(d))}}><ChevronLeft size={20}/></button><span className="text-sm font-bold text-white tabular-nums">{formatMonthJP(month)}</span><button onClick={()=>{const d=new Date(month+"-01");d.setMonth(d.getMonth()+1);setMonth(getMonthString(d))}}><ChevronRight size={20}/></button></div>
            <button onClick={()=>setMonth(getMonthString(new Date()))} className="text-zinc-500 active:text-white"><Calendar size={20}/></button></>
          )}
        </header>

        <main ref={mainRef} className="flex-1 overflow-y-auto scrollbar-hide pt-4">
          <div className="p-4 pb-32">
            {activeTab === 'home' && (
              <div className="space-y-4 animate-in fade-in duration-300">
                <div className="bg-[#1E1E1E] p-1 rounded-xl flex gap-1 mb-2 border border-white/5">
                  <button onClick={()=>setHomeView('spending')} className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 ${homeView==='spending'?'bg-white text-black shadow-lg':'text-zinc-500'}`}><LayoutGrid size={14}/> 支出管理</button>
                  <button onClick={()=>setHomeView('forecast')} className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 ${homeView==='forecast'?'bg-white text-black shadow-lg':'text-zinc-500'}`}><ListChecks size={14}/> 収支・予定</button>
                </div>
                {homeView === 'spending' ? (
                  <div className="space-y-4 animate-in slide-in-from-left-2">
                    <SimpleCard className="p-6"><div className="flex justify-between mb-4"><div><p className="text-[10px] text-zinc-500 uppercase">今月あと使える（カード）</p><h2 className={`text-4xl font-bold mt-1 ${summary.cardRemaining<0?'text-red-400':'text-white'}`}>¥{summary.cardRemaining.toLocaleString()}</h2></div><div className="text-right text-[9px] text-zinc-600 uppercase">軍資金<p className="text-zinc-400 font-bold">¥{summary.cardBudget.toLocaleString()}</p></div></div><div className="h-1.5 bg-white/5 rounded-full overflow-hidden"><div className="h-full bg-white transition-all duration-1000" style={{width:`${summary.cardRemainingPercent}%`}}/></div></SimpleCard>
                    <SimpleCard className="p-6"><div className="flex justify-between mb-4"><div><p className="text-[10px] text-zinc-500 uppercase">今月あと使える（口座）</p><h2 className={`text-4xl font-bold mt-1 ${summary.cashRemaining < 0 ? 'text-red-400' : 'text-white'}`}>¥{summary.cashRemaining.toLocaleString()}</h2></div><div className="text-right text-[9px] text-zinc-600 uppercase">軍資金<p className="text-zinc-400 font-bold">¥{summary.cashBudget.toLocaleString()}</p></div></div><div className="h-1.5 bg-white/5 rounded-full overflow-hidden"><div className="h-full bg-zinc-500 transition-all duration-1000" style={{width:`${summary.cashRemainingPercent}%`}}/></div></SimpleCard>
                  </div>
                ) : (
                  <div className="space-y-4 animate-in slide-in-from-right-2">
                    {activeAlerts.length > 0 && (
                      <SimpleCard className="bg-red-500/10 border-red-500/30 p-4">
                        <div className="flex items-center gap-2 text-red-400 mb-2 font-bold text-xs"><Calendar size={14}/> 支払期日が迫っています</div>
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
                    <SimpleCard className="p-5 space-y-3"><div className="flex justify-between items-end"><p className="text-[10px] text-zinc-500 uppercase">口座残高見込み（引落後）</p><Banknote size={16} className="text-zinc-600"/></div><div className="flex justify-between items-center text-xs text-zinc-400">給与収入<span className="text-sm font-bold text-white">+ ¥{monthlyData.salary.toLocaleString()}</span></div><div className="flex justify-between items-center text-xs text-zinc-400">引き落とし計<span className="text-sm font-bold text-red-400">- ¥{summary.totalWithdrawal.toLocaleString()}</span></div><div className="pt-2 border-t border-white/5 flex justify-between items-end text-xs font-bold text-zinc-500">残高予想<span className="text-2xl font-black text-white">¥{summary.bankBalanceProjected.toLocaleString()}</span></div></SimpleCard>
                    {/* ✅ カテゴリ予算カード 復活 */}
                    <div className="grid grid-cols-2 gap-3">
                      {getCategoryNames().map(n => {
                        const s=summary.catTotals[n]||0; const b=monthlyData.catBudgets?.[n]||0; if(b===0) return null;
                        return (<SimpleCard key={n} className="p-3 space-y-2"><div className="flex justify-between items-center text-[9px] font-bold"> <div className="flex items-center gap-1.5"><span>{getCategoryIcon(n)}</span><span className="text-zinc-400">{n}</span></div> <span className="text-white">¥{s.toLocaleString()} / ¥{b.toLocaleString()}</span> </div><div className="h-1 bg-white/5 rounded-full overflow-hidden"><div className="h-full bg-zinc-500" style={{width:`${Math.min(100, (s/b)*100)}%`}}/></div></SimpleCard>)
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
            {activeTab === 'log' && (
              <div className="animate-in fade-in space-y-4">
                <div className="fixed top-16 left-0 right-0 z-40 bg-[#121212]/95 backdrop-blur w-full max-w-md mx-auto border-b border-white/5 px-4 py-3">
                   <div className="space-y-3">
                     <div className="flex gap-2">
                       <div className="flex-1 relative"><input type="text" value={searchText} onChange={e=>setSearchText(e.target.value)} placeholder="検索..." className="w-full h-10 bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 text-xs text-white outline-none"/><Search size={14} className="absolute left-3 top-3 text-zinc-500"/></div>
                       <div className="flex bg-[#1E1E1E] rounded-lg border border-white/10 p-0.5"><button onClick={()=>setLogView('list')} className={`p-2 rounded ${logView==='list'?'bg-white text-black':'text-zinc-500'}`}><AlignJustify size={16}/></button><button onClick={()=>setLogView('calendar')} className={`p-2 rounded ${logView==='calendar'?'bg-white text-black':'text-zinc-500'}`}><CalendarDays size={16}/></button></div>
                     </div>
                     <div className="flex gap-2">
                       <select onChange={e => setFilter({...filter, category: e.target.value})} className="bg-black/40 border border-white/10 rounded-lg px-2 h-9 text-[10px] flex-1 text-zinc-300 outline-none"><option value="ALL">全てのカテゴリ</option>{getCategoryNames().map(c => <option key={c} value={c}>{c}</option>)}</select>
                       <select onChange={e => setFilter({...filter, method: e.target.value})} className="bg-black/40 border border-white/10 rounded-lg px-2 h-9 text-[10px] flex-1 text-zinc-300 outline-none"><option value="ALL">全ての支払方法</option>{(config?.paymentMethods||[]).map(m => <option key={m} value={m}>{m}</option>)}</select>
                     </div>
                   </div>
                </div>
                <div className="pt-24">
                  {logView === 'list' ? (<SimpleCard>{finalFilteredTx.length === 0 ? <div className="py-20 flex flex-col items-center gap-3 text-zinc-600"><Sparkles size={48} className="opacity-20"/><p className="text-xs uppercase font-black">No Spending! 🎉</p></div> : <div className="divide-y divide-white/5">{finalFilteredTx.map(t=>(<div key={t.id} onClick={()=>startEditing(t)} className="flex items-center justify-between p-4 cursor-pointer active:bg-white/5 transition-colors"><div className="flex items-center gap-3 flex-1 min-w-0"><div className="w-10 font-mono text-[10px] text-zinc-500">{formatDateShort(t.date)}</div><div className="w-12 text-center text-[9px] bg-white/5 text-zinc-400 rounded py-0.5 truncate">{t.category}</div><div className="flex-1 truncate text-sm font-bold text-white">{t.title}</div></div><span className="text-sm font-bold tabular-nums text-white pl-2">¥{t.amount.toLocaleString()}</span></div>))}</div>}</SimpleCard>) : (
                    <SimpleCard className="p-4"><div className="grid grid-cols-7 gap-1 text-center mb-2 text-[10px] text-zinc-600 uppercase"> {['日','月','火','水','木','金','土'].map(d=><div key={d}>{d}</div>)} </div><div className="grid grid-cols-7 gap-1">{calendarDaysList.map((day,i)=>{if(!day)return <div key={i}/>; const a=summary.dailyTotals[day]||0; const isT=day===new Date().getDate()&&month===getMonthString(new Date()); return(<div key={i} onClick={()=>openModalWithDate(`${month}-${String(day).padStart(2,'0')}`)} className={`aspect-square rounded-lg border flex flex-col items-center justify-center relative transition-transform active:scale-95 ${isT?'border-white bg-white/10 shadow-[0_0_10px_rgba(255,255,255,0.1)]':'border-white/5 bg-black/20'}`}><span className={`text-[9px] ${isT?'text-white':'text-zinc-500'}`}>{day}</span>{a>0&&<span className="text-[8px] text-zinc-300 tabular-nums">¥{(a/1000).toFixed(1)}k</span>}{(a===0&&!isT&&new Date(month+'-'+String(day).padStart(2,'0'))<=new Date())&&<span className="absolute text-[10px]">✨</span>}</div>)})}</div></SimpleCard>)}
                </div>
              </div>
            )}
            {activeTab === 'analysis' && (
              <div className="space-y-4 animate-in fade-in">
                <SimpleCard className="p-6">
                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-4">先月との比較</p>
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <h3 className="text-4xl font-black text-white">¥{summary.totalSpent.toLocaleString()}</h3>
                      <div className={`flex items-center gap-1.5 mt-2 text-xs font-bold ${summary.totalSpent <= summary.lastTotalSpent ? 'text-green-400' : 'text-red-400'}`}>
                        {summary.totalSpent <= summary.lastTotalSpent ? <TrendingDown size={16}/> : <TrendingUp size={16}/>}
                        <span>先月より ¥{Math.abs(summary.totalSpent-summary.lastTotalSpent).toLocaleString()} {summary.totalSpent <= summary.lastTotalSpent ? '減少' : '増加'}</span>
                      </div>
                    </div>
                    <div className="text-right text-[10px] text-zinc-600 uppercase font-black">先月総支出<p className="text-sm font-bold text-zinc-500">¥{summary.lastTotalSpent.toLocaleString()}</p></div>
                  </div>
                </SimpleCard>
                <SimpleCard className="p-6 space-y-6">
                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest">カテゴリ別 比較</p>
                  <div className="space-y-6">{getCategoryNames().map(n=>{
                    const c=summary.catTotals[n]||0; const l=summary.lastCatTotals[n]||0; const max=Math.max(c,l,1);
                    return(<div key={n} className="space-y-2"><div className="flex justify-between items-center font-bold text-[10px]"><div className="flex items-center gap-2"><span className="text-sm">{getCategoryIcon(n)}</span><span className="text-zinc-300">{n}</span></div><div><span className="text-zinc-600">先月 ¥{l.toLocaleString()}</span> <span className="text-white ml-2">今月 ¥{c.toLocaleString()}</span></div></div><div className="space-y-1"><div className="h-1.5 bg-white/5 rounded-full overflow-hidden"><div className="h-full bg-zinc-500 transition-all duration-1000" style={{width:`${(c/max)*100}%`}}/></div><div className="h-1 bg-white/5 rounded-full overflow-hidden opacity-30"><div className="h-full bg-zinc-400" style={{width:`${(l/max)*100}%`}}/></div></div></div>)
                  })}</div>
                </SimpleCard>
              </div>
            )}
            {activeTab === 'settings' && (
              <div className="animate-in fade-in">
                {settingTab === 'menu' ? (
                  <div className="space-y-6 pb-10">
                    <div className="flex items-center justify-between px-2">
                        <div className="flex items-center gap-3">{user.photoURL?<img src={user.photoURL} referrerPolicy="no-referrer" alt="icon" className="w-8 h-8 rounded-full border border-white/10"/>:<div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center"><User size={16}/></div>}<span className="text-xs font-bold text-white">{user.email}</span></div>
                        <button onClick={() => { if(window.confirm('Logout?')) signOut(auth); }} className="text-zinc-500 text-[10px] flex items-center gap-1.5 active:text-white uppercase"><LogOut size={14}/> Logout</button>
                    </div>
                    <div className="bg-[#1E1E1E] rounded-xl border border-white/5 overflow-hidden"><div className="divide-y divide-white/5"> {SETTING_MENU_ITEMS.map(item=>(<button key={item.id} onClick={()=>setSettingTab(item.id)} className="w-full flex items-center justify-between p-4 active:bg-white/5 text-zinc-300 transition-colors"><div className="flex items-center gap-4">{item.icon}<span className="text-sm font-bold">{item.label}</span></div><div className="flex items-center gap-2 text-[10px] text-zinc-500 font-mono">{(item.id === 'fixed' ? `¥${summary.fixedTotal.toLocaleString()}` : item.id === 'category' ? `¥${summary.catBudgetSum.toLocaleString()}` : '')}<ChevronRight size={16} className="text-zinc-800"/></div></button>))} </div></div>
                    <div className="flex flex-col items-center gap-4 pt-4"><button onClick={copyLastMonthSettings} className="px-6 py-3 border border-white/10 text-zinc-300 rounded-full text-xs font-bold active:bg-white/5 transition-all"><CopyCheck className="inline mr-2" size={16}/> 先月の設定をコピー</button><button onClick={handleExportCSV} className="text-zinc-600 text-[10px] underline flex items-center gap-2 active:text-white"><FileText size={12}/> 全データをCSV出力</button></div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* ✅ 資金計画とカード支払いを分離し、リストUIをシンプルに */}
                    {settingTab === 'budget' && (
                        <div className="space-y-4 animate-in slide-in-from-right-2">
                            <SimpleCard className="p-5 space-y-4">
                                <p className="text-[10px] text-zinc-500 font-bold uppercase">資金計画</p>
                                <div className="space-y-3">
                                    <div className="flex flex-col gap-1"><label className="text-[9px] text-zinc-600 font-bold uppercase pl-1">手取り給与</label><input type="text" inputMode="decimal" defaultValue={monthlyData.salary?.toLocaleString()} onBlur={e=>setDoc(doc(db,'users',user.uid,'months',month),{salary:Number(e.target.value.replace(/,/g,''))},{merge:true})} className="w-full h-11 bg-black/20 border border-white/10 rounded-lg px-4 text-sm text-white font-bold tabular-nums outline-none"/></div>
                                    <div className="flex flex-col gap-1"><label className="text-[9px] text-zinc-600 font-bold uppercase pl-1">生活費予算（総枠）</label><input type="text" inputMode="decimal" defaultValue={monthlyData.budget?.toLocaleString()} onBlur={e=>setDoc(doc(db,'users',user.uid,'months',month),{budget:Number(e.target.value.replace(/,/g,''))},{merge:true})} className="w-full h-11 bg-black/20 border border-white/10 rounded-lg px-4 text-sm text-white font-bold tabular-nums outline-none"/></div>
                                    <div className="flex flex-col gap-1"><label className="text-[9px] text-zinc-600 font-bold uppercase pl-1">現金予算（口座用）</label><input type="text" inputMode="decimal" defaultValue={monthlyData.cashBudget?.toLocaleString()} onBlur={e=>setDoc(doc(db,'users',user.uid,'months',month),{cashBudget:Number(e.target.value.replace(/,/g,''))},{merge:true})} className="w-full h-11 bg-black/20 border border-white/10 rounded-lg px-4 text-sm text-white font-bold tabular-nums outline-none"/></div>
                                </div>
                            </SimpleCard>
                            <SimpleCard className="p-5 space-y-4">
                                <p className="text-[10px] text-zinc-500 font-black uppercase">カード引き落とし額設定</p> 
                                {(config?.paymentMethods||[]).filter(m=>m!=='現金').map(m=>(<div key={m} className="flex gap-2 items-center"><span className="text-[10px] text-zinc-400 w-16 truncate">{m}</span><input type="text" inputMode="decimal" defaultValue={monthlyData.cardBills?.[m]?.toLocaleString()} onBlur={e=>{const newBills={...monthlyData.cardBills,[m]:Number(e.target.value.replace(/,/g,''))}; setDoc(doc(db,'users',user.uid,'months',month),{cardBills:newBills},{merge:true})}} className="flex-1 h-10 bg-black/20 border border-white/10 rounded-lg px-3 text-xs text-white tabular-nums outline-none"/><input type="number" placeholder="日" defaultValue={monthlyData.cardDueDates?.[m]} onBlur={e=>{const newDates={...monthlyData.cardDueDates,[m]:e.target.value}; setDoc(doc(db,'users',user.uid,'months',month),{cardDueDates:newDates},{merge:true})}} className="w-10 h-10 bg-black/20 border border-white/10 rounded-lg text-xs text-center text-white outline-none"/></div>))} 
                            </SimpleCard>
                        </div>
                    )}
                    {settingTab === 'fixed' && <SimpleCard className="p-5 animate-in slide-in-from-right-2"><div className="divide-y divide-white/5">{(monthlyData.fixedCosts || []).map((f,idx)=>(<div key={idx} onClick={()=>setEditingItem({type:'fixed',data:f,index:idx})} className="flex justify-between items-center py-3 cursor-pointer"><div className="flex flex-col"><span className="text-xs text-zinc-200 font-bold">{f.name}</span><span className="text-[9px] text-zinc-500 uppercase">{f.method||'未設定'}</span></div><span className="text-sm font-bold tabular-nums text-white">¥{f.amount.toLocaleString()}</span></div>))}</div><button onClick={()=>setEditingItem({type:'fixed',data:{name:'',amount:'',method:'現金'},index:-1})} className="w-full h-11 bg-zinc-200 text-black rounded-lg mt-4 text-[10px] font-black uppercase shadow-lg active:scale-95">固定費を追加</button></SimpleCard>}
                    {settingTab === 'category' && <SimpleCard className="p-5 animate-in slide-in-from-right-2"><div className="divide-y divide-white/5">{(config?.categories || []).map((c,idx)=>{const n=c.name||c; const b=monthlyData?.catBudgets?.[n]||0; return(<div key={idx} onClick={()=>setEditingItem({type:'category',data:{name:n,icon:getCategoryIcon(n),budget:b},index:idx})} className="flex justify-between items-center py-3 cursor-pointer"><div className="flex items-center gap-3"><span className="text-xl w-8 text-center">{getCategoryIcon(n)}</span><span className="text-xs font-bold text-white">{n}</span></div><div className="flex items-center gap-2"><span className="text-[10px] text-zinc-500 font-mono">¥{b.toLocaleString()}</span><div className="flex gap-1"><button onClick={e=>{e.stopPropagation();handleMoveCategory(idx,'up',e)}} className="p-1 text-zinc-600 hover:text-white"><ArrowUp size={14}/></button><button onClick={e=>{e.stopPropagation();handleMoveCategory(idx,'down',e)}} className="p-1 text-zinc-600 hover:text-white"><ArrowDown size={14}/></button></div></div></div>)})}</div><button onClick={()=>setEditingItem({type:'category',data:{name:'',icon:'🏷',budget:''},index:-1})} className="w-full h-11 bg-zinc-200 text-black rounded-lg mt-4 text-[10px] font-black uppercase shadow-lg active:scale-95">カテゴリ追加</button></SimpleCard>}
                    {settingTab === 'template' && <SimpleCard className="p-5 animate-in slide-in-from-right-2"><div className="divide-y divide-white/5">{(config?.templates || []).map((t,idx)=>(<div key={idx} onClick={()=>setEditingItem({type:'template',data:t,index:idx})} className="flex justify-between items-center py-4 cursor-pointer"><div className="flex flex-col"><span className="text-xs font-bold text-white">{t.title}</span><span className="text-[9px] text-zinc-500 font-bold">¥{Number(t.amount).toLocaleString()} / {t.category}</span></div><ChevronRight size={14} className="text-zinc-800"/></div>))}</div><button onClick={()=>setEditingItem({type:'template',data:{title:'',amount:'',category:getCategoryNames()[0]||'食費',method:config?.paymentMethods?.[0]||'現金'},index:-1})} className="w-full h-11 bg-zinc-200 text-black rounded-lg mt-4 text-[10px] font-black uppercase shadow-lg active:scale-95">追加</button></SimpleCard>}
                    {settingTab === 'payment' && <SimpleCard className="p-5 animate-in slide-in-from-right-2"><div className="flex flex-wrap gap-2 mb-6">{(config?.paymentMethods || []).map((m, idx) => (<div key={m} onClick={() => setEditingItem({ type: 'payment', data: { name: m }, index: idx })} className="px-3 py-1.5 bg-white/5 rounded-lg border border-white/10 text-xs text-zinc-300 font-bold cursor-pointer active:scale-95 transition-all">{m}</div>))}</div><button onClick={()=>setEditingItem({type:'payment',data:{name:''},index:-1})} className="w-full h-11 bg-zinc-200 text-black rounded-lg text-[10px] font-black uppercase shadow-lg active:scale-95">支払方法を追加</button></SimpleCard>}
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
        <footer className="flex-none h-24 border-t border-white/5 flex justify-between items-center px-6 pb-6 bg-[#121212]/80 backdrop-blur-xl z-50">
          <NavButton active={activeTab==='home'} onClick={()=>setActiveTab('home')} icon={<Home size={24}/>}/>
          <NavButton active={activeTab==='log'} onClick={()=>setActiveTab('log')} icon={<History size={24}/>}/>
          <NavButton active={activeTab==='analysis'} onClick={()=>setActiveTab('analysis')} icon={<BarChart3 size={24}/>}/>
          <NavButton active={activeTab==='settings'} onClick={()=>{setActiveTab('settings');setSettingTab('menu')}} icon={<Settings size={24}/>}/>
          <button onClick={()=>{setEditingTx(null);setInputDate(getTodayString());setInputAmount('');setInputTitle('');setInputCategory(getCategoryNames()[0]||'食費');setInputMethod(config?.paymentMethods?.[0]||'現金');setShowCalculator(false);setIsModalOpen(true)}} className="flex items-center justify-center w-14 h-14 bg-white text-black rounded-full shadow-[0_0_20px_rgba(255,255,255,0.2)] active:scale-90 ml-2 transition-transform"><Plus size={28}/></button>
        </footer>
      </div>

      {/* MODALS */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={()=>setIsModalOpen(false)}>
          <div className="w-full max-h-[90vh] sm:h-auto sm:max-w-md bg-[#1E1E1E] sm:rounded-lg rounded-t-2xl border border-white/5 shadow-2xl flex flex-col overflow-hidden" onClick={e=>e.stopPropagation()}>
            {showCalculator ? (
              <div className="flex-1 p-5"><div className="flex justify-between items-center mb-4"><h2 className="text-[10px] font-black uppercase text-white tracking-widest">電卓</h2><button onClick={()=>setShowCalculator(false)} className="text-zinc-500"><X size={18}/></button></div><CalculatorPad initialValue={inputAmount} onConfirm={val=>{setInputAmount(String(val));setShowCalculator(false);}}/></div>
            ) : (
              <><div className="flex-none p-4 border-b border-white/5 flex justify-between items-center"><h2 className="text-xs font-black uppercase text-white tracking-widest">{editingTx?'編集':'入力'}</h2><button onClick={()=>setIsModalOpen(false)} className="p-2 text-zinc-500"><X size={20}/></button></div>
              <div className="flex-1 overflow-y-auto p-5 pb-8"><form onSubmit={handleTxSubmit} className="space-y-6">
                <div className="flex gap-2 items-center"><div className="relative flex-1"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 text-lg font-bold">¥</span><input type="text" inputMode="decimal" value={inputAmount?Number(inputAmount).toLocaleString():''} onChange={e=>{const v=e.target.value.replace(/,/g,'');if(!isNaN(v))setInputAmount(v)}} className="w-full h-12 bg-black/20 border border-white/10 rounded-lg text-lg font-bold pl-8 pr-4 text-white tabular-nums outline-none" autoFocus required/></div><button type="button" onClick={()=>setShowCalculator(true)} className="w-12 h-12 bg-white/10 rounded-lg text-white flex items-center justify-center active:bg-white/20"><Calculator size={20}/></button></div>
                <input type="text" value={inputTitle} onChange={e=>setInputTitle(e.target.value)} className="w-full h-11 bg-black/20 border border-white/10 rounded-lg px-4 text-sm text-white font-bold outline-none" placeholder="タイトル (例: ランチ)"/>
                <div className="grid grid-cols-2 gap-4 w-full"><div className="flex flex-col gap-2"><label className="text-[9px] text-zinc-500 uppercase font-black pl-1">日付</label><input type="date" value={inputDate} onChange={e=>setInputDate(e.target.value)} className="w-full h-11 bg-black/20 border border-white/10 rounded-lg text-xs px-2 text-white outline-none font-bold"/></div><div className="flex flex-col gap-2"><label className="text-[9px] text-zinc-500 uppercase font-black pl-1">カテゴリ</label><select value={inputCategory} onChange={e=>setInputCategory(e.target.value)} className="w-full h-11 bg-black/20 border border-white/10 rounded-lg text-xs px-2 text-white outline-none font-bold">{getCategoryNames().map(c=><option key={c} value={c}>{c}</option>)}</select></div></div>
                <div className="flex flex-wrap gap-2">{config.paymentMethods.map(m=>(<label key={m} className="cursor-pointer"><input type="radio" value={m} checked={inputMethod===m} onChange={e=>setInputMethod(e.target.value)} className="peer hidden" required/><div className="px-3 py-2 text-[10px] rounded-lg border border-zinc-800 font-black text-zinc-500 peer-checked:bg-white peer-checked:text-black transition-all">{m}</div></label>))}</div>
                <div className="flex gap-2 pt-2 pb-8">{editingTx&&(<button type="button" onClick={async()=>{if(window.confirm('削除しますか？')){await deleteDoc(doc(db,'users',user.uid,'transactions',editingTx.id));setIsModalOpen(false);showToastMsg('削除しました');}}} className="w-12 h-12 flex items-center justify-center bg-red-900/20 text-red-500 rounded-lg active:bg-red-900/40"><Trash2 size={18}/></button>)}<button type="submit" className="flex-1 h-12 bg-white text-black font-black rounded-lg text-xs uppercase tracking-widest active:bg-zinc-200 shadow-xl">保存する</button></div>
              </form></div></>
            )}
          </div>
        </div>
      )}

      {editingItem && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={()=>setEditingItem(null)}>
          <div className="w-full max-h-[90vh] sm:h-auto sm:max-w-md bg-[#1E1E1E] sm:rounded-lg rounded-t-2xl border border-white/5 shadow-2xl flex flex-col" onClick={e=>e.stopPropagation()}>
            <div className="p-4 border-b border-white/5 flex justify-between items-center"><h2 className="text-xs font-black uppercase text-white tracking-widest">編集</h2><button onClick={()=>setEditingItem(null)} className="p-2 text-zinc-500"><X size={20}/></button></div>
            <div className="p-5 pb-8 space-y-6">
                {editingItem.type === 'category' && (<><div className="flex gap-2"><input value={editingItem.data.icon || ''} onChange={e=>setEditingItem({...editingItem,data:{...editingItem.data,icon:e.target.value}})} className="w-12 h-12 text-center bg-black/20 border border-white/10 rounded-lg text-xl text-white outline-none"/><input value={editingItem.data.name || ''} onChange={e=>setEditingItem({...editingItem,data:{...editingItem.data,name:e.target.value}})} className="flex-1 h-12 bg-black/20 border border-white/10 rounded-lg px-3 text-sm text-white outline-none font-bold" placeholder="名前"/></div><div className="flex flex-col gap-1"><label className="text-[9px] text-zinc-500 font-bold uppercase pl-1">月間予算</label><input type="text" inputMode="decimal" value={editingItem.data.budget?Number(editingItem.data.budget).toLocaleString():''} onChange={e=>{const v=e.target.value.replace(/,/g,'');if(!isNaN(v))setEditingItem({...editingItem,data:{...editingItem.data,budget:v}})}} className="w-full h-12 bg-black/20 border border-white/10 rounded-lg px-3 text-sm text-white outline-none tabular-nums font-bold" placeholder="0"/></div></>)}
                {editingItem.type === 'fixed' && (<><input value={editingItem.data.name || ''} onChange={e=>setEditingItem({...editingItem,data:{...editingItem.data,name:e.target.value}})} className="w-full h-12 bg-black/20 border border-white/10 rounded-lg px-3 text-sm text-white outline-none font-bold" placeholder="固定費名"/><input type="text" inputMode="decimal" value={editingItem.data.amount?Number(editingItem.data.amount).toLocaleString():''} onChange={e=>{const v=e.target.value.replace(/,/g,'');if(!isNaN(v))setEditingItem({...editingItem,data:{...editingItem.data,amount:v}})}} className="w-full h-12 bg-black/20 border border-white/10 rounded-lg px-3 text-sm text-white outline-none tabular-nums font-bold" placeholder="金額"/><select value={editingItem.data.method || ''} onChange={e=>setEditingItem({...editingItem,data:{...editingItem.data,method:e.target.value}})} className="w-full h-12 bg-black/20 border border-white/10 rounded-lg px-3 text-sm text-white outline-none font-bold">{config.paymentMethods.map(m=><option key={m} value={m}>{m}</option>)}</select></>)}
                {editingItem.type === 'template' && (<><input value={editingItem.data.title || ''} onChange={e=>setEditingItem({...editingItem,data:{...editingItem.data,title:e.target.value}})} className="w-full h-12 bg-black/20 border border-white/10 rounded-lg px-3 text-sm text-white outline-none font-bold" placeholder="テンプレート名"/><input type="text" inputMode="decimal" value={editingItem.data.amount?Number(editingItem.data.amount).toLocaleString():''} onChange={e=>{const v=e.target.value.replace(/,/g,'');if(!isNaN(v))setEditingItem({...editingItem,data:{...editingItem.data,amount:v}})}} className="w-full h-12 bg-black/20 border border-white/10 rounded-lg px-3 text-sm text-white outline-none tabular-nums font-bold" placeholder="金額"/><div className="flex gap-2"><select value={editingItem.data.category || ''} onChange={e=>setEditingItem({...editingItem,data:{...editingItem.data,category:e.target.value}})} className="flex-1 h-12 bg-black/20 border border-white/10 rounded-lg px-2 text-xs text-white outline-none font-bold">{getCategoryNames().map(c=><option key={c} value={c}>{c}</option>)}</select><select value={editingItem.data.method || ''} onChange={e=>setEditingItem({...editingItem,data:{...editingItem.data,method:e.target.value}})} className="flex-1 h-12 bg-black/20 border border-white/10 rounded-lg px-2 text-xs text-white outline-none font-bold">{config.paymentMethods.map(m=><option key={m} value={m}>{m}</option>)}</select></div></>)}
                {editingItem.type === 'payment' && (<input value={editingItem.data.name || ''} onChange={e=>setEditingItem({...editingItem,data:{...editingItem.data,name:e.target.value}})} className="w-full h-12 bg-black/20 border border-white/10 rounded-lg px-3 text-sm text-white outline-none font-bold" placeholder="支払方法名"/>)}
                <div className="flex gap-2 pt-2 pb-8">{editingItem.index!==-1&&(<button onClick={handleDeleteItem} className="w-12 h-12 flex items-center justify-center bg-red-900/20 text-red-500 rounded-lg active:bg-red-900/40"><Trash2 size={18}/></button>)}<button onClick={handleSettingsSave} className="flex-1 h-12 bg-white text-black rounded-lg font-black text-xs uppercase active:bg-zinc-200">保存</button></div>
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
