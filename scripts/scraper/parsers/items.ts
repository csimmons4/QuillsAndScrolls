import * as cheerio from 'cheerio'
import { fetchPage } from '../fetcher.js'

const BASE = 'https://dnd5e.wikidot.com'
const SOURCE = { site: 'dnd5e.wikidot.com', license: 'CC BY-SA 3.0', url: '' }

// Index pages that actually exist on wikidot
const INDEX_PAGES = [
  '/wondrous-items',
  '/armor',
  '/weapons',
  '/adventuring-gear',
]

function pageTitle($: cheerio.CheerioAPI): string {
  return $('.page-title span, .page-title').first().text().trim()
    || $('h1').first().text().replace(/- DND 5th Edition/i, '').trim()
}

async function enumerateItemUrls(force: boolean): Promise<string[]> {
  const urls: string[] = []
  const seen = new Set<string>()

  for (const page of INDEX_PAGES) {
    try {
      const html = await fetchPage(`${BASE}${page}`, force)
      const $ = cheerio.load(html)
      $('a[href]').each((_, el) => {
        const href = $(el).attr('href') ?? ''
        // Accept wondrous-items:slug and magic-items:something:slug patterns
        if (
          (href.startsWith('/wondrous-items:') ||
           href.startsWith('/magic-items:') ||
           href.startsWith('/armor:') ||
           href.startsWith('/weapons:') ||
           href.startsWith('/adventuring-gear:')) &&
          href.split(':').length >= 2 &&
          !seen.has(href)
        ) {
          seen.add(href)
          urls.push(`${BASE}${href}`)
        }
      })
    } catch (err) {
      console.warn(`  WARN: could not fetch index ${page}: ${err}`)
    }
  }
  return urls
}

async function parseItem(url: string, force: boolean): Promise<Record<string, unknown> | null> {
  try {
    const html = await fetchPage(url, force)
    const $ = cheerio.load(html)
    const content = $('#page-content')

    const name = pageTitle($) || content.find('strong').first().text().trim()
    if (!name || name.toLowerCase().includes('does not exist')) return null

    const text = content.text()

    let rarity = 'Common'
    for (const r of ['Artifact', 'Legendary', 'Very Rare', 'Rare', 'Uncommon', 'Common']) {
      if (text.toLowerCase().includes(r.toLowerCase())) { rarity = r; break }
    }

    const attunement = /requires attunement/i.test(text)

    let type = 'Wondrous Item'
    if (url.includes('/armor:')) type = 'Armor'
    else if (url.includes('/weapons:')) type = 'Weapon'
    else if (url.includes('/adventuring-gear:')) type = 'Adventuring Gear'
    else if (url.includes('/magic-items:armor')) type = 'Armor'
    else if (url.includes('/magic-items:weapon')) type = 'Weapon'
    else if (/potion/i.test(name)) type = 'Potion'
    else if (/ring/i.test(name) && !url.includes('ring of')) type = 'Ring'

    const slugPart = url.split(':').pop() ?? ''

    // Strip page metadata: "Source: [book] [Type], [rarity] [(requires attunement)] <description>"
    // Strategy: find the first rarity word (which always appears in the header) and take everything after it.
    let description = text.replace(/\s+/g, ' ').trim()
    const stripped = description.replace(
      /^.*?(?:common|uncommon|rare|very rare|legendary|artifact|rarity varies|unique|unknown rarity|\?\?\?)\s*(?:\([^)]*\))?\s*/i,
      ''
    )
    // Only accept the strip if it actually shortened the string and left some content
    if (stripped.length >= 5 && stripped.length < description.length - 10) {
      description = stripped
    }
    description = description.slice(0, 3500)

    return { slug: slugPart, name, type, rarity, attunement, description, source: { ...SOURCE, url } }
  } catch (err) {
    console.warn(`  WARN: failed to parse ${url}: ${err}`)
    return null
  }
}

export async function scrapeItems(force: boolean): Promise<{ results: unknown[]; failures: string[] }> {
  console.log('  Enumerating item URLs...')
  const urls = await enumerateItemUrls(force)
  console.log(`  Found ${urls.length} items`)
  const results: unknown[] = []
  const failures: string[] = []
  for (const url of urls) {
    const item = await parseItem(url, force)
    if (item) results.push(item)
    else failures.push(url)
  }
  return { results, failures }
}
