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

// Two columns on a phone, so names like "Constitution" fit (written out in full for Tailwind)
const GRID_COLS: Record<number, string> = { 2: 'grid-cols-2', 3: 'grid-cols-2 sm:grid-cols-3', 4: 'grid-cols-2 sm:grid-cols-4' }

/** Chip/button grid for small fixed-option selects (abilities, alignment, etc.) */
export function InlinePicker({ options, value, onChange, columns = 3, allowDeselect = true }: InlinePickerProps) {
  return (
    <div className={`grid gap-1.5 ${GRID_COLS[columns] ?? ''}`}
      style={GRID_COLS[columns] ? undefined : { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {options.map(opt => {
        const selected = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => { if (!selected || allowDeselect) onChange(selected ? '' : opt.value) }}
            className={`text-left px-2.5 py-1.5 rounded border text-sm transition-colors min-w-0 ${
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
