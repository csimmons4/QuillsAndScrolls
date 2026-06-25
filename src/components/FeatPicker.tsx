import { useState, useRef, useLayoutEffect } from 'react'
import type { FeatDef } from '../content/loaders'
import { useContent } from '../content/ContentProvider'

export function cleanFeatDesc(raw: string | undefined): string {
  if (!raw) return ''
  const match = raw.match(
    /(You\s+(?:have|gain|can|are|may|must)|Whenever\s+|When\s+(?:you|a\s)|Choose\s+|As a bonus|Once\s+(?:per|on)|While\s+|Your\s+|Starting\s+|Each\s+|Through\s+|By\s+|This\s+feat|Prerequisite[s]?:)/i
  )
  if (match?.index && match.index < 350) return raw.slice(match.index).trim()
  return raw
}

export function FeatEffectBadges({ slug }: { slug: string }) {
  const { feats } = useContent()
  const effect = feats.find(f => f.slug === slug)
  if (!effect) return null
  const badges: { label: string; color: string }[] = []
  if (effect.initiativeBonus)           badges.push({ label: `+${effect.initiativeBonus} Initiative`,          color: 'bg-blue-100 text-blue-700' })
  if (effect.speedBonus)                badges.push({ label: `+${effect.speedBonus}ft Speed`,                  color: 'bg-green-100 text-green-700' })
  if (effect.hpBonusPerLevel)           badges.push({ label: `+${effect.hpBonusPerLevel} HP/level`,            color: 'bg-red-100 text-red-700' })
  if (effect.passivePerceptionBonus)    badges.push({ label: `+${effect.passivePerceptionBonus} Passive Perc.`, color: 'bg-parchment-100 text-parchment-700' })
  if (effect.passiveInvestigationBonus) badges.push({ label: `+${effect.passiveInvestigationBonus} Passive Inv.`, color: 'bg-parchment-100 text-parchment-700' })
  if (effect.naturalArmorBase)          badges.push({ label: `Natural Armor (${effect.naturalArmorBase}+DEX)`, color: 'bg-parchment-100 text-parchment-700' })
  if (effect.concentrationAdvantage)    badges.push({ label: 'Adv. on Concentration',                          color: 'bg-amber-100 text-amber-700' })
  if (effect.grantedExpertise)          badges.push({ label: `Expertise ×${effect.grantedExpertise}`,          color: 'bg-indigo-100 text-indigo-700' })
  effect.resistances?.forEach(r =>      badges.push({ label: `Resist: ${r}`,                                   color: 'bg-blue-100 text-blue-700' }))
  effect.immunities?.forEach(r =>       badges.push({ label: `Immune: ${r}`,                                   color: 'bg-purple-100 text-purple-700' }))
  effect.conditionImmunities?.forEach(r => badges.push({ label: `Immune: ${r}`,                               color: 'bg-purple-100 text-purple-700' }))
  const granted = [...(effect.grantedCantrips ?? []), ...(effect.grantedSpells ?? [])]
  if (badges.length === 0 && !granted.length && !effect.notes?.length) return null
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {badges.map(b => (
        <span key={b.label} className={`text-xs rounded px-1.5 py-0.5 font-medium ${b.color}`}>{b.label}</span>
      ))}
      {granted.map(s => (
        <span key={s.slug} className="text-xs bg-indigo-100 text-indigo-700 rounded px-1.5 py-0.5">
          🔮 {s.name}{s.usesPerLongRest ? ` (${s.usesPerLongRest}/LR)` : s.level === 0 ? '' : ' (at will)'}
        </span>
      ))}
    </div>
  )
}

// ── Inner card (needs its own ref + layout effect) ─────────────────────────

interface PickerCardProps {
  feat: FeatDef
  selected: boolean
  onClick: () => void
}

function PickerCard({ feat, selected, onClick }: PickerCardProps) {
  const ref = useRef<HTMLDivElement>(null)
  const effect = feat
  const description = cleanFeatDesc(feat.description)
  const hasStructured = !!(
    effect.notes?.length || effect.initiativeBonus || effect.speedBonus ||
    effect.hpBonusPerLevel || effect.concentrationAdvantage || effect.grantedExpertise ||
    effect.resistances?.length || effect.immunities?.length || effect.conditionImmunities?.length ||
    effect.grantedCantrips?.length || effect.grantedSpells?.length
  )

  // After the card expands (DOM committed), scroll it into view within its container.
  useLayoutEffect(() => {
    if (selected && ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [selected])

  return (
    <div
      ref={ref}
      onClick={onClick}
      className={`p-2.5 rounded border cursor-pointer transition-colors ${
        selected ? 'border-parchment-500 bg-parchment-50' : 'border-parchment-100 hover:border-parchment-400'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-medium text-sm">{feat.name}</span>
            {feat.prerequisite && (
              <span className="text-xs bg-amber-100 text-amber-700 rounded px-1.5 py-0.5">
                Req: {feat.prerequisite}
              </span>
            )}
          </div>
          <FeatEffectBadges slug={feat.slug} />
          {selected && (
            <div className="mt-2 pt-2 border-t border-parchment-200">
              {effect.notes && effect.notes.length > 0 && (
                <ul className="text-xs text-parchment-700 list-disc list-inside space-y-0.5 mb-1">
                  {effect.notes.map(n => <li key={n}>{n}</li>)}
                </ul>
              )}
              {description && (
                <p className="text-xs text-parchment-500 leading-relaxed">
                  {description.slice(0, 600)}{description.length > 600 ? '…' : ''}
                </p>
              )}
            </div>
          )}
          {!selected && !hasStructured && description && (
            <p className="text-xs text-parchment-400 mt-0.5 truncate">{description}</p>
          )}
        </div>
        {selected && <span className="text-parchment-500 text-xs shrink-0 mt-0.5">✓</span>}
      </div>
    </div>
  )
}

// ── Public component ───────────────────────────────────────────────────────

interface FeatPickerProps {
  feats: FeatDef[]
  value: string
  onChange: (slug: string) => void
  /** Max-height class for the scrollable list, defaults to max-h-80 */
  maxHeightClass?: string
}

/** Searchable selectable feat card list. Click a card to select; click again to deselect. */
export function FeatPicker({ feats, value, onChange, maxHeightClass = 'max-h-80' }: FeatPickerProps) {
  const [search, setSearch] = useState('')

  // Guard against malformed entries (e.g. an overlay-added feat missing a name)
  // so a single bad row can't crash name-based search and blank the page.
  const named = feats.filter(f => f.name)
  const filtered = named.filter(f => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      f.name.toLowerCase().includes(q) ||
      (f.prerequisite?.toLowerCase().includes(q) ?? false) ||
      (f.description?.toLowerCase().includes(q) ?? false)
    )
  })

  return (
    <div>
      <input
        className="input mb-2"
        placeholder="Search feats by name, prerequisite, or description…"
        value={search}
        onChange={e => setSearch(e.target.value)}
      />
      <div className={`space-y-1.5 overflow-y-auto pr-1 ${maxHeightClass}`}>
        {filtered.map(f => (
          <PickerCard
            key={f.slug}
            feat={f}
            selected={value === f.slug}
            onClick={() => onChange(value === f.slug ? '' : f.slug)}
          />
        ))}
        {filtered.length === 0 && (
          <p className="text-xs text-parchment-400 text-center py-4">No feats match "{search}"</p>
        )}
      </div>
      {value && (
        <p className="text-sm text-parchment-600 mt-2">
          Selected: <strong>{feats.find(f => f.slug === value)?.name}</strong>
        </p>
      )}
    </div>
  )
}
