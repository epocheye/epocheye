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
import {Moon, Flame, Zap} from 'lucide-react-native';
import {OB_COLORS} from '../../constants/onboarding';
import {FONTS} from '../../core/constants/theme';
import {useOnboardingStore} from '../../stores/onboardingStore';
import OBProgressBar from '../../components/onboarding/OBProgressBar';
import OBPrimaryButton from '../../components/onboarding/OBPrimaryButton';
import OBSelectionTile from '../../components/onboarding/OBSelectionTile';
import type {OnboardingScreenProps} from '../../core/types/navigation.types';

type Props = OnboardingScreenProps<'OB04_Goal'>;

const OPTIONS = [
  {id: 'monthly', label: 'Once a month', badge: 'Easy', Icon: Moon},
  {id: 'weekly', label: 'Once a week', badge: 'Recommended', Icon: Flame},
  {id: 'every_visit', label: 'Every site visit', badge: 'Explorer', Icon: Zap},
] as const;

const OB04_Goal: React.FC<Props> = ({navigation}) => {
  const goal = useOnboardingStore(s => s.goal);
  const setGoal = useOnboardingStore(s => s.setGoal);
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
      <OBProgressBar current={3} total={10} />

      <View style={[styles.content, {paddingBottom: insets.bottom + 24}]}>
        <Animated.View style={[styles.header, headingStyle]}>
          <Text style={styles.heading}>Set your discovery{'\n'}pace</Text>
          <Text style={styles.sub}>
            Setting a goal doubles your chances of sticking with it.
          </Text>
        </Animated.View>

        <View style={styles.tiles}>
          {OPTIONS.map((opt, idx) => (
            <Animated.View key={opt.id} style={tileStyles[idx]}>
              <OBSelectionTile
                icon={
                  <opt.Icon
                    size={24}
                    color={goal === opt.id ? '#E8A020' : '#8C93A0'}
                  />
                }
                label={opt.label}
                badge={opt.badge}
                selected={goal === opt.id}
                onPress={() => setGoal(opt.id)}
                layout="stack"
              />
            </Animated.View>
          ))}
        </View>

        <OBPrimaryButton
          label="Continue  \u2192"
          onPress={() => navigation.navigate('OB05_Region')}
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
    marginBottom: 8,
  },
  sub: {
    fontSize: 14,
    lineHeight: 20,
    color: '#8C93A0',
    fontFamily: FONTS.regular,
  },
  tiles: {
    gap: 12,
  },
});

export default OB04_Goal;
