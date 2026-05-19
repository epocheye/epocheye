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
    <View className="flex-1 bg-surface-1">
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={['top']} className="bg-surface-1" />

      {/* Header */}
      <View className="px-6 pt-2 pb-2">
        <Text style={{fontFamily: FONTS.sans, fontSize: 12, color: 'rgba(255,255,255,0.55)', letterSpacing: 0.3}}>
          Heritage Near You
        </Text>
        <Text
          style={{marginTop: 2, fontFamily: FONTS.serif, fontSize: 28, color: '#FFFFFF', lineHeight: 32}}
          numberOfLines={1}>
          {locationTitle}
        </Text>
      </View>

      {/* Control row: segmented pill (left) + search icon (right) */}
      <View className="px-6 pt-5 pb-3 flex-row items-center justify-between">
        <View className="flex-row p-[3px] rounded-full border border-[rgba(255,255,255,0.16)] bg-[rgba(255,255,255,0.04)]">
          <Pressable
            onPress={() => setViewMode('nearby')}
            className={`px-[18px] py-[6px] rounded-full${viewMode === 'nearby' ? ' bg-[#61A6D3]' : ''}`}
            accessibilityRole="button"
            accessibilityState={{selected: viewMode === 'nearby'}}>
            <Text
              style={{
                fontFamily: FONTS.sansMedium,
                fontSize: 12,
                color: viewMode === 'nearby' ? '#FFFFFF' : 'rgba(255,255,255,0.55)',
              }}>
              Nearby
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setViewMode('virtual')}
            className={`px-[18px] py-[6px] rounded-full${viewMode === 'virtual' ? ' bg-[#61A6D3]' : ''}`}
            accessibilityRole="button"
            accessibilityState={{selected: viewMode === 'virtual'}}>
            <Text
              style={{
                fontFamily: FONTS.sansMedium,
                fontSize: 12,
                color: viewMode === 'virtual' ? '#FFFFFF' : 'rgba(255,255,255,0.55)',
              }}>
              Virtual
            </Text>
          </Pressable>
        </View>
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

      {/* Optional search input */}
      {searchOpen ? (
        <View className="mx-6 mb-2 px-3 py-2 rounded-xl bg-[rgba(255,255,255,0.06)] flex-row items-center gap-x-2">
          <Search color="rgba(255,255,255,0.4)" size={16} />
          <TextInput
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Search heritage sites"
            placeholderTextColor="rgba(255,255,255,0.35)"
            style={{flex: 1, fontFamily: FONTS.sans, fontSize: 14, color: '#FFFFFF', padding: 0}}
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

      {/* Map — padded rounded container */}
      <View className="flex-1 mx-4 mt-2 mb-2 rounded-[18px] overflow-hidden bg-surface-1">
        {viewMode === 'nearby' ? (
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
          <View className="flex-1 items-center justify-center px-8">
            <Text style={{fontFamily: FONTS.serif, fontSize: 22, color: '#FFFFFF'}}>
              Virtual tours
            </Text>
            <Text style={{marginTop: 6, fontFamily: FONTS.sans, fontSize: 13, color: 'rgba(255,255,255,0.55)', textAlign: 'center'}}>
              Browse heritage sites worldwide. Coming soon.
            </Text>
          </View>
        )}
      </View>

      {/* Bottom featured card */}
      {featuredPlace ? (
        <View
          className="absolute left-4 right-4 flex-row bg-white rounded-[14px] overflow-hidden"
          style={[styles.cardShadow, {bottom: insets.bottom + 84}]}
          accessibilityRole="summary">
          <View className="w-[132px] h-[132px] bg-[#222]">
            {featuredPlace.image_urls?.[0] ? (
              <Image
                source={{uri: featuredPlace.image_urls[0]}}
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
              {featuredPlace.distance_meters > 0
                ? `Nearest · ${formatDistance(featuredPlace.distance_meters)}`
                : 'Featured'}
            </Text>
            <Text
              style={{marginTop: 2, fontFamily: FONTS.serif, fontSize: 22, color: '#111111', lineHeight: 26}}
              numberOfLines={1}>
              {featuredPlace.name}
            </Text>
            <Text
              style={{marginTop: 2, fontFamily: FONTS.sans, fontSize: 11, color: 'rgba(0,0,0,0.55)'}}
              numberOfLines={1}>
              {lineCategory(featuredPlace)}
            </Text>
            <Text
              style={{marginTop: 2, fontFamily: FONTS.sans, fontSize: 11, color: 'rgba(0,0,0,0.55)'}}
              numberOfLines={1}>
              {lineEra(featuredPlace)}
            </Text>
            <View className="mt-2 flex-row gap-x-[6px]">
              <Pressable
                onPress={() => handleViewInAR(featuredPlace)}
                style={({pressed}) => pressed ? {opacity: 0.85} : undefined}
                className="px-[14px] py-[6px] rounded-full bg-[#111111]"
                accessibilityRole="button"
                accessibilityLabel={`View ${featuredPlace.name} in AR`}>
                <Text style={{fontFamily: FONTS.sansMedium, fontSize: 12, color: '#FFFFFF'}}>
                  View in AR
                </Text>
              </Pressable>
              <Pressable
                onPress={() => handleLearnMore(featuredPlace)}
                style={({pressed}) => pressed ? {opacity: 0.85} : undefined}
                className="px-[14px] py-[6px] rounded-full bg-[#2A2A2A]"
                accessibilityRole="button"
                accessibilityLabel={`Learn more about ${featuredPlace.name}`}>
                <Text style={{fontFamily: FONTS.sansMedium, fontSize: 12, color: '#FFFFFF'}}>
                  Learn More
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}
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
});

export default Home;
