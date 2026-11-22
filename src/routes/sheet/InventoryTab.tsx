import { Fragment } from 'react'
import { Summon } from '../../character/model'
import { abilityModFor, formatMod, spellAttackBonus } from '../../character/derive'
import { CLASS_OPTIONS, findInfusion } from '../../data/classData'
import { WeaponStatBlock, ArmorStatBlock, MagicItemStatBlock } from '../../components/ItemStatBlock'
import { type Coin, COIN_CP, normalizePurse, addValue, spendValue, formatPurse } from '../../character/currency'
import { RollingNumber } from '../../components/RollingNumber'
import { CoinEmblem, COIN_MARK, PouchIcon, ScaleIcon, QuillIcon } from '../../components/PurseIcons'
import type { ItemDef } from '../../content/loaders'
import { ABILITY_FULL, BodySlotKey, detectBodySlot, isArmorProficient, magicBonus, resolveArmor, resolveWeapon, weaponAttackBonus, weaponDamageMod } from './helpers'
import { useSheet } from './SheetContext'

/** The Inventory tab: coin purse, attunement, infusions, loadout and the item lists with the item card */
export function InventoryTab() {
  const {
    id,
    content,
    char,
    tab,
    setTab,
    addPanel,
    setAddPanel,
    addPanelSearch,
    setAddPanelSearch,
    expandedInventoryItem,
    setExpandedInventoryItem,
    inventorySearch,
    setInventorySearch,
    txAmount,
    setTxAmount,
    txCoin,
    setTxCoin,
    txNote,
    setTxNote,
    purseFloats,
    setPurseFloats,
    ledgerOpen,
    setLedgerOpen,
    askConfirm,
    infuseResistType,
    setInfuseResistType,
    drinkingIdx,
    setDrinkingIdx,
    drinkRoll,
    setDrinkRoll,
    drinkChoice,
    setDrinkChoice,
    drinkFailedSave,
    setDrinkFailedSave,
    save,
    findIndex,
    offerUndo,
    patch,
    level,
    pb,
    featArmor,
    artificerLevel,
    itemBonuses,
    potionWeaponMods,
    effectiveChar,
    maxHp,
    mediumDexCap,
    ac,
    initiative,
    speed,
    attuned,
    resistances,
  } = useSheet()
  return (
    <div>
      {/* Top row: Currency + Attunement */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
        {/* Coin purse — a merchant's ledger: gold-leaf rolling balance, coin buttons, wax-seal
            Gain/Spend and a transaction log. The balance is one total, shown in gold. */}
        {(() => {
          const METAL: Record<Coin, { name: string; light: string; mid: string; edge: string; ink: string }> = {
            cp: { name: 'Copper',   light: '#eaa36a', mid: '#b5642f', edge: '#6b3618', ink: '#4a2410' },
            sp: { name: 'Silver',   light: '#f1f3f5', mid: '#a9b0b7', edge: '#5f656c', ink: '#3b4046' },
            ep: { name: 'Electrum', light: '#f0eabd', mid: '#b8b183', edge: '#6f6942', ink: '#48442a' },
            gp: { name: 'Gold',     light: '#fbe08a', mid: '#d4a33a', edge: '#7d5512', ink: '#5c3d0c' },
            pp: { name: 'Platinum', light: '#f6f9fc', mid: '#b9c4d0', edge: '#66717f', ink: '#3d4550' },
          }
          const purse = normalizePurse(char.currency)  // older saves may still hold ep/pp
          const amount = parseInt(txAmount, 10)
          const cp = amount > 0 ? amount * COIN_CP[txCoin] : null
          const afterGain = cp !== null ? addValue(char.currency, cp) : null
          const afterSpend = cp !== null ? spendValue(char.currency, cp) : null
          const commit = (kind: 'gain' | 'spend') => {
            const next = kind === 'gain' ? afterGain : afterSpend
            if (!next) return
            const note = txNote.trim()
            const entry = { id: `${Date.now()}`, at: new Date().toISOString(), kind, coin: txCoin, amount, ...(note ? { note } : {}) }
            patch({ currency: next, purseLog: [entry, ...char.purseLog].slice(0, 30) })
            const floatId = Date.now() + Math.random()
            setPurseFloats(f => [...f, { id: floatId, text: `${kind === 'gain' ? '+' : '−'}${amount} ${txCoin}`, kind }])
            setTimeout(() => setPurseFloats(f => f.filter(x => x.id !== floatId)), 1300)
            setTxAmount(''); setTxNote('')
          }
          const timeAgo = (iso: string) => {
            const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
            if (mins < 1) return 'just now'
            if (mins < 60) return `${mins}m ago`
            if (mins < 1440) return `${Math.floor(mins / 60)}h ago`
            return `${Math.floor(mins / 1440)}d ago`
          }
          const change = [purse.sp ? `${purse.sp} sp` : '', purse.cp ? `${purse.cp} cp` : ''].filter(Boolean).join(' · ')
          const recent = char.purseLog.slice(0, 5)
          return (
          <div className={`card p-4 flex flex-col ${ledgerOpen ? '' : 'self-start'}`}>
            {/* Ornamental header */}
            <div className="flex items-center gap-2 mb-1">
              <span className="h-px flex-1 bg-gradient-to-r from-transparent to-parchment-300" />
              <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.25em] text-parchment-500">
                <PouchIcon className="w-4 h-4 text-amber-700" />Coin Purse
              </span>
              <span className="h-px flex-1 bg-gradient-to-l from-transparent to-parchment-300" />
            </div>

            {/* Balance — gold leaf, odometer digits; floating +/- labels */}
            <div className="relative flex flex-col items-center py-2">
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-bold"><RollingNumber value={purse.gp} digitClassName="gold-leaf gold-shimmer" /></span>
                {/* leading-none: the gold-leaf gradient repeats every 1em, so the box must be 1em tall.
                    --i places "gp" after the digits in the shimmer's sweep. */}
                <span className="text-xl font-bold leading-none gold-leaf gold-shimmer"
                  style={{ '--i': purse.gp.toLocaleString().length } as React.CSSProperties}>gp</span>
              </div>
              <div className="text-xs italic text-parchment-500 h-4">{change ? `and ${change}` : ''}</div>
              {purseFloats.map(f => (
                <span key={f.id}
                  className={`purse-float pointer-events-none absolute right-2 top-2 text-sm font-bold ${f.kind === 'gain' ? 'text-green-700' : 'text-red-700'}`}
                >{f.text}</span>
              ))}
            </div>

            {/* Coin choice — what the amount is counted in */}
            <div className="flex justify-center gap-2 mt-1" role="radiogroup" aria-label="Coin">
              {(['cp', 'sp', 'ep', 'gp', 'pp'] as Coin[]).map(coin => {
                const m = METAL[coin]
                const selected = txCoin === coin
                return (
                  <button key={coin} type="button" role="radio" aria-checked={selected} onClick={() => setTxCoin(coin)}
                    title={`${m.name}: struck with ${COIN_MARK[coin]}`}
                    className={`group flex flex-col items-center gap-0.5 transition-transform ${selected ? '-translate-y-1' : ''}`}>
                    <span key={selected ? `on-${coin}` : coin}
                      className={`w-9 h-9 rounded-full flex items-center justify-center transition-opacity ${selected ? 'coin-flip' : 'opacity-70 group-hover:opacity-100'}`}
                      style={{
                        background: `radial-gradient(circle at 36% 30%, ${m.light}, ${m.mid} 58%, ${m.edge})`,
                        color: m.ink,
                        boxShadow: selected
                          ? `0 0 0 2px rgb(var(--accent)), 0 3px 8px rgba(0,0,0,0.35), inset 0 0 0 2px rgba(255,255,255,0.3)`
                          : `0 1px 3px rgba(0,0,0,0.3), inset 0 0 0 2px rgba(255,255,255,0.25)`,
                      }}><CoinEmblem coin={coin} className="coin-emblem w-5 h-5 opacity-80" /></span>
                    <span className={`text-[10px] uppercase tracking-wide ${selected ? 'font-bold text-parchment-800' : 'text-parchment-700'}`}>{m.name}</span>
                  </button>
                )
              })}
            </div>

            {/* Amount + optional note */}
            <div className="flex gap-1.5 mt-3">
              <input type="number" min={1} placeholder="Amount"
                className="input-coin w-28 text-base font-semibold"
                value={txAmount}
                onChange={e => setTxAmount(e.target.value)} />
              <input type="text" placeholder="Note (optional), e.g. sold the goblin's dagger"
                className="input-coin flex-1 min-w-0 text-left px-2 italic"
                value={txNote}
                onChange={e => setTxNote(e.target.value)} />
            </div>

            {/* Wax-seal Gain / Spend */}
            <div className="flex justify-center gap-10 mt-3">
              {(['gain', 'spend'] as const).map(kind => {
                const after = kind === 'gain' ? afterGain : afterSpend
                return (
                  <div key={kind} className="flex flex-col items-center gap-1 w-24">
                    <button type="button" disabled={!after} onClick={() => commit(kind)}
                      title={kind === 'gain' ? 'Add to your purse' : 'Pay from your purse (makes change automatically)'}
                      className={`wax-seal ${kind === 'gain' ? 'wax-seal-green' : 'wax-seal-red'} w-14 h-14 flex items-center justify-center disabled:opacity-35 disabled:cursor-not-allowed`}
                    >{kind === 'gain' ? <PouchIcon className="w-7 h-7" /> : <ScaleIcon className="w-7 h-7" />}</button>
                    <span className="text-xs font-bold uppercase tracking-wider text-parchment-700">{kind === 'gain' ? 'Gain' : 'Spend'}</span>
                    <span className="text-[10px] text-parchment-500 text-center leading-tight h-3">
                      {cp === null ? '' : after ? `→ ${formatPurse(after)}` : 'not enough'}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* The ledger — collapsible; shows the latest entry when closed. Open, its ruled page
                stretches to the bottom of the card. */}
            <div className="mt-3 pt-2 border-t border-parchment-200 flex-1 flex flex-col">
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setLedgerOpen(!ledgerOpen)} aria-expanded={ledgerOpen}
                  className="flex items-center gap-1.5 flex-1 min-w-0 text-left group">
                  <QuillIcon className="w-4 h-4 text-parchment-500 shrink-0" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-parchment-500 group-hover:text-parchment-800">Ledger</span>
                  {char.purseLog.length > 0 && (
                    <span className="text-[10px] rounded-full px-1.5 bg-parchment-100 text-parchment-500 font-semibold">{char.purseLog.length}</span>
                  )}
                  {!ledgerOpen && recent[0] && (
                    <span className="text-[11px] italic text-parchment-500 truncate">
                      last: {recent[0].kind === 'gain' ? '+' : '−'}{recent[0].amount} {recent[0].coin}{recent[0].note ? `, ${recent[0].note}` : ''}
                    </span>
                  )}
                  <span className={`ml-auto text-parchment-400 text-xs transition-transform ${ledgerOpen ? 'rotate-90' : ''}`}>▸</span>
                </button>
                {ledgerOpen && char.purseLog.length > 0 && (
                  <button type="button" className="text-[10px] text-parchment-400 hover:text-red-600 shrink-0"
                    onClick={async () => { if (await askConfirm({ title: 'Clear Ledger', message: 'Clear the purse ledger? Your balance stays the same.', confirmLabel: 'Clear', danger: true })) patch({ purseLog: [] }) }}
                  >clear</button>
                )}
              </div>
              {ledgerOpen && (
                <>
                  <div className="ledger-lines pl-2 mt-1 min-h-[44px] flex-1">
                    {recent.length === 0 ? (
                      <p className="text-xs italic text-parchment-400 leading-[22px]">No entries yet.</p>
                    ) : recent.map(e => {
                      const m = METAL[e.coin]
                      return (
                        <div key={e.id} className="flex items-center gap-2 text-xs leading-[22px] h-[22px]">
                          {/* a tiny coin in the entry's metal */}
                          <span className="w-3 h-3 rounded-full shrink-0"
                            style={{ background: `radial-gradient(circle at 36% 30%, ${m.light}, ${m.mid} 58%, ${m.edge})` }} />
                          <span className={`font-bold tabular-nums shrink-0 ${e.kind === 'gain' ? 'text-green-700' : 'text-red-700'}`}>
                            {e.kind === 'gain' ? '+' : '−'}{e.amount} {e.coin}
                          </span>
                          <span className="italic text-parchment-700 truncate flex-1">{e.note ?? (e.kind === 'gain' ? 'gained' : 'spent')}</span>
                          <span className="text-[10px] text-parchment-400 shrink-0">{timeAgo(e.at)}</span>
                        </div>
                      )
                    })}
                  </div>
                  {char.purseLog.length > recent.length && (
                    <p className="text-[10px] text-parchment-400 mt-1">+ {char.purseLog.length - recent.length} earlier</p>
                  )}
                </>
              )}
            </div>
          </div>
          )
        })()}

        {/* Right column: Attunement, then an artificer's Infusions */}
        <div className="space-y-3 self-start">
        {/* Attunement */}
        <div className="card p-3">
          <div className="text-xs font-bold text-parchment-500 uppercase tracking-wider mb-2">Attunement</div>
          <div className="flex items-center gap-3">
            <span className={`text-2xl font-bold ${attuned >= 3 ? 'text-red-600' : 'text-parchment-800'}`}>{attuned}</span>
            <span className="text-parchment-300 text-lg">/</span>
            <span className="text-2xl font-semibold text-parchment-400">3</span>
            {/* Rotated, the diamonds are wider than their boxes: gap-3 keeps the tips apart */}
            <div className="flex gap-3 ml-3">
              {[0,1,2].map(i => {
                const filled = i < attuned
                const full = attuned >= 3
                return (
                  <div
                    key={i}
                    className={`w-4 h-4 rotate-45 border-2 ${
                      filled
                        ? full ? 'attune-gem-full' : 'attune-gem'
                        : 'bg-parchment-200 border-parchment-300 opacity-40'
                    }`}
                    style={filled ? {
                      animation: `${full ? 'attune-full' : 'attune-pulse'} 3.5s ease-in-out infinite`,
                    } : {
                      transition: 'all 0.2s ease',
                    }}
                  />
                )
              })}
            </div>
          </div>
          {(() => {
            const attunedItems = char.equipment.filter(e => e.attuned)
            return attunedItems.length > 0 ? (
              <ul className="mt-2 space-y-0.5">
                {attunedItems.map((item, i) => (
                  <li key={i} className="text-xs text-indigo-700 flex items-center gap-1">
                    <span className="text-indigo-400">✦</span>{item.name}
                  </li>
                ))}
              </ul>
            ) : null
          })()}
          {attuned >= 3 && <p className="text-xs text-red-500 mt-1">Maximum reached</p>}
        </div>

        {/* Infusions (Artificer). Each known infusion goes in one of your items, makes the Homunculus
            Servant, or makes a replicated magic item; all of them count against the infused-item limit. */}
        {artificerLevel >= 2 && (() => {
          const artOpts = CLASS_OPTIONS.artificer
          const maxActive = artOpts.infusionsActiveAtLevel?.[artificerLevel - 1] ?? 0
          const knownMax = artOpts.infusionsKnownAtLevel?.[artificerLevel - 1] ?? 0
          const knownFC = char.featuresChosen.find(fc => fc.key === 'infusions')?.value
          const known = (Array.isArray(knownFC) ? knownFC : knownFC ? [knownFC] : [])
            .map(slug => findInfusion(slug))
            .filter((i): i is NonNullable<typeof i> => !!i)
          const homunculi = char.summons.filter(sm => sm.templateKey === 'homunculus-servant')
          const active = char.equipment.filter(e => e.infusion).length + homunculi.length
          const atMax = active >= maxActive
          const limitTitle = atMax ? `All ${maxActive} infusions are in use. End one first.` : undefined
          // Only nonmagical items take an infusion
          const isMagic = (e: typeof char.equipment[number]) => {
            if (/\+\d\b/.test(e.name)) return true
            const def = content.items.find(i => i.slug === e.itemSlug)
            if (!def?.rarity) return false
            // A homebrew mundane weapon or armor (a Pistol) can still carry a "Common" rarity
            return !(def.rarity.toLowerCase() === 'common' && (def.weaponStats || def.armorStats))
          }
          // Whether an item is the kind an infusion goes on ("A suit of armor", "A simple or martial weapon", …)
          const fits = (e: typeof char.equipment[number], type = '') => {
            const t = type.toLowerCase(), n = e.name.toLowerCase()
            const ws = resolveWeapon(e, content.items), as_ = resolveArmor(e, content.items)
            if (t.includes('ammunition')) return !!ws?.ranged
            if (t.includes('thrown')) return !!ws && !ws.ranged
            if (t.includes('weapon')) return !!ws
            if (t.includes('armor or a shield')) return !!as_
            if (t.includes('armor or robes')) return (!!as_ && as_.type !== 'shield') || /\brobes?\b/.test(n)
            if (t.includes('suit of armor')) return !!as_ && as_.type !== 'shield'
            if (t.includes('shield')) return as_?.type === 'shield'
            if (t.includes('rod, staff, or wand')) return /\b(rod|staff|quarterstaff|wand)\b/.test(n)
            if (t.includes('ring')) return /\bring\b/.test(n)
            if (t.includes('helmet')) return /\b(helm|helmet|hat|cap|circlet)\b/.test(n)
            if (t.includes('boots')) return /\bboots\b/.test(n)
            return true
          }
          const holderIndex = (slug: string) => char.equipment.findIndex(e => findInfusion(e.infusion)?.slug === slug)
          const infuse = (idx: number, inf: typeof known[number], choice?: string) => patch({
            equipment: char.equipment.map((e, i) => i !== idx ? e : {
              ...e,
              infusion: choice ? `${inf.slug}@${choice}` : inf.slug,
              ...(inf.charges ? { charges: inf.charges, chargesMax: inf.charges, rechargesOnLongRest: true } : {}),
            }),
          })
          const endInfusion = (idx: number, inf: typeof known[number]) => {
            // A replica was made by the infusion, so it goes with it
            if (inf.kind === 'replicate') { patch({ equipment: char.equipment.filter((_, i) => i !== idx) }); return }
            patch({
              equipment: char.equipment.map((e, i) => {
                if (i !== idx) return e
                // Ending an infusion ends the attunement and charges it brought (a magic item keeps its own)
                const ownAttunement = !!content.items.find(d => d.slug === e.itemSlug)?.attunement
                return {
                  ...e, infusion: undefined, attuned: ownAttunement ? e.attuned : false,
                  ...(inf.charges ? { charges: undefined, chargesMax: undefined, rechargesOnLongRest: undefined } : {}),
                }
              }),
            })
          }
          const makeReplica = (inf: typeof known[number]) => {
            const def = content.items.find(i => i.slug === inf.replicates)
            patch({ equipment: [...char.equipment, {
              itemSlug: inf.replicates!, name: def?.name ?? inf.name.replace('Replicate: ', ''), quantity: 1,
              equipped: false, attuned: false, isHomebrew: false, notes: '', infusion: inf.slug,
            }] })
          }
          // Homunculus Servant (TCoE p.21): Tiny construct, HP 1 + INT mod + artificer level
          const makeHomunculus = () => {
            const hp = 1 + abilityModFor(effectiveChar, 'int') + artificerLevel
            const homunculus: Summon = {
              id: Math.random().toString(36).slice(2, 10), name: 'Homunculus Servant', templateKey: 'homunculus-servant',
              hp: { current: hp, max: hp }, ac: 13, speed: 20,
              saveProficiencies: ['dex'], immunities: ['poison'], resistances: [],
              attacks: [{ name: 'Force Strike', toHit: spellAttackBonus(effectiveChar, 'artificer', content) + itemBonuses.spellAttackBonus,
                damage: `1d4+${pb}`, damageType: 'force', range: '30 ft', notes: 'Ranged weapon attack, one target it can see' }],
              abilities: [
                { name: 'Flight', description: 'Fly speed 30 ft.' },
                { name: 'Evasion', description: 'On a DEX save for half damage it takes none on a success and half on a failure.' },
                { name: 'Channel Magic', description: 'Reaction: deliver a spell you cast with a range of touch, while it is within 120 ft of you.' },
              ],
              notes: 'Immune to poison damage and to the exhausted and poisoned conditions. Darkvision 60 ft. Acts on your initiative; it takes the Dodge action unless you use a bonus action to command it.',
            }
            patch({ summons: [...char.summons, homunculus] })
          }
          const attuneToggle = (idx: number) => {
            const item = char.equipment[idx]
            return (
              <button type="button" disabled={!item.attuned && attuned >= 3}
                onClick={() => { const eq = [...char.equipment]; eq[idx] = { ...item, attuned: !item.attuned }; patch({ equipment: eq }) }}
                title={!item.attuned && attuned >= 3 ? 'All three attunement slots are in use' : undefined}
                className={`px-2 py-0.5 rounded border text-[11px] font-semibold transition-colors disabled:opacity-40 ${item.attuned ? 'bg-indigo-600 text-white border-indigo-600' : 'border-parchment-300 text-parchment-600 hover:border-indigo-400'}`}
              >{item.attuned ? '✦ Attuned' : '✦ Attune'}</button>
            )
          }
          const endButton = (onClick: () => void, title?: string) => (
            <button type="button" onClick={onClick} title={title}
              className="px-2 py-0.5 rounded border border-parchment-200 text-[11px] text-parchment-500 hover:text-red-600 hover:border-red-300 transition-colors"
            >End</button>
          )
          const makeButton = (label: string, onClick: () => void) => (
            <button type="button" onClick={onClick} disabled={atMax} title={limitTitle}
              className="mt-1 px-2.5 py-1 rounded border border-teal-300 bg-teal-50 text-xs font-semibold text-teal-700 hover:bg-teal-100 transition-colors disabled:opacity-40"
            >{label}</button>
          )
          return (
            <div className="card p-3">
              <div className="text-xs font-bold text-parchment-500 uppercase tracking-wider mb-2">Infusions</div>
              <div className="flex items-center gap-3">
                <span className={`text-2xl font-bold ${atMax ? 'text-teal-700' : 'text-parchment-800'}`}>{active}</span>
                <span className="text-parchment-300 text-lg">/</span>
                <span className="text-2xl font-semibold text-parchment-400">{maxActive}</span>
                <div className="flex gap-3 ml-3">
                  {Array.from({ length: maxActive }, (_, i) => (
                    <div key={i}
                      className={`w-4 h-4 rotate-45 border-2 ${i < active ? 'infuse-gem' : 'bg-parchment-200 border-parchment-300 opacity-40'}`}
                      style={i < active ? { animation: 'infuse-pulse 3.5s ease-in-out infinite', animationDelay: `${i * 0.3}s` } : { transition: 'all 0.2s ease' }}
                    />
                  ))}
                </div>
                <span className="ml-auto text-[11px] text-parchment-400" title="Infusions known / allowed at your level">Known {known.length}/{knownMax}</span>
              </div>
              {known.length === 0 ? (
                <p className="text-xs text-parchment-400 mt-2">No infusions chosen yet. Pick them when you level up.</p>
              ) : (
                <ul className="mt-2 divide-y divide-parchment-100">
                  {known.map(inf => {
                    const plus = inf.bonusAt10 && artificerLevel >= 10 ? 2 : 1
                    const bonusText = inf.bonus === 'item' ? ` · +${plus}` : inf.bonus === 'spellAttack' ? ` · +${plus} spell attacks` : ''
                    const holderIdx = inf.kind === 'creature' ? -1 : holderIndex(inf.slug)
                    const holder = holderIdx >= 0 ? char.equipment[holderIdx] : undefined
                    const isActive = inf.kind === 'creature' ? homunculi.length > 0 : !!holder
                    const needsAttunement = inf.attunement || (inf.kind === 'replicate' && !!content.items.find(i => i.slug === inf.replicates)?.attunement)
                    let body: React.ReactNode
                    if (inf.kind === 'creature') {
                      const h = homunculi[0]
                      body = h ? (
                        <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-medium text-teal-700">Active · {h.hp.current}/{h.hp.max} HP</span>
                          <button type="button" onClick={() => setTab('summons')}
                            className="px-2 py-0.5 rounded border border-parchment-200 text-[11px] text-parchment-600 hover:border-parchment-400 transition-colors"
                          >Summons →</button>
                          {endButton(() => patch({ summons: char.summons.filter(sm => sm.templateKey !== 'homunculus-servant') }), 'The homunculus is gone')}
                        </div>
                      ) : makeButton('Create Homunculus', makeHomunculus)
                    } else if (inf.kind === 'replicate') {
                      body = holder ? (
                        <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-medium text-teal-700">In your inventory</span>
                          {needsAttunement && attuneToggle(holderIdx)}
                          {endButton(() => endInfusion(holderIdx, inf), 'Ends the infusion: the replica is removed from your inventory')}
                        </div>
                      ) : makeButton(`Make ${inf.name.replace('Replicate: ', '')}`, () => makeReplica(inf))
                    } else if (holder) {
                      const choice = holder.infusion?.split('@')[1]
                      body = (
                        <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-medium text-teal-700">in {holder.name}{choice ? ` · ${choice} resistance` : ''}</span>
                          {needsAttunement && attuneToggle(holderIdx)}
                          {endButton(() => endInfusion(holderIdx, inf))}
                        </div>
                      )
                    } else {
                      const candidates = char.equipment.map((e, i) => ({ e, i })).filter(({ e }) => !e.infusion && !isMagic(e))
                      const suitable = candidates.filter(({ e }) => fits(e, inf.itemType))
                      const other = candidates.filter(({ e }) => !fits(e, inf.itemType))
                      body = (
                        <div className="mt-1 flex gap-1.5">
                          {inf.damageTypes && (
                            <select className="input text-xs py-1 w-28 shrink-0" value={infuseResistType} disabled={atMax}
                              aria-label="Resistance" onChange={e => setInfuseResistType(e.target.value)}>
                              {inf.damageTypes.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                          )}
                          <select className="input text-xs py-1" value="" disabled={atMax} title={limitTitle}
                            onChange={e => { if (e.target.value !== '') infuse(Number(e.target.value), inf, inf.damageTypes ? infuseResistType : undefined) }}>
                            <option value="">{atMax ? '— at the infusion limit —' : '— infuse an item —'}</option>
                            {suitable.length > 0 && (
                              <optgroup label="Suitable">
                                {suitable.map(({ e, i }) => <option key={i} value={i}>{e.name}</option>)}
                              </optgroup>
                            )}
                            {other.length > 0 && (
                              <optgroup label="Other items">
                                {other.map(({ e, i }) => <option key={i} value={i}>{e.name}</option>)}
                              </optgroup>
                            )}
                          </select>
                        </div>
                      )
                    }
                    return (
                      <li key={inf.slug} className="flex items-start gap-2.5 py-2">
                        <div className={`mt-1.5 w-2.5 h-2.5 rotate-45 border shrink-0 ${isActive ? 'infuse-gem' : 'bg-parchment-200 border-parchment-300 opacity-50'}`} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-parchment-800 leading-tight">
                            {inf.name}
                            {needsAttunement && <span className="text-indigo-400 ml-1" title="Requires attunement">✦</span>}
                          </div>
                          <div className="text-[11px] text-parchment-500" title={inf.description}>
                            {inf.itemType}{bonusText}{inf.charges ? ` · ${inf.charges === 1 ? 'once per dawn' : `${inf.charges} charges`}` : ''}
                          </div>
                          {body}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )
        })()}
        </div>{/* end right column */}


      </div>{/* end top row grid */}

      {/* ── Equipment Sections ── */}
      {(() => {
        // Common items list for Other section
        const COMMON_GEAR: { cat: string; items: string[] }[] = [
          { cat: 'Adventuring', items: ['Backpack','Bedroll','Blanket','Candle','Chalk','Crowbar','Grappling Hook','Hammer','Hooded Lantern','Oil (flask)','Rations (1 day)','Rope, hempen (50ft)','Rope, silk (50ft)','Sack','Shovel','Signal Whistle','Soap','Tinderbox','Torch','Waterskin','Whetstone'] },
          { cat: 'Tools', items: ["Thieves' Tools","Healer's Kit","Herbalism Kit","Disguise Kit","Poisoner's Kit","Navigator's Tools"] },
          { cat: 'General', items: ['Pouch','Vial','Mirror (steel)','Spyglass','Magnifying Glass','Spellbook','Book','Ink & Pen','Parchment','Sealing Wax'] },
          { cat: 'Consumables', items: ['Antitoxin','Acid (vial)',"Alchemist's Fire",'Holy Water (flask)','Smoke Bomb','Thunderstone'] },
        ]

        // Mundane consumables (gear). Potions carry their own `potion` data on the item def.
        const CONSUMABLE_DATA: Record<string, { badge: string; badgeColor: string; text: string }> = {
          'Antitoxin':                   { badge: 'vs Poison',   badgeColor: 'bg-green-100 text-green-700',  text: 'Advantage on saving throws against poison for 1 hour. Not magical — works even inside an antimagic field.' },
          'Acid (vial)':                 { badge: '2d6 acid',    badgeColor: 'bg-yellow-100 text-yellow-700',text: 'Action: throw up to 20 ft. On hit, 2d6 acid damage. Treat as improvised weapon.' },
          "Alchemist's Fire":            { badge: '1d4 fire/rnd',badgeColor: 'bg-orange-100 text-orange-700',text: 'Action: throw up to 20 ft. On hit, 1d4 fire damage at the start of each of the target\'s turns until extinguished. DC 10 Dexterity (action) to put out.' },
          'Holy Water (flask)':          { badge: '2d6 radiant', badgeColor: 'bg-yellow-50 text-yellow-700', text: 'Action: throw up to 20 ft. On hit, 2d6 radiant damage to fiends and undead only.' },
          'Smoke Bomb':                  { badge: '20 ft cloud', badgeColor: 'bg-slate-100 text-slate-600',  text: 'Action: throw up to 20 ft. Creates a 20-foot-radius sphere of opaque smoke for 1 minute. Heavily obscured. A strong wind disperses it.' },
          'Thunderstone':                { badge: '2d6 thunder', badgeColor: 'bg-indigo-100 text-indigo-700',text: 'Action: throw up to 20/60 ft. On hit, 2d6 thunder damage and target is deafened until end of its next turn (DC 13 Constitution save negates deafen).' },
        }

        // Classify items into D&D 5e type categories
        type ItemCat = 'armor' | 'potion' | 'ring' | 'rod' | 'scroll' | 'staff' | 'wand' | 'weapon' | 'wondrous' | 'gear'
        const catOf = (item: typeof char.equipment[0]): ItemCat => {
          if (resolveWeapon(item, content.items)) return 'weapon'
          if (resolveArmor(item, content.items)) return 'armor'
          const def = content.items.find(i => i.slug === item.itemSlug && i.name)
          if (!def) return 'gear'
          if (def.type === 'Potion') return 'potion'
          if (def.type === 'Ring') return 'ring'
          const n = item.name.toLowerCase()
          if (/^rod\b/.test(n)) return 'rod'
          if (/^scroll\b/.test(n)) return 'scroll'
          if (/^staff\b/.test(n)) return 'staff'
          if (/^wand\b/.test(n)) return 'wand'
          return 'wondrous'
        }
        const CAT_KEYS: ItemCat[] = ['armor','potion','ring','rod','scroll','staff','wand','weapon','wondrous','gear']
        const grouped = Object.fromEntries(CAT_KEYS.map(c => [c, [] as {item: typeof char.equipment[0]; idx: number}[]])) as Record<ItemCat, {item: typeof char.equipment[0]; idx: number}[]>
        char.equipment.forEach((item, idx) => grouped[catOf(item)].push({ item, idx }))
        const weapons = grouped.weapon.map(({ item, idx }) => ({ item, idx, ws: resolveWeapon(item, content.items)! }))
        const armors  = grouped.armor.map(({ item, idx }) => ({ item, idx, as_: resolveArmor(item, content.items)! }))

        // Armor enforcement: only one armor piece at a time (not shields)
        const equipArmor = (idx: number) => {
          const eq = char.equipment.map((item, i) => {
            const as_ = resolveArmor(item, content.items)
            if (i === idx) return { ...item, equipped: true }
            // Unequip other non-shield armors
            if (as_ && as_.type !== 'shield') return { ...item, equipped: false }
            return item
          })
          patch({ equipment: eq })
        }

        // Slot-aware weapon / shield equip
        const implementHandedness = (item: typeof char.equipment[0]): '1h' | '2h' | null => {
          const n = item.name.toLowerCase()
          if (/^staff\b/.test(n)) return '2h'
          if (/^rod\b/.test(n) || /^wand\b/.test(n)) return '1h'
          return null
        }

        const equipWeapon = (idx: number, slot: 'main' | 'off') => {
          const clickedWs = resolveWeapon(char.equipment[idx], content.items)
          const current = char.equipment[idx]
          const isTwoHanded = clickedWs?.twoHanded ?? false
          const isLight = clickedWs?.light ?? false
          const currentSlot = current.slot
          const canDual = isLight && !isTwoHanded && current.quantity >= 2
          const actualSlot: 'main' | 'off' | 'both' | 'dual' = isTwoHanded ? 'both'
            : canDual && current.equipped && ((slot === 'off' && currentSlot === 'main') || (slot === 'main' && currentSlot === 'off')) ? 'dual'
            : slot
          const eq = char.equipment.map((item, i) => {
            if (i === idx) return { ...item, equipped: true, slot: actualSlot }
            const ws = resolveWeapon(item, content.items)
            const as_ = resolveArmor(item, content.items)
            const ih = implementHandedness(item)
            if (!item.equipped || (!ws && as_?.type !== 'shield' && ih === null)) return item
            const iSlot = item.slot
            if (actualSlot === 'both' || actualSlot === 'dual') return { ...item, equipped: false, slot: undefined }
            if (actualSlot === 'main' && (iSlot === 'main' || iSlot === 'both' || iSlot === 'dual' || (!iSlot && !!ws))) return { ...item, equipped: false, slot: undefined }
            if (actualSlot === 'off' && (iSlot === 'off' || iSlot === 'both' || iSlot === 'dual' || (as_?.type === 'shield' && !iSlot))) return { ...item, equipped: false, slot: undefined }
            return item
          })
          patch({ equipment: eq })
        }

        const equipImplement = (idx: number, slot: 'main' | 'off') => {
          const isTwoHanded = implementHandedness(char.equipment[idx]) === '2h'
          const actualSlot: 'main' | 'off' | 'both' = isTwoHanded ? 'both' : slot
          const eq = char.equipment.map((item, i) => {
            if (i === idx) return { ...item, equipped: true, slot: actualSlot }
            if (!item.equipped) return item
            const ws = resolveWeapon(item, content.items)
            const as_ = resolveArmor(item, content.items)
            const ih = implementHandedness(item)
            if (!ws && as_?.type !== 'shield' && ih === null) return item
            const iSlot = item.slot
            if (actualSlot === 'both') return { ...item, equipped: false, slot: undefined }
            if (actualSlot === 'main' && (iSlot === 'main' || iSlot === 'both' || iSlot === 'dual' || (!iSlot && !!ws))) return { ...item, equipped: false, slot: undefined }
            if (actualSlot === 'off' && (iSlot === 'off' || iSlot === 'both' || iSlot === 'dual' || (as_?.type === 'shield' && !iSlot))) return { ...item, equipped: false, slot: undefined }
            return item
          })
          patch({ equipment: eq })
        }

        // The open item's card; itemRow fills it in while the lists render, and the side panel shows it
        let selectedItemCard: React.ReactNode = null
        const itemRow = ({ item, idx, badge, badgeColor, descriptionText, showAttune, consumable, potion }: {
          item: typeof char.equipment[0]; idx: number; badge?: string | null; badgeColor?: string; descriptionText?: string | null; showAttune?: boolean; consumable?: boolean
          potion?: ItemDef['potion']
        }) => {
          const isExpanded = expandedInventoryItem === idx
          const def = content.items.find(i => i.slug === item.itemSlug)
          const rarity = def?.rarity?.toLowerCase() ?? ''
          const infusionDef = findInfusion(item.infusion)
          const needsAttunement = showAttune || item.attuned || !!infusionDef?.attunement
          const ws = resolveWeapon(item, content.items)
          const as_ = resolveArmor(item, content.items)
          const isArmorPiece = !!as_ && as_.type !== 'shield'
          const isWeaponOrShield = !!ws || as_?.type === 'shield'

          const rarityAccent =
            rarity === 'uncommon'  ? 'border-l-green-400'  :
            rarity === 'rare'      ? 'border-l-blue-400'   :
            rarity === 'very rare' ? 'border-l-violet-500' :
            rarity === 'legendary' ? 'border-l-amber-500'  :
            rarity === 'artifact'  ? 'border-l-orange-500' : 'border-l-transparent'
          const rarityTextClass =
            rarity === 'uncommon'  ? 'text-green-600'  :
            rarity === 'rare'      ? 'text-blue-600'   :
            rarity === 'very rare' ? 'text-violet-600' :
            rarity === 'legendary' ? 'text-amber-600'  :
            rarity === 'artifact'  ? 'text-orange-600' : ''

          const unequipItem = () => { const eq=[...char.equipment]; eq[idx]={...eq[idx],equipped:false,slot:undefined}; patch({equipment:eq}) }

          const handleEquip = () => {
            if (item.equipped) {
              unequipItem()
            } else if (isArmorPiece) {
              equipArmor(idx)
            } else {
              const eq = [...char.equipment]; eq[idx] = { ...eq[idx], equipped: !item.equipped }; patch({ equipment: eq })
            }
          }

          // Potions: drinking uses one up; healing potions also take the HP the player rolled.
          const equipmentAfterDrink = () => item.quantity <= 1
            ? char.equipment.filter((_, i) => i !== idx)
            : char.equipment.map((e, i) => i === idx ? { ...e, quantity: e.quantity - 1 } : e)
          const resetDrink = () => { setDrinkingIdx(null); setDrinkRoll(''); setDrinkChoice(''); setDrinkFailedSave(false) }
          const poison = potion?.onDrink?.damage
          // Weapons Oil of Sharpness can coat: slashing or piercing ones you carry
          const coatable = potion?.choice?.kind === 'weapon'
            ? [...new Set(char.equipment.filter(e => ['slashing', 'piercing'].includes(resolveWeapon(e, content.items)?.damageType ?? '')).map(e => e.name))]
            : []
          const choiceOptions = potion?.choice?.kind === 'weapon' ? coatable : (potion?.choice?.options ?? [])
          // Drinking needs input first when there's a roll to enter or a choice to make
          const needsInput = !!(potion?.healing || poison || potion?.choice)
          const roll = parseInt(drinkRoll, 10)
          const inputReady = (!(potion?.healing || poison) || roll > 0) && (!potion?.choice || !!drinkChoice)

          const finishDrink = () => {
            if (!potion) return
            offerUndo(`Drank ${item.name}`)
            if (item.quantity <= 1) setExpandedInventoryItem(null)
            resetDrink()
            let hp = { ...char.hp }
            let conditions = [...char.conditions]
            let exhaustionLevel = char.exhaustionLevel
            if (potion.healing && roll > 0) hp.current = Math.min(maxHp, Math.max(0, hp.current) + roll)
            if (poison && roll > 0) {
              // Damage comes off temporary HP first
              const fromTemp = Math.min(hp.temp, roll)
              hp = { ...hp, temp: hp.temp - fromTemp, current: Math.max(0, hp.current - (roll - fromTemp)) }
            }
            if (potion.onDrink?.removeConditions) conditions = conditions.filter(c => !potion.onDrink!.removeConditions!.includes(c))
            if (potion.onDrink?.clearExhaustion) exhaustionLevel = 0
            // Temp HP don't stack — keep the higher (Heroism); Giant Size doubles current HP with the max
            if (potion.tempHp) hp.temp = Math.max(hp.temp, potion.tempHp)
            if (potion.hpMaxMultiplier && hp.current > 0) hp.current *= potion.hpMaxMultiplier
            // Conditions the potion gives you while it lasts (Invisible; Poisoned on a failed save)
            const poisoned = !!(poison && drinkFailedSave)
            const gives = [...(potion.conditions ?? []), ...(poisoned && poison!.failCondition ? [poison!.failCondition] : [])]
            const added = gives.filter(c => !conditions.includes(c))
            conditions = [...conditions, ...added]
            // Lasting effects go into the Active Potions box (a failed Poison save lasts until it wears off)
            const d = potion.duration ?? (poisoned && poison!.ongoingDice ? { label: 'until the poison wears off', minutes: 60 } : undefined)
            const started = d ? [{
              id: `${item.itemSlug}-${Date.now()}`, itemSlug: item.itemSlug, name: item.name, effect: potion.effect,
              duration: d.label, minutes: d.minutes,
              ...(potion.duration && d.minutes <= 10 ? { roundsLeft: d.minutes * 10 } : {}),
              ...(potion.uses ? { usesLeft: potion.uses } : poisoned && poison!.ongoingDice ? { usesLeft: poison!.ongoingDice } : {}),
              ...(drinkChoice ? { choice: drinkChoice } : {}),
              ...(added.length ? { addedConditions: added } : {}),
            }] : []
            patch({
              hp, conditions, exhaustionLevel,
              equipment: equipmentAfterDrink(),
              ...(started.length ? { activePotions: [...char.activePotions, ...started] } : {}),
            })
          }
          const qtyLabel = item.quantity > 1 ? `(${item.quantity} left)` : '(last one)'
          const drinkControls = !potion ? null : drinkingIdx === idx && needsInput ? (
            <div className="flex flex-col gap-1.5 w-full p-2 rounded border border-rose-200 bg-rose-50">
              {(potion.healing || poison) && (
                <label className="flex items-center gap-1.5 flex-wrap text-xs text-parchment-700">
                  {potion.healing
                    ? <>Roll <strong>{potion.healing}</strong>, HP regained:</>
                    : <>Roll <strong>{poison!.dice}</strong> {poison!.type} damage you take:</>}
                  <input type="number" min={1} autoFocus className="input-coin w-16" value={drinkRoll}
                    onChange={e => setDrinkRoll(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && inputReady) finishDrink(); if (e.key === 'Escape') resetDrink() }} />
                </label>
              )}
              {poison && (
                <label className="flex items-center gap-1.5 text-xs text-parchment-700 cursor-pointer">
                  <input type="checkbox" checked={drinkFailedSave} onChange={e => setDrinkFailedSave(e.target.checked)} />
                  Failed the DC {poison.save.dc} {ABILITY_FULL[poison.save.ability]} save{poison.failCondition ? ` (${poison.failCondition.toLowerCase()})` : ''}
                </label>
              )}
              {potion.choice && (
                <label className="flex items-center gap-1.5 flex-wrap text-xs text-parchment-700">
                  {potion.choice.label}
                  {choiceOptions.length ? (
                    <select className="input py-0.5 w-auto text-xs" value={drinkChoice} onChange={e => setDrinkChoice(e.target.value)} autoFocus={!potion.healing && !poison}>
                      <option value="">Choose…</option>
                      {choiceOptions.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <span className="text-red-600">You have no slashing or piercing weapon to coat.</span>
                  )}
                </label>
              )}
              <div className="flex items-center gap-2">
                <button type="button" disabled={!inputReady} onClick={finishDrink}
                  className="px-2.5 py-1 rounded border text-xs font-semibold transition-colors bg-rose-600 text-white border-rose-600 hover:bg-rose-700 disabled:opacity-40"
                >{potion.healing ? 'Heal' : 'Drink'}</button>
                <button type="button" className="text-xs text-parchment-400 hover:text-parchment-700" onClick={resetDrink}>Cancel</button>
              </div>
            </div>
          ) : (
            <button type="button"
              onClick={() => needsInput ? (resetDrink(), setDrinkingIdx(idx)) : finishDrink()}
              className="px-2.5 py-1 rounded border text-xs font-semibold transition-colors bg-rose-600 text-white border-rose-600 hover:bg-rose-700"
            >Drink {qtyLabel}</button>
          )

          // The open item as a card, its header washed with the rarity's colour
          const card = !isExpanded ? null : (() => {
            const hex = ({ uncommon: '#22c55e', rare: '#3b82f6', 'very rare': '#8b5cf6', legendary: '#f59e0b', artifact: '#f97316' } as Record<string, string>)[rarity] ?? '#b08d57'
            const kind = def?.type || (ws ? 'Weapon' : as_ ? (as_.type === 'shield' ? 'Shield' : 'Armor') : 'Gear')
            return (
              <article key={`card-${idx}`} className="spell-card-in rounded-xl border bg-parchment-50 shadow-sm overflow-hidden" style={{ borderColor: `${hex}88` }}>
                <header className="px-4 pt-4 pb-3" style={{ background: `linear-gradient(135deg, ${hex}38, ${hex}10 55%, transparent 85%)` }}>
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xl font-bold text-parchment-900 leading-tight">{item.name}</h3>
                      <p className="text-xs italic text-parchment-600 mt-0.5 first-letter:uppercase">
                        {[rarity || null, kind.toLowerCase()].filter(Boolean).join(' ')}{needsAttunement ? ' · requires attunement' : ''}
                      </p>
                    </div>
                    <button type="button" onClick={() => setExpandedInventoryItem(null)} aria-label="Close" title="Close"
                      className="w-7 h-7 -mr-1 -mt-1 rounded-full text-sm text-parchment-500 hover:bg-parchment-100 hover:text-parchment-900 shrink-0">✕</button>
                  </div>
                  {(item.equipped || item.attuned || infusionDef || item.quantity > 1) && (
                    <div className="flex flex-wrap gap-1 mt-2.5">
                      {item.equipped && <span className="text-[11px] font-semibold rounded-full px-2 py-0.5 border bg-green-50 border-green-300 text-green-700">● Equipped</span>}
                      {item.attuned && <span className="text-[11px] font-semibold rounded-full px-2 py-0.5 border bg-indigo-50 border-indigo-300 text-indigo-700">✦ Attuned</span>}
                      {infusionDef && <span className="text-[11px] font-semibold rounded-full px-2 py-0.5 border bg-teal-50 border-teal-200 text-teal-700">⟡ {infusionDef.name}</span>}
                      {item.quantity > 1 && <span className="text-[11px] font-semibold rounded-full px-2 py-0.5 border bg-parchment-100 border-parchment-300 text-parchment-700">×{item.quantity}</span>}
                    </div>
                  )}
                </header>
                <div className="px-4 py-3 space-y-2.5 border-t border-parchment-200">
                  {ws && (
                    (() => {
                      const pw = potionWeaponMods(item.name)
                      return (
                        <WeaponStatBlock
                          ws={ws}
                          attackBonus={weaponAttackBonus(effectiveChar, ws, pb, magicBonus(item, artificerLevel)) + pw.bonus}
                          damageMod={weaponDamageMod(effectiveChar, ws, magicBonus(item, artificerLevel)) + pw.bonus}
                          magicBonus={magicBonus(item, artificerLevel)}
                          attackDice={pw.attackDice}
                          damageDice={pw.damageDice}
                          potionBonus={pw.bonus}
                        />
                      )
                    })()
                  )}
                  {as_ && !ws && (
                    <ArmorStatBlock
                      as_={as_}
                      computedAC={as_.type === 'light' ? as_.acBase + abilityModFor(effectiveChar, 'dex') + magicBonus(item, artificerLevel)
                        : as_.type === 'medium' ? as_.acBase + Math.min(abilityModFor(effectiveChar, 'dex'), mediumDexCap) + magicBonus(item, artificerLevel)
                        : as_.type === 'heavy' ? as_.acBase + magicBonus(item, artificerLevel) || undefined
                        : undefined}
                    />
                  )}
                  {def && (
                    <MagicItemStatBlock
                      def={def}
                      attuned={item.attuned}
                      attunedCount={attuned}
                    />
                  )}
                  {descriptionText
                    ? <p className="text-sm text-parchment-700 leading-relaxed whitespace-pre-line">{descriptionText}</p>
                    : <p className="text-xs text-parchment-400">No description. Add notes below.</p>}
                  <div className="flex items-center gap-2 flex-wrap">
                    {consumable && (
                      <button type="button"
                        className="px-2.5 py-1 rounded border text-xs font-semibold transition-colors bg-amber-500 text-white border-amber-500 hover:bg-amber-600 hover:border-amber-600"
                        onClick={() => {
                          offerUndo(`Used ${item.name}`)
                          if (item.quantity <= 1) {
                            patch({ equipment: char.equipment.filter((_, i) => i !== idx) })
                            setExpandedInventoryItem(null)
                          } else {
                            const eq = [...char.equipment]; eq[idx] = { ...eq[idx], quantity: item.quantity - 1 }; patch({ equipment: eq })
                          }
                        }}
                      >Use {item.quantity > 1 ? `(${item.quantity} left)` : '(last one)'}</button>
                    )}
                    {potion ? drinkControls : isWeaponOrShield ? (
                      ws?.twoHanded ? (
                        <button type="button"
                          className={`px-2.5 py-1 rounded border text-xs font-semibold transition-colors ${item.equipped ? 'bg-green-600 text-white border-green-600' : 'border-parchment-300 text-parchment-600 hover:border-green-500 hover:text-green-700'}`}
                          onClick={() => item.equipped ? unequipItem() : equipWeapon(idx, 'main')}
                        >{item.equipped ? '✓ Two-Handed' : 'Two-Handed'}</button>
                      ) : as_?.type === 'shield' ? (
                        <button type="button"
                          className={`px-2.5 py-1 rounded border text-xs font-semibold transition-colors ${item.equipped ? 'bg-green-600 text-white border-green-600' : 'border-parchment-300 text-parchment-600 hover:border-green-500 hover:text-green-700'}`}
                          onClick={() => item.equipped ? unequipItem() : equipWeapon(idx, 'off')}
                        >{item.equipped ? '✓ Off Hand' : 'Off Hand'}</button>
                      ) : (() => {
                        const isDual = item.slot === 'dual'
                        const inMain = item.equipped && (item.slot === 'main' || isDual)
                        const inOff  = item.equipped && (item.slot === 'off'  || isDual)
                        const canDualWield = ws?.light && item.quantity >= 2
                        return (
                          <>
                            <button type="button"
                              className={`px-2.5 py-1 rounded border text-xs font-semibold transition-colors ${inMain ? 'bg-green-600 text-white border-green-600' : 'border-parchment-300 text-parchment-600 hover:border-green-500 hover:text-green-700'}`}
                              onClick={() => {
                                if (isDual) { const eq=[...char.equipment]; eq[idx]={...eq[idx],slot:'off'}; patch({equipment:eq}) }
                                else if (inMain) { unequipItem() }
                                else { equipWeapon(idx, 'main') }
                              }}
                            >{inMain ? '✓ Main Hand' : 'Main Hand'}</button>
                            <button type="button"
                              className={`px-2.5 py-1 rounded border text-xs font-semibold transition-colors ${inOff ? 'bg-green-600 text-white border-green-600' : 'border-parchment-300 text-parchment-600 hover:border-green-500 hover:text-green-700'}`}
                              onClick={() => {
                                if (isDual) { const eq=[...char.equipment]; eq[idx]={...eq[idx],slot:'main'}; patch({equipment:eq}) }
                                else if (inOff) { unequipItem() }
                                else { equipWeapon(idx, 'off') }
                              }}
                            >{inOff ? '✓ Off Hand' : 'Off Hand'}</button>
                            {canDualWield && item.equipped && !isDual && (
                              <span className="text-[10px] text-parchment-400 self-center italic">equip both to dual-wield</span>
                            )}
                          </>
                        )
                      })()
                    ) : implementHandedness(item) !== null ? (
                      implementHandedness(item) === '2h' ? (
                        <button type="button"
                          className={`px-2.5 py-1 rounded border text-xs font-semibold transition-colors ${item.equipped ? 'bg-violet-600 text-white border-violet-600' : 'border-parchment-300 text-parchment-600 hover:border-violet-500 hover:text-violet-700'}`}
                          onClick={() => item.equipped ? unequipItem() : equipImplement(idx, 'main')}
                        >{item.equipped ? '✓ Two-Handed' : 'Two-Handed'}</button>
                      ) : (() => {
                        const inMain = item.equipped && (item.slot === 'main' || !item.slot)
                        const inOff  = item.equipped && item.slot === 'off'
                        return (
                          <>
                            <button type="button"
                              className={`px-2.5 py-1 rounded border text-xs font-semibold transition-colors ${inMain ? 'bg-violet-600 text-white border-violet-600' : 'border-parchment-300 text-parchment-600 hover:border-violet-500 hover:text-violet-700'}`}
                              onClick={() => inMain ? unequipItem() : equipImplement(idx, 'main')}
                            >{inMain ? '✓ Main Hand' : 'Main Hand'}</button>
                            <button type="button"
                              className={`px-2.5 py-1 rounded border text-xs font-semibold transition-colors ${inOff ? 'bg-violet-600 text-white border-violet-600' : 'border-parchment-300 text-parchment-600 hover:border-violet-500 hover:text-violet-700'}`}
                              onClick={() => inOff ? unequipItem() : equipImplement(idx, 'off')}
                            >{inOff ? '✓ Off Hand' : 'Off Hand'}</button>
                          </>
                        )
                      })()
                    ) : isAlwaysWorn(item) ? (
                      // Rings: no equip concept, just attunement
                      <p className="text-xs text-parchment-400 italic">Always worn — attune to activate magical properties.</p>
                    ) : isNonEquippable(item) ? (
                      <p className="text-xs text-parchment-400 italic">Carried — no equipment slot.</p>
                    ) : (() => {
                      const SLOT_META: Record<BodySlotKey, { label: string; active: string; hover: string }> = {
                        helmet:   { label: 'Head',     active: 'bg-slate-600 text-white border-slate-600',   hover: 'hover:border-slate-400 hover:text-slate-700' },
                        eyes:     { label: 'Face',     active: 'bg-sky-600 text-white border-sky-600',       hover: 'hover:border-sky-400 hover:text-sky-700' },
                        amulet:   { label: 'Neck',     active: 'bg-teal-600 text-white border-teal-600',     hover: 'hover:border-teal-400 hover:text-teal-700' },
                        cloak:    { label: 'Back',     active: 'bg-purple-600 text-white border-purple-600', hover: 'hover:border-purple-400 hover:text-purple-700' },
                        robe:     { label: 'Body',     active: 'bg-violet-600 text-white border-violet-600', hover: 'hover:border-violet-400 hover:text-violet-700' },
                        bracers:  { label: 'Arms',     active: 'bg-cyan-600 text-white border-cyan-600',     hover: 'hover:border-cyan-400 hover:text-cyan-700' },
                        gloves:   { label: 'Hands',    active: 'bg-orange-600 text-white border-orange-600', hover: 'hover:border-orange-400 hover:text-orange-700' },
                        belt:     { label: 'Waist',    active: 'bg-yellow-600 text-white border-yellow-600', hover: 'hover:border-yellow-400 hover:text-yellow-700' },
                        boots:    { label: 'Feet',     active: 'bg-stone-600 text-white border-stone-600',   hover: 'hover:border-stone-400 hover:text-stone-700' },
                        backpack: { label: 'Backpack', active: 'bg-amber-600 text-white border-amber-600',   hover: 'hover:border-amber-400 hover:text-amber-700' },
                      }
                      const detected = detectBodySlot(item.name, def?.description)
                      const wearSlot = (slotKey: BodySlotKey) => {
                        if (item.slot === slotKey) {
                          const eq = [...char.equipment]; eq[idx] = { ...eq[idx], slot: undefined, equipped: false }; patch({ equipment: eq })
                        } else {
                          const eq = char.equipment.map((e, i) => {
                            if (i === idx) return { ...e, slot: slotKey, equipped: true }
                            if (e.slot === slotKey) return { ...e, slot: undefined, equipped: false }
                            return e
                          })
                          patch({ equipment: eq })
                        }
                      }

                      if (detected) {
                        // Single contextual button — item knows its slot
                        const meta = SLOT_META[detected]
                        const isWorn = item.slot === detected
                        return (
                          <button type="button" onClick={() => wearSlot(detected)}
                            className={`px-2.5 py-1 rounded border text-xs font-semibold transition-colors ${isWorn ? meta.active : `border-parchment-300 text-parchment-600 ${meta.hover}`}`}
                          >{isWorn ? `✓ ${meta.label}` : `Wear as ${meta.label}`}</button>
                        )
                      }

                      // No identifiable body slot — plain Equip only (never a free choice of
                      // slot, so e.g. a helmet can't end up on the Body or Feet slot).
                      return (
                        <button type="button" onClick={handleEquip}
                          className={`px-2.5 py-1 rounded border text-xs font-semibold transition-colors ${item.equipped ? 'bg-green-600 text-white border-green-600' : 'border-parchment-300 text-parchment-600 hover:border-green-500 hover:text-green-700'}`}
                        >{item.equipped ? '✓ Equipped' : 'Equip'}</button>
                      )
                    })()}
                    {needsAttunement && (
                      <button type="button" disabled={!item.attuned && attuned >= 3}
                        onClick={() => { const eq = [...char.equipment]; eq[idx] = { ...eq[idx], attuned: !item.attuned }; patch({ equipment: eq }) }}
                        className={`px-2.5 py-1 rounded border text-xs font-semibold transition-colors disabled:opacity-40 ${item.attuned ? 'bg-indigo-600 text-white border-indigo-600' : 'border-parchment-300 text-parchment-600 hover:border-indigo-400'}`}
                      >{item.attuned ? '✦ Attuned' : '✦ Attune'}</button>
                    )}
                    <div className="flex items-center gap-1 ml-auto">
                      <button type="button" className="w-5 h-5 rounded border border-parchment-200 text-parchment-500 hover:border-parchment-400 text-xs font-bold"
                        onClick={() => { const newQty=Math.max(0,item.quantity-1); const eq=[...char.equipment]; eq[idx]={...eq[idx],quantity:newQty,slot:(item.slot==='dual'&&newQty<2)?'main':item.slot}; patch({equipment:eq}) }}>−</button>
                      <span className="w-6 text-center text-sm">{item.quantity}</span>
                      <button type="button" className="w-5 h-5 rounded border border-parchment-200 text-parchment-500 hover:border-parchment-400 text-xs font-bold"
                        onClick={() => { const eq=[...char.equipment]; eq[idx]={...eq[idx],quantity:item.quantity+1}; patch({equipment:eq}) }}>+</button>
                    </div>
                    <button type="button" className="text-xs text-parchment-300 hover:text-red-500 transition-colors"
                      onClick={() => { offerUndo(`Removed ${item.name}`); patch({ equipment: char.equipment.filter((_,i)=>i!==idx) }); setExpandedInventoryItem(null) }}>✕ Remove</button>
                  </div>
                  <input className="input text-xs py-1 w-full" placeholder="Notes…" value={item.notes}
                    onChange={e => { const eq=[...char.equipment]; eq[idx]={...eq[idx],notes:e.target.value}; patch({equipment:eq}) }} />
                  {item.chargesMax !== undefined ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-parchment-600 shrink-0">Charges:</span>
                      <button type="button" className="w-5 h-5 rounded border border-parchment-200 text-parchment-500 hover:border-parchment-400 text-xs font-bold"
                        onClick={() => { const eq=[...char.equipment]; eq[idx]={...eq[idx],charges:Math.max(0,(item.charges??item.chargesMax??0)-1)}; patch({equipment:eq}) }}>−</button>
                      <span className="text-sm font-semibold w-5 text-center">{item.charges ?? item.chargesMax}</span>
                      <span className="text-xs text-parchment-400">/</span>
                      <input type="number" min={1} max={999} className="input text-xs py-0.5 w-12 text-center"
                        value={item.chargesMax}
                        onChange={e => { const val=parseInt(e.target.value,10); if(!isNaN(val)&&val>=1){const eq=[...char.equipment];eq[idx]={...eq[idx],chargesMax:val,charges:Math.min(item.charges??val,val)};patch({equipment:eq})} }} />
                      <button type="button" className="w-5 h-5 rounded border border-parchment-200 text-parchment-500 hover:border-parchment-400 text-xs font-bold"
                        onClick={() => { const eq=[...char.equipment]; eq[idx]={...eq[idx],charges:Math.min(item.chargesMax!,(item.charges??item.chargesMax??0)+1)}; patch({equipment:eq}) }}>+</button>
                      <label className="flex items-center gap-1 text-xs cursor-pointer ml-1">
                        <input type="checkbox" checked={!!item.rechargesOnLongRest}
                          onChange={e => { const eq=[...char.equipment]; eq[idx]={...eq[idx],rechargesOnLongRest:e.target.checked}; patch({equipment:eq}) }} />
                        <span>Recharge LR</span>
                      </label>
                      <button type="button" className="text-xs text-parchment-300 hover:text-red-500 ml-auto"
                        onClick={() => { const eq=[...char.equipment]; eq[idx]={...eq[idx],chargesMax:undefined,charges:undefined,rechargesOnLongRest:undefined}; patch({equipment:eq}) }}>✕ charges</button>
                    </div>
                  ) : (
                    <button type="button" className="text-xs text-parchment-400 hover:text-parchment-700"
                      onClick={() => { const eq=[...char.equipment]; eq[idx]={...eq[idx],chargesMax:1,charges:1}; patch({equipment:eq}) }}>＋ Add charges</button>
                  )}
                </div>
              </article>
            )
          })()
          if (card) selectedItemCard = card

          return (
            <Fragment key={idx}>
            <div
              data-item-idx={idx}
              ref={isExpanded ? el => { if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }) } : undefined}
              className={`rounded-lg overflow-hidden border-l-4 ${rarityAccent} transition-all ${
                isExpanded ? 'border border-parchment-300 shadow-sm' : 'border border-parchment-100 hover:border-parchment-300 hover:shadow-sm'
              } ${item.equipped ? 'bg-green-50/50' : ''}`}
            >
              {/* One line: name and tags on the left, the item's stats or rarity on the right */}
              <button type="button" className="w-full text-left px-3 py-1.5 flex items-center gap-2"
                onClick={() => setExpandedInventoryItem(isExpanded ? null : idx)}>
                <div className="flex-1 min-w-0 flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold text-sm text-parchment-900 leading-snug">{item.name}</span>
                    {infusionDef && (
                      <span className="text-[10px] font-semibold rounded px-1.5 py-0.5 bg-teal-50 text-teal-700 border border-teal-200" title="Artificer infusion">⟡ {infusionDef.name}</span>
                    )}
                    {item.attuned && <span className="text-[11px] text-indigo-500 shrink-0">✦</span>}
                    {item.quantity > 1 && (
                      <span className="text-[11px] bg-parchment-100 text-parchment-500 px-1.5 py-0.5 rounded-full font-medium shrink-0">×{item.quantity}</span>
                    )}
                    {item.chargesMax !== undefined && (
                      <span className="text-[11px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full font-medium shrink-0">{item.charges ?? item.chargesMax}/{item.chargesMax}</span>
                    )}
                    {item.equipped && <span className="text-[10px] font-bold text-green-600 shrink-0">● Equipped</span>}
                    {/* Rarity once: as the badge on the right for magic items, here when the badge shows stats */}
                    {rarity && rarity !== 'common' && badge?.toLowerCase() !== rarity && (
                      <span className={`text-[10px] font-bold uppercase tracking-wide shrink-0 ${rarityTextClass}`}>{rarity}</span>
                    )}
                </div>
                {badge && (
                  <span className={`text-xs font-bold rounded-md px-2 py-0.5 shrink-0 ${badgeColor ?? 'bg-parchment-100 text-parchment-600'}`}>{badge}</span>
                )}
                <span className="text-parchment-300 text-[10px] shrink-0">{isExpanded ? '▲' : '▼'}</span>
              </button>

            </div>
            {/* Narrow screens open the item under its row; wide ones show it beside the list */}
            {card && <div className="lg:hidden mt-1.5 mb-2">{card}</div>}
            </Fragment>
          )
        }

        // Section header — plain function to avoid component-identity remounts
        const sectionHead = (title: string, count: number, onAdd?: () => void, addLabel?: string) => (
          <div className="flex items-center gap-2 mb-2 mt-4 first:mt-0">
            <span className="text-xs font-bold text-parchment-600 uppercase tracking-wider">{title}</span>
            <span className="text-xs text-parchment-400">{count}</span>
            <div className="flex-1 h-px bg-parchment-100" />
            {onAdd && (
              <button type="button" onClick={onAdd}
                className="text-xs text-parchment-500 hover:text-parchment-800 border border-parchment-200 hover:border-parchment-400 rounded px-2 py-0.5 transition-colors"
              >{addLabel ?? '+ Add'}</button>
            )}
          </div>
        )

        // (SectionCard removed — sections now use SecHead pattern below)

        // Equipped loadout summary
        const equippedArmor = armors.find(x => x.item.equipped && x.as_?.type !== 'shield')
        const equippedWeapons = weapons.filter(x => x.item.equipped)
        const dualWieldWeapon = equippedWeapons.find(x => x.item.slot === 'dual')
        const mainHandWeapon = dualWieldWeapon ?? equippedWeapons.find(x => x.item.slot === 'main' || x.item.slot === 'both' || (!x.item.slot && x.item.equipped))
        const offHandWeapon = dualWieldWeapon ? undefined : equippedWeapons.find(x => x.item.slot === 'off')
        const equippedShield = armors.find(x => x.item.equipped && x.as_?.type === 'shield')
        const hasTwoHanded = mainHandWeapon?.item.slot === 'both' || (!mainHandWeapon?.item.slot && mainHandWeapon?.ws?.twoHanded)
        const canTWF = !hasTwoHanded && (dualWieldWeapon?.ws?.light || (mainHandWeapon?.ws?.light && offHandWeapon?.ws?.light))
        // Equipped implements (wand / rod / staff)
        const equippedImpls = char.equipment.filter(e => e.equipped && implementHandedness(e) !== null)
        const twoHandedImpl = equippedImpls.find(e => e.slot === 'both')
        const mainHandImpl = twoHandedImpl ?? equippedImpls.find(e => e.slot === 'main')
        const offHandImpl = twoHandedImpl ? undefined : equippedImpls.find(e => e.slot === 'off')
        const BODY_SLOTS = [
          { key: 'helmet',  label: 'Head',    color: 'border-slate-200 bg-slate-50',   text: 'text-slate-800',  head: 'text-slate-400',  bonus: 'text-slate-600' },
          { key: 'eyes',    label: 'Face',    color: 'border-sky-200 bg-sky-50',       text: 'text-sky-900',    head: 'text-sky-400',    bonus: 'text-sky-600' },
          { key: 'amulet',  label: 'Neck',    color: 'border-teal-200 bg-teal-50',     text: 'text-teal-900',   head: 'text-teal-400',   bonus: 'text-teal-600' },
          { key: 'cloak',   label: 'Back',    color: 'border-purple-200 bg-purple-50', text: 'text-purple-900', head: 'text-purple-400', bonus: 'text-purple-600' },
          { key: 'robe',    label: 'Body',    color: 'border-violet-200 bg-violet-50', text: 'text-violet-900', head: 'text-violet-400', bonus: 'text-violet-600' },
          { key: 'bracers', label: 'Arms',    color: 'border-cyan-200 bg-cyan-50',     text: 'text-cyan-900',   head: 'text-cyan-400',   bonus: 'text-cyan-600' },
          { key: 'gloves',  label: 'Hands',   color: 'border-orange-200 bg-orange-50', text: 'text-orange-900', head: 'text-orange-400', bonus: 'text-orange-600' },
          { key: 'belt',    label: 'Waist',   color: 'border-yellow-200 bg-yellow-50', text: 'text-yellow-900', head: 'text-yellow-500', bonus: 'text-yellow-700' },
          { key: 'boots',   label: 'Feet',    color: 'border-stone-200 bg-stone-50',   text: 'text-stone-800',  head: 'text-stone-400',  bonus: 'text-stone-600' },
          { key: 'backpack',label: 'Backpack',color: 'border-amber-200 bg-amber-50',   text: 'text-amber-900',  head: 'text-amber-400',  bonus: 'text-amber-600' },
        ] as const
        // Rings have no RAW limit — always worn; only attunement determines mechanical effect.
        const isAlwaysWorn = (e: typeof char.equipment[0]) => {
          const def = content.items.find(i => i.slug === e.itemSlug)
          return def?.type === 'Ring'
        }
        // Items that are carried/used but have no equip slot (orbs, containers, etc.)
        const isNonEquippable = (e: typeof char.equipment[0]) => {
          const n = e.name.toLowerCase()
          return /^orb\b/.test(n) || /\bchest\b/.test(n) || /\bbox\b/.test(n) || /\bcandle\b/.test(n) || /\bfigurine\b/.test(n) || /\bpot\b/.test(n)
        }
        // Only count an item as filling a body slot if that's a slot it can actually go in
        // (older saves may have e.g. a helmet sitting in the Body slot).
        const inValidBodySlot = (e: typeof char.equipment[0]) =>
          !!e.slot && detectBodySlot(e.name, content.items.find(i => i.slug === e.itemSlug)?.description) === e.slot
        const bodySlotItems: Record<string, typeof char.equipment[0] | undefined> = {}
        for (const { key } of BODY_SLOTS) bodySlotItems[key] = char.equipment.find(e => e.slot === key && inValidBodySlot(e))
        const alwaysWornItems = char.equipment.filter(e => isAlwaysWorn(e) && e.attuned)
        const equippedOther = char.equipment.filter(e =>
          e.equipped && !isAlwaysWorn(e) && !isNonEquippable(e) && !inValidBodySlot(e) &&
          !resolveWeapon(e, content.items) && !resolveArmor(e, content.items) && implementHandedness(e) === null
        )
        const hasLoadout = equippedArmor || equippedWeapons.length > 0 || equippedShield || equippedImpls.length > 0 ||
          BODY_SLOTS.some(s => bodySlotItems[s.key]) || alwaysWornItems.length > 0 || equippedOther.length > 0

        // AC shown on the armor slot — same number as the Stats tab (fighting style, feats, items included)
        const currentAC = equippedArmor ? ac : null

        return (
          <div className="space-y-4">
            {/* ── Loadout ── (only when something is equipped) */}
            {hasLoadout && (
            <div className="card">
              <div>
                <div className="text-[10px] font-bold text-parchment-400 uppercase tracking-widest mb-2">Loadout</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">

                  {/* Armor slot */}
                  {equippedArmor ? (
                    <div className="flex flex-col gap-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Armor</span>
                        <span className="text-[10px] text-blue-400 capitalize">{equippedArmor.as_?.type}</span>
                      </div>
                      <span className="text-sm font-semibold text-blue-900 leading-tight truncate">{equippedArmor.item.name}</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs font-bold text-blue-700">AC {currentAC ?? equippedArmor.as_?.acBase}</span>
                        {equippedArmor.as_?.stealthDisadvantage && (
                          <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 rounded px-1">Disadv. Stealth</span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1 rounded-lg border border-dashed border-parchment-200 bg-parchment-50 px-3 py-2.5 opacity-50">
                      <span className="text-[10px] font-bold text-parchment-400 uppercase tracking-widest">Armor</span>
                      <span className="text-xs text-parchment-400 italic">None</span>
                    </div>
                  )}

                  {/* Body slots (cloak, amulet, rings, boots) */}
                  {BODY_SLOTS.map(slot => {
                    const worn = bodySlotItems[slot.key]
                    if (!worn) return null
                    const def = content.items.find(i => i.slug === worn.itemSlug)
                    const bonuses: string[] = []
                    if (def?.acBonus) bonuses.push(`+${def.acBonus} AC`)
                    if (def?.savingThrowBonus) bonuses.push(`+${def.savingThrowBonus} saves`)
                    if (def?.spellDCBonus) bonuses.push(`+${def.spellDCBonus} Spell DC`)
                    if (def?.spellAttackBonus) bonuses.push(`+${def.spellAttackBonus} Spell Atk`)
                    if (def?.grantedResistances?.length) bonuses.push(`Resist: ${def.grantedResistances.join(', ')}`)
                    return (
                      <div key={slot.key} className={`flex flex-col gap-1 rounded-lg border px-3 py-2.5 ${slot.color}`}>
                        <div className="flex items-center justify-between gap-1">
                          <span className={`text-[10px] font-bold uppercase tracking-widest ${slot.head}`}>{slot.label}</span>
                          {worn.attuned && <span className="text-[10px] text-indigo-500">✦ Attuned</span>}
                        </div>
                        <span className={`text-sm font-semibold leading-tight truncate ${slot.text}`}>{worn.name}</span>
                        {bonuses.length > 0 && <span className={`text-[10px] mt-0.5 ${slot.bonus}`}>{bonuses.join(' · ')}</span>}
                      </div>
                    )
                  })}

                  {/* Weapon slots */}
                  {dualWieldWeapon ? (
                    (() => {
                      const w = dualWieldWeapon
                      const pw = potionWeaponMods(w.item.name)
                      const atkBonus = weaponAttackBonus(effectiveChar, w.ws!, pb, magicBonus(w.item, artificerLevel)) + pw.bonus
                      return (
                        <div className="col-span-1 sm:col-span-2 flex flex-col gap-1 rounded-lg border border-green-200 bg-green-50 px-3 py-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-green-500 uppercase tracking-widest">Dual Wield</span>
                            {w.ws!.finesse && <span className="text-[10px] text-green-500 bg-green-100 border border-green-200 rounded px-1">Finesse</span>}
                          </div>
                          <span className="text-sm font-semibold text-green-900 truncate">{w.item.name} × 2</span>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-xs font-bold text-green-700">{w.ws!.damage}{(() => { const m = weaponDamageMod(effectiveChar, w.ws!, magicBonus(w.item, artificerLevel)) + pw.bonus; return m ? ` ${formatMod(m)}` : '' })()}{pw.damageDice} {w.ws!.damageType}</span>
                            <span className="text-xs text-green-600">{formatMod(atkBonus)}{pw.attackDice} to hit</span>
                          </div>
                        </div>
                      )
                    })()
                  ) : twoHandedImpl && !mainHandWeapon && !hasTwoHanded ? (
                    (() => {
                      const item = twoHandedImpl
                      const def = content.items.find(d => d.slug === item.itemSlug)
                      const bonuses = [def?.spellAttackBonus ? `+${def.spellAttackBonus} Spell Atk` : null, def?.spellDCBonus ? `+${def.spellDCBonus} Spell DC` : null].filter(Boolean)
                      return (
                        <div className="col-span-1 sm:col-span-2 flex flex-col gap-1 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-violet-500 uppercase tracking-widest">Two-Handed</span>
                            {item.attuned && <span className="text-[10px] text-indigo-500">✦ Attuned</span>}
                          </div>
                          <span className="text-sm font-semibold text-violet-900 truncate">{item.name}</span>
                          {bonuses.length > 0 && <span className="text-xs text-violet-600 mt-0.5">{bonuses.join(' · ')}</span>}
                        </div>
                      )
                    })()
                  ) : hasTwoHanded && mainHandWeapon ? (
                    (() => {
                      const w = mainHandWeapon
                      const pw = potionWeaponMods(w.item.name)
                      const atkBonus = weaponAttackBonus(effectiveChar, w.ws!, pb, magicBonus(w.item, artificerLevel)) + pw.bonus
                      return (
                        <div className="col-span-1 sm:col-span-2 flex flex-col gap-1 rounded-lg border border-green-200 bg-green-50 px-3 py-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-green-500 uppercase tracking-widest">Two-Handed</span>
                            {w.ws!.ranged && <span className="text-[10px] text-green-500 bg-green-100 border border-green-200 rounded px-1">Ranged</span>}
                          </div>
                          <span className="text-sm font-semibold text-green-900 truncate">{w.item.name}</span>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-xs font-bold text-green-700">{w.ws!.damage}{(() => { const m = weaponDamageMod(effectiveChar, w.ws!, magicBonus(w.item, artificerLevel)) + pw.bonus; return m ? ` ${formatMod(m)}` : '' })()}{pw.damageDice} {w.ws!.damageType}</span>
                            <span className="text-xs text-green-600">{formatMod(atkBonus)}{pw.attackDice} to hit</span>
                          </div>
                        </div>
                      )
                    })()
                  ) : (
                    <>
                      {/* Main hand */}
                      {mainHandWeapon ? (
                        (() => {
                          const w = mainHandWeapon
                          const pw = potionWeaponMods(w.item.name)
                          const atkBonus = weaponAttackBonus(effectiveChar, w.ws!, pb, magicBonus(w.item, artificerLevel)) + pw.bonus
                          return (
                            <div className="flex flex-col gap-1 rounded-lg border border-green-200 bg-green-50 px-3 py-2.5">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-green-500 uppercase tracking-widest">Main Hand</span>
                                {w.ws!.ranged && <span className="text-[10px] text-green-500 bg-green-100 border border-green-200 rounded px-1">Ranged</span>}
                                {w.ws!.finesse && <span className="text-[10px] text-green-500 bg-green-100 border border-green-200 rounded px-1">Finesse</span>}
                              </div>
                              <span className="text-sm font-semibold text-green-900 truncate">{w.item.name}</span>
                              <div className="flex items-center gap-3 mt-0.5">
                                <span className="text-xs font-bold text-green-700">{w.ws!.damage}{(() => { const m = weaponDamageMod(effectiveChar, w.ws!, magicBonus(w.item, artificerLevel)) + pw.bonus; return m ? ` ${formatMod(m)}` : '' })()}{pw.damageDice} {w.ws!.damageType}</span>
                                <span className="text-xs text-green-600">{formatMod(atkBonus)}{pw.attackDice} to hit</span>
                              </div>
                            </div>
                          )
                        })()
                      ) : mainHandImpl ? (
                        (() => {
                          const item = mainHandImpl
                          const def = content.items.find(d => d.slug === item.itemSlug)
                          const bonuses = [def?.spellAttackBonus ? `+${def.spellAttackBonus} Spell Atk` : null, def?.spellDCBonus ? `+${def.spellDCBonus} Spell DC` : null].filter(Boolean)
                          return (
                            <div className="flex flex-col gap-1 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2.5">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-violet-500 uppercase tracking-widest">Main Hand</span>
                                {item.attuned && <span className="text-[10px] text-indigo-500">✦ Attuned</span>}
                              </div>
                              <span className="text-sm font-semibold text-violet-900 truncate">{item.name}</span>
                              {bonuses.length > 0 && <span className="text-xs text-violet-600 mt-0.5">{bonuses.join(' · ')}</span>}
                            </div>
                          )
                        })()
                      ) : null}

                      {/* Off hand: weapon, shield, or implement */}
                      {offHandWeapon ? (
                        (() => {
                          const w = offHandWeapon
                          const pw = potionWeaponMods(w.item.name)
                          const atkBonus = weaponAttackBonus(effectiveChar, w.ws!, pb, magicBonus(w.item, artificerLevel)) + pw.bonus
                          return (
                            <div className="flex flex-col gap-1 rounded-lg border border-green-200 bg-green-50 px-3 py-2.5">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-green-500 uppercase tracking-widest">Off Hand</span>
                                {w.ws!.ranged && <span className="text-[10px] text-green-500 bg-green-100 border border-green-200 rounded px-1">Ranged</span>}
                                {w.ws!.finesse && <span className="text-[10px] text-green-500 bg-green-100 border border-green-200 rounded px-1">Finesse</span>}
                              </div>
                              <span className="text-sm font-semibold text-green-900 truncate">{w.item.name}</span>
                              <div className="flex items-center gap-3 mt-0.5">
                                <span className="text-xs font-bold text-green-700">{w.ws!.damage}{(() => { const m = weaponDamageMod(effectiveChar, w.ws!, magicBonus(w.item, artificerLevel)) + pw.bonus; return m ? ` ${formatMod(m)}` : '' })()}{pw.damageDice} {w.ws!.damageType}</span>
                                <span className="text-xs text-green-600">{formatMod(atkBonus)}{pw.attackDice} to hit</span>
                              </div>
                            </div>
                          )
                        })()
                      ) : equippedShield ? (
                        <div className="flex flex-col gap-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5">
                          <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Off Hand — Shield</span>
                          <span className="text-sm font-semibold text-blue-900 truncate">{equippedShield.item.name}</span>
                          <span className="text-xs font-bold text-blue-700 mt-0.5">+{(equippedShield.as_?.acBase ?? 2) + magicBonus(equippedShield.item, artificerLevel)} AC</span>
                        </div>
                      ) : offHandImpl ? (
                        (() => {
                          const item = offHandImpl
                          const def = content.items.find(d => d.slug === item.itemSlug)
                          const bonuses = [def?.spellAttackBonus ? `+${def.spellAttackBonus} Spell Atk` : null, def?.spellDCBonus ? `+${def.spellDCBonus} Spell DC` : null].filter(Boolean)
                          return (
                            <div className="flex flex-col gap-1 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2.5">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-violet-500 uppercase tracking-widest">Off Hand</span>
                                {item.attuned && <span className="text-[10px] text-indigo-500">✦ Attuned</span>}
                              </div>
                              <span className="text-sm font-semibold text-violet-900 truncate">{item.name}</span>
                              {bonuses.length > 0 && <span className="text-xs text-violet-600 mt-0.5">{bonuses.join(' · ')}</span>}
                            </div>
                          )
                        })()
                      ) : null}
                    </>
                  )}

                  {/* Rings — always worn, no slot limit */}
                  {alwaysWornItems.map((item, i) => {
                    const def = content.items.find(d => d.slug === item.itemSlug)
                    const bonuses: string[] = []
                    if (def?.acBonus) bonuses.push(`+${def.acBonus} AC`)
                    if (def?.savingThrowBonus) bonuses.push(`+${def.savingThrowBonus} saves`)
                    if (def?.spellDCBonus) bonuses.push(`+${def.spellDCBonus} Spell DC`)
                    if (def?.grantedResistances?.length) bonuses.push(`Resist: ${def.grantedResistances.join(', ')}`)
                    return (
                      <div key={i} className="flex flex-col gap-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-amber-500">Ring</span>
                          {item.attuned && <span className="text-[10px] text-indigo-500">✦ Attuned</span>}
                        </div>
                        <span className="text-sm font-semibold leading-tight truncate text-amber-900">{item.name}</span>
                        {bonuses.length > 0 && <span className="text-[10px] mt-0.5 text-amber-600">{bonuses.join(' · ')}</span>}
                      </div>
                    )
                  })}

                  {/* Other equipped items */}
                  {equippedOther.map((item, i) => (
                    <div key={i} className="flex flex-col gap-1 rounded-lg border border-parchment-200 bg-parchment-50 px-3 py-2.5">
                      <span className="text-[10px] font-bold text-parchment-400 uppercase tracking-widest">Equipped</span>
                      <span className="text-sm font-semibold text-parchment-800 truncate">{item.name}</span>
                      {item.attuned && <span className="text-[10px] text-indigo-500">✦ Attuned</span>}
                    </div>
                  ))}
                </div>

                {/* Two-Weapon Fighting banner */}
                {canTWF && (() => {
                  const twfSource = offHandWeapon ?? dualWieldWeapon!
                  const offWs = twfSource.ws!
                  const offMod = offWs.finesse
                    ? Math.max(abilityModFor(effectiveChar, 'str'), abilityModFor(effectiveChar, 'dex'))
                    : abilityModFor(effectiveChar, 'str')
                  const offDmgMod = offMod < 0 ? offMod : 0
                  const hasTWFStyle = char.featuresChosen.some(fc => fc.value === 'two-weapon-fighting')
                  const effectiveMod = hasTWFStyle ? offMod : offDmgMod
                  return (
                    <div className="col-span-2 sm:col-span-3 flex items-center gap-3 px-3 py-2 rounded-lg border border-amber-200 bg-amber-50">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">Bonus Action</span>
                        <span className="text-xs font-semibold text-amber-900">Two-Weapon Fighting</span>
                      </div>
                      <div className="h-6 w-px bg-amber-200" />
                      <div className="flex flex-col">
                        <span className="text-[10px] text-amber-500 uppercase tracking-wide">Off-hand damage</span>
                        <span className="text-xs font-bold text-amber-800">
                          {offWs.damage}{effectiveMod !== 0 ? ` ${formatMod(effectiveMod)}` : ''} {offWs.damageType}
                        </span>
                      </div>
                      {!hasTWFStyle && (
                        <span className="ml-auto text-[10px] text-amber-500 italic">No ability mod to off-hand dmg<br/>unless negative · TWF style removes this</span>
                      )}
                    </div>
                  )
                })()}
              </div>
            </div>
            )}{/* end loadout card */}

            {/* ── Item Sections ── */}
            {(() => {
              // The search box narrows every section to the items whose name matches
              const q = inventorySearch.trim().toLowerCase()
              const shown = q
                ? Object.fromEntries(Object.entries(grouped).map(([cat, list]) => [cat, list.filter(({ item }) => item.name.toLowerCase().includes(q))])) as typeof grouped
                : grouped
              const matchCount = Object.values(shown).reduce((n, list) => n + list.length, 0)
              const RARITY_BADGE: Record<string, string> = {
                common:      'bg-parchment-100 text-parchment-600',
                uncommon:    'bg-green-100 text-green-700',
                rare:        'bg-blue-100 text-blue-700',
                'very rare': 'bg-violet-100 text-violet-700',
                legendary:   'bg-amber-100 text-amber-700',
                artifact:    'bg-orange-100 text-orange-700',
              }
              const rarityBadge = (rarity: string | undefined) => ({
                badge: rarity,
                badgeColor: rarity ? (RARITY_BADGE[rarity.toLowerCase()] ?? RARITY_BADGE.common) : undefined,
              })

              const CAT_LABELS: Record<ItemCat, string> = {
                armor: 'Armor', potion: 'Potion', ring: 'Ring', rod: 'Rod',
                scroll: 'Scroll', staff: 'Staff', wand: 'Wand', weapon: 'Weapon',
                wondrous: 'Wondrous', gear: 'Gear',
              }

              // Amalgam slugs that have explicit tiered variants or inline +1/+2/+3 buttons;
              // hide them from pickers so only the usable entries show.
              const TIERED_BASE_SLUGS = new Set([
                'rod-of-the-pact-keeper', 'wand-of-the-war-mage',
                'amulet-of-the-devout', 'arcane-grimoire', 'moon-sickle',
                'shield-1-2-3', 'weapon-1-2-3', 'armor-1-2-3', 'ammunition',
                'shield-1', 'shield-2', 'shield-3',
              ])

              const magicPicker = (filter: (it: ItemDef) => boolean) => (
                <div className="mt-3 p-3 rounded-lg border border-parchment-200 bg-parchment-50">
                  <input className="input mb-2 text-sm" placeholder="Search…" value={addPanelSearch}
                    onChange={e => setAddPanelSearch(e.target.value)} autoFocus />
                  <div className="space-y-1 max-h-52 overflow-y-auto">
                    {content.items
                      .filter(it => it.name && !TIERED_BASE_SLUGS.has(it.slug) && filter(it) && (!addPanelSearch || it.name.toLowerCase().includes(addPanelSearch.toLowerCase())))
                      .map(it => (
                        <button key={it.slug} type="button"
                          className="w-full text-left px-2.5 py-1.5 rounded border border-parchment-200 hover:border-indigo-300 hover:bg-indigo-50 text-sm flex items-center gap-2 transition-colors"
                          onClick={() => { patch({ equipment: [...char.equipment, { itemSlug: it.slug, name: it.name, quantity: 1, equipped: false, attuned: false, isHomebrew: it.source.site === 'homebrew', notes: '' }] }); setAddPanel(null) }}>
                          <span className="flex-1">{it.name}</span>
                          {it.rarity && <span className="text-xs text-parchment-400">{it.rarity}</span>}
                          {it.attunement && <span className="text-xs text-indigo-400">✦</span>}
                        </button>
                    ))}
                  </div>
                </div>
              )

              const secLabel = (cat: ItemCat, label: string) => (
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-bold text-parchment-500 uppercase tracking-widest">{label}</span>
                  {shown[cat].length > 0 && (
                    <span className="text-[10px] font-bold bg-parchment-100 text-parchment-500 px-1.5 py-0.5 rounded-full">{shown[cat].length}</span>
                  )}
                  <div className="flex-1 h-px bg-parchment-100" />
                </div>
              )

              const catKey = (cat: ItemCat) => cat === 'gear' ? 'add-gear-browse' : `add-${cat}`
              const catVisible = (cat: ItemCat) => shown[cat].length > 0 || addPanel === catKey(cat)

              const WORN_CATS:   ItemCat[] = ['armor', 'ring', 'wondrous']
              const HELD_CATS:   ItemCat[] = ['weapon', 'rod', 'staff', 'wand', 'scroll']
              const SUPPLY_CATS: ItemCat[] = ['potion', 'gear']

              const addPill = (cat: ItemCat) => {
                const key = catKey(cat)
                const active = addPanel === key
                return (
                  <button key={cat} type="button"
                    className={`text-xs rounded-full px-2.5 py-0.5 border transition-colors ${active ? 'bg-parchment-700 text-white border-parchment-700' : 'border-parchment-200 text-parchment-500 hover:border-parchment-500 hover:text-parchment-800'}`}
                    onClick={() => { setAddPanel(active ? null : key); setAddPanelSearch('') }}>
                    {active ? `✕ ${CAT_LABELS[cat]}` : `+ ${CAT_LABELS[cat]}`}
                  </button>
                )
              }

              const cardHeader = (title: string, cats: ItemCat[], extra?: React.ReactNode) => (
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-parchment-100">
                  <span className="font-semibold text-parchment-800 text-sm">{title}</span>
                  <div className="flex flex-wrap gap-1.5 justify-end">
                    {cats.map(cat => addPill(cat))}
                    {extra}
                  </div>
                </div>
              )

              // Build the lists first: rendering them fills in selectedItemCard for the side panel
              const sections = (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <input className="input text-sm py-1.5 max-w-xs" placeholder="Search your items…" aria-label="Search your items"
                      value={inventorySearch} onChange={e => setInventorySearch(e.target.value)} />
                    {q && <span className="text-xs text-parchment-500">{matchCount} of {char.equipment.length} items</span>}
                    {q && <button type="button" onClick={() => setInventorySearch('')} className="text-xs text-parchment-500 hover:text-parchment-800 underline">Clear</button>}
                  </div>

                  {/* ── Worn ── */}
                  <div className="card">
                    {cardHeader('Worn', WORN_CATS)}
                    <div className="divide-y divide-parchment-100">

                      {catVisible('armor') && (
                        <div className="py-3 first:pt-0 last:pb-0">
                          {secLabel('armor', 'Armor')}
                          {addPanel === 'add-armor' && (() => {
                            const mundaneArmorSlugs = new Set(['padded','leather','studded-leather','hide','chain-shirt','scale-mail','breastplate','half-plate','ring-mail','chain-mail','splint','plate','shield'])
                            const groups = [
                              { label: 'Light Armor',  keys: ['padded','leather','studded-leather'] },
                              { label: 'Medium Armor', keys: ['hide','chain-shirt','scale-mail','breastplate','half-plate'] },
                              { label: 'Heavy Armor',  keys: ['ring-mail','chain-mail','splint','plate'] },
                              { label: 'Shield',       keys: ['shield'] },
                            ]
                            const mundaneAll = groups.flatMap(g => g.keys.map(k => {
                              const as_ = content.items.find(i => i.slug === k)?.armorStats
                              return { slug: k, ...(as_ ?? { acBase: 0, type: 'light' as const }), group: g.label, isMagic: false }
                            }))
                            const magicArmors = content.items
                              .filter(i => !!i.armorStats && !mundaneArmorSlugs.has(i.slug))
                              .sort((a, b) => a.name.localeCompare(b.name))
                              .map(i => ({ slug: i.slug, ...i.armorStats!, label: i.name, group: 'Magic Armor', isMagic: true }))
                            const all = [...mundaneAll, ...magicArmors]
                            const filtered = addPanelSearch ? all.filter(a => a.label?.toLowerCase().includes(addPanelSearch.toLowerCase())) : all
                            const sections = addPanelSearch
                              ? [{ label: 'Results', isMagic: false }]
                              : [...groups.map(g => ({ label: g.label, isMagic: false })), { label: 'Magic Armor', isMagic: true }]
                            return (
                              <div className="mb-3 p-3 rounded-lg border border-parchment-200 bg-parchment-50">
                                <input className="input mb-2 text-sm" placeholder="Search armor…" value={addPanelSearch} onChange={e => setAddPanelSearch(e.target.value)} autoFocus />
                                <div className="space-y-2 max-h-52 overflow-y-auto">
                                  {sections.map(section => {
                                    const items = addPanelSearch ? filtered : all.filter(a => a.group === section.label)
                                    if (items.length === 0) return null
                                    return (
                                      <div key={section.label}>
                                        {!addPanelSearch && <div className={`text-xs font-semibold uppercase mb-1 ${section.isMagic ? 'text-violet-500' : 'text-parchment-400'}`}>{section.label}</div>}
                                        <div className="grid grid-cols-2 gap-1">
                                          {items.map(a => {
                                            const dex = abilityModFor(effectiveChar, 'dex')
                                            const calcAC = a.type === 'light' ? a.acBase + dex : a.type === 'medium' ? a.acBase + Math.min(dex, mediumDexCap) : a.acBase
                                            const baseName = a.label?.replace(/ \(.*\)$/, '') ?? a.slug
                                            const acLabel = a.type === 'shield' ? `+${a.acBase} AC` : `AC ${calcAC}`
                                            return (
                                              <div key={a.slug} className={`flex items-stretch rounded border overflow-hidden text-sm ${a.isMagic ? 'border-violet-100' : 'border-parchment-200'}`}>
                                                <button type="button"
                                                  className={`flex-1 text-left px-2 py-1.5 transition-colors flex items-center justify-between gap-1 min-w-0 ${a.isMagic ? 'hover:bg-violet-50' : 'hover:bg-blue-50'}`}
                                                  onClick={() => { patch({ equipment: [...char.equipment, { itemSlug: a.slug, name: baseName, quantity: 1, equipped: false, attuned: false, isHomebrew: false, notes: '' }] }); setAddPanel(null) }}>
                                                  <span className="truncate">{baseName}</span>
                                                  <span className="text-xs text-parchment-400 shrink-0">{acLabel}</span>
                                                </button>
                                                {!a.isMagic && [1, 2, 3].map(tier => (
                                                  <button key={tier} type="button"
                                                    className="px-1.5 border-l border-parchment-200 text-[10px] font-bold text-violet-500 hover:bg-violet-50 transition-colors shrink-0"
                                                    title={`Add ${baseName} +${tier}`}
                                                    onClick={() => { patch({ equipment: [...char.equipment, { itemSlug: a.slug, name: `${baseName} +${tier}`, quantity: 1, equipped: false, attuned: false, isHomebrew: false, notes: '' }] }); setAddPanel(null) }}>
                                                    +{tier}
                                                  </button>
                                                ))}
                                              </div>
                                            )
                                          })}
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            )
                          })()}
                          <div className="space-y-1.5">
                            {shown.armor.map(({ item, idx }) => {
                              const as_ = resolveArmor(item, content.items)!
                              const dex = abilityModFor(effectiveChar, 'dex')
                              const mb = magicBonus(item, artificerLevel)
                              const calcAC = as_.type === 'shield' ? `+${as_.acBase + mb} AC` : as_.type === 'light' ? `AC ${as_.acBase + dex + mb}` : as_.type === 'medium' ? `AC ${as_.acBase + Math.min(dex, mediumDexCap) + mb}` : `AC ${as_.acBase + mb}`
                              const warnings: string[] = []
                              if (as_.type !== 'shield' && !isArmorProficient(char, as_, featArmor)) warnings.push('Not proficient')
                              if (as_.minStrength && effectiveChar.abilityScores.str < as_.minStrength) warnings.push(`STR ${as_.minStrength} req.`)
                              const def = content.items.find(i => i.slug === item.itemSlug && i.name)
                              const descParts = [warnings.length ? `⚠ ${warnings.join(' · ')}` : null, def?.description || null, item.notes || null].filter(Boolean)
                              return itemRow({ item, idx, badge: calcAC, badgeColor: 'bg-blue-100 text-blue-700', descriptionText: descParts.join('\n\n') || null })
                            })}
                          </div>
                        </div>
                      )}

                      {catVisible('ring') && (
                        <div className="py-3 first:pt-0 last:pb-0">
                          {secLabel('ring', 'Ring')}
                          {addPanel === 'add-ring' && magicPicker(it => it.type === 'Ring')}
                          <div className="mt-1 space-y-1.5">
                            {shown.ring.map(({ item, idx }) => {
                              const def = content.items.find(i => i.slug === item.itemSlug && i.name)
                              const rb = rarityBadge(def?.rarity)
                              return itemRow({ item, idx, badge: rb.badge, badgeColor: rb.badgeColor, descriptionText: def?.description || item.notes || null, showAttune: def?.attunement })
                            })}
                          </div>
                        </div>
                      )}

                      {catVisible('wondrous') && (
                        <div className="py-3 first:pt-0 last:pb-0">
                          {secLabel('wondrous', 'Wondrous Item')}
                          {addPanel === 'add-wondrous' && magicPicker(it => {
                            const n = it.name.toLowerCase()
                            return it.type === 'Wondrous Item' && !/^rod\b/.test(n) && !/^scroll\b/.test(n) && !/^staff\b/.test(n) && !/^wand\b/.test(n) && !it.weaponStats && !it.armorStats
                          })}
                          <div className="mt-1 space-y-1.5">
                            {shown.wondrous.map(({ item, idx }) => {
                              const def = content.items.find(i => i.slug === item.itemSlug && i.name)
                              const rb = rarityBadge(def?.rarity)
                              return itemRow({ item, idx, badge: rb.badge, badgeColor: rb.badgeColor, descriptionText: def?.description || item.notes || null, showAttune: def?.attunement })
                            })}
                          </div>
                        </div>
                      )}

                      {!WORN_CATS.some(catVisible) && (
                        <p className="text-sm text-parchment-400 py-2">Nothing worn yet.</p>
                      )}
                    </div>
                  </div>

                  {/* ── Held ── */}
                  <div className="card">
                    {cardHeader('Held', HELD_CATS)}
                    <div className="divide-y divide-parchment-100">

                      {catVisible('weapon') && (
                        <div className="py-3 first:pt-0 last:pb-0">
                          {secLabel('weapon', 'Weapon')}
                          {addPanel === 'add-weapon' && (() => {
                            const mundaneSlugs = new Set(['club','dagger','greatclub','handaxe','javelin','light-hammer','mace','quarterstaff','sickle','spear','crossbow-light','dart','shortbow','sling','battleaxe','flail','glaive','greataxe','greatsword','halberd','lance','longsword','maul','morningstar','pike','rapier','scimitar','shortsword','trident','war-pick','warhammer','whip','crossbow-hand','crossbow-heavy','longbow','net'])
                            const groups = [
                              { label: 'Simple Melee',   keys: ['club','dagger','greatclub','handaxe','javelin','light-hammer','mace','quarterstaff','sickle','spear'] },
                              { label: 'Simple Ranged',  keys: ['crossbow-light','dart','shortbow','sling'] },
                              { label: 'Martial Melee',  keys: ['battleaxe','flail','glaive','greataxe','greatsword','halberd','lance','longsword','maul','morningstar','pike','rapier','scimitar','shortsword','trident','war-pick','warhammer','whip'] },
                              { label: 'Martial Ranged', keys: ['crossbow-hand','crossbow-heavy','longbow','net'] },
                            ]
                            const mundaneAll = groups.flatMap(g => g.keys.map(k => {
                              const ws = content.items.find(i => i.slug === k)?.weaponStats
                              return { slug: k, ...(ws ?? { damage: '', damageType: '' }), group: g.label, isMagic: false }
                            }))
                            const magicWeapons = content.items
                              .filter(i => !!i.weaponStats && !mundaneSlugs.has(i.slug))
                              .sort((a, b) => a.name.localeCompare(b.name))
                              .map(i => ({ slug: i.slug, ...i.weaponStats!, label: i.name, group: 'Magic Weapons', isMagic: true }))
                            const all = [...mundaneAll, ...magicWeapons]
                            const filtered = addPanelSearch ? all.filter(w => w.label?.toLowerCase().includes(addPanelSearch.toLowerCase())) : all
                            const sections = addPanelSearch
                              ? [{ label: 'Results', isMagic: false }]
                              : [...groups.map(g => ({ label: g.label, isMagic: false })), { label: 'Magic Weapons', isMagic: true }]
                            return (
                              <div className="mb-3 p-3 rounded-lg border border-parchment-200 bg-parchment-50">
                                <input className="input mb-2 text-sm" placeholder="Search weapons…" value={addPanelSearch} onChange={e => setAddPanelSearch(e.target.value)} autoFocus />
                                <div className="space-y-2 max-h-52 overflow-y-auto">
                                  {sections.map(section => {
                                    const items = addPanelSearch ? filtered : all.filter(w => w.group === section.label)
                                    if (items.length === 0) return null
                                    return (
                                      <div key={section.label}>
                                        {!addPanelSearch && <div className={`text-xs font-semibold uppercase mb-1 ${section.isMagic ? 'text-violet-500' : 'text-parchment-400'}`}>{section.label}</div>}
                                        <div className="grid grid-cols-2 gap-1">
                                          {items.map(w => (
                                            <div key={w.slug} className={`flex items-stretch rounded border overflow-hidden text-sm ${w.isMagic ? 'border-violet-100' : 'border-parchment-200'}`}>
                                              <button type="button"
                                                className={`flex-1 text-left px-2 py-1.5 transition-colors flex items-center justify-between gap-1 min-w-0 ${w.isMagic ? 'hover:bg-violet-50' : 'hover:bg-green-50'}`}
                                                onClick={() => { patch({ equipment: [...char.equipment, { itemSlug: w.slug, name: w.label ?? w.slug, quantity: 1, equipped: false, attuned: false, isHomebrew: false, notes: '' }] }); setAddPanel(null) }}>
                                                <span className="truncate">{w.label}</span>
                                                <span className="text-xs text-parchment-400 shrink-0">{w.damage}</span>
                                              </button>
                                              {!w.isMagic && [1, 2, 3].map(tier => (
                                                <button key={tier} type="button"
                                                  className="px-1.5 border-l border-parchment-200 text-[10px] font-bold text-violet-500 hover:bg-violet-50 transition-colors shrink-0"
                                                  title={`Add ${w.label} +${tier}`}
                                                  onClick={() => { patch({ equipment: [...char.equipment, { itemSlug: w.slug, name: `${w.label ?? w.slug} +${tier}`, quantity: 1, equipped: false, attuned: false, isHomebrew: false, notes: '' }] }); setAddPanel(null) }}>
                                                  +{tier}
                                                </button>
                                              ))}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            )
                          })()}
                          <div className="space-y-1.5">
                            {shown.weapon.map(({ item, idx }) => {
                              const ws = resolveWeapon(item, content.items)!
                              const bonus = magicBonus(item, artificerLevel)
                              const pw = potionWeaponMods(item.name)
                              const dmgMod = weaponDamageMod(effectiveChar, ws, bonus) + pw.bonus
                              const dmgStr = ws.damage === '—' ? ws.damage : `${ws.damage}${dmgMod !== 0 ? formatMod(dmgMod) : ''}${pw.damageDice} ${ws.damageType}`
                              const badge = `${dmgStr}${ws.finesse ? ' · Finesse' : ''}${ws.ranged ? ' · Ranged' : ''}`
                              return itemRow({ item, idx, badge, badgeColor: 'bg-green-100 text-green-700', descriptionText: item.notes || null })
                            })}
                          </div>
                        </div>
                      )}

                      {catVisible('rod') && (
                        <div className="py-3 first:pt-0 last:pb-0">
                          {secLabel('rod', 'Rod')}
                          {addPanel === 'add-rod' && magicPicker(it => /^rod\b/i.test(it.name))}
                          <div className="mt-1 space-y-1.5">
                            {shown.rod.map(({ item, idx }) => {
                              const def = content.items.find(i => i.slug === item.itemSlug && i.name)
                              const rb = rarityBadge(def?.rarity)
                              return itemRow({ item, idx, badge: rb.badge, badgeColor: rb.badgeColor, descriptionText: def?.description || item.notes || null, showAttune: def?.attunement })
                            })}
                          </div>
                        </div>
                      )}

                      {catVisible('staff') && (
                        <div className="py-3 first:pt-0 last:pb-0">
                          {secLabel('staff', 'Staff')}
                          {addPanel === 'add-staff' && magicPicker(it => /^staff\b/i.test(it.name))}
                          <div className="mt-1 space-y-1.5">
                            {shown.staff.map(({ item, idx }) => {
                              const def = content.items.find(i => i.slug === item.itemSlug && i.name)
                              const rb = rarityBadge(def?.rarity)
                              return itemRow({ item, idx, badge: rb.badge, badgeColor: rb.badgeColor, descriptionText: def?.description || item.notes || null, showAttune: def?.attunement })
                            })}
                          </div>
                        </div>
                      )}

                      {catVisible('wand') && (
                        <div className="py-3 first:pt-0 last:pb-0">
                          {secLabel('wand', 'Wand')}
                          {addPanel === 'add-wand' && magicPicker(it => /^wand\b/i.test(it.name))}
                          <div className="mt-1 space-y-1.5">
                            {shown.wand.map(({ item, idx }) => {
                              const def = content.items.find(i => i.slug === item.itemSlug && i.name)
                              const rb = rarityBadge(def?.rarity)
                              return itemRow({ item, idx, badge: rb.badge, badgeColor: rb.badgeColor, descriptionText: def?.description || item.notes || null, showAttune: def?.attunement })
                            })}
                          </div>
                        </div>
                      )}

                      {catVisible('scroll') && (
                        <div className="py-3 first:pt-0 last:pb-0">
                          {secLabel('scroll', 'Scroll')}
                          {addPanel === 'add-scroll' && magicPicker(it => /^scroll\b/i.test(it.name))}
                          <div className="mt-1 space-y-1.5">
                            {shown.scroll.map(({ item, idx }) => {
                              const def = content.items.find(i => i.slug === item.itemSlug && i.name)
                              const rb = rarityBadge(def?.rarity)
                              return itemRow({ item, idx, badge: rb.badge, badgeColor: rb.badgeColor, descriptionText: def?.description || item.notes || null, showAttune: def?.attunement, consumable: true })
                            })}
                          </div>
                        </div>
                      )}

                      {!HELD_CATS.some(catVisible) && (
                        <p className="text-sm text-parchment-400 py-2">Nothing held yet.</p>
                      )}
                    </div>
                  </div>

                  {/* ── Other ── */}
                  <div className="card">
                    {cardHeader('Other', SUPPLY_CATS,
                      <button type="button"
                        className={`text-xs rounded-full px-2.5 py-0.5 border transition-colors ${addPanel === 'add-custom' ? 'bg-parchment-700 text-white border-parchment-700' : 'border-parchment-200 text-parchment-500 hover:border-parchment-500 hover:text-parchment-800'}`}
                        onClick={() => { setAddPanel(addPanel === 'add-custom' ? null : 'add-custom'); setAddPanelSearch('') }}>
                        {addPanel === 'add-custom' ? '✕ Custom' : '+ Custom'}
                      </button>
                    )}
                    {/* Custom item: any name, added as plain gear */}
                    {addPanel === 'add-custom' && (() => {
                      const name = addPanelSearch.trim()
                      const addCustom = () => {
                        if (!name) return
                        patch({ equipment: [...char.equipment, { itemSlug: `custom-${Date.now()}`, name, quantity: 1, equipped: false, attuned: false, isHomebrew: true, notes: '' }] })
                        setAddPanel(null); setAddPanelSearch('')
                      }
                      return (
                        <div className="mb-3 p-3 rounded-lg border border-parchment-200 bg-parchment-50 flex gap-2">
                          <input className="input text-sm flex-1" placeholder="Item name, e.g. Grappling hook" value={addPanelSearch} autoFocus
                            onChange={e => setAddPanelSearch(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') addCustom(); if (e.key === 'Escape') setAddPanel(null) }} />
                          <button type="button" className="btn-primary text-sm disabled:opacity-50" disabled={!name} onClick={addCustom}>Add</button>
                        </div>
                      )
                    })()}
                    <div className="divide-y divide-parchment-100">

                      {catVisible('potion') && (
                        <div className="py-3 first:pt-0 last:pb-0">
                          {secLabel('potion', 'Potion')}
                          {addPanel === 'add-potion' && magicPicker(it => it.type === 'Potion')}
                          <div className="mt-1 space-y-1.5">
                            {shown.potion.map(({ item, idx }) => {
                              const def = content.items.find(i => i.slug === item.itemSlug && i.name)
                              const rb = rarityBadge(def?.rarity)
                              // Every potion gets Drink, even one without curated data
                              const potion = def?.potion ?? { effect: rb.badge ?? 'Potion' }
                              const descParts = [def?.description || null, item.notes || null].filter(Boolean)
                              return itemRow({
                                item, idx, potion,
                                badge: potion.effect,
                                badgeColor: potion.healing ? 'bg-rose-100 text-rose-700' : 'bg-teal-100 text-teal-700',
                                descriptionText: descParts.join('\n\n') || null,
                              })
                            })}
                          </div>
                        </div>
                      )}

                      {catVisible('gear') && (
                        <div className="py-3 first:pt-0 last:pb-0">
                          {secLabel('gear', 'Gear')}
                          {addPanel === 'add-gear-browse' && (
                            <div className="mb-3 p-3 rounded-lg border border-parchment-200 bg-parchment-50">
                              <input className="input mb-2 text-sm" placeholder="Search gear…" value={addPanelSearch} onChange={e => setAddPanelSearch(e.target.value)} autoFocus />
                              <div className="space-y-2 max-h-52 overflow-y-auto">
                                {COMMON_GEAR.map(cat => {
                                  const items = cat.items.filter(n => !addPanelSearch || n.toLowerCase().includes(addPanelSearch.toLowerCase()))
                                  if (items.length === 0) return null
                                  return (
                                    <div key={cat.cat}>
                                      {!addPanelSearch && <div className="text-xs font-semibold text-parchment-400 uppercase mb-1">{cat.cat}</div>}
                                      <div className="grid grid-cols-2 gap-1">
                                        {items.map(name => (
                                          <button key={name} type="button"
                                            className="text-left px-2 py-1 rounded border border-parchment-200 hover:border-parchment-400 hover:bg-parchment-50 text-sm transition-colors"
                                            onClick={() => { patch({ equipment: [...char.equipment, { itemSlug: `gear-${name.toLowerCase().replace(/[^a-z0-9]/g,'-')}`, name, quantity: 1, equipped: false, attuned: false, isHomebrew: false, notes: '' }] }) }}
                                          >{name}</button>
                                        ))}
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}
                          <div className="space-y-1.5">
                            {shown.gear.map(({ item, idx }) => {
                              const cd = CONSUMABLE_DATA[item.name]
                              const descText = cd ? cd.text + (item.notes ? '\n\n' + item.notes : '') : (item.notes || null)
                              return itemRow({ item, idx, badge: cd?.badge, badgeColor: cd?.badgeColor, descriptionText: descText, consumable: !!cd })
                            })}
                          </div>
                        </div>
                      )}

                      {!SUPPLY_CATS.some(catVisible) && (
                        <p className="text-sm text-parchment-400 py-2">No potions or gear yet.</p>
                      )}
                    </div>
                  </div>

                </div>
              )
              return (
                <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-5 lg:items-start">
                  {sections}
                  <aside className="hidden lg:block sticky top-14 max-h-[calc(100vh-4.5rem)] overflow-y-auto rounded-xl [scrollbar-width:thin]">
                    {selectedItemCard ?? (
                      <div className="rounded-xl border-2 border-dashed border-parchment-300 px-6 py-10 text-center">
                        <p className="text-sm font-semibold text-parchment-600">Choose an item</p>
                        <p className="text-xs text-parchment-400 mt-0.5">Its card opens here: equip, attune, drink or use it.</p>
                      </div>
                    )}
                  </aside>
                </div>
              )
            })()}
          </div>
        )
      })()}

    </div>
  )
}
