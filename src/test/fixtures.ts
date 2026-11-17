// Test fixtures: the shipped reference data merged with the curated overlays (as the app does at
// startup, minus homebrew), and a quick way to build a character.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ContentData } from '../content/ContentProvider'
import { mergeSpells, mergeFeats, mergeItems, mergeRaces, mergeClasses, mergeBackgrounds } from '../content/merge'
import { SPELL_OVERLAY } from '../data/spellOverlay'
import { FEAT_OVERLAY } from '../data/featOverlay'
import { ITEM_OVERLAY } from '../data/itemOverlay'
import { RACE_OVERLAY } from '../data/raceOverlay'
import { BACKGROUND_OVERLAY } from '../data/backgroundOverlay'
import { newCharacter } from '../character/create'
import type { Character } from '../character/model'

const raw = (name: string): unknown[] => JSON.parse(readFileSync(join(__dirname, '../../public/data/wikidot', `${name}.json`), 'utf8'))

let cached: ContentData | null = null
export function content(): ContentData {
  cached ??= {
    spells: mergeSpells(raw('spells'), [], SPELL_OVERLAY),
    feats: mergeFeats(raw('feats'), [], FEAT_OVERLAY),
    items: mergeItems(raw('items'), [], ITEM_OVERLAY),
    races: mergeRaces(raw('races'), [], RACE_OVERLAY),
    classes: mergeClasses(raw('classes'), []),
    backgrounds: mergeBackgrounds(raw('backgrounds'), [], BACKGROUND_OVERLAY),
    meta: null, loading: false, error: null, reload: () => {},
  }
  return cached
}

type Scores = Partial<Character['abilityScores']>
/** A character of one class (or several), with average hit dice unless rolls are given */
export function makeChar(
  classes: Array<{ classSlug: string; level: number; subclassSlug?: string; hitDieRolls?: number[] }>,
  scores: Scores = {},
  extra: Partial<Character> = {},
): Character {
  return newCharacter({
    raceSlug: 'human',
    classes: classes.map(c => ({ classSlug: c.classSlug, subclassSlug: c.subclassSlug, level: c.level, hitDieRolls: c.hitDieRolls ?? [] })),
    abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10, ...scores },
    ...extra,
  })
}

/** An equipped item by slug (weapons and armor come from the overlay) */
export function equipped(slug: string, name = slug, extra: Partial<Character['equipment'][number]> = {}): Character['equipment'][number] {
  return { itemSlug: slug, name, quantity: 1, equipped: true, attuned: false, isHomebrew: false, notes: '', ...extra }
}
