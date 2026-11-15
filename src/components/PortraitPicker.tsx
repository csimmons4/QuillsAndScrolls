import { useRef, useState } from 'react'
import { imageFileToPortrait } from '../storage/portrait'
import { useConfirm } from './ConfirmDialog'

/** The character's portrait: click it to upload or change the picture; hover for a remove button.
 *  With no portrait it shows the character's initials and a camera hint. */
export function PortraitPicker({ name, portrait, onChange, className = 'w-20 h-20' }: {
  name: string
  portrait?: string
  onChange: (portrait: string | undefined) => void
  className?: string
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState('')
  const { askConfirm, confirmDialog } = useConfirm()
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]!.toUpperCase()).join('') || '?'

  const pick = async (file: File | undefined) => {
    if (!file) return
    try {
      onChange(await imageFileToPortrait(file))
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn’t load that image.')
    }
  }

  const remove = async () => {
    if (await askConfirm({ title: 'Remove Portrait', message: `Remove ${name}’s portrait?`, confirmLabel: 'Remove', danger: true })) onChange(undefined)
  }

  return (
    <div className="relative group shrink-0">
      <button type="button" onClick={() => fileRef.current?.click()}
        aria-label={portrait ? `Change ${name}’s portrait` : `Add a portrait for ${name}`}
        title={portrait ? 'Change portrait' : 'Add a portrait'}
        className={`${className} relative block rounded-xl overflow-hidden border-2 border-parchment-300 bg-parchment-100 shadow-sm hover:border-[rgb(var(--accent))] transition-colors`}>
        {portrait ? (
          // Faces are usually near the top, so full-body art still shows the face
          <img src={portrait} alt="" className="w-full h-full object-cover object-top" />
        ) : (
          <span className="w-full h-full flex items-center justify-center text-2xl font-bold text-parchment-400">{initials}</span>
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-white opacity-0 group-hover:opacity-100 transition-opacity">
          <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M4 8h3l1.5-2.5h7L17 8h3v11H4z" /><circle cx="12" cy="13" r="3.5" />
          </svg>
        </span>
      </button>
      {portrait && (
        <button type="button" onClick={remove} aria-label="Remove portrait" title="Remove portrait"
          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-parchment-50 border border-parchment-300 text-[11px] leading-none text-parchment-500 hover:text-red-600 hover:border-red-300 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
        >✕</button>
      )}
      <input ref={fileRef} type="file" accept="image/*" className="hidden"
        onChange={e => { pick(e.target.files?.[0]); e.target.value = '' }} />
      {error && <p className="absolute top-full left-0 mt-1 w-48 text-[11px] text-red-600">{error}</p>}
      {confirmDialog}
    </div>
  )
}
