#!/usr/bin/env node
import * as fs from 'fs'
import * as path from 'path'
import { scrapeSpells } from './parsers/spells.js'
import { scrapeItems } from './parsers/items.js'
import { scrapeRaces } from './parsers/races.js'
import { scrapeClasses } from './parsers/classes.js'
import { scrapeBackgrounds } from './parsers/backgrounds.js'
import { scrapeFeats } from './parsers/feats.js'

const OUT_DIR = path.resolve(import.meta.dirname, '../../public/data/wikidot')
fs.mkdirSync(OUT_DIR, { recursive: true })

const args = process.argv.slice(2)
const force = args.includes('--force')
const onlyArg = args.find(a => a.startsWith('--only=') || args[args.indexOf(a) - 1] === '--only')
const only: string[] = onlyArg
  ? (onlyArg.startsWith('--only=') ? onlyArg.slice(7) : onlyArg).split(',').map(s => s.trim())
  : []

const CATEGORIES = {
  spells: scrapeSpells,
  items: scrapeItems,
  races: scrapeRaces,
  classes: scrapeClasses,
  backgrounds: scrapeBackgrounds,
  feats: scrapeFeats,
}

function write(name: string, data: unknown[]) {
  const outPath = path.join(OUT_DIR, `${name}.json`)
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2))
  console.log(`  Wrote ${data.length} entries to ${outPath}`)
}

async function run() {
  console.log(`\nQuills & Scrolls — D&D 5e Data Scraper`)
  console.log(`Source: dnd5e.wikidot.com (CC BY-SA 3.0)`)
  console.log(`Options: force=${force} only=${only.length ? only.join(',') : 'all'}\n`)

  const counts: Record<string, number> = {}
  const allFailures: Record<string, string[]> = {}

  for (const [name, fn] of Object.entries(CATEGORIES)) {
    if (only.length && !only.includes(name)) {
      console.log(`Skipping ${name}`)
      continue
    }
    console.log(`Scraping ${name}...`)
    try {
      const { results, failures } = await fn(force)
      write(name, results)
      counts[name] = results.length
      if (failures.length) {
        allFailures[name] = failures
        console.log(`  ${failures.length} failures in ${name}`)
      }
    } catch (err) {
      console.error(`  ERROR scraping ${name}: ${err}`)
    }
  }

  // Write meta
  const meta = { scrapedAt: new Date().toISOString(), counts }
  fs.writeFileSync(path.join(OUT_DIR, 'meta.json'), JSON.stringify(meta, null, 2))

  console.log('\n=== Summary ===')
  for (const [name, count] of Object.entries(counts)) {
    console.log(`  ${name}: ${count} entries`)
  }
  if (Object.keys(allFailures).length) {
    console.log('\nFailures:')
    for (const [cat, urls] of Object.entries(allFailures)) {
      console.log(`  ${cat}: ${urls.length} failed (see warnings above)`)
    }
  }
  console.log('\nDone! Restart your dev server to pick up new data.\n')
}

run().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
