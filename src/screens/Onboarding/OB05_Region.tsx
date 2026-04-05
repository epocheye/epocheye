import React from 'react';
import { View, Text, StyleSheet, StatusBar, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Mountain,
  Sun,
  Flower2,
  Castle,
  TreePine,
  Star,
  Palmtree,
} from 'lucide-react-native';
import { OB_COLORS, OB_TYPOGRAPHY } from '../../constants/onboarding';
import { FONTS } from '../../core/constants/theme';
import { useOnboardingStore } from '../../stores/onboardingStore';
import OBProgressBar from '../../components/onboarding/OBProgressBar';
import OBPrimaryButton from '../../components/onboarding/OBPrimaryButton';
import OBSelectionTile from '../../components/onboarding/OBSelectionTile';
import OnboardingResolvedVisual from '../../components/onboarding/OnboardingResolvedVisual';
import { track } from '../../services/analytics';
import type { OnboardingScreenProps } from '../../core/types/navigation.types';

type Props = OnboardingScreenProps<'OB05_Region'>;

const SCREEN_WIDTH = Dimensions.get('window').width;
const TILE_WIDTH = (SCREEN_WIDTH - 48 - 10) / 2;

const REGIONS = [
  { label: 'South Asia', Icon: Mountain },
  { label: 'Africa', Icon: Sun },
  { label: 'East Asia & Pacific', Icon: Flower2 },
  { label: 'Europe', Icon: Castle },
  { label: 'Americas', Icon: TreePine },
  { label: 'Middle East & Central Asia', Icon: Star },
  { label: 'Southeast Asia', Icon: Palmtree },
] as const;

const OB05_Region: React.FC<Props> = ({ navigation }) => {
  const regions = useOnboardingStore(s => s.regions);
  const toggleRegion = useOnboardingStore(s => s.toggleRegion);
  const insets = useSafeAreaInsets();
  const subject =
    regions.length > 0
      ? `${regions.slice(0, 2).join(' and ')} heritage monuments`
      : 'World heritage regions and monuments';

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />
      <OBProgressBar current={4} total={10} />

      <View style={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.header}>
          <Text style={[OB_TYPOGRAPHY.heading, styles.heading]}>
            Where does your lineage come from?
          </Text>
          <Text style={OB_TYPOGRAPHY.sub}>Select all that apply.</Text>
        </View>

        <View style={styles.visualWrap}>
          <OnboardingResolvedVisual
            subject={subject}
            context="onboarding lineage region selection"
            height={160}
          />
        </View>

        <View style={styles.tilesWrap}>
          {REGIONS.map(r => {
            const selected = regions.includes(r.label);
            return (
              <View key={r.label} style={{ width: TILE_WIDTH }}>
                <OBSelectionTile
                  icon={
                    <r.Icon
                      size={24}
                      color={selected ? '#E8A020' : '#8C93A0'}
                    />
                  }
                  label={r.label}
                  selected={selected}
                  onPress={() => toggleRegion(r.label)}
                  layout="grid"
                />
              </View>
            );
          })}
        </View>

        {regions.length > 0 && (
          <Text style={styles.preview}>
            We'll find ancestors from {regions.join(', ')} at every monument.
          </Text>
        )}

        <View style={styles.ctaWrap}>
          <OBPrimaryButton
            label="This is my heritage →"
            disabled={regions.length === 0}
            onPress={() => {
              track('onboarding_region_set', { regions });
              navigation.navigate('OB06_Name');
            }}
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: OB_COLORS.bg,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
  },
  header: {
    paddingHorizontal: 24,
    marginTop: 40,
  },
  heading: {
    marginBottom: 8,
  },
  tilesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 24,
  },
  visualWrap: {
    paddingHorizontal: 24,
    marginTop: 8,
  },
  preview: {
    color: '#8C93A0',
    fontSize: 13,
    fontStyle: 'italic',
    marginTop: 12,
    marginHorizontal: 24,
    fontFamily: FONTS.italic,
  },
  ctaWrap: {
    marginTop: 24,
  },
});

export default OB05_Region;
