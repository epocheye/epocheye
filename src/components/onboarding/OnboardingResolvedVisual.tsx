import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import ResolvedSubjectImage from '../ui/ResolvedSubjectImage';
import { getOnboardingVisualFallback } from './visual-fallbacks';

interface OnboardingResolvedVisualProps {
  subject?: string | null;
  context?: string;
  fallbackUri?: string | null;
  height?: number;
  style?: StyleProp<ViewStyle>;
}

const BASE_STYLE = {
  width: '100%' as const,
  borderRadius: 18,
  overflow: 'hidden' as const,
  backgroundColor: '#1A1A1A',
};

const IMAGE_STYLE = { borderRadius: 18 };

const OnboardingResolvedVisual: React.FC<OnboardingResolvedVisualProps> = ({
  subject,
  context,
  fallbackUri,
  height = 170,
  style,
}) => {
  return (
    <ResolvedSubjectImage
      subject={subject}
      context={context}
      fallbackUri={
        fallbackUri ?? getOnboardingVisualFallback(subject, context)
      }
      style={[BASE_STYLE, { height }, style]}
      imageStyle={IMAGE_STYLE}
      loadingLabel="Preparing your visual..."
      resizeMode="cover"
    >
      <LinearGradient
        colors={['rgba(13,13,13,0.06)', 'rgba(13,13,13,0.72)']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
    </ResolvedSubjectImage>
  );
};

export default OnboardingResolvedVisual;
