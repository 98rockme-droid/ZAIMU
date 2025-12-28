import React, { useState, useEffect, useMemo } from 'react';
/* プレビュー用にFirebase関連はコメントアウトまたはダミー化して、
  UI確認ができるようにしています。
*/
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
  Copy,
  Droplets
} from 'lucide-react';

/* --- UTILS --- */
const getMonthString = (date) => date.toISOString().slice(0, 7);

/* --- UI COMPONENTS (MONOCHROME LIQUID) --- */
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
    <span className="text-[10px] font-medium tracking-widest uppercase opacity-80">{label}</span>
  </button>
);

const MonthSelector = ({ currentMonth, onChange }) => (
  <div className="flex items-center bg-black/40 border border-white/10 rounded-full px-2 py-1 backdrop-blur-md">
    <button onClick={() => onChange(-1)} className="p-2 text-zinc-400 hover:text-white transition-colors">
      <ChevronLeft size={16} />
    </button>
    <span className="mx-3 font-mono text-sm text-white font-bold tracking-widest">{currentMonth}</span>
    <button onClick={() => onChange(1)} className="p-2 text-zinc-400 hover:text-white transition-colors">
      <ChevronRight size={16} />
    </button>
  </div>
);

/* --- SUB-COMPONENTS --- */
const FixedCostManager = ({ fixedCosts, onUpdate }) => {
  const [newName, setNewName] = useState('');
  const [newAmount, setNewAmount] = useState('');

  const add = () => {
    if (!newName || !newAmount) return;
    const newItem = { id: Date.now(), name: newName, amount: Number(newAmount) };
    onUpdate([...fixedCosts, newItem]);
    setNewName('');
    setNewAmount('');
  };

  const remove = (id) => {
    onUpdate(fixedCosts.filter(item => item.id !== id));
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {fixedCosts.map((item) => (
          <div key={item.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5">
            <span className="text-zinc-300 text-sm">{item.name}</span>
            <div className="flex items-center gap-3">
              <span className="font-mono text-white">¥{item.amount.toLocaleString()}</span>
              <button onClick={() => remove(item.id)} className="text-zinc-600 hover:text-red-400 transition-colors">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-2 mt-4 pt-4 border-t border-white/5">
        <input 
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="項目名"
          className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-white/40 focus:outline-none placeholder:text-zinc-700"
        />
        <input 
          type="number"
          value={newAmount}
          onChange={(e) => setNewAmount(e.target.value)}
          placeholder="金額"
          className="w-24 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-white/40 focus:outline-none placeholder:text-zinc-700"
        />
        <button onClick={add} className="bg-white text-black px-3 py-2 rounded-lg hover:bg-zinc-200 transition-colors">
          <Plus size={18} />
        </button>
      </div>
    </div>
  );
};

const TransactionForm = ({ onAdd, onCancel }) => {
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash'); 
  const categories = ['食費', '日用品', '交通費', '交際費', '趣味', 'その他'];

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!amount || !category) return;
    onAdd({
      amount: Number(amount),
      category,
      paymentMethod
    });
    onCancel();
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-8 duration-300">
      <GlassCard className="p-6">
        <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
          <Plus className="w-5 h-5" /> 支出を記録
        </h2>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-2">金額</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 text-xl">¥</span>
              <input 
                type="number" 
                value={amount} 
                onChange={e => setAmount(e.target.value)} 
                className="w-full bg-black/30 border border-white/10 rounded-xl py-4 pl-10 pr-4 text-2xl font-bold text-white focus:outline-none focus:border-white/50 transition-colors"
                placeholder="0"
                autoFocus
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-2">支払方法</label>
            <div className="grid grid-cols-2 gap-3">
              <button 
                type="button"
                onClick={() => setPaymentMethod('cash')}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl border transition-all ${
                  paymentMethod === 'cash' 
                    ? 'bg-white text-black border-white shadow-[0_0_15px_rgba(255,255,255,0.3)]' 
                    : 'bg-transparent text-zinc-500 border-zinc-800 hover:border-zinc-600'
                }`}
              >
                <Wallet size={18} /> 現金
              </button>
              <button 
                type="button"
                onClick={() => setPaymentMethod('card')}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl border transition-all ${
                  paymentMethod === 'card' 
                    ? 'bg-white text-black border-white shadow-[0_0_15px_rgba(255,255,255,0.3)]' 
                    : 'bg-transparent text-zinc-500 border-zinc-800 hover:border-zinc-600'
                }`}
              >
                <CreditCard size={18} /> クレカ
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-2">カテゴリ</label>
            <div className="flex flex-wrap gap-2">
              {categories.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={`px-4 py-2 rounded-full text-sm border transition-all ${
                    category === c
                      ? 'bg-zinc-800 text-white border-white/30'
                      : 'bg-transparent text-zinc-500 border-zinc-800 hover:border-zinc-600'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onCancel} className="flex-1 py-3 text-zinc-400 font-bold text-sm hover:text-white transition-colors">キャンセル</button>
            <button type="submit" className="flex-1 bg-white text-black font-bold rounded-xl py-3 shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:shadow-[0_0_30px_rgba(255,255,255,0.4)] transition-all">保存</button>
          </div>
        </form>
      </GlassCard>
    </div>
  );
};

/* --- MAIN APP (PREVIEW MODE) --- */
export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [currentMonth, setCurrentMonth] = useState(getMonthString(new Date()));
  const [aiAdvice, setAiAdvice] = useState(null);
  const [adviceLoading, setAdviceLoading] = useState(false);

  // MOCK DATA STATE (No Database)
  const [monthlyData, setMonthlyData] = useState({
    income: 350000,
    cardBill: 85000,
    fixedCosts: [
      { id: 1, name: '家賃', amount: 98000 },
      { id: 2, name: 'Wi-Fi', amount: 5500 },
      { id: 3, name: '電気代', amount: 8000 },
    ]
  });

  const [transactions, setTransactions] = useState([
    { id: 1, date: new Date().toISOString(), category: '食費', amount: 3500, paymentMethod: 'cash' },
    { id: 2, date: new Date().toISOString(), category: '日用品', amount: 1200, paymentMethod: 'card' },
    { id: 3, date: new Date().toISOString(), category: '交際費', amount: 5000, paymentMethod: 'cash' },
  ]);

  /* Operations (Mock) */
  const addTransaction = (tx) => {
    const newTx = { ...tx, id: Date.now(), date: new Date().toISOString() };
    setTransactions([newTx, ...transactions]);
  };

  const deleteTransaction = (id) => {
    setTransactions(transactions.filter(t => t.id !== id));
  };

  const changeMonth = (delta) => {
    const d = new Date(`${currentMonth}-01`);
    d.setMonth(d.getMonth() + delta);
    setCurrentMonth(getMonthString(d));
    setAiAdvice(null);
  };

  /* Calculations */
  const summary = useMemo(() => {
    const totalFixed = (monthlyData.fixedCosts || []).reduce((sum, item) => sum + item.amount, 0);
    const totalIncome = Number(monthlyData.income) || 0;
    const cardBill = Number(monthlyData.cardBill) || 0;
    const initialDisposable = totalIncome - totalFixed - cardBill;
    const currentVariableExpenses = transactions.reduce((sum, t) => sum + t.amount, 0);
    const remaining = initialDisposable - currentVariableExpenses;
    return { totalFixed, initialDisposable, currentVariableExpenses, remaining, totalIncome, cardBill };
  }, [monthlyData, transactions]);

  /* AI Mock */
  const handleGenerateAdvice = () => {
    setAdviceLoading(true);
    setTimeout(() => {
      setAiAdvice("今月ちょっと飛ばしすぎやな。今週末は家でNetflixでも見とき。");
      setAdviceLoading(false);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-black text-zinc-200 font-sans pb-24 md:pb-0 md:pl-24 selection:bg-white/30">
      
      {/* --- LIQUID BACKGROUND --- */}
      <div className="fixed top-[-20%] left-[-20%] w-[80%] h-[80%] bg-zinc-800/20 rounded-full blur-[150px] animate-pulse pointer-events-none" />
      <div className="fixed bottom-[-20%] right-[-20%] w-[60%] h-[60%] bg-zinc-700/10 rounded-full blur-[120px] pointer-events-none" />
      
      {/* --- MOBILE HEADER --- */}
      <header className="md:hidden sticky top-0 z-20 p-4 flex justify-between items-center bg-black/50 backdrop-blur-xl border-b border-white/5">
        <h1 className="font-bold text-lg text-white tracking-wider flex items-center gap-2">
          <Droplets className="w-5 h-5" /> LIQUID
        </h1>
        <MonthSelector currentMonth={currentMonth} onChange={changeMonth} />
      </header>

      {/* --- SIDEBAR (PC) --- */}
      <nav className="hidden md:flex flex-col fixed left-0 top-0 bottom-0 w-24 bg-black/60 backdrop-blur-xl border-r border-white/5 items-center py-8 z-30">
        <div className="mb-12 text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">
          <Droplets className="w-8 h-8" />
        </div>
        <div className="space-y-4 w-full px-2">
          <NavButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<Landmark size={20} />} label="HOME" />
          <NavButton active={activeTab === 'input'} onClick={() => setActiveTab('input')} icon={<Plus size={20} />} label="ADD" />
          <NavButton active={activeTab === 'history'} onClick={() => setActiveTab('history')} icon={<History size={20} />} label="LOG" />
          <NavButton active={activeTab === 'fixed'} onClick={() => setActiveTab('fixed')} icon={<Settings size={20} />} label="SET" />
        </div>
      </nav>

      {/* --- MAIN CONTENT --- */}
      <main className="max-w-xl mx-auto p-4 space-y-6 relative z-10 pt-6">
        
        {/* DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6 animate-in fade-in duration-700">
            <div className="hidden md:flex justify-end mb-4">
              <MonthSelector currentMonth={currentMonth} onChange={changeMonth} />
            </div>

            {/* MAIN BALANCE CARD */}
            <GlassCard highlight={true} className="p-8 text-center relative overflow-hidden group">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-white/5 rounded-full blur-3xl group-hover:bg-white/10 transition-colors duration-700 pointer-events-none" />
              
              <p className="text-zinc-500 text-xs font-bold tracking-[0.2em] uppercase mb-4 relative z-10">Safe to Spend</p>
              <h2 className={`text-5xl md:text-6xl font-black tracking-tighter mb-2 relative z-10 drop-shadow-2xl ${
                summary.remaining < 0 ? 'text-zinc-500 line-through decoration-white/30' : 'text-white'
              }`}>
                ¥{summary.remaining.toLocaleString()}
              </h2>
              {summary.remaining < 0 && <p className="text-red-500/80 font-mono text-sm tracking-widest relative z-10">OVER BUDGET</p>}
            </GlassCard>

            {/* STATUS GRID */}
            <div className="grid grid-cols-2 gap-4">
               <GlassCard className="p-4 flex flex-col justify-between h-32">
                 <div className="flex items-center gap-2 text-zinc-500 text-[10px] font-bold uppercase tracking-wider">
                   <Landmark size={12} /> Income
                 </div>
                 <div className="text-2xl font-bold text-white">¥{summary.totalIncome.toLocaleString()}</div>
               </GlassCard>
               
               <GlassCard className="p-4 flex flex-col justify-between h-32">
                 <div className="flex items-center gap-2 text-zinc-500 text-[10px] font-bold uppercase tracking-wider">
                   <CreditCard size={12} /> Fixed + Bill
                 </div>
                 <div className="text-2xl font-bold text-zinc-400">-¥{(summary.totalFixed + summary.cardBill).toLocaleString()}</div>
               </GlassCard>
            </div>

            {/* AI ADVICE */}
            <div className="py-2">
              <button 
                onClick={handleGenerateAdvice}
                disabled={adviceLoading}
                className="w-full flex items-center justify-center gap-2 text-xs text-zinc-500 hover:text-white transition-colors tracking-widest uppercase mb-3"
              >
                <Sparkles size={12} /> {adviceLoading ? 'Analyzing...' : 'AI Analysis'}
              </button>
              {aiAdvice && (
                <div className="animate-in slide-in-from-top-2 fade-in text-center px-4">
                  <p className="text-sm font-serif italic text-white/90">"{aiAdvice}"</p>
                </div>
              )}
            </div>

            {/* SPENDING LIST */}
            <div className="pt-4">
              <h3 className="text-zinc-600 text-xs font-bold uppercase tracking-widest mb-4 pl-1">Recent Spending</h3>
              <div className="space-y-2">
                {transactions.slice(0, 3).map(tx => (
                  <div key={tx.id} className="flex justify-between items-center p-4 rounded-xl border border-white/5 bg-white/[0.02]">
                      <div className="flex items-center gap-3">
                        <div className={`w-1 h-8 rounded-full ${tx.paymentMethod === 'cash' ? 'bg-zinc-600' : 'bg-white'}`} />
                        <div>
                          <div className="text-sm text-zinc-200">{tx.category}</div>
                          <div className="text-[10px] text-zinc-600 uppercase tracking-wide">{tx.paymentMethod}</div>
                        </div>
                      </div>
                      <div className="font-mono text-zinc-300">¥{tx.amount.toLocaleString()}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* INPUT */}
        {activeTab === 'input' && (
          <TransactionForm 
            onAdd={addTransaction} 
            onCancel={() => setActiveTab('dashboard')} 
          />
        )}

        {/* HISTORY */}
        {activeTab === 'history' && (
          <div className="space-y-4 animate-in slide-in-from-right-4 duration-500">
             <div className="flex justify-between items-center mb-4">
               <h2 className="text-xl font-bold text-white tracking-tight">History</h2>
             </div>
             <div className="space-y-2 pb-20">
               {transactions.map(tx => (
                 <GlassCard key={tx.id} className="flex justify-between items-center p-4 group">
                    <div className="flex items-center gap-4">
                       <div className={`p-2 rounded-full border ${tx.paymentMethod === 'cash' ? 'border-zinc-700 text-zinc-500' : 'border-white/30 text-white'}`}>
                         {tx.paymentMethod === 'cash' ? <Wallet size={16} /> : <CreditCard size={16} />}
                       </div>
                       <div>
                         <div className="text-sm font-bold text-zinc-200">{tx.category}</div>
                         <div className="text-[10px] text-zinc-600">{new Date(tx.date).toLocaleDateString()}</div>
                       </div>
                    </div>
                    <div className="text-right">
                      <div className="text-white font-mono">¥{tx.amount.toLocaleString()}</div>
                      <button onClick={() => deleteTransaction(tx.id)} className="text-[10px] text-red-900 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">DELETE</button>
                    </div>
                 </GlassCard>
               ))}
             </div>
          </div>
        )}

        {/* SETTINGS (FIXED COSTS) */}
        {activeTab === 'fixed' && (
          <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500 pb-20">
             <div className="flex justify-between items-center">
               <h2 className="text-xl font-bold text-white tracking-tight">Config <span className="text-zinc-600 text-sm font-normal ml-2">{currentMonth}</span></h2>
               <button className="text-xs flex items-center gap-1 bg-white/10 px-3 py-1.5 rounded-full hover:bg-white/20 transition-colors">
                 <Copy size={12} /> Copy Prev
               </button>
             </div>
             <GlassCard className="p-6">
                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4">Base Income & Bills</h3>
                <div className="space-y-4">
                  <div>
                     <label className="text-xs text-zinc-400 mb-1 block">Income</label>
                     <input 
                       type="number" 
                       value={monthlyData.income}
                       onChange={e => setMonthlyData({...monthlyData, income: Number(e.target.value)})}
                       className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white font-mono focus:border-white/50 focus:outline-none"
                     />
                  </div>
                  <div>
                     <label className="text-xs text-zinc-400 mb-1 block">Credit Card Bill</label>
                     <input 
                       type="number" 
                       value={monthlyData.cardBill}
                       onChange={e => setMonthlyData({...monthlyData, cardBill: Number(e.target.value)})}
                       className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white font-mono focus:border-white/50 focus:outline-none"
                     />
                  </div>
                </div>
             </GlassCard>
             <GlassCard className="p-6">
               <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4">Fixed Costs</h3>
               <FixedCostManager 
                 fixedCosts={monthlyData.fixedCosts || []}
                 onUpdate={newCosts => setMonthlyData({...monthlyData, fixedCosts: newCosts})}
               />
             </GlassCard>
          </div>
        )}

      </main>

      {/* --- MOBILE BOTTOM NAV --- */}
      <nav className="fixed bottom-0 left-0 right-0 bg-black/80 backdrop-blur-xl border-t border-white/10 flex justify-around items-end pb-safe md:hidden z-40 h-20">
        <NavButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<Landmark size={24} />} label="HOME" mobile />
        <div className="relative -top-6">
          <button onClick={() => setActiveTab('input')} className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.4)] active:scale-95 transition-transform"><Plus size={32} /></button>
        </div>
        <NavButton active={activeTab === 'fixed'} onClick={() => setActiveTab('fixed')} icon={<Settings size={24} />} label="SET" mobile />
      </nav>
    </div>
  );
}
