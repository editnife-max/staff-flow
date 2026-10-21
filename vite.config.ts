import { defineConfig, loadEnv } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig(({ mode }) => {
  // Load all .env vars (no prefix filter) so server-only keys are available
  const env = loadEnv(mode, process.cwd(), '')

  return {
    define: {
      // Server-only: injected into the worker bundle at build time.
      // Never referenced from client-side code — only used in translate.functions.ts (server fn).
      'process.env.ANTHROPIC_API_KEY': JSON.stringify(env.ANTHROPIC_API_KEY ?? ''),
    },
    optimizeDeps: {
      include: ['xlsx-js-style', 'xlsx'],
    },
    ssr: {
      noExternal: ['xlsx-js-style', 'xlsx'],
    },
    build: {
      sourcemap: mode === 'development',
      rollupOptions: {
        external: [
          'puppeteer-core',
          /^puppeteer-core\/.*/,
          '@puppeteer/browsers',
          /^@puppeteer\/.*/,
        ],
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/xlsx')) {
              return 'vendor-xlsx';
            }
            if (id.includes('node_modules/@anthropic-ai')) {
              return 'vendor-anthropic';
            }
          },
        },
      },
    },
    plugins: [
      tailwindcss(),
      tsconfigPaths(),
      tanstackStart({
        server: { entry: 'server' },
      }),
      react(),
    ],
  }
})
