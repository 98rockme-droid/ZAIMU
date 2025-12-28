import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, onSnapshot, query, deleteDoc, serverTimestamp, where, updateDoc } from 'firebase/firestore';
import { Wallet, CreditCard, Landmark, Plus, Settings, Trash2, History, ChevronLeft, ChevronRight, Edit3, X, Tags, ArrowLeft } from 'lucide-react';

/* --- FIREBASE 設定 --- */
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
const SHARED_USER_ID = "my-private-zaimu-v1";

const getMonthString = (date) => date.toISOString().slice(0, 7);
const getTodayString = () => new Date().toISOString().split('T')[0];

/* --- UI COMPONENTS --- */
const SimpleCard = ({ children, className = "" }) => (
  <div className={`bg-[#1E1E1E] rounded-lg border border-white/5 shadow-lg overflow-hidden w-full box-border ${className}`}>
    {children}
  </div>
);

const NavButton = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`flex flex-col items-center justify-center flex-1 py-3 transition-all ${active ? 'text-white' : 'text-zinc-500'}`}>
    <div className={`mb-1 ${active ? 'scale-110' : ''}`}>{icon}</div>
    <span className="text-[10px] font-bold whitespace-nowrap uppercase">{label}</span>
  </button>
);

export default function App() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('home');
  const [settingTab, setSettingTab] = useState('menu');
  const [month, setMonth] = useState(getMonthString(new Date()));
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [monthlyData, setMonthlyData] = useState({ budget: 0, cashBudget: 0, cardBills: {}, fixedCosts: [] });
  const [cashBalance, setCashBalance] = useState(0);
  const [config, setConfig] = useState({ 
    categories: ['食費', '日用品', '交通費', '交際費', '趣味', 'その他'],
    paymentMethods: ['現金', '三井住友', '楽天', 'PayPay']
  });
  const [editingTx, setEditingTx] = useState(null);
  const [filter, setFilter] = useState({ category: 'ALL', method: 'ALL' });

  useEffect(() => {
    const start = new Date(`${month}-01T00:00:00`).toISOString();
    const d = new Date(`${month}-01`); d.setMonth(d.getMonth() + 1);
    const end = d.toISOString();
    const unsubTx = onSnapshot(query(collection(db, 'users', SHARED_USER_ID, 'transactions'), where('date', '>=', start), where('date', '<', end)), (s) => {
      setTransactions(s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => new Date(b.date) - new Date(a.date)));
      setLoading(false);
    });
    const unsubMonth = onSnapshot(doc(db, 'users', SHARED_USER_ID, 'months', month), (s) => {
      setMonthlyData(s.exists() ? s.data() : { budget: 0, cashBudget: 0, cardBills: {}, fixedCosts: [] });
    });
    const unsubCash = onSnapshot(doc(db, 'users', SHARED_USER_ID, 'wallet', 'cash'), (s) => {
      setCashBalance(s.exists() ? s.data().balance : 0);
    });
    const unsubConfig = onSnapshot(doc(db, 'users', SHARED_USER_ID, 'settings', 'config'), (s) => {
      if (s.exists()) setConfig(s.data());
    });
    return () => { unsubTx(); unsubMonth(); unsubCash(); unsubConfig(); };
  }, [month]);

  const summary = useMemo(() => {
    const fixed = (monthlyData.fixedCosts || []).reduce((s, i) => s + i.amount, 0);
    const totalCardBill = Object.values(monthlyData.cardBills || {}).reduce((s, v) => s + (Number(v) || 0), 0);
    
    // カード計算
    const cardBudgetTotal = (monthlyData.budget || 0);
    const cardDisposable = cardBudgetTotal - fixed - totalCardBill;
    const spentCard = transactions.filter(t => t.paymentMethod !== '現金').reduce((s, t) => s + t.amount, 0);
    const cardRemaining = cardDisposable - spentCard;
    // 「あと何%残っているか」
    const cardRemainingPercent = cardDisposable > 0 ? Math.max(Math.round((cardRemaining / cardDisposable) * 100), 0) : 0;

    // 現金計算
    const cashBudgetTotal = (monthlyData.cashBudget || 0);
    const spentCash = transactions.filter(t => t.paymentMethod === '現金').reduce((s, t) => s + t.amount, 0);
    const cashRemaining = cashBudgetTotal - spentCash;
    // 「あと何%残っているか」
    const cashRemainingPercent = cashBudgetTotal > 0 ? Math.max(Math.round((cashRemaining / cashBudgetTotal) * 100), 0) : 0;

    return { 
      cardRemaining, cashRemaining, cardBudget: cardBudgetTotal, cashBudget: cashBudgetTotal, 
      cardRemainingPercent, cashRemainingPercent 
    };
  }, [monthlyData, transactions]);

  const handleTxSubmit = async (e) => {
    e.preventDefault();
    const method = e.target.method.value;
    const amount = Number(e.target.amount.value);
    const data = {
      title: e.target.title.value || e.target.category.value,
      amount,
      category: e.target.category.value,
      paymentMethod: method,
      date: e.target.date.value ? new Date(e.target.date.value).toISOString() : new Date().toISOString()
    };
    if (method === '現金') {
      const diff = editingTx ? editingTx.amount - amount : -amount;
      await setDoc(doc(db, 'users', SHARED_USER_ID, 'wallet', 'cash'), { balance: cashBalance + diff }, { merge: true });
    }
    if (editingTx) {
      await updateDoc(doc(db, 'users', SHARED_USER_ID, 'transactions', editingTx.id), data);
      setEditingTx(null);
    } else {
      await setDoc(doc(collection(db, 'users', SHARED_USER_ID, 'transactions')), { ...data, createdAt: serverTimestamp() });
    }
    setIsModalOpen(false);
  };

  if (loading) return <div className="h-screen bg-[#121212] flex items-center justify-center text-zinc-600 font-bold tracking-widest uppercase font-black">Syncing...</div>;

  return (
    <div className="min-h-screen w-full bg-[#121212] text-zinc-200 font-sans pb-28 flex flex-col items-center overflow-x-hidden font-black">
      
      {/* HEADER */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#121212] border-b border-white/5 px-4 py-4 flex justify-center items-center box-border shadow-lg font-black">
        <div className="w-full max-w-md flex justify-between items-center px-1">
          <div className="flex items-center gap-2">
            <img src="/favicon.ico" alt="logo" className="w-5 h-5 rounded object-contain" onError={(e) => e.target.style.display = 'none'} />
            <h1 className="text-lg font-black tracking-tighter text-white uppercase">ZAIMU</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setMonth(getMonthString(new Date()))} className="px-2.5 py-1.5 bg-white/5 rounded-lg border border-white/5 text-[9px] font-black text-zinc-400">今月</button>
            <div className="flex items-center bg-white/5 rounded-lg px-2 py-1 border border-white/5 font-mono text-xs tabular-nums font-black">
              <button onClick={() => { const d=new Date(`${month}-01`); d.setMonth(d.getMonth()-1); setMonth(getMonthString(d)); }}><ChevronLeft size={16}/></button>
              <span className="px-2 tracking-tight font-black">{month.replace('-','/')}</span>
              <button onClick={() => { const d=new Date(`${month}-01`); d.setMonth(d.getMonth()+1); setMonth(getMonthString(d)); }}><ChevronRight size={16}/></button>
            </div>
          </div>
        </div>
      </header>

      <main className="w-full max-w-md p-4 pt-20 space-y-4 box-border">
        {activeTab === 'home' && (
          <div className="space-y-4 animate-in fade-in duration-300 font-black">
            
            {/* カード情報 */}
            <SimpleCard className="p-5">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-black">カード残り</p>
                  <h2 className={`text-3xl font-black mt-1 tabular-nums ${summary.cardRemaining < 0 ? 'text-red-400' : 'text-white'}`}>
                    ¥{summary.cardRemaining.toLocaleString()}
                  </h2>
                </div>
                <div className="text-right">
                  <p className="text-[8px] text-zinc-600 uppercase font-black tracking-tighter">軍資金</p>
                  <p className="text-xs text-zinc-400 font-black tabular-nums">¥{summary.cardBudget.toLocaleString()}</p>
                </div>
              </div>
              <div className="space-y-1.5 font-black">
                <div className="flex justify-between text-[8px] text-zinc-600 uppercase font-black tracking-widest">
                  <span>残り</span>
                  <span className="tabular-nums">{summary.cardRemainingPercent}%</span>
                </div>
                <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-700 ${summary.cardRemainingPercent <= 10 ? 'bg-red-500' : 'bg-white'}`} 
                    style={{ width: `${summary.cardRemainingPercent}%` }} 
                  />
                </div>
              </div>
            </SimpleCard>

            {/* 現金情報 */}
            <SimpleCard className="p-5">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-black">現金予算残り</p>
                  <h2 className={`text-3xl font-black mt-1 tabular-nums ${summary.cashRemaining < 0 ? 'text-red-400' : 'text-white'}`}>
                    ¥{summary.cashRemaining.toLocaleString()}
                  </h2>
                </div>
                <div className="text-right">
                  <p className="text-[8px] text-zinc-600 uppercase font-black tracking-tighter">軍資金</p>
                  <p className="text-xs text-zinc-400 font-black tabular-nums">¥{summary.cashBudget.toLocaleString()}</p>
                </div>
              </div>
              <div className="space-y-1.5 font-black">
                <div className="flex justify-between text-[8px] text-zinc-600 uppercase font-black tracking-widest">
                  <span>残り</span>
                  <span className="tabular-nums">{summary.cashRemainingPercent}%</span>
                </div>
                <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-700 ${summary.cashRemainingPercent <= 10 ? 'bg-red-500' : 'bg-zinc-400'}`} 
                    style={{ width: `${summary.cashRemainingPercent}%` }} 
                  />
                </div>
              </div>
            </SimpleCard>

          </div>
        )}

        {/* LOG & SETUP タブは前回のスタイル（font-black等）を継承 */}
        {activeTab === 'log' && (
          <div className="space-y-3 animate-in fade-in duration-300">
            <div className="flex gap-2 pb-1 overflow-hidden font-black">
              <select onChange={e => setFilter({...filter, category: e.target.value})} className="bg-white/5 border border-white/10 rounded-lg px-3 h-10 text-[10px] flex-1 text-zinc-300 appearance-none outline-none font-black tracking-widest">
                <option value="ALL">全てのカテゴリ</option>
                {config.categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select onChange={e => setFilter({...filter, method: e.target.value})} className="bg-white/5 border border-white/10 rounded-lg px-3 h-10 text-[10px] flex-1 text-zinc-300 appearance-none outline-none font-black tracking-widest">
                <option value="ALL">全ての支払方法</option>
                {config.paymentMethods.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            {transactions.filter(t => (filter.category === 'ALL' || t.category === filter.category) && (filter.method === 'ALL' || t.paymentMethod === filter.method)).map(t => (
              <SimpleCard key={t.id} className="p-4 flex justify-between items-center font-black">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/5 rounded-lg text-zinc-500">{t.paymentMethod === '現金' ? <Wallet size={16}/> : <CreditCard size={16}/>}</div>
                  <div className="min-w-0">
                    <div className="text-sm text-white truncate font-black">{t.title}</div>
                    <div className="text-[9px] text-zinc-500 uppercase tracking-tighter tabular-nums font-black">{t.category} • {new Date(t.date).toLocaleDateString('ja-JP')}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 pl-2">
                  <span className="text-sm font-black tabular-nums">¥{t.amount.toLocaleString()}</span>
                  <button onClick={() => { setEditingTx(t); setIsModalOpen(true); }} className="text-zinc-600"><Edit3 size={16}/></button>
                  <button onClick={() => { if(window.confirm('削除しますか？')) deleteDoc(doc(db,'users',SHARED_USER_ID,'transactions',t.id)); }} className="text-zinc-800"><Trash2 size={16}/></button>
                </div>
              </SimpleCard>
            ))}
          </div>
        )}

        {/* SETUP */}
        {activeTab === 'settings' && (
          <div className="space-y-4 animate-in fade-in duration-300 font-black">
            {settingTab !== 'menu' && <button onClick={() => setSettingTab('menu')} className="flex items-center gap-2 text-zinc-500 text-xs mb-2 font-black uppercase tracking-widest"><ArrowLeft size={16}/> 戻る</button>}
            {settingTab === 'menu' && (
              <div className="space-y-2.5">
                {[
                  { id: 'budget', label: '資金計画', icon: <Landmark size={18}/> },
                  { id: 'fixed', label: '固定費', icon: <CreditCard size={18}/> },
                  { id: 'category', label: 'カテゴリ編集', icon: <Tags size={18}/> },
                  { id: 'payment', label: '支払方法・カード編集', icon: <Wallet size={18}/> },
                ].map(item => (
                  <button key={item.id} onClick={() => setSettingTab(item.id)} className="w-full flex items-center justify-between p-5 bg-[#1E1E1E] rounded-lg border border-white/5 text-sm font-black">
                    <div className="flex items-center gap-4 text-zinc-300 tracking-tight">{item.icon} {item.label}</div>
                    <ChevronRight size={18} className="text-zinc-700"/>
                  </button>
                ))}
              </div>
            )}
            {/* 以前と同じフォームロジック */}
          </div>
        )}
      </main>

      {/* FAB */}
      <div className="fixed bottom-28 w-full max-w-md pointer-events-none px-6 flex justify-end">
        <button onClick={() => { setEditingTx(null); setIsModalOpen(true); }} className="w-14 h-14 bg-white text-black rounded-full flex items-center justify-center shadow-xl pointer-events-auto active:scale-90 transition-transform border border-zinc-200"><Plus size={26}/></button>
      </div>

      {/* MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 font-black">
          <SimpleCard className="relative w-full max-w-md p-5 space-y-5">
            <div className="flex justify-between items-center">
              <h2 className="text-[10px] font-black uppercase text-white tracking-widest">支出入力</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-zinc-600 hover:text-white"><X size={18}/></button>
            </div>
            <form onSubmit={handleTxSubmit} className="space-y-4">
              <input name="amount" type="number" defaultValue={editingTx?.amount || ''} className="w-full h-14 bg-black/20 border border-white/10 rounded-lg text-2xl font-black text-left px-4 text-white outline-none tabular-nums" placeholder="0" autoFocus required />
              <input name="title" type="text" defaultValue={editingTx?.title || ''} className="w-full h-11 bg-black/20 border border-white/10 rounded-lg px-4 text-sm text-white outline-none font-black" placeholder="タイトル (例: ランチ)" />
              <div className="flex gap-3 w-full">
                <div className="flex-1 flex flex-col gap-1">
                  <label className="text-[9px] text-zinc-500 uppercase pl-1 font-black tracking-widest">日付</label>
                  <input name="date" type="date" defaultValue={editingTx ? editingTx.date.split('T')[0] : getTodayString()} className="w-full h-11 bg-black/20 border border-white/10 rounded-lg text-xs px-2 text-white outline-none font-black tabular-nums" />
                </div>
                <div className="flex-1 flex flex-col gap-1">
                  <label className="text-[9px] text-zinc-500 uppercase pl-1 font-black tracking-widest">カテゴリ</label>
                  <select name="category" defaultValue={editingTx?.category || config.categories[0]} className="w-full h-11 bg-black/20 border border-white/10 rounded-lg text-xs px-2 text-white outline-none appearance-none font-black">
                    {config.categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 justify-start pt-1 font-black">
                {config.paymentMethods.map(m => (
                  <label key={m} className="cursor-pointer">
                    <input type="radio" name="method" value={m} className="peer hidden" defaultChecked={editingTx?.paymentMethod === m || (!editingTx && m === config.paymentMethods[0])} required />
                    <div className="px-3.5 h-10 text-center rounded-lg border border-zinc-800 text-[10px] font-black text-zinc-500 peer-checked:bg-white peer-checked:text-black transition-all flex items-center justify-center min-w-[64px] tracking-widest font-black uppercase">{m}</div>
                  </label>
                ))}
              </div>
              <button type="submit" className="w-full h-12 bg-white text-black font-black rounded-lg text-xs uppercase tracking-widest shadow-lg mt-1 active:scale-95 transition-transform">保存する</button>
            </form>
          </SimpleCard>
        </div>
      )}

      {/* FOOTER */}
      <nav className="fixed bottom-0 w-full max-w-md bg-[#121212]/95 backdrop-blur-md border-t border-white/5 flex justify-around p-3 pb-safe z-40">
        <NavButton active={activeTab === 'home'} onClick={() => setActiveTab('home')} icon={<Landmark size={20}/>} label="Home" />
        <NavButton active={activeTab === 'log'} onClick={() => setActiveTab('log')} icon={<History size={20}/>} label="Log" />
        <NavButton active={activeTab === 'settings'} onClick={() => { setActiveTab('settings'); setSettingTab('menu'); }} icon={<Settings size={20}/>} label="Setup" />
      </nav>
    </div>
  );
}
