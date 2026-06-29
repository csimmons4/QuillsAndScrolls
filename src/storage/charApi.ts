import { Character } from '../character/model'
import { migrate, type HomebrewStore } from './localStore'

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(path, options)
  if (!res.ok) throw new Error(`API ${path} returned ${res.status}`)
  return res.json()
}

// ── Characters ───────────────────────────────────────────────────────────────

/** A character file the server returned but that couldn't be migrated/parsed. */
export interface CharacterLoadFailure {
  /** Best-effort identity pulled from the raw object (may be missing if badly malformed). */
  id?: string
  name?: string
  /** Short, human-readable reason (Zod issues summarized, or the raw error message). */
  error: string
}

export interface CharacterListResult {
  characters: Character[]
  failures: CharacterLoadFailure[]
}

/** Summarize a parse error into a short, display-friendly string. */
function describeLoadError(err: unknown): string {
  const issues = (err as { issues?: { path: (string | number)[]; message: string }[] })?.issues
  if (Array.isArray(issues) && issues.length) {
    const head = issues
      .slice(0, 3)
      .map(i => `${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('; ')
    return issues.length > 3 ? `${head}; +${issues.length - 3} more` : head
  }
  return err instanceof Error ? err.message : String(err)
}

/**
 * Load every character file from disk. Files that fail to migrate/parse are not
 * silently dropped — they're returned in `failures` so the UI can tell the user
 * which characters are hidden and why. The underlying files are left untouched.
 */
export async function listCharactersFromDisk(): Promise<CharacterListResult> {
  const raw: unknown[] = await apiFetch('/api/characters')
  const characters: Character[] = []
  const failures: CharacterLoadFailure[] = []
  for (const r of raw) {
    try {
      characters.push(migrate(r))
    } catch (err) {
      const o = (r ?? {}) as Record<string, unknown>
      failures.push({
        id: typeof o.id === 'string' ? o.id : undefined,
        name: typeof o.name === 'string' ? o.name : undefined,
        error: describeLoadError(err),
      })
      console.warn('[storage] skipping unreadable character from disk:', err)
    }
  }
  characters.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  return { characters, failures }
}

export async function saveCharacterToDisk(char: Character): Promise<void> {
  await apiFetch(`/api/characters/${char.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(char),
  })
}

export async function deleteCharacterFromDisk(id: string): Promise<void> {
  await apiFetch(`/api/characters/${id}`, { method: 'DELETE' })
}

// ── Homebrew ─────────────────────────────────────────────────────────────────

export type HomebrewCategory = 'spells' | 'items' | 'feats' | 'races' | 'classes' | 'backgrounds'

export async function loadHomebrewFromDisk(): Promise<HomebrewStore> {
  try {
    const data = await apiFetch('/api/homebrew')
    return { classes: [], backgrounds: [], ...data }
  } catch {
    return { items: [], spells: [], feats: [], races: [], classes: [], backgrounds: [] }
  }
}

export async function saveHomebrewEntry(
  category: HomebrewCategory,
  entry: Record<string, unknown>
): Promise<void> {
  const slug = String(entry.slug || '').replace(/[^a-z0-9-]/gi, '-') || `entry-${Date.now()}`
  await apiFetch(`/api/homebrew/${category}/${slug}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry),
  })
}

export async function deleteHomebrewEntry(
  category: HomebrewCategory,
  slug: string
): Promise<void> {
  await apiFetch(`/api/homebrew/${category}/${slug}`, { method: 'DELETE' })
}

// Used when importing a full homebrew pack — saves each entry individually
export async function importHomebrewStore(data: HomebrewStore): Promise<void> {
  const validCategories: HomebrewCategory[] = ['spells', 'items', 'feats', 'races', 'classes', 'backgrounds']
  const saves: Promise<void>[] = []
  for (const cat of validCategories) {
    const entries = (data[cat] ?? []) as Record<string, unknown>[]
    for (const entry of entries) {
      saves.push(saveHomebrewEntry(cat, entry))
    }
  }
  await Promise.all(saves)
}
