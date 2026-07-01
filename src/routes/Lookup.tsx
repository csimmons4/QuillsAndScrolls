import { useState, useMemo } from 'react'
import { useContent } from '../content/ContentProvider'
import { cleanFeatDesc, FeatEffectBadges } from '../components/FeatPicker'
import type { SpellDef, ItemDef, FeatDef, RaceDef, BackgroundDef, ClassDef } from '../content/loaders'

type Category = 'all' | 'spells' | 'items' | 'feats' | 'races' | 'backgrounds' | 'classes'

const SCHOOL_COLORS: Record<string, string> = {
  abjuration: 'bg-blue-100 text-blue-700',
  conjuration: 'bg-yellow-100 text-yellow-700',
  divination: 'bg-cyan-100 text-cyan-700',
  enchantment: 'bg-pink-100 text-pink-700',
  evocation: 'bg-red-100 text-red-700',
  illusion: 'bg-purple-100 text-purple-700',
  necromancy: 'bg-stone-200 text-stone-700',
  transmutation: 'bg-green-100 text-green-700',
}

const RARITY_COLORS: Record<string, string> = {
  common: 'text-parchment-500',
  uncommon: 'bg-green-100 text-green-700',
  rare: 'bg-blue-100 text-blue-700',
  'very rare': 'bg-purple-100 text-purple-700',
  legendary: 'bg-amber-100 text-amber-700',
  artifact: 'bg-red-100 text-red-700',
}

function Tag({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <span className={`text-xs rounded px-1.5 py-0.5 ${className}`}>{children}</span>
}

function Expandable({ title, meta, children }: { title: string; meta?: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={`rounded border transition-colors ${open ? 'border-parchment-400 shadow-sm' : 'border-parchment-200 hover:border-parchment-400'}`}>
      <button
        type="button"
        className="w-full text-left p-3 flex items-start gap-3"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-semibold text-parchment-900">{title}</span>
            {meta}
          </div>
        </div>
        <span className="text-parchment-400 text-xs shrink-0 mt-0.5">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="px-3 pb-3 border-t border-parchment-100 pt-2">
          {children}
        </div>
      )}
    </div>
  )
}

function SpellCard({ spell }: { spell: SpellDef }) {
  const levelLabel = spell.level === 0 ? 'Cantrip' : `Level ${spell.level}`
  const schoolColor = SCHOOL_COLORS[spell.school?.toLowerCase() ?? ''] ?? 'bg-parchment-100 text-parchment-600'
  const classes = spell.classLists?.length ? spell.classLists : spell.classes
  return (
    <Expandable
      title={spell.name}
      meta={<>
        <Tag className="bg-parchment-100 text-parchment-600">{levelLabel}</Tag>
        <Tag className={schoolColor}>{spell.school}</Tag>
        {spell.ritual && <Tag className="bg-teal-100 text-teal-700">Ritual</Tag>}
        {spell.concentration && <Tag className="bg-orange-100 text-orange-700">Concentration</Tag>}
      </>}
    >
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-xs text-parchment-600 mb-2">
        <div><span className="font-medium text-parchment-800">Casting Time:</span> {spell.castingTime}</div>
        <div><span className="font-medium text-parchment-800">Range:</span> {spell.range}</div>
        <div><span className="font-medium text-parchment-800">Duration:</span> {spell.duration}</div>
        <div className="col-span-2 sm:col-span-3"><span className="font-medium text-parchment-800">Components:</span> {spell.components}</div>
        {classes.length > 0 && (
          <div className="col-span-2 sm:col-span-3">
            <span className="font-medium text-parchment-800">Classes:</span>{' '}
            {classes.map(c => c.charAt(0).toUpperCase() + c.slice(1)).join(', ')}
          </div>
        )}
      </div>
      <p className="text-sm text-parchment-700 leading-relaxed whitespace-pre-line">{spell.description}</p>
      {spell.higherLevels && (
        <p className="text-sm text-parchment-600 mt-2 italic"><span className="font-medium not-italic text-parchment-800">At Higher Levels:</span> {spell.higherLevels}</p>
      )}
    </Expandable>
  )
}

function ItemCard({ item }: { item: ItemDef }) {
  const rarityClass = RARITY_COLORS[item.rarity?.toLowerCase() ?? ''] ?? 'text-parchment-500'
  return (
    <Expandable
      title={item.name}
      meta={<>
        {item.type && <Tag className="bg-parchment-100 text-parchment-600">{item.type}</Tag>}
        {item.rarity && <Tag className={rarityClass.includes('bg-') ? rarityClass : `bg-parchment-50 ${rarityClass}`}>{item.rarity}</Tag>}
        {item.attunement && <Tag className="bg-violet-100 text-violet-700">Attunement</Tag>}
      </>}
    >
      {item.weaponStats && (
        <div className="text-xs bg-red-50 border border-red-100 rounded p-2 mb-2 flex flex-wrap gap-3">
          <span><span className="font-medium">Damage:</span> {item.weaponStats.damage} {item.weaponStats.damageType}</span>
          {item.weaponStats.finesse && <span>Finesse</span>}
          {item.weaponStats.ranged && <span>Ranged</span>}
          {item.weaponStats.versatile && <span>Versatile ({item.weaponStats.versatile})</span>}
          {item.weaponStats.twoHanded && <span>Two-handed</span>}
          {item.weaponStats.light && <span>Light</span>}
        </div>
      )}
      {item.armorStats && (
        <div className="text-xs bg-blue-50 border border-blue-100 rounded p-2 mb-2 flex flex-wrap gap-3">
          <span><span className="font-medium">AC:</span> {item.armorStats.acBase} ({item.armorStats.type})</span>
          {item.armorStats.stealthDisadvantage && <span>Stealth Disadvantage</span>}
          {item.armorStats.minStrength && <span>Min STR {item.armorStats.minStrength}</span>}
        </div>
      )}
      {item.description && <p className="text-sm text-parchment-700 leading-relaxed">{item.description}</p>}
      {!item.description && <p className="text-xs text-parchment-400 italic">No description available.</p>}
    </Expandable>
  )
}

function FeatCard({ feat }: { feat: FeatDef }) {
  const description = cleanFeatDesc(feat.description)
  return (
    <Expandable
      title={feat.name}
      meta={<>
        {feat.prerequisite && <Tag className="bg-amber-100 text-amber-700">Req: {feat.prerequisite}</Tag>}
        <FeatEffectBadges slug={feat.slug} />
      </>}
    >
      {feat.notes && feat.notes.length > 0 && (
        <ul className="text-sm text-parchment-700 list-disc list-inside space-y-0.5 mb-2">
          {feat.notes.map(n => <li key={n}>{n}</li>)}
        </ul>
      )}
      {description
        ? <p className="text-sm text-parchment-700 leading-relaxed">{description}</p>
        : <p className="text-xs text-parchment-400 italic">No description available.</p>
      }
    </Expandable>
  )
}

const ABILITY_LABELS: Record<string, string> = {
  str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA',
}

function RaceCard({ race }: { race: RaceDef }) {
  const bonuses = race.abilityBonuses
    ? Object.entries(race.abilityBonuses).filter(([, v]) => v !== 0).map(([k, v]) => `${ABILITY_LABELS[k] ?? k.toUpperCase()} +${v}`).join(', ')
    : null
  return (
    <Expandable
      title={race.name}
      meta={<>
        {race.category && <Tag className="bg-parchment-100 text-parchment-600">{race.category}</Tag>}
        {bonuses && <Tag className="bg-green-100 text-green-700">{bonuses}</Tag>}
        <Tag className="bg-parchment-50 text-parchment-500">{race.speed}ft</Tag>
      </>}
    >
      {race.traits.length > 0 && (
        <div className="mb-2">
          <div className="text-xs font-medium text-parchment-700 mb-1">Traits</div>
          <div className="flex flex-wrap gap-1">
            {race.traits.map(t => <Tag key={t} className="bg-parchment-100 text-parchment-700">{t}</Tag>)}
          </div>
        </div>
      )}
      {race.resistances && race.resistances.length > 0 && (
        <div className="mb-2">
          <div className="text-xs font-medium text-parchment-700 mb-1">Resistances</div>
          <div className="flex flex-wrap gap-1">
            {race.resistances.map(r => <Tag key={r} className="bg-orange-100 text-orange-700">{r}</Tag>)}
          </div>
        </div>
      )}
      {race.grantedSkills && race.grantedSkills.length > 0 && (
        <div className="mb-2">
          <span className="text-xs font-medium text-parchment-700">Skill Proficiencies: </span>
          <span className="text-xs text-parchment-600">{race.grantedSkills.join(', ')}</span>
        </div>
      )}
      {race.languages.length > 0 && (
        <div className="mb-2">
          <span className="text-xs font-medium text-parchment-700">Languages: </span>
          <span className="text-xs text-parchment-600">{race.languages.join(', ')}</span>
        </div>
      )}
      {race.subraces && race.subraces.length > 0 && (
        <div className="mt-2 space-y-1">
          <div className="text-xs font-medium text-parchment-700">Subraces</div>
          {race.subraces.map(sr => {
            const srBonuses = sr.abilityBonuses
              ? Object.entries(sr.abilityBonuses).filter(([, v]) => v !== 0).map(([k, v]) => `${ABILITY_LABELS[k] ?? k.toUpperCase()} +${v}`).join(', ')
              : null
            return (
              <div key={sr.slug} className="pl-3 border-l-2 border-parchment-200">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-sm font-medium">{sr.name}</span>
                  {srBonuses && <Tag className="bg-green-100 text-green-700">{srBonuses}</Tag>}
                </div>
                {sr.traits.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {sr.traits.map(t => <Tag key={t} className="bg-parchment-100 text-parchment-600">{t}</Tag>)}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </Expandable>
  )
}

function BackgroundCard({ bg }: { bg: BackgroundDef }) {
  return (
    <Expandable
      title={bg.name}
      meta={<>
        {bg.skillProficiencies.length > 0 && (
          <Tag className="bg-blue-100 text-blue-700">{bg.skillProficiencies.join(', ')}</Tag>
        )}
      </>}
    >
      {bg.feature.name && (
        <div className="mb-2">
          <div className="text-xs font-semibold text-parchment-800 mb-0.5">Feature: {bg.feature.name}</div>
          {bg.feature.description && <p className="text-sm text-parchment-700">{bg.feature.description}</p>}
        </div>
      )}
      {bg.toolProficiencies.length > 0 && (
        <div className="text-xs text-parchment-600 mb-1">
          <span className="font-medium text-parchment-800">Tools: </span>{bg.toolProficiencies.join(', ')}
        </div>
      )}
      {bg.languages > 0 && (
        <div className="text-xs text-parchment-600 mb-1">
          <span className="font-medium text-parchment-800">Languages: </span>+{bg.languages} of your choice
        </div>
      )}
    </Expandable>
  )
}

function ClassCard({ cls }: { cls: ClassDef }) {
  return (
    <Expandable
      title={cls.name}
      meta={<>
        <Tag className="bg-parchment-100 text-parchment-600">d{cls.hitDie}</Tag>
        {cls.spellcastingAbility && (
          <Tag className="bg-violet-100 text-violet-700">Spellcasting ({(ABILITY_LABELS[cls.spellcastingAbility] ?? cls.spellcastingAbility).toUpperCase()})</Tag>
        )}
      </>}
    >
      {cls.saveProficiencies.length > 0 && (
        <div className="text-xs text-parchment-600 mb-1">
          <span className="font-medium text-parchment-800">Saving Throws: </span>
          {cls.saveProficiencies.map(s => ABILITY_LABELS[s] ?? s.toUpperCase()).join(', ')}
        </div>
      )}
      {cls.armorProficiencies.length > 0 && (
        <div className="text-xs text-parchment-600 mb-1">
          <span className="font-medium text-parchment-800">Armor: </span>{cls.armorProficiencies.join(', ')}
        </div>
      )}
      {cls.weaponProficiencies.length > 0 && (
        <div className="text-xs text-parchment-600 mb-1">
          <span className="font-medium text-parchment-800">Weapons: </span>{cls.weaponProficiencies.join(', ')}
        </div>
      )}
      {cls.skillChoices.length > 0 && (
        <div className="text-xs text-parchment-600 mb-2">
          <span className="font-medium text-parchment-800">Skills (choose {cls.numSkillChoices}): </span>
          {cls.skillChoices.join(', ')}
        </div>
      )}
      {cls.features.length > 0 && (
        <div className="mt-2 space-y-1">
          <div className="text-xs font-semibold text-parchment-800 mb-1">Class Features</div>
          {cls.features.map(f => (
            <div key={`${f.level}-${f.name}`} className="pl-3 border-l-2 border-parchment-200">
              <div className="flex items-center gap-2">
                <Tag className="bg-parchment-100 text-parchment-500 shrink-0">Lvl {f.level}</Tag>
                <span className="text-sm font-medium text-parchment-800">{f.name}</span>
              </div>
              {f.description && <p className="text-xs text-parchment-600 mt-0.5">{f.description}</p>}
            </div>
          ))}
        </div>
      )}
    </Expandable>
  )
}

const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'spells', label: 'Spells' },
  { id: 'items', label: 'Items' },
  { id: 'feats', label: 'Feats' },
  { id: 'races', label: 'Races' },
  { id: 'backgrounds', label: 'Backgrounds' },
  { id: 'classes', label: 'Classes' },
]

type ResultEntry =
  | { kind: 'spell'; data: SpellDef }
  | { kind: 'item'; data: ItemDef }
  | { kind: 'feat'; data: FeatDef }
  | { kind: 'race'; data: RaceDef }
  | { kind: 'background'; data: BackgroundDef }
  | { kind: 'class'; data: ClassDef }

const KIND_LABEL: Record<string, string> = {
  spell: 'Spell', item: 'Item', feat: 'Feat', race: 'Race', background: 'Background', class: 'Class',
}
const KIND_COLOR: Record<string, string> = {
  spell: 'bg-violet-100 text-violet-700',
  item: 'bg-amber-100 text-amber-700',
  feat: 'bg-green-100 text-green-700',
  race: 'bg-teal-100 text-teal-700',
  background: 'bg-blue-100 text-blue-700',
  class: 'bg-red-100 text-red-700',
}

export default function Lookup() {
  const { spells, items, feats, races, backgrounds, classes, loading } = useContent()
  const [category, setCategory] = useState<Category>('all')
  const [search, setSearch] = useState('')

  const results = useMemo((): ResultEntry[] => {
    const q = search.toLowerCase().trim()
    const matches = (s: string | null | undefined) => Boolean(s?.toLowerCase().includes(q))

    const out: ResultEntry[] = []

    if (category === 'all' || category === 'spells') {
      for (const s of spells) {
        if (!q || matches(s.name) || matches(s.description) || matches(s.school ?? '') || (s.classLists ?? []).some(c => matches(c))) {
          out.push({ kind: 'spell', data: s })
        }
      }
    }
    if (category === 'all' || category === 'items') {
      for (const i of items) {
        if (!q || matches(i.name) || matches(i.description) || matches(i.type) || matches(i.rarity)) {
          out.push({ kind: 'item', data: i })
        }
      }
    }
    if (category === 'all' || category === 'feats') {
      for (const f of feats) {
        if (!q || matches(f.name) || matches(f.description) || matches(f.prerequisite ?? '')) {
          out.push({ kind: 'feat', data: f })
        }
      }
    }
    if (category === 'all' || category === 'races') {
      for (const r of races) {
        if (!q || matches(r.name) || r.traits.some(t => matches(t))) {
          out.push({ kind: 'race', data: r })
        }
      }
    }
    if (category === 'all' || category === 'backgrounds') {
      for (const b of backgrounds) {
        if (!q || matches(b.name) || b.skillProficiencies.some(s => matches(s)) || matches(b.feature.name) || matches(b.feature.description)) {
          out.push({ kind: 'background', data: b })
        }
      }
    }
    if (category === 'all' || category === 'classes') {
      for (const c of classes) {
        if (!q || matches(c.name) || c.features.some(f => matches(f.name) || matches(f.description))) {
          out.push({ kind: 'class', data: c })
        }
      }
    }

    return out
  }, [search, category, spells, items, feats, races, backgrounds, classes])

  const PAGE = 50
  const [page, setPage] = useState(1)
  const shown = results.slice(0, page * PAGE)
  const hasMore = results.length > shown.length

  // Reset page when search/category changes
  const handleSearch = (v: string) => { setSearch(v); setPage(1) }
  const handleCategory = (c: Category) => {
    setCategory(c)
    setSearch('')
    setPage(1)
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-parchment-800">Compendium</h1>
        <span className="text-sm text-parchment-500">{results.length.toLocaleString()} entries</span>
      </div>

      <input
        type="text"
        className="input mb-3"
        placeholder="Search across all content…"
        value={search}
        onChange={e => handleSearch(e.target.value)}
      />

      <div className="flex flex-wrap gap-1.5 mb-4">
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            type="button"
            onClick={() => handleCategory(cat.id)}
            className={`text-xs px-3 py-1 rounded-full border transition-colors font-medium ${
              category === cat.id
                ? 'bg-parchment-800 text-parchment-100 border-parchment-800'
                : 'bg-parchment-50 text-parchment-600 border-parchment-300 hover:border-parchment-500 hover:text-parchment-800'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {loading && <p className="text-parchment-400 text-center py-8">Loading content…</p>}

      <div className="space-y-2">
        {shown.map((entry, i) => {
          const kindBadge = category === 'all'
            ? <span key="kind" className={`text-xs rounded px-1.5 py-0.5 ${KIND_COLOR[entry.kind]}`}>{KIND_LABEL[entry.kind]}</span>
            : null

          if (entry.kind === 'spell') return (
            <div key={`spell-${entry.data.slug}`}>
              {kindBadge && <div className="mb-0.5">{kindBadge}</div>}
              <SpellCard spell={entry.data} />
            </div>
          )
          if (entry.kind === 'item') return (
            <div key={`item-${entry.data.slug}`}>
              {kindBadge && <div className="mb-0.5">{kindBadge}</div>}
              <ItemCard item={entry.data} />
            </div>
          )
          if (entry.kind === 'feat') return (
            <div key={`feat-${entry.data.slug}`}>
              {kindBadge && <div className="mb-0.5">{kindBadge}</div>}
              <FeatCard feat={entry.data} />
            </div>
          )
          if (entry.kind === 'race') return (
            <div key={`race-${entry.data.slug}`}>
              {kindBadge && <div className="mb-0.5">{kindBadge}</div>}
              <RaceCard race={entry.data} />
            </div>
          )
          if (entry.kind === 'background') return (
            <div key={`bg-${entry.data.slug}`}>
              {kindBadge && <div className="mb-0.5">{kindBadge}</div>}
              <BackgroundCard bg={entry.data} />
            </div>
          )
          if (entry.kind === 'class') return (
            <div key={`class-${entry.data.slug}`}>
              {kindBadge && <div className="mb-0.5">{kindBadge}</div>}
              <ClassCard cls={entry.data} />
            </div>
          )
          return null
        })}

        {!loading && results.length === 0 && search && (
          <p className="text-parchment-400 text-center py-8">No results for "{search}"</p>
        )}
        {!loading && results.length === 0 && !search && (
          <p className="text-parchment-400 text-center py-8">
            No content loaded. Run <code className="bg-parchment-100 rounded px-1">npm run scrape</code> first.
          </p>
        )}

        {hasMore && (
          <button
            type="button"
            onClick={() => setPage(p => p + 1)}
            className="w-full py-2 text-sm text-parchment-500 hover:text-parchment-800 border border-parchment-200 hover:border-parchment-400 rounded transition-colors"
          >
            Show more ({results.length - shown.length} remaining)
          </button>
        )}
      </div>
    </div>
  )
}
