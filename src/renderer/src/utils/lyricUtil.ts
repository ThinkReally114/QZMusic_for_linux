import {
    type LyricLine,
    type LyricWord,
    parseLrc,
    parseQrc,
    parseTTML,
    parseYrc,
} from '@applemusic-like-lyrics/lyric'

export type LyricFormat = 'ttml' | 'krc' | 'yrc' | 'qrc' | 'lrc'

type LyricData = {
    ttml?: string
    krc?: string
    yrc?: string
    qrc?: string
    lrc?: string
    lyric?: string
    translate?: string
    translatedLyric?: string
    tlyric?: string
    romalrc?: string
    rlyric?: string
    romanLyric?: string
    [key: string]: unknown
}

const defaultLineDuration = 3000

export function detectLyricFormat(rawLyric: string): LyricFormat | null {
    if (!rawLyric?.trim()) return null

    const raw = rawLyric.trim()
    const lowerRaw = raw.toLowerCase()

    if (
        (lowerRaw.startsWith('<tt') || lowerRaw.startsWith('<?xml')) &&
        raw.endsWith('>')
    ) {
        return 'ttml'
    }

    if (/\[\d+,\d+][^<]*<\d+,\d+,\d+>/.test(raw)) {
        return 'krc'
    }

    if (/\[\d+,\d+][^(]*\(\d+,\d+,\d+\)/.test(raw)) {
        return 'yrc'
    }

    if (/\[\d+,\d+][^(]*\(\d+,\d+\)/.test(raw)) {
        return 'qrc'
    }

    if (/\[\d{2,}:\d{2}(?:\.\d{1,3})?]/.test(raw)) {
        return 'lrc'
    }

    return null
}

function createKrcLine(
    lineStart: number,
    lineDuration: number,
    words: LyricWord[],
): LyricLine {
    return {
        startTime: lineStart,
        endTime: lineStart + lineDuration,
        words,
        translatedLyric: '',
        romanLyric: '',
        isBG: false,
        isDuet: false,
    }
}

function parseKrc(krc: string): LyricLine[] {
    const linePattern = /^\[(\d+),(\d+)](.*)$/
    const timedWordPattern = /<(\d+),(\d+),\d+>([^<]*)/g

    return krc
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
            const lineMatch = line.match(linePattern)
            if (!lineMatch) return null

            const lineStart = Number(lineMatch[1])
            const lineDuration = Number(lineMatch[2])
            const content = lineMatch[3]
            const words: LyricWord[] = []

            for (const match of content.matchAll(timedWordPattern)) {
                const offset = Number(match[1])
                const duration = Number(match[2])
                const text = match[3]
                if (!text) continue

                const startTime = lineStart + offset
                words.push({
                    word: text,
                    startTime,
                    endTime: startTime + Math.max(1, duration),
                })
            }

            if (words.length === 0) {
                const text = content.replace(/<\d+,\d+,\d+>/g, '').trim()
                if (!text) return null
                words.push({
                    word: text,
                    startTime: lineStart,
                    endTime: lineStart + Math.max(1, lineDuration),
                })
            }

            return createKrcLine(lineStart, lineDuration, words)
        })
        .filter((line): line is LyricLine => line !== null)
}

function normalizeLyricData(input: unknown): LyricData | null {
    if (typeof input === 'string') {
        const raw = input.trim()
        if (!raw) return null

        if (raw.startsWith('{')) {
            try {
                return normalizeLyricData(JSON.parse(raw))
            } catch (err) {
                console.warn('[Lyric] Invalid JSON lyric payload:', err)
                return null
            }
        }

        const format = detectLyricFormat(raw)
        return format ? { [format]: raw } : null
    }

    if (!input || typeof input !== 'object') return null

    const data = input as LyricData
    if (
        typeof data.ttml === 'string' ||
        typeof data.krc === 'string' ||
        typeof data.yrc === 'string' ||
        typeof data.qrc === 'string' ||
        typeof data.lrc === 'string'
    ) {
        return data
    }

    if (typeof data.lyric === 'string') {
        const format = detectLyricFormat(data.lyric)
        if (format) {
            return {
                ...data,
                [format]: data.lyric,
            }
        }
    }

    return data
}

function parsePrimaryLyric(data: LyricData): LyricLine[] {
    if (typeof data.ttml === 'string') return parseTTML(data.ttml).lines
    if (typeof data.krc === 'string') return parseKrc(data.krc)
    if (typeof data.yrc === 'string') return parseYrc(data.yrc)
    if (typeof data.qrc === 'string') return parseQrc(data.qrc)
    if (typeof data.lrc === 'string') return parseLrc(data.lrc)
    return []
}

function lineText(line: LyricLine): string {
    return line.words.map((word) => word.word).join('').trim()
}

function attachSupplementalLyric(
    lines: LyricLine[],
    rawLyric: unknown,
    field: 'translatedLyric' | 'romanLyric',
): void {
    if (typeof rawLyric !== 'string' || !rawLyric.trim() || lines.length === 0) return

    let supplemental: LyricLine[]
    try {
        supplemental = parseLrc(rawLyric)
    } catch (err) {
        console.warn(`[Lyric] Failed to parse ${field}:`, err)
        return
    }

    for (const extraLine of supplemental) {
        const text = lineText(extraLine)
        if (!text) continue

        let target = lines.find((line) => line.startTime === extraLine.startTime)
        if (!target) {
            target = lines.find(
                (line) => Math.abs(line.startTime - extraLine.startTime) <= 250,
            )
        }
        if (target) target[field] = text
    }
}

const toFiniteNumber = (value: unknown, fallback: number): number => {
    const number = typeof value === 'number' ? value : Number(value)
    return Number.isFinite(number) ? number : fallback
}

const sanitizeLyricLines = (lines: LyricLine[]): LyricLine[] => {
    const cleaned: LyricLine[] = []

    for (const rawLine of lines || []) {
        const rawWords = Array.isArray(rawLine?.words) ? rawLine.words : []
        const fixedWords: LyricWord[] = []
        let previousEnd = -1

        for (const rawWord of rawWords) {
            const rawStart = toFiniteNumber(rawWord?.startTime, Number.NaN)
            const rawEnd = toFiniteNumber(rawWord?.endTime, Number.NaN)
            if (!Number.isFinite(rawStart)) continue

            let startTime = Math.max(0, rawStart)
            if (startTime < previousEnd) startTime = previousEnd

            let endTime = Number.isFinite(rawEnd) ? rawEnd : startTime + 1
            if (endTime <= startTime) endTime = startTime + 1
            previousEnd = endTime

            fixedWords.push({ ...rawWord, startTime, endTime })
        }

        if (fixedWords.length === 0) continue

        const firstWordStart = fixedWords[0].startTime
        const lastWordEnd = fixedWords[fixedWords.length - 1].endTime
        const startTime = Math.max(
            0,
            toFiniteNumber(rawLine.startTime, firstWordStart),
        )
        let endTime = toFiniteNumber(rawLine.endTime, lastWordEnd)

        if (!Number.isFinite(endTime) || endTime <= startTime) {
            endTime = startTime + defaultLineDuration
        }
        if (endTime < lastWordEnd) endTime = lastWordEnd

        cleaned.push({
            ...rawLine,
            startTime,
            endTime,
            words: fixedWords,
        })
    }

    cleaned.sort((a, b) => a.startTime - b.startTime)
    return cleaned
}

export function parseLyric(input: unknown): LyricLine[] {
    const data = normalizeLyricData(input)
    if (!data) return []

    try {
        const parsed = parsePrimaryLyric(data)
        attachSupplementalLyric(
            parsed,
            data.translate ?? data.translatedLyric ?? data.tlyric,
            'translatedLyric',
        )
        attachSupplementalLyric(
            parsed,
            data.romalrc ?? data.rlyric ?? data.romanLyric,
            'romanLyric',
        )
        return sanitizeLyricLines(parsed)
    } catch (err) {
        console.error('[Lyric] Failed to parse lyric payload:', err)
        return []
    }
}
