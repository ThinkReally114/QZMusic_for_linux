<template>
  <transition name="slide-up">
    <div class="player-bar" v-if="hasSongs" @click="handleBarClick">
      <!-- Left: Vinyl & Info -->
      <div class="player-left">
        <div class="vinyl-wrapper" :class="{ 'playing': isPlaying }">
          <img 
            v-if="currentSong?.picUrl" 
            :src="currentSong.picUrl" 
            class="album-art" 
            alt="Album Art"
          />
          <div v-else class="album-placeholder"></div>
          <div class="vinyl-bg"></div>
        </div>
        
        <div class="track-info">
          <div class="track-title-row">
            <span class="track-name">{{ currentSong?.name || '未知歌曲' }}</span>
            <span class="track-artist"> - {{ currentSong?.artist || '未知歌手' }}</span>
          </div>
          <div class="track-actions">
            <button class="icon-btn tiny" title="添加到歌单">
              <Icon icon="lucide:plus-circle" />
            </button>
            <button class="icon-btn tiny" title="下载">
              <Icon icon="lucide:download" />
            </button>
          </div>
        </div>
      </div>

      <!-- Center: Controls & Progress -->
      <div class="player-center">
        <div class="controls-row">
          <button class="icon-btn small" :class="{ active: isLiked }" @click="toggleLike" title="喜欢">
             <Icon :icon="isLiked ? 'lucide:heart' : 'lucide:heart'" :class="{ filled: isLiked }" />
          </button>
          
          <button class="icon-btn" @click="prev" title="上一首">
            <Icon icon="lucide:skip-back" />
          </button>
          
          <button class="play-btn" @click="togglePlay">
            <Icon :icon="isPlaying ? 'lucide:pause' : 'lucide:play'" class="play-icon" />
          </button>
          
          <button class="icon-btn" @click="next" title="下一首">
            <Icon icon="lucide:skip-forward" />
          </button>
          
          <button class="icon-btn small" @click="toggleMode" :title="modeTitle">
            <Icon :icon="modeIcon" />
          </button>
        </div>
        
        <div class="progress-row">
          <span class="time-text">{{ formatTime(currentTime) }}</span>
          <div class="slider-container">
            <input 
              type="range" 
              min="0" 
              :max="duration || 100" 
              :value="currentTime" 
              class="custom-slider"
              @input="onSeek"
            >
            <div class="slider-track" :style="{ width: progressPercent + '%' }"></div>
          </div>
          <span class="time-text">{{ formatTime(duration) }}</span>
        </div>
      </div>

      <!-- Right: Volume & Playlist -->
      <div class="player-right">
        <div class="volume-control">
          <button class="icon-btn small" @click="toggleMute">
            <Icon :icon="volumeIcon" />
          </button>
          <div class="slider-container volume-slider">
            <input 
              type="range" 
              min="0" 
              max="100" 
              :value="volume" 
              class="custom-slider"
              @input="onVolumeChange"
            >
            <div class="slider-track" :style="{ width: volume + '%' }"></div>
          </div>
        </div>
        
        <div class="divider">|</div>
        
        <button class="icon-btn playlist-toggle" @click="togglePlaylist" title="播放列表">
          <Icon icon="lucide:list-music" />
        </button>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { Icon } from '@iconify/vue';
import { usePlayerStore, PlayMode } from '../stores/player';
import { storeToRefs } from 'pinia';

const playerStore = usePlayerStore();
const { isPlaying, currentSong, currentTime, duration, volume, playMode, playlist } = storeToRefs(playerStore);

const hasSongs = computed(() => playlist.value.length > 0);
const isLiked = ref(false); // Mock like state

// Icons
const modeIcon = computed(() => {
  switch (playMode.value) {
    case PlayMode.Single: return 'lucide:repeat-1';
    case PlayMode.Random: return 'lucide:shuffle';
    default: return 'lucide:repeat';
  }
});

const modeTitle = computed(() => {
  switch (playMode.value) {
    case PlayMode.Single: return '单曲循环';
    case PlayMode.Random: return '随机播放';
    default: return '列表循环';
  }
}); 

const volumeIcon = computed(() => {
  if (volume.value === 0) return 'lucide:volume-x';
  if (volume.value < 50) return 'lucide:volume-1';
  return 'lucide:volume-2';
});

// Progress
const progressPercent = computed(() => {
  if (!duration.value) return 0;
  return (currentTime.value / duration.value) * 100;
});

// Actions
const togglePlay = () => playerStore.togglePlay();
const next = () => playerStore.next();
const prev = () => playerStore.prev();
const toggleMode = () => playerStore.toggleMode();
const toggleLike = () => { isLiked.value = !isLiked.value; };
const togglePlaylist = () => { /* TODO: Toggle Playlist Drawer */ };

const onSeek = (e: Event) => {
  const val = Number((e.target as HTMLInputElement).value);
  playerStore.seek(val);
};

const onVolumeChange = (e: Event) => {
  const val = Number((e.target as HTMLInputElement).value);
  playerStore.setVolume(val);
};

const toggleMute = () => {
    if (volume.value > 0) playerStore.setVolume(0);
    else playerStore.setVolume(50);
};

const handleBarClick = (e: MouseEvent) => {
    // Prevent triggering when clicking on controls/inputs
    const target = e.target as HTMLElement;
    if (
        target.closest('button') || 
        target.closest('input') || 
        target.closest('.icon-btn') || 
        target.closest('.play-btn')
    ) {
        return;
    }
    playerStore.toggleFullScreen();
};

// Utils
const formatTime = (seconds: number) => {
  if (!seconds || isNaN(seconds)) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};
</script>

<style scoped>
.player-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 80px; /* Established height */
  background-color: var(--color-bg-secondary);
  backdrop-filter: blur(20px);
  border-top: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  z-index: 1000;
  box-shadow: 0 -4px 20px rgba(0,0,0,0.15);
  transition: var(--theme-transition);
}

/* Animations */
.slide-up-enter-active,
.slide-up-leave-active {
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
  opacity: 0;
}

/* --- Left Section --- */
.player-left {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 16px;
  min-width: 0;
}

.vinyl-wrapper {
  position: relative;
  width: 64px;
  height: 64px;
  min-width: 64px;
  min-height: 64px;
  flex-shrink: 0;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  /* Dark background for vinyl effect */
  background: #1a1a1a;
  box-shadow: var(--shadow-md);
  animation: spin 10s linear infinite;
  animation-play-state: paused;
}

.vinyl-wrapper.playing {
  animation-play-state: running;
}

/* Vinyl overlay (Background) */
.vinyl-bg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background-image: url('https://s5.music.126.net/static_public/68aea63daca57500bb3fb4b6_68aea63daca57500bb3fb4b7/public/assets/img/play/miniVinyl.png');
  background-size: cover;
  opacity: 1;
  pointer-events: none;
  z-index: 1;
}

/* Album art (Foreground) */
.album-art {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  object-fit: cover;
  z-index: 10;
  position: relative; /* Ensure z-index applies */
}

.album-placeholder {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: var(--color-bg-tertiary);
  z-index: 10;
  position: relative; /* Ensure z-index applies */
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.track-info {
  display: flex;
  flex-direction: column;
  justify-content: center;
  overflow: hidden;
}

.track-title-row {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 4px;
}

.track-name {
  font-size: 14px;
  color: var(--color-text-primary);
  font-weight: 500;
}

.track-artist {
  font-size: 12px;
  color: var(--color-text-muted);
}

.track-actions {
  display: flex;
  gap: 8px;
}

/* --- Center Section --- */
.player-center {
  flex: 1.5;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.controls-row {
  display: flex;
  align-items: center;
  gap: 20px;
}

.progress-row {
  width: 100%;
  max-width: 480px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.time-text {
  font-size: 11px;
  color: var(--color-text-muted);
  width: 35px;
  text-align: center;
}

/* --- Right Section --- */
.player-right {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 16px;
}

.volume-control {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 120px;
}

.volume-slider {
  flex: 1;
}

.divider {
  color: var(--color-border);
  font-size: 12px;
  margin: 0 4px;
}

/* --- Common UI Components --- */
.icon-btn {
  background: transparent;
  border: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  width: 36px;
  height: 36px;
  transition: all 0.2s;
}

.icon-btn:hover {
  color: var(--color-text-primary);
  background: var(--color-bg-tertiary);
}

.icon-btn.small { width: 32px; height: 32px; }
.icon-btn.tiny { width: 24px; height: 24px; padding: 0; color: var(--color-text-muted); }

.icon-btn.active { color: var(--color-accent); }
.filled { fill: currentColor; }

.play-btn {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: var(--color-accent);
  color: var(--color-text-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.2s;
}

.play-btn:hover {
  transform: scale(1.1);
}

/* Custom Slider */
.slider-container {
  position: relative;
  height: 4px;
  flex: 1;
  border-radius: 2px;
  background: var(--color-bg-tertiary);
  cursor: pointer;
  display: flex;
  align-items: center;
}

.custom-slider {
  appearance: none;
  position: absolute;
  width: 100%;
  height: 100%;
  background: transparent;
  top: 0;
  left: 0;
  margin: 0;
  z-index: 2;
  cursor: pointer;
}

.custom-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--color-accent);
  opacity: 0;
}

.slider-track {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: var(--color-accent);
  border-radius: 2px;
  pointer-events: none;
  z-index: 1;
}
</style>
