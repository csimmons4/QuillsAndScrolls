// Armor, weapon, tool and language proficiencies: the canonical lists the sheet's editor offers,
// name matching that agrees with the sheet's proficiency checks, and where each one comes from.
import type { Character } from './model'
import type { ContentData } from '../content/ContentProvider'
import { CLASS_OPTIONS, MULTICLASS_PROF_GRANTS, subclassProficiencies } from '../data/classData'

export const MUSICAL_INSTRUMENTS = ['Bagpipes', 'Drum', 'Dulcimer', 'Flute', 'Lute', 'Lyre', 'Horn', 'Pan flute', 'Shawm', 'Viol']
export const ARTISAN_TOOLS = [
  "Alchemist's supplies", "Brewer's supplies", "Calligrapher's supplies", "Carpenter's tools",
  "Cartographer's tools", "Cobbler's tools", "Cook's utensils", "Glassblower's tools",
  "Jeweler's tools", "Leatherworker's tools", "Mason's tools", "Painter's supplies",
  "Potter's tools", "Smith's tools", "Tinker's tools", "Weaver's tools", "Woodcarver's tools",
]
export const GAMING_SETS = ['Dice set', 'Dragonchess set', 'Playing card set', 'Three-Dragon Ante set']
export const OTHER_TOOLS = [
  'Disguise kit', 'Forgery kit', 'Herbalism kit', "Navigator's tools", "Poisoner's kit", "Thieves' tools",
  'Vehicles (land)', 'Vehicles (water)',
]
const ALL_TOOLS = [...ARTISAN_TOOLS, ...MUSICAL_INSTRUMENTS, ...GAMING_SETS, ...OTHER_TOOLS]

export type ArmorKind = 'light' | 'medium' | 'heavy' | 'shields'
export const ARMOR_KINDS: { key: ArmorKind; label: string }[] = [
  { key: 'light', label: 'Light' }, { key: 'medium', label: 'Medium' }, { key: 'heavy', label: 'Heavy' }, { key: 'shields', label: 'Shields' },
]

/** The armor kinds a stored list covers: "Light Armor", "all", "shields (non-metal)" … */
export function armorKindsOf(list: string[]): Set<ArmorKind> {
  const out = new Set<ArmorKind>()
  for (const raw of list) {
    const p = raw.toLowerCase()
    if (p.startsWith('all')) { out.add('light'); out.add('medium'); out.add('heavy') }
    if (p.startsWith('light')) out.add('light')
    if (p.startsWith('medium')) out.add('medium')
    if (p.startsWith('heavy')) out.add('heavy')
    if (p.startsWith('shield')) out.add('shields')
  }
  return out
}

/** A proficiency name reduced for comparison: "Thieves' Tools" = "thieves' tools",
 *  "Hand Crossbows" = "hand crossbow", "Simple Weapons" = "simple" */
export const profKey = (s: string) =>
  s.toLowerCase().replace(/[’']/g, '').replace(/\s+(weapons?|armor)$/, '').replace(/\s+/g, ' ').trim().replace(/s$/, '')

/** Whether an inventory item is a tool or instrument (by name) */
export const isToolItem = (name: string) => ALL_TOOLS.some(t => profKey(t) === profKey(name))

/** Armor the character's feats grant (Heavily Armored, Moderately Armored, …). These count without
 *  being stored, and go away with the feat. */
export function featArmorKinds(featSlugs: string[], content: ContentData): Map<ArmorKind, string> {
  const out = new Map<ArmorKind, string>()
  for (const slug of featSlugs) {
    const feat = content.feats.find(f => f.slug === slug)
    for (const a of feat?.grantsProficiencies?.armor ?? []) {
      const kind: ArmorKind = a === 'shield' ? 'shields' : a
      if (!out.has(kind)) out.set(kind, feat!.name)
    }
  }
  return out
}

export interface ProficiencySources {
  armor: Map<ArmorKind, string[]>
  weapons: Map<string, string[]>    // keyed by profKey
  tools: Map<string, string[]>
  languages: Map<string, string[]>
}

const SECRET_LANGUAGES: Record<string, string> = { druid: 'Druidic', rogue: "Thieves' Cant" }

/** What grants each proficiency: classes (the first class's full list, later classes'
 *  multiclass grants), subclasses, race and subrace, background and feats. Anything stored on the
 *  character that isn't listed here was a free pick ("one language of your choice") or added by hand. */
export function proficiencySources(char: Character, content: ContentData, featSlugs: string[]): ProficiencySources {
  const src: ProficiencySources = { armor: new Map(), weapons: new Map(), tools: new Map(), languages: new Map() }
  const add = (map: Map<string, string[]>, key: string, from: string) => {
    const list = map.get(key) ?? []
    if (!list.includes(from)) map.set(key, [...list, from])
  }
  const addArmor = (list: string[] | undefined, from: string) => {
    for (const k of armorKindsOf(list ?? [])) add(src.armor as Map<string, string[]>, k, from)
  }
  const addAll = (map: Map<string, string[]>, list: string[] | undefined, from: string) => {
    for (const p of list ?? []) add(map, profKey(p), from)
  }

  char.classes.forEach((cc, i) => {
    const cls = content.classes.find(c => c.slug === cc.classSlug)
    const name = cls?.name ?? cc.classSlug
    if (i === 0) {
      addArmor(cls?.armorProficiencies, name)
      addAll(src.weapons, cls?.weaponProficiencies, name)
      // Only concrete tools ("Thieves' tools"), not "One type of artisan's tools"
      addAll(src.tools, (cls?.toolProficiencies ?? []).filter(t => !/^(one|two|three|any)\b/i.test(t)), name)
    } else {
      const g = MULTICLASS_PROF_GRANTS[cc.classSlug]
      addArmor(g?.armor, name)
      addAll(src.weapons, g?.weapons, name)
      addAll(src.tools, g?.tools, name)
    }
    if (SECRET_LANGUAGES[cc.classSlug]) add(src.languages, profKey(SECRET_LANGUAGES[cc.classSlug]), name)
    if (cc.subclassSlug) {
      const sub = CLASS_OPTIONS[cc.classSlug]?.subclasses.find(s => s.slug === cc.subclassSlug)
      const gp = subclassProficiencies(cc.classSlug, cc.subclassSlug)
      addArmor(gp.armor, sub?.name ?? cc.subclassSlug)
      addAll(src.weapons, gp.weapons, sub?.name ?? cc.subclassSlug)
      addAll(src.tools, gp.tools, sub?.name ?? cc.subclassSlug)
      addAll(src.languages, gp.languages, sub?.name ?? cc.subclassSlug)
    }
  })

  const race = content.races.find(r => r.slug === char.raceSlug)
  const subrace = race?.subraces?.find(s => s.slug === char.subraceSlug)
  for (const r of [race, subrace]) {
    if (!r) continue
    const name = r === subrace ? (subrace?.name ?? '') : (race?.name ?? '')
    addArmor(r.grantedArmor, name)
    addAll(src.weapons, r.grantedWeapons, name)
    addAll(src.tools, r.grantedTools, name)
  }
  addAll(src.languages, (race?.grantedLanguages ?? []).filter(l => !/choice/i.test(l)), race?.name ?? '')

  const bg = content.backgrounds.find(b => b.slug === char.backgroundSlug)
  addAll(src.tools, (bg?.toolProficiencies ?? []).filter(t => !/^(one|two|any)\b|\bor\b/i.test(t)), bg?.name ?? '')

  for (const [kind, feat] of featArmorKinds(featSlugs, content)) add(src.armor as Map<string, string[]>, kind, feat)
  return src
}
