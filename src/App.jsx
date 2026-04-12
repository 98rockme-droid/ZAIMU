import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, onSnapshot, query, deleteDoc, where, getDocs, getDoc, orderBy, addDoc, updateDoc, serverTimestamp, documentId } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth';
import { Wallet, CreditCard, Landmark, Plus, Settings, Trash2, History, ChevronLeft, ChevronRight, X, Tags, ArrowLeft, CopyCheck, Calendar, CheckCircle2, BarChart3, TrendingDown, TrendingUp, Banknote, Search, CalendarDays, AlignJustify, Zap, Calculator, LogOut, Lock, User, FileText, Home, Sparkles, ChevronDown, HelpCircle, Pencil } from 'lucide-react';

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

const getMonthString = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const formatMonthJP = (s) => s ? `${s.split('-')[0]}年 ${Number(s.split('-')[1])}月` : "";
const formatDateShort = (i) => i ? `${new Date(i).getMonth() + 1}/${new Date(i).getDate()}` : '';
const formatFullDateJP = (i) => i ? `${new Date(i).getFullYear()}年${new Date(i).getMonth() + 1}月${new Date(i).getDate()}日` : '';
const getTodayString = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const toNumber = (v) => v ? Number(String(v).replace(/,/g, '')) || 0 : 0;
const toISODateSafe = (y) => y ? new Date(`${y}T12:00:00`).toISOString() : new Date().toISOString();

const normalizeMonthlyData = (d = {}) => ({
  salary: d.salary || 0, budget: d.budget || 0, cashBudget: d.cashBudget || 0,
  cardBills: d.cardBills || {}, fixedCosts: d.fixedCosts || [],
  catBudgets: d.catBudgets || {}, cardDueDates: d.cardDueDates || {},
  confirmedPayments: d.confirmedPayments || [], savings: d.savings || 0, memo: d.memo || ''
});

const normalizeConfig = (d) => ({
  categories: d?.categories || [{ name: '食費', icon: '🍔' }],
  paymentMethods: d?.paymentMethods || [CASH], templates: d?.templates || []
});

class ErrorBoundary extends React.Component {
  constructor(p) { super(p); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) return <div className="h-screen w-full bg-[#121212] flex flex-col items-center justify-center p-6 text-center"><h1 className="text-xl font-black text-red-400 mb-4">エラーが発生しました</h1><button onClick={() => window.location.reload()} className="px-8 py-3 bg-white text-black rounded-full font-black">再読み込み</button></div>;
    return this.props.children;
  }
}

const SimpleCard = ({ children, className = "", onClick }) => <div onClick={onClick} className={`bg-[#1E1E1E] rounded-3xl border border-white/5 shadow-xl overflow-hidden w-full ${className}`}>{children}</div>;
const NavButton = ({ active, onClick, icon }) => <button onClick={onClick} className={`flex items-center justify-center w-12 h-12 transition-all ${active ? 'text-white scale-110' : 'text-zinc-600'}`}>{icon}</button>;
const Toast = ({ message, isVisible }) => <div className={`fixed bottom-28 left-1/2 -translate-x-1/2 z-[100] transition-all ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}><div className="bg-zinc-800/90 backdrop-blur-md text-white px-6 py-3 rounded-full border border-white/10 flex items-center gap-2 shadow-2xl"><CheckCircle2 size={16} className="text-emerald-400" /><span className="text-xs font-black tracking-widest">{message}</span></div></div>;
const SettingsRow = ({ left, right, onClick, showChevron = false }) => <button type="button" onClick={onClick} className="w-full flex items-center justify-between px-6 py-5 active:bg-white/5 text-zinc-300 transition-colors"><div className="flex items-center gap-4 text-left font-black text-zinc-200">{left}</div><div className="flex items-center gap-2">{right ? <div className="text-xs font-bold text-zinc-500">{right}</div> : null}{showChevron ? <ChevronRight size={18} className="text-zinc-700" /> : null}</div></button>;

const safeCalculate = (e) => {
  if (!e) return 0;
  try {
    const t = String(e).match(/(\d+(\.\d+)?|[\+\-\*\/])/g); if (!t) return 0;
    let s = []; for (let i = 0; i < t.length; i++) { const k = t[i]; if (k === '*' || k === '/') { const p = parseFloat(s.pop()), n = parseFloat(t[++i]); s.push(k === '*' ? p * n : p / n); } else s.push(k); }
    let r = parseFloat(s[0]); for (let i = 1; i < s.length; i += 2) { const o = s[i], v = parseFloat(s[i + 1]); r = o === '+' ? r + v : r - v; }
    return isNaN(r) ? 0 : r;
  } catch { return 0; }
};

const CalculatorPad = ({ initialValue, onConfirm }) => {
  const [d, setD] = useState(String(initialValue || '0'));
  const [isR, setIsR] = useState(false);
  const push = (v) => { if (isR && !['+', '-', '*', '/'].includes(v)) { setD(String(v)); setIsR(false); } else { setD(p => (p === '0' && v !== '.') ? String(v) : p + v); setIsR(false); } };
  return (
    <div className="w-full flex flex-col gap-4">
      <div className="bg-black/40 rounded-2xl p-4 text-right border border-white/5 font-mono text-3xl text-white break-all tabular-nums">{d}</div>
      <div className="grid grid-cols-4 gap-2 h-72">
        {['C', '/', '*', 'DEL', '7', '8', '9', '-', '4', '5', '6', '+', '1', '2', '3', '=', '0', '.'].map(l => (
          <button key={l} type="button" onClick={() => { if (l === 'C') setD('0'); else if (l === 'DEL') setD(p => p.length > 1 ? p.slice(0, -1) : '0'); else if (l === '=') { setD(String(safeCalculate(d))); setIsR(true); } else push(l); }} className={`rounded-2xl bg-zinc-800 border border-white/5 text-lg font-black active:scale-95 transition-all ${l === '=' ? 'bg-white text-black col-span-1 row-span-2' : 'text-white'}`}>{l}</button>
        ))}
        <button type="button" onClick={() => onConfirm(toNumber(d))} className="col-span-3 h-16 bg-emerald-500 text-black rounded-2xl font-black uppercase tracking-widest active:scale-95 shadow-lg">決定</button>
      </div>
    </div>
  );
};

function AppMain() {
  const [user, setUser] = useState(null); const [authL, setAuthL] = useState(true);
  const [activeTab, setActiveTab] = useState('home'); const [logV, setLogV] = useState('list');
  const [setTab, setSetTab] = useState('menu'); const [month, setMonth] = useState(getMonthString(new Date()));
  const [txs, setTxs] = useState([]); const [lTxs, setLTxs] = useState([]);
  const [mD, setMD] = useState(normalizeMonthlyData()); const [cfg, setCfg] = useState(normalizeConfig());
  const [sTotal, setSTotal] = useState(0); const [vTx, setVTx] = useState(null);
  const [isTM, setIsTM] = useState(false); const [showC, setShowC] = useState(false);
  const [cI, setCI] = useState(0); const [cOC, setCOC] = useState(null);
  const [eTx, setETx] = useState(null); const [eI, setEI] = useState(null);
  const [iD, setID] = useState(getTodayString()); const [iA, setIA] = useState('');
  const [iT, setIT] = useState(''); const [iC, setIC] = useState('');
  const [iM, setIM] = useState(''); const [iS, setIS] = useState(false);
  const [searchText, setSearchText] = useState(''); const [filter, setFilter] = useState({ category: 'ALL', special: false });
  const [toast, setToast] = useState({ v: false, m: '' }); const [isCopyM, setIsCopyM] = useState(false);
  const [cSrc, setCSrc] = useState(''); const [memoT, setMemoT] = useState('');
  const [isMM, setIsMM] = useState(false); const [exF, setExF] = useState(null);
  const [faqS, setFaqS] = useState('');

  const FAQ_DATA = [{ category: '⚙️ 設計図', items: [{ q: '現金残りの計算', a: '(月初現金) － (今月使った現金)' }, { q: '自由な現金', a: '給与 － (先月カード引落 + 固定費現金 + 貯金)' }, { q: '来月着地予想', a: '給与 － (今月カード利用 + 全固定費 + 貯金)' }] }];
  const filteredFaq = useMemo(() => faqS ? FAQ_DATA.map(c => ({ ...c, items: c.items.filter(i => i.q.includes(faqS) || i.a.includes(faqS)) })).filter(c => c.items.length > 0) : FAQ_DATA, [faqS]);

  useEffect(() => onAuthStateChanged(auth, u => { setUser(u); setAuthL(false); }), []);
  useEffect(() => {
    if (!user) return;
    const s = new Date(`${month}-01T00:00:00`).toISOString(), n = new Date(new Date(`${month}-01T00:00:00`).setMonth(new Date(`${month}-01T00:00:00`).getMonth() + 1)).toISOString();
    return onSnapshot(query(collection(db, 'users', user.uid, 'transactions'), where('date', '>=', s), where('date', '<', n)), s => { setTxs(s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => new Date(b.date) - new Date(a.date))); });
  }, [month, user]);
  useEffect(() => {
    if (!user) return;
    onSnapshot(doc(db, 'users', user.uid, 'months', month), s => setMD(normalizeMonthlyData(s.data())));
    onSnapshot(doc(db, 'users', user.uid, 'settings', 'config'), s => s.exists() && setCfg(normalizeConfig(s.data())));
    getDocs(query(collection(db, 'users', user.uid, 'months'), where(documentId(), '<=', month), orderBy(documentId(), 'asc'))).then(s => { let sum = 0; s.forEach(d => sum += Number(d.data().savings || 0)); setSTotal(sum); });
  }, [month, user]);

  const smr = useMemo(() => {
    const fC = mD.fixedCosts || []; const fCash = fC.filter(f => f.method === CASH).reduce((s, i) => s + toNumber(i.amount), 0);
    const fTot = fC.reduce((s, i) => s + toNumber(i.amount), 0); const sal = toNumber(mD.salary), sav = toNumber(mD.savings), cBt = toNumber(mD.cashBudget);
    const bT = Object.values(mD.cardBills).reduce((s, v) => s + toNumber(v), 0); const nTx = txs.filter(t => !t.isSpecial);
    const sCrd = nTx.filter(t => t.paymentMethod !== CASH).reduce((s, t) => s + toNumber(t.amount), 0), sCsh = nTx.filter(t => t.paymentMethod === CASH).reduce((s, t) => s + toNumber(t.amount), 0);
    const cT = Number(mD.budget) || 100000;
    return { cT, sCrd, cPP: Math.min(100, (sCrd / cT) * 100), cBt, sCsh, cRm: cBt - sCsh, cFC: sal - (fCash + bT) - sav, pC: sal - sCrd - fTot - sav, tS: nTx.reduce((s, t) => s + toNumber(t.amount), 0), catT: nTx.reduce((acc, t) => { acc[t.category] = (acc[t.category] || 0) + toNumber(t.amount); return acc; }, {}), daily: nTx.reduce((acc, t) => { acc[new Date(t.date).getDate()] = (acc[new Date(t.date).getDate()] || 0) + toNumber(t.amount); return acc; }, {}) };
  }, [mD, txs]);

  const aiM = useMemo(() => {
    if (smr.tS === 0) return { icon: '📝', text: '記録を始めましょう！', color: 'text-zinc-400', bg: 'bg-white/5', border: 'border-white/10' };
    if (smr.cRm < 0 && smr.cBt > 0) return { icon: '💸', text: '現金がマイナスです！', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' };
    if (smr.pC >= 60000) return { icon: '✨', text: `黄金パターン！利益¥${smr.pC.toLocaleString()}予測！`, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' };
    return { icon: '💡', text: `来月の着地は¥${smr.pC.toLocaleString()}の予測です。`, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' };
  }, [smr]);

  const showT = (m) => { setToast({ v: true, m }); setTimeout(() => setToast({ v: false, m: '' }), 2500); };
  const getCN = () => cfg.categories.map(c => c.name);
  const saveTx = async (e) => { e.preventDefault(); if (!user) return; const p = { date: toISODateSafe(iD), amount: toNumber(iA), title: iT, category: iC, paymentMethod: iM, isSpecial: iS, updatedAt: serverTimestamp() }; if (eTx?.id) await updateDoc(doc(db, 'users', user.uid, 'transactions', eTx.id), p); else await addDoc(collection(db, 'users', user.uid, 'transactions'), { ...p, createdAt: serverTimestamp() }); setIsTM(false); showT('保存完了'); };
  const saveS = async () => { if (!user || !eI) return; const { type, data, index } = eI; try { if (['salary', 'totalBudget', 'cashBudget', 'savings'].includes(type)) { const f = { salary: 'salary', totalBudget: 'budget', cashBudget: 'cashBudget', savings: 'savings' }; await setDoc(doc(db, 'users', user.uid, 'months', month), { [f[type]]: toNumber(data.value) }, { merge: true }); } else if (type === 'bill') { await setDoc(doc(db, 'users', user.uid, 'months', month), { cardBills: { ...mD.cardBills, [data.name]: toNumber(data.bill) }, cardDueDates: { ...mD.cardDueDates, [data.name]: data.due } }, { merge: true }); } else if (type === 'fixed') { let l = [...mD.fixedCosts]; if (index === -1) l.unshift({ ...data, amount: toNumber(data.amount) }); else l[index] = { ...data, amount: toNumber(data.amount) }; await setDoc(doc(db, 'users', user.uid, 'months', month), { fixedCosts: l }, { merge: true }); } else if (type === 'category') { let l = [...cfg.categories]; if (index === -1) l.unshift({ name: data.name, icon: data.icon }); else l[index] = { name: data.name, icon: data.icon }; await setDoc(doc(db, 'users', user.uid, 'settings', 'config'), { ...cfg, categories: l }, { merge: true }); await setDoc(doc(db, 'users', user.uid, 'months', month), { catBudgets: { ...mD.catBudgets, [data.name]: toNumber(data.budget) } }, { merge: true }); } setEI(null); showT('保存完了'); } catch { showT('エラー'); } };

  if (authL) return <div className="h-screen bg-[#121212] flex items-center justify-center text-white font-black">ZAIMU...</div>;
  if (!user) return <div className="h-screen bg-[#121212] flex flex-col items-center justify-center p-8"><Sparkles size={48} className="text-white mb-8" /><h1 className="text-4xl font-black text-white mb-12">ZAIMU</h1><button onClick={() => signInWithPopup(auth, new GoogleAuthProvider())} className="w-full max-w-xs h-16 bg-white text-black rounded-2xl font-black shadow-xl">Googleでログイン</button></div>;

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#121212] text-zinc-200 font-sans pb-32">
        <Toast message={toast.m} isVisible={toast.v} />
        <header className="sticky top-0 z-40 bg-[#121212]/80 backdrop-blur-xl border-b border-white/5 h-20 flex items-center justify-between px-6">
          <div className="flex items-center gap-3"><Sparkles size={20} /><span className="text-lg font-black text-white">ZAIMU</span></div>
          <div className="flex items-center bg-white/5 rounded-full px-2 py-1"><button onClick={() => { const d = new Date(`${month}-01`); d.setMonth(d.getMonth() - 1); setMonth(getMonthString(d)); }}><ChevronLeft size={18} /></button><span className="px-4 text-xs font-black min-w-[100px] text-center">{formatMonthJP(month)}</span><button onClick={() => { const d = new Date(`${month}-01`); d.setMonth(d.getMonth() + 1); setMonth(getMonthString(d)); }}><ChevronRight size={18} /></button></div>
        </header>

        <main className="max-w-xl mx-auto px-6 pt-8 space-y-8">
          {activeTab === 'home' && (
            <div className="space-y-6 animate-in fade-in">
              <div className={`p-5 rounded-[2rem] border ${aiM.border} ${aiM.bg} flex items-start gap-4`}><div className="text-2xl">{aiM.icon}</div><div className={`text-xs font-bold leading-relaxed ${aiM.color}`}>{aiM.text}</div></div>
              <div className="grid grid-cols-2 gap-4"><SimpleCard className="p-6"><div className="text-[10px] font-black text-zinc-500 uppercase mb-1">カード利用額</div><div className="text-2xl font-black text-white mb-4">¥{smr.sCrd.toLocaleString()}</div><div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden"><div className={`h-full ${smr.sCrd > smr.cT ? 'bg-red-500' : 'bg-white'}`} style={{ width: `${smr.cPP}%` }} /></div></SimpleCard><SimpleCard className="p-6"><div className="text-[10px] font-black text-zinc-500 uppercase mb-1">今の現金残り</div><div className={`text-2xl font-black ${smr.cRm < 0 ? 'text-red-400' : 'text-emerald-400'}`}>¥{smr.cRm.toLocaleString()}</div></SimpleCard></div>
              <SimpleCard className="p-6"><div className="grid grid-cols-2 divide-x divide-white/5"><div className="pr-4"><div className="text-[10px] font-black text-zinc-500 uppercase">自由な現金</div><div className="text-xl font-black text-white">¥{smr.cFC.toLocaleString()}</div></div><div className="pl-4 text-right"><div className="text-[10px] font-black text-zinc-500 uppercase">来月末予測</div><div className="text-xl font-black text-white">¥{smr.pC.toLocaleString()}</div></div></div></SimpleCard>
            </div>
          )}

          {activeTab === 'log' && (
            <div className="space-y-6">
              <div className="flex bg-white/5 p-1 rounded-xl w-fit"><button onClick={() => setLogV('list')} className={`px-4 py-2 rounded-lg text-xs font-black ${logV === 'list' ? 'bg-white text-black' : 'text-zinc-500'}`}>リスト</button><button onClick={() => setLogV('calendar')} className={`px-4 py-2 rounded-lg text-xs font-black ${logV === 'calendar' ? 'bg-white text-black' : 'text-zinc-500'}`}>カレンダー</button></div>
              {logV === 'list' ? txs.map(t => (
                <button key={t.id} onClick={() => { setETx(t); setID(isoToLocalYMD(t.date)); setIA(String(t.amount)); setIT(t.title); setIC(t.category); setIM(t.paymentMethod); setIS(t.isSpecial); setIsTM(true); }} className="w-full p-4 bg-white/5 rounded-2xl border border-white/5 flex justify-between items-center"><div className="flex items-center gap-4 text-[10px] font-black text-zinc-500">{formatDateShort(t.date)}<div className="text-left"><div className="text-sm text-white">{t.title}</div>{t.category}</div></div><div className="text-sm font-black text-white">¥{t.amount.toLocaleString()}</div></button>
              )) : (
                <div className="grid grid-cols-7 gap-1">
                  {['日', '月', '火', '水', '木', '金', '土'].map(d => <div key={d} className="text-center text-[10px] font-black text-zinc-600 mb-2">{d}</div>)}
                  {[...Array(new Date(`${month}-01`).getDay()).fill(null), ...Array.from({ length: new Date(month.split('-')[0], month.split('-')[1], 0).getDate() }, (_, i) => i + 1)].map((d, i) => (
                    d ? <button key={i} onClick={() => { setETx(null); setID(`${month}-${String(d).padStart(2, '0')}`); setIA(''); setIT(''); setIsTM(true); }} className={`aspect-square rounded-xl flex flex-col items-center justify-center border ${d === new Date().getDate() && month === getMonthString(new Date()) ? 'bg-white border-white text-black' : 'bg-white/5 border-white/5'}`}><span className="text-[10px] font-black">{d}</span></button> : <div key={i} />
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'analysis' && (
            <div className="space-y-6">
              <SimpleCard className="p-8"><div className="text-[10px] font-black text-zinc-500 uppercase mb-2">総支出</div><div className="text-4xl font-black text-white mb-6">¥{smr.tS.toLocaleString()}</div><div className="flex h-2 w-full rounded-full overflow-hidden bg-white/5">{Object.entries(smr.catT).map(([n, a], i) => (<div key={n} style={{ width: `${(a / smr.tS) * 100}%`, backgroundColor: GRAY_PALETTE[i % 7] }} />))}</div></SimpleCard>
              {Object.entries(smr.catT).sort((a, b) => b[1] - a[1]).map(([n, a], i) => (<div key={n} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl"><span className="text-sm font-black text-white">{n}</span><span className="text-sm font-black text-white">¥{a.toLocaleString()}</span></div>))}
            </div>
          )}

          {activeTab === 'settings' && (
            setTab === 'menu' ? (
              <div className="space-y-4">
                <SimpleCard className="p-6 flex items-center justify-between"><div><div className="text-sm font-black text-white">{user.displayName}</div><div className="text-[10px] text-zinc-500">{user.email}</div></div><button onClick={() => signOut(auth)}><LogOut size={20} /></button></SimpleCard>
                <SimpleCard className="divide-y divide-white/5">
                  <SettingsRow onClick={() => setSetTab('budget')} left="資金計画" />
                  <SettingsRow onClick={() => setSetTab('fixed')} left="固定費管理" />
                  <SettingsRow onClick={() => setSetTab('faq')} left="お金の設計図" />
                </SimpleCard>
              </div>
            ) : (
              <div className="space-y-6">
                <button onClick={() => setSetTab('menu')} className="text-zinc-500 flex items-center gap-2"><ArrowLeft size={16} /> 戻る</button>
                {setTab === 'faq' && filteredFaq.map((s, i) => (<div key={i} className="space-y-4"><h3 className="text-[10px] font-black text-zinc-500 uppercase pl-2">{s.category}</h3>{s.items.map((j, k) => (<SimpleCard key={k} className="p-5" onClick={() => setExF(exF === `${i}-${k}` ? null : `${i}-${k}`)}><div className="flex justify-between font-black text-sm text-zinc-200"><span>{j.q}</span><ChevronDown size={16} className={exF === `${i}-${k}` ? 'rotate-180' : ''} /></div>{exF === `${i}-${k}` && <div className="pt-4 text-xs text-zinc-500 leading-relaxed border-t border-white/5 mt-4">{j.a}</div>}</SimpleCard>))}</div>))}
                {setTab === 'budget' && <SimpleCard className="divide-y divide-white/5"><SettingsRow onClick={() => openE('salary', { value: mD.salary }, 0)} left="手取り給与" right={`¥${Number(mD.salary).toLocaleString()}`} /><SettingsRow onClick={() => openE('totalBudget', { value: mD.budget }, 0)} left="カード利用目安" right={`¥${Number(mD.budget).toLocaleString()}`} /><SettingsRow onClick={() => openE('cashBudget', { value: mD.cashBudget }, 0)} left="月初のスタート現金" right={`¥${Number(mD.cashBudget).toLocaleString()}`} /><SettingsRow onClick={() => openE('savings', { value: mD.savings }, 0)} left="積立額" right={`¥${Number(mD.savings).toLocaleString()}`} /></SimpleCard>}
              </div>
            )
          )}
        </main>

        <footer className="fixed bottom-0 left-0 right-0 z-50 bg-[#121212]/90 backdrop-blur-2xl border-t border-white/5 h-24 flex items-center justify-around px-8 pb-4">
          <NavButton active={activeTab === 'home'} onClick={() => setActiveTab('home')} icon={<Home size={24} />} />
          <NavButton active={activeTab === 'log'} onClick={() => setActiveTab('log')} icon={<History size={24} />} />
          <button onClick={() => { setETx(null); setIA(''); setIT(''); setID(getTodayString()); setIC(getCN()[0]); setIM(CASH); setIsTM(true); }} className="w-14 h-14 bg-white text-black rounded-2xl flex items-center justify-center shadow-2xl active:scale-90 transition-all"><Plus size={28} /></button>
          <NavButton active={activeTab === 'analysis'} onClick={() => setActiveTab('analysis')} icon={<BarChart3 size={24} />} />
          <NavButton active={activeTab === 'settings'} onClick={() => { setActiveTab('settings'); setSetTab('menu'); }} icon={<Settings size={24} />} />
        </footer>

        {isTM && (<div className="fixed inset-0 z-[100] bg-black/90 flex items-end justify-center p-4" onClick={() => setIsTM(false)}><form onSubmit={saveTx} className="w-full max-w-md bg-[#1E1E1E] rounded-[2.5rem] p-8 space-y-6 pb-12" onClick={e => e.stopPropagation()}><div className="flex justify-between items-center"><h2 className="text-xl font-black text-white">{eTx ? '編集' : '入力'}</h2><button onClick={() => setIsTM(false)}><X /></button></div><div className="flex gap-2"><div className="flex-1 bg-white/5 rounded-2xl flex items-center px-4"><span className="text-zinc-500 mr-2">¥</span><input type="text" value={iA ? Number(iA).toLocaleString() : ''} onChange={e => setIA(e.target.value.replace(/,/g, ''))} className="bg-transparent text-xl font-black text-white outline-none w-full" /></div><button type="button" onClick={() => { setCI(iA); setCOC(v => setIA(String(v))); setShowC(true); }} className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center"><Calculator size={20} /></button></div><input value={iT} onChange={e => setIT(e.target.value)} placeholder="内容" className="w-full h-14 bg-white/5 rounded-2xl px-5 text-sm font-black text-white" required /><div className="grid grid-cols-2 gap-4"><select value={iC} onChange={e => setIC(e.target.value)} className="h-14 bg-white/5 rounded-2xl px-4 text-sm font-black text-white">{getCN().map(c => <option key={c} value={c}>{c}</option>)}</select><input type="date" value={iD} onChange={e => setID(e.target.value)} className="h-14 bg-white/5 rounded-2xl px-4 text-sm font-black text-white" /></div><div className="grid grid-cols-2 gap-3">{cfg.paymentMethods.slice(0, 4).map(m => (<button key={m} type="button" onClick={() => setIM(m)} className={`h-12 rounded-xl text-xs font-black ${iM === m ? 'bg-white text-black' : 'bg-white/5 text-zinc-500'}`}>{m}</button>))}</div><button type="submit" className="w-full h-16 bg-white text-black rounded-2xl font-black shadow-xl">保存する</button></form></div>)}
        {showC && (<div className="fixed inset-0 z-[120] bg-black/95 flex items-center justify-center p-6" onClick={() => setShowC(false)}><div className="w-full max-w-xs" onClick={e => e.stopPropagation()}><CalculatorPad initialValue={cI} onConfirm={v => { setCOC(v); setShowC(false); }} /></div></div>)}
        {eI && (<div className="fixed inset-0 z-[100] bg-black/90 flex items-end justify-center p-4" onClick={() => setEI(null)}><div className="w-full max-w-md bg-[#1E1E1E] rounded-[2.5rem] p-8 space-y-6 pb-12" onClick={e => e.stopPropagation()}><div className="flex justify-between items-center font-black text-white mb-4"><h2>編集</h2><button onClick={() => setEI(null)}><X /></button></div><div className="flex gap-2"><div className="flex-1 bg-white/5 rounded-2xl flex items-center px-4"><span className="text-zinc-500 mr-2">¥</span><input value={eI.data.value || ''} onChange={e => setEI({ ...eI, data: { value: e.target.value } })} className="bg-transparent text-xl font-black text-white outline-none w-full" /></div><button onClick={() => { setCI(eI.data.value || 0); setCOC(v => setEI(p => ({ ...p, data: { value: String(v) } }))); setShowC(true); }} className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center"><Calculator size={20} /></button></div><button onClick={saveS} className="w-full h-16 bg-white text-black rounded-2xl font-black shadow-xl">保存</button></div></div>)}
      </div>
    </ErrorBoundary>
  );
}

export default function AppWrapper() { return <ErrorBoundary><AppMain /></ErrorBoundary>; }
