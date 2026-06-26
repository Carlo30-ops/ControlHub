/// <reference types="vitest" />
import { defineConfig } from 'vite';
import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import electron from 'vite-plugin-electron/simple';
import renderer from 'vite-plugin-electron-renderer';
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
                        minify: 'esbuild',
                        rollupOptions: {
                            external: ['pdf-parse', 'pdf-parse/lib/pdf.js/v1.10.100/build/pdf.js'],
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
    build: {
        minify: 'esbuild',
        sourcemap: false,
        rollupOptions: {
            output: {
                manualChunks: {
                    'vendor-react': ['react', 'react-dom', 'react-router'],
                    'vendor-ui': ['@radix-ui/react-dialog', '@radix-ui/react-select', 'lucide-react', 'motion'],
                    'vendor-utils': ['date-fns', 'xlsx', 'fuse.js'],
                    'vendor-charts': ['recharts'],
                }
            }
        }
    },
    esbuild: {
        drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
    },
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
});
