import { Character } from '../character/model'
import { migrate } from './localStore'

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
  const raw = JSON.parse(text)
  return migrate(raw)
}

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
