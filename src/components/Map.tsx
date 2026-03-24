import { View } from 'react-native';
import React, { useState } from 'react';
import { useWindowDimensions } from 'react-native';
import MapView, { PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { GOOGLE_MAPS_API_KEY } from '@env';
import mapStyle from '../content/mapstyle.json';

// Default to a neutral location; the map will show the user's real position
// via showsUserLocation once the key is valid.
const DEFAULT_REGION: Region = {
  latitude: 28.6139,
  longitude: 77.209,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

const Map = () => {
  const { width, height } = useWindowDimensions();
  const [_region, setRegion] = useState<Region>(DEFAULT_REGION);

  // Fail loudly in development if the key is missing rather than using a
  // hardcoded fallback. The key must live exclusively in .env and never in
  // source control.
  if (__DEV__ && !GOOGLE_MAPS_API_KEY?.trim()) {
    console.error(
      '[Map] GOOGLE_MAPS_API_KEY is missing. Add it to your .env file.',
    );
  }

  return (
    <View
      className="items-center justify-center overflow-hidden rounded-[20px]"
      style={{ width: width - 40, height: height * 0.65 }}
    >
      <MapView
        provider={PROVIDER_GOOGLE}
        className="absolute inset-0"
        initialRegion={DEFAULT_REGION}
        customMapStyle={mapStyle}
        showsUserLocation
        showsBuildings
        showsTraffic
        showsPointsOfInterests
        showsMyLocationButton
        loadingEnabled
        // @ts-expect-error Prop exists on native MapView but is missing from type defs
        googleMapsApiKey={GOOGLE_MAPS_API_KEY?.trim()}
        onRegionChangeComplete={setRegion}
      />
    </View>
  );
};

export default Map;
