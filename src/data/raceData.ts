import { AbilityScores } from '../character/model'
import type { FeatSpell, RaceDef } from '../content/loaders'

export interface SubraceDef {
  slug: string
  name: string
  abilityBonuses: Partial<Record<string, number>>
  traits: string[]
  grantedCantrip?: string // e.g. high elf
  grantedSpells?: FeatSpell[]
}

export type RaceCategory = 'Common' | 'Uncommon' | 'Exotic'

export interface RaceOptionsDef {
  category?: RaceCategory
  subraces?: SubraceDef[]
  abilityBonuses?: Partial<Record<string, number>>
  hasVariant?: boolean
  chooseAbilityBonuses?: number
  bonusSkills?: number
  grantsFeat?: boolean
  hasDraconicAncestry?: boolean
  traits?: string[]
  grantedSkills?: string[]
  skillChoices?: { count: number; from: string[] }
  grantedTools?: string[]
  grantedLanguages?: string[]
  naturalArmor?: { base: number; addDex: boolean }
  resistances?: string[]
  immunities?: string[]
  conditionImmunities?: string[]
  advantages?: string[]
  grantedSpells?: FeatSpell[]
}

export const RACE_OPTIONS: Record<string, RaceOptionsDef> = {
  human: {
    category: 'Common',
    abilityBonuses: { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 },
    hasVariant: true,
    grantedLanguages: ['Common', 'one language of your choice'],
    traits: ['All Ability Scores +1', 'Extra Language'],
  },
  'half-elf': {
    category: 'Common',
    abilityBonuses: { cha: 2 },
    chooseAbilityBonuses: 2,
    bonusSkills: 2,
    grantedLanguages: ['Common', 'Elvish', 'one language of your choice'],
    conditionImmunities: ['magical sleep'],
    advantages: ['Saving throws vs charm'],
    traits: ['Darkvision 60ft', 'Fey Ancestry (immune to magical sleep, adv vs charm)', 'Skill Versatility (2 skill proficiencies of choice)', 'Extra Language'],
  },
  dragonborn: {
    category: 'Common',
    abilityBonuses: { str: 2, cha: 1 },
    hasDraconicAncestry: true,
    grantedLanguages: ['Common', 'Draconic'],
    traits: ['Draconic Ancestry (choose lineage below)', 'Breath Weapon (2d6 damage, DEX/CON save)', 'Damage Resistance (ancestry type)', 'Languages: Common, Draconic'],
  },
  elf: {
    category: 'Common',
    abilityBonuses: { dex: 2 },
    grantedSkills: ['perception'],
    grantedLanguages: ['Common', 'Elvish'],
    conditionImmunities: ['magical sleep'],
    advantages: ['Saving throws vs charm'],
    traits: ['Darkvision 60ft', 'Keen Senses (Perception proficiency)', 'Fey Ancestry (immune to magical sleep, adv vs charm)', 'Trance (4hr rest instead of 8hr)', 'Extra Language'],
    subraces: [
      {
        slug: 'high-elf',
        name: 'High Elf',
        abilityBonuses: { int: 1 },
        traits: ['Elf Weapon Training (longsword, shortsword, shortbow, longbow)', 'Extra Language', 'Cantrip (one Wizard cantrip, INT-based)'],
        grantedCantrip: 'wizard',
      },
      {
        slug: 'wood-elf',
        name: 'Wood Elf',
        abilityBonuses: { wis: 1 },
        traits: ['Elf Weapon Training (longsword, shortsword, shortbow, longbow)', 'Fleet of Foot (speed 35ft)', 'Mask of the Wild (hide in natural phenomena)'],
      },
      {
        slug: 'dark-elf',
        name: 'Dark Elf (Drow)',
        abilityBonuses: { cha: 1 },
        traits: ['Superior Darkvision 120ft', 'Sunlight Sensitivity (disadv in sunlight)', 'Drow Magic (Dancing Lights → Faerie Fire → Darkness, CHA-based)', 'Drow Weapon Training (rapier, shortsword, hand crossbow)'],
        grantedSpells: [
          { slug: 'dancing-lights', name: 'Dancing Lights', level: 0 },
          { slug: 'faerie-fire',    name: 'Faerie Fire',    level: 1, usesPerLongRest: 1 },
          { slug: 'darkness',       name: 'Darkness',       level: 2, usesPerLongRest: 1 },
        ],
      },
      {
        slug: 'eladrin',
        name: 'Eladrin',
        abilityBonuses: { int: 1 },
        traits: ['Fey Step (bonus action teleport 30ft, 1/SR)'],
      },
    ],
  },
  dwarf: {
    category: 'Common',
    abilityBonuses: { con: 2 },
    grantedLanguages: ['Common', 'Dwarvish'],
    resistances: ['poison'],
    advantages: ['Saving throws vs poison'],
    traits: ['Darkvision 60ft', 'Dwarven Resilience (poison resistance, adv on poison saves)', 'Dwarven Combat Training (battleaxe, handaxe, light hammer, warhammer)', 'Tool Proficiency (smith, brewer, or mason tools)', 'Stonecunning (bonus History for stonework)', 'Speed not reduced by heavy armor'],
    subraces: [
      {
        slug: 'hill-dwarf',
        name: 'Hill Dwarf',
        abilityBonuses: { wis: 1 },
        traits: ['Dwarven Toughness (+1 HP per level)'],
      },
      {
        slug: 'mountain-dwarf',
        name: 'Mountain Dwarf',
        abilityBonuses: { str: 2 },
        traits: ['Dwarven Armor Training (light & medium armor proficiency)'],
      },
      {
        slug: 'duergar',
        name: 'Duergar (Gray Dwarf)',
        abilityBonuses: { str: 1 },
        traits: ['Superior Darkvision 120ft', 'Duergar Resilience (adv vs illusions, charm, paralysis)', 'Duergar Magic (Enlarge/Reduce self, Invisibility 1/LR)', 'Sunlight Sensitivity'],
      },
    ],
  },
  gnome: {
    category: 'Common',
    grantedLanguages: ['Common', 'Gnomish'],
    abilityBonuses: { int: 2 },
    traits: ['Darkvision 60ft', 'Gnome Cunning (adv on INT/WIS/CHA saving throws vs magic)'],
    subraces: [
      {
        slug: 'forest-gnome',
        name: 'Forest Gnome',
        abilityBonuses: { dex: 1 },
        traits: ['Natural Illusionist (Minor Illusion cantrip, INT-based)', 'Speak with Small Beasts'],
      },
      {
        slug: 'rock-gnome',
        name: 'Rock Gnome',
        abilityBonuses: { con: 1 },
        traits: ["Artificer's Lore (double prof bonus on magical item History checks)", 'Tinker (craft tiny clockwork devices)'],
      },
      {
        slug: 'deep-gnome',
        name: 'Deep Gnome (Svirfneblin)',
        abilityBonuses: { dex: 1 },
        traits: ['Superior Darkvision 120ft', 'Stone Camouflage (adv on Stealth in rocky terrain)', 'Extra Language (Undercommon)'],
      },
    ],
  },
  halfling: {
    category: 'Common',
    grantedLanguages: ['Common', 'Halfling'],
    abilityBonuses: { dex: 2 },
    traits: ['Lucky (reroll 1s on attack rolls, ability checks, saves)', 'Brave (adv vs frightened)', 'Halfling Nimbleness (move through space of larger creatures)'],
    subraces: [
      {
        slug: 'lightfoot',
        name: 'Lightfoot Halfling',
        abilityBonuses: { cha: 1 },
        traits: ['Naturally Stealthy (hide behind larger creatures)'],
      },
      {
        slug: 'stout',
        name: 'Stout Halfling',
        abilityBonuses: { con: 1 },
        traits: ['Stout Resilience (poison resistance & adv on poison saves)'],
      },
    ],
  },
  tiefling: {
    category: 'Common',
    grantedLanguages: ['Common', 'Infernal'],
    abilityBonuses: { int: 1, cha: 2 },
    resistances: ['fire'],
    traits: ['Darkvision 60ft', 'Hellish Resistance (fire damage resistance)'],
    subraces: [
      {
        slug: 'standard',
        name: 'Standard (Asmodeus)',
        abilityBonuses: {},
        traits: ['Infernal Legacy: Thaumaturgy cantrip → Hellish Rebuke (L3) → Darkness (L5), CHA-based'],
        grantedSpells: [
          { slug: 'thaumaturgy',   name: 'Thaumaturgy',   level: 0 },
          { slug: 'hellish-rebuke',name: 'Hellish Rebuke', level: 1, usesPerLongRest: 1 },
          { slug: 'darkness',      name: 'Darkness',       level: 2, usesPerLongRest: 1 },
        ],
      },
      {
        slug: 'asmodeus',
        name: 'Asmodeus Tiefling',
        abilityBonuses: {},
        traits: ['Infernal Legacy: Thaumaturgy cantrip → Hellish Rebuke (L3) → Darkness (L5), CHA-based'],
        grantedSpells: [
          { slug: 'thaumaturgy',   name: 'Thaumaturgy',   level: 0 },
          { slug: 'hellish-rebuke',name: 'Hellish Rebuke', level: 1, usesPerLongRest: 1 },
          { slug: 'darkness',      name: 'Darkness',       level: 2, usesPerLongRest: 1 },
        ],
      },
      {
        slug: 'zariel',
        name: 'Zariel Tiefling',
        abilityBonuses: { str: 1, cha: 1, int: 0 },
        traits: ['Infernal Legacy: Thaumaturgy cantrip → Searing Smite (L3) → Branding Smite (L5), CHA-based'],
        grantedSpells: [
          { slug: 'thaumaturgy',   name: 'Thaumaturgy',    level: 0 },
          { slug: 'searing-smite', name: 'Searing Smite',  level: 1, usesPerLongRest: 1 },
          { slug: 'branding-smite',name: 'Branding Smite', level: 2, usesPerLongRest: 1 },
        ],
      },
    ],
  },
  aasimar: {
    category: 'Uncommon',
    grantedLanguages: ['Common', 'Celestial'],
    abilityBonuses: { cha: 2 },
    resistances: ['necrotic', 'radiant'],
    traits: ['Darkvision 60ft', 'Celestial Resistance (necrotic & radiant resistance)', 'Healing Hands (touch heal = level HP, 1/LR)', 'Light Bearer (Light cantrip)'],
    subraces: [
      {
        slug: 'protector',
        name: 'Protector Aasimar',
        abilityBonuses: { wis: 1 },
        traits: ['Radiant Soul (1 min: fly speed = walk speed, radiant damage on attacks = level, 1/LR)'],
      },
      {
        slug: 'scourge',
        name: 'Scourge Aasimar',
        abilityBonuses: { con: 1 },
        traits: ['Radiant Consumption (1 min: aura of light, level radiant damage to nearby creatures & self, 1/LR)'],
      },
      {
        slug: 'fallen',
        name: 'Fallen Aasimar',
        abilityBonuses: { str: 1 },
        traits: ['Necrotic Shroud (1 min: wings appear, nearby enemies frightened DC 13 CHA, necrotic bonus on attacks = level, 1/LR)'],
      },
    ],
  },
  'half-orc': {
    category: 'Common',
    grantedLanguages: ['Common', 'Orc'],
    abilityBonuses: { str: 2, con: 1 },
    grantedSkills: ['intimidation'],
    traits: ['Darkvision 60ft', 'Menacing (Intimidation proficiency)', 'Relentless Endurance (drop to 1 HP instead of 0, 1/LR)', 'Savage Attacks (extra weapon damage die on melee crit)'],
  },
  'sea-elf': {
    category: 'Uncommon',
    grantedLanguages: ['Common', 'Elvish', 'Aquan'],
    abilityBonuses: { dex: 2, con: 1 },
    grantedSkills: ['perception'],
    conditionImmunities: ['magical sleep'],
    advantages: ['Saving throws vs charm'],
    traits: ['Darkvision 60ft', 'Child of the Sea (swim speed 30ft, breathe water)', 'Keen Senses (Perception proficiency)', 'Fey Ancestry', 'Friend of the Sea (communicate with swimming beasts)'],
  },
  'shadar-kai': {
    category: 'Uncommon',
    grantedLanguages: ['Common', 'Elvish'],
    abilityBonuses: { dex: 2, con: 1 },
    grantedSkills: ['perception'],
    resistances: ['necrotic'],
    conditionImmunities: ['magical sleep'],
    advantages: ['Saving throws vs charm'],
    traits: ['Darkvision 60ft', 'Fey Ancestry', 'Necrotic Resistance', 'Blessing of the Raven Queen (teleport 30ft + resistance to all damage until next turn, 1/LR)'],
  },
  eladrin: {
    category: 'Uncommon',
    grantedLanguages: ['Common', 'Elvish'],
    abilityBonuses: { dex: 2, int: 1 },
    grantedSkills: ['perception'],
    conditionImmunities: ['magical sleep'],
    advantages: ['Saving throws vs charm'],
    traits: ['Darkvision 60ft', 'Fey Ancestry', 'Trance', 'Fey Step (bonus action teleport 30ft, 1/SR)', 'Keen Senses'],
  },
  'deep-gnome': {
    category: 'Uncommon',
    abilityBonuses: { int: 2, dex: 1 },
    advantages: ['INT/WIS/CHA saving throws vs magic'],
    traits: ['Superior Darkvision 120ft', 'Gnome Cunning', 'Stone Camouflage (adv Stealth in rocky terrain)'],
  },
  duergar: {
    category: 'Uncommon',
    abilityBonuses: { con: 2, str: 1 },
    resistances: ['poison'],
    advantages: ['Saving throws vs poison', 'Saving throws vs illusions', 'Saving throws vs charm', 'Saving throws vs paralysis'],
    traits: ['Superior Darkvision 120ft', 'Dwarven Resilience', 'Duergar Resilience (adv vs illusions, charm, paralysis)', 'Duergar Magic (Enlarge self, Invisibility 1/LR)', 'Sunlight Sensitivity', 'Extra Language (Undercommon)'],
  },
  aarakocra: {
    category: 'Exotic',
    grantedLanguages: ['Common', 'Aarakocra', 'Auran'],
    abilityBonuses: { dex: 2, wis: 1 },
    traits: ['Flight 50ft (no armor)', 'Talons (unarmed strike 1d4 slashing)', 'Languages: Common, Aarakocra, Auran'],
  },
  bugbear: {
    category: 'Exotic',
    abilityBonuses: { str: 2, dex: 1 },
    grantedSkills: ['stealth'],
    traits: ['Darkvision 60ft', 'Long-Limbed (+5ft reach with melee on your turn)', 'Powerful Build (count as Large for carry capacity)', 'Sneaky (Stealth proficiency)', 'Surprise Attack (+2d6 damage on first hit if target surprised)'],
  },
  centaur: {
    category: 'Exotic',
    abilityBonuses: { str: 2, wis: 1 },
    traits: ['Charge (after 30ft move, bonus action gore attack 1d8+STR, DC 14 STR or knocked prone)', 'Hooves (unarmed 1d4 bludgeoning)', 'Equine Build (Large carry capacity, climb penalty)', 'Survivor (Nature proficiency)', 'Speed 40ft'],
  },
  changeling: {
    category: 'Uncommon',
    abilityBonuses: { cha: 2 },
    chooseAbilityBonuses: 1,
    skillChoices: { count: 2, from: ['deception', 'insight', 'intimidation', 'persuasion'] },
    traits: ['Shapechanger (alter appearance as an action)', 'Changeling Instincts (choose 2: Deception, Insight, Intimidation, or Persuasion)'],
  },
  fairy: {
    category: 'Exotic',
    abilityBonuses: { dex: 1, wis: 1 },
    traits: ['Flight 30ft', 'Fairy Magic (Druidcraft cantrip → Faerie Fire (L3) → Enlarge/Reduce (L5), WIS-based)', 'Fey (creature type)'],
  },
  firbolg: {
    category: 'Uncommon',
    abilityBonuses: { wis: 2, str: 1 },
    traits: ['Firbolg Magic (Detect Magic & Disguise Self 1/SR, no concentration)', 'Hidden Step (bonus action invisibility until next turn start, 1/SR)', 'Powerful Build (count as Large for carry capacity)', 'Speech of Beast and Leaf (communicate with beasts & plants)'],
  },
  'genasi-air': {
    category: 'Uncommon',
    abilityBonuses: { dex: 2, con: 1 },
    traits: ['Unending Breath (hold breath indefinitely)', 'Mingle with the Wind (Levitate 1/LR, CON-based)'],
  },
  'genasi-earth': {
    category: 'Uncommon',
    abilityBonuses: { str: 2, con: 1 },
    traits: ['Earth Walk (move across difficult terrain of earth/stone without cost)', 'Merge with Stone (Pass without Trace 1/LR, CON-based)'],
  },
  'genasi-fire': {
    category: 'Uncommon',
    abilityBonuses: { int: 1, con: 2 },
    resistances: ['fire'],
    traits: ['Darkvision 60ft', 'Fire Resistance', 'Reach to the Blaze (Produce Flame cantrip → Burning Hands (L3) → Flame Blade (L5), CON-based)'],
  },
  'genasi-water': {
    category: 'Uncommon',
    abilityBonuses: { wis: 1, con: 2 },
    resistances: ['acid'],
    traits: ['Acid Resistance', 'Amphibious (breathe air & water)', 'Swim 30ft', 'Call to the Wave (Shape Water cantrip → Create or Destroy Water (L3) → Water Walk (L5), CON-based)'],
  },
  githyanki: {
    category: 'Exotic',
    grantedLanguages: ['Common', 'Gith'],
    abilityBonuses: { str: 2, int: 1 },
    traits: ['Decadent Mastery (1 extra language & 1 extra tool/skill)', 'Martial Prodigy (light & medium armor, shortsword, longsword, greatsword prof)', 'Githyanki Psionics (Mage Hand → Jump (L3) → Misty Step (L5), INT-based)'],
  },
  githzerai: {
    category: 'Exotic',
    grantedLanguages: ['Common', 'Gith'],
    abilityBonuses: { wis: 2, int: 1 },
    advantages: ['Saving throws vs charmed', 'Saving throws vs frightened'],
    traits: ['Mental Discipline (adv on saves vs charmed & frightened)', 'Githzerai Psionics (Mage Hand → Shield (L3) → Detect Thoughts (L5), WIS-based)'],
  },
  goblin: {
    category: 'Exotic',
    grantedLanguages: ['Common', 'Goblin'],
    abilityBonuses: { dex: 2, con: 1 },
    traits: ['Darkvision 60ft', 'Fury of the Small (extra damage = level to larger creature 1/SR)', 'Nimble Escape (Disengage or Hide as bonus action)', 'Speed 30ft'],
  },
  goliath: {
    category: 'Uncommon',
    abilityBonuses: { str: 2, con: 1 },
    grantedSkills: ['athletics'],
    resistances: ['cold'],
    traits: ['Natural Athlete (Athletics proficiency)', "Stone's Endurance (reaction: reduce damage by 1d12+CON, 1/SR)", 'Powerful Build (count as Large for carry capacity)', 'Mountain Born (cold resistance, acclimated to high altitude)'],
  },
  harengon: {
    category: 'Exotic',
    abilityBonuses: { dex: 2 },
    chooseAbilityBonuses: 1,
    grantedSkills: ['perception'],
    traits: ['Hare-Trigger (add PB to initiative)', 'Leporine Senses (Perception proficiency)', 'Lucky Footwork (reaction: add d4 to DEX save vs fall prone, 1/LR)', 'Rabbit Hop (bonus action jump = PB × 5ft, 1/LR)'],
  },
  hobgoblin: {
    category: 'Exotic',
    grantedLanguages: ['Common', 'Goblin'],
    abilityBonuses: { con: 2, int: 1 },
    traits: ['Darkvision 60ft', 'Martial Training (light armor + 2 martial weapons)', 'Saving Face (add missed d4s up to PB if an ally can see you, 1/SR)'],
  },
  kalashtar: {
    category: 'Uncommon',
    grantedLanguages: ['Common', 'Quori', 'one language of your choice'],
    abilityBonuses: { wis: 2, cha: 1 },
    resistances: ['psychic'],
    conditionImmunities: ['dream spells', 'magical sleep'],
    advantages: ['WIS saving throws'],
    traits: ['Dual Mind (adv on WIS saving throws)', 'Mental Discipline (psychic damage resistance)', 'Mind Link (telepathy up to 60ft to creatures you know)', 'Severed from Dreams (immune to dream magic & spells that require sleep)', 'Extra Language'],
  },
  kenku: {
    category: 'Uncommon',
    grantedLanguages: ['Common', 'Auran'],
    abilityBonuses: { dex: 2, wis: 1 },
    skillChoices: { count: 2, from: ['acrobatics', 'deception', 'stealth', 'sleightOfHand'] },
    traits: ['Expert Forgery (adv on checks to produce written fakes)', 'Kenku Training (2 skills from Acrobatics/Deception/Stealth/Sleight of Hand)', 'Mimicry (perfectly copy sounds & voices heard)'],
  },
  kobold: {
    category: 'Exotic',
    abilityBonuses: { dex: 2 },
    chooseAbilityBonuses: 1,
    traits: ['Darkvision 60ft', 'Draconic Cry (bonus action: enemies in 10ft disadv on saves vs you until next turn, 1/SR)', 'Kobold Legacy (choose: Cunning Instinct / Draconic Sorcery / Pack Tactics)'],
  },
  lizardfolk: {
    category: 'Uncommon',
    abilityBonuses: { con: 2, wis: 1 },
    skillChoices: { count: 2, from: ['animalHandling', 'nature', 'perception', 'stealth', 'survival'] },
    naturalArmor: { base: 13, addDex: true },
    traits: ['Bite (1d6 piercing unarmed strike)', 'Cunning Artisan (bonus action craft shield/club/javelin from slain creature)', 'Hold Breath (15 minutes)', "Hunter's Lore (2 skills from Animal Handling/Nature/Perception/Stealth/Survival)", 'Natural Armor (AC 13+DEX when unarmored)', 'Hungry Jaws (bonus action bite for temp HP = CON mod min 1, 1/SR)'],
  },
  locathah: {
    category: 'Exotic',
    abilityBonuses: { str: 2, con: 1 },
    traits: ['Natural Armor (AC 13+DEX when unarmored)', 'Leviathan Will (adv vs charmed/frightened/paralyzed/poisoned/stunned/unconscious)', 'Limited Amphibiousness (breathe water; survive 1 hour out of water)', 'Swim 30ft'],
  },
  minotaur: {
    category: 'Exotic',
    abilityBonuses: { str: 2, con: 1 },
    skillChoices: { count: 1, from: ['intimidation', 'persuasion'] },
    traits: ['Horns (1d6 piercing unarmed)', 'Goring Rush (Dash → bonus action horn attack)', 'Hammering Horns (shove after melee hit as bonus action)', 'Imposing Presence (Intimidation or Persuasion proficiency)'],
  },
  orc: {
    category: 'Exotic',
    abilityBonuses: { str: 2, con: 1 },
    skillChoices: { count: 2, from: ['animalHandling', 'insight', 'intimidation', 'medicine', 'nature', 'perception', 'survival'] },
    traits: ['Darkvision 60ft', 'Aggressive (bonus action: move up to speed toward enemy)', 'Powerful Build (count as Large for carry capacity)', 'Primal Intuition (2 skills from Animal Handling/Insight/Intimidation/Medicine/Nature/Perception/Survival)'],
  },
  owlin: {
    category: 'Exotic',
    abilityBonuses: { wis: 2 },
    chooseAbilityBonuses: 1,
    traits: ['Darkvision 120ft', 'Flight 30ft', 'Silent Feathers (Stealth proficiency)', 'Languages: Common + one other'],
  },
  satyr: {
    category: 'Exotic',
    abilityBonuses: { cha: 2, dex: 1 },
    grantedSkills: ['performance', 'persuasion'],
    traits: ['Fey (creature type — magic resistance vs spells)', 'Ram (1d4 bludgeoning unarmed)', 'Magic Resistance (adv on saves vs spells & magical effects)', 'Mirthful Leaps (roll 1d8 on jump & add to jump distance)', 'Reveler (Performance & Persuasion proficiency)'],
  },
  shifter: {
    category: 'Uncommon',
    abilityBonuses: { dex: 2 },
    chooseAbilityBonuses: 1,
    traits: ['Darkvision 60ft', 'Shifting (bonus action: temporary HP = PB + CON mod; gain subrace trait for 1 min, 1/SR)'],
  },
  tabaxi: {
    category: 'Uncommon',
    grantedLanguages: ['Common', 'one language of your choice'],
    abilityBonuses: { dex: 2, cha: 1 },
    grantedSkills: ['perception', 'stealth'],
    traits: ['Darkvision 60ft', 'Feline Agility (double speed until end of turn; must not move on next turn to use again)', "Cat's Claws (climb speed 20ft, unarmed 1d6 slashing)", "Cat's Talent (Perception & Stealth proficiency)"],
  },
  tortle: {
    category: 'Exotic',
    abilityBonuses: { str: 2, wis: 1 },
    grantedSkills: ['survival'],
    naturalArmor: { base: 17, addDex: false },
    traits: ['Claws (1d4 slashing unarmed)', 'Hold Breath (1 hour)', 'Natural Armor (AC 17 fixed, no shield)', 'Shell Defense (action: enter shell — AC 19, prone, only emerge on your turn, 1 action)', 'Survival Instinct (Survival proficiency)'],
  },
  triton: {
    category: 'Uncommon',
    grantedLanguages: ['Common', 'Primordial'],
    abilityBonuses: { str: 1, con: 1, cha: 1 },
    resistances: ['cold'],
    traits: ['Amphibious (breathe air & water)', 'Control Air and Water (Fog Cloud → Gust of Wind (L3) → Wall of Water (L5), CHA-based)', 'Darkvision 60ft', 'Emissary of the Sea (speak with beasts that breathe water)', 'Guardians of the Depths (cold resistance, immune to pressure)'],
  },
  verdan: {
    category: 'Exotic',
    abilityBonuses: { con: 1, cha: 2 },
    resistances: ['psychic'],
    advantages: ['WIS saving throws', 'CHA saving throws'],
    traits: ['Darkvision 60ft', 'Psychic Resilience (psychic resistance)', 'Telepathic Insight (adv on WIS & CHA saves)', 'Telepathy (read surface thoughts of willing creature, share language)'],
  },
  warforged: {
    category: 'Uncommon',
    grantedLanguages: ['Common', 'one language of your choice'],
    abilityBonuses: { con: 2 },
    chooseAbilityBonuses: 1,
    skillChoices: { count: 1, from: ['acrobatics','animalHandling','arcana','athletics','deception','history','insight','intimidation','investigation','medicine','nature','perception','performance','persuasion','religion','sleightOfHand','stealth','survival'] },
    grantedTools: ['one tool of your choice'],
    resistances: ['poison'],
    immunities: ['disease'],
    conditionImmunities: ['magical sleep'],
    advantages: ['Saving throws vs poison', 'Saving throws vs exhaustion'],
    traits: ['Constructed Resilience (adv vs poison, resistance to poison, immune to disease, no need to eat/drink/breathe, immune to magic sleep)', "Sentry's Rest (6hr inactive rest still counts as long rest)", 'Integrated Protection (+1 AC; armor integrates into body)', 'Specialized Design (1 tool proficiency + 1 skill proficiency)'],
  },
  'yuan-ti': {
    category: 'Exotic',
    grantedLanguages: ['Common', 'Abyssal', 'Draconic'],
    abilityBonuses: { cha: 2, int: 1 },
    immunities: ['poison'],
    conditionImmunities: ['poisoned'],
    advantages: ['Saving throws vs spells', 'Saving throws vs magical effects'],
    traits: ['Darkvision 60ft', 'Magic Resistance (adv on saves vs spells & magical effects)', 'Poison Immunity (immune to poison damage & poisoned condition)', 'Serpentine Spellcasting (Poison Spray cantrip → Animal Friendship on beasts only (L3) → Suggestion (L5), CHA-based)'],
  },

  // ── Van Richten's Guide to Ravenloft ────────────────────────────────────────
  dhampir: {
    category: 'Uncommon',
    chooseAbilityBonuses: 3,
    grantedLanguages: ['Common', 'one language of your choice'],
    traits: ['Darkvision 60ft', 'Ancestral Legacy (replace 2 skill proficiencies from background)', 'Vampiric Bite (1d4+CON piercing unarmed; gain PB temp HP on hit; 1/SR)', 'Spider Climb (1/LR)'],
  },
  hexblood: {
    category: 'Uncommon',
    chooseAbilityBonuses: 3,
    grantedLanguages: ['Common', 'one language of your choice'],
    traits: ['Darkvision 60ft', 'Ancestral Legacy', 'Eerie Token (1/LR: create a token that sends a message from up to 10 miles)', 'Hex Magic (Disguise Self & Hex 1/LR, WIS/INT-based)'],
    grantedSpells: [
      { slug: 'disguise-self', name: 'Disguise Self', level: 1, usesPerLongRest: 1 },
      { slug: 'hex',           name: 'Hex',           level: 1, usesPerLongRest: 1 },
    ],
  },
  reborn: {
    category: 'Uncommon',
    chooseAbilityBonuses: 3,
    grantedLanguages: ['Common', 'two languages of your choice'],
    traits: ['Darkvision 60ft', 'Ancestral Legacy', 'Deathless Nature (no breathe, adv vs disease/poison, no eat/drink, immune to magical sleep)', 'Knowledge from a Past Life (add 1d6 to ability checks 1/LR)'],
    resistances: ['poison'],
    conditionImmunities: ['magical sleep'],
  },

  // ── Guildmaster's Guide to Ravnica ──────────────────────────────────────────
  loxodon: {
    category: 'Uncommon',
    abilityBonuses: { con: 2, wis: 1 },
    grantedLanguages: ['Common', 'Loxodon'],
    naturalArmor: { base: 12, addDex: true },
    traits: ['Natural Armor (AC 12+CON mod)', 'Trunk (dextrous appendage; smell 30ft, manipulate objects, hold one item)', 'Keen Smell (adv on Perception, Investigation, Survival using smell)', 'Powerful Build (count as Large)', "Loxodon Serenity (adv on saves vs being charmed or frightened)"],
    advantages: ['Saving throws vs charmed', 'Saving throws vs frightened'],
  },
  'simic-hybrid': {
    category: 'Uncommon',
    abilityBonuses: { con: 2 },
    chooseAbilityBonuses: 1,
    grantedLanguages: ['Common', 'Elvish or Merfolk'],
    traits: ['Darkvision 60ft', 'Animal Enhancement: choose 2 from Manta Glide / Nimble Climber / Underwater Adaptation / Grappling Appendages / Carapace / Acid Spit'],
  },
  vedalken: {
    category: 'Uncommon',
    abilityBonuses: { int: 2, wis: 1 },
    grantedLanguages: ['Common', 'Vedalken', 'two languages of your choice'],
    advantages: ['INT saving throws', 'WIS saving throws', 'CHA saving throws'],
    traits: ['Vedalken Dispassion (adv on all INT/WIS/CHA saves)', 'Tireless Precision (proficiency in one skill or tool; roll 1d4 on those checks)', 'Partially Amphibious (hold breath 1 hour)', 'Extra Languages (total 4)'],
  },

  // ── Spelljammer: Adventures in Space ───────────────────────────────────────
  autognome: {
    category: 'Uncommon',
    chooseAbilityBonuses: 3,
    grantedLanguages: ['Common', 'Gnomish'],
    conditionImmunities: ['magical sleep'],
    traits: ['Built for Success (add 1d4 to one attack/ability check/save 1/LR)', 'Mechanical Nature (no breathe/eat/drink, immune to disease, immune to magic sleep)', "Sentry's Rest (6hr inactive = long rest)", 'Specialized Design (1 skill + 1 tool proficiency)', 'Armored Casing (+1 AC)'],
  },
  giff: {
    category: 'Exotic',
    abilityBonuses: { str: 2, con: 1 },
    grantedLanguages: ['Common', 'Giff'],
    traits: ['Hippo Build (Powerful Build)', 'Firearms Mastery (no disadv on firearms in melee; martial weapon proficiency with all firearms)', 'Headfirst Charge (Dash + bonus action melee attack after moving 20ft straight)'],
  },
  hadozee: {
    category: 'Exotic',
    abilityBonuses: { dex: 2 },
    chooseAbilityBonuses: 1,
    grantedLanguages: ['Common', 'Hadozee'],
    traits: ['Glide (use reaction to glide when falling; 5ft horizontal per 1ft fallen)', 'Dexterous Feet (make DC 10 DEX check to use feet as a bonus action to do simple tasks)', 'Hadozee Resilience (reduce damage to 0 and not fall prone 1/LR when hit)'],
  },
  plasmoid: {
    category: 'Exotic',
    chooseAbilityBonuses: 3,
    grantedLanguages: ['Common'],
    immunities: ['poison'],
    conditionImmunities: ['poisoned', 'grappled', 'restrained'],
    traits: ['Amorphous (squeeze through 1-inch gaps)', 'Pseudopod (10ft reach unarmed strike)', 'Ooze Nature (no breathe/eat/drink, immune to poison damage & poisoned, no sleep needed)', 'Shape Self (alter color and shape; advantage on Deception vs creatures seeing your true form)'],
  },
  'thri-kreen': {
    category: 'Exotic',
    chooseAbilityBonuses: 3,
    grantedLanguages: ['Thri-kreen (telepathic; can understand Common but cannot speak it)'],
    naturalArmor: { base: 13, addDex: true },
    traits: ['Darkvision 60ft', 'Secondary Arms (2 extra arms; hold/use light weapons & hand crossbows)', 'Sleepless (no magical sleep; no need to sleep)', 'Carapace (natural AC 13+DEX)', 'Telepathy (60ft; no shared language required)'],
    conditionImmunities: ['magical sleep'],
  },

  // ── Mythic Odysseys of Theros ───────────────────────────────────────────────
  leonin: {
    category: 'Uncommon',
    abilityBonuses: { con: 2, str: 1 },
    grantedLanguages: ['Common', 'Leonin'],
    grantedSkills: ['intimidation'],
    traits: ['Darkvision 60ft', 'Claws (1d4 slashing unarmed; bonus action two-claw flurry 1/SR)', "Hunter's Instincts (Intimidation, Perception, or Survival proficiency)", 'Daunting Roar (bonus action: frighten enemies in 10ft until end of next turn, WIS save DC 8+PB+CON, 1/SR)', 'Speed 35ft'],
  },

  // ── Dragonlance: Shadow of the Dragon Queen ─────────────────────────────────
  kender: {
    category: 'Uncommon',
    abilityBonuses: { dex: 2, cha: 1 },
    grantedLanguages: ['Common', 'one language of your choice'],
    traits: ['Fearless (immune to the frightened condition)', 'Kender Aptitude (proficiency in one of: Insight/Investigation/Sleight of Hand/Stealth/Thieves\' Tools; roll min 10 on those checks 1/LR)', 'Taunt (bonus action: impose disadv on one enemy\'s attacks vs others, WIS save DC 8+PB+CHA, 1/SR)'],
    conditionImmunities: ['frightened'],
  },
}

export const DRACONIC_ANCESTRIES = [
  { slug: 'black',  name: 'Black',  damageType: 'Acid',      breathShape: '5×30ft line', saveType: 'DEX' },
  { slug: 'blue',   name: 'Blue',   damageType: 'Lightning', breathShape: '5×30ft line', saveType: 'DEX' },
  { slug: 'brass',  name: 'Brass',  damageType: 'Fire',      breathShape: '5×30ft line', saveType: 'DEX' },
  { slug: 'bronze', name: 'Bronze', damageType: 'Lightning', breathShape: '5×30ft line', saveType: 'DEX' },
  { slug: 'copper', name: 'Copper', damageType: 'Acid',      breathShape: '5×30ft line', saveType: 'DEX' },
  { slug: 'gold',   name: 'Gold',   damageType: 'Fire',      breathShape: '15ft cone',   saveType: 'DEX' },
  { slug: 'green',  name: 'Green',  damageType: 'Poison',    breathShape: '15ft cone',   saveType: 'CON' },
  { slug: 'red',    name: 'Red',    damageType: 'Fire',      breathShape: '15ft cone',   saveType: 'DEX' },
  { slug: 'silver', name: 'Silver', damageType: 'Cold',      breathShape: '15ft cone',   saveType: 'CON' },
  { slug: 'white',  name: 'White',  damageType: 'Cold',      breathShape: '15ft cone',   saveType: 'CON' },
]

export function applyRaceAbilityBonuses(
  base: AbilityScores,
  race: RaceDef | undefined,
  subraceSlug?: string
): AbilityScores {
  if (!race) return base
  const scores = { ...base } as Record<string, number>

  const bonuses = { ...(race.abilityBonuses ?? {}) }
  if (subraceSlug) {
    const subrace = race.subraces?.find(s => s.slug === subraceSlug)
    if (subrace?.abilityBonuses) {
      for (const [k, v] of Object.entries(subrace.abilityBonuses)) {
        bonuses[k] = (bonuses[k] ?? 0) + (v ?? 0)
      }
    }
  }
  for (const [k, v] of Object.entries(bonuses)) {
    if (v !== undefined) scores[k] = Math.min(20, (scores[k] ?? 10) + v)
  }
  return scores as AbilityScores
}
