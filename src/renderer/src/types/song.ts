// Song Type Definition

export type SongType = 'Local' | 'Remote';

export interface SongQualityMap {
    [quality: string]: string; // e.g., "standard": "5.5M", "exhigh": "8.0M"
}

export interface Song {
    id: string;
    hash?: string | null;
    picUrl: string;
    url: string;
    name: string;
    artist: string;
    duration: string;
    source: string;
    quality?: string; // default 'auto'
    albumId?: string | null;
    albumName?: string | null;
    artistIds?: string[] | null;
    type: SongType;
    types?: SongQualityMap;
}
