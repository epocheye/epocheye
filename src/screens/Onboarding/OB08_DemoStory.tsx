import React, {useEffect, useState, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ScrollView,
  ImageBackground,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {OB_COLORS, OB_TYPOGRAPHY} from '../../constants/onboarding';
import {FONTS, CDN_BASE} from '../../core/constants/theme';
import {useOnboardingStore} from '../../stores/onboardingStore';
import {track} from '../../services/analytics';
import OBProgressBar from '../../components/onboarding/OBProgressBar';
import OBPrimaryButton from '../../components/onboarding/OBPrimaryButton';
import type {OnboardingScreenProps} from '../../core/types/navigation.types';

type Props = OnboardingScreenProps<'OB08_DemoStory'>;

// Map monument names to CDN images as best-effort
const MONUMENT_IMAGES: Record<string, string> = {
  'Konark Sun Temple': `${CDN_BASE}monuments/Konarka_Temple-2.jpg`,
  'Rock-Hewn Churches of Lalibela': `${CDN_BASE}monuments/mesopotamia.jpg`,
  'Longmen Grottoes': `${CDN_BASE}monuments/china.jpg`,
  'Notre-Dame de Paris': `${CDN_BASE}monuments/victoria.jpg`,
  'Chichén Itzá': `${CDN_BASE}monuments/mesopotamia.jpg`,
  Persepolis: `${CDN_BASE}monuments/persia.jpg`,
  'Angkor Wat': `${CDN_BASE}monuments/tamil.jpg`,
};

const DEFAULT_IMAGE = `${CDN_BASE}monuments/Konarka_Temple-2.jpg`;

const SERIF_FONT = Platform.select({
  ios: 'Georgia',
  android: 'serif',
  default: 'serif',
});

const OB08_DemoStory: React.FC<Props> = ({navigation}) => {
  const {firstName, demoStory, demoMonument} = useOnboardingStore();
  const insets = useSafeAreaInsets();
  const [isStreaming, setIsStreaming] = useState(true);
  const [showEndCard, setShowEndCard] = useState(false);
  const [cursorVisible, setCursorVisible] = useState(true);
  const prevLenRef = useRef(0);
  const doneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Detect when story is complete (demoMonument gets set by onDone)
  useEffect(() => {
    if (demoMonument && demoStory.length > 0 && isStreaming) {
      // Story generation complete
      setIsStreaming(false);
      track('onboarding_story_generated', {monument: demoMonument});

      doneTimerRef.current = setTimeout(() => {
        setShowEndCard(true);
      }, 1200);
    }
    return () => {
      if (doneTimerRef.current) {
        clearTimeout(doneTimerRef.current);
      }
    };
  }, [demoMonument, demoStory.length, isStreaming]);

  // Blinking cursor
  useEffect(() => {
    if (!isStreaming) {
      setCursorVisible(false);
      return;
    }
    const interval = setInterval(() => {
      setCursorVisible((v) => !v);
    }, 500);
    return () => clearInterval(interval);
  }, [isStreaming]);

  const cardOpacity = useSharedValue(0);
  useEffect(() => {
    if (showEndCard) {
      cardOpacity.value = withTiming(1, {duration: 500});
    }
  }, [showEndCard, cardOpacity]);
  const cardStyle = useAnimatedStyle(() => ({opacity: cardOpacity.value}));

  const monumentImage = MONUMENT_IMAGES[demoMonument] ?? DEFAULT_IMAGE;

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />
      <OBProgressBar current={7} total={10} />

      {/* Monument image header */}
      <ImageBackground
        source={{uri: monumentImage}}
        style={styles.imageHeader}
        resizeMode="cover">
        <LinearGradient
          colors={['transparent', 'rgba(13,13,13,0.9)']}
          style={styles.imageGradient}>
          {demoMonument ? (
            <View style={styles.monumentLabel}>
              <Text style={styles.monumentName}>{demoMonument}</Text>
            </View>
          ) : null}
        </LinearGradient>
      </ImageBackground>

      {/* Story content */}
      <View style={styles.storySection}>
        <Text style={OB_TYPOGRAPHY.tiny}>YOUR ANCESTOR</Text>

        <ScrollView
          style={styles.storyScroll}
          contentContainerStyle={styles.storyScrollContent}
          showsVerticalScrollIndicator={false}>
          {demoStory.length === 0 ? (
            <View style={styles.loadingArea}>
              <View style={styles.shimmerLine} />
              <View style={[styles.shimmerLine, {width: '85%'}]} />
              <View style={[styles.shimmerLine, {width: '70%'}]} />
              <Text style={styles.loadingText}>Finding your ancestor...</Text>
            </View>
          ) : (
            <Text style={styles.storyText}>
              {demoStory}
              {isStreaming && cursorVisible ? '|' : ''}
            </Text>
          )}
        </ScrollView>
      </View>

      {/* End card + CTA */}
      {showEndCard && (
        <Animated.View
          style={[
            styles.endCard,
            {paddingBottom: insets.bottom + 24},
            cardStyle,
          ]}>
          <Text style={styles.endCardText}>
            {firstName}, this ancestor shares your lineage.
          </Text>
          <OBPrimaryButton
            label="This is real. Find mine. →"
            onPress={() => navigation.navigate('OB09_Reaction')}
          />
          <Text style={styles.disclaimer}>
            Every story is generated from historian-verified records.
          </Text>
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: OB_COLORS.bg,
  },
  imageHeader: {
    height: '38%',
  },
  imageGradient: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  monumentLabel: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  monumentName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: FONTS.bold,
  },
  storySection: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  storyScroll: {
    flex: 1,
    marginTop: 8,
  },
  storyScrollContent: {
    paddingBottom: 100,
  },
  storyText: {
    fontSize: 15,
    lineHeight: 26,
    color: '#FFFFFF',
    fontFamily: Platform.select({
      ios: 'Georgia',
      android: 'serif',
      default: 'serif',
    }),
  },
  loadingArea: {
    marginTop: 8,
    gap: 12,
  },
  shimmerLine: {
    height: 14,
    backgroundColor: '#2A2A2A',
    borderRadius: 4,
    width: '100%',
  },
  loadingText: {
    color: '#8C93A0',
    fontStyle: 'italic',
    fontSize: 13,
    marginTop: 8,
    fontFamily: FONTS.italic,
  },
  endCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: OB_COLORS.bg,
    paddingTop: 16,
  },
  endCardText: {
    fontStyle: 'italic',
    color: '#8C93A0',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
    marginHorizontal: 24,
    fontFamily: FONTS.italic,
  },
  disclaimer: {
    fontSize: 11,
    color: '#8C93A0',
    textAlign: 'center',
    marginTop: 12,
    marginHorizontal: 24,
    fontFamily: FONTS.regular,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

export default OB08_DemoStory;
