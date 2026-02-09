<template>
  <button
    class="toggleIconButton"
    :class="className"
    type="button"
    @click="handleClick"
  >
    <img :src="iconSrc" />
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue';

// Icons
import LyricsOffIcon from '@assets/lyrics_off.svg';
import LyricsOnIcon from '@assets/lyrics_on.svg';
import PlaylistOffIcon from '@assets/playlist_off.svg';
import PlaylistOnIcon from '@assets/playlist_on.svg';
import AirplayIcon from '@assets/airplay.svg';

const props = defineProps<{
  type: 'lyrics' | 'playlist' | 'airplay';
  checked?: boolean;
  className?: string;
  onClick?: (event: MouseEvent) => void;
}>();

const icons = computed(() => {
  switch (props.type) {
    case 'lyrics':
      return [LyricsOffIcon, LyricsOnIcon];
    case 'playlist':
      return [PlaylistOffIcon, PlaylistOnIcon];
    case 'airplay':
      return [AirplayIcon, AirplayIcon];
    default:
      return [AirplayIcon, AirplayIcon];
  }
});

const iconSrc = computed(() => {
    return props.checked ? icons.value[1] : icons.value[0];
});

const handleClick = (event: MouseEvent) => {
  if (props.onClick) {
    props.onClick(event);
  }
};
</script>

<style scoped>
.toggleIconButton {
	border: none;
	background-color: transparent;
	aspect-ratio: 1 / 1;
	display: flex;
	justify-content: center;
	align-items: center;
	color: currentColor;

	opacity: 0.7;
	width: 3em;
	height: 3em;
  cursor: default;

	& img {
		width: 3em;
		height: 3em;
		aspect-ratio: 1 / 1;
        filter: brightness(0) invert(1); /* Force white color */
	}

	@media screen and (max-width: 1600px), (max-height: 1000px) {
		width: 2em;
		height: 2em;

		& img {
			width: 2em;
			height: 2em;
		}
	}
}

.toggleIconButton:active {
    opacity: 0.8;
    transform: scale(0.95);
}
</style>
