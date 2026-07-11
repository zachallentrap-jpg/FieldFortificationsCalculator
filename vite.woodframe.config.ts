import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { stripVendorCitationUrls } from './vite.config';

// Standalone build for the wood-frame construction section (src/ui/woodframe.html) — publishable
// to its own webpage, completely independent of the main app build (which stays index.html-only).
// Same offline posture as the app: every asset inlined, no external requests.
// Run: npm run build:woodframe  →  dist-woodframe/woodframe.html
export default defineConfig({
  root: 'src/ui',
  base: './',
  publicDir: false,
  plugins: [stripVendorCitationUrls()],
  build: {
    outDir: '../../dist-woodframe',
    emptyOutDir: true,
    target: 'es2022',
    assetsInlineLimit: 100_000_000, // inline all assets; the page ships zero external requests
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      input: fileURLToPath(new URL('src/ui/woodframe.html', import.meta.url)),
    },
  },
});
