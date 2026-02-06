<template>
  <div class="fullscreen-player" :class="{ active: isPlayerFullScreen }">
    <div class="player-content">
      <div class="dismiss-area" @click="toggleFullScreen">
        <svg class="dismiss-button" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </div>

      <div class="background-container">
        <BackgroundRender
            :album="currentSong?.picUrl"
            :lowFreqVolume="loudness"
            :hasLyric="true"
            :playing="isPlaying"
        />
      </div>

      <div class="music-info">
        <!-- Placeholder for song info, lyrics etc. -->
        <h1>{{ currentSong?.name || 'No Music' }}</h1>
        <p>{{ currentSong?.artist }}</p>
      </div>

      <canvas ref="canvasRef" class="spectrum-canvas"></canvas>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, watch } from 'vue';
import { usePlayerStore } from '../stores/player';
import {
  type AbstractBaseRenderer,
  type BaseRenderer,
  BackgroundRender as CoreBackgroundRender,
  MeshGradientRenderer,
} from "@applemusic-like-lyrics/core";
import {
  defineComponent,
  onMounted,
  onUnmounted,
  type PropType,
  type Ref,
  ref,
  type ShallowRef,
  useTemplateRef,
  watchEffect,
  h,
} from "vue";

// --- BackgroundRender Component Definition (from User Request) ---

/**
 * 背景渲染组件的引用
 */
export interface BackgroundRenderRef {
  /**
   * 背景渲染实例引用
   */
  bgRender?: Ref<AbstractBaseRenderer | undefined>;
  /**
   * 将背景渲染实例的元素包裹起来的 DIV 元素实例
   */
  wrapperEl: Readonly<ShallowRef<HTMLDivElement | null>>;
}

const backgroundRenderProps = {
  /**
   * 设置背景专辑资源
   */
  album: {
    type: [String, Object] as PropType<
        string | HTMLImageElement | HTMLVideoElement
    >,
    required: false,
  },
  /**
   * 设置专辑资源是否为视频
   */
  albumIsVideo: {
    type: Boolean,
    required: false,
  },
  /**
   * 设置当前背景动画帧率，如果为 `undefined` 则默认为 `30`
   */
  fps: {
    type: Number,
    required: false,
  },
  /**
   * 设置当前播放状态，如果为 `undefined` 则默认为 `true`
   */
  playing: {
    type: Boolean,
    required: false,
  },
  /**
   * 设置当前动画流动速度，如果为 `undefined` 则默认为 `2`
   */
  flowSpeed: {
    type: Number,
    required: false,
  },
  /**
   * 设置背景是否根据“是否有歌词”这个特征调整自身效果，例如有歌词时会变得更加活跃
   *
   * 部分渲染器会根据这个特征调整自身效果
   *
   * 如果不确定是否需要赋值或无法知晓是否包含歌词，请传入 true 或不做任何处理（默认值为 true）
   */
  hasLyric: {
    type: Boolean,
    required: false,
  },
  /**
   * 设置低频的音量大小，范围在 80hz-120hz 之间为宜，取值范围在 [0.0-1.0] 之间
   *
   * 部分渲染器会根据音量大小调整背景效果（例如根据鼓点跳动）
   *
   * 如果无法获取到类似的数据，请传入 undefined 或 1.0 作为默认值，或不做任何处理（默认值即 1.0）
   */
  lowFreqVolume: {
    type: Number,
    required: false,
  },
  /**
   * 设置当前渲染缩放比例，如果为 `undefined` 则默认为 `0.5`
   */
  renderScale: {
    type: Number,
    required: false,
  },
  /**
   * 设置渲染器，如果为 `undefined` 则默认为 `MeshGradientRenderer`
   * 默认渲染器有可能会随着版本更新而更换
   */
  renderer: {
    type: Object as PropType<{ // Use constructor type
      new (...args: ConstructorParameters<typeof BaseRenderer>): BaseRenderer;
    }>,
    required: false,
  },
} as const;

const BackgroundRender = defineComponent({
  name: "BackgroundRender",
  props: backgroundRenderProps,
  setup(props, { expose }) {
    const wrapperRef = useTemplateRef<HTMLDivElement>("wrapper-ref");
    const bgRenderRef = ref<AbstractBaseRenderer>();

    onMounted(() => {
      if (wrapperRef.value) {
        // @ts-ignore
        bgRenderRef.value = CoreBackgroundRender.new(
            props.renderer ?? MeshGradientRenderer,
        );
        const el = bgRenderRef.value.getElement();
        el.style.width = "100%";
        el.style.height = "100%";
        wrapperRef.value.appendChild(el);
      }
    });

    onUnmounted(() => {
      if (bgRenderRef.value) {
        bgRenderRef.value.dispose();
      }
    });

    watchEffect(() => {
      if (props.album)
        bgRenderRef.value?.setAlbum(props.album, props.albumIsVideo);
    });

    watchEffect(() => {
      if (props.fps) bgRenderRef.value?.setFPS(props.fps);
    });

    watchEffect(() => {
      if (props.playing) bgRenderRef.value?.resume();
      else bgRenderRef.value?.pause();
    });

    watchEffect(() => {
      if (props.flowSpeed) bgRenderRef.value?.setFlowSpeed(props.flowSpeed);
    });

    watchEffect(() => {
      if (props.renderScale)
        bgRenderRef.value?.setRenderScale(props.renderScale);
    });

    watchEffect(() => {
      if (props.lowFreqVolume !== undefined)
        bgRenderRef.value?.setLowFreqVolume(props.lowFreqVolume);
    });

    watchEffect(() => {
      if (props.hasLyric !== undefined)
        bgRenderRef.value?.setHasLyric(props.hasLyric ?? true);
    });

    expose<BackgroundRenderRef>({
      bgRender: bgRenderRef,
      wrapperEl: wrapperRef,
    });

    return () => h("div", { style: "display: contents;", ref: "wrapper-ref" });
  },
});


// --- FullScreenPlayer Logic ---

const playerStore = usePlayerStore();
const isPlayerFullScreen = computed(() => playerStore.isPlayerFullScreen);
const currentSong = computed(() => playerStore.currentSong);
const isPlaying = computed(() => playerStore.isPlaying);
const loudness = computed(() => playerStore.loudness);

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

</script>

<style scoped>
.fullscreen-player {
  position: fixed;
  top: 100%; /* Initially hidden below screen */
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: #000;
  z-index: 9999;
  transition: top 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.fullscreen-player.active {
  top: 0;
}

.player-content {
  position: relative;
  width: 100%;
  height: 100%;
  z-index: 10;
  display: flex;
  flex-direction: column;
  color: white;
}

.background-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: -1;
  pointer-events: none;
  opacity: 0.6; /* Dim background slightly */
}

.dismiss-area {
  padding: 2.5%;
  cursor: pointer;
  display: flex;
  justify-content: start;
  align-items: center;
  color: rgba(255, 255, 255, 0.5);
  transition: color 0.2s;
  z-index: 20;
  -webkit-app-region: drag;
}
.dismiss-button {
  -webkit-app-region: none;
}
.dismiss-area:hover {
  color: white;
}

.music-info {
  margin-top: auto;
  padding: 40px;
  text-align: left;
  z-index: 20;
}

.music-info h1 {
  font-size: 2rem;
  font-weight: bold;
  margin-bottom: 8px;
}

.music-info p {
  font-size: 1.2rem;
  opacity: 0.8;
}

.spectrum-canvas {
  width: 100%;
  height: 200px;
  position: absolute;
  bottom: 0;
  left: 0;
  pointer-events: none;
  z-index: 15;
  /* Optional: Fade out at top */
  mask-image: linear-gradient(to top, black 0%, transparent 100%);
  -webkit-mask-image: linear-gradient(to top, black 0%, transparent 100%);
}

</style>
