/**
 * Ar3dViewerScreen — the AR experience shell.
 *
 * Renders a full-bleed 3D viewer with:
 *   - Top overlay: site name + era subtitle, close button, optional info icon
 *   - Bottom overlay: "VIEWING / {era} / as it stood" caption + era slider
 *   - Subtle vignette gradients for overlay readability
 *
 * Era-aware behavior is resolved via useActiveMonument:
 *   - real monument slug → parse `site.content.ar_data` for era data;
 *     null era stops show "Reconstruction coming soon"
 *   - DEV_MONUMENT_ID → single synthetic era stop at route.params.glbUrl
 *   - no era data → era slider hidden, single asset from route.params.glbUrl
 *
 * URL flips are debounced 300 ms and the underlying GLBViewer is remounted
 * via `key={resolvedUrl}` so the loading indicator and first-frame logs
 * fire cleanly on every change.
 */

import React, {
  Component,
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import {Info, X} from 'lucide-react-native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useNavigation, useRoute} from '@react-navigation/native';

import type {MainStackParamList} from '../../core/types/navigation.types';
import {
  DEV_MONUMENT_ID,
  type EraModel,
  type SiteEraConfig,
} from './components/eraModels';
import {useActiveMonument} from '../../shared/hooks/useActiveMonument';

// Lazy-loaded so @react-three/fiber + expo-gl are NOT evaluated at app startup.
// r3f v8 is incompatible with React 19 and throws at module-evaluation time,
// crashing the entire JS bundle before AppRegistry runs if imported eagerly.
const GLBViewer = lazy(() => import('../Lens/components/GLBViewer'));

interface GLBErrorBoundaryProps {
  onError: () => void;
  children: React.ReactNode;
}
interface GLBErrorBoundaryState {
  crashed: boolean;
}

class GLBErrorBoundary extends Component<GLBErrorBoundaryProps, GLBErrorBoundaryState> {
  state: GLBErrorBoundaryState = {crashed: false};
  static getDerivedStateFromError() {
    return {crashed: true};
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.crashed ? null : this.props.children;
  }
}

type RouteProp = {
  key: string;
  name: 'Ar3dViewer';
  params: MainStackParamList['Ar3dViewer'];
};

const Ar3dViewerScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const route = useRoute() as unknown as RouteProp;
  const {
    objectLabel,
    glbUrl,
    knowledgeText,
    monumentId,
    siteName,
    defaultEraLabel,
    preferParamGlb,
  } = route.params;

  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [showInfo, setShowInfo] = useState(false);

  // Resolve the monument through the single active-monument hook. The DEV
  // marker short-circuits the resolver and synthesises a one-stop era
  // config so the test pipeline doesn't depend on the backend.
  const active = useActiveMonument({
    explicitSlug:
      monumentId && monumentId !== DEV_MONUMENT_ID ? monumentId : null,
  });

  const eraCfg = useMemo<SiteEraConfig | null>(() => {
    if (monumentId === DEV_MONUMENT_ID) {
      return {
        eras: [{year: 0, label: 'Dev', glbUrl: glbUrl || null}],
        defaultIndex: 0,
      };
    }
    return active.eras;
  }, [monumentId, glbUrl, active.eras]);

  const eras: EraModel[] | null = eraCfg?.eras ?? null;

  // Honour the parser's defaultIndex when era data first arrives or the
  // monument changes. Keyed on a stable signature so re-parses producing
  // an equivalent config don't reset user scrubbing.
  const eraSignature = eraCfg
    ? `${monumentId}|${eraCfg.eras.length}|${eraCfg.defaultIndex}`
    : '';
  useEffect(() => {
    if (eraCfg) setActiveIndex(eraCfg.defaultIndex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eraSignature]);

  // Orbit controls (drag-rotate, pinch-zoom). Previously dev-only and pinned to
  // one monument, which meant a visitor sent here BECAUSE their phone has no AR
  // could not even turn the model — making the fallback a worse experience
  // rather than a different one. Anyone who arrived via preferParamGlb (i.e. the
  // capability fallback) gets it, as does the dev picker.
  const interactive =
    preferParamGlb || (__DEV__ && monumentId === DEV_MONUMENT_ID);

  // Target URL = whatever the current era points at, or the raw glbUrl when no
  // era table applies. preferParamGlb overrides the era table entirely: the
  // caller has already decided which model this is, and an era row with a null
  // glb_url would otherwise silently swallow it into "coming soon".
  const targetUrl: string | null = preferParamGlb
    ? glbUrl || null
    : eras
      ? eras[activeIndex]?.glbUrl ?? null
      : glbUrl || null;

  // Debounce URL flips so rapid slider scrubs don't churn the GL context.
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(targetUrl);
  useEffect(() => {
    const t = setTimeout(() => setResolvedUrl(targetUrl), 300);
    return () => clearTimeout(t);
  }, [targetUrl]);

  // When URL changes, clear any previous load error so the new mount can try fresh.
  useEffect(() => {
    setLoadError(null);
  }, [resolvedUrl]);

  const handleClose = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const title =
    siteName ??
    (monumentId === DEV_MONUMENT_ID
      ? 'Test Model'
      : active.title || prettyLabel(objectLabel));

  const eraLabel = eras
    ? eras[activeIndex]?.label ?? ''
    : defaultEraLabel ?? 'reconstruction';
  const subtitle = `reconstruction · ${eraLabel}`;

  const hasInfo = !!(knowledgeText && knowledgeText.trim().length > 0);

  return (
    <View style={styles.root}>
      {/* Body: GLB viewer OR "coming soon" empty state */}
      <View style={styles.body}>
        {resolvedUrl == null ? (
          <ComingSoonState eraLabel={eraLabel} />
        ) : loadError ? (
          <View style={styles.centerFill}>
            <Text style={styles.errorText}>{loadError}</Text>
          </View>
        ) : (
          <GLBErrorBoundary
            onError={() => setLoadError('3D preview unavailable on this device.')}>
            <Suspense fallback={<View style={styles.centerFill} />}>
              <GLBViewer
                key={resolvedUrl}
                url={resolvedUrl}
                autoRotate
                interactive={interactive}
                onError={e =>
                  setLoadError(e?.message || 'Failed to load 3D model')
                }
              />
            </Suspense>
          </GLBErrorBoundary>
        )}
      </View>

      {/* Vignette gradients for overlay readability */}
      <LinearGradient
        colors={['rgba(5,5,5,0.85)', 'rgba(5,5,5,0)']}
        style={styles.topVignette}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['rgba(5,5,5,0)', 'rgba(5,5,5,0.92)']}
        style={styles.bottomVignette}
        pointerEvents="none"
      />

      {/* Top overlay */}
      <SafeAreaView style={styles.topOverlay} edges={['top']}>
        <View style={styles.topRow}>
          <Pressable
            onPress={handleClose}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Close 3D viewer"
            style={styles.iconButton}>
            <X size={18} color="#FFFFFF" />
          </Pressable>

          <View style={styles.titleBlock}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          </View>

          {hasInfo ? (
            <Pressable
              onPress={() => setShowInfo(true)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="About this"
              style={styles.iconButton}>
              <Info size={18} color="#FFFFFF" />
            </Pressable>
          ) : (
            <View style={styles.iconButtonPlaceholder} />
          )}
        </View>
      </SafeAreaView>

      {/* Knowledge-text sheet */}
      <Modal
        visible={showInfo}
        animationType="slide"
        transparent
        onRequestClose={() => setShowInfo(false)}>
        <View style={styles.sheetBackdrop}>
          <Pressable
            style={styles.sheetDismissArea}
            onPress={() => setShowInfo(false)}
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
          />
          <SafeAreaView style={styles.sheet} edges={['bottom']}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>About this</Text>
              <Pressable
                onPress={() => setShowInfo(false)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Close info">
                <X size={18} color="#FFFFFF" />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.sheetContent}>
              <Text style={styles.sheetBody}>{knowledgeText}</Text>
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
};

const ComingSoonState: React.FC<{eraLabel: string}> = ({eraLabel}) => (
  <View style={styles.centerFill}>
    <Text style={styles.comingSoonEra}>{eraLabel}</Text>
    <Text style={styles.comingSoonBody}>Reconstruction coming soon</Text>
  </View>
);

function prettyLabel(label: string): string {
  return label
    .split(/[_\s]+/)
    .filter(Boolean)
    .map(s => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');
}

const VIGNETTE_HEIGHT = 200;
const AMBER = '#CBA862';

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#020202',
  },
  body: {
    ...StyleSheet.absoluteFillObject,
  },
  topVignette: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: VIGNETTE_HEIGHT,
  },
  bottomVignette: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: VIGNETTE_HEIGHT + 60,
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
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  iconButtonPlaceholder: {
    width: 36,
    height: 36,
  },
  titleBlock: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 16,
    color: '#FFFFFF',
  },
  subtitle: {
    marginTop: 2,
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 0.6,
  },
  centerFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  errorText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
  },
  comingSoonEra: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 22,
    color: AMBER,
    letterSpacing: 1.2,
  },
  comingSoonBody: {
    marginTop: 8,
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 13,
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 0.4,
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheetDismissArea: {
    flex: 1,
  },
  sheet: {
    maxHeight: '60%',
    backgroundColor: '#141414',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  sheetTitle: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 1.6,
  },
  sheetContent: {
    paddingVertical: 4,
    paddingBottom: 20,
  },
  sheetBody: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    color: '#FFFFFF',
    lineHeight: 22,
  },
});

export default Ar3dViewerScreen;
