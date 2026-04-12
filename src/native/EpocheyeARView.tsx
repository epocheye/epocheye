/**
 * React Native wrapper for the native EpocheyeARView component.
 *
 * Renders the ARCore camera with 3D-anchored info cards on Android.
 * Returns `null` on iOS (the caller should render the 2D fallback).
 */

import React from 'react';
import {
  Platform,
  requireNativeComponent,
  type ViewStyle,
} from 'react-native';
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

const NativeARView =
  Platform.OS === 'android'
    ? requireNativeComponent<NativeARViewProps>('EpocheyeARView')
    : null;

interface EpocheyeARViewProps {
  style?: ViewStyle;
  identification: GeminiIdentification | null;
  arEnabled?: boolean;
  onCardTapped?: () => void;
  onARError?: (error: string) => void;
}

/**
 * AR view component. Renders the native ARCore view on Android,
 * or `null` on iOS (caller should render the 2D IdentificationCard).
 */
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
