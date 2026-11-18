import { useState, useMemo, useEffect } from 'react'
import { useContent } from '../content/ContentProvider'
import { listCharactersFromDisk, loadHomebrewFromDisk, exportHistory, getNetworkSettings, setNetworkAccess, type NetworkSettings } from '../storage/charApi'
import { exportEverything } from '../storage/ioFile'
import { CLASS_OPTIONS } from '../data/classData'
import { deriveClassResources } from '../character/derive'
import type { Character } from '../character/model'
import { useTheme, THEMES } from '../theme/theme'
import { PaletteIcon, BookIcon, ExportIcon, ScalesIcon, ChecklistIcon, PhoneIcon } from '../components/SheetIcons'

const CLASS_SLUGS = Object.keys(CLASS_OPTIONS).sort()

function mockChar(classSlug: string, level: number, subclassSlug?: string): Character {
  return {
    classes: [{ classSlug, level, subclassSlug, hitDieRolls: [] }],
    abilityScores: { str: 16, dex: 16, con: 16, int: 16, wis: 16, cha: 16 },
    classResources: {},
    featuresChosen: [],
    saveProficiencies: [],
  } as unknown as Character
}

const RECHARGE_LABEL = { short: 'Short Rest', long: 'Long Rest', dawn: 'At Dawn' } as const
const RECHARGE_COLOR = {
  short: 'bg-blue-100 text-blue-700',
  long:  'bg-parchment-100 text-parchment-600',
  dawn:  'bg-amber-100 text-amber-700',
} as const

function ClassCoverage() {
  const [classSlug, setClassSlug] = useState(CLASS_SLUGS[0])
  const [level, setLevel] = useState(20)
  const [subclassSlug, setSubclassSlug] = useState<string | undefined>()

  const classDef = CLASS_OPTIONS[classSlug]
  const subclasses = classDef?.subclasses ?? []
  const activeSubclass = subclasses.find(sc => sc.slug === subclassSlug)

  const resources = useMemo(
    () => deriveClassResources(mockChar(classSlug, level, subclassSlug)),
    [classSlug, level, subclassSlug]
  )

  function handleClassChange(slug: string) {
    setClassSlug(slug)
    setSubclassSlug(undefined)
  }

  return (
    <details className="card mb-6">
      <summary className="section-header flex items-center gap-2 cursor-pointer select-none"><ChecklistIcon className="w-5 h-5 text-[rgb(var(--accent))] shrink-0" /> Class Coverage <span className="ml-auto text-xs font-normal normal-case tracking-normal text-parchment-400">for checking the app ▾</span></summary>
      <p className="text-sm text-parchment-500 mb-4">
        Shows what resources are tracked for a given class, level, and subclass. Gaps here mean a feature isn't implemented yet.
      </p>

      <div className="flex flex-wrap gap-3 mb-5">
        <div>
          <label className="label">Class</label>
          <select className="input" value={classSlug} onChange={e => handleClassChange(e.target.value)}>
            {CLASS_SLUGS.map(s => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Level</label>
          <select className="input" value={level} onChange={e => setLevel(Number(e.target.value))}>
            {Array.from({ length: 20 }, (_, i) => i + 1).map(l => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Subclass</label>
          <select className="input" value={subclassSlug ?? ''} onChange={e => setSubclassSlug(e.target.value || undefined)}>
            <option value="">— None —</option>
            {subclasses.map(sc => (
              <option key={sc.slug} value={sc.slug}>{sc.name} (L{sc.level}+)</option>
            ))}
          </select>
        </div>
      </div>

      {activeSubclass && level < activeSubclass.level && (
        <p className="text-amber-700 text-sm mb-3 bg-amber-50 border border-amber-200 rounded px-3 py-2">
          {activeSubclass.name} unlocks at level {activeSubclass.level} — subclass resources won't appear below that.
        </p>
      )}

      {resources.length === 0 ? (
        <p className="text-parchment-400 text-sm italic">
          No tracked resources at level {level}{activeSubclass ? ` (${activeSubclass.name})` : ''}.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-parchment-500 border-b border-parchment-200">
                <th className="pb-2 pr-4 font-semibold">Resource</th>
                <th className="pb-2 pr-4 font-semibold">Max</th>
                <th className="pb-2 pr-4 font-semibold">Recharge</th>
                <th className="pb-2 font-semibold">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-parchment-100">
              {resources.map(r => (
                <tr key={r.key}>
                  <td className="py-2 pr-4 font-medium text-parchment-800">{r.name}</td>
                  <td className="py-2 pr-4 text-parchment-600 tabular-nums">{r.max === null ? '∞' : r.max}</td>
                  <td className="py-2 pr-4">
                    <span className={`text-xs rounded px-1.5 py-0.5 font-medium ${RECHARGE_COLOR[r.recharge]}`}>
                      {RECHARGE_LABEL[r.recharge]}
                    </span>
                  </td>
                  <td className="py-2 text-parchment-500 text-xs">{r.display ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-parchment-400 mt-3">
        All ability scores assumed 16 (+3). Warlock invocation uses won't show without a real character's saved choices.
      </p>
    </details>
  )
}

const CATEGORY_META = [
  { key: 'spells', label: 'Spells' },
  { key: 'items', label: 'Items' },
  { key: 'feats', label: 'Feats' },
  { key: 'races', label: 'Races' },
  { key: 'backgrounds', label: 'Backgrounds' },
  { key: 'classes', label: 'Classes' },
] as const

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const sec = Math.floor((Date.now() - then) / 1000)
  if (sec < 60) return 'just now'
  const units: [number, string][] = [
    [31536000, 'year'], [2592000, 'month'], [86400, 'day'], [3600, 'hour'], [60, 'minute'],
  ]
  for (const [s, name] of units) {
    const v = Math.floor(sec / s)
    if (v >= 1) return `${v} ${name}${v > 1 ? 's' : ''} ago`
  }
  return 'just now'
}

export default function Settings() {
  const content = useContent()
  const { theme, setTheme } = useTheme()

  const counts: Record<string, number> = {
    spells: content.spells.length,
    items: content.items.length,
    feats: content.feats.length,
    races: content.races.length,
    backgrounds: content.backgrounds.length,
    classes: content.classes.length,
  }
  const hasData = Object.values(counts).some(n => n > 0)

  // Phones & Tablets: null while loading, 'old-server' if the server predates the setting
  const [network, setNetwork] = useState<NetworkSettings | null | 'old-server'>(null)
  useEffect(() => { getNetworkSettings().then(setNetwork, () => setNetwork('old-server')) }, [])

  // Backup: History is included unless switched off; a server from before this can't send it
  const [backupHistory, setBackupHistory] = useState(true)
  const [backupNote, setBackupNote] = useState('')

  async function handleBackup() {
    const [{ characters }, hb] = await Promise.all([listCharactersFromDisk(), loadHomebrewFromDisk()])
    let history: Awaited<ReturnType<typeof exportHistory>> | undefined
    if (backupHistory) history = await exportHistory().catch(() => undefined)
    setBackupNote(backupHistory && !history ? 'Earlier versions couldn’t be included: restart the app once, then try again.' : '')
    await exportEverything(characters, hb, history)
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-parchment-800">Settings</h1>
        <p className="text-sm text-parchment-500 mt-1">Reference data, backups, and app information.</p>
      </div>

      {/* Appearance */}
      <div className="card mb-6">
        <h2 className="section-header flex items-center gap-2"><PaletteIcon className="w-5 h-5 text-[rgb(var(--accent))] shrink-0" /> Appearance</h2>
        <p className="text-sm text-parchment-500 mb-4">Choose a display theme. Saved to this browser.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {THEMES.map(t => {
            const active = theme === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTheme(t.id)}
                aria-pressed={active}
                className={`text-left rounded-lg border p-3 transition-colors bg-parchment-50 ${
                  active ? 'border-parchment-500 ring-2 ring-parchment-400' : 'border-parchment-200 hover:border-parchment-400'
                }`}
              >
                <div className="flex gap-1 mb-2">
                  {[t.swatch.bg, t.swatch.card, t.swatch.accent, t.swatch.text].map((c, i) => (
                    <span key={i} className="w-5 h-5 rounded border border-black/10" style={{ backgroundColor: c }} />
                  ))}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-parchment-800 text-sm">{t.label}</span>
                  {active && <span className="text-xs text-parchment-500">✓ active</span>}
                </div>
                <div className="text-xs text-parchment-500">{t.desc}</div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Backup */}
      <div className="card mb-6">
        <h2 className="section-header flex items-center gap-2"><ExportIcon className="w-5 h-5 text-[rgb(var(--accent))] shrink-0" /> Backup &amp; Export</h2>
        <p className="text-sm text-parchment-500 mb-4">
          Download all your characters and homebrew as a single ZIP. Re-import individual characters with the Vault's “Import .json” button.
        </p>
        <label className="flex items-center gap-2 text-sm text-parchment-800 cursor-pointer w-fit mb-4">
          <input type="checkbox" checked={backupHistory} onChange={e => setBackupHistory(e.target.checked)} />
          Include each character’s earlier versions (History)
        </label>
        <button className="btn-primary" onClick={handleBackup}>
          <ExportIcon className="w-4 h-4 mr-1.5" /> Download Backup (.zip)
        </button>
        {backupNote && <p className="mt-2 text-sm text-amber-800">{backupNote}</p>}
      </div>

      {/* Phones & Tablets: opt-in network access */}
      <div className="card mb-6">
        <h2 className="section-header flex items-center gap-2"><PhoneIcon className="w-5 h-5 text-[rgb(var(--accent))] shrink-0" /> Phones &amp; Tablets</h2>
        <p className="text-sm text-parchment-500 mb-3">
          Open your characters on a phone or tablet on the same Wi-Fi, with this computer running the app. Off unless you switch it on.
        </p>
        {network === 'old-server' ? (
          <p className="text-sm text-parchment-600 italic">This needs the app to be restarted once: close the Start window and double-click Start again.</p>
        ) : network && (
          <>
            <label className="flex items-center gap-2 text-sm text-parchment-800 cursor-pointer w-fit">
              <input type="checkbox" checked={network.lan}
                onChange={e => { setNetworkAccess(e.target.checked).then(setNetwork, () => setNetwork('old-server')) }} />
              Let phones and tablets on my Wi-Fi open the app
            </label>
            {network.lan !== __QS_LAN__ ? (
              <p className="mt-2 text-sm text-amber-800">
                Restart the app to switch this {network.lan ? 'on' : 'off'}: close the Start window and double-click Start again.
              </p>
            ) : network.lan && (
              <div className="mt-3 text-sm text-parchment-700">
                On the phone or tablet, open{network.addresses.length > 1 ? ' one of' : ''}:
                {network.addresses.length === 0
                  ? <span className="italic text-parchment-500"> no Wi-Fi address found. Is this computer connected?</span>
                  : network.addresses.map(a => (
                    <code key={a} className="ml-2 px-2 py-0.5 rounded bg-parchment-100 border border-parchment-200 font-mono text-parchment-900 select-all">
                      http://{a}:{window.location.port || '5173'}
                    </code>
                  ))}
              </div>
            )}
            <p className="mt-3 text-xs text-red-700">
              There's no password: while this is on, anyone on the same Wi-Fi who knows the address can open, change or delete your characters. Only use it on a network you trust, like your home Wi-Fi.
            </p>
            <p className="mt-1 text-xs text-parchment-500">
              The first time, your computer may ask whether to let “node” accept incoming connections. Choose Allow.
            </p>
          </>
        )}
      </div>

      {/* Reference data */}
      <div className="card mb-6">
        <h2 className="section-header flex items-center gap-2"><BookIcon className="w-5 h-5 text-[rgb(var(--accent))] shrink-0" /> Reference Data</h2>

        {content.loading ? (
          <p className="text-parchment-400 text-sm">Loading…</p>
        ) : hasData ? (
          <>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4">
              {CATEGORY_META.map(c => (
                <div key={c.key} className="stat-box">
                  <span className="text-xl font-bold text-parchment-800 tabular-nums">{counts[c.key].toLocaleString()}</span>
                  <span className="text-[10px] uppercase tracking-wide text-parchment-500 text-center leading-tight">{c.label}</span>
                </div>
              ))}
            </div>
            {content.meta && (
              <p className="text-sm text-parchment-500">
                Last scraped{' '}
                <span className="font-semibold text-parchment-700" title={new Date(content.meta.scrapedAt).toLocaleString()}>
                  {timeAgo(content.meta.scrapedAt)}
                </span>
                {' · '}{new Date(content.meta.scrapedAt).toLocaleDateString()}
              </p>
            )}
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-medium text-parchment-600 hover:text-parchment-800 select-none">
                Updating reference data
              </summary>
              <div className="mt-2 text-sm text-parchment-500 space-y-2">
                <p>Content is scraped from <code>dnd5e.wikidot.com</code> and cached locally — re-run any time to refresh:</p>
                <pre className="bg-dungeon-900 text-parchment-100 rounded p-3 text-xs overflow-x-auto">
                  npm run scrape{'\n'}{'\n'}
                  # Force re-download (ignore cache):{'\n'}
                  npm run scrape -- --force{'\n'}{'\n'}
                  # Only refresh specific categories:{'\n'}
                  npm run scrape -- --only spells,items
                </pre>
              </div>
            </details>
          </>
        ) : (
          <div className="text-sm text-parchment-500 space-y-2">
            <p>No reference data found yet.</p>
            <p>To populate the app with spells, items, classes, and races from <code>dnd5e.wikidot.com</code>, run:</p>
            <pre className="bg-dungeon-900 text-parchment-100 rounded p-3 text-xs overflow-x-auto">
              npm install{'\n'}npm run scrape
            </pre>
            <p>This downloads and caches all D&D 5e content locally.</p>
          </div>
        )}
      </div>

      {/* Class coverage */}
      <ClassCoverage />

      {/* Attribution */}
      <div className="card">
        <h2 className="section-header flex items-center gap-2"><ScalesIcon className="w-5 h-5 text-[rgb(var(--accent))] shrink-0" /> Attribution</h2>
        <p className="text-sm text-parchment-600">
          Game reference content sourced from{' '}
          <a href="https://dnd5e.wikidot.com" target="_blank" rel="noreferrer" className="text-parchment-700 underline hover:text-parchment-900">
            dnd5e.wikidot.com
          </a>{' '}
          and is used under the{' '}
          <a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noreferrer" className="text-parchment-700 underline hover:text-parchment-900">
            Creative Commons Attribution-ShareAlike 3.0 License
          </a>.
        </p>
        <p className="text-sm text-parchment-500 mt-2">
          Quills &amp; Scrolls is an unofficial fan tool, not affiliated with Wizards of the Coast.
        </p>
      </div>
    </div>
  )
}
