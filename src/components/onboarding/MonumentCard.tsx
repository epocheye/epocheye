import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Dimensions, Image } from 'react-native';
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
    <View
      className="h-[440px] self-center overflow-hidden rounded-[20px]"
      style={{ width: CARD_WIDTH }}
    >
      {/* Background with Ken Burns animation */}
      <Animated.View className="absolute inset-0" style={imageAnimStyle}>
        {imageUrl ? (
          <>
            {!imageLoaded && (
              <LinearGradient
                colors={['#3A2A1A', '#2A1A0A', '#1A1208']}
                className="absolute inset-0"
              />
            )}
            <Image
              source={{ uri: imageUrl }}
              className="absolute inset-0"
              resizeMode="cover"
              onLoad={() => setImageLoaded(true)}
            />
          </>
        ) : (
          <LinearGradient
            colors={['#3A2A1A', '#2A1A0A', '#1A1208']}
            className="absolute inset-0"
          />
        )}
      </Animated.View>

      {/* Dark gradient overlay from bottom */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.88)']}
        locations={[0.15, 0.65]}
        className="absolute inset-0"
      />

      {/* Monument name — top left */}
      <View className="absolute left-4 top-4 rounded-md bg-[rgba(0,0,0,0.45)] px-2.5 py-1">
        <Text className="font-['MontserratAlternates-SemiBold'] text-[12px] uppercase tracking-[1.5px] text-[#D4860A]">
          {monumentName}
        </Text>
      </View>

      {/* Year badge — top right */}
      <View className="absolute right-4 top-4 rounded-md bg-[rgba(0,0,0,0.45)] px-2.5 py-1">
        <Text className="font-['MontserratAlternates-SemiBold'] text-[12px] tracking-[1.5px] text-[#D4860A]">
          {year}
        </Text>
      </View>

      {/* Typewriter story text — bottom */}
      <View className="absolute bottom-0 left-0 right-0 p-5">
        <Text className="font-['MontserratAlternates-Regular'] text-[18px] leading-7 text-[#F5E9D8]">
          {displayedText}
        </Text>
      </View>
    </View>
  );
};

const CARD_WIDTH = SCREEN_WIDTH - 48;

export default MonumentCard;
