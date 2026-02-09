<template>
  <div
    ref="frameRef"
    class="cover"
    :class="{ musicPaused }"
  >
    <div
      class="coverInner"
      :style="{
        borderRadius: `${cornerRadius}px`,
        backgroundImage: !coverIsVideo ? `url(${coverUrl})` : undefined,
      }"
    >
      <video
        v-if="coverIsVideo"
        ref="videoRef"
        class="coverInner"
        :src="coverUrl"
        autoplay
        loop
        muted
        playsinline
        crossorigin="anonymous"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';

const props = defineProps({
  coverUrl: {
    type: String,
    default: ''
  },
  coverIsVideo: {
    type: Boolean,
    default: false
  },
  coverVideoPaused: {
    type: Boolean,
    default: false
  },
  musicPaused: {
    type: Boolean,
    default: false
  }
});

const frameRef = ref<HTMLElement | null>(null);
const videoRef = ref<HTMLVideoElement | null>(null);
const cornerRadius = ref(20);
let resizeObserver: ResizeObserver | null = null;

watch(() => props.coverVideoPaused, (paused) => {
  if (videoRef.value) {
    if (paused) {
      videoRef.value.pause();
    } else {
      videoRef.value.play();
    }
  }
});

onMounted(() => {
  const frameEl = frameRef.value;
  if (frameEl) {
    const onResize = () => {
      const size = Math.min(frameEl.clientWidth, frameEl.clientHeight);
      // Logic from React component: Math.max(size * 0.02, window.innerHeight * 0.007)
      cornerRadius.value = Math.max(size * 0.02, window.innerHeight * 0.007);
    };
    resizeObserver = new ResizeObserver(onResize);
    onResize();
    resizeObserver.observe(frameEl);
  }
});

onUnmounted(() => {
  if (resizeObserver) {
    resizeObserver.disconnect();
  }
});
</script>

<style scoped>
.cover {
  --base-box-shadow-v-0: rgba(0, 0, 0, 0.19);
  --base-box-shadow-y-0: 1em;
  --base-box-shadow-r-0: 1.2em;
  aspect-ratio: 1 / 1;
  width: 100%;
  height: 100%;
  /* object-fit: cover; removed as it applies to img/video, here it's div container */
  /* object-position: center; removed */
  /* background-position: center; removed - moved to inner */
  /* background-size: cover; removed - moved to inner */
  
  /* border-radius: max(2%, 0.7vh); */
  filter: drop-shadow(
    var(--base-box-shadow-v-0) 0px var(--base-box-shadow-y-0)
      var(--base-box-shadow-r-0)
  );
  transform: scale(1);
  will-change: transform; /* Optimized for animation */
  transition:
    background-image 0.5s linear,
    filter 0.5s ease,
    transform 0.5s cubic-bezier(0.3, 0.2, 0.2, 1.4);
}

.cover.musicPaused {
  /* --base-box-shadow-v-0: rgba(0, 0, 0, 0.19); */
  /* --base-box-shadow-y-0: 0.8em; */
  /* --base-box-shadow-r-0: 0.8em; */
  /* transform: scale(var(--scale-level)); */
  transition:
    background-image 0.5s linear,
    filter 0.5s ease,
    transform 0.6s cubic-bezier(0.4, 0.2, 0.1, 1);
}

.coverInner {
  width: 100%;
  height: 100%;
  background-position: center;
  background-size: cover;
  background-color: black;
  transition: background-image 0.5s linear;
  overflow: hidden; /* Important for border-radius clipping */
  object-fit: cover; /* For video element */
}
</style>
