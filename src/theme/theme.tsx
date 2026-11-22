import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

export type Theme = 'parchment' | 'light' | 'dark' | 'forest' | 'frost' | 'arcane' | 'ember'

export const THEMES: { id: Theme; label: string; desc: string; dark: boolean; swatch: { bg: string; card: string; accent: string; text: string } }[] = [
  { id: 'parchment', label: 'Parchment', desc: 'Warm tan & gold (classic)', dark: false, swatch: { bg: '#faf3e0', card: '#fdfaf3', accent: '#b8883a', text: '#5a4022' } },
  { id: 'light', label: 'Light', desc: 'Clean white & gray', dark: false, swatch: { bg: '#f6f7f9', card: '#ffffff', accent: '#b8883a', text: '#111827' } },
  { id: 'forest', label: 'Forest', desc: 'Moss & fern of an elven grove', dark: false, swatch: { bg: '#ecf2e6', card: '#f8faf4', accent: '#3d704a', text: '#1b2e17' } },
  { id: 'frost', label: 'Frost', desc: 'Cool blues of a northern coast', dark: false, swatch: { bg: '#e9f1f7', card: '#f8fbfd', accent: '#3b6ea0', text: '#16283c' } },
  { id: 'dark', label: 'Dark', desc: 'Warm dungeon', dark: true, swatch: { bg: '#17130f', card: '#201c17', accent: '#d4a44c', text: '#ece0c8' } },
  { id: 'arcane', label: 'Arcane', desc: "Starlit violet of a wizard's tower", dark: true, swatch: { bg: '#141222', card: '#1e1b30', accent: '#a78bfa', text: '#eae7fa' } },
  { id: 'ember', label: 'Ember', desc: "Smoke & embers of a dragon's lair", dark: true, swatch: { bg: '#19100e', card: '#241816', accent: '#e6703c', text: '#f5e4d8' } },
]

const KEY = 'qs:theme'
const isTheme = (v: unknown): v is Theme => THEMES.some(t => t.id === v)

/** Apply the theme to <html>. Exported so the app entry can set it before paint. */
export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme)
  // The dark-only style rules (tinted accent colours and the like) key on this, so every dark theme gets them
  document.documentElement.setAttribute('data-tone', THEMES.find(t => t.id === theme)?.dark ? 'dark' : 'light')
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
