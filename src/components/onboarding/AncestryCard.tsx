import React, { useState } from 'react';
import { TouchableOpacity, Text, View, Image } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import AnimatedLogo from '../ui/AnimatedLogo';
import type { Region } from '../../constants/onboarding/regions';

interface AncestryCardProps {
  region: Region;
  isSelected: boolean;
  onSelect: (region: Region) => void;
}

/**
 * Region selector card for the AncestryInput screen.
 * Shows a CDN-loaded image with gradient overlay and region name.
 * Selected state: amber border + glow shadow.
 */
const AncestryCard: React.FC<AncestryCardProps> = ({
  region,
  isSelected,
  onSelect,
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => onSelect(region)}
      className="h-[180px] w-[140px] overflow-hidden rounded-xl border border-[rgba(255,255,255,0.24)] bg-[#241D16]"
      style={
        isSelected
          ? {
              borderColor: '#D4860A',
              borderWidth: 2,
              shadowColor: '#D4860A',
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.4,
              shadowRadius: 12,
              elevation: 8,
            }
          : undefined
      }
    >
      {/* CDN Image background */}
      {region.imageUrl && !imageError ? (
        <View className="flex-1">
          {!imageLoaded && (
            <View
              className="absolute inset-0 items-center justify-center"
              style={{ backgroundColor: region.color }}
            >
              <AnimatedLogo
                size={18}
                variant="white"
                motion="pulse"
                showRing={false}
              />
            </View>
          )}
          <Image
            source={{ uri: region.imageUrl }}
            className="absolute inset-0"
            resizeMode="cover"
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.8)']}
            locations={[0.3, 1]}
            className="absolute inset-0"
          />
        </View>
      ) : (
        <View
          className="absolute inset-0 items-center justify-center"
          style={{ backgroundColor: region.color }}
        >
          <Text className="font-['MontserratAlternates-Bold'] text-[28px] text-[#F5E9D8]/85">
            {region.abbreviation}
          </Text>
        </View>
      )}

      {/* Region name at the bottom */}
      <View className="absolute bottom-0 left-0 right-0 px-2.5 py-2.5">
        <Text
          className="text-center font-['MontserratAlternates-SemiBold'] text-sm text-[#F5E9D8]"
          numberOfLines={1}
        >
          {region.name}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

export default AncestryCard;
