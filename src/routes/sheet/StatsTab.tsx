import { useState } from 'react'
import { Character, SKILLS, SKILL_LABELS, SKILL_ABILITY, ABILITIES } from '../../character/model'
import { abilityModFor, skillMod, saveMod, totalLevel, formatMod, spellSaveDC, spellAttackBonus } from '../../character/derive'
import { DRACONIC_ANCESTRIES, LANGUAGES_STANDARD, LANGUAGES_EXOTIC, languageChoiceCount, languageChoicePlaceholder } from '../../data/raceData'
import { InspirationToken } from '../../components/InspirationToken'
import { ARMOR_KINDS, ARTISAN_TOOLS, MUSICAL_INSTRUMENTS, GAMING_SETS, OTHER_TOOLS, armorKindsOf, profKey, isToolItem, proficiencySources, type ArmorKind } from '../../character/proficiencies'
import { describePotionEffects } from '../../character/potionEffects'
import { ABILITY_FULL, ABILITY_LABELS, CONDITIONS, SIMPLE_WEAPON_SLUGS, SkillSourceTag, fightingStyles, isArmorProficient, isMonkWeapon, isWeaponProficient, magicBonus, resolveArmor, resolveWeapon, weaponAttackBonus, weaponDamageMod } from './helpers'
import { useSheet } from './SheetContext'
import { WILD_SHAPE_BEASTS, ELEMENTAL_FORMS, canElementalWildShape, wildShapeLimits, wildShapeBlocked, formatCr } from '../../data/wildShapeBeasts'

/** The Stats tab: attacks, ability scores, saves, skills, status and proficiencies */
export function StatsTab() {
  const {
    id,
    content,
    char,
    profEditing,
    setProfEditing,
    newToolText,
    setNewToolText,
    newLangText,
    setNewLangText,
    save,
    offerUndo,
    patch,
    level,
    pb,
    featSlugs,
    featBonuses,
    featArmor,
    artificerLevel,
    itemBonuses,
    potionFx,
    potionScoreOverrides,
    potionWeaponMods,
    effectiveChar,
    effectiveCharSkills,
    endPotion,
    walkSpeed,
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
    jackOfAllTrades,
    spellClassSlug,
    raging,
    setRaging,
    blessed,
    setBlessed,
    barbarianLevel,
    rageDamage,
    concRider,
    startRage,
    attackRows,
    spellsOnYou,
    toggleSpellOnYou,
    wildShapeForm,
    enterWildShape,
    revertWildShape,
    multiclassMaxes,
  } = useSheet()
  const [beastPickerOpen, setBeastPickerOpen] = useState(false)
  const [customBeast, setCustomBeast] = useState({ name: '', hp: '', ac: '', speed: '30' })
  // Combat Wild Shape: the slot level being spent and the d8s rolled for it
  const [cwsLevel, setCwsLevel] = useState<number | null>(null)
  const [cwsRoll, setCwsRoll] = useState('')
  return (
    <div className="space-y-5">
      {/* Attacks — full width, first: they're what you look at most in a fight */}
      <div className="card">
        <h2 className="section-header">Attacks</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-parchment-500 border-b border-parchment-200">
                <th className="pb-1 pr-4 font-medium">Name</th>
                <th className="pb-1 pr-4 font-medium">Attack Bonus</th>
                <th className="pb-1 pr-4 font-medium">Damage / Type</th>
                <th className="pb-1 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-parchment-100">
              {attackRows.map(row => row.breath ? (
                <tr key={row.key} className={row.breath.used ? 'opacity-50' : ''}>
                  <td className="py-1.5 pr-4">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium">{row.name}</span>
                      {row.breath.used
                        ? <span className="text-[10px] bg-parchment-100 text-parchment-400 rounded px-1.5 py-0.5">Used</span>
                        : <span className="text-[10px] bg-green-100 text-green-700 rounded px-1.5 py-0.5">Ready</span>}
                    </div>
                  </td>
                  <td className="py-1.5 pr-4 text-parchment-500 text-xs">{row.toHit}</td>
                  <td className="py-1.5 pr-4">{row.damage}</td>
                  <td className="py-1.5 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-parchment-400">{row.notes}</span>
                      <button type="button"
                        className={`text-[10px] rounded px-1.5 py-0.5 border transition-colors ${row.breath.used ? 'border-green-300 text-green-600 hover:bg-green-50' : 'border-parchment-200 text-parchment-500 hover:border-parchment-400'}`}
                        onClick={() => patch({ classResources: { ...char.classResources, 'breath-weapon-used': row.breath!.used ? 0 : 1 } })}>
                        {row.breath.used ? 'Restore' : 'Mark Used'}
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={row.key} className={row.tone === 'attuned' ? 'bg-indigo-50' : row.tone === 'unproficient' ? 'bg-red-50' : ''}>
                  <td className="py-1.5 pr-4 font-medium">{row.name}</td>
                  <td className="py-1.5 pr-4 font-mono">
                    {row.toHit}
                    {row.tone === 'unproficient' && <span className="text-red-500 ml-1 text-xs">(no prof)</span>}
                  </td>
                  <td className={`py-1.5 pr-4 ${row.key === 'spell-attack' ? 'text-parchment-400' : ''}`}>
                    {row.damage}
                    {row.rider && <span className="text-violet-700 font-semibold" title={`${concRider?.label}: against its target`}> + {row.rider}</span>}
                  </td>
                  <td className="py-1.5 text-parchment-400 text-xs">{row.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

        {/* Col 1: Ability Scores + Saving Throws */}
        <div className="space-y-4">
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-2">
              <h2 className="section-header mb-0 flex-1">Ability Scores</h2>
              {abilitiesChanged.length > 0 && (
                <button type="button" onClick={resetAllAbilities}
                  title={`Changed by hand: ${abilitiesChanged.map(a => ABILITY_LABELS[a]).join(', ')}. Click to restore them.`}
                  className="text-xs rounded-full px-2.5 py-0.5 border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors shrink-0"
                >↺ Reset {abilitiesChanged.length} changed</button>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {ABILITIES.map(a => (
                <div key={a} className="stat-box relative">
                  <div className="text-xs text-parchment-500 uppercase">{ABILITY_LABELS[a]}</div>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    className="text-2xl font-bold w-12 text-center bg-transparent border-none outline-none focus:bg-parchment-50 rounded"
                    aria-label={`${ABILITY_FULL[a]} score`}
                    value={char.abilityScores[a]}
                    onChange={e => {
                      const scores = { ...char.abilityScores, [a]: parseInt(e.target.value, 10) || 10 }
                      patch({ abilityScores: scores as Character['abilityScores'] })
                    }}
                  />
                  <div className="text-sm font-semibold text-parchment-600">
                    {formatMod(abilityModFor(effectiveChar, a))}
                    {effectiveChar.abilityScores[a] !== char.abilityScores[a] && (
                      <span className="text-xs text-indigo-500 ml-0.5"
                        title={`Currently ${effectiveChar.abilityScores[a]} from ${potionScoreOverrides[a] === effectiveChar.abilityScores[a] ? 'an active potion' : 'an equipped item'}`}
                      >★{effectiveChar.abilityScores[a]}</span>
                    )}
                  </div>
                  {/* In the corner, so a changed box keeps the same layout as the others */}
                  {abilitiesChanged.includes(a) && (
                    <button type="button" onClick={() => patch({ abilityScores: { ...char.abilityScores, [a]: abilityBase[a] } })}
                      title={`Changed by hand (was ${abilityBase[a]}). Click to reset.`}
                      className="absolute top-1 right-1.5 text-[11px] font-semibold text-amber-700 hover:text-amber-900"
                    >↺ {abilityBase[a]}</button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="card p-4">
            <div className="flex items-center gap-2 mb-2">
              <h2 className="section-header mb-0 flex-1">Saving Throws</h2>
              {savesChanged.length > 0 && (
                <button type="button" onClick={resetAllSaves}
                  title={`Changed by hand: ${savesChanged.map(a => ABILITY_FULL[a]).join(', ')}. Click to restore them.`}
                  className="text-xs rounded-full px-2.5 py-0.5 border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors shrink-0"
                >↺ Reset {savesChanged.length} changed</button>
              )}
            </div>
            <div className="space-y-1.5">
              {ABILITIES.map(a => (
                <div key={a} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="w-[18px] h-[18px] sm:w-auto sm:h-auto"
                    aria-label={`${ABILITY_FULL[a]} saving throw proficiency`}
                    checked={char.saveProficiencies.includes(a)}
                    onChange={e => {
                      const s = new Set(char.saveProficiencies)
                      e.target.checked ? s.add(a) : s.delete(a)
                      patch({ saveProficiencies: [...s] })
                    }}
                  />
                  <span className="w-10 font-mono text-right text-parchment-700">{formatMod(saveMod(effectiveChar, a) + itemBonuses.savingThrowBonus + paladinAura)}</span>
                  <span className="flex-1">{ABILITY_FULL[a]}</span>
                  {savesChanged.includes(a) && (
                    <button type="button" onClick={() => resetSave(a)}
                      title={`Changed by hand. Originally ${saveBase.has(a) ? 'proficient' : 'not proficient'}. Click to reset.`}
                      className="text-[11px] font-semibold text-amber-700 hover:text-amber-900 shrink-0"
                    >↺ reset</button>
                  )}
                  {paladinAura > 0 && <span className="text-xs bg-yellow-100 text-yellow-700 rounded px-1.5 py-0.5">+{paladinAura} Aura</span>}
                  {a === 'con' && featBonuses.concentrationAdvantage && (
                    <span className="text-xs bg-amber-100 text-amber-700 rounded px-1.5 py-0.5">War Caster</span>
                  )}
                  {/* Active potions: advantage/disadvantage (they cancel out) and Bless dice */}
                  {potionFx.saveAdvantage.has(a) && !potionFx.saveDisadvantage.has(a) && (
                    <span className="text-xs bg-teal-100 text-teal-700 rounded px-1.5 py-0.5" title="From an active potion">Adv</span>
                  )}
                  {potionFx.saveDisadvantage.has(a) && !potionFx.saveAdvantage.has(a) && (
                    <span className="text-xs bg-red-100 text-red-700 rounded px-1.5 py-0.5" title="From an active potion">Disadv</span>
                  )}
                  {potionFx.rollBonusDice.map(d => (
                    <span key={d} className="text-xs bg-teal-100 text-teal-700 rounded px-1.5 py-0.5" title="From an active potion">{d}</span>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Active Potions — added by Drink; minute-long effects count down in rounds */}
          {char.activePotions.length > 0 && (
            <div className="card p-4">
              <h2 className="section-header">Active Potions</h2>
              <div className="space-y-2">
                {char.activePotions.map(p => {
                  const def = content.items.find(i => i.slug === p.itemSlug)?.potion
                  const outOfUses = p.usesLeft === 0
                  const ended = p.roundsLeft === 0 || outOfUses
                  const update = (changes: Partial<typeof p>) =>
                    patch({ activePotions: char.activePotions.map(x => x.id === p.id ? { ...x, ...changes } : x) })
                  const action = def?.action
                  const applied = describePotionEffects(def, p.choice, walkSpeed)
                  // Potion of Poison after a failed save: usesLeft counts the damage dice still to come
                  const poisonFx = def?.onDrink?.damage
                  const isPoison = !!poisonFx?.ongoingDice && !def?.uses
                  return (
                    <div key={p.id} className={`rounded-lg border px-3 py-2 ${ended ? 'border-parchment-200 bg-parchment-50 opacity-70' : 'border-teal-200 bg-teal-50'}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-parchment-900 truncate">{p.name}</div>
                          <span className="inline-block mt-0.5 text-[11px] font-semibold rounded px-1.5 py-0.5 bg-teal-100 text-teal-700">{p.effect}</span>
                        </div>
                        <button type="button" onClick={() => { offerUndo(`Ended ${p.name}`); endPotion(p.id) }}
                          title="End this effect"
                          className="shrink-0 text-xs rounded border border-parchment-300 px-2 py-0.5 text-parchment-600 hover:border-red-400 hover:text-red-600 transition-colors"
                        >End</button>
                      </div>
                      {/* What the potion lets you do — its own DC, not yours */}
                      {action && !ended && (
                        <div className="mt-1.5 rounded border border-teal-200 bg-parchment-50 px-2 py-1.5 text-xs space-y-0.5">
                          <div className="font-semibold text-parchment-800">
                            {action.name}
                            <span className="font-normal text-parchment-500"> · {action.timing}{action.range ? ` · ${action.range}` : ''}</span>
                          </div>
                          {(action.save || action.damage) && (
                            <div className="text-parchment-700">
                              {action.save && <>DC {action.save.dc} {ABILITY_FULL[action.save.ability]} save</>}
                              {action.save && action.damage && ' · '}
                              {action.damage && <span className="font-semibold">{action.damage}</span>}
                              {action.onSave === 'half' && ' (half on a success)'}
                            </div>
                          )}
                          {action.text && <div className="text-parchment-500">{action.text}</div>}
                        </div>
                      )}
                      {/* Poison: damage each turn until saves wear it down */}
                      {isPoison && p.usesLeft! > 0 && (
                        <div className="mt-1.5 rounded border border-red-200 bg-red-50 px-2 py-1.5 text-xs space-y-1">
                          <div className="text-red-800">
                            Start of your turn: take <strong>{p.usesLeft}{poisonFx!.dice.replace(/^\d+/, '')} {poisonFx!.type}</strong>.
                            End of your turn: DC {poisonFx!.save.dc} {ABILITY_FULL[poisonFx!.save.ability]} save; a success removes one die.
                          </div>
                          <button type="button"
                            onClick={() => p.usesLeft === 1 ? endPotion(p.id) : update({ usesLeft: p.usesLeft! - 1 })}
                            className="text-[11px] font-semibold rounded border border-red-300 bg-parchment-50 px-2 py-0.5 text-red-700 hover:bg-red-100 transition-colors"
                          >Saved (−1 die){p.usesLeft === 1 ? ': poison ends' : ''}</button>
                        </div>
                      )}
                      {/* Limited uses (Fire Breath ×3, Fragments of Possibility ×2…) */}
                      {p.usesLeft !== undefined && !isPoison && (
                        <div className="flex items-center gap-1.5 mt-1.5">
                          {Array.from({ length: def?.uses ?? p.usesLeft }).map((_, i) => (
                            <span key={i} className={`w-3 h-3 rounded-full border-2 ${i < p.usesLeft! ? 'bg-teal-500 border-teal-500' : 'border-teal-300'}`} />
                          ))}
                          <span className={`text-xs font-semibold ml-1 ${outOfUses ? 'text-red-600' : 'text-teal-800'}`}>
                            {outOfUses ? 'All used' : `${p.usesLeft} left`}
                          </span>
                          {!outOfUses && (
                            <button type="button" onClick={() => update({ usesLeft: p.usesLeft! - 1 })}
                              className="ml-auto text-[11px] font-semibold rounded border border-teal-400 bg-teal-100 px-2 py-0.5 text-teal-800 hover:bg-teal-200 transition-colors"
                            >Use</button>
                          )}
                        </div>
                      )}
                      {/* What it's doing to your sheet right now */}
                      {applied.length > 0 && !ended && (
                        <ul className="mt-1.5 text-xs font-semibold text-indigo-600 space-y-0.5">
                          {applied.map(line => <li key={line}>✓ {line}</li>)}
                        </ul>
                      )}
                      {def?.note && !ended && <div className="text-[11px] text-parchment-600 mt-1">{def.note}</div>}
                      {outOfUses || isPoison ? null : p.roundsLeft !== undefined ? (
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className={`text-xs font-semibold ${ended ? 'text-red-600' : 'text-teal-800'}`}>
                            {ended ? 'Duration over' : `${p.roundsLeft} round${p.roundsLeft === 1 ? '' : 's'} left`}
                          </span>
                          <span className="text-[11px] text-parchment-400">({p.duration})</span>
                          {!ended && (
                            <button type="button" onClick={() => update({ roundsLeft: Math.max(0, p.roundsLeft! - 1) })}
                              className="ml-auto text-[11px] rounded border border-teal-300 px-1.5 py-0.5 text-teal-700 hover:bg-teal-100 transition-colors"
                            >−1 round</button>
                          )}
                        </div>
                      ) : (
                        <div className="text-xs text-teal-800 mt-1.5">Lasts {p.duration}</div>
                      )}
                    </div>
                  )
                })}
              </div>
              <p className="text-[11px] text-parchment-400 mt-2">Short rests end effects of up to 1 hour; long rests up to 8 hours.</p>
            </div>
          )}
        </div>

        {/* Col 2: Skills */}
        <div className="card p-4 self-start">
          {(() => {
            const changed = SKILLS.filter(s => skillChanged(s))
            return (
              <div className="flex items-center gap-2 mb-2">
                <h2 className="section-header mb-0 flex-1">Skills</h2>
                {changed.length > 0 && (
                  <button type="button" onClick={resetAllSkills}
                    title={`Changed by hand: ${changed.map(s => SKILL_LABELS[s]).join(', ')}. Click to restore them.`}
                    className="text-xs rounded-full px-2.5 py-0.5 border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors shrink-0"
                  >↺ Reset {changed.length} changed</button>
                )}
              </div>
            )
          })()}
          <div className="space-y-0.5">
            {SKILLS.map(skill => {
              const profTags = skillInfo.profTags.get(skill) ?? []
              const expertTags = skillInfo.expertTags.get(skill) ?? []
              const isAutoProf = skillInfo.autoProfs.has(skill)
              const isAutoExpert = skillInfo.autoExpert.has(skill)
              const isManualProf = char.skillProficiencies.includes(skill)
              const isManualExpert = char.skillExpertise.includes(skill)
              const effectiveProf = isManualProf || isAutoProf
              const effectiveExpert = isManualExpert || isAutoExpert
              const hasTags = profTags.length > 0 || expertTags.length > 0

              // Sources show as small coloured dots (legend under the card); hover one to name it
              const tagDot = (kind: SkillSourceTag['kind']) => {
                if (kind === 'bg')     return 'bg-blue-400'
                if (kind === 'race')   return 'bg-green-500'
                if (kind === 'class')  return 'bg-purple-400'
                if (kind === 'feat')   return 'bg-amber-400'
                if (kind === 'item')   return 'bg-indigo-400'
                return 'bg-parchment-300'
              }
              const tagStar = (kind: SkillSourceTag['kind']) => {
                if (kind === 'bg')     return 'text-blue-500'
                if (kind === 'race')   return 'text-green-600'
                if (kind === 'class')  return 'text-purple-500'
                if (kind === 'feat')   return 'text-amber-500'
                if (kind === 'item')   return 'text-indigo-500'
                return 'text-parchment-400'
              }
              const tagTitle = (tag: SkillSourceTag) =>
                tag.kind === 'bg' ? 'Background' : tag.kind === 'item' ? `Item: ${tag.label}` : tag.kind === 'feat' ? `Feat: ${tag.label}`
                  : tag.kind === 'class' ? `Class: ${tag.label.charAt(0).toUpperCase()}${tag.label.slice(1)}` : tag.kind === 'race' ? `Race: ${tag.label}` : tag.label

              const isModified = skillChanged(skill)

              return (
                <div key={skill}>
                  <div className={`flex items-center gap-1.5 text-sm px-1 py-[3px] rounded ${isModified ? 'bg-amber-50' : 'hover:bg-parchment-50'}`}>
                    {/* Prof checkbox — manual only; auto profs show as locked */}
                    <input
                      type="checkbox"
                      className="w-[18px] h-[18px] sm:w-auto sm:h-auto"
                      checked={effectiveProf}
                      disabled={isAutoProf && !isManualProf}
                      title={isAutoProf && !isManualProf ? `Granted by: ${profTags.map(t => t.label).join(', ')}` : 'Proficient'}
                      aria-label={`${SKILL_LABELS[skill]} proficiency`}
                      onChange={e => {
                        const s = new Set(char.skillProficiencies)
                        e.target.checked ? s.add(skill) : s.delete(skill)
                        patch({ skillProficiencies: [...s] })
                      }}
                    />
                    {/* Expert checkbox */}
                    <input
                      type="checkbox"
                      className="w-[18px] h-[18px] sm:w-auto sm:h-auto"
                      checked={effectiveExpert}
                      disabled={isAutoExpert && !isManualExpert}
                      title={isAutoExpert && !isManualExpert ? `Expertise granted by: ${expertTags.map(t => t.label).join(', ')}` : 'Expertise (double proficiency)'}
                      aria-label={`${SKILL_LABELS[skill]} expertise`}
                      onChange={e => {
                        const s = new Set(char.skillExpertise)
                        e.target.checked ? s.add(skill) : s.delete(skill)
                        patch({ skillExpertise: [...s] })
                      }}
                    />
                    <span className="w-8 font-mono text-right text-xs text-parchment-700 shrink-0">{formatMod(skillMod(effectiveCharSkills, skill) + itemBonuses.abilityCheckBonus)}</span>
                    <span className={`flex-1 min-w-0 ${effectiveExpert ? 'font-semibold' : ''}`}>{SKILL_LABELS[skill]}</span>
                    {(() => {
                      // Active potions giving advantage/disadvantage on this skill's ability checks
                      const ab = SKILL_ABILITY[skill]
                      const adv = potionFx.checkAdvantage.has(ab), dis = potionFx.checkDisadvantage.has(ab)
                      if (adv === dis) return null
                      return adv
                        ? <span className="text-[10px] font-semibold rounded px-1.5 py-0.5 bg-teal-100 text-teal-700 shrink-0" title="From an active potion">Adv</span>
                        : <span className="text-[10px] font-semibold rounded px-1.5 py-0.5 bg-red-100 text-red-700 shrink-0" title="From an active potion">Disadv</span>
                    })()}
                    {isModified && (
                      <button type="button" onClick={() => resetSkill(skill)}
                        title={`Changed by hand. Originally ${skillBaseProf.has(skill) ? (skillBaseExpert.has(skill) ? 'expertise' : 'proficient') : 'not proficient'}. Click to reset.`}
                        className="text-[11px] font-semibold text-amber-700 hover:text-amber-900 shrink-0"
                      >↺ reset</button>
                    )}
                    {/* Where it comes from: a dot per source, a star for expertise */}
                    <div className="flex items-center gap-1 shrink-0">
                      {profTags.map((tag, i) => (
                        <span key={i} className={`w-2 h-2 rounded-full ${tagDot(tag.kind)}`} title={tagTitle(tag)} />
                      ))}
                      {expertTags.map((tag, i) => (
                        <span key={`e${i}`} className={`text-[11px] leading-none ${tagStar(tag.kind)}`} title={`Expertise from ${tagTitle(tag)}`}>★</span>
                      ))}
                      {isManualProf && profTags.filter(t => t.kind !== 'manual').length === 0 && !hasTags && (
                        <span className="w-2 h-2 rounded-full border border-parchment-400" title="Added by hand" />
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          <p className="text-xs text-parchment-400 mt-2">☐ prof · ☐ expertise{jackOfAllTrades ? ' · Bard: ½ PB on non-prof' : ''}</p>
          <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-parchment-500 mt-1">
            <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-400" />class</span>
            <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400" />background</span>
            <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" />race</span>
            <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" />feat</span>
            <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-400" />item</span>
            <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full border border-parchment-400" />by hand</span>
            <span>★ expertise</span>
          </p>
          {char.classes.some(c => c.classSlug === 'rogue' && c.level >= 11) && (
            <p className="text-xs text-amber-600 mt-1">Reliable Talent: treat proficient roll ≤ 9 as 10.</p>
          )}
        </div>

        {/* Col 3: Status (Inspiration, Exhaustion, Conditions) */}
        <div className="space-y-4">
          <div className="card p-4">
            <h2 className="section-header">Status</h2>
            {/* Inspiration: click to gain it; press and hold the glowing gem to spend it */}
            <InspirationToken held={char.inspiration} onChange={v => patch({ inspiration: v })} />
            {/* In the fight: Rage (barbarians) and Bless from an ally. A minute each; a rest ends them. */}
            {(() => {
              const rage = classResources.find(r => r.key === 'rage-uses')
              const rageLeft = rage ? (rage.max === null ? Infinity : rage.current) : 0
              const bear = char.featuresChosen.some(fc => fc.key === 'totem-spirit' && fc.value === 'bear')
              return (
                <div className="mb-4">
                  <div className="flex flex-wrap gap-1.5">
                    {barbarianLevel > 0 && (
                      <button type="button" onClick={raging ? () => setRaging(false) : startRage} disabled={!raging && rageLeft <= 0}
                        title={raging ? 'Stop raging' : rageLeft <= 0 ? 'No rages left — a long rest restores them' : 'Start raging (uses one Rage)'}
                        className={`px-3 py-1 rounded-full border text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${raging ? 'bg-red-600 border-red-600 text-white shadow-[0_0_10px_rgba(220,38,38,0.45)]' : 'border-red-300 text-red-700 hover:bg-red-50'}`}
                      >{raging ? 'Raging · end' : `Rage${rage?.max !== null ? ` (${rageLeft} left)` : ''}`}</button>
                    )}
                    <button type="button" onClick={() => setBlessed(b => !b)}
                      title={blessed ? 'Bless has ended' : 'An ally cast Bless on you: +1d4 to attack rolls and saving throws'}
                      className={`px-3 py-1 rounded-full border text-xs font-semibold transition-colors ${blessed ? 'bg-amber-400 border-amber-400 text-white' : 'border-amber-300 text-amber-700 hover:bg-amber-50'}`}
                    >{blessed ? 'Blessed · end' : 'Blessed'}</button>
                  </div>
                  {raging && (
                    <p className="text-[11px] text-red-700 mt-1.5 leading-snug">
                      +{rageDamage} melee damage with Strength · advantage on Strength checks and saves · resistance to {bear ? 'all damage but psychic' : 'bludgeoning, piercing and slashing'} · no spells or concentration
                    </p>
                  )}
                  {blessed && <p className="text-[11px] text-amber-700 mt-1.5 leading-snug">+1d4 to attack rolls and saving throws</p>}
                </div>
              )
            })()}
            {/* Wild Shape (druid 2+): take a beast form; the beast's HP soak damage first */}
            {(() => {
              const druid = char.classes.find(c => c.classSlug === 'druid')
              if (!druid || druid.level < 2) return null
              const use = classResources.find(r => r.key === 'wild-shape')
              const usesLeft = use ? (use.max === null ? Infinity : use.current) : 0
              const limits = wildShapeLimits(druid.level, druid.subclassSlug === 'moon')
              return (
                <div className="mb-4">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-parchment-500 mb-1">Wild Shape</div>
                  {wildShapeForm ? (
                    <div className="rounded-lg border border-green-300 bg-green-50 px-3 py-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-green-800 flex-1">You're {/^[aeiou]/i.test(wildShapeForm.name) ? 'an' : 'a'} {wildShapeForm.name}</span>
                        <button type="button" onClick={revertWildShape} className="text-xs rounded-full px-2.5 py-0.5 border border-green-400 text-green-800 hover:bg-green-100">Change back</button>
                      </div>
                      <div className="text-xs text-green-700 mt-0.5">{wildShapeForm.hp.current}/{wildShapeForm.hp.max} HP · AC {wildShapeForm.ac} · {[wildShapeForm.speed ? `${wildShapeForm.speed} ft` : '', wildShapeForm.notes.replace(/^Also /, '')].filter(Boolean).join(', ')}</div>
                      {(wildShapeForm.resistances.length > 0 || wildShapeForm.immunities.length > 0) && (
                        <div className="text-[11px] text-green-700 mt-0.5">
                          {wildShapeForm.resistances.length > 0 && <>Resists {wildShapeForm.resistances.join(', ')}. </>}
                          {wildShapeForm.immunities.length > 0 && <>Immune to {wildShapeForm.immunities.join(', ')}.</>}
                        </div>
                      )}
                      {/* Hours equal to half the druid level (PHB p.67); a long rest ends it here, a short rest too when it's only an hour */}
                      <div className="text-[11px] text-green-700 mt-0.5">Lasts up to {Math.max(1, Math.floor(druid.level / 2))} hour{Math.floor(druid.level / 2) > 1 ? 's' : ''}</div>
                      {/* Combat Wild Shape (Circle of the Moon): a bonus action and a spell slot heal 1d8 per slot level */}
                      {druid.subclassSlug === 'moon' && (() => {
                        const slotMax = (l: number) => multiclassMaxes ? (multiclassMaxes[String(l)] ?? 0) : (char.spellSlots[String(l)]?.max ?? 0)
                        const slotUsed = (l: number) => char.spellSlots[String(l)]?.used ?? 0
                        const levels = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter(l => slotMax(l) - slotUsed(l) > 0)
                        const ord = ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th']
                        const roll = parseInt(cwsRoll, 10)
                        const rollOk = cwsLevel !== null && roll >= cwsLevel && roll <= cwsLevel * 8
                        const heal = () => {
                          if (cwsLevel === null || !rollOk) return
                          patch({
                            spellSlots: { ...char.spellSlots, [String(cwsLevel)]: { max: slotMax(cwsLevel), used: slotUsed(cwsLevel) + 1 } },
                            summons: char.summons.map(sm => sm.id === wildShapeForm.id ? { ...sm, hp: { ...sm.hp, current: Math.min(sm.hp.max, sm.hp.current + roll) } } : sm),
                          })
                          setCwsLevel(null); setCwsRoll('')
                        }
                        return (
                          <div className="mt-2 pt-2 border-t border-green-200">
                            <div className="text-[11px] font-semibold text-green-800">Combat Wild Shape: spend a slot to heal 1d8 per slot level</div>
                            {cwsLevel === null ? (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {levels.map(l => (
                                  <button key={l} type="button" onClick={() => { setCwsLevel(l); setCwsRoll('') }}
                                    title={`Spend a ${ord[l]}-level slot: heal ${l}d8`}
                                    className="text-xs rounded-full px-2 py-0.5 border border-green-300 text-green-800 hover:bg-green-100">{ord[l]}</button>
                                ))}
                                {levels.length === 0 && <span className="text-xs italic text-green-700">No spell slots left</span>}
                              </div>
                            ) : (
                              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                <span className="text-xs text-green-800">Roll {cwsLevel}d8:</span>
                                <input type="number" min={cwsLevel} max={cwsLevel * 8} value={cwsRoll} placeholder={`${cwsLevel}–${cwsLevel * 8}`}
                                  aria-label={`Combat Wild Shape roll, ${cwsLevel}d8`}
                                  onChange={e => setCwsRoll(e.target.value)} className="input text-xs py-0.5 w-16 text-center" />
                                <button type="button" disabled={!rollOk} onClick={heal}
                                  className="text-xs rounded-full px-2.5 py-0.5 border border-green-400 text-green-800 font-semibold hover:bg-green-100 disabled:opacity-40">Heal {rollOk ? roll : ''}</button>
                                <button type="button" onClick={() => setCwsLevel(null)} className="text-xs text-green-700 hover:underline">Cancel</button>
                              </div>
                            )}
                          </div>
                        )
                      })()}
                    </div>
                  ) : (
                    <>
                      <button type="button" onClick={() => setBeastPickerOpen(o => !o)} disabled={usesLeft <= 0}
                        title={usesLeft <= 0 ? 'No Wild Shape uses left — a short rest restores them' : undefined}
                        className="px-3 py-1 rounded-full border text-xs font-semibold border-green-300 text-green-800 hover:bg-green-50 disabled:opacity-40 disabled:cursor-not-allowed"
                      >{beastPickerOpen ? 'Cancel' : `Take a beast form${use?.max !== null ? ` (${usesLeft} left)` : ''}`}</button>
                      {beastPickerOpen && (
                        <div className="mt-2 rounded-lg border border-parchment-200 bg-parchment-50 divide-y divide-parchment-100 max-h-72 overflow-y-auto [scrollbar-width:thin]">
                          {WILD_SHAPE_BEASTS.map(b => {
                            const blocked = wildShapeBlocked(b, limits)
                            return (
                              <button key={b.slug} type="button" disabled={!!blocked} title={blocked ?? undefined}
                                onClick={() => { enterWildShape(b); setBeastPickerOpen(false) }}
                                className="w-full text-left px-2.5 py-1.5 flex items-center gap-2 text-xs hover:bg-green-50 disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed">
                                <span className="font-semibold text-parchment-900 flex-1">{b.name}</span>
                                <span className="text-parchment-500">CR {formatCr(b.cr)} · {b.hp} HP · AC {b.ac} · {[b.speed ? `${b.speed} ft` : '', b.otherSpeeds ?? ''].filter(Boolean).join(', ')}</span>
                              </button>
                            )
                          })}
                          {/* Elemental Wild Shape (Moon 10): both uses for an elemental */}
                  {canElementalWildShape(druid.level, druid.subclassSlug === 'moon') && (
                    <>
                      <div className="px-2.5 pt-2 pb-1 text-[10px] font-bold uppercase tracking-widest text-parchment-500 bg-parchment-100/60">Elemental Wild Shape · both uses</div>
                      {ELEMENTAL_FORMS.map(b => {
                        const blocked = usesLeft < 2 ? 'Takes both Wild Shape uses' : null
                        return (
                          <button key={b.slug} type="button" disabled={!!blocked} title={blocked ?? undefined}
                            onClick={() => { enterWildShape(b); setBeastPickerOpen(false) }}
                            className="w-full text-left px-2.5 py-1.5 flex items-center gap-2 text-xs hover:bg-green-50 disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed">
                            <span className="font-semibold text-parchment-900 flex-1">{b.name}</span>
                            <span className="text-parchment-500">{b.hp} HP · AC {b.ac} · {[b.speed ? `${b.speed} ft` : '', b.otherSpeeds ?? ''].filter(Boolean).join(', ')}</span>
                          </button>
                        )
                      })}
                    </>
                  )}
                  {/* Any other beast: enter its numbers */}
                          <div className="px-2.5 py-2 flex flex-wrap items-center gap-1.5 text-xs">
                            <input className="input text-xs py-1 flex-1 min-w-[7rem]" placeholder="Other beast" value={customBeast.name} onChange={e => setCustomBeast(c => ({ ...c, name: e.target.value }))} />
                            <input className="input text-xs py-1 w-14" placeholder="HP" inputMode="numeric" value={customBeast.hp} onChange={e => setCustomBeast(c => ({ ...c, hp: e.target.value }))} />
                            <input className="input text-xs py-1 w-14" placeholder="AC" inputMode="numeric" value={customBeast.ac} onChange={e => setCustomBeast(c => ({ ...c, ac: e.target.value }))} />
                            <input className="input text-xs py-1 w-16" placeholder="Speed" inputMode="numeric" value={customBeast.speed} onChange={e => setCustomBeast(c => ({ ...c, speed: e.target.value }))} />
                            <button type="button" disabled={!customBeast.name.trim() || !(parseInt(customBeast.hp) > 0)}
                              onClick={() => { enterWildShape({ name: customBeast.name.trim(), hp: parseInt(customBeast.hp), ac: parseInt(customBeast.ac) || 10, speed: parseInt(customBeast.speed) || 30 }); setBeastPickerOpen(false) }}
                              className="rounded-full px-2.5 py-1 border border-green-300 text-green-800 font-semibold hover:bg-green-50 disabled:opacity-40">Take form</button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )
            })()}
            {/* Spells on you that change your AC or speed (cast by you or an ally) */}
            {(() => {
              const wearingArmor = char.equipment.some(e => e.equipped && (() => { const a = resolveArmor(e, content.items); return !!a && a.type !== 'shield' })())
              const SPELLS: { key: 'mage-armor' | 'shield' | 'shield-of-faith' | 'haste' | 'barkskin'; label: string; tip: string }[] = [
                { key: 'mage-armor', label: 'Mage Armor', tip: wearingArmor ? 'Only works without armor' : 'AC becomes 13 + DEX (8 hours)' },
                { key: 'shield', label: 'Shield +5', tip: 'Reaction: +5 AC until the start of your next turn' },
                { key: 'shield-of-faith', label: 'Shield of Faith', tip: '+2 AC (concentration, 10 minutes)' },
                { key: 'haste', label: 'Haste', tip: '+2 AC, double speed, advantage on DEX saves (concentration, 1 minute)' },
                { key: 'barkskin', label: 'Barkskin', tip: "AC can't be less than 16 (concentration, 1 hour)" },
              ]
              return (
                <div className="mb-4">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-parchment-500 mb-1">Spells on you</div>
                  <div className="flex flex-wrap gap-1.5">
                    {SPELLS.map(sp => {
                      const on = spellsOnYou.has(sp.key)
                      return (
                        <button key={sp.key} type="button" onClick={() => toggleSpellOnYou(sp.key)} title={sp.tip} aria-pressed={on}
                          className={`px-2.5 py-0.5 rounded-full border text-xs font-semibold transition-colors ${on ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-indigo-200 text-indigo-700 hover:bg-indigo-50'} ${sp.key === 'mage-armor' && wearingArmor && !on ? 'opacity-50' : ''}`}
                        >{sp.label}</button>
                      )
                    })}
                  </div>
                </div>
              )
            })()}
            <div className="text-xs font-semibold text-parchment-600 uppercase tracking-wide mb-1.5">Exhaustion</div>
            <div className="flex gap-1 mb-1">
              {[1,2,3,4,5,6].map(lvl => (
                <button
                  key={lvl}
                  title={(['Disadv. on ability checks','Speed halved','Disadv. on attacks & saves','HP max halved','Speed = 0','Death'])[lvl-1]}
                  onClick={() => patch({ exhaustionLevel: char.exhaustionLevel === lvl ? lvl - 1 : lvl })}
                  className={`w-7 h-7 rounded text-xs font-bold border-2 transition-colors ${
                    char.exhaustionLevel >= lvl
                      ? lvl === 6 ? 'bg-red-700 border-red-700 text-white' : 'bg-red-500 border-red-500 text-white'
                      : 'border-parchment-300 text-parchment-400 hover:border-red-300'
                  }`}
                >{lvl}</button>
              ))}
            </div>
            {char.exhaustionLevel > 0 && (
              <ul className="text-xs text-red-600 mt-1 space-y-0.5">
                {(['Disadv. on ability checks','Speed halved','Disadv. on attacks & saves','HP max halved','Speed = 0','Dead'] as const)
                  .slice(0, char.exhaustionLevel)
                  .map((effect, i) => <li key={i}>· {effect}</li>)}
              </ul>
            )}

            {/* Conditions: only the ones you have, each with its effect; add more from the list */}
            <div className="text-xs font-semibold text-parchment-600 uppercase tracking-wide mt-4 mb-1.5">Conditions</div>
            {char.conditions.length === 0 && <p className="text-xs text-parchment-400 mb-2">None</p>}
            {char.conditions.length > 0 && (
              <ul className="space-y-1.5 mb-2">
                {char.conditions.map(name => (
                  <li key={name} className="rounded border border-red-200 bg-red-50 px-2.5 py-1.5">
                    <div className="flex items-center gap-2">
                      <span className="flex-1 text-sm font-semibold text-red-700">{name}</span>
                      <button type="button" onClick={() => patch({ conditions: char.conditions.filter(c => c !== name) })}
                        title={`Remove ${name}`} aria-label={`Remove ${name}`}
                        className="text-xs text-red-400 hover:text-red-700 transition-colors">✕</button>
                    </div>
                    {CONDITIONS.find(c => c.name === name) && (
                      <p className="text-xs text-parchment-600 leading-snug mt-0.5">{CONDITIONS.find(c => c.name === name)!.effect}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {CONDITIONS.some(c => !char.conditions.includes(c.name)) && (
              <select className="input text-xs py-1" value="" aria-label="Add a condition"
                onChange={e => { if (e.target.value) patch({ conditions: [...char.conditions, e.target.value] }) }}>
                <option value="">+ Add a condition…</option>
                {CONDITIONS.filter(c => !char.conditions.includes(c.name)).map(c => (
                  <option key={c.name} value={c.name}>{c.name}</option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* Proficiencies — full width. Each shows where it comes from; Edit adds and removes them, and
          "Your gear" shows whether you're proficient with what you carry. */}
      {(() => {
        const sources = proficiencySources(char, content, featSlugs)
        // A free pick ("one language of your choice") isn't recorded against its source, so unlisted ones may be either
        const fromText = (from: string[] | undefined) => from?.length ? `From ${from.join(', ')}` : 'Chosen or added by hand'
        const chip = (label: string, title: string, tone: string, onRemove?: () => void) => (
          <span key={label} title={title} className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs capitalize ${tone}`}>
            {label}
            {profEditing && onRemove && (
              <button type="button" onClick={onRemove} aria-label={`Remove ${label}`} className="opacity-50 hover:opacity-100 hover:text-red-600 leading-none">✕</button>
            )}
          </span>
        )

        // Armor: four kinds. Feat armor is always on (remove the feat to lose it).
        const storedArmor = armorKindsOf(char.armorProficiencies)
        const toggleArmor = (k: ArmorKind) => {
          const next = new Set(storedArmor)
          if (next.has(k)) next.delete(k); else next.add(k)
          patch({ armorProficiencies: ARMOR_KINDS.filter(a => next.has(a.key)).map(a => a.key) })
        }
        // Weapons: Simple / Martial, plus named weapons stored by name ("Longsword", "Pistol")
        const weaponKeys = new Set(char.weaponProficiencies.map(profKey))
        const addWeapon = (name: string) => {
          if (!weaponKeys.has(profKey(name))) patch({ weaponProficiencies: [...char.weaponProficiencies, name] })
        }
        const toggleCategory = (cat: 'simple' | 'martial') => weaponKeys.has(cat)
          ? patch({ weaponProficiencies: char.weaponProficiencies.filter(w => profKey(w) !== cat) })
          : addWeapon(cat)
        const namedWeapons = char.weaponProficiencies.filter(w => !['simple', 'martial'].includes(profKey(w)))
        const weaponOptions = [...new Map(content.items
          .filter(i => i.weaponStats && i.weaponStats.damage !== '—' && (!i.rarity || i.rarity.toLowerCase() === 'common'))
          .map(i => [profKey(i.weaponStats!.label ?? i.name ?? i.slug), { name: i.weaponStats!.label ?? i.name ?? i.slug, simple: SIMPLE_WEAPON_SLUGS.has(i.slug) }])).values()]
          .filter(w => !weaponKeys.has(profKey(w.name)))
          .sort((a, b) => a.name.localeCompare(b.name))
        // Tools and languages
        const toolKeys = new Set(char.toolProficiencies.map(profKey))
        const addTool = (name: string) => { if (name && !toolKeys.has(profKey(name))) patch({ toolProficiencies: [...char.toolProficiencies, name] }) }
        const langKeys = new Set(char.languages.map(profKey))
        const addLanguage = (name: string) => { if (name && !langKeys.has(profKey(name))) patch({ languages: [...char.languages, name] }) }

        // Your gear: is the character proficient with what it carries?
        const gearWeapons = char.equipment.flatMap(e => {
          const ws = resolveWeapon(e, content.items)
          return ws ? [{ e, base: ws.label ?? e.name, ok: isWeaponProficient(char, e) }] : []
        })
        const gearArmor = char.equipment.flatMap(e => {
          const as_ = resolveArmor(e, content.items)
          return as_ ? [{ e, kind: (as_.type === 'shield' ? 'shields' : as_.type) as ArmorKind, ok: isArmorProficient(char, as_, featArmor) }] : []
        })
        const gearTools = char.equipment.filter(e => isToolItem(e.name)).map(e => ({ e, ok: toolKeys.has(profKey(e.name)) }))
        const gear = [
          ...gearWeapons.map(g => ({ key: `w${g.e.name}`, name: g.e.name, ok: g.ok, add: () => addWeapon(g.base), what: `${g.base} proficiency` })),
          ...gearArmor.map(g => ({ key: `a${g.e.name}`, name: g.e.name, ok: g.ok, add: () => toggleArmor(g.kind), what: `${g.kind === 'shields' ? 'shield' : g.kind + ' armor'} proficiency` })),
          ...gearTools.map(g => ({ key: `t${g.e.name}`, name: g.e.name, ok: g.ok, add: () => addTool(g.e.name), what: `${g.e.name} proficiency` })),
        ]

        return (
          <div className="card">
            <div className="flex items-center gap-2 mb-3">
              <h2 className="section-header mb-0 flex-1">All Proficiencies</h2>
              <button type="button" onClick={() => setProfEditing(v => !v)}
                className={`text-xs rounded-full px-2.5 py-0.5 border transition-colors ${profEditing ? 'bg-parchment-700 text-white border-parchment-700' : 'border-parchment-200 text-parchment-500 hover:border-parchment-500 hover:text-parchment-800'}`}
              >{profEditing ? 'Done' : '✎ Edit'}</button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="font-semibold text-parchment-700 mb-1">Armor</div>
                <div className="flex flex-wrap gap-1">
                  {profEditing
                    ? ARMOR_KINDS.map(a => {
                        const viaFeat = featArmor.get(a.key)
                        const on = storedArmor.has(a.key) || !!viaFeat
                        return (
                          <button key={a.key} type="button" aria-pressed={on} disabled={!!viaFeat}
                            onClick={() => toggleArmor(a.key)} title={viaFeat ? `From ${viaFeat}` : fromText(sources.armor.get(a.key))}
                            className={`rounded px-2 py-0.5 text-xs border transition-colors ${on ? 'bg-blue-100 text-blue-700 border-blue-200 font-semibold' : 'border-dashed border-parchment-300 text-parchment-400 hover:border-blue-300 hover:text-blue-700'} disabled:cursor-not-allowed`}
                          >{a.label}{viaFeat ? ' 🔒' : ''}</button>
                        )
                      })
                    : ARMOR_KINDS.filter(a => storedArmor.has(a.key) || featArmor.has(a.key)).map(a =>
                        chip(a.label, featArmor.get(a.key) ? `From ${featArmor.get(a.key)}` : fromText(sources.armor.get(a.key)), 'bg-blue-100 text-blue-700'))}
                  {!profEditing && storedArmor.size === 0 && featArmor.size === 0 && <span className="text-parchment-400 text-xs">None</span>}
                </div>
              </div>
              <div>
                <div className="font-semibold text-parchment-700 mb-1">Weapons</div>
                <div className="flex flex-wrap gap-1">
                  {profEditing
                    ? (['simple', 'martial'] as const).map(cat => (
                        <button key={cat} type="button" aria-pressed={weaponKeys.has(cat)} onClick={() => toggleCategory(cat)} title={fromText(sources.weapons.get(cat))}
                          className={`rounded px-2 py-0.5 text-xs border capitalize transition-colors ${weaponKeys.has(cat) ? 'bg-green-100 text-green-700 border-green-200 font-semibold' : 'border-dashed border-parchment-300 text-parchment-400 hover:border-green-300 hover:text-green-700'}`}
                        >{cat}</button>
                      ))
                    : (['simple', 'martial'] as const).filter(cat => weaponKeys.has(cat)).map(cat => chip(cat, fromText(sources.weapons.get(cat)), 'bg-green-100 text-green-700'))}
                  {namedWeapons.map(w => chip(w, fromText(sources.weapons.get(profKey(w))), 'bg-green-100 text-green-700',
                    () => patch({ weaponProficiencies: char.weaponProficiencies.filter(x => x !== w) })))}
                  {!profEditing && char.weaponProficiencies.length === 0 && <span className="text-parchment-400 text-xs">None</span>}
                </div>
                {profEditing && (
                  <select className="input text-xs py-1 mt-1.5" value="" aria-label="Add a weapon proficiency"
                    onChange={e => { if (e.target.value) addWeapon(e.target.value) }}>
                    <option value="">+ Add a weapon…</option>
                    <optgroup label="Simple">{weaponOptions.filter(w => w.simple).map(w => <option key={w.name} value={w.name}>{w.name}</option>)}</optgroup>
                    <optgroup label="Martial & other">{weaponOptions.filter(w => !w.simple).map(w => <option key={w.name} value={w.name}>{w.name}</option>)}</optgroup>
                  </select>
                )}
              </div>
              <div>
                <div className="font-semibold text-parchment-700 mb-1">Tools</div>
                <div className="flex flex-wrap gap-1">
                  {char.toolProficiencies.map(t => chip(t, fromText(sources.tools.get(profKey(t))), 'bg-parchment-100 text-parchment-700',
                    () => patch({ toolProficiencies: char.toolProficiencies.filter(x => x !== t) })))}
                  {!profEditing && char.toolProficiencies.length === 0 && <span className="text-parchment-400 text-xs">None recorded</span>}
                </div>
                {profEditing && (
                  <div className="mt-1.5 space-y-1">
                    <select className="input text-xs py-1" value="" aria-label="Add a tool proficiency" onChange={e => addTool(e.target.value)}>
                      <option value="">+ Add a tool…</option>
                      {([["Artisan's tools", ARTISAN_TOOLS], ['Instruments', MUSICAL_INSTRUMENTS], ['Gaming sets', GAMING_SETS], ['Other tools', OTHER_TOOLS]] as const).map(([group, list]) => (
                        <optgroup key={group} label={group}>
                          {list.filter(t => !toolKeys.has(profKey(t))).map(t => <option key={t} value={t}>{t}</option>)}
                        </optgroup>
                      ))}
                    </select>
                    <input className="input text-xs py-1" placeholder="Other… (press Enter)" value={newToolText}
                      onChange={e => setNewToolText(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { addTool(newToolText.trim()); setNewToolText('') } }} />
                  </div>
                )}
              </div>
              <div>
                <div className="font-semibold text-parchment-700 mb-1">Languages</div>
                {char.languages.length > 0
                  ? <div className="flex flex-wrap gap-1">{char.languages.map(l => {
                  const picks = languageChoiceCount(l)
                  if (!picks) return chip(l, fromText(sources.languages.get(profKey(l))), 'bg-parchment-100 text-parchment-700',
                    () => patch({ languages: char.languages.filter(x => x !== l) }))
                  // "one language of your choice" left over from creation — ask for it here
                  const known = new Set(char.languages)
                  return (
                    <select key={l} value="" aria-label="Choose a language"
                      className="rounded px-1.5 py-0.5 text-xs border border-amber-300 bg-amber-50 text-amber-800"
                      onChange={e => {
                        const rest = languageChoicePlaceholder(picks - 1)
                        patch({ languages: char.languages.flatMap(x => x === l ? [e.target.value, ...(rest ? [rest] : [])] : [x]) })
                      }}>
                      <option value="">Choose {picks > 1 ? `${picks} languages` : 'a language'}…</option>
                      <optgroup label="Standard">{LANGUAGES_STANDARD.filter(x => !known.has(x)).map(x => <option key={x}>{x}</option>)}</optgroup>
                      <optgroup label="Exotic">{LANGUAGES_EXOTIC.filter(x => !known.has(x)).map(x => <option key={x}>{x}</option>)}</optgroup>
                    </select>
                  )
                })}</div>
                  : <span className="text-parchment-400 text-xs">None recorded</span>}
                {profEditing && (
                  <div className="mt-1.5 space-y-1">
                    <select className="input text-xs py-1" value="" aria-label="Add a language" onChange={e => addLanguage(e.target.value)}>
                      <option value="">+ Add a language…</option>
                      <optgroup label="Standard">{LANGUAGES_STANDARD.filter(x => !langKeys.has(profKey(x))).map(x => <option key={x}>{x}</option>)}</optgroup>
                      <optgroup label="Exotic">{LANGUAGES_EXOTIC.filter(x => !langKeys.has(profKey(x))).map(x => <option key={x}>{x}</option>)}</optgroup>
                    </select>
                    <input className="input text-xs py-1" placeholder="Other… (press Enter)" value={newLangText}
                      onChange={e => setNewLangText(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { addLanguage(newLangText.trim()); setNewLangText('') } }} />
                  </div>
                )}
              </div>
            </div>
            {gear.length > 0 && (
              <div className="mt-4 pt-3 border-t border-parchment-100">
                <div className="font-semibold text-parchment-700 mb-2 text-sm">Your gear</div>
                <div className="flex flex-wrap gap-1.5">
                  {gear.map(g => (
                    <span key={g.key}
                      className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs border ${g.ok ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-800 border-amber-300'}`}
                      title={g.ok ? 'Proficient' : 'Not proficient: no proficiency bonus with this'}>
                      {g.ok ? '✓' : '⚠'} {g.name}
                      {!g.ok && (
                        <button type="button" onClick={g.add} title={`Add ${g.what}`} aria-label={`Add ${g.what}`}
                          className="ml-0.5 font-bold hover:text-green-700">+</button>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })()}
    </div>
  )
}
