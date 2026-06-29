import { Character, CharacterSchema, SCHEMA_VERSION } from '../character/model'

const KEY_PREFIX = 'qs:'
const CHAR_PREFIX = `${KEY_PREFIX}character:`
const HOMEBREW_KEY = `${KEY_PREFIX}homebrew`

/**
 * Per-version migration steps. Each entry upgrades a character object FROM that
 * version to the next (e.g. key `1` turns a v1 object into a v2 one). Schema
 * changes so far have been additive — new fields are optional or carry Zod
 * defaults — so there are no transforms yet. Add a step here whenever a future
 * SCHEMA_VERSION bump changes the shape in a way the schema can't absorb on its own.
 */
const MIGRATIONS: Record<number, (c: Record<string, unknown>) => Record<string, unknown>> = {
  // 1: c => ({ ...c, someNewField: deriveFrom(c) }),
}

/**
 * Upgrade a raw stored character to the current schema and validate it.
 * Throws if the result can't be parsed — callers decide whether to skip or surface.
 * Used by both the localStorage and disk (charApi) load paths.
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
  return CharacterSchema.parse(obj)
}

export function listCharacters(): Character[] {
  const results: Character[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key?.startsWith(CHAR_PREFIX)) continue
    try {
      const raw = JSON.parse(localStorage.getItem(key)!)
      results.push(migrate(raw))
    } catch (err) {
      console.warn(`[storage] skipping unreadable character at "${key}":`, err)
    }
  }
  return results.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function loadCharacter(id: string): Character | null {
  const raw = localStorage.getItem(`${CHAR_PREFIX}${id}`)
  if (!raw) return null
  try {
    return migrate(JSON.parse(raw))
  } catch (err) {
    console.warn(`[storage] character "${id}" failed to load:`, err)
    return null
  }
}

export function saveCharacter(char: Character): void {
  localStorage.setItem(`${CHAR_PREFIX}${char.id}`, JSON.stringify(char))
}

export function deleteCharacter(id: string): void {
  localStorage.removeItem(`${CHAR_PREFIX}${id}`)
}

export interface HomebrewStore {
  items: unknown[]
  spells: unknown[]
  feats: unknown[]
  races: unknown[]
  classes: unknown[]
  backgrounds: unknown[]
}

export function loadHomebrew(): HomebrewStore {
  const raw = localStorage.getItem(HOMEBREW_KEY)
  if (!raw) return { items: [], spells: [], feats: [], races: [], classes: [], backgrounds: [] }
  try {
    const parsed = JSON.parse(raw)
    return { classes: [], backgrounds: [], ...parsed }
  } catch {
    return { items: [], spells: [], feats: [], races: [], classes: [], backgrounds: [] }
  }
}

export function saveHomebrew(data: HomebrewStore): void {
  localStorage.setItem(HOMEBREW_KEY, JSON.stringify(data))
}
