import { Character, CharacterSchema, SCHEMA_VERSION } from '../character/model'

/**
 * Per-version migration steps. Each entry upgrades a character object FROM that
 * version to the next (e.g. key `1` turns a v1 object into a v2 one). Most schema
 * changes have been additive — new fields are optional or carry Zod defaults. Add a
 * step here whenever a SCHEMA_VERSION bump needs existing saves filled in or reshaped.
 */
const MIGRATIONS: Record<number, (c: Record<string, unknown>) => Record<string, unknown>> = {
  // v5 → v6: spell entries record what granted them. Feat picks (freeUseKey "feat:<slug>:…") and
  // Strixhaven picks can be told apart; a feat's cantrips and the High Elf cantrip can't, so
  // only new picks are tagged for those.
  5: c => ({
    ...c,
    spells: ((c.spells as Record<string, unknown>[] | undefined) ?? []).map(s => {
      if (s.grantedBy) return s
      const key = typeof s.freeUseKey === 'string' ? s.freeUseKey : ''
      if (key.startsWith('feat:')) return { ...s, grantedBy: `feat:${key.split(':')[1]}` }
      if (s.classSlug === 'strixhaven') return { ...s, grantedBy: 'strixhaven' }
      return s
    }),
  }),
}

/**
 * Upgrade a raw stored character to the current schema and validate it.
 * Throws if the result can't be parsed — callers decide whether to skip or surface.
 * Used by the disk load path (charApi) and file import (ioFile).
 */
export function migrate(raw: unknown): Character {
  let obj = { ...(raw as Record<string, unknown>) }
  let version = typeof obj.schemaVersion === 'number' ? obj.schemaVersion : 0
  while (version < SCHEMA_VERSION) {
    const step = MIGRATIONS[version]
    if (step) obj = step(obj)
    version++
  }
  obj.schemaVersion = SCHEMA_VERSION
  return repair(CharacterSchema.parse(obj))
}

/** Undo damage that earlier versions of the app could leave in a save. */
function repair(c: Character): Character {
  // A choice saved more than once under the same key (level-up used to append a new copy of
  // lists like infusions and maneuvers each time): the most recent copy is the real one.
  const lastIndex = new Map(c.featuresChosen.map((f, i) => [f.key, i]))
  const featuresChosen = c.featuresChosen.filter((f, i) => lastIndex.get(f.key) === i)
  // A class entry with no class (level-up could be applied with nothing selected)
  const classes = c.classes.filter(cc => cc.classSlug)
  const classesOk = classes.length > 0 && classes.length !== c.classes.length
  if (featuresChosen.length === c.featuresChosen.length && !classesOk) return c
  return { ...c, featuresChosen, ...(classesOk ? { classes } : {}) }
}

export interface HomebrewStore {
  items: unknown[]
  spells: unknown[]
  feats: unknown[]
  races: unknown[]
  classes: unknown[]
  backgrounds: unknown[]
}
