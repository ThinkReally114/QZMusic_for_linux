<template>
  <div class="view-container search-view">
    <div class="content-wrapper">
      <div class="search-header">
         <h1 class="search-title">搜索: "{{ query }}"</h1>
         <span class="result-count">找到 {{ total }} 个结果</span>
      </div>

      <div class="song-list-container" v-if="!loading && songs.length > 0">
        <div class="list-header">
           <div class="col-index">#</div>
           <div class="col-title">标题</div>
           <div class="col-album">专辑</div>
           <div class="col-time">时长</div>
        </div>
        
        <div class="song-list">
          <div 
            class="song-item" 
            v-for="(song, i) in songs" 
            :key="song.id" 
            @click="handlePlaySong(i)"
          >
            <div class="song-index">{{ (currentPage - 1) * limit + i + 1 }}</div>
            <div class="song-cover">
               <img v-if="song.picUrl" :src="song.picUrl" loading="lazy" />
               <div v-else class="cover-placeholder"></div>
            </div>
            <div class="song-info">
              <h4 class="song-title" v-html="highlight(song.name)"></h4>
              <p class="song-artist" v-html="highlight(song.artist)"></p>
            </div>
            <div class="song-album">{{ song.albumName || '-' }}</div>
            <div class="song-duration">{{ song.duration }}</div>
          </div>
        </div>

        <!-- Pagination -->
        <div class="pagination">
             <button class="pagination-btn" :disabled="currentPage <= 1" @click="changePage(currentPage - 1)">
                 <Icon icon="lucide:chevron-left" />
             </button>
             
             <button 
                v-for="page in visiblePages" 
                :key="page"
                class="pagination-btn"
                :class="{ active: page === currentPage }"
                @click="changePage(page)"
             >
                {{ page }}
             </button>

             <button class="pagination-btn" :disabled="currentPage >= totalPages" @click="changePage(currentPage + 1)">
                 <Icon icon="lucide:chevron-right" />
             </button>
        </div>
      </div>

      <div class="loading-state" v-if="loading">
          <Icon icon="lucide:loader-2" class="spin" />
          <span>正在搜索...</span>
      </div>

      <div class="empty-state" v-if="!loading && songs.length === 0">
          <span>未找到相关歌曲</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Icon } from '@iconify/vue';
import { usePlayerStore } from '../stores/player';
import { transformSearchSong } from '../utils/songUtils';
import type { Song } from '../types/song';

const route = useRoute();
const router = useRouter();
const playerStore = usePlayerStore();

const query = computed(() => route.query.q as string || '');
const currentPage = ref(1);
const limit = ref(30);
const total = ref(0);
const loading = ref(false);
const songs = ref<Song[]>([]);

const totalPages = computed(() => {
    const t = Number(total.value) || 0;
    const l = Number(limit.value) || 30;
    return Math.ceil(t / l) || 1;
});

const visiblePages = computed(() => {
  const current = currentPage.value;
  // Ensure totalPages is strictly valid
  const total = totalPages.value; 
  const delta = 2; // 2 on each side
  
  let start = Math.max(1, current - delta);
  let end = Math.min(total, current + delta);
  
  if (current - delta < 1) {
    end = Math.min(total, end + (1 - (current - delta)));
  }
  if (current + delta > total) {
    start = Math.max(1, start - ((current + delta) - total));
  }
  
  const pages = [];
  for (let i = start; i <= end; i++) {
    pages.push(i);
  }
  return pages;
});

const fetchData = async () => {
    if (!query.value) return;
    
    loading.value = true;
    songs.value = [];
    
    try {
        const result = await window.electronAPI.plugin.search('wy', query.value, currentPage.value, limit.value);
        
        if (result && result.list) {
            songs.value = result.list.map((item: any) => transformSearchSong(item));
            // Prioritize songCount if available, otherwise fallback to total, but NEVER use just list length as total
            total.value = result.songCount || result.total || 0;
        } else {
             total.value = 0;
        }
    } catch (e) {
        console.error("Search failed", e);
    } finally {
        loading.value = false;
    }
};

const changePage = (page: number) => {
    currentPage.value = page;
    fetchData();
};

const handlePlaySong = (index: number) => {
    playerStore.setPlaylist(songs.value, index);
};

const getHighlightRegex = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return null;
    
    // Escape regex characters
    const escapeRegExp = (string: string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // If strict or short query, fallback to exact match or simple space split
    // "超过2个字相似" -> If > 2 chars, try to match substrings
    if (trimmed.length <= 2) {
        return new RegExp(escapeRegExp(trimmed), 'gi');
    }

    // Generate all substrings of length >= 2
    const substrings = new Set<string>();
    substrings.add(trimmed); // Always include full query
    
    for (let i = 0; i < trimmed.length; i++) {
        for (let j = i + 2; j <= trimmed.length; j++) {
            substrings.add(trimmed.slice(i, j));
        }
    }
    
    // Sort by length match (longest first)
    const sorted = Array.from(substrings).sort((a, b) => b.length - a.length);
    const pattern = sorted.map(s => escapeRegExp(s)).join('|');
    return new RegExp(pattern, 'gi');
};

const highlight = (text: string) => {
    if (!query.value || !text) return text;
    
    const regex = getHighlightRegex(query.value);
    if (!regex) return text;

    return text.replace(regex, match => `<span class="highlight">${match}</span>`);
};

watch(query, () => {
    currentPage.value = 1;
    fetchData();
}, { immediate: true });
</script>


<style scoped>
.view-container {
  width: 100%;
  height: 100%;
  overflow-y: auto;
}

.content-wrapper {
  padding: 20px 30px; /* Reduced vertical padding, kept horizontal for spacing but flexible */
  width: 100%;
  /* Removed max-width to allow full width usage as requested */
  /* margin: 0 auto; */ 
}

.search-header {
    margin-bottom: 24px;
    text-align: left;
}

.search-title {
    font-size: 24px;
    font-weight: 700;
    color: var(--color-text-primary);
    margin-bottom: 8px;
    position: relative;
    padding-left: 16px; 
}

.search-title::before {
    content: "";
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 4px;
    height: 70%; 
    background-color: var(--color-accent);
    border-radius: 4px;
}

.result-count {
    font-size: 13px;
    color: var(--color-text-muted);
}

/* List Grid Layout */
.list-header, .song-item {
  display: grid;
  /* Define columns: Index | Title (40%) | Album (30%) | Time */
  grid-template-columns: 50px 4fr 3fr 60px;
  gap: 16px;
  align-items: center;
  padding: 10px 16px;
  text-align: left;
}

.list-header {
  margin-bottom: 8px;
  color: var(--color-text-muted);
  font-size: 13px;
  /* Header doesn't need hover background usually, but padding ensures alignment */
}

/* Override existing mixins/styles if necessary */
.col-index, .col-title, .col-album, .col-time { 
    width: auto; /* Let grid handle width */
} 
.col-index { text-align: center; }
.col-time { text-align: right; }

.song-item {
  border-radius: var(--radius-lg);
  transition: background-color 0.2s;
  cursor: pointer;
  color: var(--color-text-secondary);
  width: 100%; /* Fill width */
  box-sizing: border-box; /* Include padding in width */
}

.song-item:hover {
  background-color: var(--color-bg-tertiary);
  color: var(--color-text-primary);
}

.song-index {
  text-align: center;
  font-size: 14px;
  color: var(--color-text-muted);
}

.song-cover {
  /* Cover is not in the top grid definition, wait. 
     The previous request structure had a cover inside.
     The Grid should account for cover?
     Previous structure: Index | Cover | Info (Title+Artist) | Album | Time 
     Let's adjust Grid columns to: Index | Cover+Info | Album | Time?
     Or Index | Info (with Cover flow) | Album | Time.
     Let's stick to the structure:
     .song-item > .song-index
     .song-item > .song-cover (This was separate div in previous template)
     .song-item > .song-info
     .song-item > .song-album
     .song-item > .song-duration
     
     So we have 5 direct children in .song-item?
     Checking template:
     1. .song-index
     2. .song-cover
     3. .song-info
     4. .song-album
     5. .song-duration
     
     Yes, 5 columns.
     Updated Grid: Index(50px) Cover(40px) Info(4fr) Album(3fr) Time(60px)
  */
  display: flex; /* Reset for grid child if needed */
}

/* Refined Grid for 5 columns */
.list-header, .song-item {
    grid-template-columns: 50px 40px 4fr 3fr 60px;
}

/* Header has 4 children (Index, Title, Album, Time). 
   We need to make Title span 2 columns (Cover + Info area) or Insert a spacer?
   Title header usually aligns with Title text.
   Let's make Header Grid: 50px (Spacer 40px) Title ... 
   Actually, usually Cover doesn't have a header. 
   Let's align "Title" header to start of Info.
   
   List Header children:
   div.col-index
   div.col-title
   div.col-album
   div.col-time
   
   We need to adjust .col-title to span the Cover+Info space? Or just Info space?
   If we want "Title" label to align with Song Title text, we should skip the Cover column.
*/

.list-header {
    /* 50px | 40px spacer | 4fr | 3fr | 60px */
    grid-template-columns: 50px 40px 4fr 3fr 60px;
}
/* We need a phantom element or nth-child hacking for header? 
   Easiest is to add a spacer div in template or just use grid-column on col-title?
   If we say .col-title { grid-column: 3 / 4; } ?
*/
.list-header .col-title {
    grid-column: 3;
}
.list-header .col-album {
    grid-column: 4;
}
.list-header .col-time {
    grid-column: 5;
}


.song-cover {
  width: 40px;
  height: 40px;
  border-radius: 4px;
  overflow: hidden;
  background: #333;
}

.song-cover img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.song-info {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
  padding-left: 10px; /* Small gap between cover and text */
}

.song-title {
  font-size: 15px;
  color: var(--color-text-primary);
  margin-bottom: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.song-artist {
  font-size: 12px;
  color: var(--color-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.song-album {
    font-size: 13px;
    color: var(--color-text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.song-duration {
    text-align: right;
    font-size: 13px;
}

/* Highlight */
:deep(.highlight) {
    color: var(--color-accent);
}

/* Pagination */
.pagination {
    display: flex;
    justify-content: flex-start; /* Alignment Change: Left Align */
    align-items: center;
    margin-top: 32px;
    gap: 8px; /* Closer gap */
}

.pagination-btn {
    min-width: 32px;
    height: 32px;
    padding: 0 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    border: 1px solid var(--color-border);
    color: var(--color-text-primary);
    background: transparent;
    transition: all 0.2s;
    font-size: 14px;
    cursor: pointer;
}

.pagination-btn:hover:not(:disabled) {
    background: var(--color-bg-tertiary);
    border-color: var(--color-text-muted);
}

.pagination-btn.active {
    background: var(--color-accent);
    color: #fff; /* Ensure readable text on accent */
    border-color: var(--color-accent);
    font-weight: bold;
}

.pagination-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
    border-color: transparent;
}

/* States */
.loading-state, .empty-state {
    padding: 60px 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    color: var(--color-text-muted);
}

.spin {
    animation: spin 1s linear infinite;
    font-size: 32px;
}

@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
</style>
