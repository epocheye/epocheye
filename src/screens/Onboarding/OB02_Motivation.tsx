import React, {useEffect} from 'react';
import {View, Text, StyleSheet, StatusBar, Pressable} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Landmark, Globe, TreePine, BookOpen} from 'lucide-react-native';
import {
  useOnboardingStore,
  VisitFrequencyType,
} from '../../stores/onboardingStore';
import {ROUTES} from '../../core/constants/routes';
import OBProgressBar from '../../components/onboarding/OBProgressBar';
import OBPrimaryButton from '../../components/onboarding/OBPrimaryButton';
import OBSelectionTile from '../../components/onboarding/OBSelectionTile';
import {
  BG,
  GOLD,
  TEXT,
  TYPE,
  SPACING,
  BORDER,
  RADIUS,
} from '../../constants/onboarding';
import {track} from '../../services/analytics';
import type {OnboardingScreenProps} from '../../core/types/navigation.types';

type Props = OnboardingScreenProps<'OB02_Motivation'>;

const MOTIVATIONS = [
  {id: 'heritage_visitor', label: 'I visit heritage sites', Icon: Landmark},
  {id: 'traveller', label: 'I love to travel', Icon: Globe},
  {id: 'roots', label: 'I want to know my roots', Icon: TreePine},
  {id: 'history_lover', label: 'I love history', Icon: BookOpen},
] as const;

const FREQUENCIES: ReadonlyArray<{label: string; value: VisitFrequencyType}> = [
  {label: 'Rarely', value: 'rarely'},
  {label: 'Monthly', value: 'occasional'},
  {label: 'Often', value: 'frequent'},
];

const Chip: React.FC<{
  label: string;
  selected: boolean;
  onPress: () => void;
}> = ({label, selected, onPress}) => {
  const scale = useSharedValue(1);
  const aStyle = useAnimatedStyle(() => ({
    transform: [{scale: scale.value}],
  }));
  return (
    <Animated.View style={[{flex: 1}, aStyle]}>
      <Pressable
        onPress={() => {
          try {
            ReactNativeHapticFeedback.trigger('impactLight', {
              enableVibrateFallback: true,
              ignoreAndroidSystemSettings: false,
            });
          } catch {}
          onPress();
        }}
        onPressIn={() => {
          scale.value = withTiming(0.96, {duration: 60});
        }}
        onPressOut={() => {
          scale.value = withSpring(1, {damping: 14, stiffness: 280});
        }}
        style={[
          styles.chip,
          {
            borderColor: selected ? GOLD.borderStrong : BORDER.subtle,
            backgroundColor: selected ? GOLD.subtle : BG.glass,
          },
        ]}>
        <Text
          style={[
            styles.chipText,
            {color: selected ? GOLD.text : TEXT.secondary},
          ]}>
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
};

const OB02_Motivation: React.FC<Props> = ({navigation}) => {
  const motivation = useOnboardingStore(s => s.motivation);
  const visitFrequency = useOnboardingStore(s => s.visitFrequency);
  const setMotivation = useOnboardingStore(s => s.setMotivation);
  const setVisitFrequency = useOnboardingStore(s => s.setVisitFrequency);
  const insets = useSafeAreaInsets();

  const headingO = useSharedValue(0);
  const headingY = useSharedValue(18);
  const tilesO = useSharedValue(0);
  const freqO = useSharedValue(0);

  useEffect(() => {
    headingO.value = withTiming(1, {duration: 500});
    headingY.value = withSpring(0, {damping: 22, stiffness: 140});
    tilesO.value = withDelay(200, withTiming(1, {duration: 500}));
    freqO.value = withDelay(500, withTiming(1, {duration: 500}));
  }, [headingO, headingY, tilesO, freqO]);

  const sHeading = useAnimatedStyle(() => ({
    opacity: headingO.value,
    transform: [{translateY: headingY.value}],
  }));
  const sTiles = useAnimatedStyle(() => ({opacity: tilesO.value}));
  const sFreq = useAnimatedStyle(() => ({opacity: freqO.value}));

  const canContinue = !!motivation && !!visitFrequency;

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />
      <OBProgressBar current={0} total={7} />

      <View style={[styles.content, {paddingBottom: insets.bottom + 24}]}>
        <Animated.View style={[styles.header, sHeading]}>
          <Text style={styles.eyebrow}>STEP 1 OF 7</Text>
          <Text style={styles.heading}>Tell us about yourself.</Text>
          <Text style={styles.sub}>
            Two quick questions so we know where to start.
          </Text>
        </Animated.View>

        <Animated.View style={[styles.section, sTiles]}>
          <Text style={styles.sectionEyebrow}>WHAT DRAWS YOU IN</Text>
          <View style={styles.grid}>
            {MOTIVATIONS.map(opt => (
              <OBSelectionTile
                key={opt.id}
                layout="grid"
                icon={
                  <opt.Icon
                    size={30}
                    color={motivation === opt.id ? GOLD.primary : TEXT.muted}
                  />
                }
                label={opt.label}
                selected={motivation === opt.id}
                onPress={() => setMotivation(opt.id)}
              />
            ))}
          </View>
        </Animated.View>

        <View style={styles.divider} />

        <Animated.View style={[styles.section, sFreq]}>
          <Text style={styles.sectionEyebrow}>
            HOW OFTEN YOU VISIT HERITAGE SITES
          </Text>
          <View style={styles.chipRow}>
            {FREQUENCIES.map(f => (
              <Chip
                key={f.value}
                label={f.label}
                selected={visitFrequency === f.value}
                onPress={() => setVisitFrequency(f.value)}
              />
            ))}
          </View>
        </Animated.View>

        <OBPrimaryButton
          label={"Continue  →"}
          disabled={!canContinue}
          onPress={() => {
            track('onboarding_motivation_set', {
              motivation,
              visitFrequency,
            });
            navigation.navigate(ROUTES.ONBOARDING.OB05_REGION);
          }}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG.deep,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingTop: SPACING.sm,
  },
  header: {
    paddingHorizontal: SPACING.xxl,
    marginTop: SPACING.lg,
  },
  eyebrow: {
    ...TYPE.uiTiny,
    color: GOLD.text,
    letterSpacing: 2.4,
    marginBottom: SPACING.sm,
  },
  heading: {
    ...TYPE.displayLarge,
    fontSize: 28,
    lineHeight: 36,
  },
  sub: {
    ...TYPE.uiSmall,
    color: TEXT.secondary,
    marginTop: SPACING.sm,
  },
  section: {
    gap: SPACING.md,
  },
  sectionEyebrow: {
    ...TYPE.uiTiny,
    color: TEXT.muted,
    letterSpacing: 1.8,
    marginHorizontal: SPACING.xxl,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: SPACING.xxl,
    justifyContent: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: BORDER.subtle,
    marginHorizontal: SPACING.xxl,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: SPACING.xxl,
  },
  chip: {
    height: 48,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: {
    ...TYPE.label,
  },
});

export default OB02_Motivation;
