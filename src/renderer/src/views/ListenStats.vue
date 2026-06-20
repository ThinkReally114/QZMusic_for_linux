<template>
  <div class="listen-stats-view">
    <section class="stats-hero">
      <div>
        <div class="eyebrow">
          <Icon icon="lucide:activity" />
          <span>LISTEN FOOTPRINT</span>
        </div>
        <h1>听歌足迹</h1>
        <p>{{ authStore.isLoggedIn ? '看看这一段时间音乐陪你走过了多久。' : '登录后同步查看云端听歌时长。' }}</p>
      </div>
      <button v-if="!authStore.isLoggedIn" class="primary-btn" @click="openLoginDialog">
        <Icon icon="lucide:log-in" />
        登录账号
      </button>
    </section>

    <template v-if="authStore.isLoggedIn">
      <div class="tabs">
        <button :class="{ active: activeTab === 'week' }" @click="activeTab = 'week'">周</button>
        <button :class="{ active: activeTab === 'month' }" @click="activeTab = 'month'">月</button>
        <button :class="{ active: activeTab === 'year' }" @click="activeTab = 'year'">年</button>
      </div>

      <Transition name="stats-page" mode="out-in">
      <section v-if="activeTab === 'week'" :key="`week-${weekOffset}`" class="stats-panel">
        <div class="date-switcher">
          <button :disabled="!canGoPrevWeek" @click="weekOffset--"><Icon icon="lucide:chevron-left" /></button>
          <strong>{{ weekTitle }}</strong>
          <button :disabled="weekOffset >= 0" @click="weekOffset++"><Icon icon="lucide:chevron-right" /></button>
        </div>
        <div v-if="loadingRange" class="loading-state"><Icon icon="lucide:loader-2" class="spin" />加载中</div>
        <div v-else class="bar-chart">
          <div v-for="item in weeklyBars" :key="item.label" class="bar-item">
            <div class="bar-value">{{ formatShortTime(item.duration) }}</div>
            <div class="bar-track">
              <div class="bar-fill" :style="{ height: `${item.percent}%` }"></div>
            </div>
            <div class="bar-label">{{ item.label }}</div>
          </div>
        </div>
        <div class="summary-line">
          <span>本周合计</span>
          <strong>{{ formatTime(weeklyTotal) }}</strong>
        </div>
      </section>

      <section v-else-if="activeTab === 'month'" :key="`month-${monthOffset}`" class="stats-panel">
        <div class="date-switcher">
          <button :disabled="!canGoPrevMonth" @click="monthOffset--"><Icon icon="lucide:chevron-left" /></button>
          <strong>{{ monthTitle }}</strong>
          <button :disabled="monthOffset >= 0" @click="monthOffset++"><Icon icon="lucide:chevron-right" /></button>
        </div>
        <div v-if="loadingRange" class="loading-state"><Icon icon="lucide:loader-2" class="spin" />加载中</div>
        <template v-else>
          <div class="weekday-row">
            <span v-for="day in weekdays" :key="day">{{ day }}</span>
          </div>
          <div class="calendar-grid">
            <div v-for="blank in monthLeadingBlanks" :key="`blank-${blank}`" class="day-cell blank"></div>
            <button
              v-for="day in monthDays"
              :key="day.date"
              class="day-cell"
              :class="{ active: day.duration > 0, selected: selectedDate === day.date }"
              :style="{ '--intensity': day.intensity }"
              @click="selectedDate = selectedDate === day.date ? '' : day.date"
            >
              {{ day.day }}
            </button>
          </div>
          <div class="summary-line">
            <span>{{ selectedMonthText }}</span>
            <strong>{{ formatTime(selectedMonthDuration) }}</strong>
          </div>
        </template>
      </section>

      <section v-else key="year" class="year-layout">
        <div class="total-card">
          <span>累计畅听</span>
          <strong>{{ formatTime(totalStat?.total || 0) }}</strong>
          <small>{{ totalStat?.status === 'error' ? totalStat.msg || '暂无统计数据' : '来自 Android 与 PC 的同步统计' }}</small>
        </div>
        <div class="platform-grid">
          <div class="platform-card">
            <span>Android</span>
            <strong>{{ formatTime(totalStat?.android_time || 0) }}</strong>
          </div>
          <div class="platform-card">
            <span>PC</span>
            <strong>{{ formatTime(totalStat?.pc_time || 0) }}</strong>
          </div>
        </div>
        <section class="stats-panel compact">
          <div class="panel-heading">
            <h2>近五年</h2>
            <button class="ghost-btn" :disabled="loadingTotal" @click="loadTotal">
              <Icon :icon="loadingTotal ? 'lucide:loader-2' : 'lucide:refresh-cw'" :class="{ spin: loadingTotal }" />
            </button>
          </div>
          <div class="year-bars">
            <div v-for="item in yearlyBars" :key="item.label" class="year-row">
              <span>{{ item.label }}</span>
              <div class="year-track"><div :style="{ width: `${item.percent}%` }"></div></div>
              <strong>{{ formatShortTime(item.duration) }}</strong>
            </div>
          </div>
        </section>
      </section>
      </Transition>

    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, onMounted, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { useAuthStore } from '../stores/auth'
import type { ListenTimeRange, ListenTimeStat } from '../types/electron'

type TabMode = 'week' | 'month' | 'year'

const authStore = useAuthStore()
const openLoginDialog = inject<() => void>('openLoginDialog', () => authStore.login(false))
const activeTab = ref<TabMode>('week')
const weekOffset = ref(0)
const monthOffset = ref(0)
const rangeData = ref<ListenTimeRange | null>(null)
const totalStat = ref<ListenTimeStat | null>(null)
const loadingRange = ref(false)
const loadingTotal = ref(false)
const selectedDate = ref('')
const minDate = new Date(2026, 2, 1)
const weekdays = ['一', '二', '三', '四', '五', '六', '日']

const pad = (value: number) => String(value).padStart(2, '0')
const formatDate = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
const monthDate = computed(() => {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth() + monthOffset.value, 1)
})

const weekStart = computed(() => {
  const base = addDays(new Date(), weekOffset.value * 7)
  const day = base.getDay() || 7
  return addDays(base, 1 - day)
})
const weekEnd = computed(() => addDays(weekStart.value, 6))
const weekTitle = computed(() => `${weekStart.value.getMonth() + 1}.${pad(weekStart.value.getDate())} - ${weekEnd.value.getMonth() + 1}.${pad(weekEnd.value.getDate())}`)
const monthTitle = computed(() => `${monthDate.value.getFullYear()} 年 ${monthDate.value.getMonth() + 1} 月`)
const canGoPrevWeek = computed(() => addDays(weekStart.value, -7) >= minDate)
const canGoPrevMonth = computed(() => new Date(monthDate.value.getFullYear(), monthDate.value.getMonth() - 1, 1) >= minDate)

const formatTime = (ms: number) => {
  const totalMinutes = Math.floor(ms / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
}
const formatShortTime = (ms: number) => {
  const minutes = Math.round(ms / 60000)
  if (minutes <= 0) return '0m'
  if (minutes < 60) return `${minutes}m`
  return `${Math.round(minutes / 60)}h`
}

const rangeMap = computed(() => new Map((rangeData.value?.data || []).map((item) => [item.date, item.duration])))
const weeklyTotal = computed(() => weeklyBars.value.reduce((sum, item) => sum + item.duration, 0))
const weeklyBars = computed(() => {
  const values = weekdays.map((label, index) => ({
    label,
    duration: rangeMap.value.get(formatDate(addDays(weekStart.value, index))) || 0,
  }))
  const max = Math.max(1, ...values.map((item) => item.duration))
  return values.map((item) => ({ ...item, percent: Math.max(4, (item.duration / max) * 100) }))
})

const monthLeadingBlanks = computed(() => {
  const day = monthDate.value.getDay() || 7
  return Math.max(0, day - 1)
})
const monthDays = computed(() => {
  const year = monthDate.value.getFullYear()
  const month = monthDate.value.getMonth()
  const count = new Date(year, month + 1, 0).getDate()
  const durations = Array.from({ length: count }, (_, index) => {
    const date = formatDate(new Date(year, month, index + 1))
    return { date, day: index + 1, duration: rangeMap.value.get(date) || 0 }
  })
  const max = Math.max(1, ...durations.map((item) => item.duration))
  return durations.map((item) => ({
    ...item,
    intensity: item.duration > 0 ? String(Math.max(0.22, item.duration / max)) : '0',
  }))
})
const selectedMonthText = computed(() => selectedDate.value ? `${selectedDate.value} 听歌` : '本月合计')
const selectedMonthDuration = computed(() => {
  if (selectedDate.value) return rangeMap.value.get(selectedDate.value) || 0
  return monthDays.value.reduce((sum, day) => sum + day.duration, 0)
})

const yearlyBars = computed(() => {
  const items = totalStat.value?.chart_data?.yearly || []
  const max = Math.max(1, ...items.map((item) => item.duration))
  return items.map((item) => ({
    label: item.time || '-',
    duration: item.duration,
    percent: Math.max(4, (item.duration / max) * 100),
  }))
})
const loadRange = async () => {
  if (!authStore.isLoggedIn) return
  loadingRange.value = true
  try {
    if (activeTab.value === 'week') {
      rangeData.value = await window.electronAPI.stats.getListenRange(formatDate(weekStart.value), formatDate(weekEnd.value))
    } else {
      const start = monthDate.value
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 0)
      rangeData.value = await window.electronAPI.stats.getListenRange(formatDate(start), formatDate(end))
      selectedDate.value = ''
    }
  } finally {
    loadingRange.value = false
  }
}

const loadTotal = async () => {
  if (!authStore.isLoggedIn) return
  loadingTotal.value = true
  try {
    totalStat.value = await window.electronAPI.stats.getListenTime(1)
  } finally {
    loadingTotal.value = false
  }
}

watch([activeTab, weekOffset, monthOffset, () => authStore.isLoggedIn], () => {
  if (activeTab.value === 'year') loadTotal()
  else loadRange()
}, { immediate: true })

onMounted(loadTotal)
</script>

<style scoped>
.listen-stats-view {
  min-height: 100%;
  padding: 28px 32px 148px;
  box-sizing: border-box;
  color: var(--color-text-primary);
}

.stats-hero,
.stats-panel,
.total-card,
.platform-card {
  border-radius: 28px;
  background: color-mix(in srgb, var(--color-bg-secondary) 78%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-accent) 7%, transparent);
}

.stats-hero {
  min-height: 170px;
  padding: 30px;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 18px;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--color-accent) 14%, transparent), transparent 56%),
    color-mix(in srgb, var(--color-bg-secondary) 76%, transparent);
}

.eyebrow,
.tabs,
.date-switcher,
.summary-line,
.panel-heading,
.year-row {
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
.ghost-btn {
  min-height: 40px;
  padding: 0 16px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.primary-btn {
  background: var(--color-accent-gradient);
  color: white;
}

.tabs {
  width: fit-content;
  gap: 4px;
  margin: 18px 0;
  padding: 4px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-bg-secondary) 86%, transparent);
}

.tabs button {
  height: 34px;
  min-width: 72px;
  border-radius: 999px;
  color: var(--color-text-secondary);
}

.tabs button.active {
  background: var(--color-bg-primary);
  color: var(--color-accent);
}

.stats-panel {
  padding: 24px;
}

.date-switcher {
  justify-content: center;
  gap: 18px;
  margin-bottom: 22px;
}

.date-switcher button {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  padding: 0;
  color: var(--color-text-secondary);
  line-height: 0;
  transition: background-color 160ms ease, color 160ms ease, opacity 160ms ease;
}

.date-switcher button svg {
  width: 20px;
  height: 20px;
  display: block;
}

.date-switcher button:not(:disabled):hover {
  background: color-mix(in srgb, var(--color-accent) 10%, transparent);
  color: var(--color-text-primary);
}

.bar-chart {
  height: 260px;
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 12px;
}

.bar-item {
  min-width: 0;
  display: grid;
  grid-template-rows: 28px 1fr 24px;
  gap: 8px;
  text-align: center;
}

.bar-value,
.bar-label {
  color: var(--color-text-muted);
  font-size: 12px;
}

.bar-track {
  display: flex;
  align-items: flex-end;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-accent) 7%, transparent);
  overflow: hidden;
}

.bar-fill {
  width: 100%;
  min-height: 4px;
  border-radius: inherit;
  background: var(--color-accent-gradient);
  transition: height 260ms cubic-bezier(0.2, 0, 0, 1);
}

.summary-line {
  justify-content: space-between;
  margin-top: 22px;
  padding-top: 18px;
  border-top: 1px solid var(--color-border);
}

.summary-line span,
.platform-card span,
.total-card span,
.total-card small {
  color: var(--color-text-muted);
}

.summary-line strong {
  color: var(--color-accent);
}

.weekday-row,
.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 8px;
}

.weekday-row {
  margin-bottom: 10px;
  color: var(--color-text-muted);
  font-size: 12px;
  text-align: center;
}

.day-cell {
  aspect-ratio: 1;
  border-radius: 12px;
  background: color-mix(in srgb, var(--color-bg-primary) 76%, transparent);
  color: var(--color-text-secondary);
  transition: background-color 180ms ease, color 180ms ease, outline-color 180ms ease;
}

.day-cell.active {
  background: color-mix(in srgb, var(--color-accent) calc(var(--intensity) * 46%), var(--color-bg-primary));
  color: var(--color-text-primary);
}

.day-cell.selected {
  outline: 2px solid var(--color-accent);
}

.day-cell.blank {
  pointer-events: none;
  opacity: 0;
}

.year-layout {
  display: grid;
  grid-template-columns: minmax(280px, 0.8fr) minmax(320px, 1.2fr);
  gap: 18px;
}

.total-card,
.platform-card {
  padding: 24px;
}

.total-card {
  min-height: 230px;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--color-accent) 22%, transparent), transparent 62%),
    color-mix(in srgb, var(--color-bg-secondary) 78%, transparent);
}

.total-card strong {
  margin-top: 10px;
  font-size: 42px;
  line-height: 1;
}

.total-card small {
  margin-top: 12px;
}

.platform-grid {
  display: grid;
  gap: 12px;
}

.platform-card strong {
  display: block;
  margin-top: 10px;
  font-size: 24px;
}

.stats-panel.compact {
  grid-column: 1 / -1;
}

.panel-heading {
  justify-content: space-between;
  margin-bottom: 18px;
}

.panel-heading h2 {
  font-size: 18px;
}

.ghost-btn {
  width: 38px;
  padding: 0;
  background: color-mix(in srgb, var(--color-accent) 8%, transparent);
  color: var(--color-text-primary);
}

.year-bars {
  display: grid;
  gap: 12px;
}

.year-row {
  grid-template-columns: 58px minmax(0, 1fr) 74px;
  gap: 12px;
}

.year-row span,
.year-row strong {
  font-size: 13px;
  color: var(--color-text-muted);
}

.year-track {
  height: 10px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-accent) 7%, transparent);
  overflow: hidden;
}

.year-track div {
  height: 100%;
  border-radius: inherit;
  background: var(--color-accent-gradient);
  transition: width 260ms cubic-bezier(0.2, 0, 0, 1);
}

.loading-state {
  min-height: 260px;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 10px;
  color: var(--color-text-muted);
}

button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.spin {
  animation: spin 900ms linear infinite;
}

.stats-page-enter-active,
.stats-page-leave-active {
  transition:
    opacity 180ms ease,
    transform 180ms cubic-bezier(0.2, 0, 0, 1);
}

.stats-page-enter-from,
.stats-page-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 920px) {
  .stats-hero,
  .year-layout {
    display: block;
  }

  .primary-btn,
  .platform-grid,
  .stats-panel.compact {
    margin-top: 18px;
  }
}
</style>
