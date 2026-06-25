import * as cheerio from 'cheerio'
import { fetchPage } from '../fetcher.js'

const BASE = 'https://dnd5e.wikidot.com'
const SOURCE = { site: 'dnd5e.wikidot.com', license: 'CC BY-SA 3.0', url: '' }

// Backgrounds grouped by source book. The key becomes the `book` field in the output.
const BACKGROUND_SOURCES: { book: string; urls: string[] }[] = [
  {
    book: "Player's Handbook",
    urls: [
      '/background:acolyte', '/background:charlatan', '/background:criminal',
      '/background:entertainer', '/background:folk-hero', '/background:guild-artisan',
      '/background:hermit', '/background:noble', '/background:outlander',
      '/background:sage', '/background:sailor', '/background:soldier', '/background:urchin',
    ],
  },
  {
    book: "Sword Coast Adventurer's Guide",
    urls: [
      '/background:city-watch', '/background:clan-crafter', '/background:cloistered-scholar',
      '/background:courtier', '/background:faction-agent', '/background:far-traveler',
      '/background:inheritor', '/background:knight-of-the-order', '/background:mercenary-veteran',
      '/background:urban-bounty-hunter', '/background:uthgardt-tribe-member', '/background:waterdhavian-noble',
    ],
  },
  {
    book: "Strixhaven: A Curriculum of Chaos",
    urls: [
      '/background:lorehold-student', '/background:prismari-student', '/background:quandrix-student',
      '/background:silverquill-student', '/background:witherbloom-student',
    ],
  },
  {
    book: "Guildmasters' Guide to Ravnica",
    urls: [
      '/background:azorius-functionary', '/background:boros-legionnaire', '/background:dimir-operative',
      '/background:golgari-agent', '/background:gruul-anarch', '/background:izzet-engineer',
      '/background:orzhov-representative', '/background:rakdos-cultist', '/background:selesnya-initiate',
      '/background:simic-scientist',
    ],
  },
  {
    book: "The Wild Beyond the Witchlight",
    urls: [
      '/background:feylost', '/background:witchlight-hand', '/background:ruined',
    ],
  },
  {
    book: "Ghosts of Saltmarsh",
    urls: [
      '/background:fisher', '/background:marine', '/background:shipwright', '/background:smuggler',
    ],
  },
  {
    book: "Explorer's Guide to Wildemount",
    urls: [
      '/background:grinner', '/background:volstrucker-agent',
    ],
  },
  {
    book: "Mythic Odysseys of Theros",
    urls: [
      '/background:athlete',
    ],
  },
  {
    book: "Eberron: Rising from the Last War",
    urls: [
      '/background:house-agent',
    ],
  },
  {
    book: "Tomb of Annihilation",
    urls: [
      '/background:anthropologist', '/background:archaeologist',
    ],
  },
  {
    book: "Curse of Strahd",
    urls: [
      '/background:haunted-one',
    ],
  },
  {
    book: "Baldur's Gate: Descent into Avernus",
    urls: [
      '/background:faceless',
    ],
  },
  {
    book: "Acquisitions Incorporated",
    urls: [
      '/background:celebrity-adventurers-scion', '/background:failed-merchant',
      '/background:gambler', '/background:plaintiff', '/background:rival-intern',
    ],
  },
  {
    book: "Spelljammer: Adventures in Space",
    urls: [
      '/background:astral-drifter', '/background:wildspacer',
    ],
  },
  {
    book: "Planescape: Adventures in the Multiverse",
    urls: [
      '/background:gate-warden', '/background:planar-philosopher', '/background:rewarded',
    ],
  },
  {
    book: "Dragonlance: Shadow of the Dragon Queen",
    urls: [
      '/background:knight-of-solamnia', '/background:mage-of-high-sorcery',
    ],
  },
  {
    book: "Other",
    urls: [
      '/background:investigator',
    ],
  },
]

const SKILL_MAP: Record<string, string> = {
  'acrobatics': 'acrobatics', 'animal handling': 'animalHandling', 'arcana': 'arcana',
  'athletics': 'athletics', 'deception': 'deception', 'history': 'history',
  'insight': 'insight', 'intimidation': 'intimidation', 'investigation': 'investigation',
  'medicine': 'medicine', 'nature': 'nature', 'perception': 'perception',
  'performance': 'performance', 'persuasion': 'persuasion', 'religion': 'religion',
  'sleight of hand': 'sleightOfHand', 'stealth': 'stealth', 'survival': 'survival',
}

function pageTitle($: cheerio.CheerioAPI): string {
  return $('.page-title span, .page-title').first().text().trim()
    || $('h1').first().text().replace(/- DND 5th Edition/i, '').trim()
}

async function parseBackground(url: string, book: string, force: boolean): Promise<Record<string, unknown> | null> {
  try {
    const html = await fetchPage(`${BASE}${url}`, force)
    const $ = cheerio.load(html)
    const content = $('#page-content')
    const rawName = pageTitle($)
    if (!rawName) return null
    const name = rawName.replace(/^background:\s*/i, '').trim()
    const text = content.text()
    const slug = url.split('/background:')[1]

    const skillMatch = text.match(/skill proficiencies?:([^\n.]+)/i)
    const skillProficiencies: string[] = []
    if (skillMatch) {
      skillMatch[1].split(/,|and/).forEach(s => {
        const key = SKILL_MAP[s.trim().toLowerCase()]
        if (key) skillProficiencies.push(key)
      })
    }

    const toolMatch = text.match(/tool proficiencies?:([^\n.]+)/i)
    const toolProficiencies: string[] = toolMatch
      ? toolMatch[1].split(',').map(s => s.trim()).filter(s => s.length > 1 && s.length < 60).slice(0, 4)
      : []

    const langMatch = text.match(/languages?:([^\n.]+)/i)
    const languageCount = langMatch
      ? (langMatch[1].toLowerCase().includes('two') || langMatch[1].includes('2') ? 2 : 1)
      : 0

    const equipSection = text.match(/equipment:([^\n]+(?:\n(?!\n)[^\n]+)*)/i)
    const startingEquipment: string[] = equipSection
      ? equipSection[1].split(/[,•]/).map(s => s.trim()).filter(s => s.length > 2 && s.length < 80).slice(0, 8)
      : []

    let featureName = ''
    let featureDesc = ''
    content.find('h2, strong').each((_, el) => {
      const t = $(el).text().trim()
      if (/^feature:/i.test(t) && !featureName) {
        featureName = t.replace(/^feature:\s*/i, '')
        let desc = ''
        let next = $(el).next()
        while (next.length && !next.is('h2, h3')) {
          desc += next.text() + ' '
          next = next.next()
        }
        featureDesc = desc.trim().slice(0, 500)
      }
    })

    return {
      slug,
      name,
      book,
      skillProficiencies,
      toolProficiencies,
      languages: languageCount,
      startingEquipment,
      feature: { name: featureName || `${name} Feature`, description: featureDesc || '' },
      personalityTraits: [],
      ideals: [],
      bonds: [],
      flaws: [],
      source: { ...SOURCE, url: `${BASE}${url}` },
    }
  } catch (err) {
    console.warn(`  WARN: failed to parse background ${url}: ${err}`)
    return null
  }
}

export async function scrapeBackgrounds(force: boolean): Promise<{ results: unknown[]; failures: string[] }> {
  const total = BACKGROUND_SOURCES.reduce((n, g) => n + g.urls.length, 0)
  console.log(`  Scraping ${total} backgrounds across ${BACKGROUND_SOURCES.length} source books...`)
  const results: unknown[] = []
  const failures: string[] = []
  for (const { book, urls } of BACKGROUND_SOURCES) {
    for (const url of urls) {
      const bg = await parseBackground(url, book, force)
      if (bg) results.push(bg)
      else failures.push(url)
    }
  }
  return { results, failures }
}
