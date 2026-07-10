# OTA (over-the-air) JS updates — runbook

Self-hosted, Expo-free system for shipping **JS/UI-only** changes to installed
Android apps without a Play Store reinstall. Backend + S3/CloudFront are our own.

> **The one rule:** OTA ships the **entire JS bundle**. Only publish an OTA when
> your change is **JS/TS-only** — no native code, no native dependency, no new
> local bundled asset. Everything else goes through the Play Store. The publish
> script enforces this (see the diff guard), but understand *why*: the installed
> binary's native side is frozen; JS is all we can swap.

## What can / can't ship via OTA

| ✅ OTA-safe (JS-only) | ❌ Store build required |
| --- | --- |
| Layout, styling, NativeWind classes | Any `android/` or `ios/` native change (AR/SceneView/ARKit) |
| Copy / i18n (`src/i18n/locales/*`) | Adding/upgrading any native npm dep |
| New screens from **existing** components | New local bundled asset (font, SVG, image) |
| JS/TS logic + bug fixes | Permissions, icon, splash, `versionCode` |
| — | Firebase/TFLite/Razorpay native, RN upgrade |

New local assets are excluded because they wouldn't exist in the installed APK.
Monument images are CDN-based, so typical UI tweaks are fine.

## How it works

- **runtime_version** (`OTA_RUNTIME_VERSION` in `android/app/build.gradle`, currently
  `1.4`) pins Hermes-bytecode compatibility. The client only fetches/accepts a
  bundle whose `runtime_version` equals the constant baked into its binary.
  **Bump it only when you ship a native/store build.**
- **bundle_version** is a monotonic integer per `(platform, runtime_version)`. The
  client sends its current one; the manifest returns the highest active one above it.
- Native (`MainApplication.kt`) loads a downloaded bundle via
  `getDefaultReactHost(jsBundleFilePath = …)`. A downloaded bundle is tried as
  *pending*; once the app boots healthily JS confirms it (→ *confirmed*). A pending
  bundle that crashes before confirm **auto-rolls-back** to the previous bundle.
- Integrity (v1): **HTTPS + SHA-256**. No code signing yet (planned v2).

## Publish a JS-only update

```bash
# from E:\epocheye
node tools/ota-publish.mjs \
  --since <git-ref-of-the-last-store-build> \
  --backend https://<backend-host> \
  --token  <creator-JWT> \
  --notes  "What changed (shown in the Restart banner)"
```

- `--since` is the git ref of the build users currently have installed. The script
  **refuses to publish** if anything native changed since then.
- `--bundle-version` is auto-computed (max+1) from the backend; pass it explicitly
  for determinism.
- `--mandatory` marks the release (reserved for future forced-apply UX).
- Env alternatives: `EPOCHEYE_BACKEND_URL`, `EPOCHEYE_CREATOR_TOKEN`,
  `OTA_S3_BUCKET` (default `epocheye-glb-models`), `OTA_CDN_BASE`
  (default `https://d2d3syfid51acn.cloudfront.net`).

The script: diff-guards → `react-native bundle` → **RN-pinned hermesc** → sha256 →
`aws s3 cp` to `ota/android/<runtime>/<version>/index.android.bundle` → POST
`/api/v1/creator/ota/releases`.

## Roll back a bad release

Deactivate it — the manifest then serves the previous active release, and clients
fall back on next check:

```bash
curl -X PATCH https://<backend>/api/v1/creator/ota/releases/<id> \
  -H "Authorization: Bearer <creator-JWT>" \
  -H "Content-Type: application/json" -d '{"active": false}'
```

Already-applied clients also self-heal: if the new bundle crashes on boot, the
native guard reverts to the prior confirmed bundle automatically.

List releases: `GET /api/v1/creator/ota/releases?platform=android` (creator-auth).

## Shipping a native (store) build — checklist

1. Bump `versionCode` / `versionName` in `android/app/build.gradle` as usual.
2. If native code or deps changed, **bump `OTA_RUNTIME_VERSION`** (e.g. `1.4` → `1.5`).
   This isolates the new binary from OTA bundles built for the old runtime.
3. Build + upload the AAB to Play.
4. The first OTA for the new binary starts a fresh `bundle_version` sequence under
   the new `runtime_version`.

## Endpoints

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/v1/ota/manifest?platform&runtime_version&current_version` | public | client check (fail-safe) |
| POST | `/api/v1/creator/ota/releases` | creator | publish (used by the script) |
| GET | `/api/v1/creator/ota/releases` | creator | list |
| PATCH | `/api/v1/creator/ota/releases/{id}` | creator | activate/deactivate (rollback) |

## v2 follow-ups

Ed25519 bundle signing · iOS support · OTA of new local assets · staged rollout %.
