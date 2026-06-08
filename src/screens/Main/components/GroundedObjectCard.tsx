/**
 * GroundedObjectCard — the verified data card for a detected artifact.
 *
 * Renders the grounded DB record resolved by class_id. Honesty is the contract:
 *  - identity_confidence === 'placard_confirmed' → stated as fact, "Placard-confirmed".
 *  - identity_confidence === 'inferred'          → hedged: a clear "Inferred — not
 *    placard-confirmed" banner, and the name is presented as a likely reading,
 *    never as confirmed fact.
 *
 * This card NEVER shares the screen with the AI-guess fallback — a grounded match
 * wins unconditionally (truth beats fluency). See AiGuessCard for the fallback.
 */

import React from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import {BadgeCheck, CircleHelp} from 'lucide-react-native';
import type {ObjectCard} from '../../../services/detectorResolver';

const AMBER = '#E8A020';
const GREEN = '#4CAF50';

interface Props {
  card: ObjectCard;
  /** When true the record had no narrative — show a minimal grounded label only. */
  minimal?: boolean;
}

const GroundedObjectCard: React.FC<Props> = ({card, minimal}) => {
  const inferred = card.identity_confidence === 'inferred';

  const meta = [card.period, card.dynasty, card.material, card.origin]
    .map(s => (s ?? '').trim())
    .filter(Boolean);

  return (
    <View style={styles.card}>
      {/* Confidence badge — the first thing the user reads. */}
      <View style={[styles.badge, inferred ? styles.badgeInferred : styles.badgeConfirmed]}>
        {inferred ? (
          <CircleHelp size={13} color={AMBER} />
        ) : (
          <BadgeCheck size={13} color={GREEN} />
        )}
        <Text style={[styles.badgeText, {color: inferred ? AMBER : GREEN}]}>
          {inferred ? 'Inferred — not placard-confirmed' : 'Placard-confirmed'}
        </Text>
      </View>

      {inferred && (
        <Text style={styles.hedge}>
          This is a likely identification read from the iconography, not confirmed by a
          museum placard for this object.
        </Text>
      )}

      <Text style={styles.title}>
        {inferred ? `Likely: ${card.display_name}` : card.display_name}
      </Text>

      {meta.length > 0 && (
        <View style={styles.metaRow}>
          {meta.map((m, i) => (
            <View key={`${m}-${i}`} style={styles.metaChip}>
              <Text style={styles.metaText}>{m}</Text>
            </View>
          ))}
        </View>
      )}

      {minimal ? (
        <Text style={styles.minimalNote}>
          A fuller description for this object isn’t available yet.
        </Text>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          {!!card.narrative?.trim() && (
            <Text style={styles.body}>{card.narrative.trim()}</Text>
          )}
          {!!card.iconography?.trim() && (
            <View style={styles.iconoBlock}>
              <Text style={styles.iconoLabel}>WHAT TO LOOK FOR</Text>
              <Text style={styles.iconoText}>{card.iconography.trim()}</Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(12,10,8,0.92)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(232,160,32,0.45)',
    paddingHorizontal: 18,
    paddingVertical: 16,
    maxHeight: 360,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 8,
  },
  badgeConfirmed: {
    backgroundColor: 'rgba(76,175,80,0.14)',
    borderColor: 'rgba(76,175,80,0.5)',
  },
  badgeInferred: {
    backgroundColor: 'rgba(232,160,32,0.14)',
    borderColor: 'rgba(232,160,32,0.5)',
  },
  badgeText: {
    fontFamily: 'InstrumentSans-SemiBold',
    fontSize: 11,
    letterSpacing: 0.3,
  },
  hedge: {
    fontFamily: 'InstrumentSans-Regular',
    fontSize: 12,
    lineHeight: 17,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 8,
  },
  title: {
    fontFamily: 'InstrumentSerif-Regular',
    fontSize: 26,
    lineHeight: 30,
    color: '#F5F0E8',
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  metaChip: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  metaText: {
    fontFamily: 'InstrumentSans-Medium',
    fontSize: 11.5,
    color: 'rgba(245,240,232,0.85)',
  },
  scroll: {maxHeight: 220},
  scrollContent: {paddingBottom: 4},
  body: {
    fontFamily: 'InstrumentSans-Regular',
    fontSize: 14,
    lineHeight: 21,
    color: 'rgba(245,240,232,0.92)',
  },
  iconoBlock: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  iconoLabel: {
    fontFamily: 'InstrumentSans-SemiBold',
    fontSize: 10,
    letterSpacing: 1.2,
    color: AMBER,
    marginBottom: 5,
  },
  iconoText: {
    fontFamily: 'InstrumentSans-Regular',
    fontSize: 13,
    lineHeight: 19,
    color: 'rgba(245,240,232,0.82)',
  },
  minimalNote: {
    fontFamily: 'InstrumentSans-Regular',
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
  },
});

export default GroundedObjectCard;
