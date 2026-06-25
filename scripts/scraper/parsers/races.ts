import * as cheerio from 'cheerio'
import { fetchPage } from '../fetcher.js'

const BASE = 'https://dnd5e.wikidot.com'
const SOURCE = { site: 'dnd5e.wikidot.com', license: 'CC BY-SA 3.0', url: '' }

// Full list from https://dnd5e.wikidot.com/lineage
const RACE_URLS = [
  // Standard
  '/lineage:dragonborn', '/lineage:dwarf', '/lineage:elf', '/lineage:gnome',
  '/lineage:half-elf', '/lineage:half-orc', '/lineage:halfling', '/lineage:human', '/lineage:tiefling',
  // Exotic
  '/lineage:aarakocra', '/lineage:aasimar', '/lineage:changeling', '/lineage:deep-gnome',
  '/lineage:duergar', '/lineage:eladrin', '/lineage:fairy', '/lineage:firbolg',
  '/lineage:genasi-air', '/lineage:genasi-earth', '/lineage:genasi-fire', '/lineage:genasi-water',
  '/lineage:githyanki', '/lineage:githzerai', '/lineage:goliath', '/lineage:harengon',
  '/lineage:kenku', '/lineage:locathah', '/lineage:owlin', '/lineage:satyr',
  '/lineage:sea-elf', '/lineage:shadar-kai', '/lineage:tabaxi', '/lineage:tortle',
  '/lineage:triton', '/lineage:verdan',
  // Monstrous
  '/lineage:bugbear', '/lineage:centaur', '/lineage:goblin', '/lineage:hobgoblin',
  '/lineage:kobold', '/lineage:lizardfolk', '/lineage:minotaur', '/lineage:orc',
  '/lineage:shifter', '/lineage:yuan-ti',
  // Setting-specific
  '/lineage:kalashtar', '/lineage:warforged', '/lineage:dhampir', '/lineage:hexblood', '/lineage:reborn',
  '/lineage:loxodon', '/lineage:simic-hybrid', '/lineage:vedalken',
  '/lineage:autognome', '/lineage:giff', '/lineage:hadozee', '/lineage:plasmoid', '/lineage:thri-kreen',
  '/lineage:leonin', '/lineage:kender',
]

const ABILITY_MAP: Record<string, string> = {
  strength: 'str', dexterity: 'dex', constitution: 'con',
  intelligence: 'int', wisdom: 'wis', charisma: 'cha',
  str: 'str', dex: 'dex', con: 'con', int: 'int', wis: 'wis', cha: 'cha',
}

function pageTitle($: cheerio.CheerioAPI): string {
  return $('.page-title span, .page-title').first().text().trim()
    || $('h1').first().text().replace(/- DND 5th Edition/i, '').trim()
}

async function parseRace(url: string, force: boolean): Promise<Record<string, unknown> | null> {
  try {
    const html = await fetchPage(`${BASE}${url}`, force)
    const $ = cheerio.load(html)
    const content = $('#page-content')
    const name = pageTitle($)
    if (!name) return null
    const text = content.text()
    const slug = url.split('/lineage:')[1] ?? url.split('/').pop() ?? ''

    const abilityBonuses: Record<string, number> = {}
    const bonusRegex = /([+\-]\d+)\s+(?:to\s+)?([A-Za-z]+(?:\s+[A-Za-z]+)?)\s*(?:score)?/g
    let m
    while ((m = bonusRegex.exec(text)) !== null) {
      const bonus = parseInt(m[1], 10)
      const abilityRaw = m[2].toLowerCase().trim()
      const abilityKey = ABILITY_MAP[abilityRaw]
      if (abilityKey && Math.abs(bonus) <= 4) {
        abilityBonuses[abilityKey] = bonus
      }
    }

    const speedMatch = text.match(/(\d+)\s*feet?\s*(?:per\s*round|walking|speed|base)/i) || text.match(/speed[:\s]+(\d+)/i)
    const speed = speedMatch ? parseInt(speedMatch[1], 10) : 30

    const sizeMatch = text.match(/\b(Tiny|Small|Medium|Large|Huge|Gargantuan)\b/i)
    const size = sizeMatch ? sizeMatch[1] : 'Medium'

    const traits: string[] = []
    content.find('strong, h2, h3').each((_, el) => {
      const t = $(el).text().trim()
      if (t && t.length > 2 && t.length < 60 && !/^(source|age|size|speed|languages|subraces?|player.s handbook)/i.test(t)) {
        traits.push(t)
      }
    })

    const langMatch = text.match(/languages[:\s]+([^\n.]+)/i)
    const languages: string[] = langMatch
      ? langMatch[1].split(/,|and/).map(l => l.trim()).filter(Boolean).slice(0, 6)
      : ['Common']

    return {
      slug,
      name,
      abilityBonuses,
      size,
      speed,
      traits: [...new Set(traits)].slice(0, 15),
      languages,
      proficiencies: [],
      subraces: [],
      source: { ...SOURCE, url: `${BASE}${url}` },
    }
  } catch (err) {
    console.warn(`  WARN: failed to parse race ${url}: ${err}`)
    return null
  }
}

export async function scrapeRaces(force: boolean): Promise<{ results: unknown[]; failures: string[] }> {
  console.log(`  Scraping ${RACE_URLS.length} races...`)
  const results: unknown[] = []
  const failures: string[] = []
  for (const url of RACE_URLS) {
    const race = await parseRace(url, force)
    if (race) results.push(race)
    else failures.push(url)
  }
  return { results, failures }
}
