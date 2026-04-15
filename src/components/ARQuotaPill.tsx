import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Box } from 'lucide-react-native';
import { useArQuotaStore } from '../stores/arQuotaStore';
import { FONTS } from '../core/constants/theme';

interface Props {
  compact?: boolean;
}

const ARQuotaPill: React.FC<Props> = ({ compact = false }) => {
  const { userTier, todayRemaining, freeDailyQuota, premiumDailyQuota, enabled, maintenanceMode } =
    useArQuotaStore();

  if (!enabled || maintenanceMode) {
    return (
      <View style={[styles.pill, styles.disabled, compact && styles.compact]}>
        <Box size={12} color="#8C93A0" />
        <Text style={styles.textDim}>AR unavailable</Text>
      </View>
    );
  }

  const limit = userTier === 'premium' ? premiumDailyQuota : freeDailyQuota;
  const label =
    userTier === 'premium'
      ? `Premium · ${todayRemaining}/${limit}`
      : `${todayRemaining}/${limit} today`;

  return (
    <View style={[styles.pill, compact && styles.compact]}>
      <Box size={12} color="#E8A020" />
      <Text style={styles.text}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(232,160,32,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(232,160,32,0.35)',
  },
  compact: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  disabled: {
    backgroundColor: 'rgba(140,147,160,0.08)',
    borderColor: 'rgba(140,147,160,0.3)',
  },
  text: {
    fontSize: 11,
    color: '#E8A020',
    fontFamily: FONTS.semiBold,
    letterSpacing: 0.3,
  },
  textDim: {
    fontSize: 11,
    color: '#8C93A0',
    fontFamily: FONTS.medium,
  },
});

export default ARQuotaPill;
