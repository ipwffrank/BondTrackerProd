import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/',
  resolve: {
    preserveSymlinks: true,
  },
  build: {
    // Don't manually chunk vendors. Earlier attempt to split firebase /
    // pdf / xlsx / react each into their own chunk introduced a
    // cross-chunk circular dependency that surfaced in prod as
    // "Uncaught ReferenceError: Cannot access 'nf' before
    // initialization" — blank-screen incident. Letting Rollup auto-
    // chunk via the React.lazy boundaries we already have is enough:
    // each lazy route gets its own chunk, vendors share a default
    // vendor chunk per entry. Bundle is still meaningfully smaller
    // than the original single-bundle build.
    chunkSizeWarningLimit: 800,
  },
})
