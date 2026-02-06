<template>
  <MainLayout />
  <FullScreenPlayer />
  <Settings v-if="showSettings" @close="showSettings = false" />
</template>

<script setup lang="ts">
import { ref, provide, onMounted } from 'vue';
import MainLayout from './layout/MainLayout.vue';
import Settings from './components/Settings.vue';
import FullScreenPlayer from './components/FullScreenPlayer.vue';

const showSettings = ref(false);

// Provide to child components
provide('openSettings', () => { showSettings.value = true; });

// Apply saved theme on app startup
onMounted(async () => {
  if (window.electronAPI?.settings) {
    const settings = await window.electronAPI.settings.getAll();
    document.documentElement.setAttribute('data-theme', settings.theme);
    document.documentElement.style.setProperty('--color-accent', settings.accentColor);
  }
});
</script>

<style>
@import "styles/main.css";
</style>