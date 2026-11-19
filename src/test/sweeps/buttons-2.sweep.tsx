// @vitest-environment jsdom
// Every button on every sheet tab, for each class at level 20, part 2 of 2
import { it } from 'vitest'
import { buttonSweep } from './helpers'

it('presses every button on every tab (2/2)', () => buttonSweep(1, 2))
