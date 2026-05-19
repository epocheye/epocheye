import React, { useEffect, useMemo, useState } from 'react';
import {
  Image,
  type ImageResizeMode,
  type ImageStyle,
  StyleProp,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useResolvedSubjectImage } from '../../shared/hooks';
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
  enableRemoteResolve?: boolean;
  children?: React.ReactNode;
}

const IMAGE_BASE_STYLE: ImageStyle = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  width: '100%',
  height: '100%',
};

const ResolvedSubjectImage: React.FC<ResolvedSubjectImageProps> = ({
  subject,
  context,
  fallbackUri,
  style,
  imageStyle,
  resizeMode = 'cover',
  loadingLabel = 'Resolving visual context...',
  showSkeletonWhileLoading = false,
  enableRemoteResolve = false,
  children,
}) => {
  const { url, loading } = useResolvedSubjectImage({
    subject,
    context,
    enabled: !!subject,
    remote: enableRemoteResolve,
  });

  const [primaryFailed, setPrimaryFailed] = useState(false);
  const [fallbackFailed, setFallbackFailed] = useState(false);

  useEffect(() => {
    setPrimaryFailed(false);
    setFallbackFailed(false);
  }, [url, fallbackUri]);

  const resolvedUrl = useMemo(() => {
    if (!url || primaryFailed) return null;
    return url;
  }, [primaryFailed, url]);

  const fallback = useMemo(() => {
    if (!fallbackUri || fallbackFailed) return null;
    return fallbackUri;
  }, [fallbackFailed, fallbackUri]);

  const imageUri = resolvedUrl ?? fallback;
  const shouldRenderSkeleton =
    loading && (showSkeletonWhileLoading ? !resolvedUrl : !imageUri);

  if (!imageUri && !shouldRenderSkeleton) {
    return null;
  }

  return (
    <View style={[{overflow: 'hidden'}, style]}>
      {imageUri ? (
        <Image
          source={{ uri: imageUri }}
          style={[IMAGE_BASE_STYLE, imageStyle]}
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
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 20,
            gap: 10,
          }}>
          <AnimatedLogo
            size={26}
            variant="white"
            motion="pulse"
            showRing={false}
          />
          <Text className="text-[#B8AF9E] font-montserrat text-[12px] text-center">
            {loadingLabel}
          </Text>
          <View className="w-[86%] h-[10px] rounded-[5px] bg-[#2A2A2A]" />
          <View className="w-[62%] h-[10px] rounded-[5px] bg-[#2A2A2A]" />
        </LinearGradient>
      ) : null}

      {children}
    </View>
  );
};

export default ResolvedSubjectImage;
