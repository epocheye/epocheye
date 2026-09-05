/**
 * Everything the audio guide is not primarily about.
 *
 * WHAT MOVED IN HERE, AND WHY. The guide's whole default state used to be this:
 * four zone headings, eight stop rows, three persona chips and a transcript,
 * with nothing playing and the player mounted below all of it. The screen is
 * now the CURRENT STOP — where you are, what to listen for, one large play
 * control — and this is the rest of it, one tap away.
 *
 * Nothing was deleted by moving it. The stop list is still the best thing that
 * screen ever did: it is how a visitor jumps out of order, back to the room
 * they liked. The transcript is the only path for someone who cannot hear the
 * clip. "See it restored" is an evidence path. They are all still here.
 *
 * IT ALSO HOLDS THE PLAYER. The single <AudioPlayer/> is passed in and rendered
 * at the top, exactly as the magic window does it: the full transport — scrub,
 * speed, skip 15 s — lives in the sheet, and the screen keeps only play/pause,
 * because that is the one control a visitor needs without looking. The sheet is
 * never unmounted (see DetailSheet), so the clip survives every open and close.
 */

import React from 'react';
import {Pressable, StyleSheet, Switch, Text, View} from 'react-native';
import {Play} from 'lucide-react-native';
import {useTranslation} from 'react-i18next';

import DetailSheet, {SHEET} from '../../components/ui/DetailSheet';
import StopVisual from './StopVisual';
import EvidenceNote from './EvidenceNote';
import type {SubjectImage} from '../../shared/hooks/useSubjectMedia';
import {AUDIO_PERSONAS} from '../../utils/api/audio';
import type {AudioStop} from '../../utils/api/audio';
import type {NarrationPersona} from '../../stores/museumPrefsStore';
import {
  COLORS,
  FONTS,
  FONT_SIZES,
  RADIUS,
  SPACING,
} from '../../core/constants/theme';
import {
  formatClipDuration,
  formatZoneLabel,
  hasRestoration,
  isPlayable,
  PERSONA_LABEL_KEY,
} from '../../shared/utils/audioGuide';
import type {AudioZoneGroup} from '../../shared/utils/audioGuide';

export interface AudioGuideSheetProps {
  open: boolean;
  onClose: () => void;
  /** The stops, grouped by zone, in the server's walking order. */
  groups: AudioZoneGroup[];
  /** The stop the guide is on, by key — see the screen for why it is a key. */
  selectedKey: string | null;
  selected: AudioStop | null;
  onSelectStop: (stop: AudioStop) => void;
  /** Resolved restoration image URL, when this stop has one. */
  restorationUri: string | null;
  onOpenRestoration: () => void;
  /**
   * The stop's stills, resolved. The screen shows ONE of these in its hero
   * band; this is where the whole set lives, with the titles and captions the
   * hero has no room for — and, on `what_the_board_says`, the second board.
   */
  images: SubjectImage[];
  persona: NarrationPersona;
  onSelectPersona: (persona: NarrationPersona) => void;
  autoAdvance: boolean;
  onAutoAdvanceChange: (on: boolean) => void;
  /** The single mounted <AudioPlayer/>. */
  player?: React.ReactNode;
}

const AudioGuideSheet: React.FC<AudioGuideSheetProps> = ({
  open,
  onClose,
  groups,
  selectedKey,
  selected,
  onSelectStop,
  restorationUri,
  onOpenRestoration,
  images,
  persona,
  onSelectPersona,
  autoAdvance,
  onAutoAdvanceChange,
  player,
}) => {
  const {t} = useTranslation();

  return (
    <DetailSheet
      open={open}
      onClose={onClose}
      closeLabel={t('audioGuide.closeStops')}>
      {player ? <View style={SHEET.block}>{player}</View> : null}

      {/* THE PICTURES, AND THE RESTORED VIEW.
          This block used to be a lone button that opened a camera — the only
          route to the one image this venue had. It is now the full set: every
          still for the stop with its title, caption, disclosure and credit,
          and the restored view drawn rather than merely promised, with the
          camera wipe still offered underneath it. */}
      {images.length > 0 || (selected && hasRestoration(selected) && restorationUri) ? (
        <View style={SHEET.block}>
          <StopVisual
            images={images}
            restorationUri={
              selected && hasRestoration(selected) ? restorationUri : null
            }
            restorationCaption={selected?.clip?.restoration_caption}
            onOpenRestoration={onOpenRestoration}
          />
        </View>
      ) : null}

      {/* THE STOPS. The old screen's entire default state, intact, doing the
          one thing it was always good at: jumping out of order. */}
      {/* GUARDED AT THE LIST, NOT AT THE BUTTON.
          This block used to render its heading unconditionally and then map
          over `groups`. With no groups that is a gold "All stops" over nothing
          — and the only thing preventing it was that AudioGuideScreen hides the
          control that opens this sheet whenever it is showing a fallback. That
          is a coincidence of two files agreeing, not a guarantee: the sheet is
          ALWAYS mounted (the player lives in it), so anything that empties
          `groups` while it is open puts the blank straight on screen. A list
          says its own empty state. */}
      <View style={SHEET.block}>
        <Text style={SHEET.heading}>{t('audioGuide.allStops')}</Text>
        {groups.length === 0 ? (
          <Text style={SHEET.meta}>{t('audioGuide.noStops')}</Text>
        ) : null}
        {groups.map(group => (
          <View key={group.zone ?? '__ungrouped__'} style={styles.group}>
            {group.zone ? (
              <Text style={styles.zoneHeader}>
                {formatZoneLabel(group.zone)}
              </Text>
            ) : null}
            {group.stops.map(stop => {
              const playable = isPlayable(stop);
              const active = stop.stop_key === selectedKey;
              return (
                <Pressable
                  key={stop.stop_key}
                  onPress={() => onSelectStop(stop)}
                  disabled={!playable}
                  accessibilityRole="button"
                  accessibilityState={{disabled: !playable, selected: active}}
                  accessibilityLabel={stop.title}
                  style={[styles.row, active && styles.rowActive]}>
                  <Play
                    size={14}
                    color={playable ? COLORS.gold : COLORS.textTertiary}
                    fill={active ? COLORS.gold : 'transparent'}
                  />
                  <View style={styles.rowText}>
                    <Text
                      style={[styles.rowTitle, !playable && styles.rowDisabled]}
                      numberOfLines={2}>
                      {stop.title}
                    </Text>
                    {/* BEFORE THE TAP, WHICH IS THE WHOLE POINT. This list is
                        how a visitor chooses a stop, so it is the one surface
                        where "which parts of this building are known" can be
                        answered without listening to anything. Renders nothing
                        on the five CONFIRMED stops. */}
                    <EvidenceNote tier={stop.clip?.tier} variant="mark" />
                  </View>
                  <Text style={styles.rowMeta}>
                    {playable
                      ? formatClipDuration(stop.clip?.duration_ms)
                      : t('audioGuide.notRecorded')}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>

      {/* THE WORDS. Available, not default — the visitor is meant to be looking
          at the building, not reading along with it. */}
      {selected?.clip?.transcript ? (
        <View style={SHEET.block}>
          <Text style={SHEET.heading}>{t('audioGuide.transcriptTitle')}</Text>
          <Text style={SHEET.text}>{selected.clip.transcript}</Text>
        </View>
      ) : null}

      <View style={SHEET.block}>
        <Text style={SHEET.heading}>{t('audioGuide.personaLabel')}</Text>
        <View
          style={styles.personaRow}
          accessibilityRole="radiogroup"
          accessibilityLabel={t('audioGuide.personaLabel')}>
          {AUDIO_PERSONAS.map(p => {
            const active = p === persona;
            return (
              <Pressable
                key={p}
                onPress={() => onSelectPersona(p)}
                accessibilityRole="radio"
                accessibilityState={{selected: active}}
                style={[styles.personaChip, active && styles.personaChipActive]}>
                <Text
                  style={[
                    styles.personaText,
                    active && styles.personaTextActive,
                  ]}
                  numberOfLines={1}>
                  {t(PERSONA_LABEL_KEY[p])}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={SHEET.block}>
        <View style={styles.switchRow}>
          <View style={styles.switchText}>
            <Text style={styles.switchLabel}>
              {t('audioGuide.autoAdvance')}
            </Text>
            <Text style={SHEET.meta}>{t('audioGuide.autoAdvanceHint')}</Text>
          </View>
          <Switch
            value={autoAdvance}
            onValueChange={onAutoAdvanceChange}
            accessibilityLabel={t('audioGuide.autoAdvance')}
            trackColor={{false: COLORS.border, true: COLORS.amberSubtle}}
            thumbColor={autoAdvance ? COLORS.amber : COLORS.textMuted}
          />
        </View>
      </View>
    </DetailSheet>
  );
};

const styles = StyleSheet.create({
  group: {marginBottom: SPACING.md},
  zoneHeader: {
    color: COLORS.textTertiary,
    fontFamily: FONTS.ui,
    fontSize: FONT_SIZES.caption,
    letterSpacing: 0.6,
    marginBottom: SPACING.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
  },
  rowActive: {backgroundColor: COLORS.amberSubtle},
  rowText: {flex: 1, gap: 2},
  rowTitle: {
    color: COLORS.textPrimary,
    fontFamily: FONTS.ui,
    fontSize: FONT_SIZES.small,
  },
  rowDisabled: {color: COLORS.textTertiary},
  rowMeta: {
    color: COLORS.textTertiary,
    fontFamily: FONTS.ui,
    fontSize: FONT_SIZES.caption,
  },
  personaRow: {flexDirection: 'row', gap: SPACING.sm},
  personaChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  personaChipActive: {
    borderColor: COLORS.amber,
    backgroundColor: COLORS.amberSubtle,
  },
  personaText: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.ui,
    fontSize: FONT_SIZES.caption,
  },
  personaTextActive: {color: COLORS.amber},
  switchRow: {flexDirection: 'row', alignItems: 'center', gap: SPACING.md},
  switchText: {flex: 1},
  switchLabel: {
    color: COLORS.textPrimary,
    fontFamily: FONTS.ui,
    fontSize: FONT_SIZES.small,
    marginBottom: 2,
  },
});

export default AudioGuideSheet;
