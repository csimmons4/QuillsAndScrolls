import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

export type Theme = 'parchment' | 'light' | 'dark'

export const THEMES: { id: Theme; label: string; desc: string; swatch: { bg: string; card: string; accent: string; text: string } }[] = [
  { id: 'parchment', label: 'Parchment', desc: 'Warm tan & gold (classic)', swatch: { bg: '#faf3e0', card: '#fdfaf3', accent: '#b8883a', text: '#5a4022' } },
  { id: 'light', label: 'Light', desc: 'Clean white & gray', swatch: { bg: '#f6f7f9', card: '#ffffff', accent: '#b8883a', text: '#111827' } },
  { id: 'dark', label: 'Dark', desc: 'Warm dungeon', swatch: { bg: '#17130f', card: '#201c17', accent: '#d4a44c', text: '#ece0c8' } },
]

const KEY = 'qs:theme'
const isTheme = (v: unknown): v is Theme => v === 'parchment' || v === 'light' || v === 'dark'

/** Apply the theme to <html>. Exported so the app entry can set it before paint. */
export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme)
}

export function readStoredTheme(): Theme {
  try {
    const saved = localStorage.getItem(KEY)
    if (isTheme(saved)) return saved
  } catch { /* localStorage unavailable */ }
  return 'parchment'
}

interface ThemeContextValue {
  theme: Theme
  setTheme: (t: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue>({ theme: 'parchment', setTheme: () => {} })

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const initial = readStoredTheme()
    applyTheme(initial) // set during initial render so there's no flash
    return initial
  })

  const setTheme = (t: Theme) => {
    setThemeState(t)
    applyTheme(t)
    try { localStorage.setItem(KEY, t) } catch { /* ignore */ }
  }

  // Keep the attribute in sync if state ever changes without going through setTheme.
  useEffect(() => { applyTheme(theme) }, [theme])

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext)
}
