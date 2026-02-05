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
    }
}

export class PluginSystem {
    private pluginId: string
    private plugin: PluginModule | null = null
    constructor(pluginId: string) {
        this.pluginId = pluginId
        this.loadPlugin()
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
        try {
            return await this.plugin.musicSearch.search(query, page, limit)
        } catch (e: any) {
            return {
                list: [],
                total: 0,
                allPage: 0,
                error: e.message || 'Plugin search error'
            }
        }
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
}