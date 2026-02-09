<template>
  <div class="fullscreen-player" :class="{ active: isPlayerFullScreen }">
    <div class="background-container">
      <BackgroundRender
          :album="playerStore.currentSong?.picUrl"
          :album-is-video="false"
          ref="bgRef"
          style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"
       />
    </div>

    <div v-if="isPlayerFullScreen" class="drag-bar"></div>

    <div class="horizontal-layout" :class="{ hideLyric: playerStore.hideLyricView }">
      <div class="thumb">
        <ControlThumb @click="toggleFullScreen" />
      </div>
      <Cover
        class="cover"
        :cover-url="playerStore.currentSong?.picUrl"
        :music-paused="!isPlaying"
        :cover-video-paused="!isPlaying"
        :pause-shrink-aspect="0.75"
      />
      <div class="controls">
        <MusicInfo
            :name="playerStore.currentSong?.name"
            :artists="playerStore.currentSong?.artist.split('、')??undefined"
            class="music-info-container"
        />
        <div>
            <BouncingSlider
                :value="playerStore.currentTime"
                :min="0"
                :max="playerStore.duration"
                :is-playing="isPlaying"
                @update:value="handleSeek"
            />
            <div class="progressBarLabels">
                <div class="time-label">
                    {{ formatTime(playerStore.currentTime) }}
                </div>
                <div
                    class="time-label remaining"
                    @click="showRemaining = !showRemaining"
                >
                    {{ showRemaining ? `-${formatTime(playerStore.duration - playerStore.currentTime)}` : formatTime(playerStore.duration) }}
                </div>
            </div>
        </div>
        <div class="mediaControlls">
          <MediaButton class="songMediaButton" @click="playerStore.toggleMode">
            <template v-if="playMode === 'random'">
              <img :src="IconShuffleActive" :style="iconStyle"/>
            </template>
            <template v-else>
              <img :src="IconShuffle" :style="iconStyle"/>
            </template>
          </MediaButton>

          <MediaButton class="songMediaButton" @click="()=>playerStore.prev()">
            <img :src="IconRewind" />
          </MediaButton>

          <MediaButton class="songMediaPlayButton" @click="playerStore.togglePlay">
            <img :src="isPlaying ? IconPause : IconPlay"/>
          </MediaButton>

          <MediaButton class="songMediaButton" @click="()=>playerStore.next()">
            <img :src="IconForward" />
          </MediaButton>

          <MediaButton class="songMediaButton" @click="playerStore.toggleMode">
            <template v-if="playMode === 'single'">
              <img :src="IconRepeatOneActive" :style="iconStyle" />
            </template>
            <template v-else-if="playMode === 'list'">
              <img :src="IconRepeatActive" :style="iconStyle" />
            </template>
            <template v-else>
              <img :src="IconRepeat" :style="iconStyle" />
            </template>
          </MediaButton>
        </div>
        <div class="volumeControllBar">
          <VolumeControl
              v-model="playerStore.volume"
              :min="0"
              :max="100"
              :on-update="value => {
                    playerStore.setVolume( Math.floor(value) )
                  }"
          />
        </div>
      </div>
      <div class="lyric">
        <LyricPlayer
            v-if="isPlayerFullScreen"
            ref="lyricPlayerRef"
            :lyric-lines="toRaw(playerStore.lyrics.lines)"
            :current-time="playerStore.currentTime"
            :playing="isPlaying"
            :align-position="0.5"
            :wordFadeWidth="0.5"
            :enable-scale="false"
            :enable-blur="true"
            :enable-spring="true"
            @line-click="jumpTime"
            style="width:100%;height:100%;font-family: 'LyricFont',sans-serif"
        >
        </LyricPlayer>
      </div>
      <div class="bottomControls">
        <ToggleIconButton
            type="playlist"
        />
        <ToggleIconButton
            type="lyrics"
            :checked="!playerStore.hideLyricView"
            @click="playerStore.hideLyricView = !playerStore.hideLyricView"
        />
        <div style="flex: 1" />
        <ToggleIconButton
            type="airplay"
        />
      </div>
    </div>

    <canvas ref="canvasRef" class="spectrum-canvas"></canvas>
  </div>
</template>

<script lang="ts" setup>
import { computed, toRaw, watch, ref, onMounted, onUnmounted } from 'vue';
import { usePlayerStore } from '../stores/player';

import "@applemusic-like-lyrics/core/style.css";
import { LyricPlayer, type LyricPlayerRef, BackgroundRender, type BackgroundRenderRef} from "@applemusic-like-lyrics/vue";
import { LyricLineMouseEvent } from "@applemusic-like-lyrics/core";
import Cover from './player/Cover.vue';
import ControlThumb from './player/ControlThumb.vue';
import BouncingSlider from './player/BouncingSlider.vue';
import MusicInfo from './player/MusicInfo.vue';
import MediaButton from './player/MediaButton.vue';
import VolumeControl from './player/VolumeControl.vue';
import ToggleIconButton from './player/ToggleIconButton.vue';

// Icons
import IconRewind from '@assets/icon_rewind.svg';
import IconPlay from '@assets/icon_play.svg';
import IconPause from '@assets/icon_pause.svg';
import IconForward from '@assets/icon_forward.svg';
import IconShuffle from '@assets/shuffle.svg';
import IconShuffleActive from '@assets/shuffle-active.svg';
import IconRepeat from '@assets/repeat.svg';
import IconRepeatOneActive from '@assets/repeat-one-active.svg';
import IconRepeatActive from '@assets/repeat-active.svg';

const lyricPlayerRef = ref<LyricPlayerRef>()
const bgRef = ref<BackgroundRenderRef>();

const showRemaining = ref(false);

const formatTime = (miliseconds: number) => {
  const seconds = miliseconds / 1000;
  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return `${min}:${sec.toString().padStart(2, '0')}`;
};

const handleSeek = (val: number) => {
  playerStore.seek(val);
  lyricPlayerRef.value?.lyricPlayer.value?.setCurrentTime(val,true);
};


const playerStore = usePlayerStore();
const isPlayerFullScreen = computed(() => playerStore.isPlayerFullScreen);
//const currentSong = computed(() => playerStore.currentSong);
const isPlaying = computed(() => playerStore.isPlaying);
const playMode = computed(() => playerStore.playMode);

const iconStyle = {
    width: "1.3em",
    height: "1.3em",
};
const canvasRef = ref<HTMLCanvasElement | null>(null);
let animationId: number | null = null;
let currentData: number[] = new Array(32).fill(0); // For temporal smoothing

const drawSpectrum = () => {
  if (!canvasRef.value) return;
  const canvas = canvasRef.value;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Adjust canvas size
  const dpr = window.devicePixelRatio || 1;

  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const width = rect.width;
  const height = rect.height;

  ctx.clearRect(0, 0, width, height);

  const targetData = playerStore.spectrum;
  if (!targetData) return;

  // 1. Temporal Smoothing (LERP)
  // Adjust speed (0.1 - 0.3) for desired smoothness
  const lerpSpeed = 0.15;
  for (let i = 0; i < 32; i++) {
    const target = targetData[i] || 0;
    currentData[i] = currentData[i] + (target - currentData[i]) * lerpSpeed;
  }

  // 2. Draw Smooth Wave
  ctx.beginPath();
  ctx.moveTo(0, height);

  const pointCount = currentData.length;
  // Use a subset if desired, but 32 is fine.
  // We want the wave to be centered or span the width.
  const step = width / (pointCount - 1);

  // Start point
  let x = 0;
  let y = height - (currentData[0] * height * 0.5); // Scale 0.5
  ctx.lineTo(x, y);

  for (let i = 0; i < pointCount - 1; i++) {
    const xCurr = i * step;
    const yCurr = height - (currentData[i] * height * 0.5);

    const xNext = (i + 1) * step;
    const yNext = height - (currentData[i + 1] * height * 0.5);

    // Control point for quadratic curve (midpoint)
    const xMid = (xCurr + xNext) / 2;
    const yMid = (yCurr + yNext) / 2;

    ctx.quadraticCurveTo(xCurr, yCurr, xMid, yMid);
  }

  // Connect to last point
  const lastX = (pointCount - 1) * step;
  const lastY = height - (currentData[pointCount - 1] * height * 0.5);
  ctx.lineTo(lastX, lastY);

  // Close path to bottom
  ctx.lineTo(width, height);
  ctx.closePath();

  // Style
  const gradient = ctx.createLinearGradient(0, height - 200, 0, height);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0.05)');

  ctx.fillStyle = gradient;

  // Add blur effect
  ctx.shadowBlur = 20;
  ctx.shadowColor = 'rgba(255, 255, 255, 0.5)';

  ctx.fill();

  // Reset shadow for next frame (performance)
  ctx.shadowBlur = 0;
};

const loop = () => {
  if (isPlayerFullScreen.value) {
    drawSpectrum();
    animationId = requestAnimationFrame(loop);
  }
};

watch(isPlayerFullScreen, (val) => {
  if (val) {
    loop();
  } else {
    if (animationId) cancelAnimationFrame(animationId);
  }
});

onMounted(() => {
  if (isPlayerFullScreen.value) loop();
});

onUnmounted(() => {
  if (animationId) cancelAnimationFrame(animationId);
});

const toggleFullScreen = () => {
  playerStore.toggleFullScreen();
};

const jumpTime = (e: LyricLineMouseEvent) => {
  playerStore.seek(e.line.getLine().startTime)
  lyricPlayerRef.value?.lyricPlayer.value?.setCurrentTime(e.line.getLine().startTime,true);
}

// watch(()=>playerStore.currentTime,(t)=>{
//   console.log(toRaw(t))
// })
</script>

<style scoped>
.fullscreen-player {
  --height: calc(100vh);
  position: fixed;
  top: var(--height);
  left: 0;
  width: 100%;
  height: var(--height);
  z-index: 9999;
  transition: top 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
  background: black; /* Default background if image fails */
  overflow: hidden;
}

.fullscreen-player.active {
  top: 0;
}

.background-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: -1;
  pointer-events: none;
}

.drag-bar {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 50px;
  z-index: 100;
  -webkit-app-region: drag;
  background: transparent;
}


.spectrum-canvas {
  width: 100%;
  height: 200px;
  position: absolute;
  bottom: 0;
  left: 0;
  pointer-events: none;
  z-index: 15;
  mask-image: linear-gradient(to top, black 0%, transparent 100%);
  -webkit-mask-image: linear-gradient(to top, black 0%, transparent 100%);
}

@font-face {
  font-family: 'LyricFont';
  src: url('@assets/lyricfont.ttf');
  font-weight: 350;
}

/* New Horizontal Layout Styles */
.horizontal-layout {
  /* --info-size-fract: 0.85fr; */
  /* --player-size-fract: 1fr; */
  width: 100%;
  height: 100%;

  position: relative;
  display: grid;
  grid-template-rows: [drag-area] minmax(20px, .20fr) [thumb] auto [cover] auto [music-info] 3fr [buttom-controls] 0fr .1fr;
  grid-template-columns: [info-side] .50fr [player-side] .50fr [side-controls] 0fr;
  gap: 8px;
  transition: all 0.5s ease-in-out;
  left: 0;

  --hide-lyric-left: 50%;

  --horizontal-layout-max-width: min(50vh, 38vw);
}

.horizontal-layout .thumb,
.horizontal-layout .cover,
.horizontal-layout .controls {
  transition: left 0.5s cubic-bezier(0.5, 0, 0.5, 1);
  left: 0;
}



.horizontal-layout.hideLyric .lyric {
  transition:
    opacity 0.25s cubic-bezier(0.5, 0, 0.5, 1),
    transform 0.5s cubic-bezier(0.5, 0, 0.5, 1);
  opacity: 0;
  pointer-events: none;
}

.horizontal-layout.hideLyric .thumb,
.horizontal-layout.hideLyric .cover,
.horizontal-layout.hideLyric .controls {
  left: var(--hide-lyric-left);
}

@media screen and (max-height: 1000px) {
  .horizontal-layout {
    --horizontal-layout-max-width: min(45vh, 38vw);
  }
}

@media screen and (max-height: 768px) {
  .horizontal-layout {
    font-size: 0.8em;
    gap: 2px;
    grid-template-rows: [drag-area] minmax(30px, 0.25fr) [thumb] auto [cover] auto [music-info] 3fr [buttom-controls] 0fr 0.2fr;
  }
}

.thumb {
  grid-column: info-side;
  grid-row: thumb;
  will-change: transform;
  justify-self: center;
  margin: 2vh;

  position: relative;
  z-index: 10;
  -webkit-app-region: no-drag;
}

.cover {
  margin: 0;
  aspect-ratio: 1 / 1;
  grid-column: info-side;
  grid-row: cover;
  align-self: center;
  justify-self: center;
  width: var(--horizontal-layout-max-width);
  height: var(--horizontal-layout-max-width);

  position: relative;
}

.controls {
  grid-area: music-info / info-side;
  will-change: transform;
  justify-self: center;

  mix-blend-mode: plus-lighter;
  min-width: 0;
  min-height: 0;
  width: var(--horizontal-layout-max-width);

  display: flex;
  flex-direction: column;
  justify-content: space-evenly;
  height: 100%;

  position: relative;
  margin-top: calc(-8px + 1.75em);
}

.progressBarLabels {
	display: flex;
	justify-content: space-between;
	align-items: center;
	font-weight: 500;
	font-size: max(1.2vh, 0.8em);
	opacity: 0.5;
	margin-top: 4px;

	@media screen and (max-height: 768px) {
		margin-top: 0;
	}

	& > * {
		flex: 1;
	}

	& > *:nth-child(2) {
		flex: 0;
	}

	& > *:last-child {
		text-align: right;
	}
}

.time-label {
    font-variant-numeric: tabular-nums;
    color: white;
}

.time-label.remaining {
    cursor: pointer;
    user-select: none;
}

.music-info-container {
    width: 100%;
    margin-bottom: 2vh;
}

.lyric {
  box-sizing: border-box;
  grid-column: player-side;
  grid-row: 2 / 5;
  width: 100%;
  height: 100%;
  transition: opacity 0.5s 0.25s cubic-bezier(0.5, 0, 0.5, 1);
  padding-right: 15%;

  mask-image: linear-gradient(transparent, black 10%, black 90%, transparent);

  contain: paint;
  pointer-events: none; /* Allow clicks to pass through to elements below */

  /* 修复呼吸点,不要删!*/
  :deep(.amll-lyric-player) {
    box-sizing: content-box;
    pointer-events: auto; /* Re-enable pointer events for the actual lyric player */
    [class*="interludeDots"] {
      box-sizing: content-box;
    }
  }
}

@media screen and (max-width: 1600px), (max-height: 1000px) {
  .lyric {
    padding-right: 8%;
  }
}

.bottomControls {
  grid-area: buttom-controls / 1 / buttom-controls / 4;
  gap: 2em;
  padding-left: 2em;
  padding-right: 2em;
  mix-blend-mode: plus-lighter;
  flex-direction: row-reverse;
  color: #fff;
  display: flex;
}

.songMediaButton,
.songMediaPlayButton {
	width: 18%;
	aspect-ratio: 1 / 1;
}

.songMediaButton > img {
    display: block;
	scale: 3;
	transition: scale 0.3s;

	@media screen and (max-height: 1080px) {
		scale: 2;
	}

	@media screen and (max-height: 768px) {
		scale: 1.5;
	}

	@media screen and (max-height: 512px) {
		scale: 1;
	}

	@media screen and (max-width: 480px) {
		scale: 0.5;
	}
}

.songMediaPlayButton > img {
	scale: 2;
	transition: scale 0.3s;

	@media screen and (max-height: 1080px) {
		scale: 1.1;
	}

	@media screen and (max-height: 768px) {
		scale: 0.8;
	}

	@media screen and (max-height: 512px) {
		scale: 0.5;
	}

	@media screen and (max-width: 480px) {
		scale: 0.5;
	}
}
.bigControls :deep(button) {
	height: 10vh !important;
	width: 10vh !important;
}

.mediaControlls {
  justify-content: space-between;
  align-items: center;
  display: flex;
  padding-right: 4px;
}
.volumeControllBar {
  touch-action: none;
  justify-content: stretch;
  align-items: center;
  min-height: 24px;
  display: flex;
}

</style>
