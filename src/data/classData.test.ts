import { describe, it, expect } from 'vitest'
import { effectiveCasterLevel, multiclassSpellSlotsMax, PACT_SLOT_TABLE, maxSpellLevelAt } from './classData'
import { content } from '../test/fixtures'

const cls = (classSlug: string, level: number, subclassSlug?: string) => ({ classSlug, level, subclassSlug, hitDieRolls: [] })

describe('multiclass spell slots (PHB p.164)', () => {
  it('adds full casters, half of half casters and a third of third casters', () => {
    expect(effectiveCasterLevel([cls('wizard', 3), cls('cleric', 2)])).toBe(5)
    expect(effectiveCasterLevel([cls('paladin', 4), cls('sorcerer', 3)])).toBe(2 + 3)
    expect(effectiveCasterLevel([cls('fighter', 6, 'eldritch-knight'), cls('wizard', 1)])).toBe(2 + 1)
  })
  it('rounds the artificer up', () => {
    expect(effectiveCasterLevel([cls('artificer', 3), cls('wizard', 1)])).toBe(2 + 1)
  })
  it("doesn't count warlock levels (Pact Magic is separate)", () => {
    expect(effectiveCasterLevel([cls('warlock', 5), cls('sorcerer', 2)])).toBe(2)
  })
  it('uses the multiclass slot table', () => {
    expect(multiclassSpellSlotsMax([cls('wizard', 3), cls('cleric', 2)])).toMatchObject({ '1': 4, '2': 3, '3': 2 })
  })
})

describe('slot tables', () => {
  it('gives warlocks the PHB pact slots', () => {
    expect(PACT_SLOT_TABLE[0]).toEqual([1, 1])
    expect(PACT_SLOT_TABLE[4]).toEqual([3, 2])
    expect(PACT_SLOT_TABLE[10]).toEqual([5, 3])
  })
  it('caps the spell level a class can learn as if single-classed', () => {
    const table = (slug: string) => content().classes.find(c => c.slug === slug)?.spellSlotTable
    expect(maxSpellLevelAt('wizard', 5, table('wizard'))).toBe(3)
    expect(maxSpellLevelAt('paladin', 5, table('paladin'))).toBe(2)
    expect(maxSpellLevelAt('warlock', 11)).toBe(5)
  })
})
