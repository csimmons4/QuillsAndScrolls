import type { CharacterClass } from '../character/model'

// ── Multiclass Spellcasting ────────────────────────────────────────────────

export type CasterType = 'full' | 'half-up' | 'half' | 'third' | 'pact' | 'none'
// half-up: Artificer (rounds up); half: Paladin, Ranger; third: Eldritch Knight, Arcane Trickster

export const CASTER_TYPE: Record<string, CasterType | ((sub?: string) => CasterType)> = {
  artificer: 'half-up',
  bard:      'full',
  cleric:    'full',
  druid:     'full',
  fighter:   (sub?: string) => sub === 'eldritch-knight'  ? 'third' : 'none',
  monk:      'none',
  paladin:   'half',
  ranger:    'half',
  rogue:     (sub?: string) => sub === 'arcane-trickster' ? 'third' : 'none',
  sorcerer:  'full',
  warlock:   'pact',
  wizard:    'full',
}

// PHB p.165 Multiclass Spellcaster table
// index = effective caster level - 1; columns = L1..L9 slots
export const MULTICLASS_SLOT_TABLE: readonly number[][] = [
  [2, 0, 0, 0, 0, 0, 0, 0, 0], // 1
  [3, 0, 0, 0, 0, 0, 0, 0, 0], // 2
  [4, 2, 0, 0, 0, 0, 0, 0, 0], // 3
  [4, 3, 0, 0, 0, 0, 0, 0, 0], // 4
  [4, 3, 2, 0, 0, 0, 0, 0, 0], // 5
  [4, 3, 3, 0, 0, 0, 0, 0, 0], // 6
  [4, 3, 3, 1, 0, 0, 0, 0, 0], // 7
  [4, 3, 3, 2, 0, 0, 0, 0, 0], // 8
  [4, 3, 3, 3, 1, 0, 0, 0, 0], // 9
  [4, 3, 3, 3, 2, 0, 0, 0, 0], // 10
  [4, 3, 3, 3, 2, 1, 0, 0, 0], // 11
  [4, 3, 3, 3, 2, 1, 0, 0, 0], // 12
  [4, 3, 3, 3, 2, 1, 1, 0, 0], // 13
  [4, 3, 3, 3, 2, 1, 1, 0, 0], // 14
  [4, 3, 3, 3, 2, 1, 1, 1, 0], // 15
  [4, 3, 3, 3, 2, 1, 1, 1, 0], // 16
  [4, 3, 3, 3, 2, 1, 1, 1, 1], // 17
  [4, 3, 3, 3, 3, 1, 1, 1, 1], // 18
  [4, 3, 3, 3, 3, 2, 1, 1, 1], // 19
  [4, 3, 3, 3, 3, 2, 2, 1, 1], // 20
]

function resolveCasterType(cc: CharacterClass): CasterType {
  const def = CASTER_TYPE[cc.classSlug]
  if (!def) return 'none'
  return typeof def === 'function' ? def(cc.subclassSlug) : def
}

/** Classes that contribute to the combined spell slot table (not pact, not none). */
export function spellcastingClasses(classes: CharacterClass[]): CharacterClass[] {
  return classes.filter(cc => {
    const t = resolveCasterType(cc)
    return t !== 'none' && t !== 'pact'
  })
}

/** True when the PHB multiclass spellcaster table should be used (2+ non-pact casters). */
export function isMulticlassSpellcaster(classes: CharacterClass[]): boolean {
  return spellcastingClasses(classes).length >= 2
}

/** Sum effective caster levels for the multiclass slot table. */
export function effectiveCasterLevel(classes: CharacterClass[]): number {
  let total = 0
  for (const cc of classes) {
    switch (resolveCasterType(cc)) {
      case 'full':    total += cc.level; break
      case 'half-up': total += Math.ceil(cc.level / 2); break
      case 'half':    total += Math.floor(cc.level / 2); break
      case 'third':   total += Math.floor(cc.level / 3); break
    }
  }
  return total
}

/**
 * Compute max spell slots from the PHB multiclass table.
 * Returns spell level → max count. Only use when isMulticlassSpellcaster() is true.
 */
export function multiclassSpellSlotsMax(classes: CharacterClass[]): Record<string, number> {
  const level = Math.min(20, effectiveCasterLevel(classes))
  if (level === 0) return {}
  const row = MULTICLASS_SLOT_TABLE[level - 1]
  const slots: Record<string, number> = {}
  row.forEach((count, i) => { if (count > 0) slots[String(i + 1)] = count })
  return slots
}

// ── Weapons & Classes ──────────────────────────────────────────────────────

export interface FightingStyle {
  slug: string
  name: string
  description: string
}

/** A spell a subclass grants as "always prepared" (domain/oath/circle/patron
 *  spells). `level` is the spell's level; `grantedAtLevel` is the class level at
 *  which it becomes available. These don't count against prepared/known limits. */
export interface SubclassGrantedSpell {
  slug: string
  name: string
  level: number
  grantedAtLevel: number
}

export interface SubclassDef {
  slug: string
  name: string
  description: string
  level: number
  features?: { level: number; name: string; description: string }[]
  grantedSpells?: SubclassGrantedSpell[]
  /** Fixed proficiencies a subclass grants (skills as camelCase SKILLS slugs,
   *  tools as display names). Auto-applied when the subclass is chosen.
   *  `languages` is a count of free language choices, surfaced as a note. */
  grantedProficiencies?: { skills?: string[]; tools?: string[]; languages?: number }
}

/** Compact builder for subclass granted spells: `gs(classLevel, spellLevel, name)`.
 *  Slug is derived from the name to match the scraped spell data (kebab-case,
 *  apostrophes dropped, non-alphanumerics collapsed to hyphens). */
function gs(grantedAtLevel: number, level: number, name: string): SubclassGrantedSpell {
  const slug = name.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return { slug, name, level, grantedAtLevel }
}

export interface ClassFeatureDef {
  level: number
  name: string
  description: string
}

export interface ClassOptionsDef {
  // Spellcasting
  cantripsKnown?: number
  spellsKnownAtL1?: number
  preparedCaster?: boolean
  pactMagic?: boolean
  fightingStyles?: FightingStyle[]
  expertiseAt?: number[]
  expertiseCount?: number
  subclasses: SubclassDef[]
  features: ClassFeatureDef[]
  cantripsAtLevel?: number[]      // levels beyond L1 where a new cantrip is gained
  spellsKnownTable?: number[]     // total spells known at each level (index=level-1); omit for prepared casters
  invocationsAtLevel?: number[]       // warlock only: total invocations known at each level
  metamagicAtLevel?: number[]         // sorcerer only: total metamagic options at each level
  infusionsKnownAtLevel?: number[]    // artificer only: total infusions known at each level
  infusionsActiveAtLevel?: number[]   // artificer only: max active infused items at each level

  isSpellbookCaster?: boolean  // true for Wizard: spells persist unprepared in the spellbook

  // Class summary metadata (shown on character sheet)
  hitDie: number
  primaryAbility: string
  savingThrows: [string, string]
  armorTraining: string
  weaponTraining: string
  toolProficiency?: string
  skillChoices: string[]
  numSkillChoices: number
}

// ── Fighting Styles ────────────────────────────────────────────────────────

const FIGHTER_STYLES: FightingStyle[] = [
  { slug: 'archery', name: 'Archery', description: '+2 to attack rolls with ranged weapons.' },
  { slug: 'defense', name: 'Defense', description: '+1 to AC while wearing armor.' },
  { slug: 'dueling', name: 'Dueling', description: '+2 to damage rolls when wielding a melee weapon in one hand with no other weapons.' },
  { slug: 'great-weapon', name: 'Great Weapon Fighting', description: 'Reroll 1s and 2s on damage dice for two-handed or versatile weapons.' },
  { slug: 'protection', name: 'Protection', description: 'Use reaction to impose disadvantage on an attack against an ally within 5ft (requires shield).' },
  { slug: 'two-weapon', name: 'Two-Weapon Fighting', description: 'Add ability modifier to the damage of your off-hand attack.' },
  { slug: 'blind-fighting', name: 'Blind Fighting', description: 'Blindsight 10ft — can see invisible creatures within range.' },
  { slug: 'interception', name: 'Interception', description: 'Use reaction to reduce damage to a creature within 5ft by 1d10 + proficiency bonus.' },
  { slug: 'superior-technique', name: 'Superior Technique', description: 'Learn one Battle Master maneuver and gain one superiority die (d6).' },
  { slug: 'thrown-weapon', name: 'Thrown Weapon Fighting', description: '+2 to damage with thrown weapons; draw thrown weapons as part of the attack.' },
  { slug: 'unarmed-fighting', name: 'Unarmed Fighting', description: 'Unarmed strikes deal 1d6 (1d8 with free hand); grappled creature takes 1d4 bludgeoning at start of its turn.' },
]

const PALADIN_STYLES: FightingStyle[] = [
  { slug: 'defense', name: 'Defense', description: '+1 to AC while wearing armor.' },
  { slug: 'dueling', name: 'Dueling', description: '+2 to damage rolls when wielding a melee weapon in one hand.' },
  { slug: 'great-weapon', name: 'Great Weapon Fighting', description: 'Reroll 1s and 2s on damage dice for two-handed or versatile weapons.' },
  { slug: 'protection', name: 'Protection', description: 'Use reaction to impose disadvantage on an attack against an ally within 5ft (requires shield).' },
  { slug: 'blind-fighting', name: 'Blind Fighting', description: 'Blindsight 10ft.' },
  { slug: 'interception', name: 'Interception', description: 'Use reaction to reduce damage to a creature within 5ft by 1d10 + proficiency bonus.' },
]

const RANGER_STYLES: FightingStyle[] = [
  { slug: 'archery', name: 'Archery', description: '+2 to attack rolls with ranged weapons.' },
  { slug: 'defense', name: 'Defense', description: '+1 to AC while wearing armor.' },
  { slug: 'dueling', name: 'Dueling', description: '+2 to damage rolls when wielding a melee weapon in one hand.' },
  { slug: 'two-weapon', name: 'Two-Weapon Fighting', description: 'Add ability modifier to the damage of your off-hand attack.' },
  { slug: 'blind-fighting', name: 'Blind Fighting', description: 'Blindsight 10ft.' },
  { slug: 'druidic-warrior', name: 'Druidic Warrior', description: 'Learn two Druid cantrips. WIS is your spellcasting modifier for them.' },
  { slug: 'thrown-weapon', name: 'Thrown Weapon Fighting', description: '+2 to damage with thrown weapons.' },
]

// ── Class Definitions ──────────────────────────────────────────────────────

export const CLASS_OPTIONS: Record<string, ClassOptionsDef> = {

  artificer: {
    hitDie: 8,
    primaryAbility: 'Intelligence',
    savingThrows: ['Constitution', 'Intelligence'],
    armorTraining: 'Light & medium armor, shields',
    weaponTraining: 'Simple weapons; hand crossbows, heavy crossbows',
    toolProficiency: "Thieves' tools, tinker's tools, one artisan's tool of choice",
    skillChoices: ['Arcana', 'History', 'Investigation', 'Medicine', 'Nature', 'Perception', 'Sleight of Hand'],
    numSkillChoices: 2,
    cantripsKnown: 2,
    cantripsAtLevel: [10, 14],
    preparedCaster: true,
    // index = level-1; values = total infusions known / max active
    infusionsKnownAtLevel:  [0,4,4,4,4,6,6,6,6,8,8,8,8,10,10,10,10,12,12,12],
    infusionsActiveAtLevel: [0,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,6,6,6],
    subclasses: [
      { slug: 'alchemist', name: 'Alchemist', level: 3, description: 'Brew experimental elixirs that grant random benefits, and fling vials of corrosive or restorative fluid.', features: [
        { level: 3, name: 'Alchemist Spells', description: 'You always have Healing Word, Ray of Sickness, Flaming Sphere, Melf\'s Acid Arrow, Gaseous Form, Mass Healing Word, Blight, Death Ward, Cloudkill, and Raise Dead prepared (gaining each pair at levels 3, 5, 9, 13, 17).' },
        { level: 3, name: 'Experimental Elixir', description: 'When you finish a long rest, you magically produce a number of experimental elixirs equal to your INT modifier (min 1). Roll on the Experimental Elixir table for each: Healing (2d4+2), Swiftness (+10ft speed), Resilience (+1 AC), Boldness (Bless for 1 min), Flight (10ft fly 10 min), or Transformation (Alter Self 10 min). Extras require an action and a spell slot.' },
        { level: 9, name: 'Restorative Reagents', description: 'Your elixirs cure one disease or poison when consumed. Additionally, casting Lesser Restoration costs no spell slot for you.' },
        { level: 15, name: 'Chemical Mastery', description: 'You gain resistance to acid and poison damage and immunity to the poisoned condition. You can cast Greater Restoration and Heal each once per long rest without a spell slot.' },
      ] },
      { slug: 'armorer', name: 'Armorer', level: 3, description: 'Infuse your armor for Guardian mode (thunder gauntlets, defensive field) or Infiltrator mode (lightning launcher, dampening field).', features: [
        { level: 3, name: 'Arcane Armor', description: 'You can use a suit of armor as a spellcasting focus and ignore the STR requirement. It can\'t be removed against your will, replaces missing limbs, and can be donned/doffed as an action. Choose Guardian (thunder gauntlets: d8 bludgeoning + target can only attack you; defensive field: temp HP = INT mod bonus action) or Infiltrator (lightning launcher: d6 lightning 90ft ranged; dampening field: advantage on Stealth) mode.' },
        { level: 9, name: 'Armor Modifications', description: 'You can infuse your armor with up to 4 infusions, splitting them between the armor, boots, gauntlets, and helmet components as separate items.' },
        { level: 15, name: 'Perfected Armor', description: 'Guardian: when a creature you can see hits a target within 30ft, you can use a reaction to magically teleport to an unoccupied space within 5ft of the target and cause the attack to hit you instead. Infiltrator: when you hit with the lightning launcher, you can deal an extra 1d6 lightning damage; the target is also illuminated in dim light until your next turn, making attacks against it have advantage.' },
      ] },
      { slug: 'artillerist', name: 'Artillerist', level: 3, description: 'Create an Eldritch Cannon that blasts enemies (force), heals allies, or protects with a firewall.', features: [
        { level: 3, name: 'Eldritch Cannon', description: 'As an action, use your tinker\'s tools to create a Small or Tiny Eldritch Cannon in an unoccupied space within 5ft. It lasts 1 hour, until reduced to 0 HP, or you dismiss it (no action). You can have one cannon at a time (two at level 15). Choose one type: Flamethrower (15ft cone, 2d8 fire, DEX save DC = spell save DC for half), Force Ballista (ranged spell attack, 2d8 force, pushes 5ft), or Protector (aura grants THP = 1d8 + INT mod to you and allies within 10ft). Uses per long rest = INT mod (min 1); extra uses cost a spell slot.' },
        { level: 5, name: 'Arcane Firearm', description: 'After a long rest, you can use your tinker\'s tools to imbue a wand, staff, or rod and make it your arcane firearm. When you use it as your spellcasting focus for an Artificer spell, you can add 1d8 to one of the spell\'s damage rolls.' },
        { level: 9, name: 'Explosive Cannon', description: 'Your Eldritch Cannon deals an extra 1d8 damage on a hit (Force Ballista) or in its area (Flamethrower). As an action you can detonate the cannon: each creature within 20ft must make a DEX save or take 3d8 force damage (half on success). After detonating, the cannon is destroyed.' },
        { level: 15, name: 'Fortified Position', description: 'You can now have two Eldritch Cannons active at once, and you can create them with a bonus action instead of an action. While within 10ft of a cannon, you and your allies have half cover (+2 AC and DEX saves).' },
      ] },
      { slug: 'battle-smith', name: 'Battle Smith', level: 3, description: 'Forge a Steel Defender construct companion and use INT for weapon attacks with your magic items.', features: [
        { level: 3, name: 'Battle Ready', description: 'You gain proficiency with martial weapons. When you attack with a magic weapon, you can use INT instead of STR or DEX for the attack and damage rolls.' },
        { level: 3, name: 'Steel Defender', description: 'You create a Steel Defender construct (Medium, AC 15, HP = 2 + INT mod + 5× artificer level). It acts on your initiative, obeys your commands, and can use its reaction to impose disadvantage on an attack against a nearby creature. It lacks the ability to make opportunity attacks. Regains HP on short/long rest; rebuilt after long rest if destroyed.' },
        { level: 5, name: 'Arcane Jolt', description: 'When your Steel Defender or a magic weapon you\'re holding hits a creature, you can channel a jolt of magic: deal an extra 2d6 force damage OR restore 2d6 HP to one creature within 30ft of the target. You can use this feature a number of times equal to your INT modifier (min 1) per long rest.' },
        { level: 9, name: 'Arcane Jolt (Improved)', description: 'Your Arcane Jolt damage and healing increase to 4d6.' },
        { level: 15, name: 'Improved Defender', description: 'Your Arcane Jolt damage/healing increases to 6d6. Your Steel Defender gains a +2 bonus to AC and gains the Deflect Attack reaction: when a creature it can see hits a target within 5ft, it can reduce the damage by 1d4 + its proficiency bonus.' },
      ] },
    ],
    features: [
      { level: 1, name: 'Magical Tinkering', description: 'Infuse a tiny object with one minor magical effect: shed light, emit a recorded message, emit a faint odor, or create a static visual. PB objects active at once.' },
      { level: 1, name: 'Spellcasting (INT)', description: 'Prepare spells from the Artificer list equal to INT mod + half Artificer level (min 1). Cast using INT.' },
      { level: 2, name: 'Infuse Item', description: 'Infuse mundane items with magic. 4 infusions known at L2 (more as you level), 2 active at once. Options: Enhanced Weapon, Enhanced Defense, Enhanced Arcane Focus, Returning Weapon, Repeating Shot, Bag of Holding, etc.' },
      { level: 3, name: 'Artificer Specialist', description: 'Choose your Artificer subclass (Alchemist, Armorer, Artillerist, or Battle Smith).' },
      { level: 3, name: 'The Right Tool for the Job', description: 'Spend 1 hour and 10gp in materials to create any artisan\'s tool from nothing. It vanishes if you use this feature again.' },
      { level: 4, name: 'Ability Score Improvement', description: '+2 to one ability score or +1 to two (max 20), or choose a feat.' },
      { level: 6, name: 'Tool Expertise', description: 'Double your proficiency bonus on any ability check using a tool you are proficient with.' },
      { level: 7, name: 'Flash of Genius', description: 'Reaction: when you or a creature within 30ft makes an ability check or saving throw, add your INT modifier to the roll. INT mod uses per long rest.' },
      { level: 8, name: 'Ability Score Improvement', description: '+2 to one ability score or +1 to two (max 20), or choose a feat.' },
      { level: 10, name: 'Magic Item Adept', description: 'Attune to up to 4 magic items. You can craft magic items of Common or Uncommon rarity in half the time for half the cost. Ignore class/race requirements on items you crafted.' },
      { level: 11, name: 'Spell-Storing Item', description: 'Store a 1st or 2nd level Artificer spell in an item after a long rest. Any creature holding it can cast that spell (no concentration) a number of times equal to twice your INT mod. Recharges on long rest.' },
      { level: 12, name: 'Ability Score Improvement', description: '+2 to one ability score or +1 to two (max 20), or choose a feat.' },
      { level: 14, name: 'Magic Item Savant', description: 'Attune to up to 5 magic items. Ignore all class, race, spell, and level requirements on magic items.' },
      { level: 16, name: 'Ability Score Improvement', description: '+2 to one ability score or +1 to two (max 20), or choose a feat.' },
      { level: 18, name: 'Magic Item Master', description: 'Attune to up to 6 magic items.' },
      { level: 19, name: 'Ability Score Improvement', description: '+2 to one ability score or +1 to two (max 20), or choose a feat.' },
      { level: 20, name: 'Soul of Artifice', description: '+1 bonus to all saving throws per magic item you are currently attuned to (max +6). If you are reduced to 0 HP, you can use a reaction to end one of your infusions and drop to 1 HP instead.' },
    ],
  },

  barbarian: {
    hitDie: 12,
    primaryAbility: 'Strength',
    savingThrows: ['Strength', 'Constitution'],
    armorTraining: 'Light & medium armor, shields',
    weaponTraining: 'Simple and martial weapons',
    skillChoices: ['Animal Handling', 'Athletics', 'Intimidation', 'Nature', 'Perception', 'Survival'],
    numSkillChoices: 2,
    subclasses: [
      { slug: 'berserker', name: 'Path of the Berserker', level: 3, description: 'Frenzy: extra bonus action attack each turn of rage (gain exhaustion). Mindless Rage: immune to charmed/frightened while raging.', features: [
        { level: 3, name: 'Frenzy', description: 'While raging, you can enter a frenzy. For the duration of your rage you can make one melee weapon attack as a bonus action each turn. When your rage ends, you gain one level of exhaustion.' },
        { level: 6, name: 'Mindless Rage', description: 'You can\'t be charmed or frightened while raging. If you are charmed or frightened when you enter your rage, the effect is suspended for the duration of the rage.' },
        { level: 10, name: 'Intimidating Presence', description: 'As an action, frighten one creature you can see within 30ft (WIS save DC 8 + PB + CHA or frightened 1 min; save again each turn to end). After a success, immune to this feature for 24 hours.' },
        { level: 14, name: 'Retaliation', description: 'When you take damage from a creature within 5ft, you can use your reaction to make one melee weapon attack against that creature.' },
      ] },
      { slug: 'totem-warrior', name: 'Path of the Totem Warrior', level: 3, description: 'Bond with an animal spirit: Bear (resistance to all damage), Eagle (no OA, fly speed briefly), Wolf (allies have advantage on attacks vs targets near you).', features: [
        { level: 3, name: 'Spirit Seeker', description: 'You can cast Beast Sense and Speak with Animals as rituals.' },
        { level: 3, name: 'Totem Spirit', description: 'Choose Bear (resistance to all damage except psychic while raging), Eagle (Disengage and Dash as bonus actions while raging; limited fly speed), or Wolf (while raging, allies have advantage on melee attacks vs creatures within 5ft of you).' },
        { level: 6, name: 'Aspect of the Beast', description: 'Choose Bear (carrying capacity doubled, advantage on STR for pushing/dragging), Eagle (see 1 mile clearly, dim light is no penalty), Wolf (track at fast pace; Stealth at normal pace).' },
        { level: 10, name: 'Spirit Walker', description: 'Cast Commune with Nature as a ritual, calling on your totem spirits.' },
        { level: 14, name: 'Totemic Attunement', description: 'Choose Bear (while raging, creatures within 5ft have disadvantage on attacks vs targets other than you), Eagle (while raging, reaction to make one melee attack vs a creature that misses you), or Wolf (while raging, bonus action to knock a prone target on a hit).' },
      ] },
      { slug: 'ancestral-guardian', name: 'Path of the Ancestral Guardian', level: 3, description: 'Ancestral Protectors: first creature you hit while raging has disadvantage on attacks vs targets other than you.', features: [
        { level: 3, name: 'Ancestral Protectors', description: 'While raging, the first creature you hit on each turn is beset by spectral warriors. That creature has disadvantage on attack rolls against targets other than you, and other creatures have resistance to the damage it deals (until start of your next turn).' },
        { level: 6, name: 'Spirit Shield', description: 'When a creature you can see within 30ft takes damage, you can use your reaction to reduce that damage by 2d6 (increases to 3d6 at L10, 4d6 at L14). Requires concentration equivalent (you must not be incapacitated).' },
        { level: 10, name: 'Consult the Spirits', description: 'Cast Clairvoyance once per short rest without a spell slot. You consult ancestral spirits rather than a sensor; casting ability is WIS.' },
        { level: 14, name: 'Vengeful Ancestors', description: 'When Spirit Shield reduces damage to a creature, the attacker takes the same amount of force damage.' },
      ] },
      { slug: 'storm-herald', name: 'Path of the Storm Herald', level: 3, description: 'Aura of elemental fury while raging: Desert (fire damage to nearby enemies), Sea (lightning vs one creature), Tundra (temp HP to allies).', features: [
        { level: 3, name: 'Storm Aura', description: 'While raging, an elemental aura pulses from you. Choose Desert (5ft radius, 1d6 fire to enemies at start of each turn), Sea (1 enemy within 10ft, STR save or 1d6 lightning + 1d6 thunder), or Tundra (allies within 10ft gain 2 temp HP each turn, scaling with level). You can activate the aura as a bonus action on your turns.' },
        { level: 6, name: 'Storm Soul', description: 'Desert: fire resistance + can ignite unattended flammables. Sea: lightning resistance + can breathe water + 30ft swim speed. Tundra: cold resistance + water around you doesn\'t freeze.' },
        { level: 10, name: 'Shielding Storm', description: 'You can use your aura to protect allies. Each creature of your choice in your aura gains resistance to the damage type associated with your environment (fire, lightning, or cold).' },
        { level: 14, name: 'Raging Storm', description: 'Desert: when hit by a melee attack, reaction to deal 2d6 fire to the attacker (DEX save, DC 8+PB+CON, half on success). Sea: once per turn after hitting, reaction to knock prone if target fails STR save. Tundra: on a hit, target\'s speed is 0 until start of your next turn.' },
      ] },
      { slug: 'zealot', name: 'Path of the Zealot', level: 3, description: 'Divine Fury: first hit each turn deals extra necrotic or radiant damage (1d6 + half Barb level). Can\'t die while raging (Warrior of the Gods).', features: [
        { level: 3, name: 'Divine Fury', description: 'While raging, on your first hit each turn, deal an extra 1d6 + half your Barbarian level (round down) necrotic or radiant damage (your choice when you take this path).' },
        { level: 3, name: 'Warrior of the Gods', description: 'Your soul is marked for endless battle. Spells that would return you to life don\'t need material components. When you die while raging, you drop to 0 HP and become stable instead of dying — once per rage.' },
        { level: 6, name: 'Fanatical Focus', description: 'If you fail a saving throw while raging, you can reroll it with a bonus equal to your rage damage bonus. You must use the new roll, and you can\'t use this feature again until you start raging again.' },
        { level: 10, name: 'Zealous Presence', description: 'As a bonus action, unleash a battle cry. Up to 10 creatures of your choice within 60ft that can hear you gain advantage on attack rolls and saving throws until the start of your next turn. Once used, you must finish a long rest to use it again.' },
        { level: 14, name: 'Rage Beyond Death', description: 'While raging, having 0 HP doesn\'t knock you unconscious. You suffer the effects of death saving throw failures normally, but you can still take actions. You die when your rage ends if you have 0 HP.' },
      ] },
      { slug: 'beast', name: 'Path of the Beast', level: 3, description: 'Form of the Beast: grow claws (2 attacks, 1d6 slashing), bite (1d8 piercing + temp HP), or tail (1d8 piercing + reaction trip).', features: [
        { level: 3, name: 'Form of the Beast', description: 'While raging, you sprout natural weapons. Choose Bite (1d8 piercing; on a hit regain HP equal to your PB if below half HP), Claws (attack twice; 1d6 slashing + DEX/STR; second claw attack as bonus action), or Tail (1d8 piercing; reaction to add +1d8 to your AC when hit, once per turn).' },
        { level: 3, name: 'Bestial Soul', description: 'While raging, your natural weapons count as magical. You also gain one of: swim 40ft + breathe water; climb 40ft + wall-walking; or jump distance tripled and you can jump during movement without a running start.' },
        { level: 6, name: 'Infectious Fury', description: 'When you hit with your natural weapons while raging, you can force the creature (CON save DC 8+PB+CON mod) to either deal its next attack to a creature of your choice within 5ft or take 2d12 psychic damage. PB uses per long rest.' },
        { level: 10, name: 'Call the Hunt', description: 'Bonus action: choose up to PB willing creatures you can see within 30ft. Until your rage ends, each creature gains a d6 they can add to one damage roll per turn while within 5ft of an enemy. You gain 5 temporary HP per creature that accepts. PB uses per long rest.' },
        { level: 14, name: 'Bestial Soul (Improved)', description: 'Your Form of the Beast claws deal 1d8 damage and your bite can grant a d6 bonus to an ability check or attack roll as a reaction (once per turn).' },
      ] },
      { slug: 'wild-magic', name: 'Path of Wild Magic', level: 3, description: 'Magic Awareness: sense spells within 60ft. Wild Surge: random magical effect on entering rage (teleport, levitate, push, etc.).', features: [
        { level: 3, name: 'Magic Awareness', description: 'As an action, you can open your awareness to the presence of concentrated magic until the end of your next turn. You know the location of any spell or magic item within 60ft that isn\'t behind total cover. Once used, you must finish a short or long rest to use it again.' },
        { level: 3, name: 'Wild Surge', description: 'When you enter rage, roll on the Wild Magic table (d8): 1 = magic missiles from you (1d6+1 force, 1 each at 2+ nearby creatures); 2 = ethereal teleport 30ft; 3 = protective shield (3d6+3 temp HP); 4 = levitate + restrained; 5 = spectral shield; 6 = you become invisible; 7 = plant growth zone 10ft radius; 8 = healing 1d8.' },
        { level: 6, name: 'Bolstering Magic', description: 'Action: touch a creature (including yourself) and choose one: grant advantage on attack rolls and ability checks for 10 min, OR allow them to roll 1d3 and regain that many expended spell slots (3rd level or lower). PB uses per long rest.' },
        { level: 10, name: 'Unstable Backlash', description: 'Reaction: when you take damage or fail a saving throw while raging, cause another Wild Surge — roll on the Wild Magic table immediately.' },
        { level: 14, name: 'Controlled Surge', description: 'Whenever you roll on the Wild Magic table, you can roll twice and choose which effect to use. If both rolls are the same, ignore the table and choose any effect.' },
      ] },
    ],
    features: [
      { level: 1, name: 'Rage', description: 'Bonus action: rage for 1 min. +2 STR damage, resistance to B/P/S damage. 2 uses/LR. Rage bonus: +2 (L1), +3 (L9), +4 (L16). Uses: 2 (L1), 3 (L3), 4 (L6), 5 (L12), 6 (L17), unlimited (L20).' },
      { level: 1, name: 'Unarmored Defense', description: 'AC = 10 + DEX mod + CON mod when not wearing armor.' },
      { level: 2, name: 'Reckless Attack', description: 'Attack with advantage on your first attack each turn. Enemies have advantage on attacks against you until your next turn.' },
      { level: 2, name: 'Danger Sense', description: 'Advantage on DEX saving throws against effects you can see (traps, spells, environmental hazards). Doesn\'t work blinded/deafened/incapacitated.' },
      { level: 3, name: 'Primal Path', description: 'Choose your Barbarian subclass.' },
      { level: 4, name: 'Ability Score Improvement', description: '+2 to one ability score or +1 to two (max 20), or choose a feat.' },
      { level: 5, name: 'Extra Attack', description: 'Attack twice per Attack action.' },
      { level: 5, name: 'Fast Movement', description: '+10ft movement speed while not wearing heavy armor.' },
      { level: 6, name: 'Subclass Feature', description: 'Your Primal Path grants an additional feature.' },
      { level: 7, name: 'Feral Instinct', description: 'Advantage on initiative rolls. If surprised, you can act on your first turn as long as you enter rage before taking any actions.' },
      { level: 8, name: 'Ability Score Improvement', description: '+2 to one ability score or +1 to two (max 20), or choose a feat.' },
      { level: 9, name: 'Brutal Critical', description: 'Roll one extra weapon damage die on a critical hit with a melee attack (+2 dice at L13, +3 at L17).' },
      { level: 10, name: 'Subclass Feature', description: 'Your Primal Path grants an additional feature.' },
      { level: 11, name: 'Relentless Rage', description: 'If you drop to 0 HP while raging, make a DC 10 CON save (DC +5 per subsequent use before a full rest) to drop to 1 HP instead.' },
      { level: 12, name: 'Ability Score Improvement', description: '+2 to one ability score or +1 to two (max 20), or choose a feat.' },
      { level: 14, name: 'Subclass Feature', description: 'Your Primal Path grants an additional feature.' },
      { level: 15, name: 'Persistent Rage', description: 'Your rage only ends early if you fall unconscious or choose to end it — no longer requires attacking or taking damage each turn.' },
      { level: 16, name: 'Ability Score Improvement', description: '+2 to one ability score or +1 to two (max 20), or choose a feat.' },
      { level: 17, name: 'Brutal Critical', description: 'Now roll 3 extra damage dice on critical hits.' },
      { level: 18, name: 'Indomitable Might', description: 'If your total for a STR check is less than your STR score, use your STR score instead.' },
      { level: 19, name: 'Ability Score Improvement', description: '+2 to one ability score or +1 to two (max 20), or choose a feat.' },
      { level: 20, name: 'Primal Champion', description: '+4 STR and +4 CON (may exceed 20). Rages are now unlimited.' },
    ],
  },

  bard: {
    hitDie: 8,
    primaryAbility: 'Charisma',
    savingThrows: ['Dexterity', 'Charisma'],
    armorTraining: 'Light armor',
    weaponTraining: 'Simple weapons; hand crossbows, longswords, rapiers, shortswords',
    skillChoices: ['Acrobatics', 'Animal Handling', 'Arcana', 'Athletics', 'Deception', 'History', 'Insight', 'Intimidation', 'Investigation', 'Medicine', 'Nature', 'Perception', 'Performance', 'Persuasion', 'Religion', 'Sleight of Hand', 'Stealth', 'Survival'],
    numSkillChoices: 3,
    cantripsKnown: 2,
    cantripsAtLevel: [10],
    spellsKnownAtL1: 4,
    spellsKnownTable: [4,5,6,7,8,9,10,11,12,14,15,15,16,18,19,19,20,22,22,22],
    expertiseAt: [1, 3],
    expertiseCount: 2,
    subclasses: [
      { slug: 'lore', name: 'College of Lore', level: 3, description: 'Cutting Words (reaction: subtract Bardic Inspiration die from enemy\'s roll). 3 bonus skill proficiencies. Magical Secrets at L6.', features: [
        { level: 3, name: 'Bonus Proficiencies', description: 'Gain proficiency in three skills of your choice.' },
        { level: 3, name: 'Cutting Words', description: 'Reaction: when a creature you can see within 60ft makes an attack roll, ability check, or damage roll, expend a Bardic Inspiration die to subtract the result from the roll. Must use before knowing if the roll succeeds.' },
        { level: 6, name: 'Additional Magical Secrets', description: 'Learn 2 spells from any class list (counts as Bard spells). This is in addition to the normal Magical Secrets at L10.' },
        { level: 14, name: 'Peerless Skill', description: 'When you make an ability check, you can expend one Bardic Inspiration die and add it to the roll. Roll before knowing if you succeed.' },
      ] },
      { slug: 'valor', name: 'College of Valor', level: 3, description: 'Combat Inspiration (inspire allies\' weapon damage or AC). Martial weapon & shield proficiency. Extra Attack at L6.', features: [
        { level: 3, name: 'Bonus Proficiencies', description: 'Gain proficiency with medium armor, shields, and martial weapons.' },
        { level: 3, name: 'Combat Inspiration', description: 'A creature that has a Bardic Inspiration die from you can roll it and add the result to a weapon damage roll or to its AC against one attack (as a reaction).' },
        { level: 6, name: 'Extra Attack', description: 'Attack twice per Attack action.' },
        { level: 14, name: 'Battle Magic', description: 'When you use your action to cast a Bard spell, you can make one weapon attack as a bonus action.' },
      ] },
      { slug: 'glamour', name: 'College of Glamour', level: 3, description: 'Mantle of Inspiration: spend Bardic Inspiration to grant temp HP + free movement to multiple allies.', features: [
        { level: 3, name: 'Mantle of Inspiration', description: 'As a bonus action, expend one Bardic Inspiration die. Choose a number of creatures you can see within 60ft up to your CHA modifier. Each regains temp HP equal to your die roll. Each can also immediately move up to their speed without provoking opportunity attacks.' },
        { level: 3, name: 'Enthralling Performance', description: 'Spend 1 minute performing. Choose up to CHA modifier humanoids within 60ft. Each must succeed on a WIS save (DC 8+PB+CHA) or be charmed by you for 1 hour. While charmed, it regards you as a wondrous spectacle. 1 use per short rest.' },
        { level: 6, name: 'Mantle of Majesty', description: 'Bonus action: cast Command (no slot) for 1 min, maintaining a glamorous aura. Each turn as a bonus action, cast Command again without a slot. Creatures that are already charmed by you automatically fail the Command save. 1 use per long rest.' },
        { level: 14, name: 'Unbreakable Majesty', description: 'Assume a magically majestic presence for 1 min (1/LR). For the duration, when any creature tries to attack you, it must succeed on a CHA save (DC 8+PB+CHA) or the attack fails and it chooses a new target. On a success, the creature is immune to this effect for 24 hours.' },
      ] },
      { slug: 'swords', name: 'College of Swords', level: 3, description: 'Blade Flourishes: spend Bardic Inspiration to deal extra damage + push, defend, or distract. Fighting Style.', features: [
        { level: 3, name: 'Bonus Proficiencies', description: 'Gain proficiency with medium armor and scimitars.' },
        { level: 3, name: 'Fighting Style', description: 'Choose Dueling or Two-Weapon Fighting.' },
        { level: 3, name: 'Blade Flourish', description: 'When you take the Attack action, your walking speed increases by 10ft this turn. When you hit with a weapon attack, you can expend one Bardic Inspiration die: Defensive Flourish (+die to AC until next turn, +die to damage), Slashing Flourish (die extra damage to original target and one creature within 5ft), or Mobile Flourish (+die to damage, push target 5ft + die feet, then move up to speed toward target without OA).' },
        { level: 6, name: 'Extra Attack', description: 'Attack twice per Attack action.' },
        { level: 14, name: 'Master\'s Flourish', description: 'When you use a Blade Flourish option, roll a d6 instead of expending a Bardic Inspiration die.' },
      ] },
      { slug: 'whispers', name: 'College of Whispers', level: 3, description: 'Psychic Blades: spend Bardic Inspiration to deal extra psychic damage on a hit. Words of Terror. Shadow Lore.', features: [
        { level: 3, name: 'Psychic Blades', description: 'When you hit a creature with a weapon attack, you can expend one use of Bardic Inspiration to deal extra psychic damage. Roll the die and deal that much extra psychic damage. Once you hit, you can\'t use this until the start of your next turn.' },
        { level: 3, name: 'Words of Terror', description: 'Spend 1 minute speaking privately to a humanoid. At the end, it must succeed on a WIS save (DC 8+PB+CHA) or be frightened of you or a creature of your choice for 1 hour (or until it takes damage). Once used, a short or long rest resets it.' },
        { level: 6, name: 'Mantle of Whispers', description: 'Reaction: when a humanoid dies within 30ft, capture their shadow. As an action, transform into that humanoid\'s appearance. While in disguise, you know their surface memories (name, personality, 3 facts). Other creatures can detect the ruse with a CHA (Insight) check vs your CHA (Deception)+PB. Lasts 1 hour or until you end it.' },
        { level: 14, name: 'Shadow Lore', description: 'Action: magically whisper a phrase to a creature within 30ft. The target must succeed on a WIS save (DC 8+PB+CHA) or become charmed for 8 hours (frightened if it succeeds but you still know its secret shame). While charmed, it treats you as a trusted friend and the effect ends if harmed by you or your companions. Once used, long rest to reset.' },
      ] },
      { slug: 'creation', name: 'College of Creation', level: 3, description: 'Mote of Potential: extra effects when using Bardic Inspiration. Performance of Creation: create a Large or smaller object.', features: [
        { level: 3, name: 'Mote of Potential', description: 'When a creature uses your Bardic Inspiration, the mote provides a bonus: ability check (roll the die twice, pick higher), attack roll (trigger a burst — each creature within 5ft of the target takes thunder damage equal to the die), saving throw (the target and you gain temp HP equal to the roll + CHA mod).' },
        { level: 3, name: 'Performance of Creation', description: 'Action: create a Large or smaller nonmagical item in an unoccupied space within 10ft. The item must be an object (no creatures). It lasts for your PB in hours. Value limit = gold pieces equal to 20× your Bard level. Once used, short or long rest to reset. CHA uses = PB times per long rest for extra uses.' },
        { level: 6, name: 'Animating Performance', description: 'Action: target a Large or smaller nonmagical object within 30ft that isn\'t being worn or carried. Animate it (AC 16, HP = 10× Bard level, STR 18, DEX 14). You can command it as a bonus action. It lasts 1 hour or until destroyed. Once used, long rest to reset.' },
        { level: 14, name: 'Creative Crescendo', description: 'When you use Performance of Creation, you can create a number of additional objects equal to your CHA modifier (min 1), and the item size limit increases to Huge. Objects created by this feature crumble to dust when the duration ends.' },
      ] },
      { slug: 'eloquence', name: 'College of Eloquence', level: 3, description: 'Silver Tongue: treat 9 or lower as 10 on Persuasion/Deception. Unsettling Words: subtract Bardic Inspiration from a save. Bardic Inspiration can\'t be wasted on a low roll (add it on next attempt if it fails).', features: [
        { level: 3, name: 'Silver Tongue', description: 'You are a master of persuasion. On a Persuasion or Deception check, you can treat a d20 roll of 9 or lower as a 10.' },
        { level: 3, name: 'Unsettling Words', description: 'Bonus action: expend one use of Bardic Inspiration and choose one creature you can see within 60ft. Roll the Bardic Inspiration die; the creature subtracts the number rolled from the next saving throw it makes before the start of your next turn.' },
        { level: 6, name: 'Unfailing Inspiration', description: 'When a creature uses your Bardic Inspiration die and fails the check or attack, they don\'t expend the die.' },
        { level: 6, name: 'Universal Speech', description: 'Action: choose up to PB creatures within 60ft. Until 1 hour passes, the targets can understand your speech as if you were speaking their native language. Once used, long rest to reset.' },
        { level: 14, name: 'Infectious Inspiration', description: 'When a creature uses your Bardic Inspiration die and succeeds, as a reaction you can grant a new Bardic Inspiration die to a different creature within 60ft who can hear you. You can use this reaction a number of times equal to your CHA mod (min 1) per long rest.' },
      ] },
    ],
    features: [
      { level: 1, name: 'Spellcasting (CHA)', description: 'Cast Bard spells using CHA. Know a limited number of spells that can be swapped when you level up.' },
      { level: 1, name: 'Bardic Inspiration', description: 'Bonus action: grant one creature a Bardic Inspiration die to add to one roll within the next 10 minutes. Uses = CHA mod/LR. Die: d6 (L1), d8 (L5), d10 (L10), d12 (L15).' },
      { level: 1, name: 'Expertise', description: 'Double proficiency bonus in 2 chosen skills (or 1 skill + Thieves\' Tools).' },
      { level: 2, name: 'Jack of All Trades', description: 'Add half your proficiency bonus (rounded down) to any ability check you aren\'t proficient in.' },
      { level: 2, name: 'Song of Rest', description: 'During a short rest, allies who hear you regain extra HP when spending Hit Dice: 1d6 (L2), 1d8 (L9), 1d10 (L13), 1d12 (L17).' },
      { level: 3, name: 'Bard College', description: 'Choose your Bard subclass.' },
      { level: 3, name: 'Expertise', description: 'Gain Expertise in 2 more skills.' },
      { level: 4, name: 'Ability Score Improvement', description: '+2 to one ability score or +1 to two (max 20), or choose a feat.' },
      { level: 5, name: 'Font of Inspiration', description: 'Regain all expended Bardic Inspiration uses on a short rest (not just long rest).' },
      { level: 5, name: 'Bardic Inspiration', description: 'Bardic Inspiration die becomes d8.' },
      { level: 6, name: 'Countercharm', description: 'As an action, start a performance. Until end of your next turn, all friendly creatures within 30ft have advantage on saves vs charmed and frightened.' },
      { level: 6, name: 'Subclass Feature', description: 'Your Bard College grants an additional feature.' },
      { level: 8, name: 'Ability Score Improvement', description: '+2 to one ability score or +1 to two (max 20), or choose a feat.' },
      { level: 10, name: 'Magical Secrets', description: 'Learn 2 spells from any class\'s spell list. They count as Bard spells for you. (Repeat at L14 and L18.)' },
      { level: 10, name: 'Bardic Inspiration', description: 'Bardic Inspiration die becomes d10.' },
      { level: 12, name: 'Ability Score Improvement', description: '+2 to one ability score or +1 to two (max 20), or choose a feat.' },
      { level: 14, name: 'Magical Secrets', description: 'Learn 2 more spells from any class list.' },
      { level: 14, name: 'Subclass Feature', description: 'Your Bard College grants an additional feature.' },
      { level: 15, name: 'Bardic Inspiration', description: 'Bardic Inspiration die becomes d12.' },
      { level: 16, name: 'Ability Score Improvement', description: '+2 to one ability score or +1 to two (max 20), or choose a feat.' },
      { level: 18, name: 'Magical Secrets', description: 'Learn 2 more spells from any class list.' },
      { level: 19, name: 'Ability Score Improvement', description: '+2 to one ability score or +1 to two (max 20), or choose a feat.' },
      { level: 20, name: 'Superior Inspiration', description: 'When you roll initiative with no Bardic Inspiration remaining, you regain one use.' },
    ],
  },

  cleric: {
    hitDie: 8,
    primaryAbility: 'Wisdom',
    savingThrows: ['Wisdom', 'Charisma'],
    armorTraining: 'Light & medium armor, shields (heavy armor with some domains)',
    weaponTraining: 'Simple weapons',
    skillChoices: ['History', 'Insight', 'Medicine', 'Persuasion', 'Religion'],
    numSkillChoices: 2,
    cantripsKnown: 3,
    cantripsAtLevel: [4, 10],
    preparedCaster: true,
    subclasses: [
      { slug: 'life', name: 'Life Domain', level: 1, grantedSpells: [
        gs(1,1,'Bless'), gs(1,1,'Cure Wounds'), gs(3,2,'Lesser Restoration'), gs(3,2,'Spiritual Weapon'),
        gs(5,3,'Beacon of Hope'), gs(5,3,'Revivify'), gs(7,4,'Death Ward'), gs(7,4,'Guardian of Faith'),
        gs(9,5,'Mass Cure Wounds'), gs(9,5,'Raise Dead'),
      ], description: 'Heavy armor. Disciple of Life: healing spells restore 2 + spell level extra HP. Preserve Life Channel Divinity: restore HP to multiple creatures. Blessed Healer: regain HP when you heal others.', features: [
        { level: 1, name: 'Bonus Proficiency', description: 'Gain proficiency with heavy armor.' },
        { level: 1, name: 'Disciple of Life', description: 'Whenever you use a spell of 1st level or higher to restore HP to a creature, it regains additional HP equal to 2 + the spell\'s level.' },
        { level: 2, name: 'Preserve Life', description: 'Channel Divinity: as an action, restore HP to any number of creatures within 30ft, dividing up to 5 × Cleric level HP among them. Can\'t restore a creature above half its HP maximum.' },
        { level: 6, name: 'Blessed Healer', description: 'When you cast a healing spell of 1st level or higher that restores HP to another creature, you regain HP equal to 2 + the spell\'s level.' },
        { level: 8, name: 'Divine Strike', description: 'Once per turn when you hit with a weapon attack, deal an extra 1d8 radiant damage (2d8 at L14).' },
        { level: 17, name: 'Supreme Healing', description: 'When you would normally roll one or more dice to restore HP with a spell, instead use the highest number possible for each die.' },
      ] },
      { slug: 'light', name: 'Light Domain', level: 1, grantedSpells: [
        gs(1,1,'Burning Hands'), gs(1,1,'Faerie Fire'), gs(3,2,'Flaming Sphere'), gs(3,2,'Scorching Ray'),
        gs(5,3,'Daylight'), gs(5,3,'Fireball'), gs(7,4,'Guardian of Faith'), gs(7,4,'Wall of Fire'),
        gs(9,5,'Flame Strike'), gs(9,5,'Scrying'),
      ], description: 'Warding Flare: reaction to impose disadvantage on attack vs you or ally. Radiance of the Dawn: Channel Divinity to dispel darkness and deal radiant damage.', features: [
        { level: 1, name: 'Bonus Cantrip', description: 'Gain the Light cantrip if you don\'t already know it.' },
        { level: 1, name: 'Warding Flare', description: 'Reaction: when a creature within 30ft makes an attack roll against you or an ally, impose disadvantage on the roll by flashing divine light. WIS modifier uses per long rest.' },
        { level: 2, name: 'Radiance of the Dawn', description: 'Channel Divinity: as an action, dispel magical darkness within 30ft and deal 2d10 + Cleric level radiant damage to hostile creatures within 30ft (CON save for half, DC = your spell save DC).' },
        { level: 6, name: 'Improved Flare', description: 'Warding Flare can now protect any creature within 30ft that you can see, not just yourself.' },
        { level: 8, name: 'Potent Spellcasting', description: 'Add your WIS modifier to the damage you deal with any Cleric cantrip.' },
        { level: 17, name: 'Corona of Light', description: 'As an action, activate an aura of sunlight (1 min, concentration). 60ft bright light and 30ft additional dim light. Hostile creatures in bright light have disadvantage on saves against fire or radiant spells.' },
      ] },
      { slug: 'trickery', name: 'Trickery Domain', level: 1, grantedSpells: [
        gs(1,1,'Charm Person'), gs(1,1,'Disguise Self'), gs(3,2,'Mirror Image'), gs(3,2,'Pass without Trace'),
        gs(5,3,'Blink'), gs(5,3,'Dispel Magic'), gs(7,4,'Dimension Door'), gs(7,4,'Polymorph'),
        gs(9,5,'Dominate Person'), gs(9,5,'Modify Memory'),
      ], description: 'Blessing of the Trickster: touch ally to give advantage on Stealth. Invoke Duplicity: create an illusion duplicate.', features: [
        { level: 1, name: 'Blessing of the Trickster', description: 'As an action, touch a willing creature (not yourself) to give it advantage on Dexterity (Stealth) checks for 1 hour. 1 use per long rest.' },
        { level: 2, name: 'Invoke Duplicity', description: 'Channel Divinity: as an action, create an illusory duplicate of yourself within 30ft (1 min, concentration). While it persists, you can cast spells from its space and have advantage on attacks against creatures within 5ft of it.' },
        { level: 6, name: 'Cloak of Shadows', description: 'Channel Divinity: as an action, become invisible until end of next turn or until you attack or cast a spell.' },
        { level: 8, name: 'Divine Strike', description: 'Once per turn when you hit with a weapon attack, deal an extra 1d8 poison damage (2d8 at L14).' },
        { level: 17, name: 'Improved Duplicity', description: 'Create up to four duplicates with Invoke Duplicity instead of one. As a bonus action, move any number of them up to 30ft each.' },
      ] },
      { slug: 'knowledge', name: 'Knowledge Domain', level: 1, grantedSpells: [
        gs(1,1,'Command'), gs(1,1,'Identify'), gs(3,2,'Augury'), gs(3,2,'Suggestion'),
        gs(5,3,'Nondetection'), gs(5,3,'Speak with Dead'), gs(7,4,'Arcane Eye'), gs(7,4,'Confusion'),
        gs(9,5,'Legend Lore'), gs(9,5,'Scrying'),
      ], description: 'Know Languages. Blessings of Knowledge: expertise in 2 INT skills. Read Thoughts Channel Divinity.', features: [
        { level: 1, name: 'Blessings of Knowledge', description: 'Learn two languages of your choice. Gain proficiency and expertise (double PB) in two of the following: Arcana, History, Nature, or Religion.' },
        { level: 2, name: 'Knowledge of the Ages', description: 'Channel Divinity: as an action, touch a creature to grant it proficiency in a skill or tool for 10 minutes.' },
        { level: 2, name: 'Read Thoughts', description: 'Channel Divinity: as an action, read a creature\'s surface thoughts within 60ft (WIS save or you read thoughts for 1 min; bonus action to cast Suggestion on them with no save).' },
        { level: 6, name: 'Channel Divinity: Read Thoughts', description: 'While reading a creature\'s thoughts, you can also cast Suggestion on it as a bonus action (no save needed).' },
        { level: 8, name: 'Potent Spellcasting', description: 'Add your WIS modifier to the damage you deal with any Cleric cantrip.' },
        { level: 17, name: 'Visions of the Past', description: 'Spend 1 minute meditating on an object or location to see 10-minute visions of its recent past (up to the last few days). Cast this as a ritual; uses = WIS modifier per short rest.' },
      ] },
      { slug: 'nature', name: 'Nature Domain', level: 1, grantedSpells: [
        gs(1,1,'Animal Friendship'), gs(1,1,'Speak with Animals'), gs(3,2,'Barkskin'), gs(3,2,'Spike Growth'),
        gs(5,3,'Plant Growth'), gs(5,3,'Wind Wall'), gs(7,4,'Dominate Beast'), gs(7,4,'Grasping Vine'),
        gs(9,5,'Insect Plague'), gs(9,5,'Tree Stride'),
      ], description: 'Acolyte of Nature: druid cantrip + 1 skill. Heavy armor. Charm Animals and Plants Channel Divinity.', features: [
        { level: 1, name: 'Acolyte of Nature', description: 'Learn one Druid cantrip and one skill proficiency from Animal Handling, Nature, or Survival.' },
        { level: 1, name: 'Bonus Proficiency', description: 'Gain proficiency with heavy armor.' },
        { level: 2, name: 'Charm Animals and Plants', description: 'Channel Divinity: as an action, charm beasts and plants within 30ft for 1 minute (WIS save negates). Charmed creatures are friendly and won\'t attack you or your allies.' },
        { level: 6, name: 'Dampen Elements', description: 'Reaction: when you or a creature within 30ft takes acid, cold, fire, lightning, or thunder damage, grant resistance to that damage for this instance.' },
        { level: 8, name: 'Divine Strike', description: 'Once per turn when you hit with a weapon attack, deal an extra 1d8 cold, fire, or lightning damage (your choice at L1, 2d8 at L14).' },
        { level: 17, name: 'Master of Nature', description: 'Automatically succeed on the save against Charm Animals and Plants. As a bonus action, verbally command charmed creatures.' },
      ] },
      { slug: 'tempest', name: 'Tempest Domain', level: 1, grantedSpells: [
        gs(1,1,'Fog Cloud'), gs(1,1,'Thunderwave'), gs(3,2,'Gust of Wind'), gs(3,2,'Shatter'),
        gs(5,3,'Call Lightning'), gs(5,3,'Sleet Storm'), gs(7,4,'Control Water'), gs(7,4,'Ice Storm'),
        gs(9,5,'Destructive Wave'), gs(9,5,'Insect Plague'),
      ], description: 'Heavy armor, martial weapons. Wrath of the Storm: reaction lightning/thunder damage when hit. Destructive Wrath: maximize lightning/thunder damage with Channel Divinity.', features: [
        { level: 1, name: 'Bonus Proficiencies', description: 'Gain proficiency with heavy armor and martial weapons.' },
        { level: 1, name: 'Wrath of the Storm', description: 'Reaction: when a creature within 5ft hits you, deal 2d8 lightning or thunder damage to it (DEX save for half, DC = spell save DC). Uses = WIS modifier per long rest.' },
        { level: 2, name: 'Destructive Wrath', description: 'Channel Divinity: when you roll lightning or thunder damage, maximize the damage instead of rolling.' },
        { level: 6, name: 'Thunderous Strike', description: 'When you deal lightning damage to a Large or smaller creature, push it up to 10ft away.' },
        { level: 8, name: 'Divine Strike', description: 'Once per turn when you hit with a weapon attack, deal an extra 1d8 thunder damage (2d8 at L14).' },
        { level: 17, name: 'Stormborn', description: 'Gain a flying speed equal to your current walking speed when not underground or indoors.' },
      ] },
      { slug: 'war', name: 'War Domain', level: 1, grantedSpells: [
        gs(1,1,'Divine Favor'), gs(1,1,'Shield of Faith'), gs(3,2,'Magic Weapon'), gs(3,2,'Spiritual Weapon'),
        gs(5,3,'Crusader\'s Mantle'), gs(5,3,'Spirit Guardians'), gs(7,4,'Freedom of Movement'), gs(7,4,'Stoneskin'),
        gs(9,5,'Flame Strike'), gs(9,5,'Hold Monster'),
      ], description: 'Heavy armor, martial weapons. War Priest: bonus action weapon attack (WIS mod/LR). Guided Strike: +10 to hit with Channel Divinity.', features: [
        { level: 1, name: 'Bonus Proficiencies', description: 'Gain proficiency with heavy armor and martial weapons.' },
        { level: 1, name: 'War Priest', description: 'When you use the Attack action, you can make one weapon attack as a bonus action. Uses = WIS modifier (min 1) per long rest.' },
        { level: 2, name: 'Guided Strike', description: 'Channel Divinity: when you or a creature within 30ft makes an attack roll, grant +10 to that roll (after seeing the roll, before learning if it hits).' },
        { level: 2, name: "War God's Blessing", description: 'Channel Divinity: reaction to grant +10 to an attack roll made by another creature within 30ft.' },
        { level: 6, name: "War God's Blessing", description: 'You can now grant the +10 attack bonus to any ally within 30ft as a reaction, without using your Channel Divinity.' },
        { level: 8, name: 'Divine Strike', description: 'Once per turn when you hit with a weapon attack, deal an extra 1d8 damage of the same type as the weapon (2d8 at L14).' },
        { level: 17, name: 'Avatar of Battle', description: 'Gain resistance to bludgeoning, piercing, and slashing damage from nonmagical weapons.' },
      ] },
      { slug: 'arcana', name: 'Arcana Domain', level: 1, grantedSpells: [
        gs(1,1,'Detect Magic'), gs(1,1,'Magic Missile'), gs(3,2,'Magic Weapon'), gs(3,2,'Nystul\'s Magic Aura'),
        gs(5,3,'Dispel Magic'), gs(5,3,'Magic Circle'), gs(7,4,'Arcane Eye'), gs(7,4,'Leomund\'s Secret Chest'),
        gs(9,5,'Planar Binding'), gs(9,5,'Teleportation Circle'),
      ], description: 'Arcane Initiate: 2 Wizard cantrips. Arcane Abjuration Channel Divinity: turn/banish extraplanar creatures.', features: [
        { level: 1, name: 'Arcane Initiate', description: 'Gain two Wizard cantrips of your choice. They count as Cleric cantrips for you.' },
        { level: 2, name: 'Arcane Abjuration', description: 'Channel Divinity: present your holy symbol, forcing one extraplanar creature within 30ft to make a WIS save or be turned for 1 min. If the creature\'s CR is low enough, it is banished to its home plane (CR 1/2 at L5, CR 1 at L8, CR 2 at L11, CR 3 at L14, CR 4 at L17).' },
        { level: 6, name: 'Spell Breaker', description: 'When you restore HP to an ally with a healing spell, you can also end one spell on that ally of a level equal to or less than the healing spell\'s level.' },
        { level: 8, name: 'Potent Spellcasting', description: 'Add your WIS modifier to the damage you deal with any Cleric cantrip.' },
        { level: 17, name: 'Arcane Mastery', description: 'Choose 4 spells from the Wizard list (1 each of 6th, 7th, 8th, and 9th level). They are always prepared and count as Cleric spells for you.' },
      ] },
      { slug: 'death', name: 'Death Domain', level: 1, grantedSpells: [
        gs(1,1,'False Life'), gs(1,1,'Ray of Sickness'), gs(3,2,'Blindness/Deafness'), gs(3,2,'Ray of Enfeeblement'),
        gs(5,3,'Animate Dead'), gs(5,3,'Vampiric Touch'), gs(7,4,'Blight'), gs(7,4,'Death Ward'),
        gs(9,5,'Antilife Shell'), gs(9,5,'Cloudkill'),
      ], description: 'Reaper: cantrips can target one extra creature. Touch of Death Channel Divinity: 5 × Cleric level necrotic on touch.', features: [
        { level: 1, name: 'Bonus Proficiency', description: 'Gain proficiency with martial weapons.' },
        { level: 1, name: 'Reaper', description: 'Cleric cantrips that normally target one creature can instead target two creatures within range and within 5ft of each other.' },
        { level: 2, name: 'Touch of Death', description: 'Channel Divinity: when you hit a creature with a melee attack, deal extra necrotic damage equal to 5 × Cleric level.' },
        { level: 6, name: 'Inescapable Destruction', description: 'Necrotic damage you deal ignores resistance to necrotic damage.' },
        { level: 8, name: 'Divine Strike', description: 'Once per turn when you hit with a weapon attack, deal an extra 1d8 necrotic damage (2d8 at L14).' },
        { level: 17, name: 'Improved Reaper', description: 'Any Cleric spell of 1st through 5th level that targets only one creature can now target two creatures within range and within 5ft of each other. If the spell consumes material components, you must provide them for each target.' },
      ] },
      { slug: 'forge', name: 'Forge Domain', level: 1, grantedSpells: [
        gs(1,1,'Identify'), gs(1,1,'Searing Smite'), gs(3,2,'Heat Metal'), gs(3,2,'Magic Weapon'),
        gs(5,3,'Elemental Weapon'), gs(5,3,'Protection from Energy'), gs(7,4,'Fabricate'), gs(7,4,'Wall of Fire'),
        gs(9,5,'Animate Objects'), gs(9,5,'Creation'),
      ], description: 'Artisan\'s Blessing Channel Divinity: craft small metal items. Blessing of the Forge: bless one weapon or armor with +1.', features: [
        { level: 1, name: 'Bonus Proficiencies', description: 'Gain proficiency with heavy armor and smith\'s tools.' },
        { level: 1, name: 'Blessing of the Forge', description: 'At the end of a long rest, touch one nonmagical weapon or piece of armor. It becomes magical and gains +1 to attack/damage (if weapon) or +1 AC (if armor) until your next long rest.' },
        { level: 2, name: "Artisan's Blessing", description: 'Channel Divinity: over a short rest, create a nonmagical metal item worth up to 100gp and weighting up to 1 lb., consuming an equal value of raw metal.' },
        { level: 6, name: 'Soul of the Forge', description: 'Gain resistance to fire damage. While wearing heavy armor, gain +1 to AC.' },
        { level: 8, name: 'Divine Strike', description: 'Once per turn when you hit with a weapon attack, deal an extra 1d8 fire damage (2d8 at L14).' },
        { level: 17, name: 'Saint of Forge and Fire', description: 'Gain immunity to fire damage. While wearing heavy armor, you have resistance to bludgeoning, piercing, and slashing damage from nonmagical weapons.' },
      ] },
      { slug: 'grave', name: 'Grave Domain', level: 1, grantedSpells: [
        gs(1,1,'Bane'), gs(1,1,'False Life'), gs(3,2,'Gentle Repose'), gs(3,2,'Ray of Enfeeblement'),
        gs(5,3,'Revivify'), gs(5,3,'Vampiric Touch'), gs(7,4,'Blight'), gs(7,4,'Death Ward'),
        gs(9,5,'Antilife Shell'), gs(9,5,'Raise Dead'),
      ], description: 'Circle of Mortality: maximize healing for creatures at 0 HP. Sentinel at Death\'s Door: reaction to turn a critical hit into a normal hit.', features: [
        { level: 1, name: 'Circle of Mortality', description: 'When you heal a creature that has 0 HP, maximize dice rolls rather than rolling. Additionally, you learn Spare the Dying, which has a range of 30ft for you.' },
        { level: 1, name: 'Eyes of the Grave', description: 'As an action, sense undead within 60ft (number, direction, and type) until end of next turn. Uses = WIS modifier per long rest.' },
        { level: 2, name: "Sentinel at Death's Door", description: 'Reaction: when you or a creature within 30ft is hit by a critical hit, turn it into a normal hit. Uses = WIS modifier per long rest.' },
        { level: 6, name: 'Potent Spellcasting', description: 'Add your WIS modifier to the damage you deal with any Cleric cantrip.' },
        { level: 8, name: 'Keeper of Souls', description: 'Once per round, when an enemy creature dies within 60ft and it is not undead or a construct, you or one ally within 60ft regains HP equal to the creature\'s number of Hit Dice.' },
        { level: 17, name: 'Blessed Strikes', description: 'You\'re blessed with divine might in battle. When a creature takes damage from one of your cantrips or weapon attacks, you can also expend a spell slot to deal 2d8 necrotic damage per slot level to the creature.' },
      ] },
      { slug: 'order', name: 'Order Domain', level: 1, grantedSpells: [
        gs(1,1,'Command'), gs(1,1,'Heroism'), gs(3,2,'Hold Person'), gs(3,2,'Zone of Truth'),
        gs(5,3,'Mass Healing Word'), gs(5,3,'Slow'), gs(7,4,'Compulsion'), gs(7,4,'Locate Creature'),
        gs(9,5,'Commune'), gs(9,5,'Dominate Person'),
      ], description: 'Voice of Authority: when you cast a spell with a slot on an ally, they can make one weapon attack as reaction.', features: [
        { level: 1, name: 'Domain Spells', description: 'Always prepared: Command, Heroism (L1); Hold Person, Zone of Truth (L3); Mass Healing Word, Slow (L5); Compulsion, Locate Creature (L7); Commune, Dominate Person (L9).' },
        { level: 1, name: 'Bonus Proficiency', description: 'You gain proficiency with heavy armor.' },
        { level: 1, name: 'Voice of Authority', description: 'When you cast a spell of 1st level or higher using a spell slot on an ally, that ally can use their reaction to make one weapon attack against a creature of your choice within range.' },
        { level: 2, name: 'Channel Divinity: Order\'s Demand', description: 'Action: present your holy symbol. Each creature of your choice within 30ft that can see you must succeed on a WIS save or be charmed until the end of your next turn or until it takes damage. Charmed creatures drop whatever they\'re holding.' },
        { level: 6, name: 'Embodiment of the Law', description: 'When you cast an enchantment spell of 1st level or higher using a spell slot, you can change its casting time to a bonus action (once per turn, PB times per long rest).' },
        { level: 8, name: 'Divine Strike', description: 'Once per turn when you hit with a weapon attack, you deal an extra 1d8 psychic damage (2d8 at level 14).' },
        { level: 17, name: 'Order\'s Wrath', description: 'If you deal Divine Strike damage to a creature, you can curse it until the start of your next turn. When any of your allies hits the cursed creature with an attack, they deal extra 2d8 psychic damage.' },
      ] },
      { slug: 'peace', name: 'Peace Domain', level: 1, grantedSpells: [
        gs(1,1,'Heroism'), gs(1,1,'Sanctuary'), gs(3,2,'Aid'), gs(3,2,'Warding Bond'),
        gs(5,3,'Beacon of Hope'), gs(5,3,'Sending'), gs(7,4,'Aura of Purity'), gs(7,4,'Otiluke\'s Resilient Sphere'),
        gs(9,5,'Greater Restoration'), gs(9,5,'Rary\'s Telepathic Bond'),
      ], description: 'Emboldening Bond: bond 1+PB creatures; bonded creatures add 1d4 to attack rolls, saves, and ability checks when within 30ft of another.', features: [
        { level: 1, name: 'Domain Spells', description: 'Always prepared: Heroism, Sanctuary (L1); Aid, Warding Bond (L3); Beacon of Hope, Sending (L5); Aura of Purity, Otiluke\'s Resilient Sphere (L7); Greater Restoration, Rary\'s Telepathic Bond (L9).' },
        { level: 1, name: 'Implement of Peace', description: 'You gain proficiency in the Insight, Performance, or Persuasion skill (your choice).' },
        { level: 1, name: 'Emboldening Bond', description: 'As an action, bond up to 1+PB creatures (including yourself) within 30ft. For 10 min, when a bonded creature makes an attack roll, ability check, or saving throw, they can add 1d4 while within 30ft of another bonded creature. PB uses per long rest.' },
        { level: 2, name: 'Channel Divinity: Balm of Peace', description: 'Move up to your speed (no OA). When you move within 5ft of any creature during this movement, you can spend healing equal to 2d6 + your WIS modifier without using an action.' },
        { level: 6, name: 'Protective Bond', description: 'The bond from Emboldening Bond now also grants: when a bonded creature is about to take damage, another bonded creature within 60ft can use its reaction to teleport to an unoccupied space within 5ft of the first and take all the damage instead.' },
        { level: 8, name: 'Potent Spellcasting', description: 'Add your WIS modifier to the damage you deal with Cleric cantrips.' },
        { level: 17, name: 'Expansive Bond', description: 'The range of Emboldening Bond and Protective Bond increases to 300ft, and Protective Bond now grants resistance to the damage taken.' },
      ] },
      { slug: 'twilight', name: 'Twilight Domain', level: 1, grantedSpells: [
        gs(1,1,'Faerie Fire'), gs(1,1,'Sleep'), gs(3,2,'Moonbeam'), gs(3,2,'See Invisibility'),
        gs(5,3,'Aura of Vitality'), gs(5,3,'Leomund\'s Tiny Hut'), gs(7,4,'Aura of Life'), gs(7,4,'Greater Invisibility'),
        gs(9,5,'Circle of Power'), gs(9,5,'Mislead'),
      ], description: 'Darkvision 300ft. Twilight Sanctuary Channel Divinity: 30ft aura granting temp HP or ending charmed/frightened.', features: [
        { level: 1, name: 'Domain Spells', description: 'Always prepared: Faerie Fire, Sleep (L1); Moonbeam, See Invisibility (L3); Aura of Vitality, Leomund\'s Tiny Hut (L5); Aura of Life, Greater Invisibility (L7); Circle of Power, Mislead (L9).' },
        { level: 1, name: 'Bonus Proficiencies', description: 'You gain proficiency with martial weapons and heavy armor.' },
        { level: 1, name: 'Eyes of Night', description: 'Darkvision out to 300ft. As an action, grant any number of creatures within 10ft darkvision to 300ft for 1 hour. Once used, you must finish a long rest unless you expend a spell slot to use it again.' },
        { level: 1, name: 'Vigilant Blessing', description: 'As an action, touch one creature (including yourself). Until the start of your next turn, that creature has advantage on its next initiative roll. Once used, finish a short or long rest to reset.' },
        { level: 2, name: 'Channel Divinity: Twilight Sanctuary', description: 'Action: present your holy symbol. A 30ft radius sphere of dim light emanates from you for 1 min. When a creature enters or starts its turn in the sphere, you can choose: grant temp HP equal to 1d6+5, OR end one effect causing it to be charmed or frightened.' },
        { level: 6, name: 'Steps of Night', description: 'Bonus action when in dim light or darkness: fly speed equal to your walking speed. Lasts until end of current turn. PB times per long rest.' },
        { level: 8, name: 'Divine Strike', description: 'Once per turn when you hit with a weapon attack, you deal an extra 1d8 radiant damage (2d8 at level 14).' },
        { level: 17, name: 'Twilight Shroud', description: 'The sphere from Twilight Sanctuary also provides half cover to all creatures inside it.' },
      ] },
    ],
    features: [
      { level: 1, name: 'Spellcasting (WIS)', description: 'Prepare WIS mod + Cleric level spells from the Cleric list each long rest. Cast using WIS.' },
      { level: 1, name: 'Divine Domain', description: 'Choose your Cleric subclass. Gain bonus spells always prepared (domain spells) and a domain feature.' },
      { level: 2, name: 'Channel Divinity', description: '1 use per short or long rest (2/rest at L6, 3/rest at L18). Use Turn Undead (force undead to flee) or your domain\'s Channel Divinity.' },
      { level: 4, name: 'Ability Score Improvement', description: '+2 to one ability score or +1 to two (max 20), or choose a feat.' },
      { level: 5, name: 'Destroy Undead', description: 'When you turn undead, creatures of CR 1/2 or lower are destroyed instead. CR threshold rises as you level (CR 1 at L8, CR 2 at L11, CR 3 at L14, CR 4 at L17).' },
      { level: 6, name: 'Channel Divinity', description: 'You now have 2 uses of Channel Divinity per rest.' },
      { level: 6, name: 'Subclass Feature', description: 'Your Divine Domain grants an additional feature.' },
      { level: 8, name: 'Ability Score Improvement', description: '+2 to one ability score or +1 to two (max 20), or choose a feat.' },
      { level: 8, name: 'Subclass Feature', description: 'Your Divine Domain grants a Potent Spellcasting or Divine Strike feature.' },
      { level: 10, name: 'Divine Intervention', description: 'Call on your deity for miraculous help. 1% chance × Cleric level of succeeding. 1/week if it works; recharges on long rest otherwise. Automatically succeeds at L20.' },
      { level: 11, name: 'Destroy Undead', description: 'Now destroys undead of CR 2 or lower.' },
      { level: 12, name: 'Ability Score Improvement', description: '+2 to one ability score or +1 to two (max 20), or choose a feat.' },
      { level: 14, name: 'Destroy Undead', description: 'Now destroys undead of CR 3 or lower.' },
      { level: 16, name: 'Ability Score Improvement', description: '+2 to one ability score or +1 to two (max 20), or choose a feat.' },
      { level: 17, name: 'Destroy Undead', description: 'Now destroys undead of CR 4 or lower.' },
      { level: 17, name: 'Subclass Feature', description: 'Your Divine Domain grants an additional feature.' },
      { level: 18, name: 'Channel Divinity', description: 'You now have 3 uses of Channel Divinity per rest.' },
      { level: 19, name: 'Ability Score Improvement', description: '+2 to one ability score or +1 to two (max 20), or choose a feat.' },
      { level: 20, name: 'Divine Intervention', description: 'Your Divine Intervention now succeeds automatically every 7 days.' },
    ],
  },

  druid: {
    hitDie: 8,
    primaryAbility: 'Wisdom',
    savingThrows: ['Intelligence', 'Wisdom'],
    armorTraining: 'Light & medium armor, shields (non-metal only)',
    weaponTraining: 'Clubs, daggers, darts, javelins, maces, quarterstaffs, scimitars, sickles, slings, spears',
    skillChoices: ['Arcana', 'Animal Handling', 'Insight', 'Medicine', 'Nature', 'Perception', 'Religion', 'Survival'],
    numSkillChoices: 2,
    cantripsKnown: 2,
    cantripsAtLevel: [4, 10],
    preparedCaster: true,
    subclasses: [
      { slug: 'land', name: 'Circle of the Land', level: 2, description: 'Natural Recovery: recover spell slots on SR. Bonus spells from chosen terrain (Arctic, Coast, Desert, Forest, Grassland, Mountain, Swamp, Underdark).', features: [
        { level: 2, name: 'Bonus Cantrip', description: 'Learn one additional Druid cantrip of your choice.' },
        { level: 2, name: 'Natural Recovery', description: 'Once per day during a short rest, recover expended spell slots totaling up to half your Druid level (rounded up). No recovered slot may be 6th level or higher.' },
        { level: 2, name: 'Circle Spells', description: 'Gain access to bonus spells based on your chosen terrain (Arctic, Coast, Desert, Forest, Grassland, Mountain, Swamp, or Underdark). These spells are always prepared and don\'t count against your prepared spell count.' },
        { level: 6, name: "Land's Stride", description: 'Moving through nonmagical difficult terrain costs no extra movement. Moving through nonmagical plants won\'t slow you or deal damage. Advantage on saves vs magical plants.' },
        { level: 10, name: "Nature's Ward", description: 'Immune to poison and disease; immune to charm and frightened effects by elementals and fey.' },
        { level: 14, name: "Nature's Sanctuary", description: 'Beasts and plants must succeed on a WIS save or fail to attack you. If they fail, they must choose a different target. On a success, they\'re immune to this effect for 24 hours.' },
      ] },
      { slug: 'moon', name: 'Circle of the Moon', level: 2, description: 'Combat Wild Shape: transform as bonus action; CR up to 1 at L2 (scales). Elemental Form (CR 5 elementals) at L10.', features: [
        { level: 2, name: 'Combat Wild Shape', description: 'Transform into a beast as a bonus action (instead of an action). While in beast form, use a bonus action to expend spell slots (1 slot = 1d8 HP per spell level) to regain HP. Maximum CR for beast form = Druid level ÷ 3 (min 1).' },
        { level: 2, name: 'Circle Forms', description: 'Wild Shape maximum CR = Druid level ÷ 3 (rounded down, min 1) instead of the standard limit. At L2 this means CR 1; CR 3 at L9, etc.' },
        { level: 6, name: 'Primal Strike', description: 'Your Wild Shape attacks count as magical for the purpose of overcoming resistance and immunity to nonmagical attacks and damage.' },
        { level: 10, name: 'Elemental Wild Shape', description: 'Expend two uses of Wild Shape to transform into an Air, Earth, Fire, or Water Elemental (CR 5) instead of a beast.' },
        { level: 14, name: 'Thousand Forms', description: 'Gain the ability to cast Alter Self at will, with no concentration required.' },
      ] },
      { slug: 'dreams', name: 'Circle of Dreams', level: 2, description: 'Balm of the Summer Court: distribute healing as a bonus action using Wild Shape pool. Hearth of Moonlight and Shadow (safe campsite). Walker in Dreams (teleport to familiar place during rest).', features: [
        { level: 2, name: 'Balm of the Summer Court', description: 'Pool of fey healing energy = Druid level dice (d6). As a bonus action, expend any number of dice on a creature within 120ft that you can see; restore HP equal to result + WIS modifier, and grant that many temp HP.' },
        { level: 6, name: 'Hearth of Moonlight and Shadow', description: 'At a short or long rest, magically ward the area (30ft radius). While inside, dim light doesn\'t impose disadvantage on Perception; tiny sounds outside don\'t penetrate; the area becomes hidden from magical scrying.' },
        { level: 10, name: 'Hidden Paths', description: 'Bonus action: teleport up to 60ft to an unoccupied space you can see. Or as an action, teleport a willing creature within 5ft to an unoccupied space you can see within 30ft. Uses = WIS modifier per long rest.' },
        { level: 14, name: 'Walker in Dreams', description: 'When you finish a short rest, cast Dream, Scrying, or Teleportation Circle once without a spell slot. This uses your Balm of the Summer Court pool instead.' },
      ] },
      { slug: 'shepherd', name: 'Circle of the Shepherd', level: 2, description: 'Speech of the Woods: speak with beasts, know Sylvan. Spirit Totem: summon Bear (HP aura), Hawk (attack bonus), Unicorn (healing) spirit as bonus action.', features: [
        { level: 2, name: 'Speech of the Woods', description: 'Gain the ability to cast Speak with Animals at will (no spell slot). Also learn Sylvan if you don\'t already know it.' },
        { level: 2, name: 'Spirit Totem', description: 'Bonus action: summon a spirit totem within 60ft (1 min, 1/short rest). Bear Spirit: 60ft aura granting max HP increase to summoned and wild-shaped creatures; +5 HP to the Druid. Hawk Spirit: creatures in the aura can use their reaction to give advantage on an attack made this turn. Unicorn Spirit: spells that restore HP to creatures in the aura add WIS mod HP; can detect magic within 60ft.' },
        { level: 6, name: 'Mighty Summoner', description: 'Beasts and fey you summon or create with spells have 2 extra HP per HD, and their natural weapons count as magical.' },
        { level: 10, name: 'Guardian Spirit', description: 'Spirit Totem now also protects summoned and wild-shaped creatures: each such creature that ends its turn in the aura regains 2d6 + WIS modifier HP.' },
        { level: 14, name: 'Faithful Summons', description: 'When you are reduced to 0 HP or are incapacitated against your will, immediately summon 4 spirit guardians (CR 2 or lower beasts) which appear in unoccupied spaces within 20ft. They act immediately and last 1 hour or until you dismiss them.' },
      ] },
      { slug: 'spores', name: 'Circle of Spores', level: 2, grantedSpells: [
        gs(2,0,'Chill Touch'), gs(2,2,'Blindness/Deafness'), gs(3,2,'Gentle Repose'), gs(3,2,'Ray of Enfeeblement'),
        gs(5,3,'Animate Dead'), gs(5,3,'Gaseous Form'), gs(7,4,'Blight'), gs(7,4,'Confusion'),
        gs(9,5,'Cloudkill'), gs(9,5,'Contagion'),
      ], description: 'Halo of Spores: reaction to deal necrotic damage (1d4 → 1d10 scaling) to creatures that enter your space or start turns there. Symbiotic Entity: double Wild Shape charges for +4d6 necrotic on weapon hits.', features: [
        { level: 2, name: 'Halo of Spores', description: 'Reaction: when a creature you can see moves into your space or starts its turn within 10ft, deal 1d4 necrotic damage (CON save for none). Damage increases: 1d6 (L6), 1d8 (L10), 1d10 (L14).' },
        { level: 2, name: 'Symbiotic Entity', description: 'When you Wild Shape, instead of transforming you can spend a Wild Shape charge to awaken spores. You gain 4 temp HP per Druid level. While these persist: Halo of Spores deals an extra 1d6 necrotic, weapon attacks deal an extra 1d6 necrotic. Lasts 10 min or until temp HP depleted.' },
        { level: 6, name: 'Fungal Infestation', description: 'Reaction: when a small or medium beast or humanoid dies within 10ft, animate its corpse as a zombie. The zombie lasts 1 hour, then collapses. Obeys simple verbal commands. WIS mod uses per long rest.' },
        { level: 10, name: 'Spreading Spores', description: 'Bonus action while Symbiotic Entity is active: hurl a cluster of spores to a point within 60ft. Until your Symbiotic Entity ends, Halo of Spores radiates from that point instead of you. You can relocate the point as a bonus action.' },
        { level: 14, name: 'Fungal Body', description: 'Spores infuse you permanently. You gain immunity to the blinded, deafened, frightened, and poisoned conditions. Critical hits against you become normal hits.' },
      ] },
      { slug: 'stars', name: 'Circle of Stars', level: 2, description: 'Star Map (bonus Guidance/Guiding Bolt). Starry Form: Archer (bonus radiant), Chalice (bonus healing), Dragon (concentration advantage).', features: [
        { level: 2, name: 'Star Map', description: 'You\'ve studied the stars and created a star map (a celestial chart, staff, orb, or similar). It serves as a spellcasting focus. While holding it, you know Guidance and can cast it at will. You also prepare Guiding Bolt and can cast it a number of times equal to your PB per long rest without a slot.' },
        { level: 2, name: 'Starry Form', description: 'When you Wild Shape (without transforming into a beast), you take on a starry form for 10 min. Choose Archer (bonus action: luminous arrow — ranged spell attack, 1d8+WIS radiant), Chalice (when you cast a healing spell, restore 1d8+WIS HP to yourself or another within 30ft), or Dragon (concentration saves have minimum result of 10).' },
        { level: 6, name: 'Cosmic Omen', description: 'After each long rest, roll a d6. On an odd number (Woe), reaction: impose −1d6 to an attack, check, or save of a creature within 30ft. On an even (Weal), reaction: add +1d6 to a roll made by a creature within 30ft. Use WIS mod times per long rest.' },
        { level: 10, name: 'Twinkling Constellations', description: 'While in Starry Form, at the start of each turn you can change your constellation form. The Archer and Chalice forms now deal/restore 2d8+WIS, and Dragon gives you a fly speed of 20ft and hover.' },
        { level: 14, name: 'Full of Stars', description: 'While in Starry Form, you become partially incorporeal — resistance to bludgeoning, piercing, and slashing damage from nonmagical attacks.' },
      ] },
      { slug: 'wildfire', name: 'Circle of Wildfire', level: 2, grantedSpells: [
        gs(2,1,'Burning Hands'), gs(2,1,'Cure Wounds'), gs(3,2,'Flaming Sphere'), gs(3,2,'Scorching Ray'),
        gs(5,3,'Aura of Vitality'), gs(5,3,'Fireball'), gs(7,4,'Aura of Life'), gs(7,4,'Fire Shield'),
        gs(9,5,'Flame Strike'), gs(9,5,'Mass Cure Wounds'),
      ], description: 'Summon Wildfire Spirit (bonus action) that assists with healing teleport (60ft) and fire damage. Wildfire spells always prepared.', features: [
        { level: 2, name: 'Wildfire Spirit', description: 'As a bonus action, expend one Wild Shape charge to summon a Wildfire Spirit in an unoccupied space within 30ft. It has AC 13, HP = 5× Druid level, immune to fire. It acts on your initiative. You can command it as a bonus action or use its Flame Seed (ranged, 1d6+WIS fire, sets target ablaze — 1d6 fire at end of turns) or Fiery Teleportation (60ft teleport self + up to 5 willing allies, 1d6+WIS fire to creatures in origin/destination area).' },
        { level: 2, name: 'Enhanced Bond', description: 'While your Wildfire Spirit is summoned: bonus 1d8 fire damage to any fire spell you cast, and your healing spells can be cast at their normal range even if you target creatures within 30ft of the spirit.' },
        { level: 6, name: 'Cauterizing Flames', description: 'Reaction: when a Small or larger creature dies within 60ft, a pillar of flame erupts. Choose any creature within 5ft of the corpse — either deal 2d10 fire damage (DEX save for none) or restore 2d10+WIS HP. WIS mod uses per long rest.' },
        { level: 10, name: 'Blazing Revival', description: 'When your Wildfire Spirit is within 120ft and you drop to 0 HP, the spirit flies to you and detonates, dropping to 0 HP itself and causing you to regain half your max HP. Once used, long rest to reset.' },
        { level: 14, name: 'Firestorm', description: 'When you cast a fire spell using a spell slot, choose up to PB creatures damaged by it — they take extra fire damage equal to your WIS modifier.' },
      ] },
    ],
    features: [
      { level: 1, name: 'Druidic', description: 'Know the secret Druidic language — hidden messages in normal speech, only Druids can find them. Also serves as a sign of recognition.' },
      { level: 1, name: 'Spellcasting (WIS)', description: 'Prepare WIS mod + Druid level spells from the Druid list each long rest. Cast using WIS.' },
      { level: 2, name: 'Wild Shape', description: 'Transform into a beast you\'ve seen. 2 uses/SR. L2: CR 1/4 (no fly/swim). L4: CR 1/2, swim speed. L8: CR 1, fly speed. Duration = half Druid level hours.' },
      { level: 2, name: 'Druid Circle', description: 'Choose your Druid subclass.' },
      { level: 4, name: 'Ability Score Improvement', description: '+2 to one ability score or +1 to two (max 20), or choose a feat.' },
      { level: 4, name: 'Wild Shape Improvement', description: 'Can now Wild Shape into CR 1/2 beasts (swim speed allowed).' },
      { level: 6, name: 'Subclass Feature', description: 'Your Druid Circle grants an additional feature.' },
      { level: 8, name: 'Ability Score Improvement', description: '+2 to one ability score or +1 to two (max 20), or choose a feat.' },
      { level: 8, name: 'Wild Shape Improvement', description: 'Can now Wild Shape into CR 1 beasts (fly speed allowed).' },
      { level: 10, name: 'Subclass Feature', description: 'Your Druid Circle grants an additional feature.' },
      { level: 12, name: 'Ability Score Improvement', description: '+2 to one ability score or +1 to two (max 20), or choose a feat.' },
      { level: 14, name: 'Subclass Feature', description: 'Your Druid Circle grants an additional feature.' },
      { level: 16, name: 'Ability Score Improvement', description: '+2 to one ability score or +1 to two (max 20), or choose a feat.' },
      { level: 18, name: 'Timeless Body', description: 'Age at 1/10 the normal rate. No longer need food or water.' },
      { level: 18, name: 'Beast Spells', description: 'Cast Druid spells while in Wild Shape form — as long as spells don\'t require hands (somatic/material only, no verbal).' },
      { level: 19, name: 'Ability Score Improvement', description: '+2 to one ability score or +1 to two (max 20), or choose a feat.' },
      { level: 20, name: 'Archdruid', description: 'Wild Shape uses are unlimited. Ignore the verbal and somatic components of Druid spells and the material components worth 1gp or less.' },
    ],
  },

  fighter: {
    hitDie: 10,
    primaryAbility: 'Strength or Dexterity',
    savingThrows: ['Strength', 'Constitution'],
    armorTraining: 'All armor and shields',
    weaponTraining: 'Simple and martial weapons',
    skillChoices: ['Acrobatics', 'Animal Handling', 'Athletics', 'History', 'Insight', 'Intimidation', 'Perception', 'Survival'],
    numSkillChoices: 2,
    fightingStyles: FIGHTER_STYLES,
    subclasses: [
      { slug: 'champion', name: 'Champion', level: 3, description: 'Improved Critical (crit on 19-20 at L3, 18-20 at L15). Remarkable Athlete: add half PB to STR/DEX/CON checks. Additional Fighting Style at L10.', features: [
        { level: 3, name: 'Improved Critical', description: 'Score a critical hit on a roll of 19 or 20 (18-20 at L15).' },
        { level: 7, name: 'Remarkable Athlete', description: 'Add half your Proficiency Bonus (rounded up) to any STR, DEX, or CON check not already using your full proficiency. Also add this bonus to the distance of a running long jump.' },
        { level: 10, name: 'Additional Fighting Style', description: 'Choose a second Fighting Style option.' },
        { level: 15, name: 'Superior Critical', description: 'Critical hit range expands to 18-20.' },
        { level: 18, name: 'Survivor', description: 'Regain HP equal to 5 + CON modifier at the start of your turn if you have fewer than half your hit points and at least 1 HP remaining.' },
      ] },
      { slug: 'battle-master', name: 'Battle Master', level: 3, description: 'Superiority Dice (d8 → d10 → d12). Learn 3 Maneuvers (trip, disarm, feint, commander\'s strike, etc.). Save DC = 8 + PB + STR or DEX mod.', features: [
        { level: 3, name: 'Combat Superiority', description: 'Learn 3 maneuvers from the Battle Master list. Gain 4 Superiority Dice (d8). Maneuver save DC = 8 + PB + STR or DEX mod. Gain 2 more maneuvers at L7 and L10. Superiority Dice become d10 at L10 and d12 at L18. Regain all dice on short or long rest.' },
        { level: 3, name: 'Student of War', description: 'Gain proficiency with one artisan\'s tool of your choice.' },
        { level: 7, name: 'Know Your Enemy', description: 'Spend 1 minute observing or interacting with another creature outside combat. The DM tells you if the creature is your equal, superior, or inferior in two of the following: STR, DEX, CON, AC, current HP, total class levels, Fighter levels.' },
        { level: 15, name: 'Relentless', description: 'When you roll initiative and have no Superiority Dice remaining, regain 1 die.' },
      ] },
      { slug: 'eldritch-knight', name: 'Eldritch Knight', level: 3, description: 'Spellcasting (INT, Abjuration & Evocation). Weapon Bond (can\'t be disarmed, teleport weapon to hand). War Magic at L7 (attack after cantrip).', features: [
        { level: 3, name: 'Spellcasting (INT)', description: 'Cast spells from the Eldritch Knight list (primarily Abjuration and Evocation). Spells known scale from 3 (L3) to 13 (L20). Use INT. At L8, L14, and L20, one spell can be from any school.' },
        { level: 3, name: 'Weapon Bond', description: 'After a 1-hour ritual, bond with up to 2 weapons. Bonded weapons can\'t be disarmed, and you can teleport them to your hand as a free action (even if on another plane).' },
        { level: 7, name: 'War Magic', description: 'When you take the Attack action and use it to cast a cantrip, you can make one weapon attack as a bonus action.' },
        { level: 10, name: 'Eldritch Strike', description: 'When you hit a creature with a weapon attack, the creature has disadvantage on its next saving throw against a spell you cast before the end of your next turn.' },
        { level: 15, name: 'Arcane Charge', description: 'When you use Action Surge, you can teleport up to 30ft to an unoccupied space you can see, either before or after the additional action.' },
        { level: 18, name: 'Improved War Magic', description: 'When you take the Attack action, you can replace one of your attacks with a spell of 1st level or higher. Use a spell slot to cast it.' },
      ] },
      { slug: 'arcane-archer', name: 'Arcane Archer', level: 3, description: 'Arcane Shot (2 uses/SR): Banishing Arrow, Curving Shot, Enfeebling Arrow, Grasping Arrow, Piercing Arrow, Seeking Arrow, Shadow Arrow, Bursting Arrow.', features: [
        { level: 3, name: 'Arcane Archer Lore', description: 'Learn the Prestidigitation or Druidcraft cantrip (your choice).' },
        { level: 3, name: 'Arcane Shot', description: 'Learn 2 Arcane Shot options (more at L7, L10, L15, L18). Use a shot when you hit with a bow attack. 2 uses per short rest. Options: Banishing Arrow (STR save or banish 1 turn), Beguiling Arrow (CHA save or charmed 1 min), Bursting Arrow (2d6 force in 10ft), Enfeebling Arrow (CON save or halved damage 1 min), Grasping Arrow (2d6 poison + restrained, 2d6/turn), Piercing Arrow (hit all creatures in 30ft line), Seeking Arrow (curves to target, no cover), Shadow Arrow (WIS save or blind 1 turn). Damage improves at L18.' },
        { level: 7, name: 'Magic Arrow', description: 'When you fire a nonmagical arrow, you can make it magical for that attack.' },
        { level: 7, name: 'Curving Shot', description: 'When you miss with an Arcane Shot, you can use a bonus action to reroll the attack against a different creature within 60ft of the original target.' },
        { level: 15, name: 'Ever-Ready Shot', description: 'When you roll initiative and have no Arcane Shot uses remaining, regain 1 use.' },
      ] },
      { slug: 'cavalier', name: 'Cavalier', level: 3, description: 'Bonus Proficiency (Animal Handling or a language). Born to the Saddle: advantage to stay mounted, mount speed bonus. Unwavering Mark: mark a creature to impose disadvantage and extra attack vs them.', features: [
        { level: 3, name: 'Bonus Proficiency', description: 'Gain proficiency in Animal Handling, History, Insight, Performance, or Persuasion (your choice). If already proficient in all, gain proficiency in a language of your choice.' },
        { level: 3, name: 'Born to the Saddle', description: 'Advantage on saving throws to avoid falling off a mount. Mounting or dismounting costs only 5ft of movement. Can force an attack targeting your mount to target you instead.' },
        { level: 3, name: 'Unwavering Mark', description: 'When you hit a creature with a melee weapon attack, mark it until end of your next turn. While marked: it has disadvantage on attacks targeting anyone but you; if the marked creature makes such an attack and is within 5ft, use a bonus action to make one melee weapon attack (dealing extra 1d8 at L18). Uses = STR modifier per long rest.' },
        { level: 7, name: 'Warding Maneuver', description: 'Reaction: when you or a creature within 5ft is hit, add 1d8 to the target\'s AC for that attack. Uses = CON modifier per long rest (min 1).' },
        { level: 10, name: 'Hold the Line', description: 'Creatures provoke opportunity attacks when they move 5ft or more while within your reach, and on a hit they are stopped.' },
        { level: 15, name: 'Ferocious Charger', description: 'If you move 10ft straight toward a creature before hitting it with a melee weapon attack, the creature must succeed on a STR save (DC 8+PB+STR) or be knocked prone and take extra 1d8 damage.' },
        { level: 18, name: 'Vigilant Defender', description: 'You can make opportunity attacks without using your reaction. Limit: one opportunity attack per creature\'s turn.' },
      ] },
      { slug: 'echo-knight', name: 'Echo Knight', level: 3, description: 'Manifest Echo: create a magical duplicate 15ft away. Attack from its space, swap positions with it, use it to watch for ambushes. Unleash Incarnation: extra attacks through echo.', features: [
        { level: 3, name: 'Manifest Echo', description: 'Bonus action: manifest a magical, translucent duplicate of yourself in an unoccupied space within 15ft. It has 1 HP and AC 14 + DEX mod. You control it and can attack from its space. Swap places with it as a bonus action. Echo lasts until destroyed, dismissed, you manifest another, or you are incapacitated.' },
        { level: 3, name: 'Unleash Incarnation', description: 'When you take the Attack action, you can make one additional melee attack from the echo\'s position. CON modifier uses per long rest.' },
        { level: 7, name: 'Echo Avatar', description: 'Spend 10 minutes to extend your senses through the echo. For up to 10 minutes (concentration), you see and hear through it instead of your own senses. The echo can move normally. You can end this early as a free action.' },
        { level: 10, name: 'Shadow Martyr', description: 'Reaction: when an ally within 5ft of your echo is hit, make the echo the new target of the attack. The attack hits the echo. 1 use per short rest.' },
        { level: 15, name: 'Reclaim Potential', description: 'When your echo is destroyed by taking damage, gain 2d6 + CON modifier temp HP. 2 uses per long rest.' },
        { level: 18, name: 'Legion of One', description: 'Create two echoes at once. Each functions independently. If you summon a third, the oldest is destroyed. If both echoes are present, you have advantage on DEX saves and cannot be surprised.' },
      ] },
      { slug: 'psi-warrior', name: 'Psi Warrior', level: 3, description: 'Psionic Energy dice (2d6, refill 1 on SR). Protective Field: expend die to reduce damage. Psionic Strike: extra force damage. Telekinetic Movement: move object or willing creature.', features: [
        { level: 3, name: 'Psionic Energy Dice', description: 'You have a number of Psionic Energy dice = 2× PB (d6). You regain one expended die when you roll initiative or finish a short rest; all dice on a long rest.' },
        { level: 3, name: 'Protective Field', description: 'Reaction: when you or another creature within 30ft takes damage, expend one Psionic Energy die and reduce the damage by the number rolled + INT modifier (minimum 1).' },
        { level: 3, name: 'Psionic Strike', description: 'Once per turn, immediately after hitting with a weapon attack, expend one Psionic Energy die to deal extra force damage equal to the roll + INT modifier.' },
        { level: 3, name: 'Telekinetic Movement', description: 'Action: expend one Psionic Energy die to move a Large or smaller creature or object up to 30ft in any direction (including up). A creature is moved in its space; an unwilling creature may make STR save vs. your spell save DC.' },
        { level: 7, name: 'Telekinetic Adept', description: 'Psi-Powered Leap: bonus action — fly speed = twice your walking speed until end of your turn. Telekinetic Thrust: on a Psionic Strike, if target fails STR save (DC 8+PB+INT), knock it prone or move it up to 10ft.' },
        { level: 15, name: 'Guarded Mind', description: 'Resistance to psychic damage. You can expend one Psionic Energy die (no action) to end one condition (charmed, frightened) affecting you.' },
      ] },
      { slug: 'rune-knight', name: 'Rune Knight', level: 3, grantedProficiencies: { tools: ['Smith\'s Tools'] }, description: 'Giant\'s Might (bonus action: grow Large, advantage STR, extra weapon die). Inscribe runes: Cloud, Fire, Frost, Stone, Storm runes for various bonuses.', features: [
        { level: 3, name: 'Bonus Proficiencies', description: 'You gain proficiency with smith\'s tools and learn to speak, read, and write Giant.' },
        { level: 3, name: 'Rune Carving', description: 'You can inscribe runes on weapons, armor, or an object. You know 2 runes (Cloud, Fire, Frost, Stone, or Storm) and learn one more at L7 and L15. You can activate a rune\'s larger effect 1/short rest.' },
        { level: 3, name: 'Giant\'s Might', description: 'Bonus action: grow to Large (or larger if already Large) for 1 minute. For the duration: advantage on STR checks and saves, attack with Large weapon for +1d6 damage. Uses = PB per long rest.' },
        { level: 7, name: 'Runic Shield', description: 'Reaction: when a creature within 60ft you can see is hit by an attack roll, force the attacker to reroll and use the lower result. Uses = PB per long rest.' },
        { level: 15, name: 'Master of Runes', description: 'Each rune\'s major effect can be used twice per short rest instead of once.' },
      ] },
      { slug: 'samurai', name: 'Samurai', level: 3, description: 'Bonus proficiency (History, Insight, Performance, or Persuasion). Fighting Spirit (bonus action: advantage on attacks this turn + 5 temp HP, 3/LR). Elegant Courtier (WIS to Persuasion).', features: [
        { level: 3, name: 'Bonus Proficiency', description: 'You gain proficiency in one of the following: History, Insight, Performance, or Persuasion. Alternatively, learn one language of your choice.' },
        { level: 3, name: 'Fighting Spirit', description: 'Bonus action: until end of your turn, advantage on all weapon attack rolls and gain 5 temp HP (increases to 10 at L10, 15 at L15). 3 uses per long rest.' },
        { level: 7, name: 'Elegant Courtier', description: 'Add WIS modifier to Persuasion checks (in addition to CHA). You also gain proficiency in WIS saves; if already proficient, add double proficiency bonus instead.' },
        { level: 15, name: 'Rapid Strike', description: 'When you use Fighting Spirit and have advantage on an attack roll on your turn, you can forgo advantage on one attack roll to make one additional attack with that weapon as part of the same action.' },
      ] },
    ],
    features: [
      { level: 1, name: 'Fighting Style', description: 'Choose a fighting style that enhances your combat role.' },
      { level: 1, name: 'Second Wind', description: 'Bonus action: regain 1d10 + Fighter level HP. 1 use/SR.' },
      { level: 2, name: 'Action Surge', description: 'Take one additional action on your turn. 1 use/SR (2 uses/SR at L17).' },
      { level: 3, name: 'Martial Archetype', description: 'Choose your Fighter subclass.' },
      { level: 4, name: 'Ability Score Improvement', description: '+2 to one ability score or +1 to two (max 20), or choose a feat.' },
      { level: 5, name: 'Extra Attack', description: 'Attack twice per Attack action. (3× at L11, 4× at L20.)' },
      { level: 6, name: 'Ability Score Improvement', description: '+2 to one ability score or +1 to two (max 20), or choose a feat.' },
      { level: 7, name: 'Subclass Feature', description: 'Your Martial Archetype grants an additional feature.' },
      { level: 8, name: 'Ability Score Improvement', description: '+2 to one ability score or +1 to two (max 20), or choose a feat.' },
      { level: 9, name: 'Indomitable', description: 'Reroll one failed saving throw per long rest (2/LR at L13, 3/LR at L17). Must use the new roll.' },
      { level: 10, name: 'Subclass Feature', description: 'Your Martial Archetype grants an additional feature.' },
      { level: 11, name: 'Extra Attack', description: 'Now attack 3 times per Attack action.' },
      { level: 12, name: 'Ability Score Improvement', description: '+2 to one ability score or +1 to two (max 20), or choose a feat.' },
      { level: 14, name: 'Ability Score Improvement', description: '+2 to one ability score or +1 to two (max 20), or choose a feat.' },
      { level: 15, name: 'Subclass Feature', description: 'Your Martial Archetype grants an additional feature.' },
      { level: 16, name: 'Ability Score Improvement', description: '+2 to one ability score or +1 to two (max 20), or choose a feat.' },
      { level: 17, name: 'Action Surge', description: 'Action Surge now gives 2 extra actions per rest.' },
      { level: 18, name: 'Subclass Feature', description: 'Your Martial Archetype grants an additional feature.' },
      { level: 19, name: 'Ability Score Improvement', description: '+2 to one ability score or +1 to two (max 20), or choose a feat.' },
      { level: 20, name: 'Extra Attack', description: 'Now attack 4 times per Attack action.' },
    ],
  },

  monk: {
    hitDie: 8,
    primaryAbility: 'Dexterity & Wisdom',
    savingThrows: ['Strength', 'Dexterity'],
    armorTraining: 'None',
    weaponTraining: 'Simple weapons and shortswords',
    skillChoices: ['Acrobatics', 'Athletics', 'History', 'Insight', 'Religion', 'Stealth'],
    numSkillChoices: 2,
    subclasses: [
      { slug: 'open-hand', name: 'Way of the Open Hand', level: 3, description: 'Open Hand Technique: after Flurry of Blows hit, force DEX save or prone/push 15ft, or deny reaction. Wholeness of Body: heal self 3× Monk level/LR.', features: [
        { level: 3, name: 'Open Hand Technique', description: 'Whenever you hit with one of the attacks from Flurry of Blows, apply one of three effects: DEX save or knocked prone; STR save or pushed up to 15ft away; or the target can\'t take reactions until start of your next turn.' },
        { level: 6, name: 'Wholeness of Body', description: 'As an action, heal yourself for 3 × your Monk level HP. 1 use per long rest.' },
        { level: 11, name: 'Tranquility', description: 'At the end of a long rest, gain the effect of a Sanctuary spell (WIS save DC 8+PB+WIS) until your next long rest. A creature that fails the save can\'t attack you for the rest of combat (unless you attack or cast a non-self spell).' },
        { level: 17, name: 'Quivering Palm', description: 'Vibrate a creature\'s molecules: spend 3 ki after hitting with a monk weapon. For the next 24 hours or until you use this again, you can use an action to deal 10d10 necrotic damage instantly (CON save for half). Multiple hits extend the window but don\'t stack the effect.' },
      ] },
      { slug: 'shadow', name: 'Way of Shadow', level: 3, description: 'Shadow Arts: cast Darkness, Darkvision, Pass without Trace, Silence at 2 ki each (no spell slot). Shadow Step: teleport between dim light/darkness as bonus action.', features: [
        { level: 3, name: 'Shadow Arts', description: 'Spend 2 ki to cast Darkness, Darkvision, Pass without Trace, or Silence (no spell slot, no concentration for Darkness). You can also see in dim light and darkness as if in bright light.' },
        { level: 6, name: 'Shadow Step', description: 'When in dim light or darkness, bonus action to teleport up to 60ft to another dim or dark unoccupied space you can see. You then have advantage on the first melee attack you make before end of your next turn.' },
        { level: 11, name: 'Cloak of Shadows', description: 'When in dim light or darkness, use an action to become invisible. Lasts until you attack, cast a spell, or are in bright light.' },
        { level: 17, name: 'Opportunist', description: 'Whenever a creature within 5ft is hit by an attack made by someone other than you, use your reaction to make a melee attack against that creature.' },
      ] },
      { slug: 'four-elements', name: 'Way of the Four Elements', level: 3, description: 'Elemental Disciplines: spend ki to replicate spells (Burning Hands, Thunderwave, Water Whip, etc.). Choose 2 disciplines at L3, more at higher levels.', features: [
        { level: 3, name: 'Disciple of the Elements', description: 'Learn 2 Elemental Disciplines (more at L6, L11, L17). Each discipline lets you spend ki to cast a spell or special effect: Water Whip (2ki, 30ft whip 3d10+WIS bludgeoning, STR save or prone/pulled), Sweeping Cinder Strike (2ki = Burning Hands), Rush of Gale Spirits (2ki = Thunderwave), Fist of Four Thunders (2ki = Thunderwave), Fist of Unbroken Air (2ki = 3d10 bludgeoning + pushed 20ft), Shape the Flowing River (1ki = water/ice manipulation), and others. Higher level disciplines require higher ki costs.' },
        { level: 6, name: 'Additional Disciplines', description: 'Learn 1 additional Elemental Discipline. Now know 3 disciplines total.' },
        { level: 11, name: 'Additional Disciplines', description: 'Learn 1 additional Elemental Discipline. Now know 4 disciplines total. Disciplines of 3rd-level spells are available.' },
        { level: 17, name: 'Additional Disciplines', description: 'Learn 1 additional Elemental Discipline. Now know 5 disciplines total. Disciplines of up to 4th-level spells are available.' },
      ] },
      { slug: 'mercy', name: 'Way of Mercy', level: 3, description: 'Implements of Mercy: Medicine proficiency, Herbalism kit. Hand of Healing: spend 1 ki to heal 1d6+WIS on a Flurry of Blows hit. Hand of Harm: spend 1 ki to deal extra necrotic (1d6+WIS).', features: [
        { level: 3, name: 'Implements of Mercy', description: 'Gain proficiency in Insight and Medicine. Gain proficiency with the Herbalism Kit. Gain a mask associated with your practice.' },
        { level: 3, name: 'Hand of Healing', description: 'As part of a Flurry of Blows hit, spend 1 ki to heal the target 1d6 + WIS modifier HP instead of dealing damage.' },
        { level: 3, name: 'Hand of Harm', description: 'Once per turn when you hit with an unarmed strike, spend 1 ki to deal extra necrotic damage equal to 1d6 + WIS modifier. The target is also poisoned until start of your next turn (CON save negates the poison, DC = spell save DC).' },
        { level: 6, name: 'Physician\'s Touch', description: 'Hand of Healing also ends one disease or condition (blinded, deafened, paralyzed, poisoned, or stunned) on the target. Hand of Harm can also apply the poisoned condition without the ki cost.' },
        { level: 11, name: 'Flurry of Healing and Harm', description: 'Use Hand of Healing with each Flurry of Blows hit, with no extra ki cost. Also, on a Flurry of Blows hit, you can cast Raise Dead (no materials) by spending 6 ki — only once per long rest.' },
        { level: 17, name: 'Hand of Ultimate Mercy', description: 'Spend 5 ki to cast Raise Dead without material components. A creature you touch and spend ki on returns to 1 HP. 1 use per long rest.' },
      ] },
      { slug: 'astral-self', name: 'Way of the Astral Self', level: 3, description: 'Arms of the Astral Self: spend 1 ki to manifest spectral arms (reach, use WIS for attacks, extra damage). Visage of the Astral Self (L6): darkvision 120ft, impose disadvantage on perception vs you.', features: [
        { level: 3, name: 'Arms of the Astral Self', description: 'Spend 1 ki (bonus action): manifest spectral arms for 10 minutes. Each arm has 10ft reach. Use WIS (instead of STR/DEX) for attacks; deal 1d10 force damage (replace unarmed strike damage). Also: bonus action to make 2 unarmed attacks using the arms (uses WIS); add WIS mod to unarmed strike damage.' },
        { level: 6, name: 'Visage of the Astral Self', description: 'Spend 1 ki (bonus action): manifest a spectral visage for 10 minutes. Darkvision 120ft. Impose disadvantage on Deception and Stealth checks against you. When you speak, creatures within 30ft that can see you must succeed on a CHA save or be frightened until end of their next turn.' },
        { level: 11, name: 'Body of the Astral Self', description: 'Manifest spectral torso/legs. When Arms of the Astral Self are active, you have resistance to bludgeoning, piercing, and slashing damage. When you\'re hit by an attack, use reaction to deal force damage equal to WIS modifier.' },
        { level: 17, name: 'Awakened Astral Self', description: 'If Arms and Visage are active together, spend 5 ki to awaken full astral form for 10 min. Each turn, gain 2 extra attacks with the arms. Also: gain +2 AC and force damage from arms increases to 2d10.' },
      ] },
      { slug: 'drunken-master', name: 'Way of the Drunken Master', level: 3, grantedProficiencies: { skills: ['performance'], tools: ['Brewer\'s Supplies'] }, description: 'Bonus proficiency in Performance and Brewer\'s Supplies. Drunken Technique: Flurry of Blows includes free Disengage; move 10ft when an enemy misses you.', features: [
        { level: 3, name: 'Bonus Proficiencies', description: 'You gain proficiency with the Performance skill and Brewer\'s Supplies if you don\'t already have them.' },
        { level: 3, name: 'Drunken Technique', description: 'When you use Flurry of Blows, you gain the benefit of the Disengage action and your walking speed increases by 10ft until end of your turn.' },
        { level: 6, name: 'Tipsy Sway', description: 'Leap to Your Feet: you can stand from prone by spending 5ft of movement instead of half your speed. Redirect Attack: when a melee attack misses you, spend 1 ki as a reaction — redirect the attack to a different target within 5ft (attacker must reroll against the new target).' },
        { level: 11, name: 'Drunkard\'s Luck', description: 'You always seem to get a lucky bounce at the right moment. When you make an ability check, attack roll, or saving throw and have disadvantage, spend 2 ki to cancel the disadvantage.' },
        { level: 17, name: 'Intoxicated Frenzy', description: 'When you use Flurry of Blows, you can make up to 3 additional attacks with it (for a total of 5 Flurry strikes), provided each Flurry strike targets a different creature.' },
      ] },
      { slug: 'kensei', name: 'Way of the Kensei', level: 3, description: 'Kensei weapons: 3 weapons become monk weapons. Agile Parry: +2 AC if you make an unarmed strike this turn. Kensei\'s Shot: ranged kensei weapon attacks deal +1d4.', features: [
        { level: 3, name: 'Path of the Kensei', description: 'Choose 3 weapons as your kensei weapons (at least 1 melee, 1 ranged). Kensei weapons are monk weapons for you. Agile Parry: if you hold a kensei weapon but don\'t use it to attack this turn, +2 AC until start of next turn after an unarmed strike. Kensei\'s Shot: bonus action — ranged kensei attack deals +1d4 damage on a hit this turn.' },
        { level: 6, name: 'One with the Blade', description: 'Magic Kensei Weapons: your attacks with kensei weapons count as magical. Deft Strike: spend 1 ki when you hit with a kensei weapon — deal extra damage equal to your Martial Arts die.' },
        { level: 11, name: 'Sharpen the Blade', description: 'Bonus action: grant your kensei weapon a bonus to attack and damage rolls of +1, +2, or +3 by spending 1, 2, or 3 ki points. Effect lasts 1 minute. Does not stack with existing magic bonuses.' },
        { level: 17, name: 'Unerring Accuracy', description: 'Once per turn when you miss with a monk weapon attack, you can reroll the attack roll and use the new result.' },
      ] },
      { slug: 'sun-soul', name: 'Way of the Sun Soul', level: 3, description: 'Radiant Sun Bolt: ranged spell attack (30ft, DEX vs spell save DC, 1d6 radiant). Spend ki for extra bolts. Searing Arc Strike: cast Burning Hands after Flurry of Blows.', features: [
        { level: 3, name: 'Radiant Sun Bolt', description: 'Ranged spell attack (30ft range) as part of your Attack action — deals 1d6 radiant damage on a hit. You can replace any of your attacks with this. For 1 ki you can make two additional Radiant Sun Bolt attacks as a bonus action.' },
        { level: 3, name: 'Searing Arc Strike', description: 'After Flurry of Blows, you can spend 2–5 ki to cast Burning Hands (2 ki = 1st level slot; each extra ki = +1 level, up to 5th).' },
        { level: 6, name: 'Searing Sunburst', description: 'Action: project a magical orb at a point within 150ft — all creatures in a 20ft-radius sphere make CON save (DC 8+PB+WIS) or take 2d6 radiant damage. You can spend 1–3 ki to add 2d6 per ki point to the damage.' },
        { level: 11, name: 'Sun Shield', description: 'You shed bright light 30ft (dim light +30ft). You can extinguish or rekindle this light as a bonus action. Reaction: when a creature hits you with a melee attack, deal 5 + WIS modifier radiant damage to the attacker.' },
        { level: 17, name: 'Radiant Barrage', description: 'When you use Radiant Sun Bolt and hit, deal an extra 1d6 radiant damage. In addition, each time you use Searing Arc Strike or Searing Sunburst, targets that fail their save are blinded until the start of your next turn.' },
      ] },
    ],
    features: [
      { level: 1, name: 'Unarmored Defense', description: 'AC = 10 + DEX mod + WIS mod when not wearing armor or using a shield.' },
      { level: 1, name: 'Martial Arts', description: 'Use DEX instead of STR for monk weapon/unarmed attacks. Unarmed strikes deal 1d4 (L1-4), 1d6 (L5-10), 1d8 (L11-16), 1d10 (L17+). Bonus unarmed strike after weapon attack.' },
      { level: 2, name: 'Ki', description: 'Ki points = Monk level. Flurry of Blows (2 bonus unarmed strikes, 1ki), Patient Defense (Dodge as bonus action, 1ki), Step of the Wind (Dash/Disengage as bonus action, 1ki). Recharge on SR.' },
      { level: 2, name: 'Unarmored Movement', description: '+10ft movement speed when not wearing armor (+15ft L6, +20ft L10, +25ft L14, +30ft L18).' },
      { level: 3, name: 'Monastic Tradition', description: 'Choose your Monk subclass.' },
      { level: 3, name: 'Deflect Missiles', description: 'Reaction: reduce ranged weapon attack damage by 1d10 + DEX + Monk level. If reduced to 0, catch the projectile and throw it back (1 ki): ranged attack, 1d6 + DEX damage.' },
      { level: 4, name: 'Ability Score Improvement', description: '+2 to one ability score or +1 to two (max 20), or choose a feat.' },
      { level: 4, name: 'Slow Fall', description: 'Reaction: reduce falling damage by 5 × Monk level.' },
      { level: 5, name: 'Extra Attack', description: 'Attack twice per Attack action.' },
      { level: 5, name: 'Stunning Strike', description: 'Spend 1 ki after hitting with a melee attack — target must CON save (DC 8 + PB + WIS) or be Stunned until end of your next turn.' },
      { level: 6, name: 'Ki-Empowered Strikes', description: 'Unarmed strikes count as magical for overcoming resistance and immunity to non-magical damage.' },
      { level: 6, name: 'Subclass Feature', description: 'Your Monastic Tradition grants an additional feature.' },
      { level: 7, name: 'Evasion', description: 'When you succeed on a DEX save against a damaging effect, you take no damage (half on a failure).' },
      { level: 7, name: 'Stillness of Mind', description: 'Action: end one charmed or frightened condition on yourself.' },
      { level: 8, name: 'Ability Score Improvement', description: '+2 to one ability score or +1 to two (max 20), or choose a feat.' },
      { level: 9, name: 'Unarmored Movement Improvement', description: 'Can move along vertical surfaces and across liquids on your turn without falling.' },
      { level: 10, name: 'Purity of Body', description: 'Immune to disease and poison.' },
      { level: 11, name: 'Subclass Feature', description: 'Your Monastic Tradition grants an additional feature.' },
      { level: 12, name: 'Ability Score Improvement', description: '+2 to one ability score or +1 to two (max 20), or choose a feat.' },
      { level: 13, name: 'Tongue of the Sun and Moon', description: 'Understand any spoken language. Any creature that understands a language can understand what you say.' },
      { level: 14, name: 'Diamond Soul', description: 'Proficient in all saving throws. Spend 1 ki to reroll any failed saving throw.' },
      { level: 15, name: 'Timeless Body', description: 'No longer suffer the effects of aging, can\'t be aged magically. Still die of old age. No need for food or water.' },
      { level: 16, name: 'Ability Score Improvement', description: '+2 to one ability score or +1 to two (max 20), or choose a feat.' },
      { level: 17, name: 'Subclass Feature', description: 'Your Monastic Tradition grants an additional feature.' },
      { level: 18, name: 'Empty Body', description: 'Spend 4 ki: become invisible for 1 min + resistance to all damage except force. Spend 8 ki: Astral Projection (as the spell).' },
      { level: 19, name: 'Ability Score Improvement', description: '+2 to one ability score or +1 to two (max 20), or choose a feat.' },
      { level: 20, name: 'Perfect Self', description: 'If you have no ki points at the start of combat, you regain 4 ki.' },
    ],
  },

  paladin: {
    hitDie: 10,
    primaryAbility: 'Strength & Charisma',
    savingThrows: ['Wisdom', 'Charisma'],
    armorTraining: 'All armor and shields',
    weaponTraining: 'Simple and martial weapons',
    skillChoices: ['Athletics', 'Insight', 'Intimidation', 'Medicine', 'Persuasion', 'Religion'],
    numSkillChoices: 2,
    fightingStyles: PALADIN_STYLES,
    preparedCaster: true,
    subclasses: [
      { slug: 'devotion', name: 'Oath of Devotion', level: 3, grantedSpells: [
        gs(3,1,'Protection from Evil and Good'), gs(3,1,'Sanctuary'), gs(5,2,'Lesser Restoration'), gs(5,2,'Zone of Truth'),
        gs(9,3,'Beacon of Hope'), gs(9,3,'Dispel Magic'), gs(13,4,'Freedom of Movement'), gs(13,4,'Guardian of Faith'),
        gs(17,5,'Commune'), gs(17,5,'Flame Strike'),
      ], description: 'Sacred Weapon (Channel Divinity: +CHA to weapon attacks 1 min), Turn the Unholy, Divine Health (immune disease), Aura of Devotion (immune charmed while aura active).', features: [
        { level: 3, name: 'Sacred Weapon', description: 'Channel Divinity: as an action, imbue one weapon with positive energy. For 1 minute, add CHA modifier to attack rolls with it, and it emits bright light (20ft) and dim light (20ft more). Not consumed on a miss.' },
        { level: 3, name: 'Turn the Unholy', description: 'Channel Divinity: as an action, turn fiends and undead within 30ft (WIS save or turned 1 min; save again each turn to end).' },
        { level: 7, name: 'Aura of Devotion', description: 'You and friendly creatures within 10ft (30ft at L18) can\'t be charmed while you are conscious.' },
        { level: 15, name: 'Purity of Spirit', description: 'Always under the effects of Protection from Evil and Good.' },
        { level: 20, name: 'Holy Nimbus', description: 'As an action, aura of sunlight (30ft radius, 1 hr, 1/LR). In the aura, dim light becomes bright light; fiends and undead that start their turn there take 10 radiant damage; advantage on saves against fiend/undead spells and magic.' },
      ] },
      { slug: 'ancients', name: 'Oath of the Ancients', level: 3, grantedSpells: [
        gs(3,1,'Ensnaring Strike'), gs(3,1,'Speak with Animals'), gs(5,2,'Moonbeam'), gs(5,2,'Misty Step'),
        gs(9,3,'Plant Growth'), gs(9,3,'Protection from Energy'), gs(13,4,'Ice Storm'), gs(13,4,'Stoneskin'),
        gs(17,5,'Commune with Nature'), gs(17,5,'Tree Stride'),
      ], description: 'Nature\'s Wrath (Channel Divinity: restrain target), Turn the Faithless, Aura of Warding (resistance to spell damage). Undying Sentinel (drop to 1 HP once/LR).', features: [
        { level: 3, name: "Nature's Wrath", description: 'Channel Divinity: as an action, spectral vines restrain a creature within 10ft (STR or DEX save or restrained; save again each turn to escape).' },
        { level: 3, name: 'Turn the Faithless', description: 'Channel Divinity: as an action, turn fey and fiends within 30ft (WIS save or turned 1 min).' },
        { level: 7, name: 'Aura of Warding', description: 'You and friendly creatures within 10ft (30ft at L18) have resistance to damage from spells.' },
        { level: 15, name: 'Undying Sentinel', description: 'Once per long rest, when you are reduced to 0 HP and not killed outright, drop to 1 HP instead. You also don\'t suffer the effects of aging magically.' },
        { level: 20, name: 'Elder Champion', description: 'As an action, transform for 1 min (1/LR): regain 10 HP at start of each turn; Druid spells of 1st level or higher now need only a bonus action to cast; enemies within 10ft have disadvantage on saves against your Paladin spells and Channel Divinity.' },
      ] },
      { slug: 'vengeance', name: 'Oath of Vengeance', level: 3, grantedSpells: [
        gs(3,1,'Bane'), gs(3,1,'Hunter\'s Mark'), gs(5,2,'Hold Person'), gs(5,2,'Misty Step'),
        gs(9,3,'Haste'), gs(9,3,'Protection from Energy'), gs(13,4,'Banishment'), gs(13,4,'Dimension Door'),
        gs(17,5,'Hold Monster'), gs(17,5,'Scrying'),
      ], description: 'Vow of Enmity (Channel Divinity: advantage on all attacks vs one creature), Abjure Enemy (Channel Divinity: frighten/slow), Relentless Avenger (free move after OA).', features: [
        { level: 3, name: 'Abjure Enemy', description: 'Channel Divinity: as an action, one creature within 60ft must make WIS save or be frightened and speed halved for 1 min (fiends/undead have disadvantage). Save again each turn to end.' },
        { level: 3, name: 'Vow of Enmity', description: 'Channel Divinity: as a bonus action, gain advantage on all attack rolls against one creature within 10ft for 1 min (or until it drops to 0 HP or you are incapacitated).' },
        { level: 7, name: 'Relentless Avenger', description: 'When you hit with an opportunity attack, move up to half your speed as part of the same reaction. This movement doesn\'t provoke opportunity attacks.' },
        { level: 15, name: 'Soul of Vengeance', description: 'When a creature under Vow of Enmity makes an attack, use your reaction to make one melee weapon attack against it if it is within range.' },
        { level: 20, name: 'Avenging Angel', description: 'Assume an angelic form for 1 hour (1/LR): fly speed 60ft; aura of menace (30ft) — each hostile creature must succeed on WIS save (DC = spell save DC) or be frightened and have -4 AC and saves while frightened.' },
      ] },
      { slug: 'conquest', name: 'Oath of Conquest', level: 3, grantedSpells: [
        gs(3,1,'Armor of Agathys'), gs(3,1,'Command'), gs(5,2,'Hold Person'), gs(5,2,'Spiritual Weapon'),
        gs(9,3,'Bestow Curse'), gs(9,3,'Fear'), gs(13,4,'Dominate Beast'), gs(13,4,'Stoneskin'),
        gs(17,5,'Cloudkill'), gs(17,5,'Dominate Person'),
      ], description: 'Conquering Presence (Channel Divinity: frighten creatures in 30ft), Guided Strike, Aura of Conquest (frightened creatures take psychic damage, speed 0).', features: [
        { level: 3, name: 'Conquering Presence', description: 'Channel Divinity: as an action, frighten creatures in a 30ft cone (WIS save or frightened 1 min; save each turn to end).' },
        { level: 3, name: 'Guided Strike', description: 'Channel Divinity: when you make an attack roll, gain +10 to the roll (after seeing the d20, before learning if it hits). Same as War Domain.' },
        { level: 7, name: 'Aura of Conquest', description: 'Creatures frightened of you that start their turn within 10ft (30ft at L18) take psychic damage equal to half your Paladin level and their speed becomes 0.' },
        { level: 15, name: 'Scornful Rebuke', description: 'When a creature hits you with an attack while you are not incapacitated, it takes psychic damage equal to your CHA modifier (min 1).' },
        { level: 20, name: 'Invincible Conqueror', description: 'As an action, gain invincible form for 1 min (1/LR): resistance to all damage; make one additional attack when using Attack action; your critical hit range is 19-20.' },
      ] },
      { slug: 'redemption', name: 'Oath of Redemption', level: 3, grantedSpells: [
        gs(3,1,'Sanctuary'), gs(3,1,'Sleep'), gs(5,2,'Calm Emotions'), gs(5,2,'Hold Person'),
        gs(9,3,'Counterspell'), gs(9,3,'Hypnotic Pattern'), gs(13,4,'Otiluke\'s Resilient Sphere'), gs(13,4,'Stoneskin'),
        gs(17,5,'Hold Monster'), gs(17,5,'Wall of Force'),
      ], description: 'Emissary of Peace (+5 Persuasion), Rebuke the Violent (Channel Divinity: deal damage back to attacker), Aura of the Guardian (take damage for adjacent allies).', features: [
        { level: 3, name: 'Emissary of Peace', description: 'Gain +5 to Charisma (Persuasion) checks.' },
        { level: 3, name: 'Rebuke the Violent', description: 'Channel Divinity: when a creature within 30ft damages another creature, use your reaction to force the attacker to make a WIS save or take radiant damage equal to the damage it just dealt.' },
        { level: 7, name: 'Aura of the Guardian', description: 'When a creature within 10ft (30ft at L18) takes damage, use your reaction to take that damage instead. Damage type is unchanged.' },
        { level: 15, name: 'Protective Spirit', description: 'When in a righteous state, you are magically healed: at end of each turn where you are below half HP, regain 1d6 + half Paladin level HP (only when not incapacitated).' },
        { level: 20, name: 'Emissary of Redemption', description: 'Gain resistance to all damage dealt by creatures. When a creature damages you, it takes radiant damage equal to half the damage it dealt. If you attack a creature or force it to make a saving throw, these effects end against that creature for 24 hours.' },
      ] },
      { slug: 'glory', name: 'Oath of Glory', level: 3, grantedSpells: [
        gs(3,1,'Guiding Bolt'), gs(3,1,'Heroism'), gs(5,2,'Enhance Ability'), gs(5,2,'Magic Weapon'),
        gs(9,3,'Haste'), gs(9,3,'Protection from Energy'), gs(13,4,'Compulsion'), gs(13,4,'Freedom of Movement'),
        gs(17,5,'Legend Lore'), gs(17,5,'Yolande\'s Regal Presence'),
      ], description: 'Peerless Athlete (Channel Divinity: advantage + double jump on Athletics/Acrobatics 10 min), Aura of Alacrity (nearby allies have +10ft speed).', features: [
        { level: 3, name: 'Oath Spells', description: 'Always prepared: Guiding Bolt, Heroism (L3), Enhance Ability, Magic Weapon (L5), Haste, Protection from Energy (L9), Compulsion, Freedom of Movement (L13), Legend Lore, Youthful Rejuvenation (L17).' },
        { level: 3, name: 'Peerless Athlete', description: 'Channel Divinity: as a bonus action, for 1 hour you have advantage on Athletics and Acrobatics checks, can carry/push/pull twice the normal load, and your jump distance is doubled.' },
        { level: 3, name: 'Inspiring Smite', description: 'Channel Divinity: immediately after Divine Smite, distribute temp HP equal to 2d8 + Paladin level among creatures within 30ft (including yourself).' },
        { level: 7, name: 'Aura of Alacrity', description: 'Your walking speed increases by 10ft. While you are conscious, friendly creatures within 5ft (L18: 10ft) have their walking speed increased by 10ft as well.' },
        { level: 15, name: 'Glorious Defense', description: 'Reaction: when you or another creature in your aura is hit by an attack, add your CHA modifier to AC for that attack (potentially turning it into a miss). If it misses because of this, make one weapon attack against the attacker. CHA modifier uses per long rest.' },
        { level: 20, name: 'Living Legend', description: 'Bonus action: for 1 minute — you are blessed with otherworldly comeliness; advantage on CHA checks; once per turn when you miss an attack, you can make it a hit instead; if you fail a saving throw, use reaction to reroll and must use the new roll. 1 use per long rest.' },
      ] },
      { slug: 'watchers', name: 'Oath of the Watchers', level: 3, grantedSpells: [
        gs(3,1,'Alarm'), gs(3,1,'Detect Magic'), gs(5,2,'Moonbeam'), gs(5,2,'See Invisibility'),
        gs(9,3,'Counterspell'), gs(9,3,'Nondetection'), gs(13,4,'Aura of Purity'), gs(13,4,'Banishment'),
        gs(17,5,'Hold Monster'), gs(17,5,'Scrying'),
      ], description: 'Watcher\'s Will (Channel Divinity: advantage on all saves for 1 min), Abjure the Extraplanar, Aura of the Sentinel (+PB to initiative for nearby allies).', features: [
        { level: 3, name: 'Oath Spells', description: 'Always prepared: Alarm, Detect Magic (L3), Moonbeam, See Invisibility (L5), Counterspell, Nondetection (L9), Aura of Purity, Banishment (L13), Hold Monster, Scrying (L17).' },
        { level: 3, name: 'Watcher\'s Will', description: 'Channel Divinity: choose up to 5 creatures within 30ft. For 1 minute those creatures have advantage on INT, WIS, and CHA saving throws.' },
        { level: 3, name: 'Abjure the Extraplanar', description: 'Channel Divinity: present your holy symbol and speak a prayer. Each aberration, celestial, elemental, fey, or fiend within 30ft that can hear you must make a WIS save or be turned for 1 minute or until it takes damage.' },
        { level: 7, name: 'Aura of the Sentinel', description: 'You and friendly creatures within 10ft (L18: 30ft) gain a bonus to initiative rolls equal to your PB.' },
        { level: 15, name: 'Vigilant Rebuke', description: 'Reaction: when you or a creature you can see within 30ft succeeds on an INT, WIS, or CHA save, deal 2d8+CHA force damage to the creature that forced the save.' },
        { level: 20, name: 'Mortal Bulwark', description: 'Bonus action: for 1 minute — truesight 120ft; advantage on attacks vs. aberrations, celestials, elementals, fey, and fiends; if you hit one of those creature types, you can banish it (WIS save or banished until spell ends). 1 use per long rest.' },
      ] },
      { slug: 'oathbreaker', name: 'Oathbreaker', level: 3, grantedSpells: [
        gs(3,1,'Hellish Rebuke'), gs(3,1,'Inflict Wounds'), gs(5,2,'Crown of Madness'), gs(5,2,'Darkness'),
        gs(9,3,'Animate Dead'), gs(9,3,'Bestow Curse'), gs(13,4,'Blight'), gs(13,4,'Confusion'),
        gs(17,5,'Contagion'), gs(17,5,'Dominate Person'),
      ], description: 'Channel Divinity: Dreadful Aspect (frighten) or Control Undead. Aura of Hate (+CHA to damage for self + undead/fiend allies). Supernatural Resistance (resistance to B/P/S from non-magical).', features: [
        { level: 3, name: 'Oath Spells', description: 'Always prepared: Hellish Rebuke, Inflict Wounds (L3), Crown of Madness, Darkness (L5), Animate Dead, Bestow Curse (L9), Blight, Confusion (L13), Contagion, Dominate Person (L17).' },
        { level: 3, name: 'Control Undead', description: 'Channel Divinity: target one undead within 30ft — it makes a WIS save (DC 8+PB+CHA) or is charmed by you for 24 hours. While charmed, it obeys your commands; it repeats the save if it takes damage from you or your allies.' },
        { level: 3, name: 'Dreadful Aspect', description: 'Channel Divinity: exude magical menace. Each creature of your choice within 30ft must make a WIS save or be frightened for 1 minute. A frightened creature repeats the save at the end of each of its turns, ending the effect on a success.' },
        { level: 7, name: 'Aura of Hate', description: 'You and friendly fiends and undead within 10ft (L18: 30ft) gain a bonus to melee weapon attack damage rolls equal to your CHA modifier (minimum +1).' },
        { level: 15, name: 'Supernatural Resistance', description: 'You gain resistance to bludgeoning, piercing, and slashing damage from nonmagical weapons.' },
        { level: 20, name: 'Dread Lord', description: 'As an action: 30ft aura of gloom for 1 minute. Bright light in the aura becomes dim light. Frightened enemies in the aura take 4d10 psychic damage at the start of their turns. Attack rolls against you and your allies in the aura have disadvantage. Allies in the aura make Dexterity saves with advantage. 1 use per long rest.' },
      ] },
    ],
    features: [
      { level: 1, name: 'Divine Sense', description: 'Action: detect celestials, fiends, and undead within 60ft until end of your next turn. Uses = 1 + CHA mod per long rest.' },
      { level: 1, name: 'Lay on Hands', description: 'Pool of HP = 5 × Paladin level. Spend 1 point to restore 1 HP, or 5 points to cure one disease or poison. Recharges on long rest.' },
      { level: 2, name: 'Fighting Style', description: 'Choose a fighting style.' },
      { level: 2, name: 'Spellcasting (CHA)', description: 'Prepare CHA mod + half Paladin level spells from the Paladin list each long rest. Cast using CHA.' },
      { level: 2, name: 'Divine Smite', description: 'When you hit with a melee weapon attack, spend a spell slot to deal extra radiant damage: 2d8 for a 1st-level slot +1d8 per slot level above 1st (max 5d8). +1d8 extra vs undead and fiends.' },
      { level: 3, name: 'Divine Health', description: 'Immune to disease.' },
      { level: 3, name: 'Sacred Oath', description: 'Choose your Paladin subclass. Gain Oath Spells (always prepared) and Channel Divinity powers.' },
      { level: 4, name: 'Ability Score Improvement', description: '+2 to one ability score or +1 to two (max 20), or choose a feat.' },
      { level: 5, name: 'Extra Attack', description: 'Attack twice per Attack action.' },
      { level: 6, name: 'Aura of Protection', description: 'Add your CHA modifier (min +1) to all saving throws for you and friendly creatures within 10ft (30ft at L18), as long as you are conscious.' },
      { level: 7, name: 'Aura of Courage', description: 'You and friendly creatures within 10ft (30ft at L18) can\'t be frightened while you are conscious.' },
      { level: 8, name: 'Ability Score Improvement', description: '+2 to one ability score or +1 to two (max 20), or choose a feat.' },
      { level: 9, name: 'Subclass Feature', description: 'Your Sacred Oath grants an additional feature.' },
      { level: 11, name: 'Improved Divine Smite', description: 'Whenever you hit with a melee weapon attack, deal an extra 1d8 radiant damage (in addition to any slots spent on Divine Smite).' },
      { level: 12, name: 'Ability Score Improvement', description: '+2 to one ability score or +1 to two (max 20), or choose a feat.' },
      { level: 13, name: 'Subclass Feature', description: 'Your Sacred Oath grants an additional feature.' },
      { level: 14, name: 'Cleansing Touch', description: 'Action: end one spell on yourself or a willing creature you touch. Uses = CHA mod/LR.' },
      { level: 15, name: 'Subclass Feature', description: 'Your Sacred Oath grants an additional feature.' },
      { level: 16, name: 'Ability Score Improvement', description: '+2 to one ability score or +1 to two (max 20), or choose a feat.' },
      { level: 17, name: 'Aura Expansion', description: 'Aura of Protection and Aura of Courage expand to 30ft radius.' },
      { level: 18, name: 'Aura Expansion', description: 'All Paladin auras now extend to 30ft.' },
      { level: 19, name: 'Ability Score Improvement', description: '+2 to one ability score or +1 to two (max 20), or choose a feat.' },
      { level: 20, name: 'Subclass Feature', description: 'Your Sacred Oath grants a capstone feature (Holy Nimbus, Elder Champion, Avenging Angel, etc.).' },
    ],
  },

  ranger: {
    hitDie: 10,
    primaryAbility: 'Dexterity & Wisdom',
    savingThrows: ['Strength', 'Dexterity'],
    armorTraining: 'Light & medium armor, shields',
    weaponTraining: 'Simple and martial weapons',
    skillChoices: ['Animal Handling', 'Athletics', 'Insight', 'Investigation', 'Nature', 'Perception', 'Stealth', 'Survival'],
    numSkillChoices: 3,
    fightingStyles: RANGER_STYLES,
    spellsKnownAtL1: 0,
    spellsKnownTable: [0,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11],
    subclasses: [
      { slug: 'hunter', name: 'Hunter', level: 3, description: 'Hunter\'s Prey: Colossus Slayer (+1d8 on second hit vs same target), Giant Killer (reaction attack when large+ misses you), or Horde Breaker (extra attack vs adjacent creature). Defensive Tactics at L7.', features: [
        { level: 3, name: "Hunter's Prey", description: 'Choose one: Colossus Slayer (once per turn, deal +1d8 damage when hitting a creature that is below its HP max); Giant Killer (when a Large or larger creature within 5ft misses you, use your reaction to attack it); or Horde Breaker (once per turn, after attacking one creature, make one extra attack against a different creature within 5ft of the first).' },
        { level: 7, name: 'Defensive Tactics', description: 'Choose one: Escape the Horde (OAs against you have disadvantage); Multiattack Defense (+4 AC against any subsequent attacks after being hit); or Steel Will (advantage on saves against frightened).' },
        { level: 11, name: 'Multiattack', description: 'Choose one: Volley (action: ranged attack against all creatures in a 10ft radius); or Whirlwind Attack (action: melee attack against all creatures within 5ft).' },
        { level: 15, name: 'Superior Hunter\'s Defense', description: 'Choose one: Evasion (DEX save vs damage — success = no damage, fail = half); Stand Against the Tide (when a creature misses you with melee, redirect the attack to another creature within reach); or Uncanny Dodge (reaction to halve an attack\'s damage).' },
      ] },
      { slug: 'beast-master', name: 'Beast Master', level: 3, description: 'Primal Companion: bond with a Beast of the Air, Land, or Sea. It acts on your turn. Can deliver spells. Exceptional Training: use bond action for its attacks instead.', features: [
        { level: 3, name: 'Primal Companion', description: 'Bond with a Primal Beast of the Air (flying speed 60ft, Flyby), Land (15ft burrow speed, tremorsense 30ft), or Sea (swim speed 60ft, Binding Strike). Beast uses your PB, has HP = 5 × Ranger level, and acts on your initiative. On your turn, it can take any action (no command needed). If it dies, resummon it with 8 hours of work.' },
        { level: 7, name: 'Exceptional Training', description: 'On any of your turns when your beast companion doesn\'t attack, you can use a bonus action to command it to take the Dash, Disengage, Dodge, or Help action. Its attacks count as magical.' },
        { level: 11, name: 'Bestial Fury', description: 'Your Primal Beast makes two attacks on each of its turns (instead of one).' },
        { level: 15, name: 'Share Spells', description: 'When you cast a spell targeting yourself, you can also affect your companion with the spell if it is within 30ft.' },
      ] },
      { slug: 'gloom-stalker', name: 'Gloom Stalker', level: 3, description: 'Dread Ambusher: +1d8 damage on first hit each combat + extra attack first round. Darkvision 60ft. Umbral Sight: invisible in darkness to darkvision.', features: [
        { level: 3, name: 'Dread Ambusher', description: 'You master the art of the ambush. Add your WIS modifier to initiative. During the first round of combat, make one additional weapon attack; if it hits, deal +1d8 damage.' },
        { level: 3, name: 'Umbral Sight', description: 'Gain darkvision to 60ft (or extend existing darkvision by 30ft). While in darkness, you are invisible to creatures that rely on darkvision to see you.' },
        { level: 7, name: 'Iron Mind', description: 'Gain proficiency in WIS saving throws. If already proficient, gain proficiency in INT or CHA saves instead.' },
        { level: 11, name: 'Stalker\'s Flurry', description: 'Once per turn when you miss with a weapon attack, you can immediately make another weapon attack as part of the same action.' },
        { level: 15, name: 'Shadowy Dodge', description: 'Reaction: when a creature makes an attack roll against you, impose disadvantage on that roll. Only usable when not in bright light.' },
      ] },
      { slug: 'horizon-walker', name: 'Horizon Walker', level: 3, description: 'Detect Portal, Planar Warrior (bonus action: +1d8 force damage), Misty Step 1/SR, Ethereal Step (Etherealness 1/LR).', features: [
        { level: 3, name: 'Detect Portal', description: 'As an action, detect the distance and direction of any planar portal within 1 mile. 1 use per short rest.' },
        { level: 3, name: 'Planar Warrior', description: 'Bonus action: choose a creature you can see within 30ft. Until start of your next turn, all damage you deal to that creature is force damage, and you deal +1d8 force damage (2d8 at L11) on the first hit.' },
        { level: 7, name: 'Ethereal Step', description: 'At the start of your turn, bonus action to cast Etherealness (no slot). Lasts until end of current turn. 1 use per short rest.' },
        { level: 11, name: 'Distant Strike', description: 'When you take the Attack action, you can teleport up to 10ft before each attack. If you attack two different creatures this turn, you can make one additional attack against a third creature.' },
        { level: 15, name: 'Spectral Defense', description: 'Reaction: when you take damage, gain resistance to that damage for this instance. Using this ability requires you to be aware of the attack.' },
      ] },
      { slug: 'monster-slayer', name: 'Monster Slayer', level: 3, description: 'Hunter\'s Sense (bonus action: learn immunities/resistances/vulnerabilities), Slayer\'s Prey (bonus action: +1d6 on first hit vs target each turn), Supernatural Defense (extra d6 on saves vs target).', features: [
        { level: 3, name: 'Hunter\'s Sense', description: 'Bonus action: choose one creature you can see within 60ft. You immediately learn its immunities, resistances, and vulnerabilities. WIS mod uses per long rest.' },
        { level: 3, name: 'Slayer\'s Prey', description: 'Bonus action: mark one creature you can see within 60ft. The first time you hit it each turn, deal an extra 1d6 damage. The mark ends on a short/long rest or when you use this feature again.' },
        { level: 7, name: 'Supernatural Defense', description: 'When the target of your Slayer\'s Prey forces you to make a saving throw or makes an opportunity attack against you, roll a d6 and add it to your roll or AC.' },
        { level: 11, name: 'Magic-User\'s Nemesis', description: 'Reaction: when a creature casts a spell or teleports within 60ft, you can attempt to foil it. The creature must succeed on a WIS save (DC 8+PB+WIS) or have the casting or teleportation fail. 1 use per short rest.' },
        { level: 15, name: 'Slayer\'s Counter', description: 'Reaction: when the target of your Slayer\'s Prey forces you to make a saving throw, make one weapon attack against it. If the attack hits, you automatically succeed on the saving throw, in addition to taking the attack\'s normal effects.' },
      ] },
      { slug: 'fey-wanderer', name: 'Fey Wanderer', level: 3, grantedSpells: [
        gs(3,1,'Charm Person'), gs(5,2,'Misty Step'), gs(9,3,'Dispel Magic'), gs(13,4,'Dimension Door'), gs(17,5,'Mislead'),
      ], description: 'Dreadful Strikes: +1d4 psychic on weapon attacks (once per turn). Mistwalk (Dimension Door 1/SR). Beguiling Twist: redirect charm/frightened effects on nearby allies to other creatures.', features: [
        { level: 3, name: 'Dreadful Strikes', description: 'Once per turn when you hit with a weapon, deal an extra 1d4 psychic damage. This increases to 1d6 at L11.' },
        { level: 3, name: 'Fey Wanderer Magic', description: 'Charm Person is always prepared. You also add WIS mod to CHA checks. Additional spells: Misty Step (L5), Dispel Magic (L9), Dimension Door (L13), Mislead (L17).' },
        { level: 7, name: 'Beguiling Twist', description: 'Reaction: when a creature within 120ft succeeds on a save against being charmed or frightened, choose another creature within 120ft — it must make a WIS save or become charmed or frightened (your choice) by you for 1 minute.' },
        { level: 11, name: 'Fey Reinforcements', description: 'You can cast Summon Fey (Tasha\'s) once without a spell slot, and it counts as always prepared. When cast this way, you can have it not require concentration by making it last for 1 minute. 1 free cast per long rest.' },
        { level: 15, name: 'Mistwalk', description: 'Bonus action: teleport up to 30ft to an unoccupied space you can see. If you are in dim light or darkness you can teleport up to 60ft.' },
      ] },
      { slug: 'swarmkeeper', name: 'Swarmkeeper', level: 3, grantedSpells: [
        gs(3,0,'Mage Hand'), gs(5,2,'Web'), gs(9,3,'Gaseous Form'), gs(13,4,'Arcane Eye'), gs(17,5,'Insect Plague'),
      ], description: 'Gathered Swarm: once per turn, hit deals extra 1d6 damage OR move target 15ft OR move self 5ft. Writhing Tide: fly with swarm 10ft each turn. Mighty Swarm: restrain targets.', features: [
        { level: 3, name: 'Gathered Swarm', description: 'A swarm of nature spirits inhabits your space. Once per turn when you hit with an attack: choose one — deal extra 1d6 damage; move the target up to 15ft horizontally (STR save to resist); or move yourself 5ft without provoking OAs.' },
        { level: 3, name: 'Swarmkeeper Magic', description: 'Mage Hand is always prepared. Additional spells: Web (L5), Gaseous Form (L9), Arcane Eye (L13), Insect Plague (L17). When you cast Mage Hand, the hand takes the form of your swarm.' },
        { level: 7, name: 'Writhing Tide', description: 'Bonus action: your swarm carries you — gain a flying speed equal to your walking speed for 1 minute. 1 use per short rest.' },
        { level: 11, name: 'Mighty Swarm', description: 'Your Gathered Swarm is more powerful. You gain a fourth option for the Gathered Swarm feature: the target is knocked prone; and the Gathered Swarm knocking a target back 15ft now also restrains it until the start of your next turn (STR save to resist).' },
        { level: 15, name: 'Swarming Dispersal', description: 'Reaction: when you take damage, magically scatter — become invisible, teleport up to 30ft to an unoccupied space you can see, take resistance to the triggering damage. Visibility ends at the start of your next turn. WIS mod uses per long rest.' },
      ] },
    ],
    features: [
      { level: 1, name: 'Favored Enemy', description: 'Choose a creature type. Advantage on Survival checks to track it and INT checks to recall lore about it. Bonus language associated with that type. Gain an additional enemy at L6 and L14.' },
      { level: 1, name: 'Natural Explorer', description: 'Choose a favored terrain type. Double proficiency on INT/WIS checks there; can\'t be lost by non-magical means; move normally through difficult terrain there; move stealthily at normal pace; find double food; know exact location. Additional terrain at L6 and L10.' },
      { level: 2, name: 'Fighting Style', description: 'Choose a fighting style.' },
      { level: 2, name: 'Spellcasting (WIS)', description: 'Cast Ranger spells using WIS. Know a limited number of spells; start with 2 at L2.' },
      { level: 3, name: 'Primeval Awareness', description: 'Spend a spell slot to concentrate (1 min per slot level) — sense the presence (not location) of certain creature types (aberrations, celestials, dragons, elementals, fey, fiends, undead) within 1 mile.' },
      { level: 3, name: 'Ranger Archetype', description: 'Choose your Ranger subclass.' },
      { level: 4, name: 'Ability Score Improvement', description: '+2 to one ability score or +1 to two (max 20), or choose a feat.' },
      { level: 5, name: 'Extra Attack', description: 'Attack twice per Attack action.' },
      { level: 6, name: 'Favored Enemy', description: 'Choose one more favored enemy and one more associated language.' },
      { level: 6, name: 'Natural Explorer', description: 'Choose one more favored terrain.' },
      { level: 7, name: 'Subclass Feature', description: 'Your Ranger Archetype grants an additional feature.' },
      { level: 8, name: 'Ability Score Improvement', description: '+2 to one ability score or +1 to two (max 20), or choose a feat.' },
      { level: 8, name: "Land's Stride", description: 'Moving through non-magical difficult terrain costs no extra movement. Can move through non-magical plants without being slowed or taking damage. Advantage on saves vs plant-based magic.' },
      { level: 10, name: 'Natural Explorer', description: 'Choose one more favored terrain.' },
      { level: 10, name: 'Hide in Plain Sight', description: 'Spend 1 min making camouflage from natural materials. Gain +10 bonus to Stealth while motionless in natural surroundings.' },
      { level: 11, name: 'Subclass Feature', description: 'Your Ranger Archetype grants an additional feature.' },
      { level: 12, name: 'Ability Score Improvement', description: '+2 to one ability score or +1 to two (max 20), or choose a feat.' },
      { level: 14, name: 'Favored Enemy', description: 'Choose one more favored enemy.' },
      { level: 14, name: 'Vanish', description: 'Hide as a bonus action. You can\'t be tracked by nonmagical means unless you choose to leave a trail.' },
      { level: 15, name: 'Subclass Feature', description: 'Your Ranger Archetype grants an additional feature.' },
      { level: 16, name: 'Ability Score Improvement', description: '+2 to one ability score or +1 to two (max 20), or choose a feat.' },
      { level: 18, name: 'Feral Senses', description: 'In combat, aware of any invisible creature within 30ft that isn\'t behind total cover. No attack disadvantage against invisible creatures you are aware of.' },
      { level: 19, name: 'Ability Score Improvement', description: '+2 to one ability score or +1 to two (max 20), or choose a feat.' },
      { level: 20, name: 'Foe Slayer', description: 'Once per turn, add your WIS modifier to the attack roll or damage roll of an attack against a favored enemy. Choose before the roll.' },
    ],
  },

  rogue: {
    hitDie: 8,
    primaryAbility: 'Dexterity',
    savingThrows: ['Dexterity', 'Intelligence'],
    armorTraining: 'Light armor',
    weaponTraining: 'Simple weapons; hand crossbows, longswords, rapiers, shortswords',
    toolProficiency: "Thieves' tools",
    skillChoices: ['Acrobatics', 'Athletics', 'Deception', 'Insight', 'Intimidation', 'Investigation', 'Perception', 'Performance', 'Persuasion', 'Sleight of Hand', 'Stealth'],
    numSkillChoices: 4,
    expertiseAt: [1, 6],
    expertiseCount: 2,
    subclasses: [
      { slug: 'thief', name: 'Thief', level: 3, description: 'Fast Hands: bonus action with Use Object, Sleight of Hand, Thieves\' Tools, or disabling devices. Second-Story Work: climb at full speed; running jump adds DEX mod to distance. Use Magic Device at L13.', features: [
        { level: 3, name: 'Fast Hands', description: 'You can use the bonus action granted by Cunning Action to make a Dexterity (Sleight of Hand) check, use Thieves\' Tools to disarm a trap or open a lock, or take the Use an Object action.' },
        { level: 3, name: 'Second-Story Work', description: 'Climb speed equals your walking speed. When making a running jump, add your DEX modifier to the distance (in feet).' },
        { level: 9, name: 'Supreme Sneak', description: 'Advantage on Dexterity (Stealth) checks while moving at half your speed or less.' },
        { level: 13, name: 'Use Magic Device', description: 'Ignore class, race, and level requirements on magic item usage.' },
        { level: 17, name: 'Thief\'s Reflexes', description: 'Take two turns during the first round of any combat. Take your first turn at your initiative and your second turn at initiative minus 10.' },
      ] },
      { slug: 'assassin', name: 'Assassin', level: 3, grantedProficiencies: { tools: ['Disguise Kit', 'Poisoner\'s Kit'] }, description: 'Assassinate: advantage on attacks vs creatures that haven\'t acted; auto-crit on surprised creatures. Infiltration Expertise: create false identities. Impostor: perfectly mimic another person.', features: [
        { level: 3, name: 'Bonus Proficiencies', description: 'Gain proficiency with the disguise kit and the poisoner\'s kit.' },
        { level: 3, name: 'Assassinate', description: 'Advantage on attack rolls against creatures that haven\'t taken a turn yet in combat. Any hit against a surprised creature is a critical hit.' },
        { level: 9, name: 'Infiltration Expertise', description: 'Spend 7 days and 25gp creating a false identity with forged documents, established contacts, and a disguise. You can\'t establish an identity for a real person.' },
        { level: 13, name: 'Impostor', description: 'Study a humanoid for 3 hours to perfectly mimic their speech, mannerisms, and actions. A creature that knows the target suspects nothing unless you make a mistake. Insight check (DC 16) to detect the deception.' },
        { level: 17, name: 'Death Strike', description: 'When you attack and hit a creature during the first round of combat while it is surprised, it must make a CON save (DC 8+PB+DEX) or take double damage from the hit.' },
      ] },
      { slug: 'arcane-trickster', name: 'Arcane Trickster', level: 3, description: 'Spellcasting (INT, Enchantment & Illusion). Mage Hand Legerdemain: bonus action to control Mage Hand for pickpocketing, device use, stashing items. Magical Ambush: targets have disadvantage on saves vs your spells if you are hidden.', features: [
        { level: 3, name: 'Spellcasting (INT)', description: 'Cast spells from the Arcane Trickster list (primarily Enchantment and Illusion). Spells known scale from 3 (L3) to 13 (L20). Use INT for spellcasting.' },
        { level: 3, name: 'Mage Hand Legerdemain', description: 'When you cast Mage Hand, you can make it invisible. As a bonus action, use the hand to stow/retrieve items, pick locks with Thieves\' Tools, pick pockets — all contested by the target\'s Perception vs your Sleight of Hand (with DEX + PB).' },
        { level: 9, name: 'Magical Ambush', description: 'If you are hidden when you cast a spell, the target has disadvantage on any saving throw against it this turn.' },
        { level: 13, name: 'Versatile Trickster', description: 'As a bonus action, use Mage Hand to distract a creature within 5ft of the hand. You have advantage on attack rolls against that creature until end of current turn.' },
        { level: 17, name: 'Spell Thief', description: 'Immediately after a creature casts a spell that targets you or includes you in its area, use your reaction to force the creature to make a saving throw (spell save DC). On a failure, you negate the spell\'s effect on you and steal the knowledge of the spell (INT mod + PB or higher) for 8 hours. The creature can\'t cast it during that time.' },
      ] },
      { slug: 'inquisitive', name: 'Inquisitive', level: 3, description: 'Ear for Deceit: treat 7 or lower as 8 on Insight for detecting lies. Eye for Detail: bonus action Perception/Investigation. Insightful Fighting: bonus action Insight vs target for Sneak Attack without needing ally.', features: [
        { level: 3, name: 'Ear for Deceit', description: 'When making a WIS (Insight) check to determine if a creature is lying, treat any roll of 7 or lower as an 8.' },
        { level: 3, name: 'Eye for Detail', description: 'As a bonus action, make a WIS (Perception) check to spot a hidden creature or object, or an INT (Investigation) check to uncover or decipher clues.' },
        { level: 3, name: 'Insightful Fighting', description: 'As a bonus action, make a WIS (Insight) check against a creature\'s CHA (Deception) check. On success, you can use Sneak Attack against that creature even without an ally nearby. This lasts 1 minute or until you successfully use Insightful Fighting against a different creature.' },
        { level: 9, name: 'Steady Eye', description: 'Advantage on Perception and Investigation checks when you move no more than half your speed this turn.' },
        { level: 13, name: 'Unerring Eye', description: 'As an action (WIS mod uses per long rest), sense magical deceptions: reveal illusions, shapechanged creatures, and other magical obfuscations within 30ft.' },
        { level: 17, name: 'Eye for Weakness', description: 'While Insightful Fighting is active, add 3d6 to Sneak Attack damage against the target.' },
      ] },
      { slug: 'mastermind', name: 'Mastermind', level: 3, grantedProficiencies: { tools: ['Disguise Kit', 'Forgery Kit'] }, description: 'Master of Intrigue: disguise self, forge documents, mimic speech. Master of Tactics: Help as bonus action from 30ft away. Misdirection: redirect enemy\'s Perception check to nearby ally.', features: [
        { level: 3, name: 'Master of Intrigue', description: 'Gain proficiency with the disguise kit, the forgery kit, and two gaming sets. You can unerringly mimic the accent and mannerisms of another language speaker if you have heard them speak for 1 minute.' },
        { level: 3, name: 'Master of Tactics', description: 'You can use the Help action as a bonus action. Additionally, you can use the Help action to aid an ally in attacking a creature even if the ally and the creature are up to 30ft from you.' },
        { level: 9, name: 'Insightful Manipulator', description: 'Spend 1 minute observing a creature to learn two of: STR/DEX/CON/INT comparison to you, class levels (if any), potential vulnerabilities. The DM chooses which two to reveal.' },
        { level: 13, name: 'Misdirection', description: 'As a bonus action, redirect a creature\'s attention: the creature\'s next Perception check that would notice you is made against a willing creature within 5ft of you instead.' },
        { level: 17, name: 'Soul of Deceit', description: 'Your thoughts cannot be read by magic unless you wish it. Any attempt to determine if you are lying automatically indicates you are telling the truth. If you fail a CHA (Deception) check, you can treat the result as 8 + your CHA modifier + your proficiency bonus.' },
      ] },
      { slug: 'scout', name: 'Scout', level: 3, description: 'Skirmisher: reaction to move half speed without OA when enemy ends turn adjacent. Survivalist: double proficiency in Nature and Survival. Superior Mobility (+10ft speed at L9), Ambush Master.', features: [
        { level: 3, name: 'Skirmisher', description: 'When an enemy ends its turn within 5ft of you, use your reaction to move up to half your speed without provoking opportunity attacks.' },
        { level: 3, name: 'Survivalist', description: 'Gain proficiency in Nature and Survival. Your proficiency bonus is doubled for these skills.' },
        { level: 9, name: 'Superior Mobility', description: 'Your walking, climbing, and swimming speeds increase by 10ft.' },
        { level: 13, name: 'Ambush Master', description: 'Gain advantage on initiative rolls. Additionally, the first creature you hit during the first round of combat becomes easier for your allies to strike: each ally who attacks that creature before your next turn has advantage on their first attack roll against it.' },
        { level: 17, name: 'Sudden Strike', description: 'When you take the Attack action, you can make one additional attack as a bonus action. This attack can benefit from Sneak Attack even if you already used it this turn, but only if the bonus attack targets a different creature.' },
      ] },
      { slug: 'soulknife', name: 'Soulknife', level: 3, description: 'Psionic Energy Dice (2 per SR, = proficiency bonus). Psionic Blade: manifest 2 blades (1d6 psychic). Psychic Whispers: telepathy. Rend Mind: stun with sneak attack.', features: [
        { level: 3, name: 'Psionic Energy Dice', description: 'You have a number of Psionic Energy dice equal to twice your PB (d6, scaling to d8/d10/d12). You regain one expended die when you roll initiative or finish a short rest; all dice on a long rest.' },
        { level: 3, name: 'Psychic Blades', description: 'Bonus action (or free as part of Attack action): manifest two spectral blades — one in each hand. They disappear immediately after you attack with them. Melee or ranged (60ft) finesse weapon (1d6 main hand, 1d4 off-hand), no ammunition needed, no magic bonus by default.' },
        { level: 3, name: 'Soul Blades', description: 'Homing Strikes: when you miss with a Psychic Blade, expend one Psionic Energy die to reroll — add the number rolled to the attack roll. Psychic Teleportation: bonus action — expend a Psionic die and throw a blade to a surface within 10× rolled feet; teleport to an unoccupied space within 1ft of that surface.' },
        { level: 9, name: 'Psychic Veil', description: 'Cast Invisibility on yourself without a slot. 1 use per long rest (or end early as a bonus action).' },
        { level: 13, name: 'Rend Mind', description: 'When you deal Sneak Attack damage with a Psychic Blade, you can expend three Psionic Energy dice (no action), forcing the target to make a WIS save (DC 8+PB+INT) or be stunned until the end of your next turn. Once used, requires a short/long rest unless you expend a Psionic die again.' },
        { level: 17, name: 'Psychic Blades Mastery', description: 'When using the Attack action to attack with your Psychic Blade, make the attack roll with advantage. Additionally, you can use Psychic Teleportation twice per bonus action (throwing two blades in succession).' },
      ] },
      { slug: 'swashbuckler', name: 'Swashbuckler', level: 3, description: 'Fancy Footwork: no OA from creature you attack. Rakish Audacity: Sneak Attack if only you and target are adjacent (no ally needed); add CHA to initiative.', features: [
        { level: 3, name: 'Fancy Footwork', description: 'When you make a melee attack against a creature during your turn, that creature cannot make opportunity attacks against you for the rest of your turn.' },
        { level: 3, name: 'Rakish Audacity', description: 'Add CHA modifier to initiative. You can apply Sneak Attack when you are within 5ft of the target, no ally required — as long as no other creature is within 5ft of you.' },
        { level: 9, name: 'Panache', description: 'Bonus action: make a CHA (Persuasion) check against a creature within 60ft. If you win (vs. target\'s WIS passive): if hostile, it has disadvantage on attacks against creatures other than you and can\'t make OAs against them (1 min or until threatened by another creature); if non-hostile, it is charmed by you (1 min).' },
        { level: 13, name: 'Elegant Maneuver', description: 'On your turn, use a bonus action to gain advantage on your next Acrobatics or Athletics check.' },
        { level: 17, name: 'Master Duelist', description: 'When you roll an attack and miss, you can reroll it with advantage. Once used, requires a short/long rest.' },
      ] },
      { slug: 'phantom', name: 'Phantom', level: 3, description: 'Whispers of the Dead: gain a random skill/tool between rests. Wails from the Grave: expend Sneak Attack dice to deal necrotic to a second creature. Tokens of the Departed: take a soul trinket from a dying creature.', features: [
        { level: 3, name: 'Whispers of the Dead', description: 'When you finish a short or long rest, you can gain one skill or tool proficiency of your choice from a nearby corpse or spirit. You lose the previous proficiency from this feature.' },
        { level: 3, name: 'Wails from the Grave', description: 'Immediately after Sneak Attack damage, you can expend half your Sneak Attack dice (rounded up) to deal necrotic damage equal to those dice to a second creature within 30ft of the first. WIS mod uses per long rest.' },
        { level: 9, name: 'Tokens of the Departed', description: 'Reaction: when a creature you can see dies within 30ft, you can take a soul trinket — a Tiny object that appears in your hand. You can have a number of trinkets equal to your PB. While holding a trinket: advantage on death saves, can ask it one question (creature answers once). Destroying a trinket gives one usage of Wails from the Grave.' },
        { level: 13, name: 'Ghost Walk', description: 'Bonus action: assume a ghostly form for 10 minutes. In this form: ignore difficult terrain, pass through creatures/objects (takes 1d10 force if inside object at turn end), resistance to B/P/S damage, and fly 10ft. 1 use per long rest (or destroy a soul trinket).' },
        { level: 17, name: 'Death\'s Friend', description: 'Wails from the Grave can now affect a second creature with your full Sneak Attack dice (not halved). If you begin your turn with no soul trinkets, one appears in your hand.' },
      ] },
    ],
    features: [
      { level: 1, name: 'Expertise', description: 'Choose 2 proficient skills (or Thieves\' Tools + 1 skill). Double your proficiency bonus for those checks.' },
      { level: 1, name: 'Sneak Attack', description: 'Once per turn, deal extra damage when you have advantage on the attack OR an ally is within 5ft of the target (no disadvantage). Scales: 1d6 (L1), 2d6 (L3), 3d6 (L5), 4d6 (L7), 5d6 (L9), 6d6 (L11), 7d6 (L13), 8d6 (L15), 9d6 (L17), 10d6 (L19).' },
      { level: 1, name: "Thieves' Cant", description: 'Know the secret language used by rogues. Hidden messages in normal conversation; takes 4× longer to convey the same info, but passes unnoticed.' },
      { level: 2, name: 'Cunning Action', description: 'Bonus action every turn to Dash, Disengage, or Hide.' },
      { level: 3, name: 'Roguish Archetype', description: 'Choose your Rogue subclass.' },
      { level: 4, name: 'Ability Score Improvement', description: '+2 to one ability score or +1 to two (max 20), or choose a feat.' },
      { level: 5, name: 'Uncanny Dodge', description: 'Reaction: halve the damage of one attack that hits you (must be able to see the attacker).' },
      { level: 6, name: 'Expertise', description: 'Gain Expertise in 2 more proficient skills.' },
      { level: 7, name: 'Evasion', description: 'When you succeed on a DEX saving throw against a damage-dealing effect, take 0 damage (half on failure).' },
      { level: 8, name: 'Ability Score Improvement', description: '+2 to one ability score or +1 to two (max 20), or choose a feat.' },
      { level: 9, name: 'Subclass Feature', description: 'Your Roguish Archetype grants an additional feature.' },
      { level: 10, name: 'Ability Score Improvement', description: '+2 to one ability score or +1 to two (max 20), or choose a feat.' },
      { level: 11, name: 'Reliable Talent', description: 'Whenever you make an ability check with a skill or tool you are proficient in, treat any roll of 9 or lower as a 10.' },
      { level: 12, name: 'Ability Score Improvement', description: '+2 to one ability score or +1 to two (max 20), or choose a feat.' },
      { level: 13, name: 'Subclass Feature', description: 'Your Roguish Archetype grants an additional feature.' },
      { level: 14, name: 'Blindsense', description: 'If you can hear, you are aware of the location of any hidden or invisible creature within 10ft.' },
      { level: 15, name: 'Slippery Mind', description: 'Gain proficiency in WIS saving throws.' },
      { level: 16, name: 'Ability Score Improvement', description: '+2 to one ability score or +1 to two (max 20), or choose a feat.' },
      { level: 17, name: 'Subclass Feature', description: 'Your Roguish Archetype grants an additional feature.' },
      { level: 18, name: 'Elusive', description: 'No attack roll has advantage against you while you are not incapacitated.' },
      { level: 19, name: 'Ability Score Improvement', description: '+2 to one ability score or +1 to two (max 20), or choose a feat.' },
      { level: 20, name: 'Stroke of Luck', description: 'If your attack misses, you can turn it into a hit. Or if you fail an ability check, treat the d20 roll as a 20. 1 use per short or long rest.' },
    ],
  },

  sorcerer: {
    hitDie: 6,
    primaryAbility: 'Charisma',
    savingThrows: ['Constitution', 'Charisma'],
    armorTraining: 'None',
    weaponTraining: 'Daggers, darts, slings, quarterstaffs, light crossbows',
    skillChoices: ['Arcana', 'Deception', 'Insight', 'Intimidation', 'Persuasion', 'Religion'],
    numSkillChoices: 2,
    cantripsKnown: 4,
    cantripsAtLevel: [4, 10],
    spellsKnownAtL1: 2,
    spellsKnownTable: [2,3,4,5,6,7,8,9,10,11,12,12,13,13,14,14,15,15,15,15],
    metamagicAtLevel:  [0,0,2,2,2,2,2,2,2,3,3,3,3,3,3,3,4,4,4,4],
    subclasses: [
      { slug: 'draconic', name: 'Draconic Bloodline', level: 1, description: 'Draconic Resilience: +1 HP/level, AC 13+DEX when unarmored. Elemental Affinity (L6): +CHA to damage of spells matching ancestry; resistance to that type. Dragon Wings (L14). Draconic Presence (L18).', features: [
        { level: 1, name: 'Dragon Ancestor', description: 'Choose a dragon type (Black, Blue, Brass, Bronze, Copper, Gold, Green, Red, Silver, White). You gain a language (Draconic) and advantage on CHA checks with dragons of that type.' },
        { level: 1, name: 'Draconic Resilience', description: 'Your HP maximum increases by 1 per Sorcerer level. When not wearing armor, your AC = 13 + DEX modifier.' },
        { level: 6, name: 'Elemental Affinity', description: 'When you cast a spell dealing the damage type of your ancestry, add CHA modifier to one damage roll. Spend 1 sorcery point to gain resistance to that damage type for 1 hour.' },
        { level: 14, name: 'Dragon Wings', description: 'As a bonus action, sprout dragon wings from your back (1/LR if not proficient in the Dragon Wings invocation). Gain a fly speed equal to your walking speed.' },
        { level: 18, name: 'Draconic Presence', description: 'Spend 5 sorcery points: aura of awe/fear (60ft, 1 min, concentration). Enemies that enter or start their turn in the aura make a WIS save (your spell save DC) or be charmed (awe) or frightened (fear) until the aura ends.' },
      ] },
      { slug: 'wild-magic', name: 'Wild Magic Surge', level: 1, description: 'Wild Magic Surge: DM can have you roll on the Wild Magic table after casting L1+ spell. Tides of Chaos: advantage on any roll 1/LR; DM can then force surge. Bend Luck (L6), Controlled Chaos (L14), Spell Bombardment (L18).', features: [
        { level: 1, name: 'Wild Magic Surge', description: 'After casting a 1st-level or higher spell, the DM can have you roll a d20. On a 1, roll on the Wild Magic Surge table. Results include beneficial and harmful effects (fireballs, random teleport, healing, etc.).' },
        { level: 1, name: 'Tides of Chaos', description: 'Gain advantage on one attack roll, ability check, or saving throw. 1 use per long rest. The DM can restore this use by having you roll on the Wild Magic Surge table at any point.' },
        { level: 6, name: 'Bend Luck', description: 'Spend 2 sorcery points as a reaction: add or subtract 1d4 from any creature\'s attack roll, ability check, or saving throw that you can see.' },
        { level: 14, name: 'Controlled Chaos', description: 'When you roll on the Wild Magic Surge table, roll twice and use either result.' },
        { level: 18, name: 'Spell Bombardment', description: 'Once per turn when you roll damage for a spell and any die shows the highest possible result, choose one of those dice, roll it again, and add it to the damage.' },
      ] },
      { slug: 'divine-soul', name: 'Divine Soul', level: 1, description: 'Divine Magic: choose affinity (good/evil/law/chaos/neutrality); learn Cure Wounds + bonus spell from Cleric list (counts as Sorcerer spell). Empowered Healing (L6). Angelic Form (L14).', features: [
        { level: 1, name: 'Divine Magic', description: 'Choose an affinity: Good (+Cure Wounds bonus), Evil (inflict wounds), Law (bless), Chaos (bane), or Neutral (guidance). Learn the affinity spell for free. Additionally, access the entire Cleric spell list — any Cleric spell can be your Sorcerer spell known.' },
        { level: 1, name: 'Favored by the Gods', description: 'When you fail a saving throw or miss with an attack, roll 2d4 and add it to the total, potentially changing the outcome. 1 use per short or long rest.' },
        { level: 6, name: 'Empowered Healing', description: 'When you or an ally within 5ft rolls dice to restore HP with a spell, spend 1 sorcery point as a reaction to reroll any number of those dice once, using the higher result.' },
        { level: 14, name: 'Angelic Form', description: 'Gain a pair of luminous wings as a bonus action. Fly speed = your walking speed. Wings last until you dismiss them (no action). They disappear if you wear armor that doesn\'t accommodate wings.' },
        { level: 18, name: 'Unearthly Recovery', description: 'Once per long rest as a bonus action, when below half HP, regain HP equal to half your hit point maximum.' },
      ] },
      { slug: 'shadow', name: 'Shadow Magic', level: 1, description: 'Superior Darkvision (120ft). Eyes of the Dark: cast Darkness for 2 sorcery points. Strength of the Grave (L1): when you would die, make CHA save (DC 5 + damage) to drop to 1 HP instead. Hound of Ill Omen (L6).', features: [
        { level: 1, name: 'Eyes of the Dark', description: 'Gain darkvision to 120ft. Spend 1 sorcery point to cast Darkness without concentration, using your own eyes as the center (or a willing creature/object you touch). Dispel as a bonus action.' },
        { level: 1, name: 'Strength of the Grave', description: 'When damage reduces you to 0 HP, make a CHA saving throw (DC = 5 + damage dealt). On success, drop to 1 HP instead. Doesn\'t work against radiant damage or a coup de grace. 1 use per long rest.' },
        { level: 6, name: 'Hound of Ill Omen', description: 'Spend 3 sorcery points as a bonus action to summon a shadowy hound at a creature within 120ft. It has hp = half your Sorcerer level, moves 40ft, and can\'t be damaged by non-magical attacks. While near the target, the target has disadvantage on saves against your spells and the hound can\'t be outrun unless you end concentration.' },
        { level: 14, name: 'Shadow Walk', description: 'In dim light or darkness, bonus action to teleport up to 120ft to another dim or dark unoccupied space you can see.' },
        { level: 18, name: 'Umbral Form', description: 'Spend 6 sorcery points: transform for 1 minute. Gain resistance to all damage except force and radiant; move through other creatures and objects as difficult terrain (take 5 force damage if you end your turn inside a solid object).' },
      ] },
      { slug: 'storm', name: 'Storm Sorcery', level: 1, description: 'Tempestuous Magic (L1): bonus action fly 10ft when you cast L1+ spell. Heart of the Storm (L6): resistance to lightning/thunder; creatures within 10ft take damage when you cast those spells. Storm Guide (L6). Storm\'s Fury (L14).', features: [
        { level: 1, name: 'Wind Speaker', description: 'Learn the Primordial language and its dialects (Aquan, Auran, Ignan, Terran).' },
        { level: 1, name: 'Tempestuous Magic', description: 'Immediately before or after casting a 1st-level or higher spell, use a bonus action to fly 10ft without provoking opportunity attacks.' },
        { level: 6, name: 'Heart of the Storm', description: 'Gain resistance to lightning and thunder damage. When you cast a 1st-level or higher spell that deals lightning or thunder damage, deal lightning or thunder damage (your choice) to creatures within 10ft equal to half your Sorcerer level.' },
        { level: 6, name: 'Storm Guide', description: 'Stop rain within 20ft of you as an action (until you stop). As a bonus action, choose the direction of wind in a 100ft radius around you (until your next turn).' },
        { level: 14, name: "Storm's Fury", description: 'Reaction: when hit with a melee attack, deal lightning damage equal to your Sorcerer level to the attacker. The attacker must also succeed on a STR save (your spell save DC) or be pushed up to 20ft away.' },
        { level: 18, name: 'Wind Soul', description: 'Gain immunity to lightning and thunder damage. Gain a fly speed of 60ft. As an action (30 min), grant up to 3 willing creatures within 30ft a fly speed of 30ft for 1 hour.' },
      ] },
      { slug: 'aberrant-mind', name: 'Aberrant Mind', level: 1, grantedSpells: [
        gs(1,0,'Mind Sliver'), gs(1,1,'Arms of Hadar'), gs(1,1,'Dissonant Whispers'), gs(3,2,'Calm Emotions'), gs(3,2,'Detect Thoughts'),
        gs(5,3,'Hunger of Hadar'), gs(5,3,'Sending'), gs(7,4,'Evard\'s Black Tentacles'), gs(7,4,'Summon Aberration'),
        gs(9,5,'Rary\'s Telepathic Bond'), gs(9,5,'Telekinesis'),
      ], description: 'Psionic Spells (extra spells known, swappable). Telepathic Speech (L1): telepathy within INT × 5ft. Psionic Sorcery (L6): cast aberrant spells without components by spending extra sorcery points. Psychic Defenses (L6).', features: [
        { level: 1, name: 'Psionic Spells', description: 'Always have the Mind Sliver cantrip and these spells known (they don\'t count against spells known): Arms of Hadar, Dissonant Whispers (L1); Calm Emotions, Detect Thoughts (L3); Hunger of Hadar, Sending (L5); Evard\'s Black Tentacles, Summon Aberration (L7); Rary\'s Telepathic Bond, Telekinesis (L9). Once per long rest, swap one for another spell from the Aberrant Mind list.' },
        { level: 1, name: 'Telepathic Speech', description: 'Bonus action: form a telepathic connection with a creature you can see within 30ft. You can communicate telepathically for a number of minutes equal to your Sorcerer level. Either of you can end it as a free action.' },
        { level: 6, name: 'Psionic Sorcery', description: 'When casting a Psionic Spell, spend sorcery points (equal to the spell\'s level) to cast it without verbal, somatic, or material components.' },
        { level: 6, name: 'Psychic Defenses', description: 'Gain resistance to psychic damage. Advantage on saves against being charmed or frightened.' },
        { level: 14, name: 'Revelation in Flesh', description: 'Spend 1 or more sorcery points as a bonus action (1 minute, concentration): 1pt = see invisible creatures within 60ft; 2pt = resistance to bludgeoning/piercing/slashing from nonmagical weapons; 3pt = 60ft blindsight; 4pt = 30ft fly/swim speed.' },
        { level: 18, name: 'Warping Implosion', description: 'As an action, teleport to an unoccupied space within 120ft. Each creature within 30ft of your original location must succeed on a STR save or take 3d10 force damage and be pulled 30ft toward the space you left. 1 use per long rest; spend 5 sorcery points to use again.' },
      ] },
      { slug: 'clockwork-soul', name: 'Clockwork Soul', level: 1, grantedSpells: [
        gs(1,1,'Alarm'), gs(1,1,'Protection from Evil and Good'), gs(3,2,'Aid'), gs(3,2,'Lesser Restoration'),
        gs(5,3,'Dispel Magic'), gs(5,3,'Protection from Energy'), gs(7,4,'Freedom of Movement'), gs(7,4,'Summon Construct'),
        gs(9,5,'Greater Restoration'), gs(9,5,'Wall of Force'),
      ], description: 'Clockwork Magic (extra spells, swappable). Restore Balance (L1): cancel advantage or disadvantage on a roll near you (PB/LR). Bastion of Law (L6): spend sorcery points to create damage-absorbing ward. Trance of Order (L14).', features: [
        { level: 1, name: 'Clockwork Magic', description: 'Always have these spells known (they don\'t count against spells known): Alarm, Protection from Evil and Good (L1); Aid, Lesser Restoration (L3); Dispel Magic, Protection from Energy (L5); Freedom of Movement, Summon Construct (L7); Greater Restoration, Wall of Force (L9). Can swap one per long rest for another from the Clockwork Soul list.' },
        { level: 1, name: 'Restore Balance', description: 'Reaction: when a creature you can see within 60ft is about to roll with advantage or disadvantage, cancel that advantage or disadvantage. PB uses per long rest.' },
        { level: 6, name: 'Bastion of Law', description: 'Bonus action, spend 1-5 sorcery points: a willing creature you touch gains a magical ward absorbing damage equal to 5 × points spent. The ward lasts until exhausted or until you cast this again.' },
        { level: 6, name: 'Trance of Order', description: 'Bonus action, enter a state of absolute order for 1 minute: treat rolls below 10 as 10 on attack rolls, ability checks, and saving throws. 1 use per long rest.' },
        { level: 14, name: 'Clockwork Cavalcade', description: 'As an action, call clockwork spirits in a 30ft cube. They restore up to 100 HP divided among creatures of your choice; repair all broken nonmagical objects; end each spell of 6th level or lower on objects or creatures of your choice. 1 use per long rest.' },
      ] },
    ],
    features: [
      { level: 1, name: 'Spellcasting (CHA)', description: 'Cast Sorcerer spells using CHA. Know a fixed number of spells; swap one when you level up. Spells Known: 2 (L1) scaling to 15 (L15+).' },
      { level: 1, name: 'Sorcerous Origin', description: 'Choose your Sorcerer subclass at level 1.' },
      { level: 2, name: 'Font of Magic', description: 'Sorcery Points = Sorcerer level (2 at L2 → 20 at L20). Flexible Casting: convert slots to points (slot level in points) or points to slots (1st: 2pts, 2nd: 3pts, 3rd: 5pts, 4th: 6pts, 5th: 7pts). Recharges on long rest.' },
      { level: 3, name: 'Metamagic', description: 'Choose 2 Metamagic options (3 at L10, 4 at L17). Options: Careful (allies pass saves), Distant (double range), Empowered (reroll damage dice), Extended (double duration), Heightened (disadv on save), Quickened (cast with bonus action), Subtle (no verbal/somatic), Twinned (target second creature).' },
      { level: 4, name: 'Ability Score Improvement', description: '+2 to one ability score or +1 to two (max 20), or choose a feat.' },
      { level: 6, name: 'Subclass Feature', description: 'Your Sorcerous Origin grants an additional feature.' },
      { level: 8, name: 'Ability Score Improvement', description: '+2 to one ability score or +1 to two (max 20), or choose a feat.' },
      { level: 10, name: 'Metamagic', description: 'Learn a third Metamagic option.' },
      { level: 12, name: 'Ability Score Improvement', description: '+2 to one ability score or +1 to two (max 20), or choose a feat.' },
      { level: 14, name: 'Subclass Feature', description: 'Your Sorcerous Origin grants an additional feature.' },
      { level: 16, name: 'Ability Score Improvement', description: '+2 to one ability score or +1 to two (max 20), or choose a feat.' },
      { level: 17, name: 'Metamagic', description: 'Learn a fourth Metamagic option.' },
      { level: 18, name: 'Subclass Feature', description: 'Your Sorcerous Origin grants an additional feature.' },
      { level: 19, name: 'Ability Score Improvement', description: '+2 to one ability score or +1 to two (max 20), or choose a feat.' },
      { level: 20, name: 'Sorcerous Restoration', description: 'Regain 4 expended Sorcery Points when you finish a short rest.' },
    ],
  },

  warlock: {
    hitDie: 8,
    primaryAbility: 'Charisma',
    savingThrows: ['Wisdom', 'Charisma'],
    armorTraining: 'Light armor',
    weaponTraining: 'Simple weapons',
    skillChoices: ['Arcana', 'Deception', 'History', 'Intimidation', 'Investigation', 'Nature', 'Religion'],
    numSkillChoices: 2,
    cantripsKnown: 2,
    cantripsAtLevel: [4, 10],
    spellsKnownAtL1: 2,
    spellsKnownTable: [2,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,13],
    invocationsAtLevel: [0,2,2,2,3,3,4,4,5,5,5,6,6,6,7,7,7,8,8,8],
    pactMagic: true,
    subclasses: [
      { slug: 'archfey', name: 'The Archfey', level: 1, description: 'Fey Presence (Channel Divinity-like: charm or frighten in 10ft cube, WIS save). Misty Escape (L6): reaction to go invisible + Misty Step when hit. Beguiling Defenses (L10): immune to charm, redirect to attacker.', features: [
        { level: 1, name: 'Fey Presence', description: 'Action: 10ft cube aura; each creature in the area must succeed on a WIS save (spell save DC) or be charmed or frightened (your choice) until end of your next turn. 1 use per short rest.' },
        { level: 6, name: 'Misty Escape', description: 'Reaction: when you take damage, become invisible and teleport up to 60ft (as Misty Step). Invisible until start of your next turn or until you attack/cast a spell. 1 use per short rest.' },
        { level: 10, name: 'Beguiling Defenses', description: 'Immune to being charmed. When a creature tries to charm you, use your reaction to turn the charm back on it (WIS save or charmed by you for 1 min).' },
        { level: 14, name: 'Dark Delirium', description: 'Action: one creature within 60ft must WIS save or enter a dream-like state for 1 min (concentration). It is incapacitated and has blinded/deafened conditions replaced by an illusory environment. If it takes damage, it makes a new save. 1 use per short rest.' },
      ] },
      { slug: 'fiend', name: 'The Fiend', level: 1, description: "Dark One's Blessing: gain temp HP = CHA mod + Warlock level on kills. Dark One's Own Luck (L6): add d10 to ability check or save 1/SR. Fiendish Resilience (L10): resistance to one damage type.", features: [
        { level: 1, name: "Dark One's Blessing", description: 'When you reduce a hostile creature to 0 HP, gain temp HP = CHA modifier + Warlock level.' },
        { level: 6, name: "Dark One's Own Luck", description: 'When you make an ability check or saving throw, add 1d10 to the roll (after seeing the d20, before learning the result). 1 use per short rest.' },
        { level: 10, name: 'Fiendish Resilience', description: 'After a short or long rest, choose one damage type. Gain resistance to that damage until you choose a different type.' },
        { level: 14, name: 'Hurl Through Hell', description: 'When you hit with an attack, send the creature on a tour through a hellscape. It disappears and reappears at end of your next turn in the same space it left. It takes 10d10 psychic damage (no save) and is frightened if it fails a WIS save. 1 use per long rest.' },
      ] },
      { slug: 'great-old-one', name: 'The Great Old One', level: 1, description: 'Awakened Mind: telepathy within 30ft. Entropic Ward (L6): reaction to impose disadvantage on attack vs you; advantage on next attack if miss. Thought Shield (L10): psychic resistance.', features: [
        { level: 1, name: 'Awakened Mind', description: 'Telepathically communicate with any creature you can see within 30ft that has a language. The creature can respond if it chooses.' },
        { level: 6, name: 'Entropic Ward', description: 'Reaction: when a creature makes an attack roll against you, impose disadvantage on the roll. If the attack misses, you have advantage on your next attack roll against that creature this turn. 1 use per short rest.' },
        { level: 10, name: 'Thought Shield', description: 'Your thoughts cannot be read by telepathy or magic. Gain resistance to psychic damage. When you take psychic damage, the attacker takes the same amount.' },
        { level: 14, name: 'Create Thrall', description: 'Touch an incapacitated humanoid to charm it. The charm lasts indefinitely unless it takes damage. The charmed creature is your thrall and obeys your commands. You can have only one thrall at a time.' },
      ] },
      { slug: 'celestial', name: 'The Celestial', level: 1, description: 'Expanded Spell List (healing/radiant spells). Bonus Cantrips: Light and Sacred Flame. Healing Light: pool of d6s (1+Warlock level) to heal (bonus action). Radiant Soul (L6): +CHA to fire/radiant damage.', features: [
        { level: 1, name: 'Bonus Cantrips', description: 'Learn Light and Sacred Flame. They count as Warlock cantrips and don\'t count against your cantrips known.' },
        { level: 1, name: 'Healing Light', description: 'Pool of d6s = 1 + Warlock level. Bonus action: heal one creature within 60ft that you can see by rolling any number of these dice. Regain pool on long rest.' },
        { level: 6, name: 'Radiant Soul', description: 'Resistance to radiant damage. When you cast a spell dealing fire or radiant damage, add CHA modifier to one damage roll.' },
        { level: 10, name: 'Celestial Resilience', description: 'Gain temp HP equal to Warlock level + CHA modifier whenever you finish a short or long rest. 5 creatures of your choice also gain temp HP equal to half your Warlock level + CHA modifier.' },
        { level: 14, name: 'Searing Vengeance', description: 'When you or an ally within 60ft regains HP and starts their turn at 0 HP, they can instead spring back: regain HP equal to half their HP maximum, stand up (no movement cost), and each creature within 30ft takes 2d8 radiant damage and is blinded until end of your next turn (CON save negates blind).' },
      ] },
      { slug: 'hexblade', name: 'The Hexblade', level: 1, description: "Hexblade's Curse (bonus action: curse target; crit on 19-20 vs them, +PB to damage, regain HP = Warlock level + CHA on kill, 1/SR). Hex Warrior: CHA for weapon attacks with one weapon. Accursed Specter (L6).", features: [
        { level: 1, name: "Hexblade's Curse", description: 'Bonus action: curse a creature you can see within 30ft (1/SR). While cursed: +PB to damage vs it; crit on 19-20 vs it; if it dies while cursed, regain HP = Warlock level + CHA modifier. Curse lasts 1 min or until you die.' },
        { level: 1, name: 'Hex Warrior', description: 'Gain proficiency with medium armor, shields, and martial weapons. Choose one weapon you are proficient with at the end of a long rest: use CHA instead of STR or DEX for attack and damage rolls. If you use Pact of the Blade, all your pact weapons automatically use CHA.' },
        { level: 6, name: 'Accursed Specter', description: 'When you kill a humanoid, you can curse its soul. Until end of your next long rest, its specter serves you. It has HP equal to half the creature\'s max HP. Only one specter at a time.' },
        { level: 10, name: 'Armor of Hexes', description: 'When your Hexblade\'s Curse target hits you with an attack, roll a d6. On a 4 or higher, the attack misses (regardless of the roll).' },
        { level: 14, name: 'Master of Hexes', description: 'When the target of your Hexblade\'s Curse dies, you can apply it to a new creature without using your action (but you\'ve still used your one-per-SR allotment if you didn\'t apply it via the death trigger).' },
      ] },
      { slug: 'genie', name: 'The Genie', level: 1, description: 'Choose genie type (Dao/Djinni/Efreeti/Marid). Genie\'s Vessel: bottle that acts as a bonus action pseudo-rest space (10min SR equivalent). Elemental Gift (L6): resistance + fly speed. Sanctuary Vessel (L10): party can use bottle.', features: [
        { level: 1, name: 'Genie\'s Vessel', description: 'Gain a magical vessel (urn, ring, lamp, etc.) containing a tiny extradimensional space. As a bonus action, teleport into it (can bring up to 5 willing creatures). You can spend 10 min inside as a short rest. Vessel has AC 10 + PB, HP = Warlock level + PB. If destroyed, you take 2d6 force damage and vessel reforms after 1d20 days.' },
        { level: 6, name: 'Elemental Gift', description: 'Resistance to a damage type based on genie type (Dao: bludgeoning, Djinni: thunder, Efreeti: fire, Marid: cold). As a bonus action, fly speed 30ft for 10 minutes. Uses = PB per long rest.' },
        { level: 10, name: 'Sanctuary Vessel', description: 'When you enter the vessel, bring up to 5 willing creatures. They can also benefit from a short rest inside. You can expel any creature from the vessel as a bonus action.' },
        { level: 14, name: 'Limited Wish', description: 'Entreat your patron for supernatural aid. Cast any spell of 6th level or lower from any class\'s spell list — it doesn\'t require concentration and uses no components. 1d4 long rests until you can use this again.' },
      ] },
      { slug: 'fathomless', name: 'The Fathomless', level: 1, description: 'Tentacle of the Deeps (bonus action, L1): 10ft tentacle; bonus cold damage, slow creature as reaction. Gift of the Sea: swim speed + breathing water. Oceanic Soul (L6): cold resistance + underwater communication.', features: [
        { level: 1, name: 'Tentacle of the Deeps', description: 'Bonus action: summon a 10ft tentacle at a point within 60ft (1 min). Once per turn when you hit with an attack, the tentacle can deal +1d8 cold damage to the target (2d8 at L10). Reaction: when a creature within 10ft of the tentacle moves, reduce its speed by 10ft for the rest of that turn. Tentacle is destroyed if it takes damage equal to Warlock level. Uses = PB per long rest.' },
        { level: 1, name: 'Gift of the Sea', description: 'Gain a swim speed of 40ft and the ability to breathe underwater.' },
        { level: 6, name: 'Oceanic Soul', description: 'Resistance to cold damage. When fully submerged, any creature also fully submerged can understand your speech and you can understand theirs.' },
        { level: 6, name: 'Guardian Coil', description: 'When you or a creature within 10ft of your Tentacle of the Deeps takes damage, use your reaction to have the tentacle reduce that damage by 1d8 (2d8 at L10).' },
        { level: 10, name: 'Grasping Tentacles', description: 'Always have Evard\'s Black Tentacles prepared. Cast it without a spell slot once per long rest. Whenever you cast it, gain temp HP equal to your Warlock level. While concentrating on it, your tentacle attacks don\'t require a bonus action — they trigger automatically when you hit.' },
        { level: 14, name: 'Fathomless Plunge', description: 'Action: teleport yourself and up to 5 willing creatures within 30ft to a point within 1 mile that you can see, or to any point within 1 mile if you can see the destination body of water. 1 use per short rest.' },
      ] },
    ],
    features: [
      { level: 1, name: 'Otherworldly Patron', description: 'Choose your Warlock subclass at level 1. You gain expanded spell list and unique features from your patron.' },
      { level: 1, name: 'Pact Magic', description: 'Warlock spell slots recharge on SHORT rest. Slots: 1×L1 (L1), 2×L1 (L2), 2×L2 (L3), 2×L3 (L5), 2×L4 (L7), 2×L5 (L9+). All slots are the same level, scaling with you.' },
      { level: 2, name: 'Eldritch Invocations', description: 'Choose 2 invocations (more as you level). Key options: Agonizing Blast (+CHA to Eldritch Blast), Devil\'s Sight (see in magical darkness), Eldritch Spear (EB range 300ft), Book of Ancient Secrets, One with Shadows, Repelling Blast, etc.' },
      { level: 3, name: 'Pact Boon', description: 'Choose: Pact of the Blade (summon/bond any weapon, CHA for attacks, bonus action resummon), Pact of the Chain (familiar options: imp, pseudodragon, quasit, sprite), or Pact of the Tome (Book of Shadows: 3 cantrips from any list + ritual spells).' },
      { level: 4, name: 'Ability Score Improvement', description: '+2 to one ability score or +1 to two (max 20), or choose a feat.' },
      { level: 5, name: 'Eldritch Blast', description: 'Eldritch Blast now fires 2 beams (each 1d10 force). 3 beams at L11, 4 beams at L17.' },
      { level: 6, name: 'Subclass Feature', description: 'Your Otherworldly Patron grants an additional feature.' },
      { level: 7, name: 'Eldritch Invocation', description: 'Learn an additional Eldritch Invocation.' },
      { level: 8, name: 'Ability Score Improvement', description: '+2 to one ability score or +1 to two (max 20), or choose a feat.' },
      { level: 9, name: 'Eldritch Invocation', description: 'Learn an additional Eldritch Invocation.' },
      { level: 10, name: 'Subclass Feature', description: 'Your Otherworldly Patron grants an additional feature.' },
      { level: 11, name: 'Mystic Arcanum', description: 'Choose one 6th-level spell from the Warlock list as your Mystic Arcanum. Cast it once without a spell slot per long rest.' },
      { level: 12, name: 'Ability Score Improvement', description: '+2 to one ability score or +1 to two (max 20), or choose a feat.' },
      { level: 12, name: 'Eldritch Invocation', description: 'Learn an additional Eldritch Invocation.' },
      { level: 13, name: 'Mystic Arcanum', description: 'Choose one 7th-level spell. Cast it once per long rest.' },
      { level: 14, name: 'Subclass Feature', description: 'Your Otherworldly Patron grants an additional feature.' },
      { level: 15, name: 'Mystic Arcanum', description: 'Choose one 8th-level spell. Cast it once per long rest.' },
      { level: 15, name: 'Eldritch Invocation', description: 'Learn an additional Eldritch Invocation.' },
      { level: 16, name: 'Ability Score Improvement', description: '+2 to one ability score or +1 to two (max 20), or choose a feat.' },
      { level: 17, name: 'Mystic Arcanum', description: 'Choose one 9th-level spell. Cast it once per long rest.' },
      { level: 18, name: 'Eldritch Invocation', description: 'Learn an additional Eldritch Invocation.' },
      { level: 19, name: 'Ability Score Improvement', description: '+2 to one ability score or +1 to two (max 20), or choose a feat.' },
      { level: 20, name: 'Eldritch Master', description: 'Spend 1 minute in earnest entreaty to your patron to regain all expended Pact Magic spell slots. 1 use per long rest.' },
    ],
  },

  wizard: {
    hitDie: 6,
    primaryAbility: 'Intelligence',
    savingThrows: ['Intelligence', 'Wisdom'],
    armorTraining: 'None',
    weaponTraining: 'Daggers, darts, slings, quarterstaffs, light crossbows',
    skillChoices: ['Arcana', 'History', 'Insight', 'Investigation', 'Medicine', 'Religion'],
    numSkillChoices: 2,
    cantripsKnown: 3,
    cantripsAtLevel: [4, 10],
    spellsKnownAtL1: 6,
    preparedCaster: true,
    isSpellbookCaster: true,
    subclasses: [
      { slug: 'abjuration', name: 'School of Abjuration', level: 2, description: 'Abjuration Savant (copy abjuration spells at half cost). Arcane Ward (casting abjuration spells creates a HP ward = 2 × Wizard level + INT that absorbs damage). Projected Ward (L6). Improved Abjuration (L10).', features: [
        { level: 2, name: 'Abjuration Savant', description: 'Copy Abjuration spells into your spellbook at half the gold and time cost.' },
        { level: 2, name: 'Arcane Ward', description: 'When you cast an Abjuration spell of 1st level or higher, create or reinforce a magical ward around yourself. Ward HP = 2 × Wizard level + INT modifier. Damage to you is absorbed by the ward first. It is replenished (not exceeded) when you cast Abjuration spells.' },
        { level: 6, name: 'Projected Ward', description: 'When a creature within 30ft takes damage, use your reaction to have your Arcane Ward absorb that damage instead.' },
        { level: 10, name: 'Improved Abjuration', description: 'Add your proficiency bonus to the ability check when casting Counterspell or Dispel Magic.' },
        { level: 14, name: 'Spell Resistance', description: 'Advantage on saving throws against spells. Resistance to damage from spells.' },
      ] },
      { slug: 'conjuration', name: 'School of Conjuration', level: 2, description: 'Conjuration Savant. Minor Conjuration (L2): conjure a 3-ft, 10lb mundane object for 1 hr. Benign Transposition (L6): teleport 30ft to unoccupied space or swap with conjured creature 1/LR (or short rest). Focused Conjuration (L10). Durable Summons (L14).', features: [
        { level: 2, name: 'Conjuration Savant', description: 'Copy Conjuration spells at half cost.' },
        { level: 2, name: 'Minor Conjuration', description: 'Action: conjure a nonmagical object up to 3 cubic feet / 10 pounds. It appears in your hand or on the floor within 10ft. It lasts 1 hour, until you use this again, or until it leaves your possession.' },
        { level: 6, name: 'Benign Transposition', description: 'Action: teleport up to 30ft to an unoccupied space OR swap places with a willing Small/Medium creature within 30ft that you can see. Recharges on short rest (or when you cast a Conjuration spell of 1st level or higher).' },
        { level: 10, name: 'Focused Conjuration', description: 'While concentrating on a Conjuration spell, concentration can\'t be broken by taking damage.' },
        { level: 14, name: 'Durable Summons', description: 'Any creature you summon or create with a Conjuration spell has 30 extra temporary hit points.' },
      ] },
      { slug: 'divination', name: 'School of Divination', level: 2, description: 'Divination Savant. Portent (L2): roll 2d20 after long rest; replace any creature\'s roll with one of these until next rest. Expert Divination (L6): recover slots when casting divination spells. Third Eye (L10). Greater Portent (L14: 3 dice).', features: [
        { level: 2, name: 'Divination Savant', description: 'Copy Divination spells at half cost.' },
        { level: 2, name: 'Portent', description: 'When you finish a long rest, roll 2d20 and record the numbers. Once per die, replace any attack roll, saving throw, or ability check made by any creature with one of your Portent numbers (before or after rolling). Used dice are gone until next long rest.' },
        { level: 6, name: 'Expert Divination', description: 'When you cast a Divination spell of 2nd level or higher using a spell slot, regain one expended spell slot of a lower level (not 5th or higher).' },
        { level: 10, name: 'The Third Eye', description: 'Action (until incapacitated): gain one of: darkvision 60ft; read invisible text/secret messages; see into the Ethereal Plane to 60ft; read any language. Choose each time. Recharges on short rest.' },
        { level: 14, name: 'Greater Portent', description: 'Roll 3d20 for Portent dice instead of 2.' },
      ] },
      { slug: 'enchantment', name: 'School of Enchantment', level: 2, description: 'Enchantment Savant. Hypnotic Gaze (L2): action to incapacitate one creature within 5ft (WIS save, INT-based DC) for free each turn. Instinctive Charm (L6). Split Enchantment (L10). Alter Memories (L14).', features: [
        { level: 2, name: 'Enchantment Savant', description: 'Copy Enchantment spells at half cost.' },
        { level: 2, name: 'Hypnotic Gaze', description: 'Action: one creature within 5ft must WIS save (DC = spell save DC) or be charmed and incapacitated (speed 0) until end of your next turn. Maintain each turn as an action. Creature is immune for 24 hours after it saves.' },
        { level: 6, name: 'Instinctive Charm', description: 'Reaction: when a creature within 30ft attacks you, redirect the attack to the nearest creature within range (WIS save negates, creature immune for 24 hours after save).' },
        { level: 10, name: 'Split Enchantment', description: 'When you cast an Enchantment spell that targets one creature, target two creatures within range and with the same spell.' },
        { level: 14, name: 'Alter Memories', description: 'When you cast a charm spell on a humanoid, it has no memory of being charmed by you once the charm ends. Additionally, as an action while the humanoid is charmed, edit its memories of up to the past 24 hours (5 minutes of events per INT modifier).' },
      ] },
      { slug: 'evocation', name: 'School of Evocation', level: 2, description: 'Evocation Savant. Sculpt Spells (L2): choose PB creatures to auto-succeed on saves against your evocation spells; they take no damage even on success. Potent Cantrip (L6). Empowered Evocation (L10): +INT to evocation damage rolls. Overchannel (L14).', features: [
        { level: 2, name: 'Evocation Savant', description: 'Copy Evocation spells at half cost.' },
        { level: 2, name: 'Sculpt Spells', description: 'When you cast an Evocation spell, choose a number of creatures up to 1 + the spell\'s level. Those creatures automatically succeed on saves against the spell, and they take no damage even if they would normally take half.' },
        { level: 6, name: 'Potent Cantrip', description: 'When a creature succeeds on a save against your cantrip, it takes half damage from the cantrip (instead of none).' },
        { level: 10, name: 'Empowered Evocation', description: 'Add your INT modifier to the damage roll of any Wizard Evocation spell.' },
        { level: 14, name: 'Overchannel', description: 'When you cast a Wizard spell of 1st through 5th level that deals damage, deal maximum damage. Subsequent uses before a long rest deal 2d12 necrotic to you (per spell level) with no save. First use per long rest is free.' },
      ] },
      { slug: 'illusion', name: 'School of Illusion', level: 2, description: 'Illusion Savant. Improved Minor Illusion (L2): Minor Illusion creates both sound and image. Malleable Illusions (L6): move illusion\'s effect when concentrating. Illusory Self (L10). Illusory Reality (L14): make part of an illusion real for 1 min.', features: [
        { level: 2, name: 'Illusion Savant', description: 'Copy Illusion spells at half cost.' },
        { level: 2, name: 'Improved Minor Illusion', description: 'Learn Minor Illusion if you don\'t know it. When you cast it, create both a sound and an image (normally mutually exclusive).' },
        { level: 6, name: 'Malleable Illusions', description: 'When concentrating on an Illusion spell, use an action to change the nature of the illusion (using the spell\'s normal parameters).' },
        { level: 10, name: 'Illusory Self', description: 'Reaction: when you are hit by an attack, create an illusory duplicate to intercept it — the attack misses you. Recharges on short rest.' },
        { level: 14, name: 'Illusory Reality', description: 'Once per casting, when you cast an Illusion spell of 1st level or higher, choose one nonliving object within the illusion. Make it real for 1 minute. The object can\'t deal damage or directly harm anyone.' },
      ] },
      { slug: 'necromancy', name: 'School of Necromancy', level: 2, description: 'Necromancy Savant. Grim Harvest (L2): regain HP = 2× (3× for necromancy) spell level when a spell kills a creature. Undead Thralls (L6). Inured to Undead (L10). Command Undead (L14).', features: [
        { level: 2, name: 'Necromancy Savant', description: 'Copy Necromancy spells at half cost.' },
        { level: 2, name: 'Grim Harvest', description: 'Once per turn when you kill a creature with a spell, regain HP equal to twice the spell\'s level (three times for Necromancy spells). Doesn\'t apply to undead or constructs.' },
        { level: 6, name: 'Undead Thralls', description: 'When casting Animate Dead, animate one additional undead. Undead you create from this spell add your PB to damage rolls and gain HP equal to your Wizard level.' },
        { level: 10, name: 'Inured to Undeath', description: 'Resistance to necrotic damage. Maximum HP can\'t be reduced.' },
        { level: 14, name: 'Command Undead', description: 'Action: one undead within 60ft must succeed on a CHA save (spell save DC) or come under your control indefinitely. A creature under another creature\'s control has disadvantage. Intelligent undead (INT 8+) can repeat the save each hour.' },
      ] },
      { slug: 'transmutation', name: 'School of Transmutation', level: 2, description: 'Transmutation Savant. Minor Alchemy (L2): transform a small amount of one material into another (copper→silver, etc.) for 1 hr. Transmuter\'s Stone (L6): create a stone granting a benefit (darkvision, speed, resistance, etc.). Shapechanger (L10). Master Transmuter (L14).', features: [
        { level: 2, name: 'Transmutation Savant', description: 'Copy Transmutation spells at half cost.' },
        { level: 2, name: 'Minor Alchemy', description: 'Transform a nonmagical object of one material into another (wood, stone, iron, copper, or silver) for up to 10 minutes per Wizard level. Spend 10 minutes per cubic foot transformed. Object returns to normal after.' },
        { level: 6, name: "Transmuter's Stone", description: 'Spend 8 hours creating a Transmuter\'s Stone (one at a time). Whoever holds it gains a benefit of your choice: darkvision 60ft; +10ft speed; proficiency in CON saves; resistance to acid/cold/fire/lightning/thunder (choose one). You can change the benefit by spending 8 hours.' },
        { level: 10, name: 'Shapechanger', description: 'Add Polymorph to your spellbook (if not already). Cast Polymorph without a spell slot on yourself (uses concentration). Recharges on short rest.' },
        { level: 14, name: 'Master Transmuter', description: 'Action: destroy your Transmuter\'s Stone to cast one of: Major Restoration on a creature within 10ft; remove one curse/poison/disease from a creature within 10ft; cast Flesh to Stone reversed on a petrified creature within 10ft; cast Polymorph on a creature within 10ft (no concentration, permanent until dispelled); or create a 25,000gp gem (lasts 1d10 × 10 minutes).' },
      ] },
      { slug: 'bladesinging', name: 'Bladesinging', level: 2, description: 'Training in War and Song (light armor + Performance). Bladesong (L2, bonus action, WIS/LR): +INT to AC & concentration saves, +10ft speed, advantage on Acrobatics. Extra Attack (L6). Song of Defense (L10). Song of Victory (L14).', features: [
        { level: 2, name: 'Training in War and Song', description: 'Gain proficiency with light armor and one one-handed melee weapon. Gain proficiency in the Performance skill if not already proficient.' },
        { level: 2, name: 'Bladesong', description: 'Bonus action: enter a Bladesong for 1 minute (WIS modifier uses per long rest; must be holding nothing in your off hand). While active: +INT modifier to AC; +10ft walking speed; advantage on Acrobatics; +INT modifier to CON saves to maintain concentration. Ends early if incapacitated, wearing medium/heavy armor, using a shield, or using two hands for a weapon.' },
        { level: 6, name: 'Extra Attack', description: 'Attack twice per Attack action. One attack can be replaced by a cantrip.' },
        { level: 10, name: 'Song of Defense', description: 'When you take damage while Bladesong is active, reaction: expend a spell slot to reduce the damage by 5 × slot level.' },
        { level: 14, name: 'Song of Victory', description: 'While Bladesong is active, add INT modifier (min 1) to melee weapon attack damage.' },
      ] },
      { slug: 'order-of-scribes', name: 'Order of Scribes', level: 2, description: 'Awakened Spellbook: copy spells for free using magic; change a spell\'s damage type once per cast. Manifest Mind (L2): create a spectral floating mind that observes remotely and can deliver spells. Master Scrivener (L6). One with the Word (L10).', features: [
        { level: 2, name: 'Awakened Spellbook', description: 'Your spellbook is sentient. Copy spells for free (no gold cost). Once per long rest, when you cast a Wizard spell from the spellbook, change its damage type to match any other damage-dealing Wizard spell in your book.' },
        { level: 2, name: 'Manifest Mind', description: 'Bonus action: summon a spectral mind from your spellbook to a space within 300ft. You can see and hear through it (while not using your own senses). It can\'t interact with the world physically. When you cast a Wizard spell with a range of 5ft or more, cast it as if you were in its space. Dismiss as a bonus action. Uses = PB per long rest.' },
        { level: 6, name: 'Master Scrivener', description: 'Once per long rest, write a special magical scroll: it contains any Wizard spell in your book of 1st or 2nd level. Only you can use it; others treat it as a mundane scroll. The scroll\'s spell uses your spell save DC and spell attack bonus.' },
        { level: 10, name: 'One with the Word', description: 'While your spellbook is on your person, gain advantage on INT (Arcana) checks. If you take damage while Manifest Mind is active, use reaction to negate the damage and dismiss the mind, causing a spell in your book to vanish until next long rest (chosen randomly, exclude cantrips).' },
        { level: 14, name: 'Spellbook Binding', description: 'You can cast a spell from your spellbook in Manifest Mind\'s space up to twice per round rather than once. Also, when you use Manifest Mind, you can perceive through it with blindsight 10ft instead of standard senses.' },
      ] },
      { slug: 'war-magic', name: 'War Magic', level: 2, description: 'Arcane Deflection (L2, reaction): +2 AC or +4 to save; can only cast cantrips next turn. Tactical Wit (L2): +INT to initiative. Power Surge (L6): store power when dispelling/countering spells for bonus force damage. Durable Magic (L10). Deflecting Shroud (L14).', features: [
        { level: 2, name: 'Arcane Deflection', description: 'Reaction: when hit by an attack, gain +2 AC against that attack; or when failing a save, gain +4 to the save. If you use this, the only spells you can cast next turn are cantrips.' },
        { level: 2, name: 'Tactical Wit', description: 'Gain a bonus to initiative rolls equal to your INT modifier.' },
        { level: 6, name: 'Power Surge', description: 'Store a power surge when you successfully cast Counterspell or Dispel Magic, or when an enemy spell fails against you. Max surges = INT modifier (min 1). Once per turn when you deal damage with a Wizard spell, expend a surge to deal extra force damage equal to half your Wizard level.' },
        { level: 10, name: 'Durable Magic', description: 'While concentrating on a spell, gain +2 bonus to AC and all saving throws.' },
        { level: 14, name: 'Deflecting Shroud', description: 'When you use Arcane Deflection, unleash magical energy: each creature of your choice within 10ft takes force damage equal to half your Wizard level.' },
      ] },
      { slug: 'chronurgy', name: 'Chronurgy Magic', level: 2, description: 'Chronal Shift (L2): reaction to force reroll (2/LR). Temporal Awareness (L2): +INT to initiative. Momentary Stasis (L6): action to restrain a creature (CON save; scales). Arcane Abeyance (L10). Convergent Future (L14).', features: [
        { level: 2, name: 'Chronal Shift', description: 'Reaction: after a creature makes an attack roll, ability check, or saving throw, force it to reroll and use the new roll. 2 uses per long rest.' },
        { level: 2, name: 'Temporal Awareness', description: 'Add INT modifier to initiative rolls.' },
        { level: 6, name: 'Momentary Stasis', description: 'Action: force a Large or smaller creature within 60ft into a magical stasis. It must CON save (spell save DC) or be incapacitated and have speed 0 until end of your next turn. INT modifier uses per long rest.' },
        { level: 10, name: 'Arcane Abeyance', description: 'Once per long rest when you cast a spell of 4th level or lower, condense it into a bead (Tiny, AC 15, 1 HP). The bead lasts 1 hour. A creature can use an action to release the spell (using your spell save DC). If the bead is destroyed, the spell is lost.' },
        { level: 14, name: 'Convergent Future', description: 'When you or a creature you can see makes an attack roll, ability check, or saving throw, you can use your reaction to choose success or failure for that roll (instead of any other outcome). After using this, gain 1 level of exhaustion until you finish a long rest.' },
      ] },
      { slug: 'graviturgy', name: 'Graviturgy Magic', level: 2, description: 'Adjust Density (L2): make creature Large → slow/heavy or Small → fast/light (CON save). Gravity Well (L6): move creatures after spells. Violent Attraction (L10). Event Horizon (L14).', features: [
        { level: 2, name: 'Adjust Density', description: 'Action (concentration, 1 min): one creature within 30ft you can see must CON save. Heavy: size category decreases by one, speed halved, disadvantage on DEX saves, advantage on STR checks/saves. Light: size category increases by one, speed +10ft, advantage on DEX saves, disadvantage on STR checks/saves. INT modifier uses per long rest.' },
        { level: 6, name: 'Gravity Well', description: 'When you cast a spell on a creature, move that creature 5ft toward or away from you (your choice). Medium or smaller only; no save.' },
        { level: 10, name: 'Violent Attraction', description: 'Reaction: when a creature within 60ft takes damage from a fall or impact (ranged/melee attack), increase the damage by 1d10. INT modifier uses per long rest.' },
        { level: 14, name: 'Event Horizon', description: 'Action (concentration, 1 min): gravitational field in 30ft around you. Hostile creatures that enter or start their turn there take 2d10 force damage and must succeed on a STR save or be pulled 10ft toward you. 1 use per long rest.' },
      ] },
    ],
    features: [
      { level: 1, name: 'Spellcasting (INT)', description: 'Prepare INT mod + Wizard level spells from your spellbook each long rest. Spellbook starts with 6 + INT mod spells. Cast using INT. Copy spells from scrolls/books (2hr + 50gp per level).' },
      { level: 1, name: 'Arcane Recovery', description: 'Once per long rest during a short rest: recover spell slots totaling up to half Wizard level (rounded up). No slot recovered may be 6th level or higher.' },
      { level: 2, name: 'Arcane Tradition', description: 'Choose your Wizard subclass (school of magic or tradition).' },
      { level: 4, name: 'Ability Score Improvement', description: '+2 to one ability score or +1 to two (max 20), or choose a feat.' },
      { level: 6, name: 'Subclass Feature', description: 'Your Arcane Tradition grants an additional feature.' },
      { level: 8, name: 'Ability Score Improvement', description: '+2 to one ability score or +1 to two (max 20), or choose a feat.' },
      { level: 10, name: 'Subclass Feature', description: 'Your Arcane Tradition grants an additional feature.' },
      { level: 12, name: 'Ability Score Improvement', description: '+2 to one ability score or +1 to two (max 20), or choose a feat.' },
      { level: 14, name: 'Subclass Feature', description: 'Your Arcane Tradition grants an additional feature.' },
      { level: 16, name: 'Ability Score Improvement', description: '+2 to one ability score or +1 to two (max 20), or choose a feat.' },
      { level: 18, name: 'Spell Mastery', description: 'Choose one 1st-level and one 2nd-level spell from your spellbook. Cast each once per day without expending a spell slot (at their lowest level). Swap choices on a long rest.' },
      { level: 19, name: 'Ability Score Improvement', description: '+2 to one ability score or +1 to two (max 20), or choose a feat.' },
      { level: 20, name: 'Signature Spells', description: 'Choose 2 spells of 3rd level or lower from your spellbook as Signature Spells — always prepared, and you can cast each once without a slot per short or long rest.' },
    ],
  },
}

// ── Pact Magic Slots (Warlock) ─────────────────────────────────────────────
// [slotLevel, numSlots] for each Warlock level (index = warlockLevel - 1)
export const PACT_SLOT_TABLE: readonly [number, number][] = [
  [1, 1], [1, 2], [2, 2], [2, 2], [3, 2],  // L1-5
  [3, 2], [4, 2], [4, 2], [5, 2], [5, 2],  // L6-10
  [5, 3], [5, 3], [5, 3], [5, 3], [5, 3],  // L11-15
  [5, 3], [5, 4], [5, 4], [5, 4], [5, 4],  // L16-20
]

// ── Spell Slots ────────────────────────────────────────────────────────────

export const INITIAL_SPELL_SLOTS: Record<string, Record<string, { max: number; used: number }>> = {
  artificer: { '1': { max: 2, used: 0 } },
  bard:      { '1': { max: 2, used: 0 } },
  cleric:    { '1': { max: 2, used: 0 } },
  druid:     { '1': { max: 2, used: 0 } },
  sorcerer:  { '1': { max: 2, used: 0 } },
  wizard:    { '1': { max: 2, used: 0 } },
  warlock:   { '1': { max: 1, used: 0 } },
  paladin:   {},
  ranger:    {},
  fighter:   {},
  barbarian: {},
  monk:      {},
  rogue:     {},
}

// PHB third-caster table (Eldritch Knight fighter, Arcane Trickster rogue)
// index = class level - 1; columns = L1..L4 slots
export const THIRD_CASTER_SLOT_TABLE: readonly number[][] = [
  [0,0,0,0],[0,0,0,0],[2,0,0,0],[3,0,0,0],[3,0,0,0],[3,0,0,0],
  [4,2,0,0],[4,2,0,0],[4,2,0,0],[4,3,0,0],[4,3,0,0],[4,3,0,0],
  [4,3,2,0],[4,3,2,0],[4,3,2,0],[4,3,3,0],[4,3,3,0],[4,3,3,0],
  [4,3,3,1],[4,3,3,1],
]

export function slotsForLevel(
  classSlug: string,
  newLevel: number,
  spellSlotTable?: number[][]
): Record<string, { max: number; used: number }> | null {
  if (classSlug === 'warlock') return null
  const table = spellSlotTable ?? (() => {
    const ct = CASTER_TYPE[classSlug]
    const type = typeof ct === 'function' ? ct() : ct
    if (type === 'third') return THIRD_CASTER_SLOT_TABLE as number[][]
    return null
  })()
  if (!table) return null
  const row = table[newLevel - 1]
  if (!row) return null
  const slots: Record<string, { max: number; used: number }> = {}
  row.forEach((count, i) => {
    if (count > 0) slots[String(i + 1)] = { max: count, used: 0 }
  })
  return slots
}

// ── Artificer Infusions ────────────────────────────────────────────────────

export interface InfusionDef {
  slug: string
  name: string
  description: string
  levelRequirement?: number
  itemType?: string
  cost?: string
}

export const ARTIFICER_INFUSIONS: InfusionDef[] = [
  // Available at level 2
  { slug: 'enhanced-weapon',        name: 'Enhanced Weapon',           itemType: 'Simple or martial weapon',        description: 'Becomes a +1 magic weapon (+2 at artificer level 10).' },
  { slug: 'enhanced-defense',       name: 'Enhanced Defense',          itemType: 'Armor or shield',                 description: 'Becomes a +1 magic item (+2 at artificer level 10).' },
  { slug: 'enhanced-arcane-focus',  name: 'Enhanced Arcane Focus',     itemType: 'Rod, staff, or wand',             description: '+1 spellcasting focus (+2 at level 10). Spell attacks through it ignore half cover.' },
  { slug: 'returning-weapon',       name: 'Returning Weapon',          itemType: 'Simple or martial thrown weapon', description: 'Gains the thrown property (20/60ft). Returns to your hand immediately after being thrown.' },
  { slug: 'repeating-shot',         name: 'Repeating Shot',            itemType: 'Simple or martial ranged weapon', description: 'Magically produces its own ammunition; ignores the loading property. Ammunition vanishes after impact.' },
  { slug: 'bag-of-holding',         name: 'Bag of Holding',            itemType: 'A bag',                           description: 'Becomes a Bag of Holding (holds 500 lb / 64 cu ft; weighs 15 lb).' },
  // Available at level 6
  { slug: 'armor-magical-strength', name: 'Armor of Magical Strength', itemType: 'A suit of armor',                 description: '6 charges. Reaction: expend a charge to succeed on a failed STR check or save. Regains 1d6 charges at dawn.', levelRequirement: 6 },
  { slug: 'boots-winding-path',     name: 'Boots of the Winding Path', itemType: 'A pair of boots',                 description: 'Once per turn, wearer can teleport (bonus action) up to 15ft to an unoccupied space they can see.', levelRequirement: 6 },
  { slug: 'homunculus-servant',     name: 'Homunculus Servant',        itemType: 'Gem or crystal',                  description: 'Creates a Homunculus Servant construct. Can deliver your touch spells. Rebuilt after a long rest if destroyed.', levelRequirement: 6, cost: '100 gp gem or crystal' },
  { slug: 'mind-sharpener',         name: 'Mind Sharpener',            itemType: 'Armor or robes',                  description: '4 charges. Reaction: expend a charge to succeed on a failed CON save to maintain concentration. Regains 1d4 at dawn.', levelRequirement: 6 },
  { slug: 'radiant-weapon',         name: 'Radiant Weapon',            itemType: 'Simple or martial weapon',        description: '+1 magic weapon. Sheds light (5/10ft) on command. 4 charges: reaction to blind an attacker until their next turn (CON save). Regains 1d4 at dawn.', levelRequirement: 6 },
  { slug: 'repulsion-shield',       name: 'Repulsion Shield',          itemType: 'A shield',                        description: '+1 magic shield. 4 charges: reaction to push a creature 15ft when it hits you (STR save). Regains 1d4 at dawn.', levelRequirement: 6 },
  { slug: 'resistant-armor',        name: 'Resistant Armor',           itemType: 'A suit of armor',                 description: 'Grants resistance to one damage type chosen at infusion (acid, cold, fire, force, lightning, necrotic, poison, psychic, radiant, or thunder).', levelRequirement: 6 },
  { slug: 'spell-refueling-ring',   name: 'Spell-Refueling Ring',      itemType: 'A ring',                          description: 'Once per dawn, wearer can recover one expended spell slot of 3rd level or lower.', levelRequirement: 6 },
  // Available at level 10
  { slug: 'helm-of-awareness',      name: 'Helm of Awareness',         itemType: 'A helmet',                        description: 'Wearer can\'t be surprised and has advantage on initiative rolls.', levelRequirement: 10 },
  // Available at level 14
  { slug: 'arcane-propulsion-armor',name: 'Arcane Propulsion Armor',   itemType: 'A suit of armor (not heavy)',     description: 'Wearer\'s speed increases by 5ft. They can use the armor as a spellcasting focus. Gauntlets count as simple melee weapons (1d8 force, thrown 20/60ft, return after throwing).', levelRequirement: 14 },
]

// ── Eldritch Invocations ───────────────────────────────────────────────────

export interface InvocationDef {
  slug: string
  name: string
  description: string
  levelRequirement?: number
  prerequisite?: string
  limitedUse?: { recharge: 'short' | 'long' }
}

export const ELDRITCH_INVOCATIONS: InvocationDef[] = [
  { slug: 'agonizing-blast', name: 'Agonizing Blast', description: 'Add your CHA modifier to the damage of Eldritch Blast.', prerequisite: 'Eldritch Blast cantrip' },
  { slug: 'armor-of-shadows', name: 'Armor of Shadows', description: 'Cast Mage Armor on yourself at will, without a spell slot.' },
  { slug: 'ascendant-step', name: 'Ascendant Step', description: 'Cast Levitate on yourself at will, without a spell slot.', levelRequirement: 9 },
  { slug: 'beast-speech', name: 'Beast Speech', description: 'Cast Speak with Animals at will, without a spell slot.' },
  { slug: 'beguiling-influence', name: 'Beguiling Influence', description: 'Gain proficiency in Deception and Persuasion.' },
  { slug: 'bewitching-whispers', name: 'Bewitching Whispers', description: 'Cast Compulsion once using a spell slot. 1/LR without a slot.', levelRequirement: 7, limitedUse: { recharge: 'long' } },
  { slug: 'book-of-ancient-secrets', name: 'Book of Ancient Secrets', description: 'Learn two ritual spells from any class. Inscribe new rituals found.', prerequisite: 'Pact of the Tome' },
  { slug: 'chains-of-carceri', name: 'Chains of Carceri', description: 'Cast Hold Monster at will on celestials, fiends, or elementals — no slot. 1/creature per LR.', levelRequirement: 15, prerequisite: 'Pact of the Chain', limitedUse: { recharge: 'long' } },
  { slug: 'devils-sight', name: "Devil's Sight", description: 'See normally in darkness (magical and nonmagical) out to 120ft.' },
  { slug: 'dreadful-word', name: 'Dreadful Word', description: 'Cast Confusion once using a spell slot. 1/LR without a slot.', levelRequirement: 7, limitedUse: { recharge: 'long' } },
  { slug: 'eldritch-sight', name: 'Eldritch Sight', description: 'Cast Detect Magic at will, without a spell slot.' },
  { slug: 'eldritch-spear', name: 'Eldritch Spear', description: 'Eldritch Blast has a range of 300ft.', prerequisite: 'Eldritch Blast cantrip' },
  { slug: 'eyes-of-the-rune-keeper', name: 'Eyes of the Rune Keeper', description: 'You can read all writing.' },
  { slug: 'fiendish-vigor', name: 'Fiendish Vigor', description: 'Cast False Life on yourself at will at 1st level, without a slot or material components.' },
  { slug: 'gaze-of-two-minds', name: 'Gaze of Two Minds', description: 'Touch a willing humanoid to perceive through its senses (action). No concentration.' },
  { slug: 'grasp-of-hadar', name: 'Grasp of Hadar', description: 'Once per turn when you hit with Eldritch Blast, pull the target up to 10ft closer.', prerequisite: 'Eldritch Blast cantrip' },
  { slug: 'lance-of-lethargy', name: 'Lance of Lethargy', description: "Once per turn when you hit with Eldritch Blast, reduce the target's speed by 10ft until next turn.", prerequisite: 'Eldritch Blast cantrip' },
  { slug: 'lifedrinker', name: 'Lifedrinker', description: 'Your pact weapon deals extra necrotic damage equal to your CHA modifier.', levelRequirement: 12, prerequisite: 'Pact of the Blade' },
  { slug: 'mask-of-many-faces', name: 'Mask of Many Faces', description: 'Cast Disguise Self at will, without a spell slot.' },
  { slug: 'master-of-myriad-forms', name: 'Master of Myriad Forms', description: 'Cast Alter Self at will, without a spell slot.', levelRequirement: 15 },
  { slug: 'minions-of-chaos', name: 'Minions of Chaos', description: 'Cast Conjure Elemental once using a spell slot. 1/LR without a slot.', levelRequirement: 9, limitedUse: { recharge: 'long' } },
  { slug: 'mire-the-mind', name: 'Mire the Mind', description: 'Cast Slow once using a spell slot. 1/LR without a slot.', levelRequirement: 5, limitedUse: { recharge: 'long' } },
  { slug: 'misty-visions', name: 'Misty Visions', description: 'Cast Silent Image at will, without a spell slot.' },
  { slug: 'one-with-shadows', name: 'One with Shadows', description: 'While in dim light or darkness, become invisible as an action. Ends when you move or act.', levelRequirement: 5 },
  { slug: 'otherworldly-leap', name: 'Otherworldly Leap', description: 'Cast Jump on yourself at will, without a spell slot.', levelRequirement: 9 },
  { slug: 'repelling-blast', name: 'Repelling Blast', description: 'When you hit with Eldritch Blast, push the target up to 10ft away.', prerequisite: 'Eldritch Blast cantrip' },
  { slug: 'sculptor-of-flesh', name: 'Sculptor of Flesh', description: 'Cast Polymorph once using a spell slot. 1/LR without a slot.', levelRequirement: 7, limitedUse: { recharge: 'long' } },
  { slug: 'sign-of-ill-omen', name: 'Sign of Ill Omen', description: 'Cast Bestow Curse once using a spell slot. 1/LR without a slot.', levelRequirement: 5, limitedUse: { recharge: 'long' } },
  { slug: 'thief-of-five-fates', name: 'Thief of Five Fates', description: 'Cast Bane once using a spell slot. 1/LR without a slot.', limitedUse: { recharge: 'long' } },
  { slug: 'thirsting-blade', name: 'Thirsting Blade', description: 'Attack twice with your pact weapon when you take the Attack action.', levelRequirement: 5, prerequisite: 'Pact of the Blade' },
  { slug: 'visions-of-distant-realms', name: 'Visions of Distant Realms', description: 'Cast Arcane Eye at will, without a spell slot.', levelRequirement: 15 },
  { slug: 'voice-of-the-chain-master', name: 'Voice of the Chain Master', description: 'Communicate telepathically, perceive through, and speak through your familiar (within 100 miles).', prerequisite: 'Pact of the Chain' },
  { slug: 'whispers-of-the-grave', name: 'Whispers of the Grave', description: 'Cast Speak with Dead at will, without a spell slot.', levelRequirement: 9 },
  { slug: 'witch-sight', name: 'Witch Sight', description: 'See the true form of shapechangers and entities disguised by illusion within 30ft.', levelRequirement: 15 },
]

// ── Metamagic ──────────────────────────────────────────────────────────────

export interface MetamagicDef {
  slug: string
  name: string
  description: string
}

export const METAMAGIC_OPTIONS: MetamagicDef[] = [
  { slug: 'careful', name: 'Careful Spell', description: '1 SP: up to CHA mod creatures automatically succeed on saves against your spell.' },
  { slug: 'distant', name: 'Distant Spell', description: '1 SP: double a spell\'s range. Touch spells become 30ft range.' },
  { slug: 'empowered', name: 'Empowered Spell', description: '1 SP: reroll up to CHA mod damage dice; must use new rolls. Combinable with other metamagic.' },
  { slug: 'extended', name: 'Extended Spell', description: '1 SP: double a spell\'s duration (max 24 hours).' },
  { slug: 'heightened', name: 'Heightened Spell', description: '3 SP: one target of a spell that forces a save has disadvantage on its first save against it.' },
  { slug: 'quickened', name: 'Quickened Spell', description: '2 SP: change casting time from 1 action to a bonus action.' },
  { slug: 'seeking', name: 'Seeking Spell', description: '2 SP: reroll a spell attack that missed; must use the new roll. (Tasha\'s)' },
  { slug: 'subtle', name: 'Subtle Spell', description: '1 SP: cast without verbal or somatic components.' },
  { slug: 'transmuted', name: 'Transmuted Spell', description: '1 SP: change the spell\'s damage type among acid/cold/fire/lightning/poison/thunder. (Tasha\'s)' },
  { slug: 'twinned', name: 'Twinned Spell', description: '1 SP per spell level (min 1): target a second creature with a single-target spell.' },
]

// ── Battle Master Maneuvers ──────────────────────────────────────────────────

export interface ManeuverDef {
  slug: string
  name: string
  description: string
}

export const BATTLE_MASTER_MANEUVERS: ManeuverDef[] = [
  { slug: 'ambush', name: 'Ambush', description: 'Add a Superiority Die to a DEX (Stealth) or initiative roll.' },
  { slug: 'bait-and-switch', name: 'Bait and Switch', description: 'Swap places with a willing ally within 5ft (no OA). One of you gains +AC equal to the die until start of your next turn.' },
  { slug: 'brace', name: 'Brace', description: 'Reaction: when a creature enters your reach, make one weapon attack against it and add the die to damage.' },
  { slug: 'commanders-strike', name: "Commander's Strike", description: 'Forgo one attack; use a bonus action to direct an ally to attack, adding the Superiority Die to damage.' },
  { slug: 'disarming-attack', name: 'Disarming Attack', description: 'Add die to damage; target STR/DEX save or drops one held item.' },
  { slug: 'distracting-strike', name: 'Distracting Strike', description: 'Add die to damage; next attack against this target before your next turn has advantage.' },
  { slug: 'evasive-footwork', name: 'Evasive Footwork', description: 'Add die to AC while you move.' },
  { slug: 'feinting-attack', name: 'Feinting Attack', description: 'Bonus action: feint a creature within 5ft, add die + advantage to next attack against it this turn.' },
  { slug: 'goading-attack', name: 'Goading Attack', description: 'Add die to damage; WIS save or target has disadvantage attacking anyone other than you until your next turn.' },
  { slug: 'lunging-attack', name: 'Lunging Attack', description: 'Increase reach by 5ft for one attack; add die to damage.' },
  { slug: 'maneuvering-attack', name: 'Maneuvering Attack', description: 'Add die to damage; ally can use reaction to move half speed without provoking OA from target.' },
  { slug: 'menacing-attack', name: 'Menacing Attack', description: 'Add die to damage; WIS save or target is frightened until your next turn.' },
  { slug: 'parry', name: 'Parry', description: 'Reaction: reduce damage from a melee hit by die + DEX mod.' },
  { slug: 'precision-attack', name: 'Precision Attack', description: 'Add die to an attack roll (before or after roll, before outcome known).' },
  { slug: 'pushing-attack', name: 'Pushing Attack', description: 'Add die to damage; STR save or pushed up to 15ft away.' },
  { slug: 'quick-toss', name: 'Quick Toss', description: 'Bonus action: draw and make a ranged attack with a thrown weapon, adding die to damage.' },
  { slug: 'rally', name: 'Rally', description: 'Bonus action: ally gains temporary HP = die + CHA mod.' },
  { slug: 'riposte', name: 'Riposte', description: 'Reaction: when a creature misses you in melee, make one attack and add die to damage.' },
  { slug: 'sweeping-attack', name: 'Sweeping Attack', description: 'After hitting one creature, deal die damage to a second creature within 5ft (no attack roll, same weapon).' },
  { slug: 'tactical-assessment', name: 'Tactical Assessment', description: 'Add die to a History, Insight, or Perception check.' },
  { slug: 'trip-attack', name: 'Trip Attack', description: 'Add die to damage; Large-or-smaller target STR save or knocked prone.' },
]

// ── Multiclass Proficiency Grants (PHB p.164) ────────────────────────────────
// What proficiencies a character gains when MULTICLASSING INTO a class for the first time.
// These are the restricted subset, not the full starting proficiencies.

export interface MulticlassProfGrant {
  armor?: string[]
  weapons?: string[]
  tools?: string[]
  skills?: { count: number; from: string[] }  // pick N from list
}

export const MULTICLASS_PROF_GRANTS: Record<string, MulticlassProfGrant> = {
  artificer:  { armor: ['Light Armor', 'Medium Armor', 'Shields'], weapons: ['Simple Weapons'], tools: ["Thieves' Tools"] },
  barbarian:  { armor: ['Light Armor', 'Medium Armor', 'Shields'], weapons: ['Simple Weapons', 'Martial Weapons'] },
  bard:       { armor: ['Light Armor'], skills: { count: 1, from: [] } }, // any skill
  cleric:     { armor: ['Light Armor', 'Medium Armor', 'Shields'] },
  druid:      { armor: ['Light Armor', 'Medium Armor', 'Shields'] },
  fighter:    { armor: ['Light Armor', 'Medium Armor', 'Shields'], weapons: ['Simple Weapons', 'Martial Weapons'] },
  monk:       { weapons: ['Simple Weapons', 'Shortswords'] },
  paladin:    { armor: ['Light Armor', 'Medium Armor', 'Shields'], weapons: ['Simple Weapons', 'Martial Weapons'] },
  ranger:     { armor: ['Light Armor', 'Medium Armor', 'Shields'], weapons: ['Simple Weapons', 'Martial Weapons'], skills: { count: 1, from: ['Animal Handling', 'Athletics', 'Insight', 'Investigation', 'Nature', 'Perception', 'Stealth', 'Survival'] } },
  rogue:      { armor: ['Light Armor'], tools: ["Thieves' Tools"], skills: { count: 1, from: ['Acrobatics', 'Athletics', 'Deception', 'Insight', 'Intimidation', 'Investigation', 'Perception', 'Performance', 'Persuasion', 'Sleight of Hand', 'Stealth'] } },
  sorcerer:   {},
  warlock:    { armor: ['Light Armor'], weapons: ['Simple Weapons'] },
  wizard:     {},
}

// ── Circle of the Land spells ─────────────────────────────────────────────

export const LAND_CIRCLE_SPELLS: Record<string, SubclassGrantedSpell[]> = {
  arctic: [
    gs(3, 2, 'Hold Person'), gs(3, 2, 'Spike Growth'),
    gs(5, 3, 'Sleet Storm'), gs(5, 3, 'Slow'),
    gs(7, 4, 'Freedom of Movement'), gs(7, 4, 'Ice Storm'),
    gs(9, 5, 'Commune with Nature'), gs(9, 5, 'Cone of Cold'),
  ],
  coast: [
    gs(3, 2, 'Mirror Image'), gs(3, 2, 'Misty Step'),
    gs(5, 3, 'Water Breathing'), gs(5, 3, 'Water Walk'),
    gs(7, 4, 'Control Water'), gs(7, 4, 'Freedom of Movement'),
    gs(9, 5, 'Conjure Elemental'), gs(9, 5, 'Scrying'),
  ],
  desert: [
    gs(3, 2, 'Blur'), gs(3, 2, 'Silence'),
    gs(5, 3, 'Create Food and Water'), gs(5, 3, 'Protection from Energy'),
    gs(7, 4, 'Blight'), gs(7, 4, 'Hallucinatory Terrain'),
    gs(9, 5, 'Insect Plague'), gs(9, 5, 'Wall of Stone'),
  ],
  forest: [
    gs(3, 2, 'Barkskin'), gs(3, 2, 'Spider Climb'),
    gs(5, 3, 'Call Lightning'), gs(5, 3, 'Plant Growth'),
    gs(7, 4, 'Divination'), gs(7, 4, 'Freedom of Movement'),
    gs(9, 5, 'Commune with Nature'), gs(9, 5, 'Tree Stride'),
  ],
  grassland: [
    gs(3, 2, 'Invisibility'), gs(3, 2, 'Pass without Trace'),
    gs(5, 3, 'Daylight'), gs(5, 3, 'Haste'),
    gs(7, 4, 'Divination'), gs(7, 4, 'Wind Wall'),
    gs(9, 5, 'Dream'), gs(9, 5, 'Insect Plague'),
  ],
  mountain: [
    gs(3, 2, 'Spider Climb'), gs(3, 2, 'Spike Growth'),
    gs(5, 3, 'Lightning Bolt'), gs(5, 3, 'Meld into Stone'),
    gs(7, 4, 'Stone Shape'), gs(7, 4, 'Stoneskin'),
    gs(9, 5, 'Passwall'), gs(9, 5, 'Wall of Stone'),
  ],
  swamp: [
    gs(3, 2, 'Darkness'), gs(3, 2, "Melf's Acid Arrow"),
    gs(5, 3, 'Water Walk'), gs(5, 3, 'Stinking Cloud'),
    gs(7, 4, 'Freedom of Movement'), gs(7, 4, 'Locate Creature'),
    gs(9, 5, 'Insect Plague'), gs(9, 5, 'Scrying'),
  ],
  underdark: [
    gs(3, 2, 'Spider Climb'), gs(3, 2, 'Web'),
    gs(5, 3, 'Gaseous Form'), gs(5, 3, 'Stinking Cloud'),
    gs(7, 4, 'Greater Invisibility'), gs(7, 4, 'Stone Shape'),
    gs(9, 5, 'Cloudkill'), gs(9, 5, 'Insect Plague'),
  ],
}

// ── Rune Knight runes ─────────────────────────────────────────────────────

export interface RuneDef {
  slug: string
  name: string
  description: string
}

export const RUNE_KNIGHT_RUNES: RuneDef[] = [
  { slug: 'cloud', name: 'Cloud Rune', description: 'Reaction: redirect an attack that hit you or an ally to a different creature. Passive: advantage on Sleight of Hand and Deception.' },
  { slug: 'fire', name: 'Fire Rune', description: 'On weapon hit: restrain target and deal extra 2d6 fire damage. Passive: proficiency with all artisan tools.' },
  { slug: 'frost', name: 'Frost Rune', description: 'Bonus action (10 min): +2 to STR/CON ability checks and STR saves. Passive: proficiency in Athletics and Intimidation.' },
  { slug: 'hill', name: 'Hill Rune', description: 'Reaction (1 min): resistance to bludgeoning, piercing, and slashing damage. Passive: advantage on saves vs. poison.' },
  { slug: 'stone', name: 'Stone Rune', description: 'Reaction: charm and incapacitate a creature (WIS save, 1 min). Passive: darkvision 120ft and advantage on WIS (Insight).' },
  { slug: 'storm', name: 'Storm Rune', description: 'Bonus action (1 min): enter prescient state — impose advantage/disadvantage on any roll within 60ft as a reaction. Passive: proficiency in Arcana.' },
]

// ── Hunter subclass feature choices ───────────────────────────────────────

export interface HunterChoiceDef {
  slug: string
  name: string
  description: string
}

// ── Barbarian Totem Warrior choices ───────────────────────────────────────

export interface TotemAnimalDef {
  slug: string
  name: string
  tierDescs: Record<'spirit' | 'aspect' | 'attunement', string>
}

export const TOTEM_ANIMALS: TotemAnimalDef[] = [
  { slug: 'bear', name: 'Bear', tierDescs: {
    spirit: 'Resistance to all damage except psychic while raging.',
    aspect: 'Carrying capacity doubled; advantage on STR checks for pushing/dragging/lifting.',
    attunement: 'While raging, creatures within 5ft have disadvantage on attacks vs. targets other than you.',
  }},
  { slug: 'eagle', name: 'Eagle', tierDescs: {
    spirit: 'Disengage and Dash as bonus actions while raging; ascend at half speed while raging.',
    aspect: 'See up to 1 mile clearly. Dim light treats as bright light for you.',
    attunement: 'Reaction while raging to make one melee attack against a creature that misses you.',
  }},
  { slug: 'wolf', name: 'Wolf', tierDescs: {
    spirit: 'Allies have advantage on melee attack rolls vs. creatures within 5ft of you while raging.',
    aspect: 'Track at fast pace without penalty; move stealthily at normal pace.',
    attunement: 'While raging, bonus action to knock a Large or smaller creature prone on a hit.',
  }},
  { slug: 'elk', name: 'Elk', tierDescs: {
    spirit: '+15ft walking speed while raging.',
    aspect: 'Carry 5× STR for push/drag; ignore non-magical difficult terrain while mounted.',
    attunement: 'While raging, melee attack deals extra 1d12 damage and creature must make STR save or be knocked prone.',
  }},
  { slug: 'tiger', name: 'Tiger', tierDescs: {
    spirit: 'Proficiency in two skills from Athletics, Acrobatics, Stealth, Survival while raging.',
    aspect: '+10ft jump distance; proficiency in two skills from the above list (always active).',
    attunement: 'While raging, move up to half speed as part of your turn before making a melee attack.',
  }},
]

// Tier keys match featuresChosen keys: 'totem-spirit' (L3), 'totem-aspect' (L6), 'totem-attunement' (L14)
export const TOTEM_TIER_LEVELS: Record<string, number> = {
  'totem-spirit': 3,
  'totem-aspect': 6,
  'totem-attunement': 14,
}

// ── Barbarian Storm Herald aura choices ───────────────────────────────────

export interface StormAuraDef {
  slug: string
  name: string
  description: string
  soulDesc: string
}

export const STORM_AURA_OPTIONS: StormAuraDef[] = [
  { slug: 'desert', name: 'Desert', description: 'Aura (10ft): each enemy in the aura takes 1d6 fire damage at start of their turn while you rage.', soulDesc: 'Fire resistance; can ignite flammable objects.' },
  { slug: 'sea', name: 'Sea', description: 'Aura (10ft): choose one creature in aura, it makes STR save (DC 8+PB+CON) or takes 1d6 lightning + 1d6 thunder damage.', soulDesc: 'Lightning resistance; breathe water; 30ft swim speed.' },
  { slug: 'tundra', name: 'Tundra', description: 'Aura (10ft): each ally gains 2 temp HP at the start of their turn while you rage.', soulDesc: 'Cold resistance; water around you doesn\'t freeze.' },
]

// ── Monk Way of the Four Elements disciplines ──────────────────────────────

export interface FourElementsDisciplineDef {
  slug: string
  name: string
  ki: string
  description: string
}

export const FOUR_ELEMENTS_DISCIPLINES: FourElementsDisciplineDef[] = [
  { slug: 'breath-of-winter', name: 'Breath of Winter', ki: '6 ki', description: 'Cast Cone of Cold.' },
  { slug: 'clench-of-north-wind', name: 'Clench of the North Wind', ki: '3 ki', description: 'Cast Hold Person.' },
  { slug: 'eternal-mountain-defense', name: 'Eternal Mountain Defense', ki: '5 ki', description: 'Cast Stoneskin on yourself.' },
  { slug: 'fangs-of-fire-snake', name: 'Fangs of the Fire Snake', ki: '1 ki', description: 'Unarmed strike extends 10ft and deals fire damage, or spend 1 additional ki after hitting to deal 3d10 extra fire.' },
  { slug: 'fist-of-four-thunders', name: 'Fist of Four Thunders', ki: '2 ki', description: 'Cast Thunderwave.' },
  { slug: 'fist-of-unbroken-air', name: 'Fist of Unbroken Air', ki: '2 ki', description: '30ft ranged strike: 3d10 bludgeoning + knock back 20ft + knock prone (STR save DC = Ki save DC).' },
  { slug: 'flames-of-the-phoenix', name: 'Flames of the Phoenix', ki: '4 ki', description: 'Cast Fireball.' },
  { slug: 'gong-of-the-summit', name: 'Gong of the Summit', ki: '3 ki', description: 'Cast Shatter.' },
  { slug: 'mist-stance', name: 'Mist Stance', ki: '4 ki', description: 'Cast Gaseous Form on yourself.' },
  { slug: 'ride-the-wind', name: 'Ride the Wind', ki: '4 ki', description: 'Cast Fly on yourself.' },
  { slug: 'river-of-hungry-flame', name: 'River of Hungry Flame', ki: '5 ki', description: 'Cast Wall of Fire.' },
  { slug: 'rush-of-the-gale-spirits', name: 'Rush of the Gale Spirits', ki: '2 ki', description: 'Cast Gust of Wind.' },
  { slug: 'shape-the-flowing-river', name: 'Shape the Flowing River', ki: '1 ki', description: 'Action: reshape ice/water in 120ft cone (30ft × 10ft). Freeze, thaw, or redirect water up to 10ft deep.' },
  { slug: 'sweeping-cinder-strike', name: 'Sweeping Cinder Strike', ki: '2 ki', description: 'Cast Burning Hands.' },
  { slug: 'water-whip', name: 'Water Whip', ki: '2 ki', description: '30ft whip: 3d10 bludgeoning + pull up to 25ft toward you or knock prone (DEX save DC = Ki save DC).' },
  { slug: 'wave-of-rolling-earth', name: 'Wave of Rolling Earth', ki: '6 ki', description: 'Cast Wall of Stone.' },
]

export const HUNTER_CHOICES: Record<number, HunterChoiceDef[]> = {
  3: [
    { slug: 'colossus-slayer', name: 'Colossus Slayer', description: 'Once per turn, deal an extra 1d8 damage when you hit a creature that is below its hit point maximum.' },
    { slug: 'giant-killer', name: 'Giant Killer', description: 'Reaction: attack a Large or larger creature within 5ft immediately after it misses you.' },
    { slug: 'horde-breaker', name: 'Horde Breaker', description: 'Once per turn, make a second attack against a different creature adjacent to your primary target.' },
  ],
  7: [
    { slug: 'escape-the-horde', name: 'Escape the Horde', description: 'Opportunity attacks against you are made with disadvantage.' },
    { slug: 'multiattack-defense', name: 'Multiattack Defense', description: 'When a creature hits you, gain +4 AC against all subsequent attacks from that creature this turn.' },
    { slug: 'steel-will', name: 'Steel Will', description: 'Advantage on saving throws against being frightened.' },
  ],
  11: [
    { slug: 'volley', name: 'Volley', description: 'Attack any number of creatures within 10ft of a chosen point within ranged weapon range.' },
    { slug: 'whirlwind-attack', name: 'Whirlwind Attack', description: 'Make a melee attack against any number of creatures within 5ft of you.' },
  ],
  15: [
    { slug: 'evasion', name: 'Evasion', description: 'DEX save: take no damage on success, half damage on failure.' },
    { slug: 'stand-against-the-tide', name: 'Stand Against the Tide', description: 'Reaction: when a creature misses you with a melee attack, force it to repeat the attack against a creature of your choice within range.' },
  ],
}
