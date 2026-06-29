import { Character } from '../character/model'
import { migrate, type HomebrewStore } from './localStore'

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(path, options)
  if (!res.ok) throw new Error(`API ${path} returned ${res.status}`)
  return res.json()
}

// ── Characters ───────────────────────────────────────────────────────────────

export async function listCharactersFromDisk(): Promise<Character[]> {
  const raw: unknown[] = await apiFetch('/api/characters')
  return raw.flatMap(r => {
    try {
      return [migrate(r)]
    } catch (err) {
      console.warn('[storage] skipping unreadable character from disk:', err)
      return []
    }
  }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
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
