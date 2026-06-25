// Strixhaven college spell lists (Strixhaven: A Curriculum of Chaos).
//
// Each of the five Strixhaven backgrounds grants the Strixhaven Initiate benefit:
// you learn ONE cantrip and ONE 1st-level spell from your college's list, and can
// cast the 1st-level spell once per long rest without a slot (using the listed
// ability). The full 1st–5th table is the college's spell list — the same list the
// "Mage of <College>" feats draw from — included here as reference.
//
// Keyed by background slug so the sheet can look it up directly.

export interface CollegeSpells {
  college: string
  /** Default spellcasting ability for the granted spell if you have no casting class. */
  ability: 'int' | 'wis' | 'cha'
  /** Cantrip options — choose one (the Strixhaven Initiate feat lets you pick two). */
  cantrips: string[]
  /** The college spell list, two spells per level (1st–5th). */
  byLevel: { level: number; spells: string[] }[]
}

export const STRIXHAVEN_COLLEGES: Record<string, CollegeSpells> = {
  'lorehold-student': {
    college: 'Lorehold',
    ability: 'int',
    cantrips: ['Light', 'Sacred Flame', 'Thaumaturgy'],
    byLevel: [
      { level: 1, spells: ['Comprehend Languages', 'Identify'] },
      { level: 2, spells: ['Borrowed Knowledge', 'Locate Object'] },
      { level: 3, spells: ['Speak with Dead', 'Spirit Guardians'] },
      { level: 4, spells: ['Arcane Eye', 'Stone Shape'] },
      { level: 5, spells: ['Flame Strike', 'Legend Lore'] },
    ],
  },
  'prismari-student': {
    college: 'Prismari',
    ability: 'cha',
    cantrips: ['Fire Bolt', 'Prestidigitation', 'Ray of Frost'],
    byLevel: [
      { level: 1, spells: ['Chromatic Orb', 'Thunderwave'] },
      { level: 2, spells: ['Flaming Sphere', 'Kinetic Jaunt'] },
      { level: 3, spells: ['Haste', 'Water Walk'] },
      { level: 4, spells: ['Freedom of Movement', 'Wall of Fire'] },
      { level: 5, spells: ['Cone of Cold', 'Conjure Elemental'] },
    ],
  },
  'quandrix-student': {
    college: 'Quandrix',
    ability: 'int',
    cantrips: ['Druidcraft', 'Guidance', 'Mage Hand'],
    byLevel: [
      { level: 1, spells: ['Entangle', 'Guiding Bolt'] },
      { level: 2, spells: ['Enlarge/Reduce', 'Vortex Warp'] },
      { level: 3, spells: ['Aura of Vitality', 'Haste'] },
      { level: 4, spells: ['Control Water', 'Freedom of Movement'] },
      { level: 5, spells: ['Circle of Power', 'Passwall'] },
    ],
  },
  'silverquill-student': {
    college: 'Silverquill',
    ability: 'cha',
    cantrips: ['Sacred Flame', 'Thaumaturgy', 'Vicious Mockery'],
    byLevel: [
      { level: 1, spells: ['Dissonant Whispers', 'Silvery Barbs'] },
      { level: 2, spells: ['Calm Emotions', 'Darkness'] },
      { level: 3, spells: ['Beacon of Hope', 'Daylight'] },
      { level: 4, spells: ['Compulsion', 'Confusion'] },
      { level: 5, spells: ['Dominate Person', "Rary's Telepathic Bond"] },
    ],
  },
  'witherbloom-student': {
    college: 'Witherbloom',
    ability: 'wis',
    cantrips: ['Chill Touch', 'Druidcraft', 'Spare the Dying'],
    byLevel: [
      { level: 1, spells: ['Cure Wounds', 'Inflict Wounds'] },
      { level: 2, spells: ['Lesser Restoration', 'Wither and Bloom'] },
      { level: 3, spells: ['Revivify', 'Vampiric Touch'] },
      { level: 4, spells: ['Blight', 'Death Ward'] },
      { level: 5, spells: ['Antilife Shell', 'Greater Restoration'] },
    ],
  },
}
