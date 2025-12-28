import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, onSnapshot, query, deleteDoc, serverTimestamp, where, updateDoc } from 'firebase/firestore';
import { Wallet, CreditCard, Landmark, Plus, Settings, Trash2, History, Sparkles, ChevronLeft, ChevronRight, Edit3, X, CalendarDays } from 'lucide-react';

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
const auth = getAuth(app);
const db = getFirestore(app);

// 【同期の鍵】全デバイスでこのIDを共通で使用します
const SHARED_USER_ID = "my-private-zaimu-v1";

const getMonthString = (date) => date.toISOString().slice(0, 7);

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
  
  const [transactions, setTransactions] = useState([]);
  const [monthlyData, setMonthlyData] = useState({ budget: 0, cardBill: 0, fixedCosts: [] });
  const [config, setConfig] = useState({ 
    categories: ['食費', '日用品', '交通費', '交際費', '趣味', 'その他'],
    paymentMethods: ['現金', 'カード1', 'カード2']
  });
  const [editingTx, setEditingTx] = useState(null);

  useEffect(() => {
    // 固定IDを使用するため、ログイン状態に関わらずデータを取得開始
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
      amount: Number(e.target.amount.value),
      category: e.target.category.value,
      paymentMethod: e.target.method.value,
      date: editingTx ? editingTx.date : new Date().toISOString()
    };
    if (editingTx) {
      await updateDoc(doc(db, 'users', SHARED_USER_ID, 'transactions', editingTx.id), data);
      setEditingTx(null);
    } else {
      await setDoc(doc(collection(db, 'users', SHARED_USER_ID, 'transactions')), { ...data, createdAt: serverTimestamp() });
    }
    setActiveTab('home');
  };

  if (loading) return <div className="h-screen bg-[#121212] flex items-center justify-center text-zinc-600 text-xs font-bold tracking-[0.3em] animate-pulse">SYNCING DATA...</div>;

  return (
    <div className="min-h-screen bg-[#121212] text-zinc-200 font-sans pb-28">
      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-[#121212]/90 backdrop-blur-xl border-b border-white/5 px-4 py-4">
        <div className="max-w-md mx-auto flex justify-between items-center">
          <h1 className="text-xl font-black tracking-tighter text-white">ZAIMU</h1>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setMonth(getMonthString(new Date()))}
              className="px-3 py-1.5 bg-white/5 rounded-full border border-white/5 text-[10px] font-black text-zinc-400 hover:text-white transition-all tracking-widest"
            >
              今月
            </button>
            <div className="flex items-center bg-white/5 rounded-full px-2 py-1 border border-white/5">
              <button onClick={() => { const d=new Date(`${month}-01`); d.setMonth(d.getMonth()-1); setMonth(getMonthString(d)); }} className="p-1"><ChevronLeft size={18}/></button>
              <span className="px-2 font-mono text-xs font-bold">{month.replace('-','/')}</span>
              <button onClick={() => { const d=new Date(`${month}-01`); d.setMonth(d.getMonth()+1); setMonth(getMonthString(d)); }} className="p-1"><ChevronRight size={18}/></button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto p-4 space-y-6">
        
        {/* HOME TAB */}
        {activeTab === 'home' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <SimpleCard className="p-8 flex flex-col items-center">
              <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.3em] mb-3">今月使える残り</p>
              <h2 className={`text-5xl font-bold mb-6 tracking-tight ${summary.remaining < 0 ? 'text-red-400' : 'text-white'}`}>¥{summary.remaining.toLocaleString()}</h2>
              
              <div className="w-full space-y-2">
                <div className="flex justify-between text-[10px] font-bold text-zinc-500 tracking-widest uppercase">
                  <span>消化率</span>
                  <span>{summary.percent}%</span>
                </div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div className={`h-full transition-all duration-1000 ${summary.percent > 90 ? 'bg-red-500' : 'bg-white'}`} style={{ width: `${summary.percent}%` }} />
                </div>
              </div>
            </SimpleCard>

            <div className="grid grid-cols-2 gap-4">
              <SimpleCard className="p-5 flex flex-col items-center">
                <p className="text-[10px] text-zinc-500 mb-1 font-bold tracking-widest uppercase">軍資金</p>
                <p className="text-lg font-bold">¥{summary.budget.toLocaleString()}</p>
              </SimpleCard>
              <SimpleCard className="p-5 flex flex-col items-center">
                <p className="text-[10px] text-zinc-500 mb-1 font-bold tracking-widest uppercase">固定費＋請求</p>
                <p className="text-lg font-bold text-zinc-400">¥{summary.out.toLocaleString()}</p>
              </SimpleCard>
            </div>

            <div className="pt-4 space-y-3">
              <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.3em] text-center">直近の履歴</h3>
              {transactions.slice(0, 3).map(t => (
                <div key={t.id} className="flex justify-between items-center bg-[#1E1E1E] p-4 rounded-2xl border border-white/5">
                   <div className="flex items-center gap-3">
                     <div className="w-1 h-8 rounded-full bg-white/20" />
                     <div>
                       <div className="text-sm font-bold">{t.category}</div>
                       <div className="text-[10px] text-zinc-500 uppercase tracking-widest">{t.paymentMethod}</div>
                     </div>
                   </div>
                   <div className="font-mono font-bold text-white text-lg">¥{t.amount.toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* LOG (HISTORY) TAB */}
        {activeTab === 'log' && (
          <div className="space-y-3 animate-in fade-in duration-500">
            <h2 className="text-center text-[10px] font-bold text-zinc-500 uppercase tracking-[0.3em] mb-4">取引履歴</h2>
            {transactions.map(t => (
              <div key={t.id} className="flex justify-between items-center bg-[#1E1E1E] p-4 rounded-2xl border border-white/5 group">
                <div className="flex items-center gap-4">
                  <div className="p-2.5 bg-white/5 rounded-xl text-zinc-500 group-hover:text-white transition-colors">
                    {t.paymentMethod === '現金' ? <Wallet size={18}/> : <CreditCard size={18}/>}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">{t.category}</div>
                    <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">{t.paymentMethod} • {new Date(t.date).toLocaleDateString('ja-JP')}</div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-mono font-bold text-lg">¥{t.amount.toLocaleString()}</span>
                  <div className="flex gap-2">
                    <button onClick={() => { setEditingTx(t); setActiveTab('add'); }} className="p-2 text-zinc-500 hover:text-white transition-colors"><Edit3 size={18}/></button>
                    <button onClick={() => deleteDoc(doc(db, 'users', SHARED_USER_ID, 'transactions', t.id))} className="p-2 text-zinc-700 hover:text-red-400 transition-colors"><Trash2 size={18}/></button>
                  </div>
                </div>
              </div>
            ))}
            {transactions.length === 0 && <div className="text-center py-20 text-zinc-700 font-bold text-xs uppercase tracking-widest">記録がありません</div>}
          </div>
        )}

        {/* ADD / EDIT TAB (MODAL STYLE) */}
        {activeTab === 'add' && (
          <div className="animate-in slide-in-from-bottom-8 duration-500">
            <SimpleCard className="p-8">
              <div className="flex justify-center items-center mb-10 relative">
                <h2 className="text-xs font-black uppercase tracking-[0.3em] text-white">
                  {editingTx ? '編集モード' : '新規入力'}
                </h2>
                {editingTx && <button onClick={() => { setEditingTx(null); setActiveTab('log'); }} className="absolute right-0 text-zinc-500"><X size={20}/></button>}
              </div>
              <form onSubmit={handleTxSubmit} className="space-y-8 flex flex-col items-center w-full">
                <div className="w-full space-y-2 text-center">
                  <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">金額</label>
                  <input name="amount" type="number" defaultValue={editingTx?.amount || ''} className="w-full bg-black/20 border border-white/10 rounded-2xl py-5 px-4 text-4xl font-bold text-white text-center outline-none focus:border-white/20 transition-all" placeholder="0" autoFocus required />
                </div>
                
                <div className="w-full space-y-4">
                  <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest block text-center">カテゴリ</label>
                  <div className="grid grid-cols-3 gap-2 w-full">
                    {config.categories.map(c => (
                      <label key={c} className="cursor-pointer">
                        <input type="radio" name="category" value={c} className="peer hidden" defaultChecked={editingTx?.category === c} required />
                        <div className="py-3 text-center rounded-xl border border-zinc-800 text-[11px] font-bold text-zinc-500 peer-checked:bg-white peer-checked:text-black transition-all">{c}</div>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="w-full space-y-4">
                  <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest block text-center">支払方法</label>
                  <div className="grid grid-cols-3 gap-2 w-full">
                    {config.paymentMethods.map(m => (
                      <label key={m} className="cursor-pointer">
                        <input type="radio" name="method" value={m} className="peer hidden" defaultChecked={editingTx?.paymentMethod === m} required />
                        <div className="py-3 text-center rounded-xl border border-zinc-800 text-[11px] font-bold text-zinc-500 peer-checked:bg-zinc-700 peer-checked:text-white transition-all">{m}</div>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex gap-4 pt-6 w-full">
                  <button type="button" onClick={() => { setEditingTx(null); setActiveTab('home'); }} className="flex-1 py-4 text-xs text-zinc-500 font-bold uppercase tracking-widest">戻る</button>
                  <button type="submit" className="flex-2 bg-zinc-200 text-black font-black rounded-2xl py-4 px-10 text-xs shadow-lg uppercase tracking-widest">保存する</button>
                </div>
              </form>
            </SimpleCard>
          </div>
        )}

        {/* SETTINGS TAB */}
        {activeTab === 'settings' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <h2 className="text-center text-[10px] font-bold text-zinc-500 uppercase tracking-[0.3em] mb-4">設定と管理</h2>
            
            <SimpleCard className="p-6 flex flex-col items-center space-y-6">
              <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">基本予算設定</h3>
              <div className="w-full space-y-5">
                <div className="text-center">
                  <label className="text-[10px] text-zinc-500 mb-2 block font-bold uppercase tracking-widest">今月の軍資金</label>
                  <input type="number" value={monthlyData.budget} onChange={e => setDoc(doc(db, 'users', SHARED_USER_ID, 'months', month), { budget: Number(e.target.value) }, { merge: true })} className="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-white font-mono text-center outline-none focus:border-white/20" />
                </div>
                <div className="text-center">
                  <label className="text-[10px] text-zinc-500 mb-2 block font-bold uppercase tracking-widest">前月のカード請求額</label>
                  <input type="number" value={monthlyData.cardBill} onChange={e => setDoc(doc(db, 'users', SHARED_USER_ID, 'months', month), { cardBill: Number(e.target.value) }, { merge: true })} className="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-white font-mono text-center outline-none focus:border-white/20" />
                </div>
              </div>
            </SimpleCard>

            <SimpleCard className="p-6">
              <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-center mb-6">固定費（家賃・保険等）</h3>
              <div className="space-y-2">
                {(monthlyData.fixedCosts || []).map(f => (
                  <div key={f.id} className="flex justify-between items-center bg-white/5 p-4 rounded-xl border border-white/5">
                    <span className="text-sm font-bold text-zinc-300">{f.name}</span>
                    <div className="flex items-center gap-4">
                      <span className="font-mono text-sm text-white">¥{f.amount.toLocaleString()}</span>
                      <button onClick={() => setDoc(doc(db, 'users', SHARED_USER_ID, 'months', month), { fixedCosts: monthlyData.fixedCosts.filter(x => x.id !== f.id) }, { merge: true })}><Trash2 size={16} className="text-zinc-700"/></button>
                    </div>
                  </div>
                ))}
                <div className="flex gap-2 pt-6">
                  <input id="fx-n" placeholder="費目" className="flex-2 bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-xs outline-none" />
                  <input id="fx-a" type="number" placeholder="金額" className="flex-1 bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-xs outline-none text-center" />
                  <button onClick={() => {
                    const n = document.getElementById('fx-n'), a = document.getElementById('fx-a');
                    if(!n.value || !a.value) return;
                    setDoc(doc(db, 'users', SHARED_USER_ID, 'months', month), { fixedCosts: [...(monthlyData.fixedCosts || []), {id:Date.now(), name:n.value, amount:Number(a.value)}] }, { merge: true });
                    n.value=''; a.value='';
                  }} className="bg-zinc-200 text-black px-5 rounded-xl font-bold text-xs uppercase">追加</button>
                </div>
              </div>
            </SimpleCard>
          </div>
        )}
      </main>

      {/* FOOTER NAV */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#121212]/95 border-t border-white/5 flex justify-around p-3 z-50 pb-safe shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
        <div className="max-w-md mx-auto w-full flex justify-around items-center">
          <NavButton active={activeTab === 'home'} onClick={() => setActiveTab('home')} icon={<Landmark size={22}/>} label="ホーム" />
          <NavButton active={activeTab === 'log'} onClick={() => setActiveTab('log')} icon={<History size={22}/>} label="履歴" />
          <div className="relative -top-6 px-4">
            <button onClick={() => { setEditingTx(null); setActiveTab('add'); }} className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-black shadow-2xl border-4 border-[#121212] active:scale-90 transition-transform"><Plus size={32}/></button>
          </div>
          <NavButton active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={<Settings size={22}/>} label="設定" />
          <div className="flex-1"></div> {/* 空きスペースの調整 */}
        </div>
      </nav>
    </div>
  );
}
