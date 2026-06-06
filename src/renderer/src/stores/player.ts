import { defineStore } from 'pinia';
import { ref, shallowRef, watch } from 'vue';
import { ElMessage } from 'element-plus';
import type { Song } from '../types/song';
import { parseLyric } from '../utils/lyricUtil'
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
    const savedVolume = localStorage.getItem('qz-player-volume');
    const volume = ref(savedVolume ? Number(savedVolume) : 50); // 1~100

    // Persistence & Sync
    watch(volume, (newVol) => {
        localStorage.setItem('qz-player-volume', newVol.toString());
    });
    // Sync initial volume to backend
    if (window.electronAPI?.qzplayer) {
        window.electronAPI.qzplayer.setVolume(volume.value).catch(console.error);
    }
    const duration = ref(0); //毫秒级
    const currentTime = ref(0); //毫秒级

    // Audio Visualization State
    const loudness = ref(0);
    const spectrum = ref<number[]>([]);

    // UI State
    const isPlayerFullScreen = ref(false);
    const hideLyricView = ref(false);

    // Playlist State
    const savedPlaylist = localStorage.getItem('qz-player-playlist');
    const savedIndex = localStorage.getItem('qz-player-index');

    const playlist = ref<Song[]>(savedPlaylist ? JSON.parse(savedPlaylist) : []);
    const currentIndex = ref(savedIndex ? Number(savedIndex) : -1);
    const playMode = ref<PlayMode>(PlayMode.List);
    const savedAddMode = localStorage.getItem('qz-player-add-mode');
    const addListMode = ref<'replace' | 'append'>((savedAddMode as 'replace' | 'append') || 'replace');

    // Error Handling
    const playErrorCount = ref(0);
    const MAX_RETRY_COUNT = 3;
    const hasRetriedWithFreshUrl = ref(false);

    // Lyrics State
    const lyrics = shallowRef<{ lines: any[] }>({ lines: [] });

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

    const setPlaylist = async (list: any[], startIndex = 0) => {
        // Legacy support or direct set
        playlist.value = list;
        currentIndex.value = startIndex;
        if (list.length > 0 && startIndex >= 0 && startIndex < list.length) {
            await playSong(list[startIndex]);
        }
    };

    const playFromList = async (song: Song, contextList: Song[]) => {
        if (addListMode.value === 'replace') {
            // Replace Mode: Replace playlist with context list and play song
            // Find index in context list
            const index = contextList.findIndex(s => s.id === song.id);
            if (index !== -1) {
                await setPlaylist(contextList, index);
            } else {
                // Fallback: just play song if not found in list (shouldn't happen usually)
                await setPlaylist([song], 0);
            }
        } else {
            // Append Mode: Add song to end of current playlist and play it
            // Check if song already exists in playlist to avoid duplicates? 
            // User request says "append", usually means just add it. 
            // But if it's already there? Let's just add it to the end for now as requested "put clicked song to end".

            // Push to playlist
            playlist.value.push(song);
            const newIndex = playlist.value.length - 1;
            currentIndex.value = newIndex;
            await playSong(song);
        }
    };

    const playSong = async (song: Song, autoPlay = true) => {
        if (!song) return;
        console.log(song);
        currentSong.value = song;
        const foundIndex = playlist.value.findIndex(s => s.id === song.id);
        if (foundIndex !== -1) {
            currentIndex.value = foundIndex;
        }

        await activateDummyAudio();
        updateMediaSession(song);
        fetchLyrics(song);

        // Get URL (Cache -> Network)
        let playUrl = song.url;
        if (song.type === 'Remote' && song.source) {
            // Use Local Proxy
            const quality = 'hires';
            playUrl = `http://localhost:5266/music?source=${song.source}&id=${song.id}&quality=${quality}`;
            console.log('[Player] Using Proxy:', playUrl);
        }

        if (playUrl) {
            console.log('Playing:', song.name, 'AutoPlay:', autoPlay);
            // Reset retry flag for new playback attempt
            hasRetriedWithFreshUrl.value = false;
            try {
                await window.electronAPI.qzplayer.load(playUrl);
                if (autoPlay) {
                    await window.electronAPI.qzplayer.play();
                    isPlaying.value = true;
                } else {
                    // Ensure it's paused if load auto-starts and we don't want it to
                    // But usually we just don't call play. If loadfile auto-plays, we might need to pause.
                    // For now, let's assume load doesn't force play or we can pause immediately.
                    // Actually, let's force pause just in case loadfile defaults to play.
                    await window.electronAPI.qzplayer.pause();
                    isPlaying.value = false;
                    syncDummyAudioState(false);
                }
                song.url = playUrl;
            } catch (e) {
                // IPC call failed (rare), handle sync error
                console.error("IPC Play request failed:", e);
                if (autoPlay) handlePlayError().then();
            }
        } else {
            console.warn("Song has no URL");
            if (autoPlay) handlePlayError().then();
        }
    };

    const fetchLyrics = async (song: Song) => {
        lyrics.value = { lines: [] }; // Reset
        if (!song || !song.id) return;
        try {
            //Check if plugin API exists
            if (window.electronAPI?.plugin?.getLyric) {
                const rawLyric = await window.electronAPI.plugin.getLyric(song.source || 'kw', song.id.toString());
                lyrics.value = { lines: parseLyric(rawLyric) }
                console.log(lyrics.value)
            } else {
                ElMessage.warning("当前插件不支持歌词获取")
            }
        } catch (e) {
            console.error('Failed to fetch lyrics:', e);
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

        navigator.mediaSession.setActionHandler('play', () => window.electronAPI.qzplayer.play());
        navigator.mediaSession.setActionHandler('pause', () => window.electronAPI.qzplayer.pause());
        navigator.mediaSession.setActionHandler('previoustrack', () => prev());
        navigator.mediaSession.setActionHandler('nexttrack', () => next(true));

        navigator.mediaSession.setActionHandler('seekto', (details) => {
            if (details.seekTime != null) {
                seek(details.seekTime).then();
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

    const handlePlayError = async () => {
        // Proxy handles refreshing internally, so we rely on qzplayer error/retry for now.
        // Or we could implement a mechanism to tell proxy to invalidate cache if this fails repeatedly (future work).

        // Normal error handling
        playErrorCount.value++;
        hasRetriedWithFreshUrl.value = false;

        if (playlist.value.length === 0) {
            isPlaying.value = false;
            playErrorCount.value = 0;
            syncDummyAudioState(false);
            return;
        }
        if (playErrorCount.value >= MAX_RETRY_COUNT) {
            window.electronAPI.qzplayer.pause().then();
            isPlaying.value = false;
            ElMessage.error('连续多次播放失败，已停止播放');
            playErrorCount.value = 0;
            syncDummyAudioState(false);
        } else {
            ElMessage.warning(`播放失败，尝试播放下一首 (${playErrorCount.value}/${MAX_RETRY_COUNT})`);
            next(false)
        }
    };

    // Listeners
    if (window.electronAPI) {
        window.electronAPI.qzplayer.onEvent((_event, data) => {
            if (data.event === 'property-change') {
                if (data.name === 'pause') {
                    const isPaused = data.data;
                    isPlaying.value = !isPaused;
                    syncDummyAudioState(!isPaused);
                }
                if (data.name === 'time-pos') currentTime.value = data.data; //毫秒级
                if (data.name === 'duration') duration.value = data.data;    //毫秒级
                if (data.name === 'loudness') loudness.value = data.data;
                if (data.name === 'spectrum') spectrum.value = data.data;
            }

            if (data.event === 'end-file') {
                const reason = data.reason;
                if (reason === 'eof') {
                    next(false);
                } else if (reason === 'error') {
                    handlePlayError().then();
                }
            }
        });
    }

    const togglePlay = async () => {
        await window.electronAPI.qzplayer.togglePause();
    };

    const setVolume = async (vol: number) => {
        volume.value = vol;
        await window.electronAPI.qzplayer.setVolume(vol);
    };

    const seek = async (time: number) => {
        await window.electronAPI.qzplayer.seek(time);
    };

    const toggleMode = () => {
        if (playMode.value === PlayMode.List) playMode.value = PlayMode.Single;
        else if (playMode.value === PlayMode.Single) playMode.value = PlayMode.Random;
        else playMode.value = PlayMode.List;
    };

    const toggleFullScreen = () => {
        isPlayerFullScreen.value = !isPlayerFullScreen.value;
    };

    // Persistence Listeners
    watch(() => [playlist.value, currentIndex.value], () => {
        localStorage.setItem('qz-player-playlist', JSON.stringify(playlist.value));
        localStorage.setItem('qz-player-index', currentIndex.value.toString());
    }, { deep: true });

    watch(addListMode, (newMode) => {
        localStorage.setItem('qz-player-add-mode', newMode);
    });

    // Restore initial state (without playing)
    if (playlist.value.length > 0 && currentIndex.value >= 0 && currentIndex.value < playlist.value.length) {
        const restoredSong = playlist.value[currentIndex.value];
        if (restoredSong) {
            // Use playSong with autoPlay=false to load the song into the engine
            setTimeout(() => {
                playSong(restoredSong, true);
                fetchLyrics(restoredSong);
            }, 0);
        }
    }

    return {
        isPlaying,
        currentSong,
        volume,
        duration,
        currentTime,
        playlist,
        playMode,
        loudness,
        spectrum,
        isPlayerFullScreen,
        setPlaylist,
        playSong,
        next,
        prev,
        togglePlay,
        setVolume,
        seek,
        toggleMode,
        toggleFullScreen,
        lyrics,
        fetchLyrics,
        addListMode,
        playFromList,
        hideLyricView
    };
});
