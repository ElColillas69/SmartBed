import { Minus, Plus } from 'lucide-react'

export function Card({ title, action, className = '', children }) {
  return (
    <section className={`block ${className}`}>
      {(title || action) && (
        <div className="block-head">
          <h2>{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

export function Switch({ checked, onChange, label, disabled }) {
  return (
    <label className="switch">
      <input type="checkbox" role="switch" aria-label={label} checked={checked} disabled={disabled}
        onChange={(e) => onChange(e.target.checked)} />
      <span className="track" />
      <span className="thumb" />
    </label>
  )
}

export function Stepper({ value, onChange, step = 0.5, min, max, format = (v) => v, label }) {
  const clamp = (v) => Math.min(max, Math.max(min, Math.round(v / step) * step))
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button className="btn icon" aria-label={`Lower ${label}`} disabled={value <= min}
        onClick={() => onChange(clamp(value - step))}><Minus size={16} /></button>
      <output aria-live="polite">{format(value)}</output>
      <button className="btn icon" aria-label={`Raise ${label}`} disabled={value >= max}
        onClick={() => onChange(clamp(value + step))}><Plus size={16} /></button>
    </div>
  )
}

export function PageHead({ kicker, title, children }) {
  return (
    <header className="page-head">
      <div>
        {kicker && <div className="kicker">{kicker}</div>}
        <h1>{title}</h1>
      </div>
      {children}
    </header>
  )
}

export function BedMark({ className = 'brand-mark' }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 8v18M5 21h22v5M5 17h22v4" />
      <rect x="8" y="12.5" width="7" height="4.5" rx="1.5" />
    </svg>
  )
}
