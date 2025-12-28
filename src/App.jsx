import React, { useState, useEffect } from 'react';
import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  deleteDoc, 
  doc 
} from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";
import { Plus, Trash2, Wallet, Receipt, TrendingDown, Calendar, GlassWater } from 'lucide-react';

/* ----------------------------------------------------------------
   1. FIREBASE SETUP
------------------------------------------------------------------- */
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
const auth = getAuth(app);

/* ----------------------------------------------------------------
   2. MAIN APPLICATION
------------------------------------------------------------------- */
export default function App() {
  const [items, setItems] = useState([]);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('食費');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    signInAnonymously(auth).catch(err => console.error("Auth Error:", err));

    const q = query(collection(db, "expenses"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setItems(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const total = items.reduce((sum, item) => sum + Number(item.amount), 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount) return;
    try {
      await addDoc(collection(db, "expenses"), {
        amount: Number(amount),
        category,
        note,
        createdAt: new Date().toISOString(),
      });
      setAmount('');
      setNote('');
    } catch (e) {
      alert("保存に失敗しました。Firestoreのルールを確認してください。");
    }
  };

  const deleteItem = async (id) => {
    try { await deleteDoc(doc(db, "expenses", id)); } catch (e) { console.error(e); }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-white">
        <div className="animate-pulse flex flex-col items-center">
          <GlassWater size={48} className="mb-4 text-blue-400" />
          <p className="text-[10px] tracking-[0.3em] uppercase opacity-50">Loading Glass Interface...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-6 font-sans selection:bg-white/20">
      {/* Background Ornaments */}
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 blur-[120px] rounded-full pointer-events-none" />

      {/* Header */}
      <header className="relative max-w-md mx-auto pt-12 pb-16 text-center">
        <h1 className="text-[10px] uppercase tracking-[0.4em] text-white/30 mb-4">Total Expenses</h1>
        <div className="text-6xl font-extralight tracking-tighter mb-2">
          <span className="text-2xl mr-1 opacity-30">¥</span>
          {total.toLocaleString()}
        </div>
        <div className="w-12 h-[1px] bg-white/20 mx-auto mt-8" />
      </header>

      {/* Glass Form */}
      <div className="max-w-md mx-auto mb-16 relative">
        <form onSubmit={handleSubmit} className="space-y-6 p-8 rounded-[2.5rem] bg-white/[0.03] backdrop-blur-3xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
          <div className="space-y-4">
            <div className="relative">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="w-full bg-transparent border-b border-white/10 py-4 text-3xl font-light focus:outline-none focus:border-white/40 transition-all placeholder:opacity-10"
              />
              <span className="absolute right-0 bottom-4 text-[10px] uppercase tracking-widest text-white/20">Amount</span>
            </div>
            
            <div className="grid grid-cols-2 gap-4 pt-2">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="bg-white/[0.05] border border-white/5 rounded-2xl p-4 text-sm focus:outline-none focus:bg-white/10 transition-all appearance-none"
              >
                {['食費', '日用品', '交際費', '固定費', 'その他'].map(cat => (
                  <option key={cat} value={cat} className="bg-zinc-900">{cat}</option>
                ))}
              </select>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Memo..."
                className="bg-white/[0.05] border border-white/5 rounded-2xl p-4 text-sm focus:outline-none focus:bg-white/10 transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-white text-black font-semibold p-5 rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 shadow-xl"
          >
            <Plus size={20} />
            <span className="text-xs uppercase tracking-widest">Add Record</span>
          </button>
        </form>
      </div>

      {/* Glass List */}
      <div className="max-w-md mx-auto space-y-4 relative">
        <div className="flex items-center gap-3 px-2 mb-6 opacity-30">
          <Calendar size={14} />
          <h2 className="text-[10px] uppercase tracking-[0.3em]">Timeline</h2>
        </div>
        
        {items.length === 0 ? (
          <div className="text-center py-20 bg-white/[0.02] rounded-[2.5rem] border border-dashed border-white/10">
            <p className="text-[10px] uppercase tracking-[0.2em] opacity-20">Clear Atmosphere</p>
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="group flex items-center justify-between p-6 rounded-[2rem] bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] hover:border-white/10 transition-all duration-500"
            >
              <div className="flex items-center gap-5">
                <div className="w-12 h-12 rounded-2xl bg-white/[0.03] flex items-center justify-center border border-white/5 group-hover:scale-110 transition-transform duration-500">
                  <TrendingDown size={18} className="text-white/20" />
                </div>
                <div>
                  <div className="text-sm font-medium tracking-wide mb-1">{item.category}</div>
                  <div className="text-[10px] text-white/20 uppercase tracking-widest">{item.note || 'no note'}</div>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right font-light text-xl tracking-tight">
                  <span className="text-xs mr-1 opacity-20">¥</span>
                  {Number(item.amount).toLocaleString()}
                </div>
                <button
                  onClick={() => deleteItem(item.id)}
                  className="opacity-0 group-hover:opacity-100 p-2 text-white/10 hover:text-red-400 transition-all duration-300"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
      
      <div className="h-32" />
    </div>
  );
}
