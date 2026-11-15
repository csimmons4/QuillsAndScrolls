// Line icons for the character sheet header. All draw in currentColor so the caller sets the tone.
import type { ReactNode } from 'react'

type IconProps = { className?: string }

const Line = ({ className, children }: IconProps & { children: ReactNode }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {children}
  </svg>
)

/** Short rest: an hourglass (an hour's breather) */
export function HourglassIcon({ className }: IconProps) {
  return <Line className={className}><path d="M6.5 3h11M6.5 21h11M8 3c0 4.5 8 4.5 8 9s-8 4.5-8 9M16 3c0 4.5-8 4.5-8 9s8 4.5 8 9" /></Line>
}

/** Long rest: a crescent moon */
export function MoonIcon({ className }: IconProps) {
  return <Line className={className}><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" /></Line>
}

/** Level up: an arrow rising through a bar */
export function LevelUpIcon({ className }: IconProps) {
  return <Line className={className}><path d="M12 20V6M6.5 11.5L12 6l5.5 5.5M5 3h14" /></Line>
}

/** Save: a floppy disk */
export function SaveIcon({ className }: IconProps) {
  return <Line className={className}><path d="M5 3h11.5L20 6.5V19a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 1-2zM8 3v5h7V3M7.5 21v-6.5h9V21" /></Line>
}

/** Saved: a check mark */
export function CheckIcon({ className }: IconProps) {
  return <Line className={className}><path d="M5 12.5l4.5 4.5L19 7.5" /></Line>
}

/** Export: an arrow down into a tray */
export function ExportIcon({ className }: IconProps) {
  return <Line className={className}><path d="M12 3.5v11M7.5 10l4.5 4.5 4.5-4.5M4.5 16.5V20h15v-3.5" /></Line>
}
