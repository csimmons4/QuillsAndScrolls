import { describe, it, expect } from 'vitest'
import { normalizePurse, addValue, spendValue, formatPurse, purseTotalCp } from './currency'

const purse = (c: Partial<Record<'cp' | 'sp' | 'ep' | 'gp' | 'pp', number>>) => ({ cp: 0, sp: 0, ep: 0, gp: 0, pp: 0, ...c })

describe('coin purse', () => {
  it('keeps one balance as the fewest gold, silver and copper', () => {
    expect(normalizePurse(purse({ cp: 125 }))).toEqual(purse({ gp: 1, sp: 2, cp: 5 }))
    expect(normalizePurse(purse({ pp: 1, ep: 1 }))).toEqual(purse({ gp: 10, sp: 5 }))
    expect(purseTotalCp(purse({ gp: 2, sp: 3, cp: 4 }))).toBe(234)
  })
  it('gains and spends by value, and refuses what it can’t afford', () => {
    expect(addValue(purse({ gp: 1 }), 250)).toEqual(purse({ gp: 3, sp: 5 }))
    expect(spendValue(purse({ gp: 1 }), 30)).toEqual(purse({ sp: 7 }))
    expect(spendValue(purse({ sp: 5 }), 100)).toBeNull()
  })
  it('reads the balance out', () => {
    expect(formatPurse(purse({ cp: 15245 }))).toBe('152 gp 4 sp 5 cp')
    expect(formatPurse(purse({}))).toBe('0 gp')
  })
})
