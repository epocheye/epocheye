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
  StyleSheet,
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
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0A0F" />

      <View style={styles.content}>
        {/* Radar Animation Container */}
        <Animated.View
          style={[
            styles.radarContainer,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Wave rings */}
          <Animated.View
            style={[styles.waveRing, styles.wave1, createWaveStyle(wave1Anim)]}
          />
          <Animated.View
            style={[styles.waveRing, styles.wave2, createWaveStyle(wave2Anim)]}
          />
          <Animated.View
            style={[styles.waveRing, styles.wave3, createWaveStyle(wave3Anim)]}
          />

          {/* Center icon */}
          <Animated.View
            style={[
              styles.iconContainer,
              { transform: [{ scale: iconPulse }] },
            ]}
          >
            <View style={styles.iconInner}>
              <Wifi color="#FFFFFF" size={32} strokeWidth={2} />
              {/* X overlay */}
              <View style={styles.crossLine} />
            </View>
          </Animated.View>
        </Animated.View>

        {/* Text Content */}
        <Animated.View
          style={[
            styles.textContainer,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <Text style={styles.title}>No Connection</Text>
          <Text style={styles.subtitle}>
            Looks like you're offline. Check your internet connection and try
            again.
          </Text>
        </Animated.View>

        {/* Status indicator */}
        <Animated.View
          style={[
            styles.statusContainer,
            {
              opacity: fadeAnim,
            },
          ]}
        >
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>
            Searching for network
            <Animated.Text>{dots}</Animated.Text>
          </Text>
        </Animated.View>

        {/* Action Buttons */}
        <Animated.View
          style={[
            styles.buttonContainer,
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
            style={[styles.retryButton, isRefreshing && styles.buttonDisabled]}
            activeOpacity={0.8}
          >
            <Animated.View style={{ transform: [{ rotate: spin }] }}>
              <RefreshCcw color="#0A0A0F" size={20} strokeWidth={2.5} />
            </Animated.View>
            <Text style={styles.retryButtonText}>
              {isRefreshing ? 'Connecting' : 'Try Again'}
            </Text>
          </TouchableOpacity>

          {/* Secondary info cards */}
          <View style={styles.infoCards}>
            <View style={styles.infoCard}>
              <Signal color="#6366F1" size={18} />
              <Text style={styles.infoCardText}>Check signal</Text>
            </View>
            <View style={styles.infoCard}>
              <Radio color="#10B981" size={18} />
              <Text style={styles.infoCardText}>WiFi settings</Text>
            </View>
          </View>
        </Animated.View>
      </View>

      {/* Bottom text */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Connection will restore automatically
        </Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0F',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  radarContainer: {
    width: 180,
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 48,
  },
  waveRing: {
    position: 'absolute',
    borderRadius: 100,
    borderWidth: 1.5,
    borderColor: '#6366F1',
  },
  wave1: {
    width: 80,
    height: 80,
  },
  wave2: {
    width: 80,
    height: 80,
  },
  wave3: {
    width: 80,
    height: 80,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1A1A24',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#2A2A3A',
  },
  iconInner: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  crossLine: {
    position: 'absolute',
    width: 44,
    height: 3,
    backgroundColor: '#EF4444',
    borderRadius: 2,
    transform: [{ rotate: '45deg' }],
  },
  textContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Montserrat-Bold',
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    fontFamily: 'Montserrat-Regular',
    color: '#71717A',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 16,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 40,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#18181B',
    borderRadius: 20,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FBBF24',
    marginRight: 10,
  },
  statusText: {
    fontSize: 13,
    fontFamily: 'Montserrat-Medium',
    color: '#A1A1AA',
  },
  buttonContainer: {
    width: '100%',
    alignItems: 'center',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
    gap: 10,
    width: '100%',
    maxWidth: 280,
    marginBottom: 24,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  retryButtonText: {
    fontSize: 16,
    fontFamily: 'Montserrat-SemiBold',
    color: '#0A0A0F',
  },
  infoCards: {
    flexDirection: 'row',
    gap: 12,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181B',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  infoCardText: {
    fontSize: 13,
    fontFamily: 'Montserrat-Medium',
    color: '#A1A1AA',
  },
  footer: {
    paddingBottom: 24,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    fontFamily: 'Montserrat-Regular',
    color: '#3F3F46',
  },
});

export default NoInternetScreen;
