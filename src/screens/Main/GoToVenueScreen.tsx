/**
 * GoToVenueScreen — the away-from-venue state.
 *
 * Epocheye's recognition/AR only works inside a curated heritage venue. When the
 * user tries to scan from anywhere else, this screen takes over: it points them to
 * their NEAREST Epocheye venue (name, era, distance) and makes going there feel
 * worth the trip, with one-tap directions. The app is a key to a place, not a
 * point-anywhere toy — this screen is where that promise is set.
 *
 * Location off/denied → we can't compute "nearest", so we show the full curated
 * venue list and a prompt to enable location.
 */
import React, {useCallback, useMemo, useState} from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Animated, {FadeIn, FadeInUp} from 'react-native-reanimated';
import {Compass, MapPin, Navigation, RefreshCw, WifiOff, X} from 'lucide-react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {COLORS, FONTS, FONT_SIZES, RADIUS, SPACING} from '../../core/constants/theme';
import {usePlacesStore} from '../../stores/placesStore';
import {getNearestZone} from '../../services/geofenceService';
import {fetchZones, getCachedZones, getZonesStatus} from '../../services/zoneService';
import type {HeritageZone} from '../../core/config/geofence.types';
import type {MainStackParamList} from '../../core/types/navigation.types';

function formatDistance(meters: number): string {
  if (meters < 950) {
    return `${Math.max(1, Math.round(meters / 10) * 10)} m away`;
  }
  return `${(meters / 1000).toFixed(meters < 9500 ? 1 : 0)} km away`;
}

function openDirections(zone: HeritageZone): void {
  const url = `https://www.google.com/maps/dir/?api=1&destination=${zone.lat},${zone.lon}`;
  void Linking.openURL(url).catch(() => undefined);
}

const GoToVenueScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const currentLocation = usePlacesStore(s => s.currentLocation);
  const ensureLocationTracking = usePlacesStore(s => s.ensureLocationTracking);

  const nearest = useMemo(() => {
    if (!currentLocation) return null;
    return getNearestZone(currentLocation.latitude, currentLocation.longitude);
  }, [currentLocation]);

  const allZones = useMemo(() => getCachedZones(), []);

  // Network failure (zones never loaded) is NOT the same as being outside a
  // venue — surface a connection-issue + retry state instead of a false "outside".
  const [checkError, setCheckError] = useState(() => {
    const s = getZonesStatus();
    return s.lastFailed && !s.everLoaded;
  });

  const handleClose = useCallback(() => navigation.goBack(), [navigation]);
  const handleEnableLocation = useCallback(() => {
    void ensureLocationTracking?.();
  }, [ensureLocationTracking]);
  const handleRetry = useCallback(async () => {
    await fetchZones(currentLocation?.latitude, currentLocation?.longitude);
    await ensureLocationTracking?.();
    const s = getZonesStatus();
    setCheckError(s.lastFailed && !s.everLoaded);
  }, [currentLocation, ensureLocationTracking]);

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.topRow}>
          <View style={styles.brandRow}>
            <Compass size={16} color={COLORS.sky} />
            <Text style={styles.brand}>EPOCHEYE</Text>
          </View>
          <Pressable onPress={handleClose} hitSlop={12} style={styles.closeBtn}>
            <X size={18} color={COLORS.textSecondary} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}>
          {checkError ? (
            <Animated.View entering={FadeIn.duration(400)} style={styles.card}>
              <View style={styles.cardTopRow}>
                <WifiOff size={15} color={COLORS.sky} />
                <Text style={styles.cardLabel}>COULDN'T CHECK YOUR LOCATION</Text>
              </View>
              <Text style={styles.venueName}>Connection issue</Text>
              <Text style={styles.venueMeta}>
                We couldn't reach Epocheye to confirm where you are — this looks
                like a network problem, not that you're away from a venue. Check
                your connection and try again.
              </Text>
              <Pressable onPress={handleRetry} style={styles.primaryBtn}>
                <RefreshCw size={16} color={COLORS.bg} />
                <Text style={styles.primaryBtnText}>Retry</Text>
              </Pressable>
            </Animated.View>
          ) : (
            <>
          <Animated.View entering={FadeIn.duration(400)}>
            <Text style={styles.kicker}>The lens only opens on site</Text>
            <Text style={styles.title}>Epocheye comes alive at the venue.</Text>
            <Text style={styles.subtitle}>
              Stand before the real piece and watch its history unfold in AR. Travel
              to your nearest site to begin.
            </Text>
          </Animated.View>

          {nearest ? (
            <Animated.View
              entering={FadeInUp.delay(120).duration(450)}
              style={styles.card}>
              <View style={styles.cardTopRow}>
                <MapPin size={15} color={COLORS.sky} />
                <Text style={styles.cardLabel}>YOUR NEAREST VENUE</Text>
              </View>
              <Text style={styles.venueName}>{nearest.zone.name}</Text>
              <Text style={styles.venueMeta}>
                {nearest.zone.epochLabel} · {formatDistance(nearest.distance)}
              </Text>
              <Pressable
                onPress={() => openDirections(nearest.zone)}
                style={styles.primaryBtn}>
                <Navigation size={16} color={COLORS.bg} />
                <Text style={styles.primaryBtnText}>Get directions</Text>
              </Pressable>
            </Animated.View>
          ) : (
            <Animated.View
              entering={FadeInUp.delay(120).duration(450)}
              style={styles.card}>
              <Text style={styles.cardLabel}>TURN ON LOCATION</Text>
              <Text style={styles.venueMeta}>
                We need your location to point you to the nearest Epocheye venue.
              </Text>
              <Pressable onPress={handleEnableLocation} style={styles.primaryBtn}>
                <MapPin size={16} color={COLORS.bg} />
                <Text style={styles.primaryBtnText}>Enable location</Text>
              </Pressable>
            </Animated.View>
          )}

          {allZones.length > 0 && (
            <View style={styles.listBlock}>
              <Text style={styles.listHeading}>All Epocheye venues</Text>
              {allZones.map((zone, i) => (
                <Animated.View
                  key={zone.id}
                  entering={FadeInUp.delay(200 + i * 60).duration(400)}>
                  <Pressable
                    onPress={() => openDirections(zone)}
                    style={styles.listRow}>
                    <View style={styles.listRowText}>
                      <Text style={styles.listName}>{zone.name}</Text>
                      <Text style={styles.listEpoch}>{zone.epochLabel}</Text>
                    </View>
                    <Navigation size={15} color={COLORS.textTertiary} />
                  </Pressable>
                </Animated.View>
              ))}
            </View>
          )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: COLORS.bg},
  safe: {flex: 1},
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.sm,
  },
  brandRow: {flexDirection: 'row', alignItems: 'center', gap: SPACING.sm},
  brand: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: FONT_SIZES.caption,
    letterSpacing: 2,
    color: COLORS.textSecondary,
  },
  closeBtn: {padding: SPACING.xs},
  scroll: {paddingHorizontal: SPACING.xl, paddingTop: SPACING.section, paddingBottom: SPACING.section},
  kicker: {
    fontFamily: FONTS.sansMedium,
    fontSize: FONT_SIZES.caption,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: COLORS.sky,
    marginBottom: SPACING.md,
  },
  title: {
    fontFamily: FONTS.display,
    fontSize: FONT_SIZES.hero,
    lineHeight: FONT_SIZES.hero * 1.15,
    color: COLORS.textPrimary,
  },
  subtitle: {
    fontFamily: FONTS.sans,
    fontSize: FONT_SIZES.body,
    lineHeight: FONT_SIZES.body * 1.5,
    color: COLORS.textSecondary,
    marginTop: SPACING.lg,
  },
  card: {
    marginTop: SPACING.section,
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.xl,
  },
  cardTopRow: {flexDirection: 'row', alignItems: 'center', gap: SPACING.sm},
  cardLabel: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: FONT_SIZES.caption,
    letterSpacing: 1.5,
    color: COLORS.textTertiary,
  },
  venueName: {
    fontFamily: FONTS.display,
    fontSize: FONT_SIZES.heading,
    color: COLORS.textPrimary,
    marginTop: SPACING.md,
  },
  venueMeta: {
    fontFamily: FONTS.sans,
    fontSize: FONT_SIZES.body,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.sky,
    borderRadius: RADIUS.pill,
    paddingVertical: SPACING.md,
    marginTop: SPACING.xl,
  },
  primaryBtnText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: FONT_SIZES.button,
    color: COLORS.bg,
  },
  listBlock: {marginTop: SPACING.section},
  listHeading: {
    fontFamily: FONTS.sansMedium,
    fontSize: FONT_SIZES.caption,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: COLORS.textTertiary,
    marginBottom: SPACING.md,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  listRowText: {flex: 1},
  listName: {
    fontFamily: FONTS.sansMedium,
    fontSize: FONT_SIZES.subtitle,
    color: COLORS.textPrimary,
  },
  listEpoch: {
    fontFamily: FONTS.sans,
    fontSize: FONT_SIZES.small,
    color: COLORS.textTertiary,
    marginTop: 2,
  },
});

export default GoToVenueScreen;
