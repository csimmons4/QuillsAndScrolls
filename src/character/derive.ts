import { Character, Ability, Skill, SKILL_ABILITY } from './model'
import type { ContentData } from '../content/ContentProvider'

export function abilityMod(score: number): number {
  return Math.floor((score - 10) / 2)
}

export function proficiencyBonus(totalLevel: number): number {
  return Math.ceil(totalLevel / 4) + 1
}

export function totalLevel(char: Character): number {
  return char.classes.reduce((s, c) => s + c.level, 0)
}

export function profBonus(char: Character): number {
  return proficiencyBonus(totalLevel(char))
}

export function abilityModFor(char: Character, ability: Ability): number {
  return abilityMod(char.abilityScores[ability])
}

export function hasBardJackOfAllTrades(char: Character): boolean {
  return char.classes.some(c => c.classSlug === 'bard' && c.level >= 2)
}

export function skillMod(char: Character, skill: Skill): number {
  const base = abilityModFor(char, SKILL_ABILITY[skill])
  const pb = profBonus(char)
  if (char.skillExpertise.includes(skill)) return base + pb * 2
  if (char.skillProficiencies.includes(skill)) return base + pb
  if (hasBardJackOfAllTrades(char)) return base + Math.floor(pb / 2)
  return base
}

export function saveMod(char: Character, ability: Ability): number {
  const base = abilityModFor(char, ability)
  if (char.saveProficiencies.includes(ability)) return base + profBonus(char)
  return base
}

export function passivePerception(char: Character): number {
  return 10 + skillMod(char, 'perception')
}

export function hpMax(char: Character, content: ContentData | null): number {
  if (char.hp.maxOverride !== undefined) return char.hp.maxOverride
  const conMod = abilityModFor(char, 'con')
  let total = 0
  for (const cc of char.classes) {
    const classDef = content?.classes.find(c => c.slug === cc.classSlug)
    const hitDie = classDef?.hitDie ?? 8
    const rolls = cc.hitDieRolls
    for (let i = 0; i < cc.level; i++) {
      const roll = rolls[i] ?? Math.floor(hitDie / 2) + 1
      total += roll + conMod
    }
  }
  return Math.max(1, total)
}

export function initiativeBonus(char: Character): number {
  return abilityModFor(char, 'dex')
}

export function spellSaveDC(char: Character, classSlug: string, content: ContentData | null): number {
  const classDef = content?.classes.find(c => c.slug === classSlug)
  const spellAbility = classDef?.spellcastingAbility as Ability | undefined
  if (!spellAbility) return 0
  return 8 + profBonus(char) + abilityModFor(char, spellAbility)
}

export function spellAttackBonus(char: Character, classSlug: string, content: ContentData | null): number {
  const classDef = content?.classes.find(c => c.slug === classSlug)
  const spellAbility = classDef?.spellcastingAbility as Ability | undefined
  if (!spellAbility) return 0
  return profBonus(char) + abilityModFor(char, spellAbility)
}


export function formatMod(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`
}

// ── Class resource derivation ──────────────────────────────────────────────

export interface ClassResource {
  key: string
  name: string
  current: number
  max: number | null  // null = unlimited (Barbarian L20 rage)
  recharge: 'short' | 'long' | 'dawn'
  display?: string    // e.g. "d8", "+3 dmg", "5×Lvl HP"
  classSlug: string
}

export function deriveClassResources(char: Character): ClassResource[] {
  const resources: ClassResource[] = []
  const pb = profBonus(char)
  const stored = char.classResources ?? {}

  const get = (key: string, fallback: number) => stored[key] ?? fallback

  for (const cc of char.classes) {
    const { classSlug: slug, level: lvl } = cc

    switch (slug) {
      case 'barbarian': {
        const maxRage = lvl >= 20 ? null : lvl >= 17 ? 6 : lvl >= 12 ? 5 : lvl >= 6 ? 4 : lvl >= 3 ? 3 : 2
        const rageBonus = lvl >= 16 ? 4 : lvl >= 9 ? 3 : 2
        resources.push({
          key: 'rage-uses', name: 'Rage', classSlug: slug,
          current: get('rage-uses', maxRage ?? 6),
          max: maxRage, recharge: 'long',
          display: `+${rageBonus} dmg · B/P/S resist`,
        })
        break
      }
      case 'bard': {
        const chaMod = Math.max(1, abilityModFor(char, 'cha'))
        const die = lvl >= 15 ? 'd12' : lvl >= 10 ? 'd10' : lvl >= 5 ? 'd8' : 'd6'
        resources.push({
          key: 'bardic-inspiration', name: 'Bardic Inspiration', classSlug: slug,
          current: get('bardic-inspiration', chaMod),
          max: chaMod,
          recharge: lvl >= 5 ? 'short' : 'long',
          display: die,
        })
        break
      }
      case 'cleric': {
        if (lvl >= 2) {
          const cdMax = lvl >= 18 ? 3 : lvl >= 6 ? 2 : 1
          resources.push({
            key: 'channel-divinity', name: 'Channel Divinity', classSlug: slug,
            current: get('channel-divinity', cdMax),
            max: cdMax, recharge: 'short',
          })
        }
        if (lvl >= 10) {
          resources.push({
            key: 'divine-intervention', name: 'Divine Intervention', classSlug: slug,
            current: get('divine-intervention', 1),
            max: 1, recharge: 'long',
            display: lvl >= 20 ? 'auto-succeeds' : `${lvl}% chance`,
          })
        }
        break
      }
      case 'druid': {
        if (lvl >= 2) {
          const crThreshold = lvl >= 18 ? '∞' : lvl >= 8 ? 'CR 1' : lvl >= 4 ? 'CR 1/2' : 'CR 1/4'
          resources.push({
            key: 'wild-shape', name: 'Wild Shape', classSlug: slug,
            current: get('wild-shape', 2),
            max: lvl >= 20 ? null : 2, recharge: 'short',
            display: crThreshold,
          })
        }
        break
      }
      case 'fighter': {
        resources.push({
          key: 'second-wind', name: 'Second Wind', classSlug: slug,
          current: get('second-wind', 1),
          max: 1, recharge: 'short',
          display: `1d10+${lvl} HP`,
        })
        if (lvl >= 2) {
          const surgeMax = lvl >= 17 ? 2 : 1
          resources.push({
            key: 'action-surge', name: 'Action Surge', classSlug: slug,
            current: get('action-surge', surgeMax),
            max: surgeMax, recharge: 'short',
          })
        }
        if (lvl >= 9) {
          const indomMax = lvl >= 17 ? 3 : lvl >= 13 ? 2 : 1
          resources.push({
            key: 'indomitable', name: 'Indomitable', classSlug: slug,
            current: get('indomitable', indomMax),
            max: indomMax, recharge: 'long',
            display: 'reroll failed save',
          })
        }
        // ── Subclass resources ──
        if (cc.subclassSlug === 'psi-warrior') {
          const die = lvl >= 17 ? 'd12' : lvl >= 11 ? 'd10' : lvl >= 5 ? 'd8' : 'd6'
          resources.push({
            key: 'psi-warrior-energy', name: 'Psionic Energy Dice', classSlug: slug,
            current: get('psi-warrior-energy', 2 * pb), max: 2 * pb, recharge: 'long',
            display: `${die} · regain 1 on init/short rest`,
          })
        }
        if (cc.subclassSlug === 'rune-knight') {
          resources.push({
            key: 'giants-might', name: "Giant's Might", classSlug: slug,
            current: get('giants-might', pb), max: pb, recharge: 'long',
            display: 'Large · adv STR · +1d6 dmg',
          })
        }
        if (cc.subclassSlug === 'samurai') {
          const tempHp = lvl >= 15 ? 15 : lvl >= 10 ? 10 : 5
          resources.push({
            key: 'fighting-spirit', name: 'Fighting Spirit', classSlug: slug,
            current: get('fighting-spirit', 3), max: 3, recharge: 'long',
            display: `adv on attacks · +${tempHp} temp HP`,
          })
        }
        break
      }
      case 'monk': {
        resources.push({
          key: 'ki-points', name: 'Ki Points', classSlug: slug,
          current: get('ki-points', lvl),
          max: lvl, recharge: 'short',
          display: `DC ${8 + pb + abilityModFor(char, 'wis')} Stunning`,
        })
        if (lvl >= 4) {
          resources.push({
            key: 'slow-fall', name: 'Slow Fall (reaction)', classSlug: slug,
            current: get('slow-fall', 1), max: 1, recharge: 'short',
            display: `−${lvl * 5} fall dmg`,
          })
        }
        break
      }
      case 'paladin': {
        const chaMod = Math.max(0, abilityModFor(char, 'cha'))
        resources.push({
          key: 'divine-sense', name: 'Divine Sense', classSlug: slug,
          current: get('divine-sense', 1 + chaMod),
          max: 1 + chaMod, recharge: 'long',
        })
        resources.push({
          key: 'lay-on-hands', name: 'Lay on Hands', classSlug: slug,
          current: get('lay-on-hands', 5 * lvl),
          max: 5 * lvl, recharge: 'long',
          display: `${5 * lvl} HP pool`,
        })
        if (lvl >= 14) {
          resources.push({
            key: 'cleansing-touch', name: 'Cleansing Touch', classSlug: slug,
            current: get('cleansing-touch', Math.max(1, chaMod)),
            max: Math.max(1, chaMod), recharge: 'long',
            display: 'end a spell',
          })
        }
        break
      }
      case 'ranger': {
        if (lvl >= 14) {
          resources.push({
            key: 'vanish', name: 'Vanish', classSlug: slug,
            current: get('vanish', 1), max: 1, recharge: 'short',
            display: 'Hide as bonus action (unlimited once unlocked)',
          })
        }
        break
      }
      case 'rogue': {
        if (lvl >= 20) {
          resources.push({
            key: 'stroke-of-luck', name: 'Stroke of Luck', classSlug: slug,
            current: get('stroke-of-luck', 1),
            max: 1, recharge: 'short',
          })
        }
        // ── Subclass resources ──
        if (cc.subclassSlug === 'soulknife') {
          const die = lvl >= 17 ? 'd12' : lvl >= 11 ? 'd10' : lvl >= 5 ? 'd8' : 'd6'
          resources.push({
            key: 'soulknife-energy', name: 'Psionic Energy Dice', classSlug: slug,
            current: get('soulknife-energy', 2 * pb), max: 2 * pb, recharge: 'long',
            display: `${die} · regain 1 on init/short rest`,
          })
        }
        break
      }
      case 'sorcerer': {
        if (lvl >= 2) {
          resources.push({
            key: 'sorcery-points', name: 'Sorcery Points', classSlug: slug,
            current: get('sorcery-points', lvl),
            max: lvl, recharge: 'long',
            display: 'Flexible Casting / Metamagic',
          })
        }
        break
      }
      case 'warlock': {
        if (lvl >= 11) {
          const arcanaCount = lvl >= 17 ? 4 : lvl >= 15 ? 3 : lvl >= 13 ? 2 : 1
          resources.push({
            key: 'mystic-arcanum', name: 'Mystic Arcanum', classSlug: slug,
            current: get('mystic-arcanum', arcanaCount),
            max: arcanaCount, recharge: 'long',
            display: `L${lvl >= 17 ? '6-9' : lvl >= 15 ? '6-8' : lvl >= 13 ? '6-7' : '6'} spells`,
          })
        }
        if (lvl >= 20) {
          resources.push({
            key: 'eldritch-master', name: 'Eldritch Master', classSlug: slug,
            current: get('eldritch-master', 1),
            max: 1, recharge: 'long',
            display: 'regain all pact slots (1 min)',
          })
        }
        break
      }
      case 'artificer': {
        if (lvl >= 5 && cc.subclassSlug === 'battle-smith') {
          const intMod = Math.max(1, abilityModFor(char, 'int'))
          const joltDice = lvl >= 15 ? '6d6' : lvl >= 9 ? '4d6' : '2d6'
          resources.push({
            key: 'arcane-jolt', name: 'Arcane Jolt', classSlug: slug,
            current: get('arcane-jolt', intMod),
            max: intMod, recharge: 'long',
            display: joltDice,
          })
        }
        if (lvl >= 7) {
          const intMod = Math.max(1, abilityModFor(char, 'int'))
          resources.push({
            key: 'flash-of-genius', name: 'Flash of Genius', classSlug: slug,
            current: get('flash-of-genius', intMod),
            max: intMod, recharge: 'long',
            display: `+${abilityModFor(char, 'int')} to save/check`,
          })
        }
        break
      }
    }
  }

  return resources
}

/** Return all resource keys that recharge on a short rest (or better). */
export function shortRestResourceKeys(resources: ClassResource[]): string[] {
  return resources.filter(r => r.recharge === 'short').map(r => r.key)
}

/** Return all resource keys (everything recharges on long rest). */
export function longRestResourceKeys(resources: ClassResource[]): string[] {
  return resources.map(r => r.key)
}
