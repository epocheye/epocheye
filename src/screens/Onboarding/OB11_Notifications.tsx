import React, {useEffect} from 'react';
import {View, Text, StyleSheet, StatusBar} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {BellRing} from 'lucide-react-native';
import {requestNotifications, RESULTS} from 'react-native-permissions';
import {fcmRegisterAfterPermission} from '../../services/fcmService';
import {OB_COLORS} from '../../constants/onboarding';
import {FONTS} from '../../core/constants/theme';
import OBProgressBar from '../../components/onboarding/OBProgressBar';
import OBPrimaryButton from '../../components/onboarding/OBPrimaryButton';
import OBSkipLink from '../../components/onboarding/OBSkipLink';
import type {OnboardingScreenProps} from '../../core/types/navigation.types';

type Props = OnboardingScreenProps<'OB11_Notifications'>;

const OB11_Notifications: React.FC<Props> = ({navigation}) => {
  const insets = useSafeAreaInsets();

  // Bell wiggle animation (rotate oscillation)
  const rotate = useSharedValue(0);
  const bellScale = useSharedValue(0.9);

  // Entrance animations
  const headingO = useSharedValue(0);
  const headingY = useSharedValue(16);
  const descO = useSharedValue(0);

  useEffect(() => {
    // Entrance
    headingO.value = withTiming(1, {duration: 400});
    headingY.value = withSpring(0, {damping: 20, stiffness: 140});
    descO.value = withTiming(1, {duration: 500});

    // Bell spring in
    bellScale.value = withSpring(1, {damping: 10, stiffness: 100});

    // Bell wiggle — rotateZ oscillation
    rotate.value = withRepeat(
      withSequence(
        withTiming(12, {duration: 150, easing: Easing.inOut(Easing.ease)}),
        withTiming(-10, {duration: 150, easing: Easing.inOut(Easing.ease)}),
        withTiming(8, {duration: 120, easing: Easing.inOut(Easing.ease)}),
        withTiming(-6, {duration: 120, easing: Easing.inOut(Easing.ease)}),
        withTiming(0, {duration: 100, easing: Easing.inOut(Easing.ease)}),
        withTiming(0, {duration: 1800}), // pause between wiggles
      ),
      -1,
      false,
    );
  }, [rotate, bellScale, headingO, headingY, descO]);

  const bellStyle = useAnimatedStyle(() => ({
    transform: [{rotateZ: `${rotate.value}deg`}, {scale: bellScale.value}],
  }));
  const sHeading = useAnimatedStyle(() => ({
    opacity: headingO.value,
    transform: [{translateY: headingY.value}],
  }));
  const sDesc = useAnimatedStyle(() => ({opacity: descO.value}));

  const handleEnable = async () => {
    try {
      const {status} = await requestNotifications(['alert', 'badge', 'sound']);
      if (status === RESULTS.GRANTED || status === RESULTS.LIMITED) {
        // Push the FCM token to the backend now that we're allowed to receive
        // notifications. Fire-and-forget — next-launch fcmInit() is the safety net.
        void fcmRegisterAfterPermission();
      }
    } catch {}
    navigation.navigate('OB12_Arrival');
  };

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />
      <OBProgressBar current={9} total={10} />

      <View style={[styles.content, {paddingBottom: insets.bottom + 24}]}>
        <Animated.View style={[styles.header, sHeading]}>
          <Text style={styles.heading}>
            Know when history{'\n'}is near you.
          </Text>
          <Text style={styles.sub}>
            We'll notify you when you're close to a heritage site.
          </Text>
        </Animated.View>

        <View style={styles.centerArea}>
          {/* Subtle ambient glow behind bell */}
          <View style={styles.bellGlow} />
          <Animated.View style={bellStyle}>
            <BellRing size={72} color="#E8A020" />
          </Animated.View>

          <Animated.Text style={[styles.description, sDesc]}>
            Get notified the moment your ancestor is within reach.
          </Animated.Text>
        </View>

        <View>
          <OBPrimaryButton label={"Yes, notify me  →"} onPress={handleEnable} />
          <OBSkipLink
            label="Maybe later"
            onPress={() => navigation.navigate('OB12_Arrival')}
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
    justifyContent: 'space-between',
  },
  header: {
    paddingHorizontal: 28,
    marginTop: 32,
  },
  heading: {
    fontSize: 28,
    lineHeight: 36,
    color: '#FFFFFF',
    fontFamily: FONTS.extraBold,
  },
  sub: {
    fontSize: 14,
    lineHeight: 20,
    color: '#8C93A0',
    fontFamily: FONTS.regular,
    marginTop: 10,
  },
  centerArea: {
    alignItems: 'center',
    gap: 28,
  },
  bellGlow: {
    position: 'absolute',
    top: -20,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(232, 160, 32, 0.06)',
  },
  description: {
    color: '#8C93A0',
    fontSize: 14,
    textAlign: 'center',
    marginHorizontal: 40,
    fontFamily: FONTS.regular,
    lineHeight: 22,
  },
});

export default OB11_Notifications;
