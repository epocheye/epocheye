import React, {useEffect} from 'react';
import {View, Text, StyleSheet, StatusBar} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Luggage, CalendarDays, Sprout} from 'lucide-react-native';
import {OB_COLORS} from '../../constants/onboarding';
import {FONTS} from '../../core/constants/theme';
import {useOnboardingStore} from '../../stores/onboardingStore';
import OBProgressBar from '../../components/onboarding/OBProgressBar';
import OBPrimaryButton from '../../components/onboarding/OBPrimaryButton';
import OBSelectionTile from '../../components/onboarding/OBSelectionTile';
import type {OnboardingScreenProps} from '../../core/types/navigation.types';

type Props = OnboardingScreenProps<'OB03_Frequency'>;

const OPTIONS = [
  {
    id: 'frequent',
    label: 'Frequently',
    sublabel: 'I travel to heritage sites often',
    Icon: Luggage,
  },
  {
    id: 'occasional',
    label: 'Occasionally',
    sublabel: 'A few times a year',
    Icon: CalendarDays,
  },
  {
    id: 'rarely',
    label: 'Rarely',
    sublabel: 'But I want to start',
    Icon: Sprout,
  },
] as const;

const OB03_Frequency: React.FC<Props> = ({navigation}) => {
  const visitFrequency = useOnboardingStore(s => s.visitFrequency);
  const setVisitFrequency = useOnboardingStore(s => s.setVisitFrequency);
  const insets = useSafeAreaInsets();

  const headingO = useSharedValue(0);
  const headingY = useSharedValue(16);
  const tile0O = useSharedValue(0);
  const tile1O = useSharedValue(0);
  const tile2O = useSharedValue(0);

  useEffect(() => {
    headingO.value = withTiming(1, {duration: 400});
    headingY.value = withSpring(0, {damping: 20, stiffness: 140});
    tile0O.value = withDelay(200, withTiming(1, {duration: 350}));
    tile1O.value = withDelay(320, withTiming(1, {duration: 350}));
    tile2O.value = withDelay(440, withTiming(1, {duration: 350}));
  }, [headingO, headingY, tile0O, tile1O, tile2O]);

  const headingStyle = useAnimatedStyle(() => ({
    opacity: headingO.value,
    transform: [{translateY: headingY.value}],
  }));
  const tileStyles = [
    useAnimatedStyle(() => ({opacity: tile0O.value})),
    useAnimatedStyle(() => ({opacity: tile1O.value})),
    useAnimatedStyle(() => ({opacity: tile2O.value})),
  ];

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />
      <OBProgressBar current={2} total={10} />

      <View style={[styles.content, {paddingBottom: insets.bottom + 24}]}>
        <Animated.View style={[styles.header, headingStyle]}>
          <Text style={styles.heading}>How often do you{'\n'}explore history?</Text>
        </Animated.View>

        <View style={styles.tiles}>
          {OPTIONS.map((opt, idx) => (
            <Animated.View key={opt.id} style={tileStyles[idx]}>
              <OBSelectionTile
                icon={
                  <opt.Icon
                    size={24}
                    color={visitFrequency === opt.id ? '#E8A020' : '#8C93A0'}
                  />
                }
                label={opt.label}
                sublabel={opt.sublabel}
                selected={visitFrequency === opt.id}
                onPress={() => setVisitFrequency(opt.id)}
                layout="stack"
              />
            </Animated.View>
          ))}
        </View>

        <OBPrimaryButton
          label="Continue  \u2192"
          disabled={!visitFrequency}
          onPress={() => navigation.navigate('OB04_Goal')}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: OB_COLORS.bg,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
  },
  header: {
    paddingHorizontal: 28,
    marginTop: 32,
  },
  heading: {
    fontSize: 28,
    lineHeight: 36,
    color: '#FFFFFF',
    fontFamily: FONTS.extraBold,
  },
  tiles: {
    gap: 12,
  },
});

export default OB03_Frequency;
