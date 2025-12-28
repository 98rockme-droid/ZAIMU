import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, onSnapshot, query, deleteDoc, serverTimestamp, where, updateDoc, writeBatch } from 'firebase/firestore';
import { Wallet, CreditCard, Landmark, Plus, Settings, Trash2, History, ChevronLeft, ChevronRight, Edit3, X, Tags, ArrowLeft, CopyCheck, AlertCircle, Calendar } from 'lucide-react';

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
    <span className="text-[10px] font-bold whitespace-nowrap uppercase tracking-wider">{label}</span>
  </button>
);

export default function App() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('home');
  const [settingTab, setSettingTab] = useState('menu');
  const [month, setMonth] = useState(getMonthString(new Date()));
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [monthlyData, setMonthlyData] = useState({ budget: 0, cashBudget: 0, cardBills: {}, fixedCosts: [], catBudgets: {}, cardDueDates: {} });
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
      setMonthlyData(s.exists() ? s.data() : { budget: 0, cashBudget: 0, cardBills: {}, fixedCosts: [], catBudgets: {}, cardDueDates: {} });
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
    const cardBudgetTotal = (monthlyData.budget || 0);
    const cardDisposable = cardBudgetTotal - fixed - totalCardBill;
    const spentCard = transactions.filter(t => t.paymentMethod !== '現金').reduce((s, t) => s + t.amount, 0);
    const cardRemaining = cardDisposable - spentCard;
    const cardRemainingPercent = cardDisposable > 0 ? Math.max(Math.round((cardRemaining / cardDisposable) * 100), 0) : 0;
    const cashBudgetTotal = (monthlyData.cashBudget || 0);
    const spentCash = transactions.filter(t => t.paymentMethod === '現金').reduce((s, t) => s + t.amount, 0);
    const cashRemaining = cashBudgetTotal - spentCash;
    const cashRemainingPercent = cashBudgetTotal > 0 ? Math.max(Math.round((cashRemaining / cashBudgetTotal) * 100), 0) : 0;

    const catTotals = transactions.reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount;
      return acc;
    }, {});
    const totalSpent = transactions.reduce((s, t) => s + t.amount, 0);

    return { cardRemaining, cashRemaining, cardBudget: cardBudgetTotal, cashBudget: cashBudgetTotal, cardRemainingPercent, cashRemainingPercent, catTotals, totalSpent };
  }, [monthlyData, transactions]);

  const copyFixedCosts = async () => {
    if (!monthlyData.fixedCosts?.length) return alert('コピーする固定費がありません');
    if (!window.confirm('今月の履歴に固定費を一括追加しますか？')) return;
    const batch = writeBatch(db);
    monthlyData.fixedCosts.forEach(f => {
      const newDocRef = doc(collection(db, 'users', SHARED_USER_ID, 'transactions'));
      batch.set(newDocRef, { title: f.name, amount: f.amount, category: '固定費', paymentMethod: config.paymentMethods.find(m => m !== '現金') || 'カード', date: new Date(`${month}-01T09:00:00`).toISOString(), createdAt: serverTimestamp() });
    });
    await batch.commit();
    alert('反映しました');
  };

  const handleTxSubmit = async (e) => {
    e.preventDefault();
    const method = e.target.method.value;
    const amount = Number(e.target.amount.value);
    const data = { title: e.target.title.value || e.target.category.value, amount, category: e.target.category.value, paymentMethod: method, date: e.target.date.value ? new Date(e.target.date.value).toISOString() : new Date().toISOString() };
    if (method === '現金') { const diff = editingTx ? editingTx.amount - amount : -amount; await setDoc(doc(db, 'users', SHARED_USER_ID, 'wallet', 'cash'), { balance: cashBalance + diff }, { merge: true }); }
    if (editingTx) { await updateDoc(doc(db, 'users', SHARED_USER_ID, 'transactions', editingTx.id), data); setEditingTx(null); }
    else { await setDoc(doc(collection(db, 'users', SHARED_USER_ID, 'transactions')), { ...data, createdAt: serverTimestamp() }); }
    setIsModalOpen(false);
  };

  const COLORS = ['#FFFFFF', '#D4D4D8', '#A1A1AA', '#71717A', '#52525B', '#3F3F46', '#27272A'];

  if (loading) return <div className="h-screen bg-[#121212] flex items-center justify-center text-zinc-600 font-bold uppercase tracking-widest">Syncing...</div>;

  return (
    <div className="min-h-screen w-full bg-[#121212] text-zinc-200 font-sans pb-28 flex flex-col items-center overflow-x-hidden">
      
      {/* HEADER */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#121212] border-b border-white/5 px-4 py-4 flex justify-center shadow-lg">
        <div className="w-full max-w-md flex justify-between items-center px-1">
          <h1 className="text-lg font-bold tracking-tighter text-white uppercase">ZAIMU</h1>
          <div className="flex items-center bg-white/5 rounded-lg px-2 py-1 border border-white/5 font-mono text-xs">
            <button onClick={() => { const d=new Date(`${month}-01`); d.setMonth(d.getMonth()-1); setMonth(getMonthString(d)); }}><ChevronLeft size={16}/></button>
            <span className="px-2 font-bold">{month.replace('-','/')}</span>
            <button onClick={() => { const d=new Date(`${month}-01`); d.setMonth(d.getMonth()+1); setMonth(getMonthString(d)); }}><ChevronRight size={16}/></button>
          </div>
        </div>
      </header>

      <main className="w-full max-w-md p-4 pt-20 space-y-4 box-border">
        
        {activeTab === 'home' && (
          <div className="space-y-4 animate-in fade-in duration-500">
            {/* 支払いリマインダー (機能4) */}
            {Object.entries(monthlyData.cardDueDates || {}).map(([card, day]) => {
              const today = new Date().getDate();
              const diff = Number(day) - today;
              if (diff >= 0 && diff <= 7) return (
                <div key={card} className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-center gap-3 text-red-400">
                  <AlertCircle size={18}/>
                  <span className="text-[10px] font-bold uppercase tracking-tight">{card}: {day}日に引き落としがあります (あと{diff}日)</span>
                </div>
              );
              return null;
            })}

            <SimpleCard className="p-5">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="text-[10px] text-zinc-500 uppercase font-bold">カード残り</p>
                  <h2 className={`text-3xl font-bold mt-1 ${summary.cardRemaining < 0 ? 'text-red-400' : 'text-white'}`}>¥{summary.cardRemaining.toLocaleString()}</h2>
                </div>
                <div className="h-10 w-10 relative flex-shrink-0">
                   <svg className="w-full h-full transform -rotate-90"><circle cx="20" cy="20" r="18" stroke="currentColor" strokeWidth="3" fill="transparent" className="text-white/5" /><circle cx="20" cy="20" r="18" stroke="currentColor" strokeWidth="3" fill="transparent" strokeDasharray={113} strokeDashoffset={113 - (113 * summary.cardRemainingPercent) / 100} className={summary.cardRemainingPercent <= 10 ? 'text-red-500' : 'text-white'} strokeLinecap="round" /></svg>
                </div>
              </div>
              <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                <div className={`h-full transition-all duration-1000 ${summary.cardRemainingPercent <= 10 ? 'bg-red-500' : 'bg-white'}`} style={{ width: `${summary.cardRemainingPercent}%` }} />
              </div>
            </SimpleCard>

            {/* 円グラフ (ブラッシュアップ) */}
            {summary.totalSpent > 0 && (
              <SimpleCard className="p-6">
                <p className="text-[10px] text-zinc-500 uppercase font-bold mb-6 tracking-widest">Category Share</p>
                <div className="flex items-center gap-8">
                  <div className="w-24 h-24 rounded-full flex-shrink-0 relative shadow-[0_0_20px_rgba(0,0,0,0.4)]" 
                       style={{ background: `conic-gradient(from 0deg, ${Object.entries(summary.catTotals).map(([cat, amt], idx) => {
                         const start = Object.values(summary.catTotals).slice(0, idx).reduce((s, v) => s + v, 0);
                         return `${COLORS[idx % COLORS.length]} ${(start/summary.totalSpent)*360}deg ${((start+amt)/summary.totalSpent)*360}deg`;
                       }).join(', ')})` }}>
                    <div className="absolute inset-[15%] bg-[#1E1E1E] rounded-full flex items-center justify-center border border-white/5">
                      <span className="text-[8px] text-zinc-500 font-bold">SHARES</span>
                    </div>
                  </div>
                  <div className="space-y-2 flex-1 min-w-0">
                    {Object.entries(summary.catTotals).map(([cat, amt], idx) => (
                      <div key={cat} className="flex justify-between items-center text-[10px] font-bold">
                        <div className="flex items-center gap-2 truncate">
                          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                          <span className="text-zinc-400 truncate">{cat}</span>
                        </div>
                        <span className="text-zinc-500 pl-2">¥{amt.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </SimpleCard>
            )}

            {/* カテゴリ別予算進捗 (機能2) */}
            <div className="grid grid-cols-2 gap-3">
              {config.categories.filter(c => monthlyData.catBudgets?.[c]).map(c => {
                const spent = summary.catTotals[c] || 0;
                const budget = monthlyData.catBudgets[c];
                const remain = budget - spent;
                const per = Math.max(Math.round((remain / budget) * 100), 0);
                return (
                  <SimpleCard key={c} className="p-3 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-bold text-zinc-400 truncate">{c}</span>
                      <span className="text-[9px] font-mono text-zinc-500">{per}%</span>
                    </div>
                    <div className="h-0.5 bg-white/5 w-full rounded-full overflow-hidden">
                      <div className={`h-full ${per < 15 ? 'bg-red-500' : 'bg-zinc-400'}`} style={{ width: `${per}%` }} />
                    </div>
                  </SimpleCard>
                );
              })}
            </div>
          </div>
        )}

        {/* LOG TAB */}
        {activeTab === 'log' && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <select onChange={e => setFilter({...filter, category: e.target.value})} className="bg-white/5 border border-white/10 rounded-lg px-3 h-10 text-[10px] flex-1 text-zinc-300 font-bold">
                <option value="ALL">ALL CATEGORIES</option>
                {config.categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select onChange={e => setFilter({...filter, method: e.target.value})} className="bg-white/5 border border-white/10 rounded-lg px-3 h-10 text-[10px] flex-1 text-zinc-300 font-bold">
                <option value="ALL">ALL PAYMENTS</option>
                {config.paymentMethods.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            {transactions.filter(t => (filter.category === 'ALL' || t.category === filter.category) && (filter.method === 'ALL' || t.paymentMethod === filter.method)).map(t => (
              <SimpleCard key={t.id} className="p-4 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/5 rounded-lg text-zinc-500">{t.paymentMethod === '現金' ? <Wallet size={16}/> : <CreditCard size={16}/>}</div>
                  <div className="text-left"><div className="text-sm font-bold text-white truncate w-32">{t.title}</div><div className="text-[8px] text-zinc-500 uppercase">{t.category} • {t.date.split('T')[0]}</div></div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold">¥{t.amount.toLocaleString()}</span>
                  <button onClick={() => { setEditingTx(t); setIsModalOpen(true); }} className="text-zinc-700"><Edit3 size={14}/></button>
                  <button onClick={() => deleteDoc(doc(db,'users',SHARED_USER_ID,'transactions',t.id))} className="text-red-900/40"><Trash2 size={14}/></button>
                </div>
              </SimpleCard>
            ))}
          </div>
        )}

        {/* SETUP TAB (メニュー復元) */}
        {activeTab === 'settings' && (
          <div className="space-y-4">
            {settingTab !== 'menu' && <button onClick={() => setSettingTab('menu')} className="flex items-center gap-2 text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-2"><ArrowLeft size={14}/> BACK</button>}
            
            {settingTab === 'menu' && (
              <div className="grid grid-cols-1 gap-2.5">
                {[{ id: 'budget', label: 'BUDGET & DUE DATES', icon: <Landmark size={18}/> }, { id: 'fixed', label: 'FIXED COSTS', icon: <CreditCard size={18}/> }, { id: 'category', label: 'CATEGORIES', icon: <Tags size={18}/> }, { id: 'payment', label: 'PAYMENT METHODS', icon: <Wallet size={18}/> }].map(item => (
                  <button key={item.id} onClick={() => setSettingTab(item.id)} className="flex items-center justify-between p-5 bg-[#1E1E1E] rounded-lg border border-white/5 text-[11px] font-bold">
                    <div className="flex items-center gap-4 text-zinc-300">{item.icon} {item.label}</div>
                    <ChevronRight size={16} className="text-zinc-800"/>
                  </button>
                ))}
              </div>
            )}

            {settingTab === 'budget' && (
              <div className="space-y-4 font-bold">
                <SimpleCard className="p-5 space-y-4">
                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Overall Budget</p>
                  <input type="number" defaultValue={monthlyData.budget} onBlur={e => setDoc(doc(db,'users',SHARED_USER_ID,'months',month),{budget:Number(e.target.value)},{merge:true})} className="w-full h-11 bg-black/20 border border-white/10 rounded-lg px-4 text-sm text-white outline-none" placeholder="Card Budget" />
                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold pt-2">Card Bill & Due Dates</p>
                  {config.paymentMethods.filter(m => m !== '現金').map(m => (
                    <div key={m} className="flex gap-2 items-center">
                      <span className="text-[9px] text-zinc-500 w-16 truncate">{m}</span>
                      <input type="number" placeholder="Bill" defaultValue={monthlyData.cardBills?.[m] || 0} onBlur={e => setDoc(doc(db,'users',SHARED_USER_ID,'months',month),{cardBills:{...monthlyData.cardBills,[m]:Number(e.target.value)}},{merge:true})} className="flex-1 h-9 bg-black/20 border border-white/10 rounded px-2 text-[10px] text-white outline-none" />
                      <input type="number" placeholder="Day" defaultValue={monthlyData.cardDueDates?.[m] || ''} onBlur={e => setDoc(doc(db,'users',SHARED_USER_ID,'months',month),{cardDueDates:{...monthlyData.cardDueDates,[m]:e.target.value}},{merge:true})} className="w-12 h-9 bg-black/20 border border-white/10 rounded px-2 text-[10px] text-white outline-none" />
                    </div>
                  ))}
                </SimpleCard>
              </div>
            )}

            {settingTab === 'category' && (
              <SimpleCard className="p-5 space-y-4 font-bold">
                <p className="text-[10px] text-zinc-500 uppercase font-bold">Category Budgets</p>
                {config.categories.map(c => (
                  <div key={c} className="flex items-center justify-between gap-4 border-b border-white/5 pb-2">
                    <span className="text-xs text-zinc-300">{c}</span>
                    <input type="number" placeholder="None" defaultValue={monthlyData.catBudgets?.[c] || ''} onBlur={e => setDoc(doc(db,'users',SHARED_USER_ID,'months',month),{catBudgets:{...monthlyData.catBudgets,[c]:Number(e.target.value)}},{merge:true})} className="w-24 h-8 bg-black/20 border border-white/10 rounded text-right px-2 text-xs text-white" />
                  </div>
                ))}
              </SimpleCard>
            )}

            {settingTab === 'fixed' && (
              <SimpleCard className="p-5 space-y-4 font-bold">
                <div className="flex justify-between items-center"><p className="text-[10px] text-zinc-500 font-bold uppercase">Fixed Costs</p><button onClick={copyFixedCosts} className="px-2 py-1 bg-white/10 rounded text-[9px]"><CopyCheck size={12}/></button></div>
                {(monthlyData.fixedCosts || []).map(f => (
                  <div key={f.id} className="flex justify-between text-xs p-3 bg-black/20 rounded border border-white/5"><span>{f.name}</span><span>¥{f.amount.toLocaleString()}</span></div>
                ))}
                <div className="space-y-2 pt-2">
                  <input id="fx-n" placeholder="Name" className="w-full h-9 bg-black/20 border border-white/10 rounded px-3 text-xs" />
                  <input id="fx-a" type="number" placeholder="Amount" className="w-full h-9 bg-black/20 border border-white/10 rounded px-3 text-xs" />
                  <button onClick={() => { const n=document.getElementById('fx-n'),a=document.getElementById('fx-a'); setDoc(doc(db,'users',SHARED_USER_ID,'months',month),{fixedCosts:[...monthlyData.fixedCosts,{id:Date.now(),name:n.value,amount:Number(a.value)}]},{merge:true}); n.value=''; a.value=''; }} className="w-full h-10 bg-white text-black text-[10px] font-bold uppercase tracking-widest rounded">Add Cost</button>
                </div>
              </SimpleCard>
            )}
            
            {settingTab === 'payment' && (
              <SimpleCard className="p-5 space-y-4 font-bold">
                 <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Methods</p>
                 <div className="flex flex-wrap gap-2">
                   {config.paymentMethods.map(m => (
                     <div key={m} className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded border border-white/10 text-[10px]">
                       {m} <button onClick={() => setDoc(doc(db,'users',SHARED_USER_ID,'settings','config'),{...config,paymentMethods:config.paymentMethods.filter(x=>x!==m)})}><X size={10}/></button>
                     </div>
                   ))}
                 </div>
                 <input id="new-p" placeholder="New Method" className="w-full h-9 bg-black/20 border border-white/10 rounded px-3 text-xs" />
                 <button onClick={() => { const i=document.getElementById('new-p'); setDoc(doc(db,'users',SHARED_USER_ID,'settings','config'),{...config,paymentMethods:[...config.paymentMethods,i.value]}); i.value=''; }} className="w-full h-10 bg-zinc-200 text-black text-[10px] font-bold rounded uppercase">Add</button>
              </SimpleCard>
            )}
          </div>
        )}
      </main>

      {/* FAB & MODAL */}
      <div className="fixed bottom-28 w-full max-w-md px-6 flex justify-end">
        <button onClick={() => { setEditingTx(null); setIsModalOpen(true); }} className="w-14 h-14 bg-white text-black rounded-full flex items-center justify-center shadow-2xl active:scale-90 transition-transform"><Plus size={28}/></button>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in zoom-in-95 duration-200">
          <SimpleCard className="max-w-md p-6 space-y-5">
            <div className="flex justify-between items-center"><span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Entry</span><button onClick={() => setIsModalOpen(false)}><X size={18}/></button></div>
            <form onSubmit={handleTxSubmit} className="space-y-4">
              <input name="amount" type="number" defaultValue={editingTx?.amount || ''} className="w-full h-16 bg-transparent text-4xl font-bold text-white outline-none text-center" placeholder="0" autoFocus required />
              <input name="title" placeholder="Title" defaultValue={editingTx?.title || ''} className="w-full h-11 bg-white/5 rounded-lg px-4 text-sm font-bold outline-none border border-white/5 focus:border-white/20" />
              <div className="flex gap-4">
                <div className="flex-1"><label className="text-[8px] text-zinc-600 block pl-1 mb-1">DATE</label><input name="date" type="date" defaultValue={editingTx ? editingTx.date.split('T')[0] : getTodayString()} className="w-full h-11 bg-white/5 rounded-lg px-2 text-[10px] text-white outline-none border border-white/5" /></div>
                <div className="flex-1"><label className="text-[8px] text-zinc-600 block pl-1 mb-1">CATEGORY</label><select name="category" defaultValue={editingTx?.category || config.categories[0]} className="w-full h-11 bg-white/5 rounded-lg px-2 text-[10px] text-white outline-none border border-white/5 appearance-none">
                  {config.categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select></div>
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                {config.paymentMethods.map(m => (
                  <label key={m} className="flex-1 min-w-[70px]">
                    <input type="radio" name="method" value={m} defaultChecked={editingTx?.paymentMethod === m || (!editingTx && m === config.paymentMethods[0])} className="peer hidden" />
                    <div className="h-10 border border-white/5 rounded-lg flex items-center justify-center text-[10px] font-bold text-zinc-600 peer-checked:bg-white peer-checked:text-black transition-all uppercase tracking-tighter">{m}</div>
                  </label>
                ))}
              </div>
              <button type="submit" className="w-full h-12 bg-white text-black rounded-lg font-bold text-xs uppercase tracking-widest mt-2 active:scale-95 transition-transform">Save Record</button>
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
