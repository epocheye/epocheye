/**
 * Feature walkthrough tooltips shown the first time a user enters the main app.
 * Steps through key features with a spotlight-style overlay.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Dimensions,
  Modal,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Camera, MapPin, Sparkles, Bookmark } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@epocheye/walkthrough_complete';

const { width: SCREEN_W } = Dimensions.get('window');

interface Step {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const STEPS: Step[] = [
  {
    icon: <Camera color="#D4860A" size={28} />,
    title: 'Lens',
    description:
      'Point your camera at any heritage site to discover its story through augmented reality.',
  },
  {
    icon: <MapPin color="#D4860A" size={28} />,
    title: 'Nearby Places',
    description:
      'Heritage sites near you appear automatically. Tap any to explore its history.',
  },
  {
    icon: <Sparkles color="#D4860A" size={28} />,
    title: 'Explorer Pass',
    description:
      'Get your Explorer Pass to unlock full experiences at the sites you want to visit.',
  },
  {
    icon: <Bookmark color="#D4860A" size={28} />,
    title: 'Saved',
    description:
      'Save places you want to visit later. Find them in your Saved tab anytime.',
  },
];

export interface OnboardingTooltipsProps {
  /** Called once the walkthrough is dismissed (user can be navigated, etc.) */
  onComplete?: () => void;
}

const OnboardingTooltips: React.FC<OnboardingTooltipsProps> = ({
  onComplete,
}) => {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const done = await AsyncStorage.getItem(STORAGE_KEY);
      if (!cancelled && done !== 'true') {
        // Short delay after main screen mounts
        setTimeout(() => {
          if (!cancelled) setVisible(true);
        }, 1200);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const finishWalkthrough = useCallback(async () => {
    setVisible(false);
    await AsyncStorage.setItem(STORAGE_KEY, 'true');
    onComplete?.();
  }, [onComplete]);

  const handleNext = useCallback(() => {
    if (step < STEPS.length - 1) {
      setStep(prev => prev + 1);
    } else {
      finishWalkthrough();
    }
  }, [step, finishWalkthrough]);

  const handleSkip = useCallback(() => {
    finishWalkthrough();
  }, [finishWalkthrough]);

  if (!visible) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleSkip}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {/* Step indicator */}
          <View style={styles.dotsRow}>
            {STEPS.map((_, i) => (
              <View
                key={`dot-${i}`}
                style={[styles.dot, i === step && styles.dotActive]}
              />
            ))}
          </View>

          {/* Icon */}
          <View style={styles.iconCircle}>{current.icon}</View>

          {/* Content */}
          <Text style={styles.title}>{current.title}</Text>
          <Text style={styles.description}>{current.description}</Text>

          {/* Buttons */}
          <TouchableOpacity
            onPress={handleNext}
            style={styles.nextBtn}
            accessibilityRole="button"
          >
            <Text style={styles.nextBtnText}>
              {isLast ? 'Got It' : 'Next'}
            </Text>
          </TouchableOpacity>

          {!isLast && (
            <TouchableOpacity
              onPress={handleSkip}
              style={styles.skipBtn}
              accessibilityRole="button"
            >
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = {
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  } as const,
  card: {
    width: '100%',
    maxWidth: SCREEN_W - 48,
    backgroundColor: '#141414',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(212,134,10,0.2)',
    padding: 28,
    alignItems: 'center',
  } as const,
  dotsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 24,
  } as const,
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
  } as const,
  dotActive: {
    width: 20,
    backgroundColor: '#C9A84C',
  } as const,
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(212,134,10,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  } as const,
  title: {
    color: '#F5F0E8',
    fontSize: 20,
    fontFamily: 'MontserratAlternates-Bold',
    textAlign: 'center',
  } as const,
  description: {
    color: '#B8AF9E',
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'MontserratAlternates-Regular',
    textAlign: 'center',
    marginTop: 8,
  } as const,
  nextBtn: {
    marginTop: 24,
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#D4860A',
    alignItems: 'center',
    justifyContent: 'center',
  } as const,
  nextBtnText: {
    color: '#0A0A0A',
    fontSize: 15,
    fontFamily: 'MontserratAlternates-Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  } as const,
  skipBtn: {
    marginTop: 8,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  } as const,
  skipText: {
    color: '#6B6357',
    fontSize: 14,
    fontFamily: 'MontserratAlternates-Medium',
  } as const,
};

export default OnboardingTooltips;
