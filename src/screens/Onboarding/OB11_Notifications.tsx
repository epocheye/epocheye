import React, {useEffect} from 'react';
import {View, Text, StatusBar} from 'react-native';
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
import OBProgressBar from '../../components/onboarding/OBProgressBar';
import OBPrimaryButton from '../../components/onboarding/OBPrimaryButton';
import OBSkipLink from '../../components/onboarding/OBSkipLink';
import type {OnboardingScreenProps} from '../../core/types/navigation.types';

type Props = OnboardingScreenProps<'OB11_Notifications'>;

const OB11_Notifications: React.FC<Props> = ({navigation}) => {
  const insets = useSafeAreaInsets();

  const rotate = useSharedValue(0);
  const bellScale = useSharedValue(0.9);
  const headingO = useSharedValue(0);
  const headingY = useSharedValue(16);
  const descO = useSharedValue(0);

  useEffect(() => {
    headingO.value = withTiming(1, {duration: 400});
    headingY.value = withSpring(0, {damping: 20, stiffness: 140});
    descO.value = withTiming(1, {duration: 500});
    bellScale.value = withSpring(1, {damping: 10, stiffness: 100});
    rotate.value = withRepeat(
      withSequence(
        withTiming(12, {duration: 150, easing: Easing.inOut(Easing.ease)}),
        withTiming(-10, {duration: 150, easing: Easing.inOut(Easing.ease)}),
        withTiming(8, {duration: 120, easing: Easing.inOut(Easing.ease)}),
        withTiming(-6, {duration: 120, easing: Easing.inOut(Easing.ease)}),
        withTiming(0, {duration: 100, easing: Easing.inOut(Easing.ease)}),
        withTiming(0, {duration: 1800}),
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
        void fcmRegisterAfterPermission();
      }
    } catch {}
    navigation.navigate('OB12_Arrival');
  };

  return (
    <View className="flex-1 bg-ob-bgDeep">
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />
      <OBProgressBar current={9} total={10} />

      <View
        className="flex-1 justify-between"
        style={{paddingBottom: insets.bottom + 24}}>
        <Animated.View className="px-[28px] mt-8" style={sHeading}>
          <Text className="text-[28px] leading-9 text-parchment font-montserrat-extrabold">
            Know when history{'\n'}is near you.
          </Text>
          <Text className="text-[14px] leading-5 text-grey-muted font-montserrat mt-[10px]">
            We'll notify you when you're close to a heritage site.
          </Text>
        </Animated.View>

        <View className="items-center gap-7">
          <View className="absolute -top-5 w-[160px] h-[160px] rounded-full bg-[rgba(232,160,32,0.06)]" />
          <Animated.View style={bellStyle}>
            <BellRing size={72} color="#E8A020" />
          </Animated.View>
          <Animated.Text
            className="text-grey-muted text-[14px] text-center mx-[40px] font-montserrat leading-[22px]"
            style={sDesc}>
            Get notified the moment your ancestor is within reach.
          </Animated.Text>
        </View>

        <View>
          <OBPrimaryButton label={'Yes, notify me  →'} onPress={handleEnable} />
          <OBSkipLink
            label="Maybe later"
            onPress={() => navigation.navigate('OB12_Arrival')}
          />
        </View>
      </View>
    </View>
  );
};

export default OB11_Notifications;
