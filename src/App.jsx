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

const normalizeMonthlyData = (d = {}) => ({
  salary: d.salary || 0, budget: d.budget || 0,
  cardBills: d.cardBills || {}, fixedCosts: d.fixedCosts || [],
  catBudgets: d.catBudgets || {}, cardDueDates: d.cardDueDates || {},
  confirmedPayments: d.confirmedPayments || [], savings: d.savings || 0, memo: d.memo || ''
});

const normalizeConfig = (data) => ({
  categories: data?.categories || [{ name: '食費', icon: '🍔' }],
  paymentMethods: data?.paymentMethods || [CASH],
  templates: data?.templates || []
});

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

// 安全な計算用関数
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

  // 🌟 お金の設計図 FAQ
  const FAQ_DATA = [
    {
      category: '⚙️ 1. 設定タブで入力する金額の使い道',
      items: [
        { q: '手取り給与 (salary)', a: '家計のすべてのベース（収入）として使われます。\n影響する場所: ホーム画面の「今月の自由な現金」「来月末の着地予想」の計算のスタート金額になります。' },
        { q: 'クレジットカード利用目安 (budget)', a: 'クレカを使いすぎていないかの「ペースメーカー」になります。\n影響する場所: ホーム画面左上の「今のカード利用額」のプログレスバーと「AIアドバイス」の判定基準に使われます。' },
        { q: '今月の積立額 (savings)', a: '「絶対に使ってはいけないお金（先取り）」として差し引かれます。\n影響する場所: ホームの各予測値からマイナスされ、積立総額に加算されます。' },
        { q: '引落予定のカード（引落額）', a: '「先月使った分のツケ」として扱われます。\n影響する場所: ホーム画面の「今月の自由な現金」からマイナスされます。' },
        { q: '固定費管理', a: '現金払いのものは「今月の自由な現金」から引かれ、全固定費の合計は「来月末の着地予想」から引かれます。' }
      ]
    },
    {
      category: '🏠 2. ホーム画面の金額（アウトプット）の計算式',
      items: [
        { q: '今のカード利用額', a: '今月カード決済した合計。目安に対して何％使っているかバーで表示します。' },
        { q: '今月の自由な現金', a: '【意味】4/25給与から確定支払いを終えた直後に残る、5月中に使っていい現金の総枠。\n【計算式】給与 － 引落予定のカード(先月のツケ) － 固定費(現金) － 積立額' },
        { q: '来月末の着地予想', a: '【意味】今のペースを続けた場合、来月末に手元にいくら純利益が残るかの予想。\n【計算式】給与 － 今のカード利用額 － 固定費(全額) － 積立額' }
      ]
    }
  ];

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
    onSnapshot(doc(db, 'users', user.uid, 'months', month), s => setMonthlyData(normalizeMonthlyData(s.data())));
    onSnapshot(doc(db, 'users', user.uid, 'settings', 'config'), s => s.exists() && setConfig(normalizeConfig(s.data())));
  }, [month, user]);

  /* --- SUMMARY --- */
  const summary = useMemo(() => {
    const d = monthlyData;
    const fixedCosts = d.fixedCosts || [];
    const fixedCash = fixedCosts.filter(f => f.method === CASH).reduce((s, i) => s + toNumber(i.amount), 0);
    const fixedTotal = fixedCosts.reduce((s, i) => s + toNumber(i.amount), 0);
    const salary = toNumber(d.salary);
    const savings = toNumber(d.savings);
    const billTotal = Object.values(d.cardBills).reduce((s, v) => s + toNumber(v), 0);

    const normalTx = transactions.filter(t => !t.isSpecial);
    const spentCard = normalTx.filter(t => t.paymentMethod !== CASH).reduce((s, t) => s + toNumber(t.amount), 0);
    const spentCash = normalTx.filter(t => t.paymentMethod === CASH).reduce((s, t) => s + toNumber(t.amount), 0);

    // 🌟 修正ポイント：今月使った現金は引かない（5月の総枠を出すため）
    const currentFreeCash = salary - billTotal - fixedCash - savings;
    const projectedCash = salary - spentCard - fixedTotal - savings;
    const cardTarget = d.budget || 100000;

    return {
      cardTarget, spentCard, cardPacePercent: Math.min(100, (spentCard / cardTarget) * 100),
      currentFreeCash, projectedCash, savingsAmount: savings,
      catTotals: normalTx.reduce((acc, t) => { acc[t.category] = (acc[t.category] || 0) + toNumber(t.amount); return acc; }, {}),
      totalSpent: normalTx.reduce((s, t) => s + toNumber(t.amount), 0)
    };
  }, [monthlyData, transactions]);

  const showToastMsg = (msg) => { setToast({ visible: true, message: msg }); setTimeout(() => setToast({ visible: false, message: '' }), 2500); };
  const getCategoryNames = () => (config?.categories || []).map(c => c.name);
  const getCategoryIcon = (name) => (config?.categories || []).find(x => x.name === name)?.icon || '🏷';
  const clearLogFilters = () => { setSearchText(''); setFilter({ category: 'ALL', method: 'ALL', special: false }); };

  const handleTxSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;
    const amount = toNumber(inputAmount);
    const payload = { date: toISODateSafe(inputDate), amount, title: inputTitle, category: inputCategory, paymentMethod: inputMethod, isSpecial: inputIsSpecial, updatedAt: serverTimestamp() };
    if (editingTx?.id) await updateDoc(doc(db, 'users', user.uid, 'transactions', editingTx.id), payload);
    else await addDoc(collection(db, 'users', user.uid, 'transactions'), { ...payload, createdAt: serverTimestamp() });
    setIsTxModalOpen(false); showToastMsg('保存しました');
  };

  if (authLoading) return <div className="h-screen bg-[#121212] flex items-center justify-center text-zinc-600">Loading...</div>;
  if (!user) return <div className="h-screen w-full bg-[#121212] flex flex-col items-center justify-center p-6 gap-8"><h1 className="text-4xl font-black text-white">ZAIMU</h1><button onClick={() => signInWithPopup(auth, new GoogleAuthProvider())} className="w-full max-w-xs h-14 bg-white text-black rounded-full font-bold">Google Login</button></div>;

  return (
    <div className="fixed inset-0 w-full bg-[#121212] text-zinc-200 flex flex-col justify-center overflow-hidden">
      <Toast message={toast.message} isVisible={toast.visible} />
      <div className="w-full max-w-md h-full flex flex-col relative bg-[#121212] mx-auto shadow-2xl">
        
        <header className="flex-none h-16 border-b border-white/5 px-4 flex items-center justify-between bg-[#121212]/80 backdrop-blur-xl z-50">
          <button onClick={() => { const d = new Date(month + "-01"); d.setMonth(d.getMonth()-1); setMonth(getMonthString(d)) }}><ChevronLeft size={20}/></button>
          <span className="text-sm font-bold">{formatMonthJP(month)}</span>
          <button onClick={() => { const d = new Date(month + "-01"); d.setMonth(d.getMonth()+1); setMonth(getMonthString(d)) }}><ChevronRight size={20}/></button>
        </header>

        <main className="flex-1 overflow-hidden relative flex flex-col">
          {activeTab === 'home' && (
            <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6 pb-32">
              <SimpleCard className="p-0">
                <div className="grid grid-cols-2 divide-x divide-white/5">
                  <div className="p-4 flex flex-col justify-between">
                    <div>
                      <p className="text-[9px] text-zinc-400 font-bold uppercase mb-1">今のカード利用額</p>
                      <h2 className="text-2xl font-bold text-white">¥{summary.spentCard.toLocaleString()}</h2>
                    </div>
                    <div className="mt-4">
                      <div className="flex justify-between text-[8px] text-zinc-500 mb-1"><span>目安</span><span>¥{summary.cardTarget.toLocaleString()}</span></div>
                      <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                        <div className={`h-full ${summary.spentCard > summary.cardTarget ? 'bg-amber-400' : 'bg-white'}`} style={{ width: `${summary.cardPacePercent}%` }} />
                      </div>
                    </div>
                  </div>
                  <div className="p-4 flex flex-col justify-between gap-4">
                    <div><p className="text-[9px] text-zinc-400 font-bold uppercase mb-1">今月の自由な現金</p><h2 className="text-xl font-bold text-emerald-400">¥{summary.currentFreeCash.toLocaleString()}</h2></div>
                    <div><p className="text-[9px] text-zinc-400 font-bold uppercase mb-1">来月末の着地予想</p><h2 className="text-xl font-bold text-white">¥{summary.projectedCash.toLocaleString()}</h2></div>
                  </div>
                </div>
              </SimpleCard>

              <div className="space-y-3">
                <h3 className="text-[10px] text-zinc-500 uppercase font-black pl-1">カテゴリ別 予算状況</h3>
                <SimpleCard className="grid grid-cols-2 gap-px bg-white/5">
                  {getCategoryNames().map(n => (
                    <div key={n} className="bg-[#1E1E1E] p-3">
                      <p className="text-[10px] font-bold text-zinc-400 mb-1">{getCategoryIcon(n)} {n}</p>
                      <p className="text-sm font-black text-white">¥{(summary.catTotals[n] || 0).toLocaleString()}</p>
                    </div>
                  ))}
                </SimpleCard>
              </div>
            </div>
          )}

          {activeTab === 'log' && (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              <div className="p-4 space-y-3">
                <div className="flex gap-2">
                  <input type="text" value={searchText} onChange={e=>setSearchText(e.target.value)} className="flex-1 h-10 bg-white/5 border border-white/10 rounded-lg px-3 text-sm" placeholder="検索..." />
                  <div className="flex bg-white/5 rounded-lg p-1">
                    <button onClick={()=>setLogView('list')} className={`p-2 rounded ${logView==='list'?'bg-white text-black':'text-zinc-500'}`}><AlignJustify size={16}/></button>
                    <button onClick={()=>setLogView('calendar')} className={`p-2 rounded ${logView==='calendar'?'bg-white text-black':'text-zinc-500'}`}><CalendarDays size={16}/></button>
                  </div>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-4 pb-24">
                <SimpleCard className="divide-y divide-white/5">
                  {transactions.filter(t => t.title.includes(searchText)).map(t => (
                    <div key={t.id} onClick={()=>setViewingTx(t)} className="p-4 flex justify-between items-center active:bg-white/5">
                      <div><p className="text-[10px] text-zinc-500">{formatDateShort(t.date)}</p><p className="text-sm font-bold">{t.title}</p></div>
                      <p className="font-bold">¥{t.amount.toLocaleString()}</p>
                    </div>
                  ))}
                </SimpleCard>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-32">
              {settingTab === 'faq' ? (
                <div className="space-y-4">
                  <button onClick={()=>setSettingTab('menu')} className="text-emerald-400 text-xs flex items-center gap-1"><ArrowLeft size={14}/> 戻る</button>
                  {FAQ_DATA.map(sec => (
                    <div key={sec.category} className="space-y-2">
                      <h3 className="text-[10px] font-bold text-zinc-500 uppercase">{sec.category}</h3>
                      <SimpleCard className="divide-y divide-white/5">
                        {sec.items.map(item => (
                          <div key={item.q} className="p-4 space-y-2">
                            <p className="text-sm font-bold text-white">{item.q}</p>
                            <p className="text-xs text-zinc-400 whitespace-pre-wrap">{item.a}</p>
                          </div>
                        ))}
                      </SimpleCard>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  <SimpleCard className="divide-y divide-white/5">
                    <button onClick={()=>setSettingTab('faq')} className="w-full p-4 flex justify-between items-center text-sm font-bold text-zinc-300"><span>お金の設計図・FAQ</span><HelpCircle size={18}/></button>
                    <SettingsRow onClick={()=>setEditingItem({type:'salary', data:{value:monthlyData.salary}})} left="手取り給与" right={`¥${Number(monthlyData.salary).toLocaleString()}`} />
                    <SettingsRow onClick={()=>setEditingItem({type:'totalBudget', data:{value:monthlyData.budget}})} left="カード利用目安" right={`¥${Number(monthlyData.budget).toLocaleString()}`} />
                    <SettingsRow onClick={()=>setEditingItem({type:'savings', data:{value:monthlyData.savings}})} left="今月の積立額" right={`¥${Number(monthlyData.savings).toLocaleString()}`} />
                  </SimpleCard>
                  <SimpleCard className="p-4 flex justify-center"><button onClick={()=>signOut(auth)} className="text-red-500 text-xs font-bold flex items-center gap-2"><LogOut size={14}/> ログアウト</button></SimpleCard>
                </div>
              )}
            </div>
          )}
        </main>

        <footer className="flex-none h-24 border-t border-white/5 flex justify-between items-center px-6 pb-6 bg-[#121212]/80 backdrop-blur-xl z-50">
          <NavButton active={activeTab==='home'} onClick={()=>setActiveTab('home')} icon={<Home size={24}/>}/>
          <NavButton active={activeTab==='log'} onClick={()=>setActiveTab('log')} icon={<History size={24}/>}/>
          <button onClick={()=>{setEditingTx(null); setInputAmount(''); setInputTitle(''); setInputCategory(getCategoryNames()[0]); setInputMethod(CASH); setIsTxModalOpen(true)}} className="w-14 h-14 bg-white text-black rounded-full flex items-center justify-center shadow-xl active:scale-95"><Plus size={28}/></button>
          <NavButton active={activeTab==='analysis'} onClick={()=>setActiveTab('analysis')} icon={<BarChart3 size={24}/>}/>
          <NavButton active={activeTab==='settings'} onClick={()=>setActiveTab('settings')} icon={<Settings size={24}/>}/>
        </footer>

        {/* MODALS */}
        {isTxModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/80" onClick={()=>setIsTxModalOpen(false)}>
            <form onSubmit={handleTxSubmit} className="w-full max-w-md bg-[#1E1E1E] rounded-t-2xl p-6 space-y-4 pb-12" onClick={e=>e.stopPropagation()}>
              <div className="flex justify-between items-center"><h2 className="font-bold">支出入力</h2><button type="button" onClick={()=>setIsTxModalOpen(false)}><X/></button></div>
              <input type="text" value={inputTitle} onChange={e=>setInputTitle(e.target.value)} className="w-full h-12 bg-white/5 rounded-lg px-4" placeholder="内容" required />
              <div className="flex gap-2">
                <input type="text" value={inputAmount} onChange={e=>setInputAmount(e.target.value)} className="flex-1 h-12 bg-white/5 rounded-lg px-4" placeholder="金額" required />
                <button type="button" onClick={()=>{setCalcInitialValue(inputAmount); setCalcOnConfirm(v=>setInputAmount(String(v))); setShowCalculator(true)}} className="w-12 bg-white/10 rounded-lg flex items-center justify-center"><Calculator size={20}/></button>
              </div>
              <select value={inputCategory} onChange={e=>setInputCategory(e.target.value)} className="w-full h-12 bg-white/5 rounded-lg px-4">
                {getCategoryNames().map(c=><option key={c} value={c}>{c}</option>)}
              </select>
              <div className="flex gap-2">
                {[CASH, 'カード'].map(m => (
                  <button key={m} type="button" onClick={()=>setInputMethod(m)} className={`flex-1 h-10 rounded-lg text-xs font-bold ${inputMethod===m?'bg-white text-black':'bg-white/5 text-zinc-500'}`}>{m}</button>
                ))}
              </div>
              <button type="submit" className="w-full h-14 bg-emerald-500 text-black font-bold rounded-xl mt-4">保存する</button>
            </form>
          </div>
        )}

        {showCalculator && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90 p-4" onClick={()=>setShowCalculator(false)}>
            <div className="w-full max-w-xs" onClick={e=>e.stopPropagation()}><CalculatorPad initialValue={calcInitialValue} onConfirm={v=>{calcOnConfirm(v); setShowCalculator(false)}} /></div>
          </div>
        )}

        {editingItem && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/80" onClick={()=>setEditingItem(null)}>
            <div className="w-full max-w-md bg-[#1E1E1E] rounded-t-2xl p-6 pb-12" onClick={e=>e.stopPropagation()}>
              <CalculatorPad initialValue={editingItem.data.value} onConfirm={async v=>{
                await setDoc(doc(db, 'users', user.uid, 'months', month), { [editingItem.type==='salary'?'salary':editingItem.type==='totalBudget'?'budget':'savings']: v }, { merge: true });
                setEditingItem(null); showToastMsg('保存しました');
              }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const formatDateShort = (dStr) => { const d = new Date(dStr); return `${d.getMonth()+1}/${d.getDate()}`; };

export default function AppWrapper() { return <ErrorBoundary><AppMain /></ErrorBoundary>; }
