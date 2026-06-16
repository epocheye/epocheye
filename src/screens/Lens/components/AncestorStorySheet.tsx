import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Animated,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import BottomSheet, {BottomSheetScrollView} from '@gorhom/bottom-sheet';
import {Landmark, Lock} from 'lucide-react-native';
import {FONTS} from '../../../core/constants/theme';
import ResolvedSubjectImage from '../../../components/ui/ResolvedSubjectImage';
import {getOnboardingVisualFallback} from '../../../components/onboarding/visual-fallbacks';

interface IdentifiedObject {
  name: string;
  era: string;
  objectType: string;
}

export interface AncestorStorySheetRef {
  open: () => void;
  close: () => void;
  expand: () => void;
}

interface AncestorStorySheetProps {
  monumentName: string;
  firstName: string;
  storyText: string;
  isStreaming: boolean;
  isLoading: boolean;
  mode?: 'monument' | 'object_scan';
  identifiedObject?: IdentifiedObject | null;
  onArTeaserSeen?: () => void;
}

const AncestorStorySheet = forwardRef<
  AncestorStorySheetRef,
  AncestorStorySheetProps
>(
  (
    {
      monumentName,
      firstName,
      storyText,
      isStreaming,
      isLoading,
      mode = 'monument',
      identifiedObject,
      onArTeaserSeen,
    },
    ref,
  ) => {
    const sheetRef = useRef<BottomSheet>(null);
    const hasTrackedTeaser = useRef(false);
    const [cursorVisible, setCursorVisible] = useState(true);
    const [showLineage, setShowLineage] = useState(false);
    const chipOpacity = useRef(new Animated.Value(0)).current;

    const snapPoints = useMemo(() => ['60%', '95%'], []);
    const showObjectChip =
      mode === 'object_scan' &&
      typeof identifiedObject?.name === 'string' &&
      identifiedObject.name.length > 0 &&
      typeof identifiedObject?.era === 'string' &&
      identifiedObject.era.length > 0;

    useImperativeHandle(ref, () => ({
      open: () => {
        sheetRef.current?.snapToIndex(0);
      },
      close: () => {
        sheetRef.current?.close();
      },
      expand: () => {
        sheetRef.current?.snapToIndex(1);
      },
    }));

    useEffect(() => {
      if (!isStreaming) {
        setCursorVisible(false);
        return;
      }

      const timer = setInterval(() => {
        setCursorVisible(v => !v);
      }, 500);

      return () => {
        clearInterval(timer);
      };
    }, [isStreaming]);

    useEffect(() => {
      if (!isStreaming && storyText.length > 0) {
        const timer = setTimeout(() => {
          setShowLineage(true);
        }, 1200);
        return () => clearTimeout(timer);
      }

      setShowLineage(false);
      return;
    }, [isStreaming, storyText.length]);

    useEffect(() => {
      if (!showObjectChip) {
        chipOpacity.setValue(0);
        return;
      }

      chipOpacity.setValue(0);
      Animated.timing(chipOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }, [
      chipOpacity,
      showObjectChip,
      identifiedObject?.name,
      identifiedObject?.era,
    ]);

    const handleSheetChange = useCallback(
      (index: number) => {
        if (index >= 0 && !hasTrackedTeaser.current) {
          hasTrackedTeaser.current = true;
          onArTeaserSeen?.();
        }

        if (index < 0) {
          hasTrackedTeaser.current = false;
        }
      },
      [onArTeaserSeen],
    );

    return (
      <BottomSheet
        ref={sheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        onChange={handleSheetChange}
        backgroundStyle={styles.sheetBackground}
        handleIndicatorStyle={styles.handle}>
        <BottomSheetScrollView
          contentContainerStyle={{paddingHorizontal: 20, paddingBottom: 24}}
          showsVerticalScrollIndicator={false}>
          <Text className="mb-3 text-grey-muted text-[11px] tracking-[2px] uppercase font-ui-medium">
            YOUR ANCESTOR AT {monumentName.toUpperCase()}
          </Text>

          <ResolvedSubjectImage
            subject={monumentName}
            context="lens ancestor story sheet"
            fallbackUri={getOnboardingVisualFallback(
              monumentName,
              'lens ancestor story sheet',
            )}
            enableRemoteResolve
            style={{
              width: '100%',
              height: 132,
              borderRadius: 12,
              marginBottom: 12,
              backgroundColor: '#1A1A1A',
            }}
            imageStyle={{borderRadius: 12}}
            loadingLabel="Loading monument visual..."
          />

          {showObjectChip && identifiedObject ? (
            <Animated.View
              className="self-start flex-row items-center bg-grey-subtle rounded-[20px] px-[10px] py-[4px] mb-[10px] gap-x-[6px]"
              style={{opacity: chipOpacity}}>
              <Landmark size={14} color="#CBA862" />
              <Text className="text-grey-muted text-[12px] font-ui-medium">
                {identifiedObject.name} · {identifiedObject.era}
              </Text>
            </Animated.View>
          ) : null}

          {isLoading && storyText.length === 0 ? (
            <View className="mt-1 gap-[10px]">
              <ActivityIndicator color="#CBA862" size="small" />
              <Text className="text-grey-muted text-[13px] font-ui">
                Crafting your ancestor's story...
              </Text>
              <View className="h-[13px] rounded-[6px] bg-grey-border w-full" />
              <View className="h-[13px] rounded-[6px] bg-grey-border w-[76%]" />
              <View className="h-[13px] rounded-[6px] bg-grey-border w-full" />
            </View>
          ) : (
            <Text
              className="text-parchment text-[15px] leading-[26px]"
              style={{
                fontFamily: Platform.select({
                  ios: 'Georgia',
                  android: 'serif',
                  default: 'serif',
                }),
              }}>
              {storyText}
              {isStreaming && cursorVisible ? '|' : ''}
            </Text>
          )}

          {showLineage ? (
            <Text
              className="mt-[18px] text-grey-muted text-[14px]"
              style={{fontFamily: FONTS.italic, fontStyle: 'italic'}}>
              {firstName}, this ancestor shares your lineage.
            </Text>
          ) : null}

          <View className="mt-[22px] rounded-xl border border-grey-border bg-grey-subtle p-4" style={{borderStyle: 'dashed'}}>
            <View className="flex-row items-center">
              <Lock size={16} color="#8C93A0" />
              <Text className="ml-2 text-grey-muted text-[13px] font-ui-semibold">
                AR Timeline · Coming Soon
              </Text>
            </View>
            <Text className="mt-1 text-[#666666] text-[12px] leading-[18px] font-ui">
              Walk through centuries of this monument in augmented reality.
            </Text>
          </View>
        </BottomSheetScrollView>
      </BottomSheet>
    );
  },
);

// BottomSheet-specific styling must remain in StyleSheet — library reads these as plain objects
const styles = StyleSheet.create({
  sheetBackground: {
    backgroundColor: '#0D0D0D',
  },
  handle: {
    width: 32,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#2A2A2A',
  },
});

AncestorStorySheet.displayName = 'AncestorStorySheet';

export default AncestorStorySheet;
