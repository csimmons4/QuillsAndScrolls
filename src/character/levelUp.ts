import { Character, CharacterClass, FeatureChoice } from './model'
import { touchUpdated } from './create'
import { CLASS_OPTIONS } from '../data/classData'

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
