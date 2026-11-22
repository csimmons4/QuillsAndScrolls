// The level-up rules sweep (`levelrules-*.sweep.tsx`): a level 1 character of each class (and the
// subclasses with their own choices) is taken to level 20 through the Level Up page, making every
// choice it asks for, and after each level the saved character is checked against the PHB tables.
import { vi } from 'vitest'
import { appendFileSync } from 'node:fs'
import { screen, fireEvent, act, cleanup } from '@testing-library/react'
import { fakeServer, renderApp } from '../app'
import type { Character } from '../../character/model'
import { makeChar, content } from '../fixtures'
import { CLASS_OPTIONS } from '../../data/classData'
import { restingVitals } from '../../character/vitals'
import { abilityMod } from '../../character/derive'
import { problemLog, checkText, pause, expectNoProblems } from './helpers'

// ── PHB (and TCoE for the artificer) tables, typed in from the books, not read from the app ──────

const FULL = [[2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2],
  [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1, 1], [4, 3, 3, 3, 3, 1, 1, 1, 1], [4, 3, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 3, 2, 2, 1, 1]]
const HALF = [[], [2], [3], [3], [4, 2], [4, 2], [4, 3], [4, 3], [4, 3, 2], [4, 3, 2], [4, 3, 3], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 1],
  [4, 3, 3, 2], [4, 3, 3, 2], [4, 3, 3, 3, 1], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2], [4, 3, 3, 3, 2]]
const ARTIFICER = [[2], ...HALF.slice(1)]
const THIRD = [[], [], [2], [3], [3], [3], [4, 2], [4, 2], [4, 2], [4, 3], [4, 3], [4, 3], [4, 3, 2], [4, 3, 2], [4, 3, 2], [4, 3, 3],
  [4, 3, 3], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 1]]
const PACT: [number, number][] = [[1, 1], [1, 2], [2, 2], [2, 2], [3, 2], [3, 2], [4, 2], [4, 2], [5, 2], [5, 2],
  [5, 3], [5, 3], [5, 3], [5, 3], [5, 3], [5, 3], [5, 4], [5, 4], [5, 4], [5, 4]]

/** Cantrips known: [at first, then +1 at each of these levels] */
const CANTRIPS: Record<string, [number, number[]]> = {
  bard: [2, [4, 10]], cleric: [3, [4, 10]], druid: [2, [4, 10]], sorcerer: [4, [4, 10]], warlock: [2, [4, 10]],
  wizard: [3, [4, 10]], artificer: [2, [10, 14]], 'eldritch-knight': [2, [10]], 'arcane-trickster': [3, [10]],
}
const SPELLS_KNOWN: Record<string, number[]> = {
  bard: [4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 15, 16, 18, 19, 19, 20, 22, 22, 22],
  sorcerer: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 12, 13, 13, 14, 14, 15, 15, 15, 15],
  warlock: [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15],
  ranger: [0, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11],
  'eldritch-knight': [0, 0, 3, 4, 4, 4, 5, 6, 6, 7, 8, 8, 9, 10, 10, 11, 11, 11, 12, 13],
  'arcane-trickster': [0, 0, 3, 4, 4, 4, 5, 6, 6, 7, 8, 8, 9, 10, 10, 11, 11, 11, 12, 13],
}
const ASI: Record<string, number[]> = { fighter: [4, 6, 8, 12, 14, 16, 19], rogue: [4, 8, 10, 12, 16, 19] }
const asiLevels = (cls: string) => ASI[cls] ?? [4, 8, 12, 16, 19]
/** A running total that steps up at the given levels: steps([[3, 2], [10, 3]], 5) = 2 */
const steps = (table: [number, number][], level: number) => table.filter(([l]) => l <= level).at(-1)?.[1] ?? 0

/** The class/subclass runs, spread over the shards. Subclasses with choices of their own are included. */
export const RUNS: { cls: string; sub: string }[] = [
  { cls: 'artificer', sub: 'artillerist' }, { cls: 'barbarian', sub: 'totem-warrior' }, { cls: 'barbarian', sub: 'storm-herald' },
  { cls: 'bard', sub: 'lore' }, { cls: 'bard', sub: 'valor' }, { cls: 'cleric', sub: 'life' }, { cls: 'druid', sub: 'land' },
  { cls: 'druid', sub: 'moon' }, { cls: 'fighter', sub: 'battle-master' }, { cls: 'fighter', sub: 'champion' },
  { cls: 'fighter', sub: 'eldritch-knight' }, { cls: 'fighter', sub: 'rune-knight' }, { cls: 'monk', sub: 'four-elements' },
  { cls: 'monk', sub: 'open-hand' }, { cls: 'paladin', sub: 'devotion' }, { cls: 'ranger', sub: 'hunter' },
  { cls: 'rogue', sub: 'arcane-trickster' }, { cls: 'rogue', sub: 'thief' }, { cls: 'sorcerer', sub: 'draconic' },
  { cls: 'warlock', sub: 'fiend' }, { cls: 'wizard', sub: 'evocation' },
]

const SKILLS6 = ['athletics', 'acrobatics', 'stealth', 'perception', 'insight', 'arcana']

/** A level 1 character as the Creator makes it: its cantrips, spells, slots and level 1 choices */
function levelOne(cls: string, sub: string): Character {
  const c = content()
  const subLevel = CLASS_OPTIONS[cls].subclasses.find(s => s.slug === sub)!.level
  const pick = (level: number, n: number) => c.spells.filter(s => s.level === level && (s.classLists ?? []).includes(cls)).slice(0, n)
    .map(s => ({ spellSlug: s.slug, name: s.name, classSlug: cls, prepared: true, isHomebrew: false }))
  const cantrips = CANTRIPS[cls]?.[0] ?? 0
  const known = cls === 'wizard' ? 6 : SPELLS_KNOWN[cls]?.[0] ?? 0
  const featuresChosen: Character['featuresChosen'] = []
  if (cls === 'fighter') featuresChosen.push({ key: 'fighting-style', value: 'defense' })
  if (cls === 'ranger') featuresChosen.push({ key: 'favored-enemy-1', value: 'Beasts' }, { key: 'favored-terrain-1', value: 'Forest' })
  const hitDie = c.classes.find(k => k.slug === cls)?.hitDie ?? 8
  return makeChar([{ classSlug: cls, subclassSlug: subLevel === 1 ? sub : undefined, level: 1, hitDieRolls: [hitDie] }],
    { str: 14, dex: 14, con: 14, int: 14, wis: 14, cha: 14 },
    {
      name: `QA Rules ${cls} ${sub}`, hp: { current: 10, temp: 0 },
      spells: [...pick(0, cantrips), ...pick(1, known)],
      spellSlots: ['bard', 'cleric', 'druid', 'sorcerer', 'wizard', 'artificer'].includes(cls) ? { '1': { max: 2, used: 0 } } : {},
      ...(cls === 'warlock' ? { pactSlots: { level: 1, max: 1, used: 0 } } : {}),
      skillProficiencies: SKILLS6 as Character['skillProficiencies'],
      skillExpertise: (cls === 'rogue' ? ['stealth', 'perception'] : []) as Character['skillExpertise'],
      featuresChosen,
    })
}

/** What the PHB says the character should have at `level`; returns the differences */
function compare(char: Character, cls: string, sub: string, level: number): string[] {
  const out: string[] = []
  const want = (what: string, got: unknown, expected: unknown) => {
    if (JSON.stringify(got) !== JSON.stringify(expected)) out.push(`${what}: has ${JSON.stringify(got)}, PHB ${JSON.stringify(expected)}`)
  }
  const cc = char.classes[0]
  want('level', cc.level, level)
  want('hit dice recorded', cc.hitDieRolls.length, level)
  const subLevel = CLASS_OPTIONS[cls].subclasses.find(s => s.slug === sub)!.level
  if (level >= subLevel) want('subclass', cc.subclassSlug, sub)
  // Hit points: the full die at 1st level, the average after, CON every level (PHB p.15), and
  // Draconic Resilience's 1 per sorcerer level
  const die = content().classes.find(k => k.slug === cls)?.hitDie ?? 8
  want('max HP', restingVitals(char, content()).maxHp,
    die + (level - 1) * (die / 2 + 1) + level * abilityMod(char.abilityScores.con) + (sub === 'draconic' ? level : 0))

  // Spell slots
  const caster = ['bard', 'cleric', 'druid', 'sorcerer', 'wizard'].includes(cls) ? FULL
    : ['paladin', 'ranger'].includes(cls) ? HALF : cls === 'artificer' ? ARTIFICER
    : sub === 'eldritch-knight' || sub === 'arcane-trickster' ? THIRD : null
  const slots = Object.entries(char.spellSlots).filter(([, v]) => v.max > 0).sort(([a], [b]) => +a - +b).map(([, v]) => v.max)
  want('spell slots', slots, caster ? caster[level - 1] : [])
  if (cls === 'warlock') want('pact slots (level, count)', [char.pactSlots?.level, char.pactSlots?.max], PACT[level - 1])

  // Cantrips and spells the class itself taught
  const own = char.spells.filter(s => s.classSlug === cls && !s.grantedBy && !s.freeUseKey)
  const lvlOf = (slug: string) => content().spells.find(d => d.slug === slug)?.level ?? 0
  const caster3 = sub === 'eldritch-knight' || sub === 'arcane-trickster' ? sub : cls
  const ct = CANTRIPS[caster3]
  if (ct) {
    const start = caster3 === sub ? 3 : 1
    want('cantrips known', own.filter(s => lvlOf(s.spellSlug) === 0).length, level < start ? 0 : ct[0] + ct[1].filter(l => l <= level).length)
  }
  const knownTable = SPELLS_KNOWN[caster3]
  if (knownTable) {
    const loreExtra = sub === 'lore' && level >= 6 ? 2 : 0
    want('spells known', own.filter(s => lvlOf(s.spellSlug) > 0).length, knownTable[level - 1] + loreExtra)
  }
  if (cls === 'wizard') want('spellbook', own.filter(s => lvlOf(s.spellSlug) > 0).length, 6 + 2 * (level - 1))

  // Choices kept in featuresChosen
  const chosen = (key: string) => {
    const v = char.featuresChosen.find(f => f.key === key)?.value
    return v === undefined ? 0 : Array.isArray(v) ? v.length : 1
  }
  if (cls === 'warlock') {
    want('invocations', chosen('invocations'), [0, 2, 2, 2, 3, 3, 4, 4, 5, 5, 5, 6, 6, 6, 7, 7, 7, 8, 8, 8][level - 1])
    want('pact boon', chosen('pact-boon'), level >= 3 ? 1 : 0)
    want('mystic arcanum', char.spells.filter(s => s.freeUseKey?.startsWith('mystic-arcanum')).length, [11, 13, 15, 17].filter(l => l <= level).length)
  }
  if (cls === 'sorcerer') want('metamagic', chosen('metamagic'), steps([[3, 2], [10, 3], [17, 4]], level))
  if (cls === 'artificer') want('infusions known', chosen('infusions'), steps([[2, 4], [6, 6], [10, 8], [14, 10], [18, 12]], level))
  if (sub === 'battle-master') want('maneuvers', chosen('maneuvers'), steps([[3, 3], [7, 5], [10, 7], [15, 9]], level))
  if (sub === 'rune-knight') want('runes', chosen('runes'), steps([[3, 2], [7, 3], [10, 4], [15, 5]], level))
  if (sub === 'four-elements') want('elemental disciplines', chosen('four-elements'), steps([[3, 1], [6, 2], [11, 3], [17, 4]], level))
  if (sub === 'totem-warrior') {
    want('totem spirit', chosen('totem-spirit'), level >= 3 ? 1 : 0)
    want('aspect of the beast', chosen('totem-aspect'), level >= 6 ? 1 : 0)
    want('totemic attunement', chosen('totem-attunement'), level >= 14 ? 1 : 0)
  }
  if (sub === 'storm-herald') want('storm aura', chosen('storm-aura'), level >= 3 ? 1 : 0)
  if (sub === 'land') want('circle terrain', chosen('land-terrain'), level >= 2 ? 1 : 0)
  if (sub === 'hunter') for (const l of [3, 7, 11, 15]) want(`hunter choice at ${l}`, chosen(`hunter-${l}`), level >= l ? 1 : 0)
  if (cls === 'ranger') {
    want('favored enemies', char.featuresChosen.filter(f => f.key.startsWith('favored-enemy-')).length, steps([[1, 1], [6, 2], [14, 3]], level))
    want('favored terrains', char.featuresChosen.filter(f => f.key.startsWith('favored-terrain-')).length, steps([[1, 1], [6, 2], [10, 3]], level))
  }
  const styles = char.featuresChosen.filter(f => f.key.startsWith('fighting-style')).length
  if (cls === 'fighter') want('fighting styles', styles, sub === 'champion' && level >= 10 ? 2 : 1)
  if (cls === 'paladin' || cls === 'ranger') want('fighting styles', styles, level >= 2 ? 1 : 0)
  if (cls === 'rogue') want('expertise', char.skillExpertise.length, level >= 6 ? 4 : 2)
  if (cls === 'bard') want('expertise', char.skillExpertise.length, steps([[3, 2], [10, 4]], level))
  return out
}

const cardsNow = () => [...document.querySelectorAll<HTMLElement>('.card')].filter(c => c.querySelector(':scope > h2.section-header'))
const heading = (card: HTMLElement) => card.querySelector(':scope > h2.section-header')!.textContent!.trim()
const counter = (card: HTMLElement) => {
  const m = card.textContent!.match(/\((\d+)\/(\d+) (?:chosen|selected)\)/)
  return m ? { have: +m[1], need: +m[2] } : null
}
const click = (el: Element) => act(async () => { fireEvent.click(el); await new Promise(r => setTimeout(r, 5)) })

/** "Choose N" sections: click options until the count is reached; an option that doesn't count
 *  (a spell to forget, a filter) is clicked again to undo it */
async function pickMany(card: HTMLElement) {
  const tried = new Set<Element>()
  for (let guard = 0; guard < 80; guard++) {
    const c = counter(card)
    if (!c || c.have >= c.need) return true
    const next = [...card.querySelectorAll('input[type=checkbox]:not(:checked):not(:disabled), button:not(:disabled)')].find(el => !tried.has(el))
    if (!next) return false
    tried.add(next)
    await click(next)
    if ((counter(card)?.have ?? 0) <= c.have) await click(next)
  }
  return false
}

/** One-of sections (fighting style, pact boon, favored enemy, totem…): the first option */
async function pickOne(card: HTMLElement) {
  const select = card.querySelector<HTMLSelectElement>('select')
  if (select && !select.value) {
    const first = [...select.options].find(o => o.value)
    if (first) await act(async () => { fireEvent.change(select, { target: { value: first.value } }) })
    return
  }
  const radios = [...card.querySelectorAll<HTMLInputElement>('input[type=radio]')]
  if (radios.length && !radios.some(r => r.checked)) await click(radios[0])
}

const SKIP = /^(Class|Hit Points|New Class Features|Ability Score Improvement|Spells$|Replace an Infusion)/

export async function levelRulesSweep(shard: number, shards: number) {
  const log = problemLog()
  for (const [n, { cls, sub }] of RUNS.entries()) {
    if (n % shards !== shard) continue
    let char = levelOne(cls, sub)
    const server = fakeServer([char])
    try {
      renderApp(`/c/${char.id}/level-up`)
      for (let level = 2; level <= 20; level++) {
        log.where = `${cls}/${sub} → ${level}`
        const apply = () => screen.findAllByRole('button', { name: /Apply Level Up|to choose/ }, { timeout: 10000 }).then(b => b[0])
        await apply()
        await pause(20)
        // Did the page offer an ASI at this level?
        const asiOffered = cardsNow().some(c => heading(c).startsWith('Ability Score Improvement'))
        if (asiOffered !== asiLevels(cls).includes(level)) log.problems.push(`${log.where} | ASI ${asiOffered ? 'offered' : 'missing'} (PHB: ${asiLevels(cls).join(', ')})`)
        const subCard = cardsNow().find(c => heading(c) === 'Choose Subclass')
        if (subCard) {
          const radio = subCard.querySelector<HTMLInputElement>(`input[type=radio][value="${sub}"]`)
          if (radio) await click(radio)
          else log.problems.push(`${log.where} | subclass ${sub} not offered`)
        }
        // Subclass choices appear once it's picked, so go round a few times
        for (let pass = 0; pass < 3; pass++) {
          for (const card of cardsNow()) {
            const h = heading(card)
            if (SKIP.test(h) || h === 'Choose Subclass') continue
            if (counter(card)) {
              if (!(await pickMany(card))) log.problems.push(`${log.where} | couldn't fill "${h}" (${card.textContent!.match(/\(\d+\/\d+ \w+\)/)?.[0]})`)
            } else await pickOne(card)
          }
        }
        checkText(log)
        const button = await apply()
        // QS_DEBUG=<file> writes each page's sections and the Apply button's state there
        if (process.env.QS_DEBUG) appendFileSync(process.env.QS_DEBUG, `${log.where}: ${cardsNow().map(heading).join(' | ')} || ${button.textContent} ${button.getAttribute('title')}\n`)
        if ((button as HTMLButtonElement).disabled) {
          log.problems.push(`${log.where} | still blocked: ${button.getAttribute('title')}`)
          break
        }
        await click(button)
        // Saved, and back on the sheet
        await act(async () => { await vi.waitFor(() => { if (server.characters.get(char.id)!.classes[0].level !== level) throw new Error('not saved') }, { timeout: 10000 }) })
        char = server.characters.get(char.id)!
        for (const d of compare(char, cls, sub, level)) log.problems.push(`${log.where} | ${d}`)
        const levelUp = await screen.findByRole('link', { name: 'Level Up' }, { timeout: 10000 })
        if (level < 20) await click(levelUp)
      }
    } catch (e) {
      log.problems.push(`${log.where} | CRASH: ${(e as Error).message.slice(0, 300)}`)
    }
    cleanup()
    vi.unstubAllGlobals()
  }
  expectNoProblems(log)
}
