import type { Song } from '../types/song';

export function formatDuration(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function normalizeDuration(value: unknown): string {
    if (typeof value === 'string' && /^\d{1,3}:\d{2}$/.test(value)) {
        return value;
    }

    const milliseconds = Number(value);
    return Number.isFinite(milliseconds) ? formatDuration(milliseconds) : '00:00';
}

export function transformSearchSong(raw: any): Song {
    const id = raw.songmid ?? raw.id ?? raw.songId ?? '';
    const artist = raw.singer ?? raw.artists ?? raw.artist ?? raw.artistName ?? '';
    const picUrl = raw.img ?? raw.pic ?? raw.picUrl ?? raw.cover ?? raw.m_img ?? raw.mPic ?? '';

    return {
        id: String(id),
        name: raw.name,
        artist: Array.isArray(artist) ? artist.join('、') : String(artist),
        picUrl,
        url: '', // Empty initially
        duration: normalizeDuration(raw.interval ?? raw.duration ?? raw.dt),
        source: raw.source,
        albumId: raw.albumId ? String(raw.albumId) : null,
        albumName: raw.albumName,
        type: 'Remote',
        quality: 'auto',
        types: raw.types ?? raw.qualities
    };
}
