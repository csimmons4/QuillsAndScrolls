// @vitest-environment jsdom
// Every button on every page, and on sheets in unusual states: dying, fallen, in Wild Shape with
// summons, board notes, a running potion, concentration and conditions
import { it, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import { fakeServer, renderApp } from '../app'
import { makeChar, equipped } from '../fixtures'
import { problemLog, pause, openTab, pressEveryButton, expectNoProblems, TABS } from './helpers'

it('presses every button on every page and on unusual sheets', async () => {
  const log = problemLog()
  const druid = makeChar([{ classSlug: 'druid', subclassSlug: 'moon', level: 10 }], { wis: 16, con: 14 }, {
    name: 'State Druid', hp: { current: 40, temp: 3 }, concentratingOn: 'barkskin', conditions: ['Poisoned'], exhaustionLevel: 2,
    spellSlots: { '1': { max: 4, used: 1 }, '2': { max: 3, used: 0 }, '3': { max: 3, used: 0 }, '4': { max: 3, used: 0 }, '5': { max: 2, used: 0 } },
    summons: [
      { id: 'ws', name: 'Dire Wolf', templateKey: 'wild-shape', hp: { current: 30, max: 37 }, ac: 14, speed: 50, saveProficiencies: [], immunities: [], resistances: [], attacks: [{ name: 'Bite', toHit: 5, damage: '2d6+3', damageType: 'piercing', range: 'Melee', notes: '' }], abilities: [], notes: '' },
      { id: 'owl', name: 'Owl', hp: { current: 1, max: 1 }, ac: 11, speed: 5, saveProficiencies: [], immunities: [], resistances: [], attacks: [], abilities: [{ name: 'Flyby', description: 'No opportunity attacks.' }], notes: 'familiar' },
    ],
    activePotions: [{ id: 'p1', itemSlug: 'potion-of-speed', name: 'Potion of Speed', effect: 'Haste', duration: '1 minute', minutes: 1, roundsLeft: 10 }],
    campaignBoard: { activeBoard: 'b1', boards: [{ id: 'b1', name: 'Clues', notes: [{ id: 'n1', x: 40, y: 40, w: 200, h: 200, title: 'The mill', content: 'Who lit it?', color: 'yellow' }], connections: [] }] },
    equipment: [equipped('scimitar', 'Scimitar'), { ...equipped('potion-of-healing', 'Potion of Healing', { equipped: false }), quantity: 2 }],
  })
  const dying = makeChar([{ classSlug: 'rogue', subclassSlug: 'thief', level: 5 }], { dex: 16 }, {
    name: 'Dying Rogue', hp: { current: 0, temp: 0 }, deathSaves: { successes: 1, failures: 1 },
  })
  const fallen = makeChar([{ classSlug: 'fighter', level: 3 }], { str: 16 }, {
    name: 'Fallen Fighter', hp: { current: 0, temp: 0 }, deathSaves: { successes: 0, failures: 3 },
  })
  const visit = async (path: string, where: string, tabs = false) => {
    fakeServer([druid, dying, fallen])
    renderApp(path)
    await pause(2500)
    if (!tabs) await pressEveryButton(log, where)
    else for (const tab of TABS) { await openTab(tab); await pressEveryButton(log, `${where}/${tab}`) }
    cleanup()
    vi.unstubAllGlobals()
  }
  for (const [path, where] of [['/', 'vault'], ['/new', 'creator'], ['/homebrew', 'homebrew'], ['/settings', 'settings'], ['/lookup', 'compendium'], [`/c/${druid.id}/level-up`, 'level-up'], [`/c/${dying.id}`, 'death screen'], [`/c/${fallen.id}`, 'fallen sheet']] as const) {
    log.where = where
    try { await visit(path, where) } catch (e) { log.problems.push(`${where} | CRASH: ${(e as Error).message.slice(0, 200)}`) }
  }
  log.where = 'druid'
  try { await visit(`/c/${druid.id}`, 'druid', true) } catch (e) { log.problems.push(`druid | CRASH: ${(e as Error).message.slice(0, 200)}`) }
  expectNoProblems(log)
})
