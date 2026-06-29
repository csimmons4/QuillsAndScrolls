import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { listCharactersFromDisk, saveCharacterToDisk } from '../storage/charApi'
import { useContent } from '../content/ContentProvider'
import { applyLevelUp, LevelUpChoices, asiLevelsForClass } from '../character/levelUp'
import { totalLevel, profBonus } from '../character/derive'
import { ABILITIES, Character, SKILLS, SKILL_LABELS } from '../character/model'
import {
  CLASS_OPTIONS, slotsForLevel, PACT_SLOT_TABLE,
  ELDRITCH_INVOCATIONS, METAMAGIC_OPTIONS, ARTIFICER_INFUSIONS,
  BATTLE_MASTER_MANEUVERS, MULTICLASS_PROF_GRANTS,
  LAND_CIRCLE_SPELLS, RUNE_KNIGHT_RUNES, HUNTER_CHOICES,
  TOTEM_ANIMALS, TOTEM_TIER_LEVELS, STORM_AURA_OPTIONS, FOUR_ELEMENTS_DISCIPLINES,
  spellcastingClasses, multiclassSpellSlotsMax,
} from '../data/classData'
import { FeatPicker } from '../components/FeatPicker'
import { FeatGrantsBlock } from '../components/FeatGrantsBlock'
import { InlinePicker } from '../components/InlinePicker'
import { resolveFeatGrants, applyGrantPicks, withFeatClassChoice } from '../character/grants'

const MULTICLASS_PREREQS: Record<string, (s: { str: number; dex: number; con: number; int: number; wis: number; cha: number }) => boolean> = {
  barbarian: s => s.str >= 13,
  bard:      s => s.cha >= 13,
  cleric:    s => s.wis >= 13,
  druid:     s => s.wis >= 13,
  fighter:   s => s.str >= 13 || s.dex >= 13,
  monk:      s => s.dex >= 13 && s.wis >= 13,
  paladin:   s => s.str >= 13 && s.cha >= 13,
  ranger:    s => s.dex >= 13 && s.wis >= 13,
  rogue:     s => s.dex >= 13,
  sorcerer:  s => s.cha >= 13,
  warlock:   s => s.cha >= 13,
  wizard:    s => s.int >= 13,
  artificer: s => s.int >= 13,
}

const MULTICLASS_PREREQ_LABEL: Record<string, string> = {
  barbarian: 'STR 13',
  bard:      'CHA 13',
  cleric:    'WIS 13',
  druid:     'WIS 13',
  fighter:   'STR 13 or DEX 13',
  monk:      'DEX 13 & WIS 13',
  paladin:   'STR 13 & CHA 13',
  ranger:    'DEX 13 & WIS 13',
  rogue:     'DEX 13',
  sorcerer:  'CHA 13',
  warlock:   'CHA 13',
  wizard:    'INT 13',
  artificer: 'INT 13',
}

const CLASS_SECRET_LANGUAGES: Record<string, string> = {
  druid: 'Druidic',
  rogue: "Thieves' Cant",
}

const ABILITY_LABELS: Record<string, string> = {
  str: 'Strength', dex: 'Dexterity', con: 'Constitution',
  int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma',
}

function InfusionSwap({ currentInfusions, infusionToSwapOut, infusionToSwapIn, nextLevel, setInfusionToSwapOut, setInfusionToSwapIn, alreadyGaining }: {
  currentInfusions: string[]
  infusionToSwapOut: string
  infusionToSwapIn: string
  nextLevel: number
  setInfusionToSwapOut: (s: string) => void
  setInfusionToSwapIn: (s: string) => void
  alreadyGaining: string[]
}) {
  return (
    <div className="mt-3 pt-3 border-t border-parchment-100">
      <div className="text-xs font-semibold text-parchment-600 uppercase tracking-wide mb-2">Replace an Infusion <span className="font-normal text-parchment-400">(optional)</span></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <div className="text-xs text-parchment-500 mb-1">Remove</div>
          <select
            className="input text-sm py-1"
            value={infusionToSwapOut}
            onChange={e => { setInfusionToSwapOut(e.target.value); setInfusionToSwapIn('') }}
          >
            <option value="">— keep all —</option>
            {currentInfusions.map(slug => {
              const inf = ARTIFICER_INFUSIONS.find(i => i.slug === slug)
              return <option key={slug} value={slug}>{inf?.name ?? slug}</option>
            })}
          </select>
        </div>
        <div>
          <div className="text-xs text-parchment-500 mb-1">Replace with</div>
          <select
            className="input text-sm py-1"
            value={infusionToSwapIn}
            onChange={e => setInfusionToSwapIn(e.target.value)}
            disabled={!infusionToSwapOut}
          >
            <option value="">— choose —</option>
            {ARTIFICER_INFUSIONS
              .filter(inf => !currentInfusions.includes(inf.slug) || inf.slug === infusionToSwapOut)
              .filter(inf => inf.slug !== infusionToSwapOut)
              .filter(inf => !alreadyGaining.includes(inf.slug))
              .filter(inf => !inf.levelRequirement || nextLevel >= inf.levelRequirement)
              .map(inf => (
                <option key={inf.slug} value={inf.slug}>{inf.name}</option>
              ))}
          </select>
        </div>
      </div>
      {infusionToSwapOut && infusionToSwapIn && (
        <p className="text-xs text-green-700 mt-2">
          Will replace <strong>{ARTIFICER_INFUSIONS.find(i => i.slug === infusionToSwapOut)?.name}</strong> with <strong>{ARTIFICER_INFUSIONS.find(i => i.slug === infusionToSwapIn)?.name}</strong>
        </p>
      )}
    </div>
  )
}

export default function LevelUp() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const content = useContent()
  const [char, setChar] = useState<Character | null>(null)

  useEffect(() => {
    if (!id) return
    listCharactersFromDisk().then(chars => {
      setChar(chars.find(c => c.id === id) ?? null)
    })
  }, [id])

  const [selectedClass, setSelectedClass] = useState(char?.classes[0]?.classSlug ?? '')
  const [hpRoll, setHpRoll] = useState<number | null>(null)
  const [useAverage, setUseAverage] = useState(true)
  const [asiChoice, setAsiChoice] = useState<'asi' | 'feat'>('asi')
  const [ability1, setAbility1] = useState('str')
  const [ability2, setAbility2] = useState('str')
  const [featSlug, setFeatSlug] = useState('')
  const [featGrants, setFeatGrants] = useState<Record<string, string[]>>({})
  const [featClass, setFeatClass] = useState('')
  const [subclass, setSubclass] = useState('')
  const [newSpells, setNewSpells] = useState<string[]>([])
  const [newCantrips, setNewCantrips] = useState<string[]>([])
  const [expertiseChoices, setExpertiseChoices] = useState<string[]>([])
  const [invocationChoices, setInvocationChoices] = useState<string[]>([])
  const [metamagicChoices, setMetamagicChoices] = useState<string[]>([])
  const [infusionChoices, setInfusionChoices] = useState<string[]>([])
  const [infusionToSwapOut, setInfusionToSwapOut] = useState('')
  const [infusionToSwapIn, setInfusionToSwapIn] = useState('')
  const [spellToForget, setSpellToForget] = useState('')
  const [cantripToForget, setCantripToForget] = useState('')
  const [newSpellSearch, setNewSpellSearch] = useState('')
  const [multiclassSkill, setMulticlassSkill] = useState('')
  const [pactBoon, setPactBoon] = useState('')
  const [maneuverChoices, setManeuverChoices] = useState<string[]>([])
  const [favoredEnemy, setFavoredEnemy] = useState('')
  const [favoredTerrain, setFavoredTerrain] = useState('')
  const [fightingStyle, setFightingStyle] = useState('')
  const [landTerrain, setLandTerrain] = useState('')
  const [runeChoices, setRuneChoices] = useState<string[]>([])
  const [hunterChoice, setHunterChoice] = useState('')
  const [showAllSchools, setShowAllSchools] = useState(false)
  const [totemAnimal, setTotemAnimal] = useState('')
  const [stormAura, setStormAura] = useState('')
  const [fourElementsChoices, setFourElementsChoices] = useState<string[]>([])

  if (!char) {
    return (
      <div className="text-center py-20 text-parchment-500">
        <p>Character not found.</p>
        <Link to="/" className="btn-primary mt-4 inline-block">Back to Vault</Link>
      </div>
    )
  }

  const cls = content.classes.find(c => c.slug === selectedClass)
  const currentEntry = char.classes.find(c => c.classSlug === selectedClass)
  const nextLevel = (currentEntry?.level ?? 0) + 1
  const hitDie = cls?.hitDie ?? 8
  const avgRoll = Math.floor(hitDie / 2) + 1
  const effectiveHpRoll = useAverage ? avgRoll : (hpRoll ?? 1)

  const totalLvl = totalLevel(char)
  const newTotalLevel = totalLvl + 1
  const pb = profBonus({ ...char, classes: char.classes.map(c => c.classSlug === selectedClass ? { ...c, level: c.level + 1 } : c) })

  const classOptsDef = CLASS_OPTIONS[selectedClass]
  const isAsiLevel = asiLevelsForClass(selectedClass).includes(nextLevel)
  const isExpertiseLevel = classOptsDef?.expertiseAt?.includes(nextLevel) ?? false
  const expertiseCount = classOptsDef?.expertiseCount ?? 2
  const classFeatureAtLevel = classOptsDef?.features.filter(f => f.level === nextLevel) ?? cls?.features.filter(f => f.level === nextLevel) ?? []
  const availableSubclasses = classOptsDef?.subclasses ?? []
  const subclassLevel = availableSubclasses[0]?.level ?? 3
  const needsSubclass = nextLevel === subclassLevel && !currentEntry?.subclassSlug
  // Subclass features gained at this level — covers the existing subclass and one
  // picked during this level-up (e.g. the L3 subclass choice grants its own L3 features).
  const effectiveSubclassSlug = currentEntry?.subclassSlug ?? (subclass || undefined)
  const subclassFeatureAtLevel = effectiveSubclassSlug
    ? (availableSubclasses.find(s => s.slug === effectiveSubclassSlug)?.features?.filter(f => f.level === nextLevel) ?? [])
    : []

  // Cantrip gain
  const isNewCantripLevel = classOptsDef?.cantripsAtLevel?.includes(nextLevel) ?? false

  // Spells known (known-spell casters)
  const spellsKnownMax = classOptsDef?.spellsKnownTable?.[nextLevel - 1]
  const currentSpellCount = char.spells.filter(s => s.classSlug === selectedClass).length

  // Eldritch Invocations (Warlock)
  const invocationsTotal = classOptsDef?.invocationsAtLevel?.[nextLevel - 1] ?? 0
  const existingInvocationsFC = char.featuresChosen.find(fc => fc.key === 'invocations')
  const currentInvocations: string[] = (() => {
    if (!existingInvocationsFC) return []
    const v = existingInvocationsFC.value
    return Array.isArray(v) ? v : [v]
  })()
  const invocationsToGain = Math.max(0, invocationsTotal - currentInvocations.length)

  // Metamagic (Sorcerer)
  const metamagicTotal = classOptsDef?.metamagicAtLevel?.[nextLevel - 1] ?? 0
  const existingMetamagicFC = char.featuresChosen.find(fc => fc.key === 'metamagic')
  const currentMetamagic: string[] = (() => {
    if (!existingMetamagicFC) return []
    const v = existingMetamagicFC.value
    return Array.isArray(v) ? v : [v]
  })()
  const metamagicToGain = Math.max(0, metamagicTotal - currentMetamagic.length)

  // Infusions (Artificer)
  const infusionsTotal = classOptsDef?.infusionsKnownAtLevel?.[nextLevel - 1] ?? 0
  const existingInfusionsFC = char.featuresChosen.find(fc => fc.key === 'infusions')
  const currentInfusions: string[] = (() => {
    if (!existingInfusionsFC) return []
    const v = existingInfusionsFC.value
    return Array.isArray(v) ? v : [v]
  })()
  const infusionsToGain = Math.max(0, infusionsTotal - currentInfusions.length)

  // Battle Master maneuvers (Fighter: Battle Master subclass)
  const BM_MANEUVERS_AT_LEVEL: Record<number, number> = { 3: 3, 7: 5, 10: 9 }
  const bmTotalManeuvers = (effectiveSubclassSlug === 'battle-master')
    ? (BM_MANEUVERS_AT_LEVEL[nextLevel] ?? 0)
    : 0
  const existingManeuversFC = char.featuresChosen.find(fc => fc.key === 'maneuvers')
  const currentManeuvers: string[] = (() => {
    if (!existingManeuversFC) return []
    const v = existingManeuversFC.value
    return Array.isArray(v) ? v : [v]
  })()
  const maneuversToGain = Math.max(0, bmTotalManeuvers - currentManeuvers.length)

  // Warlock Pact Boon (level 3)
  const needsPactBoon = selectedClass === 'warlock' && nextLevel === 3
    && !char.featuresChosen.find(fc => fc.key === 'pact-boon')

  // Multiclass skill grant
  const isMulticlassing = !char.classes.find(c => c.classSlug === selectedClass)
  const multiclassGrant = isMulticlassing ? MULTICLASS_PROF_GRANTS[selectedClass] : undefined
  const needsMulticlassSkill = !!(multiclassGrant?.skills?.count)

  // Ranger favored enemy / terrain choices at specific levels
  const rangerFavoredEnemyLevels = [1, 6, 14]
  const rangerTerrainLevels = [1, 6, 10]
  const needsFavoredEnemy = selectedClass === 'ranger' && rangerFavoredEnemyLevels.includes(nextLevel)
  const needsFavoredTerrain = selectedClass === 'ranger' && rangerTerrainLevels.includes(nextLevel)

  // Fighting Style (Fighter L1, Paladin L2, Ranger L2)
  const FIGHTING_STYLE_LEVEL: Record<string, number> = { fighter: 1, paladin: 2, ranger: 2 }
  const alreadyHasFightingStyle = char.featuresChosen.some(f =>
    f.key === 'fighting-style' || f.key === `fighting-style-${selectedClass}`
  )
  const needsFightingStyle = !!(classOptsDef?.fightingStyles?.length) &&
    nextLevel === FIGHTING_STYLE_LEVEL[selectedClass] &&
    !alreadyHasFightingStyle

  // Circle of the Land terrain
  const needsLandTerrain = selectedClass === 'druid' &&
    (subclass === 'land' || effectiveSubclassSlug === 'land') &&
    !char.featuresChosen.find(f => f.key === 'land-terrain')

  // Rune Knight runes
  const existingRunesFC = char.featuresChosen.find(fc => fc.key === 'runes')
  const currentRunes: string[] = !existingRunesFC ? [] : Array.isArray(existingRunesFC.value) ? existingRunesFC.value : [existingRunesFC.value]
  const RUNE_MAX_AT: Record<number, number> = { 3: 2, 7: 3, 10: 4, 15: 5 }
  const needsRunesTotal = selectedClass === 'fighter' && effectiveSubclassSlug === 'rune-knight'
    ? (RUNE_MAX_AT[nextLevel] ?? 0) : 0
  const runesToGain = Math.max(0, needsRunesTotal - currentRunes.length)

  // Hunter subclass choices
  const isHunterRanger = selectedClass === 'ranger' && effectiveSubclassSlug === 'hunter'
  const HUNTER_CHOICE_LEVELS = [3, 7, 11, 15]
  const needsHunterChoice = isHunterRanger && HUNTER_CHOICE_LEVELS.includes(nextLevel) &&
    !char.featuresChosen.find(f => f.key === `hunter-${nextLevel}`)

  // Barbarian Totem Warrior choices
  const isTotemWarrior = selectedClass === 'barbarian' && effectiveSubclassSlug === 'totem-warrior'
  const totemTierKey = isTotemWarrior
    ? (nextLevel >= 14 && !char.featuresChosen.find(f => f.key === 'totem-attunement') ? 'totem-attunement'
      : nextLevel >= 6 && !char.featuresChosen.find(f => f.key === 'totem-aspect') ? 'totem-aspect'
      : nextLevel >= 3 && !char.featuresChosen.find(f => f.key === 'totem-spirit') ? 'totem-spirit'
      : null)
    : null
  const needsTotemChoice = !!totemTierKey

  // Barbarian Storm Herald aura choice
  const isStormHerald = selectedClass === 'barbarian' && effectiveSubclassSlug === 'storm-herald'
  const needsStormAura = isStormHerald && nextLevel >= 3 && !char.featuresChosen.find(f => f.key === 'storm-aura')

  // Monk Four Elements disciplines
  const isFourElements = selectedClass === 'monk' && effectiveSubclassSlug === 'four-elements'
  const existingDisciplines = (() => {
    const fc = char.featuresChosen.find(f => f.key === 'four-elements')
    if (!fc) return []
    return Array.isArray(fc.value) ? fc.value : [fc.value]
  })()
  const FOUR_ELEMENTS_DISC_AT: Record<number, number> = { 3: 2, 6: 1, 11: 1, 17: 1 }
  const disciplinesToGain = isFourElements ? (FOUR_ELEMENTS_DISC_AT[nextLevel] ?? 0) : 0
  const needsFourElements = disciplinesToGain > 0

  // EK / Arcane Trickster school restriction
  const ekRestriction = selectedClass === 'fighter' && effectiveSubclassSlug === 'eldritch-knight'
  const atRestriction = selectedClass === 'rogue' && effectiveSubclassSlug === 'arcane-trickster'
  const FREE_SCHOOL_LEVELS = [8, 14, 20]

  async function finish() {
    if (!char) return
    const featureChoices = [
      ...(invocationsToGain > 0 && invocationChoices.length > 0 ? [{
        key: 'invocations' as const,
        value: [...currentInvocations, ...invocationChoices],
      }] : []),
      ...(metamagicToGain > 0 && metamagicChoices.length > 0 ? [{
        key: 'metamagic' as const,
        value: [...currentMetamagic, ...metamagicChoices],
      }] : []),
      ...(infusionsToGain > 0 && infusionChoices.length > 0 ? [{
        key: 'infusions' as const,
        value: (() => {
          let list = [...currentInfusions, ...infusionChoices]
          if (infusionToSwapOut && infusionToSwapIn && list.includes(infusionToSwapOut)) {
            list = list.filter(s => s !== infusionToSwapOut)
            if (!list.includes(infusionToSwapIn)) list.push(infusionToSwapIn)
          }
          return list
        })(),
      }] : infusionToSwapOut && infusionToSwapIn && currentInfusions.length > 0 ? [{
        key: 'infusions' as const,
        value: currentInfusions
          .filter(s => s !== infusionToSwapOut)
          .concat(currentInfusions.includes(infusionToSwapIn) ? [] : [infusionToSwapIn]),
      }] : []),
      ...(maneuversToGain > 0 && maneuverChoices.length > 0 ? [{
        key: 'maneuvers' as const,
        value: [...currentManeuvers, ...maneuverChoices],
      }] : []),
      ...(pactBoon ? [{ key: 'pact-boon' as const, value: pactBoon }] : []),
      ...(needsFavoredEnemy && favoredEnemy ? [{ key: `favored-enemy-${nextLevel}` as const, value: favoredEnemy }] : []),
      ...(needsFavoredTerrain && favoredTerrain ? [{ key: `favored-terrain-${nextLevel}` as const, value: favoredTerrain }] : []),
    ]
    const choices: LevelUpChoices = {
      classSlug: selectedClass,
      hpRoll: effectiveHpRoll,
      subclassSlug: subclass || undefined,
      newSaveProficiencies: isMulticlassing ? (cls?.saveProficiencies ?? []) : undefined,
      multiclassSkill: needsMulticlassSkill ? multiclassSkill : undefined,
      fightingStyle: needsFightingStyle && fightingStyle ? fightingStyle : undefined,
      landTerrain: needsLandTerrain && landTerrain ? landTerrain : undefined,
      runeChoices: runesToGain > 0 && runeChoices.length > 0 ? runeChoices : undefined,
      hunterChoice: needsHunterChoice && hunterChoice ? hunterChoice : undefined,
      totemTierKey: needsTotemChoice && totemAnimal ? totemTierKey! : undefined,
      totemAnimal: needsTotemChoice && totemAnimal ? totemAnimal : undefined,
      stormAura: needsStormAura && stormAura ? stormAura : undefined,
      fourElementsDisciplines: needsFourElements && fourElementsChoices.length > 0 ? fourElementsChoices : undefined,
      asiOrFeat: isAsiLevel
        ? (asiChoice === 'asi'
          ? { type: 'asi', ability1, ability2 }
          : { type: 'feat', featSlug })
        : undefined,
      spellsKnown: [...newSpells, ...newCantrips],
      newSkillExpertise: isExpertiseLevel ? expertiseChoices : undefined,
      featureChoices: featureChoices.length > 0 ? featureChoices : undefined,
    }
    let updated = applyLevelUp(char, choices)

    // Update spell slots — multiclass table or single-class progression
    const spCasters = spellcastingClasses(updated.classes)
    if (spCasters.length >= 2) {
      // PHB p.165: combine all non-pact caster levels via the multiclass slot table
      const newMaxes = multiclassSpellSlotsMax(updated.classes)
      if (Object.keys(newMaxes).length > 0) {
        const merged: Character['spellSlots'] = {}
        for (const [lvl, max] of Object.entries(newMaxes)) {
          merged[lvl] = { max, used: updated.spellSlots[lvl]?.used ?? 0 }
        }
        updated = { ...updated, spellSlots: merged }
      }
    } else if (spCasters.length === 1) {
      // Single spellcasting class: use its own progression table
      const spCls = spCasters[0]
      const spClsDef = content.classes.find(c => c.slug === spCls.classSlug)
      const newSlots = slotsForLevel(spCls.classSlug, spCls.level, spClsDef?.spellSlotTable)
      if (newSlots) {
        // Start from existing slots so we never drop a level that isn't in the new row
        const merged: Character['spellSlots'] = { ...updated.spellSlots }
        for (const [lvl, slot] of Object.entries(newSlots)) {
          merged[lvl] = { max: slot.max, used: Math.min(updated.spellSlots[lvl]?.used ?? 0, slot.max) }
        }
        updated = { ...updated, spellSlots: merged }
      }
    }
    // 0 spellcasting classes (Warlock-only or non-casters): don't touch spellSlots

    // Pact slot update for Warlock
    const warlockEntry = updated.classes.find(c => c.classSlug === 'warlock')
    if (warlockEntry) {
      const wlvl = warlockEntry.level
      if (wlvl >= 1 && wlvl <= 20) {
        const [slotLevel, numSlots] = PACT_SLOT_TABLE[wlvl - 1]
        const existingUsed = updated.pactSlots?.used ?? 0
        updated = { ...updated, pactSlots: { level: slotLevel, max: numSlots, used: Math.min(existingUsed, numSlots) } }
      }
    }

    // Spell/cantrip swap for known-spell casters
    if (spellToForget) {
      updated = { ...updated, spells: updated.spells.filter(s => s.spellSlug !== spellToForget) }
    }
    if (cantripToForget) {
      updated = { ...updated, spells: updated.spells.filter(s => s.spellSlug !== cantripToForget) }
    }

    // Apply feat grant choices (Magic Initiate, Fey Touched, etc.)
    if (isAsiLevel && asiChoice === 'feat' && featSlug) {
      const featDef = content.feats.find(f => f.slug === featSlug)
      if (featDef) {
        const resolved = featClass ? withFeatClassChoice(featDef, featClass) : featDef
        const prompts = resolveFeatGrants(resolved, content.spells)
        const patch = { spells: [...updated.spells], freeSpellUses: { ...updated.freeSpellUses } }
        for (const p of prompts) {
          const picks = featGrants[p.storageKey] ?? []
          if (picks.length > 0) {
            applyGrantPicks(patch, p, picks, featDef)
          }
        }
        updated = { ...updated, spells: patch.spells, freeSpellUses: patch.freeSpellUses }
      }
    }

    // Grant secret language when multiclassing into druid or rogue for the first time
    if (isMulticlassing) {
      const secretLang = CLASS_SECRET_LANGUAGES[selectedClass]
      if (secretLang && !updated.languages.includes(secretLang)) {
        updated = { ...updated, languages: [...updated.languages, secretLang] }
      }
    }

    await saveCharacterToDisk(updated)
    navigate(`/c/${char.id}`)
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link to={`/c/${char.id}`} className="btn-ghost text-sm">← Back to Sheet</Link>
        <h1 className="text-2xl font-bold text-parchment-800">Level Up: {char.name}</h1>
      </div>

      <div className="text-sm text-parchment-500 mb-6">
        Currently Level {totalLvl} → Level {newTotalLevel} &bull; New Proficiency Bonus: +{pb}
      </div>

      {/* Class selection */}
      <div className="card mb-4">
        <h2 className="section-header">Class</h2>
        <div className="space-y-2">
          {char.classes.map(cc => {
            const cls2 = content.classes.find(c => c.slug === cc.classSlug)
            return (
              <label key={cc.classSlug} className={`flex items-center gap-3 p-3 rounded border cursor-pointer ${selectedClass === cc.classSlug ? 'border-parchment-500 bg-parchment-50' : 'border-parchment-200'}`}>
                <input type="radio" name="class" value={cc.classSlug} checked={selectedClass === cc.classSlug} onChange={() => setSelectedClass(cc.classSlug)} />
                <span>{cls2?.name ?? cc.classSlug} (currently Lvl {cc.level} → Lvl {cc.level + 1})</span>
              </label>
            )
          })}
          {totalLvl >= 1 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-sm text-parchment-500 hover:text-parchment-700">Multiclass into a new class...</summary>
              <div className="mt-2 space-y-1 pl-3">
                {content.classes
                  .filter(c => !char.classes.find(cc => cc.classSlug === c.slug))
                  .map(c => {
                    const check = MULTICLASS_PREREQS[c.slug]
                    const met = !check || check(char.abilityScores)
                    const label = MULTICLASS_PREREQ_LABEL[c.slug]
                    return (
                      <label key={c.slug} className={`flex items-center gap-3 p-2 rounded border cursor-pointer ${selectedClass === c.slug ? 'border-parchment-500 bg-parchment-50' : met ? 'border-parchment-200' : 'border-parchment-200 opacity-50'}`}>
                        <input type="radio" name="class" value={c.slug} checked={selectedClass === c.slug} onChange={() => setSelectedClass(c.slug)} />
                        <span>{c.name} (Multiclass Level 1)</span>
                        {label && (
                          <span className={`ml-auto text-xs px-1.5 py-0.5 rounded ${met ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                            {label}
                          </span>
                        )}
                      </label>
                    )
                  })}
              </div>
            </details>
          )}
        </div>
      </div>

      {/* HP Gain */}
      <div className="card mb-4">
        <h2 className="section-header">Hit Points</h2>
        <p className="text-sm text-parchment-500 mb-3">Hit Die: d{hitDie}</p>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" checked={useAverage} onChange={() => setUseAverage(true)} />
            <span>Take average ({avgRoll})</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" checked={!useAverage} onChange={() => setUseAverage(false)} />
            <span>Roll manually</span>
          </label>
        </div>
        {!useAverage && (
          <div className="mt-3">
            <label className="label">Your roll (1–{hitDie})</label>
            <input
              type="number"
              min={1}
              max={hitDie}
              className="input w-24"
              value={hpRoll ?? ''}
              onChange={e => setHpRoll(parseInt(e.target.value, 10) || 1)}
            />
          </div>
        )}
        <p className="text-sm text-parchment-600 mt-3">
          HP gained: <strong>{effectiveHpRoll}</strong> + CON modifier ({char.abilityScores.con >= 10 ? '+' : ''}{Math.floor((char.abilityScores.con - 10) / 2)})
          = <strong>{Math.max(1, effectiveHpRoll + Math.floor((char.abilityScores.con - 10) / 2))}</strong>
        </p>
      </div>

      {/* New class features */}
      {(classFeatureAtLevel.length > 0 || subclassFeatureAtLevel.length > 0) && (
        <div className="card mb-4">
          <h2 className="section-header">New Class Features at Level {nextLevel}</h2>
          {classFeatureAtLevel.map(f => (
            <div key={f.name} className="mb-2">
              <div className="font-medium">{f.name}</div>
              {f.description && <p className="text-sm text-parchment-500 mt-0.5">{f.description}</p>}
            </div>
          ))}
          {subclassFeatureAtLevel.length > 0 && (
            <div className="mt-3 pt-3 border-t border-parchment-100">
              <div className="text-xs font-semibold text-indigo-700 uppercase tracking-wide mb-2">Subclass Feature</div>
              {subclassFeatureAtLevel.map(f => (
                <div key={f.name} className="mb-2">
                  <div className="font-medium text-indigo-900">{f.name}</div>
                  {f.description && <p className="text-sm text-parchment-500 mt-0.5">{f.description}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Subclass choice */}
      {needsSubclass && availableSubclasses.length > 0 && (
        <div className="card mb-4">
          <h2 className="section-header">Choose Subclass</h2>
          <div className="space-y-2">
            {availableSubclasses.map(sc => (
              <label key={sc.slug} className={`flex items-start gap-3 p-3 rounded border cursor-pointer ${subclass === sc.slug ? 'border-parchment-500 bg-parchment-50' : 'border-parchment-200 hover:border-parchment-400'}`}>
                <input type="radio" name="subclass" value={sc.slug} checked={subclass === sc.slug} onChange={() => setSubclass(sc.slug)} className="mt-1" />
                <div>
                  <div className="font-medium">{sc.name}</div>
                  {sc.description && <div className="text-xs text-parchment-500 mt-0.5">{sc.description}</div>}
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Expertise choice */}
      {isExpertiseLevel && (
        <div className="card mb-4">
          <h2 className="section-header">Expertise — Choose {expertiseCount} Skills</h2>
          <p className="text-sm text-parchment-500 mb-3">
            Double your proficiency bonus for these skills. You must already be proficient.
            ({expertiseChoices.length}/{expertiseCount} chosen)
          </p>
          <div className="grid grid-cols-2 gap-2">
            {SKILLS.filter(s => char.skillProficiencies.includes(s) && !char.skillExpertise.includes(s)).map(skill => {
              const selected = expertiseChoices.includes(skill)
              const atMax = expertiseChoices.length >= expertiseCount
              return (
                <label
                  key={skill}
                  className={`flex items-center gap-2 p-2 rounded border cursor-pointer text-sm
                    ${selected ? 'border-parchment-500 bg-parchment-50' : 'border-parchment-200'}
                    ${!selected && atMax ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    disabled={!selected && atMax}
                    onChange={() => {
                      setExpertiseChoices(prev =>
                        selected ? prev.filter(x => x !== skill)
                          : prev.length < expertiseCount ? [...prev, skill] : prev
                      )
                    }}
                  />
                  {SKILL_LABELS[skill]}
                </label>
              )
            })}
          </div>
          {char.skillProficiencies.length === 0 && (
            <p className="text-sm text-parchment-400">No proficient skills to choose from yet.</p>
          )}
        </div>
      )}

      {/* ASI / Feat */}
      {isAsiLevel && (
        <div className="card mb-4">
          <h2 className="section-header">Ability Score Improvement or Feat</h2>
          <div className="flex gap-4 mb-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" checked={asiChoice === 'asi'} onChange={() => setAsiChoice('asi')} />
              Ability Score Improvement (+2 or +1/+1)
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" checked={asiChoice === 'feat'} onChange={() => setAsiChoice('feat')} />
              Feat
            </label>
          </div>

          {asiChoice === 'asi' && (
            <div className="space-y-3">
              <div>
                <label className="label">First +1 — choose an ability score</label>
                <InlinePicker
                  options={ABILITIES.map(a => ({ value: a, label: ABILITY_LABELS[a], sub: `${char.abilityScores[a]} → ${char.abilityScores[a] + 1}` }))}
                  value={ability1}
                  onChange={setAbility1}
                  allowDeselect={false}
                  columns={3}
                />
              </div>
              <div>
                <label className="label">Second +1 — same as above for +2 total</label>
                <InlinePicker
                  options={ABILITIES.map(a => ({ value: a, label: ABILITY_LABELS[a], sub: `${char.abilityScores[a]} → ${char.abilityScores[a] + (a === ability1 ? 2 : 1)}` }))}
                  value={ability2}
                  onChange={setAbility2}
                  allowDeselect={false}
                  columns={3}
                />
              </div>
            </div>
          )}

          {asiChoice === 'feat' && (
            <>
              <FeatPicker
                feats={content.feats}
                value={featSlug}
                onChange={slug => {
                  setFeatSlug(slug)
                  setFeatGrants({})
                  setFeatClass('')
                }}
                maxHeightClass="max-h-96"
              />
              {(() => {
                const featDef = content.feats.find(f => f.slug === featSlug)
                if (!featDef) return null
                return (
                  <FeatGrantsBlock
                    feat={featDef}
                    spells={content.spells}
                    classChoice={featClass}
                    setClassChoice={setFeatClass}
                    picks={featGrants}
                    setPicks={setFeatGrants}
                  />
                )
              })()}
            </>
          )}
        </div>
      )}

      {/* New cantrip */}
      {isNewCantripLevel && (
        <div className="card mb-4">
          <h2 className="section-header">New Cantrip</h2>
          <p className="text-sm text-parchment-500 mb-3">Choose one new cantrip to learn.</p>
          <div className="grid grid-cols-2 gap-1 max-h-60 overflow-y-auto">
            {content.spells
              .filter(s => s.level === 0 && (s.classLists ?? []).includes(selectedClass))
              .filter(s => !char.spells.find(cs => cs.spellSlug === s.slug))
              .map(s => (
                <button
                  key={s.slug}
                  type="button"
                  onClick={() => setNewCantrips(newCantrips[0] === s.slug ? [] : [s.slug])}
                  className={`text-left px-2.5 py-1.5 rounded border text-sm transition-colors ${newCantrips[0] === s.slug ? 'border-parchment-500 bg-parchment-50 font-medium' : 'border-parchment-100 hover:border-parchment-400'}`}
                >
                  <span className="text-parchment-900">{s.name}</span>
                  <span className="text-xs text-parchment-400 ml-1">({s.school})</span>
                </button>
              ))}
          </div>
          {/* Cantrip swap */}
          {['sorcerer', 'bard', 'warlock'].includes(selectedClass) && char.spells.some(s => {
            const def = content.spells.find(d => d.slug === s.spellSlug)
            return def?.level === 0 && s.classSlug === selectedClass
          }) && (
            <div className="mt-3">
              <p className="text-xs text-parchment-500 mb-2">Optionally replace one known cantrip (click to select, click again to keep):</p>
              <div className="grid grid-cols-2 gap-1">
                {char.spells
                  .filter(s => content.spells.find(d => d.slug === s.spellSlug)?.level === 0 && s.classSlug === selectedClass)
                  .map(s => (
                    <button
                      key={s.spellSlug}
                      type="button"
                      onClick={() => setCantripToForget(cantripToForget === s.spellSlug ? '' : s.spellSlug)}
                      className={`text-left px-2.5 py-1.5 rounded border text-sm transition-colors ${cantripToForget === s.spellSlug ? 'border-red-400 bg-red-50 text-red-700 font-medium' : 'border-parchment-100 hover:border-parchment-400'}`}
                    >
                      {cantripToForget === s.spellSlug ? '✕ ' : ''}{s.name}
                    </button>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Eldritch Invocations (Warlock) */}
      {invocationsToGain > 0 && (
        <div className="card mb-4">
          <h2 className="section-header">Eldritch Invocations — Choose {invocationsToGain}</h2>
          <p className="text-sm text-parchment-500 mb-1">
            Total after leveling: <strong>{invocationsTotal}</strong>
            {currentInvocations.length > 0 && <> (you have {currentInvocations.length}; gaining {invocationsToGain})</>}
          </p>
          <p className="text-sm text-amber-600 mb-3">({invocationChoices.length}/{invocationsToGain} selected)</p>
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {ELDRITCH_INVOCATIONS
              .filter(inv => !currentInvocations.includes(inv.slug))
              .filter(inv => !inv.levelRequirement || nextLevel >= inv.levelRequirement)
              .map(inv => {
                const selected = invocationChoices.includes(inv.slug)
                const atMax = invocationChoices.length >= invocationsToGain
                return (
                  <label
                    key={inv.slug}
                    className={`flex items-start gap-3 p-2 rounded border cursor-pointer
                      ${selected ? 'border-parchment-500 bg-parchment-50' : 'border-parchment-100'}
                      ${!selected && atMax ? 'opacity-40 cursor-not-allowed' : 'hover:border-parchment-400'}`}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 shrink-0"
                      checked={selected}
                      disabled={!selected && atMax}
                      onChange={() => {
                        setInvocationChoices(prev =>
                          selected ? prev.filter(x => x !== inv.slug)
                            : prev.length < invocationsToGain ? [...prev, inv.slug] : prev
                        )
                      }}
                    />
                    <div>
                      <div className="text-sm font-medium">
                        {inv.name}
                        {inv.levelRequirement && <span className="ml-2 text-xs text-parchment-400">Lvl {inv.levelRequirement}+</span>}
                      </div>
                      <div className="text-xs text-parchment-500 mt-0.5">{inv.description}</div>
                      {inv.prerequisite && <div className="text-xs text-amber-600 mt-0.5">Requires: {inv.prerequisite}</div>}
                    </div>
                  </label>
                )
              })}
          </div>
          {currentInvocations.length > 0 && (
            <details className="mt-3">
              <summary className="text-xs text-parchment-400 cursor-pointer">Already known ({currentInvocations.length})</summary>
              <div className="mt-1 flex flex-wrap gap-1">
                {currentInvocations.map(slug => {
                  const inv = ELDRITCH_INVOCATIONS.find(i => i.slug === slug)
                  return <span key={slug} className="text-xs bg-parchment-100 text-parchment-600 rounded px-2 py-0.5">{inv?.name ?? slug}</span>
                })}
              </div>
            </details>
          )}
        </div>
      )}

      {/* Metamagic (Sorcerer) */}
      {metamagicToGain > 0 && (
        <div className="card mb-4">
          <h2 className="section-header">Metamagic — Choose {metamagicToGain}</h2>
          <p className="text-sm text-parchment-500 mb-1">
            Total after leveling: <strong>{metamagicTotal}</strong>
            {currentMetamagic.length > 0 && <> (you have {currentMetamagic.length}; gaining {metamagicToGain})</>}
          </p>
          <p className="text-sm text-amber-600 mb-3">({metamagicChoices.length}/{metamagicToGain} selected)</p>
          <div className="space-y-2">
            {METAMAGIC_OPTIONS
              .filter(m => !currentMetamagic.includes(m.slug))
              .map(m => {
                const selected = metamagicChoices.includes(m.slug)
                const atMax = metamagicChoices.length >= metamagicToGain
                return (
                  <label
                    key={m.slug}
                    className={`flex items-start gap-3 p-2 rounded border cursor-pointer
                      ${selected ? 'border-parchment-500 bg-parchment-50' : 'border-parchment-100'}
                      ${!selected && atMax ? 'opacity-40 cursor-not-allowed' : 'hover:border-parchment-400'}`}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 shrink-0"
                      checked={selected}
                      disabled={!selected && atMax}
                      onChange={() => {
                        setMetamagicChoices(prev =>
                          selected ? prev.filter(x => x !== m.slug)
                            : prev.length < metamagicToGain ? [...prev, m.slug] : prev
                        )
                      }}
                    />
                    <div>
                      <div className="text-sm font-medium">{m.name}</div>
                      <div className="text-xs text-parchment-500 mt-0.5">{m.description}</div>
                    </div>
                  </label>
                )
              })}
          </div>
          {currentMetamagic.length > 0 && (
            <details className="mt-3">
              <summary className="text-xs text-parchment-400 cursor-pointer">Already chosen ({currentMetamagic.length})</summary>
              <div className="mt-1 flex flex-wrap gap-1">
                {currentMetamagic.map(slug => {
                  const m = METAMAGIC_OPTIONS.find(x => x.slug === slug)
                  return <span key={slug} className="text-xs bg-purple-100 text-purple-700 rounded px-2 py-0.5">{m?.name ?? slug}</span>
                })}
              </div>
            </details>
          )}
        </div>
      )}

      {/* Infusions (Artificer) */}
      {infusionsToGain > 0 && (
        <div className="card mb-4">
          <h2 className="section-header">Infusions — Choose {infusionsToGain}</h2>
          <p className="text-sm text-parchment-500 mb-1">
            Total known after leveling: <strong>{infusionsTotal}</strong>
            {currentInfusions.length > 0 && <> (you have {currentInfusions.length}; gaining {infusionsToGain})</>}
          </p>
          <p className="text-sm text-amber-600 mb-3">({infusionChoices.length}/{infusionsToGain} selected)</p>
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {ARTIFICER_INFUSIONS
              .filter(inf => !currentInfusions.includes(inf.slug))
              .filter(inf => !inf.levelRequirement || nextLevel >= inf.levelRequirement)
              .map(inf => {
                const selected = infusionChoices.includes(inf.slug)
                const atMax = infusionChoices.length >= infusionsToGain
                return (
                  <label
                    key={inf.slug}
                    className={`flex items-start gap-3 p-2 rounded border cursor-pointer
                      ${selected ? 'border-parchment-500 bg-parchment-50' : 'border-parchment-100'}
                      ${!selected && atMax ? 'opacity-40 cursor-not-allowed' : 'hover:border-parchment-400'}`}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 shrink-0"
                      checked={selected}
                      disabled={!selected && atMax}
                      onChange={() => {
                        setInfusionChoices(prev =>
                          selected ? prev.filter(x => x !== inf.slug)
                            : prev.length < infusionsToGain ? [...prev, inf.slug] : prev
                        )
                      }}
                    />
                    <div>
                      <div className="text-sm font-medium">
                        {inf.name}
                        {inf.levelRequirement && <span className="ml-2 text-xs text-parchment-400">Lvl {inf.levelRequirement}+</span>}
                      </div>
                      {inf.itemType && <div className="text-xs text-indigo-600 mt-0.5">Item: {inf.itemType}</div>}
                      <div className="text-xs text-parchment-500 mt-0.5">{inf.description}</div>
                    </div>
                  </label>
                )
              })}
          </div>
          {currentInfusions.length > 0 && (
            <details className="mt-3">
              <summary className="text-xs text-parchment-400 cursor-pointer">Already known ({currentInfusions.length})</summary>
              <div className="mt-1 flex flex-wrap gap-1">
                {currentInfusions.map(slug => {
                  const inf = ARTIFICER_INFUSIONS.find(i => i.slug === slug)
                  return <span key={slug} className="text-xs bg-parchment-100 text-parchment-600 rounded px-2 py-0.5">{inf?.name ?? slug}</span>
                })}
              </div>
            </details>
          )}
          {currentInfusions.length > 0 && <InfusionSwap
            currentInfusions={currentInfusions}
            infusionToSwapOut={infusionToSwapOut}
            infusionToSwapIn={infusionToSwapIn}
            nextLevel={nextLevel}
            setInfusionToSwapOut={setInfusionToSwapOut}
            setInfusionToSwapIn={setInfusionToSwapIn}
            alreadyGaining={infusionChoices}
          />}
        </div>
      )}

      {/* Infusion swap when no new infusions are gained this level */}
      {selectedClass === 'artificer' && infusionsToGain === 0 && currentInfusions.length > 0 && (
        <div className="card mb-4">
          <h2 className="section-header">Replace an Infusion <span className="text-sm font-normal text-parchment-400">(optional)</span></h2>
          <p className="text-sm text-parchment-500 mb-3">You can replace one known infusion with a different one each time you level up.</p>
          <InfusionSwap
            currentInfusions={currentInfusions}
            infusionToSwapOut={infusionToSwapOut}
            infusionToSwapIn={infusionToSwapIn}
            nextLevel={nextLevel}
            setInfusionToSwapOut={setInfusionToSwapOut}
            setInfusionToSwapIn={setInfusionToSwapIn}
            alreadyGaining={[]}
          />
        </div>
      )}

      {/* New spells */}
      {cls?.spellcastingAbility && (
        <div className="card mb-4">
          <h2 className="section-header">New Spells</h2>
          {spellsKnownMax !== undefined ? (
            <div className="text-sm text-parchment-500 mb-3">
              <p>
                Spells known (this class): <strong>{currentSpellCount}</strong> / <strong>{spellsKnownMax}</strong> max at level {nextLevel}.
              </p>
              {currentSpellCount < spellsKnownMax
                ? <p className="mt-1">You may learn <strong>{spellsKnownMax - currentSpellCount}</strong> more spell{spellsKnownMax - currentSpellCount !== 1 ? 's' : ''}.</p>
                : (
                  <div className="mt-2">
                    <p className="text-amber-600 mb-2">You are at your spell cap. You may replace one known spell.</p>
                    <p className="text-xs text-parchment-500 mb-1">Click a spell to forget it (click again to keep it):</p>
                    <div className="space-y-1 mb-2">
                      {char.spells
                        .filter(s => s.classSlug === selectedClass && (content.spells.find(d => d.slug === s.spellSlug)?.level ?? 0) > 0)
                        .map(s => (
                          <button
                            key={s.spellSlug}
                            type="button"
                            onClick={() => setSpellToForget(spellToForget === s.spellSlug ? '' : s.spellSlug)}
                            className={`w-full text-left px-2.5 py-1.5 rounded border text-sm transition-colors ${spellToForget === s.spellSlug ? 'border-red-400 bg-red-50 text-red-700 font-medium' : 'border-parchment-100 hover:border-parchment-400'}`}
                          >
                            {spellToForget === s.spellSlug ? '✕ Forget: ' : ''}{s.name}
                          </button>
                        ))}
                    </div>
                  </div>
                )
              }
            </div>
          ) : (
            <p className="text-sm text-parchment-500 mb-3">Select any new spells gained at this level.</p>
          )}
          {/* Searchable spell list */}
          {(() => {
            const schoolFilter = ekRestriction && !showAllSchools
              ? ['abjuration', 'evocation']
              : atRestriction && !showAllSchools
                ? ['enchantment', 'illusion']
                : null
            const available = content.spells
              .filter(s => s.level > 0 && (s.classLists ?? []).includes(selectedClass))
              .filter(s => !char.spells.find(cs => cs.spellSlug === s.slug))
              .filter(s => !schoolFilter || schoolFilter.includes(s.school.toLowerCase()))
            const filtered = newSpellSearch
              ? available.filter(s => s.name.toLowerCase().includes(newSpellSearch.toLowerCase()) || s.school.toLowerCase().includes(newSpellSearch.toLowerCase()))
              : available
            return (
              <>
                {(ekRestriction || atRestriction) && (
                  <div className="mb-2 p-2 rounded border text-xs flex items-start gap-2 bg-amber-50 border-amber-200 text-amber-800">
                    <span className="shrink-0">⚠</span>
                    <span>
                      {ekRestriction ? 'Eldritch Knight: spells must be Abjuration or Evocation' : 'Arcane Trickster: spells must be Enchantment or Illusion'}
                      {FREE_SCHOOL_LEVELS.includes(nextLevel) ? ' (one free-school spell unlocked at this level)' : ''}.
                      <label className="ml-2 cursor-pointer font-medium">
                        <input type="checkbox" className="mr-1" checked={showAllSchools} onChange={e => setShowAllSchools(e.target.checked)} />
                        Show all schools
                      </label>
                    </span>
                  </div>
                )}
                <input
                  className="input mb-2"
                  placeholder="Search available spells…"
                  value={newSpellSearch}
                  onChange={e => setNewSpellSearch(e.target.value)}
                />
                <div className="space-y-1 max-h-80 overflow-y-auto">
                  {filtered.map(s => {
                    const sel = newSpells.includes(s.slug)
                    return (
                      <button
                        key={s.slug}
                        type="button"
                        onClick={() => setNewSpells(sel ? newSpells.filter(x => x !== s.slug) : [...newSpells, s.slug])}
                        className={`w-full text-left px-2.5 py-1.5 rounded border text-sm transition-colors flex items-center gap-2 ${sel ? 'border-parchment-500 bg-parchment-50 font-medium' : 'border-parchment-100 hover:border-parchment-400'}`}
                      >
                        {sel && <span className="text-parchment-500 text-xs shrink-0">✓</span>}
                        <span className="flex-1">{s.name}</span>
                        <span className="text-xs text-parchment-400 shrink-0">L{s.level} {s.school}</span>
                      </button>
                    )
                  })}
                  {filtered.length === 0 && <p className="text-xs text-parchment-400 text-center py-3">No spells match "{newSpellSearch}"</p>}
                </div>
                {newSpells.length > 0 && (
                  <p className="text-xs text-parchment-600 mt-2">{newSpells.length} spell{newSpells.length !== 1 ? 's' : ''} selected</p>
                )}
              </>
            )
          })()}
        </div>
      )}

      {/* Multiclass skill grant */}
      {needsMulticlassSkill && multiclassGrant?.skills && (
        <div className="card mb-4">
          <h2 className="section-header">Multiclass Skill Proficiency</h2>
          <p className="text-sm text-parchment-500 mb-3">
            Multiclassing into {content.classes.find(c => c.slug === selectedClass)?.name ?? selectedClass} grants 1 skill proficiency from:
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {(multiclassGrant.skills.from.length > 0 ? multiclassGrant.skills.from : SKILLS.map(s => SKILL_LABELS[s])).map(skill => {
              const slug = skill.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z-]/g, '') as typeof SKILLS[number]
              const alreadyHas = char.skillProficiencies.includes(slug) || char.skillProficiencies.includes(skill)
              return (
                <label key={skill} className={`flex items-center gap-2 p-2 rounded border text-sm cursor-pointer
                  ${multiclassSkill === skill ? 'border-parchment-500 bg-parchment-50' : 'border-parchment-200'}
                  ${alreadyHas ? 'opacity-40' : ''}`}>
                  <input type="radio" name="mc-skill" value={skill}
                    checked={multiclassSkill === skill}
                    disabled={alreadyHas}
                    onChange={() => setMulticlassSkill(skill)} />
                  {skill}{alreadyHas ? ' (already proficient)' : ''}
                </label>
              )
            })}
          </div>
        </div>
      )}

      {/* Warlock Pact Boon */}
      {needsPactBoon && (
        <div className="card mb-4">
          <h2 className="section-header">Pact Boon</h2>
          <p className="text-sm text-parchment-500 mb-3">Choose your Warlock Pact Boon at level 3.</p>
          <div className="space-y-2">
            {[
              { slug: 'blade', name: 'Pact of the Blade', desc: 'Summon a pact weapon as an action. You are proficient with it and can use it as a spellcasting focus. Required for many combat-focused invocations.' },
              { slug: 'chain', name: 'Pact of the Chain', desc: 'Learn Find Familiar. Your familiar can take one of 4 special forms (imp, pseudodragon, quasit, sprite). It can attack using its reaction.' },
              { slug: 'tome', name: 'Pact of the Tome', desc: 'Receive a Book of Shadows. Learn 3 cantrips from any class. Required for Book of Ancient Secrets invocation.' },
            ].map(b => (
              <label key={b.slug} className={`flex items-start gap-3 p-3 rounded border cursor-pointer
                ${pactBoon === b.slug ? 'border-parchment-500 bg-parchment-50' : 'border-parchment-200 hover:border-parchment-300'}`}>
                <input type="radio" name="pact-boon" value={b.slug} checked={pactBoon === b.slug} onChange={() => setPactBoon(b.slug)} className="mt-0.5" />
                <div>
                  <div className="font-medium">{b.name}</div>
                  <div className="text-xs text-parchment-500 mt-0.5">{b.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Battle Master Maneuvers */}
      {maneuversToGain > 0 && (
        <div className="card mb-4">
          <h2 className="section-header">Battle Master Maneuvers — Choose {maneuversToGain}</h2>
          <p className="text-sm text-parchment-500 mb-3">
            ({maneuverChoices.length}/{maneuversToGain} chosen)
          </p>
          <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
            {BATTLE_MASTER_MANEUVERS.filter(m => !currentManeuvers.includes(m.slug)).map(m => {
              const selected = maneuverChoices.includes(m.slug)
              const atMax = maneuverChoices.length >= maneuversToGain
              return (
                <label key={m.slug} className={`flex items-start gap-2 p-2 rounded border cursor-pointer text-sm
                  ${selected ? 'border-parchment-500 bg-parchment-50' : 'border-parchment-200'}
                  ${!selected && atMax ? 'opacity-40 cursor-not-allowed' : ''}`}>
                  <input type="checkbox" checked={selected} disabled={!selected && atMax}
                    onChange={() => setManeuverChoices(prev =>
                      selected ? prev.filter(x => x !== m.slug) : prev.length < maneuversToGain ? [...prev, m.slug] : prev
                    )} className="mt-0.5 shrink-0" />
                  <div>
                    <span className="font-medium">{m.name}</span>
                    <span className="text-parchment-500 ml-1">— {m.description}</span>
                  </div>
                </label>
              )
            })}
          </div>
        </div>
      )}

      {/* Ranger: Favored Enemy & Natural Explorer */}
      {needsFavoredEnemy && (
        <div className="card mb-4">
          <h2 className="section-header">Favored Enemy</h2>
          <p className="text-sm text-parchment-500 mb-2">Choose a creature type. You have advantage on Survival checks to track it and INT checks to recall lore.</p>
          <select className="input text-sm" value={favoredEnemy} onChange={e => setFavoredEnemy(e.target.value)}>
            <option value="">— choose —</option>
            {['Aberrations','Beasts','Celestials','Constructs','Dragons','Elementals','Fey','Fiends','Giants','Humanoids','Monstrosities','Oozes','Plants','Undead','Two humanoid types'].map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      )}
      {needsFavoredTerrain && (
        <div className="card mb-4">
          <h2 className="section-header">Natural Explorer Terrain</h2>
          <p className="text-sm text-parchment-500 mb-2">Choose a favored terrain type for exploration benefits.</p>
          <select className="input text-sm" value={favoredTerrain} onChange={e => setFavoredTerrain(e.target.value)}>
            <option value="">— choose —</option>
            {['Arctic','Coast','Desert','Forest','Grassland','Mountain','Swamp','Underdark'].map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      )}

      {/* Fighting Style */}
      {needsFightingStyle && classOptsDef?.fightingStyles && (
        <div className="card mb-4">
          <h2 className="section-header">Fighting Style</h2>
          <p className="text-sm text-parchment-500 mb-3">Choose a fighting style for this class.</p>
          <div className="space-y-2">
            {classOptsDef.fightingStyles.map(style => (
              <label key={style.slug} className={`flex items-start gap-3 p-3 rounded border cursor-pointer
                ${fightingStyle === style.slug ? 'border-parchment-500 bg-parchment-50' : 'border-parchment-200 hover:border-parchment-300'}`}>
                <input type="radio" name="fighting-style" value={style.slug} checked={fightingStyle === style.slug} onChange={() => setFightingStyle(style.slug)} className="mt-0.5" />
                <div>
                  <div className="font-medium">{style.name}</div>
                  <div className="text-xs text-parchment-500 mt-0.5">{style.description}</div>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Circle of the Land terrain */}
      {needsLandTerrain && (
        <div className="card mb-4">
          <h2 className="section-header">Circle Spells — Choose Terrain</h2>
          <p className="text-sm text-parchment-500 mb-3">
            Your terrain determines which spells are always prepared as Circle Spells.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {Object.keys(LAND_CIRCLE_SPELLS).map(terrain => (
              <label key={terrain} className={`flex items-center gap-2 p-2.5 rounded border cursor-pointer text-sm capitalize
                ${landTerrain === terrain ? 'border-parchment-500 bg-parchment-50' : 'border-parchment-200 hover:border-parchment-400'}`}>
                <input type="radio" name="land-terrain" value={terrain} checked={landTerrain === terrain} onChange={() => setLandTerrain(terrain)} />
                {terrain}
              </label>
            ))}
          </div>
          {landTerrain && (
            <div className="mt-3 p-2 rounded bg-green-50 border border-green-200 text-xs text-green-800">
              <div className="font-semibold mb-1">Always Prepared ({landTerrain.charAt(0).toUpperCase() + landTerrain.slice(1)}):</div>
              {LAND_CIRCLE_SPELLS[landTerrain].map(s => (
                <span key={s.slug} className="mr-2">{s.name} (L{s.level}, Druid {s.grantedAtLevel}+)</span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Rune Knight rune choices */}
      {runesToGain > 0 && (
        <div className="card mb-4">
          <h2 className="section-header">Rune Carver — Choose {runesToGain} Rune{runesToGain !== 1 ? 's' : ''}</h2>
          <p className="text-sm text-parchment-500 mb-3">
            ({runeChoices.length}/{runesToGain} chosen)
          </p>
          <div className="space-y-2">
            {RUNE_KNIGHT_RUNES.filter(r => !currentRunes.includes(r.slug)).map(rune => {
              const selected = runeChoices.includes(rune.slug)
              const atMax = runeChoices.length >= runesToGain
              return (
                <label key={rune.slug} className={`flex items-start gap-3 p-3 rounded border cursor-pointer
                  ${selected ? 'border-parchment-500 bg-parchment-50' : 'border-parchment-200'}
                  ${!selected && atMax ? 'opacity-40 cursor-not-allowed' : 'hover:border-parchment-400'}`}>
                  <input type="checkbox" checked={selected} disabled={!selected && atMax} className="mt-0.5 shrink-0"
                    onChange={() => setRuneChoices(prev =>
                      selected ? prev.filter(x => x !== rune.slug) : prev.length < runesToGain ? [...prev, rune.slug] : prev
                    )} />
                  <div>
                    <div className="font-medium text-sm">{rune.name}</div>
                    <div className="text-xs text-parchment-500 mt-0.5">{rune.description}</div>
                  </div>
                </label>
              )
            })}
          </div>
          {currentRunes.length > 0 && (
            <details className="mt-3">
              <summary className="text-xs text-parchment-400 cursor-pointer">Already inscribed ({currentRunes.length})</summary>
              <div className="mt-1 flex flex-wrap gap-1">
                {currentRunes.map(slug => {
                  const r = RUNE_KNIGHT_RUNES.find(x => x.slug === slug)
                  return <span key={slug} className="text-xs bg-parchment-100 text-parchment-600 rounded px-2 py-0.5">{r?.name ?? slug}</span>
                })}
              </div>
            </details>
          )}
        </div>
      )}

      {/* Hunter subclass choice */}
      {needsHunterChoice && HUNTER_CHOICES[nextLevel] && (
        <div className="card mb-4">
          <h2 className="section-header">Hunter Technique — Level {nextLevel}</h2>
          <p className="text-sm text-parchment-500 mb-3">Choose one technique to learn.</p>
          <div className="space-y-2">
            {HUNTER_CHOICES[nextLevel].map(choice => (
              <label key={choice.slug} className={`flex items-start gap-3 p-3 rounded border cursor-pointer
                ${hunterChoice === choice.slug ? 'border-parchment-500 bg-parchment-50' : 'border-parchment-200 hover:border-parchment-300'}`}>
                <input type="radio" name="hunter-choice" value={choice.slug} checked={hunterChoice === choice.slug} onChange={() => setHunterChoice(choice.slug)} className="mt-0.5" />
                <div>
                  <div className="font-medium">{choice.name}</div>
                  <div className="text-xs text-parchment-500 mt-0.5">{choice.description}</div>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Barbarian Totem Warrior — totem animal choice */}
      {needsTotemChoice && (
        <div className="card mb-4">
          <h2 className="section-header">Totem Spirit{totemTierKey === 'totem-aspect' ? ' — Aspect of the Beast' : totemTierKey === 'totem-attunement' ? ' — Totemic Attunement' : ''}</h2>
          <p className="text-sm text-parchment-500 mb-3">Choose your totem animal for this tier.</p>
          <div className="space-y-2">
            {TOTEM_ANIMALS.map(animal => {
              const tierKey = totemTierKey as 'totem-spirit' | 'totem-aspect' | 'totem-attunement' | null
              const desc = tierKey ? animal.tierDescs[tierKey === 'totem-spirit' ? 'spirit' : tierKey === 'totem-aspect' ? 'aspect' : 'attunement'] : ''
              return (
                <label key={animal.slug} className={`flex items-start gap-3 p-3 rounded border cursor-pointer
                  ${totemAnimal === animal.slug ? 'border-amber-400 bg-amber-50' : 'border-parchment-200 hover:border-parchment-400'}`}>
                  <input type="radio" name="totem-animal" value={animal.slug} checked={totemAnimal === animal.slug} onChange={() => setTotemAnimal(animal.slug)} className="mt-0.5" />
                  <div>
                    <div className="font-medium">{animal.name}</div>
                    <div className="text-xs text-parchment-500 mt-0.5">{desc}</div>
                  </div>
                </label>
              )
            })}
          </div>
        </div>
      )}

      {/* Barbarian Storm Herald — aura type choice */}
      {needsStormAura && (
        <div className="card mb-4">
          <h2 className="section-header">Storm Aura — Choose Environment</h2>
          <p className="text-sm text-parchment-500 mb-3">Your aura type is permanent and determines the elemental fury of your rage.</p>
          <div className="space-y-2">
            {STORM_AURA_OPTIONS.map(aura => (
              <label key={aura.slug} className={`flex items-start gap-3 p-3 rounded border cursor-pointer
                ${stormAura === aura.slug ? 'border-sky-400 bg-sky-50' : 'border-parchment-200 hover:border-parchment-400'}`}>
                <input type="radio" name="storm-aura" value={aura.slug} checked={stormAura === aura.slug} onChange={() => setStormAura(aura.slug)} className="mt-0.5" />
                <div>
                  <div className="font-medium">{aura.name}</div>
                  <div className="text-xs text-parchment-500 mt-0.5">{aura.description}</div>
                  <div className="text-xs text-sky-600 mt-0.5">Storm Soul (L6): {aura.soulDesc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Monk Four Elements — discipline choices */}
      {needsFourElements && (
        <div className="card mb-4">
          <h2 className="section-header">Elemental Disciplines — Choose {disciplinesToGain}</h2>
          <p className="text-sm text-parchment-500 mb-3">
            ({fourElementsChoices.length}/{disciplinesToGain} chosen)
          </p>
          <div className="space-y-2">
            {FOUR_ELEMENTS_DISCIPLINES.filter(d => !existingDisciplines.includes(d.slug)).map(disc => {
              const selected = fourElementsChoices.includes(disc.slug)
              const atMax = fourElementsChoices.length >= disciplinesToGain
              return (
                <label key={disc.slug} className={`flex items-start gap-3 p-3 rounded border cursor-pointer
                  ${selected ? 'border-parchment-500 bg-parchment-50' : 'border-parchment-200'}
                  ${!selected && atMax ? 'opacity-40 cursor-not-allowed' : 'hover:border-parchment-400'}`}>
                  <input type="checkbox" checked={selected} disabled={!selected && atMax} className="mt-0.5 shrink-0"
                    onChange={() => setFourElementsChoices(prev =>
                      selected ? prev.filter(x => x !== disc.slug) : prev.length < disciplinesToGain ? [...prev, disc.slug] : prev
                    )} />
                  <div>
                    <div className="font-medium text-sm">{disc.name} <span className="text-xs text-violet-600 ml-1">{disc.ki}</span></div>
                    <div className="text-xs text-parchment-500 mt-0.5">{disc.description}</div>
                  </div>
                </label>
              )
            })}
          </div>
          {existingDisciplines.length > 0 && (
            <details className="mt-3">
              <summary className="text-xs text-parchment-400 cursor-pointer">Already known ({existingDisciplines.length})</summary>
              <div className="mt-1 flex flex-wrap gap-1">
                {existingDisciplines.map(slug => {
                  const d = FOUR_ELEMENTS_DISCIPLINES.find(x => x.slug === slug)
                  return <span key={slug} className="text-xs bg-violet-100 text-violet-700 rounded px-2 py-0.5">{d?.name ?? slug}</span>
                })}
              </div>
            </details>
          )}
        </div>
      )}

      <div className="flex justify-end gap-3 mt-6">
        <Link to={`/c/${char.id}`} className="btn-secondary">Cancel</Link>
        <button className="btn-primary" onClick={finish}>Apply Level Up</button>
      </div>
    </div>
  )
}
