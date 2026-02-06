<template>
  <div class="view-container playlist-view">
    <div class="content-wrapper">
      <!-- 动态头部设计 -->
      <div class="playlist-header">
        <div class="header-bg" :class="themeClass">
          <div class="flow-circle c1"></div>
          <div class="flow-circle c2"></div>
        </div>
        
        <div class="header-content">
          <div class="cover-box" :style="{ background: coverGradient }">
             <div class="icon-wrapper">
               <Icon :icon="iconName" class="big-icon" />
             </div>
          </div>
          
          <div class="info-box">
            <div class="sub-title">PLAYLIST</div>
            <h1 class="title">{{ title }}</h1>
            <div class="meta-info">
              <div class="avatar-row">
                 <div class="user-avatar">
                   <Icon icon="lucide:user" />
                 </div>
                 <span class="user-name">User</span>
              </div>
              <span class="divider">•</span>
              <span class="count">{{ songCount }} 首歌曲</span>
            </div>
            
            <div class="action-row">
              <button class="play-all-btn" :class="themeClass" @click="handlePlayAll">
                <Icon icon="lucide:play" class="btn-icon" />
                播放全部
              </button>
              <button class="action-btn">
                <Icon icon="lucide:download" />
              </button>
              <button class="action-btn">
                <Icon icon="lucide:share-2" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 歌曲列表 -->
      <div class="song-list-container">
        <div class="list-header">
           <div class="col-index">#</div>
           <div class="col-title">标题</div>
           <div class="col-album">专辑</div>
           <div class="col-time">时长</div>
        </div>
        
        <div class="song-list">
          <div class="song-item" v-for="(song, i) in songs" :key="song.id" @dblclick="handlePlaySong(i)">
            <div class="song-index">{{ i + 1 }}</div>
            <div class="song-cover">
              <div class="cover-gradient" :class="themeClass"></div>
            </div>
            <div class="song-info">
              <h4 class="song-title">{{ song.title }}</h4>
              <p class="song-artist">{{ song.artist }}</p>
            </div>
            <div class="song-album">{{ song.album }}</div>
            <div class="song-duration">{{ song.duration }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute } from 'vue-router';
import { Icon } from '@iconify/vue';
import { usePlayerStore } from '../stores/player';

const route = useRoute();
const playerStore = usePlayerStore();

// 判断页面类型
const isLiked = computed(() => route.path.includes('liked'));
const isRecent = computed(() => route.path.includes('recent'));

// 动态数据
const title = computed(() => {
  if (isLiked.value) return '我喜欢的音乐';
  if (isRecent.value) return '最近播放';
  return '歌单';
});

const iconName = computed(() => {
  if (isLiked.value) return 'lucide:heart';
  if (isRecent.value) return 'lucide:clock';
  return 'lucide:music';
});

const themeClass = computed(() => {
  if (isLiked.value) return 'theme-liked';
  if (isRecent.value) return 'theme-recent';
  return 'theme-default';
});

const coverGradient = computed(() => {
  if (isLiked.value) return 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 99%, #fecfef 100%)';
  if (isRecent.value) return 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)';
  return 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
});

// Mock Playlist Data
const songs = ref(Array.from({ length: 15 }, (_, i) => ({
    id: i + 1,
    name: `Song Title ${i + 1}`,
    artist: `Artist Name ${i + 1}`,
    albumName: `Album Mock`,
    duration: '03:30',
    url: 'http://commondatastorage.googleapis.com/codeskulptor-demos/riceracer_assets/music/win.ogg',
    picUrl: '',
    source: 'local',
    type: 'Local' 
})));

const songCount = computed(() => songs.value.length);

const handlePlayAll = () => {
    playerStore.setPlaylist(songs.value);
};

const handlePlaySong = (index: number) => {
    playerStore.playFromList(songs.value[index], songs.value);
};
</script>

<style scoped>
.playlist-view {
  width: 100%;
  height: 100%;
  overflow-y: auto;
}

.content-wrapper {
  box-sizing: border-box;
  padding: 30px;
  max-width: 1400px;
  margin: 0 auto;
}

/* Header Styles */
.playlist-header {
  position: relative;
  height: 240px;
  border-radius: var(--radius-2xl);
  overflow: hidden;
  margin-bottom: 30px;
  display: flex;
  align-items: center;
  padding: 0 40px;
  box-sizing: border-box;
  box-shadow: var(--shadow-lg);
}

.header-bg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-size: 400% 400%;
  animation: gradientBG 15s ease infinite;
  z-index: 1;
}

/* Default Dark Dynamic */
.header-bg {
  background-image: linear-gradient(-45deg, #1e1e1e, #2a2a2a, #3a1c1c, #1a1a1a);
}

.header-bg.theme-liked {
  background-image: linear-gradient(-45deg, #2a1a1a, #4a2c2c, #3a1c1c, #1a1a1a);
}

.header-bg.theme-recent {
  background-image: linear-gradient(-45deg, #1a1a2a, #2c2c4a, #1c1c3a, #1a1a1a);
}

@keyframes gradientBG {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

.flow-circle {
  position: absolute;
  border-radius: 50%;
  filter: blur(60px);
  opacity: 0.4;
  animation: float 10s infinite ease-in-out;
}

.c1 {
  width: 300px;
  height: 300px;
  background: #ec4141; /* Default/Liked Color */
  top: -50px;
  left: -50px;
  animation-delay: 0s;
}

.c2 {
  width: 400px;
  height: 400px;
  background: #4facfe;
  bottom: -100px;
  right: -50px;
  animation-delay: -5s;
}

/* Recent Theme Colors */
.theme-recent .c1 { background: #a18cd1; }
.theme-recent .c2 { background: #fbc2eb; }

@keyframes float {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(20px) scale(1.1); }
}

.header-content {
  position: relative;
  z-index: 2;
  display: flex;
  gap: 32px;
  align-items: center;
  width: 100%;
}

.cover-box {
  width: 160px;
  height: 160px;
  border-radius: var(--radius-xl);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 24px rgba(0,0,0,0.3);
}

.icon-wrapper {
  background: rgba(255,255,255,0.2);
  width: 80px;
  height: 80px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(10px);
}

.big-icon {
  color: #fff;
  width: 40px;
  height: 40px;
  fill: currentColor;
}

.info-box {
  flex: 1;
  color: white;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.sub-title {
  font-size: 12px;
  letter-spacing: 2px;
  opacity: 0.8;
  margin-bottom: 8px;
}

.title {
  font-size: 42px;
  font-weight: 800;
  margin-bottom: 16px;
  letter-spacing: -1px;
}

.meta-info {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
  font-size: 14px;
  color: rgba(255,255,255,0.8);
}

.avatar-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.user-avatar {
  width: 24px;
  height: 24px;
  background: #555;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.divider {
  opacity: 0.4;
}

.action-row {
  display: flex;
  gap: 12px;
}

.play-all-btn {
  background: #ec4141; /* Default */
  color: white;
  border: none;
  padding: 10px 24px;
  border-radius: var(--radius-full);
  font-size: 16px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.play-all-btn.theme-recent {
  background: #a18cd1;
}

.play-all-btn:hover {
  transform: scale(1.05);
  filter: brightness(1.1);
}

.action-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 1px solid rgba(255,255,255,0.2);
  background: transparent;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.action-btn:hover {
  background: rgba(255,255,255,0.1);
  border-color: white;
}

/* List Styles */


.list-header {
  display: flex;
  padding: 0 16px;
  margin-bottom: 8px;
  color: var(--color-text-muted);
  font-size: 13px;
}

.col-index { width: 40px; text-align: center; }
.col-title { flex: 1; }
.col-album { width: 200px; }
.col-time { width: 60px; text-align: right; }



.song-item {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  padding: 10px 16px;
  border-radius: var(--radius-lg);
  transition: background-color 0.2s;
  cursor: pointer;
  color: var(--color-text-secondary);
}

.song-item:hover {
  background-color: var(--color-bg-tertiary);
  color: var(--color-text-primary);
}

.song-item:hover .song-index {
  color: var(--color-text-primary);
}

.song-index {
  width: 40px;
  text-align: center;
  font-size: 14px;
  color: var(--color-text-muted);
}

.song-cover {
  width: 40px;
  height: 40px;
  border-radius: 6px;
  margin-right: 16px;
  background: #333;
  overflow: hidden;
}

.cover-gradient {
  width: 100%;
  height: 100%;
  background: linear-gradient(45deg, #667eea, #764ba2);
}

/* Different gradients for list items too, maybe? */
.cover-gradient.theme-liked {
   background: linear-gradient(45deg, #ff9a9e, #fecfef);
}

.cover-gradient.theme-recent {
   background: linear-gradient(45deg, #a18cd1, #fbc2eb);
}

.song-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.song-title {
  font-size: 15px;
  color: var(--color-text-primary);
  margin-bottom: 2px;
}

.song-artist {
  font-size: 12px;
  color: var(--color-text-muted);
}

.song-album {
  width: 200px;
  font-size: 13px;
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.song-duration {
  width: 60px;
  text-align: right;
  font-size: 13px;
  color: var(--color-text-muted);
}
</style>
