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
  useMemo,
  ReactNode,
} from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface NetworkContextType {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  connectionType: string | null;
  /**
   * True only when connectivity is KNOWN to be gone. `isInternetReachable` is
   * null until the first probe resolves, and null must not read as offline —
   * hence the explicit `=== false` on both, never a truthiness check.
   *
   * Screens use this to degrade individually (inline empty state, disabled
   * submit). The app is never swapped out wholesale for an offline screen:
   * that unmounts every screen, losing cached content and the nav stack.
   */
  isOffline: boolean;
  checkConnection: () => Promise<boolean>;
}

const NetworkContext = createContext<NetworkContextType>({
  isConnected: true,
  isInternetReachable: true,
  connectionType: null,
  isOffline: false,
  checkConnection: async () => true,
});

const LAST_STATE_KEY = '@epocheye/last_navigation_state';

/*
 * UNUSED as of this writing: the three navigation-state helpers below have no
 * callers anywhere in the app (they are re-exported by src/context/index.ts and
 * invoked by nothing), and LAST_STATE_KEY is never written or read. Their shape
 * — save, swap screens, restore — suggests they were meant to compensate for the
 * offline full-screen swap that used to live in App.tsx, but that swap never
 * called them either, so they were already inert before it was removed. Left in
 * place deliberately; delete or wire up as a separate decision.
 */

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

  const isOffline = isConnected === false || isInternetReachable === false;

  const value = useMemo<NetworkContextType>(
    () => ({
      isConnected,
      isInternetReachable,
      connectionType,
      isOffline,
      checkConnection,
    }),
    [
      isConnected,
      isInternetReachable,
      connectionType,
      isOffline,
      checkConnection,
    ],
  );

  return (
    <NetworkContext.Provider value={value}>
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
