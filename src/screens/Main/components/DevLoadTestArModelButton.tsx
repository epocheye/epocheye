/**
 * DEV-only AR model-picker entry.
 *
 * Opens the detector screen in `devPicker` mode: pick one of the 5 museum models
 * → it auto-places ~1.2 m in front of you with its data card + scan animation.
 * A home-testable check that models launch and animations fire, decoupled from
 * being at the museum / the detector recognizing a real artifact.
 *
 * Compiles to a no-op in production builds.
 */

import React, {useCallback} from 'react';
import {Pressable, Text, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {ROUTES} from '../../../core/constants';
import type {MainStackParamList} from '../../../core/types/navigation.types';

const DevLoadTestArModelButton: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<MainStackParamList>>();

  const handleArModelTest = useCallback(() => {
    navigation.navigate(ROUTES.MAIN.DETECT_AR, {devPicker: true});
  }, [navigation]);

  if (!__DEV__) return null;

  return (
    <View className="mx-5 mt-4">
      <Pressable
        onPress={handleArModelTest}
        accessibilityRole="button"
        accessibilityLabel="DEV: AR Model Test"
        className="rounded-2xl border border-[rgba(232,160,32,0.45)] bg-[rgba(232,160,32,0.08)] px-4 py-3"
      >
        <Text className="text-accent-amber font-montserrat-bold text-[13px] tracking-[1.6px]">
          DEV: AR MODEL TEST
        </Text>
        <Text className="text-[rgba(255,255,255,0.55)] font-montserrat text-[11px] mt-1">
          Pick a museum model · auto-places in front · checks model + animations
        </Text>
      </Pressable>
    </View>
  );
};

export default DevLoadTestArModelButton;
