/**
 * VenueActivationBanner — the in-app "Epocheye is now active here" moment.
 *
 * Mounted once at the main-stack root so it can appear over any screen. It watches
 * `useCurrentZoneStore`; when the user crosses INTO a venue (null→zone, signalled by
 * a fresh `enteredAt`), it slides a banner down for a few seconds with a one-tap
 * "Begin" into the scanner. This pairs with the local arrival notification — the
 * notification reaches them on the lock screen, this reaches them in-app.
 */
import React, {useEffect, useRef, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Animated, {FadeInUp, FadeOutUp} from 'react-native-reanimated';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {Sparkles, X} from 'lucide-react-native';

import {COLORS, FONTS, FONT_SIZES, RADIUS, SPACING} from '../core/constants/theme';
import {ROUTES} from '../core/constants';
import {useCurrentZoneStore} from '../stores/currentZoneStore';
import type {MainStackParamList} from '../core/types/navigation.types';

const VISIBLE_MS = 6500;

const VenueActivationBanner: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const zone = useCurrentZoneStore(s => s.zone);
  const enteredAt = useCurrentZoneStore(s => s.enteredAt);

  const [shown, setShown] = useState(false);
  const lastEntered = useRef<number | null>(null);

  useEffect(() => {
    if (!zone || !enteredAt || enteredAt === lastEntered.current) return;
    lastEntered.current = enteredAt;
    setShown(true);
    const id = setTimeout(() => setShown(false), VISIBLE_MS);
    return () => clearTimeout(id);
  }, [zone, enteredAt]);

  if (!shown || !zone) return null;

  return (
    <SafeAreaView style={styles.root} edges={['top']} pointerEvents="box-none">
      <Animated.View
        entering={FadeInUp.duration(380)}
        exiting={FadeOutUp.duration(280)}
        style={styles.banner}>
        <View style={styles.iconWrap}>
          <Sparkles size={16} color={COLORS.bg} />
        </View>
        <View style={styles.textWrap}>
          <Text style={styles.title} numberOfLines={1}>
            Epocheye is active at {zone.name}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {zone.epochLabel} · point at an exhibit to begin
          </Text>
        </View>
        <Pressable
          onPress={() => {
            setShown(false);
            navigation.navigate(ROUTES.MAIN.DETECT_AR, {
              venueSlug: zone.monument_id,
            });
          }}
          style={styles.beginBtn}>
          <Text style={styles.beginText}>Begin</Text>
        </Pressable>
        <Pressable
          onPress={() => setShown(false)}
          hitSlop={10}
          style={styles.closeBtn}>
          <X size={16} color={COLORS.textTertiary} />
        </Pressable>
      </Animated.View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: {position: 'absolute', top: 0, left: 0, right: 0},
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.sm,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    backgroundColor: COLORS.bgWarm,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.amberSubtle,
    shadowColor: COLORS.sky,
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: {width: 0, height: 6},
    elevation: 10,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.sky,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {flex: 1},
  title: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: FONT_SIZES.small,
    color: COLORS.textPrimary,
  },
  subtitle: {
    fontFamily: FONTS.sans,
    fontSize: FONT_SIZES.caption,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  beginBtn: {
    backgroundColor: COLORS.sky,
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  beginText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: FONT_SIZES.small,
    color: COLORS.bg,
  },
  closeBtn: {padding: 2},
});

export default VenueActivationBanner;
