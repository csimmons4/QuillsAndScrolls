// @vitest-environment jsdom
// Every class and subclass on every sheet tab, part 1 of 4 (the parts run in parallel)
import { it } from 'vitest'
import { sheetSweep } from './helpers'

it('opens every class and subclass on every tab (1/4)', () => sheetSweep(0, 4))
