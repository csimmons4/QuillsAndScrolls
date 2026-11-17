import { Character } from '../../character/model'
import { Board, CampaignBoardManager } from './CampaignBoard'
import { useSheet } from './SheetContext'

/** The Notes tab: the campaign corkboard */
export function NotesTab() {
  const {
    content,
    char,
    patch,
  } = useSheet()
  const bg = content.backgrounds.find(b => b.slug === char.backgroundSlug)
  const bgSuggestions: Record<string, string[]> = {
    personalityTraits: bg?.personalityTraits ?? [],
    ideals: bg?.ideals ?? [],
    bonds: bg?.bonds ?? [],
    flaws: bg?.flaws ?? [],
  }
  const charSnap = char
  function Suggestions({ fieldKey }: { fieldKey: keyof Character }) {
    const items = bgSuggestions[fieldKey as string] ?? []
    if (items.length === 0 || !charSnap) return null
    return (
      <div className="mt-1.5">
        <p className="text-[10px] text-parchment-400 uppercase tracking-wide font-semibold mb-1">
          {bg?.name} suggestions — click to add
        </p>
        <div className="flex flex-wrap gap-1">
          {items.map((item, i) => (
            <button key={i} type="button"
              className="text-xs bg-parchment-100 text-parchment-500 hover:bg-amber-50 hover:text-amber-800 border border-parchment-200 hover:border-amber-300 rounded px-2 py-0.5 text-left transition-colors"
              onClick={() => {
                const current = (charSnap[fieldKey] as string) ?? ''
                if (!current.includes(item)) {
                  patch({ [fieldKey]: current ? `${current}\n${item}` : item } as Partial<Character>)
                }
              }}
            >{item.length > 80 ? item.slice(0, 80) + '…' : item}</button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">

      {/* ── Evidence Board (first) ── */}
      <CampaignBoardManager
        boards={char.campaignBoard?.boards ?? []}
        activeBoard={char.campaignBoard?.activeBoard ?? ''}
        onChange={(boards, activeBoard) => patch({ campaignBoard: { boards, activeBoard } })}
      />

      {/* ── Personality ── */}
      <div className="card">
        <h2 className="text-sm font-bold text-parchment-700 uppercase tracking-wider mb-4">Personality</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {([
            { key: 'personalityTraits', label: 'Traits', color: 'border-l-amber-400', desc: 'How do you carry yourself? What quirks define you?' },
            { key: 'ideals',            label: 'Ideals', color: 'border-l-violet-400', desc: 'What principles do you believe in above all else?' },
            { key: 'bonds',             label: 'Bonds',  color: 'border-l-blue-400',  desc: 'Who or what do you care most deeply about?' },
            { key: 'flaws',             label: 'Flaws',  color: 'border-l-red-400',   desc: 'What weakness or vice might be your undoing?' },
          ] as const).map(({ key, label, color, desc }) => (
            <div key={key} className={`border-l-[3px] pl-3 ${color}`}>
              <label className="text-xs font-bold text-parchment-700 uppercase tracking-wide block mb-0.5">{label}</label>
              <p className="text-[10px] text-parchment-400 mb-1.5 italic">{desc}</p>
              <textarea
                className="input text-sm w-full"
                rows={3}
                placeholder={`Your ${label.toLowerCase()}…`}
                value={char[key] ?? ''}
                onChange={e => patch({ [key]: e.target.value })}
              />
              <Suggestions fieldKey={key} />
            </div>
          ))}
        </div>
      </div>

      {/* ── Appearance ── */}
      <div className="card">
        <h2 className="text-sm font-bold text-parchment-700 uppercase tracking-wider mb-4">Appearance</h2>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-4">
          {([
            { key: 'age',    label: 'Age'    },
            { key: 'height', label: 'Height' },
            { key: 'weight', label: 'Weight' },
            { key: 'eyes',   label: 'Eyes'   },
            { key: 'skin',   label: 'Skin'   },
            { key: 'hair',   label: 'Hair'   },
          ] as const).map(({ key, label }) => (
            <div key={key}>
              <label className="text-[10px] font-bold text-parchment-500 uppercase tracking-wide block mb-1">{label}</label>
              <input
                className="input text-sm w-full"
                placeholder="—"
                value={char[key] ?? ''}
                onChange={e => patch({ [key]: e.target.value })}
              />
            </div>
          ))}
        </div>
        <div>
          <label className="text-[10px] font-bold text-parchment-500 uppercase tracking-wide block mb-1">Alignment</label>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {['Lawful Good','Neutral Good','Chaotic Good','Lawful Neutral','True Neutral','Chaotic Neutral','Lawful Evil','Neutral Evil','Chaotic Evil','Unaligned'].map(a => (
              <button key={a} type="button"
                onClick={() => patch({ alignment: char.alignment === a ? '' : a })}
                className={`text-xs px-2.5 py-1 rounded border transition-colors ${
                  char.alignment === a
                    ? 'bg-parchment-700 text-parchment-100 border-parchment-700'
                    : 'bg-parchment-50 text-parchment-600 border-parchment-200 hover:border-parchment-400'
                }`}
              >{a}</button>
            ))}
          </div>
          <label className="text-[10px] font-bold text-parchment-500 uppercase tracking-wide block mb-1">Description</label>
          <textarea
            className="input text-sm w-full"
            rows={3}
            placeholder="Describe your character's appearance…"
            value={char.appearance ?? ''}
            onChange={e => patch({ appearance: e.target.value })}
          />
        </div>
      </div>

      {/* ── Backstory ── */}
      <div className="card">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-sm font-bold text-parchment-700 uppercase tracking-wider">Backstory</h2>
          {bg && <span className="text-xs text-parchment-400">{bg.name}</span>}
        </div>
        <textarea
          className="input text-sm w-full"
          rows={8}
          placeholder="Where do you come from? What shaped who you are? What drives you forward?"
          value={char.backstory ?? ''}
          onChange={e => patch({ backstory: e.target.value })}
        />
      </div>


    </div>
  )
}
