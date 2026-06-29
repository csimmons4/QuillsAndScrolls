import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useContent } from '../content/ContentProvider'
import { newCharacter, touchUpdated } from '../character/create'
import { saveCharacterToDisk } from '../storage/charApi'
import { Character, EquipmentItem, SKILLS, SKILL_LABELS, AbilityScores, ABILITIES } from '../character/model'
import { abilityMod } from '../character/derive'
import { v4 as uuidv4 } from 'uuid'
import { DRACONIC_ANCESTRIES, applyRaceAbilityBonuses, RaceCategory } from '../data/raceData'
import { CLASS_OPTIONS, INITIAL_SPELL_SLOTS } from '../data/classData'
import { STRIXHAVEN_COLLEGES } from '../data/strixhavenSpells'
import { CLASS_STARTING_GEAR } from '../data/startingGear'
import { FeatPicker } from '../components/FeatPicker'
import { FeatGrantsBlock } from '../components/FeatGrantsBlock'
import { InlinePicker } from '../components/InlinePicker'
import { resolveFeatGrants, applyGrantPicks, withFeatClassChoice } from '../character/grants'

const STEPS = ['Race', 'Class', 'Background', 'Abilities', 'Skills', 'Equipment', 'Details', 'Review']

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
    .filter(s => {
      if (s.length < 4) return false
      const lower = s.toLowerCase()
      return !BG_ITEM_SKIP.some(p => lower.startsWith(p))
    })
}

const LANGUAGES_STANDARD = ['Common', 'Dwarvish', 'Elvish', 'Giant', 'Gnomish', 'Goblin', 'Halfling', 'Orc']
const LANGUAGES_EXOTIC = ['Abyssal', 'Celestial', 'Draconic', 'Deep Speech', 'Infernal', 'Primordial', 'Sylvan', 'Undercommon']

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
  const wantsInstrument = lower.includes('musical instrument')
  const wantsArtisan = lower.includes('artisan')
  const wantsGaming = lower.includes('gaming set') || lower.includes('gaming')
  if (wantsArtisan) return ARTISAN_TOOLS
  if (wantsInstrument && wantsGaming) return [...MUSICAL_INSTRUMENTS, ...GAMING_SETS]
  if (wantsInstrument) return MUSICAL_INSTRUMENTS
  if (wantsGaming) return GAMING_SETS
  return [...ARTISAN_TOOLS, ...MUSICAL_INSTRUMENTS, ...GAMING_SETS]
}

const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8]
const ABILITY_LABELS: Record<string, string> = {
  str: 'Strength', dex: 'Dexterity', con: 'Constitution',
  int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma',
}

export default function Creator() {
  const navigate = useNavigate()
  const { races, classes, backgrounds, feats, spells, loading } = useContent()
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

  // Background tool-of-choice state
  const [bgToolChoiceLabel, setBgToolChoiceLabel] = useState('')
  const [bgToolChoice, setBgToolChoice] = useState('')

  // Class option state
  const [fightingStyle, setFightingStyle] = useState('')
  const [selectedCantrips, setSelectedCantrips] = useState<string[]>([])
  const [selectedL1Spells, setSelectedL1Spells] = useState<string[]>([])

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
      }
      if (char.raceSlug === 'half-elf' && halfElfAbilities.length < 2) errs.push('Choose 2 ability scores for +1 (Half-Elf).')
      if (char.raceSlug === 'dragonborn' && !dragonAncestry) errs.push('Choose a Draconic Ancestry.')
      const raceSkillDef = opts?.skillChoices
      if (raceSkillDef && raceSkillChoices.length < raceSkillDef.count) {
        errs.push(`Choose ${raceSkillDef.count} skill${raceSkillDef.count > 1 ? 's' : ''} from your race trait.`)
      }
    }
    if (step === 1 && char.classes.length === 0) errs.push('Select a class.')
    if (step === 2 && !char.backgroundSlug) errs.push('Select a background.')
    if (step === 6 && !char.name.trim()) errs.push('Enter a character name.')
    return errs
  }

  function next() {
    const errs = validate()
    if (errs.length) { setErrors(errs); return }
    setErrors([])
    setStep(s => s + 1)
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
    const baseScores = newCharacter().abilityScores

    let newScores = baseScores
    if (slug !== 'human' || !humanVariant) {
      newScores = applyRaceAbilityBonuses(baseScores, opts, undefined)
    }

    const autoSkills = opts?.grantedSkills ?? []
    const cleanLangs = opts?.grantedLanguages ?? opts?.languages ?? []
    update({
      raceSlug: slug,
      subraceSlug: undefined,
      abilityScores: newScores,
      languages: [...new Set(cleanLangs)],
      skillProficiencies: [...new Set([...char.skillProficiencies, ...autoSkills])],
    })
    setStandardAssigned({})
  }

  function selectSubrace(subraceSlug: string) {
    setSelectedSubrace(subraceSlug)
    // Check for high elf cantrip
    if (subraceSlug !== 'high-elf') setHighElfCantrip('')
    const baseScores = newCharacter().abilityScores
    const newScores = applyRaceAbilityBonuses(baseScores, races.find(r => r.slug === char.raceSlug), subraceSlug)
    update({ subraceSlug, abilityScores: newScores })
  }

  function selectClass(slug: string) {
    const cls = classes.find(c => c.slug === slug)
    if (!cls) return
    setFightingStyle('')
    setSelectedCantrips([])
    setSelectedL1Spells([])
    const initialSlots = INITIAL_SPELL_SLOTS[slug] ?? {}
    const secretLangs: string[] = slug === 'druid' ? ['Druidic'] : slug === 'rogue' ? ["Thieves' Cant"] : []
    update({
      classes: [{ classSlug: slug, level: 1, hitDieRolls: [cls.hitDie] }],
      saveProficiencies: cls.saveProficiencies,
      armorProficiencies: cls.armorProficiencies,
      weaponProficiencies: cls.weaponProficiencies,
      spellSlots: initialSlots,
      languages: [...new Set([...char.languages, ...secretLangs])],
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
    update({
      backgroundSlug: slug,
      skillProficiencies: [...new Set([...char.skillProficiencies, ...bg.skillProficiencies])],
      toolProficiencies: [...new Set([...char.toolProficiencies, ...concreteTools])],
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
    let finalChar = { ...char }

    // Apply race skill choices (Orc Primal Intuition, Kenku Training, etc.)
    if (raceSkillChoices.length > 0) {
      const skills = new Set(finalChar.skillProficiencies)
      raceSkillChoices.forEach(s => skills.add(s))
      finalChar.skillProficiencies = [...skills]
    }

    // Apply variant human choices
    if (char.raceSlug === 'human' && humanVariant) {
      const scores = { ...newCharacter().abilityScores } as Record<string, number>
      if (variantAbility1) scores[variantAbility1] = (scores[variantAbility1] ?? 10) + 1
      if (variantAbility2 && variantAbility2 !== variantAbility1) scores[variantAbility2] = (scores[variantAbility2] ?? 10) + 1
      finalChar.abilityScores = scores as AbilityScores
      const skills = new Set(finalChar.skillProficiencies)
      if (variantSkill) skills.add(variantSkill)
      finalChar.skillProficiencies = [...skills]
      if (variantFeat) {
        finalChar.featuresChosen = [...finalChar.featuresChosen, { key: 'feat-l1', value: variantFeat }]
      }
    }

    // Apply half-elf +1/+1 ability choices
    if (char.raceSlug === 'half-elf' && halfElfAbilities.length > 0) {
      const scores = { ...finalChar.abilityScores } as Record<string, number>
      halfElfAbilities.forEach(a => { scores[a] = Math.min(20, (scores[a] ?? 10) + 1) })
      finalChar.abilityScores = scores as AbilityScores
    }

    // Apply flex ability score choices (Changeling, Kobold = +1; Dhampir, Hexblood etc. = +2/+1)
    const chooseBonus = races.find(r => r.slug === char.raceSlug)?.chooseAbilityBonuses ?? 0
    if (chooseBonus >= 2 && flexAbility) {
      const scores = { ...finalChar.abilityScores } as Record<string, number>
      scores[flexAbility] = Math.min(20, (scores[flexAbility] ?? 10) + 2)
      if (flexAbility2 && flexAbility2 !== flexAbility) {
        scores[flexAbility2] = Math.min(20, (scores[flexAbility2] ?? 10) + 1)
      }
      finalChar.abilityScores = scores as AbilityScores
    } else if (chooseBonus === 1 && flexAbility) {
      const scores = { ...finalChar.abilityScores } as Record<string, number>
      scores[flexAbility] = Math.min(20, (scores[flexAbility] ?? 10) + 1)
      finalChar.abilityScores = scores as AbilityScores
    }

    // Record dragonborn ancestry
    if (dragonAncestry) {
      finalChar.featuresChosen = [...finalChar.featuresChosen, { key: 'dragonborn-ancestry', value: dragonAncestry }]
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
      return { spellSlug: slug, name: def?.name ?? slug, classSlug, prepared: false, isHomebrew: false }
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
      for (const item of gear.fixed) {
        toAdd.push(makeItem(item.name, item.slug, item.quantity ?? 1, item.notes ?? ''))
      }
      for (let gi = 0; gi < gear.choices.length; gi++) {
        const label = gearChoices[gi] ?? 'a'
        const opt = gear.choices[gi].options.find(o => o.label === label) ?? gear.choices[gi].options[0]
        if (opt) {
          for (const item of opt.items) {
            toAdd.push(makeItem(item.name, item.slug, item.quantity ?? 1, item.notes ?? ''))
          }
        }
      }
      const existingNames = new Set(finalChar.equipment.map(e => e.name))
      for (const item of toAdd) {
        if (!existingNames.has(item.name)) {
          finalChar.equipment = [...finalChar.equipment, item]
          existingNames.add(item.name)
        }
      }
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
      }
    }

    // HP: first level always max hit die
    const cls = classes.find(c => c.slug === classSlug)
    if (cls && finalChar.classes.length > 0) {
      finalChar.classes[0].hitDieRolls = [cls.hitDie]
      const conMod = Math.floor((finalChar.abilityScores.con - 10) / 2)
      finalChar.hp = { current: cls.hitDie + conMod, temp: 0 }
    }

    const final = touchUpdated(finalChar)
    await saveCharacterToDisk(final)
    navigate(`/c/${final.id}`)
  }

  if (loading) return <div className="text-center py-20 text-parchment-500">Loading content...</div>

  const raceOpts = races.find(r => r.slug === char.raceSlug)
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
          <div key={s} className={`flex-1 h-1.5 rounded-full ${i <= step ? 'bg-parchment-600' : 'bg-parchment-200'}`} />
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
                          }}
                          maxHeightClass="max-h-72"
                        />
                        {(() => {
                          const featDef = feats.find(f => f.slug === variantFeat)
                          if (!featDef) return null
                          return (
                            <FeatGrantsBlock
                              feat={featDef}
                              spells={spells}
                              classChoice={variantFeatClass}
                              setClassChoice={setVariantFeatClass}
                              picks={variantFeatGrants}
                              setPicks={setVariantFeatGrants}
                            />
                          )
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Race skill choices (Kenku Training, Orc Primal Intuition, etc.) */}
              {raceOpts?.skillChoices && (
                <div className="card border-parchment-400">
                  <h3 className="font-bold mb-1">
                    Race Skill Proficiencies — Choose {raceOpts.skillChoices.count}
                  </h3>
                  <p className="text-xs text-parchment-500 mb-3">{raceSkillChoices.length}/{raceOpts.skillChoices.count} selected</p>
                  <div className="grid grid-cols-2 gap-1">
                    {raceOpts.skillChoices.from.map(s => {
                      const selected = raceSkillChoices.includes(s)
                      const atMax = raceSkillChoices.length >= raceOpts.skillChoices!.count
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
                                : raceSkillChoices.length < raceOpts.skillChoices!.count
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

              {/* Fighting Style */}
              {classOpts?.fightingStyles && (
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
              {classOpts?.subclasses && (
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
              {bgToolOptions(bgToolChoiceLabel).map(t => <option key={t} value={t}>{t}</option>)}
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
                onClick={() => { setAbilityMethod(m); setStandardAssigned({}) }}
                className={`btn ${abilityMethod === m ? 'btn-primary' : 'btn-secondary'} text-sm`}
              >
                {m === 'standard' ? 'Standard Array' : m === 'pointbuy' ? 'Point Buy' : 'Manual'}
              </button>
            ))}
          </div>

          {/* Race bonus preview */}
          {char.raceSlug && (
            <div className="mb-4 p-3 bg-parchment-50 rounded border border-parchment-200 text-sm text-parchment-600">
              <strong>Race bonuses already applied:</strong>{' '}
              {Object.entries(char.abilityScores).map(([k, v]) => {
                const base = 10
                const diff = v - base
                return diff > 0 ? `+${diff} ${ABILITY_LABELS[k]}` : null
              }).filter(Boolean).join(', ') || 'none yet'}
            </div>
          )}

          {abilityMethod === 'standard' && (
            <div>
              <p className="text-sm text-parchment-500 mb-4">Assign 15, 14, 13, 12, 10, 8 to each ability (before racial bonuses).</p>
              <div className="grid grid-cols-3 gap-3">
                {ABILITIES.map(ability => {
                  const used = Object.values(standardAssigned)
                  return (
                    <div key={ability}>
                      <label className="label">{ABILITY_LABELS[ability]}</label>
                      <select
                        className="input"
                        value={standardAssigned[ability] ?? ''}
                        onChange={e => {
                          const val = parseInt(e.target.value, 10)
                          const newAssigned = { ...standardAssigned, [ability]: val }
                          setStandardAssigned(newAssigned)
                          const raceBonus = raceOpts?.abilityBonuses?.[ability] ?? 0
                          const subraceBonus = raceOpts?.subraces?.find(s => s.slug === selectedSubrace)?.abilityBonuses?.[ability] ?? 0
                          const scores = { ...char.abilityScores, [ability]: val + raceBonus + subraceBonus }
                          update({ abilityScores: scores as AbilityScores })
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
            <div className="grid grid-cols-3 gap-3">
              {ABILITIES.map(ability => (
                <div key={ability}>
                  <label className="label">{ABILITY_LABELS[ability]}</label>
                  <input
                    type="number" min={1} max={30} className="input"
                    value={char.abilityScores[ability]}
                    onChange={e => {
                      const scores = { ...char.abilityScores, [ability]: parseInt(e.target.value, 10) || 10 }
                      update({ abilityScores: scores as AbilityScores })
                    }}
                  />
                  <span className="text-xs text-parchment-400 ml-1">{abilityMod(char.abilityScores[ability]) >= 0 ? '+' : ''}{abilityMod(char.abilityScores[ability])}</span>
                </div>
              ))}
            </div>
          )}

          {abilityMethod === 'pointbuy' && (
            <PointBuyPanel scores={char.abilityScores} onChange={scores => update({ abilityScores: scores })} />
          )}
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
                <strong>Expertise:</strong> As a {currentClass?.name}, you also gain Expertise in {classOpts.expertiseCount} proficient skills (double PB). Mark them on your character sheet after creation.
              </div>
            )}
            <div className="grid grid-cols-3 gap-2">
              {SKILLS.map(skill => {
                const fromBg = bgSkills.has(skill)
                const fromRace = raceGrants.has(skill) || raceChoicesSet.has(skill)
                const isLocked = fromBg || fromRace
                const inClassList = !currentClass || currentClass.skillChoices.includes(skill)
                const checked = char.skillProficiencies.includes(skill)
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
              if (bgLangCount === 0) return null
              return (
                <p className="text-xs text-parchment-500 mb-2 p-2 bg-parchment-50 rounded border border-parchment-200">
                  Your background grants {bgLangCount} language choice{bgLangCount > 1 ? 's' : ''} — pick {bgLangCount > 1 ? 'them' : 'one'} below.
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
