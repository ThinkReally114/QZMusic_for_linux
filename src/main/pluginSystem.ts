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
    getUrl?: (id: string, quality: string) => Promise<UrlResponse> | UrlResponse
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
            return await this.plugin.getUrl(id, quality)
        } catch (e: any) {
            return {
                success: false,
                error: e.message || 'plugin error'
            }
        }
    }
}