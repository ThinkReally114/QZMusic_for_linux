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
                  <button class="action-btn" @click="changeCacheLocation" :disabled="isChangingCache">
                    <Icon v-if="isChangingCache" icon="lucide:loader-2" class="spin" />
                    <Icon v-else icon="lucide:folder-edit" />
                    {{ isChangingCache ? '迁移中...' : '更改' }}
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

            <!-- 插件管理 -->
            <div v-else-if="activeCategory === 'plugins'" class="section">
              <div class="section-header">
                <div>
                    <h2 class="section-title" style="border:none;margin:0;padding:0">插件管理</h2>
                    <div class="setting-desc">管理已安装的音乐源插件</div>
                </div>
                <button class="action-btn primary" @click="installPluginFromFile">
                    <Icon icon="lucide:plus" />
                    安装插件
                </button>
              </div>

              <div class="plugin-grid">
                 <div v-if="plugins.length === 0" class="empty-state">
                    <Icon icon="lucide:package-open" class="empty-icon"/>
                    <p>暂无已安装的插件</p>
                    <button class="text-btn" @click="installPluginFromFile">点击安装</button>
                 </div>
                 <div v-for="plugin in plugins" :key="plugin.id" class="plugin-card">
                    <div class="plugin-info">
                        <div class="plugin-header">
                            <span class="plugin-name">{{ plugin.name || plugin.id }}</span>
                            <span class="plugin-version" v-if="plugin.version">v{{ plugin.version }}</span>
                        </div>
                        <p class="plugin-desc">{{ plugin.description || '暂无描述' }}</p>
                        <div class="plugin-tags" v-if="plugin.quality?.length">
                            <span v-for="q in plugin.quality" :key="q.id" class="tag" :title="q.name">{{ q.ui }}</span>
                        </div>
                    </div>
                    <div class="plugin-actions">
                        <button class="action-btn danger small" @click="confirmUninstall(plugin)">
                            <Icon icon="lucide:trash-2" />
                            卸载
                        </button>
                    </div>
                 </div>
              </div>
            </div>

            <!-- Uninstall Confirm Modal -->


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

            <!-- Uninstall Confirm Modal -->
             <Transition name="fade">
                <div class="modal-overlay" v-if="showUninstallModal">
                    <div class="modal-content">
                        <h3>卸载插件</h3>
                        <p>确定要卸载插件 "{{ pluginToUninstall?.name }}" 吗？此操作无法撤销。</p>
                        <div class="modal-actions">
                            <button class="action-btn" @click="showUninstallModal = false">取消</button>
                            <button class="action-btn danger" @click="executeUninstall">确认卸载</button>
                        </div>
                    </div>
                </div>
             </Transition>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, reactive, onBeforeMount, nextTick, watch } from 'vue';
import { Icon } from '@iconify/vue';
import { ElMessage } from 'element-plus';
import { usePlayerStore } from '../stores/player';

const playerStore = usePlayerStore();

defineEmits(['close']);

const categories = [
  { id: 'storage', name: '存储', icon: 'lucide:hard-drive' },
  { id: 'plugins', name: '插件', icon: 'lucide:blocks' },
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
const plugins = ref<any[]>([]);

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

const loadPlugins = async () => {
    try {
        if (window.electronAPI?.plugin?.getAll) {
             plugins.value = await window.electronAPI.plugin.getAll();
        }
    } catch (e) {
         console.error('Failed to load plugins', e);
    }
};

const uninstallPlugin = async (id: string) => {
    try {
        if (window.electronAPI?.plugin?.uninstall) {
            await window.electronAPI.plugin.uninstall(id);
            await loadPlugins();
        }
    } catch (e) {
        console.error('Failed to uninstall plugin', e);
    }
}

const installPluginFromFile = async () => {
    try {
        if (window.electronAPI?.plugin?.install) {
            const result = await window.electronAPI.plugin.install();
            if (result.success) {
                ElMessage.success(result.message || '安装成功');
                await loadPlugins();
            } else {
                if (result.message !== 'canceled') { // Assuming 'canceled' might be a thing, or just show whatever message comes back
                     ElMessage.error(result.message || '安装失败');
                }
            }
        }
    } catch (e) {
        console.error('Failed to install plugin', e);
        ElMessage.error('安装过程中发生错误');
    }
}

// Modal Logic
const showUninstallModal = ref(false);
const pluginToUninstall = ref<any>(null);

const confirmUninstall = (plugin: any) => {
    pluginToUninstall.value = plugin;
    showUninstallModal.value = true;
};

const executeUninstall = async () => {
    if (pluginToUninstall.value) {
        await uninstallPlugin(pluginToUninstall.value.id);
        showUninstallModal.value = false;
        pluginToUninstall.value = null;
    }
};

watch(activeCategory, (newVal) => {
    if (newVal === 'plugins') {
        loadPlugins();
    }
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

const isChangingCache = ref(false);

const changeCacheLocation = async () => {
    if (window.electronAPI && !isChangingCache.value) {
        try {
            const path = await window.electronAPI.selectDirectory();
            if (path) {
                isChangingCache.value = true;
                const result = await window.electronAPI.changeCacheLocation(path);
                if (result.success) {
                    ElMessage.success('缓存位置已修改');
                    await loadCacheInfo();
                } else {
                    ElMessage.error(result.message || '修改失败');
                }
            }
        } catch (e) {
            ElMessage.error('操作失败');
            console.error(e);
        } finally {
            isChangingCache.value = false;
        }
    }
}

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
  display: flex;
  align-items: center;
  gap: 12px;
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

.spin {
    animation: spin 1s linear infinite;
}

@keyframes spin {
    from {
        transform: rotate(0deg);
    }
    to {
        transform: rotate(360deg);
    }
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

/* Plugin Card Styles */
.plugin-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.plugin-card {
    background: var(--color-bg-secondary);
    border-radius: 12px;
    padding: 20px;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border: 1px solid var(--color-border);
    transition: all 0.2s ease;
}

.plugin-card:hover {
    border-color: var(--color-accent);
    box-shadow: var(--shadow-sm);
    transform: translateY(-2px);
}

.plugin-info {
    flex: 1;
}



.plugin-tags {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
}

.tag {
    font-size: 11px;
    background: var(--color-accent-soft);
    color: var(--color-accent);
    padding: 2px 6px;
    border-radius: 4px;
    font-weight: 500;
}

.action-btn.small {
    padding: 6px 12px;
    font-size: 13px;
}

.section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--color-border);
}

.plugin-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 16px;
}

.empty-state {
    grid-column: 1 / -1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 0;
    color: var(--color-text-muted);
}

.empty-icon {
    width: 48px;
    height: 48px;
    margin-bottom: 16px;
    opacity: 0.5;
}

.text-btn {
    margin-top: 12px;
    color: var(--color-accent);
    background: none;
    border: none;
    cursor: pointer;
    font-size: 14px;
    text-decoration: underline;
}

/* Modal */
.modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
    backdrop-filter: blur(4px);
}

.modal-content {
    background: var(--color-bg-primary);
    padding: 24px;
    border-radius: 16px;
    width: 400px;
    box-shadow: var(--shadow-lg);
    border: 1px solid var(--color-border);
}

.modal-content h3 {
    margin-bottom: 16px;
    font-size: 18px;
    color: var(--color-text-primary);
}

.modal-content p {
    color: var(--color-text-secondary);
    margin-bottom: 24px;
    line-height: 1.5;
}

.modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
}

.plugin-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
}

.plugin-name {
    font-weight: 500;
    font-size: 16px;
    color: var(--color-text-primary);
}

.plugin-version {
    font-size: 12px;
    background: var(--color-bg-tertiary);
    padding: 2px 6px;
    border-radius: 4px;
    color: var(--color-text-secondary);
}

.plugin-desc {
    font-size: 13px;
    color: var(--color-text-secondary);
    padding-bottom: 8px;
}

.action-btn.small {
    padding: 6px 12px;
    font-size: 13px;
}
</style>
