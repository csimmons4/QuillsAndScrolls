// What follows from a saved character, worked out the way the sheet does it: feats, item bonuses,
// ability scores with items and running potions applied, every skill proficiency it has, and its
// resting numbers (maximum HP, AC, passive scores, spell save DC) for the Vault and the party page.
// Fight effects that live only in the sheet's session (Rage, Bless, spells cast on you) aren't
// here; the sheet adds those itself.
import type { Character } from './model'
import type { ContentData } from '../content/ContentProvider'
import { hpMax, totalLevel, passivePerception, skillMod, spellSaveDC } from './derive'
import { sumFeatBonuses } from './featBonuses'
import { sumItemBonuses, effectiveAbilityScores } from './itemBonuses'
import { runningPotions, sumPotionEffects } from './potionEffects'
import { infusionBonus } from '../data/classData'
import { artificerLevelOf, computeFullAC, toSkillKey } from '../routes/sheet/helpers'

type Content = ContentData
export type ItemBonuses = ReturnType<typeof sumItemBonuses>

/** The feats a character has taken (every `feat-…` choice) */
export function featSlugsOf(char: Character): string[] {
  return char.featuresChosen
    .filter(fc => fc.key.startsWith('feat-'))
    .map(fc => typeof fc.value === 'string' ? fc.value : fc.value[0])
}

/** Equipped items' passive bonuses, plus an attuned Enhanced Arcane Focus in hand (its +1/+2 to spell
 *  attacks, like a magic focus) and worn, attuned Resistant Armor ("resistant-armor@fire") */
export function itemBonusesOf(char: Character, content: Pick<ContentData, 'items'>): ItemBonuses {
  const b = sumItemBonuses(char.equipment, content.items)
  const artificerLevel = artificerLevelOf(char)
  const focus = Math.max(0, ...char.equipment.filter(e => e.equipped).map(e => infusionBonus(e, artificerLevel, 'spellAttack')))
  const resisted = char.equipment
    .filter(e => e.equipped && e.attuned && e.infusion?.startsWith('resistant-armor@'))
    .map(e => e.infusion!.split('@')[1])
  if (!focus && resisted.length === 0) return b
  return { ...b, spellAttackBonus: b.spellAttackBonus + focus, resistances: [...new Set([...b.resistances, ...resisted])] }
}

/** The character with items' and potions' ability score overrides and bonuses applied (the same
 *  object when nothing changes them) */
export function effectiveCharOf(char: Character, itemBonuses: ItemBonuses, potionOverrides: Record<string, number>): Character {
  const scoreOverrides = { ...itemBonuses.abilityScoreOverrides }
  for (const [ab, v] of Object.entries(potionOverrides)) scoreOverrides[ab] = Math.max(scoreOverrides[ab] ?? 0, v)
  const scores = effectiveAbilityScores(char.abilityScores as Record<string, number>, { ...itemBonuses, abilityScoreOverrides: scoreOverrides })
  return scores === (char.abilityScores as Record<string, number>) ? char : { ...char, abilityScores: scores as Character['abilityScores'] }
}

/** effectiveChar plus every skill proficiency and expertise it gets on its own (background, race,
 *  feats, items), so skill modifiers always come out right */
export function skillCharOf(char: Character, effectiveChar: Character, content: Content, featSlugs: string[], itemBonuses: ItemBonuses): Character {
  const bg = content.backgrounds.find(b => b.slug === char.backgroundSlug)?.skillProficiencies.map(toSkillKey) ?? []
  const race = content.races.find(r => r.slug === char.raceSlug)?.grantedSkills?.map(toSkillKey) ?? []
  const featProfs = featSlugs.flatMap(slug => content.feats.find(f => f.slug === slug)?.grantedSkillProficiencies?.map(toSkillKey) ?? [])
  const featExpert = featSlugs.flatMap(slug => content.feats.find(f => f.slug === slug)?.grantedSkillExpertise?.map(toSkillKey) ?? [])
  return {
    ...effectiveChar,
    skillProficiencies: [...new Set([...char.skillProficiencies, ...bg, ...race, ...featProfs, ...itemBonuses.skillProficiencies])],
    skillExpertise: [...new Set([...char.skillExpertise, ...featExpert, ...itemBonuses.skillExpertise])],
  }
}

export interface RestingVitals {
  maxHp: number
  ac: number
  acSource: string
  passivePerception: number
  passiveInvestigation: number
  passiveInsight: number
  /** The best spell save DC across the character's classes, or null for a non-caster */
  spellSaveDC: number | null
}

/** Maximum HP, AC, passives and spell save DC as the sheet shows them, minus session-only effects */
export function restingVitals(char: Character, content: Content): RestingVitals {
  const featSlugs = featSlugsOf(char)
  const featBonuses = sumFeatBonuses(featSlugs, content.feats)
  const itemBonuses = itemBonusesOf(char, content)
  const fx = sumPotionEffects(runningPotions(char, content.items))
  const effectiveChar = effectiveCharOf(char, itemBonuses, fx.abilityOverrides)
  const skillChar = skillCharOf(char, effectiveChar, content, featSlugs, itemBonuses)
  const raceDef = content.races.find(r => r.slug === char.raceSlug)
  // A Wild Shape form (kept as a summon) brings its own AC
  const form = char.summons.find(s => s.templateKey === 'wild-shape')
  const armor = computeFullAC(effectiveChar, featBonuses.naturalArmorBase, content.items, raceDef, itemBonuses.acBonus, featSlugs.includes('medium-armor-master') ? 3 : 2)
  const dcs = char.classes.map(c => spellSaveDC(effectiveChar, c.classSlug, content)).filter(dc => dc > 0)
  return {
    maxHp: (hpMax(effectiveChar, content) + featBonuses.hpBonusPerLevel * totalLevel(char)) * fx.hpMultiplier,
    ac: (form ? form.ac : armor.ac) + fx.acBonus,
    acSource: (form ? `${form.name} (Wild Shape)` : armor.source) + (fx.acBonus ? ` +${fx.acBonus} potion` : ''),
    passivePerception: passivePerception(skillChar) + featBonuses.passivePerceptionBonus + itemBonuses.abilityCheckBonus,
    passiveInvestigation: 10 + skillMod(skillChar, 'investigation') + featBonuses.passiveInvestigationBonus + itemBonuses.abilityCheckBonus,
    passiveInsight: 10 + skillMod(skillChar, 'insight') + itemBonuses.abilityCheckBonus,
    spellSaveDC: dcs.length ? Math.max(...dcs) + itemBonuses.spellDCBonus : null,
  }
}
