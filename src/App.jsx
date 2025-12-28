import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore,
  collection, 
  doc, 
  setDoc, 
  onSnapshot, 
  query, 
  deleteDoc,
  serverTimestamp,
  where
} from 'firebase/firestore';
import { 
  Wallet, 
  CreditCard, 
  Landmark, 
  Plus, 
  Settings, 
  Trash2, 
  History,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Droplets,
  Tags,
  Check
} from 'lucide-react';

/* --- FIREBASE SETUP --- */
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

const callGemini = async (prompt, systemInstruction = "") => {
  const apiKey = ""; 
  const model = "gemini-2.0-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
    generationConfig: { responseMimeType: "application/json" }
  };
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    return text ? JSON.parse(text) : { message: "少し休憩しましょう。" };
  } catch (error) {
    return { message: "解析に失敗しました。" };
  }
};

const getMonthString = (date) => date.toISOString().slice(0, 7);

/* --- UI COMPONENTS --- */
const GlassCard = ({ children, className = "", highlight = false }) => (
  <div className={`relative overflow-hidden rounded-2xl border backdrop-blur-xl transition-all duration-300 ${
    highlight 
      ? 'bg-white/10 border-white/20 shadow-[0_0_30px_rgba(255,255,255,0.1)]' 
      : 'bg-black/40 border-white/10 shadow-lg'
  } ${className}`}>
    <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent pointer-events-none" />
    <div className="relative z-10">{children}</div>
  </div>
);

const NavButton = ({ active, onClick, icon, label, mobile = false }) => (
  <button 
    onClick={onClick}
    className={`group flex flex-col items-center justify-center transition-all duration-300 ${
      mobile ? 'w-16' : 'w-full py-4'
    } ${active ? 'text-white scale-110 drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]' : 'text-zinc-600 hover:text-zinc-300'}`}
  >
    <div className={`mb-1 transition-transform ${active ? '-translate-y-1' : ''}`}>{icon}</div>
    <span className="text-[10px] font-bold tracking-widest opacity-80 uppercase">{label}</span>
  </button>
);

const MonthSelector = ({ currentMonth, onChange }) => (
  <div className="flex items-center bg-black/40 border border-white/10 rounded-full px-2 py-1 backdrop-blur-md">
    <button onClick={() => onChange(-1)} className="p-2 text-zinc-400 hover:text-white transition-colors">
      <ChevronLeft size={16} />
    </button>
    <span className="mx-3 font-mono text-sm text-white font-bold tracking-widest">{currentMonth.replace('-', '/')}</span>
    <button onClick={() => onChange(1)} className="p-2 text-zinc-400 hover:text-white transition-colors">
      <ChevronRight size={16} />
    </button>
  </div>
);

/* --- DYNAMIC ITEM MANAGER (Category/Payment) --- */
const DynamicListManager = ({ items, onUpdate, placeholder, icon: Icon }) => {
  const [newValue, setNewValue] = useState('');
  const add = () => {
    if (!newValue || items.includes(newValue)) return;
    onUpdate([...items, newValue]);
    setNewValue('');
  };
  const remove = (val) => onUpdate(items.filter(i => i !== val));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <div key={item} className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-full border border-white/10 group animate-in zoom-in-75">
            <span className="text-xs text-zinc-300">{item}</span>
            <button onClick={() => remove(item)} className="text-zinc-600 hover:text-red-400 transition-colors">
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>
      <div className="flex gap-2 mt-4 pt-4 border-t border-white/5">
        <input 
          value={newValue} onChange={(e) => setNewValue(e.target.value)}
          placeholder={placeholder} className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-white/30"
        />
        <button onClick={add} className="bg-white text-black px-4 py-2 rounded-lg hover:bg-zinc-200 transition-colors">
          <Plus size={18} />
        </button>
      </div>
    </div>
  );
};

/* --- MAIN APP --- */
export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [currentMonth, setCurrentMonth] = useState(getMonthString(new Date()));
  
  // Data State
  const [transactions, setTransactions] = useState([]);
  const [monthlyData, setMonthlyData] = useState({ income: 0, cardBill: 0, fixedCosts: [] });
  const [config, setConfig] = useState({ 
    categories: ['食費', '日用品', '交通費', '交際費', '趣味', 'その他'],
    paymentMethods: ['現金', '三井住友', '楽天カード', 'PayPay']
  });
  
  const [aiAdvice, setAiAdvice] = useState(null);
  const [adviceLoading, setAdviceLoading] = useState(false);

  useEffect(() => {
    signInAnonymously(auth).catch(err => console.error(err));
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    
    // 1. Transactions
    const startOfMonth = new Date(`${currentMonth}-01T00:00:00`).toISOString();
    const d = new Date(`${currentMonth}-01`);
    d.setMonth(d.getMonth() + 1);
    const endOfMonth = d.toISOString();
    const txQuery = query(
      collection(db, 'users', user.uid, 'transactions'),
      where('date', '>=', startOfMonth),
      where('date', '<', endOfMonth)
    );
    const unsubTx = onSnapshot(txQuery, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => new Date(b.date) - new Date(a.date));
      setTransactions(data);
    });

    // 2. Monthly Settings
    const monthDocRef = doc(db, 'users', user.uid, 'months', currentMonth);
    const unsubMonth = onSnapshot(monthDocRef, (docSnap) => {
      if (docSnap.exists()) setMonthlyData(docSnap.data());
      else setMonthlyData({ income: 0, cardBill: 0, fixedCosts: [] });
    });

    // 3. User Global Config
    const configRef = doc(db, 'users', user.uid, 'settings', 'config');
    const unsubConfig = onSnapshot(configRef, (docSnap) => {
      if (docSnap.exists()) setConfig(docSnap.data());
    });

    return () => { unsubTx(); unsubMonth(); unsubConfig(); };
  }, [user, currentMonth]);

  const addTransaction = async (tx) => {
    if (!user) return;
    const today = new Date();
    const txDate = getMonthString(today) === currentMonth ? today.toISOString() : `${currentMonth}-01T12:00:00.000Z`;
    const ref = doc(collection(db, 'users', user.uid, 'transactions'));
    await setDoc(ref, { ...tx, createdAt: serverTimestamp(), date: txDate });
  };

  const deleteTransaction = async (id) => {
    await deleteDoc(doc(db, 'users', user.uid, 'transactions', id));
  };

  const updateMonthlyData = async (newData) => {
    const ref = doc(db, 'users', user.uid, 'months', currentMonth);
    await setDoc(ref, newData, { merge: true });
  };

  const updateGlobalConfig = async (newConfig) => {
    if (!user) return;
    const ref = doc(db, 'users', user.uid, 'settings', 'config');
    await setDoc(ref, newConfig);
  };

  const changeMonth = (delta) => {
    const d = new Date(`${currentMonth}-01`);
    d.setMonth(d.getMonth() + delta);
    setCurrentMonth(getMonthString(d));
    setAiAdvice(null);
  };

  const summary = useMemo(() => {
    const totalFixed = (monthlyData.fixedCosts || []).reduce((sum, item) => sum + item.amount, 0);
    const initialDisposable = (Number(monthlyData.income) || 0) - totalFixed - (Number(monthlyData.cardBill) || 0);
    const currentVariableExpenses = transactions.reduce((sum, t) => sum + t.amount, 0);
    return { totalFixed, initialDisposable, currentVariableExpenses, remaining: initialDisposable - currentVariableExpenses, totalIncome: monthlyData.income, cardBill: monthlyData.cardBill };
  }, [monthlyData, transactions]);

  const handleGenerateAdvice = async () => {
    setAdviceLoading(true);
    const prompt = `状況: 今月の残り${summary.remaining}円。冷静沈着な執事として、この家計状況へのアドバイスを日本語で50文字以内でお願いします。{"message": "テキスト"}`;
    const result = await callGemini(prompt);
    setAiAdvice(result.message);
    setAdviceLoading(false);
  };

  if (loading) return <div className="h-screen bg-black flex items-center justify-center text-zinc-500 font-mono tracking-widest uppercase">Initializing Liquid...</div>;

  return (
    <div className="min-h-screen bg-black text-zinc-200 font-sans pb-24 md:pl-24 selection:bg-white/20">
      <div className="fixed top-[-20%] left-[-20%] w-[80%] h-[80%] bg-zinc-800/20 rounded-full blur-[150px] pointer-events-none" />
      <div className="fixed inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none mix-blend-overlay"></div>

      {/* MOBILE HEADER */}
      <header className="md:hidden sticky top-0 z-20 p-4 flex justify-between items-center bg-black/50 backdrop-blur-xl border-b border-white/5">
        <h1 className="font-bold text-lg text-white flex items-center gap-2 tracking-widest uppercase"><Droplets size={20} /> Liquid</h1>
        <MonthSelector currentMonth={currentMonth} onChange={changeMonth} />
      </header>

      {/* SIDE NAV */}
      <nav className="hidden md:flex flex-col fixed left-0 top-0 bottom-0 w-24 bg-black/60 backdrop-blur-xl border-r border-white/5 items-center py-8 z-30">
        <Droplets className="w-8 h-8 text-white mb-12 drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]" />
        <div className="space-y-4 w-full px-2">
          <NavButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<Landmark size={20} />} label="HOME" />
          <NavButton active={activeTab === 'input'} onClick={() => setActiveTab('input')} icon={<Plus size={20} />} label="ADD" />
          <NavButton active={activeTab === 'history'} onClick={() => setActiveTab('history')} icon={<History size={20} />} label="LOG" />
          <NavButton active={activeTab === 'fixed'} onClick={() => setActiveTab('fixed')} icon={<Settings size={20} />} label="SET" />
        </div>
      </nav>

      <main className="max-w-xl mx-auto p-4 space-y-6 relative z-10 pt-6">
        {/* DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6 animate-in fade-in duration-700">
            <div className="hidden md:flex justify-end mb-4"><MonthSelector currentMonth={currentMonth} onChange={changeMonth} /></div>
            <GlassCard highlight={true} className="p-10 text-center relative">
              <p className="text-zinc-500 text-[10px] font-bold tracking-[0.3em] uppercase mb-4">Available Capital</p>
              <h2 className={`text-6xl font-black tracking-tighter mb-2 transition-all ${summary.remaining < 0 ? 'text-zinc-600 line-through decoration-white/20' : 'text-white'}`}>
                ¥{summary.remaining.toLocaleString()}
              </h2>
              {summary.remaining < 0 && <p className="text-red-500 font-mono text-xs tracking-widest uppercase">Deficit detected</p>}
            </GlassCard>

            <div className="grid grid-cols-2 gap-4">
               <GlassCard className="p-4 flex flex-col justify-between h-32 hover:bg-white/[0.05] transition-colors">
                 <div className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Income</div>
                 <div className="text-2xl font-bold text-white">¥{(Number(summary.totalIncome) || 0).toLocaleString()}</div>
               </GlassCard>
               <GlassCard className="p-4 flex flex-col justify-between h-32 hover:bg-white/[0.05] transition-colors">
                 <div className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Fixed + Bill</div>
                 <div className="text-2xl font-bold text-zinc-400">-¥{(summary.totalFixed + (Number(summary.cardBill) || 0)).toLocaleString()}</div>
               </GlassCard>
            </div>

            <div className="py-4 text-center">
              <button onClick={handleGenerateAdvice} disabled={adviceLoading} className="text-[10px] text-zinc-500 hover:text-white tracking-[0.3em] uppercase mb-4 flex items-center justify-center gap-2 w-full transition-colors">
                <Sparkles size={12} /> {adviceLoading ? 'Analyzing...' : 'Execute AI Analysis'}
              </button>
              {aiAdvice && <p className="text-sm font-serif italic text-white/90 animate-in slide-in-from-top-2 duration-500 px-6">"{aiAdvice}"</p>}
            </div>
            
            <div className="pt-2">
              <h3 className="text-zinc-600 text-[10px] font-bold uppercase tracking-widest mb-4 ml-1">Recent Records</h3>
              {transactions.slice(0, 3).map(tx => (
                <div key={tx.id} className="flex justify-between items-center p-4 rounded-xl border border-white/5 bg-white/[0.02] mb-2 transition-all">
                   <div className="flex items-center gap-3">
                     <div className={`w-1 h-8 rounded-full bg-white/40`} />
                     <div>
                       <div className="text-sm text-zinc-200 font-medium">{tx.category}</div>
                       <div className="text-[10px] text-zinc-600 uppercase tracking-widest">{tx.paymentMethod}</div>
                     </div>
                   </div>
                   <div className="font-mono text-white">¥{tx.amount.toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* INPUT FORM */}
        {activeTab === 'input' && (
          <div className="animate-in fade-in slide-in-from-bottom-8 duration-300">
            <GlassCard className="p-8">
              <h2 className="text-xl font-bold text-white mb-8 flex items-center gap-3 tracking-tight"><Plus size={24} /> New Transaction</h2>
              <form onSubmit={async (e) => {
                e.preventDefault();
                const amount = e.target.amount.value;
                const category = e.target.category.value;
                const method = e.target.method.value;
                if (!amount || !category || !method) return;
                await addTransaction({ amount: Number(amount), category, paymentMethod: method });
                setActiveTab('dashboard');
              }} className="space-y-8">
                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] block mb-3">Amount</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 text-xl font-light">¥</span>
                    <input name="amount" type="number" 
                      className="w-full bg-black/30 border border-white/10 rounded-xl py-5 pl-12 pr-4 text-3xl font-black text-white outline-none focus:border-white/40 transition-colors" placeholder="0" autoFocus />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] block mb-3">Payment Method</label>
                  <div className="grid grid-cols-2 gap-2">
                    {config.paymentMethods.map(m => (
                      <label key={m} className="relative cursor-pointer">
                        <input type="radio" name="method" value={m} className="peer hidden" defaultChecked={m === '現金'} />
                        <div className="py-3 text-center rounded-xl border border-zinc-800 text-zinc-500 text-sm transition-all peer-checked:bg-white peer-checked:text-black peer-checked:border-white peer-checked:font-bold">{m}</div>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] block mb-3">Category</label>
                  <div className="grid grid-cols-3 gap-2">
                    {config.categories.map(c => (
                      <label key={c} className="relative cursor-pointer">
                        <input type="radio" name="category" value={c} className="peer hidden" />
                        <div className="py-3 text-center rounded-xl border border-zinc-800 text-[12px] text-zinc-500 transition-all peer-checked:bg-zinc-800 peer-checked:text-white peer-checked:border-white/30">{c}</div>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={() => setActiveTab('dashboard')} className="flex-1 py-4 text-zinc-500 font-bold uppercase tracking-widest text-xs">Cancel</button>
                  <button type="submit" className="flex-2 bg-white text-black font-black rounded-xl py-4 px-10 shadow-xl uppercase tracking-widest text-xs hover:bg-zinc-200 transition-all">Submit</button>
                </div>
              </form>
            </GlassCard>
          </div>
        )}

        {/* LOG (HISTORY) */}
        {activeTab === 'history' && (
          <div className="space-y-4 pb-20 animate-in slide-in-from-right-4 duration-500">
            <h2 className="text-xl font-bold text-white px-1 tracking-tight">Transaction Log</h2>
            {transactions.map(tx => (
              <GlassCard key={tx.id} className="flex justify-between items-center p-5 group">
                <div className="flex items-center gap-4">
                  <div className={`p-2.5 rounded-xl border ${tx.paymentMethod === '現金' ? 'border-zinc-800 text-zinc-600' : 'border-white/20 text-white shadow-[0_0_10px_rgba(255,255,255,0.1)]'}`}>
                    {tx.paymentMethod === '現金' ? <Wallet size={18} /> : <CreditCard size={18} />}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-zinc-200">{tx.category}</div>
                    <div className="text-[10px] text-zinc-600 tracking-tighter uppercase">{tx.paymentMethod} • {new Date(tx.date).toLocaleDateString('ja-JP')}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-white font-mono text-lg font-medium">¥{tx.amount.toLocaleString()}</div>
                  <button onClick={() => deleteTransaction(tx.id)} className="text-[10px] text-red-900 font-bold hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all uppercase tracking-widest mt-1">Delete</button>
                </div>
              </GlassCard>
            ))}
            {transactions.length === 0 && <p className="text-center text-zinc-800 py-32 font-mono tracking-widest text-xs uppercase italic">Data Void</p>}
          </div>
        )}

        {/* SETTINGS */}
        {activeTab === 'fixed' && (
          <div className="space-y-6 pb-20 animate-in slide-in-from-bottom-4 duration-500">
             <h2 className="text-2xl font-black text-white tracking-tighter px-1">System Configuration</h2>
             
             <GlassCard className="p-6 space-y-6">
                <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.3em]">Monthly Budgeting</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] text-zinc-500 mb-2 block uppercase font-bold tracking-widest">Disposable Income</label>
                    <input type="number" value={monthlyData.income} onChange={e => updateMonthlyData({...monthlyData, income: Number(e.target.value)})} className="w-full bg-black/40 border border-white/10 rounded-lg p-4 text-white outline-none focus:border-white/30 transition-all font-mono" placeholder="¥0" />
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-500 mb-2 block uppercase font-bold tracking-widest">Card Settlement (Current)</label>
                    <input type="number" value={monthlyData.cardBill} onChange={e => updateMonthlyData({...monthlyData, cardBill: Number(e.target.value)})} className="w-full bg-black/40 border border-white/10 rounded-lg p-4 text-white outline-none focus:border-white/30 transition-all font-mono" placeholder="¥0" />
                  </div>
                </div>
             </GlassCard>

             <GlassCard className="p-6">
                <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.3em] mb-6 flex items-center gap-2"><CreditCard size={12}/> Payment Methods</h3>
                <DynamicListManager 
                  items={config.paymentMethods} 
                  onUpdate={newMethods => updateGlobalConfig({...config, paymentMethods: newMethods})} 
                  placeholder="三井住友, 楽天, PayPay等..."
                />
             </GlassCard>

             <GlassCard className="p-6">
                <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.3em] mb-6 flex items-center gap-2"><Tags size={12}/> Categories</h3>
                <DynamicListManager 
                  items={config.categories} 
                  onUpdate={newCats => updateGlobalConfig({...config, categories: newCats})} 
                  placeholder="趣味, 美容, 自己投資等..."
                />
             </GlassCard>

             <GlassCard className="p-6">
               <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.3em] mb-6">Fixed Costs Ledger</h3>
               <div className="space-y-2">
                 {(monthlyData.fixedCosts || []).map((item) => (
                   <div key={item.id} className="flex items-center justify-between p-4 bg-white/[0.03] rounded-xl border border-white/5">
                     <span className="text-zinc-300 text-sm font-medium">{item.name}</span>
                     <div className="flex items-center gap-4">
                       <span className="font-mono text-white text-sm">¥{item.amount.toLocaleString()}</span>
                       <button onClick={() => updateMonthlyData({...monthlyData, fixedCosts: monthlyData.fixedCosts.filter(f => f.id !== item.id)})} className="text-zinc-700 hover:text-red-500 transition-colors">
                         <Trash2 size={14} />
                       </button>
                     </div>
                   </div>
                 ))}
                 <div className="flex gap-2 mt-6 pt-6 border-t border-white/5">
                   <input id="fx-name" placeholder="家賃、Wi-Fi等" className="flex-1 bg-black/30 border border-white/10 rounded-lg px-4 py-3 text-sm text-white outline-none" />
                   <input id="fx-amount" type="number" placeholder="金額" className="w-24 bg-black/30 border border-white/10 rounded-lg px-4 py-3 text-sm text-white outline-none" />
                   <button onClick={() => {
                     const n = document.getElementById('fx-name');
                     const a = document.getElementById('fx-amount');
                     if(!n.value || !a.value) return;
                     updateMonthlyData({...monthlyData, fixedCosts: [...(monthlyData.fixedCosts || []), {id:Date.now(), name:n.value, amount:Number(a.value)}]});
                     n.value = ''; a.value = '';
                   }} className="bg-white text-black px-4 rounded-lg"><Plus size={20} /></button>
                 </div>
               </div>
             </GlassCard>
          </div>
        )}
      </main>

      {/* MOBILE NAV */}
      <nav className="fixed bottom-0 left-0 right-0 bg-black/80 backdrop-blur-3xl border-t border-white/10 flex justify-around items-end pb-safe md:hidden z-40 h-20 shadow-[0_-10px_40px_rgba(0,0,0,0.8)]">
        <NavButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<Landmark size={24} />} label="HOME" mobile />
        <div className="relative -top-6">
          <button onClick={() => setActiveTab('input')} className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center shadow-[0_0_30px_rgba(255,255,255,0.4)] active:scale-90 transition-transform"><Plus size={32} /></button>
        </div>
        <NavButton active={activeTab === 'fixed'} onClick={() => setActiveTab('fixed')} icon={<Settings size={24} />} label="SET" mobile />
      </nav>
    </div>
  );
}
