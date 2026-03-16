import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  Easing,
} from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface MonumentCardProps {
  story: string;
  monumentName: string;
  year: string;
  onTypewriterComplete: () => void;
}

/**
 * Monument card with Ken Burns animation, gradient overlay,
 * and typewriter text reveal for the ancestor story.
 */
const MonumentCard: React.FC<MonumentCardProps> = ({
  story,
  monumentName,
  year,
  onTypewriterComplete,
}) => {
  const [displayedWords, setDisplayedWords] = useState<string[]>([]);
  const words = story.split(' ');

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

  // Typewriter effect: reveal one word every 60ms
  const typewriterComplete = React.useRef(false);

  const startTypewriter = useCallback(() => {
    let index = 0;
    const interval = setInterval(() => {
      index += 1;
      if (index <= words.length) {
        setDisplayedWords(words.slice(0, index));
      }
      if (index >= words.length) {
        clearInterval(interval);
        if (!typewriterComplete.current) {
          typewriterComplete.current = true;
          onTypewriterComplete();
        }
      }
    }, 60);

    return () => clearInterval(interval);
  }, [words, onTypewriterComplete]);

  useEffect(() => {
    const cleanup = startTypewriter();
    return cleanup;
  }, [startTypewriter]);

  return (
    <View style={styles.card}>
      {/* Background with Ken Burns animation — placeholder color since no image asset */}
      <Animated.View style={[styles.imageBg, imageAnimStyle]}>
        <LinearGradient
          colors={['#3A2A1A', '#2A1A0A', '#1A1208']}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* Dark gradient overlay from bottom */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.85)']}
        locations={[0.25, 0.75]}
        style={styles.overlay}
      />

      {/* Monument name — top left */}
      <Text style={styles.monumentName}>{monumentName}</Text>

      {/* Year badge — top right */}
      <Text style={styles.yearBadge}>{year}</Text>

      {/* Typewriter story text — bottom */}
      <View style={styles.storyContainer}>
        <Text style={styles.storyText}>{displayedWords.join(' ')}</Text>
      </View>
    </View>
  );
};

const CARD_WIDTH = SCREEN_WIDTH - 48;

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: 420,
    borderRadius: 20,
    overflow: 'hidden',
    alignSelf: 'center',
  },
  imageBg: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  monumentName: {
    position: 'absolute',
    top: 16,
    left: 16,
    fontFamily: 'DMSans-Regular',
    fontSize: 13,
    color: '#D4860A',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  yearBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    fontFamily: 'DMSans-Regular',
    fontSize: 13,
    color: '#D4860A',
    letterSpacing: 2,
  },
  storyContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
  },
  storyText: {
    fontFamily: 'CormorantGaramond-Regular',
    fontSize: 22,
    color: '#FFFFFF',
    lineHeight: 32,
  },
});

export default MonumentCard;
