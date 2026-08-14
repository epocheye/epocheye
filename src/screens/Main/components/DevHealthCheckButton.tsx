/**
 * DEV-only entry to the Workflow Health-Check board.
 *
 * Opens DevHealthCheckScreen: every app workflow listed with a launch button,
 * a persisted pass/fail status, and the crash journal (including native-crash
 * "died on screen X" detection).
 *
 * Renders for `__DEV__` OR an admin email — it does NOT vanish in release, and
 * `DevHealthCheckScreen` is registered unconditionally in MainNavigation. That
 * is deliberate: this button is the only route to the on-site authoring tool, so
 * gating it on __DEV__ would mean the admin at a monument, holding a release
 * build, could not reach the thing they travelled there to use. Access is gated
 * by the email allowlist instead. (This comment previously claimed the opposite.)
 */

import React, {useCallback} from 'react';
import {Pressable, Text, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {ROUTES} from '../../../core/constants';
import type {MainStackParamList} from '../../../core/types/navigation.types';
// ADMIN-HARNESS (REMOVE AFTER KONARK)
import {isAdminUser} from '../../../shared/auth/isAdminUser';
import {useUserStore} from '../../../stores/userStore';

const DevHealthCheckButton: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  // ADMIN-HARNESS (REMOVE AFTER KONARK) — subscribe so the button appears once the
  // profile loads; visible in debug (all) or release (admin emails only).
  const email = useUserStore(s => s.profile?.email);

  const handleOpen = useCallback(() => {
    navigation.navigate(ROUTES.MAIN.DEV_HEALTH);
  }, [navigation]);

  if (!(__DEV__ || isAdminUser(email))) return null;

  return (
    <View className="mx-5 mt-3">
      <Pressable
        onPress={handleOpen}
        accessibilityRole="button"
        accessibilityLabel="DEV: Workflow health check"
        className="rounded-2xl border border-[rgba(203,168,98,0.45)] bg-[rgba(203,168,98,0.08)] px-4 py-3"
      >
        <Text className="text-accent-amber font-ui-semibold text-[13px] tracking-[1.6px]">
          DEV: WORKFLOW HEALTH CHECK
        </Text>
        <Text className="text-[rgba(255,255,255,0.55)] font-ui text-[11px] mt-1">
          Launch every flow · mark pass/fail · view crash log
        </Text>
      </Pressable>
    </View>
  );
};

export default DevHealthCheckButton;
