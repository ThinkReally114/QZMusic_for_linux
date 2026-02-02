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
    }
})