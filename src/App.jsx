import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, onSnapshot, query, deleteDoc, serverTimestamp, where, updateDoc, writeBatch } from 'firebase/firestore';
import { Wallet, CreditCard, Landmark, Plus, Settings, Trash2, History, ChevronLeft, ChevronRight, Edit3, X, Tags, ArrowLeft, CopyCheck, AlertCircle } from 'lucide-react';

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
    
    const cardBudget = (monthlyData.budget || 0);
    const cardDisposable = cardBudget - fixed - totalCardBill;
    const spentCard = transactions.filter(t => t.paymentMethod !== '現金').reduce((s, t) => s + t.amount, 0);
    const cardRemaining = cardDisposable - spentCard;
    const cardRemainingPercent = cardDisposable > 0 ? Math.max(Math.round((cardRemaining / cardDisposable) * 100), 0) : 0;

    const cashBudget = (monthlyData.cashBudget || 0);
    const spentCash = transactions.filter(t => t.paymentMethod === '現金').reduce((s, t) => s + t.amount, 0);
    const cashRemaining = cashBudget - spentCash;
    const cashRemainingPercent = cashBudget > 0 ? Math.max(Math.round((cashRemaining / cashBudget) * 100), 0) : 0;

    const catTotals = transactions.reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount;
      return acc;
    }, {});
    const totalSpent = transactions.reduce((s, t) => s + t.amount, 0);

    return { cardRemaining, cashRemaining, cardBudget, cashBudget, cardRemainingPercent, cashRemainingPercent, catTotals, totalSpent };
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
    alert('固定費を履歴に反映しました');
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
    <div className="min-h-screen w-full bg-[#121212] text-zinc-200 font-sans pb-28 flex flex-col items-center overflow-x-hidden font-bold">
      
      {/* HEADER: Z-50, アイコンと「今月」ボタンを復元 */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#121212] border-b border-white/5 px-4 py-4 flex justify-center shadow-lg">
        <div className="w-full max-w-md flex justify-between items-center px-1">
          <div className="flex items-center gap-2">
            <img src="/favicon.ico" alt="logo" className="w-6 h-6 rounded object-contain" onError={(e) => e.target.style.display = 'none'} />
            <h1 className="text-xl font-black tracking-tighter text-white uppercase">ZAIMU</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setMonth(getMonthString(new Date()))} className="px-2.5 py-1.5 bg-white/5 rounded-lg border border-white/5 text-[10px] font-bold text-zinc-400">今月</button>
            <div className="flex items-center bg-white/5 rounded-lg px-2 py-1 border border-white/5 font-mono text-xs">
              <button onClick={() => { const d=new Date(`${month}-01`); d.setMonth(d.getMonth()-1); setMonth(getMonthString(d)); }}><ChevronLeft size={16}/></button>
              <span className="px-2 font-bold">{month.replace('-','/')}</span>
              <button onClick={() => { const d=new Date(`${month}-01`); d.setMonth(d.getMonth()+1); setMonth(getMonthString(d)); }}><ChevronRight size={16}/></button>
            </div>
          </div>
        </div>
      </header>

      <main className="w-full max-w-md p-4 pt-20 space-y-4 box-border animate-in fade-in duration-300">
        
        {activeTab === 'home' && (
          <div className="space-y-4">
            {/* 引き落としリマインダー */}
            {Object.entries(monthlyData.cardDueDates || {}).map(([card, day]) => {
              const today = new Date().getDate();
              const diff = Number(day) - today;
              if (diff >= 0 && diff <= 7) return (
                <div key={card} className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-center gap-3 text-red-400">
                  <AlertCircle size={16}/><span className="text-[10px] font-bold uppercase">{card}: {day}日に引き落とし (あと{diff}日)</span>
                </div>
              );
              return null;
            })}

            {/* メイン予算カード: 2x2グリッドに戻す */}
            <div className="grid grid-cols-2 gap-3">
              <SimpleCard className="p-4 flex flex-col items-center justify-center text-center h-28 relative">
                <p className="text-[9px] text-zinc-500 uppercase tracking-widest mb-1">カード残り</p>
                <p className={`text-xl font-bold ${summary.cardRemaining < 0 ? 'text-red-400' : 'text-white'}`}>¥{summary.cardRemaining.toLocaleString()}</p>
                <div className="absolute bottom-0 left-0 w-full h-1 bg-white/5 overflow-hidden">
                  <div className={`h-full transition-all duration-700 ${summary.cardRemainingPercent <= 15 ? 'bg-red-500' : 'bg-white'}`} style={{ width: `${summary.cardRemainingPercent}%` }} />
                </div>
              </SimpleCard>
              <SimpleCard className="p-4 flex flex-col items-center justify-center text-center h-28">
                <p className="text-[9px] text-zinc-500 uppercase tracking-widest mb-1">カード軍資金</p>
                <p className="text-xl font-bold text-zinc-400">¥{summary.cardBudget.toLocaleString()}</p>
              </SimpleCard>
              <SimpleCard className="p-4 flex flex-col items-center justify-center text-center h-28 relative">
                <p className="text-[9px] text-zinc-500 uppercase tracking-widest mb-1">現金残り</p>
                <p className={`text-xl font-bold ${summary.cashRemaining < 0 ? 'text-red-400' : 'text-white'}`}>¥{summary.cashRemaining.toLocaleString()}</p>
                <div className="absolute bottom-0 left-0 w-full h-1 bg-white/5 overflow-hidden">
                  <div className={`h-full transition-all duration-700 ${summary.cashRemainingPercent <= 15 ? 'bg-red-500' : 'bg-zinc-400'}`} style={{ width: `${summary.cashRemainingPercent}%` }} />
                </div>
              </SimpleCard>
              <SimpleCard className="p-4 flex flex-col items-center justify-center text-center h-28">
                <p className="text-[9px] text-zinc-500 uppercase tracking-widest mb-1">現金軍資金</p>
                <p className="text-xl font-bold text-zinc-400">¥{summary.cashBudget.toLocaleString()}</p>
              </SimpleCard>
            </div>

            {/* 円グラフ (精度向上・ガタつき修正) */}
            {summary.totalSpent > 0 && (
              <SimpleCard className="p-5">
                <p className="text-[10px] text-zinc-500 uppercase font-bold mb-5 tracking-widest">支出カテゴリ割合</p>
                <div className="flex items-center gap-8">
                  <div className="w-24 h-24 rounded-full flex-shrink-0 relative shadow-inner" 
                       style={{ background: `conic-gradient(${Object.entries(summary.catTotals).map(([cat, amt], idx) => {
                         const start = Object.values(summary.catTotals).slice(0, idx).reduce((s, v) => s + v, 0);
                         const startP = (start / summary.totalSpent) * 100;
                         const endP = ((start + amt) / summary.totalSpent) * 100;
                         return `${COLORS[idx % COLORS.length]} ${startP.toFixed(2)}% ${endP.toFixed(2)}%`;
                       }).join(', ')})` }}>
                    <div className="absolute inset-[18%] bg-[#1E1E1E] rounded-full" />
                  </div>
                  <div className="space-y-2 flex-1 min-w-0">
                    {Object.entries(summary.catTotals).map(([cat, amt], idx) => (
                      <div key={cat} className="flex justify-between items-center text-[10px] font-bold">
                        <div className="flex items-center gap-2 truncate text-zinc-400">
                          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                          <span>{cat}</span>
                        </div>
                        <span className="text-zinc-500 pl-2 tabular-nums">¥{amt.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </SimpleCard>
            )}

            {/* カテゴリ別予算進捗 */}
            <div className="grid grid-cols-2 gap-3">
              {config.categories.filter(c => monthlyData.catBudgets?.[c]).map(c => {
                const spent = summary.catTotals[c] || 0;
                const budget = monthlyData.catBudgets[c];
                const per = Math.max(Math.round(((budget - spent) / budget) * 100), 0);
                return (
                  <SimpleCard key={c} className="p-3 space-y-2">
                    <div className="flex justify-between items-center text-[9px] font-bold">
                      <span className="text-zinc-400">{c}予算</span>
                      <span className="text-zinc-500">{per}%</span>
                    </div>
                    <div className="h-0.5 bg-white/5 rounded-full overflow-hidden">
                      <div className={`h-full ${per < 15 ? 'bg-red-500' : 'bg-zinc-500'}`} style={{ width: `${per}%` }} />
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
            <div className="flex gap-2 font-bold">
              <select onChange={e => setFilter({...filter, category: e.target.value})} className="bg-white/5 border border-white/10 rounded-lg px-3 h-10 text-[10px] flex-1 text-zinc-300 appearance-none outline-none">
                <option value="ALL">全てのカテゴリ</option>
                {config.categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select onChange={e => setFilter({...filter, method: e.target.value})} className="bg-white/5 border border-white/10 rounded-lg px-3 h-10 text-[10px] flex-1 text-zinc-300 appearance-none outline-none">
                <option value="ALL">全ての支払方法</option>
                {config.paymentMethods.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            {transactions.filter(t => (filter.category === 'ALL' || t.category === filter.category) && (filter.method === 'ALL' || t.paymentMethod === filter.method)).map(t => (
              <SimpleCard key={t.id} className="p-4 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/5 rounded-lg text-zinc-500">{t.paymentMethod === '現金' ? <Wallet size={16}/> : <CreditCard size={16}/>}</div>
                  <div className="text-left">
                    <div className="text-sm font-bold text-white truncate w-32">{t.title}</div>
                    <div className="text-[9px] text-zinc-500 uppercase">{t.category} • {t.date.split('T')[0]}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 pl-2">
                  <span className="text-sm font-bold tabular-nums">¥{t.amount.toLocaleString()}</span>
                  <button onClick={() => { setEditingTx(t); setIsModalOpen(true); }} className="text-zinc-600"><Edit3 size={14}/></button>
                  <button onClick={() => { if(window.confirm('削除しますか？')) deleteDoc(doc(db,'users',SHARED_USER_ID,'transactions',t.id)); }} className="text-red-900/50 hover:text-red-500 transition-colors"><Trash2 size={14}/></button>
                </div>
              </SimpleCard>
            ))}
          </div>
        )}

        {/* SETUP TAB: 完全復元 */}
        {activeTab === 'settings' && (
          <div className="space-y-4">
            {settingTab !== 'menu' && (
              <button onClick={() => setSettingTab('menu')} className="flex items-center gap-2 text-zinc-500 text-xs font-bold mb-4">
                <ArrowLeft size={16}/> 戻る
              </button>
            )}

            {settingTab === 'menu' && (
              <div className="space-y-3">
                {[
                  { id: 'budget', label: '資金計画・引き落とし日', icon: <Landmark size={18}/> },
                  { id: 'fixed', label: '固定費管理', icon: <CreditCard size={18}/> },
                  { id: 'category', label: 'カテゴリ編集', icon: <Tags size={18}/> },
                  { id: 'payment', label: '支払方法・カード編集', icon: <Wallet size={18}/> },
                ].map(item => (
                  <button key={item.id} onClick={() => setSettingTab(item.id)} className="w-full flex items-center justify-between p-5 bg-[#1E1E1E] rounded-lg border border-white/5 text-sm font-bold box-border active:scale-95 transition-all">
                    <div className="flex items-center gap-4 text-zinc-300">{item.icon} {item.label}</div>
                    <ChevronRight size={18} className="text-zinc-700"/>
                  </button>
                ))}
              </div>
            )}

            {settingTab === 'budget' && (
              <div className="space-y-4 animate-in slide-in-from-bottom-2">
                <SimpleCard className="p-5 space-y-4">
                  <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">軍資金設定</p>
                  <div className="space-y-3">
                    <div className="flex flex-col gap-1">
                       <label className="text-[9px] text-zinc-600 pl-1">カード軍資金</label>
                       <input type="number" defaultValue={monthlyData.budget} onBlur={e => setDoc(doc(db,'users',SHARED_USER_ID,'months',month),{budget:Number(e.target.value)},{merge:true})} className="w-full h-11 bg-black/20 border border-white/10 rounded-lg px-4 text-sm text-white outline-none" />
                    </div>
                    <div className="flex flex-col gap-1">
                       <label className="text-[9px] text-zinc-600 pl-1">現金軍資金</label>
                       <input type="number" defaultValue={monthlyData.cashBudget} onBlur={e => setDoc(doc(db,'users',SHARED_USER_ID,'months',month),{cashBudget:Number(e.target.value)},{merge:true})} className="w-full h-11 bg-black/20 border border-white/10 rounded-lg px-4 text-sm text-white outline-none" />
                    </div>
                  </div>
                </SimpleCard>
                <SimpleCard className="p-5 space-y-4">
                  <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">カード別請求額 & 引き落とし日</p>
                  <div className="space-y-3">
                    {config.paymentMethods.filter(m => m !== '現金').map(m => (
                      <div key={m} className="flex gap-2 items-center">
                        <span className="text-[9px] text-zinc-500 w-14 truncate">{m}</span>
                        <input type="number" placeholder="金額" defaultValue={monthlyData.cardBills?.[m] || 0} onBlur={e => setDoc(doc(db,'users',SHARED_USER_ID,'months',month),{cardBills:{...monthlyData.cardBills,[m]:Number(e.target.value)}},{merge:true})} className="flex-1 h-10 bg-black/20 border border-white/10 rounded-lg px-3 text-xs text-white" />
                        <input type="number" placeholder="日" defaultValue={monthlyData.cardDueDates?.[m] || ''} onBlur={e => setDoc(doc(db,'users',SHARED_USER_ID,'months',month),{cardDueDates:{...monthlyData.cardDueDates,[m]:e.target.value}},{merge:true})} className="w-12 h-10 bg-black/20 border border-white/10 rounded-lg px-1 text-xs text-center text-white" />
                      </div>
                    ))}
                  </div>
                </SimpleCard>
              </div>
            )}

            {settingTab === 'fixed' && (
              <SimpleCard className="p-5 space-y-4 animate-in slide-in-from-bottom-2">
                <div className="flex justify-between items-center"><p className="text-[10px] text-zinc-500 uppercase font-bold">固定費管理</p><button onClick={copyFixedCosts} className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-200 text-black rounded-lg text-[9px] font-bold uppercase active:scale-95"><CopyCheck size={12}/> 今月分を一括追加</button></div>
                <div className="space-y-2">
                  {(monthlyData.fixedCosts || []).map(f => (
                    <div key={f.id} className="flex justify-between items-center bg-black/20 p-4 rounded-lg border border-white/5"><span className="text-xs text-zinc-300 font-bold">{f.name}</span><div className="flex items-center gap-4"><span className="text-sm font-bold tabular-nums">¥{f.amount.toLocaleString()}</span><button onClick={() => setDoc(doc(db,'users',SHARED_USER_ID,'months',month),{fixedCosts:monthlyData.fixedCosts.filter(x=>x.id!==f.id)},{merge:true})}><Trash2 size={16} className="text-red-900/40"/></button></div></div>
                  ))}
                  <div className="flex flex-col gap-3 pt-4 border-t border-white/5 font-bold">
                    <input id="fx-n" placeholder="固定費名 (例: 家賃)" className="w-full h-11 bg-black/20 border border-white/10 rounded-lg px-4 text-sm text-white outline-none" />
                    <input id="fx-a" type="number" placeholder="金額" className="w-full h-11 bg-black/20 border border-white/10 rounded-lg px-4 text-sm text-white outline-none" />
                    <button onClick={() => { const n=document.getElementById('fx-n'),a=document.getElementById('fx-a'); if(!n.value || !a.value) return; setDoc(doc(db,'users',SHARED_USER_ID,'months',month),{fixedCosts:[...(monthlyData.fixedCosts || []),{id:Date.now(),name:n.value,amount:Number(a.value)}]},{merge:true}); n.value=''; a.value=''; }} className="w-full h-11 bg-zinc-200 text-black rounded-lg font-bold text-[10px] uppercase tracking-widest mt-1">固定費を追加</button>
                  </div>
                </div>
              </SimpleCard>
            )}

            {settingTab === 'category' && (
              <SimpleCard className="p-5 space-y-6 animate-in slide-in-from-bottom-2">
                <div>
                  <p className="text-[10px] text-zinc-500 uppercase font-bold mb-4">カテゴリ名の一覧</p>
                  <div className="flex flex-wrap gap-2 mb-6">
                    {config.categories.map(c => (
                      <div key={c} className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-lg border border-white/10 text-xs text-zinc-300">
                        {c} <button onClick={() => setDoc(doc(db,'users',SHARED_USER_ID,'settings','config'),{...config,categories:config.categories.filter(x=>x!==c)})}><Trash2 size={12} className="text-zinc-700"/></button>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-col gap-2">
                    <input id="new-cat" placeholder="カテゴリ名を追加" className="w-full h-11 bg-black/20 border border-white/10 rounded-lg px-4 text-sm text-white" />
                    <button onClick={() => { const i=document.getElementById('new-cat'); if(i.value) setDoc(doc(db,'users',SHARED_USER_ID,'settings','config'),{...config,categories:[...config.categories,i.value]}); i.value=''; }} className="w-full h-11 bg-zinc-200 text-black rounded-lg font-bold text-xs uppercase">追加</button>
                  </div>
                </div>
                <div className="border-t border-white/5 pt-6">
                  <p className="text-[10px] text-zinc-500 uppercase font-bold mb-4">カテゴリ別目標予算</p>
                  <div className="space-y-3">
                    {config.categories.map(c => (
                      <div key={c} className="flex items-center justify-between">
                        <span className="text-xs text-zinc-400">{c}</span>
                        <input type="number" placeholder="¥ 0" defaultValue={monthlyData.catBudgets?.[c] || ''} onBlur={e => setDoc(doc(db,'users',SHARED_USER_ID,'months',month),{catBudgets:{...monthlyData.catBudgets,[c]:Number(e.target.value)}},{merge:true})} className="w-24 h-9 bg-black/20 border border-white/10 rounded px-2 text-right text-sm text-white" />
                      </div>
                    ))}
                  </div>
                </div>
              </SimpleCard>
            )}

            {settingTab === 'payment' && (
              <SimpleCard className="p-5 space-y-6 animate-in slide-in-from-bottom-2">
                <div>
                  <p className="text-[10px] text-zinc-500 uppercase font-bold mb-4">支払方法の一覧</p>
                  <div className="flex flex-wrap gap-2 mb-6">
                    {config.paymentMethods.map(m => (
                      <div key={m} className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-lg border border-white/10 text-xs text-zinc-300">
                        {m} <button onClick={() => setDoc(doc(db,'users',SHARED_USER_ID,'settings','config'),{...config,paymentMethods:config.paymentMethods.filter(x=>x!==m)})}><Trash2 size={12} className="text-zinc-700"/></button>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-col gap-2">
                    <input id="new-pay" placeholder="支払方法を追加" className="w-full h-11 bg-black/20 border border-white/10 rounded-lg px-4 text-sm text-white" />
                    <button onClick={() => { const i=document.getElementById('new-pay'); if(i.value) setDoc(doc(db,'users',SHARED_USER_ID,'settings','config'),{...config,paymentMethods:[...config.paymentMethods,i.value]}); i.value=''; }} className="w-full h-11 bg-zinc-200 text-black rounded-lg font-bold text-xs uppercase">追加</button>
                  </div>
                </div>
              </SimpleCard>
            )}
          </div>
        )}
      </main>

      {/* FAB: 完全な円形 */}
      <div className="fixed bottom-28 w-full max-w-md px-6 flex justify-end">
        <button onClick={() => { setEditingTx(null); setIsModalOpen(true); }} className="w-14 h-14 bg-white text-black rounded-full flex items-center justify-center shadow-2xl active:scale-90 transition-transform border border-zinc-200"><Plus size={28}/></button>
      </div>

      {/* MODAL: スタイル復元 & レイアウト修正 */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <SimpleCard className="relative max-w-md p-5 space-y-5">
            <div className="flex justify-between items-center font-bold">
              <h2 className="text-[10px] font-bold uppercase text-white tracking-widest">支出入力</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-zinc-600 hover:text-white"><X size={18}/></button>
            </div>
            <form onSubmit={handleTxSubmit} className="space-y-5">
              <input name="amount" type="number" defaultValue={editingTx?.amount || ''} className="w-full h-14 bg-black/20 border border-white/10 rounded-lg text-2xl font-bold text-left px-4 text-white outline-none tabular-nums font-bold" placeholder="0" autoFocus required />
              <input name="title" type="text" defaultValue={editingTx?.title || ''} className="w-full h-11 bg-black/20 border border-white/10 rounded-lg px-4 text-sm text-white font-bold" placeholder="タイトル (例: ランチ)" />
              
              <div className="flex flex-row gap-4 w-full box-border">
                <div className="flex-1 flex flex-col gap-1.5 overflow-hidden">
                  <label className="text-[9px] text-zinc-500 uppercase pl-1 font-bold">日付</label>
                  <input name="date" type="date" defaultValue={editingTx ? editingTx.date.split('T')[0] : getTodayString()} className="w-full h-11 bg-black/20 border border-white/10 rounded-lg text-xs px-2 text-white outline-none font-bold appearance-none" />
                </div>
                <div className="flex-1 flex flex-col gap-1.5 overflow-hidden">
                  <label className="text-[9px] text-zinc-500 uppercase pl-1 font-bold">カテゴリ</label>
                  <select name="category" defaultValue={editingTx?.category || config.categories[0]} className="w-full h-11 bg-black/20 border border-white/10 rounded-lg text-xs px-2 text-white outline-none appearance-none font-bold">
                    {config.categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 justify-start font-bold">
                {config.paymentMethods.map(m => (
                  <label key={m} className="cursor-pointer">
                    <input type="radio" name="method" value={m} className="peer hidden" defaultChecked={editingTx?.paymentMethod === m || (!editingTx && m === config.paymentMethods[0])} required />
                    <div className="px-3.5 h-11 text-center rounded-lg border border-zinc-800 text-[10px] font-bold text-zinc-500 peer-checked:bg-white peer-checked:text-black transition-all flex items-center justify-center min-w-[64px] font-bold uppercase">{m}</div>
                  </label>
                ))}
              </div>
              <button type="submit" className="w-full h-12 bg-white text-black font-bold rounded-lg text-xs uppercase tracking-widest shadow-lg mt-1 active:scale-95 transition-transform">保存する</button>
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
