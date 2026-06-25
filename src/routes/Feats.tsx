import { useState, useRef, useLayoutEffect } from 'react'
import { useContent } from '../content/ContentProvider'
import { cleanFeatDesc, FeatEffectBadges } from '../components/FeatPicker'
import type { FeatDef } from '../content/loaders'

function FeatCard({ feat, defaultOpen = false }: { feat: FeatDef; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const ref = useRef<HTMLDivElement>(null)
  const effect = feat
  const description = cleanFeatDesc(feat.description)

  useLayoutEffect(() => {
    if (open && ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [open])

  return (
    <div ref={ref} className={`rounded border transition-colors ${open ? 'border-parchment-400 shadow-sm' : 'border-parchment-200 hover:border-parchment-400'}`}>
      <button
        className="w-full text-left p-3 flex items-start justify-between gap-3"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-parchment-900">{feat.name}</span>
            {feat.prerequisite && (
              <span className="text-xs bg-amber-100 text-amber-700 rounded px-1.5 py-0.5 shrink-0">
                Requires: {feat.prerequisite}
              </span>
            )}
          </div>
          <FeatEffectBadges slug={feat.slug} />
          {/* One-line teaser when collapsed */}
          {!open && description && (
            <p className="text-xs text-parchment-400 mt-1 truncate">{description}</p>
          )}
        </div>
        <span className="text-parchment-400 text-xs shrink-0 mt-0.5">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-3 pb-3 border-t border-parchment-100 pt-2 space-y-2">
          {/* Structured notes (preferred) */}
          {effect.notes && effect.notes.length > 0 && (
            <ul className="text-sm text-parchment-700 list-disc list-inside space-y-0.5">
              {effect.notes.map(n => <li key={n}>{n}</li>)}
            </ul>
          )}
          {/* Full scraped description */}
          {description && (
            <p className="text-sm text-parchment-600 leading-relaxed">{description}</p>
          )}
          {!effect.notes?.length && !description && (
            <p className="text-xs text-parchment-400">No description available. Run <code>npm run scrape</code> to fetch feat data.</p>
          )}
        </div>
      )}
    </div>
  )
}

export default function Feats() {
  const { feats, loading } = useContent()
  const [search, setSearch] = useState('')

  const filtered = feats.filter(f => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      f.name.toLowerCase().includes(q) ||
      (f.prerequisite?.toLowerCase().includes(q) ?? false) ||
      (f.description?.toLowerCase().includes(q) ?? false)
    )
  })

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-parchment-800">Feats</h1>
        <span className="text-sm text-parchment-500">{filtered.length} feat{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      <input
        className="input mb-4"
        placeholder="Search by name, prerequisite, or description…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        autoFocus
      />

      {loading && <p className="text-parchment-400 text-center py-8">Loading…</p>}

      <div className="space-y-2">
        {filtered.map(feat => (
          <FeatCard key={feat.slug} feat={feat} defaultOpen={!!search} />
        ))}
        {!loading && filtered.length === 0 && (
          <p className="text-parchment-400 text-center py-8">No feats match "{search}"</p>
        )}
        {!loading && feats.length === 0 && (
          <p className="text-parchment-400 text-center py-8">
            No feat data. Run <code className="bg-parchment-100 rounded px-1">npm run scrape</code> first.
          </p>
        )}
      </div>
    </div>
  )
}
