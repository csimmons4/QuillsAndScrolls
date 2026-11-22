// @vitest-environment jsdom
// Level Up from 1 to 20 for each class, every choice made, checked against the PHB tables: part 3 of 4
import { it } from 'vitest'
import { levelRulesSweep } from './levelRules'

it('levels each class to 20 by the PHB tables (3/4)', () => levelRulesSweep(2, 4))
