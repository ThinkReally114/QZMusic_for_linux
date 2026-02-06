<template>
  <div class="main-layout" :class="{ 'has-player': hasSongs }">
    <Sidebar class="layout-sidebar" />
    <main class="content-area">
      <TopBar />
      <div class="page-content">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </div>
    </main>
    <PlayerBar />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import Sidebar from '../components/Sidebar.vue';
import TopBar from '../components/TopBar.vue';
import PlayerBar from '../components/PlayerBar.vue';
import { usePlayerStore } from '../stores/player.ts';

const playerStore = usePlayerStore();
const hasSongs = computed(() => playerStore.playlist.length > 0);
</script>

<style>
/* 这确保 width: 100% + padding 不会撑破容器 */
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

/* 隐藏 body 的滚动条，防止整体页面出现原生滚动条 */
body {
  overflow: hidden;
}
</style>

<style scoped>
.main-layout {
  display: flex;
  height: 100vh;
  width: 100vw;
  background-color: var(--color-bg-primary);
  overflow: hidden; /* 确保整个应用不会出现双重滚动条 */
}

/* Dynamic Spacing for PlayerBar */
.layout-sidebar,
.content-area {
  transition: padding-bottom 0.3s ease;
}

.main-layout.has-player .layout-sidebar,
.main-layout.has-player .content-area {
  padding-bottom: 80px; /* PlayerBar Height */
}

.content-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
  min-width: 0;
}

.page-content {
  flex: 1;
  overflow-y: auto;
  padding: 0;
  background-color: var(--color-bg-primary);
  position: relative;
}

/* 滚动条样式优化 */
.page-content::-webkit-scrollbar {
  width: 8px;
}

.page-content::-webkit-scrollbar-track {
  background: transparent;
}

.page-content::-webkit-scrollbar-thumb {
  background: var(--color-border-light);
  border-radius: 4px;
}

.page-content::-webkit-scrollbar-thumb:hover {
  background: var(--color-text-muted);
}

/* Route Transition Utils */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>