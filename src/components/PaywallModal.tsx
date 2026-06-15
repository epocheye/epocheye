import React from 'react';
import {Modal, Text, TouchableOpacity, View} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {Crown, X} from 'lucide-react-native';
import {COLORS, FONTS, GOLD_GRADIENT} from '../core/constants/theme';

export interface PaywallModalProps {
  visible: boolean;
  title?: string;
  message?: string;
  onClose: () => void;
  onUpgrade: () => void;
}

const PaywallModal: React.FC<PaywallModalProps> = ({
  visible,
  title = 'Unlock with Passport',
  message = 'Get your Passport to unlock this feature and access heritage sites near you.',
  onClose,
  onUpgrade,
}) => {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center px-6 bg-[rgba(10,10,12,0.85)]">
        <View className="w-full bg-surface-2 rounded-[28px] border border-white/10 p-6">
          <View className="flex-row items-start justify-between mb-5">
            <LinearGradient
              colors={GOLD_GRADIENT}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 1}}
              style={{
                width: 52,
                height: 52,
                borderRadius: 18,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Crown color={COLORS.bg} size={24} fill={COLORS.bg} />
            </LinearGradient>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
              accessibilityRole="button"
              accessibilityLabel="Close">
              <X color={COLORS.textTertiary} size={20} />
            </TouchableOpacity>
          </View>

          <Text
            className="text-parchment text-[30px] leading-[34px]"
            style={{fontFamily: FONTS.display}}>
            {title}
          </Text>
          <Text
            className="text-parchment-muted text-sm mt-2.5 leading-[21px]"
            style={{fontFamily: FONTS.ui}}>
            {message}
          </Text>

          <TouchableOpacity onPress={onUpgrade} accessibilityRole="button" className="mt-6">
            <LinearGradient
              colors={GOLD_GRADIENT}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 0}}
              style={{
                paddingVertical: 16,
                borderRadius: 16,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                gap: 8,
              }}>
              <Crown color={COLORS.bg} size={18} fill={COLORS.bg} />
              <Text
                className="text-base"
                style={{fontFamily: FONTS.uiMedium, color: COLORS.bg}}>
                Get Passport
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onClose}
            className="mt-2 py-3 items-center justify-center"
            accessibilityRole="button">
            <Text
              className="text-parchment-dim text-sm"
              style={{fontFamily: FONTS.ui}}>
              Maybe later
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default PaywallModal;
