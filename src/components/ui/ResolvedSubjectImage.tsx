import React, { useEffect, useMemo, useState } from 'react';
import {
  Image,
  type ImageResizeMode,
  type ImageStyle,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useResolvedSubjectImage } from '../../shared/hooks';
import { FONTS } from '../../core/constants/theme';
import AnimatedLogo from './AnimatedLogo';

interface ResolvedSubjectImageProps {
  subject?: string | null;
  context?: string;
  fallbackUri?: string | null;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
  resizeMode?: ImageResizeMode;
  loadingLabel?: string;
  showSkeletonWhileLoading?: boolean;
  children?: React.ReactNode;
}

const ResolvedSubjectImage: React.FC<ResolvedSubjectImageProps> = ({
  subject,
  context,
  fallbackUri,
  style,
  imageStyle,
  resizeMode = 'cover',
  loadingLabel = 'Resolving visual context...',
  showSkeletonWhileLoading = false,
  children,
}) => {
  const { url, loading } = useResolvedSubjectImage({
    subject,
    context,
    enabled: !!subject,
  });

  const [primaryFailed, setPrimaryFailed] = useState(false);
  const [fallbackFailed, setFallbackFailed] = useState(false);

  useEffect(() => {
    setPrimaryFailed(false);
    setFallbackFailed(false);
  }, [url, fallbackUri]);

  const resolvedUrl = useMemo(() => {
    if (!url || primaryFailed) {
      return null;
    }
    return url;
  }, [primaryFailed, url]);

  const fallback = useMemo(() => {
    if (!fallbackUri || fallbackFailed) {
      return null;
    }
    return fallbackUri;
  }, [fallbackFailed, fallbackUri]);

  const imageUri = resolvedUrl ?? fallback;
  const shouldRenderSkeleton =
    loading && (showSkeletonWhileLoading ? !resolvedUrl : !imageUri);

  if (!imageUri && !shouldRenderSkeleton) {
    return null;
  }

  return (
    <View style={[styles.container, style]}>
      {imageUri ? (
        <Image
          source={{ uri: imageUri }}
          style={[styles.image, imageStyle]}
          resizeMode={resizeMode}
          onError={() => {
            if (resolvedUrl) {
              setPrimaryFailed(true);
              return;
            }
            setFallbackFailed(true);
          }}
        />
      ) : null}

      {shouldRenderSkeleton ? (
        <LinearGradient
          colors={['#1B1B1B', '#131313', '#1B1B1B']}
          style={styles.loadingWrap}
        >
          <AnimatedLogo
            size={26}
            variant="white"
            motion="orbit"
            showRing={false}
          />
          <Text style={styles.loadingText}>{loadingLabel}</Text>
          <View style={styles.shimmerLine} />
          <View style={[styles.shimmerLine, styles.shimmerLineShort]} />
        </LinearGradient>
      ) : null}

      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  image: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  loadingWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    gap: 10,
  },
  loadingText: {
    color: '#B8AF9E',
    fontSize: 12,
    textAlign: 'center',
    fontFamily: FONTS.regular,
  },
  shimmerLine: {
    width: '86%',
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2A2A2A',
  },
  shimmerLineShort: {
    width: '62%',
  },
});

export default ResolvedSubjectImage;
