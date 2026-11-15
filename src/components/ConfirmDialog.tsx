import { useCallback, useEffect, useState, type ReactNode } from 'react'

interface ConfirmOptions {
  title: string
  message: ReactNode
  confirmLabel?: string
  danger?: boolean  // red confirm button for destructive actions
}

/** In-app replacement for window.confirm(), which freezes the page until it's answered.
 *  Render `confirmDialog` once, then `if (!(await askConfirm({ ... }))) return`. */
export function useConfirm() {
  const [pending, setPending] = useState<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(null)

  const askConfirm = useCallback(
    (opts: ConfirmOptions) => new Promise<boolean>(resolve => setPending({ ...opts, resolve })),
    [],
  )

  const close = useCallback((ok: boolean) => {
    pending?.resolve(ok)
    setPending(null)
  }, [pending])

  // Escape cancels, like the browser dialog did
  useEffect(() => {
    if (!pending) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pending, close])

  const confirmDialog = pending && (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => close(false)}>
      <div className="card max-w-sm w-full p-5" onClick={e => e.stopPropagation()}>
        <h2 className="section-header">{pending.title}</h2>
        <div className="text-sm text-parchment-600 mb-5">{pending.message}</div>
        <div className="flex gap-2 justify-end">
          {/* Enter presses the focused button: Cancel when the action can't be undone */}
          <button type="button" autoFocus={pending.danger} className="btn-secondary" onClick={() => close(false)}>Cancel</button>
          <button type="button" autoFocus={!pending.danger} className={pending.danger ? 'btn-danger' : 'btn-primary'} onClick={() => close(true)}>
            {pending.confirmLabel ?? 'OK'}
          </button>
        </div>
      </div>
    </div>
  )

  return { askConfirm, confirmDialog }
}
