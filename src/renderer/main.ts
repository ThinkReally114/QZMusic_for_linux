// src/renderer/main.ts
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'

import App from './App.vue'
import TDesign from 'tdesign-vue-next'
import 'tdesign-vue-next/es/style/index.css'

const pinia = createPinia()
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'Home',
      component: () => import('./views/Home.vue')
    },
    {
      path: '/local',
      name: 'Local',
      component: () => import('./views/LocalMusic.vue')
    },
    {
      path: '/liked',
      name: 'Liked',
      component: () => import('./views/Playlist.vue')
    },
    {
      path: '/recent',
      name: 'Recent',
      component: () => import('./views/Playlist.vue')
    }
  ]
})

const app = createApp(App)
app.use(pinia)
app.use(router)
app.use(TDesign)
app.mount('#app')

// --- TEST: Auto Play Specific Song ---
import { usePlayerStore, PlayMode } from './stores/player'
import type { Song } from './types/song'

const playerStore = usePlayerStore()

// Set Single Mode
playerStore.playMode = PlayMode.Single;

const testSong: Song = {
  id: '2716424334',
  name: 'T氏の話を信じるな (feat. 初音ミク & 重音テト)',
  artist: 'ピノキオピー、初音ミク、重音テト',
  picUrl: 'http://p2.music.126.net/DmrEz0M4GwSeISIReCNNgw==/109951171319581237.jpg?param=130y130',
  url: '',
  duration: '02:43',
  source: 'wy',
  type: 'Remote'
};

// Auto Play
playerStore.playSong(testSong).then(() => {
  playerStore.setPlaylist([testSong]);
});