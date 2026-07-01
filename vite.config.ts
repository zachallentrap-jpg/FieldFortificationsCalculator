import { defineConfig, type Plugin } from 'vite';

// SAP-1 is offline-first. Vite is a dev/build-time dependency only; nothing here
// pulls a runtime dependency into doctrine/ engine/ state/. `base: './'` keeps every
// asset reference relative so the PWA build works from any path and the standalone
// inliner (scripts/build-standalone.ts) can fold it into a single file:// artifact.

// three.js's minified output carries a citation comment (an academic-paper URL for an
// algorithm it implements) — inert text, never dereferenced, but the offline gate (§2.3)
// is deliberately strict about ANY external URL surviving into dist/, comments included.
// Strip the scheme so the citation stays readable as plain text but is no longer a URL.
function stripVendorCitationUrls(): Plugin {
  const PATTERN = /https?:\/\/(jcgt\.org)/g;
  return {
    name: 'strip-vendor-citation-urls',
    renderChunk(code) {
      if (!PATTERN.test(code)) return null;
      return { code: code.replace(PATTERN, '$1'), map: null };
    },
  };
}

export default defineConfig({
  root: 'src/ui',
  base: './',
  publicDir: '../../public',
  plugins: [stripVendorCitationUrls()],
  build: {
    outDir: '../../dist',
    emptyOutDir: true,
    target: 'es2022',
    assetsInlineLimit: 100_000_000, // inline all assets; we ship zero external requests
    chunkSizeWarningLimit: 1000, // the 3D library is the bulk of this; expected, not a code-split candidate for a single-file artifact
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
