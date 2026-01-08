/**
 * User Context
 * Provides global user profile and stats state management
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import {
  getUserProfile,
  updateUserProfile,
  uploadAvatar,
  getUserStats,
  UserProfile,
  UpdateProfileRequest,
  UserStats,
} from '../utils/api/user';
import { isAuthenticated } from '../utils/api/auth';

interface UserContextType {
  profile: UserProfile | null;
  stats: UserStats | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  refreshUserData: () => Promise<void>;
  updateProfile: (data: UpdateProfileRequest) => Promise<boolean>;
  uploadUserAvatar: (imageFile: FormData) => Promise<boolean>;
  clearUserData: () => void;
}

const UserContext = createContext<UserContextType>({
  profile: null,
  stats: null,
  isLoading: false,
  isRefreshing: false,
  error: null,
  refreshUserData: async () => {},
  updateProfile: async () => false,
  uploadUserAvatar: async () => false,
  clearUserData: () => {},
});

interface UserProviderProps {
  children: ReactNode;
}

/**
 * User Provider Component
 * Manages user profile and stats data globally
 */
export const UserProvider: React.FC<UserProviderProps> = ({ children }) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetches user profile and stats from API
   */
  const fetchUserData = useCallback(async (isRefresh: boolean = false) => {
    try {
      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      const authenticated = await isAuthenticated();
      if (!authenticated) {
        setProfile(null);
        setStats(null);
        return;
      }

      // Fetch profile and stats in parallel
      const [profileResult, statsResult] = await Promise.all([
        getUserProfile(),
        getUserStats(),
      ]);

      if (profileResult.success) {
        setProfile(profileResult.data);
      } else {
        setError(profileResult.error.message);
      }

      if (statsResult.success) {
        setStats(statsResult.data);
      } else {
        // Stats error is non-critical, just log it
        console.warn('Failed to fetch user stats:', statsResult.error.message);
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to fetch user data';
      setError(errorMessage);
      console.error('Error fetching user data:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  /**
   * Refreshes user data (can be called manually)
   */
  const refreshUserData = useCallback(async () => {
    await fetchUserData(true);
  }, [fetchUserData]);

  /**
   * Updates user profile
   * @param data - Profile data to update
   * @returns true if update was successful
   */
  const updateProfile = useCallback(
    async (data: UpdateProfileRequest): Promise<boolean> => {
      try {
        setError(null);
        const result = await updateUserProfile(data);

        if (result.success) {
          setProfile(result.data);
          return true;
        } else {
          setError(result.error.message);
          return false;
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to update profile';
        setError(errorMessage);
        return false;
      }
    },
    [],
  );

  /**
   * Uploads user avatar
   * @param imageFile - FormData with image file
   * @returns true if upload was successful
   */
  const uploadUserAvatar = useCallback(
    async (imageFile: FormData): Promise<boolean> => {
      try {
        setError(null);
        const result = await uploadAvatar(imageFile);

        if (result.success) {
          // Refresh profile to get updated avatar_url
          await fetchUserData(false);
          return true;
        } else {
          setError(result.error.message);
          return false;
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to upload avatar';
        setError(errorMessage);
        return false;
      }
    },
    [fetchUserData],
  );

  /**
   * Clears user data (call on logout)
   */
  const clearUserData = useCallback(() => {
    setProfile(null);
    setStats(null);
    setError(null);
  }, []);

  // Fetch user data on mount if authenticated
  useEffect(() => {
    const initializeUser = async () => {
      const authenticated = await isAuthenticated();
      if (authenticated) {
        await fetchUserData(false);
      }
    };

    initializeUser();
  }, [fetchUserData]);

  const value: UserContextType = {
    profile,
    stats,
    isLoading,
    isRefreshing,
    error,
    refreshUserData,
    updateProfile,
    uploadUserAvatar,
    clearUserData,
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};

/**
 * Custom hook to access user context
 * @returns User context value
 */
export const useUser = (): UserContextType => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};

export default UserContext;
