/**
 * Compute ACTUAL skinned vertex positions, the way a renderer does.
 *
 * The static bounding box Filament reports is the bind pose and says nothing about what
 * skinning produces. royal8 reported a perfect 1.700 m box and rendered as a giant sheet.
 * So do the real sum:
 *
 *     v' = SUM_i  w_i * (jointGlobal_i * inverseBindMatrix_i) * v
 *
 * and report the bounding box of the result. A correct figure stays ~1.7 m.
 */
import fs from 'fs';

function load(f) {
  const raw = fs.readFileSync(f);
  let p = 12, g = null, bin = null;
  while (p < raw.length) {
    const l = raw.readUInt32LE(p), t = raw.readUInt32LE(p + 4);
    const b = raw.subarray(p + 8, p + 8 + l);
    if (t === 0x4e4f534a) g = JSON.parse(b.toString('utf8'));
    else if (t === 0x004e4942) bin = b;
    p += 8 + l + ((4 - (l % 4)) % 4);
  }
  return { g, bin };
}

const NUM = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
const CW = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };

function elem(g, bin, ai, idx) {
  const a = g.accessors[ai], bv = g.bufferViews[a.bufferView];
  const n = NUM[a.type], w = CW[a.componentType];
  const off = (bv.byteOffset || 0) + (a.byteOffset || 0) + idx * n * w;
  const out = [];
  for (let c = 0; c < n; c++) {
    const o = off + c * w;
    out.push(
      a.componentType === 5126 ? bin.readFloatLE(o)
      : a.componentType === 5123 ? bin.readUInt16LE(o)
      : a.componentType === 5121 ? bin.readUInt8(o)
      : bin.readUInt32LE(o));
  }
  return out;
}

function trs(t, q, s) {
  const [x, y, z, w] = q;
  return [
    (1 - 2 * (y * y + z * z)) * s[0], 2 * (x * y + z * w) * s[0], 2 * (x * z - y * w) * s[0], 0,
    2 * (x * y - z * w) * s[1], (1 - 2 * (x * x + z * z)) * s[1], 2 * (y * z + x * w) * s[1], 0,
    2 * (x * z + y * w) * s[2], 2 * (y * z - x * w) * s[2], (1 - 2 * (x * x + y * y)) * s[2], 0,
    t[0], t[1], t[2], 1,
  ];
}
const mul = (a, b) => { // apply a then b
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++)
    for (let k = 0; k < 4; k++) o[c * 4 + r] += b[k * 4 + r] * a[c * 4 + k];
  return o;
};
const xform = (m, v) => [
  m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12],
  m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13],
  m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14],
];

function report(f) {
  const { g, bin } = load(f);
  const parent = new Map();
  g.nodes.forEach((n, i) => (n.children || []).forEach(c => parent.set(c, i)));
  const local = i => {
    const n = g.nodes[i];
    return trs(n.translation || [0, 0, 0], n.rotation || [0, 0, 0, 1], n.scale || [1, 1, 1]);
  };
  const world = i => {
    let m = local(i), p = parent.get(i);
    while (p !== undefined) { m = mul(m, local(p)); p = parent.get(p); }
    return m;
  };

  const skin = g.skins[0];
  const ibmAcc = skin.inverseBindMatrices;
  const joints = skin.joints;

  // jointMatrix_i = jointGlobal_i * IBM_i   (bind pose, no animation applied)
  const jm = joints.map((j, i) => {
    const ibm = elem(g, bin, ibmAcc, i);
    return mul(ibm, world(j));   // apply IBM first, then the joint's global transform
  });

  const pr = g.meshes[0].primitives[0];
  const n = g.accessors[pr.attributes.POSITION].count;
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  let worst = 0, worstIdx = -1;
  for (let i = 0; i < n; i += 13) {
    const v = elem(g, bin, pr.attributes.POSITION, i);
    const J = elem(g, bin, pr.attributes.JOINTS_0, i);
    const W = elem(g, bin, pr.attributes.WEIGHTS_0, i);
    const acc = [0, 0, 0];
    for (let k = 0; k < 4; k++) {
      if (W[k] === 0) continue;
      const p = xform(jm[J[k]], v);
      acc[0] += p[0] * W[k]; acc[1] += p[1] * W[k]; acc[2] += p[2] * W[k];
    }
    for (let c = 0; c < 3; c++) { if (acc[c] < lo[c]) lo[c] = acc[c]; if (acc[c] > hi[c]) hi[c] = acc[c]; }
    const mag = Math.max(...acc.map(Math.abs));
    if (mag > worst) { worst = mag; worstIdx = i; }
  }
  console.log(JSON.stringify({
    file: f.split(/[\\/]/).pop(),
    skinnedBBox_lo: lo.map(v => +v.toFixed(3)),
    skinnedBBox_hi: hi.map(v => +v.toFixed(3)),
    skinnedExtent_m: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]].map(v => +v.toFixed(3)),
    worstAbsCoord_m: +worst.toFixed(2), worstVertex: worstIdx,
    verdict: (hi[1] - lo[1]) > 3 || worst > 5 ? 'EXPLODED' : 'plausible',
  }));
}

for (const f of process.argv.slice(2)) report(f);
