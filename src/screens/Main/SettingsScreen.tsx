import {
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  TextInput,
  Image,
} from 'react-native';
import React, { useMemo, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NavigationProp } from '@react-navigation/native';
import { usePermissionCheck } from '../../utils/usePermissionCheck';
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
} from 'lucide-react-native';

interface Props {
  navigation: NavigationProp<any>;
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

const SettingsScreen: React.FC<Props> = ({ navigation }) => {
  // Check permissions on this screen
  usePermissionCheck();

  // Settings state
  const [pushNotifications, setPushNotifications] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(false);
  const [locationServices, setLocationServices] = useState(true);
  const [twoFactorAuth, setTwoFactorAuth] = useState(false);
  const [fullName, setFullName] = useState('John Doe');
  const [email, setEmail] = useState('john.doe@example.com');
  const [phone, setPhone] = useState('+1 (555) 123-4567');

  const permissionOverview = useMemo(
    () => [
      { label: 'Camera', granted: true },
      { label: 'Location', granted: locationServices },
      { label: 'Microphone', granted: true },
    ],
    [locationServices],
  );

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: () => {
          // Handle logout logic
          console.log('Logout');
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
        <View className="mx-5 mb-6 rounded-[32px] border border-white/10 bg-[#12121B] p-5">
          <View className="flex-row items-center">
            <View className="w-16 h-16 rounded-full bg-white/5 items-center justify-center mr-4 relative">
              <Image
                source={require('../../assets/images/logo-white.png')}
                className="w-10 h-10"
                resizeMode="contain"
              />
              <TouchableOpacity className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[#FF7A18] items-center justify-center">
                <Camera size={16} color="white" />
              </TouchableOpacity>
            </View>
            <View className="flex-1">
              <Text className="text-white text-xl font-montserrat-bold">
                {fullName}
              </Text>
              <Text className="text-[#9A9AAF] text-sm font-montserrat-regular mt-1">
                {email}
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
        </View>

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
