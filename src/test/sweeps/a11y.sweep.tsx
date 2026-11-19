// @vitest-environment jsdom
// Every button, link and form field on every page and sheet tab has a name a screen reader can say
import { it, expect } from 'vitest'
import { cleanup } from '@testing-library/react'
import { fakeServer, renderApp } from '../app'
import { makeChar, equipped } from '../fixtures'
import { pause, openTab } from './helpers'

function unnamed(): string[] {
  const nameOf = (el: Element) => {
    const aria = el.getAttribute('aria-label') || el.getAttribute('title') || el.getAttribute('aria-labelledby')
    if (aria) return aria
    if (el instanceof HTMLButtonElement || el instanceof HTMLAnchorElement) return el.textContent?.trim() || el.querySelector('img[alt]:not([alt=""])')?.getAttribute('alt') || ''
    const id = el.getAttribute('id')
    const label = el.closest('label') ?? (id ? document.querySelector(`label[for="${id}"]`) : null)
    return label?.textContent?.trim() || (el as HTMLInputElement).placeholder || ''
  }
  return [...document.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea')]
    .filter(el => !el.closest('[aria-hidden="true"]') && !el.classList.contains('hidden') && !nameOf(el))
    .map(el => `${el.tagName.toLowerCase()} "${(el.className || '').toString().slice(0, 50)}" in "${(el.parentElement?.textContent ?? '').trim().slice(0, 40)}"`)
}

it('names every control', async () => {
  const found: string[] = []
  const wiz = makeChar([{ classSlug: 'wizard', subclassSlug: 'evocation', level: 5 }], { int: 16 }, {
    name: 'Test Wizard', hp: { current: 20, temp: 0 }, spellSlots: { '1': { max: 4, used: 1 }, '2': { max: 3, used: 0 }, '3': { max: 2, used: 0 } },
    spells: [{ spellSlug: 'magic-missile', name: 'Magic Missile', classSlug: 'wizard', prepared: true, isHomebrew: false }],
    equipment: [equipped('dagger', 'Dagger'), { ...equipped('potion-of-healing', 'Potion of Healing', { equipped: false }), quantity: 2 }, equipped('cloak-of-protection', 'Cloak of Protection', { slot: 'cloak' })],
    summons: [{ id: 's1', name: 'Owl', hp: { current: 1, max: 1 }, ac: 11, speed: 5, saveProficiencies: [], immunities: [], resistances: [], attacks: [], abilities: [], notes: '' }],
    campaignBoard: { activeBoard: 'b1', boards: [{ id: 'b1', name: 'Clues', notes: [{ id: 'n1', x: 40, y: 40, w: 200, h: 200, title: 'The mill', content: '', color: 'yellow' }], connections: [] }] },
  })
  for (const path of ['/', '/party', '/new', '/lookup', '/homebrew', '/settings', `/c/${wiz.id}/level-up`, `/c/${wiz.id}`]) {
    fakeServer([wiz])
    renderApp(path)
    await pause(2500)
    found.push(...unnamed().map(u => `${path}: ${u}`))
    if (path === `/c/${wiz.id}`) {
      for (const tab of ['Spells', 'Inventory', 'Features', 'Summons', 'Notes']) {
        await openTab(tab)
        await pause(200)
        found.push(...unnamed().map(u => `${path} ${tab}: ${u}`))
      }
    }
    cleanup()
  }
  expect([...new Set(found)].join('\n')).toBe('')
})
