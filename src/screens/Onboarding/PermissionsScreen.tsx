import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StatusBar,
  ImageBackground,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { request, PERMISSIONS } from 'react-native-permissions';
import AmberButton from '../../components/onboarding/AmberButton';
import type { OnboardingScreenProps } from '../../core/types/navigation.types';
import { ROUTES } from '../../core/constants/routes';

type Props = OnboardingScreenProps<'OnboardingPermissions'>;
type PermissionStep = 'location' | 'notification';

// Background image asset — placeholder until dedicated heritage/torch images are available
const bgImage = require('../../assets/images/bg.webp');

/**
 * Screen 7 — Two-step permissions request.
 * Step 1: Location permission with heritage background.
 * Step 2: Notification permission with same atmospheric background.
 * Both proceed regardless of grant or deny.
 */
const PermissionsScreen: React.FC<Props> = ({ navigation }) => {
  const [step, setStep] = useState<PermissionStep>('location');

  const handleLocationPermission = useCallback(async () => {
    const permission = Platform.select({
      ios: PERMISSIONS.IOS.LOCATION_WHEN_IN_USE,
      android: PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
    });

    if (permission) {
      try {
        await request(permission);
      } catch {
        // Proceed regardless of outcome
      }
    }

    setStep('notification');
  }, []);

  const handleNotificationPermission = useCallback(async () => {
    // Android 13+ (API 33) requires runtime POST_NOTIFICATIONS permission.
    // iOS push notification permission is deferred to the push library.
    if (Platform.OS === 'android') {
      try {
        const apiLevel =
          typeof Platform.Version === 'number'
            ? Platform.Version
            : parseInt(String(Platform.Version), 10);

        if (apiLevel >= 33) {
          await PermissionsAndroid.request(
            'android.permission.POST_NOTIFICATIONS' as typeof PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
          );
        }
      } catch {
        // Proceed regardless
      }
    }

    navigation.navigate(ROUTES.ONBOARDING.WORLD_OPENS);
  }, [navigation]);

  return (
    <ImageBackground source={bgImage} className="flex-1 bg-[#1A1612]">
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />

      {/* Dark overlay to keep text legible over the background image */}
      <LinearGradient
        colors={['rgba(0,0,0,0.55)', 'rgba(26,22,18,0.85)']}
        className="absolute inset-0"
      />

      <View className="flex-1 justify-center px-6">
        {step === 'location' ? (
          <>
            <Text className="mb-12 text-center font-['CormorantGaramond-SemiBold'] text-[38px] leading-[50px] text-white">
              Let EpochEye find the history around you.
            </Text>
            <View>
              <AmberButton
                title="Allow Location Access"
                onPress={handleLocationPermission}
              />
            </View>
          </>
        ) : (
          <>
            <Text className="mb-12 text-center font-['CormorantGaramond-SemiBold'] text-[38px] leading-[50px] text-white">
              We'll tell you when you're near a story.
            </Text>
            <View>
              <AmberButton
                title="Notify Me"
                onPress={handleNotificationPermission}
              />
            </View>
          </>
        )}
      </View>
    </ImageBackground>
  );
};

export default PermissionsScreen;
