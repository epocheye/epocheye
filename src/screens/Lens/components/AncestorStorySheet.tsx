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
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { Lock } from 'lucide-react-native';
import { FONTS } from '../../../core/constants/theme';

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
      onArTeaserSeen,
    },
    ref,
  ) => {
    const sheetRef = useRef<BottomSheet>(null);
    const hasTrackedTeaser = useRef(false);
    const [cursorVisible, setCursorVisible] = useState(true);
    const [showLineage, setShowLineage] = useState(false);

    const snapPoints = useMemo(() => ['60%', '95%'], []);

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
        handleIndicatorStyle={styles.handle}
      >
        <BottomSheetScrollView
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.label}>
            YOUR ANCESTOR AT {monumentName.toUpperCase()}
          </Text>

          {isLoading && storyText.length === 0 ? (
            <View style={styles.loadingArea}>
              <ActivityIndicator color="#E8A020" size="small" />
              <Text style={styles.loadingText}>Gathering your story...</Text>
              <View style={styles.shimmerLine} />
              <View style={[styles.shimmerLine, styles.shimmerLineNarrow]} />
              <View style={styles.shimmerLine} />
            </View>
          ) : (
            <Text style={styles.storyText}>
              {storyText}
              {isStreaming && cursorVisible ? '|' : ''}
            </Text>
          )}

          {showLineage ? (
            <Text style={styles.lineageText}>
              {firstName}, this ancestor shares your lineage.
            </Text>
          ) : null}

          <View style={styles.lockedCard}>
            <View style={styles.lockedRow}>
              <Lock size={16} color="#8C93A0" />
              <Text style={styles.lockedTitle}>AR Timeline · Coming Soon</Text>
            </View>
            <Text style={styles.lockedBody}>
              Walk through centuries of this monument in augmented reality.
            </Text>
          </View>
        </BottomSheetScrollView>
      </BottomSheet>
    );
  },
);

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
  contentContainer: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  label: {
    marginBottom: 12,
    color: '#8C93A0',
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontFamily: FONTS.medium,
  },
  storyText: {
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 26,
    fontFamily: Platform.select({
      ios: 'Georgia',
      android: 'serif',
      default: 'serif',
    }),
  },
  loadingArea: {
    marginTop: 4,
    gap: 10,
  },
  loadingText: {
    color: '#8C93A0',
    fontSize: 13,
    fontFamily: FONTS.regular,
  },
  shimmerLine: {
    height: 13,
    borderRadius: 6,
    backgroundColor: '#2A2A2A',
    width: '100%',
  },
  shimmerLineNarrow: {
    width: '76%',
  },
  lineageText: {
    marginTop: 18,
    color: '#8C93A0',
    fontSize: 14,
    fontStyle: 'italic',
    fontFamily: FONTS.italic,
  },
  lockedCard: {
    marginTop: 22,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#2A2A2A',
    backgroundColor: '#1A1A1A',
    padding: 16,
  },
  lockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lockedTitle: {
    marginLeft: 8,
    color: '#8C93A0',
    fontSize: 13,
    fontFamily: FONTS.semiBold,
  },
  lockedBody: {
    marginTop: 4,
    color: '#666666',
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FONTS.regular,
  },
});

AncestorStorySheet.displayName = 'AncestorStorySheet';

export default AncestorStorySheet;
