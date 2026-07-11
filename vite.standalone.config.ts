import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { stripVendorCitationUrls } from './vite.config';

// Single-input build feeding scripts/build-standalone.ts (the file:// air-gap artifact).
// The main suite build (vite.config.ts) is multi-page and SHARES chunks between tools — good
// for hosting, fatal for the single-file inliner, which needs everything in one chunk behind
// one <script src>. This config rebuilds SAP-1 alone into dist-standalone/ for inlining.
export default defineConfig({
  root: 'src/ui',
  base: './',
  publicDir: '../../public',
  plugins: [stripVendorCitationUrls()],
  build: {
    outDir: '../../dist-standalone',
    emptyOutDir: true,
    target: 'es2022',
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      input: fileURLToPath(new URL('src/ui/index.html', import.meta.url)),
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
});
