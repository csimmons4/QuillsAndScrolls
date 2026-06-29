import { useEffect, useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Character } from '../character/model'
import { importCharacter } from '../storage/ioFile'
import { listCharactersFromDisk, saveCharacterToDisk, deleteCharacterFromDisk, type CharacterLoadFailure } from '../storage/charApi'
import { totalLevel } from '../character/derive'
import { useContent } from '../content/ContentProvider'
import { v4 as uuidv4 } from 'uuid'

export default function Vault() {
  const [characters, setCharacters] = useState<Character[]>([])
  const [failures, setFailures] = useState<CharacterLoadFailure[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const fileRef = useRef<HTMLInputElement>(null)
  const { races, classes } = useContent()
  const navigate = useNavigate()

  async function refresh() {
    try {
      const { characters, failures } = await listCharactersFromDisk()
      setCharacters(characters)
      setFailures(failures)
    } catch {
      setError('Could not reach the character server. Make sure you started the app with "npm run dev".')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refresh() }, [])

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const char = await importCharacter(file)
      await saveCharacterToDisk(char)
      await refresh()
      setError('')
    } catch {
      setError('Could not import — file may be corrupted or from an incompatible version.')
    }
    e.target.value = ''
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return
    await deleteCharacterFromDisk(id)
    await refresh()
  }

  async function handleDuplicate(char: Character) {
    const now = new Date().toISOString()
    const copy: Character = {
      ...char,
      id: uuidv4(),
      name: `${char.name} (Copy)`,
      createdAt: now,
      updatedAt: now,
    }
    await saveCharacterToDisk(copy)
    await refresh()
  }

  function raceName(slug: string) {
    return races.find(r => r.slug === slug)?.name ?? slug
  }

  function classLabel(char: Character) {
    return char.classes
      .map(cc => {
        const cls = classes.find(c => c.slug === cc.classSlug)
        return `${cls?.name ?? cc.classSlug} ${cc.level}`
      })
      .join(' / ')
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-parchment-800">Character Vault</h1>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => fileRef.current?.click()}>
            Import .json
          </button>
          <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
          <Link to="/new" className="btn-primary">+ New Character</Link>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-300 rounded text-red-800 text-sm">{error}</div>
      )}

      {failures.length > 0 && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-300 rounded text-amber-900 text-sm">
          <p className="font-semibold">
            {failures.length} character{failures.length > 1 ? 's' : ''} couldn’t be loaded and{' '}
            {failures.length > 1 ? 'were' : 'was'} hidden:
          </p>
          <ul className="mt-1 list-disc list-inside space-y-0.5">
            {failures.map((f, i) => (
              <li key={f.id ?? i}>
                <span className="font-medium">{f.name || f.id || 'Unknown character'}</span>
                <span className="text-amber-700"> — {f.error}</span>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-amber-700">The file is still on disk; nothing was deleted.</p>
        </div>
      )}

      {loading ? (
        <div className="text-center py-20 text-parchment-400">Loading characters...</div>
      ) : characters.length === 0 ? (
        <div className="text-center py-20 text-parchment-500">
          <p className="text-xl mb-2">No characters yet.</p>
          <p className="text-sm mb-6">Create your first adventurer to get started.</p>
          <Link to="/new" className="btn-primary">+ New Character</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {characters.map(char => (
            <div key={char.id} className="card hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-bold text-parchment-900">{char.name}</h2>
                  <p className="text-sm text-parchment-600">
                    Level {totalLevel(char)} {raceName(char.raceSlug)}
                  </p>
                  <p className="text-sm text-parchment-600">{classLabel(char)}</p>
                </div>
                <span className="text-xs text-parchment-400">
                  {new Date(char.updatedAt).toLocaleDateString()}
                </span>
              </div>
              <div className="mt-4 flex gap-2">
                <button className="btn-primary text-sm flex-1" onClick={() => navigate(`/c/${char.id}`)}>
                  Open
                </button>
                <button className="btn-secondary text-sm" title="Duplicate character" onClick={() => handleDuplicate(char)}>
                  Copy
                </button>
                <button className="btn-danger text-sm" onClick={() => handleDelete(char.id, char.name)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
