// Common Wild Shape forms, from the beasts in the free 5e basic rules (SRD 5.1), up to CR 6 (a level 18
// Circle of the Moon druid), plus the four elementals of the Moon druid's Elemental Wild Shape. Only
// what the sheet needs: the druid keeps their own INT, WIS and CHA in beast form, so those aren't
// listed. Anything else can be entered as a custom form.

export interface BeastAttack { name: string; toHit: number; damage: string; damageType: string; notes?: string }
export interface Beast {
  slug: string
  name: string
  cr: number            // challenge rating (1/4 = 0.25)
  ac: number
  hp: number
  speed: number         // walking speed in feet
  otherSpeeds?: string  // "climb 30 ft", "swim 30 ft", "fly 80 ft"
  swims?: boolean
  flies?: boolean
  str: number
  dex: number
  con: number
  attacks: BeastAttack[]
  traits: { name: string; description: string }[]
  resistances?: string[]
  immunities?: string[]   // damage types and conditions
  elemental?: boolean     // Elemental Wild Shape (Moon 10): costs both uses, no CR or movement limits
}

export const WILD_SHAPE_BEASTS: Beast[] = [
  {
    slug: 'cat', name: 'Cat', cr: 0, ac: 12, hp: 2, speed: 40, otherSpeeds: 'climb 30 ft', str: 3, dex: 15, con: 10,
    attacks: [{ name: 'Claws', toHit: 0, damage: '1', damageType: 'slashing' }],
    traits: [{ name: 'Keen Smell', description: 'Advantage on Wisdom (Perception) checks that rely on smell.' }],
  },
  {
    slug: 'wolf', name: 'Wolf', cr: 0.25, ac: 13, hp: 11, speed: 40, str: 12, dex: 15, con: 12,
    attacks: [{ name: 'Bite', toHit: 4, damage: '2d4+2', damageType: 'piercing', notes: 'DC 11 STR save or knocked prone' }],
    traits: [
      { name: 'Keen Hearing and Smell', description: 'Advantage on Wisdom (Perception) checks that rely on hearing or smell.' },
      { name: 'Pack Tactics', description: 'Advantage on attacks against a creature with an ally of yours within 5 ft of it.' },
    ],
  },
  {
    slug: 'panther', name: 'Panther', cr: 0.25, ac: 12, hp: 13, speed: 50, otherSpeeds: 'climb 40 ft', str: 14, dex: 15, con: 10,
    attacks: [
      { name: 'Claw', toHit: 4, damage: '1d4+2', damageType: 'slashing' },
      { name: 'Bite', toHit: 4, damage: '1d6+2', damageType: 'piercing' },
    ],
    traits: [{ name: 'Pounce', description: 'Move 20 ft straight then hit with a claw: DC 12 STR save or prone, then a bite as a bonus action.' }],
  },
  {
    slug: 'ape', name: 'Ape', cr: 0.5, ac: 12, hp: 19, speed: 30, otherSpeeds: 'climb 30 ft', str: 16, dex: 14, con: 14,
    attacks: [{ name: 'Fist (×2)', toHit: 5, damage: '1d6+3', damageType: 'bludgeoning', notes: 'Two fist attacks' }],
    traits: [],
  },
  {
    slug: 'crocodile', name: 'Crocodile', cr: 0.5, ac: 12, hp: 19, speed: 20, otherSpeeds: 'swim 30 ft', swims: true, str: 15, dex: 10, con: 13,
    attacks: [{ name: 'Bite', toHit: 4, damage: '1d10+2', damageType: 'piercing', notes: 'Grappled (escape DC 12)' }],
    traits: [{ name: 'Hold Breath', description: 'Can hold its breath for 15 minutes.' }],
  },
  {
    slug: 'dire-wolf', name: 'Dire Wolf', cr: 1, ac: 14, hp: 37, speed: 50, str: 17, dex: 15, con: 15,
    attacks: [{ name: 'Bite', toHit: 5, damage: '2d6+3', damageType: 'piercing', notes: 'DC 13 STR save or knocked prone' }],
    traits: [{ name: 'Pack Tactics', description: 'Advantage on attacks against a creature with an ally of yours within 5 ft of it.' }],
  },
  {
    slug: 'brown-bear', name: 'Brown Bear', cr: 1, ac: 11, hp: 34, speed: 40, otherSpeeds: 'climb 30 ft', str: 19, dex: 10, con: 16,
    attacks: [
      { name: 'Bite', toHit: 6, damage: '1d8+4', damageType: 'piercing', notes: 'Multiattack: bite and claws' },
      { name: 'Claws', toHit: 6, damage: '2d6+4', damageType: 'slashing' },
    ],
    traits: [{ name: 'Keen Smell', description: 'Advantage on Wisdom (Perception) checks that rely on smell.' }],
  },
  {
    slug: 'giant-spider', name: 'Giant Spider', cr: 1, ac: 14, hp: 26, speed: 30, otherSpeeds: 'climb 30 ft', str: 14, dex: 16, con: 12,
    attacks: [{ name: 'Bite', toHit: 5, damage: '1d8+3', damageType: 'piercing', notes: '+2d8 poison, DC 11 CON save for half' }],
    traits: [
      { name: 'Spider Climb', description: 'Climbs difficult surfaces, including ceilings, without an ability check.' },
      { name: 'Web Sense / Web Walker', description: 'Knows where anything touching its web is, and ignores webbing.' },
    ],
  },
  {
    slug: 'giant-eagle', name: 'Giant Eagle', cr: 1, ac: 13, hp: 26, speed: 10, otherSpeeds: 'fly 80 ft', flies: true, str: 16, dex: 17, con: 13,
    attacks: [
      { name: 'Beak', toHit: 5, damage: '1d6+3', damageType: 'piercing', notes: 'Multiattack: beak and talons' },
      { name: 'Talons', toHit: 5, damage: '2d6+3', damageType: 'slashing' },
    ],
    traits: [{ name: 'Keen Sight', description: 'Advantage on Wisdom (Perception) checks that rely on sight.' }],
  },
  {
    slug: 'polar-bear', name: 'Polar Bear', cr: 2, ac: 12, hp: 42, speed: 40, otherSpeeds: 'swim 30 ft', swims: true, str: 20, dex: 10, con: 16,
    attacks: [
      { name: 'Bite', toHit: 7, damage: '1d8+5', damageType: 'piercing', notes: 'Multiattack: bite and claws' },
      { name: 'Claws', toHit: 7, damage: '2d6+5', damageType: 'slashing' },
    ],
    traits: [{ name: 'Keen Smell', description: 'Advantage on Wisdom (Perception) checks that rely on smell.' }],
  },
  {
    slug: 'saber-toothed-tiger', name: 'Saber-Toothed Tiger', cr: 2, ac: 12, hp: 52, speed: 40, str: 18, dex: 14, con: 15,
    attacks: [
      { name: 'Bite', toHit: 6, damage: '1d10+5', damageType: 'piercing' },
      { name: 'Claw', toHit: 6, damage: '2d6+5', damageType: 'slashing' },
    ],
    traits: [{ name: 'Pounce', description: 'Move 20 ft straight then hit with a claw: DC 14 STR save or prone, then a bite as a bonus action.' }],
  },
  {
    slug: 'giant-boar', name: 'Giant Boar', cr: 2, ac: 12, hp: 42, speed: 40, str: 17, dex: 10, con: 16,
    attacks: [{ name: 'Tusk', toHit: 5, damage: '2d6+3', damageType: 'slashing' }],
    traits: [
      { name: 'Charge', description: 'Move 20 ft straight then hit with the tusk: +2d6 slashing, DC 13 STR save or prone.' },
      { name: 'Relentless', description: 'Once per short or long rest, 10 damage or less that would drop it to 0 HP leaves it at 1 HP.' },
    ],
  },
  {
    slug: 'giant-constrictor-snake', name: 'Giant Constrictor Snake', cr: 2, ac: 12, hp: 60, speed: 30, otherSpeeds: 'swim 30 ft', swims: true, str: 19, dex: 14, con: 12,
    attacks: [
      { name: 'Bite', toHit: 6, damage: '2d6+4', damageType: 'piercing', notes: 'Reach 10 ft' },
      { name: 'Constrict', toHit: 6, damage: '2d8+4', damageType: 'bludgeoning', notes: 'Grappled (escape DC 16) and restrained' },
    ],
    traits: [],
  },
  {
    slug: 'giant-elk', name: 'Giant Elk', cr: 2, ac: 14, hp: 42, speed: 60, str: 19, dex: 16, con: 14,
    attacks: [
      { name: 'Ram', toHit: 6, damage: '2d6+4', damageType: 'bludgeoning' },
      { name: 'Hooves', toHit: 6, damage: '4d8+4', damageType: 'bludgeoning', notes: 'Against a prone creature' },
    ],
    traits: [{ name: 'Charge', description: 'Move 20 ft straight then hit with a ram: +2d6 bludgeoning, DC 14 STR save or prone.' }],
  },
  {
    slug: 'hunter-shark', name: 'Hunter Shark', cr: 2, ac: 12, hp: 45, speed: 0, otherSpeeds: 'swim 40 ft', swims: true, str: 18, dex: 13, con: 15,
    attacks: [{ name: 'Bite', toHit: 6, damage: '2d8+4', damageType: 'piercing' }],
    traits: [
      { name: 'Blood Frenzy', description: 'Advantage on melee attacks against a creature that is below its hit point maximum.' },
      { name: 'Water Breathing', description: 'Breathes only underwater.' },
    ],
  },
  {
    slug: 'rhinoceros', name: 'Rhinoceros', cr: 2, ac: 11, hp: 45, speed: 40, str: 21, dex: 8, con: 15,
    attacks: [{ name: 'Gore', toHit: 7, damage: '2d8+5', damageType: 'bludgeoning' }],
    traits: [{ name: 'Charge', description: 'Move 20 ft straight then hit with the gore: +2d8 bludgeoning, DC 15 STR save or prone.' }],
  },
  {
    slug: 'allosaurus', name: 'Allosaurus', cr: 2, ac: 13, hp: 51, speed: 60, str: 19, dex: 13, con: 17,
    attacks: [
      { name: 'Bite', toHit: 6, damage: '2d10+4', damageType: 'piercing' },
      { name: 'Claw', toHit: 6, damage: '1d8+4', damageType: 'slashing' },
    ],
    traits: [{ name: 'Pounce', description: 'Move 30 ft straight then hit with a claw: DC 13 STR save or prone, then a bite as a bonus action.' }],
  },
  {
    slug: 'ankylosaurus', name: 'Ankylosaurus', cr: 3, ac: 15, hp: 68, speed: 30, str: 19, dex: 11, con: 15,
    attacks: [{ name: 'Tail', toHit: 7, damage: '4d6+4', damageType: 'bludgeoning', notes: 'Reach 10 ft; DC 14 STR save or prone' }],
    traits: [],
  },
  {
    slug: 'giant-scorpion', name: 'Giant Scorpion', cr: 3, ac: 15, hp: 52, speed: 40, str: 15, dex: 13, con: 15,
    attacks: [
      { name: 'Claw (×2)', toHit: 4, damage: '1d8+2', damageType: 'bludgeoning', notes: 'Multiattack: two claws and a sting; grappled (escape DC 12)' },
      { name: 'Sting', toHit: 4, damage: '1d10+2', damageType: 'piercing', notes: '+4d10 poison, DC 12 CON save for half' },
    ],
    traits: [],
  },
  {
    slug: 'killer-whale', name: 'Killer Whale', cr: 3, ac: 12, hp: 90, speed: 0, otherSpeeds: 'swim 60 ft', swims: true, str: 19, dex: 10, con: 13,
    attacks: [{ name: 'Bite', toHit: 6, damage: '5d6+4', damageType: 'piercing' }],
    traits: [
      { name: 'Echolocation', description: "Blindsight 120 ft while it isn't deafened." },
      { name: 'Hold Breath', description: 'Can hold its breath for 30 minutes.' },
    ],
  },
  {
    slug: 'elephant', name: 'Elephant', cr: 4, ac: 12, hp: 76, speed: 40, str: 22, dex: 9, con: 17,
    attacks: [
      { name: 'Gore', toHit: 8, damage: '3d8+6', damageType: 'piercing' },
      { name: 'Stomp', toHit: 8, damage: '3d10+6', damageType: 'bludgeoning', notes: 'Against a prone creature' },
    ],
    traits: [{ name: 'Trampling Charge', description: 'Move 20 ft straight then hit with a gore: DC 12 STR save or prone, then a stomp as a bonus action.' }],
  },
  {
    slug: 'giant-crocodile', name: 'Giant Crocodile', cr: 5, ac: 14, hp: 85, speed: 30, otherSpeeds: 'swim 50 ft', swims: true, str: 21, dex: 9, con: 17,
    attacks: [
      { name: 'Bite', toHit: 8, damage: '3d10+5', damageType: 'piercing', notes: 'Multiattack: bite and tail; grappled (escape DC 16)' },
      { name: 'Tail', toHit: 8, damage: '2d8+5', damageType: 'bludgeoning', notes: 'Reach 10 ft; DC 16 STR save or prone' },
    ],
    traits: [{ name: 'Hold Breath', description: 'Can hold its breath for 30 minutes.' }],
  },
  {
    slug: 'giant-shark', name: 'Giant Shark', cr: 5, ac: 13, hp: 126, speed: 0, otherSpeeds: 'swim 50 ft', swims: true, str: 23, dex: 11, con: 21,
    attacks: [{ name: 'Bite', toHit: 9, damage: '3d10+6', damageType: 'piercing' }],
    traits: [
      { name: 'Blood Frenzy', description: 'Advantage on melee attacks against a creature that is below its hit point maximum.' },
      { name: 'Water Breathing', description: 'Breathes only underwater.' },
    ],
  },
  {
    slug: 'triceratops', name: 'Triceratops', cr: 5, ac: 13, hp: 95, speed: 50, str: 22, dex: 9, con: 17,
    attacks: [
      { name: 'Gore', toHit: 9, damage: '4d8+6', damageType: 'piercing' },
      { name: 'Stomp', toHit: 9, damage: '3d10+6', damageType: 'bludgeoning', notes: 'Against a prone creature' },
    ],
    traits: [{ name: 'Trampling Charge', description: 'Move 20 ft straight then hit with a gore: DC 13 STR save or prone, then a stomp as a bonus action.' }],
  },
  {
    slug: 'mammoth', name: 'Mammoth', cr: 6, ac: 13, hp: 126, speed: 40, str: 24, dex: 9, con: 21,
    attacks: [
      { name: 'Gore', toHit: 10, damage: '4d8+7', damageType: 'piercing' },
      { name: 'Stomp', toHit: 10, damage: '4d10+7', damageType: 'bludgeoning', notes: 'Against a prone creature' },
    ],
    traits: [{ name: 'Trampling Charge', description: 'Move 20 ft straight then hit with a gore: DC 18 STR save or prone, then a stomp as a bonus action.' }],
  },
]

// Elemental Wild Shape (Circle of the Moon, level 10): spend two uses to become one of these
const NONMAGICAL = 'bludgeoning, piercing and slashing from nonmagical attacks'
const ELEMENT_CONDITIONS = ['exhaustion', 'grappled', 'paralyzed', 'petrified', 'poisoned', 'prone', 'restrained', 'unconscious']
export const ELEMENTAL_FORMS: Beast[] = [
  {
    slug: 'air-elemental', name: 'Air Elemental', cr: 5, ac: 15, hp: 90, speed: 0, otherSpeeds: 'fly 90 ft (hover)', flies: true, str: 14, dex: 20, con: 14, elemental: true,
    attacks: [{ name: 'Slam (×2)', toHit: 8, damage: '2d8+5', damageType: 'bludgeoning', notes: 'Two slams' }],
    traits: [
      { name: 'Air Form', description: 'Can enter a hostile creature\'s space and move through gaps an inch wide.' },
      { name: 'Whirlwind (recharge 4–6)', description: 'Creatures in its space: DC 13 STR save or 3d8+2 bludgeoning and flung 20 ft; half on a success.' },
    ],
    resistances: ['lightning', 'thunder', NONMAGICAL], immunities: ['poison', ...ELEMENT_CONDITIONS],
  },
  {
    slug: 'earth-elemental', name: 'Earth Elemental', cr: 5, ac: 17, hp: 126, speed: 30, otherSpeeds: 'burrow 30 ft', str: 20, dex: 8, con: 20, elemental: true,
    attacks: [{ name: 'Slam (×2)', toHit: 8, damage: '2d8+5', damageType: 'bludgeoning', notes: 'Two slams' }],
    traits: [
      { name: 'Earth Glide', description: 'Burrows through earth and stone without disturbing it.' },
      { name: 'Siege Monster', description: 'Double damage to objects and structures.' },
      { name: 'Thunder Vulnerability', description: 'Takes double damage from thunder.' },
    ],
    resistances: [NONMAGICAL], immunities: ['poison', 'exhaustion', 'paralyzed', 'petrified', 'poisoned', 'unconscious'],
  },
  {
    slug: 'fire-elemental', name: 'Fire Elemental', cr: 5, ac: 13, hp: 102, speed: 50, str: 10, dex: 17, con: 16, elemental: true,
    attacks: [{ name: 'Touch (×2)', toHit: 6, damage: '2d6+3', damageType: 'fire', notes: 'Two touches; the target catches fire (1d10 fire each turn)' }],
    traits: [
      { name: 'Fire Form', description: 'Moves through gaps an inch wide; touching it or hitting it in melee deals 1d10 fire.' },
      { name: 'Water Susceptibility', description: 'Takes 1 cold damage for every 5 ft it moves in water.' },
    ],
    resistances: [NONMAGICAL], immunities: ['fire', 'poison', ...ELEMENT_CONDITIONS],
  },
  {
    slug: 'water-elemental', name: 'Water Elemental', cr: 5, ac: 14, hp: 114, speed: 30, otherSpeeds: 'swim 90 ft', swims: true, str: 18, dex: 14, con: 18, elemental: true,
    attacks: [{ name: 'Slam (×2)', toHit: 7, damage: '2d8+4', damageType: 'bludgeoning', notes: 'Two slams' }],
    traits: [
      { name: 'Whelm (recharge 4–6)', description: 'Creatures in its space: DC 15 STR save or 2d8+4 bludgeoning and grappled (escape DC 14), restrained, unable to breathe.' },
      { name: 'Freeze', description: 'Cold damage partly freezes it: speed drops by 20 ft until the end of its next turn.' },
    ],
    resistances: ['acid', NONMAGICAL], immunities: ['poison', ...ELEMENT_CONDITIONS],
  },
]

/** Elemental Wild Shape: Circle of the Moon from druid level 10, two uses at a time */
export const canElementalWildShape = (druidLevel: number, moon: boolean) => moon && druidLevel >= 10

/** The forms a druid may take (PHB p.66): CR and movement by level; Circle of the Moon goes higher */
export function wildShapeLimits(druidLevel: number, moon: boolean): { maxCr: number; swim: boolean; fly: boolean } {
  const maxCr = moon
    ? (druidLevel >= 6 ? Math.floor(druidLevel / 3) : 1)
    : druidLevel >= 8 ? 1 : druidLevel >= 4 ? 0.5 : 0.25
  return { maxCr, swim: druidLevel >= 4, fly: druidLevel >= 8 }
}

/** Why a beast isn't available yet, or null if it is */
export function wildShapeBlocked(b: Beast, limits: ReturnType<typeof wildShapeLimits>): string | null {
  if (b.cr > limits.maxCr) return `CR ${formatCr(b.cr)} is above your limit (${formatCr(limits.maxCr)})`
  if (b.flies && !limits.fly) return 'Flying forms come at druid level 8'
  if (b.swims && !limits.swim) return 'Swimming forms come at druid level 4'
  return null
}

export const formatCr = (cr: number) => cr === 0.25 ? '1/4' : cr === 0.5 ? '1/2' : cr === 0.125 ? '1/8' : String(cr)
