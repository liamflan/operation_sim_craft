import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

/**
 * M1 - Mobile Runtime & Persistence
 * 
 * Future-account-ready persistence boundaries:
 * 1. Local Cache (This Service): 
 *    Provides ephemeral cross-platform caching for Workspace state, last active plan,
 *    and non-sensitive UI state. This prevents native crashes on `localStorage` calls.
 *    Treat this purely as a cache/convenience layer, NOT the long-term source of truth.
 * 
 * 2. Secure Storage (Future):
 *    Will be reserved for auth/session secrets (`expo-secure-store`).
 * 
 * 3. Backend/Cloud (Future):
 *    Will become the ultimate source of truth for accounts and plan syncing.
 */

export const StorageService = {
  async getItem(key: string): Promise<string | null> {
    try {
      if (Platform.OS === 'web') {
        const item = localStorage.getItem(key);
        return item ? item : null;
      }
      return await AsyncStorage.getItem(key);
    } catch (e) {
      console.warn(`[StorageService] Failed to retrieve key ${key}:`, e);
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        localStorage.setItem(key, value);
      } else {
        await AsyncStorage.setItem(key, value);
      }
    } catch (e) {
      console.warn(`[StorageService] Failed to set key ${key}:`, e);
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        localStorage.removeItem(key);
      } else {
        await AsyncStorage.removeItem(key);
      }
    } catch (e) {
      console.warn(`[StorageService] Failed to remove key ${key}:`, e);
    }
  },

  async clear(): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        localStorage.clear();
      } else {
        await AsyncStorage.clear();
      }
    } catch (e) {
      console.warn(`[StorageService] Failed to clear storage:`, e);
    }
  },

  /**
   * TEMP_HARD_RESET_ON_LAUNCH
   * Wipes all Provision app state from local storage.
   */
  async clearAllAppState(): Promise<void> {
    console.log('[StorageService] Performing hard reset on launch...');
    await this.clear();
  }
};
