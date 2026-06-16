/**
 * Floating gold-pill bottom navigation, matching the mockups: a rounded glass
 * bar with the active tab as a solid gold pill (icon + label) and inactive tabs
 * as muted icons. Used as the custom `tabBar` for the main bottom-tab navigator.
 */
import React from 'react';
import {Pressable, Text, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {
  Award,
  Home,
  Sunrise,
  User,
  type LucideIcon,
} from 'lucide-react-native';
import type {BottomTabBarProps} from '@react-navigation/bottom-tabs';
import {COLORS, FONTS} from '../../core/constants/theme';

const MUTED = '#98928A';

function metaFor(routeName: string): {Icon: LucideIcon; label: string} {
  const n = routeName.toLowerCase();
  if (n.includes('passport')) return {Icon: Award, label: 'Passport'};
  if (n.includes('daily')) return {Icon: Sunrise, label: 'Daily'};
  if (n.includes('account') || n.includes('setting')) return {Icon: User, label: 'Account'};
  return {Icon: Home, label: 'Home'};
}

const FloatingTabBar: React.FC<BottomTabBarProps> = ({state, navigation}) => {
  const insets = useSafeAreaInsets();
  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: 20,
        paddingBottom: insets.bottom > 0 ? insets.bottom : 14,
      }}>
      <View className="flex-row items-center justify-between rounded-full border border-white/10 bg-card px-3 py-3">
        {state.routes.map((route, i) => {
          const focused = state.index === i;
          const {Icon, label} = metaFor(route.name);

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          if (focused) {
            return (
              <Pressable
                key={route.key}
                onPress={onPress}
                accessibilityRole="button"
                accessibilityState={{selected: true}}
                accessibilityLabel={label}
                className="flex-row items-center gap-2 rounded-full bg-primary px-4 py-2.5">
                <Icon color={COLORS.bg} size={20} />
                <Text style={{fontFamily: FONTS.uiSemiBold, fontSize: 14, color: COLORS.bg}}>
                  {label}
                </Text>
              </Pressable>
            );
          }

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              accessibilityRole="button"
              accessibilityLabel={label}
              hitSlop={8}
              className="items-center justify-center px-4 py-2.5">
              <Icon color={MUTED} size={24} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

export default FloatingTabBar;
