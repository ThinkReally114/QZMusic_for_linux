import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { Song } from '../types/song'
import { calibrateTime, calibratedNow } from './timeCalibrator'

type RoomMode = 'dual' | 'multi'
type ServerAction =
  | 'ROOM_CREATED'
  | 'SYNC_PROPERTIES'
  | 'PING'
  | 'UPDATE'
  | 'SUCCESS'
  | 'ROOM_CLOSED'
  | 'ERROR'

interface ServerMessage {
  action: ServerAction
  data?: any
}

let socket: WebSocket | null = null

export const useListenTogetherStore = defineStore('listenTogether', () => {
  const connecting = ref(false)
  const connected = ref(false)
  const roomId = ref('')
  const mode = ref<RoomMode>('multi')
  const permissionLevel = ref(0)
  const userList = ref<string[]>([])
  const allPermissions = ref<Record<string, number>>({})
  const listVersion = ref(0)
  const lastError = ref('')
  const isApplyingRemote = ref(false)

  const canControl = computed(() => connected.value && permissionLevel.value >= 1)
  const isHost = computed(() => connected.value && permissionLevel.value >= 2)

  const resetRoomState = () => {
    connected.value = false
    connecting.value = false
    roomId.value = ''
    permissionLevel.value = 0
    userList.value = []
    allPermissions.value = {}
    listVersion.value = 0
  }

  const sendRaw = (action: string, data: Record<string, any> = {}) => {
    if (!socket || socket.readyState !== WebSocket.OPEN) return false
    socket.send(JSON.stringify({ action, data }))
    return true
  }

  const sendAction = (action: string, data: Record<string, any> = {}) => {
    if (!connected.value && action !== 'PONG') return false
    return sendRaw(action, data)
  }

  const getPlayer = async () => {
    const mod = await import('./player')
    return mod.usePlayerStore()
  }

  const playbackPayload = async () => {
    const player = await getPlayer()
    return {
      currentMs: Math.max(0, Math.floor(player.currentTime || 0)),
      currentIndex: Math.max(0, player.currentIndex),
      timestamp: calibratedNow(),
    }
  }

  const applyRemoteState = async (data: any) => {
    const player = await getPlayer()
    isApplyingRemote.value = true
    try {
      await player.applyTogetherState(data)
    } finally {
      window.setTimeout(() => {
        isApplyingRemote.value = false
      }, 120)
    }
  }

  const sendCurrentSnapshot = async () => {
    if (!canControl.value) return
    const player = await getPlayer()
    if (player.playlist.length > 0) {
      sendAction('SET', {
        baseListVersion: listVersion.value,
        list: player.playlist,
      })
    }
    const payload = await playbackPayload()
    sendAction('SEEK', payload)
    sendAction(player.isPlaying ? 'PLAY' : 'PAUSE', payload)
  }

  const handleMessage = async (message: ServerMessage) => {
    const data = message.data || {}

    switch (message.action) {
      case 'ROOM_CREATED':
        roomId.value = data.room_id || ''
        connected.value = true
        connecting.value = false
        permissionLevel.value = 2
        lastError.value = ''
        ElMessage.success('一起听房间已创建')
        await sendCurrentSnapshot()
        break

      case 'SYNC_PROPERTIES':
        permissionLevel.value = Number(data.permission_level ?? permissionLevel.value)
        mode.value = data.mode === 'dual' ? 'dual' : 'multi'
        userList.value = Array.isArray(data.user_list) ? data.user_list : []
        allPermissions.value = data.all_permissions || {}
        break

      case 'PING':
        sendRaw('PONG')
        if (isHost.value) {
          sendAction('SYNC', await playbackPayload())
        } else {
          await applyRemoteState(data)
        }
        break

      case 'UPDATE':
        if (typeof data.listVersion === 'number') listVersion.value = data.listVersion
        await applyRemoteState(data)
        break

      case 'SUCCESS':
        if (typeof data.listVersion === 'number') listVersion.value = data.listVersion
        break

      case 'ROOM_CLOSED':
        ElMessage.info('一起听房间已关闭')
        disconnect(false)
        break

      case 'ERROR':
        lastError.value = data.msg || '一起听同步失败'
        ElMessage.warning(lastError.value)
        if (data.code === '409') sendAction('GET')
        break
    }
  }

  const connect = async (params: Record<string, string>) => {
    disconnect(false)
    connecting.value = true
    lastError.value = ''

    calibrateTime().catch(() => {})

    try {
      const url = await window.electronAPI.listenTogether.getWsUrl(params)
      socket = new WebSocket(url)

      socket.onopen = () => {
        connected.value = true
        connecting.value = false
      }

      socket.onmessage = (event) => {
        try {
          handleMessage(JSON.parse(event.data)).catch(console.error)
        } catch (error) {
          console.warn('[ListenTogether] Invalid message:', error)
        }
      }

      socket.onerror = () => {
        lastError.value = '一起听连接失败'
        connecting.value = false
      }

      socket.onclose = () => {
        socket = null
        resetRoomState()
      }
    } catch (error: any) {
      connecting.value = false
      lastError.value = error?.message || '一起听连接失败'
      ElMessage.error(lastError.value)
    }
  }

  const createRoom = async (nextMode: RoomMode) => {
    mode.value = nextMode
    await connect({ mode: nextMode })
  }

  const joinRoom = async (targetRoomId: string) => {
    const normalized = targetRoomId.trim()
    if (!normalized) return
    await connect({ room_id: normalized })
  }

  const disconnect = (notifyServer = true) => {
    if (notifyServer && socket?.readyState === WebSocket.OPEN && isHost.value) {
      sendRaw('CLOSE_ROOM')
    }
    if (socket) {
      socket.close(1000)
      socket = null
    }
    resetRoomState()
  }

  const sendPlayback = async (playing: boolean) => {
    if (!canControl.value || isApplyingRemote.value) return
    sendAction(playing ? 'PLAY' : 'PAUSE', await playbackPayload())
  }

  const sendSeek = async (currentMs: number, currentIndex: number) => {
    if (!canControl.value || isApplyingRemote.value) return
    sendAction('SEEK', {
      currentMs: Math.max(0, Math.floor(currentMs || 0)),
      currentIndex: Math.max(0, currentIndex),
      timestamp: calibratedNow(),
    })
  }

  const sendSetList = (list: Song[]) => {
    if (!canControl.value || isApplyingRemote.value) return
    sendAction('SET', {
      baseListVersion: listVersion.value,
      list,
    })
  }

  const sendAddSong = (song: Song) => {
    if (!canControl.value || isApplyingRemote.value) return
    sendAction('ADD', {
      baseListVersion: listVersion.value,
      song,
    })
  }

  const sendInsertSong = (song: Song, index: number) => {
    if (!canControl.value || isApplyingRemote.value) return
    sendAction('INSERT', {
      baseListVersion: listVersion.value,
      index,
      song,
    })
  }

  const sendRemoveSong = (song: Song, index: number, currentIndex: number) => {
    if (!canControl.value || isApplyingRemote.value) return
    sendAction('REMOVE', {
      baseListVersion: listVersion.value,
      song,
      index,
      currentIndex,
    })
  }

  const changePermission = (targetUserId: string, level: 0 | 1) => {
    if (!isHost.value) return
    sendAction('CHANGE_PERMISSION', {
      target_user_id: targetUserId,
      level,
    })
  }

  return {
    connecting,
    connected,
    roomId,
    mode,
    permissionLevel,
    userList,
    allPermissions,
    listVersion,
    lastError,
    isApplyingRemote,
    canControl,
    isHost,
    createRoom,
    joinRoom,
    disconnect,
    sendCurrentSnapshot,
    sendPlayback,
    sendSeek,
    sendSetList,
    sendAddSong,
    sendInsertSong,
    sendRemoveSong,
    changePermission,
  }
})
