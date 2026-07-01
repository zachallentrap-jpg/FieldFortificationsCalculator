import { defineConfig } from 'vite';

// SAP-1 is offline-first. Vite is a dev/build-time dependency only; nothing here
// pulls a runtime dependency into doctrine/ engine/ state/. `base: './'` keeps every
// asset reference relative so the PWA build works from any path and the standalone
// inliner (scripts/build-standalone.ts) can fold it into a single file:// artifact.
export default defineConfig({
  root: 'src/ui',
  base: './',
  publicDir: '../../public',
  build: {
    outDir: '../../dist',
    emptyOutDir: true,
    target: 'es2022',
    assetsInlineLimit: 100_000_000, // inline all assets; we ship zero external requests
    rollupOptions: {
      output: {
        // Deterministic, hashless names so the standalone inliner has stable targets.
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
});
