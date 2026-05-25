import React, {useCallback, useEffect} from 'react';
import {Image, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Button from '../../../components/ui/Button';
import {FONTS} from '../../../core/constants/theme';
import {ROUTES} from '../../../core/constants/routes';
import {WALKING_SPEED_KMH} from '../../../core/constants/distance';
import type {SiteDetail} from '../../../utils/api/places';
import type {TabMainNavigationProp} from '../../../core/types/navigation.types';

interface ApproachCardProps {
  site: SiteDetail;
  userLocation: {lat: number; lng: number} | null;
  distanceKm: number;
  hasKonarkAccess: boolean;
  visible: boolean;
  onShowDirections: () => void;
}

function formatSubKmDistance(km: number): string {
  const meters = km * 1000;
  if (meters >= 1000) return '1 km away';
  if (meters < 100) return 'Just steps away';
  const rounded = Math.round(meters / 50) * 50;
  return `${rounded} m away`;
}

function formatWalkingEta(km: number): string {
  const minutes = Math.max(1, Math.round((km / WALKING_SPEED_KMH) * 60));
  return `about ${minutes} min walk`;
}

const ApproachCard: React.FC<ApproachCardProps> = ({
  site,
  userLocation,
  distanceKm,
  hasKonarkAccess,
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

  const handleActivate = useCallback(() => {
    navigation.navigate(ROUTES.MAIN.PURCHASE, {
      preSelectedPlaceId: 'konark-sun-temple',
    });
  }, [navigation]);

  const distanceLine =
    distanceKm >= 0.1
      ? `${formatSubKmDistance(distanceKm)} · ${formatWalkingEta(distanceKm)}`
      : formatSubKmDistance(distanceKm);

  if (!userLocation) {
    return null;
  }

  return (
    <Animated.View
      style={[styles.stackedSlot, animatedStyle]}
      pointerEvents={visible ? 'auto' : 'none'}>
      <View
        className="bg-surface-2 border border-white/10 rounded-2xl p-4"
        style={styles.cardShadow}
        accessibilityRole="summary">
        <View className="flex-row gap-3">
          {site.hero_image_url ? (
            <Image
              source={{uri: site.hero_image_url}}
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
              You're approaching Konark
            </Text>
            <Text
              numberOfLines={1}
              style={{
                marginTop: 4,
                fontFamily: FONTS.sans,
                fontSize: 12,
                color: 'rgba(255,255,255,0.55)',
              }}>
              {distanceLine}
            </Text>
            {hasKonarkAccess ? (
              <View className="mt-2 flex-row items-center">
                <View style={styles.readyDot} />
                <Text
                  style={{
                    marginLeft: 6,
                    fontFamily: FONTS.sans,
                    fontSize: 12,
                    color: 'rgba(255,255,255,0.72)',
                  }}>
                  Epocheye is ready
                </Text>
              </View>
            ) : (
              <View className="mt-2 flex-row items-center flex-wrap">
                <Text
                  style={{
                    fontFamily: FONTS.sans,
                    fontSize: 12,
                    color: 'rgba(255,255,255,0.72)',
                  }}>
                  Activate Epocheye before you arrive.{' '}
                </Text>
                <TouchableOpacity
                  onPress={handleActivate}
                  accessibilityRole="button"
                  accessibilityLabel="Activate Epocheye for Konark"
                  hitSlop={6}>
                  <Text
                    style={{
                      fontFamily: FONTS.sansSemiBold,
                      fontSize: 12,
                      color: '#D4860A',
                      textDecorationLine: 'underline',
                    }}>
                    Activate
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
        {hasCoords ? (
          <View className="mt-3">
            <Button
              title="Get Directions"
              variant="primary"
              size="small"
              onPress={handleDirections}
              fullWidth
            />
          </View>
        ) : null}
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
  readyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
});

export default ApproachCard;
