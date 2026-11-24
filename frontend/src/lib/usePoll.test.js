
import {
    describe,
    expect,
    it,
    vi,
} from 'vitest'

import { createLatestRequestGate } from './usePoll'

// Creates a promise whose completion we control.
function deferred() {
    let resolve
    let reject

    const promise = new Promise((res, rej) => {
        resolve = res
        reject = rej
    })

    return { promise, resolve, reject }
}

describe('SmartBed polling reliability', () => {
    it('ignores an older response arriving last', async () => {
        const gate = createLatestRequestGate()
        const older = deferred()
        const newer = deferred()
        const updates = []
        const errors = []

        const first = gate.run(
            () => older.promise,
            (data) => updates.push(data),
            (error) => errors.push(error)
        )

        const second = gate.run(
            () => newer.promise,
            (data) => updates.push(data),
            (error) => errors.push(error)
        )

        newer.resolve('new reading')
        await second

        older.resolve('old reading')
        await first

        expect(updates).toEqual(['new reading'])
        expect(errors).toEqual([])
    })

    it('ignores an outdated request failure', async () => {
        const gate = createLatestRequestGate()
        const older = deferred()
        const newer = deferred()

        const onSuccess = vi.fn()
        const onError = vi.fn()

        const first = gate.run(
            () => older.promise,
            onSuccess,
            onError
        )

        const second = gate.run(
            () => newer.promise,
            onSuccess,
            onError
        )

        newer.resolve('latest data')
        await second

        older.reject(new Error('Old network error'))
        await first

        expect(onSuccess).toHaveBeenCalledOnce()
        expect(onSuccess).toHaveBeenCalledWith(
            'latest data'
        )
        expect(onError).not.toHaveBeenCalled()
    })

    it('reports failure from the newest request', async () => {
        const gate = createLatestRequestGate()

        const onSuccess = vi.fn()
        const onError = vi.fn()

        const error = new Error('Server unavailable')

        await gate.run(
            () => Promise.reject(error),
            onSuccess,
            onError
        )

        expect(onSuccess).not.toHaveBeenCalled()
        expect(onError).toHaveBeenCalledWith(error)
    })

    it('ignores responses after invalidation', async () => {
        const gate = createLatestRequestGate()
        const pending = deferred()

        const onSuccess = vi.fn()
        const onError = vi.fn()

        const request = gate.run(
            () => pending.promise,
            onSuccess,
            onError
        )

        // Simulate the component unmounting.
        gate.invalidate()

        pending.resolve('old bed data')
        await request

        expect(onSuccess).not.toHaveBeenCalled()
        expect(onError).not.toHaveBeenCalled()
    })
})
