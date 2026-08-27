/**
 * A grep-shaped guard against re-introducing a native crash that has no JS stack trace.
 *
 * WHAT HAPPENED. `probeMorphTargets` in EpocheyeDetectARView.kt called
 * `FilamentAsset.getMorphTargetNames()` to bind visemes by name instead of by order —
 * which reads better, and segfaulted the app on every journey start:
 *
 *     F libc : Fatal signal 11 (SIGSEGV), code 2 (SEGV_ACCERR)
 *     #00 pc 000000000019f82c  libgltfio-jni.so
 *
 * glTF keeps morph-target names in `mesh.extras.targetNames`, which lives in the parsed
 * SOURCE data. SceneView's ModelLoader calls `FilamentAsset.releaseSourceData()` the
 * moment a model finishes loading (four call sites in
 * io.github.sceneview.loaders.ModelLoader), so by the time our code runs those names
 * have been freed. Reading them is a use-after-free.
 *
 * WHY A TEST AND NOT JUST A COMMENT. The failure is a native SIGSEGV: no Java
 * exception, no JS error, nothing in the RN redbox — the process simply dies. Neither
 * `tsc`, nor eslint, nor the Kotlin compiler can see it, and it only reproduces on a
 * device with a model that actually has morph targets. A comment explaining the trap is
 * exactly the kind of thing a future edit reverts in good faith ("we should read the
 * names, not assume the order"). This makes that revert fail in CI instead of in a
 * visitor's hands at the palace.
 */
import fs from 'fs';
import path from 'path';

const NATIVE_AR = path.join(
  __dirname,
  '..',
  '..',
  'android',
  'app',
  'src',
  'main',
  'java',
  'com',
  'epocheye',
  'ar',
  'EpocheyeDetectARView.kt',
);

describe('morph-target safety in the native AR view', () => {
  const source = fs.readFileSync(NATIVE_AR, 'utf8');

  it('never calls getMorphTargetNames — it reads freed source data', () => {
    // Strip comments first, so the explanation of the trap does not trip the guard.
    const code = source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    expect(code).not.toContain('getMorphTargetNames');
  });

  it('binds visemes by count, using the live renderable rather than the asset', () => {
    // getMorphTargetCount lives on RenderableManager and reads the renderable, which
    // stays valid for as long as the model is on screen.
    expect(source).toContain('getMorphTargetCount');
  });

  it('refuses to drive the mouth when the track and the model disagree', () => {
    // A silently wrong mouth is worse than a still one, so a count mismatch must
    // disable the binding rather than pair whatever happens to line up.
    expect(source).toContain('VISEME track/model mismatch');
  });
});
