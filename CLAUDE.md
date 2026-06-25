# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install               # install dependencies (first time)
npm run dev               # start both servers concurrently (see below)
npm run build             # tsc + vite build
npm run scrape            # scrape wikidot and output to public/data/wikidot/
npm run scrape -- --force          # force re-download, ignore cache
npm run scrape -- --only spells    # scrape a single category
npm run audit:content     # check overlays vs scraped data for gaps/mismatches
```

No test suite exists.

## Architecture

`npm run dev` starts **two processes in parallel**:

| Process | Port | Role |
|---|---|---|
| Vite (React app) | 5173 | Frontend dev server |
| Express (`server.ts`) | 5174 | Local filesystem API |

The Express server exists solely to read/write JSON files on disk — the browser cannot access the filesystem directly. The Vite app does not proxy; all API calls in `src/storage/charApi.ts` use absolute `http://localhost:5174` URLs in dev.

## Data flow

```
public/data/wikidot/*.json   ←  npm run scrape (wikidot HTML → cheerio → JSON)
        ↓
src/content/loaders.ts       ←  fetched at app startup via /data/wikidot/*.json (Zod-parsed)
        ↓
src/content/spellDerivation.ts  ←  auto-enriches spells (concentration, ritual, damage, save, attackRoll)
        ↓
src/content/merge.ts         ←  applies curated overlays from src/data/*Overlay.ts; overlay wins on conflict
        ↓
src/content/ContentProvider.tsx  ←  React context, exposes useContent() hook
        ↓
Routes (Vault, Creator, Sheet, LevelUp, Homebrew)
```

All game reference data (spells, items, races, classes, backgrounds, feats) flows through `useContent()`. Routes never fetch data directly.

## Storage — two layers

**Disk (authoritative, via Express server):**
- Characters: `characters/<name>_<id8>.json` — written by `PUT /api/characters/:id`
- Homebrew: `homebrew/{spells,items,feats,races,classes}/<slug>.json` — CRUD via `/api/homebrew/:category/:slug`

**Browser localStorage (ephemeral fallback, not synced to disk):**
- `localStore.ts` — provides `listCharacters`, `saveCharacter`, etc. backed by `localStorage`. Used by Vault as a secondary read path. Characters saved by the Express server are the source of truth.
- Homebrew fallback: `loadHomebrew()` in `localStore.ts` reads from `localStorage`. The `charApi.ts` functions prefer the disk via Express.

## Overlay system

The scraper can't capture all structured data. Curated overlays in `src/data/` fill the gaps:

| File | Enriches |
|---|---|
| `spellOverlay.ts` | Variable damage types, wrong-dice fixes, missing class lists, flat damage amounts |
| `featOverlay.ts` | Passive bonuses, granted spells, `grantsSpells` chooser config, `abilityScoreIncrease` |
| `itemOverlay.ts` | `weaponStats`, `armorStats`, passive item bonuses (AC, saves, spell DC, etc.) |
| `raceOverlay.ts` | Re-exports `RACE_OPTIONS` from `raceData.ts` — ability bonuses, subraces, resistances, granted spells |
| `backgroundOverlay.ts` | Feature name + description (scraper leaves these empty) |

`spellDerivation.ts` runs **before** overlays in the pipeline; overlays win on any conflict. Run `npm run audit:content` to surface gaps.

## Key modules

- `src/character/model.ts` — Zod schema + `Character` type. Single source of truth for character shape. Bump `SCHEMA_VERSION` here when the shape changes; add a migration case in `localStore.ts#migrate()`.
- `src/character/derive.ts` — Pure functions for all game math: `abilityMod`, `profBonus`, `skillMod`, `saveMod`, `hpMax`, spell DC/attack, class resources. No side effects; takes `Character` + optional `ContentData`.
- `src/character/featBonuses.ts` — `sumFeatBonuses()` aggregates all passive feat bonuses (initiative, speed, perception, HP/level, resistances, granted spells, etc.) into a `FeatBonuses` object used throughout `Sheet.tsx`.
- `src/character/itemBonuses.ts` — `sumItemBonuses()` / `effectiveAbilityScores()` — aggregates passive equipped-item bonuses (AC, saves, spell DC, ability overrides). Applied before AC and ability score display in `Sheet.tsx`.
- `src/character/grants.ts` — `resolveFeatGrants()` / `applyGrantPicks()` — resolves a feat's `grantsSpells` config into `SpellGrantPrompt[]` and applies picks to the character. Used by Creator and LevelUp.
- `src/character/create.ts` — Builds a new `Character` from wizard selections.
- `src/character/levelUp.ts` — Applies a level-up payload to an existing `Character`.
- `src/content/ContentProvider.tsx` — Loads official + homebrew content on mount, exposes via `useContent()`.
- `src/storage/charApi.ts` — REST client for the Express server (characters + homebrew). `HomebrewCategory` type must match `CATEGORIES` in `server.ts`.
- `src/storage/ioFile.ts` — Browser file download/import helpers (JSON + zip).
- `src/data/classData.ts` — Hardcoded per-class config the scraper can't capture: `CLASS_OPTIONS` (subclasses with `features[]`, `cantripsAtLevel`, `spellsKnownTable`, `invocationsAtLevel`, `metamagicAtLevel`, `isSpellbookCaster`, `preparedCaster`, `pactMagic`), `ELDRITCH_INVOCATIONS`, `METAMAGIC_OPTIONS`, `ARTIFICER_INFUSIONS`, and multiclass spell slot helpers: `CASTER_TYPE`, `MULTICLASS_SLOT_TABLE`, `isMulticlassSpellcaster`, `effectiveCasterLevel`, `multiclassSpellSlotsMax`.
- `src/data/raceData.ts` — `RACE_OPTIONS` with ability bonuses, subraces, resistances, granted spells, etc.
- `src/data/spellMeta.ts` — Cantrip damage scaling table (`CANTRIP_SCALING`) and ritual spell slug set (`RITUAL_SLUGS`). Everything else now lives on `SpellDef` directly after derivation.
- `src/data/startingGear.ts` — `CLASS_STARTING_GEAR` with fixed items and choice groups for the Creator wizard.

## Styling

Custom Tailwind palette: `parchment-{50–900}` (warm tan/gold) and `dungeon-{800,900}` (near-black). Font family is `font-serif` (Palatino/Georgia). All UI uses these tokens — avoid introducing new color literals.

## Routes

| Path | Component | Purpose |
|---|---|---|
| `/` | `Vault` | Character list, create/import/delete |
| `/new` | `Creator` | 8-step character creation wizard |
| `/c/:id` | `Sheet` | Character sheet (tabbed: Stats, Spells, Inventory, Features, Summons, Notes) |
| `/c/:id/level-up` | `LevelUp` | Level-up wizard |
| `/homebrew` | `Homebrew` | CRUD for homebrew entries (spells, items, feats, races, classes) |
| `/settings` | `Settings` | Scrape metadata, backup zip |

## Sheet.tsx internals

`Sheet.tsx` is the largest file. Key patterns inside it:

- `patch(partial)` — thin wrapper that merges a partial character update and saves to disk + localStorage
- `raceDef` — the merged `RaceDef` from `useContent()` for the current character's race; same object accessed as `race` inside the Features tab IIFE
- `featBonuses` — result of `sumFeatBonuses()`, used for initiative, speed, HP, AC, resistances, and granted spells throughout the sheet
- `itemBonuses` — result of `sumItemBonuses()`, used for AC, saving throws, spell DC/attack, ability score overrides
- `effectiveChar` — the character with item-based ability score overrides/bonuses applied; use this (not `char`) wherever ability scores feed into displayed stats
- `isMulticlassCaster` / `multiclassMaxes` — computed from `classData.ts` helpers; when truthy, spell slot display uses multiclass maxes instead of `char.spellSlots`
- `isSpellbookCaster` — true for Wizards; changes Unprepare to set `prepared: false` (keeps spell in spellbook) instead of removing it
