import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
    // 窗口控制
    minimizeWindow: () => ipcRenderer.send('window-minimize'),
    maximizeWindow: () => ipcRenderer.send('window-maximize'),
    closeWindow: () => ipcRenderer.send('window-close'),
    isMaximized: () => ipcRenderer.invoke('window-is-maximized'),

    // qzplayer Control
    qzplayer: {
        load: (url: string) => ipcRenderer.invoke('qzplayer-load', url),
        play: () => ipcRenderer.invoke('qzplayer-play'),
        pause: () => ipcRenderer.invoke('qzplayer-pause'),
        togglePause: () => ipcRenderer.invoke('qzplayer-toggle-pause'),
        stop: () => ipcRenderer.invoke('qzplayer-stop'),
        setVolume: (vol: number) => ipcRenderer.invoke('qzplayer-set-volume', vol),
        seek: (time: number) => ipcRenderer.invoke('qzplayer-seek', time),
        onEvent: (callback: (event: any, data: any) => void) => ipcRenderer.on('qzplayer-event', callback)
    },

    // Plugin System
    plugin: {
        call: (pluginId: string, method: string, args: any[]) => ipcRenderer.invoke('plugin:call', pluginId, method, args),
        search: (pluginId: string, query: string, page: number, limit: number) => ipcRenderer.invoke('plugin:call', pluginId, 'search', [query, page, limit]),
        getLyric: (pluginId: string, id: string) => ipcRenderer.invoke('plugin:call', pluginId, 'getLyric', [id]),
        getAll: () => ipcRenderer.invoke('plugin:getAll'),
        uninstall: (id: string) => ipcRenderer.invoke('plugin:uninstall', id),
        install: () => ipcRenderer.invoke('plugin:install'),
        onChanged: (callback: (change: { action: string; pluginId?: string }) => void) => {
            const listener = (
                _event: Electron.IpcRendererEvent,
                change: { action: string; pluginId?: string },
            ) => callback(change)
            ipcRenderer.on('plugin:changed', listener)
            return () => ipcRenderer.removeListener('plugin:changed', listener)
        },
    },

    // Cache Control
    getCacheInfo: () => ipcRenderer.invoke('cache:getInfo'),
    setCachePersist: (persist: boolean) => ipcRenderer.invoke('cache:setPersist', persist),
    openCacheFolder: () => ipcRenderer.invoke('cache:openFolder'),
    clearCache: () => ipcRenderer.invoke('cache:clear'),
    changeCacheLocation: (newPath: string) => ipcRenderer.invoke('cache:changeLocation', newPath),
    selectDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),

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
