import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'

const HOLD_MS = 1800
const BURST_MS = 1900
const RING_R = 25
const RING_C = 2 * Math.PI * RING_R

/** Inspiration: click the empty socket to gain it. A held gem glows and shines until you press
 *  and hold it to spend it, which floods the screen with golden light. */
export function InspirationToken({ held, onChange }: { held: boolean; onChange: (held: boolean) => void }) {
  const [holding, setHolding] = useState(false)
  const [justGained, setJustGained] = useState(false)
  const [hint, setHint] = useState(false)
  const [burst, setBurst] = useState<{ x: number; y: number; id: number } | null>(null)
  // While the gem is held down the screen pulses gold from it, faster and brighter as the ring fills
  const [charge, setCharge] = useState<{ x: number; y: number } | null>(null)
  const [announce, setAnnounce] = useState('')
  const gemRef = useRef<HTMLSpanElement>(null)
  const timer = useRef<number | undefined>(undefined)
  const hintTimer = useRef<number | undefined>(undefined)
  // The click that follows a completed hold mustn't hand the inspiration straight back
  const suppressClick = useRef(false)
  // The hold finishes after a delay; use the latest onChange, not the one from when it began
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => () => { window.clearTimeout(timer.current); window.clearTimeout(hintTimer.current) }, [])

  const cancelHold = () => { window.clearTimeout(timer.current); setHolding(false); setCharge(null) }

  const gemCentre = () => {
    const r = gemRef.current?.getBoundingClientRect()
    return { x: r ? r.left + r.width / 2 : innerWidth / 2, y: r ? r.top + r.height / 2 : innerHeight / 2 }
  }

  const startHold = () => {
    if (!held || holding) return
    setHint(false)
    setHolding(true)
    setCharge(gemCentre())
    timer.current = window.setTimeout(() => {
      setHolding(false)
      setCharge(null)
      suppressClick.current = true
      setBurst({ ...gemCentre(), id: Date.now() })
      setAnnounce('Inspiration spent')
      onChangeRef.current(false)
    }, HOLD_MS)
  }

  // A click or key press that isn't the end of a hold
  const activate = () => {
    if (!held) {
      setJustGained(true)
      setAnnounce('Inspiration gained')
      onChange(true)
      return
    }
    // A quick click on a held gem: remind them it's press-and-hold
    if (!holding) {
      setHint(true)
      window.clearTimeout(hintTimer.current)
      hintTimer.current = window.setTimeout(() => setHint(false), 1600)
    }
  }

  const handleClick = () => {
    if (suppressClick.current) { suppressClick.current = false; return }
    activate()
  }

  // Space/Enter are handled here rather than by the button's own click, so holding works
  const isHoldKey = (key: string) => key === ' ' || key === 'Enter'

  return (
    <>
      <button type="button"
        onClick={handleClick}
        onPointerDown={e => { if (e.button === 0) { suppressClick.current = false; startHold() } }}
        onPointerUp={cancelHold} onPointerLeave={cancelHold} onPointerCancel={cancelHold}
        onKeyDown={e => {
          if (!isHoldKey(e.key)) return
          e.preventDefault()
          if (!e.repeat) { suppressClick.current = false; startHold() }
        }}
        onKeyUp={e => {
          if (!isHoldKey(e.key)) return
          e.preventDefault()
          cancelHold()
          if (suppressClick.current) suppressClick.current = false
          else activate()
        }}
        onContextMenu={e => { if (held) e.preventDefault() }}  // a long press on touch screens
        aria-label={held ? 'Inspiration held. Press and hold to spend it.' : 'Gain Inspiration'}
        style={{ '--hold': `${HOLD_MS}ms` } as CSSProperties}
        className={`w-full flex items-center gap-3 rounded-lg border-2 px-3 py-2.5 mb-4 text-left select-none transition-colors [touch-action:manipulation] ${
          holding ? 'inspire-holding border-amber-400 bg-amber-100'
            : held ? 'border-amber-300 bg-amber-50'
            : 'border-dashed border-parchment-300 hover:border-amber-300 hover:bg-parchment-50'
        }`}>
        <span className={`relative w-14 h-14 shrink-0 flex items-center justify-center${hint ? ' inspire-hint' : ''}`}>
          {/* The ring fills while the gem is held down */}
          {held && (
            <svg className="absolute inset-0 -rotate-90" viewBox="0 0 56 56" aria-hidden>
              <circle cx="28" cy="28" r={RING_R} className="inspire-ring-track" />
              <circle cx="28" cy="28" r={RING_R} className="inspire-ring"
                style={{
                  strokeDasharray: RING_C,
                  strokeDashoffset: holding ? 0 : RING_C,
                  transition: holding ? `stroke-dashoffset ${HOLD_MS}ms linear` : 'stroke-dashoffset 0.25s ease-out',
                }} />
            </svg>
          )}
          <span ref={gemRef}
            className={`inspire-gem ${held ? 'inspire-gem-held' : 'inspire-socket'}${held && justGained ? ' inspire-gem-gain' : ''}`}
            onAnimationEnd={e => { if (e.animationName === 'inspire-gain') setJustGained(false) }} />
        </span>
        <span className="flex-1 min-w-0">
          <span className={`block text-sm font-bold ${held ? 'text-amber-700' : 'text-parchment-600'}`}>
            {held ? 'Inspired' : 'Inspiration'}
          </span>
          <span className="block text-[11px] text-parchment-500 leading-snug">
            {holding ? 'Keep holding…'
              : hint ? 'Press and hold the gem to spend it.'
              : held ? 'Hold to spend it for advantage on one attack, save or check.'
              : 'Not held. Click when your DM awards it.'}
          </span>
        </span>
        {held && (
          <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 border border-amber-300 rounded-full px-2 py-0.5 shrink-0">Hold</span>
        )}
        <span className="sr-only" aria-live="polite">{announce}</span>
      </button>
      {charge && createPortal(
        <div className="inspire-charge-screen" aria-hidden
          style={{ '--x': `${charge.x}px`, '--y': `${charge.y}px`, '--hold': `${HOLD_MS}ms` } as CSSProperties} />,
        document.body,
      )}
      {burst && createPortal(
        <InspirationBurst key={burst.id} x={burst.x} y={burst.y} onDone={() => setBurst(null)} />,
        document.body,
      )}
    </>
  )
}

/** The whole window glows gold from the gem: light rays, flying sparks and "Inspired!" */
function InspirationBurst({ x, y, onDone }: { x: number; y: number; onDone: () => void }) {
  const doneRef = useRef(onDone)
  doneRef.current = onDone
  useEffect(() => {
    const t = window.setTimeout(() => doneRef.current(), BURST_MS)
    return () => window.clearTimeout(t)
  }, [])

  const sparks = useMemo(() => Array.from({ length: 22 }, (_, i) => {
    const angle = (i / 22) * Math.PI * 2 + (Math.random() - 0.5) * 0.5
    const dist = 160 + Math.random() * 260
    return {
      '--dx': `${Math.cos(angle) * dist}px`,
      '--dy': `${Math.sin(angle) * dist}px`,
      '--s': `${10 + Math.random() * 10}px`,
      animationDelay: `${Math.round(Math.random() * 140)}ms`,
    } as CSSProperties
  }), [])

  return (
    <div className="inspire-burst" style={{ '--x': `${x}px`, '--y': `${y}px` } as CSSProperties} aria-hidden>
      <div className="inspire-burst-glow" />
      <div className="inspire-burst-rays" />
      {sparks.map((style, i) => <span key={i} className="inspire-spark" style={style} />)}
      <div className="inspire-burst-word gold-leaf">Inspired!</div>
    </div>
  )
}
