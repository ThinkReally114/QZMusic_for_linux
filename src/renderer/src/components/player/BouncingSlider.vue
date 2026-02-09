<template>
  <div
    class="bouncing-slider"
    ref="containerRef"
    @mousedown="handlePanStart"
    @touchstart="handlePanStart"
    @mouseenter="handleHoverStart"
    @mouseleave="handleHoverEnd"
    :style="{
        transform: `translateX(${bounceX}px)`
    }"
  >
    <div class="inner" :style="{ clipPath: clipPath }">
      <div 
        class="thumb"
        :style="{
            transform: `scaleX(${progress})`
        }"
      ></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue';

const props = defineProps({
  value: {
    type: Number,
    required: true
  },
  min: {
    type: Number,
    default: 0
  },
  max: {
    type: Number,
    default: 100
  },
  isPlaying: {
    type: Boolean,
    default: false
  },
  changeOnDrag: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['update:value', 'drag-start', 'drag-end', 'seeking']);

const containerRef = ref<HTMLElement | null>(null);
const isHovering = ref(false);
const isDragging = ref(false);
const localValue = ref(props.value);
const bounceX = ref(0);

const THROTTLE_MS = 20;
let lastEmitTime = 0;

const MAX_HEIGHT = 20;
const MIN_HEIGHT = 8;
const INITIAL_INSET = (MAX_HEIGHT - MIN_HEIGHT) / 2;
const MAX_BOUNCE_DISTANCE = 12;

const inset = ref(INITIAL_INSET);

const clipPath = computed(() => {
  return `inset(${inset.value}px 0px round 100px)`;
});

const progress = computed(() => {
    const range = props.max - props.min;
    if (range === 0) return 0;
    return Math.max(0, Math.min(1, (localValue.value - props.min) / range));
});

// Sync localValue with props.value when not dragging
watch(() => props.value, (newVal) => {
  if (!isDragging.value) {
    localValue.value = newVal;
  }
});

const expand = () => {
    inset.value = 0;
};

const collapse = () => {
    inset.value = INITIAL_INSET;
};

const handleHoverStart = () => {
    isHovering.value = true;
    if (!isDragging.value) {
        expand();
    }
};

const handleHoverEnd = () => {
    isHovering.value = false;
    if (!isDragging.value) {
        collapse();
    }
};

const handlePanStart = (event: MouseEvent | TouchEvent) => {
    isDragging.value = true;
    expand();
    emit('drag-start');
    emit('seeking', true);
    
    // Initial calculation
    calculateValue(event);

    window.addEventListener('mousemove', handlePan);
    window.addEventListener('touchmove', handlePan);
    window.addEventListener('mouseup', handlePanEnd);
    window.addEventListener('touchend', handlePanEnd);
};

const calculateValue = (event: MouseEvent | TouchEvent) => {
    if (!containerRef.value) return;
    const rect = containerRef.value.getBoundingClientRect();
    const clientX = 'touches' in event ? event.touches[0].clientX : (event as MouseEvent).clientX;
    
    const relPos = (clientX - rect.left) / rect.width;
    
    // Bounce effect
    if (relPos < 0) {
        bounceX.value = Math.tanh(relPos * 2) * MAX_BOUNCE_DISTANCE;
    } else if (relPos > 1) {
        bounceX.value = Math.tanh((relPos - 1) * 2) * MAX_BOUNCE_DISTANCE;
    } else {
        bounceX.value = 0;
    }
    
    const clampedPos = Math.max(0, Math.min(1, relPos));
    const newValue = props.min + clampedPos * (props.max - props.min);
    
    localValue.value = newValue;
    
    if (props.changeOnDrag) {
        const now = Date.now();
        if (now - lastEmitTime >= THROTTLE_MS) {
            lastEmitTime = now;
            emit('update:value', newValue);
        }
    }
};

const handlePan = (event: Event) => {
    // MouseEvent or TouchEvent
    calculateValue(event as MouseEvent | TouchEvent);
};

const handlePanEnd = () => {
    isDragging.value = false;
    bounceX.value = 0;
    
    if (isHovering.value) {
        expand();
    } else {
        collapse();
    }
    
    emit('seeking', false);
    emit('drag-end');
    
    // Commit value
    emit('update:value', localValue.value);

    window.removeEventListener('mousemove', handlePan);
    window.removeEventListener('touchmove', handlePan);
    window.removeEventListener('mouseup', handlePanEnd);
    window.removeEventListener('touchend', handlePanEnd);
};

onUnmounted(() => {
    window.removeEventListener('mousemove', handlePan);
    window.removeEventListener('touchmove', handlePan);
    window.removeEventListener('mouseup', handlePanEnd);
    window.removeEventListener('touchend', handlePanEnd);
});

</script>

<style scoped>
.bouncing-slider {
	touch-action: none;
	cursor: pointer;
	display: flex;
	justify-content: stretch;
	align-items: center;
	min-height: 24px;
    width: 100%; /* Ensure it takes full width */
	transform: translateZ(0);
    /* Transition for bounce effect on container */
    transition: transform 0.1s linear; 
}

.inner {
    flex: 1;
    width: 100%;
    height: 20px;
    background-color: #ffffff26;
    transition: clip-path 0.3s cubic-bezier(0.25, 0.8, 0.5, 1);
    overflow: hidden; /* Needed for clip-path visualization in some contexts/fallbacks */
}

.thumb {
    width: 100%;
    height: 100%;
    background-color: white;
    opacity: 0.4;
    transform-origin: left center;
    transition: transform 0.1s linear; /* Smooth visual update during drag/play */
}

.bouncing-slider > svg {
	opacity: 0.5;
}
</style>
