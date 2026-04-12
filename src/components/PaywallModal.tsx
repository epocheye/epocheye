import React from 'react';
import { Modal, Text, TouchableOpacity, View } from 'react-native';
import { Sparkles, X } from 'lucide-react-native';

export interface PaywallModalProps {
  visible: boolean;
  title?: string;
  message?: string;
  onClose: () => void;
  onUpgrade: () => void;
}

const PaywallModal: React.FC<PaywallModalProps> = ({
  visible,
  title = 'Unlock with Explorer Pass',
  message = 'Get your Explorer Pass to unlock this feature and access heritage sites near you.',
  onClose,
  onUpgrade,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/70 items-center justify-center px-6">
        <View className="w-full bg-[#141414] rounded-3xl border border-[rgba(212,134,10,0.25)] p-6">
          <View className="flex-row items-start justify-between mb-4">
            <View className="w-12 h-12 rounded-full bg-[#D4860A]/15 items-center justify-center">
              <Sparkles color="#D4860A" size={22} />
            </View>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <X color="#6B6357" size={20} />
            </TouchableOpacity>
          </View>

          <Text className="text-[#F5F0E8] text-xl font-['MontserratAlternates-Bold'] leading-7">
            {title}
          </Text>
          <Text className="text-[#B8AF9E] text-sm mt-2 font-['MontserratAlternates-Regular'] leading-5">
            {message}
          </Text>

          <TouchableOpacity
            onPress={onUpgrade}
            className="mt-6 py-4 rounded-2xl items-center justify-center flex-row gap-2 bg-[#D4860A]"
            accessibilityRole="button"
          >
            <Sparkles color="#0A0A0A" size={18} />
            <Text className="text-[#0A0A0A] text-base font-['MontserratAlternates-Bold']">
              Get Explorer Pass
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onClose}
            className="mt-2 py-3 items-center justify-center"
            accessibilityRole="button"
          >
            <Text className="text-[#6B6357] text-sm font-['MontserratAlternates-Medium']">
              Maybe later
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default PaywallModal;
