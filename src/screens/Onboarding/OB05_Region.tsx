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
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Check} from 'lucide-react-native';
import {OB_COLORS} from '../../constants/onboarding';
import {FONTS, CDN_BASE} from '../../core/constants/theme';
import {useOnboardingStore} from '../../stores/onboardingStore';
import OBProgressBar from '../../components/onboarding/OBProgressBar';
import OBPrimaryButton from '../../components/onboarding/OBPrimaryButton';
import {track} from '../../services/analytics';
import type {OnboardingScreenProps} from '../../core/types/navigation.types';

type Props = OnboardingScreenProps<'OB05_Region'>;

const SCREEN_WIDTH = Dimensions.get('window').width;
const TILE_WIDTH = (SCREEN_WIDTH - 48 - 12) / 2;
const TILE_HEIGHT = 100;

const REGIONS = [
  {label: 'South Asia', image: `${CDN_BASE}monuments/Konarka_Temple-2.jpg`},
  {label: 'Africa', image: `${CDN_BASE}monuments/mesopotamia.jpg`},
  {label: 'East Asia & Pacific', image: `${CDN_BASE}monuments/china.jpg`},
  {label: 'Europe', image: `${CDN_BASE}monuments/victoria.jpg`},
  {label: 'Americas', image: `${CDN_BASE}monuments/mesopotamia.jpg`},
  {label: 'Middle East & Central Asia', image: `${CDN_BASE}monuments/persia.jpg`},
  {label: 'Southeast Asia', image: `${CDN_BASE}monuments/tamil.jpg`},
] as const;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface RegionCardProps {
  label: string;
  image: string;
  selected: boolean;
  onPress: () => void;
}

const RegionCard: React.FC<RegionCardProps> = ({label, image, selected, onPress}) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{scale: scale.value}],
  }));

  const handlePressIn = () => {
    scale.value = withTiming(0.96, {duration: 60});
  };

  const handlePressOut = () => {
    scale.value = withSpring(selected ? 1.02 : 1, {damping: 14, stiffness: 280});
  };

  return (
    <AnimatedPressable
      style={[
        styles.regionCard,
        {
          borderColor: selected
            ? 'rgba(232, 160, 32, 0.8)'
            : 'rgba(255, 255, 255, 0.08)',
          borderWidth: selected ? 2 : 1,
        },
        animatedStyle,
      ]}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}>
      <Image source={{uri: image}} style={styles.regionImage} resizeMode="cover" />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.85)']}
        style={styles.regionGradient}
      />
      {selected && (
        <View style={styles.checkBadge}>
          <Check size={14} color="#0D0D0D" strokeWidth={3} />
        </View>
      )}
      <Text style={styles.regionLabel} numberOfLines={2}>
        {label}
      </Text>
    </AnimatedPressable>
  );
};

const OB05_Region: React.FC<Props> = ({navigation}) => {
  const regions = useOnboardingStore(s => s.regions);
  const toggleRegion = useOnboardingStore(s => s.toggleRegion);
  const insets = useSafeAreaInsets();

  const headingO = useSharedValue(0);
  const headingY = useSharedValue(16);

  useEffect(() => {
    headingO.value = withTiming(1, {duration: 400});
    headingY.value = withSpring(0, {damping: 20, stiffness: 140});
  }, [headingO, headingY]);

  const headingStyle = useAnimatedStyle(() => ({
    opacity: headingO.value,
    transform: [{translateY: headingY.value}],
  }));

  const handleToggle = useCallback(
    (label: string) => {
      try {
        ReactNativeHapticFeedback.trigger('impactLight', {
          enableVibrateFallback: true,
          ignoreAndroidSystemSettings: false,
        });
      } catch {}
      toggleRegion(label);
    },
    [toggleRegion],
  );

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />
      <OBProgressBar current={4} total={10} />

      <View style={styles.content}>
        <Animated.View style={[styles.header, headingStyle]}>
          <Text style={styles.heading}>
            Where does your{'\n'}lineage trace back?
          </Text>
          <Text style={styles.sub}>Select all that apply.</Text>
        </Animated.View>

        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.gridContent}
          showsVerticalScrollIndicator={false}>
          <View style={styles.grid}>
            {REGIONS.map(r => (
              <RegionCard
                key={r.label}
                label={r.label}
                image={r.image}
                selected={regions.includes(r.label)}
                onPress={() => handleToggle(r.label)}
              />
            ))}
          </View>
        </ScrollView>

        {regions.length > 0 && (
          <Text style={styles.preview}>
            We'll find ancestors from {regions.join(', ')}.
          </Text>
        )}

        <View style={{paddingBottom: insets.bottom + 24}}>
          <OBPrimaryButton
            label={"This is my heritage  →"}
            disabled={regions.length === 0}
            onPress={() => {
              track('onboarding_region_set', {regions});
              navigation.navigate('OB06_Name');
            }}
          />
        </View>
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
  },
  header: {
    paddingHorizontal: 28,
    marginTop: 32,
    marginBottom: 20,
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
  scrollArea: {
    flex: 1,
  },
  gridContent: {
    paddingHorizontal: 24,
    paddingBottom: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  regionCard: {
    width: TILE_WIDTH,
    height: TILE_HEIGHT,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#1A1A1A',
  },
  regionImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  regionGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  checkBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E8A020',
    alignItems: 'center',
    justifyContent: 'center',
  },
  regionLabel: {
    position: 'absolute',
    bottom: 10,
    left: 12,
    right: 12,
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: FONTS.bold,
  },
  preview: {
    color: '#8C93A0',
    fontSize: 13,
    fontStyle: 'italic',
    marginVertical: 10,
    marginHorizontal: 28,
    fontFamily: FONTS.italic,
  },
});

export default OB05_Region;
