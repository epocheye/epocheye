/**
 * React Native wrapper for the native EpocheyeARView component.
 *
 * Renders the ARCore camera on Android and the ARKit/RealityKit camera on iOS,
 * both wired to the native `EpocheyeARView` view manager name. Returns `null`
 * when no identification payload is available (caller renders the 2D fallback).
 */

import React from 'react';
import { requireNativeComponent, type ViewStyle } from 'react-native';
import type { GeminiIdentification } from '../services/geminiVisionService';

interface NativeARViewProps {
  style?: ViewStyle;
  identificationName?: string;
  identificationPeriod?: string;
  identificationSignificance?: string;
  identificationFact?: string;
  arEnabled?: boolean;
  onARReady?: () => void;
  onCardTapped?: () => void;
  onARError?: (event: { nativeEvent: { error: string } }) => void;
}

const NativeARView = (() => {
  try {
    return requireNativeComponent<NativeARViewProps>('EpocheyeARView');
  } catch {
    return null;
  }
})();

interface EpocheyeARViewProps {
  style?: ViewStyle;
  identification: GeminiIdentification | null;
  arEnabled?: boolean;
  onCardTapped?: () => void;
  onARError?: (error: string) => void;
}

export default function EpocheyeARView({
  style,
  identification,
  arEnabled = true,
  onCardTapped,
  onARError,
}: EpocheyeARViewProps): React.ReactElement | null {
  if (!NativeARView || !identification) return null;

  return (
    <NativeARView
      style={style}
      identificationName={identification.name}
      identificationPeriod={identification.period}
      identificationSignificance={identification.significance}
      identificationFact={identification.fact}
      arEnabled={arEnabled}
      onCardTapped={onCardTapped}
      onARError={
        onARError
          ? (e: { nativeEvent: { error: string } }) =>
              onARError(e.nativeEvent.error)
          : undefined
      }
    />
  );
}
