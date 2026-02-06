<template>
  <div class="view-container home-view">
    <div class="content-wrapper">
      <!-- 每日推荐横幅 -->
      <div class="daily-recommend">
        <div class="banner-content">
          <div class="date-badge">
            <div class="day">{{ currentDate.day }}</div>
            <div class="month">{{ currentDate.month }}月</div>
          </div>
          <div class="banner-info">
            <h2 class="banner-title">每日推荐</h2>
            <p class="banner-desc">根据你的音乐口味，为你精选30首歌曲</p>
            <button class="play-btn">
              <Icon icon="lucide:play" class="play-icon" />
              立即播放
            </button>
          </div>
        </div>
      </div>

      <!-- 推荐歌单 -->
      <div class="section">
        <div class="section-header">
          <h3 class="section-title">推荐歌单</h3>
          <button class="more-btn">更多</button>
        </div>
        <div class="playlist-grid">
          <div class="playlist-card" v-for="i in 6" :key="i">
            <div class="playlist-cover">
              <div class="cover-gradient"></div>
              <div class="play-overlay">
                <Icon icon="lucide:play" class="overlay-icon" />
              </div>
            </div>
            <div class="playlist-info">
              <h4 class="playlist-name">精选歌单 {{ i }}</h4>
              <p class="playlist-desc">30首歌曲</p>
            </div>
          </div>
        </div>
      </div>

      <!-- 热门歌手 -->
      <div class="section">
        <div class="section-header">
          <h3 class="section-title">热门歌手</h3>
          <button class="more-btn">更多</button>
        </div>
        <div class="artist-grid">
          <div class="artist-card" v-for="i in 8" :key="i">
            <div class="artist-avatar">
              <div class="avatar-gradient"></div>
            </div>
            <p class="artist-name">歌手 {{ i }}</p>
          </div>
        </div>
      </div>

      <!-- 新歌速递 -->
      <div class="section">
        <div class="section-header">
          <h3 class="section-title">新歌速递</h3>
          <button class="more-btn">播放全部</button>
        </div>
        <div class="song-list">
          <div class="song-item" v-for="i in 10" :key="i">
            <div class="song-index">{{ i }}</div>
            <div class="song-cover">
              <div class="cover-gradient"></div>
            </div>
            <div class="song-info">
              <h4 class="song-title">歌曲名称 {{ i }}</h4>
              <p class="song-artist">歌手名称</p>
            </div>
            <div class="song-duration">03:45</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Icon } from '@iconify/vue';

const currentDate = computed(() => {
  const now = new Date();
  return {
    day: now.getDate(),
    month: now.getMonth() + 1
  };
});
</script>

<style scoped>
.home-view {
  width: 100%;
  height: 100%;
}

.content-wrapper {
  padding: 24px;
  max-width: 1400px;
  margin: 0 auto;
}

/* 每日推荐横幅 */
.daily-recommend {
  margin-bottom: 40px;
}

.banner-content {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: var(--radius-2xl);
  -electron-corner-smoothing: 65%;
  padding: 40px;
  display: flex;
  align-items: center;
  gap: 32px;
  box-shadow: var(--shadow-lg);
  position: relative;
  overflow: hidden;
}

.banner-content::before {
  content: '';
  position: absolute;
  top: -50%;
  right: -20%;
  width: 400px;
  height: 400px;
  background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
  border-radius: 50%;
}

.date-badge {
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(10px);
  border-radius: var(--radius-xl);
  padding: 16px 20px;
  text-align: center;
  min-width: 100px;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.day {
  font-size: 48px;
  font-weight: 700;
  color: white;
  line-height: 1;
}

.month {
  font-size: var(--font-size-lg);
  color: rgba(255, 255, 255, 0.8);
  margin-top: 4px;
}

.banner-info {
  flex: 1;
}

.banner-title {
  font-size: var(--font-size-2xl);
  font-weight: 700;
  color: white;
  margin-bottom: 12px;
}

.banner-desc {
  color: rgba(255, 255, 255, 0.8);
  font-size: var(--font-size-base);
  margin-bottom: 24px;
}

.play-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: white;
  color: #667eea;
  padding: 12px 32px;
  border-radius: var(--radius-full);
  border: none;
  font-size: var(--font-size-base);
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-base);
  box-shadow: var(--shadow-md);
}

.play-btn:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}

.play-icon {
  width: 18px;
  height: 18px;
}

/* 区域样式 */
.section {
  margin-bottom: 48px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.section-title {
  font-size: var(--font-size-xl);
  font-weight: 600;
  color: var(--color-text-primary);
}

.more-btn {
  background: transparent;
  border: 1px solid var(--color-border-light);
  color: var(--color-text-secondary);
  padding: 8px 20px;
  border-radius: var(--radius-full);
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: all var(--transition-base);
}

.more-btn:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
  background-color: var(--color-accent-soft);
}

/* 歌单网格 */
.playlist-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 20px;
}

.playlist-card {
  cursor: pointer;
  transition: transform var(--transition-base);
}

.playlist-card:hover {
  transform: translateY(-4px);
}

.playlist-cover {
  position: relative;
  aspect-ratio: 1;
  border-radius: var(--radius-lg);
  overflow: hidden;
  margin-bottom: 12px;
  background: var(--color-bg-tertiary);
}

.cover-gradient {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

.play-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity var(--transition-base);
}

.playlist-card:hover .play-overlay {
  opacity: 1;
}

.overlay-icon {
  width: 48px;
  height: 48px;
  color: white;
  transform: scale(0.8);
  transition: transform var(--transition-base);
}

.playlist-card:hover .overlay-icon {
  transform: scale(1);
}

.playlist-info {
  padding: 4px 0;
}

.playlist-name {
  font-size: var(--font-size-base);
  font-weight: 500;
  color: var(--color-text-primary);
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.playlist-desc {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

/* 歌手网格 */
.artist-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 24px;
}

.artist-card {
  text-align: center;
  cursor: pointer;
  transition: transform var(--transition-base);
}

.artist-card:hover {
  transform: translateY(-4px);
}

.artist-avatar {
  width: 120px;
  height: 120px;
  border-radius: var(--radius-full);
  overflow: hidden;
  margin: 0 auto 12px;
  background: var(--color-bg-tertiary);
}

.avatar-gradient {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
}

.artist-name {
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 歌曲列表 */
.song-list {
  background-color: var(--color-bg-secondary);
  border-radius: var(--radius-xl);
  padding: 8px;
}

.song-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-radius: var(--radius-lg);
  transition: all var(--transition-base);
  cursor: pointer;
  gap: 16px;
}

.song-item:hover {
  background-color: var(--color-bg-tertiary);
}

.song-index {
  width: 24px;
  text-align: center;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  flex-shrink: 0;
}

.song-cover {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-md);
  overflow: hidden;
  flex-shrink: 0;
  background: var(--color-bg-tertiary);
}

.song-info {
  flex: 1;
  min-width: 0;
}

.song-title {
  font-size: var(--font-size-base);
  font-weight: 500;
  color: var(--color-text-primary);
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.song-artist {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.song-duration {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  flex-shrink: 0;
}
</style>
