import {
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  Image,
  Linking,
} from 'react-native';
import React, { useState, useEffect, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { logout } from '../../utils/api/auth';
import { useUser } from '../../context';
import { launchImageLibrary } from 'react-native-image-picker';
import {
  Shield,
  MessageCircle,
  LogOut,
  Camera,
  Trash2,
  Download,
  Save,
  Sparkles,
  ChevronRight,
} from 'lucide-react-native';
import AnimatedLogo from '../../components/ui/AnimatedLogo';
import { PermissionService } from '../../shared/services/permission.service';
import { APP_CONFIG } from '../../core/config';
import type { TabScreenProps } from '../../core/types/navigation.types';
import { ROUTES } from '../../core/constants';
import { usePremiumPass } from '../../shared/hooks';

// React Native's FormData.append accepts a file object with this shape.
// Casting as RNFile avoids the loose `as any` anti-pattern.
type RNFile = { uri: string; type: string; name: string };

type Props = TabScreenProps<'Settings'> & { onLogout?: () => void };

const SettingsScreen: React.FC<Props> = ({ navigation, onLogout }) => {
  const { hasActivePass: hasPremium, loading: premiumLoading } = usePremiumPass();
  const profile = useUser(state => state.profile);
  const isLoading = useUser(state => state.isLoading);
  const updateProfile = useUser(state => state.updateProfile);
  const uploadUserAvatar = useUser(state => state.uploadUserAvatar);
  const clearUserData = useUser(state => state.clearUserData);
  const refreshUserData = useUser(state => state.refreshUserData);
  const ensureUserDataLoaded = useUser(state => state.ensureUserDataLoaded);

  // Profile form state
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Real permission status — checked each time the screen focuses
  const [permissionStatus, setPermissionStatus] = useState({
    camera: false,
    location: false,
  });

  // Load profile data when available
  useEffect(() => {
    if (profile) {
      setFullName(profile.name || '');
      setEmail(profile.email || '');
      setPhone(profile.phone || '');
    }
  }, [profile]);

  // Track unsaved changes across all editable fields
  useEffect(() => {
    if (profile) {
      const changed =
        fullName !== profile.name ||
        email !== profile.email ||
        phone !== profile.phone;
      setHasChanges(changed);
    }
  }, [fullName, email, phone, profile]);

  // Refresh user data and real permission statuses each time the screen comes
  // into focus (e.g., returning from device Settings).
  useFocusEffect(
    useCallback(() => {
      void ensureUserDataLoaded();
      void refreshUserData();
      PermissionService.checkAll().then(result => {
        setPermissionStatus({
          camera: result.camera,
          location: result.location,
        });
      });
    }, [ensureUserDataLoaded, refreshUserData]),
  );

  const handleSaveChanges = async () => {
    if (!hasChanges) return;

    setIsSaving(true);
    try {
      const success = await updateProfile({
        name: fullName,
        phone: phone,
        // Preserve any existing preferences; only profile fields are edited here
        preferences: profile?.preferences ?? {},
      });

      if (success) {
        Alert.alert('Success', 'Profile updated successfully');
        setHasChanges(false);
      } else {
        Alert.alert('Error', 'Failed to update profile. Please try again.');
      }
    } catch {
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarUpload = async () => {
    const hasStoragePermission = await PermissionService.request('storage');
    if (!hasStoragePermission) {
      PermissionService.showSettingsAlert('storage');
      return;
    }

    launchImageLibrary(
      {
        mediaType: 'photo',
        quality: 0.8,
        maxWidth: 512,
        maxHeight: 512,
      },
      async response => {
        if (response.didCancel) {
          return;
        }

        if (response.errorCode) {
          Alert.alert('Error', 'Failed to select image');
          return;
        }

        if (response.assets && response.assets[0]) {
          const asset = response.assets[0];
          const formData = new FormData();
          formData.append('avatar', {
            uri: asset.uri,
            type: asset.type || 'image/jpeg',
            name: asset.fileName || 'avatar.jpg',
          } as unknown as RNFile);

          try {
            const success = await uploadUserAvatar(formData);
            if (success) {
              Alert.alert('Success', 'Avatar updated successfully');
            } else {
              Alert.alert('Error', 'Failed to upload avatar');
            }
          } catch {
            Alert.alert('Error', 'Failed to upload avatar');
          }
        }
      },
    );
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          try {
            await logout();
            clearUserData();
            if (onLogout) {
              onLogout();
            }
          } catch {
            Alert.alert('Error', 'Failed to logout. Please try again.');
          }
        },
      },
    ]);
  };

  // Privacy section: Camera and Location with live permission values
  const permissionRows = [
    { label: 'Camera', granted: permissionStatus.camera },
    { label: 'Location', granted: permissionStatus.location },
  ];

  return (
    <SafeAreaView className="flex-1 bg-[#05050A]">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 64 }}
      >
        {/* Header */}
        <View className="px-5 pt-6 pb-4 flex-row items-center justify-between">
          <View>
            <Text className="text-xs uppercase tracking-[4px] text-[#8B8B9E] font-montserrat-semibold">
              Account
            </Text>
            <Text className="text-white text-3xl font-montserrat-bold mt-2">
              Settings
            </Text>
          </View>
          <TouchableOpacity
            className="flex-row items-center rounded-full border border-white/10 bg-[#13131F] px-4 py-2"
            onPress={() => Linking.openURL('mailto:support@epocheye.app')}
            accessibilityRole="button"
            accessibilityLabel="Contact support"
            accessibilityHint="Opens your email client to contact our support team"
          >
            <MessageCircle size={16} color="white" />
            <Text className="text-white text-sm font-montserrat-medium ml-2">
              Support
            </Text>
          </TouchableOpacity>
        </View>

        {/* Profile card */}
        {isLoading ? (
          <View
            className="mx-5 mb-6 rounded-[32px] border border-white/10 bg-[#12121B] p-5 items-center justify-center"
            style={{ height: 280 }}
          >
            <AnimatedLogo size={58} variant="white" motion="orbit" />
            <Text className="text-[#9A9AAF] text-sm font-montserrat-regular mt-3">
              Loading profile...
            </Text>
          </View>
        ) : (
          <View className="mx-5 mb-6 rounded-[32px] border border-white/10 bg-[#12121B] p-5">
            <View className="flex-row items-center">
              <View className="w-16 h-16 rounded-full bg-white/5 items-center justify-center mr-4 relative">
                {profile?.avatar_url ? (
                  <Image
                    source={{ uri: profile.avatar_url }}
                    className="w-16 h-16 rounded-full"
                    resizeMode="cover"
                  />
                ) : (
                  <Image
                    source={require('../../assets/images/logo-white.png')}
                    className="w-10 h-10"
                    resizeMode="contain"
                  />
                )}
                <TouchableOpacity
                  className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[#FF7A18] items-center justify-center"
                  onPress={handleAvatarUpload}
                  accessibilityRole="button"
                  accessibilityLabel="Change profile picture"
                  accessibilityHint="Opens image picker to select a new avatar"
                >
                  <Camera size={16} color="white" />
                </TouchableOpacity>
              </View>
              <View className="flex-1">
                <Text className="text-white text-xl font-montserrat-bold">
                  {fullName || 'User'}
                </Text>
                <Text className="text-[#9A9AAF] text-sm font-montserrat-regular mt-1">
                  {email || 'No email'}
                </Text>
              </View>
            </View>
            <View className="mt-5">
              <View className="mb-3">
                <Text className="text-xs uppercase tracking-[2px] text-[#8B8B9E] font-montserrat-semibold mb-2">
                  Full name
                </Text>
                <TextInput
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="Full name"
                  placeholderTextColor="#8B8B9E"
                  className="bg-[#090912] border border-white/10 rounded-2xl text-white font-montserrat-medium px-4 py-3"
                  accessibilityLabel="Full name"
                />
              </View>
              <View className="flex-row">
                <View className="flex-1 mr-3">
                  <Text className="text-xs uppercase tracking-[2px] text-[#8B8B9E] font-montserrat-semibold mb-2">
                    Email
                  </Text>
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    placeholder="Email"
                    placeholderTextColor="#8B8B9E"
                    className="bg-[#090912] border border-white/10 rounded-2xl text-white font-montserrat-medium px-4 py-3"
                    accessibilityLabel="Email address"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-xs uppercase tracking-[2px] text-[#8B8B9E] font-montserrat-semibold mb-2">
                    Phone
                  </Text>
                  <TextInput
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                    placeholder="Phone"
                    placeholderTextColor="#8B8B9E"
                    className="bg-[#090912] border border-white/10 rounded-2xl text-white font-montserrat-medium px-4 py-3"
                    accessibilityLabel="Phone number"
                  />
                </View>
              </View>
            </View>
            {hasChanges && (
              <TouchableOpacity
                className="mt-4 flex-row items-center justify-center rounded-2xl bg-[#3B82F6] py-3"
                onPress={handleSaveChanges}
                disabled={isSaving}
                accessibilityRole="button"
                accessibilityLabel="Save profile changes"
                accessibilityHint="Saves your updated name, email, and phone number"
              >
                {isSaving ? (
                  <AnimatedLogo
                    size={18}
                    variant="white"
                    motion="pulse"
                    showRing={false}
                  />
                ) : (
                  <>
                    <Save size={18} color="white" />
                    <Text className="text-white text-base font-montserrat-semibold ml-2">
                      Save Changes
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Premium upgrade */}
        {!premiumLoading && !hasPremium && (
          <TouchableOpacity
            className="mx-5 mb-6 flex-row items-center rounded-[32px] border border-[rgba(212,134,10,0.35)] bg-[#1A120A] p-5"
            onPress={() => navigation.navigate(ROUTES.MAIN.PURCHASE)}
            activeOpacity={0.9}
            accessibilityRole="button"
            accessibilityLabel="Upgrade to Epocheye Premium"
          >
            <View className="w-10 h-10 rounded-full bg-[#D4860A]/15 items-center justify-center mr-3">
              <Sparkles size={20} color="#D4860A" />
            </View>
            <View className="flex-1">
              <Text className="text-white text-base font-montserrat-semibold">
                Upgrade to Premium
              </Text>
              <Text className="text-[#B8AF9E] text-xs font-montserrat-regular mt-0.5">
                Unlock every premium feature
              </Text>
            </View>
            <ChevronRight size={20} color="#D4860A" />
          </TouchableOpacity>
        )}

        {/* Privacy — shows live camera and location permission status */}
        <View className="mx-5 mb-6 rounded-[32px] border border-white/10 bg-[#12121B] p-5">
          <View className="flex-row items-center mb-5">
            <View className="w-10 h-10 rounded-full bg-white/5 items-center justify-center mr-3">
              <Shield size={20} color="#3B82F6" />
            </View>
            <Text className="text-white text-lg font-montserrat-semibold">
              Privacy
            </Text>
          </View>
          {permissionRows.map(item => (
            <View
              key={item.label}
              className="flex-row items-center justify-between py-2"
            >
              <Text className="text-white text-base font-montserrat-medium">
                {item.label}
              </Text>
              <Text
                className={`px-3 py-1 rounded-full text-xs font-montserrat-semibold ${
                  item.granted
                    ? 'bg-[#1F3323] text-[#6FE187]'
                    : 'bg-[#382117] text-[#FF9B7F]'
                }`}
              >
                {item.granted ? 'Granted' : 'Pending'}
              </Text>
            </View>
          ))}
          <View className="flex-row mt-4">
            <TouchableOpacity
              className="flex-1 flex-row items-center justify-center rounded-2xl border border-white/10 bg-[#0B0B13] px-4 py-3 mr-3"
              onPress={() =>
                Alert.alert(
                  'Coming Soon',
                  'Data export will be available in a future update.',
                )
              }
              accessibilityRole="button"
              accessibilityLabel="Download your data"
              accessibilityHint="Data export is not yet available"
            >
              <Download size={18} color="white" />
              <Text className="text-white text-sm font-montserrat-semibold ml-2">
                Download Data
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-1 flex-row items-center justify-center rounded-2xl border border-white/10 bg-[#0B0B13] px-4 py-3"
              onPress={() => PermissionService.openAppSettings()}
              accessibilityRole="button"
              accessibilityLabel="Manage app permissions"
              accessibilityHint="Opens device settings for this app"
            >
              <Shield size={18} color="white" />
              <Text className="text-white text-sm font-montserrat-semibold ml-2">
                Manage Permissions
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* App version — sourced from central config, not hardcoded */}
        <View className="items-center py-8">
          <Text className="text-[#8B8B9E] text-sm font-montserrat-medium">
            Version {APP_CONFIG.APP.VERSION}
          </Text>
          <Text className="text-[#6B6B78] text-xs font-montserrat-regular mt-1">
            © 2025 EpochEye. All rights reserved.
          </Text>
        </View>

        {/* Account actions */}
        <View className="flex-row px-5 mb-12">
          <TouchableOpacity
            className="flex-1 flex-row items-center justify-center rounded-2xl bg-[#3B82F6] py-4 mr-3"
            onPress={handleLogout}
            accessibilityRole="button"
            accessibilityLabel="Log out"
            accessibilityHint="Signs you out of your account"
          >
            <LogOut size={18} color="white" />
            <Text className="text-white text-base font-montserrat-semibold ml-2">
              Log Out
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-1 flex-row items-center justify-center rounded-2xl border border-[#EF4444] bg-[#2A1212] py-4"
            onPress={() =>
              Alert.alert(
                'Coming Soon',
                'Account deletion will be available in a future update.',
              )
            }
            accessibilityRole="button"
            accessibilityLabel="Delete account"
            accessibilityHint="Account deletion is not yet available"
          >
            <Trash2 size={18} color="#EF4444" />
            <Text className="text-[#EF4444] text-base font-montserrat-semibold ml-2">
              Delete Account
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default SettingsScreen;
