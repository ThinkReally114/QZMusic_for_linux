<template>
  <MainLayout />
  <FullScreenPlayer />
  <LoginDialog v-model:visible="showLoginDialog" />
  <Settings v-if="showSettings" @close="showSettings = false" />
</template>

<script setup lang="ts">
import { ref, provide, onMounted, onBeforeUnmount } from 'vue';
import MainLayout from './layout/MainLayout.vue';
import Settings from './components/Settings.vue';
import FullScreenPlayer from './components/FullScreenPlayer.vue';
import LoginDialog from './components/LoginDialog.vue';
import { useAuthStore } from './stores/auth';
import { usePlaylistsStore } from './stores/playlists';
import { usePlayerStore } from './stores/player';

const showSettings = ref(false);
const showLoginDialog = ref(false);
const authStore = useAuthStore();
const playlistsStore = usePlaylistsStore();
const playerStore = usePlayerStore();

// Provide to child components
provide('openSettings', () => { showSettings.value = true; });
provide('openLoginDialog', () => { showLoginDialog.value = true; });

const isTypingTarget = (target: EventTarget | null) => {
  const element = target as HTMLElement | null;
  return Boolean(
    element?.closest('input, textarea, select, [contenteditable="true"]')
  );
};

const handleGlobalShortcut = (event: KeyboardEvent) => {
  if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || isTypingTarget(event.target)) return;

  const key = event.key.toLowerCase();
  if (event.code === 'Space') {
    event.preventDefault();
    playerStore.togglePlay();
  } else if (key === 'a') {
    event.preventDefault();
    playerStore.prev();
  } else if (key === 'd') {
    event.preventDefault();
    playerStore.next();
  }
};

// Apply saved theme on app startup
onMounted(async () => {
  window.addEventListener('keydown', handleGlobalShortcut);
  if (window.electronAPI?.settings) {
    const settings = await window.electronAPI.settings.getAll();
    document.documentElement.setAttribute('data-theme', settings.theme);
    const accentColor = settings.accentColor === '#b3c9df' ? '#8289d3' : settings.accentColor;
    document.documentElement.style.setProperty('--color-accent', accentColor);
    document.documentElement.style.setProperty('--color-accent-gradient', accentColor);
    const atmosphere = accentColor === '#8289d3'
      ? 'linear-gradient(180deg, rgba(176, 186, 235, 0.36) 0%, rgba(177, 191, 233, 0.31) 18%, rgba(179, 201, 223, 0.25) 38%, rgba(193, 192, 211, 0.18) 58%, rgba(223, 172, 185, 0.11) 78%, transparent 100%)'
      : 'linear-gradient(180deg, color-mix(in srgb, var(--color-accent) 12%, transparent) 0%, color-mix(in srgb, var(--color-accent) 7%, transparent) 44%, transparent 100%)';
    document.documentElement.style.setProperty('--color-atmosphere-gradient', atmosphere);
  }
  await authStore.init();
  await playlistsStore.refresh();
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleGlobalShortcut);
});
</script>

<style>
@import "styles/main.css";
</style>
