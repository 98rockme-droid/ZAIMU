import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, onSnapshot, query, deleteDoc, serverTimestamp, where, updateDoc, writeBatch, getDocs, getDoc, orderBy } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut, deleteUser } from 'firebase/auth';
import { Wallet, CreditCard, Landmark, Plus, Settings, Trash2, History, ChevronLeft, ChevronRight, Edit3, X, Tags, ArrowLeft, CopyCheck, Calendar, CheckCircle2, BarChart3, TrendingDown, TrendingUp, Banknote, LayoutGrid, ListChecks, Search, CalendarDays, AlignJustify, Zap, Image as ImageIcon, Calculator, Delete, LogOut, Lock, Import, UserX, User, FileText, ArrowUp, ArrowDown, Home, Sparkles, Coffee } from 'lucide-react';

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

const getMonthString = (date) => date.toISOString().slice(0, 7);
const getTodayString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/* --- UI COMPONENTS --- */
const SimpleCard = ({ children, className = "", onClick }) => (
  <div onClick={onClick} className={`bg-[#1E1E1E] rounded-lg border border-white/5 shadow-lg overflow-hidden w-full box-border ${className}`}>
    {children}
  </div>
);

const NavButton = ({ active, onClick, icon }) => (
  <button onClick={onClick} className={`flex items-center justify-center w-16 h-16 transition-all duration-300 ${active ? 'text-white scale-110 drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]' : 'text-zinc-600 hover:text-zinc-400'}`}>
    {icon}
  </button>
);

const Skeleton = ({ className }) => (
  <div className={`animate-pulse bg-white/5 rounded ${className}`} />
);

// Haptic Feedback Helper
const triggerHaptic = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(15);
    }
};

// Calculator Component
const CalculatorPad = ({ initialValue, onConfirm }) => {
  const [display, setDisplay] = useState(String(initialValue || '0'));
  const [isResult, setIsResult] = useState(false);

  const handlePush = (val) => {
    triggerHaptic();
    if (isResult && !['+','-','*','/'].includes(val)) {
      setDisplay(String(val));
      setIsResult(false);
    } else {
      setDisplay(prev => (prev === '0' && !['+','-','*','/','.'] .includes(val)) ? String(val) : prev + val);
      setIsResult(false);
    }
  };

  const handleCalc = () => {
    triggerHaptic();
    try {
      // eslint-disable-next-line no-new-func
      const res = new Function('return ' + display)();
      setDisplay(String(res));
      setIsResult(true);
      return res;
    } catch(e) {
      setDisplay('Error');
      setIsResult(true);
      return 0;
    }
  };

  const handleDelete = () => {
    triggerHaptic();
    setDisplay(prev => prev.length > 1 ? prev.slice(0, -1) : '0');
  };

  const btns = [
    { l: 'C', act: () => setDisplay('0'), style: 'text-red-400' },
    { l: '/', act: () => handlePush('/'), style: 'text-emerald-400' },
    { l: '*', act: () => handlePush('*'), style: 'text-emerald-400' },
    { l: <Delete size={18}/>, act: handleDelete, style: 'text-zinc-400' },
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
    { l: '=', act: () => handleCalc(), style: 'bg-emerald-500/20 text-emerald-400 row-span-2' },
    { l: '0', act: () => handlePush('0'), style: 'col-span-2' },
    { l: '.', act: () => handlePush('.') },
  ];

  return (
    <div className="w-full flex flex-col gap-3">
      <div className="bg-black/40 rounded-lg p-3 text-right border border-white/5">
        <span className="text-2xl font-bold tracking-widest font-mono text-white break-all">{display}</span>
      </div>
      <div className="grid grid-cols-4 gap-2 h-64">
        {btns.map((b, i) => (
          <button key={i} type="button" onClick={b.act} className={`rounded-lg bg-white/5 border border-white/5 text-lg font-bold active:scale-95 transition-all flex items-center justify-center ${b.style || 'text-white'}`}>
            {b.l}
          </button>
        ))}
      </div>
      <button onClick={() => {
         triggerHaptic();
         let finalVal = Number(display);
         if (!isResult) {
            try {
               // eslint-disable-next-line no-new-func
               finalVal = Number(new Function('return ' + display)());
            } catch {}
         }
         onConfirm(finalVal);
      }} className="w-full h-12 bg-white text-black rounded-lg font-bold text-sm uppercase tracking-widest flex items-center justify-center active:scale-95 shadow-lg">
        決定
      </button>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState(null); 
  const [authLoading, setAuthLoading] = useState(true); 
  const [loading, setLoading] = useState(true); 
  const [monthLoading, setMonthLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('home');
  const [homeView, setHomeView] = useState('spending');
  const [logView, setLogView] = useState('list');
  const [settingTab, setSettingTab] = useState('menu');
  const [month, setMonth] = useState(getMonthString(new Date()));
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  
  // 編集用state
  const [editingItem, setEditingItem] = useState(null); 

  const [transactions, setTransactions] = useState([]);
  const [lastMonthTransactions, setLastMonthTransactions] = useState([]);
  const [monthlyData, setMonthlyData] = useState({ salary: 0, budget: 0, cashBudget: 0, cardBills: {}, fixedCosts: [], catBudgets: {}, cardDueDates: {}, confirmedPayments: [] });
  const [cashBalance, setCashBalance] = useState(0);
  
  // Ref for scroll control - ※ここ以外でmainRefを宣言しないでください
  const mainRef = useRef(null);

  const [config, setConfig] = useState({ 
    categories: [
      { name: '食費', icon: '🍔' },
      { name: '日用品', icon: '🧻' },
      { name: '交通費', icon: '🚃' },
      { name: '交際費', icon: '🍻' },
      { name: '趣味', icon: '🎮' },
      { name: 'その他', icon: '📦' }
    ],
    paymentMethods: ['現金', '三井住友', '楽天', 'PayPay'],
    templates: [
      { title: 'コンビニ', amount: 500, category: '食費', method: 'PayPay' },
      { title: 'ランチ', amount: 1000, category: '食費', method: 'PayPay' },
    ]
  });
  
  const [editingTx, setEditingTx] = useState(null);
  const [inputDate, setInputDate] = useState(getTodayString()); 
  const [inputAmount, setInputAmount] = useState(''); 
  const [filter, setFilter] = useState({ category: 'ALL', method: 'ALL' });
  const [searchText, setSearchText] = useState('');

  // ログイン監視
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    triggerHaptic();
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const handleLogout = async () => {
    if(window.confirm('ログアウトしますか？')) {
        await signOut(auth);
    }
  };

  // CSVエクスポート機能
  const handleExportCSV = async () => {
    triggerHaptic();
    if(!user) return;
    if(!window.confirm('すべての支出履歴をCSV形式でダウンロードしますか？')) return;

    try {
      const q = query(collection(db, 'users', user.uid, 'transactions'), orderBy('date', 'desc'));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        alert('出力するデータがありません。');
        return;
      }

      // CSVヘッダー
      let csvContent = "\uFEFF"; 
      csvContent += "日付,タイトル,カテゴリ,金額,支払方法\n";

      // データ行
      snapshot.forEach(doc => {
        const data = doc.data();
        const date = data.date ? data.date.split('T')[0] : '';
        const title = data.title ? `"${data.title.replace(/"/g, '""')}"` : '';
        const category = data.category || '';
        const amount = data.amount || 0;
        const method = data.paymentMethod || '';
        
        csvContent += `${date},${title},${category},${amount},${method}\n`;
      });

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `zaimu_backup_${getTodayString()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

    } catch(e) {
      console.error(e);
      alert('エクスポートに失敗しました');
    }
  };

  const handleMoveCategory = async (index, direction, e) => {
    e.stopPropagation();
    triggerHaptic();
    const newCats = [...config.categories];
    if (direction === 'up' && index > 0) {
      [newCats[index], newCats[index - 1]] = [newCats[index - 1], newCats[index]];
    } else if (direction === 'down' && index < newCats.length - 1) {
      [newCats[index], newCats[index + 1]] = [newCats[index + 1], newCats[index]];
    } else {
      return;
    }
    setConfig({ ...config, categories: newCats });
    await setDoc(doc(db, 'users', user.uid, 'settings', 'config'), { ...config, categories: newCats }, { merge: true });
  };

  const getCategoryIcon = (catName) => {
    if (!config.categories) return '🏷';
    const cat = config.categories.find(c => (typeof c === 'string' ? c : c.name) === catName);
    return cat ? (typeof cat === 'string' ? '🏷' : cat.icon) : '🏷';
  };

  const getCategoryNames = () => {
    return config.categories.map(c => typeof c === 'string' ? c : c.name);
  };

  // データ取得
  useEffect(() => {
    if (!user) return; 

    setMonthLoading(true);

    const start = new Date(`${month}-01T00:00:00`).toISOString();
    const nextDate = new Date(`${month}-01`);
    nextDate.setMonth(nextDate.getMonth() + 1);
    const end = nextDate.toISOString();

    const prevDate = new Date(`${month}-01`);
    prevDate.setMonth(prevDate.getMonth() - 1);
    const prevMonthStr = getMonthString(prevDate);
    const prevStart = new Date(`${prevMonthStr}-01T00:00:00`).toISOString();
    const prevEnd = start;

    const unsubTx = onSnapshot(query(collection(db, 'users', user.uid, 'transactions'), where('date', '>=', start), where('date', '<', end)), (s) => {
      setTransactions(s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => new Date(b.date) - new Date(a.date)));
      setLoading(false);
    });

    const fetchLastMonth = async () => {
      const q = query(collection(db, 'users', user.uid, 'transactions'), where('date', '>=', prevStart), where('date', '<', prevEnd));
      const s = await getDocs(q);
      setLastMonthTransactions(s.docs.map(d => ({ id: d.id, ...d.data() })));
    };
    fetchLastMonth();

    const unsubMonth = onSnapshot(doc(db, 'users', user.uid, 'months', month), (s) => {
      setMonthlyData(s.exists() ? s.data() : { salary: 0, budget: 0, cashBudget: 0, cardBills: {}, fixedCosts: [], catBudgets: {}, cardDueDates: {}, confirmedPayments: [] });
      setMonthLoading(false);
    });
    
    const unsubCash = onSnapshot(doc(db, 'users', user.uid, 'wallet', 'cash'), (s) => {
      setCashBalance(s.exists() ? s.data().balance : 0);
    });
    const unsubConfig = onSnapshot(doc(db, 'users', user.uid, 'settings', 'config'), (s) => {
      if (s.exists()) {
        const data = s.data();
        if (data.categories && typeof data.categories[0] === 'string') {
           data.categories = data.categories.map(name => ({ name, icon: '🏷' }));
        }
        setConfig(data);
      }
    });

    return () => { unsubTx(); unsubMonth(); unsubCash(); unsubConfig(); };
  }, [month, user]);

  const summary = useMemo(() => {
    const now = new Date();
    const currentMonthStr = getMonthString(now);
    let daysLeft = 0;
    
    if (month === currentMonthStr) {
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        daysLeft = Math.max(1, lastDay - now.getDate() + 1);
    } else if (month > currentMonthStr) {
        const d = new Date(month + "-01");
        daysLeft = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    }

    const salary = monthlyData.salary || 0;
    
    const fixedCosts = monthlyData.fixedCosts || [];
    const fixedTotal = fixedCosts.reduce((s, i) => s + i.amount, 0);
    const fixedCostsBank = fixedCosts.filter(f => !f.method || f.method === '現金').reduce((s, i) => s + i.amount, 0);

    const billTotal = Object.values(monthlyData.cardBills || {}).reduce((s, v) => s + (Number(v) || 0), 0);
    
    const totalWithdrawal = fixedCostsBank + billTotal; 
    const bankBalanceProjected = salary - totalWithdrawal;

    const cardBudgetTotal = (monthlyData.budget || 0);
    const cardDisposable = cardBudgetTotal - fixedTotal; 
    
    const spentCard = transactions.filter(t => t.paymentMethod !== '現金').reduce((s, t) => s + t.amount, 0);
    const cardRemaining = cardDisposable - spentCard;
    const cardRemainingPercent = cardDisposable > 0 ? Math.min(Math.round((cardRemaining / cardDisposable) * 100), 100) : 0;

    const cashBudgetTotal = (monthlyData.cashBudget || 0);
    const spentCash = transactions.filter(t => t.paymentMethod === '現金').reduce((s, t) => s + t.amount, 0);
    const cashRemaining = cashBudgetTotal - spentCash;
    const cashRemainingPercent = cashBudgetTotal > 0 ? Math.min(Math.round((cashRemaining / cashBudgetTotal) * 100), 100) : 0;

    const totalRemaining = cardRemaining + cashRemaining;
    const dailyBudget = daysLeft > 0 ? Math.floor(totalRemaining / daysLeft) : 0;

    const getCatTotals = (txs) => txs.reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount;
      return acc;
    }, {});

    const catTotals = getCatTotals(transactions);
    const lastCatTotals = getCatTotals(lastMonthTransactions);
    const totalSpent = transactions.reduce((s, t) => s + t.amount, 0);
    const lastTotalSpent = lastMonthTransactions.reduce((s, t) => s + t.amount, 0);

    const dailyTotals = transactions.reduce((acc, t) => {
      const day = new Date(t.date).getDate();
      acc[day] = (acc[day] || 0) + t.amount;
      return acc;
    }, {});

    return { 
      salary, totalWithdrawal, bankBalanceProjected,
      cardRemaining, cashRemaining, cardBudget: cardBudgetTotal, cashBudget: cashBudgetTotal, 
      cardRemainingPercent, cashRemainingPercent, catTotals, lastCatTotals, totalSpent, lastTotalSpent,
      dailyBudget, daysLeft, dailyTotals,
      fixedCostsBank, cardDisposable, fixedTotal
    };
  }, [monthlyData, transactions, lastMonthTransactions, month]);

  const confirmPayment = async (cardName) => {
    triggerHaptic();
    const confirmed = monthlyData.confirmedPayments || [];
    if (!confirmed.includes(cardName)) {
      await setDoc(doc(db, 'users', user.uid, 'months', month), { confirmedPayments: [...confirmed, cardName] }, { merge: true });
    }
  };

  const copyLastMonthSettings = async () => {
    if(!window.confirm('先月の予算・固定費・カテゴリ設定を今月にコピーしますか？')) return;
    triggerHaptic();
    const d = new Date(month + "-01");
    d.setMonth(d.getMonth() - 1);
    const lastMonthStr = getMonthString(d);
    try {
        const lastMonthDoc = await getDoc(doc(db, 'users', user.uid, 'months', lastMonthStr));
        if (lastMonthDoc.exists()) {
            const data = lastMonthDoc.data();
            const newData = {
                budget: data.budget || 0,
                cashBudget: data.cashBudget || 0,
                fixedCosts: data.fixedCosts || [], 
                catBudgets: data.catBudgets || {},
                cardDueDates: data.cardDueDates || {}, 
            };
            await setDoc(doc(db, 'users', user.uid, 'months', month), newData, { merge: true });
            alert('コピーしました');
        } else {
            alert('先月のデータが見つかりませんでした');
        }
    } catch (e) {
        alert('エラーが発生しました');
    }
  };

  const handleTxSubmit = async (e) => {
    e.preventDefault();
    triggerHaptic();
    const method = e.target.method.value;
    const amount = Number(inputAmount); 
    const data = { 
      title: e.target.title.value || e.target.category.value, 
      amount, 
      category: e.target.category.value, 
      paymentMethod: method, 
      date: inputDate ? new Date(inputDate).toISOString() : new Date().toISOString() 
    };
    if (method === '現金') { 
      const diff = editingTx ? editingTx.amount - amount : -amount; 
      await setDoc(doc(db, 'users', user.uid, 'wallet', 'cash'), { balance: cashBalance + diff }, { merge: true }); 
    }
    if (editingTx) { 
      await updateDoc(doc(db, 'users', user.uid, 'transactions', editingTx.id), data); 
      setEditingTx(null); 
    } else { 
      await setDoc(doc(collection(db, 'users', user.uid, 'transactions')), { ...data, createdAt: serverTimestamp() }); 
    }
    setIsModalOpen(false);
  };

  const handleSettingsSave = async () => {
    triggerHaptic();
    if (!editingItem) return;
    const { type, data, index } = editingItem;

    if (type === 'category') {
        const newCats = [...config.categories];
        if (index === -1) {
            newCats.push({ name: data.name, icon: data.icon || '🏷' });
        } else {
            newCats[index] = { name: data.name, icon: data.icon || '🏷' };
        }
        await setDoc(doc(db,'users',user.uid,'settings','config'),{...config, categories: newCats});

        // 過去のトランザクションのカテゴリ名も更新する
        if (index !== -1 && data.originalName && data.originalName !== data.name) {
            const q = query(collection(db, 'users', user.uid, 'transactions'), where('category', '==', data.originalName));
            const snapshot = await getDocs(q);
            const batch = writeBatch(db);
            snapshot.docs.forEach(doc => {
                batch.update(doc.ref, { category: data.name });
            });
            await batch.commit();
        }

        const newBudgets = { ...monthlyData.catBudgets };
        if (index !== -1 && data.originalName && data.originalName !== data.name && newBudgets[data.originalName]) delete newBudgets[data.originalName];
        if (data.budget) newBudgets[data.name] = Number(data.budget);
        await setDoc(doc(db,'users',user.uid,'months',month), { catBudgets: newBudgets }, { merge: true });

    } else if (type === 'template') {
        const newTpls = [...(config.templates || [])];
        if (index === -1) {
            newTpls.push({ title: data.title, amount: Number(data.amount), category: data.category, method: data.method });
        } else {
            newTpls[index] = { title: data.title, amount: Number(data.amount), category: data.category, method: data.method };
        }
        setDoc(doc(db,'users',user.uid,'settings','config'),{...config, templates: newTpls});
    } else if (type === 'fixed') {
        const newFixed = [...(monthlyData.fixedCosts || [])];
        if (index === -1) {
            newFixed.push({ id: Date.now(), name: data.name, amount: Number(data.amount), method: data.method });
        } else {
            newFixed[index] = { ...newFixed[index], name: data.name, amount: Number(data.amount), method: data.method };
        }
        setDoc(doc(db,'users',user.uid,'months',month),{fixedCosts: newFixed},{merge:true});
    } else if (type === 'payment') {
        const newMethods = [...config.paymentMethods];
        if (index === -1) {
            if (data.name) newMethods.push(data.name);
        } else {
            newMethods[index] = data.name;
        }
        setDoc(doc(db,'users',user.uid,'settings','config'),{...config, paymentMethods: newMethods});
    }
    setEditingItem(null);
  };

  const handleDeleteItem = () => {
    if (!editingItem || !window.confirm('本当に削除しますか？')) return;
    triggerHaptic();
    const { type, index } = editingItem;
    if (index === -1) { setEditingItem(null); return; }

    if (type === 'category') {
        setDoc(doc(db,'users',user.uid,'settings','config'),{...config,categories:config.categories.filter((_, i) => i !== index)});
    } else if (type === 'template') {
        setDoc(doc(db,'users',user.uid,'settings','config'),{...config, templates: config.templates.filter((_, i) => i !== index)});
    } else if (type === 'fixed') {
        setDoc(doc(db,'users',user.uid,'months',month),{fixedCosts:monthlyData.fixedCosts.filter((_, i) => i !== index)},{merge:true});
    } else if (type === 'payment') {
        setDoc(doc(db,'users',user.uid,'settings','config'),{...config,paymentMethods:config.paymentMethods.filter((_, i) => i !== index)});
    }
    setEditingItem(null);
  };

  const applyTemplate = (tpl) => {
    triggerHaptic();
    setInputAmount(tpl.amount);
    document.querySelector('input[name="title"]').value = tpl.title;
    document.querySelector('select[name="category"]').value = tpl.category;
    const radios = document.querySelectorAll('input[name="method"]');
    radios.forEach(r => { if(r.value === tpl.method) r.checked = true; });
  };

  const activeAlerts = useMemo(() => {
    const today = new Date().getDate();
    return Object.entries(monthlyData.cardDueDates || {}).filter(([card, day]) => {
      const dueDay = Number(day);
      const isConfirmed = (monthlyData.confirmedPayments || []).includes(card);
      const hasBill = (monthlyData.cardBills?.[card] || 0) > 0;
      return hasBill && !isConfirmed && dueDay >= today && (dueDay - today) <= 7;
    });
  }, [monthlyData]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const matchSearch = t.title.toLowerCase().includes(searchText.toLowerCase());
      const matchCat = filter.category === 'ALL' || t.category === filter.category;
      const matchMethod = filter.method === 'ALL' || t.paymentMethod === filter.method;
      return matchSearch && matchCat && matchMethod;
    });
  }, [transactions, searchText, filter]);

  const calendarDays = useMemo(() => {
    const d = new Date(month + "-01");
    const year = d.getFullYear();
    const m = d.getMonth();
    const lastDay = new Date(year, m + 1, 0).getDate();
    const firstDayWeek = new Date(year, m, 1).getDay();
    const days = [];
    for (let i = 0; i < firstDayWeek; i++) days.push(null);
    for (let i = 1; i <= lastDay; i++) days.push(i);
    return days;
  }, [month]);

  const openModalWithDate = (dateStr) => {
    triggerHaptic();
    setEditingTx(null);
    setInputDate(dateStr);
    setInputAmount('');
    setIsModalOpen(true);
  };

  const startEditing = (t) => {
    triggerHaptic();
    setEditingTx(t);
    setInputDate(t.date.split('T')[0]);
    setInputAmount(t.amount);
    setIsModalOpen(true);
  }

  if (authLoading) return <div className="h-screen bg-[#121212] flex items-center justify-center text-zinc-600 font-bold uppercase tracking-widest">Loading...</div>;

  if (!user) {
    return (
      <div className="h-screen w-full bg-[#121212] flex flex-col items-center justify-center p-6 space-y-8 animate-in fade-in duration-500">
        <div className="flex flex-col items-center gap-4">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center shadow-2xl">
            <img src="/favicon.ico" alt="logo" className="w-12 h-12 object-contain" />
          </div>
          <div className="text-center">
            <h1 className="text-3xl font-black text-white tracking-tighter uppercase">ZAIMU</h1>
            <p className="text-zinc-500 text-xs font-bold tracking-widest mt-1">Simple Financial Management</p>
          </div>
        </div>
        <button onClick={handleLogin} className="w-full max-w-xs h-14 bg-white text-black rounded-full font-bold text-sm uppercase tracking-widest hover:bg-zinc-200 transition-transform active:scale-95 flex items-center justify-center gap-3 shadow-xl">
          <Lock size={18} />
          Googleでログイン
        </button>
      </div>
    );
  }

  // --- RENDER: MAIN APP ---

  if (loading && !monthlyData.budget) return <div className="h-screen bg-[#121212] flex items-center justify-center text-zinc-600 font-bold uppercase tracking-widest">Syncing Data...</div>;

  return (
    <div className="fixed inset-0 w-full bg-[#121212] text-zinc-200 font-sans font-bold flex flex-col justify-center">
      {/* 画面中央に寄せるためのコンテナ (iPad対応) */}
      <div className="w-full max-w-md h-full flex flex-col relative bg-[#121212] shadow-2xl mx-auto">
        
        {/* HEADER (Glassmorphism) */}
        <header className="absolute top-0 w-full max-w-md h-16 border-b border-white/5 px-4 flex items-center justify-center bg-[#121212]/80 backdrop-blur-xl z-50">
          <div className="w-full flex justify-between items-center">
            <div className="flex items-center gap-2">
              <img src="/favicon.ico" alt="logo" className="w-6 h-6 rounded object-contain" onError={(e) => e.target.style.display = 'none'} />
              <h1 className="text-xl font-black tracking-tighter text-white uppercase">ZAIMU</h1>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => { triggerHaptic(); setMonth(getMonthString(new Date())); }} className="h-8 px-2.5 bg-white/5 rounded-lg border border-white/5 text-[10px] font-bold text-zinc-400 flex items-center justify-center active:scale-95 transition-transform">今月</button>
              <div className="h-8 flex items-center bg-white/5 rounded-lg px-1 border border-white/5 font-mono text-xs gap-1">
                <button onClick={() => { triggerHaptic(); const d=new Date(`${month}-01`); d.setMonth(d.getMonth()-1); setMonth(getMonthString(d)); }} className="w-10 h-full flex items-center justify-center active:bg-white/10 rounded"><ChevronLeft size={20}/></button>
                <span className="px-1 font-bold text-sm tabular-nums">{month.replace('-','/')}</span>
                <button onClick={() => { triggerHaptic(); const d=new Date(`${month}-01`); d.setMonth(d.getMonth()+1); setMonth(getMonthString(d)); }} className="w-10 h-full flex items-center justify-center active:bg-white/10 rounded"><ChevronRight size={20}/></button>
              </div>
            </div>
          </div>
        </header>

        {/* MAIN SCROLL AREA (Padding for Header/Footer) */}
        <main ref={mainRef} className="flex-1 overflow-y-auto scrollbar-hide pt-20 pb-28">
          <div className="w-full max-w-md mx-auto">
            
            {/* HOME TAB */}
            {activeTab === 'home' && (
              <div className="p-4 space-y-4 animate-in fade-in duration-500">
                <div className="bg-[#1E1E1E] p-1 rounded-xl flex gap-1 mb-4 border border-white/5">
                  <button onClick={() => { triggerHaptic(); setHomeView('spending'); }} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${homeView === 'spending' ? 'bg-white text-black shadow-lg' : 'text-zinc-500 hover:text-white'}`}><LayoutGrid size={14}/> 支出管理</button>
                  <button onClick={() => { triggerHaptic(); setHomeView('forecast'); }} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${homeView === 'forecast' ? 'bg-white text-black shadow-lg' : 'text-zinc-500 hover:text-white'}`}><ListChecks size={14}/> 収支・予定</button>
                </div>

                {homeView === 'spending' && (
                  <div className="space-y-4 animate-in slide-in-from-left-4 fade-in duration-300">
                    {summary.daysLeft > 0 && (
                      <div className="flex justify-between items-center px-2">
                        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">残り {summary.daysLeft}日</span>
                        <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">1日あたり <span className="text-white tabular-nums">¥{summary.dailyBudget.toLocaleString()}</span></span>
                      </div>
                    )}
                    <SimpleCard className="p-6">
                      <div className="flex justify-between items-start mb-4"><div><p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">カード残り</p><h2 className={`text-4xl font-bold mt-1 tabular-nums ${summary.cardRemaining < 0 ? 'text-red-400' : 'text-white'}`}>¥{summary.cardRemaining.toLocaleString()}</h2></div><div className="text-right"><p className="text-[8px] text-zinc-600 font-bold uppercase">軍資金</p><p className="text-xs font-bold text-zinc-400 tabular-nums">¥{(summary.cardBudget).toLocaleString()}</p></div></div>
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden"><div className={`h-full transition-all duration-1000 ${summary.cardRemainingPercent <= 15 ? 'bg-red-500' : 'bg-white'}`} style={{ width: `${summary.cardRemainingPercent}%` }} /></div>
                    </SimpleCard>
                    <SimpleCard className="p-6">
                      <div className="flex justify-between items-start mb-4"><div><p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">現金残り</p><h2 className={`text-4xl font-bold mt-1 tabular-nums ${summary.cashRemaining < 0 ? 'text-red-400' : 'text-white'}`}>¥{summary.cashRemaining.toLocaleString()}</h2></div><div className="text-right"><p className="text-[8px] text-zinc-600 font-bold uppercase">軍資金</p><p className="text-xs font-bold text-zinc-400 tabular-nums">¥{summary.cashBudget.toLocaleString()}</p></div></div>
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden"><div className={`h-full transition-all duration-1000 ${summary.cashRemainingPercent <= 15 ? 'bg-red-500' : 'bg-zinc-400'}`} style={{ width: `${summary.cashRemainingPercent}%` }} /></div>
                    </SimpleCard>
                  </div>
                )}

                {homeView === 'forecast' && (
                  <div className="space-y-4 animate-in slide-in-from-right-4 fade-in duration-300">
                    {activeAlerts.length > 0 && (
                      <SimpleCard className="bg-white/[0.03] border-white/10 p-4 space-y-3">
                        <div className="flex items-center gap-2 text-zinc-400"><Calendar size={14}/><span className="text-[10px] font-bold uppercase tracking-[0.2em]">Upcoming Payments</span></div>
                        <div className="space-y-2">
                          {activeAlerts.map(([card, day]) => (
                            <div key={card} className="flex justify-between items-center bg-black/20 p-2.5 rounded border border-white/5">
                              <div className="flex flex-col"><span className="text-[11px] font-bold text-zinc-200">{card}</span>
                              <div className="flex items-center gap-2"><span className="text-[9px] font-bold text-zinc-500 uppercase">{day}日に引き落とし</span><span className="text-[9px] font-bold text-white tabular-nums">¥{(monthlyData.cardBills[card]||0).toLocaleString()}</span></div></div>
                              <button onClick={() => confirmPayment(card)} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded text-[9px] font-black uppercase transition-all"><CheckCircle2 size={12}/> 完了</button>
                            </div>
                          ))}
                        </div>
                      </SimpleCard>
                    )}
                    <SimpleCard className="p-5">
                      <div className="flex justify-between items-end mb-3"><p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">口座に残るお金 (見込み)</p><Banknote size={16} className="text-zinc-600"/></div>
                      <div className="flex justify-between items-center mb-1"><span className="text-xs text-zinc-400">給与収入</span><span className="text-sm font-bold text-white tabular-nums">+ ¥{summary.salary.toLocaleString()}</span></div>
                      <div className="flex justify-between items-center mb-3 pb-3 border-b border-white/5"><span className="text-xs text-zinc-400">引き落とし計</span><span className="text-sm font-bold text-red-400 tabular-nums">- ¥{summary.totalWithdrawal.toLocaleString()}</span></div>
                      <div className="flex justify-between items-end"><span className="text-xs font-bold text-zinc-500">残高予想</span><span className="text-2xl font-black text-white tabular-nums">¥{summary.bankBalanceProjected.toLocaleString()}</span></div>
                    </SimpleCard>
                    <div className="grid grid-cols-2 gap-3">
                      {config.categories.filter(c => monthlyData.catBudgets?.[(typeof c==='string'?c:c.name)]).map(c => {
                        const catName = typeof c === 'string' ? c : c.name;
                        const icon = getCategoryIcon(catName);
                        const spent = summary.catTotals[catName] || 0;
                        const budget = monthlyData.catBudgets[catName];
                        const per = Math.max(Math.round(((budget - spent) / budget) * 100), 0);
                        return (
                          <SimpleCard key={catName} className="p-3 space-y-2">
                            <div className="flex flex-col gap-1 text-[9px] font-bold">
                              <div className="flex justify-between items-center">
                                <div className="flex items-center gap-1.5"><span className="text-sm">{icon}</span><span className="text-zinc-400">{catName}</span></div>
                                <span className="text-[9px] font-bold text-zinc-200 tabular-nums">¥{spent.toLocaleString()} / ¥{budget.toLocaleString()}</span>
                              </div>
                            </div>
                            <div className="h-0.5 bg-white/5 rounded-full overflow-hidden"><div className={`h-full ${per < 15 ? 'bg-red-500' : 'bg-zinc-500'}`} style={{ width: `${per}%` }} /></div>
                          </SimpleCard>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* LOG TAB */}
            {activeTab === 'log' && (
              <div className="p-4 space-y-3 animate-in fade-in duration-500">
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <input type="text" value={searchText} onChange={e => setSearchText(e.target.value)} placeholder="履歴を検索..." className="w-full h-10 bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 text-xs text-white outline-none font-bold" />
                    <Search size={14} className="absolute left-3 top-3 text-zinc-500"/>
                    {searchText && <button onClick={() => setSearchText('')} className="absolute right-3 top-3 text-zinc-500"><X size={14}/></button>}
                  </div>
                  <div className="flex bg-[#1E1E1E] rounded-lg border border-white/10 p-0.5">
                    <button onClick={() => { triggerHaptic(); setLogView('list'); }} className={`p-2 rounded ${logView==='list'?'bg-white text-black':'text-zinc-500'}`}><AlignJustify size={16}/></button>
                    <button onClick={() => { triggerHaptic(); setLogView('calendar'); }} className={`p-2 rounded ${logView==='calendar'?'bg-white text-black':'text-zinc-500'}`}><CalendarDays size={16}/></button>
                  </div>
                </div>
                <div className="flex gap-2">
                  <select onChange={e => setFilter({...filter, category: e.target.value})} className="bg-white/5 border border-white/10 rounded-lg px-3 h-10 text-[10px] flex-1 text-zinc-300 appearance-none outline-none font-bold"><option value="ALL">全てのカテゴリ</option>{getCategoryNames().map(c => <option key={c} value={c}>{c}</option>)}</select>
                  <select onChange={e => setFilter({...filter, method: e.target.value})} className="bg-white/5 border border-white/10 rounded-lg px-3 h-10 text-[10px] flex-1 text-zinc-300 appearance-none outline-none font-bold"><option value="ALL">全ての支払方法</option>{config.paymentMethods.map(m => <option key={m} value={m}>{m}</option>)}</select>
                </div>
                {logView === 'list' && (
                  <div className="space-y-1">
                    {filteredTransactions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-zinc-600 gap-3">
                            <Sparkles size={48} className="text-zinc-700" />
                            <p className="text-xs font-bold tracking-widest uppercase">No Spending! 🎉</p>
                        </div>
                    ) : filteredTransactions.map(t => {
                      const icon = getCategoryIcon(t.category);
                      return (
                        <div 
                          key={t.id} 
                          onClick={() => startEditing(t)} 
                          className="flex justify-between items-center py-3 px-2 border-b border-white/5 active:bg-white/5 transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="text-xl w-8 flex justify-center flex-shrink-0">{icon}</div>
                            <div className="text-left flex-1 min-w-0">
                              <div className="text-sm font-bold text-white truncate">{t.title}</div>
                              <div className="text-[9px] font-bold text-zinc-500 uppercase">{t.category} • {t.date.split('T')[0]}</div>
                            </div>
                          </div>
                          <span className="text-sm font-bold tabular-nums text-white whitespace-nowrap pl-2">¥{t.amount.toLocaleString()}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                {logView === 'calendar' && (
                  <SimpleCard className="p-4">
                    <div className="grid grid-cols-7 gap-1 text-center mb-2">
                      {['日','月','火','水','木','金','土'].map(d => <div key={d} className="text-[10px] text-zinc-600 font-bold">{d}</div>)}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                      {calendarDays.map((day, i) => {
                        if (day === null) return <div key={i} />;
                        const amt = summary.dailyTotals[day] || 0;
                        const targetDate = new Date(month + '-' + String(day).padStart(2,'0'));
                        const today = new Date();
                        today.setHours(0,0,0,0);
                        const isToday = day === today.getDate() && month === getMonthString(today);
                        const isFuture = targetDate > today;
                        const isNMD = amt === 0 && !isFuture;
                        const dateStr = month + '-' + String(day).padStart(2,'0');
                        return (
                          <div key={i} onClick={() => openModalWithDate(dateStr)} className={`aspect-square rounded-lg border flex flex-col items-center justify-center relative active:scale-95 transition-transform cursor-pointer ${isToday ? 'border-white bg-white/10' : 'border-white/5 bg-black/20'}`}>
                            <span className={`text-[9px] font-bold tabular-nums ${isToday ? 'text-white' : 'text-zinc-500'}`}>{day}</span>
                            {amt > 0 && <span className="text-[8px] font-bold text-zinc-300 tracking-tighter mt-0.5 tabular-nums">¥{(amt/1000).toFixed(1)}k</span>}
                            {isNMD && <span className="absolute text-xs">✨</span>}
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-center text-[9px] text-zinc-600 mt-4">✨ = No Money Day (支出ゼロ)</p>
                  </SimpleCard>
                )}
              </div>
            )}

            {/* ANALYSIS TAB */}
            {activeTab === 'analysis' && (
              <div className="p-4 space-y-4 animate-in fade-in duration-500">
                <SimpleCard className="p-6">
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-4">先月との比較</p>
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <h3 className="text-4xl font-black text-white tabular-nums">¥{summary.totalSpent.toLocaleString()}</h3>
                      <div className="flex items-center gap-1.5 mt-2">
                        {summary.totalSpent <= summary.lastTotalSpent ? <TrendingDown size={16} className="text-green-400"/> : <TrendingUp size={16} className="text-red-400"/>}
                        <span className={`text-xs font-bold ${summary.totalSpent <= summary.lastTotalSpent ? 'text-green-400' : 'text-red-400'}`}>先月より ¥{Math.abs(summary.totalSpent - summary.lastTotalSpent).toLocaleString()} {summary.totalSpent <= summary.lastTotalSpent ? '減少' : '増加'}</span>
                      </div>
                    </div>
                    <div className="text-right"><p className="text-[10px] text-zinc-600 uppercase font-bold">先月の総支出</p><p className="text-sm font-bold text-zinc-500 tabular-nums">¥{summary.lastTotalSpent.toLocaleString()}</p></div>
                  </div>
                </SimpleCard>
                <SimpleCard className="p-6 space-y-6">
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">カテゴリ別 比較</p>
                  <div className="space-y-6">
                    {getCategoryNames().map(catName => {
                      const icon = getCategoryIcon(catName);
                      const current = summary.catTotals[catName] || 0;
                      const last = summary.lastCatTotals[catName] || 0;
                      const max = Math.max(current, last, 1);
                      return (
                        <div key={catName} className="space-y-2">
                          <div className="flex justify-between items-center font-bold">
                            <div className="flex items-center gap-2"><span className="text-sm">{icon}</span><span className="text-xs text-zinc-300">{catName}</span></div>
                            <div className="flex gap-3 text-[10px] tabular-nums"><span className="text-zinc-500">先月 ¥{last.toLocaleString()}</span><span className="text-white">今月 ¥{current.toLocaleString()}</span></div>
                          </div>
                          <div className="space-y-1"><div className="h-1.5 bg-white/5 rounded-full overflow-hidden"><div className={`h-full rounded-full transition-all duration-1000 bg-zinc-500`} style={{ width: `${(current / max) * 100}%` }} /></div><div className="h-1 bg-white/5 rounded-full overflow-hidden opacity-30"><div className="h-full bg-zinc-400 rounded-full transition-all duration-1000" style={{ width: `${(last / max) * 100}%` }} /></div></div>
                        </div>
                      );
                    })}
                  </div>
                </SimpleCard>
              </div>
            )}

            {/* SETUP TAB */}
            {activeTab === 'settings' && (
              <div key={month}>
                {settingTab !== 'menu' && (
                    <div className="sticky top-0 z-10 bg-[#121212]/80 backdrop-blur-xl border-b border-white/5 px-4 py-2 w-full flex items-center">
                        <button onClick={() => { 
                            triggerHaptic();
                            setSettingTab('menu'); 
                            setTimeout(() => { if(mainRef.current) mainRef.current.scrollTop = 0; }, 0); 
                        }} className="flex items-center gap-2 text-zinc-500 text-xs font-bold active:scale-95 transition-transform"><ArrowLeft size={16}/> 戻る</button>
                    </div>
                )}
                
                {/* Content Wrapper with Padding */}
                <div className="p-4 space-y-4 animate-in fade-in duration-500">
                    {settingTab === 'menu' && (
                      <div className="space-y-6 pb-10">
                        {/* Account Info */}
                        <div className="flex flex-col gap-1 px-2">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    {user.photoURL ? (
                                        <img src={user.photoURL} alt="icon" className="w-8 h-8 rounded-full object-cover" />
                                    ) : (
                                        <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-white"><User size={16}/></div>
                                    )}
                                    <span className="text-xs font-bold text-white">{user.email}</span>
                                </div>
                                <button onClick={handleLogout} className="text-zinc-500 text-[10px] font-bold hover:text-white transition-colors flex items-center gap-1.5"><LogOut size={14}/> ログアウト</button>
                            </div>
                        </div>

                        {/* Menu Items */}
                        <div className="space-y-3">
                            {[{ id: 'budget', label: '資金計画・引き落とし日', icon: <Landmark size={18}/> }, { id: 'fixed', label: '固定費管理', icon: <CreditCard size={18}/>, value: `¥${((monthlyData.fixedCosts||[]).reduce((s,i)=>s+i.amount,0)).toLocaleString()}` }, { id: 'category', label: 'カテゴリ・予算管理', icon: <Tags size={18}/>, value: `¥${(config.categories.reduce((s,c)=>s+(Number(monthlyData.catBudgets?.[(typeof c==='string'?c:c.name)])||0),0)).toLocaleString()}` }, { id: 'template', label: 'テンプレート編集', icon: <Zap size={18}/> }, { id: 'payment', label: '支払方法・カード編集', icon: <Wallet size={18}/> }].map(item => (
                              <button key={item.id} onClick={() => { triggerHaptic(); setSettingTab(item.id); }} className="w-full flex items-center justify-between p-5 bg-[#1E1E1E] rounded-lg border border-white/5 text-sm font-bold active:scale-95 transition-all text-zinc-300">
                                <div className="flex items-center gap-4">
                                  {item.icon}
                                  <span className="text-sm font-bold">{item.label}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    {item.value && <span className="text-[10px] text-zinc-500 font-mono mt-0.5 tabular-nums">{item.value}</span>}
                                </div>
                              </button>
                            ))}
                        </div>
                        
                        {/* Copy Button */}
                        <div className="pt-4 flex justify-center flex-col items-center gap-4">
                            <button onClick={copyLastMonthSettings} className="flex items-center gap-2 px-6 py-3 bg-transparent border border-white/30 text-zinc-300 rounded-full text-xs font-bold active:scale-95 transition-all hover:bg-white/5">
                                <CopyCheck size={16}/> 先月の設定をコピー
                            </button>
                            
                            <button onClick={handleExportCSV} className="text-zinc-600 text-[10px] flex items-center gap-2 hover:text-white transition-colors underline">
                                <FileText size={12}/> 全データをCSV出力
                            </button>
                        </div>
                      </div>
                    )}

                    {/* Loading State */}
                    {monthLoading ? (
                       <div className="space-y-4">
                           <Skeleton className="h-40 w-full" />
                           <Skeleton className="h-40 w-full" />
                       </div>
                    ) : (
                      <>
                        {settingTab === 'budget' && (
                          <div className="space-y-4 font-bold">
                            <SimpleCard className="p-5 space-y-4">
                              <div className="flex justify-between items-center"><p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">給与・軍資金設定</p></div>
                              <div className="space-y-3">
                                <div className="flex flex-col gap-1"><label className="text-[9px] text-zinc-600 pl-1 font-bold">今月の給与 (手取り)</label><input key={month} type="number" defaultValue={monthlyData.salary} onBlur={e => setDoc(doc(db,'users',user.uid,'months',month),{salary:Number(e.target.value)},{merge:true})} className="w-full h-11 bg-black/20 border border-white/10 rounded-lg px-4 text-sm text-white outline-none font-bold" /></div>
                                <div className="flex flex-col gap-1"><label className="text-[9px] text-zinc-600 pl-1 font-bold">カード軍資金</label><input key={month} type="number" defaultValue={monthlyData.budget} onBlur={e => setDoc(doc(db,'users',user.uid,'months',month),{budget:Number(e.target.value)},{merge:true})} className="w-full h-11 bg-black/20 border border-white/10 rounded-lg px-4 text-sm text-white outline-none font-bold" /></div>
                                <div className="flex flex-col gap-1"><label className="text-[9px] text-zinc-600 pl-1 font-bold">現金軍資金</label><input key={month} type="number" defaultValue={monthlyData.cashBudget} onBlur={e => setDoc(doc(db,'users',user.uid,'months',month),{cashBudget:Number(e.target.value)},{merge:true})} className="w-full h-11 bg-black/20 border border-white/10 rounded-lg px-4 text-sm text-white outline-none font-bold" /></div>
                              </div>
                            </SimpleCard>
                            <SimpleCard className="p-5 space-y-4">
                              <div className="flex justify-between items-center">
                                <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">カード別請求 & 引き落とし日</p>
                                <span className="text-[10px] font-mono text-white tabular-nums">合計: ¥{(Object.values(monthlyData.cardBills || {}).reduce((s, v) => s + (Number(v) || 0), 0)).toLocaleString()}</span>
                              </div>
                              <div className="space-y-3">
                                {config.paymentMethods.filter(m => m !== '現金').map(m => (
                                  <div key={m} className="flex gap-2 items-center"><span className="text-[9px] text-zinc-500 w-14 truncate font-bold">{m}</span><input key={`${month}-${m}-bill`} type="number" placeholder="金額" defaultValue={monthlyData.cardBills?.[m] || 0} onBlur={e => setDoc(doc(db,'users',user.uid,'months',month),{cardBills:{...monthlyData.cardBills,[m]:Number(e.target.value)}},{merge:true})} className="flex-1 h-10 bg-black/20 border border-white/10 rounded-lg px-3 text-xs text-white" /><input key={`${month}-${m}-date`} type="number" placeholder="日" defaultValue={monthlyData.cardDueDates?.[m] || ''} onBlur={e => setDoc(doc(db,'users',user.uid,'months',month),{cardDueDates:{...monthlyData.cardDueDates,[m]:e.target.value}},{merge:true})} className="w-12 h-10 bg-black/20 border border-white/10 rounded-lg px-1 text-xs text-center text-white" /></div>
                                ))}
                              </div>
                            </SimpleCard>
                          </div>
                        )}

                        {settingTab === 'fixed' && (
                          <SimpleCard className="p-5 space-y-2">
                            <div className="flex justify-between items-center mb-2">
                                <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">固定費管理</p>
                                <span className="text-[10px] font-mono text-white tabular-nums">合計: ¥{summary.fixedTotal.toLocaleString()}</span>
                            </div>
                            <div className="divide-y divide-white/5">
                              {(monthlyData.fixedCosts || []).map((f, idx) => (
                                <div key={f.id} onClick={() => { triggerHaptic(); setEditingItem({ type: 'fixed', data: f, index: idx }); }} className="flex justify-between items-center py-3 cursor-pointer active:opacity-70 transition-opacity">
                                  <div className="flex flex-col">
                                      <span className="text-xs text-zinc-200 font-bold">{f.name}</span>
                                      <span className="text-[9px] text-zinc-500">{f.method || '未設定'}</span>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className="text-sm font-bold tabular-nums text-white">¥{f.amount.toLocaleString()}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div className="pt-4 border-t border-white/5">
                                <button onClick={() => { triggerHaptic(); setEditingItem({ type: 'fixed', data: { name: '', amount: '', method: config.paymentMethods[0] }, index: -1 }); }} className="w-full h-11 bg-zinc-200 text-black rounded-lg font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-2"><Plus size={14}/> 固定費を追加</button>
                            </div>
                          </SimpleCard>
                        )}

                        {settingTab === 'category' && (
                          <SimpleCard className="p-5 space-y-2">
                            <div>
                              <div className="flex justify-between items-center mb-4">
                                <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">カテゴリ設定</p>
                                <span className="text-[10px] font-mono text-white tabular-nums">予算計: ¥{(config.categories.reduce((s,c)=>s+(Number(monthlyData.catBudgets?.[(typeof c==='string'?c:c.name)])||0),0)).toLocaleString()}</span>
                              </div>
                              <div className="divide-y divide-white/5">
                                {config.categories.map((c, idx) => {
                                  const cName = typeof c === 'string' ? c : c.name;
                                  const cIcon = typeof c === 'string' ? '🏷' : c.icon;
                                  const budget = monthlyData.catBudgets?.[cName] || 0;
                                  return (
                                    <div key={idx} onClick={() => { triggerHaptic(); setEditingItem({ type: 'category', data: { name: cName, icon: cIcon, budget, originalName: cName }, index: idx }); }} className="flex justify-between items-center py-3 cursor-pointer active:opacity-70 transition-opacity">
                                        <div className="flex items-center gap-3">
                                            <span className="text-xl w-8 text-center">{cIcon}</span>
                                            <span className="text-xs font-bold text-white">{cName}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {budget > 0 && <span className="text-[10px] text-zinc-500 tabular-nums">予算: ¥{budget.toLocaleString()}</span>}
                                            <div className="flex gap-1">
                                                <button onClick={(e) => handleMoveCategory(idx, 'up', e)} className={`p-1 rounded hover:bg-white/10 ${idx === 0 ? 'text-zinc-700' : 'text-zinc-400'}`}><ArrowUp size={14}/></button>
                                                <button onClick={(e) => handleMoveCategory(idx, 'down', e)} className={`p-1 rounded hover:bg-white/10 ${idx === config.categories.length - 1 ? 'text-zinc-700' : 'text-zinc-400'}`}><ArrowDown size={14}/></button>
                                            </div>
                                        </div>
                                    </div>
                                  );
                                })}
                              </div>
                              <div className="pt-4 mt-2 border-t border-white/5">
                                <button onClick={() => { triggerHaptic(); setEditingItem({ type: 'category', data: { name: '', icon: '🏷', budget: '' }, index: -1 }); }} className="w-full h-11 bg-zinc-200 text-black rounded-lg font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-2"><Plus size={14}/> カテゴリを追加</button>
                              </div>
                            </div>
                          </SimpleCard>
                        )}

                        {settingTab === 'template' && (
                          <SimpleCard className="p-5 space-y-2">
                            <div>
                              <p className="text-[10px] text-zinc-500 uppercase font-bold mb-4 tracking-widest">テンプレート一覧</p>
                              <div className="divide-y divide-white/5">
                                {(config.templates || []).map((t, idx) => (
                                  <div key={idx} onClick={() => { triggerHaptic(); setEditingItem({ type: 'template', data: t, index: idx }); }} className="flex items-center justify-between py-3 cursor-pointer active:opacity-70 transition-opacity">
                                    <div className="flex flex-col">
                                      <span className="text-xs font-bold text-white">{t.title}</span>
                                      <span className="text-[10px] text-zinc-500">¥{t.amount} / {t.category} / {t.method}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                              <div className="pt-4 mt-2 border-t border-white/5">
                                <button onClick={() => { triggerHaptic(); setEditingItem({ type: 'template', data: { title: '', amount: '', category: getCategoryNames()[0], method: config.paymentMethods[0] }, index: -1 }); }} className="w-full h-11 bg-zinc-200 text-black rounded-lg font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-2"><Plus size={14}/> テンプレートを追加</button>
                              </div>
                            </div>
                          </SimpleCard>
                        )}

                        {settingTab === 'payment' && (
                          <SimpleCard className="p-5 space-y-6">
                             <div>
                               <p className="text-[10px] text-zinc-500 uppercase font-bold mb-4 tracking-widest">支払方法一覧</p>
                               <div className="flex flex-wrap gap-2 mb-6">{config.paymentMethods.map((m, idx) => (
                                 <div key={m} onClick={() => { triggerHaptic(); setEditingItem({ type: 'payment', data: { name: m }, index: idx }); }} className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-lg border border-white/10 text-xs text-zinc-300 font-bold cursor-pointer active:scale-95 transition-transform">{m}</div>
                               ))}</div>
                               <div className="pt-4 border-t border-white/5">
                                 <button onClick={() => { triggerHaptic(); setEditingItem({ type: 'payment', data: { name: '' }, index: -1 }); }} className="w-full h-11 bg-zinc-200 text-black rounded-lg font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2"><Plus size={14}/> 支払方法を追加</button>
                               </div>
                             </div>
                          </SimpleCard>
                        )}
                      </>
                    )}
                </div>
              </div>
            )}
          </div>
        </main>

        {/* FOOTER (Glassmorphism) */}
        <footer className="absolute bottom-0 w-full max-w-md h-24 border-t border-white/5 flex justify-between items-center px-6 pb-6 z-50 bg-[#121212]/80 backdrop-blur-xl">
          <NavButton active={activeTab === 'home'} onClick={() => { triggerHaptic(); setActiveTab('home'); }} icon={<Home size={24}/>} />
          <NavButton active={activeTab === 'log'} onClick={() => { triggerHaptic(); setActiveTab('log'); }} icon={<History size={24}/>} />
          <NavButton active={activeTab === 'analysis'} onClick={() => { triggerHaptic(); setActiveTab('analysis'); }} icon={<BarChart3 size={24}/>} />
          <NavButton active={activeTab === 'settings'} onClick={() => { triggerHaptic(); setActiveTab('settings'); setSettingTab('menu'); }} icon={<Settings size={24}/>} />
          <button onClick={() => { triggerHaptic(); setEditingTx(null); setInputDate(getTodayString()); setInputAmount(''); setShowCalculator(false); setIsModalOpen(true); }} className="flex items-center justify-center w-14 h-14 bg-white text-black rounded-full shadow-[0_0_15px_rgba(255,255,255,0.4)] active:scale-90 transition-transform ml-2">
            <Plus size={28}/>
          </button>
        </footer>

      </div>

      {/* EDIT SETTINGS MODAL */}
      {editingItem && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setEditingItem(null)}>
          <div className="w-full h-[90vh] sm:h-auto sm:max-w-md bg-[#1E1E1E] sm:rounded-lg rounded-t-2xl border border-white/5 shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex-none p-4 border-b border-white/5 flex justify-between items-center">
                <h2 className="text-xs font-bold uppercase text-white tracking-widest">編集</h2>
                <button onClick={() => setEditingItem(null)} className="p-2 -mr-2 text-zinc-500 hover:text-white"><X size={20}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 pb-32">
              <div className="space-y-6">
                  {editingItem.type === 'category' && (
                      <>
                          <div className="flex gap-2">
                              <input value={editingItem.data.icon} onChange={e => setEditingItem({...editingItem, data: { ...editingItem.data, icon: e.target.value }})} className="w-12 h-12 text-center bg-black/20 border border-white/10 rounded-lg text-xl text-white outline-none" />
                              <input value={editingItem.data.name} onChange={e => setEditingItem({...editingItem, data: { ...editingItem.data, name: e.target.value }})} className="flex-1 h-12 bg-black/20 border border-white/10 rounded-lg px-3 text-sm text-white outline-none" placeholder="カテゴリ名" />
                          </div>
                          <div className="flex flex-col gap-1">
                              <label className="text-[9px] text-zinc-500 font-bold">月間予算</label>
                              <input type="number" value={editingItem.data.budget} onChange={e => setEditingItem({...editingItem, data: { ...editingItem.data, budget: e.target.value }})} className="w-full h-12 bg-black/20 border border-white/10 rounded-lg px-3 text-sm text-white outline-none" placeholder="0" />
                          </div>
                      </>
                  )}
                  {/* ... (Fixed, Template, Payment - Same as before) ... */}
                  {editingItem.type === 'fixed' && (
                      <>
                          <input value={editingItem.data.name} onChange={e => setEditingItem({...editingItem, data: { ...editingItem.data, name: e.target.value }})} className="w-full h-12 bg-black/20 border border-white/10 rounded-lg px-3 text-sm text-white outline-none" placeholder="固定費名" />
                          <input type="number" value={editingItem.data.amount} onChange={e => setEditingItem({...editingItem, data: { ...editingItem.data, amount: e.target.value }})} className="w-full h-12 bg-black/20 border border-white/10 rounded-lg px-3 text-sm text-white outline-none" placeholder="金額" />
                          <select value={editingItem.data.method} onChange={e => setEditingItem({...editingItem, data: { ...editingItem.data, method: e.target.value }})} className="w-full h-12 bg-black/20 border border-white/10 rounded-lg px-3 text-sm text-white outline-none">{config.paymentMethods.map(m=><option key={m} value={m}>{m}</option>)}</select>
                      </>
                  )}
                  {editingItem.type === 'template' && (
                      <>
                          <input value={editingItem.data.title} onChange={e => setEditingItem({...editingItem, data: { ...editingItem.data, title: e.target.value }})} className="w-full h-12 bg-black/20 border border-white/10 rounded-lg px-3 text-sm text-white outline-none" placeholder="テンプレート名" />
                          <input type="number" value={editingItem.data.amount} onChange={e => setEditingItem({...editingItem, data: { ...editingItem.data, amount: e.target.value }})} className="w-full h-12 bg-black/20 border border-white/10 rounded-lg px-3 text-sm text-white outline-none" placeholder="金額" />
                          <div className="flex gap-2">
                              <select value={editingItem.data.category} onChange={e => setEditingItem({...editingItem, data: { ...editingItem.data, category: e.target.value }})} className="flex-1 h-12 bg-black/20 border border-white/10 rounded-lg px-2 text-xs text-white outline-none">{getCategoryNames().map(c=><option key={c} value={c}>{c}</option>)}</select>
                              <select value={editingItem.data.method} onChange={e => setEditingItem({...editingItem, data: { ...editingItem.data, method: e.target.value }})} className="flex-1 h-12 bg-black/20 border border-white/10 rounded-lg px-2 text-xs text-white outline-none">{config.paymentMethods.map(m=><option key={m} value={m}>{m}</option>)}</select>
                          </div>
                      </>
                  )}
                  {editingItem.type === 'payment' && (
                      <input value={editingItem.data.name} onChange={e => setEditingItem({...editingItem, data: { ...editingItem.data, name: e.target.value }})} className="w-full h-12 bg-black/20 border border-white/10 rounded-lg px-3 text-sm text-white outline-none" placeholder="支払方法名" />
                  )}

                  <div className="flex gap-2 pt-2">
                      {editingItem.index !== -1 && (
                          <button onClick={handleDeleteItem} className="w-12 h-12 flex items-center justify-center bg-red-900/20 text-red-500 rounded-lg hover:bg-red-900/30 transition-colors"><Trash2 size={18}/></button>
                      )}
                      <button onClick={handleSettingsSave} className="flex-1 h-12 bg-white text-black rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-zinc-200 transition-colors">保存</button>
                  </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TX MODAL & FAB */}
      <div className="fixed bottom-28 w-full max-w-md px-6 flex justify-end pointer-events-none"></div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setIsModalOpen(false)}>
          <div className="w-full max-h-[90vh] sm:h-auto sm:max-w-md bg-[#1E1E1E] sm:rounded-lg rounded-t-2xl border border-white/5 shadow-2xl flex flex-col animate-in slide-in-from-bottom duration-300" onClick={(e) => e.stopPropagation()}>
            {showCalculator ? (
              <div className="flex-1 p-5">
                <div className="flex justify-between items-center mb-4"><h2 className="text-[10px] font-bold uppercase text-white tracking-widest">電卓</h2><button onClick={() => setShowCalculator(false)} className="text-zinc-500"><X size={18}/></button></div>
                <CalculatorPad 
                  initialValue={inputAmount || 0} 
                  onConfirm={(val) => { setInputAmount(val); setShowCalculator(false); }} 
                />
              </div>
            ) : (
                <>
                  <div className="flex-none p-4 border-b border-white/5 flex justify-between items-center">
                    <h2 className="text-xs font-bold uppercase text-white tracking-widest">{editingTx ? '支出を編集' : '支出入力'}</h2>
                    <button onClick={() => setIsModalOpen(false)} className="p-2 -mr-2 text-zinc-500 hover:text-white"><X size={20}/></button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-5 pb-32">
                    <form onSubmit={handleTxSubmit} className="space-y-6">
                        <div className="flex gap-2 items-center">
                        <input name="amount" type="number" value={inputAmount} onChange={e => setInputAmount(e.target.value)} className="flex-1 w-full h-12 bg-black/20 border border-white/10 rounded-lg text-lg font-bold text-left px-4 text-white outline-none tabular-nums font-bold" placeholder="0" autoFocus required />
                        <button type="button" onClick={() => setShowCalculator(true)} className="w-12 h-12 flex items-center justify-center bg-white/10 rounded-lg text-white hover:bg-white/20 active:scale-95 transition-all"><Calculator size={20}/></button>
                        </div>
                        <input name="title" type="text" defaultValue={editingTx?.title || ''} className="w-full h-11 bg-black/20 border border-white/10 rounded-lg px-4 text-sm text-white font-bold" placeholder="タイトル (例: ランチ)" />
                        <div className="flex flex-row gap-4 w-full box-border">
                        <div className="flex-1 flex flex-col gap-1.5 overflow-hidden"><label className="text-[9px] text-zinc-500 uppercase pl-1 font-bold">日付</label><input name="date" type="date" value={inputDate} onChange={(e) => setInputDate(e.target.value)} className="w-full h-11 bg-black/20 border border-white/10 rounded-lg text-xs px-2 text-white outline-none appearance-none font-bold" /></div>
                        <div className="flex-1 flex flex-col gap-1.5 overflow-hidden"><label className="text-[9px] text-zinc-500 uppercase pl-1 font-bold">カテゴリ</label><select name="category" defaultValue={editingTx?.category || (getCategoryNames()[0])} className="w-full h-11 bg-black/20 border border-white/10 rounded-lg text-xs px-2 text-white outline-none appearance-none font-bold">{getCategoryNames().map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                        </div>
                        <div className="flex flex-wrap gap-2 justify-start font-bold uppercase">
                        {config.paymentMethods.map(m => (<label key={m} className="cursor-pointer"><input type="radio" name="method" value={m} className="peer hidden" defaultChecked={editingTx?.paymentMethod === m || (!editingTx && m === config.paymentMethods[0])} required /><div className="px-3 py-2 text-xs min-w-[60px] text-center rounded-lg border border-zinc-800 font-bold text-zinc-500 peer-checked:bg-white peer-checked:text-black transition-all flex items-center justify-center">{m}</div></label>))}
                        </div>
                        {!editingTx && config.templates && (
                        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                            {config.templates.map((tpl, i) => (
                            <button key={i} type="button" onClick={() => applyTemplate(tpl)} className="flex-shrink-0 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-[10px] font-bold text-zinc-400 hover:bg-white/10 flex items-center gap-1.5"><Zap size={10} className="text-yellow-400"/> {tpl.title}</button>
                            ))}
                        </div>
                        )}
                        <div className="flex gap-2 pt-2">
                            {editingTx && (
                                <button type="button" onClick={() => { 
                                    if(window.confirm('削除しますか？')) {
                                        deleteDoc(doc(db,'users',user.uid,'transactions',editingTx.id));
                                        setIsModalOpen(false);
                                    }
                                }} className="w-12 h-12 flex items-center justify-center bg-red-900/20 text-red-500 rounded-lg hover:bg-red-900/30 transition-colors"><Trash2 size={18}/></button>
                            )}
                            <button type="submit" className="flex-1 h-12 bg-white text-black font-bold rounded-lg text-xs uppercase tracking-widest shadow-lg active:scale-95 transition-transform font-black">保存する</button>
                        </div>
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
