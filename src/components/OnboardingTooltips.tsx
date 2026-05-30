/**
 * First-run feature tips for the main app.
 *
 * Non-blocking by design: the overlay container uses pointerEvents="box-none"
 * so only the tip card itself captures touches — the user can keep tapping the
 * map / UI underneath, and can dismiss the tips at any time (the X or "Skip").
 * Completion is persisted so the tips appear only once.
 */

import React, {useCallback, useEffect, useState} from 'react';
import {Pressable, Text, View} from 'react-native';
import Animated, {FadeInDown, FadeOutDown} from 'react-native-reanimated';
import {Bell, MapPin, Sparkles, Ticket, X} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {FONTS} from '../core/constants/theme';

const STORAGE_KEY = '@epocheye/walkthrough_complete';

interface Step {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const STEPS: Step[] = [
  {
    icon: <MapPin color="#C9A84C" size={22} />,
    title: 'Explore the map',
    description:
      'Heritage sites near you appear on the map. Tap a marker to see its details and story.',
  },
  {
    icon: <Bell color="#C9A84C" size={22} />,
    title: 'Stay in the loop',
    description:
      'Tap the bell at the top for updates, reminders, and news about the places you follow.',
  },
  {
    icon: <Ticket color="#C9A84C" size={22} />,
    title: 'Unlock with a Passport',
    description:
      'Get a Passport to unlock the full augmented-reality experience at the sites you visit.',
  },
  {
    icon: <Sparkles color="#C9A84C" size={22} />,
    title: 'Come back daily',
    description:
      'The Daily tab shows an “on this day” heritage moment and tracks your visit streak.',
  },
];

export interface OnboardingTooltipsProps {
  /** Called once the tips are dismissed or completed. */
  onComplete?: () => void;
  /** Distance from the bottom of the screen, to clear the tab bar. */
  bottomOffset?: number;
}

const OnboardingTooltips: React.FC<OnboardingTooltipsProps> = ({
  onComplete,
  bottomOffset = 96,
}) => {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const done = await AsyncStorage.getItem(STORAGE_KEY);
      if (!cancelled && done !== 'true') {
        setTimeout(() => {
          if (!cancelled) setVisible(true);
        }, 1200);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const finish = useCallback(async () => {
    setVisible(false);
    await AsyncStorage.setItem(STORAGE_KEY, 'true');
    onComplete?.();
  }, [onComplete]);

  const handleNext = useCallback(() => {
    setStep(prev => {
      if (prev < STEPS.length - 1) return prev + 1;
      void finish();
      return prev;
    });
  }, [finish]);

  if (!visible) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <View
      pointerEvents="box-none"
      style={{position: 'absolute', left: 0, right: 0, bottom: bottomOffset}}>
      <Animated.View
        entering={FadeInDown.duration(260)}
        exiting={FadeOutDown.duration(180)}
        className="mx-4 rounded-2xl bg-[#141414] border border-[rgba(201,168,76,0.35)] p-4"
        style={{
          shadowColor: '#000',
          shadowOpacity: 0.35,
          shadowRadius: 16,
          shadowOffset: {width: 0, height: 8},
          elevation: 12,
        }}>
        <View className="flex-row items-start">
          <View className="w-10 h-10 rounded-full bg-[rgba(201,168,76,0.12)] items-center justify-center mr-3">
            {current.icon}
          </View>
          <View className="flex-1 pr-2">
            <Text
              style={{fontFamily: FONTS.serif, fontSize: 17, color: '#F5F0E8', lineHeight: 21}}>
              {current.title}
            </Text>
            <Text
              style={{marginTop: 3, fontFamily: FONTS.sans, fontSize: 12, color: 'rgba(245,240,232,0.62)', lineHeight: 17}}>
              {current.description}
            </Text>
          </View>
          <Pressable
            onPress={finish}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Dismiss tips"
            className="w-7 h-7 rounded-full bg-[rgba(255,255,255,0.06)] items-center justify-center">
            <X color="rgba(245,240,232,0.6)" size={15} />
          </Pressable>
        </View>

        <View className="mt-3 flex-row items-center justify-between">
          <View className="flex-row gap-1.5">
            {STEPS.map((_, i) => (
              <View
                key={`tip-dot-${i}`}
                style={{
                  width: i === step ? 18 : 7,
                  height: 7,
                  borderRadius: 4,
                  backgroundColor:
                    i === step ? '#C9A84C' : 'rgba(255,255,255,0.18)',
                }}
              />
            ))}
          </View>
          <Pressable
            onPress={handleNext}
            accessibilityRole="button"
            accessibilityLabel={isLast ? 'Got it' : 'Next tip'}
            className="px-4 py-2 rounded-full bg-[#C9A84C]">
            <Text style={{fontFamily: FONTS.sansSemiBold, fontSize: 13, color: '#0A0A0A'}}>
              {isLast ? 'Got it' : 'Next'}
            </Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
};

export default OnboardingTooltips;
