/**
 * Admin-only on-site anchor capture screen.
 *
 * Surfaced in Settings (and any other entry point) only when the user JWT
 * carries `is_admin=true`. The backend `/api/v1/ar/anchor-capture` endpoint
 * re-checks the same claim, so a tampered client only loses the UI.
 *
 * v1 uses the device GPS for capture (lat/lng/altitude/heading from
 * `Geolocation.getCurrentPosition`). Accuracy is ~3-10m depending on phone
 * + sky view — acceptable for the launch sites where anchors don't need
 * to be sub-meter precise. For a more accurate flow we'd dispatch a UI
 * Manager command into `EpocheyeGeospatialARView` to read
 * `Earth.cameraGeospatialPose`; deferred until first launch tells us
 * whether GPS-quality is good enough.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import { AppAlert as Alert } from '../../shared/ui/appAlert';

import { captureAnchor } from '../../utils/api/ar';
import { useCurrentZoneStore } from '../../stores/currentZoneStore';
import { FONTS } from '../../core/constants/theme';
import { useBackConfirm } from '../../shared/hooks/useBackConfirm';
import type { MainScreenProps } from '../../core/types/navigation.types';

type Props = MainScreenProps<'AnchorCapture'>;

interface CapturedPose {
  lat: number;
  lng: number;
  altitude: number | null;
  heading: number | null;
  accuracy: number;
  timestamp: number;
}

export default function AnchorCaptureScreen({ navigation }: Props): React.ReactElement {
  const currentZone = useCurrentZoneStore(s => s.zone);
  const [monumentId, setMonumentId] = useState(currentZone?.monument_id ?? '');
  const [objectLabel, setObjectLabel] = useState('');
  const [pose, setPose] = useState<CapturedPose | null>(null);
  const [reading, setReading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Guard against losing an in-progress capture (read pose / typed label).
  useBackConfirm({
    enabled: !submitting && (pose !== null || objectLabel.trim().length > 0),
    title: 'Discard this capture?',
    message: 'Your pose reading and entered details will be lost.',
    confirmText: 'Discard',
    cancelText: 'Keep editing',
  });

  const readPose = () => {
    setReading(true);
    Geolocation.getCurrentPosition(
      position => {
        setPose({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          altitude: position.coords.altitude,
          heading: position.coords.heading,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        });
        setReading(false);
      },
      err => {
        setReading(false);
        Alert.alert('Location read failed', err.message);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      },
    );
  };

  const submit = async () => {
    if (!pose) {
      Alert.alert('No pose', 'Tap "Read pose" first.');
      return;
    }
    if (!monumentId.trim() || !objectLabel.trim()) {
      Alert.alert('Missing fields', 'monument_id and object_label are required.');
      return;
    }

    setSubmitting(true);
    const result = await captureAnchor({
      monument_id: monumentId.trim(),
      object_label: objectLabel.trim(),
      anchor_mode: 'geospatial',
      lat: pose.lat,
      lng: pose.lng,
      altitude: pose.altitude ?? undefined,
      heading_deg: pose.heading ?? undefined,
    });
    setSubmitting(false);

    if (result.success) {
      Alert.alert(
        'Anchor saved',
        `${monumentId} / ${objectLabel}\n${pose.lat.toFixed(6)}, ${pose.lng.toFixed(6)}`,
        [
          {
            text: 'Capture another',
            onPress: () => {
              setObjectLabel('');
              setPose(null);
            },
          },
          { text: 'Done', onPress: () => navigation.goBack() },
        ],
      );
    } else if ('error' in result) {
      Alert.alert('Save failed', result.error.message);
    }
  };

  return (
    <ScrollView
      className="flex-1 bg-surface-1"
      contentContainerStyle={{padding: 24, paddingTop: 60}}
    >
      <Text className="text-parchment text-[24px] font-ui-semibold mb-2">Anchor Capture</Text>
      <Text className="text-grey-muted text-[13px] font-ui mb-6 leading-[18px]">
        Stand at the object, point the phone at it, and tap Read pose. Walk
        between captures.
      </Text>

      <Text className="text-grey-muted text-[12px] font-ui-medium mt-4 mb-[6px] uppercase tracking-[1px]">
        Monument ID
      </Text>
      <TextInput
        value={monumentId}
        onChangeText={setMonumentId}
        placeholder="konark"
        placeholderTextColor="#666"
        autoCapitalize="none"
        style={{
          backgroundColor: 'rgba(255,255,255,0.05)',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          borderRadius: 8,
          paddingHorizontal: 14,
          paddingVertical: 12,
          color: '#F5F0E8',
          fontSize: 14,
          fontFamily: FONTS.regular,
        }}
      />

      <Text className="text-grey-muted text-[12px] font-ui-medium mt-4 mb-[6px] uppercase tracking-[1px]">
        Object label
      </Text>
      <TextInput
        value={objectLabel}
        onChangeText={setObjectLabel}
        placeholder="main_chariot_wheel"
        placeholderTextColor="#666"
        autoCapitalize="none"
        style={{
          backgroundColor: 'rgba(255,255,255,0.05)',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          borderRadius: 8,
          paddingHorizontal: 14,
          paddingVertical: 12,
          color: '#F5F0E8',
          fontSize: 14,
          fontFamily: FONTS.regular,
        }}
      />

      <TouchableOpacity
        className="bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.15)] rounded-[10px] py-[14px] items-center mt-6"
        onPress={readPose}
        disabled={reading}>
        {reading ? (
          <ActivityIndicator color="#F5F0E8" />
        ) : (
          <Text className="text-parchment text-[14px] font-ui-semibold tracking-[0.5px]">
            Read pose
          </Text>
        )}
      </TouchableOpacity>

      {pose && (
        <View className="bg-[rgba(72,187,120,0.08)] border border-[rgba(72,187,120,0.3)] rounded-[8px] p-[14px] mt-4">
          <Text className="text-[#48BB78] text-[12px] font-ui leading-[18px]">lat: {pose.lat.toFixed(6)}</Text>
          <Text className="text-[#48BB78] text-[12px] font-ui leading-[18px]">lng: {pose.lng.toFixed(6)}</Text>
          <Text className="text-[#48BB78] text-[12px] font-ui leading-[18px]">
            altitude: {pose.altitude != null ? `${pose.altitude.toFixed(2)} m` : '—'}
          </Text>
          <Text className="text-[#48BB78] text-[12px] font-ui leading-[18px]">
            heading: {pose.heading != null ? `${pose.heading.toFixed(1)}°` : '—'}
          </Text>
          <Text className="text-[#48BB78] text-[12px] font-ui leading-[18px]">accuracy: ±{pose.accuracy.toFixed(1)} m</Text>
        </View>
      )}

      <TouchableOpacity
        className="bg-accent-amber border border-accent-amber rounded-[10px] py-[14px] items-center mt-4"
        onPress={submit}
        disabled={submitting}>
        {submitting ? (
          <ActivityIndicator color="#000" />
        ) : (
          <Text className="text-black text-[14px] font-ui-semibold tracking-[0.5px]">Save anchor</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text className="text-grey-muted text-[13px] font-ui-medium text-center mt-6">Cancel</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
