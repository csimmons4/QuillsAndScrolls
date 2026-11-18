import { z } from 'zod'

const BASE = '/data/wikidot'

async function loadJson<T>(name: string): Promise<T[]> {
  try {
    const res = await fetch(`${BASE}/${name}.json`)
    if (!res.ok) return []
    return res.json()
  } catch {
    return []
  }
}

const SourceSchema = z.object({
  site: z.string(),
  license: z.string(),
  url: z.string(),
})

const ABILITY_VALUES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Normalize a spell's `classes` array into canonical lowercase slugs.
 *  Scraper output sometimes looks like ["Wizard (Tasha's)", "Cleric"] — strip
 *  parenthetical suffixes and lowercase so consumers can do `.includes('wizard')`. */
export function normalizeClassList(arr: string[]): string[] {
  return arr
    .map(c => c.toLowerCase().replace(/\s*\(.*?\)/g, '').trim())
    .filter(Boolean)
}

// ── Spell schema ────────────────────────────────────────────────────────────

const SpellComponentsSchema = z.object({
  v: z.boolean(),
  s: z.boolean(),
  m: z.boolean(),
  materialText: z.string().optional(),
})

const SpellSavingThrowSchema = z.object({
  ability: z.enum(ABILITY_VALUES),
  effectOnSave: z.enum(['half', 'none', 'negates']),
})

const SpellDamageSchema = z.object({
  dice: z.string(),
  type: z.string(),
})

const SpellAreaSchema = z.object({
  shape: z.enum(['cone', 'sphere', 'cube', 'line', 'cylinder']),
  size: z.number(),
})

export const SpellSchema = z.object({
  slug: z.string(),
  name: z.string(),
  level: z.number(),
  school: z.string(),
  castingTime: z.string(),
  range: z.string(),
  components: z.string(),
  duration: z.string(),
  description: z.string(),
  higherLevels: z.string().optional(),
  classes: z.array(z.string()).default([]),
  source: SourceSchema,

  // Enrichment fields (all optional — populated by overlay or post-parse derivation)
  classLists: z.array(z.string()).optional(),
  ritual: z.boolean().optional(),
  concentration: z.boolean().optional(),
  componentsParsed: SpellComponentsSchema.optional(),
  damage: SpellDamageSchema.optional(),
  savingThrow: SpellSavingThrowSchema.optional(),
  attackRoll: z.enum(['melee', 'ranged']).optional(),
  area: SpellAreaSchema.optional(),
}).transform(spell => ({
  ...spell,
  classLists: spell.classLists && spell.classLists.length > 0
    ? spell.classLists
    : normalizeClassList(spell.classes),
}))

export type SpellDef = z.infer<typeof SpellSchema>

// ── Feat schema ─────────────────────────────────────────────────────────────

export const FeatSpellSchema = z.object({
  slug: z.string(),
  name: z.string(),
  level: z.number(),
  usesPerLongRest: z.number().optional(),
  minLevel: z.number().optional(),   // character level the spell is gained at (racial "once you reach 3rd level")
  castLevel: z.number().optional(),  // cast with a slot of this level (Tiefling: Hellish Rebuke as a 2nd-level spell)
})
export type FeatSpell = z.infer<typeof FeatSpellSchema>

const FeatAbilityScoreIncreaseSchema = z.object({
  choose: z.number(),
  from: z.array(z.enum(ABILITY_VALUES)),
  max: z.number().optional(),
})

const FeatGrantsSpellsSchema = z.object({
  fromList: z.string().optional(),       // class slug whose spell list to draw from
  fromClassChoice: z.array(z.string()).optional(), // player picks one of these classes
  fromSchool: z.string().optional(),     // spell school filter (e.g. 'enchantment')
  explicit: z.array(FeatSpellSchema).optional(),  // pre-decided spells (no chooser)
  count: z.number().default(0),          // spells to choose (non-cantrip)
  maxLevel: z.number().optional(),       // max spell level eligible
  cantripsCount: z.number().optional(),  // separate count for cantrips
  usesPerLongRest: z.number().optional(),// applies to chosen non-cantrips
  abilityForCasting: z.enum(ABILITY_VALUES).optional(),
})
export type FeatGrantsSpells = z.infer<typeof FeatGrantsSpellsSchema>

const FeatGrantsProficienciesSchema = z.object({
  skills: z.number().optional(),
  tools: z.number().optional(),
  armor: z.array(z.enum(['light', 'medium', 'heavy', 'shield'])).optional(),
  saves: z.object({ count: z.number() }).optional(),
  languages: z.number().optional(),
})

const FeatGrantsFeatureSchema = z.object({
  name: z.string(),
  description: z.string(),
})

export const FeatSchema = z.object({
  slug: z.string(),
  name: z.string(),
  prerequisite: z.string().optional(),
  description: z.string(),
  source: SourceSchema,

  // Enrichment fields:
  abilityScoreIncrease: FeatAbilityScoreIncreaseSchema.optional(),
  grantsSpells: FeatGrantsSpellsSchema.optional(),
  grantsFeature: z.array(FeatGrantsFeatureSchema).optional(),
  grantsProficiencies: FeatGrantsProficienciesSchema.optional(),
  repeatable: z.boolean().optional(),

  // Passive bonuses (migrated from src/data/featEffects.ts → FeatEffect)
  initiativeBonus: z.number().optional(),
  speedBonus: z.number().optional(),
  passivePerceptionBonus: z.number().optional(),
  passiveInvestigationBonus: z.number().optional(),
  hpBonusPerLevel: z.number().optional(),
  naturalArmorBase: z.number().optional(),
  concentrationAdvantage: z.boolean().optional(),
  grantedCantrips: z.array(FeatSpellSchema).optional(),
  grantedSpells: z.array(FeatSpellSchema).optional(),
  resistances: z.array(z.string()).optional(),
  immunities: z.array(z.string()).optional(),
  conditionImmunities: z.array(z.string()).optional(),
  advantages: z.array(z.string()).optional(),
  grantedExpertise: z.number().optional(),
  notes: z.array(z.string()).optional(),
  grantedSkillProficiencies: z.array(z.string()).optional(),
  grantedSkillExpertise: z.array(z.string()).optional(),
})

export type FeatDef = z.infer<typeof FeatSchema>

// ── Item schema ─────────────────────────────────────────────────────────────

export const WeaponStatsSchema = z.object({
  damage: z.string(),
  damageType: z.string(),
  finesse: z.boolean().optional(),
  ranged: z.boolean().optional(),
  versatile: z.string().optional(),
  twoHanded: z.boolean().optional(),
  light: z.boolean().optional(),
  label: z.string().optional(),
  weight: z.number().optional(),
})
export type WeaponStats = z.infer<typeof WeaponStatsSchema>

export const ArmorStatsSchema = z.object({
  acBase: z.number(),
  type: z.enum(['light', 'medium', 'heavy', 'shield']),
  stealthDisadvantage: z.boolean().optional(),
  minStrength: z.number().optional(),
  label: z.string().optional(),
  weight: z.number().optional(),
})
export type ArmorStats = z.infer<typeof ArmorStatsSchema>

export const ItemSchema = z.object({
  slug: z.string(),
  name: z.string(),
  type: z.string().default(''),
  rarity: z.string().default(''),
  attunement: z.boolean().default(false),
  description: z.string().default(''),
  weight: z.number().optional(),
  cost: z.string().optional(),
  source: SourceSchema,

  // Enrichment fields (overlay-supplied)
  weaponStats: WeaponStatsSchema.optional(),
  armorStats: ArmorStatsSchema.optional(),

  // Passive effect fields — applied when the item is equipped
  acBonus: z.number().optional(),               // flat AC bonus (stacks with armor)
  requiresUnarmored: z.boolean().optional(),    // bonuses only apply with no armor or shield (Bracers of Defense)
  savingThrowBonus: z.number().optional(),       // bonus to all saving throws
  abilityCheckBonus: z.number().optional(),      // bonus to all ability checks (incl. skills)
  spellDCBonus: z.number().optional(),           // bonus to spell save DC
  spellAttackBonus: z.number().optional(),       // bonus to spell attack rolls
  abilityScoreOverride: z.record(z.string(), z.number()).optional(), // sets score to value when higher
  abilityScoreBonus: z.record(z.string(), z.number()).optional(),    // adds to score (capped at 20)
  grantedResistances: z.array(z.string()).optional(),
  grantedImmunities: z.array(z.string()).optional(),
  grantedConditionImmunities: z.array(z.string()).optional(),
  grantedSkillProficiencies: z.array(z.string()).optional(),
  grantedSkillExpertise: z.array(z.string()).optional(),

  // Potions & oils (overlay-supplied) — consumed with a Drink button instead of equipped.
  // `effect` is the short badge on the inventory row; `healing` is a dice formula the
  // player rolls physically and types in. Potions with a `duration` (label + length in
  // minutes; the maximum for rolled durations) go into the sheet's Active Potions box.
  potion: z.object({
    effect: z.string(),
    healing: z.string().optional(),
    duration: z.object({ label: z.string(), minutes: z.number() }).optional(),
    // What the potion lets you do while active (Fire Breath's exhale, Mind Control's Dominate…).
    // DCs are the potion's own, not the drinker's.
    action: z.object({
      name: z.string(),
      timing: z.string(),
      range: z.string().optional(),
      save: z.object({ ability: z.enum(ABILITY_VALUES), dc: z.number() }).optional(),
      damage: z.string().optional(),
      onSave: z.string().optional(),
      text: z.string().optional(),
    }).optional(),
    uses: z.number().optional(),               // limited uses; the effect ends when they're spent
    note: z.string().optional(),               // rules reminder shown while active
    abilityOverride: z.record(z.string(), z.number()).optional(), // sets the score while active, if higher
    hpMaxMultiplier: z.number().optional(),    // Giant Size doubles max HP (and current HP when drunk)
    tempHp: z.number().optional(),             // temporary HP gained when drunk (Heroism)
    // Effects applied to the sheet while the potion is running (see potionEffects.ts)
    acBonus: z.number().optional(),                       // Speed (Haste) +2
    speedMultiplier: z.number().optional(),               // Speed (Haste) ×2
    extraSpeeds: z.array(z.object({
      mode: z.enum(['fly', 'swim', 'climb']),
      feet: z.number().optional(),                        // omitted = equal to your walking speed
      hover: z.boolean().optional(),
    })).optional(),
    saveAdvantage: z.array(z.enum(ABILITY_VALUES)).optional(),
    saveDisadvantage: z.array(z.enum(ABILITY_VALUES)).optional(),
    checkAdvantage: z.array(z.enum(ABILITY_VALUES)).optional(),     // ability checks (skills) using these
    checkDisadvantage: z.array(z.enum(ABILITY_VALUES)).optional(),
    rollBonusDice: z.string().optional(),                 // Bless: added to attack rolls and saves
    weaponDamageDice: z.string().optional(),              // Enlarge '+1d4' / Reduce '−1d4'
    resistances: z.array(z.string()).optional(),
    conditionImmunities: z.array(z.string()).optional(),
    advantages: z.array(z.string()).optional(),           // situational advantages, listed under Defenses
    conditions: z.array(z.string()).optional(),           // conditions you have while it lasts (Invisible)
    // A choice made when drinking: a damage type (Resistance) or which weapon to coat (Sharpness)
    choice: z.object({ kind: z.enum(['damageType', 'weapon']), label: z.string(), options: z.array(z.string()).optional() }).optional(),
    weaponBonus: z.number().optional(),                   // +N to hit and damage with the chosen weapon
    onDrink: z.object({
      removeConditions: z.array(z.string()).optional(),   // Elixir of Health, Vitality
      clearExhaustion: z.boolean().optional(),            // Vitality
      // Damage on drinking (Poison): rolled by the player; a failed save adds a condition and
      // `ongoingDice` d-dice of damage each turn, shrinking by one per successful save.
      damage: z.object({
        dice: z.string(), type: z.string(),
        save: z.object({ ability: z.enum(ABILITY_VALUES), dc: z.number() }),
        failCondition: z.string().optional(),
        ongoingDice: z.number().optional(),
      }).optional(),
    }).optional(),
  }).optional(),
})
export type ItemDef = z.infer<typeof ItemSchema>

// ── Race schema ─────────────────────────────────────────────────────────────

const SubraceSchema = z.object({
  slug: z.string(),
  name: z.string(),
  traits: z.array(z.string()).default([]),
  abilityBonuses: z.record(z.string(), z.number()).optional(),
  grantedCantrip: z.string().optional(),   // class slug (e.g. 'wizard' → pick one)
  grantedSpells: z.array(FeatSpellSchema).optional(),
  hpBonusPerLevel: z.number().optional(),  // e.g. Hill Dwarf's Dwarven Toughness
  speed: z.number().optional(),            // replaces the race's walking speed (Wood Elf's Fleet of Foot)
  grantedWeapons: z.array(z.string()).optional(),
  grantedArmor: z.array(z.string()).optional(),
  grantedTools: z.array(z.string()).optional(),
  extraLanguages: z.number().optional(),   // languages of the player's choice
})

export const RaceSchema = z.object({
  slug: z.string(),
  name: z.string(),
  size: z.string().optional(),
  speed: z.number().default(30),
  traits: z.array(z.string()).default([]),
  languages: z.array(z.string()).default([]),
  proficiencies: z.array(z.string()).default([]),
  source: SourceSchema,

  // Enrichment fields (populated by overlay — scraped data lacks all of these):
  category: z.enum(['Common', 'Uncommon', 'Exotic']).optional(),
  abilityBonuses: z.record(z.string(), z.number()).optional(),
  subraces: z.array(SubraceSchema).optional(),
  chooseAbilityBonuses: z.number().optional(),
  bonusSkills: z.number().optional(),
  grantsFeat: z.boolean().optional(),
  hasDraconicAncestry: z.boolean().optional(),
  hasVariant: z.boolean().optional(),
  skillChoices: z.object({ count: z.number(), from: z.array(z.string()) }).optional(),
  grantedSkills: z.array(z.string()).optional(),
  grantedTools: z.array(z.string()).optional(),
  grantedWeapons: z.array(z.string()).optional(),  // e.g. Dwarven Combat Training
  grantedArmor: z.array(z.string()).optional(),
  grantedLanguages: z.array(z.string()).optional(),
  naturalArmor: z.object({ base: z.number(), addDex: z.boolean() }).optional(),
  resistances: z.array(z.string()).optional(),
  immunities: z.array(z.string()).optional(),
  conditionImmunities: z.array(z.string()).optional(),
  advantages: z.array(z.string()).optional(),
  grantedSpells: z.array(FeatSpellSchema).optional(),
  hpBonusPerLevel: z.number().optional(),
})

export type RaceDef = z.infer<typeof RaceSchema>

// ── Background schema ────────────────────────────────────────────────────────

export const BackgroundSchema = z.object({
  slug: z.string(),
  name: z.string(),
  book: z.string().optional(),
  skillProficiencies: z.array(z.string()).default([]),
  toolProficiencies: z.array(z.string()).default([]).transform(
    arr => arr.filter(t => t.toLowerCase() !== 'none')
  ),
  languages: z.number().default(0),
  startingEquipment: z.array(z.string()).default([]),
  feature: z.object({ name: z.string(), description: z.string() })
    .default({ name: '', description: '' }),
  personalityTraits: z.array(z.string()).default([]),
  ideals: z.array(z.string()).default([]),
  bonds: z.array(z.string()).default([]),
  flaws: z.array(z.string()).default([]),
  source: SourceSchema,

  // Enrichment fields (overlay-supplied):
  grantsSpells: FeatGrantsSpellsSchema.optional(),
  startingGold: z.number().default(0),
})

export type BackgroundDef = z.infer<typeof BackgroundSchema>

// ── Class schema ─────────────────────────────────────────────────────────────

const ClassFeatureSchema = z.object({
  level: z.number(),
  name: z.string(),
  description: z.string().default(''),
})

const SubclassSchema = z.object({
  slug: z.string(),
  name: z.string(),
  features: z.array(ClassFeatureSchema).default([]),
})

export const ClassSchema = z.object({
  slug: z.string(),
  name: z.string(),
  hitDie: z.number(),
  spellcastingAbility: z.string().optional(),
  saveProficiencies: z.array(z.string()).default([]),
  armorProficiencies: z.array(z.string()).default([]),
  weaponProficiencies: z.array(z.string()).default([]),
  toolProficiencies: z.array(z.string()).default([]),
  skillChoices: z.array(z.string()).default([]),
  numSkillChoices: z.number().default(0),
  startingEquipment: z.array(z.string()).default([]),
  features: z.array(ClassFeatureSchema).default([]),
  spellSlotTable: z.array(z.array(z.number())).optional(),
  subclasses: z.array(SubclassSchema).optional(),
  source: SourceSchema,
})

export type ClassDef = z.infer<typeof ClassSchema>
export type ClassFeature = z.infer<typeof ClassFeatureSchema>
export type SubclassDef = z.infer<typeof SubclassSchema>

export interface DataMeta {
  scrapedAt: string
  counts: Record<string, number>
}

export async function loadAllContent() {
  const [spells, items, races, classes, backgrounds, feats] = await Promise.all([
    loadJson<unknown>('spells'),
    loadJson<unknown>('items'),
    loadJson<unknown>('races'),
    loadJson<unknown>('classes'),
    loadJson<unknown>('backgrounds'),
    loadJson<unknown>('feats'),
  ])
  let meta: DataMeta | null = null
  try {
    const res = await fetch(`${BASE}/meta.json`)
    if (res.ok) meta = await res.json()
  } catch { /* no meta yet */ }
  return { spells, items, races, classes, backgrounds, feats, meta }
}
