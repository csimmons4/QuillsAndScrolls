import { fetch } from 'undici'
import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'

const CACHE_DIR = path.resolve(import.meta.dirname, 'cache')
const DELAY_MS = 600
const USER_AGENT = 'QuillsScrolls/1.0 (DnD character app; educational; contact: personal project)'

fs.mkdirSync(CACHE_DIR, { recursive: true })

function cacheKey(url: string): string {
  return crypto.createHash('md5').update(url).digest('hex') + '.html'
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function fetchPage(url: string, force = false): Promise<string> {
  const keyFile = path.join(CACHE_DIR, cacheKey(url))
  if (!force && fs.existsSync(keyFile)) {
    return fs.readFileSync(keyFile, 'utf-8')
  }
  await sleep(DELAY_MS)
  const res = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  const html = await res.text()
  fs.writeFileSync(keyFile, html, 'utf-8')
  return html
}
