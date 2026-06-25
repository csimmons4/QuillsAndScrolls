import type { SpellDef } from './loaders'
import { RITUAL_SLUGS } from '../data/spellMeta'

/**
 * Mechanical fields the scraper doesn't fill but are reliably derivable from
 * the scraped prose. Applied in `mergeSpells` before overlay, so curated
 * overlay entries still win when they disagree.
 */

const SAVE_ABILITIES = ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'] as const
const SAVE_RE = new RegExp(`(${SAVE_ABILITIES.join('|')})\\s+saving throw`, 'i')

const DAMAGE_TYPES = [
  'acid', 'bludgeoning', 'cold', 'fire', 'force', 'lightning', 'necrotic',
  'piercing', 'poison', 'psychic', 'radiant', 'slashing', 'thunder',
] as const
const DICE_RE = /\b(\d+d\d+)\b/
const DAMAGE_TYPE_RE = new RegExp(`\\b(${DAMAGE_TYPES.join('|')})\\s+damage\\b`, 'i')
// Preferred: dice immediately adjacent to type ("3d6 fire damage", "2d8+1d6 cold damage")
const DIRECT_DAMAGE_RE = new RegExp(`\\b(\\d+d\\d+)\\s+(${DAMAGE_TYPES.join('|')})\\s+damage\\b`, 'i')

const ABILITY_SLUG: Record<string, 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'> = {
  strength: 'str', dexterity: 'dex', constitution: 'con',
  intelligence: 'int', wisdom: 'wis', charisma: 'cha',
}

function deriveComponents(components: string): SpellDef['componentsParsed'] {
  const upper = components.toUpperCase()
  const materialMatch = components.match(/M\s*\(([^)]+)\)/)
  return {
    v: upper.includes('V'),
    s: upper.includes('S'),
    m: upper.includes('M'),
    materialText: materialMatch?.[1],
  }
}

function deriveDamage(desc: string): SpellDef['damage'] | undefined {
  // Prefer dice immediately adjacent to type — avoids picking up unrelated dice
  const direct = desc.match(DIRECT_DAMAGE_RE)
  if (direct) return { dice: direct[1], type: direct[2].toLowerCase() }
  // Fall back to separate matches for spells like "1d4 + 1 force damage"
  const dice = desc.match(DICE_RE)
  const type = desc.match(DAMAGE_TYPE_RE)
  if (!dice || !type) return undefined
  return { dice: dice[1], type: type[1].toLowerCase() }
}

function deriveSavingThrow(desc: string): SpellDef['savingThrow'] | undefined {
  const m = desc.match(SAVE_RE)
  if (!m) return undefined
  const ability = ABILITY_SLUG[m[1].toLowerCase()]
  if (!ability) return undefined
  let effectOnSave: 'half' | 'none' | 'negates' = 'negates'
  if (/half\s+as\s+much|half\s+the\s+damage|takes?\s+half\s+damage|takes?\s+half\b/i.test(desc)) effectOnSave = 'half'
  else if (/no\s+damage\s+on\s+a\s+successful|no\s+damage\s+if\s+it\s+succeeds/i.test(desc)) effectOnSave = 'none'
  return { ability, effectOnSave }
}

function deriveAttackRoll(desc: string): 'melee' | 'ranged' | undefined {
  if (/melee\s+spell\s+attack/i.test(desc)) return 'melee'
  if (/ranged\s+spell\s+attack/i.test(desc)) return 'ranged'
  return undefined
}

/** Fill in derivable enrichment fields. Existing values (e.g. from overlay
 *  applied earlier in the pipeline) are preserved via `??`. */
export function enrichSpell(spell: SpellDef): SpellDef {
  const desc = spell.description ?? ''
  return {
    ...spell,
    concentration: spell.concentration ?? /concentration/i.test(spell.duration ?? ''),
    ritual: spell.ritual ?? RITUAL_SLUGS.has(spell.slug),
    componentsParsed: spell.componentsParsed ?? deriveComponents(spell.components ?? ''),
    damage: spell.damage ?? deriveDamage(desc),
    savingThrow: spell.savingThrow ?? deriveSavingThrow(desc),
    attackRoll: spell.attackRoll ?? deriveAttackRoll(desc),
  }
}
