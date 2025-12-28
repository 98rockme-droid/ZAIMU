import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, onSnapshot, query, deleteDoc, serverTimestamp, where, updateDoc } from 'firebase/firestore';
import { Wallet, CreditCard, Landmark, Plus, Settings, Trash2, History, Sparkles, ChevronLeft, ChevronRight, Filter, Edit3, X } from 'lucide-react';

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

/* --- AI アシスタント --- */
const callGemini = async (prompt) => {
  const apiKey = ""; 
  const model = "gemini-2.0-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      }),
    });
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    return text ? JSON.parse(text) : { message: "計画的で素晴らしいです。" };
  } catch (error) {
    return { message: "解析をスキップしました。" };
  }
};

const getMonthString = (date) => date.toISOString().slice(0, 7);

/* --- UI COMPONENTS --- */
const SimpleCard = ({ children, className = "" }) => (
  <div className={`bg-[#1E1E1E] rounded-xl border border-white/5 shadow-sm ${className}`}>
    {children}
  </div>
);

const NavButton = ({ active, onClick, icon, label }) => (
  <button 
    onClick={onClick}
    className={`flex flex-col items-center justify-center flex-1 py-2 transition-all ${
      active ? 'text-white' : 'text-zinc-500'
    }`}
  >
    <div className="mb-1">{icon}</div>
    <span className="text-[10px] font-bold">{label}</span>
  </button>
);

/* --- MAIN APP --- */
export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('home');
  const [month, setMonth] = useState(getMonthString(new Date()));
  
  const [transactions, setTransactions] = useState([]);
  const [monthlyData, setMonthlyData] = useState({ budget: 0, cardBill: 0, fixedCosts: [] });
  const [config, setConfig] = useState({ 
    categories: ['食費', '日用品', '交通費', '交際費', '趣味', 'その他'],
    paymentMethods: ['現金', 'メインカード', 'サブカード']
  });
  
  const [aiAdvice, setAiAdvice] = useState(null);
  const [adviceLoading, setAdviceLoading] = useState(false);
  const [filter, setFilter] = useState({ category: 'ALL', method: 'ALL' });
  const [editingTx, setEditingTx] = useState(null);

  useEffect(() => {
    signInAnonymously(auth);
    return onAuthStateChanged(auth, (u) => { setUser(u); setLoading(false); });
  }, []);

  useEffect(() => {
    if (!user) return;
    const start = new Date(`${month}-01T00:00:00`).toISOString();
    const d = new Date(`${month}-01`); d.setMonth(d.getMonth() + 1);
    const end = d.toISOString();

    const unsubTx = onSnapshot(query(collection(db, 'users', user.uid, 'transactions'), where('date', '>=', start), where('date', '<', end)), (s) => {
      setTransactions(s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => new Date(b.date) - new Date(a.date)));
    });
    const unsubMonth = onSnapshot(doc(db, 'users', user.uid, 'months', month), (s) => {
      setMonthlyData(s.exists() ? s.data() : { budget: 0, cardBill: 0, fixedCosts: [] });
    });
    const unsubConfig = onSnapshot(doc(db, 'users', user.uid, 'settings', 'config'), (s) => {
      if (s.exists()) setConfig(s.data());
    });
    return () => { unsubTx(); unsubMonth(); unsubConfig(); };
  }, [user, month]);

  const summary = useMemo(() => {
    const fixed = (monthlyData.fixedCosts || []).reduce((s, i) => s + i.amount, 0);
    const disposable = (monthlyData.budget || 0) - fixed - (monthlyData.cardBill || 0);
    const spent = transactions.reduce((s, t) => s + t.amount, 0);
    const percent = disposable > 0 ? Math.min(Math.round((spent / disposable) * 100), 100) : 0;
    return { disposable, remaining: disposable - spent, spent, percent, budget: monthlyData.budget, out: fixed + (monthlyData.cardBill || 0) };
  }, [monthlyData, transactions]);

  const filteredTx = useMemo(() => {
    return transactions.filter(t => {
      const catMatch = filter.category === 'ALL' || t.category === filter.category;
      const methodMatch = filter.method === 'ALL' || t.paymentMethod === filter.method;
      return catMatch && methodMatch;
    });
  }, [transactions, filter]);

  const handleTxSubmit = async (e) => {
    e.preventDefault();
    const data = {
      amount: Number(e.target.amount.value),
      category: e.target.category.value,
      paymentMethod: e.target.method.value,
      date: editingTx ? editingTx.date : new Date().toISOString()
    };

    if (editingTx) {
      await updateDoc(doc(db, 'users', user.uid, 'transactions', editingTx.id), data);
      setEditingTx(null);
    } else {
      const ref = doc(collection(db, 'users', user.uid, 'transactions'));
      await setDoc(ref, { ...data, createdAt: serverTimestamp() });
    }
    setActiveTab('home');
  };

  if (loading) return <div className="h-screen bg-[#121212] flex items-center justify-center text-zinc-600 text-xs tracking-widest">LOADING...</div>;

  return (
    <div className="min-h-screen bg-[#121212] text-zinc-200 font-sans pb-24">
      {/* HEADER */}
      <header className="sticky top-0 z-30 bg-[#121212]/95 backdrop-blur-md border-b border-white/5 p-4 flex justify-between items-center">
        <h1 className="text-lg font-black tracking-tighter text-white">ZAIMU</h1>
        <div className="flex items-center bg-white/5 rounded-full px-3 py-1 border border-white/5">
          <button onClick={() => { const d=new Date(`${month}-01`); d.setMonth(d.getMonth()-1); setMonth(getMonthString(d)); }}><ChevronLeft size={18}/></button>
          <span className="px-3 font-mono text-xs font-bold">{month.replace('-','/')}</span>
          <button onClick={() => { const d=new Date(`${month}-01`); d.setMonth(d.getMonth()+1); setMonth(getMonthString(d)); }}><ChevronRight size={18}/></button>
        </div>
      </header>

      <main className="max-w-md mx-auto p-4 space-y-5">
        
        {/* HOME TAB */}
        {activeTab === 'home' && (
          <div className="space-y-5 animate-in fade-in">
            <SimpleCard className="p-6">
              <p className="text-zinc-500 text-[10px] font-bold uppercase mb-2 tracking-widest text-center">今月使える残り</p>
              <h2 className={`text-4xl font-bold text-center mb-6 ${summary.remaining < 0 ? 'text-red-400' : 'text-white'}`}>¥{summary.remaining.toLocaleString()}</h2>
              
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-bold text-zinc-500 uppercase">
                  <span>予算消化率</span>
                  <span>{summary.percent}%</span>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-1000 ${summary.percent > 90 ? 'bg-red-500' : 'bg-zinc-200'}`} 
                    style={{ width: `${summary.percent}%` }}
                  />
                </div>
              </div>
            </SimpleCard>

            <div className="grid grid-cols-2 gap-3">
              <SimpleCard className="p-4">
                <p className="text-[10px] text-zinc-500 mb-1 font-bold">軍資金</p>
                <p className="text-lg font-bold">¥{summary.budget.toLocaleString()}</p>
              </SimpleCard>
              <SimpleCard className="p-4">
                <p className="text-[10px] text-zinc-500 mb-1 font-bold">固定費＋請求</p>
                <p className="text-lg font-bold text-zinc-400">¥{summary.out.toLocaleString()}</p>
              </SimpleCard>
            </div>

            <button 
              onClick={async () => {
                setAdviceLoading(true);
                const res = await callGemini(`予算${summary.disposable}円中、既に${summary.spent}円使用。残金${summary.remaining}円。執事として日本語で一言アドバイスを。{"message": "文"}`);
                setAiAdvice(res.message); setAdviceLoading(false);
              }}
              className="w-full text-[10px] text-zinc-500 font-bold uppercase tracking-widest py-2 flex items-center justify-center gap-2"
            >
              <Sparkles size={14}/> {adviceLoading ? '解析中...' : 'AIアドバイス'}
            </button>
            {aiAdvice && <p className="text-sm text-center italic text-zinc-300 px-6 animate-in slide-in-from-top-2">"{aiAdvice}"</p>}
          </div>
        )}

        {/* LOG (HISTORY) TAB */}
        {activeTab === 'log' && (
          <div className="space-y-4 animate-in fade-in">
            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
              <select 
                onChange={(e) => setFilter({...filter, category: e.target.value})}
                className="bg-[#1E1E1E] border border-white/10 text-[10px] font-bold rounded-full px-3 py-1.5 outline-none text-zinc-400"
              >
                <option value="ALL">全てのカテゴリ</option>
                {config.categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select 
                onChange={(e) => setFilter({...filter, method: e.target.value})}
                className="bg-[#1E1E1E] border border-white/10 text-[10px] font-bold rounded-full px-3 py-1.5 outline-none text-zinc-400"
              >
                <option value="ALL">全ての支払方法</option>
                {config.paymentMethods.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              {filteredTx.map(t => (
                <div key={t.id} className="flex justify-between items-center bg-[#1E1E1E] p-4 rounded-xl border border-white/5 group">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/5 rounded-lg text-zinc-400">
                      {t.paymentMethod === '現金' ? <Wallet size={16}/> : <CreditCard size={16}/>}
                    </div>
                    <div>
                      <div className="text-sm font-bold">{t.category}</div>
                      <div className="text-[10px] text-zinc-500 uppercase tracking-tighter">{t.paymentMethod} • {new Date(t.date).toLocaleDateString('ja-JP')}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-mono font-bold">¥{t.amount.toLocaleString()}</span>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditingTx(t); setActiveTab('add'); }} className="text-zinc-500 hover:text-white"><Edit3 size={16}/></button>
                      <button onClick={() => deleteDoc(doc(db, 'users', user.uid, 'transactions', t.id))} className="text-zinc-700 hover:text-red-400"><Trash2 size={16}/></button>
                    </div>
                  </div>
                </div>
              ))}
              {filteredTx.length === 0 && <p className="text-center text-zinc-600 py-20 text-xs font-bold uppercase tracking-widest">記録なし</p>}
            </div>
          </div>
        )}

        {/* ADD / EDIT TAB */}
        {activeTab === 'add' && (
          <SimpleCard className="p-6 animate-in slide-in-from-bottom-4">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-sm font-black flex items-center gap-2 text-white uppercase tracking-widest">
                {editingTx ? <Edit3 size={18}/> : <Plus size={18}/>} 
                {editingTx ? '支出を編集' : '支出を記録'}
              </h2>
              {editingTx && <button onClick={() => { setEditingTx(null); setActiveTab('log'); }}><X size={20}/></button>}
            </div>
            <form onSubmit={handleTxSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest ml-1">金額</label>
                <input name="amount" type="number" defaultValue={editingTx?.amount || ''} className="w-full bg-black/20 border border-white/10 rounded-xl py-4 px-4 text-3xl font-bold text-white outline-none focus:border-white/20" placeholder="0" autoFocus required />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest ml-1">カテゴリ</label>
                <div className="grid grid-cols-3 gap-2">
                  {config.categories.map(c => (
                    <label key={c} className="cursor-pointer">
                      <input type="radio" name="category" value={c} className="peer hidden" defaultChecked={editingTx?.category === c} required />
                      <div className="py-2.5 text-center rounded-lg border border-zinc-800 text-[11px] font-bold text-zinc-500 peer-checked:bg-zinc-200 peer-checked:text-black peer-checked:border-white transition-all">{c}</div>
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest ml-1">支払方法</label>
                <div className="grid grid-cols-2 gap-2">
                  {config.paymentMethods.map(m => (
                    <label key={m} className="cursor-pointer">
                      <input type="radio" name="method" value={m} className="peer hidden" defaultChecked={editingTx?.paymentMethod === m} required />
                      <div className="py-2.5 text-center rounded-lg border border-zinc-800 text-[11px] font-bold text-zinc-500 peer-checked:bg-zinc-700 peer-checked:text-white transition-all">{m}</div>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => { setEditingTx(null); setActiveTab('home'); }} className="flex-1 py-3 text-xs text-zinc-500 font-bold uppercase">キャンセル</button>
                <button type="submit" className="flex-2 bg-zinc-200 text-black font-black rounded-xl py-4 px-8 text-xs shadow-lg uppercase tracking-widest">保存する</button>
              </div>
            </form>
          </SimpleCard>
        )}

        {/* SETTINGS TAB */}
        {activeTab === 'settings' && (
          <div className="space-y-4 animate-in fade-in">
            <SimpleCard className="p-6 space-y-6">
              <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.3em]">資金計画</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] text-zinc-500 mb-2 block uppercase font-bold">今月の軍資金（自由設定）</label>
                  <input type="number" value={monthlyData.budget} onChange={e => setDoc(doc(db, 'users', user.uid, 'months', month), { budget: Number(e.target.value) }, { merge: true })} className="w-full bg-black/20 border border-white/10 rounded-lg p-4 text-white font-mono text-sm outline-none" placeholder="¥0" />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-500 mb-2 block uppercase font-bold">前月のカード請求額</label>
                  <input type="number" value={monthlyData.cardBill} onChange={e => setDoc(doc(db, 'users', user.uid, 'months', month), { cardBill: Number(e.target.value) }, { merge: true })} className="w-full bg-black/20 border border-white/10 rounded-lg p-4 text-white font-mono text-sm outline-none" placeholder="¥0" />
                </div>
              </div>
            </SimpleCard>

            <SimpleCard className="p-6">
              <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.3em] mb-4">固定費（家賃・保険等）</h3>
              <div className="space-y-2">
                {(monthlyData.fixedCosts || []).map(f => (
                  <div key={f.id} className="flex justify-between items-center bg-white/5 p-3 rounded-lg border border-white/5">
                    <span className="text-sm font-bold">{f.name}</span>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm">¥{f.amount.toLocaleString()}</span>
                      <button onClick={() => setDoc(doc(db, 'users', user.uid, 'months', month), { fixedCosts: monthlyData.fixedCosts.filter(x => x.id !== f.id) }, { merge: true })}><Trash2 size={14} className="text-zinc-700"/></button>
                    </div>
                  </div>
                ))}
                <div className="flex gap-2 pt-4">
                  <input id="fx-n" placeholder="費目" className="flex-1 bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-xs outline-none" />
                  <input id="fx-a" type="number" placeholder="金額" className="w-20 bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-xs outline-none" />
                  <button onClick={() => {
                    const n = document.getElementById('fx-n'), a = document.getElementById('fx-a');
                    if(!n.value || !a.value) return;
                    setDoc(doc(db, 'users', user.uid, 'months', month), { fixedCosts: [...(monthlyData.fixedCosts || []), {id:Date.now(), name:n.value, amount:Number(a.value)}] }, { merge: true });
                    n.value=''; a.value='';
                  }} className="bg-white text-black px-3 rounded-lg font-bold text-xs">追加</button>
                </div>
              </div>
            </SimpleCard>
            
            {/* カテゴリ/支払方法の管理もここに含める場合は前回のListManagerを流用可能 */}
          </div>
        )}
      </main>

      {/* FOOTER NAV */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#121212]/95 border-t border-white/5 flex justify-around p-2 z-40 pb-safe">
        <NavButton active={activeTab === 'home'} onClick={() => setActiveTab('home')} icon={<Landmark size={20}/>} label="ホーム" />
        <NavButton active={activeTab === 'log'} onClick={() => setActiveTab('log')} icon={<History size={20}/>} label="履歴" />
        <div className="relative -top-5">
          <button onClick={() => { setEditingTx(null); setActiveTab('add'); }} className="w-14 h-14 bg-zinc-200 rounded-full flex items-center justify-center text-black shadow-2xl border-4 border-[#121212] active:scale-95 transition-transform"><Plus size={28}/></button>
        </div>
        <NavButton active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={<Settings size={20}/>} label="設定" />
        <div className="flex-1"></div> {/* バランス用空要素 */}
      </nav>
    </div>
  );
}
