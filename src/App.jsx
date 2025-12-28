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
   1. FIREBASE SETUP (ここがあなたの専用設定です)
------------------------------------------------------------------- */
const firebaseConfig = {
  apiKey: "AIzaSyD_MMX3Irb-xN1Tql5L0kWJo6BoO_rFX7g",
  authDomain: "zaimu-4f79b.firebaseapp.com",
  projectId: "zaimu-4f79b",
  storageBucket: "zaimu-4f79b.firebasestorage.app",
  messagingSenderId: "388166181792",
  appId: "1:388166181792:web:d3ccef2742dca358d3bac5"
};

// 初期化
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

/* ----------------------------------------------------------------
   2. MAIN APPLICATION COMPONENT
------------------------------------------------------------------- */
export default function App() {
  const [items, setItems] = useState([]);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('食費');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);

  // ログインとデータ購読
  useEffect(() => {
    // 匿名ログインを実行（Authenticationで有効にしている必要があります）
    signInAnonymously(auth).catch((error) => {
      console.error("Auth Error:", error);
    });

    // Firestoreからリアルタイムにデータを取得
    const q = query(collection(db, "expenses"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
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
      console.error("Error adding document: ", e);
      alert("保存に失敗しました。Firebaseのルールを確認してください。");
    }
  };

  const deleteItem = async (id) => {
    try {
      await deleteDoc(doc(db, "expenses", id));
    } catch (e) {
      console.error("Error deleting document: ", e);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        <div className="animate-pulse flex flex-col items-center">
          <GlassWater size={48} className="mb-4 text-blue-400" />
          <p className="text-sm tracking-widest uppercase">Connecting to Database...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-4 font-sans selection:bg-blue-500/30">
      {/* Header */}
      <header className="max-w-md mx-auto mt-8 mb-12 text-center">
        <div className="inline-block p-3 rounded-full bg-white/5 backdrop-blur-xl border border-white/10 mb-4">
          <Wallet size={24} className="text-white" />
        </div>
        <h1 className="text-xs uppercase tracking-[0.3em] text-white/50 mb-2">Current Balance</h1>
        <div className="text-5xl font-light tracking-tighter">
          ¥ {total.toLocaleString()}
        </div>
      </header>

      {/* Input Form */}
      <div className="max-w-md mx-auto mb-12">
        <form onSubmit={handleSubmit} className="space-y-4 p-6 rounded-[2rem] bg-white/5 backdrop-blur-2xl border border-white/10 shadow-2xl">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-widest text-white/40 ml-1">Amount</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="w-full bg-white/5 border border-white/5 rounded-2xl p-4 focus:outline-none focus:ring-1 focus:ring-white/20 transition-all text-xl"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-widest text-white/40 ml-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-white/5 border border-white/5 rounded-2xl p-4 focus:outline-none focus:ring-1 focus:ring-white/20 transition-all appearance-none"
              >
                {['食費', '日用品', '交際費', '固定費', 'その他'].map(cat => (
                  <option key={cat} value={cat} className="bg-zinc-900">{cat}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-widest text-white/40 ml-1">Memo</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="..."
              className="w-full bg-white/5 border border-white/5 rounded-2xl p-4 focus:outline-none focus:ring-1 focus:ring-white/20 transition-all"
            />
          </div>
          <button
            type="submit"
            className="w-full bg-white text-black font-medium p-4 rounded-2xl hover:bg-white/90 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <Plus size={18} />
            Add Transaction
          </button>
        </form>
      </div>

      {/* History */}
      <div className="max-w-md mx-auto space-y-3">
        <div className="flex items-center justify-between px-2 mb-4">
          <h2 className="text-[10px] uppercase tracking-[0.2em] text-white/30 flex items-center gap-2">
            <Calendar size={12} /> Recent Activities
          </h2>
        </div>
        
        {items.length === 0 ? (
          <div className="text-center py-12 text-white/20 border border-dashed border-white/10 rounded-[2rem]">
            <Receipt size={32} className="mx-auto mb-2 opacity-20" />
            <p className="text-xs uppercase tracking-widest">No data yet</p>
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="group flex items-center justify-between p-5 rounded-[1.5rem] bg-white/[0.03] border border-white/5 hover:bg-white/5 transition-all duration-500"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                  <TrendingDown size={16} className="text-white/40" />
                </div>
                <div>
                  <div className="text-sm font-medium">{item.category}</div>
                  <div className="text-[10px] text-white/30 uppercase tracking-tighter">{item.note || 'no memo'}</div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right font-light text-lg tracking-tight">
                  - ¥{item.amount.toLocaleString()}
                </div>
                <button
                  onClick={() => deleteItem(item.id)}
                  className="opacity-0 group-hover:opacity-100 p-2 text-white/20 hover:text-red-400 transition-all"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
      
      {/* Footer Decoration */}
      <div className="h-24" />
    </div>
  );
}
