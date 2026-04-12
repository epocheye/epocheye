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
import {Landmark, Globe, TreePine, BookOpen} from 'lucide-react-native';
import {OB_COLORS} from '../../constants/onboarding';
import {FONTS} from '../../core/constants/theme';
import {useOnboardingStore} from '../../stores/onboardingStore';
import OBProgressBar from '../../components/onboarding/OBProgressBar';
import OBPrimaryButton from '../../components/onboarding/OBPrimaryButton';
import OBSelectionTile from '../../components/onboarding/OBSelectionTile';
import {track} from '../../services/analytics';
import type {OnboardingScreenProps} from '../../core/types/navigation.types';

type Props = OnboardingScreenProps<'OB02_Motivation'>;

const OPTIONS = [
  {id: 'heritage_visitor', label: 'I visit heritage sites', Icon: Landmark},
  {id: 'traveller', label: 'I love to travel', Icon: Globe},
  {id: 'roots', label: 'I want to know my roots', Icon: TreePine},
  {id: 'history_lover', label: 'I love history', Icon: BookOpen},
] as const;

const OB02_Motivation: React.FC<Props> = ({navigation}) => {
  const motivation = useOnboardingStore(s => s.motivation);
  const setMotivation = useOnboardingStore(s => s.setMotivation);
  const insets = useSafeAreaInsets();

  // Staggered entrance animations
  const headingO = useSharedValue(0);
  const headingY = useSharedValue(16);
  const tile0O = useSharedValue(0);
  const tile1O = useSharedValue(0);
  const tile2O = useSharedValue(0);
  const tile3O = useSharedValue(0);

  useEffect(() => {
    headingO.value = withTiming(1, {duration: 400});
    headingY.value = withSpring(0, {damping: 20, stiffness: 140});
    tile0O.value = withDelay(150, withTiming(1, {duration: 350}));
    tile1O.value = withDelay(250, withTiming(1, {duration: 350}));
    tile2O.value = withDelay(350, withTiming(1, {duration: 350}));
    tile3O.value = withDelay(450, withTiming(1, {duration: 350}));
  }, [headingO, headingY, tile0O, tile1O, tile2O, tile3O]);

  const headingStyle = useAnimatedStyle(() => ({
    opacity: headingO.value,
    transform: [{translateY: headingY.value}],
  }));

  const tileStyles = [
    useAnimatedStyle(() => ({opacity: tile0O.value})),
    useAnimatedStyle(() => ({opacity: tile1O.value})),
    useAnimatedStyle(() => ({opacity: tile2O.value})),
    useAnimatedStyle(() => ({opacity: tile3O.value})),
  ];

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />
      <OBProgressBar current={1} total={10} />

      <View style={[styles.content, {paddingBottom: insets.bottom + 24}]}>
        <Animated.View style={[styles.header, headingStyle]}>
          <Text style={styles.heading}>What brings{'\n'}you here?</Text>
          <Text style={styles.sub}>We'll personalise your experience.</Text>
        </Animated.View>

        <View style={styles.grid}>
          {OPTIONS.map((opt, idx) => (
            <Animated.View key={opt.id} style={tileStyles[idx]}>
              <OBSelectionTile
                icon={
                  <opt.Icon
                    size={28}
                    color={motivation === opt.id ? '#E8A020' : '#8C93A0'}
                  />
                }
                label={opt.label}
                selected={motivation === opt.id}
                onPress={() => setMotivation(opt.id)}
                layout="grid"
              />
            </Animated.View>
          ))}
        </View>

        <OBPrimaryButton
          label={"Continue  →"}
          disabled={!motivation}
          onPress={() => {
            track('onboarding_motivation_set', {motivation});
            navigation.navigate('OB03_Frequency');
          }}
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
});

export default OB02_Motivation;
