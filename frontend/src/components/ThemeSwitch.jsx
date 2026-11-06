import { useTheme } from '../lib/theme'

export default function ThemeSwitch() {
  const [theme, setTheme] = useTheme()
  const opts = [['light', 'Day'], ['auto', 'Auto'], ['dark', 'Night']]
  return (
    <div className="seg" role="group" aria-label="Colour theme">
      {opts.map(([v, label]) => (
        <button key={v} aria-pressed={theme === v} onClick={() => setTheme(v)}>{label}</button>
      ))}
    </div>
  )
}
