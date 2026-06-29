import { useState, useMemo } from 'react'
import { useContent } from '../content/ContentProvider'
import { listCharactersFromDisk, loadHomebrewFromDisk } from '../storage/charApi'
import { exportEverything } from '../storage/ioFile'
import { CLASS_OPTIONS } from '../data/classData'
import { deriveClassResources } from '../character/derive'
import type { Character } from '../character/model'

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
    <div className="card mb-6">
      <h2 className="section-header">Class Coverage</h2>
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
    </div>
  )
}

export default function Settings() {
  const content = useContent()

  async function handleBackup() {
    const [{ characters }, hb] = await Promise.all([listCharactersFromDisk(), loadHomebrewFromDisk()])
    await exportEverything(characters, hb)
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-bold text-parchment-800 mb-6">Settings</h1>

      {/* Data status */}
      <div className="card mb-6">
        <h2 className="section-header">Reference Data</h2>
        {content.loading ? (
          <p className="text-parchment-400 text-sm">Loading...</p>
        ) : content.meta ? (
          <div className="space-y-1 text-sm">
            <p className="text-parchment-600">
              Last scraped: <strong>{new Date(content.meta.scrapedAt).toLocaleString()}</strong>
            </p>
            {Object.entries(content.meta.counts).map(([key, count]) => (
              <p key={key} className="text-parchment-500 capitalize">{key}: {count}</p>
            ))}
          </div>
        ) : (
          <div className="text-sm text-parchment-500 space-y-2">
            <p>No scraped data found.</p>
            <p>To populate the app with spells, items, classes, and races from <code>dnd5e.wikidot.com</code>, run:</p>
            <pre className="bg-dungeon-900 text-parchment-100 rounded p-3 text-xs overflow-x-auto">
              npm install{'\n'}
              npm run scrape
            </pre>
            <p>This will download and cache all D&D 5e content locally. Re-run any time to refresh.</p>
          </div>
        )}
        <div className="mt-4 space-y-2 text-sm text-parchment-500">
          <p>To update to the latest wikidot content:</p>
          <pre className="bg-dungeon-900 text-parchment-100 rounded p-3 text-xs overflow-x-auto">
            npm run scrape{'\n'}
            {'\n'}
            # Force re-download (ignore cache):{'\n'}
            npm run scrape -- --force{'\n'}
            {'\n'}
            # Only refresh specific categories:{'\n'}
            npm run scrape -- --only spells,items
          </pre>
        </div>
      </div>

      {/* Backup */}
      <div className="card mb-6">
        <h2 className="section-header">Backup &amp; Export</h2>
        <p className="text-sm text-parchment-500 mb-4">
          Download all your characters and homebrew as a single ZIP file. Re-import individual characters using the Vault's "Import .json" button.
        </p>
        <button className="btn-primary" onClick={handleBackup}>Download Backup (.zip)</button>
      </div>

      {/* Class coverage */}
      <ClassCoverage />

      {/* Attribution */}
      <div className="card">
        <h2 className="section-header">Attribution</h2>
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
