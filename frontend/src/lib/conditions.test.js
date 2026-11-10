import { describe, expect, it } from 'vitest'
import { CARE_DEFAULTS } from './care'
import { deriveConditions, isStale, lastChange } from './conditions'
import { agoText, isWithinWindow, minutesText, nextAlarm, parseTime } from './time'

const at = (iso) => new Date(iso)
const reading = (minutesAgo, occupied, now, extra = {}) => ({
  recorded_at: new Date(now - minutesAgo * 60000).toISOString(), occupied,
  temperature_c: 20, humidity_percent: 50, light_level: 50, light_warning: false, ...extra,
})

describe('time helpers', () => {
  it('treats timestamps without an offset as UTC', () => {
    expect(parseTime('2026-10-30T04:00:00').toISOString()).toBe('2026-10-30T04:00:00.000Z')
    expect(parseTime('2026-10-30T04:00:00+01:00').toISOString()).toBe('2026-10-30T03:00:00.000Z')
  })
  it('writes short durations in words', () => {
    expect(minutesText(1)).toBe('1 minute')
    expect(minutesText(34)).toBe('34 minutes')
    expect(minutesText(60)).toBe('1 hour')
    expect(minutesText(125)).toBe('2h 05m')
    expect(agoText(0.3)).toBe('a moment ago')
    expect(agoText(73)).toBe('1h 13m ago')
    expect(agoText(72 * 60 + 51)).toBe('3 days ago')
  })
  it('handles night windows that wrap midnight', () => {
    expect(isWithinWindow(at('2026-10-30T23:30:00'), '21:00', '07:00')).toBe(true)
    expect(isWithinWindow(at('2026-10-30T03:00:00'), '21:00', '07:00')).toBe(true)
    expect(isWithinWindow(at('2026-10-30T12:00:00'), '21:00', '07:00')).toBe(false)
  })
})

describe('conditions', () => {
  const now = at('2026-10-30T03:00:00')
  it('finds when the bed last changed state', () => {
    const readings = [reading(0, false, now), reading(10, false, now), reading(15, true, now)]
    expect(lastChange(readings).since).toEqual(new Date(now - 10 * 60000))
  })
  it('raises a critical alert once the grace period has passed at night', () => {
    const readings = [reading(0, false, now), reading(25, false, now), reading(30, true, now)]
    const out = deriveConditions({ latest: readings[0], readings, care: CARE_DEFAULTS, now })
    expect(out[0]).toMatchObject({ id: 'exit', level: 'critical', title: 'Out of bed for 25 minutes' })
  })
  it('never says "0m" when alerting straight away', () => {
    const readings = [reading(0, false, now), reading(0.5, true, now)]
    const out = deriveConditions({ latest: readings[0], readings, care: { ...CARE_DEFAULTS, graceMinutes: 0 }, now })
    expect(out[0]).toMatchObject({ level: 'critical', title: 'Just got out of bed' })
    expect(out[0].detail).not.toMatch(/\b0[- ]?m/)
  })
  it('only notes a short exit', () => {
    const readings = [reading(0, false, now), reading(5, false, now), reading(10, true, now)]
    const out = deriveConditions({ latest: readings[0], readings, care: CARE_DEFAULTS, now })
    expect(out[0]).toMatchObject({ id: 'exit', level: 'info' })
  })
  it('flags climate limits and stale data', () => {
    const readings = [reading(30, true, now, { temperature_c: 16, humidity_percent: 80 })]
    const ids = deriveConditions({ latest: readings[0], readings, care: CARE_DEFAULTS, now }).map((c) => c.id)
    expect(ids).toEqual(expect.arrayContaining(['stale', 'cold', 'humid']))
  })
  it('describes temperature against the preferred range, with the heater target', () => {
    const readings = [reading(0, true, now, { temperature_c: 16.4 })]
    const heating = { target_temperature_c: 21, heating_enabled: true }
    const cold = deriveConditions({ latest: readings[0], readings, care: CARE_DEFAULTS, heating, now }).find((c) => c.id === 'cold')
    expect(cold).toMatchObject({ title: 'Room is cold', detail: '16.4°C, below the preferred range (18–26°C). Heater target is 21°C.' })
  })
  it('speaks in the past tense when the data is stale', () => {
    const readings = [reading(30, true, now, { temperature_c: 16.4 })]
    expect(isStale(readings[0], now)).toBe(true)
    expect(isStale(reading(2, true, now), now)).toBe(false)
    const cold = deriveConditions({ latest: readings[0], readings, care: CARE_DEFAULTS, now }).find((c) => c.id === 'cold')
    expect(cold).toMatchObject({ title: 'Room was cold', detail: '16.4°C at the last reading, below the preferred range (18–26°C).' })
  })
})

describe('nextAlarm', () => {
  const alarms = [{ time: '07:30', enabled: true }, { time: '21:00', enabled: true }, { time: '12:00', enabled: false }]
  it('picks the next one still to come today', () => {
    expect(nextAlarm(alarms, at('2026-10-30T08:00:00')).time).toBe('21:00')
  })
  it('wraps to tomorrow after the last one', () => {
    expect(nextAlarm(alarms, at('2026-10-30T22:00:00')).time).toBe('07:30')
  })
})
