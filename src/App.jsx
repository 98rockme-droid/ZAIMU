import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, onSnapshot, query, deleteDoc, serverTimestamp, where, updateDoc } from 'firebase/firestore';
import { Wallet, CreditCard, Landmark, Plus, Settings, Trash2, History, ChevronLeft, ChevronRight, Edit3, X, CalendarDays, Calendar } from 'lucide-react';

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
const SHARED_USER_ID = "my-private-zaimu-v1"; // 同期用ID

const getMonthString = (date) => date.toISOString().slice(0, 7);
const getTodayString = () => new Date().toISOString().split('T')[0];

/* --- UI COMPONENTS --- */
const SimpleCard = ({ children, className = "" }) => (
  <div className={`bg-[#1E1E1E] rounded-2xl border border-white/5 shadow-lg overflow-hidden ${className}`}>
    {children}
  </div>
);

const NavButton = ({ active, onClick, icon, label }) => (
  <button 
    onClick={onClick}
    className={`flex flex-col items-center justify-center flex-1 py-3 transition-all ${
      active ? 'text-white' : 'text-zinc-500'
    }`}
  >
    <div className={`mb-1 transition-transform ${active ? 'scale-110' : ''}`}>{icon}</div>
    <span className="text-[10px] font-bold tracking-tighter">{label}</span>
  </button>
);

/* --- MAIN APP --- */
export default function App() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('home');
  const [month, setMonth] = useState(getMonthString(new Date()));
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [transactions, setTransactions] = useState([]);
  const [monthlyData, setMonthlyData] = useState({ budget: 0, cardBill: 0, fixedCosts: [] });
  const [config, setConfig] = useState({ 
    categories: ['食費', '日用品', '交通費', '交際費', '趣味', 'その他'],
    paymentMethods: ['現金', 'カード1', 'カード2']
  });
  const [editingTx, setEditingTx] = useState(null);

  useEffect(() => {
    const start = new Date(`${month}-01T00:00:00`).toISOString();
    const d = new Date(`${month}-01`); d.setMonth(d.getMonth() + 1);
    const end = d.toISOString();

    const unsubTx = onSnapshot(query(collection(db, 'users', SHARED_USER_ID, 'transactions'), where('date', '>=', start), where('date', '<', end)), (s) => {
      setTransactions(s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => new Date(b.date) - new Date(a.date)));
      setLoading(false);
    });
    const unsubMonth = onSnapshot(doc(db, 'users', SHARED_USER_ID, 'months', month), (s) => {
      setMonthlyData(s.exists() ? s.data() : { budget: 0, cardBill: 0, fixedCosts: [] });
    });
    const unsubConfig = onSnapshot(doc(db, 'users', SHARED_USER_ID, 'settings', 'config'), (s) => {
      if (s.exists()) setConfig(s.data());
    });
    return () => { unsubTx(); unsubMonth(); unsubConfig(); };
  }, [month]);

  const summary = useMemo(() => {
    const fixed = (monthlyData.fixedCosts || []).reduce((s, i) => s + i.amount, 0);
    const disposable = (monthlyData.budget || 0) - fixed - (monthlyData.cardBill || 0);
    const spent = transactions.reduce((s, t) => s + t.amount, 0);
    const percent = disposable > 0 ? Math.min(Math.round((spent / disposable) * 100), 100) : 0;
    return { disposable, remaining: disposable - spent, spent, percent, budget: monthlyData.budget, out: fixed + (monthlyData.cardBill || 0) };
  }, [monthlyData, transactions]);

  const handleTxSubmit = async (e) => {
    e.preventDefault();
    const data = {
      title: e.target.title.value || e.target.category.value,
      amount: Number(e.target.amount.value),
      category: e.target.category.value,
      paymentMethod: e.target.method.value,
      date: e.target.date.value ? new Date(e.target.date.value).toISOString() : new Date().toISOString()
    };
    if (editingTx) {
      await updateDoc(doc(db, 'users', SHARED_USER_ID, 'transactions', editingTx.id), data);
      setEditingTx(null);
    } else {
      await setDoc(doc(collection(db, 'users', SHARED_USER_ID, 'transactions')), { ...data, createdAt: serverTimestamp() });
    }
    setIsModalOpen(false);
  };

  const openAddModal = () => {
    setEditingTx(null);
    setIsModalOpen(true);
  };

  const openEditModal = (tx) => {
    setEditingTx(tx);
    setIsModalOpen(true);
  };

  if (loading) return <div className="h-screen bg-[#121212] flex items-center justify-center text-zinc-600 text-xs font-bold tracking-[0.3em] animate-pulse">SYNCING...</div>;

  return (
    <div className="min-h-screen bg-[#121212] text-zinc-200 font-sans pb-24 relative overflow-x-hidden">
      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-[#121212]/90 backdrop-blur-xl border-b border-white/5 px-4 py-4">
        <div className="max-w-md mx-auto flex justify-between items-center">
          <h1 className="text-xl font-black tracking-tighter text-white">ZAIMU</h1>
          <div className="flex items-center gap-2">
            <button onClick={() => setMonth(getMonthString(new Date()))} className="px-3 py-1.5 bg-white/5 rounded-full border border-white/5 text-[10px] font-black text-zinc-400 hover:text-white transition-all uppercase tracking-widest">今月</button>
            <div className="flex items-center bg-white/5 rounded-full px-2 py-1 border border-white/5">
              <button onClick={() => { const d=new Date(`${month}-01`); d.setMonth(d.getMonth()-1); setMonth(getMonthString(d)); }} className="p-1"><ChevronLeft size={18}/></button>
              <span className="px-2 font-mono text-xs font-bold">{month.replace('-','/')}</span>
              <button onClick={() => { const d=new Date(`${month}-01`); d.setMonth(d.getMonth()+1); setMonth(getMonthString(d)); }} className="p-1"><ChevronRight size={18}/></button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto p-4 space-y-6">
        {activeTab === 'home' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <SimpleCard className="p-10 flex flex-col items-center">
              <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.3em] mb-4">今月使える残り</p>
              <h2 className={`text-5xl font-bold mb-8 tracking-tight ${summary.remaining < 0 ? 'text-red-400' : 'text-white'}`}>¥{summary.remaining.toLocaleString()}</h2>
              <div className="w-full space-y-3">
                <div className="flex justify-between text-[10px] font-bold text-zinc-500 tracking-widest uppercase">
                  <span>予算消化率</span>
                  <span>{summary.percent}%</span>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                  <div className={`h-full transition-all duration-1000 ${summary.percent > 90 ? 'bg-red-500' : 'bg-white'}`} style={{ width: `${summary.percent}%` }} />
                </div>
              </div>
            </SimpleCard>
            <div className="grid grid-cols-2 gap-4">
              <SimpleCard className="p-6 flex flex-col items-center text-center">
                <p className="text-[10px] text-zinc-500 mb-2 font-bold tracking-widest uppercase">軍資金</p>
                <p className="text-xl font-bold">¥{summary.budget.toLocaleString()}</p>
              </SimpleCard>
              <SimpleCard className="p-6 flex flex-col items-center text-center">
                <p className="text-[10px] text-zinc-500 mb-2 font-bold tracking-widest uppercase">固定費＋請求</p>
                <p className="text-xl font-bold text-zinc-400">¥{summary.out.toLocaleString()}</p>
              </SimpleCard>
            </div>
          </div>
        )}

        {activeTab === 'log' && (
          <div className="space-y-3 animate-in fade-in duration-500">
            <h2 className="text-center text-[10px] font-bold text-zinc-500 uppercase tracking-[0.3em] mb-4">取引履歴</h2>
            {transactions.map(t => (
              <div key={t.id} className="flex justify-between items-center bg-[#1E1E1E] p-4 rounded-2xl border border-white/5 group">
                <div className="flex items-center gap-4">
                  <div className="p-2.5 bg-white/5 rounded-xl text-zinc-500">
                    {t.paymentMethod === '現金' ? <Wallet size={18}/> : <CreditCard size={18}/>}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">{t.title}</div>
                    <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">{t.category} • {new Date(t.date).toLocaleDateString('ja-JP')}</div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-mono font-bold text-lg">¥{t.amount.toLocaleString()}</span>
                  <div className="flex gap-1">
                    <button onClick={() => openEditModal(t)} className="p-2 text-zinc-500 hover:text-white transition-colors"><Edit3 size={18}/></button>
                    <button onClick={() => deleteDoc(doc(db, 'users', SHARED_USER_ID, 'transactions', t.id))} className="p-2 text-zinc-700 hover:text-red-400 transition-colors"><Trash2 size={18}/></button>
                  </div>
                </div>
              </div>
            ))}
            {transactions.length === 0 && <div className="text-center py-20 text-zinc-700 font-bold text-xs uppercase tracking-widest">記録がありません</div>}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <h2 className="text-center text-[10px] font-bold text-zinc-500 uppercase tracking-[0.3em] mb-4">設定</h2>
            <SimpleCard className="p-8 flex flex-col items-center space-y-8">
              <div className="w-full space-y-6">
                <div className="text-center">
                  <label className="text-[10px] text-zinc-500 mb-2 block font-bold uppercase tracking-widest">今月の軍資金</label>
                  <input type="number" value={monthlyData.budget} onChange={e => setDoc(doc(db, 'users', SHARED_USER_ID, 'months', month), { budget: Number(e.target.value) }, { merge: true })} className="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-white font-mono text-center text-xl outline-none focus:border-white/20" />
                </div>
                <div className="text-center">
                  <label className="text-[10px] text-zinc-500 mb-2 block font-bold uppercase tracking-widest">前月のカード請求額</label>
                  <input type="number" value={monthlyData.cardBill} onChange={e => setDoc(doc(db, 'users', SHARED_USER_ID, 'months', month), { cardBill: Number(e.target.value) }, { merge: true })} className="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-white font-mono text-center text-xl outline-none focus:border-white/20" />
                </div>
              </div>
            </SimpleCard>
            <SimpleCard className="p-8">
              <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-center mb-6">固定費（家賃・保険等）</h3>
              <div className="space-y-3">
                {(monthlyData.fixedCosts || []).map(f => (
                  <div key={f.id} className="flex justify-between items-center bg-white/5 p-4 rounded-xl border border-white/5">
                    <span className="text-sm font-bold text-zinc-300">{f.name}</span>
                    <div className="flex items-center gap-4">
                      <span className="font-mono text-sm text-white">¥{f.amount.toLocaleString()}</span>
                      <button onClick={() => setDoc(doc(db, 'users', SHARED_USER_ID, 'months', month), { fixedCosts: monthlyData.fixedCosts.filter(x => x.id !== f.id) }, { merge: true })}><Trash2 size={16} className="text-zinc-700"/></button>
                    </div>
                  </div>
                ))}
                <div className="space-y-3 pt-6">
                  <div className="flex gap-2">
                    <input id="fx-n" placeholder="費目" className="flex-1 bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none" />
                    <input id="fx-a" type="number" placeholder="金額" className="w-28 bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none text-center" />
                  </div>
                  <button onClick={() => {
                    const n = document.getElementById('fx-n'), a = document.getElementById('fx-a');
                    if(!n.value || !a.value) return;
                    setDoc(doc(db, 'users', SHARED_USER_ID, 'months', month), { fixedCosts: [...(monthlyData.fixedCosts || []), {id:Date.now(), name:n.value, amount:Number(a.value)}] }, { merge: true });
                    n.value=''; a.value='';
                  }} className="w-full bg-zinc-200 text-black py-4 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg active:scale-95 transition-all">固定費を追加</button>
                </div>
              </div>
            </SimpleCard>
          </div>
        )}
      </main>

      {/* FLOATING ACTION BUTTON (右下プラスボタン) */}
      {activeTab !== 'settings' && (
        <button 
          onClick={openAddModal}
          className="fixed bottom-28 right-6 w-16 h-16 bg-white text-black rounded-full flex items-center justify-center shadow-2xl active:scale-90 transition-transform z-40 border-4 border-[#121212]"
        >
          <Plus size={32} />
        </button>
      )}

      {/* TRANSACTION MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <SimpleCard className="relative w-full max-w-md p-8 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-10">
              <div className="w-8" />
              <h2 className="text-xs font-black uppercase tracking-[0.3em] text-white">
                {editingTx ? '支出を編集' : '支出を登録'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-zinc-500 hover:text-white transition-colors"><X size={24}/></button>
            </div>
            
            <form onSubmit={handleTxSubmit} className="space-y-6 flex flex-col items-center w-full">
              <div className="w-full space-y-2 text-center">
                <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">金額</label>
                <input name="amount" type="number" defaultValue={editingTx?.amount || ''} className="w-full bg-black/20 border border-white/10 rounded-2xl py-5 px-4 text-4xl font-bold text-white text-center outline-none focus:border-white/20 transition-all" placeholder="0" autoFocus required />
              </div>

              <div className="w-full space-y-2">
                <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest block text-center">タイトル (空欄ならカテゴリ名)</label>
                <input name="title" type="text" defaultValue={editingTx?.title || ''} className="w-full bg-black/20 border border-white/10 rounded-xl py-3 px-4 text-sm text-white text-center outline-none focus:border-white/20" placeholder="ランチ、買い物など" />
              </div>

              <div className="w-full grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest block text-center">日付</label>
                  <input name="date" type="date" defaultValue={editingTx ? editingTx.date.split('T')[0] : getTodayString()} className="w-full bg-black/20 border border-white/10 rounded-xl py-3 px-2 text-xs text-white text-center outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest block text-center">カテゴリ</label>
                  <select name="category" defaultValue={editingTx?.category || config.categories[0]} className="w-full bg-black/20 border border-white/10 rounded-xl py-3 px-2 text-xs text-white text-center outline-none appearance-none">
                    {config.categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div className="w-full space-y-4">
                <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest block text-center">支払方法</label>
                <div className="grid grid-cols-3 gap-2 w-full">
                  {config.paymentMethods.map(m => (
                    <label key={m} className="cursor-pointer">
                      <input type="radio" name="method" value={m} className="peer hidden" defaultChecked={editingTx?.paymentMethod === m || (!editingTx && m === config.paymentMethods[0])} required />
                      <div className="py-3 text-center rounded-xl border border-zinc-800 text-[11px] font-bold text-zinc-500 peer-checked:bg-zinc-200 peer-checked:text-black transition-all">{m}</div>
                    </label>
                  ))}
                </div>
              </div>

              <button type="submit" className="w-full bg-white text-black font-black rounded-2xl py-4 text-sm shadow-xl uppercase tracking-[0.2em] active:scale-95 transition-all mt-4">
                {editingTx ? '変更を保存' : '登録する'}
              </button>
            </form>
          </SimpleCard>
        </div>
      )}

      {/* FOOTER NAV */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#121212]/95 border-t border-white/5 flex justify-around p-3 z-40 pb-safe shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
        <div className="max-w-md mx-auto w-full flex justify-around items-center px-4">
          <NavButton active={activeTab === 'home'} onClick={() => setActiveTab('home')} icon={<Landmark size={22}/>} label="ホーム" />
          <NavButton active={activeTab === 'log'} onClick={() => setActiveTab('log')} icon={<History size={22}/>} label="履歴" />
          <NavButton active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={<Settings size={22}/>} label="設定" />
        </div>
      </nav>
    </div>
  );
}
