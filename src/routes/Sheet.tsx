import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Character, Summon, SKILLS, SKILL_LABELS, ABILITIES } from '../character/model'
import { listCharactersFromDisk, saveCharacterToDisk } from '../storage/charApi'
import { useContent } from '../content/ContentProvider'
import {
  abilityModFor, profBonus, skillMod, saveMod, hpMax,
  totalLevel, passivePerception, formatMod,
  spellSaveDC, spellAttackBonus,
  deriveClassResources, shortRestResourceKeys, longRestResourceKeys,
  hasBardJackOfAllTrades, monkSpeedBonus, sneakAttackDice, paladinAuraBonus,
} from '../character/derive'
import { touchUpdated } from '../character/create'
import {
  CLASS_OPTIONS, ELDRITCH_INVOCATIONS, METAMAGIC_OPTIONS, ARTIFICER_INFUSIONS,
  LAND_CIRCLE_SPELLS, RUNE_KNIGHT_RUNES, HUNTER_CHOICES,
  TOTEM_ANIMALS, STORM_AURA_OPTIONS, FOUR_ELEMENTS_DISCIPLINES,
  isMulticlassSpellcaster, multiclassSpellSlotsMax, CASTER_TYPE, effectiveCasterLevel,
} from '../data/classData'
import { asiLevelsForClass } from '../character/levelUp'
import { DRACONIC_ANCESTRIES, RACE_OPTIONS } from '../data/raceData'
import { STRIXHAVEN_COLLEGES } from '../data/strixhavenSpells'
import { SpellStatBlock, cleanHigherLevels } from '../components/SpellStatBlock'
import { WeaponStatBlock, ArmorStatBlock, MagicItemStatBlock } from '../components/ItemStatBlock'
import { sumFeatBonuses } from '../character/featBonuses'
import { sumItemBonuses, effectiveAbilityScores } from '../character/itemBonuses'
import { cantripDiceAtLevel } from '../data/spellMeta'
import { exportCharacter } from '../storage/ioFile'
import { BATTLE_MASTER_MANEUVERS } from '../data/classData'
import type { WeaponStats, ArmorStats, ItemDef } from '../content/loaders'

// ── Weapon / armor resolution ─────────────────────────────────────────────
// The lookup tables formerly defined here are now in `src/data/itemOverlay.ts`
// and merged into `ItemDef.weaponStats` / `ItemDef.armorStats` at load time.

function slugify(s: string): string {
  return s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

function resolveWeapon(item: { itemSlug: string; name: string }, items: ItemDef[]): WeaponStats | undefined {
  const direct = items.find(i => i.slug === item.itemSlug)?.weaponStats
  if (direct) return direct
  const byName = items.find(i => i.slug === slugify(item.name))?.weaponStats
  if (byName) return byName
  // Fuzzy: for magic weapons like "Flame Tongue Longsword" match the base weapon.
  const lower = slugify(item.name)
  for (const i of items) {
    if (i.weaponStats && lower.includes(i.slug)) return i.weaponStats
  }
  return undefined
}

function resolveArmor(item: { itemSlug: string; name: string }, items: ItemDef[]): ArmorStats | undefined {
  const direct = items.find(i => i.slug === item.itemSlug)?.armorStats
  if (direct) return direct
  const byName = items.find(i => i.slug === slugify(item.name))?.armorStats
  if (byName) return byName
  const lower = slugify(item.name)
  for (const i of items) {
    if (i.armorStats && lower.includes(i.slug)) return i.armorStats
  }
  return undefined
}

type BodySlotKey = 'helmet' | 'eyes' | 'amulet' | 'cloak' | 'robe' | 'bracers' | 'gloves' | 'belt' | 'boots' | 'backpack'

function detectBodySlot(name: string): BodySlotKey | null {
  const n = name.toLowerCase()
  if (/\b(helm|helmet|crown|circlet|\bhat\b|\bcap\b|headband|tiara|diadem)/.test(n)) return 'helmet'
  if (/\b(goggles|mask\b|masque|spectacles|lenses of|eyes of)/.test(n)) return 'eyes'
  if (/\b(amulet|necklace|periapt|pendant|talisman|choker)/.test(n)) return 'amulet'
  if (/\b(cloak|cape|mantle)/.test(n)) return 'cloak'
  if (/\b(robe|vestments|garb)/.test(n)) return 'robe'
  if (/\b(bracers|bracer|bracelet|wristband|armband)/.test(n)) return 'bracers'
  if (/\b(gloves|glove|gauntlets|gauntlet)/.test(n)) return 'gloves'
  if (/\b(belt|girdle|sash)/.test(n)) return 'belt'
  if (/\b(boots|boot|slippers|slipper|sandals|shoes)/.test(n)) return 'boots'
  if (/\b(bag of holding|haversack|sack of|portable hole|bag of tricks)/.test(n)) return 'backpack'
  return null
}

// +1/+2/+3 bonus from magic weapon name ("Longsword +1", "+2 Longsword")
function magicBonus(name: string): number {
  const m = name.match(/\+(\d)\b/)
  return m ? parseInt(m[1]) : 0
}

function weaponAttackBonus(char: Character, ws: WeaponStats, pb: number, bonus = 0): number {
  const str = abilityModFor(char, 'str'), dex = abilityModFor(char, 'dex')
  if (ws.ranged) return dex + pb + bonus
  if (ws.finesse) return Math.max(str, dex) + pb + bonus
  return str + pb + bonus
}

function weaponDamageMod(char: Character, ws: WeaponStats, bonus = 0): number {
  const str = abilityModFor(char, 'str'), dex = abilityModFor(char, 'dex')
  if (ws.ranged) return dex + bonus
  if (ws.finesse) return Math.max(str, dex) + bonus
  return str + bonus
}

// Full AC: picks the best formula based on equipped armor, class, feats, and race
function computeFullAC(
  char: Character,
  featNaturalArmorBase: number,
  items: ItemDef[],
  raceDef: { naturalArmor?: { base: number; addDex: boolean } } | undefined,
  itemAcBonus = 0,
): { ac: number; source: string; stealthDisadv: boolean } {
  const dex = abilityModFor(char, 'dex')
  const equipped = char.equipment.filter(e => e.equipped)

  let armorStat: ArmorStats | null = null
  let armorName = ''
  let shieldAcBase = 0
  let shieldItemName = ''

  for (const item of equipped) {
    const a = resolveArmor(item, items)
    if (!a) continue
    if (a.type === 'shield') { shieldAcBase = a.acBase; shieldItemName = item.name; continue }
    if (!armorStat) { armorStat = a; armorName = item.name }
  }
  const hasShield = shieldAcBase > 0

  let baseAC: number
  let source: string
  let stealthDisadv = armorStat?.stealthDisadvantage ?? false

  if (armorStat) {
    const mb = magicBonus(armorName)
    if (armorStat.type === 'light')       { baseAC = armorStat.acBase + dex + mb;             source = armorName }
    else if (armorStat.type === 'medium') { baseAC = armorStat.acBase + Math.min(dex, 2) + mb; source = armorName }
    else                                  { baseAC = armorStat.acBase + mb;                    source = armorName }
  } else {
    // Unarmored — collect all candidates and take the best
    const candidates: Array<{ ac: number; label: string }> = []

    candidates.push({ ac: 10 + dex, label: 'Unarmored' })

    for (const cc of char.classes) {
      if (cc.classSlug === 'monk') {
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

    const best = candidates.reduce((a, b) => a.ac >= b.ac ? a : b)
    baseAC = best.ac
    source = best.label
  }

  if (hasShield) { baseAC += shieldAcBase + magicBonus(shieldItemName); source += ' + Shield' }
  if (itemAcBonus > 0) { baseAC += itemAcBonus; source += ` +${itemAcBonus} item` }
  return { ac: baseAC, source, stealthDisadv }
}

// ── Proficiency helpers ───────────────────────────────────────────────────

const SIMPLE_WEAPON_SLUGS = new Set([
  'club','dagger','greatclub','handaxe','javelin','light-hammer','mace',
  'quarterstaff','sickle','spear','crossbow-light','dart','shortbow','sling',
])

function isWeaponProficient(char: Character, slug: string): boolean {
  const profs = char.weaponProficiencies.map(p => p.toLowerCase())
  if (profs.includes('martial') || profs.includes('martial weapons')) return true
  if ((profs.includes('simple') || profs.includes('simple weapons')) && SIMPLE_WEAPON_SLUGS.has(slug)) return true
  if (profs.includes(slug)) return true
  // Match by partial name (e.g. "longswords" covers "longsword")
  return profs.some(p => slug.includes(p.replace(/s$/, '')) || p.includes(slug))
}

function isArmorProficient(char: Character, as_: ArmorStats): boolean {
  const profs = char.armorProficiencies.map(p => p.toLowerCase())
  if (as_.type === 'shield') return profs.includes('shields') || profs.includes('shield')
  if (profs.includes('heavy') || profs.includes('heavy armor')) return true
  if ((profs.includes('medium') || profs.includes('medium armor')) && (as_.type === 'medium' || as_.type === 'light')) return true
  if ((profs.includes('light') || profs.includes('light armor')) && as_.type === 'light') return true
  return false
}

// Aggregate all resistances, immunities, condition immunities and advantages
function deriveResistances(
  raceDef: { resistances?: string[]; immunities?: string[]; conditionImmunities?: string[]; advantages?: string[] } | undefined,
  featBonuses: ReturnType<typeof sumFeatBonuses>,
  itemBonuses: { resistances: string[]; immunities: string[]; conditionImmunities: string[] },
) {
  const unique = (arr: string[]) => [...new Set(arr.map(s => s.toLowerCase()))]
  return {
    resistances: unique([...(raceDef?.resistances ?? []), ...featBonuses.resistances, ...itemBonuses.resistances]),
    immunities: unique([...(raceDef?.immunities ?? []), ...featBonuses.immunities, ...itemBonuses.immunities]),
    conditionImmunities: unique([...(raceDef?.conditionImmunities ?? []), ...featBonuses.conditionImmunities, ...itemBonuses.conditionImmunities]),
    advantages: unique([...(raceDef?.advantages ?? []), ...featBonuses.advantages]),
  }
}

type SkillSourceTag = { label: string; kind: 'bg' | 'race' | 'class' | 'feat' | 'item' | 'manual' }

interface SkillSourceInfo {
  profTags: Map<string, SkillSourceTag[]>
  expertTags: Map<string, SkillSourceTag[]>
  autoProfs: Set<string>
  autoExpert: Set<string>
}

function deriveSkillSources(
  char: Character,
  content: import('../content/ContentProvider').ContentData,
  raceDef: { grantedSkills?: string[] } | undefined,
  classOptions: Record<string, { name?: string; skillChoices?: string[] }>,
  featSlugs: string[],
): SkillSourceInfo {
  const profTags = new Map<string, SkillSourceTag[]>()
  const expertTags = new Map<string, SkillSourceTag[]>()
  const autoProfs = new Set<string>()
  const autoExpert = new Set<string>()

  const toSlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

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
    const active = slot.equipped || def.type === 'Ring'
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

function parseUpcastScaling(higherLevels: string): { dice: string; type?: string } | null {
  const m = higherLevels.match(/(?:damage|healing)\s+increases?\s+by\s+(\d+d\d+)\s+for\s+each\s+(?:slot\s+)?level/i)
  if (m) {
    const typeM = higherLevels.match(/increases?\s+by\s+\d+d\d+\s+(radiant|necrotic|fire|cold|lightning|thunder|poison|acid|psychic|force)/i)
    return { dice: m[1], type: typeM?.[1]?.toLowerCase() }
  }
  return null
}

function computeUpcastDamage(baseDice: string, incDice: string, levelsAbove: number): string | null {
  const bm = baseDice.match(/^(\d+)(d\d+)$/)
  const im = incDice.match(/^(\d+)(d\d+)$/)
  if (!bm || !im || bm[2] !== im[2]) return null
  return `${parseInt(bm[1]) + parseInt(im[1]) * levelsAbove}${bm[2]}`
}

function extractAoE(range: string): string | null {
  const m = range.match(/\(([^)]+)\)/)
  if (!m) return null
  return m[1].replace(/-foot-/g, '-foot ').replace(/-foot\b/g, ' ft').replace(/\bfoot\b/g, 'ft').replace(/\bfeet\b/g, 'ft')
}

const DAMAGE_TYPE_STYLE: Record<string, { bg: string; text: string; border: string }> = {
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

const ABILITY_LABELS: Record<string, string> = {
  str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA',
}

const ABILITY_FULL: Record<string, string> = {
  str: 'Strength', dex: 'Dexterity', con: 'Constitution',
  int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma',
}

type Tab = 'stats' | 'spells' | 'inventory' | 'features' | 'notes' | 'summons'

const CONDITIONS: { name: string; effect: string }[] = [
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

// ── Campaign Board types ────────────────────────────────────────────────────
interface BoardNote { id: string; x: number; y: number; w: number; h: number; title: string; content: string; color: string }
interface BoardConn { id: string; from: string; to: string; label?: string }
interface Board { id: string; name: string; notes: BoardNote[]; connections: BoardConn[] }


function noteRotation(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (Math.imul(31, h) + id.charCodeAt(i)) | 0
  return ((h % 7) - 3) * 0.8
}

function CampaignBoardManager({
  boards: initBoards, activeBoard: initActive,
  onChange,
}: {
  boards: Board[]; activeBoard: string
  onChange: (boards: Board[], activeBoard: string) => void
}) {
  const [boards, setBoards] = useState<Board[]>(initBoards)
  const [activeId, setActiveId] = useState<string>(initActive || initBoards[0]?.id || '')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameVal, setRenameVal] = useState('')

  function save(next: Board[], nextActive: string) {
    setBoards(next); onChange(next, nextActive)
  }

  function addBoard() {
    const id = `board-${Date.now()}`
    const next = [...boards, { id, name: 'New Board', notes: [], connections: [] }]
    setActiveId(id)
    save(next, id)
  }

  function deleteBoard(id: string) {
    if (boards.length <= 1) return
    const next = boards.filter(b => b.id !== id)
    const nextActive = activeId === id ? next[0].id : activeId
    setActiveId(nextActive)
    save(next, nextActive)
  }

  function renameBoard(id: string, name: string) {
    save(boards.map(b => b.id === id ? { ...b, name } : b), activeId)
    setRenamingId(null)
  }

  function onBoardChange(notes: BoardNote[], connections: BoardConn[]) {
    const next = boards.map(b => b.id === activeId ? { ...b, notes, connections } : b)
    save(next, activeId)
  }

  const active = boards.find(b => b.id === activeId) ?? boards[0]

  return (
    <div className="card p-0 overflow-hidden">
      {/* Board tabs */}
      <div className="flex items-center gap-0 border-b border-parchment-200 bg-parchment-50 overflow-x-auto">
        {boards.map(b => (
          <div key={b.id}
            className={`flex items-center gap-1 px-3 py-2 border-r border-parchment-200 cursor-pointer shrink-0 group ${
              b.id === activeId ? 'bg-parchment-50 border-b-white text-parchment-900 font-semibold' : 'text-parchment-500 hover:bg-parchment-100'
            }`}
            onClick={() => { setActiveId(b.id); onChange(boards, b.id) }}
          >
            {renamingId === b.id ? (
              <input
                autoFocus
                className="text-xs outline-none bg-transparent border-b border-parchment-500 w-28 min-w-0"
                value={renameVal}
                onChange={e => setRenameVal(e.target.value)}
                onBlur={() => renameBoard(b.id, renameVal.trim() || b.name)}
                onKeyDown={e => { if (e.key === 'Enter') renameBoard(b.id, renameVal.trim() || b.name); if (e.key === 'Escape') setRenamingId(null) }}
                onClick={e => e.stopPropagation()}
              />
            ) : (
              <span className="text-xs truncate max-w-[120px]">{b.name}</span>
            )}
            {/* Pencil — always visible on active tab, hover on others */}
            {renamingId !== b.id && (
              <button type="button"
                title="Rename board"
                className={`text-[10px] transition-opacity ml-0.5 shrink-0 ${
                  b.id === activeId
                    ? 'text-parchment-400 hover:text-parchment-700 opacity-60 hover:opacity-100'
                    : 'text-parchment-300 hover:text-parchment-600 opacity-0 group-hover:opacity-100'
                }`}
                onClick={e => { e.stopPropagation(); setRenamingId(b.id); setRenameVal(b.name) }}
              >✎</button>
            )}
            {boards.length > 1 && renamingId !== b.id && (
              <button type="button"
                title="Delete board"
                className="text-[10px] text-parchment-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity ml-0.5 shrink-0"
                onClick={e => { e.stopPropagation(); deleteBoard(b.id) }}
              >✕</button>
            )}
          </div>
        ))}
        <button type="button"
          onClick={addBoard}
          className="px-3 py-2 text-xs text-parchment-400 hover:text-parchment-700 hover:bg-parchment-100 transition-colors shrink-0 font-medium"
        >+ New Board</button>
      </div>

      {boards.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <p className="text-parchment-400 text-sm">No boards yet</p>
          <button type="button" onClick={addBoard}
            className="text-sm bg-parchment-700 text-parchment-100 hover:bg-parchment-800 rounded px-4 py-2 font-semibold transition-colors">
            Create First Board
          </button>
        </div>
      ) : active ? (
        <CampaignBoard
          key={active.id}
          notes={active.notes}
          connections={active.connections}
          onChange={onBoardChange}
          boardName={active.name}
        />
      ) : null}
    </div>
  )
}

const NOTE_BG: Record<string, { card: string; pin: string; text: string; sub: string }> = {
  yellow: { card: '#fef08a', pin: '#ca8a04', text: '#713f12', sub: '#92400e' },
  pink:   { card: '#fbcfe8', pin: '#be185d', text: '#831843', sub: '#9d174d' },
  blue:   { card: '#bae6fd', pin: '#0369a1', text: '#0c4a6e', sub: '#075985' },
  green:  { card: '#bbf7d0', pin: '#15803d', text: '#14532d', sub: '#166534' },
  purple: { card: '#e9d5ff', pin: '#7c3aed', text: '#3b0764', sub: '#4c1d95' },
  orange: { card: '#fed7aa', pin: '#c2410c', text: '#7c2d12', sub: '#9a3412' },
}

function CampaignBoard({
  notes: initNotes, connections: initConns,
  onChange, boardName,
}: {
  notes: BoardNote[]; connections: BoardConn[]
  onChange: (notes: BoardNote[], connections: BoardConn[]) => void
  boardName: string
}) {
  const [notes, setNotes] = useState<BoardNote[]>(initNotes)
  const [conns, setConns] = useState<BoardConn[]>(initConns)
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null)
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null)
  const [editingConn, setEditingConn] = useState<{ id: string; val: string } | null>(null)
  const [scale, setScaleState] = useState(0.65)
  const scaleRef = useRef(0.65)
  const outerRef = useRef<HTMLDivElement>(null)
  const dragging = useRef<
    | { type: 'move';   id: string; ox: number; oy: number }
    | { type: 'resize'; id: string; sx: number; sy: number; sw: number; sh: number }
    | null
  >(null)
  const panning = useRef<{ startX: number; startY: number; scrollLeft: number; scrollTop: number } | null>(null)
  const [isPanning, setIsPanning] = useState(false)
  const BOARD_W = 3200
  const BOARD_H = 2400
  const VIEWPORT_H = 680
  const MIN_SCALE = 0.4, MAX_SCALE = 2.0
  const MIN_W = 160, MIN_H = 140

  function setScale(s: number) { scaleRef.current = s; setScaleState(s) }

  function updateNotes(next: BoardNote[]) { setNotes(next); onChange(next, conns) }
  function updateConns(next: BoardConn[]) { setConns(next); onChange(notes, next) }

  // Board coords: convert screen-space mouse position to virtual canvas coords
  function boardCoords(e: React.MouseEvent | MouseEvent): { bx: number; by: number } {
    const outer = outerRef.current!
    const rect = outer.getBoundingClientRect()
    const s = scaleRef.current
    return {
      bx: (e.clientX - rect.left + outer.scrollLeft) / s,
      by: (e.clientY - rect.top + outer.scrollTop) / s,
    }
  }


  function addNote() {
    const outer = outerRef.current!
    const s = scaleRef.current
    const vpW = outer.clientWidth / s
    const vpH = VIEWPORT_H / s
    const scrollX = outer.scrollLeft / s
    const scrollY = outer.scrollTop / s
    const w = 200, h = 200
    const id = `note-${Date.now()}`
    const x = Math.min(BOARD_W - w - 20, scrollX + Math.random() * Math.max(0, vpW - w - 60) + 30)
    const y = Math.min(BOARD_H - h - 20, scrollY + Math.random() * Math.max(0, vpH - h - 60) + 30)
    updateNotes([...notes, { id, x, y, w, h, title: 'New Note', content: '', color: 'yellow' }])
  }

  function deleteNote(id: string) {
    setNotes(prev => { const n = prev.filter(n => n.id !== id); onChange(n, conns.filter(c => c.from !== id && c.to !== id)); return n })
    setConns(prev => prev.filter(c => c.from !== id && c.to !== id))
    if (connectingFrom === id) setConnectingFrom(null)
  }

  function patchNote(id: string, changes: Partial<BoardNote>) {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, ...changes } : n))
  }

  function onBoardMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    if (connectingFrom || dragging.current) return
    const outer = outerRef.current!
    panning.current = { startX: e.clientX, startY: e.clientY, scrollLeft: outer.scrollLeft, scrollTop: outer.scrollTop }
    setIsPanning(true)
  }

  function onBoardMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (panning.current && !dragging.current) {
      const outer = outerRef.current!
      outer.scrollLeft = panning.current.scrollLeft - (e.clientX - panning.current.startX)
      outer.scrollTop  = panning.current.scrollTop  - (e.clientY - panning.current.startY)
      return
    }
    const { bx, by } = boardCoords(e)
    setMousePos({ x: bx, y: by })
    if (!dragging.current) return
    if (dragging.current.type === 'move') {
      const { id, ox, oy } = dragging.current
      setNotes(prev => prev.map(n => n.id === id ? { ...n, x: Math.max(0, bx - ox), y: Math.max(0, by - oy) } : n))
    } else {
      const { id, sx, sy, sw, sh } = dragging.current
      const nw = Math.max(MIN_W, sw + (bx - sx))
      const nh = Math.max(MIN_H, sh + (by - sy))
      setNotes(prev => prev.map(n => n.id === id ? { ...n, w: nw, h: nh } : n))
    }
  }

  function onBoardMouseUp() {
    if (dragging.current) { onChange(notes, conns); dragging.current = null }
    panning.current = null
    setIsPanning(false)
  }

  function onNoteMoveDown(e: React.MouseEvent, id: string) {
    if (connectingFrom) return
    e.stopPropagation()
    const note = notes.find(n => n.id === id)!
    const { bx, by } = boardCoords(e)
    dragging.current = { type: 'move', id, ox: bx - note.x, oy: by - note.y }
  }

  function onResizeDown(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    const note = notes.find(n => n.id === id)!
    const { bx, by } = boardCoords(e)
    dragging.current = { type: 'resize', id, sx: bx, sy: by, sw: note.w, sh: note.h }
  }

  function onNoteClick(id: string) {
    if (!connectingFrom) return
    if (id === connectingFrom) { setConnectingFrom(null); return }
    const exists = conns.some(c => (c.from === connectingFrom && c.to === id) || (c.from === id && c.to === connectingFrom))
    if (!exists) updateConns([...conns, { id: `conn-${Date.now()}`, from: connectingFrom, to: id }])
    setConnectingFrom(null)
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') { setConnectingFrom(null); setEditingConn(null) } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function noteCenter(n: BoardNote) { return { x: n.x + n.w / 2, y: n.y + n.h / 2 } }
  function bezierMid(ca: {x:number;y:number}, cb: {x:number;y:number}) {
    const cx = (ca.x + cb.x) / 2, cy = (ca.y + cb.y) / 2 + 28
    return { lx: 0.25*ca.x + 0.5*cx + 0.25*cb.x, ly: 0.25*ca.y + 0.5*cy + 0.25*cb.y, cx, cy }
  }

  return (
    <div className="select-none">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-[#8a6642]">
        <span className="text-xs text-parchment-200 font-semibold opacity-60 italic">{boardName}</span>
        {connectingFrom && <span className="text-xs text-red-200 font-medium animate-pulse ml-2">Click a note to connect — Esc to cancel</span>}
        <div className="flex-1" />
        {/* Zoom controls */}
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setScale(Math.max(MIN_SCALE, scale - 0.15))}
            className="w-6 h-6 flex items-center justify-center bg-black/25 hover:bg-black/45 text-parchment-200 rounded text-sm font-bold transition-colors">−</button>
          <span className="text-xs text-parchment-300 w-10 text-center">{Math.round(scale * 100)}%</span>
          <button type="button" onClick={() => setScale(Math.min(MAX_SCALE, scale + 0.15))}
            className="w-6 h-6 flex items-center justify-center bg-black/25 hover:bg-black/45 text-parchment-200 rounded text-sm font-bold transition-colors">+</button>
          <button type="button" onClick={() => setScale(1)}
            className="text-[10px] text-parchment-400 hover:text-parchment-200 px-1.5 transition-colors">Reset</button>
        </div>
        <button type="button" onClick={addNote}
          className="text-xs bg-black/30 text-parchment-100 hover:bg-black/50 rounded px-3 py-1 font-semibold transition-colors border border-white/10 ml-1">
          + Add Note
        </button>
      </div>

      {/* Scrollable viewport */}
      <div
        ref={outerRef}
        className="overflow-auto"
        style={{ height: VIEWPORT_H, cursor: connectingFrom ? 'crosshair' : isPanning ? 'grabbing' : 'grab' }}
        onMouseDown={onBoardMouseDown}
        onMouseMove={onBoardMouseMove}
        onMouseUp={onBoardMouseUp}
        onMouseLeave={onBoardMouseUp}
        onClick={() => { if (connectingFrom) setConnectingFrom(null) }}
      >
        {/* Scroll spacer that matches scaled canvas size */}
        <div style={{ width: BOARD_W * scale, height: BOARD_H * scale, position: 'relative', flexShrink: 0 }}>
          {/* Scaled canvas */}
          <div style={{
            width: BOARD_W, height: BOARD_H,
            transform: `scale(${scale})`, transformOrigin: '0 0',
            position: 'absolute', top: 0, left: 0,
            background: '#9b7451',
            backgroundImage: `
              linear-gradient(rgba(0,0,0,0.06) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0,0,0,0.06) 1px, transparent 1px),
              radial-gradient(ellipse at 15% 20%, rgba(180,140,90,0.25) 0%, transparent 55%),
              radial-gradient(ellipse at 75% 65%, rgba(130,90,50,0.25) 0%, transparent 55%)
            `,
            backgroundSize: '40px 40px, 40px 40px, 100% 100%, 100% 100%',
          }}>
            {notes.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <p className="text-parchment-200/40 text-base">Click "+ Add Note" to start your investigation board</p>
              </div>
            )}

            {/* SVG — strings + labels */}
            <svg className="absolute inset-0 pointer-events-none" width={BOARD_W} height={BOARD_H} style={{ zIndex: 1 }}>
          <defs>
            <filter id="string-blur"><feDropShadow dx="0" dy="1.5" stdDeviation="1.5" floodColor="#000" floodOpacity="0.35" /></filter>
          </defs>
          {conns.map(c => {
            const a = notes.find(n => n.id === c.from), b = notes.find(n => n.id === c.to)
            if (!a || !b) return null
            const ca = noteCenter(a), cb = noteCenter(b)
            const { lx, ly, cx, cy } = bezierMid(ca, cb)
            const d = `M ${ca.x} ${ca.y} Q ${cx} ${cy} ${cb.x} ${cb.y}`
            const hasLabel = c.label && c.label.trim()
            const isEditing = editingConn?.id === c.id
            return (
              <g key={c.id}>
                {/* Invisible thick hit target */}
                <path d={d} stroke="transparent" strokeWidth="14" fill="none"
                  style={{ pointerEvents: 'all', cursor: 'pointer' }}
                  onDoubleClick={e => { e.stopPropagation(); setEditingConn({ id: c.id, val: c.label ?? '' }) }}
                  onClick={e => e.stopPropagation()}
                />
                {/* Visible string */}
                <path d={d} stroke="#7f1d1d" strokeWidth="1.5" fill="none" strokeLinecap="round"
                  filter="url(#string-blur)" opacity="0.9"
                  style={{ pointerEvents: 'none' }}
                />
                {/* Label background + text */}
                {hasLabel && !isEditing && (
                  <>
                    <rect x={lx - 42} y={ly - 9} width={84} height={18} rx="3"
                      fill="rgba(255,255,255,0.88)" stroke="#7f1d1d" strokeWidth="0.5"
                      style={{ pointerEvents: 'all', cursor: 'pointer' }}
                      onDoubleClick={e => { e.stopPropagation(); setEditingConn({ id: c.id, val: c.label ?? '' }) }}
                    />
                    <text x={lx} y={ly + 4} textAnchor="middle" fontSize="10" fill="#7f1d1d"
                      fontFamily="Georgia, serif" fontStyle="italic"
                      style={{ pointerEvents: 'none' }}
                    >{(c.label!).length > 14 ? c.label!.slice(0, 14) + '…' : c.label}</text>
                  </>
                )}
                {/* "add label" hint when no label */}
                {!hasLabel && !isEditing && (
                  <text x={lx} y={ly + 4} textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.4)"
                    fontFamily="serif" style={{ pointerEvents: 'all', cursor: 'pointer' }}
                    onDoubleClick={e => { e.stopPropagation(); setEditingConn({ id: c.id, val: '' }) }}
                  >dbl-click to label</text>
                )}
              </g>
            )
          })}
          {/* Preview line while connecting */}
          {connectingFrom && mousePos && (() => {
            const src = notes.find(n => n.id === connectingFrom)
            if (!src) return null
            const c = noteCenter(src)
            return <line x1={c.x} y1={c.y} x2={mousePos.x} y2={mousePos.y}
              stroke="#ef4444" strokeWidth="1.5" strokeDasharray="7 4" opacity="0.8" strokeLinecap="round" />
          })()}
        </svg>

        {/* Label editing input overlay */}
        {editingConn && (() => {
          const c = conns.find(x => x.id === editingConn.id)
          if (!c) return null
          const a = notes.find(n => n.id === c.from), b = notes.find(n => n.id === c.to)
          if (!a || !b) return null
          const ca = noteCenter(a), cb = noteCenter(b)
          const { lx, ly } = bezierMid(ca, cb)
          return (
            <input
              autoFocus
              style={{ position: 'absolute', left: lx - 60, top: ly - 11, zIndex: 20, width: 120 }}
              className="text-xs bg-parchment-50 border border-red-400 rounded px-1.5 py-0.5 text-red-900 text-center outline-none shadow-md font-serif italic"
              value={editingConn.val}
              placeholder="Label…"
              onChange={e => setEditingConn({ ...editingConn, val: e.target.value })}
              onBlur={() => {
                updateConns(conns.map(x => x.id === editingConn.id ? { ...x, label: editingConn.val } : x))
                setEditingConn(null)
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') { updateConns(conns.map(x => x.id === editingConn.id ? { ...x, label: editingConn.val } : x)); setEditingConn(null) }
                if (e.key === 'Escape') setEditingConn(null)
              }}
              onClick={e => e.stopPropagation()}
              onMouseDown={e => e.stopPropagation()}
            />
          )
        })()}

        {/* Notes */}
        {notes.map(note => {
          const pal = NOTE_BG[note.color] ?? NOTE_BG.yellow
          const isConnSrc = connectingFrom === note.id
          const rot = noteRotation(note.id)
          return (
            <div key={note.id} className="absolute group"
              style={{ left: note.x, top: note.y, width: note.w, height: note.h, zIndex: 2,
                transform: `rotate(${rot}deg)`, transformOrigin: 'top center' }}
              onClick={e => { e.stopPropagation(); onNoteClick(note.id) }}
            >
              {/* Pushpin */}
              <div style={{
                position: 'absolute', top: -9, left: '50%', transform: 'translateX(-50%)',
                width: 14, height: 14, borderRadius: '50%', zIndex: 3,
                background: `radial-gradient(circle at 38% 38%, ${pal.pin}cc, ${pal.pin})`,
                boxShadow: '0 2px 5px rgba(0,0,0,0.5), inset 0 -1px 2px rgba(0,0,0,0.2)',
              }} />

              {/* Card */}
              <div className="w-full h-full flex flex-col overflow-hidden"
                style={{
                  background: pal.card,
                  boxShadow: isConnSrc
                    ? `0 0 0 2px #ef4444, 3px 6px 14px rgba(0,0,0,0.45)`
                    : '3px 6px 14px rgba(0,0,0,0.4), 1px 2px 4px rgba(0,0,0,0.2)',
                  borderRadius: 2,
                }}
                onMouseDown={e => onNoteMoveDown(e, note.id)}
              >
                {/* Title row (drag zone) */}
                <div className="px-2.5 pt-3 pb-1 cursor-grab active:cursor-grabbing shrink-0">
                  <input
                    className="w-full bg-transparent text-xs font-bold outline-none placeholder-current/40 leading-tight"
                    style={{ color: pal.text }}
                    value={note.title}
                    placeholder="Title…"
                    onMouseDown={e => e.stopPropagation()}
                    onChange={e => patchNote(note.id, { title: e.target.value })}
                    onBlur={() => onChange(notes, conns)}
                  />
                </div>
                <div style={{ borderBottom: `1px solid ${pal.pin}33` }} className="mx-2.5" />

                {/* Content */}
                <textarea
                  className="flex-1 bg-transparent text-xs outline-none resize-none px-2.5 py-1.5 leading-relaxed placeholder-current/30"
                  style={{ color: pal.sub }}
                  placeholder="Write your note…"
                  value={note.content}
                  onMouseDown={e => e.stopPropagation()}
                  onChange={e => patchNote(note.id, { content: e.target.value })}
                  onBlur={() => onChange(notes, conns)}
                />

                {/* Hover toolbar */}
                <div className="shrink-0 px-2 py-1.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ borderTop: `1px solid ${pal.pin}22` }}
                  onMouseDown={e => e.stopPropagation()}
                >
                  {/* Color swatches */}
                  {Object.keys(NOTE_BG).map(c => (
                    <button key={c} type="button"
                      onClick={e => { e.stopPropagation(); patchNote(note.id, { color: c }); setTimeout(() => onChange(notes, conns), 0) }}
                      style={{ background: NOTE_BG[c].card, borderColor: NOTE_BG[c].pin, outline: note.color === c ? `2px solid ${NOTE_BG[c].pin}` : 'none' }}
                      className="w-3 h-3 rounded-full border shrink-0"
                    />
                  ))}
                  <div className="flex-1" />
                  <button type="button"
                    onClick={e => { e.stopPropagation(); setConnectingFrom(prev => prev === note.id ? null : note.id) }}
                    style={{ color: isConnSrc ? '#ef4444' : pal.sub }}
                    className="text-[10px] font-semibold px-1.5 py-0.5 rounded hover:bg-black/10 transition-colors"
                  >{isConnSrc ? 'Cancel' : '⬡ Link'}</button>
                  <button type="button"
                    onClick={e => { e.stopPropagation(); deleteNote(note.id) }}
                    className="text-[10px] px-1.5 py-0.5 rounded hover:bg-black/10 transition-colors"
                    style={{ color: pal.sub }}
                  >✕</button>
                </div>
              </div>

              {/* Resize handle */}
              <div
                style={{ position: 'absolute', bottom: -1, right: -1, width: 14, height: 14,
                  cursor: 'nwse-resize', zIndex: 4,
                  background: `linear-gradient(135deg, transparent 50%, ${pal.pin}66 50%)`,
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
                onMouseDown={e => onResizeDown(e, note.id)}
              />
            </div>
          )
            })}
          </div>{/* end scaled canvas */}
        </div>{/* end scroll spacer */}
      </div>{/* end viewport */}
    </div>
  )
}

export default function Sheet() {
  const { id } = useParams<{ id: string }>()
  const content = useContent()
  const [char, setChar] = useState<Character | null>(null)
  const [loadError, setLoadError] = useState('')
  const [tab, setTab] = useState<Tab>('stats')
  const [spellFilter, setSpellFilter] = useState('')
  const [itemFilter, setItemFilter] = useState('')
  const [addItemSlug, setAddItemSlug] = useState('')
  const [addSpellSlug, setAddSpellSlug] = useState('')
  const [addWeaponSlug, setAddWeaponSlug] = useState('')
  const [addArmorSlug, setAddArmorSlug] = useState('')
  const [addPanel, setAddPanel] = useState<string | null>(null)
  const [addPanelSearch, setAddPanelSearch] = useState('')
  const [ritualSearch, setRitualSearch] = useState('')
  const [spellBrowserSearch, setSpellBrowserSearch] = useState('')
  const [spellBrowserLevel, setSpellBrowserLevel] = useState<number | null>(null)
  const [browserSelectedSpell, setBrowserSelectedSpell] = useState<string | null>(null)
  const [showSpellLibrary, setShowSpellLibrary] = useState(false)
  const [preparedTab, setPreparedTab] = useState<number>(0)
  // Brief highlight of the slot level a spell was just cast at (slug + slot level).
  const [castHighlight, setCastHighlight] = useState<{ slug: string; level: number } | null>(null)
  const [expandedInnate, setExpandedInnate] = useState<string | null>(null)
  const [expandedInventoryItem, setExpandedInventoryItem] = useState<number | null>(null)
  const [saveFlash, setSaveFlash] = useState<'idle' | 'saved'>('idle')
  const [journeyOpen, setJourneyOpen] = useState(true)
  const [damageInput, setDamageInput] = useState('')
  const [txAmount, setTxAmount] = useState('')
  const [txCoin, setTxCoin] = useState<'cp' | 'sp' | 'ep' | 'gp' | 'pp'>('gp')
  const [expandedCondition, setExpandedCondition] = useState<string | null>(null)
  const [healInput, setHealInput] = useState('')
  const [shortRestOpen, setShortRestOpen] = useState(false)
  const [shortRestDice, setShortRestDice] = useState<Record<string, number>>({})
  const [shortRestRolls, setShortRestRolls] = useState<Record<string, string>>({})
  const [longRestOpen, setLongRestOpen] = useState(false)
  const [activeSummonId, setActiveSummonId] = useState<string | null>(null)
  const [newSummonForm, setNewSummonForm] = useState<{ name: string; hp: string; ac: string } | null>(null)
  const [addFeatOpen, setAddFeatOpen] = useState(false)
  const [addFeatSearch, setAddFeatSearch] = useState('')
  const [newResourceName, setNewResourceName] = useState('')
  const [newResourceMax, setNewResourceMax] = useState('')
  const [newResourceRecharge, setNewResourceRecharge] = useState<'short' | 'long'>('long')
  const saveFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const charRef = useRef<Character | null>(null)

  useEffect(() => {
    if (!id) return
    listCharactersFromDisk()
      .then(({ characters: chars }) => {
        const found = chars.find(c => c.id === id)
        if (found) { setChar(found); charRef.current = found }
        else setLoadError('Character not found — it may have been deleted.')
      })
      .catch(() => setLoadError('Could not reach the character server. Make sure you started the app with "npm run dev" or the launch script.'))
  }, [id])

  const diskSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const save = useCallback((next: Character) => {
    let updated = touchUpdated(next)
    // Auto-reset death saves when healed from 0
    const prevHp = charRef.current?.hp.current ?? 0
    if (prevHp <= 0 && updated.hp.current > 0) {
      updated = { ...updated, deathSaves: { successes: 0, failures: 0 } }
    }
    // Auto-drop concentration when knocked to 0 HP (RAW)
    if (updated.hp.current === 0 && updated.concentratingOn) {
      updated = { ...updated, concentratingOn: undefined }
    }
    setChar(updated)
    charRef.current = updated
    if (diskSaveTimer.current) clearTimeout(diskSaveTimer.current)
    diskSaveTimer.current = setTimeout(() => {
      saveCharacterToDisk(updated).catch(err => console.warn('Auto-save failed:', err))
    }, 800)
  }, [])

  function saveToFile() {
    if (!charRef.current) return
    saveCharacterToDisk(charRef.current)
      .then(() => {
        setSaveFlash('saved')
        if (saveFlashTimer.current) clearTimeout(saveFlashTimer.current)
        saveFlashTimer.current = setTimeout(() => setSaveFlash('idle'), 2500)
      })
      .catch(err => console.warn('Manual save failed:', err))
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        saveToFile()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    charRef.current = char
  }, [char])

  function patch(updates: Partial<Character>) {
    if (!char) return
    save({ ...char, ...updates })
  }

  if (!char) {
    return (
      <div className="text-center py-20 text-parchment-500 max-w-md mx-auto">
        {loadError ? (
          <>
            <p className="text-red-600 font-semibold mb-2">Something went wrong</p>
            <p className="text-sm mb-6">{loadError}</p>
          </>
        ) : (
          <p className="mb-6">Loading character...</p>
        )}
        <Link to="/" className="btn-primary">← Back to Vault</Link>
      </div>
    )
  }

  const level = totalLevel(char)
  const pb = profBonus(char)

  // Collect all feat slugs and derive passive bonuses
  const featSlugs = char.featuresChosen
    .filter(fc => fc.key === 'feat-l1' || fc.key.startsWith('feat-'))
    .map(fc => typeof fc.value === 'string' ? fc.value : fc.value[0])
  const featBonuses = sumFeatBonuses(featSlugs, content.feats)
  const itemBonuses = sumItemBonuses(char.equipment, content.items)

  // Apply ability score overrides/bonuses from equipped items
  const effectiveScores = effectiveAbilityScores(char.abilityScores as Record<string, number>, itemBonuses)
  const effectiveChar = effectiveScores === (char.abilityScores as Record<string, number>)
    ? char
    : { ...char, abilityScores: effectiveScores as typeof char.abilityScores }

  const raceDef = content.races.find(r => r.slug === char.raceSlug)

  // effectiveCharSkills: merge ALL auto-granted skill profs/expertise so mods are always correct
  const _toSlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const _bgProfs = content.backgrounds.find(b => b.slug === char.backgroundSlug)?.skillProficiencies.map(_toSlug) ?? []
  const _raceProfs = raceDef?.grantedSkills?.map(_toSlug) ?? []
  const _featProfs = featSlugs.flatMap(slug => content.feats.find(f => f.slug === slug)?.grantedSkillProficiencies?.map(_toSlug) ?? [])
  const _featExpert = featSlugs.flatMap(slug => content.feats.find(f => f.slug === slug)?.grantedSkillExpertise?.map(_toSlug) ?? [])
  const effectiveCharSkills = {
    ...effectiveChar,
    skillProficiencies: [...new Set([...char.skillProficiencies, ..._bgProfs, ..._raceProfs, ..._featProfs, ...itemBonuses.skillProficiencies])],
    skillExpertise: [...new Set([...char.skillExpertise, ..._featExpert, ...itemBonuses.skillExpertise])],
  }

  // Collect all free spells from feats + race/subrace
  // Single source of truth for granted/innate spells (feats, race, subclass) — rendered once.
  const freeSpells: Array<{ key: string; slug: string; name: string; level: number; source: string; usesPerLongRest?: number; alwaysPrepared?: boolean }> = []
  for (const slug of featSlugs) {
    const e = content.feats.find(f => f.slug === slug)
    if (!e) continue
    const featName = e.name
    for (const s of [...(e.grantedCantrips ?? []), ...(e.grantedSpells ?? [])]) {
      freeSpells.push({ key: `feat:${slug}:${s.slug}`, slug: s.slug, name: s.name, level: s.level, source: featName, usesPerLongRest: s.usesPerLongRest })
    }
  }
  const subraceOpts = raceDef?.subraces?.find(s => s.slug === char.subraceSlug)
  for (const s of [...(raceDef?.grantedSpells ?? []), ...(subraceOpts?.grantedSpells ?? [])]) {
    freeSpells.push({ key: `race:${char.raceSlug}:${char.subraceSlug ?? ''}:${s.slug}`, slug: s.slug, name: s.name, level: s.level, source: raceDef?.name ?? char.raceSlug, usesPerLongRest: s.usesPerLongRest })
  }
  // Subclass-granted "always prepared" spells (domain/oath/circle/patron), gated by class level.
  for (const cc of char.classes) {
    if (!cc.subclassSlug) continue
    const sub = CLASS_OPTIONS[cc.classSlug]?.subclasses.find(s => s.slug === cc.subclassSlug)
    if (!sub?.grantedSpells) continue
    for (const s of sub.grantedSpells) {
      if (s.grantedAtLevel > cc.level) continue
      freeSpells.push({ key: `subclass:${cc.classSlug}:${cc.subclassSlug}:${s.slug}`, slug: s.slug, name: s.name, level: s.level, source: sub.name, alwaysPrepared: true })
    }
  }

  // Circle of the Land terrain-based always-prepared spells
  const landDruid = char.classes.find(c => c.classSlug === 'druid' && c.subclassSlug === 'land')
  if (landDruid) {
    const terrainFC = char.featuresChosen.find(f => f.key === 'land-terrain')
    const terrain = typeof terrainFC?.value === 'string' ? terrainFC.value.toLowerCase() : ''
    for (const s of LAND_CIRCLE_SPELLS[terrain] ?? []) {
      if (s.grantedAtLevel > landDruid.level) continue
      freeSpells.push({ key: `subclass:druid:land:${s.slug}`, slug: s.slug, name: s.name, level: s.level, source: 'Circle of the Land', alwaysPrepared: true })
    }
  }

  const maxHp = hpMax(effectiveChar, content) + featBonuses.hpBonusPerLevel * level
  const { ac, source: acSource, stealthDisadv } = computeFullAC(effectiveChar, featBonuses.naturalArmorBase, content.items, raceDef, itemBonuses.acBonus)
  const initiative = abilityModFor(effectiveChar, 'dex') + featBonuses.initiativeBonus
  const passive = passivePerception(effectiveChar) + featBonuses.passivePerceptionBonus + itemBonuses.abilityCheckBonus
  const passiveInvestigation = 10 + skillMod(effectiveCharSkills, 'investigation') + featBonuses.passiveInvestigationBonus + itemBonuses.abilityCheckBonus
  const passiveInsight = 10 + skillMod(effectiveCharSkills, 'insight') + itemBonuses.abilityCheckBonus
  const raceSpeed = raceDef?.speed ?? 30
  const monkMovement = monkSpeedBonus(char)
  const speed = raceSpeed + featBonuses.speedBonus + monkMovement
  const sneakDice = sneakAttackDice(char)
  const paladinAura = paladinAuraBonus(char)

  const attuned = char.equipment.filter(e => e.attuned).length
  const skillInfo = deriveSkillSources(char, content, raceDef, CLASS_OPTIONS, featSlugs)
  const classResources = deriveClassResources(char)
  const isMulticlassCaster = isMulticlassSpellcaster(char.classes)
  const multiclassMaxes = isMulticlassCaster ? multiclassSpellSlotsMax(char.classes) : null
  const jackOfAllTrades = hasBardJackOfAllTrades(char)
  const resistances = deriveResistances(raceDef, featBonuses, itemBonuses)
  const spellClass = char.classes.find(c => content.classes.find(cl => cl.slug === c.classSlug)?.spellcastingAbility)
  const spellClassSlug = spellClass?.classSlug

  const TABS: { key: Tab; label: string }[] = [
    { key: 'stats', label: 'Stats' },
    { key: 'spells', label: 'Spells' },
    { key: 'inventory', label: 'Inventory' },
    { key: 'features', label: 'Features' },
    { key: 'summons', label: 'Summons' },
    { key: 'notes', label: 'Notes' },
  ]

  // HP card derived values
  const hpPct = maxHp > 0 ? Math.min(100, Math.round(char.hp.current / maxHp * 100)) : 0
  const hpBarColor = hpPct > 50 ? 'bg-green-500' : hpPct > 25 ? 'bg-amber-400' : 'bg-red-500'
  const hpTextColor = hpPct > 50 ? 'text-green-700' : hpPct > 25 ? 'text-amber-600' : 'text-red-600'
  const quickN = parseInt(damageInput, 10)
  const quickValid = !isNaN(quickN) && quickN > 0
  const quickAfterDamage = quickValid ? Math.max(0, char.hp.current - Math.max(0, quickN - char.hp.temp)) : null
  const quickAfterHeal   = quickValid ? Math.min(maxHp, char.hp.current + quickN) : null

  function applyDamage(amount: number) {
    if (!char) return
    const temp = char.hp.temp
    const overflow = temp > 0 ? Math.max(0, amount - temp) : amount
    const newTemp = temp > 0 ? Math.max(0, temp - amount) : temp
    const newCurrent = Math.max(0, char.hp.current - overflow)
    const update: Partial<Character> = { hp: { ...char.hp, temp: newTemp, current: newCurrent } }

    // Concentration check on damage (RAW: CON save DC = max(10, damage/2); auto-fail at 0 HP)
    if (char.concentratingOn && amount > 0) {
      const spellName = content.spells.find(s => s.slug === char.concentratingOn)?.name ?? char.concentratingOn
      if (newCurrent === 0) {
        update.concentratingOn = undefined
        setTimeout(() => alert(`Dropped concentration on ${spellName} (knocked to 0 HP).`), 0)
      } else if (overflow > 0) {
        const dc = Math.max(10, Math.floor(overflow / 2))
        if (!confirm(`Concentration save vs ${spellName} — DC ${dc}. Click OK if you succeeded, Cancel to drop.`)) {
          update.concentratingOn = undefined
        }
      }
    }

    patch(update)
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <input
            className="text-3xl font-bold bg-transparent border-none outline-none focus:bg-parchment-50 rounded px-1"
            value={char.name}
            onChange={e => patch({ name: e.target.value })}
          />
          <p className="text-sm text-parchment-500 mt-1 px-1">
            Level {level} &bull;{' '}
            {char.classes.map(c => `${content.classes.find(cl => cl.slug === c.classSlug)?.name ?? c.classSlug} ${c.level}`).join(' / ')} &bull;{' '}
            {content.races.find(r => r.slug === char.raceSlug)?.name ?? char.raceSlug}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <button
            className="btn btn-secondary text-sm"
            onClick={() => { setShortRestDice({}); setShortRestOpen(true) }}
          >Short Rest</button>
          <button
            className="btn btn-secondary text-sm"
            onClick={() => setLongRestOpen(true)}
          >Long Rest</button>
          <button
            onClick={saveToFile}
            className={`btn text-sm font-semibold transition-all ${
              saveFlash === 'saved'
                ? 'bg-green-600 text-white hover:bg-green-700 focus:ring-green-500'
                : 'btn-primary'
            }`}
          >
            {saveFlash === 'saved' ? '✓ Saved!' : 'Save Character'}
          </button>
          <Link to={`/c/${char.id}/level-up`} className="btn-secondary text-sm">Level Up</Link>
          <button onClick={() => exportCharacter(char)} className="btn-ghost text-sm" title="Download character as JSON">↓ Export</button>
          <Link to="/" className="btn-ghost text-sm">← Vault</Link>
        </div>
      </div>

      {/* HP Card — display + quick controls combined */}
      <div className="card mb-4 px-4 py-3">
        {/* Top row: HP display + temp HP */}
        <div className="flex items-center gap-4 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-1.5 mb-2">
              <input
                type="number"
                className={`text-3xl font-bold w-16 bg-transparent border-none focus:outline-none focus:border-b-2 focus:border-parchment-400 rounded-none pb-0.5 ${hpTextColor}`}
                value={char.hp.current}
                onChange={e => patch({ hp: { ...char.hp, current: parseInt(e.target.value, 10) || 0 } })}
              />
              <span className="text-base text-parchment-300 select-none">/</span>
              <span className="text-base font-medium text-parchment-400">{maxHp}</span>
              {featBonuses.hpBonusPerLevel > 0 && (
                <span className="text-xs text-amber-500 ml-1">+{featBonuses.hpBonusPerLevel * level} Tough</span>
              )}
            </div>
            <div className="h-1.5 bg-parchment-200 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-300 ${hpBarColor}`} style={{ width: `${hpPct}%` }} />
            </div>
          </div>
          <div className="flex flex-col items-center shrink-0">
            <div className="text-xs text-parchment-400 mb-1">Temp</div>
            <div className="relative w-9 h-10">
              <svg viewBox="0 0 56 64" className="absolute inset-0 w-full h-full text-blue-200" fill="currentColor">
                <path d="M28 2 L54 14 L54 36 C54 50 28 62 28 62 C28 62 2 50 2 36 L2 14 Z" />
              </svg>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-sm font-bold text-blue-700 w-8 text-center bg-transparent border-none focus:outline-none"
                value={char.hp.temp}
                onChange={e => {
                  const v = parseInt(e.target.value, 10)
                  patch({ hp: { ...char.hp, temp: isNaN(v) ? 0 : Math.max(0, v) } })
                }}
              />
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-parchment-100 mb-3" />

        {/* Quick controls */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="w-7 h-7 rounded border border-parchment-300 text-parchment-600 hover:border-parchment-500 hover:bg-parchment-50 font-bold text-base leading-none transition-colors"
              onClick={() => setDamageInput(v => String(Math.max(1, (parseInt(v, 10) || 0) - 1)))}
            >−</button>
            <input
              type="number"
              min={1}
              className="w-16 text-center text-xl font-bold border border-parchment-200 rounded py-0.5 bg-parchment-50 focus:border-parchment-400 focus:outline-none"
              placeholder="0"
              value={damageInput}
              onChange={e => setDamageInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && quickValid) { applyDamage(quickN); setDamageInput('') } }}
            />
            <button
              type="button"
              className="w-7 h-7 rounded border border-parchment-300 text-parchment-600 hover:border-parchment-500 hover:bg-parchment-50 font-bold text-base leading-none transition-colors"
              onClick={() => setDamageInput(v => String((parseInt(v, 10) || 0) + 1))}
            >+</button>
          </div>
          <div className="flex gap-1.5 flex-1">
            <button
              type="button"
              disabled={!quickValid}
              className="flex-1 py-1.5 px-2 rounded text-sm font-medium transition-colors bg-red-100 text-red-700 border border-red-200 hover:bg-red-200 disabled:opacity-40 disabled:cursor-not-allowed"
              onClick={() => { applyDamage(quickN); setDamageInput('') }}
            >
              <div>⚔ Damage</div>
              {quickAfterDamage !== null && <div className="text-xs opacity-70">→ {quickAfterDamage}</div>}
            </button>
            <button
              type="button"
              disabled={!quickValid}
              className="flex-1 py-1.5 px-2 rounded text-sm font-medium transition-colors bg-green-100 text-green-700 border border-green-200 hover:bg-green-200 disabled:opacity-40 disabled:cursor-not-allowed"
              onClick={() => { patch({ hp: { ...char.hp, current: Math.min(maxHp, char.hp.current + quickN) } }); setDamageInput('') }}
            >
              <div>♥ Heal</div>
              {quickAfterHeal !== null && <div className="text-xs opacity-70">→ {quickAfterHeal}</div>}
            </button>
            <button
              type="button"
              disabled={!quickValid}
              className="flex-1 py-1.5 px-2 rounded text-sm font-medium transition-colors bg-blue-100 text-blue-700 border border-blue-200 hover:bg-blue-200 disabled:opacity-40 disabled:cursor-not-allowed"
              onClick={() => { patch({ hp: { ...char.hp, temp: char.hp.temp + quickN } }); setDamageInput('') }}
            >
              <div>🛡 +Temp</div>
              {quickValid && <div className="text-xs opacity-70">→ {char.hp.temp + quickN}</div>}
            </button>
          </div>
        </div>
      </div>

      {/* Quick stats bar */}
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-2 mb-4">
        {[
          { label: 'AC', value: ac, note: acSource + (stealthDisadv ? ' ⚠ Stealth disadv.' : '') },
          { label: 'Initiative', value: formatMod(initiative), note: featBonuses.initiativeBonus ? `+${featBonuses.initiativeBonus} Alert` : undefined },
          { label: 'Speed', value: `${speed}ft`, note: monkMovement ? `+${monkMovement}ft Unarmored Movement` : featBonuses.speedBonus ? `+${featBonuses.speedBonus}ft feat` : undefined },
          { label: 'Prof. Bonus', value: formatMod(pb) },
          { label: 'Passive Perc.', value: passive, note: featBonuses.passivePerceptionBonus ? `+${featBonuses.passivePerceptionBonus} Observant` : undefined },
          { label: 'Passive Inv.', value: passiveInvestigation, note: featBonuses.passiveInvestigationBonus ? `+${featBonuses.passiveInvestigationBonus} Observant` : undefined },
          { label: 'Passive Ins.', value: passiveInsight },
        ].map(s => (
          <div key={s.label} className="stat-box text-center">
            <div className="text-xs text-parchment-500 uppercase">{s.label}</div>
            <div className="text-xl font-bold">{s.value}</div>
            {s.note && <div className="text-xs text-amber-600 mt-0.5">{s.note}</div>}
          </div>
        ))}
      </div>

      {/* Class Resources */}
      {classResources.length > 0 && (
        <div className="card mb-4">
          <div className="mb-3">
            <h3 className="section-header mb-0">Class Resources</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {classResources.map(r => {
              const isPool = (r.max ?? 0) > 6  // large pools get a number input
              const current = r.current
              const max = r.max
              return (
                <div key={r.key} className="p-2 rounded border border-parchment-100 bg-parchment-50">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-parchment-700">{r.name}</span>
                    <span className={`text-xs rounded px-1 ${r.recharge === 'short' ? 'bg-blue-100 text-blue-600' : 'bg-amber-100 text-amber-600'}`}>
                      {r.recharge === 'short' ? 'SR' : 'LR'}
                    </span>
                  </div>
                  {r.display && <div className="text-xs text-parchment-400 mb-1">{r.display}</div>}

                  {isPool ? (
                    // Filled gauge + controls for large pools (Ki, Sorcery Points, Lay on Hands)
                    (() => {
                      const cap = max ?? 9999
                      const pct = cap > 0 ? Math.min(100, Math.round((current / cap) * 100)) : 0
                      const setVal = (v: number) =>
                        patch({ classResources: { ...char.classResources, [r.key]: Math.max(0, Math.min(cap, v)) } })
                      return (
                        <div>
                          <div
                            className="relative h-4 rounded-full bg-parchment-200 border border-parchment-300 overflow-hidden cursor-pointer"
                            title="Click to set remaining"
                            onClick={e => {
                              const rect = e.currentTarget.getBoundingClientRect()
                              setVal(Math.round(((e.clientX - rect.left) / rect.width) * cap))
                            }}
                          >
                            <div
                              className="absolute inset-y-0 left-0 bg-gradient-to-r from-parchment-500 to-parchment-700 transition-all duration-200"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <div className="flex items-center gap-1 mt-1">
                            <button className="btn-ghost px-1 text-sm" onClick={() => setVal(current - 1)}>−</button>
                            <input
                              type="number" min={0} max={max ?? 9999}
                              className="w-12 text-center text-sm font-bold bg-transparent border border-parchment-300 rounded py-0.5"
                              value={current}
                              onChange={e => setVal(parseInt(e.target.value, 10) || 0)}
                            />
                            <span className="text-xs text-parchment-400">/ {max ?? '∞'}</span>
                            <button className="btn-ghost px-1 text-sm" onClick={() => setVal(current + 1)}>+</button>
                          </div>
                        </div>
                      )
                    })()
                  ) : max === null ? (
                    // Unlimited (Barbarian L20 rage)
                    <div className="text-sm font-bold text-green-600">Unlimited</div>
                  ) : (
                    // Pip display for small counts (1–6)
                    <div className="flex gap-1 flex-wrap">
                      {Array.from({ length: max }).map((_, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            // Click pip to toggle — clicking a used pip restores it, clicking available uses it
                            const newVal = i < current ? i : i + 1
                            patch({ classResources: { ...char.classResources, [r.key]: Math.min(max, newVal) } })
                          }}
                          className={`w-5 h-5 rounded-full border-2 transition-colors ${
                            i < current
                              ? 'bg-parchment-600 border-parchment-600'
                              : 'border-parchment-300 hover:border-parchment-500'
                          }`}
                          title={i < current ? 'Click to use' : 'Click to restore'}
                        />
                      ))}
                      <span className="text-xs text-parchment-400 ml-1 self-center">{current}/{max}</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {char.hp.current <= 0 ? (
        /* ── Death screen ── */
        (() => {
          const isStabilized = char.deathSaves.successes >= 3
          const isDead       = char.deathSaves.failures  >= 3
          const failures     = char.deathSaves.failures
          const durations    = ['0.85s', '1.3s', '2.2s']
          const applyHeal = () => {
            const n = parseInt(healInput, 10)
            if (!n || n <= 0) return
            patch({ hp: { ...char.hp, current: Math.min(maxHp, char.hp.current + n) } })
            setHealInput('')
          }
          return (
            <div
              className="death-screen rounded-xl border overflow-hidden relative text-white"
              style={{
                backgroundColor: '#0a0a0a',
                borderColor: isStabilized ? 'rgba(21,128,61,0.5)' : isDead ? 'rgba(40,0,0,0.9)' : 'rgba(153,27,27,0.7)',
                boxShadow: isStabilized
                  ? 'inset 0 0 130px rgba(21,128,61,0.35), inset 0 0 50px rgba(21,128,61,0.2)'
                  : isDead
                    ? 'inset 0 0 160px rgba(0,0,0,0.95), inset 0 0 60px rgba(80,0,0,0.4)'
                    : 'inset 0 0 120px rgba(153,27,27,0.45), inset 0 0 40px rgba(153,27,27,0.25)',
              }}
            >
              {/* Header */}
              <div
                className="text-center pt-12 pb-8 px-4 border-b"
                style={{ borderColor: isStabilized ? 'rgba(21,128,61,0.25)' : 'rgba(153,27,27,0.3)' }}
              >
                <h2 className="text-3xl font-bold text-parchment-100 mb-3">{char.name}</h2>
                <p className={`text-xs uppercase tracking-[0.35em] mb-6 ${isStabilized ? 'text-green-600' : isDead ? 'text-red-900' : 'text-red-600'}`}>
                  {isStabilized ? 'has stabilized' : isDead ? 'has perished' : 'has fallen'}
                </p>

                {/* Orb */}
                <div className="flex flex-col items-center gap-2 mb-4">
                  <div
                    className="w-10 h-10 rounded-full mx-auto"
                    style={isDead ? {
                      background: 'radial-gradient(circle at 35% 35%, #3f0d0d, #1a0000)',
                      animation: 'flatline 3s ease-in-out infinite',
                      opacity: 0.25,
                    } : isStabilized ? {
                      background: 'radial-gradient(circle at 35% 35%, #bbf7d0, #22c55e 40%, #166534)',
                      boxShadow: '0 0 12px rgba(34,197,94,0.6), 0 0 30px rgba(34,197,94,0.3)',
                      animation: 'stabilize-orb 2s ease-in-out infinite',
                    } : {
                      background: 'radial-gradient(circle at 35% 35%, #fca5a5, #ef4444 40%, #991b1b)',
                      boxShadow: '0 0 12px rgba(239,68,68,0.6), 0 0 30px rgba(239,68,68,0.3)',
                      animation: `heartbeat ${durations[failures]} ease-in-out infinite`,
                    }}
                  />
                  {!isDead && !isStabilized && (
                    <p className="text-red-900 text-xs uppercase tracking-widest">
                      {failures === 0 ? 'Holding on…' : failures === 1 ? 'Fading…' : 'Barely alive…'}
                    </p>
                  )}
                </div>

                {!isStabilized && !isDead && (
                  <p className="text-red-400/80 text-xs uppercase tracking-[0.25em]">Death Saving Throws</p>
                )}
              </div>

              {/* Outcome: Stabilized */}
              {isStabilized && (
                <div className="outcome-enter text-center py-16 px-4">
                  <p className="text-green-700 text-xs uppercase tracking-[0.4em] mb-5">Against all odds</p>
                  <h3 className="text-5xl font-bold text-green-300 mb-5 tracking-widest">STABILIZED</h3>
                  <p className="text-green-800 text-sm">Unconscious but holding on — awaiting healing</p>
                </div>
              )}

              {/* Outcome: Dead */}
              {isDead && (
                <div className="outcome-enter death-fade-pulse text-center py-16 px-4">
                  <p className="text-red-400/70 text-xs uppercase tracking-[0.4em] mb-5">The light fades</p>
                  <h3 className="text-5xl font-bold text-red-400 mb-5 tracking-widest">YOU HAVE DIED</h3>
                  <p className="text-red-500/60 text-sm">Your story ends here</p>
                </div>
              )}

              {/* Saves — shown while in progress */}
              {!isStabilized && !isDead && (
                <div className="py-12 px-4 flex flex-col items-center gap-10">
                  <div className="flex flex-col items-center gap-4">
                    <span className="text-xs font-semibold uppercase tracking-widest text-green-500/80">Successes</span>
                    <div className="flex gap-5">
                      {[0,1,2].map(i => (
                        <button
                          key={i}
                          onClick={() => {
                            const newSuccesses = char.deathSaves.successes === i + 1 ? i : i + 1
                            if (newSuccesses >= 3) {
                              // Auto-stabilize: 3 successes → set HP to 1, clear saves
                              patch({ hp: { ...char.hp, current: 1 }, deathSaves: { successes: 0, failures: 0 } })
                            } else {
                              patch({ deathSaves: { ...char.deathSaves, successes: newSuccesses } })
                            }
                          }}
                          className={`w-14 h-14 rounded-full border-2 transition-all duration-300 ${
                            char.deathSaves.successes > i
                              ? 'bg-green-500 border-green-400 shadow-[0_0_20px_rgba(74,222,128,0.7)]'
                              : 'border-green-900 bg-black/20 hover:border-green-600 hover:shadow-[0_0_8px_rgba(74,222,128,0.2)]'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="w-24 h-px bg-red-900/40" />

                  <div className="flex flex-col items-center gap-4">
                    <span className="text-xs font-semibold uppercase tracking-widest text-red-500/80">Failures</span>
                    <div className="flex gap-5">
                      {[0,1,2].map(i => (
                        <button
                          key={i}
                          onClick={() => patch({ deathSaves: { ...char.deathSaves, failures: char.deathSaves.failures === i + 1 ? i : i + 1 } })}
                          className={`w-14 h-14 rounded-full border-2 transition-all duration-300 ${
                            char.deathSaves.failures > i
                              ? 'bg-red-700 border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.6)]'
                              : 'border-red-900/60 bg-black/20 hover:border-red-700 hover:shadow-[0_0_8px_rgba(239,68,68,0.2)]'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Footer */}
              <div
                className="border-t px-4 py-6 flex flex-col items-center gap-3"
                style={{ borderColor: isStabilized ? 'rgba(21,128,61,0.2)' : 'rgba(153,27,27,0.2)' }}
              >
                {!isDead && (
                  <>
                    <p className={`text-xs uppercase tracking-widest ${isStabilized ? 'text-green-900' : 'text-red-900'}`}>Receive Healing</p>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min={1}
                        placeholder="HP"
                        className="w-20 text-center rounded border bg-black/30 text-white px-2 py-1.5 text-sm focus:outline-none"
                        style={{ borderColor: isStabilized ? 'rgba(21,128,61,0.5)' : 'rgba(153,27,27,0.5)', }}
                        value={healInput}
                        onChange={e => setHealInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') applyHeal() }}
                      />
                      <button
                        className="px-4 py-1.5 text-sm rounded font-semibold bg-green-800 text-green-100 hover:bg-green-700 transition-colors"
                        onClick={applyHeal}
                      >Heal</button>
                    </div>
                  </>
                )}
                {(char.deathSaves.successes > 0 || char.deathSaves.failures > 0) && (
                  <button
                    className="text-xs text-red-900/60 hover:text-red-700 transition-colors mt-1"
                    onClick={() => patch({ deathSaves: { successes: 0, failures: 0 } })}
                  >Reset saves</button>
                )}
              </div>
            </div>
          )
        })()
      ) : (
      <>
      {/* Tabs */}
      <div className="flex gap-5 border-b border-parchment-200 mb-6">
        {TABS.map(t => t.key === 'summons' ? (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`pb-2 text-sm font-medium flex items-center gap-1.5 border-b-2 -mb-px transition-colors ${tab === 'summons' ? 'border-amber-500 text-amber-700' : 'border-transparent text-amber-400 hover:text-amber-600'}`}>
            {t.label}
            {char.summons.length > 0 && (
              <span className="text-[10px] bg-amber-500 text-white rounded-full px-1.5 py-0.5 font-bold leading-none">
                {char.summons.length}
              </span>
            )}
          </button>
        ) : (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`pb-2 text-sm font-medium ${tab === t.key ? 'tab-active' : 'tab-inactive'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Stats Tab */}
      {tab === 'stats' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

            {/* Col 1: Ability Scores + Saving Throws */}
            <div className="space-y-4">
              <div className="card p-4">
                <h2 className="section-header">Ability Scores</h2>
                <div className="grid grid-cols-3 gap-2">
                  {ABILITIES.map(a => (
                    <div key={a} className="stat-box">
                      <div className="text-xs text-parchment-500 uppercase">{ABILITY_LABELS[a]}</div>
                      <input
                        type="number"
                        min={1}
                        max={30}
                        className="text-2xl font-bold w-12 text-center bg-transparent border-none outline-none focus:bg-parchment-50 rounded"
                        value={char.abilityScores[a]}
                        onChange={e => {
                          const scores = { ...char.abilityScores, [a]: parseInt(e.target.value, 10) || 10 }
                          patch({ abilityScores: scores as Character['abilityScores'] })
                        }}
                      />
                      <div className="text-sm font-semibold text-parchment-600">
                        {formatMod(abilityModFor(effectiveChar, a))}
                        {effectiveChar.abilityScores[a] !== char.abilityScores[a] && (
                          <span className="text-xs text-indigo-500 ml-0.5" title={`Set to ${effectiveChar.abilityScores[a]} by equipped item`}>★</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card p-4">
                <h2 className="section-header">Saving Throws</h2>
                <div className="space-y-1.5">
                  {ABILITIES.map(a => (
                    <div key={a} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={char.saveProficiencies.includes(a)}
                        onChange={e => {
                          const s = new Set(char.saveProficiencies)
                          e.target.checked ? s.add(a) : s.delete(a)
                          patch({ saveProficiencies: [...s] })
                        }}
                      />
                      <span className="w-10 font-mono text-right text-parchment-700">{formatMod(saveMod(effectiveChar, a) + itemBonuses.savingThrowBonus + paladinAura)}</span>
                      <span className="flex-1">{ABILITY_FULL[a]}</span>
                      {paladinAura > 0 && <span className="text-xs bg-yellow-100 text-yellow-700 rounded px-1.5 py-0.5">+{paladinAura} Aura</span>}
                      {a === 'con' && featBonuses.concentrationAdvantage && (
                        <span className="text-xs bg-amber-100 text-amber-700 rounded px-1.5 py-0.5">War Caster</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Col 2: Skills */}
            <div className="card p-4 self-start">
              <h2 className="section-header mb-2">Skills</h2>
              <div className="space-y-0.5">
                {SKILLS.map(skill => {
                  const profTags = skillInfo.profTags.get(skill) ?? []
                  const expertTags = skillInfo.expertTags.get(skill) ?? []
                  const isAutoProf = skillInfo.autoProfs.has(skill)
                  const isAutoExpert = skillInfo.autoExpert.has(skill)
                  const isManualProf = char.skillProficiencies.includes(skill)
                  const isManualExpert = char.skillExpertise.includes(skill)
                  const effectiveProf = isManualProf || isAutoProf
                  const effectiveExpert = isManualExpert || isAutoExpert
                  const hasTags = profTags.length > 0 || expertTags.length > 0

                  const tagColor = (kind: SkillSourceTag['kind']) => {
                    if (kind === 'bg')     return 'bg-blue-100 text-blue-700'
                    if (kind === 'race')   return 'bg-green-100 text-green-700'
                    if (kind === 'class')  return 'bg-purple-100 text-purple-700'
                    if (kind === 'feat')   return 'bg-amber-100 text-amber-700'
                    if (kind === 'item')   return 'bg-indigo-100 text-indigo-700'
                    return 'bg-parchment-100 text-parchment-500'
                  }

                  return (
                    <div key={skill} className="py-0.5">
                      <div className={`flex items-center gap-1.5 text-sm px-1 py-0.5 rounded hover:bg-parchment-50`}>
                        {/* Prof checkbox — manual only; auto profs show as locked */}
                        <input
                          type="checkbox"
                          checked={effectiveProf}
                          disabled={isAutoProf && !isManualProf}
                          title={isAutoProf && !isManualProf ? `Granted by: ${profTags.map(t => t.label).join(', ')}` : 'Proficient'}
                          onChange={e => {
                            const s = new Set(char.skillProficiencies)
                            e.target.checked ? s.add(skill) : s.delete(skill)
                            patch({ skillProficiencies: [...s] })
                          }}
                        />
                        {/* Expert checkbox */}
                        <input
                          type="checkbox"
                          checked={effectiveExpert}
                          disabled={isAutoExpert && !isManualExpert}
                          title={isAutoExpert && !isManualExpert ? `Expertise granted by: ${expertTags.map(t => t.label).join(', ')}` : 'Expertise (double proficiency)'}
                          onChange={e => {
                            const s = new Set(char.skillExpertise)
                            e.target.checked ? s.add(skill) : s.delete(skill)
                            patch({ skillExpertise: [...s] })
                          }}
                        />
                        <span className="w-8 font-mono text-right text-xs text-parchment-700 shrink-0">{formatMod(skillMod(effectiveCharSkills, skill) + itemBonuses.abilityCheckBonus)}</span>
                        <span className={`flex-1 min-w-0 ${effectiveExpert ? 'font-semibold' : ''}`}>{SKILL_LABELS[skill]}</span>
                        {/* Source tags */}
                        <div className="flex items-center gap-1 flex-wrap justify-end">
                          {profTags.map((tag, i) => (
                            <span key={i} className={`text-[10px] font-semibold rounded px-1.5 py-0.5 leading-none whitespace-nowrap ${tagColor(tag.kind)}`}
                              title={tag.kind === 'item' ? `Item: ${tag.label}` : tag.kind === 'feat' ? `Feat: ${tag.label}` : undefined}>
                              {tag.kind === 'item' ? tag.label.split(' ').slice(0, 2).join(' ') : tag.label}
                            </span>
                          ))}
                          {expertTags.map((tag, i) => (
                            <span key={`e${i}`} className={`text-[10px] font-semibold rounded px-1.5 py-0.5 leading-none whitespace-nowrap border border-current/30 ${tagColor(tag.kind)}`}
                              title={`Expertise — ${tag.kind === 'item' ? `Item: ${tag.label}` : tag.kind === 'feat' ? `Feat: ${tag.label}` : tag.label}`}>
                              {tag.kind === 'item' ? tag.label.split(' ').slice(0, 2).join(' ') : tag.label} ★
                            </span>
                          ))}
                          {/* If proficient but no tagged source, it's a plain class choice or manual */}
                          {isManualProf && profTags.filter(t => t.kind !== 'manual').length === 0 && !hasTags && (
                            <span className="text-[10px] text-parchment-300">manual</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
              <p className="text-xs text-parchment-400 mt-2">☐ prof · ☐ expertise{jackOfAllTrades ? ' · Bard: ½ PB on non-prof' : ''}</p>
              {char.classes.some(c => c.classSlug === 'rogue' && c.level >= 11) && (
                <p className="text-xs text-amber-600 mt-1">Reliable Talent: treat proficient roll ≤ 9 as 10.</p>
              )}
            </div>

            {/* Col 3: Status + Conditions */}
            <div className="space-y-4">
              <div className="card p-4">
                <h2 className="section-header">Status</h2>
                <label className="flex items-center gap-2 text-sm mb-4 cursor-pointer">
                  <input type="checkbox" checked={char.inspiration} onChange={e => patch({ inspiration: e.target.checked })} />
                  <span className={`font-medium ${char.inspiration ? 'text-amber-600' : ''}`}>Inspiration</span>
                  {char.inspiration && <span className="text-amber-500 text-xs ml-auto">✦ active</span>}
                </label>
                <div className="text-xs font-semibold text-parchment-600 uppercase tracking-wide mb-1.5">Exhaustion</div>
                <div className="flex gap-1 mb-1">
                  {[1,2,3,4,5,6].map(lvl => (
                    <button
                      key={lvl}
                      title={(['Disadv. on ability checks','Speed halved','Disadv. on attacks & saves','HP max halved','Speed = 0','Death'])[lvl-1]}
                      onClick={() => patch({ exhaustionLevel: char.exhaustionLevel === lvl ? lvl - 1 : lvl })}
                      className={`w-7 h-7 rounded text-xs font-bold border-2 transition-colors ${
                        char.exhaustionLevel >= lvl
                          ? lvl === 6 ? 'bg-red-700 border-red-700 text-white' : 'bg-red-500 border-red-500 text-white'
                          : 'border-parchment-300 text-parchment-400 hover:border-red-300'
                      }`}
                    >{lvl}</button>
                  ))}
                </div>
                {char.exhaustionLevel > 0 && (
                  <ul className="text-xs text-red-600 mt-1 space-y-0.5">
                    {(['Disadv. on ability checks','Speed halved','Disadv. on attacks & saves','HP max halved','Speed = 0','Dead'] as const)
                      .slice(0, char.exhaustionLevel)
                      .map((effect, i) => <li key={i}>· {effect}</li>)}
                  </ul>
                )}

              </div>

              <div className="card p-4">
                <h2 className="section-header">Conditions</h2>
                <div className="space-y-0.5">
                  {CONDITIONS.map(({ name, effect }) => {
                    const active = char.conditions.includes(name)
                    const expanded = expandedCondition === name
                    return (
                      <div key={name} className={`rounded ${active ? 'bg-red-50' : ''}`}>
                        <div className="flex items-center gap-2 p-1.5">
                          <input
                            type="checkbox"
                            className="shrink-0"
                            checked={active}
                            onChange={e => {
                              const s = new Set(char.conditions)
                              e.target.checked ? s.add(name) : s.delete(name)
                              patch({ conditions: [...s] })
                            }}
                          />
                          <button
                            className={`flex-1 text-left text-sm font-medium hover:underline ${active ? 'text-red-700' : 'text-parchment-800'}`}
                            onClick={() => setExpandedCondition(expanded ? null : name)}
                          >{name}</button>
                          <span className="text-parchment-300 text-xs">{expanded ? '▲' : '▼'}</span>
                        </div>
                        {expanded && (
                          <p className="text-xs text-parchment-500 leading-snug px-1.5 pb-1.5">{effect}</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Attacks — full width */}
          <div className="card">
            <h2 className="section-header">Attacks</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-parchment-500 border-b border-parchment-200">
                    <th className="pb-1 pr-4 font-medium">Name</th>
                    <th className="pb-1 pr-4 font-medium">Attack Bonus</th>
                    <th className="pb-1 pr-4 font-medium">Damage / Type</th>
                    <th className="pb-1 font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-parchment-100">
                  {(() => {
                    const isMon = char.classes.some(c => c.classSlug === 'monk')
                    const monkLevel = char.classes.find(c => c.classSlug === 'monk')?.level ?? 0
                    const hasTB = featSlugs.includes('tavern-brawler')
                    const unarmedDie = isMon
                      ? (monkLevel >= 17 ? '1d10' : monkLevel >= 11 ? '1d8' : monkLevel >= 5 ? '1d6' : '1d4')
                      : hasTB ? '1d4' : '1'
                    const strMod = abilityModFor(char, 'str')
                    const atkMod = isMon ? Math.max(strMod, abilityModFor(char, 'dex')) : strMod
                    return (
                      <tr>
                        <td className="py-1.5 pr-4 font-medium">Unarmed Strike</td>
                        <td className="py-1.5 pr-4 font-mono">{formatMod(atkMod + pb)}</td>
                        <td className="py-1.5 pr-4">{unarmedDie}{strMod !== 0 ? ` ${formatMod(atkMod)}` : ''} bludgeoning</td>
                        <td className="py-1.5 text-parchment-400 text-xs">{isMon ? `Monk d${monkLevel >= 17 ? 10 : monkLevel >= 11 ? 8 : monkLevel >= 5 ? 6 : 4}` : hasTB ? 'Tavern Brawler' : ''}</td>
                      </tr>
                    )
                  })()}
                  {featSlugs.includes('dragon-hide') && (
                    <tr>
                      <td className="py-1.5 pr-4 font-medium">Claws (Dragon Hide)</td>
                      <td className="py-1.5 pr-4 font-mono">{formatMod(abilityModFor(char, 'str') + pb)}</td>
                      <td className="py-1.5 pr-4">1d4 {formatMod(abilityModFor(char, 'str'))} slashing</td>
                      <td className="py-1.5 text-parchment-400 text-xs">Natural weapon</td>
                    </tr>
                  )}
                  {char.equipment.filter(e => e.equipped).map((item, idx) => {
                    const ws = resolveWeapon(item, content.items)
                    if (!ws) return null
                    const bonus = magicBonus(item.name)
                    const proficient = isWeaponProficient(char, item.itemSlug)
                    const effectivePb = proficient ? pb : 0
                    const atk = weaponAttackBonus(char, ws, effectivePb, bonus)
                    const dmgMod = weaponDamageMod(char, ws, bonus)
                    const dmgStr = ws.damage === '—' ? '—'
                      : `${ws.damage}${dmgMod !== 0 ? ` ${formatMod(dmgMod)}` : ''} ${ws.damageType}`
                    const tags = [
                      proficient ? '' : '⚠ Not proficient',
                      ws.finesse ? 'Finesse' : '',
                      ws.ranged ? 'Ranged' : '',
                      ws.versatile ? `Versatile (${ws.versatile})` : '',
                      bonus ? `Magic +${bonus}` : '',
                      item.attuned ? '✦ Attuned' : '',
                    ].filter(Boolean).join(' · ')
                    return (
                      <tr key={idx} className={item.attuned ? 'bg-indigo-50' : !proficient ? 'bg-red-50' : ''}>
                        <td className="py-1.5 pr-4 font-medium">{item.name}</td>
                        <td className="py-1.5 pr-4 font-mono">{formatMod(atk)}{!proficient && <span className="text-red-500 ml-1 text-xs">(no prof)</span>}</td>
                        <td className="py-1.5 pr-4">{dmgStr}</td>
                        <td className="py-1.5 text-parchment-400 text-xs">{tags || '—'}</td>
                      </tr>
                    )
                  })}
                  {spellClassSlug && (
                    <tr>
                      <td className="py-1.5 pr-4 font-medium">Spell Attack</td>
                      <td className="py-1.5 pr-4 font-mono">{formatMod(spellAttackBonus(effectiveChar, spellClassSlug, content) + itemBonuses.spellAttackBonus)}</td>
                      <td className="py-1.5 pr-4 text-parchment-400">varies by spell</td>
                      <td className="py-1.5 text-xs text-parchment-400">Save DC {spellSaveDC(effectiveChar, spellClassSlug, content) + itemBonuses.spellDCBonus}</td>
                    </tr>
                  )}
                  {char.raceSlug === 'dragonborn' && (() => {
                    const dragonChoice = char.featuresChosen.find(fc => fc.key === 'dragonborn-ancestry')
                    const dragonSlug = typeof dragonChoice?.value === 'string' ? dragonChoice.value : null
                    const dragon = dragonSlug ? DRACONIC_ANCESTRIES.find(d => d.slug === dragonSlug) : null
                    if (!dragon) return null
                    const charLevel = totalLevel(char)
                    const damageDice = charLevel >= 16 ? '5d6' : charLevel >= 11 ? '4d6' : charLevel >= 6 ? '3d6' : '2d6'
                    const conMod = abilityModFor(char, 'con')
                    const saveDC = 8 + conMod + pb
                    const used = (char.classResources['breath-weapon-used'] ?? 0) >= 1
                    return (
                      <tr className={used ? 'opacity-50' : ''}>
                        <td className="py-1.5 pr-4">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium">Breath Weapon</span>
                            {used
                              ? <span className="text-[10px] bg-parchment-100 text-parchment-400 rounded px-1.5 py-0.5">Used</span>
                              : <span className="text-[10px] bg-green-100 text-green-700 rounded px-1.5 py-0.5">Ready</span>
                            }
                          </div>
                        </td>
                        <td className="py-1.5 pr-4 text-parchment-500 text-xs">DC {saveDC} {dragon.saveType} save</td>
                        <td className="py-1.5 pr-4">{damageDice} {dragon.damageType.toLowerCase()}</td>
                        <td className="py-1.5 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="text-parchment-400">{dragon.breathShape} · {dragon.name} dragon · 1/SR</span>
                            <button type="button"
                              className={`text-[10px] rounded px-1.5 py-0.5 border transition-colors ${used ? 'border-green-300 text-green-600 hover:bg-green-50' : 'border-parchment-200 text-parchment-500 hover:border-parchment-400'}`}
                              onClick={() => patch({ classResources: { ...char.classResources, 'breath-weapon-used': used ? 0 : 1 } })}>
                              {used ? 'Restore' : 'Mark Used'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })()}
                </tbody>
              </table>
            </div>
          </div>

          {/* Proficiencies — full width */}
          <div className="card">
            <h2 className="section-header">All Proficiencies</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="font-semibold text-parchment-700 mb-1">Armor</div>
                {char.armorProficiencies.length > 0
                  ? <div className="flex flex-wrap gap-1">{char.armorProficiencies.map(p => <span key={p} className="bg-blue-100 text-blue-700 rounded px-2 py-0.5 text-xs capitalize">{p}</span>)}</div>
                  : <span className="text-parchment-400 text-xs">None</span>}
              </div>
              <div>
                <div className="font-semibold text-parchment-700 mb-1">Weapons</div>
                {char.weaponProficiencies.length > 0
                  ? <div className="flex flex-wrap gap-1">{char.weaponProficiencies.map(p => <span key={p} className="bg-green-100 text-green-700 rounded px-2 py-0.5 text-xs capitalize">{p}</span>)}</div>
                  : <span className="text-parchment-400 text-xs">None</span>}
              </div>
              <div>
                <div className="font-semibold text-parchment-700 mb-1">Tools</div>
                {char.toolProficiencies.length > 0
                  ? <div className="flex flex-wrap gap-1">{char.toolProficiencies.map(p => <span key={p} className="bg-parchment-100 text-parchment-700 rounded px-2 py-0.5 text-xs">{p}</span>)}</div>
                  : <span className="text-parchment-400 text-xs">None recorded</span>}
              </div>
              <div>
                <div className="font-semibold text-parchment-700 mb-1">Languages</div>
                {char.languages.length > 0
                  ? <div className="flex flex-wrap gap-1">{char.languages.map(l => <span key={l} className="bg-parchment-100 text-parchment-700 rounded px-2 py-0.5 text-xs capitalize">{l}</span>)}</div>
                  : <span className="text-parchment-400 text-xs">None recorded</span>}
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-parchment-100">
              <div className="font-semibold text-parchment-700 mb-2 text-sm">Saving Throw Proficiencies</div>
              <div className="flex flex-wrap gap-1">
                {ABILITIES.map(a => {
                  const proficient = char.saveProficiencies.includes(a)
                  const cls = char.classes.find(cc => content.classes.find(c => c.slug === cc.classSlug)?.saveProficiencies.includes(a))
                  const src = cls ? content.classes.find(c => c.slug === cls.classSlug)?.name : null
                  return (
                    <span key={a} className={`rounded px-2 py-0.5 text-xs ${proficient ? 'bg-indigo-100 text-indigo-700 font-semibold' : 'bg-parchment-100 text-parchment-400'}`}>
                      {ABILITY_FULL[a]}{proficient && src ? ` (${src})` : ''}
                    </span>
                  )
                })}
              </div>
            </div>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="label text-xs">Add tool proficiency</label>
                <input id="tool-add" className="input text-xs py-1" placeholder="e.g. Thieves' tools" onKeyDown={e => {
                  if (e.key === 'Enter') {
                    const val = (e.target as HTMLInputElement).value.trim()
                    if (val) { patch({ toolProficiencies: [...new Set([...char.toolProficiencies, val])] });(e.target as HTMLInputElement).value = '' }
                  }
                }} />
              </div>
              <div>
                <label className="label text-xs">Add language</label>
                <input className="input text-xs py-1" placeholder="e.g. Elvish" onKeyDown={e => {
                  if (e.key === 'Enter') {
                    const val = (e.target as HTMLInputElement).value.trim()
                    if (val) { patch({ languages: [...new Set([...char.languages, val])] });(e.target as HTMLInputElement).value = '' }
                  }
                }} />
              </div>
            </div>
          </div>
          {/* Custom Resources */}
          <div className="card">
            <h3 className="section-header mb-3">Custom Resources</h3>
            {(char.customResources ?? []).length > 0 && (
              <div className="space-y-3 mb-4">
                {(char.customResources ?? []).map(r => {
                  const current = char.classResources[r.key] ?? r.max
                  return (
                    <div key={r.key} className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-parchment-800 truncate">{r.name}</div>
                        <div className="text-xs text-parchment-400">{r.recharge === 'short' ? 'Short rest' : 'Long rest'} · {r.max} max</div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => patch({ classResources: { ...char.classResources, [r.key]: Math.max(0, current - 1) } })}
                          className="w-6 h-6 rounded border border-parchment-300 text-parchment-600 hover:bg-parchment-100 text-sm font-bold flex items-center justify-center"
                        >−</button>
                        <span className="text-sm font-mono w-10 text-center">{current}/{r.max}</span>
                        <button
                          onClick={() => patch({ classResources: { ...char.classResources, [r.key]: Math.min(r.max, current + 1) } })}
                          className="w-6 h-6 rounded border border-parchment-300 text-parchment-600 hover:bg-parchment-100 text-sm font-bold flex items-center justify-center"
                        >+</button>
                        <button
                          onClick={() => {
                            const updated = (char.customResources ?? []).filter(x => x.key !== r.key)
                            const newClassRes = { ...char.classResources }
                            delete newClassRes[r.key]
                            patch({ customResources: updated, classResources: newClassRes })
                          }}
                          className="w-6 h-6 rounded border border-red-200 text-red-400 hover:bg-red-50 text-xs flex items-center justify-center ml-1"
                          title="Remove resource"
                        >✕</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            <div className="border-t border-parchment-200 pt-3">
              <div className="text-xs text-parchment-500 mb-2 font-medium">Add Resource</div>
              <div className="flex gap-2 flex-wrap">
                <input
                  type="text"
                  placeholder="Name"
                  value={newResourceName}
                  onChange={e => setNewResourceName(e.target.value)}
                  className="border border-parchment-300 rounded px-2 py-1 text-sm flex-1 min-w-0 bg-parchment-50"
                />
                <input
                  type="number"
                  placeholder="Max"
                  min={1}
                  value={newResourceMax}
                  onChange={e => setNewResourceMax(e.target.value)}
                  className="border border-parchment-300 rounded px-2 py-1 text-sm w-16 bg-parchment-50"
                />
                <select
                  value={newResourceRecharge}
                  onChange={e => setNewResourceRecharge(e.target.value as 'short' | 'long')}
                  className="border border-parchment-300 rounded px-2 py-1 text-sm bg-parchment-50"
                >
                  <option value="long">Long Rest</option>
                  <option value="short">Short Rest</option>
                </select>
                <button
                  onClick={() => {
                    const name = newResourceName.trim()
                    const max = parseInt(newResourceMax, 10)
                    if (!name || !max || max < 1) return
                    const key = `custom-${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`
                    const newRes = { key, name, max, recharge: newResourceRecharge }
                    patch({
                      customResources: [...(char.customResources ?? []), newRes],
                      classResources: { ...char.classResources, [key]: max },
                    })
                    setNewResourceName('')
                    setNewResourceMax('')
                    setNewResourceRecharge('long')
                  }}
                  className="btn-primary text-sm px-3 py-1"
                >Add</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Spells Tab */}
      {tab === 'spells' && (
        <div className="space-y-4">
          {spellClassSlug ? (() => {
            const primaryClass = char.classes[0]
            const primarySlug = primaryClass?.classSlug ?? ''
            const classOpts = CLASS_OPTIONS[primarySlug]
            const isPrepared = classOpts?.preparedCaster ?? false
            const isSpellbookCaster = classOpts?.isSpellbookCaster ?? false
            const classLevel = primaryClass?.level ?? 1
            const spellAbility = content.classes.find(c => c.slug === primarySlug)?.spellcastingAbility ?? 'int'
            const abilMod = abilityModFor(char, spellAbility as 'str'|'dex'|'con'|'int'|'wis'|'cha')
            const prepLimit = isPrepared
              ? Math.max(1, ['paladin','artificer','ranger'].includes(primarySlug)
                  ? abilMod + Math.floor(classLevel / 2)
                  : abilMod + classLevel)
              : null
            const preparedCount = char.spells.filter(s => {
              const def = content.spells.find(d => d.slug === s.spellSlug)
              // Strixhaven-granted spells are bonus/always-prepared — don't count against the limit.
              return s.prepared && s.classSlug !== 'strixhaven' && (def?.level ?? 0) > 0
            }).length
            const cantripBase = classOpts?.cantripsKnown ?? 0
            const cantripBonus = (classOpts?.cantripsAtLevel ?? []).filter(l => l <= classLevel).length
            const cantripMax = cantripBase + cantripBonus
            const cantripCount = char.spells.filter(s => {
              const def = content.spells.find(d => d.slug === s.spellSlug)
              return s.classSlug !== 'strixhaven' && (def?.level ?? 0) === 0
            }).length
            const atCantripCap = cantripMax > 0 && cantripCount >= cantripMax
            const matchesClassFn = (spellClasses: string[]) =>
              spellClasses.some(c => c.toLowerCase().replace(/\s*\(.*?\)/g, '').trim() === primarySlug)
            const maxSlotLevel = Math.max(0, ...Object.entries(char.spellSlots)
              .filter(([, v]) => v.max > 0).map(([k]) => parseInt(k, 10)))
            const knownSlugs = new Set(char.spells.map(s => s.spellSlug))
            const availableSpells = content.spells
              .filter(s => matchesClassFn(s.classes))
              .filter(s => !knownSlugs.has(s.slug))
              .filter(s => s.level === 0 || s.level <= Math.max(maxSlotLevel, 1))
            const preparedSpells = char.spells.filter(s => s.prepared)
            const atPrepCap = isPrepared && prepLimit !== null && preparedCount >= prepLimit
            // Spells-known cap for known casters (Bard/Sorcerer/Warlock/Ranger — they learn a
            // fixed number of spells rather than preparing from a list each day).
            const knownMax = !isPrepared ? classOpts?.spellsKnownTable?.[classLevel - 1] : undefined
            const knownCount = char.spells.filter(s => {
              const def = content.spells.find(d => d.slug === s.spellSlug)
              return s.classSlug === primarySlug && (def?.level ?? 0) > 0
            }).length
            const atKnownCap = !!knownMax && knownCount >= knownMax
            const ordinals = ['Cantrips','1st','2nd','3rd','4th','5th','6th','7th','8th','9th']

            // School → left-border accent color (hex, used via inline style to avoid Tailwind class conflicts)
            const schoolAccentHex: Record<string, string> = {
              Abjuration: '#60a5fa', Conjuration: '#fbbf24',
              Divination: '#22d3ee', Enchantment: '#f472b6',
              Evocation: '#f87171', Illusion: '#c084fc',
              Necromancy: '#15803d', Transmutation: '#fb923c',
            }
            const schoolBorderColor = (school?: string) => school ? (schoolAccentHex[school] ?? '#d6cdb8') : '#d6cdb8'

            // Resolve which caster class a given spell entry uses for its DC/attack.
            // Falls back to the primary spell class for non-caster tags (e.g. Strixhaven).
            const classForEntry = (entryClassSlug?: string) =>
              (entryClassSlug && content.classes.find(c => c.slug === entryClassSlug)?.spellcastingAbility)
                ? entryClassSlug
                : (spellClassSlug as string)

            // Item-aware spell DC/attack — use effectiveChar (ability overrides applied) + item bonuses.
            const totalSpellDC  = (cls: string) => spellSaveDC(effectiveChar, cls, content)  + itemBonuses.spellDCBonus
            const totalSpellAtk = (cls: string) => spellAttackBonus(effectiveChar, cls, content) + itemBonuses.spellAttackBonus

            return (
              <>
                {/* ── Spellcasting Header ── */}
                <div className="card px-4 py-3 space-y-3">
                  {/* Title row */}
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-base font-bold text-parchment-800 uppercase tracking-widest">
                          {content.classes.find(c => c.slug === primarySlug)?.name ?? primarySlug}
                        </h2>
                        {isMulticlassCaster && (
                          <span className="text-xs bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-full px-2 py-0.5 font-semibold">Multiclass</span>
                        )}
                      </div>
                      <p className="text-[11px] text-parchment-400 mt-0.5 tracking-wide">
                        {({ str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' } as Record<string,string>)[spellAbility] ?? spellAbility.toUpperCase()} Spellcasting
                      </p>
                    </div>
                    <button
                      type="button"
                      className="shrink-0 text-xs text-parchment-500 hover:text-parchment-800 border border-parchment-300 hover:border-parchment-500 rounded px-2.5 py-1.5 transition-colors font-medium"
                      onClick={() => {
                        const reset: Character['spellSlots'] = {}
                        const maxSource = multiclassMaxes ?? Object.fromEntries(
                          Object.entries(char.spellSlots).map(([k, v]) => [k, v.max])
                        )
                        for (const [lvl, max] of Object.entries(maxSource)) {
                          if (max > 0) reset[lvl] = { max, used: 0 }
                        }
                        patch({ spellSlots: reset })
                      }}
                    >↺ Long Rest</button>
                  </div>

                  {/* Stat boxes */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="flex flex-col items-center py-2 px-2 rounded-lg border border-violet-200 bg-violet-50">
                      <span className="text-[9px] text-violet-400 font-bold uppercase tracking-widest mb-0.5">Spell DC</span>
                      <span className="text-2xl font-bold text-violet-800 leading-none">{totalSpellDC(spellClassSlug)}</span>
                    </div>
                    <div className="flex flex-col items-center py-2 px-2 rounded-lg border border-violet-200 bg-violet-50">
                      <span className="text-[9px] text-violet-400 font-bold uppercase tracking-widest mb-0.5">Spell Atk</span>
                      <span className="text-2xl font-bold text-violet-800 leading-none">{formatMod(totalSpellAtk(spellClassSlug))}</span>
                    </div>
                    {isPrepared && prepLimit !== null ? (
                      <div className={`flex flex-col items-center py-2 px-2 rounded-lg border ${preparedCount >= prepLimit ? 'border-amber-300 bg-amber-50' : 'border-parchment-200 bg-parchment-50'}`}>
                        <span className={`text-[9px] font-bold uppercase tracking-widest mb-0.5 ${preparedCount >= prepLimit ? 'text-amber-500' : 'text-parchment-400'}`}>Prepared</span>
                        <span className={`text-2xl font-bold leading-none ${preparedCount >= prepLimit ? 'text-amber-700' : 'text-parchment-800'}`}>{preparedCount}<span className="text-sm text-parchment-400">/{prepLimit}</span></span>
                      </div>
                    ) : knownMax ? (
                      <div className={`flex flex-col items-center py-2 px-2 rounded-lg border ${atKnownCap ? 'border-amber-300 bg-amber-50' : 'border-parchment-200 bg-parchment-50'}`}>
                        <span className={`text-[9px] font-bold uppercase tracking-widest mb-0.5 ${atKnownCap ? 'text-amber-500' : 'text-parchment-400'}`}>Known</span>
                        <span className={`text-2xl font-bold leading-none ${atKnownCap ? 'text-amber-700' : 'text-parchment-800'}`}>{knownCount}<span className="text-sm text-parchment-400">/{knownMax}</span></span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center py-2 px-2 rounded-lg border border-parchment-200 bg-parchment-50">
                        <span className="text-[9px] text-parchment-400 font-bold uppercase tracking-widest mb-0.5">{spellAbility.toUpperCase()} Mod</span>
                        <span className="text-2xl font-bold text-parchment-800 leading-none">{formatMod(abilMod)}</span>
                      </div>
                    )}
                    {cantripMax > 0 ? (
                      <div className={`flex flex-col items-center py-2 px-2 rounded-lg border ${atCantripCap ? 'border-amber-300 bg-amber-50' : 'border-parchment-200 bg-parchment-50'}`}>
                        <span className={`text-[9px] font-bold uppercase tracking-widest mb-0.5 ${atCantripCap ? 'text-amber-500' : 'text-parchment-400'}`}>Cantrips</span>
                        <span className={`text-2xl font-bold leading-none ${atCantripCap ? 'text-amber-700' : 'text-parchment-800'}`}>{cantripCount}<span className="text-sm text-parchment-400">/{cantripMax}</span></span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center py-2 px-2 rounded-lg border border-parchment-200 bg-parchment-50">
                        <span className="text-[9px] text-parchment-400 font-bold uppercase tracking-widest mb-0.5">{spellAbility.toUpperCase()} Mod</span>
                        <span className="text-2xl font-bold text-parchment-800 leading-none">{formatMod(abilMod)}</span>
                      </div>
                    )}
                  </div>

                  {/* Concentration banner */}
                  {char.concentratingOn && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-300 conc-active" style={{ boxShadow: '0 0 10px 2px rgba(245,158,11,0.18)' }}>
                      <div className="w-2 h-2 rounded-full bg-amber-400 shrink-0" style={{ boxShadow: '0 0 6px 2px rgba(251,191,36,0.8)' }} />
                      <span className="text-[10px] text-amber-700 font-bold uppercase tracking-widest">Concentrating</span>
                      <span className="text-xs text-amber-900 font-semibold">
                        {content.spells.find(s => s.slug === char.concentratingOn)?.name ?? char.concentratingOn}
                      </span>
                      <button type="button"
                        className="ml-auto text-[10px] text-amber-500 hover:text-red-500 border border-amber-300 hover:border-red-300 rounded px-1.5 py-0.5 transition-colors font-medium"
                        onClick={() => patch({ concentratingOn: undefined })}
                      >Drop</button>
                    </div>
                  )}
                </div>

                {/* ── Spell Slots card ── */}
                {(Object.keys(char.spellSlots).length > 0 || multiclassMaxes) && (
                  <div className="card">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-bold text-parchment-700 uppercase tracking-wider">Spell Slots</h3>
                      {isMulticlassCaster && (
                        <span className="text-xs bg-indigo-100 text-indigo-700 rounded-full px-2.5 py-0.5 font-medium">Multiclass</span>
                      )}
                    </div>
                    {isMulticlassCaster && (() => {
                      const parts = char.classes.map(cc => {
                        const ct = CASTER_TYPE[cc.classSlug]
                        const type = typeof ct === 'function' ? ct(cc.subclassSlug) : (ct ?? 'none')
                        if (type === 'none' || type === 'pact') return null
                        const cl = type === 'full' ? cc.level : type === 'half-up' ? Math.ceil(cc.level / 2) : type === 'half' ? Math.floor(cc.level / 2) : Math.floor(cc.level / 3)
                        if (cl === 0) return null
                        const label = content.classes.find(c => c.slug === cc.classSlug)?.name ?? cc.classSlug
                        return `${label} ${cc.level} (CL ${cl})`
                      }).filter(Boolean)
                      const totalCL = effectiveCasterLevel(char.classes)
                      return parts.length > 0 ? (
                        <p className="text-[11px] text-indigo-500 mb-2.5">
                          {parts.join(' + ')} → CL {totalCL}
                        </p>
                      ) : null
                    })()}
                    <div className="space-y-2.5">
                      {[1,2,3,4,5,6,7,8,9].map(lvl => {
                        const slotMax = multiclassMaxes
                          ? (multiclassMaxes[String(lvl)] ?? 0)
                          : (char.spellSlots[String(lvl)]?.max ?? 0)
                        if (slotMax === 0) return null
                        const slotUsed = char.spellSlots[String(lvl)]?.used ?? 0
                        const slotLeft = slotMax - slotUsed
                        const ordinal = ['1st','2nd','3rd','4th','5th','6th','7th','8th','9th'][lvl - 1]
                        return (
                          <div key={lvl} className="flex items-center gap-3">
                            <span className="text-xs font-semibold text-parchment-500 w-7 shrink-0 text-right">{ordinal}</span>
                            <div className="flex gap-2 items-center flex-1">
                              {Array.from({ length: slotMax }, (_, i) => {
                                const available = i < slotLeft
                                return (
                                  <button
                                    key={i}
                                    type="button"
                                    title={available ? 'Expend slot' : 'Recover slot'}
                                    onClick={() => {
                                      const used = available ? slotUsed + 1 : slotUsed - 1
                                      patch({ spellSlots: { ...char.spellSlots, [String(lvl)]: { max: slotMax, used } } })
                                    }}
                                    className="w-6 h-6 flex items-center justify-center group"
                                  >
                                    <div className={`w-3.5 h-3.5 rotate-45 border ${
                                      available
                                        ? 'bg-violet-500 border-violet-300'
                                        : 'bg-parchment-200 border-parchment-300 opacity-40 transition-all duration-150 group-hover:scale-125'
                                    }`}
                                      style={available ? {
                                        animation: 'pip-pulse 2.4s ease-in-out infinite',
                                        animationDelay: `${i * 0.18}s`,
                                      } : undefined}
                                    />
                                  </button>
                                )
                              })}
                            </div>
                            <span className="text-xs text-parchment-400 w-10 text-right shrink-0">{slotLeft}/{slotMax}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* ── Sorcery Points: Flexible Casting ── */}
                {char.classes.some(c => c.classSlug === 'sorcerer') && (() => {
                  const sorcLevel = char.classes.find(c => c.classSlug === 'sorcerer')?.level ?? 0
                  if (sorcLevel < 2) return null
                  const spCurrent = char.classResources['sorcery-points'] ?? sorcLevel
                  const SLOT_TO_POINTS: Record<number, number> = { 1: 2, 2: 3, 3: 5, 4: 6, 5: 7 }
                  const POINTS_TO_SLOT: Record<number, number> = { 1: 2, 2: 3, 3: 5, 4: 6, 5: 7 }
                  return (
                    <div className="card">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-bold text-parchment-700 uppercase tracking-wider">Flexible Casting</h3>
                        <span className="text-xs bg-purple-100 text-purple-700 rounded-full px-2 py-0.5 font-medium">{spCurrent}/{sorcLevel} Sorcery Pts</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <div className="text-xs font-semibold text-parchment-500 uppercase mb-1">Convert Slot → Points</div>
                          <div className="space-y-1">
                            {[1,2,3,4,5].filter(lvl => (char.spellSlots[String(lvl)]?.max ?? 0) > 0).map(lvl => {
                              const used = char.spellSlots[String(lvl)]?.used ?? 0
                              const max = char.spellSlots[String(lvl)]?.max ?? 0
                              const available = max - used
                              const gain = SLOT_TO_POINTS[lvl]!
                              return (
                                <button key={lvl} disabled={available === 0}
                                  onClick={() => {
                                    const newUsed = used + 1
                                    const newSP = Math.min(sorcLevel, spCurrent + gain)
                                    patch({
                                      spellSlots: { ...char.spellSlots, [String(lvl)]: { max, used: newUsed } },
                                      classResources: { ...char.classResources, 'sorcery-points': newSP },
                                    })
                                  }}
                                  className="w-full text-left text-xs px-2 py-1 rounded border border-parchment-200 hover:border-purple-300 hover:bg-purple-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                                  Expend L{lvl} slot (+{gain} pts) <span className="text-parchment-400">[{available} avail]</span>
                                </button>
                              )
                            })}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-parchment-500 uppercase mb-1">Convert Points → Slot</div>
                          <div className="space-y-1">
                            {([1,2,3,4,5] as const).filter(lvl => lvl <= Math.min(5, sorcLevel)).map(lvl => {
                              const cost = POINTS_TO_SLOT[lvl]!
                              return (
                                <button key={lvl} disabled={spCurrent < cost}
                                  onClick={() => {
                                    const newSP = spCurrent - cost
                                    const slotMax = (char.spellSlots[String(lvl)]?.max ?? 0) + 1
                                    const slotUsed = char.spellSlots[String(lvl)]?.used ?? 0
                                    patch({
                                      classResources: { ...char.classResources, 'sorcery-points': newSP },
                                      spellSlots: { ...char.spellSlots, [String(lvl)]: { max: slotMax, used: slotUsed } },
                                    })
                                  }}
                                  className="w-full text-left text-xs px-2 py-1 rounded border border-parchment-200 hover:border-purple-300 hover:bg-purple-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                                  Create L{lvl} slot (−{cost} pts) <span className="text-parchment-400">[need {cost}]</span>
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                      <p className="text-[10px] text-parchment-400 mt-2">Created slots are temporary (disappear on long rest). Slot conversion limited to L5 maximum.</p>
                    </div>
                  )
                })()}

                {/* ── Prepared / Known Spells ── */}
                <div className="card">
                  {(() => {
                    const presentLevels = [0,1,2,3,4,5,6,7,8,9].filter(lvl =>
                      preparedSpells.some(s => (content.spells.find(d => d.slug === s.spellSlug)?.level ?? 0) === lvl)
                    )
                    const activeLevel = presentLevels.includes(preparedTab) ? preparedTab : (presentLevels[0] ?? 0)
                    const tabSpells = preparedSpells.filter(s => {
                      const def = content.spells.find(d => d.slug === s.spellSlug)
                      return (def?.level ?? 0) === activeLevel && s.name.toLowerCase().includes(spellFilter.toLowerCase())
                    })
                    const isCantrip = activeLevel === 0

                    return (
                      <>
                        {/* Header row */}
                        <div className="flex items-center justify-between mb-3">
                          <h2 className="text-sm font-bold text-parchment-700 uppercase tracking-wider">
                            {isPrepared ? 'Prepared Spells' : 'Known Spells'}
                          </h2>
                          {presentLevels.length > 0 && (
                            <input
                              className="input text-sm py-1 w-28"
                              placeholder="Filter…"
                              value={spellFilter}
                              onChange={e => setSpellFilter(e.target.value)}
                            />
                          )}
                        </div>

                        {preparedSpells.length === 0 ? (
                          <p className="text-sm text-parchment-400 py-4 text-center">
                            No spells yet — use the spell library below to {isPrepared ? 'prepare spells' : 'learn spells'}.
                          </p>
                        ) : (
                          <>
                            {/* Level tabs — clean, no pips */}
                            <div className="flex gap-1.5 flex-wrap mb-4">
                              {presentLevels.map(lvl => {
                                const active = lvl === activeLevel
                                const isCtip = lvl === 0
                                const count = preparedSpells.filter(s => (content.spells.find(d => d.slug === s.spellSlug)?.level ?? 0) === lvl).length
                                return (
                                  <button
                                    key={lvl}
                                    type="button"
                                    onClick={() => setPreparedTab(lvl)}
                                    className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                                      active
                                        ? isCtip
                                          ? 'bg-amber-500 border-amber-500 text-white shadow-sm'
                                          : 'bg-dungeon-900 border-dungeon-900 text-parchment-100 shadow-sm'
                                        : 'border-parchment-200 text-parchment-600 hover:border-parchment-400 bg-parchment-50'
                                    }`}
                                  >
                                    {ordinals[lvl]}
                                    <span className={`ml-1.5 font-normal ${active ? 'opacity-70' : 'text-parchment-400'}`}>{count}</span>
                                  </button>
                                )
                              })}
                            </div>

                            {isCantrip && (
                              <p className="text-xs text-amber-600 mb-3 px-1">Cantrips are always available — no spell slot needed.</p>
                            )}

                            {/* Spell cards */}
                            <div className="space-y-1.5">
                              {tabSpells.length === 0 && (
                                <p className="text-sm text-parchment-400 py-3 text-center">No spells match "{spellFilter}"</p>
                              )}
                              {tabSpells.map(s => {
                                const def = content.spells.find(d => d.slug === s.spellSlug)
                                const cantripDmg = (isCantrip && def) ? cantripDiceAtLevel(def.slug, level) : null
                                const rawDmg = def?.damage ?? null
                                const dmgDisplay = cantripDmg ?? (rawDmg ? `${rawDmg.dice}${rawDmg.type ? ` ${rawDmg.type}` : ''}` : null)
                                const isOpen = browserSelectedSpell === s.spellSlug
                                const isConcentrating = char.concentratingOn === s.spellSlug
                                const aoe = def ? extractAoE(def.range) : null
                                const dmgStyle = rawDmg?.type ? (DAMAGE_TYPE_STYLE[rawDmg.type] ?? DAMAGE_TYPE_STYLE.force) : null
                                const upcast = (!isCantrip && def?.higherLevels) ? parseUpcastScaling(def.higherLevels) : null
                                return (
                                  <div key={s.spellSlug}
                                    style={{ borderLeftColor: isConcentrating ? '#f59e0b' : schoolBorderColor(def?.school) }}
                                    className={`rounded-lg border transition-colors ${isConcentrating ? 'border-l-[4px] border-amber-300 bg-amber-50/60 conc-active' : 'border-l-[3px] border-parchment-200 bg-parchment-50 hover:bg-parchment-50/60'}`}
                                  >
                                    <button
                                      type="button"
                                      className="w-full text-left px-3 py-2.5"
                                      onClick={() => setBrowserSelectedSpell(isOpen ? null : s.spellSlug)}
                                    >
                                      <div className="flex items-start gap-2">
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            {isConcentrating && (
                                              <div className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0" style={{ boxShadow: '0 0 8px 3px rgba(251,191,36,0.75)', animation: 'conc-glow 2s ease-in-out infinite' }} />
                                            )}
                                            <span className={`font-semibold text-sm ${isConcentrating ? 'text-amber-900' : 'text-parchment-900'}`}>{s.name}</span>
                                            {def?.concentration && !isConcentrating && <span className="text-xs bg-amber-100 text-amber-800 border border-amber-400 rounded px-1.5 py-0.5 font-semibold">Conc.</span>}
                                            {isConcentrating && <span className="text-xs bg-amber-500 text-white rounded px-2 py-0.5 font-bold tracking-wide uppercase" style={{ boxShadow: '0 0 8px 2px rgba(245,158,11,0.4)' }}>● Concentrating</span>}
                                            {def?.ritual && <span className="text-xs bg-blue-50 text-blue-600 border border-blue-200 rounded px-1.5 py-0.5">Ritual</span>}
                                            {s.usesPerLongRest && s.freeUseKey && (() => {
                                              const spent = char.freeSpellUses?.[s.freeUseKey] ?? 0
                                              const left = Math.max(0, s.usesPerLongRest - spent)
                                              return (
                                                <span className={`text-xs rounded px-1.5 py-0.5 border ${left > 0 ? 'bg-indigo-50 text-indigo-700 border-indigo-300' : 'bg-parchment-100 text-parchment-400 border-parchment-200 line-through'}`}>
                                                  {left}/{s.usesPerLongRest}/LR free
                                                </span>
                                              )
                                            })()}
                                            {def?.savingThrow && (() => {
                                              const dc = totalSpellDC(classForEntry(s.classSlug))
                                              return <span className="text-xs bg-violet-50 text-violet-700 border border-violet-200 rounded px-1.5 py-0.5 font-semibold">{def.savingThrow.ability.toUpperCase()} save · DC {dc}</span>
                                            })()}
                                            {def?.attackRoll && (() => {
                                              const atk = totalSpellAtk(classForEntry(s.classSlug))
                                              return <span className="text-xs bg-violet-50 text-violet-700 border border-violet-200 rounded px-1.5 py-0.5 font-semibold">{atk >= 0 ? '+' : ''}{atk} to hit</span>
                                            })()}
                                            {dmgDisplay && (
                                              <span className={`text-xs px-1.5 py-0.5 rounded border ${dmgStyle ? `${dmgStyle.bg} ${dmgStyle.text} ${dmgStyle.border}` : 'bg-red-100 text-red-800 border-red-300'}`}>
                                                {dmgDisplay}{rawDmg?.type ? ` ${rawDmg.type}` : ''}
                                              </span>
                                            )}
                                            {aoe && dmgDisplay && (
                                              <span className="text-xs bg-parchment-100 text-parchment-600 border border-parchment-300 rounded px-1.5 py-0.5">{aoe}</span>
                                            )}
                                            {upcast && (
                                              <span className="text-xs bg-violet-50 text-violet-700 border border-violet-200 rounded px-1.5 py-0.5">↑+{upcast.dice}/lvl</span>
                                            )}
                                          </div>
                                          {def && <div className="text-xs text-parchment-400 mt-0.5">{def.castingTime} · {def.range} · {def.duration}{def.school ? ` · ${def.school}` : ''}</div>}
                                        </div>
                                        <span className="text-parchment-300 text-xs mt-0.5 shrink-0">{isOpen ? '▲' : '▼'}</span>
                                      </div>
                                    </button>
                                    {isOpen && (
                                      <div className="px-3 pb-3 border-t border-parchment-100 pt-2.5 space-y-2">
                                        {def && (
                                          <SpellStatBlock
                                            spell={def}
                                            saveDc={def.savingThrow ? totalSpellDC(classForEntry(s.classSlug)) : undefined}
                                            attackBonus={def.attackRoll ? totalSpellAtk(classForEntry(s.classSlug)) : undefined}
                                          />
                                        )}
                                        {def?.description && (
                                          <p className="text-sm text-parchment-700 leading-relaxed whitespace-pre-line">
                                            {def.description}
                                          </p>
                                        )}
                                        {def?.higherLevels && (() => {
                                          const availSlots = [1,2,3,4,5,6,7,8,9].filter(lvl => {
                                            if (lvl <= (def.level ?? 0)) return false
                                            const max = multiclassMaxes ? (multiclassMaxes[String(lvl)] ?? 0) : (char.spellSlots[String(lvl)]?.max ?? 0)
                                            return max > 0
                                          })
                                          const showTable = upcast && rawDmg && availSlots.length > 0
                                          const slotOrdinals = ['1st','2nd','3rd','4th','5th','6th','7th','8th','9th']
                                          return (
                                            <div className="border-t border-parchment-100 pt-2 space-y-2">
                                              <div className="text-xs font-semibold text-parchment-700 uppercase tracking-wide">At Higher Levels</div>
                                              {showTable && (
                                                <div className="flex flex-wrap gap-1.5">
                                                  <div className={`flex flex-col items-center px-2 py-1 rounded border border-parchment-200 bg-parchment-50 text-xs ${castHighlight?.slug === s.spellSlug && castHighlight.level === (def.level ?? 1) ? 'ring-2 ring-violet-400 ring-offset-1' : ''}`}>
                                                    <span className="text-parchment-400">{slotOrdinals[(def.level ?? 1) - 1]}</span>
                                                    <span className="font-semibold text-parchment-700">{rawDmg!.dice}{rawDmg!.type ? ` ${rawDmg!.type}` : ''}</span>
                                                  </div>
                                                  {availSlots.map(lvl => {
                                                    const total = computeUpcastDamage(rawDmg!.dice, upcast!.dice, lvl - (def.level ?? 1))
                                                    const lit = castHighlight?.slug === s.spellSlug && castHighlight.level === lvl
                                                    return (
                                                      <div key={lvl} className={`flex flex-col items-center px-2 py-1 rounded border border-violet-200 bg-violet-50 text-xs ${lit ? 'ring-2 ring-violet-400 ring-offset-1' : ''}`}>
                                                        <span className="text-violet-400">{slotOrdinals[lvl - 1]}</span>
                                                        <span className="font-semibold text-violet-800">{total ?? `+${upcast!.dice}`}{!total && rawDmg!.type ? ` ${rawDmg!.type}` : (total && rawDmg!.type ? ` ${rawDmg!.type}` : '')}</span>
                                                      </div>
                                                    )
                                                  })}
                                                </div>
                                              )}
                                              <p className="text-xs italic text-parchment-500 whitespace-pre-line">{cleanHigherLevels(def.higherLevels)}</p>
                                            </div>
                                          )
                                        })()}
                                        {/* Cast at level — spend a slot directly from the card */}
                                        {!isCantrip && def && (() => {
                                          const slotOrdinals = ['1st','2nd','3rd','4th','5th','6th','7th','8th','9th']
                                          const slotLevels = [1,2,3,4,5,6,7,8,9].filter(lvl => {
                                            if (lvl < (def.level ?? 1)) return false
                                            const max = multiclassMaxes ? (multiclassMaxes[String(lvl)] ?? 0) : (char.spellSlots[String(lvl)]?.max ?? 0)
                                            return max > 0
                                          })
                                          if (slotLevels.length === 0) {
                                            return <p className="text-xs italic text-parchment-400 pt-1">No spell slots available to cast this.</p>
                                          }
                                          const castAt = (lvl: number) => {
                                            const max = multiclassMaxes ? (multiclassMaxes[String(lvl)] ?? 0) : (char.spellSlots[String(lvl)]?.max ?? 0)
                                            const used = char.spellSlots[String(lvl)]?.used ?? 0
                                            if (used >= max) return
                                            const startConc = !!def.concentration && char.concentratingOn !== s.spellSlug
                                            if (startConc && char.concentratingOn) {
                                              const prev = content.spells.find(sp => sp.slug === char.concentratingOn)?.name ?? char.concentratingOn
                                              if (!confirm(`Casting ${s.name} will end your concentration on ${prev}. Continue?`)) return
                                            }
                                            patch({
                                              spellSlots: { ...char.spellSlots, [String(lvl)]: { max, used: used + 1 } },
                                              ...(startConc ? { concentratingOn: s.spellSlug } : {}),
                                            })
                                            setCastHighlight({ slug: s.spellSlug, level: lvl })
                                          }
                                          return (
                                            <div className="flex items-center gap-1.5 flex-wrap pt-1">
                                              <span className="text-[10px] font-bold uppercase tracking-widest text-parchment-400 mr-0.5">Cast at</span>
                                              {slotLevels.map(lvl => {
                                                const max = multiclassMaxes ? (multiclassMaxes[String(lvl)] ?? 0) : (char.spellSlots[String(lvl)]?.max ?? 0)
                                                const left = max - (char.spellSlots[String(lvl)]?.used ?? 0)
                                                const out = left <= 0
                                                return (
                                                  <button key={lvl} type="button" disabled={out}
                                                    onClick={() => castAt(lvl)}
                                                    title={out ? `No ${slotOrdinals[lvl - 1]}-level slots left` : `Cast ${s.name} with a ${slotOrdinals[lvl - 1]}-level slot — ${left} left`}
                                                    className={`px-2.5 py-1 rounded border text-xs font-semibold transition-colors ${out ? 'opacity-40 cursor-not-allowed border-parchment-200 text-parchment-400 bg-parchment-50' : 'bg-violet-600 border-violet-600 text-white hover:bg-violet-700'}`}
                                                  >{slotOrdinals[lvl - 1]} <span className="font-normal opacity-75">({left})</span></button>
                                                )
                                              })}
                                            </div>
                                          )
                                        })()}
                                        <div className="flex items-center gap-2 pt-1 flex-wrap">
                                          {def?.concentration && (
                                            <button type="button"
                                              onClick={() => {
                                                if (char.concentratingOn === s.spellSlug) {
                                                  patch({ concentratingOn: undefined })
                                                } else {
                                                  if (char.concentratingOn) {
                                                    const prev = content.spells.find(sp => sp.slug === char.concentratingOn)?.name ?? char.concentratingOn
                                                    if (!confirm(`Drop concentration on ${prev}?`)) return
                                                  }
                                                  patch({ concentratingOn: s.spellSlug })
                                                }
                                              }}
                                              className={`px-3 py-1.5 rounded border text-xs font-semibold transition-colors ${
                                                char.concentratingOn === s.spellSlug
                                                  ? 'bg-amber-400 border-amber-400 text-white'
                                                  : 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100'
                                              }`}
                                            >{char.concentratingOn === s.spellSlug ? 'Concentrating' : 'Concentrate'}</button>
                                          )}
                                          {s.usesPerLongRest && s.freeUseKey && (() => {
                                            const key = s.freeUseKey
                                            const spent = char.freeSpellUses?.[key] ?? 0
                                            const left = Math.max(0, s.usesPerLongRest - spent)
                                            const isSpent = left === 0
                                            return (
                                              <>
                                                <button type="button" disabled={isSpent}
                                                  className={`px-3 py-1.5 rounded border text-xs font-semibold transition-colors ${isSpent ? 'opacity-40 cursor-not-allowed border-parchment-200 text-parchment-400' : 'bg-indigo-50 border-indigo-300 text-indigo-700 hover:bg-indigo-100'}`}
                                                  onClick={() => patch({ freeSpellUses: { ...char.freeSpellUses, [key]: spent + 1 } })}
                                                >Cast Free ({left}/{s.usesPerLongRest} LR)</button>
                                                {spent > 0 && (
                                                  <button type="button"
                                                    className="px-2 py-1.5 rounded border text-xs text-parchment-400 hover:text-indigo-600 border-parchment-200 hover:border-indigo-300 transition-colors"
                                                    onClick={() => patch({ freeSpellUses: { ...char.freeSpellUses, [key]: Math.max(0, spent - 1) } })}
                                                  >Restore</button>
                                                )}
                                              </>
                                            )
                                          })()}
                                          {!isCantrip && (
                                            isSpellbookCaster ? (
                                              <button type="button"
                                                className="px-3 py-1.5 rounded border text-xs text-parchment-400 hover:text-amber-600 border-parchment-200 hover:border-amber-300 transition-colors"
                                                onClick={() => patch({ spells: char.spells.map(sp => sp.spellSlug === s.spellSlug ? { ...sp, prepared: false } : sp) })}
                                              >Unprepare</button>
                                            ) : (
                                              <button type="button"
                                                className="px-3 py-1.5 rounded border text-xs text-parchment-400 hover:text-red-500 border-parchment-200 hover:border-red-300 transition-colors"
                                                onClick={() => patch({ spells: char.spells.filter(sp => sp.spellSlug !== s.spellSlug) })}
                                              >{isPrepared ? 'Unprepare' : 'Remove'}</button>
                                            )
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          </>
                        )}
                      </>
                    )
                  })()}
                </div>

                {/* ── Spellbook (unprepared) — Wizard only ── */}
                {isSpellbookCaster && (() => {
                  const unprepared = char.spells.filter(s => !s.prepared && (content.spells.find(d => d.slug === s.spellSlug)?.level ?? 0) > 0)
                  if (unprepared.length === 0) return null
                  return (
                    <div className="card">
                      <div className="flex items-center gap-2 mb-3">
                        <h3 className="text-sm font-bold text-parchment-700 uppercase tracking-wider">Spellbook</h3>
                        <span className="text-xs bg-amber-100 text-amber-700 rounded-full px-2.5 py-0.5 font-medium">Not Prepared · {unprepared.length}</span>
                      </div>
                      <div className="space-y-1.5">
                        {unprepared.map(s => {
                          const def = content.spells.find(d => d.slug === s.spellSlug)
                          return (
                            <div key={s.spellSlug} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-parchment-200 bg-parchment-50">
                              <div className="flex-1 min-w-0">
                                <span className="text-sm font-semibold text-parchment-800">{s.name}</span>
                                {def && <span className="ml-2 text-xs text-parchment-400">{['Cantrip','1st','2nd','3rd','4th','5th','6th','7th','8th','9th'][def.level]} · {def.school}</span>}
                              </div>
                              <div className="flex gap-2 shrink-0">
                                <button type="button"
                                  disabled={atPrepCap}
                                  className="px-2.5 py-1 rounded border text-xs font-semibold transition-colors bg-violet-50 border-violet-300 text-violet-700 hover:bg-violet-100 disabled:opacity-40 disabled:cursor-not-allowed"
                                  onClick={() => patch({ spells: char.spells.map(sp => sp.spellSlug === s.spellSlug ? { ...sp, prepared: true } : sp) })}
                                >Prepare</button>
                                <button type="button"
                                  className="px-2.5 py-1 rounded border text-xs text-parchment-400 hover:text-red-500 border-parchment-200 hover:border-red-300 transition-colors"
                                  onClick={() => patch({ spells: char.spells.filter(sp => sp.spellSlug !== s.spellSlug) })}
                                >Remove</button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()}

                {/* ── Pact Magic ── */}
                {char.pactSlots && (
                  <div className="card">
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="text-sm font-bold text-parchment-700 uppercase tracking-wider">Pact Magic</h3>
                      <span className="text-xs bg-indigo-100 text-indigo-700 rounded-full px-2.5 py-0.5 font-medium">Level {char.pactSlots.level} · Short Rest</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex gap-2">
                        {Array.from({ length: char.pactSlots.max }, (_, i) => {
                          const available = i < char.pactSlots!.max - char.pactSlots!.used
                          return (
                            <button key={i} type="button"
                              title={available ? 'Expend slot' : 'Recover slot'}
                              onClick={() => {
                                if (!char.pactSlots) return
                                const used = available ? char.pactSlots.used + 1 : char.pactSlots.used - 1
                                patch({ pactSlots: { ...char.pactSlots, used } })
                              }}
                              className="w-5 h-5 flex items-center justify-center group"
                            >
                              <div className={`w-3.5 h-3.5 rotate-45 border-2 ${
                                available ? 'bg-violet-500 border-violet-300' : 'bg-parchment-200 border-parchment-300 opacity-40 transition-all duration-150 group-hover:scale-125'
                              }`} style={available ? {
                                animation: 'pip-pulse 2.4s ease-in-out infinite',
                                animationDelay: `${i * 0.18}s`,
                              } : undefined} />
                            </button>
                          )
                        })}
                      </div>
                      <span className="text-sm text-parchment-500">{char.pactSlots.max - char.pactSlots.used}/{char.pactSlots.max} remaining</span>
                      <button type="button"
                        className="ml-auto text-xs text-parchment-400 hover:text-parchment-700 border border-parchment-200 hover:border-parchment-400 rounded px-2.5 py-1 transition-colors"
                        onClick={() => { if (char.pactSlots) patch({ pactSlots: { ...char.pactSlots, used: 0 } }) }}
                      >Short Rest</button>
                    </div>
                  </div>
                )}

                {/* ── Innate / Free Spells (feats, race, subclass — single source of truth) ── */}
                {freeSpells.length > 0 && (
                  <div className="card">
                    <h3 className="text-sm font-bold text-parchment-700 uppercase tracking-wider mb-3">Innate Spells</h3>
                    <div className="space-y-3">
                      {[...new Set(freeSpells.map(s => s.level))].sort((a, b) => a - b).map(lvl => {
                        const group = freeSpells.filter(s => s.level === lvl)
                        const label = lvl === 0 ? 'Cantrips' : `${['1st','2nd','3rd','4th','5th','6th','7th','8th','9th'][lvl - 1]} Level`
                        return (
                          <div key={lvl}>
                            <div className="text-[10px] font-bold text-parchment-400 uppercase tracking-widest mb-1.5">{label}</div>
                            <div className="space-y-1.5">
                              {group.map(spell => {
                                const def = content.spells.find(s => s.slug === spell.slug)
                                const dmg = def?.damage ?? null
                                const usesMax = spell.usesPerLongRest
                                const usesLeft = usesMax !== undefined
                                  ? Math.max(0, usesMax - (char.freeSpellUses?.[spell.key] ?? 0))
                                  : null
                                const isAlwaysPrepared = spell.alwaysPrepared === true
                                const isAtWill = usesMax === undefined && !isAlwaysPrepared
                                const hasTracker = usesMax !== undefined
                                const isSpent = usesLeft === 0
                                const isOpen = expandedInnate === spell.key
                                const accentClass = isSpent ? 'border-l-parchment-300' : isAlwaysPrepared ? 'border-l-indigo-400' : 'border-l-green-400'
                                return (
                                  <div key={spell.key} className={`rounded-lg border-l-[3px] border border-parchment-200 transition-colors ${isSpent ? 'opacity-50 bg-parchment-50' : 'bg-parchment-50 hover:bg-parchment-50/60'} ${accentClass}`}>
                                    <button type="button" className="w-full text-left px-3 py-2"
                                      onClick={() => setExpandedInnate(isOpen ? null : spell.key)}>
                                      <div className="flex items-center gap-2">
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className={`font-semibold text-sm ${isSpent ? 'line-through text-parchment-400' : 'text-parchment-900'}`}>{spell.name}</span>
                                            <span className="text-xs bg-parchment-100 text-parchment-500 rounded px-1.5 py-0.5">{spell.source}</span>
                                            {isAlwaysPrepared && <span className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 rounded px-1.5 py-0.5">Always Prepared</span>}
                                            {isAtWill && <span className="text-xs bg-green-50 text-green-700 border border-green-200 rounded px-1.5 py-0.5">At Will</span>}
                                            {hasTracker && <span className={`text-xs rounded px-1.5 py-0.5 border ${isSpent ? 'bg-red-50 text-red-400 border-red-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>{usesLeft}/{usesMax} / LR</span>}
                                            {def?.savingThrow && (() => {
                                              const dc = totalSpellDC(spellClassSlug ?? 'wizard')
                                              return <span className="text-xs bg-violet-50 text-violet-700 border border-violet-200 rounded px-1.5 py-0.5 font-semibold">{def.savingThrow.ability.toUpperCase()} save · DC {dc}</span>
                                            })()}
                                            {def?.attackRoll && (() => {
                                              const atk = totalSpellAtk(spellClassSlug ?? 'wizard')
                                              return <span className="text-xs bg-violet-50 text-violet-700 border border-violet-200 rounded px-1.5 py-0.5 font-semibold">{atk >= 0 ? '+' : ''}{atk} to hit</span>
                                            })()}
                                            {dmg && <span className="text-xs font-mono bg-red-50 text-red-700 border border-red-200 rounded px-1.5 py-0.5">{dmg.dice}{dmg.type ? ` ${dmg.type}` : ''}</span>}
                                          </div>
                                          {def && <div className="text-xs text-parchment-400 mt-0.5">{def.castingTime} · {def.range} · {def.duration}</div>}
                                        </div>
                                        <span className="text-parchment-300 text-xs shrink-0">{isOpen ? '▲' : '▼'}</span>
                                      </div>
                                    </button>
                                    {isOpen && (
                                      <div className="px-3 pb-3 border-t border-parchment-100 pt-2.5 space-y-2">
                                        {def && (
                                          <SpellStatBlock
                                            spell={def}
                                            saveDc={def.savingThrow ? totalSpellDC(spellClassSlug ?? 'wizard') : undefined}
                                            attackBonus={def.attackRoll ? totalSpellAtk(spellClassSlug ?? 'wizard') : undefined}
                                          />
                                        )}
                                        {def?.description && (
                                          <p className="text-sm text-parchment-700 leading-relaxed whitespace-pre-line">{def.description}</p>
                                        )}
                                        {hasTracker && (
                                          <div className="flex gap-1.5 pt-1">
                                            <button className="text-xs px-3 py-1.5 rounded border bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100 disabled:opacity-40 transition-colors font-semibold" disabled={isSpent}
                                              onClick={() => patch({ freeSpellUses: { ...char.freeSpellUses, [spell.key]: (char.freeSpellUses?.[spell.key] ?? 0) + 1 } })}
                                            >Use Free ({usesLeft}/{usesMax} LR)</button>
                                            {(char.freeSpellUses?.[spell.key] ?? 0) > 0 && (
                                              <button className="text-xs px-2.5 py-1.5 rounded border border-parchment-200 text-parchment-400 hover:text-blue-600 hover:border-blue-300 transition-colors"
                                                onClick={() => patch({ freeSpellUses: { ...char.freeSpellUses, [spell.key]: Math.max(0, (char.freeSpellUses?.[spell.key] ?? 0) - 1) } })}
                                              >Restore</button>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* ── Spell Library toggle button ── */}
                <button
                  type="button"
                  onClick={() => { setShowSpellLibrary(v => !v); setBrowserSelectedSpell(null) }}
                  className={`w-full py-2 rounded-lg border text-sm font-semibold transition-colors ${
                    showSpellLibrary
                      ? 'bg-dungeon-900 border-dungeon-900 text-parchment-100'
                      : 'bg-parchment-50 border-parchment-300 text-parchment-600 hover:border-parchment-500 hover:text-parchment-900'
                  }`}
                >
                  {showSpellLibrary ? '▲ Close Spell Library' : `▼ ${isPrepared ? 'Prepare Spells' : 'Learn Spells'}`}
                </button>

                {/* ── Spell Library (available to learn/prepare) ── */}
                {showSpellLibrary && (() => {
                  const availLevels = [1,2,3,4,5,6,7,8,9].filter(l => availableSpells.some(s => s.level === l))
                  const activeLib = spellBrowserLevel !== null && availLevels.includes(spellBrowserLevel)
                    ? spellBrowserLevel
                    : availLevels[0] ?? 0
                  const libTabSpells = availableSpells.filter(s => s.level === activeLib)
                  const libFiltered = spellBrowserSearch
                    ? libTabSpells.filter(s => s.name.toLowerCase().includes(spellBrowserSearch.toLowerCase()) || s.school.toLowerCase().includes(spellBrowserSearch.toLowerCase()))
                    : libTabSpells
                  return (
                    <div className="card">
                      <div className="flex items-center justify-between mb-3">
                        <h2 className="text-sm font-bold text-parchment-700 uppercase tracking-wider">Spell Library</h2>
                        <span className="text-xs text-parchment-400">Click to expand · add to your spells</span>
                      </div>
                      {/* Level tabs */}
                      <div className="flex gap-1.5 flex-wrap mb-3">
                        {availLevels.map(lvl => {
                          const isActive = lvl === activeLib
                          return (
                            <button key={lvl} type="button"
                              onClick={() => { setSpellBrowserLevel(lvl); setBrowserSelectedSpell(null) }}
                              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors border ${
                                isActive
                                  ? 'bg-dungeon-900 text-parchment-100 border-dungeon-900'
                                  : 'border-parchment-200 text-parchment-600 hover:border-parchment-400'
                              }`}
                            >{ordinals[lvl]}</button>
                          )
                        })}
                        <input
                          className="input text-sm py-1 ml-auto w-36"
                          placeholder="Search…"
                          value={spellBrowserSearch}
                          onChange={e => { setSpellBrowserSearch(e.target.value); setBrowserSelectedSpell(null) }}
                        />
                      </div>
                      <div className="text-xs text-parchment-400 mb-2">{libTabSpells.length} spells available at this level</div>
                      {/* Spell list */}
                      <div className="space-y-1 max-h-[30rem] overflow-y-auto pr-1">
                        {libFiltered.map(s => {
                          const rawDmg = s.damage ?? null
                          const libDmgStyle = rawDmg?.type ? (DAMAGE_TYPE_STYLE[rawDmg.type] ?? DAMAGE_TYPE_STYLE.force) : null
                          const libAoE = extractAoE(s.range)
                          const libUpcast = (s.level > 0 && s.higherLevels) ? parseUpcastScaling(s.higherLevels) : null
                          const isOpen = browserSelectedSpell === s.slug
                          return (
                            <div key={s.slug}
                              ref={isOpen ? (el) => { if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }) } : undefined}
                              style={{ borderLeftColor: isOpen ? '#8b5cf6' : schoolBorderColor(s.school) }}
                              className={`rounded-lg border-l-[3px] border ${isOpen ? 'border-violet-200 bg-violet-50' : 'border-parchment-100 bg-parchment-50 hover:bg-parchment-50/50'} transition-colors`}
                            >
                              <button type="button" className="w-full text-left px-3 py-2.5"
                                onClick={() => setBrowserSelectedSpell(isOpen ? null : s.slug)}>
                                <div className="flex items-start gap-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className={`font-semibold text-sm ${isOpen ? 'text-violet-800' : 'text-parchment-900'}`}>{s.name}</span>
                                      {s.concentration && <span className="text-xs bg-amber-100 text-amber-800 border border-amber-400 rounded px-1.5 py-0.5 font-semibold">Conc.</span>}
                                      {s.ritual && <span className="text-xs bg-blue-50 text-blue-600 border border-blue-200 rounded px-1.5 py-0.5">Ritual</span>}
                                      {s.savingThrow && (() => {
                                        const dc = totalSpellDC(spellClassSlug)
                                        return <span className="text-xs bg-violet-50 text-violet-700 border border-violet-200 rounded px-1.5 py-0.5 font-semibold">{s.savingThrow.ability.toUpperCase()} save · DC {dc}</span>
                                      })()}
                                      {s.attackRoll && (() => {
                                        const atk = totalSpellAtk(spellClassSlug)
                                        return <span className="text-xs bg-violet-50 text-violet-700 border border-violet-200 rounded px-1.5 py-0.5 font-semibold">{atk >= 0 ? '+' : ''}{atk} to hit</span>
                                      })()}
                                      {rawDmg && (
                                        <span className={`text-xs px-1.5 py-0.5 rounded border ${libDmgStyle ? `${libDmgStyle.bg} ${libDmgStyle.text} ${libDmgStyle.border}` : 'bg-red-100 text-red-800 border-red-300'}`}>
                                          {rawDmg.dice}{rawDmg.type ? ` ${rawDmg.type}` : ''}
                                        </span>
                                      )}
                                      {libAoE && rawDmg && (
                                        <span className="text-xs bg-parchment-100 text-parchment-600 border border-parchment-300 rounded px-1.5 py-0.5">{libAoE}</span>
                                      )}
                                      {libUpcast && (
                                        <span className="text-xs bg-violet-50 text-violet-700 border border-violet-200 rounded px-1.5 py-0.5">↑+{libUpcast.dice}/lvl</span>
                                      )}
                                    </div>
                                    <div className="text-xs text-parchment-400 mt-0.5">{s.castingTime} · {s.range} · {s.duration} · <span className="italic">{s.school}</span></div>
                                  </div>
                                  <span className="text-parchment-300 text-xs shrink-0 mt-0.5">{isOpen ? '▲' : '▼'}</span>
                                </div>
                              </button>
                              {isOpen && (
                                <div className="px-3 pb-3 border-t border-violet-100 pt-2.5 space-y-2">
                                  <SpellStatBlock
                                    spell={s}
                                    saveDc={s.savingThrow ? totalSpellDC(spellClassSlug) : undefined}
                                    attackBonus={s.attackRoll ? totalSpellAtk(spellClassSlug) : undefined}
                                  />
                                  {s.description && (
                                    <p className="text-sm text-parchment-700 leading-relaxed whitespace-pre-line">
                                      {s.description}
                                    </p>
                                  )}
                                  {s.higherLevels && (() => {
                                    const slotOrdinals = ['1st','2nd','3rd','4th','5th','6th','7th','8th','9th']
                                    const availSlots = [1,2,3,4,5,6,7,8,9].filter(lvl => {
                                      if (lvl <= s.level) return false
                                      const max = multiclassMaxes ? (multiclassMaxes[String(lvl)] ?? 0) : (char.spellSlots[String(lvl)]?.max ?? 0)
                                      return max > 0
                                    })
                                    const showTable = libUpcast && rawDmg && availSlots.length > 0
                                    return (
                                      <div className="border-t border-violet-100 pt-2 space-y-2">
                                        <div className="text-xs font-semibold text-parchment-700 uppercase tracking-wide">At Higher Levels</div>
                                        {showTable && (
                                          <div className="flex flex-wrap gap-1.5">
                                            <div className="flex flex-col items-center px-2 py-1 rounded border border-parchment-200 bg-parchment-50 text-xs">
                                              <span className="text-parchment-400">{slotOrdinals[s.level - 1]}</span>
                                              <span className="font-semibold text-parchment-700">{rawDmg!.dice}{rawDmg!.type ? ` ${rawDmg!.type}` : ''}</span>
                                            </div>
                                            {availSlots.map(lvl => {
                                              const total = computeUpcastDamage(rawDmg!.dice, libUpcast!.dice, lvl - s.level)
                                              return (
                                                <div key={lvl} className="flex flex-col items-center px-2 py-1 rounded border border-violet-200 bg-violet-50 text-xs">
                                                  <span className="text-violet-400">{slotOrdinals[lvl - 1]}</span>
                                                  <span className="font-semibold text-violet-800">{total ?? `+${libUpcast!.dice}`}{rawDmg!.type ? ` ${rawDmg!.type}` : ''}</span>
                                                </div>
                                              )
                                            })}
                                          </div>
                                        )}
                                        <p className="text-xs italic text-parchment-500 whitespace-pre-line">{cleanHigherLevels(s.higherLevels)}</p>
                                      </div>
                                    )
                                  })()}
                                  <div className="pt-1 flex items-center gap-3 flex-wrap">
                                    {isSpellbookCaster ? (
                                      <>
                                        <button type="button"
                                          className="px-4 py-1.5 rounded font-semibold text-sm transition-colors bg-amber-600 text-white hover:bg-amber-700"
                                          onClick={() => {
                                            patch({ spells: [...char.spells, { spellSlug: s.slug, name: s.name, classSlug: spellClassSlug ?? primarySlug, prepared: false, isHomebrew: s.source.site === 'homebrew' }] })
                                            setBrowserSelectedSpell(null)
                                          }}
                                        >Add to Spellbook</button>
                                        <button type="button"
                                          disabled={atPrepCap}
                                          className="px-4 py-1.5 rounded font-semibold text-sm transition-colors bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed"
                                          onClick={() => {
                                            patch({ spells: [...char.spells, { spellSlug: s.slug, name: s.name, classSlug: spellClassSlug ?? primarySlug, prepared: true, isHomebrew: s.source.site === 'homebrew' }] })
                                            setBrowserSelectedSpell(null)
                                          }}
                                        >Prepare Directly</button>
                                        {atPrepCap && <span className="text-xs text-amber-600">Prep limit reached ({prepLimit})</span>}
                                      </>
                                    ) : (
                                      <>
                                        <button type="button"
                                          disabled={atPrepCap}
                                          className="px-4 py-1.5 rounded font-semibold text-sm transition-colors bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed"
                                          onClick={() => {
                                            patch({ spells: [...char.spells, { spellSlug: s.slug, name: s.name, classSlug: spellClassSlug ?? primarySlug, prepared: true, isHomebrew: s.source.site === 'homebrew' }] })
                                            setBrowserSelectedSpell(null)
                                          }}
                                        >{isPrepared ? 'Prepare' : 'Learn'}</button>
                                        {atPrepCap && <span className="text-xs text-amber-600">Prep limit reached ({prepLimit})</span>}
                                      </>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })}
                        {libFiltered.length === 0 && (
                          <p className="text-sm text-parchment-400 text-center py-8">
                            {libTabSpells.length === 0 ? 'All spells at this level have been added.' : `No spells match "${spellBrowserSearch}"`}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })()}
              </>
            )
          })() : (
            <p className="text-parchment-400">This character doesn't have a spellcasting class.</p>
          )}
        </div>
      )}

      {/* Inventory Tab */}
      {tab === 'inventory' && (
        <div>
          {/* Top row: Currency + Attunement */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
            {/* Currency */}
            {(() => {
              const COIN_DOT: Record<string, string> = {
                cp: 'bg-amber-600', sp: 'bg-slate-400', ep: 'bg-cyan-500',
                gp: 'bg-yellow-400', pp: 'bg-purple-300',
              }
              return (
              <div className="card p-3">
                <div className="text-xs font-bold text-parchment-500 uppercase tracking-wider mb-3">Currency</div>
                <div className="flex justify-between">
                  {(['cp', 'sp', 'ep', 'gp', 'pp'] as const).map(coin => (
                    <div key={coin} className="flex flex-col items-center gap-1">
                      <div className={`w-2.5 h-2.5 rounded-full ${COIN_DOT[coin]}`} />
                      <input
                        type="number"
                        min={0}
                        className="input-coin font-semibold"
                        style={{ width: `calc(${Math.max(3, String(char.currency[coin]).length)}ch + 1rem)` }}
                        value={char.currency[coin]}
                        onChange={e => patch({ currency: { ...char.currency, [coin]: parseInt(e.target.value, 10) || 0 } })}
                      />
                      <div className="text-xs text-parchment-400 font-medium">{coin.toUpperCase()}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-2 border-t border-parchment-200 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={1}
                      placeholder="Amount"
                      className="input-coin"
                      style={{ width: `calc(${Math.max(8, txAmount.length || 0)}ch + 1rem)` }}
                      value={txAmount}
                      onChange={e => setTxAmount(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          const n = parseInt(txAmount, 10)
                          if (!n || n <= 0) return
                          patch({ currency: { ...char.currency, [txCoin]: char.currency[txCoin] + n } })
                          setTxAmount('')
                        }
                      }}
                    />
                    <div className="flex gap-1">
                      {(['cp', 'sp', 'ep', 'gp', 'pp'] as const).map(coin => (
                        <button
                          key={coin}
                          className={`w-8 h-7 text-xs rounded font-semibold border transition-colors ${txCoin === coin ? 'bg-parchment-600 text-parchment-50 border-parchment-600' : 'bg-parchment-100 text-parchment-600 border-parchment-300 hover:bg-parchment-200'}`}
                          onClick={() => setTxCoin(coin)}
                        >{coin.toUpperCase()}</button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="flex-1 py-1.5 text-xs rounded font-semibold bg-green-700 text-white hover:bg-green-800 active:bg-green-900 transition-colors disabled:opacity-40"
                      disabled={!txAmount || parseInt(txAmount, 10) <= 0}
                      onClick={() => {
                        const n = parseInt(txAmount, 10)
                        if (!n || n <= 0) return
                        patch({ currency: { ...char.currency, [txCoin]: char.currency[txCoin] + n } })
                        setTxAmount('')
                      }}
                    >+ Add</button>
                    <button
                      className="flex-1 py-1.5 text-xs rounded font-semibold bg-red-700 text-white hover:bg-red-800 active:bg-red-900 transition-colors disabled:opacity-40"
                      disabled={!txAmount || parseInt(txAmount, 10) <= 0}
                      onClick={() => {
                        const n = parseInt(txAmount, 10)
                        if (!n || n <= 0) return
                        patch({ currency: { ...char.currency, [txCoin]: Math.max(0, char.currency[txCoin] - n) } })
                        setTxAmount('')
                      }}
                    >− Spend</button>
                  </div>
                  {/* Convert down */}
                  <div className="pt-2 border-t border-parchment-200">
                    <div className="text-xs text-parchment-400 mb-1.5">Break into smaller coins</div>
                    <div className="flex flex-wrap gap-1.5">
                      {([
                        { from: 'pp', to: 'gp', rate: 10, label: '1 pp → 10 gp' },
                        { from: 'gp', to: 'sp', rate: 10, label: '1 gp → 10 sp' },
                        { from: 'ep', to: 'sp', rate: 5,  label: '1 ep → 5 sp'  },
                        { from: 'sp', to: 'cp', rate: 10, label: '1 sp → 10 cp' },
                      ] as const).map(({ from, to, rate, label }) => (
                        <button
                          key={label}
                          disabled={char.currency[from] < 1}
                          className="px-2 py-1 text-xs rounded border border-parchment-300 bg-parchment-50 text-parchment-600 hover:bg-parchment-100 disabled:opacity-30 transition-colors"
                          onClick={() => patch({ currency: { ...char.currency, [from]: char.currency[from] - 1, [to]: char.currency[to] + rate } })}
                        >{label}</button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              )
            })()}

            {/* Attunement */}
            <div className="card p-3">
              <div className="text-xs font-bold text-parchment-500 uppercase tracking-wider mb-2">Attunement</div>
              <div className="flex items-center gap-3">
                <span className={`text-2xl font-bold ${attuned >= 3 ? 'text-red-600' : 'text-parchment-800'}`}>{attuned}</span>
                <span className="text-parchment-300 text-lg">/</span>
                <span className="text-2xl font-semibold text-parchment-400">3</span>
                <div className="flex gap-1.5 ml-2">
                  {[0,1,2].map(i => {
                    const filled = i < attuned
                    const full = attuned >= 3
                    return (
                      <div
                        key={i}
                        className={`w-4 h-4 rotate-45 border-2 ${
                          filled
                            ? full ? 'bg-red-500 border-red-400' : 'bg-indigo-500 border-indigo-400'
                            : 'border-parchment-300 bg-transparent'
                        }`}
                        style={filled ? {
                          animation: `${full ? 'attune-full' : 'attune-pulse'} 3.5s ease-in-out infinite`,
                        } : {
                          transition: 'all 0.2s ease',
                        }}
                      />
                    )
                  })}
                </div>
              </div>
              {(() => {
                const attunedItems = char.equipment.filter(e => e.attuned)
                return attunedItems.length > 0 ? (
                  <ul className="mt-2 space-y-0.5">
                    {attunedItems.map((item, i) => (
                      <li key={i} className="text-xs text-indigo-700 flex items-center gap-1">
                        <span className="text-indigo-400">✦</span>{item.name}
                      </li>
                    ))}
                  </ul>
                ) : null
              })()}
              {attuned >= 3 && <p className="text-xs text-red-500 mt-1">Maximum reached</p>}
            </div>


          </div>{/* end top row grid */}

          {/* ── Equipment Sections ── */}
          {(() => {
            // Common items list for Other section
            const COMMON_GEAR: { cat: string; items: string[] }[] = [
              { cat: 'Adventuring', items: ['Backpack','Bedroll','Blanket','Candle','Chalk','Crowbar','Grappling Hook','Hammer','Hooded Lantern','Oil (flask)','Rations (1 day)','Rope, hempen (50ft)','Rope, silk (50ft)','Sack','Shovel','Signal Whistle','Soap','Tinderbox','Torch','Waterskin','Whetstone'] },
              { cat: 'Tools', items: ["Thieves' Tools","Healer's Kit","Herbalism Kit","Disguise Kit","Poisoner's Kit","Navigator's Tools"] },
              { cat: 'General', items: ['Pouch','Vial','Mirror (steel)','Spyglass','Magnifying Glass','Spellbook','Book','Ink & Pen','Parchment','Sealing Wax'] },
              { cat: 'Consumables', items: ['Antitoxin','Acid (vial)',"Alchemist's Fire",'Holy Water (flask)','Smoke Bomb','Thunderstone'] },
            ]

            const CONSUMABLE_DATA: Record<string, { badge: string; badgeColor: string; text: string }> = {
              'Potion of Healing':           { badge: '2d4+2 HP',    badgeColor: 'bg-rose-100 text-rose-700',    text: 'Drink to regain 2d4+2 hit points. Takes an action to drink yourself, or a bonus action if someone else administers it.' },
              'Potion of Greater Healing':   { badge: '4d4+4 HP',    badgeColor: 'bg-rose-100 text-rose-700',    text: 'Drink to regain 4d4+4 hit points. Takes an action to drink yourself, or a bonus action if someone else administers it.' },
              'Potion of Superior Healing':  { badge: '8d4+8 HP',    badgeColor: 'bg-rose-200 text-rose-800',    text: 'Drink to regain 8d4+8 hit points. Takes an action to drink yourself, or a bonus action if someone else administers it.' },
              'Potion of Supreme Healing':   { badge: '10d4+20 HP',  badgeColor: 'bg-rose-300 text-rose-900',    text: 'Drink to regain 10d4+20 hit points. Takes an action to drink yourself, or a bonus action if someone else administers it.' },
              'Antitoxin':                   { badge: 'vs Poison',   badgeColor: 'bg-green-100 text-green-700',  text: 'Advantage on saving throws against poison for 1 hour. Not magical — works even inside an antimagic field.' },
              'Acid (vial)':                 { badge: '2d6 acid',    badgeColor: 'bg-yellow-100 text-yellow-700',text: 'Action: throw up to 20 ft. On hit, 2d6 acid damage. Treat as improvised weapon.' },
              "Alchemist's Fire":            { badge: '1d4 fire/rnd',badgeColor: 'bg-orange-100 text-orange-700',text: 'Action: throw up to 20 ft. On hit, 1d4 fire damage at the start of each of the target\'s turns until extinguished. DC 10 Dexterity (action) to put out.' },
              'Holy Water (flask)':          { badge: '2d6 radiant', badgeColor: 'bg-yellow-50 text-yellow-700', text: 'Action: throw up to 20 ft. On hit, 2d6 radiant damage to fiends and undead only.' },
              'Potion of Climbing':          { badge: '1 hour',      badgeColor: 'bg-teal-100 text-teal-700',    text: 'Gain a climbing speed equal to your walking speed and advantage on Strength (Athletics) checks to climb for 1 hour.' },
              'Potion of Water Breathing':   { badge: '1 hour',      badgeColor: 'bg-teal-100 text-teal-700',    text: 'Breathe underwater for 1 hour.' },
              'Potion of Fire Resistance':   { badge: '1 hour',      badgeColor: 'bg-orange-100 text-orange-700',text: 'Resistance to fire damage for 1 hour.' },
              'Potion of Animal Friendship': { badge: 'DC 13 · 24 hr',badgeColor: 'bg-green-100 text-green-700', text: 'Cast Animal Friendship targeting one beast (DC 13 Wisdom save) for 24 hours.' },
              'Potion of Heroism':           { badge: '10 temp HP',  badgeColor: 'bg-amber-100 text-amber-700',  text: 'Gain 10 temporary hit points for 1 hour. While they last, you are also under the Bless effect — add 1d4 to attack rolls and saving throws.' },
              'Potion of Speed':             { badge: 'Haste · 1 min',badgeColor: 'bg-cyan-100 text-cyan-700',   text: 'Under the effect of Haste for 1 minute (no concentration). Double speed, +2 AC, advantage on Dex saves, and one additional attack on the Attack action.' },
              'Potion of Invisibility':      { badge: '1 hour',      badgeColor: 'bg-slate-100 text-slate-600',  text: 'Become invisible for 1 hour. Attacking or casting a spell ends the invisibility immediately.' },
              'Potion of Flying':            { badge: '60 ft · 1 hr',badgeColor: 'bg-sky-100 text-sky-700',      text: 'Gain a flying speed of 60 feet for 1 hour. If the effect ends while airborne, you fall.' },
              'Potion of Mind Reading':      { badge: 'DC 13 · 1 min',badgeColor: 'bg-violet-100 text-violet-700',text: 'Cast Detect Thoughts (DC 13 Wisdom save) for 1 minute with no concentration required.' },
              'Potion of Poison':            { badge: '3d6 poison',  badgeColor: 'bg-green-200 text-green-900',  text: 'Looks like a Potion of Healing. Drinking it: DC 13 Constitution save or 3d6 poison damage and poisoned for 24 hours (half damage on success, not poisoned).' },
              'Smoke Bomb':                  { badge: '20 ft cloud', badgeColor: 'bg-slate-100 text-slate-600',  text: 'Action: throw up to 20 ft. Creates a 20-foot-radius sphere of opaque smoke for 1 minute. Heavily obscured. A strong wind disperses it.' },
              'Thunderstone':                { badge: '2d6 thunder', badgeColor: 'bg-indigo-100 text-indigo-700',text: 'Action: throw up to 20/60 ft. On hit, 2d6 thunder damage and target is deafened until end of its next turn (DC 13 Constitution save negates deafen).' },
            }

            // Classify items into D&D 5e type categories
            type ItemCat = 'armor' | 'potion' | 'ring' | 'rod' | 'scroll' | 'staff' | 'wand' | 'weapon' | 'wondrous' | 'gear'
            const catOf = (item: typeof char.equipment[0]): ItemCat => {
              if (resolveWeapon(item, content.items)) return 'weapon'
              if (resolveArmor(item, content.items)) return 'armor'
              const def = content.items.find(i => i.slug === item.itemSlug && i.name)
              if (!def) return 'gear'
              if (def.type === 'Potion') return 'potion'
              if (def.type === 'Ring') return 'ring'
              const n = item.name.toLowerCase()
              if (/^rod\b/.test(n)) return 'rod'
              if (/^scroll\b/.test(n)) return 'scroll'
              if (/^staff\b/.test(n)) return 'staff'
              if (/^wand\b/.test(n)) return 'wand'
              return 'wondrous'
            }
            const CAT_KEYS: ItemCat[] = ['armor','potion','ring','rod','scroll','staff','wand','weapon','wondrous','gear']
            const grouped = Object.fromEntries(CAT_KEYS.map(c => [c, [] as {item: typeof char.equipment[0]; idx: number}[]])) as Record<ItemCat, {item: typeof char.equipment[0]; idx: number}[]>
            char.equipment.forEach((item, idx) => grouped[catOf(item)].push({ item, idx }))
            const weapons = grouped.weapon.map(({ item, idx }) => ({ item, idx, ws: resolveWeapon(item, content.items)! }))
            const armors  = grouped.armor.map(({ item, idx }) => ({ item, idx, as_: resolveArmor(item, content.items)! }))

            // Armor enforcement: only one armor piece at a time (not shields)
            const equipArmor = (idx: number) => {
              const eq = char.equipment.map((item, i) => {
                const as_ = resolveArmor(item, content.items)
                if (i === idx) return { ...item, equipped: true }
                // Unequip other non-shield armors
                if (as_ && as_.type !== 'shield') return { ...item, equipped: false }
                return item
              })
              patch({ equipment: eq })
            }

            // Slot-aware weapon / shield equip
            const implementHandedness = (item: typeof char.equipment[0]): '1h' | '2h' | null => {
              const n = item.name.toLowerCase()
              if (/^staff\b/.test(n)) return '2h'
              if (/^rod\b/.test(n) || /^wand\b/.test(n)) return '1h'
              return null
            }

            const equipWeapon = (idx: number, slot: 'main' | 'off') => {
              const clickedWs = resolveWeapon(char.equipment[idx], content.items)
              const current = char.equipment[idx]
              const isTwoHanded = clickedWs?.twoHanded ?? false
              const isLight = clickedWs?.light ?? false
              const currentSlot = current.slot
              const canDual = isLight && !isTwoHanded && current.quantity >= 2
              const actualSlot: 'main' | 'off' | 'both' | 'dual' = isTwoHanded ? 'both'
                : canDual && current.equipped && ((slot === 'off' && currentSlot === 'main') || (slot === 'main' && currentSlot === 'off')) ? 'dual'
                : slot
              const eq = char.equipment.map((item, i) => {
                if (i === idx) return { ...item, equipped: true, slot: actualSlot }
                const ws = resolveWeapon(item, content.items)
                const as_ = resolveArmor(item, content.items)
                const ih = implementHandedness(item)
                if (!item.equipped || (!ws && as_?.type !== 'shield' && ih === null)) return item
                const iSlot = item.slot
                if (actualSlot === 'both' || actualSlot === 'dual') return { ...item, equipped: false, slot: undefined }
                if (actualSlot === 'main' && (iSlot === 'main' || iSlot === 'both' || iSlot === 'dual' || (!iSlot && !!ws))) return { ...item, equipped: false, slot: undefined }
                if (actualSlot === 'off' && (iSlot === 'off' || iSlot === 'both' || iSlot === 'dual' || (as_?.type === 'shield' && !iSlot))) return { ...item, equipped: false, slot: undefined }
                return item
              })
              patch({ equipment: eq })
            }

            const equipImplement = (idx: number, slot: 'main' | 'off') => {
              const isTwoHanded = implementHandedness(char.equipment[idx]) === '2h'
              const actualSlot: 'main' | 'off' | 'both' = isTwoHanded ? 'both' : slot
              const eq = char.equipment.map((item, i) => {
                if (i === idx) return { ...item, equipped: true, slot: actualSlot }
                if (!item.equipped) return item
                const ws = resolveWeapon(item, content.items)
                const as_ = resolveArmor(item, content.items)
                const ih = implementHandedness(item)
                if (!ws && as_?.type !== 'shield' && ih === null) return item
                const iSlot = item.slot
                if (actualSlot === 'both') return { ...item, equipped: false, slot: undefined }
                if (actualSlot === 'main' && (iSlot === 'main' || iSlot === 'both' || iSlot === 'dual' || (!iSlot && !!ws))) return { ...item, equipped: false, slot: undefined }
                if (actualSlot === 'off' && (iSlot === 'off' || iSlot === 'both' || iSlot === 'dual' || (as_?.type === 'shield' && !iSlot))) return { ...item, equipped: false, slot: undefined }
                return item
              })
              patch({ equipment: eq })
            }

            const itemRow = ({ item, idx, badge, badgeColor, descriptionText, showAttune, consumable }: {
              item: typeof char.equipment[0]; idx: number; badge?: string | null; badgeColor?: string; descriptionText?: string | null; showAttune?: boolean; consumable?: boolean
            }) => {
              const isExpanded = expandedInventoryItem === idx
              const def = content.items.find(i => i.slug === item.itemSlug)
              const rarity = def?.rarity?.toLowerCase() ?? ''
              const needsAttunement = showAttune || item.attuned
              const ws = resolveWeapon(item, content.items)
              const as_ = resolveArmor(item, content.items)
              const isArmorPiece = !!as_ && as_.type !== 'shield'
              const isWeaponOrShield = !!ws || as_?.type === 'shield'

              const rarityAccent =
                rarity === 'uncommon'  ? 'border-l-green-400'  :
                rarity === 'rare'      ? 'border-l-blue-400'   :
                rarity === 'very rare' ? 'border-l-violet-500' :
                rarity === 'legendary' ? 'border-l-amber-500'  :
                rarity === 'artifact'  ? 'border-l-orange-500' : 'border-l-transparent'
              const rarityTextClass =
                rarity === 'uncommon'  ? 'text-green-600'  :
                rarity === 'rare'      ? 'text-blue-600'   :
                rarity === 'very rare' ? 'text-violet-600' :
                rarity === 'legendary' ? 'text-amber-600'  :
                rarity === 'artifact'  ? 'text-orange-600' : ''

              const unequipItem = () => { const eq=[...char.equipment]; eq[idx]={...eq[idx],equipped:false,slot:undefined}; patch({equipment:eq}) }

              const handleEquip = () => {
                if (item.equipped) {
                  unequipItem()
                } else if (isArmorPiece) {
                  equipArmor(idx)
                } else {
                  const eq = [...char.equipment]; eq[idx] = { ...eq[idx], equipped: !item.equipped }; patch({ equipment: eq })
                }
              }

              return (
                <div
                  key={idx}
                  ref={isExpanded ? el => { if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }) } : undefined}
                  className={`rounded-lg overflow-hidden border-l-4 ${rarityAccent} transition-all ${
                    isExpanded ? 'border border-parchment-300 shadow-sm' : 'border border-parchment-100 hover:border-parchment-300 hover:shadow-sm'
                  } ${item.equipped ? 'bg-green-50/50' : ''}`}
                >
                  <button type="button" className="w-full text-left px-3 py-2.5 flex items-start gap-2.5"
                    onClick={() => setExpandedInventoryItem(isExpanded ? null : idx)}>
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-sm text-parchment-900 leading-snug">{item.name}</span>
                        {item.attuned && <span className="text-[11px] text-indigo-500 shrink-0">✦</span>}
                        {item.quantity > 1 && (
                          <span className="text-[11px] bg-parchment-100 text-parchment-500 px-1.5 py-0.5 rounded-full font-medium shrink-0">×{item.quantity}</span>
                        )}
                        {item.chargesMax !== undefined && (
                          <span className="text-[11px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full font-medium shrink-0">{item.charges ?? item.chargesMax}/{item.chargesMax}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {rarity && <span className={`text-[10px] font-bold uppercase tracking-wide ${rarityTextClass}`}>{rarity.charAt(0).toUpperCase() + rarity.slice(1)}</span>}
                        {item.equipped && <span className="text-[10px] font-bold text-green-600">● Equipped</span>}
                      </div>
                    </div>
                    {badge && (
                      <span className={`text-xs font-bold rounded-md px-2 py-1 shrink-0 self-start mt-0.5 ${badgeColor ?? 'bg-parchment-100 text-parchment-600'}`}>{badge}</span>
                    )}
                    <span className="text-parchment-300 text-[10px] shrink-0 self-center">{isExpanded ? '▲' : '▼'}</span>
                  </button>

                  {isExpanded && (
                    <div className="px-3 pb-3 border-t border-parchment-100 pt-2.5 space-y-2.5">
                      {ws && (
                        <WeaponStatBlock
                          ws={ws}
                          attackBonus={weaponAttackBonus(char, ws, pb, magicBonus(item.name))}
                          damageMod={weaponDamageMod(char, ws, magicBonus(item.name))}
                          magicBonus={magicBonus(item.name)}
                        />
                      )}
                      {as_ && !ws && (
                        <ArmorStatBlock
                          as_={as_}
                          computedAC={as_.type === 'light' ? as_.acBase + abilityModFor(char, 'dex') + magicBonus(item.name)
                            : as_.type === 'medium' ? as_.acBase + Math.min(abilityModFor(char, 'dex'), 2) + magicBonus(item.name)
                            : as_.type === 'heavy' ? as_.acBase + magicBonus(item.name) || undefined
                            : undefined}
                        />
                      )}
                      {def && (
                        <MagicItemStatBlock
                          def={def}
                          attuned={item.attuned}
                          attunedCount={attuned}
                        />
                      )}
                      {descriptionText
                        ? <p className="text-sm text-parchment-700 leading-relaxed whitespace-pre-line">{descriptionText}</p>
                        : <p className="text-xs text-parchment-400">No description. Add notes below.</p>}
                      <div className="flex items-center gap-2 flex-wrap">
                        {consumable && (
                          <button type="button"
                            className="px-2.5 py-1 rounded border text-xs font-semibold transition-colors bg-amber-500 text-white border-amber-500 hover:bg-amber-600 hover:border-amber-600"
                            onClick={() => {
                              if (item.quantity <= 1) {
                                patch({ equipment: char.equipment.filter((_, i) => i !== idx) })
                                setExpandedInventoryItem(null)
                              } else {
                                const eq = [...char.equipment]; eq[idx] = { ...eq[idx], quantity: item.quantity - 1 }; patch({ equipment: eq })
                              }
                            }}
                          >Use {item.quantity > 1 ? `(${item.quantity} left)` : '(last one)'}</button>
                        )}
                        {isWeaponOrShield ? (
                          ws?.twoHanded ? (
                            <button type="button"
                              className={`px-2.5 py-1 rounded border text-xs font-semibold transition-colors ${item.equipped ? 'bg-green-600 text-white border-green-600' : 'border-parchment-300 text-parchment-600 hover:border-green-500 hover:text-green-700'}`}
                              onClick={() => item.equipped ? unequipItem() : equipWeapon(idx, 'main')}
                            >{item.equipped ? '✓ Two-Handed' : 'Two-Handed'}</button>
                          ) : as_?.type === 'shield' ? (
                            <button type="button"
                              className={`px-2.5 py-1 rounded border text-xs font-semibold transition-colors ${item.equipped ? 'bg-green-600 text-white border-green-600' : 'border-parchment-300 text-parchment-600 hover:border-green-500 hover:text-green-700'}`}
                              onClick={() => item.equipped ? unequipItem() : equipWeapon(idx, 'off')}
                            >{item.equipped ? '✓ Off Hand' : 'Off Hand'}</button>
                          ) : (() => {
                            const isDual = item.slot === 'dual'
                            const inMain = item.equipped && (item.slot === 'main' || isDual)
                            const inOff  = item.equipped && (item.slot === 'off'  || isDual)
                            const canDualWield = ws?.light && item.quantity >= 2
                            return (
                              <>
                                <button type="button"
                                  className={`px-2.5 py-1 rounded border text-xs font-semibold transition-colors ${inMain ? 'bg-green-600 text-white border-green-600' : 'border-parchment-300 text-parchment-600 hover:border-green-500 hover:text-green-700'}`}
                                  onClick={() => {
                                    if (isDual) { const eq=[...char.equipment]; eq[idx]={...eq[idx],slot:'off'}; patch({equipment:eq}) }
                                    else if (inMain) { unequipItem() }
                                    else { equipWeapon(idx, 'main') }
                                  }}
                                >{inMain ? '✓ Main Hand' : 'Main Hand'}</button>
                                <button type="button"
                                  className={`px-2.5 py-1 rounded border text-xs font-semibold transition-colors ${inOff ? 'bg-green-600 text-white border-green-600' : 'border-parchment-300 text-parchment-600 hover:border-green-500 hover:text-green-700'}`}
                                  onClick={() => {
                                    if (isDual) { const eq=[...char.equipment]; eq[idx]={...eq[idx],slot:'main'}; patch({equipment:eq}) }
                                    else if (inOff) { unequipItem() }
                                    else { equipWeapon(idx, 'off') }
                                  }}
                                >{inOff ? '✓ Off Hand' : 'Off Hand'}</button>
                                {canDualWield && item.equipped && !isDual && (
                                  <span className="text-[9px] text-parchment-400 self-center italic">equip both to dual-wield</span>
                                )}
                              </>
                            )
                          })()
                        ) : implementHandedness(item) !== null ? (
                          implementHandedness(item) === '2h' ? (
                            <button type="button"
                              className={`px-2.5 py-1 rounded border text-xs font-semibold transition-colors ${item.equipped ? 'bg-violet-600 text-white border-violet-600' : 'border-parchment-300 text-parchment-600 hover:border-violet-500 hover:text-violet-700'}`}
                              onClick={() => item.equipped ? unequipItem() : equipImplement(idx, 'main')}
                            >{item.equipped ? '✓ Two-Handed' : 'Two-Handed'}</button>
                          ) : (() => {
                            const inMain = item.equipped && (item.slot === 'main' || !item.slot)
                            const inOff  = item.equipped && item.slot === 'off'
                            return (
                              <>
                                <button type="button"
                                  className={`px-2.5 py-1 rounded border text-xs font-semibold transition-colors ${inMain ? 'bg-violet-600 text-white border-violet-600' : 'border-parchment-300 text-parchment-600 hover:border-violet-500 hover:text-violet-700'}`}
                                  onClick={() => inMain ? unequipItem() : equipImplement(idx, 'main')}
                                >{inMain ? '✓ Main Hand' : 'Main Hand'}</button>
                                <button type="button"
                                  className={`px-2.5 py-1 rounded border text-xs font-semibold transition-colors ${inOff ? 'bg-violet-600 text-white border-violet-600' : 'border-parchment-300 text-parchment-600 hover:border-violet-500 hover:text-violet-700'}`}
                                  onClick={() => inOff ? unequipItem() : equipImplement(idx, 'off')}
                                >{inOff ? '✓ Off Hand' : 'Off Hand'}</button>
                              </>
                            )
                          })()
                        ) : isAlwaysWorn(item) ? (
                          // Rings: no equip concept, just attunement
                          <p className="text-xs text-parchment-400 italic">Always worn — attune to activate magical properties.</p>
                        ) : isNonEquippable(item) ? (
                          <p className="text-xs text-parchment-400 italic">Carried — no equipment slot.</p>
                        ) : (() => {
                          const SLOT_META: Record<BodySlotKey, { label: string; active: string; hover: string }> = {
                            helmet:   { label: 'Head',     active: 'bg-slate-600 text-white border-slate-600',   hover: 'hover:border-slate-400 hover:text-slate-700' },
                            eyes:     { label: 'Face',     active: 'bg-sky-600 text-white border-sky-600',       hover: 'hover:border-sky-400 hover:text-sky-700' },
                            amulet:   { label: 'Neck',     active: 'bg-teal-600 text-white border-teal-600',     hover: 'hover:border-teal-400 hover:text-teal-700' },
                            cloak:    { label: 'Back',     active: 'bg-purple-600 text-white border-purple-600', hover: 'hover:border-purple-400 hover:text-purple-700' },
                            robe:     { label: 'Body',     active: 'bg-violet-600 text-white border-violet-600', hover: 'hover:border-violet-400 hover:text-violet-700' },
                            bracers:  { label: 'Arms',     active: 'bg-cyan-600 text-white border-cyan-600',     hover: 'hover:border-cyan-400 hover:text-cyan-700' },
                            gloves:   { label: 'Hands',    active: 'bg-orange-600 text-white border-orange-600', hover: 'hover:border-orange-400 hover:text-orange-700' },
                            belt:     { label: 'Waist',    active: 'bg-yellow-600 text-white border-yellow-600', hover: 'hover:border-yellow-400 hover:text-yellow-700' },
                            boots:    { label: 'Feet',     active: 'bg-stone-600 text-white border-stone-600',   hover: 'hover:border-stone-400 hover:text-stone-700' },
                            backpack: { label: 'Backpack', active: 'bg-amber-600 text-white border-amber-600',   hover: 'hover:border-amber-400 hover:text-amber-700' },
                          }
                          const detected = detectBodySlot(item.name)
                          const wearSlot = (slotKey: BodySlotKey) => {
                            if (item.slot === slotKey) {
                              const eq = [...char.equipment]; eq[idx] = { ...eq[idx], slot: undefined, equipped: false }; patch({ equipment: eq })
                            } else {
                              const eq = char.equipment.map((e, i) => {
                                if (i === idx) return { ...e, slot: slotKey, equipped: true }
                                if (e.slot === slotKey) return { ...e, slot: undefined, equipped: false }
                                return e
                              })
                              patch({ equipment: eq })
                            }
                          }

                          if (detected) {
                            // Single contextual button — item knows its slot
                            const meta = SLOT_META[detected]
                            const isWorn = item.slot === detected
                            return (
                              <button type="button" onClick={() => wearSlot(detected)}
                                className={`px-2.5 py-1 rounded border text-xs font-semibold transition-colors ${isWorn ? meta.active : `border-parchment-300 text-parchment-600 ${meta.hover}`}`}
                              >{isWorn ? `✓ ${meta.label}` : `Wear as ${meta.label}`}</button>
                            )
                          }

                          // Unknown slot type — show Equip + full picker as fallback
                          return (
                            <>
                              <button type="button" onClick={handleEquip}
                                className={`px-2.5 py-1 rounded border text-xs font-semibold transition-colors ${item.equipped && !item.slot ? 'bg-green-600 text-white border-green-600' : 'border-parchment-300 text-parchment-600 hover:border-green-500 hover:text-green-700'}`}
                              >{item.equipped && !item.slot ? '✓ Equipped' : 'Equip'}</button>
                              {(Object.entries(SLOT_META) as [BodySlotKey, typeof SLOT_META[BodySlotKey]][]).map(([key, meta]) => {
                                const isWorn = item.slot === key
                                return (
                                  <button key={key} type="button" onClick={() => wearSlot(key)}
                                    className={`px-2.5 py-1 rounded border text-xs font-semibold transition-colors ${isWorn ? meta.active : `border-parchment-300 text-parchment-600 ${meta.hover}`}`}
                                  >{isWorn ? `✓ ${meta.label}` : meta.label}</button>
                                )
                              })}
                            </>
                          )
                        })()}
                        {needsAttunement && (
                          <button type="button" disabled={!item.attuned && attuned >= 3}
                            onClick={() => { const eq = [...char.equipment]; eq[idx] = { ...eq[idx], attuned: !item.attuned }; patch({ equipment: eq }) }}
                            className={`px-2.5 py-1 rounded border text-xs font-semibold transition-colors disabled:opacity-40 ${item.attuned ? 'bg-indigo-600 text-white border-indigo-600' : 'border-parchment-300 text-parchment-600 hover:border-indigo-400'}`}
                          >{item.attuned ? '✦ Attuned' : '✦ Attune'}</button>
                        )}
                        <div className="flex items-center gap-1 ml-auto">
                          <button type="button" className="w-5 h-5 rounded border border-parchment-200 text-parchment-500 hover:border-parchment-400 text-xs font-bold"
                            onClick={() => { const newQty=Math.max(0,item.quantity-1); const eq=[...char.equipment]; eq[idx]={...eq[idx],quantity:newQty,slot:(item.slot==='dual'&&newQty<2)?'main':item.slot}; patch({equipment:eq}) }}>−</button>
                          <span className="w-6 text-center text-sm">{item.quantity}</span>
                          <button type="button" className="w-5 h-5 rounded border border-parchment-200 text-parchment-500 hover:border-parchment-400 text-xs font-bold"
                            onClick={() => { const eq=[...char.equipment]; eq[idx]={...eq[idx],quantity:item.quantity+1}; patch({equipment:eq}) }}>+</button>
                        </div>
                        <button type="button" className="text-xs text-parchment-300 hover:text-red-500 transition-colors"
                          onClick={() => { patch({ equipment: char.equipment.filter((_,i)=>i!==idx) }); setExpandedInventoryItem(null) }}>✕ Remove</button>
                      </div>
                      <input className="input text-xs py-1 w-full" placeholder="Notes…" value={item.notes}
                        onChange={e => { const eq=[...char.equipment]; eq[idx]={...eq[idx],notes:e.target.value}; patch({equipment:eq}) }} />
                      {item.chargesMax !== undefined ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-parchment-600 shrink-0">Charges:</span>
                          <button type="button" className="w-5 h-5 rounded border border-parchment-200 text-parchment-500 hover:border-parchment-400 text-xs font-bold"
                            onClick={() => { const eq=[...char.equipment]; eq[idx]={...eq[idx],charges:Math.max(0,(item.charges??item.chargesMax??0)-1)}; patch({equipment:eq}) }}>−</button>
                          <span className="text-sm font-semibold w-5 text-center">{item.charges ?? item.chargesMax}</span>
                          <span className="text-xs text-parchment-400">/</span>
                          <input type="number" min={1} max={999} className="input text-xs py-0.5 w-12 text-center"
                            value={item.chargesMax}
                            onChange={e => { const val=parseInt(e.target.value,10); if(!isNaN(val)&&val>=1){const eq=[...char.equipment];eq[idx]={...eq[idx],chargesMax:val,charges:Math.min(item.charges??val,val)};patch({equipment:eq})} }} />
                          <button type="button" className="w-5 h-5 rounded border border-parchment-200 text-parchment-500 hover:border-parchment-400 text-xs font-bold"
                            onClick={() => { const eq=[...char.equipment]; eq[idx]={...eq[idx],charges:Math.min(item.chargesMax!,(item.charges??item.chargesMax??0)+1)}; patch({equipment:eq}) }}>+</button>
                          <label className="flex items-center gap-1 text-xs cursor-pointer ml-1">
                            <input type="checkbox" checked={!!item.rechargesOnLongRest}
                              onChange={e => { const eq=[...char.equipment]; eq[idx]={...eq[idx],rechargesOnLongRest:e.target.checked}; patch({equipment:eq}) }} />
                            <span>Recharge LR</span>
                          </label>
                          <button type="button" className="text-xs text-parchment-300 hover:text-red-500 ml-auto"
                            onClick={() => { const eq=[...char.equipment]; eq[idx]={...eq[idx],chargesMax:undefined,charges:undefined,rechargesOnLongRest:undefined}; patch({equipment:eq}) }}>✕ charges</button>
                        </div>
                      ) : (
                        <button type="button" className="text-xs text-parchment-400 hover:text-parchment-700"
                          onClick={() => { const eq=[...char.equipment]; eq[idx]={...eq[idx],chargesMax:1,charges:1}; patch({equipment:eq}) }}>＋ Add charges</button>
                      )}
                    </div>
                  )}
                </div>
              )
            }

            // Section header — plain function to avoid component-identity remounts
            const sectionHead = (title: string, count: number, onAdd?: () => void, addLabel?: string) => (
              <div className="flex items-center gap-2 mb-2 mt-4 first:mt-0">
                <span className="text-xs font-bold text-parchment-600 uppercase tracking-wider">{title}</span>
                <span className="text-xs text-parchment-400">{count}</span>
                <div className="flex-1 h-px bg-parchment-100" />
                {onAdd && (
                  <button type="button" onClick={onAdd}
                    className="text-xs text-parchment-500 hover:text-parchment-800 border border-parchment-200 hover:border-parchment-400 rounded px-2 py-0.5 transition-colors"
                  >{addLabel ?? '+ Add'}</button>
                )}
              </div>
            )

            // (SectionCard removed — sections now use SecHead pattern below)

            // Equipped loadout summary
            const equippedArmor = armors.find(x => x.item.equipped && x.as_?.type !== 'shield')
            const equippedWeapons = weapons.filter(x => x.item.equipped)
            const dualWieldWeapon = equippedWeapons.find(x => x.item.slot === 'dual')
            const mainHandWeapon = dualWieldWeapon ?? equippedWeapons.find(x => x.item.slot === 'main' || x.item.slot === 'both' || (!x.item.slot && x.item.equipped))
            const offHandWeapon = dualWieldWeapon ? undefined : equippedWeapons.find(x => x.item.slot === 'off')
            const equippedShield = armors.find(x => x.item.equipped && x.as_?.type === 'shield')
            const hasTwoHanded = mainHandWeapon?.item.slot === 'both' || (!mainHandWeapon?.item.slot && mainHandWeapon?.ws?.twoHanded)
            const canTWF = !hasTwoHanded && (dualWieldWeapon?.ws?.light || (mainHandWeapon?.ws?.light && offHandWeapon?.ws?.light))
            // Equipped implements (wand / rod / staff)
            const equippedImpls = char.equipment.filter(e => e.equipped && implementHandedness(e) !== null)
            const twoHandedImpl = equippedImpls.find(e => e.slot === 'both')
            const mainHandImpl = twoHandedImpl ?? equippedImpls.find(e => e.slot === 'main')
            const offHandImpl = twoHandedImpl ? undefined : equippedImpls.find(e => e.slot === 'off')
            const BODY_SLOTS = [
              { key: 'helmet',  label: 'Head',    color: 'border-slate-200 bg-slate-50',   text: 'text-slate-800',  head: 'text-slate-400',  bonus: 'text-slate-600' },
              { key: 'eyes',    label: 'Face',    color: 'border-sky-200 bg-sky-50',       text: 'text-sky-900',    head: 'text-sky-400',    bonus: 'text-sky-600' },
              { key: 'amulet',  label: 'Neck',    color: 'border-teal-200 bg-teal-50',     text: 'text-teal-900',   head: 'text-teal-400',   bonus: 'text-teal-600' },
              { key: 'cloak',   label: 'Back',    color: 'border-purple-200 bg-purple-50', text: 'text-purple-900', head: 'text-purple-400', bonus: 'text-purple-600' },
              { key: 'robe',    label: 'Body',    color: 'border-violet-200 bg-violet-50', text: 'text-violet-900', head: 'text-violet-400', bonus: 'text-violet-600' },
              { key: 'bracers', label: 'Arms',    color: 'border-cyan-200 bg-cyan-50',     text: 'text-cyan-900',   head: 'text-cyan-400',   bonus: 'text-cyan-600' },
              { key: 'gloves',  label: 'Hands',   color: 'border-orange-200 bg-orange-50', text: 'text-orange-900', head: 'text-orange-400', bonus: 'text-orange-600' },
              { key: 'belt',    label: 'Waist',   color: 'border-yellow-200 bg-yellow-50', text: 'text-yellow-900', head: 'text-yellow-500', bonus: 'text-yellow-700' },
              { key: 'boots',   label: 'Feet',    color: 'border-stone-200 bg-stone-50',   text: 'text-stone-800',  head: 'text-stone-400',  bonus: 'text-stone-600' },
              { key: 'backpack',label: 'Backpack',color: 'border-amber-200 bg-amber-50',   text: 'text-amber-900',  head: 'text-amber-400',  bonus: 'text-amber-600' },
            ] as const
            // Rings have no RAW limit — always worn; only attunement determines mechanical effect.
            const isAlwaysWorn = (e: typeof char.equipment[0]) => {
              const def = content.items.find(i => i.slug === e.itemSlug)
              return def?.type === 'Ring'
            }
            // Items that are carried/used but have no equip slot (orbs, containers, etc.)
            const isNonEquippable = (e: typeof char.equipment[0]) => {
              const n = e.name.toLowerCase()
              return /^orb\b/.test(n) || /\bchest\b/.test(n) || /\bbox\b/.test(n) || /\bcandle\b/.test(n) || /\bfigurine\b/.test(n) || /\bpot\b/.test(n)
            }
            const bodySlotItems: Record<string, typeof char.equipment[0] | undefined> = {}
            for (const { key } of BODY_SLOTS) bodySlotItems[key] = char.equipment.find(e => e.slot === key)
            const alwaysWornItems = char.equipment.filter(e => isAlwaysWorn(e) && e.attuned)
            const equippedOther = char.equipment.filter(e =>
              e.equipped && !isAlwaysWorn(e) && !isNonEquippable(e) &&
              !(['helmet','eyes','amulet','cloak','robe','bracers','gloves','belt','boots','backpack'] as string[]).includes(e.slot ?? '') &&
              !resolveWeapon(e, content.items) && !resolveArmor(e, content.items) && implementHandedness(e) === null
            )
            const hasLoadout = equippedArmor || equippedWeapons.length > 0 || equippedShield || equippedImpls.length > 0 ||
              BODY_SLOTS.some(s => bodySlotItems[s.key]) || alwaysWornItems.length > 0 || equippedOther.length > 0

            // compute AC for display
            const currentAC = (() => {
              const dex = abilityModFor(char, 'dex')
              if (equippedArmor) {
                const a = equippedArmor.as_!
                const base = a.type === 'light' ? a.acBase + dex
                  : a.type === 'medium' ? a.acBase + Math.min(dex, 2)
                  : a.acBase
                return base + magicBonus(equippedArmor.item.name) + (equippedShield ? equippedShield.as_!.acBase + magicBonus(equippedShield.item.name) : 0)
              }
              return null
            })()

            return (
              <div className="space-y-4">
                <div className="card">
                {/* ── Loadout ── */}
                {hasLoadout && (
                  <div className="mb-5 pb-4 border-b border-parchment-200">
                    <div className="text-[10px] font-bold text-parchment-400 uppercase tracking-widest mb-2">Loadout</div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">

                      {/* Armor slot */}
                      {equippedArmor ? (
                        <div className="flex flex-col gap-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[9px] font-bold text-blue-400 uppercase tracking-widest">Armor</span>
                            <span className="text-[9px] text-blue-400 capitalize">{equippedArmor.as_?.type}</span>
                          </div>
                          <span className="text-sm font-semibold text-blue-900 leading-tight truncate">{equippedArmor.item.name}</span>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs font-bold text-blue-700">AC {currentAC ?? equippedArmor.as_?.acBase}</span>
                            {equippedArmor.as_?.stealthDisadvantage && (
                              <span className="text-[9px] text-amber-600 bg-amber-50 border border-amber-200 rounded px-1">Disadv. Stealth</span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1 rounded-lg border border-dashed border-parchment-200 bg-parchment-50 px-3 py-2.5 opacity-50">
                          <span className="text-[9px] font-bold text-parchment-400 uppercase tracking-widest">Armor</span>
                          <span className="text-xs text-parchment-400 italic">None</span>
                        </div>
                      )}

                      {/* Body slots (cloak, amulet, rings, boots) */}
                      {BODY_SLOTS.map(slot => {
                        const worn = bodySlotItems[slot.key]
                        if (!worn) return null
                        const def = content.items.find(i => i.slug === worn.itemSlug)
                        const bonuses: string[] = []
                        if (def?.acBonus) bonuses.push(`+${def.acBonus} AC`)
                        if (def?.savingThrowBonus) bonuses.push(`+${def.savingThrowBonus} saves`)
                        if (def?.spellDCBonus) bonuses.push(`+${def.spellDCBonus} Spell DC`)
                        if (def?.spellAttackBonus) bonuses.push(`+${def.spellAttackBonus} Spell Atk`)
                        if (def?.grantedResistances?.length) bonuses.push(`Resist: ${def.grantedResistances.join(', ')}`)
                        return (
                          <div key={slot.key} className={`flex flex-col gap-1 rounded-lg border px-3 py-2.5 ${slot.color}`}>
                            <div className="flex items-center justify-between gap-1">
                              <span className={`text-[9px] font-bold uppercase tracking-widest ${slot.head}`}>{slot.label}</span>
                              {worn.attuned && <span className="text-[9px] text-indigo-500">✦ Attuned</span>}
                            </div>
                            <span className={`text-sm font-semibold leading-tight truncate ${slot.text}`}>{worn.name}</span>
                            {bonuses.length > 0 && <span className={`text-[9px] mt-0.5 ${slot.bonus}`}>{bonuses.join(' · ')}</span>}
                          </div>
                        )
                      })}

                      {/* Weapon slots */}
                      {dualWieldWeapon ? (
                        (() => {
                          const w = dualWieldWeapon
                          const dmgMod = w.ws!.finesse ? Math.max(abilityModFor(char,'str'),abilityModFor(char,'dex')) : abilityModFor(char,'str')
                          const atkBonus = dmgMod + pb + magicBonus(w.item.name)
                          return (
                            <div className="col-span-1 sm:col-span-2 flex flex-col gap-1 rounded-lg border border-green-200 bg-green-50 px-3 py-2.5">
                              <div className="flex items-center justify-between">
                                <span className="text-[9px] font-bold text-green-500 uppercase tracking-widest">Dual Wield</span>
                                {w.ws!.finesse && <span className="text-[9px] text-green-500 bg-green-100 border border-green-200 rounded px-1">Finesse</span>}
                              </div>
                              <span className="text-sm font-semibold text-green-900 truncate">{w.item.name} × 2</span>
                              <div className="flex items-center gap-3 mt-0.5">
                                <span className="text-xs font-bold text-green-700">{w.ws!.damage} {w.ws!.damageType}</span>
                                <span className="text-xs text-green-600">{formatMod(atkBonus)} to hit</span>
                              </div>
                            </div>
                          )
                        })()
                      ) : twoHandedImpl && !mainHandWeapon && !hasTwoHanded ? (
                        (() => {
                          const item = twoHandedImpl
                          const def = content.items.find(d => d.slug === item.itemSlug)
                          const bonuses = [def?.spellAttackBonus ? `+${def.spellAttackBonus} Spell Atk` : null, def?.spellDCBonus ? `+${def.spellDCBonus} Spell DC` : null].filter(Boolean)
                          return (
                            <div className="col-span-1 sm:col-span-2 flex flex-col gap-1 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2.5">
                              <div className="flex items-center justify-between">
                                <span className="text-[9px] font-bold text-violet-500 uppercase tracking-widest">Two-Handed</span>
                                {item.attuned && <span className="text-[9px] text-indigo-500">✦ Attuned</span>}
                              </div>
                              <span className="text-sm font-semibold text-violet-900 truncate">{item.name}</span>
                              {bonuses.length > 0 && <span className="text-xs text-violet-600 mt-0.5">{bonuses.join(' · ')}</span>}
                            </div>
                          )
                        })()
                      ) : hasTwoHanded && mainHandWeapon ? (
                        (() => {
                          const w = mainHandWeapon
                          const dmgMod = w.ws!.finesse ? Math.max(abilityModFor(char,'str'),abilityModFor(char,'dex')) : w.ws!.ranged ? abilityModFor(char,'dex') : abilityModFor(char,'str')
                          const atkBonus = dmgMod + pb + magicBonus(w.item.name)
                          return (
                            <div className="col-span-1 sm:col-span-2 flex flex-col gap-1 rounded-lg border border-green-200 bg-green-50 px-3 py-2.5">
                              <div className="flex items-center justify-between">
                                <span className="text-[9px] font-bold text-green-500 uppercase tracking-widest">Two-Handed</span>
                                {w.ws!.ranged && <span className="text-[9px] text-green-500 bg-green-100 border border-green-200 rounded px-1">Ranged</span>}
                              </div>
                              <span className="text-sm font-semibold text-green-900 truncate">{w.item.name}</span>
                              <div className="flex items-center gap-3 mt-0.5">
                                <span className="text-xs font-bold text-green-700">{w.ws!.damage} {w.ws!.damageType}</span>
                                <span className="text-xs text-green-600">{formatMod(atkBonus)} to hit</span>
                              </div>
                            </div>
                          )
                        })()
                      ) : (
                        <>
                          {/* Main hand */}
                          {mainHandWeapon ? (
                            (() => {
                              const w = mainHandWeapon
                              const dmgMod = w.ws!.finesse ? Math.max(abilityModFor(char,'str'),abilityModFor(char,'dex')) : w.ws!.ranged ? abilityModFor(char,'dex') : abilityModFor(char,'str')
                              const atkBonus = dmgMod + pb + magicBonus(w.item.name)
                              return (
                                <div className="flex flex-col gap-1 rounded-lg border border-green-200 bg-green-50 px-3 py-2.5">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[9px] font-bold text-green-500 uppercase tracking-widest">Main Hand</span>
                                    {w.ws!.ranged && <span className="text-[9px] text-green-500 bg-green-100 border border-green-200 rounded px-1">Ranged</span>}
                                    {w.ws!.finesse && <span className="text-[9px] text-green-500 bg-green-100 border border-green-200 rounded px-1">Finesse</span>}
                                  </div>
                                  <span className="text-sm font-semibold text-green-900 truncate">{w.item.name}</span>
                                  <div className="flex items-center gap-3 mt-0.5">
                                    <span className="text-xs font-bold text-green-700">{w.ws!.damage} {w.ws!.damageType}</span>
                                    <span className="text-xs text-green-600">{formatMod(atkBonus)} to hit</span>
                                  </div>
                                </div>
                              )
                            })()
                          ) : mainHandImpl ? (
                            (() => {
                              const item = mainHandImpl
                              const def = content.items.find(d => d.slug === item.itemSlug)
                              const bonuses = [def?.spellAttackBonus ? `+${def.spellAttackBonus} Spell Atk` : null, def?.spellDCBonus ? `+${def.spellDCBonus} Spell DC` : null].filter(Boolean)
                              return (
                                <div className="flex flex-col gap-1 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2.5">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[9px] font-bold text-violet-500 uppercase tracking-widest">Main Hand</span>
                                    {item.attuned && <span className="text-[9px] text-indigo-500">✦ Attuned</span>}
                                  </div>
                                  <span className="text-sm font-semibold text-violet-900 truncate">{item.name}</span>
                                  {bonuses.length > 0 && <span className="text-xs text-violet-600 mt-0.5">{bonuses.join(' · ')}</span>}
                                </div>
                              )
                            })()
                          ) : null}

                          {/* Off hand: weapon, shield, or implement */}
                          {offHandWeapon ? (
                            (() => {
                              const w = offHandWeapon
                              const dmgMod = w.ws!.finesse ? Math.max(abilityModFor(char,'str'),abilityModFor(char,'dex')) : w.ws!.ranged ? abilityModFor(char,'dex') : abilityModFor(char,'str')
                              const atkBonus = dmgMod + pb + magicBonus(w.item.name)
                              return (
                                <div className="flex flex-col gap-1 rounded-lg border border-green-200 bg-green-50 px-3 py-2.5">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[9px] font-bold text-green-500 uppercase tracking-widest">Off Hand</span>
                                    {w.ws!.ranged && <span className="text-[9px] text-green-500 bg-green-100 border border-green-200 rounded px-1">Ranged</span>}
                                    {w.ws!.finesse && <span className="text-[9px] text-green-500 bg-green-100 border border-green-200 rounded px-1">Finesse</span>}
                                  </div>
                                  <span className="text-sm font-semibold text-green-900 truncate">{w.item.name}</span>
                                  <div className="flex items-center gap-3 mt-0.5">
                                    <span className="text-xs font-bold text-green-700">{w.ws!.damage} {w.ws!.damageType}</span>
                                    <span className="text-xs text-green-600">{formatMod(atkBonus)} to hit</span>
                                  </div>
                                </div>
                              )
                            })()
                          ) : equippedShield ? (
                            <div className="flex flex-col gap-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5">
                              <span className="text-[9px] font-bold text-blue-400 uppercase tracking-widest">Off Hand — Shield</span>
                              <span className="text-sm font-semibold text-blue-900 truncate">{equippedShield.item.name}</span>
                              <span className="text-xs font-bold text-blue-700 mt-0.5">+{(equippedShield.as_?.acBase ?? 2) + magicBonus(equippedShield.item.name)} AC</span>
                            </div>
                          ) : offHandImpl ? (
                            (() => {
                              const item = offHandImpl
                              const def = content.items.find(d => d.slug === item.itemSlug)
                              const bonuses = [def?.spellAttackBonus ? `+${def.spellAttackBonus} Spell Atk` : null, def?.spellDCBonus ? `+${def.spellDCBonus} Spell DC` : null].filter(Boolean)
                              return (
                                <div className="flex flex-col gap-1 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2.5">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[9px] font-bold text-violet-500 uppercase tracking-widest">Off Hand</span>
                                    {item.attuned && <span className="text-[9px] text-indigo-500">✦ Attuned</span>}
                                  </div>
                                  <span className="text-sm font-semibold text-violet-900 truncate">{item.name}</span>
                                  {bonuses.length > 0 && <span className="text-xs text-violet-600 mt-0.5">{bonuses.join(' · ')}</span>}
                                </div>
                              )
                            })()
                          ) : null}
                        </>
                      )}

                      {/* Rings — always worn, no slot limit */}
                      {alwaysWornItems.map((item, i) => {
                        const def = content.items.find(d => d.slug === item.itemSlug)
                        const bonuses: string[] = []
                        if (def?.acBonus) bonuses.push(`+${def.acBonus} AC`)
                        if (def?.savingThrowBonus) bonuses.push(`+${def.savingThrowBonus} saves`)
                        if (def?.spellDCBonus) bonuses.push(`+${def.spellDCBonus} Spell DC`)
                        if (def?.grantedResistances?.length) bonuses.push(`Resist: ${def.grantedResistances.join(', ')}`)
                        return (
                          <div key={i} className="flex flex-col gap-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[9px] font-bold uppercase tracking-widest text-amber-500">Ring</span>
                              {item.attuned && <span className="text-[9px] text-indigo-500">✦ Attuned</span>}
                            </div>
                            <span className="text-sm font-semibold leading-tight truncate text-amber-900">{item.name}</span>
                            {bonuses.length > 0 && <span className="text-[9px] mt-0.5 text-amber-600">{bonuses.join(' · ')}</span>}
                          </div>
                        )
                      })}

                      {/* Other equipped items */}
                      {equippedOther.map((item, i) => (
                        <div key={i} className="flex flex-col gap-1 rounded-lg border border-parchment-200 bg-parchment-50 px-3 py-2.5">
                          <span className="text-[9px] font-bold text-parchment-400 uppercase tracking-widest">Equipped</span>
                          <span className="text-sm font-semibold text-parchment-800 truncate">{item.name}</span>
                          {item.attuned && <span className="text-[9px] text-indigo-500">✦ Attuned</span>}
                        </div>
                      ))}
                    </div>

                    {/* Two-Weapon Fighting banner */}
                    {canTWF && (() => {
                      const twfSource = offHandWeapon ?? dualWieldWeapon!
                      const offWs = twfSource.ws!
                      const offMod = offWs.finesse
                        ? Math.max(abilityModFor(char, 'str'), abilityModFor(char, 'dex'))
                        : abilityModFor(char, 'str')
                      const offDmgMod = offMod < 0 ? offMod : 0
                      const hasTWFStyle = char.featuresChosen.some(fc => fc.value === 'two-weapon-fighting')
                      const effectiveMod = hasTWFStyle ? offMod : offDmgMod
                      return (
                        <div className="col-span-2 sm:col-span-3 flex items-center gap-3 px-3 py-2 rounded-lg border border-amber-200 bg-amber-50">
                          <div className="flex flex-col">
                            <span className="text-[9px] font-bold text-amber-600 uppercase tracking-widest">Bonus Action</span>
                            <span className="text-xs font-semibold text-amber-900">Two-Weapon Fighting</span>
                          </div>
                          <div className="h-6 w-px bg-amber-200" />
                          <div className="flex flex-col">
                            <span className="text-[9px] text-amber-500 uppercase tracking-wide">Off-hand damage</span>
                            <span className="text-xs font-bold text-amber-800">
                              {offWs.damage}{effectiveMod !== 0 ? ` ${formatMod(effectiveMod)}` : ''} {offWs.damageType}
                            </span>
                          </div>
                          {!hasTWFStyle && (
                            <span className="ml-auto text-[9px] text-amber-500 italic">No ability mod to off-hand dmg<br/>unless negative · TWF style removes this</span>
                          )}
                        </div>
                      )
                    })()}
                  </div>
                )}

                </div>{/* end loadout card */}

                {/* ── Item Sections ── */}
                {(() => {
                  const RARITY_BADGE: Record<string, string> = {
                    common:      'bg-parchment-100 text-parchment-600',
                    uncommon:    'bg-green-100 text-green-700',
                    rare:        'bg-blue-100 text-blue-700',
                    'very rare': 'bg-violet-100 text-violet-700',
                    legendary:   'bg-amber-100 text-amber-700',
                    artifact:    'bg-orange-100 text-orange-700',
                  }
                  const rarityBadge = (rarity: string | undefined) => ({
                    badge: rarity,
                    badgeColor: rarity ? (RARITY_BADGE[rarity.toLowerCase()] ?? RARITY_BADGE.common) : undefined,
                  })

                  const CAT_LABELS: Record<ItemCat, string> = {
                    armor: 'Armor', potion: 'Potion', ring: 'Ring', rod: 'Rod',
                    scroll: 'Scroll', staff: 'Staff', wand: 'Wand', weapon: 'Weapon',
                    wondrous: 'Wondrous', gear: 'Gear',
                  }

                  // Amalgam slugs that have explicit tiered variants or inline +1/+2/+3 buttons;
                  // hide them from pickers so only the usable entries show.
                  const TIERED_BASE_SLUGS = new Set([
                    'rod-of-the-pact-keeper', 'wand-of-the-war-mage',
                    'amulet-of-the-devout', 'arcane-grimoire', 'moon-sickle',
                    'shield-1-2-3', 'weapon-1-2-3', 'armor-1-2-3', 'ammunition',
                    'shield-1', 'shield-2', 'shield-3',
                  ])

                  const magicPicker = (filter: (it: ItemDef) => boolean) => (
                    <div className="mt-3 p-3 rounded-lg border border-parchment-200 bg-parchment-50">
                      <input className="input mb-2 text-sm" placeholder="Search…" value={addPanelSearch}
                        onChange={e => setAddPanelSearch(e.target.value)} autoFocus />
                      <div className="space-y-1 max-h-52 overflow-y-auto">
                        {content.items
                          .filter(it => it.name && !TIERED_BASE_SLUGS.has(it.slug) && filter(it) && (!addPanelSearch || it.name.toLowerCase().includes(addPanelSearch.toLowerCase())))
                          .map(it => (
                            <button key={it.slug} type="button"
                              className="w-full text-left px-2.5 py-1.5 rounded border border-parchment-200 hover:border-indigo-300 hover:bg-indigo-50 text-sm flex items-center gap-2 transition-colors"
                              onClick={() => { patch({ equipment: [...char.equipment, { itemSlug: it.slug, name: it.name, quantity: 1, equipped: false, attuned: false, isHomebrew: it.source.site === 'homebrew', notes: '' }] }); setAddPanel(null) }}>
                              <span className="flex-1">{it.name}</span>
                              {it.rarity && <span className="text-xs text-parchment-400">{it.rarity}</span>}
                              {it.attunement && <span className="text-xs text-indigo-400">✦</span>}
                            </button>
                        ))}
                      </div>
                    </div>
                  )

                  const secLabel = (cat: ItemCat, label: string) => (
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xs font-bold text-parchment-500 uppercase tracking-widest">{label}</span>
                      {grouped[cat].length > 0 && (
                        <span className="text-[10px] font-bold bg-parchment-100 text-parchment-500 px-1.5 py-0.5 rounded-full">{grouped[cat].length}</span>
                      )}
                      <div className="flex-1 h-px bg-parchment-100" />
                    </div>
                  )

                  const catKey = (cat: ItemCat) => cat === 'gear' ? 'add-gear-browse' : `add-${cat}`
                  const catVisible = (cat: ItemCat) => grouped[cat].length > 0 || addPanel === catKey(cat)

                  const WORN_CATS:   ItemCat[] = ['armor', 'ring', 'wondrous']
                  const HELD_CATS:   ItemCat[] = ['weapon', 'rod', 'staff', 'wand', 'scroll']
                  const SUPPLY_CATS: ItemCat[] = ['potion', 'gear']

                  const addPill = (cat: ItemCat) => {
                    const key = catKey(cat)
                    const active = addPanel === key
                    return (
                      <button key={cat} type="button"
                        className={`text-xs rounded-full px-2.5 py-0.5 border transition-colors ${active ? 'bg-parchment-700 text-white border-parchment-700' : 'border-parchment-200 text-parchment-500 hover:border-parchment-500 hover:text-parchment-800'}`}
                        onClick={() => { setAddPanel(active ? null : key); setAddPanelSearch('') }}>
                        {active ? `✕ ${CAT_LABELS[cat]}` : `+ ${CAT_LABELS[cat]}`}
                      </button>
                    )
                  }

                  const cardHeader = (title: string, cats: ItemCat[], extra?: React.ReactNode) => (
                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-parchment-100">
                      <span className="font-semibold text-parchment-800 text-sm">{title}</span>
                      <div className="flex flex-wrap gap-1.5 justify-end">
                        {cats.map(cat => addPill(cat))}
                        {extra}
                      </div>
                    </div>
                  )

                  return (
                    <div className="space-y-4">

                      {/* ── Worn ── */}
                      <div className="card">
                        {cardHeader('Worn', WORN_CATS)}
                        <div className="divide-y divide-parchment-100">

                          {catVisible('armor') && (
                            <div className="py-3 first:pt-0 last:pb-0">
                              {secLabel('armor', 'Armor')}
                              {addPanel === 'add-armor' && (() => {
                                const mundaneArmorSlugs = new Set(['padded','leather','studded-leather','hide','chain-shirt','scale-mail','breastplate','half-plate','ring-mail','chain-mail','splint','plate','shield'])
                                const groups = [
                                  { label: 'Light Armor',  keys: ['padded','leather','studded-leather'] },
                                  { label: 'Medium Armor', keys: ['hide','chain-shirt','scale-mail','breastplate','half-plate'] },
                                  { label: 'Heavy Armor',  keys: ['ring-mail','chain-mail','splint','plate'] },
                                  { label: 'Shield',       keys: ['shield'] },
                                ]
                                const mundaneAll = groups.flatMap(g => g.keys.map(k => {
                                  const as_ = content.items.find(i => i.slug === k)?.armorStats
                                  return { slug: k, ...(as_ ?? { acBase: 0, type: 'light' as const }), group: g.label, isMagic: false }
                                }))
                                const magicArmors = content.items
                                  .filter(i => !!i.armorStats && !mundaneArmorSlugs.has(i.slug))
                                  .sort((a, b) => a.name.localeCompare(b.name))
                                  .map(i => ({ slug: i.slug, ...i.armorStats!, label: i.name, group: 'Magic Armor', isMagic: true }))
                                const all = [...mundaneAll, ...magicArmors]
                                const filtered = addPanelSearch ? all.filter(a => a.label?.toLowerCase().includes(addPanelSearch.toLowerCase())) : all
                                const sections = addPanelSearch
                                  ? [{ label: 'Results', isMagic: false }]
                                  : [...groups.map(g => ({ label: g.label, isMagic: false })), { label: 'Magic Armor', isMagic: true }]
                                return (
                                  <div className="mb-3 p-3 rounded-lg border border-parchment-200 bg-parchment-50">
                                    <input className="input mb-2 text-sm" placeholder="Search armor…" value={addPanelSearch} onChange={e => setAddPanelSearch(e.target.value)} autoFocus />
                                    <div className="space-y-2 max-h-52 overflow-y-auto">
                                      {sections.map(section => {
                                        const items = addPanelSearch ? filtered : all.filter(a => a.group === section.label)
                                        if (items.length === 0) return null
                                        return (
                                          <div key={section.label}>
                                            {!addPanelSearch && <div className={`text-xs font-semibold uppercase mb-1 ${section.isMagic ? 'text-violet-500' : 'text-parchment-400'}`}>{section.label}</div>}
                                            <div className="grid grid-cols-2 gap-1">
                                              {items.map(a => {
                                                const dex = abilityModFor(char, 'dex')
                                                const calcAC = a.type === 'light' ? a.acBase + dex : a.type === 'medium' ? a.acBase + Math.min(dex,2) : a.acBase
                                                const baseName = a.label?.replace(/ \(.*\)$/, '') ?? a.slug
                                                const acLabel = a.type === 'shield' ? `+${a.acBase} AC` : `AC ${calcAC}`
                                                return (
                                                  <div key={a.slug} className={`flex items-stretch rounded border overflow-hidden text-sm ${a.isMagic ? 'border-violet-100' : 'border-parchment-200'}`}>
                                                    <button type="button"
                                                      className={`flex-1 text-left px-2 py-1.5 transition-colors flex items-center justify-between gap-1 min-w-0 ${a.isMagic ? 'hover:bg-violet-50' : 'hover:bg-blue-50'}`}
                                                      onClick={() => { patch({ equipment: [...char.equipment, { itemSlug: a.slug, name: baseName, quantity: 1, equipped: false, attuned: false, isHomebrew: false, notes: '' }] }); setAddPanel(null) }}>
                                                      <span className="truncate">{baseName}</span>
                                                      <span className="text-xs text-parchment-400 shrink-0">{acLabel}</span>
                                                    </button>
                                                    {!a.isMagic && [1, 2, 3].map(tier => (
                                                      <button key={tier} type="button"
                                                        className="px-1.5 border-l border-parchment-200 text-[10px] font-bold text-violet-500 hover:bg-violet-50 transition-colors shrink-0"
                                                        title={`Add ${baseName} +${tier}`}
                                                        onClick={() => { patch({ equipment: [...char.equipment, { itemSlug: a.slug, name: `${baseName} +${tier}`, quantity: 1, equipped: false, attuned: false, isHomebrew: false, notes: '' }] }); setAddPanel(null) }}>
                                                        +{tier}
                                                      </button>
                                                    ))}
                                                  </div>
                                                )
                                              })}
                                            </div>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  </div>
                                )
                              })()}
                              <div className="space-y-2">
                                {grouped.armor.map(({ item, idx }) => {
                                  const as_ = resolveArmor(item, content.items)!
                                  const dex = abilityModFor(char, 'dex')
                                  const mb = magicBonus(item.name)
                                  const calcAC = as_.type === 'shield' ? `+${as_.acBase + mb} AC` : as_.type === 'light' ? `AC ${as_.acBase + dex + mb}` : as_.type === 'medium' ? `AC ${as_.acBase + Math.min(dex,2) + mb}` : `AC ${as_.acBase + mb}`
                                  const warnings: string[] = []
                                  if (as_.type !== 'shield' && !isArmorProficient(char, as_)) warnings.push('Not proficient')
                                  if (as_.minStrength && char.abilityScores.str < as_.minStrength) warnings.push(`STR ${as_.minStrength} req.`)
                                  const def = content.items.find(i => i.slug === item.itemSlug && i.name)
                                  const descParts = [warnings.length ? `⚠ ${warnings.join(' · ')}` : null, def?.description || null, item.notes || null].filter(Boolean)
                                  return itemRow({ item, idx, badge: calcAC, badgeColor: 'bg-blue-100 text-blue-700', descriptionText: descParts.join('\n\n') || null })
                                })}
                              </div>
                            </div>
                          )}

                          {catVisible('ring') && (
                            <div className="py-3 first:pt-0 last:pb-0">
                              {secLabel('ring', 'Ring')}
                              {addPanel === 'add-ring' && magicPicker(it => it.type === 'Ring')}
                              <div className="mt-1 space-y-2">
                                {grouped.ring.map(({ item, idx }) => {
                                  const def = content.items.find(i => i.slug === item.itemSlug && i.name)
                                  const rb = rarityBadge(def?.rarity)
                                  return itemRow({ item, idx, badge: rb.badge, badgeColor: rb.badgeColor, descriptionText: def?.description || item.notes || null, showAttune: def?.attunement })
                                })}
                              </div>
                            </div>
                          )}

                          {catVisible('wondrous') && (
                            <div className="py-3 first:pt-0 last:pb-0">
                              {secLabel('wondrous', 'Wondrous Item')}
                              {addPanel === 'add-wondrous' && magicPicker(it => {
                                const n = it.name.toLowerCase()
                                return it.type === 'Wondrous Item' && !/^rod\b/.test(n) && !/^scroll\b/.test(n) && !/^staff\b/.test(n) && !/^wand\b/.test(n) && !it.weaponStats && !it.armorStats
                              })}
                              <div className="mt-1 space-y-2">
                                {grouped.wondrous.map(({ item, idx }) => {
                                  const def = content.items.find(i => i.slug === item.itemSlug && i.name)
                                  const rb = rarityBadge(def?.rarity)
                                  return itemRow({ item, idx, badge: rb.badge, badgeColor: rb.badgeColor, descriptionText: def?.description || item.notes || null, showAttune: def?.attunement })
                                })}
                              </div>
                            </div>
                          )}

                          {!WORN_CATS.some(catVisible) && (
                            <p className="text-sm text-parchment-400 py-2">Nothing worn yet.</p>
                          )}
                        </div>
                      </div>

                      {/* ── Held ── */}
                      <div className="card">
                        {cardHeader('Held', HELD_CATS)}
                        <div className="divide-y divide-parchment-100">

                          {catVisible('weapon') && (
                            <div className="py-3 first:pt-0 last:pb-0">
                              {secLabel('weapon', 'Weapon')}
                              {addPanel === 'add-weapon' && (() => {
                                const mundaneSlugs = new Set(['club','dagger','greatclub','handaxe','javelin','light-hammer','mace','quarterstaff','sickle','spear','crossbow-light','dart','shortbow','sling','battleaxe','flail','glaive','greataxe','greatsword','halberd','lance','longsword','maul','morningstar','pike','rapier','scimitar','shortsword','trident','war-pick','warhammer','whip','crossbow-hand','crossbow-heavy','longbow','net'])
                                const groups = [
                                  { label: 'Simple Melee',   keys: ['club','dagger','greatclub','handaxe','javelin','light-hammer','mace','quarterstaff','sickle','spear'] },
                                  { label: 'Simple Ranged',  keys: ['crossbow-light','dart','shortbow','sling'] },
                                  { label: 'Martial Melee',  keys: ['battleaxe','flail','glaive','greataxe','greatsword','halberd','lance','longsword','maul','morningstar','pike','rapier','scimitar','shortsword','trident','war-pick','warhammer','whip'] },
                                  { label: 'Martial Ranged', keys: ['crossbow-hand','crossbow-heavy','longbow','net'] },
                                ]
                                const mundaneAll = groups.flatMap(g => g.keys.map(k => {
                                  const ws = content.items.find(i => i.slug === k)?.weaponStats
                                  return { slug: k, ...(ws ?? { damage: '', damageType: '' }), group: g.label, isMagic: false }
                                }))
                                const magicWeapons = content.items
                                  .filter(i => !!i.weaponStats && !mundaneSlugs.has(i.slug))
                                  .sort((a, b) => a.name.localeCompare(b.name))
                                  .map(i => ({ slug: i.slug, ...i.weaponStats!, label: i.name, group: 'Magic Weapons', isMagic: true }))
                                const all = [...mundaneAll, ...magicWeapons]
                                const filtered = addPanelSearch ? all.filter(w => w.label?.toLowerCase().includes(addPanelSearch.toLowerCase())) : all
                                const sections = addPanelSearch
                                  ? [{ label: 'Results', isMagic: false }]
                                  : [...groups.map(g => ({ label: g.label, isMagic: false })), { label: 'Magic Weapons', isMagic: true }]
                                return (
                                  <div className="mb-3 p-3 rounded-lg border border-parchment-200 bg-parchment-50">
                                    <input className="input mb-2 text-sm" placeholder="Search weapons…" value={addPanelSearch} onChange={e => setAddPanelSearch(e.target.value)} autoFocus />
                                    <div className="space-y-2 max-h-52 overflow-y-auto">
                                      {sections.map(section => {
                                        const items = addPanelSearch ? filtered : all.filter(w => w.group === section.label)
                                        if (items.length === 0) return null
                                        return (
                                          <div key={section.label}>
                                            {!addPanelSearch && <div className={`text-xs font-semibold uppercase mb-1 ${section.isMagic ? 'text-violet-500' : 'text-parchment-400'}`}>{section.label}</div>}
                                            <div className="grid grid-cols-2 gap-1">
                                              {items.map(w => (
                                                <div key={w.slug} className={`flex items-stretch rounded border overflow-hidden text-sm ${w.isMagic ? 'border-violet-100' : 'border-parchment-200'}`}>
                                                  <button type="button"
                                                    className={`flex-1 text-left px-2 py-1.5 transition-colors flex items-center justify-between gap-1 min-w-0 ${w.isMagic ? 'hover:bg-violet-50' : 'hover:bg-green-50'}`}
                                                    onClick={() => { patch({ equipment: [...char.equipment, { itemSlug: w.slug, name: w.label ?? w.slug, quantity: 1, equipped: false, attuned: false, isHomebrew: false, notes: '' }] }); setAddPanel(null) }}>
                                                    <span className="truncate">{w.label}</span>
                                                    <span className="text-xs text-parchment-400 shrink-0">{w.damage}</span>
                                                  </button>
                                                  {!w.isMagic && [1, 2, 3].map(tier => (
                                                    <button key={tier} type="button"
                                                      className="px-1.5 border-l border-parchment-200 text-[10px] font-bold text-violet-500 hover:bg-violet-50 transition-colors shrink-0"
                                                      title={`Add ${w.label} +${tier}`}
                                                      onClick={() => { patch({ equipment: [...char.equipment, { itemSlug: w.slug, name: `${w.label ?? w.slug} +${tier}`, quantity: 1, equipped: false, attuned: false, isHomebrew: false, notes: '' }] }); setAddPanel(null) }}>
                                                      +{tier}
                                                    </button>
                                                  ))}
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  </div>
                                )
                              })()}
                              <div className="space-y-2">
                                {grouped.weapon.map(({ item, idx }) => {
                                  const ws = resolveWeapon(item, content.items)!
                                  const bonus = magicBonus(item.name)
                                  const dmgMod = weaponDamageMod(char, ws, bonus)
                                  const dmgStr = ws.damage === '—' ? ws.damage : `${ws.damage}${dmgMod !== 0 ? formatMod(dmgMod) : ''} ${ws.damageType}`
                                  const badge = `${dmgStr}${ws.finesse ? ' · Finesse' : ''}${ws.ranged ? ' · Ranged' : ''}`
                                  return itemRow({ item, idx, badge, badgeColor: 'bg-green-100 text-green-700', descriptionText: item.notes || null })
                                })}
                              </div>
                            </div>
                          )}

                          {catVisible('rod') && (
                            <div className="py-3 first:pt-0 last:pb-0">
                              {secLabel('rod', 'Rod')}
                              {addPanel === 'add-rod' && magicPicker(it => /^rod\b/i.test(it.name))}
                              <div className="mt-1 space-y-2">
                                {grouped.rod.map(({ item, idx }) => {
                                  const def = content.items.find(i => i.slug === item.itemSlug && i.name)
                                  const rb = rarityBadge(def?.rarity)
                                  return itemRow({ item, idx, badge: rb.badge, badgeColor: rb.badgeColor, descriptionText: def?.description || item.notes || null, showAttune: def?.attunement })
                                })}
                              </div>
                            </div>
                          )}

                          {catVisible('staff') && (
                            <div className="py-3 first:pt-0 last:pb-0">
                              {secLabel('staff', 'Staff')}
                              {addPanel === 'add-staff' && magicPicker(it => /^staff\b/i.test(it.name))}
                              <div className="mt-1 space-y-2">
                                {grouped.staff.map(({ item, idx }) => {
                                  const def = content.items.find(i => i.slug === item.itemSlug && i.name)
                                  const rb = rarityBadge(def?.rarity)
                                  return itemRow({ item, idx, badge: rb.badge, badgeColor: rb.badgeColor, descriptionText: def?.description || item.notes || null, showAttune: def?.attunement })
                                })}
                              </div>
                            </div>
                          )}

                          {catVisible('wand') && (
                            <div className="py-3 first:pt-0 last:pb-0">
                              {secLabel('wand', 'Wand')}
                              {addPanel === 'add-wand' && magicPicker(it => /^wand\b/i.test(it.name))}
                              <div className="mt-1 space-y-2">
                                {grouped.wand.map(({ item, idx }) => {
                                  const def = content.items.find(i => i.slug === item.itemSlug && i.name)
                                  const rb = rarityBadge(def?.rarity)
                                  return itemRow({ item, idx, badge: rb.badge, badgeColor: rb.badgeColor, descriptionText: def?.description || item.notes || null, showAttune: def?.attunement })
                                })}
                              </div>
                            </div>
                          )}

                          {catVisible('scroll') && (
                            <div className="py-3 first:pt-0 last:pb-0">
                              {secLabel('scroll', 'Scroll')}
                              {addPanel === 'add-scroll' && magicPicker(it => /^scroll\b/i.test(it.name))}
                              <div className="mt-1 space-y-2">
                                {grouped.scroll.map(({ item, idx }) => {
                                  const def = content.items.find(i => i.slug === item.itemSlug && i.name)
                                  const rb = rarityBadge(def?.rarity)
                                  return itemRow({ item, idx, badge: rb.badge, badgeColor: rb.badgeColor, descriptionText: def?.description || item.notes || null, showAttune: def?.attunement, consumable: true })
                                })}
                              </div>
                            </div>
                          )}

                          {!HELD_CATS.some(catVisible) && (
                            <p className="text-sm text-parchment-400 py-2">Nothing held yet.</p>
                          )}
                        </div>
                      </div>

                      {/* ── Other ── */}
                      <div className="card">
                        {cardHeader('Other', SUPPLY_CATS,
                          <button type="button"
                            className="text-xs rounded-full px-2.5 py-0.5 border border-parchment-200 text-parchment-500 hover:border-parchment-500 hover:text-parchment-800 transition-colors"
                            onClick={() => {
                              const name = prompt('Item name:')
                              if (!name) return
                              patch({ equipment: [...char.equipment, { itemSlug: `custom-${Date.now()}`, name, quantity: 1, equipped: false, attuned: false, isHomebrew: true, notes: '' }] })
                            }}>+ Custom</button>
                        )}
                        <div className="divide-y divide-parchment-100">

                          {catVisible('potion') && (
                            <div className="py-3 first:pt-0 last:pb-0">
                              {secLabel('potion', 'Potion')}
                              {addPanel === 'add-potion' && magicPicker(it => it.type === 'Potion')}
                              <div className="mt-1 space-y-2">
                                {grouped.potion.map(({ item, idx }) => {
                                  const cd = CONSUMABLE_DATA[item.name]
                                  const def = content.items.find(i => i.slug === item.itemSlug && i.name)
                                  const rb = rarityBadge(def?.rarity)
                                  const descParts = [cd?.text ?? def?.description ?? null, item.notes || null].filter(Boolean)
                                  return itemRow({ item, idx, badge: cd?.badge ?? rb.badge, badgeColor: cd?.badgeColor ?? rb.badgeColor, descriptionText: descParts.join('\n\n') || null, consumable: !!cd, showAttune: def?.attunement })
                                })}
                              </div>
                            </div>
                          )}

                          {catVisible('gear') && (
                            <div className="py-3 first:pt-0 last:pb-0">
                              {secLabel('gear', 'Gear')}
                              {addPanel === 'add-gear-browse' && (
                                <div className="mb-3 p-3 rounded-lg border border-parchment-200 bg-parchment-50">
                                  <input className="input mb-2 text-sm" placeholder="Search gear…" value={addPanelSearch} onChange={e => setAddPanelSearch(e.target.value)} autoFocus />
                                  <div className="space-y-2 max-h-52 overflow-y-auto">
                                    {COMMON_GEAR.map(cat => {
                                      const items = cat.items.filter(n => !addPanelSearch || n.toLowerCase().includes(addPanelSearch.toLowerCase()))
                                      if (items.length === 0) return null
                                      return (
                                        <div key={cat.cat}>
                                          {!addPanelSearch && <div className="text-xs font-semibold text-parchment-400 uppercase mb-1">{cat.cat}</div>}
                                          <div className="grid grid-cols-2 gap-1">
                                            {items.map(name => (
                                              <button key={name} type="button"
                                                className="text-left px-2 py-1 rounded border border-parchment-200 hover:border-parchment-400 hover:bg-parchment-50 text-sm transition-colors"
                                                onClick={() => { patch({ equipment: [...char.equipment, { itemSlug: `gear-${name.toLowerCase().replace(/[^a-z0-9]/g,'-')}`, name, quantity: 1, equipped: false, attuned: false, isHomebrew: false, notes: '' }] }) }}
                                              >{name}</button>
                                            ))}
                                          </div>
                                        </div>
                                      )
                                    })}
                                  </div>
                                </div>
                              )}
                              <div className="space-y-2">
                                {grouped.gear.map(({ item, idx }) => {
                                  const cd = CONSUMABLE_DATA[item.name]
                                  const descText = cd ? cd.text + (item.notes ? '\n\n' + item.notes : '') : (item.notes || null)
                                  return itemRow({ item, idx, badge: cd?.badge, badgeColor: cd?.badgeColor, descriptionText: descText, consumable: !!cd })
                                })}
                              </div>
                            </div>
                          )}

                          {!SUPPLY_CATS.some(catVisible) && (
                            <p className="text-sm text-parchment-400 py-2">No potions or gear yet.</p>
                          )}
                        </div>
                      </div>

                    </div>
                  )
                })()}
              </div>
            )
          })()}

        </div>
      )}

      {/* Features Tab */}
      {tab === 'features' && (
        <div className="flex flex-col gap-4">
          {/* Config warnings */}
          {(() => {
            const warnings: string[] = []
            // Race enrichment
            if (char.raceSlug && !RACE_OPTIONS[char.raceSlug]) {
              const raceName = content.races.find(r => r.slug === char.raceSlug)?.name ?? char.raceSlug
              warnings.push(`Race "${raceName}" has no enrichment data — ability bonuses and proficiencies may be missing. Add an entry to RACE_OPTIONS in src/data/raceData.ts.`)
            }
            // Class config and subclass config
            for (const cc of char.classes) {
              const opts = CLASS_OPTIONS[cc.classSlug]
              const clsName = content.classes.find(c => c.slug === cc.classSlug)?.name ?? cc.classSlug
              if (!opts) {
                warnings.push(`Class "${clsName}" has no CLASS_OPTIONS entry — features and spellcasting will be empty. Add it to src/data/classData.ts.`)
              } else if (cc.subclassSlug && !opts.subclasses.find(s => s.slug === cc.subclassSlug)) {
                warnings.push(`Subclass "${cc.subclassSlug}" is not listed under ${clsName} in CLASS_OPTIONS — subclass features won't display. Add it to src/data/classData.ts.`)
              }
            }
            if (warnings.length === 0) return null
            return (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 space-y-1">
                <div className="text-xs font-semibold text-amber-800 uppercase tracking-wide mb-1">⚠ Data Gaps Detected</div>
                {warnings.map((w, i) => (
                  <p key={i} className="text-xs text-amber-800">{w}</p>
                ))}
              </div>
            )
          })()}
          {/* Level Journey */}
          {(() => {
            const ABILITY_SHORT: Record<string, string> = { str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA' }

            // Build a per-class level history
            const classJourneys = char.classes.map(cc => {
              const opts = CLASS_OPTIONS[cc.classSlug]
              const clsContent = content.classes.find(c => c.slug === cc.classSlug)
              const clsName = clsContent?.name ?? cc.classSlug
              const hitDie = opts?.hitDie ?? clsContent?.hitDie ?? 8
              const asiLevels = asiLevelsForClass(cc.classSlug)
              const expertiseLevels = opts?.expertiseAt ?? []
              const expertiseCount = opts?.expertiseCount ?? 2

              // Feats for this class: key = feat-{classSlug}-{timestamp}
              const featEntries = char.featuresChosen
                .filter(fc => typeof fc.key === 'string' && fc.key.startsWith(`feat-${cc.classSlug}-`))
                .map(fc => {
                  const ts = parseInt(fc.key.split('-').pop() ?? '0', 10)
                  const slug = typeof fc.value === 'string' ? fc.value : ''
                  const featName = content.feats.find(f => f.slug === slug)?.name ?? slug
                  return { ts, slug, featName }
                })
                .sort((a, b) => a.ts - b.ts)

              // Feats are also stored with newer key format: feat-{classSlug}-{level}-{timestamp}
              // Handle both formats
              const featEntriesAlt = char.featuresChosen
                .filter(fc => {
                  if (typeof fc.key !== 'string') return false
                  if (!fc.key.startsWith('feat-')) return false
                  // Exclude keys already captured above
                  return !fc.key.startsWith(`feat-${cc.classSlug}-`) && fc.key.includes(cc.classSlug)
                })
                .map(fc => {
                  const slug = typeof fc.value === 'string' ? fc.value : ''
                  const featName = content.feats.find(f => f.slug === slug)?.name ?? slug
                  return { ts: 0, slug, featName }
                })

              const allFeatEntries = [...featEntries, ...featEntriesAlt]

              // Expertise per level: distribute skills across expertise levels evenly
              const expertiseSkillsForLevel = (levelIdx: number): string[] => {
                if (expertiseLevels.length === 0) return []
                const lvl = expertiseLevels[levelIdx]
                if (!lvl) return []
                const allExpert = char.skillExpertise
                // Distribute: first expertiseCount skills at first expertise level, next at second, etc.
                const start = levelIdx * expertiseCount
                const slice = allExpert.slice(start, start + expertiseCount)
                return slice
              }

              // Fighting style
              const fightingStyleChoice = char.featuresChosen.find(fc => fc.key === 'fighting-style')
              const fightingStyleValue = typeof fightingStyleChoice?.value === 'string' ? fightingStyleChoice.value : null
              const fightingStyleDef = opts?.fightingStyles?.find(fs => fs.slug === fightingStyleValue)

              // Subclass info
              const subclassAtLevel = opts?.subclasses.find(s => s.slug === cc.subclassSlug)?.level ?? 3

              const rows: Array<{
                level: number
                hpRoll: number | null
                features: string[]
                subclassName: string | null
                subclassFeatures: string[]
                asiOrFeat: { kind: 'asi'; note: string } | { kind: 'feat'; name: string; slug: string } | null
                expertiseSkills: string[]
                fightingStyleName: string | null
              }> = []

              let featIdx = 0
              let asiCount = 0

              for (let lvl = 1; lvl <= cc.level; lvl++) {
                const hpRoll = cc.hitDieRolls[lvl - 1] ?? null
                const classFeatures = (opts?.features ?? []).filter(f => f.level === lvl).map(f => f.name)
                const isAsiLevel = asiLevels.includes(lvl)
                const isSubclassLevel = cc.subclassSlug && lvl === subclassAtLevel
                const subclassDef = isSubclassLevel ? opts?.subclasses.find(s => s.slug === cc.subclassSlug) : null
                const subclassFeatureNames = subclassDef?.features?.filter(f => f.level === lvl).map(f => f.name) ?? []
                const isFightingStyleLevel = classFeatures.some(f => f.toLowerCase().includes('fighting style'))
                const expertiseLevelIdx = expertiseLevels.indexOf(lvl)

                let asiOrFeat: typeof rows[0]['asiOrFeat'] = null
                if (isAsiLevel) {
                  const feat = allFeatEntries[featIdx]
                  if (feat) {
                    asiOrFeat = { kind: 'feat', name: feat.featName, slug: feat.slug }
                    featIdx++
                  } else {
                    asiOrFeat = { kind: 'asi', note: `ASI #${++asiCount}` }
                  }
                }

                rows.push({
                  level: lvl,
                  hpRoll,
                  features: classFeatures,
                  subclassName: isSubclassLevel ? (subclassDef?.name ?? null) : null,
                  subclassFeatures: subclassFeatureNames,
                  asiOrFeat,
                  expertiseSkills: expertiseLevelIdx >= 0 ? expertiseSkillsForLevel(expertiseLevelIdx) : [],
                  fightingStyleName: isFightingStyleLevel && fightingStyleDef ? fightingStyleDef.name : null,
                })
              }

              return { clsName, hitDie, rows, cc }
            })

            return (
              <div className="card overflow-hidden order-0">
                <button
                  type="button"
                  onClick={() => setJourneyOpen(o => !o)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-parchment-50"
                >
                  <h2 className="section-header mb-0">Level Journey</h2>
                  <span className="text-parchment-400 text-sm">{journeyOpen ? '▲' : '▼'}</span>
                </button>
                {journeyOpen && (
                  <div className="px-4 pb-4 space-y-5 border-t border-parchment-100 pt-3">
                    {classJourneys.map(({ clsName, hitDie, rows, cc }) => (
                      <div key={cc.classSlug}>
                        {char.classes.length > 1 && (
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs font-bold text-parchment-600 uppercase tracking-wider">{clsName}</span>
                            <div className="flex-1 h-px bg-parchment-200" />
                            {cc.subclassSlug && (
                              <span className="text-xs text-parchment-500">{CLASS_OPTIONS[cc.classSlug]?.subclasses.find(s => s.slug === cc.subclassSlug)?.name ?? cc.subclassSlug}</span>
                            )}
                          </div>
                        )}
                        <div className="space-y-1.5">
                          {rows.map(row => {
                            const hasContent = row.features.length > 0 || row.subclassName || row.subclassFeatures.length > 0 || row.asiOrFeat || row.expertiseSkills.length > 0 || row.fightingStyleName
                            return (
                              <div key={row.level} className={`flex gap-3 text-sm rounded-lg px-3 py-2 ${row.subclassName ? 'bg-purple-50 border border-purple-100' : row.asiOrFeat?.kind === 'feat' ? 'bg-amber-50 border border-amber-100' : row.asiOrFeat?.kind === 'asi' ? 'bg-blue-50 border border-blue-100' : 'bg-parchment-50'}`}>
                                {/* Level badge */}
                                <div className="shrink-0 flex flex-col items-center gap-0.5 w-10">
                                  <span className="text-xs font-bold text-parchment-500 leading-none">Lv</span>
                                  <span className="text-lg font-bold text-parchment-800 leading-none">{row.level}</span>
                                </div>
                                {/* Content */}
                                <div className="flex-1 min-w-0 space-y-1 py-0.5">
                                  {/* HP */}
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {row.hpRoll !== null && (
                                      <span className={`text-xs font-semibold rounded px-1.5 py-0.5 ${row.level === 1 ? 'bg-red-100 text-red-700' : 'bg-parchment-100 text-parchment-600'}`}>
                                        {row.level === 1 ? `HP: ${row.hpRoll}` : `+${row.hpRoll} HP`}
                                        {row.level === 1 && <span className="font-normal text-red-500 ml-0.5">(d{hitDie} max)</span>}
                                      </span>
                                    )}
                                    {/* Subclass */}
                                    {row.subclassName && (
                                      <span className="text-xs font-semibold bg-purple-200 text-purple-800 rounded px-1.5 py-0.5">
                                        {row.subclassName}
                                      </span>
                                    )}
                                    {/* ASI or Feat */}
                                    {row.asiOrFeat?.kind === 'feat' && (
                                      <span className="text-xs font-semibold bg-amber-200 text-amber-800 rounded px-1.5 py-0.5" title={`Feat: ${row.asiOrFeat.slug}`}>
                                        Feat: {row.asiOrFeat.name}
                                      </span>
                                    )}
                                    {row.asiOrFeat?.kind === 'asi' && (
                                      <span className="text-xs font-semibold bg-blue-200 text-blue-800 rounded px-1.5 py-0.5">
                                        Ability Score Improvement
                                      </span>
                                    )}
                                    {/* Fighting style */}
                                    {row.fightingStyleName && (
                                      <span className="text-xs bg-slate-100 text-slate-700 rounded px-1.5 py-0.5">
                                        Style: {row.fightingStyleName}
                                      </span>
                                    )}
                                    {/* Expertise */}
                                    {row.expertiseSkills.length > 0 && (
                                      <span className="text-xs bg-indigo-100 text-indigo-700 rounded px-1.5 py-0.5">
                                        Expertise: {row.expertiseSkills.map(s => SKILL_LABELS[s as keyof typeof SKILL_LABELS] ?? s).join(', ')}
                                      </span>
                                    )}
                                  </div>
                                  {/* Class + subclass features */}
                                  {(row.features.length > 0 || row.subclassFeatures.length > 0) && (
                                    <div className="flex flex-wrap gap-1">
                                      {row.features.map(f => (
                                        <span key={f} className="text-[11px] text-parchment-600 bg-parchment-100 rounded px-1.5 py-0.5">{f}</span>
                                      ))}
                                      {row.subclassFeatures.map(f => (
                                        <span key={f} className="text-[11px] text-purple-700 bg-purple-100 rounded px-1.5 py-0.5">{f}</span>
                                      ))}
                                    </div>
                                  )}
                                  {!hasContent && <span className="text-xs text-parchment-300 italic">—</span>}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })()}

          {/* Race features */}
          {(() => {
            const race = content.races.find(r => r.slug === char.raceSlug)
            if (!race) return null
            const featSubraceOpts = raceDef?.subraces?.find(s => s.slug === char.subraceSlug)
            const dragonChoice = char.featuresChosen.find(fc => fc.key === 'dragonborn-ancestry')
            const dragonSlug = typeof dragonChoice?.value === 'string' ? dragonChoice.value : null
            const dragonInfo = dragonSlug ? DRACONIC_ANCESTRIES.find(d => d.slug === dragonSlug) : null
            return (
              <div className="card order-2">
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="section-header mb-0">{race.name} Traits</h2>
                  {featSubraceOpts && <span className="text-sm text-parchment-500 font-medium">— {featSubraceOpts.name}</span>}
                  {race.size && <span className="text-xs bg-parchment-100 text-parchment-600 rounded px-2 py-0.5">{race.size}</span>}
                  {race.speed > 0 && <span className="text-xs bg-parchment-100 text-parchment-600 rounded px-2 py-0.5">{race.speed}ft speed</span>}
                </div>
                {/* Ability bonuses */}
                {(race.abilityBonuses && Object.keys(race.abilityBonuses).length > 0 || race.chooseAbilityBonuses) && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {Object.entries(race.abilityBonuses ?? {}).map(([ab, val]) => (
                      <span key={ab} className="text-xs bg-green-100 text-green-700 border border-green-300 rounded px-2 py-0.5 font-semibold">
                        +{val} {ABILITY_LABELS[ab] ?? ab.toUpperCase()}
                      </span>
                    ))}
                    {race.chooseAbilityBonuses ? (
                      <span className="text-xs bg-green-100 text-green-700 border border-green-300 rounded px-2 py-0.5">
                        +1 to {race.chooseAbilityBonuses} ability score{race.chooseAbilityBonuses !== 1 ? 's' : ''} of choice
                      </span>
                    ) : null}
                  </div>
                )}
                {/* Granted skill proficiencies */}
                {race.grantedSkills && race.grantedSkills.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3 items-center">
                    <span className="text-xs text-parchment-500">Prof:</span>
                    {race.grantedSkills.map(s => (
                      <span key={s} className="text-xs bg-indigo-100 text-indigo-700 border border-indigo-200 rounded px-2 py-0.5 capitalize">{s}</span>
                    ))}
                  </div>
                )}
                {/* Languages */}
                {(race.grantedLanguages ?? race.languages).length > 0 && (
                  <p className="text-xs text-parchment-400 mb-3">Languages: {(race.grantedLanguages ?? race.languages).join(', ')}</p>
                )}
                {/* Innate spells from race */}
                {race.grantedSpells && race.grantedSpells.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3 items-center">
                    <span className="text-xs text-parchment-500">Innate Spells:</span>
                    {race.grantedSpells.map(s => (
                      <span key={s.slug} className="text-xs bg-violet-100 text-violet-700 border border-violet-200 rounded px-2 py-0.5">
                        {s.name}{s.usesPerLongRest ? ` (${s.usesPerLongRest}/LR)` : ' (at will)'}
                      </span>
                    ))}
                  </div>
                )}
                {(() => {
                  const traitList = (race.traits.length > 0 ? race.traits : null)
                    ?? race.traits
                      .filter(t => t.endsWith('.') && t !== 'Ability Score Increase.' && t !== 'Alignment.')
                      .map(t => t.slice(0, -1))
                  if (traitList.length === 0) return null
                  return (
                    <div className="space-y-2 mb-3">
                      {traitList.map(t => (
                        <div key={t} className="p-2 rounded border border-parchment-100 text-sm">{t}</div>
                      ))}
                    </div>
                  )
                })()}
                {/* Subrace traits */}
                {featSubraceOpts && (featSubraceOpts.traits.length > 0 || (featSubraceOpts.abilityBonuses && Object.keys(featSubraceOpts.abilityBonuses).length > 0)) && (
                  <div className="mb-3">
                    <div className="text-xs uppercase text-parchment-500 mb-1">{featSubraceOpts.name} Traits</div>
                    {featSubraceOpts.abilityBonuses && Object.keys(featSubraceOpts.abilityBonuses).length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {Object.entries(featSubraceOpts.abilityBonuses).map(([ab, val]) => (
                          <span key={ab} className="text-xs bg-green-100 text-green-700 border border-green-300 rounded px-2 py-0.5 font-semibold">
                            +{val} {ABILITY_LABELS[ab] ?? ab.toUpperCase()}
                          </span>
                        ))}
                      </div>
                    )}
                    {featSubraceOpts.traits.length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {featSubraceOpts.traits.map(t => (
                          <div key={t} className="p-2 rounded border border-amber-200 bg-amber-50 text-sm">{t}</div>
                        ))}
                      </div>
                    )}
                    {featSubraceOpts.grantedSpells && featSubraceOpts.grantedSpells.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2 items-center">
                        <span className="text-xs text-parchment-500">Innate Spells:</span>
                        {featSubraceOpts.grantedSpells.map(s => (
                          <span key={s.slug} className="text-xs bg-violet-100 text-violet-700 border border-violet-200 rounded px-2 py-0.5">
                            {s.name}{s.usesPerLongRest ? ` (${s.usesPerLongRest}/LR)` : ' (at will)'}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {/* Dragonborn ancestry */}
                {dragonInfo && (
                  <div className="p-2 rounded border border-parchment-200 bg-parchment-50 text-sm">
                    <span className="font-medium">Draconic Ancestry: {dragonInfo.name}</span>
                    <span className="text-parchment-500 ml-2">— {dragonInfo.damageType} damage, {dragonInfo.breathShape} breath weapon</span>
                  </div>
                )}
              </div>
            )
          })()}

          {/* Class features */}
          <div className="order-1 flex flex-col gap-4">
          {char.classes.map(cc => {
            const cls = content.classes.find(c => c.slug === cc.classSlug)
            if (!cls) return null
            const classOptsDef = CLASS_OPTIONS[cc.classSlug]
            const features = (classOptsDef?.features ?? cls.features).filter(f => f.level <= cc.level)
            const fightingStyleChoice = char.featuresChosen.find(fc => fc.key === 'fighting-style' || fc.key === `fighting-style-${cc.classSlug}`)
            const fightingStyleSlug = typeof fightingStyleChoice?.value === 'string' ? fightingStyleChoice.value : null
            const chosenStyle = classOptsDef?.fightingStyles?.find(s => s.slug === fightingStyleSlug)
            const subclassEntry = cc.subclassSlug
              ? classOptsDef?.subclasses.find(s => s.slug === cc.subclassSlug)
              : null
            return (
              <div key={cc.classSlug} className="card">
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <h2 className="section-header mb-0">{cls.name} Features</h2>
                  <span className="text-xs bg-parchment-200 text-parchment-700 rounded px-2 py-0.5">Levels 1–{cc.level}</span>
                  {classOptsDef?.hitDie && (
                    <span className="text-xs bg-parchment-100 text-parchment-600 rounded px-2 py-0.5">d{classOptsDef.hitDie}</span>
                  )}
                  {subclassEntry && (
                    <span className="text-xs bg-indigo-100 text-indigo-700 rounded px-2 py-0.5">{subclassEntry.name}</span>
                  )}
                </div>

                {/* Class summary: primary ability, saves, proficiencies */}
                {classOptsDef && (
                  <div className="mb-3 p-3 rounded border border-parchment-100 bg-parchment-50 text-xs text-parchment-600 space-y-1">
                    <div><span className="font-semibold text-parchment-700">Primary Ability:</span> {classOptsDef.primaryAbility}</div>
                    <div><span className="font-semibold text-parchment-700">Saving Throws:</span> {classOptsDef.savingThrows.join(', ')}</div>
                    <div><span className="font-semibold text-parchment-700">Armor:</span> {classOptsDef.armorTraining}</div>
                    <div><span className="font-semibold text-parchment-700">Weapons:</span> {classOptsDef.weaponTraining}</div>
                    {classOptsDef.toolProficiency && (
                      <div><span className="font-semibold text-parchment-700">Tools:</span> {classOptsDef.toolProficiency}</div>
                    )}
                    <div><span className="font-semibold text-parchment-700">Skills:</span> Choose {classOptsDef.numSkillChoices} from {classOptsDef.skillChoices.join(', ')}</div>
                  </div>
                )}

                {subclassEntry?.description && (
                  <p className="text-sm text-parchment-500 mb-3 italic">{subclassEntry.description}</p>
                )}
                {subclassEntry?.grantedProficiencies && (() => {
                  const gp = subclassEntry.grantedProficiencies
                  const skills = (gp.skills ?? []).map(s => SKILL_LABELS[s as keyof typeof SKILL_LABELS] ?? s)
                  const items = [...skills, ...(gp.tools ?? [])]
                  if (items.length === 0 && !gp.languages) return null
                  return (
                    <div className="mb-3 flex items-center gap-1.5 flex-wrap text-xs">
                      <span className="font-semibold text-parchment-600">Granted Proficiencies:</span>
                      {items.map(p => (
                        <span key={p} className="bg-emerald-50 text-emerald-700 border border-emerald-200 rounded px-1.5 py-0.5">{p}</span>
                      ))}
                      {gp.languages ? <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 rounded px-1.5 py-0.5">+{gp.languages} language{gp.languages > 1 ? 's' : ''}</span> : null}
                    </div>
                  )
                })()}
                {subclassEntry?.features && subclassEntry.features.filter(f => f.level <= cc.level).map(f => (
                  <div key={`sub-${f.level}-${f.name}`} className="mb-3 p-3 rounded border border-indigo-100 bg-indigo-50/40">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs bg-indigo-100 text-indigo-600 rounded px-1.5 py-0.5 shrink-0">Lvl {f.level}</span>
                      <span className="font-medium text-indigo-900">{f.name}</span>
                    </div>
                    {f.name === 'Eldritch Cannon' ? (
                      (() => {
                        const artLevel = cc.level
                        const cannonMaxHp = artLevel * 5
                        const activeCannons = char.summons.filter(s => s.templateKey === 'eldritch-cannon')
                        const cannonCount = activeCannons.length
                        const maxCannons = artLevel >= 15 ? 2 : 1
                        const hasActiveCannon = cannonCount > 0
                        const atCannonCap = cannonCount >= maxCannons
                        const intMod = abilityModFor(char, 'int')
                        const dc = spellSaveDC(effectiveChar, 'artificer', content) + itemBonuses.spellDCBonus
                        const atkBonus = spellAttackBonus(effectiveChar, 'artificer', content) + itemBonuses.spellAttackBonus
                        const freeUsed = (char.classResources['cannon-free-used'] ?? 0) >= 1

                        const CANNON_TYPES = [
                          {
                            key: 'flamethrower', label: 'Flamethrower', color: 'text-orange-700',
                            border: 'border-orange-200 hover:border-orange-400', bg: 'bg-orange-50 hover:bg-orange-100',
                            summary: `15 ft cone · DEX save DC ${dc} · 2d8 fire`,
                            attacks: [] as Summon['attacks'],
                            abilities: [{ name: 'Flamethrower', description: `15 ft cone — DEX save DC ${dc} or 2d8 fire, half on success. Ignites flammable objects.` }],
                          },
                          {
                            key: 'force-ballista', label: 'Force Ballista', color: 'text-blue-700',
                            border: 'border-blue-200 hover:border-blue-400', bg: 'bg-blue-50 hover:bg-blue-100',
                            summary: `Ranged spell atk · 120 ft · 2d8 force · push 5 ft`,
                            attacks: [{ name: 'Force Ballista', toHit: atkBonus, damage: '2d8', damageType: 'force', range: '120 ft', notes: 'Pushes target 5 ft on hit' }] as Summon['attacks'],
                            abilities: [],
                          },
                          {
                            key: 'protector', label: 'Protector', color: 'text-green-700',
                            border: 'border-green-200 hover:border-green-400', bg: 'bg-green-50 hover:bg-green-100',
                            summary: `Aura 10 ft · 1d8${intMod >= 0 ? `+${intMod}` : intMod} temp HP`,
                            attacks: [] as Summon['attacks'],
                            abilities: [{ name: 'Protector', description: `Aura 10 ft — grants 1d8${intMod >= 0 ? `+${intMod}` : intMod} temp HP to cannon and chosen creatures within 10 ft.` }],
                          },
                        ]

                        const summonCannon = (typeKey: string) => {
                          const ct = CANNON_TYPES.find(t => t.key === typeKey)!
                          const cannon: Summon = {
                            id: Math.random().toString(36).slice(2, 10),
                            name: `Eldritch Cannon — ${ct.label}`,
                            templateKey: 'eldritch-cannon',
                            hp: { current: cannonMaxHp, max: cannonMaxHp },
                            ac: 18, speed: 15,
                            saveProficiencies: [],
                            immunities: ['poison', 'psychic'],
                            resistances: [],
                            attacks: ct.attacks,
                            abilities: [
                              ...ct.abilities,
                              { name: 'Mending', description: 'Casting Mending on the cannon restores 2d6 HP.' },
                              ...(artLevel >= 9 ? [{ name: 'Explosive Cannon', description: `Action to detonate (60 ft) — 3d8 force, DC ${dc} DEX save for half.` }] : []),
                            ],
                            notes: `Artificer level ${artLevel}. Bonus action to activate (60 ft). ${freeUsed ? 'Spell slot expended.' : 'Free creation used.'}`,
                          }
                          patch({
                            summons: [...char.summons, cannon],
                            classResources: { ...char.classResources, 'cannon-free-used': 1 },
                          })
                          setTab('summons')
                        }

                        return (
                          <>
                            {/* Free creation indicator */}
                            <div className={`flex items-center gap-2 p-2 rounded border text-xs mb-3 ${freeUsed ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${freeUsed ? 'bg-amber-400' : 'bg-green-500'}`} />
                              <span className={`font-medium ${freeUsed ? 'text-amber-700' : 'text-green-700'}`}>
                                {freeUsed ? 'Free creation used — must expend a spell slot to summon again' : 'Free creation available (1 / long rest)'}
                              </span>
                              <button type="button"
                                className="ml-auto text-[10px] underline opacity-60 hover:opacity-100 transition-opacity"
                                onClick={() => patch({ classResources: { ...char.classResources, 'cannon-free-used': freeUsed ? 0 : 1 } })}>
                                {freeUsed ? 'Restore' : 'Mark used'}
                              </button>
                            </div>

                            {/* Active cannons summary */}
                            {hasActiveCannon && (
                              <div className="flex items-center gap-3 p-3 rounded border border-indigo-200 bg-indigo-50 mb-3">
                                <div className="flex-1 text-xs text-indigo-700 space-y-0.5">
                                  {activeCannons.map(c => (
                                    <div key={c.id} className="flex items-center gap-1.5">
                                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                                      <span>{c.name}</span>
                                      <span className="text-indigo-400">— {c.hp.current}/{c.hp.max} HP</span>
                                    </div>
                                  ))}
                                </div>
                                <button type="button" onClick={() => setTab('summons')}
                                  className="shrink-0 text-xs bg-indigo-600 text-white rounded px-3 py-1.5 hover:bg-indigo-700 font-semibold transition-colors">
                                  View in Summons →
                                </button>
                              </div>
                            )}

                            {/* Type picker — shown when under the cap */}
                            {!atCannonCap && (
                              <>
                                <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1.5">
                                  {hasActiveCannon ? 'Summon second cannon' : 'Choose type to summon'} — HP {cannonMaxHp} · AC 18 · Speed 15 ft
                                  {artLevel >= 15 && <span className="ml-2 text-amber-500">Fortified Position: {cannonCount}/{maxCannons} active</span>}
                                </div>
                                <div className="grid grid-cols-3 gap-2 mb-3">
                                  {CANNON_TYPES.map(ct => (
                                    <button key={ct.key} type="button" onClick={() => summonCannon(ct.key)}
                                      className={`p-2.5 rounded border text-left transition-colors ${ct.border} ${ct.bg}`}>
                                      <div className={`text-xs font-bold ${ct.color}`}>{ct.label}</div>
                                      <div className="text-[10px] text-parchment-500 mt-0.5 leading-tight">{ct.summary}</div>
                                    </button>
                                  ))}
                                </div>
                              </>
                            )}

                            {atCannonCap && artLevel >= 15 && (
                              <p className="text-xs text-indigo-500 italic mb-3">Both cannons active (Fortified Position cap reached).</p>
                            )}
                          </>
                        )
                      })()
                    ) : f.name === 'Wildfire Spirit' ? (
                      (() => {
                        const druidLevel = cc.level
                        const spiritMaxHp = 5 * druidLevel
                        const wisMod = abilityModFor(char, 'wis')
                        const wisStr = wisMod >= 0 ? `+${wisMod}` : `${wisMod}`
                        const dc = spellSaveDC(effectiveChar, 'druid', content) + itemBonuses.spellDCBonus
                        const atkBonus = spellAttackBonus(effectiveChar, 'druid', content) + itemBonuses.spellAttackBonus
                        const activeSpirits = char.summons.filter(s => s.templateKey === 'wildfire-spirit')
                        const hasActiveSpirit = activeSpirits.length > 0
                        const wildShapeLeft = char.classResources['wild-shape'] ?? 2

                        const summonSpirit = () => {
                          const spirit: Summon = {
                            id: Math.random().toString(36).slice(2, 10),
                            name: 'Wildfire Spirit',
                            templateKey: 'wildfire-spirit',
                            hp: { current: spiritMaxHp, max: spiritMaxHp },
                            ac: 13, speed: 30,
                            abilityScores: { str: 10, dex: 14, con: 14, int: 13, wis: 15, cha: 11 },
                            saveProficiencies: [],
                            immunities: ['fire'],
                            resistances: [],
                            attacks: [
                              { name: 'Flame Seed', toHit: atkBonus, damage: `1d6${wisStr}`, damageType: 'fire', range: '30 ft', notes: 'Ranged spell attack' },
                            ],
                            abilities: [
                              { name: 'Fiery Teleportation', description: `Bonus action — teleport the spirit and up to 5 willing creatures within 5 ft to unoccupied spaces within 15 ft. Each creature within 10 ft of the space the spirit left makes a DEX save (DC ${dc}) or takes 1d6${wisStr} fire damage.` },
                              { name: 'Summon', description: 'Bonus action to command its action. Lasts 1 hour, until it drops to 0 HP, or until you summon again. Can\'t be charmed or frightened.' },
                            ],
                            notes: `Druid level ${druidLevel}. Costs 1 Wild Shape charge to summon. Flies 30 ft (hover). Immune to fire.`,
                          }
                          patch({
                            summons: [...char.summons.filter(s => s.templateKey !== 'wildfire-spirit'), spirit],
                            classResources: { ...char.classResources, 'wild-shape': Math.max(0, wildShapeLeft - 1) },
                          })
                          setTab('summons')
                        }

                        return (
                          <>
                            {f.description && <p className="text-sm text-parchment-600 mb-3">{f.description}</p>}

                            {/* Wild Shape charge indicator */}
                            <div className={`flex items-center gap-2 p-2 rounded border text-xs mb-3 ${wildShapeLeft > 0 ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${wildShapeLeft > 0 ? 'bg-green-500' : 'bg-amber-400'}`} />
                              <span className={`font-medium ${wildShapeLeft > 0 ? 'text-green-700' : 'text-amber-700'}`}>
                                {wildShapeLeft > 0 ? `Wild Shape charges: ${wildShapeLeft}` : 'No Wild Shape charges — short rest to recharge'}
                              </span>
                            </div>

                            {/* Active spirit summary */}
                            {hasActiveSpirit && (
                              <div className="flex items-center gap-3 p-3 rounded border border-indigo-200 bg-indigo-50 mb-3">
                                <div className="flex-1 text-xs text-indigo-700 space-y-0.5">
                                  {activeSpirits.map(s => (
                                    <div key={s.id} className="flex items-center gap-1.5">
                                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                                      <span>{s.name}</span>
                                      <span className="text-indigo-400">— {s.hp.current}/{s.hp.max} HP</span>
                                    </div>
                                  ))}
                                </div>
                                <button type="button" onClick={() => setTab('summons')}
                                  className="shrink-0 text-xs bg-indigo-600 text-white rounded px-3 py-1.5 hover:bg-indigo-700 font-semibold transition-colors">
                                  View in Summons →
                                </button>
                              </div>
                            )}

                            <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1.5">
                              {hasActiveSpirit ? 'Resummon' : 'Summon'} — HP {spiritMaxHp} · AC 13 · Speed 30 ft (fly)
                            </div>
                            <button type="button" onClick={summonSpirit}
                              className="w-full p-2.5 rounded border text-left transition-colors border-orange-200 hover:border-orange-400 bg-orange-50 hover:bg-orange-100 mb-3">
                              <div className="text-xs font-bold text-orange-700">Summon Wildfire Spirit</div>
                              <div className="text-[10px] text-parchment-500 mt-0.5 leading-tight">
                                Flame Seed: ranged spell atk {atkBonus >= 0 ? `+${atkBonus}` : atkBonus} · 1d6{wisStr} fire · 30 ft. Fiery Teleportation: DC {dc} DEX or 1d6{wisStr} fire.
                              </div>
                            </button>
                          </>
                        )
                      })()
                    ) : (
                      f.description && <p className="text-sm text-parchment-600">{f.description}</p>
                    )}
                  </div>
                ))}
                {features.map(f => {
                  const isFightingStyle = f.name === 'Fighting Style'
                  return (
                    <div key={`${f.level}-${f.name}`} className="mb-3 p-3 rounded border border-parchment-100">
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-parchment-200 text-parchment-700 rounded px-1.5 py-0.5 shrink-0">Lvl {f.level}</span>
                        <span className="font-medium">{f.name}</span>
                      </div>
                      {f.description && <p className="text-sm text-parchment-600 mt-1">{f.description}</p>}
                      {isFightingStyle && chosenStyle && (
                        <div className="mt-2 pl-3 border-l-2 border-amber-300">
                          <div className="text-sm font-medium text-amber-700">Chosen: {chosenStyle.name}</div>
                          <div className="text-xs text-parchment-500 mt-0.5">{chosenStyle.description}</div>
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* Rogue: Sneak Attack */}
                {cc.classSlug === 'rogue' && sneakDice > 0 && (
                  <div className="mb-3 p-3 rounded border border-red-100 bg-red-50">
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-sm text-red-800">Sneak Attack</div>
                      <div className="text-xl font-bold text-red-700">{sneakDice}d6</div>
                    </div>
                    <p className="text-xs text-red-600 mt-1">Once per turn when you hit with a finesse/ranged weapon and have advantage or a nearby ally.</p>
                  </div>
                )}

                {/* Warlock: Pact Boon */}
                {cc.classSlug === 'warlock' && (() => {
                  const fc = char.featuresChosen.find(f => f.key === 'pact-boon')
                  const boon = typeof fc?.value === 'string' ? fc.value : null
                  const BOON_LABELS: Record<string, string> = { blade: 'Pact of the Blade', chain: 'Pact of the Chain', tome: 'Pact of the Tome' }
                  const BOON_DESC: Record<string, string> = {
                    blade: 'Summon a pact weapon. Use CHA for attack/damage (with Hex Warrior). Pact weapon is magical.',
                    chain: 'Find Familiar — can take imp, pseudodragon, quasit, or sprite form. Familiar can attack on reaction.',
                    tome: 'Book of Shadows: gain 3 cantrips from any class list. Required for Book of Ancient Secrets.',
                  }
                  if (!boon) return (
                    cc.level >= 3
                      ? <div className="mb-3 p-3 rounded border border-indigo-100 bg-indigo-50 text-xs text-indigo-600">No Pact Boon recorded — level up to choose one.</div>
                      : null
                  )
                  return (
                    <div className="mb-3 p-3 rounded border border-indigo-200 bg-indigo-50">
                      <div className="font-medium text-sm text-indigo-800">{BOON_LABELS[boon] ?? boon}</div>
                      <p className="text-xs text-indigo-600 mt-1">{BOON_DESC[boon] ?? ''}</p>
                    </div>
                  )
                })()}

                {/* Battle Master: Maneuvers */}
                {cc.classSlug === 'fighter' && cc.subclassSlug === 'battle-master' && (() => {
                  const fc = char.featuresChosen.find(f => f.key === 'maneuvers')
                  const slugs: string[] = !fc ? [] : Array.isArray(fc.value) ? fc.value : [fc.value]
                  if (slugs.length === 0) return null
                  return (
                    <div className="mb-3 p-3 rounded border border-amber-100 bg-amber-50">
                      <div className="font-medium text-sm text-amber-800 mb-2">Maneuvers Known ({slugs.length})</div>
                      <div className="space-y-1">
                        {slugs.map(slug => {
                          const m = BATTLE_MASTER_MANEUVERS.find(x => x.slug === slug)
                          return (
                            <div key={slug} className="text-sm">
                              <span className="font-medium">{m?.name ?? slug}</span>
                              {m?.description && <span className="text-xs text-parchment-500 ml-2">— {m.description}</span>}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()}

                {/* Ranger: Favored Enemy & Natural Explorer */}
                {cc.classSlug === 'ranger' && (() => {
                  const enemies = char.featuresChosen
                    .filter(f => f.key.startsWith('favored-enemy-'))
                    .map(f => typeof f.value === 'string' ? f.value : '')
                    .filter(Boolean)
                  const terrains = char.featuresChosen
                    .filter(f => f.key.startsWith('favored-terrain-'))
                    .map(f => typeof f.value === 'string' ? f.value : '')
                    .filter(Boolean)
                  if (enemies.length === 0 && terrains.length === 0) return null
                  return (
                    <div className="mb-3 p-3 rounded border border-green-100 bg-green-50">
                      {enemies.length > 0 && (
                        <div className="mb-1.5">
                          <div className="text-xs font-bold text-green-700 uppercase tracking-wide mb-1">Favored Enemies</div>
                          <div className="flex flex-wrap gap-1">
                            {enemies.map(e => <span key={e} className="text-xs bg-green-100 text-green-800 rounded px-2 py-0.5">{e}</span>)}
                          </div>
                        </div>
                      )}
                      {terrains.length > 0 && (
                        <div>
                          <div className="text-xs font-bold text-green-700 uppercase tracking-wide mb-1">Favored Terrains</div>
                          <div className="flex flex-wrap gap-1">
                            {terrains.map(t => <span key={t} className="text-xs bg-green-100 text-green-800 rounded px-2 py-0.5">{t}</span>)}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })()}

                {/* Monk: Martial Arts + Ki summary */}
                {cc.classSlug === 'monk' && (() => {
                  const maDie = `d${cc.level >= 17 ? 10 : cc.level >= 11 ? 8 : cc.level >= 5 ? 6 : 4}`
                  const kiSaveDC = 8 + profBonus(char) + Math.max(0, abilityModFor(char, 'wis'))
                  return (
                    <div className="mb-3 p-3 rounded border border-amber-100 bg-amber-50">
                      <div className="font-medium text-sm text-amber-800 mb-2">Monk — Martial Arts</div>
                      <div className="flex gap-4 mb-2 flex-wrap">
                        <div><div className="text-xs text-parchment-500">Martial Arts die</div><div className="text-lg font-bold text-amber-700">{maDie}</div></div>
                        <div><div className="text-xs text-parchment-500">Ki save DC</div><div className="text-lg font-bold text-amber-700">{kiSaveDC}</div></div>
                        <div><div className="text-xs text-parchment-500">Unarmored Movement</div><div className="text-lg font-bold text-amber-700">+{monkSpeedBonus(char)}ft</div></div>
                      </div>
                      <div className="text-xs text-parchment-600 space-y-0.5">
                        <div>• <strong>Flurry of Blows</strong> (2 ki): two bonus-action unarmed strikes</div>
                        <div>• <strong>Patient Defense</strong> (1 ki): Dodge as bonus action</div>
                        <div>• <strong>Step of the Wind</strong> (1 ki): Disengage or Dash as bonus action; jump distance doubled</div>
                        {cc.level >= 4 && <div>• <strong>Slow Fall</strong> (1 ki reaction): reduce fall damage by 5×level</div>}
                        {cc.level >= 5 && <div>• <strong>Stunning Strike</strong> (1 ki on hit): CON save DC {kiSaveDC} or stunned until end of your next turn</div>}
                        {cc.level >= 6 && <div>• <strong>Deflect Missiles</strong> (1 ki): after reducing to 0 damage, catch and redirect (30ft, 1d10+DEX+{cc.level})</div>}
                        {cc.level >= 7 && <div>• <strong>Evasion</strong>: DEX save → no damage on success; half on fail</div>}
                        {cc.level >= 14 && <div>• <strong>Diamond Soul</strong>: proficient in all saves; 1 ki to reroll a failed save</div>}
                        {cc.level >= 15 && <div>• <strong>Timeless Body</strong>: immune to magical aging; always have enough food and water</div>}
                        {cc.level >= 18 && <div>• <strong>Empty Body</strong> (4 ki, 1 min): invisible + resist all dmg except force; 8 ki to cast Astral Projection without components</div>}
                      </div>
                    </div>
                  )
                })()}

                {/* Monk: Subclass feature cards */}
                {cc.classSlug === 'monk' && cc.subclassSlug === 'open-hand' && (() => (
                  <div className="mb-3 p-3 rounded border border-amber-200 bg-amber-50">
                    <div className="font-medium text-sm text-amber-800 mb-1">Open Hand Technique</div>
                    <p className="text-xs text-amber-700">When you hit with Flurry of Blows: DEX save or <strong>prone</strong>, STR save or <strong>pushed 15ft</strong>, or <strong>can't take reactions</strong> until end of their next turn (your choice).</p>
                    {cc.level >= 6 && <p className="text-xs text-amber-600 mt-1"><strong>Wholeness of Body</strong> (1/LR): heal yourself for 3× Monk level HP as an action.</p>}
                    {cc.level >= 11 && <p className="text-xs text-amber-600 mt-1"><strong>Tranquility</strong>: cast Sanctuary on yourself at end of each rest (lasts until you attack or cast a spell).</p>}
                    {cc.level >= 17 && <p className="text-xs text-amber-600 mt-1"><strong>Quivering Palm</strong> (3 ki): on unarmed hit, set harmonic vibrations. As an action (any time), force CON save DC {8 + profBonus(char) + Math.max(0, abilityModFor(char, 'wis'))} or drop to 0 HP (half on success).</p>}
                  </div>
                ))()}

                {cc.classSlug === 'monk' && cc.subclassSlug === 'four-elements' && (() => {
                  const fc = char.featuresChosen.find(f => f.key === 'four-elements')
                  const slugs: string[] = !fc ? [] : Array.isArray(fc.value) ? fc.value : [fc.value]
                  return (
                    <div className="mb-3 p-3 rounded border border-orange-100 bg-orange-50">
                      <div className="font-medium text-sm text-orange-800 mb-2">Elemental Disciplines</div>
                      {slugs.length === 0 ? (
                        <p className="text-xs text-orange-600">No disciplines chosen — level up to select them.</p>
                      ) : (
                        <div className="space-y-1">
                          {slugs.map(slug => {
                            const d = FOUR_ELEMENTS_DISCIPLINES.find(x => x.slug === slug)
                            return (
                              <div key={slug} className="text-sm">
                                <span className="font-medium">{d?.name ?? slug}</span>
                                <span className="text-xs text-orange-600 ml-1">({d?.ki})</span>
                                {d?.description && <span className="text-xs text-parchment-500 ml-1">— {d.description}</span>}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })()}

                {cc.classSlug === 'monk' && cc.subclassSlug === 'shadow' && (() => (
                  <div className="mb-3 p-3 rounded border border-gray-200 bg-gray-50">
                    <div className="font-medium text-sm text-gray-800 mb-1">Shadow Arts</div>
                    <p className="text-xs text-gray-700">Spend 2 ki to cast: Darkness, Darkvision, Pass without Trace, or Silence (no spell slot).</p>
                    {cc.level >= 6 && <p className="text-xs text-gray-600 mt-1"><strong>Shadow Step</strong>: bonus action to teleport between dim-light/darkness areas within 60ft; gain advantage on next melee attack this turn.</p>}
                    {cc.level >= 11 && <p className="text-xs text-gray-600 mt-1"><strong>Cloak of Shadows</strong> (1 ki): while in darkness/dim light, become invisible until attack, cast, or bright light.</p>}
                    {cc.level >= 17 && <p className="text-xs text-gray-600 mt-1"><strong>Opportunist</strong>: reaction to attack a creature within 5ft that just took damage from another creature.</p>}
                  </div>
                ))()}

                {cc.classSlug === 'monk' && cc.subclassSlug === 'mercy' && (() => (
                  <div className="mb-3 p-3 rounded border border-teal-100 bg-teal-50">
                    <div className="font-medium text-sm text-teal-800 mb-1">Hands of Healing/Harm</div>
                    <p className="text-xs text-teal-700"><strong>Hand of Healing</strong> (1 ki): as part of Flurry of Blows or an action, touch a creature — restore 1d{cc.level >= 17 ? 10 : cc.level >= 11 ? 8 : cc.level >= 5 ? 6 : 4}+WIS HP.</p>
                    <p className="text-xs text-teal-700 mt-0.5"><strong>Hand of Harm</strong> (1 ki, 1/turn): when you hit with unarmed strike, deal extra 1d{cc.level >= 17 ? 10 : cc.level >= 11 ? 8 : cc.level >= 5 ? 6 : 4}+WIS necrotic and possibly poison the target (CON save).</p>
                    {cc.level >= 6 && <p className="text-xs text-teal-600 mt-1"><strong>Physician's Touch</strong>: Hand of Healing also ends one disease or condition; Hand of Harm also poisons.</p>}
                    {cc.level >= 11 && <p className="text-xs text-teal-600 mt-1"><strong>Flurry of Healing/Harm</strong>: use Hand of Healing/Harm with each Flurry hit, spending only 1 ki total.</p>}
                  </div>
                ))()}

                {/* Barbarian: subclass feature cards */}
                {cc.classSlug === 'barbarian' && cc.subclassSlug === 'totem-warrior' && (() => {
                  const spirit = char.featuresChosen.find(f => f.key === 'totem-spirit')
                  const aspect = char.featuresChosen.find(f => f.key === 'totem-aspect')
                  const attunement = char.featuresChosen.find(f => f.key === 'totem-attunement')
                  const getAnimal = (fc: typeof spirit) => {
                    const slug = typeof fc?.value === 'string' ? fc.value : null
                    return slug ? TOTEM_ANIMALS.find(a => a.slug === slug) : null
                  }
                  return (
                    <div className="mb-3 p-3 rounded border border-amber-200 bg-amber-50">
                      <div className="font-medium text-sm text-amber-800 mb-2">Totem Spirit</div>
                      {spirit ? (
                        <div className="mb-1.5">
                          <span className="text-xs font-semibold text-amber-700">Spirit (L3): </span>
                          <span className="text-xs font-medium">{getAnimal(spirit)?.name}</span>
                          <span className="text-xs text-parchment-500 ml-1">— {getAnimal(spirit)?.tierDescs.spirit}</span>
                        </div>
                      ) : cc.level >= 3 ? <p className="text-xs text-amber-600 mb-1">No totem spirit chosen — level up to select.</p> : null}
                      {aspect && cc.level >= 6 && (
                        <div className="mb-1.5">
                          <span className="text-xs font-semibold text-amber-700">Aspect (L6): </span>
                          <span className="text-xs font-medium">{getAnimal(aspect)?.name}</span>
                          <span className="text-xs text-parchment-500 ml-1">— {getAnimal(aspect)?.tierDescs.aspect}</span>
                        </div>
                      )}
                      {attunement && cc.level >= 14 && (
                        <div>
                          <span className="text-xs font-semibold text-amber-700">Attunement (L14): </span>
                          <span className="text-xs font-medium">{getAnimal(attunement)?.name}</span>
                          <span className="text-xs text-parchment-500 ml-1">— {getAnimal(attunement)?.tierDescs.attunement}</span>
                        </div>
                      )}
                    </div>
                  )
                })()}

                {cc.classSlug === 'barbarian' && cc.subclassSlug === 'storm-herald' && (() => {
                  const auraFC = char.featuresChosen.find(f => f.key === 'storm-aura')
                  const auraSlug = typeof auraFC?.value === 'string' ? auraFC.value : null
                  const auraDef = STORM_AURA_OPTIONS.find(a => a.slug === auraSlug)
                  return (
                    <div className="mb-3 p-3 rounded border border-sky-200 bg-sky-50">
                      <div className="font-medium text-sm text-sky-800 mb-1">Storm Herald</div>
                      {auraDef ? (
                        <>
                          <div className="text-xs font-semibold text-sky-700 mb-0.5">{auraDef.name} Aura</div>
                          <p className="text-xs text-sky-700">{auraDef.description}</p>
                          {cc.level >= 6 && <p className="text-xs text-sky-600 mt-1"><strong>Storm Soul:</strong> {auraDef.soulDesc}</p>}
                          {cc.level >= 10 && <p className="text-xs text-sky-600 mt-1"><strong>Shielding Storm:</strong> allies in your aura gain same resistance type.</p>}
                        </>
                      ) : <p className="text-xs text-sky-600">No storm aura chosen — level up to select.</p>}
                    </div>
                  )
                })()}

                {cc.classSlug === 'barbarian' && cc.subclassSlug === 'berserker' && (() => (
                  <div className="mb-3 p-3 rounded border border-red-200 bg-red-50">
                    <div className="font-medium text-sm text-red-800 mb-1">Path of the Berserker</div>
                    <p className="text-xs text-red-700"><strong>Frenzy:</strong> when you enter rage, choose to Frenzy — make one melee weapon attack as a bonus action each turn. <em>Costs 1 exhaustion level when rage ends.</em></p>
                    {cc.level >= 6 && <p className="text-xs text-red-600 mt-1"><strong>Mindless Rage:</strong> immune to charmed and frightened while raging.</p>}
                    {cc.level >= 10 && <p className="text-xs text-red-600 mt-1"><strong>Intimidating Presence:</strong> action — frighten one creature within 30ft (WIS save DC {8 + profBonus(char) + Math.max(0, abilityModFor(char, 'cha'))}).</p>}
                    {cc.level >= 14 && <p className="text-xs text-red-600 mt-1"><strong>Retaliation:</strong> reaction to melee attack a creature within 5ft that damages you.</p>}
                  </div>
                ))()}

                {cc.classSlug === 'barbarian' && cc.subclassSlug === 'zealot' && (() => {
                  const divineDie = `1d6+${Math.floor(cc.level / 2)}`
                  return (
                    <div className="mb-3 p-3 rounded border border-yellow-200 bg-yellow-50">
                      <div className="font-medium text-sm text-yellow-800 mb-1">Path of the Zealot</div>
                      <p className="text-xs text-yellow-800"><strong>Divine Fury:</strong> first hit each turn adds {divineDie} necrotic or radiant damage while raging.</p>
                      <p className="text-xs text-yellow-700 mt-0.5"><strong>Warrior of the Gods:</strong> spells that restore you to life need no material components.</p>
                      {cc.level >= 6 && <p className="text-xs text-yellow-700 mt-0.5"><strong>Fanatical Focus:</strong> 1/rage — reroll a failed save with your rage bonus (+{cc.level >= 16 ? 4 : cc.level >= 9 ? 3 : 2}).</p>}
                      {cc.level >= 14 && <p className="text-xs text-yellow-700 mt-0.5"><strong>Rage Beyond Death:</strong> while raging, 0 HP doesn't knock you unconscious — you die when rage ends at 0 HP.</p>}
                    </div>
                  )
                })()}

                {cc.classSlug === 'barbarian' && cc.subclassSlug === 'ancestral-guardian' && (() => (
                  <div className="mb-3 p-3 rounded border border-blue-200 bg-blue-50">
                    <div className="font-medium text-sm text-blue-800 mb-1">Ancestral Guardian</div>
                    <p className="text-xs text-blue-700"><strong>Ancestral Protectors:</strong> first creature you hit while raging has disadvantage on attacks vs. others and targets get resistance to its damage (until your next turn).</p>
                    {cc.level >= 6 && <p className="text-xs text-blue-600 mt-1"><strong>Spirit Shield:</strong> reaction (when ally takes damage within 30ft) — reduce damage by {cc.level >= 14 ? '4d6' : cc.level >= 10 ? '3d6' : '2d6'}.</p>}
                    {cc.level >= 10 && <p className="text-xs text-blue-600 mt-1"><strong>Consult the Spirits:</strong> cast Clairvoyance 1/SR without a spell slot.</p>}
                    {cc.level >= 14 && <p className="text-xs text-blue-600 mt-1"><strong>Vengeful Ancestors:</strong> when Spirit Shield reduces damage, attacker takes that much force damage.</p>}
                  </div>
                ))()}

                {/* Rogue: Phantom subclass */}
                {cc.classSlug === 'rogue' && cc.subclassSlug === 'phantom' && (() => (
                  <div className="mb-3 p-3 rounded border border-purple-200 bg-purple-50">
                    <div className="font-medium text-sm text-purple-800 mb-1">Phantom</div>
                    <p className="text-xs text-purple-700"><strong>Wails from the Grave:</strong> after SA, deal half SA dice necrotic to a second creature within 30ft. WIS mod uses/LR.</p>
                    {cc.level >= 9 && (() => {
                      const tokens = char.classResources['soul-trinkets'] ?? 0
                      return <p className="text-xs text-purple-700 mt-0.5"><strong>Tokens of the Departed:</strong> {tokens}/{profBonus(char)} trinkets — advantage on death saves while holding one; can ask one question per trinket.</p>
                    })()}
                    {cc.level >= 13 && <p className="text-xs text-purple-600 mt-0.5"><strong>Ghost Walk (1/LR):</strong> bonus action — pass through creatures/objects, fly 10ft, resist B/P/S for 10 min.</p>}
                    {cc.level >= 17 && <p className="text-xs text-purple-600 mt-0.5"><strong>Death's Friend:</strong> Wails from the Grave now uses full SA dice. If you start a turn with no trinkets, one appears.</p>}
                  </div>
                ))()}

                {/* Ranger: Gloom Stalker */}
                {cc.classSlug === 'ranger' && cc.subclassSlug === 'gloom-stalker' && (() => (
                  <div className="mb-3 p-3 rounded border border-slate-200 bg-slate-50">
                    <div className="font-medium text-sm text-slate-800 mb-1">Gloom Stalker</div>
                    <p className="text-xs text-slate-700"><strong>Dread Ambusher:</strong> +WIS to initiative. Round 1: extra attack that deals +1d8 damage on hit.</p>
                    <p className="text-xs text-slate-600 mt-0.5"><strong>Umbral Sight:</strong> darkvision 60ft. Invisible in darkness to darkvision-reliant creatures.</p>
                    {cc.level >= 7 && <p className="text-xs text-slate-600 mt-0.5"><strong>Iron Mind:</strong> proficiency in WIS saves (or INT/CHA if already proficient).</p>}
                    {cc.level >= 11 && <p className="text-xs text-slate-600 mt-0.5"><strong>Stalker's Flurry:</strong> once per turn on a miss, immediately make another attack.</p>}
                    {cc.level >= 15 && <p className="text-xs text-slate-600 mt-0.5"><strong>Shadowy Dodge:</strong> reaction to impose disadvantage on attack roll against you (not in bright light).</p>}
                  </div>
                ))()}

                {/* Ranger: Horizon Walker */}
                {cc.classSlug === 'ranger' && cc.subclassSlug === 'horizon-walker' && (() => (
                  <div className="mb-3 p-3 rounded border border-cyan-200 bg-cyan-50">
                    <div className="font-medium text-sm text-cyan-800 mb-1">Horizon Walker</div>
                    <p className="text-xs text-cyan-700"><strong>Detect Portal</strong> (1/SR): sense portals within 1 mile.</p>
                    <p className="text-xs text-cyan-700 mt-0.5"><strong>Planar Warrior:</strong> bonus action — first hit on chosen target deals +{cc.level >= 11 ? '2d8' : '1d8'} force damage this turn.</p>
                    {cc.level >= 7 && <p className="text-xs text-cyan-600 mt-0.5"><strong>Ethereal Step</strong> (1/SR): start of turn bonus action — enter Ethereal Plane until end of turn.</p>}
                    {cc.level >= 11 && <p className="text-xs text-cyan-600 mt-0.5"><strong>Distant Strike:</strong> teleport up to 10ft before each attack. Two different targets → third bonus attack.</p>}
                    {cc.level >= 15 && <p className="text-xs text-cyan-600 mt-0.5"><strong>Spectral Defense:</strong> reaction to gain resistance to one instance of damage.</p>}
                  </div>
                ))()}

                {/* Ranger: Beast Master */}
                {cc.classSlug === 'ranger' && cc.subclassSlug === 'beast-master' && (() => (
                  <div className="mb-3 p-3 rounded border border-green-200 bg-green-50">
                    <div className="font-medium text-sm text-green-800 mb-1">Beast Master</div>
                    <p className="text-xs text-green-700"><strong>Primal Companion:</strong> bond with a Primal Beast (Air/Land/Sea). HP = 5×Ranger level. Acts on your initiative; attacks on your turn without needing a command.</p>
                    {cc.level >= 7 && <p className="text-xs text-green-600 mt-0.5"><strong>Exceptional Training:</strong> when companion doesn't attack, bonus action to command Dash/Disengage/Dodge/Help. Attacks are magical.</p>}
                    {cc.level >= 11 && <p className="text-xs text-green-600 mt-0.5"><strong>Bestial Fury:</strong> companion makes two attacks per turn.</p>}
                    {cc.level >= 15 && <p className="text-xs text-green-600 mt-0.5"><strong>Share Spells:</strong> self-targeting spells also affect companion within 30ft.</p>}
                  </div>
                ))()}

                {/* Druid: Circle of Stars */}
                {cc.classSlug === 'druid' && cc.subclassSlug === 'stars' && (() => {
                  const wisStr = Math.max(0, abilityModFor(char, 'wis')) > 0 ? `+${Math.max(0, abilityModFor(char, 'wis'))}` : ''
                  return (
                    <div className="mb-3 p-3 rounded border border-indigo-100 bg-indigo-50">
                      <div className="font-medium text-sm text-indigo-800 mb-1">Circle of Stars</div>
                      <p className="text-xs text-indigo-700"><strong>Star Map:</strong> Guidance at will; cast Guiding Bolt {profBonus(char)}×/LR without a slot.</p>
                      <p className="text-xs text-indigo-700 mt-0.5"><strong>Starry Form</strong> (uses Wild Shape): choose Archer (1d8{wisStr} radiant BA), Chalice (1d8{wisStr} HP when healing), or Dragon (min 10 on concentration saves).</p>
                      {cc.level >= 6 && <p className="text-xs text-indigo-600 mt-0.5"><strong>Cosmic Omen</strong> (WIS mod/LR): reaction — Woe −1d6 or Weal +1d6 to any roll within 30ft.</p>}
                      {cc.level >= 10 && <p className="text-xs text-indigo-600 mt-0.5"><strong>Twinkling Constellations:</strong> Archer/Chalice deal 2d8; Dragon gives 20ft fly+hover. Can switch form each turn.</p>}
                    </div>
                  )
                })()}

                {/* Druid: Circle of Spores */}
                {cc.classSlug === 'druid' && cc.subclassSlug === 'spores' && (() => {
                  const haloDie = cc.level >= 14 ? '1d10' : cc.level >= 10 ? '1d8' : cc.level >= 6 ? '1d6' : '1d4'
                  return (
                    <div className="mb-3 p-3 rounded border border-green-200 bg-green-50">
                      <div className="font-medium text-sm text-green-800 mb-1">Circle of Spores</div>
                      <p className="text-xs text-green-700"><strong>Halo of Spores:</strong> reaction — creature entering/starting turn within 10ft takes {haloDie} necrotic (CON save negates).</p>
                      <p className="text-xs text-green-700 mt-0.5"><strong>Symbiotic Entity</strong> (Wild Shape charge): gain {4 * cc.level} temp HP. Halo +1d6 necrotic; weapon hits +1d6 necrotic. Lasts 10 min.</p>
                      {cc.level >= 6 && <p className="text-xs text-green-600 mt-0.5"><strong>Fungal Infestation</strong> (WIS mod/LR reaction): when creature dies within 10ft, animate as zombie for 1 hr.</p>}
                      {cc.level >= 14 && <p className="text-xs text-green-600 mt-0.5"><strong>Fungal Body:</strong> immune to blinded/deafened/frightened/poisoned. Critical hits become normal hits.</p>}
                    </div>
                  )
                })()}

                {/* Druid: Circle of Dreams */}
                {cc.classSlug === 'druid' && cc.subclassSlug === 'dreams' && (() => {
                  const wisMod = Math.max(0, abilityModFor(char, 'wis'))
                  return (
                    <div className="mb-3 p-3 rounded border border-purple-100 bg-purple-50">
                      <div className="font-medium text-sm text-purple-800 mb-1">Circle of Dreams</div>
                      <p className="text-xs text-purple-700"><strong>Balm of the Summer Court</strong> ({cc.level}d6 pool/LR): bonus action — expend dice to heal a creature within 120ft, granting that many temp HP too.</p>
                      {cc.level >= 6 && <p className="text-xs text-purple-600 mt-0.5"><strong>Hearth of Moonlight and Shadow:</strong> during rests, 30ft warded area — no unwanted eavesdropping or scrying.</p>}
                      {cc.level >= 10 && <p className="text-xs text-purple-600 mt-0.5"><strong>Hidden Paths</strong> (WIS mod/LR): bonus action — teleport 60ft. Or action to teleport a willing creature 30ft.</p>}
                    </div>
                  )
                })()}

                {/* Druid: Circle of the Shepherd */}
                {cc.classSlug === 'druid' && cc.subclassSlug === 'shepherd' && (() => (
                  <div className="mb-3 p-3 rounded border border-lime-200 bg-lime-50">
                    <div className="font-medium text-sm text-lime-800 mb-1">Circle of the Shepherd</div>
                    <p className="text-xs text-lime-700"><strong>Speech of the Woods:</strong> cast Speak with Animals at will. Know Sylvan.</p>
                    <p className="text-xs text-lime-700 mt-0.5"><strong>Spirit Totem</strong> (1/SR): bonus action — Bear (HP aura, +5 HP), Hawk (ally reaction for attack advantage), Unicorn (WIS healing bonus; detect magic 60ft).</p>
                    {cc.level >= 6 && <p className="text-xs text-lime-600 mt-0.5"><strong>Mighty Summoner:</strong> summoned beasts/fey gain +2 HP/HD and natural weapons are magical.</p>}
                    {cc.level >= 10 && <p className="text-xs text-lime-600 mt-0.5"><strong>Guardian Spirit:</strong> summoned creatures ending turns in totem aura regain 2d6+WIS HP.</p>}
                  </div>
                ))()}

                {/* Cleric: Destroy Undead */}
                {cc.classSlug === 'cleric' && cc.level >= 5 && (() => {
                  const crThreshold = cc.level >= 17 ? 'CR 4' : cc.level >= 14 ? 'CR 3' : cc.level >= 11 ? 'CR 2' : cc.level >= 8 ? 'CR 1' : 'CR 1/2'
                  return (
                    <div className="mb-3 p-3 rounded border border-amber-100 bg-amber-50">
                      <div className="flex items-center justify-between">
                        <div className="font-medium text-sm text-amber-800">Turn Undead → Destroy Undead</div>
                        <div className="text-base font-bold text-amber-700">{crThreshold} or lower</div>
                      </div>
                      <p className="text-xs text-amber-600 mt-1">Channel Divinity: undead of {crThreshold} or lower are destroyed outright instead of merely turned.</p>
                    </div>
                  )
                })()}

                {/* Bard: Song of Rest & Countercharm */}
                {cc.classSlug === 'bard' && cc.level >= 2 && (() => {
                  const sorDie = cc.level >= 17 ? 'd12' : cc.level >= 13 ? 'd10' : cc.level >= 9 ? 'd8' : 'd6'
                  return (
                    <div className="mb-3 p-3 rounded border border-blue-100 bg-blue-50">
                      <div className="flex items-center justify-between mb-1">
                        <div className="font-medium text-sm text-blue-800">Song of Rest</div>
                        <div className="text-base font-bold text-blue-700">{sorDie}</div>
                      </div>
                      <p className="text-xs text-blue-600 mb-1">Allies who hear your performance during a short rest regain extra HP equal to one {sorDie} roll when spending hit dice.</p>
                      {cc.level >= 6 && (
                        <>
                          <div className="font-medium text-sm text-blue-800 mt-2 mb-1">Countercharm</div>
                          <p className="text-xs text-blue-600">Action: friendly creatures within 30ft that can hear you have advantage on saves against being frightened or charmed.</p>
                        </>
                      )}
                    </div>
                  )
                })()}

                {/* Fighter: Rune Knight runes */}
                {cc.classSlug === 'fighter' && cc.subclassSlug === 'rune-knight' && cc.level >= 3 && (() => {
                  const fc = char.featuresChosen.find(f => f.key === 'runes')
                  const slugs: string[] = !fc ? [] : Array.isArray(fc.value) ? fc.value : [fc.value]
                  const maxRunes = cc.level >= 15 ? 5 : cc.level >= 10 ? 4 : cc.level >= 7 ? 3 : 2
                  if (slugs.length === 0) return (
                    <div className="mb-3 p-3 rounded border border-stone-100 bg-stone-50 text-xs text-stone-600">No runes inscribed — level up to choose runes ({maxRunes} available).</div>
                  )
                  return (
                    <div className="mb-3 p-3 rounded border border-stone-200 bg-stone-50">
                      <div className="font-medium text-sm text-stone-800 mb-2">Runes Inscribed ({slugs.length}/{maxRunes})</div>
                      <div className="space-y-1.5">
                        {slugs.map(slug => {
                          const r = RUNE_KNIGHT_RUNES.find(x => x.slug === slug)
                          return (
                            <div key={slug} className="text-sm">
                              <span className="font-medium">{r?.name ?? slug}</span>
                              {r?.description && <span className="text-xs text-parchment-500 ml-2">— {r.description}</span>}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()}

                {/* Ranger: Hunter subclass choices */}
                {cc.classSlug === 'ranger' && cc.subclassSlug === 'hunter' && (() => {
                  const choices = ([3, 7, 11, 15] as const).flatMap(lvl => {
                    const fc = char.featuresChosen.find(f => f.key === `hunter-${lvl}`)
                    if (!fc || cc.level < lvl) return []
                    const slug = typeof fc.value === 'string' ? fc.value : ''
                    const def = HUNTER_CHOICES[lvl]?.find(c => c.slug === slug)
                    return def ? [{ lvl, def }] : []
                  })
                  if (choices.length === 0) return null
                  return (
                    <div className="mb-3 p-3 rounded border border-teal-100 bg-teal-50">
                      <div className="font-medium text-sm text-teal-800 mb-2">Hunter Techniques</div>
                      <div className="space-y-1.5">
                        {choices.map(({ lvl, def }) => (
                          <div key={lvl} className="text-sm">
                            <span className="font-medium">{def.name}</span>
                            <span className="text-xs text-parchment-500 ml-2">— {def.description}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })()}

                {/* Eldritch Invocations (Warlock) */}
                {cc.classSlug === 'warlock' && (() => {
                  const fc = char.featuresChosen.find(f => f.key === 'invocations')
                  const slugs: string[] = !fc ? [] : Array.isArray(fc.value) ? fc.value : [fc.value]
                  if (slugs.length === 0) return null
                  return (
                    <div className="mb-3 p-3 rounded border border-indigo-100 bg-indigo-50">
                      <div className="font-medium text-sm mb-2 text-indigo-700">Eldritch Invocations ({slugs.length})</div>
                      <div className="space-y-1.5">
                        {slugs.map(slug => {
                          const inv = ELDRITCH_INVOCATIONS.find(i => i.slug === slug)
                          return (
                            <div key={slug} className="text-sm">
                              <span className="font-medium">{inv?.name ?? slug}</span>
                              {inv?.description && <span className="text-xs text-parchment-500 ml-2">— {inv.description}</span>}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()}

                {/* Infusions (Artificer) */}
                {cc.classSlug === 'artificer' && cc.level >= 2 && (() => {
                  const classOpts = CLASS_OPTIONS['artificer']!
                  const knownAtLevel  = classOpts.infusionsKnownAtLevel!
                  const activeAtLevel = classOpts.infusionsActiveAtLevel!
                  const knownNow  = knownAtLevel[cc.level - 1]
                  const activeNow = activeAtLevel[cc.level - 1]
                  const fc = char.featuresChosen.find(f => f.key === 'infusions')
                  const slugs: string[] = !fc ? [] : Array.isArray(fc.value) ? fc.value : [fc.value]

                  const PROGRESSION = [
                    { level: 2, known: 4, active: 2 },
                    { level: 6, known: 6, active: 3 },
                    { level: 10, known: 8, active: 4 },
                    { level: 14, known: 10, active: 5 },
                    { level: 18, known: 12, active: 6 },
                  ]

                  return (
                    <div className="mb-3 p-3 rounded border border-amber-100 bg-amber-50/40">
                      <div className="font-medium text-sm text-amber-800 mb-3">Infuse Item</div>

                      {/* Current counts */}
                      <div className="flex gap-4 mb-3">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-amber-700">{knownNow}</div>
                          <div className="text-xs text-parchment-500">Infusions Known</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-amber-700">{activeNow}</div>
                          <div className="text-xs text-parchment-500">Active at Once</div>
                        </div>
                      </div>

                      {/* Progression table */}
                      <table className="w-full text-xs border-collapse mb-3">
                        <thead>
                          <tr className="text-left border-b border-amber-200">
                            <th className="pb-1 pr-3 font-semibold text-parchment-600">Artificer Level</th>
                            <th className="pb-1 pr-3 font-semibold text-parchment-600">Infusions Known</th>
                            <th className="pb-1 font-semibold text-parchment-600">Infused Items</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-amber-100">
                          {PROGRESSION.map(row => (
                            <tr key={row.level} className={cc.level >= row.level ? 'text-parchment-800' : 'text-parchment-300'}>
                              <td className={`py-1 pr-3 font-medium ${cc.level === row.level || (cc.level > row.level && (PROGRESSION.find(r => r.level > cc.level)?.level ?? 99) > row.level) ? 'text-amber-700' : ''}`}>
                                {row.level}{cc.level >= row.level && cc.level < (PROGRESSION.find(r => r.level > row.level)?.level ?? 99) ? ' ←' : ''}
                              </td>
                              <td className="py-1 pr-3">{row.known}</td>
                              <td className="py-1">{row.active}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      {/* Known infusions list */}
                      <div className="border-t border-amber-100 pt-2 mb-3">
                        <div className="text-xs font-semibold text-parchment-500 uppercase tracking-wide mb-2">Your Chosen Infusions</div>
                        {slugs.length > 0 ? (
                          <div className="space-y-1">
                            {slugs.map(slug => {
                              const inf = ARTIFICER_INFUSIONS.find(i => i.slug === slug)
                              return (
                                <div key={slug} className="flex items-start gap-1.5">
                                  <span className="text-sm font-medium shrink-0">{inf?.name ?? slug}</span>
                                  {inf?.cost && <span className="text-xs text-amber-700 shrink-0">({inf.cost})</span>}
                                </div>
                              )
                            })}
                          </div>
                        ) : (
                          <p className="text-xs text-parchment-400">No infusions selected yet — choose them during level up.</p>
                        )}
                      </div>

                      {/* Full reference table */}
                      <details className="border-t border-amber-100 pt-2">
                        <summary className="text-xs font-semibold text-parchment-500 uppercase tracking-wide cursor-pointer hover:text-parchment-700">All Infusions Reference ▼</summary>
                        <div className="mt-2 overflow-x-auto">
                          <table className="w-full text-xs border-collapse">
                            <thead>
                              <tr className="text-left border-b border-amber-200">
                                <th className="pb-1 pr-2 font-semibold text-parchment-600">Infusion</th>
                                <th className="pb-1 pr-2 font-semibold text-parchment-600">Min. Level</th>
                                <th className="pb-1 pr-2 font-semibold text-parchment-600">Item Required</th>
                                <th className="pb-1 pr-2 font-semibold text-parchment-600">Cost</th>
                                <th className="pb-1 font-semibold text-parchment-600">Effect</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-amber-50">
                              {ARTIFICER_INFUSIONS.map(inf => {
                                const available = cc.level >= (inf.levelRequirement ?? 2)
                                const known = slugs.includes(inf.slug)
                                return (
                                  <tr key={inf.slug} className={known ? 'bg-amber-50' : !available ? 'bg-parchment-50' : ''}>
                                    <td className={`py-1.5 pr-2 font-medium align-top whitespace-nowrap ${!available ? 'text-parchment-300' : ''}`}>
                                      {inf.name}
                                      {known && <span className="ml-1 text-amber-600">✓</span>}
                                    </td>
                                    <td className="py-1.5 pr-2 align-top">
                                      {!available
                                        ? <span className="text-parchment-300">Lv {inf.levelRequirement}</span>
                                        : <span className="text-green-600 font-medium">✓ {inf.levelRequirement ?? 2}</span>}
                                    </td>
                                    <td className={`py-1.5 pr-2 align-top ${!available ? 'text-parchment-300' : 'text-parchment-500'}`}>{inf.itemType ?? '—'}</td>
                                    <td className={`py-1.5 pr-2 align-top ${!available ? 'text-parchment-300' : 'text-amber-700'}`}>{inf.cost ?? '—'}</td>
                                    <td className={`py-1.5 align-top ${!available ? 'text-parchment-300' : 'text-parchment-600'}`}>{inf.description}</td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      </details>
                    </div>
                  )
                })()}

                {/* Metamagic (Sorcerer) */}
                {cc.classSlug === 'sorcerer' && (() => {
                  const fc = char.featuresChosen.find(f => f.key === 'metamagic')
                  const slugs: string[] = !fc ? [] : Array.isArray(fc.value) ? fc.value : [fc.value]
                  if (slugs.length === 0) return null
                  return (
                    <div className="mb-3 p-3 rounded border border-purple-100 bg-purple-50">
                      <div className="font-medium text-sm mb-2 text-purple-700">Metamagic ({slugs.length})</div>
                      <div className="space-y-1.5">
                        {slugs.map(slug => {
                          const m = METAMAGIC_OPTIONS.find(x => x.slug === slug)
                          return (
                            <div key={slug} className="text-sm">
                              <span className="font-medium">{m?.name ?? slug}</span>
                              {m?.description && <span className="text-xs text-parchment-500 ml-2">— {m.description}</span>}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()}
              </div>
            )
          })}
          </div>

          {/* Resistances & Immunities */}
          {(resistances.resistances.length > 0 || resistances.immunities.length > 0 || resistances.conditionImmunities.length > 0 || resistances.advantages.length > 0) && (
            <div className="card order-3">
              <h2 className="section-header">Resistances &amp; Immunities</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {resistances.resistances.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-parchment-600 uppercase mb-1">Damage Resistance</div>
                    <div className="flex flex-wrap gap-1">
                      {resistances.resistances.map(r => (
                        <span key={r} className="text-xs bg-blue-100 text-blue-700 rounded px-2 py-0.5 capitalize">{r}</span>
                      ))}
                    </div>
                  </div>
                )}
                {resistances.immunities.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-parchment-600 uppercase mb-1">Damage Immunity</div>
                    <div className="flex flex-wrap gap-1">
                      {resistances.immunities.map(r => (
                        <span key={r} className="text-xs bg-green-100 text-green-700 rounded px-2 py-0.5 capitalize">{r}</span>
                      ))}
                    </div>
                  </div>
                )}
                {resistances.conditionImmunities.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-parchment-600 uppercase mb-1">Condition Immunity</div>
                    <div className="flex flex-wrap gap-1">
                      {resistances.conditionImmunities.map(r => (
                        <span key={r} className="text-xs bg-purple-100 text-purple-700 rounded px-2 py-0.5 capitalize">{r}</span>
                      ))}
                    </div>
                  </div>
                )}
                {resistances.advantages.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-parchment-600 uppercase mb-1">Advantage On</div>
                    <div className="flex flex-wrap gap-1">
                      {resistances.advantages.map(r => (
                        <span key={r} className="text-xs bg-amber-100 text-amber-700 rounded px-2 py-0.5 capitalize">{r}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Feats */}
          {(() => {
            const featChoices = char.featuresChosen.filter(fc =>
              fc.key === 'feat-l1' || fc.key.startsWith('feat-')
            )
            return (
              <div className="card order-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="section-header mb-0">Feats</h2>
                  <button
                    type="button"
                    className="text-xs bg-parchment-700 text-parchment-100 hover:bg-parchment-800 rounded px-2 py-1 font-semibold transition-colors"
                    onClick={() => { setAddFeatOpen(true); setAddFeatSearch('') }}
                  >+ Add Feat</button>
                </div>
                {featChoices.length === 0 && (
                  <p className="text-sm text-parchment-400 italic">No feats yet.</p>
                )}
                {featChoices.map(fc => {
                  const slug = typeof fc.value === 'string' ? fc.value : fc.value[0]
                  const featDef = content.feats.find(f => f.slug === slug)
                  const effect = featDef
                  const sourceLabel = fc.key === 'feat-l1'
                    ? 'Level 1'
                    : fc.key.startsWith('feat-manual-')
                    ? 'Added'
                    : `${fc.key.replace(/^feat-/, '').replace(/-\d{10,}$/, '').replace(/-/g, ' ')} ASI`

                  // Collect passive bonuses this specific feat grants for display
                  const passiveBadges: string[] = []
                  if (effect?.initiativeBonus) passiveBadges.push(`+${effect.initiativeBonus} Initiative`)
                  if (effect?.speedBonus) passiveBadges.push(`+${effect.speedBonus}ft Speed`)
                  if (effect?.passivePerceptionBonus) passiveBadges.push(`+${effect.passivePerceptionBonus} Passive Perception`)
                  if (effect?.passiveInvestigationBonus) passiveBadges.push(`+${effect.passiveInvestigationBonus} Passive Investigation`)
                  if (effect?.hpBonusPerLevel) passiveBadges.push(`+${effect.hpBonusPerLevel * level} HP (Tough)`)
                  if (effect?.naturalArmorBase) passiveBadges.push(`Natural Armor AC ${effect.naturalArmorBase}+DEX`)
                  if (effect?.concentrationAdvantage) passiveBadges.push('Adv. on Concentration saves')

                  const allGranted = [...(effect?.grantedCantrips ?? []), ...(effect?.grantedSpells ?? [])]

                  return (
                    <div key={fc.key} className="mb-3 p-3 rounded border border-parchment-100">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs bg-amber-100 text-amber-700 rounded px-1.5 py-0.5 capitalize">{sourceLabel}</span>
                        <span className="font-medium">{featDef?.name ?? slug}</span>
                        {featDef?.prerequisite && (
                          <span className="text-xs text-parchment-400">Prereq: {featDef.prerequisite}</span>
                        )}
                        {effect?.abilityScoreIncrease && (
                          <span className="text-xs bg-blue-50 text-blue-600 border border-blue-200 rounded px-1.5 py-0.5">
                            +1 {effect.abilityScoreIncrease.from.map(a => ABILITY_LABELS[a] ?? a.toUpperCase()).join('/')}
                          </span>
                        )}
                        <button
                          type="button"
                          title="Remove feat"
                          className="ml-auto text-xs text-red-400 hover:text-red-600 transition-colors"
                          onClick={() => patch({ featuresChosen: char.featuresChosen.filter(f => f.key !== fc.key) })}
                        >Remove</button>
                      </div>

                      {/* Passive stat badges */}
                      {passiveBadges.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {passiveBadges.map(b => (
                            <span key={b} className="text-xs bg-green-100 text-green-700 rounded px-1.5 py-0.5">✓ {b}</span>
                          ))}
                        </div>
                      )}

                      {/* Granted spells */}
                      {allGranted.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {allGranted.map(s => (
                            <span key={s.slug} className="text-xs bg-indigo-100 text-indigo-700 rounded px-1.5 py-0.5">
                              🔮 {s.name}{s.usesPerLongRest ? ` (${s.usesPerLongRest}/LR)` : s.level === 0 ? ' (cantrip)' : ' (at will)'}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Structured notes from FEAT_EFFECTS (preferred) or scraped description */}
                      {effect?.notes ? (
                        <ul className="text-sm text-parchment-600 mt-2 list-disc list-inside space-y-0.5">
                          {effect.notes.map(n => <li key={n}>{n}</li>)}
                        </ul>
                      ) : featDef?.description ? (
                        <p className="text-sm text-parchment-600 mt-2">{featDef.description}</p>
                      ) : null}
                      {/* Expertise picker for feats that grant it */}
                      {effect?.grantedExpertise && (() => {
                        const expertiseKey = `feat-expertise-${slug}`
                        const existing = char.featuresChosen.find(fc => fc.key === expertiseKey)
                        const chosen: string[] = !existing ? [] : Array.isArray(existing.value) ? existing.value : [existing.value]
                        const needed = effect.grantedExpertise
                        if (chosen.length >= needed) {
                          return (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {chosen.map(s => (
                                <span key={s} className="text-xs bg-indigo-100 text-indigo-700 rounded px-2 py-0.5">
                                  ✓ Expertise: {SKILL_LABELS[s as keyof typeof SKILL_LABELS] ?? s}
                                </span>
                              ))}
                            </div>
                          )
                        }
                        return (
                          <div className="mt-2 p-2 rounded border border-amber-200 bg-amber-50">
                            <p className="text-xs text-amber-700 mb-1">Choose {needed - chosen.length} expertise skill{needed - chosen.length !== 1 ? 's' : ''}:</p>
                            <div className="flex flex-wrap gap-1">
                              {SKILLS.filter(s => char.skillProficiencies.includes(s) && !char.skillExpertise.includes(s) && !chosen.includes(s)).map(s => (
                                <button
                                  key={s}
                                  className="text-xs bg-parchment-50 border border-amber-300 text-amber-800 rounded px-2 py-0.5 hover:bg-amber-100"
                                  onClick={() => {
                                    const next = [...chosen, s]
                                    const fc: typeof char.featuresChosen[0] = { key: expertiseKey, value: next }
                                    const updated = char.featuresChosen.filter(f => f.key !== expertiseKey)
                                    patch({
                                      featuresChosen: [...updated, fc],
                                      skillExpertise: [...new Set([...char.skillExpertise, s])],
                                    })
                                  }}
                                >
                                  {SKILL_LABELS[s]}
                                </button>
                              ))}
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                  )
                })}
              </div>
            )
          })()}

          {/* Background feature */}
          {(() => {
            const bg = content.backgrounds.find(b => b.slug === char.backgroundSlug)
            if (!bg) return null
            return (
              <div className="card order-5">
                <h2 className="section-header">Background: {bg.name}</h2>
                <div className="p-3 rounded border border-parchment-100">
                  <div className="font-medium">{bg.feature.name}</div>
                  <p className="text-sm text-parchment-600 mt-1">{bg.feature.description}</p>
                </div>
                {(bg.skillProficiencies.length > 0 || bg.toolProficiencies.length > 0 || bg.languages > 0) && (
                  <div className="mt-2 flex gap-4 text-xs text-parchment-500">
                    {bg.skillProficiencies.length > 0 && <span>Skills: {bg.skillProficiencies.join(', ')}</span>}
                    {bg.toolProficiencies.length > 0 && <span>Tools: {bg.toolProficiencies.join(', ')}</span>}
                    {bg.languages > 0 && <span>Languages: +{bg.languages} of your choice</span>}
                  </div>
                )}
                {(() => {
                  const college = STRIXHAVEN_COLLEGES[bg.slug]
                  if (!college) return null
                  const firstLevelOptions = college.byLevel.find(r => r.level === 1)?.spells ?? []
                  const chosenCantrip = char.featuresChosen.find(fc => fc.key === 'strixhaven-cantrip')?.value as string | undefined
                  const chosenSpell = char.featuresChosen.find(fc => fc.key === 'strixhaven-spell')?.value as string | undefined
                  const resolveSlug = (name: string) =>
                    content.spells.find(sp => sp.name.toLowerCase() === name.toLowerCase())?.slug
                  const setPick = (key: string, level: number, value: string) => {
                    const current = char.featuresChosen.find(fc => fc.key === key)?.value as string | undefined
                    const toggleOff = current === value
                    const features = toggleOff
                      ? char.featuresChosen.filter(fc => fc.key !== key)
                      : [...char.featuresChosen.filter(fc => fc.key !== key), { key, value }]
                    // Keep the spellbook in sync: drop the previously-added pick, add the new one
                    // if it resolves to a real library spell (tagged classSlug 'strixhaven' for cleanup).
                    let spells = char.spells
                    const oldSlug = current ? resolveSlug(current) : undefined
                    if (oldSlug) spells = spells.filter(s => !(s.spellSlug === oldSlug && s.classSlug === 'strixhaven'))
                    if (!toggleOff) {
                      const newSlug = resolveSlug(value)
                      if (newSlug && !spells.some(s => s.spellSlug === newSlug && s.classSlug === 'strixhaven')) {
                        spells = [...spells, {
                          spellSlug: newSlug, name: value, classSlug: 'strixhaven', prepared: true, isHomebrew: false,
                          ...(level === 1 ? { usesPerLongRest: 1, freeUseKey: 'strixhaven-spell' } : {}),
                        }]
                      }
                    }
                    patch({ featuresChosen: features, spells })
                  }
                  const inSpellbook = (name: string) => !!resolveSlug(name)
                  const freeUsed = (char.freeSpellUses?.['strixhaven-spell'] ?? 0) >= 1
                  return (
                    <div className="mt-3 p-3 rounded border border-violet-200 bg-violet-50/50">
                      <div className="text-xs font-semibold text-violet-800 uppercase tracking-wide mb-1">
                        Strixhaven Initiate — {college.college} Spells
                      </div>
                      <p className="text-xs text-parchment-600 mb-2">
                        Learn <strong>1 cantrip</strong> and <strong>1 first-level spell</strong> from this list. You can cast the
                        1st-level spell once per long rest without a slot (using {college.ability.toUpperCase()} if you have no
                        spellcasting class), or with any spell slots you have.
                      </p>

                      {/* Cantrip picker */}
                      <div className="text-xs font-semibold text-parchment-700 mb-1">Cantrip <span className="text-parchment-400 font-normal">(choose 1)</span></div>
                      <div className="flex flex-wrap gap-1.5 mb-2.5">
                        {college.cantrips.map(c => (
                          <button key={c} type="button" onClick={() => setPick('strixhaven-cantrip', 0, c)}
                            className={`text-xs rounded px-2 py-1 border transition-colors ${chosenCantrip === c ? 'bg-violet-600 text-white border-violet-600' : 'bg-parchment-50 text-violet-700 border-violet-200 hover:border-violet-400'}`}>
                            {chosenCantrip === c ? '✓ ' : ''}{c}
                          </button>
                        ))}
                      </div>

                      {/* 1st-level spell picker */}
                      <div className="text-xs font-semibold text-parchment-700 mb-1">1st-Level Spell <span className="text-parchment-400 font-normal">(choose 1)</span></div>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {firstLevelOptions.map(s => (
                          <button key={s} type="button" onClick={() => setPick('strixhaven-spell', 1, s)}
                            className={`text-xs rounded px-2 py-1 border transition-colors ${chosenSpell === s ? 'bg-violet-600 text-white border-violet-600' : 'bg-parchment-50 text-violet-700 border-violet-200 hover:border-violet-400'}`}>
                            {chosenSpell === s ? '✓ ' : ''}{s}
                          </button>
                        ))}
                      </div>
                      {((chosenCantrip && !inSpellbook(chosenCantrip)) || (chosenSpell && !inSpellbook(chosenSpell))) && (
                        <p className="text-[10px] text-parchment-400 mb-2 -mt-1">
                          Picks not in the spell library are tracked here but not added to your spellbook list.
                        </p>
                      )}

                      {/* Free-cast tracker for the chosen 1st-level spell */}
                      {chosenSpell && (
                        <div className={`flex items-center gap-2 p-2 rounded border text-xs mb-2.5 ${freeUsed ? 'bg-parchment-50 border-parchment-200' : 'bg-green-50 border-green-200'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${freeUsed ? 'bg-parchment-300' : 'bg-green-500'}`} />
                          <span className={`font-medium ${freeUsed ? 'text-parchment-500 line-through' : 'text-green-700'}`}>
                            {chosenSpell} — free cast {freeUsed ? 'used' : 'available'} (1 / long rest)
                          </span>
                          <button type="button"
                            className="ml-auto text-xs px-2 py-0.5 rounded border border-parchment-200 hover:bg-parchment-100 transition-colors"
                            onClick={() => patch({ freeSpellUses: { ...char.freeSpellUses, 'strixhaven-spell': freeUsed ? 0 : 1 } })}>
                            {freeUsed ? 'Restore' : 'Use'}
                          </button>
                        </div>
                      )}

                      {/* Full college list for reference */}
                      <div className="text-[10px] font-bold text-violet-400 uppercase tracking-widest mb-1">{college.college} spell list</div>
                      <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
                        {college.byLevel.map(row => (
                          <div key={row.level} className="contents">
                            <span className="text-violet-500 font-medium text-right">{['1st','2nd','3rd','4th','5th'][row.level - 1]}</span>
                            <span className="text-parchment-700">{row.spells.join(', ')}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })()}
              </div>
            )
          })()}
        </div>
      )}

      {/* Summons Tab */}
      {tab === 'summons' && (() => {
        const activeSummon = activeSummonId ? char.summons.find(s => s.id === activeSummonId) : null

        const dismissSummon = (id: string) => {
          patch({ summons: char.summons.filter(s => s.id !== id) })
          if (activeSummonId === id) setActiveSummonId(null)
        }

        const updateSummon = (id: string, updates: Partial<Summon>) => {
          patch({ summons: char.summons.map(s => s.id === id ? { ...s, ...updates } : s) })
        }

        const adjustSummonHp = (id: string, delta: number, max: number, current: number) => {
          updateSummon(id, { hp: { max, current: Math.max(0, Math.min(max, current + delta)) } })
        }

        // Detail view
        if (activeSummon) {
          const s = activeSummon
          const hpPct = s.hp.max > 0 ? Math.min(100, (s.hp.current / s.hp.max) * 100) : 0
          const hpColor = hpPct > 50 ? 'bg-green-500' : hpPct > 25 ? 'bg-yellow-400' : 'bg-red-500'
          const ABILITY_SHORT = ['str','dex','con','int','wis','cha'] as const
          const modOf = (v: number) => Math.floor((v - 10) / 2)
          const fmtMod = (n: number) => n >= 0 ? `+${n}` : `${n}`

          return (
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setActiveSummonId(null)}
                  className="text-xs text-parchment-500 hover:text-parchment-800 border border-parchment-200 rounded px-2 py-1 transition-colors">
                  ← Back
                </button>
                <h2 className="text-xl font-bold text-parchment-800 flex-1">{s.name}</h2>
                <button type="button" onClick={() => dismissSummon(s.id)}
                  className="text-xs bg-red-600 text-white rounded px-3 py-1.5 hover:bg-red-700 font-semibold transition-colors">
                  Dismiss
                </button>
              </div>

              {/* Core stats */}
              <div className="card space-y-3">
                {/* HP */}
                <div>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-semibold text-parchment-700">Hit Points</span>
                    <span className={`font-bold ${s.hp.current === 0 ? 'text-red-600' : 'text-parchment-800'}`}>
                      {s.hp.current} / {s.hp.max}
                    </span>
                  </div>
                  <div className="h-3 rounded-full bg-parchment-100 overflow-hidden mb-2">
                    <div className={`h-full rounded-full transition-all ${hpColor}`} style={{ width: `${hpPct}%` }} />
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    {[-5,-1,1,5].map(d => (
                      <button key={d} type="button"
                        onClick={() => adjustSummonHp(s.id, d, s.hp.max, s.hp.current)}
                        className="px-2 py-1 text-xs rounded border border-parchment-200 hover:border-parchment-400 text-parchment-600 transition-colors">
                        {d > 0 ? `+${d}` : d}
                      </button>
                    ))}
                    <button type="button"
                      onClick={() => updateSummon(s.id, { hp: { ...s.hp, current: s.hp.max } })}
                      className="px-2 py-1 text-xs rounded border border-parchment-200 hover:border-parchment-400 text-parchment-600 transition-colors">
                      Full
                    </button>
                    <input type="number" min={0} max={s.hp.max}
                      className="input text-xs py-1 w-16 text-center"
                      value={s.hp.current}
                      onChange={e => updateSummon(s.id, { hp: { ...s.hp, current: Math.max(0, Math.min(s.hp.max, parseInt(e.target.value) || 0)) } })}
                    />
                  </div>
                </div>

                {/* AC / Speed */}
                <div className="flex gap-3">
                  <div className="flex flex-col items-center px-4 py-2 rounded-lg border border-parchment-200 bg-parchment-50">
                    <span className="text-[9px] font-bold text-parchment-400 uppercase tracking-widest mb-0.5">AC</span>
                    <span className="text-2xl font-bold text-parchment-800">{s.ac}</span>
                  </div>
                  <div className="flex flex-col items-center px-4 py-2 rounded-lg border border-parchment-200 bg-parchment-50">
                    <span className="text-[9px] font-bold text-parchment-400 uppercase tracking-widest mb-0.5">Speed</span>
                    <span className="text-2xl font-bold text-parchment-800">{s.speed} ft</span>
                  </div>
                  {(s.immunities.length > 0 || s.resistances.length > 0) && (
                    <div className="flex flex-col gap-1 flex-1">
                      {s.immunities.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          <span className="text-[10px] text-parchment-400 font-semibold self-center">Immune:</span>
                          {s.immunities.map(i => <span key={i} className="text-[10px] bg-red-50 text-red-700 border border-red-200 rounded px-1.5 py-0.5 capitalize">{i}</span>)}
                        </div>
                      )}
                      {s.resistances.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          <span className="text-[10px] text-parchment-400 font-semibold self-center">Resist:</span>
                          {s.resistances.map(r => <span key={r} className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 rounded px-1.5 py-0.5 capitalize">{r}</span>)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Ability scores */}
              {s.abilityScores && (
                <div className="card">
                  <h3 className="section-header">Ability Scores</h3>
                  <div className="grid grid-cols-6 gap-2 text-center">
                    {ABILITY_SHORT.map(a => (
                      <div key={a} className="stat-box">
                        <div className="text-xs uppercase text-parchment-500">{a}</div>
                        <div className="text-lg font-bold">{s.abilityScores![a]}</div>
                        <div className="text-sm text-parchment-600">{fmtMod(modOf(s.abilityScores![a]))}</div>
                      </div>
                    ))}
                  </div>
                  {s.saveProficiencies.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      <span className="text-xs text-parchment-500 font-semibold self-center">Save Prof:</span>
                      {s.saveProficiencies.map(sv => <span key={sv} className="text-xs bg-indigo-100 text-indigo-700 rounded px-2 py-0.5 uppercase font-semibold">{sv}</span>)}
                    </div>
                  )}
                </div>
              )}

              {/* Attacks */}
              {s.attacks.length > 0 && (
                <div className="card">
                  <h3 className="section-header">Attacks</h3>
                  <div className="space-y-2">
                    {s.attacks.map((atk, i) => (
                      <div key={i} className="flex items-start gap-3 p-2 rounded border border-parchment-100">
                        <div className="flex-1">
                          <div className="font-medium text-sm">{atk.name}</div>
                          {atk.notes && <div className="text-xs text-parchment-500 mt-0.5">{atk.notes}</div>}
                        </div>
                        {atk.toHit !== undefined && (
                          <span className="text-xs bg-green-100 text-green-700 border border-green-200 rounded px-1.5 py-0.5 shrink-0">{fmtMod(atk.toHit)} to hit</span>
                        )}
                        {atk.damage && (
                          <span className="text-xs bg-red-100 text-red-700 border border-red-200 rounded px-1.5 py-0.5 shrink-0">{atk.damage}{atk.damageType ? ` ${atk.damageType}` : ''}</span>
                        )}
                        {atk.range && (
                          <span className="text-xs bg-parchment-100 text-parchment-600 rounded px-1.5 py-0.5 shrink-0">{atk.range}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Abilities */}
              {s.abilities.length > 0 && (
                <div className="card">
                  <h3 className="section-header">Abilities</h3>
                  <div className="space-y-2">
                    {s.abilities.map((ab, i) => (
                      <div key={i} className="p-2 rounded border border-parchment-100">
                        <div className="font-medium text-sm">{ab.name}</div>
                        {ab.description && <p className="text-sm text-parchment-600 mt-0.5">{ab.description}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              <div className="card">
                <h3 className="section-header">Notes</h3>
                <textarea className="input text-sm min-h-[80px] w-full" value={s.notes}
                  onChange={e => updateSummon(s.id, { notes: e.target.value })}
                  placeholder="Additional notes…" />
              </div>
            </div>
          )
        }

        // List view
        return (
          <div className="space-y-4">
            {char.summons.length === 0 ? (
              <div className="card text-center py-8 text-parchment-400">
                <div className="text-2xl mb-2">✦</div>
                <div className="font-medium">No active summons</div>
                <div className="text-sm mt-1">Summon creatures from their feature cards, or add a custom one below.</div>
              </div>
            ) : (
              <div className="space-y-3">
                {char.summons.map(s => {
                  const hpPct = s.hp.max > 0 ? Math.min(100, (s.hp.current / s.hp.max) * 100) : 0
                  const hpColor = hpPct > 50 ? 'bg-green-500' : hpPct > 25 ? 'bg-yellow-400' : 'bg-red-500'
                  const modOf = (v: number) => Math.floor((v - 10) / 2)
                  const fmtMod = (n: number) => n >= 0 ? `+${n}` : `${n}`
                  const ABILITY_SHORT = ['str','dex','con','int','wis','cha'] as const
                  return (
                    <div key={s.id} className="card space-y-3">
                      {/* Header row */}
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-semibold text-parchment-800">{s.name}</span>
                            <span className="text-xs bg-parchment-100 text-parchment-600 rounded px-1.5 py-0.5">AC {s.ac}</span>
                            <span className="text-xs bg-parchment-100 text-parchment-600 rounded px-1.5 py-0.5">{s.speed} ft</span>
                            {s.immunities.length > 0 && (
                              <span className="text-xs bg-red-50 text-red-600 border border-red-200 rounded px-1.5 py-0.5">
                                Immune: {s.immunities.join(', ')}
                              </span>
                            )}
                            {s.resistances.length > 0 && (
                              <span className="text-xs bg-blue-50 text-blue-600 border border-blue-200 rounded px-1.5 py-0.5">
                                Resist: {s.resistances.join(', ')}
                              </span>
                            )}
                          </div>
                          {/* HP bar */}
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 rounded-full bg-parchment-100 overflow-hidden">
                              <div className={`h-full rounded-full ${hpColor}`} style={{ width: `${hpPct}%` }} />
                            </div>
                            <span className="text-xs text-parchment-500 shrink-0">{s.hp.current}/{s.hp.max} HP</span>
                          </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button type="button" onClick={() => setActiveSummonId(s.id)}
                            className="text-xs border border-parchment-300 text-parchment-600 hover:border-parchment-500 rounded px-2.5 py-1 transition-colors">
                            Open
                        </button>
                        <button type="button" onClick={() => dismissSummon(s.id)}
                          className="text-xs border border-red-200 text-red-500 hover:bg-red-50 rounded px-2.5 py-1 transition-colors">
                          Dismiss
                        </button>
                      </div>
                      </div>

                      {/* Ability scores */}
                      {s.abilityScores && (
                        <div className="grid grid-cols-6 gap-1.5 pt-2 border-t border-parchment-100">
                          {ABILITY_SHORT.map(a => (
                            <div key={a} className="flex flex-col items-center py-1 rounded bg-parchment-50 border border-parchment-100">
                              <span className="text-[9px] font-bold text-parchment-400 uppercase">{a}</span>
                              <span className="text-sm font-bold text-parchment-800 leading-none">{s.abilityScores![a]}</span>
                              <span className="text-[10px] text-parchment-500">{fmtMod(modOf(s.abilityScores![a]))}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Quick attack / ability summary */}
                      {(s.attacks.length > 0 || s.abilities.length > 0) && (
                        <div className="flex flex-wrap gap-1.5 pt-2 border-t border-parchment-100">
                          {s.attacks.map((atk, i) => (
                            <span key={i} className="text-[10px] bg-green-50 text-green-700 border border-green-200 rounded px-1.5 py-0.5">
                              ⚔ {atk.name}{atk.toHit !== undefined ? ` ${fmtMod(atk.toHit)}` : ''}{atk.damage ? ` · ${atk.damage}${atk.damageType ? ` ${atk.damageType}` : ''}` : ''}
                            </span>
                          ))}
                          {s.abilities.map((ab, i) => (
                            <span key={i} className="text-[10px] bg-indigo-50 text-indigo-600 border border-indigo-200 rounded px-1.5 py-0.5">
                              ✦ {ab.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Add custom summon */}
            <div className="card">
              <h3 className="section-header">Add Custom Summon</h3>
              {newSummonForm ? (
                <div className="space-y-2">
                  <input className="input text-sm" placeholder="Name (e.g. Familiar, Wolf Companion…)"
                    value={newSummonForm.name} onChange={e => setNewSummonForm(f => f && ({ ...f, name: e.target.value }))} />
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="label">Max HP</label>
                      <input type="number" className="input text-sm" placeholder="20"
                        value={newSummonForm.hp} onChange={e => setNewSummonForm(f => f && ({ ...f, hp: e.target.value }))} />
                    </div>
                    <div className="flex-1">
                      <label className="label">AC</label>
                      <input type="number" className="input text-sm" placeholder="13"
                        value={newSummonForm.ac} onChange={e => setNewSummonForm(f => f && ({ ...f, ac: e.target.value }))} />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button type="button"
                      className="btn-primary text-sm flex-1"
                      onClick={() => {
                        const maxHp = parseInt(newSummonForm.hp) || 1
                        const ac = parseInt(newSummonForm.ac) || 10
                        const newSummon: Summon = {
                          id: Math.random().toString(36).slice(2, 10),
                          name: newSummonForm.name.trim() || 'Summon',
                          hp: { current: maxHp, max: maxHp },
                          ac, speed: 30,
                          saveProficiencies: [], immunities: [], resistances: [],
                          attacks: [], abilities: [], notes: '',
                        }
                        patch({ summons: [...char.summons, newSummon] })
                        setNewSummonForm(null)
                        setActiveSummonId(newSummon.id)
                      }}
                    >Add Summon</button>
                    <button type="button" className="btn-secondary text-sm"
                      onClick={() => setNewSummonForm(null)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <button type="button" className="btn-secondary text-sm w-full"
                  onClick={() => setNewSummonForm({ name: '', hp: '', ac: '' })}>
                  + New Summon
                </button>
              )}
            </div>
          </div>
        )
      })()}

      {/* Notes Tab */}
      {tab === 'notes' && (() => {
        const bg = content.backgrounds.find(b => b.slug === char.backgroundSlug)
        const bgSuggestions: Record<string, string[]> = {
          personalityTraits: bg?.personalityTraits ?? [],
          ideals: bg?.ideals ?? [],
          bonds: bg?.bonds ?? [],
          flaws: bg?.flaws ?? [],
        }
        const charSnap = char
        function Suggestions({ fieldKey }: { fieldKey: keyof Character }) {
          const items = bgSuggestions[fieldKey as string] ?? []
          if (items.length === 0 || !charSnap) return null
          return (
            <div className="mt-1.5">
              <p className="text-[10px] text-parchment-400 uppercase tracking-wide font-semibold mb-1">
                {bg?.name} suggestions — click to add
              </p>
              <div className="flex flex-wrap gap-1">
                {items.map((item, i) => (
                  <button key={i} type="button"
                    className="text-xs bg-parchment-100 text-parchment-500 hover:bg-amber-50 hover:text-amber-800 border border-parchment-200 hover:border-amber-300 rounded px-2 py-0.5 text-left transition-colors"
                    onClick={() => {
                      const current = (charSnap[fieldKey] as string) ?? ''
                      if (!current.includes(item)) {
                        patch({ [fieldKey]: current ? `${current}\n${item}` : item } as Partial<Character>)
                      }
                    }}
                  >{item.length > 80 ? item.slice(0, 80) + '…' : item}</button>
                ))}
              </div>
            </div>
          )
        }

        return (
          <div className="space-y-4">

            {/* ── Evidence Board (first) ── */}
            <CampaignBoardManager
              boards={char.campaignBoard?.boards ?? []}
              activeBoard={char.campaignBoard?.activeBoard ?? ''}
              onChange={(boards, activeBoard) => patch({ campaignBoard: { boards, activeBoard } })}
            />

            {/* ── Personality ── */}
            <div className="card">
              <h2 className="text-sm font-bold text-parchment-700 uppercase tracking-wider mb-4">Personality</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {([
                  { key: 'personalityTraits', label: 'Traits', color: 'border-l-amber-400', desc: 'How do you carry yourself? What quirks define you?' },
                  { key: 'ideals',            label: 'Ideals', color: 'border-l-violet-400', desc: 'What principles do you believe in above all else?' },
                  { key: 'bonds',             label: 'Bonds',  color: 'border-l-blue-400',  desc: 'Who or what do you care most deeply about?' },
                  { key: 'flaws',             label: 'Flaws',  color: 'border-l-red-400',   desc: 'What weakness or vice might be your undoing?' },
                ] as const).map(({ key, label, color, desc }) => (
                  <div key={key} className={`border-l-[3px] pl-3 ${color}`}>
                    <label className="text-xs font-bold text-parchment-700 uppercase tracking-wide block mb-0.5">{label}</label>
                    <p className="text-[10px] text-parchment-400 mb-1.5 italic">{desc}</p>
                    <textarea
                      className="input text-sm w-full"
                      rows={3}
                      placeholder={`Your ${label.toLowerCase()}…`}
                      value={char[key] ?? ''}
                      onChange={e => patch({ [key]: e.target.value })}
                    />
                    <Suggestions fieldKey={key} />
                  </div>
                ))}
              </div>
            </div>

            {/* ── Appearance ── */}
            <div className="card">
              <h2 className="text-sm font-bold text-parchment-700 uppercase tracking-wider mb-4">Appearance</h2>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-4">
                {([
                  { key: 'age',    label: 'Age'    },
                  { key: 'height', label: 'Height' },
                  { key: 'weight', label: 'Weight' },
                  { key: 'eyes',   label: 'Eyes'   },
                  { key: 'skin',   label: 'Skin'   },
                  { key: 'hair',   label: 'Hair'   },
                ] as const).map(({ key, label }) => (
                  <div key={key}>
                    <label className="text-[10px] font-bold text-parchment-500 uppercase tracking-wide block mb-1">{label}</label>
                    <input
                      className="input text-sm w-full"
                      placeholder="—"
                      value={char[key] ?? ''}
                      onChange={e => patch({ [key]: e.target.value })}
                    />
                  </div>
                ))}
              </div>
              <div>
                <label className="text-[10px] font-bold text-parchment-500 uppercase tracking-wide block mb-1">Alignment</label>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {['Lawful Good','Neutral Good','Chaotic Good','Lawful Neutral','True Neutral','Chaotic Neutral','Lawful Evil','Neutral Evil','Chaotic Evil','Unaligned'].map(a => (
                    <button key={a} type="button"
                      onClick={() => patch({ alignment: char.alignment === a ? '' : a })}
                      className={`text-xs px-2.5 py-1 rounded border transition-colors ${
                        char.alignment === a
                          ? 'bg-parchment-700 text-parchment-100 border-parchment-700'
                          : 'bg-parchment-50 text-parchment-600 border-parchment-200 hover:border-parchment-400'
                      }`}
                    >{a}</button>
                  ))}
                </div>
                <label className="text-[10px] font-bold text-parchment-500 uppercase tracking-wide block mb-1">Description</label>
                <textarea
                  className="input text-sm w-full"
                  rows={3}
                  placeholder="Describe your character's appearance…"
                  value={char.appearance ?? ''}
                  onChange={e => patch({ appearance: e.target.value })}
                />
              </div>
            </div>

            {/* ── Backstory ── */}
            <div className="card">
              <div className="flex items-baseline justify-between mb-3">
                <h2 className="text-sm font-bold text-parchment-700 uppercase tracking-wider">Backstory</h2>
                {bg && <span className="text-xs text-parchment-400">{bg.name}</span>}
              </div>
              <textarea
                className="input text-sm w-full"
                rows={8}
                placeholder="Where do you come from? What shaped who you are? What drives you forward?"
                value={char.backstory ?? ''}
                onChange={e => patch({ backstory: e.target.value })}
              />
            </div>


          </div>
        )
      })()}
      </>
      )}

      {/* Long Rest modal */}
      {longRestOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card max-w-sm w-full p-5">
            <h2 className="section-header">Long Rest</h2>
            <p className="text-sm text-parchment-600 mb-4">Taking a long rest will fully restore your HP, spell slots, class resources, and recover half your hit dice.</p>
            <ul className="text-xs text-parchment-500 space-y-1 mb-6">
              <li>• HP restored to {maxHp}</li>
              <li>• All spell slots restored</li>
              <li>• All class resources restored</li>
              {(() => {
                const totalHd = char.classes.reduce((s, c) => s + c.level, 0)
                const hdRecover = Math.max(1, Math.ceil(totalHd / 2))
                const totalUsed = char.classes.reduce((s, cc) => s + ((char.hitDiceUsed ?? {})[cc.classSlug] ?? 0), 0)
                const actual = Math.min(totalUsed, hdRecover)
                return actual > 0 ? <li>• {actual} hit {actual === 1 ? 'die' : 'dice'} recovered</li> : null
              })()}
            </ul>
            <div className="flex gap-2 justify-end">
              <button className="btn btn-secondary text-sm" onClick={() => setLongRestOpen(false)}>Cancel</button>
              <button
                className="btn btn-primary text-sm"
                onClick={() => {
                  const resets: Record<string, number> = {}
                  longRestResourceKeys(classResources).forEach(k => {
                    const r = classResources.find(x => x.key === k)!
                    resets[k] = r.max ?? (char.classResources?.[k] ?? 0)
                  })
                  // Reset custom resources on long rest
                  ;(char.customResources ?? []).forEach(r => { resets[r.key] = r.max })
                  const freshSlots: Character['spellSlots'] = {}
                  const maxSource = multiclassMaxes ?? Object.fromEntries(
                    Object.entries(char.spellSlots).map(([k, v]) => [k, v.max])
                  )
                  for (const [lvl, max] of Object.entries(maxSource)) {
                    if (max > 0) freshSlots[lvl] = { max, used: 0 }
                  }
                  const totalHd = char.classes.reduce((s, c) => s + c.level, 0)
                  const hdRecover = Math.max(1, Math.ceil(totalHd / 2))
                  const newHitDiceUsed: Record<string, number> = {}
                  let toRecover = hdRecover
                  for (const cc of char.classes) {
                    const used = (char.hitDiceUsed ?? {})[cc.classSlug] ?? 0
                    const recover = Math.min(used, toRecover)
                    newHitDiceUsed[cc.classSlug] = used - recover
                    toRecover -= recover
                    if (toRecover <= 0) break
                  }
                  patch({
                    hp: { ...char.hp, current: maxHp },
                    classResources: { ...char.classResources, ...resets, 'cannon-free-used': 0, 'breath-weapon-used': 0 },
                    spellSlots: freshSlots,
                    hitDiceUsed: newHitDiceUsed,
                    freeSpellUses: {},
                    pactSlots: char.pactSlots ? { ...char.pactSlots, used: 0 } : undefined,
                    equipment: char.equipment.map(e =>
                      e.rechargesOnLongRest && e.chargesMax !== undefined ? { ...e, charges: e.chargesMax } : e
                    ),
                  })
                  setLongRestOpen(false)
                }}
              >Begin Long Rest</button>
            </div>
          </div>
        </div>
      )}

      {/* Short Rest modal */}
      {shortRestOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card max-w-sm w-full p-5">
            <h2 className="section-header">Short Rest</h2>
            <p className="text-xs text-parchment-500 mb-4">Roll your hit dice physically and enter the result. CON modifier is added automatically.</p>

            {/* Hit dice per class */}
            <div className="space-y-4 mb-4">
              {char.classes.map(cc => {
                const hd = CLASS_OPTIONS[cc.classSlug]?.hitDie ?? content.classes.find(c => c.slug === cc.classSlug)?.hitDie ?? 8
                const used = (char.hitDiceUsed ?? {})[cc.classSlug] ?? 0
                const remaining = cc.level - used
                const spent = shortRestDice[cc.classSlug] ?? 0
                const conMod = abilityModFor(char, 'con')
                const rawRoll = parseInt(shortRestRolls[cc.classSlug] ?? '', 10)
                const rollValid = !isNaN(rawRoll) && rawRoll >= spent && rawRoll <= hd * spent
                const heal = rollValid ? rawRoll + conMod * spent : null
                return (
                  <div key={cc.classSlug} className="space-y-2">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-parchment-700 w-16 shrink-0">d{hd}</span>
                      <span className="text-xs text-parchment-400">{remaining} remaining</span>
                      <div className="flex items-center gap-1.5 ml-auto">
                        <button
                          className="w-6 h-6 rounded bg-parchment-200 hover:bg-parchment-300 text-sm font-bold disabled:opacity-40"
                          disabled={spent === 0}
                          onClick={() => {
                            setShortRestDice(d => ({ ...d, [cc.classSlug]: Math.max(0, spent - 1) }))
                            setShortRestRolls(r => ({ ...r, [cc.classSlug]: '' }))
                          }}
                        >−</button>
                        <span className="w-6 text-center text-sm font-semibold">{spent}</span>
                        <button
                          className="w-6 h-6 rounded bg-parchment-200 hover:bg-parchment-300 text-sm font-bold disabled:opacity-40"
                          disabled={spent >= remaining}
                          onClick={() => {
                            setShortRestDice(d => ({ ...d, [cc.classSlug]: Math.min(remaining, spent + 1) }))
                            setShortRestRolls(r => ({ ...r, [cc.classSlug]: '' }))
                          }}
                        >+</button>
                      </div>
                    </div>
                    {spent > 0 && (
                      <div className="flex items-center gap-2 pl-1">
                        <span className="text-xs text-parchment-500 shrink-0">Roll {spent}d{hd}:</span>
                        <input
                          type="number"
                          min={spent}
                          max={hd * spent}
                          placeholder={`${spent}–${hd * spent}`}
                          value={shortRestRolls[cc.classSlug] ?? ''}
                          onChange={e => setShortRestRolls(r => ({ ...r, [cc.classSlug]: e.target.value }))}
                          className="input text-sm py-0.5 w-20 text-center"
                        />
                        {conMod !== 0 && <span className="text-xs text-parchment-400 shrink-0">{conMod > 0 ? `+${conMod * spent}` : conMod * spent} CON</span>}
                        {heal !== null && (
                          <span className="text-xs font-semibold text-green-700 shrink-0 ml-auto">+{heal} HP</span>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Total recovery */}
            {(() => {
              const conMod = abilityModFor(char, 'con')
              const totalHeal = char.classes.reduce((sum, cc) => {
                const spent = shortRestDice[cc.classSlug] ?? 0
                if (spent === 0) return sum
                const raw = parseInt(shortRestRolls[cc.classSlug] ?? '', 10)
                if (isNaN(raw)) return sum
                return sum + raw + conMod * spent
              }, 0)
              const anySpent = char.classes.some(cc => (shortRestDice[cc.classSlug] ?? 0) > 0)
              const newHp = Math.min(maxHp, char.hp.current + totalHeal)
              return anySpent && totalHeal > 0 ? (
                <p className="text-sm font-semibold text-green-700 mb-4">
                  Total: +{totalHeal} HP → {newHp} / {maxHp}
                </p>
              ) : null
            })()}

            <div className="flex gap-2 justify-end">
              <button className="btn btn-secondary text-sm" onClick={() => { setShortRestOpen(false); setShortRestDice({}); setShortRestRolls({}) }}>Cancel</button>
              <button
                className="btn btn-primary text-sm"
                onClick={() => {
                  const conMod = abilityModFor(char, 'con')
                  const totalHeal = char.classes.reduce((sum, cc) => {
                    const spent = shortRestDice[cc.classSlug] ?? 0
                    if (spent === 0) return sum
                    const raw = parseInt(shortRestRolls[cc.classSlug] ?? '', 10)
                    if (isNaN(raw)) return sum
                    return sum + raw + conMod * spent
                  }, 0)
                  const newHitDiceUsed: Record<string, number> = { ...(char.hitDiceUsed ?? {}) }
                  for (const [slug, spent] of Object.entries(shortRestDice)) {
                    if (spent > 0) newHitDiceUsed[slug] = (newHitDiceUsed[slug] ?? 0) + spent
                  }
                  const resets: Record<string, number> = {}
                  shortRestResourceKeys(classResources).forEach(k => {
                    const r = classResources.find(x => x.key === k)!
                    resets[k] = r.max ?? (char.classResources?.[k] ?? 0)
                  })
                  // Reset short-rest custom resources
                  ;(char.customResources ?? []).filter(r => r.recharge === 'short').forEach(r => { resets[r.key] = r.max })
                  patch({
                    hp: { ...char.hp, current: Math.min(maxHp, char.hp.current + totalHeal) },
                    hitDiceUsed: newHitDiceUsed,
                    classResources: { ...char.classResources, ...resets, 'breath-weapon-used': 0 },
                    ...(char.pactSlots ? { pactSlots: { ...char.pactSlots, used: 0 } } : {}),
                  })
                  setShortRestOpen(false)
                  setShortRestDice({})
                  setShortRestRolls({})
                }}
              >Finish Rest</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Feat modal */}
      {addFeatOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-parchment-50 rounded-lg shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-parchment-200">
              <h3 className="font-semibold text-parchment-900">Add Feat</h3>
              <button type="button" className="text-parchment-400 hover:text-parchment-700 text-xl leading-none"
                onClick={() => setAddFeatOpen(false)}>✕</button>
            </div>
            <div className="p-3 border-b border-parchment-200">
              <input
                autoFocus
                type="text"
                placeholder="Search feats..."
                className="w-full border border-parchment-300 rounded px-3 py-2 text-sm bg-parchment-50 focus:outline-none focus:ring-1 focus:ring-parchment-500"
                value={addFeatSearch}
                onChange={e => setAddFeatSearch(e.target.value)}
              />
            </div>
            <div className="overflow-y-auto flex-1 p-2">
              {content.feats
                .filter(f => {
                  if (addFeatSearch && !f.name.toLowerCase().includes(addFeatSearch.toLowerCase())) return false
                  return true
                })
                .sort((a, b) => a.name.localeCompare(b.name))
                .map(f => {
                  const alreadyHas = char.featuresChosen.some(fc =>
                    (fc.key === 'feat-l1' || fc.key.startsWith('feat-')) &&
                    (fc.value === f.slug || (Array.isArray(fc.value) && fc.value[0] === f.slug))
                  )
                  return (
                    <button
                      key={f.slug}
                      type="button"
                      disabled={alreadyHas}
                      className={`w-full text-left px-3 py-2 rounded mb-1 transition-colors ${
                        alreadyHas
                          ? 'opacity-40 cursor-not-allowed bg-parchment-100'
                          : 'hover:bg-parchment-200 bg-parchment-50 border border-parchment-100'
                      }`}
                      onClick={() => {
                        if (alreadyHas) return
                        const key = `feat-manual-${Date.now()}`
                        patch({ featuresChosen: [...char.featuresChosen, { key, value: f.slug }] })
                        setAddFeatOpen(false)
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{f.name}</span>
                        {alreadyHas && <span className="text-xs text-parchment-400 italic">already chosen</span>}
                      </div>
                      {f.prerequisite && (
                        <div className="text-xs text-parchment-400 mt-0.5">Prereq: {f.prerequisite}</div>
                      )}
                      {f.description && (
                        <div className="text-xs text-parchment-500 mt-0.5 line-clamp-2">{f.description}</div>
                      )}
                    </button>
                  )
                })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
