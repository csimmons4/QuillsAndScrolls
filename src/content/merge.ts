import type { z } from 'zod'
import {
  SpellSchema, FeatSchema, ItemSchema, RaceSchema, BackgroundSchema, ClassSchema,
  type SpellDef, type FeatDef, type ItemDef, type RaceDef, type BackgroundDef, type ClassDef,
} from './loaders'
import { enrichSpell } from './spellDerivation'

const HOMEBREW_SOURCE = { site: 'homebrew', license: 'homebrew', url: '' }

/** Merge a partial overlay into an entry, with the overlay winning on conflict. */
function mergeOverlay<T extends { slug: string }>(entry: T, overlay: Partial<T> | undefined): T {
  if (!overlay) return entry
  return { ...entry, ...overlay }
}

/** Apply a slug-keyed overlay to a list of entries.
 *  Overlay-only entries (slugs not in `entries`) are appended at the end so curated
 *  content can introduce items the scraper never saw. */
function applyOverlay<T extends { slug: string }>(
  entries: T[],
  overlay: Record<string, Partial<T>>,
): T[] {
  const seen = new Set(entries.map(e => e.slug))
  const merged = entries.map(e => mergeOverlay(e, overlay[e.slug]))
  for (const [slug, patch] of Object.entries(overlay)) {
    if (!seen.has(slug)) merged.push({ slug, ...patch } as T)
  }
  return merged
}

/** Zod-parse an array of unknowns. In dev, log entries that fail validation
 *  and drop them; in prod, drop silently so a single bad row doesn't crash the app. */
function safeParseArray<T extends z.ZodTypeAny>(
  schema: T,
  raw: unknown[],
  label: string,
): z.infer<T>[] {
  const out: z.infer<T>[] = []
  for (const item of raw) {
    const r = schema.safeParse(item)
    if (r.success) {
      out.push(r.data)
    } else if (import.meta.env.DEV) {
      const slug = (item as { slug?: unknown } | null)?.slug
      console.warn(`[content] ${label} parse failed for slug=${slug ?? '?'}`, r.error.issues)
    }
  }
  return out
}

// ── Spells ──────────────────────────────────────────────────────────────────

export function mergeSpells(
  rawOfficial: unknown[],
  rawHomebrew: unknown[],
  overlay: Record<string, Partial<SpellDef>> = {},
): SpellDef[] {
  const official = safeParseArray(SpellSchema, rawOfficial, 'spell').map(enrichSpell)
  const officialWithOverlay = applyOverlay(official, overlay)

  const homebrewStamped = rawHomebrew.map(h => {
    const raw = h as Partial<SpellDef> & { name?: string }
    return { ...raw, source: HOMEBREW_SOURCE, slug: raw.slug ?? `hb-${raw.name ?? 'spell'}` }
  })
  const homebrew = safeParseArray(SpellSchema, homebrewStamped, 'homebrew spell').map(enrichSpell)

  const hbSlugs = new Set(homebrew.map(h => h.slug))
  return [...officialWithOverlay.filter(o => !hbSlugs.has(o.slug)), ...homebrew]
}

// ── Feats ───────────────────────────────────────────────────────────────────

export function mergeFeats(
  rawOfficial: unknown[],
  rawHomebrew: unknown[],
  overlay: Record<string, Partial<FeatDef>> = {},
): FeatDef[] {
  const official = safeParseArray(FeatSchema, rawOfficial, 'feat')
  const officialWithOverlay = applyOverlay(official, overlay)

  const homebrewStamped = rawHomebrew.map(h => {
    const raw = h as Partial<FeatDef> & { name?: string }
    return { ...raw, source: HOMEBREW_SOURCE, slug: raw.slug ?? `hb-${raw.name ?? 'feat'}` }
  })
  const homebrew = safeParseArray(FeatSchema, homebrewStamped, 'homebrew feat')

  const hbSlugs = new Set(homebrew.map(h => h.slug))
  return [...officialWithOverlay.filter(o => !hbSlugs.has(o.slug)), ...homebrew]
}

// ── Items ───────────────────────────────────────────────────────────────────

export function mergeItems(
  rawOfficial: unknown[],
  rawHomebrew: unknown[],
  overlay: Record<string, Partial<ItemDef>> = {},
): ItemDef[] {
  const official = safeParseArray(ItemSchema, rawOfficial, 'item')
    .filter(it => !/^Magic Items?:/i.test(it.name))
  const officialWithOverlay = applyOverlay(official, overlay)

  const homebrewStamped = rawHomebrew.map(h => {
    const raw = h as Partial<ItemDef> & { name?: string }
    return { ...raw, source: HOMEBREW_SOURCE, slug: raw.slug ?? `hb-${raw.name ?? 'item'}` }
  })
  const homebrew = safeParseArray(ItemSchema, homebrewStamped, 'homebrew item')

  const hbSlugs = new Set(homebrew.map(h => h.slug))
  return [...officialWithOverlay.filter(o => !hbSlugs.has(o.slug)), ...homebrew]
}

// ── Races ────────────────────────────────────────────────────────────────────

export function mergeRaces(
  rawOfficial: unknown[],
  rawHomebrew: unknown[],
  overlay: Record<string, Partial<RaceDef>> = {},
): RaceDef[] {
  const official = safeParseArray(RaceSchema, rawOfficial, 'race')
  const officialWithOverlay = applyOverlay(official, overlay)

  const homebrewStamped = rawHomebrew.map(h => {
    const raw = h as Partial<RaceDef> & { name?: string }
    return { ...raw, source: HOMEBREW_SOURCE, slug: raw.slug ?? `hb-${raw.name ?? 'race'}` }
  })
  const homebrew = safeParseArray(RaceSchema, homebrewStamped, 'homebrew race')

  const hbSlugs = new Set(homebrew.map(h => h.slug))
  return [...officialWithOverlay.filter(o => !hbSlugs.has(o.slug)), ...homebrew]
}

// ── Classes ───────────────────────────────────────────────────────────────────

export function mergeClasses(rawOfficial: unknown[], rawHomebrew: unknown[] = []): ClassDef[] {
  const official = safeParseArray(ClassSchema, rawOfficial, 'class')
  const homebrewStamped = rawHomebrew.map(h => {
    const raw = h as Partial<ClassDef> & { name?: string }
    return { ...raw, source: HOMEBREW_SOURCE, slug: raw.slug ?? `hb-${raw.name ?? 'class'}` }
  })
  const homebrew = safeParseArray(ClassSchema, homebrewStamped, 'homebrew class')
  const hbSlugs = new Set(homebrew.map(h => h.slug))
  return [...official.filter(o => !hbSlugs.has(o.slug)), ...homebrew]
}

// ── Backgrounds ──────────────────────────────────────────────────────────────

export function mergeBackgrounds(
  rawOfficial: unknown[],
  rawHomebrew: unknown[],
  overlay: Record<string, Partial<BackgroundDef>> = {},
): BackgroundDef[] {
  const official = safeParseArray(BackgroundSchema, rawOfficial, 'background')
  const officialWithOverlay = applyOverlay(official, overlay)

  const homebrewStamped = rawHomebrew.map(h => {
    const raw = h as Partial<BackgroundDef> & { name?: string }
    return { ...raw, source: HOMEBREW_SOURCE, slug: raw.slug ?? `hb-${raw.name ?? 'background'}` }
  })
  const homebrew = safeParseArray(BackgroundSchema, homebrewStamped, 'homebrew background')

  const hbSlugs = new Set(homebrew.map(h => h.slug))
  return [...officialWithOverlay.filter(o => !hbSlugs.has(o.slug)), ...homebrew]
}
