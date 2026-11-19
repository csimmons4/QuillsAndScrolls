import { describe, it, expect } from 'vitest'
import { WILD_SHAPE_BEASTS, ELEMENTAL_FORMS, wildShapeLimits, wildShapeBlocked, canElementalWildShape } from './wildShapeBeasts'

const beast = (slug: string) => WILD_SHAPE_BEASTS.find(b => b.slug === slug)!

describe('Wild Shape limits (PHB p.66)', () => {
  it('follows the druid table: CR 1/4, then 1/2 and swimming at 4, CR 1 and flying at 8', () => {
    expect(wildShapeLimits(2, false)).toEqual({ maxCr: 0.25, swim: false, fly: false })
    expect(wildShapeLimits(4, false)).toEqual({ maxCr: 0.5, swim: true, fly: false })
    expect(wildShapeLimits(8, false)).toEqual({ maxCr: 1, swim: true, fly: true })
  })

  it('lets Circle of the Moon take CR 1 from level 2, then level ÷ 3 from 6', () => {
    expect(wildShapeLimits(2, true).maxCr).toBe(1)
    expect(wildShapeLimits(6, true).maxCr).toBe(2)
    expect(wildShapeLimits(9, true).maxCr).toBe(3)
    expect(wildShapeLimits(18, true).maxCr).toBe(6)
  })

  it('blocks forms over the CR limit or with a movement not yet allowed', () => {
    expect(wildShapeBlocked(beast('wolf'), wildShapeLimits(2, false))).toBeNull()
    expect(wildShapeBlocked(beast('crocodile'), wildShapeLimits(2, true))).toMatch(/Swimming/)
    expect(wildShapeBlocked(beast('giant-eagle'), wildShapeLimits(6, true))).toMatch(/Flying/)
    expect(wildShapeBlocked(beast('mammoth'), wildShapeLimits(17, true))).toMatch(/CR 6/)
    expect(wildShapeBlocked(beast('mammoth'), wildShapeLimits(18, true))).toBeNull()
  })
})

describe('Elemental Wild Shape', () => {
  it('is Circle of the Moon from level 10 only', () => {
    expect(canElementalWildShape(10, true)).toBe(true)
    expect(canElementalWildShape(9, true)).toBe(false)
    expect(canElementalWildShape(10, false)).toBe(false)
  })

  it('offers the four elementals, each marked as costing both uses', () => {
    expect(ELEMENTAL_FORMS.map(e => e.slug)).toEqual(['air-elemental', 'earth-elemental', 'fire-elemental', 'water-elemental'])
    expect(ELEMENTAL_FORMS.every(e => e.elemental && e.immunities?.includes('poison'))).toBe(true)
  })
})

describe('beast data', () => {
  it('has a usable stat line for every form', () => {
    for (const b of [...WILD_SHAPE_BEASTS, ...ELEMENTAL_FORMS]) {
      expect(b.hp, b.name).toBeGreaterThan(0)
      expect(b.ac, b.name).toBeGreaterThanOrEqual(10)
      expect(b.speed > 0 || !!b.otherSpeeds, b.name).toBe(true)
      for (const a of b.attacks) expect(a.damage, `${b.name} ${a.name}`).toMatch(/^(\d+d\d+([+-]\d+)?|\d+)$/)
    }
    expect(new Set(WILD_SHAPE_BEASTS.map(b => b.slug)).size).toBe(WILD_SHAPE_BEASTS.length)
  })
})
