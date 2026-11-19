import { v4 as uuidv4 } from 'uuid'
import { Character } from '../character/model'
import { migrate } from './localStore'
import { listCharactersFromDisk, saveCharacterToDisk, loadHomebrewFromDisk, saveHomebrewEntry, importSnapshot, type HomebrewCategory } from './charApi'

export function exportCharacter(char: Character): void {
  const blob = new Blob([JSON.stringify(char, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${char.name.replace(/[^a-z0-9]/gi, '_')}.json`
  a.click()
  // Some browsers start the download after click() returns
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function importCharacter(file: File): Promise<Character> {
  const text = await file.text()
  return withUsableId(migrate(JSON.parse(text)))
}

/** The server names files after ids and refuses anything but letters, digits and dashes (8–64 of
 *  them): a hand-made file with another kind of id gets a fresh one */
const withUsableId = (char: Character): Character =>
  /^[A-Za-z0-9-]{8,64}$/.test(char.id) ? char : { ...char, id: uuidv4() }

export function exportHomebrew(data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'quills-scrolls-homebrew.json'
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function importHomebrew(file: File): Promise<unknown> {
  const text = await file.text()
  return JSON.parse(text)
}

export async function exportEverything(
  characters: Character[],
  homebrew: unknown,
  // Snapshots by character id then file name, stored as on disk (characters/.history/<id>/<file>)
  history?: Record<string, Record<string, unknown>>,
): Promise<void> {
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  zip.file('homebrew.json', JSON.stringify(homebrew, null, 2))
  const charFolder = zip.folder('characters')!
  for (const char of characters) {
    charFolder.file(`${char.name.replace(/[^a-z0-9]/gi, '_')}_${char.id.slice(0, 8)}.json`, JSON.stringify(char, null, 2))
  }
  for (const [id, snaps] of Object.entries(history ?? {})) {
    const dir = charFolder.folder(`.history/${id}`)!
    for (const [file, snap] of Object.entries(snaps)) dir.file(file, JSON.stringify(snap))
  }
  const blob = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `quills-scrolls-backup-${new Date().toLocaleDateString('en-CA')}.zip`  // local YYYY-MM-DD
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// ── Restoring a backup zip ───────────────────────────────────────────────────

export interface RestoreSummary {
  characters: { added: string[]; copies: string[]; alreadyHere: string[]; unreadable: string[] }
  homebrew: { added: string[]; alreadyHere: number; keptYours: string[] }
  history: { added: number; couldNotAdd: boolean }
}

/** JSON with sorted keys, so two copies of the same data compare equal whatever their key order */
export function stableJson(v: unknown): string {
  return JSON.stringify(v, (_k, val) => val && typeof val === 'object' && !Array.isArray(val)
    ? Object.fromEntries(Object.entries(val).sort(([a], [b]) => a.localeCompare(b))) : val)
}

/** Puts back what a backup zip (Settings → Download Backup) holds, never overwriting anything:
 *  a character the app doesn't have comes back as it was, one it has unchanged is skipped, and one
 *  that has changed since comes in beside it as a copy. Homebrew the app lacks is added; where the
 *  backup's version differs, yours is kept. Earlier versions (History) are added by file name. */
export async function restoreBackup(file: File): Promise<RestoreSummary> {
  const { default: JSZip } = await import('jszip')
  const zip = await JSZip.loadAsync(file)
  const charFiles = zip.file(/^characters\/[^/]+\.json$/)
  const historyFiles = zip.file(/^characters\/\.history\/[^/]+\/[^/]+\.json$/)
  const homebrewFile = zip.file('homebrew.json')
  if (!charFiles.length && !homebrewFile) throw new Error('Not a Quills & Scrolls backup')

  const summary: RestoreSummary = {
    characters: { added: [], copies: [], alreadyHere: [], unreadable: [] },
    homebrew: { added: [], alreadyHere: 0, keptYours: [] },
    history: { added: 0, couldNotAdd: false },
  }

  const { characters: existing } = await listCharactersFromDisk()
  const byId = new Map(existing.map(c => [c.id, c]))
  for (const f of charFiles) {
    let char: Character
    try { char = withUsableId(migrate(JSON.parse(await f.async('string')))) }
    catch { summary.characters.unreadable.push(f.name.split('/').pop()!); continue }
    const here = byId.get(char.id)
    // Already here: the same character, or a copy an earlier restore brought in beside it
    const sameAs = (c: Character) => stableJson({ ...c, id: '' }) === stableJson({ ...char, id: '' })
    if (!here) { await saveCharacterToDisk(char); summary.characters.added.push(char.name) }
    else if (sameAs(here) || existing.some(sameAs)) summary.characters.alreadyHere.push(char.name)
    else { await saveCharacterToDisk({ ...char, id: uuidv4() }); summary.characters.copies.push(char.name) }
  }

  if (homebrewFile) {
    const backup = JSON.parse(await homebrewFile.async('string')) as Partial<Record<HomebrewCategory, Record<string, unknown>[]>>
    const mine = await loadHomebrewFromDisk()
    const categories: HomebrewCategory[] = ['spells', 'items', 'feats', 'races', 'classes', 'backgrounds']
    for (const cat of categories) {
      for (const entry of backup[cat] ?? []) {
        const slug = String(entry.slug ?? '')
        if (!slug) continue
        const current = (mine[cat] as Record<string, unknown>[]).find(e => e.slug === slug)
        if (!current) { await saveHomebrewEntry(cat, entry); summary.homebrew.added.push(String(entry.name ?? slug)) }
        else if (stableJson(current) === stableJson(entry)) summary.homebrew.alreadyHere++
        else summary.homebrew.keptYours.push(String(entry.name ?? slug))
      }
    }
  }

  for (const f of historyFiles) {
    const [, , id, name] = f.name.split('/')
    try {
      if (await importSnapshot(id, name.replace(/\.json$/, ''), JSON.parse(await f.async('string')))) summary.history.added++
    } catch {
      summary.history.couldNotAdd = true   // a server from before restoring existed, or a damaged file
    }
  }
  return summary
}
