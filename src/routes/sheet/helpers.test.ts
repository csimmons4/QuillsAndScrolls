import { describe, it, expect } from 'vitest'
import { computeFullAC, resolveWeapon, weaponAttackBonus, weaponDamageMod, isMonkWeapon, isWeaponProficient, spellRole, spellHealing } from './helpers'
import { content, makeChar, equipped } from '../../test/fixtures'

const ac = (c: ReturnType<typeof makeChar>) => computeFullAC(c, 0, content().items, undefined).ac
const weapon = (slug: string) => resolveWeapon({ itemSlug: slug, name: slug }, content().items)!

describe('armor class', () => {
  it('is 10 + DEX with nothing on', () => {
    expect(ac(makeChar([{ classSlug: 'wizard', level: 1 }], { dex: 14 }))).toBe(12)
  })
  it('adds full DEX to light armor and caps it at +2 in medium', () => {
    expect(ac(makeChar([{ classSlug: 'rogue', level: 1 }], { dex: 16 }, { equipment: [equipped('leather')] }))).toBe(11 + 3)
    expect(ac(makeChar([{ classSlug: 'fighter', level: 1 }], { dex: 16 }, { equipment: [equipped('half-plate')] }))).toBe(15 + 2)
  })
  it('ignores DEX in heavy armor, and adds a shield and the Defense style', () => {
    const c = makeChar([{ classSlug: 'fighter', level: 1 }], { dex: 14 }, {
      equipment: [equipped('chain-mail'), equipped('shield')],
      featuresChosen: [{ key: 'fighting-style', value: 'defense' }],
    })
    expect(ac(c)).toBe(16 + 2 + 1)
  })
  it('uses the better Unarmored Defense: barbarian adds CON, monk adds WIS', () => {
    expect(ac(makeChar([{ classSlug: 'barbarian', level: 1 }], { dex: 14, con: 16 }))).toBe(10 + 2 + 3)
    expect(ac(makeChar([{ classSlug: 'monk', level: 1 }], { dex: 16, wis: 16 }))).toBe(10 + 3 + 3)
  })
  it('makes Mage Armor 13 + DEX, only without armor', () => {
    const wiz = makeChar([{ classSlug: 'wizard', level: 1 }], { dex: 14 })
    expect(computeFullAC(wiz, 0, content().items, undefined, 0, 2, true).ac).toBe(13 + 2)
    const armored = makeChar([{ classSlug: 'fighter', level: 1 }], { dex: 14 }, { equipment: [equipped('leather')] })
    expect(computeFullAC(armored, 0, content().items, undefined, 0, 2, true).ac).toBe(11 + 2)
  })
  it("loses the monk's Unarmored Defense with a shield, but not the barbarian's", () => {
    expect(ac(makeChar([{ classSlug: 'monk', level: 1 }], { dex: 16, wis: 16 }, { equipment: [equipped('shield')] }))).toBe(10 + 3 + 2)
    expect(ac(makeChar([{ classSlug: 'barbarian', level: 1 }], { dex: 14, con: 16 }, { equipment: [equipped('shield')] }))).toBe(10 + 2 + 3 + 2)
  })
})

describe('weapon attacks', () => {
  it('uses STR for melee, the better of STR/DEX for finesse, DEX for ranged', () => {
    const c = makeChar([{ classSlug: 'fighter', level: 1 }], { str: 16, dex: 12 })
    expect(weaponAttackBonus(c, weapon('longsword'), 2)).toBe(3 + 2)
    const d = makeChar([{ classSlug: 'rogue', level: 1 }], { str: 10, dex: 16 })
    expect(weaponAttackBonus(d, weapon('rapier'), 2)).toBe(3 + 2)
    expect(weaponDamageMod(d, weapon('rapier'))).toBe(3)
    expect(weaponAttackBonus(d, weapon('shortbow'), 2)).toBe(3 + 2)
  })
  it('adds +2 to ranged attacks with the Archery style', () => {
    const c = makeChar([{ classSlug: 'fighter', level: 1 }], { dex: 16 }, { featuresChosen: [{ key: 'fighting-style', value: 'archery' }] })
    expect(weaponAttackBonus(c, weapon('longbow'), 2)).toBe(3 + 2 + 2)
  })
  it('lets a monk use DEX with monk weapons (Martial Arts), but not with others', () => {
    const monk = makeChar([{ classSlug: 'monk', level: 1 }], { str: 10, dex: 16 })
    expect(isMonkWeapon(monk, weapon('quarterstaff'))).toBe(true)
    expect(isMonkWeapon(monk, weapon('shortsword'))).toBe(true)
    expect(isMonkWeapon(monk, weapon('greatclub'))).toBe(false)  // two-handed
    expect(isMonkWeapon(monk, weapon('longsword'))).toBe(false)  // martial
    expect(weaponAttackBonus(monk, weapon('quarterstaff'), 2)).toBe(3 + 2)
    expect(weaponDamageMod(monk, weapon('quarterstaff'))).toBe(3)
    const fighter = makeChar([{ classSlug: 'fighter', level: 1 }], { str: 10, dex: 16 })
    expect(weaponAttackBonus(fighter, weapon('quarterstaff'), 2)).toBe(0 + 2)
  })
  it('checks weapon proficiency by category and by name', () => {
    const c = makeChar([{ classSlug: 'wizard', level: 1 }], {}, { weaponProficiencies: ['simple', 'Pistol'] })
    expect(isWeaponProficient(c, equipped('dagger'))).toBe(true)
    expect(isWeaponProficient(c, equipped('longsword'))).toBe(false)
  })
})

describe('spell role (the coloured mark on a spell row)', () => {
  const role = (slug: string) => spellRole(content().spells.find(s => s.slug === slug)!)
  it('puts damage first, then healing, control, protection and the rest', () => {
    expect(role('fire-bolt')).toBe('damage')
    expect(role('vampiric-touch')).toBe('damage')       // heals too, but it's an attack
    expect(role('cure-wounds')).toBe('heal')
    expect(role('healing-word')).toBe('heal')
    expect(role('revivify')).toBe('heal')
    expect(role('lesser-restoration')).toBe('heal')
    expect(role('hold-person')).toBe('control')
    expect(role('sleep')).toBe('control')
    expect(role('shield')).toBe('ward')
    expect(role('counterspell')).toBe('ward')
    expect(role('detect-magic')).toBe('utility')
    expect(role('light')).toBe('utility')
    expect(role('wish')).toBe('utility')
  })
  it('reads how much a healing spell heals', () => {
    const heal = (slug: string) => spellHealing(content().spells.find(s => s.slug === slug)!)
    expect(heal('cure-wounds')).toEqual({ dice: '1d8', addMod: true })
    expect(heal('heal')).toEqual({ dice: '70', addMod: false })
    expect(heal('revivify')).toBeNull()
  })
})
