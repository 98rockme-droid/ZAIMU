import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import {
  getFirestore, collection, doc, setDoc, onSnapshot, query, deleteDoc,
  where, getDocs, getDoc, orderBy, addDoc, updateDoc, serverTimestamp,
  runTransaction, documentId
} from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth';
import {
  Wallet, CreditCard, Landmark, Plus, Settings, Trash2, History,
  ChevronLeft, ChevronRight, X, Tags, ArrowLeft, CopyCheck, Calendar,
  CheckCircle2, BarChart3, TrendingDown, TrendingUp, Banknote,
  Search, CalendarDays, AlignJustify, Zap, Calculator, Delete, LogOut, 
  Lock, User, FileText, Home, Sparkles, ChevronDown, HelpCircle, Pencil
} from 'lucide-react';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_GOOGLE_API_KEY,
  authDomain: "zaimu-4f79b.firebaseapp.com",
  projectId: "zaimu-4f79b",
  storageBucket: "zaimu-4f79b.firebasestorage.app",
  messagingSenderId: "388166181792",
  appId: "1:388166181792:web:d3ccef2742dca358d3bac5"
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const CASH = '現金';

const getMonthString = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
const formatMonthJP = (mStr) => mStr ? `${mStr.split('-')[0]}年 ${Number(mStr.split('-')[1])}月` : "";
const formatFullDateJP = (iso) => iso ? `${new Date(iso).getFullYear()}年${new Date(iso).getMonth() + 1}月${new Date(iso).getDate()}日` : '';
const getTodayString = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const toNumber = (v) => v ? Number(String(v).replace(/,/g, '')) || 0 : 0;

const normalizeMonthlyData = (d = {}) => ({
  salary: d.salary || 0, budget: d.budget || 0,
  cardBills: d.cardBills || {}, fixedCosts: d.fixedCosts || [],
  catBudgets: d.catBudgets || {}, cardDueDates: d.cardDueDates || {},
  confirmedPayments: d.confirmedPayments || [], savings: d.savings || 0, memo: d.memo || ''
});

const SimpleCard = ({ children, className = "", onClick }) => (
  <div onClick={onClick} className={`bg-[#1E1E1E] rounded-xl border border-white/5 shadow-lg overflow-hidden w-full ${className}`}>{children}</div>
);

const NavButton = ({ active, onClick, icon }) => (
  <button onClick={onClick} className={`flex items-center justify-center w-16 h-16 transition-all ${active ? 'text-white scale-110 drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]' : 'text-zinc-600'}`}>{icon}</button>
);

const CalculatorPad = ({ initialValue, onConfirm }) => {
  const [display, setDisplay] = useState(String(initialValue || '0'));
  const handlePush = (val) => setDisplay(prev => prev === '0' ? String(val) : prev + val);
  return (
    <div className="w-full flex flex-col gap-3">
      <div className="bg-black/40 rounded-lg p-3 text-right border border-white/5 font-mono text-2xl text-white break-all">{display}</div>
      <div className="grid grid-cols-4 gap-2 h-64">
        {['7','8','9','/','4','5','6','*','1','2','3','-','0','C','=','+'].map(l => (
          <button key={l} type="button" onClick={() => {
            if(l==='C') setDisplay('0');
            else if(l==='=') setDisplay(String(safeCalculate(display)));
            else handlePush(l);
          }} className="rounded-lg bg-zinc-800 border border-white/5 text-lg font-bold text-white">{l}</button>
        ))}
      </div>
      <button type="button" onClick={() => onConfirm(toNumber(display))} className="w-full h-12 bg-white text-black rounded-lg font-bold">決定</button>
    </div>
  );
};

const safeCalculate = (expr) => {
  try { return eval(expr.replace(/[^0-9+\-*/.]/g, '')) || 0; } catch { return 0; }
};

function AppMain() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('home');
  const [settingTab, setSettingTab] = useState('menu');
  const [month, setMonth] = useState(getMonthString(new Date()));
  const [transactions, setTransactions] = useState([]);
  const [monthlyData, setMonthlyData] = useState(normalizeMonthlyData());
  const [config, setConfig] = useState({ categories: [{ name: '食費', icon: '🍔' }], paymentMethods: [CASH], templates: [] });
  const [viewingTx, setViewingTx] = useState(null);
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [toast, setToast] = useState({ visible: false, message: '' });

  useEffect(() => onAuthStateChanged(auth, u => { setUser(u); setAuthLoading(false); }), []);

  useEffect(() => {
    if (!user) return;
    const start = new Date(`${month}-01T00:00:00`).toISOString();
    const end = new Date(new Date(`${month}-01T00:00:00`).setMonth(new Date(`${month}-01T00:00:00`).getMonth() + 1)).toISOString();
    return onSnapshot(query(collection(db, 'users', user.uid, 'transactions'), where('date', '>=', start), where('date', '<', end)), s => {
      setTransactions(s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => new Date(b.date) - new Date(a.date)));
    });
  }, [month, user]);

  useEffect(() => {
    if (!user) return;
    onSnapshot(doc(db, 'users', user.uid, 'months', month), s => setMonthlyData(normalizeMonthlyData(s.data())));
    onSnapshot(doc(db, 'users', user.uid, 'settings', 'config'), s => s.exists() && setConfig(s.data()));
  }, [month, user]);

  const summary = useMemo(() => {
    const d = monthlyData;
    const fixedCash = d.fixedCosts.filter(f => f.method === CASH).reduce((s, i) => s + toNumber(i.amount), 0);
    const fixedTotal = d.fixedCosts.reduce((s, i) => s + toNumber(i.amount), 0);
    const billTotal = Object.values(d.cardBills).reduce((s, v) => s + toNumber(v), 0);
    const savings = toNumber(d.savings);
    const salary = toNumber(d.salary);

    const normalTx = transactions.filter(t => !t.isSpecial);
    const spentCard = normalTx.filter(t => t.paymentMethod !== CASH).reduce((s, t) => s + toNumber(t.amount), 0);
    
    // 🌟 修正ロジック：今月現金で払った分は引かない
    const currentFreeCash = salary - billTotal - fixedCash - savings;
    const projectedCash = salary - spentCard - fixedTotal - savings;
    const cardTarget = d.budget || 100000;

    return {
      cardTarget,
      spentCard,
      cardPacePercent: Math.min(100, (spentCard / cardTarget) * 100),
      currentFreeCash,
      projectedCash,
      fixedTotal,
      savings,
      catTotals: normalTx.reduce((acc, t) => { acc[t.category] = (acc[t.category] || 0) + toNumber(t.amount); return acc; }, {})
    };
  }, [monthlyData, transactions]);

  const handleTxSubmit = async (e) => {
    e.preventDefault();
    // 入力処理（簡略化）
    setIsTxModalOpen(false);
  };

  if (authLoading) return <div className="h-screen bg-[#121212] flex items-center justify-center text-zinc-600">Loading...</div>;
  if (!user) return (
    <div className="h-screen w-full bg-[#121212] flex flex-col items-center justify-center p-6 gap-8">
      <h1 className="text-4xl font-black text-white">ZAIMU</h1>
      <button onClick={() => signInWithPopup(auth, new GoogleAuthProvider())} className="w-full max-w-xs h-14 bg-white text-black rounded-full font-bold">Google Login</button>
    </div>
  );

  return (
    <div className="fixed inset-0 w-full bg-[#121212] text-zinc-200 flex flex-col justify-center overflow-hidden">
      <div className="w-full max-w-md h-full flex flex-col relative bg-[#121212] shadow-2xl mx-auto">
        <header className="flex-none h-16 border-b border-white/5 px-4 flex items-center justify-between bg-[#121212]/80 backdrop-blur-xl z-50">
          <button onClick={() => { const d = new Date(month + "-01"); d.setMonth(d.getMonth() - 1); setMonth(getMonthString(d)) }}><ChevronLeft size={20} /></button>
          <span className="text-sm font-bold text-white">{formatMonthJP(month)}</span>
          <button onClick={() => { const d = new Date(month + "-01"); d.setMonth(d.getMonth() + 1); setMonth(getMonthString(d)) }}><ChevronRight size={20} /></button>
        </header>

        <main className="flex-1 overflow-hidden relative flex flex-col">
          {activeTab === 'home' && (
            <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6 pb-32">
              <SimpleCard className="p-0">
                <div className="grid grid-cols-2 divide-x divide-white/5">
                  <div className="p-4 flex flex-col justify-between">
                    <div>
                      <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider mb-1">今のカード利用額</p>
                      <h2 className="text-2xl font-bold text-white">¥{summary.spentCard.toLocaleString()}</h2>
                    </div>
                    <div className="mt-4">
                      <div className="flex justify-between text-[8px] text-zinc-500 mb-1"><span>目安</span><span>¥{summary.cardTarget.toLocaleString()}</span></div>
                      <div className="h-1 bg-white/5 rounded-full overflow-hidden"><div className={`h-full ${summary.spentCard > summary.cardTarget ? 'bg-amber-400' : 'bg-white'}`} style={{ width: `${summary.cardPacePercent}%` }} /></div>
                    </div>
                  </div>
                  <div className="p-4 flex flex-col justify-between gap-4">
                    <div>
                      <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider mb-1">今月の自由な現金</p>
                      <h2 className="text-xl font-bold text-emerald-400">¥{summary.currentFreeCash.toLocaleString()}</h2>
                    </div>
                    <div>
                      <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider mb-1">来月末の着地予想</p>
                      <h2 className="text-xl font-bold text-white">¥{summary.projectedCash.toLocaleString()}</h2>
                    </div>
                  </div>
                </div>
              </SimpleCard>

              {/* カテゴリ予算（簡略版） */}
              <div className="space-y-3">
                <h3 className="text-[10px] text-zinc-500 uppercase font-black pl-1">カテゴリ別 予算</h3>
                <SimpleCard className="grid grid-cols-2 gap-px bg-white/5">
                  {Object.keys(monthlyData.catBudgets).map(n => (
                    <div key={n} className="bg-[#1E1E1E] p-3">
                      <p className="text-[10px] font-bold text-zinc-400">{n}</p>
                      <p className="text-sm font-black text-white">¥{(summary.catTotals[n] || 0).toLocaleString()}</p>
                    </div>
                  ))}
                </SimpleCard>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-32">
              {settingTab === 'faq' ? (
                <div className="space-y-4">
                  <button onClick={() => setSettingTab('menu')} className="text-emerald-400 text-xs flex items-center gap-1"><ArrowLeft size={14}/> 戻る</button>
                  <h3 className="text-lg font-bold text-white">お金の設計図</h3>
                  <div className="bg-zinc-900 p-4 rounded-xl text-xs text-zinc-300 leading-relaxed space-y-4">
                    <p className="font-bold text-emerald-400">■ 今月の自由な現金</p>
                    <p>4/25給与から「先月のカード代」「固定費(現金)」「貯金」を引いた、5月に自由に使える現金の総枠です。</p>
                    <p className="font-bold text-emerald-400">■ 来月末の着地予想</p>
                    <p>今月のカード利用ペースを続けた場合、来月末に手元にいくら純利益が残るかのシミュレーションです。</p>
                  </div>
                </div>
              ) : (
                <SimpleCard className="divide-y divide-white/5">
                  <button onClick={() => setSettingTab('faq')} className="w-full p-4 flex justify-between items-center text-sm font-bold text-zinc-300"><span>よくある質問・計算ロジック</span><HelpCircle size={18}/></button>
                  <button onClick={() => setEditingItem({type:'salary', data:{value:monthlyData.salary}})} className="w-full p-4 flex justify-between text-sm font-bold text-zinc-300"><span>手取り給与</span><span>¥{Number(monthlyData.salary).toLocaleString()}</span></button>
                  <button onClick={() => setEditingItem({type:'savings', data:{value:monthlyData.savings}})} className="w-full p-4 flex justify-between text-sm font-bold text-zinc-300"><span>今月の積立額</span><span>¥{Number(monthlyData.savings).toLocaleString()}</span></button>
                </SimpleCard>
              )}
            </div>
          )}
        </main>

        <footer className="flex-none h-24 border-t border-white/5 flex justify-between items-center px-6 pb-6 bg-[#121212]/80 backdrop-blur-xl z-50">
          <NavButton active={activeTab === 'home'} onClick={() => setActiveTab('home')} icon={<Home size={24} />} />
          <NavButton active={activeTab === 'log'} onClick={() => setActiveTab('log')} icon={<History size={24} />} />
          <button onClick={() => setIsTxModalOpen(true)} className="w-14 h-14 bg-white text-black rounded-full flex items-center justify-center ml-2 shadow-xl"><Plus size={28} /></button>
          <NavButton active={activeTab === 'analysis'} onClick={() => setActiveTab('analysis')} icon={<BarChart3 size={24} />} />
          <NavButton active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={<Settings size={24} />} />
        </footer>

        {/* 編集モーダル（リファクタリング版：確実に閉じます） */}
        {editingItem && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/80 backdrop-blur-sm" onClick={() => setEditingItem(null)}>
            <div className="w-full max-w-md bg-[#1E1E1E] rounded-t-2xl p-6 pb-12" onClick={e => e.stopPropagation()}>
              <CalculatorPad initialValue={editingItem.data.value} onConfirm={async (val) => {
                await setDoc(doc(db, 'users', user.uid, 'months', month), { [editingItem.type]: val }, { merge: true });
                setEditingItem(null);
                setToast({ visible: true, message: '保存しました' });
                setTimeout(() => setToast({ visible: false, message: '' }), 2000);
              }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AppWrapper() { return <ErrorBoundary><AppMain /></ErrorBoundary>; }
