/**
 * No Internet Screen
 * A minimalist, elegant offline screen with smooth animations
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  Easing,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Wifi, RefreshCcw, Signal, Radio } from 'lucide-react-native';
import { useNetwork } from '../context/NetworkContext';

const NoInternetScreen: React.FC = () => {
  const { checkConnection } = useNetwork();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const wave1Anim = useRef(new Animated.Value(0)).current;
  const wave2Anim = useRef(new Animated.Value(0)).current;
  const wave3Anim = useRef(new Animated.Value(0)).current;
  const iconPulse = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const dotAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Entry animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    // Radar wave animations - staggered
    const createWaveAnimation = (animValue: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.timing(animValue, {
              toValue: 1,
              duration: 2000,
              easing: Easing.out(Easing.ease),
              useNativeDriver: true,
            }),
          ]),
          Animated.timing(animValue, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      );
    };

    createWaveAnimation(wave1Anim, 0).start();
    createWaveAnimation(wave2Anim, 600).start();
    createWaveAnimation(wave3Anim, 1200).start();

    // Icon pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(iconPulse, {
          toValue: 1.1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(iconPulse, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ).start();

    // Dot animation for "Searching..."
    Animated.loop(
      Animated.timing(dotAnim, {
        toValue: 3,
        duration: 1500,
        easing: Easing.linear,
        useNativeDriver: false,
      }),
    ).start();
  }, [
    fadeAnim,
    scaleAnim,
    wave1Anim,
    wave2Anim,
    wave3Anim,
    iconPulse,
    dotAnim,
  ]);

  const handleRetry = async () => {
    setIsRefreshing(true);

    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 800,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();

    await checkConnection();

    setTimeout(() => {
      rotateAnim.stopAnimation();
      rotateAnim.setValue(0);
      setIsRefreshing(false);
    }, 1500);
  };

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const createWaveStyle = (animValue: Animated.Value) => ({
    opacity: animValue.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [0.6, 0.3, 0],
    }),
    transform: [
      {
        scale: animValue.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 2.5],
        }),
      },
    ],
  });

  const dots = dotAnim.interpolate({
    inputRange: [0, 1, 2, 3],
    outputRange: ['', '.', '..', '...'],
  });

  return (
    <SafeAreaView className="flex-1 bg-[#0A0A0F]">
      <StatusBar barStyle="light-content" backgroundColor="#0A0A0F" />

      <View className="flex-1 items-center justify-center px-8">
        {/* Radar Animation Container */}
        <Animated.View
          className="mb-12 h-[180px] w-[180px] items-center justify-center"
          style={[
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Wave rings */}
          <Animated.View
            className="absolute h-20 w-20 rounded-full border-[1.5px] border-[#6366F1]"
            style={createWaveStyle(wave1Anim)}
          />
          <Animated.View
            className="absolute h-20 w-20 rounded-full border-[1.5px] border-[#6366F1]"
            style={createWaveStyle(wave2Anim)}
          />
          <Animated.View
            className="absolute h-20 w-20 rounded-full border-[1.5px] border-[#6366F1]"
            style={createWaveStyle(wave3Anim)}
          />

          {/* Center icon */}
          <Animated.View
            className="h-20 w-20 items-center justify-center rounded-full border-2 border-[#2A2A3A] bg-[#1A1A24]"
            style={{ transform: [{ scale: iconPulse }] }}
          >
            <View className="relative items-center justify-center">
              <Wifi color="#FFFFFF" size={32} strokeWidth={2} />
              {/* X overlay */}
              <View
                className="absolute h-[3px] w-11 rounded-[2px] bg-status-danger"
                style={{ transform: [{ rotate: '45deg' }] }}
              />
            </View>
          </Animated.View>
        </Animated.View>

        {/* Text Content */}
        <Animated.View
          className="mb-6 items-center"
          style={[
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <Text className="mb-3 text-center font-['Montserrat-Bold'] text-[28px] text-white">
            No Connection
          </Text>
          <Text className="px-4 text-center font-['Montserrat-Regular'] text-[15px] leading-[22px] text-[#71717A]">
            Looks like you're offline. Check your internet connection and try
            again.
          </Text>
        </Animated.View>

        {/* Status indicator */}
        <Animated.View
          className="mb-10 flex-row items-center rounded-[20px] bg-[#18181B] px-4 py-2.5"
          style={[
            {
              opacity: fadeAnim,
            },
          ]}
        >
          <View className="mr-2.5 h-2 w-2 rounded-full bg-[#FBBF24]" />
          <Text className="font-['Montserrat-Medium'] text-[13px] text-[#A1A1AA]">
            Searching for network
            <Animated.Text>{dots}</Animated.Text>
          </Text>
        </Animated.View>

        {/* Action Buttons */}
        <Animated.View
          className="w-full items-center"
          style={[
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Primary Retry Button */}
          <TouchableOpacity
            onPress={handleRetry}
            disabled={isRefreshing}
            className={`mb-6 w-full max-w-[280px] flex-row items-center justify-center gap-2.5 rounded-2xl bg-white px-8 py-4 ${
              isRefreshing ? 'opacity-70' : ''
            }`}
            activeOpacity={0.8}
          >
            <Animated.View style={{ transform: [{ rotate: spin }] }}>
              <RefreshCcw color="#0A0A0F" size={20} strokeWidth={2.5} />
            </Animated.View>
            <Text className="font-['Montserrat-SemiBold'] text-base text-[#0A0A0F]">
              {isRefreshing ? 'Connecting' : 'Try Again'}
            </Text>
          </TouchableOpacity>

          {/* Secondary info cards */}
          <View className="flex-row gap-3">
            <View className="flex-row items-center gap-2 rounded-xl border border-[#27272A] bg-[#18181B] px-4 py-3">
              <Signal color="#6366F1" size={18} />
              <Text className="font-['Montserrat-Medium'] text-[13px] text-[#A1A1AA]">
                Check signal
              </Text>
            </View>
            <View className="flex-row items-center gap-2 rounded-xl border border-[#27272A] bg-[#18181B] px-4 py-3">
              <Radio color="#10B981" size={18} />
              <Text className="font-['Montserrat-Medium'] text-[13px] text-[#A1A1AA]">
                WiFi settings
              </Text>
            </View>
          </View>
        </Animated.View>
      </View>

      {/* Bottom text */}
      <View className="items-center pb-6">
        <Text className="font-['Montserrat-Regular'] text-xs text-[#3F3F46]">
          Connection will restore automatically
        </Text>
      </View>
    </SafeAreaView>
  );
};

export default NoInternetScreen;
