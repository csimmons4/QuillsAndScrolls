import { describe, it, expect } from 'vitest'
import { migrate } from './localStore'
import { SCHEMA_VERSION } from '../character/model'
import { makeChar } from '../test/fixtures'

describe('migrating saved characters', () => {
  it('tags v5 feat and Strixhaven spells with what granted them', () => {
    const v5 = {
      ...makeChar([{ classSlug: 'wizard', level: 3 }]),
      schemaVersion: 5,
      spells: [
        { spellSlug: 'misty-step', name: 'Misty Step', classSlug: 'wizard', prepared: true, isHomebrew: false, usesPerLongRest: 1, freeUseKey: 'feat:fey-touched:misty-step' },
        { spellSlug: 'guidance', name: 'Guidance', classSlug: 'strixhaven', prepared: true, isHomebrew: false },
        { spellSlug: 'shield', name: 'Shield', classSlug: 'wizard', prepared: true, isHomebrew: false },
      ],
    }
    const c = migrate(v5)
    expect(c.schemaVersion).toBe(SCHEMA_VERSION)
    expect(c.spells.map(s => s.grantedBy)).toEqual(['feat:fey-touched', 'strixhaven', undefined])
  })
  it('keeps the last copy of a choice saved more than once', () => {
    const c = migrate({
      ...makeChar([{ classSlug: 'artificer', level: 6 }]),
      featuresChosen: [{ key: 'infusions', value: ['a'] }, { key: 'infusions', value: ['a', 'b'] }],
    })
    expect(c.featuresChosen).toEqual([{ key: 'infusions', value: ['a', 'b'] }])
  })
  it('rejects something that isn’t a character', () => {
    expect(() => migrate({ name: 'not a character' })).toThrow()
  })
})
