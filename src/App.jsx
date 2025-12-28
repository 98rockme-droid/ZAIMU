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

/* --- UI COMPONENTS (角丸 8px) --- */
const SimpleCard = ({ children, className = "" }) => (
  <div className={`bg-[#1E1E1E] rounded-lg border border-white/5 shadow-lg overflow-hidden w-full box-border ${className}`}>
    {children}
  </div>
);

const NavButton = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`flex flex-col items-center justify-center flex-1 py-3 transition-all ${active ? 'text-white' : 'text-zinc-500'}`}>
    <div className={`mb-1 ${active ? 'scale-110' : ''}`}>{icon}</div>
    <span className="text-[10px] font-bold whitespace-nowrap">{label}</span>
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
    const cardDisposable = (monthlyData.budget || 0) - fixed - totalCardBill;
    const spentCard = transactions.filter(t => t.paymentMethod !== '現金').reduce((s, t) => s + t.amount, 0);
    const spentCash = transactions.filter(t => t.paymentMethod === '現金').reduce((s, t) => s + t.amount, 0);
    
    return { 
      cardRemaining: cardDisposable - spentCard, 
      cashRemaining: (monthlyData.cashBudget || 0) - spentCash,
      cardBudget: monthlyData.budget || 0,
      cashBudget: monthlyData.cashBudget || 0,
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

  if (loading) return <div className="h-screen bg-[#121212] flex items-center justify-center text-zinc-600 font-bold tracking-widest uppercase">Syncing...</div>;

  return (
    <div className="min-h-screen w-full bg-[#121212] text-zinc-200 font-sans pb-24 flex flex-col items-center overflow-x-hidden">
      
      {/* HEADER */}
      <header className="sticky top-0 z-40 w-full max-w-md bg-[#121212] border-b border-white/5 px-4 py-4 flex justify-between items-center box-border font-bold">
        <h1 className="text-xl font-black tracking-tighter text-white">ZAIMU</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setMonth(getMonthString(new Date()))} className="px-3 py-1.5 bg-white/5 rounded-lg border border-white/5 text-[10px] font-bold text-zinc-400">今月</button>
          <div className="flex items-center bg-white/5 rounded-lg px-2 py-1 border border-white/5 font-mono text-xs font-bold">
            <button onClick={() => { const d=new Date(`${month}-01`); d.setMonth(d.getMonth()-1); setMonth(getMonthString(d)); }}><ChevronLeft size={18}/></button>
            <span className="px-2">{month.replace('-','/')}</span>
            <button onClick={() => { const d=new Date(`${month}-01`); d.setMonth(d.getMonth()+1); setMonth(getMonthString(d)); }}><ChevronRight size={18}/></button>
          </div>
        </div>
      </header>

      <main className="w-full max-w-md p-4 space-y-4 box-border">
        {activeTab === 'home' && (
          <div className="space-y-4 animate-in fade-in">
            <div className="grid grid-cols-2 gap-3">
              <SimpleCard className="p-5 flex flex-col items-center justify-center text-center h-28">
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-2">カード残り</p>
                <p className={`text-xl font-bold ${summary.cardRemaining < 0 ? 'text-red-400' : 'text-white'}`}>¥{summary.cardRemaining.toLocaleString()}</p>
              </SimpleCard>
              <SimpleCard className="p-5 flex flex-col items-center justify-center text-center h-28">
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-2">カード軍資金</p>
                <p className="text-xl font-bold text-zinc-400">¥{summary.cardBudget.toLocaleString()}</p>
              </SimpleCard>
              <SimpleCard className="p-5 flex flex-col items-center justify-center text-center h-28">
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-2">現金残り</p>
                <p className={`text-xl font-bold ${summary.cashRemaining < 0 ? 'text-red-400' : 'text-white'}`}>¥{summary.cashRemaining.toLocaleString()}</p>
              </SimpleCard>
              <SimpleCard className="p-5 flex flex-col items-center justify-center text-center h-28">
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-2">現金軍資金</p>
                <p className="text-xl font-bold text-zinc-400">¥{summary.cashBudget.toLocaleString()}</p>
              </SimpleCard>
            </div>
            {/* 「現在の現金残高」カードを削除しました */}
          </div>
        )}

        {activeTab === 'log' && (
          <div className="space-y-3 animate-in fade-in">
            <div className="flex gap-2 mb-2 overflow-x-auto no-scrollbar pb-2 font-bold">
              <select onChange={e => setFilter({...filter, category: e.target.value})} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[10px] outline-none h-9 flex-1 text-left text-zinc-300">
                <option value="ALL">全てのカテゴリ</option>
                {config.categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select onChange={e => setFilter({...filter, method: e.target.value})} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[10px] outline-none h-9 flex-1 text-left text-zinc-300">
                <option value="ALL">全ての支払方法</option>
                {config.paymentMethods.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            {transactions.filter(t => (filter.category === 'ALL' || t.category === filter.category) && (filter.method === 'ALL' || t.paymentMethod === filter.method)).map(t => (
              <div key={t.id} className="flex justify-between items-center bg-[#1E1E1E] p-4 rounded-lg border border-white/5 font-bold">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-white/5 rounded-lg text-zinc-500">{t.paymentMethod === '現金' ? <Wallet size={16}/> : <CreditCard size={16}/>}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-white truncate text-left">{t.title}</div>
                    <div className="text-[10px] text-zinc-500 font-bold uppercase text-left truncate">{t.category}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 pl-2">
                  <span className="font-mono text-white text-sm whitespace-nowrap">¥{t.amount.toLocaleString()}</span>
                  <button onClick={() => { setEditingTx(t); setIsModalOpen(true); }} className="p-1 text-zinc-500"><Edit3 size={16}/></button>
                  <button onClick={() => { if(window.confirm('削除しますか？')) deleteDoc(doc(db,'users',SHARED_USER_ID,'transactions',t.id)); }} className="p-1 text-zinc-700"><Trash2 size={16}/></button>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-4 animate-in fade-in font-bold">
            {settingTab !== 'menu' && (
              <button onClick={() => setSettingTab('menu')} className="flex items-center gap-2 text-zinc-500 text-xs font-bold mb-2">
                <ArrowLeft size={16}/> 戻る
              </button>
            )}

            {settingTab === 'menu' && (
              <div className="space-y-2">
                {[
                  { id: 'budget', label: '資金計画', icon: <Landmark size={18}/> },
                  { id: 'fixed', label: '固定費', icon: <CreditCard size={18}/> },
                  { id: 'category', label: 'カテゴリ編集', icon: <Tags size={18}/> },
                  { id: 'payment', label: '支払方法・カード編集', icon: <Wallet size={18}/> },
                ].map(item => (
                  <button key={item.id} onClick={() => setSettingTab(item.id)} className="w-full flex items-center justify-between p-5 bg-[#1E1E1E] rounded-lg border border-white/5 text-sm font-bold">
                    <div className="flex items-center gap-4 text-zinc-300">{item.icon} {item.label}</div>
                    <ChevronRight size={18} className="text-zinc-600"/>
                  </button>
                ))}
              </div>
            )}
            {settingTab === 'budget' && (
              <div className="space-y-4">
                <SimpleCard className="p-6 space-y-6">
                  <h3 className="text-xs font-bold text-zinc-400 text-left uppercase tracking-widest">軍資金</h3>
                  <div className="space-y-4">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-zinc-500 uppercase text-left font-bold tracking-widest">カード用</label>
                      <input type="number" defaultValue={monthlyData.budget} onBlur={e => setDoc(doc(db,'users',SHARED_USER_ID,'months',month),{budget:Number(e.target.value)},{merge:true})} className="w-full h-11 bg-black/20 border border-white/10 rounded-lg px-4 text-left text-white outline-none box-border" placeholder="0" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-zinc-500 uppercase text-left font-bold tracking-widest">現金用</label>
                      <input type="number" defaultValue={monthlyData.cashBudget} onBlur={e => setDoc(doc(db,'users',SHARED_USER_ID,'months',month),{cashBudget:Number(e.target.value)},{merge:true})} className="w-full h-11 bg-black/20 border border-white/10 rounded-lg px-4 text-left text-white outline-none box-border" placeholder="0" />
                    </div>
                  </div>
                </SimpleCard>
              </div>
            )}
            {settingTab === 'fixed' && (
              <SimpleCard className="p-6 space-y-6">
                <h3 className="text-xs font-bold text-zinc-400 text-left uppercase tracking-widest font-bold">固定費管理</h3>
                <div className="space-y-2">
                  {(monthlyData.fixedCosts || []).map(f => (
                    <div key={f.id} className="flex justify-between items-center bg-white/5 p-4 rounded-lg border border-white/5">
                      <span className="text-sm font-bold text-zinc-300 text-left truncate flex-1">{f.name}</span>
                      <div className="flex items-center gap-4 font-bold">
                        <span className="font-mono text-sm text-white">¥{f.amount.toLocaleString()}</span>
                        <button onClick={() => setDoc(doc(db,'users',SHARED_USER_ID,'months',month),{fixedCosts:monthlyData.fixedCosts.filter(x=>x.id!==f.id)},{merge:true})}><Trash2 size={16} className="text-zinc-700"/></button>
                      </div>
                    </div>
                  ))}
                  <div className="flex flex-col gap-2 pt-6">
                    <input id="fx-n" placeholder="費目 (例: 家賃)" className="w-full h-11 bg-black/20 border border-white/10 rounded-lg px-4 text-sm text-white outline-none text-left" />
                    <input id="fx-a" type="number" placeholder="金額" className="w-full h-11 bg-black/20 border border-white/10 rounded-lg px-4 text-sm text-white outline-none text-left font-mono" />
                    <button onClick={() => {
                      const n=document.getElementById('fx-n'),a=document.getElementById('fx-a');
                      if(!n.value || !a.value) return;
                      setDoc(doc(db,'users',SHARED_USER_ID,'months',month),{fixedCosts:[...(monthlyData.fixedCosts || []),{id:Date.now(),name:n.value,amount:Number(a.value)}]},{merge:true});
                      n.value=''; a.value='';
                    }} className="w-full h-11 bg-zinc-200 text-black rounded-lg font-bold text-xs uppercase tracking-widest mt-1">追加</button>
                  </div>
                </div>
              </SimpleCard>
            )}
          </div>
        )}
      </main>

      {/* FAB (完全な円形) */}
      <div className="fixed bottom-28 w-full max-w-md pointer-events-none px-6 flex justify-end">
        <button 
          onClick={() => { setEditingTx(null); setIsModalOpen(true); }} 
          className="w-14 h-14 bg-white text-black rounded-full flex items-center justify-center shadow-2xl pointer-events-auto active:scale-95 transition-transform border border-zinc-200"
        >
          <Plus size={28}/>
        </button>
      </div>

      {/* MODAL (日付とカテゴリの分離を徹底) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <SimpleCard className="relative w-full max-w-md p-6 space-y-6 box-border font-bold">
            <div className="flex justify-between items-center font-bold">
              <h2 className="text-xs font-bold uppercase text-white tracking-widest">支出入力</h2>
              <button onClick={() => setIsModalOpen(false)}><X size={20}/></button>
            </div>
            
            <form onSubmit={handleTxSubmit} className="space-y-5">
              <input name="amount" type="number" defaultValue={editingTx?.amount || ''} className="w-full h-16 bg-black/20 border border-white/10 rounded-lg text-3xl font-bold text-left px-4 text-white outline-none box-border" placeholder="0" autoFocus required />
              <input name="title" type="text" defaultValue={editingTx?.title || ''} className="w-full h-11 bg-black/20 border border-white/10 rounded-lg px-4 text-sm text-left text-white outline-none box-border" placeholder="タイトル (例: ランチ)" />
              
              {/* レイアウトの被り解消: marginとgapを強制適用 */}
              <div className="flex flex-row gap-4 w-full">
                <div className="flex-1 flex flex-col gap-1 overflow-hidden">
                  <label className="text-[10px] text-zinc-500 font-bold uppercase pl-1">日付</label>
                  <input 
                    name="date" 
                    type="date" 
                    defaultValue={editingTx ? editingTx.date.split('T')[0] : getTodayString()} 
                    className="w-full h-11 bg-black/20 border border-white/10 rounded-lg text-xs text-left px-2 text-white outline-none box-border appearance-none" 
                  />
                </div>
                <div className="flex-1 flex flex-col gap-1 overflow-hidden">
                  <label className="text-[10px] text-zinc-500 font-bold uppercase pl-1">カテゴリ</label>
                  <select 
                    name="category" 
                    defaultValue={editingTx?.category || config.categories[0]} 
                    className="w-full h-11 bg-black/20 border border-white/10 rounded-lg text-xs text-left px-2 text-white outline-none appearance-none box-border"
                  >
                    {config.categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 justify-start font-bold">
                {config.paymentMethods.map(m => (
                  <label key={m} className="cursor-pointer">
                    <input type="radio" name="method" value={m} className="peer hidden" defaultChecked={editingTx?.paymentMethod === m || (!editingTx && m === config.paymentMethods[0])} required />
                    <div className="px-4 h-10 text-center rounded-lg border border-zinc-800 text-[10px] font-bold text-zinc-500 peer-checked:bg-white peer-checked:text-black transition-all flex items-center justify-center min-w-[60px]">{m}</div>
                  </label>
                ))}
              </div>
              <button type="submit" className="w-full h-12 bg-white text-black font-bold rounded-lg text-sm shadow-xl mt-2 uppercase tracking-widest">保存する</button>
            </form>
          </SimpleCard>
        </div>
      )}

      {/* FOOTER */}
      <nav className="fixed bottom-0 w-full max-w-md bg-[#121212] border-t border-white/5 flex justify-around p-3 pb-safe z-40">
        <NavButton active={activeTab === 'home'} onClick={() => setActiveTab('home')} icon={<Landmark size={22}/>} label="HOME" />
        <NavButton active={activeTab === 'log'} onClick={() => setActiveTab('log')} icon={<History size={22}/>} label="履歴" />
        <NavButton active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={<Settings size={22}/>} label="設定" />
      </nav>
    </div>
  );
}
