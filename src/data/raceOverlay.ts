import { RACE_OPTIONS } from './raceData'
import type { RaceDef } from '../content/loaders'

/**
 * Race enrichment overlay. Keyed by race slug.
 *
 * The scraper captures name, slug, speed, size, and trait names but cannot
 * extract ability bonuses, subraces, proficiency grants, or resistances from
 * the wikidot pages. All of that lives here, bridged from RACE_OPTIONS.
 *
 * Races present in the scraped data but absent here will be flagged by
 * `npm run audit:content` until overlay entries are added.
 */
export const RACE_OVERLAY: Record<string, Partial<RaceDef>> =
  RACE_OPTIONS as unknown as Record<string, Partial<RaceDef>>
