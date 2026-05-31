import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  DrawerContentScrollView,
  type DrawerContentComponentProps,
} from '@react-navigation/drawer';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Clock,
  LogOut,
  Map as MapIcon,
  Ticket,
  UserRound,
} from 'lucide-react-native';
import AnimatedLogo from '../../components/ui/AnimatedLogo';
import { ROUTES } from '../../core/constants';
import { FONTS } from '../../core/constants/theme';
import type { TabParamList } from '../../core/types';

const GOLD = '#C9A84C';
const INACTIVE = '#8A8170';
const PARCHMENT = '#F5F0E8';

interface DrawerItemDef {
  route: keyof TabParamList;
  label: string;
  Icon: React.ComponentType<{ color: string; size: number }>;
}

// The four destinations (same set as the former bottom tabs).
const ITEMS: DrawerItemDef[] = [
  { route: ROUTES.TABS.HOME, label: 'Explore', Icon: MapIcon },
  { route: ROUTES.TABS.PASSPORT, label: 'Passport', Icon: Ticket },
  { route: ROUTES.TABS.DAILY, label: 'Daily', Icon: Clock },
  { route: ROUTES.TABS.ACCOUNT, label: 'Account', Icon: UserRound },
];

interface Props extends DrawerContentComponentProps {
  onLogout?: () => void;
}

/**
 * Custom heritage-styled drawer: brand block, the four destinations with icons +
 * active highlight, and a Sign Out footer. Deliberately not the default RN look.
 * Room is left below the items for future entries (settings/language).
 */
const CustomDrawerContent: React.FC<Props> = ({ onLogout, ...props }) => {
  const insets = useSafeAreaInsets();
  const activeRoute = props.state.routeNames[props.state.index];

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <DrawerContentScrollView
        {...props}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Brand */}
        <View style={styles.brand}>
          <AnimatedLogo
            size={46}
            motion="pulse"
            variant="white"
            showRing={false}
          />
          <Text style={styles.brandText}>EPOCHEYE</Text>
          <Text style={styles.brandSub}>Walk where they walked</Text>
        </View>

        <View style={styles.divider} />

        {/* Destinations */}
        <View style={styles.items}>
          {ITEMS.map(({ route, label, Icon }) => {
            const active = route === activeRoute;
            return (
              <Pressable
                key={route}
                onPress={() => {
                  props.navigation.navigate(route);
                  props.navigation.closeDrawer();
                }}
                style={[styles.item, active && styles.itemActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={label}>
                <Icon color={active ? GOLD : INACTIVE} size={20} />
                <Text
                  style={[styles.itemLabel, { color: active ? GOLD : PARCHMENT }]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </DrawerContentScrollView>

      {/* Footer: sign out */}
      {onLogout ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.divider} />
          <Pressable
            onPress={() => {
              props.navigation.closeDrawer();
              onLogout();
            }}
            style={styles.item}
            accessibilityRole="button"
            accessibilityLabel="Sign out">
            <LogOut color={INACTIVE} size={20} />
            <Text style={[styles.itemLabel, { color: PARCHMENT }]}>Sign Out</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0A' },
  scrollContent: { paddingTop: 0 },
  brand: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 18,
    alignItems: 'flex-start',
  },
  brandText: {
    marginTop: 12,
    color: PARCHMENT,
    fontFamily: FONTS.bold,
    fontSize: 18,
    letterSpacing: 3,
  },
  brandSub: {
    marginTop: 2,
    color: INACTIVE,
    fontFamily: FONTS.italic,
    fontStyle: 'italic',
    fontSize: 12,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(201,168,76,0.18)',
    marginHorizontal: 16,
    marginVertical: 8,
  },
  items: { paddingHorizontal: 12, paddingTop: 6 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  itemActive: { backgroundColor: 'rgba(201,168,76,0.12)' },
  itemLabel: { fontFamily: FONTS.semiBold, fontSize: 15 },
  footer: { paddingHorizontal: 12 },
});

export default CustomDrawerContent;
