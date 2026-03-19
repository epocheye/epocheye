import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Image,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  Easing,
} from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import { FONTS, COLORS, FONT_SIZES, RADIUS } from '../../core/constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface MonumentCardProps {
  story: string;
  monumentName: string;
  year: string;
  imageUrl?: string;
  onTypewriterComplete: () => void;
}

/**
 * Monument card with Ken Burns animation, CDN image,
 * gradient overlay, and typewriter text reveal.
 *
 * IMPORTANT: words and onTypewriterComplete are stored in refs so the
 * typewriter effect runs exactly once on mount. Storing them as plain
 * variables caused a cascade: every setDisplayedWords call triggered a
 * re-render → new words array reference → new startTypewriter function →
 * useEffect fired again → multiple intervals piled up simultaneously.
 */
const MonumentCard: React.FC<MonumentCardProps> = ({
  story,
  monumentName,
  year,
  imageUrl,
  onTypewriterComplete,
}) => {
  const [displayedText, setDisplayedText] = useState('');
  const [imageLoaded, setImageLoaded] = useState(false);

  // Stable refs — never stale, never cause effect re-runs
  const wordsRef = useRef<string[]>(story.split(' '));
  const onCompleteRef = useRef(onTypewriterComplete);
  useEffect(() => {
    onCompleteRef.current = onTypewriterComplete;
  }, [onTypewriterComplete]);

  // Ken Burns: slow scale from 1.0 to 1.08 over 8s, looping
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(
      withTiming(1.08, { duration: 8000, easing: Easing.linear }),
      -1,
      true,
    );
  }, [scale]);

  const imageAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  // Typewriter: runs exactly once on mount. No deps that change during typing.
  useEffect(() => {
    const words = wordsRef.current;
    let index = 0;

    const interval = setInterval(() => {
      index += 1;
      setDisplayedText(words.slice(0, index).join(' '));

      if (index >= words.length) {
        clearInterval(interval);
        onCompleteRef.current();
      }
    }, 65);

    return () => clearInterval(interval);
  }, []); // intentionally empty — must run only once on mount

  return (
    <View style={styles.card}>
      {/* Background with Ken Burns animation */}
      <Animated.View style={[styles.imageBg, imageAnimStyle]}>
        {imageUrl ? (
          <>
            {!imageLoaded && (
              <LinearGradient
                colors={['#3A2A1A', '#2A1A0A', '#1A1208']}
                style={StyleSheet.absoluteFill}
              />
            )}
            <Image
              source={{ uri: imageUrl }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
              onLoad={() => setImageLoaded(true)}
            />
          </>
        ) : (
          <LinearGradient
            colors={['#3A2A1A', '#2A1A0A', '#1A1208']}
            style={StyleSheet.absoluteFill}
          />
        )}
      </Animated.View>

      {/* Dark gradient overlay from bottom */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.88)']}
        locations={[0.15, 0.65]}
        style={styles.overlay}
      />

      {/* Monument name — top left */}
      <View style={styles.monumentTag}>
        <Text style={styles.monumentName}>{monumentName}</Text>
      </View>

      {/* Year badge — top right */}
      <View style={styles.yearTag}>
        <Text style={styles.yearBadge}>{year}</Text>
      </View>

      {/* Typewriter story text — bottom */}
      <View style={styles.storyContainer}>
        <Text style={styles.storyText}>{displayedText}</Text>
      </View>
    </View>
  );
};

const CARD_WIDTH = SCREEN_WIDTH - 48;

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: 440,
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
    alignSelf: 'center',
  },
  imageBg: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  monumentTag: {
    position: 'absolute',
    top: 16,
    left: 16,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  monumentName: {
    fontFamily: FONTS.semiBold,
    fontSize: FONT_SIZES.caption,
    color: COLORS.amber,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  yearTag: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  yearBadge: {
    fontFamily: FONTS.semiBold,
    fontSize: FONT_SIZES.caption,
    color: COLORS.amber,
    letterSpacing: 1.5,
  },
  storyContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
  },
  storyText: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZES.subtitle,
    color: COLORS.textPrimary,
    lineHeight: 28,
  },
});

export default MonumentCard;
