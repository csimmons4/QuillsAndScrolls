import type { SpellDef } from '../content/loaders'

/**
 * Curated overlay for spells. Keyed by spell slug.
 *
 * Most enrichment now happens at merge time in src/content/spellDerivation.ts
 * (concentration from duration, ritual from RITUAL_SLUGS, damage from
 * "Xd_ TYPE damage" prose, saving throw from "X saving throw", etc.). This file
 * handles the residue:
 *
 *  1. Variable-type spells where the damage type is player-chosen or randomized
 *     (Chromatic Orb, Chaos Bolt, Dragon's Breath, etc.). We mark type as
 *     `'varies'` so consumers can detect the case rather than mis-display a
 *     specific element.
 *  2. Anything the derivation gets wrong — overlay wins.
 *
 * Audit via `npm run audit:content` to see which slugs still need filling.
 */
export const SPELL_OVERLAY: Record<string, Partial<SpellDef>> = {
  // ── Variable-type damage (player chooses element / random table) ──────────
  'arcane-weapon':      { damage: { dice: '1d6',     type: 'varies' } },
  'chaos-bolt':         { damage: { dice: '2d8+1d6', type: 'varies' } },
  'chromatic-orb':      { damage: { dice: '3d8',     type: 'varies' } },
  'dragons-breath':     { damage: { dice: '3d6',     type: 'varies' } },
  'elemental-weapon':   { damage: { dice: '1d4',     type: 'varies' } },
  'spirit-shroud':      { damage: { dice: '1d8',     type: 'varies' } },
  'elemental-bane':     { damage: { dice: '2d6',     type: 'varies' } },
  'illusory-dragon':    { damage: { dice: '7d6',     type: 'varies' } },

  // ── Damage type from weapon/ammo used ─────────────────────────────────────
  'conjure-barrage':    { damage: { dice: '3d8',     type: 'varies' } },
  'conjure-volley':     { damage: { dice: '8d8',     type: 'varies' } },

  // ── Missing class lists (scraper failed to capture) ──────────────────────
  'encode-thoughts':      { classLists: ['wizard'] },
  'hand-of-radiance':     { classLists: ['cleric'] },
  'fast-friends':         { classLists: ['bard', 'wizard'] },
  'intellect-fortress':   { classLists: ['artificer', 'sorcerer', 'warlock', 'wizard'] },
  'life-transference':    { classLists: ['cleric', 'wizard'] },
  'motivational-speech':  { classLists: ['bard'] },

  // ── Flat damage (no dice notation — auto-derivation always misses these) ──
  // armor-of-agathys: "takes 5 cold damage" (scales by slot: +5 per level)
  'armor-of-agathys': { damage: { dice: '5', type: 'cold' } },
  // guardian-of-faith: deals exactly 20 radiant (10 on successful DEX save)
  'guardian-of-faith': { damage: { dice: '20', type: 'radiant' }, savingThrow: { ability: 'dex', effectOnSave: 'half' } },

  // ── Wrong dice picked by auto-derivation ─────────────────────────────────
  // enervation: description mentions 2d8 (success) before 4d8 (failure) — fix to primary
  'enervation': { damage: { dice: '4d8', type: 'necrotic' }, savingThrow: { ability: 'dex', effectOnSave: 'half' } },
  // teleport: derivation picks up "1d10" from the mishap roll table, not damage
  'teleport': { damage: undefined },
  // animate-objects: derivation picks Tiny-object attack dice; the spell itself has no fixed damage
  'animate-objects': { damage: undefined },
  // web: derivation picks up "2d4 fire damage" from the clause about webs burning when exposed to fire
  'web': { damage: undefined },
}
