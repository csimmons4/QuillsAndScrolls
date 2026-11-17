import { describe, it, expect } from 'vitest'
import {
  abilityMod, proficiencyBonus, profBonus, hpMax, skillMod, saveMod, initiativeBonus,
  spellSaveDC, spellAttackBonus, sneakAttackDice, monkSpeedBonus, paladinAuraBonus, deriveClassResources,
} from './derive'
import { content, makeChar } from '../test/fixtures'

const resource = (c: ReturnType<typeof makeChar>, key: string) => deriveClassResources(c).find(r => r.key === key)

describe('ability modifiers and proficiency', () => {
  it('follows the PHB modifier table', () => {
    expect([1, 8, 9, 10, 11, 15, 20, 30].map(abilityMod)).toEqual([-5, -1, -1, 0, 0, 2, 5, 10])
  })
  it('raises the proficiency bonus at 5, 9, 13 and 17', () => {
    expect([1, 4, 5, 8, 9, 13, 17, 20].map(proficiencyBonus)).toEqual([2, 2, 3, 3, 4, 5, 6, 6])
    expect(profBonus(makeChar([{ classSlug: 'wizard', level: 3 }, { classSlug: 'cleric', level: 2 }]))).toBe(3)
  })
})

describe('hit points', () => {
  it('adds CON to every hit die', () => {
    const c = makeChar([{ classSlug: 'fighter', level: 3, hitDieRolls: [10, 6, 6] }], { con: 14 })
    expect(hpMax(c, content())).toBe(10 + 6 + 6 + 3 * 2)
  })
  it('uses the average for levels without a recorded roll', () => {
    const c = makeChar([{ classSlug: 'wizard', level: 2, hitDieRolls: [6] }], { con: 10 })
    expect(hpMax(c, content())).toBe(6 + 4)
  })
  it('adds 1 per sorcerer level for Draconic Resilience', () => {
    const c = makeChar([{ classSlug: 'sorcerer', subclassSlug: 'draconic', level: 3, hitDieRolls: [6, 4, 4] }])
    expect(hpMax(c, content())).toBe(14 + 3)
  })
  it('respects a maximum set by hand', () => {
    const c = makeChar([{ classSlug: 'fighter', level: 5 }], {}, { hp: { current: 1, temp: 0, maxOverride: 77 } })
    expect(hpMax(c, content())).toBe(77)
  })
})

describe('skills, saves and initiative', () => {
  it('doubles proficiency for expertise', () => {
    const c = makeChar([{ classSlug: 'rogue', level: 1 }], { dex: 16 }, { skillProficiencies: ['stealth'], skillExpertise: ['stealth'] })
    expect(skillMod(c, 'stealth')).toBe(3 + 4)
  })
  it('gives a bard half proficiency (rounded down) on skills they lack, from level 2', () => {
    const bard1 = makeChar([{ classSlug: 'bard', level: 1 }])
    const bard5 = makeChar([{ classSlug: 'bard', level: 5 }])
    expect(skillMod(bard1, 'arcana')).toBe(0)
    expect(skillMod(bard5, 'arcana')).toBe(1)  // PB 3 → 1
  })
  it('gives a Champion 7 half proficiency rounded up on STR/DEX/CON checks, initiative included', () => {
    const c = makeChar([{ classSlug: 'fighter', subclassSlug: 'champion', level: 7 }], { dex: 14 })
    expect(initiativeBonus(c)).toBe(2 + 2)  // PB 3 → 2
    expect(skillMod(c, 'arcana')).toBe(0)   // INT isn't covered
  })
  it('adds proficiency only to proficient saves', () => {
    const c = makeChar([{ classSlug: 'fighter', level: 5 }], { str: 16, int: 8 }, { saveProficiencies: ['str', 'con'] })
    expect(saveMod(c, 'str')).toBe(3 + 3)
    expect(saveMod(c, 'int')).toBe(-1)
  })
})

describe('spellcasting numbers', () => {
  it('works out save DC and attack from the casting ability', () => {
    const c = makeChar([{ classSlug: 'wizard', level: 5 }], { int: 18 })
    expect(spellSaveDC(c, 'wizard', content())).toBe(8 + 3 + 4)
    expect(spellAttackBonus(c, 'wizard', content())).toBe(3 + 4)
  })
  it('lets an Eldritch Knight cast with INT', () => {
    const c = makeChar([{ classSlug: 'fighter', subclassSlug: 'eldritch-knight', level: 3 }], { int: 16 })
    expect(spellSaveDC(c, 'fighter', content())).toBe(8 + 2 + 3)
  })
})

describe('class features with numbers', () => {
  it('scales sneak attack, monk speed and the paladin aura', () => {
    expect(sneakAttackDice(makeChar([{ classSlug: 'rogue', level: 5 }]))).toBe(3)
    expect(monkSpeedBonus(makeChar([{ classSlug: 'monk', level: 6 }]))).toBe(15)
    expect(paladinAuraBonus(makeChar([{ classSlug: 'paladin', level: 5 }], { cha: 18 }))).toBe(0)
    expect(paladinAuraBonus(makeChar([{ classSlug: 'paladin', level: 6 }], { cha: 18 }))).toBe(4)
    expect(paladinAuraBonus(makeChar([{ classSlug: 'paladin', level: 6 }], { cha: 8 }))).toBe(1)
  })
})

describe('class resources', () => {
  it('gives barbarians the PHB number of rages, unlimited at 20', () => {
    const rages = [1, 3, 6, 12, 17].map(l => resource(makeChar([{ classSlug: 'barbarian', level: l }]), 'rage-uses')?.max)
    expect(rages).toEqual([2, 3, 4, 5, 6])
    expect(resource(makeChar([{ classSlug: 'barbarian', level: 20 }]), 'rage-uses')?.max).toBeNull()
  })
  it("doesn't hand a barbarian another class's resources", () => {
    const keys = deriveClassResources(makeChar([{ classSlug: 'barbarian', level: 6 }])).map(r => r.key)
    expect(keys).not.toContain('bardic-inspiration')
  })
  it('bases Bardic Inspiration on CHA and lets it come back on a short rest from level 5', () => {
    const b4 = resource(makeChar([{ classSlug: 'bard', level: 4 }], { cha: 16 }), 'bardic-inspiration')
    const b5 = resource(makeChar([{ classSlug: 'bard', level: 5 }], { cha: 16 }), 'bardic-inspiration')
    expect(b4).toMatchObject({ max: 3, recharge: 'long', display: 'd6' })
    expect(b5).toMatchObject({ max: 3, recharge: 'short', display: 'd8' })
    expect(resource(makeChar([{ classSlug: 'bard', level: 1 }], { cha: 8 }), 'bardic-inspiration')?.max).toBe(1)
  })
  it('gives ki and sorcery points equal to class level', () => {
    expect(resource(makeChar([{ classSlug: 'monk', level: 6 }]), 'ki-points')?.max).toBe(6)
    expect(resource(makeChar([{ classSlug: 'sorcerer', level: 5 }]), 'sorcery-points')?.max).toBe(5)
  })
  it('makes Lay on Hands a pool of 5 × paladin level', () => {
    expect(resource(makeChar([{ classSlug: 'paladin', level: 6 }]), 'lay-on-hands')?.max).toBe(30)
  })
  it('gives a Battle Master 4, 5, then 6 superiority dice', () => {
    const dice = [3, 7, 15].map(l => resource(makeChar([{ classSlug: 'fighter', subclassSlug: 'battle-master', level: l }]), 'superiority-dice')?.max)
    expect(dice).toEqual([4, 5, 6])
  })
  it('gives a cleric 1, 2, then 3 Channel Divinity uses', () => {
    const uses = [2, 6, 18].map(l => resource(makeChar([{ classSlug: 'cleric', level: l }]), 'channel-divinity')?.max)
    expect(uses).toEqual([1, 2, 3])
  })
  it('counts what is left from the saved counter, full when none is saved', () => {
    const fresh = makeChar([{ classSlug: 'monk', level: 4 }])
    const spent = makeChar([{ classSlug: 'monk', level: 4 }], {}, { classResources: { 'ki-points': 1 } })
    expect(resource(fresh, 'ki-points')?.current).toBe(4)
    expect(resource(spent, 'ki-points')?.current).toBe(1)
  })
})
