import { useEffect, useState } from 'react'
import type { Character } from '../character/model'
import { listHistory, loadSnapshot, type Snapshot } from '../storage/charApi'
import { useConfirm } from './ConfirmDialog'
import { ClockIcon } from './SheetIcons'

/** "Today 3:42 PM", "Yesterday 9:10 PM", "12 Nov 2026, 8:05 PM" */
function when(iso: string): string {
  const d = new Date(iso)
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  const days = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86400000)
  if (days === 0) return `Today ${time}`
  if (days === 1) return `Yesterday ${time}`
  return `${d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}, ${time}`
}

/** The sheet header's History button and its list of snapshots the server keeps: one at the start
 *  of each session, one before every level-up. Restoring keeps the current version as a snapshot
 *  too, so a restore can itself be undone from here. */
export function HistoryButton({ charId, charName, onRestore }: {
  charId: string
  charName: string
  onRestore: (c: Character) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [snaps, setSnaps] = useState<Snapshot[] | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const { askConfirm, confirmDialog } = useConfirm()

  useEffect(() => {
    if (!open) return
    setSnaps(null); setError('')
    listHistory(charId).then(setSnaps).catch(() =>
      setError('History needs the app to be restarted once: close it and open it again.'))
  }, [open, charId])

  const restore = async (s: Snapshot) => {
    if (!(await askConfirm({
      title: 'Restore this version?',
      message: `${charName} goes back to how they were ${when(s.savedAt).toLowerCase()}. The current version is kept here too, so you can switch back.`,
      confirmLabel: 'Restore',
    }))) return
    setBusy(s.stamp)
    try {
      await onRestore(await loadSnapshot(charId, s.stamp))
      setOpen(false)
    } catch {
      setError('That snapshot could not be read.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} title="History: go back to an earlier version" aria-label="Character history"
        className="inline-flex items-center justify-center w-9 h-9 rounded border border-parchment-300 text-parchment-600 hover:text-parchment-900 hover:border-parchment-500 hover:bg-parchment-100 transition-colors"
      ><ClockIcon className="w-5 h-5" /></button>
      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center px-4 pt-20" onMouseDown={() => setOpen(false)}>
          <div role="dialog" aria-label={`${charName}'s history`} onMouseDown={e => e.stopPropagation()}
            className="spell-card-in w-full max-w-md rounded-xl border border-parchment-300 bg-parchment-50 shadow-2xl overflow-hidden">
            <div className="flex items-start gap-3 px-4 pt-4 pb-3 border-b border-parchment-200">
              <ClockIcon className="w-5 h-5 mt-0.5 text-[rgb(var(--accent))] shrink-0" />
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold text-parchment-900 leading-tight">History</h2>
                <p className="text-xs text-parchment-500 mt-0.5">A copy is kept at the start of each session and before every level-up.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close"
                className="w-7 h-7 -mr-1 rounded-full text-sm text-parchment-500 hover:bg-parchment-100 hover:text-parchment-900">✕</button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              {error && <p className="px-4 py-4 text-sm text-red-700">{error}</p>}
              {!error && snaps === null && <p className="px-4 py-4 text-sm text-parchment-400">Loading…</p>}
              {!error && snaps?.length === 0 && (
                <p className="px-4 py-4 text-sm text-parchment-500">No copies yet. The first is kept the next time you change something in a new session, or before a level-up.</p>
              )}
              <ul className="divide-y divide-parchment-100">
                {snaps?.map(s => (
                  <li key={s.stamp} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-parchment-900">{when(s.savedAt)}</div>
                      <div className="text-xs text-parchment-500 truncate">
                        {s.label}{s.level ? ` · Level ${s.level}` : ''}{s.hp !== undefined ? ` · ${s.hp} HP` : ''}
                      </div>
                    </div>
                    <button type="button" onClick={() => restore(s)} disabled={busy !== null}
                      className="text-xs rounded-full px-3 py-1 border border-parchment-300 text-parchment-700 hover:border-[rgb(var(--accent))] hover:text-parchment-900 disabled:opacity-50 transition-colors"
                    >{busy === s.stamp ? 'Restoring…' : 'Restore'}</button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
      {confirmDialog}
    </>
  )
}
