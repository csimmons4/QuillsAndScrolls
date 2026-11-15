import type { CSSProperties } from 'react'

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]

/**
 * A number whose digits roll like an odometer when it changes. Each digit is a 0–9
 * strip slid into place; columns are keyed from the right so existing digits animate
 * as the number grows. Style it via `digitClassName` (e.g. the purse's gold leaf).
 * Each character gets its position as `--i`, so an effect can sweep across them.
 */
export function RollingNumber({ value, digitClassName = '' }: { value: number; digitClassName?: string }) {
  const chars = value.toLocaleString().split('')
  return (
    <span className="inline-flex leading-none tabular-nums" aria-label={value.toLocaleString()} role="img">
      {/* Zero-width hidden digit: gives the number a real text baseline (the clipped digit
          boxes would put it at their bottom edge), so a unit beside it lines up */}
      <span aria-hidden className="invisible w-0">0</span>
      {chars.map((ch, i) => {
        const fromRight = chars.length - i
        if (!/\d/.test(ch)) return <span key={`sep-${fromRight}`} aria-hidden className={digitClassName} style={{ '--i': i } as CSSProperties}>{ch}</span>
        return (
          <span key={`digit-${fromRight}`} aria-hidden className="relative inline-block overflow-hidden" style={{ height: '1em', width: '0.6em' }}>
            <span className={`odometer-strip absolute inset-x-0 top-0 flex flex-col ${digitClassName}`}
              style={{ transform: `translateY(-${Number(ch)}em)`, '--i': i } as CSSProperties}>
              {DIGITS.map(n => <span key={n} className="block text-center" style={{ height: '1em', lineHeight: '1em' }}>{n}</span>)}
            </span>
          </span>
        )
      })}
    </span>
  )
}
