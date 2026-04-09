import { create } from 'zustand';
import {
  getUserProfile,
  getUserStats,
  updateUserProfile,
  uploadAvatar,
  type UpdateProfileRequest,
  type UserProfile,
  type UserStats,
} from '../utils/api/user';

interface UserStoreState {
  profile: UserProfile | null;
  stats: UserStats | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  ensureUserDataLoaded: () => Promise<void>;
  refreshUserData: () => Promise<void>;
  updateProfile: (data: UpdateProfileRequest) => Promise<boolean>;
  uploadUserAvatar: (imageFile: FormData) => Promise<boolean>;
  clearUserData: () => void;
}

async function fetchUserSnapshot(): Promise<{
  profile: UserProfile | null;
  stats: UserStats | null;
  error: string | null;
}> {
  const [profileResult, statsResult] = await Promise.all([
    getUserProfile(),
    getUserStats(),
  ]);

  return {
    profile: profileResult.success ? profileResult.data : null,
    stats: statsResult.success ? statsResult.data : null,
    error: profileResult.success ? null : profileResult.error.message,
  };
}

export const useUserStore = create<UserStoreState>((set, get) => ({
  profile: null,
  stats: null,
  isLoading: false,
  isRefreshing: false,
  error: null,
  ensureUserDataLoaded: async () => {
    const { profile, stats, isLoading } = get();
    if (isLoading || (profile && stats)) {
      return;
    }

    set({
      isLoading: true,
      error: null,
    });

    try {
      const snapshot = await fetchUserSnapshot();
      set({
        profile: snapshot.profile,
        stats: snapshot.stats,
        error: snapshot.error,
        isLoading: false,
      });
    } catch (error) {
      set({
        isLoading: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to fetch user data',
      });
    }
  },
  refreshUserData: async () => {
    if (get().isRefreshing) {
      return;
    }

    set({
      isRefreshing: true,
      error: null,
    });

    try {
      const snapshot = await fetchUserSnapshot();
      set({
        profile: snapshot.profile,
        stats: snapshot.stats,
        error: snapshot.error,
        isRefreshing: false,
        isLoading: false,
      });
    } catch (error) {
      set({
        isRefreshing: false,
        isLoading: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to fetch user data',
      });
    }
  },
  updateProfile: async data => {
    try {
      set({ error: null });
      const result = await updateUserProfile(data);
      if (!result.success) {
        set({ error: result.error.message });
        return false;
      }

      set({ profile: result.data });
      return true;
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : 'Failed to update profile',
      });
      return false;
    }
  },
  uploadUserAvatar: async imageFile => {
    try {
      set({ error: null });
      const result = await uploadAvatar(imageFile);
      if (!result.success) {
        set({ error: result.error.message });
        return false;
      }

      await get().refreshUserData();
      return true;
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : 'Failed to upload avatar',
      });
      return false;
    }
  },
  clearUserData: () => {
    set({
      profile: null,
      stats: null,
      error: null,
      isLoading: false,
      isRefreshing: false,
    });
  },
}));
