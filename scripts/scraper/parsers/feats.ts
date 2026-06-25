import * as cheerio from 'cheerio'
import { fetchPage } from '../fetcher.js'

const BASE = 'https://dnd5e.wikidot.com'
const SOURCE = { site: 'dnd5e.wikidot.com', license: 'CC BY-SA 3.0', url: '' }

// dnd5e.wikidot.com has no single feats index page — enumerate by known slugs.
// PHB feats
const PHB_FEATS = [
  'alert', 'actor', 'athlete', 'charger', 'crossbow-expert', 'defensive-duelist',
  'dungeon-delver', 'durable', 'elemental-adept', 'grappler', 'great-weapon-master',
  'healer', 'heavily-armored', 'heavy-armor-master', 'inspiring-leader', 'keen-mind',
  'lightly-armored', 'linguist', 'lucky', 'mage-slayer', 'magic-initiate', 'martial-adept',
  'medium-armor-master', 'mobile', 'moderately-armored', 'mounted-combatant', 'observant',
  'polearm-master', 'resilient', 'ritual-caster', 'savage-attacker', 'sentinel',
  'sharpshooter', 'shield-master', 'skilled', 'skulker', 'spell-sniper',
  'tavern-brawler', 'tough', 'war-caster', 'weapon-master',
]
// Xanathar's Guide to Everything
const XGTE_FEATS = [
  'bountiful-luck', 'dragon-fear', 'dragon-hide', 'drow-high-magic', 'dwarven-fortitude',
  'elven-accuracy', 'fade-away', 'fey-teleportation', 'flames-of-phlegethos',
  'infernal-constitution', 'orcish-fury', 'prodigy', 'second-chance', 'squat-nimbleness',
  'wood-elf-magic',
]
// Tasha's Cauldron of Everything
const TCOE_FEATS = [
  'artificer-initiate', 'chef', 'crusher', 'eldritch-adept', 'fey-touched',
  'fighting-initiate', 'gunner', 'metamagic-adept', 'piercer', 'poisoner',
  'shadow-touched', 'skill-expert', 'slasher', 'telekinetic', 'telepathic',
]

const ALL_FEAT_SLUGS = [...PHB_FEATS, ...XGTE_FEATS, ...TCOE_FEATS]

function pageTitle($: cheerio.CheerioAPI): string {
  return $('.page-title span, .page-title').first().text().trim()
    || $('h1').first().text().replace(/- DND 5th Edition/i, '').trim()
}

async function parseFeat(slug: string, force: boolean): Promise<Record<string, unknown> | null> {
  const url = `${BASE}/feat:${slug}`
  try {
    const html = await fetchPage(url, force)
    const $ = cheerio.load(html)
    const content = $('#page-content')
    const name = pageTitle($)
    if (!name || name.toLowerCase().includes('404') || name.toLowerCase().includes('does not exist')) return null
    const text = content.text()

    const prereqMatch = text.match(/prerequisite[s]?:([^\n.]+)/i)
    const prerequisite = prereqMatch ? prereqMatch[1].trim() : undefined

    const description = text.replace(/\s+/g, ' ').trim().slice(0, 1500)

    return { slug, name, prerequisite, description, source: { ...SOURCE, url } }
  } catch (err) {
    console.warn(`  WARN: failed to parse feat ${slug}: ${err}`)
    return null
  }
}

export async function scrapeFeats(force: boolean): Promise<{ results: unknown[]; failures: string[] }> {
  console.log(`  Scraping ${ALL_FEAT_SLUGS.length} feats...`)
  const results: unknown[] = []
  const failures: string[] = []
  for (const slug of ALL_FEAT_SLUGS) {
    const feat = await parseFeat(slug, force)
    if (feat) results.push(feat)
    else failures.push(slug)
  }
  return { results, failures }
}
