import React from 'react';
import { Text, View } from 'react-native';
import { Box } from 'lucide-react-native';
import { useArQuotaStore } from '../stores/arQuotaStore';
import { FONTS } from '../core/constants/theme';

interface Props {
  compact?: boolean;
}

const ARQuotaPill: React.FC<Props> = ({ compact = false }) => {
  const { userTier, todayRemaining, freeDailyQuota, premiumDailyQuota, enabled, maintenanceMode } =
    useArQuotaStore();

  const isDisabled = !enabled || maintenanceMode;
  const colorClass = isDisabled
    ? 'bg-[rgba(140,147,160,0.08)] border-[rgba(140,147,160,0.3)]'
    : 'bg-[rgba(232,160,32,0.12)] border-[rgba(232,160,32,0.35)]';
  const paddingClass = compact ? 'px-2 py-[3px]' : 'px-[10px] py-[5px]';

  if (isDisabled) {
    return (
      <View className={`flex-row items-center gap-x-[6px] rounded-full border ${paddingClass} ${colorClass}`}>
        <Box size={12} color="#8C93A0" />
        <Text style={{fontSize: 11, color: '#8C93A0', fontFamily: FONTS.medium}}>AR unavailable</Text>
      </View>
    );
  }

  const limit = userTier === 'premium' ? premiumDailyQuota : freeDailyQuota;
  const label =
    userTier === 'premium'
      ? `Premium · ${todayRemaining}/${limit}`
      : `${todayRemaining}/${limit} today`;

  return (
    <View className={`flex-row items-center gap-x-[6px] rounded-full border ${paddingClass} ${colorClass}`}>
      <Box size={12} color="#E8A020" />
      <Text style={{fontSize: 11, color: '#E8A020', fontFamily: FONTS.semiBold, letterSpacing: 0.3}}>{label}</Text>
    </View>
  );
};

export default ARQuotaPill;
