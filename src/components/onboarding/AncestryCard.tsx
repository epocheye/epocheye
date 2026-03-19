import React, { useState } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  View,
  Image,
  ActivityIndicator,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { FONTS, COLORS, RADIUS, FONT_SIZES } from '../../core/constants/theme';
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
      style={[styles.card, isSelected && styles.cardSelected]}
    >
      {/* CDN Image background */}
      {region.imageUrl && !imageError ? (
        <View style={styles.imageContainer}>
          {!imageLoaded && (
            <View style={[styles.placeholder, { backgroundColor: region.color }]}>
              <ActivityIndicator size="small" color={COLORS.textPrimary} />
            </View>
          )}
          <Image
            source={{ uri: region.imageUrl }}
            style={styles.image}
            resizeMode="cover"
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.8)']}
            locations={[0.3, 1]}
            style={styles.imageGradient}
          />
        </View>
      ) : (
        <View style={[styles.placeholder, { backgroundColor: region.color }]}>
          <Text style={styles.abbreviation}>{region.abbreviation}</Text>
        </View>
      )}

      {/* Region name at the bottom */}
      <View style={styles.nameContainer}>
        <Text style={styles.name} numberOfLines={1}>
          {region.name}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    width: 140,
    height: 180,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  cardSelected: {
    borderColor: COLORS.amber,
    borderWidth: 2,
    shadowColor: COLORS.amber,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  imageContainer: {
    flex: 1,
  },
  image: {
    ...StyleSheet.absoluteFillObject,
  },
  imageGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  abbreviation: {
    fontFamily: FONTS.bold,
    fontSize: 28,
    color: COLORS.textPrimary,
    opacity: 0.85,
  },
  nameContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  name: {
    fontFamily: FONTS.semiBold,
    fontSize: FONT_SIZES.small,
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
});

export default AncestryCard;
