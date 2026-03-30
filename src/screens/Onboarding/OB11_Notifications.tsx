import React, { useEffect } from 'react';
import { View, Text, StyleSheet, StatusBar } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BellRing } from 'lucide-react-native';
import { requestNotifications } from 'react-native-permissions';
import { OB_COLORS, OB_TYPOGRAPHY } from '../../constants/onboarding';
import { FONTS } from '../../core/constants/theme';
import OBProgressBar from '../../components/onboarding/OBProgressBar';
import OBPrimaryButton from '../../components/onboarding/OBPrimaryButton';
import OBSkipLink from '../../components/onboarding/OBSkipLink';
import type { OnboardingScreenProps } from '../../core/types/navigation.types';

type Props = OnboardingScreenProps<'OB11_Notifications'>;

const OB11_Notifications: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();

  // Pulsing scale for bell icon
  const scale = useSharedValue(0.95);
  useEffect(() => {
    scale.value = withRepeat(
      withTiming(1.05, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [scale]);

  const bellStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handleEnable = async () => {
    try {
      await requestNotifications(['alert', 'badge', 'sound']);
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
      <OBProgressBar current={10} total={10} />

      <View style={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.header}>
          <Text style={OB_TYPOGRAPHY.heading}>
            Know when history is near you.
          </Text>
          <Text style={[OB_TYPOGRAPHY.sub, styles.sub]}>
            We'll notify you when you're close to a heritage site.
          </Text>
        </View>

        <View style={styles.centerArea}>
          <Animated.View style={bellStyle}>
            <BellRing size={64} color="#E8A020" />
          </Animated.View>

          <Text style={styles.description}>
            Get notified the moment your ancestor is within reach.
          </Text>
        </View>

        <View>
          <OBPrimaryButton label="Yes, notify me →" onPress={handleEnable} />
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
    paddingHorizontal: 24,
    marginTop: 40,
  },
  sub: {
    marginTop: 8,
  },
  centerArea: {
    alignItems: 'center',
    gap: 24,
  },
  description: {
    color: '#8C93A0',
    fontSize: 14,
    textAlign: 'center',
    marginHorizontal: 32,
    fontFamily: FONTS.regular,
    lineHeight: 22,
  },
});

export default OB11_Notifications;
