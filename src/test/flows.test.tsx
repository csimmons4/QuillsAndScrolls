// @vitest-environment jsdom
// Flow tests: click through the app as a player would and check what gets saved
import { describe, it, expect } from 'vitest'
import { screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { fakeServer, renderApp, saved } from './app'
import { makeChar } from './fixtures'

// Rendering the whole app with the full reference data takes a moment
const SLOW = { timeout: 15000 }
const find = { timeout: 8000 }

const wizard = (level: number, extra: Parameters<typeof makeChar>[2] = {}) => makeChar(
  [{ classSlug: 'wizard', subclassSlug: 'evocation', level }],
  { int: 16, con: 14, dex: 14 },
  { name: 'Test Wizard', hp: { current: 20, temp: 0 }, ...extra },
)

describe('Vault', () => {
  it('opens a character sheet', async () => {
    const char = wizard(1)
    fakeServer([char])
    const user = userEvent.setup()
    renderApp('/')
    await user.click(await screen.findByText('Test Wizard', undefined, find))
    expect(((await screen.findByLabelText('Character name', undefined, find)) as HTMLInputElement).value).toBe('Test Wizard')
  }, SLOW.timeout)
})

describe('Sheet', () => {
  it('casting a spell spends a slot and saves it', async () => {
    const char = wizard(1, {
      spellSlots: { '1': { max: 2, used: 0 } },
      spells: [{ spellSlug: 'magic-missile', name: 'Magic Missile', classSlug: 'wizard', prepared: true, isHomebrew: false }],
    })
    const server = fakeServer([char])
    const user = userEvent.setup()
    renderApp(`/c/${char.id}`)
    await user.click(await screen.findByRole('button', { name: 'Spells' }, find))
    const row = [...document.querySelectorAll<HTMLElement>('[data-spell-key]')]
      .find(r => !r.dataset.spellKey!.startsWith('lib:') && r.textContent!.includes('Magic Missile'))!
    await user.click(within(row).getAllByRole('button')[0])
    await user.click((await screen.findAllByTitle(/Cast Magic Missile with a 1st-level slot/, undefined, find))[0])
    const after = await saved(server, char.id, c => c.spellSlots['1'].used === 1)
    expect(after.spellSlots['1']).toEqual({ max: 2, used: 1 })
  }, SLOW.timeout)

  it('a long rest restores HP, and Undo puts it back', async () => {
    const char = wizard(3, { hp: { current: 3, temp: 0 } })
    const server = fakeServer([char])
    const user = userEvent.setup()
    renderApp(`/c/${char.id}`)
    await user.click(await screen.findByRole('button', { name: 'Long Rest' }, find))
    await user.click(screen.getByRole('button', { name: 'Begin Long Rest' }))
    await saved(server, char.id, c => c.hp.current > 3)
    await user.click(await screen.findByRole('button', { name: 'Undo' }))
    const after = await saved(server, char.id, c => c.hp.current === 3)
    expect(after.hp.current).toBe(3)
  }, SLOW.timeout)

  it('damage while concentrating asks for a concentration save', async () => {
    const char = wizard(3, { concentratingOn: 'blur', hp: { current: 20, temp: 0 } })
    const server = fakeServer([char])
    const user = userEvent.setup()
    renderApp(`/c/${char.id}`)
    await user.type(await screen.findByLabelText(/Amount to damage/, undefined, find), '12')
    await user.click(screen.getByRole('button', { name: /^Damage/ }))
    // DC is half the damage, at least 10
    const dialog = (await screen.findByRole('heading', { name: 'Concentration Save' })).parentElement!
    expect(within(dialog).getByText('DC').nextElementSibling!.textContent).toBe('10')
    const after = await saved(server, char.id, c => c.hp.current === 8)
    expect(after.concentratingOn).toBe('blur')
  }, SLOW.timeout)

  it('Arcane Recovery gets spent slots back on a short rest', async () => {
    const char = wizard(5, { spellSlots: { '1': { max: 4, used: 2 }, '2': { max: 3, used: 1 }, '3': { max: 2, used: 1 } } })
    const server = fakeServer([char])
    const user = userEvent.setup()
    renderApp(`/c/${char.id}`)
    await user.click(await screen.findByRole('button', { name: 'Short Rest' }, find))
    // Level 5 recovers up to 3 slot levels: one 3rd-level slot uses all of it
    await user.click(screen.getByRole('button', { name: 'Get back a 3rd-level slot' }))
    expect((screen.getByRole('button', { name: 'Get back a 1st-level slot' }) as HTMLButtonElement).disabled).toBe(true)
    await user.click(screen.getByRole('button', { name: 'Finish Rest' }))
    const after = await saved(server, char.id, c => c.spellSlots['3'].used === 0)
    expect(after.spellSlots['1'].used).toBe(2)
    expect(after.classResources['arcane-recovery']).toBe(0)
  }, SLOW.timeout)

  it('Wild Shape takes damage first and the rest carries over', async () => {
    const char = makeChar([{ classSlug: 'druid', subclassSlug: 'moon', level: 4 }], { wis: 16, con: 14 },
      { name: 'Test Druid', hp: { current: 30, temp: 0 } })
    const server = fakeServer([char])
    const user = userEvent.setup()
    renderApp(`/c/${char.id}`)
    await user.click(await screen.findByRole('button', { name: /Take a beast form/ }, find))
    await user.click(screen.getByRole('button', { name: /^Brown Bear/ }))
    const inForm = await saved(server, char.id, c => c.summons.some(s => s.templateKey === 'wild-shape'))
    expect(inForm.classResources['wild-shape']).toBe(1)
    // The bear's AC and speed replace the druid's
    expect(screen.getByText(/Brown Bear \(Wild Shape\)/)).toBeTruthy()
    expect(screen.getByText('40ft')).toBeTruthy()
    // 40 damage: the bear's 34 HP, then 6 to the druid
    await user.type(screen.getByLabelText(/Amount to damage/), '40')
    await user.click(screen.getByRole('button', { name: /^Damage/ }))
    const after = await saved(server, char.id, c => c.hp.current === 24)
    expect(after.summons.some(s => s.templateKey === 'wild-shape')).toBe(false)
  }, SLOW.timeout)
})

describe('Level Up', () => {
  it('saves the new level and keeps a snapshot from before', async () => {
    const char = makeChar([{ classSlug: 'fighter', level: 1 }], { str: 16, con: 14 }, { name: 'Test Fighter', hp: { current: 12, temp: 0 } })
    const server = fakeServer([char])
    const user = userEvent.setup()
    renderApp(`/c/${char.id}/level-up`)
    const apply = await screen.findAllByRole('button', { name: 'Apply Level Up' }, find)
    await user.click(apply[apply.length - 1])
    const after = await saved(server, char.id, c => c.classes[0].level === 2)
    expect(after.classes[0].level).toBe(2)
    expect(server.snapshots).toEqual([{ id: char.id, label: 'Before level 2' }])
  }, SLOW.timeout)
})

describe('Creator', () => {
  it('won’t move on until each step is done, then builds the character', async () => {
    const server = fakeServer([])
    const user = userEvent.setup()
    renderApp('/new')
    const next = async () => user.click(screen.getByRole('button', { name: 'Next' }))

    await screen.findAllByRole('button', { name: /^Human\b/ }, find)
    await next()
    expect(screen.getByText(/Select a race\./)).toBeTruthy()
    await user.click(screen.getAllByRole('button', { name: /^Human\b/ })[0])
    await next()

    await user.click((await screen.findAllByRole('button', { name: /^Barbarian\b/ }))[0])
    await next()

    await user.click((await screen.findAllByRole('button', { name: /^Acolyte\b/ }))[0])
    await next()

    // Standard array, highest first
    const selects = (await screen.findAllByRole('combobox')).filter(s => within(s).queryByRole('option', { name: '15' }))
    for (const [i, v] of ['15', '14', '13', '12', '10', '8'].entries()) {
      const current = (await screen.findAllByRole('combobox')).filter(s => s.closest('.grid') === selects[0].closest('.grid'))
      await user.selectOptions(current[i], v)
    }
    await next()

    await user.click(await screen.findByRole('checkbox', { name: /^Athletics/ }))
    await user.click(screen.getByRole('checkbox', { name: /^Intimidation/ }))
    await next()

    await next()   // Equipment: the defaults need no picks

    await user.type(await screen.findByPlaceholderText(/Thalindra/), 'Test Barbarian')
    await next()

    await user.click(await screen.findByRole('button', { name: 'Create Character' }))
    await waitFor(() => expect(server.characters.size).toBe(1), { timeout: 4000 })
    const made = [...server.characters.values()][0]
    expect(made.name).toBe('Test Barbarian')
    expect(made.classes).toMatchObject([{ classSlug: 'barbarian', level: 1 }])
    expect(made.abilityScores.str).toBe(16)   // 15 + Human's +1
    expect(made.skillProficiencies).toEqual(expect.arrayContaining(['athletics', 'intimidation', 'insight', 'religion']))
  }, 30000)
})
