import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  Animated,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import AncestryCard from '../../components/onboarding/AncestryCard';
import AmberButton from '../../components/onboarding/AmberButton';
import { REGIONS, type Region } from '../../constants/onboarding/regions';
import { FONTS, COLORS, FONT_SIZES, SPACING } from '../../core/constants/theme';
import type { OnboardingScreenProps } from '../../core/types/navigation.types';
import { ROUTES } from '../../core/constants/routes';

type Props = OnboardingScreenProps<'AncestryInput'>;

/**
 * Screen 3 — Ancestry region selector.
 * Dark warm gradient background. Horizontally scrollable CDN-image region cards.
 * Selecting a region reveals the Continue CTA. Skip navigates with region: null.
 */
const AncestryInputScreen: React.FC<Props> = ({ navigation }) => {
  const [selectedRegion, setSelectedRegion] = useState<Region | null>(null);
  const ctaOpacity = React.useRef(new Animated.Value(0)).current;

  const handleSelect = (region: Region) => {
    if (!selectedRegion) {
      // First selection — animate CTA in
      Animated.timing(ctaOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
    setSelectedRegion(region);
  };

  const handleContinue = () => {
    navigation.navigate(ROUTES.ONBOARDING.FIRST_TASTE, {
      region: selectedRegion?.name ?? null,
    });
  };

  const handleSkip = () => {
    navigation.navigate(ROUTES.ONBOARDING.FIRST_TASTE, { region: null });
  };

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />

      <LinearGradient
        colors={['#1A1612', '#2A1A00', '#1A1612']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Skip link — top right, intentionally low contrast */}
      <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      <View style={styles.content}>
        <Text style={styles.header}>Where is your{'\n'}family from?</Text>
        <Text style={styles.subText}>This shapes the stories you'll find.</Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          style={styles.scrollView}
          decelerationRate="fast"
          snapToInterval={152}
          snapToAlignment="start"
        >
          {REGIONS.map(region => (
            <AncestryCard
              key={region.id}
              region={region}
              isSelected={selectedRegion?.id === region.id}
              onSelect={handleSelect}
            />
          ))}
        </ScrollView>

        <Animated.View style={[styles.ctaContainer, { opacity: ctaOpacity }]}>
          <AmberButton title="Continue" onPress={handleContinue} />
        </Animated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgWarm,
  },
  skipButton: {
    position: 'absolute',
    top: 56,
    right: SPACING.xxl,
    zIndex: 10,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  skipText: {
    fontFamily: FONTS.medium,
    fontSize: FONT_SIZES.small,
    color: COLORS.textMuted,
  },
  content: {
    flex: 1,
    paddingTop: 100,
  },
  header: {
    fontFamily: FONTS.bold,
    fontSize: FONT_SIZES.display,
    color: COLORS.textPrimary,
    paddingHorizontal: SPACING.xxl,
    marginBottom: SPACING.md,
    lineHeight: 48,
    letterSpacing: -0.5,
  },
  subText: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZES.body,
    color: COLORS.textSecondary,
    paddingHorizontal: SPACING.xxl,
    marginBottom: SPACING.xxxl,
  },
  scrollView: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingHorizontal: SPACING.xxl,
    paddingBottom: SPACING.sm,
    gap: 12,
  },
  ctaContainer: {
    paddingHorizontal: SPACING.xxl,
    marginTop: SPACING.xxxl,
    marginBottom: SPACING.xxxl,
  },
});

export default AncestryInputScreen;
