import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useContent } from '../content/ContentProvider'
import { newCharacter, touchUpdated } from '../character/create'
import { applySubclassProficiencies } from '../character/levelUp'
import { saveCharacterToDisk } from '../storage/charApi'
import { Character, EquipmentItem, SKILLS, SKILL_LABELS, AbilityScores, ABILITIES } from '../character/model'
import { abilityMod, hpMax } from '../character/derive'
import { sumFeatBonuses } from '../character/featBonuses'
import { v4 as uuidv4 } from 'uuid'
import { DRACONIC_ANCESTRIES, RaceCategory, LANGUAGES_STANDARD, LANGUAGES_EXOTIC, splitRaceLanguages } from '../data/raceData'
import { CLASS_OPTIONS, INITIAL_SPELL_SLOTS, PACT_SLOT_TABLE, FAVORED_ENEMY_TYPES, FAVORED_TERRAINS } from '../data/classData'
import { STRIXHAVEN_COLLEGES } from '../data/strixhavenSpells'
import { CLASS_STARTING_GEAR, gearPickOptions, type GearItem, type GearPick } from '../data/startingGear'
import { FeatPicker } from '../components/FeatPicker'
import { FeatGrantsBlock } from '../components/FeatGrantsBlock'
import { InlinePicker } from '../components/InlinePicker'
import { resolveFeatGrants, applyGrantPicks, withFeatClassChoice, featAbilityPick } from '../character/grants'
import { FeatAbilityPicker } from '../components/FeatAbilityPicker'

const STEPS = ['Race', 'Class', 'Background', 'Abilities', 'Skills', 'Equipment', 'Details', 'Review']

const STYLE_AT_LEVEL_1 = new Set(['fighter'])
const CLASS_SECRET_LANGUAGE: Record<string, string> = { druid: 'Druidic', rogue: "Thieves' Cant" }

/** The skills a race lets the player pick: from a set list (Kenku Training) or any skill (Half-Elf's Skill Versatility). */
function raceSkillChoicesFor(race: { skillChoices?: { count: number; from: string[] }; bonusSkills?: number } | undefined) {
  if (race?.skillChoices) return race.skillChoices
  return race?.bonusSkills ? { count: race.bonusSkills, from: [...SKILLS] as string[] } : undefined
}

/** What a class calls the subclass it picks at level 1. */
function level1SubclassLabel(classSlug: string): string {
  return ({ cleric: 'Divine Domain', sorcerer: 'Sorcerous Origin', warlock: 'Otherworldly Patron' } as Record<string, string>)[classSlug] ?? 'subclass'
}

const BG_ITEM_SKIP = [
  'or ', 'and ', 'but ', 'you ', 'your ', 'will ', 'people ', 'to ', 'these ',
  'if ', 'as ', 'who ', 'whom', 'which ', 'though', 'similar', 'inspired', 'instead',
  'burning', 'from ', 'including', 'like ', 'modifying', 'roll', 'includes ',
  'about ', 'when ', 'much ', 'for instance', 'discussing ', 'disbanded',
  'whether', 'behind', 'it ', 'here ', 'founded', 'in a ', 'in the ', 'perhaps ',
  'sending ', 'such as', 'by ', 'underground', 'overgrown', 'at the ',
  'hunt ', 'practiced', 'sailing', 'so they', 'determined', 'dangerous ',
  'a strong ', 'procure ', 'obstacles', 'expressions',
  'the rough', 'the harpers', 'the common', 'the mages', 'the knights',
  'the object', 'is beorun', 'they consider', 'after which', 'established',
]
function parseBgItems(raw: string[]): string[] {
  return raw
    .filter(s => !s.includes('\n'))
    .map(s => s.replace(/Value:\s*[\d.]+\s*(?:gp|sp|cp|pp|lb)?\s*(?:Weight:\s*[\d.]+\s*(?:lbs?)?)?/gi, '').trim())
    .map(s => s.replace(/\s{2,}/g, ' ').trim())
    // Item names, not sentence fragments: drop the leading article and capitalise
    .map(s => s.replace(/^(?:an?|the)\s+/i, ''))
    .map(s => s.charAt(0).toUpperCase() + s.slice(1))
    .filter(s => {
      if (s.length < 4) return false
      const lower = s.toLowerCase()
      return !BG_ITEM_SKIP.some(p => lower.startsWith(p))
    })
}

const MUSICAL_INSTRUMENTS = ['Bagpipes', 'Drum', 'Dulcimer', 'Flute', 'Lute', 'Lyre', 'Horn', 'Pan flute', 'Shawm', 'Viol']
const ARTISAN_TOOLS = [
  "Alchemist's supplies", "Brewer's supplies", "Calligrapher's supplies", "Carpenter's tools",
  "Cartographer's tools", "Cobbler's tools", "Cook's utensils", "Glassblower's tools",
  "Jeweler's tools", "Leatherworker's tools", "Mason's tools", "Painter's supplies",
  "Potter's tools", "Smith's tools", "Tinker's tools", "Weaver's tools", "Woodcarver's tools",
]
const GAMING_SETS = ['Dice set', 'Dragonchess set', 'Playing card set', 'Three-Dragon Ante set']

function bgToolOptions(choiceLabel: string): string[] {
  const lower = choiceLabel.toLowerCase()
  // Union of every category the label mentions ("artisan's tools or a musical instrument")
  const options = [
    ...(lower.includes('artisan') ? ARTISAN_TOOLS : []),
    ...(lower.includes('musical instrument') ? MUSICAL_INSTRUMENTS : []),
    ...(lower.includes('gaming') ? GAMING_SETS : []),
  ]
  return options.length ? options : [...ARTISAN_TOOLS, ...MUSICAL_INSTRUMENTS, ...GAMING_SETS]
}

const COUNT_WORDS: Record<string, number> = { one: 1, two: 2, three: 3 }

/** Split a class's scraped tool list into fixed tools and a "choose N" entry, e.g.
 *  ["Thieves' tools", "One type of artisan's tools"] or ["Three musical instruments"]. */
function classToolSplit(tools: string[]): { fixed: string[]; choice: { count: number; label: string; options: string[] } | null } {
  const fixed: string[] = []
  let choice: { count: number; label: string; options: string[] } | null = null
  for (const t of tools) {
    const count = COUNT_WORDS[t.trim().split(/\s+/)[0].toLowerCase()]
    if (count) choice = { count, label: t, options: bgToolOptions(t) }
    else fixed.push(t)
  }
  return { fixed, choice }
}

const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8]
const ABILITY_LABELS: Record<string, string> = {
  str: 'Strength', dex: 'Dexterity', con: 'Constitution',
  int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma',
}

export default function Creator() {
  const navigate = useNavigate()
  const content = useContent()
  const { races, classes, backgrounds, feats, spells, items, loading } = content
  const [step, setStep] = useState(0)
  const [char, setChar] = useState<Character>(() => newCharacter({ id: uuidv4() }))
  const [abilityMethod, setAbilityMethod] = useState<'standard' | 'pointbuy' | 'manual'>('standard')
  const [standardAssigned, setStandardAssigned] = useState<Record<string, number>>({})
  const [errors, setErrors] = useState<string[]>([])

  // Race option state
  const [humanVariant, setHumanVariant] = useState(false)
  const [variantAbility1, setVariantAbility1] = useState('')
  const [variantAbility2, setVariantAbility2] = useState('')
  const [variantSkill, setVariantSkill] = useState('')
  const [variantFeat, setVariantFeat] = useState('')
  const [variantFeatGrants, setVariantFeatGrants] = useState<Record<string, string[]>>({})
  const [variantFeatClass, setVariantFeatClass] = useState('')
  const [variantFeatAbility, setVariantFeatAbility] = useState('')  // half-feat +1 target
  const [selectedSubrace, setSelectedSubrace] = useState('')
  const [halfElfAbilities, setHalfElfAbilities] = useState<string[]>([])
  const [flexAbility, setFlexAbility] = useState('')
  const [flexAbility2, setFlexAbility2] = useState('')
  const [dragonAncestry, setDragonAncestry] = useState('')
  const [highElfCantrip, setHighElfCantrip] = useState('')

  // Search filters for selection steps
  const [raceSearch, setRaceSearch]   = useState('')
  const [classSearch, setClassSearch] = useState('')
  const [bgSearch, setBgSearch]       = useState('')

  // Race skill choices (for races that pick N from a list)
  const [raceSkillChoices, setRaceSkillChoices] = useState<string[]>([])
  // Starting equipment choices: choiceGroupIndex → selected option label ('a'|'b'|'c')
  const [gearChoices, setGearChoices] = useState<Record<number, string>>({})
  // "(your choice)" items: pick key (see gearPickSlots) → chosen item name
  const [gearPicks, setGearPicks] = useState<Record<string, string>>({})

  // Background tool-of-choice state
  const [bgToolChoiceLabel, setBgToolChoiceLabel] = useState('')
  const [bgToolChoice, setBgToolChoice] = useState('')

  // Class option state
  const [fightingStyle, setFightingStyle] = useState('')
  const [selectedCantrips, setSelectedCantrips] = useState<string[]>([])
  const [selectedL1Spells, setSelectedL1Spells] = useState<string[]>([])
  const [classToolPicks, setClassToolPicks] = useState<string[]>([])
  const [subclass, setSubclass] = useState('')  // only for classes that choose one at level 1
  const [favoredEnemy, setFavoredEnemy] = useState('')      // Ranger level 1
  const [favoredTerrain, setFavoredTerrain] = useState('')  // Ranger level 1

  // Ability scores are kept as pre-racial base values (standard array / point buy / manual)
  // and combined with every racial bonus in one place. char.abilityScores mirrors the result.
  const [baseScores, setBaseScores] = useState<AbilityScores>(() => newCharacter().abilityScores)

  const racialBonuses = useMemo(() => {
    const race = races.find(r => r.slug === char.raceSlug)
    const out: Record<string, number> = {}
    const add = (ability: string, n: number) => { if (ability) out[ability] = (out[ability] ?? 0) + n }
    if (!race) return out
    const isVariantHuman = !!race.hasVariant && humanVariant
    if (!isVariantHuman) for (const [k, v] of Object.entries(race.abilityBonuses ?? {})) add(k, v ?? 0)
    const subrace = race.subraces?.find(s => s.slug === selectedSubrace)
    for (const [k, v] of Object.entries(subrace?.abilityBonuses ?? {})) add(k, v ?? 0)
    if (isVariantHuman) {
      add(variantAbility1, 1)
      if (variantAbility2 !== variantAbility1) add(variantAbility2, 1)
    }
    if (char.raceSlug === 'half-elf') {
      halfElfAbilities.forEach(a => add(a, 1))
    } else if (!race.hasVariant && race.chooseAbilityBonuses) {
      if (race.chooseAbilityBonuses >= 2) {
        add(flexAbility, 2)
        if (flexAbility2 !== flexAbility) add(flexAbility2, 1)
      } else {
        add(flexAbility, 1)
      }
    }
    return out
  }, [races, char.raceSlug, selectedSubrace, humanVariant, variantAbility1, variantAbility2, halfElfAbilities, flexAbility, flexAbility2])

  const scoresBeforeFeat = useMemo(() => {
    const scores = { ...baseScores } as Record<string, number>
    for (const a of ABILITIES) scores[a] = Math.min(20, baseScores[a] + (racialBonuses[a] ?? 0))
    return scores as AbilityScores
  }, [baseScores, racialBonuses])

  // Variant Human's bonus feat may be a half-feat (+1 to an ability)
  const variantFeatDef = humanVariant ? feats.find(f => f.slug === variantFeat) : undefined
  const variantFeatPick = featAbilityPick(variantFeatDef, variantFeatAbility)

  const finalScores = useMemo(() => {
    if (!variantFeatPick) return scoresBeforeFeat
    const max = variantFeatDef?.abilityScoreIncrease?.max ?? 20
    const ability = variantFeatPick as keyof AbilityScores
    return { ...scoresBeforeFeat, [ability]: Math.min(max, scoresBeforeFeat[ability] + 1) }
  }, [scoresBeforeFeat, variantFeatPick, variantFeatDef])

  useEffect(() => {
    setChar(prev => ({ ...prev, abilityScores: finalScores }))
  }, [finalScores])

  function changeAbilityMethod(m: 'standard' | 'pointbuy' | 'manual') {
    setAbilityMethod(m)
    setStandardAssigned({})
    if (m === 'pointbuy') setBaseScores({ str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 })
    else if (m === 'standard') setBaseScores(newCharacter().abilityScores)
  }

  function update(patch: Partial<Character>) {
    setChar(prev => ({ ...prev, ...patch }))
  }

  function validate(): string[] {
    const errs: string[] = []
    if (step === 0) {
      if (!char.raceSlug) errs.push('Select a race.')
      const opts = races.find(r => r.slug === char.raceSlug)
      if (opts?.subraces?.length && !selectedSubrace) errs.push('Choose a subrace.')
      if (opts?.hasVariant && humanVariant) {
        if (!variantAbility1 || !variantAbility2) errs.push('Choose two ability scores for +1 (Variant Human).')
        if (!variantSkill) errs.push('Choose a bonus skill (Variant Human).')
        if (variantFeatDef?.abilityScoreIncrease && !variantFeatPick) errs.push(`Choose which ability ${variantFeatDef.name} increases.`)
      }
      if (char.raceSlug === 'half-elf' && halfElfAbilities.length < 2) errs.push('Choose 2 ability scores for +1 (Half-Elf).')
      if (char.raceSlug === 'dragonborn' && !dragonAncestry) errs.push('Choose a Draconic Ancestry.')
      const raceSkillDef = raceSkillChoicesFor(opts)
      if (raceSkillDef && raceSkillChoices.length < raceSkillDef.count) {
        errs.push(`Choose ${raceSkillDef.count} skill${raceSkillDef.count > 1 ? 's' : ''} from your race trait.`)
      }
    }
    if (step === 1 && char.classes.length === 0) errs.push('Select a class.')
    if (step === 1 && char.classes.length > 0) {
      const slug = char.classes[0].classSlug
      const opts = CLASS_OPTIONS[slug]
      const toolChoice = classToolSplit(classes.find(c => c.slug === slug)?.toolProficiencies ?? []).choice
      if (toolChoice && classToolPicks.length < toolChoice.count) {
        errs.push(`Choose ${toolChoice.count} tool proficienc${toolChoice.count === 1 ? 'y' : 'ies'} (${toolChoice.label}).`)
      }
      if (opts?.subclasses[0]?.level === 1 && !subclass) errs.push(`Choose your ${level1SubclassLabel(slug)}.`)
      if (STYLE_AT_LEVEL_1.has(slug) && opts?.fightingStyles?.length && !fightingStyle) errs.push('Choose a fighting style.')
      if (slug === 'ranger' && !favoredEnemy) errs.push('Choose a favored enemy.')
      if (slug === 'ranger' && !favoredTerrain) errs.push('Choose a favored terrain.')
      const onList = (lvl: number) => spells.filter(sp => sp.level === lvl && (sp.classLists ?? []).includes(slug)).length
      const cantripsNeeded = Math.min(opts?.cantripsKnown ?? 0, onList(0))
      if (selectedCantrips.length < cantripsNeeded) errs.push(`Choose ${cantripsNeeded} cantrips (${selectedCantrips.length} chosen).`)
      const spellsNeeded = Math.min(opts?.spellsKnownAtL1 ?? 0, onList(1))
      if (selectedL1Spells.length < spellsNeeded) errs.push(`Choose ${spellsNeeded} level 1 spells (${selectedL1Spells.length} chosen).`)
    }
    if (step === 2 && !char.backgroundSlug) errs.push('Select a background.')
    if (step === 2 && char.backgroundSlug && bgToolChoiceLabel && !bgToolChoice) errs.push('Choose the tool your background gives you.')
    if (step === 4) {
      const cls = classes.find(c => c.slug === char.classes[0]?.classSlug)
      const locked = lockedSkills()
      const chosen = char.skillProficiencies.filter(sk => !locked.has(sk)).length
      const open = (cls?.skillChoices ?? []).filter(sk => !locked.has(sk)).length
      const needed = Math.min(cls?.numSkillChoices ?? 0, open)
      if (chosen < needed) errs.push(`Choose ${needed} class skills (${chosen} chosen).`)
    }
    if (step === 3 && abilityMethod === 'standard' && Object.keys(standardAssigned).length < ABILITIES.length) {
      errs.push('Assign all six Standard Array values.')
    }
    if (step === 5) {
      const missing = gearPickSlots().filter(p => !gearPicks[p.key]).length
      if (missing) errs.push(`Choose ${missing} starting item${missing > 1 ? 's' : ''} marked “your choice”.`)
    }
    if (step === 6 && !char.name.trim()) errs.push('Enter a character name.')
    return errs
  }

  /** Every "(your choice)" unit in the chosen starting gear, one per item of quantity. */
  function gearPickSlots(): { key: string; pick: GearPick; name: string }[] {
    const gear = CLASS_STARTING_GEAR[char.classes[0]?.classSlug ?? '']
    if (!gear) return []
    const out: { key: string; pick: GearPick; name: string }[] = []
    const add = (prefix: string, list: GearItem[]) => list.forEach((it, ii) => {
      if (it.pick) for (let n = 0; n < (it.quantity ?? 1); n++) out.push({ key: `${prefix}:${ii}:${n}`, pick: it.pick, name: it.name })
    })
    add('f', gear.fixed)
    gear.choices.forEach((g, gi) => {
      const label = gearChoices[gi] ?? 'a'
      const opt = g.options.find(o => o.label === label) ?? g.options[0]
      if (opt) add(`${gi}${opt.label}`, opt.items)
    })
    return out
  }

  function next() {
    const errs = validate()
    if (errs.length) { setErrors(errs); return }
    setErrors([])
    setStep(s => s + 1)
  }

  /** Skills the character has from their background and race rather than their class picks. */
  function lockedSkills(): Set<string> {
    const bg = backgrounds.find(b => b.slug === char.backgroundSlug)
    const race = races.find(r => r.slug === char.raceSlug)
    return new Set([...(bg?.skillProficiencies ?? []), ...(race?.grantedSkills ?? []), ...raceSkillChoices])
  }

  function back() {
    setErrors([])
    setStep(s => Math.max(0, s - 1))
  }

  function selectRace(slug: string) {
    setSelectedSubrace('')
    setHumanVariant(false)
    setVariantAbility1('')
    setVariantAbility2('')
    setVariantSkill('')
    setVariantFeat('')
    setHalfElfAbilities([])
    setFlexAbility('')
    setFlexAbility2('')
    setDragonAncestry('')
    setHighElfCantrip('')
    setRaceSkillChoices([])

    const opts = races.find(r => r.slug === slug)
    const autoSkills = opts?.grantedSkills ?? []
    // Skills the previous race gave (granted or picked) go away, unless the background also gives them
    const prevRace = races.find(r => r.slug === char.raceSlug)
    const bgSkills = backgrounds.find(b => b.slug === char.backgroundSlug)?.skillProficiencies ?? []
    const dropped = new Set([...(prevRace?.grantedSkills ?? []), ...raceSkillChoices].filter(sk => !bgSkills.includes(sk)))
    // Only the fixed languages; "one language of your choice" is picked on the Details step
    const { fixed: raceLangs } = splitRaceLanguages(opts?.grantedLanguages)
    const classLang = CLASS_SECRET_LANGUAGE[char.classes[0]?.classSlug ?? '']
    update({
      raceSlug: slug,
      subraceSlug: undefined,
      languages: [...new Set([...raceLangs, ...(classLang ? [classLang] : [])])],
      skillProficiencies: [...new Set([...char.skillProficiencies.filter(sk => !dropped.has(sk)), ...autoSkills])],
    })
  }

  function selectSubrace(subraceSlug: string) {
    setSelectedSubrace(subraceSlug)
    // Check for high elf cantrip
    if (subraceSlug !== 'high-elf') setHighElfCantrip('')
    update({ subraceSlug })
  }

  function selectClass(slug: string) {
    const cls = classes.find(c => c.slug === slug)
    if (!cls) return
    setFightingStyle('')
    setSelectedCantrips([])
    setSelectedL1Spells([])
    setClassToolPicks([])
    setSubclass('')
    setFavoredEnemy('')
    setFavoredTerrain('')
    setGearChoices({})
    setGearPicks({})
    const initialSlots = INITIAL_SPELL_SLOTS[slug] ?? {}
    const prevSlug = char.classes[0]?.classSlug
    const secretLang = CLASS_SECRET_LANGUAGE[slug]
    const prevSecret = prevSlug ? CLASS_SECRET_LANGUAGE[prevSlug] : undefined
    // A different class has a different skill list — keep only background and race skills
    const locked = lockedSkills()
    update({
      classes: [{ classSlug: slug, level: 1, hitDieRolls: [cls.hitDie] }],
      saveProficiencies: cls.saveProficiencies,
      armorProficiencies: cls.armorProficiencies,
      weaponProficiencies: cls.weaponProficiencies,
      spellSlots: initialSlots,
      // Warlocks cast from Pact Magic slots instead
      pactSlots: slug === 'warlock' ? { level: PACT_SLOT_TABLE[0][0], max: PACT_SLOT_TABLE[0][1], used: 0 } : undefined,
      languages: [...new Set([...char.languages.filter(l => l !== prevSecret), ...(secretLang ? [secretLang] : [])])],
      ...(prevSlug && prevSlug !== slug ? { skillProficiencies: char.skillProficiencies.filter(sk => locked.has(sk)) } : {}),
    })
  }

  function selectBackground(slug: string) {
    const bg = backgrounds.find(b => b.slug === slug)
    if (!bg) return
    const isChoiceTool = (t: string) => /^one\b|^any\b/i.test(t.trim())
    const concreteTools = bg.toolProficiencies.filter(t => !isChoiceTool(t))
    const choiceTool = bg.toolProficiencies.find(isChoiceTool) ?? ''
    setBgToolChoiceLabel(choiceTool)
    setBgToolChoice('')
    // Skills and tools from a previously selected background go away (race skills stay)
    const prev = backgrounds.find(b => b.slug === char.backgroundSlug)
    const raceSkills = new Set([...(races.find(r => r.slug === char.raceSlug)?.grantedSkills ?? []), ...raceSkillChoices])
    const prevSkills = new Set((prev?.skillProficiencies ?? []).filter(sk => !raceSkills.has(sk)))
    const prevTools = new Set(prev?.toolProficiencies ?? [])
    update({
      backgroundSlug: slug,
      skillProficiencies: [...new Set([...char.skillProficiencies.filter(sk => !prevSkills.has(sk)), ...bg.skillProficiencies])],
      toolProficiencies: [...new Set([...char.toolProficiencies.filter(t => !prevTools.has(t)), ...concreteTools])],
    })
  }

  function toggleCantrip(slug: string, max: number) {
    setSelectedCantrips(prev =>
      prev.includes(slug) ? prev.filter(s => s !== slug) : prev.length < max ? [...prev, slug] : prev
    )
  }

  function toggleL1Spell(slug: string, max: number) {
    setSelectedL1Spells(prev =>
      prev.includes(slug) ? prev.filter(s => s !== slug) : prev.length < max ? [...prev, slug] : prev
    )
  }

  function toggleHalfElfAbility(ability: string) {
    setHalfElfAbilities(prev => {
      if (prev.includes(ability)) return prev.filter(a => a !== ability)
      if (prev.length < 2) return [...prev, ability]
      return prev
    })
  }

  async function finish() {
    let finalChar = { ...char, abilityScores: finalScores }

    // Apply race skill choices (Orc Primal Intuition, Kenku Training, etc.)
    if (raceSkillChoices.length > 0) {
      const skills = new Set(finalChar.skillProficiencies)
      raceSkillChoices.forEach(s => skills.add(s))
      finalChar.skillProficiencies = [...skills]
    }

    // Apply variant human choices (its +1/+1 is already in finalScores)
    if (char.raceSlug === 'human' && humanVariant) {
      const skills = new Set(finalChar.skillProficiencies)
      if (variantSkill) skills.add(variantSkill)
      finalChar.skillProficiencies = [...skills]
      if (variantFeat) {
        finalChar.featuresChosen = [...finalChar.featuresChosen, { key: 'feat-l1', value: variantFeat }]
      }
      // Half-feat +1 is already in finalScores; Resilient also grants that ability's save
      if (variantFeatPick && variantFeatDef?.grantsProficiencies?.saves) {
        finalChar.saveProficiencies = [...new Set([...finalChar.saveProficiencies, variantFeatPick])]
      }
    }

    // Record dragonborn ancestry
    if (dragonAncestry) {
      finalChar.featuresChosen = [...finalChar.featuresChosen, { key: 'dragonborn-ancestry', value: dragonAncestry }]
    }

    // Class tool proficiencies (fixed ones + the player's picks)
    const classTools = classToolSplit(classes.find(c => c.slug === finalChar.classes[0]?.classSlug)?.toolProficiencies ?? [])
    finalChar.toolProficiencies = [...new Set([...finalChar.toolProficiencies, ...classTools.fixed, ...classToolPicks])]

    // Subclass chosen at level 1 (Cleric, Sorcerer, Warlock) and the proficiencies it grants
    if (subclass && finalChar.classes[0]) {
      finalChar.classes = [{ ...finalChar.classes[0], subclassSlug: subclass }]
      finalChar = applySubclassProficiencies(finalChar, finalChar.classes[0].classSlug, subclass)
    }

    // Weapon, armor and tool training from the race and subrace (Dwarven Combat Training, …)
    {
      const race = races.find(r => r.slug === finalChar.raceSlug)
      const sub = race?.subraces?.find(sr => sr.slug === finalChar.subraceSlug)
      const add = (have: string[], more: string[]) => [...new Set([...have, ...more])]
      finalChar.weaponProficiencies = add(finalChar.weaponProficiencies, [...(race?.grantedWeapons ?? []), ...(sub?.grantedWeapons ?? [])])
      finalChar.armorProficiencies = add(finalChar.armorProficiencies, [...(race?.grantedArmor ?? []), ...(sub?.grantedArmor ?? [])])
      finalChar.toolProficiencies = add(finalChar.toolProficiencies, [...(race?.grantedTools ?? []), ...(sub?.grantedTools ?? [])].filter(t => !/\bchoice\b/i.test(t)))
    }

    // Ranger level 1: Favored Enemy and Natural Explorer (same keys the Level Up wizard uses)
    if (finalChar.classes[0]?.classSlug === 'ranger') {
      if (favoredEnemy) finalChar.featuresChosen = [...finalChar.featuresChosen, { key: 'favored-enemy-1', value: favoredEnemy }]
      if (favoredTerrain) finalChar.featuresChosen = [...finalChar.featuresChosen, { key: 'favored-terrain-1', value: favoredTerrain }]
    }

    // Record fighting style
    if (fightingStyle) {
      finalChar.featuresChosen = [...finalChar.featuresChosen, { key: 'fighting-style', value: fightingStyle }]
    }

    // Add cantrips as spells
    const classSlug = finalChar.classes[0]?.classSlug ?? ''
    const cantripEntries = selectedCantrips.map(slug => {
      const def = spells.find(s => s.slug === slug)
      return { spellSlug: slug, name: def?.name ?? slug, classSlug, prepared: true, isHomebrew: false }
    })
    // Add high elf cantrip
    if (highElfCantrip) {
      const def = spells.find(s => s.slug === highElfCantrip)
      cantripEntries.push({ spellSlug: highElfCantrip, name: def?.name ?? highElfCantrip, classSlug: 'wizard', prepared: true, isHomebrew: false })
    }
    // Add known L1 spells
    const l1Entries = selectedL1Spells.map(slug => {
      const def = spells.find(s => s.slug === slug)
      // Known casters always have their spells ready; a wizard's start unprepared in the spellbook
      return { spellSlug: slug, name: def?.name ?? slug, classSlug, prepared: !CLASS_OPTIONS[classSlug]?.preparedCaster, isHomebrew: false }
    })

    finalChar.spells = [...cantripEntries, ...l1Entries]

    // Apply variant-human feat grants (Magic Initiate, Fey Touched, etc.)
    if (variantFeat) {
      const featDef = feats.find(f => f.slug === variantFeat)
      if (featDef) {
        const resolved = variantFeatClass ? withFeatClassChoice(featDef, variantFeatClass) : featDef
        const prompts = resolveFeatGrants(resolved, spells)
        for (const p of prompts) {
          const picks = variantFeatGrants[p.storageKey] ?? []
          if (picks.length > 0) {
            applyGrantPicks(finalChar, p, picks, featDef)
          }
        }
      }
    }

    // Apply structured starting gear (CLASS_STARTING_GEAR)
    const gear = CLASS_STARTING_GEAR[classSlug]
    if (gear) {
      const toAdd: EquipmentItem[] = []
      const makeItem = (name: string, slug: string | undefined, qty: number, notes: string): EquipmentItem => ({
        itemSlug: slug ?? `start-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
        name, quantity: qty, equipped: false, attuned: false, isHomebrew: false, notes,
      })
      // A "(your choice)" item becomes what the player picked, one per unit of quantity
      const addGear = (item: GearItem, key: string) => {
        if (!item.pick) { toAdd.push(makeItem(item.name, item.slug, item.quantity ?? 1, item.notes ?? '')); return }
        for (let n = 0; n < (item.quantity ?? 1); n++) {
          const chosen = gearPickOptions(item.pick).find(o => o.name === gearPicks[`${key}:${n}`])
          toAdd.push(chosen ? makeItem(chosen.name, chosen.slug, 1, '') : makeItem(item.name, item.slug, 1, item.notes ?? ''))
        }
      }
      gear.fixed.forEach((item, ii) => addGear(item, `f:${ii}`))
      for (let gi = 0; gi < gear.choices.length; gi++) {
        const label = gearChoices[gi] ?? 'a'
        const opt = gear.choices[gi].options.find(o => o.label === label) ?? gear.choices[gi].options[0]
        if (opt) opt.items.forEach((item, ii) => addGear(item, `${gi}${opt.label}:${ii}`))
      }
      // The same item twice (two shortswords) is one stack
      const existingNames = new Set(finalChar.equipment.map(e => e.name))
      const merged: EquipmentItem[] = []
      for (const item of toAdd) {
        const same = merged.find(m => m.name === item.name)
        if (same) same.quantity += item.quantity
        else if (!existingNames.has(item.name)) merged.push(item)
      }
      finalChar.equipment = [...finalChar.equipment, ...merged]
    }

    // Apply background starting equipment and gold
    const bgDef = backgrounds.find(b => b.slug === finalChar.backgroundSlug)
    if (bgDef) {
      const bgItems = parseBgItems(bgDef.startingEquipment)
      const existingNames = new Set(finalChar.equipment.map(e => e.name))
      for (const name of bgItems) {
        if (!existingNames.has(name)) {
          finalChar.equipment = [...finalChar.equipment, {
            itemSlug: `bg-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
            name, quantity: 1, equipped: false, attuned: false, isHomebrew: false, notes: '',
          }]
          existingNames.add(name)
        }
      }
      if (bgDef.startingGold > 0) {
        finalChar.currency = { ...finalChar.currency, gp: finalChar.currency.gp + bgDef.startingGold }
      }
      // Apply tool-of-choice selection
      if (bgToolChoice) {
        finalChar.toolProficiencies = [...new Set([...finalChar.toolProficiencies, bgToolChoice])]
        // "A set of artisan's tools (one of your choice)" is the tool just picked
        const kind = ARTISAN_TOOLS.includes(bgToolChoice) ? /artisan/i
          : MUSICAL_INSTRUMENTS.includes(bgToolChoice) ? /instrument/i
          : GAMING_SETS.includes(bgToolChoice) ? /gaming set/i : null
        const at = kind ? finalChar.equipment.findIndex(e => e.itemSlug.startsWith('bg-') && kind.test(e.name) && /your choice/i.test(e.name)) : -1
        if (at >= 0) {
          finalChar.equipment = finalChar.equipment.map((e, i) => i === at
            ? { ...e, name: bgToolChoice, itemSlug: `bg-${bgToolChoice.toLowerCase().replace(/[^a-z0-9]/g, '-')}` }
            : e)
        }
      }
    }

    // Start wearing the best armor and shield the character can use, weapon in hand
    {
      const has = (kind: string) => finalChar.armorProficiencies.some(p => p.toLowerCase().startsWith(kind))
      const canWear = (t: string) => t === 'shield' ? has('shield')
        : has('all') || has('heavy') || (t !== 'heavy' && has('medium')) || (t === 'light' && has('light'))
      const statsOf = (e: EquipmentItem) => items.find(i => i.slug === e.itemSlug)
      const dex = abilityMod(finalChar.abilityScores.dex)
      const acOf = (a: { acBase: number; type: string }) => a.acBase + (a.type === 'light' ? dex : a.type === 'medium' ? Math.min(dex, 2) : 0)
      let armorAt = -1, armorAc = 0, shieldAt = -1, weaponAt = -1, weaponAvg = 0
      finalChar.equipment.forEach((e, i) => {
        const a = statsOf(e)?.armorStats
        if (a && canWear(a.type)) {
          if (a.type === 'shield') { if (shieldAt < 0) shieldAt = i }
          else if (acOf(a) > armorAc) { armorAt = i; armorAc = acOf(a) }
        }
      })
      // Best melee weapon that fits beside the shield (average damage die)
      finalChar.equipment.forEach((e, i) => {
        const w = statsOf(e)?.weaponStats
        if (!w || w.ranged || (w.twoHanded && shieldAt >= 0)) return
        const m = /^(\d+)d(\d+)$/.exec(w.damage)
        const avg = m ? Number(m[1]) * (Number(m[2]) + 1) / 2 : 0
        if (avg > weaponAvg) { weaponAt = i; weaponAvg = avg }
      })
      // Natural armor (Tortle, Lizardfolk) can beat the armor on offer
      const natural = races.find(r => r.slug === finalChar.raceSlug)?.naturalArmor
      const naturalBetter = !!natural && (natural.addDex ? natural.base + dex : natural.base) >= armorAc
      finalChar.equipment = finalChar.equipment.map((e, i) => {
        if (i === armorAt && !naturalBetter) return { ...e, equipped: true }
        if (i === shieldAt) return { ...e, equipped: true, slot: 'off' as const }
        if (i === weaponAt) return { ...e, equipped: true, slot: statsOf(e)?.weaponStats?.twoHanded ? 'both' as const : 'main' as const }
        return e
      })
    }

    // HP: first level always max hit die
    const cls = classes.find(c => c.slug === classSlug)
    if (cls && finalChar.classes.length > 0) {
      finalChar.classes = [{ ...finalChar.classes[0], hitDieRolls: [cls.hitDie] }]
      // Start at full HP: hit die + CON, plus Hill Dwarf, Draconic Resilience and Tough
      const featSlugs = finalChar.featuresChosen.filter(f => f.key.startsWith('feat-') && typeof f.value === 'string').map(f => f.value as string)
      finalChar.hp = { current: hpMax(finalChar, content) + sumFeatBonuses(featSlugs, feats).hpBonusPerLevel, temp: 0 }
    }

    // The same tool from two sources ("thieves' tools" + "Thieves' tools") is listed once
    const seenTools = new Set<string>()
    finalChar.toolProficiencies = finalChar.toolProficiencies.filter(t => {
      const k = t.toLowerCase()
      if (seenTools.has(k)) return false
      seenTools.add(k)
      return true
    })

    finalChar.skillBaseline = { proficiencies: [...finalChar.skillProficiencies], expertise: [...finalChar.skillExpertise] }

    const final = touchUpdated(finalChar)
    await saveCharacterToDisk(final)
    navigate(`/c/${final.id}`)
  }

  if (loading) return <div className="text-center py-20 text-parchment-500">Loading content...</div>

  const raceOpts = races.find(r => r.slug === char.raceSlug)
  const raceSkillDef = raceSkillChoicesFor(raceOpts)
  const currentClassSlug = char.classes[0]?.classSlug ?? ''
  const currentClass = classes.find(c => c.slug === currentClassSlug)
  const classOpts = CLASS_OPTIONS[currentClassSlug]
  const cantripMax = classOpts?.cantripsKnown ?? 0
  const l1SpellMax = classOpts?.spellsKnownAtL1 ?? 0

  const classCantrips = spells.filter(s => s.level === 0 && (s.classLists ?? []).includes(currentClassSlug))
  const classL1Spells = spells.filter(s => s.level === 1 && (s.classLists ?? []).includes(currentClassSlug))
  const wizardCantrips = spells.filter(s => s.level === 0 && (s.classLists ?? []).includes('wizard'))

  return (
    <div className="max-w-4xl mx-auto">
      {/* Progress bar */}
      <div className="flex gap-1 mb-8">
        {STEPS.map((s, i) => (
          <div key={s} className={`flex-1 h-1.5 rounded-full ${i <= step ? 'bg-[rgb(var(--accent))]' : 'bg-parchment-200'}`} />
        ))}
      </div>
      <h1 className="text-2xl font-bold text-parchment-800 mb-1">{STEPS[step]}</h1>
      <p className="text-sm text-parchment-500 mb-6">Step {step + 1} of {STEPS.length}</p>

      {/* ── Step 0: Race ── */}
      {step === 0 && (
        <div className="space-y-3">
          <input
            className="input"
            placeholder="Search races…"
            value={raceSearch}
            onChange={e => setRaceSearch(e.target.value)}
            autoFocus
          />
          {(() => {
            const filtered = races.filter(r => r.name.toLowerCase().includes(raceSearch.toLowerCase()))
            if (raceSearch && filtered.length === 0) {
              return <p className="text-parchment-400 text-sm text-center py-4">No races match "{raceSearch}"</p>
            }
            if (races.length === 0) {
              return <p className="text-parchment-400">No race data. Run <code>npm run scrape</code> first.</p>
            }
            const categories: RaceCategory[] = ['Common', 'Uncommon', 'Exotic']
            const categoryDesc: Record<RaceCategory, string> = {
              Common: 'Core PHB races',
              Uncommon: 'Xanathar\'s, Mordenkainen\'s, Eberron & more',
              Exotic: 'Volo\'s, Monsters of the Multiverse & beyond',
            }
            const grouped = new Map<RaceCategory | 'Other', typeof filtered>()
            for (const cat of [...categories, 'Other' as const]) grouped.set(cat, [])
            for (const race of filtered) {
              grouped.get(race.category ?? 'Other')!.push(race)
            }

            const RaceCard = ({ race }: { race: typeof filtered[0] }) => {
              const bonuses = race.abilityBonuses ?? {}
              const bonusStr = Object.entries(bonuses)
                .filter(([, v]) => v && v > 0)
                .map(([k, v]) => `+${v} ${ABILITY_LABELS[k] ?? k}`)
                .join(', ')
              return (
                <button
                  key={race.slug}
                  onClick={() => selectRace(race.slug)}
                  className={`w-full text-left card hover:border-parchment-400 transition-colors ${char.raceSlug === race.slug ? 'border-parchment-600 bg-parchment-50' : ''}`}
                >
                  <div className="font-bold">{race.name}</div>
                  <div className="text-sm text-parchment-500">
                    Speed {race.speed}ft{bonusStr ? ` · ${bonusStr}` : ''}
                    {race.hasVariant ? ' · Standard or Variant' : ''}
                    {race.subraces?.length ? ` · ${race.subraces.length} subraces` : ''}
                  </div>
                </button>
              )
            }

            return (
              <div className="space-y-4">
                {categories.map(cat => {
                  const list = grouped.get(cat)!
                  if (list.length === 0) return null
                  return (
                    <div key={cat}>
                      <div className="flex items-baseline gap-2 mb-2">
                        <h3 className="font-bold text-parchment-700">{cat}</h3>
                        <span className="text-xs text-parchment-400">{categoryDesc[cat]}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {list.map(race => <RaceCard key={race.slug} race={race} />)}
                      </div>
                    </div>
                  )
                })}
                {(grouped.get('Other')!.length > 0) && (
                  <div>
                    <h3 className="font-bold text-parchment-700 mb-2">Other</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {grouped.get('Other')!.map(race => <RaceCard key={race.slug} race={race} />)}
                    </div>
                  </div>
                )}
              </div>
            )
          })()}

          {/* Race sub-options */}
          {char.raceSlug && (
            <div className="mt-4 space-y-4">

              {/* Variant Human toggle */}
              {raceOpts?.hasVariant && (
                <div className="card border-parchment-400">
                  <h3 className="font-bold mb-3">Human Variant</h3>
                  <div className="flex gap-4 mb-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" checked={!humanVariant} onChange={() => { setHumanVariant(false); selectRace(char.raceSlug) }} />
                      <span>Standard Human — +1 to all ability scores</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" checked={humanVariant} onChange={() => setHumanVariant(true)} />
                      <span>Variant Human — +1 to two scores, bonus skill, bonus feat</span>
                    </label>
                  </div>
                  {humanVariant && (
                    <div className="space-y-3 pl-2 border-l-2 border-parchment-300">
                      <div>
                        <label className="label">First +1 ability score</label>
                        <InlinePicker
                          options={ABILITIES.map(a => ({ value: a, label: ABILITY_LABELS[a], sub: String(char.abilityScores[a as keyof typeof char.abilityScores]) }))}
                          value={variantAbility1}
                          onChange={setVariantAbility1}
                          columns={3}
                        />
                      </div>
                      <div>
                        <label className="label">Second +1 ability score</label>
                        <InlinePicker
                          options={ABILITIES.filter(a => a !== variantAbility1).map(a => ({ value: a, label: ABILITY_LABELS[a], sub: String(char.abilityScores[a as keyof typeof char.abilityScores]) }))}
                          value={variantAbility2}
                          onChange={setVariantAbility2}
                          columns={3}
                        />
                      </div>
                      <div>
                        <label className="label">Bonus skill proficiency</label>
                        <div className="grid grid-cols-2 gap-1 max-h-48 overflow-y-auto">
                          {SKILLS.map(s => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => setVariantSkill(variantSkill === s ? '' : s)}
                              className={`text-left px-2.5 py-1.5 rounded border text-sm transition-colors ${variantSkill === s ? 'border-parchment-600 bg-parchment-50 font-medium' : 'border-parchment-100 hover:border-parchment-400'}`}
                            >
                              {SKILL_LABELS[s as keyof typeof SKILL_LABELS] ?? s}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="label">Bonus feat</label>
                        <FeatPicker
                          feats={feats}
                          value={variantFeat}
                          onChange={slug => {
                            setVariantFeat(slug)
                            setVariantFeatGrants({})
                            setVariantFeatClass('')
                            setVariantFeatAbility('')
                          }}
                          maxHeightClass="max-h-72"
                        />
                        {(() => {
                          const featDef = feats.find(f => f.slug === variantFeat)
                          if (!featDef) return null
                          return (
                            <>
                              <FeatAbilityPicker feat={featDef} scores={scoresBeforeFeat} value={variantFeatAbility} onChange={setVariantFeatAbility} />
                              <FeatGrantsBlock
                                feat={featDef}
                                spells={spells}
                                classChoice={variantFeatClass}
                                setClassChoice={setVariantFeatClass}
                                picks={variantFeatGrants}
                                setPicks={setVariantFeatGrants}
                              />
                            </>
                          )
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Race skill choices (Kenku Training, Orc Primal Intuition, etc.) */}
              {raceSkillDef && (
                <div className="card border-parchment-400">
                  <h3 className="font-bold mb-1">
                    Race Skill Proficiencies — Choose {raceSkillDef.count}
                  </h3>
                  <p className="text-xs text-parchment-500 mb-3">{raceSkillChoices.length}/{raceSkillDef.count} selected</p>
                  <div className="grid grid-cols-2 gap-1">
                    {raceSkillDef.from.map(s => {
                      const selected = raceSkillChoices.includes(s)
                      const atMax = raceSkillChoices.length >= raceSkillDef.count
                      return (
                        <label
                          key={s}
                          className={`flex items-center gap-2 p-2 rounded border cursor-pointer text-sm
                            ${selected ? 'border-parchment-600 bg-parchment-50' : 'border-parchment-100'}
                            ${!selected && atMax ? 'opacity-40 cursor-not-allowed' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            disabled={!selected && atMax}
                            onChange={() => {
                              const next = selected
                                ? raceSkillChoices.filter(x => x !== s)
                                : raceSkillChoices.length < raceSkillDef.count
                                  ? [...raceSkillChoices, s]
                                  : raceSkillChoices
                              setRaceSkillChoices(next)
                            }}
                          />
                          {SKILL_LABELS[s as keyof typeof SKILL_LABELS] ?? s}
                        </label>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Race-granted skills preview */}
              {raceOpts?.grantedSkills && raceOpts.grantedSkills.length > 0 && (
                <div className="card border-parchment-400 bg-parchment-50">
                  <h3 className="font-bold text-sm mb-1">Auto-granted Skill Proficiencies</h3>
                  <div className="flex flex-wrap gap-1">
                    {raceOpts.grantedSkills.map(s => (
                      <span key={s} className="text-xs bg-green-100 text-green-700 rounded px-2 py-0.5">
                        ✓ {SKILL_LABELS[s as keyof typeof SKILL_LABELS] ?? s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Base race innate spells (e.g. Hexblood) */}
              {raceOpts?.grantedSpells && raceOpts.grantedSpells.length > 0 && (
                <div className="card border-parchment-400 bg-indigo-50">
                  <h3 className="font-bold text-sm mb-1">Innate Spells</h3>
                  <div className="flex flex-wrap gap-1">
                    {raceOpts.grantedSpells.map(s => (
                      <span key={s.slug} className="text-xs bg-indigo-100 text-indigo-700 rounded px-2 py-0.5">
                        {s.name}{s.usesPerLongRest ? ` (${s.usesPerLongRest}/LR)` : s.level === 0 ? '' : ' (at will)'}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Subrace selection */}
              {raceOpts?.subraces && raceOpts.subraces.length > 0 && (
                <div className="card border-parchment-400">
                  <h3 className="font-bold mb-3">Choose Subrace</h3>
                  <div className="space-y-2">
                    {raceOpts.subraces.map(sub => (
                      <button
                        key={sub.slug}
                        onClick={() => selectSubrace(sub.slug)}
                        className={`w-full text-left p-3 rounded border transition-colors ${selectedSubrace === sub.slug ? 'border-parchment-600 bg-parchment-50' : 'border-parchment-200 hover:border-parchment-400'}`}
                      >
                        <div className="font-medium">{sub.name}</div>
                        <div className="text-sm text-parchment-500">
                          {Object.entries(sub.abilityBonuses ?? {}).filter(([,v]) => v && (v as number) > 0).map(([k,v]) => `+${v} ${ABILITY_LABELS[k] ?? k}`).join(', ')}
                          {sub.traits.length > 0 && ` · ${sub.traits.slice(0,2).join(' · ')}`}
                        </div>
                      </button>
                    ))}
                  </div>
                  {/* Subrace innate spells (e.g. Dark Elf, Tiefling variants) */}
                  {selectedSubrace && (() => {
                    const sub = raceOpts?.subraces?.find(s => s.slug === selectedSubrace)
                    if (!sub?.grantedSpells?.length) return null
                    return (
                      <div className="mt-3 rounded border border-indigo-200 bg-indigo-50 p-3">
                        <div className="font-semibold text-sm mb-1.5">{sub.name} — Innate Spells</div>
                        <div className="flex flex-wrap gap-1">
                          {sub.grantedSpells.map(s => (
                            <span key={s.slug} className="text-xs bg-indigo-100 text-indigo-700 rounded px-2 py-0.5">
                              {s.name}{s.usesPerLongRest ? ` (${s.usesPerLongRest}/LR)` : s.level === 0 ? '' : ' (at will)'}
                            </span>
                          ))}
                        </div>
                      </div>
                    )
                  })()}

                  {/* High Elf cantrip */}
                  {selectedSubrace === 'high-elf' && (
                    <div className="mt-3">
                      <label className="label">Bonus Cantrip (from Wizard list)</label>
                      <div className="grid grid-cols-2 gap-1 max-h-52 overflow-y-auto">
                        {wizardCantrips.map(s => (
                          <button
                            key={s.slug}
                            type="button"
                            onClick={() => setHighElfCantrip(highElfCantrip === s.slug ? '' : s.slug)}
                            className={`text-left px-2.5 py-1.5 rounded border text-sm transition-colors ${highElfCantrip === s.slug ? 'border-parchment-600 bg-parchment-50 font-medium' : 'border-parchment-100 hover:border-parchment-400'}`}
                          >
                            {s.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Half-Elf: choose +1 to 2 abilities */}
              {char.raceSlug === 'half-elf' && (
                <div className="card border-parchment-400">
                  <h3 className="font-bold mb-2">Half-Elf Ability Bonuses</h3>
                  <p className="text-sm text-parchment-500 mb-3">Choose 2 ability scores to each get +1 (you already get +2 CHA).</p>
                  <div className="grid grid-cols-3 gap-2">
                    {ABILITIES.filter(a => a !== 'cha').map(a => (
                      <label key={a} className={`flex items-center gap-2 p-2 rounded border cursor-pointer ${halfElfAbilities.includes(a) ? 'border-parchment-600 bg-parchment-50' : 'border-parchment-200'}`}>
                        <input type="checkbox" checked={halfElfAbilities.includes(a)} onChange={() => toggleHalfElfAbility(a)} />
                        <span className="text-sm">{ABILITY_LABELS[a]}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Flex ability choice */}
              {raceOpts?.chooseAbilityBonuses && char.raceSlug !== 'half-elf' && !raceOpts.hasVariant && (
                <div className="card border-parchment-400">
                  {(raceOpts.chooseAbilityBonuses ?? 0) >= 2 ? (
                    <>
                      <h3 className="font-bold mb-1">Flexible Ability Scores</h3>
                      <p className="text-sm text-parchment-500 mb-3">Put +2 into one ability score and +1 into a different one.</p>
                      <label className="label">+2 to</label>
                      <InlinePicker
                        options={ABILITIES.map(a => ({ value: a, label: ABILITY_LABELS[a], sub: String(char.abilityScores[a as keyof typeof char.abilityScores]) }))}
                        value={flexAbility}
                        onChange={v => { setFlexAbility(v); if (v === flexAbility2) setFlexAbility2('') }}
                        columns={3}
                      />
                      <label className="label mt-3">+1 to</label>
                      <InlinePicker
                        options={ABILITIES.filter(a => a !== flexAbility).map(a => ({ value: a, label: ABILITY_LABELS[a], sub: String(char.abilityScores[a as keyof typeof char.abilityScores]) }))}
                        value={flexAbility2}
                        onChange={setFlexAbility2}
                        columns={3}
                      />
                    </>
                  ) : (
                    <>
                      <h3 className="font-bold mb-2">Bonus Ability Score</h3>
                      <p className="text-sm text-parchment-500 mb-3">Choose 1 additional ability score to get +1.</p>
                      <InlinePicker
                        options={ABILITIES.map(a => ({ value: a, label: ABILITY_LABELS[a], sub: String(char.abilityScores[a as keyof typeof char.abilityScores]) }))}
                        value={flexAbility}
                        onChange={setFlexAbility}
                        columns={3}
                      />
                    </>
                  )}
                </div>
              )}

              {/* Dragonborn ancestry */}
              {char.raceSlug === 'dragonborn' && (
                <div className="card border-parchment-400">
                  <h3 className="font-bold mb-2">Draconic Ancestry</h3>
                  <p className="text-sm text-parchment-500 mb-3">Determines your breath weapon damage type and resistance.</p>
                  <div className="grid grid-cols-2 gap-2">
                    {DRACONIC_ANCESTRIES.map(a => (
                      <button
                        key={a.slug}
                        onClick={() => setDragonAncestry(a.slug)}
                        className={`text-left p-2 rounded border transition-colors text-sm ${dragonAncestry === a.slug ? 'border-parchment-600 bg-parchment-50' : 'border-parchment-200 hover:border-parchment-400'}`}
                      >
                        <span className="font-medium">{a.name}</span>
                        <span className="text-parchment-500"> — {a.damageType} ({a.breathShape})</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Step 1: Class ── */}
      {step === 1 && (
        <div className="space-y-3">
          <input
            className="input"
            placeholder="Search classes…"
            value={classSearch}
            onChange={e => setClassSearch(e.target.value)}
            autoFocus
          />
          <div className="grid grid-cols-2 gap-2">
          {classes
            .filter(c => c.name.toLowerCase().includes(classSearch.toLowerCase()))
            .map(cls => {
              const opts = CLASS_OPTIONS[cls.slug]
              return (
                <button
                  key={cls.slug}
                  onClick={() => selectClass(cls.slug)}
                  className={`w-full text-left card hover:border-parchment-400 transition-colors ${currentClassSlug === cls.slug ? 'border-parchment-600 bg-parchment-50' : ''}`}
                >
                  <div className="font-bold">{cls.name}</div>
                  <div className="text-sm text-parchment-500">
                    Hit Die: d{cls.hitDie} · {cls.saveProficiencies.map(s => ABILITY_LABELS[s] ?? s).join(', ')} saves
                    {cls.spellcastingAbility ? ` · Spellcasting (${ABILITY_LABELS[cls.spellcastingAbility]})` : ''}
                  </div>
                  {opts?.subclasses[0] && (
                    <div className="text-xs text-parchment-400 mt-1">
                      Subclass at L{opts.subclasses[0].level} · e.g. {opts.subclasses.slice(0,3).map(s => s.name).join(', ')}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
          {classSearch && classes.filter(c => c.name.toLowerCase().includes(classSearch.toLowerCase())).length === 0 && (
            <p className="text-parchment-400 text-sm text-center py-4">No classes match "{classSearch}"</p>
          )}

          {/* Class sub-options */}
          {currentClassSlug && (
            <div className="space-y-4 mt-2">

              {/* Class features preview */}
              {classOpts?.features?.filter(f => f.level === 1).length > 0 && (
                <div className="card border-parchment-400">
                  <h3 className="font-bold mb-2">Level 1 Features</h3>
                  {classOpts.features.filter(f => f.level === 1).map(f => (
                    <div key={f.name} className="mb-2">
                      <div className="text-sm font-medium">{f.name}</div>
                      <div className="text-xs text-parchment-500">{f.description}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Tool proficiencies from the class */}
              {(() => {
                const { fixed, choice } = classToolSplit(currentClass?.toolProficiencies ?? [])
                if (!fixed.length && !choice) return null
                return (
                  <div className="card border-parchment-400">
                    <h3 className="font-bold mb-2">Tool Proficiencies</h3>
                    {fixed.length > 0 && <p className="text-sm text-parchment-600 mb-2">You're proficient with: <strong>{fixed.join(', ')}</strong></p>}
                    {choice && (
                      <>
                        <p className="text-sm text-parchment-500 mb-2">{choice.label}: choose {choice.count} ({classToolPicks.length}/{choice.count})</p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                          {choice.options.map(tool => {
                            const picked = classToolPicks.includes(tool)
                            const full = classToolPicks.length >= choice.count
                            return (
                              <button key={tool} type="button" disabled={!picked && full}
                                onClick={() => setClassToolPicks(prev => picked ? prev.filter(t => t !== tool) : [...prev, tool])}
                                className={`text-left text-sm px-2 py-1 rounded border transition-colors disabled:opacity-40 ${picked ? 'border-parchment-600 bg-parchment-100 font-medium' : 'border-parchment-200 hover:border-parchment-400'}`}
                              >{tool}</button>
                            )
                          })}
                        </div>
                      </>
                    )}
                  </div>
                )
              })()}

              {/* Subclass chosen at level 1 (Divine Domain, Sorcerous Origin, Otherworldly Patron) */}
              {classOpts?.subclasses[0]?.level === 1 && (
                <div className="card border-parchment-400">
                  <h3 className="font-bold mb-3">Choose your {level1SubclassLabel(currentClassSlug)}</h3>
                  <div className="space-y-2">
                    {classOpts.subclasses.map(sc => (
                      <button
                        key={sc.slug}
                        onClick={() => setSubclass(sc.slug)}
                        className={`w-full text-left p-3 rounded border transition-colors ${subclass === sc.slug ? 'border-parchment-600 bg-parchment-50' : 'border-parchment-200 hover:border-parchment-400'}`}
                      >
                        <div className="font-medium text-sm">{sc.name}</div>
                        {sc.description && <div className="text-xs text-parchment-500">{sc.description}</div>}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Ranger level 1: Favored Enemy and Natural Explorer */}
              {currentClassSlug === 'ranger' && (
                <div className="card border-parchment-400">
                  <h3 className="font-bold mb-3">Favored Enemy &amp; Natural Explorer</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="label">Favored enemy</label>
                      <select className="input text-sm" value={favoredEnemy} onChange={e => setFavoredEnemy(e.target.value)}>
                        <option value="">— choose a creature type —</option>
                        {FAVORED_ENEMY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label">Favored terrain</label>
                      <select className="input text-sm" value={favoredTerrain} onChange={e => setFavoredTerrain(e.target.value)}>
                        <option value="">— choose a terrain —</option>
                        {FAVORED_TERRAINS.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Fighting Style — Fighters pick at level 1; Paladins and Rangers pick at level 2 (Level Up) */}
              {classOpts?.fightingStyles && STYLE_AT_LEVEL_1.has(currentClassSlug) && (
                <div className="card border-parchment-400">
                  <h3 className="font-bold mb-3">Choose a Fighting Style</h3>
                  <div className="space-y-2">
                    {classOpts.fightingStyles.map(style => (
                      <button
                        key={style.slug}
                        onClick={() => setFightingStyle(style.slug)}
                        className={`w-full text-left p-3 rounded border transition-colors ${fightingStyle === style.slug ? 'border-parchment-600 bg-parchment-50' : 'border-parchment-200 hover:border-parchment-400'}`}
                      >
                        <div className="font-medium text-sm">{style.name}</div>
                        <div className="text-xs text-parchment-500">{style.description}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Cantrip selection */}
              {cantripMax > 0 && (
                <div className="card border-parchment-400">
                  <h3 className="font-bold mb-1">Choose {cantripMax} Cantrips</h3>
                  <p className="text-xs text-parchment-500 mb-3">{selectedCantrips.length}/{cantripMax} selected</p>
                  <div className="grid grid-cols-2 gap-1 max-h-64 overflow-y-auto">
                    {classCantrips.map(s => (
                      <label
                        key={s.slug}
                        className={`flex items-center gap-2 p-2 rounded border cursor-pointer text-sm ${selectedCantrips.includes(s.slug) ? 'border-parchment-600 bg-parchment-50' : 'border-parchment-100 hover:border-parchment-300'} ${!selectedCantrips.includes(s.slug) && selectedCantrips.length >= cantripMax ? 'opacity-40 cursor-not-allowed' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedCantrips.includes(s.slug)}
                          onChange={() => toggleCantrip(s.slug, cantripMax)}
                          disabled={!selectedCantrips.includes(s.slug) && selectedCantrips.length >= cantripMax}
                        />
                        {s.name}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Known spells at L1 */}
              {l1SpellMax > 0 && (
                <div className="card border-parchment-400">
                  <h3 className="font-bold mb-1">
                    Choose {l1SpellMax} Level 1 Spell{l1SpellMax !== 1 ? 's' : ''}
                    {classOpts?.preparedCaster ? ' for your Spellbook' : ' Known'}
                  </h3>
                  {classOpts?.preparedCaster && (
                    <p className="text-xs text-parchment-400 mb-2">As a prepared caster you can swap prepared spells on a long rest. This picks your starting spellbook.</p>
                  )}
                  <p className="text-xs text-parchment-500 mb-3">{selectedL1Spells.length}/{l1SpellMax} selected</p>
                  <div className="grid grid-cols-2 gap-1 max-h-64 overflow-y-auto">
                    {classL1Spells.map(s => (
                      <label
                        key={s.slug}
                        className={`flex items-center gap-2 p-2 rounded border cursor-pointer text-sm ${selectedL1Spells.includes(s.slug) ? 'border-parchment-600 bg-parchment-50' : 'border-parchment-100 hover:border-parchment-300'} ${!selectedL1Spells.includes(s.slug) && selectedL1Spells.length >= l1SpellMax ? 'opacity-40 cursor-not-allowed' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedL1Spells.includes(s.slug)}
                          onChange={() => toggleL1Spell(s.slug, l1SpellMax)}
                          disabled={!selectedL1Spells.includes(s.slug) && selectedL1Spells.length >= l1SpellMax}
                        />
                        {s.name}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Subclass preview */}
              {classOpts?.subclasses && classOpts.subclasses[0]?.level !== 1 && (
                <div className="card border-parchment-400">
                  <h3 className="font-bold mb-2">
                    Subclass at Level {classOpts.subclasses[0]?.level} — preview
                  </h3>
                  <div className="space-y-2">
                    {classOpts.subclasses.slice(0, 4).map(sc => (
                      <div key={sc.slug} className="text-sm">
                        <span className="font-medium">{sc.name}</span>
                        <span className="text-parchment-500"> — {sc.description}</span>
                      </div>
                    ))}
                    {classOpts.subclasses.length > 4 && (
                      <p className="text-xs text-parchment-400">+ {classOpts.subclasses.length - 4} more options when you reach that level.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Step 2: Background ── */}
      {step === 2 && (() => {
        const bgMatchFilter = (bg: typeof backgrounds[0]) => {
          const q = bgSearch.toLowerCase()
          if (!q) return true
          if (bg.name.toLowerCase().includes(q)) return true
          return bg.skillProficiencies.some(s => {
            const label = SKILL_LABELS[s as keyof typeof SKILL_LABELS] ?? s
            return s.toLowerCase().includes(q) || label.toLowerCase().includes(q)
          })
        }
        const BgCard = (bg: typeof backgrounds[0]) => (
          <button
            key={bg.slug}
            onClick={() => selectBackground(bg.slug)}
            className={`w-full text-left card hover:border-parchment-400 transition-colors ${char.backgroundSlug === bg.slug ? 'border-parchment-600 bg-parchment-50' : ''}`}
          >
            <div className="font-bold">{bg.name}</div>
            <div className="text-sm text-parchment-500">
              Skills: {bg.skillProficiencies.map(s => SKILL_LABELS[s as keyof typeof SKILL_LABELS] ?? s).join(', ')}
            </div>
            <div className="text-xs text-parchment-400 mt-1">{bg.feature.name}</div>
            {STRIXHAVEN_COLLEGES[bg.slug] && (
              <div className="text-xs text-violet-600 mt-1">🔮 Strixhaven Initiate — grants {STRIXHAVEN_COLLEGES[bg.slug].college} cantrip + 1st-level spell</div>
            )}
          </button>
        )

        // Tool choice picker shown after a background is selected
        const ToolChoicePicker = char.backgroundSlug && bgToolChoiceLabel ? (
          <div className="mt-4 p-3 rounded border border-amber-200 bg-amber-50">
            <div className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-1">Tool Proficiency Choice</div>
            <p className="text-sm text-parchment-600 mb-2">{bgToolChoiceLabel}</p>
            <select
              className="input text-sm"
              value={bgToolChoice}
              onChange={e => setBgToolChoice(e.target.value)}
            >
              <option value="">— choose a tool —</option>
              {bgToolOptions(bgToolChoiceLabel).filter(t => !classToolPicks.includes(t)).map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        ) : null

        // Flat filtered list when searching
        if (bgSearch) {
          const filtered = backgrounds.filter(bgMatchFilter)
          return (
            <div className="space-y-3">
              <input className="input" placeholder="Search by name or skill (e.g. Stealth, Arcana)…" value={bgSearch} onChange={e => setBgSearch(e.target.value)} autoFocus />
              {filtered.length > 0
                ? <div className="grid grid-cols-2 gap-2">{filtered.map(bg => BgCard(bg))}</div>
                : <p className="text-parchment-400 text-sm text-center py-4">No backgrounds match "{bgSearch}"</p>}
              {ToolChoicePicker}
            </div>
          )
        }

        // Grouped by source book when not searching
        const bookOrder: string[] = []
        const byBook = new Map<string, typeof backgrounds>()
        for (const bg of backgrounds) {
          const book = bg.book ?? 'Other'
          if (!byBook.has(book)) { byBook.set(book, []); bookOrder.push(book) }
          byBook.get(book)!.push(bg)
        }

        return (
          <div className="space-y-1">
            <input className="input mb-3" placeholder="Search by name or skill (e.g. Stealth, Arcana)…" value={bgSearch} onChange={e => setBgSearch(e.target.value)} autoFocus />
            {backgrounds.length === 0 && <p className="text-parchment-400">No background data. Run <code>npm run scrape</code> first.</p>}
            {bookOrder.map(book => {
              const bgs = byBook.get(book)!
              return (
                <div key={book}>
                  <div className="text-xs font-bold text-parchment-500 uppercase tracking-wider mt-5 mb-2 px-1 border-b border-parchment-200 pb-1">
                    {book}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {bgs.map(bg => BgCard(bg))}
                  </div>
                </div>
              )
            })}
            {ToolChoicePicker}
          </div>
        )
      })()}

      {/* ── Step 3: Abilities ── */}
      {step === 3 && (
        <div>
          <div className="flex gap-2 mb-6">
            {(['standard', 'pointbuy', 'manual'] as const).map(m => (
              <button
                key={m}
                onClick={() => changeAbilityMethod(m)}
                className={`btn ${abilityMethod === m ? 'btn-primary' : 'btn-secondary'} text-sm`}
              >
                {m === 'standard' ? 'Standard Array' : m === 'pointbuy' ? 'Point Buy' : 'Manual'}
              </button>
            ))}
          </div>

          {abilityMethod === 'standard' && (
            <div>
              <p className="text-sm text-parchment-500 mb-4">Assign 15, 14, 13, 12, 10, 8 to each ability (before racial bonuses).</p>
              <div className="grid grid-cols-3 gap-3">
                {ABILITIES.map(ability => {
                  return (
                    <div key={ability}>
                      <label className="label">{ABILITY_LABELS[ability]}</label>
                      <select
                        className="input"
                        value={standardAssigned[ability] ?? ''}
                        onChange={e => {
                          const val = parseInt(e.target.value, 10)
                          const newAssigned = { ...standardAssigned }
                          if (Number.isNaN(val)) delete newAssigned[ability]
                          else newAssigned[ability] = val
                          setStandardAssigned(newAssigned)
                          setBaseScores(prev => ({ ...prev, [ability]: Number.isNaN(val) ? 10 : val }))
                        }}
                      >
                        <option value="">—</option>
                        {STANDARD_ARRAY.map(v => {
                          const takenByOther = Object.entries(standardAssigned).some(([k, tv]) => k !== ability && tv === v)
                          return !takenByOther ? <option key={v} value={v}>{v}</option> : null
                        })}
                      </select>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {abilityMethod === 'manual' && (
            <div>
              <p className="text-sm text-parchment-500 mb-4">Enter each score before racial bonuses (e.g. what you rolled).</p>
              <div className="grid grid-cols-3 gap-3">
                {ABILITIES.map(ability => (
                  <div key={ability}>
                    <label className="label">{ABILITY_LABELS[ability]}</label>
                    <input
                      type="number" min={1} max={30} className="input"
                      value={baseScores[ability]}
                      onChange={e => {
                        const val = Math.max(1, Math.min(30, parseInt(e.target.value, 10) || 10))
                        setBaseScores(prev => ({ ...prev, [ability]: val }))
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {abilityMethod === 'pointbuy' && (
            <PointBuyPanel scores={baseScores} onChange={setBaseScores} />
          )}

          {/* Final scores: base + racial bonuses — exactly what the character will have */}
          <div className="mt-6">
            <div className="label">Final scores (with racial bonuses)</div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {ABILITIES.map(ability => {
                const bonus = racialBonuses[ability] ?? 0
                const final = finalScores[ability]
                return (
                  <div key={ability} className="stat-box">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-parchment-500">{ability}</span>
                    <span className="text-xl font-bold text-parchment-900">{final}</span>
                    <span className="text-xs text-parchment-600">{abilityMod(final) >= 0 ? '+' : ''}{abilityMod(final)}</span>
                    <span className="text-[10px] text-parchment-400 mt-0.5">
                      {baseScores[ability]}{bonus ? ` ${bonus > 0 ? '+' : '−'} ${Math.abs(bonus)} race` : ''}{variantFeatPick === ability ? ' + 1 feat' : ''}
                    </span>
                  </div>
                )
              })}
            </div>
            {!char.raceSlug && <p className="text-xs text-parchment-400 mt-2">Pick a race to see its bonuses applied.</p>}
          </div>
        </div>
      )}

      {/* ── Step 4: Skills ── */}
      {step === 4 && (() => {
        const bg = backgrounds.find(b => b.slug === char.backgroundSlug)
        const bgSkills = new Set(bg?.skillProficiencies ?? [])
        const raceGrants = new Set(races.find(r => r.slug === char.raceSlug)?.grantedSkills ?? [])
        const raceChoicesSet = new Set(raceSkillChoices)
        const locked = new Set([...bgSkills, ...raceGrants, ...raceChoicesSet])

        // Count only skills chosen by the player (not from bg/race)
        const chosenByPlayer = char.skillProficiencies.filter(s => !locked.has(s))
        const limit = currentClass?.numSkillChoices ?? 0
        const atLimit = chosenByPlayer.length >= limit

        return (
          <div>
            {currentClass && (
              <div className="mb-4 p-3 bg-parchment-50 border border-parchment-200 rounded text-sm space-y-1">
                <p>Choose <strong>{limit}</strong> skills from your {currentClass.name} list. ({chosenByPlayer.length}/{limit} chosen)</p>
                {bgSkills.size > 0 && <p className="text-parchment-500">🟦 Background: {[...bgSkills].map(s => SKILL_LABELS[s as keyof typeof SKILL_LABELS] ?? s).join(', ')}</p>}
                {raceGrants.size > 0 && <p className="text-parchment-500">🟩 Race (auto): {[...raceGrants].map(s => SKILL_LABELS[s as keyof typeof SKILL_LABELS] ?? s).join(', ')}</p>}
                {raceChoicesSet.size > 0 && <p className="text-parchment-500">🟩 Race (chosen): {[...raceChoicesSet].map(s => SKILL_LABELS[s as keyof typeof SKILL_LABELS] ?? s).join(', ')}</p>}
              </div>
            )}
            {classOpts?.expertiseAt?.includes(1) && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-300 rounded text-sm">
                <strong>Expertise:</strong> As a {currentClass?.name}, you also gain Expertise in {classOpts.expertiseCount} proficient skills (double PB). Pick them on the sheet's Features tab after creation.
              </div>
            )}
            <div className="grid grid-cols-3 gap-2">
              {SKILLS.map(skill => {
                const fromBg = bgSkills.has(skill)
                const fromRace = raceGrants.has(skill) || raceChoicesSet.has(skill)
                const isLocked = fromBg || fromRace
                const inClassList = !currentClass || currentClass.skillChoices.includes(skill)
                const checked = char.skillProficiencies.includes(skill) || isLocked
                const canToggleOn = inClassList && !isLocked && (!atLimit || checked)
                const source = fromBg ? '🟦 BG' : fromRace ? '🟩 Race' : ''
                return (
                  <label
                    key={skill}
                    className={`flex items-center gap-2 p-2 rounded border cursor-pointer text-sm
                      ${checked ? 'border-parchment-500 bg-parchment-50' : 'border-parchment-200'}
                      ${isLocked ? 'opacity-70' : ''}
                      ${!inClassList && !isLocked && !checked ? 'opacity-30' : ''}
                    `}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={isLocked || (!canToggleOn && !checked)}
                      onChange={e => {
                        const s = new Set(char.skillProficiencies)
                        e.target.checked ? s.add(skill) : s.delete(skill)
                        update({ skillProficiencies: [...s] })
                      }}
                    />
                    <span>{SKILL_LABELS[skill]}</span>
                    {source && <span className="text-xs ml-auto">{source}</span>}
                  </label>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* ── Step 5: Starting Equipment ── */}
      {step === 5 && (() => {
        const classSlug = char.classes[0]?.classSlug ?? ''
        const gear = CLASS_STARTING_GEAR[classSlug]
        if (!gear) {
          return (
            <div>
              <p className="text-sm text-parchment-500 mb-4">Starting equipment will be applied automatically. You can add more items from the character sheet.</p>
              <p className="text-parchment-400 text-sm">No structured equipment data for this class.</p>
            </div>
          )
        }
        return (
          <div>
            <p className="text-sm text-parchment-500 mb-4">Review your starting gear. For each choice, select an option — all items will be added to your inventory.</p>

            {/* Fixed items */}
            {gear.fixed.length > 0 && (
              <div className="mb-4">
                <div className="text-xs font-semibold text-parchment-600 uppercase mb-2">You always receive:</div>
                <div className="space-y-1">
                  {gear.fixed.map((item, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 rounded border border-green-100 bg-green-50 text-sm">
                      <span className="text-green-600 font-bold">✓</span>
                      <span>{item.quantity && item.quantity > 1 ? `${item.name} ×${item.quantity}` : item.name}</span>
                      {item.notes && <span className="text-parchment-400 text-xs">— {item.notes}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Choice groups */}
            {gear.choices.map((group, gi) => (
              <div key={gi} className="mb-4">
                <div className="text-xs font-semibold text-parchment-600 uppercase mb-2">Choice {gear.choices.length > 1 ? gi + 1 : ''}:</div>
                <div className="space-y-2">
                  {group.options.map(opt => (
                    <label
                      key={opt.label}
                      className={`flex items-start gap-3 p-3 rounded border cursor-pointer ${(gearChoices[gi] ?? 'a') === opt.label ? 'border-parchment-500 bg-parchment-50' : 'border-parchment-200 hover:border-parchment-400'}`}
                    >
                      <input
                        type="radio"
                        name={`gear-${gi}`}
                        checked={(gearChoices[gi] ?? 'a') === opt.label}
                        onChange={() => setGearChoices(prev => ({ ...prev, [gi]: opt.label }))}
                        className="mt-0.5 shrink-0"
                      />
                      <div>
                        <div className="font-medium text-sm">{opt.desc}</div>
                        <div className="text-xs text-parchment-400 mt-0.5">
                          {opt.items.map(item =>
                            item.quantity && item.quantity > 1 ? `${item.name} ×${item.quantity}` : item.name
                          ).join(', ')}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            ))}

            {/* "(your choice)" items: which weapon or instrument */}
            {gearPickSlots().length > 0 && (
              <div className="mb-4 p-3 rounded border border-amber-200 bg-amber-50">
                <div className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-2">Your Choice</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {gearPickSlots().map(slot => (
                    <label key={slot.key} className="block">
                      <span className="text-sm text-parchment-600">{slot.name.replace(' (your choice)', '')}</span>
                      <select
                        className="input text-sm"
                        value={gearPicks[slot.key] ?? ''}
                        onChange={e => setGearPicks(prev => ({ ...prev, [slot.key]: e.target.value }))}
                      >
                        <option value="">— choose —</option>
                        {gearPickOptions(slot.pick).map(o => <option key={o.name} value={o.name}>{o.name}</option>)}
                      </select>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })()}

      {/* ── Step 6: Details ── */}
      {step === 6 && (
        <div className="space-y-4">
          <div>
            <label className="label">Character Name *</label>
            <input className="input" value={char.name === 'Unnamed Adventurer' ? '' : char.name} onChange={e => update({ name: e.target.value })} placeholder="Thalindra Moonwhisper" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-3">
              <label className="label">Alignment</label>
              <div className="grid grid-cols-3 gap-1">
                {['Lawful Good','Neutral Good','Chaotic Good','Lawful Neutral','True Neutral','Chaotic Neutral','Lawful Evil','Neutral Evil','Chaotic Evil'].map(a => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => update({ alignment: char.alignment === a ? '' : a })}
                    className={`px-2 py-1.5 rounded border text-sm transition-colors ${char.alignment === a ? 'border-parchment-600 bg-parchment-50 font-medium' : 'border-parchment-200 hover:border-parchment-400'}`}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="label">Age</label>
              <input className="input" value={char.age} onChange={e => update({ age: e.target.value })} placeholder="25" />
            </div>
            <div>
              <label className="label">Height</label>
              <input className="input" value={char.height} onChange={e => update({ height: e.target.value })} placeholder='5&apos;8"' />
            </div>
            <div>
              <label className="label">Weight</label>
              <input className="input" value={char.weight} onChange={e => update({ weight: e.target.value })} placeholder="140 lbs" />
            </div>
          </div>

          {/* Languages */}
          <div>
            <label className="label">Languages</label>
            {(() => {
              const bgDef = backgrounds.find(b => b.slug === char.backgroundSlug)
              const bgLangCount = bgDef?.languages ?? 0
              const langRace = races.find(r => r.slug === char.raceSlug)
              const raceLangCount = splitRaceLanguages(langRace?.grantedLanguages).choices
                + (langRace?.subraces?.find(sr => sr.slug === char.subraceSlug)?.extraLanguages ?? 0)
              const total = raceLangCount + bgLangCount
              if (total === 0) return null
              const sources = [
                raceLangCount ? `${raceLangCount} from your race` : '',
                bgLangCount ? `${bgLangCount} from your background` : '',
              ].filter(Boolean).join(' and ')
              return (
                <p className="text-xs text-parchment-500 mb-2 p-2 bg-parchment-50 rounded border border-parchment-200">
                  Pick {total} language{total > 1 ? 's' : ''} of your choice below ({sources}).
                </p>
              )
            })()}

            {/* Currently known */}
            {char.languages.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {char.languages.map(lang => (
                  <span key={lang} className="inline-flex items-center gap-1 text-xs bg-parchment-200 text-parchment-800 border border-parchment-300 rounded-full px-2.5 py-1 font-medium">
                    {lang}
                    <button type="button" onClick={() => update({ languages: char.languages.filter(l => l !== lang) })}
                      className="text-parchment-400 hover:text-red-500 leading-none transition-colors">×</button>
                  </span>
                ))}
              </div>
            )}

            {/* Standard languages */}
            <div className="text-[10px] font-bold text-parchment-400 uppercase tracking-widest mb-1.5">Standard</div>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {LANGUAGES_STANDARD.map(lang => {
                const has = char.languages.includes(lang)
                return (
                  <button key={lang} type="button"
                    onClick={() => update({ languages: has ? char.languages.filter(l => l !== lang) : [...char.languages, lang] })}
                    className={`text-xs rounded-full px-2.5 py-1 border transition-colors ${has ? 'bg-parchment-700 text-white border-parchment-700' : 'border-parchment-200 text-parchment-500 hover:border-parchment-500 hover:text-parchment-800'}`}
                  >{lang}</button>
                )
              })}
            </div>

            {/* Exotic languages */}
            <div className="text-[10px] font-bold text-parchment-400 uppercase tracking-widest mb-1.5">Exotic</div>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {LANGUAGES_EXOTIC.map(lang => {
                const has = char.languages.includes(lang)
                return (
                  <button key={lang} type="button"
                    onClick={() => update({ languages: has ? char.languages.filter(l => l !== lang) : [...char.languages, lang] })}
                    className={`text-xs rounded-full px-2.5 py-1 border transition-colors ${has ? 'bg-indigo-600 text-white border-indigo-600' : 'border-parchment-200 text-parchment-500 hover:border-indigo-400 hover:text-indigo-700'}`}
                  >{lang}</button>
                )
              })}
            </div>

            {/* Custom language */}
            <input className="input text-sm" placeholder="Add custom language (press Enter)…"
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  const val = (e.target as HTMLInputElement).value.trim()
                  if (val && !char.languages.includes(val)) {
                    update({ languages: [...char.languages, val] })
                    ;(e.target as HTMLInputElement).value = ''
                  }
                }
              }}
            />
          </div>
          <div>
            <label className="label">Backstory</label>
            <textarea className="input min-h-[100px]" value={char.backstory} onChange={e => update({ backstory: e.target.value })} placeholder="Born in a small fishing village..." />
          </div>
        </div>
      )}

      {/* ── Step 7: Review ── */}
      {step === 7 && (
        <div className="space-y-4">
          <div className="card">
            <div className="text-xl font-bold">{char.name || 'Unnamed'}</div>
            <div className="text-sm text-parchment-500 mt-1">
              {humanVariant ? 'Variant ' : ''}{races.find(r => r.slug === char.raceSlug)?.name ?? '—'}
              {selectedSubrace ? ` (${raceOpts?.subraces?.find(s => s.slug === selectedSubrace)?.name})` : ''}
              {char.raceSlug === 'dragonborn' && dragonAncestry ? ` · ${DRACONIC_ANCESTRIES.find(a => a.slug === dragonAncestry)?.name} Dragon` : ''}
              {' · '}Level 1 {classes.find(c => c.slug === currentClassSlug)?.name ?? '—'}
              {subclass ? ` (${classOpts?.subclasses.find(sc => sc.slug === subclass)?.name})` : ''}
              {' · '}{backgrounds.find(b => b.slug === char.backgroundSlug)?.name ?? '—'}
              {char.alignment ? ` · ${char.alignment}` : ''}
            </div>
          </div>
          <div className="card">
            <h3 className="section-header">Ability Scores</h3>
            <div className="grid grid-cols-6 gap-2 text-center">
              {ABILITIES.map(a => (
                <div key={a} className="stat-box">
                  <div className="text-xs uppercase text-parchment-500">{a}</div>
                  <div className="text-xl font-bold">{char.abilityScores[a]}</div>
                  <div className="text-sm text-parchment-600">{abilityMod(char.abilityScores[a]) >= 0 ? '+' : ''}{abilityMod(char.abilityScores[a])}</div>
                </div>
              ))}
            </div>
          </div>
          {selectedCantrips.length > 0 && (
            <div className="card">
              <h3 className="section-header">Cantrips</h3>
              <div className="text-sm text-parchment-600">{selectedCantrips.map(slug => spells.find(s => s.slug === slug)?.name ?? slug).join(', ')}</div>
            </div>
          )}
          {selectedL1Spells.length > 0 && (
            <div className="card">
              <h3 className="section-header">Level 1 Spells</h3>
              <div className="text-sm text-parchment-600">{selectedL1Spells.map(slug => spells.find(s => s.slug === slug)?.name ?? slug).join(', ')}</div>
            </div>
          )}
          {fightingStyle && (
            <div className="card">
              <h3 className="section-header">Fighting Style</h3>
              <div className="text-sm text-parchment-600">{classOpts?.fightingStyles?.find(f => f.slug === fightingStyle)?.name}</div>
            </div>
          )}
          {variantFeat && (
            <div className="card">
              <h3 className="section-header">Feat</h3>
              <div className="text-sm text-parchment-600">{feats.find(f => f.slug === variantFeat)?.name}</div>
            </div>
          )}
          <div className="card">
            <h3 className="section-header">Skills</h3>
            <div className="text-sm text-parchment-600">
              {char.skillProficiencies.length > 0
                ? char.skillProficiencies.map(s => SKILL_LABELS[s as keyof typeof SKILL_LABELS] ?? s).join(', ')
                : 'None'}
            </div>
          </div>
          <div className="card">
            <h3 className="section-header">Languages</h3>
            <div className="flex flex-wrap gap-1.5">
              {char.languages.length > 0
                ? char.languages.map(l => (
                    <span key={l} className="text-xs bg-parchment-100 text-parchment-700 border border-parchment-200 rounded-full px-2.5 py-0.5">{l}</span>
                  ))
                : <span className="text-sm text-parchment-400">None selected</span>}
            </div>
          </div>
        </div>
      )}

      <div className="mt-8">
        <div className="flex justify-between">
          <button className="btn-secondary" onClick={back} disabled={step === 0}>Back</button>
          {step < STEPS.length - 1 ? (
            <button className="btn-primary" onClick={next}>Next</button>
          ) : (
            <button className="btn-primary" onClick={finish}>Create Character</button>
          )}
        </div>
        {errors.length > 0 && (
          <div className="mt-3 p-3 bg-red-50 border border-red-300 rounded text-red-700 text-sm space-y-0.5">
            {errors.map(e => <div key={e}>⚠ {e}</div>)}
          </div>
        )}
      </div>
    </div>
  )
}

function PointBuyPanel({ scores, onChange }: { scores: AbilityScores; onChange: (s: AbilityScores) => void }) {
  const COST: Record<number, number> = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 }
  const budget = 27
  const total = ABILITIES.reduce((s, a) => s + (COST[scores[a]] ?? 0), 0)
  function set(ability: string, value: number) { onChange({ ...scores, [ability]: value } as AbilityScores) }
  return (
    <div>
      <div className="flex justify-between mb-4">
        <p className="text-sm text-parchment-500">Scores 8–15 before racial bonuses. 27 points total.</p>
        <span className={`font-bold text-sm ${total > budget ? 'text-red-600' : 'text-parchment-700'}`}>{total}/{budget} pts</span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {ABILITIES.map(ability => (
          <div key={ability}>
            <label className="label">{ABILITY_LABELS[ability]}</label>
            <div className="flex items-center gap-2">
              <button className="btn-secondary px-2 py-1" onClick={() => set(ability, Math.max(8, scores[ability] - 1))}>−</button>
              <span className="w-8 text-center font-bold">{scores[ability]}</span>
              <button className="btn-secondary px-2 py-1" onClick={() => {
                const next = Math.min(15, scores[ability] + 1)
                if (total - (COST[scores[ability]] ?? 0) + (COST[next] ?? 9) <= budget) set(ability, next)
              }}>+</button>
              <span className="text-xs text-parchment-400">{abilityMod(scores[ability]) >= 0 ? '+' : ''}{abilityMod(scores[ability])}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
