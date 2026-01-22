import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import Geolocation from 'react-native-geolocation-service';
import {
  ArrowLeft,
  Navigation as NavigationIcon,
  MapPin,
  Clock,
  Car,
} from 'lucide-react-native';
import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';

interface NavigationScreenProps {
  navigation: any;
  route: any;
}

interface RouteInfo {
  distance: string;
  duration: string;
  steps: any[];
}

const NavigationScreen: React.FC<NavigationScreenProps> = ({
  navigation,
  route,
}) => {
  const { site } = route.params || {};
  const mapRef = useRef<MapView>(null);

  // State
  const [currentLocation, setCurrentLocation] = useState<any>(null);
  const [destination, setDestination] = useState<any>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<any[]>([]);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Default coordinates for Humayun's Tomb (if not provided in site data)
  const getDestinationCoords = () => {
    if (site?.coordinates) {
      return site.coordinates;
    }
    // Default to Humayun's Tomb coordinates
    return {
      latitude: 28.5933,
      longitude: 77.2507,
    };
  };

  // Request location permission
  const requestLocationPermission = async () => {
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
  };

  // Get current location
  const getCurrentLocation = async () => {
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
        position => {
          const { latitude, longitude } = position.coords;
          setCurrentLocation({ latitude, longitude });
          const destCoords = getDestinationCoords();
          setDestination(destCoords);
          fetchRoute({ latitude, longitude }, destCoords);
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
  };

  // Fetch route from Google Directions API
  const fetchRoute = async (origin: any, destination: any) => {
    try {
      // Note: In production, you should use your own Google Maps API key
      // For now, we'll create a simple straight line route
      const route = [
        origin,
        {
          latitude: (origin.latitude + destination.latitude) / 2,
          longitude: (origin.longitude + destination.longitude) / 2,
        },
        destination,
      ];

      setRouteCoordinates(route);

      // Calculate approximate distance and duration
      const distance = calculateDistance(origin, destination);
      const duration = Math.round((distance / 40) * 60); // Assuming 40 km/h average speed

      setRouteInfo({
        distance: `${distance.toFixed(1)} km`,
        duration: `${duration} min`,
        steps: [],
      });

      setIsLoading(false);

      // Fit map to show route
      if (mapRef.current) {
        mapRef.current.fitToCoordinates([origin, destination], {
          edgePadding: { top: 100, right: 50, bottom: 100, left: 50 },
          animated: true,
        });
      }
    } catch {
      setIsLoading(false);
    }
  };

  // Calculate distance between two coordinates (Haversine formula)
  const calculateDistance = (coord1: any, coord2: any) => {
    const R = 6371; // Earth's radius in km
    const dLat = ((coord2.latitude - coord1.latitude) * Math.PI) / 180;
    const dLon = ((coord2.longitude - coord1.longitude) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((coord1.latitude * Math.PI) / 180) *
        Math.cos((coord2.latitude * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Open in external navigation app
  const openExternalNavigation = () => {
    if (!destination) return;

    const label = site?.name || 'Destination';
    const url = Platform.select({
      ios: `maps://app?daddr=${destination.latitude},${destination.longitude}&dirflg=d`,
      android: `google.navigation:q=${destination.latitude},${destination.longitude}`,
    });

    if (url) {
      Linking.canOpenURL(url)
        .then(supported => {
          if (supported) {
            Linking.openURL(url);
          } else {
            // Fallback to Google Maps web
            const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${destination.latitude},${destination.longitude}`;
            Linking.openURL(webUrl);
          }
        })
        .catch(() => {});
    }
  };

  useEffect(() => {
    getCurrentLocation();
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-[#05050A]" edges={['top']}>
      {/* Header */}
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
              {site?.name || 'Destination'}
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

      {/* Map */}
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
            style={{ flex: 1 }}
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
            {/* Current Location Marker */}
            {currentLocation && (
              <Marker
                coordinate={currentLocation}
                title="Your Location"
                pinColor="#3B82F6"
              />
            )}

            {/* Destination Marker */}
            {destination && (
              <Marker
                coordinate={destination}
                title={site?.name || 'Destination'}
                description={site?.location}
                pinColor="#FF7A18"
              />
            )}

            {/* Route Line */}
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

      {/* Route Info Card */}
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
                    {site?.name || 'Destination'}
                  </Text>
                  <Text className="text-[#8D8D92] text-sm font-montserrat-medium">
                    {site?.location || 'Navigate to site'}
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

export default NavigationScreen;
