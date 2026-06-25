import type { SpellDef } from '../content/loaders'

const ORDINAL = ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th']

/** Parse a material component string for a gp cost and whether it is consumed.
 *  Returns null if the component has no notable cost. */
export function parseMaterial(components: string | undefined): { cost: string; consumed: boolean } | null {
  if (!components) return null
  const m = components.match(/\(([^)]+)\)/)
  if (!m) return null
  const inner = m[1]
  const costMatch = inner.match(/([\d,]+)\s*gp/)
  if (!costMatch) return null
  const consumed = /\bconsumes?\b|\bwhich (the spell |it )?consumes?\b/i.test(inner)
  return { cost: `${costMatch[1]} gp`, consumed }
}

/** Strip the redundant "At Higher Levels." prefix (the section already has that
 *  header) and the trailing "Spell Lists. …" line the scraper appends. */
export function cleanHigherLevels(raw: string | undefined): string {
  if (!raw) return ''
  return raw
    .replace(/^\s*At Higher Levels[.:]?\s*/i, '')
    .replace(/\n?\s*Spell Lists[.:].*$/is, '')
    .trim()
}

function levelLine(spell: SpellDef): string {
  const school = spell.school || ''
  if (spell.level === 0) return `${school} cantrip`.trim()
  return `${ORDINAL[spell.level] ?? `${spell.level}th`}-level ${school.toLowerCase()}`.trim()
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-parchment-500">{label}</div>
      <div className="text-parchment-800 break-words">{value || '—'}</div>
    </div>
  )
}

/** Compact stat-block header for a spell: level/school line, the four core fields
 *  (casting time, range, components, duration) in a grid, and mechanic tags.
 *  When `saveDc` / `attackBonus` are supplied, the save and attack tags show the
 *  character's actual numbers (e.g. "DEX save · DC 15", "+7 to hit") instead of
 *  the generic mechanic name. */
export function SpellStatBlock({ spell, saveDc, attackBonus }: { spell: SpellDef; saveDc?: number; attackBonus?: number }) {
  const durationText = (spell.concentration ? 'Concentration, up to ' : '') + spell.duration
  const material = parseMaterial(spell.components)
  const tags: { label: string; cls: string }[] = []
  if (spell.concentration) tags.push({ label: 'Concentration', cls: 'bg-amber-50 text-amber-700 border-amber-200' })
  if (spell.ritual) tags.push({ label: 'Ritual · +10 min, no slot', cls: 'bg-blue-50 text-blue-700 border-blue-200' })
  if (spell.savingThrow) {
    const dcPart = saveDc && saveDc > 0 ? ` · DC ${saveDc}` : ''
    const halfPart = spell.savingThrow.effectOnSave === 'half' ? ' · half on success' : ''
    tags.push({ label: `${spell.savingThrow.ability.toUpperCase()} save${dcPart}${halfPart}`, cls: 'bg-violet-50 text-violet-700 border-violet-200 font-semibold' })
  }
  if (spell.attackRoll) {
    const label = attackBonus !== undefined
      ? `${attackBonus >= 0 ? '+' : ''}${attackBonus} to hit`
      : `${spell.attackRoll} spell attack`
    tags.push({ label, cls: 'bg-violet-50 text-violet-700 border-violet-200 font-semibold' })
  }
  if (spell.damage) tags.push({ label: `${spell.damage.dice}${spell.damage.type ? ` ${spell.damage.type}` : ''}`, cls: 'bg-red-50 text-red-700 border-red-200 font-mono' })
  if (material) tags.push({ label: material.consumed ? `${material.cost} · consumed` : material.cost, cls: material.consumed ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-parchment-100 text-parchment-600 border-parchment-300' })

  return (
    <div className="rounded-md border border-parchment-200 bg-parchment-50 p-2.5">
      <div className="text-[11px] italic text-parchment-500 mb-2">{levelLine(spell)}</div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-2 text-xs">
        <Field label="Casting Time" value={spell.castingTime} />
        <Field label="Range" value={spell.range} />
        <Field label="Components" value={spell.components} />
        <Field label="Duration" value={durationText} />
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {tags.map(t => (
            <span key={t.label} className={`text-xs rounded px-1.5 py-0.5 border ${t.cls}`}>{t.label}</span>
          ))}
        </div>
      )}
    </div>
  )
}
