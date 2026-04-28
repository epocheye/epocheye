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
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Geolocation from '@react-native-community/geolocation';

import { captureAnchor } from '../../utils/api/ar';
import { useCurrentZoneStore } from '../../stores/currentZoneStore';
import { COLORS, FONTS } from '../../core/constants/theme';
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Anchor Capture</Text>
      <Text style={styles.subtitle}>
        Stand at the object, point the phone at it, and tap Read pose. Walk
        between captures.
      </Text>

      <Text style={styles.label}>Monument ID</Text>
      <TextInput
        value={monumentId}
        onChangeText={setMonumentId}
        placeholder="konark"
        placeholderTextColor="#666"
        autoCapitalize="none"
        style={styles.input}
      />

      <Text style={styles.label}>Object label</Text>
      <TextInput
        value={objectLabel}
        onChangeText={setObjectLabel}
        placeholder="main_chariot_wheel"
        placeholderTextColor="#666"
        autoCapitalize="none"
        style={styles.input}
      />

      <TouchableOpacity
        style={styles.button}
        onPress={readPose}
        disabled={reading}>
        {reading ? (
          <ActivityIndicator color={COLORS.textPrimary} />
        ) : (
          <Text style={styles.buttonText}>Read pose</Text>
        )}
      </TouchableOpacity>

      {pose && (
        <View style={styles.poseBox}>
          <Text style={styles.poseLine}>lat: {pose.lat.toFixed(6)}</Text>
          <Text style={styles.poseLine}>lng: {pose.lng.toFixed(6)}</Text>
          <Text style={styles.poseLine}>
            altitude: {pose.altitude != null ? `${pose.altitude.toFixed(2)} m` : '—'}
          </Text>
          <Text style={styles.poseLine}>
            heading: {pose.heading != null ? `${pose.heading.toFixed(1)}°` : '—'}
          </Text>
          <Text style={styles.poseLine}>accuracy: ±{pose.accuracy.toFixed(1)} m</Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.button, styles.primary]}
        onPress={submit}
        disabled={submitting}>
        {submitting ? (
          <ActivityIndicator color="#000" />
        ) : (
          <Text style={[styles.buttonText, styles.primaryText]}>Save anchor</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text style={styles.cancel}>Cancel</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0A' },
  content: { padding: 24, paddingTop: 60 },
  title: {
    color: COLORS.textPrimary,
    fontSize: 24,
    fontFamily: FONTS.bold,
    marginBottom: 8,
  },
  subtitle: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontFamily: FONTS.regular,
    marginBottom: 24,
    lineHeight: 18,
  },
  label: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontFamily: FONTS.medium,
    marginTop: 16,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: COLORS.textPrimary,
    fontSize: 14,
    fontFamily: FONTS.regular,
  },
  button: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonText: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontFamily: FONTS.semiBold,
    letterSpacing: 0.5,
  },
  primary: {
    backgroundColor: '#E8A020',
    borderColor: '#E8A020',
    marginTop: 16,
  },
  primaryText: { color: '#000' },
  poseBox: {
    backgroundColor: 'rgba(72, 187, 120, 0.08)',
    borderColor: 'rgba(72, 187, 120, 0.3)',
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    marginTop: 16,
  },
  poseLine: {
    color: '#48BB78',
    fontSize: 12,
    fontFamily: FONTS.regular,
    lineHeight: 18,
  },
  cancel: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontFamily: FONTS.medium,
    textAlign: 'center',
    marginTop: 24,
  },
});
