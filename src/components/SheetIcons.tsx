// Line icons for the character sheet (header, spell card). All draw in currentColor so the caller sets the tone.
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

/** Spell range: a target */
export function TargetIcon({ className }: IconProps) {
  return <Line className={className}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></Line>
}

/** Spell duration: a clock */
export function ClockIcon({ className }: IconProps) {
  return <Line className={className}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></Line>
}

/** Spell components: a flask */
export function FlaskIcon({ className }: IconProps) {
  return <Line className={className}><path d="M9.5 3h5M10.5 3v6L5 18.5A1.7 1.7 0 0 0 6.5 21h11a1.7 1.7 0 0 0 1.5-2.5L13.5 9V3M7.5 15h9" /></Line>
}

/** An open book (the empty spell panel) */
export function BookIcon({ className }: IconProps) {
  return <Line className={className}><path d="M12 6.5C10 5 7 4.5 3.5 5v13c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5zM12 6.5v13" /></Line>
}

/** Quick find: a magnifying glass */
export function SearchIcon({ className }: IconProps) {
  return <Line className={className}><circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5L20 20" /></Line>
}
