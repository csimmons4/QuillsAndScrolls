interface Option {
  value: string
  label: string
  sub?: string
}

interface InlinePickerProps {
  options: Option[]
  value: string
  onChange: (v: string) => void
  columns?: number
  /** If false, clicking the selected option does nothing (it stays selected). Default: true */
  allowDeselect?: boolean
}

/** Chip/button grid for small fixed-option selects (abilities, alignment, etc.) */
export function InlinePicker({ options, value, onChange, columns = 3, allowDeselect = true }: InlinePickerProps) {
  return (
    <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
      {options.map(opt => {
        const selected = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => { if (!selected || allowDeselect) onChange(selected ? '' : opt.value) }}
            className={`text-left px-2.5 py-1.5 rounded border text-sm transition-colors ${
              selected
                ? 'border-parchment-600 bg-parchment-50 font-semibold'
                : 'border-parchment-200 hover:border-parchment-400'
            }`}
          >
            <span className="text-parchment-900">{opt.label}</span>
            {opt.sub && <span className="text-xs text-parchment-400 ml-1.5">{opt.sub}</span>}
          </button>
        )
      })}
    </div>
  )
}
