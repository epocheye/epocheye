/**
 * PlaneArTestScreen — lab-floor AR sanity check.
 *
 * Mounts the native EpocheyePlaneARView, lets the user tap a flat
 * surface to anchor a GLB at that point. Designed for indoor testing
 * before tomorrow's real Konark model lands; route accepts any GLB
 * URL so the same screen can later render the heritage models.
 *
 * Reached from Settings → DEV: Plane AR Test (Duck) — see
 * DevLoadTestArModelButton.tsx. The route is __DEV__-gated end-to-end
 * via the entry button; the screen itself works in production too,
 * just intentionally unreached.
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  GestureResponderEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Camera, RefreshCcw, Settings as SettingsIcon, X} from 'lucide-react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useCameraPermission} from 'react-native-vision-camera';

import EpocheyePlaneARView, {
  isPlaneARAvailable,
  type EpocheyePlaneARHandle,
} from '../../native/EpocheyePlaneARView';
import {PermissionService} from '../../shared/services/permission.service';
import {useARCore} from '../../shared/hooks/useARCore';
import {ROUTES} from '../../core/constants';
import type {MainStackParamList} from '../../core/types/navigation.types';

const KHRONOS_DUCK_URL =
  'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/Duck/glTF-Binary/Duck.glb';

type RouteParam = {
  key: string;
  name: 'PlaneArTest';
  params: MainStackParamList['PlaneArTest'];
};

const AMBER = '#E8A020';

type Status =
  | 'initializing'
  | 'searching' // session ready, no plane detected yet
  | 'ready' // plane detected, awaiting tap
  | 'placed' // model anchored
  | 'error';

const PlaneArTestScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const route = useRoute() as unknown as RouteParam;
  const {glbUrl, label} = route.params;

  const arRef = useRef<EpocheyePlaneARHandle>(null);
  const [status, setStatus] = useState<Status>('initializing');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ARCore device-support gate. Some Android devices are not on Google's
  // ARCore-supported list (https://developers.google.com/ar/devices). On
  // those devices ARSceneView silently fails to start — the symptom is a
  // black screen with the hint stuck at "Starting AR session…". We check
  // ArCoreApk.checkAvailability() up front and surface a clean fallback.
  const {arAvailable, arChecked} = useARCore();

  const handleSwitchToViewer = useCallback(() => {
    navigation.replace(ROUTES.MAIN.AR_3D_VIEWER, {
      monumentId: '__dev_test__',
      objectLabel: label,
      glbUrl: glbUrl || KHRONOS_DUCK_URL,
      knowledgeText:
        '3D viewer fallback for devices that do not support ARCore.',
    });
  }, [navigation, glbUrl, label]);

  // Camera permission gate — mirrors LensScreen.tsx / ARExperienceScreen.tsx.
  // ARSceneView silently fails to start the AR session if camera permission
  // hasn't been granted at the moment of mount, so we must request it BEFORE
  // rendering <EpocheyePlaneARView>.
  const {hasPermission, requestPermission} = useCameraPermission();
  const permissionRequestedRef = useRef(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

  useEffect(() => {
    if (hasPermission || permissionRequestedRef.current) return;
    permissionRequestedRef.current = true;
    void requestPermission().then(granted => {
      if (!granted) setPermissionDenied(true);
    });
  }, [hasPermission, requestPermission]);

  const handleRequestPermission = useCallback(() => {
    setPermissionDenied(false);
    void requestPermission().then(granted => {
      if (!granted) setPermissionDenied(true);
    });
  }, [requestPermission]);

  const handleOpenSettings = useCallback(() => {
    void PermissionService.openAppSettings();
  }, []);

  const handleReady = useCallback(() => {
    console.log('[PlaneAR] session ready');
    setStatus(prev => (prev === 'placed' ? prev : 'searching'));
  }, []);

  const handlePlaneDetected = useCallback(() => {
    console.log('[PlaneAR] plane detected');
    setStatus(prev => (prev === 'placed' ? prev : 'ready'));
  }, []);

  const handleAnchorPlaced = useCallback((placedLabel: string) => {
    console.log('[PlaneAR] anchor placed:', placedLabel);
    setStatus('placed');
    setErrorMessage(null);
  }, []);

  const handleError = useCallback((err: string) => {
    console.log('[PlaneAR] error:', err);
    setErrorMessage(err);
    // Soft errors ("no plane at tap") shouldn't lock the screen into
    // 'error' — the user can try another tap. Hard errors do.
    if (err.includes('no plane at tap')) {
      return;
    }
    setStatus('error');
  }, []);

  const handleTap = useCallback((event: GestureResponderEvent) => {
    if (!arRef.current) return;
    if (status === 'initializing' || status === 'error') return;
    const {locationX, locationY} = event.nativeEvent;
    console.log('[PlaneAR] tap at', locationX, locationY);
    arRef.current.performHitTest(locationX, locationY);
  }, [status]);

  const handleReset = useCallback(() => {
    arRef.current?.clearAnchor();
    setStatus(prev => (prev === 'placed' ? 'ready' : prev));
  }, []);

  const handleClose = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  useEffect(() => {
    console.log('[PlaneAR] mounted; glbUrl =', glbUrl, 'available =', isPlaneARAvailable);
  }, [glbUrl]);

  const hint = useMemo(() => {
    switch (status) {
      case 'initializing':
        return 'Starting AR session…';
      case 'searching':
        return 'Look around at a floor or table';
      case 'ready':
        return 'Tap a flat surface to place the model';
      case 'placed':
        return 'Tap again to re-place · ⟳ to clear';
      case 'error':
        return `${errorMessage ?? 'AR error'} · close and reopen to retry`;
    }
  }, [status, errorMessage]);

  if (!isPlaneARAvailable) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.fallbackBlock}>
          <Text style={styles.fallbackHeading}>Plane AR not available</Text>
          <Text style={styles.fallbackBody}>
            The native plane AR module isn't registered on this build. Run a
            fresh Android build (the native side ships in com.epocheye.ar) and
            try again.
          </Text>
          <Pressable
            onPress={handleClose}
            style={styles.fallbackButton}
            accessibilityRole="button"
            accessibilityLabel="Close">
            <Text style={styles.fallbackButtonText}>Close</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ARCore device-support gate. We wait for the async availability check
  // to complete (`arChecked`) before deciding — otherwise we'd flash the
  // unsupported message during init on devices that DO support ARCore.
  if (arChecked && !arAvailable) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.fallbackBlock}>
          <Camera size={40} color={AMBER} />
          <Text style={styles.fallbackHeading}>
            AR isn't supported on this device
          </Text>
          <Text style={styles.fallbackBody}>
            Google's ARCore service doesn't recognise this device model, so
            plane detection and world-anchoring won't work here. This isn't a
            permissions or install issue — it's Google's hardware
            certification list.
          </Text>
          <Pressable
            onPress={handleSwitchToViewer}
            style={styles.fallbackButton}
            accessibilityRole="button"
            accessibilityLabel="Open the 3D viewer instead">
            <Text style={styles.fallbackButtonText}>Use the 3D Viewer</Text>
          </Pressable>
          <Text style={styles.fallbackHelp}>
            The 3D viewer renders the model on a black background without AR.
            Works on any device.
          </Text>
          <Pressable
            onPress={handleClose}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Close">
            <Text style={styles.fallbackDismiss}>Close</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // Camera permission gate. The AR session can't start without it.
  if (!hasPermission) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.fallbackBlock}>
          <Camera size={40} color={AMBER} />
          <Text style={styles.fallbackHeading}>Allow Camera to use AR</Text>
          <Text style={styles.fallbackBody}>
            Plane AR needs the camera to detect real-world surfaces. Your
            footage stays on the device — nothing is uploaded.
          </Text>
          {permissionDenied ? (
            <>
              <Pressable
                onPress={handleOpenSettings}
                style={styles.fallbackButton}
                accessibilityRole="button"
                accessibilityLabel="Open app settings">
                <SettingsIcon size={14} color="#1A0F00" />
                <Text style={styles.fallbackButtonText}>Open Settings</Text>
              </Pressable>
              <Text style={styles.fallbackHelp}>
                If "Don't allow" was tapped, Android blocks re-prompting from
                inside the app. Toggle Camera on from System Settings.
              </Text>
            </>
          ) : (
            <Pressable
              onPress={handleRequestPermission}
              style={styles.fallbackButton}
              accessibilityRole="button"
              accessibilityLabel="Allow camera">
              <Text style={styles.fallbackButtonText}>Allow Camera</Text>
            </Pressable>
          )}
          <Pressable
            onPress={handleClose}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Close">
            <Text style={styles.fallbackDismiss}>Close</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.root}>
      <Pressable
        style={styles.tapLayer}
        onPress={handleTap}
        accessibilityRole="button"
        accessibilityLabel="Tap to place model">
        <EpocheyePlaneARView
          ref={arRef}
          style={StyleSheet.absoluteFill}
          glbUri={glbUrl}
          onReady={handleReady}
          onPlaneDetected={handlePlaneDetected}
          onAnchorPlaced={handleAnchorPlaced}
          onError={handleError}
        />
      </Pressable>

      <SafeAreaView style={styles.topOverlay} edges={['top']} pointerEvents="box-none">
        <View style={styles.topRow} pointerEvents="box-none">
          <Pressable
            onPress={handleClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={styles.iconButton}>
            <X size={18} color="#FFFFFF" />
          </Pressable>

          <View style={styles.titleBlock}>
            <Text style={styles.title} numberOfLines={1}>
              {label}
            </Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              plane AR · tap to place
            </Text>
          </View>

          <Pressable
            onPress={handleReset}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Reset placement"
            style={[
              styles.iconButton,
              status !== 'placed' && styles.iconButtonDisabled,
            ]}>
            <RefreshCcw
              size={16}
              color={status === 'placed' ? '#FFFFFF' : 'rgba(255,255,255,0.35)'}
            />
          </Pressable>
        </View>
      </SafeAreaView>

      <SafeAreaView style={styles.bottomOverlay} edges={['bottom']} pointerEvents="none">
        <View
          style={[
            styles.hintBubble,
            status === 'error' && styles.hintBubbleError,
            status === 'ready' && styles.hintBubbleReady,
          ]}>
          <Text style={styles.hintText} numberOfLines={2}>
            {hint}
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  tapLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
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
  iconButtonDisabled: {
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  titleBlock: {
    flex: 1,
    alignItems: 'center',
  },
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
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  hintBubble: {
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    maxWidth: '90%',
  },
  hintBubbleReady: {
    borderColor: 'rgba(232,160,32,0.55)',
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  hintBubbleError: {
    borderColor: 'rgba(239,68,68,0.55)',
  },
  hintText: {
    fontFamily: 'MontserratAlternates-Medium',
    fontSize: 13,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  fallbackBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
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
  fallbackHelp: {
    marginTop: 14,
    fontFamily: 'MontserratAlternates-Regular',
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: 8,
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

export default PlaneArTestScreen;
