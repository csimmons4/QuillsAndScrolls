// @vitest-environment jsdom
// The Creator: pick every race on step 1, then every class on step 2
import { it } from 'vitest'
import { screen, fireEvent, act } from '@testing-library/react'
import { fakeServer, renderApp } from '../app'
import { problemLog, checkText, pause, expectNoProblems } from './helpers'

it('picks every race and every class in the Creator', async () => {
  const log = problemLog()
  const cards = () => screen.getAllByRole('button').filter(b => b.querySelector(':scope > .font-bold'))
  const pick = async (name: string) => {
    const card = cards().find(b => b.querySelector('.font-bold')!.textContent === name)
    if (!card) { log.problems.push(`${log.where} | card gone`); return }
    await act(async () => { fireEvent.click(card) })
    await pause(40)
    checkText(log)
  }
  fakeServer([])
  renderApp('/new')
  await screen.findAllByRole('button', { name: /^Human/ }, { timeout: 10000 })
  for (const race of cards().map(b => b.querySelector('.font-bold')!.textContent!)) { log.where = `race ${race}`; await pick(race) }
  log.where = 'to the class step'
  await pick('Human')
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Next' })) })
  await pause()
  for (const cls of cards().map(b => b.querySelector('.font-bold')!.textContent!)) { log.where = `class ${cls}`; await pick(cls) }
  expectNoProblems(log)
})
