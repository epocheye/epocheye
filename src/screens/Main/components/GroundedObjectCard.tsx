/**
 * GroundedObjectCard — the verified data card for a detected artifact.
 *
 * Renders the grounded DB record resolved by class_id. Honesty is the contract:
 *  - identity_confidence === 'grounded'  → stated as fact, "Grounded record".
 *  - identity_confidence === 'inferred'  → hedged: a clear "Inferred — not confirmed"
 *    banner, and the name is presented as a likely reading, never as confirmed fact.
 *
 * This card NEVER shares the screen with the AI-guess fallback — a grounded match
 * wins unconditionally (truth beats fluency). See AiGuessCard for the fallback.
 */

import React, {useState} from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import {BadgeCheck, CircleHelp} from 'lucide-react-native';
import type {ContextLayer, ObjectCard} from '../../../services/detectorResolver';
import ContextLayerSlider from './ContextLayerSlider';

const AMBER = '#CBA862';
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

  // The slider only appears for grounded records with 2+ layers; minimal/no-layer
  // records (and the AI fallback, which is a different component) get the plain card.
  const layers =
    !minimal && Array.isArray(card.context_layers) && card.context_layers.length >= 2
      ? card.context_layers
      : null;

  if (layers) {
    return (
      <LayeredObjectCard
        card={card}
        inferred={inferred}
        meta={meta}
        layers={layers}
      />
    );
  }

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
          {inferred ? 'Inferred — not confirmed' : 'Grounded record'}
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

/**
 * LayeredObjectCard — the grounded card with the timeline/context slider.
 *
 * The body cross-fades between the layer texts as the shared `progress` value
 * scrubs (interpolated opacity per layer), and the per-layer hedge follows the
 * ACTIVE layer's confidence — so honesty persists rung by rung, independently of
 * the card-level identity badge at the top.
 */
const LayeredObjectCard: React.FC<{
  card: ObjectCard;
  inferred: boolean;
  meta: string[];
  layers: ContextLayer[];
}> = ({card, inferred, meta, layers}) => {
  const progress = useSharedValue(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const activeInferred = layers[activeIndex]?.confidence === 'inferred';

  return (
    <View style={[styles.card, styles.cardLayered]}>
      {/* Card-level identity badge — unchanged from the plain card. */}
      <View style={[styles.badge, inferred ? styles.badgeInferred : styles.badgeConfirmed]}>
        {inferred ? (
          <CircleHelp size={13} color={AMBER} />
        ) : (
          <BadgeCheck size={13} color={GREEN} />
        )}
        <Text style={[styles.badgeText, {color: inferred ? AMBER : GREEN}]}>
          {inferred ? 'Inferred — not confirmed' : 'Grounded record'}
        </Text>
      </View>

      {/* Per-layer hedge: visible whenever the ACTIVE layer is inferred. */}
      {activeInferred && (
        <Text style={styles.hedge}>
          This layer is read from the iconography and comparable pieces, not confirmed
          by a museum placard for this object.
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

      {/* Cross-fading layer body — texts stacked, opacity driven by `progress`. */}
      <View style={styles.crossfade}>
        {layers.map((layer, i) => (
          <CrossfadeLayer
            key={`body-${layer.layer_id}`}
            index={i}
            progress={progress}
            body={layer.body}
          />
        ))}
      </View>

      {!!card.iconography?.trim() && (
        <View style={styles.iconoBlock}>
          <Text style={styles.iconoLabel}>WHAT TO LOOK FOR</Text>
          <Text style={styles.iconoText} numberOfLines={3}>
            {card.iconography.trim()}
          </Text>
        </View>
      )}

      <ContextLayerSlider
        layers={layers}
        progress={progress}
        onActiveChange={setActiveIndex}
      />
    </View>
  );
};

/** One absolutely-stacked layer body that fades in as `progress` reaches its stop. */
const CrossfadeLayer: React.FC<{
  index: number;
  progress: SharedValue<number>;
  body: string;
}> = ({index, progress, body}) => {
  const style = useAnimatedStyle(() => {
    const opacity = interpolate(
      progress.value,
      [index - 1, index, index + 1],
      [0, 1, 0],
      'clamp',
    );
    return {opacity};
  });
  return (
    <Animated.View
      style={[styles.crossfadeLayer, style]}
      pointerEvents="box-none">
      <ScrollView
        style={styles.crossfadeScroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <Text style={styles.body}>{body.trim()}</Text>
      </ScrollView>
    </Animated.View>
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
  // Layered mode is a touch taller to seat the cross-fade body + slider without
  // cramping. Still bounded so it never grows unbounded over the camera feed.
  cardLayered: {
    maxHeight: 480,
  },
  // Fixed-height window the layer bodies cross-fade within (each is absolute).
  crossfade: {
    height: 150,
    position: 'relative',
  },
  crossfadeLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  crossfadeScroll: {flex: 1},
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
    backgroundColor: 'rgba(203,168,98,0.14)',
    borderColor: 'rgba(203,168,98,0.5)',
  },
  badgeText: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 11,
    letterSpacing: 0.3,
  },
  hedge: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 17,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 8,
  },
  title: {
    fontFamily: 'Fraunces-Regular',
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
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 11.5,
    color: 'rgba(245,240,232,0.85)',
  },
  scroll: {maxHeight: 220},
  scrollContent: {paddingBottom: 4},
  body: {
    fontFamily: 'PlusJakartaSans-Regular',
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
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 10,
    letterSpacing: 1.2,
    color: AMBER,
    marginBottom: 5,
  },
  iconoText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 13,
    lineHeight: 19,
    color: 'rgba(245,240,232,0.82)',
  },
  minimalNote: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
  },
});

export default GroundedObjectCard;
