import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  Linking,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, {
  Marker,
  Polyline,
  PROVIDER_GOOGLE,
  type LatLng,
} from 'react-native-maps';
import Geolocation, {
  type GeolocationResponse,
} from '@react-native-community/geolocation';
import {
  ArrowLeft,
  Navigation as NavigationIcon,
  MapPin,
  Clock,
  Car,
} from 'lucide-react-native';
import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import type {
  MainScreenProps,
  PlaceNavParam,
} from '../../core/types/navigation.types';

type Props = MainScreenProps<'NavigationScreen'>;
type NavigationSite = PlaceNavParam & {
  coordinates?: LatLng;
  location?: string;
};

interface RouteInfo {
  distance: string;
  duration: string;
  steps: string[];
}

const NavigationScreen: React.FC<Props> = ({ navigation, route }) => {
  const site = route.params.site as NavigationSite;
  const mapRef = useRef<MapView>(null);

  const [currentLocation, setCurrentLocation] = useState<LatLng | null>(null);
  const [destination, setDestination] = useState<LatLng | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<LatLng[]>([]);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const destinationName = site?.name || 'Destination';
  const destinationDescription =
    site?.formatted || site?.location || 'Navigate to site';

  const getDestinationCoords = useCallback((): LatLng => {
    if (site?.coordinates) {
      return site.coordinates;
    }

    if (typeof site?.lat === 'number' && typeof site?.lon === 'number') {
      return {
        latitude: site.lat,
        longitude: site.lon,
      };
    }

    return {
      latitude: 28.5933,
      longitude: 77.2507,
    };
  }, [site]);

  const requestLocationPermission = useCallback(async () => {
    try {
      const permission =
        Platform.OS === 'ios'
          ? PERMISSIONS.IOS.LOCATION_WHEN_IN_USE
          : PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION;

      const result = await check(permission);

      if (result === RESULTS.GRANTED) {
        return true;
      }

      const requestResult = await request(permission);
      return requestResult === RESULTS.GRANTED;
    } catch {
      return false;
    }
  }, []);

  const calculateDistance = useCallback((coord1: LatLng, coord2: LatLng) => {
    const earthRadiusKm = 6371;
    const dLat = ((coord2.latitude - coord1.latitude) * Math.PI) / 180;
    const dLon = ((coord2.longitude - coord1.longitude) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((coord1.latitude * Math.PI) / 180) *
        Math.cos((coord2.latitude * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return earthRadiusKm * c;
  }, []);

  const fetchRoute = useCallback(
    async (origin: LatLng, targetDestination: LatLng) => {
      try {
        const simulatedRoute: LatLng[] = [
          origin,
          {
            latitude: (origin.latitude + targetDestination.latitude) / 2,
            longitude: (origin.longitude + targetDestination.longitude) / 2,
          },
          targetDestination,
        ];

        setRouteCoordinates(simulatedRoute);

        const distance = calculateDistance(origin, targetDestination);
        const duration = Math.round((distance / 40) * 60);

        setRouteInfo({
          distance: `${distance.toFixed(1)} km`,
          duration: `${duration} min`,
          steps: [],
        });

        setIsLoading(false);

        if (mapRef.current) {
          mapRef.current.fitToCoordinates([origin, targetDestination], {
            edgePadding: { top: 100, right: 50, bottom: 100, left: 50 },
            animated: true,
          });
        }
      } catch {
        setIsLoading(false);
      }
    },
    [calculateDistance],
  );

  const getCurrentLocation = useCallback(async () => {
    try {
      const hasPermission = await requestLocationPermission();

      if (!hasPermission) {
        Alert.alert(
          'Permission Required',
          'Please enable location permissions to use navigation.',
        );
        setIsLoading(false);
        return;
      }

      Geolocation.getCurrentPosition(
        (position: GeolocationResponse) => {
          const userLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };

          setCurrentLocation(userLocation);

          const destinationCoords = getDestinationCoords();
          setDestination(destinationCoords);
          fetchRoute(userLocation, destinationCoords);
        },
        () => {
          Alert.alert('Error', 'Unable to get your location');
          setIsLoading(false);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
      );
    } catch {
      setIsLoading(false);
    }
  }, [fetchRoute, getDestinationCoords, requestLocationPermission]);

  const openExternalNavigation = useCallback(() => {
    if (!destination) {
      return;
    }

    const url = Platform.select({
      ios: `maps://app?daddr=${destination.latitude},${destination.longitude}&dirflg=d`,
      android: `google.navigation:q=${destination.latitude},${destination.longitude}`,
    });

    if (url) {
      Linking.canOpenURL(url)
        .then(supported => {
          if (supported) {
            Linking.openURL(url);
            return;
          }

          const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${destination.latitude},${destination.longitude}`;
          Linking.openURL(webUrl);
        })
        .catch(() => {});
    }
  }, [destination]);

  useEffect(() => {
    getCurrentLocation();
  }, [getCurrentLocation]);

  return (
    <SafeAreaView className="flex-1 bg-[#05050A]" edges={['top']}>
      <View className="absolute top-0 left-0 right-0 z-10 px-5 pt-4 pb-4 bg-[#05050A]/95">
        <View className="flex-row items-center justify-between">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="w-11 h-11 rounded-full bg-[#1F1F2A] items-center justify-center"
          >
            <ArrowLeft color="#FFFFFF" size={22} />
          </TouchableOpacity>

          <View className="flex-1 mx-4">
            <Text className="text-white text-lg font-montserrat-bold">
              Navigation
            </Text>
            <Text className="text-[#8D8D92] text-sm font-montserrat-medium">
              {destinationName}
            </Text>
          </View>

          <TouchableOpacity
            onPress={openExternalNavigation}
            className="w-11 h-11 rounded-full bg-[#3B82F6] items-center justify-center"
            disabled={!destination}
          >
            <Car color="#FFFFFF" size={20} />
          </TouchableOpacity>
        </View>
      </View>

      <View className="flex-1">
        {isLoading ? (
          <View className="flex-1 items-center justify-center bg-[#05050A]">
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text className="text-[#8D8D92] text-sm font-montserrat-medium mt-4">
              Getting your location...
            </Text>
          </View>
        ) : (
          <MapView
            ref={mapRef}
            provider={PROVIDER_GOOGLE}
            style={styles.map}
            initialRegion={{
              latitude: currentLocation?.latitude || 28.6139,
              longitude: currentLocation?.longitude || 77.209,
              latitudeDelta: 0.1,
              longitudeDelta: 0.1,
            }}
            showsUserLocation
            showsMyLocationButton
            showsCompass
            showsTraffic
          >
            {currentLocation && (
              <Marker
                coordinate={currentLocation}
                title="Your Location"
                pinColor="#3B82F6"
              />
            )}

            {destination && (
              <Marker
                coordinate={destination}
                title={destinationName}
                description={destinationDescription}
                pinColor="#FF7A18"
              />
            )}

            {routeCoordinates.length > 0 && (
              <Polyline
                coordinates={routeCoordinates}
                strokeColor="#3B82F6"
                strokeWidth={4}
              />
            )}
          </MapView>
        )}
      </View>

      {!isLoading && routeInfo && (
        <View className="absolute bottom-0 left-0 right-0 px-5 pb-6">
          <View className="bg-[#12121A] rounded-3xl p-5 border border-[#272730]">
            <View className="flex-row items-center justify-between mb-4">
              <View className="flex-row items-center flex-1">
                <View className="w-12 h-12 rounded-2xl bg-[#3B82F6]/20 items-center justify-center">
                  <NavigationIcon color="#3B82F6" size={24} />
                </View>
                <View className="ml-3 flex-1">
                  <Text className="text-white text-base font-montserrat-bold">
                    {destinationName}
                  </Text>
                  <Text className="text-[#8D8D92] text-sm font-montserrat-medium">
                    {destinationDescription}
                  </Text>
                </View>
              </View>
            </View>

            <View className="flex-row items-center gap-6 mb-4">
              <View className="flex-row items-center">
                <MapPin color="#FF7A18" size={18} />
                <View className="ml-2">
                  <Text className="text-white text-base font-montserrat-semibold">
                    {routeInfo.distance}
                  </Text>
                  <Text className="text-[#8D8D92] text-xs font-montserrat-medium">
                    Distance
                  </Text>
                </View>
              </View>
              <View className="flex-row items-center">
                <Clock color="#10B981" size={18} />
                <View className="ml-2">
                  <Text className="text-white text-base font-montserrat-semibold">
                    {routeInfo.duration}
                  </Text>
                  <Text className="text-[#8D8D92] text-xs font-montserrat-medium">
                    Duration
                  </Text>
                </View>
              </View>
            </View>

            <TouchableOpacity
              onPress={openExternalNavigation}
              className="bg-[#3B82F6] rounded-2xl py-4 flex-row items-center justify-center"
            >
              <NavigationIcon color="#FFFFFF" size={20} />
              <Text className="text-white text-base font-montserrat-semibold ml-2">
                Start Navigation
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
});

export default NavigationScreen;
