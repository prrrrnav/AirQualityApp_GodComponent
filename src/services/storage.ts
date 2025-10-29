// src/services/storage.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BucketedReading } from '../utils';

const STORAGE_KEY = '@shudhvayu_readings';
const MAX_STORED_DAYS = 30; // Keep last 30 days

export const storageService = {
  /**
   * Save all bucketed readings to AsyncStorage
   */
  async saveReadings(readings: BucketedReading[]): Promise<void> {
    try {
      const json = JSON.stringify(readings);
      await AsyncStorage.setItem(STORAGE_KEY, json);
      console.log('[Storage] Saved', readings.length, 'bucketed readings');
    } catch (error) {
      console.error('[Storage] Error saving readings:', error);
      throw error;
    }
  },

  /**
   * Load all bucketed readings from AsyncStorage
   */
  async loadReadings(): Promise<BucketedReading[]> {
    try {
      const json = await AsyncStorage.getItem(STORAGE_KEY);
      if (!json) {
        console.log('[Storage] No stored readings found');
        return [];
      }

      const readings = JSON.parse(json);
      console.log('[Storage] Loaded', readings.length, 'bucketed readings');

      // Convert ISO strings back to Date objects
      return readings.map((r: any) => ({
        ...r,
        bucketStart: new Date(r.bucketStart),
        bucketEnd: new Date(r.bucketEnd),
      }));
    } catch (error) {
      console.error('[Storage] Error loading readings:', error);
      return [];
    }
  },

  /**
   * Append a new bucketed reading to storage
   */
  async appendReading(reading: BucketedReading): Promise<void> {
    try {
      const existing = await this.loadReadings();

      // Check if bucket already exists (update instead of duplicate)
      const existingIndex = existing.findIndex(
        r => r.bucketStart.getTime() === reading.bucketStart.getTime()
      );

      if (existingIndex >= 0) {
        // Update existing bucket
        existing[existingIndex] = reading;
        console.log('[Storage] Updated existing bucket at', reading.bucketStart);
      } else {
        // Add new bucket
        existing.push(reading);
        console.log('[Storage] Appended new bucket at', reading.bucketStart);
      }

      // Cleanup old data beyond retention period
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - MAX_STORED_DAYS);
      const filtered = existing.filter(r => r.bucketStart >= cutoffDate);

      if (filtered.length < existing.length) {
        console.log(
          '[Storage] Cleaned up',
          existing.length - filtered.length,
          'old readings'
        );
      }

      // Sort by time
      filtered.sort((a, b) => a.bucketStart.getTime() - b.bucketStart.getTime());

      await this.saveReadings(filtered);
    } catch (error) {
      console.error('[Storage] Error appending reading:', error);
      throw error;
    }
  },

  /**
   * Append multiple bucketed readings at once
   */
  async appendReadings(readings: BucketedReading[]): Promise<void> {
    try {
      const existing = await this.loadReadings();
      const bucketMap = new Map<number, BucketedReading>();

      // Add existing to map
      existing.forEach(r => {
        bucketMap.set(r.bucketStart.getTime(), r);
      });

      // Add/update with new readings
      readings.forEach(r => {
        bucketMap.set(r.bucketStart.getTime(), r);
      });

      // Convert back to array
      const merged = Array.from(bucketMap.values());

      // Cleanup old data
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - MAX_STORED_DAYS);
      const filtered = merged.filter(r => r.bucketStart >= cutoffDate);

      // Sort by time
      filtered.sort((a, b) => a.bucketStart.getTime() - b.bucketStart.getTime());

      await this.saveReadings(filtered);
      console.log('[Storage] Appended', readings.length, 'readings');
    } catch (error) {
      console.error('[Storage] Error appending readings:', error);
      throw error;
    }
  },

  /**
   * Clear all stored readings
   */
  async clearReadings(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
      console.log('[Storage] Cleared all readings');
    } catch (error) {
      console.error('[Storage] Error clearing readings:', error);
      throw error;
    }
  },

  /**
   * Get statistics about stored data
   */
  async getStorageStats(): Promise<{
    totalBuckets: number;
    oldestReading: Date | null;
    newestReading: Date | null;
    sizeEstimate: number;
  }> {
    try {
      const readings = await this.loadReadings();
      const json = JSON.stringify(readings);

      return {
        totalBuckets: readings.length,
        oldestReading: readings.length > 0 ? readings[0].bucketStart : null,
        newestReading:
          readings.length > 0 ? readings[readings.length - 1].bucketStart : null,
        sizeEstimate: json.length, // bytes
      };
    } catch (error) {
      console.error('[Storage] Error getting stats:', error);
      return {
        totalBuckets: 0,
        oldestReading: null,
        newestReading: null,
        sizeEstimate: 0,
      };
    }
  },
};