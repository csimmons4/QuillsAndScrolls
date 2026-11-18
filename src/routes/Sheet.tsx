import { Link } from 'react-router-dom'
import { Character } from '../character/model'
import { abilityModFor, saveMod, formatMod, shortRestResourceKeys, longRestResourceKeys, initiativeBonus, type ClassResource } from '../character/derive'
import { CLASS_OPTIONS } from '../data/classData'
import { shiftBaselines } from '../character/levelUp'
import { exportCharacter } from '../storage/ioFile'
import { applyFeatAbilityIncrease, featAbilityPick, resolveFeatGrants, applyGrantPicks, withFeatClassChoice } from '../character/grants'
import { FeatGrantsBlock } from '../components/FeatGrantsBlock'
import { HourglassIcon, MoonIcon, LevelUpIcon, SaveIcon, CheckIcon, ExportIcon, SearchIcon, PrinterIcon } from '../components/SheetIcons'
import { PortraitPicker } from '../components/PortraitPicker'
import { FeatAbilityPicker } from '../components/FeatAbilityPicker'
import { Tab } from './sheet/helpers'
import { useSheetModel } from './sheet/useSheetModel'
import { HistoryButton } from '../components/HistoryDialog'
import { takeSnapshot } from '../storage/charApi'
import { SheetContext } from './sheet/SheetContext'
import { StatsTab } from './sheet/StatsTab'
import { SpellsTab } from './sheet/SpellsTab'
import { InventoryTab } from './sheet/InventoryTab'
import { FeaturesTab } from './sheet/FeaturesTab'
import { SummonsTab } from './sheet/SummonsTab'
import { NotesTab } from './sheet/NotesTab'

export default function Sheet() {
  const model = useSheetModel()
  if (!model.ready) {
    return (
      <div className="text-center py-20 text-parchment-500 max-w-md mx-auto">
        {model.loadError ? (
          <>
            <p className="text-red-600 font-semibold mb-2">Something went wrong</p>
            <p className="text-sm mb-6">{model.loadError}</p>
          </>
        ) : (
          <p className="mb-6">Loading character...</p>
        )}
        <Link to="/" className="btn-primary">← Back to Vault</Link>
      </div>
    )
  }
  const {
    id,
    content,
    char,
    tab,
    setTab,
    setSelectedSpellKey,
    setExpandedInventoryItem,
    setInventorySearch,
    saveFlash,
    damageInput,
    setDamageInput,
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
    concCheck,
    setConcCheck,
    addFeatOpen,
    setAddFeatOpen,
    addFeatSearch,
    setAddFeatSearch,
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
    save,
    saveToFile,
    findOpen,
    setFindOpen,
    findQuery,
    setFindQuery,
    findIndex,
    setFindIndex,
    tabsPinned,
    undo,
    setUndo,
    offerUndo,
    patch,
    level,
    pb,
    featSlugs,
    featBonuses,
    itemBonuses,
    potionFx,
    effectiveChar,
    freeSpells,
    maxHp,
    potionsAfterRest,
    stealthDisadv,
    ac,
    acSource,
    initiative,
    passive,
    passiveInvestigation,
    passiveInsight,
    monkMovement,
    fastMovement,
    speed,
    potionSpeedNotes,
    paladinAura,
    classResources,
    resourceTracker,
    featureAnchor,
    resourceAnchor,
    jumpToFeature,
    multiclassMaxes,
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
    raging,
    setRaging,
    blessed,
    setBlessed,
    spellsOnYou,
    toggleSpellOnYou,
    setSpellsOnYou,
    wildShapeForm,
    revertWildShape,
    applyHealing,
    recoverSlots,
    setRecoverSlots,
    songOfRestRoll,
    setSongOfRestRoll,
  } = model

  return (
    <SheetContext.Provider value={model}>
    <div>
      {/* Header: back link, name and summary on the left; rests, Level Up and the file actions on the right */}
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 mb-4">
        <div className="min-w-0 flex items-end gap-4">
          <PortraitPicker name={char.name} portrait={char.portrait} onChange={p => patch({ portrait: p })} className="w-14 h-14 sm:w-20 sm:h-20" />
          <div className="min-w-0">
          <Link to="/" className="text-xs text-parchment-500 hover:text-parchment-800 px-1">← Vault</Link>
          <input
            // Sized to the name (an input is ~20 characters wide by default), never wider than the screen
            size={Math.max(4, char.name.length + 1)}
            className="block max-w-full text-2xl sm:text-3xl font-bold bg-transparent border-none outline-none focus:bg-parchment-50 rounded px-1"
            value={char.name}
            onChange={e => patch({ name: e.target.value })}
            aria-label="Character name"
          />
          <p className="text-sm text-parchment-500 mt-1 px-1">
            Level {level} &bull;{' '}
            {char.classes.map(c => `${content.classes.find(cl => cl.slug === c.classSlug)?.name ?? c.classSlug} ${c.level}`).join(' / ')} &bull;{' '}
            {content.races.find(r => r.slug === char.raceSlug)?.name ?? char.raceSlug}
          </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {/* Rests, as one segmented control */}
          <div className="inline-flex rounded border border-parchment-300 overflow-hidden" role="group" aria-label="Rest">
            <button type="button"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 text-sm font-semibold bg-parchment-200 text-dungeon-900 hover:bg-parchment-300 transition-colors"
              onClick={() => { setShortRestDice({}); setRecoverSlots({}); setSongOfRestRoll(''); setShortRestOpen(true) }} title="Short Rest" aria-label="Short Rest"
            ><HourglassIcon className="w-4 h-4" /><span className="hidden sm:inline">Short Rest</span></button>
            <button type="button"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 text-sm font-semibold bg-parchment-200 text-dungeon-900 hover:bg-parchment-300 transition-colors border-l border-parchment-300"
              onClick={() => setLongRestOpen(true)} title="Long Rest" aria-label="Long Rest"
            ><MoonIcon className="w-4 h-4" /><span className="hidden sm:inline">Long Rest</span></button>
          </div>
          <Link to={`/c/${char.id}/level-up`} className="btn-primary text-sm gap-1.5 px-2.5 sm:px-3" title="Level Up" aria-label="Level Up">
            <LevelUpIcon className="w-4 h-4" /><span className="hidden sm:inline">Level Up</span>
          </Link>
          <span className="hidden sm:block w-px h-7 bg-parchment-300 mx-1" aria-hidden />
          <button type="button" onClick={() => { setFindQuery(''); setFindIndex(0); setFindOpen(true) }}
            title={`Find a spell, item or feature (${/Mac|iPhone|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl+K'})`} aria-label="Find on this sheet"
            className="inline-flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded border border-parchment-300 text-parchment-600 hover:text-parchment-900 hover:border-parchment-500 hover:bg-parchment-100 transition-colors"
          ><SearchIcon className="w-5 h-5" /></button>
          {/* File actions. The sheet also saves on its own; this saves this instant (⌘S / Ctrl+S). */}
          <button type="button" onClick={saveToFile}
            title={saveFlash === 'saved' ? 'Saved' : 'Save now (⌘S / Ctrl+S). Changes also save automatically.'}
            aria-label={saveFlash === 'saved' ? 'Saved' : 'Save now'}
            className={`inline-flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded border transition-colors ${
              saveFlash === 'saved'
                ? 'border-green-400 bg-green-50 text-green-600'
                : 'border-parchment-300 text-parchment-600 hover:text-parchment-900 hover:border-parchment-500 hover:bg-parchment-100'
            }`}
          >{saveFlash === 'saved' ? <CheckIcon className="w-5 h-5" /> : <SaveIcon className="w-5 h-5" />}</button>
          <button type="button" onClick={() => exportCharacter(char)}
            title="Export: download this character as a .json file" aria-label="Export character as JSON"
            className="inline-flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded border border-parchment-300 text-parchment-600 hover:text-parchment-900 hover:border-parchment-500 hover:bg-parchment-100 transition-colors"
          ><ExportIcon className="w-5 h-5" /></button>
          <HistoryButton charId={char.id} charName={char.name}
            onRestore={async restored => { await takeSnapshot(char.id, 'Before restoring an earlier version').catch(() => {}); save(restored) }} />
          <Link to={`/c/${char.id}/print`} title="Printable sheet (print or save as PDF)" aria-label="Printable sheet"
            className="inline-flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded border border-parchment-300 text-parchment-600 hover:text-parchment-900 hover:border-parchment-500 hover:bg-parchment-100 transition-colors"
          ><PrinterIcon className="w-5 h-5" /></Link>
        </div>
      </div>

      {/* Vitals: hit points and the quick damage/heal controls on the left, the numbers you look up
          most on the right */}
      <div className="card mb-3 px-4 py-3 flex flex-col lg:flex-row gap-4">
        <div className="lg:w-[25rem] shrink-0">
          {/* Wild Shape: the beast form takes damage and healing first */}
          {wildShapeForm && (
            <div className="mb-2 flex items-center gap-2 rounded-lg border border-green-300 bg-green-50 px-2.5 py-1.5 text-xs">
              <span className="font-bold text-green-800 whitespace-nowrap">{wildShapeForm.name}</span>
              <span className="text-green-700 whitespace-nowrap tabular-nums">{wildShapeForm.hp.current}/{wildShapeForm.hp.max} HP · AC {wildShapeForm.ac}</span>
              <div className="flex-1 h-1.5 bg-green-100 rounded-full overflow-hidden min-w-[2rem]"><div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${Math.round(wildShapeForm.hp.current / Math.max(1, wildShapeForm.hp.max) * 100)}%` }} /></div>
              <button type="button" onClick={revertWildShape} className="rounded-full px-2 py-0.5 border border-green-400 text-green-800 hover:bg-green-100 whitespace-nowrap">Change back</button>
            </div>
          )}
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-baseline gap-1.5">
              <input
                type="number"
                aria-label="Current hit points"
                className={`text-3xl font-bold w-16 bg-transparent border-none focus:outline-none focus:border-b-2 focus:border-parchment-400 rounded-none pb-0.5 ${hpTextColor}`}
                value={char.hp.current}
                onChange={e => patch({ hp: { ...char.hp, current: Math.max(0, Math.min(maxHp, parseInt(e.target.value, 10) || 0)) } })}
              />
              <span className="text-base text-parchment-300 select-none">/</span>
              <span className="text-base font-medium text-parchment-400" title="Hit point maximum">{maxHp}</span>
              {featBonuses.hpBonusPerLevel > 0 && (
                <span className="text-xs text-amber-500 ml-1">+{featBonuses.hpBonusPerLevel * level} Tough</span>
              )}
            </div>
            {/* Temporary hit points sit beside the total they protect */}
            <div className="flex items-center gap-1.5" title="Temporary hit points">
              <div className="relative w-8 h-9 shrink-0">
                <svg viewBox="0 0 56 64" className="absolute inset-0 w-full h-full temp-shield" fill="currentColor" aria-hidden>
                  <path d="M28 2 L54 14 L54 36 C54 50 28 62 28 62 C28 62 2 50 2 36 L2 14 Z" />
                </svg>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  aria-label="Temporary hit points"
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-sm font-bold temp-shield-value w-8 text-center bg-transparent border-none focus:outline-none"
                  value={char.hp.temp}
                  onChange={e => {
                    const v = parseInt(e.target.value, 10)
                    patch({ hp: { ...char.hp, temp: isNaN(v) ? 0 : Math.max(0, v) } })
                  }}
                />
              </div>
              <span className="text-[10px] uppercase tracking-wide text-parchment-400">Temp</span>
            </div>
            <span className="ml-auto text-[11px] uppercase tracking-wide text-parchment-500">Hit Points</span>
          </div>
          <div className="h-1.5 bg-parchment-200 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-300 ${hpBarColor}`} style={{ width: `${hpPct}%` }} />
          </div>

          {/* Quick controls */}
          <div className="flex items-center gap-2 mt-3">
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                aria-label="Decrease amount"
                className="w-7 h-7 rounded border border-parchment-300 text-parchment-600 hover:border-parchment-500 hover:bg-parchment-50 font-bold text-base leading-none transition-colors"
                onClick={() => setDamageInput(v => String(Math.max(1, (parseInt(v, 10) || 0) - 1)))}
              >−</button>
              <input
                type="number"
                min={1}
                aria-label="Amount to damage, heal or add as temporary hit points"
                className="w-14 text-center text-xl font-bold border border-parchment-200 rounded py-0.5 bg-parchment-50 focus:border-parchment-400 focus:outline-none"
                placeholder="0"
                value={damageInput}
                onChange={e => setDamageInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && quickValid) { applyDamage(quickN); setDamageInput('') } }}
              />
              <button
                type="button"
                aria-label="Increase amount"
                className="w-7 h-7 rounded border border-parchment-300 text-parchment-600 hover:border-parchment-500 hover:bg-parchment-50 font-bold text-base leading-none transition-colors"
                onClick={() => setDamageInput(v => String((parseInt(v, 10) || 0) + 1))}
              >+</button>
            </div>
            <div className="flex gap-1.5 flex-1 min-w-0">
              <button
                type="button"
                disabled={!quickValid}
                className="flex-1 min-w-0 py-1.5 px-1 rounded text-sm font-medium transition-colors bg-red-100 text-red-700 border border-red-200 hover:bg-red-200 disabled:opacity-40 disabled:cursor-not-allowed"
                onClick={() => { applyDamage(quickN); setDamageInput('') }}
              >
                <div>Damage</div>
                {quickAfterDamage !== null && <div className="text-xs opacity-70">→ {quickAfterDamage}</div>}
              </button>
              <button
                type="button"
                disabled={!quickValid}
                className="flex-1 min-w-0 py-1.5 px-1 rounded text-sm font-medium transition-colors bg-green-100 text-green-700 border border-green-200 hover:bg-green-200 disabled:opacity-40 disabled:cursor-not-allowed"
                onClick={() => { applyHealing(quickN); setDamageInput('') }}
              >
                <div>Heal</div>
                {quickAfterHeal !== null && <div className="text-xs opacity-70">→ {quickAfterHeal}</div>}
              </button>
              <button
                type="button"
                disabled={!quickValid}
                className="flex-1 min-w-0 py-1.5 px-1 rounded text-sm font-medium transition-colors bg-blue-100 text-blue-700 border border-blue-200 hover:bg-blue-200 disabled:opacity-40 disabled:cursor-not-allowed"
                title="Temporary hit points don't add together — you keep the larger amount"
                onClick={() => { patch({ hp: { ...char.hp, temp: Math.max(char.hp.temp, quickN) } }); setDamageInput('') }}
              >
                <div>Temp</div>
                {quickValid && <div className="text-xs opacity-70">→ {Math.max(char.hp.temp, quickN)}</div>}
              </button>
            </div>
          </div>
        </div>

        <div className="hidden lg:block w-px bg-parchment-200 shrink-0" aria-hidden />

        {/* Quick stats; the three passive scores share one box */}
        <div className="flex-1 grid grid-cols-4 sm:grid-cols-5 gap-1.5 sm:gap-2">
          {[
            { label: 'AC', value: ac, note: acSource + (stealthDisadv ? ' ⚠ Stealth disadv.' : '') },
            { label: 'Initiative', value: formatMod(initiative), note: featBonuses.initiativeBonus ? `+${featBonuses.initiativeBonus} Alert` : undefined },
            { label: 'Speed', value: `${speed}ft`, note: [
              wildShapeForm ? `${wildShapeForm.name}${wildShapeForm.notes ? `, ${wildShapeForm.notes.replace(/^Also /, '')}` : ''}` : '',
              potionFx.speedMultiplier > 1 ? `×${potionFx.speedMultiplier} ${spellsOnYou.has('haste') ? 'Haste' : 'potion'}`
                : wildShapeForm ? ''
                : monkMovement ? `+${monkMovement}ft Unarmored Movement` : fastMovement ? `+${fastMovement}ft Fast Movement` : featBonuses.speedBonus ? `+${featBonuses.speedBonus}ft feat` : '',
              ...potionSpeedNotes,
            ].filter(Boolean).join(' · ') || undefined },
            { label: 'Prof. Bonus', value: formatMod(pb) },
          ].map(s => (
            <div key={s.label} className="stat-box justify-start text-center !p-1.5 sm:!p-2" title={s.note}>
              <div className="text-[10px] sm:text-[11px] text-parchment-500 uppercase tracking-wide whitespace-nowrap">{s.label === 'Prof. Bonus' ? <><span className="sm:hidden">Prof.</span><span className="hidden sm:inline">Prof. Bonus</span></> : s.label === 'Initiative' ? <><span className="sm:hidden">Init.</span><span className="hidden sm:inline">Initiative</span></> : s.label}</div>
              <div className="text-xl sm:text-2xl font-bold leading-tight">{s.value}</div>
              {s.note && <div className="hidden sm:block text-[10px] leading-snug text-amber-600 mt-0.5">{s.note}</div>}
            </div>
          ))}
          {/* Passive scores: one box on wide screens, a line of their own on phones */}
          <div className="col-span-4 sm:col-span-1 rounded border border-parchment-300 bg-parchment-50 px-2.5 py-1.5 sm:p-2 flex flex-wrap sm:flex-col items-center sm:items-stretch gap-x-3 gap-y-0.5 sm:gap-0">
            <div className="text-[10px] sm:text-[11px] text-parchment-500 uppercase tracking-wide sm:text-center sm:mb-1">Passive</div>
            {[
              { label: 'Perception', value: passive, note: featBonuses.passivePerceptionBonus ? `+${featBonuses.passivePerceptionBonus} Observant` : undefined },
              { label: 'Investigation', value: passiveInvestigation, note: featBonuses.passiveInvestigationBonus ? `+${featBonuses.passiveInvestigationBonus} Observant` : undefined },
              { label: 'Insight', value: passiveInsight },
            ].map(p => (
              <div key={p.label}>
                <div className="flex items-baseline justify-between gap-1.5 sm:gap-2 text-xs">
                  <span className="text-parchment-600">{p.label}</span>
                  <span className="text-sm font-bold">{p.value}</span>
                </div>
                {p.note && <div className="text-[10px] leading-snug text-amber-600 text-right">{p.note}</div>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Resources — class resources plus the player's own custom trackers */}
      {(() => {
        const trackedResources: Array<ClassResource & { isCustom?: boolean }> = [
          ...classResources,
          ...(char.customResources ?? []).map(r => ({
            key: r.key, name: r.name, max: r.max, recharge: r.recharge, classSlug: 'custom', isCustom: true,
            current: char.classResources[r.key] ?? r.max,
          })),
        ]
        const addCustomResource = () => {
          const name = newResourceName.trim()
          const max = parseInt(newResourceMax, 10)
          if (!name || !max || max < 1) return
          const key = `custom-${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`
          patch({
            customResources: [...(char.customResources ?? []), { key, name, max, recharge: newResourceRecharge }],
            classResources: { ...char.classResources, [key]: max },
          })
          setNewResourceName(''); setNewResourceMax(''); setNewResourceRecharge('long'); setAddResourceOpen(false)
        }
        const removeCustomResource = async (key: string, name: string) => {
          if (!(await askConfirm({ title: 'Stop Tracking', message: `Remove “${name}” from your resources?`, confirmLabel: 'Remove', danger: true }))) return
          const newClassRes = { ...char.classResources }
          delete newClassRes[key]
          patch({ customResources: (char.customResources ?? []).filter(x => x.key !== key), classResources: newClassRes })
        }
        // One strip: each resource is its name and its gems. The name jumps to the feature card,
        // which has the full description.
        return (
        <div className="card mb-3 px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h3 className="text-xs font-bold uppercase tracking-widest text-parchment-700 mr-1">Resources</h3>
            {trackedResources.length === 0 && !addResourceOpen && (
              <span className="text-xs text-parchment-400">None yet. Use + Custom to track item charges, boons or anything else that resets on a rest.</span>
            )}
            {trackedResources.map(r => {
              // Short notes (a die size, a damage bonus) stay in view; longer ones show on hover
              const shortNote = r.display && r.display.length <= 14 ? r.display : undefined
              const hoverNote = shortNote ? undefined : r.display
              return (
                <div key={r.key} className="group inline-flex items-center gap-2 rounded-lg border border-parchment-200 bg-parchment-100 pl-2.5 pr-1.5 py-0.5">
                  {resourceAnchor.has(r.key) ? (
                    <button type="button" onClick={() => jumpToFeature(resourceAnchor.get(r.key)!)}
                      title={`${hoverNote ? `${hoverNote}. ` : ''}Show this feature on the Features tab`}
                      className="text-sm font-semibold text-parchment-800 truncate max-w-[14rem] text-left hover:underline decoration-dotted underline-offset-2"
                    >{r.name}</button>
                  ) : (
                    <span className="text-sm font-semibold text-parchment-800 truncate max-w-[14rem]" title={hoverNote}>{r.name}</span>
                  )}
                  {shortNote && <span className="text-xs text-parchment-500 whitespace-nowrap">{shortNote}</span>}
                  <span className={`text-[10px] font-semibold rounded px-1 ${r.recharge === 'short' ? 'bg-blue-100 text-blue-600' : 'bg-amber-100 text-amber-600'}`}
                    title={r.recharge === 'short' ? 'Comes back on a short or long rest' : 'Comes back on a long rest'}>
                    {r.recharge === 'short' ? 'SR' : 'LR'}
                  </span>
                  {resourceTracker(r, true)}
                  {r.isCustom && (
                    <button type="button" onClick={() => removeCustomResource(r.key, r.name)} title="Stop tracking" aria-label={`Stop tracking ${r.name}`}
                      className="text-[10px] text-parchment-300 hover:text-red-500 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity">✕</button>
                  )}
                </div>
              )
            })}
            <button type="button" onClick={() => setAddResourceOpen(o => !o)}
              title="Track something the sheet doesn't know about: a magic item's uses, a DM-granted boon, a racial ability…"
              className="ml-auto text-xs rounded-full px-2.5 py-0.5 border border-parchment-200 text-parchment-500 hover:border-parchment-500 hover:text-parchment-800 transition-colors"
            >{addResourceOpen ? 'Cancel' : '+ Custom'}</button>
          </div>
          {addResourceOpen && (
            <div className="mt-2.5 p-2 rounded border border-parchment-200 bg-parchment-50 flex gap-2 flex-wrap items-center">
              <input type="text" placeholder="Name (e.g. Luck Points)" autoFocus value={newResourceName}
                onChange={e => setNewResourceName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addCustomResource() }}
                className="input py-1 flex-1 min-w-[10rem]" />
              <input type="number" placeholder="Uses" min={1} value={newResourceMax}
                onChange={e => setNewResourceMax(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addCustomResource() }}
                className="input py-1 w-20" />
              <select value={newResourceRecharge} onChange={e => setNewResourceRecharge(e.target.value as 'short' | 'long')}
                className="input py-1 w-auto">
                <option value="long">Resets on long rest</option>
                <option value="short">Resets on short rest</option>
              </select>
              <button type="button" onClick={addCustomResource} className="btn-primary text-sm px-3 py-1">Add</button>
            </div>
          )}
        </div>
        )
      })()}

      {char.hp.current <= 0 ? (
        /* ── Death screen ── */
        (() => {
          const isStabilized = char.deathSaves.successes >= 3
          const isDead       = char.deathSaves.failures  >= 3
          const failures     = char.deathSaves.failures
          const durations    = ['0.85s', '1.3s', '2.2s']
          const applyHeal = () => {
            const n = parseInt(healInput, 10)
            if (!n || n <= 0) return
            patch({ hp: { ...char.hp, current: Math.min(maxHp, char.hp.current + n) } })
            setHealInput('')
          }
          return (
            // Covers the whole window (nav bar and sheet included) until healed
            <div
              className="death-screen fixed inset-0 z-50 overflow-y-auto overscroll-contain text-white"
              role="dialog" aria-modal="true" aria-label={`${char.name} is making death saving throws`}
              style={{
                backgroundColor: '#0a0a0a',
                boxShadow: isStabilized
                  ? 'inset 0 0 220px rgba(21,128,61,0.35), inset 0 0 80px rgba(21,128,61,0.2)'
                  : isDead
                    ? 'inset 0 0 260px rgba(0,0,0,0.95), inset 0 0 100px rgba(80,0,0,0.4)'
                    : 'inset 0 0 200px rgba(153,27,27,0.45), inset 0 0 70px rgba(153,27,27,0.25)',
              }}
            >
              <Link to="/" className="absolute top-4 left-5 text-xs uppercase tracking-widest text-white/25 hover:text-white/70 transition-colors">
                ← Vault
              </Link>
              <div className="min-h-full max-w-xl mx-auto flex flex-col justify-center">
              {/* Header */}
              <div
                className="text-center pt-10 pb-6 px-4 border-b"
                style={{ borderColor: isStabilized ? 'rgba(21,128,61,0.25)' : 'rgba(153,27,27,0.3)' }}
              >
                <h2 className="text-3xl font-bold text-parchment-100 mb-3">{char.name}</h2>
                <p className={`text-xs uppercase tracking-[0.35em] mb-4 ${isStabilized ? 'text-green-600' : isDead ? 'text-red-900' : 'text-red-600'}`}>
                  {isStabilized ? 'has stabilized' : isDead ? 'has perished' : 'has fallen'}
                </p>

                {/* Orb */}
                <div className="flex flex-col items-center gap-4 mb-4">
                  <div
                    className="w-10 h-10 rounded-full mx-auto"
                    style={isDead ? {
                      background: 'radial-gradient(circle at 35% 35%, #3f0d0d, #1a0000)',
                      animation: 'flatline 3s ease-in-out infinite',
                      opacity: 0.25,
                    } : isStabilized ? {
                      background: 'radial-gradient(circle at 35% 35%, #bbf7d0, #22c55e 40%, #166534)',
                      boxShadow: '0 0 12px rgba(34,197,94,0.6), 0 0 30px rgba(34,197,94,0.3)',
                      animation: 'stabilize-orb 2s ease-in-out infinite',
                    } : {
                      background: 'radial-gradient(circle at 35% 35%, #fca5a5, #ef4444 40%, #991b1b)',
                      boxShadow: '0 0 12px rgba(239,68,68,0.6), 0 0 30px rgba(239,68,68,0.3)',
                      animation: `heartbeat ${durations[failures]} ease-in-out infinite`,
                    }}
                  />
                  {!isDead && !isStabilized && (
                    <p className="text-red-900 text-xs uppercase tracking-widest">
                      {failures === 0 ? 'Holding on…' : failures === 1 ? 'Fading…' : 'Barely alive…'}
                    </p>
                  )}
                </div>

                {!isStabilized && !isDead && (
                  <p className="text-red-400/80 text-xs uppercase tracking-[0.25em]">Death Saving Throws</p>
                )}
              </div>

              {/* Outcome: Stabilized */}
              {isStabilized && (
                <div className="outcome-enter text-center py-16 px-4">
                  <p className="text-green-700 text-xs uppercase tracking-[0.4em] mb-5">Against all odds</p>
                  <h3 className="text-5xl font-bold text-green-300 mb-5 tracking-widest">STABILIZED</h3>
                  <p className="text-green-800 text-sm">Unconscious but holding on — awaiting healing</p>
                </div>
              )}

              {/* Outcome: Dead */}
              {isDead && (
                <div className="outcome-enter death-fade-pulse text-center py-16 px-4">
                  <p className="text-red-400/70 text-xs uppercase tracking-[0.4em] mb-5">The light fades</p>
                  <h3 className="text-5xl font-bold text-red-400 mb-5 tracking-widest">YOU HAVE DIED</h3>
                  <p className="text-red-500/60 text-sm">Your story ends here</p>
                </div>
              )}

              {/* Saves — shown while in progress */}
              {!isStabilized && !isDead && (
                <div className="py-9 px-4 flex flex-col items-center gap-8">
                  <div className="flex flex-col items-center gap-4">
                    <span className="text-xs font-semibold uppercase tracking-widest text-green-500/80">Successes</span>
                    <div className="flex gap-5">
                      {[0,1,2].map(i => (
                        <button
                          key={i}
                          onClick={() => {
                            const newSuccesses = char.deathSaves.successes === i + 1 ? i : i + 1
                            // 3 successes → stabilized: stay at 0 HP and show the STABILIZED
                            // outcome screen. Healing clears the saves via save()'s auto-reset.
                            patch({ deathSaves: { ...char.deathSaves, successes: newSuccesses } })
                          }}
                          className={`w-14 h-14 rounded-full border-2 transition-all duration-300 ${
                            char.deathSaves.successes > i
                              ? 'bg-green-500 border-green-400 shadow-[0_0_20px_rgba(74,222,128,0.7)]'
                              : 'border-green-900 bg-black/20 hover:border-green-600 hover:shadow-[0_0_8px_rgba(74,222,128,0.2)]'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="w-24 h-px bg-red-900/40" />

                  <div className="flex flex-col items-center gap-4">
                    <span className="text-xs font-semibold uppercase tracking-widest text-red-500/80">Failures</span>
                    <div className="flex gap-5">
                      {[0,1,2].map(i => (
                        <button
                          key={i}
                          onClick={() => patch({ deathSaves: { ...char.deathSaves, failures: char.deathSaves.failures === i + 1 ? i : i + 1 } })}
                          className={`w-14 h-14 rounded-full border-2 transition-all duration-300 ${
                            char.deathSaves.failures > i
                              ? 'bg-red-700 border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.6)]'
                              : 'border-red-900/60 bg-black/20 hover:border-red-700 hover:shadow-[0_0_8px_rgba(239,68,68,0.2)]'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Footer */}
              <div
                className="border-t px-4 py-5 flex flex-col items-center gap-3"
                style={{ borderColor: isStabilized ? 'rgba(21,128,61,0.2)' : 'rgba(153,27,27,0.2)' }}
              >
                {!isDead && (
                  <>
                    <p className={`text-xs uppercase tracking-widest ${isStabilized ? 'text-green-900' : 'text-red-900'}`}>Receive Healing</p>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min={1}
                        placeholder="HP"
                        className="w-20 text-center rounded border bg-black/30 text-white px-2 py-1.5 text-sm focus:outline-none"
                        style={{ borderColor: isStabilized ? 'rgba(21,128,61,0.5)' : 'rgba(153,27,27,0.5)', }}
                        value={healInput}
                        onChange={e => setHealInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') applyHeal() }}
                      />
                      <button
                        className="px-4 py-1.5 text-sm rounded font-semibold bg-green-800 text-green-100 hover:bg-green-700 transition-colors"
                        onClick={applyHeal}
                      >Heal</button>
                    </div>
                  </>
                )}
                {(char.deathSaves.successes > 0 || char.deathSaves.failures > 0) && (
                  <button
                    className="text-xs text-red-900/60 hover:text-red-700 transition-colors mt-1"
                    onClick={() => patch({ deathSaves: { successes: 0, failures: 0 } })}
                  >Reset saves</button>
                )}
              </div>
              </div>
            </div>
          )
        })()
      ) : (
      <>
      {/* Tabs: pinned to the top of the window, so they're in reach anywhere on a long tab */}
      <div ref={tabsAnchor} />
      <div className="sticky top-0 z-30 bg-parchment-100 flex border-b border-parchment-200 mb-5">
        <div className="flex gap-3 sm:gap-5 pt-3 min-w-0 flex-1 overflow-x-auto [scrollbar-width:none]">
        {TABS.map(t => t.key === 'summons' ? (
          <button key={t.key} onClick={() => selectTab(t.key)}
            className={`pb-2 text-sm font-medium flex items-center gap-1.5 shrink-0 whitespace-nowrap ${tab === 'summons' ? 'tab-active' : 'tab-inactive'}`}>
            {t.label}
            {char.summons.filter(sm => sm.templateKey !== 'wild-shape').length > 0 && (
              <span className="text-[10px] bg-amber-500 text-white rounded-full px-1.5 py-0.5 font-bold leading-none">
                {char.summons.filter(sm => sm.templateKey !== 'wild-shape').length}
              </span>
            )}
          </button>
        ) : (
          <button key={t.key} onClick={() => selectTab(t.key)}
            className={`pb-2 text-sm font-medium shrink-0 whitespace-nowrap ${tab === t.key ? 'tab-active' : 'tab-inactive'}`}>
            {t.label}
          </button>
        ))}
        </div>
        {/* Once pinned: the numbers you glance at mid-fight, from any tab. Beside the tabs on wider
            screens; on a phone, a slim row just under them (laid over the page, so nothing jumps) */}
        <div aria-hidden={!tabsPinned}
          className={`${tabsPinned ? 'flex' : 'hidden sm:flex'} absolute sm:static top-full inset-x-0 flex-wrap sm:flex-nowrap items-center gap-x-3 gap-y-1 px-1 py-1.5 sm:p-0 sm:pt-3 sm:pb-2 sm:pl-4 shrink-0 text-sm bg-parchment-100 sm:bg-transparent border-b border-parchment-200 sm:border-0 shadow-sm sm:shadow-none transition-opacity duration-200 ${tabsPinned ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          {wildShapeForm && (
            <span className="tabular-nums text-green-800" title={`Wild Shape: ${wildShapeForm.name}`}>
              <span className="text-[10px] uppercase tracking-wide mr-1">{wildShapeForm.name}</span>
              <span className="font-bold">{wildShapeForm.hp.current}</span><span className="opacity-60">/{wildShapeForm.hp.max}</span>
            </span>
          )}
          <span className="tabular-nums" title="Hit points">
            <span className="text-[10px] uppercase tracking-wide text-parchment-500 mr-1">HP</span>
            <span className={`font-bold ${hpTextColor}`}>{char.hp.current}</span>
            <span className="text-parchment-400">/{maxHp}</span>
            {char.hp.temp > 0 && <span className="ml-1 text-xs font-semibold text-blue-600" title="Temporary hit points">+{char.hp.temp}</span>}
          </span>
          <span className="tabular-nums" title="Armor Class">
            <span className="text-[10px] uppercase tracking-wide text-parchment-500 mr-1">AC</span>
            <span className="font-bold text-parchment-800">{ac}</span>
          </span>
          {char.concentratingOn && (() => {
            const concName = content.spells.find(sp => sp.slug === char.concentratingOn)?.name ?? char.concentratingOn
            return (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 pl-2 pr-0.5 py-0.5 text-xs font-semibold text-amber-800" title={`Concentrating on ${concName}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" style={{ boxShadow: '0 0 5px 1px rgba(251,191,36,0.8)' }} />
                {concName}
                <button type="button" onClick={() => patch({ concentratingOn: undefined })} tabIndex={tabsPinned ? 0 : -1}
                  title="Stop concentrating" aria-label={`Stop concentrating on ${concName}`}
                  className="w-4 h-4 rounded-full leading-none text-amber-500 hover:text-red-600 hover:bg-amber-100">✕</button>
              </span>
            )
          })()}
          {raging && (
            <button type="button" onClick={() => setRaging(false)} tabIndex={tabsPinned ? 0 : -1} title="Stop raging"
              className="rounded-full bg-red-600 text-white text-xs font-semibold px-2 py-0.5 hover:bg-red-700">Raging ✕</button>
          )}
          {[...spellsOnYou].map(key => (
            <button key={key} type="button" onClick={() => toggleSpellOnYou(key)} tabIndex={tabsPinned ? 0 : -1} title="This spell has ended"
              className="rounded-full bg-indigo-600 text-white text-xs font-semibold px-2 py-0.5 hover:bg-indigo-700">
              {({ 'mage-armor': 'Mage Armor', shield: 'Shield', 'shield-of-faith': 'Shield of Faith', haste: 'Haste', barkskin: 'Barkskin' } as const)[key]} ✕
            </button>
          ))}
          {blessed && (
            <button type="button" onClick={() => setBlessed(false)} tabIndex={tabsPinned ? 0 : -1} title="Bless has ended"
              className="rounded-full bg-amber-400 text-white text-xs font-semibold px-2 py-0.5 hover:bg-amber-500">Blessed ✕</button>
          )}
          {char.inspiration && (
            <span className="w-3 h-3 rotate-45 bg-amber-400 border border-amber-500" title="Inspired"
              style={{ boxShadow: '0 0 6px 2px rgba(251,191,36,0.55)' }} />
          )}
        </div>
      </div>

      {/* Stats Tab */}
      {tab === 'stats' && <StatsTab />}

      {/* Spells Tab */}
      {tab === 'spells' && <SpellsTab />}

      {/* Inventory Tab */}
      {tab === 'inventory' && <InventoryTab />}

      {/* Features Tab */}
      {tab === 'features' && <FeaturesTab />}

      {/* Summons Tab */}
      {tab === 'summons' && <SummonsTab />}

      {/* Notes Tab */}
      {tab === 'notes' && <NotesTab />}
      </>
      )}

      {confirmDialog}
      {findOpen && (() => {
        // Everything on the sheet you might want to get to
        type Hit = { key: string; label: string; kind: string; sub?: string; go: () => void }
        const scrollTo = (selector: string) => window.setTimeout(() =>
          document.querySelector(selector)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80)
        const hits: Hit[] = [
          ...char.spells.map(sp => ({
            key: `entry:${sp.spellSlug}`, label: sp.name, kind: 'Spell',
            sub: (() => { const l = content.spells.find(d => d.slug === sp.spellSlug)?.level ?? 0; return l === 0 ? 'Cantrip' : `Level ${l}` })(),
            go: () => { setTab('spells'); setSelectedSpellKey(`entry:${sp.spellSlug}`); scrollTo(`[data-spell-key="entry:${sp.spellSlug}"]`) },
          })),
          ...freeSpells.map(f => ({
            key: `free:${f.key}`, label: f.name, kind: 'Spell', sub: f.source,
            go: () => { setTab('spells'); setSelectedSpellKey(`free:${f.key}`); scrollTo(`[data-spell-key="free:${CSS.escape(f.key)}"]`) },
          })),
          ...char.equipment.map((e, idx) => ({
            key: `item:${idx}`, label: e.name, kind: 'Item', sub: e.equipped ? 'Equipped' : undefined,
            go: () => { setTab('inventory'); setInventorySearch(''); setExpandedInventoryItem(idx); scrollTo(`[data-item-idx="${idx}"]`) },
          })),
          ...char.classes.flatMap(cc => {
            const opts = CLASS_OPTIONS[cc.classSlug]
            const sub = opts?.subclasses.find(sc => sc.slug === cc.subclassSlug)
            const clsName = content.classes.find(c => c.slug === cc.classSlug)?.name ?? cc.classSlug
            return [...(opts?.features ?? content.classes.find(c => c.slug === cc.classSlug)?.features ?? []).map(f => ({ f, from: clsName })),
                    ...(sub?.features ?? []).map(f => ({ f, from: sub!.name }))]
              .filter(({ f }) => f.level <= cc.level)
              .map(({ f, from }) => ({
                key: `feature:${featureAnchor(cc.classSlug, f)}`, label: f.name, kind: 'Feature', sub: `${from} ${f.level}`,
                go: () => jumpToFeature(featureAnchor(cc.classSlug, f)),
              }))
          }),
          ...featSlugs.map(slug => ({
            key: `feat:${slug}`, label: content.feats.find(f => f.slug === slug)?.name ?? slug, kind: 'Feat',
            go: () => { setTab('features'); scrollTo('#feats-card') },
          })),
          ...TABS.map(t => ({ key: `tab:${t.key}`, label: t.label, kind: 'Tab', go: () => selectTab(t.key) })),
        ]
        const q = findQuery.trim().toLowerCase()
        const results = (q
          ? hits.filter(h => h.label.toLowerCase().includes(q))
              .sort((a, b) => Number(!a.label.toLowerCase().startsWith(q)) - Number(!b.label.toLowerCase().startsWith(q)) || a.label.localeCompare(b.label))
          : hits.filter(h => h.kind === 'Tab')
        ).filter((h, i, all) => all.findIndex(x => x.key === h.key) === i).slice(0, 12)
        const active = Math.min(findIndex, Math.max(0, results.length - 1))
        const choose = (h: Hit) => { setFindOpen(false); h.go() }
        const KIND_STYLE: Record<string, string> = {
          Spell: 'bg-violet-100 text-violet-700', Item: 'bg-amber-100 text-amber-700',
          Feature: 'bg-indigo-100 text-indigo-700', Feat: 'bg-green-100 text-green-700', Tab: 'bg-parchment-200 text-parchment-700',
        }
        return (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center px-4 pt-24" onMouseDown={() => setFindOpen(false)}>
            <div role="dialog" aria-label="Find on this sheet" onMouseDown={e => e.stopPropagation()}
              className="spell-card-in w-full max-w-lg rounded-xl border border-parchment-300 bg-parchment-50 shadow-2xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 border-b border-parchment-200">
                <SearchIcon className="w-5 h-5 text-parchment-400 shrink-0" />
                <input autoFocus value={findQuery} placeholder="Find a spell, item, feature or feat…" aria-label="Find"
                  onChange={e => { setFindQuery(e.target.value); setFindIndex(0) }}
                  onKeyDown={e => {
                    if (e.key === 'Escape') setFindOpen(false)
                    else if (e.key === 'ArrowDown') { e.preventDefault(); setFindIndex(Math.min(results.length - 1, active + 1)) }
                    else if (e.key === 'ArrowUp') { e.preventDefault(); setFindIndex(Math.max(0, active - 1)) }
                    else if (e.key === 'Enter' && results[active]) choose(results[active])
                  }}
                  className="flex-1 bg-transparent py-3 text-base outline-none placeholder:text-parchment-400" />
                <kbd className="text-[10px] text-parchment-400 border border-parchment-300 rounded px-1.5 py-0.5">Esc</kbd>
              </div>
              <ul className="max-h-80 overflow-y-auto py-1">
                {results.length === 0 && <li className="px-4 py-3 text-sm text-parchment-400">Nothing on this sheet matches “{findQuery}”.</li>}
                {results.map((h, i) => (
                  <li key={h.key}>
                    <button type="button" onClick={() => choose(h)} onMouseEnter={() => setFindIndex(i)}
                      className={`w-full text-left px-4 py-2 flex items-center gap-3 ${i === active ? 'bg-parchment-100' : ''}`}>
                      <span className={`text-[10px] font-bold uppercase tracking-wide rounded px-1.5 py-0.5 w-16 text-center shrink-0 ${KIND_STYLE[h.kind]}`}>{h.kind}</span>
                      <span className="flex-1 min-w-0 truncate text-sm font-semibold text-parchment-900">{h.label}</span>
                      {h.sub && <span className="text-xs text-parchment-500 shrink-0">{h.sub}</span>}
                    </button>
                  </li>
                ))}
              </ul>
              <div className="px-4 py-1.5 border-t border-parchment-200 text-[10px] text-parchment-400 flex gap-3">
                <span>↑↓ to move</span><span>Enter to open</span>
              </div>
            </div>
          </div>
        )
      })()}
      {undo && (
        <div className="fixed inset-x-0 bottom-5 z-40 flex justify-center px-4 pointer-events-none">
          <div key={undo.id} role="status"
            className="undo-toast pointer-events-auto flex items-center gap-3 rounded-full bg-dungeon-900 text-parchment-100 shadow-xl pl-4 pr-1.5 py-1.5 text-sm">
            <span>{undo.message}</span>
            <button type="button" onClick={() => { save(undo.before); setUndo(null) }}
              className="rounded-full px-3 py-1 font-semibold bg-[rgb(var(--accent))] text-[rgb(var(--accent-fg))] hover:brightness-110">Undo</button>
            <button type="button" onClick={() => setUndo(null)} aria-label="Dismiss"
              className="w-7 h-7 rounded-full text-parchment-400 hover:text-parchment-100">✕</button>
          </div>
        </div>
      )}

      {/* Concentration save after taking damage */}
      {concCheck && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card max-w-sm w-full p-5">
            <h2 className="section-header">Concentration Save</h2>
            <p className="text-sm text-parchment-600 mb-4">
              You took {concCheck.damage} damage while concentrating on <strong>{concCheck.spellName}</strong>. Roll a Constitution saving throw.
            </p>
            <div className="flex justify-center gap-6 mb-5 text-center">
              <div>
                <div className="text-xs uppercase tracking-wider text-parchment-500">DC</div>
                <div className="text-3xl font-bold text-parchment-900">{concCheck.dc}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-parchment-500">CON save</div>
                <div className="text-3xl font-bold text-parchment-900">{formatMod(saveMod(effectiveChar, 'con') + itemBonuses.savingThrowBonus + paladinAura)}</div>
              </div>
            </div>
            {featBonuses.concentrationAdvantage && (
              <p className="text-xs text-center text-green-700 -mt-3 mb-4">Roll with advantage (War Caster)</p>
            )}
            <div className="flex gap-2 justify-end">
              <button type="button" className="btn-secondary" onClick={() => { patch({ concentratingOn: undefined }); setConcCheck(null) }}>
                Failed — drop it
              </button>
              <button type="button" className="btn-primary" onClick={() => setConcCheck(null)}>Made it</button>
            </div>
          </div>
        </div>
      )}

      {/* Long Rest modal */}
      {longRestOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card max-w-sm w-full p-5">
            <h2 className="section-header">Long Rest</h2>
            <p className="text-sm text-parchment-600 mb-4">Taking a long rest will fully restore your HP, spell slots, class resources, and recover half your hit dice.</p>
            <ul className="text-xs text-parchment-500 space-y-1 mb-6">
              <li>• HP restored to {maxHp}</li>
              <li>• All spell slots restored</li>
              <li>• All class resources restored</li>
              {char.exhaustionLevel > 0 && <li>• Exhaustion {char.exhaustionLevel} → {char.exhaustionLevel - 1}</li>}
              {char.activePotions.some(p => p.minutes <= 480) && (
                <li>• Potion effects end: {char.activePotions.filter(p => p.minutes <= 480).map(p => p.name).join(', ')}</li>
              )}
              {(() => {
                const totalHd = char.classes.reduce((s, c) => s + c.level, 0)
                const hdRecover = Math.max(1, Math.floor(totalHd / 2))  // half, rounded down, at least 1 (PHB p.186)
                const totalUsed = char.classes.reduce((s, cc) => s + ((char.hitDiceUsed ?? {})[cc.classSlug] ?? 0), 0)
                const actual = Math.min(totalUsed, hdRecover)
                return actual > 0 ? <li>• {actual} hit {actual === 1 ? 'die' : 'dice'} recovered</li> : null
              })()}
            </ul>
            <div className="flex gap-2 justify-end">
              <button className="btn btn-secondary text-sm" onClick={() => setLongRestOpen(false)}>Cancel</button>
              <button
                className="btn btn-primary text-sm"
                onClick={() => {
                  offerUndo('Long rest taken')
                  setRaging(false); setBlessed(false); setSpellsOnYou(new Set())
                  const resets: Record<string, number> = {}
                  longRestResourceKeys(classResources).forEach(k => {
                    const r = classResources.find(x => x.key === k)!
                    resets[k] = r.max ?? (char.classResources?.[k] ?? 0)
                  })
                  // Reset custom resources on long rest
                  ;(char.customResources ?? []).forEach(r => { resets[r.key] = r.max })
                  const freshSlots: Character['spellSlots'] = {}
                  const maxSource = multiclassMaxes ?? Object.fromEntries(
                    Object.entries(char.spellSlots).map(([k, v]) => [k, v.max])
                  )
                  for (const [lvl, max] of Object.entries(maxSource)) {
                    if (max > 0) freshSlots[lvl] = { max, used: 0 }
                  }
                  const totalHd = char.classes.reduce((s, c) => s + c.level, 0)
                  const hdRecover = Math.max(1, Math.floor(totalHd / 2))  // half, rounded down, at least 1 (PHB p.186)
                  // Recover up to half your hit dice, class by class — every class keeps its entry
                  const newHitDiceUsed: Record<string, number> = {}
                  let toRecover = hdRecover
                  for (const cc of char.classes) {
                    const used = (char.hitDiceUsed ?? {})[cc.classSlug] ?? 0
                    const recover = Math.min(used, toRecover)
                    newHitDiceUsed[cc.classSlug] = used - recover
                    toRecover -= recover
                  }
                  patch({
                    hp: { ...char.hp, current: maxHp, temp: 0 },  // temporary HP don't last through a long rest
                    summons: char.summons.filter(s => s.templateKey !== 'wild-shape'),  // Wild Shape has run out
                    classResources: { ...char.classResources, ...resets, 'breath-weapon-used': 0 },
                    spellSlots: freshSlots,
                    hitDiceUsed: newHitDiceUsed,
                    freeSpellUses: {},
                    // A long rest (with food and drink) removes one level of exhaustion
                    exhaustionLevel: Math.max(0, char.exhaustionLevel - 1),
                    // …and takes 8 hours: effects of 8 hours or less run out
                    ...potionsAfterRest(480),
                    pactSlots: char.pactSlots ? { ...char.pactSlots, used: 0 } : undefined,
                    equipment: char.equipment.map(e =>
                      e.rechargesOnLongRest && e.chargesMax !== undefined ? { ...e, charges: e.chargesMax } : e
                    ),
                  })
                  setLongRestOpen(false)
                }}
              >Begin Long Rest</button>
            </div>
          </div>
        </div>
      )}

      {/* Short Rest modal */}
      {shortRestOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card max-w-sm w-full p-5">
            <h2 className="section-header">Short Rest</h2>
            <p className="text-xs text-parchment-500 mb-4">Roll your hit dice physically and enter the result. CON modifier is added automatically.</p>

            {/* Hit dice per class */}
            <div className="space-y-4 mb-4">
              {char.classes.map(cc => {
                const hd = CLASS_OPTIONS[cc.classSlug]?.hitDie ?? content.classes.find(c => c.slug === cc.classSlug)?.hitDie ?? 8
                const used = (char.hitDiceUsed ?? {})[cc.classSlug] ?? 0
                const remaining = cc.level - used
                const spent = shortRestDice[cc.classSlug] ?? 0
                const conMod = abilityModFor(effectiveChar, 'con')
                const rawRoll = parseInt(shortRestRolls[cc.classSlug] ?? '', 10)
                const rollValid = !isNaN(rawRoll) && rawRoll >= spent && rawRoll <= hd * spent
                const heal = rollValid ? rawRoll + conMod * spent : null
                return (
                  <div key={cc.classSlug} className="space-y-2">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-parchment-700 w-16 shrink-0">d{hd}</span>
                      <span className="text-xs text-parchment-400">{remaining} remaining</span>
                      <div className="flex items-center gap-1.5 ml-auto">
                        <button
                          className="w-6 h-6 rounded bg-parchment-200 hover:bg-parchment-300 text-sm font-bold disabled:opacity-40"
                          disabled={spent === 0}
                          onClick={() => {
                            setShortRestDice(d => ({ ...d, [cc.classSlug]: Math.max(0, spent - 1) }))
                            setShortRestRolls(r => ({ ...r, [cc.classSlug]: '' }))
                          }}
                        >−</button>
                        <span className="w-6 text-center text-sm font-semibold">{spent}</span>
                        <button
                          className="w-6 h-6 rounded bg-parchment-200 hover:bg-parchment-300 text-sm font-bold disabled:opacity-40"
                          disabled={spent >= remaining}
                          onClick={() => {
                            setShortRestDice(d => ({ ...d, [cc.classSlug]: Math.min(remaining, spent + 1) }))
                            setShortRestRolls(r => ({ ...r, [cc.classSlug]: '' }))
                          }}
                        >+</button>
                      </div>
                    </div>
                    {spent > 0 && (
                      <div className="flex items-center gap-2 pl-1">
                        <span className="text-xs text-parchment-500 shrink-0">Roll {spent}d{hd}:</span>
                        <input
                          type="number"
                          min={spent}
                          max={hd * spent}
                          placeholder={`${spent}–${hd * spent}`}
                          value={shortRestRolls[cc.classSlug] ?? ''}
                          onChange={e => setShortRestRolls(r => ({ ...r, [cc.classSlug]: e.target.value }))}
                          className="input text-sm py-0.5 w-20 text-center"
                        />
                        {conMod !== 0 && <span className="text-xs text-parchment-400 shrink-0">{conMod > 0 ? `+${conMod * spent}` : conMod * spent} CON</span>}
                        {heal !== null && (
                          <span className="text-xs font-semibold text-green-700 shrink-0 ml-auto">+{heal} HP</span>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Song of Rest: a bard's performance adds a die for anyone who spends hit dice */}
            {char.classes.some(cc => (shortRestDice[cc.classSlug] ?? 0) > 0) && (() => {
              const bard = char.classes.find(c => c.classSlug === 'bard' && c.level >= 2)
              const die = bard ? (bard.level >= 17 ? 'd12' : bard.level >= 13 ? 'd10' : bard.level >= 9 ? 'd8' : 'd6') : null
              return (
                <div className="mb-4 flex items-center gap-2">
                  <span className="text-sm font-medium text-parchment-700">Song of Rest</span>
                  <span className="text-xs text-parchment-400">{die ? `roll your ${die}` : 'if a bard performed'}</span>
                  <input type="number" min={1} max={12} placeholder="roll" value={songOfRestRoll} aria-label="Song of Rest roll"
                    onChange={e => setSongOfRestRoll(e.target.value)} className="input text-sm py-0.5 w-16 text-center ml-auto" />
                </div>
              )
            })()}

            {/* Arcane Recovery (wizard) / Natural Recovery (Circle of the Land): spent slots back, once a day */}
            {(() => {
              const rec = classResources.find(r => (r.key === 'arcane-recovery' || r.key === 'natural-recovery') && r.current > 0)
              if (!rec) return null
              const budget = Math.ceil((char.classes.find(c => c.classSlug === rec.classSlug)?.level ?? 0) / 2)
              const chosen = Object.entries(recoverSlots).reduce((n, [l, c]) => n + Number(l) * c, 0)
              const spentLevels = [1, 2, 3, 4, 5].filter(l => (char.spellSlots[String(l)]?.used ?? 0) > 0)
              const ord = ['', '1st', '2nd', '3rd', '4th', '5th']
              return (
                <div className="mb-4 rounded-lg border border-violet-200 bg-violet-50 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-violet-800">{rec.name}</span>
                    <span className="text-xs text-violet-700 tabular-nums">{chosen} / {budget} slot levels</span>
                  </div>
                  <p className="text-[11px] text-violet-700 mb-2">Once a day: get back spent slots worth up to {budget} levels in all, none above 5th.</p>
                  {spentLevels.length === 0 && <p className="text-xs italic text-violet-600">No spent slots to get back.</p>}
                  {spentLevels.map(l => {
                    const used = char.spellSlots[String(l)]!.used
                    const n = recoverSlots[String(l)] ?? 0
                    return (
                      <div key={l} className="flex items-center gap-2 py-0.5 text-sm">
                        <span className="w-10 font-medium text-violet-900">{ord[l]}</span>
                        <span className="text-xs text-violet-600">{used} spent</span>
                        <div className="flex items-center gap-1.5 ml-auto">
                          <button type="button" aria-label={`One fewer ${ord[l]}-level slot`} disabled={n === 0}
                            onClick={() => setRecoverSlots(r => ({ ...r, [String(l)]: n - 1 }))}
                            className="w-6 h-6 rounded bg-violet-100 hover:bg-violet-200 text-sm font-bold disabled:opacity-40">−</button>
                          <span className="w-5 text-center font-semibold">{n}</span>
                          <button type="button" aria-label={`Get back a ${ord[l]}-level slot`} disabled={n >= used || chosen + l > budget}
                            onClick={() => setRecoverSlots(r => ({ ...r, [String(l)]: n + 1 }))}
                            className="w-6 h-6 rounded bg-violet-100 hover:bg-violet-200 text-sm font-bold disabled:opacity-40">+</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })()}

            {/* Total recovery */}
            {(() => {
              const conMod = abilityModFor(effectiveChar, 'con')
              const totalHeal = char.classes.reduce((sum, cc) => {
                const spent = shortRestDice[cc.classSlug] ?? 0
                if (spent === 0) return sum
                const raw = parseInt(shortRestRolls[cc.classSlug] ?? '', 10)
                if (isNaN(raw)) return sum
                return sum + raw + conMod * spent
              }, 0) + (parseInt(songOfRestRoll, 10) > 0 ? parseInt(songOfRestRoll, 10) : 0)
              const anySpent = char.classes.some(cc => (shortRestDice[cc.classSlug] ?? 0) > 0)
              const newHp = Math.min(maxHp, char.hp.current + totalHeal)
              return anySpent && totalHeal > 0 ? (
                <p className="text-sm font-semibold text-green-700 mb-4">
                  Total: +{totalHeal} HP → {newHp} / {maxHp}
                </p>
              ) : null
            })()}

            <div className="flex gap-2 justify-end">
              <button className="btn btn-secondary text-sm" onClick={() => { setShortRestOpen(false); setShortRestDice({}); setShortRestRolls({}); setRecoverSlots({}); setSongOfRestRoll('') }}>Cancel</button>
              <button
                className="btn btn-primary text-sm disabled:opacity-50"
                // Dice marked as spent need their roll entered, or they'd be used up for nothing
                disabled={char.classes.some(cc => {
                  const spent = shortRestDice[cc.classSlug] ?? 0
                  const hd = CLASS_OPTIONS[cc.classSlug]?.hitDie ?? content.classes.find(c => c.slug === cc.classSlug)?.hitDie ?? 8
                  const raw = parseInt(shortRestRolls[cc.classSlug] ?? '', 10)
                  return spent > 0 && !(raw >= spent && raw <= hd * spent)
                })}
                onClick={() => {
                  offerUndo('Short rest taken')
                  // An hour's rest: Mage Armor (8 hours) lasts, the shorter spells end
                  setRaging(false); setBlessed(false); setSpellsOnYou(prev => new Set([...prev].filter(k => k === 'mage-armor')))
                  const conMod = abilityModFor(effectiveChar, 'con')
                  const totalHeal = Math.max(0, char.classes.reduce((sum, cc) => {
                    const spent = shortRestDice[cc.classSlug] ?? 0
                    if (spent === 0) return sum
                    const raw = parseInt(shortRestRolls[cc.classSlug] ?? '', 10)
                    if (isNaN(raw)) return sum
                    return sum + raw + conMod * spent
                  }, 0)) + (Object.values(shortRestDice).some(n => n > 0) && parseInt(songOfRestRoll, 10) > 0 ? parseInt(songOfRestRoll, 10) : 0)
                  // Arcane / Natural Recovery: the slots picked come back, and the feature is used for the day
                  const rec = classResources.find(r => (r.key === 'arcane-recovery' || r.key === 'natural-recovery') && r.current > 0)
                  const recovering = Object.entries(recoverSlots).filter(([, n]) => n > 0)
                  const recoveredSlots = rec && recovering.length
                    ? Object.fromEntries(Object.entries(char.spellSlots).map(([l, sl]) => [l, { ...sl, used: Math.max(0, sl.used - (recoverSlots[l] ?? 0)) }]))
                    : null
                  const newHitDiceUsed: Record<string, number> = { ...(char.hitDiceUsed ?? {}) }
                  for (const [slug, spent] of Object.entries(shortRestDice)) {
                    if (spent > 0) newHitDiceUsed[slug] = (newHitDiceUsed[slug] ?? 0) + spent
                  }
                  const resets: Record<string, number> = {}
                  shortRestResourceKeys(classResources).forEach(k => {
                    const r = classResources.find(x => x.key === k)!
                    resets[k] = r.max ?? (char.classResources?.[k] ?? 0)
                  })
                  // Reset short-rest custom resources
                  ;(char.customResources ?? []).filter(r => r.recharge === 'short').forEach(r => { resets[r.key] = r.max })
                  patch({
                    hp: { ...char.hp, current: Math.min(maxHp, char.hp.current + totalHeal) },
                    hitDiceUsed: newHitDiceUsed,
                    classResources: { ...char.classResources, ...resets, 'breath-weapon-used': 0, ...(recoveredSlots && rec ? { [rec.key]: 0 } : {}) },
                    // Wild Shape lasts half the druid level in hours: an hour's rest ends a one-hour form
                    ...(wildShapeForm && Math.floor((char.classes.find(c => c.classSlug === 'druid')?.level ?? 0) / 2) <= 1
                      ? { summons: char.summons.filter(s => s.templateKey !== 'wild-shape') } : {}),
                    ...(recoveredSlots ? { spellSlots: recoveredSlots } : {}),
                    ...(char.pactSlots ? { pactSlots: { ...char.pactSlots, used: 0 } } : {}),
                    // A short rest takes an hour: effects of an hour or less run out
                    ...potionsAfterRest(60),
                  })
                  setShortRestOpen(false)
                  setShortRestDice({})
                  setShortRestRolls({})
                  setRecoverSlots({})
                  setSongOfRestRoll('')
                }}
              >Finish Rest</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Feat modal */}
      {addFeatOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-parchment-50 rounded-lg shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-parchment-200">
              <h3 className="font-semibold text-parchment-900">Add Feat</h3>
              <button type="button" className="text-parchment-400 hover:text-parchment-700 text-xl leading-none"
                onClick={() => setAddFeatOpen(false)}>✕</button>
            </div>
            <div className="p-3 border-b border-parchment-200">
              <input
                autoFocus
                type="text"
                placeholder="Search feats..."
                className="w-full border border-parchment-300 rounded px-3 py-2 text-sm bg-parchment-50 focus:outline-none focus:ring-1 focus:ring-parchment-500"
                value={addFeatSearch}
                onChange={e => setAddFeatSearch(e.target.value)}
              />
            </div>
            {(() => {
              // Half-feat or spell-granting feat chosen: its +1 and spell picks before adding it
              const pending = content.feats.find(f => f.slug === addFeatPending)
              if (!pending) return null
              const pick = featAbilityPick(pending, addFeatAbility)
              const confirmAdd = () => {
                const key = `feat-manual-${Date.now()}`
                const grantPatch = { spells: [...char.spells], freeSpellUses: { ...char.freeSpellUses } }
                const resolved = addFeatClass ? withFeatClassChoice(pending, addFeatClass) : pending
                for (const p of resolveFeatGrants(resolved, content.spells)) {
                  const picks = addFeatGrants[p.storageKey] ?? []
                  if (picks.length > 0) applyGrantPicks(grantPatch, p, picks, pending)
                }
                patch({
                  featuresChosen: [...char.featuresChosen, { key, value: pending.slug }],
                  ...grantPatch,
                  ...(pending.abilityScoreIncrease ? (() => {
                    const inc = applyFeatAbilityIncrease(char, pending, addFeatAbility)
                    // Unticked: the player already raised the score by hand, so only the baseline catches up
                    return addFeatApplyAsi ? { ...inc, ...shiftBaselines(char, inc) } : shiftBaselines(char, inc)
                  })() : {}),
                })
                setAddFeatPending(null); setAddFeatAbility(''); setAddFeatOpen(false)
              }
              return (
                <div className="p-3 bg-parchment-50 overflow-y-auto flex-1 min-h-0">
                  {pending.abilityScoreIncrease && (
                    <>
                      <FeatAbilityPicker feat={pending} scores={char.abilityScores} value={addFeatAbility} onChange={setAddFeatAbility} />
                      <label className="flex items-center gap-2 text-xs text-parchment-600 mt-2 cursor-pointer">
                        <input type="checkbox" checked={addFeatApplyAsi} onChange={e => setAddFeatApplyAsi(e.target.checked)} />
                        Apply the +1 now (untick if you already raised the score yourself)
                      </label>
                    </>
                  )}
                  <FeatGrantsBlock feat={pending} spells={content.spells} classChoice={addFeatClass} setClassChoice={setAddFeatClass}
                    picks={addFeatGrants} setPicks={setAddFeatGrants} />
                  <div className="flex justify-end gap-2 mt-3">
                    <button type="button" className="btn-secondary text-sm" onClick={() => { setAddFeatPending(null); setAddFeatAbility('') }}>Back</button>
                    <button type="button" className="btn-primary text-sm disabled:opacity-50" disabled={!!pending.abilityScoreIncrease && addFeatApplyAsi && !pick} onClick={confirmAdd}>Add {pending.name}</button>
                  </div>
                </div>
              )
            })()}
            {!addFeatPending && <div className="overflow-y-auto flex-1 p-2">
              {content.feats
                .filter(f => {
                  if (addFeatSearch && !f.name.toLowerCase().includes(addFeatSearch.toLowerCase())) return false
                  return true
                })
                .sort((a, b) => a.name.localeCompare(b.name))
                .map(f => {
                  const alreadyHas = char.featuresChosen.some(fc =>
                    (fc.key === 'feat-l1' || fc.key.startsWith('feat-')) &&
                    (fc.value === f.slug || (Array.isArray(fc.value) && fc.value[0] === f.slug))
                  )
                  return (
                    <button
                      key={f.slug}
                      type="button"
                      disabled={alreadyHas}
                      className={`w-full text-left px-3 py-2 rounded mb-1 transition-colors ${
                        alreadyHas
                          ? 'opacity-40 cursor-not-allowed bg-parchment-100'
                          : 'hover:bg-parchment-200 bg-parchment-50 border border-parchment-100'
                      }`}
                      onClick={() => {
                        if (alreadyHas) return
                        if (f.abilityScoreIncrease || f.grantsSpells) {
                          setAddFeatPending(f.slug); setAddFeatAbility(''); setAddFeatApplyAsi(true)
                          setAddFeatClass(''); setAddFeatGrants({})
                          return
                        }
                        const key = `feat-manual-${Date.now()}`
                        patch({ featuresChosen: [...char.featuresChosen, { key, value: f.slug }] })
                        setAddFeatOpen(false)
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{f.name}</span>
                        {alreadyHas && <span className="text-xs text-parchment-400 italic">already chosen</span>}
                      </div>
                      {f.prerequisite && (
                        <div className="text-xs text-parchment-400 mt-0.5">Prereq: {f.prerequisite}</div>
                      )}
                      {f.description && (
                        <div className="text-xs text-parchment-500 mt-0.5 line-clamp-2">{f.description}</div>
                      )}
                    </button>
                  )
                })}
            </div>}
          </div>
        </div>
      )}
    </div>
    </SheetContext.Provider>
  )
}
