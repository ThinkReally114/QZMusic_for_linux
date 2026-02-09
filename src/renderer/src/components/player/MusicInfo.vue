<template>
  <div class="musicInfo" :class="className">
    <div class="info">
      <TextMarquee v-if="name !== undefined" class="name">
        {{ name }}
      </TextMarquee>
      <TextMarquee v-if="artists && artists.length > 0" class="artists">
        <span v-for="(artist, index) in artists" :key="`artist-${artist}-${index}`">
          <a @click.stop="onArtistClicked && onArtistClicked(artist, index)">{{ artist }}</a>
        </span>
      </TextMarquee>
      <TextMarquee v-if="album !== undefined" class="album">
        <a @click.stop="onAlbumClicked && onAlbumClicked()">{{ album }}</a>
      </TextMarquee>
    </div>
    <!-- MenuButton placeholder or implementation -->
    <div class="menu-button-placeholder" @click="onMenuButtonClicked">
      <!-- Icon could go here -->
    </div>
  </div>
</template>

<script setup lang="ts">
import TextMarquee from './TextMarquee.vue';

const props = defineProps<{
  name?: string;
  artists?: string[];
  album?: string;
  onArtistClicked?: (artist: string, index: number) => void;
  onAlbumClicked?: () => void;
  onMenuButtonClicked?: () => void;
  className?: string;
}>();
</script>

<style scoped>
.musicInfo {
	display: flex;
	color: white;
	font-size: max(2vh, 1em);
	min-width: 0;
}

.info {
	flex: 1;
	min-width: 0;
	overflow: hidden;
	/* Fixed line-height to prevent layout shifting */
	line-height: 1.25em;
    display: flex;
    flex-direction: column;
}

.name {
	white-space: nowrap;
	cursor: text;
	user-select: text;
	min-width: 0;
	font-weight: 500;
	letter-spacing: 0.4px;
	opacity: 0.9;
	mix-blend-mode: normal !important;
}

.artists,
.album {
	white-space: nowrap;
	text-align: center;
	opacity: 0.45;
	font-weight: 400;

	letter-spacing: 0.4px;
}

.artists :deep(a),
.album :deep(a) {
    text-decoration: none;
    user-select: text;
    cursor: default;
    color: inherit;
}

.artists :deep(a:hover),
.album :deep(a:hover) {
    opacity: 0.75;
}

.artists :deep(a:active),
.album :deep(a:active) {
    opacity: 0.5;
}

/* Add separators between artists */
.artists :deep(span::after) {
    content: ", ";
}

.artists :deep(span:nth-last-child(2)::after) {
    content: "/";
}

.artists :deep(span:last-child::after) {
    content: "";
}

</style>
