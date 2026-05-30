import React, {useCallback, useEffect} from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Button from '../../../components/ui/Button';
import {FONTS} from '../../../core/constants/theme';
import {ROUTES} from '../../../core/constants/routes';
import type {SiteDetail} from '../../../utils/api/places';
import type {TabMainNavigationProp} from '../../../core/types/navigation.types';

interface ArrivalBannerProps {
  site: SiteDetail;
  hasAccess: boolean;
  placeId: string;
  visible: boolean;
  onDismiss: () => void;
}

const ArrivalBanner: React.FC<ArrivalBannerProps> = ({
  site,
  hasAccess,
  placeId,
  visible,
  onDismiss,
}) => {
  const navigation = useNavigation<TabMainNavigationProp>();
  const opacity = useSharedValue(visible ? 1 : 0);

  useEffect(() => {
    opacity.value = withTiming(visible ? 1 : 0, {duration: 200});
  }, [opacity, visible]);

  const animatedStyle = useAnimatedStyle(() => ({opacity: opacity.value}));

  const handleActivate = useCallback(() => {
    navigation.navigate(ROUTES.MAIN.PURCHASE, {
      preSelectedPlaceId: placeId,
    });
  }, [navigation, placeId]);

  const handleOpenLens = useCallback(() => {
    navigation.navigate(ROUTES.MAIN.LENS);
  }, [navigation]);

  return (
    <Animated.View
      style={[styles.stackedSlot, animatedStyle]}
      pointerEvents={visible ? 'auto' : 'none'}>
      <LinearGradient
        colors={['#141414', 'rgba(232,160,32,0.14)']}
        start={{x: 0, y: 0}}
        end={{x: 1, y: 1}}
        style={styles.banner}>
        {hasAccess ? (
          <View>
            <Text style={styles.heading}>{`Welcome to ${site.name}`}</Text>
            <Text style={styles.body}>Tap to begin.</Text>
            <View style={styles.actionRow}>
              <Button
                title="Open Lens"
                variant="primary"
                size="small"
                onPress={handleOpenLens}
                accessibilityLabel={`Open Lens at ${site.name}`}
              />
            </View>
          </View>
        ) : (
          <View>
            <Text style={styles.heading}>{`You're at ${site.name}`}</Text>
            <Text style={styles.body}>
              Activate Epocheye to see this in a different era.
            </Text>
            <View style={styles.actionRow}>
              <Button
                title="Activate"
                variant="primary"
                size="small"
                onPress={handleActivate}
                accessibilityLabel={`Activate Epocheye for ${site.name}`}
              />
              <TouchableOpacity
                onPress={onDismiss}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Dismiss for now"
                style={styles.maybeLaterButton}>
                <Text style={styles.maybeLaterText}>Maybe later</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </LinearGradient>
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
  banner: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(232,160,32,0.3)',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: {width: 0, height: 8},
    elevation: 8,
  },
  heading: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 18,
    color: '#FFFFFF',
  },
  body: {
    marginTop: 4,
    fontFamily: FONTS.sans,
    fontSize: 13,
    color: 'rgba(255,255,255,0.72)',
  },
  actionRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  maybeLaterButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  maybeLaterText: {
    fontFamily: FONTS.sans,
    fontSize: 13,
    color: 'rgba(255,255,255,0.55)',
  },
});

export default ArrivalBanner;
