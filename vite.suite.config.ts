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
    // NOT the 100 MB inline limit vite.config.ts uses. That exists so the SINGLE-FILE
    // artifact can fold every asset into one HTML; the hosted suite serves real files,
    // and base64-inlining everything balloons peak memory during transform — which is
    // what killed the deploy build (it died mid-transform with no error, the signature
    // of an OOM rather than a command failure).
    assetsInlineLimit: 4096,
    chunkSizeWarningLimit: 1000,
    // Node's default heap can be tight in a 4 GiB deploy sandbox; keep sourcemaps off
    // and let rollup split naturally rather than forcing one giant chunk.
    sourcemap: false,
    rollupOptions: {
      input: {
        hub: fileURLToPath(new URL('src/ui/hub.html', import.meta.url)),
        woodframe: fileURLToPath(new URL('src/ui/woodframe.html', import.meta.url)),
      },
    },
  },
});
