import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import {
  getFirestore, collection, doc, setDoc, onSnapshot, query, deleteDoc,
  where, getDocs, getDoc, orderBy, addDoc, updateDoc, serverTimestamp,
  documentId
} from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth';
import {
  Wallet, CreditCard, Landmark, Plus, Settings, Trash2, History,
  ChevronLeft, ChevronRight, X, Tags, ArrowLeft, CopyCheck, Calendar,
  CheckCircle2, BarChart3, TrendingDown, TrendingUp, Banknote,
  Search, CalendarDays, AlignJustify, Zap, Calculator, Delete, LogOut, 
  Lock, User, FileText, Home, Sparkles, ChevronDown, HelpCircle, Pencil
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
const CASH = '現金';

/* --- UTILS --- */
const getMonthString = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
const formatMonthJP = (mStr) => mStr ? `${mStr.split('-')[0]}年 ${Number(mStr.split('-')[1])}月` : "";
const formatFullDateJP = (iso) => iso ? `${new Date(iso).getFullYear()}年${new Date(iso).getMonth() + 1}月${new Date(iso).getDate()}日` : '';
const getTodayString = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const toNumber = (v) => v ? Number(String(v).replace(/,/g, '')) || 0 : 0;
const toISODateSafe = (yyyyMmDd) => yyyyMmDd ? new Date(`${yyyyMmDd}T12:00:00`).toISOString() : new Date().toISOString();
const isoToLocalYMD = (iso) => {
  if (!iso) return getTodayString();
  const d = new Date(iso);
  return isNaN(d.getTime()) ? getTodayString() : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const normalizeMonthlyData = (d = {}) => {
  const absorbedDueDates = { ...(d.cardDueDates || {}) };
  const absorbedCardBills = { ...(d.cardBills || {}) };
  Object.keys(d).forEach(k => {
    if (k.startsWith('cardDueDates.')) absorbedDueDates[k.split('.')[1]] = d[k];
    if (k.startsWith('cardBills.')) absorbedCardBills[k.split('.')[1]] = d[k];
  });
  return {
    salary: d.salary || 0, budget: d.budget || 0, cashBudget: d.cashBudget || 0,
    cardBills: absorbedCardBills, fixedCosts: d.fixedCosts || [],
    catBudgets: d.catBudgets || {}, cardDueDates: absorbedDueDates,
    confirmedPayments: d.confirmedPayments || [], savings: d.savings || 0, memo: d.memo || ''
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
        <p className="text-xs text-zinc-400 text-center">画面を再読み込みしてください。</p>
        <button onClick={() => window.location.reload()} className="px-6 py-3 bg-white text-black rounded-full font-bold text-sm">再読み込み</button>
      </div>
    );
    return this.props.children;
  }
}

const SimpleCard = ({ children, className = "", onClick }) => (
  <div onClick={onClick} className={`bg-[#1E1E1E] rounded-xl border border-white/5 shadow-lg overflow-hidden w-full ${className}`}>{children}</div>
);

const NavButton = ({ active, onClick, icon }) => (
  <button onClick={onClick} className={`flex items-center justify-center w-16 h-16 transition-all ${active ? 'text-white scale-110 drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]' : 'text-zinc-600'}`}>{icon}</button>
);

const Toast = ({ message, isVisible }) => (
  <div className={`fixed bottom-28 left-1/2 -translate-x-1/2 z-[80] transition-all pointer-events-none ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
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

const safeEval = (str) => {
  try {
    const cleanStr = str.replace(/[^0-9+\-*/.]/g, '');
    return Function(`'use strict'; return (${cleanStr})`)();
  } catch { return 0; }
};

const CalculatorPad = ({ initialValue, onConfirm }) => {
  const [display, setDisplay] = useState(String(initialValue || '0'));
  const handlePush = (val) => setDisplay(prev => prev === '0' && val !== '.' ? String(val) : prev + val);
  return (
    <div className="w-full flex flex-col gap-3" onClick={e => e.stopPropagation()}>
      <div className="bg-black/40 rounded-lg p-3 text-right border border-white/5 font-mono text-2xl text-white break-all">{display}</div>
      <div className="grid grid-cols-4 gap-2 h-64">
        {['7','8','9','/','4','5','6','*','1','2','3','-','0','.','C','+'].map(l => (
          <button key={l} type="button" onClick={() => l==='C' ? setDisplay('0') : handlePush(l)} className="rounded-lg bg-zinc-800 border border-white/5 text-lg font-bold text-white active:bg-zinc-700">{l}</button>
        ))}
        <button type="button" onClick={() => setDisplay(String(safeEval(display)))} className="col-span-4 h-12 bg-emerald-600 rounded-lg font-bold text-white">=</button>
      </div>
      <button type="button" onClick={() => onConfirm(toNumber(display))} className="w-full h-14 bg-white text-black rounded-lg font-black uppercase tracking-widest mt-2">決定</button>
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
        { q: '手取り給与 (salary)', a: '家計のすべてのベース（収入）として使われます。\n影響する場所: ホーム画面の「今月の自由な現金」「来月末の着地予想」のスタート金額になります。' },
        { q: 'クレジットカード利用目安 (budget)', a: 'クレカを使いすぎていないかの「ペースメーカー」になります。\n影響する場所: ホーム画面左上の「今のカード利用額」のプログレスバーと「AIアドバイス」の判定基準に使われます。' },
        { q: '月初のスタート現金 (cashBudget)', a: '毎月1日に、お財布と口座にある「今月使える現金の実数」を入力します。\n影響する場所: ホーム画面の「今の現金残り」の計算元になります。' },
        { q: '今月の積立額 (savings)', a: '「絶対に使ってはいけないお金（先取り）」として差し引かれます。\n影響する場所: ホームの各予測値からマイナスされ、積立総額に加算されます。' },
        { q: '引落予定のカード（引落額）', a: '「先月使った分のツケ」として扱われます。\n影響する場所: ホーム画面の「今月の自由な現金」からマイナスされます。' },
        { q: '固定費管理', a: '現金払いのものは「今月の自由な現金」から引かれ、全固定費の合計は「来月末の着地予想」から引かれます。' },
        { q: 'カテゴリ予算', a: 'カテゴリごとの使いすぎ防止枠です。\n影響する場所: ホームと分析タブの「カテゴリ別予算状況」の分母に使われます。' }
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
    const end = new Date(new Date(`${month}-01T00:00:00`).setMonth(new Date(`${month}-01T00:00:00`).getMonth() + 1)).toISOString();
    return onSnapshot(query(collection(db, 'users', user.uid, 'transactions'), where('date', '>=', start), where('date', '<', end)), s => {
      setTransactions(s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => new Date(b.date) - new Date(a.date)));
    });
  }, [month, user]);

  useEffect(() => {
    if (!user) return;
    const prevD = new Date(`${month}-01T00:00:00`); prevD.setMonth(prevD.getMonth() - 1);
    const pStart = new Date(`${getMonthString(prevD)}-01T00:00:00`).toISOString();
    const cStart = new Date(`${month}-01T00:00:00`).toISOString();
    getDocs(query(collection(db, 'users', user.uid, 'transactions'), where('date', '>=', pStart), where('date', '<', cStart)))
      .then(s => setLastMonthTransactions(s.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [month, user]);

  useEffect(() => {
    if (!user) return;
    onSnapshot(doc(db, 'users', user.uid, 'months', month), s => setMonthlyData(normalizeMonthlyData(s.data())));
    onSnapshot(doc(db, 'users', user.uid, 'settings', 'config'), s => s.exists() && setConfig(normalizeConfig(s.data())));
  }, [month, user]);

  useEffect(() => {
    if (!user) return;
    getDocs(query(collection(db, 'users', user.uid, 'months'), where(documentId(), '<=', month), orderBy(documentId(), 'asc')))
      .then(s => { let sum = 0; s.forEach(d => { sum += Number(d.data().savings || 0); }); setSavingsTotalToMonth(sum); });
  }, [user, month]);

  useEffect(() => { setMemoText(monthlyData?.memo || ''); }, [monthlyData?.memo]);

  /* --- SUMMARY --- */
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
    const spentCard = normalTx.filter(t => t.paymentMethod !== CASH).reduce((s, t) => s + toNumber(t.amount), 0);
    const spentCash = normalTx.filter(t => t.paymentMethod === CASH).reduce((s, t) => s + toNumber(t.amount), 0);

    const withdrawalOnly = fixedCash + billTotal;
    const cardTarget = Number(d.budget) > 0 ? Number(d.budget) : 100000;
    
    const currentFreeCash = salary - withdrawalOnly - savings;
    const projectedCash = salary - spentCard - fixedTotal - savings;
    const cashRemaining = cashBudget - spentCash;

    const catTotals = normalTx.reduce((acc, t) => { acc[t.category] = (acc[t.category] || 0) + toNumber(t.amount); return acc; }, {});
    const catBudgetSum = (config?.categories || []).reduce((sum, c) => sum + (d.catBudgets?.[c.name] || 0), 0);
    
    const normalLastTx = (lastMonthTransactions || []).filter(t => !t.isSpecial);
    const lastCatTotals = normalLastTx.reduce((acc, t) => { acc[t.category] = (acc[t.category] || 0) + toNumber(t.amount); return acc; }, {});

    return {
      cardTarget, spentCard, cardPacePercent: Math.min(100, (spentCard / cardTarget) * 100),
      cashBudget, spentCash, cashRemaining, 
      currentFreeCash, projectedCash, savingsAmount: savings,
      catTotals, lastCatTotals, catBudgetSum,
      totalSpent: normalTx.reduce((s, t) => s + toNumber(t.amount), 0),
      lastTotalSpent: normalLastTx.reduce((s, t) => s + toNumber(t.amount), 0),
      dailyTotals: normalTx.reduce((acc, t) => { if(!t.date) return acc; const dObj=new Date(t.date); acc[dObj.getDate()] = (acc[dObj.getDate()]||0) + toNumber(t.amount); return acc; }, {}),
      specialTotalSpent: transactions.filter(t => t.isSpecial).reduce((s, t) => s + toNumber(t.amount), 0),
      lastSpecialTotalSpent: (lastMonthTransactions || []).filter(t => t.isSpecial).reduce((s, t) => s + toNumber(t.amount), 0)
    };
  }, [monthlyData, transactions, lastMonthTransactions, config]);

  // 🌟 進化したAIメッセージロジック
  const aiMessage = useMemo(() => {
    const d = new Date();
    const isCurrentMonth = month === getMonthString(d);
    const today = d.getDate();
    const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const progress = today / daysInMonth;

    if (summary.totalSpent === 0) return { icon: '📝', text: `今月の記録スタート！黄金パターンを目指しましょう。`, color: 'text-zinc-400', bg: 'bg-white/5', border: 'border-white/10' };

    if (summary.spentCard > summary.cardTarget) {
      return { icon: '🚨', text: `カード利用が目安の ¥${summary.cardTarget.toLocaleString()} を超えました！現金の残りでカバーしましょう。`, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' };
    }

    if (summary.cashBudget > 0 && summary.cashRemaining < 0) {
      return { icon: '💸', text: `手持ちの現金が予定よりマイナスです。カード払いで調整できるか確認を！`, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' };
    }

    if (summary.projectedCash < 0) {
      return { icon: '⚠️', text: `このペースだと来月の純利益が赤字になる予測です。出費を見直しましょう！`, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' };
    }

    let topCat = null;
    let topCatRatio = 0;
    const sortedCats = Object.entries(summary.catTotals).sort((a,b) => b[1]-a[1]);
    if(sortedCats.length > 0 && summary.totalSpent > 0){
        topCat = sortedCats[0][0];
        topCatRatio = sortedCats[0][1] / summary.totalSpent;
    }

    if (isCurrentMonth) {
      if (progress < 0.5 && summary.cardPacePercent > 60) {
         return { icon: '🐢', text: `月の前半ですが、カードのペースが早めです。後半は少しセーブ推奨！`, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' };
      }
      if (topCatRatio > 0.4 && summary.catTotals[topCat] > 20000) {
         return { icon: getCategoryIcon(topCat), text: `今月は「${topCat}」への出費が多め（全体の${Math.round(topCatRatio*100)}%）です。意識してみましょう。`, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' };
      }
      if (progress > 0.8 && summary.projectedCash >= 60000) {
         return { icon: '🎯', text: `もうすぐ月末！今月も素晴らしい「黄金パターン」でフィニッシュできそうです！`, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' };
      }
      if (summary.projectedCash >= 60000) {
         return { icon: '✨', text: `今のところ順調です！来月末も ¥${summary.projectedCash.toLocaleString()} の黒字が予測されています。`, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' };
      }
      return { icon: '💡', text: `現在のカード利用は ${Math.round(summary.cardPacePercent)}%。この調子で10万円以内に収めましょう！`, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' };
    } else {
      if (summary.projectedCash >= 60000) {
         return { icon: '🎉', text: `見事 ¥${summary.projectedCash.toLocaleString()} の黒字予想で着地しました！完璧なやりくりです。`, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' };
      }
      return { icon: '🏁', text: `この月は最終的に ¥${summary.projectedCash.toLocaleString()} の黒字（純利益）予測となりました。`, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' };
    }
  }, [summary, month]);

  const activeCategories = getCategoryNames().filter(n => (monthlyData.catBudgets?.[n] || 0) > 0 || (summary.catTotals[n] || 0) > 0);

  const activeAlerts = useMemo(() => {
    const today = new Date().getDate();
    return Object.entries(monthlyData?.cardDueDates || {}).filter(([card, day]) => {
      const dueDay = Number(day);
      const isConfirmed = (monthlyData?.confirmedPayments || []).includes(card);
      return (Number(monthlyData?.cardBills?.[card]) || 0) > 0 && !isConfirmed && dueDay >= today && (dueDay - today) <= 7;
    });
  }, [monthlyData]);

  const showToastMsg = (msg) => { setToast({ visible: true, message: msg }); setTimeout(() => setToast({ visible: false, message: '' }), 2500); };
  const getCategoryNames = () => (config?.categories || []).map(c => c.name);
  const getCategoryIcon = (name) => (config?.categories || []).find(x => x.name === name)?.icon || '🏷';
  const clearLogFilters = () => { setSearchText(''); setFilter({ category: 'ALL', method: 'ALL', special: false }); };

  const handleTxSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;
    const amount = toNumber(inputAmount);
    if (!inputDate || !amount || !inputTitle) return showToastMsg('入力内容を確認してください');
    const payload = { date: toISODateSafe(inputDate), amount, title: inputTitle, category: inputCategory, paymentMethod: inputMethod, isSpecial: inputIsSpecial, updatedAt: serverTimestamp() };
    if (editingTx?.id) await updateDoc(doc(db, 'users', user.uid, 'transactions', editingTx.id), payload);
    else await addDoc(collection(db, 'users', user.uid, 'transactions'), { ...payload, createdAt: serverTimestamp() });
    setIsTxModalOpen(false); showToastMsg('保存しました');
  };

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
        await setDoc(doc(db, 'users', user.uid, 'months', month), { cardBills: newBills, cardDueDates: newDues }, { merge: true });
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
        if (data.budget !== undefined) await setDoc(doc(db, 'users', user.uid, 'months', month), { catBudgets: { ...(monthlyData.catBudgets || {}), [data.name]: toNumber(data.budget) } }, { merge: true });
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
    } catch (e) { showToastMsg('エラー'); }
  };

  const handleDeleteItem = async () => {
    if (!editingItem || !window.confirm('削除しますか？')) return;
    const { type, index, data } = editingItem;
    if (type === 'fixed') await setDoc(doc(db, 'users', user.uid, 'months', month), { fixedCosts: (monthlyData.fixedCosts || []).filter((_, i) => i !== index) }, { merge: true });
    else if (type === 'category') await setDoc(doc(db, 'users', user.uid, 'settings', 'config'), { ...config, categories: (config.categories || []).filter((_, i) => i !== index) }, { merge: true });
    else if (type === 'template') await setDoc(doc(db, 'users', user.uid, 'settings', 'config'), { ...config, templates: (config.templates || []).filter((_, i) => i !== index) }, { merge: true });
    else if (type === 'payment') await setDoc(doc(db, 'users', user.uid, 'settings', 'config'), { ...config, paymentMethods: (config.paymentMethods || []).filter((_, i) => i !== index) }, { merge: true });
    else if (type === 'bill') {
      const newBills = { ...(monthlyData.cardBills || {}) }; const newDues = { ...(monthlyData.cardDueDates || {}) };
      delete newBills[data.name]; delete newDues[data.name];
      await setDoc(doc(db, 'users', user.uid, 'months', month), { cardBills: newBills, cardDueDates: newDues }, { merge: true });
    }
    setEditingItem(null); showToastMsg('削除しました');
  };

  const finalFilteredTx = transactions.filter(t => {
    const matchSearch = searchText === '' || String(t.title || '').includes(searchText);
    const matchCat = filter.category === 'ALL' || t.category === filter.category;
    const matchMethod = filter.method === 'ALL' || t.paymentMethod === filter.method;
    return matchSearch && matchCat && matchMethod && (!filter.special || t.isSpecial);
  });
  const filteredCashTotal = useMemo(() => finalFilteredTx.filter(t => t.paymentMethod === CASH).reduce((s, t) => s + toNumber(t.amount), 0), [finalFilteredTx]);
  const filteredCardTotal = useMemo(() => finalFilteredTx.filter(t => t.paymentMethod !== CASH).reduce((s, t) => s + toNumber(t.amount), 0), [finalFilteredTx]);
  const calendarDaysList = useMemo(() => {
    if (!month) return []; const d = new Date(month + "-01"); if (isNaN(d.getTime())) return [];
    return [...Array(d.getDay()).fill(null), ...Array.from({ length: new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() }, (_, i) => i + 1)];
  }, [month]);

  if (authLoading) return <div className="h-screen bg-[#121212] flex items-center justify-center text-zinc-600">Loading...</div>;
  if (!user) return <div className="h-screen w-full bg-[#121212] flex flex-col items-center justify-center p-6 gap-8"><h1 className="text-4xl font-black text-white">ZAIMU</h1><button onClick={() => signInWithPopup(auth, new GoogleAuthProvider())} className="w-full max-w-xs h-14 bg-white text-black rounded-full font-bold">Google Login</button></div>;

  const SETTING_MENU_ITEMS = [
    { id: 'budget', label: '資金計画・引落日', icon: <Landmark size={18} /> },
    { id: 'fixed', label: '固定費管理', icon: <CreditCard size={18} /> },
    { id: 'category', label: 'カテゴリ予算', icon: <Tags size={18} /> },
    { id: 'template', label: 'テンプレート', icon: <Zap size={18} /> },
    { id: 'payment', label: '支払方法', icon: <Wallet size={18} /> },
    { id: 'faq', label: 'お金の設計図・FAQ', icon: <HelpCircle size={18} /> },
  ];

  return (
    <div className="fixed inset-0 w-full bg-[#121212] text-zinc-200 font-sans flex flex-col justify-center overflow-hidden">
      <Toast message={toast.message} isVisible={toast.visible} />
      <div className="w-full max-w-md h-full flex flex-col relative bg-[#121212] mx-auto shadow-2xl">
        <header className="flex-none h-16 border-b border-white/5 px-4 flex items-center justify-between bg-[#121212]/80 backdrop-blur-xl z-50">
          {activeTab === 'settings' && settingTab !== 'menu' ? (
            <><button onClick={() => setSettingTab('menu')} className="text-zinc-400"><ArrowLeft size={24} /></button><span className="text-xs font-bold uppercase">{SETTING_MENU_ITEMS.find(i=>i.id===settingTab)?.label}</span><div className="w-6" /></>
          ) : (
            <>
              <div className="w-8 h-8 p-1"><img src="/favicon.ico" alt="logo" className="w-full h-full" /></div>
              <div className="flex items-center gap-4"><button onClick={() => { const d = new Date(month + "-01"); d.setMonth(d.getMonth()-1); setMonth(getMonthString(d)) }}><ChevronLeft size={20}/></button><span className="text-sm font-bold">{formatMonthJP(month)}</span><button onClick={() => { const d = new Date(month + "-01"); d.setMonth(d.getMonth()+1); setMonth(getMonthString(d)) }}><ChevronRight size={20}/></button></div>
              <button onClick={() => setMonth(getMonthString(new Date()))} className="text-zinc-500"><Calendar size={20}/></button>
            </>
          )}
        </header>

        <main className="flex-1 overflow-hidden relative flex flex-col">
          {activeTab === 'home' && (
            <div className="flex-1 overflow-y-auto px-4 py-6 space-y-5 pb-32">
              {monthlyData.memo && (
                <div onClick={() => setIsMemoExpanded(!isMemoExpanded)} className="bg-zinc-900 rounded-xl p-3 mb-2 flex gap-2 cursor-pointer border border-white/5">
                  <span>📌</span><div className={`flex-1 text-xs text-zinc-300 ${isMemoExpanded?'whitespace-pre-wrap':'truncate'}`}>{monthlyData.memo}</div><ChevronDown size={14} className={isMemoExpanded?'rotate-180':''}/>
                </div>
              )}
              
              <SimpleCard className="p-0">
                <div className="grid grid-cols-2 divide-x divide-white/5">
                  <div className="p-4 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-1 mb-1 text-[9px] text-zinc-400 font-bold uppercase"><CreditCard size={12}/><p>今のカード利用額</p></div>
                      <h2 className="text-2xl font-bold text-white">¥{summary.spentCard.toLocaleString()}</h2>
                    </div>
                    <div className="mt-4">
                      <div className="flex justify-between text-[8px] text-zinc-500 mb-1"><span>目安</span><span>¥{summary.cardTarget.toLocaleString()}</span></div>
                      <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                        <div className={`h-full transition-all duration-1000 ${summary.spentCard > summary.cardTarget ? 'bg-amber-400' : 'bg-white'}`} style={{ width: `${summary.cardPacePercent}%` }} />
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4 flex flex-col justify-between bg-[#1A1A1A]">
                    <div>
                      <div className="flex items-center gap-1 mb-1 text-[9px] text-zinc-400 font-bold uppercase"><Banknote size={12}/><p>今の現金残り</p></div>
                      <h2 className="text-2xl font-bold text-white">¥{summary.cashRemaining.toLocaleString()}</h2>
                    </div>
                    <div className="mt-4 flex flex-col gap-0.5 text-right">
                      <p className="text-[8px] text-zinc-500">月初スタート: ¥{summary.cashBudget.toLocaleString()}</p>
                      <p className="text-[8px] text-zinc-500">使った現金: ¥{summary.spentCash.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              </SimpleCard>

              <SimpleCard className="p-0">
                <div className="grid grid-cols-2 divide-x divide-white/5">
                  <div className="p-4">
                    <p className="text-[9px] text-zinc-400 font-bold uppercase mb-1">今月の自由な現金</p>
                    <h2 className="text-lg font-bold text-emerald-400">¥{summary.currentFreeCash.toLocaleString()}</h2>
                  </div>
                  <div className="p-4">
                    <p className="text-[9px] text-zinc-400 font-bold uppercase mb-1">来月末の着地予想</p>
                    <h2 className="text-lg font-bold text-white">¥{summary.projectedCash.toLocaleString()}</h2>
                  </div>
                </div>
              </SimpleCard>

              <div className="space-y-3">
                <h3 className="text-[10px] text-zinc-500 uppercase font-black pl-1">カテゴリ別 予算状況</h3>
                <SimpleCard className="grid grid-cols-2 gap-px bg-white/5 p-0 overflow-hidden">
                  {activeCategories.map(n => {
                    const c = summary.catTotals[n] || 0; const b = monthlyData.catBudgets?.[n] || 0;
                    const isOver = b > 0 && c > b; const percent = b > 0 ? Math.min(100, (c/b)*100) : 0;
                    return (
                      <div key={n} className="bg-[#1E1E1E] p-3 flex flex-col">
                        <div className="flex items-center gap-1.5 mb-1.5"><span className="text-sm">{getCategoryIcon(n)}</span><span className="text-[10px] font-bold text-zinc-200 truncate">{n}</span></div>
                        <div className="flex items-baseline gap-1 mb-1.5"><span className={`text-xs font-black ${isOver?'text-red-400':'text-white'}`}>¥{c.toLocaleString()}</span><span className="text-[8px] text-zinc-500">/ ¥{b.toLocaleString()}</span></div>
                        <div className="h-1 bg-white/5 rounded-full overflow-hidden mt-auto"><div className={`h-full ${isOver?'bg-red-400':'bg-white'}`} style={{ width:`${percent}%` }} /></div>
                      </div>
                    );
                  })}
                  {activeCategories.length % 2 !== 0 && <div className="bg-[#1E1E1E]" />}
                </SimpleCard>
              </div>

              {activeAlerts.length > 0 && (
                <SimpleCard className="bg-red-500/10 border-red-500/30 p-4">
                  <div className="flex items-center gap-2 text-red-400 mb-2 font-bold text-xs"><Calendar size={14} /> 支払期日が迫っています</div>
                  <div className="space-y-2">{activeAlerts.map(([card, day]) => <div key={card} className="flex justify-between items-center bg-black/20 p-2 rounded"><span className="text-xs font-bold text-white">{card} ({day}日)</span><button onClick={async () => { const confirmed = monthlyData?.confirmedPayments || []; if (!confirmed.includes(card)) { await setDoc(doc(db, 'users', user.uid, 'months', month), { confirmedPayments: [...confirmed, card] }, { merge: true }); showToastMsg('支払いを完了しました'); } }} className="text-[10px] bg-red-500 text-white px-3 py-1 rounded-full font-bold">完了</button></div>)}</div>
                </SimpleCard>
              )}

              <SimpleCard className="p-5 flex justify-between items-end">
                <div><p className="text-[10px] text-zinc-400 font-bold uppercase mb-1">積立総額</p><h3 className="text-2xl font-black text-white">¥{Number(savingsTotalToMonth || 0).toLocaleString()}</h3></div>
                <div className="text-right"><p className="text-[10px] text-zinc-400 font-bold uppercase mb-1">今月の積立</p><p className="text-sm font-bold text-white">+ ¥{summary.savingsAmount.toLocaleString()}</p></div>
              </SimpleCard>
            </div>
          )}

          {activeTab === 'log' && (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              <div className="p-4 space-y-3">
                <div className="flex gap-2">
                  <div className="flex-1 relative"><input type="text" value={searchText} onChange={e=>setSearchText(e.target.value)} className="w-full h-10 bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 text-sm" placeholder="検索..." /><Search size={14} className="absolute left-3 top-3 text-zinc-500"/></div>
                  <div className="flex bg-white/5 rounded-lg p-1"><button onClick={()=>setLogView('list')} className={`p-2 rounded ${logView==='list'?'bg-white text-black':'text-zinc-500'}`}><AlignJustify size={16}/></button><button onClick={()=>setLogView('calendar')} className={`p-2 rounded ${logView==='calendar'?'bg-white text-black':'text-zinc-500'}`}><CalendarDays size={16}/></button></div>
                </div>
                <div className="flex gap-2 items-center">
                  <select value={filter.category} onChange={e=>setFilter({...filter,category:e.target.value})} className="flex-1 h-10 bg-white/5 rounded-lg px-3 text-xs"><option value="ALL">全カテゴリ</option>{getCategoryNames().map(c=><option key={c} value={c}>{c}</option>)}</select>
                  <select value={filter.method} onChange={e=>setFilter({...filter,method:e.target.value})} className="flex-1 h-10 bg-white/5 rounded-lg px-3 text-xs"><option value="ALL">全支払方法</option>{(config?.paymentMethods||[]).map(m=><option key={m} value={m}>{m}</option>)}</select>
                  <button onClick={()=>setFilter(p=>({...p,special:!p.special}))} className={`h-10 px-3 rounded-lg border text-[10px] font-black ${filter.special?'bg-white text-black':'bg-white/5 text-zinc-500 border-white/10'}`}>特別費</button>
                  <button onClick={clearLogFilters} className="w-10 h-10 bg-white/5 rounded-lg flex items-center justify-center"><X size={16}/></button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-4 pb-24">
                {logView === 'list' ? (
                  <SimpleCard className="divide-y divide-white/5 p-0">
                    {finalFilteredTx.length===0 ? <div className="py-20 text-center text-zinc-500 text-xs">記録がありません</div> : finalFilteredTx.map(t => (
                      <div key={t.id} onClick={()=>{setViewingTx(t);}} className="p-4 flex justify-between items-center active:bg-white/5 cursor-pointer">
                        <div className="flex items-center gap-3 flex-1 min-w-0"><div className="w-8 text-[10px] text-zinc-500 font-mono">{formatDateShort(t.date)}</div><div className={`w-12 text-center text-[9px] rounded py-0.5 truncate ${t.isSpecial?'border border-white/10 text-zinc-400':'bg-white/5 text-zinc-400'}`}>{t.category}</div><div className="flex-1 truncate text-sm font-bold text-white">{t.title}</div></div>
                        <span className="text-sm font-bold text-white">¥{Number(t.amount).toLocaleString()}</span>
                      </div>
                    ))}
                  </SimpleCard>
                ) : (
                  <SimpleCard className="p-4 flex flex-col">
                    <div className="grid grid-cols-7 gap-1 text-center mb-2 text-[10px] text-zinc-500">{['日','月','火','水','木','金','土'].map(d=><div key={d}>{d}</div>)}</div>
                    <div className="grid grid-cols-7 gap-1">
                      {calendarDaysList.map((day, i) => {
                        if(!day) return <div key={i}/>;
                        const a = summary.dailyTotals[day]||0; const isT = day===new Date().getDate() && month===getMonthString(new Date());
                        return <div key={i} onClick={()=>{setEditingTx(null); setInputDate(`${month}-${String(day).padStart(2,'0')}`); setInputAmount(''); setInputTitle(''); setIsTxModalOpen(true);}} className={`aspect-square rounded-lg border flex flex-col items-center justify-center ${isT?'border-white bg-white/10':'border-white/5 bg-black/20'}`}><span className={`text-[9px] ${isT?'text-white':'text-zinc-500'}`}>{day}</span>{a>0 && <span className="text-[8px] text-zinc-300">¥{(a/1000).toFixed(1)}k</span>}</div>
                      })}
                    </div>
                  </SimpleCard>
                )}
              </div>
            </div>
          )}

          {activeTab === 'analysis' && (
            <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6 pb-32 animate-in fade-in">
              {aiMessage && (
                <div className={`p-3 rounded-xl border flex items-center gap-3 ${aiMessage.bg} ${aiMessage.border}`}>
                   <span className="text-xl shrink-0">{aiMessage.icon}</span>
                   <span className={`text-xs font-bold leading-snug ${aiMessage.color}`}>{aiMessage.text}</span>
                </div>
              )}
              <SimpleCard className="p-5 flex flex-col gap-5">
                <div>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase mb-0.5">総支出</p>
                  <div className="flex items-end gap-3"><h3 className="text-3xl font-black text-white tracking-tight">¥{summary.totalSpent.toLocaleString()}</h3><div className={`flex items-center gap-0.5 text-[10px] font-bold mb-0.5 ${summary.totalSpent<=summary.lastTotalSpent?'text-green-400':'text-red-400'}`}>{summary.totalSpent<=summary.lastTotalSpent?<TrendingDown size={12}/>:<TrendingUp size={12}/>} 先月比 {summary.totalSpent<=summary.lastTotalSpent?'-':'+'}¥{Math.abs(summary.totalSpent-summary.lastTotalSpent).toLocaleString()}</div></div>
                </div>
                {donutChartData.total > 0 && (
                  <div className="space-y-3">
                    <div className="flex w-full h-5 rounded-md overflow-hidden gap-[1px]">
                      {donutChartData.items.map(item => <div key={item.name} className="h-full" style={{ width:`${(item.amount/donutChartData.total)*100}%`, backgroundColor:item.color }} />)}
                    </div>
                    <div className="grid grid-cols-2 gap-y-2 gap-x-3">
                      {donutChartData.items.map(item => <div key={item.name} className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-sm" style={{backgroundColor:item.color}}/><span className="text-[10px] text-zinc-300 font-bold truncate flex-1">{item.name}</span><span className="text-[10px] font-black text-white">¥{item.amount.toLocaleString()}</span></div>)}
                    </div>
                  </div>
                )}
                {summary.specialTotalSpent > 0 && (
                  <div className="pt-4 border-t border-white/10"><p className="text-[9px] text-zinc-500 font-bold uppercase">特別費</p><span className="text-sm font-black text-white">¥{summary.specialTotalSpent.toLocaleString()}</span></div>
                )}
              </SimpleCard>

              <SimpleCard className="p-0 overflow-hidden grid grid-cols-2 gap-px bg-white/5">
                {activeCategories.map(n => {
                  const c = summary.catTotals[n]||0; const l = summary.lastCatTotals[n]||0; const b = monthlyData.catBudgets?.[n]||0;
                  if(b===0 && c===0) return null;
                  return (
                    <div key={n} className="bg-[#1E1E1E] p-3 flex flex-col justify-between">
                      <div className="flex justify-between mb-1.5"><div className="flex items-center gap-1.5 min-w-0"><span className="text-sm">{getCategoryIcon(n)}</span><span className="text-[10px] font-bold text-zinc-200 truncate">{n}</span></div><div className="text-[8px] text-zinc-500">先月 ¥{l.toLocaleString()}</div></div>
                      <div className="flex items-baseline gap-1 mb-1.5"><span className={`text-xs font-black ${b>0&&c>b?'text-red-400':'text-white'}`}>¥{c.toLocaleString()}</span><span className="text-[9px] text-zinc-500 font-bold">/ ¥{b.toLocaleString()}</span></div>
                      <div className="h-1 bg-white/5 rounded-full overflow-hidden mt-auto"><div className={`h-full ${b>0&&c>b?'bg-red-400':'bg-white'}`} style={{width:`${b>0?Math.min(100,(c/b)*100):0}%`}}/></div>
                    </div>
                  );
                })}
              </SimpleCard>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="flex-1 overflow-y-auto px-4 pt-4 pb-32 animate-in fade-in">
              {settingTab === 'menu' ? (
                <div className="space-y-6 pb-10">
                  <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-3">{user.photoURL?<img src={user.photoURL} alt="icon" className="w-8 h-8 rounded-full border border-white/10"/>:<div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center"><User size={16}/></div>}<span className="text-xs font-bold text-white">{user.email}</span></div>
                    <button onClick={()=>{if(window.confirm('Logout?')) signOut(auth)}} className="text-zinc-500 text-[10px] flex items-center gap-1.5"><LogOut size={14}/> Logout</button>
                  </div>
                  <SimpleCard className="divide-y divide-white/5 p-0">
                    {SETTING_MENU_ITEMS.map(item => (
                      <SettingsRow key={item.id} onClick={()=>setSettingTab(item.id)} left={<div className="flex items-center gap-4">{item.icon}<span className="text-sm font-bold">{item.label}</span></div>} showChevron={true} />
                    ))}
                  </SimpleCard>
                  <div className="flex flex-col items-center gap-4 pt-4">
                    <button onClick={()=>setIsCopyModalOpen(true)} className="px-6 py-3 border border-white/10 text-zinc-300 rounded-full text-xs font-bold"><CopyCheck className="inline mr-2" size={16}/> 先月の設定をコピー</button>
                    <button onClick={async ()=>{if(window.confirm('CSV出力しますか？')){let csv="\uFEFF日付,タイトル,カテゴリ,金額,支払方法\n"; transactions.forEach(t=>csv+=`${isoToLocalYMD(t.date)},"${t.title}",${t.category},${t.amount},${t.paymentMethod}\n`); const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'})); a.download=`zaimu_${getTodayString()}.csv`; a.click();}}} className="text-zinc-600 text-[10px] underline flex items-center gap-2"><FileText size={12}/> 全データをCSV出力</button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {settingTab === 'faq' && (
                      <div className="space-y-3">
                          <div className="relative mb-4"><input type="text" value={faqSearchText} onChange={(e)=>setFaqSearchText(e.target.value)} placeholder="検索..." className="w-full h-10 bg-black/20 border border-white/10 rounded-lg pl-9 pr-3 text-xs text-white" /><Search size={14} className="absolute left-3 top-3 text-zinc-500" />{faqSearchText && <button onClick={()=>setFaqSearchText('')} className="absolute right-3 top-2.5 text-zinc-500"><X size={14}/></button>}</div>
                          <div className="space-y-4">
                              {filteredFaqData.length > 0 ? filteredFaqData.map((section, sIdx) => (
                                  <div key={sIdx}>
                                      <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 pl-2">{section.category}</h3>
                                      <SimpleCard className="divide-y divide-white/5 p-0">
                                          {section.items.map((item, idx) => (
                                              <div key={idx} className="p-4 cursor-pointer hover:bg-white/5" onClick={()=>setExpandedFaq(expandedFaq===`${sIdx}-${idx}`?null:`${sIdx}-${idx}`)}>
                                                  <div className="flex justify-between items-start gap-4"><div className="flex items-start gap-3"><HelpCircle size={18} className="text-zinc-500 mt-0.5 shrink-0" /><span className="text-sm font-bold text-zinc-200">{item.q}</span></div><ChevronDown size={16} className={`text-zinc-500 transition-transform shrink-0 ${expandedFaq===`${sIdx}-${idx}`?'rotate-180':''}`} /></div>
                                                  {expandedFaq===`${sIdx}-${idx}` && <div className="mt-3 pl-8 text-xs text-zinc-400 whitespace-pre-wrap">{item.a}</div>}
                                              </div>
                                          ))}
                                      </SimpleCard>
                                  </div>
                              )) : <div className="text-center py-10 text-zinc-500 text-xs">見つかりませんでした</div>}
                          </div>
                      </div>
                  )}

                  {settingTab === 'budget' && (
                    <div className="space-y-4">
                      <div className="text-[10px] text-zinc-500 uppercase font-black pl-1">資金計画</div>
                      <SimpleCard className="divide-y divide-white/5 p-0">
                        <SettingsRow onClick={()=>openEdit('salary',{value:monthlyData.salary},0)} left="手取り給与" right={`¥${Number(monthlyData.salary||0).toLocaleString()}`} />
                        <SettingsRow onClick={()=>openEdit('totalBudget',{value:monthlyData.budget},0)} left="クレジットカード利用目安" right={`¥${Number(monthlyData.budget||0).toLocaleString()}`} />
                        <SettingsRow onClick={()=>openEdit('cashBudget',{value:monthlyData.cashBudget},0)} left="月初のスタート現金" right={`¥${Number(monthlyData.cashBudget||0).toLocaleString()}`} />
                        <SettingsRow onClick={()=>openEdit('savings',{value:monthlyData.savings},0)} left="今月の積立額" right={`¥${Number(monthlyData.savings||0).toLocaleString()}`} />
                        <SettingsRow onClick={()=>openEdit('memo',{memo:monthlyData.memo},0)} left="今月のメモ" right={monthlyData.memo?'設定済み':'未設定'} />
                      </SimpleCard>
                      <div className="text-[10px] text-zinc-500 uppercase font-black pl-1">引落予定のカード</div>
                      <SimpleCard className="divide-y divide-white/5 p-0">
                        {paymentMethodsSafe.filter(m=>m!==CASH).map(m=>(<SettingsRow key={m} onClick={()=>openEdit('bill',{name:m, bill:monthlyData.cardBills?.[m]??0, due:monthlyData.cardDueDates?.[m]??''},0)} left={m} right={`¥${Number(monthlyData.cardBills?.[m]||0).toLocaleString()} (${monthlyData.cardDueDates?.[m]||'-'}日)`} />))}
                      </SimpleCard>
                    </div>
                  )}

                  {settingTab === 'fixed' && (
                    <div className="space-y-3"><button onClick={()=>openEdit('fixed',{name:'',amount:'',method:CASH},-1)} className="w-full h-12 bg-white text-black rounded-lg text-xs font-bold flex items-center justify-center gap-2"><Plus size={16}/>追加</button><SimpleCard className="divide-y divide-white/5 p-0">{(monthlyData.fixedCosts||[]).map((f,idx)=><SettingsRow key={idx} onClick={()=>openEdit('fixed',f,idx)} left={<div className="flex gap-2 items-center"><span className="text-[9px] px-2 py-1 bg-white/5 rounded text-zinc-400">{f.method||'未設定'}</span><span className="text-sm">{f.name}</span></div>} right={`¥${Number(f.amount).toLocaleString()}`} />)}</SimpleCard></div>
                  )}

                  {settingTab === 'category' && (
                    <div className="space-y-3"><button onClick={()=>openEdit('category',{name:'',icon:'🏷',budget:''},-1)} className="w-full h-12 bg-white text-black rounded-lg text-xs font-bold flex items-center justify-center gap-2"><Plus size={16}/>追加</button><SimpleCard className="divide-y divide-white/5 p-0">{(config?.categories||[]).map((c,idx)=><SettingsRow key={idx} onClick={()=>openEdit('category',{...c,budget:monthlyData.catBudgets?.[c.name]||0},idx)} left={<div className="flex gap-3 items-center"><span className="w-8 text-center">{c.icon}</span><span className="text-sm">{c.name}</span></div>} right={`¥${Number(monthlyData.catBudgets?.[c.name]||0).toLocaleString()}`} />)}</SimpleCard></div>
                  )}

                  {settingTab === 'template' && (
                    <div className="space-y-3"><button onClick={()=>openEdit('template',{title:'',amount:'',category:getCategoryNames()[0]||'食費',method:CASH},-1)} className="w-full h-12 bg-white text-black rounded-lg text-xs font-bold flex items-center justify-center gap-2"><Plus size={16}/>追加</button><SimpleCard className="divide-y divide-white/5 p-0">{(config?.templates||[]).map((t,idx)=><SettingsRow key={idx} onClick={()=>openEdit('template',t,idx)} left={<div className="flex flex-col"><span className="text-sm">{t.title}</span><span className="text-[10px] text-zinc-500">{t.category} / {t.method}</span></div>} right={`¥${Number(t.amount).toLocaleString()}`} />)}</SimpleCard></div>
                  )}

                  {settingTab === 'payment' && (
                    <div className="space-y-3"><button onClick={()=>openEdit('payment',{name:''},-1)} className="w-full h-12 bg-white text-black rounded-lg text-xs font-bold flex items-center justify-center gap-2"><Plus size={16}/>追加</button><SimpleCard className="divide-y divide-white/5 p-0">{(config?.paymentMethods||[]).map((m,idx)=><SettingsRow key={idx} onClick={()=>openEdit('payment',{name:m},idx)} left={m} />)}</SimpleCard></div>
                  )}
                </div>
              )}
            </div>
          )}
        </main>

        <footer className="flex-none h-24 border-t border-white/5 flex justify-between items-center px-6 pb-6 bg-[#121212]/80 backdrop-blur-xl z-50">
          <NavButton active={activeTab==='home'} onClick={()=>setActiveTab('home')} icon={<Home size={24}/>}/>
          <NavButton active={activeTab==='log'} onClick={()=>setActiveTab('log')} icon={<History size={24}/>}/>
          <button onClick={()=>{setEditingTx(null); resetTxInputs(); setIsTxModalOpen(true);}} className="w-14 h-14 bg-white text-black rounded-full flex items-center justify-center shadow-xl active:scale-95"><Plus size={28}/></button>
          <NavButton active={activeTab==='analysis'} onClick={()=>setActiveTab('analysis')} icon={<BarChart3 size={24}/>}/>
          <NavButton active={activeTab==='settings'} onClick={()=>{setActiveTab('settings'); setSettingTab('menu');}} icon={<Settings size={24}/>}/>
        </footer>

        {/* MODALS */}
        {viewingTx && (
          <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in" onClick={()=>setViewingTx(null)}>
            <div className="w-full sm:max-w-md bg-[#1E1E1E] sm:rounded-lg rounded-t-2xl border border-white/5 flex flex-col" onClick={e=>e.stopPropagation()}>
              <div className="p-4 border-b border-white/5 flex justify-between items-center"><h2 className="text-xs font-black uppercase text-white">支出の詳細</h2><button onClick={()=>setViewingTx(null)} className="text-zinc-500"><X size={20}/></button></div>
              <div className="p-6 pb-24 space-y-8">
                <div className="flex flex-col items-center gap-3 mt-4"><div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10"><span className="text-lg">{getCategoryIcon(viewingTx.category)}</span><span className="text-xs font-bold text-zinc-300">{viewingTx.category}</span></div><h3 className="text-4xl font-black text-white">¥{Number(viewingTx.amount).toLocaleString()}</h3></div>
                <div className="bg-black/20 rounded-xl border border-white/5 divide-y divide-white/5"><div className="p-4 flex justify-between"><span className="text-[10px] text-zinc-500 font-bold">内容</span><span className="text-sm font-bold text-white">{viewingTx.title}</span></div><div className="p-4 flex justify-between"><span className="text-[10px] text-zinc-500 font-bold">日付</span><span className="text-sm font-bold text-white">{formatFullDateJP(viewingTx.date)}</span></div><div className="p-4 flex justify-between"><span className="text-[10px] text-zinc-500 font-bold">支払方法</span><span className="text-sm font-bold text-white">{viewingTx.paymentMethod}</span></div>{viewingTx.isSpecial && <div className="p-4 flex justify-between"><span className="text-[10px] text-zinc-500 font-bold">特別費</span><span className="text-sm font-black text-yellow-400">該当する</span></div>}</div>
                <div className="flex gap-3"><button onClick={async ()=>{if(window.confirm('削除しますか？')){await deleteDoc(doc(db,'users',user.uid,'transactions',viewingTx.id)); setViewingTx(null); showToastMsg('削除しました');}}} className="flex-1 h-12 bg-red-900/20 text-red-500 font-black rounded-xl text-xs flex items-center justify-center gap-2"><Trash2 size={16}/> 削除</button><button onClick={()=>{const t=viewingTx; setViewingTx(null); startEditingTx(t);}} className="flex-1 h-12 bg-white text-black font-black rounded-xl text-xs flex items-center justify-center gap-2"><Pencil size={16}/> 編集</button></div>
              </div>
            </div>
          </div>
        )}

        {isTxModalOpen && (
          <div className="fixed inset-0 z-[65] flex items-end sm:items-center justify-center sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in" onClick={()=>setIsTxModalOpen(false)}>
            <div className="w-full max-h-[90vh] sm:h-auto sm:max-w-md bg-[#1E1E1E] sm:rounded-lg rounded-t-2xl border border-white/5 flex flex-col" onClick={e=>e.stopPropagation()}>
              <div className="p-4 border-b border-white/5 flex justify-between"><h2 className="text-xs font-black uppercase text-white">{editingTx?'編集':'入力'}</h2><button onClick={()=>setIsTxModalOpen(false)} className="text-zinc-500"><X size={20}/></button></div>
              <div className="flex-1 overflow-y-auto p-5 pb-24">
                <form onSubmit={handleTxSubmit} className="space-y-3">
                  <div className="flex items-center"><label className="w-20 shrink-0 text-[10px] text-zinc-500 font-black uppercase pl-1">金額</label><div className="flex-1 flex bg-black/20 rounded-lg h-11 px-3"><span className="text-zinc-500 font-bold mr-1 flex items-center">¥</span><input type="text" inputMode="decimal" value={inputAmount?Number(inputAmount).toLocaleString():''} onChange={e=>{const v=e.target.value.replace(/,/g,''); if(!isNaN(v)) setInputAmount(v)}} className="flex-1 w-full bg-transparent text-white font-black text-lg outline-none tabular-nums" autoFocus required/></div><button type="button" onClick={()=>{setCalcInitialValue(inputAmount); setCalcOnConfirm(v=>setInputAmount(String(v))); setShowCalculator(true);}} className="text-zinc-400 p-2 ml-1"><Calculator size={18}/></button></div>
                  <div className="flex items-center"><label className="w-20 shrink-0 text-[10px] text-zinc-500 font-black uppercase pl-1">内容</label><div className="flex-1 bg-black/20 rounded-lg h-11 px-3 flex items-center"><input type="text" value={inputTitle} onChange={e=>setInputTitle(e.target.value)} className="w-full bg-transparent text-white font-bold text-sm outline-none" placeholder="例: ランチ"/></div></div>
                  <div className="flex items-center"><label className="w-20 shrink-0 text-[10px] text-zinc-500 font-black uppercase pl-1">日付</label><div className="flex-1 bg-black/20 rounded-lg h-11 px-3 flex items-center"><input type="date" value={inputDate} onChange={e=>setInputDate(e.target.value)} className="w-full bg-transparent text-white font-bold text-sm outline-none"/></div></div>
                  <div className="flex items-center relative"><label className="w-20 shrink-0 text-[10px] text-zinc-500 font-black uppercase pl-1">カテゴリ</label><div className="flex-1 bg-black/20 rounded-lg h-11 px-3 flex items-center relative"><select value={inputCategory} onChange={e=>setInputCategory(e.target.value)} className="w-full bg-transparent text-white font-bold text-sm outline-none appearance-none">{getCategoryNames().map(c=><option key={c} value={c}>{c}</option>)}</select><ChevronDown size={14} className="absolute right-3 text-zinc-500 pointer-events-none"/></div></div>
                  <div className="flex items-center"><label className="w-20 shrink-0 text-[10px] text-zinc-500 font-black uppercase pl-1">特別費</label><div className="flex-1 flex items-center h-11"><button type="button" onClick={()=>setInputIsSpecial(p=>!p)} className="w-10 h-6 rounded-full transition-colors relative border border-white/10" style={{backgroundColor:inputIsSpecial?'white':'rgba(0,0,0,0.4)'}}><div className={`absolute left-0.5 w-4 h-4 rounded-full transition-transform ${inputIsSpecial?'translate-x-[18px] bg-black':'translate-x-0 bg-zinc-400'}`}/></button></div></div>
                  <div className="flex flex-col gap-2 pt-2"><label className="text-[10px] text-zinc-500 font-black uppercase pl-1">支払方法</label><div className="flex flex-wrap gap-2">{paymentMethodsSafe.map(m=><label key={m} className="cursor-pointer"><input type="radio" value={m} checked={inputMethod===m} onChange={e=>setInputMethod(e.target.value)} className="peer hidden"/><div className="px-3 py-2 text-[10px] rounded-lg border font-black text-zinc-400 bg-white/5 border-transparent peer-checked:border-white peer-checked:text-white peer-checked:bg-transparent">{m}</div></label>)}</div></div>
                  {!editingTx && <div className="flex flex-col gap-2"><label className="text-[10px] text-zinc-500 font-black uppercase pl-1">テンプレート</label><div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">{(config.templates||[]).map((t,idx)=><button key={idx} type="button" onClick={()=>{setInputAmount(String(t.amount)); setInputTitle(t.title); setInputCategory(t.category); setInputMethod(t.method);}} className="flex-shrink-0 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-[10px] font-bold text-zinc-400 flex items-center gap-1.5"><Zap size={10} className="text-yellow-400"/> {t.title}</button>)}</div></div>}
                  <div className="pt-4 border-t border-white/5 mt-2"><button type="submit" className="w-full h-12 bg-white text-black font-black rounded-xl text-xs uppercase">保存する</button></div>
                </form>
              </div>
            </div>
          </div>
        )}

        {showCalculator && (
          <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in" onClick={()=>setShowCalculator(false)}>
            <div className="w-full sm:max-w-md bg-[#1E1E1E] sm:rounded-lg rounded-t-2xl border border-white/5 flex flex-col" onClick={e=>e.stopPropagation()}>
              <div className="p-4 border-b border-white/5 flex justify-between items-center"><h2 className="text-[10px] font-black uppercase text-white">電卓</h2><button onClick={()=>setShowCalculator(false)} className="text-zinc-500"><X size={20}/></button></div>
              <div className="p-5 pb-16"><CalculatorPad initialValue={calcInitialValue} onConfirm={(v)=>{if(calcOnConfirm)calcOnConfirm(v); setShowCalculator(false);}}/></div>
            </div>
          </div>
        )}

        {isMemoModalOpen && (
          <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in" onClick={()=>setIsMemoModalOpen(false)}>
            <div className="w-full sm:max-w-md bg-[#1E1E1E] sm:rounded-lg rounded-t-2xl border border-white/5 flex flex-col" onClick={e=>e.stopPropagation()}>
              <div className="p-4 border-b border-white/5 flex justify-between items-center"><h2 className="text-xs font-black uppercase text-white flex items-center gap-2"><Pencil size={14}/> 今月のメモ</h2><button onClick={()=>setIsMemoModalOpen(false)} className="text-zinc-500"><X size={20}/></button></div>
              <div className="p-5 pb-24 flex flex-col gap-4"><div className="w-full bg-black/20 rounded-lg p-3"><textarea value={memoText} onChange={e=>setMemoText(e.target.value)} placeholder="今月のやりくりや、特別費の理由などをメモ..." className="w-full h-32 bg-transparent text-white font-bold text-sm outline-none resize-none leading-relaxed" autoFocus/></div><button onClick={handleMemoSave} className="w-full h-12 bg-white text-black font-black rounded-lg text-xs uppercase">保存する</button></div>
            </div>
          </div>
        )}

        {isCopyModalOpen && (
          <div className="fixed inset-0 z-[65] flex items-end sm:items-center justify-center sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in" onClick={()=>setIsCopyModalOpen(false)}>
            <div className="w-full sm:max-w-md bg-[#1E1E1E] sm:rounded-lg rounded-t-2xl border border-white/5 flex flex-col" onClick={e=>e.stopPropagation()}>
              <div className="p-4 border-b border-white/5 flex justify-between items-center"><h2 className="text-xs font-black uppercase text-white">設定をコピー</h2><button onClick={()=>setIsCopyModalOpen(false)} className="text-zinc-500"><X size={20}/></button></div>
              <div className="p-5 pb-24 space-y-4"><div className="text-[10px] text-zinc-500 uppercase font-black pl-1">コピー元の年月</div><div className="w-full overflow-hidden"><input type="month" value={copySourceMonth} onChange={e=>setCopySourceMonth(e.target.value)} className="w-full h-12 bg-black/20 border border-white/10 rounded-lg px-3 text-sm text-white font-bold" /></div><div className="flex gap-2 pt-2"><button onClick={()=>setIsCopyModalOpen(false)} className="flex-1 h-12 bg-white/5 border border-white/10 text-zinc-300 rounded-lg font-black text-xs uppercase">キャンセル</button><button onClick={copySettingsFromSelectedMonth} className="flex-1 h-12 bg-white text-black rounded-lg font-black text-xs uppercase">コピー</button></div></div>
            </div>
          </div>
        )}

        {editingItem && (
          <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in" onClick={()=>setEditingItem(null)}>
            <div className="w-full max-h-[90vh] sm:h-auto sm:max-w-md bg-[#1E1E1E] sm:rounded-lg rounded-t-2xl border border-white/5 flex flex-col" onClick={e=>e.stopPropagation()}>
              <div className="p-4 border-b border-white/5 flex justify-between items-center"><h2 className="text-xs font-black uppercase text-white">編集</h2><button onClick={()=>setEditingItem(null)} className="text-zinc-500"><X size={20}/></button></div>
              <div className="p-5 pb-24 space-y-3 overflow-y-auto">
                {['salary','totalBudget','cashBudget','savings'].includes(editingItem.type) && (
                  <div className="flex items-center"><label className="w-28 shrink-0 text-[10px] text-zinc-500 font-black uppercase pl-1">{editingItem.type==='salary'?'手取り給与':editingItem.type==='totalBudget'?'クレカ利用目安':editingItem.type==='cashBudget'?'月初のスタート現金':'今月の積立額'}</label><div className="flex-1 flex bg-black/20 rounded-lg h-11 px-3"><input type="text" inputMode="decimal" value={String(editingItem.data.value??'')} onChange={e=>setEditingItem({...editingItem,data:{value:e.target.value}})} className="flex-1 w-full bg-transparent text-white font-bold text-sm outline-none tabular-nums" /></div><button onClick={()=>{setCalcInitialValue(editingItem.data.value??0); setCalcOnConfirm(v=>setEditingItem(p=>({...p,data:{value:String(v)}}))); setShowCalculator(true);}} className="text-zinc-400 p-2 ml-1"><Calculator size={18}/></button></div>
                )}
                {editingItem.type==='memo' && <div className="flex items-start"><label className="w-20 shrink-0 text-[10px] text-zinc-500 font-black uppercase pl-1 pt-3">今月のメモ</label><div className="flex-1 bg-black/20 rounded-lg p-3"><textarea value={editingItem.data.memo||''} onChange={e=>setEditingItem({...editingItem,data:{...editingItem.data,memo:e.target.value}})} className="w-full h-32 bg-transparent text-white font-bold text-sm outline-none resize-none leading-relaxed" autoFocus/></div></div>}
                {editingItem.type==='bill' && (
                  <><div className="flex items-center"><label className="w-20 shrink-0 text-[10px] text-zinc-500 font-black uppercase pl-1">カード名</label><div className="flex-1 h-11 flex items-center px-3"><span className="text-sm font-bold">{editingItem.data.name}</span></div></div><div className="flex items-center"><label className="w-20 shrink-0 text-[10px] text-zinc-500 font-black uppercase pl-1">引落額</label><div className="flex-1 flex bg-black/20 rounded-lg h-11 px-3"><input type="text" inputMode="decimal" value={String(editingItem.data.bill??'')} onChange={e=>setEditingItem({...editingItem,data:{...editingItem.data,bill:e.target.value}})} className="flex-1 w-full bg-transparent text-white font-bold text-sm outline-none tabular-nums" /></div><button onClick={()=>{setCalcInitialValue(editingItem.data.bill??0); setCalcOnConfirm(v=>setEditingItem(p=>({...p,data:{...p.data,bill:String(v)}}))); setShowCalculator(true);}} className="text-zinc-400 p-2 ml-1"><Calculator size={18}/></button></div><div className="flex items-center"><label className="w-20 shrink-0 text-[10px] text-zinc-500 font-black uppercase pl-1">引落日</label><div className="flex-1 bg-black/20 rounded-lg h-11 flex items-center px-3"><input type="number" value={String(editingItem.data.due??'')} onChange={e=>setEditingItem({...editingItem,data:{...editingItem.data,due:e.target.value}})} className="w-16 bg-transparent text-white font-bold text-sm outline-none tabular-nums" /><span className="text-zinc-500 text-xs font-bold ml-1">日</span></div></div></>
                )}
                {editingItem.type==='category' && (
                  <><div className="flex items-center"><label className="w-20 shrink-0 text-[10px] text-zinc-500 font-black uppercase pl-1">アイコン</label><div className="flex-1 bg-black/20 rounded-lg h-11 flex items-center px-3"><input value={editingItem.data.icon||''} onChange={e=>setEditingItem({...editingItem,data:{...editingItem.data,icon:e.target.value}})} className="flex-1 bg-transparent text-xl text-white outline-none"/></div></div><div className="flex items-center"><label className="w-20 shrink-0 text-[10px] text-zinc-500 font-black uppercase pl-1">名前</label><div className="flex-1 bg-black/20 rounded-lg h-11 flex items-center px-3"><input value={editingItem.data.name||''} onChange={e=>setEditingItem({...editingItem,data:{...editingItem.data,name:e.target.value}})} className="flex-1 w-full bg-transparent text-white font-bold text-sm outline-none"/></div></div><div className="flex items-center"><label className="w-20 shrink-0 text-[10px] text-zinc-500 font-black uppercase pl-1">月間予算</label><div className="flex-1 flex bg-black/20 rounded-lg h-11 px-3"><input type="text" inputMode="decimal" value={editingItem.data.budget?Number(editingItem.data.budget).toLocaleString():''} onChange={e=>{const v=e.target.value.replace(/,/g,''); if(!isNaN(v)) setEditingItem({...editingItem,data:{...editingItem.data,budget:v}})}} className="flex-1 w-full bg-transparent text-white font-bold text-sm outline-none tabular-nums"/></div><button onClick={()=>{setCalcInitialValue(editingItem.data.budget??0); setCalcOnConfirm(v=>setEditingItem(p=>({...p,data:{...p.data,budget:String(v)}}))); setShowCalculator(true);}} className="text-zinc-400 p-2 ml-1"><Calculator size={18}/></button></div></>
                )}
                {editingItem.type==='fixed' && (
                  <><div className="flex items-center"><label className="w-20 shrink-0 text-[10px] text-zinc-500 font-black uppercase pl-1">固定費名</label><div className="flex-1 bg-black/20 rounded-lg h-11 flex items-center px-3"><input value={editingItem.data.name||''} onChange={e=>setEditingItem({...editingItem,data:{...editingItem.data,name:e.target.value}})} className="flex-1 w-full bg-transparent text-white font-bold text-sm outline-none"/></div></div><div className="flex items-center"><label className="w-20 shrink-0 text-[10px] text-zinc-500 font-black uppercase pl-1">金額</label><div className="flex-1 flex bg-black/20 rounded-lg h-11 px-3"><input type="text" inputMode="decimal" value={editingItem.data.amount?Number(editingItem.data.amount).toLocaleString():''} onChange={e=>{const v=e.target.value.replace(/,/g,''); if(!isNaN(v)) setEditingItem({...editingItem,data:{...editingItem.data,amount:v}})}} className="flex-1 w-full bg-transparent text-white font-bold text-sm outline-none tabular-nums"/></div><button onClick={()=>{setCalcInitialValue(editingItem.data.amount??0); setCalcOnConfirm(v=>setEditingItem(p=>({...p,data:{...p.data,amount:String(v)}}))); setShowCalculator(true);}} className="text-zinc-400 p-2 ml-1"><Calculator size={18}/></button></div><div className="flex items-center relative"><label className="w-20 shrink-0 text-[10px] text-zinc-500 font-black uppercase pl-1">支払方法</label><div className="flex-1 bg-black/20 rounded-lg h-11 px-3 flex items-center relative"><select value={editingItem.data.method||''} onChange={e=>setEditingItem({...editingItem,data:{...editingItem.data,method:e.target.value}})} className="flex-1 w-full bg-transparent text-white font-bold text-sm outline-none appearance-none">{config.paymentMethods.map(m=><option key={m} value={m}>{m}</option>)}</select><ChevronDown size={14} className="absolute right-3 text-zinc-500 pointer-events-none"/></div></div></>
                )}
                {editingItem.type==='template' && (
                  <><div className="flex items-center"><label className="w-20 shrink-0 text-[10px] text-zinc-500 font-black uppercase pl-1">名称</label><div className="flex-1 bg-black/20 rounded-lg h-11 flex items-center px-3"><input value={editingItem.data.title||''} onChange={e=>setEditingItem({...editingItem,data:{...editingItem.data,title:e.target.value}})} className="flex-1 w-full bg-transparent text-white font-bold text-sm outline-none"/></div></div><div className="flex items-center"><label className="w-20 shrink-0 text-[10px] text-zinc-500 font-black uppercase pl-1">金額</label><div className="flex-1 flex bg-black/20 rounded-lg h-11 px-3"><input type="text" inputMode="decimal" value={editingItem.data.amount?Number(editingItem.data.amount).toLocaleString():''} onChange={e=>{const v=e.target.value.replace(/,/g,''); if(!isNaN(v)) setEditingItem({...editingItem,data:{...editingItem.data,amount:v}})}} className="flex-1 w-full bg-transparent text-white font-bold text-sm outline-none tabular-nums"/></div><button onClick={()=>{setCalcInitialValue(editingItem.data.amount??0); setCalcOnConfirm(v=>setEditingItem(p=>({...p,data:{...p.data,amount:String(v)}}))); setShowCalculator(true);}} className="text-zinc-400 p-2 ml-1"><Calculator size={18}/></button></div><div className="flex items-center relative"><label className="w-20 shrink-0 text-[10px] text-zinc-500 font-black uppercase pl-1">カテゴリ</label><div className="flex-1 bg-black/20 rounded-lg h-11 px-3 flex items-center relative"><select value={editingItem.data.category||''} onChange={e=>setEditingItem({...editingItem,data:{...editingItem.data,category:e.target.value}})} className="flex-1 w-full bg-transparent text-white font-bold text-sm outline-none appearance-none">{getCategoryNames().map(c=><option key={c} value={c}>{c}</option>)}</select><ChevronDown size={14} className="absolute right-3 text-zinc-500 pointer-events-none"/></div></div><div className="flex items-center relative"><label className="w-20 shrink-0 text-[10px] text-zinc-500 font-black uppercase pl-1">支払方法</label><div className="flex-1 bg-black/20 rounded-lg h-11 px-3 flex items-center relative"><select value={editingItem.data.method||''} onChange={e=>setEditingItem({...editingItem,data:{...editingItem.data,method:e.target.value}})} className="flex-1 w-full bg-transparent text-white font-bold text-sm outline-none appearance-none">{config.paymentMethods.map(m=><option key={m} value={m}>{m}</option>)}</select><ChevronDown size={14} className="absolute right-3 text-zinc-500 pointer-events-none"/></div></div></>
                )}
                {editingItem.type==='payment' && <div className="flex items-center"><label className="w-20 shrink-0 text-[10px] text-zinc-500 font-black uppercase pl-1">名称</label><div className="flex-1 bg-black/20 rounded-lg h-11 flex items-center px-3"><input value={editingItem.data.name||''} onChange={e=>setEditingItem({...editingItem,data:{...editingItem.data,name:e.target.value}})} className="flex-1 w-full bg-transparent text-white font-bold text-sm outline-none"/></div></div>}
                
                <div className="flex gap-2 pt-4 border-t border-white/5">
                  {editingItem.index!==-1 && !['salary','totalBudget','cashBudget','savings','bill','memo'].includes(editingItem.type) && <button onClick={handleDeleteItem} className="w-11 h-11 flex items-center justify-center bg-red-900/20 text-red-500 rounded-lg active:bg-red-900/40"><Trash2 size={18}/></button>}
                  <button onClick={handleSettingsSave} className="flex-1 h-11 bg-white text-black rounded-lg font-black text-xs uppercase">保存</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AppWrapper() { return <ErrorBoundary><AppMain /></ErrorBoundary>; }
