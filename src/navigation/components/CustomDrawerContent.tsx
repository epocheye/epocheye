import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  DrawerContentScrollView,
  type DrawerContentComponentProps,
} from '@react-navigation/drawer';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Clock,
  LogOut,
  Map as MapIcon,
  Settings as SettingsIcon,
  Ticket,
  UserRound,
} from 'lucide-react-native';
import AnimatedLogo from '../../components/ui/AnimatedLogo';
import { ROUTES } from '../../core/constants';
import { FONTS } from '../../core/constants/theme';
import { useUserStore } from '../../stores/userStore';
import type { TabParamList } from '../../core/types';

// Higher-contrast palette than the old flat panel: brighter gold + a parchment
// that actually reads against the gradient, plus a dim tone reserved for
// secondary/footer rows only.
const GOLD = '#E2C56A';
const GOLD_DIM = '#B89B4E';
const PARCHMENT = '#F3EEE3';
const PARCHMENT_DIM = '#A79F8C';

interface DrawerItemDef {
  route: keyof TabParamList;
  label: string;
  Icon: React.ComponentType<{ color: string; size: number }>;
}

// Primary destinations (same set as the former bottom tabs).
const ITEMS: DrawerItemDef[] = [
  { route: ROUTES.TABS.HOME, label: 'Explore', Icon: MapIcon },
  { route: ROUTES.TABS.PASSPORT, label: 'Passport', Icon: Ticket },
  { route: ROUTES.TABS.DAILY, label: 'Daily', Icon: Clock },
  { route: ROUTES.TABS.ACCOUNT, label: 'Account', Icon: UserRound },
];

// Preferences shortcut — a single Settings entry (profile, narration language,
// permissions all live on the Account/Settings screen), surfaced for quick reach.
const PREFERENCES: DrawerItemDef[] = [
  { route: ROUTES.TABS.ACCOUNT, label: 'Settings', Icon: SettingsIcon },
];

interface Props extends DrawerContentComponentProps {
  onLogout?: () => void;
}

function initialsOf(name?: string, email?: string): string {
  const src = (name || email || '').trim();
  if (!src) return 'E';
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

/**
 * Heritage-styled drawer: gradient backdrop with a faint gold top glow, a small
 * profile block, the primary destinations with an active accent bar + pill, a
 * Preferences group (Settings / Language), and a Sign Out footer.
 */
const CustomDrawerContent: React.FC<Props> = ({ onLogout, ...props }) => {
  const insets = useSafeAreaInsets();
  const activeRoute = props.state.routeNames[props.state.index];
  const profile = useUserStore(s => s.profile);

  const go = (route: keyof TabParamList) => {
    props.navigation.navigate(route);
    props.navigation.closeDrawer();
  };

  const renderItem = (
    { route, label, Icon }: DrawerItemDef,
    active: boolean,
    key: string,
  ) => (
    <Pressable
      key={key}
      onPress={() => go(route)}
      style={[styles.item, active && styles.itemActive]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}>
      {active ? <View style={styles.activeBar} /> : null}
      <Icon color={active ? GOLD : PARCHMENT_DIM} size={20} />
      <Text style={[styles.itemLabel, { color: active ? GOLD : PARCHMENT }]}>
        {label}
      </Text>
    </Pressable>
  );

  return (
    <LinearGradient
      colors={['#15120B', '#0C0A07', '#060606']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.container}>
      {/* Faint gold glow at the top edge for depth. */}
      <LinearGradient
        colors={['rgba(226,197,106,0.16)', 'rgba(226,197,106,0)']}
        style={styles.topGlow}
        pointerEvents="none"
      />

      <DrawerContentScrollView
        {...props}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 8 },
        ]}>
        {/* Brand — logo mark only (no wordmark). */}
        <View style={styles.brand}>
          <AnimatedLogo size={56} motion="pulse" variant="white" showRing={false} />
          <Text style={styles.brandSub}>Walk where they walked</Text>
        </View>

        {/* Profile */}
        <View style={styles.profile}>
          {profile?.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarInitials}>
                {initialsOf(profile?.name, profile?.email)}
              </Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName} numberOfLines={1}>
              {profile?.name?.trim() || 'Traveler'}
            </Text>
            {profile?.email ? (
              <Text style={styles.profileEmail} numberOfLines={1}>
                {profile.email}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.divider} />

        {/* Primary destinations */}
        <View style={styles.items}>
          {ITEMS.map(item => renderItem(item, item.route === activeRoute, item.route))}
        </View>

        {/* Preferences */}
        <Text style={styles.sectionLabel}>PREFERENCES</Text>
        <View style={styles.items}>
          {PREFERENCES.map((item, i) => renderItem(item, false, `pref-${i}`))}
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
            <LogOut color={PARCHMENT_DIM} size={20} />
            <Text style={[styles.itemLabel, { color: PARCHMENT }]}>Sign Out</Text>
          </Pressable>
        </View>
      ) : null}
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  topGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 160,
  },
  scrollContent: { paddingTop: 0 },
  brand: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 14,
    alignItems: 'flex-start',
  },
  brandSub: {
    marginTop: 12,
    color: PARCHMENT_DIM,
    fontFamily: FONTS.italic,
    fontStyle: 'italic',
    fontSize: 12,
  },
  profile: {
    marginHorizontal: 16,
    marginTop: 4,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(226,197,106,0.14)',
  },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(226,197,106,0.18)',
  },
  avatarInitials: {
    color: GOLD,
    fontFamily: FONTS.bold,
    fontSize: 15,
    letterSpacing: 0.5,
  },
  profileName: {
    color: PARCHMENT,
    fontFamily: FONTS.semiBold,
    fontSize: 15,
  },
  profileEmail: {
    marginTop: 1,
    color: PARCHMENT_DIM,
    fontFamily: FONTS.sans,
    fontSize: 12,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(226,197,106,0.16)',
    marginHorizontal: 16,
    marginVertical: 10,
  },
  sectionLabel: {
    marginTop: 6,
    marginBottom: 2,
    marginHorizontal: 24,
    color: GOLD_DIM,
    fontFamily: FONTS.semiBold,
    fontSize: 11,
    letterSpacing: 1.5,
  },
  items: { paddingHorizontal: 12, paddingTop: 4 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  itemActive: { backgroundColor: 'rgba(226,197,106,0.16)' },
  activeBar: {
    position: 'absolute',
    left: 0,
    top: 10,
    bottom: 10,
    width: 3,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
    backgroundColor: GOLD,
  },
  itemLabel: { fontFamily: FONTS.semiBold, fontSize: 15 },
  footer: { paddingHorizontal: 12 },
});

export default CustomDrawerContent;
