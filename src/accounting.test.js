import { test } from 'node:test';
import assert from 'node:assert/strict';
import { balanceOn } from './accounting.js';

test('a transfer conserves combined cash and excludes old unlinked spending', () => {
  const bank = { id: 'bank', openingDate: '2026-09-23', openingBalance: 100000 };
  const wallet = { id: 'wallet', openingDate: '2026-09-23', openingBalance: 5000 };
  const entries = [{ date: '2026-09-23', kind: 'move', amount: 10000, fromAccountId: 'bank', toAccountId: 'wallet' }];
  const expenses = [
    { date: '2026-09-23T12:00:00Z', amount: 2000, accountId: 'wallet' },
    { date: '2026-09-23T12:00:00Z', amount: 9000 },
    { date: '2026-09-22T12:00:00Z', amount: 3000, accountId: 'bank' },
  ];
  assert.equal(balanceOn(bank, entries, expenses, '2026-09-23'), 90000);
  assert.equal(balanceOn(wallet, entries, expenses, '2026-09-23'), 13000);
  assert.equal(balanceOn(bank, entries, expenses, '2026-09-23') + balanceOn(wallet, entries, expenses, '2026-09-23'), 103000);
});

test('reconciliation applies only from its date; bank withdrawal does not create a second expense', () => {
  const bank = { id: 'bank', openingDate: '2026-09-23', openingBalance: 10000 };
  const entries = [
    { date: '2026-09-24', kind: 'withdraw', fromAccountId: 'bank', amount: 3000 },
    { date: '2026-09-25', kind: 'adjustment', accountId: 'bank', delta: -500 },
  ];
  assert.equal(balanceOn(bank, entries, [{ date: '2026-09-24', amount: 3000, accountId: null }], '2026-09-24'), 7000);
  assert.equal(balanceOn(bank, entries, [], '2026-09-25'), 6500);
});
