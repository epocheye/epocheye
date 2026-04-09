import React, { useCallback } from 'react';
import { View, Text, StatusBar } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AmberButton from '../../components/onboarding/AmberButton';
import { PermissionService } from '../../shared/services';

/**
 * Permissions screen shown within the main app when required permissions
 * (location, camera, storage) are missing.
 */
const PermissionsScreen: React.FC = () => {
  const navigation = useNavigation();

  const handleRequestPermissions = useCallback(async () => {
    const result = await PermissionService.requestAll();
    if (PermissionService.areAllGranted(result)) {
      navigation.goBack();
      return;
    }

    const firstMissingPermission =
      PermissionService.getMissingPermissions(result)[0];
    if (firstMissingPermission) {
      PermissionService.showSettingsAlert(firstMissingPermission);
    }
  }, [navigation]);

  const handleSkip = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  return (
    <View className="flex-1 bg-[#1A1612]">
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />

      <View className="flex-1 justify-center px-6">
        <Text className="mb-4 text-center font-['MontserratAlternates-SemiBold'] text-[32px] leading-[42px] text-white">
          EpochEye needs access to your location and camera
        </Text>
        <Text className="mb-10 text-center font-['MontserratAlternates-Regular'] text-base leading-6 text-[rgba(255,255,255,0.6)]">
          To show you heritage sites nearby and enable AR experiences, we need a
          few permissions.
        </Text>

        <View className="mb-5">
          <AmberButton
            title="Grant Permissions"
            onPress={handleRequestPermissions}
          />
        </View>

        <Text
          className="text-center font-['MontserratAlternates-Regular'] text-sm text-[rgba(255,255,255,0.4)]"
          onPress={handleSkip}
        >
          Not now
        </Text>
      </View>
    </View>
  );
};

export default PermissionsScreen;
