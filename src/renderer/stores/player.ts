import { defineStore } from 'pinia';
import { ref } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import type { Song } from '../types/song';

export enum PlayMode {
    List = 'list',
    Single = 'single',
    Random = 'random'
}

// 静音 WAV Base64
const SILENT_AUDIO_URL = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

const dummyAudio = new Audio();
dummyAudio.src = SILENT_AUDIO_URL;
dummyAudio.loop = true;
dummyAudio.volume = 0.01;
if (typeof document !== 'undefined') {
    document.body.appendChild(dummyAudio);
}

export const usePlayerStore = defineStore('player', () => {
    // State
    const isPlaying = ref(false);
    const currentSong = ref<Song | null>(null);
    const volume = ref(100);
    const duration = ref(0);
    const currentTime = ref(0);

    // Playlist State
    const playlist = ref<Song[]>([]);
    const currentIndex = ref(-1);
    const playMode = ref<PlayMode>(PlayMode.List);

    // Error Handling
    const playErrorCount = ref(0);
    const MAX_RETRY_COUNT = 3;

    // --- Helpers ---

    const activateDummyAudio = async () => {
        if (dummyAudio.paused) {
            try {
                await dummyAudio.play().catch(e => console.warn('Dummy play failed:', e));
            } catch (e) {
                // Ignore
            }
        }
        if ('mediaSession' in navigator) {
            navigator.mediaSession.playbackState = 'playing';
        }
    };

    // 同步浏览器状态
    const syncDummyAudioState = (shouldPlay: boolean) => {
        if (shouldPlay) {
            if (dummyAudio.paused) {
                dummyAudio.play().catch(() => { });
            }
            if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
        } else {
            if (!dummyAudio.paused) {
                dummyAudio.pause();
            }
            if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
        }
    };

    // --- Actions ---

    // Cache: key = `${source}:${id}:${quality}`
    const urlCache = new Map<string, string>();

    const fetchUrl = async (song: Song, forceRefresh = false): Promise<string | null> => {
        if (!song.source || !song.id) return null;

        const quality = 'hires'; // TODO: Make configurable
        const cacheKey = `${song.source}:${song.id}:${quality}`;

        if (!forceRefresh && urlCache.has(cacheKey)) {
            console.log(`[Cache] Hit for ${song.name}`);
            return urlCache.get(cacheKey) || null;
        }

        console.log(`[Plugin] Fetching URL for [${song.name}] from ${song.source}...`);
        try {
            const result = await window.electronAPI.plugin.call(song.source, 'getUrl', [song.id, quality]);
            if (result.success && result.url) {
                console.log('[Plugin] Success:', result.url);
                urlCache.set(cacheKey, result.url);
                return result.url;
            } else {
                console.error('[Plugin] Failed:', result.error);
                if (!forceRefresh) MessagePlugin.error(`无法获取播放链接: ${result.error || '未知错误'}`);
                return null;
            }
        } catch (e) {
            console.error('[Plugin] Error:', e);
            return null;
        }
    };

    const setPlaylist = async (list: any[], startIndex = 0) => {
        playlist.value = list;
        currentIndex.value = startIndex;
        if (list.length > 0 && startIndex >= 0 && startIndex < list.length) {
            await playSong(list[startIndex]);
        }
    };

    const playSong = async (song: Song) => {
        if (!song) return;

        currentSong.value = song;
        const foundIndex = playlist.value.findIndex(s => s.id === song.id);
        if (foundIndex !== -1) {
            currentIndex.value = foundIndex;
        }

        await activateDummyAudio();
        updateMediaSession(song);

        // 1. Get URL (Cache -> Network)
        let playUrl = song.url;
        if (song.type === 'Remote' && song.source) {
            const fetched = await fetchUrl(song);
            if (fetched) playUrl = fetched;
        }

        if (playUrl) {
            console.log('Playing:', song.name);
            try {
                await window.electronAPI.mpv.load(playUrl);
                await window.electronAPI.mpv.play();
                isPlaying.value = true;
                // Update song object URL for UI reference if needed
                song.url = playUrl;
            } catch (e) {
                console.error("Play request failed:", e);

                // Retry Logic: If Remote and failed, force refresh URL and retry
                if (song.type === 'Remote' && song.source) {
                    console.warn("Playback failed. Retrying with fresh URL...");
                    const freshUrl = await fetchUrl(song, true); // Force Refresh
                    if (freshUrl) {
                        try {
                            await window.electronAPI.mpv.load(freshUrl);
                            await window.electronAPI.mpv.play();
                            isPlaying.value = true;
                            song.url = freshUrl;
                            return; // Success on retry
                        } catch (retryError) {
                            console.error("Retry playback failed:", retryError);
                        }
                    }
                }

                handlePlayError();
            }
        } else {
            console.warn("Song has no URL");
            handlePlayError();
        }
    };

    const updateMediaSession = (song: Song) => {
        if (!('mediaSession' in navigator)) return;

        navigator.mediaSession.metadata = new MediaMetadata({
            title: song.name,
            artist: song.artist,
            album: song.albumName || '',
            artwork: song.picUrl ? [{ src: song.picUrl, sizes: '512x512', type: 'image/png' }] : []
        });

        navigator.mediaSession.setActionHandler('play', () => window.electronAPI.mpv.play());
        navigator.mediaSession.setActionHandler('pause', () => window.electronAPI.mpv.pause());
        navigator.mediaSession.setActionHandler('previoustrack', () => prev());
        navigator.mediaSession.setActionHandler('nexttrack', () => next(true));

        navigator.mediaSession.setActionHandler('seekto', (details) => {
            if (details.seekTime != null) {
                seek(details.seekTime);
            }
        });
    };

    const next = async (manual = true) => {
        if (playlist.value.length === 0) return;
        let nextIndex = currentIndex.value;
        if (playMode.value === PlayMode.Single && !manual) {
            nextIndex = currentIndex.value;
        } else if (playMode.value === PlayMode.Random) {
            nextIndex = Math.floor(Math.random() * playlist.value.length);
        } else {
            nextIndex = (currentIndex.value + 1) % playlist.value.length;
        }
        currentIndex.value = nextIndex;
        await playSong(playlist.value[nextIndex]);
    };

    const prev = async () => {
        if (playlist.value.length === 0) return;
        let prevIndex = currentIndex.value;
        if (playMode.value === PlayMode.Random) {
            prevIndex = Math.floor(Math.random() * playlist.value.length);
        } else {
            prevIndex = (currentIndex.value - 1 + playlist.value.length) % playlist.value.length;
        }
        currentIndex.value = prevIndex;
        await playSong(playlist.value[prevIndex]);
    };

    const handlePlayError = () => {
        playErrorCount.value++;
        if (playlist.value.length === 0) {
            isPlaying.value = false;
            playErrorCount.value = 0;
            syncDummyAudioState(false);
            return;
        }
        if (playErrorCount.value >= MAX_RETRY_COUNT) {
            window.electronAPI.mpv.pause();
            isPlaying.value = false;
            MessagePlugin.error('连续多次播放失败，已停止播放');
            playErrorCount.value = 0;
            syncDummyAudioState(false);
        } else {
            MessagePlugin.warning(`播放失败，尝试播放下一首 (${playErrorCount.value}/${MAX_RETRY_COUNT})`);
            setTimeout(() => next(false), 1000);
        }
    };

    // Listeners
    if (window.electronAPI) {
        window.electronAPI.mpv.onEvent((_event, data) => {
            if (data.event === 'property-change') {
                if (data.name === 'pause') {
                    const isPaused = data.data;
                    isPlaying.value = !isPaused;
                    // 核心：MPV 暂停 -> 同步暂停 Dummy -> 浏览器更新 SMTC 状态
                    syncDummyAudioState(!isPaused);
                }
                if (data.name === 'time-pos') currentTime.value = data.data;
                if (data.name === 'duration') duration.value = data.data;
            }

            if (data.event === 'end-file') {
                const reason = data.reason;
                if (reason === 'eof') {
                    next(false);
                } else if (reason === 'error') {
                    handlePlayError();
                }
            }
        });
    }

    const togglePlay = async () => {
        await window.electronAPI.mpv.togglePause();
    };

    const setVolume = async (vol: number) => {
        volume.value = vol;
        await window.electronAPI.mpv.setVolume(vol);
    };

    const seek = async (time: number) => {
        await window.electronAPI.mpv.seek(time);
    };

    const toggleMode = () => {
        if (playMode.value === PlayMode.List) playMode.value = PlayMode.Single;
        else if (playMode.value === PlayMode.Single) playMode.value = PlayMode.Random;
        else playMode.value = PlayMode.List;
    };

    return {
        isPlaying,
        currentSong,
        volume,
        duration,
        currentTime,
        playlist,
        playMode,
        setPlaylist,
        playSong,
        next,
        prev,
        togglePlay,
        setVolume,
        seek,
        toggleMode
    };
});