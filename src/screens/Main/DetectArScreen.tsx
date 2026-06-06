/**
 * DetectArScreen — detector-driven world-anchored AR.
 *
 * Two render paths, chosen by native availability:
 *
 *  • Native AR (W2/W3, ARCore devices): mounts the fresh `EpocheyeDetectARView`.
 *    W2 = tap a floor plane to anchor the test GLB; it stays world-locked as you
 *    walk around. W3 adds detector-driven auto-placement. Yaw nudge for manual
 *    alignment. Placement is gated on camera TRACKING.
 *
 *  • 2D fallback (no ARCore / W1 validation): vision-camera + Detect button that
 *    runs the Roboflow hosted detector (or mock) and draws the top box. Proves
 *    the inference wiring with no AR involved.
 *
 * Reached from Settings → DEV (DevLoadTestArModelButton), __DEV__-gated.
 */

import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  GestureResponderEvent,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {
  Camera,
  RefreshCcw,
  RotateCw,
  ScanSearch,
  Settings as SettingsIcon,
  X,
} from 'lucide-react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {
  Camera as VisionCamera,
  useCameraDevice,
  useCameraPermission,
} from 'react-native-vision-camera';

import EpocheyeDetectARView, {
  isDetectARAvailable,
  type EpocheyeDetectARHandle,
} from '../../native/EpocheyeDetectARView';
import {useARCore} from '../../shared/hooks/useARCore';
import {prepareImageForGemini} from '../../services/geminiVisionService';
import {
  detectObjects,
  isRoboflowConfigured,
  topPrediction,
  type RoboflowPrediction,
} from '../../services/roboflowDetectionService';
import {PermissionService} from '../../shared/services/permission.service';
import type {MainStackParamList} from '../../core/types/navigation.types';

const AMBER = '#E8A020';
const KHRONOS_DUCK_URL =
  'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/Duck/glTF-Binary/Duck.glb';
const YAW_STEP_DEG = 15;

type RouteParam = {
  key: string;
  name: 'DetectAr';
  params: MainStackParamList['DetectAr'];
};

type ARStatus = 'initializing' | 'searching' | 'ready' | 'placed' | 'error';

const DetectArScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const route = useRoute() as unknown as RouteParam;
  const glbUri = route.params?.glbUrl || KHRONOS_DUCK_URL;

  const {hasPermission, requestPermission} = useCameraPermission();
  const {arAvailable, arChecked} = useARCore();
  const permissionRequestedRef = useRef(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

  useEffect(() => {
    if (hasPermission || permissionRequestedRef.current) return;
    permissionRequestedRef.current = true;
    void requestPermission().then(granted => {
      if (!granted) setPermissionDenied(true);
    });
  }, [hasPermission, requestPermission]);

  const handleClose = useCallback(() => navigation.goBack(), [navigation]);

  // Use native AR when the module is registered AND ARCore supports the device
  // (or the support check hasn't completed yet — optimistic until proven false).
  const useNativeAR = isDetectARAvailable && (!arChecked || arAvailable);

  // --- permission gate (shared) ---
  if (!hasPermission) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.fallbackBlock}>
          <Camera size={40} color={AMBER} />
          <Text style={styles.fallbackHeading}>Allow Camera to continue</Text>
          <Text style={styles.fallbackBody}>
            The detector and AR both need the camera. Footage stays on the device.
          </Text>
          {permissionDenied ? (
            <Pressable
              onPress={() => void PermissionService.openAppSettings()}
              style={styles.fallbackButton}>
              <SettingsIcon size={14} color="#1A0F00" />
              <Text style={styles.fallbackButtonText}>Open Settings</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => void requestPermission()}
              style={styles.fallbackButton}>
              <Text style={styles.fallbackButtonText}>Allow Camera</Text>
            </Pressable>
          )}
          <Pressable onPress={handleClose} hitSlop={8}>
            <Text style={styles.fallbackDismiss}>Close</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (useNativeAR) {
    return <DetectARNative glbUri={glbUri} onClose={handleClose} />;
  }
  return <DetectAR2D onClose={handleClose} />;
};

// ============================================================
// Native AR path (W2: tap-to-place, world-locked; W3 adds detect)
// ============================================================

const DetectARNative: React.FC<{glbUri: string; onClose: () => void}> = ({
  glbUri,
  onClose,
}) => {
  const arRef = useRef<EpocheyeDetectARHandle>(null);
  const [status, setStatus] = useState<ARStatus>('initializing');
  const [tracking, setTracking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [detected, setDetected] = useState<{
    label: string;
    confidence: number;
    mock: boolean;
  } | null>(null);

  // Keep `tracking` readable inside the async frame-captured callback without
  // re-subscribing the native listener each time it flips.
  const trackingRef = useRef(false);
  useEffect(() => {
    trackingRef.current = tracking;
  }, [tracking]);

  const handleReady = useCallback(() => {
    setStatus(prev => (prev === 'placed' ? prev : 'searching'));
  }, []);

  // Detect→place: capture an ARCore frame, run the detector, and (if a
  // confident detection lands while TRACKING) place from the bbox base-center.
  const handleDetectAndPlace = useCallback(() => {
    if (detecting) return;
    if (!trackingRef.current) {
      setErrorMessage('Move your phone slowly to scan first');
      return;
    }
    setDetecting(true);
    setErrorMessage('Scanning…');
    // Triggers onFrameCaptured with a file:// uri of the ARCore camera frame.
    arRef.current?.captureFrame();
  }, [detecting]);

  const handleFrameCaptured = useCallback(async (uri: string) => {
    try {
      const base64 = await prepareImageForGemini(uri);
      const result = await detectObjects(base64);
      if (!result.success) {
        setErrorMessage(result.error);
        return;
      }
      const top = topPrediction(result);
      if (!top) {
        setDetected(null);
        setErrorMessage('No object above the confidence gate — move closer');
        return;
      }
      setDetected({label: top.class, confidence: top.confidence, mock: result.mock});
      // Gate: confidence is already above threshold (detectObjects filters it),
      // and the native side re-checks TRACKING before anchoring.
      arRef.current?.placeFromDetection(top.nBaseX, top.nBaseY);
      setErrorMessage(null);
    } catch {
      setErrorMessage('Detection failed — try again');
    } finally {
      setDetecting(false);
    }
  }, []);

  const handleTrackingState = useCallback((state: string) => {
    setTracking(state === 'TRACKING');
  }, []);

  const handlePlaneDetected = useCallback(() => {
    setStatus(prev => (prev === 'placed' ? prev : 'ready'));
  }, []);

  const handleAnchorPlaced = useCallback(() => {
    setStatus('placed');
    setErrorMessage(null);
  }, []);

  const handleError = useCallback((err: string) => {
    // A placement/transform miss during a detect cycle should release the button.
    setDetecting(false);
    // Soft errors (transient placement misses) shouldn't lock the screen.
    if (
      err.includes('no floor') ||
      err.includes('not tracking') ||
      err.includes('move phone') ||
      err.includes('coordinate transform')
    ) {
      setErrorMessage(err);
      return;
    }
    setErrorMessage(err);
    setStatus('error');
  }, []);

  const handleTap = useCallback(
    (event: GestureResponderEvent) => {
      if (!arRef.current) return;
      if (status === 'initializing' || status === 'error') return;
      const {locationX, locationY} = event.nativeEvent;
      arRef.current.placeAtScreenPoint(locationX, locationY);
    },
    [status],
  );

  const handleReset = useCallback(() => {
    arRef.current?.clearAnchor();
    setStatus(prev => (prev === 'placed' ? 'ready' : prev));
  }, []);

  const handleYaw = useCallback(() => {
    arRef.current?.nudgeYaw(YAW_STEP_DEG);
  }, []);

  const hint = useMemo(() => {
    if (status === 'error') {
      return `${errorMessage ?? 'AR error'} · close and reopen to retry`;
    }
    if (!tracking) return 'Move your phone slowly to scan the area';
    if (status === 'searching') return 'Look around at a floor or table';
    if (status === 'ready') return 'Tap a flat surface to place the model';
    if (status === 'placed') {
      return 'Walk around — it stays locked · ⟳ rotate · tap to re-place';
    }
    return 'Starting AR session…';
  }, [status, tracking, errorMessage]);

  return (
    <View style={styles.root}>
      <Pressable style={StyleSheet.absoluteFill} onPress={handleTap}>
        <EpocheyeDetectARView
          ref={arRef}
          style={StyleSheet.absoluteFill}
          glbUri={glbUri}
          onReady={handleReady}
          onTrackingState={handleTrackingState}
          onPlaneDetected={handlePlaneDetected}
          onAnchorPlaced={handleAnchorPlaced}
          onError={handleError}
          onFrameCaptured={handleFrameCaptured}
        />
      </Pressable>

      <SafeAreaView style={styles.topOverlay} edges={['top']} pointerEvents="box-none">
        <View style={styles.topRow} pointerEvents="box-none">
          <Pressable onPress={onClose} hitSlop={12} style={styles.iconButton}>
            <X size={18} color="#FFFFFF" />
          </Pressable>
          <View style={styles.titleBlock}>
            <Text style={styles.title}>Detect → Place AR</Text>
            <Text style={styles.subtitle}>
              {tracking ? 'tracking' : 'scanning'} · world-anchored
            </Text>
          </View>
          <Pressable
            onPress={handleReset}
            hitSlop={12}
            style={[styles.iconButton, status !== 'placed' && styles.iconButtonDisabled]}>
            <RefreshCcw
              size={16}
              color={status === 'placed' ? '#FFFFFF' : 'rgba(255,255,255,0.35)'}
            />
          </Pressable>
        </View>
      </SafeAreaView>

      <SafeAreaView style={styles.bottomOverlay} edges={['bottom']} pointerEvents="box-none">
        <View
          style={[
            styles.messageBubble,
            status === 'ready' && styles.bubbleReady,
            status === 'error' && styles.bubbleError,
          ]}
          pointerEvents="none">
          <Text style={styles.messageText}>{errorMessage ?? hint}</Text>
        </View>

        {detected && (
          <View style={styles.detectedChip} pointerEvents="none">
            <Text style={styles.detectedChipText}>
              {detected.label} · {(detected.confidence * 100).toFixed(0)}%
              {detected.mock ? ' · MOCK' : ''}
            </Text>
          </View>
        )}

        <View style={styles.buttonRow} pointerEvents="box-none">
          <Pressable
            onPress={handleDetectAndPlace}
            disabled={detecting}
            style={[styles.detectButton, detecting && styles.detectButtonBusy]}>
            {detecting ? (
              <ActivityIndicator color="#1A0F00" />
            ) : (
              <>
                <ScanSearch size={18} color="#1A0F00" />
                <Text style={styles.detectButtonText}>Detect &amp; Place</Text>
              </>
            )}
          </Pressable>
          {status === 'placed' && (
            <Pressable onPress={handleYaw} style={styles.roundButton}>
              <RotateCw size={20} color="#1A0F00" />
            </Pressable>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
};

// ============================================================
// 2D fallback path (W1: detector validation, no AR)
// ============================================================

const DetectAR2D: React.FC<{onClose: () => void}> = ({onClose}) => {
  const {width: screenW, height: screenH} = useWindowDimensions();
  const cameraRef = useRef<VisionCamera | null>(null);
  const device = useCameraDevice('back');

  const [busy, setBusy] = useState(false);
  const [prediction, setPrediction] = useState<RoboflowPrediction | null>(null);
  const [isMock, setIsMock] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleDetect = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const photo = await cameraRef.current?.takePhoto();
      if (!photo?.path) {
        setMessage('Could not capture a frame');
        return;
      }
      const base64 = await prepareImageForGemini(photo.path);
      const result = await detectObjects(base64);
      if (!result.success) {
        setPrediction(null);
        setMessage(result.error);
        return;
      }
      const top = topPrediction(result);
      setPrediction(top);
      setIsMock(result.mock);
      setMessage(top ? null : 'No object above the confidence gate — retry');
    } catch {
      setMessage('Detection failed — try again');
    } finally {
      setBusy(false);
    }
  }, [busy]);

  if (!device) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.fallbackBlock}>
          <Text style={styles.fallbackHeading}>No camera available</Text>
          <Pressable onPress={onClose} style={styles.fallbackButton}>
            <Text style={styles.fallbackButtonText}>Close</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const box = prediction
    ? {
        left: (prediction.nCx - prediction.w / prediction.imageW / 2) * screenW,
        top: (prediction.nCy - prediction.h / prediction.imageH / 2) * screenH,
        width: (prediction.w / prediction.imageW) * screenW,
        height: (prediction.h / prediction.imageH) * screenH,
      }
    : null;

  return (
    <View style={styles.root}>
      <VisionCamera
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive
        photo
      />

      {box && prediction && (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <View style={[styles.bbox, box]} />
          <View
            style={[
              styles.baseDot,
              {left: prediction.nBaseX * screenW - 6, top: prediction.nBaseY * screenH - 6},
            ]}
          />
          <View style={[styles.label, {left: box.left, top: Math.max(0, box.top - 26)}]}>
            <Text style={styles.labelText}>
              {prediction.class} · {(prediction.confidence * 100).toFixed(0)}%
            </Text>
          </View>
        </View>
      )}

      <SafeAreaView style={styles.topOverlay} edges={['top']} pointerEvents="box-none">
        <View style={styles.topRow} pointerEvents="box-none">
          <Pressable onPress={onClose} hitSlop={12} style={styles.iconButton}>
            <X size={18} color="#FFFFFF" />
          </Pressable>
          <View style={styles.titleBlock}>
            <Text style={styles.title}>Detector test</Text>
            <Text style={styles.subtitle}>
              {isRoboflowConfigured() ? 'hosted Roboflow' : 'MOCK provider'} · no AR
            </Text>
          </View>
          <View style={styles.iconButton} />
        </View>
      </SafeAreaView>

      <SafeAreaView style={styles.bottomOverlay} edges={['bottom']} pointerEvents="box-none">
        {message && (
          <View style={styles.messageBubble} pointerEvents="none">
            <Text style={styles.messageText}>{message}</Text>
          </View>
        )}
        {isMock && prediction && (
          <View style={styles.mockChip} pointerEvents="none">
            <Text style={styles.mockChipText}>MOCK RESULT</Text>
          </View>
        )}
        <Pressable
          onPress={handleDetect}
          disabled={busy}
          style={[styles.detectButton, busy && styles.detectButtonBusy]}>
          {busy ? (
            <ActivityIndicator color="#1A0F00" />
          ) : (
            <>
              <ScanSearch size={18} color="#1A0F00" />
              <Text style={styles.detectButtonText}>Detect</Text>
            </>
          )}
        </Pressable>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#000000'},
  bbox: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: AMBER,
    borderRadius: 4,
    backgroundColor: 'rgba(232,160,32,0.10)',
  },
  baseDot: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4CAF50',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  label: {
    position: 'absolute',
    backgroundColor: AMBER,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  labelText: {
    fontFamily: 'MontserratAlternates-Bold',
    fontSize: 12,
    color: '#1A0F00',
  },
  topOverlay: {position: 'absolute', top: 0, left: 0, right: 0},
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 12,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  iconButtonDisabled: {backgroundColor: 'rgba(0,0,0,0.3)'},
  titleBlock: {flex: 1, alignItems: 'center'},
  title: {
    fontFamily: 'MontserratAlternates-SemiBold',
    fontSize: 15,
    color: '#FFFFFF',
  },
  subtitle: {
    marginTop: 2,
    fontFamily: 'MontserratAlternates-Regular',
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 0.6,
  },
  bottomOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 10,
  },
  messageBubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    maxWidth: '90%',
  },
  bubbleReady: {borderColor: 'rgba(232,160,32,0.55)'},
  bubbleError: {borderColor: 'rgba(239,68,68,0.55)'},
  messageText: {
    fontFamily: 'MontserratAlternates-Medium',
    fontSize: 13,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  mockChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(76,175,80,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(76,175,80,0.5)',
  },
  mockChipText: {
    fontFamily: 'MontserratAlternates-Bold',
    fontSize: 10,
    letterSpacing: 1,
    color: '#9BE39E',
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  detectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minWidth: 160,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: AMBER,
  },
  detectButtonBusy: {opacity: 0.7},
  roundButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AMBER,
  },
  detectedChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(232,160,32,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(232,160,32,0.5)',
  },
  detectedChipText: {
    fontFamily: 'MontserratAlternates-Bold',
    fontSize: 12,
    color: AMBER,
  },
  detectButtonText: {
    fontFamily: 'MontserratAlternates-Bold',
    fontSize: 15,
    color: '#1A0F00',
  },
  fallbackBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 4,
  },
  fallbackHeading: {
    fontFamily: 'MontserratAlternates-SemiBold',
    fontSize: 18,
    color: '#FFFFFF',
    marginBottom: 12,
  },
  fallbackBody: {
    fontFamily: 'MontserratAlternates-Regular',
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    lineHeight: 20,
  },
  fallbackButton: {
    marginTop: 20,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: AMBER,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fallbackButtonText: {
    fontFamily: 'MontserratAlternates-Bold',
    fontSize: 13,
    color: '#1A0F00',
  },
  fallbackDismiss: {
    marginTop: 18,
    fontFamily: 'MontserratAlternates-Medium',
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
});

export default DetectArScreen;
