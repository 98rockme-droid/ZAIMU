// ATM withdrawals always move money into cash. Only an explicit budget transfer
// reduces the amount available for card spending. Older records keep their
// previous budget effect until the user edits them.
export function cashTopupTotals(topups = []) {
  return topups.reduce((totals, item) => {
    const amount = Number(item.amount) || 0;
    totals.cash += amount;
    if (item.shiftCardBudget !== false) totals.cardToCash += amount;
    return totals;
  }, { cash: 0, cardToCash: 0 });
}

// Spendable cash in the monthly plan is not the same as physical cash in hand.
export function remainingCashBudget(startCash, cardToCash, cashSpent) {
  return startCash + cardToCash - cashSpent;
}

export function forecastAccount({ accountId, start, salary, savings, bills, atm, salaryAccountId, savingsAccountId, cashAccountId }) {
  // A savings transfer changes account locations, not the total amount of money.
  // If both roles point to the same account (or either is missing), no transfer
  // can be inferred from the savings plan alone.
  const movesSavings = Boolean(salaryAccountId && savingsAccountId && salaryAccountId !== savingsAccountId);
  const inSalary = salaryAccountId === accountId ? salary : 0;
  const inSavings = movesSavings && savingsAccountId === accountId ? savings : 0;
  const outSavings = movesSavings && salaryAccountId === accountId ? savings : 0;
  const outAtm = (cashAccountId || salaryAccountId) === accountId ? atm : 0;
  return {
    inSalary, inSavings, outSavings, outAtm,
    projected: start + inSalary + inSavings - bills - outSavings - outAtm
  };
}
