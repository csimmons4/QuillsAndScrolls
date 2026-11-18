// @vitest-environment jsdom
// Flow tests: click through the app as a player would and check what gets saved
import { describe, it, expect } from 'vitest'
import { screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { fakeServer, renderApp, saved } from './app'
import { cleanup } from '@testing-library/react'
import { makeChar, equipped } from './fixtures'

/** Opens an inventory item's card by clicking its row */
const openItem = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
  await screen.findAllByText(name)
  const row = [...document.querySelectorAll<HTMLElement>('[data-item-idx]')].find(r => r.textContent!.includes(name))!
  await user.click(within(row).getAllByRole('button')[0])
}

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

  it('drinking a Potion of Healing heals by the roll you type and uses one up', async () => {
    // 12 max HP (a full d10 + 2), so the 7 rolled all counts
    const char = makeChar([{ classSlug: 'fighter', level: 1, hitDieRolls: [10] }], { con: 14 }, {
      name: 'Test Fighter', hp: { current: 3, temp: 0 },
      equipment: [{ ...equipped('potion-of-healing', 'Potion of Healing', { equipped: false }), quantity: 2 }],
    })
    const server = fakeServer([char])
    const user = userEvent.setup()
    renderApp(`/c/${char.id}`)
    await user.click(await screen.findByRole('button', { name: 'Inventory' }, find))
    await openItem(user, 'Potion of Healing')
    await user.click((await screen.findAllByRole('button', { name: /^Drink/ }))[0])
    // the open item shows in the side panel and under its row, so take the first
    const roll = (await screen.findAllByLabelText(/HP regained/))[0]
    await user.type(roll, '7')
    await user.click(within(roll.closest('.flex-col') as HTMLElement).getByRole('button', { name: 'Heal' }))
    const after = await saved(server, char.id, c => c.hp.current === 10)
    expect(after.equipment[0].quantity).toBe(1)
  }, SLOW.timeout)

  it('attuning a worn Cloak of Protection adds its +1 to AC', async () => {
    const char = makeChar([{ classSlug: 'wizard', level: 1 }], { dex: 14 }, {
      name: 'Test Wizard', hp: { current: 6, temp: 0 },
      equipment: [equipped('cloak-of-protection', 'Cloak of Protection', { slot: 'cloak' })],
    })
    const server = fakeServer([char])
    const user = userEvent.setup()
    const acNow = () => document.querySelector('.stat-box')!.textContent!
    renderApp(`/c/${char.id}`)
    await screen.findByLabelText('Character name', undefined, find)
    expect(acNow()).toMatch(/^AC\s*12/)
    await user.click(screen.getByRole('button', { name: 'Inventory' }))
    await openItem(user, 'Cloak of Protection')
    await user.click((await screen.findAllByRole('button', { name: /Attune$/ }))[0])
    await saved(server, char.id, c => c.equipment[0].attuned)
    expect(acNow()).toMatch(/^AC\s*13/)
  }, SLOW.timeout)

  it('History puts an earlier version back, keeping the one it replaces', async () => {
    const char = makeChar([{ classSlug: 'fighter', level: 2 }], { con: 14 }, { name: 'Test Fighter', hp: { current: 20, temp: 0 } })
    const server = fakeServer([{ ...char, classes: [{ ...char.classes[0], level: 1 }], hp: { current: 12, temp: 0 } }])
    // a snapshot of the level 1 version, then the character as it is now (level 2)
    await fetch(`/api/characters/${char.id}/history`, { method: 'POST', body: JSON.stringify({ label: 'Before level 2' }) })
    server.characters.set(char.id, structuredClone(char))
    const user = userEvent.setup()
    renderApp(`/c/${char.id}`)
    await user.click(await screen.findByRole('button', { name: 'Character history' }, find))
    const dialog = await screen.findByRole('dialog', { name: /history/ })
    await user.click(await within(dialog).findByRole('button', { name: 'Restore' }))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Restore' }))
    const after = await saved(server, char.id, c => c.classes[0].level === 1)
    expect(after.hp.current).toBe(12)
    expect(server.snapshots.map(sn => sn.label)).toEqual(['Before level 2', 'Before restoring an earlier version'])
  }, SLOW.timeout)

  it('fight effects survive a page refresh', async () => {
    const char = wizard(1, { hp: { current: 6, temp: 0 } })
    fakeServer([char])
    const user = userEvent.setup()
    renderApp(`/c/${char.id}`)
    await user.click(await screen.findByRole('button', { name: 'Mage Armor' }, find))
    expect(document.querySelector('.stat-box')!.textContent).toMatch(/^AC\s*15/)
    cleanup()   // the page goes away and comes back
    renderApp(`/c/${char.id}`)
    await screen.findByLabelText('Character name', undefined, find)
    expect(document.querySelector('.stat-box')!.textContent).toMatch(/^AC\s*15/)
  }, SLOW.timeout)
})

describe('Vault: Recently deleted', () => {
  it('a deleted character can be brought back, or deleted for good', async () => {
    const char = wizard(1)
    const server = fakeServer([char])
    const user = userEvent.setup()
    renderApp('/')
    await user.click(await screen.findByRole('button', { name: 'More actions for Test Wizard' }, find))
    await user.click(screen.getByRole('menuitem', { name: /^Delete/ }))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(server.characters.has(char.id)).toBe(false))
    await user.click(await screen.findByText(/Recently deleted \(1\)/))
    await user.click(screen.getByRole('button', { name: 'Restore' }))
    await waitFor(() => expect(server.characters.get(char.id)?.name).toBe('Test Wizard'))
    // delete again, then for good: the history goes too
    await user.click(await screen.findByRole('button', { name: 'More actions for Test Wizard' }))
    await user.click(screen.getByRole('menuitem', { name: /^Delete/ }))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete' }))
    await user.click(await screen.findByText(/Recently deleted \(1\)/))
    await user.click(screen.getByRole('button', { name: 'Delete forever' }))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete forever' }))
    await waitFor(() => expect(server.snapshots).toEqual([]))
  }, SLOW.timeout)
})

describe('Homebrew', () => {
  it('adds an item and edits it', async () => {
    const server = fakeServer([])
    const user = userEvent.setup()
    renderApp('/homebrew')
    const nameInput = () => screen.getByText('Name', { selector: 'label' }).parentElement!.querySelector('input')!
    await screen.findByRole('button', { name: 'Add Item' }, find)
    await user.type(nameInput(), 'Lucky Coin')
    await user.click(screen.getByRole('button', { name: 'Add Item' }))
    await waitFor(() => expect(server.homebrew.items.map(i => i.name)).toEqual(['Lucky Coin']))
    await user.click(await screen.findByRole('button', { name: 'Edit' }))
    await user.clear(nameInput())
    await user.type(nameInput(), 'Very Lucky Coin')
    await user.click(screen.getByRole('button', { name: 'Update' }))
    await waitFor(() => expect(server.homebrew.items.map(i => [i.name, i.slug])).toEqual([['Very Lucky Coin', 'lucky-coin']]))
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
    expect(server.snapshots.map(sn => [sn.id, sn.label])).toEqual([[char.id, 'Before level 2']])
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
