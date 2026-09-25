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

// 支払方法の引き落としタイミング。
//   next: 使った翌月に口座から出る（クレジットカード）
//   same: 使ったその月に口座から出る（口座振替・デビットなど）
export function methodTimingOf(method, timings = {}) {
  if (timings[method]) return timings[method];
  return /口座振替|デビット/.test(method || '') ? 'same' : 'next';
}

// 残高ベースの「今月あと使える」。
// 生活用の口座（貯金用以外）と財布の月初残高を起点に、今月入るお金と出ていくお金を差し引く。
//   deferredBills: 翌月払いの支払方法で「先月使った分」＝今月の引き落とし
//   spentBudget:   今月、予算から使った分（カード・口座振替・現金すべて）
//                  カードは来月引き落とされるが、使った時点で確定した支出として差し引く
//   当月払い（口座振替）は spentBudget にだけ入り、deferredBills には入らない（二重に引かない）
//   ATMは口座→財布の移動なので、生活用の口座からおろす限り合計は変わらない
export function spendableFromBalance({
  bankStart, walletStart, salary, savings, deferredBills,
  spentBudget, fixedPlanned, fixedRecorded, pendingFixed, cashFromSavings = 0
}) {
  const pool = bankStart + walletStart + salary + cashFromSavings - savings - deferredBills;
  return {
    pool,
    freeBudget: pool - fixedPlanned,          // 固定費を除いた自由に使える額（ペース計算用）
    freeSpent: spentBudget - fixedRecorded,   // 固定費以外で使った額
    freeRemain: pool - spentBudget - pendingFixed
  };
}
