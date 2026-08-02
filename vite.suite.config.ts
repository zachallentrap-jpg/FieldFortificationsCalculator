// Deployment build for the 1371 Combat Engineer Toolkit suite.
//
// Difference from vite.config.ts (the archival v1 build): the SAP-1 page is NOT an
// input. SAP-1 is retired — its bundle carries the 295 illustrative placeholder
// values, so it must not ship at all, not even as an unreferenced chunk. Its slot in
// the hub is taken by SAP-2, which is built from sap2/ and assembled into
// dist/survivability/ by scripts/build-suite.mjs.
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { stripVendorCitationUrls } from './vite.config';

export default defineConfig({
  root: 'src/ui',
  base: './',
  publicDir: '../../public',
  plugins: [stripVendorCitationUrls()],
  build: {
    outDir: '../../dist',
    emptyOutDir: true,
    target: 'es2022',
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      input: {
        hub: fileURLToPath(new URL('src/ui/hub.html', import.meta.url)),
        woodframe: fileURLToPath(new URL('src/ui/woodframe.html', import.meta.url)),
      },
    },
  },
});
