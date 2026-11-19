// @vitest-environment jsdom
// Drink every potion (typing a roll, choosing, failing the save where asked), then a long rest
import { it, vi } from 'vitest'
import { screen, fireEvent, cleanup, act, within } from '@testing-library/react'
import { fakeServer, renderApp } from '../app'
import { makeChar, content, equipped } from '../fixtures'
import { problemLog, checkText, pause, openTab, expectNoProblems } from './helpers'

it('drinks every potion', async () => {
  const log = problemLog()
  const potions = content().items.filter(i => i.potion)
  for (let start = 0; start < potions.length; start += 6) {
    const batch = potions.slice(start, start + 6)
    const char = makeChar([{ classSlug: 'fighter', level: 5, hitDieRolls: [10, 6, 6, 6, 6] }], { str: 16, con: 14 }, {
      name: 'Sweep Fighter', hp: { current: 20, temp: 0 },
      equipment: [equipped('longsword', 'Longsword'), ...batch.map(p => ({ ...equipped(p.slug, p.name, { equipped: false }), quantity: 2 }))],
    })
    fakeServer([char])
    renderApp(`/c/${char.id}`)
    await screen.findByLabelText('Character name', undefined, { timeout: 10000 })
    await openTab('Inventory')
    for (const p of batch) {
      log.where = p.slug
      try {
        const row = [...document.querySelectorAll<HTMLElement>('[data-item-idx]')].find(r => r.textContent?.includes(p.name))
        if (!row) { log.problems.push(`${log.where} | no inventory row`); continue }
        await act(async () => { fireEvent.click(within(row).getAllByRole('button')[0]) })
        await pause()
        const drink = screen.queryAllByRole('button').find(b => /^Drink/.test(b.textContent?.trim() ?? ''))
        if (!drink) { log.problems.push(`${log.where} | no Drink button`); continue }
        await act(async () => { fireEvent.click(drink) })
        await pause()
        const box = document.querySelector<HTMLElement>('.border-rose-200')
        if (box) {
          const roll = box.querySelector<HTMLInputElement>('input[type=number]')
          if (roll) await act(async () => { fireEvent.change(roll, { target: { value: '5' } }) })
          const fail = box.querySelector<HTMLInputElement>('input[type=checkbox]')
          if (fail) await act(async () => { fireEvent.click(fail) })
          const choice = box.querySelector<HTMLSelectElement>('select')
          if (choice && choice.options.length > 1) await act(async () => { fireEvent.change(choice, { target: { value: choice.options[1].value } }) })
          const finish = [...box.querySelectorAll('button')].find(b => /^(Heal|Drink)$/.test(b.textContent?.trim() ?? ''))
          if (!finish || finish.hasAttribute('disabled')) { log.problems.push(`${log.where} | can't finish drinking`); continue }
          await act(async () => { fireEvent.click(finish) })
        }
        await pause()
        checkText(log, 'after drinking')
      } catch (e) {
        log.problems.push(`${log.where} | CRASH: ${(e as Error).message.slice(0, 300)}`)
      }
    }
    log.where = `potions from ${start}: Stats tab and a long rest`
    await openTab('Stats')
    checkText(log)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Long Rest' })) })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Begin Long Rest' })) })
    await pause(100)
    checkText(log, 'after the long rest')
    cleanup()
    vi.unstubAllGlobals()
  }
  expectNoProblems(log)
})
