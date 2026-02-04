import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
    // 窗口控制
    minimizeWindow: () => ipcRenderer.send('window-minimize'),
    maximizeWindow: () => ipcRenderer.send('window-maximize'),
    closeWindow: () => ipcRenderer.send('window-close'),
    isMaximized: () => ipcRenderer.invoke('window-is-maximized'),

    // MPV Control
    mpv: {
        load: (url: string) => ipcRenderer.invoke('mpv-load', url),
        play: () => ipcRenderer.invoke('mpv-play'),
        pause: () => ipcRenderer.invoke('mpv-pause'),
        togglePause: () => ipcRenderer.invoke('mpv-toggle-pause'),
        stop: () => ipcRenderer.invoke('mpv-stop'),
        setVolume: (vol: number) => ipcRenderer.invoke('mpv-set-volume', vol),
        seek: (time: number) => ipcRenderer.invoke('mpv-seek', time),
        onEvent: (callback: (event: any, data: any) => void) => ipcRenderer.on('mpv-event', callback)
    },

    // Plugin System
    plugin: {
        call: (pluginId: string, method: string, args: any[]) => ipcRenderer.invoke('plugin:call', pluginId, method, args)
    },

    // Cache Control
    getCacheInfo: () => ipcRenderer.invoke('cache:getInfo'),
    setCachePersist: (persist: boolean) => ipcRenderer.invoke('cache:setPersist', persist),
    openCacheFolder: () => ipcRenderer.invoke('cache:openFolder'),
    clearCache: () => ipcRenderer.invoke('cache:clear'),

    // Settings
    settings: {
        getAll: () => ipcRenderer.invoke('settings:getAll'),
        set: (settings: any) => ipcRenderer.invoke('settings:set', settings),
        getTheme: () => ipcRenderer.invoke('settings:getTheme'),
        setTheme: (theme: 'dark' | 'light') => ipcRenderer.invoke('settings:setTheme', theme),
        getAccentColor: () => ipcRenderer.invoke('settings:getAccentColor'),
        setAccentColor: (color: string) => ipcRenderer.invoke('settings:setAccentColor', color)
    }
})