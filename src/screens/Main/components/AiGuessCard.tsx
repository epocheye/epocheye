/**
 * AiGuessCard — the Gemini fallback state, reached ONLY when no grounded match
 * exists (class_id not in registry, or no confident detection).
 *
 * Deliberately, unmistakably different from GroundedObjectCard: a cool slate
 * palette (not heritage amber), a dashed border, and an explicit "AI guess —
 * not verified" header, so a user can never mistake it for grounded museum data.
 * It never renders alongside a grounded card.
 */

import React from 'react';
import {ActivityIndicator, ScrollView, StyleSheet, Text, View} from 'react-native';
import {Sparkles} from 'lucide-react-native';

const SLATE = '#8AA0B4';

interface Props {
  /** The label Gemini identified, if any (shown as a tentative title). */
  label?: string | null;
  /** Streaming narration text accumulated so far. */
  text: string;
  /** True while the SSE stream is still arriving. */
  streaming: boolean;
}

const AiGuessCard: React.FC<Props> = ({label, text, streaming}) => {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Sparkles size={14} color={SLATE} />
        <Text style={styles.headerText}>AI GUESS — NOT VERIFIED</Text>
      </View>

      {!!label?.trim() && <Text style={styles.title}>{label.trim()}</Text>}

      <Text style={styles.disclaimer}>
        This isn’t from the museum’s records. It’s an AI’s best guess from the image and
        may be wrong.
      </Text>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {!!text.trim() && <Text style={styles.body}>{text.trim()}</Text>}
        {streaming && (
          <View style={styles.streamingRow}>
            <ActivityIndicator size="small" color={SLATE} />
            <Text style={styles.streamingText}>thinking…</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(18,24,30,0.92)',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(138,160,180,0.55)',
    borderStyle: 'dashed',
    paddingHorizontal: 18,
    paddingVertical: 16,
    maxHeight: 340,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  headerText: {
    fontFamily: 'InstrumentSans-Bold',
    fontSize: 11,
    letterSpacing: 1.2,
    color: SLATE,
  },
  title: {
    fontFamily: 'InstrumentSerif-Regular',
    fontSize: 22,
    lineHeight: 26,
    color: '#E8EEF3',
    marginBottom: 6,
  },
  disclaimer: {
    fontFamily: 'InstrumentSans-Regular',
    fontSize: 12,
    lineHeight: 17,
    color: 'rgba(232,238,243,0.62)',
    marginBottom: 10,
  },
  scroll: {maxHeight: 200},
  scrollContent: {paddingBottom: 4},
  body: {
    fontFamily: 'InstrumentSans-Regular',
    fontSize: 14,
    lineHeight: 21,
    color: 'rgba(232,238,243,0.9)',
  },
  streamingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  streamingText: {
    fontFamily: 'InstrumentSans-Regular',
    fontSize: 12,
    color: 'rgba(232,238,243,0.6)',
  },
});

export default AiGuessCard;
