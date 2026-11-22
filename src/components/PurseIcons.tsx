// Small fantasy icons for the coin purse. All draw in currentColor so the caller sets the tone.
import type { Coin } from '../character/currency'

type IconProps = { className?: string }

/** The old alchemists' mark for each coin's metal, struck on the coin. */
export const COIN_MARK: Record<Coin, string> = {
  cp: 'Venus, the mark for copper',
  sp: 'the Moon, the mark for silver',
  ep: 'Jupiter, the old mark for electrum',
  gp: 'the Sun, the mark for gold',
  pp: 'the Sun and Moon joined, the mark for platinum',
}

export function CoinEmblem({ coin, className }: IconProps & { coin: Coin }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {coin === 'cp' && <><circle cx="12" cy="8.5" r="5" /><path d="M12 13.5v8M8.5 18h7" /></>}
      {coin === 'sp' && <path d="M15 3a9 9 0 1 0 6 15.5A7.5 7.5 0 0 1 15 3z" fill="currentColor" stroke="none" />}
      {coin === 'ep' && <path d="M5 8.5c0-3.4 5.6-4.4 6.6-1 .9 3-2.4 6.4-6.6 9.6h14M15.5 9.5v12" />}
      {coin === 'gp' && <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none" /></>}
      {coin === 'pp' && <><circle cx="14.5" cy="12" r="5.5" /><circle cx="14.5" cy="12" r="1.6" fill="currentColor" stroke="none" /><path d="M9 3.5a8.5 8.5 0 0 0 0 17" /></>}
    </svg>
  )
}

/** A drawstring coin pouch. */
export function PouchIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M8.5 2.5h7l-1.8 3.2h-3.4z" />
      <path d="M10.4 6.6C6.2 8.2 4 12 4 15.3 4 19 7.6 21.5 12 21.5s8-2.5 8-6.2c0-3.3-2.2-7.1-6.4-8.7z" />
      <path d="M9.6 6.2h4.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

/** A merchant's balance scale. */
export function ScaleIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3.5v16.5M7.5 20h9M4.5 6.5h15" />
      <path d="M4.5 6.5L2 13h5zM19.5 6.5L17 13h5z" />
      <path d="M2 13a2.5 2.5 0 0 0 5 0M17 13a2.5 2.5 0 0 0 5 0" fill="currentColor" />
      <circle cx="12" cy="3.5" r="1.2" fill="currentColor" />
    </svg>
  )
}

/** A writing quill. */
export function QuillIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M20.5 2.5c-6.5 1-10.6 5-12.6 10.4l-1.4 4.2 1 1 4.2-1.5c5.3-2 9.4-6.3 10.3-12.6z" />
      <path d="M7.5 16.5l-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}
