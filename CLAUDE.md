# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**GitHub:** https://github.com/csimmons4/QuillsAndScrolls

## Commands

```bash
npm install               # install dependencies (first time)
npm run dev               # start both servers concurrently (see below)
npm run build             # tsc + vite build
npx tsc --noEmit          # type-check
npm test                  # Vitest: game-math tests (src/**/*.test.ts) + flow tests (src/test/flows.test.tsx)
npm run scrape            # scrape wikidot and output to public/data/wikidot/
npm run scrape -- --force          # force re-download, ignore cache
npm run scrape -- --only spells    # scrape a single category (comma-separate for several)
npm run audit:content     # check overlays vs scraped data for gaps/mismatches
```

`npm audit` reports advisories (22 after `npm audit fix` on 2026-11-17, the same for everyone who installs: they come from `package-lock.json`). The ones left need major upgrades (Vite 8, Tailwind 4, Zod 4, React Router 7, Vitest 5, uuid 14), so never run `npm audit fix --force`; plain `npm audit fix` is fine. The README's "About the security warnings" section explains this for players; keep its numbers in step. Keep `uuid` rather than `crypto.randomUUID()`, which needs a secure context and so fails over plain-HTTP phone/tablet access.

Tests live next to the code (`derive.test.ts`, `classData.test.ts`, `sheet/helpers.test.ts`, `currency.test.ts`, `localStore.test.ts`) and check the rules math against PHB values: modifiers, proficiency, HP, skills/saves/initiative, spell DC, class resources, multiclass and pact slots, AC, weapon attacks, the purse and save migrations. `src/test/fixtures.ts` builds the merged reference data from `public/data/wikidot` + overlays and a `makeChar()` helper. Add a test when you change a rule.

**Flow tests** (`src/test/flows.test.tsx`, jsdom via `// @vitest-environment jsdom`) render the whole `<App />` and click through it with Testing Library + user-event: open a sheet from the Vault, cast a spell (slot saved), long rest + Undo, the concentration save on damage, Arcane Recovery, Wild Shape damage overflow, Level Up (new level + "Before level 2" snapshot), and a full Creator run. `src/test/app.tsx` has the harness: `fakeServer(chars)` stubs `fetch` (`/data/wikidot` read from `public/`, `/api/*` kept in memory: check `server.characters` / `server.snapshots`), `renderApp(path)`, `saved(server, id, check)` (waits out the 800 ms debounced save) and the jsdom stubs (`scrollIntoView`, `scrollTo`, `CSS.escape`). The open spell/item renders twice in jsdom (side panel and under-row), so use `findAll…[0]`. Add a flow when you build something a player clicks through.

**Launchers:** `Start (Mac).command` / `Start (Windows).bat` are the double-click entry point for non-technical users. On first run they download a private Node.js into `.runtime/` (gitignored) if none is installed, run `npm install`, kill anything on ports 5173/5174, then `npm run dev` and open the browser. Keep the two scripts and the README's Setup section in sync.

## Architecture

`npm run dev` starts **two processes in parallel**:

| Process | Port | Role |
|---|---|---|
| Vite (React app) | 5173 | Frontend dev server; proxies `/api` → `127.0.0.1:5174` (`vite.config.ts`) |
| Express (`server.ts`) | 5174 | Local filesystem API |

The Express server exists solely to read/write JSON files on disk — the browser cannot access the filesystem directly. All API calls in `src/storage/charApi.ts` use relative `/api/...` paths and go through the Vite proxy.

`QS_DATA_DIR` (where `characters/`, `homebrew/` and `.local-settings.json` live; default the repo) and `QS_API_PORT` (default 5174, read by both `server.ts` and the Vite proxy) let a second copy run against a throwaway folder, e.g. `QS_DATA_DIR=/tmp/qs QS_API_PORT=5185 npx tsx server.ts` plus `QS_DATA_DIR=/tmp/qs QS_API_PORT=5185 npx vite --port 5186`.

**Phones and tablets (opt-in):** Settings → Phones & Tablets calls `PUT /api/settings/network`, which writes `{ lan }` to `.local-settings.json` (gitignored). `vite.config.ts` reads it at start-up: when on, `server.host = true` (listen on the network) and `__QS_LAN__` (declared in `vite-env.d.ts`) is true, so Settings can say "restart the app" when the saved choice and the running mode differ, and list the addresses from `GET /api/settings/network` (`os.networkInterfaces()`). Express always listens on 127.0.0.1 only; other devices reach it through Vite's proxy. Off is the default; there is no password, so the Settings card warns about that.

**What's committed:** `public/data/wikidot/*.json` (scraped content ships with the app). `characters/*.json` and `homebrew/**/*.json` are gitignored user data.

## Data flow

```
public/data/wikidot/*.json   ←  npm run scrape (wikidot HTML → cheerio → JSON)
        ↓
src/content/loaders.ts       ←  fetches raw JSON at startup; also defines the Zod content schemas (SpellSchema, FeatSchema, …)
        ↓
src/content/merge.ts         ←  per category: Zod safeParse (bad rows dropped, warned in dev)
                                 → spells only: enrichSpell() from spellDerivation.ts (concentration, ritual, damage, save, attackRoll)
                                 → apply curated overlay from src/data/*Overlay.ts (overlay wins; overlay-only slugs are appended)
                                 → merge homebrew (homebrew replaces official on slug collision)
        ↓
src/content/ContentProvider.tsx  ←  React context, exposes useContent() hook
        ↓
Routes (Vault, Creator, Sheet, LevelUp, Lookup, Homebrew, Settings)
```

Pages other than the Vault are `lazy()`-loaded in `App.tsx`; `vite.config.ts` splits React, zod and `src/data/` into their own chunks.

All game reference data (spells, items, races, classes, backgrounds, feats) flows through `useContent()`. Routes never fetch content directly. Classes have **no overlay** — class mechanics the scraper can't capture live in `src/data/classData.ts` and are imported directly by consumers.

## Storage

**Disk is the only store for characters and homebrew** (via the Express server):
- Characters: `characters/<name>_<id8>.json` — written by `PUT /api/characters/:id`. Renaming a character deletes the old file and writes a new one.
- History: `characters/.history/<id>/<stamp>.json` (gitignored) — `{ label, savedAt, character }`. The server takes a "Start of a session" snapshot when a save arrives more than 30 min after the last snapshot (`SNAPSHOT_GAP_MS`) and keeps the newest 40 (`MAX_SNAPSHOTS`). Level Up snapshots "Before level N" and restoring snapshots "Before restoring an earlier version", both via `takeSnapshot()` in `charApi.ts`. `components/HistoryDialog` (the clock in the sheet header) lists them (`listHistory`) and restores one (`loadSnapshot` runs `migrate()`, then the sheet's `save()`).
- Homebrew: `homebrew/{spells,items,feats,races,classes,backgrounds}/<slug>.json` — CRUD via `/api/homebrew/:category/:slug`. `HomebrewCategory` in `charApi.ts` must match `CATEGORIES` in `server.ts`, and `GET /api/homebrew` must return every category.

**localStorage** holds only UI preferences: the theme (`qs:theme`) and whether the purse ledger is open (`qs:ledgerOpen`). **sessionStorage** holds the most recently opened sheet (`qs:recentCharacter`, via `src/storage/recentCharacter.tsx`) so the nav bar can show a "← <name>" shortcut back to it. Despite its name, `src/storage/localStore.ts` no longer touches localStorage — it holds `migrate()`, `MIGRATIONS` and the `HomebrewStore` type.

`src/storage/ioFile.ts` handles JSON import/export and the backup zip (Settings). `importCharacter()` runs `migrate()` like the disk load path.

## Overlay system

The scraper can't capture all structured data. Curated overlays in `src/data/` fill the gaps:

| File | Enriches |
|---|---|
| `spellOverlay.ts` | Variable damage types, wrong-dice fixes, missing class lists, flat damage amounts |
| `featOverlay.ts` | Passive bonuses, granted spells, `grantsSpells` chooser config, `abilityScoreIncrease` |
| `itemOverlay.ts` | `weaponStats`, `armorStats`, passive item bonuses (AC, saves, spell DC, etc.), `potion` (Drink badge + healing dice; also splits wikidot's lumped Healing / Giant Strength pages into separate potions) |
| `raceOverlay.ts` | Re-exports `RACE_OPTIONS` from `raceData.ts` (cast to `Partial<RaceDef>`) — ability bonuses, subraces, resistances, granted spells |
| `backgroundOverlay.ts` | Feature name + description (scraper leaves these empty), `grantsSpells`, `startingGold` |

To add a new enrichment field: add it (optional) to the schema in `loaders.ts`, populate it in the overlay, then consume it. Run `npm run audit:content` to surface gaps.

## Key modules

- `src/character/model.ts` — Zod schema + `Character` type. Single source of truth for character shape. Bump `SCHEMA_VERSION` here when the shape changes; if the change isn't backward-compatible (a new required field with no Zod default, a renamed/reshaped field), add a step to the `MIGRATIONS` map in `localStore.ts` keyed by the from-version. Both load paths — disk (`charApi.listCharactersFromDisk`) and file import (`ioFile.importCharacter`) — run `migrate()`, which applies those steps sequentially before Zod-parsing; characters that still fail are returned as `failures` and shown in the Vault rather than silently dropped.
- `src/character/derive.ts` — Pure functions for game math: `abilityMod`, `profBonus`, `skillMod`, `saveMod`, `hpMax` (includes race `hpBonusPerLevel` and Draconic Resilience; Tough is added by the caller), `initiativeBonus` (DEX + Jack of All Trades / Remarkable Athlete), `spellcastingAbilityFor` (use this, not the scraped class's `spellcastingAbility`, so Eldritch Knight/Arcane Trickster cast with INT), `spellSaveDC`/`spellAttackBonus`, etc. Most of the file is `deriveClassResources()` — one `switch` case per class defining every limited-use resource (key, max, recharge `short`/`long`/`dawn`). Add new class resources there. Each resource is linked to the class or subclass feature it belongs to by `resourceMatchesFeature()` (loose name match, or the `RESOURCE_FEATURE` alias map when the names differ, e.g. Superiority Dice → Combat Superiority): the earliest matching feature card on the Features tab shows the same tracker, and the resource's name on the Resources strip jumps there. Give a new resource the feature's name, or add an alias.
- `src/character/featBonuses.ts` — `sumFeatBonuses()` aggregates all passive feat bonuses (initiative, speed, perception, HP/level, resistances, granted spells, etc.) into a `FeatBonuses` object used throughout the sheet.
- `src/character/itemBonuses.ts` — `sumItemBonuses()` / `effectiveAbilityScores()` — aggregates passive equipped-item bonuses (AC, saves, spell DC, ability overrides). Applied before AC and ability score display on the sheet. `itemIsActive()` is the rule for whether an item's magic works: worn/held (rings count as worn) **and** attuned if it requires attunement. Items with `requiresUnarmored` (Bracers of Defense) do nothing while armor or a shield is equipped.
- `src/character/grants.ts` — `resolveFeatGrants()` / `applyGrantPicks()` / `withFeatClassChoice()` — resolves a feat's `grantsSpells` config into `SpellGrantPrompt[]` and applies picks to the character (`spells` + `freeSpellUses`). Used by Creator and LevelUp (UI via `FeatGrantsBlock`). `featAbilityPick()` / `applyFeatAbilityIncrease()` apply a half-feat's +1 (and Resilient's matching save); every place a feat can be taken (Creator variant human, LevelUp, Sheet "add feat") uses them with the `FeatAbilityPicker` component.
- `src/character/create.ts` — `newCharacter()` defaults and `touchUpdated()`. The Creator wizard assembles the rest.
- `src/character/levelUp.ts` — `applyLevelUp(char, LevelUpChoices)`; `asiLevelsForClass()` (Fighter/Rogue get extra ASIs).
- `src/character/currency.ts` — the coin purse is a single balance: `normalizePurse()` stores it as the fewest gp/sp/cp (electrum and platinum are converted). The player picks a coin and types a whole number; the Sheet converts it to copper with `COIN_CP`, and `addValue()` / `spendValue()` apply it (`spendValue` returns null if it can't afford it). `formatPurse()` gives the "152 gp 4 sp 5 cp" text used in the Gain/Spend previews. The Sheet's purse is a "merchant's ledger" card: gold-leaf balance via `components/RollingNumber` (odometer digits), five coin buttons choosing what the amount is counted in, wax-seal Gain/Spend (click only — Enter does nothing, so an amount meant to be spent can't be gained by accident), floating "+25 gp" labels, and `char.purseLog` (newest first, last 30) shown as a ruled ledger with optional notes. Adding `gold-shimmer` to a `.gold-leaf` element sweeps a glint across it every 5 s, one character after the next by its `--i` (RollingNumber sets `--i` on each digit; pass `digitClassName="gold-leaf gold-shimmer"`). Purse styles (`.gold-leaf`, `.gold-shimmer`, `.wax-seal`, `.ledger-lines`, …) are in `index.css`.
- `src/content/ContentProvider.tsx` — Loads official + homebrew content on mount, exposes via `useContent()` (includes `reload()`).
- `src/storage/charApi.ts` — REST client for the Express server (characters + homebrew).
- `src/theme/theme.tsx` — `ThemeProvider` / `useTheme()`; themes `parchment` | `light` | `dark`, applied as `data-theme` on `<html>`.
- `src/data/classData.ts` — Hardcoded per-class config the scraper can't capture: `CLASS_OPTIONS` (subclasses with `features[]`, `cantripsAtLevel`, `spellsKnownTable`, `invocationsAtLevel`, `metamagicAtLevel`, `isSpellbookCaster`, `preparedCaster`, `pactMagic`); option lists (`ELDRITCH_INVOCATIONS`, `METAMAGIC_OPTIONS`, `ARTIFICER_INFUSIONS`, `BATTLE_MASTER_MANEUVERS`, `RUNE_KNIGHT_RUNES`, `TOTEM_ANIMALS`, `STORM_AURA_OPTIONS`, `FOUR_ELEMENTS_DISCIPLINES`, `HUNTER_CHOICES`, `LAND_CIRCLE_SPELLS`); `MULTICLASS_PROF_GRANTS`; slot tables/helpers (`slotsForLevel`, `PACT_SLOT_TABLE`, `INITIAL_SPELL_SLOTS`, `CASTER_TYPE`, `MULTICLASS_SLOT_TABLE`, `isMulticlassSpellcaster`, `effectiveCasterLevel`, `multiclassSpellSlotsMax`).
- `src/data/raceData.ts` — `RACE_OPTIONS` with ability bonuses, subraces (a subrace `speed` replaces the race's, e.g. Wood Elf 35), resistances, granted spells (`minLevel` = character level it's gained at, `castLevel` = slot level it's cast with, e.g. Tiefling Hellish Rebuke 3 / 2), etc.; `DRACONIC_ANCESTRIES`; the language lists and choice helpers.
- `src/data/spellMeta.ts` — Cantrip damage scaling (`cantripDiceAtLevel`) and ritual spell slug set (`RITUAL_SLUGS`). Everything else now lives on `SpellDef` directly after derivation.
- `src/data/startingGear.ts` — `CLASS_STARTING_GEAR` with fixed items and choice groups for the Creator wizard. Items with `pick` ("Martial Weapon (your choice)") get a dropdown per unit on the Equipment step (`gearPickOptions()`). On finish the Creator equips the best armor and shield the character is proficient with and its best melee weapon.
- `src/data/wildShapeBeasts.ts` — `WILD_SHAPE_BEASTS` (common SRD beasts: CR, AC, HP, speeds, STR/DEX/CON, attacks, traits), `wildShapeLimits(druidLevel, moon)` (PHB p.66 CR / swim / fly limits; Circle of the Moon CR 1, then level ÷ 3 from 6) and `wildShapeBlocked()` (why a form isn't available yet).
- `src/data/strixhavenSpells.ts` — `STRIXHAVEN_COLLEGES` (`CollegeSpells` per college), keyed by background slug, for the Strixhaven Initiate benefit. Consumed by Creator (granted-spell picks) and Sheet.
- `src/components/` — Shared UI pieces reused across routes: `ConfirmDialog` (`useConfirm()`), `SheetIcons` (line icons for the sheet header: rests, Level Up, save, export), `InspirationToken` (Status card: click the socket to gain Inspiration; press and hold the glowing gem for 1.8 s (`HOLD_MS`) to spend it — the screen pulses gold, faster as the ring fills, then a full-window golden burst plays (both rendered in portals); Space/Enter hold too), `FeatPicker` (+ `cleanFeatDesc`, `FeatEffectBadges`), `SpellChooser`, `FeatGrantsBlock`, `InlinePicker`, `ItemStatBlock` (`WeaponStatBlock`, `ArmorStatBlock`, `MagicItemStatBlock`), `SpellStatBlock`.

## Character data conventions

- **`featuresChosen`** is a `{ key, value }` list. Any key starting with `feat-` is treated as a feat (value = feat slug): `feat-l1` (Creator: variant human / race feat), `feat-<classSlug>-<timestamp>` (LevelUp), `feat-manual-<timestamp>` (added on the Sheet). Other keys hold class choices: `fighting-style` (Creator) / `fighting-style-<class>` (LevelUp) — read both, via `fightingStyles()` in `sheet/helpers.tsx`; `invocations`, `metamagic`, `maneuvers`, `pact-boon`, `infusions`, `runes`, `land-terrain`, `totem-spirit`/`totem-aspect`/`totem-attunement`, `storm-aura`, `four-elements`, `hunter-<lvl>`, `favored-enemy-<lvl>`, `favored-terrain-<lvl>`, `lore-bonus-skills` and `expertise-thieves-tools` (both picked on the Features tab), `dragonborn-ancestry`.
- **Skill keys** are the camelCase `SKILLS` values (`animalHandling`, `sleightOfHand`). Sources that may spell them differently go through `toSkillKey()` in `sheet/helpers.tsx`.
- **Multiclassing** never grants the new class's saving throws (PHB p.164); only `MULTICLASS_PROF_GRANTS`.
- **`classResources`** stores the *current remaining* count per `ClassResource.key` from `deriveClassResources()`; a missing key means full (max). Short/long rest reset via `shortRestResourceKeys` / `longRestResourceKeys`.
- **`freeSpellUses`** stores spent free casts keyed by a spell entry's `freeUseKey` (set by `applyGrantPicks`). Entries with a `freeUseKey` never count toward spells known or prepared.
- **`grantedBy`** on a spell entry names what granted a spell the class didn't teach: `feat:<slug>` (set by `applyGrantPicks`, cantrips included), `race:high-elf` (Creator), `strixhaven` (the background's picks). Tagged entries never count toward class cantrips, spells known or prepared, aren't offered in Level Up swaps, and show "Always prepared" instead of Unprepare. The v5→v6 migration tags old feat and Strixhaven picks; older feat cantrips and High Elf cantrips can't be told apart and stay untagged.
- **Mystic Arcanum** (Warlock 11/13/15/17) is a spell entry with `freeUseKey` `mystic-arcanum-<6–9>` (`mysticArcanumEntry()` in `classData.ts`); LevelUp asks for it, and the Spells tab shows a pick card for any arcanum owed but never chosen.
- **`skillBaseline`** is the skill proficiencies/expertise from creation and level-ups. The Sheet flags skills that differ (hand edits) and offers reset. Anything that legitimately grants skills (Creator, LevelUp, Features-tab expertise picks) must update it too, or the change shows as a hand edit. Older characters get it set from their current skills the first time the sheet opens.
- **`abilityBaseline`** / **`saveBaseline`** do the same for ability scores and saving throw proficiencies: hand edits on the sheet are flagged ("↺ 16" in the score box's corner, "↺ reset" on the save) and each card offers "Reset N changed". Anything that legitimately changes scores or saves (LevelUp ASIs, feat +1s, Primal Champion, Resilient, the Sheet's Add Feat) must move the baselines too, via `shiftBaselines(before, after)` in `levelUp.ts`. Set at creation; older characters get them from their current values the first time the sheet opens.
- **`activePotions`** are added when a potion with `potion.duration` is drunk and shown under Saving Throws. Effects of 10 minutes or less count down in rounds. Short rests clear effects of ≤ 60 minutes, long rests ≤ 480. `src/character/potionEffects.ts` turns running potions into sheet changes (`sumPotionEffects`): ability overrides, max-HP multiplier, AC, speed multiplier and extra speeds, save/check advantage, Bless dice, weapon damage dice, Oil of Sharpness's weapon bonus, resistances, condition immunities and advantages. `describePotionEffects` produces the box's "✓" lines. Drink-time effects (healing, Poison's damage + failed save, cures, exhaustion, temp HP, choices) are handled in the inventory's `finishDrink`. Conditions a potion adds are recorded in `addedConditions` and removed when it ends. Always end potions through `endPotion()` / `potionsAfterRest()`.
- **Languages:** race and background choices are stored as a placeholder like `"one language of your choice"` until picked; the Sheet's All Proficiencies card shows each as a dropdown. Use `splitRaceLanguages()` / `languageChoiceCount()` / `languageChoicePlaceholder()` and `LANGUAGES_STANDARD` / `LANGUAGES_EXOTIC` from `raceData.ts`. Races without curated `grantedLanguages` get Common + one of choice.
- **Older characters** with no armor/weapon proficiencies or no languages get them filled in from class/race/background the first time the sheet opens (`missingProficiencies()` in `sheet/helpers.tsx`; only completely empty fields).
- **Class Expertise** owed by `expertiseAt` × `expertiseCount` but never picked shows as a pick card at the top of the Features tab.
- **Custom resources** (`customResources`) render in the same Resources strip as class resources; their current counts live in `classResources` under the custom key.
- **Inventory slots:** an item's body slot comes from `detectBodySlot(name, description)` in `sheet/helpers.tsx`. Items with no detectable slot get a plain Equip and can never be put in an arbitrary body slot. Fuzzy weapon/armor name matching uses whole slug words (`hasSlugWords`), so "nimbus-coronet" doesn't match "net".
- **Infusions** (Artificer): `ARTIFICER_INFUSIONS` in `classData.ts` follows TCoE (item, prerequisite, attunement, `charges`, `damageTypes`), plus one `replicate:<item slug>` entry per item on the Replicate Magic Item tables (learned once per item; `findInfusion()` also maps the old `bag-of-holding` slug). Known infusions are `featuresChosen` key `infusions`. Each infusion's `kind` decides what infusing does: put it in one of your nonmagical items (`item.infusion`, Resistant Armor as `resistant-armor@fire`; charges are set on the item), create the Homunculus Servant (`kind: 'creature'`, a summon with `templateKey: 'homunculus-servant'`), or make the replicated magic item (`kind: 'replicate'`, added to the inventory and removed when the infusion ends). The Inventory's Infusions card (under Attunement) manages all three against `infusionsActiveAtLevel`. `infusionBonus()` gives the +1 (+2 at artificer 10 for the Enhanced ones; only while attuned when required) that the Sheet's `magicBonus(item, artificerLevel)` (in `sheet/helpers.tsx`) folds in; an Enhanced Arcane Focus adds to spell attacks and Resistant Armor adds its resistance.
- **Portrait** (`char.portrait`): an optional JPEG data URL, shrunk to ≤ 512 px by `imageFileToPortrait()` in `storage/portrait.ts`, so it saves, exports and backs up with the character. `components/PortraitPicker` shows it in the sheet header (click to change, hover to remove); the Vault shows a thumbnail. Both fall back to the character's initials.
- **Proficiencies** (armor, weapons, tools, languages) are edited on the Stats tab's All Proficiencies card (✎ Edit): armor as four kinds, weapons as Simple/Martial plus named weapons stored by name ("Longsword", "Pistol"), tools and languages from the lists in `character/proficiencies.ts` or typed. `profKey()` normalizes names the same way the Sheet's `isWeaponProficient()` matches them; `proficiencySources()` names what grants each one (class, multiclass, subclass, race, background, feat) for the chip tooltips. Armor from feats (`grantsProficiencies.armor`: Heavily/Moderately/Lightly Armored) is never stored: `featArmorKinds()` adds it to `isArmorProficient()`. "Your gear" lists carried weapons, armor and tools as ✓/⚠ with a one-click add.
- **Summons** (`char.summons`) are tracked creatures; class features that create one (Eldritch Cannon, Wildfire Spirit) set `templateKey` so the Sheet can find/replace them.
- **Wild Shape** form is a summon with `templateKey: 'wild-shape'` (no schema change), kept out of the Summons tab and its count. `wildShapeForm` / `enterWildShape(beast)` (spends a `wild-shape` use; the form keeps the druid's INT/WIS/CHA) / `revertWildShape()` are in the model; the Status card picks a form (blocked ones greyed with the reason) or takes a custom one. While in a form: `applyDamage` hits the beast first, and at 0 the form ends and the rest carries over to the druid (concentration and massive damage still apply); `applyHealing` heals the beast; `attackRows` are the beast's attacks; the vitals card and pinned strip show the beast's HP. A long rest ends it.

## Styling

The `parchment-{50–900}` and `dungeon-{800,900}` Tailwind colors are **CSS variables** (RGB triplets) defined per theme in `src/styles/index.css` and switched by `[data-theme=…]`. Low parchment indices are surfaces/borders, high are text — in dark mode the scale inverts, so always use the tokens rather than hex. In the parchment theme 400–900 are tuned for contrast on the card surface (500 ≈ 4.5:1); for a decorative gold *fill* use `bg-[rgb(var(--accent))]`, not a parchment shade. Spell and pact slot pips are violet cut gems (`.spell-gem`, pulsing via `pip-pulse`); attunement pips are indigo `.attune-gem`, ruby `.attune-gem-full` once all three are used; class resource pips are amber gems in the same diamond style: a `.res-pip` button holding a `.res-gem` (`-full` pulses, `-spent` is an empty socket, one-shot `-spend` / `-restore`); pool bars use `.res-pool-track` / `.res-pool-fill`. Tailwind drops any class in `index.css` that never appears spelled out in the source, so never build one with a template (`` `res-gem-${kind}` ``). Prefer the component classes in `index.css` (`.btn-primary`/`-secondary`/`-ghost`/`-danger`, `.card`, `.input`, `.label`, `.section-header`, `.tab-active`/`.tab-inactive`, `.stat-box`). Buttons and header use `--accent` / `--header-*` variables. Font family is `font-serif` (Palatino/Georgia).

Literal Tailwind hues (amber, green, violet, red, …) are used widely for semantic accents (damage types, resources, summons). They don't follow the theme variables, so `index.css` ends with a hand-maintained **dark-mode override block** that tints `bg-<hue>-50…300`, lifts `text-<hue>-600…900`, and softens `border-<hue>-100…400`. If you use a literal hue shade outside those ranges, or a hue not yet in the block (`zinc`, `neutral`), check it in the Dark theme and add an override following the same pattern.

## Routes

| Path | Component | Purpose |
|---|---|---|
| `/` | `Vault` | Character cards (portrait, class and subclass, HP bar; Duplicate and Delete in the ⋯ menu), create/import; lists characters that failed to load. A dead character (0 HP and three failed death saves, `isFallen`, the same rule as the sheet's "You have died") gets a dark `.vault-fallen` card in a "Fallen" section at the bottom. At 0 HP but not fallen the card shows "Down" (or "Stable" after three successes) with the death-save pips |
| `/new` | `Creator` | 8-step wizard: Race, Class, Background, Abilities, Skills, Equipment, Details, Review. The labelled progress bar jumps back to finished steps; forward is always Next (it validates) |
| `/c/:id` | `Sheet` | Character sheet (tabs: Stats, Spells, Inventory, Features, Summons, Notes) |
| `/c/:id/print` | `PrintSheet` | Printable two-page sheet from `useSheetModel()` (vitals, abilities, saves, skills, `attackRows`, limited uses with tick boxes, proficiencies, equipment; spells with slot boxes; features). `.print-sheet` styles at the end of `index.css` keep it black on white in every theme; the app header is `print:hidden` |
| `/c/:id/level-up` | `LevelUp` | Level-up page (incl. multiclass prereqs). A pinned step bar lists every section card (read from the DOM: `:scope > .card` with an `h2.section-header`) with a red dot for `blockerList` and amber for `reminderList` items (each names its section's heading in `step`), plus an Apply button |
| `/lookup` | `Lookup` | "Compendium": reference browser for all content. Each kind has a `…Parts()` function (title, tags, body); the list is on the left and the chosen entry reads in the pane on the right (opens in place on narrow screens). Spells filter by level, class and school |
| `/homebrew` | `Homebrew` | CRUD for homebrew entries (spells, items, feats, races, classes, backgrounds) |
| `/settings` | `Settings` | Class coverage, Appearance (theme picker), reference-data metadata, backup zip, attribution |

## Character sheet internals

The sheet is split across `src/routes/Sheet.tsx` and `src/routes/sheet/`:

| File | Holds |
|---|---|
| `Sheet.tsx` | The shell: header, vitals card, Resources strip, pinned tab bar, death screen, rest / add-feat modals, quick find and the undo toast. Renders `<XTab />` for the open tab inside `<SheetContext.Provider value={model}>` |
| `sheet/useSheetModel.tsx` | `useSheetModel()`: every piece of sheet state (hooks), what follows from the character (`effectiveChar`, `ac`, `classResources`, `freeSpells`…) and the actions (`patch`, `save`, `offerUndo`, `jumpToFeature`, `resourceTracker`, `featureText`…). Returns `{ ready: false, loadError }` until the character loads, then `{ ready: true, …everything }` (`SheetModel`) |
| `sheet/SheetContext.tsx` | `SheetContext` and `useSheet()`, which each tab destructures what it needs from |
| `sheet/StatsTab.tsx`, `SpellsTab.tsx`, `InventoryTab.tsx`, `FeaturesTab.tsx`, `SummonsTab.tsx`, `NotesTab.tsx` | One component per tab |
| `sheet/helpers.tsx` | Pure helpers and constants: `computeFullAC`, `resolveWeapon`/`resolveArmor`, `isWeaponProficient`/`isArmorProficient`, `weaponAttackBonus`/`weaponDamageMod` (+ `isMonkWeapon`), `magicBonus`, `detectBodySlot`, `toSkillKey`, `fightingStyles`, `missingProficiencies`, `deriveResistances`, `deriveSkillSources`, upcast parsing, `DAMAGE_TYPE_STYLE`, `CONDITIONS`, `type Tab` |
| `sheet/CampaignBoard.tsx` | The Notes tab's corkboard |

To give a tab something new: compute it at the top level of `useSheetModel()` and add its name to the object the hook returns (the return lists every name), then destructure it from `useSheet()` in the tab. Key patterns:

- Loading — fetches the full character list from disk and finds the one matching `:id`.
- Layout above the tabs: header, then one vitals card (HP with Temp beside it and the Damage/Heal/Temp controls; AC, Initiative, Speed, Prof. Bonus and a shared Passive box), then the Resources strip (one pill per resource via `resourceTracker(r, true)`; descriptions longer than 14 characters go to the hover text). The tab bar is `sticky`; switch tabs with `selectTab()`, which scrolls back to the top of the tab when the bar is pinned. Once pinned (`tabsPinned`) it also shows a status strip: HP, AC, the concentration spell (with a drop button) and Inspiration. The Stats tab opens with Attacks; conditions live in the Status card as the active ones plus a "+ Add a condition" select.
- **Spells on you:** `spellsOnYou` (session state, a `Set` of `mage-armor` / `shield` / `shield-of-faith` / `haste` / `barkskin`, toggled in the Status card) changes AC: Mage Armor is a `computeFullAC` candidate (13 + DEX, unarmored only), Shield +5, Shield of Faith +2, Haste +2 (and ×2 speed, advantage on DEX saves through `potionFx`), Barkskin raises AC to at least 16. Each shows in `acSource` and as a chip in the pinned strip. A short rest keeps Mage Armor (8 hours) and ends the rest; a long rest ends all.
- **Short rest extras** (Short Rest window): Arcane Recovery (wizard) / Natural Recovery (Circle of the Land) pick spent slots worth up to half the class level, none above 5th (`recoverSlots`), and Finish Rest sets that resource to 0; Song of Rest takes the bard's physically rolled die (`songOfRestRoll`) and adds it when hit dice are spent.
- **Fight effects:** `raging` / `blessed` are session state in the model (not saved; a rest or opening another character ends them). Starting a Rage (`startRage()`) spends a `rage-uses` and ends concentration. Both are folded into `potionFx` (advantage on STR checks/saves and resistances while raging, the Bear totem's all-but-psychic; Bless adds `1d4` to `rollBonusDice`), so saves, skills and resistances pick them up. `concRider` adds a concentration spell's extra damage (Hex, Hunter's Mark, Divine Favor, Spirit Shroud) to attack rows. `attackRows` (in the model) is the single list of attacks — Stats tab table and the printable sheet both draw from it.
- **Undo:** call `offerUndo('Removed X')` just before a change the player might regret; a toast offers to restore the character as it was for 7 s (`undo.before`, put back with `save()`). Used for unpreparing/removing spells, removing/using/drinking items, rests, removing feats, dismissing summons and ending potions.
- **Quick find:** ⌘K / Ctrl+K (or the magnifier in the header) opens a palette over the sheet listing spells, items, class/subclass features, feats and tabs; choosing one switches tab and opens it (rows carry `data-spell-key` / `data-item-idx` to scroll to; the Feats card is `#feats-card`).
- Spells tab: one slim row per spell (`spellRow`: name · casting time · hit/DC · damage · C/R marks), grouped by level with each level's slot gems in its heading (`slotGems(lvl)`) and level buttons that jump to a section. Class spells (`entryRow`) and granted ones (`freeRow`, ★) share the `SpellRow` shape. The chosen spell (`selectedSpellKey`) opens in a sticky panel beside the list on wide screens, under its row on narrow ones (`spellDetails`: a card with a level seal coloured by school (`.spell-seal`, `--seal` from `schoolAccentHex`), the four facts with icons, its hit/DC and damage, Cast with a slot / free cast / Concentrate, the text with a drop cap, higher levels, Unprepare). The spell library sits inside the same card under the list, in the same rows (`libraryRow`, key `lib:<slug>`, a quick + to add, `learnSpell()`), so its cards open in the same panel. The header shows Save DC and spell attack as `.spell-stat` seals and Prepared/Known and Cantrips as fill bars (amber when over the limit). Pact Magic sits above the list.
- Summons tab: each summon is a creature card (amber header with a seal, AC/speed/immunities, HP with −5/−1/+1/+5 on the card, attacks as rows); Details opens the full sheet for it.
- Stats tab Skills card: each skill's sources are coloured dots (★ for expertise) with a legend under the card; hover a dot for the source.
- Features tab: each class card lists class and subclass features together in level order (`featureList`); features with a tracker or a summon (`inUse`) are pinned under "Limited use". Descriptions are one line until clicked (`featureText()`, "Show all text" flips the default). Class basics are folded in a `<details>`. Race traits, subrace traits, feat descriptions and the background feature use `featureText()` too.
- Inventory tab: item rows are one line (`itemRow`); the open item is a card (header washed with the rarity colour) that `itemRow` stores in `selectedItemCard` while the lists render, shown in a sticky panel beside the lists on wide screens and under the row on narrow ones; rarity shows once (the right-hand badge for magic items, inline when the badge shows stats). The search box filters every section (`shown` instead of `grouped`). With the ledger open the purse card stretches to its column, so the ruled page fills the space.
- Damage while concentrating opens the in-app Concentration Save dialog (`concCheck`: DC, CON save, War Caster advantage); the player reports Made it / Failed. Never use native `confirm`/`alert`/`prompt` (they freeze the page until answered): use `useConfirm()` from `components/ConfirmDialog` (`if (!(await askConfirm({ title, message, confirmLabel, danger })) ) return`, render `{confirmDialog}` once) or an inline input.
- At 0 HP the death screen replaces the tabs and is a fixed, full-window overlay (`z-50`, covers the nav too); page scrolling is locked while it's up. Death saves are marked by clicking pips — never rolled in-app.
- `patch(partial)` → `save(next)` — updates state immediately and debounces a disk write (800 ms). `save()` also applies rules side effects: healing from 0 HP resets death saves; dropping to 0 HP ends concentration. Cmd/Ctrl+S forces an immediate save.
- `raceDef` — the merged `RaceDef` from `useContent()` for the current character's race; same object accessed as `race` inside the Features tab
- `featSlugs` / `featBonuses` — feat slugs from `featuresChosen` and `sumFeatBonuses()`, used for initiative, speed, HP, AC, resistances, and granted spells throughout the sheet
- `itemBonuses` — result of `sumItemBonuses()`, used for AC, saving throws, spell DC/attack, ability score overrides
- `effectiveChar` — the character with item-based ability score overrides/bonuses applied; use this (not `char`) wherever ability scores feed into displayed stats
- `effectiveCharSkills` — `effectiveChar` plus every auto-granted skill proficiency/expertise (background, race, feats, items); use for skill mods
- `freeSpells` — the single list of granted/innate spells (feats, race/subrace, subclass); render granted spells from this, not ad hoc
- `isMulticlassCaster` / `multiclassMaxes` — computed from `classData.ts` helpers; when truthy, spell slot display uses multiclass maxes instead of `char.spellSlots`
- `isSpellbookCaster` — true for Wizards; changes Unprepare to set `prepared: false` (keeps spell in spellbook) instead of removing it
