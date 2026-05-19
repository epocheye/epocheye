import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  Image,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import MapView, {Marker, PROVIDER_GOOGLE, type Region} from 'react-native-maps';
import {GOOGLE_MAPS_API_KEY} from '@env';
import {Search, X} from 'lucide-react-native';
import mapStyle from '../../content/mapstyle.json';
import {COLORS, FONTS} from '../../core/constants/theme';
import {ROUTES} from '../../core/constants/routes';
import {usePlaces} from '../../context';
import {buildSiteDetailData} from '../../shared/utils';
import type {Place} from '../../utils/api/places/types';
import type {TabScreenProps} from '../../core/types/navigation.types';

type Props = TabScreenProps<'Home'>;

type ViewMode = 'nearby' | 'virtual';

const DEFAULT_REGION: Region = {
  latitude: 20.5937,
  longitude: 78.9629,
  latitudeDelta: 12,
  longitudeDelta: 12,
};

function formatDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters <= 0) return '';
  if (meters < 950) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

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

function lineCategory(place: Place): string {
  const cat = place.categories?.[0];
  if (cat) return `Built · ${cat}`;
  return 'Built · heritage site';
}

function lineEra(place: Place): string {
  if (place.significance) {
    return place.significance.slice(0, 56);
  }
  if (place.place_type) {
    return `Type · ${place.place_type}`;
  }
  return place.address_line2 || place.state || 'Tap to learn more';
}

const Home: React.FC<Props> = ({navigation}) => {
  const insets = useSafeAreaInsets();
  const nearbyPlaces = usePlaces(state => state.nearbyPlaces);
  const currentLocation = usePlaces(state => state.currentLocation);
  const ensureLocationTracking = usePlaces(
    state => state.ensureLocationTracking,
  );

  const [viewMode, setViewMode] = useState<ViewMode>('nearby');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    void ensureLocationTracking();
  }, [ensureLocationTracking]);

  const allPlaces = useMemo(
    () => (Array.isArray(nearbyPlaces) ? nearbyPlaces : []),
    [nearbyPlaces],
  );

  const filteredPlaces = useMemo(() => {
    const list = viewMode === 'nearby' ? allPlaces : [];
    const q = searchText.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      p =>
        p.name.toLowerCase().includes(q) ||
        p.city?.toLowerCase().includes(q) ||
        p.country?.toLowerCase().includes(q),
    );
  }, [allPlaces, viewMode, searchText]);

  const featuredPlace: Place | null = filteredPlaces[0] ?? null;

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

  const locationTitle = useMemo(
    () => deriveLocationTitle(allPlaces),
    [allPlaces],
  );

  const handleLearnMore = useCallback(
    (place: Place) => {
      navigation.navigate(ROUTES.MAIN.SITE_DETAIL, {
        site: buildSiteDetailData(place),
      });
    },
    [navigation],
  );

  const handleViewInAR = useCallback(
    (place: Place) => {
      navigation.navigate(ROUTES.MAIN.AR_EXPERIENCE, {
        site: buildSiteDetailData(place),
      });
    },
    [navigation],
  );

  const handleMarkerPress = useCallback((place: Place) => {
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

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={['top']} style={styles.safeTop} />

      {/* Header (no search button — moved to control row) */}
      <View style={styles.header}>
        <Text style={styles.kicker}>Heritage Near You</Text>
        <Text style={styles.title} numberOfLines={1}>
          {locationTitle}
        </Text>
      </View>

      {/* Control row: segmented pill (left) + search icon (right) on one line */}
      <View style={styles.controlRow}>
        <View style={styles.segmentTrack}>
          <Pressable
            onPress={() => setViewMode('nearby')}
            style={[
              styles.segmentBtn,
              viewMode === 'nearby' && styles.segmentBtnActive,
            ]}
            accessibilityRole="button"
            accessibilityState={{selected: viewMode === 'nearby'}}>
            <Text
              style={[
                styles.segmentLabel,
                viewMode === 'nearby' && styles.segmentLabelActive,
              ]}>
              Nearby
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setViewMode('virtual')}
            style={[
              styles.segmentBtn,
              viewMode === 'virtual' && styles.segmentBtnActive,
            ]}
            accessibilityRole="button"
            accessibilityState={{selected: viewMode === 'virtual'}}>
            <Text
              style={[
                styles.segmentLabel,
                viewMode === 'virtual' && styles.segmentLabelActive,
              ]}>
              Virtual
            </Text>
          </Pressable>
        </View>
        <Pressable
          onPress={() => setSearchOpen(prev => !prev)}
          hitSlop={10}
          style={styles.searchButton}
          accessibilityRole="button"
          accessibilityLabel={searchOpen ? 'Close search' : 'Open search'}>
          {searchOpen ? (
            <X color="#FFFFFF" size={20} />
          ) : (
            <Search color="#FFFFFF" size={20} />
          )}
        </Pressable>
      </View>

      {/* Optional search input — slides in below control row */}
      {searchOpen ? (
        <View style={styles.searchWrap}>
          <Search color="rgba(255,255,255,0.4)" size={16} />
          <TextInput
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Search heritage sites"
            placeholderTextColor="rgba(255,255,255,0.35)"
            style={styles.searchInput}
            autoFocus
            autoCorrect={false}
            returnKeyType="search"
          />
          {searchText.length > 0 ? (
            <Pressable onPress={() => setSearchText('')} hitSlop={8}>
              <X color="rgba(255,255,255,0.45)" size={14} />
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {/* Map — wrapped in a padded, rounded container */}
      <View style={styles.mapWrap}>
        {viewMode === 'nearby' ? (
          <MapView
            ref={mapRef}
            provider={PROVIDER_GOOGLE}
            style={StyleSheet.absoluteFill}
            initialRegion={initialRegion}
            customMapStyle={mapStyle}
            showsUserLocation
            showsMyLocationButton={false}
            toolbarEnabled={false}
            // @ts-expect-error googleMapsApiKey is RN-native only, not in type defs
            googleMapsApiKey={GOOGLE_MAPS_API_KEY?.trim()}>
            {filteredPlaces.map(place => (
              <Marker
                key={place.id}
                coordinate={{latitude: place.lat, longitude: place.lon}}
                title={place.name}
                description={`${place.city ?? ''}${place.city ? ', ' : ''}${place.country ?? ''}`}
                onPress={() => handleMarkerPress(place)}
                pinColor={COLORS.sky}
              />
            ))}
          </MapView>
        ) : (
          <View style={styles.virtualEmpty}>
            <Text style={styles.virtualEmptyTitle}>Virtual tours</Text>
            <Text style={styles.virtualEmptyBody}>
              Browse heritage sites worldwide. Coming soon.
            </Text>
          </View>
        )}
      </View>

      {/* Bottom featured card */}
      {featuredPlace ? (
        <View
          style={[
            styles.featureCard,
            {bottom: insets.bottom + 84}, // sits above tab bar
          ]}
          accessibilityRole="summary">
          <View style={styles.featureImageWrap}>
            {featuredPlace.image_urls?.[0] ? (
              <Image
                source={{uri: featuredPlace.image_urls[0]}}
                style={styles.featureImage}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.featureImagePlaceholder} />
            )}
          </View>
          <View style={styles.featureBody}>
            <Text style={styles.featureDistance} numberOfLines={1}>
              {featuredPlace.distance_meters > 0
                ? `Nearest · ${formatDistance(featuredPlace.distance_meters)}`
                : 'Featured'}
            </Text>
            <Text style={styles.featureName} numberOfLines={1}>
              {featuredPlace.name}
            </Text>
            <Text style={styles.featureMeta} numberOfLines={1}>
              {lineCategory(featuredPlace)}
            </Text>
            <Text style={styles.featureMeta} numberOfLines={1}>
              {lineEra(featuredPlace)}
            </Text>
            <View style={styles.featureActions}>
              <Pressable
                onPress={() => handleViewInAR(featuredPlace)}
                style={({pressed}) => [
                  styles.featurePrimary,
                  pressed && styles.featureBtnPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`View ${featuredPlace.name} in AR`}>
                <Text style={styles.featurePrimaryLabel}>View in AR</Text>
              </Pressable>
              <Pressable
                onPress={() => handleLearnMore(featuredPlace)}
                style={({pressed}) => [
                  styles.featureSecondary,
                  pressed && styles.featureBtnPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Learn more about ${featuredPlace.name}`}>
                <Text style={styles.featureSecondaryLabel}>Learn More</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#0A0A0A'},
  safeTop: {backgroundColor: '#0A0A0A'},
  header: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 8,
  },
  kicker: {
    fontFamily: FONTS.sans,
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 0.3,
  },
  title: {
    marginTop: 2,
    fontFamily: FONTS.serif,
    fontSize: 28,
    color: '#FFFFFF',
    lineHeight: 32,
  },
  controlRow: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  searchButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentTrack: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  segmentBtn: {
    paddingHorizontal: 18,
    paddingVertical: 6,
    borderRadius: 999,
  },
  segmentBtnActive: {
    backgroundColor: COLORS.sky,
  },
  segmentLabel: {
    fontFamily: FONTS.sansMedium,
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
  },
  segmentLabelActive: {
    color: '#FFFFFF',
  },
  searchWrap: {
    marginHorizontal: 24,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: FONTS.sans,
    fontSize: 14,
    color: '#FFFFFF',
    padding: 0,
  },
  mapWrap: {
    flex: 1,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#0A0A0A',
  },
  virtualEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  virtualEmptyTitle: {
    fontFamily: FONTS.serif,
    fontSize: 22,
    color: '#FFFFFF',
  },
  virtualEmptyBody: {
    marginTop: 6,
    fontFamily: FONTS.sans,
    fontSize: 13,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
  },
  featureCard: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: {width: 0, height: 8},
    elevation: 8,
  },
  featureImageWrap: {
    width: 132,
    height: 132,
    backgroundColor: '#222',
  },
  featureImage: {width: '100%', height: '100%'},
  featureImagePlaceholder: {
    flex: 1,
    backgroundColor: 'rgba(212,134,10,0.22)',
  },
  featureBody: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  featureDistance: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 11,
    color: '#D24A2C',
    letterSpacing: 0.4,
  },
  featureName: {
    marginTop: 2,
    fontFamily: FONTS.serif,
    fontSize: 22,
    color: '#111111',
    lineHeight: 26,
  },
  featureMeta: {
    marginTop: 2,
    fontFamily: FONTS.sans,
    fontSize: 11,
    color: 'rgba(0,0,0,0.55)',
  },
  featureActions: {
    marginTop: 8,
    flexDirection: 'row',
    gap: 6,
  },
  featurePrimary: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#111111',
  },
  featureSecondary: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#2A2A2A',
  },
  featureBtnPressed: {
    opacity: 0.85,
  },
  featurePrimaryLabel: {
    fontFamily: FONTS.sansMedium,
    fontSize: 12,
    color: '#FFFFFF',
  },
  featureSecondaryLabel: {
    fontFamily: FONTS.sansMedium,
    fontSize: 12,
    color: '#FFFFFF',
  },
});

export default Home;
