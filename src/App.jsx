import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, onSnapshot, query, deleteDoc, serverTimestamp, where } from 'firebase/firestore';
import { Wallet, CreditCard, Landmark, Plus, Settings, Trash2, History, Sparkles, ChevronLeft, ChevronRight, Droplets, Tags } from 'lucide-react';

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
    return text ? JSON.parse(text) : { message: "良いペースですね。" };
  } catch (error) {
    return { message: "解析をスキップしました。" };
  }
};

const getMonthString = (date) => date.toISOString().slice(0, 7);

/* --- シンプルなカードコンポーネント --- */
const SimpleCard = ({ children, className = "" }) => (
  <div className={`bg-[#1E1E1E] rounded-xl border border-white/5 shadow-md ${className}`}>
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

/* --- 設定用リスト管理 --- */
const ListManager = ({ items, onUpdate, placeholder }) => {
  const [val, setVal] = useState('');
  const add = () => { if (val && !items.includes(val)) { onUpdate([...items, val]); setVal(''); } };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {items.map(i => (
          <div key={i} className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-md border border-white/10">
            <span className="text-xs text-zinc-300">{i}</span>
            <button onClick={() => onUpdate(items.filter(x => x !== i))}><Trash2 size={12} className="text-zinc-600" /></button>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input value={val} onChange={e => setVal(e.target.value)} placeholder={placeholder} className="flex-1 bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none" />
        <button onClick={add} className="bg-zinc-200 text-black px-4 rounded-lg font-bold text-sm">追加</button>
      </div>
    </div>
  );
};

/* --- メインアプリ --- */
export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('home');
  const [month, setMonth] = useState(getMonthString(new Date()));
  const [transactions, setTransactions] = useState([]);
  const [monthlyData, setMonthlyData] = useState({ income: 0, cardBill: 0, fixedCosts: [] });
  const [config, setConfig] = useState({ 
    categories: ['食費', '日用品', '交通費', '交際費', '趣味', 'その他'],
    paymentMethods: ['現金', 'メインカード', 'サブカード']
  });
  const [aiAdvice, setAiAdvice] = useState(null);
  const [adviceLoading, setAdviceLoading] = useState(false);

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
      setMonthlyData(s.exists() ? s.data() : { income: 0, cardBill: 0, fixedCosts: [] });
    });
    const unsubConfig = onSnapshot(doc(db, 'users', user.uid, 'settings', 'config'), (s) => {
      if (s.exists()) setConfig(s.data());
    });
    return () => { unsubTx(); unsubMonth(); unsubConfig(); };
  }, [user, month]);

  const summary = useMemo(() => {
    const fixed = (monthlyData.fixedCosts || []).reduce((s, i) => s + i.amount, 0);
    const disposable = (monthlyData.income || 0) - fixed - (monthlyData.cardBill || 0);
    const spent = transactions.reduce((s, t) => s + t.amount, 0);
    return { disposable, remaining: disposable - spent, income: monthlyData.income, out: fixed + (monthlyData.cardBill || 0) };
  }, [monthlyData, transactions]);

  const addTx = async (tx) => {
    const ref = doc(collection(db, 'users', user.uid, 'transactions'));
    await setDoc(ref, { ...tx, createdAt: serverTimestamp(), date: new Date().toISOString() });
    setActiveTab('home');
  };

  if (loading) return <div className="h-screen bg-[#121212] flex items-center justify-center text-zinc-500 text-xs tracking-widest uppercase">Loading...</div>;

  return (
    <div className="min-h-screen bg-[#121212] text-zinc-200 font-sans">
      <header className="sticky top-0 z-20 bg-[#121212]/90 backdrop-blur-md border-b border-white/5 p-4 flex justify-between items-center">
        <h1 className="text-lg font-bold tracking-tighter text-white">ZAIMU</h1>
        <div className="flex items-center bg-white/5 rounded-lg px-2 py-1">
          <button onClick={() => { const d=new Date(`${month}-01`); d.setMonth(d.getMonth()-1); setMonth(getMonthString(d)); }} className="p-1"><ChevronLeft size={16}/></button>
          <span className="px-2 font-mono text-xs">{month.replace('-','/')}</span>
          <button onClick={() => { const d=new Date(`${month}-01`); d.setMonth(d.getMonth()+1); setMonth(getMonthString(d)); }} className="p-1"><ChevronRight size={16}/></button>
        </div>
      </header>

      <main className="max-w-md mx-auto p-4 pb-24 space-y-4">
        {activeTab === 'home' && (
          <div className="animate-in fade-in duration-500 space-y-4">
            <SimpleCard className="p-6 text-center">
              <p className="text-zinc-500 text-[10px] font-bold uppercase mb-1">今月使える残り</p>
              <h2 className={`text-4xl font-bold ${summary.remaining < 0 ? 'text-red-400' : 'text-white'}`}>¥{summary.remaining.toLocaleString()}</h2>
            </SimpleCard>

            <div className="grid grid-cols-2 gap-3">
              <SimpleCard className="p-4">
                <p className="text-[10px] text-zinc-500 mb-1">手取り収入</p>
                <p className="font-bold">¥{summary.income.toLocaleString()}</p>
              </SimpleCard>
              <SimpleCard className="p-4">
                <p className="text-[10px] text-zinc-500 mb-1">固定費＋請求</p>
                <p className="font-bold text-zinc-400">¥{summary.out.toLocaleString()}</p>
              </SimpleCard>
            </div>

            <button 
              onClick={async () => {
                setAdviceLoading(true);
                const res = await callGemini(`状況: 残金${summary.remaining}円。アドバイスを日本語で一言。{"message": "文"}`);
                setAiAdvice(res.message); setAdviceLoading(false);
              }}
              className="w-full text-[10px] text-zinc-500 uppercase tracking-widest py-2 flex items-center justify-center gap-2"
            >
              <Sparkles size={12}/> {adviceLoading ? '解析中...' : 'AIアドバイスを表示'}
            </button>
            {aiAdvice && <p className="text-sm text-center italic text-zinc-300 px-4">"{aiAdvice}"</p>}

            <div className="space-y-2 pt-2">
              <p className="text-[10px] font-bold text-zinc-500 uppercase px-1">最近の履歴</p>
              {transactions.slice(0, 5).map(t => (
                <div key={t.id} className="flex justify-between items-center bg-white/5 p-4 rounded-xl border border-white/5">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{t.category}</span>
                    <span className="text-[10px] text-zinc-500 uppercase">{t.paymentMethod}</span>
                  </div>
                  <span className="font-mono">¥{t.amount.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'add' && (
          <SimpleCard className="p-6 animate-in slide-in-from-bottom-4">
            <h2 className="text-sm font-bold mb-6 flex items-center gap-2 text-white"><Plus size={16}/> 支出を入力</h2>
            <form onSubmit={e => {
              e.preventDefault();
              addTx({ amount: Number(e.target.amount.value), category: e.target.category.value, paymentMethod: e.target.method.value });
            }} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] text-zinc-500 uppercase font-bold ml-1">金額</label>
                <input name="amount" type="number" className="w-full bg-black/20 border border-white/10 rounded-xl py-4 px-4 text-2xl font-bold text-white outline-none focus:border-white/20" placeholder="0" autoFocus required />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] text-zinc-500 uppercase font-bold ml-1">カテゴリ</label>
                <div className="grid grid-cols-3 gap-2">
                  {config.categories.map(c => (
                    <label key={c} className="cursor-pointer">
                      <input type="radio" name="category" value={c} className="peer hidden" required />
                      <div className="py-2 text-center rounded-lg border border-zinc-800 text-xs text-zinc-500 peer-checked:bg-white peer-checked:text-black peer-checked:border-white">{c}</div>
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] text-zinc-500 uppercase font-bold ml-1">支払方法</label>
                <div className="grid grid-cols-2 gap-2">
                  {config.paymentMethods.map(m => (
                    <label key={m} className="cursor-pointer">
                      <input type="radio" name="method" value={m} className="peer hidden" required />
                      <div className="py-2 text-center rounded-lg border border-zinc-800 text-xs text-zinc-500 peer-checked:bg-zinc-700 peer-checked:text-white peer-checked:border-white/20">{m}</div>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-4 pt-2">
                <button type="button" onClick={() => setActiveTab('home')} className="flex-1 py-3 text-xs text-zinc-500 font-bold uppercase">キャンセル</button>
                <button type="submit" className="flex-2 bg-zinc-200 text-black font-bold rounded-xl py-3 px-8 text-sm shadow-lg">保存</button>
              </div>
            </form>
          </SimpleCard>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-4 animate-in fade-in">
            <SimpleCard className="p-6 space-y-6">
              <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">基本収支</h3>
              <div className="space-y-4">
                <div><label className="text-[10px] text-zinc-500 mb-1 block">手取り月収</label>
                  <input type="number" value={monthlyData.income} onChange={e => setDoc(doc(db, 'users', user.uid, 'months', month), { income: Number(e.target.value) }, { merge: true })} className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white text-sm outline-none" />
                </div>
                <div><label className="text-[10px] text-zinc-500 mb-1 block">今月のカード請求額</label>
                  <input type="number" value={monthlyData.cardBill} onChange={e => setDoc(doc(db, 'users', user.uid, 'months', month), { cardBill: Number(e.target.value) }, { merge: true })} className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white text-sm outline-none" />
                </div>
              </div>
            </SimpleCard>
            <SimpleCard className="p-6 space-y-4">
              <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">カテゴリ管理</h3>
              <ListManager items={config.categories} onUpdate={c => setDoc(doc(db, 'users', user.uid, 'settings', 'config'), { ...config, categories: c })} placeholder="食費、趣味など" />
            </SimpleCard>
            <SimpleCard className="p-6 space-y-4">
              <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">支払方法管理</h3>
              <ListManager items={config.paymentMethods} onUpdate={p => setDoc(doc(db, 'users', user.uid, 'settings', 'config'), { ...config, paymentMethods: p })} placeholder="三井住友、楽天など" />
            </SimpleCard>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-[#121212]/95 border-t border-white/5 flex justify-around p-2 z-30">
        <NavButton active={activeTab === 'home'} onClick={() => setActiveTab('home')} icon={<Landmark size={20}/>} label="ホーム" />
        <div className="relative -top-5">
          <button onClick={() => setActiveTab('add')} className="w-14 h-14 bg-zinc-200 rounded-full flex items-center justify-center text-black shadow-xl border-4 border-[#121212] active:scale-95 transition-transform"><Plus size={28}/></button>
        </div>
        <NavButton active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={<Settings size={20}/>} label="設定" />
      </nav>
    </div>
  );
}
