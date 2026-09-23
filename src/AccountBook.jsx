import React, { useState } from 'react';
import { collection, addDoc, deleteDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { balanceOn } from './accounting.js';

const money = value => `¥${Number(value || 0).toLocaleString()}`;
const field = 'w-full h-11 rounded-xl bg-[#2C2C2E] border border-white/10 px-3 text-white outline-none';

export function AccountSummary({ accounts, entries, transactions, date }) {
  if (!accounts.length) return null;
  const amounts = accounts.filter(a => a.openingDate <= date).map(a => ({ ...a, balance: balanceOn(a, entries, transactions, date) }));
  if (!amounts.length) return null;
  return <section>
    <p className="text-[11px] text-[#98989D] mb-2">口座・財布の残高（{date}時点）</p>
    <div className="rounded-2xl bg-[#2C2C2E] overflow-hidden">
      <div className="px-4 py-3 flex justify-between text-sm font-semibold"><span>現金・預金 合計</span><span>{money(amounts.reduce((sum, a) => sum + a.balance, 0))}</span></div>
      {amounts.map(a => <div key={a.id} className="px-4 py-2.5 border-t border-white/[0.06] flex justify-between text-[13px]"><span className="text-[#98989D]">{a.name}</span><span className={a.balance < 0 ? 'text-[#FF453A]' : ''}>{money(a.balance)}</span></div>)}
    </div>
    <p className="mt-2 text-[11px] text-[#636366]">開始日以降、口座を指定した支出と口座の入出金から計算。先取り枠は合計に足していません。</p>
  </section>;
}

export function AccountBook({ db, user, accounts, entries, transactions, today, onToast }) {
  const [mode, setMode] = useState('');
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [opening, setOpening] = useState('');
  const [date, setDate] = useState(today);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [target, setTarget] = useState('');
  const [selected, setSelected] = useState('');
  const active = accounts.find(a => a.id === selected);
  const validAccount = id => accounts.find(a => a.id === id && a.openingDate <= date);
  const accountName = id => accounts.find(a => a.id === id)?.name || '不明な口座';
  const open = (nextMode, accountId = '') => {
    setMode(nextMode); setDate(today); setSelected(accountId); setFrom(accountId);
    setTo(''); setAmount(''); setMemo(''); setTarget(''); setName(''); setOpening('');
  };
  const edit = account => {
    open('edit', account.id);
    setName(account.name);
    setOpening(String(account.openingBalance));
    setDate(account.openingDate);
  };
  const save = async e => {
    e.preventDefault();
    if (saving) return;
    if (['account', 'edit'].includes(mode) && (!name.trim() || !Number.isSafeInteger(Number(opening)) || Number(opening) < 0)) return onToast('口座名と開始残高を確認してください');
    if (mode !== 'account' && !date) return onToast('日付を選んでください');
    const n = Number(amount);
    if (mode === 'move' && (!validAccount(from) || !validAccount(to) || from === to || !Number.isSafeInteger(n) || n <= 0)) return onToast('振替元・振替先・金額を確認してください');
    if (['deposit', 'withdraw'].includes(mode) && (!validAccount(selected) || !Number.isSafeInteger(n) || n <= 0)) return onToast('口座・金額を確認してください');
    if (mode === 'reconcile' && (!validAccount(selected) || !Number.isSafeInteger(Number(target)) || Number(target) < 0)) return onToast('残高を確認してください');
    setSaving(true);
    try {
      const base = doc(db, 'users', user.uid);
      if (mode === 'account' || mode === 'edit') {
        const values = { name: name.trim(), openingBalance: Number(opening), openingDate: date };
        if (mode === 'edit') await updateDoc(doc(base, 'accounts', selected), values);
        else await addDoc(collection(base, 'accounts'), { ...values, createdAt: serverTimestamp() });
      } else if (mode === 'reconcile') {
        const balance = balanceOn(active, entries, transactions, date);
        const delta = Number(target) - balance;
        if (delta) await addDoc(collection(base, 'accountEntries'), { kind: 'adjustment', accountId: selected, delta, date, memo: memo.trim() || '残高調整', createdAt: serverTimestamp() });
      } else {
        await addDoc(collection(base, 'accountEntries'), {
          kind: mode, date, amount: n, memo: memo.trim(),
          fromAccountId: mode === 'move' ? from : mode === 'withdraw' ? selected : null,
          toAccountId: mode === 'move' ? to : mode === 'deposit' ? selected : null,
          createdAt: serverTimestamp()
        });
      }
      onToast('記録しました'); setMode('');
    } catch (err) { console.error(err); onToast('口座の記録に失敗しました'); }
    finally { setSaving(false); }
  };
  return <div className="space-y-4 pb-32">
    <p className="text-[12px] text-[#98989D]">まず今日の実残高で口座・財布を登録。昔の支出は自動では差し引かれません。貯金などの先取り枠は、お金の使い道なので口座と別に管理します。</p>
    {accounts.map(a => <div key={a.id} className="rounded-xl bg-[#2C2C2E] px-4 py-3">
      <div className="flex justify-between"><span>{a.name}</span><span>{money(balanceOn(a, entries, transactions, today))}</span></div>
      <p className="text-[11px] text-[#98989D] mt-1">{a.openingDate} 開始 · 開始残高 {money(a.openingBalance)}</p>
      <div className="flex gap-4"><button className="text-[#0A84FF] text-[12px] mt-2 min-h-9" onClick={() => open('reconcile', a.id)}>実残高に合わせる</button><button className="text-[#0A84FF] text-[12px] mt-2 min-h-9" onClick={() => edit(a)}>名前・開始残高を修正</button></div>
    </div>)}
    <div className="grid grid-cols-2 gap-2">
      {[['account','口座・財布を追加'],['move','口座間の振替'],['deposit','入金を記録'],['withdraw','出金を記録']].map(([id,label]) =>
        <button key={id} onClick={() => open(id)} disabled={id !== 'account' && !accounts.length} className="min-h-11 rounded-xl bg-[#2C2C2E] text-[#0A84FF] text-[13px] disabled:opacity-40">{label}</button>)}
    </div>
    {!!entries.length && <div className="rounded-xl bg-[#2C2C2E] divide-y divide-white/[0.06]">
      {[...entries].sort((a,b) => b.date.localeCompare(a.date)).slice(0, 30).map(entry => <div key={entry.id} className="px-4 py-3 flex items-center gap-3">
        <div className="flex-1 min-w-0"><p className="text-[13px] truncate">{entry.kind === 'move' ? `${accountName(entry.fromAccountId)} → ${accountName(entry.toAccountId)}` : entry.kind === 'deposit' ? `${accountName(entry.toAccountId)}へ入金` : entry.kind === 'withdraw' ? `${accountName(entry.fromAccountId)}から出金` : `${accountName(entry.accountId)}の残高調整`}</p><p className="text-[11px] text-[#98989D]">{entry.date} {entry.memo || ''}</p></div>
        <span className="text-[13px] tabular-nums">{entry.kind === 'adjustment' ? `${entry.delta >= 0 ? '+' : ''}${money(entry.delta)}` : money(entry.amount)}</span>
        <button type="button" className="text-[#FF453A] text-[12px] min-w-11 min-h-11" onClick={async () => {
          if (!window.confirm('この入出金の記録を削除しますか？ 残高が再計算されます。')) return;
          try { await deleteDoc(doc(db, 'users', user.uid, 'accountEntries', entry.id)); onToast('削除しました'); }
          catch (error) { console.error(error); onToast('削除に失敗しました'); }
        }}>削除</button>
      </div>)}
    </div>}
    <p className="text-[11px] text-[#636366]">振替は支出になりません。カードの引落は「出金を記録」を使います。ここで記録した入出金は今月の予算には反映されません。</p>
    {!!mode && <div className="fixed inset-0 z-[80] bg-black/60 flex items-end sm:items-center justify-center" onClick={() => setMode('')}>
      <form onSubmit={save} onClick={e => e.stopPropagation()} className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-[#1C1C1E] p-5 pb-10 space-y-3 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">{{account:'口座・財布を追加',edit:'口座・財布を修正',move:'口座間の振替',deposit:'入金',withdraw:'出金',reconcile:'残高を合わせる'}[mode]}</h2><button type="button" className="p-2" onClick={() => setMode('')}>閉じる</button></div>
        {['account', 'edit'].includes(mode) && <><label className="block text-sm">名前<input className={field} value={name} onChange={e => setName(e.target.value)} placeholder="例：SBI、三井住友、財布" required /></label><label className="block text-sm">開始時点の実残高<input className={field} type="number" min="0" step="1" value={opening} onChange={e => setOpening(e.target.value)} required /></label></>}
        {mode === 'move' && <><label className="block text-sm">移動元<select className={field} value={from} onChange={e => setFrom(e.target.value)} required><option value="">選択</option>{accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label><label className="block text-sm">移動先<select className={field} value={to} onChange={e => setTo(e.target.value)} required><option value="">選択</option>{accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label></>}
        {['deposit','withdraw'].includes(mode) && <label className="block text-sm">口座<select className={field} value={selected} onChange={e => setSelected(e.target.value)} required><option value="">選択</option>{accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>}
        {mode === 'reconcile' && <p className="text-sm text-[#98989D]">{active?.name}：計算上 {money(active ? balanceOn(active, entries, transactions, date) : 0)}</p>}
        {!['account','edit','reconcile'].includes(mode) && <label className="block text-sm">金額<input className={field} type="number" min="1" step="1" value={amount} onChange={e => setAmount(e.target.value)} required /></label>}
        {mode === 'reconcile' && <label className="block text-sm">確認した実残高<input className={field} type="number" min="0" step="1" value={target} onChange={e => setTarget(e.target.value)} required /></label>}
        <label className="block text-sm">{mode === 'edit' ? '開始日（変更不可）' : '日付'}<input className={field} type="date" value={date} onChange={e => setDate(e.target.value)} disabled={mode === 'edit'} required /></label>
        {!['account','edit'].includes(mode) && <label className="block text-sm">メモ<input className={field} value={memo} onChange={e => setMemo(e.target.value)} /></label>}
        <button disabled={saving} className="w-full h-11 rounded-xl bg-[#0A84FF] font-semibold disabled:opacity-50">{saving ? '保存中...' : '保存する'}</button>
      </form>
    </div>}
  </div>;
}
