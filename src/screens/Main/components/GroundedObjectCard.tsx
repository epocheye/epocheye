/**
 * GroundedObjectCard — the data card for a detected artifact.
 *
 * Renders the DB record resolved by class_id as a single, uniform card. The
 * underlying confidence/source (grounded vs inferred) is tracked in the backend
 * only and is intentionally NOT surfaced to the user — no badges, hedges, or
 * "Likely:" prefixes. This card never shares the screen with the fallback card.
 */

import React, {useState} from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import type {ContextLayer, ObjectCard} from '../../../services/detectorResolver';
import ContextLayerSlider from './ContextLayerSlider';

const AMBER = '#CBA862';

interface Props {
  card: ObjectCard;
  /** When true the record had no narrative — show a minimal label only. */
  minimal?: boolean;
}

const GroundedObjectCard: React.FC<Props> = ({card, minimal}) => {
  const meta = [card.period, card.dynasty, card.material, card.origin]
    .map(s => (s ?? '').trim())
    .filter(Boolean);

  // The slider only appears for records with 2+ layers; minimal/no-layer records
  // (and the fallback, which is a different component) get the plain card.
  const layers =
    !minimal && Array.isArray(card.context_layers) && card.context_layers.length >= 2
      ? card.context_layers
      : null;

  if (layers) {
    return <LayeredObjectCard card={card} meta={meta} layers={layers} />;
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{card.display_name}</Text>

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
 * LayeredObjectCard — the card with the timeline/context slider. The body
 * cross-fades between the layer texts as the shared `progress` value scrubs.
 */
const LayeredObjectCard: React.FC<{
  card: ObjectCard;
  meta: string[];
  layers: ContextLayer[];
}> = ({card, meta, layers}) => {
  const progress = useSharedValue(0);
  const [, setActiveIndex] = useState(0);

  return (
    <View style={[styles.card, styles.cardLayered]}>
      <Text style={styles.title}>{card.display_name}</Text>

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
