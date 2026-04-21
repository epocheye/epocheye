import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Clock, MapPin } from 'lucide-react-native';
import {
  getCurrentVisit,
  getVisitHistory,
  type CurrentVisit,
  type HistoryResponse,
  type TourRow,
  type VisitRow,
} from '../../utils/api/visits';
import type { MainScreenProps } from '../../core/types/navigation.types';

type Props = MainScreenProps<'History'>;

interface Grouping {
  tour?: TourRow;
  visits: VisitRow[];
}

function formatClock(iso?: string | null): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso.slice(0, 16).replace('T', ' ');
  }
}

function formatExpiry(iso?: string | null): string | null {
  if (!iso) return null;
  try {
    const d = new Date(iso).getTime();
    const diffMs = d - Date.now();
    if (diffMs <= 0) return 'expired';
    const h = Math.floor(diffMs / 3_600_000);
    if (h >= 24) return `${Math.floor(h / 24)}d left`;
    if (h >= 1) return `${h}h left`;
    return `${Math.floor(diffMs / 60_000)}m left`;
  } catch {
    return null;
  }
}

const HistoryScreen: React.FC<Props> = ({ navigation }) => {
  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [current, setCurrent] = useState<CurrentVisit | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [hist, cur] = await Promise.all([getVisitHistory(), getCurrentVisit()]);
    if (hist.success) setHistory(hist.data);
    if (cur.success) setCurrent(cur.data);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const groupings = useMemo<Grouping[]>(() => {
    if (!history) return [];
    const toursById = new Map<string, TourRow>();
    for (const t of history.tours) toursById.set(t.id, t);
    const byTour = new Map<string, VisitRow[]>();
    const solo: VisitRow[] = [];
    for (const v of history.visits) {
      if (v.tour_id) {
        const arr = byTour.get(v.tour_id) || [];
        arr.push(v);
        byTour.set(v.tour_id, arr);
      } else {
        solo.push(v);
      }
    }
    const out: Grouping[] = [];
    for (const [tourId, visits] of byTour.entries()) {
      out.push({ tour: toursById.get(tourId), visits });
    }
    for (const v of solo) {
      out.push({ visits: [v] });
    }
    out.sort((a, b) => {
      const ta = a.visits[0]?.arrived_at || a.tour?.purchased_at || '';
      const tb = b.visits[0]?.arrived_at || b.tour?.purchased_at || '';
      return tb.localeCompare(ta);
    });
    return out;
  }, [history]);

  return (
    <SafeAreaView className="flex-1 bg-ink-deep">
      <StatusBar barStyle="light-content" />
      <View className="flex-row items-center px-5 py-3 border-b border-white/5">
        <TouchableOpacity onPress={() => navigation.goBack()} className="p-1">
          <ArrowLeft color="#F5F0E8" size={22} />
        </TouchableOpacity>
        <Text className="ml-3 text-parchment text-lg font-['MontserratAlternates-SemiBold']">
          Your Journey
        </Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#C9A84C" />
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingVertical: 16, paddingHorizontal: 20 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#C9A84C" />
          }
        >
          {current?.active && current.place_name ? (
            <View className="rounded-xl border border-[rgba(201,168,76,0.4)] bg-[rgba(201,168,76,0.08)] px-4 py-3 mb-5">
              <Text className="text-[10px] uppercase tracking-wider text-gold-400/70 font-['MontserratAlternates-SemiBold']">
                Now at
              </Text>
              <Text className="text-parchment text-base font-['MontserratAlternates-SemiBold'] mt-1">
                {current.place_name}
              </Text>
              {current.pass_expires_at && (
                <Text className="text-parchment-muted text-xs mt-1 font-['MontserratAlternates-Regular']">
                  Pass {formatExpiry(current.pass_expires_at)}
                </Text>
              )}
            </View>
          ) : null}

          {groupings.length === 0 ? (
            <View className="items-center py-20">
              <MapPin color="#6B6357" size={32} />
              <Text className="text-parchment-muted text-sm mt-3 font-['MontserratAlternates-Regular']">
                No visits yet. Activate an Explorer Pass and start exploring.
              </Text>
            </View>
          ) : (
            groupings.map((g, idx) => (
              <View key={g.tour?.id || g.visits[0]?.id || idx} className="mb-4">
                {g.tour && (
                  <View className="mb-2 flex-row items-center justify-between">
                    <Text className="text-parchment-muted text-xs uppercase tracking-wider font-['MontserratAlternates-SemiBold']">
                      Tour · {g.tour.place_ids.length} places
                    </Text>
                    <Text
                      className={`text-[10px] font-['MontserratAlternates-SemiBold'] ${
                        g.tour.active ? 'text-emerald-300' : 'text-parchment-muted'
                      }`}
                    >
                      {g.tour.active ? formatExpiry(g.tour.expires_at) || 'active' : 'expired'}
                    </Text>
                  </View>
                )}
                <View className="rounded-xl bg-surface-2 border border-white/[0.06] overflow-hidden">
                  {g.visits.map((v, i) => (
                    <View
                      key={v.id}
                      className={`px-4 py-3 ${
                        i < g.visits.length - 1 ? 'border-b border-white/[0.04]' : ''
                      }`}
                    >
                      <View className="flex-row items-center justify-between">
                        <Text className="text-parchment text-sm flex-1 pr-2 font-['MontserratAlternates-SemiBold']">
                          {v.place_name}
                        </Text>
                        <View
                          className={`px-2 py-0.5 rounded-full border ${
                            v.pass_active
                              ? 'border-emerald-400/40 bg-emerald-400/10'
                              : 'border-white/10 bg-white/[0.04]'
                          }`}
                        >
                          <Text
                            className={`text-[9px] uppercase tracking-wider font-['MontserratAlternates-SemiBold'] ${
                              v.pass_active ? 'text-emerald-300' : 'text-parchment-muted'
                            }`}
                          >
                            {v.pass_active ? 'Pass active' : 'Pass expired'}
                          </Text>
                        </View>
                      </View>
                      <View className="flex-row items-center mt-1.5">
                        <Clock color="#6B6357" size={12} />
                        <Text className="text-parchment-muted text-xs ml-1.5 font-['MontserratAlternates-Regular']">
                          {formatClock(v.arrived_at)}
                          {v.left_at ? ` → ${formatClock(v.left_at)}` : ' · ongoing'}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

export default HistoryScreen;
