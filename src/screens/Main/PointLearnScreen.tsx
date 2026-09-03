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
 * ADMIN-GATED, deliberately. It is a workbench, not a product surface, and it is
 * gated on the same `isAdminUser` allowlist the magic window uses rather than on
 * the journey's flag — so opening the journey to visitors, which has happened,
 * can never open this by side effect.
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
import { useUserStore } from '../../stores/userStore';
import { isAdminUser } from '../../shared/auth/isAdminUser';
import PointLearnStep from './journey/PointLearnStep';
import FullscreenVideo from './journey/FullscreenVideo';
import { GhostButton, journeyStyles } from './journey/JourneyUi';

type Props = NativeStackScreenProps<MainStackParamList, 'PointLearn'>;

const PointLearnScreen: React.FC<Props> = ({ route }) => {
  const { t } = useTranslation();
  const slug = route.params?.slug ?? '';
  const leave = useSafeGoBack();

  const email = useUserStore(s => s.profile?.email);
  const allowed = isAdminUser(email);

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

  // Not an error state worth designing: a non-admin cannot navigate here
  // because nothing offers the route, and this is the belt to that braces.
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
