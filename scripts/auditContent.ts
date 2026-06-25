/**
 * Content enrichment audit. Compares scraped data + overlays against heuristics
 * that detect descriptions hinting at structured behavior the overlay doesn't yet
 * capture (e.g. feats whose prose mentions "learn two spells" but no `grantsSpells`).
 *
 * Run: `npm run audit:content`
 */
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SPELL_OVERLAY } from '../src/data/spellOverlay'
import { FEAT_OVERLAY } from '../src/data/featOverlay'
import { RACE_OVERLAY } from '../src/data/raceOverlay'
import { BACKGROUND_OVERLAY } from '../src/data/backgroundOverlay'
import { ITEM_OVERLAY } from '../src/data/itemOverlay'
import { CLASS_OPTIONS } from '../src/data/classData'
import { CLASS_STARTING_GEAR } from '../src/data/startingGear'
import { enrichSpell } from '../src/content/spellDerivation'
import { SpellSchema, RaceSchema, BackgroundSchema, type SpellDef } from '../src/content/loaders'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', 'public', 'data', 'wikidot')

interface ScrapedSpell {
  slug: string
  name: string
  duration?: string
  castingTime?: string
  description?: string
  components?: string
  classes?: string[]
}

interface ScrapedFeat {
  slug: string
  name: string
  description?: string
}

function loadJson<T>(name: string): T[] {
  try {
    const raw = readFileSync(join(DATA_DIR, `${name}.json`), 'utf8')
    return JSON.parse(raw) as T[]
  } catch {
    return []
  }
}

interface Finding {
  slug: string
  name: string
  trigger: string
}

function bullet(f: Finding): string {
  return `  - \`${f.slug}\` (${f.name}) — ${f.trigger}`
}

function section(title: string, total: number, gaps: Finding[]): string {
  const enriched = total - gaps.length
  const pct = total > 0 ? Math.round((enriched / total) * 100) : 0
  const head = `## ${title}\n\n**Total: ${total} | Enriched: ${enriched} (${pct}%) | Gaps: ${gaps.length}**\n`
  if (gaps.length === 0) return `${head}\n_All entries pass the audit heuristics._\n`
  return `${head}\n${gaps.map(bullet).join('\n')}\n`
}

// ── Feats audit ──────────────────────────────────────────────────────────────

const FEAT_SPELL_GRANT_RE = /\b(?:learn(?:s)?|gain(?:s)?)\s+(?:a |one |two |three |\d+\s+)?(?:cantrip|spell)/i
const FEAT_FROM_LIST_RE = /from the\s+(\w+)\s+(?:spell\s+)?list/i
const FEAT_ABILITY_RE = /increase\s+(?:your|one)\s+(?:ability score|[A-Z][a-z]+ score|.*?\bScore\b)/i

function auditFeats(): { total: number; gaps: Finding[] } {
  const feats = loadJson<ScrapedFeat>('feats')
  const gaps: Finding[] = []
  for (const feat of feats) {
    const overlay = FEAT_OVERLAY[feat.slug] ?? {}
    const desc = feat.description ?? ''

    if (!overlay.grantsSpells && (FEAT_SPELL_GRANT_RE.test(desc) || FEAT_FROM_LIST_RE.test(desc))) {
      const fromList = desc.match(FEAT_FROM_LIST_RE)
      const trigger = fromList
        ? `description mentions spell list (\`${fromList[1].toLowerCase()}\`); add \`grantsSpells\``
        : 'description mentions granted spell(s); add `grantsSpells`'
      gaps.push({ slug: feat.slug, name: feat.name, trigger })
      continue
    }

    if (!overlay.abilityScoreIncrease && FEAT_ABILITY_RE.test(desc)) {
      gaps.push({ slug: feat.slug, name: feat.name, trigger: 'description mentions ability score increase; add `abilityScoreIncrease`' })
      continue
    }
  }
  return { total: feats.length, gaps }
}

// ── Spells audit ─────────────────────────────────────────────────────────────

/** Apply the same enrichment the runtime does (derivation → overlay) so the
 *  audit only flags genuine remaining gaps. */
function enrichForAudit(raw: ScrapedSpell): SpellDef | null {
  const parsed = SpellSchema.safeParse(raw)
  if (!parsed.success) return null
  const derived = enrichSpell(parsed.data)
  return { ...derived, ...(SPELL_OVERLAY[raw.slug] ?? {}) }
}

function auditSpells(): { total: number; gaps: Finding[] } {
  const spells = loadJson<ScrapedSpell>('spells')
  const gaps: Finding[] = []
  for (const raw of spells) {
    const spell = enrichForAudit(raw)
    if (!spell) continue
    const duration = raw.duration ?? ''
    const castingTime = raw.castingTime ?? ''
    const desc = raw.description ?? ''

    if (/concentration/i.test(duration) && spell.concentration === undefined) {
      gaps.push({ slug: raw.slug, name: raw.name, trigger: `duration "${duration}" implies concentration; set \`concentration: true\`` })
      continue
    }

    if (/ritual/i.test(castingTime) && spell.ritual === undefined) {
      gaps.push({ slug: raw.slug, name: raw.name, trigger: `casting time "${castingTime}" implies ritual; set \`ritual: true\`` })
      continue
    }

    // Require both dice AND a "<type> damage" phrase (matches spellDerivation.ts).
    // Avoids false positives on spells that mention a damage type out of context
    // (e.g. heroes-feast "immune to poison damage", control-weather "Cold" climate).
    if (!spell.damage && /\b\d+d\d+\b/.test(desc) && /\b(acid|bludgeoning|cold|fire|force|lightning|necrotic|piercing|poison|psychic|radiant|slashing|thunder)\s+damage\b/i.test(desc)) {
      // Skip spells whose overlay explicitly sets damage to undefined (intentional suppression)
      if (Object.prototype.hasOwnProperty.call(SPELL_OVERLAY, raw.slug) && SPELL_OVERLAY[raw.slug].damage === undefined) continue
      gaps.push({ slug: raw.slug, name: raw.name, trigger: 'description has damage dice + damage type; add `damage`' })
      continue
    }

    if (!spell.savingThrow && /(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+saving throw/i.test(desc)) {
      const m = desc.match(/(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+saving throw/i)
      gaps.push({ slug: raw.slug, name: raw.name, trigger: `description mentions ${m?.[1]} save; add \`savingThrow\`` })
      continue
    }
  }
  return { total: spells.length, gaps }
}

// ── Races audit ──────────────────────────────────────────────────────────────

interface ScrapedRace {
  slug: string
  name: string
  abilityBonuses?: Record<string, number>
}

function auditRaces(): { total: number; gaps: Finding[] } {
  const races = loadJson<ScrapedRace>('races')
  const gaps: Finding[] = []
  for (const raw of races) {
    const parsed = RaceSchema.safeParse(raw)
    if (!parsed.success) continue
    const enriched = { ...parsed.data, ...(RACE_OVERLAY[raw.slug] ?? {}) }

    if (!enriched.abilityBonuses && !enriched.chooseAbilityBonuses) {
      gaps.push({ slug: raw.slug, name: raw.name, trigger: 'no ability bonuses in overlay; add to RACE_OVERLAY' })
      continue
    }
    if (!enriched.category) {
      gaps.push({ slug: raw.slug, name: raw.name, trigger: 'no category (Common/Uncommon/Exotic); add to RACE_OVERLAY' })
      continue
    }
  }
  return { total: races.length, gaps }
}

// ── Backgrounds audit ─────────────────────────────────────────────────────────

interface ScrapedBackground {
  slug: string
  name: string
  skillProficiencies?: string[]
  toolProficiencies?: string[]
}

function auditBackgrounds(): { total: number; gaps: Finding[] } {
  const backgrounds = loadJson<ScrapedBackground>('backgrounds')
  const gaps: Finding[] = []
  for (const raw of backgrounds) {
    const parsed = BackgroundSchema.safeParse(raw)
    if (!parsed.success) continue
    const enriched = { ...parsed.data, ...(BACKGROUND_OVERLAY[raw.slug] ?? {}) }

    if (enriched.skillProficiencies.length === 0) {
      gaps.push({ slug: raw.slug, name: raw.name, trigger: 'no skill proficiencies scraped; verify source data' })
    }
  }
  return { total: backgrounds.length, gaps }
}

// ── Items audit ──────────────────────────────────────────────────────────────

interface ScrapedItem { slug: string; name: string; description?: string }

// Matches item names that name a specific base weapon type — not flavor names
// like "Flame Tongue" (handled manually). Catches mace-of-disruption, oathbow, etc.
const WEAPON_NAME_RE = /\b(sword|blade|mace|flail|trident|dagger|javelin|sling|scimitar|rapier|battleaxe|greataxe|handaxe|warhammer|maul|morningstar|quarterstaff|whip|spear|lance|halberd|glaive|oathbow|longbow|shortbow|crossbow|riteknife|\baxe\b)\b/i

// Armor items that name a specific armor type (not "any armor")
const ARMOR_NAME_RE = /\b(dwarven plate|demon armor|dragon scale mail|breastplate|glamoured studded|scale mail)\b/i

// Items to skip: either generic "any armor/weapon" type OR not actually a weapon
const GENERIC_ITEMS = new Set([
  // Generic any-armor-type items (can't pre-fill base stats)
  'mithral-armor', 'adamantine-armor', 'armor-of-resistance', 'armor-of-vulnerability',
  'armor-1-2-3', 'shield-1-2-3', 'armor-of-invulnerability', 'plate-armor-of-etherealness',
  'armor-of-safeguarding', 'antimagic-armor', 'armor-of-fungal-spores', 'armor-of-the-fallen',
  'armor-of-weightlessness', 'ruidium-armor', 'voidwalker-armor', 'zephyr-armor',
  'clockwork-armor',
  // Not weapons: ammo, utility items with weapon-like words in name
  'sling-bullets-of-althemone',      // ammunition, not a weapon itself
  'censer-of-controlling-air-elementals', // incense burner for summoning, not a weapon
])

function auditItems(): { total: number; gaps: Finding[] } {
  const items = loadJson<ScrapedItem>('items')
  const gaps: Finding[] = []
  for (const raw of items) {
    if (GENERIC_ITEMS.has(raw.slug)) continue
    const overlay = ITEM_OVERLAY[raw.slug] ?? {}
    const name = raw.name ?? ''

    if (!overlay.weaponStats && WEAPON_NAME_RE.test(name)) {
      const match = name.match(WEAPON_NAME_RE)?.[0] ?? 'weapon'
      gaps.push({ slug: raw.slug, name, trigger: `name contains "${match}"; add \`weaponStats\`` })
      continue
    }
    if (!overlay.armorStats && ARMOR_NAME_RE.test(name)) {
      gaps.push({ slug: raw.slug, name, trigger: `name implies specific armor type; add \`armorStats\`` })
      continue
    }
  }
  return { total: items.length, gaps }
}

// ── Classes audit ─────────────────────────────────────────────────────────────

interface ScrapedClass {
  slug: string
  name: string
  spellcastingAbility?: string
}

// Minimum required subclass feature tiers per class.
// Every subclass must have at least one feature at each of these levels.
// Some subclasses gain extras (e.g. artillerist/battle-smith get L5) — those are bonus, not required.
const SUBCLASS_FEATURE_TIERS: Record<string, number[]> = {
  artificer: [3, 9, 15],       // L5 only for artillerist/battle-smith
  barbarian: [3, 6, 10, 14],
  bard:      [3, 6, 14],
  cleric:    [1, 2, 6, 8, 17],
  druid:     [2, 6, 10, 14],
  fighter:   [3, 7, 15],       // L10/L18 only in some subclasses
  monk:      [3, 6, 11, 17],
  paladin:   [3, 7, 15, 20],
  ranger:    [3, 7, 11, 15],
  rogue:     [3, 9, 13, 17],
  sorcerer:  [1, 6, 14],       // L18 only in some subclasses
  warlock:   [1, 6, 10, 14],
  wizard:    [2, 6, 10, 14],
}

// Classes that legitimately have no cantrips (half-casters)
const CLASSES_WITHOUT_CANTRIPS = new Set(['paladin', 'ranger'])

function auditClasses(): { total: number; gaps: Finding[] } {
  const classes = loadJson<ScrapedClass>('classes')
  const gaps: Finding[] = []

  for (const cls of classes) {
    const opts = CLASS_OPTIONS[cls.slug]

    // 1. CLASS_OPTIONS coverage
    if (!opts) {
      gaps.push({ slug: cls.slug, name: cls.name, trigger: 'no CLASS_OPTIONS entry — features, subclasses, and spellcasting will be missing' })
      continue
    }

    // 2. Spellcasting config completeness
    if (cls.spellcastingAbility) {
      const hasSlotConfig = opts.preparedCaster || opts.pactMagic || (opts.spellsKnownTable && opts.spellsKnownTable.length > 0)
      if (!hasSlotConfig) {
        gaps.push({ slug: cls.slug, name: cls.name, trigger: `spellcastingAbility="${cls.spellcastingAbility}" but no preparedCaster, pactMagic, or spellsKnownTable — spell slots will never generate` })
      }
      if (!CLASSES_WITHOUT_CANTRIPS.has(cls.slug) && !opts.cantripsKnown && !opts.cantripsAtLevel) {
        gaps.push({ slug: cls.slug, name: cls.name, trigger: `spellcastingAbility="${cls.spellcastingAbility}" but no cantripsKnown or cantripsAtLevel — cantrip grants will be missing` })
      }
    }

    // 3. Starting gear
    if (!CLASS_STARTING_GEAR[cls.slug]) {
      gaps.push({ slug: cls.slug, name: cls.name, trigger: 'no CLASS_STARTING_GEAR entry — character creation will show no starting equipment choices' })
    }

    // 4. Subclass feature tier coverage
    const expectedTiers = SUBCLASS_FEATURE_TIERS[cls.slug] ?? []
    for (const sub of opts.subclasses) {
      const featureLevels = new Set((sub.features ?? []).map(f => f.level))
      if (featureLevels.size === 0) {
        gaps.push({ slug: `${cls.slug}/${sub.slug}`, name: `${cls.name} — ${sub.name}`, trigger: 'subclass has no features defined at all' })
        continue
      }
      const missingTiers = expectedTiers.filter(t => !featureLevels.has(t))
      if (missingTiers.length > 0) {
        gaps.push({
          slug: `${cls.slug}/${sub.slug}`,
          name: `${cls.name} — ${sub.name}`,
          trigger: `has features at [${[...featureLevels].sort((a,b)=>a-b).join(', ')}] but missing expected tier(s): ${missingTiers.join(', ')}`,
        })
      }

      // 4b. Subclass-granted spells: if the prose advertises always-prepared spells
      //     but no structured grantedSpells exist, they won't appear in the Spells tab.
      const blob = `${sub.description} ${(sub.features ?? []).map(f => `${f.name} ${f.description}`).join(' ')}`.toLowerCase()
      const advertisesSpells = /always prepared|domain spell|oath spell|circle spell|psionic spell|clockwork magic/.test(blob)
      // Terrain-chosen spell lists (Circle of the Land) can't be statically modeled — the
      // player picks a terrain at the table — so don't flag them for missing grantedSpells.
      const isTerrainChosen = /terrain/.test(blob)
      if (advertisesSpells && !isTerrainChosen && !(sub.grantedSpells && sub.grantedSpells.length > 0)) {
        gaps.push({
          slug: `${cls.slug}/${sub.slug}`,
          name: `${cls.name} — ${sub.name}`,
          trigger: 'description advertises always-prepared spells but no `grantedSpells` defined — they won\'t appear in the Spells tab',
        })
      }
    }
  }

  // 5. Orphaned CLASS_OPTIONS entries (in config but not scraped)
  const scrapedSlugs = new Set(classes.map(c => c.slug))
  for (const slug of Object.keys(CLASS_OPTIONS)) {
    if (!scrapedSlugs.has(slug)) {
      gaps.push({ slug, name: slug, trigger: 'in CLASS_OPTIONS but not found in scraped classes.json — may be a homebrew or typo' })
    }
  }

  const totalSubclasses = Object.values(CLASS_OPTIONS).reduce((n, o) => n + o.subclasses.length, 0)
  return { total: totalSubclasses, gaps }
}

// ── Race coverage audit (improved) ────────────────────────────────────────────

function auditRaceCoverage(): { total: number; gaps: Finding[] } {
  const races = loadJson<ScrapedRace>('races')
  const gaps: Finding[] = []

  for (const raw of races) {
    const hasOverlay = !!RACE_OVERLAY[raw.slug]
    if (!hasOverlay) {
      gaps.push({ slug: raw.slug, name: raw.name, trigger: 'no RACE_OPTIONS entry — ability bonuses, subraces, resistances, and granted spells will all be missing' })
    }
  }

  // Orphaned RACE_OVERLAY entries
  const scrapedSlugs = new Set(races.map(r => r.slug))
  for (const slug of Object.keys(RACE_OVERLAY)) {
    if (!scrapedSlugs.has(slug)) {
      gaps.push({ slug, name: slug, trigger: 'in RACE_OPTIONS but not found in scraped races.json — may be a typo or variant name' })
    }
  }

  return { total: races.length, gaps }
}

// ── Report ───────────────────────────────────────────────────────────────────

function main() {
  const feats = auditFeats()
  const spells = auditSpells()
  const races = auditRaces()
  const raceCoverage = auditRaceCoverage()
  const backgrounds = auditBackgrounds()
  const items = auditItems()
  const classes = auditClasses()

  const totalGaps = feats.gaps.length + spells.gaps.length + races.gaps.length + raceCoverage.gaps.length + backgrounds.gaps.length + items.gaps.length + classes.gaps.length
  const totalEntries = feats.total + spells.total + races.total + backgrounds.total + items.total + classes.total

  console.log('# Content Audit Report')
  console.log('')
  console.log(`Run: \`npm run audit:content\``)
  console.log('')
  console.log(`Total entries scanned: **${totalEntries}** | Total gaps: **${totalGaps}**`)
  console.log('')
  console.log(section('Classes — Config & Subclass Features', classes.total, classes.gaps))
  console.log(section('Races — Overlay Coverage', raceCoverage.total, raceCoverage.gaps))
  console.log(section('Races — Enrichment Fields', races.total, races.gaps))
  console.log(section('Feats', feats.total, feats.gaps))
  console.log(section('Spells', spells.total, spells.gaps))
  console.log(section('Backgrounds', backgrounds.total, backgrounds.gaps))
  console.log(section('Items', items.total, items.gaps))
}

main()
