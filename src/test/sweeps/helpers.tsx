// Shared by the sweeps (`npm run test:sweep`): broad, slow checks that open many characters and
// pages and fail on any crash, console error/warning or broken text (NaN, undefined…) on screen.
import { vi, expect } from 'vitest'
import { screen, fireEvent, act, cleanup } from '@testing-library/react'
import { fakeServer, renderApp } from '../app'
import type { Character } from '../../character/model'
import { makeChar, content, equipped } from '../fixtures'
import { CLASS_OPTIONS, slotsForLevel, PACT_SLOT_TABLE } from '../../data/classData'

export const TABS = ['Stats', 'Spells', 'Inventory', 'Features', 'Summons', 'Notes']
const BROKEN = /\bNaN\b|\bundefined\b|\[object Object\]|\bInfinity\b/

/** Collects console errors and warnings, labelled with whatever `where` was last set to */
export function problemLog() {
  const problems: string[] = []
  const log = { where: '', problems }
  const note = (kind: string) => (...a: unknown[]) => {
    const msg = a.map(x => (x instanceof Error ? x.message : String(x))).join(' ').replace(/\s+/g, ' ')
    if (/Not implemented: navigation/.test(msg)) return   // jsdom can't reload or follow downloads
    problems.push(`${log.where} | ${kind}: ${msg.slice(0, 400)}`)
  }
  vi.spyOn(console, 'error').mockImplementation(note('console.error'))
  vi.spyOn(console, 'warn').mockImplementation(note('console.warn'))
  return log
}

/** Notes broken text on the page (NaN, undefined, [object Object], Infinity) */
export function checkText(log: ReturnType<typeof problemLog>, label = '') {
  const text = document.body.textContent ?? ''
  const m = text.match(BROKEN)
  if (m) log.problems.push(`${log.where}${label ? ` ${label}` : ''} | text: "${text.slice(Math.max(0, m.index! - 70), m.index! + 40).replace(/\s+/g, ' ')}"`)
}

export const pause = (ms = 30) => act(async () => { await new Promise(r => setTimeout(r, ms)) })

/** Clicks a sheet tab by its label */
export async function openTab(tab: string) {
  const button = screen.getAllByRole('button').find(b => b.textContent?.trim().startsWith(tab))
  if (button) await act(async () => { fireEvent.click(button); await new Promise(r => setTimeout(r, 30)) })
  return !!button
}

/** Presses every button on the page once (not the tab bar, navigation, downloads or reloads),
 *  closing whatever opens with Escape, and checks the page after each press */
export async function pressEveryButton(log: ReturnType<typeof problemLog>, where: string, max = 150) {
  const pressed = new Set<string>()
  for (let i = 0; i < max; i++) {
    const next = screen.queryAllByRole('button').find((b, idx) => {
      const label = `${b.textContent?.trim() || b.getAttribute('aria-label') || b.title}#${idx}`
      if (pressed.has(label) || (b as HTMLButtonElement).disabled) return false
      if (TABS.some(t => b.textContent?.trim().startsWith(t) && b.closest('.sticky'))) return false
      if (/Export|Print|Level Up|Download|Reload/i.test(b.textContent ?? '') || b.closest('a')) return false
      pressed.add(label)
      return true
    })
    if (!next) break
    log.where = `${where}/"${(next.textContent?.trim() || next.getAttribute('aria-label') || next.title || '?').slice(0, 40)}"`
    try {
      await act(async () => { fireEvent.click(next); await new Promise(r => setTimeout(r, 5)) })
    } catch (e) {
      log.problems.push(`${log.where} | CRASH: ${(e as Error).message.slice(0, 200)}`)
    }
    checkText(log)
    await act(async () => { fireEvent.keyDown(document, { key: 'Escape' }) })
  }
}

/** Every class at level 1, and every subclass at the level it arrives (at least 3) and at 20 */
export function allClassCases(): { cls: string; sub?: string; level: number }[] {
  const cases: { cls: string; sub?: string; level: number }[] = []
  for (const [cls, opts] of Object.entries(CLASS_OPTIONS)) {
    cases.push({ cls, level: 1 })
    for (const sub of opts.subclasses) for (const level of [Math.max(3, sub.level), 20]) cases.push({ cls, sub: sub.slug, level })
  }
  return cases
}

/** A character of one class with slots, a couple of spells per level and some gear */
export function sweepCharacter(cls: string, sub: string | undefined, level: number, scores = 14): Character {
  const c = content()
  const table = c.classes.find(k => k.slug === cls)?.spellSlotTable as number[][] | undefined
  const spellSlots = slotsForLevel(cls, level, table, sub) ?? {}
  const pact = cls === 'warlock' ? PACT_SLOT_TABLE[level - 1] : null
  const top = pact ? pact[0] : Math.max(0, ...Object.keys(spellSlots).map(Number))
  const spells = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].filter(l => l <= top).flatMap(l =>
    c.spells.filter(s => s.level === l && (s.classLists ?? []).includes(cls)).slice(0, 2)
      .map(s => ({ spellSlug: s.slug, name: s.name, classSlug: cls, prepared: true, isHomebrew: false })))
  return makeChar([{ classSlug: cls, subclassSlug: sub, level }],
    { str: scores, dex: scores, con: scores, int: scores, wis: scores, cha: scores },
    {
      name: `Sweep ${cls} ${sub ?? ''} ${level}`, hp: { current: 20, temp: 0 }, spellSlots, spells,
      ...(pact ? { pactSlots: { level: pact[0], max: pact[1], used: 0 } } : {}),
      equipment: [equipped('dagger', 'Dagger'), equipped('leather', 'Leather'), { ...equipped('potion-of-healing', 'Potion of Healing', { equipped: false }), quantity: 2 }],
    })
}

/** Fails the sweep with every problem it found, one per line */
export function expectNoProblems(log: ReturnType<typeof problemLog>) {
  expect(log.problems.join('\n')).toBe('')
}

// ── The sweeps themselves (each *.sweep.tsx file runs one, so they run in parallel) ─────────────

/** Every class and subclass (allClassCases), every sheet tab; `shard` of `shards` share the work */
export async function sheetSweep(shard: number, shards: number) {
  const log = problemLog()
  for (const [n, { cls, sub, level }] of allClassCases().entries()) {
    if (n % shards !== shard) continue
    log.where = `${cls}/${sub ?? '-'}/${level}`
    const char = sweepCharacter(cls, sub, level)
    try {
      fakeServer([char])
      renderApp(`/c/${char.id}`)
      await screen.findByLabelText('Character name', undefined, { timeout: 10000 })
      for (const tab of ['Spells', 'Inventory', 'Features', 'Summons', 'Notes', 'Stats']) {
        if (!(await openTab(tab))) log.problems.push(`${log.where} | no ${tab} tab`)
        checkText(log, tab)
      }
    } catch (e) {
      log.problems.push(`${log.where} | CRASH: ${(e as Error).message.slice(0, 300)}`)
    }
    cleanup()
    vi.unstubAllGlobals()
  }
  expectNoProblems(log)
}

/** Every class at level 20 with its first subclass: every button on every tab */
export async function buttonSweep(shard: number, shards: number) {
  const log = problemLog()
  for (const [n, [cls, opts]] of Object.entries(CLASS_OPTIONS).entries()) {
    if (n % shards !== shard) continue
    const char = sweepCharacter(cls, opts.subclasses[0]?.slug, 20, 16)
    char.equipment.push(equipped('chain-mail', 'Chain Mail'), equipped('shield', 'Shield', { slot: 'off' }), equipped('cloak-of-protection', 'Cloak of Protection', { slot: 'cloak' }))
    log.where = cls
    try {
      fakeServer([char])
      renderApp(`/c/${char.id}`)
      await screen.findByLabelText('Character name', undefined, { timeout: 10000 })
      for (const tab of TABS) {
        await openTab(tab)
        await pressEveryButton(log, `${cls}/${tab}`, 120)
      }
    } catch (e) {
      log.problems.push(`${log.where} | CRASH: ${(e as Error).message.slice(0, 300)}`)
    }
    cleanup()
    vi.unstubAllGlobals()
  }
  expectNoProblems(log)
}
