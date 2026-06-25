import type { FeatDef } from '../content/loaders'
import type { SpellDef } from '../content/loaders'
import { resolveFeatGrants, withFeatClassChoice } from '../character/grants'
import { SpellChooser } from './SpellChooser'

interface Props {
  feat: FeatDef
  spells: SpellDef[]
  classChoice: string
  setClassChoice: (slug: string) => void
  picks: Record<string, string[]>
  setPicks: (next: Record<string, string[]>) => void
}

/** Renders the chooser UI for a feat's `grantsSpells`. Handles three cases:
 *  - No grants → renders nothing.
 *  - `fromClassChoice` set → renders a class picker first; SpellChoosers appear once chosen.
 *  - Otherwise → renders SpellChoosers immediately. */
export function FeatGrantsBlock({ feat, spells, classChoice, setClassChoice, picks, setPicks }: Props) {
  if (!feat.grantsSpells) return null

  const choices = feat.grantsSpells.fromClassChoice
  if (choices && choices.length > 0 && !classChoice) {
    return (
      <div className="mt-3 rounded border border-parchment-300 p-3 bg-parchment-50">
        <div className="text-sm font-semibold mb-2">{feat.name} — Choose a spell list</div>
        <div className="flex flex-wrap gap-1.5">
          {choices.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => setClassChoice(c)}
              className="text-sm px-3 py-1.5 rounded border border-parchment-300 hover:border-parchment-500 hover:bg-white capitalize"
            >
              {c}
            </button>
          ))}
        </div>
      </div>
    )
  }

  const resolved = classChoice ? withFeatClassChoice(feat, classChoice) : feat
  const prompts = resolveFeatGrants(resolved, spells)
  if (prompts.length === 0) return null

  return (
    <div className="mt-3 space-y-2">
      {choices && classChoice && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-parchment-500">Spell list:</span>
          <span className="font-semibold capitalize">{classChoice}</span>
          <button
            type="button"
            onClick={() => setClassChoice('')}
            className="ml-2 text-parchment-500 underline hover:text-parchment-700"
          >
            change
          </button>
        </div>
      )}
      {prompts.map(p => (
        <SpellChooser
          key={p.storageKey}
          prompt={p}
          value={picks[p.storageKey] ?? []}
          onChange={next => setPicks({ ...picks, [p.storageKey]: next })}
          label={`${feat.name} — Choose ${p.count} ${p.category}${p.count > 1 ? 's' : ''} from ${p.classSlug}`}
        />
      ))}
    </div>
  )
}
