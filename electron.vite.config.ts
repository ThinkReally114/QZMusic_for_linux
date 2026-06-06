import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import wasm from 'vite-plugin-wasm'

const amllPackage = (...segments: string[]): string => resolve(__dirname, 'amll-local/packages', ...segments)

export default defineConfig({
    main: {
    },
    preload: {
    },
    renderer: {
        resolve: {
            alias: {
                '@applemusic-like-lyrics/core/style.css': amllPackage('core/src/styles/index.css'),
                '@applemusic-like-lyrics/core': amllPackage('core/src/index.ts'),
                '@applemusic-like-lyrics/lyric': amllPackage('lyric/src/index.ts'),
                '@applemusic-like-lyrics/ttml': amllPackage('ttml/src/index.ts'),
                '@applemusic-like-lyrics/vue': amllPackage('vue/src/index.ts'),
                '@renderer': resolve('src/renderer/src'),
                '@assets': resolve('src/renderer/src/assets')
            }
        },
        plugins: [vue(), vueJsx(), wasm()],
        build: {
            rollupOptions: {
                input: resolve(__dirname, 'src/renderer/index.html')
            }
        },
        server: {
            host: "0.0.0.0"
        }
    }
})
