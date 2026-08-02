import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

// SAP-1 is offline-first. Vite is a dev/build-time dependency only; nothing here
// pulls a runtime dependency into doctrine/ engine/ state/. `base: './'` keeps every
// asset reference relative so the PWA build works from any path and the standalone
// inliner (scripts/build-standalone.ts) can fold it into a single file:// artifact.

// three.js's minified output carries a citation comment (an academic-paper URL for an
// algorithm it implements) — inert text, never dereferenced, but the offline gate (§2.3)
// is deliberately strict about ANY external URL surviving into dist/, comments included.
// Strip the scheme so the citation stays readable as plain text but is no longer a URL.
export function stripVendorCitationUrls(): Plugin {
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
  server: {
    // Vite 6 rejects any Host header it does not recognise, which makes the dev server
    // unreachable from a cloud workspace: Replit hands out a per-session hostname like
    // <uuid>-<slug>.kirk.replit.dev, so it can never be listed literally. Allowing the
    // suffix covers every session without opening the server to arbitrary hosts.
    //
    // Dev only. The deployed path is `build:suite` + scripts/serve-suite.mjs, which is a
    // plain static file server with no host check at all — production was never affected.
    allowedHosts: ['.replit.dev', '.repl.co', '.picard.replit.dev', 'localhost'],
  },
  build: {
    outDir: '../../dist',
    emptyOutDir: true,
    target: 'es2022',
    assetsInlineLimit: 100_000_000, // inline all assets; we ship zero external requests
    chunkSizeWarningLimit: 1000, // the 3D library is the bulk of this; expected, not a code-split candidate for a single-file artifact
    rollupOptions: {
      // The suite is multi-page: one deploy ships the hub plus every tool. Adding a tool =
      // one more input here + one more card in hub.html. build-standalone.ts still inlines
      // dist/index.html (SAP-1); the offline gate scans ALL emitted pages.
      input: {
        index: fileURLToPath(new URL('src/ui/index.html', import.meta.url)),
        hub: fileURLToPath(new URL('src/ui/hub.html', import.meta.url)),
        woodframe: fileURLToPath(new URL('src/ui/woodframe.html', import.meta.url)),
      },
      output: {
        // Deterministic, hashless names so the standalone inliner has stable targets.
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
});
