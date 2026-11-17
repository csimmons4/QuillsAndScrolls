import { Character } from '../../character/model'
import { abilityModFor, formatMod, spellSaveDC, spellAttackBonus, spellcastingAbilityFor } from '../../character/derive'
import { CASTER_TYPE, effectiveCasterLevel, spellProgression, cantripsKnownAt, maxSpellLevelAt, MYSTIC_ARCANUM_LEVELS, mysticArcanumKey, mysticArcanumEntry } from '../../data/classData'
import { cleanHigherLevels, levelLine, parseMaterial } from '../../components/SpellStatBlock'
import { cantripDiceAtLevel } from '../../data/spellMeta'
import { HourglassIcon, TargetIcon, ClockIcon, FlaskIcon, BookIcon } from '../../components/SheetIcons'
import type { SpellDef } from '../../content/loaders'
import { ABILITY_FULL, DAMAGE_TYPE_STYLE, computeUpcastDamage, parseUpcastScaling } from './helpers'
import { useSheet } from './SheetContext'

/** The Spells tab: spellcasting header, spells by level with the spell card panel, and the library */
export function SpellsTab() {
  const {
    id,
    content,
    char,
    tab,
    spellFilter,
    setSpellFilter,
    spellBrowserSearch,
    setSpellBrowserSearch,
    spellBrowserLevel,
    setSpellBrowserLevel,
    showSpellLibrary,
    setShowSpellLibrary,
    castHighlight,
    setCastHighlight,
    selectedSpellKey,
    setSelectedSpellKey,
    askConfirm,
    spellTabClass,
    setSpellTabClass,
    save,
    offerUndo,
    patch,
    level,
    pb,
    itemBonuses,
    effectiveChar,
    freeSpells,
    classResources,
    isMulticlassCaster,
    multiclassMaxes,
    spellClassSlug,
  } = useSheet()
  return (
    <div className="space-y-4">
      {spellClassSlug ? (() => {
        // The tab works on one casting class at a time; multiclass casters pick which.
        const casterClasses = char.classes.filter(c => spellcastingAbilityFor(c, content))
        const primaryClass = casterClasses.find(c => c.classSlug === spellTabClass) ?? casterClasses[0]
        const primarySlug = primaryClass?.classSlug ?? ''
        // How this class learns spells (Eldritch Knight / Arcane Trickster: via the subclass)
        const progression = spellProgression(primarySlug, primaryClass?.subclassSlug)
        const isPrepared = progression?.preparedCaster ?? false
        const isSpellbookCaster = progression?.isSpellbookCaster ?? false
        const classLevel = primaryClass?.level ?? 1
        const spellAbility = (primaryClass && spellcastingAbilityFor(primaryClass, content)) ?? 'int'
        const abilMod = abilityModFor(effectiveChar, spellAbility)
        // Half casters (Paladin, Artificer) prepare ability mod + half their level, rounded down
        const prepLimit = isPrepared
          ? Math.max(1, ['paladin', 'artificer'].includes(primarySlug) ? abilMod + Math.floor(classLevel / 2) : abilMod + classLevel)
          : null
        // Only this class's own spells count toward its limits (feat/Strixhaven spells and
        // free once-a-day spells like Mystic Arcanum are extra)
        const preparedCount = char.spells.filter(s => {
          const def = content.spells.find(d => d.slug === s.spellSlug)
          return s.prepared && s.classSlug === primarySlug && (def?.level ?? 0) > 0 && !s.freeUseKey && !s.grantedBy
        }).length
        const cantripMax = cantripsKnownAt(progression, classLevel)
        // A feat's or race's cantrip (Magic Initiate, High Elf) is extra, even when tagged with this class
        const cantripCount = char.spells.filter(s => {
          const def = content.spells.find(d => d.slug === s.spellSlug)
          return s.classSlug === primarySlug && (def?.level ?? 0) === 0 && !s.grantedBy
        }).length
        const atCantripCap = cantripMax > 0 && cantripCount >= cantripMax
        // Eldritch Knights and Arcane Tricksters learn from the wizard list
        const spellListSlug = progression?.spellList ?? primarySlug
        const matchesClassFn = (spellClasses: string[]) =>
          spellClasses.some(c => c.toLowerCase().replace(/\s*\(.*?\)/g, '').trim() === spellListSlug)
        // Highest spell level this class can learn or prepare, as if single-classed (PHB p.164)
        const maxSlotLevel = maxSpellLevelAt(primarySlug, classLevel,
          content.classes.find(c => c.slug === primarySlug)?.spellSlotTable, primaryClass?.subclassSlug)
        const knownSlugs = new Set(char.spells.map(s => s.spellSlug))
        const availableSpells = content.spells
          .filter(s => matchesClassFn(s.classes))
          .filter(s => !knownSlugs.has(s.slug))
          .filter(s => s.level === 0 || s.level <= Math.max(maxSlotLevel, 1))
        // Spells ready to cast: prepared ones, every cantrip, and everything a known caster
        // (bard, sorcerer, warlock, ranger, Eldritch Knight, Arcane Trickster) has learned
        const preparedSpells = char.spells.filter(s => {
          if (s.prepared) return true
          if ((content.spells.find(d => d.slug === s.spellSlug)?.level ?? 0) === 0) return true
          const entry = char.classes.find(c => c.classSlug === s.classSlug)
          const prog = entry && spellProgression(entry.classSlug, entry.subclassSlug)
          return !!prog && !prog.preparedCaster
        })
        const atPrepCap = isPrepared && prepLimit !== null && preparedCount >= prepLimit
        // Spells-known cap for known casters (Bard/Sorcerer/Warlock/Ranger — they learn a
        // fixed number of spells rather than preparing from a list each day).
        const knownMax = !isPrepared ? progression?.spellsKnownTable?.[classLevel - 1] : undefined
        const knownCount = char.spells.filter(s => {
          const def = content.spells.find(d => d.slug === s.spellSlug)
          return s.classSlug === primarySlug && (def?.level ?? 0) > 0 && !s.freeUseKey && !s.grantedBy
        }).length
        const atKnownCap = !!knownMax && knownCount >= knownMax
        const ordinals = ['Cantrips','1st','2nd','3rd','4th','5th','6th','7th','8th','9th']

        // School → left-border accent color in the Spell Library (hex, used via inline style to avoid Tailwind class conflicts)
        const schoolAccentHex: Record<string, string> = {
          Abjuration: '#60a5fa', Conjuration: '#fbbf24',
          Divination: '#22d3ee', Enchantment: '#f472b6',
          Evocation: '#f87171', Illusion: '#c084fc',
          Necromancy: '#15803d', Transmutation: '#fb923c',
        }
        const schoolBorderColor = (school?: string) => school ? (schoolAccentHex[school] ?? '#d6cdb8') : '#d6cdb8'

        // Resolve which caster class a given spell entry uses for its DC/attack.
        // Falls back to the primary spell class for non-caster tags (e.g. Strixhaven).
        const classForEntry = (entryClassSlug?: string) =>
          (entryClassSlug && spellSaveDC(effectiveChar, entryClassSlug, content) > 0)
            ? entryClassSlug
            : primarySlug

        // Item-aware spell DC/attack — use effectiveChar (ability overrides applied) + item bonuses.
        const totalSpellDC  = (cls: string) => spellSaveDC(effectiveChar, cls, content)  + itemBonuses.spellDCBonus
        const totalSpellAtk = (cls: string) => spellAttackBonus(effectiveChar, cls, content) + itemBonuses.spellAttackBonus

        const slotMaxAt = (lvl: number) => multiclassMaxes
          ? (multiclassMaxes[String(lvl)] ?? 0)
          : (char.spellSlots[String(lvl)]?.max ?? 0)
        /** A level's spell slots as violet gems: click a lit one to spend it, a spent one to get it back */
        const slotGems = (lvl: number) => {
          const slotMax = slotMaxAt(lvl)
          const slotUsed = char.spellSlots[String(lvl)]?.used ?? 0
          const slotLeft = slotMax - slotUsed
          return (
            <div className="flex items-center gap-1">
              {Array.from({ length: slotMax }, (_, i) => {
                const available = i < slotLeft
                return (
                  <button
                    key={i}
                    type="button"
                    title={available ? 'Expend slot' : 'Recover slot'}
                    aria-label={`${ordinals[lvl]}-level slot ${i + 1} of ${slotMax}: ${available ? 'available' : 'spent'}`}
                    onClick={() => {
                      const used = available ? slotUsed + 1 : slotUsed - 1
                      patch({ spellSlots: { ...char.spellSlots, [String(lvl)]: { max: slotMax, used } } })
                    }}
                    className="w-6 h-6 flex items-center justify-center group"
                  >
                    <div className={`w-3.5 h-3.5 rotate-45 border ${
                      available
                        ? 'spell-gem'
                        : 'bg-parchment-200 border-parchment-300 opacity-40 transition-all duration-150 group-hover:scale-125'
                    }`}
                      style={available ? {
                        animation: 'pip-pulse 2.4s ease-in-out infinite',
                        animationDelay: `${i * 0.18}s`,
                      } : undefined}
                    />
                  </button>
                )
              })}
              <span className="text-xs text-parchment-400 w-9 text-right">{slotLeft}/{slotMax}</span>
            </div>
          )
        }
        /** Casting time as a word or two for the list: "Action", "Bonus", "Reaction", "1 min" */
        const shortTime = (t?: string) => {
          if (!t) return ''
          const lower = t.toLowerCase()
          if (lower.startsWith('1 action')) return 'Action'
          if (lower.startsWith('1 bonus')) return 'Bonus'
          if (lower.startsWith('1 reaction')) return 'Reaction'
          const m = lower.match(/^(\d+)\s*(minute|hour|round)/)
          if (m) return `${m[1]} ${m[2] === 'minute' ? 'min' : m[2] === 'hour' ? 'hr' : 'rd'}`
          return t.split(',')[0]
        }

        // Every spell the character can cast, as one row: the class's own (`entry`) and those from
        // feats, race and subclass
        type SpellRow = {
          key: string
          name: string
          level: number
          def?: SpellDef
          cls: string                                   // class whose DC and attack bonus it uses
          dmg: { dice: string; type?: string } | null   // at the character's level (cantrips scale)
          usesLeft?: number
          usesMax?: number
          useKey?: string                               // its counter in freeSpellUses
          source?: string                               // what grants it
          sourceNote?: string
          slotCast: boolean                             // can be cast with a spell slot
          entry?: Character['spells'][number]
          library?: boolean                             // in the spell library, not yet learned
        }
        const entryRow = (s: Character['spells'][number]): SpellRow => {
          const def = content.spells.find(d => d.slug === s.spellSlug)
          const lvl = def?.level ?? 0
          const dice = def?.damage ? (lvl === 0 ? cantripDiceAtLevel(def.slug, level, def.damage.dice) ?? def.damage.dice : def.damage.dice) : undefined
          const source = !s.grantedBy ? undefined
            : s.grantedBy.startsWith('feat:') ? content.feats.find(f => f.slug === s.grantedBy!.slice(5))?.name ?? 'a feat'
            : s.grantedBy === 'strixhaven' ? 'Strixhaven Initiate' : 'High Elf'
          const uses = s.usesPerLongRest && s.freeUseKey
            ? { usesMax: s.usesPerLongRest, usesLeft: Math.max(0, s.usesPerLongRest - (char.freeSpellUses?.[s.freeUseKey] ?? 0)), useKey: s.freeUseKey }
            : {}
          return {
            key: `entry:${s.spellSlug}`, name: s.name, level: lvl, def, cls: classForEntry(s.classSlug),
            dmg: dice ? { dice, type: def?.damage?.type } : null, ...uses,
            source, sourceNote: source ? `Always prepared · ${source}` : undefined,
            slotCast: lvl > 0, entry: s,
          }
        }
        const freeRow = (f: (typeof freeSpells)[number]): SpellRow => {
          const def = content.spells.find(d => d.slug === f.slug)
          // Cast with a higher slot (Tiefling's Hellish Rebuke at 2nd level): scale the dice
          const upBy = def && f.castLevel ? f.castLevel - def.level : 0
          const inc = upBy > 0 && def?.higherLevels ? parseUpcastScaling(def.higherLevels) : null
          const dice = !def?.damage ? undefined
            : inc ? computeUpcastDamage(def.damage.dice, inc.dice, upBy) ?? def.damage.dice
            : def.level === 0 ? cantripDiceAtLevel(def.slug, level, def.damage.dice) ?? def.damage.dice
            : def.damage.dice
          const fromSubclass = f.key.startsWith('subclass:')
          const uses = f.usesPerLongRest !== undefined
            ? { usesMax: f.usesPerLongRest, usesLeft: Math.max(0, f.usesPerLongRest - (char.freeSpellUses?.[f.key] ?? 0)), useKey: f.key }
            : {}
          return {
            key: `free:${f.key}`, name: f.name, level: f.level, def,
            cls: classForEntry(fromSubclass ? f.key.split(':')[1] : undefined),
            dmg: dice ? { dice, type: def?.damage?.type } : null, ...uses,
            source: f.source,
            sourceNote: f.alwaysPrepared ? `Always prepared · ${f.source}`
              : f.usesPerLongRest !== undefined ? `From ${f.source} · ${f.usesPerLongRest} free cast${f.usesPerLongRest > 1 ? 's' : ''} per long rest${f.castLevel ? ` at ${ordinals[f.castLevel]} level` : ''}`
              : `From ${f.source} · at will`,
            // Subclass spells use your slots; feats' spells can be cast with slots too, racial ones can't
            slotCast: f.level > 0 && (fromSubclass || f.key.startsWith('feat:')),
          }
        }

        const libraryRow = (def: SpellDef): SpellRow => ({
          key: `lib:${def.slug}`, name: def.name, level: def.level, def, cls: primarySlug,
          dmg: def.damage ? { dice: def.damage.dice, type: def.damage.type } : null,
          slotCast: false, library: true,
        })
        /** Prepare or learn a spell from the library (a wizard can also just copy it into the spellbook) */
        const learnSpell = (def: SpellDef, prepared: boolean) => {
          patch({ spells: [...char.spells, { spellSlug: def.slug, name: def.name, classSlug: primarySlug, prepared, isHomebrew: def.source.site === 'homebrew' }] })
          setSelectedSpellKey(prepared || !isSpellbookCaster ? `entry:${def.slug}` : null)
        }
        const learnLabel = isSpellbookCaster ? 'Add to spellbook' : isPrepared ? 'Prepare' : 'Learn'

        // Name · casting time · hit or DC · damage · marks. Spelled out so Tailwind keeps it.
        const SPELL_COLS = 'sm:grid-cols-[minmax(0,1fr)_4.5rem_4.5rem_8.5rem_4.5rem]'
        const spellRow = (r: SpellRow) => {
          const selected = selectedSpellKey === r.key
          const conc = !!r.def && char.concentratingOn === r.def.slug
          const roll = r.def?.attackRoll ? formatMod(totalSpellAtk(r.cls))
            : r.def?.savingThrow ? `${r.def.savingThrow.ability.toUpperCase()} ${totalSpellDC(r.cls)}` : ''
          const dmgText = r.dmg?.type ? (DAMAGE_TYPE_STYLE[r.dmg.type] ?? DAMAGE_TYPE_STYLE.force).text : 'text-parchment-700'
          return (
            <div key={r.key} data-spell-key={r.key} className="scroll-mt-16">
              <div className="flex items-center gap-1">
              <button type="button" aria-expanded={selected}
                onClick={() => setSelectedSpellKey(selected ? null : r.key)}
                className={`flex-1 min-w-0 grid grid-cols-[minmax(0,1fr)_auto] ${SPELL_COLS} items-center gap-x-3 px-2.5 py-1.5 rounded-md text-left transition-colors ${
                  conc ? 'bg-amber-50 ring-1 ring-amber-300' : selected ? 'bg-parchment-100 ring-1 ring-parchment-300' : 'hover:bg-parchment-100'
                }`}>
                <span className="flex items-center gap-1.5 min-w-0">
                  {conc && <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" style={{ boxShadow: '0 0 6px 2px rgba(251,191,36,0.7)' }} title="Concentrating" />}
                  <span className="text-sm font-semibold text-parchment-900 truncate">{r.name}</span>
                  {r.source && <span className="text-[11px] text-indigo-500 shrink-0" title={r.sourceNote}>★</span>}
                </span>
                <span className="hidden sm:block text-xs text-parchment-500 truncate">{shortTime(r.def?.castingTime)}</span>
                <span className="hidden sm:block text-xs font-semibold text-violet-700 whitespace-nowrap">{roll}</span>
                <span className={`hidden sm:block text-xs font-semibold truncate ${dmgText}`}>{r.dmg ? `${r.dmg.dice}${r.dmg.type ? ` ${r.dmg.type}` : ''}` : ''}</span>
                <span className="flex items-center justify-end gap-1">
                  {r.usesMax !== undefined && (
                    <span className={`text-[10px] font-semibold rounded px-1 ${r.usesLeft! > 0 ? 'bg-indigo-50 text-indigo-700' : 'bg-parchment-100 text-parchment-400 line-through'}`}
                      title="Free casts left before a long rest">{r.usesLeft}/{r.usesMax}</span>
                  )}
                  {r.def?.concentration && <span className="w-4 h-4 rounded text-[9px] font-bold flex items-center justify-center bg-amber-100 text-amber-700" title="Concentration">C</span>}
                  {r.def?.ritual && <span className="w-4 h-4 rounded text-[9px] font-bold flex items-center justify-center bg-blue-100 text-blue-700" title="Ritual">R</span>}
                </span>
              </button>
              {r.library && r.def && (
                <button type="button" disabled={!isSpellbookCaster && atPrepCap}
                  onClick={() => learnSpell(r.def!, !isSpellbookCaster)}
                  title={!isSpellbookCaster && atPrepCap ? `Prepared limit reached (${prepLimit})` : `${learnLabel}: ${r.name}`}
                  aria-label={`${learnLabel}: ${r.name}`}
                  className="shrink-0 w-7 h-7 rounded-full border border-violet-300 text-violet-700 text-base font-bold leading-none hover:bg-violet-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >+</button>
              )}
              </div>
              {/* Narrow screens open the spell under its row; wide ones show it in the panel beside the list */}
              {selected && (
                <div className="lg:hidden mx-1 mt-1 mb-2">{spellDetails(r)}</div>
              )}
            </div>
          )
        }

        /** The open spell as a card: a seal with its level in the school's colour, the four facts,
         *  its big numbers, ways to cast it, then its text and what it does at higher levels */
        const spellDetails = (r: SpellRow) => {
          const def = r.def
          const slotOrdinals = ['1st','2nd','3rd','4th','5th','6th','7th','8th','9th']
          if (!def) return (
            <div className="rounded-xl border border-parchment-200 bg-parchment-50 p-4 text-sm text-parchment-500">{r.name}: no details in the reference data.</div>
          )
          const hex = schoolAccentHex[def.school] ?? '#b08d57'
          const slotLevels = r.slotCast ? [1,2,3,4,5,6,7,8,9].filter(lvl => lvl >= r.level && slotMaxAt(lvl) > 0) : []
          const isConcentrating = char.concentratingOn === def.slug
          const castAt = async (lvl: number) => {
            const max = slotMaxAt(lvl)
            const used = char.spellSlots[String(lvl)]?.used ?? 0
            if (used >= max) return
            const startConc = !!def.concentration && char.concentratingOn !== def.slug
            if (startConc && char.concentratingOn) {
              const prev = content.spells.find(sp => sp.slug === char.concentratingOn)?.name ?? char.concentratingOn
              if (!(await askConfirm({ title: 'End Concentration?', message: `Casting ${r.name} ends your concentration on ${prev}.`, confirmLabel: `Cast ${r.name}` }))) return
            }
            patch({
              spellSlots: { ...char.spellSlots, [String(lvl)]: { max, used: used + 1 } },
              ...(startConc ? { concentratingOn: def.slug } : {}),
            })
            setCastHighlight({ slug: def.slug, level: lvl })
          }
          // A warlock spell (or one from a warlock subclass) up to the pact slot level
          const pactCast = !!char.pactSlots && r.level > 0 && r.level <= char.pactSlots.level && r.cls === 'warlock' && !r.library
          const pactLeft = char.pactSlots ? char.pactSlots.max - char.pactSlots.used : 0
          const castWithPact = async () => {
            if (!char.pactSlots || pactLeft <= 0) return
            const startConc = !!def.concentration && char.concentratingOn !== def.slug
            if (startConc && char.concentratingOn) {
              const prev = content.spells.find(sp => sp.slug === char.concentratingOn)?.name ?? char.concentratingOn
              if (!(await askConfirm({ title: 'End Concentration?', message: `Casting ${r.name} ends your concentration on ${prev}.`, confirmLabel: `Cast ${r.name}` }))) return
            }
            patch({
              pactSlots: { ...char.pactSlots, used: char.pactSlots.used + 1 },
              ...(startConc ? { concentratingOn: def.slug } : {}),
            })
            setCastHighlight({ slug: def.slug, level: char.pactSlots.level })
          }
          const toggleConcentration = async () => {
            if (isConcentrating) { patch({ concentratingOn: undefined }); return }
            if (char.concentratingOn) {
              const prev = content.spells.find(sp => sp.slug === char.concentratingOn)?.name ?? char.concentratingOn
              if (!(await askConfirm({ title: 'End Concentration?', message: `Concentrating on ${r.name} ends your concentration on ${prev}.`, confirmLabel: 'Switch' }))) return
            }
            patch({ concentratingOn: def.slug })
          }
          const spent = r.useKey ? char.freeSpellUses?.[r.useKey] ?? 0 : 0
          const upcast = r.level > 0 && def.higherLevels ? parseUpcastScaling(def.higherLevels) : null
          const upcastLevels = slotLevels.filter(lvl => lvl > r.level)
          const s = r.entry
          // "1 reaction, which you take when…": the short form up top, the trigger underneath
          const [castMain, ...castRest] = (def.castingTime ?? '').split(',')
          const material = parseMaterial(def.components)
          const materialText = def.components?.match(/\(([^)]+)\)/)?.[1]
          const componentLetters = (def.components ?? '').split('(')[0].split(',').map(c => c.trim()).filter(Boolean)
          const dmgStyle = r.dmg?.type ? DAMAGE_TYPE_STYLE[r.dmg.type] ?? DAMAGE_TYPE_STYLE.force : null
          const fact = (icon: React.ReactNode, label: string, value: React.ReactNode, sub?: string) => (
            <div className="bg-parchment-50 px-3 py-2 flex gap-2 min-w-0">
              <span className="mt-0.5 shrink-0" style={{ color: hex }}>{icon}</span>
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-widest text-parchment-500">{label}</div>
                <div className="text-sm text-parchment-900 leading-snug">{value}</div>
                {sub && <div className="text-[11px] text-parchment-500 leading-snug mt-0.5">{sub}</div>}
              </div>
            </div>
          )
          return (
            <article key={r.key} className="spell-card-in rounded-xl border bg-parchment-50 shadow-sm overflow-hidden" style={{ borderColor: `${hex}88` }}>
              {/* Header, washed with the school's colour */}
              <header className="px-4 pt-4 pb-3" style={{ background: `linear-gradient(135deg, ${hex}38, ${hex}10 55%, transparent 85%)` }}>
                <div className="flex items-start gap-3">
                  <div className="spell-seal shrink-0" style={{ '--seal': hex } as React.CSSProperties}
                    title={r.level === 0 ? 'Cantrip' : `${slotOrdinals[r.level - 1]}-level spell`}>
                    {r.level === 0 ? '✦' : r.level}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-bold text-parchment-900 leading-tight">{r.name}</h3>
                    <p className="text-xs italic text-parchment-600 mt-0.5 first-letter:uppercase">{levelLine(def)}{def.ritual ? ' (ritual)' : ''}</p>
                    {r.sourceNote && <p className="text-[11px] font-semibold text-indigo-600 mt-0.5">{r.sourceNote}</p>}
                  </div>
                  <button type="button" onClick={() => setSelectedSpellKey(null)} aria-label="Close" title="Close"
                    className="w-7 h-7 -mr-1 -mt-1 rounded-full text-sm text-parchment-500 hover:bg-parchment-100 hover:text-parchment-900 shrink-0">✕</button>
                </div>
                {(def.concentration || def.ritual || material) && (
                  <div className="flex flex-wrap gap-1 mt-2.5">
                    {def.concentration && (
                      <span className={`text-[11px] font-semibold rounded-full px-2 py-0.5 border ${isConcentrating ? 'bg-amber-400 border-amber-400 text-white' : 'bg-amber-50 border-amber-300 text-amber-800'}`}>
                        {isConcentrating ? '● Concentrating' : 'Concentration'}
                      </span>
                    )}
                    {def.ritual && <span className="text-[11px] font-semibold rounded-full px-2 py-0.5 border bg-blue-50 border-blue-200 text-blue-700" title="Can be cast as a ritual: 10 minutes longer, no slot">Ritual</span>}
                    {material && (
                      <span className={`text-[11px] font-semibold rounded-full px-2 py-0.5 border ${material.consumed ? 'bg-orange-50 border-orange-200 text-orange-700' : 'bg-parchment-100 border-parchment-300 text-parchment-700'}`}>
                        {material.cost}{material.consumed ? ', consumed' : ''}
                      </span>
                    )}
                  </div>
                )}
              </header>

              {/* The four facts */}
              <div className="grid grid-cols-2 gap-px bg-parchment-200 border-y border-parchment-200">
                {fact(<HourglassIcon className="w-4 h-4" />, 'Casting time', castMain, castRest.join(',').trim() || undefined)}
                {fact(<TargetIcon className="w-4 h-4" />, 'Range', def.range)}
                {fact(<ClockIcon className="w-4 h-4" />, 'Duration', def.concentration ? def.duration.replace(/^concentration,\s*/i, '') : def.duration)}
                {fact(<FlaskIcon className="w-4 h-4" />, 'Components',
                  <span className="flex gap-1">
                    {componentLetters.map(c => (
                      <span key={c} className="w-5 h-5 rounded text-[11px] font-bold flex items-center justify-center bg-parchment-100 border border-parchment-300 text-parchment-700">{c}</span>
                    ))}
                  </span>,
                  materialText)}
              </div>

              {/* The numbers that matter in the moment */}
              {(r.dmg || def.savingThrow || def.attackRoll) && (
                <div className="px-4 py-3 flex items-stretch gap-3 border-b border-parchment-200">
                  {(def.attackRoll || def.savingThrow) && (
                    <div className="flex-1 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-center">
                      <div className="text-2xl font-bold leading-none text-violet-800">
                        {def.attackRoll ? formatMod(totalSpellAtk(r.cls)) : `DC ${totalSpellDC(r.cls)}`}
                      </div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-violet-600 mt-1">
                        {def.attackRoll ? 'to hit' : `${def.savingThrow!.ability.toUpperCase()} save`}
                      </div>
                      {!def.attackRoll && def.savingThrow!.effectOnSave === 'half' && (
                        <div className="text-[10px] text-violet-500 leading-tight">half damage on a save</div>
                      )}
                    </div>
                  )}
                  {r.dmg && (
                    <div className={`flex-1 rounded-lg border px-3 py-2 text-center ${dmgStyle ? `${dmgStyle.bg} ${dmgStyle.border}` : 'bg-red-50 border-red-200'}`}>
                      <div className={`text-2xl font-bold leading-none ${dmgStyle ? dmgStyle.text : 'text-red-800'}`}>{r.dmg.dice}</div>
                      <div className={`text-[10px] font-bold uppercase tracking-widest mt-1 ${dmgStyle ? dmgStyle.text : 'text-red-700'}`}>{r.dmg.type ? `${r.dmg.type} damage` : 'damage'}</div>
                    </div>
                  )}
                </div>
              )}

              {/* From the library: add it */}
              {r.library && (
                <div className="px-4 py-3 border-b border-parchment-200 flex flex-wrap items-center gap-2">
                  {isSpellbookCaster && (
                    <button type="button" onClick={() => learnSpell(def, false)}
                      className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-600 text-white hover:bg-amber-700 transition-colors shadow-sm"
                    >Add to spellbook</button>
                  )}
                  <button type="button" disabled={atPrepCap} onClick={() => learnSpell(def, true)}
                    className="px-3 py-1 rounded-full text-xs font-semibold bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
                  >{isSpellbookCaster ? 'Prepare directly' : isPrepared ? 'Prepare' : 'Learn'}</button>
                  {atPrepCap && <span className="text-xs text-amber-600">Prepared limit reached ({prepLimit})</span>}
                </div>
              )}

              {/* Ways to cast it */}
              {!r.library && (slotLevels.length > 0 || r.slotCast || r.useKey || def.concentration) && (
                <div className="px-4 py-3 border-b border-parchment-200 space-y-2">
                  {/* Pact Magic: a warlock spell up to the pact slot level, cast at that level */}
                  {pactCast && (
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-parchment-500 mb-1.5">Cast with a pact slot</div>
                      <button type="button" disabled={pactLeft <= 0} onClick={castWithPact}
                        title={pactLeft <= 0 ? 'No pact slots left (a short rest restores them)' : `Cast ${r.name} with a pact slot at ${slotOrdinals[char.pactSlots!.level - 1]} level — ${pactLeft} left`}
                        className={`inline-flex items-center gap-1.5 pl-2 pr-2.5 py-1 rounded-full border text-xs font-semibold transition-colors ${pactLeft <= 0 ? 'opacity-40 cursor-not-allowed border-parchment-200 text-parchment-400 bg-parchment-50' : 'bg-indigo-600 border-indigo-600 text-white hover:bg-indigo-700 shadow-sm'}`}
                      >
                        <span className={`w-2 h-2 rotate-45 ${pactLeft <= 0 ? 'bg-parchment-300' : 'bg-indigo-200'}`} aria-hidden />
                        {slotOrdinals[char.pactSlots!.level - 1]}
                        <span className="font-normal opacity-75">{pactLeft} left</span>
                      </button>
                    </div>
                  )}
                  {slotLevels.length > 0 && (
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-parchment-500 mb-1.5">Cast with a slot</div>
                      <div className="flex flex-wrap gap-1.5">
                        {slotLevels.map(lvl => {
                          const left = slotMaxAt(lvl) - (char.spellSlots[String(lvl)]?.used ?? 0)
                          const out = left <= 0
                          return (
                            <button key={lvl} type="button" disabled={out} onClick={() => castAt(lvl)}
                              title={out ? `No ${slotOrdinals[lvl - 1]}-level slots left` : `Cast ${r.name} with a ${slotOrdinals[lvl - 1]}-level slot — ${left} left`}
                              className={`inline-flex items-center gap-1.5 pl-2 pr-2.5 py-1 rounded-full border text-xs font-semibold transition-colors ${out ? 'opacity-40 cursor-not-allowed border-parchment-200 text-parchment-400 bg-parchment-50' : 'bg-violet-600 border-violet-600 text-white hover:bg-violet-700 shadow-sm'}`}
                            >
                              <span className={`w-2 h-2 rotate-45 ${out ? 'bg-parchment-300' : 'bg-violet-200'}`} aria-hidden />
                              {slotOrdinals[lvl - 1]}
                              <span className="font-normal opacity-75">{left} left</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                  {r.slotCast && slotLevels.length === 0 && !pactCast && <p className="text-xs italic text-parchment-400">No spell slots to cast this with.</p>}
                  {(r.useKey || def.concentration) && (
                    <div className="flex flex-wrap gap-1.5">
                      {r.useKey && r.usesMax !== undefined && (
                        <>
                          <button type="button" disabled={r.usesLeft === 0}
                            onClick={() => patch({ freeSpellUses: { ...char.freeSpellUses, [r.useKey!]: spent + 1 } })}
                            className={`px-3 py-1 rounded-full border text-xs font-semibold transition-colors ${r.usesLeft === 0 ? 'opacity-40 cursor-not-allowed border-parchment-200 text-parchment-400' : 'bg-indigo-50 border-indigo-300 text-indigo-700 hover:bg-indigo-100'}`}
                          >Cast free · {r.usesLeft}/{r.usesMax}</button>
                          {spent > 0 && (
                            <button type="button" onClick={() => patch({ freeSpellUses: { ...char.freeSpellUses, [r.useKey!]: Math.max(0, spent - 1) } })}
                              className="px-2.5 py-1 rounded-full border text-xs text-parchment-500 hover:text-indigo-600 border-parchment-200 hover:border-indigo-300 transition-colors"
                            >Restore</button>
                          )}
                        </>
                      )}
                      {def.concentration && (
                        <button type="button" onClick={toggleConcentration}
                          className={`px-3 py-1 rounded-full border text-xs font-semibold transition-colors ${isConcentrating ? 'bg-amber-400 border-amber-400 text-white' : 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100'}`}
                        >{isConcentrating ? 'Stop concentrating' : 'Concentrate'}</button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* The spell's text, opening with an illuminated letter */}
              {def.description && (
                <div className="px-4 py-3">
                  <p className="text-sm text-parchment-800 leading-relaxed whitespace-pre-line first-letter:float-left first-letter:text-4xl first-letter:leading-[0.85] first-letter:font-bold first-letter:mr-1.5 first-letter:mt-0.5 first-letter:text-[rgb(var(--accent))]">
                    {def.description}
                  </p>
                </div>
              )}
              {def.higherLevels && (
                <div className="mx-4 mb-3 rounded-lg border border-parchment-200 border-l-[3px] bg-parchment-100/60 px-3 py-2 space-y-2" style={{ borderLeftColor: hex }}>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-parchment-600">At Higher Levels</div>
                  {upcast && def.damage && upcastLevels.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {[r.level, ...upcastLevels].map(lvl => {
                        const total = lvl === r.level ? def.damage!.dice : computeUpcastDamage(def.damage!.dice, upcast.dice, lvl - r.level)
                        const lit = castHighlight?.slug === def.slug && castHighlight.level === lvl
                        return (
                          <div key={lvl} className={`flex flex-col items-center px-2 py-1 rounded border text-xs ${lvl === r.level ? 'border-parchment-200 bg-parchment-50' : 'border-violet-200 bg-violet-50'} ${lit ? 'ring-2 ring-violet-400 ring-offset-1' : ''}`}>
                            <span className={lvl === r.level ? 'text-parchment-400' : 'text-violet-400'}>{slotOrdinals[lvl - 1]}</span>
                            <span className={`font-semibold ${lvl === r.level ? 'text-parchment-700' : 'text-violet-800'}`}>{total ?? `+${upcast.dice}`}{def.damage!.type ? ` ${def.damage!.type}` : ''}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  <p className="text-xs italic text-parchment-600 whitespace-pre-line">{cleanHigherLevels(def.higherLevels)}</p>
                </div>
              )}

              {/* A feat's, race's or Strixhaven's spell is always prepared, and only its source can add it
                  back, so it gets no Unprepare. Mystic Arcanum and imported spells can be removed. */}
              {s && !s.grantedBy && r.level > 0 && (
                <div className="px-4 pb-3 flex justify-end">
                  {isSpellbookCaster && !s.freeUseKey ? (
                    <button type="button"
                      className="px-3 py-1 rounded border text-xs text-parchment-500 hover:text-amber-600 border-parchment-200 hover:border-amber-300 transition-colors"
                      onClick={() => { setSelectedSpellKey(null); offerUndo(`Unprepared ${r.name}`); patch({ spells: char.spells.map(sp => sp.spellSlug === s.spellSlug ? { ...sp, prepared: false } : sp) }) }}
                    >Unprepare (stays in your spellbook)</button>
                  ) : (
                    <button type="button"
                      className="px-3 py-1 rounded border text-xs text-parchment-500 hover:text-red-500 border-parchment-200 hover:border-red-300 transition-colors"
                      onClick={() => { setSelectedSpellKey(null); offerUndo(`${isPrepared && !s.freeUseKey ? 'Unprepared' : 'Removed'} ${r.name}`); patch({ spells: char.spells.filter(sp => sp.spellSlug !== s.spellSlug) }) }}
                    >{isPrepared && !s.freeUseKey ? 'Unprepare' : 'Remove'}</button>
                  )}
                </div>
              )}
            </article>
          )
        }

        return (
          <>
            {/* ── Spellcasting Header ── */}
            <div className="card px-4 py-3 space-y-3">
              {/* Who's casting; the two numbers every spell uses, as a pair of seals; and how full the
                  spell list is, as fill bars */}
              <div className="grid gap-4 items-center sm:grid-cols-[minmax(0,1fr)_auto] lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,16rem)]">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {casterClasses.length > 1 ? (
                      // Multiclass caster: choose which class's spells, limits and list to work with
                      <div className="flex rounded-md border border-parchment-300 overflow-hidden">
                        {casterClasses.map(c => (
                          <button key={c.classSlug} type="button" onClick={() => setSpellTabClass(c.classSlug)}
                            className={`px-2.5 py-1 text-xs font-bold uppercase tracking-widest transition-colors ${c.classSlug === primarySlug ? 'bg-parchment-600 text-parchment-50' : 'text-parchment-600 hover:bg-parchment-100'}`}
                          >{content.classes.find(cl => cl.slug === c.classSlug)?.name ?? c.classSlug} {c.level}</button>
                        ))}
                      </div>
                    ) : (
                      <h2 className="text-base font-bold text-parchment-800 uppercase tracking-widest">
                        {content.classes.find(c => c.slug === primarySlug)?.name ?? primarySlug}
                      </h2>
                    )}
                    {isMulticlassCaster && (
                      <span className="text-xs bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-full px-2 py-0.5 font-semibold">Multiclass</span>
                    )}
                  </div>
                  <p className="text-xs text-parchment-500 mt-1">
                    Casts with <span className="font-semibold text-parchment-700">{ABILITY_FULL[spellAbility] ?? spellAbility.toUpperCase()}</span> ({formatMod(abilMod)})
                  </p>
                  {isMulticlassCaster && (() => {
                    const parts = char.classes.map(cc => {
                      const ct = CASTER_TYPE[cc.classSlug]
                      const type = typeof ct === 'function' ? ct(cc.subclassSlug) : (ct ?? 'none')
                      if (type === 'none' || type === 'pact') return null
                      const cl = type === 'full' ? cc.level : type === 'half-up' ? Math.ceil(cc.level / 2) : type === 'half' ? Math.floor(cc.level / 2) : Math.floor(cc.level / 3)
                      if (cl === 0) return null
                      const label = content.classes.find(c => c.slug === cc.classSlug)?.name ?? cc.classSlug
                      return `${label} ${cc.level} (CL ${cl})`
                    }).filter(Boolean)
                    const totalCL = effectiveCasterLevel(char.classes)
                    return parts.length > 0 ? (
                      <p className="text-[11px] text-indigo-500 mt-0.5">
                        {parts.join(' + ')} → CL {totalCL}
                      </p>
                    ) : null
                  })()}
                </div>

                <div className="flex items-center gap-2.5">
                  <div className="spell-stat" title="Creatures make saving throws against this">
                    <span className="text-2xl font-bold leading-none text-violet-800">{totalSpellDC(spellClassSlug)}</span>
                    <span className="text-[9px] font-bold uppercase tracking-widest text-violet-600">Save DC</span>
                  </div>
                  <div className="spell-stat" title="Added to your d20 for spell attacks">
                    <span className="text-2xl font-bold leading-none text-violet-800">{formatMod(totalSpellAtk(spellClassSlug))}</span>
                    <span className="text-[9px] font-bold uppercase tracking-widest text-violet-600">Attack</span>
                  </div>
                </div>

                {(() => {
                  const meter = (label: string, count: number, max: number) => {
                    const over = count > max
                    return (
                      <div key={label}>
                        <div className="flex items-baseline justify-between gap-2 text-xs">
                          <span className="font-semibold text-parchment-700">{label}</span>
                          <span className={over ? 'font-bold text-amber-700' : 'text-parchment-600'}>
                            {count} / {max}{over ? ` · ${count - max} over` : ''}
                          </span>
                        </div>
                        <div className="h-1.5 mt-1 rounded-full bg-parchment-200 overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${over ? 'bg-amber-500' : 'bg-violet-500'}`}
                            style={{ width: `${Math.min(100, Math.round(count / Math.max(1, max) * 100))}%` }} />
                        </div>
                      </div>
                    )
                  }
                  const meters = [
                    isPrepared && prepLimit !== null ? meter('Prepared', preparedCount, prepLimit)
                      : knownMax ? meter('Spells known', knownCount, knownMax) : null,
                    cantripMax > 0 ? meter('Cantrips', cantripCount, cantripMax) : null,
                  ].filter(Boolean)
                  return meters.length > 0 ? <div className="space-y-2.5 sm:col-span-2 lg:col-span-1">{meters}</div> : null
                })()}
              </div>

              {/* Concentration banner */}
              {char.concentratingOn && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-300 conc-active" style={{ boxShadow: '0 0 10px 2px rgba(245,158,11,0.18)' }}>
                  <div className="w-2 h-2 rounded-full bg-amber-400 shrink-0" style={{ boxShadow: '0 0 6px 2px rgba(251,191,36,0.8)' }} />
                  <span className="text-[10px] text-amber-700 font-bold uppercase tracking-widest">Concentrating</span>
                  <span className="text-xs text-amber-900 font-semibold">
                    {content.spells.find(s => s.slug === char.concentratingOn)?.name ?? char.concentratingOn}
                  </span>
                  <button type="button"
                    className="ml-auto text-[10px] text-amber-500 hover:text-red-500 border border-amber-300 hover:border-red-300 rounded px-1.5 py-0.5 transition-colors font-medium"
                    onClick={() => patch({ concentratingOn: undefined })}
                  >Drop</button>
                </div>
              )}
            </div>

            {/* ── Pact Magic ── */}
            {char.pactSlots && (
              <div className="card">
                <div className="flex items-center gap-3 mb-3">
                  <h3 className="text-sm font-bold text-parchment-700 uppercase tracking-wider">Pact Magic</h3>
                  <span className="text-xs bg-indigo-100 text-indigo-700 rounded-full px-2.5 py-0.5 font-medium">Level {char.pactSlots.level} · Short Rest</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex gap-2">
                    {Array.from({ length: char.pactSlots.max }, (_, i) => {
                      const available = i < char.pactSlots!.max - char.pactSlots!.used
                      return (
                        <button key={i} type="button"
                          title={available ? 'Expend slot' : 'Recover slot'}
                          onClick={() => {
                            if (!char.pactSlots) return
                            const used = available ? char.pactSlots.used + 1 : char.pactSlots.used - 1
                            patch({ pactSlots: { ...char.pactSlots, used } })
                          }}
                          className="w-5 h-5 flex items-center justify-center group"
                        >
                          <div className={`w-3.5 h-3.5 rotate-45 border-2 ${
                            available ? 'spell-gem' : 'bg-parchment-200 border-parchment-300 opacity-40 transition-all duration-150 group-hover:scale-125'
                          }`} style={available ? {
                            animation: 'pip-pulse 2.4s ease-in-out infinite',
                            animationDelay: `${i * 0.18}s`,
                          } : undefined} />
                        </button>
                      )
                    })}
                  </div>
                  <span className="text-sm text-parchment-500">{char.pactSlots.max - char.pactSlots.used}/{char.pactSlots.max} remaining</span>
                  <button type="button"
                    className="ml-auto text-xs text-parchment-400 hover:text-parchment-700 border border-parchment-200 hover:border-parchment-400 rounded px-2.5 py-1 transition-colors"
                    onClick={() => { if (char.pactSlots) patch({ pactSlots: { ...char.pactSlots, used: 0 } }) }}
                  >Short Rest</button>
                </div>
              </div>
            )}

            {/* ── Sorcery Points: Flexible Casting ── */}
            {char.classes.some(c => c.classSlug === 'sorcerer') && (() => {
              const sorcLevel = char.classes.find(c => c.classSlug === 'sorcerer')?.level ?? 0
              if (sorcLevel < 2) return null
              const spCurrent = char.classResources['sorcery-points'] ?? sorcLevel
              const SLOT_TO_POINTS: Record<number, number> = { 1: 2, 2: 3, 3: 5, 4: 6, 5: 7 }
              const POINTS_TO_SLOT: Record<number, number> = { 1: 2, 2: 3, 3: 5, 4: 6, 5: 7 }
              return (
                <div className="card">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-bold text-parchment-700 uppercase tracking-wider">Flexible Casting</h3>
                    <span className="text-xs bg-purple-100 text-purple-700 rounded-full px-2 py-0.5 font-medium">{spCurrent}/{sorcLevel} Sorcery Pts</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <div className="text-xs font-semibold text-parchment-500 uppercase mb-1">Convert Slot → Points</div>
                      <div className="space-y-1">
                        {[1,2,3,4,5].filter(lvl => (char.spellSlots[String(lvl)]?.max ?? 0) > 0).map(lvl => {
                          const used = char.spellSlots[String(lvl)]?.used ?? 0
                          const max = char.spellSlots[String(lvl)]?.max ?? 0
                          const available = max - used
                          const gain = SLOT_TO_POINTS[lvl]!
                          return (
                            <button key={lvl} disabled={available === 0}
                              onClick={() => {
                                const newUsed = used + 1
                                const newSP = Math.min(sorcLevel, spCurrent + gain)
                                patch({
                                  spellSlots: { ...char.spellSlots, [String(lvl)]: { max, used: newUsed } },
                                  classResources: { ...char.classResources, 'sorcery-points': newSP },
                                })
                              }}
                              className="w-full text-left text-xs px-2 py-1 rounded border border-parchment-200 hover:border-purple-300 hover:bg-purple-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                              Expend L{lvl} slot (+{gain} pts) <span className="text-parchment-400">[{available} avail]</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-parchment-500 uppercase mb-1">Convert Points → Slot</div>
                      <div className="space-y-1">
                        {([1,2,3,4,5] as const).filter(lvl => lvl <= Math.min(5, sorcLevel)).map(lvl => {
                          const cost = POINTS_TO_SLOT[lvl]!
                          return (
                            <button key={lvl} disabled={spCurrent < cost}
                              onClick={() => {
                                const newSP = spCurrent - cost
                                const slotMax = (char.spellSlots[String(lvl)]?.max ?? 0) + 1
                                const slotUsed = char.spellSlots[String(lvl)]?.used ?? 0
                                patch({
                                  classResources: { ...char.classResources, 'sorcery-points': newSP },
                                  spellSlots: { ...char.spellSlots, [String(lvl)]: { max: slotMax, used: slotUsed } },
                                })
                              }}
                              className="w-full text-left text-xs px-2 py-1 rounded border border-parchment-200 hover:border-purple-300 hover:bg-purple-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                              Create L{lvl} slot (−{cost} pts) <span className="text-parchment-400">[need {cost}]</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                  <p className="text-[10px] text-parchment-400 mt-2">Created slots are temporary (disappear on long rest). Slot conversion limited to L5 maximum.</p>
                </div>
              )
            })()}

            {/* ── Spells: one slim row each, grouped by level (each level's slots in its heading). The
                chosen spell opens in the panel beside the list, so the list stays short. ── */}
            {(() => {
              const filter = spellFilter.trim().toLowerCase()
              const rows = [...preparedSpells.map(entryRow), ...freeSpells.map(freeRow)]
                .sort((x, y) => x.name.localeCompare(y.name))
              const levels = [...new Set([
                ...rows.map(r => r.level),
                ...[1, 2, 3, 4, 5, 6, 7, 8, 9].filter(lvl => slotMaxAt(lvl) > 0),
              ])].sort((x, y) => x - y)
              // The open spell may be one of yours or one from the library below
              const librarySelected = selectedSpellKey?.startsWith('lib:') ? availableSpells.find(sp => `lib:${sp.slug}` === selectedSpellKey) : undefined
              const selectedRow = rows.find(r => r.key === selectedSpellKey) ?? (librarySelected ? libraryRow(librarySelected) : undefined)
              const jumpTo = (lvl: number) => document.getElementById(`spell-level-${lvl}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              let shown = 0
              return (
                <div className="card">
                  <div className="flex flex-wrap items-center gap-1.5 mb-3">
                    <h2 className="text-sm font-bold text-parchment-700 uppercase tracking-wider mr-2">
                      {isPrepared ? 'Prepared Spells' : 'Known Spells'}
                    </h2>
                    {/* Jump straight to a level */}
                    {levels.length > 2 && levels.map(lvl => (
                      <button key={lvl} type="button" onClick={() => jumpTo(lvl)}
                        className="text-xs rounded-full px-2.5 py-0.5 border border-parchment-200 text-parchment-600 hover:border-parchment-500 hover:text-parchment-900 transition-colors"
                      >{lvl === 0 ? 'Cantrips' : ordinals[lvl]}</button>
                    ))}
                    {rows.length > 0 && (
                      <input className="input text-sm py-1 w-36 ml-auto" placeholder="Filter…" aria-label="Filter spells"
                        value={spellFilter} onChange={e => setSpellFilter(e.target.value)} />
                    )}
                  </div>
                  {rows.length === 0 && (
                    <p className="text-sm text-parchment-400 py-2 text-center">
                      No spells yet — use the spell library below to {isPrepared ? 'prepare spells' : 'learn spells'}.
                    </p>
                  )}
                  <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-5 lg:items-start">
                    <div>
                      {rows.length > 0 && (
                        <div className={`hidden sm:grid ${SPELL_COLS} gap-x-3 px-2.5 pb-1 mb-1.5 text-[10px] font-bold uppercase tracking-widest text-parchment-400`}>
                          <span>Spell</span><span>Cast</span><span>Hit / DC</span><span>Effect</span><span />
                        </div>
                      )}
                      <div className="space-y-3">
                        {levels.map(lvl => {
                          const lvlRows = rows.filter(r => r.level === lvl && (!filter || r.name.toLowerCase().includes(filter)))
                          if (filter && lvlRows.length === 0) return null
                          shown++
                          const slotMax = lvl > 0 ? slotMaxAt(lvl) : 0
                          return (
                            <section key={lvl} id={`spell-level-${lvl}`} className="scroll-mt-16">
                              <div className="flex items-center gap-3 border-b border-parchment-200 pb-1 mb-0.5">
                                <h3 className="text-xs font-bold uppercase tracking-widest text-parchment-600">
                                  {lvl === 0 ? 'Cantrips' : `${ordinals[lvl]} Level`}
                                </h3>
                                {lvl === 0 && <span className="text-[11px] text-parchment-400">At will</span>}
                                {slotMax > 0 && <div className="ml-auto">{slotGems(lvl)}</div>}
                              </div>
                              {lvlRows.map(spellRow)}
                              {lvlRows.length === 0 && (
                                <p className="text-xs italic text-parchment-400 px-2.5 py-1">
                                  No {ordinals[lvl]}-level spells. These slots can cast a lower-level spell at {ordinals[lvl]} level.
                                </p>
                              )}
                            </section>
                          )
                        })}
                        {filter && shown === 0 && (
                          <p className="text-sm text-parchment-400 py-3 text-center">No spells match "{spellFilter}"</p>
                        )}
                      </div>

                      {/* ── Spell library: spells you could add, in the same rows; their cards open in the panel ── */}
                      <div className="mt-5 pt-3 border-t border-parchment-200">
                        <button type="button" onClick={() => setShowSpellLibrary(v => !v)} aria-expanded={showSpellLibrary}
                          className="w-full flex items-center justify-between gap-3 py-1 group">
                          <span className="text-sm font-bold uppercase tracking-wider text-parchment-700 group-hover:text-parchment-900">
                            {isSpellbookCaster ? 'Spell library' : isPrepared ? 'Prepare spells' : 'Learn spells'}
                          </span>
                          <span className="text-xs text-parchment-500 group-hover:text-parchment-800">
                            {showSpellLibrary ? 'Hide ▲' : `${availableSpells.filter(sp => sp.level > 0).length} available ▼`}
                          </span>
                        </button>
                        {showSpellLibrary && (() => {
                          const availLevels = [1,2,3,4,5,6,7,8,9].filter(l => availableSpells.some(sp => sp.level === l))
                          const activeLib = spellBrowserLevel !== null && availLevels.includes(spellBrowserLevel) ? spellBrowserLevel : availLevels[0] ?? 0
                          const q = spellBrowserSearch.trim().toLowerCase()
                          const libRows = availableSpells
                            .filter(sp => sp.level === activeLib && (!q || sp.name.toLowerCase().includes(q) || sp.school.toLowerCase().includes(q)))
                            .sort((x, y) => x.name.localeCompare(y.name))
                            .map(libraryRow)
                          return (
                            <div className="mt-2">
                              <div className="flex flex-wrap items-center gap-1.5 mb-2">
                                {availLevels.map(lvl => (
                                  <button key={lvl} type="button" onClick={() => setSpellBrowserLevel(lvl)}
                                    className={`text-xs rounded-full px-2.5 py-0.5 border transition-colors ${lvl === activeLib ? 'bg-parchment-700 border-parchment-700 text-parchment-50' : 'border-parchment-200 text-parchment-600 hover:border-parchment-500 hover:text-parchment-900'}`}
                                  >{ordinals[lvl]}</button>
                                ))}
                                <input className="input text-sm py-1 w-36 ml-auto" placeholder="Search…" aria-label="Search the spell library"
                                  value={spellBrowserSearch} onChange={e => setSpellBrowserSearch(e.target.value)} />
                              </div>
                              <div className="max-h-[28rem] overflow-y-auto pr-1 [scrollbar-width:thin]">
                                {libRows.map(spellRow)}
                                {libRows.length === 0 && (
                                  <p className="text-sm text-parchment-400 text-center py-6">
                                    {availLevels.length === 0 ? 'You already have every spell you can add.' : `No spells match "${spellBrowserSearch}"`}
                                  </p>
                                )}
                              </div>
                            </div>
                          )
                        })()}
                      </div>
                    </div>
                    <aside className="hidden lg:block sticky top-14 max-h-[calc(100vh-4.5rem)] overflow-y-auto rounded-xl [scrollbar-width:thin]">
                      {selectedRow ? spellDetails(selectedRow) : (
                        <div className="rounded-xl border-2 border-dashed border-parchment-300 px-6 py-10 text-center">
                          <BookIcon className="w-10 h-10 mx-auto text-parchment-300" />
                          <p className="text-sm font-semibold text-parchment-600 mt-2">Choose a spell</p>
                          <p className="text-xs text-parchment-400 mt-0.5">Its card opens here, ready to cast.</p>
                        </div>
                      )}
                    </aside>
                  </div>
                </div>
              )
            })()}

            {/* ── Spellbook (unprepared) — Wizard only ── */}
            {isSpellbookCaster && (() => {
              const unprepared = char.spells.filter(s => !s.prepared && (content.spells.find(d => d.slug === s.spellSlug)?.level ?? 0) > 0)
              if (unprepared.length === 0) return null
              return (
                <div className="card">
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="text-sm font-bold text-parchment-700 uppercase tracking-wider">Spellbook</h3>
                    <span className="text-xs bg-amber-100 text-amber-700 rounded-full px-2.5 py-0.5 font-medium">Not Prepared · {unprepared.length}</span>
                  </div>
                  <div className="space-y-1.5">
                    {unprepared.map(s => {
                      const def = content.spells.find(d => d.slug === s.spellSlug)
                      return (
                        <div key={s.spellSlug} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-parchment-200 bg-parchment-50">
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-semibold text-parchment-800">{s.name}</span>
                            {def && <span className="ml-2 text-xs text-parchment-400">{['Cantrip','1st','2nd','3rd','4th','5th','6th','7th','8th','9th'][def.level]} · {def.school}</span>}
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <button type="button"
                              disabled={atPrepCap}
                              className="px-2.5 py-1 rounded border text-xs font-semibold transition-colors bg-violet-50 border-violet-300 text-violet-700 hover:bg-violet-100 disabled:opacity-40 disabled:cursor-not-allowed"
                              onClick={() => patch({ spells: char.spells.map(sp => sp.spellSlug === s.spellSlug ? { ...sp, prepared: true } : sp) })}
                            >Prepare</button>
                            <button type="button"
                              className="px-2.5 py-1 rounded border text-xs text-parchment-400 hover:text-red-500 border-parchment-200 hover:border-red-300 transition-colors"
                              onClick={() => { offerUndo(`Removed ${s.name} from your spellbook`); patch({ spells: char.spells.filter(sp => sp.spellSlug !== s.spellSlug) }) }}
                            >Remove</button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })()}

            {/* ── Mystic Arcanum owed (Warlock 11+) but never picked ── */}
            {(() => {
              const wlLevel = char.classes.find(c => c.classSlug === 'warlock')?.level ?? 0
              const owed = Object.entries(MYSTIC_ARCANUM_LEVELS)
                .filter(([at, spLvl]) => wlLevel >= Number(at) && !char.spells.some(s => s.freeUseKey === mysticArcanumKey(spLvl)))
                .map(([, spLvl]) => spLvl)
              if (owed.length === 0) return null
              return (
                <div className="card border-amber-300">
                  <h3 className="text-sm font-bold text-parchment-700 uppercase tracking-wider mb-1">Mystic Arcanum</h3>
                  <p className="text-xs text-parchment-500 mb-3">Choose a warlock spell for each arcanum. Each can be cast once without a spell slot per long rest.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {owed.map(spLvl => (
                      <label key={spLvl} className="block">
                        <span className="text-sm text-parchment-600">{ordinals[spLvl]} level</span>
                        <select className="input text-sm" value=""
                          onChange={e => {
                            const def = content.spells.find(d => d.slug === e.target.value)
                            if (def) patch({ spells: [...char.spells, mysticArcanumEntry(def)] })
                          }}>
                          <option value="">— choose a spell —</option>
                          {content.spells
                            .filter(d => d.level === spLvl && (d.classLists ?? []).includes('warlock') && !char.spells.some(s => s.spellSlug === d.slug))
                            .sort((a, b) => a.name.localeCompare(b.name))
                            .map(d => <option key={d.slug} value={d.slug}>{d.name}</option>)}
                        </select>
                      </label>
                    ))}
                  </div>
                </div>
              )
            })()}

          </>
        )
      })() : (
        <p className="text-parchment-400">This character doesn't have a spellcasting class.</p>
      )}
    </div>
  )
}
