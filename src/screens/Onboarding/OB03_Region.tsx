import React, { useCallback, useEffect, useMemo } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, FONTS } from '../../core/constants/theme';
import { ROUTES } from '../../core/constants/routes';
import { useOnboardingStore } from '../../stores/onboardingStore';
import {
  UNESCO_REGIONS,
  type UnescoRegion,
} from '../../constants/onboarding/regions';
import type { OnboardingScreenProps } from '../../core/types/navigation.types';

type Props = OnboardingScreenProps<'OB03_Region'>;

const OB03_Region: React.FC<Props> = ({ navigation }) => {
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const firstName = useOnboardingStore(s => s.firstName);
  const region = useOnboardingStore(s => s.region);
  const setRegion = useOnboardingStore(s => s.setRegion);

  const headO = useSharedValue(0);
  const headY = useSharedValue(12);
  const gridO = useSharedValue(0);

  useEffect(() => {
    headO.value = withDelay(150, withTiming(1, { duration: 600 }));
    headY.value = withDelay(
      150,
      withTiming(0, { duration: 600, easing: Easing.out(Easing.cubic) }),
    );
    gridO.value = withDelay(500, withTiming(1, { duration: 600 }));
  }, [headO, headY, gridO]);

  const sHead = useAnimatedStyle(() => ({
    opacity: headO.value,
    transform: [{ translateY: headY.value }],
  }));
  const sGrid = useAnimatedStyle(() => ({ opacity: gridO.value }));

  const onSelect = useCallback(
    (id: UnescoRegion) => {
      setRegion(region === id ? null : id);
    },
    [region, setRegion],
  );

  const onContinue = useCallback(() => {
    if (!region) return;
    navigation.navigate(ROUTES.ONBOARDING.OB10_SIGNUP, {
      fromOnboarding: true,
    });
  }, [region, navigation]);

  const greetingName = useMemo(
    () => (firstName ? firstName : 'friend'),
    [firstName],
  );

  const tileWidth = useMemo(
    () => (screenWidth - GRID_HORIZONTAL_PADDING * 2 - GRID_COLUMN_GAP) / 2,
    [screenWidth],
  );

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: insets.top + 56,
            paddingBottom: insets.bottom + 120,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={sHead}>
          <Text style={styles.kicker}>
            So, <Text style={styles.kickerName}>{greetingName}</Text> it is..
          </Text>
          <Text style={styles.question}>
            Where does your{'\n'}Heritage belong to?
          </Text>
        </Animated.View>

        <Animated.View style={[styles.grid, sGrid]}>
          {UNESCO_REGIONS.map(entry => {
            const selected = region === entry.id;
            return (
              <Pressable
                key={entry.id}
                onPress={() => onSelect(entry.id)}
                style={({ pressed }) => [
                  styles.tile,
                  { width: tileWidth },
                  pressed && styles.tilePressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={entry.label}
                accessibilityState={{ selected }}
              >
                <View
                  style={[
                    styles.tileImageWrap,
                    { width: tileWidth },
                    selected && styles.tileImageWrapSelected,
                  ]}
                >
                  <Image
                    source={entry.image}
                    style={styles.tileImage}
                    resizeMode="cover"
                  />
                  {selected ? <View style={styles.tileTint} /> : null}
                </View>
                <Text
                  style={[
                    styles.tileLabel,
                    selected && styles.tileLabelSelected,
                  ]}
                  numberOfLines={2}
                >
                  {entry.label}
                </Text>
              </Pressable>
            );
          })}
        </Animated.View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
        <Pressable
          onPress={onContinue}
          disabled={!region}
          style={({ pressed }) => [
            styles.cta,
            !region && styles.ctaDisabled,
            pressed && !!region && styles.ctaPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Continue"
        >
          <Text style={styles.ctaLabel}>Continue</Text>
        </Pressable>
      </View>
    </View>
  );
};

const GRID_HORIZONTAL_PADDING = 24;
const GRID_COLUMN_GAP = 12;
const TILE_IMAGE_HEIGHT = 114;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111111',
  },
  scroll: {
    paddingHorizontal: GRID_HORIZONTAL_PADDING,
  },
  kicker: {
    fontFamily: FONTS.serifItalic,
    fontSize: 22,
    color: 'rgba(255,255,255,0.78)',
    lineHeight: 30,
  },
  kickerName: {
    color: COLORS.lime,
  },
  question: {
    fontFamily: FONTS.serifItalic,
    fontSize: 30,
    color: '#FFFFFF',
    lineHeight: 38,
    marginTop: 12,
  },
  grid: {
    marginTop: 32,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    columnGap: GRID_COLUMN_GAP,
    rowGap: 22,
  },
  tile: {
    alignItems: 'flex-start',
  },
  tilePressed: {
    opacity: 0.85,
  },
  tileImageWrap: {
    height: TILE_IMAGE_HEIGHT,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  tileImageWrapSelected: {
    borderColor: COLORS.sky,
  },
  tileImage: {
    width: '100%',
    height: '100%',
  },
  tileTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(97,166,211,0.18)',
  },
  tileLabel: {
    marginTop: 8,
    minHeight: 36,
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: 'rgba(255,255,255,0.82)',
    lineHeight: 18,
  },
  tileLabelSelected: {
    color: '#FFFFFF',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 28,
    paddingTop: 12,
    backgroundColor: '#111111',
  },
  cta: {
    width: '100%',
    height: 56,
    borderRadius: 999,
    backgroundColor: COLORS.sky,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaPressed: {
    backgroundColor: COLORS.skyDark,
    transform: [{ scale: 0.98 }],
  },
  ctaDisabled: {
    backgroundColor: 'rgba(97,166,211,0.35)',
  },
  ctaLabel: {
    fontFamily: FONTS.medium,
    fontSize: 17,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
});

export default OB03_Region;
