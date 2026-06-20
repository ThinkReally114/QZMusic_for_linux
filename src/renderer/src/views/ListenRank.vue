<template>
  <div class="listen-rank-view">
    <section class="rank-hero">
      <div>
        <div class="eyebrow">
          <Icon icon="lucide:trophy" />
          <span>LISTEN RANK</span>
        </div>
        <h1>排行</h1>
        <p>{{ authStore.isLoggedIn ? '看看本周、本月和本年谁听得最久。' : '登录后查看云端听歌时长排行榜。' }}</p>
      </div>
      <button v-if="!authStore.isLoggedIn" class="primary-btn" @click="openLoginDialog">
        <Icon icon="lucide:log-in" />
        登录账号
      </button>
    </section>

    <template v-if="authStore.isLoggedIn">
      <div class="rank-tabs">
        <button
          v-for="option in rankOptions"
          :key="option.value"
          :class="{ active: rankPeriod === option.value }"
          @click="rankPeriod = option.value"
        >
          {{ option.label }}
        </button>
      </div>

      <section class="rank-panel">
        <div class="rank-panel-head">
          <div>
            <h2>{{ rankPeriodLabel }}听歌时长</h2>
            <p>只展示前 200 名，从新版记录开始计入。</p>
          </div>
          <button class="refresh-btn" :disabled="loadingRank" @click="loadRank">
            <Icon :icon="loadingRank ? 'lucide:loader-2' : 'lucide:refresh-cw'" :class="{ spin: loadingRank }" />
          </button>
        </div>

        <div v-if="loadingRank" class="rank-loading">
          <Icon icon="lucide:loader-2" class="spin" />
          <span>加载排行榜...</span>
        </div>
        <div v-else-if="rankError" class="rank-empty">{{ rankError }}</div>
        <div v-else-if="rankItems.length === 0" class="rank-empty">
          这个周期还没有排行榜数据，更新后产生新的听歌记录就会出现。
        </div>
        <div v-else class="rank-list">
          <button v-for="item in rankItems" :key="item.user.id" class="rank-row" @click="openUserProfile(item.user.id)">
            <div class="rank-number" :class="`top-${Math.min(item.rank, 3)}`">{{ item.rank }}</div>
            <img v-if="item.user.avatar" class="rank-avatar" :src="item.user.avatar" alt="" />
            <div v-else class="rank-avatar fallback">{{ rankInitial(item.user.nickname || item.user.username) }}</div>
            <div class="rank-user">
              <strong>{{ item.user.nickname || item.user.username }}</strong>
              <span>{{ item.user.username }}</span>
            </div>
            <strong class="rank-duration">{{ formatTime(item.duration) }}</strong>
          </button>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import { useAuthStore } from '../stores/auth'
import type { ListenRankPeriod, ListenRankResponse } from '../types/electron'

const authStore = useAuthStore()
const router = useRouter()
const openLoginDialog = inject<() => void>('openLoginDialog', () => authStore.login(false))
const rankPeriod = ref<ListenRankPeriod>('week')
const rankData = ref<ListenRankResponse | null>(null)
const loadingRank = ref(false)
const rankError = ref('')
const rankOptions: Array<{ label: string; value: ListenRankPeriod }> = [
  { label: '本周', value: 'week' },
  { label: '本月', value: 'month' },
  { label: '本年', value: 'year' },
]

const rankItems = computed(() => rankData.value?.data || [])
const rankPeriodLabel = computed(() => rankOptions.find((item) => item.value === rankPeriod.value)?.label || '本周')
const rankInitial = (name: string) => (name || 'Q').trim().slice(0, 1).toUpperCase()

const formatTime = (ms: number) => {
  const totalMinutes = Math.floor(ms / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
}

const openUserProfile = (userId: string) => {
  if (!userId) return
  router.push({ name: 'UserProfile', params: { id: userId } })
}

const loadRank = async () => {
  if (!authStore.isLoggedIn) return
  loadingRank.value = true
  rankError.value = ''
  try {
    const result = await window.electronAPI.stats.getListenRank(rankPeriod.value, 200)
    if (result.status === 'error') {
      rankError.value = result.msg || '排行榜暂时不可用'
      rankData.value = null
    } else {
      rankData.value = result
    }
  } catch (err: any) {
    rankError.value = err?.message || '排行榜暂时不可用'
    rankData.value = null
  } finally {
    loadingRank.value = false
  }
}

watch([rankPeriod, () => authStore.isLoggedIn], loadRank, { immediate: true })
</script>

<style scoped>
.listen-rank-view {
  min-height: 100%;
  padding: 28px 32px 148px;
  box-sizing: border-box;
  color: var(--color-text-primary);
}

.rank-hero,
.rank-panel {
  border-radius: 28px;
  background: color-mix(in srgb, var(--color-bg-secondary) 78%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-accent) 7%, transparent);
}

.rank-hero {
  min-height: 170px;
  padding: 30px;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 18px;
  background:
    radial-gradient(circle at 12% 0%, color-mix(in srgb, var(--color-accent) 20%, transparent), transparent 38%),
    linear-gradient(135deg, color-mix(in srgb, var(--color-accent) 12%, transparent), transparent 58%),
    color-mix(in srgb, var(--color-bg-secondary) 76%, transparent);
}

.eyebrow,
.rank-tabs,
.rank-panel-head,
.rank-row {
  display: flex;
  align-items: center;
}

.eyebrow {
  gap: 8px;
  color: var(--color-text-muted);
  font-size: 12px;
  font-weight: 760;
}

h1 {
  margin-top: 14px;
  font-size: 40px;
  line-height: 1.1;
}

p {
  margin-top: 10px;
  color: var(--color-text-secondary);
}

.primary-btn,
.refresh-btn {
  min-height: 40px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.primary-btn {
  padding: 0 16px;
  background: var(--color-accent-gradient);
  color: white;
}

.rank-tabs {
  width: fit-content;
  gap: 4px;
  margin: 18px 0;
  padding: 4px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-bg-secondary) 86%, transparent);
}

.rank-tabs button {
  height: 34px;
  min-width: 72px;
  border-radius: 999px;
  color: var(--color-text-secondary);
}

.rank-tabs button.active {
  background: var(--color-bg-primary);
  color: var(--color-accent);
}

.rank-panel {
  padding: 24px;
}

.rank-panel-head {
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.rank-panel-head h2 {
  font-size: 20px;
}

.rank-panel-head p {
  margin-top: 5px;
  font-size: 13px;
}

.refresh-btn {
  width: 40px;
  padding: 0;
  background: color-mix(in srgb, var(--color-accent) 8%, transparent);
  color: var(--color-text-primary);
}

.rank-list {
  display: grid;
  gap: 8px;
}

.rank-row {
  min-height: 58px;
  width: 100%;
  gap: 12px;
  padding: 8px 10px;
  border-radius: 18px;
  background: color-mix(in srgb, var(--color-bg-primary) 56%, transparent);
  border: 0;
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition: background-color 160ms ease;
}

.rank-row:hover {
  background: color-mix(in srgb, var(--color-accent) 8%, transparent);
}

.rank-number {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: var(--color-text-muted);
  font-weight: 800;
  background: color-mix(in srgb, var(--color-accent) 8%, transparent);
}

.rank-number.top-1 {
  color: #fff;
  background: linear-gradient(135deg, #f7c86a, #f08b5f);
}

.rank-number.top-2 {
  color: #fff;
  background: linear-gradient(135deg, #9fb1c8, #7486a6);
}

.rank-number.top-3 {
  color: #fff;
  background: linear-gradient(135deg, #d69a7a, #a96e57);
}

.rank-avatar {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  object-fit: cover;
  flex: 0 0 auto;
}

.rank-avatar.fallback {
  display: grid;
  place-items: center;
  background: var(--color-accent-gradient);
  color: #fff;
  font-weight: 800;
}

.rank-user {
  min-width: 0;
  flex: 1;
  display: grid;
  gap: 3px;
}

.rank-user strong,
.rank-user span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rank-user span,
.rank-empty,
.rank-loading {
  color: var(--color-text-muted);
  font-size: 13px;
}

.rank-duration {
  color: var(--color-accent);
  white-space: nowrap;
}

.rank-empty,
.rank-loading {
  min-height: 220px;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 10px;
  text-align: center;
}

button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.spin {
  animation: spin 900ms linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 920px) {
  .rank-hero {
    display: block;
  }

  .primary-btn {
    margin-top: 18px;
  }
}
</style>
