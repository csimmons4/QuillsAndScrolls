import { Link } from 'react-router-dom'
import { useSheetModel } from './sheet/useSheetModel'
import { ABILITIES, SKILLS, SKILL_LABELS, SKILL_ABILITY } from '../character/model'
import { abilityModFor, saveMod, skillMod, formatMod, spellSaveDC, spellAttackBonus, spellcastingAbilityFor } from '../character/derive'
import { CLASS_OPTIONS, spellProgression } from '../data/classData'
import { formatPurse } from '../character/currency'
import { cleanFeatDesc } from '../components/FeatPicker'
import { ABILITY_FULL, ABILITY_LABELS } from './sheet/helpers'

const ORDINAL = ['Cantrips', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th']

/** Empty boxes to tick by hand at the table */
function Ticks({ n }: { n: number }) {
  return (
    <span className="inline-flex flex-wrap gap-0.5 align-middle">
      {Array.from({ length: Math.min(n, 20) }, (_, i) => <span key={i} className="ps-tick" />)}
    </span>
  )
}

function Heading({ children }: { children: React.ReactNode }) {
  return <h2 className="ps-heading text-[11px] font-bold uppercase tracking-[0.18em] pb-0.5 mb-1.5">{children}</h2>
}

/** A printable character sheet: two pages of what you need at the table, black on white in every
 *  theme. Open it from the sheet header; Print / Save as PDF uses the browser's print dialog. */
export default function PrintSheet() {
  const model = useSheetModel()
  if (!model.ready) {
    return (
      <div className="text-center py-20 text-parchment-500">
        {model.loadError || 'Loading character...'}
      </div>
    )
  }
  const {
    char, content, level, pb, ac, acSource, maxHp, speed, initiative, passive, passiveInvestigation, passiveInsight,
    effectiveChar, effectiveCharSkills, itemBonuses, paladinAura, resistances, classResources, freeSpells,
    multiclassMaxes, spellClassSlug, raceDef, featSlugs, attackRows,
  } = model

  const className = (slug: string) => content.classes.find(c => c.slug === slug)?.name ?? slug
  const subclassName = (slug: string, sub?: string) => CLASS_OPTIONS[slug]?.subclasses.find(s => s.slug === sub)?.name
  const background = content.backgrounds.find(b => b.slug === char.backgroundSlug)
  const subrace = raceDef?.subraces?.find(s => s.slug === char.subraceSlug)
  const hitDice = char.classes.map(cc => `${cc.level}d${CLASS_OPTIONS[cc.classSlug]?.hitDie ?? content.classes.find(c => c.slug === cc.classSlug)?.hitDie ?? 8}`).join(' + ')
  const resources = [
    ...classResources.map(r => ({ key: r.key, name: r.name, max: r.max, recharge: r.recharge, display: r.display })),
    ...(char.customResources ?? []).map(r => ({ key: r.key, name: r.name, max: r.max as number | null, recharge: r.recharge, display: undefined as string | undefined })),
  ]

  // Spells: what's ready to cast, by level, plus anything granted
  const spellDef = (slug: string) => content.spells.find(d => d.slug === slug)
  const ready = char.spells.filter(s => {
    const lvl = spellDef(s.spellSlug)?.level ?? 0
    if (s.prepared || lvl === 0) return true
    const entry = char.classes.find(c => c.classSlug === s.classSlug)
    return !!entry && !spellProgression(entry.classSlug, entry.subclassSlug)?.preparedCaster
  })
  const spellRows = [
    ...ready.map(s => ({ key: `e-${s.spellSlug}`, name: s.name, def: spellDef(s.spellSlug), note: s.grantedBy ? 'always prepared' : s.usesPerLongRest ? `${s.usesPerLongRest}/long rest free` : '' })),
    ...freeSpells.map(f => ({ key: `f-${f.key}`, name: f.name, def: spellDef(f.slug), note: f.alwaysPrepared ? `${f.source}, always prepared` : f.usesPerLongRest ? `${f.source}, ${f.usesPerLongRest}/long rest` : `${f.source}, at will` })),
  ].sort((a, b) => (a.def?.level ?? 0) - (b.def?.level ?? 0) || a.name.localeCompare(b.name))
  const spellbookOnly = char.spells.filter(s => !ready.includes(s))
  const slotMax = (lvl: number) => multiclassMaxes ? (multiclassMaxes[String(lvl)] ?? 0) : (char.spellSlots[String(lvl)]?.max ?? 0)
  const casterClass = char.classes.find(c => c.classSlug === spellClassSlug)
  const castingAbility = casterClass ? spellcastingAbilityFor(casterClass, content) : undefined

  // Features: class and subclass, race, feats, background
  const classFeatures = char.classes.flatMap(cc => {
    const opts = CLASS_OPTIONS[cc.classSlug]
    const sub = opts?.subclasses.find(s => s.slug === cc.subclassSlug)
    return [
      ...(opts?.features ?? content.classes.find(c => c.slug === cc.classSlug)?.features ?? []).map(f => ({ ...f, from: className(cc.classSlug) })),
      ...(sub?.features ?? []).map(f => ({ ...f, from: sub!.name })),
    ].filter(f => f.level <= cc.level).sort((a, b) => a.level - b.level)
  })
  const feats = featSlugs.map(slug => content.feats.find(f => f.slug === slug)).filter(Boolean)

  return (
    <div className="print-sheet-wrap">
      {/* Only on screen */}
      <div className="print:hidden max-w-[210mm] mx-auto mb-4 flex items-center gap-3">
        <Link to={`/c/${char.id}`} className="btn-ghost text-sm">← Back to sheet</Link>
        <span className="text-sm text-parchment-500 flex-1">A printable copy of {char.name}'s sheet.</span>
        <button type="button" className="btn-primary text-sm" onClick={() => window.print()}>Print / Save as PDF</button>
      </div>

      <article className="print-sheet max-w-[210mm] mx-auto px-[12mm] py-[10mm] text-[11px] leading-snug">
        {/* ── Page 1 ── */}
        <header className="flex items-start gap-4 pb-2 mb-3 ps-rule border-b-2">
          {char.portrait && <img src={char.portrait} alt="" className="w-16 h-16 rounded object-cover object-top ps-box" />}
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold leading-tight">{char.name}</h1>
            <p className="ps-muted text-xs mt-0.5">
              Level {level} {raceDef?.name ?? char.raceSlug}{subrace ? ` (${subrace.name})` : ''} ·{' '}
              {char.classes.map(cc => `${className(cc.classSlug)} ${cc.level}${subclassName(cc.classSlug, cc.subclassSlug) ? ` (${subclassName(cc.classSlug, cc.subclassSlug)})` : ''}`).join(' / ')}
              {background ? ` · ${background.name}` : ''}
            </p>
          </div>
        </header>

        {/* Vitals */}
        <section className="grid grid-cols-8 gap-1.5 mb-3 text-center">
          {[
            { label: 'Armor Class', value: ac, sub: acSource },
            { label: 'Hit Points', value: maxHp, sub: 'max · now ____' },
            { label: 'Temp HP', value: '', sub: '' },
            { label: 'Speed', value: `${speed} ft`, sub: '' },
            { label: 'Initiative', value: formatMod(initiative), sub: '' },
            { label: 'Proficiency', value: formatMod(pb), sub: '' },
            { label: 'Hit Dice', value: hitDice, sub: 'spent ____' },
            { label: 'Passives', value: passive, sub: `Inv ${passiveInvestigation} · Ins ${passiveInsight}` },
          ].map(v => (
            <div key={v.label} className="ps-box rounded px-1 py-1">
              <div className="text-[8px] uppercase tracking-wider ps-muted">{v.label}</div>
              <div className="text-lg font-bold leading-tight">{v.value}</div>
              {v.sub && <div className="text-[8px] ps-muted leading-tight">{v.sub}</div>}
            </div>
          ))}
        </section>

        <div className="grid grid-cols-[13rem_1fr] gap-4">
          {/* Left: abilities, saves, skills */}
          <div className="space-y-3">
            <section>
              <Heading>Ability Scores</Heading>
              <div className="grid grid-cols-3 gap-1.5 text-center">
                {ABILITIES.map(a => (
                  <div key={a} className="ps-box rounded py-1">
                    <div className="text-[8px] uppercase tracking-wider ps-muted">{ABILITY_LABELS[a]}</div>
                    <div className="text-base font-bold leading-tight">{formatMod(abilityModFor(effectiveChar, a))}</div>
                    <div className="text-[9px] ps-muted">{effectiveChar.abilityScores[a]}</div>
                  </div>
                ))}
              </div>
            </section>
            <section>
              <Heading>Saving Throws</Heading>
              {ABILITIES.map(a => (
                <div key={a} className="flex items-center gap-1.5">
                  <span className={`ps-dot ${char.saveProficiencies.includes(a) ? 'ps-dot-on' : ''}`} />
                  <span className="w-6 text-right font-semibold tabular-nums">{formatMod(saveMod(effectiveChar, a) + itemBonuses.savingThrowBonus + paladinAura)}</span>
                  <span>{ABILITY_FULL[a]}</span>
                </div>
              ))}
            </section>
            <section>
              <Heading>Skills</Heading>
              {SKILLS.map(sk => {
                const expert = effectiveCharSkills.skillExpertise.includes(sk)
                const prof = expert || effectiveCharSkills.skillProficiencies.includes(sk)
                return (
                  <div key={sk} className="flex items-center gap-1.5">
                    <span className={`ps-dot ${prof ? 'ps-dot-on' : ''}`} />
                    <span className="w-6 text-right font-semibold tabular-nums">{formatMod(skillMod(effectiveCharSkills, sk) + itemBonuses.abilityCheckBonus)}</span>
                    <span className={expert ? 'font-bold' : ''}>{SKILL_LABELS[sk]}</span>
                    <span className="ps-muted text-[9px] ml-auto">{ABILITY_LABELS[SKILL_ABILITY[sk]]}{expert ? ' ★' : ''}</span>
                  </div>
                )
              })}
            </section>
          </div>

          {/* Right: attacks, resources, proficiencies */}
          <div className="space-y-3 min-w-0">
            <section>
              <Heading>Attacks</Heading>
              <table className="w-full">
                <thead>
                  <tr className="text-left text-[8px] uppercase tracking-wider ps-muted">
                    <th className="font-semibold pb-0.5">Name</th><th className="font-semibold pb-0.5">Hit / DC</th><th className="font-semibold pb-0.5">Damage</th><th className="font-semibold pb-0.5">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {attackRows.map(row => (
                    <tr key={row.key} className="ps-rule border-t align-top">
                      <td className="py-0.5 pr-2 font-semibold">{row.name}</td>
                      <td className="py-0.5 pr-2 tabular-nums whitespace-nowrap">{row.toHit}</td>
                      <td className="py-0.5 pr-2">{row.damage}{row.rider ? ` + ${row.rider}` : ''}</td>
                      <td className="py-0.5 ps-muted text-[9px]">{row.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            {resources.length > 0 && (
              <section>
                <Heading>Limited Uses</Heading>
                {resources.map(r => (
                  <div key={r.key} className="flex items-center gap-2 py-0.5">
                    <span className="font-semibold">{r.name}</span>
                    {r.display && r.display.length <= 24 && <span className="ps-muted text-[9px]">{r.display}</span>}
                    <span className="ps-muted text-[9px]">{r.recharge === 'short' ? 'short rest' : r.recharge === 'dawn' ? 'dawn' : 'long rest'}</span>
                    <span className="ml-auto">{r.max === null ? 'unlimited' : r.max > 20 ? <>pool {r.max} · left ____</> : <Ticks n={r.max} />}</span>
                  </div>
                ))}
              </section>
            )}

            <section>
              <Heading>Proficiencies &amp; Languages</Heading>
              <p><span className="font-semibold">Armor:</span> {char.armorProficiencies.join(', ') || 'none'}</p>
              <p><span className="font-semibold">Weapons:</span> {char.weaponProficiencies.join(', ') || 'none'}</p>
              <p><span className="font-semibold">Tools:</span> {char.toolProficiencies.join(', ') || 'none'}</p>
              <p><span className="font-semibold">Languages:</span> {char.languages.join(', ') || 'none'}</p>
              {(resistances.resistances.length > 0 || resistances.immunities.length > 0) && (
                <p className="mt-1">
                  {resistances.resistances.length > 0 && <><span className="font-semibold">Resistant to:</span> {resistances.resistances.join(', ')}. </>}
                  {resistances.immunities.length > 0 && <><span className="font-semibold">Immune to:</span> {resistances.immunities.join(', ')}.</>}
                </p>
              )}
            </section>

            <section>
              <Heading>Equipment</Heading>
              <p className="mb-1"><span className="font-semibold">Coins:</span> {formatPurse(char.currency)}</p>
              <div className="columns-2 gap-4">
                {char.equipment.map((e, i) => (
                  <div key={i} className="break-inside-avoid">
                    {e.quantity > 1 ? `${e.quantity}× ` : ''}{e.name}
                    {e.equipped && <span className="ps-muted"> · worn</span>}
                    {e.attuned && <span> ✦</span>}
                    {e.chargesMax !== undefined && <span className="ps-muted"> · {e.chargesMax} charge{e.chargesMax === 1 ? '' : 's'}</span>}
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>

        {/* ── Page 2: spells ── */}
        {spellRows.length > 0 && (
          <section className="ps-page">
            <div className="flex items-baseline gap-4 pb-1 mb-2 ps-rule border-b-2">
              <h2 className="text-lg font-bold">Spellcasting</h2>
              {spellClassSlug && (
                <span className="ps-muted">
                  {castingAbility ? ABILITY_FULL[castingAbility] : ''} · Save DC <b>{spellSaveDC(effectiveChar, spellClassSlug, content) + itemBonuses.spellDCBonus}</b>
                  {' '}· Spell attack <b>{formatMod(spellAttackBonus(effectiveChar, spellClassSlug, content) + itemBonuses.spellAttackBonus)}</b>
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1 mb-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].filter(l => slotMax(l) > 0).map(l => (
                <span key={l} className="inline-flex items-center gap-1"><span className="font-semibold">{ORDINAL[l]}</span> <Ticks n={slotMax(l)} /></span>
              ))}
              {char.pactSlots && <span className="inline-flex items-center gap-1"><span className="font-semibold">Pact ({ORDINAL[char.pactSlots.level]})</span> <Ticks n={char.pactSlots.max} /></span>}
            </div>
            <div className="columns-2 gap-6">
              {[...new Set(spellRows.map(r => r.def?.level ?? 0))].map(lvl => (
                <div key={lvl} className="break-inside-avoid-column mb-2">
                  <h3 className="text-[10px] font-bold uppercase tracking-wider ps-muted mb-0.5">{lvl === 0 ? 'Cantrips' : `${ORDINAL[lvl]} level`}</h3>
                  {spellRows.filter(r => (r.def?.level ?? 0) === lvl).map(r => (
                    <div key={r.key} className="break-inside-avoid py-0.5 ps-rule border-t">
                      <span className="font-semibold">{r.name}</span>
                      {r.def?.concentration && <span className="ps-tag">C</span>}
                      {r.def?.ritual && <span className="ps-tag">R</span>}
                      <span className="ps-muted text-[9px]">
                        {' '}{[r.def?.castingTime?.split(',')[0], r.def?.range, r.def?.savingThrow ? `${r.def.savingThrow.ability.toUpperCase()} save` : r.def?.attackRoll ? 'attack' : '', r.def?.damage ? `${r.def.damage.dice} ${r.def.damage.type ?? ''}`.trim() : '', r.note].filter(Boolean).join(' · ')}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            {spellbookOnly.length > 0 && (
              <p className="mt-1"><span className="font-semibold">In the spellbook, not prepared:</span> {spellbookOnly.map(s => s.name).join(', ')}</p>
            )}
          </section>
        )}

        {/* ── Features & traits ── */}
        <section className={spellRows.length > 0 ? 'mt-4' : 'ps-page'}>
          <h2 className="text-lg font-bold pb-1 mb-2 ps-rule border-b-2">Features &amp; Traits</h2>
          <div className="columns-2 gap-6">
            {classFeatures.map(f => (
              <div key={`${f.from}-${f.level}-${f.name}`} className="break-inside-avoid mb-1.5">
                <span className="font-semibold">{f.name}</span> <span className="ps-muted text-[9px]">{f.from} {f.level}</span>
                {f.description && <p className="text-[10px]">{f.description}</p>}
              </div>
            ))}
            {[...(raceDef?.traits ?? []), ...(subrace?.traits ?? [])].map(t => (
              <div key={t} className="break-inside-avoid mb-1.5 text-[10px]"><span className="ps-muted text-[9px]">{raceDef?.name} · </span>{t}</div>
            ))}
            {feats.map(f => (
              <div key={f!.slug} className="break-inside-avoid mb-1.5">
                <span className="font-semibold">{f!.name}</span> <span className="ps-muted text-[9px]">feat</span>
                {f!.notes?.length ? <ul className="text-[10px] list-disc pl-4">{f!.notes.map(n => <li key={n}>{n}</li>)}</ul> : <p className="text-[10px]">{cleanFeatDesc(f!.description)}</p>}
              </div>
            ))}
            {background?.feature.name && (
              <div className="break-inside-avoid mb-1.5">
                <span className="font-semibold">{background.feature.name}</span> <span className="ps-muted text-[9px]">{background.name}</span>
                {background.feature.description && <p className="text-[10px]">{background.feature.description}</p>}
              </div>
            )}
          </div>
        </section>
      </article>
    </div>
  )
}
