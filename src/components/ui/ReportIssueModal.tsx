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

  const reset = useCallback(() => {
    setSelectedReason(null);
    setNotes('');
    setSubmitted(false);
    setSubmitting(false);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  const handleSubmit = useCallback(async () => {
    if (!selectedReason) return;
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
    }
  }, [imageUrl, notes, scanId, selectedReason]);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={handleClose}>
      <View className="flex-1 bg-[rgba(0,0,0,0.7)] justify-center px-6">
        <View className="bg-[#0E0E10] rounded-[20px] p-5 border border-[rgba(255,255,255,0.08)]">
          <View className="flex-row justify-between items-center mb-[14px]">
            <Text className="text-parchment text-[17px] font-montserrat-semibold">
              {submitted ? 'Reported' : 'Report this scan'}
            </Text>
            <Pressable onPress={handleClose} hitSlop={12}>
              <X color="#8C93A0" size={20} />
            </Pressable>
          </View>

          {submitted ? (
            <View className="items-center gap-y-[14px]">
              <View className="w-12 h-12 rounded-full bg-[#C9A84C] items-center justify-center mt-1">
                <Check color="#0A0A0A" size={22} />
              </View>
              <Text className="text-[#D8D2C4] text-center text-[13px] leading-[19px] font-montserrat mb-1">
                Thanks — we'll review this and restore your scan if it was our mistake.
              </Text>
              <TouchableOpacity
                onPress={handleClose}
                className="bg-[#D4860A] rounded-[14px] py-[14px] items-center justify-center w-full">
                <Text className="text-surface-1 text-[14px] font-montserrat-semibold">
                  Close
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text className="text-[rgba(245,240,232,0.65)] text-[13px] font-montserrat mb-[10px]">
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
                          ? 'border-[#C9A84C] bg-[rgba(201,168,76,0.1)]'
                          : 'border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)]'
                      }`}>
                      <Text
                        className={`text-[12px] font-montserrat-medium ${
                          active ? 'text-[#C9A84C]' : 'text-[#D8D2C4]'
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
                  fontFamily: 'MontserratAlternates-Regular',
                  fontSize: 13,
                  minHeight: 72,
                  textAlignVertical: 'top',
                  marginBottom: 14,
                }}
              />

              <TouchableOpacity
                disabled={!selectedReason || submitting}
                onPress={handleSubmit}
                className={`bg-[#D4860A] rounded-[14px] py-[14px] items-center justify-center${
                  (!selectedReason || submitting) ? ' opacity-[0.45]' : ''
                }`}>
                {submitting ? (
                  <ActivityIndicator color="#0A0A0A" size="small" />
                ) : (
                  <Text className="text-surface-1 text-[14px] font-montserrat-semibold">
                    Submit report
                  </Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

export default ReportIssueModal;
