import test from 'node:test';
import assert from 'node:assert/strict';
import { cashTopupTotals, forecastAccount, remainingCashBudget } from './balanceModel.js';

test('ATM cash and card-budget transfers are independent; legacy records retain their effect', () => {
  assert.deepEqual(cashTopupTotals([
    { amount: 1000, shiftCardBudget: false },
    { amount: 2000, shiftCardBudget: true },
    { amount: 3000 }
  ]), { cash: 6000, cardToCash: 5000 });
});

test('a cash-only ATM withdrawal does not create monthly spending capacity', () => {
  const { cash, cardToCash } = cashTopupTotals([{ amount: 1000, shiftCardBudget: false }]);
  assert.equal(cash, 1000);
  assert.equal(remainingCashBudget(5000, cardToCash, 2000), 3000);
  assert.equal(remainingCashBudget(5000, cardToCash, 2000), remainingCashBudget(5000, 0, 2000));
});

test('savings transfer preserves the combined account balance', () => {
  const common = { start: 10000, salary: 5000, savings: 2000, bills: 1000, atm: 500, salaryAccountId: 'salary', savingsAccountId: 'savings', cashAccountId: 'salary' };
  const salary = forecastAccount({ ...common, accountId: 'salary' });
  const savings = forecastAccount({ ...common, accountId: 'savings', bills: 0 });
  assert.equal(salary.projected, 11500);
  assert.equal(savings.projected, 12000);
  assert.equal(salary.projected + savings.projected, 23500);
});

test('same or missing savings transfer role never creates money', () => {
  const common = { accountId: 'salary', start: 10000, salary: 5000, savings: 2000, bills: 0, atm: 0, salaryAccountId: 'salary', cashAccountId: '' };
  assert.equal(forecastAccount({ ...common, savingsAccountId: 'salary' }).projected, 15000);
  assert.equal(forecastAccount({ ...common, savingsAccountId: '' }).projected, 15000);
  assert.equal(forecastAccount({ ...common, salaryAccountId: '', savingsAccountId: 'salary' }).projected, 10000);
});

import { methodTimingOf, spendableFromBalance } from './balanceModel.js';

test('口座振替は当月払い、カードは翌月払い、設定があれば設定を優先', () => {
  assert.equal(methodTimingOf('口座振替'), 'same');
  assert.equal(methodTimingOf('三井住友'), 'next');
  assert.equal(methodTimingOf('三井住友', { 三井住友: 'same' }), 'same');
});

test('生活口座に余っているお金も使えるお金に含まれる', () => {
  const base = { walletStart: 10000, salary: 400000, savings: 120000, deferredBills: 150000, spentBudget: 0, fixedPlanned: 0, fixedRecorded: 0, pendingFixed: 0 };
  const a = spendableFromBalance({ ...base, bankStart: 100000 });
  const b = spendableFromBalance({ ...base, bankStart: 300000 });
  assert.equal(b.freeRemain - a.freeRemain, 200000);
});

test('口座振替は今月の支出として1回だけ引かれる（引落予定には入れない）', () => {
  // 家賃8万を口座振替で今月記録済み。翌月払いの引落は先月のカード分15万だけ
  const r = spendableFromBalance({
    bankStart: 300000, walletStart: 0, salary: 400000, savings: 120000,
    deferredBills: 150000, spentBudget: 80000, fixedPlanned: 80000, fixedRecorded: 80000, pendingFixed: 0
  });
  assert.equal(r.freeRemain, 300000 + 400000 - 120000 - 150000 - 80000);
});

test('先月のカードと今月のカードは別の月として1回ずつ引かれる', () => {
  // 先月使った15万は今月の引落、今月使った5万は来月の引落予定として確定
  const r = spendableFromBalance({
    bankStart: 200000, walletStart: 0, salary: 400000, savings: 100000,
    deferredBills: 150000, spentBudget: 50000, fixedPlanned: 0, fixedRecorded: 0, pendingFixed: 0
  });
  assert.equal(r.freeRemain, 300000);
});

test('ATMで生活口座から財布へ移しても使えるお金は変わらない', () => {
  const common = { salary: 0, savings: 0, deferredBills: 0, spentBudget: 0, fixedPlanned: 0, fixedRecorded: 0, pendingFixed: 0 };
  const before = spendableFromBalance({ ...common, bankStart: 100000, walletStart: 10000 });
  const after = spendableFromBalance({ ...common, bankStart: 70000, walletStart: 40000 });
  assert.equal(before.freeRemain, after.freeRemain);
});

test('未記録の固定費は予定として差し引き、記録されたら二重に引かない', () => {
  const common = { bankStart: 300000, walletStart: 0, salary: 0, savings: 0, deferredBills: 0, fixedPlanned: 80000 };
  const before = spendableFromBalance({ ...common, spentBudget: 0, fixedRecorded: 0, pendingFixed: 80000 });
  const after = spendableFromBalance({ ...common, spentBudget: 80000, fixedRecorded: 80000, pendingFixed: 0 });
  assert.equal(before.freeRemain, 220000);
  assert.equal(after.freeRemain, 220000);
});
