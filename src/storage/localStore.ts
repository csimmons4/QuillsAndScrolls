import { Character, CharacterSchema, SCHEMA_VERSION } from '../character/model'

const KEY_PREFIX = 'qs:'
const CHAR_PREFIX = `${KEY_PREFIX}character:`
const HOMEBREW_KEY = `${KEY_PREFIX}homebrew`

function migrate(raw: unknown): Character {
  const obj = raw as Record<string, unknown>
  // Future migrations go here based on obj.schemaVersion
  return CharacterSchema.parse({ ...obj, schemaVersion: SCHEMA_VERSION })
}

export function listCharacters(): Character[] {
  const results: Character[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key?.startsWith(CHAR_PREFIX)) continue
    try {
      const raw = JSON.parse(localStorage.getItem(key)!)
      results.push(migrate(raw))
    } catch {
      // corrupted entry — skip
    }
  }
  return results.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function loadCharacter(id: string): Character | null {
  const raw = localStorage.getItem(`${CHAR_PREFIX}${id}`)
  if (!raw) return null
  try {
    return migrate(JSON.parse(raw))
  } catch {
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
}

export function loadHomebrew(): HomebrewStore {
  const raw = localStorage.getItem(HOMEBREW_KEY)
  if (!raw) return { items: [], spells: [], feats: [], races: [], classes: [] }
  try {
    const parsed = JSON.parse(raw)
    return { classes: [], ...parsed }
  } catch {
    return { items: [], spells: [], feats: [], races: [], classes: [] }
  }
}

export function saveHomebrew(data: HomebrewStore): void {
  localStorage.setItem(HOMEBREW_KEY, JSON.stringify(data))
}
