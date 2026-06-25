import express from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CHARS_DIR = path.join(__dirname, 'characters')
const HOMEBREW_DIR = path.join(__dirname, 'homebrew')
const CATEGORIES = ['spells', 'items', 'feats', 'races', 'classes'] as const
type HBCategory = typeof CATEGORIES[number]

fs.mkdirSync(CHARS_DIR, { recursive: true })
for (const cat of CATEGORIES) fs.mkdirSync(path.join(HOMEBREW_DIR, cat), { recursive: true })

const app = express()
app.use(cors({ origin: ['http://localhost:5173', 'http://127.0.0.1:5173'] }))
app.use(express.json({ limit: '4mb' }))

// ── Characters ──────────────────────────────────────────────────────────────

function charFilename(char: { name: string; id: string }): string {
  return `${char.name.replace(/[^a-z0-9]/gi, '_')}_${char.id.slice(0, 8)}.json`
}

function findFileById(id: string): string | null {
  const files = fs.readdirSync(CHARS_DIR).filter(f => f.endsWith('.json'))
  return files.find(f => f.includes(id.slice(0, 8))) ?? null
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

app.put('/api/characters/:id', (req, res) => {
  const char = req.body
  if (!char?.id) { res.status(400).json({ error: 'missing id' }); return }

  const existing = findFileById(char.id)
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
  if (file) fs.unlinkSync(path.join(CHARS_DIR, file))
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
  })
})

// PUT a single entry — homebrew/spells/locate-wikidot.json
app.put('/api/homebrew/:category/:slug', (req, res) => {
  const { category, slug } = req.params
  if (!CATEGORIES.includes(category as HBCategory)) {
    res.status(400).json({ error: 'unknown category' }); return
  }
  const file = path.join(HOMEBREW_DIR, category, `${slug}.json`)
  fs.writeFileSync(file, JSON.stringify(req.body, null, 2))
  res.json({ ok: true, file: `homebrew/${category}/${slug}.json` })
})

// DELETE a single entry
app.delete('/api/homebrew/:category/:slug', (req, res) => {
  const { category, slug } = req.params
  const file = path.join(HOMEBREW_DIR, category, `${slug}.json`)
  if (fs.existsSync(file)) fs.unlinkSync(file)
  res.json({ ok: true })
})

// ─────────────────────────────────────────────────────────────────────────────

const PORT = 5174
app.listen(PORT, '127.0.0.1', () => {
  console.log(`Character server → http://localhost:${PORT}`)
  console.log(`Characters  → ${CHARS_DIR}`)
  console.log(`Homebrew    → ${HOMEBREW_DIR}/`)
})
