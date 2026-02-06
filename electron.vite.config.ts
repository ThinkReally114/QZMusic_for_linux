import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import wasm from 'vite-plugin-wasm'

export default defineConfig({
    main: {
    },
    preload: {
    },
    renderer: {
        resolve: {
            alias: {
                '@renderer': resolve('src/renderer/src'),
                '@assets': resolve('src/renderer/assets')
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
