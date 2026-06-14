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
  UNESCO_REGIONS,
  type UnescoRegion,
} from '../../constants/onboarding/regions';
import type {OnboardingScreenProps} from '../../core/types/navigation.types';

type Props = OnboardingScreenProps<'OB03_Region'>;

const GRID_HORIZONTAL_PADDING = 24;
const GRID_COLUMN_GAP = 12;

const OB03_Region: React.FC<Props> = ({navigation}) => {
  const {width: screenWidth} = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const firstName = useOnboardingStore(s => s.firstName);
  const region = useOnboardingStore(s => s.region);
  const setRegion = useOnboardingStore(s => s.setRegion);

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
    (id: UnescoRegion) => {
      setRegion(region === id ? null : id);
    },
    [region, setRegion],
  );

  const onContinue = useCallback(() => {
    if (!region) return;
    navigation.navigate(ROUTES.ONBOARDING.OB04_PULL);
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
            style={{fontFamily: FONTS.display}}>
            So,{' '}
            <Text className="text-brand-lime" style={{fontFamily: FONTS.display}}>
              {greetingName}
            </Text>{' '}
            it is..
          </Text>
          <Text
            className="text-[30px] text-parchment leading-[38px] mt-3"
            style={{fontFamily: FONTS.display}}>
            Where does your{'\n'}Heritage belong to?
          </Text>
        </Animated.View>

        <Animated.View
          className="mt-8 flex-row flex-wrap justify-start"
          style={[sGrid, {columnGap: GRID_COLUMN_GAP, rowGap: 22}]}>
          {UNESCO_REGIONS.map(entry => {
            const selected = region === entry.id;
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
                  className={`h-[114px] rounded-[10px] overflow-hidden border-2 ${selected ? 'border-brand-sky' : 'border-transparent'}`}
                  style={{width: tileWidth}}>
                  <Image
                    source={entry.image}
                    className="w-full h-full"
                    resizeMode="cover"
                  />
                  {selected ? (
                    <View className="absolute inset-0 bg-[rgba(203,168,98,0.18)]" />
                  ) : null}
                </View>
                <Text
                  className={`mt-2 min-h-[36px] text-[14px] leading-[18px] ${selected ? 'text-parchment' : 'text-[rgba(255,255,255,0.82)]'}`}
                  style={{fontFamily: FONTS.medium}}
                  numberOfLines={2}>
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
          disabled={!region}
          className="w-full h-14 rounded-full bg-brand-sky items-center justify-center"
          style={({pressed}) =>
            pressed && !!region
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

export default OB03_Region;
