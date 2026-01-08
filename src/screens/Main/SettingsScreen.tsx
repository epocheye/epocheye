import {
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  TextInput,
  Image,
  ActivityIndicator,
} from 'react-native';
import React, { useMemo, useState, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NavigationProp, useFocusEffect } from '@react-navigation/native';
import { usePermissionCheck } from '../../utils/usePermissionCheck';
import { logout } from '../../utils/api/auth';
import { useUser } from '../../context';
import { launchImageLibrary } from 'react-native-image-picker';
import {
  Mail,
  Phone,
  Lock,
  Shield,
  Bell,
  FileText,
  Info,
  MessageCircle,
  ChevronRight,
  LogOut,
  Camera,
  Trash2,
  ShieldCheck,
  Download,
  Save,
} from 'lucide-react-native';

interface Props {
  navigation: NavigationProp<any>;
  onLogout?: () => void;
}

interface SettingItemProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  showArrow?: boolean;
  rightComponent?: React.ReactNode;
}

interface ToggleSettingProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}

const SettingItem: React.FC<SettingItemProps> = ({
  icon,
  title,
  subtitle,
  onPress,
  showArrow = true,
  rightComponent,
}) => (
  <TouchableOpacity
    className="flex-row items-center rounded-3xl border border-white/10 bg-[#10101A] px-4 py-4 mb-3"
    onPress={onPress}
    accessibilityRole="button"
    disabled={!onPress}
  >
    <View className="w-10 h-10 rounded-2xl bg-white/5 items-center justify-center mr-4">
      {icon}
    </View>
    <View className="flex-1">
      <Text className="text-white text-base font-montserrat-semibold">
        {title}
      </Text>
      {subtitle && (
        <Text className="text-[#9A9AAF] text-sm font-montserrat-regular">
          {subtitle}
        </Text>
      )}
    </View>
    {rightComponent ||
      (showArrow && <ChevronRight size={20} color="#8B8B9E" />)}
  </TouchableOpacity>
);

const ToggleSetting: React.FC<ToggleSettingProps> = ({
  icon,
  title,
  subtitle,
  value,
  onValueChange,
}) => (
  <View className="flex-row items-center rounded-3xl border border-white/10 bg-[#10101A] px-4 py-4 mb-3">
    <View className="w-10 h-10 rounded-2xl bg-white/5 items-center justify-center mr-4">
      {icon}
    </View>
    <View className="flex-1">
      <Text className="text-white text-base font-montserrat-semibold">
        {title}
      </Text>
      {subtitle && (
        <Text className="text-[#9A9AAF] text-sm font-montserrat-regular">
          {subtitle}
        </Text>
      )}
    </View>
    <Switch
      value={value}
      onValueChange={onValueChange}
      trackColor={{ false: '#2F2F3A', true: '#3B82F6' }}
      thumbColor="#FFFFFF"
      ios_backgroundColor="#2F2F3A"
    />
  </View>
);

const SettingsScreen: React.FC<Props> = ({ navigation, onLogout }) => {
  // Check permissions on this screen
  usePermissionCheck();

  // User context
  const {
    profile,
    isLoading,
    updateProfile,
    uploadUserAvatar,
    clearUserData,
    refreshUserData,
  } = useUser();

  // Settings state
  const [pushNotifications, setPushNotifications] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(false);
  const [locationServices, setLocationServices] = useState(true);
  const [twoFactorAuth, setTwoFactorAuth] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Load profile data when available
  useEffect(() => {
    if (profile) {
      setFullName(profile.name || '');
      setEmail(profile.email || '');
      setPhone(profile.phone || '');

      // Load notification preferences from profile.preferences if available
      if (profile.preferences) {
        setPushNotifications(profile.preferences.pushNotifications ?? true);
        setEmailNotifications(profile.preferences.emailNotifications ?? false);
        setLocationServices(profile.preferences.locationServices ?? true);
        setTwoFactorAuth(profile.preferences.twoFactorAuth ?? false);
      }
    }
  }, [profile]);

  // Track changes
  useEffect(() => {
    if (profile) {
      const changed =
        fullName !== profile.name ||
        email !== profile.email ||
        phone !== profile.phone;
      setHasChanges(changed);
    }
  }, [fullName, email, phone, profile]);

  // Refresh user data when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      refreshUserData();
    }, [refreshUserData]),
  );

  const permissionOverview = useMemo(
    () => [
      { label: 'Camera', granted: true },
      { label: 'Location', granted: locationServices },
      { label: 'Microphone', granted: true },
    ],
    [locationServices],
  );

  const handleSaveChanges = async () => {
    if (!hasChanges) return;

    setIsSaving(true);
    try {
      // Prepare preferences object with notification settings
      const preferences = {
        pushNotifications,
        emailNotifications,
        locationServices,
        twoFactorAuth,
        ...(profile?.preferences || {}),
      };

      const success = await updateProfile({
        name: fullName,
        phone: phone,
        preferences: preferences,
      });

      if (success) {
        Alert.alert('Success', 'Profile updated successfully');
        setHasChanges(false);
      } else {
        Alert.alert('Error', 'Failed to update profile. Please try again.');
      }
    } catch (error) {
      console.error('Update profile error:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarUpload = () => {
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
          } as any);

          try {
            const success = await uploadUserAvatar(formData);
            if (success) {
              Alert.alert('Success', 'Avatar updated successfully');
            } else {
              Alert.alert('Error', 'Failed to upload avatar');
            }
          } catch (error) {
            console.error('Avatar upload error:', error);
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
          } catch (error) {
            console.error('Logout failed:', error);
            Alert.alert('Error', 'Failed to logout. Please try again.');
          }
        },
      },
    ]);
  };

  const handleChangePassword = () => {
    Alert.alert(
      'Change Password',
      'This feature will redirect you to change password screen',
    );
  };

  const handle2FAToggle = (value: boolean) => {
    if (value) {
      Alert.alert(
        'Enable 2FA',
        'Two-factor authentication adds an extra layer of security to your account.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Enable',
            onPress: () => setTwoFactorAuth(true),
          },
        ],
      );
    } else {
      setTwoFactorAuth(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#05050A]">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 64 }}
      >
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
            onPress={() => navigation.navigate('ContactSupport')}
          >
            <MessageCircle size={16} color="white" />
            <Text className="text-white text-sm font-montserrat-medium ml-2">
              Support
            </Text>
          </TouchableOpacity>
        </View>

        {/* Profile */}
        {isLoading ? (
          <View
            className="mx-5 mb-6 rounded-[32px] border border-white/10 bg-[#12121B] p-5 items-center justify-center"
            style={{ height: 280 }}
          >
            <ActivityIndicator size="large" color="#3B82F6" />
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
                  />
                </View>
              </View>
            </View>
            {hasChanges && (
              <TouchableOpacity
                className="mt-4 flex-row items-center justify-center rounded-2xl bg-[#3B82F6] py-3"
                onPress={handleSaveChanges}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="white" />
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

        {/* Security */}
        <View className="mx-5 mb-6 rounded-[32px] border border-white/10 bg-[#12121B] p-5">
          <View className="flex-row items-center mb-5">
            <View className="w-10 h-10 rounded-full bg-white/5 items-center justify-center mr-3">
              <Shield size={20} color="#3B82F6" />
            </View>
            <Text className="text-white text-lg font-montserrat-semibold">
              Security
            </Text>
          </View>
          <SettingItem
            icon={<Lock size={20} color="#9A9AAF" />}
            title="Change Password"
            subtitle="Update your password regularly"
            onPress={handleChangePassword}
          />
          <ToggleSetting
            icon={<ShieldCheck size={20} color="#9A9AAF" />}
            title="Two-Factor Authentication"
            subtitle="Add an extra layer of security"
            value={twoFactorAuth}
            onValueChange={handle2FAToggle}
          />
        </View>

        {/* Notifications */}
        <View className="mx-5 mb-6 rounded-[32px] border border-white/10 bg-[#12121B] p-5">
          <View className="flex-row items-center mb-5">
            <View className="w-10 h-10 rounded-full bg-white/5 items-center justify-center mr-3">
              <Bell size={20} color="#3B82F6" />
            </View>
            <Text className="text-white text-lg font-montserrat-semibold">
              Notifications
            </Text>
          </View>
          <ToggleSetting
            icon={<Bell size={20} color="#9A9AAF" />}
            title="Push Notifications"
            subtitle="Receive updates on your device"
            value={pushNotifications}
            onValueChange={setPushNotifications}
          />
          <ToggleSetting
            icon={<Mail size={20} color="#9A9AAF" />}
            title="Email Notifications"
            subtitle="Receive recap emails"
            value={emailNotifications}
            onValueChange={setEmailNotifications}
          />
        </View>

        {/* Privacy */}
        <View className="mx-5 mb-6 rounded-[32px] border border-white/10 bg-[#12121B] p-5">
          <View className="flex-row items-center mb-5">
            <View className="w-10 h-10 rounded-full bg-white/5 items-center justify-center mr-3">
              <Shield size={20} color="#3B82F6" />
            </View>
            <Text className="text-white text-lg font-montserrat-semibold">
              Privacy
            </Text>
          </View>
          {permissionOverview.map(item => (
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
            <TouchableOpacity className="flex-1 flex-row items-center justify-center rounded-2xl border border-white/10 bg-[#0B0B13] px-4 py-3 mr-3">
              <Download size={18} color="white" />
              <Text className="text-white text-sm font-montserrat-semibold ml-2">
                Download Data
              </Text>
            </TouchableOpacity>
            <TouchableOpacity className="flex-1 flex-row items-center justify-center rounded-2xl border border-white/10 bg-[#0B0B13] px-4 py-3">
              <Shield size={18} color="white" />
              <Text className="text-white text-sm font-montserrat-semibold ml-2">
                Manage Permissions
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Legal & Support */}
        <View className="mx-5 mb-6 rounded-[32px] border border-white/10 bg-[#12121B] p-5">
          <View className="flex-row items-center mb-5">
            <View className="w-10 h-10 rounded-full bg-white/5 items-center justify-center mr-3">
              <Info size={20} color="#3B82F6" />
            </View>
            <Text className="text-white text-lg font-montserrat-semibold">
              Legal & Support
            </Text>
          </View>
          <SettingItem
            icon={<FileText size={20} color="#9A9AAF" />}
            title="Privacy Policy"
            subtitle="How we safeguard your data"
            onPress={() => navigation.navigate('PrivacyPolicy')}
          />
          <SettingItem
            icon={<FileText size={20} color="#9A9AAF" />}
            title="Terms of Service"
            subtitle="Your rights and responsibilities"
            onPress={() => navigation.navigate('TermsOfService')}
          />
          <SettingItem
            icon={<Info size={20} color="#9A9AAF" />}
            title="About EpochEye"
            subtitle="Our story and mission"
            onPress={() => navigation.navigate('AboutUs')}
          />
          <SettingItem
            icon={<MessageCircle size={20} color="#9A9AAF" />}
            title="Contact Support"
            subtitle="Chat with our team"
            onPress={() => navigation.navigate('ContactSupport')}
          />
        </View>

        <View className="items-center py-8">
          <Text className="text-[#8B8B9E] text-sm font-montserrat-medium">
            Version 1.0.0
          </Text>
          <Text className="text-[#6B6B78] text-xs font-montserrat-regular mt-1">
            © 2025 EpochEye. All rights reserved.
          </Text>
        </View>

        <View className="flex-row px-5 mb-12">
          <TouchableOpacity
            className="flex-1 flex-row items-center justify-center rounded-2xl bg-[#3B82F6] py-4 mr-3"
            onPress={handleLogout}
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
                'Delete Account',
                'This is permanent. Are you sure?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => console.log('Delete account'),
                  },
                ],
              )
            }
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
