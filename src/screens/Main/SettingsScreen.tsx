import React, { useState, useEffect, useCallback } from 'react';
import {
  Alert,
  Image,
  Linking,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useFocusEffect } from '@react-navigation/native';
import {
  BookOpen,
  Camera,
  ChevronRight,
  LogOut,
  MapPin,
  MessageCircle,
  Save,
  Shield,
  Sparkles,
  Trash2,
} from 'lucide-react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { logout } from '../../utils/api/auth';
import { useUser } from '../../context';
import { PermissionService } from '../../shared/services/permission.service';
import { APP_CONFIG } from '../../core/config';
import AnimatedLogo from '../../components/ui/AnimatedLogo';
import type { TabScreenProps } from '../../core/types/navigation.types';
import { ROUTES } from '../../core/constants';
import { useExplorerPass } from '../../shared/hooks';

// React Native's FormData.append accepts a file object with this shape.
type RNFile = { uri: string; type: string; name: string };

type Props = TabScreenProps<'Settings'> & { onLogout?: () => void };

const SettingsScreen: React.FC<Props> = ({ navigation, onLogout }) => {
  const { hasAnyActivePass, loading: explorerPassLoading } = useExplorerPass();
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

  // Permission status
  const [permissionStatus, setPermissionStatus] = useState({
    camera: false,
    location: false,
  });

  useEffect(() => {
    if (profile) {
      setFullName(profile.name || '');
      setEmail(profile.email || '');
      setPhone(profile.phone || '');
    }
  }, [profile]);

  useEffect(() => {
    if (profile) {
      const changed =
        fullName !== profile.name ||
        email !== profile.email ||
        phone !== profile.phone;
      setHasChanges(changed);
    }
  }, [fullName, email, phone, profile]);

  // Refresh permissions on focus
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

  const handleSaveChanges = useCallback(async () => {
    if (!hasChanges) return;
    setIsSaving(true);
    try {
      const success = await updateProfile({
        name: fullName,
        phone: phone,
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
  }, [hasChanges, updateProfile, fullName, phone, profile]);

  const handleAvatarUpload = useCallback(async () => {
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
        if (response.didCancel || response.errorCode) return;

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
  }, [uploadUserAvatar]);

  const handleRequestPermission = useCallback(
    async (name: 'camera' | 'location') => {
      const granted = await PermissionService.request(name);
      if (granted) {
        setPermissionStatus(prev => ({ ...prev, [name]: true }));
      } else {
        PermissionService.showSettingsAlert(name);
      }
    },
    [],
  );

  const handleLogout = useCallback(() => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          try {
            await logout();
            clearUserData();
            if (onLogout) onLogout();
          } catch {
            Alert.alert('Error', 'Failed to logout. Please try again.');
          }
        },
      },
    ]);
  }, [clearUserData, onLogout]);

  const permissionRows = [
    { key: 'camera' as const, label: 'Camera', granted: permissionStatus.camera },
    { key: 'location' as const, label: 'Location', granted: permissionStatus.location },
  ];

  return (
    <SafeAreaView className="flex-1 bg-[#000000]">
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={['#000000', '#0C0A07', '#000000']}
        locations={[0, 0.5, 1]}
        className="flex-1"
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 64 }}
        >
          {/* Header */}
          <Animated.View
            entering={FadeInDown.duration(350)}
            className="px-5 pt-5 pb-4 flex-row items-end justify-between"
          >
            <View>
              <Text className="text-xs uppercase tracking-[1px] text-[#C9A84C] font-['MontserratAlternates-SemiBold']">
                ACCOUNT
              </Text>
              <Text className="mt-1 text-[#F5F0E8] text-[26px] leading-9 font-['MontserratAlternates-Bold']">
                Settings
              </Text>
            </View>
            <TouchableOpacity
              className="flex-row items-center rounded-full border border-white/10 bg-[#141414] px-3.5 py-2"
              onPress={() => Linking.openURL('mailto:support@epocheye.app')}
              accessibilityRole="button"
              accessibilityLabel="Contact support"
            >
              <MessageCircle size={14} color="#B8AF9E" />
              <Text className="text-[#B8AF9E] text-xs font-['MontserratAlternates-Medium'] ml-1.5">
                Support
              </Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Profile card */}
          {isLoading ? (
            <View
              className="mx-5 mb-5 rounded-2xl border border-white/[0.08] bg-[#141414] p-5 items-center justify-center"
              style={{ height: 260 }}
            >
              <AnimatedLogo size={48} variant="white" motion="orbit" />
              <Text className="text-[#6B6357] text-sm font-['MontserratAlternates-Regular'] mt-3">
                Loading profile...
              </Text>
            </View>
          ) : (
            <Animated.View
              entering={FadeInDown.delay(80).duration(350)}
              className="mx-5 mb-5 rounded-2xl border border-white/[0.08] bg-[#141414] p-5"
            >
              <View className="flex-row items-center mb-5">
                <View className="w-16 h-16 rounded-full bg-[#1E1E1E] items-center justify-center mr-4 relative">
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
                    className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[#D4860A] items-center justify-center"
                    onPress={handleAvatarUpload}
                    accessibilityRole="button"
                    accessibilityLabel="Change profile picture"
                  >
                    <Camera size={14} color="#0A0A0A" />
                  </TouchableOpacity>
                </View>
                <View className="flex-1">
                  <Text className="text-[#F5F0E8] text-xl font-['MontserratAlternates-Bold']">
                    {fullName || 'User'}
                  </Text>
                  <Text className="text-[#6B6357] text-sm font-['MontserratAlternates-Regular'] mt-0.5">
                    {email || 'No email'}
                  </Text>
                </View>
              </View>

              {/* Form fields */}
              <View className="mb-3">
                <Text className="text-xs uppercase tracking-[1px] text-[#6B6357] font-['MontserratAlternates-SemiBold'] mb-2">
                  Full name
                </Text>
                <TextInput
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="Full name"
                  placeholderTextColor="rgba(245,240,232,0.25)"
                  className="bg-[#1E1E1E] border border-white/10 rounded-xl text-[#F5F0E8] font-['MontserratAlternates-Medium'] px-4 py-3 text-sm"
                  accessibilityLabel="Full name"
                />
              </View>
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Text className="text-xs uppercase tracking-[1px] text-[#6B6357] font-['MontserratAlternates-SemiBold'] mb-2">
                    Email
                  </Text>
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    placeholder="Email"
                    placeholderTextColor="rgba(245,240,232,0.25)"
                    className="bg-[#1E1E1E] border border-white/10 rounded-xl text-[#F5F0E8] font-['MontserratAlternates-Medium'] px-4 py-3 text-sm"
                    accessibilityLabel="Email address"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-xs uppercase tracking-[1px] text-[#6B6357] font-['MontserratAlternates-SemiBold'] mb-2">
                    Phone
                  </Text>
                  <TextInput
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                    placeholder="Phone"
                    placeholderTextColor="rgba(245,240,232,0.25)"
                    className="bg-[#1E1E1E] border border-white/10 rounded-xl text-[#F5F0E8] font-['MontserratAlternates-Medium'] px-4 py-3 text-sm"
                    accessibilityLabel="Phone number"
                  />
                </View>
              </View>

              {hasChanges && (
                <TouchableOpacity
                  className="mt-4 flex-row items-center justify-center rounded-xl bg-[#C9A84C] py-3"
                  onPress={handleSaveChanges}
                  disabled={isSaving}
                  accessibilityRole="button"
                  accessibilityLabel="Save profile changes"
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
                      <Save size={16} color="#0A0A0A" />
                      <Text className="text-[#0A0A0A] text-sm font-['MontserratAlternates-Bold'] ml-2">
                        Save Changes
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </Animated.View>
          )}

          {/* Explorer Pass CTA */}
          {!explorerPassLoading && !hasAnyActivePass && (
            <Animated.View entering={FadeInDown.delay(140).duration(350)}>
              <TouchableOpacity
                className="mx-5 mb-5 flex-row items-center rounded-2xl border border-[rgba(212,134,10,0.25)] bg-[rgba(26,18,10,0.8)] p-4"
                onPress={() => navigation.navigate(ROUTES.MAIN.PURCHASE)}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Get Explorer Pass"
              >
                <View className="w-10 h-10 rounded-full bg-[#D4860A]/15 items-center justify-center mr-3">
                  <Sparkles size={18} color="#D4860A" />
                </View>
                <View className="flex-1">
                  <Text className="text-[#F5F0E8] text-base font-['MontserratAlternates-SemiBold']">
                    Get Explorer Pass
                  </Text>
                  <Text className="text-[#6B6357] text-xs font-['MontserratAlternates-Regular'] mt-0.5">
                    Unlock heritage sites near you
                  </Text>
                </View>
                <ChevronRight size={18} color="#D4860A" />
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* My Tours link */}
          <Animated.View entering={FadeInDown.delay(200).duration(350)}>
            <TouchableOpacity
              className="mx-5 mb-5 flex-row items-center rounded-2xl border border-white/[0.08] bg-[#141414] p-4"
              onPress={() => navigation.navigate(ROUTES.MAIN.MY_TOURS)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="My Tours"
            >
              <View className="w-10 h-10 rounded-full bg-[#C9A84C]/10 items-center justify-center mr-3">
                <BookOpen size={18} color="#C9A84C" />
              </View>
              <View className="flex-1">
                <Text className="text-[#F5F0E8] text-base font-['MontserratAlternates-SemiBold']">
                  My Tours
                </Text>
                <Text className="text-[#6B6357] text-xs font-['MontserratAlternates-Regular'] mt-0.5">
                  Purchased and active tours
                </Text>
              </View>
              <ChevronRight size={18} color="#6B6357" />
            </TouchableOpacity>
          </Animated.View>

          {/* Permissions section */}
          <Animated.View
            entering={FadeInDown.delay(260).duration(350)}
            className="mx-5 mb-5 rounded-2xl border border-white/[0.08] bg-[#141414] p-4"
          >
            <View className="flex-row items-center gap-2.5 mb-4">
              <View className="w-9 h-9 rounded-full bg-[#1E1E1E] items-center justify-center">
                <Shield size={16} color="#C9A84C" />
              </View>
              <Text className="text-[#F5F0E8] text-base font-['MontserratAlternates-SemiBold']">
                Permissions
              </Text>
            </View>

            {permissionRows.map(item => (
              <View
                key={item.key}
                className="flex-row items-center justify-between py-3 border-b border-white/[0.05] last:border-b-0"
              >
                <View className="flex-row items-center gap-2.5">
                  {item.key === 'camera' ? (
                    <Camera size={16} color="#6B6357" />
                  ) : (
                    <MapPin size={16} color="#6B6357" />
                  )}
                  <Text className="text-[#F5F0E8] text-sm font-['MontserratAlternates-Medium']">
                    {item.label}
                  </Text>
                </View>

                {item.granted ? (
                  <View className="bg-[#10B981]/15 border border-[#10B981]/30 rounded-full px-2.5 py-1">
                    <Text className="text-[#10B981] text-[10px] font-['MontserratAlternates-SemiBold']">
                      Granted
                    </Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={() => handleRequestPermission(item.key)}
                    className="bg-[#D4860A]/15 border border-[#D4860A]/30 rounded-full px-2.5 py-1"
                    accessibilityRole="button"
                    accessibilityLabel={`Grant ${item.label} permission`}
                  >
                    <Text className="text-[#D4860A] text-[10px] font-['MontserratAlternates-SemiBold']">
                      Grant
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}

            <TouchableOpacity
              className="mt-3 flex-row items-center justify-center rounded-xl border border-white/[0.08] bg-[#1E1E1E] py-2.5"
              onPress={() => PermissionService.openAppSettings()}
              accessibilityRole="button"
              accessibilityLabel="Open device settings"
            >
              <Shield size={14} color="#6B6357" />
              <Text className="text-[#B8AF9E] text-xs font-['MontserratAlternates-Medium'] ml-1.5">
                Open Device Settings
              </Text>
            </TouchableOpacity>
          </Animated.View>

          {/* App version */}
          <Animated.View
            entering={FadeInDown.delay(320).duration(350)}
            className="items-center py-6"
          >
            <Text className="text-[#6B6357] text-xs font-['MontserratAlternates-Medium']">
              Version {APP_CONFIG.APP.VERSION}
            </Text>
            <Text className="text-[#6B6357]/60 text-[10px] font-['MontserratAlternates-Regular'] mt-1">
              Made with care for India's heritage
            </Text>
          </Animated.View>

          {/* Account actions */}
          <Animated.View
            entering={FadeInDown.delay(380).duration(350)}
            className="flex-row px-5 gap-3 mb-12"
          >
            <TouchableOpacity
              className="flex-1 flex-row items-center justify-center rounded-xl bg-[#141414] border border-white/[0.08] py-3.5"
              onPress={handleLogout}
              accessibilityRole="button"
              accessibilityLabel="Log out"
            >
              <LogOut size={16} color="#B8AF9E" />
              <Text className="text-[#B8AF9E] text-sm font-['MontserratAlternates-SemiBold'] ml-2">
                Log Out
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-1 flex-row items-center justify-center rounded-xl border border-[#EF4444]/30 bg-[#EF4444]/5 py-3.5"
              onPress={() =>
                Alert.alert(
                  'Coming Soon',
                  'Account deletion will be available in a future update.',
                )
              }
              accessibilityRole="button"
              accessibilityLabel="Delete account"
            >
              <Trash2 size={16} color="#EF4444" />
              <Text className="text-[#EF4444] text-sm font-['MontserratAlternates-SemiBold'] ml-2">
                Delete Account
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
};

export default SettingsScreen;
