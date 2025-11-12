import {
  Text,
  View,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  ScrollView,
  Animated,
} from 'react-native';
import React, { useState, useEffect, useRef } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import {
  MapPin,
  Camera,
  FolderOpen,
  Shield,
  Sparkles,
} from 'lucide-react-native';
import {
  requestAllPermissions,
  checkAllPermissions,
  areAllPermissionsGranted,
  PermissionResult,
} from '../../utils/permissions';

const Logo = require('../../assets/images/logo-white.png');

const Permissions = ({ navigation: navProp, route: routeProp }: any) => {
  const navigation = navProp || useNavigation();
  const route = routeProp || useRoute();
  const [isLoading, setIsLoading] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<PermissionResult>({
    location: false,
    camera: false,
    storage: false,
  });

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  // Check if coming from auth flow or from within app
  // If fromAuth param is passed, use it; otherwise check if we can go back
  const isFromAuth = route.params?.fromAuth ?? false;

  useEffect(() => {
    console.log('Permissions screen mounted');
    // Check current permission status on mount
    checkCurrentPermissions();

    // Entrance animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const checkCurrentPermissions = async () => {
    try {
      console.log('Checking current permissions...');
      const status = await checkAllPermissions();
      console.log('Current permission status:', status);
      setPermissionStatus(status);
    } catch (error) {
      console.error('Error checking current permissions:', error);
    }
  };

  const handleGrantPermissions = async () => {
    console.log('Grant permissions button pressed');
    setIsLoading(true);
    setShowWarning(false);

    try {
      console.log('Starting permission request...');
      const result = await requestAllPermissions();
      console.log('Permission request completed:', result);
      setPermissionStatus(result);

      if (areAllPermissionsGranted(result)) {
        console.log('All permissions granted, navigating...');
        // All permissions granted - navigate based on context
        if (isFromAuth) {
          // Coming from signup flow - go to Login
          navigation.navigate('Login');
        } else {
          // Coming from within app - go back
          navigation.goBack();
        }
      } else {
        console.log('Some permissions denied');
        // Some permissions denied - show warning
        setShowWarning(true);
      }
    } catch (error) {
      console.error('Error requesting permissions:', error);
      setShowWarning(true);
    } finally {
      console.log('Setting loading to false');
      setIsLoading(false);
    }
  };

  const getWarningMessage = () => {
    const denied = [];
    if (!permissionStatus.location) denied.push('Location');
    if (!permissionStatus.camera) denied.push('Camera');
    if (!permissionStatus.storage) denied.push('Storage');

    return `Hey, we really need ${denied.join(', ')} ${
      denied.length > 1 ? 'permissions' : 'permission'
    } to make the AR magic happen! Without ${
      denied.length > 1 ? 'them' : 'it'
    }, you'll basically be using a fancy flashlight app. Please grant the permissions to unlock the full experience! 🎯`;
  };

  return (
    <SafeAreaView className="flex-1 bg-[#111111]">
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={{
            flex: 1,
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
          }}
          className="px-6 py-8"
        >
          {/* Header Section */}
          <View className="items-center mb-8">
            <Image source={Logo} className="size-16 mb-6" />

            <View className="bg-white/5 rounded-full px-4 py-2 mb-4">
              <View className="flex-row items-center gap-2">
                <Shield size={16} color="#10b981" />
                <Text className="text-emerald-400 font-montserrat-medium text-sm">
                  Secure & Private
                </Text>
              </View>
            </View>

            <Text className="text-white font-montserrat-bold text-3xl text-center mb-3">
              Let's Get You Started
            </Text>
          </View>

          {/* Permission Cards */}
          <View className="mb-6">
            {/* Location Permission */}
            <Animated.View
              className={`mb-4 rounded-2xl overflow-hidden ${
                permissionStatus.location
                  ? 'bg-emerald-500/10 border-2 border-emerald-500'
                  : 'bg-[#1a1a1a] border-2 border-transparent'
              }`}
            >
              <View className="p-5">
                <View className="flex-row items-start">
                  <View
                    className={`rounded-full p-3 ${
                      permissionStatus.location
                        ? 'bg-emerald-500/20'
                        : 'bg-white/5'
                    }`}
                  >
                    <MapPin
                      size={24}
                      color={permissionStatus.location ? '#10b981' : '#9ca3af'}
                    />
                  </View>
                  <View className="flex-1 ml-4">
                    <View className="flex-row items-center justify-between mb-2">
                      <Text className="text-white font-montserrat-semibold text-lg">
                        Location
                      </Text>
                      {permissionStatus.location && (
                        <View className="bg-emerald-500 rounded-full px-3 py-1">
                          <Text className="text-white font-montserrat-medium text-xs">
                            ✓ Granted
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text className="text-gray-400 font-montserrat-regular text-sm leading-5">
                      Discover historical sites and AR experiences near you
                    </Text>
                  </View>
                </View>
              </View>
            </Animated.View>

            {/* Camera Permission */}
            <Animated.View
              className={`mb-4 rounded-2xl overflow-hidden ${
                permissionStatus.camera
                  ? 'bg-emerald-500/10 border-2 border-emerald-500'
                  : 'bg-[#1a1a1a] border-2 border-transparent'
              }`}
            >
              <View className="p-5">
                <View className="flex-row items-start">
                  <View
                    className={`rounded-full p-3 ${
                      permissionStatus.camera
                        ? 'bg-emerald-500/20'
                        : 'bg-white/5'
                    }`}
                  >
                    <Camera
                      size={24}
                      color={permissionStatus.camera ? '#10b981' : '#9ca3af'}
                    />
                  </View>
                  <View className="flex-1 ml-4">
                    <View className="flex-row items-center justify-between mb-2">
                      <Text className="text-white font-montserrat-semibold text-lg">
                        Camera
                      </Text>
                      {permissionStatus.camera && (
                        <View className="bg-emerald-500 rounded-full px-3 py-1">
                          <Text className="text-white font-montserrat-medium text-xs">
                            ✓ Granted
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text className="text-gray-400 font-montserrat-regular text-sm leading-5">
                      Power our AR engine to bring history to life
                    </Text>
                  </View>
                </View>
              </View>
            </Animated.View>

            {/* Storage Permission */}
            <Animated.View
              className={`mb-4 rounded-2xl overflow-hidden ${
                permissionStatus.storage
                  ? 'bg-emerald-500/10 border-2 border-emerald-500'
                  : 'bg-[#1a1a1a] border-2 border-transparent'
              }`}
            >
              <View className="p-5">
                <View className="flex-row items-start">
                  <View
                    className={`rounded-full p-3 ${
                      permissionStatus.storage
                        ? 'bg-emerald-500/20'
                        : 'bg-white/5'
                    }`}
                  >
                    <FolderOpen
                      size={24}
                      color={permissionStatus.storage ? '#10b981' : '#9ca3af'}
                    />
                  </View>
                  <View className="flex-1 ml-4">
                    <View className="flex-row items-center justify-between mb-2">
                      <Text className="text-white font-montserrat-semibold text-lg">
                        Storage
                      </Text>
                      {permissionStatus.storage && (
                        <View className="bg-emerald-500 rounded-full px-3 py-1">
                          <Text className="text-white font-montserrat-medium text-xs">
                            ✓ Granted
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text className="text-gray-400 font-montserrat-regular text-sm leading-5">
                      Save and share your amazing AR captures
                    </Text>
                  </View>
                </View>
              </View>
            </Animated.View>
          </View>

          {/* Warning Message */}
          {showWarning && (
            <Animated.View className="bg-red-500/10 border border-red-500 rounded-2xl p-4 mb-6">
              <View className="flex-row items-start">
                <Text className="text-2xl mr-3">⚠️</Text>
                <Text className="flex-1 text-red-300 font-montserrat-regular text-sm leading-5">
                  {getWarningMessage()}
                </Text>
              </View>
            </Animated.View>
          )}

          {/* Info Box */}
          <View className="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-4 mb-6">
            <View className="flex-row items-start">
              <Sparkles size={20} color="#60a5fa" />
              <View className="flex-1 ml-3">
                <Text className="text-blue-300 font-montserrat-medium text-sm mb-1">
                  Why we need these?
                </Text>
                <Text className="text-blue-200/70 font-montserrat-regular text-sm leading-4">
                  These permissions enable our AR features to show you immersive
                  historical experiences. We respect your privacy and never
                  share your data.
                </Text>
              </View>
            </View>
          </View>

          {/* Action Button */}
          <TouchableOpacity
            onPress={handleGrantPermissions}
            disabled={isLoading}
            className={`rounded-2xl overflow-hidden ${
              isLoading ? 'opacity-50' : ''
            }`}
            activeOpacity={0.8}
          >
            <View className="bg-white py-5 px-8">
              {isLoading ? (
                <ActivityIndicator size="small" color="#111111" />
              ) : (
                <View className="flex-row items-center justify-center">
                  <Text className="text-[#111111] font-montserrat-bold text-lg mr-2">
                    {areAllPermissionsGranted(permissionStatus)
                      ? 'Continue to App'
                      : 'Grant Permissions'}
                  </Text>
                  <Text className="text-xl">→</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>

          {/* Skip Button (only if from auth) */}
          {isFromAuth && !areAllPermissionsGranted(permissionStatus) && (
            <TouchableOpacity
              onPress={() => navigation.navigate('Login')}
              className="mt-4 py-3"
              activeOpacity={0.7}
            >
              <Text className="text-gray-500 font-montserrat-regular text-center text-sm">
                Skip for now (limited functionality)
              </Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default Permissions;
