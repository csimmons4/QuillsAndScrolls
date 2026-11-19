// @vitest-environment jsdom
// Every class and subclass on every sheet tab, part 4 of 4 (the parts run in parallel)
import { it } from 'vitest'
import { sheetSweep } from './helpers'

it('opens every class and subclass on every tab (4/4)', () => sheetSweep(3, 4))
