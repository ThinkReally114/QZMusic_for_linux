import {LyricLine, parseLrc, parseQrc, parseTTML, parseYrc} from "@applemusic-like-lyrics/lyric";
const sanitizeLyricLines = (lines: LyricLine[]): LyricLine[] => {
    const defaultLineDuration = 3000
    const toFiniteNumber = (v: any, fallback: number) => {
        const n = typeof v === 'number' ? v : Number(v)
        return Number.isFinite(n) ? n : fallback
    }
    const cleaned: LyricLine[] = []
    for (const rawLine of lines || []) {
        const rawWords = Array.isArray((rawLine as any).words) ? (rawLine as any).words : []
        const fixedWords: any[] = []
        let prevEnd = -1
        for (const rawWord of rawWords) {
            const rawStart = toFiniteNumber(rawWord?.startTime, Number.NaN)
            const rawEnd = toFiniteNumber(rawWord?.endTime, Number.NaN)
            if (!Number.isFinite(rawStart)) continue
            let startTime = Math.max(0, rawStart)
            if (startTime < prevEnd) startTime = prevEnd
            let endTime = Number.isFinite(rawEnd) ? rawEnd : startTime + 1
            if (endTime <= startTime) endTime = startTime + 1
            prevEnd = endTime
            fixedWords.push({ ...rawWord, startTime, endTime })
        }
        if (fixedWords.length === 0) continue

        const firstWordStart = fixedWords[0].startTime
        const lastWordEnd = fixedWords[fixedWords.length - 1].endTime
        let startTime = toFiniteNumber((rawLine as any).startTime, firstWordStart)
        startTime = Math.max(0, startTime)
        let endTime = toFiniteNumber((rawLine as any).endTime, lastWordEnd)
        if (!Number.isFinite(endTime) || endTime <= startTime) endTime = startTime + defaultLineDuration
        if (endTime < lastWordEnd) endTime = lastWordEnd

        cleaned.push({ ...(rawLine as any), startTime, endTime, words: fixedWords })
    }
    cleaned.sort((a: any, b: any) => (a?.startTime ?? 0) - (b?.startTime ?? 0))
    return cleaned
}
interface LyricData {
    ttml?: string,
    yrc?: string,
    lrc?: string,
    qrc?: string
}
export function parseLyric(lyric: LyricData):LyricLine[] {
    let parsed:LyricLine[] = []
    if (lyric.ttml != undefined) {
        parsed = parseTTML(lyric.ttml).lines;
    } else if (lyric.yrc != undefined) {
        parsed = parseYrc(lyric.yrc);
    } else if (lyric.lrc != undefined) {
        parsed = parseLrc(lyric.lrc);
    } else if (lyric.qrc != undefined) {
        parsed = parseQrc(lyric.qrc)
    }
    return sanitizeLyricLines(parsed);
}