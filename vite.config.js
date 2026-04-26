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
    // Split vendor libs into their own chunks so React.lazy route chunks
    // don't double-bundle Firebase / jsPDF / xlsx. Each route ends up
    // small (~30-100kb gzip) and the vendor chunks cache aggressively.
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('firebase')) return 'vendor-firebase';
          if (id.includes('react-router')) return 'vendor-router';
          if (id.includes('jspdf') || id.includes('html2canvas')) return 'vendor-pdf';
          if (id.includes('xlsx')) return 'vendor-xlsx';
          if (id.includes('react') || id.includes('scheduler')) return 'vendor-react';
          // Everything else lands in a default vendor chunk.
          return 'vendor-misc';
        },
      },
    },
    chunkSizeWarningLimit: 800,
  },
})
