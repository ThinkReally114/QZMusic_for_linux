<template>
  <Teleport to="body">
    <Transition name="login-fade">
      <div v-if="visible" class="login-backdrop" @click.self="close">
        <section class="login-panel" role="dialog" aria-modal="true" aria-label="登录">
          <header class="login-header">
            <div>
              <h2>登录 QZ Music</h2>
              <p>{{ statusText }}</p>
            </div>
            <button class="icon-btn" title="关闭" @click="close">
              <Icon icon="lucide:x" />
            </button>
          </header>

          <div class="qr-stage" :class="{ muted: status === 'loading' || status === 'expired' || status === 'error' }">
            <img v-if="session?.qr_data_url" :src="session.qr_data_url" alt="扫码登录二维码" />
            <Icon v-else icon="lucide:qr-code" class="qr-placeholder" />
            <div v-if="status === 'loading'" class="qr-overlay">
              <Icon icon="lucide:loader-2" class="spin" />
            </div>
          </div>

          <div class="login-actions">
            <button
              v-if="status === 'expired' || status === 'error' || status === 'cancelled'"
              class="primary-btn"
              @click="startQrLogin"
            >
              <Icon icon="lucide:refresh-cw" />
              刷新二维码
            </button>
            <button class="secondary-btn" @click="openBrowserLogin">
              <Icon icon="lucide:globe" />
              浏览器登录
            </button>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { ElMessage } from 'element-plus'
import type { QrLoginSession } from '../types/electron'

const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{ (event: 'update:visible', value: boolean): void }>()

type QrStatus = 'idle' | 'loading' | 'pending' | 'scanned' | 'success' | 'expired' | 'cancelled' | 'error'

const session = ref<QrLoginSession | null>(null)
const status = ref<QrStatus>('idle')
const errorMessage = ref('')
let pollTimer: number | undefined

const statusText = computed(() => {
  if (status.value === 'loading') return '正在生成二维码'
  if (status.value === 'scanned') return '已扫码，请在手机上确认'
  if (status.value === 'success') return '登录成功'
  if (status.value === 'expired') return '二维码已过期'
  if (status.value === 'cancelled') return '二维码已取消'
  if (status.value === 'error') return errorMessage.value || '二维码加载失败'
  return '使用安卓端扫码，或选择浏览器登录'
})

const clearPollTimer = () => {
  if (pollTimer) {
    window.clearInterval(pollTimer)
    pollTimer = undefined
  }
}

const cancelActiveSession = async () => {
  const current = session.value
  if (!current || status.value === 'success') return
  try {
    await window.electronAPI.auth.qrCancel(current.session_id, current.poll_token)
  } catch (err) {
    console.warn('[Auth] cancel QR login failed:', err)
  }
}

const pollQrLogin = async () => {
  const current = session.value
  if (!current) return
  try {
    const result = await window.electronAPI.auth.qrPoll(current.session_id, current.poll_token)
    if (result.status === 'success') {
      status.value = 'success'
      clearPollTimer()
      ElMessage.success('登录成功')
      window.setTimeout(() => emit('update:visible', false), 500)
      return
    }
    if (result.status === 'scanned') {
      status.value = 'scanned'
      return
    }
    if (result.status === 'expired' || result.status === 'cancelled') {
      status.value = result.status
      clearPollTimer()
      return
    }
    if (result.status === 'error') {
      status.value = 'error'
      errorMessage.value = result.message || '二维码登录失败'
      clearPollTimer()
    }
  } catch (err: any) {
    status.value = 'error'
    errorMessage.value = err?.message || '二维码登录失败'
    clearPollTimer()
  }
}

const startPolling = () => {
  clearPollTimer()
  pollTimer = window.setInterval(pollQrLogin, 1500)
}

const startQrLogin = async () => {
  clearPollTimer()
  session.value = null
  errorMessage.value = ''
  status.value = 'loading'
  try {
    session.value = await window.electronAPI.auth.qrCreate()
    status.value = 'pending'
    startPolling()
  } catch (err: any) {
    status.value = 'error'
    errorMessage.value = err?.message || '二维码加载失败'
  }
}

const openBrowserLogin = async () => {
  clearPollTimer()
  await cancelActiveSession()
  await window.electronAPI.auth.login(false)
  emit('update:visible', false)
}

const close = async () => {
  clearPollTimer()
  await cancelActiveSession()
  emit('update:visible', false)
}

watch(
  () => props.visible,
  (visible) => {
    if (visible) startQrLogin()
    else clearPollTimer()
  },
)

onBeforeUnmount(() => {
  clearPollTimer()
})
</script>

<style scoped>
.login-backdrop {
  position: fixed;
  inset: 0;
  z-index: 5000;
  display: grid;
  place-items: center;
  background: rgba(0, 0, 0, 0.52);
}

.login-panel {
  width: min(360px, calc(100vw - 32px));
  padding: 22px;
  border-radius: 20px;
  background: var(--color-bg-primary);
  box-shadow: var(--shadow-elevated);
}

.login-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.login-header h2 {
  margin: 0;
  font-size: 20px;
  color: var(--color-text-primary);
}

.login-header p {
  margin: 6px 0 0;
  font-size: 13px;
  color: var(--color-text-muted);
}

.icon-btn {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: var(--color-text-secondary);
}

.icon-btn:hover {
  color: var(--color-text-primary);
  background: color-mix(in srgb, var(--color-accent) 9%, transparent);
}

.qr-stage {
  position: relative;
  width: 256px;
  height: 256px;
  margin: 0 auto 18px;
  border-radius: 18px;
  display: grid;
  place-items: center;
  background: #fff;
  overflow: hidden;
}

.qr-stage.muted img {
  opacity: 0.35;
}

.qr-stage img {
  width: 256px;
  height: 256px;
}

.qr-placeholder {
  width: 74px;
  height: 74px;
  color: #1f2937;
}

.qr-overlay {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(255, 255, 255, 0.72);
  color: #1f2937;
}

.spin {
  animation: spin 1s linear infinite;
}

.login-actions {
  display: flex;
  justify-content: center;
  gap: 10px;
  flex-wrap: wrap;
}

.primary-btn,
.secondary-btn {
  min-height: 38px;
  padding: 0 14px;
  border-radius: var(--radius-full);
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.primary-btn {
  background: var(--color-accent-gradient);
  color: white;
}

.secondary-btn {
  background: color-mix(in srgb, var(--color-accent) 8%, transparent);
  color: var(--color-text-secondary);
}

.secondary-btn:hover {
  color: var(--color-text-primary);
}

.login-fade-enter-active,
.login-fade-leave-active {
  transition: opacity 160ms ease;
}

.login-fade-enter-from,
.login-fade-leave-to {
  opacity: 0;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
