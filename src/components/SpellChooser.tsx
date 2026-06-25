import { useState } from 'react'
import type { SpellGrantPrompt } from '../character/grants'

interface Props {
  prompt: SpellGrantPrompt
  value: string[]
  onChange: (slugs: string[]) => void
  /** Label shown above the chooser, e.g. "Magic Initiate — Cleric Cantrips". */
  label?: string
}

/** Inline checkbox-style picker for feat-granted spells. Filters by name and
 *  caps selections at `prompt.count`. */
export function SpellChooser({ prompt, value, onChange, label }: Props) {
  const [search, setSearch] = useState('')
  const filtered = prompt.fromSpells.filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase())
  )

  const toggle = (slug: string) => {
    if (value.includes(slug)) {
      onChange(value.filter(s => s !== slug))
    } else if (value.length < prompt.count) {
      onChange([...value, slug])
    }
  }

  const atCap = value.length >= prompt.count
  const remaining = prompt.count - value.length

  return (
    <div className="rounded border border-parchment-300 p-3 bg-parchment-50">
      <div className="flex items-baseline justify-between mb-2 gap-2 flex-wrap">
        <div className="font-semibold text-sm">
          {label ?? `Choose ${prompt.count} ${prompt.category}${prompt.count > 1 ? 's' : ''} from ${prompt.classSlug}`}
          {prompt.usesPerLongRest && (
            <span className="ml-2 text-xs bg-indigo-100 text-indigo-700 rounded px-1.5 py-0.5">
              {prompt.usesPerLongRest}/LR
            </span>
          )}
        </div>
        <span className={`text-xs ${atCap ? 'text-green-700 font-semibold' : 'text-parchment-500'}`}>
          {value.length} / {prompt.count} picked{!atCap && remaining > 0 ? ` • ${remaining} left` : ''}
        </span>
      </div>

      <input
        className="input mb-2 text-sm"
        placeholder={`Search ${prompt.category}s…`}
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
        {filtered.map(spell => {
          const picked = value.includes(spell.slug)
          const disabled = !picked && atCap
          return (
            <label
              key={spell.slug}
              className={`flex items-center gap-2 p-1.5 rounded border text-sm cursor-pointer transition-colors ${
                picked
                  ? 'border-parchment-600 bg-white font-medium'
                  : disabled
                    ? 'border-parchment-100 opacity-40 cursor-not-allowed'
                    : 'border-parchment-100 hover:border-parchment-400'
              }`}
            >
              <input
                type="checkbox"
                checked={picked}
                disabled={disabled}
                onChange={() => toggle(spell.slug)}
              />
              <span className="flex-1 truncate">{spell.name}</span>
              <span className="text-xs text-parchment-500">{spell.school}</span>
            </label>
          )
        })}
        {filtered.length === 0 && (
          <p className="text-xs text-parchment-400 text-center py-2">No matches.</p>
        )}
      </div>
    </div>
  )
}
