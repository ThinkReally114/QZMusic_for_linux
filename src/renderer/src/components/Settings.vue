<template>
  <Transition name="fade">
    <div class="settings-overlay" v-if="isLoaded">
      <div class="settings-container">
        <!-- Header -->
        <div class="settings-header">
          <h1 class="settings-title">设置</h1>
          <button class="close-btn" @click="$emit('close')">
            <Icon icon="lucide:x" class="close-icon" />
          </button>
        </div>

        <div class="settings-body">
          <!-- Left Sidebar -->
          <nav class="settings-nav">
            <div
              v-for="category in categories"
              :key="category.id"
              class="nav-item"
              :class="{ active: activeCategory === category.id }"
              @click="activeCategory = category.id"
            >
              <Icon :icon="category.icon" class="nav-icon" />
              <span>{{ category.name }}</span>
            </div>
          </nav>

          <!-- Right Content -->
          <div class="settings-content">
            <!-- 存储设置 -->
            <div v-if="activeCategory === 'storage'" class="section">
              <h2 class="section-title">存储设置</h2>

              <!-- 缓存开关 -->
              <div class="setting-item">
                <div class="setting-info">
                  <div class="setting-label">缓存音乐到本地</div>
                  <div class="setting-desc">开启后将在本地保存播放过的音乐，加快加载速度</div>
                </div>
                <div class="setting-control">
                  <label class="toggle-switch" :class="{ 'no-transition': !enableTransition }">
                    <input type="checkbox" v-model="settings.persistCache" @change="onCacheToggle" />
                    <span class="toggle-slider"></span>
                  </label>
                </div>
              </div>

              <!-- 缓存位置 -->
              <div class="setting-item">
                <div class="setting-info">
                  <div class="setting-label">缓存位置</div>
                  <div class="setting-desc path-text">{{ cacheInfo.path || '加载中...' }}</div>
                </div>
                <div class="setting-control">
                  <button class="action-btn" @click="openCacheFolder">
                    <Icon icon="lucide:folder-open" />
                    打开目录
                  </button>
                </div>
              </div>

              <!-- 缓存大小 -->
              <div class="setting-item">
                <div class="setting-info">
                  <div class="setting-label">已占用空间</div>
                  <div class="setting-desc">{{ cacheInfo.size || '计算中...' }}</div>
                </div>
                <div class="setting-control">
                  <button class="action-btn danger" @click="clearCache">
                    <Icon icon="lucide:trash-2" />
                    清理缓存
                  </button>
                </div>
              </div>
            </div>

            <!-- 外观设置 -->
            <div v-else-if="activeCategory === 'appearance'" class="section">
              <h2 class="section-title">外观设置</h2>

              <!-- 亮暗模式 -->
              <div class="setting-item">
                <div class="setting-info">
                  <div class="setting-label">主题模式</div>
                  <div class="setting-desc">选择深色或浅色主题</div>
                </div>
                <div class="setting-control">
                  <div class="theme-toggle">
                    <button 
                      class="theme-btn" 
                      :class="{ active: appearance.theme === 'dark' }"
                      @click="setTheme('dark')"
                    >
                      <Icon icon="lucide:moon" />
                      深色
                    </button>
                    <button 
                      class="theme-btn" 
                      :class="{ active: appearance.theme === 'light' }"
                      @click="setTheme('light')"
                    >
                      <Icon icon="lucide:sun" />
                      浅色
                    </button>
                  </div>
                </div>
              </div>

              <!-- 主题色 -->
              <div class="setting-item">
                <div class="setting-info">
                  <div class="setting-label">主题色</div>
                  <div class="setting-desc">选择你喜欢的强调色</div>
                </div>
                <div class="setting-control">
                  <div class="color-swatches">
                    <button
                      v-for="color in accentColors"
                      :key="color.value"
                      class="color-swatch"
                      :class="{ active: appearance.accentColor === color.value }"
                      :style="{ '--swatch-color': color.value }"
                      :title="color.name"
                      @click="setAccentColor(color.value)"
                    >
                      <Icon v-if="appearance.accentColor === color.value" icon="lucide:check" class="check-icon" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- 播放设置 -->
            <div v-else-if="activeCategory === 'playback'" class="section">
              <h2 class="section-title">播放设置</h2>
              
              <!-- 列表添加模式 -->
              <div class="setting-item">
                <div class="setting-info">
                  <div class="setting-label">列表添加模式</div>
                  <div class="setting-desc">选择点击歌曲时的播放行为</div>
                </div>
                <div class="setting-control">
                  <div class="radio-group">
                    <label class="radio-option">
                      <input type="radio" value="replace" v-model="playerStore.addListMode">
                      <span class="radio-label">替换当前列表</span>
                    </label>
                    <label class="radio-option">
                      <input type="radio" value="append" v-model="playerStore.addListMode">
                      <span class="radio-label">添加到列表末尾</span>
                    </label>
                  </div>
                </div>
              </div>

              <div class="placeholder-content">
                <Icon icon="lucide:headphones" class="placeholder-icon" />
                <p>音质、淡入淡出等设置即将推出</p>
              </div>
            </div>

            <!-- 快捷键 -->
            <div v-else-if="activeCategory === 'shortcuts'" class="section">
              <h2 class="section-title">快捷键</h2>
              <div class="placeholder-content">
                <Icon icon="lucide:keyboard" class="placeholder-icon" />
                <p>自定义快捷键即将推出</p>
              </div>
            </div>

            <!-- 关于 -->
            <div v-else-if="activeCategory === 'about'" class="section">
              <h2 class="section-title">关于</h2>
              <div class="about-content">
                <div class="app-logo">🎶</div>
                <h3>QZ Music</h3>
                <p class="version">版本 1.0.0</p>
                <p class="copyright">©2026 QZ <DEVELOPERS></DEVELOPERS></p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, reactive, onBeforeMount, nextTick } from 'vue';
import { Icon } from '@iconify/vue';
import { usePlayerStore } from '../stores/player';

const playerStore = usePlayerStore();

defineEmits(['close']);

const categories = [
  { id: 'storage', name: '存储', icon: 'lucide:hard-drive' },
  { id: 'appearance', name: '外观', icon: 'lucide:palette' },
  { id: 'playback', name: '播放', icon: 'lucide:headphones' },
  { id: 'shortcuts', name: '快捷键', icon: 'lucide:keyboard' },
  { id: 'about', name: '关于', icon: 'lucide:info' },
];

const accentColors = [
  { name: '红色', value: '#ec4141' },
  { name: '橙色', value: '#f97316' },
  { name: '金色', value: '#eab308' },
  { name: '绿色', value: '#22c55e' },
  { name: '青色', value: '#06b6d4' },
  { name: '蓝色', value: '#3b82f6' },
  { name: '紫色', value: '#8b5cf6' },
  { name: '粉色', value: '#ec4899' },
];

const activeCategory = ref('storage');
const isLoaded = ref(false);
const enableTransition = ref(false);

const settings = reactive({
  persistCache: true,
});

const appearance = reactive({
  theme: 'dark' as 'dark' | 'light',
  accentColor: '#ec4141',
});

const cacheInfo = reactive({
  path: '',
  size: '',
});

const loadCacheInfo = async () => {
  if (window.electronAPI) {
    const info = await window.electronAPI.getCacheInfo();
    cacheInfo.path = info.path;
    cacheInfo.size = info.size;
    settings.persistCache = info.persistCache;
  }
};

const loadAppearance = async () => {
  if (window.electronAPI?.settings) {
    const allSettings = await window.electronAPI.settings.getAll();
    appearance.theme = allSettings.theme;
    appearance.accentColor = allSettings.accentColor;
    applyTheme(appearance.theme);
    applyAccentColor(appearance.accentColor);
  }
};

const applyTheme = (theme: 'dark' | 'light') => {
  document.documentElement.setAttribute('data-theme', theme);
};

const applyAccentColor = (color: string) => {
  document.documentElement.style.setProperty('--color-accent', color);
};

const setTheme = async (theme: 'dark' | 'light') => {
  appearance.theme = theme;
  applyTheme(theme);
  if (window.electronAPI?.settings) {
    await window.electronAPI.settings.setTheme(theme);
  }
};

const setAccentColor = async (color: string) => {
  appearance.accentColor = color;
  applyAccentColor(color);
  if (window.electronAPI?.settings) {
    await window.electronAPI.settings.setAccentColor(color);
  }
};

const onCacheToggle = async () => {
  if (window.electronAPI) {
    await window.electronAPI.setCachePersist(settings.persistCache);
  }
};

const openCacheFolder = async () => {
  if (window.electronAPI) {
    await window.electronAPI.openCacheFolder();
  }
};

const clearCache = async () => {
  if (window.electronAPI) {
    await window.electronAPI.clearCache();
    await loadCacheInfo();
  }
};

// Load settings BEFORE mount to avoid visual flicker
onBeforeMount(async () => {
  await Promise.all([loadCacheInfo(), loadAppearance()]);
  isLoaded.value = true;
  // Enable transition after initial render
  nextTick(() => {
    setTimeout(() => {
      enableTransition.value = true;
    }, 50);
  });
});
</script>

<style scoped>
/* Fade transition */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.settings-overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(8px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.settings-container {
  width: 100%;
  height: 100%;
  background-color: var(--color-bg-primary);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.settings-header {
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
  -webkit-app-region: drag;
}

.settings-title {
  font-size: var(--font-size-xl);
  font-weight: 600;
  color: var(--color-text-primary);
}

.close-btn {
  -webkit-app-region: no-drag;
  width: 40px;
  height: 40px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--transition-base);
}

.close-btn:hover {
  background-color: var(--color-bg-tertiary);
  color: var(--color-text-primary);
  border-color: var(--color-text-muted);
}

.close-icon {
  width: 20px;
  height: 20px;
}

.settings-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

/* Left Navigation */
.settings-nav {
  width: 200px;
  padding: 20px 12px;
  background-color: var(--color-bg-secondary);
  border-right: 1px solid var(--color-border);
  flex-shrink: 0;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  margin-bottom: 4px;
  border-radius: var(--radius-lg);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--transition-base);
}

.nav-item:hover {
  background-color: var(--color-bg-tertiary);
  color: var(--color-text-primary);
}

.nav-item.active {
  background-color: var(--color-accent-soft);
  color: var(--color-accent);
}

.nav-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

/* Right Content */
.settings-content {
  flex: 1;
  padding: 32px 48px;
  overflow-y: auto;
}

.section-title {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: 24px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--color-border);
}

/* Setting Item */
.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 0;
  border-bottom: 1px solid var(--color-border);
}

.setting-info {
  flex: 1;
}

.setting-label {
  font-size: var(--font-size-base);
  color: var(--color-text-primary);
  margin-bottom: 6px;
}

.setting-desc {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.setting-desc.path-text {
  font-family: monospace;
  background-color: var(--color-bg-tertiary);
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  display: inline-block;
  max-width: 400px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.setting-control {
  margin-left: 24px;
}

/* Toggle Switch */
.toggle-switch {
  position: relative;
  display: inline-block;
  width: 48px;
  height: 26px;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  inset: 0;
  background-color: var(--color-bg-tertiary);
  border-radius: 26px;
  transition: var(--transition-base);
}

.toggle-slider:before {
  position: absolute;
  content: "";
  height: 20px;
  width: 20px;
  left: 3px;
  bottom: 3px;
  background-color: var(--color-text-secondary);
  border-radius: 50%;
  transition: var(--transition-base);
}

/* Disable transition on initial load */
.toggle-switch.no-transition .toggle-slider,
.toggle-switch.no-transition .toggle-slider:before {
  transition: none;
}

input:checked + .toggle-slider {
  background-color: var(--color-accent);
}

input:checked + .toggle-slider:before {
  transform: translateX(22px);
  background-color: white;
}

/* Action Button */
.action-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: var(--radius-md);
  background-color: var(--color-bg-tertiary);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
  cursor: pointer;
  font-size: var(--font-size-sm);
  transition: all var(--transition-base);
}

.action-btn:hover {
  background-color: var(--color-bg-elevated);
  border-color: var(--color-text-muted);
}

.action-btn.danger {
  color: #ff6b6b;
}

.action-btn.danger:hover {
  background-color: rgba(255, 107, 107, 0.1);
  border-color: #ff6b6b;
}

/* Placeholder */
.placeholder-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 0;
  color: var(--color-text-muted);
}

.placeholder-icon {
  width: 64px;
  height: 64px;
  margin-bottom: 16px;
  opacity: 0.5;
}

/* About */
.about-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60px 0;
  text-align: center;
}

.app-logo {
  width: 80px;
  height: 80px;
  background: linear-gradient(135deg, #ec4141, #ff6b6b);
  border-radius: var(--radius-xl);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40px;
  margin-bottom: 20px;
  box-shadow: var(--shadow-lg);
}

.about-content h3 {
  font-size: var(--font-size-2xl);
  color: var(--color-text-primary);
  margin-bottom: 8px;
}

.version {
  color: var(--color-text-secondary);
  margin-bottom: 4px;
}

.copyright {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

/* Scrollbar */
.settings-content::-webkit-scrollbar {
  width: 6px;
}

.settings-content::-webkit-scrollbar-track {
  background: transparent;
}

.settings-content::-webkit-scrollbar-thumb {
  background: var(--color-border-light);
  border-radius: 3px;
}

.settings-content::-webkit-scrollbar-thumb:hover {
  background: var(--color-text-muted);
}

/* Theme Toggle */
.theme-toggle {
  display: flex;
  gap: 8px;
  background-color: var(--color-bg-tertiary);
  padding: 4px;
  border-radius: var(--radius-md);
}

.theme-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: var(--radius-sm);
  background: transparent;
  border: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  font-size: var(--font-size-sm);
  transition: all 0.2s ease;
}

.theme-btn:hover {
  color: var(--color-text-primary);
}

.theme-btn.active {
  background-color: var(--color-bg-primary);
  color: var(--color-accent);
  box-shadow: var(--shadow-sm);
}

/* Color Swatches */
.color-swatches {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.color-swatch {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-full);
  border: 3px solid transparent;
  background-color: var(--swatch-color);
  cursor: pointer;
  position: relative;
  transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.color-swatch:hover {
  transform: scale(1.1);
}

.color-swatch.active {
  box-shadow: 0 0 16px var(--swatch-color);
}

.check-icon {
  width: 18px;
  height: 18px;
  color: white;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5));
}

/* Radio Group */
.radio-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.radio-option {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
}

.radio-option input[type="radio"] {
  accent-color: var(--color-accent);
  width: 16px;
  height: 16px;
  cursor: pointer;
}
</style>
