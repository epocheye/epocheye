/**
 * ReportIssueModal — lets a user flag a failed/bad scan for admin review.
 * Opens in response to "Report issue" from the lens error UI; submits to
 * POST /api/v1/scans/report-issue. Admin approval triggers a quota refund.
 */

import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
// Keeps the centered card above the IME while typing notes (RN edge-to-edge
// leaves plain Modals underneath the keyboard).
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { Check, X } from 'lucide-react-native';
import { reportScanIssue } from '../../utils/api/explorer-pass';

const REASONS = [
  "Didn't identify the monument",
  'Wrong monument identified',
  'Blank or empty response',
  'App crashed mid-scan',
  'Other',
];

interface Props {
  visible: boolean;
  onClose: () => void;
  scanId?: string;
  imageUrl?: string;
}

const ReportIssueModal: React.FC<Props> = ({ visible, onClose, scanId, imageUrl }) => {
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [failed, setFailed] = useState(false);

  const reset = useCallback(() => {
    setSelectedReason(null);
    setNotes('');
    setSubmitted(false);
    setSubmitting(false);
    setFailed(false);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  const handleSubmit = useCallback(async () => {
    if (!selectedReason) return;
    setFailed(false);
    setSubmitting(true);
    const result = await reportScanIssue({
      scan_id: scanId,
      reason: selectedReason,
      notes: notes.trim() || undefined,
      image_url: imageUrl,
    });
    setSubmitting(false);
    if (result.success) {
      setSubmitted(true);
    } else {
      // Don't fail silently — let the user know it didn't go through.
      setFailed(true);
    }
  }, [imageUrl, notes, scanId, selectedReason]);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior="padding"
        className="flex-1 bg-[rgba(0,0,0,0.7)] justify-center px-6">
        <View className="bg-[#0E0E10] rounded-[20px] p-5 border border-[rgba(255,255,255,0.08)]">
          <View className="flex-row justify-between items-center mb-[14px]">
            <Text className="text-parchment text-[17px] font-ui-semibold">
              {submitted ? 'Reported' : 'Report this scan'}
            </Text>
            <Pressable onPress={handleClose} hitSlop={12}>
              <X color="#8C93A0" size={20} />
            </Pressable>
          </View>

          {submitted ? (
            <View className="items-center gap-y-[14px]">
              <View className="w-12 h-12 rounded-full bg-[#CBA862] items-center justify-center mt-1">
                <Check color="#0A0A0A" size={22} />
              </View>
              <Text className="text-[#D8D2C4] text-center text-[13px] leading-[19px] font-ui mb-1">
                Thanks — we'll review this and restore your scan if it was our mistake.
              </Text>
              <TouchableOpacity
                onPress={handleClose}
                className="bg-[#B8923F] rounded-[14px] py-[14px] items-center justify-center w-full">
                <Text className="text-surface-1 text-[14px] font-ui-semibold">
                  Close
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text className="text-[rgba(245,240,232,0.65)] text-[13px] font-ui mb-[10px]">
                What went wrong?
              </Text>
              <View className="flex-row flex-wrap gap-2 mb-3">
                {REASONS.map(reason => {
                  const active = selectedReason === reason;
                  return (
                    <TouchableOpacity
                      key={reason}
                      onPress={() => setSelectedReason(reason)}
                      className={`border rounded-xl px-3 py-2 ${
                        active
                          ? 'border-[#CBA862] bg-[rgba(203,168,98,0.1)]'
                          : 'border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)]'
                      }`}>
                      <Text
                        className={`text-[12px] font-ui-medium ${
                          active ? 'text-[#CBA862]' : 'text-[#D8D2C4]'
                        }`}>
                        {reason}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Anything else? (optional)"
                placeholderTextColor="rgba(245,240,232,0.35)"
                multiline
                numberOfLines={3}
                style={{
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.08)',
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  color: '#F5F0E8',
                  fontFamily: 'PlusJakartaSans-Regular',
                  fontSize: 13,
                  minHeight: 72,
                  textAlignVertical: 'top',
                  marginBottom: 14,
                }}
              />

              {failed ? (
                <Text className="text-[#E5837A] text-[12px] font-ui text-center mb-2.5">
                  Couldn't send your report. Check your connection and try again.
                </Text>
              ) : null}

              <TouchableOpacity
                disabled={!selectedReason || submitting}
                onPress={handleSubmit}
                className={`bg-[#B8923F] rounded-[14px] py-[14px] items-center justify-center${
                  (!selectedReason || submitting) ? ' opacity-[0.45]' : ''
                }`}>
                {submitting ? (
                  <ActivityIndicator color="#0A0A0A" size="small" />
                ) : (
                  <Text className="text-surface-1 text-[14px] font-ui-semibold">
                    {failed ? 'Try again' : 'Submit report'}
                  </Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export default ReportIssueModal;
