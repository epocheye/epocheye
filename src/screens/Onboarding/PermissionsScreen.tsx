import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
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
    <ImageBackground source={bgImage} style={styles.container}>
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />

      {/* Dark overlay to keep text legible over the background image */}
      <LinearGradient
        colors={['rgba(0,0,0,0.55)', 'rgba(26,22,18,0.85)']}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.content}>
        {step === 'location' ? (
          <>
            <Text style={styles.heading}>
              Let EpochEye find the history around you.
            </Text>
            <View style={styles.ctaContainer}>
              <AmberButton
                title="Allow Location Access"
                onPress={handleLocationPermission}
              />
            </View>
          </>
        ) : (
          <>
            <Text style={styles.heading}>
              We'll tell you when you're near a story.
            </Text>
            <View style={styles.ctaContainer}>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1612',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  heading: {
    fontFamily: 'CormorantGaramond-SemiBold',
    fontSize: 38,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 50,
    marginBottom: 48,
  },
  ctaContainer: {
    paddingHorizontal: 0,
  },
});

export default PermissionsScreen;
