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
  id: '3337983421',
  name: '不死身ごっこ (feat. 初音ミク)',
  artist: 'ピノキオピー、初音ミク',
  picUrl: 'http://p2.music.126.net/7O6FcCraxldhFGz4CSPVlw==/109951172567380787.jpg?imageView=&thumbnail=371y371&type=webp&rotate=360&tostatic=0',
  url: 'http://m701.music.126.net/20260203120731/1480f3bdda9795d5e7cc25af304b6cae/jdymusic/obj/wo3DlMOGwrbDjj7DisKw/77635439540/89c6/162f/e373/62ded4a27758346e53f717f46ba2802c.flac',
  duration: '02:31',
  source: 'wy',
  type: 'Remote'
};

// Auto Play
playerStore.playSong(testSong).then(() => {
  playerStore.setPlaylist([testSong]);
});