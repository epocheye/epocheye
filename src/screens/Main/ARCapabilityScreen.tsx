/**
 * ARCapabilityScreen — the one place that decides what a given phone gets.
 *
 * Every AR entry point (site detail's two CTAs, the venue-activation banner,
 * the arrival banner) now navigates HERE instead of straight into an AR screen.
 * Centralising is what stops four call sites each growing their own async
 * pending state, and it is what makes the A/B override in the dev health board
 * a single boolean instead of four patches.
 *
 * On a capable phone this screen is INVISIBLE: it resolves and `replace()`s
 * itself out of the stack before anything paints, so an AR user never has an
 * interstitial to dismiss and `back` from the destination returns to where they
 * came from, not to here.
 *
 * On a phone that cannot do AR it explains why — once for permanent facts,
 * every time for the fixable one — and hands over the 3D reconstruction with
 * the same authored history attached.
 */
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Linking, StyleSheet, View} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import ARCapabilityNotice from '../../components/ui/ARCapabilityNotice';
import {
  isFixableCapability,
  isNonArCapability,
  useARCapability,
} from '../../shared/hooks/useARCapability';
import {ROUTES} from '../../core/constants';
import {STORAGE_KEYS} from '../../core/constants/storage-keys';
import {listViewingStations} from '../../utils/api/ar';
import {resolveModelGlb} from '../../services/glbSource';
import {discoveryTextFor} from '../../features/ar/discoveryLayers';
import {useSafeGoBack} from '../../shared/hooks/useSafeGoBack';
import type {MainScreenProps} from '../../core/types/navigation.types';

const PLAY_ARCORE = 'market://details?id=com.google.ar.core';
const PLAY_ARCORE_WEB =
  'https://play.google.com/store/apps/details?id=com.google.ar.core';

/** Which permanent explanations this install has already shown. */
async function readSeen(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(
      STORAGE_KEYS.AR.CAPABILITY_NOTICE_SEEN,
    );
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    // Fail CLOSED — show the notice. Deliberately the opposite of
    // tourStore.shouldOfferFirstRun: there the harm is a spurious tour, here
    // the harm is silently redirecting someone with no word of explanation.
    return [];
  }
}

async function markSeen(intent: string): Promise<void> {
  try {
    const seen = await readSeen();
    if (seen.includes(intent)) return;
    await AsyncStorage.setItem(
      STORAGE_KEYS.AR.CAPABILITY_NOTICE_SEEN,
      JSON.stringify([...seen, intent]),
    );
  } catch {
    // Worst case it shows once more. Not worth surfacing.
  }
}

const ARCapabilityScreen: React.FC<MainScreenProps<'ArCapability'>> = ({
  route,
  navigation,
}) => {
  const {intent, venueSlug, siteName} = route.params;
  const {capability} = useARCapability();
  const goBack = useSafeGoBack();
  const [showNotice, setShowNotice] = useState(false);
  const decidedRef = useRef(false);

  /** The non-AR route forward: same GLB, 3D viewer, same authored history. */
  const goToFallback = useCallback(async () => {
    if (intent === 'detect') {
      // The scan flow has its own graceful 2D path and says so in-place.
      navigation.replace(ROUTES.MAIN.DETECT_AR, venueSlug ? {venueSlug} : {});
      return;
    }
    let glbUrl: string | null = null;
    let label = siteName ?? venueSlug ?? '';
    if (venueSlug) {
      const res = await listViewingStations(venueSlug);
      const station = res.success ? res.data.stations?.[0] : undefined;
      if (station?.model_id) {
        glbUrl = await resolveModelGlb(station.model_id);
        label = station.title || label;
      }
    }
    if (!glbUrl) {
      // Nothing authored here yet — a different condition from "your phone
      // can't do AR", and it must not borrow that copy.
      goBack();
      return;
    }
    navigation.replace(ROUTES.MAIN.AR_3D_VIEWER, {
      monumentId: venueSlug ?? '',
      objectLabel: label,
      glbUrl,
      preferParamGlb: true,
      siteName: label,
      knowledgeText: discoveryTextFor(venueSlug) ?? undefined,
    });
  }, [intent, venueSlug, siteName, navigation, goBack]);

  useEffect(() => {
    if (capability === 'checking' || decidedRef.current) {
      return;
    }

    if (!isNonArCapability(capability)) {
      decidedRef.current = true;
      // replace, not navigate: the interstitial must not sit in the back stack.
      if (intent === 'reconstruction') {
        navigation.replace(
          ROUTES.MAIN.SITE_RECONSTRUCTION,
          venueSlug ? {venueSlug} : undefined,
        );
      } else {
        navigation.replace(ROUTES.MAIN.DETECT_AR, venueSlug ? {venueSlug} : {});
      }
      return;
    }

    // Fixable states are never suppressed — hiding a one-tap fix behind a
    // seen-flag is a bug dressed as politeness.
    if (isFixableCapability(capability)) {
      decidedRef.current = true;
      setShowNotice(true);
      return;
    }

    void readSeen().then(seen => {
      if (decidedRef.current) return;
      decidedRef.current = true;
      if (seen.includes(intent)) {
        // Explained once already. From here on this simply IS their
        // experience, presented without apology.
        void goToFallback();
      } else {
        setShowNotice(true);
        void markSeen(intent);
      }
    });
  }, [capability, intent, venueSlug, navigation, goToFallback]);

  const openInstall = useCallback(() => {
    Linking.openURL(PLAY_ARCORE).catch(() =>
      Linking.openURL(PLAY_ARCORE_WEB).catch(() => {
        void goToFallback();
      }),
    );
  }, [goToFallback]);

  if (!showNotice) {
    // Deliberately a plain dark surface, not a spinner: on a capable phone this
    // exists for a few frames and a spinner would read as a stall.
    return <View style={styles.root} />;
  }

  return (
    <ARCapabilityNotice
      capability={capability}
      intent={intent}
      onPrimary={
        isFixableCapability(capability)
          ? openInstall
          : () => {
              void goToFallback();
            }
      }
      onSecondary={
        isFixableCapability(capability)
          ? () => {
              void goToFallback();
            }
          : undefined
      }
      onExit={goBack}
    />
  );
};

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#0A0A0C'},
});

export default ARCapabilityScreen;
