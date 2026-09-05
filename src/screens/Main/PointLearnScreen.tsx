/**
 * Point-and-recognise, on its own.
 *
 * WHY THIS SCREEN EXISTS. `PointLearnStep` was the journey's fourth step and was
 * removed from that sequence on 2026-09-03: Phase 2 measured retrieval grounding
 * wrongly 7 times out of 7 where the margin admits, on a corpus whose objects sit
 * 0.865 apart, and established the shortfall is representational rather than a
 * matter of data volume. A visitor should not meet that.
 *
 * But the component is NOT dead code — it is the surface the object-recognition
 * work is being built on, and `PalaceJourneyScreen` was its only render site, so
 * dropping it from the sequence would have made it unreachable and left it to rot
 * against a moving codebase. This is the smallest thing that keeps it alive and
 * exercisable.
 *
 * GATED BY PLACE, NOT BY ROLE, at the owner's direction. It was
 * `isAdminUser(email)`; it is now `useSiteGate(slug).allowed` — 'inside' or
 * 'bypass', i.e. `atVenue || isAdminUser`, the same predicate the journey and
 * both magic windows now use. A visitor standing at the site can point at a
 * pillar; an admin can do it from a desk.
 *
 * THE MEASUREMENT ABOVE HAS NOT CHANGED AND PRESENCE DOES NOT FIX IT. 7/7 wrong
 * where the margin admits is a property of the retrieval representation, not of
 * where the phone is standing. This is opened as a deliberate decision with that
 * known, exactly as the cavalryman was placed with build-record.md's objection
 * on the record. It is NOT re-added to `JOURNEY_STEPS` — the journey is three
 * steps and stays three steps. Reaching this needs a deliberate navigation to
 * the PointLearn route; nothing walks a visitor into it.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { MainStackParamList } from '../../core/types/navigation.types';
import {
  isNonArCapability,
  useARCapability,
} from '../../shared/hooks/useARCapability';
import { PermissionService } from '../../shared/services/permission.service';
import { useSafeGoBack } from '../../shared/hooks/useSafeGoBack';
import { useSiteGate } from '../../shared/hooks/useSiteGate';
import PointLearnStep from './journey/PointLearnStep';
import FullscreenVideo from './journey/FullscreenVideo';
import { GhostButton, journeyStyles } from './journey/JourneyUi';

type Props = NativeStackScreenProps<MainStackParamList, 'PointLearn'>;

const PointLearnScreen: React.FC<Props> = ({ route }) => {
  const { t } = useTranslation();
  const slug = route.params?.slug ?? '';
  const leave = useSafeGoBack();

  // ONE PREDICATE. `allowed` is 'inside' OR 'bypass' — see useSiteGate. The
  // exit hysteresis lives in there too, so a visitor who loses their fix
  // mid-scan is not thrown out: release needs the fix to be 150 m beyond the
  // boundary AND stay there 30 s, and a fix that stops arriving never starts
  // that clock.
  const allowed = useSiteGate(slug).allowed;

  const { capability } = useARCapability();
  const arCapable = capability === 'ready';

  const [camera, setCamera] = useState<'unknown' | 'granted' | 'denied'>(
    'unknown',
  );
  const requestCamera = useCallback(() => {
    void PermissionService.request('camera').then(granted =>
      setCamera(granted ? 'granted' : 'denied'),
    );
  }, []);
  useEffect(() => {
    if (!allowed || !arCapable || camera !== 'unknown') return;
    requestCamera();
  }, [allowed, arCapable, camera, requestCamera]);

  const [video, setVideo] = useState<{ uri: string; poster?: string } | null>(
    null,
  );
  const openVideo = useCallback(
    (uri: string, poster?: string) => setVideo({ uri, poster }),
    [],
  );

  // NOW A STATE A REAL VISITOR CAN REACH, which it was not while this was
  // admin-only: an off-site account that follows the route lands here rather
  // than on a blank screen. Kept deliberately plain — "not available" is the
  // honest sentence, and dressing it up as "come to the palace" would promise
  // a walk this workbench does not lead.
  if (!allowed || !slug) {
    return (
      <SafeAreaView style={journeyStyles.root} edges={['top', 'bottom']}>
        <View style={journeyStyles.page}>
          <Text style={journeyStyles.title}>{t('common.notAvailable')}</Text>
          <GhostButton label={t('common.close')} onPress={leave} />
        </View>
      </SafeAreaView>
    );
  }

  // The capability notice the journey shows is skipped here on purpose: an
  // admin opening a workbench wants to see how it degrades, not be stopped.
  return (
    <View style={journeyStyles.root}>
      <PointLearnStep
        slug={slug}
        arCapable={arCapable && !isNonArCapability(capability)}
        cameraGranted={camera === 'granted'}
        onRequestCamera={requestCamera}
        onOpenVideo={openVideo}
        onFinish={leave}
      />
      {video ? (
        <FullscreenVideo
          uri={video.uri}
          poster={video.poster}
          onClose={() => setVideo(null)}
        />
      ) : null}
    </View>
  );
};

export default PointLearnScreen;
