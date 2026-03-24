import React, { useState } from 'react';
import {
  View,
  Text,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  Animated,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import AncestryCard from '../../components/onboarding/AncestryCard';
import AmberButton from '../../components/onboarding/AmberButton';
import { REGIONS, type Region } from '../../constants/onboarding/regions';
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
    <View className="flex-1 bg-[#1A1612]">
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />

      <LinearGradient
        colors={['#1A1612', '#2A1A00', '#1A1612']}
        locations={[0, 0.5, 1]}
        className="absolute inset-0"
      />

      {/* Skip link — top right, intentionally low contrast */}
      <TouchableOpacity
        className="absolute right-8 top-14 z-10 px-1 py-2"
        onPress={handleSkip}
      >
        <Text className="font-['MontserratAlternates-Medium'] text-sm text-[#6B6357]">
          Skip
        </Text>
      </TouchableOpacity>

      <View className="flex-1 pt-[100px]">
        <Text className="mb-3 px-8 font-['MontserratAlternates-Bold'] text-[44px] leading-[48px] tracking-[-0.5px] text-[#F5E9D8]">
          Where is your{''}family from?
        </Text>
        <Text className="mb-10 px-8 font-['MontserratAlternates-Regular'] text-[15px] text-[#B8AF9E]">
          This shapes the stories you'll find.
        </Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 32,
            paddingBottom: 8,
            gap: 12,
          }}
          className="grow-0"
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

        <Animated.View
          className="mb-10 mt-10 px-8"
          style={{ opacity: ctaOpacity }}
        >
          <AmberButton title="Continue" onPress={handleContinue} />
        </Animated.View>
      </View>
    </View>
  );
};

export default AncestryInputScreen;
