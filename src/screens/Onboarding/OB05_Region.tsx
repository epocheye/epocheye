import React, {useCallback, useEffect} from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  StatusBar,
  Dimensions,
  Pressable,
  ScrollView,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Check} from 'lucide-react-native';
import {CDN_BASE} from '../../core/constants/theme';
import {ROUTES} from '../../core/constants/routes';
import {useOnboardingStore, GoalType} from '../../stores/onboardingStore';
import OBProgressBar from '../../components/onboarding/OBProgressBar';
import OBPrimaryButton from '../../components/onboarding/OBPrimaryButton';
import {
  BG,
  GOLD,
  TEXT,
  TYPE,
  SPACING,
  RADIUS,
  BORDER,
} from '../../constants/onboarding';
import {track} from '../../services/analytics';
import type {OnboardingScreenProps} from '../../core/types/navigation.types';

type Props = OnboardingScreenProps<'OB05_Region'>;

const SCREEN_WIDTH = Dimensions.get('window').width;
const TILE_WIDTH = (SCREEN_WIDTH - SPACING.xxl * 2 - 12) / 2;
const TILE_HEIGHT = 130;

const REGIONS = [
  {label: 'South Asia', image: `${CDN_BASE}monuments/Konarka_Temple-2.jpg`},
  {label: 'Africa', image: `${CDN_BASE}monuments/mesopotamia.jpg`},
  {label: 'East Asia & Pacific', image: `${CDN_BASE}monuments/china.jpg`},
  {label: 'Europe', image: `${CDN_BASE}monuments/victoria.jpg`},
  {label: 'Americas', image: `${CDN_BASE}monuments/mesopotamia.jpg`},
  {
    label: 'Middle East & Central Asia',
    image: `${CDN_BASE}monuments/persia.jpg`,
  },
  {label: 'Southeast Asia', image: `${CDN_BASE}monuments/tamil.jpg`},
] as const;

const GOALS: ReadonlyArray<{label: string; value: GoalType}> = [
  {label: 'Easy', value: 'monthly'},
  {label: 'Weekly', value: 'weekly'},
  {label: 'Explorer', value: 'every_visit'},
];

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface RegionCardProps {
  label: string;
  image: string;
  selected: boolean;
  onPress: () => void;
}

const RegionCard: React.FC<RegionCardProps> = ({
  label,
  image,
  selected,
  onPress,
}) => {
  const scale = useSharedValue(1);
  const aStyle = useAnimatedStyle(() => ({
    transform: [{scale: scale.value}],
  }));

  return (
    <AnimatedPressable
      style={[
        styles.regionCard,
        {
          borderColor: selected ? GOLD.borderStrong : BORDER.subtle,
          borderWidth: selected ? 2 : 1,
        },
        aStyle,
      ]}
      onPressIn={() => {
        scale.value = withTiming(0.96, {duration: 60});
      }}
      onPressOut={() => {
        scale.value = withSpring(selected ? 1.02 : 1, {
          damping: 14,
          stiffness: 280,
        });
      }}
      onPress={onPress}>
      <Image
        source={{uri: image}}
        style={StyleSheet.absoluteFillObject}
        resizeMode="cover"
      />
      <LinearGradient
        colors={['transparent', 'rgba(7,6,12,0.90)']}
        style={StyleSheet.absoluteFillObject}
      />
      {selected ? (
        <View style={styles.goldOverlay} pointerEvents="none" />
      ) : null}
      {selected ? (
        <View style={styles.checkBadge}>
          <Check size={14} color={TEXT.dark} strokeWidth={3} />
        </View>
      ) : null}
      <Text style={styles.regionLabel} numberOfLines={2}>
        {label}
      </Text>
    </AnimatedPressable>
  );
};

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

const OB05_Region: React.FC<Props> = ({navigation}) => {
  const regions = useOnboardingStore(s => s.regions);
  const goal = useOnboardingStore(s => s.goal);
  const toggleRegion = useOnboardingStore(s => s.toggleRegion);
  const setGoal = useOnboardingStore(s => s.setGoal);
  const insets = useSafeAreaInsets();

  const headingO = useSharedValue(0);
  const headingY = useSharedValue(18);
  const gridO = useSharedValue(0);
  const goalO = useSharedValue(0);

  useEffect(() => {
    headingO.value = withTiming(1, {duration: 500});
    headingY.value = withSpring(0, {damping: 22, stiffness: 140});
    gridO.value = withDelay(200, withTiming(1, {duration: 500}));
    goalO.value = withDelay(500, withTiming(1, {duration: 500}));
  }, [headingO, headingY, gridO, goalO]);

  const sHeading = useAnimatedStyle(() => ({
    opacity: headingO.value,
    transform: [{translateY: headingY.value}],
  }));
  const sGrid = useAnimatedStyle(() => ({opacity: gridO.value}));
  const sGoal = useAnimatedStyle(() => ({opacity: goalO.value}));

  const handleToggle = useCallback(
    (label: string) => {
      try {
        ReactNativeHapticFeedback.trigger('impactLight', {
          enableVibrateFallback: true,
          ignoreAndroidSystemSettings: false,
        });
      } catch {}
      toggleRegion(label);
      const next = regions.includes(label)
        ? regions.filter(r => r !== label)
        : [...regions, label];
      track('onboarding_region_set', {regions: next});
    },
    [regions, toggleRegion],
  );

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />
      <OBProgressBar current={1} total={7} />

      <View style={styles.content}>
        <Animated.View style={[styles.header, sHeading]}>
          <Text style={styles.eyebrow}>STEP 2 OF 7</Text>
          <Text style={styles.heading}>
            Where does your{'\n'}story begin?
          </Text>
          <Text style={styles.sub}>Select all the lands that feel like home.</Text>
        </Animated.View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <Animated.View style={[styles.grid, sGrid]}>
            {REGIONS.map(r => (
              <RegionCard
                key={r.label}
                label={r.label}
                image={r.image}
                selected={regions.includes(r.label)}
                onPress={() => handleToggle(r.label)}
              />
            ))}
          </Animated.View>

          <Animated.View style={[styles.goalBlock, sGoal]}>
            <Text style={styles.sectionEyebrow}>YOUR DISCOVERY PACE</Text>
            <View style={styles.chipRow}>
              {GOALS.map(g => (
                <Chip
                  key={g.value}
                  label={g.label}
                  selected={goal === g.value}
                  onPress={() => setGoal(g.value)}
                />
              ))}
            </View>
          </Animated.View>

          {regions.length > 0 ? (
            <Text style={styles.preview}>
              We'll find ancestors from {regions.join(', ')}.
            </Text>
          ) : null}
        </ScrollView>

        <View style={{paddingBottom: insets.bottom + 24}}>
          <OBPrimaryButton
            label={"This is my heritage  →"}
            disabled={regions.length === 0}
            onPress={() => navigation.navigate(ROUTES.ONBOARDING.OB06_NAME)}
          />
        </View>
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
  },
  header: {
    paddingHorizontal: SPACING.xxl,
    marginTop: SPACING.lg,
    marginBottom: SPACING.lg,
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.xxl,
    paddingBottom: SPACING.lg,
    gap: SPACING.xl,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  regionCard: {
    width: TILE_WIDTH,
    height: TILE_HEIGHT,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    backgroundColor: BG.stone,
  },
  goldOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(201,168,76,0.15)',
  },
  checkBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: GOLD.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  regionLabel: {
    position: 'absolute',
    bottom: 10,
    left: 12,
    right: 12,
    ...TYPE.label,
    fontSize: 13,
    lineHeight: 18,
  },
  goalBlock: {
    gap: SPACING.md,
  },
  sectionEyebrow: {
    ...TYPE.uiTiny,
    color: TEXT.muted,
    letterSpacing: 1.8,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 10,
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
  preview: {
    ...TYPE.displayItalic,
    color: TEXT.secondary,
  },
});

export default OB05_Region;
