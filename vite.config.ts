import { defineConfig } from 'vite'
import path from 'path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import electron from 'vite-plugin-electron/simple'
import renderer from 'vite-plugin-electron-renderer'

export default defineConfig({
  base: './', // Crucial para que Electron resuelva las rutas relativas a la carpeta dist
  plugins: [
    react(),
    tailwindcss(),
    electron({
      main: {
        entry: 'electron/main.ts',
        vite: {
          build: {
            rollupOptions: {
              input: {
                main: 'electron/main.ts',
                pdfWorker: 'electron/pdfWorker.ts',
              }
            }
          }
        }
      },
      preload: {
        input: 'electron/preload.ts',
      },
    }),
    renderer(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    open: false,
  },
  assetsInclude: ['**/*.svg', '**/*.csv'],
})
