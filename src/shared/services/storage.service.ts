/**
 * Storage Service
 * Type-safe AsyncStorage wrapper with error handling
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * StorageService provides a type-safe wrapper around AsyncStorage
 * with standardized error handling and serialization
 */
export class StorageService {
  /**
   * Store a value with the given key
   * @param key - Storage key
   * @param value - Value to store (will be JSON serialized)
   */
  static async set<T>(key: string, value: T): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      await AsyncStorage.setItem(key, serialized);
    } catch (error) {
      console.error(`[StorageService] Failed to set key "${key}":`, error);
      throw new Error(`Failed to store data for key: ${key}`);
    }
  }

  /**
   * Retrieve a value by key
   * @param key - Storage key
   * @returns Parsed value or null if not found
   */
  static async get<T>(key: string): Promise<T | null> {
    try {
      const value = await AsyncStorage.getItem(key);
      if (value === null) {
        return null;
      }
      return JSON.parse(value) as T;
    } catch (error) {
      console.error(`[StorageService] Failed to get key "${key}":`, error);
      return null;
    }
  }

  /**
   * Retrieve a raw string value by key (no JSON parsing)
   * @param key - Storage key
   * @returns String value or null if not found
   */
  static async getString(key: string): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(key);
    } catch (error) {
      console.error(`[StorageService] Failed to get string key "${key}":`, error);
      return null;
    }
  }

  /**
   * Store a raw string value
   * @param key - Storage key
   * @param value - String value to store
   */
  static async setString(key: string, value: string): Promise<void> {
    try {
      await AsyncStorage.setItem(key, value);
    } catch (error) {
      console.error(`[StorageService] Failed to set string key "${key}":`, error);
      throw new Error(`Failed to store string for key: ${key}`);
    }
  }

  /**
   * Remove a value by key
   * @param key - Storage key to remove
   */
  static async remove(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error(`[StorageService] Failed to remove key "${key}":`, error);
      throw new Error(`Failed to remove data for key: ${key}`);
    }
  }

  /**
   * Store multiple key-value pairs atomically
   * @param entries - Array of [key, value] tuples
   */
  static async multiSet(entries: [string, unknown][]): Promise<void> {
    try {
      const serialized = entries.map(([key, value]) => [
        key,
        JSON.stringify(value),
      ]) as [string, string][];
      await AsyncStorage.multiSet(serialized);
    } catch (error) {
      console.error('[StorageService] Failed to multiSet:', error);
      throw new Error('Failed to store multiple values');
    }
  }

  /**
   * Store multiple string key-value pairs atomically
   * @param entries - Array of [key, value] string tuples
   */
  static async multiSetStrings(entries: [string, string][]): Promise<void> {
    try {
      await AsyncStorage.multiSet(entries);
    } catch (error) {
      console.error('[StorageService] Failed to multiSetStrings:', error);
      throw new Error('Failed to store multiple string values');
    }
  }

  /**
   * Retrieve multiple values by keys
   * @param keys - Array of storage keys
   * @returns Array of parsed values (null for missing keys)
   */
  static async multiGet<T>(keys: string[]): Promise<(T | null)[]> {
    try {
      const results = await AsyncStorage.multiGet(keys);
      return results.map(([, value]) => {
        if (value === null) {
          return null;
        }
        try {
          return JSON.parse(value) as T;
        } catch {
          return null;
        }
      });
    } catch (error) {
      console.error('[StorageService] Failed to multiGet:', error);
      return keys.map(() => null);
    }
  }

  /**
   * Retrieve multiple string values by keys
   * @param keys - Array of storage keys
   * @returns Array of string values (null for missing keys)
   */
  static async multiGetStrings(keys: string[]): Promise<(string | null)[]> {
    try {
      const results = await AsyncStorage.multiGet(keys);
      return results.map(([, value]) => value);
    } catch (error) {
      console.error('[StorageService] Failed to multiGetStrings:', error);
      return keys.map(() => null);
    }
  }

  /**
   * Remove multiple values by keys
   * @param keys - Array of storage keys to remove
   */
  static async multiRemove(keys: string[]): Promise<void> {
    try {
      await AsyncStorage.multiRemove(keys);
    } catch (error) {
      console.error('[StorageService] Failed to multiRemove:', error);
      throw new Error('Failed to remove multiple values');
    }
  }

  /**
   * Get all storage keys
   * @returns Array of all stored keys
   */
  static async getAllKeys(): Promise<string[]> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      return [...keys];
    } catch (error) {
      console.error('[StorageService] Failed to getAllKeys:', error);
      return [];
    }
  }

  /**
   * Clear all storage
   * Use with caution!
   */
  static async clear(): Promise<void> {
    try {
      await AsyncStorage.clear();
    } catch (error) {
      console.error('[StorageService] Failed to clear storage:', error);
      throw new Error('Failed to clear storage');
    }
  }

  /**
   * Check if a key exists in storage
   * @param key - Storage key to check
   * @returns true if key exists, false otherwise
   */
  static async exists(key: string): Promise<boolean> {
    const value = await AsyncStorage.getItem(key);
    return value !== null;
  }
}
