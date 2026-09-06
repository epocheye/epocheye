import React, {useState} from 'react';
import {
  ActivityIndicator,
  Modal,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {FadeIn, FadeInUp} from 'react-native-reanimated';
import {Check, ScanSearch, Sparkles, X} from 'lucide-react-native';
import {FONTS} from '../../../core/constants/theme';
import {useExplorerPassPurchase} from '../../../shared/hooks/useExplorerPassPurchase';

interface SitePaywallSheetProps {
  visible: boolean;
  /** Place/site id to unlock (Explorer Pass single-place buy). */
  siteId: string;
  /** Friendly site name for the headline. */
  siteName?: string;
  /** The free allowance (drives the "you've used N free scans" line). */
  limit?: number;
  /**
   * Overrides the "you've used N free scans" sentence.
   *
   * The sheet sells ONE pass but is reached from more than one wall: scans run
   * out at the lens, and the audio guide locks after its free preview. Naming
   * scans to someone who was listening would describe a limit they never hit.
   */
  reasonLine?: string;
  /** Region-appropriate display price, e.g. "₹149". Server still decides the charge. */
  priceLabel?: string;
  onClose: () => void;
  /** Fired after a verified purchase so the caller can refresh access + retry. */
  onUnlocked?: () => void;
}

const VALUE_PROPS: ReadonlyArray<string> = [
  'Unlimited scans at this site',
  'Full AR reconstruction in 3D',
  'The in-depth heritage guide',
  'HD detail on every artifact',
];

/**
 * Conversion-focused paywall shown when a visitor's free scans at a site run out.
 * Sells the moment: what they've experienced, what unlocking adds, the region
 * price, and a single clear CTA into the existing Explorer Pass purchase flow.
 *
 * The price shown is display-only; the backend computes and locks the real charge
 * (region-aware) at /initiate and re-verifies it at /confirm.
 */
export const SitePaywallSheet: React.FC<SitePaywallSheetProps> = ({
  visible,
  siteId,
  siteName,
  limit,
  reasonLine,
  priceLabel,
  onClose,
  onUnlocked,
}) => {
  const {purchasing, purchase} = useExplorerPassPurchase();
  const [error, setError] = useState<string | null>(null);

  const place =
    siteName && siteName.trim().length > 0 ? siteName.trim() : 'this site';
  const usedLine =
    reasonLine && reasonLine.trim().length > 0
      ? reasonLine.trim()
      : typeof limit === 'number' && limit > 0
      ? `You've used your ${limit} free ${
          limit === 1 ? 'scan' : 'scans'
        } at ${place}.`
      : `You've used your free scans at ${place}.`;

  const handleUnlock = async () => {
    if (purchasing || !siteId) {
      return;
    }
    setError(null);
    const ok = await purchase([siteId]);
    if (ok) {
      onUnlocked?.();
      onClose();
    } else {
      setError('Purchase didn’t complete. You can try again anytime.');
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}>
      <Animated.View
        entering={FadeIn.duration(180)}
        className="flex-1 bg-black/80 justify-end">
        <Animated.View
          entering={FadeInUp.duration(260)}
          className="bg-[#121212] rounded-tl-[28px] rounded-tr-[28px] border-t border-accent-amber/30 px-6 pt-6 pb-9">
          <TouchableOpacity
            className="absolute right-4 top-4 h-9 w-9 items-center justify-center rounded-full bg-white/5"
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close">
            <X size={18} color="#9A9A9A" />
          </TouchableOpacity>

          <View className="items-center mb-3">
            <View className="h-14 w-14 rounded-full bg-accent-amber/15 items-center justify-center border border-accent-amber/40">
              <Sparkles size={26} color="#CBA862" />
            </View>
          </View>

          <Text
            className="text-parchment text-[20px] text-center"
            style={{fontFamily: FONTS.bold}}>
            Unlock {place}
          </Text>
          <Text
            className="mt-1.5 text-grey-muted text-[13.5px] text-center"
            style={{fontFamily: FONTS.regular}}>
            {usedLine} Keep exploring with full access.
          </Text>

          <View className="mt-5 gap-y-3">
            {VALUE_PROPS.map(label => (
              <View key={label} className="flex-row items-center gap-x-3">
                <View className="h-6 w-6 rounded-full bg-accent-amber/20 items-center justify-center">
                  <Check size={14} color="#CBA862" />
                </View>
                <Text
                  className="text-parchment text-[14px] flex-1"
                  style={{fontFamily: FONTS.medium}}>
                  {label}
                </Text>
              </View>
            ))}
          </View>

          {priceLabel ? (
            <View className="mt-6 items-center">
              <Text
                className="text-parchment text-[34px]"
                style={{fontFamily: FONTS.bold}}>
                {priceLabel}
              </Text>
              <Text
                className="text-grey-muted text-[12px]"
                style={{fontFamily: FONTS.regular}}>
                one-time, for access at this site
              </Text>
            </View>
          ) : null}

          {error ? (
            <Text
              className="mt-4 text-[12.5px] text-center"
              style={{fontFamily: FONTS.regular, color: '#E59A9A'}}>
              {error}
            </Text>
          ) : null}

          <TouchableOpacity
            className="mt-6 rounded-2xl bg-accent-amber flex-row items-center justify-center gap-x-2"
            style={{height: 52}}
            onPress={handleUnlock}
            disabled={purchasing}
            accessibilityRole="button"
            accessibilityLabel={`Unlock ${place}`}>
            {purchasing ? (
              <ActivityIndicator color="#0D0D0D" size="small" />
            ) : (
              <>
                <ScanSearch size={18} color="#0D0D0D" />
                <Text
                  className="text-[#0D0D0D] text-[15px]"
                  style={{fontFamily: FONTS.bold}}>
                  {priceLabel ? `Unlock · ${priceLabel}` : `Unlock ${place}`}
                </Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            className="mt-2 h-11 items-center justify-center"
            onPress={onClose}>
            <Text
              className="text-grey-muted text-[13px]"
              style={{fontFamily: FONTS.regular}}>
              Maybe later
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

export default SitePaywallSheet;
