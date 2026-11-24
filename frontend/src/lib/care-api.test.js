
import {
    afterEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest'

import { api, session } from './api'

const care = {
    residentName: 'Maureen',
    graceMinutes: 20,
    nightStart: '21:00',
    nightEnd: '07:00',
    sleepGoalMinutes: 450,
    lowTemp: 18,
    highTemp: 26,
    humidityLimit: 70,
}

afterEach(() => {
    vi.unstubAllGlobals()
    session.setToken(null)
    session.setBed(null)
})

describe('Shared care preferences API', () => {
    it('loads preferences using the selected bed ID', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => care,
        })

        vi.stubGlobal('fetch', fetchMock)
        session.setToken('test-token')

        const result = await api.carePreferences('bed-123')

        expect(result).toEqual(care)
        expect(fetchMock).toHaveBeenCalledWith(
            '/api/beds/bed-123/care',
            expect.objectContaining({
                method: 'GET',
                headers: {
                    Authorization: 'Bearer test-token',
                },
            })
        )
    })

    it('saves preferences with PUT', async () => {
        const updated = {
            ...care,
            graceMinutes: 15,
        }

        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => updated,
        })

        vi.stubGlobal('fetch', fetchMock)

        const result = await api.updateCarePreferences(
            'bed-123',
            updated
        )

        expect(result.graceMinutes).toBe(15)

        const [url, options] = fetchMock.mock.calls[0]

        expect(url).toBe('/api/beds/bed-123/care')
        expect(options.method).toBe('PUT')
        expect(JSON.parse(options.body)).toEqual(updated)
    })

    it('reports a server error instead of silently saving', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: false,
                status: 500,
                json: async () => ({
                    detail: 'Database unavailable',
                }),
            })
        )

        await expect(
            api.updateCarePreferences('bed-123', care)
        ).rejects.toThrow('Database unavailable')
    })
})
