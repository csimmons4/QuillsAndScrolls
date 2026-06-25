import type { ItemDef } from '../content/loaders'
import type { EquipmentItem } from './model'

export interface ItemBonuses {
  acBonus: number
  savingThrowBonus: number
  abilityCheckBonus: number
  spellDCBonus: number
  spellAttackBonus: number
  abilityScoreOverrides: Record<string, number>
  abilityScoreBonuses: Record<string, number>
  resistances: string[]
  immunities: string[]
  conditionImmunities: string[]
  skillProficiencies: string[]
  skillExpertise: string[]
}

/** Aggregate passive mechanical bonuses from a character's equipped items. */
export function sumItemBonuses(equipment: EquipmentItem[], items: ItemDef[]): ItemBonuses {
  const out: ItemBonuses = {
    acBonus: 0, savingThrowBonus: 0, abilityCheckBonus: 0,
    spellDCBonus: 0, spellAttackBonus: 0,
    abilityScoreOverrides: {}, abilityScoreBonuses: {},
    resistances: [], immunities: [], conditionImmunities: [],
    skillProficiencies: [], skillExpertise: [],
  }
  const bySlug = new Map(items.map(i => [i.slug, i]))
  for (const slot of equipment) {
    const def = bySlug.get(slot.itemSlug)
    const alwaysWorn = def?.type === 'Ring'
    if (!slot.equipped && !alwaysWorn) continue
    if (!def) continue
    out.acBonus            += def.acBonus            ?? 0
    out.savingThrowBonus   += def.savingThrowBonus   ?? 0
    out.abilityCheckBonus  += def.abilityCheckBonus  ?? 0
    out.spellDCBonus       += def.spellDCBonus       ?? 0
    out.spellAttackBonus   += def.spellAttackBonus   ?? 0
    if (def.abilityScoreOverride) {
      for (const [ab, val] of Object.entries(def.abilityScoreOverride)) {
        if ((out.abilityScoreOverrides[ab] ?? 0) < val) out.abilityScoreOverrides[ab] = val
      }
    }
    if (def.abilityScoreBonus) {
      for (const [ab, val] of Object.entries(def.abilityScoreBonus)) {
        out.abilityScoreBonuses[ab] = (out.abilityScoreBonuses[ab] ?? 0) + val
      }
    }
    if (def.grantedResistances)           out.resistances.push(...def.grantedResistances)
    if (def.grantedImmunities)            out.immunities.push(...def.grantedImmunities)
    if (def.grantedConditionImmunities)   out.conditionImmunities.push(...def.grantedConditionImmunities)
    if (def.grantedSkillProficiencies)    out.skillProficiencies.push(...def.grantedSkillProficiencies)
    if (def.grantedSkillExpertise)        out.skillExpertise.push(...def.grantedSkillExpertise)
  }
  return out
}

/** Apply ability score overrides/bonuses from items to produce effective scores.
 *  Returns the original scores object if nothing changed (no allocation). */
export function effectiveAbilityScores(
  base: Record<string, number>,
  bonuses: ItemBonuses,
): Record<string, number> {
  const hasOverride = Object.keys(bonuses.abilityScoreOverrides).length > 0
  const hasBonus    = Object.keys(bonuses.abilityScoreBonuses).length > 0
  if (!hasOverride && !hasBonus) return base

  const scores = { ...base }
  for (const [ab, val] of Object.entries(bonuses.abilityScoreOverrides)) {
    if (val > (scores[ab] ?? 10)) scores[ab] = val
  }
  for (const [ab, bonus] of Object.entries(bonuses.abilityScoreBonuses)) {
    scores[ab] = Math.min(20, (scores[ab] ?? 10) + bonus)
  }
  return scores
}
