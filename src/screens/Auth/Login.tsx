import {
  Text,
  View,
  TouchableOpacity,
  Image,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import React, { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

const Google = require('../../assets/images/Google.webp');
import { Eye, EyeOff } from 'lucide-react-native';
import { login } from '../../utils/api/auth';

const Login = ({ navigation, onLoginSuccess }: any) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    if (!password) {
      Alert.alert('Error', 'Please enter your password');
      return;
    }

    setIsLoading(true);

    try {
      const result = await login({ email: email.trim(), password });

      if (result.success) {
        // Trigger navigation update by calling the callback
        if (onLoginSuccess) {
          onLoginSuccess();
        }
      } else {
        Alert.alert('Login Failed', result.error.message);
      }
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#111111] px-6 py-8">
      <View className="flex-1 justify-between px-1">
        {/* Header */}
        <View>
          <View className="items-center mb-10">
            <Text className="text-white font-montserrat-bold text-3xl mb-2">
              Welcome Back
            </Text>
            <Text className="text-gray-400 font-montserrat-regular text-base text-center">
              Sign in to continue your journey
            </Text>
          </View>

          {/* Email Input */}
          <View className="mb-5">
            <Text className="text-white font-montserrat-medium text-base mb-2">
              Email Address
            </Text>
            <TextInput
              className="bg-[#1a1a1a] text-white py-4 px-5 rounded-xl font-montserrat-regular text-base"
              placeholder="Enter your email"
              placeholderTextColor="#888888"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!isLoading}
            />
          </View>

          {/* Password Input */}
          <View className="mb-4">
            <Text className="text-white font-montserrat-medium text-base mb-2">
              Password
            </Text>
            <View className="flex-row items-center bg-[#1a1a1a] rounded-xl px-5 py-1">
              <TextInput
                className="flex-1 text-white font-montserrat-regular text-base"
                placeholder="Enter your password"
                placeholderTextColor="#888888"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                editable={!isLoading}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                disabled={isLoading}
              >
                {showPassword ? (
                  <EyeOff size={20} color="#888888" />
                ) : (
                  <Eye size={20} color="#888888" />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Forgot Password */}
          <TouchableOpacity
            onPress={() => navigation.navigate('ForgotPassword')}
            className="self-end mb-6"
            disabled={isLoading}
          >
            <Text className="text-blue-500 font-montserrat-medium text-base">
              Forgot Password?
            </Text>
          </TouchableOpacity>

          {/* Login Button */}
          <TouchableOpacity
            onPress={handleLogin}
            className="bg-white py-4 rounded-xl mb-6 flex-row justify-center items-center"
            disabled={isLoading}
            style={{ opacity: isLoading ? 0.7 : 1 }}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#000000" />
            ) : (
              <Text className="text-black font-montserrat-semibold text-center text-lg">
                Log In
              </Text>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View className="flex-row items-center mb-6">
            <View className="flex-1 h-px bg-gray-700" />
            <Text className="text-gray-400 font-montserrat-regular text-sm mx-4">
              Or
            </Text>
            <View className="flex-1 h-px bg-gray-700" />
          </View>

          {/* Google Sign In */}
          <TouchableOpacity className="border border-gray-700 py-4 rounded-xl flex-row justify-center items-center gap-3">
            <Image source={Google} className="size-5" resizeMode="contain" />
            <Text className="text-white font-montserrat-semibold text-center text-base">
              Continue with Google
            </Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View className="flex-row justify-center items-center mt-6">
          <Text className="text-gray-400 font-montserrat-regular text-base">
            Don't have an account?{' '}
          </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Register')}>
            <Text className="text-blue-500 font-montserrat-semibold text-base">
              Sign Up
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default Login;
