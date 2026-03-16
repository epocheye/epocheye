import React, { useCallback } from 'react';
import { View, Text, StyleSheet, StatusBar } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  requestAllPermissions,
  areAllPermissionsGranted,
} from '../../utils/permissions';
import AmberButton from '../../components/onboarding/AmberButton';

/**
 * Permissions screen shown within the main app when required permissions
 * (location, camera, storage) are missing. Triggered by usePermissionCheck hook.
 */
const PermissionsScreen: React.FC = () => {
  const navigation = useNavigation();

  const handleRequestPermissions = useCallback(async () => {
    const result = await requestAllPermissions();
    if (areAllPermissionsGranted(result)) {
      navigation.goBack();
    }
    // If not all granted, requestAllPermissions already shows an alert
    // pointing user to settings. User can go back manually.
  }, [navigation]);

  const handleSkip = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />

      <View style={styles.content}>
        <Text style={styles.heading}>
          EpochEye needs access to your location and camera
        </Text>
        <Text style={styles.subText}>
          To show you heritage sites nearby and enable AR experiences, we need a
          few permissions.
        </Text>

        <View style={styles.buttonContainer}>
          <AmberButton
            title="Grant Permissions"
            onPress={handleRequestPermissions}
          />
        </View>

        <Text style={styles.skipText} onPress={handleSkip}>
          Not now
        </Text>
      </View>
    </View>
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
    fontFamily: 'MontserratAlternates-SemiBold',
    fontSize: 32,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 42,
    marginBottom: 16,
  },
  subText: {
    fontFamily: 'MontserratAlternates-Regular',
    fontSize: 16,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 40,
  },
  buttonContainer: {
    marginBottom: 20,
  },
  skipText: {
    fontFamily: 'MontserratAlternates-Regular',
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
  },
});

export default PermissionsScreen;
