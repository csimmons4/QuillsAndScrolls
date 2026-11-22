import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { Character, ABILITIES, type Summon } from '../../character/model'
import type { Beast } from '../../data/wildShapeBeasts'
import { listCharactersFromDisk, saveCharacterToDisk } from '../../storage/charApi'
import { useContent } from '../../content/ContentProvider'
import { profBonus, skillMod, hpMax, totalLevel, passivePerception, spellAttackBonus, spellSaveDC, abilityModFor, formatMod, deriveClassResources, featureKey, resourceMatchesFeature, hasBardJackOfAllTrades, monkSpeedBonus, sneakAttackDice, paladinAuraBonus, initiativeBonus, spellcastingAbilityFor, type ClassResource } from '../../character/derive'
import { touchUpdated } from '../../character/create'
import { CLASS_OPTIONS, LAND_CIRCLE_SPELLS, isMulticlassSpellcaster, multiclassSpellSlotsMax } from '../../data/classData'
import { sumFeatBonuses } from '../../character/featBonuses'
import { featSlugsOf, itemBonusesOf, effectiveCharOf, skillCharOf } from '../../character/vitals'
import type { Coin } from '../../character/currency'
import { useRecentCharacter } from '../../storage/recentCharacter'
import { useConfirm } from '../../components/ConfirmDialog'
import { featArmorKinds } from '../../character/proficiencies'
import { runningPotions, sumPotionEffects } from '../../character/potionEffects'
import type { ArmorStats } from '../../content/loaders'
import { ABILITY_LABELS, Tab, artificerLevelOf, computeFullAC, deriveResistances, deriveSkillSources, missingProficiencies, resolveArmor, resolveWeapon, magicBonus, isWeaponProficient, fightingStyles, weaponAttackBonus, weaponDamageMod, isMonkWeapon } from './helpers'
import { DRACONIC_ANCESTRIES } from '../../data/raceData'
import { NumberInput } from '../../components/NumberInput'

/** Everything the character sheet works from: its state, what follows from the character (AC,
 *  resources, spells…) and the actions that change it. The tabs read it through `useSheet()`. */
export function useSheetModel() {
  const { id } = useParams<{ id: string }>()
  const content = useContent()
  const [char, setChar] = useState<Character | null>(null)
  const [loadError, setLoadError] = useState('')
  const [tab, setTab] = useState<Tab>('stats')
  const [spellFilter, setSpellFilter] = useState('')
  const [itemFilter, setItemFilter] = useState('')
  const [addItemSlug, setAddItemSlug] = useState('')
  const [addSpellSlug, setAddSpellSlug] = useState('')
  const [addWeaponSlug, setAddWeaponSlug] = useState('')
  const [addArmorSlug, setAddArmorSlug] = useState('')
  const [addPanel, setAddPanel] = useState<string | null>(null)
  const [addPanelSearch, setAddPanelSearch] = useState('')
  const [ritualSearch, setRitualSearch] = useState('')
  const [spellBrowserSearch, setSpellBrowserSearch] = useState('')
  const [spellBrowserLevel, setSpellBrowserLevel] = useState<number | null>(null)
  const [browserSelectedSpell, setBrowserSelectedSpell] = useState<string | null>(null)
  const [showSpellLibrary, setShowSpellLibrary] = useState(false)
  // Brief highlight of the slot level a spell was just cast at (slug + slot level).
  const [castHighlight, setCastHighlight] = useState<{ slug: string; level: number } | null>(null)
  // The spell open in the Spells tab's side panel ('entry:<slug>' or 'free:<key>')
  const [selectedSpellKey, setSelectedSpellKey] = useState<string | null>(null)
  const [expandedInventoryItem, setExpandedInventoryItem] = useState<number | null>(null)
  const [inventorySearch, setInventorySearch] = useState('')
  const [saveFlash, setSaveFlash] = useState<'idle' | 'saved'>('idle')
  // A save that didn't reach the server (the app was closed, say): the sheet says so and keeps trying
  const [saveFailed, setSaveFailed] = useState(false)
  const persist = useCallback((c: Character, opts?: { keepalive?: boolean }) =>
    saveCharacterToDisk(c, opts).then(() => { setSaveFailed(false); return true }, () => { setSaveFailed(true); return false }), [])
  const [journeyOpen, setJourneyOpen] = useState(true)
  // Feature descriptions show one line until clicked; "Show all text" flips the default for every card
  const [openFeatures, setOpenFeatures] = useState<Set<string>>(new Set())
  const [allFeaturesOpen, setAllFeaturesOpen] = useState(false)
  const [damageInput, setDamageInput] = useState('')
  const [txAmount, setTxAmount] = useState('')
  const [txCoin, setTxCoin] = useState<Coin>('gp')
  const [txNote, setTxNote] = useState('')
  // "+25 gp" / "−30 sp" labels floating up from the purse balance
  const [purseFloats, setPurseFloats] = useState<{ id: number; text: string; kind: 'gain' | 'spend' }[]>([])
  // Purse ledger open/closed — remembered in this browser (localStorage, a UI convenience)
  const [ledgerOpen, setLedgerOpenState] = useState(() => {
    try { return localStorage.getItem('qs:ledgerOpen') !== 'false' } catch { return true }
  })
  const setLedgerOpen = (open: boolean) => {
    setLedgerOpenState(open)
    try { localStorage.setItem('qs:ledgerOpen', String(open)) } catch { /* storage unavailable */ }
  }
  // Marks where the tab bar sits before it pins to the top of the window
  const tabsAnchor = useRef<HTMLDivElement>(null)
  const [healInput, setHealInput] = useState('')
  const [shortRestOpen, setShortRestOpen] = useState(false)
  const [shortRestDice, setShortRestDice] = useState<Record<string, number>>({})
  const [shortRestRolls, setShortRestRolls] = useState<Record<string, string>>({})
  // Short rest extras: slots picked for Arcane / Natural Recovery (level → count), a Song of Rest roll
  const [recoverSlots, setRecoverSlots] = useState<Record<string, number>>({})
  const [songOfRestRoll, setSongOfRestRoll] = useState('')
  const [longRestOpen, setLongRestOpen] = useState(false)
  const { askConfirm, confirmDialog } = useConfirm()
  // All Proficiencies card: edit mode and the "Other…" boxes
  const [profEditing, setProfEditing] = useState(false)
  const [newToolText, setNewToolText] = useState('')
  const [newLangText, setNewLangText] = useState('')
  // Resistant Armor: the damage type picked before choosing the item to infuse
  const [infuseResistType, setInfuseResistType] = useState('fire')
  // Resource pips that just changed (pips from..to-1 of one resource) play the spend/restore animation
  const [pipFx, setPipFx] = useState<{ key: string; from: number; to: number; kind: 'spend' | 'restore' } | null>(null)
  // Concentration save owed after taking damage; the player rolls and reports the result
  const [concCheck, setConcCheck] = useState<{ spellName: string; dc: number; damage: number } | null>(null)
  const [activeSummonId, setActiveSummonId] = useState<string | null>(null)
  const [newSummonForm, setNewSummonForm] = useState<{ name: string; hp: string; ac: string } | null>(null)
  const [addFeatOpen, setAddFeatOpen] = useState(false)
  const [addFeatSearch, setAddFeatSearch] = useState('')
  const [spellTabClass, setSpellTabClass] = useState<string | null>(null)  // multiclass casters: class shown on Spells tab
  const [addFeatPending, setAddFeatPending] = useState<string | null>(null)  // half-feat awaiting its +1 pick
  const [addFeatAbility, setAddFeatAbility] = useState('')
  const [addFeatApplyAsi, setAddFeatApplyAsi] = useState(true)
  // Spells a feat lets you choose (Fey Touched, Magic Initiate, …)
  const [addFeatClass, setAddFeatClass] = useState('')
  const [addFeatGrants, setAddFeatGrants] = useState<Record<string, string[]>>({})
  const [newResourceName, setNewResourceName] = useState('')
  const [newResourceMax, setNewResourceMax] = useState('')
  const [newResourceRecharge, setNewResourceRecharge] = useState<'short' | 'long'>('long')
  const [addResourceOpen, setAddResourceOpen] = useState(false)
  // Healing potion being drunk (inventory index) + the HP the player rolled for it
  const [drinkingIdx, setDrinkingIdx] = useState<number | null>(null)
  const [drinkRoll, setDrinkRoll] = useState('')
  const [drinkChoice, setDrinkChoice] = useState('')         // Resistance damage type / weapon to coat
  const [drinkFailedSave, setDrinkFailedSave] = useState(false)  // Potion of Poison
  const saveFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const charRef = useRef<Character | null>(null)

  useEffect(() => {
    if (!id) return
    listCharactersFromDisk()
      .then(({ characters: chars }) => {
        let found = chars.find(c => c.id === id)
        // Characters made before skill/score/save tracking existed: their current values become the baseline
        if (found && (!found.skillBaseline || !found.abilityBaseline || !found.saveBaseline)) {
          found = {
            ...found,
            skillBaseline: found.skillBaseline ?? { proficiencies: [...found.skillProficiencies], expertise: [...found.skillExpertise] },
            abilityBaseline: found.abilityBaseline ?? { ...found.abilityScores },
            saveBaseline: found.saveBaseline ?? [...found.saveProficiencies],
          }
          saveCharacterToDisk(found).catch(err => console.warn('Saving baselines failed:', err))
        }
        if (found) { setChar(found); charRef.current = found }
        else setLoadError('Character not found — it may have been deleted.')
      })
      .catch(() => setLoadError('Could not reach the character server. Make sure you started the app with "npm run dev" or the launch script.'))
  }, [id])

  const diskSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const save = useCallback((next: Character) => {
    let updated = touchUpdated(next)
    // Auto-reset death saves when healed from 0
    const prevHp = charRef.current?.hp.current ?? 0
    if (prevHp <= 0 && updated.hp.current > 0) {
      updated = { ...updated, deathSaves: { successes: 0, failures: 0 } }
    }
    // Auto-drop concentration when knocked to 0 HP (RAW)
    if (updated.hp.current === 0 && updated.concentratingOn) {
      updated = { ...updated, concentratingOn: undefined }
    }
    setChar(updated)
    charRef.current = updated
    if (diskSaveTimer.current) clearTimeout(diskSaveTimer.current)
    diskSaveTimer.current = setTimeout(() => {
      diskSaveTimer.current = null  // nothing waiting to be saved
      persist(updated)
    }, 800)
  }, [persist])

  // While saving fails, try again every few seconds: restarting the app brings the changes in
  useEffect(() => {
    if (!saveFailed) return
    const timer = setInterval(() => { if (charRef.current && !diskSaveTimer.current) persist(charRef.current) }, 5000)
    return () => clearInterval(timer)
  }, [saveFailed, persist])
  const retrySave = () => { if (charRef.current) persist(charRef.current) }

  // Escape closes the rest and Add Feat windows, like their Cancel buttons (a confirmation on top
  // takes the Escape itself)
  useEffect(() => {
    if (!shortRestOpen && !longRestOpen && !addFeatOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || document.querySelector('[role="alertdialog"]')) return
      setShortRestOpen(false); setShortRestDice({}); setShortRestRolls({}); setRecoverSlots({}); setSongOfRestRoll('')
      setLongRestOpen(false)
      setAddFeatOpen(false); setAddFeatPending(null); setAddFeatAbility('')
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [shortRestOpen, longRestOpen, addFeatOpen])

  // Leaving or closing the tab during the 800 ms wait: save at once, so the last change isn't lost.
  // The same when the sheet closes for another page (Level Up, the Vault…): that page loads the
  // character straight away, and a save landing after it would be undone by the page's own save.
  useEffect(() => {
    const flush = () => {
      if (!diskSaveTimer.current || !charRef.current) return
      clearTimeout(diskSaveTimer.current)
      diskSaveTimer.current = null
      persist(charRef.current, { keepalive: true })
    }
    const onHide = () => { if (document.visibilityState === 'hidden') flush() }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onHide)
      flush()
    }
  }, [])

  // Another tab (or an outside edit) may have saved this character since this tab loaded it. When the
  // tab comes back into view, pick up the newer copy rather than later saving the stale one over it.
  useEffect(() => {
    if (!id) return
    const refresh = () => {
      if (document.visibilityState !== 'visible' || diskSaveTimer.current) return  // own edits still unsaved
      listCharactersFromDisk()
        .then(({ characters }) => {
          const disk = characters.find(c => c.id === id)
          const mine = charRef.current
          if (disk && mine && !diskSaveTimer.current && disk.updatedAt > mine.updatedAt) {
            setChar(disk)
            charRef.current = disk
          }
        })
        .catch(() => {})
    }
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('focus', refresh)
    return () => {
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('focus', refresh)
    }
  }, [id])

  function saveToFile() {
    if (!charRef.current) return
    persist(charRef.current).then(ok => {
      if (!ok) return
      setSaveFlash('saved')
      if (saveFlashTimer.current) clearTimeout(saveFlashTimer.current)
      saveFlashTimer.current = setTimeout(() => setSaveFlash('idle'), 2500)
    })
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        saveToFile()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    charRef.current = char
  }, [char])

  // Remember this sheet so the nav bar can offer "← <name>" from other pages
  const { setRecent } = useRecentCharacter()
  useEffect(() => {
    if (char) setRecent({ id: char.id, name: char.name })
  }, [char?.id, char?.name, setRecent])

  // At 0 HP the death screen takes over the whole window — freeze the page underneath
  const dying = !!char && char.hp.current <= 0
  useEffect(() => {
    if (!dying) return
    const root = document.documentElement
    const prev = { overflow: root.style.overflow, gutter: root.style.scrollbarGutter }
    root.style.overflow = 'hidden'
    root.style.scrollbarGutter = 'auto'
    return () => { root.style.overflow = prev.overflow; root.style.scrollbarGutter = prev.gutter }
  }, [dying])

  // Older characters: fill in missing proficiencies/languages once, when the sheet first opens
  const backfilledId = useRef<string | null>(null)
  useEffect(() => {
    if (!char || content.loading || backfilledId.current === char.id) return
    backfilledId.current = char.id
    const updates = missingProficiencies(char, content)
    if (updates) save({ ...char, ...updates })
  }, [char, content, save])

  // Quick find (⌘K / Ctrl+K): jump to any spell, item, feature, feat or tab
  const [findOpen, setFindOpen] = useState(false)
  const [findQuery, setFindQuery] = useState('')
  const [findIndex, setFindIndex] = useState(0)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setFindQuery(''); setFindIndex(0); setFindOpen(o => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Fight effects that last a minute: raging (barbarian) and being Blessed by an ally, plus spells someone
  // (maybe you) cast on you that change AC or speed. They aren't saved with the character and end on a
  // rest; the tab's sessionStorage keeps them through a page refresh (per character, `qs:fight:<id>`).
  type SpellOnYou = 'mage-armor' | 'shield' | 'shield-of-faith' | 'haste' | 'barkskin'
  type FightEffects = { raging?: boolean; blessed?: boolean; spellsOnYou?: SpellOnYou[] }
  const readFight = (charId: string | undefined): FightEffects => {
    try { return JSON.parse(sessionStorage.getItem(`qs:fight:${charId}`) ?? '{}') } catch { return {} }
  }
  const [fightFor, setFightFor] = useState(id)     // the character the effects below belong to
  const [raging, setRaging] = useState(() => !!readFight(id).raging)
  const [blessed, setBlessed] = useState(() => !!readFight(id).blessed)
  const [spellsOnYou, setSpellsOnYou] = useState<Set<SpellOnYou>>(() => new Set(readFight(id).spellsOnYou ?? []))
  const toggleSpellOnYou = (key: SpellOnYou) => setSpellsOnYou(prev => {
    const next = new Set(prev)
    if (next.has(key)) next.delete(key); else next.add(key)
    return next
  })
  // Another character opened on the same sheet: switch to its effects
  useEffect(() => {
    if (fightFor === id) return
    const f = readFight(id)
    setFightFor(id); setRaging(!!f.raging); setBlessed(!!f.blessed); setSpellsOnYou(new Set(f.spellsOnYou ?? []))
  }, [id, fightFor])
  useEffect(() => {
    if (fightFor !== id) return   // mid-switch: these values are still the previous character's
    try {
      if (raging || blessed || spellsOnYou.size) sessionStorage.setItem(`qs:fight:${id}`, JSON.stringify({ raging, blessed, spellsOnYou: [...spellsOnYou] }))
      else sessionStorage.removeItem(`qs:fight:${id}`)
    } catch { /* storage unavailable: the effects just won't survive a refresh */ }
  }, [id, fightFor, raging, blessed, spellsOnYou])

  // Whether the tab bar is pinned to the top of the window (scrolled past its place); the status strip shows then
  const [tabsPinned, setTabsPinned] = useState(false)
  useEffect(() => {
    const onScroll = () => setTabsPinned((tabsAnchor.current?.getBoundingClientRect().top ?? 1) < 0)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // A few seconds to take back a slip (a removed spell, a deleted item, a rest taken by mistake): the
  // character as it was just before
  const [undo, setUndo] = useState<{ message: string; before: Character; id: number } | null>(null)
  useEffect(() => {
    if (!undo) return
    const t = window.setTimeout(() => setUndo(null), 7000)
    return () => window.clearTimeout(t)
  }, [undo])
  /** Call just before a change the player might regret; a toast offers to put the character back */
  const offerUndo = (message: string) => {
    if (charRef.current) setUndo({ message, before: charRef.current, id: Date.now() })
  }

  function patch(updates: Partial<Character>) {
    if (!char) return
    save({ ...char, ...updates })
  }

  if (!char) return { ready: false as const, loadError }

  const level = totalLevel(char)
  const pb = profBonus(char)

  // Collect all feat slugs and derive passive bonuses
  const featSlugs = featSlugsOf(char)
  const featBonuses = sumFeatBonuses(featSlugs, content.feats)
  // Armor proficiency from feats (Heavily Armored, …): counted without being stored
  const featArmor = featArmorKinds(featSlugs, content)
  const artificerLevel = artificerLevelOf(char)
  // Items' bonuses, with an attuned Enhanced Arcane Focus and Resistant Armor (character/vitals.ts)
  const itemBonuses = itemBonusesOf(char, content)

  // Active potions still running (not out of rounds or uses), and everything they change
  const running = runningPotions(char, content.items)
  // Rage and Bless feed the same effects as potions: advantage, resistances and extra dice
  const barbarianLevel = char.classes.find(c => c.classSlug === 'barbarian')?.level ?? 0
  const rageDamage = barbarianLevel >= 16 ? 4 : barbarianLevel >= 9 ? 3 : 2
  const potionFx = (() => {
    const fx = sumPotionEffects(running)
    if (raging && barbarianLevel > 0) {
      fx.saveAdvantage.add('str')
      fx.checkAdvantage.add('str')
      // Totem Warrior (Bear): resistance to every damage type but psychic
      const bear = char.featuresChosen.some(fc => fc.key === 'totem-spirit' && fc.value === 'bear')
      const resist = bear
        ? ['acid', 'bludgeoning', 'cold', 'fire', 'force', 'lightning', 'necrotic', 'piercing', 'poison', 'radiant', 'slashing', 'thunder']
        : ['bludgeoning', 'piercing', 'slashing']
      for (const r of resist) if (!fx.resistances.includes(r)) fx.resistances.push(r)
    }
    if (blessed && !fx.rollBonusDice.includes('1d4')) fx.rollBonusDice.push('1d4')
    if (spellsOnYou.has('haste')) {
      fx.speedMultiplier = Math.max(fx.speedMultiplier, 2)
      fx.saveAdvantage.add('dex')
    }
    return fx
  })()
  // Concentration spells that add damage to your hits while they last (against the target they name)
  const CONCENTRATION_RIDERS: Record<string, { dice: string; label: string; weaponOnly?: boolean }> = {
    'hex': { dice: '1d6 necrotic', label: 'Hex' },
    'hunters-mark': { dice: '1d6', label: "Hunter's Mark", weaponOnly: true },
    'divine-favor': { dice: '1d4 radiant', label: 'Divine Favor', weaponOnly: true },
    'spirit-shroud': { dice: '1d8', label: 'Spirit Shroud' },
  }
  const concRider = char.concentratingOn ? CONCENTRATION_RIDERS[char.concentratingOn] : undefined
  const potionScoreOverrides = potionFx.abilityOverrides
  // Potion effects on a weapon's numbers, shared by the attacks table and the inventory cards:
  // Oil of Sharpness (+N to hit and damage on the coated weapon), Bless dice on attack rolls,
  // Enlarge/Reduce dice on damage
  const potionWeaponMods = (itemName: string) => ({
    bonus: potionFx.weaponBonus.get(itemName) ?? 0,
    attackDice: potionFx.rollBonusDice.map(d => ` ${d}`).join(''),
    damageDice: potionFx.weaponDamageDice.map(d => ` ${d}`).join(''),
  })

  // Apply ability score overrides/bonuses from equipped items and active potions (Giant Strength)
  const effectiveChar = effectiveCharOf(char, itemBonuses, potionScoreOverrides)

  const raceDef = content.races.find(r => r.slug === char.raceSlug)

  // effectiveCharSkills: merge ALL auto-granted skill profs/expertise so mods are always correct
  const effectiveCharSkills = skillCharOf(char, effectiveChar, content, featSlugs, itemBonuses)

  // Collect all free spells from feats + race/subrace
  // Single source of truth for granted/innate spells (feats, race, subclass) — rendered once.
  const freeSpells: Array<{ key: string; slug: string; name: string; level: number; source: string; usesPerLongRest?: number; alwaysPrepared?: boolean; castLevel?: number }> = []
  for (const slug of featSlugs) {
    const e = content.feats.find(f => f.slug === slug)
    if (!e) continue
    const featName = e.name
    for (const s of [...(e.grantedCantrips ?? []), ...(e.grantedSpells ?? [])]) {
      freeSpells.push({ key: `feat:${slug}:${s.slug}`, slug: s.slug, name: s.name, level: s.level, source: featName, usesPerLongRest: s.usesPerLongRest })
    }
  }
  const subraceOpts = raceDef?.subraces?.find(s => s.slug === char.subraceSlug)
  for (const s of [...(raceDef?.grantedSpells ?? []), ...(subraceOpts?.grantedSpells ?? [])]) {
    if ((s.minLevel ?? 1) > totalLevel(char)) continue
    freeSpells.push({ key: `race:${char.raceSlug}:${char.subraceSlug ?? ''}:${s.slug}`, slug: s.slug, name: s.name, level: s.level, source: raceDef?.name ?? char.raceSlug, usesPerLongRest: s.usesPerLongRest, castLevel: s.castLevel })
  }
  // Subclass-granted "always prepared" spells (domain/oath/circle/patron), gated by class level.
  for (const cc of char.classes) {
    if (!cc.subclassSlug) continue
    const sub = CLASS_OPTIONS[cc.classSlug]?.subclasses.find(s => s.slug === cc.subclassSlug)
    if (!sub?.grantedSpells) continue
    for (const s of sub.grantedSpells) {
      if (s.grantedAtLevel > cc.level) continue
      freeSpells.push({ key: `subclass:${cc.classSlug}:${cc.subclassSlug}:${s.slug}`, slug: s.slug, name: s.name, level: s.level, source: sub.name, alwaysPrepared: true })
    }
  }

  // Circle of the Land terrain-based always-prepared spells
  const landDruid = char.classes.find(c => c.classSlug === 'druid' && c.subclassSlug === 'land')
  if (landDruid) {
    const terrainFC = char.featuresChosen.find(f => f.key === 'land-terrain')
    const terrain = typeof terrainFC?.value === 'string' ? terrainFC.value.toLowerCase() : ''
    for (const s of LAND_CIRCLE_SPELLS[terrain] ?? []) {
      if (s.grantedAtLevel > landDruid.level) continue
      freeSpells.push({ key: `subclass:druid:land:${s.slug}`, slug: s.slug, name: s.name, level: s.level, source: 'Circle of the Land', alwaysPrepared: true })
    }
  }

  const baseMaxHp = hpMax(effectiveChar, content) + featBonuses.hpBonusPerLevel * level
  const maxHp = baseMaxHp * potionFx.hpMultiplier  // Giant Size doubles it

  // Conditions a potion added come off when it ends (unless something else still gives them)
  const conditionsWithout = (ending: typeof char.activePotions) => {
    const keep = new Set(char.activePotions.filter(p => !ending.includes(p)).flatMap(p => p.addedConditions ?? []))
    const drop = new Set(ending.flatMap(p => p.addedConditions ?? []).filter(c => !keep.has(c)))
    return char.conditions.filter(c => !drop.has(c))
  }

  // End an active potion. Giant Size: HP above the restored maximum become temporary HP.
  const endPotion = (id: string) => {
    const ending = char.activePotions.filter(p => p.id === id)
    const m = running.find(r => r.active.id === id)?.def?.hpMaxMultiplier
    let hp = char.hp
    if (m) {
      const newMax = Math.round(maxHp / m)
      if (hp.current > newMax) hp = { ...hp, current: newMax, temp: Math.max(hp.temp, hp.current - newMax) }
    }
    patch({ activePotions: char.activePotions.filter(p => p.id !== id), hp, conditions: conditionsWithout(ending) })
  }

  // Potions that run out during a rest of `restMinutes` (60 short, 480 long)
  const potionsAfterRest = (restMinutes: number) => {
    const ending = char.activePotions.filter(p => p.minutes <= restMinutes)
    return { activePotions: char.activePotions.filter(p => p.minutes > restMinutes), conditions: conditionsWithout(ending) }
  }

  const mediumDexCap = featSlugs.includes('medium-armor-master') ? 3 : 2
  // Wild Shape: the beast form (kept as a summon) brings its own AC and speed, and takes damage and healing first
  const wildShapeForm = char.summons.find(s => s.templateKey === 'wild-shape')
  const { ac: armorAc, source: armorAcSource, stealthDisadv: armorStealthDisadv } = computeFullAC(effectiveChar, featBonuses.naturalArmorBase, content.items, raceDef, itemBonuses.acBonus, mediumDexCap, spellsOnYou.has('mage-armor'))
  const spellAc = (spellsOnYou.has('shield') ? 5 : 0) + (spellsOnYou.has('shield-of-faith') ? 2 : 0) + (spellsOnYou.has('haste') ? 2 : 0)
  const acBeforeBarkskin = (wildShapeForm ? wildShapeForm.ac : armorAc) + potionFx.acBonus + spellAc  // potion of Speed (Haste) +2
  // Barkskin: AC can't be less than 16
  const ac = spellsOnYou.has('barkskin') ? Math.max(16, acBeforeBarkskin) : acBeforeBarkskin
  const stealthDisadv = !wildShapeForm && armorStealthDisadv
  const acSource = (wildShapeForm ? `${wildShapeForm.name} (Wild Shape)` : armorAcSource)
    + (potionFx.acBonus ? ` +${potionFx.acBonus} potion` : '')
    + (spellsOnYou.has('shield') ? ' + Shield spell' : '')
    + (spellsOnYou.has('shield-of-faith') ? ' + Shield of Faith' : '')
    + (spellsOnYou.has('haste') ? ' + Haste' : '')
    + (spellsOnYou.has('barkskin') && acBeforeBarkskin < 16 ? ' (Barkskin: 16)' : '')
  const initiative = initiativeBonus(effectiveChar) + featBonuses.initiativeBonus + itemBonuses.abilityCheckBonus
  const passive = passivePerception(effectiveCharSkills) + featBonuses.passivePerceptionBonus + itemBonuses.abilityCheckBonus
  const passiveInvestigation = 10 + skillMod(effectiveCharSkills, 'investigation') + featBonuses.passiveInvestigationBonus + itemBonuses.abilityCheckBonus
  const passiveInsight = 10 + skillMod(effectiveCharSkills, 'insight') + itemBonuses.abilityCheckBonus
  const raceSpeed = subraceOpts?.speed ?? raceDef?.speed ?? 30
  // Armor worn affects movement features: Monk needs no armor or shield, Barbarian no heavy armor
  const wornArmor = char.equipment.filter(e => e.equipped).map(e => resolveArmor(e, content.items)).filter((a): a is ArmorStats => !!a)
  const bodyArmorType = wornArmor.find(a => a.type !== 'shield')?.type
  const shieldWorn = wornArmor.some(a => a.type === 'shield')
  const monkMovement = !bodyArmorType && !shieldWorn ? monkSpeedBonus(char) : 0
  const fastMovement = char.classes.some(c => c.classSlug === 'barbarian' && c.level >= 5) && bodyArmorType !== 'heavy' ? 10 : 0
  const walkSpeed = raceSpeed + featBonuses.speedBonus + monkMovement + fastMovement
  const speed = (wildShapeForm ? wildShapeForm.speed : walkSpeed) * potionFx.speedMultiplier  // Speed (Haste) doubles it
  // Fly/swim/climb speeds from potions ("equal to your walking speed" uses the current speed)
  const potionSpeedNotes = potionFx.extraSpeeds.map(s =>
    `${s.mode[0].toUpperCase()}${s.mode.slice(1)} ${s.feet ?? speed}ft${s.hover ? ' (hover)' : ''}`)
  const sneakDice = sneakAttackDice(char)
  const paladinAura = paladinAuraBonus(char)

  const attuned = char.equipment.filter(e => e.attuned).length
  const skillInfo = deriveSkillSources(char, content, raceDef, CLASS_OPTIONS, featSlugs)

  // Skill changes made by hand on the sheet, compared with creation/level-up (skillBaseline)
  const skillBaseProf = new Set(char.skillBaseline?.proficiencies ?? char.skillProficiencies)
  const skillBaseExpert = new Set(char.skillBaseline?.expertise ?? char.skillExpertise)
  const skillChanged = (skill: string) =>
    skillBaseProf.has(skill) !== char.skillProficiencies.includes(skill) ||
    skillBaseExpert.has(skill) !== char.skillExpertise.includes(skill)
  const resetSkill = (skill: string) => {
    const restore = (current: string[], base: Set<string>) =>
      base.has(skill) ? [...new Set([...current, skill])] : current.filter(s => s !== skill)
    patch({
      skillProficiencies: restore(char.skillProficiencies, skillBaseProf),
      skillExpertise: restore(char.skillExpertise, skillBaseExpert),
    })
  }
  const resetAllSkills = async () => {
    if (!(await askConfirm({ title: 'Reset Skills', message: 'Put every hand-changed skill back to what creation and level-ups gave you?', confirmLabel: 'Reset' }))) return
    patch({ skillProficiencies: [...skillBaseProf], skillExpertise: [...skillBaseExpert] })
  }
  // Ability scores and saving throws changed by hand, compared with abilityBaseline / saveBaseline
  const abilityBase = char.abilityBaseline ?? char.abilityScores
  const abilitiesChanged = ABILITIES.filter(a => char.abilityScores[a] !== abilityBase[a])
  const resetAllAbilities = async () => {
    const list = abilitiesChanged.map(a => `${ABILITY_LABELS[a]} ${char.abilityScores[a]} → ${abilityBase[a]}`).join(', ')
    if (!(await askConfirm({ title: 'Reset Ability Scores', message: `Put hand-changed scores back to what creation and level-ups gave you? (${list})`, confirmLabel: 'Reset' }))) return
    patch({ abilityScores: { ...abilityBase } })
  }
  const saveBase = new Set(char.saveBaseline ?? char.saveProficiencies)
  const savesChanged = ABILITIES.filter(a => saveBase.has(a) !== char.saveProficiencies.includes(a))
  const resetSave = (a: string) => {
    const s = new Set(char.saveProficiencies)
    saveBase.has(a) ? s.add(a) : s.delete(a)
    patch({ saveProficiencies: [...s] })
  }
  const resetAllSaves = async () => {
    if (!(await askConfirm({ title: 'Reset Saving Throws', message: 'Put hand-changed saving throw proficiencies back to what your class and feats gave you?', confirmLabel: 'Reset' }))) return
    patch({ saveProficiencies: [...saveBase] })
  }
  const classResources = deriveClassResources(char)

  /** A resource's uses: gems for small counts, a gauge for big pools (Ki, Lay on Hands). The same
   *  tracker shows on the Resources card and on the class feature it belongs to. */
  const resourceTracker = (r: ClassResource, compact = false) => {
    const isPool = (r.max ?? 0) > 6  // large pools get a number input
    const current = r.current
    const max = r.max
    return (
      <>
      {isPool ? (
        // Filled gauge + controls for large pools (Ki, Sorcery Points, Lay on Hands)
        (() => {
          const cap = max ?? 9999
          const pct = cap > 0 ? Math.min(100, Math.round((current / cap) * 100)) : 0
          const setVal = (v: number) =>
            patch({ classResources: { ...char.classResources, [r.key]: Math.max(0, Math.min(cap, v)) } })
          // One line for the Resources strip: a short gauge beside the count
          if (compact) return (
            <div className="flex items-center gap-1">
              <div
                className="res-pool-track relative h-2.5 w-20 rounded-full overflow-hidden cursor-pointer"
                title="Click to set remaining"
                onClick={e => {
                  const rect = e.currentTarget.getBoundingClientRect()
                  setVal(Math.round(((e.clientX - rect.left) / rect.width) * cap))
                }}
              >
                <div className="res-pool-fill absolute inset-y-0 left-0 rounded-full transition-all duration-200" style={{ width: `${pct}%` }} />
              </div>
              <button className="btn-ghost px-1 py-0 text-sm" onClick={() => setVal(current - 1)} aria-label={`Spend 1 ${r.name}`}>−</button>
              <NumberInput
                min={0} max={max ?? 9999} aria-label={`${r.name} remaining`}
                className="w-11 text-center text-sm font-bold bg-transparent border border-parchment-300 rounded py-0"
                value={current}
                onValue={setVal}
              />
              <span className="text-xs text-parchment-400">/ {max ?? '∞'}</span>
              <button className="btn-ghost px-1 py-0 text-sm" onClick={() => setVal(current + 1)} aria-label={`Restore 1 ${r.name}`}>+</button>
            </div>
          )
          return (
            <div>
              <div
                className="res-pool-track relative h-4 rounded-full overflow-hidden cursor-pointer"
                title="Click to set remaining"
                onClick={e => {
                  const rect = e.currentTarget.getBoundingClientRect()
                  setVal(Math.round(((e.clientX - rect.left) / rect.width) * cap))
                }}
              >
                <div
                  className="res-pool-fill absolute inset-y-0 left-0 rounded-full transition-all duration-200"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="flex items-center gap-1 mt-1">
                <button className="btn-ghost px-1 text-sm" onClick={() => setVal(current - 1)}>−</button>
                <NumberInput
                  min={0} max={max ?? 9999} aria-label={`${r.name} remaining`}
                  className="w-12 text-center text-sm font-bold bg-transparent border border-parchment-300 rounded py-0.5"
                  value={current}
                  onValue={setVal}
                />
                <span className="text-xs text-parchment-400">/ {max ?? '∞'}</span>
                <button className="btn-ghost px-1 text-sm" onClick={() => setVal(current + 1)}>+</button>
              </div>
            </div>
          )
        })()
      ) : max === null ? (
        // Unlimited (Barbarian L20 rage)
        <div className="text-sm font-bold text-green-600">Unlimited</div>
      ) : (
        // Pip display for small counts (1–6)
        <div className="flex gap-1 flex-wrap items-center">
          {Array.from({ length: max }).map((_, i) => {
            const fx = pipFx?.key === r.key && i >= pipFx.from && i < pipFx.to ? pipFx : null
            const full = i < current
            return (
              <button
                key={i}
                type="button"
                className="res-pip"
                onClick={() => {
                  // Click pip to toggle — clicking a used pip restores it, clicking available uses it
                  const newVal = Math.min(max, full ? i : i + 1)
                  setPipFx(newVal < current
                    ? { key: r.key, from: newVal, to: current, kind: 'spend' }
                    : { key: r.key, from: current, to: newVal, kind: 'restore' })
                  patch({ classResources: { ...char.classResources, [r.key]: newVal } })
                }}
                onAnimationEnd={e => {
                  // The gem that finishes the ripple clears it (the pulse never ends)
                  if (!fx) return
                  const lastPip = fx.kind === 'spend' ? fx.from : fx.to - 1
                  if (i === lastPip && e.animationName === (fx.kind === 'spend' ? 'res-gem-spend' : 'res-gem-restore')) setPipFx(null)
                }}
                title={full ? 'Click to use' : 'Click to restore'}
                aria-label={`${r.name} ${i + 1} of ${max}: ${full ? 'available' : 'used'}`}
              >
                <span
                  // Class names spelled out in full so Tailwind keeps them
                  className={`res-gem ${full ? 'res-gem-full' : 'res-gem-spent'}${fx ? (fx.kind === 'spend' ? ' res-gem-spend' : ' res-gem-restore') : ''}`}
                  // Several gems at once ripple outward from the first one; at rest the
                  // pulse is staggered like the spell slots
                  style={fx
                    ? { animationDelay: `${(fx.kind === 'spend' ? fx.to - 1 - i : i - fx.from) * 60}ms` }
                    : full ? { animationDelay: `${i * 0.18}s` } : undefined}
                />
              </button>
            )
          })}
          <span className="text-xs text-parchment-400 ml-1">{current}/{max}</span>
        </div>
      )}
      </>
    )
  }

  // Each class resource belongs to a class or subclass feature (Rage → Rage, Superiority Dice →
  // Combat Superiority): the earliest matching feature card shows its tracker, and the resource's
  // name on the Resources card jumps there.
  const featureAnchor = (classSlug: string, f: { level: number; name: string }) =>
    `feature-${classSlug}-${f.level}-${featureKey(f.name).replace(/ /g, '-')}`
  const resourceAnchor = new Map<string, string>()
  for (const cc of char.classes) {
    const opts = CLASS_OPTIONS[cc.classSlug]
    const sub = opts?.subclasses.find(s => s.slug === cc.subclassSlug)
    const feats = [...(opts?.features ?? content.classes.find(c => c.slug === cc.classSlug)?.features ?? []), ...(sub?.features ?? [])]
      .filter(f => f.level <= cc.level)
      .sort((x, y) => x.level - y.level)
    for (const r of classResources) {
      if (r.classSlug !== cc.classSlug || resourceAnchor.has(r.key)) continue
      const f = feats.find(f => resourceMatchesFeature(r, f.name))
      if (f) resourceAnchor.set(r.key, featureAnchor(cc.classSlug, f))
    }
  }
  const resourcesAt = (anchor: string) => classResources.filter(r => resourceAnchor.get(r.key) === anchor)
  const jumpToFeature = (anchor: string) => {
    setTab('features')
    window.setTimeout(() => {
      const el = document.getElementById(anchor)
      if (!el) return
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.remove('feature-flash')
      void el.offsetWidth  // restart the flash if it's already playing
      el.classList.add('feature-flash')
    }, 60)
  }
  /** The tracker a feature card shows for the resources it spends. Eldritch Cannon's card has its
   *  own "free creation" control for the same counter, so it doesn't get a second one. */
  const featureTrackers = (anchor: string, featureName: string) => resourcesAt(anchor).filter(r => r.key !== 'eldritch-cannon').map(r => (
    <div key={r.key} className="mt-2 flex items-center gap-2 flex-wrap">
      {!resourceMatchesFeature({ key: '', name: r.name }, featureName) && (
        <span className="text-xs font-semibold text-parchment-600">{r.name}</span>
      )}
      <span className={`text-xs rounded px-1 ${r.recharge === 'short' ? 'bg-blue-100 text-blue-600' : 'bg-amber-100 text-amber-600'}`}>
        {r.recharge === 'short' ? 'Short rest' : 'Long rest'}
      </span>
      <div className="min-w-[8rem]">{resourceTracker(r)}</div>
    </div>
  ))
  /** A feature's description: one line until clicked, so the Features tab reads as a list */
  const featureText = (anchor: string, text: string, className = '') => {
    const open = openFeatures.has(anchor) !== allFeaturesOpen
    return (
      <button type="button" aria-expanded={open} title={open ? undefined : 'Show the full text'}
        onClick={() => setOpenFeatures(prev => {
          const next = new Set(prev)
          if (next.has(anchor)) next.delete(anchor); else next.add(anchor)
          return next
        })}
        // line-clamp sets its own display, so `block` only when open
        className={`w-full text-left text-sm text-parchment-600 ${open ? 'block' : 'line-clamp-1'} ${className}`}
      >{text}</button>
    )
  }
  const isMulticlassCaster = isMulticlassSpellcaster(char.classes)
  const multiclassMaxes = isMulticlassCaster ? multiclassSpellSlotsMax(char.classes) : null
  const jackOfAllTrades = hasBardJackOfAllTrades(char)
  const resistances = deriveResistances(raceDef, featBonuses, itemBonuses, potionFx)
  const spellClass = char.classes.find(c => spellcastingAbilityFor(c, content))
  const spellClassSlug = spellClass?.classSlug

  const TABS: { key: Tab; label: string }[] = [
    { key: 'stats', label: 'Stats' },
    { key: 'spells', label: 'Spells' },
    { key: 'inventory', label: 'Inventory' },
    { key: 'features', label: 'Features' },
    { key: 'summons', label: 'Summons' },
    { key: 'notes', label: 'Notes' },
  ]
  // Switching tabs from the pinned bar further down the page starts the new tab at its top
  const selectTab = (key: Tab) => {
    setTab(key)
    const top = (tabsAnchor.current?.getBoundingClientRect().top ?? 0) + window.scrollY
    if (window.scrollY > top) window.scrollTo({ top })
  }

  // HP card derived values
  const hpPct = maxHp > 0 ? Math.min(100, Math.round(char.hp.current / maxHp * 100)) : 0
  const hpBarColor = hpPct > 50 ? 'bg-green-500' : hpPct > 25 ? 'bg-amber-400' : 'bg-red-500'
  const hpTextColor = hpPct > 50 ? 'text-green-700' : hpPct > 25 ? 'text-amber-600' : 'text-red-600'
  const quickN = parseInt(damageInput, 10)
  const quickValid = !isNaN(quickN) && quickN > 0
  const quickAfterDamage = !quickValid ? null
    : wildShapeForm && quickN < wildShapeForm.hp.current ? wildShapeForm.hp.current - quickN
    : Math.max(0, char.hp.current - Math.max(0, quickN - (wildShapeForm?.hp.current ?? 0) - char.hp.temp))
  const quickAfterHeal = !quickValid ? null
    : wildShapeForm ? Math.min(wildShapeForm.hp.max, wildShapeForm.hp.current + quickN)
    : Math.min(maxHp, char.hp.current + quickN)

  /** Healing: the beast form first if you're in one, otherwise you */
  function applyHealing(amount: number) {
    if (!char) return
    if (wildShapeForm) {
      patch({ summons: char.summons.map(s => s.id === wildShapeForm.id ? { ...s, hp: { ...s.hp, current: Math.min(s.hp.max, s.hp.current + amount) } } : s) })
      return
    }
    patch({ hp: { ...char.hp, current: Math.min(maxHp, char.hp.current + amount) } })
  }

  function applyDamage(amount: number) {
    if (!char) return
    // In Wild Shape the beast takes it first; at 0 HP you change back and the rest carries over to you
    let hpDamage = amount
    let summons: Character['summons'] | undefined
    if (wildShapeForm && amount > 0) {
      if (amount < wildShapeForm.hp.current) {
        summons = char.summons.map(s => s.id === wildShapeForm.id ? { ...s, hp: { ...s.hp, current: s.hp.current - amount } } : s)
        hpDamage = 0
      } else {
        summons = char.summons.filter(s => s.id !== wildShapeForm.id)
        hpDamage = amount - wildShapeForm.hp.current
      }
    }
    const temp = char.hp.temp
    const overflow = temp > 0 ? Math.max(0, hpDamage - temp) : hpDamage
    const newTemp = temp > 0 ? Math.max(0, temp - hpDamage) : temp
    const newCurrent = Math.max(0, char.hp.current - overflow)
    const update: Partial<Character> = { hp: { ...char.hp, temp: newTemp, current: newCurrent }, ...(summons ? { summons } : {}) }

    // Massive damage (PHB p.197): damage left over after dropping to 0 that equals or exceeds
    // your hit point maximum kills outright
    if (char.hp.current > 0 && overflow - char.hp.current >= maxHp) {
      update.deathSaves = { successes: 0, failures: 3 }
    }

    // Concentration check on damage (RAW: CON save DC = max(10, damage/2); auto-fail at 0 HP).
    // Damage soaked by temporary HP still counts, and the DC uses the whole hit.
    if (char.concentratingOn && amount > 0) {
      const spellName = content.spells.find(s => s.slug === char.concentratingOn)?.name ?? char.concentratingOn
      if (newCurrent === 0) {
        update.concentratingOn = undefined
      } else {
        setConcCheck({ spellName, dc: Math.max(10, Math.floor(amount / 2)), damage: amount })
      }
    }

    patch(update)
  }

  /** Every attack the character can make right now, worked out once for the Stats tab and the
   *  printed sheet: to hit, damage (with Rage, potions, fighting styles) and what modifies it */
  type AttackRow = {
    key: string
    name: string
    toHit: string
    damage: string
    rider?: string                  // a concentration spell's extra damage against its target
    notes: string
    tone?: 'attuned' | 'unproficient'
    breath?: { used: boolean }      // Dragonborn Breath Weapon: once per short rest
  }
  const attackRows: AttackRow[] = (() => {
    // In Wild Shape you attack with the beast's natural weapons
    if (wildShapeForm) {
      return wildShapeForm.attacks.map((atk, i) => ({
        key: `beast-${i}`, name: atk.name,
        toHit: atk.toHit !== undefined ? formatMod(atk.toHit) : '—',
        damage: atk.damage ? `${atk.damage}${atk.damageType ? ` ${atk.damageType}` : ''}` : '—',
        notes: [`Wild Shape: ${wildShapeForm.name}`, atk.range ?? '', atk.notes ?? ''].filter(Boolean).join(' · '),
      }))
    }
    const rows: AttackRow[] = []
    const rollDice = potionFx.rollBonusDice.map(d => ` ${d}`).join('')
    const strMod = abilityModFor(effectiveChar, 'str'), dexMod = abilityModFor(effectiveChar, 'dex')
    // Unarmed strike: monk Martial Arts die or Tavern Brawler's d4, otherwise a flat 1
    const monkLevel = char.classes.find(c => c.classSlug === 'monk')?.level ?? 0
    const tavernBrawler = featSlugs.includes('tavern-brawler')
    const unarmedDie = monkLevel ? (monkLevel >= 17 ? '1d10' : monkLevel >= 11 ? '1d8' : monkLevel >= 5 ? '1d6' : '1d4') : tavernBrawler ? '1d4' : '1'
    const atkMod = monkLevel ? Math.max(strMod, dexMod) : strMod
    const rageUnarmed = raging && barbarianLevel > 0 && strMod >= atkMod ? rageDamage : 0
    rows.push({
      key: 'unarmed', name: 'Unarmed Strike', toHit: formatMod(atkMod + pb) + rollDice,
      // A flat 1 + modifier is shown as its total (STR 8 → "0", not "1 -1")
      damage: (unarmedDie === '1' ? `${Math.max(0, 1 + atkMod + rageUnarmed)}` : `${unarmedDie}${atkMod + rageUnarmed !== 0 ? ` ${formatMod(atkMod + rageUnarmed)}` : ''}`) + ' bludgeoning',
      notes: [monkLevel ? `Monk ${unarmedDie.slice(1)}` : tavernBrawler ? 'Tavern Brawler' : '', rageUnarmed ? `Rage +${rageUnarmed}` : ''].filter(Boolean).join(' · '),
    })
    if (featSlugs.includes('dragon-hide')) {
      rows.push({ key: 'dragon-hide', name: 'Claws (Dragon Hide)', toHit: formatMod(strMod + pb) + rollDice, damage: `1d4 ${formatMod(strMod)} slashing`, notes: 'Natural weapon' })
    }
    const styles = fightingStyles(char)
    const equippedWeaponCount = char.equipment.filter(e => e.equipped && resolveWeapon(e, content.items)).length
    char.equipment.forEach((item, idx) => {
      if (!item.equipped) return
      const ws = resolveWeapon(item, content.items)
      if (!ws) return
      const bonus = magicBonus(item, artificerLevel)
      const proficient = isWeaponProficient(char, item)
      // Dueling: a one-handed melee weapon and no other weapon held
      const dueling = styles.has('dueling') && !ws.ranged && !ws.twoHanded && item.slot !== 'both' && item.slot !== 'dual' && equippedWeaponCount === 1
      const pw = potionWeaponMods(item.name)
      // Rage adds to melee attacks made with Strength
      const usesStr = !ws.ranged && (!(ws.finesse || isMonkWeapon(char, ws)) || strMod >= dexMod)
      const rageBonus = raging && barbarianLevel > 0 && usesStr ? rageDamage : 0
      const atk = weaponAttackBonus(effectiveChar, ws, proficient ? pb : 0, bonus) + pw.bonus
      const dmgMod = weaponDamageMod(effectiveChar, ws, bonus) + (dueling ? 2 : 0) + pw.bonus + rageBonus
      rows.push({
        key: `weapon-${idx}`, name: item.name,
        toHit: formatMod(atk) + pw.attackDice,
        damage: ws.damage === '—' ? '—' : `${ws.damage}${dmgMod !== 0 ? ` ${formatMod(dmgMod)}` : ''}${pw.damageDice} ${ws.damageType}`,
        rider: concRider && ws.damage !== '—' ? concRider.dice : undefined,
        notes: [
          proficient ? '' : '⚠ Not proficient',
          ws.finesse ? 'Finesse' : '',
          isMonkWeapon(char, ws) ? 'Monk weapon' : '',
          ws.ranged ? 'Ranged' : '',
          ws.versatile ? `Versatile (${ws.versatile})` : '',
          bonus ? `Magic +${bonus}` : '',
          ws.ranged && styles.has('archery') ? 'Archery +2' : '',
          dueling ? 'Dueling +2 dmg' : '',
          rageBonus ? `Rage +${rageBonus}` : '',
          styles.has('great-weapon') && !ws.ranged && (ws.twoHanded || ws.versatile) ? `Great Weapon Fighting: reroll 1s and 2s${ws.twoHanded ? '' : ' when two-handed'}` : '',
          pw.bonus ? `Oil of Sharpness +${pw.bonus}` : '',
          item.attuned ? '✦ Attuned' : '',
          concRider ? `${concRider.label} target` : '',
        ].filter(Boolean).join(' · '),
        tone: item.attuned ? 'attuned' : !proficient ? 'unproficient' : undefined,
      })
    })
    if (spellClassSlug) {
      rows.push({
        key: 'spell-attack', name: 'Spell Attack',
        toHit: formatMod(spellAttackBonus(effectiveChar, spellClassSlug, content) + itemBonuses.spellAttackBonus) + rollDice,
        damage: 'varies by spell',
        rider: concRider && !concRider.weaponOnly ? concRider.dice : undefined,
        notes: `Save DC ${spellSaveDC(effectiveChar, spellClassSlug, content) + itemBonuses.spellDCBonus}`,
      })
    }
    if (char.raceSlug === 'dragonborn') {
      const choice = char.featuresChosen.find(fc => fc.key === 'dragonborn-ancestry')
      const dragon = typeof choice?.value === 'string' ? DRACONIC_ANCESTRIES.find(d => d.slug === choice.value) : undefined
      if (dragon) {
        const charLevel = totalLevel(char)
        rows.push({
          key: 'breath', name: 'Breath Weapon',
          toHit: `DC ${8 + abilityModFor(effectiveChar, 'con') + pb} ${dragon.saveType} save`,
          damage: `${charLevel >= 16 ? '5d6' : charLevel >= 11 ? '4d6' : charLevel >= 6 ? '3d6' : '2d6'} ${dragon.damageType.toLowerCase()}`,
          notes: `${dragon.breathShape} · ${dragon.name} dragon · 1/SR`,
          breath: { used: (char.classResources['breath-weapon-used'] ?? 0) >= 1 },
        })
      }
    }
    return rows
  })()

  /** Take a beast form: spends a Wild Shape use. You keep your own INT, WIS and CHA. */
  const enterWildShape = (b: Beast | { name: string; hp: number; ac: number; speed: number }) => {
    const use = classResources.find(r => r.key === 'wild-shape')
    const beast = 'slug' in b ? b : null
    const cost = beast?.elemental ? 2 : 1   // Elemental Wild Shape takes both uses
    if (!use || (use.max !== null && use.current < cost)) return
    const form: Summon = {
      id: Math.random().toString(36).slice(2, 10),
      name: b.name, templateKey: 'wild-shape',
      hp: { current: b.hp, max: b.hp }, ac: b.ac, speed: b.speed,
      ...(beast ? { abilityScores: { str: beast.str, dex: beast.dex, con: beast.con, int: char.abilityScores.int, wis: char.abilityScores.wis, cha: char.abilityScores.cha } } : {}),
      saveProficiencies: [], immunities: beast?.immunities ?? [], resistances: beast?.resistances ?? [],
      attacks: beast ? beast.attacks.map(a => ({ name: a.name, toHit: a.toHit, damage: a.damage, damageType: a.damageType, range: 'Melee', notes: a.notes ?? '' })) : [],
      abilities: beast ? beast.traits : [],
      notes: beast?.otherSpeeds ? `Also ${beast.otherSpeeds}` : '',
    }
    patch({
      summons: [...char.summons.filter(s => s.templateKey !== 'wild-shape'), form],
      ...(use.max !== null ? { classResources: { ...char.classResources, 'wild-shape': use.current - cost } } : {}),
    })
  }
  const revertWildShape = () => patch({ summons: char.summons.filter(s => s.templateKey !== 'wild-shape') })

  /** Start raging: spends a Rage, and ends concentration (a raging barbarian can't concentrate or cast) */
  const startRage = async () => {
    const rage = classResources.find(r => r.key === 'rage-uses')
    if (!rage || (rage.max !== null && rage.current <= 0)) return
    if (char.concentratingOn) {
      const conc = content.spells.find(s => s.slug === char.concentratingOn)?.name ?? char.concentratingOn
      if (!(await askConfirm({ title: 'Start Raging?', message: `Raging ends your concentration on ${conc}.`, confirmLabel: 'Rage' }))) return
    }
    patch({
      ...(rage.max !== null ? { classResources: { ...char.classResources, 'rage-uses': rage.current - 1 } } : {}),
      concentratingOn: undefined,
    })
    setRaging(true)
  }

  return {
    ready: true as const,
    raging,
    setRaging,
    spellsOnYou,
    toggleSpellOnYou,
    setSpellsOnYou,
    blessed,
    setBlessed,
    barbarianLevel,
    rageDamage,
    concRider,
    startRage,
    recoverSlots,
    setRecoverSlots,
    songOfRestRoll,
    setSongOfRestRoll,
    wildShapeForm,
    enterWildShape,
    revertWildShape,
    applyHealing,
    attackRows,
    id,
    content,
    char,
    setChar,
    loadError,
    setLoadError,
    tab,
    setTab,
    spellFilter,
    setSpellFilter,
    itemFilter,
    setItemFilter,
    addItemSlug,
    setAddItemSlug,
    addSpellSlug,
    setAddSpellSlug,
    addWeaponSlug,
    setAddWeaponSlug,
    addArmorSlug,
    setAddArmorSlug,
    addPanel,
    setAddPanel,
    addPanelSearch,
    setAddPanelSearch,
    ritualSearch,
    setRitualSearch,
    spellBrowserSearch,
    setSpellBrowserSearch,
    spellBrowserLevel,
    setSpellBrowserLevel,
    browserSelectedSpell,
    setBrowserSelectedSpell,
    showSpellLibrary,
    setShowSpellLibrary,
    castHighlight,
    setCastHighlight,
    selectedSpellKey,
    setSelectedSpellKey,
    expandedInventoryItem,
    setExpandedInventoryItem,
    inventorySearch,
    setInventorySearch,
    saveFlash,
    saveFailed,
    retrySave,
    setSaveFlash,
    journeyOpen,
    setJourneyOpen,
    openFeatures,
    setOpenFeatures,
    allFeaturesOpen,
    setAllFeaturesOpen,
    damageInput,
    setDamageInput,
    txAmount,
    setTxAmount,
    txCoin,
    setTxCoin,
    txNote,
    setTxNote,
    purseFloats,
    setPurseFloats,
    ledgerOpen,
    setLedgerOpenState,
    setLedgerOpen,
    tabsAnchor,
    healInput,
    setHealInput,
    shortRestOpen,
    setShortRestOpen,
    shortRestDice,
    setShortRestDice,
    shortRestRolls,
    setShortRestRolls,
    longRestOpen,
    setLongRestOpen,
    askConfirm,
    confirmDialog,
    profEditing,
    setProfEditing,
    newToolText,
    setNewToolText,
    newLangText,
    setNewLangText,
    infuseResistType,
    setInfuseResistType,
    pipFx,
    setPipFx,
    concCheck,
    setConcCheck,
    activeSummonId,
    setActiveSummonId,
    newSummonForm,
    setNewSummonForm,
    addFeatOpen,
    setAddFeatOpen,
    addFeatSearch,
    setAddFeatSearch,
    spellTabClass,
    setSpellTabClass,
    addFeatPending,
    setAddFeatPending,
    addFeatAbility,
    setAddFeatAbility,
    addFeatApplyAsi,
    setAddFeatApplyAsi,
    addFeatClass,
    setAddFeatClass,
    addFeatGrants,
    setAddFeatGrants,
    newResourceName,
    setNewResourceName,
    newResourceMax,
    setNewResourceMax,
    newResourceRecharge,
    setNewResourceRecharge,
    addResourceOpen,
    setAddResourceOpen,
    drinkingIdx,
    setDrinkingIdx,
    drinkRoll,
    setDrinkRoll,
    drinkChoice,
    setDrinkChoice,
    drinkFailedSave,
    setDrinkFailedSave,
    saveFlashTimer,
    charRef,
    diskSaveTimer,
    save,
    saveToFile,
    setRecent,
    dying,
    backfilledId,
    findOpen,
    setFindOpen,
    findQuery,
    setFindQuery,
    findIndex,
    setFindIndex,
    tabsPinned,
    setTabsPinned,
    undo,
    setUndo,
    offerUndo,
    patch,
    level,
    pb,
    featSlugs,
    featBonuses,
    featArmor,
    artificerLevel,
    itemBonuses,
    running,
    potionFx,
    potionScoreOverrides,
    potionWeaponMods,
    effectiveChar,
    raceDef,
    effectiveCharSkills,
    freeSpells,
    subraceOpts,
    landDruid,
    baseMaxHp,
    maxHp,
    conditionsWithout,
    endPotion,
    potionsAfterRest,
    mediumDexCap,
    armorAc,
    armorAcSource,
    stealthDisadv,
    ac,
    acSource,
    initiative,
    passive,
    passiveInvestigation,
    passiveInsight,
    raceSpeed,
    wornArmor,
    bodyArmorType,
    shieldWorn,
    monkMovement,
    fastMovement,
    walkSpeed,
    speed,
    potionSpeedNotes,
    sneakDice,
    paladinAura,
    attuned,
    skillInfo,
    skillBaseProf,
    skillBaseExpert,
    skillChanged,
    resetSkill,
    resetAllSkills,
    abilityBase,
    abilitiesChanged,
    resetAllAbilities,
    saveBase,
    savesChanged,
    resetSave,
    resetAllSaves,
    classResources,
    resourceTracker,
    featureAnchor,
    resourceAnchor,
    resourcesAt,
    jumpToFeature,
    featureTrackers,
    featureText,
    isMulticlassCaster,
    multiclassMaxes,
    jackOfAllTrades,
    resistances,
    spellClass,
    spellClassSlug,
    TABS,
    selectTab,
    hpPct,
    hpBarColor,
    hpTextColor,
    quickN,
    quickValid,
    quickAfterDamage,
    quickAfterHeal,
    applyDamage,
  }
}

export type SheetModel = Extract<ReturnType<typeof useSheetModel>, { ready: true }>
