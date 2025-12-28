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
  <div className={`bg-[#1E1E1E] rounded-lg border border-white/5 shadow-lg overflow-hidden ${className}`}>
    {children}
  </div>
);

const NavButton = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`flex flex-col items-center justify-center flex-1 py-3 transition-all ${active ? 'text-white' : 'text-zinc-500'}`}>
    <div className={`mb-1 ${active ? 'scale-110' : ''}`}>{icon}</div>
    <span className="text-[10px] font-bold whitespace-nowrap">{label}</span>
  </button>
);

/* --- 設定用リスト管理 (左寄せ・8pxルール) --- */
const ListManager = ({ items, onUpdate, placeholder, idPrefix }) => {
  const [val, setVal] = useState('');
  const add = () => { if (val && !items.includes(val)) { onUpdate([...items, val]); setVal(''); } };
  return (
    <div className="space-y-6 w-full">
      <div className="flex flex-wrap gap-2 justify-start"> {/* 左寄せに変更 */}
        {items.map(i => (
          <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-lg border border-white/10">
            <span className="text-xs text-zinc-300">{i}</span>
            <button onClick={() => onUpdate(items.filter(x => x !== i))}><Trash2 size={12} className="text-zinc-600" /></button>
          </div>
        ))}
      </div>
      <div className="flex gap-2 h-11 pt-2">
        <input 
          id={idPrefix}
          value={val} 
          onChange={e => setVal(e.target.value)} 
          placeholder={placeholder} 
          className="flex-1 bg-black/20 border border-white/10 rounded-lg px-4 text-sm text-left text-white outline-none" 
        />
        <button onClick={add} className="bg-zinc-200 text-black px-4 rounded-lg font-bold text-[10px] uppercase tracking-widest">追加</button>
      </div>
    </div>
  );
};

/* --- MAIN APP --- */
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
    paymentMethods: ['現金', 'カード1', 'カード2']
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
    const cashRemaining = (monthlyData.cashBudget || 0) - spentCash;
    return { 
      cardRemaining: cardDisposable - spentCard, 
      cashRemaining,
      cardBudget: monthlyData.budget || 0,
      cashBudget: monthlyData.cashBudget || 0,
      cardPercent: cardDisposable > 0 ? Math.min(Math.round((spentCard / cardDisposable) * 100), 100) : 0,
      cashPercent: monthlyData.cashBudget > 0 ? Math.min(Math.round((spentCash / monthlyData.cashBudget) * 100), 100) : 0
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
    <div className="min-h-screen bg-[#121212] text-zinc-200 font-sans pb-24 flex flex-col items-center">
      {/* HEADER */}
      <header className="sticky top-0 z-40 w-full max-w-md bg-[#121212]/90 backdrop-blur-md border-b border-white/5 px-4 py-4 flex justify-between items-center">
        <h1 className="text-xl font-black tracking-tighter text-white uppercase">Zaimu</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setMonth(getMonthString(new Date()))} className="px-3 py-1.5 bg-white/5 rounded-lg border border-white/5 text-[10px] font-bold text-zinc-400">今月</button>
          <div className="flex items-center bg-white/5 rounded-lg px-2 py-1 border border-white/5 font-mono text-xs font-bold">
            <button onClick={() => { const d=new Date(`${month}-01`); d.setMonth(d.getMonth()-1); setMonth(getMonthString(d)); }}><ChevronLeft size={18}/></button>
            <span className="px-2">{month.replace('-','/')}</span>
            <button onClick={() => { const d=new Date(`${month}-01`); d.setMonth(d.getMonth()+1); setMonth(getMonthString(d)); }}><ChevronRight size={18}/></button>
          </div>
        </div>
      </header>

      <main className="w-full max-w-md p-4 space-y-6">
        {activeTab === 'home' && (
          <div className="space-y-4 animate-in fade-in">
            <div className="grid grid-cols-3 gap-2">
              <SimpleCard className="py-4 flex flex-col items-center justify-center text-center">
                <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest mb-1">今月の残り</p>
                <p className={`text-sm font-bold ${summary.cardRemaining < 0 ? 'text-red-400' : 'text-white'}`}>¥{summary.cardRemaining.toLocaleString()}</p>
              </SimpleCard>
              <SimpleCard className="py-4 flex flex-col items-center justify-center text-center">
                <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest mb-1">軍資金(ｶｰﾄﾞ)</p>
                <p className="text-sm font-bold text-white">¥{summary.cardBudget.toLocaleString()}</p>
              </SimpleCard>
              <SimpleCard className="py-4 flex flex-col items-center justify-center text-center">
                <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest mb-1">軍資金(現金)</p>
                <p className="text-sm font-bold text-white">¥{summary.cashBudget.toLocaleString()}</p>
              </SimpleCard>
            </div>
            <SimpleCard className="p-8 flex flex-col items-center bg-[#252525]">
              <div className="flex items-center gap-2 text-zinc-400 mb-1">
                <Wallet size={14} /><span className="text-[10px] font-bold uppercase tracking-widest">現在の現金残高 (財布)</span>
              </div>
              <p className="text-4xl font-bold text-white tracking-tight">¥{cashBalance.toLocaleString()}</p>
              <button onClick={() => {
                const val = prompt("残高修正", cashBalance);
                if (val !== null) setDoc(doc(db, 'users', SHARED_USER_ID, 'wallet', 'cash'), { balance: Number(val) });
              }} className="mt-4 text-[10px] text-zinc-500 font-bold border border-white/10 px-4 py-1.5 rounded-lg">残高を修正</button>
            </SimpleCard>
          </div>
        )}

        {activeTab === 'log' && (
          <div className="space-y-3 animate-in fade-in">
            <div className="flex gap-2 mb-2 overflow-x-auto no-scrollbar pb-2">
              <select onChange={e => setFilter({...filter, category: e.target.value})} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[10px] outline-none h-9 flex-1 text-left">
                <option value="ALL">全てのカテゴリ</option>
                {config.categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select onChange={e => setFilter({...filter, method: e.target.value})} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[10px] outline-none h-9 flex-1 text-left">
                <option value="ALL">全ての支払方法</option>
                {config.paymentMethods.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            {transactions.filter(t => (filter.category === 'ALL' || t.category === filter.category) && (filter.method === 'ALL' || t.paymentMethod === filter.method)).map(t => (
              <div key={t.id} className="flex justify-between items-center bg-[#1E1E1E] p-4 rounded-lg border border-white/5 group">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-white/5 rounded-lg text-zinc-500 group-hover:text-white">{t.paymentMethod === '現金' ? <Wallet size={16}/> : <CreditCard size={16}/>}</div>
                  <div className="max-w-[120px] overflow-hidden">
                    <div className="text-sm font-bold text-white truncate text-left">{t.title}</div>
                    <div className="text-[10px] text-zinc-500 font-bold uppercase text-left tracking-tighter">{t.category} • {new Date(t.date).toLocaleDateString('ja-JP')}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold whitespace-nowrap">¥{t.amount.toLocaleString()}</span>
                  <div className="flex gap-1">
                    <button onClick={() => { setEditingTx(t); setIsModalOpen(true); }} className="p-1 text-zinc-500 hover:text-white transition-colors"><Edit3 size={16}/></button>
                    <button onClick={() => { if(window.confirm('削除しますか？')) deleteDoc(doc(db,'users',SHARED_USER_ID,'transactions',t.id)); }} className="p-1 text-zinc-700 hover:text-red-400 transition-colors"><Trash2 size={16}/></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-4 animate-in fade-in">
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
                    <div className="flex items-center gap-4 text-zinc-300 tracking-tight">{item.icon} {item.label}</div>
                    <ChevronRight size={18} className="text-zinc-600"/>
                  </button>
                ))}
              </div>
            )}

            {settingTab === 'budget' && (
              <div className="space-y-4">
                <SimpleCard className="p-8 space-y-6">
                  <h3 className="text-xs font-bold text-zinc-400 text-left uppercase tracking-widest">軍資金</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] text-zinc-500 mb-1 block uppercase text-left tracking-widest font-bold">カード用</label>
                      <input type="number" defaultValue={monthlyData.budget} onBlur={e => setDoc(doc(db,'users',SHARED_USER_ID,'months',month),{budget:Number(e.target.value)},{merge:true})} className="w-full h-11 bg-black/20 border border-white/10 rounded-lg p-3 text-left text-white outline-none" placeholder="0" />
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-500 mb-1 block uppercase text-left tracking-widest font-bold">現金用</label>
                      <input type="number" defaultValue={monthlyData.cashBudget} onBlur={e => setDoc(doc(db,'users',SHARED_USER_ID,'months',month),{cashBudget:Number(e.target.value)},{merge:true})} className="w-full h-11 bg-black/20 border border-white/10 rounded-lg p-3 text-left text-white outline-none" placeholder="0" />
                    </div>
                  </div>
                </SimpleCard>
                <SimpleCard className="p-8 space-y-6">
                  <h3 className="text-xs font-bold text-zinc-400 text-left uppercase tracking-widest">カード別請求額</h3>
                  <div className="space-y-4">
                    {config.paymentMethods.filter(m => m !== '現金').map(card => (
                      <div key={card}>
                        <label className="text-[10px] text-zinc-500 mb-1 block uppercase text-left tracking-widest font-bold">{card}</label>
                        <input 
                          type="number" 
                          defaultValue={monthlyData.cardBills?.[card] || 0} 
                          onBlur={e => {
                            const newBills = { ...(monthlyData.cardBills || {}), [card]: Number(e.target.value) };
                            setDoc(doc(db,'users',SHARED_USER_ID,'months',month),{cardBills:newBills},{merge:true});
                          }} 
                          className="w-full h-11 bg-black/20 border border-white/10 rounded-lg p-3 text-left text-white outline-none font-mono" 
                          placeholder="0"
                        />
                      </div>
                    ))}
                  </div>
                </SimpleCard>
              </div>
            )}

            {settingTab === 'fixed' && (
              <SimpleCard className="p-8 space-y-6">
                <h3 className="text-xs font-bold text-zinc-400 text-left uppercase tracking-widest">固定費管理</h3>
                <div className="space-y-2">
                  {(monthlyData.fixedCosts || []).map(f => (
                    <div key={f.id} className="flex justify-between items-center bg-white/5 p-4 rounded-lg border border-white/5">
                      <span className="text-sm font-bold text-zinc-300 text-left">{f.name}</span>
                      <div className="flex items-center gap-4">
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

            {settingTab === 'category' && (
              <SimpleCard className="p-8 space-y-6">
                <h3 className="text-xs font-bold text-zinc-400 text-left uppercase tracking-widest">カテゴリ編集</h3>
                <ListManager 
                  items={config.categories} 
                  onUpdate={c => setDoc(doc(db,'users',SHARED_USER_ID,'settings','config'),{...config,categories:c})} 
                  placeholder="新カテゴリ" 
                  idPrefix="new-cat"
                />
              </SimpleCard>
            )}

            {settingTab === 'payment' && (
              <SimpleCard className="p-8 space-y-6">
                <h3 className="text-xs font-bold text-zinc-400 text-left uppercase tracking-widest font-bold">支払方法・カード</h3>
                <ListManager 
                  items={config.paymentMethods} 
                  onUpdate={p => setDoc(doc(db,'users',SHARED_USER_ID,'settings','config'),{...config,paymentMethods:p})} 
                  placeholder="カード名等" 
                  idPrefix="new-pay"
                />
              </SimpleCard>
            )}
          </div>
        )}
      </main>

      {/* FAB */}
      <div className="fixed bottom-28 w-full max-w-md pointer-events-none px-6 flex justify-end">
        <button 
          onClick={() => { setEditingTx(null); setIsModalOpen(true); }} 
          className="w-14 h-14 bg-white text-black rounded-lg flex items-center justify-center shadow-2xl pointer-events-auto active:scale-95 transition-transform"
        >
          <Plus size={28}/>
        </button>
      </div>

      {/* MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <SimpleCard className="relative w-full max-w-md p-6 space-y-6">
            <div className="flex justify-between items-center"><h2 className="text-xs font-bold uppercase text-white tracking-widest font-bold">支出入力</h2><button onClick={() => setIsModalOpen(false)}><X size={20}/></button></div>
            <form onSubmit={handleTxSubmit} className="space-y-5">
              <input name="amount" type="number" defaultValue={editingTx?.amount || ''} className="w-full h-16 bg-black/20 border border-white/10 rounded-lg text-3xl font-bold text-left px-4 text-white outline-none" placeholder="0" autoFocus required />
              <input name="title" type="text" defaultValue={editingTx?.title || ''} className="w-full h-11 bg-black/20 border border-white/10 rounded-lg p-3 text-sm text-left text-white outline-none" placeholder="タイトル (例: ランチ)" />
              <div className="grid grid-cols-2 gap-3">
                <input name="date" type="date" defaultValue={editingTx ? editingTx.date.split('T')[0] : getTodayString()} className="w-full h-11 bg-black/20 border border-white/10 rounded-lg text-xs text-left px-3 text-white outline-none" />
                <select name="category" defaultValue={editingTx?.category || config.categories[0]} className="w-full h-11 bg-black/20 border border-white/10 rounded-lg text-xs text-left px-3 text-white outline-none appearance-none">
                  {config.categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="flex flex-wrap gap-2 justify-start"> {/* 左寄せに変更 */}
                {config.paymentMethods.map(m => (
                  <label key={m} className="cursor-pointer">
                    <input type="radio" name="method" value={m} className="peer hidden" defaultChecked={editingTx?.paymentMethod === m || (!editingTx && m === config.paymentMethods[0])} required />
                    <div className="px-4 h-10 text-center rounded-lg border border-zinc-800 text-[10px] font-bold text-zinc-500 peer-checked:bg-white peer-checked:text-black transition-all flex items-center justify-center min-w-[60px]">{m}</div>
                  </label>
                ))}
              </div>
              <button type="submit" className="w-full h-12 bg-white text-black font-bold rounded-lg text-xs uppercase tracking-widest shadow-xl">保存する</button>
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
