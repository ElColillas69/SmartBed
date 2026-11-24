
const TAG = {
  critical: 'Urgent',
  warning: 'Warning',
  info: 'Information',
}

export default function Conditions({
  items,
  onSnooze,
  onDismiss,
  emptyText = 'Nothing needs attention right now.',
}) {
  if (!items.length) {
    return (
      <p className="all-clear" role="status">
        {emptyText}
      </p>
    )
  }

  return (
    <ul
      className="log"
      aria-label="Bed monitoring notices"
      aria-live="polite"
    >
      {items.map((condition) => (
        <li
          key={condition.id}
          className={`log-item ${condition.level}`}
          role={
            condition.level === 'critical'
              ? 'alert'
              : undefined
          }
        >
          <span className="tag">
            {TAG[condition.level] ?? 'Notice'}
          </span>

          <div>
            <strong>{condition.title}.</strong>{' '}
            <span>{condition.detail}</span>
          </div>

          {condition.alarmIds?.length ? (
            <div className="log-actions">
              <button
                type="button"
                className="btn sm"
                aria-label={`Snooze alarms: ${condition.title}`}
                onClick={() =>
                  condition.alarmIds.forEach(onSnooze)
                }
              >
                Snooze
              </button>

              <button
                type="button"
                className="btn sm primary"
                aria-label={`Dismiss alarms: ${condition.title}`}
                onClick={() =>
                  condition.alarmIds.forEach(onDismiss)
                }
              >
                Dismiss
              </button>
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  )
}
