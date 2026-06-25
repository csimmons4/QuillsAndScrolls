import * as cheerio from 'cheerio'
import { fetchPage } from '../fetcher.js'

const BASE = 'https://dnd5e.wikidot.com'
const SOURCE = { site: 'dnd5e.wikidot.com', license: 'CC BY-SA 3.0', url: '' }

const CLASSES = [
  { slug: 'artificer', hitDie: 8, spellcastingAbility: 'int', saveProficiencies: ['con', 'int'], armorProficiencies: ['light', 'medium', 'shields'], weaponProficiencies: ['simple'], toolProficiencies: ["Thieves' tools", 'Tinker\'s tools', 'One type of artisan\'s tools'], skillChoices: ['arcana', 'history', 'investigation', 'medicine', 'nature', 'perception', 'sleightOfHand'], numSkillChoices: 2 },
  { slug: 'barbarian', hitDie: 12, spellcastingAbility: undefined, saveProficiencies: ['str', 'con'], armorProficiencies: ['light', 'medium', 'shields'], weaponProficiencies: ['simple', 'martial'], toolProficiencies: [], skillChoices: ['animalHandling', 'athletics', 'intimidation', 'nature', 'perception', 'survival'], numSkillChoices: 2 },
  { slug: 'bard', hitDie: 8, spellcastingAbility: 'cha', saveProficiencies: ['dex', 'cha'], armorProficiencies: ['light'], weaponProficiencies: ['simple', 'hand crossbows', 'longswords', 'rapiers', 'shortswords'], toolProficiencies: ['Three musical instruments'], skillChoices: ['acrobatics', 'animalHandling', 'arcana', 'athletics', 'deception', 'history', 'insight', 'intimidation', 'investigation', 'medicine', 'nature', 'perception', 'performance', 'persuasion', 'religion', 'sleightOfHand', 'stealth', 'survival'], numSkillChoices: 3 },
  { slug: 'cleric', hitDie: 8, spellcastingAbility: 'wis', saveProficiencies: ['wis', 'cha'], armorProficiencies: ['light', 'medium', 'shields'], weaponProficiencies: ['simple'], toolProficiencies: [], skillChoices: ['history', 'insight', 'medicine', 'persuasion', 'religion'], numSkillChoices: 2 },
  { slug: 'druid', hitDie: 8, spellcastingAbility: 'wis', saveProficiencies: ['int', 'wis'], armorProficiencies: ['light', 'medium', 'shields (non-metal)'], weaponProficiencies: ['clubs', 'daggers', 'darts', 'javelins', 'maces', 'quarterstaffs', 'scimitars', 'sickles', 'slings', 'spears'], toolProficiencies: ["Herbalism kit"], skillChoices: ['arcana', 'animalHandling', 'insight', 'medicine', 'nature', 'perception', 'religion', 'survival'], numSkillChoices: 2 },
  { slug: 'fighter', hitDie: 10, spellcastingAbility: undefined, saveProficiencies: ['str', 'con'], armorProficiencies: ['all', 'shields'], weaponProficiencies: ['simple', 'martial'], toolProficiencies: [], skillChoices: ['acrobatics', 'animalHandling', 'athletics', 'history', 'insight', 'intimidation', 'perception', 'survival'], numSkillChoices: 2 },
  { slug: 'monk', hitDie: 8, spellcastingAbility: undefined, saveProficiencies: ['str', 'dex'], armorProficiencies: [], weaponProficiencies: ['simple', 'shortswords'], toolProficiencies: ["One type of artisan's tools or a musical instrument"], skillChoices: ['acrobatics', 'athletics', 'history', 'insight', 'religion', 'stealth'], numSkillChoices: 2 },
  { slug: 'paladin', hitDie: 10, spellcastingAbility: 'cha', saveProficiencies: ['wis', 'cha'], armorProficiencies: ['all', 'shields'], weaponProficiencies: ['simple', 'martial'], toolProficiencies: [], skillChoices: ['athletics', 'insight', 'intimidation', 'medicine', 'persuasion', 'religion'], numSkillChoices: 2 },
  { slug: 'ranger', hitDie: 10, spellcastingAbility: 'wis', saveProficiencies: ['str', 'dex'], armorProficiencies: ['light', 'medium', 'shields'], weaponProficiencies: ['simple', 'martial'], toolProficiencies: [], skillChoices: ['animalHandling', 'athletics', 'insight', 'investigation', 'nature', 'perception', 'stealth', 'survival'], numSkillChoices: 3 },
  { slug: 'rogue', hitDie: 8, spellcastingAbility: undefined, saveProficiencies: ['dex', 'int'], armorProficiencies: ['light'], weaponProficiencies: ['simple', 'hand crossbows', 'longswords', 'rapiers', 'shortswords'], toolProficiencies: ["Thieves' tools"], skillChoices: ['acrobatics', 'athletics', 'deception', 'insight', 'intimidation', 'investigation', 'perception', 'performance', 'persuasion', 'sleightOfHand', 'stealth'], numSkillChoices: 4 },
  { slug: 'sorcerer', hitDie: 6, spellcastingAbility: 'cha', saveProficiencies: ['con', 'cha'], armorProficiencies: [], weaponProficiencies: ['daggers', 'darts', 'slings', 'quarterstaffs', 'light crossbows'], toolProficiencies: [], skillChoices: ['arcana', 'deception', 'insight', 'intimidation', 'persuasion', 'religion'], numSkillChoices: 2 },
  { slug: 'warlock', hitDie: 8, spellcastingAbility: 'cha', saveProficiencies: ['wis', 'cha'], armorProficiencies: ['light'], weaponProficiencies: ['simple'], toolProficiencies: [], skillChoices: ['arcana', 'deception', 'history', 'intimidation', 'investigation', 'nature', 'religion'], numSkillChoices: 2 },
  { slug: 'wizard', hitDie: 6, spellcastingAbility: 'int', saveProficiencies: ['int', 'wis'], armorProficiencies: [], weaponProficiencies: ['daggers', 'darts', 'slings', 'quarterstaffs', 'light crossbows'], toolProficiencies: [], skillChoices: ['arcana', 'history', 'insight', 'investigation', 'medicine', 'religion'], numSkillChoices: 2 },
]

// Full spell slot tables (standard 9-level casters) per level 1-20
const FULL_CASTER_SLOTS: number[][] = [
  [2,0,0,0,0,0,0,0,0], [3,0,0,0,0,0,0,0,0], [4,2,0,0,0,0,0,0,0], [4,3,0,0,0,0,0,0,0],
  [4,3,2,0,0,0,0,0,0], [4,3,3,0,0,0,0,0,0], [4,3,3,1,0,0,0,0,0], [4,3,3,2,0,0,0,0,0],
  [4,3,3,3,1,0,0,0,0], [4,3,3,3,2,0,0,0,0], [4,3,3,3,2,1,0,0,0], [4,3,3,3,2,1,0,0,0],
  [4,3,3,3,2,1,1,0,0], [4,3,3,3,2,1,1,0,0], [4,3,3,3,2,1,1,1,0], [4,3,3,3,2,1,1,1,0],
  [4,3,3,3,2,1,1,1,1], [4,3,3,3,3,1,1,1,1], [4,3,3,3,3,2,1,1,1], [4,3,3,3,3,2,2,1,1],
]
const HALF_CASTER_SLOTS: number[][] = [
  [0], [2,0,0,0,0,0,0,0,0], [3,0,0,0,0,0,0,0,0], [3,0,0,0,0,0,0,0,0],
  [4,2,0,0,0,0,0,0,0], [4,2,0,0,0,0,0,0,0], [4,3,0,0,0,0,0,0,0], [4,3,0,0,0,0,0,0,0],
  [4,3,2,0,0,0,0,0,0], [4,3,2,0,0,0,0,0,0], [4,3,3,0,0,0,0,0,0], [4,3,3,0,0,0,0,0,0],
  [4,3,3,1,0,0,0,0,0], [4,3,3,1,0,0,0,0,0], [4,3,3,2,0,0,0,0,0], [4,3,3,2,0,0,0,0,0],
  [4,3,3,3,1,0,0,0,0], [4,3,3,3,1,0,0,0,0], [4,3,3,3,2,0,0,0,0], [4,3,3,3,2,0,0,0,0],
]
const FULL_CASTERS = new Set(['bard','cleric','druid','sorcerer','wizard'])
const HALF_CASTERS = new Set(['artificer','paladin','ranger'])

const CLASS_NAMES: Record<string, string> = {
  artificer: 'Artificer', barbarian: 'Barbarian', bard: 'Bard', cleric: 'Cleric',
  druid: 'Druid', fighter: 'Fighter', monk: 'Monk', paladin: 'Paladin',
  ranger: 'Ranger', rogue: 'Rogue', sorcerer: 'Sorcerer', warlock: 'Warlock', wizard: 'Wizard',
}

async function parseClassFeatures(slug: string, force: boolean): Promise<{ features: unknown[]; subclasses: unknown[]; startingEquipment: string[] }> {
  const url = `${BASE}/${slug}`
  const features: unknown[] = []
  const subclasses: unknown[] = []
  const startingEquipment: string[] = []
  try {
    const html = await fetchPage(url, force)
    const $ = cheerio.load(html)
    const content = $('#page-content')

    // Starting equipment
    const eqSection = content.text().match(/starting equipment[^\n]*([\s\S]*?)(?=class features|$)/i)
    if (eqSection) {
      eqSection[1].split(/[•\-\n]/).map(s => s.trim()).filter(s => s.length > 3 && s.length < 80).slice(0, 12).forEach(e => startingEquipment.push(e))
    }

    // Class features table from wikidot - look for level-based features
    content.find('h2, h3').each((_, el) => {
      const heading = $(el).text().trim()
      const levelMatch = heading.match(/level\s+(\d+)/i) || heading.match(/^(\d+)(?:st|nd|rd|th)\s+level/i)
      if (levelMatch) {
        const level = parseInt(levelMatch[1], 10)
        let desc = ''
        let next = $(el).next()
        while (next.length && !next.is('h2, h3')) {
          desc += next.text().trim() + ' '
          next = next.next()
        }
        features.push({ level, name: heading.replace(/level\s+\d+:?/i, '').replace(/\d+(?:st|nd|rd|th)\s+level:?/i, '').trim() || heading, description: desc.trim().slice(0, 500) })
      }
    })

    // Subclasses
    content.find('h2').each((_, el) => {
      const text = $(el).text().trim()
      if (/archetype|subclass|circle|oath|patron|college|way|domain|school|tradition|path|order|covenant/i.test(text)) {
        const subSlug = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
        subclasses.push({ slug: subSlug, name: text, features: [] })
      }
    })
  } catch (err) {
    console.warn(`  WARN: failed to parse class ${slug}: ${err}`)
  }
  return { features, subclasses, startingEquipment }
}

export async function scrapeClasses(force: boolean): Promise<{ results: unknown[]; failures: string[] }> {
  console.log(`  Scraping ${CLASSES.length} classes...`)
  const results: unknown[] = []
  const failures: string[] = []
  for (const cls of CLASSES) {
    try {
      const { features, subclasses, startingEquipment } = await parseClassFeatures(cls.slug, force)
      const spellSlotTable = FULL_CASTERS.has(cls.slug)
        ? FULL_CASTER_SLOTS
        : HALF_CASTERS.has(cls.slug)
          ? HALF_CASTER_SLOTS
          : undefined
      results.push({
        ...cls,
        name: CLASS_NAMES[cls.slug] ?? cls.slug,
        features,
        subclasses,
        startingEquipment,
        spellSlotTable,
        source: { ...SOURCE, url: `${BASE}/${cls.slug}` },
      })
    } catch (err) {
      console.warn(`  WARN: failed ${cls.slug}: ${err}`)
      failures.push(cls.slug)
    }
  }
  return { results, failures }
}
