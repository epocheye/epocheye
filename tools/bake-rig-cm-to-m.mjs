/**
 * Bake the centimetre skeleton of a Meshy-rigged figure down to metres.
 *
 * Blender writes the skinned mesh POSITION in metres but the joint hierarchy in
 * centimetres, relying on a 0.01 scale on the Armature node to reconcile them.
 * Filament computes its static bounding box from POSITION alone and then divides
 * by the node scale, so scaleToUnits(1.70) reads the figure as 1.7 cm tall and
 * multiplies by 100 -> a 170 m Tipu. Fixing it means moving the 0.01 off the node
 * and into the skeleton: joint translations, inverse bind matrices, and every
 * translation keyframe.
 *
 * Morph-target deltas are NOT scaled: they live in POSITION space, which is
 * already metres.
 */
import fs from 'fs';

const [, , IN, OUT] = process.argv;
const CM = 0.01;
const DROP_ANIM = /__meshy_original$/;

// ---- read ----------------------------------------------------------------
const raw = fs.readFileSync(IN);
if (raw.readUInt32LE(0) !== 0x46546c67) throw new Error('not a GLB');
let p = 12, json = null, bin = null;
while (p < raw.length) {
  const len = raw.readUInt32LE(p), type = raw.readUInt32LE(p + 4);
  const body = raw.subarray(p + 8, p + 8 + len);
  if (type === 0x4e4f534a) json = JSON.parse(body.toString('utf8'));
  else if (type === 0x004e4942) bin = Buffer.from(body);
  p += 8 + len + ((4 - (len % 4)) % 4);
}
const g = json;

// ---- accessor helpers ----------------------------------------------------
const COMP = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
const NUM = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };
function view(ai) {
  const a = g.accessors[ai];
  const bv = g.bufferViews[a.bufferView];
  const n = NUM[a.type], cs = COMP[a.componentType];
  const stride = bv.byteStride || n * cs;
  if (stride !== n * cs) throw new Error('interleaved accessor ' + ai + ' not handled');
  const start = (bv.byteOffset || 0) + (a.byteOffset || 0);
  return { a, start, n, count: a.count, ct: a.componentType };
}
function scaleAccessor(ai, k, comps) {
  // A sparse accessor stores only the elements that differ from a base, so scaling
  // its dense view would touch the wrong bytes (or none). None of the accessors this
  // script scales are sparse today; fail loudly rather than corrupt silently if that
  // ever changes.
  if (g.accessors[ai].sparse) throw new Error('accessor ' + ai + ' is sparse; refusing to scale');
  const v = view(ai);
  if (v.ct !== 5126) throw new Error('accessor ' + ai + ' is not FLOAT');
  for (let e = 0; e < v.count; e++) {
    for (const c of comps) {
      const o = v.start + (e * v.n + c) * 4;
      bin.writeFloatLE(bin.readFloatLE(o) * k, o);
    }
  }
  if (v.a.min) for (const c of comps) v.a.min[c] *= k;
  if (v.a.max) for (const c of comps) v.a.max[c] *= k;
}

// ---- 0. optional: strip morph targets -------------------------------------
// `--no-morph` produces the same figure without visemes. Used to bisect a runtime
// fault: if a distortion survives with the targets gone, the mouth code is not the
// cause. Dropping the targets here (before the GC) also drops their sparse accessors
// and bufferViews automatically, so no special-casing is needed downstream.
const STRIP_MORPH = process.argv.includes('--no-morph');
if (STRIP_MORPH) {
  for (const m of g.meshes) {
    for (const pr of m.primitives) delete pr.targets;
    if (m.extras) delete m.extras.targetNames;
    delete m.weights;
  }
  for (const n of g.nodes) delete n.weights;
}

// ---- 1. drop the Meshy backup actions ------------------------------------
const droppedAnims = (g.animations || []).filter(a => DROP_ANIM.test(a.name)).map(a => a.name);
g.animations = (g.animations || []).filter(a => !DROP_ANIM.test(a.name));

// ---- 2. joints: translations cm -> m -------------------------------------
const armIdx = g.nodes.findIndex(n => n.name === 'Armature');
if (armIdx < 0) throw new Error('no Armature node');
const jointSet = new Set(g.skins.flatMap(s => s.joints));
let scaledJoints = 0;
for (const ji of jointSet) {
  const n = g.nodes[ji];
  if (n.translation) { n.translation = n.translation.map(v => v * CM); scaledJoints++; }
}

// ---- 3. inverse bind matrices: translation column cm -> m ----------------
for (const sk of g.skins) {
  // PREMULTIPLY the whole matrix by scale(CM) - NOT just the translation column.
  //
  // Derivation, because getting this wrong produced a 170 m figure that still measured
  // 1.700 m by every check we had. Let S = scale(0.01) (the armature node scale we are
  // removing), H_cm the joint hierarchy with centimetre translations, H_m the same
  // hierarchy after scaling those translations. Uniform scale commutes with rotation and
  // pushes through translation as S*T(t) = T(0.01t)*S, so
  //
  //     jointGlobal_before = S * H_cm = H_m * S = jointGlobal_after * S
  //
  // Skinning is jointGlobal * IBM * v and must be unchanged, so
  //
  //     jointGlobal_after * IBM_after = jointGlobal_after * S * IBM_before
  //     =>  IBM_after = S * IBM_before          (premultiply, whole matrix)
  //
  // In column-major terms that scales every element EXCEPT the bottom row (3, 7, 11, 15):
  // the 3x3 rotation block as well as the translation. Scaling only 12/13/14 leaves a
  // factor of 100 in the 3x3, and every skinned vertex comes out 100x too far from the
  // bone - which renders as a sheet of geometry filling the screen.
  //
  // The joint ORIGINS stay correct under the broken version, which is why an FK probe
  // that reads translation columns reported a perfect 1.700 m skeleton. Verify skinning
  // by actually summing SUM w*(jointGlobal*IBM)*v, not by measuring the skeleton.
  scaleAccessor(sk.inverseBindMatrices, CM, [0, 1, 2, 4, 5, 6, 8, 9, 10, 12, 13, 14]);
}

// ---- 4. animation translation keyframes cm -> m --------------------------
let scaledSamplers = 0;
const done = new Set();
for (const anim of g.animations) {
  for (const ch of anim.channels) {
    if (ch.target.path !== 'translation') continue;
    if (!jointSet.has(ch.target.node)) continue;
    const si = anim.samplers[ch.sampler].output;
    if (done.has(si)) continue;         // samplers can be shared between channels
    done.add(si);
    scaleAccessor(si, CM, [0, 1, 2]);
    scaledSamplers++;
  }
}

// ---- 5. the Armature node itself -----------------------------------------
const before = { s: g.nodes[armIdx].scale, t: g.nodes[armIdx].translation };
g.nodes[armIdx].scale = [1, 1, 1];
g.nodes[armIdx].translation = [0, 0, 0];

// ---- 6. garbage-collect accessors / bufferViews ---------------------------
const usedAcc = new Set();
for (const m of g.meshes) for (const pr of m.primitives) {
  Object.values(pr.attributes).forEach(a => usedAcc.add(a));
  if (pr.indices !== undefined) usedAcc.add(pr.indices);
  for (const t of pr.targets || []) Object.values(t).forEach(a => usedAcc.add(a));
}
for (const s of g.skins) usedAcc.add(s.inverseBindMatrices);
for (const a of g.animations) for (const sm of a.samplers) { usedAcc.add(sm.input); usedAcc.add(sm.output); }

const accOld = [...usedAcc].sort((a, b) => a - b);
const accMap = new Map(accOld.map((o, i) => [o, i]));
// An accessor can reference up to THREE bufferViews: its own, plus sparse.indices
// and sparse.values. Blender exports morph targets as SPARSE accessors — only the
// vertices that actually move — so a figure with visemes is exactly the case that
// exposes this. Missing them here dropped those bufferViews from the repack AND left
// the JSON pointing at pre-GC indices, so gltfio dereferenced whatever landed at
// those slots and read out of bounds:
//     F libc: Fatal signal 11 (SIGSEGV), code 2 (SEGV_ACCERR)  libgltfio-jni.so
// It crashed on every model load, deterministically, at the same instruction.
const usedBV = new Set();
for (const i of accOld) {
  const a = g.accessors[i];
  if (a.bufferView !== undefined) usedBV.add(a.bufferView);
  if (a.sparse) {
    usedBV.add(a.sparse.indices.bufferView);
    usedBV.add(a.sparse.values.bufferView);
  }
}
for (const im of g.images || []) if (im.bufferView !== undefined) usedBV.add(im.bufferView);

const bvOld = [...usedBV].sort((a, b) => a - b);
const bvMap = new Map(bvOld.map((o, i) => [o, i]));

// repack the binary chunk so the dropped animations stop costing download bytes
const chunks = [];
let cursor = 0;
const newBV = bvOld.map(o => {
  const bv = g.bufferViews[o];
  const pad = (4 - (cursor % 4)) % 4;
  if (pad) { chunks.push(Buffer.alloc(pad)); cursor += pad; }
  chunks.push(bin.subarray(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength));
  const out = { buffer: 0, byteOffset: cursor, byteLength: bv.byteLength };
  if (bv.byteStride !== undefined) out.byteStride = bv.byteStride;
  if (bv.target !== undefined) out.target = bv.target;
  cursor += bv.byteLength;
  return out;
});
const newBin = Buffer.concat(chunks);

g.accessors = accOld.map(o => {
  const a = { ...g.accessors[o] };
  if (a.bufferView !== undefined) a.bufferView = bvMap.get(a.bufferView);
  if (a.sparse) {
    // Deep-copy before rewriting, or the remap mutates the source object that the
    // pre-GC JSON still shares.
    a.sparse = {
      count: a.sparse.count,
      indices: { ...a.sparse.indices, bufferView: bvMap.get(a.sparse.indices.bufferView) },
      values: { ...a.sparse.values, bufferView: bvMap.get(a.sparse.values.bufferView) },
    };
  }
  return a;
});
g.bufferViews = newBV;
for (const m of g.meshes) for (const pr of m.primitives) {
  for (const k of Object.keys(pr.attributes)) pr.attributes[k] = accMap.get(pr.attributes[k]);
  if (pr.indices !== undefined) pr.indices = accMap.get(pr.indices);
  for (const t of pr.targets || []) for (const k of Object.keys(t)) t[k] = accMap.get(t[k]);
}
for (const s of g.skins) s.inverseBindMatrices = accMap.get(s.inverseBindMatrices);
for (const a of g.animations) for (const sm of a.samplers) { sm.input = accMap.get(sm.input); sm.output = accMap.get(sm.output); }
for (const im of g.images || []) if (im.bufferView !== undefined) im.bufferView = bvMap.get(im.bufferView);
g.buffers = [{ byteLength: newBin.length }];

// ---- write ---------------------------------------------------------------
let js = Buffer.from(JSON.stringify(g), 'utf8');
if (js.length % 4) js = Buffer.concat([js, Buffer.alloc(4 - (js.length % 4), 0x20)]);
const binPad = newBin.length % 4 ? Buffer.alloc(4 - (newBin.length % 4)) : Buffer.alloc(0);
const total = 12 + 8 + js.length + 8 + newBin.length + binPad.length;
const head = Buffer.alloc(12);
head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(total, 8);
const jh = Buffer.alloc(8); jh.writeUInt32LE(js.length, 0); jh.writeUInt32LE(0x4e4f534a, 4);
const bh = Buffer.alloc(8); bh.writeUInt32LE(newBin.length + binPad.length, 0); bh.writeUInt32LE(0x004e4942, 4);
fs.writeFileSync(OUT, Buffer.concat([head, jh, js, bh, newBin, binPad]));

// ---- verify before declaring success ------------------------------------
//
// This script rewrites accessor and bufferView indices wholesale, and a mistake there
// does not produce a broken-looking file - it produces a plausible one that segfaults
// the renderer at load. That is exactly what shipped as royal5/royal6. So re-read what
// was just written and check the invariants that the crash violated.
function verify() {
  const problems = [];
  const bvCount = g.bufferViews.length;
  const bufLen = newBin.length;
  g.bufferViews.forEach((bv, i) => {
    if ((bv.byteOffset || 0) + bv.byteLength > bufLen) {
      problems.push(`bufferView ${i} runs past the buffer end`);
    }
  });
  g.accessors.forEach((a, i) => {
    const refs = [['bufferView', a.bufferView]];
    if (a.sparse) {
      refs.push(['sparse.indices', a.sparse.indices.bufferView]);
      refs.push(['sparse.values', a.sparse.values.bufferView]);
    }
    for (const [label, ref] of refs) {
      // `bufferView` is optional on the accessor itself (a zero-filled accessor omits
      // it) but REQUIRED on sparse.indices and sparse.values. An undefined there is
      // exactly what a GC that forgot to walk `accessor.sparse` produces, so it must
      // be an error and not a skip - the first version of this check skipped it and
      // therefore passed the very file that was crashing the app.
      if (ref === undefined) {
        if (label !== 'bufferView') problems.push(`accessor ${i} ${label} has no bufferView`);
        continue;
      }
      if (!Number.isInteger(ref) || ref < 0 || ref >= bvCount) {
        problems.push(`accessor ${i} ${label} -> ${ref}, out of ${bvCount} bufferViews`);
      }
    }
    // The check that would have caught the crash: every sparse index must address a
    // real element of the accessor it belongs to.
    if (a.sparse) {
      const ind = a.sparse.indices;
      const bv = g.bufferViews[ind.bufferView];
      if (bv) {
        const width = { 5121: 1, 5123: 2, 5125: 4 }[ind.componentType];
        const base = (bv.byteOffset || 0) + (ind.byteOffset || 0);
        for (let k = 0; k < a.sparse.count; k++) {
          const o = base + k * width;
          const v = width === 1 ? newBin.readUInt8(o)
            : width === 2 ? newBin.readUInt16LE(o) : newBin.readUInt32LE(o);
          if (v >= a.count) {
            problems.push(
              `accessor ${i} sparse index ${k} = ${v}, >= count ${a.count} (ACCESSOR_SPARSE_INDEX_OOB)`);
            break;
          }
        }
      }
    }
  });
  return problems;
}
// The check that would have caught the 100x IBM bug. Everything else we measured -
// node height, scaleToUnits, joint world positions, glTF structural validity - passed
// on a file that rendered as a 170 m sheet, because they all read TRANSLATIONS and the
// error lived in the 3x3 rotation block. Only actually skinning the mesh sees it.
function verifySkinning() {
  const sk = g.skins && g.skins[0];
  if (!sk) return [];
  const parent = new Map();
  g.nodes.forEach((n, i) => (n.children || []).forEach(c => parent.set(c, i)));
  const trs = (t, q, sc) => { const [x, y, z, w] = q; return [
    (1-2*(y*y+z*z))*sc[0], 2*(x*y+z*w)*sc[0], 2*(x*z-y*w)*sc[0], 0,
    2*(x*y-z*w)*sc[1], (1-2*(x*x+z*z))*sc[1], 2*(y*z+x*w)*sc[1], 0,
    2*(x*z+y*w)*sc[2], 2*(y*z-x*w)*sc[2], (1-2*(x*x+y*y))*sc[2], 0,
    t[0], t[1], t[2], 1]; };
  const mm = (a, b) => { const o = new Array(16).fill(0);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++)
      for (let k = 0; k < 4; k++) o[c*4+r] += b[k*4+r]*a[c*4+k]; return o; };
  const loc = i => { const n = g.nodes[i];
    return trs(n.translation||[0,0,0], n.rotation||[0,0,0,1], n.scale||[1,1,1]); };
  const wld = i => { let m = loc(i), p = parent.get(i);
    while (p !== undefined) { m = mm(m, loc(p)); p = parent.get(p); } return m; };
  const NUMT = {SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};
  const CWT = {5120:1,5121:1,5122:2,5123:2,5125:4,5126:4};
  const el = (ai, idx) => { const a = g.accessors[ai], bv = g.bufferViews[a.bufferView];
    const n = NUMT[a.type], w = CWT[a.componentType];
    const off = (bv.byteOffset||0)+(a.byteOffset||0)+idx*n*w; const out = [];
    for (let c = 0; c < n; c++) { const o = off+c*w;
      out.push(a.componentType===5126?newBin.readFloatLE(o)
        :a.componentType===5123?newBin.readUInt16LE(o)
        :a.componentType===5121?newBin.readUInt8(o):newBin.readUInt32LE(o)); }
    return out; };
  const jm = sk.joints.map((j, i) => mm(el(sk.inverseBindMatrices, i), wld(j)));
  const pr = g.meshes[0].primitives[0];
  const n = g.accessors[pr.attributes.POSITION].count;
  let hi = -Infinity, lo = Infinity;
  for (let i = 0; i < n; i += 29) {
    const v = el(pr.attributes.POSITION, i);
    const J = el(pr.attributes.JOINTS_0, i), W = el(pr.attributes.WEIGHTS_0, i);
    let y = 0;
    for (let k = 0; k < 4; k++) { if (!W[k]) continue; const m = jm[J[k]];
      y += (m[1]*v[0] + m[5]*v[1] + m[9]*v[2] + m[13]) * W[k]; }
    if (y > hi) hi = y; if (y < lo) lo = y;
  }
  const height = hi - lo;
  if (!(height > 0.5 && height < 4)) {
    return [`skinned figure is ${height.toFixed(1)} m tall - the skin math is wrong ` +
      `(a 100x here means the inverse bind matrices were not premultiplied)`];
  }
  return [];
}

const problems = verify().concat(verifySkinning());
if (problems.length) {
  console.error('BAKE PRODUCED AN INVALID GLB - refusing to keep it:');
  for (const p of problems.slice(0, 10)) console.error('  ' + p);
  fs.unlinkSync(OUT);
  process.exit(1);
}

console.log(JSON.stringify({
  out: OUT, mb: +(total / 1048576).toFixed(2),
  droppedAnims, keptAnims: g.animations.map(a => a.name),
  scaledJoints, scaledTranslationSamplers: scaledSamplers,
  armatureBefore: before, armatureAfter: { s: g.nodes[armIdx].scale, t: g.nodes[armIdx].translation },
  accessorsKept: accOld.length, bufferViewsKept: bvOld.length,
  sparseAccessorsKept: g.accessors.filter(a => a.sparse).length,
  morphTargets: (g.meshes[0].primitives[0].targets || []).length,
  targetNames: g.meshes[0].extras && g.meshes[0].extras.targetNames,
}, null, 1));
