/**
 * Network Context
 * Provides global network connectivity state management
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface NetworkContextType {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  connectionType: string | null;
  checkConnection: () => Promise<boolean>;
}

const NetworkContext = createContext<NetworkContextType>({
  isConnected: true,
  isInternetReachable: true,
  connectionType: null,
  checkConnection: async () => true,
});

const LAST_ROUTE_KEY = '@epocheye/last_route';
const LAST_STATE_KEY = '@epocheye/last_navigation_state';

/**
 * Saves the current navigation state for restoration after reconnection
 */
export async function saveNavigationState(state: any): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_STATE_KEY, JSON.stringify(state));
  } catch {
    // Silent fail - navigation state is non-critical
  }
}

/**
 * Retrieves the saved navigation state
 */
export async function getNavigationState(): Promise<any | null> {
  try {
    const state = await AsyncStorage.getItem(LAST_STATE_KEY);
    return state ? JSON.parse(state) : null;
  } catch {
    return null;
  }
}

/**
 * Clears the saved navigation state
 */
export async function clearNavigationState(): Promise<void> {
  try {
    await AsyncStorage.removeItem(LAST_STATE_KEY);
  } catch {
    // Silent fail - navigation state is non-critical
  }
}

interface NetworkProviderProps {
  children: ReactNode;
}

export const NetworkProvider: React.FC<NetworkProviderProps> = ({
  children,
}) => {
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [isInternetReachable, setIsInternetReachable] = useState<
    boolean | null
  >(true);
  const [connectionType, setConnectionType] = useState<string | null>(null);

  const handleConnectivityChange = useCallback((state: NetInfoState) => {
    setIsConnected(state.isConnected ?? false);
    setIsInternetReachable(state.isInternetReachable);
    setConnectionType(state.type);
  }, []);

  const checkConnection = useCallback(async (): Promise<boolean> => {
    const state = await NetInfo.fetch();
    handleConnectivityChange(state);
    return state.isConnected ?? false;
  }, [handleConnectivityChange]);

  useEffect(() => {
    // Initial check
    checkConnection();

    // Subscribe to network state changes
    const unsubscribe = NetInfo.addEventListener(handleConnectivityChange);

    return () => {
      unsubscribe();
    };
  }, [checkConnection, handleConnectivityChange]);

  return (
    <NetworkContext.Provider
      value={{
        isConnected,
        isInternetReachable,
        connectionType,
        checkConnection,
      }}
    >
      {children}
    </NetworkContext.Provider>
  );
};

/**
 * Hook to access network connectivity state
 */
export const useNetwork = (): NetworkContextType => {
  const context = useContext(NetworkContext);

  if (!context) {
    throw new Error('useNetwork must be used within a NetworkProvider');
  }

  return context;
};

export default NetworkContext;
