<template>
  <header class="topbar">
    <div class="left-controls">
      <div class="nav-group">
        <button class="nav-btn ripple-btn" @click="goBack" title="返回">
          <Icon icon="lucide:chevron-left" class="nav-icon" />
        </button>
        <button class="nav-btn ripple-btn" @click="goForward" title="前进">
          <Icon icon="lucide:chevron-right" class="nav-icon" />
        </button>
      </div>

      <div class="search-wrapper">
        <div class="search-container">
          <Icon icon="lucide:search" class="search-icon" />
          <input
              type="text"
              placeholder="搜索音乐、歌手、专辑..."
              class="search-input"
          />
        </div>
      </div>
    </div>

    <div class="right-controls">
      <div class="app-actions">
        <button class="action-btn ripple-btn" title="设置" @click="openSettings">
          <Icon icon="lucide:settings" class="action-icon" />
        </button>
      </div>

      <div class="divider"></div>

      <div class="window-actions">
        <button class="win-btn minimize" @click="handleMinimize" title="最小化">
          <Icon icon="lucide:minus" class="win-icon" />
        </button>

        <button class="win-btn maximize" @click="handleMaximize" :title="isMaximized ? '还原' : '最大化'">
          <Icon :icon="isMaximized ? 'lucide:copy' : 'lucide:square'" class="win-icon" style="transform: scale(0.8);" />
        </button>

        <button class="win-btn close" @click="handleClose" title="关闭">
          <Icon icon="lucide:x" class="win-icon" />
        </button>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, inject } from 'vue';
import { useRouter } from 'vue-router';
import { Icon } from '@iconify/vue';

const router = useRouter();
const isMaximized = ref(false);

const goBack = () => router.back();
const goForward = () => router.forward();

// Settings
const openSettings = inject<() => void>('openSettings', () => {});

// --- 窗口控制逻辑 ---
const handleMinimize = () => window.electronAPI?.minimizeWindow();

const handleMaximize = async () => {
  window.electronAPI?.maximizeWindow();
  isMaximized.value = !isMaximized.value;
  checkMaximizedState();
};

const handleClose = () => window.electronAPI?.closeWindow();

const checkMaximizedState = async () => {
  if (window.electronAPI) {
    setTimeout(async () => {
      isMaximized.value = await window.electronAPI!.isMaximized();
    }, 100);
  }
};

onMounted(() => {
  checkMaximizedState();
  window.addEventListener('resize', checkMaximizedState);
});

onUnmounted(() => {
  window.removeEventListener('resize', checkMaximizedState);
});
</script>

<style scoped>
/* 变量定义 */
:root {
  --radius-soft: 10px;
}

.topbar {
  height: 64px;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px 0 24px;
  background-color: var(--color-bg-primary);
  border-bottom: 1px solid var(--color-border);
  position: sticky;
  top: 0;
  z-index: 100;
  -webkit-app-region: drag;
  user-select: none;
}

/* --- 左侧区域 --- */
.left-controls {
  display: flex;
  align-items: center;
  gap: 16px;
}

.nav-group {
  display: flex;
  gap: 10px;
}

/* --- 统一功能按钮（Nav / Settings）--- */
.nav-btn,
.action-btn {
  -webkit-app-region: no-drag;
  width: 40px;
  height: 40px;
  border-radius: 10px; /* 圆角边框 */
  display: flex;
  align-items: center;
  justify-content: center;

  color: var(--color-text-secondary);
  background-color: transparent;
  cursor: pointer;

  position: relative;
  overflow: hidden; /* 关键：裁剪涟漪 */
  transition:
      background-color 0.2s ease,
      border-color 0.2s ease,
      color 0.2s ease,
      transform 0.12s ease;
}


.nav-btn:hover,
.action-btn:hover {
  background-color: var(--color-bg-tertiary);
  color: var(--color-text-primary);
}

/* 图标 */
.nav-icon,
.action-icon {
  width: 22px;
  height: 22px;
  z-index: 2;
}

.ripple-btn::after {
  content: "";
  position: absolute;
  top: 50%;
  left: 50%;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.1); /* 涟漪颜色 */
  border-radius: 50%;
  transform: translate(-50%, -50%) scale(0); /* 初始不可见 */
  opacity: 0;
  pointer-events: none;
}

/* 点击瞬间：迅速放大并显示 */
.ripple-btn:active::after {
  transform: translate(-50%, -50%) scale(2.5);
  opacity: 1;
  transition: 0s;
}

/* 松开后：慢慢淡出 */
.ripple-btn:not(:active):after {
  transform: translate(-50%, -50%) scale(2.5);
  opacity: 0;
  transition: opacity 0.4s ease-out;
}


/* --- 搜索框 --- */
.search-wrapper {
  -webkit-app-region: no-drag;
}

.search-container {
  display: flex;
  align-items: center;
  height: 40px;
  width: 260px;
  padding: 0 14px;
  background-color: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: 20px;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  cursor: text;
}

.search-container:hover {
  border-color: var(--color-text-muted);
}

.search-container:focus-within {
  width: 340px;
  border-color: var(--color-accent);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  background: linear-gradient(
      90deg,
      var(--color-bg-primary) 0%,
      var(--color-bg-tertiary) 100%
  );
}

.search-icon {
  color: var(--color-text-muted);
  margin-right: 10px;
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  transition: color 0.2s;
}

.search-container:focus-within .search-icon {
  color: var(--color-accent);
}

.search-input {
  flex: 1;
  height: 100%;
  font-size: 15px;
  color: var(--color-text-primary);
  background: transparent;
  border: none;
  outline: none;
}

.search-input::placeholder {
  color: var(--color-text-muted);
  font-size: 14px;
}

/* --- 右侧区域布局调整 --- */
.right-controls {
  display: flex;
  align-items: center;
  gap: 4px; /* 减少间距，让设置按钮更靠近右边 */
  height: 100%;
}

.app-actions {
  display: flex;
  align-items: center;
}

.divider {
  width: 1px;
  height: 24px;
  background-color: var(--color-border);
  margin: 0 4px; /* 减少分割线左右的间距 */
}

/* --- 窗口控制区 --- */
.window-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.win-btn {
  -webkit-app-region: no-drag;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: transparent;
  color: var(--color-text-primary);
  border: none;
  cursor: pointer;
  transition: all 0.1s;
}

.win-icon {
  width: 16px;
  height: 16px;
}

.win-btn:not(.close):hover {
  background-color: var(--color-bg-tertiary);
}

.win-btn:not(.close):active {
  background-color: var(--color-bg-elevated);
}

.win-btn.close:hover {
  background-color: #e81123;
  color: white;
}

.win-btn.close:active {
  background-color: #bf0f1d;
}
</style>