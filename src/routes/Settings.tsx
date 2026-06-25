import { useContent } from '../content/ContentProvider'
import { listCharactersFromDisk, loadHomebrewFromDisk } from '../storage/charApi'
import { exportEverything } from '../storage/ioFile'

export default function Settings() {
  const content = useContent()

  async function handleBackup() {
    const [chars, hb] = await Promise.all([listCharactersFromDisk(), loadHomebrewFromDisk()])
    await exportEverything(chars, hb)
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-bold text-parchment-800 mb-6">Settings</h1>

      {/* Data status */}
      <div className="card mb-6">
        <h2 className="section-header">Reference Data</h2>
        {content.loading ? (
          <p className="text-parchment-400 text-sm">Loading...</p>
        ) : content.meta ? (
          <div className="space-y-1 text-sm">
            <p className="text-parchment-600">
              Last scraped: <strong>{new Date(content.meta.scrapedAt).toLocaleString()}</strong>
            </p>
            {Object.entries(content.meta.counts).map(([key, count]) => (
              <p key={key} className="text-parchment-500 capitalize">{key}: {count}</p>
            ))}
          </div>
        ) : (
          <div className="text-sm text-parchment-500 space-y-2">
            <p>No scraped data found.</p>
            <p>To populate the app with spells, items, classes, and races from <code>dnd5e.wikidot.com</code>, run:</p>
            <pre className="bg-dungeon-900 text-parchment-100 rounded p-3 text-xs overflow-x-auto">
              npm install{'\n'}
              npm run scrape
            </pre>
            <p>This will download and cache all D&D 5e content locally. Re-run any time to refresh.</p>
          </div>
        )}
        <div className="mt-4 space-y-2 text-sm text-parchment-500">
          <p>To update to the latest wikidot content:</p>
          <pre className="bg-dungeon-900 text-parchment-100 rounded p-3 text-xs overflow-x-auto">
            npm run scrape{'\n'}
            {'\n'}
            # Force re-download (ignore cache):{'\n'}
            npm run scrape -- --force{'\n'}
            {'\n'}
            # Only refresh specific categories:{'\n'}
            npm run scrape -- --only spells,items
          </pre>
        </div>
      </div>

      {/* Backup */}
      <div className="card mb-6">
        <h2 className="section-header">Backup &amp; Export</h2>
        <p className="text-sm text-parchment-500 mb-4">
          Download all your characters and homebrew as a single ZIP file. Re-import individual characters using the Vault's "Import .json" button.
        </p>
        <button className="btn-primary" onClick={handleBackup}>Download Backup (.zip)</button>
      </div>

      {/* Attribution */}
      <div className="card">
        <h2 className="section-header">Attribution</h2>
        <p className="text-sm text-parchment-600">
          Game reference content sourced from{' '}
          <a href="https://dnd5e.wikidot.com" target="_blank" rel="noreferrer" className="text-parchment-700 underline hover:text-parchment-900">
            dnd5e.wikidot.com
          </a>{' '}
          and is used under the{' '}
          <a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noreferrer" className="text-parchment-700 underline hover:text-parchment-900">
            Creative Commons Attribution-ShareAlike 3.0 License
          </a>.
        </p>
        <p className="text-sm text-parchment-500 mt-2">
          Quills &amp; Scrolls is an unofficial fan tool, not affiliated with Wizards of the Coast.
        </p>
      </div>
    </div>
  )
}
