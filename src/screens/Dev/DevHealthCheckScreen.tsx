/**
 * DevHealthCheckScreen — dev-build-only workflow health board.
 *
 * Lists every user-facing workflow (src/constants/devHealthChecks.ts). Each
 * row deep-launches its flow; the tester cycles a persisted pass/fail status
 * and can attach a note. The header surfaces the crash journal: a banner if
 * the previous run died (including native crashes detected via the dirty-exit
 * breadcrumb) and a collapsible list of recorded errors. "Export" shares the
 * whole board as JSON for pasting into a bug report / chat.
 *
 * ADMIN-HARNESS (REMOVE AFTER KONARK): statically imported + registered in
 * MainNavigation so it ships in release for the admin harness. Access is gated at
 * render time by `__DEV__ || isAdminUser()` — both here and on the entry button
 * (DevHealthCheckButton) — so non-admins in release can never reach or render it.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Platform,
  Pressable,
  SectionList,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Activity,
  ChevronDown,
  ChevronUp,
  Play,
  RotateCcw,
  Share2,
  Skull,
  Trash2,
  X,
} from 'lucide-react-native';
import ARSafetyNotice from '../../components/ui/ARSafetyNotice';
import {
  HEALTH_CHECKS,
  type HealthCheckItem,
} from '../../constants/devHealthChecks';
import {
  useDevHealthStore,
  type HealthStatus,
} from '../../stores/devHealthStore';
import {
  clearCrashJournal,
  getCrashJournal,
  getLastRunDeath,
  type CrashEntry,
} from '../../services/crashJournal';
import { navigateSafe } from '../../navigation/navigationRef';
import { APP_CONFIG } from '../../core/config';
// ADMIN-HARNESS (REMOVE AFTER KONARK)
import { isAdminUser } from '../../shared/auth/isAdminUser';

const GOLD = '#CBA862';
const STATUS_META: Record<
  HealthStatus,
  { label: string; color: string; bg: string }
> = {
  untested: { label: 'UNTESTED', color: 'rgba(255,255,255,0.55)', bg: 'rgba(255,255,255,0.08)' },
  pass: { label: 'PASS', color: '#0A0A0A', bg: '#7BC47F' },
  fail: { label: 'FAIL', color: '#FFFFFF', bg: '#C4574B' },
};

const GROUP_ORDER: HealthCheckItem['group'][] = [
  'Entry',
  'Tabs',
  'Site & AR',
  'Commerce',
  'System',
];

const DevHealthCheckScreen: React.FC = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { results, cycleStatus, setNote, resetAll } = useDevHealthStore();
  const [preview, setPreview] = useState<'ar-safety-notice' | null>(null);
  const [journal, setJournal] = useState<CrashEntry[]>([]);
  const [journalOpen, setJournalOpen] = useState(false);

  const refreshJournal = useCallback(() => {
    void getCrashJournal().then(setJournal);
  }, []);

  useEffect(() => {
    refreshJournal();
    const unsub = navigation.addListener('focus', refreshJournal);
    return unsub;
  }, [navigation, refreshJournal]);

  const lastDeath = getLastRunDeath();

  const counts = HEALTH_CHECKS.reduce(
    (acc, item) => {
      const status = results[item.id]?.status ?? 'untested';
      acc[status] += 1;
      return acc;
    },
    { untested: 0, pass: 0, fail: 0 },
  );

  const exportResults = useCallback(() => {
    const payload = {
      exportedAt: new Date().toISOString(),
      appVersion: APP_CONFIG.APP.VERSION,
      platform: Platform.OS,
      counts,
      items: HEALTH_CHECKS.map(item => ({
        id: item.id,
        title: item.title,
        group: item.group,
        status: results[item.id]?.status ?? 'untested',
        note: results[item.id]?.note,
        updatedAt: results[item.id]?.updatedAt,
      })),
      crashJournal: journal,
    };
    void Share.share({ message: JSON.stringify(payload, null, 2) });
  }, [counts, journal, results]);

  const launch = useCallback((item: HealthCheckItem) => {
    const l = item.launch;
    if (l.kind === 'route') navigateSafe(l.route, l.params);
    else if (l.kind === 'action') void l.run();
    else if (l.kind === 'preview') setPreview(l.previewId);
  }, []);

  // ADMIN-HARNESS (REMOVE AFTER KONARK) — was `if (!__DEV__)`, which returned null
  // (white screen) in release. Now mirrors the entry button's gate so admin emails
  // can render it in release while non-admins still get null.
  if (!(__DEV__ || isAdminUser())) return null;

  const sections = GROUP_ORDER.map(group => ({
    title: group,
    data: HEALTH_CHECKS.filter(i => i.group === group),
  }));

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <View style={styles.titleRow}>
          <Activity size={18} color={GOLD} />
          <Text style={styles.title}>Workflow Health Check</Text>
        </View>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={10}
          style={styles.iconBtn}>
          <X size={18} color="#FFFFFF" />
        </Pressable>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={item => item.id}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={
          <View>
            {/* Summary + actions */}
            <View style={styles.summaryRow}>
              <Text style={styles.summaryText}>
                <Text style={{ color: '#7BC47F' }}>{counts.pass} pass</Text>
                {'   '}
                <Text style={{ color: '#C4574B' }}>{counts.fail} fail</Text>
                {'   '}
                <Text style={{ color: 'rgba(255,255,255,0.5)' }}>
                  {counts.untested} untested
                </Text>
              </Text>
              <View style={styles.summaryActions}>
                <Pressable onPress={exportResults} style={styles.actionBtn}>
                  <Share2 size={14} color={GOLD} />
                  <Text style={styles.actionText}>Export</Text>
                </Pressable>
                <Pressable onPress={resetAll} style={styles.actionBtn}>
                  <RotateCcw size={14} color="rgba(255,255,255,0.6)" />
                  <Text style={styles.actionText}>Reset</Text>
                </Pressable>
              </View>
            </View>

            {/* Previous-run death banner */}
            {lastDeath ? (
              <View style={styles.deathBanner}>
                <Skull size={16} color="#C4574B" />
                <Text style={styles.deathText}>
                  Previous run died on{' '}
                  <Text style={{ fontWeight: '700' }}>
                    {lastDeath.route ?? 'unknown screen'}
                  </Text>{' '}
                  ({lastDeath.kind}) at {lastDeath.ts.slice(11, 19)}
                </Text>
              </View>
            ) : null}

            {/* Crash journal */}
            <Pressable
              onPress={() => setJournalOpen(o => !o)}
              style={styles.journalHeader}>
              <Text style={styles.journalTitle}>
                Crash log ({journal.length})
              </Text>
              {journalOpen ? (
                <ChevronUp size={16} color="rgba(255,255,255,0.6)" />
              ) : (
                <ChevronDown size={16} color="rgba(255,255,255,0.6)" />
              )}
            </Pressable>
            {journalOpen ? (
              <View style={styles.journalBox}>
                {journal.length === 0 ? (
                  <Text style={styles.journalEmpty}>No recorded errors.</Text>
                ) : (
                  journal.slice(0, 20).map((e, i) => (
                    <View key={`${e.ts}-${i}`} style={styles.journalEntry}>
                      <Text style={styles.journalKind}>
                        {e.kind.toUpperCase()}
                        {e.route ? ` · ${e.route}` : ''} ·{' '}
                        {e.ts.replace('T', ' ').slice(5, 19)}
                      </Text>
                      <Text style={styles.journalMsg} numberOfLines={3}>
                        {e.message}
                      </Text>
                    </View>
                  ))
                )}
                {journal.length > 0 ? (
                  <Pressable
                    onPress={() => {
                      void clearCrashJournal().then(refreshJournal);
                    }}
                    style={[styles.actionBtn, { alignSelf: 'flex-start' }]}>
                    <Trash2 size={14} color="rgba(255,255,255,0.6)" />
                    <Text style={styles.actionText}>Clear log</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </View>
        }
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionTitle}>{section.title}</Text>
        )}
        renderItem={({ item }) => {
          const result = results[item.id];
          const status = result?.status ?? 'untested';
          const meta = STATUS_META[status];
          const launchLabel =
            item.launch.kind === 'action'
              ? item.launch.label
              : item.launch.kind === 'preview'
                ? 'Preview'
                : item.launch.kind === 'manual'
                  ? null
                  : 'Launch';
          return (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Pressable
                  onPress={() => cycleStatus(item.id)}
                  hitSlop={8}
                  style={[styles.statusPill, { backgroundColor: meta.bg }]}>
                  <Text style={[styles.statusText, { color: meta.color }]}>
                    {meta.label}
                  </Text>
                </Pressable>
              </View>
              {item.requires ? (
                <Text style={styles.requiresChip}>needs: {item.requires}</Text>
              ) : null}
              <Text style={styles.howTo}>{item.howToTest}</Text>
              <View style={styles.cardFooter}>
                {launchLabel ? (
                  <Pressable
                    onPress={() => launch(item)}
                    style={styles.launchBtn}>
                    <Play size={13} color="#0A0A0A" />
                    <Text style={styles.launchText}>{launchLabel}</Text>
                  </Pressable>
                ) : (
                  <Text style={styles.manualHint}>manual test</Text>
                )}
                <TextInput
                  style={styles.noteInput}
                  placeholder="note…"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  defaultValue={result?.note}
                  onEndEditing={e => setNote(item.id, e.nativeEvent.text)}
                />
              </View>
            </View>
          );
        }}
      />

      {/* ARSafetyNotice is a full-screen `flex: 1` surface (the host screens
          early-return it), so on this board it needs an absolute-fill wrapper to
          overlay the list instead of sharing space with it. */}
      {preview === 'ar-safety-notice' ? (
        <View style={StyleSheet.absoluteFill}>
          <ARSafetyNotice
            onAcknowledge={() => setPreview(null)}
            onExit={() => setPreview(null)}
          />
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A0A0A' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: '#F5F0E8', fontSize: 17, fontWeight: '700' },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  summaryText: { fontSize: 13, fontWeight: '600', color: '#FFFFFF' },
  summaryActions: { flexDirection: 'row', gap: 10 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  actionText: { color: 'rgba(255,255,255,0.75)', fontSize: 12 },
  deathBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(196,87,75,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(196,87,75,0.4)',
  },
  deathText: { flex: 1, color: '#F5D0CB', fontSize: 12, lineHeight: 17 },
  journalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  journalTitle: { color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '600' },
  journalBox: { paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
  journalEmpty: { color: 'rgba(255,255,255,0.4)', fontSize: 12 },
  journalEntry: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  journalKind: { color: GOLD, fontSize: 10, fontWeight: '700', marginBottom: 2 },
  journalMsg: { color: 'rgba(255,255,255,0.75)', fontSize: 11, lineHeight: 15 },
  sectionTitle: {
    color: GOLD,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 6,
  },
  card: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardTitle: { flex: 1, color: '#F5F0E8', fontSize: 14, fontWeight: '600' },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  statusText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  requiresChip: {
    alignSelf: 'flex-start',
    marginTop: 6,
    color: 'rgba(203,168,98,0.9)',
    fontSize: 10,
    fontWeight: '600',
  },
  howTo: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    lineHeight: 17,
  },
  cardFooter: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  launchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: GOLD,
    paddingHorizontal: 12,
    height: 34,
    borderRadius: 10,
  },
  launchText: { color: '#0A0A0A', fontSize: 12, fontWeight: '700' },
  manualHint: { color: 'rgba(255,255,255,0.35)', fontSize: 12 },
  noteInput: {
    flex: 1,
    height: 34,
    borderRadius: 10,
    paddingHorizontal: 10,
    color: '#FFFFFF',
    fontSize: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
});

export default DevHealthCheckScreen;
