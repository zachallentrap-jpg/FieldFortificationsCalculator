// Binary 3D-model assets are imported with an explicit `?url` suffix so Vite treats them as
// asset URLs regardless of file extension (no vite.config assetsInclude needed). At the current
// `assetsInlineLimit`, the build inlines them as base64 data: URIs — no network request, so the
// offline invariant (§2.3) holds exactly as it does for every other bundled asset.
declare module '*.glb?url' {
  const url: string;
  export default url;
}
