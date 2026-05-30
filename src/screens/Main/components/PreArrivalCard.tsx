import React, {useCallback, useEffect} from 'react';
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Button from '../../../components/ui/Button';
import {FONTS} from '../../../core/constants/theme';
import {ROUTES} from '../../../core/constants/routes';
import {PermissionService} from '../../../shared/services/permission.service';
import {resolveSiteImageSource} from '../../../shared/utils/localSiteImages';
import type {SiteDetail} from '../../../utils/api/places';
import type {
  PlaceNavParam,
  TabMainNavigationProp,
} from '../../../core/types/navigation.types';

interface PreArrivalCardProps {
  site: SiteDetail;
  userLocation: {lat: number; lng: number} | null;
  distanceKm: number | null;
  etaMinutes: number | null;
  locationPermissionDenied: boolean;
  visible: boolean;
  onShowDirections: () => void;
}

function formatLongDistance(km: number): string {
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

function formatEta(min: number): string {
  if (min < 60) return `about ${min} min`;
  const hours = Math.floor(min / 60);
  const mins = min % 60;
  return `about ${hours}h ${mins}m`;
}

function siteDetailToPlaceNavParam(site: SiteDetail): PlaceNavParam {
  return {
    id: site.id,
    name: site.name,
    lat: site.latitude,
    lon: site.longitude,
    city: site.city,
    country: site.country,
    formatted: site.short_description,
    heroImages: site.hero_image_url ? [site.hero_image_url] : undefined,
  };
}

const PreArrivalCard: React.FC<PreArrivalCardProps> = ({
  site,
  userLocation,
  distanceKm,
  etaMinutes,
  locationPermissionDenied,
  visible,
  onShowDirections,
}) => {
  const navigation = useNavigation<TabMainNavigationProp>();
  const opacity = useSharedValue(visible ? 1 : 0);

  useEffect(() => {
    opacity.value = withTiming(visible ? 1 : 0, {duration: 200});
  }, [opacity, visible]);

  const animatedStyle = useAnimatedStyle(() => ({opacity: opacity.value}));

  const hasCoords =
    typeof site.latitude === 'number' && typeof site.longitude === 'number';

  const handleDirections = useCallback(() => {
    if (!hasCoords) return;
    onShowDirections();
  }, [hasCoords, onShowDirections]);

  const handleViewDetails = useCallback(() => {
    navigation.navigate(ROUTES.MAIN.SITE_DETAIL, {
      site: siteDetailToPlaceNavParam(site),
    });
  }, [navigation, site]);

  const handleOpenSettings = useCallback(() => {
    void PermissionService.openAppSettings();
  }, []);

  if (locationPermissionDenied) {
    return (
      <Animated.View
        style={[styles.stackedSlot, animatedStyle]}
        pointerEvents={visible ? 'auto' : 'none'}>
        <View
          className="bg-surface-2 border border-white/10 rounded-2xl p-4"
          style={styles.cardShadow}
          accessibilityRole="summary">
          <Text
            style={{
              fontFamily: FONTS.sans,
              fontSize: 13,
              color: 'rgba(255,255,255,0.72)',
              lineHeight: 18,
            }}>
            {`Allow location to see distance to ${site.name}`}
          </Text>
          <TouchableOpacity
            onPress={handleOpenSettings}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Open settings"
            className="mt-3 self-start px-4 py-2 rounded-xl bg-[#D4860A]">
            <Text
              style={{
                fontFamily: FONTS.sansSemiBold,
                fontSize: 13,
                color: '#1A1612',
              }}>
              Open Settings
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  }

  if (!userLocation || distanceKm === null) {
    return null;
  }

  const subtitleParts = [site.era, site.dynasty].filter(
    (s): s is string => typeof s === 'string' && s.length > 0,
  );
  const subtitle = subtitleParts.join(' · ');
  const heroSource = resolveSiteImageSource(site);
  const distanceLine =
    etaMinutes !== null
      ? `${formatEta(etaMinutes)} · ${formatLongDistance(distanceKm)} away`
      : `${formatLongDistance(distanceKm)} away`;

  return (
    <Animated.View
      style={[styles.stackedSlot, animatedStyle]}
      pointerEvents={visible ? 'auto' : 'none'}>
      <View
        className="bg-surface-2 border border-white/10 rounded-2xl p-4"
        style={styles.cardShadow}
        accessibilityRole="summary">
        <View className="flex-row gap-3">
          {heroSource ? (
            <Image
              source={heroSource}
              style={styles.thumbnail}
              resizeMode="cover"
            />
          ) : null}
          <View className="flex-1">
            <Text
              numberOfLines={1}
              style={{
                fontFamily: FONTS.sansSemiBold,
                fontSize: 16,
                color: '#FFFFFF',
              }}>
              {site.name}
            </Text>
            {subtitle ? (
              <Text
                numberOfLines={1}
                style={{
                  marginTop: 2,
                  fontFamily: FONTS.sans,
                  fontSize: 12,
                  color: 'rgba(255,255,255,0.72)',
                }}>
                {subtitle}
              </Text>
            ) : null}
            <Text
              numberOfLines={1}
              style={{
                marginTop: 4,
                fontFamily: FONTS.sans,
                fontSize: 12,
                color: 'rgba(255,255,255,0.45)',
              }}>
              {distanceLine}
            </Text>
          </View>
        </View>
        <View className="mt-3 flex-row gap-2">
          {hasCoords ? (
            <View className="flex-1">
              <Button
                title="Get Directions"
                variant="primary"
                size="small"
                onPress={handleDirections}
                fullWidth
              />
            </View>
          ) : null}
          <View className="flex-1">
            <Button
              title="View Details"
              variant="secondary"
              size="small"
              onPress={handleViewDetails}
              fullWidth
            />
          </View>
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  stackedSlot: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  cardShadow: {
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: {width: 0, height: 8},
    elevation: 8,
  },
  thumbnail: {
    width: 64,
    height: 64,
    borderRadius: 12,
  },
});

export default PreArrivalCard;
