import { View } from 'react-native';
import React, { useState } from 'react';
import { useWindowDimensions } from 'react-native';
import MapView, { PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { GOOGLE_MAPS_API_KEY } from '@env';
import mapStyle from '../content/mapstyle.json';

const DEFAULT_REGION: Region = {
  latitude: 28.6139,
  longitude: 77.209,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

const Map = () => {
  const { width, height } = useWindowDimensions();
  const [_region, setRegion] = useState<Region>(DEFAULT_REGION);

  return (
    <View
      className="items-center justify-center overflow-hidden rounded-[20px]"
      style={{ width: width - 40, height: height * 0.65 }}
    >
      <MapView
        provider={PROVIDER_GOOGLE}
        // @ts-expect-error Prop exists on native MapView but missing from type defs
        googleMapsApiKey={GOOGLE_MAPS_API_KEY?.trim()}
        className="absolute inset-0"
        initialRegion={DEFAULT_REGION}
        customMapStyle={mapStyle}
        showsUserLocation
        showsBuildings
        showsTraffic
        showsPointsOfInterests
        showsMyLocationButton
        loadingEnabled
        onRegionChangeComplete={setRegion}
      />
    </View>
  );
};

export default Map;
