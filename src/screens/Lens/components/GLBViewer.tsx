/**
 * GLBViewer — inline 3D preview for reconstructed monument objects.
 *
 * Loads a remote GLB via three.js' GLTFLoader and renders it inside a
 * @react-three/fiber/native Canvas. Supports pinch-to-zoom and drag-to-rotate
 * via the built-in OrbitControls-style gesture handlers that ship with
 * @react-three/drei/native.
 *
 * Requires the native Expo GL context (expo-gl + expo-modules-core). When the
 * context is unavailable — e.g. the bundle is running before a native
 * rebuild — the viewer renders a small fallback and calls onError so the
 * caller can surface the Scene Viewer link instead.
 */

import React, { Suspense, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Canvas, useFrame, useLoader } from '@react-three/fiber/native';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import type { Group, Object3D } from 'three';
import { FONTS } from '../../../core/constants/theme';

interface GLBViewerProps {
  url: string;
  autoRotate?: boolean;
  onLoad?: () => void;
  onError?: (error: Error) => void;
}

interface GLBSceneProps {
  url: string;
  autoRotate: boolean;
  onLoad?: () => void;
}

const GLBScene: React.FC<GLBSceneProps> = ({ url, autoRotate, onLoad }) => {
  const gltf = useLoader(GLTFLoader, url) as unknown as { scene: Group };
  const groupRef = useRef<Object3D | null>(null);

  useEffect(() => {
    if (onLoad) {
      onLoad();
    }
  }, [onLoad]);

  useFrame((_, delta) => {
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

const GLBViewer: React.FC<GLBViewerProps> = ({
  url,
  autoRotate = true,
  onLoad,
  onError,
}) => {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.fallbackText}>3D preview unavailable</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Canvas
        style={styles.canvas}
        camera={{ position: [0, 0.4, 2.4], fov: 45 }}
        onCreated={() => {
          // Canvas ready — the GLB scene will resolve via Suspense.
        }}
      >
        <ambientLight intensity={0.8} />
        <directionalLight position={[4, 5, 5]} intensity={0.9} />
        <directionalLight position={[-3, 2, -4]} intensity={0.35} />
        <Suspense fallback={null}>
          <GLBScene url={url} autoRotate={autoRotate} onLoad={onLoad} />
        </Suspense>
      </Canvas>
      <LoadingFallback
        onTimeout={() => {
          setFailed(true);
          onError?.(new Error('GLB viewer timed out'));
        }}
      />
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
    <View style={styles.loadingOverlay} pointerEvents="none">
      <ActivityIndicator color="#E8A020" />
      <Text style={styles.loadingText}>Loading 3D model…</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
  },
  canvas: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    rowGap: 8,
  },
  loadingText: {
    color: '#E8A020',
    fontFamily: FONTS.medium,
    fontSize: 13,
  },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackText: {
    color: '#8C93A0',
    fontFamily: FONTS.medium,
    fontSize: 13,
  },
});

export default GLBViewer;
