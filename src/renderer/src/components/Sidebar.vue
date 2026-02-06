<template>
  <aside class="sidebar">
    <!-- 顶部区域 -->
    <div class="sidebar-header">
      <div class="logo-area">
        <div class="logo-icon">🎶</div>
        <span class="app-name">QZ Music</span>
      </div>
    </div>

    <!-- 主导航 -->
    <div class="nav-section">
      <router-link to="/" class="nav-item" active-class="active">
        <Icon icon="lucide:home" class="nav-icon" />
        <span class="nav-text">推荐</span>
      </router-link>
      <router-link to="/local" class="nav-item" active-class="active">
        <Icon icon="lucide:hard-drive" class="nav-icon" />
        <span class="nav-text">本地音乐</span>
      </router-link>
    </div>

    <!-- 我的音乐 -->
    <div class="divider"></div>

    <div class="nav-section">
      <div class="section-title">我的音乐</div>
      <router-link to="/liked" class="nav-item" active-class="active">
        <Icon icon="lucide:heart" class="nav-icon" />
        <span class="nav-text">我喜欢的</span>
      </router-link>
      <router-link to="/recent" class="nav-item" active-class="active">
        <Icon icon="lucide:clock" class="nav-icon" />
        <span class="nav-text">最近播放</span>
      </router-link>
      <div class="nav-item">
        <Icon icon="lucide:download" class="nav-icon" />
        <span class="nav-text">下载管理</span>
      </div>
    </div>

    <!-- 我的歌单 -->
    <div class="divider"></div>

    <div class="nav-section">
      <div class="section-header" @click="togglePlaylists">
        <span class="section-title">我的歌单</span>
        <Icon 
          icon="lucide:chevron-down" 
          class="collapse-icon"
          :class="{ 'collapsed': !isPlaylistsOpen }"
        />
      </div>
      
      <div class="playlists-list" v-show="isPlaylistsOpen">
        <div class="nav-item playlist-item">
          <div class="playlist-cover">
            <Icon icon="lucide:music" />
          </div>
          <span class="nav-text">驾驶模式</span>
        </div>
        <div class="nav-item playlist-item">
          <div class="playlist-cover">
            <Icon icon="lucide:music" />
          </div>
          <span class="nav-text">放松时光</span>
        </div>
        <div class="nav-item playlist-item">
          <div class="playlist-cover">
            <Icon icon="lucide:music" />
          </div>
          <span class="nav-text">工作专注</span>
        </div>
        <div class="nav-item create-playlist">
          <Icon icon="lucide:plus" class="nav-icon" />
          <span class="nav-text">新建歌单</span>
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { Icon } from '@iconify/vue';

const isPlaylistsOpen = ref(true);

const togglePlaylists = () => {
  isPlaylistsOpen.value = !isPlaylistsOpen.value;
};
</script>

<style scoped>
.sidebar {
  width: var(--sidebar-width);
  height: 100vh;
  background-color: var(--color-bg-secondary);
  border-right: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  padding: 20px 12px;
  overflow-y: auto;
  flex-shrink: 0;
}

/* 滚动条样式 - 默认隐藏，悬停时显示 */
.sidebar::-webkit-scrollbar {
  width: 6px;
}

.sidebar::-webkit-scrollbar-track {
  background: transparent;
}

.sidebar::-webkit-scrollbar-thumb {
  background: transparent;
  border-radius: 3px;
  transition: background 0.2s ease;
}

.sidebar:hover::-webkit-scrollbar-thumb {
  background: var(--color-border-light);
}

.sidebar:hover::-webkit-scrollbar-thumb:hover {
  background: var(--color-text-muted);
}

/* 顶部Logo区域 */
.sidebar-header {
  padding: 8px 8px 24px;
  margin-bottom: 8px;
}

.logo-area {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px;
  border-radius: var(--radius-lg);
  transition: all var(--transition-base);
}

.logo-area:hover {
  background-color: var(--color-bg-tertiary);
}

.logo-icon {
  width: 40px;
  height: 40px;
  background: linear-gradient(135deg, #ec4141, #ff6b6b);
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 20px;
  font-weight: bold;
  box-shadow: var(--shadow-sm);
}

.app-name {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-text-primary);
  letter-spacing: -0.02em;
}

/* 导航区域 */
.nav-section {
  margin-bottom: 8px;
}

.nav-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  margin-bottom: 4px;
  border-radius: var(--radius-lg);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--transition-base);
  text-decoration: none;
  position: relative;
  overflow: hidden;
}

.nav-item:hover {
  background-color: var(--color-bg-tertiary);
  color: var(--color-text-primary);
}

.nav-item.active {
  background-color: var(--color-accent-soft);
  color: var(--color-accent);
  font-weight: 500;
}


.nav-icon {
  width: 20px;
  height: 20px;
  margin-right: 12px;
  flex-shrink: 0;
  transition: transform var(--transition-base);
}


.nav-text {
  font-size: var(--font-size-sm);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

/* 分割线 */
.divider {
  height: 1px;
  background: linear-gradient(to right, transparent, var(--color-border), transparent);
  margin: 16px 8px;
  opacity: 0.6;
}

/* 区域标题 */
.section-title {
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 8px 16px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  margin-bottom: 8px;
  cursor: pointer;
  color: var(--color-text-muted);
  transition: all var(--transition-base);
  border-radius: var(--radius-md);
}

.section-header:hover {
  color: var(--color-text-primary);
  background-color: var(--color-bg-tertiary);
}

.collapse-icon {
  transition: transform var(--transition-base);
  width: 16px;
  height: 16px;
}

.collapse-icon.collapsed {
  transform: rotate(-90deg);
}

/* 歌单项 */
.playlist-item {
  padding: 10px 16px;
}

.playlist-cover {
  width: 36px;
  height: 36px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 12px;
  color: white;
  font-size: 14px;
  box-shadow: var(--shadow-sm);
  flex-shrink: 0;
}

.playlist-item:hover .playlist-cover {
  transform: scale(1.05);
  box-shadow: var(--shadow-md);
}

/* 新建歌单 */
.create-playlist {
  color: var(--color-text-muted);
  margin-top: 8px;
  border: 1px dashed var(--color-border-light);
}

.create-playlist:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
  background-color: var(--color-accent-soft);
}
</style>
