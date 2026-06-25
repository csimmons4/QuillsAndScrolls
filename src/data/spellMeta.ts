// Cantrip damage scaling table + ritual-spell slug set.
//
// The rest of the spell metadata (concentration, ritual, components parsed,
// damage, saving throw, attack roll) is now derived at content-merge time in
// src/content/spellDerivation.ts and lives on the SpellDef itself. Consumers
// should read `def.concentration` etc. directly. This file keeps only the two
// pieces that aren't derivable from the scraped prose: per-cantrip scaling
// dice (level-dependent, so computed at render time) and the hand-curated
// ritual list (the scraped castingTime doesn't carry the ritual tag).

// Standard cantrip scaling: base die count at L1, +1 die per tier (L5/11/17)
const CANTRIP_SCALING: Record<string, { die: string; base: number }> = {
  'acid-splash':          { die: 'd6',  base: 1 },
  'booming-blade':        { die: 'd8',  base: 0 }, // special: 0 + 1d8 / 1d8 / 2d8 / 3d8 thunder
  'chill-touch':          { die: 'd8',  base: 1 },
  'create-bonfire':       { die: 'd8',  base: 1 },
  'eldritch-blast':       { die: 'd10', base: 1 }, // special: beams scale, not dice
  'fire-bolt':            { die: 'd10', base: 1 },
  'frostbite':            { die: 'd6',  base: 1 },
  'green-flame-blade':    { die: 'd8',  base: 0 },
  'infestation':          { die: 'd6',  base: 1 },
  'lightning-lure':       { die: 'd8',  base: 1 },
  'mind-sliver':          { die: 'd6',  base: 1 },
  'poison-spray':         { die: 'd12', base: 1 },
  'primal-savagery':      { die: 'd10', base: 1 },
  'produce-flame':        { die: 'd8',  base: 1 },
  'ray-of-frost':         { die: 'd8',  base: 1 },
  'sacred-flame':         { die: 'd8',  base: 1 },
  'shadow-blade-flourish':{ die: 'd6',  base: 1 },
  'shocking-grasp':       { die: 'd8',  base: 1 },
  'sword-burst':          { die: 'd6',  base: 1 },
  'thunderclap':          { die: 'd6',  base: 1 },
  'toll-the-dead':        { die: 'd8',  base: 1 }, // d12 vs wounded
  'vicious-mockery':      { die: 'd4',  base: 1 },
  'word-of-radiance':     { die: 'd6',  base: 1 },
  'wrathful-smite':       { die: 'd6',  base: 1 },
}

// Spells with known ritual tag (not in scraped data)
export const RITUAL_SLUGS = new Set([
  'alarm', 'animal-messenger', 'augury', 'beast-bond', 'beast-sense',
  'ceremony', 'comprehend-languages', 'contact-other-plane', 'continual-flame',
  'detect-magic', 'detect-poison-and-disease', 'detect-thoughts',
  'drawmijs-instant-summons', 'etherealness', 'feather-fall',
  'find-familiar', 'forbiddance', 'gentle-repose', 'identify',
  'illusory-script', 'leomunds-tiny-hut', 'leomund-tiny-hut',
  'locate-animals-or-plants', 'mages-manifold', 'magic-mouth',
  'nondetection', 'pass-without-trace', 'phantom-steed',
  'purify-food-and-drink', 'rary-telepathic-bond', 'rite-of-the-frozen-one',
  'rope-trick', 'see-invisibility', 'speak-with-animals',
  'speak-with-dead', 'speak-with-plants', 'tenser-floating-disk',
  'tongues', 'unseen-servant', 'water-breathing', 'water-walk',
  'wind-wall', 'witch-bolt',
])

/** Get cantrip damage dice at the given character level. Returns null for non-cantrips or unknown cantrips. */
export function cantripDiceAtLevel(spellSlug: string, charLevel: number): string | null {
  const sc = CANTRIP_SCALING[spellSlug]
  if (!sc) return null
  if (spellSlug === 'eldritch-blast') {
    const beams = charLevel >= 17 ? 4 : charLevel >= 11 ? 3 : charLevel >= 5 ? 2 : 1
    return `${beams}× ${sc.die} force`
  }
  const tier = charLevel >= 17 ? 3 : charLevel >= 11 ? 2 : charLevel >= 5 ? 1 : 0
  const count = sc.base + tier
  return count > 0 ? `${count}${sc.die}` : `${sc.die}`
}
