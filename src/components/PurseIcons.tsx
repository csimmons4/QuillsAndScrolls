// Small fantasy icons for the coin purse. All draw in currentColor so the caller sets the tone.
import type { Coin } from '../character/currency'

type IconProps = { className?: string }

/** The emblem struck on each coin: tower (copper), moon (silver), star (electrum), crown (gold), gem (platinum). */
export function CoinEmblem({ coin, className }: IconProps & { coin: Coin }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      {coin === 'cp' && <path d="M5 21V8h2V5h2v3h2V5h2v3h2V5h2v3h2v13h-5v-5a2 2 0 0 0-4 0v5z" />}
      {coin === 'sp' && <path d="M15 3a9 9 0 1 0 6 15.5A7.5 7.5 0 0 1 15 3z" />}
      {coin === 'ep' && <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z" />}
      {coin === 'gp' && <><path d="M3 17L4.8 7.5l4.4 4L12 4.5l2.8 7 4.4-4L21 17z" /><rect x="3" y="18.5" width="18" height="2.5" rx="0.8" /></>}
      {coin === 'pp' && <><path d="M6.5 3.5h11L22 9.5 12 21 2 9.5z" /><path d="M2 9.5h20M8.5 3.5L12 21l3.5-17.5" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="1" /></>}
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
