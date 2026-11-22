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
import { missingProficiencies } from '../../routes/sheet/helpers'
import { MUSICAL_INSTRUMENTS } from '../../character/proficiencies'
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
  const first = radios.find(r => !r.disabled)
  if (first && !radios.some(r => r.checked)) await click(first)
}

const SKIP = /^(Class|Hit Points|New Class Features|Ability Score Improvement|Spells$|Replace an Infusion)/

/** Makes every choice on the open Level Up page (subclass `sub` if it asks), notes problems,
 *  and returns the Apply button, or null if it stays blocked */
async function fillLevelUp(log: ReturnType<typeof problemLog>, sub: string | undefined) {
  const apply = () => screen.findAllByRole('button', { name: /Apply Level Up|to choose/ }, { timeout: 10000 }).then(b => b[0])
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
  if (process.env.QS_DEBUG) appendFileSync(process.env.QS_DEBUG, `${log.where}: ${cardsNow().map(heading).join(' | ')} || ${button.textContent} ${button.getAttribute('title')}\n`)
  if ((button as HTMLButtonElement).disabled) {
    log.problems.push(`${log.where} | still blocked: ${button.getAttribute('title')}`)
    return null
  }
  return button
}

/** Clicks Apply, waits for the save and goes back to Level Up from the sheet */
async function applyAndReturn(button: HTMLElement, server: ReturnType<typeof fakeServer>, id: string, saved: (c: Character) => boolean, again: boolean) {
  await click(button)
  await act(async () => { await vi.waitFor(() => { if (!saved(server.characters.get(id)!)) throw new Error('not saved') }, { timeout: 10000 }) })
  const levelUp = await screen.findByRole('link', { name: 'Level Up' }, { timeout: 10000 })
  if (again) await click(levelUp)
  return server.characters.get(id)!
}

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
        await screen.findAllByRole('button', { name: /Apply Level Up|to choose/ }, { timeout: 10000 })
        await pause(20)
        // Did the page offer an ASI at this level?
        const asiOffered = cardsNow().some(c => heading(c).startsWith('Ability Score Improvement'))
        if (asiOffered !== asiLevels(cls).includes(level)) log.problems.push(`${log.where} | ASI ${asiOffered ? 'offered' : 'missing'} (PHB: ${asiLevels(cls).join(', ')})`)
        const button = await fillLevelUp(log, sub)
        if (!button) break
        char = await applyAndReturn(button, server, char.id, c => c.classes[0].level === level, level < 20)
        for (const d of compare(char, cls, sub, level)) log.problems.push(`${log.where} | ${d}`)
      }
    } catch (e) {
      log.problems.push(`${log.where} | CRASH: ${(e as Error).message.slice(0, 300)}`)
    }
    cleanup()
    vi.unstubAllGlobals()
  }
  expectNoProblems(log)
}

// ── Multiclassing (PHB pp.163–165, TCoE for the artificer) ──────────────────────────────────────

/** What multiclassing into a class grants (PHB p.164), names normalised by `norm` */
const MULTICLASS_GAINS: Record<string, { armor?: string[]; weapons?: string[]; tools?: string[]; skills?: number }> = {
  artificer: { armor: ['light', 'medium', 'shield'], tools: ["thieves' tool", "tinker's tool"] },
  barbarian: { armor: ['shield'], weapons: ['simple', 'martial'] },
  bard: { armor: ['light'], tools: ['<instrument>'], skills: 1 },
  cleric: { armor: ['light', 'medium', 'shield'] },
  druid: { armor: ['light', 'medium', 'shield'] },
  fighter: { armor: ['light', 'medium', 'shield'], weapons: ['simple', 'martial'] },
  monk: { weapons: ['simple', 'shortsword'] },
  paladin: { armor: ['light', 'medium', 'shield'], weapons: ['simple', 'martial'] },
  ranger: { armor: ['light', 'medium', 'shield'], weapons: ['simple', 'martial'], skills: 1 },
  rogue: { armor: ['light'], tools: ["thieves' tool"], skills: 1 },
  sorcerer: {}, warlock: { armor: ['light'], weapons: ['simple'] }, wizard: {},
}
const norm = (x: string) => x.toLowerCase().replace(/\s+(armor|weapons?)$/, '').replace(/s$/, '').trim()
const INSTRUMENTS = new Set(MUSICAL_INSTRUMENTS.map(norm))

/** Builds as [class, levels] segments in the order they're taken, and each class's subclass */
export const BUILDS: { name: string; plan: [string, number][]; subs: Record<string, string> }[] = [
  { name: 'sorcadin', plan: [['paladin', 2], ['sorcerer', 3], ['paladin', 4], ['sorcerer', 11]], subs: { paladin: 'devotion', sorcerer: 'draconic' } },
  { name: 'eldritch knight / wizard', plan: [['fighter', 3], ['wizard', 2], ['fighter', 4], ['wizard', 11]], subs: { fighter: 'eldritch-knight', wizard: 'evocation' } },
  { name: 'sorlock', plan: [['warlock', 2], ['sorcerer', 3], ['warlock', 1], ['sorcerer', 14]], subs: { warlock: 'hexblade', sorcerer: 'wild-magic' } },
  { name: 'rogue / ranger', plan: [['rogue', 3], ['ranger', 5], ['rogue', 12]], subs: { rogue: 'thief', ranger: 'hunter' } },
  { name: 'cleric / druid', plan: [['cleric', 5], ['druid', 5], ['cleric', 10]], subs: { cleric: 'life', druid: 'moon' } },
  { name: 'artificer / wizard', plan: [['artificer', 3], ['wizard', 3], ['artificer', 3], ['wizard', 11]], subs: { artificer: 'artillerist', wizard: 'abjuration' } },
  { name: 'wizard / artificer', plan: [['wizard', 2], ['artificer', 3], ['wizard', 4], ['artificer', 11]], subs: { wizard: 'divination', artificer: 'alchemist' } },
  { name: 'monk / barbarian', plan: [['monk', 5], ['barbarian', 3], ['monk', 12]], subs: { monk: 'shadow', barbarian: 'totem-warrior' } },
  { name: 'barbarian / fighter', plan: [['barbarian', 5], ['fighter', 4], ['barbarian', 11]], subs: { barbarian: 'berserker', fighter: 'champion' } },
  { name: 'monk / rogue', plan: [['monk', 6], ['rogue', 3], ['monk', 11]], subs: { monk: 'open-hand', rogue: 'arcane-trickster' } },
  { name: 'warlock / bard', plan: [['warlock', 3], ['bard', 6], ['warlock', 2], ['bard', 9]], subs: { warlock: 'fiend', bard: 'lore' } },
]

const FULL_CASTERS = ['bard', 'cleric', 'druid', 'sorcerer', 'wizard']
/** PHB p.164: a class counts for multiclass slots once it has the Spellcasting feature */
function casterShare(cls: string, sub: string | undefined, level: number): { own: number[][]; share: number } | null {
  if (FULL_CASTERS.includes(cls)) return { own: FULL, share: level }
  if ((cls === 'paladin' || cls === 'ranger') && level >= 2) return { own: HALF, share: Math.floor(level / 2) }
  if (cls === 'artificer') return { own: ARTIFICER, share: Math.ceil(level / 2) }
  if ((sub === 'eldritch-knight' || sub === 'arcane-trickster') && level >= 3) return { own: THIRD, share: Math.floor(level / 3) }
  return null
}

function compareMulticlass(char: Character, subs: Record<string, string>, taken: string[]): string[] {
  const out: string[] = []
  const want = (what: string, got: unknown, expected: unknown) => {
    if (JSON.stringify(got) !== JSON.stringify(expected)) out.push(`${what}: has ${JSON.stringify(got)}, PHB ${JSON.stringify(expected)}`)
  }
  const levels: Record<string, number> = {}
  for (const c of taken) levels[c] = (levels[c] ?? 0) + 1
  const dieOf = (cls: string) => content().classes.find(k => k.slug === cls)?.hitDie ?? 8
  for (const [cls, level] of Object.entries(levels)) {
    const cc = char.classes.find(c => c.classSlug === cls)
    want(`${cls} level`, cc?.level, level)
    if (level >= CLASS_OPTIONS[cls].subclasses.find(s => s.slug === subs[cls])!.level) want(`${cls} subclass`, cc?.subclassSlug, subs[cls])
  }
  // Max HP: the first class's full die, the average for every later level (in any class), CON each level
  const sorc = subs.sorcerer === 'draconic' ? levels.sorcerer ?? 0 : 0
  want('max HP', restingVitals(char, content()).maxHp,
    dieOf(taken[0]) + taken.slice(1).reduce((t, c) => t + dieOf(c) / 2 + 1, 0) + taken.length * abilityMod(char.abilityScores.con) + sorc)
  // Spell slots: one caster uses its own table; two or more add their shares on the multiclass table
  const casters = Object.entries(levels).map(([cls, level]) => casterShare(cls, subs[cls], level)).filter(Boolean) as { own: number[][]; share: number }[]
  const casterLevel = casters.reduce((t, c) => t + c.share, 0)
  const slotsWanted = casters.length >= 2 ? (casterLevel ? FULL[casterLevel - 1] : [])
    : casters.length === 1 ? casters[0].own[Object.entries(levels).find(([cls, l]) => casterShare(cls, subs[cls], l))![1] - 1] : []
  const slots = Object.entries(char.spellSlots).filter(([, v]) => v.max > 0).sort(([a], [b]) => +a - +b).map(([, v]) => v.max)
  want(`spell slots (caster level ${casterLevel})`, slots, slotsWanted)
  if (levels.warlock) want('pact slots (level, count)', [char.pactSlots?.level, char.pactSlots?.max], PACT[levels.warlock - 1])
  // Each class learns its spells by its own level
  const lvlOf = (slug: string) => content().spells.find(d => d.slug === slug)?.level ?? 0
  for (const [cls, level] of Object.entries(levels)) {
    const own = char.spells.filter(s => s.classSlug === cls && !s.grantedBy && !s.freeUseKey)
    const key = subs[cls] === 'eldritch-knight' || subs[cls] === 'arcane-trickster' ? subs[cls] : cls
    const ct = CANTRIPS[key]
    if (ct) {
      const start = key === cls ? 1 : 3
      want(`${cls} cantrips`, own.filter(s => lvlOf(s.spellSlug) === 0).length, level < start ? 0 : ct[0] + ct[1].filter(l => l <= level).length)
    }
    if (SPELLS_KNOWN[key]) want(`${cls} spells known`, own.filter(s => lvlOf(s.spellSlug) > 0).length, SPELLS_KNOWN[key][level - 1] + (subs[cls] === 'lore' && level >= 6 ? 2 : 0))
    if (cls === 'wizard') want('wizard spellbook', own.filter(s => lvlOf(s.spellSlug) > 0).length, 6 + 2 * (level - 1))
  }
  return out
}

export async function multiclassRulesSweep(shard: number, shards: number) {
  const log = problemLog()
  for (const [n, build] of BUILDS.entries()) {
    if (n % shards !== shard) continue
    const taken = build.plan.flatMap(([cls, count]) => Array<string>(count).fill(cls))
    const first = levelOne(taken[0], build.subs[taken[0]])
    // The proficiencies the Creator would have given, so the sheet has nothing to fill in
    let char: Character = { ...first, ...missingProficiencies(first, content()) }
    const startSaves = [...char.saveProficiencies].sort()
    const server = fakeServer([char])
    try {
      renderApp(`/c/${char.id}/level-up`)
      for (let total = 2; total <= taken.length; total++) {
        const cls = taken[total - 1]
        const classLevel = taken.slice(0, total).filter(c => c === cls).length
        log.where = `${build.name} → ${cls} ${classLevel} (level ${total})`
        await screen.findAllByRole('button', { name: /Apply Level Up|to choose/ }, { timeout: 10000 })
        await pause(20)
        const classRadio = cardsNow().find(c => heading(c) === 'Class')?.querySelector<HTMLInputElement>(`input[name=class][value="${cls}"]`)
        if (!classRadio) { log.problems.push(`${log.where} | ${cls} not offered`); break }
        await click(classRadio)
        const asiOffered = cardsNow().some(c => heading(c).startsWith('Ability Score Improvement'))
        if (asiOffered !== asiLevels(cls).includes(classLevel)) log.problems.push(`${log.where} | ASI ${asiOffered ? 'offered' : 'missing'} at ${cls} ${classLevel}`)
        const before = char
        const button = await fillLevelUp(log, build.subs[cls])
        if (!button) break
        char = await applyAndReturn(button, server, char.id, c => c.classes.reduce((t, k) => t + k.level, 0) === total, total < taken.length)
        for (const d of compareMulticlass(char, build.subs, taken.slice(0, total))) log.problems.push(`${log.where} | ${d}`)
        entering: {
          // Entering a class: exactly the PHB's multiclass proficiencies, and never its saving throws
          if (classLevel !== 1) break entering
          const gains = MULTICLASS_GAINS[cls]
          const gained = (k: 'armorProficiencies' | 'weaponProficiencies' | 'toolProficiencies') => {
            const had = new Set(before[k].map(norm))
            return [...new Set(char[k].map(norm))].filter(x => !had.has(x)).sort()
          }
          const tools = gained('toolProficiencies').map(t => INSTRUMENTS.has(t) ? '<instrument>' : t)
          for (const [what, got, exp] of [['armor', gained('armorProficiencies'), gains.armor], ['weapons', gained('weaponProficiencies'), gains.weapons], ['tools', tools, gains.tools]] as const) {
            // Only what wasn't already known can show up as gained
            const had = new Set((what === 'armor' ? before.armorProficiencies : what === 'weapons' ? before.weaponProficiencies : before.toolProficiencies).map(norm))
            const expected = (exp ?? []).filter(x => !had.has(x) && !(x === '<instrument>' && [...had].some(h => INSTRUMENTS.has(h)))).sort()
            if (JSON.stringify(got) !== JSON.stringify(expected)) log.problems.push(`${log.where} | multiclass ${what}: gained ${JSON.stringify(got)}, PHB ${JSON.stringify(expected)}`)
          }
          const skills = char.skillProficiencies.length - before.skillProficiencies.length
          if (skills !== (gains.skills ?? 0)) log.problems.push(`${log.where} | multiclass skills: gained ${skills}, PHB ${gains.skills ?? 0}`)
        }
        if (JSON.stringify([...char.saveProficiencies].sort()) !== JSON.stringify(startSaves)) log.problems.push(`${log.where} | saving throws changed: ${char.saveProficiencies.join(', ')}`)
      }
    } catch (e) {
      log.problems.push(`${log.where} | CRASH: ${(e as Error).message.slice(0, 300)}`)
    }
    cleanup()
    vi.unstubAllGlobals()
  }
  expectNoProblems(log)
}
