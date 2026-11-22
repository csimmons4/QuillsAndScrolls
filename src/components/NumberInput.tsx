import { useState, type InputHTMLAttributes } from 'react'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'min' | 'max'> & {
  value: number
  min: number
  max: number
  onValue: (n: number) => void
}

/** A number box that can be cleared and retyped. Each whole number typed is applied as you type
 *  (above `max` counts as `max`); an empty box or one below `min` isn't, so clearing the hit points
 *  to type a new number never drops the character to 0. Leaving the box shows the saved value again. */
export function NumberInput({ value, min, max, onValue, onBlur, ...rest }: Props) {
  const [draft, setDraft] = useState<string | null>(null)
  return (
    <input {...rest} type="number" inputMode="numeric" min={min} max={max}
      value={draft ?? String(value)}
      onChange={e => {
        const text = e.target.value
        setDraft(text)
        const n = Number(text)
        if (text.trim() !== '' && Number.isInteger(n) && n >= min) onValue(Math.min(max, n))
      }}
      onBlur={e => { setDraft(null); onBlur?.(e) }}
    />
  )
}
