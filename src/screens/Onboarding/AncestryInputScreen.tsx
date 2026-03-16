import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import AncestryCard from '../../components/onboarding/AncestryCard';
import AmberButton from '../../components/onboarding/AmberButton';
import { REGIONS, type Region } from '../../constants/onboarding/regions';
import type { OnboardingScreenProps } from '../../core/types/navigation.types';
import { ROUTES } from '../../core/constants/routes';

type Props = OnboardingScreenProps<'AncestryInput'>;

/**
 * Screen 4 — Ancestry region selector.
 * Top half: dark background. Bottom half: warm amber gradient.
 * Horizontal scrollable region cards with Skip option.
 */
const AncestryInputScreen: React.FC<Props> = ({ navigation }) => {
  const [selectedRegion, setSelectedRegion] = useState<Region | null>(null);

  const handleSelect = (region: Region) => {
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
        <Text style={styles.header}>Where is your family from?</Text>
        <Text style={styles.subText}>This shapes the stories you'll find.</Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          style={styles.scrollView}
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

        {selectedRegion && (
          <View style={styles.ctaContainer}>
            <AmberButton title="Continue" onPress={handleContinue} />
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1612',
  },
  skipButton: {
    position: 'absolute',
    top: 56,
    right: 24,
    zIndex: 10,
  },
  skipText: {
    fontFamily: 'DMSans-Regular',
    fontSize: 13,
    color: 'rgba(255,255,255,0.3)',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingTop: 80,
  },
  header: {
    fontFamily: 'CormorantGaramond-SemiBold',
    fontSize: 42,
    color: '#FFFFFF',
    paddingHorizontal: 24,
    marginBottom: 12,
  },
  subText: {
    fontFamily: 'DMSans-Regular',
    fontSize: 15,
    color: 'rgba(255,255,255,0.6)',
    paddingHorizontal: 24,
    marginBottom: 40,
  },
  scrollView: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  ctaContainer: {
    paddingHorizontal: 24,
    marginTop: 40,
    marginBottom: 40,
  },
});

export default AncestryInputScreen;
