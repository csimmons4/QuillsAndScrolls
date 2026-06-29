import { z } from 'zod'

export const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const
export type Ability = typeof ABILITIES[number]

export const SKILLS = [
  'acrobatics', 'animalHandling', 'arcana', 'athletics', 'deception',
  'history', 'insight', 'intimidation', 'investigation', 'medicine',
  'nature', 'perception', 'performance', 'persuasion', 'religion',
  'sleightOfHand', 'stealth', 'survival',
] as const
export type Skill = typeof SKILLS[number]

export const SKILL_ABILITY: Record<Skill, Ability> = {
  acrobatics: 'dex', animalHandling: 'wis', arcana: 'int',
  athletics: 'str', deception: 'cha', history: 'int',
  insight: 'wis', intimidation: 'cha', investigation: 'int',
  medicine: 'wis', nature: 'int', perception: 'wis',
  performance: 'cha', persuasion: 'cha', religion: 'int',
  sleightOfHand: 'dex', stealth: 'dex', survival: 'wis',
}

export const SKILL_LABELS: Record<Skill, string> = {
  acrobatics: 'Acrobatics', animalHandling: 'Animal Handling', arcana: 'Arcana',
  athletics: 'Athletics', deception: 'Deception', history: 'History',
  insight: 'Insight', intimidation: 'Intimidation', investigation: 'Investigation',
  medicine: 'Medicine', nature: 'Nature', perception: 'Perception',
  performance: 'Performance', persuasion: 'Persuasion', religion: 'Religion',
  sleightOfHand: 'Sleight of Hand', stealth: 'Stealth', survival: 'Survival',
}

const AbilityScoresSchema = z.object({
  str: z.number().int().min(1).max(30),
  dex: z.number().int().min(1).max(30),
  con: z.number().int().min(1).max(30),
  int: z.number().int().min(1).max(30),
  wis: z.number().int().min(1).max(30),
  cha: z.number().int().min(1).max(30),
})

const SummonAttackSchema = z.object({
  name: z.string(),
  toHit: z.number().optional(),
  damage: z.string().default(''),
  damageType: z.string().default(''),
  range: z.string().default(''),
  notes: z.string().default(''),
})

const SummonAbilitySchema = z.object({
  name: z.string(),
  description: z.string().default(''),
})

export const SummonSchema = z.object({
  id: z.string(),
  name: z.string(),
  templateKey: z.string().optional(),
  hp: z.object({ current: z.number(), max: z.number() }),
  ac: z.number().default(10),
  speed: z.number().default(30),
  abilityScores: z.object({
    str: z.number(), dex: z.number(), con: z.number(),
    int: z.number(), wis: z.number(), cha: z.number(),
  }).optional(),
  saveProficiencies: z.array(z.string()).default([]),
  immunities: z.array(z.string()).default([]),
  resistances: z.array(z.string()).default([]),
  attacks: z.array(SummonAttackSchema).default([]),
  abilities: z.array(SummonAbilitySchema).default([]),
  notes: z.string().default(''),
})
export type Summon = z.infer<typeof SummonSchema>
export type AbilityScores = z.infer<typeof AbilityScoresSchema>

const CharacterClassSchema = z.object({
  classSlug: z.string(),
  subclassSlug: z.string().optional(),
  level: z.number().int().min(1).max(20),
  hitDieRolls: z.array(z.number().int()),
})
export type CharacterClass = z.infer<typeof CharacterClassSchema>

const EquipmentItemSchema = z.object({
  itemSlug: z.string(),
  name: z.string(),
  quantity: z.number().int().min(0),
  equipped: z.boolean(),
  slot: z.enum(['main', 'off', 'both', 'dual', 'helmet', 'eyes', 'amulet', 'cloak', 'robe', 'belt', 'bracers', 'gloves', 'boots', 'backpack']).optional(),
  attuned: z.boolean(),
  isHomebrew: z.boolean(),
  notes: z.string(),
  charges: z.number().int().min(0).optional(),
  chargesMax: z.number().int().min(1).optional(),
  rechargesOnLongRest: z.boolean().optional(),
})
export type EquipmentItem = z.infer<typeof EquipmentItemSchema>

const CurrencySchema = z.object({
  cp: z.number().int().min(0),
  sp: z.number().int().min(0),
  ep: z.number().int().min(0),
  gp: z.number().int().min(0),
  pp: z.number().int().min(0),
})
export type Currency = z.infer<typeof CurrencySchema>

const SpellEntrySchema = z.object({
  spellSlug: z.string(),
  name: z.string(),
  classSlug: z.string(),
  prepared: z.boolean(),
  isHomebrew: z.boolean(),
  // Feat-grant tracking: set by applyGrantPicks for spells granted with a free cast per LR.
  usesPerLongRest: z.number().optional(),
  freeUseKey: z.string().optional(),
})
export type SpellEntry = z.infer<typeof SpellEntrySchema>

const SpellSlotsSchema = z.record(z.string(), z.object({ max: z.number(), used: z.number() }))

const FeatureChoiceSchema = z.object({
  key: z.string(),
  value: z.union([z.string(), z.array(z.string())]),
})
export type FeatureChoice = z.infer<typeof FeatureChoiceSchema>

export const CharacterSchema = z.object({
  id: z.string().uuid(),
  schemaVersion: z.number().int(),
  name: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),

  raceSlug: z.string(),
  subraceSlug: z.string().optional(),
  backgroundSlug: z.string(),

  classes: z.array(CharacterClassSchema).min(1),
  abilityScores: AbilityScoresSchema,

  skillProficiencies: z.array(z.string()),
  skillExpertise: z.array(z.string()),
  saveProficiencies: z.array(z.string()),
  toolProficiencies: z.array(z.string()),
  languages: z.array(z.string()),
  armorProficiencies: z.array(z.string()),
  weaponProficiencies: z.array(z.string()),

  equipment: z.array(EquipmentItemSchema),
  currency: CurrencySchema,

  spells: z.array(SpellEntrySchema),
  spellSlots: SpellSlotsSchema,
  pactSlots: z.object({ max: z.number(), used: z.number(), level: z.number() }).optional(),
  ritualBook: z.array(z.string()),

  featuresChosen: z.array(FeatureChoiceSchema),

  hp: z.object({
    current: z.number().int(),
    temp: z.number().int().min(0),
    maxOverride: z.number().int().optional(),
  }),

  classResources: z.record(z.string(), z.number()).default({}),
  hitDiceUsed: z.record(z.string(), z.number()).default({}),
  freeSpellUses: z.record(z.string(), z.number()).default({}),
  concentratingOn: z.string().optional(),  // spell slug currently concentrating on

  conditions: z.array(z.string()),
  exhaustionLevel: z.number().int().min(0).max(6),
  deathSaves: z.object({ successes: z.number().int().min(0).max(3), failures: z.number().int().min(0).max(3) }),
  inspiration: z.boolean(),

  personalityTraits: z.string(),
  ideals: z.string(),
  bonds: z.string(),
  flaws: z.string(),
  appearance: z.string(),
  backstory: z.string(),
  notes: z.string(),

  age: z.string(),
  height: z.string(),
  weight: z.string(),
  eyes: z.string(),
  skin: z.string(),
  hair: z.string(),
  alignment: z.string(),

  campaignBoard: z.object({
    activeBoard: z.string().default(''),
    boards: z.array(z.object({
      id: z.string(),
      name: z.string(),
      notes: z.array(z.object({
        id: z.string(),
        x: z.number(),
        y: z.number(),
        w: z.number().default(200),
        h: z.number().default(200),
        title: z.string(),
        content: z.string(),
        color: z.string().default('yellow'),
      })).default([]),
      connections: z.array(z.object({
        id: z.string(),
        from: z.string(),
        to: z.string(),
        label: z.string().optional(),
      })).default([]),
    })).default([]),
  }).default({ activeBoard: '', boards: [] }),

  summons: z.array(SummonSchema).default([]),

  customResources: z.array(z.object({
    key: z.string(),
    name: z.string(),
    max: z.number().int().min(1),
    recharge: z.enum(['short', 'long']),
  })).default([]),
})

export type Character = z.infer<typeof CharacterSchema>
export const SCHEMA_VERSION = 3
