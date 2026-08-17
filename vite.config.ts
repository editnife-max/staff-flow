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
      // Inject server-only secrets at transform time — works in every runtime context
      'process.env.ANTHROPIC_API_KEY': JSON.stringify(env.ANTHROPIC_API_KEY ?? ''),
    },
    optimizeDeps: {
      include: ['xlsx-js-style'],
    },
    ssr: {
      noExternal: ['xlsx-js-style'],
      external: ['puppeteer-core', 'child_process'],
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
