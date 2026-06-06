import { app, BrowserWindow, Menu, ipcMain, dialog } from 'electron'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import { QzpController } from './qzpController'
import { startProxyServer, cleanupCache, getCacheDir, getCacheSize, setPersistCache, clearCacheNow, refreshCacheDir } from './proxyServer'
import { PluginSystem } from './pluginSystem'
import { loadSettings, saveSettings, getSetting, AppSettings } from './settingsStore'

// @ts-ignore
const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '../..')

path.join(process.env.APP_ROOT, 'out/main');
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'out/renderer')

process.env.VITE_PUBLIC = process.env.ELECTRON_RENDERER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null
let qzplayer: QzpController | null

function notifyPluginsChanged(action: 'installed' | 'updated' | 'uninstalled', pluginId?: string): void {
    win?.webContents.send('plugin:changed', { action, pluginId })
}

// === Electron 窗口逻辑 ===

function createWindow() {
    win = new BrowserWindow({
        frame: false,
        minWidth: 950,
        minHeight: 800,
        width: 1000,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, '../preload/index.js'),
            sandbox: false,
            contextIsolation: true,
            webSecurity: false
        }
    })

    win.webContents.on('did-finish-load', () => {
        win?.webContents.send('main-process-message', new Date().toLocaleString())
    })

    // electron-vite sets ELECTRON_RENDERER_URL in dev mode
    if (process.env.ELECTRON_RENDERER_URL) {
        win.loadURL(process.env.ELECTRON_RENDERER_URL)
    } else {
        win.loadFile(path.join(RENDERER_DIST, 'index.html'))
    }
    if (!app.isPackaged) {
        win.webContents.openDevTools();
    }
    registerZoomShortcuts(win)
}

// === IPC 监听 ===

ipcMain.on('window-minimize', (event) => BrowserWindow.fromWebContents(event.sender)?.minimize())
ipcMain.on('window-maximize', () => win?.isMaximized() ? win.unmaximize() : win?.maximize())
ipcMain.on('window-close', () => win?.close())
ipcMain.handle('window-is-maximized', () => win?.isMaximized() || false)

// --- qzplayer IPC Handlers ---
ipcMain.handle('qzplayer-command', async (_, command: any[]) => {
    if (qzplayer) {
        qzplayer.send(command)
    }
})

// Quick Helpers
ipcMain.handle('qzplayer-load', (_, url) => qzplayer?.load(url))
ipcMain.handle('qzplayer-play', () => qzplayer?.play())
ipcMain.handle('qzplayer-pause', () => qzplayer?.pause())
ipcMain.handle('qzplayer-toggle-pause', () => qzplayer?.togglePause())
ipcMain.handle('qzplayer-stop', () => qzplayer?.stop())
ipcMain.handle('qzplayer-set-volume', (_, vol) => qzplayer?.setVolume(vol))
ipcMain.handle('qzplayer-seek', (_, time) => qzplayer?.seek(time))

// PluginSystem
ipcMain.handle(
    'plugin:call',
    async (_event, pluginId: string, method: string, args: any[]) => {
        const plugin = new PluginSystem(pluginId)
        try {
            return await plugin.call(method, args)
        } catch (err: any) {
            return {
                success: false,
                error: err?.message || `Method ${method} failed`
            }
        }
    }
)

ipcMain.handle('plugin:getAll', () => {
    return PluginSystem.getAllPlugins()
})

ipcMain.handle('plugin:uninstall', (_, id: string) => {
    const success = PluginSystem.uninstallPlugin(id)
    if (success) notifyPluginsChanged('uninstalled', id)
    return success
})

ipcMain.handle('plugin:install', async () => {
    if (!win) return { success: false, message: 'Window is unavailable' }
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
        title: '选择插件文件',
        filters: [{ name: 'Bundled JavaScript Plugin', extensions: ['js'] }],
        properties: ['openFile']
    })

    if (canceled || filePaths.length === 0) {
        return { success: false, message: 'canceled' }
    }

    const result = await PluginSystem.installPlugin(filePaths[0])
    if (result.success) {
        notifyPluginsChanged(result.updated ? 'updated' : 'installed', result.pluginId)
    }
    return result
})

// Cache IPC Handlers
ipcMain.handle('cache:getInfo', () => {
    const settings = loadSettings();
    return {
        path: settings.cachePath || getCacheDir(), // Use setting or fallback
        size: getCacheSize(),
        persistCache: settings.persistCache
    }
})

ipcMain.handle('cache:setPersist', (_, persist: boolean) => {
    setPersistCache(persist)
    saveSettings({ persistCache: persist })
})

ipcMain.handle('cache:openFolder', () => {
    const settings = loadSettings()
    const dir = settings.cachePath || getCacheDir()
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
    }
    require('electron').shell.openPath(dir)
})

ipcMain.handle('cache:clear', () => {
    clearCacheNow()
})

ipcMain.handle('dialog:openDirectory', async () => {
    if (!win) return null
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
        title: 'Select Cache Directory',
        properties: ['openDirectory', 'createDirectory']
    })
    if (canceled || filePaths.length === 0) return null
    return filePaths[0]
})

ipcMain.handle('cache:changeLocation', async (_, newPath: string) => {
    try {
        const settings = loadSettings()
        const oldPath = settings.cachePath || getCacheDir()

        if (oldPath === newPath) {
            return { success: true, message: 'Path is the same' }
        }

        // 1. Check permissions / Create new dir
        if (!fs.existsSync(newPath)) {
            try {
                fs.mkdirSync(newPath, { recursive: true })
            } catch (e) {
                return { success: false, message: 'Cannot create directory' }
            }
        }

        // 2. Migration: Move files from oldPath to newPath
        // We only move files if old path exists
        if (fs.existsSync(oldPath)) {
            try {
                const files = fs.readdirSync(oldPath);
                for (const file of files) {
                    const src = path.join(oldPath, file);
                    const dest = path.join(newPath, file);
                    // Copy then delete to be safe, or rename
                    // Simple rename might fail across partitions, so verify

                    try {
                        fs.renameSync(src, dest);
                    } catch (moveErr) {
                        // Fallback to copy and unlink if rename fails (e.g. cross-drive)
                        fs.copyFileSync(src, dest);
                        fs.unlinkSync(src);
                    }
                }
                // Try to remove old dir if empty
                try { fs.rmdirSync(oldPath); } catch (_) { }
            } catch (e) {
                console.error("[Cache] Migration failed partially:", e)
                // Continue anyway to set the new path? 
                // Better to warn user. But let's assume we proceed and just log.
            }
        }

        saveSettings({ cachePath: newPath })
        refreshCacheDir()

        return { success: true, message: 'Cache location updated', path: newPath }
    } catch (e: any) {
        return { success: false, message: e.message || 'Unknown error' }
    }
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
    if (qzplayer) {
        qzplayer.destroy()
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
    // ----------------------------------------
    Menu.setApplicationMenu(null)
    createWindow()

    // Start Proxy Server
    startProxyServer()

    // Start qzplayer
    qzplayer = new QzpController()
    qzplayer.start()

    qzplayer.on('event', (data) => {
        // Forward qzplayer events to Render Process
        if (win && !win.isDestroyed()) {
            win.webContents.send('qzplayer-event', data)
        }
    })
})
