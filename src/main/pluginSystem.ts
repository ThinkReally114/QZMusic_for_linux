import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import { createRequire } from 'node:module'


const require = createRequire(import.meta.url)

export interface UrlResponse {
    success: boolean
    url?: string
    error?: string
}

type PluginModule = {
    getUrl?: (id: string, quality: string) => Promise<string> | string,
    musicSearch?: {
        search: (query: string, page: number, limit: number) => Promise<any> | any
    },
    getLyric?: (id: string) => Promise<string> | object
}

export class PluginSystem {
    private pluginId: string
    private plugin: PluginModule | null = null
    constructor(pluginId: string) {
        this.pluginId = pluginId
        this.loadPlugin()
    }

    private loadPlugin() {
        try {
            const pluginPath = path.join(
                app.getPath('userData'),
                'plugins',
                this.pluginId,
                'index.js'
            )

            if (!fs.existsSync(pluginPath)) {
                throw new Error(`Plugin ${this.pluginId} not found`)
            }

            delete require.cache[require.resolve(pluginPath)]

            this.plugin = require(pluginPath)

        } catch (e: any) {
            console.error(`[PluginSystem] load failed:`, e)
            this.plugin = null
        }
    }
    async getUrl(id: string, quality: string): Promise<UrlResponse> {
        if (!this.plugin?.getUrl) {
            return {
                success: false,
                error: 'getUrl not implemented'
            }
        }

        try {
            // New behavior: plugin returns raw url string or throws
            const url = await this.plugin.getUrl(id, quality)

            if (typeof url !== 'string' || !url.startsWith('http')) {
                return {
                    success: false,
                    error: 'Invalid URL scheme'
                }
            }

            return {
                success: true,
                url
            }

        } catch (e: any) {
            return {
                success: false,
                error: e.message || 'plugin error'
            }
        }
    }

    async search(query: string, page: number, limit: number): Promise<any> {
        if (!this.plugin?.musicSearch?.search) {
            return {
                list: [],
                total: 0,
                allPage: 0,
                error: 'Search not implemented'
            }
        }
        return await this.plugin.musicSearch.search(query, page, limit)
    }

    async getLyric(id: string): Promise<any> {
        console.log("getLyric not implemented");
        if (!this.plugin?.getLyric) {
            console.log("getLyric not implemented2");
            return
        }
        try {
            const result = await this.plugin.getLyric(id)
            console.log(result)
            return result
        } catch (e: any) {
            console.log(e)
            console.error(e)
            return {}
        }
    }

    static getAllPlugins(): any[] {
        try {
            const pluginsPath = path.join(app.getPath('userData'), 'plugins')
            if (!fs.existsSync(pluginsPath)) return []

            return fs.readdirSync(pluginsPath).map(dir => {
                const pluginPath = path.join(pluginsPath, dir, 'index.js')
                if (fs.existsSync(pluginPath)) {
                    try {
                        // Clear cache to ensure fresh load
                        delete require.cache[require.resolve(pluginPath)]
                        const pluginModule = require(pluginPath)
                        if (pluginModule.pluginInfo) {
                            return {
                                ...pluginModule.pluginInfo.info,
                                quality: pluginModule.pluginInfo.quality,
                                _path: dir
                            }
                        }

                        // Fallback for current simple plugins if they don't have metadata
                        return {
                            id: dir,
                            name: dir,
                            description: 'No description',
                            version: '0.0.0',
                            _path: dir
                        }
                    } catch (e) {
                        console.error(`[PluginSystem] Failed to load plugin ${dir}:`, e)
                        return null
                    }
                }
                return null
            }).filter(p => p !== null)
        } catch (e) {
            console.error('[PluginSystem] getAllPlugins failed:', e)
            return []
        }
    }

    static async installPlugin(filePath: string): Promise<{ success: boolean; message: string }> {
        try {
            // Require the file to get plugin info
            // Notes: We might need to copy it to a temp location if 'require' caches by path strictness,
            // but for now let's try requiring the source.
            // If the user selects a file, it's likely outside our project.
            // Node's require might need valid path.

            // However, we can also just read the file content and do a regex check if we want to be safe, 
            // but the user's plugin example is a JS object.
            // Let's copy it to a temporary location in userData to rely on 'require'

            const tempId = `temp_${Date.now()}`
            const tempDir = path.join(app.getPath('userData'), 'temp_plugins', tempId)
            const tempFile = path.join(tempDir, 'index.js')

            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true })
            }

            fs.copyFileSync(filePath, tempFile)

            // Clear cache just in case
            delete require.cache[require.resolve(tempFile)]
            const pluginModule = require(tempFile)

            let id = ''
            if (pluginModule.pluginInfo?.info?.id) {
                id = pluginModule.pluginInfo.info.id
            } else if (pluginModule.info?.id) {
                // Legacy or direct format support
                id = pluginModule.info.id
            }

            if (!id) {
                // Cleanup
                fs.rmSync(tempDir, { recursive: true, force: true })
                console.error('[PluginSystem] No plugin ID found in file')
                return { success: false, message: '插件文件中未找到ID' }
            }

            // Install to real location
            const targetDir = path.join(app.getPath('userData'), 'plugins', id)
            if (fs.existsSync(targetDir)) {
                fs.rmSync(tempDir, { recursive: true, force: true })
                return { success: false, message: `插件 ${id} 已存在` }
            }
            fs.mkdirSync(targetDir, { recursive: true })

            fs.copyFileSync(filePath, path.join(targetDir, 'index.js'))

            // Cleanup temp
            fs.rmSync(tempDir, { recursive: true, force: true })

            return { success: true, message: '安装成功' }
        } catch (e: any) {
            console.error('[PluginSystem] Install failed:', e)
            return { success: false, message: e.message || '安装失败' }
        }
    }

    static uninstallPlugin(id: string): boolean {
        try {
            const pluginPath = path.join(app.getPath('userData'), 'plugins', id)
            if (fs.existsSync(pluginPath)) {
                fs.rmSync(pluginPath, { recursive: true, force: true })
                return true
            }
            return false
        } catch (e) {
            console.error(`[PluginSystem] Failed to uninstall plugin ${id}:`, e)
            return false
        }
    }
}