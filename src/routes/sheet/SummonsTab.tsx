import { Summon } from '../../character/model'
import { useSheet } from './SheetContext'

// Summons share one colour: amber, like a conjured spark
const SUMMON_HEX = '#d97706'

/** The Summons tab: active summons and custom summons */
export function SummonsTab() {
  const {
    id,
    char,
    activeSummonId,
    setActiveSummonId,
    newSummonForm,
    setNewSummonForm,
    offerUndo,
    patch,
    maxHp,
    ac,
    speed,
    resistances,
    hpPct,
  } = useSheet()
  const activeSummon = activeSummonId ? char.summons.find(s => s.id === activeSummonId) : null

  const dismissSummon = (id: string) => {
    offerUndo(`Dismissed ${char.summons.find(s => s.id === id)?.name ?? 'the summon'}`)
    patch({ summons: char.summons.filter(s => s.id !== id) })
    if (activeSummonId === id) setActiveSummonId(null)
  }

  const updateSummon = (id: string, updates: Partial<Summon>) => {
    patch({ summons: char.summons.map(s => s.id === id ? { ...s, ...updates } : s) })
  }

  const adjustSummonHp = (id: string, delta: number, max: number, current: number) => {
    updateSummon(id, { hp: { max, current: Math.max(0, Math.min(max, current + delta)) } })
  }

  // Detail view
  if (activeSummon) {
    const s = activeSummon
    const hpPct = s.hp.max > 0 ? Math.min(100, (s.hp.current / s.hp.max) * 100) : 0
    const hpColor = hpPct > 50 ? 'bg-green-500' : hpPct > 25 ? 'bg-yellow-400' : 'bg-red-500'
    const ABILITY_SHORT = ['str','dex','con','int','wis','cha'] as const
    const modOf = (v: number) => Math.floor((v - 10) / 2)
    const fmtMod = (n: number) => n >= 0 ? `+${n}` : `${n}`

    return (
      <div className="space-y-4">
        <button type="button" onClick={() => setActiveSummonId(null)}
          className="text-xs text-parchment-500 hover:text-parchment-800 border border-parchment-200 rounded-full px-2.5 py-1 transition-colors">
          ← All summons
        </button>
        <article className="rounded-xl border bg-parchment-50 shadow-sm overflow-hidden" style={{ borderColor: `${SUMMON_HEX}88` }}>
          <header className="px-4 pt-4 pb-3" style={{ background: `linear-gradient(135deg, ${SUMMON_HEX}38, ${SUMMON_HEX}10 55%, transparent 85%)` }}>
            <div className="flex items-start gap-3">
              <div className="spell-seal shrink-0" style={{ '--seal': SUMMON_HEX } as React.CSSProperties} aria-hidden>{s.name.trim().charAt(0).toUpperCase() || '✦'}</div>
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold text-parchment-900 leading-tight">{s.name}</h2>
                <p className="text-xs text-parchment-600 mt-0.5">
                  AC <span className="font-bold text-parchment-800">{s.ac}</span> · Speed {s.speed} ft
                  {s.immunities.length > 0 && <> · Immune to {s.immunities.join(', ')}</>}
                  {s.resistances.length > 0 && <> · Resists {s.resistances.join(', ')}</>}
                </p>
              </div>
              <button type="button" onClick={() => dismissSummon(s.id)}
                className="text-xs border border-red-200 text-red-500 hover:bg-red-50 rounded-full px-3 py-1 transition-colors shrink-0">Dismiss</button>
            </div>
            <div className="mt-3">
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-parchment-500">Hit Points</span>
                <span className={`font-bold tabular-nums ${s.hp.current === 0 ? 'text-red-600' : 'text-parchment-800'}`}>{s.hp.current} / {s.hp.max}</span>
              </div>
              <div className="h-3 rounded-full bg-parchment-200 overflow-hidden mb-2">
                <div className={`h-full rounded-full transition-all ${hpColor}`} style={{ width: `${hpPct}%` }} />
              </div>
            <div className="flex gap-1.5 flex-wrap">
              {[-5,-1,1,5].map(d => (
                <button key={d} type="button"
                  onClick={() => adjustSummonHp(s.id, d, s.hp.max, s.hp.current)}
                  className="px-2 py-1 text-xs rounded border border-parchment-200 hover:border-parchment-400 text-parchment-600 transition-colors">
                  {d > 0 ? `+${d}` : d}
                </button>
              ))}
              <button type="button"
                onClick={() => updateSummon(s.id, { hp: { ...s.hp, current: s.hp.max } })}
                className="px-2 py-1 text-xs rounded border border-parchment-200 hover:border-parchment-400 text-parchment-600 transition-colors">
                Full
              </button>
              <input type="number" min={0} max={s.hp.max}
                className="input text-xs py-1 w-16 text-center"
                value={s.hp.current}
                onChange={e => updateSummon(s.id, { hp: { ...s.hp, current: Math.max(0, Math.min(s.hp.max, parseInt(e.target.value) || 0)) } })}
              />
            </div>
            </div>
          </header>
        </article>

        {/* Ability scores */}
        {s.abilityScores && (
          <div className="card">
            <h3 className="section-header">Ability Scores</h3>
            <div className="grid grid-cols-6 gap-2 text-center">
              {ABILITY_SHORT.map(a => (
                <div key={a} className="stat-box">
                  <div className="text-xs uppercase text-parchment-500">{a}</div>
                  <div className="text-lg font-bold">{s.abilityScores![a]}</div>
                  <div className="text-sm text-parchment-600">{fmtMod(modOf(s.abilityScores![a]))}</div>
                </div>
              ))}
            </div>
            {s.saveProficiencies.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                <span className="text-xs text-parchment-500 font-semibold self-center">Save Prof:</span>
                {s.saveProficiencies.map(sv => <span key={sv} className="text-xs bg-indigo-100 text-indigo-700 rounded px-2 py-0.5 uppercase font-semibold">{sv}</span>)}
              </div>
            )}
          </div>
        )}

        {/* Attacks */}
        {s.attacks.length > 0 && (
          <div className="card">
            <h3 className="section-header">Attacks</h3>
            <div className="space-y-2">
              {s.attacks.map((atk, i) => (
                <div key={i} className="flex items-start gap-3 p-2 rounded border border-parchment-100">
                  <div className="flex-1">
                    <div className="font-medium text-sm">{atk.name}</div>
                    {atk.notes && <div className="text-xs text-parchment-500 mt-0.5">{atk.notes}</div>}
                  </div>
                  {atk.toHit !== undefined && (
                    <span className="text-xs bg-green-100 text-green-700 border border-green-200 rounded px-1.5 py-0.5 shrink-0">{fmtMod(atk.toHit)} to hit</span>
                  )}
                  {atk.damage && (
                    <span className="text-xs bg-red-100 text-red-700 border border-red-200 rounded px-1.5 py-0.5 shrink-0">{atk.damage}{atk.damageType ? ` ${atk.damageType}` : ''}</span>
                  )}
                  {atk.range && (
                    <span className="text-xs bg-parchment-100 text-parchment-600 rounded px-1.5 py-0.5 shrink-0">{atk.range}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Abilities */}
        {s.abilities.length > 0 && (
          <div className="card">
            <h3 className="section-header">Abilities</h3>
            <div className="space-y-2">
              {s.abilities.map((ab, i) => (
                <div key={i} className="p-2 rounded border border-parchment-100">
                  <div className="font-medium text-sm">{ab.name}</div>
                  {ab.description && <p className="text-sm text-parchment-600 mt-0.5">{ab.description}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        <div className="card">
          <h3 className="section-header">Notes</h3>
          <textarea className="input text-sm min-h-[80px] w-full" value={s.notes}
            onChange={e => updateSummon(s.id, { notes: e.target.value })}
            placeholder="Additional notes…" />
        </div>
      </div>
    )
  }

  // List view
  return (
    <div className="space-y-4">
      {char.summons.length === 0 ? (
        <div className="card text-center py-8 text-parchment-400">
          <div className="text-2xl mb-2">✦</div>
          <div className="font-medium">No active summons</div>
          <div className="text-sm mt-1">Summon creatures from their feature cards, or add a custom one below.</div>
        </div>
      ) : (
        <div className="space-y-3">
          {char.summons.map(s => {
            const hpPct = s.hp.max > 0 ? Math.min(100, (s.hp.current / s.hp.max) * 100) : 0
            const hpColor = hpPct > 50 ? 'bg-green-500' : hpPct > 25 ? 'bg-yellow-400' : 'bg-red-500'
            const modOf = (v: number) => Math.floor((v - 10) / 2)
            const fmtMod = (n: number) => n >= 0 ? `+${n}` : `${n}`
            const ABILITY_SHORT = ['str','dex','con','int','wis','cha'] as const
            return (
              <article key={s.id} className="rounded-xl border bg-parchment-50 shadow-sm overflow-hidden" style={{ borderColor: `${SUMMON_HEX}88` }}>
                {/* Header: who it is, its defences, and its hit points with quick controls */}
                <header className="px-4 pt-3.5 pb-3" style={{ background: `linear-gradient(135deg, ${SUMMON_HEX}38, ${SUMMON_HEX}10 55%, transparent 85%)` }}>
                  <div className="flex items-start gap-3">
                    <div className="spell-seal shrink-0" style={{ '--seal': SUMMON_HEX } as React.CSSProperties} aria-hidden>{s.name.trim().charAt(0).toUpperCase() || '✦'}</div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-parchment-900 leading-tight truncate">{s.name}</h3>
                      <p className="text-xs text-parchment-600 mt-0.5">
                        AC <span className="font-bold text-parchment-800">{s.ac}</span> · Speed {s.speed} ft
                        {s.immunities.length > 0 && <> · Immune to {s.immunities.join(', ')}</>}
                        {s.resistances.length > 0 && <> · Resists {s.resistances.join(', ')}</>}
                      </p>
                    </div>
                    <button type="button" onClick={() => setActiveSummonId(s.id)}
                      className="text-xs border border-parchment-300 text-parchment-600 hover:border-parchment-500 hover:text-parchment-900 rounded-full px-2.5 py-1 transition-colors shrink-0">Details</button>
                    <button type="button" onClick={() => dismissSummon(s.id)}
                      className="text-xs border border-red-200 text-red-500 hover:bg-red-50 rounded-full px-2.5 py-1 transition-colors shrink-0">Dismiss</button>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <div className="flex-1 h-2.5 rounded-full bg-parchment-200 overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${hpColor}`} style={{ width: `${hpPct}%` }} />
                    </div>
                    <span className={`text-sm font-bold tabular-nums shrink-0 ${s.hp.current === 0 ? 'text-red-600' : 'text-parchment-800'}`}>
                      {s.hp.current}<span className="font-normal text-parchment-400">/{s.hp.max}</span>
                    </span>
                    <div className="flex gap-1 shrink-0">
                      {[-5, -1, 1, 5].map(d => (
                        <button key={d} type="button" onClick={() => adjustSummonHp(s.id, d, s.hp.max, s.hp.current)}
                          aria-label={`${d > 0 ? 'Heal' : 'Damage'} ${s.name} by ${Math.abs(d)}`}
                          className={`w-8 h-7 rounded text-xs font-semibold border transition-colors ${d < 0 ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-green-200 text-green-700 hover:bg-green-50'}`}
                        >{d > 0 ? `+${d}` : `−${-d}`}</button>
                      ))}
                    </div>
                  </div>
                </header>

                {/* Attacks as rows, the numbers lined up */}
                {s.attacks.length > 0 && (
                  <div className="px-4 py-2 border-t border-parchment-200 divide-y divide-parchment-100">
                    {s.attacks.map((atk, i) => (
                      <div key={i} className="py-1.5 flex items-center gap-3 text-sm">
                        <span className="flex-1 min-w-0 font-semibold text-parchment-900 truncate" title={atk.notes}>{atk.name}</span>
                        {atk.toHit !== undefined && <span className="text-xs font-semibold text-violet-700 w-16 text-right">{fmtMod(atk.toHit)} to hit</span>}
                        {atk.damage && <span className="text-xs font-semibold text-red-700 w-28 text-right">{atk.damage}{atk.damageType ? ` ${atk.damageType}` : ''}</span>}
                        {atk.range && <span className="text-xs text-parchment-500 w-14 text-right">{atk.range}</span>}
                      </div>
                    ))}
                  </div>
                )}

                {/* Abilities by name (full text in Details), then scores */}
                {(s.abilities.length > 0 || s.abilityScores) && (
                  <div className="px-4 py-2.5 border-t border-parchment-200 space-y-2">
                    {s.abilities.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {s.abilities.map((ab, i) => (
                          <span key={i} title={ab.description} className="text-[11px] font-semibold rounded-full px-2 py-0.5 border bg-indigo-50 border-indigo-200 text-indigo-700">{ab.name}</span>
                        ))}
                      </div>
                    )}
                    {s.abilityScores && (
                      <div className="grid grid-cols-6 gap-1.5">
                        {ABILITY_SHORT.map(a => (
                          <div key={a} className="flex flex-col items-center py-1 rounded bg-parchment-100/60 border border-parchment-200">
                            <span className="text-[9px] font-bold text-parchment-500 uppercase">{a}</span>
                            <span className="text-sm font-bold text-parchment-800 leading-none">{s.abilityScores![a]}</span>
                            <span className="text-[10px] text-parchment-500">{fmtMod(modOf(s.abilityScores![a]))}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}

      {/* Add custom summon */}
      <div className="card">
        <h3 className="section-header">Add Custom Summon</h3>
        {newSummonForm ? (
          <div className="space-y-2">
            <input className="input text-sm" placeholder="Name (e.g. Familiar, Wolf Companion…)"
              value={newSummonForm.name} onChange={e => setNewSummonForm(f => f && ({ ...f, name: e.target.value }))} />
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="label">Max HP</label>
                <input type="number" className="input text-sm" placeholder="20"
                  value={newSummonForm.hp} onChange={e => setNewSummonForm(f => f && ({ ...f, hp: e.target.value }))} />
              </div>
              <div className="flex-1">
                <label className="label">AC</label>
                <input type="number" className="input text-sm" placeholder="13"
                  value={newSummonForm.ac} onChange={e => setNewSummonForm(f => f && ({ ...f, ac: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="button"
                className="btn-primary text-sm flex-1"
                onClick={() => {
                  const maxHp = parseInt(newSummonForm.hp) || 1
                  const ac = parseInt(newSummonForm.ac) || 10
                  const newSummon: Summon = {
                    id: Math.random().toString(36).slice(2, 10),
                    name: newSummonForm.name.trim() || 'Summon',
                    hp: { current: maxHp, max: maxHp },
                    ac, speed: 30,
                    saveProficiencies: [], immunities: [], resistances: [],
                    attacks: [], abilities: [], notes: '',
                  }
                  patch({ summons: [...char.summons, newSummon] })
                  setNewSummonForm(null)
                  setActiveSummonId(newSummon.id)
                }}
              >Add Summon</button>
              <button type="button" className="btn-secondary text-sm"
                onClick={() => setNewSummonForm(null)}>Cancel</button>
            </div>
          </div>
        ) : (
          <button type="button" className="btn-secondary text-sm w-full"
            onClick={() => setNewSummonForm({ name: '', hp: '', ac: '' })}>
            + New Summon
          </button>
        )}
      </div>
    </div>
  )
}
