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

// 単発の振替（ATMでおろす＝口座→財布 など）のうち、財布の増減。
//   moves: [{ from, to, amount }]  from / to は口座IDか 'wallet'
export function walletMoveTotal(moves = []) {
  let net = 0;
  for (const m of moves) {
    const amount = Number(m.amount) || 0;
    if (!m.from || !m.to || m.from === m.to || amount <= 0) continue;
    if (m.to === 'wallet') net += amount;
    if (m.from === 'wallet') net -= amount;
  }
  return net;
}

// 毎月の振替（ひな形）を、その月の振替に展開する。
//   templates: 設定の「毎月の振替」[{ id, from, to, amount, day, title, startMonth }]
//   moves:     その月に記録済みの振替（ひな形から作られた記録は templateId を持つ）
//   skipped:   その月にスキップしたひな形のID
// ・登録した月（startMonth）より前の月には適用しない（過去の数字を変えない）
// ・その月の記録がすでにあれば記録の方を使う（月ごとに金額を編集できる）
// ・まだ記録されていなければ、ひな形の金額を予定として使う
export function transfersForMonth(templates = [], month, moves = [], skipped = []) {
  const recorded = new Set(moves.filter(m => m.templateId).map(m => m.templateId));
  const pending = templates.filter(t =>
    t.id && (!t.startMonth || t.startMonth <= month) && !skipped.includes(t.id) && !recorded.has(t.id)
  );
  return [...moves, ...pending];
}

// その月に自動で記録すべき振替（振替日を過ぎていて、まだ記録もスキップもされていないもの）
export function dueTransferRecords(templates = [], month, moves = [], skipped = [], todayD, lastDay) {
  const recorded = new Set(moves.filter(m => m.templateId).map(m => m.templateId));
  return templates
    .filter(t => t.id && (!t.startMonth || t.startMonth <= month) && !skipped.includes(t.id) && !recorded.has(t.id))
    .filter(t => Math.min(Number(t.day) || 1, lastDay) <= todayD)
    .map(t => {
      const d = Math.min(Number(t.day) || 1, lastDay);
      return {
        id: `tr_${t.id}_${month}`, templateId: t.id,
        date: `${month}-${String(d).padStart(2, '0')}`,
        from: t.from, to: t.to, amount: Number(t.amount) || 0, memo: t.title || ''
      };
    });
}

// ---- 現在の残高（今日時点） ----
// 月末の見込みは「今月これから起きること」も含む。現在の残高は、今日までに実際に起きたことだけを数える。

// 日付（YYYY-MM-DD）が今日以前か。日付のない予定（まだ記録されていない毎月の振替など）は含めない
export function happenedBy(date, today) {
  return typeof date === 'string' && date.length >= 10 && date.slice(0, 10) <= today;
}

// 給料日になったか（月末より後の日付は月末に寄せる）。給与の入金と先取りの移動はこの日に起きたものとして扱う
export function salaryArrived(salaryDay, todayD, lastDay) {
  const d = Math.min(Number(salaryDay) || 25, lastDay);
  return todayD >= d;
}

// 支払方法1つ分の、今日までに実際に引き落とされた額。
//   翌月払い（カード）: 引落日を過ぎていれば先月分の全額。引落日が未設定ならまだ引かない
//   当月払い（口座振替など）: 今日までの日付で記録した分。明細の手入力があり引落日を過ぎていればその額
//   curToDate: 今月、今日までに使った分 { living, savings }
export function billPaidByToday({ timing, manual = 0, due, todayD, cur, curToDate, prev }) {
  const dueD = Number(due) || 0;
  const passed = dueD > 0 && dueD <= todayD;
  if (timing === 'same') {
    if (manual > 0 && passed) return billForMethod({ timing, manual, cur, prev });
    return billForMethod({ timing, cur: curToDate });
  }
  if (!passed) return { auto: 0, shown: 0, savingsPortion: 0, fromLinked: 0 };
  return billForMethod({ timing, manual, cur, prev });
}

// ---- 積立グループ（ライブ用など「使う予定のお金」） ----
// 貯金用の口座のうち、目的が決まっているお金。スタート時の残りに毎月の先取りを積み上げ、
// そのグループから払った支出を引く。使わなかった分は翌月以降に繰り越される。
//   startMonth:     計算を始める月（YYYY-MM）。startBalance はその月の初めの残り
//   amountsByMonth: { 'YYYY-MM': その月の先取り額 }（先取り項目と名前でつなぐ）
//   currentArrived: 表示月の先取りがもう入ったか（今月は給料日から。過去・未来の月は true）
//   spent:          そのグループから払った額（スタート月の初め〜表示の時点。使った日に減らす）
// 表示月がスタート月より前なら null（まだ始まっていない）
export function fundBalance({ startBalance = 0, startMonth, month, amountsByMonth = {}, currentArrived = true, spent = 0 }) {
  if (!startMonth || !month || month < startMonth) return null;
  let added = 0;
  for (const [m, amount] of Object.entries(amountsByMonth)) {
    if (m < startMonth || m > month) continue;
    if (m === month && !currentArrived) continue;
    added += Number(amount) || 0;
  }
  return (Number(startBalance) || 0) + added - (Number(spent) || 0);
}

// 貯金から払ったけれど、まだ貯金用の口座から出ていないお金（カードの引落待ち）。
// 支出の時点で積立・貯金からは「もう使ったお金」なので、口座の残高からも除いて考える。
//   rows: 支払方法ごとの { timing, savingsPortion, paidSavings }
//         翌月払いは先月分が今月の引落日に出る → 引落前なら未払い
//   curNextSavings: 今月、翌月払いの支払方法で貯金から払った分（来月の引落で出る）
export function savingsPendingOut({ rows = [], curNextSavings = 0 }) {
  const prevUnpaid = rows
    .filter(r => r.timing !== 'same')
    .reduce((s, r) => s + Math.max(0, (Number(r.savingsPortion) || 0) - (Number(r.paidSavings) || 0)), 0);
  return prevUnpaid + (Number(curNextSavings) || 0);
}

// 純粋な貯金 ＝ 貯金用の口座の残高 − 積立グループの残り − 引落待ちの貯金払い
export function pureSavings({ accountBalance = 0, fundRemains = [], pendingOut = 0 }) {
  const funds = fundRemains.reduce((s, v) => s + (Number(v) || 0), 0);
  return (Number(accountBalance) || 0) - funds - (Number(pendingOut) || 0);
}
