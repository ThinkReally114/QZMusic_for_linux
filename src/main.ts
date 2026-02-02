// src/main.ts
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
  id: '9999',
  name: 'Test FLAC',
  artist: 'Netease',
  picUrl: 'http://p1.music.126.net/btYBbFLd5mf9w0lDpfNs6w==/109951171506809884.jpg?param=130y130',
  url: 'http://m801.music.126.net/20260202213928/189743bba596f8fd999bc44fd51d11fd/jdymusic/obj/wo3DlMOGwrbDjj7DisKw/61393856655/24be/6a68/77e4/fb898a5378682427bf7a4fb55640e610.flac',
  duration: '03:30',
  source: 'netease',
  type: 'Remote'
};

// Auto Play
playerStore.playSong(testSong).then(() => {
  playerStore.setPlaylist([testSong]);
});