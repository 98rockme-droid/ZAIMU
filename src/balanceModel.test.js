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
