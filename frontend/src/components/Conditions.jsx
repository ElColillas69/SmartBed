const TAG = { critical: 'urgent', warning: 'watch', info: 'note' }

export default function Conditions({ items, onSnooze, onDismiss, emptyText = 'Nothing needs attention right now.' }) {
  if (!items.length) return <p className="all-clear">{emptyText}</p>
  return (
    <ul className="log" aria-live="polite">
      {items.map((c) => (
        <li key={c.id} className={`log-item ${c.level}`} role={c.level === 'critical' ? 'alert' : undefined}>
          <span className="tag">{TAG[c.level]}</span>
          <div><strong>{c.title}.</strong> <span>{c.detail}</span></div>
          {c.alarmIds?.length ? (
            <div className="log-actions">
              <button className="btn sm" onClick={() => c.alarmIds.forEach(onSnooze)}>Snooze</button>
              <button className="btn sm primary" onClick={() => c.alarmIds.forEach(onDismiss)}>Dismiss</button>
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  )
}
