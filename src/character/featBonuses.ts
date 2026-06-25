import type { FeatDef, FeatSpell } from '../content/loaders'

export interface FeatBonuses {
  initiativeBonus: number
  speedBonus: number
  passivePerceptionBonus: number
  passiveInvestigationBonus: number
  hpBonusPerLevel: number
  naturalArmorBase: number
  concentrationAdvantage: boolean
  grantedCantrips: FeatSpell[]
  grantedSpells: FeatSpell[]
  resistances: string[]
  immunities: string[]
  conditionImmunities: string[]
  advantages: string[]
  notes: Array<{ featSlug: string; lines: string[] }>
}

/** Aggregate passive mechanical bonuses from a character's feats. Feats come
 *  pre-merged from `useContent().feats` so the overlay has already been applied. */
export function sumFeatBonuses(featSlugs: string[], feats: FeatDef[]): FeatBonuses {
  const out: FeatBonuses = {
    initiativeBonus: 0, speedBonus: 0, passivePerceptionBonus: 0,
    passiveInvestigationBonus: 0, hpBonusPerLevel: 0, naturalArmorBase: 0,
    concentrationAdvantage: false,
    grantedCantrips: [], grantedSpells: [],
    resistances: [], immunities: [],
    conditionImmunities: [], advantages: [],
    notes: [],
  }
  const bySlug = new Map(feats.map(f => [f.slug, f] as const))
  for (const slug of featSlugs) {
    const f = bySlug.get(slug)
    if (!f) continue
    out.initiativeBonus += f.initiativeBonus ?? 0
    out.speedBonus += f.speedBonus ?? 0
    out.passivePerceptionBonus += f.passivePerceptionBonus ?? 0
    out.passiveInvestigationBonus += f.passiveInvestigationBonus ?? 0
    out.hpBonusPerLevel += f.hpBonusPerLevel ?? 0
    if ((f.naturalArmorBase ?? 0) > out.naturalArmorBase) out.naturalArmorBase = f.naturalArmorBase!
    if (f.concentrationAdvantage) out.concentrationAdvantage = true
    if (f.grantedCantrips) out.grantedCantrips.push(...f.grantedCantrips)
    if (f.grantedSpells) out.grantedSpells.push(...f.grantedSpells)
    if (f.resistances) out.resistances.push(...f.resistances)
    if (f.immunities) out.immunities.push(...f.immunities)
    if (f.conditionImmunities) out.conditionImmunities.push(...f.conditionImmunities)
    if (f.advantages) out.advantages.push(...f.advantages)
    if (f.notes?.length) out.notes.push({ featSlug: slug, lines: f.notes })
  }
  return out
}
