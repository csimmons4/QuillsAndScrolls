import { Character, Ability, Skill, SKILL_ABILITY } from './model'
import type { ContentData } from '../content/ContentProvider'
import { ELDRITCH_INVOCATIONS } from '../data/classData'

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

export function monkSpeedBonus(char: Character): number {
  const entry = char.classes.find(c => c.classSlug === 'monk')
  if (!entry) return 0
  const lvl = entry.level
  if (lvl >= 18) return 30
  if (lvl >= 14) return 25
  if (lvl >= 10) return 20
  if (lvl >= 6) return 15
  if (lvl >= 2) return 10
  return 0
}

export function sneakAttackDice(char: Character): number {
  const entry = char.classes.find(c => c.classSlug === 'rogue')
  if (!entry) return 0
  return Math.ceil(entry.level / 2)
}

export function paladinAuraBonus(char: Character): number {
  const entry = char.classes.find(c => c.classSlug === 'paladin')
  if (!entry || entry.level < 6) return 0
  return Math.max(1, abilityModFor(char, 'cha'))
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
        // Subclass resources
        if (cc.subclassSlug === 'zealot' && lvl >= 10) {
          resources.push({
            key: 'zealous-presence', name: 'Zealous Presence', classSlug: slug,
            current: get('zealous-presence', 1), max: 1, recharge: 'long',
            display: 'Bonus action: 10 allies gain adv on attacks & saves 1 turn',
          })
        }
        if (cc.subclassSlug === 'beast' && lvl >= 6) {
          resources.push({
            key: 'infectious-fury', name: 'Infectious Fury', classSlug: slug,
            current: get('infectious-fury', pb), max: pb, recharge: 'long',
            display: 'Force redirected attack or 2d12 psychic (CON save)',
          })
        }
        if (cc.subclassSlug === 'beast' && lvl >= 10) {
          resources.push({
            key: 'call-the-hunt', name: 'Call the Hunt', classSlug: slug,
            current: get('call-the-hunt', pb), max: pb, recharge: 'long',
            display: `Bonus action: grant ${pb} allies +d6 on one damage/turn`,
          })
        }
        if (cc.subclassSlug === 'ancestral-guardian' && lvl >= 10) {
          resources.push({
            key: 'consult-the-spirits', name: 'Consult the Spirits', classSlug: slug,
            current: get('consult-the-spirits', 1), max: 1, recharge: 'short',
            display: 'Cast Clairvoyance or Commune (no slot)',
          })
        }
        if (cc.subclassSlug === 'wild-magic' && lvl >= 6) {
          resources.push({
            key: 'bolstering-magic', name: 'Bolstering Magic', classSlug: slug,
            current: get('bolstering-magic', pb), max: pb, recharge: 'long',
            display: '+1d3 to attack/save, or regain L1–L2 spell slot',
          })
        }
        if (cc.subclassSlug === 'rune-knight' && lvl >= 7) {
          resources.push({
            key: 'runic-shield', name: 'Runic Shield', classSlug: slug,
            current: get('runic-shield', pb), max: pb, recharge: 'long',
            display: 'Reaction: impose disadvantage on attack roll against an ally',
          })
        }
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
        if (cc.subclassSlug === 'glamour' && lvl >= 6) {
          resources.push({
            key: 'mantle-of-majesty', name: 'Mantle of Majesty', classSlug: slug,
            current: get('mantle-of-majesty', 1), max: 1, recharge: 'long',
            display: 'Bonus action: cast Command free each turn for 1 min (no slot)',
          })
        }
        if (cc.subclassSlug === 'glamour' && lvl >= 14) {
          resources.push({
            key: 'unbreakable-majesty', name: 'Unbreakable Majesty', classSlug: slug,
            current: get('unbreakable-majesty', 1), max: 1, recharge: 'long',
            display: 'Assume divine form; first attacker each turn must CHA save or attack fails',
          })
        }
        if (cc.subclassSlug === 'whispers' && lvl >= 6) {
          resources.push({
            key: 'mantle-of-whispers', name: 'Mantle of Whispers', classSlug: slug,
            current: get('mantle-of-whispers', 1), max: 1, recharge: 'long',
            display: 'Reaction: capture shadow of humanoid dying within 30ft',
          })
        }
        if (cc.subclassSlug === 'whispers' && lvl >= 14) {
          resources.push({
            key: 'shadow-lore', name: 'Shadow Lore', classSlug: slug,
            current: get('shadow-lore', 1), max: 1, recharge: 'long',
            display: 'Whisper to creature: WIS save or charmed 8 hr, follow commands',
          })
        }
        if (cc.subclassSlug === 'creation' && lvl >= 3) {
          resources.push({
            key: 'performance-of-creation', name: 'Performance of Creation', classSlug: slug,
            current: get('performance-of-creation', 1), max: 1, recharge: 'long',
            display: 'Action: create Large-or-smaller nonmagical item (lasts PB days)',
          })
        }
        if (cc.subclassSlug === 'creation' && lvl >= 6) {
          resources.push({
            key: 'animating-performance', name: 'Animating Performance', classSlug: slug,
            current: get('animating-performance', 1), max: 1, recharge: 'long',
            display: 'Action: animate Large item as a Dancing Item for 1 hr',
          })
        }
        if (cc.subclassSlug === 'eloquence' && lvl >= 6) {
          resources.push({
            key: 'universal-speech', name: 'Universal Speech', classSlug: slug,
            current: get('universal-speech', 1), max: 1, recharge: 'long',
            display: `${chaMod} creatures comprehend any language you speak for 1 hr`,
          })
        }
        if (cc.subclassSlug === 'eloquence' && lvl >= 14) {
          resources.push({
            key: 'infectious-inspiration', name: 'Infectious Inspiration', classSlug: slug,
            current: get('infectious-inspiration', chaMod), max: chaMod, recharge: 'long',
            display: 'Reaction: creature that failed an Inspiration roll can retry',
          })
        }
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
        // ── Subclass resources ──
        const clericWisMod = Math.max(1, abilityModFor(char, 'wis'))
        if (cc.subclassSlug === 'light') {
          resources.push({
            key: 'warding-flare', name: 'Warding Flare', classSlug: slug,
            current: get('warding-flare', clericWisMod), max: clericWisMod, recharge: 'long',
            display: 'Reaction: impose disadvantage on attack vs creature within 30ft',
          })
        }
        if (cc.subclassSlug === 'tempest') {
          resources.push({
            key: 'wrath-of-the-storm', name: 'Wrath of the Storm', classSlug: slug,
            current: get('wrath-of-the-storm', clericWisMod), max: clericWisMod, recharge: 'long',
            display: 'Reaction when hit: deal 2d8 lightning or thunder (DEX halves)',
          })
        }
        if (cc.subclassSlug === 'war') {
          resources.push({
            key: 'war-priest', name: 'War Priest', classSlug: slug,
            current: get('war-priest', clericWisMod), max: clericWisMod, recharge: 'long',
            display: 'Bonus action attack after casting a Cleric weapon attack spell',
          })
        }
        if (cc.subclassSlug === 'grave') {
          resources.push({
            key: 'eyes-of-the-grave', name: 'Eyes of the Grave', classSlug: slug,
            current: get('eyes-of-the-grave', clericWisMod), max: clericWisMod, recharge: 'long',
            display: 'Action: detect undead within 60ft until end of next turn',
          })
        }
        if (cc.subclassSlug === 'order' && lvl >= 6) {
          resources.push({
            key: 'embodiment-of-the-law', name: 'Embodiment of the Law', classSlug: slug,
            current: get('embodiment-of-the-law', clericWisMod), max: clericWisMod, recharge: 'long',
            display: 'Cast an enchantment spell as a bonus action',
          })
        }
        if (cc.subclassSlug === 'peace') {
          resources.push({
            key: 'emboldening-bond', name: 'Emboldening Bond', classSlug: slug,
            current: get('emboldening-bond', pb), max: pb, recharge: 'long',
            display: `Bond ${pb} creatures: +d4 to attacks/saves/checks while within 30ft of each other`,
          })
        }
        if (cc.subclassSlug === 'twilight') {
          resources.push({
            key: 'eyes-of-night', name: 'Eyes of Night', classSlug: slug,
            current: get('eyes-of-night', clericWisMod), max: clericWisMod, recharge: 'long',
            display: `Grant darkvision 300ft to ${clericWisMod} creatures within 10ft`,
          })
        }
        if (cc.subclassSlug === 'twilight' && lvl >= 6) {
          resources.push({
            key: 'steps-of-night', name: 'Steps of Night', classSlug: slug,
            current: get('steps-of-night', pb), max: pb, recharge: 'long',
            display: 'Bonus action: fly speed = walk speed for 1 min (dim light or darkness)',
          })
        }
        break
      }
      case 'druid': {
        if (lvl >= 2) {
          let crThreshold: string
          if (cc.subclassSlug === 'moon') {
            crThreshold = `CR ${Math.max(1, Math.floor(lvl / 3))}`
          } else {
            crThreshold = lvl >= 18 ? 'CR ∞' : lvl >= 8 ? 'CR 1' : lvl >= 4 ? 'CR 1/2' : 'CR 1/4'
          }
          resources.push({
            key: 'wild-shape', name: 'Wild Shape', classSlug: slug,
            current: get('wild-shape', 2),
            max: lvl >= 20 ? null : 2, recharge: 'short',
            display: crThreshold,
          })
        }
        if (cc.subclassSlug === 'land' && lvl >= 2) {
          resources.push({
            key: 'natural-recovery', name: 'Natural Recovery', classSlug: slug,
            current: get('natural-recovery', 1), max: 1, recharge: 'long',
            display: `≤${Math.ceil(lvl / 2)} slot levels (SR, no 6th+)`,
          })
        }
        if (cc.subclassSlug === 'dreams' && lvl >= 2) {
          const wisMod = Math.max(1, abilityModFor(char, 'wis'))
          resources.push({
            key: 'balm-summer-court', name: 'Balm of the Summer Court', classSlug: slug,
            current: get('balm-summer-court', lvl), max: lvl, recharge: 'long',
            display: `${lvl}d6 pool · bonus action · +${wisMod} HP+temp HP`,
          })
        }
        if (cc.subclassSlug === 'spores' && lvl >= 6) {
          const wisMod = Math.max(1, abilityModFor(char, 'wis'))
          resources.push({
            key: 'fungal-infestation', name: 'Fungal Infestation', classSlug: slug,
            current: get('fungal-infestation', wisMod), max: wisMod, recharge: 'long',
            display: 'Reaction: animate corpse as zombie (1 hr)',
          })
        }
        if (cc.subclassSlug === 'stars' && lvl >= 6) {
          const wisMod = Math.max(1, abilityModFor(char, 'wis'))
          resources.push({
            key: 'cosmic-omen', name: 'Cosmic Omen', classSlug: slug,
            current: get('cosmic-omen', wisMod), max: wisMod, recharge: 'long',
            display: 'Reaction: Woe (−1d6 to roll) or Weal (+1d6 to roll)',
          })
        }
        if (cc.subclassSlug === 'shepherd' && lvl >= 2) {
          resources.push({
            key: 'spirit-totem', name: 'Spirit Totem', classSlug: slug,
            current: get('spirit-totem', 1), max: 1, recharge: 'short',
            display: 'Bonus action: Bear/Hawk/Unicorn spirit aura (1 min)',
          })
        }
        if (cc.subclassSlug === 'wildfire' && lvl >= 10) {
          const wildfireWisMod = Math.max(1, abilityModFor(char, 'wis'))
          resources.push({
            key: 'cauterizing-flames', name: 'Cauterizing Flames', classSlug: slug,
            current: get('cauterizing-flames', wildfireWisMod), max: wildfireWisMod, recharge: 'long',
            display: 'Reaction: creature dies near flame → touch flame to heal 2d10+WIS',
          })
        }
        if (cc.subclassSlug === 'wildfire' && lvl >= 14) {
          resources.push({
            key: 'blazing-revival', name: 'Blazing Revival', classSlug: slug,
            current: get('blazing-revival', 1), max: 1, recharge: 'long',
            display: 'When dropped to 0 HP: spirit detonates, you regain half max HP',
          })
        }
        if (cc.subclassSlug === 'dreams' && lvl >= 10) {
          resources.push({
            key: 'walker-in-dreams', name: 'Walker in Dreams', classSlug: slug,
            current: get('walker-in-dreams', 1), max: 1, recharge: 'long',
            display: 'After SR: cast Teleportation Circle, Scrying, or Dream (no slot)',
          })
        }
        if (cc.subclassSlug === 'shepherd' && lvl >= 14) {
          resources.push({
            key: 'faithful-summons', name: 'Faithful Summons', classSlug: slug,
            current: get('faithful-summons', 1), max: 1, recharge: 'long',
            display: 'When reduced to 0 HP: automatically summon 4 protective spirits (1 min)',
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
        if (cc.subclassSlug === 'battle-master' && lvl >= 3) {
          const sdMax = lvl >= 15 ? 6 : lvl >= 7 ? 5 : 4
          const die = lvl >= 18 ? 'd12' : lvl >= 10 ? 'd10' : 'd8'
          const maneuverDC = 8 + pb + Math.max(abilityModFor(char, 'str'), abilityModFor(char, 'dex'))
          resources.push({
            key: 'superiority-dice', name: 'Superiority Dice', classSlug: slug,
            current: get('superiority-dice', sdMax), max: sdMax, recharge: 'short',
            display: `${die} · save DC ${maneuverDC}`,
          })
        }
        if (cc.subclassSlug === 'arcane-archer' && lvl >= 3) {
          const aaMax = lvl >= 15 ? 4 : lvl >= 7 ? 3 : 2
          resources.push({
            key: 'arcane-shot', name: 'Arcane Shot', classSlug: slug,
            current: get('arcane-shot', aaMax), max: aaMax, recharge: 'short',
            display: 'choose an Arcane Shot option',
          })
        }
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
        if (cc.subclassSlug === 'samurai' && lvl >= 15) {
          resources.push({
            key: 'strength-before-death', name: 'Strength Before Death', classSlug: slug,
            current: get('strength-before-death', 1), max: 1, recharge: 'long',
            display: 'Reaction: delay drop to 0 HP and take an immediate extra turn',
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
        if (cc.subclassSlug === 'open-hand' && lvl >= 6) {
          resources.push({
            key: 'wholeness-of-body', name: 'Wholeness of Body', classSlug: slug,
            current: get('wholeness-of-body', 1), max: 1, recharge: 'long',
            display: `Action: heal self ${lvl * 3} HP`,
          })
        }
        if (cc.subclassSlug === 'mercy' && lvl >= 17) {
          resources.push({
            key: 'hand-of-ultimate-mercy', name: 'Hand of Ultimate Mercy', classSlug: slug,
            current: get('hand-of-ultimate-mercy', 1), max: 1, recharge: 'long',
            display: 'Spend 5 ki: cast Raise Dead on creature dead ≤1 day (no material cost)',
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
        if (lvl >= 3) {
          resources.push({
            key: 'paladin-channel-divinity', name: 'Channel Divinity', classSlug: slug,
            current: get('paladin-channel-divinity', 1),
            max: 1, recharge: 'short',
          })
        }
        if (lvl >= 14) {
          resources.push({
            key: 'cleansing-touch', name: 'Cleansing Touch', classSlug: slug,
            current: get('cleansing-touch', Math.max(1, chaMod)),
            max: Math.max(1, chaMod), recharge: 'long',
            display: 'end a spell',
          })
        }
        // ── Subclass resources ──
        const paladinCha = Math.max(1, abilityModFor(char, 'cha'))
        if (cc.subclassSlug === 'devotion' && lvl >= 20) {
          resources.push({
            key: 'holy-nimbus', name: 'Holy Nimbus', classSlug: slug,
            current: get('holy-nimbus', 1), max: 1, recharge: 'long',
            display: '1 min: bright light 30ft, undead/fiends 10 radiant/turn, adv on saves vs their spells',
          })
        }
        if (cc.subclassSlug === 'ancients' && lvl >= 15) {
          resources.push({
            key: 'undying-sentinel', name: 'Undying Sentinel', classSlug: slug,
            current: get('undying-sentinel', 1), max: 1, recharge: 'long',
            display: 'When reduced to 0 HP: drop to 1 HP instead',
          })
        }
        if (cc.subclassSlug === 'ancients' && lvl >= 20) {
          resources.push({
            key: 'elder-champion', name: 'Elder Champion', classSlug: slug,
            current: get('elder-champion', 1), max: 1, recharge: 'long',
            display: '1 min: regain 10 HP/turn, cast paladin spells as bonus action, aura forces adv saves vs undead/fiends',
          })
        }
        if (cc.subclassSlug === 'vengeance' && lvl >= 20) {
          resources.push({
            key: 'avenging-angel', name: 'Avenging Angel', classSlug: slug,
            current: get('avenging-angel', 1), max: 1, recharge: 'long',
            display: '1 hr: fly 60ft, fear aura 30ft (WIS save or frightened for 1 min)',
          })
        }
        if (cc.subclassSlug === 'conquest' && lvl >= 20) {
          resources.push({
            key: 'invincible-conqueror', name: 'Invincible Conqueror', classSlug: slug,
            current: get('invincible-conqueror', 1), max: 1, recharge: 'long',
            display: '1 min: extra attack, crit on 19-20, resistance to all damage',
          })
        }
        if (cc.subclassSlug === 'glory' && lvl >= 15) {
          resources.push({
            key: 'glorious-defense', name: 'Glorious Defense', classSlug: slug,
            current: get('glorious-defense', paladinCha), max: paladinCha, recharge: 'long',
            display: `Reaction: +${paladinCha} to AC vs attack; if attack misses, counter-attack`,
          })
        }
        if (cc.subclassSlug === 'glory' && lvl >= 20) {
          resources.push({
            key: 'living-legend', name: 'Living Legend', classSlug: slug,
            current: get('living-legend', 1), max: 1, recharge: 'long',
            display: '1 min: adv on CHA checks, attacks auto-hit once/turn, allies add CHA to saves',
          })
        }
        if (cc.subclassSlug === 'watchers' && lvl >= 20) {
          resources.push({
            key: 'mortal-bulwark', name: 'Mortal Bulwark', classSlug: slug,
            current: get('mortal-bulwark', 1), max: 1, recharge: 'long',
            display: '1 min: adv vs aberrations/celestials/elementals/fey/fiends, adv vs magic, banish as bonus action',
          })
        }
        if (cc.subclassSlug === 'oathbreaker' && lvl >= 20) {
          resources.push({
            key: 'dread-lord', name: 'Dread Lord', classSlug: slug,
            current: get('dread-lord', 1), max: 1, recharge: 'long',
            display: '1 min: fear aura 30ft, shadows deal 3d8+CHA necrotic/turn, undead deal max damage',
          })
        }
        break
      }
      case 'ranger': {
        if (lvl >= 3) {
          resources.push({
            key: 'primeval-awareness', name: 'Primeval Awareness', classSlug: slug,
            current: 0, max: null, recharge: 'long',
            display: 'Spend spell slot · 1 min/slot level · sense creature types ≤1 mi',
          })
        }
        if (lvl >= 14) {
          resources.push({
            key: 'vanish', name: 'Vanish', classSlug: slug,
            current: get('vanish', 1), max: 1, recharge: 'short',
            display: 'Hide as bonus action (unlimited once unlocked)',
          })
        }
        // ── Subclass resources ──
        if (cc.subclassSlug === 'horizon-walker' && lvl >= 7) {
          resources.push({
            key: 'ethereal-step', name: 'Ethereal Step', classSlug: slug,
            current: get('ethereal-step', 1), max: 1, recharge: 'long',
            display: 'Bonus action: cast Etherealness lasting until end of your turn',
          })
        }
        if (cc.subclassSlug === 'monster-slayer' && lvl >= 3) {
          resources.push({
            key: 'hunters-sense', name: "Hunter's Sense", classSlug: slug,
            current: get('hunters-sense', pb), max: pb, recharge: 'short',
            display: 'Bonus action: learn target immunities/resistances/vulnerabilities',
          })
        }
        if (cc.subclassSlug === 'monster-slayer' && lvl >= 11) {
          resources.push({
            key: 'magic-users-nemesis', name: "Magic-User's Nemesis", classSlug: slug,
            current: get('magic-users-nemesis', 1), max: 1, recharge: 'short',
            display: 'Reaction: counter spellcast or teleportation within 60ft (WIS save)',
          })
        }
        if (cc.subclassSlug === 'swarmkeeper' && lvl >= 15) {
          resources.push({
            key: 'swarming-dispersal', name: 'Swarming Dispersal', classSlug: slug,
            current: get('swarming-dispersal', 2), max: 2, recharge: 'long',
            display: 'Reaction: teleport 30ft when you take damage reducing you to half HP or less',
          })
        }
        if (cc.subclassSlug === 'fey-wanderer' && lvl >= 7) {
          resources.push({
            key: 'fey-reinforcements', name: 'Fey Reinforcements', classSlug: slug,
            current: get('fey-reinforcements', 1), max: 1, recharge: 'long',
            display: 'Cast Summon Fey (no slot, concentration)',
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
        if (cc.subclassSlug === 'phantom' && lvl >= 3) {
          const wisMod = Math.max(1, abilityModFor(char, 'wis'))
          resources.push({
            key: 'wails-from-grave', name: 'Wails from the Grave', classSlug: slug,
            current: get('wails-from-grave', wisMod), max: wisMod, recharge: 'long',
            display: 'After SA: deal half SA dice necrotic to second creature 30ft',
          })
        }
        if (cc.subclassSlug === 'phantom' && lvl >= 9) {
          resources.push({
            key: 'soul-trinkets', name: 'Soul Trinkets', classSlug: slug,
            current: get('soul-trinkets', 0), max: pb, recharge: 'long',
            display: 'Reaction: harvest trinket from dying creature (adv on death saves)',
          })
        }
        if (cc.subclassSlug === 'phantom' && lvl >= 13) {
          resources.push({
            key: 'ghost-walk', name: 'Ghost Walk', classSlug: slug,
            current: get('ghost-walk', 1), max: 1, recharge: 'long',
            display: 'Bonus action: pass through creatures/objects, fly 10ft, resist B/P/S (10 min)',
          })
        }
        if (cc.subclassSlug === 'soulknife') {
          const die = lvl >= 17 ? 'd12' : lvl >= 11 ? 'd10' : lvl >= 5 ? 'd8' : 'd6'
          resources.push({
            key: 'soulknife-energy', name: 'Psionic Energy Dice', classSlug: slug,
            current: get('soulknife-energy', 2 * pb), max: 2 * pb, recharge: 'long',
            display: `${die} · regain 1 on init/short rest`,
          })
        }
        if (cc.subclassSlug === 'swashbuckler' && lvl >= 17) {
          resources.push({
            key: 'master-duelist', name: 'Master Duelist', classSlug: slug,
            current: get('master-duelist', 1), max: 1, recharge: 'short',
            display: 'When you miss with an attack: reroll with advantage',
          })
        }
        if (cc.subclassSlug === 'inquisitive' && lvl >= 13) {
          const rogueWisMod = Math.max(1, abilityModFor(char, 'wis'))
          resources.push({
            key: 'unerring-eye', name: 'Unerring Eye', classSlug: slug,
            current: get('unerring-eye', rogueWisMod), max: rogueWisMod, recharge: 'long',
            display: 'Bonus action: detect illusions, disguises, and shapechangers within 30ft',
          })
        }
        if (cc.subclassSlug === 'arcane-trickster' && lvl >= 17) {
          resources.push({
            key: 'spell-thief', name: 'Spell Thief', classSlug: slug,
            current: get('spell-thief', 1), max: 1, recharge: 'long',
            display: 'Reaction: negate spell targeting only you and steal it for 8 hrs',
          })
        }
        break
      }
      case 'sorcerer': {
        if (cc.subclassSlug === 'wild-magic') {
          resources.push({
            key: 'tides-of-chaos', name: 'Tides of Chaos', classSlug: slug,
            current: get('tides-of-chaos', 1), max: 1, recharge: 'long',
            display: 'adv on any roll · DM may trigger surge',
          })
        }
        if (lvl >= 2) {
          resources.push({
            key: 'sorcery-points', name: 'Sorcery Points', classSlug: slug,
            current: get('sorcery-points', lvl),
            max: lvl, recharge: 'long',
            display: 'Flexible Casting / Metamagic',
          })
        }
        if (cc.subclassSlug === 'shadow') {
          resources.push({
            key: 'strength-of-the-grave', name: 'Strength of the Grave', classSlug: slug,
            current: get('strength-of-the-grave', 1), max: 1, recharge: 'long',
            display: 'When reduced to 0 HP: CHA save (DC 5+dmg) to drop to 1 HP instead',
          })
        }
        if (cc.subclassSlug === 'divine-soul') {
          resources.push({
            key: 'favored-by-the-gods', name: 'Favored by the Gods', classSlug: slug,
            current: get('favored-by-the-gods', 1), max: 1, recharge: 'short',
            display: 'Add 2d4 to a failed saving throw or missed attack roll',
          })
        }
        if (cc.subclassSlug === 'divine-soul' && lvl >= 18) {
          resources.push({
            key: 'unearthly-recovery', name: 'Unearthly Recovery', classSlug: slug,
            current: get('unearthly-recovery', 1), max: 1, recharge: 'long',
            display: 'Bonus action: regain half your max HP (when below half HP)',
          })
        }
        if (cc.subclassSlug === 'storm' && lvl >= 14) {
          resources.push({
            key: 'wind-soul', name: 'Wind Soul', classSlug: slug,
            current: get('wind-soul', 1), max: 1, recharge: 'long',
            display: 'Grant fly 30ft to CHA mod creatures within 30ft for 10 min',
          })
        }
        if (cc.subclassSlug === 'aberrant-mind' && lvl >= 18) {
          resources.push({
            key: 'warping-implosion', name: 'Warping Implosion', classSlug: slug,
            current: get('warping-implosion', 1), max: 1, recharge: 'long',
            display: 'Teleport 120ft; old location deals 3d10 force and pulls creatures toward it',
          })
        }
        if (cc.subclassSlug === 'clockwork-soul') {
          resources.push({
            key: 'restore-balance', name: 'Restore Balance', classSlug: slug,
            current: get('restore-balance', pb), max: pb, recharge: 'long',
            display: 'Reaction: negate advantage or disadvantage on a d20 roll within 60ft',
          })
        }
        if (cc.subclassSlug === 'clockwork-soul' && lvl >= 14) {
          resources.push({
            key: 'trance-of-order', name: 'Trance of Order', classSlug: slug,
            current: get('trance-of-order', 1), max: 1, recharge: 'long',
            display: '1 min: adv on saves, attacks treat d20 as 10 minimum, no disadvantage',
          })
        }
        if (cc.subclassSlug === 'clockwork-soul' && lvl >= 18) {
          resources.push({
            key: 'clockwork-cavalcade', name: 'Clockwork Cavalcade', classSlug: slug,
            current: get('clockwork-cavalcade', 1), max: 1, recharge: 'long',
            display: 'Summon order spirits: restore 4th-level slots, 100 HP total, repair objects',
          })
        }
        break
      }
      case 'warlock': {
        // Limited-use invocations (those with a 1/rest free cast)
        const invFC = cc.level >= 1 ? char.featuresChosen.find(f => f.key === 'invocations') : undefined
        if (invFC) {
          const invSlugs: string[] = Array.isArray(invFC.value) ? invFC.value : [invFC.value]
          for (const invSlug of invSlugs) {
            const inv = ELDRITCH_INVOCATIONS.find(i => i.slug === invSlug)
            if (inv?.limitedUse) {
              const key = `inv-${invSlug}`
              resources.push({
                key, name: inv.name, classSlug: slug,
                current: get(key, 1), max: 1, recharge: inv.limitedUse.recharge,
                display: 'free cast 1/' + inv.limitedUse.recharge.replace('long', 'LR').replace('short', 'SR'),
              })
            }
          }
        }
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
        // ── Subclass resources ──
        if (cc.subclassSlug === 'archfey') {
          resources.push({
            key: 'fey-presence', name: 'Fey Presence', classSlug: slug,
            current: get('fey-presence', 1), max: 1, recharge: 'short',
            display: 'Action: charm or frighten all in 10ft cube until end of next turn (WIS save)',
          })
        }
        if (cc.subclassSlug === 'archfey' && lvl >= 6) {
          resources.push({
            key: 'misty-escape', name: 'Misty Escape', classSlug: slug,
            current: get('misty-escape', 1), max: 1, recharge: 'short',
            display: 'Reaction when hit: cast Misty Step, then become invisible until end of next turn',
          })
        }
        if (cc.subclassSlug === 'archfey' && lvl >= 14) {
          resources.push({
            key: 'dark-delirium', name: 'Dark Delirium', classSlug: slug,
            current: get('dark-delirium', 1), max: 1, recharge: 'long',
            display: 'Action: charm or frighten one creature for 1 min (WIS save, breaks on damage)',
          })
        }
        if (cc.subclassSlug === 'celestial') {
          resources.push({
            key: 'healing-light', name: 'Healing Light', classSlug: slug,
            current: get('healing-light', 1 + lvl), max: 1 + lvl, recharge: 'long',
            display: `Bonus action: spend 1-5 d6s from ${1 + lvl}-die pool to heal target within 60ft`,
          })
        }
        if (cc.subclassSlug === 'celestial' && lvl >= 14) {
          resources.push({
            key: 'searing-vengeance', name: 'Searing Vengeance', classSlug: slug,
            current: get('searing-vengeance', 1), max: 1, recharge: 'long',
            display: 'When regaining consciousness: deal 2d8+CHA radiant in 30ft, blind creatures',
          })
        }
        if (cc.subclassSlug === 'hexblade') {
          resources.push({
            key: 'hexblades-curse', name: "Hexblade's Curse", classSlug: slug,
            current: get('hexblades-curse', 1), max: 1, recharge: 'short',
            display: `Bonus action: curse target · crit 19-20 · +${pb} damage · regain HP on kill`,
          })
        }
        if (cc.subclassSlug === 'hexblade' && lvl >= 6) {
          resources.push({
            key: 'accursed-specter', name: 'Accursed Specter', classSlug: slug,
            current: get('accursed-specter', 1), max: 1, recharge: 'long',
            display: 'When you kill a humanoid: raise it as a specter under your command',
          })
        }
        if (cc.subclassSlug === 'fiend' && lvl >= 6) {
          resources.push({
            key: 'dark-ones-own-luck', name: "Dark One's Own Luck", classSlug: slug,
            current: get('dark-ones-own-luck', 1), max: 1, recharge: 'short',
            display: 'Add 1d10 to an ability check or saving throw',
          })
        }
        if (cc.subclassSlug === 'fiend' && lvl >= 14) {
          resources.push({
            key: 'hurl-through-hell', name: 'Hurl Through Hell', classSlug: slug,
            current: get('hurl-through-hell', 1), max: 1, recharge: 'long',
            display: 'After hitting: banish target to hell until end of next turn (10d10 psychic on return)',
          })
        }
        if (cc.subclassSlug === 'great-old-one' && lvl >= 6) {
          resources.push({
            key: 'entropic-ward', name: 'Entropic Ward', classSlug: slug,
            current: get('entropic-ward', 1), max: 1, recharge: 'short',
            display: 'Reaction: impose disadvantage on attack vs you; advantage on next attack if it misses',
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
        if (cc.subclassSlug === 'artillerist' && lvl >= 3) {
          const cannonMax = lvl >= 15 ? 2 : 1
          resources.push({
            key: 'eldritch-cannon', name: 'Eldritch Cannon', classSlug: slug,
            current: get('eldritch-cannon', cannonMax), max: cannonMax, recharge: 'long',
            display: `Create ${cannonMax} cannon${cannonMax > 1 ? 's' : ''}: Flamethrower, Force Ballista, or Protector`,
          })
        }
        if (cc.subclassSlug === 'alchemist' && lvl >= 3) {
          const alchIntMod = Math.max(1, abilityModFor(char, 'int'))
          resources.push({
            key: 'experimental-elixir', name: 'Experimental Elixir', classSlug: slug,
            current: get('experimental-elixir', alchIntMod), max: alchIntMod, recharge: 'long',
            display: `Create ${alchIntMod} elixirs: Healing/Swiftness/Resilience/Boldness/Flight/Transformation`,
          })
        }
        if (cc.subclassSlug === 'alchemist' && lvl >= 9) {
          const alchIntMod9 = Math.max(1, abilityModFor(char, 'int'))
          resources.push({
            key: 'restorative-reagents', name: 'Restorative Reagents', classSlug: slug,
            current: get('restorative-reagents', alchIntMod9), max: alchIntMod9, recharge: 'long',
            display: 'Cast Greater Restoration (no slot, uses alchemist supplies + 300 gp)',
          })
        }
        if (cc.subclassSlug === 'alchemist' && lvl >= 15) {
          resources.push({
            key: 'chemical-mastery', name: 'Chemical Mastery', classSlug: slug,
            current: get('chemical-mastery', 1), max: 1, recharge: 'long',
            display: 'Cast Heal or Greater Restoration (no slot, uses alchemist supplies)',
          })
        }
        if (cc.subclassSlug === 'armorer' && lvl >= 15) {
          resources.push({
            key: 'perfected-armor', name: 'Perfected Armor (Guardian)', classSlug: slug,
            current: get('perfected-armor', pb), max: pb, recharge: 'long',
            display: 'Reaction: force attacker within 30ft to redirect attack to you',
          })
        }
        break
      }
      case 'wizard': {
        const recoveryLevels = Math.ceil(lvl / 2)
        resources.push({
          key: 'arcane-recovery', name: 'Arcane Recovery', classSlug: slug,
          current: get('arcane-recovery', 1), max: 1, recharge: 'long',
          display: `Use on SR · recover ≤${recoveryLevels} slot levels (no 6th+)`,
        })
        if (lvl >= 20) {
          resources.push({
            key: 'signature-spells', name: 'Signature Spells', classSlug: slug,
            current: get('signature-spells', 2), max: 2, recharge: 'long',
            display: 'Cast 2 chosen L3 spells free (no slot)',
          })
        }
        // ── Subclass resources ──
        if (cc.subclassSlug === 'divination' && lvl >= 2) {
          const portentMax = lvl >= 14 ? 3 : 2
          resources.push({
            key: 'portent', name: 'Portent', classSlug: slug,
            current: get('portent', portentMax), max: portentMax, recharge: 'long',
            display: `Roll ${portentMax}d20 after LR; replace any creature's roll with one of these`,
          })
        }
        if (cc.subclassSlug === 'divination' && lvl >= 10) {
          resources.push({
            key: 'third-eye', name: 'Third Eye', classSlug: slug,
            current: get('third-eye', 1), max: 1, recharge: 'short',
            display: 'Choose: darkvision 60ft, see Ethereal Plane, read all scripts, or Detect Thoughts',
          })
        }
        if (cc.subclassSlug === 'conjuration' && lvl >= 6) {
          resources.push({
            key: 'benign-transposition', name: 'Benign Transposition', classSlug: slug,
            current: get('benign-transposition', 1), max: 1, recharge: 'long',
            display: 'Teleport 30ft or swap with willing Small/Medium creature (recharges on conjuration cast)',
          })
        }
        if (cc.subclassSlug === 'enchantment' && lvl >= 6) {
          resources.push({
            key: 'instinctive-charm', name: 'Instinctive Charm', classSlug: slug,
            current: get('instinctive-charm', 1), max: 1, recharge: 'short',
            display: 'Reaction: redirect attacker to nearest other creature within 30ft (WIS save)',
          })
        }
        if (cc.subclassSlug === 'evocation' && lvl >= 14) {
          resources.push({
            key: 'overchannel', name: 'Overchannel', classSlug: slug,
            current: get('overchannel', 1), max: 1, recharge: 'long',
            display: 'Maximize L1-L5 spell damage (2nd+ use per LR deals necrotic to you)',
          })
        }
        if (cc.subclassSlug === 'illusion' && lvl >= 10) {
          resources.push({
            key: 'illusory-self', name: 'Illusory Self', classSlug: slug,
            current: get('illusory-self', 1), max: 1, recharge: 'short',
            display: 'Reaction: create duplicate that intercepts an attack targeting you',
          })
        }
        if (cc.subclassSlug === 'war-magic' && lvl >= 6) {
          const warIntMod = Math.max(1, abilityModFor(char, 'int'))
          resources.push({
            key: 'power-surge', name: 'Power Surge', classSlug: slug,
            current: get('power-surge', 1), max: warIntMod, recharge: 'long',
            display: `Spend 1 surge: add ${pb}d6 force damage to a spell · +1 surge per dispel/counterspell`,
          })
        }
        if (cc.subclassSlug === 'chronurgy' && lvl >= 2) {
          resources.push({
            key: 'chronal-shift', name: 'Chronal Shift', classSlug: slug,
            current: get('chronal-shift', 2), max: 2, recharge: 'long',
            display: 'Reaction: force a creature to reroll a d20 (before or after outcome)',
          })
        }
        if (cc.subclassSlug === 'chronurgy' && lvl >= 6) {
          const chronIntMod = Math.max(1, abilityModFor(char, 'int'))
          resources.push({
            key: 'momentary-stasis', name: 'Momentary Stasis', classSlug: slug,
            current: get('momentary-stasis', chronIntMod), max: chronIntMod, recharge: 'long',
            display: 'Action: incapacitate Huge or smaller creature (CON save)',
          })
        }
        if (cc.subclassSlug === 'chronurgy' && lvl >= 10) {
          resources.push({
            key: 'arcane-abeyance', name: 'Arcane Abeyance', classSlug: slug,
            current: get('arcane-abeyance', 1), max: 1, recharge: 'long',
            display: 'Store L4 or lower spell in a glowing bead (lasts 1 hr, ally can cast it)',
          })
        }
        if (cc.subclassSlug === 'chronurgy' && lvl >= 14) {
          const convIntMod = Math.max(1, abilityModFor(char, 'int'))
          resources.push({
            key: 'convergent-future', name: 'Convergent Future', classSlug: slug,
            current: get('convergent-future', convIntMod), max: convIntMod, recharge: 'long',
            display: 'Declare outcome of d20 roll (success or fail) — gain 1 exhaustion per use',
          })
        }
        if (cc.subclassSlug === 'graviturgy' && lvl >= 10) {
          const gravIntMod = Math.max(1, abilityModFor(char, 'int'))
          resources.push({
            key: 'violent-attraction', name: 'Violent Attraction', classSlug: slug,
            current: get('violent-attraction', gravIntMod), max: gravIntMod, recharge: 'long',
            display: 'Reaction: +1d10 to a weapon damage roll, or +2d6 to fall damage',
          })
        }
        if (cc.subclassSlug === 'graviturgy' && lvl >= 14) {
          resources.push({
            key: 'event-horizon', name: 'Event Horizon', classSlug: slug,
            current: get('event-horizon', 1), max: 1, recharge: 'long',
            display: '1 min: creatures starting turn within 30ft STR save or take 2d6 force and speed 0',
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
