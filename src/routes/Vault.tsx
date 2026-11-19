import { useEffect, useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Character } from '../character/model'
import { importCharacter } from '../storage/ioFile'
import { listCharactersFromDisk, saveCharacterToDisk, deleteCharacterFromDisk, listDeleted, restoreDeleted, forgetDeleted, type CharacterLoadFailure, type DeletedCharacter } from '../storage/charApi'
import { when } from '../components/HistoryDialog'
import { totalLevel } from '../character/derive'
import { restingVitals } from '../character/vitals'
import { CLASS_OPTIONS } from '../data/classData'
import { useContent } from '../content/ContentProvider'
import { useRecentCharacter } from '../storage/recentCharacter'
import { useConfirm } from '../components/ConfirmDialog'
import { v4 as uuidv4 } from 'uuid'

export default function Vault() {
  const [characters, setCharacters] = useState<Character[]>([])
  const [failures, setFailures] = useState<CharacterLoadFailure[]>([])
  const [deleted, setDeleted] = useState<DeletedCharacter[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const fileRef = useRef<HTMLInputElement>(null)
  const content = useContent()
  const { races, classes } = content
  // The card whose ⋯ menu is open
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const { recent, setRecent } = useRecentCharacter()
  const navigate = useNavigate()
  const { askConfirm, confirmDialog } = useConfirm()

  async function refresh() {
    try {
      const { characters, failures } = await listCharactersFromDisk()
      setCharacters(characters)
      setFailures(failures)
      // An app started before Recently deleted existed has no such route: show none
      setDeleted(await listDeleted().catch(() => []))
    } catch {
      setError('Could not reach the character server. Make sure you started the app with "npm run dev".')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refresh() }, [])

  // Close the ⋯ menu on a click elsewhere or Escape
  useEffect(() => {
    if (!menuFor) return
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !(e.target as Element).closest('[data-card-menu]')) setMenuFor(null)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close) }
  }, [menuFor])

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const char = await importCharacter(file)
      // Never overwrite a character already in the vault: an older export comes in beside it
      await saveCharacterToDisk(characters.some(c => c.id === char.id) ? { ...char, id: uuidv4() } : char)
      await refresh()
      setError('')
    } catch {
      setError('Could not import — file may be corrupted or from an incompatible version.')
    }
    e.target.value = ''
  }

  async function handleDelete(id: string, name: string) {
    if (!(await askConfirm({ title: 'Delete Character', message: `Delete “${name}”? You can bring it back from Recently deleted at the bottom of the Vault.`, confirmLabel: 'Delete', danger: true }))) return
    await deleteCharacterFromDisk(id)
    if (recent?.id === id) setRecent(null)
    await refresh()
  }

  async function handleRestore(d: DeletedCharacter) {
    try {
      await restoreDeleted(d)
      await refresh()
    } catch {
      setError(`Could not restore ${d.name ?? 'that character'}.`)
    }
  }

  async function handleForget(d: DeletedCharacter) {
    const name = d.name ?? 'this character'
    if (!(await askConfirm({ title: 'Delete Forever', message: `Delete “${name}” for good? Its earlier versions are removed too, and this can't be undone.`, confirmLabel: 'Delete forever', danger: true }))) return
    await forgetDeleted(d.id)
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
        const sub = cc.subclassSlug ? CLASS_OPTIONS[cc.classSlug]?.subclasses.find(sc => sc.slug === cc.subclassSlug)?.name : undefined
        return `${cls?.name ?? cc.classSlug} ${cc.level}${sub ? ` (${sub})` : ''}`
      })
      .join(' / ')
  }

  /** Hit point maximum the way the sheet works it out (items, feats, running potions) */
  const maxHpOf = (char: Character) => restingVitals(char, content).maxHp

  // At 0 HP with three failed death saves the sheet shows "You have died", and the Vault lays the
  // character to rest. Healing on the sheet clears the saves, which brings them back.
  const isFallen = (c: Character) => c.hp.current <= 0 && c.deathSaves.failures >= 3
  const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]!.toUpperCase()).join('') || '?'

  /** Duplicate and Delete live in a ⋯ menu, so Delete isn't one stray click away */
  const cardMenu = (char: Character, fallen: boolean) => (
    <div className="relative shrink-0" data-card-menu>
      <button type="button" aria-label={`More actions for ${char.name}`} aria-haspopup="menu" aria-expanded={menuFor === char.id}
        onClick={() => setMenuFor(menuFor === char.id ? null : char.id)}
        className={`w-8 h-8 -mr-1 -mt-1 rounded-full text-lg leading-none transition-colors ${fallen ? 'text-stone-400 hover:bg-white/10 hover:text-stone-100' : 'text-parchment-500 hover:bg-parchment-100 hover:text-parchment-800'}`}
      >⋯</button>
      {menuFor === char.id && (
        <div role="menu" className="absolute right-0 top-full mt-1 z-20 w-40 rounded-lg border border-parchment-200 bg-parchment-50 shadow-lg py-1">
          <button type="button" role="menuitem" className="w-full text-left px-3 py-1.5 text-sm text-parchment-800 hover:bg-parchment-100"
            onClick={() => { setMenuFor(null); handleDuplicate(char) }}>Duplicate</button>
          <button type="button" role="menuitem" className="w-full text-left px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
            onClick={() => { setMenuFor(null); handleDelete(char.id, char.name) }}>Delete…</button>
        </div>
      )}
    </div>
  )

  const livingCard = (char: Character) => {
    const maxHp = maxHpOf(char)
    const hpPct = maxHp > 0 ? Math.max(0, Math.min(100, Math.round(char.hp.current / maxHp * 100))) : 0
    // At 0 HP but not yet fallen: making death saves, or stable after three successes
    const down = char.hp.current <= 0
    const stable = down && char.deathSaves.successes >= 3
    return (
    <div key={char.id} className={`card hover:shadow-md transition-shadow flex flex-col ${down ? (stable ? 'ring-2 ring-green-300' : 'ring-2 ring-red-300') : ''}`}>
      <div className="flex items-start gap-4">
        <Link to={`/c/${char.id}`} className="shrink-0" tabIndex={-1} aria-hidden>
          {char.portrait ? (
            <img src={char.portrait} alt="" className="w-20 h-20 rounded-xl object-cover object-top border-2 border-parchment-300" />
          ) : (
            <span className="w-20 h-20 rounded-xl border-2 border-parchment-300 bg-parchment-100 flex items-center justify-center text-2xl font-bold text-parchment-400">
              {char.name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]!.toUpperCase()).join('') || '?'}
            </span>
          )}
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <h2 className="text-xl font-bold text-parchment-900 truncate flex-1">
              <Link to={`/c/${char.id}`} className="hover:underline decoration-parchment-300 underline-offset-4">{char.name}</Link>
            </h2>
            {cardMenu(char, false)}
          </div>
          <p className="text-sm text-parchment-600">Level {totalLevel(char)} {raceName(char.raceSlug)}</p>
          <p className="text-sm text-parchment-600 truncate" title={classLabel(char)}>{classLabel(char)}</p>
        </div>
      </div>
      {/* Hit points at a glance; at 0 HP, the death saves instead */}
      {down ? (
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="flex items-center gap-2">
              <span className={`text-[11px] font-bold uppercase tracking-widest ${stable ? 'text-green-700' : 'text-red-600'}`}>{stable ? 'Stable' : 'Down'}</span>
              <span className="flex items-center gap-0.5" title={`Death save successes: ${char.deathSaves.successes}`}>
                {[0, 1, 2].map(i => <span key={i} className={`w-2 h-2 rounded-full border ${i < char.deathSaves.successes ? 'bg-green-500 border-green-500' : 'border-green-400'}`} />)}
              </span>
              <span className="flex items-center gap-0.5" title={`Death save failures: ${char.deathSaves.failures}`}>
                {[0, 1, 2].map(i => <span key={i} className={`w-2 h-2 rounded-full border ${i < char.deathSaves.failures ? 'bg-red-500 border-red-500' : 'border-red-400'}`} />)}
              </span>
            </span>
            <span className="text-parchment-500" title="Last saved">{new Date(char.updatedAt).toLocaleDateString()}</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden bg-parchment-200">
            <div className={`h-full w-full rounded-full ${stable ? 'bg-green-400' : 'bg-red-500 animate-pulse'}`} />
          </div>
        </div>
      ) : (
      <div className="mt-3">
        <div className="flex items-baseline justify-between text-xs text-parchment-500 mb-1">
          <span>HP <span className="font-bold text-parchment-800">{char.hp.current}</span> / {maxHp}{char.hp.temp > 0 && <span className="text-blue-600"> +{char.hp.temp} temp</span>}</span>
          <span title="Last saved">{new Date(char.updatedAt).toLocaleDateString()}</span>
        </div>
        <div className="h-1.5 bg-parchment-200 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${hpPct > 50 ? 'bg-green-500' : hpPct > 25 ? 'bg-amber-400' : 'bg-red-500'}`} style={{ width: `${hpPct}%` }} />
        </div>
      </div>
      )}
      <button className="btn-primary text-sm mt-4" onClick={() => navigate(`/c/${char.id}`)}>
        Open
      </button>
    </div>
    )
  }

  /** A fallen character: dark stone with the death screen's red glow, a greyed portrait, a faint
   *  headstone and the three failed saves. The sheet still opens (a Revivify can bring them back). */
  const fallenCard = (char: Character) => (
    <div key={char.id} className="vault-fallen relative overflow-hidden rounded-lg p-4 flex flex-col">
      <svg viewBox="0 0 64 80" className="absolute -right-3 -bottom-4 w-28 h-32 text-stone-400 opacity-[0.12] pointer-events-none"
        fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" aria-hidden>
        <path d="M12 76V30a20 20 0 0 1 40 0v46z" /><path d="M32 20v26M23 29h18" /><path d="M4 76h56" />
      </svg>
      <div className="relative flex items-start gap-4">
        <Link to={`/c/${char.id}`} className="shrink-0" tabIndex={-1} aria-hidden>
          {char.portrait ? (
            <img src={char.portrait} alt="" className="w-20 h-20 rounded-xl object-cover object-top border-2 border-stone-600 grayscale brightness-75 contrast-125" />
          ) : (
            <span className="w-20 h-20 rounded-xl border-2 border-stone-600 bg-stone-800 flex items-center justify-center text-2xl font-bold text-stone-500">
              {initials(char.name)}
            </span>
          )}
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <h2 className="text-xl font-bold text-stone-200 truncate flex-1">
              <Link to={`/c/${char.id}`} className="hover:underline decoration-stone-500 underline-offset-4">
                <span className="text-red-400/80 mr-1.5" aria-hidden>†</span>{char.name}
              </Link>
            </h2>
            {cardMenu(char, true)}
          </div>
          <p className="text-sm text-stone-400">Level {totalLevel(char)} {raceName(char.raceSlug)}</p>
          <p className="text-sm text-stone-400 truncate" title={classLabel(char)}>{classLabel(char)}</p>
        </div>
      </div>
      <div className="relative mt-3 flex items-center gap-2.5">
        <span className="text-[11px] font-bold uppercase tracking-[0.3em] text-red-400/90">Fallen</span>
        <span className="flex gap-1.5" title="Three failed death saving throws">
          {[0, 1, 2].map(i => (
            <span key={i} className="w-2.5 h-2.5 rounded-full bg-red-700 border border-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]" />
          ))}
        </span>
        <span className="ml-auto text-xs text-stone-500" title="Last saved">{new Date(char.updatedAt).toLocaleDateString()}</span>
      </div>
      <button className="relative mt-4 py-2 rounded text-sm font-semibold border border-stone-600 text-stone-300 hover:bg-white/5 hover:text-stone-100 transition-colors"
        onClick={() => navigate(`/c/${char.id}`)}>
        Open sheet
      </button>
    </div>
  )

  return (
    <div>
      {confirmDialog}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-3xl font-bold text-parchment-800">Character Vault</h1>
        <div className="flex gap-2 whitespace-nowrap">
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

      {/* Until the reference data is in, hit dice (and so max HP) aren't known */}
      {loading || content.loading ? (
        <div className="text-center py-20 text-parchment-400">Loading characters...</div>
      ) : characters.length === 0 ? (
        <div className="text-center py-20 text-parchment-500">
          <p className="text-xl mb-2">No characters yet.</p>
          <p className="text-sm mb-6">Create your first adventurer to get started.</p>
          <Link to="/new" className="btn-primary">+ New Character</Link>
        </div>
      ) : (
        <>
          {characters.some(c => !isFallen(c)) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {characters.filter(c => !isFallen(c)).map(livingCard)}
            </div>
          )}
          {/* The fallen rest together at the bottom */}
          {characters.some(isFallen) && (
            <>
              <div className="flex items-center gap-3 mt-8 mb-3">
                <span className="text-xs font-bold uppercase tracking-[0.3em] text-parchment-500">Fallen</span>
                <div className="flex-1 h-px bg-parchment-300" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {characters.filter(isFallen).map(fallenCard)}
              </div>
            </>
          )}
        </>
      )}

      {/* Recently deleted: kept (as their history) until deleted forever */}
      {!loading && deleted.length > 0 && (
        <details className="group mt-8">
          <summary className="flex items-center gap-3 mb-3 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden">
            <span className="text-xs font-bold uppercase tracking-[0.3em] text-parchment-500">Recently deleted ({deleted.length})</span>
            <div className="flex-1 h-px bg-parchment-300" />
            <span className="text-xs text-parchment-400 transition-transform group-open:rotate-180">▾</span>
          </summary>
          <div className="card p-0 divide-y divide-parchment-100">
            {deleted.map(d => (
              <div key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5">
                <span className="font-semibold text-parchment-800">{d.name || 'Unnamed character'}</span>
                <span className="text-xs text-parchment-500">
                  Level {d.level} · {d.label === 'Deleted' ? 'deleted' : 'last saved'} {when(d.savedAt)}
                </span>
                <div className="ml-auto flex gap-2">
                  <button type="button" className="btn-secondary text-xs py-1" onClick={() => handleRestore(d)}>Restore</button>
                  <button type="button" className="btn-ghost text-xs py-1 text-red-700" onClick={() => handleForget(d)}>Delete forever</button>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-parchment-500 mt-1.5">Restoring brings a character back as it was just before it was deleted, with its History.</p>
        </details>
      )}
    </div>
  )
}
