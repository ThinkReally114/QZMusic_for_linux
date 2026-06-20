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
import PlayerBar from '../components/player/PlayerBar.vue';
import { usePlayerStore } from '../stores/player';

const playerStore = usePlayerStore();
const hasSongs = computed(() => playerStore.playlist.length > 0);
</script>

<style>
/* 这确保 width: 100% + padding 不会撑破容器 */
*, *::before, *::after {
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
  background: var(--color-bg-primary);
  overflow: hidden;
}

.content-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
  min-width: 0;
  background:
    var(--color-atmosphere-gradient) top / 100% 240px no-repeat,
    var(--color-bg-primary);
}

.page-content {
  flex: 1;
  overflow-y: auto;
  padding: 0 0 20px;
  background: transparent;
  position: relative;
  box-sizing: border-box;
  scroll-padding-bottom: 20px;
  transition: padding-bottom 0.24s ease, scroll-padding-bottom 0.24s ease;
}

.main-layout.has-player .page-content {
  padding-bottom: 128px;
  scroll-padding-bottom: 128px;
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
