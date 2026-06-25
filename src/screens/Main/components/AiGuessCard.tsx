/**
 * AiGuessCard — the fallback card shown when there is no curated DB match.
 *
 * Presented identically to GroundedObjectCard so the user sees one consistent
 * data card; whether the content came from a curated record or was generated is
 * tracked in the backend only and never surfaced to the user.
 */

import React from 'react';
import {ActivityIndicator, ScrollView, StyleSheet, Text, View} from 'react-native';

const MUTED = '#BDB6AC';

interface Props {
  /** The identified label, if any (shown as the title). */
  label?: string | null;
  /** Streaming narration text accumulated so far. */
  text: string;
  /** True while the SSE stream is still arriving. */
  streaming: boolean;
}

const AiGuessCard: React.FC<Props> = ({label, text, streaming}) => {
  return (
    <View style={styles.card}>
      {!!label?.trim() && <Text style={styles.title}>{label.trim()}</Text>}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {!!text.trim() && <Text style={styles.body}>{text.trim()}</Text>}
        {streaming && (
          <View style={styles.streamingRow}>
            <ActivityIndicator size="small" color={MUTED} />
            <Text style={styles.streamingText}>thinking…</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(12,10,8,0.92)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(203,168,98,0.45)',
    paddingHorizontal: 18,
    paddingVertical: 16,
    maxHeight: 360,
  },
  title: {
    fontFamily: 'Fraunces-Regular',
    fontSize: 26,
    lineHeight: 30,
    color: '#F5F0E8',
    marginBottom: 10,
  },
  scroll: {maxHeight: 240},
  scrollContent: {paddingBottom: 4},
  body: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 21,
    color: 'rgba(245,240,232,0.92)',
  },
  streamingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  streamingText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    color: 'rgba(245,240,232,0.6)',
  },
});

export default AiGuessCard;
