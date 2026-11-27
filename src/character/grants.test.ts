import { describe, it, expect } from 'vitest'
import { resolveFeatGrants, withFeatClassChoice } from './grants'
import { content } from '../test/fixtures'

const data = content()
const feat = (slug: string) => data.feats.find(f => f.slug === slug)!
const offered = (slug: string, cls?: string) => {
  const f = cls ? withFeatClassChoice(feat(slug), cls) : feat(slug)
  return resolveFeatGrants(f, data.spells).flatMap(p => p.kind === 'spells' ? p.fromSpells : [])
}

describe('feat spell choices', () => {
  it('Fey Touched offers 1st-level divination and enchantment spells (TCoE p.79)', () => {
    const spells = offered('fey-touched')
    expect(new Set(spells.map(s => s.school.toLowerCase()))).toEqual(new Set(['divination', 'enchantment']))
    expect(spells.every(s => s.level === 1)).toBe(true)
    expect(spells.map(s => s.slug)).toEqual(expect.arrayContaining(['bless', 'detect-magic']))
  })

  it('Shadow Touched offers 1st-level illusion and necromancy spells (TCoE p.80)', () => {
    const spells = offered('shadow-touched')
    expect(new Set(spells.map(s => s.school.toLowerCase()))).toEqual(new Set(['illusion', 'necromancy']))
    expect(spells.map(s => s.slug)).toEqual(expect.arrayContaining(['silent-image', 'inflict-wounds']))
  })

  it('Spell Sniper offers only cantrips that make an attack roll (PHB p.170)', () => {
    const spells = offered('spell-sniper', 'wizard')
    expect(spells.map(s => s.slug)).toEqual(expect.arrayContaining(['fire-bolt', 'ray-of-frost']))
    expect(spells.map(s => s.slug)).not.toContain('mage-hand')
    expect(spells.every(s => s.level === 0 && !!s.attackRoll)).toBe(true)
  })
})
