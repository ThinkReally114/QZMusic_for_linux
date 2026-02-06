import type { Song } from '../types/song';

export function formatDuration(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export function transformSearchSong(raw: any): Song {
    return {
        id: String(raw.songmid),
        name: raw.name,
        artist: raw.singer,
        picUrl: raw.img || raw.m_img || raw.s_img,
        url: '', // Empty initially
        duration: formatDuration(raw.interval ? Number(raw.interval) : 0),
        source: raw.source,
        albumId: raw.albumId ? String(raw.albumId) : null,
        albumName: raw.albumName,
        type: 'Remote',
        quality: 'auto',
        types: raw.types // Store raw types for quality selection later
    };
}
