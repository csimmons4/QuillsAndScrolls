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
// Blob.text(), which browsers have and jsdom doesn't (file imports read files with it)
Blob.prototype.text ??= function (this: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsText(this)
  })
}

afterEach(async () => {
  cleanup()
  // A sheet's debounced save (800 ms) can still be on its way: let it reach this test's server,
  // not the next one's
  await new Promise(r => setTimeout(r, 1000))
  vi.unstubAllGlobals()
  sessionStorage.clear()
})

export interface FakeSnapshot { id: string; stamp: string; label: string; savedAt: string; character: Character }
export interface FakeServer {
  characters: Map<string, Character>
  /** History, oldest first; works like the real server's (Deleted snapshots, Recently deleted) */
  snapshots: FakeSnapshot[]
  /** Homebrew by category */
  homebrew: Record<string, Record<string, unknown>[]>
  /** While true, saving a character fails (as when the app's server has been closed) */
  failSaves: boolean
}

/** Answers the app's fetches: /data/wikidot from public/, the /api routes from memory */
export function fakeServer(chars: Character[]): FakeServer {
  const server: FakeServer = {
    characters: new Map(chars.map(c => [c.id, structuredClone(c)])),
    snapshots: [],
    homebrew: { spells: [], items: [], feats: [], races: [], classes: [], backgrounds: [] },
    failSaves: false,
  }
  let clock = 0
  const snapshot = (id: string, label: string) => {
    const character = server.characters.get(id)
    if (!character) return false
    clock++
    server.snapshots.push({ id, label, stamp: `s${String(clock).padStart(4, '0')}`, savedAt: new Date(Date.UTC(2026, 10, 17, 12, 0, clock)).toISOString(), character: structuredClone(character) })
    return true
  }
  const newestFirst = (id: string) => server.snapshots.filter(s => s.id === id).reverse()
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
    if (m && method === 'PUT') {
      if (server.failSaves) return reply({ error: 'server gone' }, 503)
      server.characters.set(m[1], body())
      return reply({ ok: true })
    }
    if (m && method === 'DELETE') {
      if (snapshot(m[1], 'Deleted')) server.characters.delete(m[1])
      return reply({ ok: true })
    }
    m = pathname.match(/^\/api\/characters\/([^/]+)\/history$/)
    if (m && method === 'POST') return reply({ ok: snapshot(m[1], body().label) })
    if (m) return reply(newestFirst(m[1]).map(s => ({
      stamp: s.stamp, label: s.label, savedAt: s.savedAt, name: s.character.name,
      level: s.character.classes.reduce((n, c) => n + c.level, 0), hp: s.character.hp.current,
    })))
    m = pathname.match(/^\/api\/characters\/([^/]+)\/history\/([^/]+)$/)
    if (m && method === 'PUT') {
      if (server.snapshots.some(x => x.id === m![1] && x.stamp === m![2])) return reply({ added: false })
      const snap = body()
      server.snapshots.push({ id: m[1], stamp: m[2], label: snap.label, savedAt: snap.savedAt, character: snap.character })
      server.snapshots.sort((a, b) => a.stamp.localeCompare(b.stamp))
      return reply({ added: true })
    }
    if (m) {
      const s = server.snapshots.find(x => x.id === m![1] && x.stamp === m![2])
      return s ? reply({ label: s.label, savedAt: s.savedAt, character: s.character }) : reply({ error: 'no such snapshot' }, 404)
    }
    if (pathname === '/api/history') {
      const out: Record<string, Record<string, unknown>> = {}
      for (const s of server.snapshots) (out[s.id] ??= {})[`${s.stamp}.json`] = { label: s.label, savedAt: s.savedAt, character: s.character }
      return reply(out)
    }
    if (pathname === '/api/deleted' && method === 'GET') {
      const gone = [...new Set(server.snapshots.map(s => s.id))].filter(id => !server.characters.has(id))
      return reply(gone.map(id => newestFirst(id)[0]).map(s => ({
        id: s.id, stamp: s.stamp, label: s.label, savedAt: s.savedAt, name: s.character.name,
        level: s.character.classes.reduce((n, c) => n + c.level, 0),
      })))
    }
    m = pathname.match(/^\/api\/deleted\/([^/]+)$/)
    if (m && method === 'DELETE') {
      if (server.characters.has(m[1])) return reply({ error: 'character still exists' }, 409)
      server.snapshots = server.snapshots.filter(s => s.id !== m![1])
      return reply({ ok: true })
    }
    if (pathname === '/api/homebrew') return reply(server.homebrew)
    m = pathname.match(/^\/api\/homebrew\/([^/]+)\/([^/]+)$/)
    if (m && server.homebrew[m[1]]) {
      const list = server.homebrew[m[1]].filter(e => e.slug !== m![2])
      server.homebrew[m[1]] = method === 'PUT' ? [...list, { ...body(), slug: m[2] }] : list
      return reply({ ok: true })
    }
    if (pathname === '/api/settings/network') return reply({ lan: false, running: false, addresses: [] })
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
