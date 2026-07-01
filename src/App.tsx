import { BrowserRouter, Routes, Route, NavLink, Link } from 'react-router-dom'
import { ContentProvider } from './content/ContentProvider'
import { ThemeProvider } from './theme/theme'
import Vault from './routes/Vault'
import Creator from './routes/Creator'
import Sheet from './routes/Sheet'
import LevelUp from './routes/LevelUp'
import Homebrew from './routes/Homebrew'
import Lookup from './routes/Lookup'
import Settings from './routes/Settings'

function NavBar() {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    isActive ? 'nav-link nav-link-active' : 'nav-link'

  return (
    <header className="app-header shadow-lg">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-6">
        <Link to="/" className="nav-brand text-xl font-bold tracking-wide">
          Quills &amp; Scrolls
        </Link>
        <nav className="flex gap-5 text-sm ml-4">
          <NavLink to="/" end className={linkClass}>Vault</NavLink>
          <NavLink to="/lookup" className={linkClass}>Lookup</NavLink>
          <NavLink to="/homebrew" className={linkClass}>Homebrew</NavLink>
          <NavLink to="/settings" className={linkClass}>Settings</NavLink>
        </nav>
      </div>
    </header>
  )
}

export default function App() {
  return (
    <ThemeProvider>
    <BrowserRouter>
      <ContentProvider>
        <div className="min-h-screen flex flex-col">
          <NavBar />
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
            <Routes>
              <Route path="/" element={<Vault />} />
              <Route path="/new" element={<Creator />} />
              <Route path="/c/:id" element={<Sheet />} />
              <Route path="/c/:id/level-up" element={<LevelUp />} />
              <Route path="/lookup" element={<Lookup />} />
              <Route path="/homebrew" element={<Homebrew />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </main>
        </div>
      </ContentProvider>
    </BrowserRouter>
    </ThemeProvider>
  )
}
