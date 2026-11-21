// `npm start` runs this first: builds the app into dist/ unless the build there was made from exactly
// the files there are now (source, reference data, config, packages). A fingerprint of those files is
// kept in dist/.source-hash, so an update (or a fresh `npm run scrape`) rebuilds on the next start.
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const INPUTS = ['index.html', 'vite.config.ts', 'tailwind.config.js', 'postcss.config.js', 'package-lock.json', 'src', 'public']

function files(path) {
  if (!existsSync(path)) return []
  if (!statSync(path).isDirectory()) return [path]
  return readdirSync(path).sort().flatMap(name => files(join(path, name)))
}

const hash = createHash('sha256')
for (const file of INPUTS.flatMap(p => files(join(root, p)))) {
  hash.update(relative(root, file).replaceAll('\\', '/'))
  hash.update(readFileSync(file))
}
const fingerprint = hash.digest('hex')
const stamp = join(root, 'dist', '.source-hash')

if (existsSync(join(root, 'dist', 'index.html')) && existsSync(stamp) && readFileSync(stamp, 'utf8') === fingerprint) {
  process.exit(0)
}

console.log('Preparing the app (only after an install or update, a few seconds)...')
const { build } = await import('vite')
await build({ root, logLevel: 'warn' })
writeFileSync(stamp, fingerprint)
