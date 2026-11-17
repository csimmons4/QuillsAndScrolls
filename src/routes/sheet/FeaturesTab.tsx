import { Summon, SKILLS, SKILL_LABELS } from '../../character/model'
import { abilityModFor, profBonus, spellSaveDC, spellAttackBonus, monkSpeedBonus, initiativeBonus } from '../../character/derive'
import { CLASS_OPTIONS, ELDRITCH_INVOCATIONS, METAMAGIC_OPTIONS, ARTIFICER_INFUSIONS, findInfusion, RUNE_KNIGHT_RUNES, HUNTER_CHOICES, TOTEM_ANIMALS, STORM_AURA_OPTIONS, FOUR_ELEMENTS_DISCIPLINES, BATTLE_MASTER_MANEUVERS } from '../../data/classData'
import { asiLevelsForClass } from '../../character/levelUp'
import { DRACONIC_ANCESTRIES, RACE_OPTIONS } from '../../data/raceData'
import { STRIXHAVEN_COLLEGES } from '../../data/strixhavenSpells'
import { ABILITY_LABELS, fightingStyles, toSkillKey } from './helpers'
import { useSheet } from './SheetContext'

/** The Features tab: level journey, class and subclass features, race traits, feats and background */
export function FeaturesTab() {
  const {
    id,
    content,
    char,
    setTab,
    journeyOpen,
    setJourneyOpen,
    setOpenFeatures,
    allFeaturesOpen,
    setAllFeaturesOpen,
    setAddFeatOpen,
    setAddFeatSearch,
    setAddFeatPending,
    save,
    offerUndo,
    patch,
    level,
    pb,
    itemBonuses,
    effectiveChar,
    raceDef,
    effectiveCharSkills,
    ac,
    initiative,
    passive,
    speed,
    sneakDice,
    skillBaseProf,
    skillBaseExpert,
    classResources,
    featureAnchor,
    resourcesAt,
    featureTrackers,
    featureText,
    resistances,
  } = useSheet()
  return (
    <div className="flex flex-col gap-4">
      {/* Class Expertise (Rogue 1/6, Bard 3/10) owed but never picked — e.g. a character made
          above level 1, or levelled before the level-up wizard asked for it */}
      {(() => {
        const owed = char.classes.reduce((n, cc) => {
          const o = CLASS_OPTIONS[cc.classSlug]
          return n + (o?.expertiseAt ?? []).filter(l => l <= cc.level).length * (o?.expertiseCount ?? 2)
        }, 0)
        if (!owed) return null
        const TOOLS_KEY = 'expertise-thieves-tools'
        const featPicks = char.featuresChosen
          .filter(f => f.key.startsWith('feat-expertise-'))
          .flatMap(f => Array.isArray(f.value) ? f.value : [f.value]).length
        const toolPicked = char.featuresChosen.some(f => f.key === TOOLS_KEY)
        const missing = owed - (char.skillExpertise.length - featPicks + (toolPicked ? 1 : 0))
        if (missing <= 0) return null
        const canPickTools = char.classes.some(c => c.classSlug === 'rogue') && !toolPicked
          && char.toolProficiencies.some(t => /thieves/i.test(t))
        const pick = (skill: string) => patch({
          skillExpertise: [...new Set([...char.skillExpertise, skill])],
          // An official class pick, not a hand edit — record it in the skill baseline
          skillBaseline: { proficiencies: [...skillBaseProf], expertise: [...new Set([...skillBaseExpert, skill])] },
        })
        return (
          <div className="card border-amber-300 bg-amber-50">
            <h3 className="font-bold text-amber-800 text-sm mb-1">Expertise</h3>
            <p className="text-xs text-amber-700 mb-2">
              Choose {missing} more proficient skill{missing !== 1 ? 's' : ''} to double your proficiency bonus for.
            </p>
            <div className="flex flex-wrap gap-1">
              {SKILLS.filter(s => effectiveCharSkills.skillProficiencies.includes(s) && !char.skillExpertise.includes(s)).map(s => (
                <button key={s} type="button" onClick={() => pick(s)}
                  className="text-xs bg-parchment-50 border border-amber-300 text-amber-800 rounded px-2 py-0.5 hover:bg-amber-100"
                >{SKILL_LABELS[s]}</button>
              ))}
              {canPickTools && (
                <button type="button" onClick={() => patch({ featuresChosen: [...char.featuresChosen, { key: TOOLS_KEY, value: 'thieves-tools' }] })}
                  className="text-xs bg-parchment-50 border border-amber-300 text-amber-800 rounded px-2 py-0.5 hover:bg-amber-100"
                >Thieves' Tools</button>
              )}
            </div>
          </div>
        )
      })()}

      {/* College of Lore (Bard 3): Bonus Proficiencies — three skills of your choice */}
      {(() => {
        const lore = char.classes.find(c => c.classSlug === 'bard' && c.subclassSlug === 'lore' && c.level >= 3)
        if (!lore) return null
        const KEY = 'lore-bonus-skills'
        const fc = char.featuresChosen.find(f => f.key === KEY)
        const chosen = fc ? (Array.isArray(fc.value) ? fc.value : [fc.value]) : []
        if (chosen.length >= 3) return null
        const pick = (skill: string) => {
          const next = [...chosen, skill]
          patch({
            featuresChosen: [...char.featuresChosen.filter(f => f.key !== KEY), { key: KEY, value: next }],
            skillProficiencies: [...new Set([...char.skillProficiencies, skill])],
            // An official class pick, not a hand edit — record it in the skill baseline
            skillBaseline: { proficiencies: [...new Set([...skillBaseProf, skill])], expertise: [...skillBaseExpert] },
          })
        }
        return (
          <div className="card border-amber-300 bg-amber-50">
            <h3 className="font-bold text-amber-800 text-sm mb-1">College of Lore: Bonus Proficiencies</h3>
            <p className="text-xs text-amber-700 mb-2">
              Choose {3 - chosen.length} more skill{3 - chosen.length !== 1 ? 's' : ''} to become proficient in
              {chosen.length > 0 && <> (chosen: {chosen.map(s => SKILL_LABELS[s as keyof typeof SKILL_LABELS] ?? s).join(', ')})</>}.
            </p>
            <div className="flex flex-wrap gap-1">
              {SKILLS.filter(s => !effectiveCharSkills.skillProficiencies.includes(s)).map(s => (
                <button key={s} type="button" onClick={() => pick(s)}
                  className="text-xs bg-parchment-50 border border-amber-300 text-amber-800 rounded px-2 py-0.5 hover:bg-amber-100"
                >{SKILL_LABELS[s]}</button>
              ))}
            </div>
          </div>
        )
      })()}

      {/* Config warnings */}
      {(() => {
        const warnings: string[] = []
        // Race enrichment
        if (char.raceSlug && !RACE_OPTIONS[char.raceSlug]) {
          const raceName = content.races.find(r => r.slug === char.raceSlug)?.name ?? char.raceSlug
          warnings.push(`Race "${raceName}" has no enrichment data — ability bonuses and proficiencies may be missing. Add an entry to RACE_OPTIONS in src/data/raceData.ts.`)
        }
        // Class config and subclass config
        for (const cc of char.classes) {
          const opts = CLASS_OPTIONS[cc.classSlug]
          const clsName = content.classes.find(c => c.slug === cc.classSlug)?.name ?? cc.classSlug
          if (!opts) {
            warnings.push(`Class "${clsName}" has no CLASS_OPTIONS entry — features and spellcasting will be empty. Add it to src/data/classData.ts.`)
          } else if (cc.subclassSlug && !opts.subclasses.find(s => s.slug === cc.subclassSlug)) {
            warnings.push(`Subclass "${cc.subclassSlug}" is not listed under ${clsName} in CLASS_OPTIONS — subclass features won't display. Add it to src/data/classData.ts.`)
          }
        }
        if (warnings.length === 0) return null
        return (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 space-y-1">
            <div className="text-xs font-semibold text-amber-800 uppercase tracking-wide mb-1">⚠ Data Gaps Detected</div>
            {warnings.map((w, i) => (
              <p key={i} className="text-xs text-amber-800">{w}</p>
            ))}
          </div>
        )
      })()}
      {/* Level Journey */}
      {(() => {
        const ABILITY_SHORT: Record<string, string> = { str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA' }

        // Build a per-class level history
        const classJourneys = char.classes.map(cc => {
          const opts = CLASS_OPTIONS[cc.classSlug]
          const clsContent = content.classes.find(c => c.slug === cc.classSlug)
          const clsName = clsContent?.name ?? cc.classSlug
          const hitDie = opts?.hitDie ?? clsContent?.hitDie ?? 8
          const asiLevels = asiLevelsForClass(cc.classSlug)
          const expertiseLevels = opts?.expertiseAt ?? []
          const expertiseCount = opts?.expertiseCount ?? 2

          // Feats for this class: key = feat-{classSlug}-{timestamp}
          const featEntries = char.featuresChosen
            .filter(fc => typeof fc.key === 'string' && fc.key.startsWith(`feat-${cc.classSlug}-`))
            .map(fc => {
              const ts = parseInt(fc.key.split('-').pop() ?? '0', 10)
              const slug = typeof fc.value === 'string' ? fc.value : ''
              const featName = content.feats.find(f => f.slug === slug)?.name ?? slug
              return { ts, slug, featName }
            })
            .sort((a, b) => a.ts - b.ts)

          // Feats are also stored with newer key format: feat-{classSlug}-{level}-{timestamp}
          // Handle both formats
          const featEntriesAlt = char.featuresChosen
            .filter(fc => {
              if (typeof fc.key !== 'string') return false
              if (!fc.key.startsWith('feat-')) return false
              // Exclude keys already captured above
              return !fc.key.startsWith(`feat-${cc.classSlug}-`) && fc.key.includes(cc.classSlug)
            })
            .map(fc => {
              const slug = typeof fc.value === 'string' ? fc.value : ''
              const featName = content.feats.find(f => f.slug === slug)?.name ?? slug
              return { ts: 0, slug, featName }
            })

          const allFeatEntries = [...featEntries, ...featEntriesAlt]

          // Expertise per level: distribute skills across expertise levels evenly
          const expertiseSkillsForLevel = (levelIdx: number): string[] => {
            if (expertiseLevels.length === 0) return []
            const lvl = expertiseLevels[levelIdx]
            if (!lvl) return []
            const allExpert = char.skillExpertise
            // Distribute: first expertiseCount skills at first expertise level, next at second, etc.
            const start = levelIdx * expertiseCount
            const slice = allExpert.slice(start, start + expertiseCount)
            return slice
          }

          // Fighting style
          // Creator stores 'fighting-style'; level-ups store 'fighting-style-<class>'
          const fightingStyleChoice = char.featuresChosen.find(fc => fc.key === `fighting-style-${cc.classSlug}`)
            ?? (cc === char.classes[0] ? char.featuresChosen.find(fc => fc.key === 'fighting-style') : undefined)
          const fightingStyleValue = typeof fightingStyleChoice?.value === 'string' ? fightingStyleChoice.value : null
          const fightingStyleDef = opts?.fightingStyles?.find(fs => fs.slug === fightingStyleValue)

          // Subclass info
          const subclassAtLevel = opts?.subclasses.find(s => s.slug === cc.subclassSlug)?.level ?? 3

          const rows: Array<{
            level: number
            hpRoll: number | null
            features: string[]
            subclassName: string | null
            subclassFeatures: string[]
            asiOrFeat: { kind: 'asi'; note: string } | { kind: 'feat'; name: string; slug: string } | null
            expertiseSkills: string[]
            fightingStyleName: string | null
          }> = []

          let featIdx = 0
          let asiCount = 0

          for (let lvl = 1; lvl <= cc.level; lvl++) {
            const hpRoll = cc.hitDieRolls[lvl - 1] ?? null
            const classFeatures = (opts?.features ?? []).filter(f => f.level === lvl).map(f => f.name)
            const isAsiLevel = asiLevels.includes(lvl)
            const isSubclassLevel = cc.subclassSlug && lvl === subclassAtLevel
            // Subclass features come at several levels (Artillerist: 3, 5, 9, 15), not only the first
            const subclassDef = cc.subclassSlug ? opts?.subclasses.find(s => s.slug === cc.subclassSlug) : null
            const subclassFeatureNames = subclassDef?.features?.filter(f => f.level === lvl).map(f => f.name) ?? []
            const isFightingStyleLevel = classFeatures.some(f => f.toLowerCase().includes('fighting style'))
            const expertiseLevelIdx = expertiseLevels.indexOf(lvl)

            let asiOrFeat: typeof rows[0]['asiOrFeat'] = null
            if (isAsiLevel) {
              const feat = allFeatEntries[featIdx]
              if (feat) {
                asiOrFeat = { kind: 'feat', name: feat.featName, slug: feat.slug }
                featIdx++
              } else {
                asiOrFeat = { kind: 'asi', note: `ASI #${++asiCount}` }
              }
            }

            rows.push({
              level: lvl,
              hpRoll,
              features: classFeatures,
              subclassName: isSubclassLevel ? (subclassDef?.name ?? null) : null,
              subclassFeatures: subclassFeatureNames,
              asiOrFeat,
              expertiseSkills: expertiseLevelIdx >= 0 ? expertiseSkillsForLevel(expertiseLevelIdx) : [],
              fightingStyleName: isFightingStyleLevel && fightingStyleDef ? fightingStyleDef.name : null,
            })
          }

          return { clsName, hitDie, rows, cc }
        })

        return (
          <div className="card overflow-hidden order-0">
            <button
              type="button"
              onClick={() => setJourneyOpen(o => !o)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-parchment-50"
            >
              <h2 className="section-header mb-0">Level Journey</h2>
              <span className="text-parchment-400 text-sm">{journeyOpen ? '▲' : '▼'}</span>
            </button>
            {journeyOpen && (
              <div className="px-4 pb-4 space-y-5 border-t border-parchment-100 pt-3">
                {classJourneys.map(({ clsName, hitDie, rows, cc }) => (
                  <div key={cc.classSlug}>
                    {char.classes.length > 1 && (
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-bold text-parchment-600 uppercase tracking-wider">{clsName}</span>
                        <div className="flex-1 h-px bg-parchment-200" />
                        {cc.subclassSlug && (
                          <span className="text-xs text-parchment-500">{CLASS_OPTIONS[cc.classSlug]?.subclasses.find(s => s.slug === cc.subclassSlug)?.name ?? cc.subclassSlug}</span>
                        )}
                      </div>
                    )}
                    <div className="space-y-1.5">
                      {rows.map(row => {
                        const hasContent = row.features.length > 0 || row.subclassName || row.subclassFeatures.length > 0 || row.asiOrFeat || row.expertiseSkills.length > 0 || row.fightingStyleName
                        return (
                          <div key={row.level} className={`flex gap-3 text-sm rounded-lg px-3 py-2 ${row.subclassName ? 'bg-purple-50 border border-purple-100' : row.asiOrFeat?.kind === 'feat' ? 'bg-amber-50 border border-amber-100' : row.asiOrFeat?.kind === 'asi' ? 'bg-blue-50 border border-blue-100' : 'bg-parchment-50'}`}>
                            {/* Level badge */}
                            <div className="shrink-0 flex flex-col items-center gap-0.5 w-10">
                              <span className="text-xs font-bold text-parchment-500 leading-none">Lv</span>
                              <span className="text-lg font-bold text-parchment-800 leading-none">{row.level}</span>
                            </div>
                            {/* Content */}
                            <div className="flex-1 min-w-0 space-y-1 py-0.5">
                              {/* HP */}
                              <div className="flex items-center gap-2 flex-wrap">
                                {row.hpRoll !== null && (
                                  <span className={`text-xs font-semibold rounded px-1.5 py-0.5 ${row.level === 1 ? 'bg-red-100 text-red-700' : 'bg-parchment-100 text-parchment-600'}`}>
                                    {row.level === 1 ? `HP: ${row.hpRoll}` : `+${row.hpRoll} HP`}
                                    {row.level === 1 && <span className="font-normal text-red-500 ml-0.5">(d{hitDie} max)</span>}
                                  </span>
                                )}
                                {/* Subclass */}
                                {row.subclassName && (
                                  <span className="text-xs font-semibold bg-purple-200 text-purple-800 rounded px-1.5 py-0.5">
                                    {row.subclassName}
                                  </span>
                                )}
                                {/* ASI or Feat */}
                                {row.asiOrFeat?.kind === 'feat' && (
                                  <span className="text-xs font-semibold bg-amber-200 text-amber-800 rounded px-1.5 py-0.5" title={`Feat: ${row.asiOrFeat.slug}`}>
                                    Feat: {row.asiOrFeat.name}
                                  </span>
                                )}
                                {row.asiOrFeat?.kind === 'asi' && (
                                  <span className="text-xs font-semibold bg-blue-200 text-blue-800 rounded px-1.5 py-0.5">
                                    Ability Score Improvement
                                  </span>
                                )}
                                {/* Fighting style */}
                                {row.fightingStyleName && (
                                  <span className="text-xs bg-slate-100 text-slate-700 rounded px-1.5 py-0.5">
                                    Style: {row.fightingStyleName}
                                  </span>
                                )}
                                {/* Expertise */}
                                {row.expertiseSkills.length > 0 && (
                                  <span className="text-xs bg-indigo-100 text-indigo-700 rounded px-1.5 py-0.5">
                                    Expertise: {row.expertiseSkills.map(s => SKILL_LABELS[s as keyof typeof SKILL_LABELS] ?? s).join(', ')}
                                  </span>
                                )}
                              </div>
                              {/* Class + subclass features */}
                              {(row.features.length > 0 || row.subclassFeatures.length > 0) && (
                                <div className="flex flex-wrap gap-1">
                                  {row.features.map(f => (
                                    <span key={f} className="text-[11px] text-parchment-600 bg-parchment-100 rounded px-1.5 py-0.5">{f}</span>
                                  ))}
                                  {row.subclassFeatures.map(f => (
                                    <span key={f} className="text-[11px] text-purple-700 bg-purple-100 rounded px-1.5 py-0.5">{f}</span>
                                  ))}
                                </div>
                              )}
                              {!hasContent && <span className="text-xs text-parchment-300 italic">—</span>}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })()}

      {/* Race features */}
      {(() => {
        const race = content.races.find(r => r.slug === char.raceSlug)
        if (!race) return null
        const featSubraceOpts = raceDef?.subraces?.find(s => s.slug === char.subraceSlug)
        const dragonChoice = char.featuresChosen.find(fc => fc.key === 'dragonborn-ancestry')
        const dragonSlug = typeof dragonChoice?.value === 'string' ? dragonChoice.value : null
        const dragonInfo = dragonSlug ? DRACONIC_ANCESTRIES.find(d => d.slug === dragonSlug) : null
        return (
          <div className="card order-2">
            <div className="flex items-center gap-2 mb-3">
              <h2 className="section-header mb-0">{race.name} Traits</h2>
              {featSubraceOpts && <span className="text-sm text-parchment-500 font-medium">— {featSubraceOpts.name}</span>}
              {race.size && <span className="text-xs bg-parchment-100 text-parchment-600 rounded px-2 py-0.5">{race.size}</span>}
              {race.speed > 0 && <span className="text-xs bg-parchment-100 text-parchment-600 rounded px-2 py-0.5">{race.speed}ft speed</span>}
            </div>
            {/* Ability bonuses */}
            {(race.abilityBonuses && Object.keys(race.abilityBonuses).length > 0 || race.chooseAbilityBonuses) && (
              <div className="flex flex-wrap gap-1 mb-3">
                {Object.entries(race.abilityBonuses ?? {}).map(([ab, val]) => (
                  <span key={ab} className="text-xs bg-green-100 text-green-700 border border-green-300 rounded px-2 py-0.5 font-semibold">
                    +{val} {ABILITY_LABELS[ab] ?? ab.toUpperCase()}
                  </span>
                ))}
                {race.chooseAbilityBonuses ? (
                  <span className="text-xs bg-green-100 text-green-700 border border-green-300 rounded px-2 py-0.5">
                    +1 to {race.chooseAbilityBonuses} ability score{race.chooseAbilityBonuses !== 1 ? 's' : ''} of choice
                  </span>
                ) : null}
              </div>
            )}
            {/* Granted skill proficiencies */}
            {race.grantedSkills && race.grantedSkills.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-3 items-center">
                <span className="text-xs text-parchment-500">Prof:</span>
                {race.grantedSkills.map(s => (
                  <span key={s} className="text-xs bg-indigo-100 text-indigo-700 border border-indigo-200 rounded px-2 py-0.5 capitalize">{s}</span>
                ))}
              </div>
            )}
            {/* Languages */}
            {(race.grantedLanguages ?? race.languages).length > 0 && (
              <p className="text-xs text-parchment-400 mb-3">Languages: {(race.grantedLanguages ?? race.languages).join(', ')}</p>
            )}
            {/* Innate spells from race */}
            {race.grantedSpells && race.grantedSpells.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-3 items-center">
                <span className="text-xs text-parchment-500">Innate Spells:</span>
                {race.grantedSpells.map(s => (
                  <span key={s.slug} className="text-xs bg-violet-100 text-violet-700 border border-violet-200 rounded px-2 py-0.5">
                    {s.name}{s.usesPerLongRest ? ` (${s.usesPerLongRest}/LR)` : ' (at will)'}
                  </span>
                ))}
              </div>
            )}
            {(() => {
              const traitList = (race.traits.length > 0 ? race.traits : null)
                ?? race.traits
                  .filter(t => t.endsWith('.') && t !== 'Ability Score Increase.' && t !== 'Alignment.')
                  .map(t => t.slice(0, -1))
              if (traitList.length === 0) return null
              return (
                <div className="space-y-1.5 mb-3">
                  {traitList.map((t, i) => (
                    <div key={t} className="px-2.5 py-1.5 rounded border border-parchment-100">{featureText(`race-trait-${i}`, t)}</div>
                  ))}
                </div>
              )
            })()}
            {/* Subrace traits */}
            {featSubraceOpts && (featSubraceOpts.traits.length > 0 || (featSubraceOpts.abilityBonuses && Object.keys(featSubraceOpts.abilityBonuses).length > 0)) && (
              <div className="mb-3">
                <div className="text-xs uppercase text-parchment-500 mb-1">{featSubraceOpts.name} Traits</div>
                {featSubraceOpts.abilityBonuses && Object.keys(featSubraceOpts.abilityBonuses).length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {Object.entries(featSubraceOpts.abilityBonuses).map(([ab, val]) => (
                      <span key={ab} className="text-xs bg-green-100 text-green-700 border border-green-300 rounded px-2 py-0.5 font-semibold">
                        +{val} {ABILITY_LABELS[ab] ?? ab.toUpperCase()}
                      </span>
                    ))}
                  </div>
                )}
                {featSubraceOpts.traits.length > 0 && (
                  <div className="space-y-1.5">
                    {featSubraceOpts.traits.map((t, i) => (
                      <div key={t} className="px-2.5 py-1.5 rounded border border-amber-200 bg-amber-50">{featureText(`subrace-trait-${i}`, t)}</div>
                    ))}
                  </div>
                )}
                {featSubraceOpts.grantedSpells && featSubraceOpts.grantedSpells.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2 items-center">
                    <span className="text-xs text-parchment-500">Innate Spells:</span>
                    {featSubraceOpts.grantedSpells.map(s => (
                      <span key={s.slug} className="text-xs bg-violet-100 text-violet-700 border border-violet-200 rounded px-2 py-0.5">
                        {s.name}{s.usesPerLongRest ? ` (${s.usesPerLongRest}/LR)` : ' (at will)'}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
            {/* Dragonborn ancestry */}
            {dragonInfo && (
              <div className="p-2 rounded border border-parchment-200 bg-parchment-50 text-sm">
                <span className="font-medium">Draconic Ancestry: {dragonInfo.name}</span>
                <span className="text-parchment-500 ml-2">— {dragonInfo.damageType} damage, {dragonInfo.breathShape} breath weapon</span>
              </div>
            )}
          </div>
        )
      })()}

      {/* Class features */}
      <div className="order-1 flex flex-col gap-4">
      {char.classes.map(cc => {
        const cls = content.classes.find(c => c.slug === cc.classSlug)
        if (!cls) return null
        const classOptsDef = CLASS_OPTIONS[cc.classSlug]
        const features = (classOptsDef?.features ?? cls.features).filter(f => f.level <= cc.level)
        const fightingStyleChoice = char.featuresChosen.find(fc => fc.key === 'fighting-style' || fc.key === `fighting-style-${cc.classSlug}`)
        const fightingStyleSlug = typeof fightingStyleChoice?.value === 'string' ? fightingStyleChoice.value : null
        const chosenStyle = classOptsDef?.fightingStyles?.find(s => s.slug === fightingStyleSlug)
        const subclassEntry = cc.subclassSlug
          ? classOptsDef?.subclasses.find(s => s.slug === cc.subclassSlug)
          : null
        const renderSubclassFeature = (f: { level: number; name: string; description?: string }) => (
          <div key={`sub-${f.level}-${f.name}`} id={featureAnchor(cc.classSlug, f)} className="mb-3 p-3 rounded border border-indigo-100 bg-indigo-50/40">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs bg-indigo-100 text-indigo-600 rounded px-1.5 py-0.5 shrink-0">Lvl {f.level}</span>
              <span className="font-medium text-indigo-900">{f.name}</span>
              <span className="text-[10px] text-indigo-500">{subclassEntry!.name}</span>
            </div>
            {featureTrackers(featureAnchor(cc.classSlug, f), f.name)}
            {f.name === 'Eldritch Cannon' ? (
              (() => {
                const artLevel = cc.level
                const cannonMaxHp = artLevel * 5
                const activeCannons = char.summons.filter(s => s.templateKey === 'eldritch-cannon')
                const cannonCount = activeCannons.length
                const maxCannons = artLevel >= 15 ? 2 : 1
                const hasActiveCannon = cannonCount > 0
                const atCannonCap = cannonCount >= maxCannons
                const intMod = abilityModFor(effectiveChar, 'int')
                const dc = spellSaveDC(effectiveChar, 'artificer', content) + itemBonuses.spellDCBonus
                const atkBonus = spellAttackBonus(effectiveChar, 'artificer', content) + itemBonuses.spellAttackBonus
                // Same counter as the Resources card's Eldritch Cannon (1 free creation per long rest)
                const freeUsed = (char.classResources['eldritch-cannon'] ?? 1) < 1

                const CANNON_TYPES = [
                  {
                    key: 'flamethrower', label: 'Flamethrower', color: 'text-orange-700',
                    border: 'border-orange-200 hover:border-orange-400', bg: 'bg-orange-50 hover:bg-orange-100',
                    summary: `15 ft cone · DEX save DC ${dc} · 2d8 fire`,
                    attacks: [] as Summon['attacks'],
                    abilities: [{ name: 'Flamethrower', description: `15 ft cone — DEX save DC ${dc} or 2d8 fire, half on success. Ignites flammable objects.` }],
                  },
                  {
                    key: 'force-ballista', label: 'Force Ballista', color: 'text-blue-700',
                    border: 'border-blue-200 hover:border-blue-400', bg: 'bg-blue-50 hover:bg-blue-100',
                    summary: `Ranged spell atk · 120 ft · 2d8 force · push 5 ft`,
                    attacks: [{ name: 'Force Ballista', toHit: atkBonus, damage: '2d8', damageType: 'force', range: '120 ft', notes: 'Pushes target 5 ft on hit' }] as Summon['attacks'],
                    abilities: [],
                  },
                  {
                    key: 'protector', label: 'Protector', color: 'text-green-700',
                    border: 'border-green-200 hover:border-green-400', bg: 'bg-green-50 hover:bg-green-100',
                    summary: `Aura 10 ft · 1d8${intMod >= 0 ? `+${intMod}` : intMod} temp HP`,
                    attacks: [] as Summon['attacks'],
                    abilities: [{ name: 'Protector', description: `Aura 10 ft — grants 1d8${intMod >= 0 ? `+${intMod}` : intMod} temp HP to cannon and chosen creatures within 10 ft.` }],
                  },
                ]

                const summonCannon = (typeKey: string) => {
                  const ct = CANNON_TYPES.find(t => t.key === typeKey)!
                  const cannon: Summon = {
                    id: Math.random().toString(36).slice(2, 10),
                    name: `Eldritch Cannon — ${ct.label}`,
                    templateKey: 'eldritch-cannon',
                    hp: { current: cannonMaxHp, max: cannonMaxHp },
                    ac: 18, speed: 15,
                    saveProficiencies: [],
                    immunities: ['poison', 'psychic'],
                    resistances: [],
                    attacks: ct.attacks,
                    abilities: [
                      ...ct.abilities,
                      { name: 'Mending', description: 'Casting Mending on the cannon restores 2d6 HP.' },
                      ...(artLevel >= 9 ? [{ name: 'Explosive Cannon', description: `Action to detonate (60 ft) — 3d8 force, DC ${dc} DEX save for half.` }] : []),
                    ],
                    notes: `Artificer level ${artLevel}. Bonus action to activate (60 ft). ${freeUsed ? 'Spell slot expended.' : 'Free creation used.'}`,
                  }
                  patch({
                    summons: [...char.summons, cannon],
                    classResources: { ...char.classResources, 'eldritch-cannon': 0 },
                  })
                  setTab('summons')
                }

                return (
                  <>
                    {/* Free creation indicator */}
                    <div className={`flex items-center gap-2 p-2 rounded border text-xs mb-3 ${freeUsed ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${freeUsed ? 'bg-amber-400' : 'bg-green-500'}`} />
                      <span className={`font-medium ${freeUsed ? 'text-amber-700' : 'text-green-700'}`}>
                        {freeUsed ? 'Free creation used — must expend a spell slot to summon again' : 'Free creation available (1 / long rest)'}
                      </span>
                      <button type="button"
                        className="ml-auto text-[10px] underline opacity-60 hover:opacity-100 transition-opacity"
                        onClick={() => patch({ classResources: { ...char.classResources, 'eldritch-cannon': freeUsed ? 1 : 0 } })}>
                        {freeUsed ? 'Restore' : 'Mark used'}
                      </button>
                    </div>

                    {/* Active cannons summary */}
                    {hasActiveCannon && (
                      <div className="flex items-center gap-3 p-3 rounded border border-indigo-200 bg-indigo-50 mb-3">
                        <div className="flex-1 text-xs text-indigo-700 space-y-0.5">
                          {activeCannons.map(c => (
                            <div key={c.id} className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                              <span>{c.name}</span>
                              <span className="text-indigo-400">— {c.hp.current}/{c.hp.max} HP</span>
                            </div>
                          ))}
                        </div>
                        <button type="button" onClick={() => setTab('summons')}
                          className="shrink-0 text-xs bg-indigo-600 text-white rounded px-3 py-1.5 hover:bg-indigo-700 font-semibold transition-colors">
                          View in Summons →
                        </button>
                      </div>
                    )}

                    {/* Type picker — shown when under the cap */}
                    {!atCannonCap && (
                      <>
                        <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1.5">
                          {hasActiveCannon ? 'Summon second cannon' : 'Choose type to summon'} — HP {cannonMaxHp} · AC 18 · Speed 15 ft
                          {artLevel >= 15 && <span className="ml-2 text-amber-500">Fortified Position: {cannonCount}/{maxCannons} active</span>}
                        </div>
                        <div className="grid grid-cols-3 gap-2 mb-3">
                          {CANNON_TYPES.map(ct => (
                            <button key={ct.key} type="button" onClick={() => summonCannon(ct.key)}
                              className={`p-2.5 rounded border text-left transition-colors ${ct.border} ${ct.bg}`}>
                              <div className={`text-xs font-bold ${ct.color}`}>{ct.label}</div>
                              <div className="text-[10px] text-parchment-500 mt-0.5 leading-tight">{ct.summary}</div>
                            </button>
                          ))}
                        </div>
                      </>
                    )}

                    {atCannonCap && artLevel >= 15 && (
                      <p className="text-xs text-indigo-500 italic mb-3">Both cannons active (Fortified Position cap reached).</p>
                    )}
                  </>
                )
              })()
            ) : f.name === 'Wildfire Spirit' ? (
              (() => {
                const druidLevel = cc.level
                const spiritMaxHp = 5 * druidLevel
                const wisMod = abilityModFor(effectiveChar, 'wis')
                const wisStr = wisMod >= 0 ? `+${wisMod}` : `${wisMod}`
                const dc = spellSaveDC(effectiveChar, 'druid', content) + itemBonuses.spellDCBonus
                const atkBonus = spellAttackBonus(effectiveChar, 'druid', content) + itemBonuses.spellAttackBonus
                const activeSpirits = char.summons.filter(s => s.templateKey === 'wildfire-spirit')
                const hasActiveSpirit = activeSpirits.length > 0
                const wildShapeLeft = char.classResources['wild-shape'] ?? 2

                const summonSpirit = () => {
                  const spirit: Summon = {
                    id: Math.random().toString(36).slice(2, 10),
                    name: 'Wildfire Spirit',
                    templateKey: 'wildfire-spirit',
                    hp: { current: spiritMaxHp, max: spiritMaxHp },
                    ac: 13, speed: 30,
                    abilityScores: { str: 10, dex: 14, con: 14, int: 13, wis: 15, cha: 11 },
                    saveProficiencies: [],
                    immunities: ['fire'],
                    resistances: [],
                    attacks: [
                      { name: 'Flame Seed', toHit: atkBonus, damage: `1d6${wisStr}`, damageType: 'fire', range: '30 ft', notes: 'Ranged spell attack' },
                    ],
                    abilities: [
                      { name: 'Fiery Teleportation', description: `Bonus action — teleport the spirit and up to 5 willing creatures within 5 ft to unoccupied spaces within 15 ft. Each creature within 10 ft of the space the spirit left makes a DEX save (DC ${dc}) or takes 1d6${wisStr} fire damage.` },
                      { name: 'Summon', description: 'Bonus action to command its action. Lasts 1 hour, until it drops to 0 HP, or until you summon again. Can\'t be charmed or frightened.' },
                    ],
                    notes: `Druid level ${druidLevel}. Costs 1 Wild Shape charge to summon. Flies 30 ft (hover). Immune to fire.`,
                  }
                  patch({
                    summons: [...char.summons.filter(s => s.templateKey !== 'wildfire-spirit'), spirit],
                    classResources: { ...char.classResources, 'wild-shape': Math.max(0, wildShapeLeft - 1) },
                  })
                  setTab('summons')
                }

                return (
                  <>
                    {f.description && featureText(featureAnchor(cc.classSlug, f), f.description, 'mb-3')}

                    {/* Wild Shape charge indicator */}
                    <div className={`flex items-center gap-2 p-2 rounded border text-xs mb-3 ${wildShapeLeft > 0 ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${wildShapeLeft > 0 ? 'bg-green-500' : 'bg-amber-400'}`} />
                      <span className={`font-medium ${wildShapeLeft > 0 ? 'text-green-700' : 'text-amber-700'}`}>
                        {wildShapeLeft > 0 ? `Wild Shape charges: ${wildShapeLeft}` : 'No Wild Shape charges — short rest to recharge'}
                      </span>
                    </div>

                    {/* Active spirit summary */}
                    {hasActiveSpirit && (
                      <div className="flex items-center gap-3 p-3 rounded border border-indigo-200 bg-indigo-50 mb-3">
                        <div className="flex-1 text-xs text-indigo-700 space-y-0.5">
                          {activeSpirits.map(s => (
                            <div key={s.id} className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                              <span>{s.name}</span>
                              <span className="text-indigo-400">— {s.hp.current}/{s.hp.max} HP</span>
                            </div>
                          ))}
                        </div>
                        <button type="button" onClick={() => setTab('summons')}
                          className="shrink-0 text-xs bg-indigo-600 text-white rounded px-3 py-1.5 hover:bg-indigo-700 font-semibold transition-colors">
                          View in Summons →
                        </button>
                      </div>
                    )}

                    <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1.5">
                      {hasActiveSpirit ? 'Resummon' : 'Summon'} — HP {spiritMaxHp} · AC 13 · Speed 30 ft (fly)
                    </div>
                    <button type="button" onClick={summonSpirit}
                      className="w-full p-2.5 rounded border text-left transition-colors border-orange-200 hover:border-orange-400 bg-orange-50 hover:bg-orange-100 mb-3">
                      <div className="text-xs font-bold text-orange-700">Summon Wildfire Spirit</div>
                      <div className="text-[10px] text-parchment-500 mt-0.5 leading-tight">
                        Flame Seed: ranged spell atk {atkBonus >= 0 ? `+${atkBonus}` : atkBonus} · 1d6{wisStr} fire · 30 ft. Fiery Teleportation: DC {dc} DEX or 1d6{wisStr} fire.
                      </div>
                    </button>
                  </>
                )
              })()
            ) : (
              f.description && featureText(featureAnchor(cc.classSlug, f), f.description)
            )}
          </div>
        )
        const renderClassFeature = (f: { level: number; name: string; description?: string }) => {
          const isFightingStyle = f.name === 'Fighting Style'
          return (
            <div key={`${f.level}-${f.name}`} id={featureAnchor(cc.classSlug, f)} className="mb-3 p-3 rounded border border-parchment-100">
              <div className="flex items-center gap-2">
                <span className="text-xs bg-parchment-200 text-parchment-700 rounded px-1.5 py-0.5 shrink-0">Lvl {f.level}</span>
                <span className="font-medium">{f.name}</span>
              </div>
              {featureTrackers(featureAnchor(cc.classSlug, f), f.name)}
              {f.description && featureText(featureAnchor(cc.classSlug, f), f.description, 'mt-1')}
              {isFightingStyle && chosenStyle && (
                <div className="mt-2 pl-3 border-l-2 border-amber-300">
                  <div className="text-sm font-medium text-amber-700">Chosen: {chosenStyle.name}</div>
                  <div className="text-xs text-parchment-500 mt-0.5">{chosenStyle.description}</div>
                </div>
              )}
            </div>
          )
        }
        // One list in level order, class and subclass features together. Features with uses to
        // track or something to summon come first.
        const featureList = [
          ...features.map(f => ({ f, sub: false })),
          ...(subclassEntry?.features ?? []).filter(f => f.level <= cc.level).map(f => ({ f, sub: true })),
        ].sort((x, y) => x.f.level - y.f.level || Number(x.sub) - Number(y.sub))
        const inUse = (f: { level: number; name: string }) =>
          resourcesAt(featureAnchor(cc.classSlug, f)).length > 0 || f.name === 'Eldritch Cannon' || f.name === 'Wildfire Spirit'
        const pinned = featureList.filter(x => inUse(x.f))
        const others = featureList.filter(x => !inUse(x.f))
        const renderFeature = (x: (typeof featureList)[number]) => x.sub ? renderSubclassFeature(x.f) : renderClassFeature(x.f)
        return (
          <div key={cc.classSlug} className="card">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <h2 className="section-header mb-0">{cls.name} Features</h2>
              <span className="text-xs bg-parchment-200 text-parchment-700 rounded px-2 py-0.5">Levels 1–{cc.level}</span>
              {classOptsDef?.hitDie && (
                <span className="text-xs bg-parchment-100 text-parchment-600 rounded px-2 py-0.5">d{classOptsDef.hitDie}</span>
              )}
              {subclassEntry && (
                <span className="text-xs bg-indigo-100 text-indigo-700 rounded px-2 py-0.5">{subclassEntry.name}</span>
              )}
              <button type="button" onClick={() => { setAllFeaturesOpen(o => !o); setOpenFeatures(new Set()) }}
                className="ml-auto text-xs rounded-full px-2.5 py-0.5 border border-parchment-200 text-parchment-500 hover:border-parchment-500 hover:text-parchment-800 transition-colors"
              >{allFeaturesOpen ? 'Shorten text' : 'Show all text'}</button>
            </div>

            {/* Class basics: reference you rarely need mid-game, so folded away */}
            {classOptsDef && (
              <details className="mb-3 rounded border border-parchment-100 bg-parchment-50 text-xs text-parchment-600">
                <summary className="cursor-pointer select-none px-3 py-2 font-semibold text-parchment-700">Class basics: primary ability, saving throws, proficiencies</summary>
                <div className="px-3 pb-3 space-y-1">
                <div><span className="font-semibold text-parchment-700">Primary Ability:</span> {classOptsDef.primaryAbility}</div>
                <div><span className="font-semibold text-parchment-700">Saving Throws:</span> {classOptsDef.savingThrows.join(', ')}</div>
                <div><span className="font-semibold text-parchment-700">Armor:</span> {classOptsDef.armorTraining}</div>
                <div><span className="font-semibold text-parchment-700">Weapons:</span> {classOptsDef.weaponTraining}</div>
                {classOptsDef.toolProficiency && (
                  <div><span className="font-semibold text-parchment-700">Tools:</span> {classOptsDef.toolProficiency}</div>
                )}
                <div><span className="font-semibold text-parchment-700">Skills:</span> Choose {classOptsDef.numSkillChoices} from {classOptsDef.skillChoices.join(', ')}</div>
                </div>
              </details>
            )}

            {subclassEntry?.description && (
              <p className="text-sm text-parchment-500 mb-3 italic">{subclassEntry.description}</p>
            )}
            {subclassEntry?.grantedProficiencies && (() => {
              const gp = subclassEntry.grantedProficiencies
              const skills = (gp.skills ?? []).map(s => SKILL_LABELS[s as keyof typeof SKILL_LABELS] ?? s)
              const items = [...skills, ...(gp.tools ?? [])]
              if (items.length === 0 && !gp.languages) return null
              return (
                <div className="mb-3 flex items-center gap-1.5 flex-wrap text-xs">
                  <span className="font-semibold text-parchment-600">Granted Proficiencies:</span>
                  {items.map(p => (
                    <span key={p} className="bg-emerald-50 text-emerald-700 border border-emerald-200 rounded px-1.5 py-0.5">{p}</span>
                  ))}
                  {gp.languages ? <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 rounded px-1.5 py-0.5">+{gp.languages} language{gp.languages > 1 ? 's' : ''}</span> : null}
                </div>
              )
            })()}
            {pinned.length > 0 && (
              <div className="text-[10px] font-bold uppercase tracking-widest text-parchment-500 mb-1.5">Limited use</div>
            )}
            {pinned.map(renderFeature)}
            {pinned.length > 0 && others.length > 0 && (
              <div className="text-[10px] font-bold uppercase tracking-widest text-parchment-500 mt-4 mb-1.5">All other features</div>
            )}
            {others.map(renderFeature)}

            {/* Rogue: Sneak Attack */}
            {cc.classSlug === 'rogue' && sneakDice > 0 && (
              <div className="mb-3 p-3 rounded border border-red-100 bg-red-50">
                <div className="flex items-center justify-between">
                  <div className="font-medium text-sm text-red-800">Sneak Attack</div>
                  <div className="text-xl font-bold text-red-700">{sneakDice}d6</div>
                </div>
                <p className="text-xs text-red-600 mt-1">Once per turn when you hit with a finesse/ranged weapon and have advantage or a nearby ally.</p>
              </div>
            )}

            {/* Warlock: Pact Boon */}
            {cc.classSlug === 'warlock' && (() => {
              const fc = char.featuresChosen.find(f => f.key === 'pact-boon')
              const boon = typeof fc?.value === 'string' ? fc.value : null
              const BOON_LABELS: Record<string, string> = { blade: 'Pact of the Blade', chain: 'Pact of the Chain', tome: 'Pact of the Tome' }
              const BOON_DESC: Record<string, string> = {
                blade: 'Summon a pact weapon. Use CHA for attack/damage (with Hex Warrior). Pact weapon is magical.',
                chain: 'Find Familiar — can take imp, pseudodragon, quasit, or sprite form. Familiar can attack on reaction.',
                tome: 'Book of Shadows: gain 3 cantrips from any class list. Required for Book of Ancient Secrets.',
              }
              if (!boon) return (
                cc.level >= 3
                  ? <div className="mb-3 p-3 rounded border border-indigo-100 bg-indigo-50 text-xs text-indigo-600">No Pact Boon recorded — level up to choose one.</div>
                  : null
              )
              return (
                <div className="mb-3 p-3 rounded border border-indigo-200 bg-indigo-50">
                  <div className="font-medium text-sm text-indigo-800">{BOON_LABELS[boon] ?? boon}</div>
                  <p className="text-xs text-indigo-600 mt-1">{BOON_DESC[boon] ?? ''}</p>
                </div>
              )
            })()}

            {/* Battle Master: Maneuvers */}
            {cc.classSlug === 'fighter' && cc.subclassSlug === 'battle-master' && (() => {
              const fc = char.featuresChosen.find(f => f.key === 'maneuvers')
              const slugs: string[] = !fc ? [] : Array.isArray(fc.value) ? fc.value : [fc.value]
              if (slugs.length === 0) return null
              return (
                <div className="mb-3 p-3 rounded border border-amber-100 bg-amber-50">
                  <div className="font-medium text-sm text-amber-800 mb-2">Maneuvers Known ({slugs.length})</div>
                  <div className="space-y-1">
                    {slugs.map(slug => {
                      const m = BATTLE_MASTER_MANEUVERS.find(x => x.slug === slug)
                      return (
                        <div key={slug} className="text-sm">
                          <span className="font-medium">{m?.name ?? slug}</span>
                          {m?.description && <span className="text-xs text-parchment-500 ml-2">— {m.description}</span>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })()}

            {/* Ranger: Favored Enemy & Natural Explorer */}
            {cc.classSlug === 'ranger' && (() => {
              const enemies = char.featuresChosen
                .filter(f => f.key.startsWith('favored-enemy-'))
                .map(f => typeof f.value === 'string' ? f.value : '')
                .filter(Boolean)
              const terrains = char.featuresChosen
                .filter(f => f.key.startsWith('favored-terrain-'))
                .map(f => typeof f.value === 'string' ? f.value : '')
                .filter(Boolean)
              if (enemies.length === 0 && terrains.length === 0) return null
              return (
                <div className="mb-3 p-3 rounded border border-green-100 bg-green-50">
                  {enemies.length > 0 && (
                    <div className="mb-1.5">
                      <div className="text-xs font-bold text-green-700 uppercase tracking-wide mb-1">Favored Enemies</div>
                      <div className="flex flex-wrap gap-1">
                        {enemies.map(e => <span key={e} className="text-xs bg-green-100 text-green-800 rounded px-2 py-0.5">{e}</span>)}
                      </div>
                    </div>
                  )}
                  {terrains.length > 0 && (
                    <div>
                      <div className="text-xs font-bold text-green-700 uppercase tracking-wide mb-1">Favored Terrains</div>
                      <div className="flex flex-wrap gap-1">
                        {terrains.map(t => <span key={t} className="text-xs bg-green-100 text-green-800 rounded px-2 py-0.5">{t}</span>)}
                      </div>
                    </div>
                  )}
                </div>
              )
            })()}

            {/* Monk: Martial Arts + Ki summary */}
            {cc.classSlug === 'monk' && (() => {
              const maDie = `d${cc.level >= 17 ? 10 : cc.level >= 11 ? 8 : cc.level >= 5 ? 6 : 4}`
              const kiSaveDC = 8 + profBonus(char) + Math.max(0, abilityModFor(effectiveChar, 'wis'))
              return (
                <div className="mb-3 p-3 rounded border border-amber-100 bg-amber-50">
                  <div className="font-medium text-sm text-amber-800 mb-2">Monk — Martial Arts</div>
                  <div className="flex gap-4 mb-2 flex-wrap">
                    <div><div className="text-xs text-parchment-500">Martial Arts die</div><div className="text-lg font-bold text-amber-700">{maDie}</div></div>
                    <div><div className="text-xs text-parchment-500">Ki save DC</div><div className="text-lg font-bold text-amber-700">{kiSaveDC}</div></div>
                    <div><div className="text-xs text-parchment-500">Unarmored Movement</div><div className="text-lg font-bold text-amber-700">+{monkSpeedBonus(char)}ft</div></div>
                  </div>
                  <div className="text-xs text-parchment-600 space-y-0.5">
                    <div>• <strong>Flurry of Blows</strong> (2 ki): two bonus-action unarmed strikes</div>
                    <div>• <strong>Patient Defense</strong> (1 ki): Dodge as bonus action</div>
                    <div>• <strong>Step of the Wind</strong> (1 ki): Disengage or Dash as bonus action; jump distance doubled</div>
                    {cc.level >= 4 && <div>• <strong>Slow Fall</strong> (1 ki reaction): reduce fall damage by 5×level</div>}
                    {cc.level >= 5 && <div>• <strong>Stunning Strike</strong> (1 ki on hit): CON save DC {kiSaveDC} or stunned until end of your next turn</div>}
                    {cc.level >= 6 && <div>• <strong>Deflect Missiles</strong> (1 ki): after reducing to 0 damage, catch and redirect (30ft, 1d10+DEX+{cc.level})</div>}
                    {cc.level >= 7 && <div>• <strong>Evasion</strong>: DEX save → no damage on success; half on fail</div>}
                    {cc.level >= 14 && <div>• <strong>Diamond Soul</strong>: proficient in all saves; 1 ki to reroll a failed save</div>}
                    {cc.level >= 15 && <div>• <strong>Timeless Body</strong>: immune to magical aging; always have enough food and water</div>}
                    {cc.level >= 18 && <div>• <strong>Empty Body</strong> (4 ki, 1 min): invisible + resist all dmg except force; 8 ki to cast Astral Projection without components</div>}
                  </div>
                </div>
              )
            })()}

            {/* Monk: Subclass feature cards */}
            {cc.classSlug === 'monk' && cc.subclassSlug === 'open-hand' && (() => (
              <div className="mb-3 p-3 rounded border border-amber-200 bg-amber-50">
                <div className="font-medium text-sm text-amber-800 mb-1">Open Hand Technique</div>
                <p className="text-xs text-amber-700">When you hit with Flurry of Blows: DEX save or <strong>prone</strong>, STR save or <strong>pushed 15ft</strong>, or <strong>can't take reactions</strong> until end of their next turn (your choice).</p>
                {cc.level >= 6 && <p className="text-xs text-amber-600 mt-1"><strong>Wholeness of Body</strong> (1/LR): heal yourself for 3× Monk level HP as an action.</p>}
                {cc.level >= 11 && <p className="text-xs text-amber-600 mt-1"><strong>Tranquility</strong>: cast Sanctuary on yourself at end of each rest (lasts until you attack or cast a spell).</p>}
                {cc.level >= 17 && <p className="text-xs text-amber-600 mt-1"><strong>Quivering Palm</strong> (3 ki): on unarmed hit, set harmonic vibrations. As an action (any time), force CON save DC {8 + profBonus(char) + Math.max(0, abilityModFor(effectiveChar, 'wis'))} or drop to 0 HP (half on success).</p>}
              </div>
            ))()}

            {cc.classSlug === 'monk' && cc.subclassSlug === 'four-elements' && (() => {
              const fc = char.featuresChosen.find(f => f.key === 'four-elements')
              const slugs: string[] = !fc ? [] : Array.isArray(fc.value) ? fc.value : [fc.value]
              return (
                <div className="mb-3 p-3 rounded border border-orange-100 bg-orange-50">
                  <div className="font-medium text-sm text-orange-800 mb-2">Elemental Disciplines</div>
                  {slugs.length === 0 ? (
                    <p className="text-xs text-orange-600">No disciplines chosen — level up to select them.</p>
                  ) : (
                    <div className="space-y-1">
                      {slugs.map(slug => {
                        const d = FOUR_ELEMENTS_DISCIPLINES.find(x => x.slug === slug)
                        return (
                          <div key={slug} className="text-sm">
                            <span className="font-medium">{d?.name ?? slug}</span>
                            <span className="text-xs text-orange-600 ml-1">({d?.ki})</span>
                            {d?.description && <span className="text-xs text-parchment-500 ml-1">— {d.description}</span>}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })()}

            {cc.classSlug === 'monk' && cc.subclassSlug === 'shadow' && (() => (
              <div className="mb-3 p-3 rounded border border-gray-200 bg-gray-50">
                <div className="font-medium text-sm text-gray-800 mb-1">Shadow Arts</div>
                <p className="text-xs text-gray-700">Spend 2 ki to cast: Darkness, Darkvision, Pass without Trace, or Silence (no spell slot).</p>
                {cc.level >= 6 && <p className="text-xs text-gray-600 mt-1"><strong>Shadow Step</strong>: bonus action to teleport between dim-light/darkness areas within 60ft; gain advantage on next melee attack this turn.</p>}
                {cc.level >= 11 && <p className="text-xs text-gray-600 mt-1"><strong>Cloak of Shadows</strong> (1 ki): while in darkness/dim light, become invisible until attack, cast, or bright light.</p>}
                {cc.level >= 17 && <p className="text-xs text-gray-600 mt-1"><strong>Opportunist</strong>: reaction to attack a creature within 5ft that just took damage from another creature.</p>}
              </div>
            ))()}

            {cc.classSlug === 'monk' && cc.subclassSlug === 'mercy' && (() => (
              <div className="mb-3 p-3 rounded border border-teal-100 bg-teal-50">
                <div className="font-medium text-sm text-teal-800 mb-1">Hands of Healing/Harm</div>
                <p className="text-xs text-teal-700"><strong>Hand of Healing</strong> (1 ki): as part of Flurry of Blows or an action, touch a creature — restore 1d{cc.level >= 17 ? 10 : cc.level >= 11 ? 8 : cc.level >= 5 ? 6 : 4}+WIS HP.</p>
                <p className="text-xs text-teal-700 mt-0.5"><strong>Hand of Harm</strong> (1 ki, 1/turn): when you hit with unarmed strike, deal extra 1d{cc.level >= 17 ? 10 : cc.level >= 11 ? 8 : cc.level >= 5 ? 6 : 4}+WIS necrotic and possibly poison the target (CON save).</p>
                {cc.level >= 6 && <p className="text-xs text-teal-600 mt-1"><strong>Physician's Touch</strong>: Hand of Healing also ends one disease or condition; Hand of Harm also poisons.</p>}
                {cc.level >= 11 && <p className="text-xs text-teal-600 mt-1"><strong>Flurry of Healing/Harm</strong>: use Hand of Healing/Harm with each Flurry hit, spending only 1 ki total.</p>}
              </div>
            ))()}

            {/* Barbarian: subclass feature cards */}
            {cc.classSlug === 'barbarian' && cc.subclassSlug === 'totem-warrior' && (() => {
              const spirit = char.featuresChosen.find(f => f.key === 'totem-spirit')
              const aspect = char.featuresChosen.find(f => f.key === 'totem-aspect')
              const attunement = char.featuresChosen.find(f => f.key === 'totem-attunement')
              const getAnimal = (fc: typeof spirit) => {
                const slug = typeof fc?.value === 'string' ? fc.value : null
                return slug ? TOTEM_ANIMALS.find(a => a.slug === slug) : null
              }
              return (
                <div className="mb-3 p-3 rounded border border-amber-200 bg-amber-50">
                  <div className="font-medium text-sm text-amber-800 mb-2">Totem Spirit</div>
                  {spirit ? (
                    <div className="mb-1.5">
                      <span className="text-xs font-semibold text-amber-700">Spirit (L3): </span>
                      <span className="text-xs font-medium">{getAnimal(spirit)?.name}</span>
                      <span className="text-xs text-parchment-500 ml-1">— {getAnimal(spirit)?.tierDescs.spirit}</span>
                    </div>
                  ) : cc.level >= 3 ? <p className="text-xs text-amber-600 mb-1">No totem spirit chosen — level up to select.</p> : null}
                  {aspect && cc.level >= 6 && (
                    <div className="mb-1.5">
                      <span className="text-xs font-semibold text-amber-700">Aspect (L6): </span>
                      <span className="text-xs font-medium">{getAnimal(aspect)?.name}</span>
                      <span className="text-xs text-parchment-500 ml-1">— {getAnimal(aspect)?.tierDescs.aspect}</span>
                    </div>
                  )}
                  {attunement && cc.level >= 14 && (
                    <div>
                      <span className="text-xs font-semibold text-amber-700">Attunement (L14): </span>
                      <span className="text-xs font-medium">{getAnimal(attunement)?.name}</span>
                      <span className="text-xs text-parchment-500 ml-1">— {getAnimal(attunement)?.tierDescs.attunement}</span>
                    </div>
                  )}
                </div>
              )
            })()}

            {cc.classSlug === 'barbarian' && cc.subclassSlug === 'storm-herald' && (() => {
              const auraFC = char.featuresChosen.find(f => f.key === 'storm-aura')
              const auraSlug = typeof auraFC?.value === 'string' ? auraFC.value : null
              const auraDef = STORM_AURA_OPTIONS.find(a => a.slug === auraSlug)
              return (
                <div className="mb-3 p-3 rounded border border-sky-200 bg-sky-50">
                  <div className="font-medium text-sm text-sky-800 mb-1">Storm Herald</div>
                  {auraDef ? (
                    <>
                      <div className="text-xs font-semibold text-sky-700 mb-0.5">{auraDef.name} Aura</div>
                      <p className="text-xs text-sky-700">{auraDef.description}</p>
                      {cc.level >= 6 && <p className="text-xs text-sky-600 mt-1"><strong>Storm Soul:</strong> {auraDef.soulDesc}</p>}
                      {cc.level >= 10 && <p className="text-xs text-sky-600 mt-1"><strong>Shielding Storm:</strong> allies in your aura gain same resistance type.</p>}
                    </>
                  ) : <p className="text-xs text-sky-600">No storm aura chosen — level up to select.</p>}
                </div>
              )
            })()}

            {cc.classSlug === 'barbarian' && cc.subclassSlug === 'berserker' && (() => (
              <div className="mb-3 p-3 rounded border border-red-200 bg-red-50">
                <div className="font-medium text-sm text-red-800 mb-1">Path of the Berserker</div>
                <p className="text-xs text-red-700"><strong>Frenzy:</strong> when you enter rage, choose to Frenzy — make one melee weapon attack as a bonus action each turn. <em>Costs 1 exhaustion level when rage ends.</em></p>
                {cc.level >= 6 && <p className="text-xs text-red-600 mt-1"><strong>Mindless Rage:</strong> immune to charmed and frightened while raging.</p>}
                {cc.level >= 10 && <p className="text-xs text-red-600 mt-1"><strong>Intimidating Presence:</strong> action — frighten one creature within 30ft (WIS save DC {8 + profBonus(char) + Math.max(0, abilityModFor(effectiveChar, 'cha'))}).</p>}
                {cc.level >= 14 && <p className="text-xs text-red-600 mt-1"><strong>Retaliation:</strong> reaction to melee attack a creature within 5ft that damages you.</p>}
              </div>
            ))()}

            {cc.classSlug === 'barbarian' && cc.subclassSlug === 'zealot' && (() => {
              const divineDie = `1d6+${Math.floor(cc.level / 2)}`
              return (
                <div className="mb-3 p-3 rounded border border-yellow-200 bg-yellow-50">
                  <div className="font-medium text-sm text-yellow-800 mb-1">Path of the Zealot</div>
                  <p className="text-xs text-yellow-800"><strong>Divine Fury:</strong> first hit each turn adds {divineDie} necrotic or radiant damage while raging.</p>
                  <p className="text-xs text-yellow-700 mt-0.5"><strong>Warrior of the Gods:</strong> spells that restore you to life need no material components.</p>
                  {cc.level >= 6 && <p className="text-xs text-yellow-700 mt-0.5"><strong>Fanatical Focus:</strong> 1/rage — reroll a failed save with your rage bonus (+{cc.level >= 16 ? 4 : cc.level >= 9 ? 3 : 2}).</p>}
                  {cc.level >= 14 && <p className="text-xs text-yellow-700 mt-0.5"><strong>Rage Beyond Death:</strong> while raging, 0 HP doesn't knock you unconscious — you die when rage ends at 0 HP.</p>}
                </div>
              )
            })()}

            {cc.classSlug === 'barbarian' && cc.subclassSlug === 'ancestral-guardian' && (() => (
              <div className="mb-3 p-3 rounded border border-blue-200 bg-blue-50">
                <div className="font-medium text-sm text-blue-800 mb-1">Ancestral Guardian</div>
                <p className="text-xs text-blue-700"><strong>Ancestral Protectors:</strong> first creature you hit while raging has disadvantage on attacks vs. others and targets get resistance to its damage (until your next turn).</p>
                {cc.level >= 6 && <p className="text-xs text-blue-600 mt-1"><strong>Spirit Shield:</strong> reaction (when ally takes damage within 30ft) — reduce damage by {cc.level >= 14 ? '4d6' : cc.level >= 10 ? '3d6' : '2d6'}.</p>}
                {cc.level >= 10 && <p className="text-xs text-blue-600 mt-1"><strong>Consult the Spirits:</strong> cast Clairvoyance 1/SR without a spell slot.</p>}
                {cc.level >= 14 && <p className="text-xs text-blue-600 mt-1"><strong>Vengeful Ancestors:</strong> when Spirit Shield reduces damage, attacker takes that much force damage.</p>}
              </div>
            ))()}

            {/* Rogue: Phantom subclass */}
            {cc.classSlug === 'rogue' && cc.subclassSlug === 'phantom' && (() => (
              <div className="mb-3 p-3 rounded border border-purple-200 bg-purple-50">
                <div className="font-medium text-sm text-purple-800 mb-1">Phantom</div>
                <p className="text-xs text-purple-700"><strong>Wails from the Grave:</strong> after SA, deal half SA dice necrotic to a second creature within 30ft. WIS mod uses/LR.</p>
                {cc.level >= 9 && (() => {
                  const tokens = char.classResources['soul-trinkets'] ?? 0
                  return <p className="text-xs text-purple-700 mt-0.5"><strong>Tokens of the Departed:</strong> {tokens}/{profBonus(char)} trinkets — advantage on death saves while holding one; can ask one question per trinket.</p>
                })()}
                {cc.level >= 13 && <p className="text-xs text-purple-600 mt-0.5"><strong>Ghost Walk (1/LR):</strong> bonus action — pass through creatures/objects, fly 10ft, resist B/P/S for 10 min.</p>}
                {cc.level >= 17 && <p className="text-xs text-purple-600 mt-0.5"><strong>Death's Friend:</strong> Wails from the Grave now uses full SA dice. If you start a turn with no trinkets, one appears.</p>}
              </div>
            ))()}

            {/* Ranger: Gloom Stalker */}
            {cc.classSlug === 'ranger' && cc.subclassSlug === 'gloom-stalker' && (() => (
              <div className="mb-3 p-3 rounded border border-slate-200 bg-slate-50">
                <div className="font-medium text-sm text-slate-800 mb-1">Gloom Stalker</div>
                <p className="text-xs text-slate-700"><strong>Dread Ambusher:</strong> +WIS to initiative. Round 1: extra attack that deals +1d8 damage on hit.</p>
                <p className="text-xs text-slate-600 mt-0.5"><strong>Umbral Sight:</strong> darkvision 60ft. Invisible in darkness to darkvision-reliant creatures.</p>
                {cc.level >= 7 && <p className="text-xs text-slate-600 mt-0.5"><strong>Iron Mind:</strong> proficiency in WIS saves (or INT/CHA if already proficient).</p>}
                {cc.level >= 11 && <p className="text-xs text-slate-600 mt-0.5"><strong>Stalker's Flurry:</strong> once per turn on a miss, immediately make another attack.</p>}
                {cc.level >= 15 && <p className="text-xs text-slate-600 mt-0.5"><strong>Shadowy Dodge:</strong> reaction to impose disadvantage on attack roll against you (not in bright light).</p>}
              </div>
            ))()}

            {/* Ranger: Horizon Walker */}
            {cc.classSlug === 'ranger' && cc.subclassSlug === 'horizon-walker' && (() => (
              <div className="mb-3 p-3 rounded border border-cyan-200 bg-cyan-50">
                <div className="font-medium text-sm text-cyan-800 mb-1">Horizon Walker</div>
                <p className="text-xs text-cyan-700"><strong>Detect Portal</strong> (1/SR): sense portals within 1 mile.</p>
                <p className="text-xs text-cyan-700 mt-0.5"><strong>Planar Warrior:</strong> bonus action — first hit on chosen target deals +{cc.level >= 11 ? '2d8' : '1d8'} force damage this turn.</p>
                {cc.level >= 7 && <p className="text-xs text-cyan-600 mt-0.5"><strong>Ethereal Step</strong> (1/SR): start of turn bonus action — enter Ethereal Plane until end of turn.</p>}
                {cc.level >= 11 && <p className="text-xs text-cyan-600 mt-0.5"><strong>Distant Strike:</strong> teleport up to 10ft before each attack. Two different targets → third bonus attack.</p>}
                {cc.level >= 15 && <p className="text-xs text-cyan-600 mt-0.5"><strong>Spectral Defense:</strong> reaction to gain resistance to one instance of damage.</p>}
              </div>
            ))()}

            {/* Ranger: Beast Master */}
            {cc.classSlug === 'ranger' && cc.subclassSlug === 'beast-master' && (() => (
              <div className="mb-3 p-3 rounded border border-green-200 bg-green-50">
                <div className="font-medium text-sm text-green-800 mb-1">Beast Master</div>
                <p className="text-xs text-green-700"><strong>Primal Companion:</strong> bond with a Primal Beast (Air/Land/Sea). HP = 5×Ranger level. Acts on your initiative; attacks on your turn without needing a command.</p>
                {cc.level >= 7 && <p className="text-xs text-green-600 mt-0.5"><strong>Exceptional Training:</strong> when companion doesn't attack, bonus action to command Dash/Disengage/Dodge/Help. Attacks are magical.</p>}
                {cc.level >= 11 && <p className="text-xs text-green-600 mt-0.5"><strong>Bestial Fury:</strong> companion makes two attacks per turn.</p>}
                {cc.level >= 15 && <p className="text-xs text-green-600 mt-0.5"><strong>Share Spells:</strong> self-targeting spells also affect companion within 30ft.</p>}
              </div>
            ))()}

            {/* Druid: Circle of Stars */}
            {cc.classSlug === 'druid' && cc.subclassSlug === 'stars' && (() => {
              const wisStr = Math.max(0, abilityModFor(effectiveChar, 'wis')) > 0 ? `+${Math.max(0, abilityModFor(effectiveChar, 'wis'))}` : ''
              return (
                <div className="mb-3 p-3 rounded border border-indigo-100 bg-indigo-50">
                  <div className="font-medium text-sm text-indigo-800 mb-1">Circle of Stars</div>
                  <p className="text-xs text-indigo-700"><strong>Star Map:</strong> Guidance at will; cast Guiding Bolt {profBonus(char)}×/LR without a slot.</p>
                  <p className="text-xs text-indigo-700 mt-0.5"><strong>Starry Form</strong> (uses Wild Shape): choose Archer (1d8{wisStr} radiant BA), Chalice (1d8{wisStr} HP when healing), or Dragon (min 10 on concentration saves).</p>
                  {cc.level >= 6 && <p className="text-xs text-indigo-600 mt-0.5"><strong>Cosmic Omen</strong> (WIS mod/LR): reaction — Woe −1d6 or Weal +1d6 to any roll within 30ft.</p>}
                  {cc.level >= 10 && <p className="text-xs text-indigo-600 mt-0.5"><strong>Twinkling Constellations:</strong> Archer/Chalice deal 2d8; Dragon gives 20ft fly+hover. Can switch form each turn.</p>}
                </div>
              )
            })()}

            {/* Druid: Circle of Spores */}
            {cc.classSlug === 'druid' && cc.subclassSlug === 'spores' && (() => {
              const haloDie = cc.level >= 14 ? '1d10' : cc.level >= 10 ? '1d8' : cc.level >= 6 ? '1d6' : '1d4'
              return (
                <div className="mb-3 p-3 rounded border border-green-200 bg-green-50">
                  <div className="font-medium text-sm text-green-800 mb-1">Circle of Spores</div>
                  <p className="text-xs text-green-700"><strong>Halo of Spores:</strong> reaction — creature entering/starting turn within 10ft takes {haloDie} necrotic (CON save negates).</p>
                  <p className="text-xs text-green-700 mt-0.5"><strong>Symbiotic Entity</strong> (Wild Shape charge): gain {4 * cc.level} temp HP. Halo +1d6 necrotic; weapon hits +1d6 necrotic. Lasts 10 min.</p>
                  {cc.level >= 6 && <p className="text-xs text-green-600 mt-0.5"><strong>Fungal Infestation</strong> (WIS mod/LR reaction): when creature dies within 10ft, animate as zombie for 1 hr.</p>}
                  {cc.level >= 14 && <p className="text-xs text-green-600 mt-0.5"><strong>Fungal Body:</strong> immune to blinded/deafened/frightened/poisoned. Critical hits become normal hits.</p>}
                </div>
              )
            })()}

            {/* Druid: Circle of Dreams */}
            {cc.classSlug === 'druid' && cc.subclassSlug === 'dreams' && (() => {
              const wisMod = Math.max(0, abilityModFor(effectiveChar, 'wis'))
              return (
                <div className="mb-3 p-3 rounded border border-purple-100 bg-purple-50">
                  <div className="font-medium text-sm text-purple-800 mb-1">Circle of Dreams</div>
                  <p className="text-xs text-purple-700"><strong>Balm of the Summer Court</strong> ({cc.level}d6 pool/LR): bonus action — expend dice to heal a creature within 120ft, granting that many temp HP too.</p>
                  {cc.level >= 6 && <p className="text-xs text-purple-600 mt-0.5"><strong>Hearth of Moonlight and Shadow:</strong> during rests, 30ft warded area — no unwanted eavesdropping or scrying.</p>}
                  {cc.level >= 10 && <p className="text-xs text-purple-600 mt-0.5"><strong>Hidden Paths</strong> (WIS mod/LR): bonus action — teleport 60ft. Or action to teleport a willing creature 30ft.</p>}
                </div>
              )
            })()}

            {/* Druid: Circle of the Shepherd */}
            {cc.classSlug === 'druid' && cc.subclassSlug === 'shepherd' && (() => (
              <div className="mb-3 p-3 rounded border border-lime-200 bg-lime-50">
                <div className="font-medium text-sm text-lime-800 mb-1">Circle of the Shepherd</div>
                <p className="text-xs text-lime-700"><strong>Speech of the Woods:</strong> cast Speak with Animals at will. Know Sylvan.</p>
                <p className="text-xs text-lime-700 mt-0.5"><strong>Spirit Totem</strong> (1/SR): bonus action — Bear (HP aura, +5 HP), Hawk (ally reaction for attack advantage), Unicorn (WIS healing bonus; detect magic 60ft).</p>
                {cc.level >= 6 && <p className="text-xs text-lime-600 mt-0.5"><strong>Mighty Summoner:</strong> summoned beasts/fey gain +2 HP/HD and natural weapons are magical.</p>}
                {cc.level >= 10 && <p className="text-xs text-lime-600 mt-0.5"><strong>Guardian Spirit:</strong> summoned creatures ending turns in totem aura regain 2d6+WIS HP.</p>}
              </div>
            ))()}

            {/* Cleric: Destroy Undead */}
            {cc.classSlug === 'cleric' && cc.level >= 5 && (() => {
              const crThreshold = cc.level >= 17 ? 'CR 4' : cc.level >= 14 ? 'CR 3' : cc.level >= 11 ? 'CR 2' : cc.level >= 8 ? 'CR 1' : 'CR 1/2'
              return (
                <div className="mb-3 p-3 rounded border border-amber-100 bg-amber-50">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-sm text-amber-800">Turn Undead → Destroy Undead</div>
                    <div className="text-base font-bold text-amber-700">{crThreshold} or lower</div>
                  </div>
                  <p className="text-xs text-amber-600 mt-1">Channel Divinity: undead of {crThreshold} or lower are destroyed outright instead of merely turned.</p>
                </div>
              )
            })()}

            {/* Bard: Song of Rest & Countercharm */}
            {cc.classSlug === 'bard' && cc.level >= 2 && (() => {
              const sorDie = cc.level >= 17 ? 'd12' : cc.level >= 13 ? 'd10' : cc.level >= 9 ? 'd8' : 'd6'
              return (
                <div className="mb-3 p-3 rounded border border-blue-100 bg-blue-50">
                  <div className="flex items-center justify-between mb-1">
                    <div className="font-medium text-sm text-blue-800">Song of Rest</div>
                    <div className="text-base font-bold text-blue-700">{sorDie}</div>
                  </div>
                  <p className="text-xs text-blue-600 mb-1">Allies who hear your performance during a short rest regain extra HP equal to one {sorDie} roll when spending hit dice.</p>
                  {cc.level >= 6 && (
                    <>
                      <div className="font-medium text-sm text-blue-800 mt-2 mb-1">Countercharm</div>
                      <p className="text-xs text-blue-600">Action: friendly creatures within 30ft that can hear you have advantage on saves against being frightened or charmed.</p>
                    </>
                  )}
                </div>
              )
            })()}

            {/* Fighter: Rune Knight runes */}
            {cc.classSlug === 'fighter' && cc.subclassSlug === 'rune-knight' && cc.level >= 3 && (() => {
              const fc = char.featuresChosen.find(f => f.key === 'runes')
              const slugs: string[] = !fc ? [] : Array.isArray(fc.value) ? fc.value : [fc.value]
              const maxRunes = cc.level >= 15 ? 5 : cc.level >= 10 ? 4 : cc.level >= 7 ? 3 : 2
              if (slugs.length === 0) return (
                <div className="mb-3 p-3 rounded border border-stone-100 bg-stone-50 text-xs text-stone-600">No runes inscribed — level up to choose runes ({maxRunes} available).</div>
              )
              return (
                <div className="mb-3 p-3 rounded border border-stone-200 bg-stone-50">
                  <div className="font-medium text-sm text-stone-800 mb-2">Runes Inscribed ({slugs.length}/{maxRunes})</div>
                  <div className="space-y-1.5">
                    {slugs.map(slug => {
                      const r = RUNE_KNIGHT_RUNES.find(x => x.slug === slug)
                      return (
                        <div key={slug} className="text-sm">
                          <span className="font-medium">{r?.name ?? slug}</span>
                          {r?.description && <span className="text-xs text-parchment-500 ml-2">— {r.description}</span>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })()}

            {/* Ranger: Hunter subclass choices */}
            {cc.classSlug === 'ranger' && cc.subclassSlug === 'hunter' && (() => {
              const choices = ([3, 7, 11, 15] as const).flatMap(lvl => {
                const fc = char.featuresChosen.find(f => f.key === `hunter-${lvl}`)
                if (!fc || cc.level < lvl) return []
                const slug = typeof fc.value === 'string' ? fc.value : ''
                const def = HUNTER_CHOICES[lvl]?.find(c => c.slug === slug)
                return def ? [{ lvl, def }] : []
              })
              if (choices.length === 0) return null
              return (
                <div className="mb-3 p-3 rounded border border-teal-100 bg-teal-50">
                  <div className="font-medium text-sm text-teal-800 mb-2">Hunter Techniques</div>
                  <div className="space-y-1.5">
                    {choices.map(({ lvl, def }) => (
                      <div key={lvl} className="text-sm">
                        <span className="font-medium">{def.name}</span>
                        <span className="text-xs text-parchment-500 ml-2">— {def.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}

            {/* Eldritch Invocations (Warlock) */}
            {cc.classSlug === 'warlock' && (() => {
              const fc = char.featuresChosen.find(f => f.key === 'invocations')
              const slugs: string[] = !fc ? [] : Array.isArray(fc.value) ? fc.value : [fc.value]
              if (slugs.length === 0) return null
              return (
                <div className="mb-3 p-3 rounded border border-indigo-100 bg-indigo-50">
                  <div className="font-medium text-sm mb-2 text-indigo-700">Eldritch Invocations ({slugs.length})</div>
                  <div className="space-y-1.5">
                    {slugs.map(slug => {
                      const inv = ELDRITCH_INVOCATIONS.find(i => i.slug === slug)
                      return (
                        <div key={slug} className="text-sm">
                          <span className="font-medium">{inv?.name ?? slug}</span>
                          {inv?.description && <span className="text-xs text-parchment-500 ml-2">— {inv.description}</span>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })()}

            {/* Infusions (Artificer) */}
            {cc.classSlug === 'artificer' && cc.level >= 2 && (() => {
              const classOpts = CLASS_OPTIONS['artificer']!
              const knownAtLevel  = classOpts.infusionsKnownAtLevel!
              const activeAtLevel = classOpts.infusionsActiveAtLevel!
              const knownNow  = knownAtLevel[cc.level - 1]
              const activeNow = activeAtLevel[cc.level - 1]
              const fc = char.featuresChosen.find(f => f.key === 'infusions')
              const slugs: string[] = !fc ? [] : Array.isArray(fc.value) ? fc.value : [fc.value]

              const PROGRESSION = [
                { level: 2, known: 4, active: 2 },
                { level: 6, known: 6, active: 3 },
                { level: 10, known: 8, active: 4 },
                { level: 14, known: 10, active: 5 },
                { level: 18, known: 12, active: 6 },
              ]

              return (
                <div className="mb-3 p-3 rounded border border-amber-100 bg-amber-50/40">
                  <div className="font-medium text-sm text-amber-800 mb-3">Infuse Item</div>

                  {/* Current counts */}
                  <div className="flex gap-4 mb-3">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-amber-700">{knownNow}</div>
                      <div className="text-xs text-parchment-500">Infusions Known</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-amber-700">{activeNow}</div>
                      <div className="text-xs text-parchment-500">Active at Once</div>
                    </div>
                  </div>

                  {/* Progression table: reference, so folded away */}
                  <details className="mb-3">
                    <summary className="text-xs font-semibold text-parchment-500 uppercase tracking-wide cursor-pointer hover:text-parchment-700">Infusions by artificer level ▼</summary>
                    <table className="w-full text-xs border-collapse mt-2">
                      <thead>
                        <tr className="text-left border-b border-amber-200">
                          <th className="pb-1 pr-3 font-semibold text-parchment-600">Artificer Level</th>
                          <th className="pb-1 pr-3 font-semibold text-parchment-600">Infusions Known</th>
                          <th className="pb-1 font-semibold text-parchment-600">Infused Items</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-amber-100">
                        {PROGRESSION.map(row => (
                          <tr key={row.level} className={cc.level >= row.level ? 'text-parchment-800' : 'text-parchment-300'}>
                            <td className={`py-1 pr-3 font-medium ${cc.level === row.level || (cc.level > row.level && (PROGRESSION.find(r => r.level > cc.level)?.level ?? 99) > row.level) ? 'text-amber-700' : ''}`}>
                              {row.level}{cc.level >= row.level && cc.level < (PROGRESSION.find(r => r.level > row.level)?.level ?? 99) ? ' ←' : ''}
                            </td>
                            <td className="py-1 pr-3">{row.known}</td>
                            <td className="py-1">{row.active}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </details>

                  {/* Known infusions list */}
                  <div className="border-t border-amber-100 pt-2 mb-3">
                    <div className="text-xs font-semibold text-parchment-500 uppercase tracking-wide mb-2">Your Chosen Infusions</div>
                    {slugs.length > 0 ? (
                      <div className="space-y-1">
                        {slugs.map(slug => {
                          const inf = findInfusion(slug)
                          return (
                            <div key={slug} className="flex items-start gap-1.5">
                              <span className="text-sm font-medium shrink-0">{inf?.name ?? slug}</span>
                              {inf?.cost && <span className="text-xs text-amber-700 shrink-0">({inf.cost})</span>}
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-parchment-400">No infusions selected yet — choose them during level up.</p>
                    )}
                  </div>

                  {/* Full reference table */}
                  <details className="border-t border-amber-100 pt-2">
                    <summary className="text-xs font-semibold text-parchment-500 uppercase tracking-wide cursor-pointer hover:text-parchment-700">All Infusions Reference ▼</summary>
                    <div className="mt-2 overflow-x-auto">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="text-left border-b border-amber-200">
                            <th className="pb-1 pr-2 font-semibold text-parchment-600">Infusion</th>
                            <th className="pb-1 pr-2 font-semibold text-parchment-600">Min. Level</th>
                            <th className="pb-1 pr-2 font-semibold text-parchment-600">Item Required</th>
                            <th className="pb-1 pr-2 font-semibold text-parchment-600">Cost</th>
                            <th className="pb-1 font-semibold text-parchment-600">Effect</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-amber-50">
                          {ARTIFICER_INFUSIONS.filter(inf => inf.kind !== 'replicate').map(inf => {
                            const available = cc.level >= (inf.levelRequirement ?? 2)
                            const known = slugs.some(s => findInfusion(s)?.slug === inf.slug)
                            return (
                              <tr key={inf.slug} className={known ? 'bg-amber-50' : !available ? 'bg-parchment-50' : ''}>
                                <td className={`py-1.5 pr-2 font-medium align-top whitespace-nowrap ${!available ? 'text-parchment-300' : ''}`}>
                                  {inf.name}
                                  {known && <span className="ml-1 text-amber-600">✓</span>}
                                </td>
                                <td className="py-1.5 pr-2 align-top">
                                  {!available
                                    ? <span className="text-parchment-300">Lv {inf.levelRequirement}</span>
                                    : <span className="text-green-600 font-medium">✓ {inf.levelRequirement ?? 2}</span>}
                                </td>
                                <td className={`py-1.5 pr-2 align-top ${!available ? 'text-parchment-300' : 'text-parchment-500'}`}>{inf.itemType ?? '—'}</td>
                                <td className={`py-1.5 pr-2 align-top ${!available ? 'text-parchment-300' : 'text-amber-700'}`}>{inf.cost ?? '—'}</td>
                                <td className={`py-1.5 align-top ${!available ? 'text-parchment-300' : 'text-parchment-600'}`}>{inf.description}</td>
                              </tr>
                            )
                          })}
                          {/* Replicate Magic Item: one infusion per replicated item */}
                          <tr>
                            <td className="py-1.5 pr-2 font-medium align-top whitespace-nowrap">Replicate Magic Item</td>
                            <td className="py-1.5 pr-2 align-top"><span className="text-green-600 font-medium">✓ 2</span></td>
                            <td className="py-1.5 pr-2 align-top text-parchment-500">Varies</td>
                            <td className="py-1.5 pr-2 align-top text-amber-700">—</td>
                            <td className="py-1.5 align-top text-parchment-600">
                              Learn it once per item to make that magic item. At your level:{' '}
                              {ARTIFICER_INFUSIONS.filter(inf => inf.kind === 'replicate' && cc.level >= (inf.levelRequirement ?? 2))
                                .map(inf => inf.name.replace('Replicate: ', '') + (slugs.some(s => findInfusion(s)?.slug === inf.slug) ? ' ✓' : ''))
                                .join(', ')}.
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </details>
                </div>
              )
            })()}

            {/* Metamagic (Sorcerer) */}
            {cc.classSlug === 'sorcerer' && (() => {
              const fc = char.featuresChosen.find(f => f.key === 'metamagic')
              const slugs: string[] = !fc ? [] : Array.isArray(fc.value) ? fc.value : [fc.value]
              if (slugs.length === 0) return null
              return (
                <div className="mb-3 p-3 rounded border border-purple-100 bg-purple-50">
                  <div className="font-medium text-sm mb-2 text-purple-700">Metamagic ({slugs.length})</div>
                  <div className="space-y-1.5">
                    {slugs.map(slug => {
                      const m = METAMAGIC_OPTIONS.find(x => x.slug === slug)
                      return (
                        <div key={slug} className="text-sm">
                          <span className="font-medium">{m?.name ?? slug}</span>
                          {m?.description && <span className="text-xs text-parchment-500 ml-2">— {m.description}</span>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })()}
          </div>
        )
      })}
      </div>

      {/* Resistances & Immunities */}
      {(resistances.resistances.length > 0 || resistances.immunities.length > 0 || resistances.conditionImmunities.length > 0 || resistances.advantages.length > 0) && (
        <div className="card order-3">
          <h2 className="section-header">Resistances &amp; Immunities</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {resistances.resistances.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-parchment-600 uppercase mb-1">Damage Resistance</div>
                <div className="flex flex-wrap gap-1">
                  {resistances.resistances.map(r => (
                    <span key={r} className="text-xs bg-blue-100 text-blue-700 rounded px-2 py-0.5 capitalize">{r}</span>
                  ))}
                </div>
              </div>
            )}
            {resistances.immunities.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-parchment-600 uppercase mb-1">Damage Immunity</div>
                <div className="flex flex-wrap gap-1">
                  {resistances.immunities.map(r => (
                    <span key={r} className="text-xs bg-green-100 text-green-700 rounded px-2 py-0.5 capitalize">{r}</span>
                  ))}
                </div>
              </div>
            )}
            {resistances.conditionImmunities.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-parchment-600 uppercase mb-1">Condition Immunity</div>
                <div className="flex flex-wrap gap-1">
                  {resistances.conditionImmunities.map(r => (
                    <span key={r} className="text-xs bg-purple-100 text-purple-700 rounded px-2 py-0.5 capitalize">{r}</span>
                  ))}
                </div>
              </div>
            )}
            {resistances.advantages.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-parchment-600 uppercase mb-1">Advantage On</div>
                <div className="flex flex-wrap gap-1">
                  {resistances.advantages.map(r => (
                    <span key={r} className="text-xs bg-amber-100 text-amber-700 rounded px-2 py-0.5 capitalize">{r}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Feats */}
      {(() => {
        const featChoices = char.featuresChosen.filter(fc =>
          fc.key === 'feat-l1' || fc.key.startsWith('feat-')
        )
        return (
          <div id="feats-card" className="card order-4 scroll-mt-16">
            <div className="flex items-center justify-between mb-3">
              <h2 className="section-header mb-0">Feats</h2>
              <button
                type="button"
                className="text-xs bg-parchment-700 text-parchment-100 hover:bg-parchment-800 rounded px-2 py-1 font-semibold transition-colors"
                onClick={() => { setAddFeatOpen(true); setAddFeatSearch(''); setAddFeatPending(null) }}
              >+ Add Feat</button>
            </div>
            {featChoices.length === 0 && (
              <p className="text-sm text-parchment-400 italic">No feats yet.</p>
            )}
            {featChoices.map(fc => {
              const slug = typeof fc.value === 'string' ? fc.value : fc.value[0]
              const featDef = content.feats.find(f => f.slug === slug)
              const effect = featDef
              const sourceLabel = fc.key === 'feat-l1'
                ? 'Level 1'
                : fc.key.startsWith('feat-manual-')
                ? 'Added'
                : `${fc.key.replace(/^feat-/, '').replace(/-\d{10,}$/, '').replace(/-/g, ' ')} ASI`

              // Collect passive bonuses this specific feat grants for display
              const passiveBadges: string[] = []
              if (effect?.initiativeBonus) passiveBadges.push(`+${effect.initiativeBonus} Initiative`)
              if (effect?.speedBonus) passiveBadges.push(`+${effect.speedBonus}ft Speed`)
              if (effect?.passivePerceptionBonus) passiveBadges.push(`+${effect.passivePerceptionBonus} Passive Perception`)
              if (effect?.passiveInvestigationBonus) passiveBadges.push(`+${effect.passiveInvestigationBonus} Passive Investigation`)
              if (effect?.hpBonusPerLevel) passiveBadges.push(`+${effect.hpBonusPerLevel * level} HP (Tough)`)
              if (effect?.naturalArmorBase) passiveBadges.push(`Natural Armor AC ${effect.naturalArmorBase}+DEX`)
              if (effect?.concentrationAdvantage) passiveBadges.push('Adv. on Concentration saves')

              const allGranted = [...(effect?.grantedCantrips ?? []), ...(effect?.grantedSpells ?? [])]

              return (
                <div key={fc.key} className="mb-3 p-3 rounded border border-parchment-100">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs bg-amber-100 text-amber-700 rounded px-1.5 py-0.5 capitalize">{sourceLabel}</span>
                    <span className="font-medium">{featDef?.name ?? slug}</span>
                    {featDef?.prerequisite && (
                      <span className="text-xs text-parchment-400">Prereq: {featDef.prerequisite}</span>
                    )}
                    {effect?.abilityScoreIncrease && (
                      <span className="text-xs bg-blue-50 text-blue-600 border border-blue-200 rounded px-1.5 py-0.5">
                        +1 {effect.abilityScoreIncrease.from.map(a => ABILITY_LABELS[a] ?? a.toUpperCase()).join('/')}
                      </span>
                    )}
                    <button
                      type="button"
                      title="Remove feat"
                      className="ml-auto text-xs text-red-400 hover:text-red-600 transition-colors"
                      onClick={() => { offerUndo(`Removed ${content.feats.find(f => f.slug === fc.value)?.name ?? 'the feat'}`); patch({ featuresChosen: char.featuresChosen.filter(f => f.key !== fc.key) }) }}
                    >Remove</button>
                  </div>

                  {/* Passive stat badges */}
                  {passiveBadges.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {passiveBadges.map(b => (
                        <span key={b} className="text-xs bg-green-100 text-green-700 rounded px-1.5 py-0.5">✓ {b}</span>
                      ))}
                    </div>
                  )}

                  {/* Granted spells */}
                  {allGranted.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {allGranted.map(s => (
                        <span key={s.slug} className="text-xs bg-indigo-100 text-indigo-700 rounded px-1.5 py-0.5">
                          {s.name}{s.usesPerLongRest ? ` (${s.usesPerLongRest}/LR)` : s.level === 0 ? ' (cantrip)' : ' (at will)'}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Structured notes from FEAT_EFFECTS (preferred) or scraped description */}
                  {effect?.notes ? (
                    <ul className="text-sm text-parchment-600 mt-2 list-disc list-inside space-y-0.5">
                      {effect.notes.map(n => <li key={n}>{n}</li>)}
                    </ul>
                  ) : featDef?.description ? (
                    featureText(`feat-${fc.key}`, featDef.description, 'mt-2')
                  ) : null}
                  {/* Expertise picker for feats that grant it */}
                  {effect?.grantedExpertise && (() => {
                    const expertiseKey = `feat-expertise-${slug}`
                    const existing = char.featuresChosen.find(fc => fc.key === expertiseKey)
                    const chosen: string[] = !existing ? [] : Array.isArray(existing.value) ? existing.value : [existing.value]
                    const needed = effect.grantedExpertise
                    if (chosen.length >= needed) {
                      return (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {chosen.map(s => (
                            <span key={s} className="text-xs bg-indigo-100 text-indigo-700 rounded px-2 py-0.5">
                              ✓ Expertise: {SKILL_LABELS[s as keyof typeof SKILL_LABELS] ?? s}
                            </span>
                          ))}
                        </div>
                      )
                    }
                    return (
                      <div className="mt-2 p-2 rounded border border-amber-200 bg-amber-50">
                        <p className="text-xs text-amber-700 mb-1">Choose {needed - chosen.length} expertise skill{needed - chosen.length !== 1 ? 's' : ''}:</p>
                        <div className="flex flex-wrap gap-1">
                          {SKILLS.filter(s => char.skillProficiencies.includes(s) && !char.skillExpertise.includes(s) && !chosen.includes(s)).map(s => (
                            <button
                              key={s}
                              className="text-xs bg-parchment-50 border border-amber-300 text-amber-800 rounded px-2 py-0.5 hover:bg-amber-100"
                              onClick={() => {
                                const next = [...chosen, s]
                                const fc: typeof char.featuresChosen[0] = { key: expertiseKey, value: next }
                                const updated = char.featuresChosen.filter(f => f.key !== expertiseKey)
                                patch({
                                  featuresChosen: [...updated, fc],
                                  skillExpertise: [...new Set([...char.skillExpertise, s])],
                                  // A class expertise pick is official, not a hand edit — record it in the baseline
                                  skillBaseline: {
                                    proficiencies: [...skillBaseProf],
                                    expertise: [...new Set([...skillBaseExpert, s])],
                                  },
                                })
                              }}
                            >
                              {SKILL_LABELS[s]}
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  })()}
                </div>
              )
            })}
          </div>
        )
      })()}

      {/* Background feature */}
      {(() => {
        const bg = content.backgrounds.find(b => b.slug === char.backgroundSlug)
        if (!bg) return null
        return (
          <div className="card order-5">
            <h2 className="section-header">Background: {bg.name}</h2>
            <div className="p-3 rounded border border-parchment-100">
              <div className="font-medium">{bg.feature.name}</div>
              {bg.feature.description && featureText('background-feature', bg.feature.description, 'mt-1')}
            </div>
            {(bg.skillProficiencies.length > 0 || bg.toolProficiencies.length > 0 || bg.languages > 0) && (
              <div className="mt-2 flex gap-4 text-xs text-parchment-500">
                {bg.skillProficiencies.length > 0 && <span>Skills: {bg.skillProficiencies.map(s => SKILL_LABELS[toSkillKey(s) as keyof typeof SKILL_LABELS] ?? s).join(', ')}</span>}
                {bg.toolProficiencies.length > 0 && <span>Tools: {bg.toolProficiencies.join(', ')}</span>}
                {bg.languages > 0 && <span>Languages: +{bg.languages} of your choice</span>}
              </div>
            )}
            {(() => {
              const college = STRIXHAVEN_COLLEGES[bg.slug]
              if (!college) return null
              const firstLevelOptions = college.byLevel.find(r => r.level === 1)?.spells ?? []
              const chosenCantrip = char.featuresChosen.find(fc => fc.key === 'strixhaven-cantrip')?.value as string | undefined
              const chosenSpell = char.featuresChosen.find(fc => fc.key === 'strixhaven-spell')?.value as string | undefined
              const resolveSlug = (name: string) =>
                content.spells.find(sp => sp.name.toLowerCase() === name.toLowerCase())?.slug
              const setPick = (key: string, level: number, value: string) => {
                const current = char.featuresChosen.find(fc => fc.key === key)?.value as string | undefined
                const toggleOff = current === value
                const features = toggleOff
                  ? char.featuresChosen.filter(fc => fc.key !== key)
                  : [...char.featuresChosen.filter(fc => fc.key !== key), { key, value }]
                // Keep the spellbook in sync: drop the previously-added pick, add the new one
                // if it resolves to a real library spell (tagged classSlug 'strixhaven' for cleanup).
                let spells = char.spells
                const oldSlug = current ? resolveSlug(current) : undefined
                if (oldSlug) spells = spells.filter(s => !(s.spellSlug === oldSlug && s.classSlug === 'strixhaven'))
                if (!toggleOff) {
                  const newSlug = resolveSlug(value)
                  if (newSlug && !spells.some(s => s.spellSlug === newSlug && s.classSlug === 'strixhaven')) {
                    spells = [...spells, {
                      spellSlug: newSlug, name: value, classSlug: 'strixhaven', prepared: true, isHomebrew: false, grantedBy: 'strixhaven',
                      ...(level === 1 ? { usesPerLongRest: 1, freeUseKey: 'strixhaven-spell' } : {}),
                    }]
                  }
                }
                patch({ featuresChosen: features, spells })
              }
              const inSpellbook = (name: string) => !!resolveSlug(name)
              const freeUsed = (char.freeSpellUses?.['strixhaven-spell'] ?? 0) >= 1
              return (
                <div className="mt-3 p-3 rounded border border-violet-200 bg-violet-50/50">
                  <div className="text-xs font-semibold text-violet-800 uppercase tracking-wide mb-1">
                    Strixhaven Initiate — {college.college} Spells
                  </div>
                  <p className="text-xs text-parchment-600 mb-2">
                    Learn <strong>1 cantrip</strong> and <strong>1 first-level spell</strong> from this list. You can cast the
                    1st-level spell once per long rest without a slot (using {college.ability.toUpperCase()} if you have no
                    spellcasting class), or with any spell slots you have.
                  </p>

                  {/* Cantrip picker */}
                  <div className="text-xs font-semibold text-parchment-700 mb-1">Cantrip <span className="text-parchment-400 font-normal">(choose 1)</span></div>
                  <div className="flex flex-wrap gap-1.5 mb-2.5">
                    {college.cantrips.map(c => (
                      <button key={c} type="button" onClick={() => setPick('strixhaven-cantrip', 0, c)}
                        className={`text-xs rounded px-2 py-1 border transition-colors ${chosenCantrip === c ? 'bg-violet-600 text-white border-violet-600' : 'bg-parchment-50 text-violet-700 border-violet-200 hover:border-violet-400'}`}>
                        {chosenCantrip === c ? '✓ ' : ''}{c}
                      </button>
                    ))}
                  </div>

                  {/* 1st-level spell picker */}
                  <div className="text-xs font-semibold text-parchment-700 mb-1">1st-Level Spell <span className="text-parchment-400 font-normal">(choose 1)</span></div>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {firstLevelOptions.map(s => (
                      <button key={s} type="button" onClick={() => setPick('strixhaven-spell', 1, s)}
                        className={`text-xs rounded px-2 py-1 border transition-colors ${chosenSpell === s ? 'bg-violet-600 text-white border-violet-600' : 'bg-parchment-50 text-violet-700 border-violet-200 hover:border-violet-400'}`}>
                        {chosenSpell === s ? '✓ ' : ''}{s}
                      </button>
                    ))}
                  </div>
                  {((chosenCantrip && !inSpellbook(chosenCantrip)) || (chosenSpell && !inSpellbook(chosenSpell))) && (
                    <p className="text-[10px] text-parchment-400 mb-2 -mt-1">
                      Picks not in the spell library are tracked here but not added to your spellbook list.
                    </p>
                  )}

                  {/* Free-cast tracker for the chosen 1st-level spell */}
                  {chosenSpell && (
                    <div className={`flex items-center gap-2 p-2 rounded border text-xs mb-2.5 ${freeUsed ? 'bg-parchment-50 border-parchment-200' : 'bg-green-50 border-green-200'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${freeUsed ? 'bg-parchment-300' : 'bg-green-500'}`} />
                      <span className={`font-medium ${freeUsed ? 'text-parchment-500 line-through' : 'text-green-700'}`}>
                        {chosenSpell} — free cast {freeUsed ? 'used' : 'available'} (1 / long rest)
                      </span>
                      <button type="button"
                        className="ml-auto text-xs px-2 py-0.5 rounded border border-parchment-200 hover:bg-parchment-100 transition-colors"
                        onClick={() => patch({ freeSpellUses: { ...char.freeSpellUses, 'strixhaven-spell': freeUsed ? 0 : 1 } })}>
                        {freeUsed ? 'Restore' : 'Use'}
                      </button>
                    </div>
                  )}

                  {/* Full college list for reference */}
                  <div className="text-[10px] font-bold text-violet-400 uppercase tracking-widest mb-1">{college.college} spell list</div>
                  <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
                    {college.byLevel.map(row => (
                      <div key={row.level} className="contents">
                        <span className="text-violet-500 font-medium text-right">{['1st','2nd','3rd','4th','5th'][row.level - 1]}</span>
                        <span className="text-parchment-700">{row.spells.join(', ')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}
          </div>
        )
      })()}
    </div>
  )
}
