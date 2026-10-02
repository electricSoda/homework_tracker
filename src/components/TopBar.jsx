export default function TopBar({ onAdd, onExport, onImport, onClear, taskCount, activeCount, compact }) {
  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark">✓</div>
        <div>
          <h1>Homework</h1>
          <p>{activeCount} active · {taskCount} total</p>
        </div>
      </div>

      <div className="topbar-actions">
        <button className="button button--ghost" onClick={onExport} title="Export a JSON backup">Backup</button>
        <label className="button button--ghost file-button" title="Import a JSON backup">
          Import
          <input type="file" accept="application/json,.json" onChange={onImport} />
        </label>
        {/* {!compact && (
          <button className="button button--ghost" onClick={onClear} title="Clear all local data" aria-label="Clear all local data">Clear All</button>
        )} */}
        <button className="button button--primary" onClick={onAdd}>＋ Add task</button>
      </div>
    </header>
  )
}
