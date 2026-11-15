import type { Currency } from './model'

export type Coin = keyof Currency

export const COINS: Coin[] = ['cp', 'sp', 'ep', 'gp', 'pp']

/** Value of one coin in copper pieces (PHB p.143). */
export const COIN_CP: Record<Coin, number> = { cp: 1, sp: 10, ep: 50, gp: 100, pp: 1000 }

export function purseTotalCp(c: Currency): number {
  return COINS.reduce((sum, coin) => sum + c[coin] * COIN_CP[coin], 0)
}

/** A copper amount as the fewest gold, silver and copper coins (no electrum or platinum). */
function fromCopper(total: number): Currency {
  return { gp: Math.floor(total / 100), sp: Math.floor((total % 100) / 10), cp: total % 10, ep: 0, pp: 0 }
}

/**
 * The purse is tracked as a single balance, stored as the fewest gold, silver and
 * copper coins for its value, so players only ever see their gold plus loose change.
 */
export function normalizePurse(c: Currency): Currency {
  return fromCopper(purseTotalCp(c))
}

export function addValue(purse: Currency, cp: number): Currency {
  return fromCopper(purseTotalCp(purse) + cp)
}

/** Pay `cp` worth from the purse, or null if it can't cover it. */
export function spendValue(purse: Currency, cp: number): Currency | null {
  const remaining = purseTotalCp(purse) - cp
  return remaining < 0 ? null : fromCopper(remaining)
}

/** "152 gp 4 sp 5 cp" (only the coins present; "0 gp" when empty). */
export function formatPurse(c: Currency): string {
  const p = normalizePurse(c)
  const parts = [p.gp ? `${p.gp.toLocaleString()} gp` : '', p.sp ? `${p.sp} sp` : '', p.cp ? `${p.cp} cp` : ''].filter(Boolean)
  return parts.length ? parts.join(' ') : '0 gp'
}
