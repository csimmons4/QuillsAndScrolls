import { Component, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

/** If a page fails while rendering, show what happened and a way out instead of a blank window.
 *  App.tsx keys it by the path, so going to another page starts fresh. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error('Page failed to render:', error)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="max-w-xl mx-auto mt-16 card" role="alert">
        <h1 className="section-header">Something went wrong on this page</h1>
        <p className="text-sm text-parchment-700 mb-3">
          The page hit a problem and couldn’t be shown. Your characters are saved as you play, so nothing should be lost.
          Try another page, or reload this one.
        </p>
        <pre className="text-xs text-red-700 bg-parchment-100 border border-parchment-200 rounded p-2 mb-4 whitespace-pre-wrap break-words">{this.state.error.message}</pre>
        <div className="flex gap-2">
          <Link to="/" className="btn-primary">Back to the Vault</Link>
          <button type="button" className="btn-secondary" onClick={() => window.location.reload()}>Reload</button>
        </div>
      </div>
    )
  }
}
