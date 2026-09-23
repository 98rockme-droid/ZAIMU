// Account balances are physical money, separate from monthly budgets and savings envelopes.
// Older expenses have no accountId and must never be assigned to an account implicitly.
export const balanceOn = (account, entries, transactions, throughDate) => {
  const start = account.openingDate;
  let balance = Number(account.openingBalance) || 0;
  const applies = date => date && date >= start && date.slice(0, 10) <= throughDate;
  for (const entry of entries) {
    if (!applies(entry.date)) continue;
    const amount = Number(entry.amount) || 0;
    if (entry.fromAccountId === account.id) balance -= amount;
    if (entry.toAccountId === account.id) balance += amount;
    if (entry.kind === 'adjustment' && entry.accountId === account.id) balance += Number(entry.delta) || 0;
  }
  for (const expense of transactions) {
    if (expense.accountId === account.id && applies(expense.date)) balance -= Number(expense.amount) || 0;
  }
  return balance;
};

export const asDate = date => date ? date.slice(0, 10) : '';
