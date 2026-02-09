<template>
  <button
    class="mediaButton"
    :class="className"
    type="button"
    @click="onClick"
  >
    <slot></slot>
  </button>
</template>

<script setup lang="ts">
defineProps<{
  className?: string;
  onClick?: (event: MouseEvent) => void;
}>();
</script>

<style scoped>
@keyframes pressed-animation {
	0% {
		transform: scale(1);
	}

	20% {
		transform: scale(0.85);
	}

	50% {
		transform: scale(1.1);
	}

	100% {
		transform: scale(1);
	}
}

.mediaButton {
	aspect-ratio: 1 / 1;
	display: flex;
	justify-content: center;
	align-items: center;
	border-radius: 50%;
	position: relative;
	background-color: transparent;
	padding: 0;
	border: none;
    cursor: pointer;

	transition: background-color 0.3s;
}

.mediaButton:hover {
    background-color: rgba(255, 255, 255, 0.133); /* #fff2 approx */
}

.mediaButton:active {
    background-color: rgba(255, 255, 255, 0.133);
}

.mediaButton:active :deep(*) {
    animation-name: none !important;
}

.mediaButton :deep(*) {
    transition: transform 0.5s;
    transform-origin: center;
    animation: pressed-animation 0.7s;
    animation-composition: accumulate;
}
</style>
