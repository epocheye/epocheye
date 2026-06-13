import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  AppState,
  Image,
  Linking,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import MapView, {Marker, PROVIDER_GOOGLE, type Region} from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';
import {GOOGLE_MAPS_API_KEY} from '@env';
import {Bell, Menu, Navigation, Search, X} from 'lucide-react-native';
import mapStyle from '../../content/mapstyle.json';
import {COLORS, FONTS} from '../../core/constants/theme';
import {ROUTES} from '../../core/constants/routes';
import {usePlaces} from '../../context';
import {PermissionService} from '../../shared/services/permission.service';
import {resolveSiteImageSource} from '../../shared/utils/localSiteImages';
import {getSites, searchPlaces, type SiteDetail} from '../../utils/api/places';
import {useNotificationsStore} from '../../stores/notificationsStore';
import {reverseGeocode, reverseGeocodeLabel} from '../../utils/api/geo';
import {useVenueGate} from '../../shared/hooks/useVenueGate';
import {getNearestZone} from '../../services/geofenceService';
import type {HeritageZone} from '../../core/config/geofence.types';
import type {Place} from '../../utils/api/places/types';
import type {PlaceNavParam} from '../../core/types/navigation.types';
import UnavailableSiteCard from './components/UnavailableSiteCard';
import OnboardingTooltips from '../../components/OnboardingTooltips';
import NotificationsModal from '../../components/NotificationsModal';
import type {TabScreenProps} from '../../core/types/navigation.types';
import {useDistanceToSite} from '../../shared/hooks/useDistanceToSite';
import {useActiveMonument} from '../../shared/hooks/useActiveMonument';
import PreArrivalCard from './components/PreArrivalCard';
import ApproachCard from './components/ApproachCard';
import ArrivalBanner from './components/ArrivalBanner';

type Props = TabScreenProps<'Home'>;

// Curated sites within this radius of the user are pinned on the map. Keeps the
// map focused on the visitor's city (e.g. Kolkata → Victoria Memorial + Indian
// Museum) without dropping a pin for far-away sites (e.g. Konark in Odisha).
const CURATED_NEARBY_RADIUS_M = 150000;

const DEFAULT_REGION: Region = {
  latitude: 20.5937,
  longitude: 78.9629,
  latitudeDelta: 12,
  longitudeDelta: 12,
};

function deriveLocationTitle(places: Place[]): string {
  const nearest = places[0];
  if (!nearest) return 'Heritage near you';
  const city = nearest.city?.trim();
  const country = nearest.country?.trim();
  if (city && country) return `${city}, ${country}`;
  if (city) return city;
  if (country) return country;
  return 'Heritage near you';
}

function formatVenueDistance(meters: number): string {
  if (meters < 950) {
    return `${Math.max(1, Math.round(meters / 10) * 10)} m away`;
  }
  return `${(meters / 1000).toFixed(meters < 9500 ? 1 : 0)} km away`;
}

function openVenueDirections(zone: HeritageZone): void {
  const url = `https://www.google.com/maps/dir/?api=1&destination=${zone.lat},${zone.lon}`;
  void Linking.openURL(url).catch(() => undefined);
}

/** A place currently focused on the map (tapped marker or search result). */
interface ActivePlace {
  key: string;
  name: string;
  lat: number;
  lon: number;
  imageUrl?: string;
  categories: string[];
  source: 'nearby' | 'search';
}

// Geoapify is already scoped to tourism/religion, but enrichment can attach a
// few non-heritage tags. We keep anything with a heritage signal and only drop
// places that look clearly non-heritage (food, retail, lodging, transit, ...).
const HERITAGE_PREFIXES = [
  'tourism',
  'religion',
  'heritage',
  'historic',
  'building.historic',
  'man_made',
];
const NON_HERITAGE_PREFIXES = [
  'catering',
  'commercial',
  'accommodation',
  'transport',
  'service',
  'office',
  'healthcare',
  'education',
  'parking',
];

function isHeritagePlace(place: Place): boolean {
  const cats = (place.categories ?? []).map(c => c.toLowerCase());
  if (cats.length === 0) return true;
  if (cats.some(c => HERITAGE_PREFIXES.some(p => c.startsWith(p)))) return true;
  return !cats.some(c => NON_HERITAGE_PREFIXES.some(p => c.startsWith(p)));
}

function distanceMeters(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const R = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLng - aLng) * Math.PI) / 180;
  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Returns the curated Epocheye site matching a focused place, or null when the
 * place is not (yet) supported. Matches by proximity (<500 m) or by name, since
 * Geoapify place ids do not line up with our stored google_place_id.
 */
function matchSupportedSite(
  place: {lat: number; lon: number; name: string},
  sites: SiteDetail[],
): SiteDetail | null {
  const pName = normalizeName(place.name);
  for (const s of sites) {
    if (typeof s.latitude === 'number' && typeof s.longitude === 'number') {
      if (distanceMeters(place.lat, place.lon, s.latitude, s.longitude) < 500) {
        return s;
      }
    }
    const sName = normalizeName(s.name);
    if (
      pName &&
      sName &&
      (pName === sName || pName.includes(sName) || sName.includes(pName))
    ) {
      return s;
    }
  }
  return null;
}

function siteToNavParam(site: SiteDetail): PlaceNavParam {
  return {
    id: site.slug ?? site.id,
    name: site.name,
    lat: site.latitude,
    lon: site.longitude,
    city: site.city,
    country: site.country,
    formatted: site.short_description,
    heroImages: site.hero_image_url ? [site.hero_image_url] : undefined,
  };
}

const Home: React.FC<Props> = ({navigation}) => {
  const insets = useSafeAreaInsets();
  const nearbyPlaces = usePlaces(state => state.nearbyPlaces);
  const currentLocation = usePlaces(state => state.currentLocation);
  const ensureLocationTracking = usePlaces(
    state => state.ensureLocationTracking,
  );

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [locationDenied, setLocationDenied] = useState(false);
  const [arrivalDismissed, setArrivalDismissed] = useState(false);
  const [supportedSites, setSupportedSites] = useState<SiteDetail[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<ActivePlace | null>(null);
  const [routeActive, setRouteActive] = useState(false);
  const [searching, setSearching] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  // Unread badge is driven by the shared store so live FCM/WS events update it
  // without reopening the modal.
  const unreadCount = useNotificationsStore(s => s.unreadCount);
  const refreshUnread = useNotificationsStore(s => s.refreshUnread);
  const setUnreadCount = useNotificationsStore(s => s.setUnreadCount);
  const mapRef = useRef<MapView>(null);

  const active = useActiveMonument();
  const activeSite = active.site;

  useEffect(() => {
    void ensureLocationTracking();
  }, [ensureLocationTracking]);

  // Curated Epocheye sites — used to decide whether a tapped/searched place has
  // a real experience or should show the "not available here" card.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await getSites();
      if (!cancelled && result.success) setSupportedSites(result.data);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Notification unread badge — refreshed on mount and whenever Home regains
  // focus (e.g. after returning from the Notifications screen). Live updates
  // arrive separately via the notifications store (FCM/WS).
  useEffect(() => {
    void refreshUnread();
    const unsub = navigation.addListener('focus', () => void refreshUnread());
    return unsub;
  }, [navigation, refreshUnread]);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const granted = await PermissionService.check('location');
      if (!cancelled) setLocationDenied(!granted);
    };
    void refresh();
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') void refresh();
    });
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);

  const userLatLng = useMemo(
    () =>
      currentLocation
        ? {lat: currentLocation.latitude, lng: currentLocation.longitude}
        : null,
    [currentLocation],
  );

  const activeCoords = useMemo(
    () =>
      activeSite &&
      typeof activeSite.latitude === 'number' &&
      typeof activeSite.longitude === 'number'
        ? {lat: activeSite.latitude, lng: activeSite.longitude}
        : {lat: 0, lng: 0},
    [activeSite],
  );

  const {distanceKm, etaMinutes} = useDistanceToSite(userLatLng, activeCoords);

  const isAtSite = active.isAtSite;
  const isPreArrival =
    !isAtSite && distanceKm !== null && distanceKm >= 1;
  const isApproaching =
    !isAtSite && distanceKm !== null && distanceKm < 1;

  const visiblePreArrival =
    !isAtSite && (locationDenied || isPreArrival);
  const visibleApproach =
    !isAtSite && isApproaching && !locationDenied;
  const visibleArrival = isAtSite && !arrivalDismissed;

  const hasAccess = active.hasAccess;

  useEffect(() => {
    if (!isAtSite && arrivalDismissed) setArrivalDismissed(false);
  }, [isAtSite, arrivalDismissed]);

  const handleArrivalDismiss = useCallback(
    () => setArrivalDismissed(true),
    [],
  );

  const allPlaces = useMemo(
    () => (Array.isArray(nearbyPlaces) ? nearbyPlaces : []),
    [nearbyPlaces],
  );

  const filteredPlaces = useMemo(() => {
    const base = allPlaces.filter(isHeritagePlace);
    const q = searchText.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      p =>
        p.name.toLowerCase().includes(q) ||
        p.city?.toLowerCase().includes(q) ||
        p.country?.toLowerCase().includes(q),
    );
  }, [allPlaces, searchText]);

  const featuredPlace: Place | null = filteredPlaces[0] ?? null;

  // Curated Epocheye sites to pin on the map: those with coordinates, filtered
  // to the user's vicinity when we have a location (all of them otherwise, so
  // the map isn't empty before location permission is granted).
  const nearbyCuratedSites = useMemo(() => {
    const withCoords = supportedSites.filter(
      s => typeof s.latitude === 'number' && typeof s.longitude === 'number',
    );
    if (!userLatLng) return withCoords;
    return withCoords.filter(
      s =>
        distanceMeters(
          userLatLng.lat,
          userLatLng.lng,
          s.latitude as number,
          s.longitude as number,
        ) <= CURATED_NEARBY_RADIUS_M,
    );
  }, [supportedSites, userLatLng]);

  const initialRegion = useMemo<Region>(() => {
    if (currentLocation) {
      return {
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        latitudeDelta: 0.4,
        longitudeDelta: 0.4,
      };
    }
    if (featuredPlace) {
      return {
        latitude: featuredPlace.lat,
        longitude: featuredPlace.lon,
        latitudeDelta: 0.4,
        longitudeDelta: 0.4,
      };
    }
    return DEFAULT_REGION;
  }, [currentLocation, featuredPlace]);

  // Reverse-geocode the device location to a city/locality for the header. The
  // geo client caches by coarse coordinate, so re-running on a coordinate that
  // rounds to the same ~110 m bucket is a no-op (no network, no churn).
  const [geoLabel, setGeoLabel] = useState('');
  const coarseLoc = useMemo(
    () =>
      currentLocation
        ? `${currentLocation.latitude.toFixed(3)},${currentLocation.longitude.toFixed(3)}`
        : null,
    [currentLocation],
  );
  useEffect(() => {
    if (!currentLocation) return;
    let cancelled = false;
    void (async () => {
      const res = await reverseGeocode(
        currentLocation.latitude,
        currentLocation.longitude,
      );
      if (!cancelled && res.success) {
        const label = reverseGeocodeLabel(res.data);
        if (label) setGeoLabel(label);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coarseLoc]);

  const locationTitle = geoLabel || deriveLocationTitle(allPlaces);

  // Nearest Epocheye venue + the in-venue signal, for the persistent "go to your
  // nearest site" nudge (shown only when the user isn't already inside a venue).
  const {inVenue} = useVenueGate();
  const nearestVenue = useMemo(
    () =>
      currentLocation
        ? getNearestZone(currentLocation.latitude, currentLocation.longitude)
        : null,
    [currentLocation],
  );

  // Recenter the map onto the user the first time GPS resolves. `initialRegion`
  // only applies on first paint, so without this the map stays on the all-India
  // default whenever the fix arrives after mount. Guarded to fire once so it
  // never fights manual panning.
  const hasCenteredRef = useRef(false);
  useEffect(() => {
    if (hasCenteredRef.current || !currentLocation) return;
    hasCenteredRef.current = true;
    mapRef.current?.animateToRegion(
      {
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        latitudeDelta: 0.4,
        longitudeDelta: 0.4,
      },
      600,
    );
  }, [currentLocation]);

  const handleViewSupported = useCallback(
    (site: SiteDetail) => {
      navigation.navigate(ROUTES.MAIN.SITE_DETAIL, {
        site: siteToNavParam(site),
      });
    },
    [navigation],
  );

  const handleSelectNearby = useCallback((place: Place) => {
    setSelectedPlace({
      key: place.id,
      name: place.name,
      lat: place.lat,
      lon: place.lon,
      imageUrl: place.image_urls?.[0],
      categories: place.categories ?? [],
      source: 'nearby',
    });
    mapRef.current?.animateToRegion(
      {
        latitude: place.lat,
        longitude: place.lon,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      },
      500,
    );
  }, []);

  // Tapping a curated pin selects it into the bottom card (same flow as a
  // nearby place) rather than jumping straight to SiteDetail — so each Kolkata
  // site (Victoria, Indian Museum) surfaces its own "View Details" card and the
  // two are freely switchable. matchSupportedSite then re-matches it by name/
  // proximity so the curated card variant renders.
  const handleSelectCurated = useCallback((site: SiteDetail) => {
    if (typeof site.latitude !== 'number' || typeof site.longitude !== 'number') {
      return;
    }
    setSelectedPlace({
      key: `curated-${site.id}`,
      name: site.name,
      lat: site.latitude,
      lon: site.longitude,
      imageUrl: site.hero_image_url,
      categories: [],
      source: 'nearby',
    });
    mapRef.current?.animateToRegion(
      {
        latitude: site.latitude,
        longitude: site.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      },
      500,
    );
  }, []);

  const handleSearchSubmit = useCallback(async () => {
    const q = searchText.trim();
    if (!q) return;
    setSearching(true);
    const result = await searchPlaces(q);
    setSearching(false);
    if (!result.success || result.data.length === 0) return;
    const top = result.data[0];
    setSelectedPlace({
      key: `search-${top.place_id}`,
      name: top.name,
      lat: top.lat,
      lon: top.lng,
      categories: top.place_type ? [top.place_type] : [],
      source: 'search',
    });
    mapRef.current?.animateToRegion(
      {
        latitude: top.lat,
        longitude: top.lng,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      },
      600,
    );
  }, [searchText]);

  const fitUserAndActive = useCallback(() => {
    const lat = activeSite?.latitude;
    const lng = activeSite?.longitude;
    if (!userLatLng || typeof lat !== 'number' || typeof lng !== 'number') {
      return;
    }
    mapRef.current?.fitToCoordinates(
      [
        {latitude: userLatLng.lat, longitude: userLatLng.lng},
        {latitude: lat, longitude: lng},
      ],
      {
        edgePadding: {top: 220, bottom: 240, left: 60, right: 60},
        animated: true,
      },
    );
  }, [userLatLng, activeSite]);

  // Draw the in-app driving route when we have a user location; otherwise just
  // frame the destination. The route polyline is rendered by <MapViewDirections>
  // and needs the Directions API enabled on the Maps key — on error we fall
  // back to fitting both points in view (see onError below).
  const handleShowDirections = useCallback(() => {
    const lat = activeSite?.latitude;
    const lng = activeSite?.longitude;
    if (typeof lat !== 'number' || typeof lng !== 'number') return;
    if (userLatLng) {
      setRouteActive(true);
      fitUserAndActive();
    } else {
      mapRef.current?.animateToRegion(
        {latitude: lat, longitude: lng, latitudeDelta: 0.05, longitudeDelta: 0.05},
        500,
      );
    }
  }, [activeSite, userLatLng, fitUserAndActive]);

  const dismissSelection = useCallback(() => setSelectedPlace(null), []);

  const activePlace = useMemo<ActivePlace | null>(() => {
    if (selectedPlace) return selectedPlace;
    if (!featuredPlace) return null;
    return {
      key: featuredPlace.id,
      name: featuredPlace.name,
      lat: featuredPlace.lat,
      lon: featuredPlace.lon,
      imageUrl: featuredPlace.image_urls?.[0],
      categories: featuredPlace.categories ?? [],
      source: 'nearby',
    };
  }, [selectedPlace, featuredPlace]);

  const activeSupportedSite = useMemo(
    () =>
      activePlace ? matchSupportedSite(activePlace, supportedSites) : null,
    [activePlace, supportedSites],
  );

  // The top PreArrivalCard (driven by the auto-selected active monument) and the
  // bottom selected-site card refer to the same place when you tap your nearest
  // monument's pin. In that case they visually duplicate, so we hide the top
  // PreArrivalCard and let the bottom card stand. Keyed on slug (slug ?? id, the
  // same identity used everywhere else for sites).
  const selectedMatchesActiveSite = !!(
    activeSupportedSite &&
    active.slug &&
    (activeSupportedSite.slug ?? activeSupportedSite.id) === active.slug
  );

  const supportedImageSource = useMemo(() => {
    if (!activeSupportedSite) return null;
    return (
      resolveSiteImageSource(activeSupportedSite) ??
      (activePlace?.imageUrl ? {uri: activePlace.imageUrl} : null)
    );
  }, [activeSupportedSite, activePlace]);

  const canRoute =
    routeActive &&
    !!userLatLng &&
    typeof activeSite?.latitude === 'number' &&
    typeof activeSite?.longitude === 'number';

  return (
    <View className="flex-1 bg-surface-1">
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={['top']} className="bg-surface-1" />

      {/* Menu */}
      <View className="px-5 pt-1 flex-row items-center">
        <Pressable
          onPress={() => navigation.openDrawer()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Open menu"
          className="w-9 h-9 items-center justify-center">
          <Menu color="#FFFFFF" size={22} />
        </Pressable>
      </View>

      {/* Header */}
      <View className="px-6 pt-1 pb-2">
        <Text
          numberOfLines={1}
          ellipsizeMode="tail"
          style={{fontFamily: FONTS.sans, fontSize: 12, color: 'rgba(255,255,255,0.55)', letterSpacing: 0.3, alignSelf: 'stretch'}}>
          Heritage Near You
        </Text>
        <Text
          style={{marginTop: 2, fontFamily: FONTS.serif, fontSize: 28, color: '#FFFFFF', lineHeight: 34, alignSelf: 'stretch'}}
          numberOfLines={1}
          ellipsizeMode="tail">
          {locationTitle}
        </Text>
      </View>

      {/* Control row: notification + search icons (right) */}
      <View className="px-6 pt-5 pb-3 flex-row items-center justify-end">
        <View className="flex-row items-center gap-x-2">
          <Pressable
            onPress={() => setNotifOpen(true)}
            hitSlop={10}
            className="w-9 h-9 rounded-full bg-[rgba(255,255,255,0.06)] items-center justify-center"
            accessibilityRole="button"
            accessibilityLabel={
              unreadCount > 0
                ? `Notifications, ${unreadCount} unread`
                : 'Notifications'
            }>
            <Bell color="#FFFFFF" size={19} />
            {unreadCount > 0 ? (
              <View className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-[#E05C5C] items-center justify-center">
                <Text style={{fontFamily: FONTS.sansBold, fontSize: 9, color: '#FFFFFF'}}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Text>
              </View>
            ) : null}
          </Pressable>
          <Pressable
            onPress={() => setSearchOpen(prev => !prev)}
            hitSlop={10}
            className="w-9 h-9 rounded-full bg-[rgba(255,255,255,0.06)] items-center justify-center"
            accessibilityRole="button"
            accessibilityLabel={searchOpen ? 'Close search' : 'Open search'}>
            {searchOpen ? (
              <X color="#FFFFFF" size={20} />
            ) : (
              <Search color="#FFFFFF" size={20} />
            )}
          </Pressable>
        </View>
      </View>

      {/* Persistent nearest-venue nudge — Epocheye only works inside a curated
          venue, so when the user is outside one we continuously point them to the
          nearest site with one-tap directions (never static). */}
      {!inVenue && nearestVenue ? (
        <Pressable
          onPress={() => openVenueDirections(nearestVenue.zone)}
          style={({pressed}) => [
            styles.nudge,
            pressed ? {opacity: 0.9} : undefined,
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Get directions to ${nearestVenue.zone.name}, ${formatVenueDistance(
            nearestVenue.distance,
          )}`}>
          <View style={styles.nudgeIcon}>
            <Navigation color={COLORS.sky} size={15} />
          </View>
          <View style={{flex: 1}}>
            <Text style={styles.nudgeEyebrow} numberOfLines={1}>
              Nearest Epocheye site
            </Text>
            <Text style={styles.nudgeTitle} numberOfLines={1}>
              {nearestVenue.zone.name} · {formatVenueDistance(nearestVenue.distance)}
            </Text>
          </View>
          <View style={styles.nudgeCta}>
            <Text style={styles.nudgeCtaText}>Directions</Text>
          </View>
        </Pressable>
      ) : null}

      {/* Optional search input */}
      {searchOpen ? (
        <View className="mx-6 mb-2 px-3 py-2 rounded-xl bg-[rgba(255,255,255,0.06)] flex-row items-center gap-x-2">
          <Search color="rgba(255,255,255,0.4)" size={16} />
          <TextInput
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Search any place"
            placeholderTextColor="rgba(255,255,255,0.35)"
            style={{flex: 1, fontFamily: FONTS.sans, fontSize: 14, color: '#FFFFFF', padding: 0}}
            autoFocus
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={handleSearchSubmit}
          />
          {searching ? (
            <ActivityIndicator color="rgba(255,255,255,0.6)" size="small" />
          ) : null}
          {searchText.length > 0 ? (
            <Pressable onPress={() => setSearchText('')} hitSlop={8}>
              <X color="rgba(255,255,255,0.45)" size={14} />
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {/* Map — padded rounded container */}
      <View className="flex-1 mx-4 mt-2 mb-2 rounded-[18px] overflow-hidden bg-surface-1">
        <MapView
            ref={mapRef}
            provider={PROVIDER_GOOGLE}
            style={{position: 'absolute', top: 0, left: 0, right: 0, bottom: 0}}
            initialRegion={initialRegion}
            customMapStyle={mapStyle}
            showsUserLocation
            showsMyLocationButton={false}
            toolbarEnabled={false}
            // @ts-expect-error googleMapsApiKey is RN-native only, not in type defs
            googleMapsApiKey={GOOGLE_MAPS_API_KEY?.trim()}>
            {/* Curated Epocheye sites near the user (e.g. Victoria Memorial +
                Indian Museum in Kolkata) — distinct amber pins → site details. */}
            {nearbyCuratedSites.map(s => (
              <Marker
                key={`curated-${s.id}`}
                coordinate={{
                  latitude: s.latitude as number,
                  longitude: s.longitude as number,
                }}
                title={s.name}
                description={[s.city, s.state].filter(Boolean).join(', ')}
                onPress={() => handleSelectCurated(s)}
                pinColor="#D4860A"
              />
            ))}
            {filteredPlaces.map(place => (
              <Marker
                key={place.id}
                coordinate={{latitude: place.lat, longitude: place.lon}}
                title={place.name}
                description={`${place.city ?? ''}${place.city ? ', ' : ''}${place.country ?? ''}`}
                onPress={() => handleSelectNearby(place)}
                pinColor={COLORS.sky}
              />
            ))}
            {selectedPlace?.source === 'search' ? (
              <Marker
                key={selectedPlace.key}
                coordinate={{
                  latitude: selectedPlace.lat,
                  longitude: selectedPlace.lon,
                }}
                title={selectedPlace.name}
                pinColor={COLORS.lime}
              />
            ) : null}
            {canRoute && activeSite ? (
              <MapViewDirections
                origin={{
                  latitude: userLatLng!.lat,
                  longitude: userLatLng!.lng,
                }}
                destination={{
                  latitude: activeSite.latitude as number,
                  longitude: activeSite.longitude as number,
                }}
                apikey={GOOGLE_MAPS_API_KEY?.trim() ?? ''}
                mode="DRIVING"
                strokeWidth={4}
                strokeColor={COLORS.sky}
                onReady={result =>
                  mapRef.current?.fitToCoordinates(result.coordinates, {
                    edgePadding: {top: 220, bottom: 240, left: 60, right: 60},
                    animated: true,
                  })
                }
                onError={() => {
                  setRouteActive(false);
                  fitUserAndActive();
                }}
              />
            ) : null}
          </MapView>
        {activeSite ? (
          <View
            pointerEvents="box-none"
            style={styles.preArrivalOverlay}>
            <PreArrivalCard
              site={activeSite}
              userLocation={userLatLng}
              distanceKm={distanceKm}
              etaMinutes={etaMinutes}
              locationPermissionDenied={locationDenied}
              visible={visiblePreArrival && !selectedMatchesActiveSite}
              onShowDirections={handleShowDirections}
            />
            <ApproachCard
              site={activeSite}
              userLocation={userLatLng}
              distanceKm={distanceKm ?? 0}
              hasAccess={hasAccess}
              placeId={active.slug ?? ''}
              visible={visibleApproach}
              onShowDirections={handleShowDirections}
            />
            <ArrivalBanner
              site={activeSite}
              hasAccess={hasAccess}
              placeId={active.slug ?? ''}
              visible={visibleArrival}
              onDismiss={handleArrivalDismiss}
            />
          </View>
        ) : null}
      </View>

      {/* Bottom card — curated Epocheye site shows a details CTA; any other
          place shows the calm "not available here" card. */}
      {activePlace && activeSupportedSite ? (
        <View
          className="absolute left-4 right-4 flex-row bg-white rounded-[14px] overflow-hidden"
          style={[styles.cardShadow, {bottom: insets.bottom + 16}]}
          accessibilityRole="summary">
          <View className="w-[132px] h-[132px] bg-[#222]">
            {supportedImageSource ? (
              <Image
                source={supportedImageSource}
                className="w-full h-full"
                resizeMode="cover"
              />
            ) : (
              <View className="flex-1 bg-[rgba(212,134,10,0.22)]" />
            )}
          </View>
          <View className="flex-1 py-[10px] px-3">
            <Text
              style={{fontFamily: FONTS.sansSemiBold, fontSize: 11, color: '#D24A2C', letterSpacing: 0.4}}
              numberOfLines={1}>
              {activeSupportedSite.ar_ready
                ? 'Epocheye site · AR ready'
                : 'Epocheye site'}
            </Text>
            <Text
              style={{marginTop: 2, fontFamily: FONTS.serif, fontSize: 22, color: '#111111', lineHeight: 26}}
              numberOfLines={1}>
              {activeSupportedSite.name}
            </Text>
            <Text
              style={{marginTop: 2, fontFamily: FONTS.sans, fontSize: 11, color: 'rgba(0,0,0,0.55)'}}
              numberOfLines={2}>
              {activeSupportedSite.one_line_description ||
                [activeSupportedSite.city, activeSupportedSite.state]
                  .filter(Boolean)
                  .join(', ') ||
                'Tap to explore'}
            </Text>
            <View className="mt-2 flex-row gap-x-[6px]">
              <Pressable
                onPress={() => handleViewSupported(activeSupportedSite)}
                style={({pressed}) => (pressed ? {opacity: 0.85} : undefined)}
                className="px-[14px] py-[6px] rounded-full bg-[#111111]"
                accessibilityRole="button"
                accessibilityLabel={`View details for ${activeSupportedSite.name}`}>
                <Text style={{fontFamily: FONTS.sansMedium, fontSize: 12, color: '#FFFFFF'}}>
                  View Details
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : activePlace ? (
        <UnavailableSiteCard
          placeName={activePlace.name}
          bottom={insets.bottom + 16}
          onDismiss={dismissSelection}
          onExplore={() =>
            // This is an UNAVAILABLE (non-Epocheye) place — the lens only opens at a
            // venue, so point the user to their nearest one instead of museum mode.
            navigation.navigate(ROUTES.MAIN.GO_TO_VENUE)
          }
        />
      ) : null}

      {/* First-run, non-blocking feature tips */}
      <OnboardingTooltips bottomOffset={insets.bottom + 24} />

      <NotificationsModal
        visible={notifOpen}
        onClose={() => setNotifOpen(false)}
        onUnreadChange={setUnreadCount}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  cardShadow: {
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: {width: 0, height: 8},
    elevation: 8,
  },
  nudge: {
    marginHorizontal: 16,
    marginTop: 2,
    marginBottom: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(97,166,211,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(97,166,211,0.28)',
  },
  nudgeIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(97,166,211,0.16)',
  },
  nudgeEyebrow: {
    fontFamily: FONTS.sans,
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 0.3,
  },
  nudgeTitle: {
    marginTop: 1,
    fontFamily: FONTS.sansSemiBold,
    fontSize: 14,
    color: '#FFFFFF',
  },
  nudgeCta: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: COLORS.sky,
  },
  nudgeCtaText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 12,
    color: '#0A0A0A',
  },
  preArrivalOverlay: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    zIndex: 10,
    elevation: 10,
  },
});

export default Home;
