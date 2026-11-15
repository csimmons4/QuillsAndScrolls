import { createContext, useCallback, useContext, useState, ReactNode } from 'react'

/** The character sheet most recently opened, so other pages can offer a quick way back. */
export interface RecentCharacter { id: string; name: string }

// sessionStorage: survives a page refresh, forgotten when the tab closes.
const KEY = 'qs:recentCharacter'

function readStored(): RecentCharacter | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    const parsed = raw ? JSON.parse(raw) : null
    return parsed && typeof parsed.id === 'string' && typeof parsed.name === 'string' ? parsed : null
  } catch { return null }
}

interface RecentCharacterValue {
  recent: RecentCharacter | null
  setRecent: (c: RecentCharacter | null) => void
}

const RecentCharacterContext = createContext<RecentCharacterValue>({ recent: null, setRecent: () => {} })

export function RecentCharacterProvider({ children }: { children: ReactNode }) {
  const [recent, setRecentState] = useState<RecentCharacter | null>(readStored)

  const setRecent = useCallback((c: RecentCharacter | null) => {
    setRecentState(c)
    try {
      if (c) sessionStorage.setItem(KEY, JSON.stringify(c))
      else sessionStorage.removeItem(KEY)
    } catch { /* storage unavailable — in-memory value still works */ }
  }, [])

  return <RecentCharacterContext.Provider value={{ recent, setRecent }}>{children}</RecentCharacterContext.Provider>
}

export function useRecentCharacter(): RecentCharacterValue {
  return useContext(RecentCharacterContext)
}
