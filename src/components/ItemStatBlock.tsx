import type { WeaponStats, ArmorStats, ItemDef } from '../content/loaders'

const RARITY_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  common:    { bg: 'bg-parchment-100', text: 'text-parchment-600', border: 'border-parchment-300' },
  uncommon:  { bg: 'bg-green-50',      text: 'text-green-700',      border: 'border-green-200' },
  rare:      { bg: 'bg-blue-50',       text: 'text-blue-700',       border: 'border-blue-200' },
  'very rare': { bg: 'bg-violet-50',   text: 'text-violet-700',     border: 'border-violet-200' },
  legendary: { bg: 'bg-amber-50',      text: 'text-amber-700',      border: 'border-amber-200' },
  artifact:  { bg: 'bg-orange-50',     text: 'text-orange-700',     border: 'border-orange-200' },
}

function Badge({ label, cls }: { label: string; cls: string }) {
  return <span className={`text-xs rounded px-1.5 py-0.5 border font-medium ${cls}`}>{label}</span>
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-parchment-500">{label}</div>
      <div className="text-parchment-800 text-xs break-words">{value || '—'}</div>
    </div>
  )
}

interface WeaponBlockProps {
  ws: WeaponStats
  attackBonus: number
  damageMod: number
  magicBonus: number
}

export function WeaponStatBlock({ ws, attackBonus, damageMod, magicBonus }: WeaponBlockProps) {
  const props: string[] = []
  if (ws.finesse)    props.push('Finesse')
  if (ws.light)      props.push('Light')
  if (ws.twoHanded)  props.push('Two-Handed')
  if (ws.versatile)  props.push(`Versatile (${ws.versatile})`)
  if (ws.ranged)     props.push('Ranged')

  const rangeStr = ws.ranged && ws.label ? ws.label : null
  const atkStr = `${attackBonus >= 0 ? '+' : ''}${attackBonus}`
  const dmgStr = `${ws.damage}${damageMod !== 0 ? (damageMod > 0 ? `+${damageMod}` : `${damageMod}`) : ''} ${ws.damageType}`
  const dmgVers = ws.versatile
    ? `${ws.versatile}${damageMod !== 0 ? (damageMod > 0 ? `+${damageMod}` : `${damageMod}`) : ''} ${ws.damageType}`
    : null

  return (
    <div className="rounded-md border border-parchment-200 bg-parchment-50 p-2.5 space-y-2">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-2">
        <Field label="Attack Bonus" value={atkStr} />
        <Field label="Damage" value={dmgStr} />
        {dmgVers && <Field label="Versatile" value={dmgVers} />}
        {rangeStr && <Field label="Range" value={rangeStr} />}
      </div>
      {(props.length > 0 || magicBonus > 0) && (
        <div className="flex flex-wrap gap-1">
          {magicBonus > 0 && <Badge label={`+${magicBonus} Magic`} cls="bg-violet-50 text-violet-700 border-violet-200" />}
          {props.map(p => <Badge key={p} label={p} cls="bg-parchment-100 text-parchment-600 border-parchment-200" />)}
        </div>
      )}
    </div>
  )
}

interface ArmorBlockProps {
  as_: ArmorStats
  computedAC?: number
}

export function ArmorStatBlock({ as_, computedAC }: ArmorBlockProps) {
  const typeLabel = as_.type.charAt(0).toUpperCase() + as_.type.slice(1)
  const acLabel = computedAC !== undefined ? `${computedAC} (with DEX)` : String(as_.acBase)
  return (
    <div className="rounded-md border border-parchment-200 bg-parchment-50 p-2.5 space-y-2">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-2">
        <Field label="AC" value={as_.type === 'shield' ? `+${as_.acBase}` : acLabel} />
        <Field label="Type" value={typeLabel} />
        {as_.minStrength ? <Field label="Min STR" value={String(as_.minStrength)} /> : null}
      </div>
      {as_.stealthDisadvantage && (
        <div className="flex gap-1">
          <Badge label="Disadvantage on Stealth" cls="bg-amber-50 text-amber-700 border-amber-200" />
        </div>
      )}
    </div>
  )
}

interface MagicItemBlockProps {
  def: ItemDef
  attuned?: boolean
  attunedCount?: number
}

export function MagicItemStatBlock({ def, attuned, attunedCount = 0 }: MagicItemBlockProps) {
  const rarityKey = def.rarity?.toLowerCase() ?? ''
  const rarityStyle = RARITY_STYLE[rarityKey] ?? RARITY_STYLE.common
  const badges: { label: string; cls: string }[] = []

  if (def.rarity) badges.push({ label: def.rarity.charAt(0).toUpperCase() + def.rarity.slice(1), cls: `${rarityStyle.bg} ${rarityStyle.text} ${rarityStyle.border}` })
  if (def.attunement) badges.push({ label: attuned ? '✦ Attuned' : (attunedCount >= 3 ? '✦ Attune (full)' : '✦ Requires Attunement'), cls: attuned ? 'bg-indigo-100 text-indigo-700 border-indigo-300' : 'bg-parchment-100 text-parchment-500 border-parchment-300' })
  if (def.acBonus)           badges.push({ label: `+${def.acBonus} AC`,          cls: 'bg-blue-50 text-blue-700 border-blue-200' })
  if (def.savingThrowBonus)  badges.push({ label: `+${def.savingThrowBonus} saves`, cls: 'bg-teal-50 text-teal-700 border-teal-200' })
  if (def.spellDCBonus)      badges.push({ label: `+${def.spellDCBonus} Spell DC`, cls: 'bg-violet-50 text-violet-700 border-violet-200' })
  if (def.spellAttackBonus)  badges.push({ label: `+${def.spellAttackBonus} Spell Atk`, cls: 'bg-violet-50 text-violet-700 border-violet-200' })
  if (def.abilityCheckBonus) badges.push({ label: `+${def.abilityCheckBonus} Ability Checks`, cls: 'bg-parchment-100 text-parchment-600 border-parchment-300' })
  def.grantedResistances?.forEach(r => badges.push({ label: `Resist: ${r}`, cls: 'bg-blue-50 text-blue-700 border-blue-200' }))
  def.grantedImmunities?.forEach(r => badges.push({ label: `Immune: ${r}`, cls: 'bg-purple-50 text-purple-700 border-purple-200' }))
  def.grantedConditionImmunities?.forEach(r => badges.push({ label: `Immune: ${r}`, cls: 'bg-purple-50 text-purple-700 border-purple-200' }))
  Object.entries(def.abilityScoreOverride ?? {}).forEach(([ability, val]) =>
    badges.push({ label: `${ability.toUpperCase()} = ${val}`, cls: 'bg-parchment-100 text-parchment-600 border-parchment-300' })
  )
  Object.entries(def.abilityScoreBonus ?? {}).forEach(([ability, val]) =>
    badges.push({ label: `+${val} ${ability.toUpperCase()}`, cls: 'bg-parchment-100 text-parchment-600 border-parchment-300' })
  )

  if (badges.length === 0) return null

  return (
    <div className="rounded-md border border-parchment-200 bg-parchment-50 p-2.5">
      <div className="flex flex-wrap gap-1">
        {badges.map(b => <Badge key={b.label} label={b.label} cls={b.cls} />)}
      </div>
    </div>
  )
}
