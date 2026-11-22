// @vitest-environment jsdom
// Multiclass builds taken to level 20 through Level Up, checked against the PHB multiclassing rules: part 2 of 2
import { it } from 'vitest'
import { multiclassRulesSweep } from './levelRules'

it('multiclasses by the PHB rules (2/2)', () => multiclassRulesSweep(1, 2))
