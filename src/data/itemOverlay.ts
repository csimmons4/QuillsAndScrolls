import type { ItemDef } from '../content/loaders'

/**
 * Curated overlay for items. Keyed by item slug.
 *
 * The scraper extracts surface metadata (name, type, rarity, attunement,
 * description) but weapon damage/properties and armor AC/type live in the
 * description prose. Entries here populate `weaponStats` and `armorStats`
 * so attack/AC math in the sheet (and homebrew weapons) can read structured
 * fields instead of branching on slug.
 *
 * Audit via `npm run audit:content` to see which slugs still need filling.
 */
export const ITEM_OVERLAY: Record<string, Partial<ItemDef>> = {
  // ── Simple melee ──────────────────────────────────────────────────────────
  'club':           { weaponStats: { damage: '1d4',  damageType: 'bludgeoning', label: 'Club',           weight: 2 } },
  'dagger':         { weaponStats: { damage: '1d4',  damageType: 'piercing',    label: 'Dagger',          weight: 1,  finesse: true, light: true } },
  'greatclub':      { weaponStats: { damage: '1d8',  damageType: 'bludgeoning', label: 'Greatclub',       weight: 10, twoHanded: true } },
  'handaxe':        { weaponStats: { damage: '1d6',  damageType: 'slashing',    label: 'Handaxe',         weight: 2,  light: true } },
  'javelin':        { weaponStats: { damage: '1d6',  damageType: 'piercing',    label: 'Javelin',         weight: 2 } },
  'light-hammer':   { weaponStats: { damage: '1d4',  damageType: 'bludgeoning', label: 'Light Hammer',    weight: 2,  light: true } },
  'mace':           { weaponStats: { damage: '1d6',  damageType: 'bludgeoning', label: 'Mace',            weight: 4 } },
  'quarterstaff':   { weaponStats: { damage: '1d6',  damageType: 'bludgeoning', label: 'Quarterstaff',    weight: 4,  versatile: '1d8' } },
  'sickle':         { weaponStats: { damage: '1d4',  damageType: 'slashing',    label: 'Sickle',          weight: 2,  light: true } },
  'spear':          { weaponStats: { damage: '1d6',  damageType: 'piercing',    label: 'Spear',           weight: 3,  versatile: '1d8' } },

  // ── Simple ranged ─────────────────────────────────────────────────────────
  'crossbow-light': { weaponStats: { damage: '1d8',  damageType: 'piercing',    label: 'Light Crossbow',  weight: 5,  ranged: true } },
  'dart':           { weaponStats: { damage: '1d4',  damageType: 'piercing',    label: 'Dart',            weight: 0.25, finesse: true, ranged: true } },
  'shortbow':       { weaponStats: { damage: '1d6',  damageType: 'piercing',    label: 'Shortbow',        weight: 2,  ranged: true } },
  'sling':          { weaponStats: { damage: '1d4',  damageType: 'bludgeoning', label: 'Sling',           weight: 0,  ranged: true } },

  // ── Martial melee ─────────────────────────────────────────────────────────
  'battleaxe':      { weaponStats: { damage: '1d8',  damageType: 'slashing',    label: 'Battleaxe',       weight: 4,  versatile: '1d10' } },
  'flail':          { weaponStats: { damage: '1d8',  damageType: 'bludgeoning', label: 'Flail',           weight: 2 } },
  'glaive':         { weaponStats: { damage: '1d10', damageType: 'slashing',    label: 'Glaive',          weight: 6,  twoHanded: true } },
  'greataxe':       { weaponStats: { damage: '1d12', damageType: 'slashing',    label: 'Greataxe',        weight: 7,  twoHanded: true } },
  'greatsword':     { weaponStats: { damage: '2d6',  damageType: 'slashing',    label: 'Greatsword',      weight: 6,  twoHanded: true } },
  'halberd':        { weaponStats: { damage: '1d10', damageType: 'slashing',    label: 'Halberd',         weight: 6,  twoHanded: true } },
  'lance':          { weaponStats: { damage: '1d12', damageType: 'piercing',    label: 'Lance',           weight: 6 } },
  'longsword':      { weaponStats: { damage: '1d8',  damageType: 'slashing',    label: 'Longsword',       weight: 3,  versatile: '1d10' } },
  'maul':           { weaponStats: { damage: '2d6',  damageType: 'bludgeoning', label: 'Maul',            weight: 10, twoHanded: true } },
  'morningstar':    { weaponStats: { damage: '1d8',  damageType: 'piercing',    label: 'Morningstar',     weight: 4 } },
  'pike':           { weaponStats: { damage: '1d10', damageType: 'piercing',    label: 'Pike',            weight: 18, twoHanded: true } },
  'rapier':         { weaponStats: { damage: '1d8',  damageType: 'piercing',    label: 'Rapier',          weight: 2,  finesse: true } },
  'scimitar':       { weaponStats: { damage: '1d6',  damageType: 'slashing',    label: 'Scimitar',        weight: 3,  finesse: true, light: true } },
  'shortsword':     { weaponStats: { damage: '1d6',  damageType: 'piercing',    label: 'Shortsword',      weight: 2,  finesse: true, light: true } },
  'trident':        { weaponStats: { damage: '1d6',  damageType: 'piercing',    label: 'Trident',         weight: 4,  versatile: '1d8' } },
  'war-pick':       { weaponStats: { damage: '1d8',  damageType: 'piercing',    label: 'War Pick',        weight: 2 } },
  'warhammer':      { weaponStats: { damage: '1d8',  damageType: 'bludgeoning', label: 'Warhammer',       weight: 2,  versatile: '1d10' } },
  'whip':           { weaponStats: { damage: '1d4',  damageType: 'slashing',    label: 'Whip',            weight: 3,  finesse: true } },

  // ── Martial ranged ────────────────────────────────────────────────────────
  'crossbow-hand':  { weaponStats: { damage: '1d6',  damageType: 'piercing',    label: 'Hand Crossbow',   weight: 3,  ranged: true } },
  'crossbow-heavy': { weaponStats: { damage: '1d10', damageType: 'piercing',    label: 'Heavy Crossbow',  weight: 18, ranged: true, twoHanded: true } },
  'longbow':        { weaponStats: { damage: '1d8',  damageType: 'piercing',    label: 'Longbow',         weight: 2,  ranged: true, twoHanded: true } },
  'net':            { weaponStats: { damage: '—',    damageType: '—',           label: 'Net',             weight: 3,  ranged: true } },

  // ── Light armor ───────────────────────────────────────────────────────────
  'padded':          { armorStats: { acBase: 11, type: 'light',  stealthDisadvantage: true,  label: 'Padded (AC 11+DEX)',          weight: 8 } },
  'leather':         { armorStats: { acBase: 11, type: 'light',                               label: 'Leather (AC 11+DEX)',         weight: 10 } },
  'studded-leather': { armorStats: { acBase: 12, type: 'light',                               label: 'Studded Leather (AC 12+DEX)', weight: 13 } },

  // ── Medium armor ──────────────────────────────────────────────────────────
  'hide':            { armorStats: { acBase: 12, type: 'medium',                              label: 'Hide (AC 12+DEX max 2)',         weight: 12 } },
  'chain-shirt':     { armorStats: { acBase: 13, type: 'medium',                              label: 'Chain Shirt (AC 13+DEX max 2)',  weight: 20 } },
  'scale-mail':      { armorStats: { acBase: 14, type: 'medium', stealthDisadvantage: true,   label: 'Scale Mail (AC 14+DEX max 2)',   weight: 45 } },
  'breastplate':     { armorStats: { acBase: 14, type: 'medium',                              label: 'Breastplate (AC 14+DEX max 2)',  weight: 20 } },
  'half-plate':      { armorStats: { acBase: 15, type: 'medium', stealthDisadvantage: true,   label: 'Half Plate (AC 15+DEX max 2)',   weight: 40 } },

  // ── Heavy armor ───────────────────────────────────────────────────────────
  'ring-mail':       { armorStats: { acBase: 14, type: 'heavy',  stealthDisadvantage: true,                    label: 'Ring Mail (AC 14)',         weight: 40 } },
  'chain-mail':      { armorStats: { acBase: 16, type: 'heavy',  stealthDisadvantage: true,  minStrength: 13, label: 'Chain Mail (AC 16, STR 13)', weight: 55 } },
  'splint':          { armorStats: { acBase: 17, type: 'heavy',  stealthDisadvantage: true,  minStrength: 15, label: 'Splint (AC 17, STR 15)',     weight: 60 } },
  'plate':           { armorStats: { acBase: 18, type: 'heavy',  stealthDisadvantage: true,  minStrength: 15, label: 'Plate (AC 18, STR 15)',      weight: 65 } },

  // ── Shield ────────────────────────────────────────────────────────────────
  'shield':          { armorStats: { acBase: 2,  type: 'shield', label: 'Shield (+2 AC)', weight: 6 } },

  // ══════════════════════════════════════════════════════════════════════════
  // Magic weapons — base weapon stats (magic bonuses/effects in description)
  // Default for unspecified "sword" items: longsword (1d8 slashing, versatile)
  // ══════════════════════════════════════════════════════════════════════════

  // ── Magic lance (name-matching only finds whole words, so "dragonlance" needs its own entry) ──
  'dragonlance':             { weaponStats: { damage: '1d12', damageType: 'piercing',    label: 'Dragonlance',             weight: 6 } },

  // ── Magic longswords ──────────────────────────────────────────────────────
  'acheron-blade':           { weaponStats: { damage: '1d8',  damageType: 'slashing',    label: 'Acheron Blade',           versatile: '1d10' } },
  'blackrazor':              { weaponStats: { damage: '1d8',  damageType: 'slashing',    label: 'Blackrazor',              versatile: '1d10' } },
  'blade-of-avernus':        { weaponStats: { damage: '1d8',  damageType: 'slashing',    label: 'Blade of Avernus',        versatile: '1d10' } },
  'blade-of-the-medusa':     { weaponStats: { damage: '1d8',  damageType: 'slashing',    label: 'Blade of the Medusa',     versatile: '1d10' } },
  'bloodshed-blade':         { weaponStats: { damage: '1d8',  damageType: 'slashing',    label: 'Bloodshed Blade',         versatile: '1d10' } },
  'crystal-blade':           { weaponStats: { damage: '1d8',  damageType: 'slashing',    label: 'Crystal Blade',           versatile: '1d10' } },
  'dancing-sword':           { weaponStats: { damage: '1d8',  damageType: 'slashing',    label: 'Dancing Sword',           versatile: '1d10' } },
  'defender':                { weaponStats: { damage: '1d8',  damageType: 'slashing',    label: 'Defender',                versatile: '1d10' } },
  'flame-tongue':            { weaponStats: { damage: '1d8',  damageType: 'slashing',    label: 'Flame Tongue',            versatile: '1d10' } },
  'fools-blade':             { weaponStats: { damage: '1d8',  damageType: 'slashing',    label: "Fool's Blade",            versatile: '1d10' } },
  'frost-brand':             { weaponStats: { damage: '1d8',  damageType: 'slashing',    label: 'Frost Brand',             versatile: '1d10' } },
  'gamblers-blade':          { weaponStats: { damage: '1d8',  damageType: 'slashing',    label: "Gambler's Blade",         versatile: '1d10' } },
  'holy-avenger':            { weaponStats: { damage: '1d8',  damageType: 'slashing',    label: 'Holy Avenger',            versatile: '1d10' } },
  'luck-blade':              { weaponStats: { damage: '1d8',  damageType: 'slashing',    label: 'Luck Blade',              versatile: '1d10' } },
  'mind-blade':              { weaponStats: { damage: '1d8',  damageType: 'slashing',    label: 'Mind Blade',              versatile: '1d10' } },
  'moon-touched-sword':      { weaponStats: { damage: '1d8',  damageType: 'slashing',    label: 'Moon-Touched Sword',      versatile: '1d10' } },
  'moonblade':               { weaponStats: { damage: '1d8',  damageType: 'slashing',    label: 'Moonblade',               versatile: '1d10' } },
  'nepenthe':                { weaponStats: { damage: '1d8',  damageType: 'slashing',    label: 'Nepenthe',                versatile: '1d10' } },
  'nine-lives-stealer':      { weaponStats: { damage: '1d8',  damageType: 'slashing',    label: 'Nine Lives Stealer',      versatile: '1d10' } },
  'polymorph-blade':         { weaponStats: { damage: '1d8',  damageType: 'slashing',    label: 'Polymorph Blade',         versatile: '1d10' } },
  'ruinblade':               { weaponStats: { damage: '1d8',  damageType: 'slashing',    label: 'Ruinblade',               versatile: '1d10' } },
  'snicker-snack':           { weaponStats: { damage: '1d8',  damageType: 'slashing',    label: 'Snicker-Snack',           versatile: '1d10' } },
  'sun-blade':               { weaponStats: { damage: '1d8',  damageType: 'radiant',     label: 'Sun Blade',               versatile: '1d10', finesse: true } },
  'sword-of-answering':      { weaponStats: { damage: '1d8',  damageType: 'slashing',    label: 'Sword of Answering',      versatile: '1d10' } },
  'sword-of-kas':            { weaponStats: { damage: '1d8',  damageType: 'slashing',    label: 'Sword of Kas',            versatile: '1d10' } },
  'sword-of-life-stealing':  { weaponStats: { damage: '1d8',  damageType: 'slashing',    label: 'Sword of Life Stealing',  versatile: '1d10' } },
  'sword-of-sharpness':      { weaponStats: { damage: '1d8',  damageType: 'slashing',    label: 'Sword of Sharpness',      versatile: '1d10' } },
  'sword-of-the-paruns':     { weaponStats: { damage: '1d8',  damageType: 'slashing',    label: 'Sword of the Paruns',     versatile: '1d10' } },
  'sword-of-the-planes':     { weaponStats: { damage: '1d8',  damageType: 'slashing',    label: 'Sword of the Planes',     versatile: '1d10' } },
  'sword-of-vengeance':      { weaponStats: { damage: '1d8',  damageType: 'slashing',    label: 'Sword of Vengeance',      versatile: '1d10' } },
  'sword-of-wounding':       { weaponStats: { damage: '1d8',  damageType: 'slashing',    label: 'Sword of Wounding',       versatile: '1d10' } },
  'sword-of-zariel':         { weaponStats: { damage: '1d8',  damageType: 'slashing',    label: 'Sword of Zariel',         versatile: '1d10' } },
  'tearulai':                { weaponStats: { damage: '1d8',  damageType: 'slashing',    label: 'Tearulai',                versatile: '1d10' } },
  'vorpal-sword':            { weaponStats: { damage: '1d8',  damageType: 'slashing',    label: 'Vorpal Sword',            versatile: '1d10' } },

  // ── Magic greatswords ─────────────────────────────────────────────────────
  'hazirawn':                { weaponStats: { damage: '2d6',  damageType: 'slashing',    label: 'Hazirawn',                twoHanded: true } },
  'waythe':                  { weaponStats: { damage: '2d6',  damageType: 'slashing',    label: 'Waythe',                  twoHanded: true } },

  // ── Magic scimitar / rapier / shortsword ──────────────────────────────────
  'scimitar-of-speed':       { weaponStats: { damage: '1d6',  damageType: 'slashing',    label: 'Scimitar of Speed',       finesse: true, light: true } },
  'silken-spite':            { weaponStats: { damage: '1d8',  damageType: 'piercing',    label: 'Silken Spite',            finesse: true } },
  'serpent-s-fang':          { weaponStats: { damage: '1d6',  damageType: 'piercing',    label: "Serpent's Fang",          finesse: true, light: true } },

  // ── Magic daggers ─────────────────────────────────────────────────────────
  'baleful-talon':           { weaponStats: { damage: '1d4',  damageType: 'piercing',    label: 'Baleful Talon',           finesse: true, light: true } },
  'blade-of-broken-mirrors': { weaponStats: { damage: '1d4',  damageType: 'piercing',    label: 'Blade of Broken Mirrors', finesse: true, light: true } },
  'dagger-of-blindsight':    { weaponStats: { damage: '1d4',  damageType: 'piercing',    label: 'Dagger of Blindsight',    finesse: true, light: true } },
  'dagger-of-venom':         { weaponStats: { damage: '1d4',  damageType: 'piercing',    label: 'Dagger of Venom',         finesse: true, light: true } },
  'dragontooth-dagger':      { weaponStats: { damage: '1d4',  damageType: 'piercing',    label: 'Dragontooth Dagger',      finesse: true, light: true } },
  'rakdos-riteknife':        { weaponStats: { damage: '1d4',  damageType: 'piercing',    label: 'Rakdos Riteknife',        finesse: true, light: true } },
  'red-wizard-blade':        { weaponStats: { damage: '1d4',  damageType: 'piercing',    label: 'Red Wizard Blade',        finesse: true, light: true } },
  'tinderstrike':            { weaponStats: { damage: '1d4',  damageType: 'piercing',    label: 'Tinderstrike',            finesse: true, light: true } },

  // ── Magic axes ────────────────────────────────────────────────────────────
  'azuredge':                { weaponStats: { damage: '1d8',  damageType: 'slashing',    label: 'Azuredge',                versatile: '1d10' } },
  'berserker-axe':           { weaponStats: { damage: '1d8',  damageType: 'slashing',    label: 'Berserker Axe',           versatile: '1d10' } },
  'bloodaxe':                { weaponStats: { damage: '1d8',  damageType: 'slashing',    label: 'Bloodaxe',                versatile: '1d10' } },
  'fane-eater':              { weaponStats: { damage: '1d8',  damageType: 'slashing',    label: 'Fane-Eater',              versatile: '1d10' } },
  'woodcutter-s-axe':        { weaponStats: { damage: '1d8',  damageType: 'slashing',    label: "Woodcutter's Axe",        versatile: '1d10' } },
  'axe-of-the-dwarvish-lords':{ weaponStats: { damage: '1d8', damageType: 'slashing',    label: 'Axe of the Dwarvish Lords', versatile: '1d10' } },
  'yester-hill-axe':          { weaponStats: { damage: '1d8', damageType: 'slashing',    label: 'Yester Hill Axe',           versatile: '1d10' } },
  'bloodrage-greataxe':      { weaponStats: { damage: '1d12', damageType: 'slashing',    label: 'Bloodrage Greataxe',      twoHanded: true } },
  'flayer-slayer':           { weaponStats: { damage: '1d12', damageType: 'slashing',    label: 'Flayer Slayer',           twoHanded: true } },
  "gurts-greataxe":          { weaponStats: { damage: '1d12', damageType: 'slashing',    label: "Gurt's Greataxe",         twoHanded: true } },
  'orcsplitter':             { weaponStats: { damage: '1d12', damageType: 'slashing',    label: 'Orcsplitter',             twoHanded: true } },
  'adze-of-annam':           { weaponStats: { damage: '1d12', damageType: 'slashing',    label: 'Adze of Annam',           twoHanded: true } },

  // ── Magic hammers ─────────────────────────────────────────────────────────
  'akmon':                   { weaponStats: { damage: '1d8',  damageType: 'bludgeoning', label: 'Akmon',                   versatile: '1d10' } },
  'hammer-of-thunderbolts':  { weaponStats: { damage: '1d8',  damageType: 'bludgeoning', label: 'Hammer of Thunderbolts',  versatile: '1d10' } },
  'whelm':                   { weaponStats: { damage: '1d8',  damageType: 'bludgeoning', label: 'Whelm',                   versatile: '1d10' } },
  'matalotok':               { weaponStats: { damage: '2d6',  damageType: 'bludgeoning', label: 'Matalotok',               twoHanded: true } },

  // ── Magic maces / rods ────────────────────────────────────────────────────
  'mace-of-disruption':      { weaponStats: { damage: '1d6',  damageType: 'bludgeoning', label: 'Mace of Disruption' } },
  'mace-of-smiting':         { weaponStats: { damage: '1d6',  damageType: 'bludgeoning', label: 'Mace of Smiting' } },
  'mace-of-terror':          { weaponStats: { damage: '1d6',  damageType: 'bludgeoning', label: 'Mace of Terror' } },
  'mace-of-the-black-crown': { weaponStats: { damage: '1d6',  damageType: 'bludgeoning', label: 'Mace of the Black Crown' } },
  'nightbringer':            { weaponStats: { damage: '1d6',  damageType: 'bludgeoning', label: 'Nightbringer' } },
  'rod-of-lordly-might':     { weaponStats: { damage: '1d6',  damageType: 'bludgeoning', label: 'Rod of Lordly Might' } },

  // ── Magic morningstars ────────────────────────────────────────────────────
  'reapers-scream':          { weaponStats: { damage: '1d8',  damageType: 'piercing',    label: "Reaper's Scream" } },
  'the-bloody-end':          { weaponStats: { damage: '1d8',  damageType: 'piercing',    label: 'The Bloody End' } },

  // ── Magic flails ──────────────────────────────────────────────────────────
  'devotees-censer':         { weaponStats: { damage: '1d8',  damageType: 'bludgeoning', label: "Devotee's Censer" } },
  'flail-of-tiamat':         { weaponStats: { damage: '1d8',  damageType: 'bludgeoning', label: 'Flail of Tiamat' } },
  'ruinous-flail':           { weaponStats: { damage: '1d8',  damageType: 'bludgeoning', label: 'Ruinous Flail' } },

  // ── Magic whips ───────────────────────────────────────────────────────────
  'dyrrns-tentacle-whip':    { weaponStats: { damage: '1d4',  damageType: 'slashing',    label: "Dyrrn's Tentacle Whip",   finesse: true } },
  'grasping-whip':           { weaponStats: { damage: '1d4',  damageType: 'slashing',    label: 'Grasping Whip',           finesse: true } },
  'lash-of-immolation':      { weaponStats: { damage: '1d4',  damageType: 'slashing',    label: 'Lash of Immolation',      finesse: true } },
  'lash-of-shadows':         { weaponStats: { damage: '1d4',  damageType: 'slashing',    label: 'Lash of Shadows',         finesse: true } },
  'mastix':                  { weaponStats: { damage: '1d4',  damageType: 'slashing',    label: 'Mastix',                  finesse: true } },

  // ── Magic tridents ────────────────────────────────────────────────────────
  'dekella':                 { weaponStats: { damage: '1d6',  damageType: 'piercing',    label: 'Dekella',                 versatile: '1d8' } },
  'drown':                   { weaponStats: { damage: '1d6',  damageType: 'piercing',    label: 'Drown',                   versatile: '1d8' } },
  'tidecaller-trident':      { weaponStats: { damage: '1d6',  damageType: 'piercing',    label: 'Tidecaller Trident',      versatile: '1d8' } },
  'trident-of-fish-command': { weaponStats: { damage: '1d6',  damageType: 'piercing',    label: 'Trident of Fish Command', versatile: '1d8' } },
  'wave':                    { weaponStats: { damage: '1d6',  damageType: 'piercing',    label: 'Wave',                    versatile: '1d8' } },

  // ── Magic spears ──────────────────────────────────────────────────────────
  'blood-spear':             { weaponStats: { damage: '1d6',  damageType: 'piercing',    label: 'Blood Spear',             versatile: '1d8' } },
  'khrusor':                 { weaponStats: { damage: '1d6',  damageType: 'piercing',    label: 'Khrusor, Spear of Heliod',versatile: '1d8' } },
  'ruins-wake':              { weaponStats: { damage: '1d6',  damageType: 'piercing',    label: "Ruin's Wake",             versatile: '1d8' } },
  'spear-of-backbiting':     { weaponStats: { damage: '1d6',  damageType: 'piercing',    label: 'Spear of Backbiting',     versatile: '1d8' } },
  'windvane':                { weaponStats: { damage: '1d6',  damageType: 'piercing',    label: 'Windvane',                versatile: '1d8' } },

  // ── Magic javelins / darts / slings ──────────────────────────────────────
  'javelin-of-lightning':    { weaponStats: { damage: '1d6',  damageType: 'piercing',    label: 'Javelin of Lightning' } },
  'seeker-dart':             { weaponStats: { damage: '1d4',  damageType: 'piercing',    label: 'Seeker Dart',             finesse: true, ranged: true } },
  'sling-of-giant-felling':  { weaponStats: { damage: '1d4',  damageType: 'bludgeoning', label: 'Sling of Giant Felling',  ranged: true } },
  'two-birds-sling':         { weaponStats: { damage: '1d4',  damageType: 'bludgeoning', label: 'Two-Birds Sling',         ranged: true } },

  // ── Magic bows ────────────────────────────────────────────────────────────
  'bow-of-conflagration':    { weaponStats: { damage: '1d8',  damageType: 'piercing',    label: 'Bow of Conflagration',    ranged: true, twoHanded: true } },
  'bow-of-melodies':         { weaponStats: { damage: '1d8',  damageType: 'piercing',    label: 'Bow of Melodies',         ranged: true, twoHanded: true } },
  'dragon-wing-bow':         { weaponStats: { damage: '1d8',  damageType: 'piercing',    label: 'Dragon Wing Bow',         ranged: true, twoHanded: true } },
  'ephixis':                 { weaponStats: { damage: '1d6',  damageType: 'piercing',    label: 'Ephixis, Bow of Nyela',   ranged: true, twoHanded: true } },
  'glimmering-moonbow':      { weaponStats: { damage: '1d8',  damageType: 'piercing',    label: 'Glimmering Moonbow',      ranged: true, twoHanded: true } },
  'longbow-of-the-healing-hearth': { weaponStats: { damage: '1d8', damageType: 'piercing', label: 'Longbow of the Healing Hearth', ranged: true, twoHanded: true } },
  'oathbow':                 { weaponStats: { damage: '1d8',  damageType: 'piercing',    label: 'Oathbow',                 ranged: true, twoHanded: true } },
  'starshot-crossbow':       { weaponStats: { damage: '1d8',  damageType: 'piercing',    label: 'Starshot Crossbow',       ranged: true } },

  // ── Magic quarterstaffs ───────────────────────────────────────────────────
  'gulthias-staff':          { weaponStats: { damage: '1d6',  damageType: 'bludgeoning', label: 'Gulthias Staff',          versatile: '1d8' } },
  'spider-staff':            { weaponStats: { damage: '1d6',  damageType: 'bludgeoning', label: 'Spider Staff',            versatile: '1d8' } },
  'staff-of-striking':       { weaponStats: { damage: '1d6',  damageType: 'bludgeoning', label: 'Staff of Striking',       versatile: '1d8' } },

  // ══════════════════════════════════════════════════════════════════════════
  // Passive effect items — AC bonus, saves, spell DC, ability score overrides
  // ══════════════════════════════════════════════════════════════════════════

  // ── AC + saving throw bonuses ─────────────────────────────────────────────
  'ring-of-protection':      { acBonus: 1, savingThrowBonus: 1 },
  'cloak-of-protection':     { acBonus: 1, savingThrowBonus: 1 },
  'bracers-of-defense':      { acBonus: 2, requiresUnarmored: true },

  // ── Saving throw + ability check bonuses ─────────────────────────────────
  'luckstone':               { savingThrowBonus: 1, abilityCheckBonus: 1 },
  'robe-of-stars':           { savingThrowBonus: 1 },

  // ── Spell foci — DC and attack bonus ─────────────────────────────────────
  // Base amalgam entries kept for backwards compat (chars that already have them).
  // Pickers hide these slugs and show the explicit +1/+2/+3 variants below.
  'wand-of-the-war-mage':    { spellAttackBonus: 1 },
  'rod-of-the-pact-keeper':  { spellDCBonus: 1, spellAttackBonus: 1 },
  'amulet-of-the-devout':    { spellDCBonus: 1, spellAttackBonus: 1 },
  'arcane-grimoire':         { spellDCBonus: 1, spellAttackBonus: 1 },
  'moon-sickle':             { weaponStats: { damage: '1d4', damageType: 'slashing', label: 'Moon Sickle', light: true }, spellDCBonus: 1, spellAttackBonus: 1 },

  // Explicit tiered variants — uncommon (+1), rare (+2), very rare (+3)
  'wand-of-the-war-mage-1':  { name: 'Wand of the War Mage +1',  type: 'Wondrous Item', rarity: 'uncommon',  attunement: true, spellAttackBonus: 1, source: { site: 'dnd5e.wikidot.com', license: 'CC BY-SA 3.0', url: '' } },
  'wand-of-the-war-mage-2':  { name: 'Wand of the War Mage +2',  type: 'Wondrous Item', rarity: 'rare',      attunement: true, spellAttackBonus: 2, source: { site: 'dnd5e.wikidot.com', license: 'CC BY-SA 3.0', url: '' } },
  'wand-of-the-war-mage-3':  { name: 'Wand of the War Mage +3',  type: 'Wondrous Item', rarity: 'very rare', attunement: true, spellAttackBonus: 3, source: { site: 'dnd5e.wikidot.com', license: 'CC BY-SA 3.0', url: '' } },

  'rod-of-the-pact-keeper-1': { name: 'Rod of the Pact Keeper +1', type: 'Wondrous Item', rarity: 'uncommon',  attunement: true, spellDCBonus: 1, spellAttackBonus: 1, source: { site: 'dnd5e.wikidot.com', license: 'CC BY-SA 3.0', url: '' } },
  'rod-of-the-pact-keeper-2': { name: 'Rod of the Pact Keeper +2', type: 'Wondrous Item', rarity: 'rare',      attunement: true, spellDCBonus: 2, spellAttackBonus: 2, source: { site: 'dnd5e.wikidot.com', license: 'CC BY-SA 3.0', url: '' } },
  'rod-of-the-pact-keeper-3': { name: 'Rod of the Pact Keeper +3', type: 'Wondrous Item', rarity: 'very rare', attunement: true, spellDCBonus: 3, spellAttackBonus: 3, source: { site: 'dnd5e.wikidot.com', license: 'CC BY-SA 3.0', url: '' } },

  'amulet-of-the-devout-1':  { name: 'Amulet of the Devout +1',  type: 'Wondrous Item', rarity: 'uncommon',  attunement: true, spellDCBonus: 1, spellAttackBonus: 1, source: { site: 'dnd5e.wikidot.com', license: 'CC BY-SA 3.0', url: '' } },
  'amulet-of-the-devout-2':  { name: 'Amulet of the Devout +2',  type: 'Wondrous Item', rarity: 'rare',      attunement: true, spellDCBonus: 2, spellAttackBonus: 2, source: { site: 'dnd5e.wikidot.com', license: 'CC BY-SA 3.0', url: '' } },
  'amulet-of-the-devout-3':  { name: 'Amulet of the Devout +3',  type: 'Wondrous Item', rarity: 'very rare', attunement: true, spellDCBonus: 3, spellAttackBonus: 3, source: { site: 'dnd5e.wikidot.com', license: 'CC BY-SA 3.0', url: '' } },

  'arcane-grimoire-1':       { name: 'Arcane Grimoire +1',       type: 'Wondrous Item', rarity: 'uncommon',  attunement: true, spellDCBonus: 1, spellAttackBonus: 1, source: { site: 'dnd5e.wikidot.com', license: 'CC BY-SA 3.0', url: '' } },
  'arcane-grimoire-2':       { name: 'Arcane Grimoire +2',       type: 'Wondrous Item', rarity: 'rare',      attunement: true, spellDCBonus: 2, spellAttackBonus: 2, source: { site: 'dnd5e.wikidot.com', license: 'CC BY-SA 3.0', url: '' } },
  'arcane-grimoire-3':       { name: 'Arcane Grimoire +3',       type: 'Wondrous Item', rarity: 'very rare', attunement: true, spellDCBonus: 3, spellAttackBonus: 3, source: { site: 'dnd5e.wikidot.com', license: 'CC BY-SA 3.0', url: '' } },

  'moon-sickle-1':           { name: 'Moon Sickle +1',           type: 'Wondrous Item', rarity: 'uncommon',  attunement: true, weaponStats: { damage: '1d4', damageType: 'slashing', label: 'Moon Sickle +1', light: true }, spellDCBonus: 1, spellAttackBonus: 1, source: { site: 'dnd5e.wikidot.com', license: 'CC BY-SA 3.0', url: '' } },
  'moon-sickle-2':           { name: 'Moon Sickle +2',           type: 'Wondrous Item', rarity: 'rare',      attunement: true, weaponStats: { damage: '1d4', damageType: 'slashing', label: 'Moon Sickle +2', light: true }, spellDCBonus: 2, spellAttackBonus: 2, source: { site: 'dnd5e.wikidot.com', license: 'CC BY-SA 3.0', url: '' } },
  'moon-sickle-3':           { name: 'Moon Sickle +3',           type: 'Wondrous Item', rarity: 'very rare', attunement: true, weaponStats: { damage: '1d4', damageType: 'slashing', label: 'Moon Sickle +3', light: true }, spellDCBonus: 3, spellAttackBonus: 3, source: { site: 'dnd5e.wikidot.com', license: 'CC BY-SA 3.0', url: '' } },

  // Staves with AC / spell bonuses
  'staff-of-power':          { weaponStats: { damage: '1d6', damageType: 'bludgeoning', label: 'Staff of Power',   versatile: '1d8' }, acBonus: 2, spellDCBonus: 2, spellAttackBonus: 2 },
  'staff-of-the-magi':       { weaponStats: { damage: '1d6', damageType: 'bludgeoning', label: 'Staff of the Magi', versatile: '1d8' }, spellDCBonus: 2, spellAttackBonus: 2 },

  // Robe of the Archmagi: unarmored AC 15+DEX and massive spell bonuses
  'robe-of-the-archmagi':    { armorStats: { acBase: 15, type: 'light', label: 'Robe of the Archmagi (AC 15+DEX)' }, spellDCBonus: 5, spellAttackBonus: 5 },

  // ── Ability score overrides ───────────────────────────────────────────────
  'amulet-of-health':        { abilityScoreOverride: { con: 19 } },
  'gauntlets-of-ogre-power': { abilityScoreOverride: { str: 19 } },
  'headband-of-intellect':   { abilityScoreOverride: { int: 19 } },
  'belt-of-giant-strength':  { abilityScoreOverride: { str: 21 } },  // Hill Giant tier (minimum)

  // ── Ability score bonuses ─────────────────────────────────────────────────
  'belt-of-dwarvenkind':     { abilityScoreBonus: { con: 2 } },

  // ── Granted resistances / immunities ─────────────────────────────────────
  'periapt-of-proof-against-poison': { grantedImmunities: ['poison'], grantedConditionImmunities: ['poisoned'] },

  // ══════════════════════════════════════════════════════════════════════════
  // Magic armor — specific base armor type (not "any armor")
  // ══════════════════════════════════════════════════════════════════════════

  // Shield +1/+2/+3 — acBase stays at 2; the name-derived magicBonus adds the enhancement.
  // Hidden from pickers (TIERED_BASE_SLUGS); the armor picker shows inline +1/+2/+3 buttons on Shield.
  'shield-1':                { name: 'Shield +1', type: 'Armor', rarity: 'uncommon',  attunement: false, armorStats: { acBase: 2, type: 'shield', label: 'Shield +1' }, source: { site: 'dnd5e.wikidot.com', license: 'CC BY-SA 3.0', url: '' } },
  'shield-2':                { name: 'Shield +2', type: 'Armor', rarity: 'rare',      attunement: false, armorStats: { acBase: 2, type: 'shield', label: 'Shield +2' }, source: { site: 'dnd5e.wikidot.com', license: 'CC BY-SA 3.0', url: '' } },
  'shield-3':                { name: 'Shield +3', type: 'Armor', rarity: 'very rare', attunement: false, armorStats: { acBase: 2, type: 'shield', label: 'Shield +3' }, source: { site: 'dnd5e.wikidot.com', license: 'CC BY-SA 3.0', url: '' } },

  'breastplate-of-balance':     { armorStats: { acBase: 14, type: 'medium',                             label: 'Breastplate of Balance (AC 14+DEX max 2)', weight: 20 } },
  'dragon-scale-mail':          { armorStats: { acBase: 14, type: 'medium', stealthDisadvantage: true,  label: 'Dragon Scale Mail (AC 14+DEX max 2)',       weight: 45 } },
  'dwarven-plate':              { armorStats: { acBase: 20, type: 'heavy',                   minStrength: 15, label: 'Dwarven Plate (AC 20, STR 15)',              weight: 65 } },
  'demon-armor':                { armorStats: { acBase: 19, type: 'heavy',  stealthDisadvantage: true,  minStrength: 15, label: 'Demon Armor (AC 19, STR 15)',               weight: 65 } },
  'glamoured-studded-leather':  { armorStats: { acBase: 13, type: 'light',                              label: 'Glamoured Studded Leather (AC 13+DEX)',      weight: 13 } },
  'stonebreakers-breastplate':  { armorStats: { acBase: 14, type: 'medium',                             label: "Stonebreaker's Breastplate (AC 14+DEX max 2)", weight: 20 } },

  // ══════════════════════════════════════════════════════════════════════════
  // Potions & oils — `potion` makes the sheet treat them as consumables (Drink,
  // not Equip). Oils/philters/elixirs are scraped as Wondrous Items, so `type`
  // is corrected to Potion. Wikidot lumps some potions onto one page; those are
  // split here (the lumped slug becomes the first variant).
  // ══════════════════════════════════════════════════════════════════════════

  // ── Healing (wikidot page covers all four) ────────────────────────────────
  'potion-of-healing':           { rarity: 'Common', potion: { effect: '2d4+2 HP', healing: '2d4+2' },
    description: "You regain 2d4 + 2 hit points when you drink this potion. The potion's red liquid glimmers when agitated." },
  'potion-of-greater-healing':   { ...potionEntry('Potion of Greater Healing', 'Uncommon',
    "You regain 4d4 + 4 hit points when you drink this potion. The potion's red liquid glimmers when agitated."),
    potion: { effect: '4d4+4 HP', healing: '4d4+4' } },
  'potion-of-superior-healing':  { ...potionEntry('Potion of Superior Healing', 'Rare',
    "You regain 8d4 + 8 hit points when you drink this potion. The potion's red liquid glimmers when agitated."),
    potion: { effect: '8d4+8 HP', healing: '8d4+8' } },
  'potion-of-supreme-healing':   { ...potionEntry('Potion of Supreme Healing', 'Very Rare',
    "You regain 10d4 + 20 hit points when you drink this potion. The potion's red liquid glimmers when agitated."),
    potion: { effect: '10d4+20 HP', healing: '10d4+20' } },

  // ── Giant Strength (wikidot page covers all six) ──────────────────────────
  'potion-of-giant-strength':    { name: 'Potion of Hill Giant Strength', rarity: 'Uncommon', potion: { effect: 'STR 21 · 1 hr', duration: dur('1 hour', 60), abilityOverride: { str: 21 } },
    description: giantStrength('hill', 21) },
  'potion-of-frost-giant-strength': { ...potionEntry('Potion of Frost Giant Strength', 'Rare', giantStrength('frost', 23)), potion: { effect: 'STR 23 · 1 hr', duration: dur('1 hour', 60), abilityOverride: { str: 23 } } },
  'potion-of-stone-giant-strength': { ...potionEntry('Potion of Stone Giant Strength', 'Rare', giantStrength('stone', 23)), potion: { effect: 'STR 23 · 1 hr', duration: dur('1 hour', 60), abilityOverride: { str: 23 } } },
  'potion-of-fire-giant-strength':  { ...potionEntry('Potion of Fire Giant Strength', 'Rare', giantStrength('fire', 25)), potion: { effect: 'STR 25 · 1 hr', duration: dur('1 hour', 60), abilityOverride: { str: 25 } } },
  'potion-of-cloud-giant-strength': { ...potionEntry('Potion of Cloud Giant Strength', 'Very Rare', giantStrength('cloud', 27)), potion: { effect: 'STR 27 · 1 hr', duration: dur('1 hour', 60), abilityOverride: { str: 27 } } },
  'potion-of-storm-giant-strength': { ...potionEntry('Potion of Storm Giant Strength', 'Legendary', giantStrength('storm', 29)), potion: { effect: 'STR 29 · 1 hr', duration: dur('1 hour', 60), abilityOverride: { str: 29 } } },

  // ── Everything else ───────────────────────────────────────────────────────
  'potion-of-climbing':          { potion: { effect: 'Climb · 1 hr', duration: dur('1 hour', 60), extraSpeeds: [{ mode: 'climb' }], advantages: ['Athletics checks to climb'] } },
  'potion-of-watchful-rest':     { potion: { effect: 'No sleep · 8 hr', duration: dur('8 hours', 480), conditionImmunities: ['magical sleep'], note: 'You can stay awake during a long rest and still gain its benefits.' } },
  'potion-of-advantage':         { potion: { effect: 'Advantage ×1 · 1 hr', duration: dur('1 hour', 60), uses: 1, action: { name: 'Advantage', timing: 'When you roll', text: 'Advantage on one ability check, attack roll or saving throw.' } } },
  'potion-of-animal-friendship': { potion: { effect: 'DC 13 · 1 hr', duration: dur('1 hour', 60), action: { name: 'Animal Friendship', timing: 'Action, at will', range: '30 ft', save: { ability: 'wis', dc: 13 }, text: 'A beast with INT 3 or lower is charmed by you for 24 hours.' } } },
  'potion-of-fire-breath':       { potion: { effect: '4d6 fire ×3', duration: dur('1 hour', 60), uses: 3, action: { name: 'Exhale fire', timing: 'Bonus action', range: '30 ft', save: { ability: 'dex', dc: 13 }, damage: '4d6 fire', onSave: 'half' } } },
  'potion-of-growth':            { potion: { effect: 'Enlarge · 1d4 hr', duration: dur('1d4 hours', 240), weaponDamageDice: '+1d4', checkAdvantage: ['str'], saveAdvantage: ['str'], note: 'Large: you and everything you carry grow one size.' } },
  'potion-of-poison':            { potion: { effect: '3d6 poison', onDrink: { damage: { dice: '3d6', type: 'poison', save: { ability: 'con', dc: 13 }, failCondition: 'Poisoned', ongoingDice: 3 } } } },
  'potion-of-polychromy':        { potion: { effect: 'Colors · 1 hr', duration: dur('1 hour', 60), advantages: ['Stealth while matching your surroundings'], note: 'Bonus action: change to any colors you choose.' } },
  'potion-of-psionic-fortitude': { potion: { effect: 'vs Charm/Stun · 1 hr', duration: dur('1 hour', 60), advantages: ['Saves to avoid or end charmed and stunned'] } },
  'potion-of-resistance':        { potion: { effect: 'Resist ×1 · 1 hr', duration: dur('1 hour', 60), choice: { kind: 'damageType', label: 'Resistance to', options: ['acid', 'cold', 'fire', 'force', 'lightning', 'necrotic', 'poison', 'psychic', 'radiant', 'thunder'] } } },
  'potion-of-water-breathing':   { potion: { effect: 'Water breathing · 1 hr', duration: dur('1 hour', 60), note: 'You can breathe underwater.' } },
  'potion-of-aqueous-form':      { potion: { effect: 'Water form · 10 min', duration: dur('10 minutes', 10), extraSpeeds: [{ mode: 'swim', feet: 30 }], resistances: ['nonmagical damage'], saveAdvantage: ['str', 'dex', 'con'], note: "Pool of water: you can't talk, attack, cast spells or activate magic items." } },
  'potion-of-clairvoyance':      { potion: { effect: 'Clairvoyance', duration: dur('10 minutes', 10), note: 'Clairvoyance: an invisible sensor within 1 mile that you can see or hear through.' } },
  'potion-of-diminution':        { potion: { effect: 'Reduce · 1d4 hr', duration: dur('1d4 hours', 240), weaponDamageDice: '−1d4', checkDisadvantage: ['str'], saveDisadvantage: ['str'], note: 'Small: you and everything you carry shrink one size.' } },
  'potion-of-gaseous-form':      { potion: { effect: 'Gaseous · 1 hr', duration: dur('1 hour', 60), extraSpeeds: [{ mode: 'fly', feet: 10, hover: true }], resistances: ['nonmagical damage'], saveAdvantage: ['str', 'dex', 'con'], note: "Misty cloud: you can't talk, manipulate objects, attack or cast spells. Bonus action to end it early." } },
  'potion-of-heroism':           { potion: { effect: '10 temp HP + Bless', duration: dur('1 hour', 60), tempHp: 10, rollBonusDice: '+1d4', note: 'Bless, with no concentration needed.' } },
  'potion-of-invulnerability':   { potion: { effect: 'Resist all · 1 min', duration: dur('1 minute', 1), resistances: ['all damage'] } },
  'potion-of-maximum-power':     { potion: { effect: 'Max damage ×1', duration: dur('1 minute', 1), uses: 1, action: { name: 'Maximum Power', timing: 'Your next damaging spell', text: 'A damage spell of 4th level or lower deals maximum damage instead of rolling.' } } },
  'potion-of-mind-control':      { potion: { effect: 'Dominate · DC 15', duration: dur('1 hour', 60), uses: 1, action: { name: 'Dominate', timing: 'Action, by the end of your next turn', range: '60 ft', save: { ability: 'wis', dc: 15 }, text: 'On a failure the target is charmed for 1 hour (no concentration) and has disadvantage on saves to break free.' } } },
  'potion-of-mind-reading':      { potion: { effect: 'Detect Thoughts · DC 13', duration: dur('1 minute', 1), action: { name: 'Detect Thoughts', timing: 'Action', range: '30 ft', save: { ability: 'wis', dc: 13 }, text: 'Read surface thoughts; probing deeper lets the target make the save.' } } },
  'potion-of-flying':            { potion: { effect: 'Fly · 1 hr', duration: dur('1 hour', 60), extraSpeeds: [{ mode: 'fly', hover: true }], note: "If you're in the air when it ends, you fall." } },
  'potion-of-invisibility':      { potion: { effect: 'Invisible · 1 hr', duration: dur('1 hour', 60), conditions: ['Invisible'], note: 'Ends early if you attack or cast a spell.' } },
  'potion-of-longevity':         { potion: { effect: '−1d6+6 years', note: 'Your physical age drops by 1d6 + 6 years (minimum 13). Each later dose has a cumulative 10% chance of aging you instead.' } },
  'potion-of-possibility':       { potion: { effect: '2 fragments · 8 hr', duration: dur('8 hours', 480), uses: 2, action: { name: 'Fragment of Possibility', timing: 'When you roll, or are attacked', text: 'Roll an extra d20 and choose which to use.' } } },
  'potion-of-speed':             { potion: { effect: 'Haste · 1 min', duration: dur('1 minute', 1), acBonus: 2, speedMultiplier: 2, saveAdvantage: ['dex'], note: 'One extra action each turn (one weapon attack, Dash, Disengage, Hide or Use an Object). When it ends you can\'t move or act until after your next turn.' } },
  'potion-of-vitality':          { potion: { effect: 'Cure + max Hit Dice', duration: dur('24 hours', 1440), onDrink: { clearExhaustion: true, removeConditions: ['Poisoned'] }, note: 'Hit Dice you spend heal their maximum.' } },
  'potion-of-dragons-majesty':   { potion: { effect: 'Adult dragon · 1 hr', duration: dur('1 hour', 60), note: "You're an adult dragon of the scale's kind: use its game statistics (HP, AC, attacks, breath weapon)." } },
  'potion-of-giant-size':        { potion: { effect: 'Huge · 24 hr', duration: dur('24 hours', 1440), abilityOverride: { str: 25 }, hpMaxMultiplier: 2, note: 'Huge. Melee reach +5 ft; enlarged weapons roll triple damage dice. When it ends, HP above your max become temp HP.' } },
  'oil-of-slipperiness':         { type: 'Potion', potion: { effect: 'Freedom of Movement · 8 hr', duration: dur('8 hours', 480), conditionImmunities: ['paralyzed (by magic)', 'restrained (by magic)'], note: 'Freedom of Movement: difficult terrain costs no extra movement; 5 ft of movement escapes nonmagical restraints or grapples.' } },
  'philter-of-love':             { type: 'Potion', potion: { effect: 'Charmed · 1 hr', duration: dur('1 hour', 60), note: 'The first creature you see within 10 minutes of drinking charms you for 1 hour.' } },
  'elixir-of-health':            { type: 'Potion', potion: { effect: 'Cure disease & conditions', onDrink: { removeConditions: ['Blinded', 'Deafened', 'Paralyzed', 'Poisoned'] } } },
  'oil-of-etherealness':         { type: 'Potion', potion: { effect: 'Etherealness · 1 hr', duration: dur('1 hour', 60), note: 'Etherealness: you move through the Ethereal Plane, passing through objects and creatures, and only interact with other ethereal things.' } },
  'oil-of-sharpness':            { type: 'Potion', potion: { effect: '+3 weapon · 1 hr', duration: dur('1 hour', 60), choice: { kind: 'weapon', label: 'Coat which weapon?' }, weaponBonus: 3 } },
}

// Full item fields for potions that exist only in this overlay (overlay-only entries
// skip schema parsing, so every required ItemDef field must be present).
function potionEntry(name: string, rarity: string, description: string): Partial<ItemDef> {
  return {
    name, type: 'Potion', rarity, attunement: false, description,
    source: { site: 'dnd5e.wikidot.com', license: 'CC BY-SA 3.0', url: '' },
  }
}

function dur(label: string, minutes: number): { label: string; minutes: number } {
  return { label, minutes }
}

function giantStrength(giant: string, score: number): string {
  return `When you drink this potion, your Strength score becomes ${score} for 1 hour. This potion has no effect on you if your Strength is equal to or greater than that score. This potion's transparent liquid has floating in it a sliver of fingernail from a ${giant} giant.`
}
