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
  StyleSheet,
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
      onRequestClose={handleClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>
              {submitted ? 'Reported' : 'Report this scan'}
            </Text>
            <Pressable onPress={handleClose} hitSlop={12}>
              <X color="#8C93A0" size={20} />
            </Pressable>
          </View>

          {submitted ? (
            <View style={styles.successBlock}>
              <View style={styles.successBadge}>
                <Check color="#0A0A0A" size={22} />
              </View>
              <Text style={styles.successMessage}>
                Thanks — we'll review this and restore your scan if it was our mistake.
              </Text>
              <TouchableOpacity onPress={handleClose} style={styles.primaryCta}>
                <Text style={styles.primaryCtaText}>Close</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={styles.prompt}>What went wrong?</Text>
              <View style={styles.reasonList}>
                {REASONS.map(reason => {
                  const active = selectedReason === reason;
                  return (
                    <TouchableOpacity
                      key={reason}
                      onPress={() => setSelectedReason(reason)}
                      style={[styles.reasonPill, active && styles.reasonPillActive]}
                    >
                      <Text
                        style={[styles.reasonText, active && styles.reasonTextActive]}
                      >
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
                style={styles.notes}
              />

              <TouchableOpacity
                disabled={!selectedReason || submitting}
                onPress={handleSubmit}
                style={[
                  styles.primaryCta,
                  (!selectedReason || submitting) && styles.primaryCtaDisabled,
                ]}
              >
                {submitting ? (
                  <ActivityIndicator color="#0A0A0A" size="small" />
                ) : (
                  <Text style={styles.primaryCtaText}>Submit report</Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: '#0E0E10',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  title: {
    color: '#F5F0E8',
    fontSize: 17,
    fontFamily: 'MontserratAlternates-SemiBold',
  },
  prompt: {
    color: 'rgba(245,240,232,0.65)',
    fontSize: 13,
    fontFamily: 'MontserratAlternates-Regular',
    marginBottom: 10,
  },
  reasonList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  reasonPill: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  reasonPillActive: {
    borderColor: '#C9A84C',
    backgroundColor: 'rgba(201,168,76,0.1)',
  },
  reasonText: {
    color: '#D8D2C4',
    fontSize: 12,
    fontFamily: 'MontserratAlternates-Medium',
  },
  reasonTextActive: {
    color: '#C9A84C',
  },
  notes: {
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
  },
  primaryCta: {
    backgroundColor: '#D4860A',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryCtaDisabled: {
    opacity: 0.45,
  },
  primaryCtaText: {
    color: '#0A0A0A',
    fontSize: 14,
    fontFamily: 'MontserratAlternates-SemiBold',
  },
  successBlock: {
    alignItems: 'center',
    gap: 14,
  },
  successBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#C9A84C',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  successMessage: {
    color: '#D8D2C4',
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 19,
    fontFamily: 'MontserratAlternates-Regular',
    marginBottom: 4,
  },
});

export default ReportIssueModal;
