/**
 * ShareExperienceModal
 *
 * A heritage-styled prompt that invites the user to share a discovery. On confirm
 * it mints a deep-linkable link via the backend (POST /api/v1/share) and opens the
 * OS share sheet (RN built-in `Share` — no extra dependency).
 *
 * Used two ways:
 *   - Auto-prompt after an AR/scan experience (throttled by the caller).
 *   - Manual Share button (e.g. SiteDetailScreen) — opens it directly.
 */

import React, {useCallback, useState} from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  Share,
  Text,
  View,
} from 'react-native';
import {Share2, X} from 'lucide-react-native';
import {createShareLink} from '../utils/api/share';
import {analytics} from '../services/analytics';

export interface ShareExperienceModalProps {
  visible: boolean;
  onClose: () => void;
  /** Monument slug the link should deep-link into. */
  siteSlug: string;
  /** Headline used for the preview + share message. */
  title?: string;
  /** Optional scanned-object context. */
  objectClassId?: string;
  /** Optional preview image (OG). */
  imageUrl?: string;
}

const ShareExperienceModal: React.FC<ShareExperienceModalProps> = ({
  visible,
  onClose,
  siteSlug,
  title,
  objectClassId,
  imageUrl,
}) => {
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleShare = useCallback(async () => {
    setSharing(true);
    setError(null);
    const result = await createShareLink({
      siteSlug,
      objectClassId,
      title,
      imageUrl,
    });
    setSharing(false);

    if (!result.success) {
      setError('Could not create a link just now. Try again.');
      return;
    }

    analytics.track('share_created', {site: siteSlug, object: objectClassId});

    try {
      const headline = title ? `${title} — on Epocheye` : 'My discovery on Epocheye';
      await Share.share({
        message: `${headline}\n${result.data.url}`,
        url: result.data.url,
        title: headline,
      });
      onClose();
    } catch {
      // User dismissed the share sheet — not an error.
      onClose();
    }
  }, [siteSlug, objectClassId, title, imageUrl, onClose]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent>
      <View className="flex-1 bg-black/70 justify-end">
        <Pressable
          className="flex-1"
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Dismiss share prompt"
        />

        <View className="bg-[#141414] rounded-t-3xl border-t border-l border-r border-[rgba(255,255,255,0.06)] px-6 pt-4 pb-8">
          <View className="items-center pb-3">
            <View className="w-10 h-1 rounded-full bg-[rgba(255,255,255,0.15)]" />
          </View>

          <View className="flex-row items-start">
            <View className="w-11 h-11 rounded-full bg-[rgba(203,168,98,0.15)] items-center justify-center mr-3">
              <Share2 size={20} color="#CBA862" />
            </View>
            <View className="flex-1">
              <Text className="text-parchment font-ui-semibold text-[18px]">
                Share this discovery
              </Text>
              <Text className="text-[#B8B0A0] font-ui text-[14px] leading-5 mt-1">
                Send a link that opens Epocheye right at this place — perfect for
                friends who'd love to walk where they walked.
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              className="p-[6px]"
              accessibilityRole="button"
              accessibilityLabel="Close">
              <X size={20} color="#8C8578" />
            </Pressable>
          </View>

          {error ? (
            <Text className="text-[#FF6B6B] font-ui text-[13px] mt-3">
              {error}
            </Text>
          ) : null}

          <Pressable
            onPress={handleShare}
            disabled={sharing}
            className={`mt-5 flex-row items-center justify-center gap-2 rounded-full bg-accent-amber py-[14px]${
              sharing ? ' opacity-70' : ''
            }`}
            accessibilityRole="button"
            accessibilityLabel="Create and share link">
            {sharing ? (
              <ActivityIndicator color="#1A0F00" />
            ) : (
              <>
                <Share2 size={18} color="#1A0F00" />
                <Text className="text-[#1A0F00] font-ui-semibold text-[15px]">
                  Share
                </Text>
              </>
            )}
          </Pressable>

          <Pressable
            onPress={onClose}
            className="mt-2 py-3 items-center"
            accessibilityRole="button"
            accessibilityLabel="Maybe later">
            <Text className="text-[#8C8578] font-ui text-[13px]">
              Maybe later
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

export default ShareExperienceModal;
