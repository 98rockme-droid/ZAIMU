import React, { useState, useCallback } from 'react';
import { CreditCard, ChevronDown, Calculator, Delete, CheckCircle2, AlertTriangle, WifiOff, X } from 'lucide-react';

export const safeCalculate = (expression) => {
  if (!expression) return '0';
  if (/[^0-9+\-*/.() ]/.test(expression)) return '0';
  try {
    const tokens = expression.match(/(\d+(\.\d+)?|[\+\-\*\/])/g);
    if (!tokens || tokens.length === 0) return '0';
    const nums = [], ops = [];
    const precedence = { '+': 1, '-': 1, '*': 2, '/': 2 };
    const applyOp = () => {
      const op = ops.pop(), b = nums.pop(), a = nums.pop();
      if (a === undefined || b === undefined) return;
      if (op === '+') nums.push(a + b);
      else if (op === '-') nums.push(a - b);
      else if (op === '*') nums.push(a * b);
      else if (op === '/') nums.push(b !== 0 ? a / b : 0);
    };
    for (const token of tokens) {
      if (!isNaN(token)) nums.push(parseFloat(token));
      else {
        while (ops.length > 0 && precedence[ops[ops.length - 1]] >= precedence[token]) applyOp();
        ops.push(token);
      }
    }
    while (ops.length > 0) applyOp();
    const result = nums[0];
    return isNaN(result) ? '0' : result;
  } catch { return '0'; }
};

export const toNumber = (val) => {
  if (val === null || val === undefined || val === '') return 0;
  const num = Number(String(val).replace(/,/g, ''));
  return Number.isFinite(num) ? num : 0;
};

export const ConfirmDialog = ({ isOpen, title, message, confirmLabel = '実行する', danger = false, onConfirm, onCancel }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-6 bg-black/60 backdrop-blur-sm" onClick={onCancel}>
      <div className="w-full max-w-[300px] bg-[#1C1C1E] rounded-2xl overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="px-5 pt-6 pb-4 flex flex-col items-center gap-2 text-center">
          {danger && (
            <div className="w-10 h-10 rounded-full bg-[#FF453A]/10 flex items-center justify-center mb-1">
              <AlertTriangle size={18} className="text-[#FF453A]" />
            </div>
          )}
          <p className="text-[15px] font-semibold text-white leading-snug">{title}</p>
          {message && <p className="text-[13px] text-[#8E8E93] leading-relaxed">{message}</p>}
        </div>
        <div className="border-t border-white/[0.08] grid grid-cols-2">
          <button type="button" onClick={onCancel} className="h-12 text-[15px] text-[#8E8E93] border-r border-white/[0.08] active:bg-white/[0.04] transition-colors">キャンセル</button>
          <button type="button" onClick={onConfirm} className={`h-12 text-[15px] font-semibold transition-colors ${danger ? 'text-[#FF453A]' : 'text-[#0A84FF]'}`}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
};

export const useConfirm = () => {
  const [state, setState] = useState({ isOpen: false, title: '', message: '', confirmLabel: '実行する', danger: false, resolve: null });
  const confirm = useCallback(({ title, message, confirmLabel, danger = false }) =>
    new Promise(resolve => setState({ isOpen: true, title, message, confirmLabel: confirmLabel || '実行する', danger, resolve })), []);
  const handleConfirm = useCallback(() => { state.resolve(true); setState(s => ({ ...s, isOpen: false })); }, [state]);
  const handleCancel = useCallback(() => { state.resolve(false); setState(s => ({ ...s, isOpen: false })); }, [state]);
  const dialog = (
    <ConfirmDialog
      isOpen={state.isOpen} title={state.title} message={state.message}
      confirmLabel={state.confirmLabel} danger={state.danger}
      onConfirm={handleConfirm} onCancel={handleCancel}
    />
  );
  return { confirm, dialog };
};

export const Card = ({ children, className = '', onClick }) => (
  <div onClick={onClick} className={`bg-[#1C1C1E] rounded-2xl border border-white/[0.06] overflow-hidden w-full ${className}`}>
    {children}
  </div>
);

export const Label = ({ children, trailing }) => (
  <div className="flex items-center justify-between px-1 mb-2">
    <span className="text-[11px] font-medium text-[#8E8E93] uppercase tracking-wide">{children}</span>
    {trailing && <span className="text-[11px] text-[#8E8E93]">{trailing}</span>}
  </div>
);

export const Row = ({ label, value, accent = false, muted = false, danger = false, indent = false }) => (
  <div className={`flex items-center justify-between px-4 py-3 gap-4 ${indent ? 'pl-8' : ''}`}>
    <span className={`text-[14px] leading-snug ${muted ? 'text-[#636366]' : 'text-[#EBEBF5]/80'}`}>{label}</span>
    <span className={`tabular-nums shrink-0 ${
      danger ? 'text-[#FF453A] text-[14px] font-semibold'
      : accent ? 'text-[16px] font-bold text-white'
      : muted ? 'text-[#636366] text-[13px]'
      : 'text-white text-[14px] font-medium'
    }`}>
      {value}
    </span>
  </div>
);

export const Separator = () => (
  <div className="h-px bg-white/[0.04] mx-4" />
);

export const NavButton = ({ active, onClick, icon }) => (
  <button onClick={onClick} className={`flex items-center justify-center w-12 h-10 rounded-xl transition-colors ${active ? 'text-white' : 'text-[#48484A]'}`}>
    {icon}
  </button>
);

export const Toast = ({ message, isVisible }) => (
  <div className={`fixed bottom-32 left-1/2 -translate-x-1/2 z-[80] transition-all duration-300 pointer-events-none ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
    <div className="bg-[#2C2C2E] text-white px-4 py-2.5 rounded-full border border-white/[0.08] flex items-center gap-2 shadow-xl">
      <CheckCircle2 size={13} className="text-[#30D158] shrink-0" />
      <span className="text-[12px] font-medium">{message}</span>
    </div>
  </div>
);

export const OfflineBanner = ({ isOffline }) => (
  <div className={`fixed top-14 left-0 right-0 z-40 transition-all duration-300 ${isOffline ? 'opacity-100' : 'opacity-0 -translate-y-full pointer-events-none'}`}>
    <div className="bg-[#2C2C2E] px-4 py-2 flex items-center justify-center gap-2 border-b border-white/[0.06]">
      <WifiOff size={12} className="text-[#FF9F0A]" />
      <span className="text-[11px] font-medium text-[#8E8E93]">オフライン中 — データは自動的に同期されます</span>
    </div>
  </div>
);

export const SettingsRow = ({ left, right, onClick, showChevron = false }) => (
  <button type="button" onClick={onClick} className="w-full flex items-center justify-between px-4 py-3.5 active:bg-white/[0.04] transition-colors text-left">
    <div className="flex items-center gap-3 min-w-0 flex-1 text-[14px] text-white">{left}</div>
    <div className="flex items-center gap-1.5 shrink-0 ml-3">
      {right && <span className="text-[13px] text-[#8E8E93]">{right}</span>}
      {showChevron && <ChevronDown size={14} className="text-[#48484A] -rotate-90" />}
    </div>
  </button>
);

export const PrimaryButton = ({ children, onClick, type = 'button', className = '' }) => (
  <button type={type} onClick={onClick}
    className={`w-full h-12 bg-[#0A84FF] text-white rounded-xl font-semibold text-[15px] flex items-center justify-center gap-2 active:scale-[0.98] transition-all ${className}`}>
    {children}
  </button>
);

export const SecondaryButton = ({ children, onClick, type = 'button', className = '' }) => (
  <button type={type} onClick={onClick}
    className={`w-full h-12 bg-[#2C2C2E] text-[#8E8E93] rounded-xl font-medium text-[14px] flex items-center justify-center gap-2 active:bg-white/[0.06] transition-colors ${className}`}>
    {children}
  </button>
);

export const DangerIconButton = ({ children, onClick }) => (
  <button type="button" onClick={onClick}
    className="w-12 h-12 bg-[#FF453A]/10 text-[#FF453A] rounded-xl flex items-center justify-center shrink-0 active:bg-[#FF453A]/20 transition-colors">
    {children}
  </button>
);

export const CalculatorPad = ({ initialValue, onConfirm }) => {
  const [display, setDisplay] = useState(String(initialValue || '0'));
  const [isResult, setIsResult] = useState(false);
  const push = (val) => {
    if (isResult && !['+', '-', '*', '/'].includes(val)) { setDisplay(String(val)); setIsResult(false); }
    else { setDisplay(prev => (prev === '0' && !['+', '-', '*', '/', '.'].includes(val)) ? String(val) : prev + val); setIsResult(false); }
  };
  const btns = [
    { l: 'C', act: () => setDisplay('0'), cls: 'text-[#FF453A]' },
    { l: '/', act: () => push('/'), cls: 'text-[#8E8E93]' },
    { l: '*', act: () => push('*'), cls: 'text-[#8E8E93]' },
    { l: <Delete size={16} />, act: () => setDisplay(p => p.length > 1 ? p.slice(0, -1) : '0'), cls: 'text-[#8E8E93]' },
    { l: '7', act: () => push('7') }, { l: '8', act: () => push('8') }, { l: '9', act: () => push('9') },
    { l: '-', act: () => push('-'), cls: 'text-[#8E8E93]' },
    { l: '4', act: () => push('4') }, { l: '5', act: () => push('5') }, { l: '6', act: () => push('6') },
    { l: '+', act: () => push('+'), cls: 'text-[#8E8E93]' },
    { l: '1', act: () => push('1') }, { l: '2', act: () => push('2') }, { l: '3', act: () => push('3') },
    { l: '=', act: () => { setDisplay(String(safeCalculate(display))); setIsResult(true); }, cls: 'bg-[#0A84FF] text-white row-span-2' },
    { l: '0', act: () => push('0'), cls: 'col-span-2' },
    { l: '.', act: () => push('.') },
  ];
  return (
    <div className="flex flex-col gap-3">
      <div className="bg-[#2C2C2E] rounded-2xl px-4 py-3.5 text-right font-mono text-[22px] text-white tabular-nums break-all border border-white/[0.06]">{display}</div>
      <div className="grid grid-cols-4 gap-2 h-60">
        {btns.map((b, i) => (
          <button key={i} type="button" onClick={b.act}
            className={`rounded-xl bg-[#2C2C2E] border border-white/[0.06] text-[17px] font-medium active:scale-95 transition-all flex items-center justify-center ${b.cls || 'text-white'}`}>
            {b.l}
          </button>
        ))}
      </div>
      <PrimaryButton onClick={() => onConfirm(toNumber(display))}>決定</PrimaryButton>
    </div>
  );
};

const FieldLabel = ({ children }) => (
  <label className="text-[11px] font-medium text-[#8E8E93] uppercase tracking-wide ml-1 block mb-1.5">{children}</label>
);

const AmountInput = ({ value, onChange, openCalculator }) => (
  <div className="flex gap-2">
    <div className="flex-1 flex items-center bg-[#2C2C2E] rounded-xl h-12 px-4 gap-2 border border-white/[0.06] focus-within:border-white/20 transition-colors">
      <span className="text-[15px] text-[#8E8E93]">¥</span>
      <input type="text" inputMode="decimal" value={value} onChange={onChange}
        className="flex-1 bg-transparent text-[17px] font-semibold text-white outline-none tabular-nums" />
    </div>
    <button type="button" onClick={openCalculator}
      className="w-12 h-12 bg-[#2C2C2E] border border-white/[0.06] rounded-xl flex items-center justify-center text-[#8E8E93] active:bg-white/[0.06] transition-colors">
      <Calculator size={17} />
    </button>
  </div>
);

export const EditFormSalaryLike = ({ editingItem, setEditingItem, openCalculator }) => {
  const labelMap = { salary: '手取り給与', totalBudget: 'クレジットカード利用目安', cashTarget: '現金利用目安', cashBudget: '月初のスタート現金', savings: '今月の積立額' };
  return (
    <div>
      <FieldLabel>{labelMap[editingItem.type] || '金額'}</FieldLabel>
      <AmountInput
        value={String(editingItem.data.value ?? '')}
        onChange={e => setEditingItem({ ...editingItem, data: { value: e.target.value } })}
        openCalculator={() => openCalculator(editingItem.data.value ?? 0, val => setEditingItem(p => ({ ...p, data: { value: String(val) } })))}
      />
    </div>
  );
};

export const EditFormMemo = ({ editingItem, setEditingItem }) => (
  <div>
    <FieldLabel>今月のメモ</FieldLabel>
    <div className="bg-[#2C2C2E] rounded-xl border border-white/[0.06] p-4">
      <textarea value={editingItem.data.memo || ''} onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, memo: e.target.value } })}
        className="w-full h-32 bg-transparent text-[14px] text-white outline-none resize-none leading-relaxed" />
    </div>
  </div>
);

export const EditFormBill = ({ editingItem, setEditingItem, openCalculator }) => (
  <div className="space-y-4">
    <div className="flex items-center gap-3 p-4 bg-[#2C2C2E] rounded-xl border border-white/[0.06]">
      <CreditCard size={16} className="text-[#8E8E93]" />
      <span className="text-[14px] font-medium text-white">{editingItem.data.name}</span>
    </div>
    <div>
      <FieldLabel>引落予定額</FieldLabel>
      <AmountInput
        value={String(editingItem.data.bill ?? '')}
        onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, bill: e.target.value } })}
        openCalculator={() => openCalculator(editingItem.data.bill ?? 0, val => setEditingItem(p => ({ ...p, data: { ...p.data, bill: String(val) } })))}
      />
    </div>
    <div>
      <FieldLabel>引落日</FieldLabel>
      <div className="flex items-center bg-[#2C2C2E] border border-white/[0.06] rounded-xl h-12 px-4 w-1/2">
        <input type="number" value={String(editingItem.data.due ?? '')} onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, due: e.target.value } })}
          className="w-full bg-transparent text-[17px] font-semibold text-white outline-none tabular-nums" />
        <span className="text-[13px] text-[#8E8E93] ml-2">日</span>
      </div>
    </div>
  </div>
);

export const EditFormSavingsBucket = ({ editingItem, setEditingItem, openCalculator }) => (
  <div className="space-y-4">
    <div>
      <FieldLabel>項目名</FieldLabel>
      <input value={editingItem.data.name || ''} onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, name: e.target.value } })}
        className="w-full h-12 bg-[#2C2C2E] border border-white/[0.06] rounded-xl px-4 text-[14px] text-white outline-none focus:border-white/20 transition-colors" />
    </div>
    <div>
      <FieldLabel>金額</FieldLabel>
      <AmountInput
        value={editingItem.data.amount ? Number(editingItem.data.amount).toLocaleString() : ''}
        onChange={e => { const v = e.target.value.replace(/,/g, ''); if (!isNaN(v)) setEditingItem({ ...editingItem, data: { ...editingItem.data, amount: v } }); }}
        openCalculator={() => openCalculator(editingItem.data.amount ?? 0, val => setEditingItem(p => ({ ...p, data: { ...p.data, amount: String(val) } })))}
      />
    </div>
  </div>
);

export const EditFormCategory = ({ editingItem, setEditingItem, openCalculator }) => (
  <div className="space-y-4">
    <div>
      <FieldLabel>カテゴリ名</FieldLabel>
      <input value={editingItem.data.name || ''} onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, name: e.target.value } })}
        className="w-full h-12 bg-[#2C2C2E] border border-white/[0.06] rounded-xl px-4 text-[14px] text-white outline-none focus:border-white/20 transition-colors" />
    </div>
    <div>
      <FieldLabel>月の予算</FieldLabel>
      <AmountInput
        value={editingItem.data.budget ? Number(editingItem.data.budget).toLocaleString() : ''}
        onChange={e => { const v = e.target.value.replace(/,/g, ''); if (!isNaN(v)) setEditingItem({ ...editingItem, data: { ...editingItem.data, budget: v } }); }}
        openCalculator={() => openCalculator(editingItem.data.budget ?? 0, val => setEditingItem(p => ({ ...p, data: { ...p.data, budget: String(val) } })))}
      />
    </div>
  </div>
);

export const EditFormFixed = ({ editingItem, setEditingItem, openCalculator, paymentMethods }) => (
  <div className="space-y-4">
    <div>
      <FieldLabel>内容</FieldLabel>
      <input value={editingItem.data.name || ''} onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, name: e.target.value } })}
        className="w-full h-12 bg-[#2C2C2E] border border-white/[0.06] rounded-xl px-4 text-[14px] text-white outline-none focus:border-white/20 transition-colors" />
    </div>
    <div>
      <FieldLabel>金額</FieldLabel>
      <AmountInput
        value={editingItem.data.amount ? Number(editingItem.data.amount).toLocaleString() : ''}
        onChange={e => { const v = e.target.value.replace(/,/g, ''); if (!isNaN(v)) setEditingItem({ ...editingItem, data: { ...editingItem.data, amount: v } }); }}
        openCalculator={() => openCalculator(editingItem.data.amount ?? 0, val => setEditingItem(p => ({ ...p, data: { ...p.data, amount: String(val) } })))}
      />
    </div>
    <div className="relative">
      <FieldLabel>支払方法</FieldLabel>
      <select value={editingItem.data.method || ''} onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, method: e.target.value } })}
        className="w-full h-12 bg-[#2C2C2E] border border-white/[0.06] rounded-xl px-4 text-[14px] text-white outline-none appearance-none focus:border-white/20 transition-colors">
        {paymentMethods.map(m => <option key={m} value={m}>{m}</option>)}
      </select>
      <ChevronDown size={13} className="absolute right-4 bottom-4 text-[#8E8E93] pointer-events-none" />
    </div>
  </div>
);

export const EditFormTemplate = ({ editingItem, setEditingItem, openCalculator, categoryNames, paymentMethods }) => (
  <div className="space-y-4">
    <div>
      <FieldLabel>テンプレート名</FieldLabel>
      <input value={editingItem.data.title || ''} onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, title: e.target.value } })}
        className="w-full h-12 bg-[#2C2C2E] border border-white/[0.06] rounded-xl px-4 text-[14px] text-white outline-none focus:border-white/20 transition-colors" />
    </div>
    <div>
      <FieldLabel>初期金額</FieldLabel>
      <AmountInput
        value={editingItem.data.amount ? Number(editingItem.data.amount).toLocaleString() : ''}
        onChange={e => { const v = e.target.value.replace(/,/g, ''); if (!isNaN(v)) setEditingItem({ ...editingItem, data: { ...editingItem.data, amount: v } }); }}
        openCalculator={() => openCalculator(editingItem.data.amount ?? 0, val => setEditingItem(p => ({ ...p, data: { ...p.data, amount: String(val) } })))}
      />
    </div>
    <div className="relative">
      <FieldLabel>カテゴリ</FieldLabel>
      <select value={editingItem.data.category || ''} onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, category: e.target.value } })}
        className="w-full h-12 bg-[#2C2C2E] border border-white/[0.06] rounded-xl px-4 text-[14px] text-white outline-none appearance-none focus:border-white/20 transition-colors">
        {categoryNames.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
      <ChevronDown size={13} className="absolute right-4 bottom-4 text-[#8E8E93] pointer-events-none" />
    </div>
    <div className="relative">
      <FieldLabel>支払方法</FieldLabel>
      <select value={editingItem.data.method || ''} onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, method: e.target.value } })}
        className="w-full h-12 bg-[#2C2C2E] border border-white/[0.06] rounded-xl px-4 text-[14px] text-white outline-none appearance-none focus:border-white/20 transition-colors">
        {paymentMethods.map(m => <option key={m} value={m}>{m}</option>)}
      </select>
      <ChevronDown size={13} className="absolute right-4 bottom-4 text-[#8E8E93] pointer-events-none" />
    </div>
  </div>
);

export const EditFormPayment = ({ editingItem, setEditingItem }) => (
  <div>
    <FieldLabel>支払方法名</FieldLabel>
    <input value={editingItem.data.name || ''} onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, name: e.target.value } })}
      className="w-full h-12 bg-[#2C2C2E] border border-white/[0.06] rounded-xl px-4 text-[14px] text-white outline-none focus:border-white/20 transition-colors" />
  </div>
);

export class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(e, info) { console.error(e, info); }
  render() {
    if (this.state.hasError) return (
      <div className="h-screen w-full bg-black flex flex-col items-center justify-center p-8 gap-4">
        <p className="text-[15px] font-semibold text-white">エラーが発生しました</p>
        <p className="text-[13px] text-[#8E8E93] text-center">画面を再読み込みしてください。</p>
        <button onClick={() => window.location.reload()} className="mt-2 px-6 h-11 bg-[#0A84FF] text-white rounded-xl font-semibold text-[14px]">再読み込み</button>
      </div>
    );
    return this.props.children;
  }
}
