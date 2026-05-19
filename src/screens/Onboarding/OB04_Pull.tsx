import React, {useCallback, useEffect, useMemo} from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StatusBar,
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
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {COLORS, FONTS} from '../../core/constants/theme';
import {ROUTES} from '../../core/constants/routes';
import {useOnboardingStore} from '../../stores/onboardingStore';
import {
  HERITAGE_INTERESTS,
  type HeritageInterest,
  type HeritageInterestEntry,
} from '../../constants/onboarding/pulls';
import type {OnboardingScreenProps} from '../../core/types/navigation.types';

type Props = OnboardingScreenProps<'OB04_Pull'>;

const GRID_HORIZONTAL_PADDING = 24;
const GRID_COLUMN_GAP = 12;
const TILE_IMAGE_HEIGHT = 114;

const OB04_Pull: React.FC<Props> = ({navigation}) => {
  const {width: screenWidth} = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const firstName = useOnboardingStore(s => s.firstName);
  const pulls = useOnboardingStore(s => s.pulls);
  const togglePull = useOnboardingStore(s => s.togglePull);

  const headO = useSharedValue(0);
  const headY = useSharedValue(12);
  const gridO = useSharedValue(0);

  useEffect(() => {
    headO.value = withDelay(150, withTiming(1, {duration: 600}));
    headY.value = withDelay(
      150,
      withTiming(0, {duration: 600, easing: Easing.out(Easing.cubic)}),
    );
    gridO.value = withDelay(500, withTiming(1, {duration: 600}));
  }, [headO, headY, gridO]);

  const sHead = useAnimatedStyle(() => ({
    opacity: headO.value,
    transform: [{translateY: headY.value}],
  }));
  const sGrid = useAnimatedStyle(() => ({opacity: gridO.value}));

  const onSelect = useCallback(
    (id: HeritageInterest) => {
      togglePull(id);
    },
    [togglePull],
  );

  const canContinue = pulls.length > 0;

  const onContinue = useCallback(() => {
    if (!canContinue) return;
    navigation.navigate(ROUTES.ONBOARDING.OB10_SIGNUP, {
      fromOnboarding: true,
    });
  }, [canContinue, navigation]);

  const greetingName = useMemo(
    () => (firstName ? firstName : 'friend'),
    [firstName],
  );

  const tileWidth = useMemo(
    () => (screenWidth - GRID_HORIZONTAL_PADDING * 2 - GRID_COLUMN_GAP) / 2,
    [screenWidth],
  );

  return (
    <View className="flex-1 bg-ink-warm">
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: GRID_HORIZONTAL_PADDING,
          paddingTop: insets.top + 56,
          paddingBottom: insets.bottom + 120,
        }}
        showsVerticalScrollIndicator={false}>
        <Animated.View style={sHead}>
          <Text
            className="text-[22px] text-[rgba(255,255,255,0.78)] leading-[30px]"
            style={{fontFamily: FONTS.serifItalic}}>
            So,{' '}
            <Text className="text-brand-lime" style={{fontFamily: FONTS.serifItalic}}>
              {greetingName}
            </Text>{' '}
            ...
          </Text>
          <Text
            className="text-[30px] text-parchment leading-[38px] mt-3"
            style={{fontFamily: FONTS.serifItalic}}>
            What pulls you in??
          </Text>
        </Animated.View>

        <Animated.View
          className="mt-8 flex-row flex-wrap justify-start"
          style={[sGrid, {columnGap: GRID_COLUMN_GAP, rowGap: 22}]}>
          {HERITAGE_INTERESTS.map((entry: HeritageInterestEntry) => {
            const selected = pulls.includes(entry.id);
            return (
              <Pressable
                key={entry.id}
                onPress={() => onSelect(entry.id)}
                className="items-start"
                style={({pressed}) => [
                  {width: tileWidth},
                  pressed && {opacity: 0.85},
                ]}
                accessibilityRole="button"
                accessibilityLabel={entry.label}
                accessibilityState={{selected}}>
                <View
                  className={`overflow-hidden rounded-[10px] border-2 ${selected ? 'border-brand-sky' : 'border-transparent'}`}
                  style={{width: tileWidth, height: TILE_IMAGE_HEIGHT}}>
                  <Image
                    source={entry.image}
                    className="w-full h-full"
                    resizeMode="cover"
                  />
                  {selected ? (
                    <View className="absolute inset-0 bg-[rgba(97,166,211,0.18)]" />
                  ) : null}
                </View>
                <Text
                  className={`mt-2 min-h-[20px] text-[14px] leading-[18px] ${selected ? 'text-parchment' : 'text-[rgba(255,255,255,0.82)]'}`}
                  style={{fontFamily: FONTS.medium}}
                  numberOfLines={1}>
                  {entry.label}
                </Text>
              </Pressable>
            );
          })}
        </Animated.View>
      </ScrollView>

      <View
        className="absolute left-0 right-0 bottom-0 px-[28px] pt-3 bg-ink-warm"
        style={{paddingBottom: insets.bottom + 20}}>
        <Pressable
          onPress={onContinue}
          disabled={!canContinue}
          className="w-full h-14 rounded-full bg-brand-sky items-center justify-center"
          style={({pressed}) =>
            pressed && canContinue
              ? {transform: [{scale: 0.98}], backgroundColor: COLORS.skyDark}
              : undefined
          }
          accessibilityRole="button"
          accessibilityLabel="Continue">
          <Text className="font-montserrat-medium text-[17px] text-parchment tracking-[0.3px]">
            Continue
          </Text>
        </Pressable>
      </View>
    </View>
  );
};

export default OB04_Pull;
