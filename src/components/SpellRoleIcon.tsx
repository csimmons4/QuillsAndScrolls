// The small mark at the start of a spell row: what the spell mostly does, in a tinted circle.
import type { SpellRole } from '../routes/sheet/helpers'

export function SpellRoleIcon({ role, className }: { role: SpellRole; className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden>
      {role === 'damage' && <path d="M8 1.4L9.2 5L12.7 3.3L11 6.8L14.6 8L11 9.2L12.7 12.7L9.2 11L8 14.6L6.8 11L3.3 12.7L5 9.2L1.4 8L5 6.8L3.3 3.3L6.8 5z" fill="currentColor" />}
      {role === 'heal' && <path d="M8 13.6S2 10.2 2 6.1a3 3 0 0 1 6-1 3 3 0 0 1 6 1c0 4.1-6 7.5-6 7.5z" fill="currentColor" />}
      {role === 'control' && <path d="M8 7.5a1 1 0 0 1 2 0a2 2 0 0 1-4 0a3 3 0 0 1 6 0a4 4 0 0 1-8 0" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />}
      {role === 'ward' && <path d="M8 1.8l5 2v4c0 3.2-2.2 5.3-5 6.4-2.8-1.1-5-3.2-5-6.4v-4z" fill="currentColor" />}
      {role === 'utility' && <path d="M8 2c.7 3.6 2.4 5.3 6 6-3.6.7-5.3 2.4-6 6-.7-3.6-2.4-5.3-6-6 3.6-.7 5.3-2.4 6-6z" fill="currentColor" />}
    </svg>
  )
}
