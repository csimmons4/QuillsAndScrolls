import { BrowserRouter, Routes, Route, NavLink, Link, useLocation } from 'react-router-dom'
import { ContentProvider } from './content/ContentProvider'
import { ThemeProvider } from './theme/theme'
import { RecentCharacterProvider, useRecentCharacter } from './storage/recentCharacter'
import { lazy, Suspense } from 'react'
import Vault from './routes/Vault'

// The other pages load when first opened, so the Vault comes up quickly
const Creator = lazy(() => import('./routes/Creator'))
const Sheet = lazy(() => import('./routes/Sheet'))
const PrintSheet = lazy(() => import('./routes/PrintSheet'))
const LevelUp = lazy(() => import('./routes/LevelUp'))
const Homebrew = lazy(() => import('./routes/Homebrew'))
const Lookup = lazy(() => import('./routes/Lookup'))
const Settings = lazy(() => import('./routes/Settings'))
const Party = lazy(() => import('./routes/Party'))

function NavBar() {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    isActive ? 'nav-link nav-link-active' : 'nav-link'
  const { recent } = useRecentCharacter()
  const { pathname } = useLocation()
  const onRecentSheet = !!recent && pathname.startsWith(`/c/${recent.id}`)

  return (
    <header className="app-header shadow-lg print:hidden">
      <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-2">
        <Link to="/" className="nav-brand text-xl font-bold tracking-wide whitespace-nowrap">
          Quills &amp; Scrolls
        </Link>
        {/* On a phone the links drop to their own row under the name */}
        <nav className="flex gap-3.5 sm:gap-5 text-[13px] sm:text-sm whitespace-nowrap sm:ml-4 order-last sm:order-none w-full sm:w-auto overflow-x-auto [scrollbar-width:none]">
          <NavLink to="/" end className={linkClass}>Vault</NavLink>
          <NavLink to="/party" className={linkClass}>Party</NavLink>
          <NavLink to="/lookup" className={linkClass}>Compendium</NavLink>
          <NavLink to="/homebrew" className={linkClass}>Homebrew</NavLink>
          <NavLink to="/settings" className={linkClass}>Settings</NavLink>
        </nav>
        {recent && !onRecentSheet && (
          <Link to={`/c/${recent.id}`} className="nav-back ml-auto" title={`Back to ${recent.name}'s sheet`}>
            ← <span className="truncate max-w-[12rem]">{recent.name}</span>
          </Link>
        )}
      </div>
    </header>
  )
}

export default function App() {
  return (
    <ThemeProvider>
    <BrowserRouter>
      <RecentCharacterProvider>
      <ContentProvider>
        <div className="min-h-screen flex flex-col">
          <NavBar />
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 print:p-0 print:max-w-none">
            <Suspense fallback={<div className="text-center py-20 text-parchment-400">Loading…</div>}>
            <Routes>
              <Route path="/" element={<Vault />} />
              <Route path="/new" element={<Creator />} />
              <Route path="/c/:id" element={<Sheet />} />
              <Route path="/c/:id/print" element={<PrintSheet />} />
              <Route path="/c/:id/level-up" element={<LevelUp />} />
              <Route path="/lookup" element={<Lookup />} />
              <Route path="/homebrew" element={<Homebrew />} />
              <Route path="/party" element={<Party />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
            </Suspense>
          </main>
        </div>
      </ContentProvider>
      </RecentCharacterProvider>
    </BrowserRouter>
    </ThemeProvider>
  )
}
