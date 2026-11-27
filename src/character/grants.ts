import type { FeatDef, SpellDef } from '../content/loaders'
import type { Character, SpellEntry } from './model'

export interface SpellGrantPrompt {
  kind: 'spells'
  category: 'cantrip' | 'spell'
  /** Class slug used as `classSlug` on inserted SpellEntry, and as the filter source. */
  classSlug: string
  /** Spells the player can pick from (already filtered by class list + level cap). */
  fromSpells: SpellDef[]
  /** Number to pick. */
  count: number
  /** Uses per long rest (applied to non-cantrip picks via `char.freeSpellUses`). */
  usesPerLongRest?: number
  /** Stable key used to store these picks in local UI state or `featuresChosen`. */
  storageKey: string
}

/** The ability a half-feat's +1 goes to: the only option, or the player's pick if it's
 *  valid. Undefined if the feat has no ASI or the player hasn't picked yet. (Every
 *  half-feat in the data is `choose: 1`.) */
export function featAbilityPick(feat: FeatDef | undefined, picked: string | undefined): string | undefined {
  const asi = feat?.abilityScoreIncrease
  if (!asi) return undefined
  if (asi.from.length === 1) return asi.from[0]
  return picked && (asi.from as string[]).includes(picked) ? picked : undefined
}

/** Apply a half-feat's +1 (capped at its max, usually 20). Feats that grant a save
 *  proficiency alongside the ASI (Resilient) grant the save for the same ability. */
export function applyFeatAbilityIncrease(
  char: Pick<Character, 'abilityScores' | 'saveProficiencies'>,
  feat: FeatDef | undefined,
  picked: string | undefined,
): Pick<Character, 'abilityScores' | 'saveProficiencies'> {
  const ability = featAbilityPick(feat, picked)
  if (!feat || !ability) return { abilityScores: char.abilityScores, saveProficiencies: char.saveProficiencies }
  const scores = { ...char.abilityScores } as Record<string, number>
  scores[ability] = Math.min(feat.abilityScoreIncrease?.max ?? 20, (scores[ability] ?? 10) + 1)
  const saveProficiencies = feat.grantsProficiencies?.saves
    ? [...new Set([...char.saveProficiencies, ability])]
    : char.saveProficiencies
  return { abilityScores: scores as Character['abilityScores'], saveProficiencies }
}

/** Resolve a `fromClassChoice` feat by collapsing it into a `fromList` feat once
 *  the player has picked a class. No-op for feats that don't use class choice. */
export function withFeatClassChoice(feat: FeatDef, classSlug: string): FeatDef {
  if (!feat.grantsSpells?.fromClassChoice?.length) return feat
  return {
    ...feat,
    grantsSpells: {
      ...feat.grantsSpells,
      fromList: classSlug,
      fromClassChoice: undefined,
    },
  }
}

/** Pure resolver: given a feat and the merged spell content, return the chooser
 *  prompts the player must respond to. Empty array if the feat has no spell grants,
 *  or if it's a class-choice feat where the player hasn't picked a class yet. */
export function resolveFeatGrants(
  feat: FeatDef,
  spells: SpellDef[],
  storagePrefix = '',
): SpellGrantPrompt[] {
  const out: SpellGrantPrompt[] = []
  const gs = feat.grantsSpells
  if (!gs) return out

  // Class-choice feats produce no prompts until the player picks a class via
  // `withFeatClassChoice`. Without that resolution, we'd be filtering against
  // an unknown class list and surface every spell — bail instead.
  if (gs.fromClassChoice?.length && !gs.fromList) return out

  const classSlug = gs.fromList ?? 'feat'
  let baseList = spells
  if (gs.fromList) {
    baseList = baseList.filter(s => (s.classLists ?? []).includes(gs.fromList!))
  }
  if (gs.fromSchool) {
    const schools = (Array.isArray(gs.fromSchool) ? gs.fromSchool : [gs.fromSchool]).map(sc => sc.toLowerCase())
    baseList = baseList.filter(s => schools.includes(s.school.toLowerCase()))
  }
  if (gs.attackRollOnly) baseList = baseList.filter(s => !!s.attackRoll)

  if (gs.cantripsCount && gs.cantripsCount > 0) {
    out.push({
      kind: 'spells',
      category: 'cantrip',
      classSlug,
      fromSpells: baseList.filter(s => s.level === 0),
      count: gs.cantripsCount,
      storageKey: `${storagePrefix}feat-grants:${feat.slug}:cantrips`,
    })
  }

  if (gs.count && gs.count > 0) {
    const maxLevel = gs.maxLevel ?? 9
    out.push({
      kind: 'spells',
      category: 'spell',
      classSlug,
      fromSpells: baseList.filter(s => s.level > 0 && s.level <= maxLevel),
      count: gs.count,
      usesPerLongRest: gs.usesPerLongRest,
      storageKey: `${storagePrefix}feat-grants:${feat.slug}:spells`,
    })
  }

  return out
}

/** Apply a player's chosen spells from a grant prompt directly to a Character.
 *  Mutates the patch object and returns it for chaining. */
export function applyGrantPicks(
  patch: Pick<Character, 'spells' | 'freeSpellUses'>,
  prompt: SpellGrantPrompt,
  picks: string[],
  feat: FeatDef,
): Pick<Character, 'spells' | 'freeSpellUses'> {
  const spells = [...patch.spells]
  const freeSpellUses = { ...patch.freeSpellUses }

  for (const slug of picks) {
    const spell = prompt.fromSpells.find(s => s.slug === slug)
    if (!spell) continue
    if (!spells.find(e => e.spellSlug === slug)) {
      const freeUseKey = (prompt.usesPerLongRest && prompt.category !== 'cantrip')
        ? `feat:${feat.slug}:${slug}`
        : undefined
      const entry: SpellEntry = {
        spellSlug: slug,
        name: spell.name,
        classSlug: prompt.classSlug,
        prepared: true,
        isHomebrew: false,
        grantedBy: `feat:${feat.slug}`,
        ...(freeUseKey ? { usesPerLongRest: prompt.usesPerLongRest, freeUseKey } : {}),
      }
      spells.push(entry)
    }
  }

  patch.spells = spells
  patch.freeSpellUses = freeSpellUses
  return patch
}
