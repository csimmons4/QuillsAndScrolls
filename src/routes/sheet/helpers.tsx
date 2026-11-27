// Pure helpers and constants for the character sheet: weapon/armor resolution, AC, proficiency
// checks, resistances, skill sources, spell upcasting, conditions.
import { Character, SKILLS } from '../../character/model'
import { useContent } from '../../content/ContentProvider'
import { abilityModFor } from '../../character/derive'
import { infusionBonus, MULTICLASS_PROF_GRANTS } from '../../data/classData'
import { languageChoicePlaceholder, splitRaceLanguages } from '../../data/raceData'
import { sumFeatBonuses } from '../../character/featBonuses'
import { itemIsActive } from '../../character/itemBonuses'
import { armorKindsOf, type ArmorKind } from '../../character/proficiencies'
import type { WeaponStats, ArmorStats, ItemDef, SpellDef } from '../../content/loaders'

// ── Weapon / armor resolution ─────────────────────────────────────────────
// The lookup tables formerly defined here are now in `src/data/itemOverlay.ts`
// and merged into `ItemDef.weaponStats` / `ItemDef.armorStats` at load time.

export function slugify(s: string): string {
  return s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

// True when `baseSlug` appears in `slug` as whole hyphen-separated words, so
// "flame-tongue-longsword" contains "longsword" but "nimbus-coronet" doesn't contain "net".
export function hasSlugWords(slug: string, baseSlug: string): boolean {
  return `-${slug}-`.includes(`-${baseSlug}-`)
}

export const AMMO_RE = /\b(bullets?|arrows?|bolts?|needles?|ammunition)\b/i

export function resolveWeapon(item: { itemSlug: string; name: string }, items: ItemDef[]): WeaponStats | undefined {
  const direct = items.find(i => i.slug === item.itemSlug)?.weaponStats
  if (direct) return direct
  const byName = items.find(i => i.slug === slugify(item.name))?.weaponStats
  if (byName) return byName
  // Fuzzy: for magic weapons like "Flame Tongue Longsword" match the base weapon.
  if (AMMO_RE.test(item.name)) return undefined
  const lower = slugify(item.name)
  for (const i of items) {
    if (i.weaponStats && hasSlugWords(lower, i.slug)) return i.weaponStats
  }
  return undefined
}

export function resolveArmor(item: { itemSlug: string; name: string }, items: ItemDef[]): ArmorStats | undefined {
  const direct = items.find(i => i.slug === item.itemSlug)?.armorStats
  if (direct) return direct
  const byName = items.find(i => i.slug === slugify(item.name))?.armorStats
  if (byName) return byName
  const lower = slugify(item.name)
  for (const i of items) {
    if (i.armorStats && hasSlugWords(lower, i.slug)) return i.armorStats
  }
  return undefined
}

export type BodySlotKey = 'helmet' | 'eyes' | 'amulet' | 'cloak' | 'robe' | 'bracers' | 'gloves' | 'belt' | 'boots' | 'backpack'

export function slotFromWords(text: string): BodySlotKey | null {
  const n = text.toLowerCase()
  if (/\b(helm|helmet|crown|circlet|coronet|hat|cap|hood|headband|headdress|tiara|diadem|wreath|turban)\b/.test(n)) return 'helmet'
  if (/\b(goggles|mask|masque|spectacles|lenses|visor|monocle|eye ?patch|eyes of)\b/.test(n)) return 'eyes'
  if (/\b(amulet|necklace|periapt|pendant|talisman|choker|medallion|locket|torc|brooch|badge|medal|insignia|emblem|scarab)\b/.test(n)) return 'amulet'
  if (/\b(cloak|cape|mantle|shroud|wings)\b/.test(n)) return 'cloak'
  if (/\b(robes?|vestments|garb|clothes|clothing|apron|bib|suit|tunic)\b/.test(n)) return 'robe'
  if (/\b(bracers?|bracelets?|wristbands?|armbands?|vambraces?)\b/.test(n)) return 'bracers'
  if (/\b(gloves?|gauntlets?|claws)\b/.test(n)) return 'gloves'
  if (/(belt|girdle)\b|\bsash\b/.test(n)) return 'belt'
  if (/\b(boots?|slippers?|sandals|shoes|greaves)\b/.test(n)) return 'boots'
  if (/\b(bag of holding|haversack|sack of|portable hole|bag of tricks|backpack|pack)\b/.test(n)) return 'backpack'
  return null
}

// Which body slot an item can be worn in — from its name, or failing that from the
// "while wearing this X" wording in its description. Null = no fixed slot (just Equip).
export function detectBodySlot(name: string, description?: string): BodySlotKey | null {
  // Magic armor variants ("Mariner's Armor", "Mithral Plate") are armor, not a body-slot item.
  if (/\b(armor|mail|breastplate)\b/i.test(name)) return null
  const byName = slotFromWords(name)
  if (byName) return byName
  const worn = description?.match(/\bwear(?:ing)?\s+(?:this|these|the)\s+([a-z' -]{2,30}?)(?=[,.;:]|\s(?:and|you|or|on|to|for|while|over|around|that|it|in|of)\b)/i)
  if (!worn || /\b(armor|mail|breastplate)\b/i.test(worn[1])) return null
  return slotFromWords(worn[1])
}

// +1/+2/+3 bonus from magic weapon name ("Longsword +1", "+2 Longsword")
// "+1 Longsword", or an artificer infusion's bonus (infusions only go on nonmagical items, so the
// two never stack)
export function magicBonus(item: { name: string; infusion?: string; attuned: boolean }, artificerLevel: number): number {
  const m = item.name.match(/\+(\d)\b/)
  return Math.max(m ? parseInt(m[1]) : 0, infusionBonus(item, artificerLevel))
}
export const artificerLevelOf = (char: Character) => char.classes.find(c => c.classSlug === 'artificer')?.level ?? 0

// Any skill spelling ("Animal Handling", "animal-handling", "animalHandling") → its SKILLS key,
// so granted skills from backgrounds/races/feats/items line up with char.skillProficiencies.
export const SKILL_KEY_BY_LETTERS = new Map<string, string>(SKILLS.map(s => [s.toLowerCase(), s]))
export function toSkillKey(s: string): string {
  return SKILL_KEY_BY_LETTERS.get(s.toLowerCase().replace(/[^a-z]/g, '')) ?? s
}

/**
 * For characters saved before proficiencies and languages were recorded: what to fill in from
 * their class, race and background. Only completely empty fields are filled, so nothing the
 * player set is overwritten. Unpicked language choices become a placeholder the sheet asks about.
 */
export function missingProficiencies(char: Character, content: ReturnType<typeof useContent>): Partial<Character> | null {
  const updates: Partial<Character> = {}
  const [primary, ...others] = char.classes
  if (primary && char.armorProficiencies.length === 0 && char.weaponProficiencies.length === 0) {
    const cls = content.classes.find(c => c.slug === primary.classSlug)
    const grants = others.map(c => MULTICLASS_PROF_GRANTS[c.classSlug]).filter(Boolean)
    const armor = [...(cls?.armorProficiencies ?? []), ...grants.flatMap(g => g.armor ?? [])]
    const weapons = [...(cls?.weaponProficiencies ?? []), ...grants.flatMap(g => g.weapons ?? [])]
    if (armor.length) updates.armorProficiencies = [...new Set(armor)]
    if (weapons.length) updates.weaponProficiencies = [...new Set(weapons)]
  }
  if (char.languages.length === 0) {
    const raceDef = content.races.find(r => r.slug === char.raceSlug)
    const race = splitRaceLanguages(raceDef?.grantedLanguages)
    race.choices += raceDef?.subraces?.find(sr => sr.slug === char.subraceSlug)?.extraLanguages ?? 0
    const bgChoices = content.backgrounds.find(b => b.slug === char.backgroundSlug)?.languages ?? 0
    const hasClass = (slug: string) => char.classes.some(c => c.classSlug === slug)
    const secret = [...(hasClass('druid') ? ['Druidic'] : []), ...(hasClass('rogue') ? ["Thieves' Cant"] : [])]
    const toPick = languageChoicePlaceholder(race.choices + bgChoices)
    updates.languages = [...new Set([...race.fixed, ...secret, ...(toPick ? [toPick] : [])])]
  }
  return Object.keys(updates).length ? updates : null
}

// Fighting styles: picked in the Creator ('fighting-style') or at level-up ('fighting-style-<class>')
export function fightingStyles(char: Character): Set<string> {
  return new Set(char.featuresChosen
    .filter(fc => fc.key === 'fighting-style' || fc.key.startsWith('fighting-style-'))
    .map(fc => typeof fc.value === 'string' ? fc.value : fc.value[0]))
}

/** Martial Arts (Monk): shortswords and simple melee weapons that aren't two-handed can use DEX */
export function isMonkWeapon(char: Character, ws: WeaponStats): boolean {
  if (!char.classes.some(c => c.classSlug === 'monk') || ws.ranged || ws.twoHanded) return false
  const slug = slugify(ws.label ?? '')
  return slug === 'shortsword' || SIMPLE_WEAPON_SLUGS.has(slug)
}

export function weaponAttackBonus(char: Character, ws: WeaponStats, pb: number, bonus = 0): number {
  const str = abilityModFor(char, 'str'), dex = abilityModFor(char, 'dex')
  if (ws.ranged) return dex + pb + bonus + (fightingStyles(char).has('archery') ? 2 : 0)
  if (ws.finesse || isMonkWeapon(char, ws)) return Math.max(str, dex) + pb + bonus
  return str + pb + bonus
}

export function weaponDamageMod(char: Character, ws: WeaponStats, bonus = 0): number {
  const str = abilityModFor(char, 'str'), dex = abilityModFor(char, 'dex')
  if (ws.ranged) return dex + bonus
  if (ws.finesse || isMonkWeapon(char, ws)) return Math.max(str, dex) + bonus
  return str + bonus
}

// Full AC: picks the best formula based on equipped armor, class, feats, and race
export function computeFullAC(
  char: Character,
  featNaturalArmorBase: number,
  items: ItemDef[],
  raceDef: { naturalArmor?: { base: number; addDex: boolean } } | undefined,
  itemAcBonus = 0,
  mediumDexCap = 2,  // 3 with Medium Armor Master
  mageArmor = false, // the Mage Armor spell is on (counts only without armor)
): { ac: number; source: string; stealthDisadv: boolean } {
  const dex = abilityModFor(char, 'dex')
  const equipped = char.equipment.filter(e => e.equipped)

  const artificerLevel = artificerLevelOf(char)
  let armorStat: ArmorStats | null = null
  let armorItem: Character['equipment'][number] | null = null
  let shieldAcBase = 0
  let shieldItem: Character['equipment'][number] | null = null

  for (const item of equipped) {
    const a = resolveArmor(item, items)
    if (!a) continue
    if (a.type === 'shield') { shieldAcBase = a.acBase; shieldItem = item; continue }
    if (!armorStat) { armorStat = a; armorItem = item }
  }
  const armorName = armorItem?.name ?? ''
  const hasShield = shieldAcBase > 0

  let baseAC: number
  let source: string
  let stealthDisadv = armorStat?.stealthDisadvantage ?? false

  if (armorStat) {
    const mb = armorItem ? magicBonus(armorItem, artificerLevel) : 0
    if (armorStat.type === 'light')       { baseAC = armorStat.acBase + dex + mb;             source = armorName }
    else if (armorStat.type === 'medium') { baseAC = armorStat.acBase + Math.min(dex, mediumDexCap) + mb; source = armorName }
    else                                  { baseAC = armorStat.acBase + mb;                    source = armorName }
    if (fightingStyles(char).has('defense')) { baseAC += 1; source += ' + Defense' }
  } else {
    // Unarmored — collect all candidates and take the best
    const candidates: Array<{ ac: number; label: string }> = []

    candidates.push({ ac: 10 + dex, label: 'Unarmored' })

    for (const cc of char.classes) {
      // Monk Unarmored Defense doesn't work with a shield (Barbarian's does)
      if (cc.classSlug === 'monk' && !hasShield) {
        candidates.push({ ac: 10 + dex + abilityModFor(char, 'wis'), label: 'Unarmored Defense (Monk)' })
      }
      if (cc.classSlug === 'barbarian') {
        candidates.push({ ac: 10 + dex + abilityModFor(char, 'con'), label: 'Unarmored Defense (Barbarian)' })
      }
      // Draconic Bloodline Sorcerer
      if (cc.classSlug === 'sorcerer' && cc.subclassSlug === 'draconic') {
        candidates.push({ ac: 13 + dex, label: 'Draconic Resilience' })
      }
      // Hexblade Warlock with Armor of Shadows invocation (we check featuresChosen)
      const hasArmorOfShadows = char.featuresChosen.some(fc =>
        typeof fc.value === 'string' ? fc.value === 'armor-of-shadows' : fc.value.includes('armor-of-shadows')
      )
      if (cc.classSlug === 'warlock' && hasArmorOfShadows) {
        candidates.push({ ac: 13 + dex, label: 'Armor of Shadows' })
      }
    }

    // Race natural armor
    const raceNatural = raceDef?.naturalArmor
    if (raceNatural) {
      candidates.push({
        ac: raceNatural.addDex ? raceNatural.base + dex : raceNatural.base,
        label: 'Natural Armor',
      })
    }

    // Feat natural armor (Dragon Hide)
    if (featNaturalArmorBase > 0) {
      candidates.push({ ac: featNaturalArmorBase + dex, label: 'Dragon Hide' })
    }

    if (mageArmor) candidates.push({ ac: 13 + dex, label: 'Mage Armor' })

    const best = candidates.reduce((a, b) => a.ac >= b.ac ? a : b)
    baseAC = best.ac
    source = best.label
  }

  if (hasShield) { baseAC += shieldAcBase + (shieldItem ? magicBonus(shieldItem, artificerLevel) : 0); source += ' + Shield' }
  if (itemAcBonus > 0) { baseAC += itemAcBonus; source += ` +${itemAcBonus} item` }
  return { ac: baseAC, source, stealthDisadv }
}

// ── Proficiency helpers ───────────────────────────────────────────────────

export const SIMPLE_WEAPON_SLUGS = new Set([
  'club','dagger','greatclub','handaxe','javelin','light-hammer','mace',
  'quarterstaff','sickle','spear','crossbow-light','dart','shortbow','sling',
])

export function isWeaponProficient(char: Character, item: { itemSlug: string; name: string }): boolean {
  // The inventory slug and the name both count, so "+1 Longsword" or a renamed item still match
  const slugs = [item.itemSlug, slugify(item.name)]
  const isA = (base: string) => slugs.some(s => hasSlugWords(s, base))
  for (const raw of char.weaponProficiencies) {
    const p = raw.toLowerCase().replace(/\s+weapons?$/, '').trim()
    if (p === 'martial') return true
    if (p === 'simple') {
      if ([...SIMPLE_WEAPON_SLUGS].some(isA)) return true
      continue
    }
    // A named weapon: "hand crossbows" covers the slug "crossbow-hand", "longswords" covers "longsword"
    const words = p.split(/[\s-]+/).map(w => w.replace(/s$/, ''))
    if (slugs.some(s => { const have = new Set(s.split('-')); return words.every(w => have.has(w)) })) return true
  }
  return false
}

export function isArmorProficient(char: Character, as_: ArmorStats, featArmor: Map<ArmorKind, string>): boolean {
  // Stored as "light" / "Light Armor" / "all" / "shields (non-metal)" depending on the source; armor
  // feats (Heavily Armored, …) count too. Heavy proficiency covers lighter armor, medium covers light.
  const kinds = armorKindsOf(char.armorProficiencies)
  for (const k of featArmor.keys()) kinds.add(k)
  if (as_.type === 'shield') return kinds.has('shields')
  if (kinds.has('heavy')) return true
  if (kinds.has('medium') && (as_.type === 'medium' || as_.type === 'light')) return true
  return kinds.has('light') && as_.type === 'light'
}

// Aggregate all resistances, immunities, condition immunities and advantages
export function deriveResistances(
  raceDef: { resistances?: string[]; immunities?: string[]; conditionImmunities?: string[]; advantages?: string[] } | undefined,
  featBonuses: ReturnType<typeof sumFeatBonuses>,
  itemBonuses: { resistances: string[]; immunities: string[]; conditionImmunities: string[] },
  potionFx: { resistances: string[]; conditionImmunities: string[]; advantages: string[] },
) {
  const unique = (arr: string[]) => [...new Set(arr.map(s => s.toLowerCase()))]
  return {
    resistances: unique([...(raceDef?.resistances ?? []), ...featBonuses.resistances, ...itemBonuses.resistances, ...potionFx.resistances]),
    immunities: unique([...(raceDef?.immunities ?? []), ...featBonuses.immunities, ...itemBonuses.immunities]),
    conditionImmunities: unique([...(raceDef?.conditionImmunities ?? []), ...featBonuses.conditionImmunities, ...itemBonuses.conditionImmunities, ...potionFx.conditionImmunities]),
    advantages: unique([...(raceDef?.advantages ?? []), ...featBonuses.advantages, ...potionFx.advantages]),
  }
}

export type SkillSourceTag = { label: string; kind: 'bg' | 'race' | 'class' | 'feat' | 'item' | 'manual' }

export interface SkillSourceInfo {
  profTags: Map<string, SkillSourceTag[]>
  expertTags: Map<string, SkillSourceTag[]>
  autoProfs: Set<string>
  autoExpert: Set<string>
}

export function deriveSkillSources(
  char: Character,
  content: import('../../content/ContentProvider').ContentData,
  raceDef: { grantedSkills?: string[] } | undefined,
  classOptions: Record<string, { name?: string; skillChoices?: string[] }>,
  featSlugs: string[],
): SkillSourceInfo {
  const profTags = new Map<string, SkillSourceTag[]>()
  const expertTags = new Map<string, SkillSourceTag[]>()
  const autoProfs = new Set<string>()
  const autoExpert = new Set<string>()

  const toSlug = toSkillKey

  const addProf = (skill: string, tag: SkillSourceTag) => {
    const s = toSlug(skill)
    if (!profTags.has(s)) profTags.set(s, [])
    profTags.get(s)!.push(tag)
  }
  const addExpert = (skill: string, tag: SkillSourceTag) => {
    const s = toSlug(skill)
    if (!expertTags.has(s)) expertTags.set(s, [])
    expertTags.get(s)!.push(tag)
  }

  // Background
  content.backgrounds.find(b => b.slug === char.backgroundSlug)
    ?.skillProficiencies.forEach(s => { addProf(s, { label: 'BG', kind: 'bg' }); autoProfs.add(toSlug(s)) })

  // Race
  raceDef?.grantedSkills?.forEach(s => { addProf(s, { label: 'Race', kind: 'race' }); autoProfs.add(toSlug(s)) })

  // Feats with specific skill grants (homebrew feats using new fields)
  const featBySlug = new Map(content.feats.map(f => [f.slug, f]))
  for (const slug of featSlugs) {
    const feat = featBySlug.get(slug)
    if (!feat) continue
    feat.grantedSkillProficiencies?.forEach(s => { addProf(s, { label: feat.name, kind: 'feat' }); autoProfs.add(toSlug(s)) })
    feat.grantedSkillExpertise?.forEach(s => { addExpert(s, { label: feat.name, kind: 'feat' }); autoExpert.add(toSlug(s)) })
  }

  // Equipped items
  const itemBySlug = new Map(content.items.map(i => [i.slug, i]))
  for (const slot of char.equipment) {
    const def = itemBySlug.get(slot.itemSlug)
    if (!def) continue
    const active = itemIsActive(slot, def)
    if (!active) continue
    def.grantedSkillProficiencies?.forEach(s => { addProf(s, { label: def.name, kind: 'item' }); autoProfs.add(toSlug(s)) })
    def.grantedSkillExpertise?.forEach(s => { addExpert(s, { label: def.name, kind: 'item' }); autoExpert.add(toSlug(s)) })
  }

  // Class — infer skills in char.skillProficiencies that match the class's eligible list
  const classSkillChoiceSet = new Set(
    char.classes.flatMap(cc => (classOptions[cc.classSlug]?.skillChoices ?? []).map(toSlug))
  )
  for (const skill of char.skillProficiencies) {
    if (autoProfs.has(skill)) continue
    if (classSkillChoiceSet.has(skill)) {
      const className = char.classes.length === 1
        ? (classOptions[char.classes[0].classSlug]?.name ?? char.classes[0].classSlug)
        : 'Class'
      addProf(skill, { label: className, kind: 'class' })
    }
  }

  // Expertise in char.skillExpertise: attribute to class or manual
  const classGrantsExpertise = char.classes.some(cc =>
    (cc.classSlug === 'rogue' && cc.level >= 1) || (cc.classSlug === 'bard' && cc.level >= 3)
  )
  for (const skill of char.skillExpertise) {
    if (autoExpert.has(skill)) continue
    addExpert(skill, { label: classGrantsExpertise ? 'Class' : 'Manual', kind: classGrantsExpertise ? 'class' : 'manual' })
  }

  return { profTags, expertTags, autoProfs, autoExpert }
}

export function parseUpcastScaling(higherLevels: string): { dice: string; type?: string } | null {
  const m = higherLevels.match(/(?:damage|healing)\s+increases?\s+by\s+(\d+d\d+)\s+for\s+each\s+(?:slot\s+)?level/i)
  if (m) {
    const typeM = higherLevels.match(/increases?\s+by\s+\d+d\d+\s+(radiant|necrotic|fire|cold|lightning|thunder|poison|acid|psychic|force)/i)
    return { dice: m[1], type: typeM?.[1]?.toLowerCase() }
  }
  return null
}

export function computeUpcastDamage(baseDice: string, incDice: string, levelsAbove: number): string | null {
  const bm = baseDice.match(/^(\d+)(d\d+)$/)
  const im = incDice.match(/^(\d+)(d\d+)$/)
  if (!bm || !im || bm[2] !== im[2]) return null
  return `${parseInt(bm[1]) + parseInt(im[1]) * levelsAbove}${bm[2]}`
}

export function extractAoE(range: string): string | null {
  const m = range.match(/\(([^)]+)\)/)
  if (!m) return null
  return m[1].replace(/-foot-/g, '-foot ').replace(/-foot\b/g, ' ft').replace(/\bfoot\b/g, 'ft').replace(/\bfeet\b/g, 'ft')
}

export const DAMAGE_TYPE_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  fire:        { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-300' },
  cold:        { bg: 'bg-cyan-100',   text: 'text-cyan-800',   border: 'border-cyan-300'   },
  lightning:   { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300' },
  thunder:     { bg: 'bg-indigo-100', text: 'text-indigo-800', border: 'border-indigo-300' },
  poison:      { bg: 'bg-green-100',  text: 'text-green-800',  border: 'border-green-300'  },
  acid:        { bg: 'bg-lime-100',   text: 'text-lime-800',   border: 'border-lime-300'   },
  psychic:     { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-300' },
  necrotic:    { bg: 'bg-stone-200',  text: 'text-stone-800',  border: 'border-stone-400'  },
  radiant:     { bg: 'bg-amber-100',  text: 'text-amber-800',  border: 'border-amber-300'  },
  force:       { bg: 'bg-violet-100', text: 'text-violet-800', border: 'border-violet-300' },
  bludgeoning: { bg: 'bg-parchment-200', text: 'text-parchment-800', border: 'border-parchment-400' },
  piercing:    { bg: 'bg-parchment-200', text: 'text-parchment-800', border: 'border-parchment-400' },
  slashing:    { bg: 'bg-parchment-200', text: 'text-parchment-800', border: 'border-parchment-400' },
}

/** What a spell mostly does, for the small coloured mark on its row in the Spells tab: damage
 *  (coloured by its damage type), healing, control (a condition it inflicts), protection
 *  (abjuration) or anything else */
export type SpellRole = 'damage' | 'heal' | 'control' | 'ward' | 'utility'
const HEALS = /(?<!can['’]t |cannot )\bregains?\b[^.]{0,80}hit points?|\brestores?\b[^.]{0,40}hit points?|\breturns? to life|\bbecomes? stable|\bend either one disease or one condition|\bends? one of the following effects/i
const INFLICTS = /\b(charmed|frightened|paralyzed|restrained|incapacitated|stunned|blinded|deafened|prone|petrified|poisoned|unconscious)\b/i
// Spells the wording rules get wrong (they mention hit points or conditions in passing)
const ROLE_OVERRIDE: Record<string, SpellRole> = { wish: 'utility', 'temple-of-the-gods': 'utility' }

export function spellRole(def: Pick<SpellDef, 'slug' | 'school' | 'description' | 'damage' | 'savingThrow'>): SpellRole {
  if (ROLE_OVERRIDE[def.slug]) return ROLE_OVERRIDE[def.slug]
  if (def.damage) return 'damage'
  if (HEALS.test(def.description)) return 'heal'
  if (INFLICTS.test(def.description) && (def.savingThrow || /^(Enchantment|Illusion)$/i.test(def.school))) return 'control'
  if (/^Abjuration$/i.test(def.school)) return 'ward'
  return 'utility'
}

/** How much a healing spell heals, read from its text: "1d8 + your spellcasting ability modifier" → { dice: '1d8', addMod: true } */
export function spellHealing(def: Pick<SpellDef, 'description'>): { dice: string; addMod: boolean } | null {
  const m = def.description.match(/hit points equal to (\d+d\d+)( \+ your spellcasting ability modifier)?|\bregains? (\d+d\d+|\d+) hit points/i)
  return m ? { dice: m[1] ?? m[3], addMod: !!m[2] } : null
}

/** The mark's colours and what its tooltip says. Damage uses DAMAGE_TYPE_STYLE instead. */
export const SPELL_ROLE_STYLE: Record<Exclude<SpellRole, 'damage'>, { label: string; chip: string }> = {
  heal:    { label: 'Healing', chip: 'bg-green-100 text-green-700' },
  control: { label: 'Control', chip: 'bg-pink-100 text-pink-700' },
  ward:    { label: 'Protection', chip: 'bg-blue-100 text-blue-700' },
  // A fixed stone grey: the theme's own tint matched Healing in Forest and Control in Feywild
  utility: { label: 'Utility', chip: 'bg-stone-200 text-stone-600' },
}

export const ABILITY_LABELS: Record<string, string> = {
  str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA',
}

export const ABILITY_FULL: Record<string, string> = {
  str: 'Strength', dex: 'Dexterity', con: 'Constitution',
  int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma',
}

export type Tab = 'stats' | 'spells' | 'inventory' | 'features' | 'notes' | 'summons'

export const CONDITIONS: { name: string; effect: string }[] = [
  { name: 'Blinded',       effect: 'Fail sight checks; attacks vs you have adv, yours have disadv' },
  { name: 'Charmed',       effect: "Can't attack charmer; charmer has adv on social checks vs you" },
  { name: 'Deafened',      effect: 'Fail hearing checks; immune to effects requiring hearing' },
  { name: 'Frightened',    effect: "Disadv on rolls while source in sight; can't move closer to source" },
  { name: 'Grappled',      effect: 'Speed = 0; ends if grappler is incapacitated' },
  { name: 'Incapacitated', effect: "Can't take actions or reactions" },
  { name: 'Invisible',     effect: 'Unseen; attacks vs you have disadv, your attacks have adv' },
  { name: 'Paralyzed',     effect: 'Incapacitated; auto-fail STR/DEX saves; hits within 5ft crit' },
  { name: 'Petrified',     effect: 'Incapacitated; resistance all damage; auto-fail STR/DEX saves' },
  { name: 'Poisoned',      effect: 'Disadvantage on attack rolls and ability checks' },
  { name: 'Prone',         effect: 'Disadv on attacks; melee attacks vs you have adv; ranged attacks have disadv' },
  { name: 'Restrained',    effect: 'Speed 0; disadv on attacks and DEX saves; attacks vs you have adv' },
  { name: 'Stunned',       effect: 'Incapacitated; auto-fail STR/DEX saves; attacks vs you have adv' },
  { name: 'Unconscious',   effect: 'Incapacitated + prone; auto-fail STR/DEX; hits within 5ft crit' },
]
