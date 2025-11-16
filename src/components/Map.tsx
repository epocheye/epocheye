import { StyleSheet, View, Dimensions } from 'react-native';
import React, { useMemo, useState } from 'react';
import MapView, { PROVIDER_GOOGLE, Marker, Region } from 'react-native-maps';
import { GOOGLE_MAPS_API_KEY } from '@env';
import mapStyle from '../content/mapstyle.json';
const DEFAULT_REGION: Region = {
  latitude: 28.6139,
  longitude: 77.209,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

const Map = () => {
  const [region, setRegion] = useState<Region>(DEFAULT_REGION);
  const googleMapsApiKey = useMemo(
    () =>
      GOOGLE_MAPS_API_KEY?.trim() || 'AIzaSyDQCW5NWi1ipV1GkVNwPht67pvvYTtED7U',
    [],
  );

  return (
    <View style={styles.container}>
      <MapView
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={DEFAULT_REGION}
        customMapStyle={mapStyle}
        showsUserLocation
        showsMyLocationButton
        loadingEnabled
        // @ts-expect-error Prop exists on native MapView but is missing from type defs
        googleMapsApiKey={googleMapsApiKey}
        onRegionChangeComplete={setRegion}
      >
        <Marker
          coordinate={{
            latitude: region.latitude,
            longitude: region.longitude,
          }}
          title="New Delhi"
          description="Welcome to India's capital!"
        />
      </MapView>
    </View>
  );
};

export default Map;

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    width: width - 40,
    height: height * 0.65,
    borderRadius: 20,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
});
