import { useState, useEffect } from 'react'
import { HomebrewStore } from '../storage/localStore'
import { loadHomebrewFromDisk, saveHomebrewEntry, deleteHomebrewEntry, importHomebrewStore, HomebrewCategory } from '../storage/charApi'
import { exportHomebrew, importHomebrew } from '../storage/ioFile'
import { useContent } from '../content/ContentProvider'

type Category = 'items' | 'spells' | 'feats' | 'races' | 'classes' | 'backgrounds'

const CATEGORY_LABELS: Record<Category, string> = {
  items: 'Items', spells: 'Spells', feats: 'Feats', races: 'Races', classes: 'Classes', backgrounds: 'Backgrounds',
}

const SKILLS = [
  'acrobatics','animal-handling','arcana','athletics','deception',
  'history','insight','intimidation','investigation','medicine',
  'nature','perception','performance','persuasion','religion',
  'sleight-of-hand','stealth','survival',
] as const
type Skill = typeof SKILLS[number]
const SKILL_LABELS: Record<Skill, string> = {
  'acrobatics': 'Acrobatics', 'animal-handling': 'Animal Handling', 'arcana': 'Arcana',
  'athletics': 'Athletics', 'deception': 'Deception', 'history': 'History',
  'insight': 'Insight', 'intimidation': 'Intimidation', 'investigation': 'Investigation',
  'medicine': 'Medicine', 'nature': 'Nature', 'perception': 'Perception',
  'performance': 'Performance', 'persuasion': 'Persuasion', 'religion': 'Religion',
  'sleight-of-hand': 'Sleight of Hand', 'stealth': 'Stealth', 'survival': 'Survival',
}

const RARITIES = ['Common', 'Uncommon', 'Rare', 'Very Rare', 'Legendary', 'Artifact']
const ITEM_TYPES = ['Wondrous Item', 'Weapon', 'Armor', 'Ring', 'Rod', 'Staff', 'Wand', 'Potion', 'Scroll', 'Shield', 'Ammunition', 'Gear']
const DAMAGE_TYPES = ['acid','bludgeoning','cold','fire','force','lightning','necrotic','piercing','poison','psychic','radiant','slashing','thunder']
const SCHOOLS = ['Abjuration','Conjuration','Divination','Enchantment','Evocation','Illusion','Necromancy','Transmutation']
const SPELL_LEVELS = ['Cantrip (0)','1st','2nd','3rd','4th','5th','6th','7th','8th','9th']
const ABILITY_KEYS = ['str','dex','con','int','wis','cha'] as const
const ABILITY_LABELS: Record<string, string> = { str:'STR', dex:'DEX', con:'CON', int:'INT', wis:'WIS', cha:'CHA' }
const SIZES = ['Tiny','Small','Medium','Large','Huge','Gargantuan']
const HIT_DIES = ['4','6','8','10','12']
const SAVE_KEYS = ['str','dex','con','int','wis','cha']
const CLASS_SLUGS = ['artificer','barbarian','bard','cleric','druid','fighter','monk','paladin','ranger','rogue','sorcerer','warlock','wizard']

function autoSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

// ─── Shared UI primitives ──────────────────────────────────────────────────

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {hint && <p className="text-[11px] text-parchment-400 mb-1">{hint}</p>}
      {children}
    </div>
  )
}

function Section({ title, open, onToggle, children }: { title: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="border border-parchment-200 rounded-lg overflow-hidden">
      <button type="button" onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2 bg-parchment-50 hover:bg-parchment-100 text-left">
        <span className="text-xs font-bold text-parchment-700 uppercase tracking-wider">{title}</span>
        <span className="text-parchment-400 text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && <div className="px-3 py-3 space-y-3">{children}</div>}
    </div>
  )
}

function NumInput({ value, onChange, placeholder, min, max }: { value: string; onChange: (v: string) => void; placeholder?: string; min?: number; max?: number }) {
  return (
    <input type="number" className="input w-24 text-sm" value={value} min={min} max={max}
      placeholder={placeholder ?? '0'} onChange={e => onChange(e.target.value)} />
  )
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span className="text-sm text-parchment-700">{label}</span>
    </label>
  )
}

function SkillPicker({ label, selected, onChange, disabledSkills }: {
  label: string; selected: string[]; onChange: (v: string[]) => void; disabledSkills?: string[]
}) {
  const toggle = (s: string) => {
    onChange(selected.includes(s) ? selected.filter(x => x !== s) : [...selected, s])
  }
  return (
    <div>
      <label className="label">{label}</label>
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 mt-1">
        {SKILLS.map(s => {
          const disabled = disabledSkills?.includes(s)
          return (
            <label key={s} className={`flex items-center gap-1.5 text-sm cursor-pointer ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}>
              <input type="checkbox" disabled={disabled} checked={selected.includes(s)}
                onChange={() => !disabled && toggle(s)} />
              <span>{SKILL_LABELS[s]}</span>
            </label>
          )
        })}
      </div>
    </div>
  )
}

// ─── Item Form ─────────────────────────────────────────────────────────────

interface ItemFormState {
  slug: string; name: string; type: string; rarity: string; attunement: boolean
  description: string; cost: string; weight: string
  // weapon
  showWeaponStats: boolean
  wsDamageDie: string; wsDamageType: string
  wsFinesse: boolean; wsRanged: boolean; wsTwoHanded: boolean; wsLight: boolean; wsVersatile: string
  // armor
  showArmorStats: boolean
  asAcBase: string; asType: string; asStealthDisadvantage: boolean; asMinStrength: string
  // passive bonuses
  acBonus: string; savingThrowBonus: string; abilityCheckBonus: string
  spellDCBonus: string; spellAttackBonus: string
  // ability score mods
  abBonusStr: string; abBonusDex: string; abBonusCon: string
  abBonusInt: string; abBonusWis: string; abBonusCha: string
  abOverrideStr: string; abOverrideDex: string; abOverrideCon: string
  abOverrideInt: string; abOverrideWis: string; abOverrideCha: string
  // granted abilities
  grantedSkillProficiencies: string[]; grantedSkillExpertise: string[]
  grantedResistances: string; grantedImmunities: string; grantedConditionImmunities: string
}

function emptyItemForm(): ItemFormState {
  return {
    slug: '', name: '', type: 'Wondrous Item', rarity: 'Common', attunement: false,
    description: '', cost: '', weight: '',
    showWeaponStats: false,
    wsDamageDie: '1d6', wsDamageType: 'slashing',
    wsFinesse: false, wsRanged: false, wsTwoHanded: false, wsLight: false, wsVersatile: '',
    showArmorStats: false,
    asAcBase: '', asType: 'light', asStealthDisadvantage: false, asMinStrength: '',
    acBonus: '', savingThrowBonus: '', abilityCheckBonus: '', spellDCBonus: '', spellAttackBonus: '',
    abBonusStr:'',abBonusDex:'',abBonusCon:'',abBonusInt:'',abBonusWis:'',abBonusCha:'',
    abOverrideStr:'',abOverrideDex:'',abOverrideCon:'',abOverrideInt:'',abOverrideWis:'',abOverrideCha:'',
    grantedSkillProficiencies: [], grantedSkillExpertise: [],
    grantedResistances: '', grantedImmunities: '', grantedConditionImmunities: '',
  }
}

function deserializeItem(entry: Record<string, unknown>): ItemFormState {
  const ws = entry.weaponStats as Record<string, unknown> | undefined
  const as_ = entry.armorStats as Record<string, unknown> | undefined
  const abBonus = (entry.abilityScoreBonus as Record<string, number>) ?? {}
  const abOverride = (entry.abilityScoreOverride as Record<string, number>) ?? {}
  const s = (k: unknown) => String(k ?? '')
  return {
    slug: s(entry.slug), name: s(entry.name), type: s(entry.type) || 'Wondrous Item',
    rarity: s(entry.rarity) || 'Common', attunement: Boolean(entry.attunement),
    description: s(entry.description), cost: s(entry.cost ?? ''), weight: s(entry.weight ?? ''),
    showWeaponStats: !!ws,
    wsDamageDie: s(ws?.damageDie ?? '1d6'), wsDamageType: s(ws?.damageType ?? 'slashing'),
    wsFinesse: Boolean(ws?.finesse), wsRanged: Boolean(ws?.ranged),
    wsTwoHanded: Boolean(ws?.twoHanded), wsLight: Boolean(ws?.light), wsVersatile: s(ws?.versatile ?? ''),
    showArmorStats: !!as_,
    asAcBase: s(as_?.acBase ?? ''), asType: s(as_?.type ?? 'light'),
    asStealthDisadvantage: Boolean(as_?.stealthDisadvantage), asMinStrength: s(as_?.minStrength ?? ''),
    acBonus: s(entry.acBonus ?? ''), savingThrowBonus: s(entry.savingThrowBonus ?? ''),
    abilityCheckBonus: s(entry.abilityCheckBonus ?? ''),
    spellDCBonus: s(entry.spellDCBonus ?? ''), spellAttackBonus: s(entry.spellAttackBonus ?? ''),
    abBonusStr: s(abBonus.str ?? ''), abBonusDex: s(abBonus.dex ?? ''), abBonusCon: s(abBonus.con ?? ''),
    abBonusInt: s(abBonus.int ?? ''), abBonusWis: s(abBonus.wis ?? ''), abBonusCha: s(abBonus.cha ?? ''),
    abOverrideStr: s(abOverride.str ?? ''), abOverrideDex: s(abOverride.dex ?? ''), abOverrideCon: s(abOverride.con ?? ''),
    abOverrideInt: s(abOverride.int ?? ''), abOverrideWis: s(abOverride.wis ?? ''), abOverrideCha: s(abOverride.cha ?? ''),
    grantedSkillProficiencies: (entry.grantedSkillProficiencies as string[]) ?? [],
    grantedSkillExpertise: (entry.grantedSkillExpertise as string[]) ?? [],
    grantedResistances: ((entry.grantedResistances as string[]) ?? []).join(', '),
    grantedImmunities: ((entry.grantedImmunities as string[]) ?? []).join(', '),
    grantedConditionImmunities: ((entry.grantedConditionImmunities as string[]) ?? []).join(', '),
  }
}

function serializeItem(f: ItemFormState): Record<string, unknown> {
  const slug = f.slug || autoSlug(f.name)
  const n = (s: string) => { const v = parseInt(s); return isNaN(v) ? undefined : v }
  const entry: Record<string, unknown> = {
    slug, name: f.name, type: f.type, rarity: f.rarity, attunement: f.attunement,
    description: f.description, source: { site: 'homebrew', license: 'homebrew', url: '' },
  }
  if (f.cost) entry.cost = f.cost
  if (f.weight) entry.weight = parseFloat(f.weight) || undefined
  if (f.showWeaponStats && f.wsDamageDie && f.wsDamageType) {
    const ws: Record<string, unknown> = { damageDie: f.wsDamageDie, damageType: f.wsDamageType }
    if (f.wsFinesse) ws.finesse = true
    if (f.wsRanged) ws.ranged = true
    if (f.wsTwoHanded) ws.twoHanded = true
    if (f.wsLight) ws.light = true
    if (f.wsVersatile) ws.versatile = f.wsVersatile
    entry.weaponStats = ws
  }
  if (f.showArmorStats && f.asAcBase) {
    const as_: Record<string, unknown> = { acBase: parseInt(f.asAcBase) || 10, type: f.asType }
    if (f.asStealthDisadvantage) as_.stealthDisadvantage = true
    if (f.asMinStrength) as_.minStrength = parseInt(f.asMinStrength)
    entry.armorStats = as_
  }
  if (n(f.acBonus)) entry.acBonus = n(f.acBonus)
  if (n(f.savingThrowBonus)) entry.savingThrowBonus = n(f.savingThrowBonus)
  if (n(f.abilityCheckBonus)) entry.abilityCheckBonus = n(f.abilityCheckBonus)
  if (n(f.spellDCBonus)) entry.spellDCBonus = n(f.spellDCBonus)
  if (n(f.spellAttackBonus)) entry.spellAttackBonus = n(f.spellAttackBonus)
  const abBonus: Record<string, number> = {}
  const abOverride: Record<string, number> = {}
  const bMap = { str: f.abBonusStr, dex: f.abBonusDex, con: f.abBonusCon, int: f.abBonusInt, wis: f.abBonusWis, cha: f.abBonusCha }
  const oMap = { str: f.abOverrideStr, dex: f.abOverrideDex, con: f.abOverrideCon, int: f.abOverrideInt, wis: f.abOverrideWis, cha: f.abOverrideCha }
  for (const [k, v] of Object.entries(bMap)) { const x = n(v); if (x !== undefined) abBonus[k] = x }
  for (const [k, v] of Object.entries(oMap)) { const x = n(v); if (x !== undefined) abOverride[k] = x }
  if (Object.keys(abBonus).length) entry.abilityScoreBonus = abBonus
  if (Object.keys(abOverride).length) entry.abilityScoreOverride = abOverride
  if (f.grantedSkillProficiencies.length) entry.grantedSkillProficiencies = f.grantedSkillProficiencies
  if (f.grantedSkillExpertise.length) entry.grantedSkillExpertise = f.grantedSkillExpertise
  const csv = (s: string) => s.split(',').map(x => x.trim()).filter(Boolean)
  if (f.grantedResistances) entry.grantedResistances = csv(f.grantedResistances)
  if (f.grantedImmunities) entry.grantedImmunities = csv(f.grantedImmunities)
  if (f.grantedConditionImmunities) entry.grantedConditionImmunities = csv(f.grantedConditionImmunities)
  return entry
}

function ItemForm({ initial, onSave, onCancel }: { initial?: Record<string, unknown>; onSave: (e: Record<string, unknown>) => void; onCancel?: () => void }) {
  const [f, setF] = useState<ItemFormState>(initial ? deserializeItem(initial) : emptyItemForm())
  const [sections, setSections] = useState({ weapon: false, armor: false, bonuses: false, granted: false })
  const up = (k: keyof ItemFormState, v: unknown) => setF(prev => ({ ...prev, [k]: v }))
  const sec = (k: keyof typeof sections) => setSections(s => ({ ...s, [k]: !s[k] }))

  const abBonusKeys = { str: 'abBonusStr', dex: 'abBonusDex', con: 'abBonusCon', int: 'abBonusInt', wis: 'abBonusWis', cha: 'abBonusCha' } as const
  const abOverrideKeys = { str: 'abOverrideStr', dex: 'abOverrideDex', con: 'abOverrideCon', int: 'abOverrideInt', wis: 'abOverrideWis', cha: 'abOverrideCha' } as const

  return (
    <div className="space-y-3">
      {/* Basic info */}
      <Field label="Name">
        <input className="input" value={f.name} onChange={e => {
          const name = e.target.value
          setF(prev => ({ ...prev, name, slug: prev.slug || autoSlug(name) }))
        }} />
      </Field>
      <Field label="Slug" hint="Auto-generated from name — edit to override">
        <input className="input font-mono text-sm" value={f.slug} onChange={e => up('slug', e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Type">
          <select className="input" value={f.type} onChange={e => up('type', e.target.value)}>
            {ITEM_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Rarity">
          <select className="input" value={f.rarity} onChange={e => up('rarity', e.target.value)}>
            {RARITIES.map(r => <option key={r}>{r}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Cost (e.g. 500 gp)">
          <input className="input" value={f.cost} onChange={e => up('cost', e.target.value)} />
        </Field>
        <Field label="Weight (lbs)">
          <input type="number" className="input" min={0} value={f.weight} onChange={e => up('weight', e.target.value)} />
        </Field>
      </div>
      <Toggle checked={f.attunement} onChange={v => up('attunement', v)} label="Requires Attunement" />
      <Field label="Description">
        <textarea className="input min-h-[80px]" value={f.description} onChange={e => up('description', e.target.value)} />
      </Field>

      {/* Weapon Stats */}
      <Section title="⚔️ Weapon Stats" open={sections.weapon} onToggle={() => sec('weapon')}>
        <Toggle checked={f.showWeaponStats} onChange={v => up('showWeaponStats', v)} label="This item has weapon stats" />
        {f.showWeaponStats && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Damage Die (e.g. 1d8)">
                <input className="input" value={f.wsDamageDie} onChange={e => up('wsDamageDie', e.target.value)} placeholder="1d6" />
              </Field>
              <Field label="Damage Type">
                <select className="input" value={f.wsDamageType} onChange={e => up('wsDamageType', e.target.value)}>
                  {DAMAGE_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Versatile Die (e.g. 1d10, leave blank if not versatile)">
              <input className="input" value={f.wsVersatile} onChange={e => up('wsVersatile', e.target.value)} placeholder="1d10" />
            </Field>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              <Toggle checked={f.wsFinesse} onChange={v => up('wsFinesse', v)} label="Finesse" />
              <Toggle checked={f.wsRanged} onChange={v => up('wsRanged', v)} label="Ranged" />
              <Toggle checked={f.wsTwoHanded} onChange={v => up('wsTwoHanded', v)} label="Two-Handed" />
              <Toggle checked={f.wsLight} onChange={v => up('wsLight', v)} label="Light" />
            </div>
          </>
        )}
      </Section>

      {/* Armor Stats */}
      <Section title="🛡️ Armor Stats" open={sections.armor} onToggle={() => sec('armor')}>
        <Toggle checked={f.showArmorStats} onChange={v => up('showArmorStats', v)} label="This item has armor stats" />
        {f.showArmorStats && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Base AC">
                <NumInput value={f.asAcBase} onChange={v => up('asAcBase', v)} placeholder="13" min={1} max={30} />
              </Field>
              <Field label="Armor Type">
                <select className="input" value={f.asType} onChange={e => up('asType', e.target.value)}>
                  <option value="light">Light</option>
                  <option value="medium">Medium</option>
                  <option value="heavy">Heavy</option>
                  <option value="shield">Shield</option>
                </select>
              </Field>
            </div>
            <Field label="Min Strength (leave blank if none)">
              <NumInput value={f.asMinStrength} onChange={v => up('asMinStrength', v)} placeholder="—" min={1} max={30} />
            </Field>
            <Toggle checked={f.asStealthDisadvantage} onChange={v => up('asStealthDisadvantage', v)} label="Stealth Disadvantage" />
          </>
        )}
      </Section>

      {/* Passive Bonuses */}
      <Section title="✨ Passive Bonuses (while equipped)" open={sections.bonuses} onToggle={() => sec('bonuses')}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="AC Bonus"><NumInput value={f.acBonus} onChange={v => up('acBonus', v)} /></Field>
          <Field label="All Saving Throws"><NumInput value={f.savingThrowBonus} onChange={v => up('savingThrowBonus', v)} /></Field>
          <Field label="All Ability Checks"><NumInput value={f.abilityCheckBonus} onChange={v => up('abilityCheckBonus', v)} /></Field>
          <Field label="Spell Save DC"><NumInput value={f.spellDCBonus} onChange={v => up('spellDCBonus', v)} /></Field>
          <Field label="Spell Attack Rolls"><NumInput value={f.spellAttackBonus} onChange={v => up('spellAttackBonus', v)} /></Field>
        </div>
        <div>
          <p className="label">Ability Score Bonus (+X, stacks, max 20)</p>
          <div className="grid grid-cols-3 gap-2 mt-1">
            {ABILITY_KEYS.map(k => (
              <label key={k} className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-parchment-600 w-8">{ABILITY_LABELS[k]}</span>
                <NumInput value={(f as unknown as Record<string,string>)[abBonusKeys[k]]}
                  onChange={v => up(abBonusKeys[k] as keyof ItemFormState, v)} />
              </label>
            ))}
          </div>
        </div>
        <div>
          <p className="label">Ability Score Override (sets score to X if higher)</p>
          <div className="grid grid-cols-3 gap-2 mt-1">
            {ABILITY_KEYS.map(k => (
              <label key={k} className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-parchment-600 w-8">{ABILITY_LABELS[k]}</span>
                <NumInput value={(f as unknown as Record<string,string>)[abOverrideKeys[k]]}
                  onChange={v => up(abOverrideKeys[k] as keyof ItemFormState, v)} placeholder="—" min={1} max={30} />
              </label>
            ))}
          </div>
        </div>
      </Section>

      {/* Granted Abilities */}
      <Section title="🎯 Granted Abilities (while equipped)" open={sections.granted} onToggle={() => sec('granted')}>
        <SkillPicker label="Skill Proficiencies" selected={f.grantedSkillProficiencies}
          onChange={v => up('grantedSkillProficiencies', v)} />
        <SkillPicker label="Skill Expertise (double proficiency)"
          selected={f.grantedSkillExpertise}
          onChange={v => up('grantedSkillExpertise', v)}
          disabledSkills={f.grantedSkillProficiencies.length === 0 ? undefined : undefined} />
        <Field label="Damage/Condition Resistances" hint="Comma-separated, e.g. fire, cold">
          <input className="input" value={f.grantedResistances} onChange={e => up('grantedResistances', e.target.value)} />
        </Field>
        <Field label="Damage Immunities" hint="Comma-separated">
          <input className="input" value={f.grantedImmunities} onChange={e => up('grantedImmunities', e.target.value)} />
        </Field>
        <Field label="Condition Immunities" hint="e.g. charmed, frightened">
          <input className="input" value={f.grantedConditionImmunities} onChange={e => up('grantedConditionImmunities', e.target.value)} />
        </Field>
      </Section>

      <div className="flex gap-2 pt-1">
        <button className="btn-primary flex-1" onClick={() => onSave(serializeItem(f))}>
          {initial ? 'Update' : 'Add Item'}
        </button>
        {onCancel && <button className="btn-secondary" onClick={onCancel}>Cancel</button>}
      </div>
    </div>
  )
}

// ─── Spell Form ───────────────────────────────────────────────────────────

interface SpellFormState {
  slug: string; name: string; level: string; school: string
  castingTime: string; castingTimeCustom: string
  range: string; rangeCustom: string
  compV: boolean; compS: boolean; compM: boolean; material: string
  duration: string; durationCustom: string
  concentration: boolean; ritual: boolean
  classes: string[]
  description: string; higherLevels: string
}

function emptySpellForm(): SpellFormState {
  return {
    slug: '', name: '', level: '0', school: 'Evocation',
    castingTime: '1 action', castingTimeCustom: '',
    range: 'Self', rangeCustom: '',
    compV: true, compS: true, compM: false, material: '',
    duration: 'Instantaneous', durationCustom: '',
    concentration: false, ritual: false,
    classes: [],
    description: '', higherLevels: '',
  }
}

function deserializeSpell(entry: Record<string, unknown>): SpellFormState {
  const s = (k: unknown) => String(k ?? '')
  const compStr = s(entry.components ?? 'V, S')
  const classes = Array.isArray(entry.classes) ? entry.classes.map(String) : []
  const CAST_OPTS = ['1 action', '1 bonus action', '1 reaction', '1 minute', '10 minutes', '1 hour']
  const RANGE_OPTS = ['Self', 'Touch', '30 feet', '60 feet', '120 feet', '150 feet', '300 feet', '1 mile', 'Unlimited']
  const DUR_OPTS = ['Instantaneous', '1 round', '1 minute', '10 minutes', '1 hour', '8 hours', '24 hours', 'Until dispelled']
  const ct = s(entry.castingTime ?? '1 action')
  const rng = s(entry.range ?? 'Self')
  const dur = s(entry.duration ?? 'Instantaneous')
  return {
    slug: s(entry.slug), name: s(entry.name),
    level: s(entry.level ?? '0'), school: s(entry.school ?? 'Evocation'),
    castingTime: CAST_OPTS.includes(ct) ? ct : 'custom', castingTimeCustom: CAST_OPTS.includes(ct) ? '' : ct,
    range: RANGE_OPTS.includes(rng) ? rng : 'custom', rangeCustom: RANGE_OPTS.includes(rng) ? '' : rng,
    compV: compStr.includes('V'), compS: compStr.includes('S'), compM: compStr.includes('M'),
    material: s(entry.material ?? ''),
    duration: DUR_OPTS.includes(dur) ? dur : 'custom', durationCustom: DUR_OPTS.includes(dur) ? '' : dur,
    concentration: Boolean(entry.concentration), ritual: Boolean(entry.ritual),
    classes,
    description: s(entry.description), higherLevels: s(entry.higherLevels ?? ''),
  }
}

function serializeSpell(f: SpellFormState): Record<string, unknown> {
  const slug = f.slug || autoSlug(f.name)
  const ct = f.castingTime === 'custom' ? f.castingTimeCustom : f.castingTime
  const rng = f.range === 'custom' ? f.rangeCustom : f.range
  const dur = f.duration === 'custom' ? f.durationCustom : f.duration
  const comps = [f.compV && 'V', f.compS && 'S', f.compM && 'M'].filter(Boolean).join(', ')
  const entry: Record<string, unknown> = {
    slug, name: f.name, level: parseInt(f.level) || 0, school: f.school,
    castingTime: ct, range: rng, components: comps + (f.compM && f.material ? ` (${f.material})` : ''),
    duration: dur, concentration: f.concentration, ritual: f.ritual,
    classes: f.classes,
    description: f.description,
    source: { site: 'homebrew', license: 'homebrew', url: '' },
  }
  if (f.higherLevels) entry.higherLevels = f.higherLevels
  if (f.compM && f.material) entry.material = f.material
  return entry
}

function SpellForm({ initial, onSave, onCancel }: { initial?: Record<string, unknown>; onSave: (e: Record<string, unknown>) => void; onCancel?: () => void }) {
  const [f, setF] = useState<SpellFormState>(initial ? deserializeSpell(initial) : emptySpellForm())
  const up = (k: keyof SpellFormState, v: unknown) => setF(prev => ({ ...prev, [k]: v }))

  const CAST_OPTS = ['1 action', '1 bonus action', '1 reaction', '1 minute', '10 minutes', '1 hour', 'custom']
  const RANGE_OPTS = ['Self', 'Touch', '30 feet', '60 feet', '120 feet', '150 feet', '300 feet', '1 mile', 'Unlimited', 'custom']
  const DUR_OPTS = ['Instantaneous', '1 round', '1 minute', '10 minutes', '1 hour', '8 hours', '24 hours', 'Until dispelled', 'custom']

  const toggleClass = (c: string) => up('classes', f.classes.includes(c) ? f.classes.filter(x => x !== c) : [...f.classes, c])

  return (
    <div className="space-y-3">
      <Field label="Name">
        <input className="input" value={f.name} onChange={e => {
          const name = e.target.value
          setF(prev => ({ ...prev, name, slug: prev.slug || autoSlug(name) }))
        }} />
      </Field>
      <Field label="Slug">
        <input className="input font-mono text-sm" value={f.slug} onChange={e => up('slug', e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Level">
          <select className="input" value={f.level} onChange={e => up('level', e.target.value)}>
            {SPELL_LEVELS.map((l, i) => <option key={i} value={String(i)}>{l}</option>)}
          </select>
        </Field>
        <Field label="School">
          <select className="input" value={f.school} onChange={e => up('school', e.target.value)}>
            {SCHOOLS.map(s => <option key={s}>{s}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Casting Time">
        <select className="input mb-1" value={f.castingTime} onChange={e => up('castingTime', e.target.value)}>
          {CAST_OPTS.map(o => <option key={o} value={o}>{o === 'custom' ? 'Custom…' : o}</option>)}
        </select>
        {f.castingTime === 'custom' && <input className="input" placeholder="e.g. 8 hours" value={f.castingTimeCustom} onChange={e => up('castingTimeCustom', e.target.value)} />}
      </Field>
      <Field label="Range">
        <select className="input mb-1" value={f.range} onChange={e => up('range', e.target.value)}>
          {RANGE_OPTS.map(o => <option key={o} value={o}>{o === 'custom' ? 'Custom…' : o}</option>)}
        </select>
        {f.range === 'custom' && <input className="input" placeholder="e.g. 500 feet" value={f.rangeCustom} onChange={e => up('rangeCustom', e.target.value)} />}
      </Field>
      <Field label="Components">
        <div className="flex items-center gap-4 mb-2">
          <Toggle checked={f.compV} onChange={v => up('compV', v)} label="Verbal (V)" />
          <Toggle checked={f.compS} onChange={v => up('compS', v)} label="Somatic (S)" />
          <Toggle checked={f.compM} onChange={v => up('compM', v)} label="Material (M)" />
        </div>
        {f.compM && <input className="input" placeholder="Material components (e.g. a pinch of sulfur)" value={f.material} onChange={e => up('material', e.target.value)} />}
      </Field>
      <Field label="Duration">
        <select className="input mb-1" value={f.duration} onChange={e => up('duration', e.target.value)}>
          {DUR_OPTS.map(o => <option key={o} value={o}>{o === 'custom' ? 'Custom…' : o}</option>)}
        </select>
        {f.duration === 'custom' && <input className="input" placeholder="e.g. Until dispelled or triggered" value={f.durationCustom} onChange={e => up('durationCustom', e.target.value)} />}
      </Field>
      <div className="flex gap-6">
        <Toggle checked={f.concentration} onChange={v => up('concentration', v)} label="Concentration" />
        <Toggle checked={f.ritual} onChange={v => up('ritual', v)} label="Ritual" />
      </div>
      <Field label="Available to Classes">
        <div className="grid grid-cols-3 gap-x-3 gap-y-0.5 mt-1">
          {CLASS_SLUGS.map(c => (
            <label key={c} className="flex items-center gap-1.5 text-sm cursor-pointer capitalize">
              <input type="checkbox" checked={f.classes.includes(c)} onChange={() => toggleClass(c)} />
              {c}
            </label>
          ))}
        </div>
      </Field>
      <Field label="Description">
        <textarea className="input min-h-[100px]" value={f.description} onChange={e => up('description', e.target.value)} />
      </Field>
      <Field label="At Higher Levels (optional)">
        <textarea className="input min-h-[60px]" value={f.higherLevels} onChange={e => up('higherLevels', e.target.value)} />
      </Field>
      <div className="flex gap-2 pt-1">
        <button className="btn-primary flex-1" onClick={() => onSave(serializeSpell(f))}>
          {initial ? 'Update' : 'Add Spell'}
        </button>
        {onCancel && <button className="btn-secondary" onClick={onCancel}>Cancel</button>}
      </div>
    </div>
  )
}

// ─── Feat Form ────────────────────────────────────────────────────────────

interface FeatFormState {
  slug: string; name: string; prerequisite: string; description: string
  grantedSkillProficiencies: string[]; grantedSkillExpertise: string[]
  abilityScoreIncrease: string
}

function emptyFeatForm(): FeatFormState {
  return { slug: '', name: '', prerequisite: '', description: '', grantedSkillProficiencies: [], grantedSkillExpertise: [], abilityScoreIncrease: '' }
}

function deserializeFeat(entry: Record<string, unknown>): FeatFormState {
  const s = (k: unknown) => String(k ?? '')
  return {
    slug: s(entry.slug), name: s(entry.name), prerequisite: s(entry.prerequisite ?? ''),
    description: s(entry.description),
    grantedSkillProficiencies: (entry.grantedSkillProficiencies as string[]) ?? [],
    grantedSkillExpertise: (entry.grantedSkillExpertise as string[]) ?? [],
    abilityScoreIncrease: s(entry.abilityScoreIncrease ?? ''),
  }
}

function serializeFeat(f: FeatFormState): Record<string, unknown> {
  const slug = f.slug || autoSlug(f.name)
  const entry: Record<string, unknown> = {
    slug, name: f.name, description: f.description,
    source: { site: 'homebrew', license: 'homebrew', url: '' },
  }
  if (f.prerequisite) entry.prerequisite = f.prerequisite
  if (f.grantedSkillProficiencies.length) entry.grantedSkillProficiencies = f.grantedSkillProficiencies
  if (f.grantedSkillExpertise.length) entry.grantedSkillExpertise = f.grantedSkillExpertise
  if (f.abilityScoreIncrease) entry.abilityScoreIncrease = f.abilityScoreIncrease
  return entry
}

function FeatForm({ initial, onSave, onCancel }: { initial?: Record<string, unknown>; onSave: (e: Record<string, unknown>) => void; onCancel?: () => void }) {
  const [f, setF] = useState<FeatFormState>(initial ? deserializeFeat(initial) : emptyFeatForm())
  const [sections, setSections] = useState({ skills: false })
  const up = (k: keyof FeatFormState, v: unknown) => setF(prev => ({ ...prev, [k]: v }))
  return (
    <div className="space-y-3">
      <Field label="Name">
        <input className="input" value={f.name} onChange={e => {
          const name = e.target.value
          setF(prev => ({ ...prev, name, slug: prev.slug || autoSlug(name) }))
        }} />
      </Field>
      <Field label="Slug">
        <input className="input font-mono text-sm" value={f.slug} onChange={e => up('slug', e.target.value)} />
      </Field>
      <Field label="Prerequisite (optional)">
        <input className="input" value={f.prerequisite} onChange={e => up('prerequisite', e.target.value)} placeholder="e.g. Strength 13 or higher" />
      </Field>
      <Field label="Ability Score Increase (optional)" hint="e.g. +1 STR, or choose any">
        <input className="input" value={f.abilityScoreIncrease} onChange={e => up('abilityScoreIncrease', e.target.value)} placeholder="e.g. +2 STR or +1 to any two" />
      </Field>
      <Field label="Description">
        <textarea className="input min-h-[100px]" value={f.description} onChange={e => up('description', e.target.value)} />
      </Field>
      <Section title="🎯 Granted Skill Proficiencies" open={sections.skills} onToggle={() => setSections(s => ({ ...s, skills: !s.skills }))}>
        <SkillPicker label="Proficiencies" selected={f.grantedSkillProficiencies} onChange={v => up('grantedSkillProficiencies', v)} />
        <SkillPicker label="Expertise" selected={f.grantedSkillExpertise} onChange={v => up('grantedSkillExpertise', v)} />
      </Section>
      <div className="flex gap-2 pt-1">
        <button className="btn-primary flex-1" onClick={() => onSave(serializeFeat(f))}>
          {initial ? 'Update' : 'Add Feat'}
        </button>
        {onCancel && <button className="btn-secondary" onClick={onCancel}>Cancel</button>}
      </div>
    </div>
  )
}

// ─── Race Form ────────────────────────────────────────────────────────────

interface RaceFormState {
  slug: string; name: string; size: string; speed: string
  str: string; dex: string; con: string; int: string; wis: string; cha: string
  traits: string; languages: string
  grantedSkills: string[]; resistances: string
}

function emptyRaceForm(): RaceFormState {
  return { slug:'',name:'',size:'Medium',speed:'30',str:'',dex:'',con:'',int:'',wis:'',cha:'',traits:'',languages:'',grantedSkills:[],resistances:'' }
}

function deserializeRace(entry: Record<string, unknown>): RaceFormState {
  const s = (k: unknown) => String(k ?? '')
  const ab = (entry.abilityBonuses as Record<string,number>) ?? {}
  return {
    slug: s(entry.slug), name: s(entry.name), size: s(entry.size ?? 'Medium'), speed: s(entry.speed ?? '30'),
    str: s(ab.str ?? ''), dex: s(ab.dex ?? ''), con: s(ab.con ?? ''),
    int: s(ab.int ?? ''), wis: s(ab.wis ?? ''), cha: s(ab.cha ?? ''),
    traits: (Array.isArray(entry.traits) ? entry.traits.join(', ') : s(entry.traits ?? '')),
    languages: (Array.isArray(entry.languages) ? entry.languages.join(', ') : s(entry.languages ?? '')),
    grantedSkills: (entry.grantedSkills as string[]) ?? [],
    resistances: (Array.isArray(entry.resistances) ? entry.resistances.join(', ') : s(entry.resistances ?? '')),
  }
}

function serializeRace(f: RaceFormState): Record<string, unknown> {
  const slug = f.slug || autoSlug(f.name)
  const n = (s: string) => parseInt(s) || undefined
  const abilityBonuses: Record<string,number> = {}
  const ab = { str:f.str,dex:f.dex,con:f.con,int:f.int,wis:f.wis,cha:f.cha }
  for (const [k,v] of Object.entries(ab)) { const x = n(v); if (x !== undefined) abilityBonuses[k] = x }
  const csv = (s: string) => s.split(',').map(x => x.trim()).filter(Boolean)
  return {
    slug, name: f.name, size: f.size, speed: parseInt(f.speed) || 30,
    abilityBonuses,
    traits: csv(f.traits), languages: csv(f.languages),
    grantedSkills: f.grantedSkills,
    resistances: f.resistances ? csv(f.resistances) : undefined,
    subraces: [], proficiencies: [],
    source: { site: 'homebrew', license: 'homebrew', url: '' },
  }
}

function RaceForm({ initial, onSave, onCancel }: { initial?: Record<string, unknown>; onSave: (e: Record<string, unknown>) => void; onCancel?: () => void }) {
  const [f, setF] = useState<RaceFormState>(initial ? deserializeRace(initial) : emptyRaceForm())
  const up = (k: keyof RaceFormState, v: unknown) => setF(prev => ({ ...prev, [k]: v }))
  const abKeys = ['str','dex','con','int','wis','cha'] as const
  return (
    <div className="space-y-3">
      <Field label="Name">
        <input className="input" value={f.name} onChange={e => {
          const name = e.target.value
          setF(prev => ({ ...prev, name, slug: prev.slug || autoSlug(name) }))
        }} />
      </Field>
      <Field label="Slug">
        <input className="input font-mono text-sm" value={f.slug} onChange={e => up('slug', e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Size">
          <select className="input" value={f.size} onChange={e => up('size', e.target.value)}>
            {SIZES.map(s => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Speed (ft)">
          <NumInput value={f.speed} onChange={v => up('speed', v)} placeholder="30" min={0} />
        </Field>
      </div>
      <div>
        <p className="label">Ability Score Bonuses</p>
        <div className="grid grid-cols-3 gap-2 mt-1">
          {abKeys.map(k => (
            <label key={k} className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-parchment-600 w-8">{ABILITY_LABELS[k]}</span>
              <NumInput value={(f as unknown as Record<string,string>)[k]} onChange={v => up(k as keyof RaceFormState, v)} />
            </label>
          ))}
        </div>
      </div>
      <SkillPicker label="Granted Skill Proficiencies" selected={f.grantedSkills} onChange={v => up('grantedSkills', v)} />
      <Field label="Damage Resistances" hint="Comma-separated, e.g. fire, necrotic">
        <input className="input" value={f.resistances} onChange={e => up('resistances', e.target.value)} />
      </Field>
      <Field label="Racial Traits" hint="Comma-separated trait names">
        <input className="input" value={f.traits} onChange={e => up('traits', e.target.value)} />
      </Field>
      <Field label="Languages" hint="Comma-separated">
        <input className="input" value={f.languages} onChange={e => up('languages', e.target.value)} placeholder="Common, Elvish" />
      </Field>
      <div className="flex gap-2 pt-1">
        <button className="btn-primary flex-1" onClick={() => onSave(serializeRace(f))}>
          {initial ? 'Update' : 'Add Race'}
        </button>
        {onCancel && <button className="btn-secondary" onClick={onCancel}>Cancel</button>}
      </div>
    </div>
  )
}

// ─── Class Form ───────────────────────────────────────────────────────────

interface ClassFormState {
  slug: string; name: string; hitDie: string; spellcastingAbility: string
  saves: string[]; armorProfs: string; weaponProfs: string; toolProfs: string
  skillChoices: string; numSkillChoices: string
}

function emptyClassForm(): ClassFormState {
  return { slug:'',name:'',hitDie:'8',spellcastingAbility:'',saves:[],armorProfs:'',weaponProfs:'',toolProfs:'',skillChoices:'',numSkillChoices:'2' }
}

function deserializeClass(entry: Record<string, unknown>): ClassFormState {
  const s = (k: unknown) => String(k ?? '')
  const arr = (k: unknown) => Array.isArray(k) ? k.map(String) : []
  return {
    slug: s(entry.slug), name: s(entry.name), hitDie: s(entry.hitDie ?? '8'),
    spellcastingAbility: s(entry.spellcastingAbility ?? ''),
    saves: arr(entry.saveProficiencies),
    armorProfs: arr(entry.armorProficiencies).join(', '),
    weaponProfs: arr(entry.weaponProficiencies).join(', '),
    toolProfs: arr(entry.toolProficiencies).join(', '),
    skillChoices: arr(entry.skillChoices).join(', '),
    numSkillChoices: s(entry.numSkillChoices ?? '2'),
  }
}

function serializeClass(f: ClassFormState): Record<string, unknown> {
  const slug = f.slug || autoSlug(f.name)
  const csv = (s: string) => s.split(',').map(x => x.trim()).filter(Boolean)
  return {
    slug, name: f.name, hitDie: parseInt(f.hitDie) || 8,
    spellcastingAbility: f.spellcastingAbility || undefined,
    saveProficiencies: f.saves,
    armorProficiencies: csv(f.armorProfs),
    weaponProficiencies: csv(f.weaponProfs),
    toolProficiencies: csv(f.toolProfs),
    skillChoices: csv(f.skillChoices),
    numSkillChoices: parseInt(f.numSkillChoices) || 2,
    startingEquipment: [], features: [], subclasses: [],
    source: { site: 'homebrew', license: 'homebrew', url: '' },
  }
}

function ClassForm({ initial, onSave, onCancel }: { initial?: Record<string, unknown>; onSave: (e: Record<string, unknown>) => void; onCancel?: () => void }) {
  const [f, setF] = useState<ClassFormState>(initial ? deserializeClass(initial) : emptyClassForm())
  const up = (k: keyof ClassFormState, v: unknown) => setF(prev => ({ ...prev, [k]: v }))
  const toggleSave = (k: string) => up('saves', f.saves.includes(k) ? f.saves.filter(s => s !== k) : [...f.saves, k])
  return (
    <div className="space-y-3">
      <Field label="Name">
        <input className="input" value={f.name} onChange={e => {
          const name = e.target.value
          setF(prev => ({ ...prev, name, slug: prev.slug || autoSlug(name) }))
        }} />
      </Field>
      <Field label="Slug">
        <input className="input font-mono text-sm" value={f.slug} onChange={e => up('slug', e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Hit Die">
          <select className="input" value={f.hitDie} onChange={e => up('hitDie', e.target.value)}>
            {HIT_DIES.map(d => <option key={d} value={d}>d{d}</option>)}
          </select>
        </Field>
        <Field label="Spellcasting Ability">
          <select className="input" value={f.spellcastingAbility} onChange={e => up('spellcastingAbility', e.target.value)}>
            <option value="">None</option>
            <option value="int">Intelligence</option>
            <option value="wis">Wisdom</option>
            <option value="cha">Charisma</option>
          </select>
        </Field>
      </div>
      <div>
        <p className="label">Saving Throw Proficiencies</p>
        <div className="flex gap-3 flex-wrap mt-1">
          {SAVE_KEYS.map(k => (
            <label key={k} className="flex items-center gap-1.5 text-sm cursor-pointer uppercase">
              <input type="checkbox" checked={f.saves.includes(k)} onChange={() => toggleSave(k)} />
              {k}
            </label>
          ))}
        </div>
      </div>
      <Field label="Armor Proficiencies" hint="Comma-separated, e.g. light, medium, shields">
        <input className="input" value={f.armorProfs} onChange={e => up('armorProfs', e.target.value)} />
      </Field>
      <Field label="Weapon Proficiencies" hint="Comma-separated, e.g. simple weapons, martial weapons">
        <input className="input" value={f.weaponProfs} onChange={e => up('weaponProfs', e.target.value)} />
      </Field>
      <Field label="Tool Proficiencies (optional)">
        <input className="input" value={f.toolProfs} onChange={e => up('toolProfs', e.target.value)} placeholder="e.g. thieves' tools" />
      </Field>
      <Field label="Eligible Skill Choices" hint="Comma-separated list of skills players can choose from">
        <input className="input" value={f.skillChoices} onChange={e => up('skillChoices', e.target.value)} />
      </Field>
      <Field label="Number of Skill Choices">
        <NumInput value={f.numSkillChoices} onChange={v => up('numSkillChoices', v)} min={1} max={6} />
      </Field>
      <div className="flex gap-2 pt-1">
        <button className="btn-primary flex-1" onClick={() => onSave(serializeClass(f))}>
          {initial ? 'Update' : 'Add Class'}
        </button>
        {onCancel && <button className="btn-secondary" onClick={onCancel}>Cancel</button>}
      </div>
    </div>
  )
}

// ─── Background Form ──────────────────────────────────────────────────────

interface BgFormState {
  slug: string; name: string
  skillProficiencies: string[]
  toolProficiencies: string
  languages: string
  featureName: string; featureDescription: string
  startingGold: string
  startingEquipment: string
}

function emptyBgForm(): BgFormState {
  return { slug:'',name:'',skillProficiencies:[],toolProficiencies:'',languages:'0',featureName:'',featureDescription:'',startingGold:'',startingEquipment:'' }
}

function deserializeBg(entry: Record<string, unknown>): BgFormState {
  const s = (k: unknown) => String(k ?? '')
  const feature = (entry.feature as { name?: string; description?: string }) ?? {}
  return {
    slug: s(entry.slug), name: s(entry.name),
    skillProficiencies: (entry.skillProficiencies as string[]) ?? [],
    toolProficiencies: (Array.isArray(entry.toolProficiencies) ? (entry.toolProficiencies as string[]).join(', ') : s(entry.toolProficiencies ?? '')),
    languages: s(entry.languages ?? '0'),
    featureName: s(feature.name ?? ''),
    featureDescription: s(feature.description ?? ''),
    startingGold: s(entry.startingGold ?? ''),
    startingEquipment: (Array.isArray(entry.startingEquipment) ? (entry.startingEquipment as string[]).join(', ') : s(entry.startingEquipment ?? '')),
  }
}

function serializeBg(f: BgFormState): Record<string, unknown> {
  const slug = f.slug || autoSlug(f.name)
  const csv = (s: string) => s.split(',').map(x => x.trim()).filter(Boolean)
  return {
    slug, name: f.name,
    skillProficiencies: f.skillProficiencies,
    toolProficiencies: csv(f.toolProficiencies),
    languages: parseInt(f.languages) || 0,
    feature: { name: f.featureName, description: f.featureDescription },
    startingGold: parseFloat(f.startingGold) || 0,
    startingEquipment: csv(f.startingEquipment),
    source: { site: 'homebrew', license: 'homebrew', url: '' },
  }
}

function BackgroundForm({ initial, onSave, onCancel }: { initial?: Record<string, unknown>; onSave: (e: Record<string, unknown>) => void; onCancel?: () => void }) {
  const [f, setF] = useState<BgFormState>(initial ? deserializeBg(initial) : emptyBgForm())
  const up = (k: keyof BgFormState, v: unknown) => setF(prev => ({ ...prev, [k]: v }))
  return (
    <div className="space-y-3">
      <Field label="Name">
        <input className="input" value={f.name} onChange={e => {
          const name = e.target.value
          setF(prev => ({ ...prev, name, slug: prev.slug || autoSlug(name) }))
        }} />
      </Field>
      <Field label="Slug">
        <input className="input font-mono text-sm" value={f.slug} onChange={e => up('slug', e.target.value)} />
      </Field>
      <SkillPicker label="Skill Proficiencies (pick 2)" selected={f.skillProficiencies} onChange={v => up('skillProficiencies', v)} />
      <Field label="Tool Proficiencies" hint="Comma-separated (e.g. Thieves' tools, One musical instrument)">
        <input className="input" value={f.toolProficiencies} onChange={e => up('toolProficiencies', e.target.value)} placeholder="e.g. Disguise kit, Forgery kit" />
      </Field>
      <Field label="Bonus Languages">
        <select className="input w-24 text-sm" value={f.languages} onChange={e => up('languages', e.target.value)}>
          <option value="0">0</option>
          <option value="1">1</option>
          <option value="2">2</option>
        </select>
      </Field>
      <Field label="Feature Name">
        <input className="input" value={f.featureName} onChange={e => up('featureName', e.target.value)} placeholder="e.g. Researcher" />
      </Field>
      <Field label="Feature Description">
        <textarea className="input min-h-[80px]" value={f.featureDescription} onChange={e => up('featureDescription', e.target.value)} />
      </Field>
      <Field label="Starting Gold (gp)">
        <input type="number" className="input w-24 text-sm" value={f.startingGold} min={0} onChange={e => up('startingGold', e.target.value)} placeholder="0" />
      </Field>
      <Field label="Starting Equipment" hint="Comma-separated item names">
        <textarea className="input min-h-[60px]" value={f.startingEquipment} onChange={e => up('startingEquipment', e.target.value)} placeholder="e.g. Ink bottle, Quill, Small knife" />
      </Field>
      <div className="flex gap-2 pt-1">
        <button className="btn-primary flex-1" onClick={() => onSave(serializeBg(f))}>
          {initial ? 'Update' : 'Add Background'}
        </button>
        {onCancel && <button className="btn-secondary" onClick={onCancel}>Cancel</button>}
      </div>
    </div>
  )
}

// ─── Entry List ───────────────────────────────────────────────────────────

function EntryList({ category, entries, onEdit, onDelete }: {
  category: Category
  entries: Record<string, unknown>[]
  onEdit: (idx: number) => void
  onDelete: (idx: number) => void
}) {
  const rarityColor = (r: string) => {
    const rl = String(r ?? '').toLowerCase()
    if (rl === 'uncommon') return 'text-green-600'
    if (rl === 'rare') return 'text-blue-600'
    if (rl === 'very rare') return 'text-violet-600'
    if (rl === 'legendary') return 'text-amber-600'
    if (rl === 'artifact') return 'text-orange-600'
    return 'text-parchment-400'
  }
  if (entries.length === 0) return <p className="text-parchment-400 text-sm italic">None yet.</p>
  return (
    <div className="space-y-2">
      {entries.map((entry, idx) => (
        <div key={idx} className="flex items-center gap-2 p-3 rounded-lg border border-parchment-200 hover:bg-parchment-50">
          <div className="flex-1 min-w-0">
            <div className="font-medium text-parchment-900 truncate">{String(entry.name ?? '(unnamed)')}</div>
            <div className="flex items-center gap-2 mt-0.5">
              {category === 'items' && !!entry.rarity && (
                <span className={`text-[10px] font-bold uppercase ${rarityColor(String(entry.rarity))}`}>{String(entry.rarity)}</span>
              )}
              {category === 'items' && !!entry.type && (
                <span className="text-[10px] text-parchment-400">{String(entry.type)}</span>
              )}
              {category === 'spells' && (
                <span className="text-[10px] text-parchment-400">
                  {entry.level === 0 ? 'Cantrip' : `Level ${entry.level}`} · {String(entry.school ?? '')}
                </span>
              )}
              {category === 'races' && (
                <span className="text-[10px] text-parchment-400">{String(entry.size ?? 'Medium')} · {String(entry.speed ?? 30)} ft</span>
              )}
              {category === 'classes' && (
                <span className="text-[10px] text-parchment-400">d{String(entry.hitDie ?? 8)} hit die</span>
              )}
              {category === 'backgrounds' && (
                <span className="text-[10px] text-parchment-400">
                  {((entry.skillProficiencies as string[]) ?? []).slice(0, 2).join(', ')}
                  {(entry.startingGold as number) > 0 ? ` · ${entry.startingGold} gp` : ''}
                </span>
              )}
              <span className="text-[10px] text-parchment-300 font-mono">{String(entry.slug ?? '')}</span>
            </div>
          </div>
          <button className="btn-secondary text-xs shrink-0" onClick={() => onEdit(idx)}>Edit</button>
          <button className="text-xs text-red-400 hover:text-red-600 transition-colors shrink-0 px-1" onClick={() => onDelete(idx)}>✕</button>
        </div>
      ))}
    </div>
  )
}

// ─── Main Homebrew Component ───────────────────────────────────────────────

export default function Homebrew() {
  const [category, setCategory] = useState<Category>('items')
  const [store, setStore] = useState<HomebrewStore>({ items: [], spells: [], feats: [], races: [], classes: [], backgrounds: [] })
  const [editEntry, setEditEntry] = useState<Record<string, unknown> | null>(null)
  const [editIdx, setEditIdx] = useState<number | null>(null)
  const [error, setError] = useState('')
  const { reload } = useContent()

  useEffect(() => { loadHomebrewFromDisk().then(setStore) }, [])
  useEffect(() => { setEditEntry(null); setEditIdx(null); setError('') }, [category])

  async function refreshStore() {
    const fresh = await loadHomebrewFromDisk()
    setStore(fresh)
    reload()
  }

  async function handleSave(entry: Record<string, unknown>) {
    if (!String(entry.name ?? '').trim()) { setError('Name is required.'); return }
    setError('')
    await saveHomebrewEntry(category as HomebrewCategory, entry)
    await refreshStore()
    setEditEntry(null)
    setEditIdx(null)
  }

  function handleEdit(idx: number) {
    setEditEntry(store[category][idx] as Record<string, unknown>)
    setEditIdx(idx)
  }

  async function handleDelete(idx: number) {
    const entry = store[category][idx] as Record<string, unknown>
    await deleteHomebrewEntry(category as HomebrewCategory, String(entry.slug ?? ''))
    await refreshStore()
    if (editIdx === idx) { setEditEntry(null); setEditIdx(null) }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const data = await importHomebrew(file) as HomebrewStore
      const isSingleEntry = data && !Array.isArray(data) && 'name' in data
      if (isSingleEntry) await saveHomebrewEntry(category as HomebrewCategory, data as unknown as Record<string, unknown>)
      else await importHomebrewStore(data)
      await refreshStore()
    } catch {
      setError('Failed to import — check the file is a valid homebrew entry or pack.')
    }
    e.target.value = ''
  }

  const entries = store[category] as Record<string, unknown>[]

  const formProps = { onSave: handleSave, onCancel: editIdx !== null ? () => { setEditEntry(null); setEditIdx(null) } : undefined }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-parchment-800">Homebrew Editor</h1>
        <div className="flex gap-2">
          <button className="btn-secondary text-sm" onClick={() => exportHomebrew(store)}>Export All</button>
          <label className="btn-secondary text-sm cursor-pointer">
            Import
            <input type="file" accept=".json" className="hidden" onChange={handleImport} />
          </label>
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex gap-4 border-b border-parchment-200 mb-6">
        {(Object.keys(CATEGORY_LABELS) as Category[]).map(cat => (
          <button key={cat} onClick={() => setCategory(cat)}
            className={`pb-2 text-sm font-medium ${category === cat ? 'tab-active' : 'tab-inactive'}`}>
            {CATEGORY_LABELS[cat]} ({(store[cat] as unknown[]).length})
          </button>
        ))}
      </div>

      {error && <div className="mb-4 p-3 rounded bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Form panel */}
        <div className="card">
          <h2 className="section-header mb-4">
            {editIdx !== null ? `Edit ${CATEGORY_LABELS[category]}` : `New ${CATEGORY_LABELS[category]}`}
          </h2>
          {category === 'items' && <ItemForm key={editIdx ?? 'new'} initial={editEntry ?? undefined} {...formProps} />}
          {category === 'spells' && <SpellForm key={editIdx ?? 'new'} initial={editEntry ?? undefined} {...formProps} />}
          {category === 'feats' && <FeatForm key={editIdx ?? 'new'} initial={editEntry ?? undefined} {...formProps} />}
          {category === 'races' && <RaceForm key={editIdx ?? 'new'} initial={editEntry ?? undefined} {...formProps} />}
          {category === 'classes' && <ClassForm key={editIdx ?? 'new'} initial={editEntry ?? undefined} {...formProps} />}
          {category === 'backgrounds' && <BackgroundForm key={editIdx ?? 'new'} initial={editEntry ?? undefined} {...formProps} />}
        </div>

        {/* List panel */}
        <div>
          <h2 className="section-header mb-4">Existing {CATEGORY_LABELS[category]} ({entries.length})</h2>
          <EntryList category={category} entries={entries} onEdit={handleEdit} onDelete={handleDelete} />
        </div>
      </div>

      <p className="mt-8 text-xs text-parchment-400">
        Homebrew is stored on disk and can be exported/imported as JSON to share between devices.
      </p>
    </div>
  )
}
