// @vitest-environment jsdom
// Level Up for every class from levels 1, 2, 3, 10 and 19 (with a subclass once it has one)
import { it, vi } from 'vitest'
import { screen, cleanup } from '@testing-library/react'
import { fakeServer, renderApp } from '../app'
import { CLASS_OPTIONS } from '../../data/classData'
import { problemLog, checkText, pause, sweepCharacter, expectNoProblems } from './helpers'

it('opens Level Up for every class at several levels', async () => {
  const log = problemLog()
  for (const [cls, opts] of Object.entries(CLASS_OPTIONS)) {
    for (const level of [1, 2, 3, 10, 19]) {
      const sub = opts.subclasses.find(s => s.level <= level)?.slug
      log.where = `${cls}/${sub ?? '-'}/${level}→${level + 1}`
      const char = sweepCharacter(cls, sub, level)
      try {
        fakeServer([char])
        renderApp(`/c/${char.id}/level-up`)
        await screen.findAllByRole('button', { name: /Apply Level Up|to choose/ }, { timeout: 10000 })
        await pause(50)
        checkText(log)
      } catch (e) {
        log.problems.push(`${log.where} | CRASH: ${(e as Error).message.slice(0, 300)}`)
      }
      cleanup()
      vi.unstubAllGlobals()
    }
  }
  expectNoProblems(log)
})
