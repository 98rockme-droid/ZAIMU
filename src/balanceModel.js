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

// savingsSpent: 充当元が「貯金」の支出。支払方法に関係なく貯金用の口座から出たものとして扱う
//   （貯金から払う＝貯金用の口座のお金を使う、という利用者の感覚に合わせる）
// transfers: 口座間の振替 [{ from, to, amount }]。移動するだけなので口座の合計は変わらない
export function forecastAccount({ accountId, start, salary, savings, bills, atm, salaryAccountId, savingsAccountId, cashAccountId, savingsSpent = 0, transfers = [] }) {
  // A savings transfer changes account locations, not the total amount of money.
  // If both roles point to the same account (or either is missing), no transfer
  // can be inferred from the savings plan alone.
  const movesSavings = Boolean(salaryAccountId && savingsAccountId && salaryAccountId !== savingsAccountId);
  const inSalary = salaryAccountId === accountId ? salary : 0;
  const inSavings = movesSavings && savingsAccountId === accountId ? savings : 0;
  const outSavings = movesSavings && salaryAccountId === accountId ? savings : 0;
  const outAtm = (cashAccountId || salaryAccountId) === accountId ? atm : 0;
  const outSavingsSpent = savingsAccountId && savingsAccountId === accountId ? savingsSpent : 0;
  const { transferIn, transferOut } = transferTotals(accountId, transfers);
  return {
    inSalary, inSavings, outSavings, outAtm, outSavingsSpent, transferIn, transferOut,
    projected: start + inSalary + inSavings + transferIn - bills - outSavings - outAtm - outSavingsSpent - transferOut
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
// 生活用の口座（貯金用以外）と財布の月初残高を起点に、今月入るお金と今月使うお金を差し引く。
//   spentBudget: 今月、予算から使った分（カード・口座振替・現金すべて）
//
// 先月カードで使った分（今月引き落とされる額）は差し引かない。
// それは先月の「使った分」として先月の画面で計算済みで、今月の給与で支払われる。
// ここで引くと、1つの給与に対してカード2ヶ月分を引くことになり二重計上になる。
// （収支がぴったり0の月でも、カード1ヶ月分の赤字が常に出てしまう）
// 今月カードで使った分は来月の給与で払うが、今月の支出として今月に1回だけ数える。
//
// ATMは口座→財布の移動なので、生活用の口座からおろす限り合計は変わらない
export function spendableFromBalance({
  bankStart, walletStart, salary, savings,
  spentBudget, fixedPlanned, fixedRecorded, pendingFixed, cashFromSavings = 0
}) {
  const pool = bankStart + walletStart + salary + cashFromSavings - savings;
  return {
    pool,
    freeBudget: pool - fixedPlanned,          // 固定費を除いた自由に使える額（ペース計算用）
    freeSpent: spentBudget - fixedRecorded,   // 固定費以外で使った額
    freeRemain: pool - spentBudget - pendingFixed
  };
}

// 口座間の振替の入出金を集計する（同じ口座どうし・金額0以下は無視）
export function transferTotals(accountId, transfers = []) {
  let transferIn = 0, transferOut = 0;
  for (const t of transfers) {
    const amount = Number(t.amount) || 0;
    if (!t.from || !t.to || t.from === t.to || amount <= 0) continue;
    if (t.to === accountId) transferIn += amount;
    if (t.from === accountId) transferOut += amount;
  }
  return { transferIn, transferOut };
}

// 予算（今月あと使える）への影響: 生活用の口座どうしの振替は0。
// 生活用→貯金用は使えるお金が減り、貯金用→生活用は増える
export function transferEffectOnLiving(transfers = [], livingIds) {
  let effect = 0;
  for (const t of transfers) {
    const amount = Number(t.amount) || 0;
    if (!t.from || !t.to || t.from === t.to || amount <= 0) continue;
    const fromLiving = livingIds.has(t.from), toLiving = livingIds.has(t.to);
    if (fromLiving && !toLiving) effect -= amount;
    if (!fromLiving && toLiving) effect += amount;
  }
  return effect;
}

// 支払方法1つ分の今月の引落を計算する。
//   cur / prev: 今月・先月にその支払方法で使った額を { living: 予算から, savings: 貯金から } に分けたもの
//   当月払い（口座振替など）は今月使った分、翌月払い（カード）は先月使った分が今月出ていく。
//   貯金から払った分（savingsPortion）は、引落のときに貯金用の口座から補填する前提で、
//   引落口座からは引かず（fromLinked）、貯金用の口座から引く。
//   manual: 明細の金額を手入力した場合はそれを引落額とし、そこから貯金から払った分を除く
export function billForMethod({ timing, manual = 0, cur = { living: 0, savings: 0 }, prev = { living: 0, savings: 0 }, pending = 0 }) {
  const src = timing === 'same' ? cur : prev;
  const savingsPortion = src.savings;
  const auto = src.living + src.savings + (timing === 'same' ? pending : 0);
  const shown = manual > 0 ? manual : auto;
  return { auto, shown, savingsPortion, fromLinked: Math.max(0, shown - savingsPortion) };
}
