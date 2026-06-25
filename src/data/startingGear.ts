// ── Starting equipment for all 13 classes ─────────────────────────────────
// "fixed" items are always received.
// "choices" is an array of choice groups — the player picks ONE option per group.

export interface GearItem {
  name: string
  quantity?: number
  slug?: string   // maps to WEAPON_STATS or ARMOR_STATS key in Sheet.tsx
  notes?: string  // e.g. "of your choice"
}

export interface GearOption {
  label: string       // "a" | "b" | "c"
  desc: string        // human-readable summary shown in UI
  items: GearItem[]
}

export interface GearChoiceGroup {
  options: GearOption[]
}

export interface ClassStartingGear {
  fixed: GearItem[]
  choices: GearChoiceGroup[]
}

export const CLASS_STARTING_GEAR: Record<string, ClassStartingGear> = {
  artificer: {
    fixed: [
      { name: 'Leather Armor', slug: 'leather', quantity: 1 },
      { name: 'Dagger', slug: 'dagger', quantity: 2 },
      { name: "Thieves' Tools", quantity: 1 },
      { name: "Tinker's Tools", quantity: 1 },
    ],
    choices: [
      {
        options: [
          { label: 'a', desc: 'Light Crossbow + 20 bolts', items: [{ name: 'Light Crossbow', slug: 'crossbow-light', quantity: 1 }, { name: 'Crossbow Bolts (20)', quantity: 20 }] },
          { label: 'b', desc: 'Any simple weapon', items: [{ name: 'Simple Weapon (your choice)', notes: 'Choose any simple weapon', quantity: 1 }] },
        ],
      },
    ],
  },

  barbarian: {
    fixed: [
      { name: 'Explorer\'s Pack', quantity: 1 },
      { name: 'Javelin', slug: 'javelin', quantity: 4 },
    ],
    choices: [
      {
        options: [
          { label: 'a', desc: 'Greataxe', items: [{ name: 'Greataxe', slug: 'greataxe', quantity: 1 }] },
          { label: 'b', desc: 'Any martial melee weapon', items: [{ name: 'Martial Weapon (your choice)', notes: 'Choose any martial melee weapon', quantity: 1 }] },
        ],
      },
      {
        options: [
          { label: 'a', desc: '2 Handaxes', items: [{ name: 'Handaxe', slug: 'handaxe', quantity: 2 }] },
          { label: 'b', desc: 'Any simple weapon', items: [{ name: 'Simple Weapon (your choice)', notes: 'Choose any simple weapon', quantity: 1 }] },
        ],
      },
    ],
  },

  bard: {
    fixed: [
      { name: 'Leather Armor', slug: 'leather', quantity: 1 },
      { name: 'Dagger', slug: 'dagger', quantity: 1 },
    ],
    choices: [
      {
        options: [
          { label: 'a', desc: 'Rapier', items: [{ name: 'Rapier', slug: 'rapier', quantity: 1 }] },
          { label: 'b', desc: 'Longsword', items: [{ name: 'Longsword', slug: 'longsword', quantity: 1 }] },
          { label: 'c', desc: 'Any simple weapon', items: [{ name: 'Simple Weapon (your choice)', notes: 'Choose any simple weapon', quantity: 1 }] },
        ],
      },
      {
        options: [
          { label: 'a', desc: "Diplomat's Pack", items: [{ name: "Diplomat's Pack", quantity: 1 }] },
          { label: 'b', desc: "Entertainer's Pack", items: [{ name: "Entertainer's Pack", quantity: 1 }] },
        ],
      },
      {
        options: [
          { label: 'a', desc: 'Lute', items: [{ name: 'Lute', quantity: 1 }] },
          { label: 'b', desc: 'Musical instrument of your choice', items: [{ name: 'Musical Instrument (your choice)', notes: 'Choose any musical instrument', quantity: 1 }] },
        ],
      },
    ],
  },

  cleric: {
    fixed: [
      { name: 'Shield', slug: 'shield', quantity: 1 },
      { name: 'Holy Symbol', quantity: 1 },
    ],
    choices: [
      {
        options: [
          { label: 'a', desc: 'Mace', items: [{ name: 'Mace', slug: 'mace', quantity: 1 }] },
          { label: 'b', desc: 'Warhammer (if proficient)', items: [{ name: 'Warhammer', slug: 'warhammer', quantity: 1 }] },
        ],
      },
      {
        options: [
          { label: 'a', desc: 'Scale Mail', items: [{ name: 'Scale Mail', slug: 'scale-mail', quantity: 1 }] },
          { label: 'b', desc: 'Leather Armor', items: [{ name: 'Leather Armor', slug: 'leather', quantity: 1 }] },
          { label: 'c', desc: 'Chain Mail (if proficient)', items: [{ name: 'Chain Mail', slug: 'chain-mail', quantity: 1 }] },
        ],
      },
      {
        options: [
          { label: 'a', desc: 'Light Crossbow + 20 bolts', items: [{ name: 'Light Crossbow', slug: 'crossbow-light', quantity: 1 }, { name: 'Crossbow Bolts (20)', quantity: 20 }] },
          { label: 'b', desc: 'Any simple weapon', items: [{ name: 'Simple Weapon (your choice)', notes: 'Choose any simple weapon', quantity: 1 }] },
        ],
      },
      {
        options: [
          { label: 'a', desc: "Priest's Pack", items: [{ name: "Priest's Pack", quantity: 1 }] },
          { label: 'b', desc: "Explorer's Pack", items: [{ name: "Explorer's Pack", quantity: 1 }] },
        ],
      },
    ],
  },

  druid: {
    fixed: [
      { name: 'Leather Armor', slug: 'leather', quantity: 1 },
      { name: "Explorer's Pack", quantity: 1 },
      { name: 'Druidic Focus', quantity: 1 },
    ],
    choices: [
      {
        options: [
          { label: 'a', desc: 'Wooden Shield', items: [{ name: 'Shield', slug: 'shield', quantity: 1 }] },
          { label: 'b', desc: 'Any simple weapon', items: [{ name: 'Simple Weapon (your choice)', notes: 'Choose any simple weapon', quantity: 1 }] },
        ],
      },
      {
        options: [
          { label: 'a', desc: 'Scimitar', items: [{ name: 'Scimitar', slug: 'scimitar', quantity: 1 }] },
          { label: 'b', desc: 'Any simple melee weapon', items: [{ name: 'Simple Melee Weapon (your choice)', notes: 'Choose any simple melee weapon', quantity: 1 }] },
        ],
      },
    ],
  },

  fighter: {
    fixed: [],
    choices: [
      {
        options: [
          { label: 'a', desc: 'Chain Mail', items: [{ name: 'Chain Mail', slug: 'chain-mail', quantity: 1 }] },
          { label: 'b', desc: 'Leather Armor + Longbow + 20 arrows', items: [{ name: 'Leather Armor', slug: 'leather', quantity: 1 }, { name: 'Longbow', slug: 'longbow', quantity: 1 }, { name: 'Arrows (20)', quantity: 20 }] },
        ],
      },
      {
        options: [
          { label: 'a', desc: 'Martial weapon + Shield', items: [{ name: 'Martial Weapon (your choice)', quantity: 1 }, { name: 'Shield', slug: 'shield', quantity: 1 }] },
          { label: 'b', desc: '2 martial weapons', items: [{ name: 'Martial Weapon (your choice)', quantity: 2 }] },
        ],
      },
      {
        options: [
          { label: 'a', desc: 'Light crossbow + 20 bolts', items: [{ name: 'Light Crossbow', slug: 'crossbow-light', quantity: 1 }, { name: 'Crossbow Bolts (20)', quantity: 20 }] },
          { label: 'b', desc: '2 Handaxes', items: [{ name: 'Handaxe', slug: 'handaxe', quantity: 2 }] },
        ],
      },
      {
        options: [
          { label: 'a', desc: "Dungeoneer's Pack", items: [{ name: "Dungeoneer's Pack", quantity: 1 }] },
          { label: 'b', desc: "Explorer's Pack", items: [{ name: "Explorer's Pack", quantity: 1 }] },
        ],
      },
    ],
  },

  monk: {
    fixed: [
      { name: 'Dart', slug: 'dart', quantity: 10 },
    ],
    choices: [
      {
        options: [
          { label: 'a', desc: 'Shortsword', items: [{ name: 'Shortsword', slug: 'shortsword', quantity: 1 }] },
          { label: 'b', desc: 'Any simple weapon', items: [{ name: 'Simple Weapon (your choice)', notes: 'Choose any simple weapon', quantity: 1 }] },
        ],
      },
      {
        options: [
          { label: 'a', desc: "Dungeoneer's Pack", items: [{ name: "Dungeoneer's Pack", quantity: 1 }] },
          { label: 'b', desc: "Explorer's Pack", items: [{ name: "Explorer's Pack", quantity: 1 }] },
        ],
      },
    ],
  },

  paladin: {
    fixed: [
      { name: 'Chain Mail', slug: 'chain-mail', quantity: 1 },
      { name: 'Holy Symbol', quantity: 1 },
    ],
    choices: [
      {
        options: [
          { label: 'a', desc: 'Martial weapon + Shield', items: [{ name: 'Martial Weapon (your choice)', quantity: 1 }, { name: 'Shield', slug: 'shield', quantity: 1 }] },
          { label: 'b', desc: '2 martial weapons', items: [{ name: 'Martial Weapon (your choice)', quantity: 2 }] },
        ],
      },
      {
        options: [
          { label: 'a', desc: '5 Javelins', items: [{ name: 'Javelin', slug: 'javelin', quantity: 5 }] },
          { label: 'b', desc: 'Any simple melee weapon', items: [{ name: 'Simple Melee Weapon (your choice)', notes: 'Choose any simple melee weapon', quantity: 1 }] },
        ],
      },
      {
        options: [
          { label: 'a', desc: "Priest's Pack", items: [{ name: "Priest's Pack", quantity: 1 }] },
          { label: 'b', desc: "Explorer's Pack", items: [{ name: "Explorer's Pack", quantity: 1 }] },
        ],
      },
    ],
  },

  ranger: {
    fixed: [
      { name: 'Longbow', slug: 'longbow', quantity: 1 },
      { name: 'Arrows (20)', quantity: 20 },
    ],
    choices: [
      {
        options: [
          { label: 'a', desc: 'Scale Mail', items: [{ name: 'Scale Mail', slug: 'scale-mail', quantity: 1 }] },
          { label: 'b', desc: 'Leather Armor', items: [{ name: 'Leather Armor', slug: 'leather', quantity: 1 }] },
        ],
      },
      {
        options: [
          { label: 'a', desc: '2 Shortswords', items: [{ name: 'Shortsword', slug: 'shortsword', quantity: 2 }] },
          { label: 'b', desc: '2 simple melee weapons', items: [{ name: 'Simple Melee Weapon (your choice)', quantity: 2 }] },
        ],
      },
      {
        options: [
          { label: 'a', desc: "Dungeoneer's Pack", items: [{ name: "Dungeoneer's Pack", quantity: 1 }] },
          { label: 'b', desc: "Explorer's Pack", items: [{ name: "Explorer's Pack", quantity: 1 }] },
        ],
      },
    ],
  },

  rogue: {
    fixed: [
      { name: 'Leather Armor', slug: 'leather', quantity: 1 },
      { name: 'Dagger', slug: 'dagger', quantity: 2 },
      { name: "Thieves' Tools", quantity: 1 },
    ],
    choices: [
      {
        options: [
          { label: 'a', desc: 'Rapier', items: [{ name: 'Rapier', slug: 'rapier', quantity: 1 }] },
          { label: 'b', desc: 'Shortsword', items: [{ name: 'Shortsword', slug: 'shortsword', quantity: 1 }] },
        ],
      },
      {
        options: [
          { label: 'a', desc: 'Shortbow + 20 arrows', items: [{ name: 'Shortbow', slug: 'shortbow', quantity: 1 }, { name: 'Arrows (20)', quantity: 20 }] },
          { label: 'b', desc: 'Shortsword', items: [{ name: 'Shortsword', slug: 'shortsword', quantity: 1 }] },
        ],
      },
      {
        options: [
          { label: 'a', desc: "Burglar's Pack", items: [{ name: "Burglar's Pack", quantity: 1 }] },
          { label: 'b', desc: "Dungeoneer's Pack", items: [{ name: "Dungeoneer's Pack", quantity: 1 }] },
          { label: 'c', desc: "Explorer's Pack", items: [{ name: "Explorer's Pack", quantity: 1 }] },
        ],
      },
    ],
  },

  sorcerer: {
    fixed: [
      { name: 'Dagger', slug: 'dagger', quantity: 2 },
    ],
    choices: [
      {
        options: [
          { label: 'a', desc: 'Light crossbow + 20 bolts', items: [{ name: 'Light Crossbow', slug: 'crossbow-light', quantity: 1 }, { name: 'Crossbow Bolts (20)', quantity: 20 }] },
          { label: 'b', desc: 'Any simple weapon', items: [{ name: 'Simple Weapon (your choice)', notes: 'Choose any simple weapon', quantity: 1 }] },
        ],
      },
      {
        options: [
          { label: 'a', desc: 'Component pouch', items: [{ name: 'Component Pouch', quantity: 1 }] },
          { label: 'b', desc: 'Arcane focus', items: [{ name: 'Arcane Focus', quantity: 1 }] },
        ],
      },
      {
        options: [
          { label: 'a', desc: "Dungeoneer's Pack", items: [{ name: "Dungeoneer's Pack", quantity: 1 }] },
          { label: 'b', desc: "Explorer's Pack", items: [{ name: "Explorer's Pack", quantity: 1 }] },
        ],
      },
    ],
  },

  warlock: {
    fixed: [
      { name: 'Leather Armor', slug: 'leather', quantity: 1 },
      { name: 'Dagger', slug: 'dagger', quantity: 2 },
    ],
    choices: [
      {
        options: [
          { label: 'a', desc: 'Light crossbow + 20 bolts', items: [{ name: 'Light Crossbow', slug: 'crossbow-light', quantity: 1 }, { name: 'Crossbow Bolts (20)', quantity: 20 }] },
          { label: 'b', desc: 'Any simple weapon', items: [{ name: 'Simple Weapon (your choice)', notes: 'Choose any simple weapon', quantity: 1 }] },
        ],
      },
      {
        options: [
          { label: 'a', desc: 'Component pouch', items: [{ name: 'Component Pouch', quantity: 1 }] },
          { label: 'b', desc: 'Arcane focus', items: [{ name: 'Arcane Focus', quantity: 1 }] },
        ],
      },
      {
        options: [
          { label: 'a', desc: "Scholar's Pack", items: [{ name: "Scholar's Pack", quantity: 1 }] },
          { label: 'b', desc: "Dungeoneer's Pack", items: [{ name: "Dungeoneer's Pack", quantity: 1 }] },
        ],
      },
    ],
  },

  wizard: {
    fixed: [
      { name: 'Spellbook', quantity: 1 },
    ],
    choices: [
      {
        options: [
          { label: 'a', desc: 'Quarterstaff', items: [{ name: 'Quarterstaff', slug: 'quarterstaff', quantity: 1 }] },
          { label: 'b', desc: 'Dagger', items: [{ name: 'Dagger', slug: 'dagger', quantity: 1 }] },
        ],
      },
      {
        options: [
          { label: 'a', desc: 'Component pouch', items: [{ name: 'Component Pouch', quantity: 1 }] },
          { label: 'b', desc: 'Arcane focus', items: [{ name: 'Arcane Focus', quantity: 1 }] },
        ],
      },
      {
        options: [
          { label: 'a', desc: "Scholar's Pack", items: [{ name: "Scholar's Pack", quantity: 1 }] },
          { label: 'b', desc: "Explorer's Pack", items: [{ name: "Explorer's Pack", quantity: 1 }] },
        ],
      },
    ],
  },
}
