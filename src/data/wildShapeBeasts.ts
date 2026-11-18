// Common Wild Shape forms, from the beasts in the free 5e basic rules (SRD 5.1). Only what the sheet
// needs: the druid keeps their own INT, WIS and CHA in beast form, so those aren't listed. Anything
// else can be entered as a custom form.

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
    slug: 'elephant', name: 'Elephant', cr: 4, ac: 12, hp: 76, speed: 40, str: 22, dex: 9, con: 17,
    attacks: [
      { name: 'Gore', toHit: 8, damage: '3d8+6', damageType: 'piercing' },
      { name: 'Stomp', toHit: 8, damage: '3d10+6', damageType: 'bludgeoning', notes: 'Against a prone creature' },
    ],
    traits: [{ name: 'Trampling Charge', description: 'Move 20 ft straight then hit with a gore: DC 12 STR save or prone, then a stomp as a bonus action.' }],
  },
]

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
