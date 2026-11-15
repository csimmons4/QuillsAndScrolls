import type { FeatDef } from '../content/loaders'
import type { AbilityScores } from '../character/model'
import { InlinePicker } from './InlinePicker'

const ABILITY_LABELS: Record<string, string> = {
  str: 'Strength', dex: 'Dexterity', con: 'Constitution',
  int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma',
}

/** "+1 to …" chooser for half-feats. Renders nothing for feats without an ability increase;
 *  shows the automatic pick when the feat only allows one ability. */
export function FeatAbilityPicker({ feat, scores, value, onChange }: {
  feat: FeatDef | undefined
  scores: AbilityScores
  value: string
  onChange: (ability: string) => void
}) {
  const asi = feat?.abilityScoreIncrease
  if (!asi) return null
  const max = asi.max ?? 20
  const after = (a: string) => Math.min(max, scores[a as keyof AbilityScores] + 1)
  const savesToo = !!feat?.grantsProficiencies?.saves
  return (
    <div className="mt-3 p-3 rounded border border-parchment-200 bg-parchment-50">
      <div className="label">
        {feat!.name}: +1 to {asi.from.length === 1 ? ABILITY_LABELS[asi.from[0]] : 'one ability'}
        {savesToo ? ', plus proficiency in its saving throw' : ''}
      </div>
      {asi.from.length === 1 ? (
        <p className="text-sm text-parchment-600">
          {ABILITY_LABELS[asi.from[0]]} {scores[asi.from[0]]} → {after(asi.from[0])} (automatic)
        </p>
      ) : (
        <InlinePicker
          options={asi.from.map(a => ({ value: a, label: ABILITY_LABELS[a], sub: `${scores[a]} → ${after(a)}` }))}
          value={value}
          onChange={onChange}
          allowDeselect={false}
          columns={3}
        />
      )}
    </div>
  )
}
