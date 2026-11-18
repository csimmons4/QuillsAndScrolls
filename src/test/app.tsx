// Flow tests: the whole app in jsdom against a fake server. Reference data comes from public/ as in
// the real app; characters live in memory instead of on disk, so a test can check what was saved.
// Test files that use this start with `// @vitest-environment jsdom`.
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, vi } from 'vitest'
import { cleanup, render, waitFor } from '@testing-library/react'
import App from '../App'
import type { Character } from '../character/model'

// What jsdom leaves out
Element.prototype.scrollIntoView = () => {}
Element.prototype.scrollTo = () => {}
window.scrollTo = () => {}
globalThis.CSS ??= { escape: (s: string) => s.replace(/[^\w-]/g, c => `\\${c}`) } as typeof CSS

afterEach(async () => {
  cleanup()
  // A sheet's debounced save (800 ms) can still be on its way: let it reach this test's server,
  // not the next one's
  await new Promise(r => setTimeout(r, 1000))
  vi.unstubAllGlobals()
  sessionStorage.clear()
})

export interface FakeServer {
  characters: Map<string, Character>
  snapshots: { id: string; label: string }[]
}

/** Answers the app's fetches: /data/wikidot from public/, the /api routes from memory */
export function fakeServer(chars: Character[]): FakeServer {
  const server: FakeServer = { characters: new Map(chars.map(c => [c.id, structuredClone(c)])), snapshots: [] }
  const reply = (body: unknown, status = 200) => ({
    ok: status < 400, status,
    json: async () => structuredClone(body),
    text: async () => JSON.stringify(body),
  })
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const { pathname } = new URL(String(input), 'http://localhost')
    const method = init?.method ?? 'GET'
    const body = () => JSON.parse(String(init?.body))
    if (pathname.startsWith('/data/wikidot/')) {
      const file = join(__dirname, '../../public', pathname)
      return existsSync(file) ? reply(JSON.parse(readFileSync(file, 'utf8'))) : reply({}, 404)
    }
    if (pathname === '/api/characters') return reply([...server.characters.values()])
    let m = pathname.match(/^\/api\/characters\/([^/]+)$/)
    if (m && method === 'PUT') { server.characters.set(m[1], body()); return reply({ ok: true }) }
    if (m && method === 'DELETE') { server.characters.delete(m[1]); return reply({ ok: true }) }
    m = pathname.match(/^\/api\/characters\/([^/]+)\/history$/)
    if (m && method === 'POST') { server.snapshots.push({ id: m[1], label: body().label }); return reply({ ok: true }) }
    if (m) return reply([])
    if (pathname === '/api/homebrew') return reply({ spells: [], items: [], feats: [], races: [], classes: [], backgrounds: [] })
    if (pathname === '/api/settings/network') return reply({ lan: false, addresses: [] })
    return reply({ error: 'not found' }, 404)
  })
  return server
}

/** The app, opened at `path` */
export function renderApp(path: string) {
  window.history.pushState({}, '', path)
  return render(<App />)
}

/** Waits for the sheet's debounced save (800 ms) to reach the fake server */
export async function saved(server: FakeServer, id: string, check: (c: Character) => boolean) {
  await waitFor(() => {
    const c = server.characters.get(id)
    if (!c || !check(c)) throw new Error('not saved yet')
  }, { timeout: 4000 })
  return server.characters.get(id)!
}
