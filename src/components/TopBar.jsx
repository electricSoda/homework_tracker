import { useEffect, useRef, useState } from 'react'

export default function TopBar({ onAdd, onExport, onImport, onFocus, activeCount }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const importInput = useRef(null)

  useEffect(() => {
    if (!menuOpen) return undefined
    function closeOnEscape(event) {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [menuOpen])

  function runAction(action) {
    setMenuOpen(false)
    action?.()
  }

  return (
    <>
      <header className="topbar" aria-label="Homework controls">
        <button
          type="button"
          className={`menu-trigger ${menuOpen ? 'is-open' : ''}`}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          aria-controls="app-menu"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span /><span /><span />
        </button>
        {menuOpen && (
          <>
            <button className="menu-dismiss" aria-label="Close menu" onClick={() => setMenuOpen(false)} />
            <nav className="floating-menu" id="app-menu" aria-label="Main menu">
              <div className="menu-brand">
                <span className="brand-mark">✓</span>
                <span><strong>Homework</strong><small>{activeCount} active tasks</small></span>
              </div>
              <button onClick={() => runAction(onFocus)}><span>◷</span> Focus session</button>
              <button onClick={() => runAction(onExport)}><span>↓</span> Export backup</button>
              <button onClick={() => importInput.current?.click()}><span>↑</span> Import backup</button>
              <input
                ref={importInput}
                className="menu-file-input"
                type="file"
                accept="application/json,.json"
                onChange={(event) => {
                  setMenuOpen(false)
                  onImport(event)
                }}
              />
            </nav>
          </>
        )}
      </header>
      <button type="button" className="floating-add" onClick={onAdd} aria-label="Add a task">
        <span aria-hidden="true">＋</span><span className="floating-add__label">New task</span>
      </button>
    </>
  )
}
