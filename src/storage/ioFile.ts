import { Character, CharacterSchema } from '../character/model'

export function exportCharacter(char: Character): void {
  const blob = new Blob([JSON.stringify(char, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${char.name.replace(/[^a-z0-9]/gi, '_')}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export async function importCharacter(file: File): Promise<Character> {
  const text = await file.text()
  const raw = JSON.parse(text)
  return CharacterSchema.parse(raw)
}

export function exportHomebrew(data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'quills-scrolls-homebrew.json'
  a.click()
  URL.revokeObjectURL(url)
}

export async function importHomebrew(file: File): Promise<unknown> {
  const text = await file.text()
  return JSON.parse(text)
}

export async function exportEverything(
  characters: Character[],
  homebrew: unknown
): Promise<void> {
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  zip.file('homebrew.json', JSON.stringify(homebrew, null, 2))
  const charFolder = zip.folder('characters')!
  for (const char of characters) {
    charFolder.file(`${char.name.replace(/[^a-z0-9]/gi, '_')}_${char.id.slice(0, 8)}.json`, JSON.stringify(char, null, 2))
  }
  const blob = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `quills-scrolls-backup-${new Date().toISOString().slice(0, 10)}.zip`
  a.click()
  URL.revokeObjectURL(url)
}
