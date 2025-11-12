import { useEffect } from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import { checkAllPermissions, areAllPermissionsGranted } from './permissions';

// Screens that should not check for permissions
const EXCLUDED_SCREENS = ['Login', 'Register', 'Landing', 'Signup'];

export const usePermissionCheck = () => {
  const navigation = useNavigation();
  const route = useRoute();

  useEffect(() => {
    // Don't check permissions on excluded screens
    if (EXCLUDED_SCREENS.includes(route.name)) {
      return;
    }

    const checkPermissions = async () => {
      const permissions = await checkAllPermissions();

      if (!areAllPermissionsGranted(permissions)) {
        // Navigate to Permissions screen if any permission is missing
        navigation.navigate('Permissions' as never);
      }
    };

    checkPermissions();

    // Check permissions when screen comes into focus
    const unsubscribe = navigation.addListener('focus', () => {
      checkPermissions();
    });

    return unsubscribe;
  }, [navigation, route.name]);
};
