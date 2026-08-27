/**
 * Guards against a native crash that no JS or Kotlin tooling can see.
 *
 * WHAT HAPPENED (2026-08-26). Exiting the AR journey killed the app:
 *
 *     F libc : Fatal signal 11 (SIGSEGV), code 1 (SEGV_MAPERR), addr 0x616c2f6176616a4c
 *     #03 RenderableManager.getMaterialInstanceAt
 *     #23 ImageNode.destroy
 *     #28 EpocheyeDetectARView.removeAllCardNodes
 *
 * SceneView's `ImageNode.destroy()` reads its material instance BEFORE any of its own
 * guards run, and Filament's `Engine.getRenderableManager()` is an unchecked field read.
 * `Engine.destroy()` zeroes the Engine's handle but leaves the cached RenderableManager
 * holding a stale native pointer — so destroying a node after the Compose composition has
 * disposed walks freed memory. The fault address is ASCII ("Ljava/la…"), a reused arena.
 *
 * WHY A TEST AND NOT JUST A COMMENT. A native SIGSEGV is invisible to `tsc`, eslint,
 * `kotlinc` and the RN redbox — the process simply dies, with no stack in any log JS can
 * read. It only reproduces on a device, on teardown, which is the least-tested moment in
 * any app. Worse, the obvious defensive move — wrapping `destroy()` in
 * `try { … } catch (_: Throwable) {}` — LOOKS like a fix and catches nothing, because a
 * segfault is not a Java Throwable. That trap is exactly what was already in the code.
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

const source = fs.readFileSync(NATIVE_AR, 'utf8');
/** Comments explain the trap; only real code should be able to trip these checks. */
const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('AR card teardown safety', () => {
  it('routes every scene-node destroy through the guarded helper', () => {
    // Any bare `.destroy()` on a node outside destroyNodeSafely re-opens the crash.
    // The helper itself contains the single legitimate `node.destroy()` call.
    const bare = code.match(/^\s*\w+(\.\w+)*\.destroy\(\)/gm) ?? [];
    // Exactly one: the call inside destroyNodeSafely.
    expect(bare.length).toBeLessThanOrEqual(1);
    expect(code).toContain('private fun destroyNodeSafely');
  });

  it('checks the Filament engine is still valid before destroying anything', () => {
    // Engine.isValid() exists in Filament 1.71.5 and is the only way to know the
    // native peer survived composition disposal.
    expect(code).toContain('eng.isValid');
  });

  it('checks the renderable component still exists', () => {
    // Catches the other path: a node orphaned by rebuildARNow, whose entity is gone
    // while the engine is fine. getInstance() would return 0 and read out of bounds.
    expect(code).toContain('hasComponent');
  });

  it('frees card nodes BEFORE the composition (and therefore the engine) is disposed', () => {
    // rebuildARNow used to removeView() — disposing the Engine — while cardNodes still
    // held live ImageNodes. The teardown ordering is the fix, so assert the order.
    const fn = code.slice(code.indexOf('private fun rebuildARNow'));
    const body = fn.slice(0, fn.indexOf('setupAR()'));
    const freeAt = body.indexOf('removeAllCardNodes');
    const disposeAt = body.indexOf('removeView');
    expect(freeAt).toBeGreaterThanOrEqual(0);
    expect(disposeAt).toBeGreaterThanOrEqual(0);
    expect(freeAt).toBeLessThan(disposeAt);
  });

  it('never mutates card nodes off the main thread', () => {
    // attachCard destroys and rebuilds nodes; called inline from modelScope.launch
    // (Dispatchers.Default) it raced the billboard loop over an unsynchronised list.
    expect(code).toContain('post { attachCard(');
  });
});
