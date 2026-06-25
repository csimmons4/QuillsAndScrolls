import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { loadAllContent, SpellDef, ItemDef, RaceDef, ClassDef, BackgroundDef, FeatDef, DataMeta } from './loaders'
import { loadHomebrewFromDisk } from '../storage/charApi'
import { mergeSpells, mergeItems, mergeRaces, mergeFeats, mergeBackgrounds, mergeClasses } from './merge'
import { SPELL_OVERLAY } from '../data/spellOverlay'
import { FEAT_OVERLAY } from '../data/featOverlay'
import { ITEM_OVERLAY } from '../data/itemOverlay'
import { RACE_OVERLAY } from '../data/raceOverlay'
import { BACKGROUND_OVERLAY } from '../data/backgroundOverlay'

export interface ContentData {
  spells: SpellDef[]
  items: ItemDef[]
  races: RaceDef[]
  classes: ClassDef[]
  backgrounds: BackgroundDef[]
  feats: FeatDef[]
  meta: DataMeta | null
  loading: boolean
  error: string | null
  reload: () => void
}

const noop = () => {}

const defaultContent: ContentData = {
  spells: [], items: [], races: [], classes: [], backgrounds: [], feats: [],
  meta: null, loading: true, error: null, reload: noop,
}

const ContentContext = createContext<ContentData>(defaultContent)

export function ContentProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<ContentData>(defaultContent)

  async function load() {
    setData(prev => ({ ...prev, loading: true }))
    try {
      const [official, hb] = await Promise.all([loadAllContent(), loadHomebrewFromDisk()])
      setData({
        spells: mergeSpells(official.spells, hb.spells, SPELL_OVERLAY),
        items: mergeItems(official.items, hb.items, ITEM_OVERLAY),
        races: mergeRaces(official.races, hb.races, RACE_OVERLAY),
        classes: mergeClasses(official.classes, hb.classes),
        backgrounds: mergeBackgrounds(official.backgrounds, [], BACKGROUND_OVERLAY),
        feats: mergeFeats(official.feats, hb.feats, FEAT_OVERLAY),
        meta: official.meta,
        loading: false,
        error: null,
        reload: load,
      })
    } catch (err) {
      setData(prev => ({ ...prev, loading: false, error: String(err), reload: load }))
    }
  }

  useEffect(() => { load() }, [])

  return <ContentContext.Provider value={data}>{children}</ContentContext.Provider>
}

export function useContent(): ContentData {
  return useContext(ContentContext)
}
