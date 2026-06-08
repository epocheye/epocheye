# tools/

## GLB compression (`compress-glb.mjs`)

Shrinks heritage GLBs for fast loading over weak museum wifi, targeting the
**native AR path** (Filament via SceneView). Output uses only extensions
Filament decodes at runtime — `EXT_meshopt_compression`, `KHR_texture_basisu`
(KTX2/Basis), `KHR_mesh_quantization`. **Do not** feed these to the JS three.js
`GLBViewer`; it has no Basis/meshopt decoder. That path is separate.

### One-time setup: native gltfpack

Texture (Basis) compression needs the **native** gltfpack — the npm build is
built *without* BasisU. Download once and drop it in `tools/gltfpack/`:

1. Grab `gltfpack-<os>.zip` from
   https://github.com/zeux/meshoptimizer/releases (currently v1.1).
2. Extract so the binary lives at `tools/gltfpack/gltfpack.exe` (Windows) or
   `tools/gltfpack/gltfpack` (macOS/Linux). Alternatively set `$GLTFPACK_BIN`.

`tools/gltfpack/` is git-ignored (platform-specific binary, ~3 MB). Draco
decoding uses `@gltf-transform/cli` via `npx` (no install needed).

### Usage

```bash
npm run compress-glb -- assets/models/foo.glb assets/models/foo.compressed.glb
```

Defaults (the approved konark_vimana recipe): meshopt geometry, baseColor kept
at full resolution (ETC1S), normal (UASTC) + metallic-roughness/AO (ETC1S)
halved. Tune with:

| flag             | default | effect                                              |
| ---------------- | ------- | --------------------------------------------------- |
| `--quality N`    | `8`     | Basis quality 1–10                                  |
| `--color-scale R`| `1`     | scale baseColor/emissive (1 = keep full res)        |
| `--linear-scale R`|`0.5`   | scale normal + metallic-roughness + AO              |
| `--all-scale R`  | —       | scale ALL textures (overrides the two above)        |
| `--simplify R`   | —       | keep ratio R of triangles (gltfpack `-si`)          |
| `--no-uastc-normal` | —    | encode normals with ETC1S too (smaller placeholders)|

### Low-detail placeholder (progressive swap)

A tiny always-bundled GLB shown instantly while the full/CDN model loads:

```bash
npm run compress-glb -- assets/models/konark_vimana.glb \
  assets/models/konark_vimana.low.glb \
  --all-scale 0.0625 --quality 4 --simplify 0.15 --no-uastc-normal
```

konark low result: `11.47 MB → 0.41 MB` (128² ETC1S textures, ~50k tris). gltfpack's
simplifier floors around here without breaking the silhouette — fine for a placeholder.
Bundled at `android/app/src/main/assets/models/konark_vimana.low.glb` and registered as
model id `konark_vimana_low` in `src/services/localGlbAssets.ts`.

### konark_vimana result (reference)

`11.47 MB → 3.26 MB` (−72%): geometry Draco→meshopt+quantized; baseColor ETC1S
2K, normal UASTC 1K, metallic-roughness ETC1S 1K. No visible loss at normal
viewing distance. Always confirm visually on-device after compressing a new
model — Basis is lossy.
