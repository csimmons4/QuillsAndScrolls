import { Character, CharacterClass, FeatureChoice } from './model'
import { touchUpdated } from './create'
import { CLASS_OPTIONS, MULTICLASS_PROF_GRANTS } from '../data/classData'

export interface LevelUpChoices {
  classSlug: string
  hpRoll: number
  subclassSlug?: string
  asiOrFeat?: { type: 'asi'; ability1: string; ability2: string } | { type: 'feat'; featSlug: string }
  newSkillExpertise?: string[]
  fightingStyle?: string
  spellsKnown?: string[]
  featureChoices?: FeatureChoice[]
  newSaveProficiencies?: string[]   // for multiclassing: the new class's save proficiencies
  multiclassSkill?: string          // for multiclassing: skill prof picked from limited list
  landTerrain?: string              // Druid Circle of the Land terrain choice
  runeChoices?: string[]            // Rune Knight: new rune slugs to add
  hunterChoice?: string             // Ranger Hunter: choice slug for this level
  totemTierKey?: string             // Totem Warrior: featuresChosen key ('totem-spirit'|'totem-aspect'|'totem-attunement')
  totemAnimal?: string              // Totem Warrior: chosen animal slug
  stormAura?: string                // Storm Herald: chosen aura slug (desert|sea|tundra)
  fourElementsDisciplines?: string[] // Four Elements Monk: discipline slugs to add
}

const ASI_LEVELS: Record<string, number[]> = {
  fighter: [4, 6, 8, 12, 14, 16, 19],
  rogue: [4, 8, 10, 12, 16, 19],
  default: [4, 8, 12, 16, 19],
}

export function asiLevelsForClass(classSlug: string): number[] {
  return ASI_LEVELS[classSlug] ?? ASI_LEVELS.default
}

export function applyLevelUp(char: Character, choices: LevelUpChoices): Character {
  let next = { ...char }

  const existingEntry = next.classes.find(c => c.classSlug === choices.classSlug)
  if (existingEntry) {
    next = {
      ...next,
      classes: next.classes.map(c =>
        c.classSlug === choices.classSlug
          ? { ...c, level: c.level + 1, hitDieRolls: [...c.hitDieRolls, choices.hpRoll] }
          : c
      ),
    }
  } else {
    const newEntry: CharacterClass = {
      classSlug: choices.classSlug,
      level: 1,
      hitDieRolls: [choices.hpRoll],
    }
    next = { ...next, classes: [...next.classes, newEntry] }
  }

  if (choices.subclassSlug) {
    next = {
      ...next,
      classes: next.classes.map(c =>
        c.classSlug === choices.classSlug ? { ...c, subclassSlug: choices.subclassSlug } : c
      ),
    }
    // Auto-apply fixed proficiencies the subclass grants on selection.
    const gp = CLASS_OPTIONS[choices.classSlug]?.subclasses.find(s => s.slug === choices.subclassSlug)?.grantedProficiencies
    if (gp?.skills?.length) {
      next = { ...next, skillProficiencies: [...new Set([...next.skillProficiencies, ...gp.skills])] }
    }
    if (gp?.tools?.length) {
      next = { ...next, toolProficiencies: [...new Set([...next.toolProficiencies, ...gp.tools])] }
    }
  }

  if (choices.asiOrFeat) {
    if (choices.asiOrFeat.type === 'asi') {
      const { ability1, ability2 } = choices.asiOrFeat
      const scores = { ...next.abilityScores } as Record<string, number>
      if (ability1 === ability2) {
        scores[ability1] = Math.min(20, (scores[ability1] ?? 10) + 2)
      } else {
        scores[ability1] = Math.min(20, (scores[ability1] ?? 10) + 1)
        scores[ability2] = Math.min(20, (scores[ability2] ?? 10) + 1)
      }
      next = { ...next, abilityScores: scores as Character['abilityScores'] }
    } else {
      const existingChoices = next.featuresChosen.filter(f => f.key !== 'feat')
      next = {
        ...next,
        featuresChosen: [
          ...existingChoices,
          { key: `feat-${choices.classSlug}-${Date.now()}`, value: choices.asiOrFeat.featSlug },
        ],
      }
    }
  }

  if (choices.newSaveProficiencies?.length) {
    const saves = new Set([...next.saveProficiencies, ...choices.newSaveProficiencies])
    next = { ...next, saveProficiencies: [...saves] }
  }

  // Apply multiclass limited proficiency grants (armor, weapons, tools)
  const isMulticlass = next.classes.find(c => c.classSlug === choices.classSlug)?.level === 1
    && choices.hpRoll > 0
    && next.classes.length > 1
  if (isMulticlass) {
    const grant = MULTICLASS_PROF_GRANTS[choices.classSlug]
    if (grant) {
      if (grant.armor?.length) {
        next = { ...next, armorProficiencies: [...new Set([...next.armorProficiencies, ...grant.armor])] }
      }
      if (grant.weapons?.length) {
        next = { ...next, weaponProficiencies: [...new Set([...next.weaponProficiencies, ...grant.weapons])] }
      }
      if (grant.tools?.length) {
        next = { ...next, toolProficiencies: [...new Set([...next.toolProficiencies, ...grant.tools])] }
      }
    }
    if (choices.multiclassSkill) {
      next = { ...next, skillProficiencies: [...new Set([...next.skillProficiencies, choices.multiclassSkill])] }
    }
  }

  // Fighting style (picked at Fighter L1, Paladin/Ranger L2 — also for multiclass entry)
  if (choices.fightingStyle) {
    const styleKey = `fighting-style-${choices.classSlug}`
    const hasStyle = next.featuresChosen.some(f => f.key === 'fighting-style' || f.key === styleKey)
    if (!hasStyle) {
      next = { ...next, featuresChosen: [...next.featuresChosen, { key: styleKey, value: choices.fightingStyle }] }
    }
  }

  // Circle of the Land terrain
  if (choices.landTerrain) {
    next = {
      ...next,
      featuresChosen: [...next.featuresChosen.filter(f => f.key !== 'land-terrain'), { key: 'land-terrain', value: choices.landTerrain }],
    }
  }

  // Rune Knight rune choices (merge with existing)
  if (choices.runeChoices?.length) {
    const existing = (() => {
      const fc = next.featuresChosen.find(f => f.key === 'runes')
      if (!fc) return []
      return Array.isArray(fc.value) ? fc.value : [fc.value]
    })()
    const merged = [...new Set([...existing, ...choices.runeChoices])]
    next = { ...next, featuresChosen: [...next.featuresChosen.filter(f => f.key !== 'runes'), { key: 'runes', value: merged }] }
  }

  // Totem Warrior animal choice (tier key distinguishes spirit/aspect/attunement)
  if (choices.totemTierKey && choices.totemAnimal) {
    next = { ...next, featuresChosen: [...next.featuresChosen.filter(f => f.key !== choices.totemTierKey!), { key: choices.totemTierKey, value: choices.totemAnimal }] }
  }

  // Storm Herald aura choice (one-time)
  if (choices.stormAura) {
    next = { ...next, featuresChosen: [...next.featuresChosen.filter(f => f.key !== 'storm-aura'), { key: 'storm-aura', value: choices.stormAura }] }
  }

  // Four Elements disciplines (accumulate)
  if (choices.fourElementsDisciplines?.length) {
    const existing = (() => {
      const fc = next.featuresChosen.find(f => f.key === 'four-elements')
      if (!fc) return []
      return Array.isArray(fc.value) ? fc.value : [fc.value]
    })()
    const merged = [...new Set([...existing, ...choices.fourElementsDisciplines])]
    next = { ...next, featuresChosen: [...next.featuresChosen.filter(f => f.key !== 'four-elements'), { key: 'four-elements', value: merged }] }
  }

  // Hunter subclass choice
  if (choices.hunterChoice) {
    const newLevel = next.classes.find(c => c.classSlug === choices.classSlug)?.level ?? 0
    const levelKey = `hunter-${newLevel}`
    next = { ...next, featuresChosen: [...next.featuresChosen.filter(f => f.key !== levelKey), { key: levelKey, value: choices.hunterChoice }] }
  }

  if (choices.newSkillExpertise?.length) {
    next = { ...next, skillExpertise: [...new Set([...next.skillExpertise, ...choices.newSkillExpertise])] }
  }

  if (choices.spellsKnown?.length) {
    const existing = new Set(next.spells.map(s => s.spellSlug))
    const newSpells = choices.spellsKnown
      .filter(slug => !existing.has(slug))
      .map(slug => ({
        spellSlug: slug,
        name: slug,
        classSlug: choices.classSlug,
        prepared: false,
        isHomebrew: false,
      }))
    next = { ...next, spells: [...next.spells, ...newSpells] }
  }

  if (choices.featureChoices?.length) {
    const REPLACEABLE = new Set(['invocations', 'metamagic'])
    const toReplace = new Set(choices.featureChoices.filter(f => REPLACEABLE.has(f.key)).map(f => f.key))
    const kept = toReplace.size > 0 ? next.featuresChosen.filter(f => !toReplace.has(f.key)) : next.featuresChosen
    next = { ...next, featuresChosen: [...kept, ...choices.featureChoices] }
  }

  return touchUpdated(next)
}
