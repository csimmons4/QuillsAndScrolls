import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Character } from '../character/model'
import { listCharactersFromDisk } from '../storage/charApi'
import { totalLevel } from '../character/derive'
import { restingVitals } from '../character/vitals'
import { useContent } from '../content/ContentProvider'

// Phones and tablets save to the same server, so the page asks again every few seconds
const REFRESH_MS = 5000

/** Everyone at a glance, read-only: HP, AC, passives, spell DC and what's affecting them. For a table
 *  run from one computer, with players on their own sheets (or phones). Click a card for the sheet. */
export default function Party() {
  const content = useContent()
  const [characters, setCharacters] = useState<Character[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    const load = () => listCharactersFromDisk()
      .then(({ characters }) => { if (alive) { setCharacters(characters); setError('') } })
      .catch(() => { if (alive) setError('Could not reach the character server.') })
    load()
    const timer = setInterval(() => { if (document.visibilityState === 'visible') load() }, REFRESH_MS)
    return () => { alive = false; clearInterval(timer) }
  }, [])

  const isFallen = (c: Character) => c.hp.current <= 0 && c.deathSaves.failures >= 3
  const classLine = (c: Character) => c.classes
    .map(cc => `${content.classes.find(k => k.slug === cc.classSlug)?.name ?? cc.classSlug} ${cc.level}`).join(' / ')

  const card = (c: Character) => {
    const v = restingVitals(c, content)
    const form = c.summons.find(s => s.templateKey === 'wild-shape')
    const fallen = isFallen(c)
    const down = c.hp.current <= 0 && !fallen
    const stable = down && c.deathSaves.successes >= 3
    const pct = v.maxHp > 0 ? Math.max(0, Math.min(100, Math.round(c.hp.current / v.maxHp * 100))) : 0
    const concentrating = c.concentratingOn ? content.spells.find(s => s.slug === c.concentratingOn)?.name ?? c.concentratingOn : null
    const chips: { text: string; tone: string; title?: string }[] = [
      ...(form ? [{ text: `${form.name} ${form.hp.current}/${form.hp.max}`, tone: 'border-green-300 bg-green-50 text-green-800', title: 'Wild Shape' }] : []),
      ...(concentrating ? [{ text: `Concentrating: ${concentrating}`, tone: 'border-amber-300 bg-amber-50 text-amber-800' }] : []),
      ...c.conditions.map(cond => ({ text: cond, tone: 'border-red-300 bg-red-50 text-red-800' })),
      ...(c.exhaustionLevel > 0 ? [{ text: `Exhaustion ${c.exhaustionLevel}`, tone: 'border-red-300 bg-red-50 text-red-800' }] : []),
      ...c.activePotions.map(p => ({ text: p.name, tone: 'border-violet-300 bg-violet-50 text-violet-800', title: p.effect })),
    ]
    return (
      <Link key={c.id} to={`/c/${c.id}`}
        className={`card flex flex-col gap-3 hover:shadow-md transition-shadow ${fallen ? 'opacity-60' : ''} ${down ? (stable ? 'ring-2 ring-green-300' : 'ring-2 ring-red-300') : ''}`}>
        <div className="flex items-center gap-3">
          {c.portrait ? (
            <img src={c.portrait} alt="" className="w-12 h-12 rounded-lg object-cover object-top border-2 border-parchment-300 shrink-0" />
          ) : (
            <span className="w-12 h-12 rounded-lg border-2 border-parchment-300 bg-parchment-100 flex items-center justify-center text-lg font-bold text-parchment-400 shrink-0">
              {c.name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]!.toUpperCase()).join('') || '?'}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h2 className="font-bold text-parchment-900 truncate">{c.name}</h2>
              {c.inspiration && <span className="w-2.5 h-2.5 rotate-45 bg-amber-400 border border-amber-500 shrink-0" title="Inspired" />}
            </div>
            <p className="text-xs text-parchment-600 truncate" title={classLine(c)}>Level {totalLevel(c)} · {classLine(c)}</p>
          </div>
        </div>

        {/* Hit points, or the death saves at 0 */}
        <div>
          <div className="flex items-baseline justify-between mb-1">
            {fallen ? (
              <span className="text-xs font-bold uppercase tracking-widest text-parchment-500">Fallen</span>
            ) : down ? (
              <span className="flex items-center gap-2 text-xs">
                <span className={`font-bold uppercase tracking-widest ${stable ? 'text-green-700' : 'text-red-600'}`}>{stable ? 'Stable' : 'Down'}</span>
                <span className="flex gap-0.5" title={`Death save successes: ${c.deathSaves.successes}`}>
                  {[0, 1, 2].map(i => <span key={i} className={`w-2 h-2 rounded-full border ${i < c.deathSaves.successes ? 'bg-green-500 border-green-500' : 'border-green-400'}`} />)}
                </span>
                <span className="flex gap-0.5" title={`Death save failures: ${c.deathSaves.failures}`}>
                  {[0, 1, 2].map(i => <span key={i} className={`w-2 h-2 rounded-full border ${i < c.deathSaves.failures ? 'bg-red-500 border-red-500' : 'border-red-400'}`} />)}
                </span>
              </span>
            ) : (
              <span className="tabular-nums">
                <span className="text-[10px] uppercase tracking-wide text-parchment-500 mr-1">HP</span>
                <span className="text-2xl font-bold text-parchment-900">{c.hp.current}</span>
                <span className="text-parchment-500"> / {v.maxHp}</span>
                {c.hp.temp > 0 && <span className="ml-1.5 text-sm font-semibold text-blue-600" title="Temporary hit points">+{c.hp.temp}</span>}
              </span>
            )}
          </div>
          <div className="h-1.5 bg-parchment-200 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${fallen ? 'bg-parchment-400' : down ? (stable ? 'bg-green-400' : 'bg-red-500 animate-pulse') : pct > 50 ? 'bg-green-500' : pct > 25 ? 'bg-amber-400' : 'bg-red-500'}`}
              style={{ width: `${down || fallen ? 100 : pct}%` }} />
          </div>
        </div>

        {/* The numbers a DM asks for */}
        <div className="grid grid-cols-5 gap-1 text-center">
          {[
            { label: 'AC', value: v.ac, title: v.acSource },
            { label: 'Perc.', value: v.passivePerception, title: 'Passive Perception' },
            { label: 'Insight', value: v.passiveInsight, title: 'Passive Insight' },
            { label: 'Invest.', value: v.passiveInvestigation, title: 'Passive Investigation' },
            { label: 'Spell DC', value: v.spellSaveDC ?? '—', title: v.spellSaveDC ? 'Spell save DC' : 'No spellcasting' },
          ].map(s => (
            <div key={s.label} className="rounded border border-parchment-200 bg-parchment-50 py-1" title={s.title}>
              <div className="text-[9px] uppercase tracking-wide text-parchment-500 leading-tight">{s.label}</div>
              <div className="text-lg font-bold text-parchment-900 leading-tight tabular-nums">{s.value}</div>
            </div>
          ))}
        </div>

        {chips.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {chips.map(ch => (
              <span key={ch.text} title={ch.title} className={`text-[11px] font-semibold rounded-full border px-2 py-0.5 ${ch.tone}`}>{ch.text}</span>
            ))}
          </div>
        )}
      </Link>
    )
  }

  const ordered = (characters ?? []).slice().sort((a, b) => Number(isFallen(a)) - Number(isFallen(b)))
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-parchment-800">Party</h1>
        <p className="text-sm text-parchment-500 mt-1">Everyone at a glance. It updates every few seconds, so changes made on other devices show up here.</p>
      </div>
      {error && <div className="mb-4 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {characters === null ? (
        <div className="text-center py-20 text-parchment-400">Loading…</div>
      ) : characters.length === 0 ? (
        <div className="text-center py-20 text-parchment-500">No characters yet. <Link to="/new" className="underline">Create one</Link>.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">{ordered.map(card)}</div>
      )}
      <p className="text-[11px] text-parchment-500 mt-4">Rage, Bless and spells cast on a character show on that character’s own sheet.</p>
    </div>
  )
}
