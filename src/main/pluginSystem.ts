import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import { createRequire } from 'node:module'
import { MessagePlugin } from "tdesign-vue-next";

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
            MessagePlugin.error(e).then()
            return {}
        }
    }
}