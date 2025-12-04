import {
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
  Linking,
  Animated,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import React, { useState, useRef } from 'react';

const Google = require('../assets/images/Google.webp');

const Email = ({ navigation }: any) => {
  const [step, setStep] = useState(1); // 1: name, 2: email, 3: password, 4: confirm password
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const fadeAnim = useRef(new Animated.Value(1)).current;

  const handleNext = () => {
    // Fade out animation
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      // Change step or navigate to onboarding
      if (step < 4) {
        setStep(step + 1);
        // Fade in animation
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }).start();
      } else {
        // Navigate to Onboarding Flow after account creation
        navigation.navigate('OnboardingFlow');
      }
    });
  };

  const handleBack = () => {
    if (step > 1) {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setStep(step - 1);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }).start();
      });
    }
  };

  const isStepValid = () => {
    switch (step) {
      case 1:
        return name.trim().length > 0;
      case 2:
        return email.trim().length > 0 && email.includes('@');
      case 3:
        return password.length >= 6;
      case 4:
        return confirmPassword === password;
      default:
        return false;
    }
  };

  const getButtonText = () => {
    if (step < 4) return 'Continue';
    return 'Create Account';
  };

  const getStepProgress = () => {
    return `${step}/4`;
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 w-full"
    >
      <View className="justify-between flex-1 items-center">
        {/* Progress Indicator */}
        <View className="w-full mb-8">
          <View className="flex-row items-center gap-2">
            {[1, 2, 3, 4].map(i => (
              <View
                key={i}
                className={`h-1 flex-1 rounded-full ${
                  i <= step ? 'bg-white' : 'bg-gray-700'
                }`}
              />
            ))}
          </View>
          <Text className="text-gray-400 font-montserrat-regular text-sm mt-2 text-right">
            Step {getStepProgress()}
          </Text>
        </View>

        <Animated.View
          style={{ opacity: fadeAnim }}
          className="w-full flex-1 justify-start"
        >
          {/* Step 1: Name */}
          {step === 1 && (
            <View className="w-full">
              <Text className="text-2xl font-montserrat-semibold text-white mb-2">
                What's your name?
              </Text>
              <Text className="text-gray-400 font-montserrat-regular mb-6">
                Let's start with the basics
              </Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Enter your full name"
                placeholderTextColor="#888888"
                className="bg-[#1a1a1a] text-white py-4 rounded-2xl px-5 font-montserrat-regular w-full text-lg"
                keyboardType="default"
                autoFocus
                returnKeyType="next"
                onSubmitEditing={isStepValid() ? handleNext : undefined}
              />
            </View>
          )}

          {/* Step 2: Email */}
          {step === 2 && (
            <View className="w-full">
              <Text className="text-2xl font-montserrat-semibold text-white mb-2">
                What's your email?
              </Text>
              <Text className="text-gray-400 font-montserrat-regular mb-6">
                We'll use this to keep your account secure
              </Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="your.email@example.com"
                placeholderTextColor="#888888"
                className="bg-[#1a1a1a] text-white py-4 rounded-2xl px-5 font-montserrat-regular w-full text-lg"
                keyboardType="email-address"
                autoCapitalize="none"
                autoFocus
                returnKeyType="next"
                onSubmitEditing={isStepValid() ? handleNext : undefined}
              />
            </View>
          )}

          {/* Step 3: Password */}
          {step === 3 && (
            <View className="w-full">
              <Text className="text-2xl font-montserrat-semibold text-white mb-2">
                Create a password
              </Text>
              <Text className="text-gray-400 font-montserrat-regular mb-6">
                Must be at least 6 characters
              </Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Enter password"
                keyboardType="visible-password"
                placeholderTextColor="#888888"
                className="bg-[#1a1a1a] text-white py-4 rounded-2xl px-5 font-montserrat-regular w-full text-lg"
                secureTextEntry
                autoFocus
                returnKeyType="next"
                onSubmitEditing={isStepValid() ? handleNext : undefined}
              />
              {password.length > 0 && password.length < 6 && (
                <Text className="text-red-400 font-montserrat-regular text-sm mt-2 ml-2">
                  Password too short
                </Text>
              )}
            </View>
          )}

          {/* Step 4: Confirm Password */}
          {step === 4 && (
            <View className="w-full">
              <Text className="text-2xl font-montserrat-semibold text-white mb-2">
                Confirm your password
              </Text>
              <Text className="text-gray-400 font-montserrat-regular mb-6">
                Just to make sure we got it right
              </Text>
              <TextInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Re-enter password"
                placeholderTextColor="#888888"
                className="bg-[#1a1a1a] text-white py-4 rounded-2xl px-5 font-montserrat-regular w-full text-lg"
                secureTextEntry
                autoFocus
                returnKeyType="done"
                onSubmitEditing={
                  isStepValid() ? () => console.log('Register') : undefined
                }
              />
              {confirmPassword.length > 0 && confirmPassword !== password && (
                <Text className="text-red-400 font-montserrat-regular text-sm mt-2 ml-2">
                  Passwords don't match
                </Text>
              )}
            </View>
          )}
        </Animated.View>

        {/* Bottom Section */}
        <View className="w-full">
          {/* Back Button (only show after step 1) */}
          {step > 1 && (
            <TouchableOpacity onPress={handleBack} className="mb-4">
              <Text className="text-gray-400 font-montserrat-regular text-center">
                ← Back
              </Text>
            </TouchableOpacity>
          )}

          {/* Continue/Register Button */}
          <TouchableOpacity
            className={`py-4 rounded-2xl flex-row justify-center items-center gap-2 ${
              isStepValid() ? 'bg-white' : 'bg-gray-700'
            }`}
            onPress={isStepValid() ? handleNext : undefined}
            disabled={!isStepValid()}
          >
            <Text
              className={`font-montserrat-semibold text-center text-lg ${
                isStepValid() ? 'text-black' : 'text-gray-500'
              }`}
            >
              {getButtonText()}
            </Text>
          </TouchableOpacity>

          {/* Divider */}
          <View className="flex-row items-center my-6">
            <View className="flex-1 h-px bg-gray-700" />
            <Text className="text-gray-400 font-montserrat-regular text-sm mx-4">
              Or
            </Text>
            <View className="flex-1 h-px bg-gray-700" />
          </View>

          {/* Google Sign In */}
          <TouchableOpacity className="border border-gray-700 py-4 rounded-2xl flex-row justify-center items-center gap-3">
            <Image source={Google} className="size-5" resizeMode="contain" />
            <Text className="text-white font-montserrat-semibold text-center text-base">
              Continue with Google
            </Text>
          </TouchableOpacity>

          {/* Terms & Privacy */}
          <Text className="text-gray-400 font-montserrat-regular text-center text-xs mt-6 leading-5">
            By continuing, you agree to our{' '}
            <Text
              className="text-blue-400 underline"
              onPress={() => Linking.openURL('https://epocheye.app/terms')}
            >
              Terms
            </Text>{' '}
            and{' '}
            <Text
              className="text-blue-400 underline"
              onPress={() => Linking.openURL('https://epocheye.app/privacy')}
            >
              Privacy Policy
            </Text>
          </Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

export default Email;
