import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import {
  getFirestore, collection, doc, setDoc, onSnapshot, query, deleteDoc,
  where, getDocs, getDoc, orderBy, addDoc, updateDoc, serverTimestamp, documentId
} from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth';
import {
  Wallet, CreditCard, Landmark, Plus, Settings, Trash2, History,
  ChevronLeft, ChevronRight, X, Tags, ArrowLeft, CopyCheck, Calendar,
  BarChart3, TrendingDown, TrendingUp, Search, CalendarDays, AlignJustify,
  Zap, Calculator, LogOut, Lock, User, FileText, Home, ChevronDown,
  HelpCircle, Pencil
} from 'lucide-react';
import {
  ErrorBoundary, Card, Label, Row, Separator, NavButton, Toast, OfflineBanner,
  SettingsRow, CalculatorPad, useConfirm, toNumber,
  EditFormSalaryLike, EditFormMemo, EditFormBill, EditFormSavingsBucket,
  EditFormCategory, EditFormFixed, EditFormTemplate, EditFormPayment
} from './components';

/* --- FIREBASE --- */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_GOOGLE_API_KEY,
  authDomain: 'zaimu-4f79b.firebaseapp.com',
  projectId: 'zaimu-4f79b',
  storageBucket: 'zaimu-4f79b.firebasestorage.app',
  messagingSenderId: '388166181792',
  appId: '1:388166181792:web:d3ccef2742dca358d3bac5'
};
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

/* --- UTILS --- */
const CASH = '現金';
const getMonthString = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const formatMonthJP = s => { if (!s) return ''; const [y, m] = s.split('-'); return `${y}年${Number(m)}月`; };
const formatDateShort = iso => { if (!iso) return ''; const d = new Date(iso); return isNaN(d) ? '' : `${d.getUTCMonth() + 1}/${d.getUTCDate()}`; };
const formatFullDateJP = iso => { if (!iso) return ''; const d = new Date(iso); return isNaN(d) ? '' : `${d.getUTCFullYear()}年${d.getUTCMonth() + 1}月${d.getUTCDate()}日`; };
const getTodayString = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const getTodayLocal = () => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() }; };
const toISODateSafe = s => s ? new Date(`${s}T12:00:00Z`).toISOString() : new Date().toISOString();
const isoToLocalYMD = iso => { if (!iso) return getTodayString(); const d = new Date(iso); return isNaN(d) ? getTodayString() : `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`; };

const getSavingsBuckets = md => {
  if (md?.savingsBuckets?.length) return md.savingsBuckets;
  const n = Number(md?.savings || 0);
  return n > 0 ? [{ id: 'legacy', name: '貯金', amount: n }] : [];
};
const getSavingsTotal = md => getSavingsBuckets(md).reduce((s, b) => s + (Number(b.amount) || 0), 0);
const getPace = (spent, target) => (!target || target <= 0) ? 0 : Math.min(100, (spent / target) * 100);

const normalizeMonthly = (data) => {
  const d = data || {};
  const dues = { ...(d.cardDueDates || {}) }, bills = { ...(d.cardBills || {}) };
  Object.keys(d).forEach(k => {
    if (k.startsWith('cardDueDates.')) dues[k.split('.')[1]] = d[k];
    if (k.startsWith('cardBills.')) bills[k.split('.')[1]] = d[k];
  });
  return { salary: d.salary || 0, budget: d.budget || 0, cashTarget: d.cashTarget || 0, cashBudget: d.cashBudget || 0, cardBills: bills, fixedCosts: d.fixedCosts || [], catBudgets: d.catBudgets || {}, cardDueDates: dues, savings: d.savings || 0, savingsBuckets: d.savingsBuckets || [], memo: d.memo || '' };
};
const normalizeConfig = data => ({ categories: data?.categories || [{ name: '食費' }], paymentMethods: data?.paymentMethods || [CASH], templates: data?.templates || [] });

const GRAYS = ['#F4F4F5', '#D4D4D8', '#A1A1AA', '#71717A', '#52525B', '#3F3F46', '#27272A'];
const catColor = i => GRAYS[i % GRAYS.length];

/* ------------------------------------------------------------------ */
function AppMain() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [activeTab, setActiveTab] = useState('home');
  const [logView, setLogView] = useState('list');
  const [settingTab, setSettingTab] = useState('menu');
  const [month, setMonth] = useState(getMonthString(new Date()));
  const [viewingTx, setViewingTx] = useState(null);
  const [isTxOpen, setIsTxOpen] = useState(false);
  const [showCalc, setShowCalc] = useState(false);
  const [calcInit, setCalcInit] = useState(0);
  const [calcCb, setCalcCb] = useState(null);
  const [toast, setToast] = useState({ visible: false, message: '' });
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [inDate, setInDate] = useState(getTodayString());
  const [inAmount, setInAmount] = useState('');
  const [inTitle, setInTitle] = useState('');
  const [inCat, setInCat] = useState('');
  const [inMethod, setInMethod] = useState('');
  const [inSpecial, setInSpecial] = useState(false);
  const [editingTx, setEditingTx] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [expandedFaq, setExpandedFaq] = useState(null);
  const [faqQ, setFaqQ] = useState('');
  const [txList, setTxList] = useState([]);
  const [prevTxList, setPrevTxList] = useState([]);
  const prevFetchRef = useRef(null);
  const [monthly, setMonthly] = useState(normalizeMonthly({}));
  const [config, setConfig] = useState(normalizeConfig({}));
  const [savingsTotal, setSavingsTotal] = useState(0);
  const [savingsBreakdown, setSavingsBreakdown] = useState({});
  const [searchText, setSearchText] = useState('');
  const [filter, setFilter] = useState({ cat: 'ALL', method: 'ALL', special: false });
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyFrom, setCopyFrom] = useState('');
  const [memoText, setMemoText] = useState('');
  const [memoExpanded, setMemoExpanded] = useState(false);

  const mn = month ? Number(month.split('-')[1]) : new Date().getMonth() + 1;
  const nextMn = mn === 12 ? 1 : mn + 1;

  const catNames = useMemo(() => (config?.categories || []).map(c => c.name), [config?.categories]);
  const methods = useMemo(() => config?.paymentMethods?.length ? config.paymentMethods : [CASH], [config?.paymentMethods]);
  const buckets = useMemo(() => getSavingsBuckets(monthly), [monthly]);

  const FAQ = useMemo(() => [
    { category: '⚙️ 設定タブの金額', items: [
      { q: '手取り給与', a: `家計のベース収入です。「${mn}月の自由な現金」「${nextMn}月の着地予想」の起点になります。` },
      { q: 'クレジットカード利用目安', a: 'カードの使いすぎ防止の目安です。ホーム画面の進捗表示に使われます。' },
      { q: '現金利用目安', a: '現金で使う予定額の目安です。ホーム画面の進捗表示に使われます。' },
      { q: '月初のスタート現金', a: '毎月1日時点の現金実数です。ホーム画面の「現金残高」の計算元になります。' },
      { q: '先取り設定', a: '毎月最初に避けておくお金です。生活費原資・可変費の計算に使われます。' },
      { q: '固定費管理', a: `現金払いの固定費は「${mn}月の自由な現金」から引かれ、全固定費合計は「${nextMn}月の着地予想」に反映されます。` },
      { q: 'カテゴリ予算', a: '使いすぎ防止枠です。分析タブの比較に使われます。' }
    ]},
    { category: '🏠 ホーム画面の見方', items: [
      { q: '今月あと使える可変費', a: '先取りと固定費を除いて、今月あとどれだけ使えるかを表します。' },
      { q: '生活費原資', a: '手取りから先取りを引いた金額です。' },
      { q: '可変費総額', a: '生活費原資から固定費を引いた予算です。' },
      { q: '現金残高', a: '月初の現金から今月の現金支出を引いた残高です。' },
      { q: '先取り累計', a: 'これまで積み上げた先取りの累計額です。' },
      { q: `${nextMn}月の着地予想`, a: '今のペースを続けた場合の来月末残高シミュレーションです。' }
    ]},
    { category: '💡 操作', items: [
      { q: '来月の設定はどうすればいいですか？', a: '設定タブの「先月の設定をコピー」で引き継げます。' },
      { q: 'データのバックアップはできますか？', a: '設定タブの「CSVを書き出す」から全取引データをダウンロードできます。' }
    ]}
  ], [mn, nextMn]);

  const filteredFaq = useMemo(() => {
    if (!faqQ) return FAQ;
    const q = faqQ.toLowerCase();
    return FAQ.map(s => ({ ...s, items: s.items.filter(i => i.q.toLowerCase().includes(q) || i.a.toLowerCase().includes(q)) })).filter(s => s.items.length);
  }, [faqQ, FAQ]);

  const showToast = msg => { setToast({ visible: true, message: msg }); setTimeout(() => setToast({ visible: false, message: '' }), 2500); };
  const openCalc = (init, cb) => { setCalcInit(init); setCalcCb(() => cb); setShowCalc(true); };

  /* --- オフライン --- */
  useEffect(() => {
    const on = () => setIsOffline(false), off = () => setIsOffline(true);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  /* --- AUTH --- */
  useEffect(() => onAuthStateChanged(auth, u => { setUser(u); setAuthLoading(false); }), []);

  /* --- 当月TX --- */
  useEffect(() => {
    if (!user) return;
    const start = new Date(`${month}-01T00:00:00Z`).toISOString();
    const nd = new Date(`${month}-01T00:00:00Z`); nd.setUTCMonth(nd.getUTCMonth() + 1);
    const q = query(collection(db, 'users', user.uid, 'transactions'), where('date', '>=', start), where('date', '<', nd.toISOString()));
    return onSnapshot(q, s => { const l = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => new Date(b.date) - new Date(a.date)); setTxList(l); },
      err => { console.error(err); showToast('データ取得エラー'); });
  }, [month, user]);

  /* --- 先月TX --- */
  useEffect(() => {
    if (!user) return;
    const fm = month; prevFetchRef.current = fm; setPrevTxList([]);
    const pd = new Date(`${month}-01T00:00:00Z`); pd.setUTCMonth(pd.getUTCMonth() - 1);
    const ps = new Date(`${getMonthString(pd)}-01T00:00:00Z`).toISOString();
    const cs = new Date(`${month}-01T00:00:00Z`).toISOString();
    getDocs(query(collection(db, 'users', user.uid, 'transactions'), where('date', '>=', ps), where('date', '<', cs)))
      .then(s => { if (prevFetchRef.current === fm) setPrevTxList(s.docs.map(d => ({ id: d.id, ...d.data() }))); })
      .catch(console.error);
  }, [month, user]);

  /* --- 月次データ --- */
  useEffect(() => {
    if (!user) return;
    return onSnapshot(doc(db, 'users', user.uid, 'months', month), s => setMonthly(normalizeMonthly(s.exists() ? s.data() : {})), console.error);
  }, [month, user]);

  /* --- 設定 --- */
  useEffect(() => {
    if (!user) return;
    return onSnapshot(doc(db, 'users', user.uid, 'settings', 'config'), s => setConfig(normalizeConfig(s.exists() ? s.data() : {})), console.error);
  }, [user]);

  /* --- 先取り累計 --- */
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getDocs(query(collection(db, 'users', user.uid, 'months'), where(documentId(), '<=', month), orderBy(documentId(), 'asc')))
      .then(s => {
        if (cancelled) return;
        let total = 0; const bd = {};
        s.forEach(d => {
          const md = normalizeMonthly(d.data()); total += getSavingsTotal(md);
          getSavingsBuckets(md).forEach(b => { const n = b.name || '未設定'; bd[n] = (bd[n] || 0) + (Number(b.amount) || 0); });
        });
        setSavingsTotal(total); setSavingsBreakdown(bd);
      }).catch(console.error);
    return () => { cancelled = true; };
  }, [user, month, monthly.savingsBuckets, monthly.savings]);

  useEffect(() => setMemoText(monthly?.memo || ''), [monthly?.memo]);

  /* --- SUMMARY --- */
  const S = useMemo(() => {
    const fc = monthly?.fixedCosts || [];
    const fCash = fc.filter(f => !f.method || f.method === CASH).reduce((s, i) => s + (Number(i.amount) || 0), 0);
    const fCard = fc.filter(f => f.method && f.method !== CASH).reduce((s, i) => s + (Number(i.amount) || 0), 0);
    const fTotal = fCash + fCard;
    const salary = Number(monthly?.salary) || 0;
    const cashBudget = Number(monthly?.cashBudget) || 0;
    const bills = Object.values(monthly?.cardBills || {}).reduce((s, v) => s + (Number(v) || 0), 0);
    const norm = txList.filter(t => !t.isSpecial);
    const normPrev = prevTxList.filter(t => !t.isSpecial);
    const spCard = norm.filter(t => t.paymentMethod !== CASH).reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const spCash = norm.filter(t => t.paymentMethod === CASH).reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const spent = norm.reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const cardTarget = Number(monthly?.budget) > 0 ? Number(monthly?.budget) : 100000;
    const cashTarget = Number(monthly?.cashTarget) || 0;
    const savTotal = getSavingsTotal(monthly);
    const lifeBudget = salary - savTotal;
    const varBudget = lifeBudget - fTotal;
    const varRemain = varBudget - spent;
    const cats = norm.reduce((a, t) => { const c = t.category || '未分類'; a[c] = (a[c] || 0) + (Number(t.amount) || 0); return a; }, {});
    const catBudSum = (config?.categories || []).reduce((s, c) => s + (monthly?.catBudgets?.[c.name] || 0), 0);
    const spSpecial = txList.filter(t => t.isSpecial).reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const spSpecialPrev = prevTxList.filter(t => t.isSpecial).reduce((s, t) => s + (Number(t.amount) || 0), 0);
    return {
      cardTarget, cashTarget,
      cardPace: getPace(spCard, cardTarget), cashPace: getPace(spCash, cashTarget),
      cashRemain: cashBudget - spCash, projCash: salary - spCard - fTotal - savTotal,
      fTotal, fCash, fCard, catBudSum, savTotal, lifeBudget, varBudget, varRemain,
      cats, spent, prevSpent: normPrev.reduce((s, t) => s + (Number(t.amount) || 0), 0),
      spCard, spCash,
      daily: norm.reduce((a, t) => { if (!t.date) return a; const d = new Date(t.date); if (isNaN(d)) return a; a[d.getUTCDate()] = (a[d.getUTCDate()] || 0) + (Number(t.amount) || 0); return a; }, {}),
      spSpecial, spSpecialPrev
    };
  }, [monthly, txList, prevTxList, config]);

  const activeCats = useMemo(() => catNames.filter(n => (monthly.catBudgets?.[n] || 0) > 0 || (S.cats[n] || 0) > 0), [catNames, monthly.catBudgets, S.cats]);

  const donut = useMemo(() => {
    if (S.spent === 0) return { items: [], total: 0 };
    const cp = { ...S.cats }; const other = cp['その他'] || 0; delete cp['その他'];
    const arr = Object.entries(cp).map(([n, a]) => ({ n, a })).filter(x => x.a > 0).sort((a, b) => b.a - a.a);
    let items = [];
    if (arr.length + (other > 0 ? 1 : 0) <= 6) {
      items = arr.map((x, i) => ({ name: x.n, amount: x.a, color: catColor(i) }));
      if (other > 0) items.push({ name: 'その他', amount: other, color: catColor(items.length) });
    } else {
      items = arr.slice(0, 5).map((x, i) => ({ name: x.n, amount: x.a, color: catColor(i) }));
      const rest = arr.slice(5).reduce((s, x) => s + x.a, 0) + other;
      if (rest > 0) items.push({ name: 'その他', amount: rest, color: catColor(5) });
    }
    return { items, total: S.spent };
  }, [S.spent, S.cats]);

  const bdList = useMemo(() => Object.entries(savingsBreakdown).sort((a, b) => b[1] - a[1]), [savingsBreakdown]);

  const filteredTx = useMemo(() => txList.filter(t => {
    const ms = searchText === '' || String(t.title || '').includes(searchText);
    const mc = filter.cat === 'ALL' || t.category === filter.cat;
    const mm = filter.method === 'ALL' || t.paymentMethod === filter.method;
    const msp = !filter.special || t.isSpecial === true;
    return ms && mc && mm && msp;
  }), [txList, searchText, filter]);

  const filtCash = useMemo(() => filteredTx.filter(t => t.paymentMethod === CASH).reduce((s, t) => s + toNumber(t.amount), 0), [filteredTx]);
  const filtCard = useMemo(() => filteredTx.filter(t => t.paymentMethod !== CASH).reduce((s, t) => s + toNumber(t.amount), 0), [filteredTx]);

  const calDays = useMemo(() => {
    if (!month) return [];
    const d = new Date(month + '-01T00:00:00Z');
    if (isNaN(d)) return [];
    const first = d.getUTCDay(), last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    return [...Array(first).fill(null), ...Array.from({ length: last }, (_, i) => i + 1)];
  }, [month]);

  /* --- TX ops --- */
  const resetInputs = useCallback((dateStr) => {
    setInDate(dateStr || getTodayString()); setInAmount(''); setInTitle('');
    setInCat(catNames[0] || '食費'); setInMethod(methods[0] || CASH); setInSpecial(false);
  }, [catNames, methods]);

  const startEdit = t => { setEditingTx(t); setInDate(isoToLocalYMD(t.date)); setInAmount(String(t.amount ?? '')); setInTitle(t.title || ''); setInCat(t.category || catNames[0] || '食費'); setInMethod(t.paymentMethod || CASH); setInSpecial(t.isSpecial === true); setIsTxOpen(true); };
  const openNew = () => { setEditingTx(null); resetInputs(); setIsTxOpen(true); };
  const openWithDate = d => { setEditingTx(null); resetInputs(d); setIsTxOpen(true); };
  const closeTx = useCallback(() => { setIsTxOpen(false); setEditingTx(null); }, []);
  const applyTpl = t => { setInAmount(String(t.amount)); setInTitle(t.title); setInCat(t.category); setInMethod(t.method); };

  const submitTx = async e => {
    e.preventDefault(); if (!user) return;
    const amount = toNumber(inAmount);
    if (!inDate || !amount || !inTitle) return showToast('入力内容を確認してください');
    const payload = { date: toISODateSafe(inDate), amount, title: inTitle, category: inCat, paymentMethod: inMethod, isSpecial: inSpecial, updatedAt: serverTimestamp() };
    try {
      if (editingTx?.id) { await updateDoc(doc(db, 'users', user.uid, 'transactions', editingTx.id), payload); showToast('更新しました'); }
      else { await addDoc(collection(db, 'users', user.uid, 'transactions'), { ...payload, createdAt: serverTimestamp() }); showToast('追加しました'); }
      closeTx();
    } catch (e) { console.error(e); showToast('エラー'); }
  };

  /* --- Settings ops --- */
  const openEdit = (type, data, index) => setEditingItem({ type, data: { ...data }, index });

  const saveSettings = async () => {
    if (!user || !editingItem) return;
    const { type, data, index } = editingItem;
    try {
      const mRef = doc(db, 'users', user.uid, 'months', month);
      const cRef = doc(db, 'users', user.uid, 'settings', 'config');
      if (['salary', 'totalBudget', 'cashTarget', 'cashBudget'].includes(type)) {
        const fm = { salary: 'salary', totalBudget: 'budget', cashTarget: 'cashTarget', cashBudget: 'cashBudget' };
        await setDoc(mRef, { [fm[type]]: toNumber(data.value) }, { merge: true });
      } else if (type === 'memo') {
        await setDoc(mRef, { memo: data.memo || '' }, { merge: true });
      } else if (type === 'bill') {
        await setDoc(mRef, { cardBills: { ...(monthly.cardBills || {}), [data.name]: toNumber(data.bill) }, cardDueDates: { ...(monthly.cardDueDates || {}), [data.name]: data.due } }, { merge: true });
      } else if (type === 'savingsBucket') {
        const list = [...buckets]; const item = { id: data.id || `sb_${Date.now()}`, name: data.name || '', amount: toNumber(data.amount) };
        if (index === -1) list.unshift(item); else list[index] = item;
        await setDoc(mRef, { savingsBuckets: list, savings: list.reduce((s, b) => s + (Number(b.amount) || 0), 0) }, { merge: true });
      } else if (type === 'fixed') {
        const list = [...(monthly.fixedCosts || [])], item = { ...data, amount: toNumber(data.amount) };
        if (index === -1) list.unshift({ ...item, id: Date.now() }); else list[index] = { ...list[index], ...item };
        await setDoc(mRef, { fixedCosts: list }, { merge: true });
      } else if (type === 'category') {
        const list = [...(config.categories || [])];
        if (index === -1) list.unshift({ name: data.name }); else list[index] = { name: data.name };
        await setDoc(cRef, { ...config, categories: list }, { merge: true });
        if (data.budget !== undefined) await setDoc(mRef, { catBudgets: { ...(monthly.catBudgets || {}), [data.name]: toNumber(data.budget) } }, { merge: true });
      } else if (type === 'template') {
        const list = [...(config.templates || [])], item = { ...data, amount: toNumber(data.amount) };
        if (index === -1) list.unshift(item); else list[index] = item;
        await setDoc(cRef, { ...config, templates: list }, { merge: true });
      } else if (type === 'payment') {
        const list = [...(config.paymentMethods || [CASH])];
        if (index === -1) list.unshift(data.name); else list[index] = data.name;
        await setDoc(cRef, { ...config, paymentMethods: list }, { merge: true });
      }
      setEditingItem(null); showToast('保存しました');
    } catch (e) { console.error(e); showToast('エラー'); }
  };

  const deleteItem = async () => {
    if (!editingItem) return;
    const ok = await confirm({ title: '削除しますか？', message: 'この操作は取り消せません。', confirmLabel: '削除する', danger: true });
    if (!ok) return;
    const { type, index, data } = editingItem;
    const mRef = doc(db, 'users', user.uid, 'months', month);
    const cRef = doc(db, 'users', user.uid, 'settings', 'config');
    try {
      if (type === 'fixed') await setDoc(mRef, { fixedCosts: (monthly.fixedCosts || []).filter((_, i) => i !== index) }, { merge: true });
      else if (type === 'category') await setDoc(cRef, { ...config, categories: (config.categories || []).filter((_, i) => i !== index) }, { merge: true });
      else if (type === 'template') await setDoc(cRef, { ...config, templates: (config.templates || []).filter((_, i) => i !== index) }, { merge: true });
      else if (type === 'payment') await setDoc(cRef, { ...config, paymentMethods: (config.paymentMethods || []).filter((_, i) => i !== index) }, { merge: true });
      else if (type === 'bill') {
        const nb = { ...(monthly.cardBills || {}) }, nd = { ...(monthly.cardDueDates || {}) };
        delete nb[data.name]; delete nd[data.name];
        await setDoc(mRef, { cardBills: nb, cardDueDates: nd }, { merge: true });
      } else if (type === 'savingsBucket') {
        const list = buckets.filter((_, i) => i !== index);
        await setDoc(mRef, { savingsBuckets: list, savings: list.reduce((s, b) => s + (Number(b.amount) || 0), 0) }, { merge: true });
      }
      setEditingItem(null); showToast('削除しました');
    } catch (e) { console.error(e); showToast('エラー'); }
  };

  const copySetting = async () => {
    const ok = await confirm({ title: '設定をコピーしますか？', message: `${formatMonthJP(copyFrom)} → ${formatMonthJP(month)}`, confirmLabel: '実行する' });
    if (!ok) return;
    try {
      const snap = await getDoc(doc(db, 'users', user.uid, 'months', copyFrom));
      if (snap.exists()) {
        const d = snap.data();
        await setDoc(doc(db, 'users', user.uid, 'months', month), { salary: d.salary || 0, budget: d.budget || 0, cashTarget: d.cashTarget || 0, cashBudget: d.cashBudget || 0, fixedCosts: d.fixedCosts || [], catBudgets: d.catBudgets || {}, cardBills: d.cardBills || {}, cardDueDates: d.cardDueDates || {}, savings: d.savings || 0, savingsBuckets: d.savingsBuckets || [] }, { merge: true });
        showToast('コピーしました'); setCopyOpen(false);
      } else showToast('データがありません');
    } catch { showToast('エラー'); }
  };

  const exportCSV = async () => {
    const ok = await confirm({ title: 'CSV出力しますか？', confirmLabel: 'ダウンロード' });
    if (!ok) return;
    const s = await getDocs(query(collection(db, 'users', user.uid, 'transactions'), orderBy('date', 'desc')));
    let csv = '\uFEFF日付,タイトル,カテゴリ,金額,支払方法\n';
    s.forEach(d => { const v = d.data(); csv += `${isoToLocalYMD(v.date)},"${v.title}",${v.category},${v.amount},${v.paymentMethod}\n`; });
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a'); a.href = url; a.download = `zaimu_${getTodayString()}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  /* --- RENDER --- */
  if (authLoading) return <div className="h-screen bg-black flex items-center justify-center text-[#8E8E93] text-[14px]">読み込み中...</div>;

  if (!user) return (
    <div className="h-screen w-full bg-black flex flex-col items-center justify-center p-8 gap-10">
      <h1 className="text-[32px] font-semibold tracking-tight text-white">ZAIMU</h1>
      <button onClick={() => signInWithPopup(auth, new GoogleAuthProvider())}
        className="w-full max-w-xs h-12 bg-white text-black rounded-xl font-semibold text-[15px] flex items-center justify-center gap-2.5 active:scale-[0.98] transition-all">
        <Lock size={15} /> Googleでログイン
      </button>
    </div>
  );

  const MENU = [
    { id: 'budget', label: '資金計画', icon: <Landmark size={17} /> },
    { id: 'fixed', label: '固定費管理', icon: <CreditCard size={17} /> },
    { id: 'category', label: 'カテゴリ予算', icon: <Tags size={17} /> },
    { id: 'template', label: 'テンプレート', icon: <Zap size={17} /> },
    { id: 'payment', label: '支払方法', icon: <Wallet size={17} /> },
    { id: 'faq', label: 'ヘルプ・FAQ', icon: <HelpCircle size={17} /> },
  ];
  const menuTitle = MENU.find(m => m.id === settingTab)?.label || '設定';
  const varPct = S.varBudget > 0 ? Math.min(100, (S.spent / S.varBudget) * 100) : 0;
  const today = getTodayLocal();

  // 共通モーダルラッパー
  const Modal = ({ children, onClose, zIndex = 'z-[65]' }) => (
    <div className={`fixed inset-0 ${zIndex} flex items-end sm:items-center justify-center sm:p-4 bg-black/50 backdrop-blur-sm`} onClick={onClose}>
      <div className="w-full sm:max-w-md bg-[#1C1C1E] rounded-t-3xl sm:rounded-3xl border border-white/[0.08] shadow-2xl flex flex-col overflow-hidden max-h-[92vh]" onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );

  const ModalHeader = ({ title, onClose }) => (
    <div className="flex-none px-5 py-4 flex items-center justify-between border-b border-white/[0.06]">
      <span className="text-[16px] font-semibold text-white">{title}</span>
      <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-[#2C2C2E] text-[#8E8E93]"><X size={15} /></button>
    </div>
  );

  return (
    <div className="fixed inset-0 w-full bg-black text-white font-sans flex flex-col overflow-hidden">
      {confirmDialog}
      <Toast message={toast.message} isVisible={toast.visible} />
      <OfflineBanner isOffline={isOffline} />

      <div className="w-full max-w-md h-full flex flex-col bg-black mx-auto relative">

        {/* HEADER */}
        <header className="flex-none h-14 px-4 flex items-center justify-between bg-black/90 backdrop-blur-xl border-b border-white/[0.06] z-50">
          {activeTab === 'settings' && settingTab !== 'menu' ? (
            <>
              <button onClick={() => setSettingTab('menu')} className="p-2 text-[#8E8E93]"><ArrowLeft size={18} /></button>
              <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center">
                <span className="text-[14px] font-semibold text-white">{menuTitle}</span>
                {(settingTab === 'fixed' || settingTab === 'category') && <span className="text-[11px] text-[#8E8E93]">¥{(settingTab === 'fixed' ? S.fTotal : S.catBudSum).toLocaleString()}</span>}
              </div>
              <div className="w-10" />
            </>
          ) : (
            <>
              <div className="w-8" />
              <div className="flex items-center gap-0.5">
                <button onClick={() => { const d = new Date(month + '-01T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() - 1); setMonth(getMonthString(d)); }} className="p-2 text-[#8E8E93]"><ChevronLeft size={16} /></button>
                <span className="text-[14px] font-semibold text-white min-w-[96px] text-center tabular-nums">{formatMonthJP(month)}</span>
                <button onClick={() => { const d = new Date(month + '-01T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() + 1); setMonth(getMonthString(d)); }} className="p-2 text-[#8E8E93]"><ChevronRight size={16} /></button>
              </div>
              <button onClick={() => setMonth(getMonthString(new Date()))} className="p-2 text-[#8E8E93]"><Calendar size={16} /></button>
            </>
          )}
        </header>

        <main className="flex-1 flex flex-col overflow-hidden">

          {/* ====== HOME ====== */}
          {activeTab === 'home' && (
            <div className="flex-1 overflow-y-auto scrollbar-hide pb-28">
              {monthly.memo && (
                <button onClick={() => setMemoExpanded(!memoExpanded)} className="w-full px-4 py-3 flex items-start gap-3 text-left border-b border-white/[0.06] bg-[#1C1C1E]/60">
                  <span className="text-[13px] mt-0.5 shrink-0">📌</span>
                  <span className={`flex-1 text-[12px] text-[#8E8E93] leading-relaxed ${memoExpanded ? 'whitespace-pre-wrap' : 'truncate'}`}>{monthly.memo}</span>
                  <ChevronDown size={13} className={`text-[#48484A] shrink-0 mt-0.5 transition-transform ${memoExpanded ? 'rotate-180' : ''}`} />
                </button>
              )}

              <div className="px-4 pt-5 space-y-6">
                {/* 今月カード */}
                <div>
                  <Label>今月</Label>
                  <Card>
                    <div className="px-5 pt-5 pb-4">
                      <p className="text-[11px] text-[#8E8E93] mb-1.5">今月あと使える可変費</p>
                      <p className={`text-[34px] font-semibold tracking-tight leading-none ${S.varRemain < 0 ? 'text-[#FF453A]' : 'text-white'}`}>
                        ¥{S.varRemain.toLocaleString()}
                      </p>
                    </div>
                    <div className="divide-y divide-white/[0.06]">
                      <Row label="手取り給与" value={`¥${Number(monthly.salary || 0).toLocaleString()}`} />
                      <Row label="先取り合計" value={`−¥${S.savTotal.toLocaleString()}`} muted />
                      <Separator />
                      <Row label="生活費原資" value={`¥${S.lifeBudget.toLocaleString()}`} muted indent />
                      <Row label="固定費合計" value={`−¥${S.fTotal.toLocaleString()}`} muted />
                      <Separator />
                      <Row label="可変費総額" value={`¥${S.varBudget.toLocaleString()}`} accent />
                      <Row label="通常支出" value={`−¥${S.spent.toLocaleString()}`} muted />
                    </div>
                    {buckets.length > 0 && (
                      <div className="px-5 py-4 border-t border-white/[0.06]">
                        <p className="text-[11px] text-[#8E8E93] mb-3">先取り内訳（今月）</p>
                        <div className="space-y-2">
                          {buckets.map(b => (
                            <div key={b.id} className="flex items-center justify-between">
                              <span className="text-[13px] text-[#8E8E93]">{b.name}</span>
                              <span className="text-[13px] text-white tabular-nums">¥{Number(b.amount || 0).toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </Card>
                </div>

                {/* 進捗カード */}
                <div>
                  <Label>進捗</Label>
                  <Card>
                    <div className="px-5 py-4 space-y-4">
                      {[
                        { label: '可変費', spent: S.spent, target: S.varBudget, pace: varPct, over: S.varRemain < 0 },
                        { label: 'カード', spent: S.spCard, target: S.cardTarget, pace: S.cardPace, over: S.spCard > S.cardTarget },
                        { label: '現金', spent: S.spCash, target: S.cashTarget, pace: S.cashPace, over: S.cashTarget > 0 && S.spCash > S.cashTarget, noTarget: S.cashTarget === 0 },
                      ].map(({ label, spent, target, pace, over, noTarget }) => (
                        <div key={label}>
                          <div className="flex justify-between text-[11px] text-[#8E8E93] mb-1.5">
                            <span>{label}</span>
                            <span className="tabular-nums">{noTarget ? `¥${spent.toLocaleString()} / 未設定` : `¥${spent.toLocaleString()} / ¥${target.toLocaleString()}`}</span>
                          </div>
                          <div className="h-1 bg-white/[0.08] rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-700 ${over ? 'bg-[#FF453A]' : 'bg-white/60'}`} style={{ width: `${pace}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="divide-y divide-white/[0.06]">
                      <Row label="現金残高" value={`¥${S.cashRemain.toLocaleString()}`} danger={S.cashRemain < 0} />
                      <Row label={`${nextMn}月の着地予想`} value={`¥${S.projCash.toLocaleString()}`} />
                      <Row label="先取り累計" value={`¥${Number(savingsTotal || 0).toLocaleString()}`} />
                    </div>
                  </Card>
                </div>
              </div>
            </div>
          )}

          {/* ====== LOG ====== */}
          {activeTab === 'log' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-none px-4 pt-3 pb-2 space-y-2">
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <input value={searchText} onChange={e => setSearchText(e.target.value)} placeholder="検索..."
                      className="w-full h-10 bg-[#1C1C1E] border border-white/[0.06] rounded-xl pl-9 pr-3 text-[13px] text-white outline-none placeholder-[#48484A]" />
                    <Search size={14} className="absolute left-3 top-3 text-[#48484A]" />
                  </div>
                  <div className="flex bg-[#1C1C1E] border border-white/[0.06] rounded-xl p-1 gap-0.5">
                    {[['list', <AlignJustify size={14} />], ['calendar', <CalendarDays size={14} />]].map(([v, icon]) => (
                      <button key={v} onClick={() => setLogView(v)} className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${logView === v ? 'bg-white/10 text-white' : 'text-[#48484A]'}`}>{icon}</button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  {[['cat', filter.cat, catNames, 'ALL'], ['method', filter.method, methods, 'ALL']].map(([key, val, opts, all]) => (
                    <div key={key} className="flex-1 relative">
                      <select value={val} onChange={e => setFilter(p => ({ ...p, [key]: e.target.value }))}
                        className="w-full h-9 bg-[#1C1C1E] border border-white/[0.06] rounded-xl pl-3 pr-7 text-[12px] text-white outline-none appearance-none">
                        <option value={all}>すべて</option>
                        {opts.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                      <ChevronDown size={12} className="absolute right-2.5 top-[10px] text-[#48484A] pointer-events-none" />
                    </div>
                  ))}
                  <button onClick={() => setFilter(p => ({ ...p, special: !p.special }))} className={`h-9 px-3 rounded-xl text-[12px] font-medium transition-colors ${filter.special ? 'bg-white text-black' : 'bg-[#1C1C1E] text-[#8E8E93] border border-white/[0.06]'}`}>特別費</button>
                  <button onClick={() => { setSearchText(''); setFilter({ cat: 'ALL', method: 'ALL', special: false }); }} className="w-9 h-9 bg-[#1C1C1E] border border-white/[0.06] rounded-xl flex items-center justify-center text-[#48484A]"><X size={14} /></button>
                </div>
                <div className="flex justify-between text-[11px] text-[#48484A] px-1">
                  <span>合計</span>
                  <div className="flex gap-3 tabular-nums">
                    <span>現金 ¥{filtCash.toLocaleString()}</span>
                    <span>カード ¥{filtCard.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="flex-1 px-4 pb-20 overflow-hidden flex flex-col">
                {logView === 'list' ? (
                  <Card className="flex-1 flex flex-col overflow-hidden">
                    {filteredTx.length === 0 ? (
                      <div className="flex-1 flex items-center justify-center text-[13px] text-[#48484A]">履歴がありません</div>
                    ) : (
                      <div className="flex-1 overflow-y-auto divide-y divide-white/[0.06] scrollbar-hide">
                        {filteredTx.map(t => (
                          <div key={t.id} onClick={() => setViewingTx(t)} className="flex items-center gap-3 px-4 py-3 active:bg-white/[0.03] transition-colors">
                            <div className="flex flex-col items-center w-8 shrink-0">
                              <span className="text-[10px] text-[#48484A] leading-none">{formatDateShort(t.date).split('/')[0]}</span>
                              <span className="text-[13px] font-medium text-[#8E8E93] leading-none mt-0.5">{formatDateShort(t.date).split('/')[1]}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[14px] font-medium text-white truncate">{t.title}</p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-[11px] text-[#48484A]">{t.category}</span>
                                {t.isSpecial && <><span className="text-[#48484A]">·</span><span className="text-[11px] text-[#8E8E93]">特別費</span></>}
                                <span className="text-[#48484A]">·</span>
                                <span className="text-[11px] text-[#48484A]">{t.paymentMethod}</span>
                              </div>
                            </div>
                            <span className="text-[14px] font-semibold text-white tabular-nums shrink-0">¥{Number(t.amount || 0).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                ) : (
                  <Card className="flex-1 flex flex-col overflow-hidden p-4">
                    <div className="grid grid-cols-7 text-center mb-2">
                      {['日','月','火','水','木','金','土'].map(d => <span key={d} className="text-[10px] text-[#48484A]">{d}</span>)}
                    </div>
                    <div className="flex-1 overflow-y-auto scrollbar-hide">
                      <div className="grid grid-cols-7 gap-y-1">
                        {calDays.map((day, i) => {
                          if (!day) return <div key={i} className="h-14" />;
                          const amt = S.daily[day] || 0;
                          const cy = Number(month.split('-')[0]), cm = Number(month.split('-')[1]);
                          const isToday = day === today.d && cm === today.m && cy === today.y;
                          return (
                            <button key={i} onClick={() => openWithDate(`${month}-${String(day).padStart(2, '0')}`)}
                              className="h-14 flex flex-col items-center justify-start pt-1 rounded-xl active:bg-white/[0.04] transition-colors">
                              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-medium ${isToday ? 'bg-white text-black' : 'text-[#8E8E93]'}`}>{day}</span>
                              {amt > 0 && <span className="text-[9px] text-[#48484A] mt-0.5 tabular-nums">¥{(amt / 1000).toFixed(0)}k</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </Card>
                )}
              </div>
            </div>
          )}

          {/* ====== ANALYSIS ====== */}
          {activeTab === 'analysis' && (
            <div className="flex-1 overflow-y-auto scrollbar-hide px-4 pt-5 pb-28 space-y-5">
              <Card>
                <div className="p-5 space-y-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] text-[#8E8E93] mb-1.5">通常支出</p>
                      <p className="text-[32px] font-semibold text-white tracking-tight leading-none">¥{S.spent.toLocaleString()}</p>
                    </div>
                    <div className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-medium ${S.spent <= S.prevSpent ? 'bg-[#30D158]/10 text-[#30D158]' : 'bg-[#FF453A]/10 text-[#FF453A]'}`}>
                      {S.spent <= S.prevSpent ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
                      {S.spent <= S.prevSpent ? '-' : '+'}¥{Math.abs(S.spent - S.prevSpent).toLocaleString()}
                    </div>
                  </div>
                  {donut.total > 0 ? (
                    <div className="space-y-4">
                      <div className="flex w-full h-2 rounded-full overflow-hidden gap-px">
                        {donut.items.map(item => <div key={item.name} className="h-full" style={{ width: `${(item.amount / donut.total) * 100}%`, backgroundColor: item.color }} />)}
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                        {donut.items.map(item => (
                          <div key={item.name} className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                            <span className="text-[12px] text-[#8E8E93] truncate flex-1">{item.name}</span>
                            <span className="text-[12px] font-medium text-white tabular-nums">¥{item.amount.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : <p className="text-[13px] text-[#48484A] text-center py-6">データがありません</p>}
                </div>
              </Card>

              <Card>
                <div className="divide-y divide-white/[0.06]">
                  <Row label="可変費総額" value={`¥${S.varBudget.toLocaleString()}`} />
                  <Row label="通常支出" value={`¥${S.spent.toLocaleString()}`} />
                  <Row label="可変費残り" value={`¥${S.varRemain.toLocaleString()}`} danger={S.varRemain < 0} />
                </div>
              </Card>

              <Card>
                <div className="divide-y divide-white/[0.06]">
                  <Row label="カード支出" value={`¥${S.spCard.toLocaleString()}`} />
                  <Row label="現金支出" value={`¥${S.spCash.toLocaleString()}`} />
                  <Row label="固定費合計" value={`¥${S.fTotal.toLocaleString()}`} />
                  <Row label="今月の先取り" value={`¥${S.savTotal.toLocaleString()}`} />
                </div>
              </Card>

              {activeCats.length > 0 && (
                <div>
                  <Label>カテゴリ予算</Label>
                  <Card>
                    <div className="divide-y divide-white/[0.06]">
                      {activeCats.map(n => {
                        const cur = S.cats[n] || 0, bud = monthly.catBudgets?.[n] || 0;
                        const over = bud > 0 && cur > bud, pct = bud > 0 ? Math.min(100, cur / bud * 100) : 0;
                        return (
                          <div key={n} className="px-4 py-3.5">
                            <div className="flex justify-between mb-2">
                              <span className="text-[14px] text-white">{n}</span>
                              <span className={`text-[13px] font-medium tabular-nums ${over ? 'text-[#FF453A]' : 'text-[#8E8E93]'}`}>¥{cur.toLocaleString()} / ¥{bud.toLocaleString()}</span>
                            </div>
                            <div className="h-1 bg-white/[0.08] rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${over ? 'bg-[#FF453A]' : 'bg-white/50'}`} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                </div>
              )}

              {S.spSpecial > 0 && (
                <Card className="p-5">
                  <p className="text-[11px] text-[#8E8E93] mb-2">特別費（別枠）</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-[22px] font-semibold text-white tabular-nums">¥{S.spSpecial.toLocaleString()}</span>
                    <span className="text-[12px] text-[#48484A]">先月 ¥{S.spSpecialPrev.toLocaleString()}</span>
                  </div>
                </Card>
              )}
            </div>
          )}

          {/* ====== SETTINGS ====== */}
          {activeTab === 'settings' && (
            <div className="flex-1 overflow-y-auto scrollbar-hide px-4 pt-5 pb-28 space-y-5">
              {settingTab === 'menu' && (
                <>
                  <div className="flex items-center gap-3.5 p-4 bg-[#1C1C1E] rounded-2xl border border-white/[0.06]">
                    {user.photoURL ? <img src={user.photoURL} referrerPolicy="no-referrer" alt="" className="w-10 h-10 rounded-xl" /> : <div className="w-10 h-10 rounded-xl bg-[#2C2C2E] flex items-center justify-center"><User size={16} className="text-[#8E8E93]" /></div>}
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-medium text-white truncate">{user.displayName || 'User'}</p>
                      <p className="text-[12px] text-[#8E8E93] truncate">{user.email}</p>
                    </div>
                    <button onClick={async () => { const ok = await confirm({ title: 'ログアウトしますか？', confirmLabel: 'ログアウト', danger: true }); if (ok) signOut(auth); }}
                      className="w-9 h-9 bg-[#FF453A]/10 text-[#FF453A] rounded-xl flex items-center justify-center shrink-0"><LogOut size={15} /></button>
                  </div>

                  <div>
                    <Label>メニュー</Label>
                    <Card>
                      <div className="divide-y divide-white/[0.06]">
                        {MENU.map(item => (
                          <SettingsRow key={item.id} onClick={() => setSettingTab(item.id)}
                            left={<div className="flex items-center gap-3"><span className="text-[#8E8E93]">{item.icon}</span><span>{item.label}</span></div>}
                            showChevron />
                        ))}
                      </div>
                    </Card>
                  </div>

                  <div className="space-y-3 pt-1">
                    <button onClick={() => { const d = new Date(month + '-01T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() - 1); setCopyFrom(getMonthString(d)); setCopyOpen(true); }}
                      className="w-full h-12 bg-[#1C1C1E] border border-white/[0.06] text-white rounded-xl text-[14px] font-medium flex items-center justify-center gap-2">
                      <CopyCheck size={15} className="text-[#8E8E93]" /> 先月の設定をコピー
                    </button>
                    <button onClick={exportCSV} className="w-full flex items-center justify-center gap-2 text-[13px] text-[#8E8E93] py-2">
                      <FileText size={13} /> CSVを書き出す
                    </button>
                  </div>
                </>
              )}

              {settingTab === 'faq' && (
                <div className="space-y-4">
                  <div className="relative">
                    <input value={faqQ} onChange={e => setFaqQ(e.target.value)} placeholder="検索..."
                      className="w-full h-11 bg-[#1C1C1E] border border-white/[0.06] rounded-xl pl-9 pr-4 text-[13px] text-white outline-none placeholder-[#48484A]" />
                    <Search size={14} className="absolute left-3 top-3.5 text-[#48484A]" />
                    {faqQ && <button onClick={() => setFaqQ('')} className="absolute right-3 top-3 text-[#48484A]"><X size={14} /></button>}
                  </div>
                  {filteredFaq.length > 0 ? filteredFaq.map((sec, si) => (
                    <div key={si}>
                      <Label>{sec.category}</Label>
                      <Card>
                        <div className="divide-y divide-white/[0.06]">
                          {sec.items.map((item, ii) => (
                            <div key={ii} onClick={() => setExpandedFaq(expandedFaq === `${si}-${ii}` ? null : `${si}-${ii}`)} className="px-4 py-3.5 cursor-pointer">
                              <div className="flex justify-between items-start gap-3">
                                <div className="flex items-start gap-2.5"><HelpCircle size={14} className="text-[#48484A] mt-0.5 shrink-0" /><span className="text-[13px] text-white leading-snug">{item.q}</span></div>
                                <ChevronDown size={14} className={`text-[#48484A] transition-transform shrink-0 mt-0.5 ${expandedFaq === `${si}-${ii}` ? 'rotate-180' : ''}`} />
                              </div>
                              {expandedFaq === `${si}-${ii}` && <p className="mt-3 text-[12px] text-[#8E8E93] leading-relaxed pl-6">{item.a}</p>}
                            </div>
                          ))}
                        </div>
                      </Card>
                    </div>
                  )) : <p className="text-center text-[13px] text-[#48484A] py-8">見つかりませんでした</p>}
                </div>
              )}

              {settingTab === 'budget' && (
                <div className="space-y-5">
                  <div>
                    <Label>資金計画</Label>
                    <Card>
                      <div className="divide-y divide-white/[0.06]">
                        <SettingsRow onClick={() => openEdit('salary', { value: monthly.salary }, 0)} left="手取り給与" right={`¥${Number(monthly.salary || 0).toLocaleString()}`} />
                        <SettingsRow onClick={() => openEdit('totalBudget', { value: monthly.budget }, 0)} left="カード利用目安" right={`¥${Number(monthly.budget || 0).toLocaleString()}`} />
                        <SettingsRow onClick={() => openEdit('cashTarget', { value: monthly.cashTarget }, 0)} left="現金利用目安" right={monthly.cashTarget ? `¥${Number(monthly.cashTarget).toLocaleString()}` : '未設定'} />
                        <SettingsRow onClick={() => openEdit('cashBudget', { value: monthly.cashBudget }, 0)} left="月初のスタート現金" right={`¥${Number(monthly.cashBudget || 0).toLocaleString()}`} />
                        <SettingsRow onClick={() => openEdit('memo', { memo: monthly.memo }, 0)} left="今月のメモ" right={monthly.memo ? '設定済み' : '未設定'} />
                      </div>
                    </Card>
                  </div>
                  <div>
                    <Label trailing={`合計 ¥${S.savTotal.toLocaleString()}`}>先取り設定</Label>
                    <button onClick={() => openEdit('savingsBucket', { id: '', name: '', amount: '' }, -1)}
                      className="w-full h-11 bg-[#1C1C1E] border border-white/[0.06] text-white rounded-xl text-[13px] font-medium flex items-center justify-center gap-2 mb-2">
                      <Plus size={14} className="text-[#8E8E93]" /> 先取り項目を追加
                    </button>
                    {buckets.length > 0 && <Card><div className="divide-y divide-white/[0.06]">{buckets.map((b, i) => <SettingsRow key={b.id || i} onClick={() => openEdit('savingsBucket', b, i)} left={b.name} right={`¥${Number(b.amount || 0).toLocaleString()}`} />)}</div></Card>}
                  </div>
                  <div>
                    <Label>引落予定のカード</Label>
                    <Card><div className="divide-y divide-white/[0.06]">
                      {methods.filter(m => m !== CASH).map(m => (
                        <SettingsRow key={m} onClick={() => openEdit('bill', { name: m, bill: monthly.cardBills?.[m] ?? 0, due: monthly.cardDueDates?.[m] ?? '' }, 0)} left={m} right={`¥${Number(monthly.cardBills?.[m] || 0).toLocaleString()} (${monthly.cardDueDates?.[m] || '-'}日)`} />
                      ))}
                    </div></Card>
                  </div>
                </div>
              )}

              {settingTab === 'fixed' && (
                <div className="space-y-2">
                  <Label trailing={`現金 ¥${S.fCash.toLocaleString()} / カード ¥${S.fCard.toLocaleString()}`}>固定費</Label>
                  <button onClick={() => openEdit('fixed', { name: '', amount: '', method: CASH }, -1)}
                    className="w-full h-11 bg-[#1C1C1E] border border-white/[0.06] text-white rounded-xl text-[13px] font-medium flex items-center justify-center gap-2 mb-2">
                    <Plus size={14} className="text-[#8E8E93]" /> 固定費を追加
                  </button>
                  <Card><div className="divide-y divide-white/[0.06]">
                    {(monthly.fixedCosts || []).map((f, i) => (
                      <SettingsRow key={f.id || i} onClick={() => openEdit('fixed', f, i)}
                        left={<div className="flex items-center gap-2.5"><span className="text-[11px] px-2 py-0.5 rounded-lg bg-white/[0.06] text-[#8E8E93] shrink-0">{f.method || '未設定'}</span><span className="truncate">{f.name}</span></div>}
                        right={`¥${Number(f.amount || 0).toLocaleString()}`} />
                    ))}
                  </div></Card>
                </div>
              )}

              {settingTab === 'category' && (
                <div className="space-y-2">
                  <button onClick={() => openEdit('category', { name: '', budget: '' }, -1)}
                    className="w-full h-11 bg-[#1C1C1E] border border-white/[0.06] text-white rounded-xl text-[13px] font-medium flex items-center justify-center gap-2 mb-2">
                    <Plus size={14} className="text-[#8E8E93]" /> カテゴリを追加
                  </button>
                  <Card><div className="divide-y divide-white/[0.06]">
                    {(config?.categories || []).map((c, i) => {
                      const b = monthly.catBudgets?.[c.name] || 0;
                      return <SettingsRow key={c.name} onClick={() => openEdit('category', { name: c.name, budget: b }, i)} left={c.name} right={`¥${Number(b).toLocaleString()}`} />;
                    })}
                  </div></Card>
                </div>
              )}

              {settingTab === 'template' && (
                <div className="space-y-2">
                  <button onClick={() => openEdit('template', { title: '', amount: '', category: catNames[0] || '食費', method: methods[0] || CASH }, -1)}
                    className="w-full h-11 bg-[#1C1C1E] border border-white/[0.06] text-white rounded-xl text-[13px] font-medium flex items-center justify-center gap-2 mb-2">
                    <Plus size={14} className="text-[#8E8E93]" /> テンプレートを追加
                  </button>
                  <Card><div className="divide-y divide-white/[0.06]">
                    {(config?.templates || []).map((t, i) => (
                      <SettingsRow key={i} onClick={() => openEdit('template', t, i)}
                        left={<div className="flex flex-col"><span className="text-[14px] text-white">{t.title}</span><span className="text-[11px] text-[#48484A]">{t.category} · {t.method}</span></div>}
                        right={`¥${Number(t.amount || 0).toLocaleString()}`} />
                    ))}
                  </div></Card>
                </div>
              )}

              {settingTab === 'payment' && (
                <div className="space-y-2">
                  <button onClick={() => openEdit('payment', { name: '' }, -1)}
                    className="w-full h-11 bg-[#1C1C1E] border border-white/[0.06] text-white rounded-xl text-[13px] font-medium flex items-center justify-center gap-2 mb-2">
                    <Plus size={14} className="text-[#8E8E93]" /> 支払方法を追加
                  </button>
                  <Card><div className="divide-y divide-white/[0.06]">
                    {methods.map((m, i) => <SettingsRow key={m} onClick={() => openEdit('payment', { name: m }, i)} left={m} />)}
                  </div></Card>
                </div>
              )}
            </div>
          )}
        </main>

        {/* FOOTER */}
        <footer className="fixed bottom-0 left-0 right-0 z-50 max-w-md mx-auto bg-black/90 backdrop-blur-xl border-t border-white/[0.06] h-[68px] flex items-center justify-around px-4 pb-1">
          {[[<Home size={22} />, 'home'], [<History size={22} />, 'log']].map(([icon, tab]) => (
            <NavButton key={tab} active={activeTab === tab} onClick={() => setActiveTab(tab)} icon={icon} />
          ))}
          <button onClick={openNew} className="w-12 h-12 bg-white text-black rounded-2xl flex items-center justify-center active:scale-90 transition-transform shadow-lg">
            <Plus size={20} />
          </button>
          {[[<BarChart3 size={22} />, 'analysis'], [<Settings size={22} />, 'settings']].map(([icon, tab]) => (
            <NavButton key={tab} active={activeTab === tab} onClick={() => { setActiveTab(tab); if (tab === 'settings') setSettingTab('menu'); }} icon={icon} />
          ))}
        </footer>
      </div>

      {/* 支出詳細 */}
      {viewingTx && (
        <Modal onClose={() => setViewingTx(null)} zIndex="z-[60]">
          <ModalHeader title="支出の詳細" onClose={() => setViewingTx(null)} />
          <div className="flex-1 overflow-y-auto p-5 pb-8 space-y-5">
            <div className="flex flex-col items-center gap-2 py-2">
              <span className="text-[12px] text-[#8E8E93] px-3 py-1 rounded-lg bg-white/[0.06]">{viewingTx.category}</span>
              <p className="text-[40px] font-semibold text-white tracking-tight">¥{Number(viewingTx.amount).toLocaleString()}</p>
            </div>
            <Card>
              <div className="divide-y divide-white/[0.06]">
                {[['内容', viewingTx.title], ['日付', formatFullDateJP(viewingTx.date)], ['支払方法', viewingTx.paymentMethod]].map(([l, v]) => (
                  <div key={l} className="px-4 py-3 flex justify-between gap-4"><span className="text-[12px] text-[#8E8E93]">{l}</span><span className="text-[13px] text-white">{v}</span></div>
                ))}
                {viewingTx.isSpecial && <div className="px-4 py-3 flex justify-between gap-4"><span className="text-[12px] text-[#8E8E93]">種別</span><span className="text-[13px] text-white">特別費</span></div>}
              </div>
            </Card>
            <div className="flex gap-2">
              <button onClick={async () => { const ok = await confirm({ title: 'この支出を削除しますか？', confirmLabel: '削除する', danger: true }); if (ok) { await deleteDoc(doc(db, 'users', user.uid, 'transactions', viewingTx.id)); setViewingTx(null); showToast('削除しました'); } }}
                className="w-12 h-12 bg-[#FF453A]/10 text-[#FF453A] rounded-xl flex items-center justify-center shrink-0"><Trash2 size={17} /></button>
              <button onClick={() => { const tx = viewingTx; setViewingTx(null); startEdit(tx); }}
                className="flex-1 h-12 bg-white text-black rounded-xl font-semibold text-[14px] flex items-center justify-center gap-2"><Pencil size={14} /> 編集する</button>
            </div>
          </div>
        </Modal>
      )}

      {/* 計算機 */}
      {showCalc && (
        <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center sm:p-6 bg-black/60 backdrop-blur-sm" onClick={() => setShowCalc(false)}>
          <div className="w-full sm:max-w-xs bg-[#1C1C1E] rounded-t-3xl sm:rounded-3xl border border-white/[0.08] p-5" onClick={e => e.stopPropagation()}>
            <CalculatorPad initialValue={calcInit} onConfirm={val => { if (calcCb) calcCb(val); setShowCalc(false); }} />
          </div>
        </div>
      )}

      {/* 支出入力 */}
      {isTxOpen && (
        <Modal onClose={closeTx}>
          <ModalHeader title={editingTx ? '支出を編集' : '支出を入力'} onClose={closeTx} />
          <div className="flex-1 overflow-y-auto p-5 pb-8">
            <form onSubmit={submitTx} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-[#8E8E93] uppercase tracking-wide ml-1">金額</label>
                <div className="flex gap-2">
                  <div className="flex-1 flex items-center bg-[#2C2C2E] rounded-xl h-14 px-4 gap-2 border border-white/[0.06]">
                    <span className="text-[16px] text-[#8E8E93]">¥</span>
                    <input type="text" inputMode="decimal" value={inAmount ? Number(inAmount).toLocaleString() : ''} onChange={e => { const v = e.target.value.replace(/,/g, ''); if (!isNaN(v)) setInAmount(v); }}
                      className="flex-1 bg-transparent text-[22px] font-semibold text-white outline-none tabular-nums" autoFocus required />
                  </div>
                  <button type="button" onClick={() => openCalc(inAmount, val => setInAmount(String(val)))}
                    className="w-14 h-14 bg-[#2C2C2E] border border-white/[0.06] rounded-xl flex items-center justify-center text-[#8E8E93]"><Calculator size={18} /></button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-[#8E8E93] uppercase tracking-wide ml-1">内容</label>
                <input value={inTitle} onChange={e => setInTitle(e.target.value)} placeholder="例: スーパーでお買い物"
                  className="w-full h-12 bg-[#2C2C2E] border border-white/[0.06] rounded-xl px-4 text-[14px] text-white outline-none placeholder-[#48484A] focus:border-white/20 transition-colors" required />
              </div>

              <div className="space-y-1.5 relative">
                <label className="text-[11px] font-medium text-[#8E8E93] uppercase tracking-wide ml-1">カテゴリ</label>
                <select value={inCat} onChange={e => setInCat(e.target.value)}
                  className="w-full h-12 bg-[#2C2C2E] border border-white/[0.06] rounded-xl px-4 text-[14px] text-white outline-none appearance-none">
                  {catNames.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <ChevronDown size={13} className="absolute right-4 bottom-4 text-[#48484A] pointer-events-none" />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-[#8E8E93] uppercase tracking-wide ml-1">日付</label>
                <div className="relative h-12 bg-[#2C2C2E] border border-white/[0.06] rounded-xl overflow-hidden">
                  <div className="absolute inset-0 flex items-center px-4 pointer-events-none">
                    <span className="text-[14px] text-white">{inDate ? inDate.split('-').join('/') : '日付を選択'}</span>
                  </div>
                  <input type="date" value={inDate} onChange={e => setInDate(e.target.value)} className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" required />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-[#8E8E93] uppercase tracking-wide ml-1">支払方法</label>
                <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-0.5">
                  {methods.map(m => (
                    <button key={m} type="button" onClick={() => setInMethod(m)}
                      className={`shrink-0 h-10 px-4 rounded-xl text-[13px] font-medium transition-colors ${inMethod === m ? 'bg-white text-black' : 'bg-[#2C2C2E] text-[#8E8E93] border border-white/[0.06]'}`}>{m}</button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-[#8E8E93] uppercase tracking-wide ml-1">種別</label>
                <div className="flex gap-2">
                  {[[false, '通常'], [true, '特別費']].map(([val, label]) => (
                    <button key={label} type="button" onClick={() => setInSpecial(val)}
                      className={`flex-1 h-10 rounded-xl text-[13px] font-medium transition-colors ${inSpecial === val ? 'bg-white text-black' : 'bg-[#2C2C2E] text-[#8E8E93] border border-white/[0.06]'}`}>{label}</button>
                  ))}
                </div>
              </div>

              {!editingTx && config.templates.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-[#8E8E93] uppercase tracking-wide ml-1">テンプレート</label>
                  <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-0.5">
                    {config.templates.map((t, i) => (
                      <button key={i} type="button" onClick={() => applyTpl(t)}
                        className="shrink-0 h-9 px-3.5 bg-[#2C2C2E] border border-white/[0.06] rounded-xl text-[12px] text-[#8E8E93] flex items-center gap-1.5">
                        <Zap size={11} /> {t.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-2">
                <button type="submit" className="w-full h-12 bg-white text-black rounded-xl font-semibold text-[15px] active:scale-[0.98] transition-all">保存する</button>
              </div>
            </form>
          </div>
        </Modal>
      )}

      {/* 設定コピー */}
      {copyOpen && (
        <Modal onClose={() => setCopyOpen(false)}>
          <ModalHeader title="設定をコピー" onClose={() => setCopyOpen(false)} />
          <div className="p-5 space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-[#8E8E93] uppercase tracking-wide ml-1">コピー元の月</label>
              <input type="month" value={copyFrom} onChange={e => setCopyFrom(e.target.value)}
                className="w-full h-12 bg-[#2C2C2E] border border-white/[0.06] rounded-xl px-4 text-[14px] text-white outline-none" />
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setCopyOpen(false)} className="flex-1 h-12 bg-[#2C2C2E] text-[#8E8E93] rounded-xl font-medium text-[14px]">キャンセル</button>
              <button onClick={copySetting} className="flex-1 h-12 bg-white text-black rounded-xl font-semibold text-[14px]">実行する</button>
            </div>
          </div>
        </Modal>
      )}

      {/* 設定編集 */}
      {editingItem && (
        <Modal onClose={() => setEditingItem(null)} zIndex="z-[70]">
          <ModalHeader title="編集する" onClose={() => setEditingItem(null)} />
          <div className="flex-1 overflow-y-auto p-5 pb-8 space-y-4">
            {['salary', 'totalBudget', 'cashTarget', 'cashBudget'].includes(editingItem.type) && <EditFormSalaryLike editingItem={editingItem} setEditingItem={setEditingItem} openCalculator={openCalc} />}
            {editingItem.type === 'memo' && <EditFormMemo editingItem={editingItem} setEditingItem={setEditingItem} />}
            {editingItem.type === 'bill' && <EditFormBill editingItem={editingItem} setEditingItem={setEditingItem} openCalculator={openCalc} />}
            {editingItem.type === 'savingsBucket' && <EditFormSavingsBucket editingItem={editingItem} setEditingItem={setEditingItem} openCalculator={openCalc} />}
            {editingItem.type === 'category' && <EditFormCategory editingItem={editingItem} setEditingItem={setEditingItem} openCalculator={openCalc} />}
            {editingItem.type === 'fixed' && <EditFormFixed editingItem={editingItem} setEditingItem={setEditingItem} openCalculator={openCalc} paymentMethods={config.paymentMethods} />}
            {editingItem.type === 'template' && <EditFormTemplate editingItem={editingItem} setEditingItem={setEditingItem} openCalculator={openCalc} categoryNames={catNames} paymentMethods={config.paymentMethods} />}
            {editingItem.type === 'payment' && <EditFormPayment editingItem={editingItem} setEditingItem={setEditingItem} />}
            <div className="flex gap-2 pt-2">
              {editingItem.index !== -1 && !['salary', 'totalBudget', 'cashTarget', 'cashBudget', 'bill', 'memo'].includes(editingItem.type) && (
                <button onClick={deleteItem} className="w-12 h-12 bg-[#FF453A]/10 text-[#FF453A] rounded-xl flex items-center justify-center shrink-0"><Trash2 size={17} /></button>
              )}
              <button onClick={saveSettings} className="flex-1 h-12 bg-white text-black rounded-xl font-semibold text-[14px]">変更を保存する</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default function AppWrapper() {
  return <ErrorBoundary><AppMain /></ErrorBoundary>;
}
