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

/** Split on commas outside parentheses: "a trophy (a dagger, broken blade), a quill" → 2 parts. */
function splitTopLevel(s: string): string[] {
  const parts: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of s) {
    if (ch === '(') depth++
    else if (ch === ')') depth = Math.max(0, depth - 1)
    if (ch === ',' && depth === 0) { parts.push(cur); cur = '' }
    else cur += ch
  }
  parts.push(cur)
  return parts
}

/**
 * The "Equipment:" line, read from the HTML: from its <strong> label to the next <br> or the
 * end of the paragraph. Item names carry hover tooltips
 * (<span class="hover">crowbar<span>Value:2gp Weight:5lbs</span></span>), which are dropped.
 */
function equipmentLine($: cheerio.CheerioAPI, content: cheerio.Cheerio<any>): string {
  const label = content.find('strong').filter((_, el) => /^equipment:?$/i.test($(el).text().trim())).first()
  if (!label.length) return ''
  const nodes = label.parent().contents().toArray()
  let text = ''
  for (const node of nodes.slice(nodes.indexOf(label[0]) + 1)) {
    if (node.type === 'tag' && node.name === 'br') break
    const $node = $(node).clone()
    if ($node.is('.hover')) $node.children('span').remove()
    $node.find('.hover').children('span').remove()
    text += $node.text()
  }
  return text.replace(/\s+/g, ' ').trim()
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
      skillMatch[1].split(/,|\band\b/).forEach(s => {
        const key = SKILL_MAP[s.trim().toLowerCase()]
        if (key) skillProficiencies.push(key)
      })
    }

    const toolMatch = text.match(/tool proficiencies?:([^\n.]+)/i)
    const toolProficiencies: string[] = toolMatch
      ? toolMatch[1].split(',').map(s => s.trim()).filter(s => s.length > 1 && s.length < 60).slice(0, 4)
      : []

    const langMatch = text.match(/languages?:([^\n.]+)/i)
    const langText = langMatch?.[1].toLowerCase() ?? ''
    const languageCount = !langMatch || /\bnone\b/.test(langText) ? 0
      : /\btwo\b|\b2\b/.test(langText) ? 2
      : 1

    // "A crowbar, a set of dark common clothes including a hood, and a pouch containing 15gp"
    // → ["A crowbar", "a set of dark common clothes including a hood", "a pouch"]
    // (the gold comes from backgroundOverlay's startingGold)
    const startingEquipment = splitTopLevel(equipmentLine($, content))
      .map(s => s.trim().replace(/^and\s+/i, '').replace(/\s+containing\s+\d+\s*gp\.?$/i, '').replace(/\.$/, '').trim())
      .filter(s => s.length > 2 && !/^\d+\s*(?:gp|sp|cp)$/i.test(s))

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
