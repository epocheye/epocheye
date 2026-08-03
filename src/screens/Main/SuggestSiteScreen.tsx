/**
 * SuggestSiteScreen — shown after login when the user's current location has no
 * Epocheye site within 5 km (gated from Home). It briefly explains Epocheye and
 * lets the user submit a place they'd like us to cover.
 *
 * No reward and no image upload in this build. Copy below is placeholder — edit
 * freely; it intentionally makes no specific brand claims.
 */
import React, {useCallback, useState} from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
// Keyboard-aware scroll so the form fields + submit stay visible while typing
// (RN edge-to-edge leaves plain ScrollViews underneath the IME).
import {KeyboardAwareScrollView} from 'react-native-keyboard-controller';
import {SafeAreaView} from 'react-native-safe-area-context';
import Animated, {FadeIn, FadeInUp} from 'react-native-reanimated';
import {Check, Compass, MapPin, X} from 'lucide-react-native';
import {useNavigation} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {COLORS, FONTS, FONT_SIZES, RADIUS, SPACING} from '../../core/constants/theme';
import {usePlacesStore} from '../../stores/placesStore';
import {suggestPlace} from '../../utils/api/suggestions';
import OfflineInline from '../../components/ui/OfflineInline';
import {useNetwork} from '../../context/NetworkContext';
import type {MainStackParamList} from '../../core/types/navigation.types';

const SuggestSiteScreen: React.FC = () => {
  const {t} = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const currentLocation = usePlacesStore(s => s.currentLocation);
  // The form stays visible and editable offline — only sending is blocked, so a
  // typed suggestion isn't thrown away by a dropped connection.
  const {isOffline} = useNetwork();

  const [placeName, setPlaceName] = useState('');
  const [placeDetails, setPlaceDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleClose = useCallback(() => navigation.goBack(), [navigation]);

  const handleSubmit = useCallback(async () => {
    const name = placeName.trim();
    if (!name) {
      setError('Please enter the name of the place.');
      return;
    }
    // The button is already disabled offline; this covers connectivity dropping
    // between render and press.
    if (isOffline) {
      setError(t('offline.suggestMessage'));
      return;
    }
    setSubmitting(true);
    setError(null);

    const result = await suggestPlace({
      placeName: name,
      placeDetails: placeDetails.trim() || undefined,
      latitude: currentLocation?.latitude,
      longitude: currentLocation?.longitude,
    });

    setSubmitting(false);
    if (result.success) {
      setDone(true);
    } else {
      setError("Couldn't send that just now. Please try again.");
    }
  }, [placeName, placeDetails, currentLocation, isOffline, t]);

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.topRow}>
          <View style={styles.brandRow}>
            <Compass size={16} color={COLORS.sky} />
            <Text style={styles.brand}>EPOCHEYE</Text>
          </View>
          <Pressable onPress={handleClose} hitSlop={12} style={styles.closeBtn}>
            <X size={18} color={COLORS.textSecondary} />
          </Pressable>
        </View>

        <KeyboardAwareScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          bottomOffset={24}
          showsVerticalScrollIndicator={false}>
          {done ? (
            <Animated.View entering={FadeIn.duration(400)} style={styles.card}>
              <View style={styles.cardTopRow}>
                <Check size={15} color={COLORS.sky} />
                <Text style={styles.cardLabel}>SUGGESTION SENT</Text>
              </View>
              <Text style={styles.venueName}>Thanks for the tip.</Text>
              <Text style={styles.venueMeta}>
                Thanks, we'll let you know when it's live.
              </Text>
              <Pressable onPress={handleClose} style={styles.primaryBtn}>
                <Text style={styles.primaryBtnText}>Done</Text>
              </Pressable>
            </Animated.View>
          ) : (
            <>
              <Animated.View entering={FadeIn.duration(400)}>
                <Text style={styles.kicker}>No Epocheye sites near you yet</Text>
                <Text style={styles.title}>Tell us where to go next.</Text>
                {/* Placeholder explainer — edit freely. */}
                <Text style={styles.subtitle}>
                  Epocheye brings heritage places to life on your phone. We're
                  not in your area yet — tell us a place worth covering and we'll
                  look into bringing it to Epocheye.
                </Text>
              </Animated.View>

              <Animated.View
                entering={FadeInUp.delay(120).duration(450)}
                style={styles.card}>
                <View style={styles.cardTopRow}>
                  <MapPin size={15} color={COLORS.sky} />
                  <Text style={styles.cardLabel}>SUGGEST A PLACE</Text>
                </View>

                <Text style={styles.fieldLabel}>Place name</Text>
                <TextInput
                  value={placeName}
                  onChangeText={text => {
                    setPlaceName(text);
                    if (error) setError(null);
                  }}
                  placeholder="e.g. a fort, temple, or palace near you"
                  placeholderTextColor={COLORS.textTertiary}
                  style={styles.input}
                  returnKeyType="next"
                  editable={!submitting}
                />

                <Text style={styles.fieldLabel}>Details (optional)</Text>
                <TextInput
                  value={placeDetails}
                  onChangeText={setPlaceDetails}
                  placeholder="Anything that helps us find it — area, what makes it special…"
                  placeholderTextColor={COLORS.textTertiary}
                  style={[styles.input, styles.multiline]}
                  multiline
                  numberOfLines={4}
                  editable={!submitting}
                />

                {error ? <Text style={styles.errorText}>{error}</Text> : null}

                {isOffline ? (
                  <OfflineInline compact message={t('offline.suggestMessage')} />
                ) : null}

                <Pressable
                  onPress={handleSubmit}
                  disabled={submitting || isOffline}
                  style={[
                    styles.primaryBtn,
                    (submitting || isOffline) && styles.primaryBtnDisabled,
                  ]}>
                  {submitting ? (
                    <ActivityIndicator color={COLORS.bg} />
                  ) : (
                    <Text style={styles.primaryBtnText}>Submit suggestion</Text>
                  )}
                </Pressable>
              </Animated.View>

              <Pressable onPress={handleClose} style={styles.skipBtn}>
                <Text style={styles.skipText}>Maybe later</Text>
              </Pressable>
            </>
          )}
        </KeyboardAwareScrollView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: COLORS.bg},
  safe: {flex: 1},
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.sm,
  },
  brandRow: {flexDirection: 'row', alignItems: 'center', gap: SPACING.sm},
  brand: {
    fontFamily: FONTS.uiSemiBold,
    fontSize: FONT_SIZES.caption,
    letterSpacing: 2,
    color: COLORS.textSecondary,
  },
  closeBtn: {padding: SPACING.xs},
  scroll: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.section,
    paddingBottom: SPACING.section,
  },
  kicker: {
    fontFamily: FONTS.uiMedium,
    fontSize: FONT_SIZES.caption,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: COLORS.sky,
    marginBottom: SPACING.md,
  },
  title: {
    fontFamily: FONTS.display,
    fontSize: FONT_SIZES.hero,
    lineHeight: FONT_SIZES.hero * 1.15,
    color: COLORS.textPrimary,
  },
  subtitle: {
    fontFamily: FONTS.ui,
    fontSize: FONT_SIZES.body,
    lineHeight: FONT_SIZES.body * 1.5,
    color: COLORS.textSecondary,
    marginTop: SPACING.lg,
  },
  card: {
    marginTop: SPACING.section,
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.xl,
  },
  cardTopRow: {flexDirection: 'row', alignItems: 'center', gap: SPACING.sm},
  cardLabel: {
    fontFamily: FONTS.uiSemiBold,
    fontSize: FONT_SIZES.caption,
    letterSpacing: 1.5,
    color: COLORS.textTertiary,
  },
  venueName: {
    fontFamily: FONTS.display,
    fontSize: FONT_SIZES.heading,
    color: COLORS.textPrimary,
    marginTop: SPACING.md,
  },
  venueMeta: {
    fontFamily: FONTS.ui,
    fontSize: FONT_SIZES.body,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  fieldLabel: {
    fontFamily: FONTS.uiMedium,
    fontSize: FONT_SIZES.small,
    color: COLORS.textSecondary,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    color: COLORS.textPrimary,
    fontFamily: FONTS.ui,
    fontSize: FONT_SIZES.body,
    backgroundColor: COLORS.bg,
  },
  multiline: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  errorText: {
    fontFamily: FONTS.ui,
    fontSize: FONT_SIZES.small,
    color: COLORS.error,
    marginTop: SPACING.md,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.sky,
    borderRadius: RADIUS.pill,
    paddingVertical: SPACING.md,
    marginTop: SPACING.xl,
  },
  primaryBtnDisabled: {opacity: 0.6},
  primaryBtnText: {
    fontFamily: FONTS.uiSemiBold,
    fontSize: FONT_SIZES.button,
    color: COLORS.bg,
  },
  skipBtn: {alignItems: 'center', paddingVertical: SPACING.xl},
  skipText: {
    fontFamily: FONTS.ui,
    fontSize: FONT_SIZES.body,
    color: COLORS.textTertiary,
  },
});

export default SuggestSiteScreen;
