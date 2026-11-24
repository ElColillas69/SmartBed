
import { NavLink } from 'react-router-dom'
import { Card, PageHead } from '../components/ui'
import { useBed } from '../lib/BedData'
import { duration, nightLabel } from '../lib/time'
import { reportCsv } from '../lib/report'
import NoData from './NoData'

// Navigation shared with the Nights page.
export function NightsTabs() {
  return (
    <nav
      className="nights-tabs seg"
      aria-label="Sleep history views"
    >
      <NavLink to="/sleep" end>
        Nights
      </NavLink>

      <NavLink to="/sleep/week">
        Weekly report
      </NavLink>
    </nav>
  )
}

// Safely convert an API value into a number.
function asNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function averageOf(nights, field, decimals = 1) {
  const values = nights
    .map((night) => asNumber(night[field]))
    .filter((value) => value !== null)

  if (!values.length) return null

  const average =
    values.reduce((sum, value) => sum + value, 0) /
    values.length

  return average.toFixed(decimals)
}

// Calculate statistics using completed nights only.
export function summariseWeek(nights, goal) {
  const completed = (Array.isArray(nights) ? nights : [])
    .filter((night) => night && !night.in_progress)

  if (!completed.length) return null

  const total = (field) =>
    completed.reduce(
      (sum, night) => sum + (asNumber(night[field]) ?? 0),
      0
    )

  const sleepGoal = asNumber(goal) ?? 450

  return {
    count: completed.length,

    averageMinutes: Math.round(
      total('in_bed_minutes') / completed.length
    ),

    totalExits: total('bed_exits'),

    goalNights: completed.filter(
      (night) =>
        (asNumber(night.in_bed_minutes) ?? 0) >= sleepGoal
    ).length,

    avgTemperature: averageOf(
      completed,
      'avg_temperature_c',
      1
    ),

    avgHumidity: averageOf(
      completed,
      'avg_humidity_percent',
      0
    ),
  }
}

export default function WeekReport() {
  const { nights, care } = useBed()

  // Loading and API errors.
  if (!Array.isArray(nights.data)) {
    return (
      <>
        <NightsTabs />
        <NoData state={nights} />
      </>
    )
  }

  const data = nights.data.filter(
    (night) => night && !night.in_progress
  )

  const thisWeek = summariseWeek(
    data.slice(0, 7),
    care?.sleepGoalMinutes ?? 450
  )

  // Download completed nights as CSV.
  const download = () => {
    const csv = reportCsv(data)

    const blob = new Blob([csv], {
      type: 'text/csv;charset=utf-8',
    })

    const url = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.href = url
    link.download = 'smartbed-weekly-report.csv'

    document.body.appendChild(link)
    link.click()
    link.remove()

    URL.revokeObjectURL(url)
  }

  return (
    <>
      <NightsTabs />

      <PageHead
        kicker="Completed nights only"
        title="Weekly sleep report"
      />

      {!thisWeek ? (
        <NoData empty />
      ) : (
        <>
          <div className="report-tools no-print">
            <button
              type="button"
              className="btn"
              onClick={download}
            >
              Export CSV
            </button>

            <button
              type="button"
              className="btn ghost"
              onClick={() => window.print()}
            >
              Print report
            </button>
          </div>

          <p className="note">
            Based on {thisWeek.count} completed night
            {thisWeek.count === 1 ? '' : 's'} of
            recorded bed occupancy. This is not a
            medical sleep assessment.
          </p>

          <dl className="facts summary">
            <div>
              <dt>Average time in bed</dt>
              <dd>{duration(thisWeek.averageMinutes)}</dd>
            </div>

            <div>
              <dt>Nights meeting goal</dt>
              <dd>
                {thisWeek.goalNights} / {thisWeek.count}
              </dd>
            </div>

            <div>
              <dt>Bed exits</dt>
              <dd>{thisWeek.totalExits}</dd>
            </div>

            <div>
              <dt>Average temperature</dt>
              <dd>
                {thisWeek.avgTemperature === null
                  ? '—'
                  : `${thisWeek.avgTemperature}°C`}
              </dd>
            </div>

            <div>
              <dt>Average humidity</dt>
              <dd>
                {thisWeek.avgHumidity === null
                  ? '—'
                  : `${thisWeek.avgHumidity}%`}
              </dd>
            </div>
          </dl>

          <Card title="Completed nights">
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Night</th>
                    <th scope="col">In bed</th>
                    <th scope="col">Exits</th>
                    <th scope="col">Temp</th>
                    <th scope="col">Humidity</th>
                  </tr>
                </thead>

                <tbody>
                  {data.map((night, index) => {
                    const temperature = asNumber(
                      night.avg_temperature_c
                    )

                    const humidity = asNumber(
                      night.avg_humidity_percent
                    )

                    return (
                      <tr key={`${night.night}-${index}`}>
                        <td>{nightLabel(night.night)}</td>

                        <td>
                          {duration(
                            asNumber(night.in_bed_minutes)
                          )}
                        </td>

                        <td>
                          {asNumber(night.bed_exits) ?? '—'}
                        </td>

                        <td>
                          {temperature === null
                            ? '—'
                            : `${temperature.toFixed(1)}°C`}
                        </td>

                        <td>
                          {humidity === null
                            ? '—'
                            : `${Math.round(humidity)}%`}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </>
  )
}
