import { app, BrowserWindow, Menu, ipcMain } from 'electron'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import { MpvController } from './mpvController'
import { startProxyServer, cleanupCache, getCacheDir, getCacheSize, setPersistCache, clearCacheNow } from './proxyServer'
import { PluginSystem } from '../src/main/pluginSystem.ts'
import { loadSettings, saveSettings, getSetting, AppSettings } from './settingsStore'
// @ts-ignore
const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null
let mpv: MpvController | null

// === Electron 窗口逻辑 ===

function createWindow() {
    win = new BrowserWindow({
        frame: false,
        minWidth: 950,
        minHeight: 800,
        width: 1000,
        height: 800,
        icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.mjs'),
            // nodeIntegration: false,
            // contextIsolation: true,
        },
    })

    win.webContents.on('did-finish-load', () => {
        win?.webContents.send('main-process-message', new Date().toLocaleString())
    })

    if (VITE_DEV_SERVER_URL) {
        win.loadURL(VITE_DEV_SERVER_URL)
    } else {
        win.loadFile(path.join(RENDERER_DIST, 'index.html'))
    }
    win.webContents.openDevTools();
    registerZoomShortcuts(win)
}

// === IPC 监听 ===

ipcMain.on('window-minimize', (event) => BrowserWindow.fromWebContents(event.sender)?.minimize())
ipcMain.on('window-maximize', () => win?.isMaximized() ? win.unmaximize() : win?.maximize())
ipcMain.on('window-close', () => win?.close())
ipcMain.handle('window-is-maximized', () => win?.isMaximized() || false)

// --- MPV IPC Handlers ---
ipcMain.handle('mpv-command', async (_, command: any[]) => {
    if (mpv) {
        mpv.send(command)
    }
})

// Quick Helpers
ipcMain.handle('mpv-load', (_, url) => mpv?.load(url))
ipcMain.handle('mpv-play', () => mpv?.play())
ipcMain.handle('mpv-pause', () => mpv?.pause())
ipcMain.handle('mpv-toggle-pause', () => mpv?.togglePause())
ipcMain.handle('mpv-stop', () => mpv?.stop())
ipcMain.handle('mpv-set-volume', (_, vol) => mpv?.setVolume(vol))
ipcMain.handle('mpv-seek', (_, time) => mpv?.seek(time))

// PluginSystem
ipcMain.handle(
    'plugin:call',
    async (_evenv, pluginId: string, method: string, args: any[]) => {
        const plugin = new PluginSystem(pluginId)

        if (typeof (plugin as any)[method] !== 'function') {
            return {
                success: false,
                error: `Method ${method} not found`
            }
        }

        return await (plugin as any)[method](...args)
    }
)

// Cache IPC Handlers
ipcMain.handle('cache:getInfo', () => {
    const settings = loadSettings();
    return {
        path: getCacheDir(),
        size: getCacheSize(),
        persistCache: settings.persistCache
    }
})

ipcMain.handle('cache:setPersist', (_, persist: boolean) => {
    setPersistCache(persist)
    saveSettings({ persistCache: persist })
})

ipcMain.handle('cache:openFolder', () => {
    const dir = getCacheDir()
    require('electron').shell.openPath(dir)
})

ipcMain.handle('cache:clear', () => {
    clearCacheNow()
})

// Settings IPC Handlers
ipcMain.handle('settings:getAll', () => {
    return loadSettings()
})

ipcMain.handle('settings:set', (_, settings: Partial<AppSettings>) => {
    return saveSettings(settings)
})

ipcMain.handle('settings:getTheme', () => {
    return getSetting('theme')
})

ipcMain.handle('settings:setTheme', (_, theme: 'dark' | 'light') => {
    saveSettings({ theme })
})

ipcMain.handle('settings:getAccentColor', () => {
    return getSetting('accentColor')
})

ipcMain.handle('settings:setAccentColor', (_, color: string) => {
    saveSettings({ accentColor: color })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
        win = null
    }
})

app.on('will-quit', () => {
    cleanupCache()
    if (mpv) {
        mpv.destroy()
    }
})

function registerZoomShortcuts(win: BrowserWindow) {
    win.webContents.on('before-input-event', (event, input) => {
        if (input.control || input.meta) {
            if (input.key.toLowerCase() === '=' || input.key === '+') {
                let currentZoom = win.webContents.getZoomFactor();
                win.webContents.setZoomFactor(currentZoom + 0.1);
                event.preventDefault();
            } else if (input.key === '-' || input.key === '_') {
                let currentZoom = win.webContents.getZoomFactor();
                // Limit minimum zoom to avoid making it too small to see
                if (currentZoom > 0.5) {
                    win.webContents.setZoomFactor(currentZoom - 0.1);
                }
                event.preventDefault();
            } else if (input.key === '0') {
                win.webContents.setZoomFactor(1);
                event.preventDefault();
            }
        }
    });
}

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
    }
})

// Test
app.whenReady().then(() => {
    // Ensure plugins directory exists
    const pluginsPath = path.join(app.getPath('userData'), 'plugins')
    if (!fs.existsSync(pluginsPath)) {
        fs.mkdirSync(pluginsPath, { recursive: true })
    }

    // --- Ensure Sample 'wy' Plugin Exists ---
    const wyPluginPath = path.join(pluginsPath, 'wy')
    const wyPluginIndex = path.join(wyPluginPath, 'index.js')
    if (!fs.existsSync(wyPluginIndex)) {
        if (!fs.existsSync(wyPluginPath)) fs.mkdirSync(wyPluginPath, { recursive: true })
        fs.writeFileSync(wyPluginIndex, `
module.exports = {
    async getUrl(id, quality) {
        const url = \`https://api.qz.shiqianjiang.cn/music/url?source=wy&songId=\${id}&quality=\${quality}&key=testkey\`;
        try {
            const response = await fetch(url);
            const data = await response.json();
            return data;
        } catch (e) {
            return { success: false, error: e.message };
        }
    }
}
        `.trim())
    }
    // ----------------------------------------

    Menu.setApplicationMenu(null)
    createWindow()

    // Start Proxy Server
    startProxyServer()

    // Start MPV
    mpv = new MpvController()
    mpv.start()

    mpv.on('event', (data) => {
        // Forward MPV events to Render Process
        if (win && !win.isDestroyed()) {
            win.webContents.send('mpv-event', data)
        }
    })
})
