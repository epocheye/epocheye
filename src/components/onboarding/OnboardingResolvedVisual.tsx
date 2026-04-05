import React from 'react';
import { StyleProp, StyleSheet, ViewStyle } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import ResolvedSubjectImage from '../ui/ResolvedSubjectImage';

interface OnboardingResolvedVisualProps {
  subject?: string | null;
  context?: string;
  fallbackUri?: string | null;
  height?: number;
  style?: StyleProp<ViewStyle>;
}

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
      fallbackUri={fallbackUri}
      style={[styles.base, { height }, style]}
      imageStyle={styles.image}
      loadingLabel="Preparing your visual..."
      resizeMode="cover"
    >
      <LinearGradient
        colors={['rgba(13,13,13,0.06)', 'rgba(13,13,13,0.72)']}
        style={StyleSheet.absoluteFill}
      />
    </ResolvedSubjectImage>
  );
};

const styles = StyleSheet.create({
  base: {
    width: '100%',
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#1A1A1A',
  },
  image: {
    borderRadius: 18,
  },
});

export default OnboardingResolvedVisual;
