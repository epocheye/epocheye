/**
 * GLBViewer — inline 3D preview for reconstructed monument objects.
 *
 * Loads a remote GLB via three.js' GLTFLoader and renders it inside a
 * @react-three/fiber/native Canvas. When `interactive` is true, mounts
 * @react-three/drei's OrbitControls (lazy-loaded) for drag-rotate and
 * pinch-zoom.
 *
 * Requires the native Expo GL context (expo-gl + expo-modules-core). When the
 * context is unavailable — e.g. the bundle is running before a native
 * rebuild — the viewer renders a small fallback and calls onError so the
 * caller can surface the Scene Viewer link instead.
 */

import React, { Component, Suspense, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Text,
  View,
} from 'react-native';
import '@react-three/fiber';
import { Canvas, useFrame, useLoader } from '@react-three/fiber/native';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { Group, Object3D } from 'three';

interface GLBViewerProps {
  url: string;
  autoRotate?: boolean;
  interactive?: boolean;
  onLoad?: () => void;
  onError?: (error: Error) => void;
}

interface GLBSceneProps {
  url: string;
  autoRotate: boolean;
  onLoad?: () => void;
  onFirstFrame?: () => void;
}

const GLBScene: React.FC<GLBSceneProps> = ({ url, autoRotate, onLoad, onFirstFrame }) => {
  const gltf = useLoader(GLTFLoader, url) as unknown as { scene: Group };
  const groupRef = useRef<Object3D | null>(null);
  const firstFrameReportedRef = useRef(false);

  useEffect(() => {
    console.log('[GLBViewer] scene-loaded', url);
    onLoad?.();
  }, [onLoad, url]);

  useFrame((_, delta) => {
    if (!firstFrameReportedRef.current) {
      firstFrameReportedRef.current = true;
      console.log('[GLBViewer] first-frame');
      onFirstFrame?.();
    }
    if (autoRotate && groupRef.current) {
      groupRef.current.rotation.y += delta * 0.4;
    }
  });

  return (
    <primitive
      ref={groupRef}
      object={gltf.scene}
      scale={1.2}
      position={[0, -0.3, 0]}
    />
  );
};

// Inner boundary that runs INSIDE Suspense so we can capture the real
// GLTFLoader throw (network / parse) and report it upward, rather than
// having the outer boundary swallow it as a generic "unavailable".
interface InnerBoundaryProps {
  onError: (err: Error) => void;
  children: React.ReactNode;
}
interface InnerBoundaryState { crashed: boolean }

class GLBSceneErrorBoundary extends Component<InnerBoundaryProps, InnerBoundaryState> {
  state: InnerBoundaryState = { crashed: false };
  static getDerivedStateFromError() { return { crashed: true }; }
  componentDidCatch(error: Error) {
    console.log('[GLBViewer] error', error?.message, error?.stack);
    this.props.onError(error);
  }
  render() {
    return this.state.crashed ? null : this.props.children;
  }
}

// Lazy holder for drei's OrbitControls. Resolved on first render of an
// interactive viewer so the production bundle path (auto-rotate-only)
// never evaluates drei or its react-spring/etc. transitive peers.
let DreiOrbitControls: React.ComponentType<Record<string, unknown>> | null = null;
let dreiLoadAttempted = false;
let dreiLoadFailed = false;

async function ensureDrei(): Promise<void> {
  if (dreiLoadAttempted) return;
  dreiLoadAttempted = true;
  try {
    const mod = await import('@react-three/drei/native');
    DreiOrbitControls = (mod as { OrbitControls?: React.ComponentType<Record<string, unknown>> }).OrbitControls ?? null;
    if (!DreiOrbitControls) {
      dreiLoadFailed = true;
      console.warn('[GLBViewer] drei loaded but OrbitControls export missing');
    }
  } catch (err) {
    dreiLoadFailed = true;
    console.warn('[GLBViewer] drei import failed — falling back to auto-rotate', (err as Error)?.message);
  }
}

const InteractiveControls: React.FC = () => {
  const [, setReady] = useState(0);
  useEffect(() => {
    let cancelled = false;
    ensureDrei().then(() => {
      if (!cancelled) setReady(n => n + 1);
    });
    return () => { cancelled = true; };
  }, []);
  if (!DreiOrbitControls || dreiLoadFailed) return null;
  return <DreiOrbitControls enablePan={false} enableZoom={true} enableRotate={true} />;
};

const GLBViewer: React.FC<GLBViewerProps> = ({
  url,
  autoRotate = true,
  interactive = false,
  onLoad,
  onError,
}) => {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    console.log('[GLBViewer] url', url);
  }, [url]);

  if (failed) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text className="text-grey-muted text-[13px] font-ui-medium">
          3D preview unavailable
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 w-full">
      <Canvas
        style={{ flex: 1, backgroundColor: 'transparent' }}
        camera={{ position: [0, 0.4, 2.4], fov: 45 }}
        onCreated={() => {
          console.log('[GLBViewer] canvas-created');
        }}
      >
        <ambientLight intensity={0.8} />
        <directionalLight position={[4, 5, 5]} intensity={0.9} />
        <directionalLight position={[-3, 2, -4]} intensity={0.35} />
        <Suspense fallback={null}>
          <GLBSceneErrorBoundary
            onError={(err) => {
              setFailed(true);
              onError?.(err);
            }}
          >
            <GLBScene
              url={url}
              autoRotate={autoRotate && !interactive}
              onLoad={onLoad}
              onFirstFrame={() => setLoaded(true)}
            />
            {interactive ? <InteractiveControls /> : null}
          </GLBSceneErrorBoundary>
        </Suspense>
      </Canvas>
      {!loaded ? (
        <LoadingFallback
          onTimeout={() => {
            setFailed(true);
            const err = new Error('GLB viewer timed out');
            console.log('[GLBViewer] error', err.message);
            onError?.(err);
          }}
        />
      ) : null}
    </View>
  );
};

const LoadingFallback: React.FC<{ onTimeout: () => void }> = ({ onTimeout }) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setVisible(false), 3500);
    const giveUpTimer = setTimeout(onTimeout, 15_000);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(giveUpTimer);
    };
  }, [onTimeout]);

  if (!visible) {
    return null;
  }

  return (
    <View className="absolute inset-0 items-center justify-center gap-y-2" pointerEvents="none">
      <ActivityIndicator color="#CBA862" />
      <Text className="text-accent-amber text-[13px] font-ui-medium">
        Loading 3D model…
      </Text>
    </View>
  );
};

export default GLBViewer;
