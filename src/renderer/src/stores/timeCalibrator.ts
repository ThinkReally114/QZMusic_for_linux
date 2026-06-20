const API_BASE_URL = 'https://api.qz.shiqianjiang.cn/app'
const CALIBRATE_ROUNDS = 3

let offsetMs = 0

async function singleCalibrate(): Promise<{ offset: number; rtt: number } | null> {
    const localBefore = Date.now()
    try {
        const resp = await fetch(`${API_BASE_URL}/time`, { cache: 'no-store' })
        const localAfter = Date.now()
        if (!resp.ok) return null
        const data = await resp.json() as { timestamp: number }
        const rtt = localAfter - localBefore
        const offset = data.timestamp + Math.floor(rtt / 2) - localAfter
        return { offset, rtt }
    } catch {
        return null
    }
}

export async function calibrateTime(): Promise<void> {
    let bestOffset = 0
    let minRtt = Infinity

    for (let i = 0; i < CALIBRATE_ROUNDS; i++) {
        const result = await singleCalibrate()
        if (!result) continue
        if (result.rtt < minRtt) {
            minRtt = result.rtt
            bestOffset = result.offset
        }
        console.debug(`[TimeCalibrator] Round ${i}: rtt=${result.rtt}ms, offset=${result.offset}ms`)
    }

    if (minRtt < Infinity) {
        offsetMs = bestOffset
        console.log(`[TimeCalibrator] Calibrated: offset=${offsetMs}ms (best rtt=${minRtt}ms)`)
    }
}

export function calibratedNow(): number {
    return Date.now() + offsetMs
}
