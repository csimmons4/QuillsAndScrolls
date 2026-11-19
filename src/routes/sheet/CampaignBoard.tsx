// The Notes tab's campaign corkboard: draggable notes, connections, several boards.
import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'

// ── Campaign Board types ────────────────────────────────────────────────────
export interface BoardNote { id: string; x: number; y: number; w: number; h: number; title: string; content: string; color: string }
export interface BoardConn { id: string; from: string; to: string; label?: string }
export interface Board { id: string; name: string; notes: BoardNote[]; connections: BoardConn[] }


export function noteRotation(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (Math.imul(31, h) + id.charCodeAt(i)) | 0
  return ((h % 7) - 3) * 0.8
}

export function CampaignBoardManager({
  boards: initBoards, activeBoard: initActive,
  onChange,
}: {
  boards: Board[]; activeBoard: string
  onChange: (boards: Board[], activeBoard: string) => void
}) {
  const [boards, setBoards] = useState<Board[]>(initBoards)
  const [activeId, setActiveId] = useState<string>(initActive || initBoards[0]?.id || '')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameVal, setRenameVal] = useState('')
  // Full screen: the board fills the window (and the screen too, where the browser allows it)
  const [fullscreen, setFullscreen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  function enterFullscreen() {
    setFullscreen(true)
    rootRef.current?.requestFullscreen?.().catch(() => { /* window-filling overlay still works */ })
  }
  function exitFullscreen() {
    setFullscreen(false)
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
  }

  useEffect(() => {
    // Browser fullscreen ended (e.g. Esc) → leave the overlay too
    const onFsChange = () => { if (!document.fullscreenElement) setFullscreen(false) }
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  useEffect(() => {
    if (!fullscreen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !document.fullscreenElement) setFullscreen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fullscreen])

  function save(next: Board[], nextActive: string) {
    setBoards(next); onChange(next, nextActive)
  }

  function addBoard() {
    const id = `board-${Date.now()}`
    const next = [...boards, { id, name: 'New Board', notes: [], connections: [] }]
    setActiveId(id)
    save(next, id)
  }

  function deleteBoard(id: string) {
    if (boards.length <= 1) return
    const next = boards.filter(b => b.id !== id)
    const nextActive = activeId === id ? next[0].id : activeId
    setActiveId(nextActive)
    save(next, nextActive)
  }

  function renameBoard(id: string, name: string) {
    save(boards.map(b => b.id === id ? { ...b, name } : b), activeId)
    setRenamingId(null)
  }

  function onBoardChange(notes: BoardNote[], connections: BoardConn[]) {
    const next = boards.map(b => b.id === activeId ? { ...b, notes, connections } : b)
    save(next, activeId)
  }

  const active = boards.find(b => b.id === activeId) ?? boards[0]

  return (
    <div ref={rootRef} className={fullscreen ? 'fixed inset-0 z-50 flex flex-col bg-parchment-100' : 'card p-0 overflow-hidden'}>
      {/* Board tabs */}
      <div className="flex items-center gap-0 border-b border-parchment-200 bg-parchment-50 overflow-x-auto shrink-0">
        {boards.map(b => (
          <div key={b.id}
            className={`flex items-center gap-1 px-3 py-2 border-r border-parchment-200 cursor-pointer shrink-0 group ${
              b.id === activeId ? 'bg-parchment-50 border-b-white text-parchment-900 font-semibold' : 'text-parchment-500 hover:bg-parchment-100'
            }`}
            onClick={() => { setActiveId(b.id); onChange(boards, b.id) }}
          >
            {renamingId === b.id ? (
              <input
                autoFocus
                className="text-xs outline-none bg-transparent border-b border-parchment-500 w-28 min-w-0"
                value={renameVal}
                onChange={e => setRenameVal(e.target.value)}
                onBlur={() => renameBoard(b.id, renameVal.trim() || b.name)}
                onKeyDown={e => { if (e.key === 'Enter') renameBoard(b.id, renameVal.trim() || b.name); if (e.key === 'Escape') setRenamingId(null) }}
                onClick={e => e.stopPropagation()}
              />
            ) : (
              <span className="text-xs truncate max-w-[120px]">{b.name}</span>
            )}
            {/* Pencil — always visible on active tab, hover on others */}
            {renamingId !== b.id && (
              <button type="button"
                title="Rename board"
                className={`text-[10px] transition-opacity ml-0.5 shrink-0 ${
                  b.id === activeId
                    ? 'text-parchment-400 hover:text-parchment-700 opacity-60 hover:opacity-100'
                    : 'text-parchment-300 hover:text-parchment-600 opacity-0 group-hover:opacity-100'
                }`}
                onClick={e => { e.stopPropagation(); setRenamingId(b.id); setRenameVal(b.name) }}
              >✎</button>
            )}
            {boards.length > 1 && renamingId !== b.id && (
              <button type="button"
                title="Delete board"
                className="text-[10px] text-parchment-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity ml-0.5 shrink-0"
                onClick={e => { e.stopPropagation(); deleteBoard(b.id) }}
              >✕</button>
            )}
          </div>
        ))}
        <button type="button"
          onClick={addBoard}
          className="px-3 py-2 text-xs text-parchment-400 hover:text-parchment-700 hover:bg-parchment-100 transition-colors shrink-0 font-medium"
        >+ New Board</button>
      </div>

      {boards.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <p className="text-parchment-400 text-sm">No boards yet</p>
          <button type="button" onClick={addBoard}
            className="text-sm bg-parchment-700 text-parchment-100 hover:bg-parchment-800 rounded px-4 py-2 font-semibold transition-colors">
            Create First Board
          </button>
        </div>
      ) : active ? (
        <CampaignBoard
          key={active.id}
          notes={active.notes}
          connections={active.connections}
          onChange={onBoardChange}
          boardName={active.name}
          fullscreen={fullscreen}
          onToggleFullscreen={fullscreen ? exitFullscreen : enterFullscreen}
        />
      ) : null}
    </div>
  )
}

export const NOTE_BG: Record<string, { card: string; pin: string; text: string; sub: string }> = {
  yellow: { card: '#fef08a', pin: '#ca8a04', text: '#713f12', sub: '#92400e' },
  pink:   { card: '#fbcfe8', pin: '#be185d', text: '#831843', sub: '#9d174d' },
  blue:   { card: '#bae6fd', pin: '#0369a1', text: '#0c4a6e', sub: '#075985' },
  green:  { card: '#bbf7d0', pin: '#15803d', text: '#14532d', sub: '#166534' },
  purple: { card: '#e9d5ff', pin: '#7c3aed', text: '#3b0764', sub: '#4c1d95' },
  orange: { card: '#fed7aa', pin: '#c2410c', text: '#7c2d12', sub: '#9a3412' },
}

export function CampaignBoard({
  notes: initNotes, connections: initConns,
  onChange, boardName, fullscreen, onToggleFullscreen,
}: {
  notes: BoardNote[]; connections: BoardConn[]
  onChange: (notes: BoardNote[], connections: BoardConn[]) => void
  boardName: string
  fullscreen: boolean
  onToggleFullscreen: () => void
}) {
  const [notes, setNotes] = useState<BoardNote[]>(initNotes)
  const [conns, setConns] = useState<BoardConn[]>(initConns)
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null)
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null)
  const [editingConn, setEditingConn] = useState<{ id: string; val: string } | null>(null)
  const [scale, setScaleState] = useState(0.65)
  const scaleRef = useRef(0.65)
  const outerRef = useRef<HTMLDivElement>(null)
  const dragging = useRef<
    | { type: 'move';   id: string; ox: number; oy: number }
    | { type: 'resize'; id: string; sx: number; sy: number; sw: number; sh: number }
    | null
  >(null)
  const panning = useRef<{ startX: number; startY: number; scrollLeft: number; scrollTop: number } | null>(null)
  const [isPanning, setIsPanning] = useState(false)
  const BOARD_W = 3200
  const BOARD_H = 2400
  const VIEWPORT_H = 680
  const MIN_SCALE = 0.4, MAX_SCALE = 2.0
  const MIN_W = 160, MIN_H = 140

  function setScale(s: number) { scaleRef.current = s; setScaleState(s) }

  function updateNotes(next: BoardNote[]) { setNotes(next); onChange(next, conns) }
  function updateConns(next: BoardConn[]) { setConns(next); onChange(notes, next) }

  // Board coords: convert screen-space mouse position to virtual canvas coords
  function boardCoords(e: React.MouseEvent | MouseEvent): { bx: number; by: number } {
    const outer = outerRef.current!
    const rect = outer.getBoundingClientRect()
    const s = scaleRef.current
    return {
      bx: (e.clientX - rect.left + outer.scrollLeft) / s,
      by: (e.clientY - rect.top + outer.scrollTop) / s,
    }
  }


  // Ctrl/⌘ + scroll (or trackpad pinch) zooms around the cursor. Needs a non-passive
  // listener so the browser's own page zoom can be prevented.
  useEffect(() => {
    const outer = outerRef.current
    if (!outer) return
    function onWheel(e: WheelEvent) {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      const el = outerRef.current!
      const rect = el.getBoundingClientRect()
      const s = scaleRef.current
      const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, s * (e.deltaY < 0 ? 1.1 : 1 / 1.1)))
      const px = e.clientX - rect.left, py = e.clientY - rect.top
      const bx = (el.scrollLeft + px) / s, by = (el.scrollTop + py) / s
      setScale(next)
      requestAnimationFrame(() => { el.scrollLeft = bx * next - px; el.scrollTop = by * next - py })
    }
    outer.addEventListener('wheel', onWheel, { passive: false })
    return () => outer.removeEventListener('wheel', onWheel)
  }, [])

  function addNote() {
    const outer = outerRef.current!
    const s = scaleRef.current
    const vpW = outer.clientWidth / s
    const vpH = outer.clientHeight / s
    const scrollX = outer.scrollLeft / s
    const scrollY = outer.scrollTop / s
    const w = 200, h = 200
    const id = `note-${Date.now()}`
    const x = Math.min(BOARD_W - w - 20, scrollX + Math.random() * Math.max(0, vpW - w - 60) + 30)
    const y = Math.min(BOARD_H - h - 20, scrollY + Math.random() * Math.max(0, vpH - h - 60) + 30)
    updateNotes([...notes, { id, x, y, w, h, title: 'New Note', content: '', color: 'yellow' }])
  }

  function deleteNote(id: string) {
    // Worked out here rather than inside a state updater: the parent's save can't run while React renders
    const nextNotes = notes.filter(n => n.id !== id)
    const nextConns = conns.filter(c => c.from !== id && c.to !== id)
    setNotes(nextNotes)
    setConns(nextConns)
    onChange(nextNotes, nextConns)
    if (connectingFrom === id) setConnectingFrom(null)
  }

  function patchNote(id: string, changes: Partial<BoardNote>) {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, ...changes } : n))
  }

  function onBoardMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    if (connectingFrom || dragging.current) return
    const outer = outerRef.current!
    panning.current = { startX: e.clientX, startY: e.clientY, scrollLeft: outer.scrollLeft, scrollTop: outer.scrollTop }
    setIsPanning(true)
  }

  function onBoardMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (panning.current && !dragging.current) {
      const outer = outerRef.current!
      outer.scrollLeft = panning.current.scrollLeft - (e.clientX - panning.current.startX)
      outer.scrollTop  = panning.current.scrollTop  - (e.clientY - panning.current.startY)
      return
    }
    const { bx, by } = boardCoords(e)
    setMousePos({ x: bx, y: by })
    if (!dragging.current) return
    if (dragging.current.type === 'move') {
      const { id, ox, oy } = dragging.current
      setNotes(prev => prev.map(n => n.id === id ? { ...n, x: Math.max(0, bx - ox), y: Math.max(0, by - oy) } : n))
    } else {
      const { id, sx, sy, sw, sh } = dragging.current
      const nw = Math.max(MIN_W, sw + (bx - sx))
      const nh = Math.max(MIN_H, sh + (by - sy))
      setNotes(prev => prev.map(n => n.id === id ? { ...n, w: nw, h: nh } : n))
    }
  }

  function onBoardMouseUp() {
    if (dragging.current) { onChange(notes, conns); dragging.current = null }
    panning.current = null
    setIsPanning(false)
  }

  function onNoteMoveDown(e: React.MouseEvent, id: string) {
    if (connectingFrom) return
    e.stopPropagation()
    const note = notes.find(n => n.id === id)!
    const { bx, by } = boardCoords(e)
    dragging.current = { type: 'move', id, ox: bx - note.x, oy: by - note.y }
  }

  function onResizeDown(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    const note = notes.find(n => n.id === id)!
    const { bx, by } = boardCoords(e)
    dragging.current = { type: 'resize', id, sx: bx, sy: by, sw: note.w, sh: note.h }
  }

  function onNoteClick(id: string) {
    if (!connectingFrom) return
    if (id === connectingFrom) { setConnectingFrom(null); return }
    const exists = conns.some(c => (c.from === connectingFrom && c.to === id) || (c.from === id && c.to === connectingFrom))
    if (!exists) updateConns([...conns, { id: `conn-${Date.now()}`, from: connectingFrom, to: id }])
    setConnectingFrom(null)
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') { setConnectingFrom(null); setEditingConn(null) } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function noteCenter(n: BoardNote) { return { x: n.x + n.w / 2, y: n.y + n.h / 2 } }
  function bezierMid(ca: {x:number;y:number}, cb: {x:number;y:number}) {
    const cx = (ca.x + cb.x) / 2, cy = (ca.y + cb.y) / 2 + 28
    return { lx: 0.25*ca.x + 0.5*cx + 0.25*cb.x, ly: 0.25*ca.y + 0.5*cy + 0.25*cb.y, cx, cy }
  }

  return (
    <div className={fullscreen ? 'select-none flex flex-col flex-1 min-h-0' : 'select-none'}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-[#8a6642] shrink-0">
        <span className="text-xs text-parchment-200 font-semibold opacity-60 italic">{boardName}</span>
        {connectingFrom
          ? <span className="text-xs text-red-200 font-medium animate-pulse ml-2">Click a note to connect — Esc to cancel</span>
          : <span className="text-[10px] text-parchment-300/70 ml-2 hidden sm:inline">Drag to pan · Ctrl/⌘ + scroll to zoom</span>}
        <div className="flex-1" />
        {/* Zoom controls */}
        <div className="flex items-center gap-1">
          <button type="button" aria-label="Zoom out" onClick={() => setScale(Math.max(MIN_SCALE, scale - 0.15))}
            className="w-6 h-6 flex items-center justify-center bg-black/25 hover:bg-black/45 text-parchment-200 rounded text-sm font-bold transition-colors">−</button>
          <span className="text-xs text-parchment-300 w-10 text-center">{Math.round(scale * 100)}%</span>
          <button type="button" aria-label="Zoom in" onClick={() => setScale(Math.min(MAX_SCALE, scale + 0.15))}
            className="w-6 h-6 flex items-center justify-center bg-black/25 hover:bg-black/45 text-parchment-200 rounded text-sm font-bold transition-colors">+</button>
          <button type="button" onClick={() => setScale(1)}
            className="text-[10px] text-parchment-400 hover:text-parchment-200 px-1.5 transition-colors">Reset</button>
        </div>
        <button type="button" onClick={addNote}
          className="text-xs bg-black/30 text-parchment-100 hover:bg-black/50 rounded px-3 py-1 font-semibold transition-colors border border-white/10 ml-1">
          + Add Note
        </button>
        <button type="button" onClick={onToggleFullscreen}
          title={fullscreen ? 'Exit full screen (Esc)' : 'Open the board full screen'}
          className="text-xs bg-black/30 text-parchment-100 hover:bg-black/50 rounded px-3 py-1 font-semibold transition-colors border border-white/10">
          {fullscreen ? '✕ Exit full screen' : '⛶ Full screen'}
        </button>
      </div>

      {/* Scrollable viewport */}
      <div
        ref={outerRef}
        className={fullscreen ? 'overflow-auto flex-1 min-h-0' : 'overflow-auto'}
        style={{ height: fullscreen ? undefined : VIEWPORT_H, cursor: connectingFrom ? 'crosshair' : isPanning ? 'grabbing' : 'grab' }}
        onMouseDown={onBoardMouseDown}
        onMouseMove={onBoardMouseMove}
        onMouseUp={onBoardMouseUp}
        onMouseLeave={onBoardMouseUp}
        onClick={() => { if (connectingFrom) setConnectingFrom(null) }}
      >
        {/* Scroll spacer that matches scaled canvas size */}
        <div style={{ width: BOARD_W * scale, height: BOARD_H * scale, position: 'relative', flexShrink: 0 }}>
          {/* Scaled canvas */}
          <div style={{
            width: BOARD_W, height: BOARD_H,
            transform: `scale(${scale})`, transformOrigin: '0 0',
            position: 'absolute', top: 0, left: 0,
            background: '#9b7451',
            backgroundImage: `
              linear-gradient(rgba(0,0,0,0.06) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0,0,0,0.06) 1px, transparent 1px),
              radial-gradient(ellipse at 15% 20%, rgba(180,140,90,0.25) 0%, transparent 55%),
              radial-gradient(ellipse at 75% 65%, rgba(130,90,50,0.25) 0%, transparent 55%)
            `,
            backgroundSize: '40px 40px, 40px 40px, 100% 100%, 100% 100%',
          }}>
            {notes.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <p className="text-parchment-200/40 text-base">Click "+ Add Note" to start your investigation board</p>
              </div>
            )}

            {/* SVG — strings + labels */}
            <svg className="absolute inset-0 pointer-events-none" width={BOARD_W} height={BOARD_H} style={{ zIndex: 1 }}>
          <defs>
            <filter id="string-blur"><feDropShadow dx="0" dy="1.5" stdDeviation="1.5" floodColor="#000" floodOpacity="0.35" /></filter>
          </defs>
          {conns.map(c => {
            const a = notes.find(n => n.id === c.from), b = notes.find(n => n.id === c.to)
            if (!a || !b) return null
            const ca = noteCenter(a), cb = noteCenter(b)
            const { lx, ly, cx, cy } = bezierMid(ca, cb)
            const d = `M ${ca.x} ${ca.y} Q ${cx} ${cy} ${cb.x} ${cb.y}`
            const hasLabel = c.label && c.label.trim()
            const isEditing = editingConn?.id === c.id
            return (
              <g key={c.id}>
                {/* Invisible thick hit target */}
                <path d={d} stroke="transparent" strokeWidth="14" fill="none"
                  style={{ pointerEvents: 'all', cursor: 'pointer' }}
                  onDoubleClick={e => { e.stopPropagation(); setEditingConn({ id: c.id, val: c.label ?? '' }) }}
                  onClick={e => e.stopPropagation()}
                />
                {/* Visible string */}
                <path d={d} stroke="#7f1d1d" strokeWidth="1.5" fill="none" strokeLinecap="round"
                  filter="url(#string-blur)" opacity="0.9"
                  style={{ pointerEvents: 'none' }}
                />
                {/* Label background + text */}
                {hasLabel && !isEditing && (
                  <>
                    <rect x={lx - 42} y={ly - 9} width={84} height={18} rx="3"
                      fill="rgba(255,255,255,0.88)" stroke="#7f1d1d" strokeWidth="0.5"
                      style={{ pointerEvents: 'all', cursor: 'pointer' }}
                      onDoubleClick={e => { e.stopPropagation(); setEditingConn({ id: c.id, val: c.label ?? '' }) }}
                    />
                    <text x={lx} y={ly + 4} textAnchor="middle" fontSize="10" fill="#7f1d1d"
                      fontFamily="Georgia, serif" fontStyle="italic"
                      style={{ pointerEvents: 'none' }}
                    >{(c.label!).length > 14 ? c.label!.slice(0, 14) + '…' : c.label}</text>
                  </>
                )}
                {/* "add label" hint when no label */}
                {!hasLabel && !isEditing && (
                  <text x={lx} y={ly + 4} textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.4)"
                    fontFamily="serif" style={{ pointerEvents: 'all', cursor: 'pointer' }}
                    onDoubleClick={e => { e.stopPropagation(); setEditingConn({ id: c.id, val: '' }) }}
                  >dbl-click to label</text>
                )}
              </g>
            )
          })}
          {/* Preview line while connecting */}
          {connectingFrom && mousePos && (() => {
            const src = notes.find(n => n.id === connectingFrom)
            if (!src) return null
            const c = noteCenter(src)
            return <line x1={c.x} y1={c.y} x2={mousePos.x} y2={mousePos.y}
              stroke="#ef4444" strokeWidth="1.5" strokeDasharray="7 4" opacity="0.8" strokeLinecap="round" />
          })()}
        </svg>

        {/* Label editing input overlay */}
        {editingConn && (() => {
          const c = conns.find(x => x.id === editingConn.id)
          if (!c) return null
          const a = notes.find(n => n.id === c.from), b = notes.find(n => n.id === c.to)
          if (!a || !b) return null
          const ca = noteCenter(a), cb = noteCenter(b)
          const { lx, ly } = bezierMid(ca, cb)
          return (
            <input
              autoFocus
              style={{ position: 'absolute', left: lx - 60, top: ly - 11, zIndex: 20, width: 120 }}
              className="text-xs bg-parchment-50 border border-red-400 rounded px-1.5 py-0.5 text-red-900 text-center outline-none shadow-md font-serif italic"
              value={editingConn.val}
              placeholder="Label…"
              onChange={e => setEditingConn({ ...editingConn, val: e.target.value })}
              onBlur={() => {
                updateConns(conns.map(x => x.id === editingConn.id ? { ...x, label: editingConn.val } : x))
                setEditingConn(null)
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') { updateConns(conns.map(x => x.id === editingConn.id ? { ...x, label: editingConn.val } : x)); setEditingConn(null) }
                if (e.key === 'Escape') setEditingConn(null)
              }}
              onClick={e => e.stopPropagation()}
              onMouseDown={e => e.stopPropagation()}
            />
          )
        })()}

        {/* Notes */}
        {notes.map(note => {
          const pal = NOTE_BG[note.color] ?? NOTE_BG.yellow
          const isConnSrc = connectingFrom === note.id
          const rot = noteRotation(note.id)
          return (
            <div key={note.id} className="absolute group"
              style={{ left: note.x, top: note.y, width: note.w, height: note.h, zIndex: 2,
                transform: `rotate(${rot}deg)`, transformOrigin: 'top center' }}
              onClick={e => { e.stopPropagation(); onNoteClick(note.id) }}
            >
              {/* Pushpin */}
              <div style={{
                position: 'absolute', top: -9, left: '50%', transform: 'translateX(-50%)',
                width: 14, height: 14, borderRadius: '50%', zIndex: 3,
                background: `radial-gradient(circle at 38% 38%, ${pal.pin}cc, ${pal.pin})`,
                boxShadow: '0 2px 5px rgba(0,0,0,0.5), inset 0 -1px 2px rgba(0,0,0,0.2)',
              }} />

              {/* Card */}
              <div className="w-full h-full flex flex-col overflow-hidden"
                style={{
                  background: pal.card,
                  boxShadow: isConnSrc
                    ? `0 0 0 2px #ef4444, 3px 6px 14px rgba(0,0,0,0.45)`
                    : '3px 6px 14px rgba(0,0,0,0.4), 1px 2px 4px rgba(0,0,0,0.2)',
                  borderRadius: 2,
                }}
                onMouseDown={e => onNoteMoveDown(e, note.id)}
              >
                {/* Title row (drag zone) */}
                <div className="px-2.5 pt-3 pb-1 cursor-grab active:cursor-grabbing shrink-0">
                  <input
                    className="w-full bg-transparent text-xs font-bold outline-none placeholder-current/40 leading-tight"
                    style={{ color: pal.text }}
                    value={note.title}
                    placeholder="Title…"
                    onMouseDown={e => e.stopPropagation()}
                    onChange={e => patchNote(note.id, { title: e.target.value })}
                    onBlur={() => onChange(notes, conns)}
                  />
                </div>
                <div style={{ borderBottom: `1px solid ${pal.pin}33` }} className="mx-2.5" />

                {/* Content */}
                <textarea
                  className="flex-1 bg-transparent text-xs outline-none resize-none px-2.5 py-1.5 leading-relaxed placeholder-current/30"
                  style={{ color: pal.sub }}
                  placeholder="Write your note…"
                  value={note.content}
                  onMouseDown={e => e.stopPropagation()}
                  onChange={e => patchNote(note.id, { content: e.target.value })}
                  onBlur={() => onChange(notes, conns)}
                />

                {/* Hover toolbar */}
                <div className="shrink-0 px-2 py-1.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ borderTop: `1px solid ${pal.pin}22` }}
                  onMouseDown={e => e.stopPropagation()}
                >
                  {/* Color swatches */}
                  {Object.keys(NOTE_BG).map(c => (
                    <button key={c} type="button" aria-label={`${c} note`} title={c}
                      // saved with the new colour (a delayed save of `notes` kept the old one)
                      onClick={e => { e.stopPropagation(); updateNotes(notes.map(n => n.id === note.id ? { ...n, color: c } : n)) }}
                      style={{ background: NOTE_BG[c].card, borderColor: NOTE_BG[c].pin, outline: note.color === c ? `2px solid ${NOTE_BG[c].pin}` : 'none' }}
                      className="w-3 h-3 rounded-full border shrink-0"
                    />
                  ))}
                  <div className="flex-1" />
                  <button type="button"
                    onClick={e => { e.stopPropagation(); setConnectingFrom(prev => prev === note.id ? null : note.id) }}
                    style={{ color: isConnSrc ? '#ef4444' : pal.sub }}
                    className="text-[10px] font-semibold px-1.5 py-0.5 rounded hover:bg-black/10 transition-colors"
                  >{isConnSrc ? 'Cancel' : '⬡ Link'}</button>
                  <button type="button" aria-label="Delete note"
                    onClick={e => { e.stopPropagation(); deleteNote(note.id) }}
                    className="text-[10px] px-1.5 py-0.5 rounded hover:bg-black/10 transition-colors"
                    style={{ color: pal.sub }}
                  >✕</button>
                </div>
              </div>

              {/* Resize handle */}
              <div
                style={{ position: 'absolute', bottom: -1, right: -1, width: 14, height: 14,
                  cursor: 'nwse-resize', zIndex: 4,
                  background: `linear-gradient(135deg, transparent 50%, ${pal.pin}66 50%)`,
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
                onMouseDown={e => onResizeDown(e, note.id)}
              />
            </div>
          )
            })}
          </div>{/* end scaled canvas */}
        </div>{/* end scroll spacer */}
      </div>{/* end viewport */}
    </div>
  )
}
