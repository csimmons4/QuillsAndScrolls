import type { ItemDef } from '../content/loaders'
import type { Character } from './model'

export type PotionData = NonNullable<ItemDef['potion']>
export type ActivePotion = Character['activePotions'][number]

/** An active potion that is still working (not out of rounds or uses), with its item data. */
export interface RunningPotion { active: ActivePotion; def: PotionData | undefined }

/** Everything the running potions change on the sheet. */
export interface PotionEffects {
  abilityOverrides: Record<string, number>
  hpMultiplier: number
  acBonus: number
  speedMultiplier: number
  extraSpeeds: { mode: 'fly' | 'swim' | 'climb'; feet?: number; hover?: boolean }[]
  saveAdvantage: Set<string>
  saveDisadvantage: Set<string>
  checkAdvantage: Set<string>
  checkDisadvantage: Set<string>
  rollBonusDice: string[]        // added to attack rolls and saving throws (Bless)
  weaponDamageDice: string[]     // added to weapon damage (Enlarge / Reduce)
  weaponBonus: Map<string, number>  // equipment item name → +N to hit and damage (Oil of Sharpness)
  resistances: string[]
  conditionImmunities: string[]
  advantages: string[]
}

export function runningPotions(char: Character, items: ItemDef[]): RunningPotion[] {
  return char.activePotions
    .filter(p => p.roundsLeft !== 0 && p.usesLeft !== 0)
    .map(p => ({ active: p, def: items.find(i => i.slug === p.itemSlug)?.potion }))
}

export function sumPotionEffects(running: RunningPotion[]): PotionEffects {
  const fx: PotionEffects = {
    abilityOverrides: {}, hpMultiplier: 1, acBonus: 0, speedMultiplier: 1, extraSpeeds: [],
    saveAdvantage: new Set(), saveDisadvantage: new Set(), checkAdvantage: new Set(), checkDisadvantage: new Set(),
    rollBonusDice: [], weaponDamageDice: [], weaponBonus: new Map(),
    resistances: [], conditionImmunities: [], advantages: [],
  }
  for (const { active, def } of running) {
    if (!def) continue
    for (const [ab, v] of Object.entries(def.abilityOverride ?? {})) fx.abilityOverrides[ab] = Math.max(fx.abilityOverrides[ab] ?? 0, v)
    fx.hpMultiplier *= def.hpMaxMultiplier ?? 1
    fx.acBonus += def.acBonus ?? 0
    fx.speedMultiplier *= def.speedMultiplier ?? 1
    fx.extraSpeeds.push(...(def.extraSpeeds ?? []))
    def.saveAdvantage?.forEach(a => fx.saveAdvantage.add(a))
    def.saveDisadvantage?.forEach(a => fx.saveDisadvantage.add(a))
    def.checkAdvantage?.forEach(a => fx.checkAdvantage.add(a))
    def.checkDisadvantage?.forEach(a => fx.checkDisadvantage.add(a))
    if (def.rollBonusDice) fx.rollBonusDice.push(def.rollBonusDice)
    if (def.weaponDamageDice) fx.weaponDamageDice.push(def.weaponDamageDice)
    if (def.weaponBonus && active.choice) fx.weaponBonus.set(active.choice, Math.max(fx.weaponBonus.get(active.choice) ?? 0, def.weaponBonus))
    fx.resistances.push(...(def.resistances ?? []))
    if (def.choice?.kind === 'damageType' && active.choice) fx.resistances.push(active.choice)
    fx.conditionImmunities.push(...(def.conditionImmunities ?? []))
    fx.advantages.push(...(def.advantages ?? []))
  }
  // Bless-style dice don't stack with themselves
  fx.rollBonusDice = [...new Set(fx.rollBonusDice)]
  fx.weaponDamageDice = [...new Set(fx.weaponDamageDice)]
  return fx
}

const ABBR: Record<string, string> = { str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA' }
const list = (abilities: string[]) => abilities.map(a => ABBR[a] ?? a).join('/')

/** One line per thing a potion is doing, for the Active Potions box. */
export function describePotionEffects(def: PotionData | undefined, choice: string | undefined, walkSpeed: number): string[] {
  if (!def) return []
  const out: string[] = []
  for (const [ab, v] of Object.entries(def.abilityOverride ?? {})) out.push(`${ABBR[ab] ?? ab} ${v} (if higher)`)
  if (def.hpMaxMultiplier) out.push(`Max HP ×${def.hpMaxMultiplier}`)
  if (def.acBonus) out.push(`AC +${def.acBonus}`)
  if (def.speedMultiplier) out.push(`Speed ×${def.speedMultiplier}`)
  for (const s of def.extraSpeeds ?? []) {
    out.push(`${s.mode[0].toUpperCase()}${s.mode.slice(1)} speed ${s.feet ?? walkSpeed} ft${s.hover ? ' (hover)' : ''}`)
  }
  if (def.saveAdvantage?.length) out.push(`Advantage on ${list(def.saveAdvantage)} saves`)
  if (def.saveDisadvantage?.length) out.push(`Disadvantage on ${list(def.saveDisadvantage)} saves`)
  if (def.checkAdvantage?.length) out.push(`Advantage on ${list(def.checkAdvantage)} checks`)
  if (def.checkDisadvantage?.length) out.push(`Disadvantage on ${list(def.checkDisadvantage)} checks`)
  if (def.rollBonusDice) out.push(`${def.rollBonusDice} to attack rolls and saves`)
  if (def.weaponDamageDice) out.push(`Weapon damage ${def.weaponDamageDice}`)
  if (def.weaponBonus && choice) out.push(`${choice}: +${def.weaponBonus} to hit and damage (magical)`)
  if (def.resistances?.length) out.push(`Resistance: ${def.resistances.join(', ')}`)
  if (def.choice?.kind === 'damageType' && choice) out.push(`Resistance: ${choice}`)
  if (def.conditionImmunities?.length) out.push(`Immune: ${def.conditionImmunities.join(', ')}`)
  for (const a of def.advantages ?? []) out.push(`Advantage: ${a}`)
  for (const c of def.conditions ?? []) out.push(c)
  return out
}
