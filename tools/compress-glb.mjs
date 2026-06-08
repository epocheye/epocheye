#!/usr/bin/env node
/**
 * Repeatable GLB compression for the native AR path (Filament / SceneView).
 *
 * Pipeline:
 *   1. Decode any KHR_draco_mesh_compression (gltfpack can't read Draco) via
 *      @gltf-transform/cli, producing a plain intermediate GLB.
 *   2. gltfpack (NATIVE build — has BasisU) applies:
 *        - meshopt geometry compression (EXT_meshopt_compression) + quantization
 *        - KTX2/Basis textures: ETC1S for color + linear (metallic/roughness/AO),
 *          UASTC for normal maps (ETC1S mangles normals)
 *
 * The output uses only extensions Filament decodes at runtime
 * (EXT_meshopt_compression, KHR_texture_basisu, KHR_mesh_quantization) — so DO
 * NOT add a JS/three.js decoder; this file is for the native AR view.
 *
 * Defaults match the approved "konark_vimana" recipe: baseColor stays sharp at
 * full resolution, normal + linear maps drop to half resolution (invisible at
 * museum viewing distance, big size win).
 *
 *   node tools/compress-glb.mjs <input.glb> <output.glb> [options]
 *
 * Options:
 *   --quality N        ETC1S/UASTC quality 1..10           (default 8)
 *   --color-scale R    baseColor/emissive scale 0..1       (default 1   = keep)
 *   --linear-scale R   normal + metallicRoughness + AO 0..1 (default 0.5 = half)
 *   --all-scale R      scale ALL textures (overrides the two above)
 *   --simplify R       gltfpack -si: keep ratio R of triangles (e.g. 0.3)
 *   --no-uastc-normal  encode normals with ETC1S too (smaller; for placeholders)
 *   --keep-temp        keep the Draco-decoded intermediate (debug)
 *
 * Low-detail placeholder recipe (see "konark low" in README):
 *   --all-scale 0.125 --quality 5 --simplify 0.4 --no-uastc-normal
 *
 * Requires the NATIVE gltfpack (the npm build lacks BasisU). Resolved from:
 *   - $GLTFPACK_BIN, or
 *   - tools/gltfpack/gltfpack(.exe)
 * Download once from https://github.com/zeux/meshoptimizer/releases
 * (gltfpack-<os>.zip) into tools/gltfpack/. See tools/README.md.
 */

import {spawnSync} from 'node:child_process';
import {existsSync, statSync, rmSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, resolve, join} from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
function flag(name) {
  return process.argv.includes(`--${name}`);
}

const input = process.argv[2];
const output = process.argv[3];
if (!input || !output || input.startsWith('--') || output.startsWith('--')) {
  console.error('usage: node tools/compress-glb.mjs <input.glb> <output.glb> [options]');
  process.exit(1);
}

const quality = arg('quality', '8');
const allScale = arg('all-scale', null);
const colorScale = arg('color-scale', '1');
const linearScale = arg('linear-scale', '0.5');
const simplify = arg('simplify', null);
const uastcNormal = !flag('no-uastc-normal');

function resolveGltfpack() {
  if (process.env.GLTFPACK_BIN && existsSync(process.env.GLTFPACK_BIN)) {
    return process.env.GLTFPACK_BIN;
  }
  const exe = process.platform === 'win32' ? 'gltfpack.exe' : 'gltfpack';
  const local = join(__dirname, 'gltfpack', exe);
  if (existsSync(local)) return local;
  return exe; // fall back to PATH
}

const gltfpack = resolveGltfpack();
const mb = p => (statSync(p).size / 1024 / 1024).toFixed(2);

if (!existsSync(input)) {
  console.error(`input not found: ${input}`);
  process.exit(1);
}

const beforeMB = mb(input);
const intermediate = resolve(output + '.decoded.tmp.glb');

// 1. Decode Draco (no-op if the asset isn't Draco-compressed).
// `shell: true` so npx resolves on Windows (npx.cmd); paths are quoted.
console.log('• decoding Draco (if present)…');
const q = s => `"${s}"`;
let r = spawnSync(
  `npx --yes @gltf-transform/cli cp ${q(input)} ${q(intermediate)}`,
  {stdio: 'inherit', shell: true},
);
if (r.error || r.status !== 0) {
  console.error('Draco decode step failed.');
  process.exit(r.status ?? 1);
}

// 2. gltfpack: meshopt geometry + KTX2/Basis textures.
const gpArgs = ['-i', intermediate, '-o', output, '-cc', '-tc', '-tq', quality];
if (uastcNormal) gpArgs.push('-tu', 'normal');
if (simplify) gpArgs.push('-si', simplify);
if (allScale) {
  gpArgs.push('-ts', allScale);
} else {
  if (colorScale !== '1') gpArgs.push('-ts', 'color', colorScale);
  if (linearScale !== '1') gpArgs.push('-ts', 'normal,attrib', linearScale);
}

console.log(`• gltfpack ${gpArgs.join(' ')}`);
r = spawnSync(gltfpack, gpArgs, {stdio: 'inherit'});
if (r.error || r.status !== 0) {
  console.error(
    'gltfpack failed. Ensure the NATIVE gltfpack (with BasisU) is at ' +
      'tools/gltfpack/ or $GLTFPACK_BIN — the npm build has no texture compression.',
  );
  if (!flag('keep-temp')) rmSync(intermediate, {force: true});
  process.exit(r.status ?? 1);
}

if (!flag('keep-temp')) rmSync(intermediate, {force: true});

const afterMB = mb(output);
const pct = (100 * (1 - afterMB / beforeMB)).toFixed(0);
console.log(`\n✓ ${input}  ${beforeMB} MB  →  ${output}  ${afterMB} MB  (−${pct}%)`);
