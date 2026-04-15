/**
 * segmentationService — on-device TFLite segmentation model lifecycle.
 *
 * Owns loading, readiness tracking, and disposal of the SAM-style
 * segmentation model used by the Lens screen's Scan Object overlay.
 *
 * Inference itself does NOT live here: it happens inline inside the
 * VisionCamera frame processor worklet by calling `model.runSync(...)`
 * on the handle returned by `getModel()`. Exposing a Promise-returning
 * runInference API would force a JS-thread round-trip per frame via
 * runOnJS, defeating the point of worklet-native execution.
 *
 * The bundled `sam_segment.tflite` is DeepLab v3 (257x257, PASCAL VOC
 * 21 classes). If the asset is missing or corrupt, `initialize()`
 * silently fails, leaves `ready=false`, and the Lens screen keeps
 * working without the overlay.
 */

import {
  loadTensorflowModel,
  type TensorflowModel,
} from 'react-native-fast-tflite';

type ReadyListener = (ready: boolean) => void;

let model: TensorflowModel | null = null;
let ready = false;
let initializing: Promise<void> | null = null;
const listeners = new Set<ReadyListener>();

export async function initialize(): Promise<void> {
  if (ready || initializing) {
    return initializing ?? Promise.resolve();
  }

  initializing = (async () => {
    try {
      const asset = require('../assets/models/sam_segment.tflite');
      const loaded = await loadTensorflowModel(asset);
      model = loaded;
      ready = true;
      listeners.forEach(cb => cb(true));
    } catch (err) {
      if (__DEV__) {
        console.warn(
          '[segmentationService] model load failed — overlay disabled',
          err,
        );
      }
      model = null;
      ready = false;
    } finally {
      initializing = null;
    }
  })();

  return initializing;
}

/**
 * Worklet-safe accessor. Returns the JSI host object for the loaded
 * TensorflowModel, or null when the model isn't ready.
 *
 * Safe to call from a frame processor worklet: Reanimated's babel
 * plugin copies this function into the worklet runtime, and the
 * module-level `model` variable holds a JSI handle that's visible
 * to both runtimes.
 */
export function getModel(): TensorflowModel | null {
  'worklet';
  return model;
}

export function isReady(): boolean {
  return ready;
}

/**
 * Subscribe to readiness changes. Useful so React components can
 * re-render the moment a model finishes loading, instead of waiting
 * for an unrelated state change. Fires the callback immediately if
 * the service is already ready.
 *
 * Returns an unsubscribe function.
 */
export function subscribeReady(cb: ReadyListener): () => void {
  listeners.add(cb);
  if (ready) {
    cb(true);
  }
  return () => {
    listeners.delete(cb);
  };
}

export function dispose(): void {
  // fast-tflite has no explicit close(); dropping the reference lets
  // its native resources get released on GC. Flipping `ready` gates
  // the frame processor and the overlay on the very next tick.
  model = null;
  ready = false;
  initializing = null;
  listeners.forEach(cb => cb(false));
}
