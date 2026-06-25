import * as cheerio from 'cheerio'
import { fetchPage } from '../fetcher.js'

const BASE = 'https://dnd5e.wikidot.com'
const SOURCE = { site: 'dnd5e.wikidot.com', license: 'CC BY-SA 3.0', url: '' }

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

async function enumerateSpellUrls(force: boolean): Promise<string[]> {
  const html = await fetchPage(`${BASE}/spells`, force)
  const $ = cheerio.load(html)
  const urls: string[] = []
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? ''
    if (href.startsWith('/spell:')) {
      const full = `${BASE}${href}`
      if (!urls.includes(full)) urls.push(full)
    }
  })
  return urls
}

async function parseSpell(url: string, force: boolean): Promise<Record<string, unknown> | null> {
  try {
    const html = await fetchPage(url, force)
    const $ = cheerio.load(html)
    const content = $('#page-content')

    const name = $('.page-title span, .page-title').first().text().trim()
      || $('h1').first().text().replace(/- DND 5th Edition/i, '').trim()
      || content.find('strong').first().text().trim()
    if (!name) return null

    const text = content.text()
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean)

    let level = 0
    let school = ''
    let castingTime = ''
    let range = ''
    let components = ''
    let duration = ''
    let description = ''
    let higherLevels = ''
    const classes: string[] = []

    for (const line of lines) {
      const lower = line.toLowerCase()
      if (lower.startsWith('casting time:')) castingTime = line.replace(/casting time:/i, '').trim()
      else if (lower.startsWith('range:')) range = line.replace(/range:/i, '').trim()
      else if (lower.startsWith('components:')) components = line.replace(/components:/i, '').trim()
      else if (lower.startsWith('duration:')) duration = line.replace(/duration:/i, '').trim()
      else if (lower.startsWith('spell lists.') || lower.startsWith('spell list:')) {
        const rest = line.replace(/spell lists?[:.]*/i, '').trim()
        rest.split(',').forEach(c => {
          // Normalize: lowercase, strip "(Optional)"/"(Dunamancy)"/"(Graviturgy)" etc., skip "None"
          const raw = c.trim()
          const normalized = raw.toLowerCase().replace(/\s*\(.*?\)/g, '').trim()
          if (normalized && normalized !== 'none') classes.push(normalized)
        })
      }
    }

    const levelMatch = text.match(/(\d+)(?:st|nd|rd|th)[- ]level\s+(\w+)/i)
    if (levelMatch) {
      level = parseInt(levelMatch[1], 10)
      school = levelMatch[2]
    } else if (/cantrip/i.test(text)) {
      level = 0
      const schoolMatch = text.match(/(\w+)\s+cantrip/i)
      if (schoolMatch) school = schoolMatch[1]
    }
    // Normalize school to Title Case
    if (school) school = school.charAt(0).toUpperCase() + school.slice(1).toLowerCase()

    const descStart = text.indexOf(duration)
    if (descStart > -1) {
      const rest = text.slice(descStart + duration.length).trim()
      const higherIdx = rest.toLowerCase().indexOf('at higher levels')
      if (higherIdx > -1) {
        description = rest.slice(0, higherIdx).trim()
        higherLevels = rest.slice(higherIdx).trim()
      } else {
        description = rest.trim()
      }
    }

    return {
      slug: url.split('/spell:')[1],
      name,
      level,
      school,
      castingTime,
      range,
      components,
      duration,
      description: description.replace(/\s*Spell Lists?\..*$/is, '').trim().slice(0, 5000),
      higherLevels: higherLevels.slice(0, 1000) || undefined,
      classes,
      source: { ...SOURCE, url },
    }
  } catch (err) {
    console.warn(`  WARN: failed to parse ${url}: ${err}`)
    return null
  }
}

export async function scrapeSpells(force: boolean): Promise<{ results: unknown[]; failures: string[] }> {
  console.log('  Enumerating spell URLs...')
  const urls = await enumerateSpellUrls(force)
  console.log(`  Found ${urls.length} spells`)
  const results: unknown[] = []
  const failures: string[] = []
  for (const url of urls) {
    const spell = await parseSpell(url, force)
    if (spell) results.push(spell)
    else failures.push(url)
  }
  return { results, failures }
}
