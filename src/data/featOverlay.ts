import type { FeatDef } from '../content/loaders'

/**
 * Curated overlay for feats. Keyed by feat slug.
 *
 * The scraper only extracts name + prerequisite + description; everything mechanical
 * (ability score increases, granted spells, proficiencies, passive bonuses, etc.)
 * lives here. Entries are merged on top of the scraped FeatDef at load time.
 *
 * For grants that require a player choice (e.g. Magic Initiate's "two spells from
 * a chosen class list"), populate `grantsSpells` — Creator.tsx and LevelUp.tsx
 * surface an inline chooser from this declaration via `resolveFeatGrants`.
 *
 * Audit via `npm run audit:content` to see which slugs still need filling.
 */
export const FEAT_OVERLAY: Record<string, Partial<FeatDef>> = {
  'alert': {
    initiativeBonus: 5,
    notes: [
      "Can't be surprised while conscious.",
      "Creatures don't gain advantage on attack rolls against you from being hidden.",
    ],
  },

  'mobile': {
    speedBonus: 10,
    notes: [
      "Difficult terrain costs no extra movement when you Dash.",
      "No opportunity attacks from creatures you attack this turn (hit or miss).",
    ],
  },

  'observant': {
    abilityScoreIncrease: { choose: 1, from: ['int', 'wis'], max: 20 },
    passivePerceptionBonus: 5,
    passiveInvestigationBonus: 5,
    notes: [
      "Can read lips if you can see a speaker's mouth and they speak a known language.",
    ],
  },

  'tough': {
    hpBonusPerLevel: 2,
    notes: [
      "HP maximum increases by 2 for every character level (applies retroactively).",
    ],
  },

  'war-caster': {
    concentrationAdvantage: true,
    notes: [
      "Advantage on CON saves to maintain concentration on a spell.",
      "Can perform somatic spell components even with weapons or shield in both hands.",
      "Reaction: cast a spell (1 action or less casting time) as an opportunity attack.",
    ],
  },

  'dragon-hide': {
    abilityScoreIncrease: { choose: 1, from: ['str', 'con', 'cha'], max: 20 },
    naturalArmorBase: 13,
    notes: [
      "Natural armor: AC = 13 + DEX mod when not wearing armor.",
      "Claws are natural weapons dealing 1d4 slashing damage.",
    ],
  },

  'infernal-constitution': {
    abilityScoreIncrease: { choose: 1, from: ['con'], max: 20 },
    resistances: ['cold', 'poison'],
    advantages: ['Saving throws vs poisoned condition'],
    notes: [
      "Resistance to cold and poison damage.",
      "Advantage on saving throws against being poisoned.",
    ],
  },

  'squat-nimbleness': {
    abilityScoreIncrease: { choose: 1, from: ['str', 'dex'], max: 20 },
    speedBonus: 5,
    notes: [
      "Can move through the space of creatures one size larger without penalty.",
      "Gain proficiency (or expertise) in Athletics or Acrobatics.",
    ],
  },

  // ── Feat Spells (explicit grants — no chooser needed) ────────────────────

  'drow-high-magic': {
    grantedSpells: [
      { slug: 'detect-magic', name: 'Detect Magic', level: 1 },
      { slug: 'levitate', name: 'Levitate', level: 2, usesPerLongRest: 1 },
      { slug: 'dispel-magic', name: 'Dispel Magic', level: 3, usesPerLongRest: 1 },
    ],
    notes: [
      "Detect Magic can be cast at will (no slot). Levitate and Dispel Magic 1/LR.",
    ],
  },

  'wood-elf-magic': {
    grantedCantrips: [{ slug: 'druidcraft', name: 'Druidcraft', level: 0 }],
    grantedSpells: [
      { slug: 'longstrider', name: 'Longstrider', level: 1, usesPerLongRest: 1 },
      { slug: 'pass-without-trace', name: 'Pass Without Trace', level: 2, usesPerLongRest: 1 },
    ],
    notes: [
      "Longstrider and Pass Without Trace can each be cast once per long rest without a slot.",
    ],
  },

  'fey-touched': {
    abilityScoreIncrease: { choose: 1, from: ['int', 'wis', 'cha'], max: 20 },
    grantedSpells: [
      { slug: 'misty-step', name: 'Misty Step', level: 2, usesPerLongRest: 1 },
    ],
    grantsSpells: {
      // 1st-level Enchantment OR Divination — pick one school via the overlay.
      // We default to Enchantment here; Divination players should re-pick the spell manually.
      fromSchool: 'enchantment',
      count: 1,
      maxLevel: 1,
      usesPerLongRest: 1,
    },
    notes: [
      "Misty Step can be cast once per long rest without expending a slot.",
      "Also grants one 1st-level Enchantment or Divination spell (cast 1/LR) — chooser surfaces Enchantment by default.",
    ],
  },

  'shadow-touched': {
    abilityScoreIncrease: { choose: 1, from: ['int', 'wis', 'cha'], max: 20 },
    grantedSpells: [
      { slug: 'invisibility', name: 'Invisibility', level: 2, usesPerLongRest: 1 },
    ],
    grantsSpells: {
      fromSchool: 'illusion',
      count: 1,
      maxLevel: 1,
      usesPerLongRest: 1,
    },
    notes: [
      "Invisibility can be cast once per long rest without expending a slot.",
      "Also grants one 1st-level Illusion or Necromancy spell (cast 1/LR) — chooser surfaces Illusion by default.",
    ],
  },

  'fey-teleportation': {
    abilityScoreIncrease: { choose: 1, from: ['int', 'cha'], max: 20 },
    grantedSpells: [
      { slug: 'misty-step', name: 'Misty Step', level: 2, usesPerLongRest: 1 },
    ],
    notes: [
      "Misty Step can be cast once per long rest without a spell slot (INT or CHA-based).",
      "Also grants the Elvish language.",
    ],
  },

  'telepathic': {
    abilityScoreIncrease: { choose: 1, from: ['int', 'wis', 'cha'], max: 20 },
    grantedSpells: [
      { slug: 'detect-thoughts', name: 'Detect Thoughts', level: 2, usesPerLongRest: 1 },
    ],
    notes: [
      "Telepathy to any creature within 60ft you can see (no shared language needed).",
      "Detect Thoughts can be cast once per long rest without a slot.",
    ],
  },

  'telekinetic': {
    abilityScoreIncrease: { choose: 1, from: ['int', 'wis', 'cha'], max: 20 },
    grantedCantrips: [{ slug: 'mage-hand', name: 'Mage Hand (Improved)', level: 0 }],
    notes: [
      "Mage Hand is invisible and can be controlled as a bonus action.",
      "Can shove a creature within 30ft of the hand 5ft (as a bonus action).",
    ],
  },

  // ── Notes-only feats ─────────────────────────────────────────────────────

  'magic-initiate': {
    grantsSpells: {
      fromClassChoice: ['bard', 'cleric', 'druid', 'sorcerer', 'warlock', 'wizard'],
      cantripsCount: 2,
      count: 1,
      maxLevel: 1,
      usesPerLongRest: 1,
    },
    notes: [
      "Grants 2 cantrips and 1 1st-level spell from a chosen class list.",
      "The 1st-level spell can be cast once per long rest without a slot.",
    ],
  },

  'ritual-caster': {
    notes: [
      "Ritual book containing 2 ritual spells of your chosen class.",
      "Can cast spells from the book as rituals (without slots). Add new rituals from scrolls/books.",
    ],
  },

  'artificer-initiate': {
    grantsSpells: {
      fromList: 'artificer',
      cantripsCount: 1,
      count: 1,
      maxLevel: 1,
      usesPerLongRest: 1,
      abilityForCasting: 'int',
    },
    notes: [
      "Grants 1 Artificer cantrip and 1 1st-level Artificer spell.",
      "The 1st-level spell can be cast once per long rest without a slot (INT-based).",
      "Gain proficiency with one type of artisan's tool.",
    ],
  },

  'lucky': {
    notes: [
      "3 luck points per long rest.",
      "Before a roll: spend a point to roll an extra d20, choose which result to use.",
      "Can also use a point to cancel advantage on an attack roll against you.",
    ],
  },

  'resilient': {
    notes: [
      "Grants proficiency in one saving throw of your choice (apply it in the Saving Throws section).",
    ],
  },

  'skilled': {
    notes: [
      "Grants 3 skill or tool proficiencies of your choice (apply them in the Skills section).",
    ],
  },

  'skill-expert': {
    abilityScoreIncrease: { choose: 1, from: ['str', 'dex', 'con', 'int', 'wis', 'cha'], max: 20 },
    grantedExpertise: 1,
    notes: [
      "Grants 1 skill proficiency of your choice.",
      "Grants expertise in 1 proficient skill — choose it below.",
    ],
  },

  'heavily-armored': {
    abilityScoreIncrease: { choose: 1, from: ['str'], max: 20 },
    notes: ["Grants heavy armor proficiency."],
  },

  'lightly-armored': {
    abilityScoreIncrease: { choose: 1, from: ['str', 'dex'], max: 20 },
    notes: ["Grants light armor proficiency."],
  },

  'moderately-armored': {
    abilityScoreIncrease: { choose: 1, from: ['str', 'dex'], max: 20 },
    notes: ["Grants medium armor and shield proficiency."],
  },

  'weapon-master': {
    abilityScoreIncrease: { choose: 1, from: ['str', 'dex'], max: 20 },
    notes: ["Grants proficiency in 4 weapons of your choice."],
  },

  'linguist': {
    abilityScoreIncrease: { choose: 1, from: ['int'], max: 20 },
    notes: ["Grants 3 languages of your choice. Can create written ciphers only you can decode."],
  },

  'great-weapon-master': {
    notes: [
      "On a crit or killing blow with a melee weapon, make one bonus action weapon attack.",
      "Before a heavy weapon attack: take −5 to hit, +10 to damage.",
    ],
  },

  'sharpshooter': {
    notes: [
      "Ignore half and three-quarters cover for ranged attacks.",
      "No disadvantage from attacking at long range.",
      "Before a ranged attack: take −5 to hit, +10 to damage.",
    ],
  },

  'polearm-master': {
    notes: [
      "Bonus action attack with the butt of a polearm (1d4 bludgeoning).",
      "Reaction: attack when a creature enters your reach.",
    ],
  },

  'crossbow-expert': {
    notes: [
      "Ignore the loading property of crossbows.",
      "No disadvantage on ranged attacks within 5ft.",
      "Bonus action: attack with a hand crossbow after a one-handed weapon attack.",
    ],
  },

  'sentinel': {
    notes: [
      "Opportunity attacks drop target speed to 0 for that turn.",
      "Can make OAs against creatures that Disengage.",
      "Reaction: attack when a creature within 5ft attacks someone other than you.",
    ],
  },

  'elven-accuracy': {
    abilityScoreIncrease: { choose: 1, from: ['dex', 'int', 'wis', 'cha'], max: 20 },
    notes: [
      "When you have advantage with a DEX, INT, WIS, or CHA attack roll, reroll one die and take the best of three.",
    ],
  },

  'inspiring-leader': {
    notes: [
      "Spend 10 min: grant up to 6 creatures (incl. yourself) temp HP = CHA mod + Proficiency Bonus.",
      "Recharges on short or long rest.",
    ],
  },

  'chef': {
    abilityScoreIncrease: { choose: 1, from: ['con', 'wis'], max: 20 },
    notes: [
      "During a short rest: up to PB creatures regain an extra 1d8 HP when spending hit dice.",
      "After a long rest: cook PB+4 special treats granting 1 temp HP each (last 8 hours).",
    ],
  },

  'durable': {
    abilityScoreIncrease: { choose: 1, from: ['con'], max: 20 },
    notes: [
      "When rolling Hit Dice for short rest healing, minimum roll = 2 × CON mod.",
    ],
  },

  'mage-slayer': {
    notes: [
      "Reaction: attack a creature within 5ft when they cast a spell.",
      "Your attacks impose disadvantage on that creature's concentration save.",
      "Advantage on saving throws against spells cast by creatures within 5ft.",
    ],
  },

  'shield-master': {
    notes: [
      "Bonus action: shove a creature within 5ft after the Attack action.",
      "+2 to DEX saves while not incapacitated.",
      "Reaction: on a successful DEX save vs a damaging effect, take 0 instead of half.",
    ],
  },

  'tavern-brawler': {
    abilityScoreIncrease: { choose: 1, from: ['str', 'con'], max: 20 },
    notes: [
      "Improvised weapons and unarmed strikes deal 1d4.",
      "Bonus action: attempt a grapple after hitting with an unarmed strike or improvised weapon.",
    ],
  },

  'heavy-armor-master': {
    abilityScoreIncrease: { choose: 1, from: ['str'], max: 20 },
    notes: [
      "Reduce B/P/S damage from non-magical attacks by 3 while wearing heavy armor.",
    ],
  },

  'charger': {
    notes: [
      "After using the Dash action, bonus action melee attack: +5 damage or push 10ft.",
    ],
  },

  'dungeon-delver': {
    notes: [
      "Advantage on Perception and Investigation checks to detect secret doors.",
      "Advantage on saves vs traps. Resistance to trap damage.",
      "Can search for traps while traveling at normal pace.",
    ],
  },

  'healer': {
    notes: [
      "Stabilize a creature with a healer's kit and restore 1 HP.",
      "Action: spend a healer's kit use to heal 1d6+4+creature's max hit dice HP (once per creature per SR).",
    ],
  },

  'savage-attacker': {
    notes: [
      "Once per turn when you roll weapon attack damage, roll the dice twice and take the higher result.",
    ],
  },

  'skulker': {
    notes: [
      "Can hide in dim light or darkness.",
      "Missing with a ranged attack while hidden doesn't reveal your position.",
      "Dim light doesn't impose disadvantage on Perception checks.",
    ],
  },

  'mounted-combatant': {
    notes: [
      "Advantage on melee attacks vs unmounted creatures smaller than your mount.",
      "Can redirect attacks targeting your mount to yourself.",
      "Mount takes 0 damage on a successful DEX save (half on fail).",
    ],
  },

  'martial-adept': {
    notes: [
      "Learn 2 Battle Master Maneuvers and gain 1 Superiority Die (d6, recharges on SR).",
    ],
  },

  'grappler': {
    notes: [
      "Advantage on attack rolls vs creatures you are grappling.",
      "Can use an action to try to pin a grappled creature: both of you are restrained until the grapple ends.",
    ],
  },

  'spell-sniper': {
    grantsSpells: {
      fromClassChoice: ['bard', 'cleric', 'druid', 'sorcerer', 'warlock', 'wizard'],
      cantripsCount: 1,
      count: 0,
    },
    notes: [
      "Double the range of spells that require an attack roll.",
      "Ignore half-cover and three-quarters cover for spell attacks.",
      "Learn 1 cantrip that requires an attack roll (from any class list) — chooser surfaces cantrips, pick an attack-roll one.",
    ],
  },

  'elemental-adept': {
    notes: [
      "Spells you cast ignore resistance to the chosen damage type.",
      "Treat 1s rolled on damage dice as 2s for that damage type.",
    ],
  },

  'fighting-initiate': {
    notes: [
      "Learn 1 Fighting Style from the Fighter list. Can retrain on level-up.",
    ],
  },

  'eldritch-adept': {
    notes: [
      "Learn 1 Eldritch Invocation (must meet any prerequisites). Can retrain on level-up.",
    ],
  },

  'metamagic-adept': {
    notes: [
      "Learn 2 Metamagic options.",
      "Gain 2 Sorcery Points (only usable for Metamagic). Recharges on long rest.",
    ],
  },

  'piercer': {
    abilityScoreIncrease: { choose: 1, from: ['str', 'dex'], max: 20 },
    notes: [
      "Once per turn on a piercing damage hit, reroll one die and use either result.",
      "On a critical hit, roll one additional piercing damage die.",
    ],
  },

  'crusher': {
    abilityScoreIncrease: { choose: 1, from: ['str', 'con'], max: 20 },
    notes: [
      "Once per turn on a bludgeoning hit, push the target 5ft.",
      "On a crit, all attacks vs that creature have advantage until start of your next turn.",
    ],
  },

  'slasher': {
    abilityScoreIncrease: { choose: 1, from: ['str', 'dex'], max: 20 },
    notes: [
      "Once per turn on a slashing hit, reduce target speed by 10ft until start of your next turn.",
      "On a crit, target has disadvantage on attack rolls until start of your next turn.",
    ],
  },

  'poisoner': {
    notes: [
      "Ignore poison resistance when dealing poison damage.",
      "Bonus action: coat a weapon/piece of ammo with potent poison (CON DC 14 or poisoned 1 min).",
    ],
  },

  'gunner': {
    abilityScoreIncrease: { choose: 1, from: ['dex'], max: 20 },
    notes: [
      "Proficiency with firearms.",
      "No disadvantage on ranged attacks within 5ft.",
      "Ignore the loading property of firearms.",
    ],
  },

  'dragon-fear': {
    abilityScoreIncrease: { choose: 1, from: ['str', 'con', 'cha'], max: 20 },
    notes: [
      "Replace a Breath Weapon use: exhale fear in a 30ft cone (WIS DC 8+PB+CHA or frightened 1 min, saves each turn).",
    ],
  },

  'bountiful-luck': {
    notes: [
      "(Halfling only) Reaction: when a friendly creature within 30ft rolls a 1, they may reroll and must use the new result.",
    ],
  },

  'second-chance': {
    abilityScoreIncrease: { choose: 1, from: ['dex', 'con', 'cha'], max: 20 },
    notes: [
      "Reaction: when a creature hits you, force it to reroll the attack. 1 use per initiative.",
    ],
  },

  'fade-away': {
    abilityScoreIncrease: { choose: 1, from: ['dex', 'int'], max: 20 },
    notes: [
      "Reaction: become invisible when you take damage. Ends when you attack, deal damage, or force a save.",
    ],
  },

  'orcish-fury': {
    abilityScoreIncrease: { choose: 1, from: ['str', 'con'], max: 20 },
    notes: [
      "Once per SR: on a weapon hit, deal one extra weapon damage die.",
      "When you use Relentless Endurance, make one weapon attack as a reaction.",
    ],
  },

  'flames-of-phlegethos': {
    abilityScoreIncrease: { choose: 1, from: ['int', 'cha'], max: 20 },
    notes: [
      "When you deal fire damage with a spell, reroll any 1s on the damage dice.",
      "When you cast a fire damage spell, wreath yourself in flames for 1 min (1d4 fire to melee attackers, sheds light).",
    ],
  },

  'prodigy': {
    grantedExpertise: 1,
    notes: [
      "(Human, Half-Elf, or Half-Orc only) Gain 1 skill, 1 tool proficiency, and 1 language of your choice.",
      "Grants expertise in 1 proficient skill — choose it below.",
    ],
  },

  'actor': {
    abilityScoreIncrease: { choose: 1, from: ['cha'], max: 20 },
    notes: [
      "Advantage on Deception and Performance checks when impersonating a creature or pretending to be someone else.",
      "Can mimic the speech of another person or sounds of creatures (WIS DC 17 to detect as fake on a contested check).",
    ],
  },

  'athlete': {
    abilityScoreIncrease: { choose: 1, from: ['str', 'dex'], max: 20 },
    notes: [
      "Climb speed equals walking speed.",
      "Standing from prone costs only 5ft of movement.",
      "Running long jump and high jump require only 5ft of running start.",
    ],
  },

  'defensive-duelist': {
    notes: [
      "Reaction: when hit with a melee attack while wielding a finesse weapon you are proficient in, add your PB to AC for that attack.",
    ],
  },

  // Dual Wielder isn't in the scraped feat list, so this overlay entry is added
  // as a standalone feat (via applyOverlay). It must therefore carry the required
  // FeatDef fields (name, description) — not just enrichment — or it becomes a
  // nameless phantom that crashes name-based search. See merge.ts#applyOverlay.
  'dual-wielder': {
    name: 'Dual Wielder',
    description:
      "You master fighting with two weapons, gaining the following benefits: " +
      "You gain a +1 bonus to AC while you are wielding a separate melee weapon in each hand. " +
      "You can use two-weapon fighting even when the one-handed melee weapons you are wielding aren't light. " +
      "You can draw or stow two one-handed weapons when you would normally be able to draw or stow only one.",
    notes: [
      "+1 to AC while wielding a weapon in each hand.",
      "Can use two-weapon fighting even if weapons aren't light.",
      "Draw or stow two weapons in the same time as one.",
    ],
  },

  'keen-mind': {
    abilityScoreIncrease: { choose: 1, from: ['int'], max: 20 },
    notes: [
      "Always know which direction is north.",
      "Always know the number of hours until sunrise or sunset.",
      "Perfectly recall anything you've seen or heard in the last month.",
    ],
  },

  'medium-armor-master': {
    notes: [
      "Wearing medium armor doesn't impose disadvantage on Stealth checks.",
      "DEX bonus to AC from medium armor increases to a maximum of +3 (instead of +2).",
    ],
  },
}
