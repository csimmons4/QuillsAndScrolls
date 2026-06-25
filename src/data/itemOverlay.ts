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
  'bracers-of-defense':      { acBonus: 2 },  // RAW: only when unarmored & no shield

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
}
