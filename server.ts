import express from 'express'
import cors from 'cors'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// QS_DATA_DIR / QS_API_PORT let a second copy run against a throwaway folder (tests, trying things)
const DATA_DIR = process.env.QS_DATA_DIR ? path.resolve(process.env.QS_DATA_DIR) : __dirname
const CHARS_DIR = path.join(DATA_DIR, 'characters')
const HOMEBREW_DIR = path.join(DATA_DIR, 'homebrew')
const CATEGORIES = ['spells', 'items', 'feats', 'races', 'classes', 'backgrounds'] as const
type HBCategory = typeof CATEGORIES[number]

fs.mkdirSync(CHARS_DIR, { recursive: true })
for (const cat of CATEGORIES) fs.mkdirSync(path.join(HOMEBREW_DIR, cat), { recursive: true })

const app = express()
app.use(cors({ origin: [/^http:\/\/localhost:\d+$/, /^http:\/\/127\.0\.0\.1:\d+$/] }))
app.use(express.json({ limit: '4mb' }))

// ── Characters ──────────────────────────────────────────────────────────────

// Ids and homebrew slugs become file names, so anything else (a "../", an empty name) is refused:
// with phone access on, other devices on the Wi-Fi can reach these routes too
const isId = (id: unknown): id is string => typeof id === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(id)
const isSlug = (slug: unknown): slug is string => typeof slug === 'string' && /^[A-Za-z0-9-]{1,120}$/.test(slug)

function charFilename(char: { name: string; id: string }): string {
  return `${String(char.name ?? '').replace(/[^a-z0-9]/gi, '_')}_${char.id.slice(0, 8)}.json`
}

/** The file holding a character: names end in "_<first 8 characters of the id>.json" */
function findFileById(id: string): string | null {
  if (!isId(id)) return null
  const suffix = `_${id.slice(0, 8)}.json`
  return fs.readdirSync(CHARS_DIR).find(f => f.endsWith(suffix)) ?? null
}

app.get('/api/characters', (_req, res) => {
  const files = fs.readdirSync(CHARS_DIR).filter(f => f.endsWith('.json'))
  const characters = files.flatMap(f => {
    try {
      return [JSON.parse(fs.readFileSync(path.join(CHARS_DIR, f), 'utf-8'))]
    } catch {
      console.warn(`Could not parse ${f} — skipping`)
      return []
    }
  })
  res.json(characters)
})

// ── Character history ────────────────────────────────────────────────────────
// Snapshots live in characters/.history/<id>/<stamp>.json: one automatically when a save comes in
// more than 30 minutes after the last snapshot (so every sitting has a starting point to go back
// to), one on request (Level Up takes one first), and the version being replaced whenever a
// snapshot is restored. The newest 40 are kept. Deleting a character takes a "Deleted" snapshot
// first and keeps the history, so the Vault's Recently deleted can bring it back.
const HISTORY_DIR = path.join(CHARS_DIR, '.history')
const SNAPSHOT_GAP_MS = 30 * 60 * 1000
const MAX_SNAPSHOTS = 40

const historyDir = (id: string) => {
  if (!isId(id)) throw new Error(`not a character id: ${id}`)
  return path.join(HISTORY_DIR, id)
}
const snapshotFiles = (id: string) => {
  if (!isId(id)) return []
  const dir = historyDir(id)
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort().reverse() : []
}

function takeSnapshot(id: string, label: string): boolean {
  const file = findFileById(id)
  if (!file) return false
  const character = JSON.parse(fs.readFileSync(path.join(CHARS_DIR, file), 'utf-8'))
  const dir = historyDir(id)
  fs.mkdirSync(dir, { recursive: true })
  const savedAt = new Date().toISOString()
  fs.writeFileSync(path.join(dir, `${savedAt.replace(/[:.]/g, '-')}.json`), JSON.stringify({ label, savedAt, character }))
  for (const old of snapshotFiles(id).slice(MAX_SNAPSHOTS)) fs.unlinkSync(path.join(dir, old))
  return true
}

function lastSnapshotAge(id: string): number {
  const newest = snapshotFiles(id)[0]
  return newest ? Date.now() - fs.statSync(path.join(historyDir(id), newest)).mtimeMs : Infinity
}

// Every route with an :id refuses one that isn't a character id
app.param('id', (req, res, next, id) => {
  if (isId(id)) next(); else res.status(400).json({ error: 'not a character id' })
})

app.get('/api/characters/:id/history', (req, res) => {
  const dir = historyDir(req.params.id)
  res.json(snapshotFiles(req.params.id).flatMap(f => {
    try {
      const snap = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8'))
      const c = snap.character ?? {}
      return [{
        stamp: f.replace(/\.json$/, ''), label: snap.label, savedAt: snap.savedAt, name: c.name,
        level: (c.classes ?? []).reduce((n: number, cc: { level?: number }) => n + (cc.level ?? 0), 0),
        hp: c.hp?.current,
      }]
    } catch { return [] }
  }))
})

app.get('/api/characters/:id/history/:stamp', (req, res) => {
  const file = path.join(historyDir(req.params.id), `${req.params.stamp.replace(/[^a-zA-Z0-9-]/g, '')}.json`)
  if (!fs.existsSync(file)) { res.status(404).json({ error: 'no such snapshot' }); return }
  res.json(JSON.parse(fs.readFileSync(file, 'utf-8')))
})

// Restoring a backup: add a snapshot only if there isn't one by that name already (never overwrites)
app.put('/api/characters/:id/history/:stamp', (req, res) => {
  const stamp = req.params.stamp.replace(/[^a-zA-Z0-9-]/g, '')
  const dir = historyDir(req.params.id)
  const file = path.join(dir, `${stamp}.json`)
  if (!stamp || !req.body?.character) { res.status(400).json({ error: 'not a snapshot' }); return }
  if (fs.existsSync(file)) { res.json({ added: false }); return }
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(file, JSON.stringify(req.body))
  for (const old of snapshotFiles(req.params.id).slice(MAX_SNAPSHOTS)) fs.unlinkSync(path.join(dir, old))
  res.json({ added: fs.existsSync(file) })   // an old one may fall outside the newest 40 straight away
})

app.post('/api/characters/:id/history', (req, res) => {
  const ok = takeSnapshot(req.params.id, String(req.body?.label ?? 'Saved by hand').slice(0, 80))
  res.json({ ok })
})

app.put('/api/characters/:id', (req, res) => {
  const char = req.body
  if (!isId(char?.id) || char.id !== req.params.id) { res.status(400).json({ error: 'missing or mismatched id' }); return }

  const existing = findFileById(char.id)
  // The first save of a new sitting keeps the version it replaces
  if (existing && lastSnapshotAge(char.id) > SNAPSHOT_GAP_MS) takeSnapshot(char.id, 'Start of a session')
  if (existing) {
    const newName = charFilename(char)
    if (existing !== newName) fs.unlinkSync(path.join(CHARS_DIR, existing))
  }

  const filename = charFilename(char)
  fs.writeFileSync(path.join(CHARS_DIR, filename), JSON.stringify(char, null, 2))
  res.json({ ok: true, filename })
})

app.delete('/api/characters/:id', (req, res) => {
  const file = findFileById(req.params.id)
  if (file) {
    takeSnapshot(req.params.id, 'Deleted')
    fs.unlinkSync(path.join(CHARS_DIR, file))
  }
  res.json({ ok: true })
})

// Every snapshot of every character (deleted ones too), for the backup zip: { id: { file: snapshot } }
app.get('/api/history', (_req, res) => {
  const ids = fs.existsSync(HISTORY_DIR) ? fs.readdirSync(HISTORY_DIR).filter(isId) : []
  res.json(Object.fromEntries(ids.map(id => [id, Object.fromEntries(snapshotFiles(id).flatMap(f => {
    try { return [[f, JSON.parse(fs.readFileSync(path.join(historyDir(id), f), 'utf-8'))]] } catch { return [] }
  }))])))
})

// Recently deleted: characters with history but no file, newest snapshot first
app.get('/api/deleted', (_req, res) => {
  const ids = fs.existsSync(HISTORY_DIR) ? fs.readdirSync(HISTORY_DIR).filter(id => isId(id) && !findFileById(id)) : []
  const deleted = ids.flatMap(id => {
    const newest = snapshotFiles(id)[0]
    if (!newest) return []
    try {
      const snap = JSON.parse(fs.readFileSync(path.join(historyDir(id), newest), 'utf-8'))
      const c = snap.character ?? {}
      return [{
        id, stamp: newest.replace(/\.json$/, ''), label: snap.label, savedAt: snap.savedAt, name: c.name,
        level: (c.classes ?? []).reduce((n: number, cc: { level?: number }) => n + (cc.level ?? 0), 0),
      }]
    } catch { return [] }
  })
  res.json(deleted.sort((a, b) => b.savedAt.localeCompare(a.savedAt)))
})

// Delete forever: only for a character that's really gone (its history is all that's left)
app.delete('/api/deleted/:id', (req, res) => {
  if (findFileById(req.params.id)) { res.status(409).json({ error: 'character still exists' }); return }
  fs.rmSync(historyDir(req.params.id), { recursive: true, force: true })
  res.json({ ok: true })
})

// ── Homebrew ─────────────────────────────────────────────────────────────────

function readCategory(cat: HBCategory): unknown[] {
  const dir = path.join(HOMEBREW_DIR, cat)
  return fs.readdirSync(dir).filter(f => f.endsWith('.json')).flatMap(f => {
    try { return [JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8'))] }
    catch { console.warn(`Could not parse homebrew/${cat}/${f}`); return [] }
  })
}

// GET all homebrew merged into one store object
app.get('/api/homebrew', (_req, res) => {
  res.json({
    spells:   readCategory('spells'),
    items:    readCategory('items'),
    feats:    readCategory('feats'),
    races:    readCategory('races'),
    classes:  readCategory('classes'),
    backgrounds: readCategory('backgrounds'),
  })
})

// PUT a single entry — homebrew/spells/locate-wikidot.json
app.put('/api/homebrew/:category/:slug', (req, res) => {
  const { category, slug } = req.params
  if (!CATEGORIES.includes(category as HBCategory) || !isSlug(slug)) {
    res.status(400).json({ error: 'unknown category or bad id' }); return
  }
  const file = path.join(HOMEBREW_DIR, category, `${slug}.json`)
  fs.writeFileSync(file, JSON.stringify(req.body, null, 2))
  res.json({ ok: true, file: `homebrew/${category}/${slug}.json` })
})

// DELETE a single entry
app.delete('/api/homebrew/:category/:slug', (req, res) => {
  const { category, slug } = req.params
  if (!CATEGORIES.includes(category as HBCategory) || !isSlug(slug)) {
    res.status(400).json({ error: 'unknown category or bad id' }); return
  }
  const file = path.join(HOMEBREW_DIR, category, `${slug}.json`)
  if (fs.existsSync(file)) fs.unlinkSync(file)
  res.json({ ok: true })
})

// ── Phones and tablets on your Wi-Fi ─────────────────────────────────────────
// Off unless switched on in Settings. The choice is kept in .local-settings.json, which vite.config.ts
// reads when the app starts (so it takes a restart). This server stays local-only either way: other
// devices reach it through Vite's /api proxy.

const LOCAL_SETTINGS = path.join(DATA_DIR, '.local-settings.json')

function readLocalSettings(): { lan?: boolean } {
  try { return JSON.parse(fs.readFileSync(LOCAL_SETTINGS, 'utf8')) } catch { return {} }
}

/** This computer's addresses on the local network (what a phone would type) */
function lanAddresses(): string[] {
  return Object.values(os.networkInterfaces()).flat()
    .filter((a): a is os.NetworkInterfaceInfo => !!a && !a.internal && (String(a.family) === 'IPv4' || String(a.family) === '4'))
    .map(a => a.address)
    .filter(a => !a.startsWith('169.254.'))
}

app.get('/api/settings/network', (_req, res) => {
  res.json({ lan: !!readLocalSettings().lan, addresses: lanAddresses() })
})

app.put('/api/settings/network', (req, res) => {
  const next = { ...readLocalSettings(), lan: !!req.body?.lan }
  fs.writeFileSync(LOCAL_SETTINGS, JSON.stringify(next, null, 2))
  res.json({ lan: next.lan, addresses: lanAddresses() })
})

// ─────────────────────────────────────────────────────────────────────────────

const PORT = Number(process.env.QS_API_PORT) || 5174
app.listen(PORT, '127.0.0.1', () => {
  console.log(`Character server → http://localhost:${PORT}`)
  console.log(`Characters  → ${CHARS_DIR}`)
  console.log(`Homebrew    → ${HOMEBREW_DIR}/`)
})
