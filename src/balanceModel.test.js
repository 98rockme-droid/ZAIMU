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

import { methodTimingOf, spendableFromBalance, transferTotals, transferEffectOnLiving } from './balanceModel.js';

test('口座振替は当月払い、カードは翌月払い、設定があれば設定を優先', () => {
  assert.equal(methodTimingOf('口座振替'), 'same');
  assert.equal(methodTimingOf('三井住友'), 'next');
  assert.equal(methodTimingOf('三井住友', { 三井住友: 'same' }), 'same');
});

test('生活口座に余っているお金も使えるお金に含まれる', () => {
  const base = { walletStart: 10000, salary: 400000, savings: 120000, spentBudget: 0, fixedPlanned: 0, fixedRecorded: 0, pendingFixed: 0 };
  const a = spendableFromBalance({ ...base, bankStart: 100000 });
  const b = spendableFromBalance({ ...base, bankStart: 300000 });
  assert.equal(b.freeRemain - a.freeRemain, 200000);
});

test('収支がぴったり0の月は、口座に余っているお金だけが残る（カードを二重に引かない）', () => {
  // 給与40万・先取り10万・カード20万・口座振替5万・現金5万 → 収支0。口座の余りは3万
  const r = spendableFromBalance({
    bankStart: 30000, walletStart: 0, salary: 400000, savings: 100000,
    spentBudget: 200000 + 50000 + 50000, fixedPlanned: 0, fixedRecorded: 0, pendingFixed: 0
  });
  assert.equal(r.freeRemain, 30000);
});

test('月をまたいでも余りが引き継がれる（翌月の月初残高と整合する）', () => {
  const S = 400000, P = 100000, card = 200000, F = 50000, K = 50000;
  const bankStart = 30000;
  // 実際のお金の動き: 今月は先月のカード分が引き落とされる（定常状態では同額）
  const nextBankStart = bankStart + S - P - card - F - K;
  const thisMonth = spendableFromBalance({ bankStart, walletStart: 0, salary: S, savings: P, spentBudget: card + F + K, fixedPlanned: 0, fixedRecorded: 0, pendingFixed: 0 });
  assert.equal(thisMonth.freeRemain, nextBankStart);
});

test('口座振替は今月の支出として1回だけ引かれる', () => {
  const r = spendableFromBalance({
    bankStart: 300000, walletStart: 0, salary: 400000, savings: 120000,
    spentBudget: 80000, fixedPlanned: 80000, fixedRecorded: 80000, pendingFixed: 0
  });
  assert.equal(r.freeRemain, 300000 + 400000 - 120000 - 80000);
});

test('ATMで生活口座から財布へ移しても使えるお金は変わらない', () => {
  const common = { salary: 0, savings: 0, spentBudget: 0, fixedPlanned: 0, fixedRecorded: 0, pendingFixed: 0 };
  const before = spendableFromBalance({ ...common, bankStart: 100000, walletStart: 10000 });
  const after = spendableFromBalance({ ...common, bankStart: 70000, walletStart: 40000 });
  assert.equal(before.freeRemain, after.freeRemain);
});

test('未記録の固定費は予定として差し引き、記録されたら二重に引かない', () => {
  const common = { bankStart: 300000, walletStart: 0, salary: 0, savings: 0, fixedPlanned: 80000 };
  const before = spendableFromBalance({ ...common, spentBudget: 0, fixedRecorded: 0, pendingFixed: 80000 });
  const after = spendableFromBalance({ ...common, spentBudget: 80000, fixedRecorded: 80000, pendingFixed: 0 });
  assert.equal(before.freeRemain, 220000);
  assert.equal(after.freeRemain, 220000);
});

test('貯金から払った支出は、支払方法に関係なく貯金用の口座から引かれる', () => {
  const common = { salary: 0, savings: 0, atm: 0, salaryAccountId: 'smbc', savingsAccountId: 'smtb', savingsSpent: 78000 };
  // 貯金から払った分は支払方法の引落（bills）には含めない前提
  const smbc = forecastAccount({ ...common, accountId: 'smbc', start: 200000, bills: 0 });
  const smtb = forecastAccount({ ...common, accountId: 'smtb', start: 664570, bills: 0 });
  assert.equal(smbc.projected, 200000);        // 生活用の口座は減らない
  assert.equal(smtb.projected, 664570 - 78000); // 貯金用の口座から出る
});

test('貯金用の口座が未設定なら、貯金からの支出をどの口座にも割り当てない', () => {
  const r = forecastAccount({ accountId: 'smbc', start: 100000, salary: 0, savings: 0, bills: 0, atm: 0, salaryAccountId: 'smbc', savingsAccountId: '', savingsSpent: 50000 });
  assert.equal(r.projected, 100000);
});

test('口座間の振替は、出す口座で減り受ける口座で増え、合計は変わらない', () => {
  const transfers = [{ from: 'smbc', to: 'rakuten', amount: 594 }];
  const common = { salary: 0, savings: 0, atm: 0, salaryAccountId: 'smbc', savingsAccountId: 'smtb', transfers };
  // 楽天カードの594円は楽天銀行から引き落とされる（現実どおりの設定）
  const smbc = forecastAccount({ ...common, accountId: 'smbc', start: 100000, bills: 0 });
  const rakuten = forecastAccount({ ...common, accountId: 'rakuten', start: 594, bills: 594 });
  assert.equal(smbc.projected, 100000 - 594);
  assert.equal(rakuten.projected, 594);                       // 594入って594出る → 594のまま
  assert.equal(smbc.projected + rakuten.projected, 100000);   // 合計は振替前と同じ
});

test('生活用の口座どうしの振替は予算に影響しない。貯金用との振替は影響する', () => {
  const living = new Set(['smbc', 'rakuten']);
  assert.equal(transferEffectOnLiving([{ from: 'smbc', to: 'rakuten', amount: 594 }], living), 0);
  assert.equal(transferEffectOnLiving([{ from: 'smbc', to: 'smtb', amount: 10000 }], living), -10000);
  assert.equal(transferEffectOnLiving([{ from: 'smtb', to: 'smbc', amount: 78000 }], living), 78000);
});

test('同じ口座どうし・金額が0の振替は無視する', () => {
  assert.deepEqual(transferTotals('smbc', [{ from: 'smbc', to: 'smbc', amount: 1000 }, { from: 'smbc', to: 'rakuten', amount: 0 }]), { transferIn: 0, transferOut: 0 });
});
