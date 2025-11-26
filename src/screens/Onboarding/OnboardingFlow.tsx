import React, { useState, useCallback } from 'react';
import { View, Alert } from 'react-native';
import OnboardingIntro from './OnboardingIntro';
import Questionnaire, { UserPreferences } from './Questionnaire';
import SetupComplete from './SetupComplete';

type OnboardingStep = 'intro' | 'questionnaire' | 'complete';

interface OnboardingFlowProps {
  navigation: any;
}

/**
 * OnboardingFlow - Main container for the post-signup onboarding experience.
 * Manages state transitions between:
 * 1. Intro slides (feature explanation)
 * 2. Questionnaire (user preferences)
 * 3. Setup complete (confirmation & feed preview)
 */
const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ navigation }) => {
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('intro');
  const [userPreferences, setUserPreferences] =
    useState<UserPreferences | null>(null);

  /**
   * Mock API call to save user preferences.
   * In production, this would call your backend API.
   */
  const savePreferencesToAPI = async (
    preferences: UserPreferences,
  ): Promise<boolean> => {
    // Simulating API call delay
    return new Promise(resolve => {
      console.log('Saving preferences to API:', preferences);
      setTimeout(() => {
        // Mock successful save
        resolve(true);
      }, 500);
    });
  };

  /**
   * Called when user completes the intro slides.
   */
  const handleIntroComplete = useCallback(() => {
    setCurrentStep('questionnaire');
  }, []);

  /**
   * Called when user wants to go back from questionnaire to intro.
   */
  const handleBackToIntro = useCallback(() => {
    setCurrentStep('intro');
  }, []);

  /**
   * Called when user completes the questionnaire.
   * Saves preferences and transitions to completion screen.
   */
  const handleQuestionnaireComplete = useCallback(
    async (preferences: UserPreferences) => {
      try {
        // Save to local state
        setUserPreferences(preferences);

        // Mock API call
        const success = await savePreferencesToAPI(preferences);

        if (success) {
          setCurrentStep('complete');
        } else {
          Alert.alert(
            'Error',
            'Failed to save your preferences. Please try again.',
            [{ text: 'OK' }],
          );
        }
      } catch (error) {
        console.error('Error saving preferences:', error);
        Alert.alert('Error', 'Something went wrong. Please try again.', [
          { text: 'OK' },
        ]);
      }
    },
    [],
  );

  /**
   * Called when user taps "Go to Home" on completion screen.
   * Navigates to the main app.
   */
  const handleGoHome = useCallback(() => {
    // Navigate to main app
    // In a real app, this would set auth state and navigate to MainNavigation
    navigation.reset({
      index: 0,
      routes: [{ name: 'Permissions' }], // Go to permissions first, then home
    });
  }, [navigation]);

  return (
    <View className="flex-1 bg-[#070709]">
      {currentStep === 'intro' && (
        <OnboardingIntro onComplete={handleIntroComplete} />
      )}

      {currentStep === 'questionnaire' && (
        <Questionnaire
          onComplete={handleQuestionnaireComplete}
          onBack={handleBackToIntro}
        />
      )}

      {currentStep === 'complete' && userPreferences && (
        <SetupComplete preferences={userPreferences} onGoHome={handleGoHome} />
      )}
    </View>
  );
};

export default OnboardingFlow;
