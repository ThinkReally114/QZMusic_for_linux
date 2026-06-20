import { defineStore } from 'pinia';
import { ref, shallowRef, watch } from 'vue';
import { ElMessage } from 'element-plus';
import type { Song } from '../types/song';
import { parseLyric } from '../utils/lyricUtil'
import { useListenTogetherStore } from './listenTogether';
import { calibratedNow } from './timeCalibrator';
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
    const openPlayerOnSongClick = ref(false);

    // Error Handling
    const playErrorCount = ref(0);
    const currentSongRetryCount = ref(0);
    const MAX_SONG_RETRY_COUNT = 1;
    const MAX_CONSECUTIVE_SKIP_COUNT = 3;
    let handlingPlayError = false;
    const HEARTBEAT_INTERVAL_MS = 300_000;
    const heartbeatDuration = ref(0);
    let lastHeartbeatTick = Date.now();
    let heartbeatSending = false;
    let lastTaskbarProgress = -1;
    let lastTaskbarMode: 'normal' | 'paused' = 'normal';

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

    const listenTogether = () => {
        try {
            return useListenTogetherStore();
        } catch {
            return null;
        }
    };

    const syncTaskbarProgress = () => {
        if (!window.electronAPI?.setTaskbarProgress) return;

        if (!currentSong.value || duration.value <= 0) {
            if (lastTaskbarProgress !== -1) {
                lastTaskbarProgress = -1;
                window.electronAPI.setTaskbarProgress(-1).catch(console.warn);
            }
            return;
        }

        const progress = Math.max(0, Math.min(1, currentTime.value / duration.value));
        const mode: 'normal' | 'paused' = isPlaying.value ? 'normal' : 'paused';
        if (Math.abs(progress - lastTaskbarProgress) < 0.002 && mode === lastTaskbarMode) return;

        lastTaskbarProgress = progress;
        lastTaskbarMode = mode;
        window.electronAPI.setTaskbarProgress(progress, mode).catch(console.warn);
    };

    const notifyTogetherSetList = () => {
        const together = listenTogether();
        if (together?.canControl && !together.isApplyingRemote) {
            together.sendSetList([...playlist.value]);
        }
    };

    const notifyTogetherSeek = () => {
        const together = listenTogether();
        if (together?.canControl && !together.isApplyingRemote) {
            together.sendSeek(currentTime.value, currentIndex.value);
        }
    };

    const notifyTogetherPlayback = (playing = isPlaying.value) => {
        const together = listenTogether();
        if (together?.canControl && !together.isApplyingRemote) {
            together.sendPlayback(playing);
        }
    };

    const tickHeartbeat = async () => {
        const now = Date.now();
        const delta = now - lastHeartbeatTick;
        lastHeartbeatTick = now;

        if (!isPlaying.value || !currentSong.value) return;
        heartbeatDuration.value += delta;

        if (heartbeatDuration.value < HEARTBEAT_INTERVAL_MS || heartbeatSending) return;
        heartbeatSending = true;
        const durationToSend = HEARTBEAT_INTERVAL_MS;
        heartbeatDuration.value = Math.max(0, heartbeatDuration.value - durationToSend);
        try {
            await window.electronAPI?.heartbeat?.sendPc(durationToSend, calibratedNow());
        } catch (error) {
            console.warn('[Heartbeat] PC heartbeat failed:', error);
        } finally {
            heartbeatSending = false;
        }
    };

    if (typeof window !== 'undefined') {
        window.electronAPI?.settings?.getAll?.()
            .then((settings) => {
                openPlayerOnSongClick.value = Boolean(settings.openPlayerOnSongClick);
            })
            .catch((error) => console.warn('[Player] Failed to load click preference:', error));
        window.addEventListener('qz-open-player-on-song-click-changed', (event) => {
            openPlayerOnSongClick.value = Boolean((event as CustomEvent<boolean>).detail);
        });
        window.setInterval(() => {
            tickHeartbeat().catch(console.error);
        }, 1000);
    }

    // --- Actions ---

    const setPlaylist = async (list: any[], startIndex = 0) => {
        // Legacy support or direct set
        playlist.value = list;
        currentIndex.value = startIndex;
        notifyTogetherSetList();
        if (list.length > 0 && startIndex >= 0 && startIndex < list.length) {
            await playSong(list[startIndex], true, startIndex);
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
            notifyTogetherSetList();
            await playSong(song, true, newIndex);
        }

        if (openPlayerOnSongClick.value && !isPlayerFullScreen.value) {
            toggleFullScreen();
        }
    };

    const playSong = async (song: Song, autoPlay = true, queueIndex?: number) => {
        if (!song) return;
        console.log(song);
        currentSong.value = song;
        if (typeof queueIndex === 'number') {
            currentIndex.value = queueIndex;
        } else {
            const foundIndex = playlist.value.findIndex(s => s.id === song.id);
            if (foundIndex !== -1) {
                currentIndex.value = foundIndex;
            }
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
                currentSongRetryCount.value = 0;
                playErrorCount.value = 0;
                notifyTogetherSeek();
                notifyTogetherPlayback(autoPlay);
            } catch (e) {
                // IPC call failed (rare), handle sync error
                console.error("IPC Play request failed:", e);
                if (autoPlay) await handlePlayError();
            }
        } else {
            console.warn("Song has no URL");
            if (autoPlay) await handlePlayError();
        }
    };

    const fetchLyrics = async (song: Song) => {
        lyrics.value = { lines: [] }; // Reset
        if (!song || !song.id) return;
        if (song.type === 'Local' || song.source === 'local') {
            const localLyric = typeof song.lyric === 'string' ? song.lyric.trim() : '';
            if (localLyric) {
                lyrics.value = { lines: parseLyric(localLyric) };
            }
            return;
        }
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
        await playSong(playlist.value[nextIndex], true, nextIndex);
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
        await playSong(playlist.value[prevIndex], true, prevIndex);
    };

    const playQueueIndex = async (index: number) => {
        if (index < 0 || index >= playlist.value.length) return;
        currentIndex.value = index;
        await playSong(playlist.value[index], true, index);
    };

    const playNextInQueue = async (song: Song) => {
        if (!song) return;
        if (playlist.value.length === 0) {
            playlist.value = [song];
            currentIndex.value = 0;
            notifyTogetherSetList();
            await playSong(song, true, 0);
            return;
        }

        const insertIndex = currentIndex.value >= 0 ? currentIndex.value + 1 : playlist.value.length;
        playlist.value.splice(insertIndex, 0, song);
        const together = listenTogether();
        if (together?.canControl && !together.isApplyingRemote) {
            together.sendInsertSong(song, insertIndex);
        }
        ElMessage.success('已设为下一首播放');
    };

    const appendToQueue = async (song: Song) => {
        if (!song) return;
        playlist.value.push(song);
        const together = listenTogether();
        if (together?.canControl && !together.isApplyingRemote) {
            together.sendAddSong(song);
        }
        if (!currentSong.value || currentIndex.value === -1) {
            currentIndex.value = playlist.value.length - 1;
            await playSong(song, true, currentIndex.value);
            return;
        }
        ElMessage.success('已添加到播放队列');
    };

    const removeFromQueue = async (index: number) => {
        if (index < 0 || index >= playlist.value.length) return;
        const removedCurrent = index === currentIndex.value;
        const removedSong = playlist.value[index];
        playlist.value.splice(index, 1);
        const together = listenTogether();
        if (together?.canControl && !together.isApplyingRemote) {
            together.sendRemoveSong(removedSong, index, currentIndex.value);
        }

        if (playlist.value.length === 0) {
            currentIndex.value = -1;
            currentSong.value = null;
            isPlaying.value = false;
            await window.electronAPI.qzplayer.pause();
            syncDummyAudioState(false);
            return;
        }

        if (index < currentIndex.value) {
            currentIndex.value -= 1;
        } else if (removedCurrent) {
            currentIndex.value = Math.min(index, playlist.value.length - 1);
            await playSong(playlist.value[currentIndex.value], true, currentIndex.value);
        }
    };

    const moveQueueItem = (fromIndex: number, toIndex: number) => {
        if (
            fromIndex === toIndex ||
            fromIndex < 0 ||
            toIndex < 0 ||
            fromIndex >= playlist.value.length ||
            toIndex >= playlist.value.length
        ) {
            return;
        }

        const [song] = playlist.value.splice(fromIndex, 1);
        playlist.value.splice(toIndex, 0, song);

        if (currentIndex.value === fromIndex) {
            currentIndex.value = toIndex;
        } else if (fromIndex < currentIndex.value && toIndex >= currentIndex.value) {
            currentIndex.value -= 1;
        } else if (fromIndex > currentIndex.value && toIndex <= currentIndex.value) {
            currentIndex.value += 1;
        }
        notifyTogetherSetList();
    };

    const applyTogetherState = async (data: any) => {
        const nextList = Array.isArray(data.list) ? data.list as Song[] : playlist.value;
        const nextIndex = Math.max(
            0,
            Math.min(Number(data.currentIndex ?? currentIndex.value) || 0, Math.max(0, nextList.length - 1))
        );
        const nextMs = Math.max(0, Number(data.currentMs ?? currentTime.value) || 0);
        const shouldPlay = Boolean(data.playing);

        if (Array.isArray(data.list)) {
            playlist.value = nextList;
        }

        if (nextList.length === 0) {
            playlist.value = [];
            currentIndex.value = -1;
            currentSong.value = null;
            isPlaying.value = false;
            await window.electronAPI.qzplayer.pause();
            syncDummyAudioState(false);
            return;
        }

        const nextSong = nextList[nextIndex];
        const needsLoad =
            !currentSong.value ||
            currentSong.value.id !== nextSong.id ||
            currentSong.value.source !== nextSong.source ||
            currentIndex.value !== nextIndex;

        currentIndex.value = nextIndex;
        if (needsLoad) {
            await playSong(nextSong, shouldPlay, nextIndex);
        } else if (shouldPlay !== isPlaying.value) {
            if (shouldPlay) {
                await window.electronAPI.qzplayer.play();
                isPlaying.value = true;
                syncDummyAudioState(true);
            } else {
                await window.electronAPI.qzplayer.pause();
                isPlaying.value = false;
                syncDummyAudioState(false);
            }
        }

        if (Math.abs((currentTime.value || 0) - nextMs) > 1200) {
            await window.electronAPI.qzplayer.seek(nextMs);
            currentTime.value = nextMs;
        }
    };

    const handlePlayError = async () => {
        if (handlingPlayError) return;
        handlingPlayError = true;

        try {
            if (playlist.value.length === 0) {
                isPlaying.value = false;
                playErrorCount.value = 0;
                currentSongRetryCount.value = 0;
                syncDummyAudioState(false);
                return;
            }

            const failedSong = currentSong.value;
            if (failedSong && currentSongRetryCount.value < MAX_SONG_RETRY_COUNT) {
                currentSongRetryCount.value++;
                ElMessage.warning('\u64ad\u653e\u5931\u8d25\uff0c\u6b63\u5728\u91cd\u8bd5\u5f53\u524d\u6b4c\u66f2');
                handlingPlayError = false;
                await playSong(failedSong, true, currentIndex.value);
                return;
            }

            currentSongRetryCount.value = 0;
            playErrorCount.value++;
            if (playErrorCount.value >= MAX_CONSECUTIVE_SKIP_COUNT) {
                await window.electronAPI.qzplayer.pause();
                isPlaying.value = false;
                ElMessage.error('\u8fde\u7eed 3 \u9996\u6b4c\u66f2\u64ad\u653e\u5931\u8d25\uff0c\u5df2\u6682\u505c\u64ad\u653e');
                playErrorCount.value = 0;
                syncDummyAudioState(false);
            } else {
                ElMessage.warning(`\u5f53\u524d\u6b4c\u66f2\u4ecd\u65e0\u6cd5\u64ad\u653e\uff0c\u5df2\u8df3\u8fc7 (${playErrorCount.value}/${MAX_CONSECUTIVE_SKIP_COUNT})`);
                handlingPlayError = false;
                await next(true);
            }
        } finally {
            handlingPlayError = false;
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
                    notifyTogetherPlayback(!isPaused);
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
        currentTime.value = time;
        notifyTogetherSeek();
    };

    const toggleMode = () => {
        if (playMode.value === PlayMode.List) playMode.value = PlayMode.Single;
        else if (playMode.value === PlayMode.Single) playMode.value = PlayMode.Random;
        else playMode.value = PlayMode.List;
    };

    const toggleFullScreen = () => {
        const startViewTransition = (document as any).startViewTransition;
        const toggle = () => {
            isPlayerFullScreen.value = !isPlayerFullScreen.value;
        };

        if (typeof startViewTransition === 'function') {
            try {
                startViewTransition(toggle);
            } catch (error) {
                console.warn('View transition failed, falling back to direct player toggle:', error);
                toggle();
            }
        } else {
            toggle();
        }
    };

    // Persistence Listeners
    watch(() => [playlist.value, currentIndex.value], () => {
        localStorage.setItem('qz-player-playlist', JSON.stringify(playlist.value));
        localStorage.setItem('qz-player-index', currentIndex.value.toString());
    }, { deep: true });

    watch(addListMode, (newMode) => {
        localStorage.setItem('qz-player-add-mode', newMode);
    });

    watch([currentTime, duration, isPlaying, currentSong], syncTaskbarProgress, { immediate: true });

    // Restore initial state (without playing)
    if (playlist.value.length > 0 && currentIndex.value >= 0 && currentIndex.value < playlist.value.length) {
        const restoredSong = playlist.value[currentIndex.value];
        if (restoredSong) {
            // Use playSong with autoPlay=false to load the song into the engine
            setTimeout(() => {
                playSong(restoredSong, true, currentIndex.value);
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
        currentIndex,
        playMode,
        loudness,
        spectrum,
        isPlayerFullScreen,
        setPlaylist,
        playSong,
        playQueueIndex,
        playNextInQueue,
        appendToQueue,
        removeFromQueue,
        moveQueueItem,
        applyTogetherState,
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
