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

  const stats = useMemo(() => {
    const visits = history?.visits ?? [];
    return {visits: visits.length, tours: history?.tours.length ?? 0, xp: visits.length * 50};
  }, [history]);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <StatusBar barStyle="light-content" />
      <View className="flex-row items-center px-5 py-3 border-b border-white/5">
        <TouchableOpacity onPress={() => navigation.goBack()} className="p-1">
          <ArrowLeft color="#F5F0E8" size={22} />
        </TouchableOpacity>
        <Text className="ml-3 text-parchment text-2xl font-display">
          Your journey
        </Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#CBA862" />
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingVertical: 16, paddingHorizontal: 20 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#CBA862" />
          }
        >
          {groupings.length > 0 ? (
            <View className="flex-row items-center justify-between rounded-2xl border border-white/8 bg-card px-5 py-5 mb-6">
              <View className="items-center">
                <Text className="text-parchment text-2xl font-display leading-none">{stats.visits}</Text>
                <Text className="text-parchment-dim text-[10px] uppercase tracking-wider mt-1 font-ui-medium">Visits</Text>
              </View>
              <View className="w-px h-9 bg-white/10" />
              <View className="items-center">
                <Text className="text-parchment text-2xl font-display leading-none">{stats.tours}</Text>
                <Text className="text-parchment-dim text-[10px] uppercase tracking-wider mt-1 font-ui-medium">Tours</Text>
              </View>
              <View className="w-px h-9 bg-white/10" />
              <View className="items-center">
                <Text className="text-brand-gold text-2xl font-display leading-none">{stats.xp}</Text>
                <Text className="text-parchment-dim text-[10px] uppercase tracking-wider mt-1 font-ui-medium">XP earned</Text>
              </View>
            </View>
          ) : null}

          {current?.active && current.place_name ? (
            <View className="rounded-xl border border-[rgba(203,168,98,0.4)] bg-[rgba(203,168,98,0.08)] px-4 py-3 mb-5">
              <Text className="text-[10px] uppercase tracking-wider text-gold-400/70 font-ui-medium">
                Now at
              </Text>
              <Text className="text-parchment text-base font-ui-medium mt-1">
                {current.place_name}
              </Text>
              {current.pass_expires_at && (
                <Text className="text-parchment-muted text-xs mt-1 font-ui">
                  Pass {formatExpiry(current.pass_expires_at)}
                </Text>
              )}
            </View>
          ) : null}

          {groupings.length === 0 ? (
            <View className="items-center py-20">
              <MapPin color="#6B6357" size={32} />
              <Text className="text-parchment-muted text-sm mt-3 font-ui">
                No visits yet. Activate a Passport and start exploring.
              </Text>
            </View>
          ) : (
            groupings.map((g, idx) => (
              <View key={g.tour?.id || g.visits[0]?.id || idx} className="mb-4">
                {g.tour && (
                  <View className="mb-2 flex-row items-center justify-between">
                    <Text className="text-parchment-muted text-xs uppercase tracking-wider font-ui-medium">
                      Tour · {g.tour.place_ids.length} places
                    </Text>
                    <Text
                      className={`text-[10px] font-ui-medium ${
                        g.tour.active ? 'text-emerald-300' : 'text-parchment-muted'
                      }`}
                    >
                      {g.tour.active ? formatExpiry(g.tour.expires_at) || 'active' : 'expired'}
                    </Text>
                  </View>
                )}
                <View className="rounded-2xl bg-card border border-white/8 overflow-hidden">
                  {g.visits.map((v, i) => (
                    <View
                      key={v.id}
                      className={`px-4 py-3 ${
                        i < g.visits.length - 1 ? 'border-b border-white/[0.04]' : ''
                      }`}
                    >
                      <View className="flex-row items-center justify-between">
                        <Text className="text-parchment text-sm flex-1 pr-2 font-ui-medium">
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
                            className={`text-[9px] uppercase tracking-wider font-ui-medium ${
                              v.pass_active ? 'text-emerald-300' : 'text-parchment-muted'
                            }`}
                          >
                            {v.pass_active ? 'Pass active' : 'Pass expired'}
                          </Text>
                        </View>
                      </View>
                      <View className="flex-row items-center mt-1.5">
                        <Clock color="#6B6357" size={12} />
                        <Text className="text-parchment-muted text-xs ml-1.5 font-ui">
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
