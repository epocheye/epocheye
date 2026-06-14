/**
 * DEV-only "scan anything" entry.
 *
 * Opens the detector screen in `devPicker` mode: the same live scan UX + animation
 * as production, but the recognition agent runs ungrounded (any object, no venue,
 * no paywall) so it can be tested at home. AR devices get the world-anchored AR
 * card; non-AR devices get the on-screen card.
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
        accessibilityLabel="DEV: Scan anything"
        className="rounded-2xl border border-[rgba(203,168,98,0.45)] bg-[rgba(203,168,98,0.08)] px-4 py-3"
      >
        <Text className="text-accent-amber font-montserrat-bold text-[13px] tracking-[1.6px]">
          DEV: SCAN ANYTHING
        </Text>
        <Text className="text-[rgba(255,255,255,0.55)] font-montserrat text-[11px] mt-1">
          Run the recognition agent on any object at home · AR or on-screen card
        </Text>
      </Pressable>
    </View>
  );
};

export default DevLoadTestArModelButton;
