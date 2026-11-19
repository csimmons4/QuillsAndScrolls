// @vitest-environment jsdom
// Every class and subclass on every sheet tab, part 3 of 4 (the parts run in parallel)
import { it } from 'vitest'
import { sheetSweep } from './helpers'

it('opens every class and subclass on every tab (3/4)', () => sheetSweep(2, 4))
