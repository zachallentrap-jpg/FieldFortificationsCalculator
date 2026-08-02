// Builds SAP-2's hosted app using the ROOT toolchain, so a deploy needs exactly one
// npm install and one network round trip.
//
// sap2/ keeps its own exact-pinned toolchain for development, tests, and `npm run
// verify` — that is the blueprint's B43 commitment and it is unchanged. This config
// exists only for the DEPLOY path, where a second npm install inside the build
// sandbox is a network dependency we do not need: SAP-2's hosted app has no runtime
// dependencies at all (three.js arrives with the 3D work in R2b), so bundling it is
// pure TypeScript-to-ES2022 work that any recent vite does identically.
import { defineConfig } from 'vite';

export default defineConfig({
  root: 'sap2',
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
    assetsInlineLimit: 4096,
    sourcemap: false,
  },
});
