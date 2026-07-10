#!/usr/bin/env node
/**
 * ota-publish.mjs — build, upload and register a self-hosted OTA JS bundle.
 *
 * Ships a JS/UI-only change to installed Android apps without a store reinstall.
 * It is deliberately conservative and refuses to publish if the change since the
 * last store build touched any NATIVE surface (see the diff guard) — such a
 * change must go through the Play Store, not OTA.
 *
 * Pipeline:
 *   1. Diff guard  — abort if native paths changed since --since <ref>.
 *   2. Bundle      — react-native bundle (plain JS + assets).
 *   3. Hermes      — compile to bytecode with the RN-pinned hermesc (guarantees
 *                    bytecode-version match with the installed binary).
 *   4. Hash + S3   — sha256 the .hbc, upload to S3 (served via CloudFront).
 *   5. Register    — POST /api/v1/creator/ota/releases (creator-auth).
 *
 * Usage:
 *   node tools/ota-publish.mjs \
 *     --since <git-ref-of-last-store-build> \
 *     [--runtime 1.4] [--bundle-version N] [--notes "..."] [--mandatory]
 *
 * Config (flags override env):
 *   --backend   / EPOCHEYE_BACKEND_URL     backend base URL (required)
 *   --token     / EPOCHEYE_CREATOR_TOKEN   creator JWT for the admin endpoint (required)
 *               / OTA_S3_BUCKET            default: epocheye-glb-models
 *               / OTA_CDN_BASE             default: https://d2d3syfid51acn.cloudfront.net
 *
 * The runtime version defaults to OTA_RUNTIME_VERSION read from
 * android/app/build.gradle — it MUST match the installed binary. Bump it there
 * (and ship a store build) only when native code changes.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { platform } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, '..');

// ---- arg parsing --------------------------------------------------------------
const args = parseArgs(process.argv.slice(2));
const BACKEND = (args.backend || process.env.EPOCHEYE_BACKEND_URL || '').replace(/\/$/, '');
const TOKEN = args.token || process.env.EPOCHEYE_CREATOR_TOKEN || '';
const BUCKET = process.env.OTA_S3_BUCKET || 'epocheye-glb-models';
const CDN_BASE = (process.env.OTA_CDN_BASE || 'https://d2d3syfid51acn.cloudfront.net').replace(/\/$/, '');
const PLATFORM = 'android'; // v1 is Android-only
const NOTES = args.notes || '';
const MANDATORY = !!args.mandatory;

if (!BACKEND) fail('Missing backend URL. Pass --backend or set EPOCHEYE_BACKEND_URL.');
if (!TOKEN) fail('Missing creator token. Pass --token or set EPOCHEYE_CREATOR_TOKEN.');

const RUNTIME = args.runtime || readRuntimeVersionFromGradle();
if (!RUNTIME) fail('Could not determine runtime version. Pass --runtime.');

// ---- 1. diff guard ------------------------------------------------------------
// Any change to native code or dependencies since the last store build means the
// installed binary can't safely run this JS — refuse and tell the operator to
// ship a store build instead.
const NATIVE_PATTERNS = [/^android\//, /^ios\//, /^package\.json$/, /^package-lock\.json$/, /^yarn\.lock$/, /^react-native\.config\.js$/];
if (args.since) {
  const changed = git(['diff', '--name-only', `${args.since}..HEAD`])
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean);
  const offenders = changed.filter(f => NATIVE_PATTERNS.some(re => re.test(f)));
  if (offenders.length) {
    fail(
      'Native/dependency changes detected since ' + args.since + ' — this must ' +
      'ship as a STORE build, not OTA. Offending paths:\n  ' + offenders.join('\n  '),
    );
  }
  log(`Diff guard OK — ${changed.length} changed file(s), none native.`);
} else if (!args.yes) {
  fail('No --since <ref> given, so the native-safety guard is SKIPPED. Re-run with --since <last-store-build-ref>, or --yes to bypass (not recommended).');
} else {
  log('WARNING: native-safety diff guard bypassed (--yes).');
}

// ---- 2. bundle ----------------------------------------------------------------
const OUT = join(REPO, 'build', 'ota');
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const plainBundle = join(OUT, 'index.android.bundle.js');
const assetsDest = join(OUT, 'assets');
mkdirSync(assetsDest, { recursive: true });

log('Bundling JS…');
run('npx', [
  'react-native', 'bundle',
  '--platform', 'android',
  '--dev', 'false',
  '--entry-file', 'index.js',
  '--bundle-output', plainBundle,
  '--assets-dest', assetsDest,
  // Hermes compiles to bytecode, so JS minification is redundant — mirror RN's
  // own Hermes release path, which leaves metro minify off.
  '--minify', 'false',
]);

// ---- 3. hermes compile --------------------------------------------------------
const hermesc = resolveHermesc();
const hbc = join(OUT, 'index.android.bundle'); // the file we ship + load
log('Compiling to Hermes bytecode…');
run(hermesc, ['-emit-binary', '-O', '-out', hbc, plainBundle]);
if (!existsSync(hbc)) fail('Hermes compile produced no output.');

// ---- 4. hash + upload ---------------------------------------------------------
const sha256 = createHash('sha256').update(readFileSync(hbc)).digest('hex');
const bundleVersion = args['bundle-version']
  ? parseInt(args['bundle-version'], 10)
  : await nextBundleVersion();
const s3Key = `ota/${PLATFORM}/${RUNTIME}/${bundleVersion}/index.android.bundle`;
const bundleUrl = `${CDN_BASE}/${s3Key}`;

log(`Uploading to s3://${BUCKET}/${s3Key} …`);
run('aws', [
  's3', 'cp', hbc, `s3://${BUCKET}/${s3Key}`,
  '--content-type', 'application/octet-stream',
  '--cache-control', 'public,max-age=31536000,immutable',
]);

// ---- 5. register --------------------------------------------------------------
log('Registering release with backend…');
const res = await fetch(`${BACKEND}/api/v1/creator/ota/releases`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
  body: JSON.stringify({
    platform: PLATFORM,
    runtime_version: RUNTIME,
    bundle_version: bundleVersion,
    bundle_url: bundleUrl,
    bundle_sha256: sha256,
    mandatory: MANDATORY,
    notes: NOTES,
  }),
});
if (!res.ok) {
  const body = await res.text().catch(() => '');
  fail(`Register failed: HTTP ${res.status} ${body}`);
}

log('');
log('✅ OTA release published.');
log(`   platform=${PLATFORM} runtime=${RUNTIME} bundle_version=${bundleVersion}`);
log(`   url=${bundleUrl}`);
log(`   sha256=${sha256}`);

// ---- helpers ------------------------------------------------------------------
// Ask the backend for the current max bundle_version for this platform+runtime,
// and return the next one. Prefer passing --bundle-version for determinism.
async function nextBundleVersion() {
  try {
    const r = await fetch(`${BACKEND}/api/v1/creator/ota/releases?platform=${PLATFORM}`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const parsed = await r.json();
    const rels = Array.isArray(parsed.releases) ? parsed.releases : [];
    const versions = rels
      .filter(x => x.platform === PLATFORM && x.runtime_version === RUNTIME)
      .map(x => Number(x.bundle_version) || 0);
    return (versions.length ? Math.max(...versions) : 0) + 1;
  } catch {
    fail('Could not auto-compute bundle_version. Pass --bundle-version <N> explicitly.');
    return 0; // unreachable
  }
}

function readRuntimeVersionFromGradle() {
  try {
    const gradle = readFileSync(join(REPO, 'android', 'app', 'build.gradle'), 'utf8');
    // Matches: buildConfigField "String", "OTA_RUNTIME_VERSION", "\"1.4\""
    // Anchored on the field syntax so it can't match a nearby comment mention.
    const m = gradle.match(/OTA_RUNTIME_VERSION"\s*,\s*"\\"([0-9][0-9.]*)/);
    return m ? m[1] : '';
  } catch {
    return '';
  }
}

function resolveHermesc() {
  const base = join(REPO, 'node_modules', 'react-native', 'sdks', 'hermesc');
  const p = platform();
  const bin =
    p === 'win32' ? join(base, 'win64-bin', 'hermesc.exe')
    : p === 'darwin' ? join(base, 'osx-bin', 'hermesc')
    : join(base, 'linux64-bin', 'hermesc');
  if (!existsSync(bin)) fail(`hermesc not found at ${bin}`);
  return bin;
}

function git(a) {
  return execFileSync('git', a, { cwd: REPO, encoding: 'utf8' });
}

function run(cmd, a) {
  execFileSync(cmd, a, { cwd: REPO, stdio: 'inherit', shell: platform() === 'win32' });
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) { out[key] = next; i++; }
      else out[key] = true;
    }
  }
  return out;
}

function log(m) { console.log(m); }
function fail(m) { console.error('ota-publish: ' + m); process.exit(1); }
