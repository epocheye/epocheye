import './global.css';

import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation';
import { NetworkProvider, useNetwork } from './src/context';
import NoInternetScreen from './src/screens/NoInternetScreen';

/**
 * Main app content that handles network state
 */
const AppContent: React.FC = () => {
  const { isConnected, isInternetReachable } = useNetwork();

  // Show offline screen when there's no internet
  // isInternetReachable can be null initially, so we check for explicit false
  const isOffline = isConnected === false || isInternetReachable === false;

  if (isOffline) {
    return <NoInternetScreen />;
  }

  return <AppNavigator />;
};

export default function App() {
  return (
    <SafeAreaProvider style={{ backgroundColor: '#000000' }}>
      <NetworkProvider>
        <AppContent />
      </NetworkProvider>
    </SafeAreaProvider>
  );
}
