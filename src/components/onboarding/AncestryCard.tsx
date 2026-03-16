import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import type { Region } from '../../constants/onboarding/regions';

interface AncestryCardProps {
  region: Region;
  isSelected: boolean;
  onSelect: (region: Region) => void;
}

/**
 * Region selector card for the AncestryInput screen.
 * 120x150, rounded 16px. Shows region abbreviation and name.
 * Selected state: amber border + glow shadow.
 */
const AncestryCard: React.FC<AncestryCardProps> = ({
  region,
  isSelected,
  onSelect,
}) => {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => onSelect(region)}
      style={[styles.card, isSelected && styles.cardSelected]}
    >
      <View style={[styles.iconArea, { backgroundColor: region.color }]}>
        <Text style={styles.abbreviation}>{region.abbreviation}</Text>
      </View>
      <Text style={styles.name} numberOfLines={2}>
        {region.name}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    width: 120,
    height: 150,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginRight: 12,
    overflow: 'hidden',
  },
  cardSelected: {
    borderColor: '#D4860A',
    borderWidth: 2,
    shadowColor: '#D4860A',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  iconArea: {
    height: 90,
    alignItems: 'center',
    justifyContent: 'center',
  },
  abbreviation: {
    fontFamily: 'DMSans-Medium',
    fontSize: 28,
    color: '#FFFFFF',
    opacity: 0.9,
  },
  name: {
    fontFamily: 'DMSans-Regular',
    fontSize: 13,
    color: '#FFFFFF',
    textAlign: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
});

export default AncestryCard;
