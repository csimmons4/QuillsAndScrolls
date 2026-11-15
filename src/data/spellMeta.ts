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
  'booming-blade':        { die: 'd8',  base: 1 }, // the damage if the target moves: 1d8 → 4d8 (on hit it's one die fewer)
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

// Ritual spells, as tagged on the wiki ("1st-level divination (ritual)"). The scraper records
// the tag on each spell too; this list is the fallback for spell data scraped before it did.
export const RITUAL_SLUGS = new Set([
  'alarm', 'animal-messenger', 'augury', 'beast-sense', 'ceremony', 'commune',
  'commune-with-city', 'commune-with-nature', 'comprehend-languages',
  'contact-other-plane', 'detect-magic', 'detect-poison-and-disease', 'divination',
  'drawmijs-instant-summons', 'feign-death', 'find-familiar', 'forbiddance',
  'gentle-repose', 'guiding-hand-ua', 'identify', 'illusory-script', 'leomunds-tiny-hut',
  'locate-animals-or-plants', 'magic-mouth', 'meld-into-stone', 'phantom-steed',
  'purify-food-and-drink', 'rarys-telepathic-bond', 'silence', 'skywrite',
  'speak-with-animals', 'tensers-floating-disk', 'unseen-servant', 'water-breathing',
  'water-walk', 'wild-cunning', 'wristpocket',
])

/** Cantrip damage dice at the given character level, without the damage type. `baseDice` is the
 *  spell's level-1 dice ("1d6"), used to scale cantrips that aren't in the table. */
export function cantripDiceAtLevel(spellSlug: string, charLevel: number, baseDice?: string): string | null {
  const tier = charLevel >= 17 ? 3 : charLevel >= 11 ? 2 : charLevel >= 5 ? 1 : 0
  const sc = CANTRIP_SCALING[spellSlug]
  if (!sc) {
    const m = baseDice?.match(/^(\d+)(d\d+)$/)
    return m ? `${parseInt(m[1], 10) + tier}${m[2]}` : null
  }
  if (spellSlug === 'eldritch-blast') return `${tier + 1}× 1${sc.die}`  // more beams, not more dice
  const count = sc.base + tier
  return count > 0 ? `${count}${sc.die}` : null  // Green-Flame Blade adds no dice before level 5
}
