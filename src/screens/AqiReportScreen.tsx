// src/screens/AqiReportScreen.tsx
// Fix in this file:
//   C4 — clearFilter() called loadBucketedData() synchronously after setState,
//        so it still saw the OLD date values. Now clearFilter only sets state;
//        the existing useEffect that watches loadBucketedData handles the re-fetch
//        automatically once the state (and therefore the useCallback) updates.

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Alert,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  Reading,
  BucketedReading,
  filterBucketedReadings,
  fmtDate,
  fmtTime,
} from '../utils';

import { apiService } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface Props {
  readings: Reading[];
  deviceId?: string;
}

export const AqiReportScreen: React.FC<Props> = ({ readings, deviceId }) => {
  const { token } = useAuth();

  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate]     = useState<Date | null>(null);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker,   setShowEndPicker]   = useState(false);
  const [bucketedData,    setBucketedData]    = useState<BucketedReading[]>([]);
  const [filteredBucketed, setFilteredBucketed] = useState<BucketedReading[]>([]);
  const [loading,    setLoading]    = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Fetches aggregated history from the backend, optionally filtered by date range.
  // Deps include startDate/endDate so the callback identity changes when filters change,
  // which in turn triggers the useEffect below to re-fetch automatically.
  const loadBucketedData = useCallback(async () => {
    if (!token || !deviceId) {
      console.log('[AQI Report] Missing credentials:', { hasToken: !!token, deviceId });
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Converts a date to an ISO string at the START of that calendar day (local time).
      // toISOString() then shifts to UTC — this is intentional and consistent with how
      // the backend stores bucket timestamps in UTC.
      const formatStartDate = (date: Date): string => {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        return d.toISOString();
      };

      // Converts a date to an ISO string at the END of that calendar day (local time)
      const formatEndDate = (date: Date): string => {
        const d = new Date(date);
        d.setHours(23, 59, 59, 999);
        return d.toISOString();
      };

      const startISO = startDate ? formatStartDate(startDate) : undefined;
      const endISO   = endDate   ? formatEndDate(endDate)     : undefined;

      console.log('[AQI Report] Fetching history');
      console.log('[AQI Report] Params:', { deviceId, startISO, endISO });

      const response = await apiService.getHistory(deviceId, token, startISO, endISO);
      console.log('[AQI Report] Raw API Response:', JSON.stringify(response, null, 2));

      // Backend always returns { success, count, data: [...] }
      // Guard against unexpected shapes just in case
      const rawData = Array.isArray(response)
        ? response
        : (response?.data || response?.readings || []);

      console.log(`[AQI Report] Found ${rawData.length} records`);

      if (rawData.length === 0) {
        console.log('[AQI Report] No data returned from API');
        setBucketedData([]);
        setFilteredBucketed([]);
        return;
      }

      // Maps each backend DeviceData document into the BucketedReading shape the UI expects.
      // The backend schema stores: device, timestamp, measurementType, sum, count, average, unit.
      const processedData = rawData.map((item: any) => {
        const timestamp = item.timestamp ? new Date(item.timestamp) : new Date();

        // `average` is the field the backend actually persists (sum/count)
        const avg   = item.average || item.avg || item.avgValue || 0;
        const min   = item.minValue !== undefined ? item.minValue : avg;
        const max   = item.maxValue !== undefined ? item.maxValue : avg;
        const count = item.count   !== undefined ? item.count   : 1;

        // Bucket end is always 5 minutes after the bucket start timestamp
        const bucketEnd = item.bucketEnd
          ? new Date(item.bucketEnd)
          : new Date(timestamp.getTime() + 5 * 60 * 1000);

        return {
          ...item,
          bucketStart: timestamp,
          bucketEnd,
          avgValue: Number(avg)   || 0,
          minValue: Number(min)   || 0,
          maxValue: Number(max)   || 0,
          count:    Number(count) || 0,
          readings: item.readings || [avg],
        };
      });

      // Backend sorts newest-first; reverse to chronological for display
      const sortedData = processedData.reverse();

      console.log(`[AQI Report] Processed ${sortedData.length} records`);
      setBucketedData(sortedData);
      setFilteredBucketed(sortedData);

    } catch (error: any) {
      console.error('[AQI Report] API Error:', error);
      console.error('[AQI Report] Error details:', error.message || error);
      setBucketedData([]);
      setFilteredBucketed([]);
      Alert.alert('Error', `Failed to fetch data: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  }, [deviceId, token, startDate, endDate]);

  // Initial fetch + re-fetch whenever loadBucketedData identity changes
  // (which happens when deviceId, token, startDate, or endDate change)
  useEffect(() => {
    loadBucketedData();
  }, [loadBucketedData]);

  // Auto-refresh every 30 s to pick up newly flushed buckets from the app
  useEffect(() => {
    const interval = setInterval(() => {
      loadBucketedData();
    }, 30000);
    return () => clearInterval(interval);
  }, [loadBucketedData]);

  // Pull-to-refresh handler
  const onRefresh = async () => {
    setRefreshing(true);
    await loadBucketedData();
    setRefreshing(false);
  };

  const formatDateForDisplay = (date: Date | null): string => {
    if (!date) return 'Select Date';
    return fmtDate(date);
  };

  // Android date picker dismisses on selection; iOS stays open until user taps away
  const onStartDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShowStartPicker(false);
    if (event.type === 'set' && selectedDate) setStartDate(selectedDate);
  };

  const onEndDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShowEndPicker(false);
    if (event.type === 'set' && selectedDate) setEndDate(selectedDate);
  };

  // Triggers a fetch with the currently-selected dates (useEffect will fire because
  // loadBucketedData already captured the latest startDate/endDate)
  const applyFilter = () => loadBucketedData();

  // FIX C4: Previously this called loadBucketedData() directly after setState.
  // Because setState is asynchronous, loadBucketedData still saw the OLD dates.
  // Now we only set state here. The useEffect([loadBucketedData]) automatically
  // re-fetches once the state update causes useCallback to produce a new identity.
  const clearFilter = () => {
    setStartDate(null);
    setEndDate(null);
    // Do NOT call loadBucketedData() here — let the useEffect handle it
  };

  const dataCount = filteredBucketed.length;

  return (
    <View style={styles.pageContainer}>
      <View style={styles.aqiHeaderContainer}>
        <View style={styles.aqiTitle}>
          <Text style={styles.aqiTitleText}>AQI Report</Text>
          {deviceId && <Text style={styles.deviceSubText}>ID: {deviceId}</Text>}
        </View>

        <View style={styles.filterContainer}>
          <View style={styles.filterRow}>
            <View style={styles.filterGroup}>
              <Text style={styles.filterLabel}>START DATE</Text>
              <TouchableOpacity style={styles.dateButton} onPress={() => setShowStartPicker(true)}>
                <Text style={styles.dateButtonText}>{formatDateForDisplay(startDate)}</Text>
              </TouchableOpacity>
              {showStartPicker && (
                <DateTimePicker
                  value={startDate || new Date()}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={onStartDateChange}
                  maximumDate={new Date()}
                />
              )}
            </View>

            <View style={styles.filterGroup}>
              <Text style={styles.filterLabel}>END DATE</Text>
              <TouchableOpacity style={styles.dateButton} onPress={() => setShowEndPicker(true)}>
                <Text style={styles.dateButtonText}>{formatDateForDisplay(endDate)}</Text>
              </TouchableOpacity>
              {showEndPicker && (
                <DateTimePicker
                  value={endDate || new Date()}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={onEndDateChange}
                  maximumDate={new Date()}
                  minimumDate={startDate || undefined}
                />
              )}
            </View>
          </View>

          <View style={styles.filterButtons}>
            <TouchableOpacity style={styles.applyButton} onPress={applyFilter}>
              <Text style={styles.applyButtonText}>Apply</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.clearButton} onPress={clearFilter}>
              <Text style={styles.clearButtonText}>Clear</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.tableContainer}>
        <View style={styles.tableHeader}>
          <Text style={styles.tableHeaderText}>AQI Report (5-Minute)</Text>
          <Text style={styles.tableHeaderCount}>({dataCount} records)</Text>
        </View>

        {loading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={styles.loadingText}>Fetching...</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.tableScroll}
            nestedScrollEnabled
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />
            }>
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.tableHeaderCell, styles.col35]}>Date</Text>
              <Text style={[styles.tableHeaderCell, styles.col35]}>Time</Text>
              <Text style={[styles.tableHeaderCell, styles.col30]}>Avg PM2.5</Text>
            </View>

            {filteredBucketed.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No records found for this range.</Text>
              </View>
            ) : (
              filteredBucketed.map((bucket, i) => (
                <View key={i} style={[styles.tableRow, i % 2 === 1 && styles.tableRowAlt]}>
                  <Text style={[styles.tableCell, styles.col35]}>
                    {fmtDate(new Date(bucket.bucketStart))}
                  </Text>
                  <Text style={[styles.tableCell, styles.col35]}>
                    {fmtTime(new Date(bucket.bucketStart))}
                  </Text>
                  <Text style={[styles.tableCell, styles.col30]}>
                    {Number(bucket.avgValue).toFixed(2)}
                  </Text>
                </View>
              ))
            )}
          </ScrollView>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  pageContainer:        { padding: 16 },
  aqiHeaderContainer:   { marginBottom: 12 },
  aqiTitle:             { marginBottom: 8 },
  aqiTitleText:         { fontSize: 18, fontWeight: '600', color: '#fff' },
  deviceSubText:        { fontSize: 10, color: '#3b82f6', marginTop: 2 },
  filterContainer:      { backgroundColor: '#27272a', borderWidth: 1, borderColor: '#3f3f46', borderRadius: 8, padding: 12 },
  filterRow:            { flexDirection: 'row', marginBottom: 8 },
  filterGroup:          { flex: 1, marginHorizontal: 4 },
  filterLabel:          { fontSize: 10, color: '#a1a1aa', marginBottom: 4, letterSpacing: 0.5 },
  dateButton:           { backgroundColor: '#18181b', borderWidth: 1, borderColor: '#3f3f46', borderRadius: 6, padding: 10, alignItems: 'center' },
  dateButtonText:       { color: '#fff', fontSize: 14 },
  filterButtons:        { flexDirection: 'row', justifyContent: 'space-between' },
  applyButton:          { flex: 1, backgroundColor: '#fff', padding: 10, borderRadius: 6, alignItems: 'center', marginHorizontal: 4 },
  applyButtonText:      { color: '#18181b', fontSize: 14, fontWeight: '500' },
  clearButton:          { flex: 1, borderWidth: 1, borderColor: '#52525b', padding: 10, borderRadius: 6, alignItems: 'center', marginHorizontal: 4 },
  clearButtonText:      { color: '#e4e4e7', fontSize: 14 },
  tableContainer:       { backgroundColor: '#18181b', borderWidth: 1, borderColor: '#27272a', borderRadius: 8, overflow: 'hidden' },
  tableHeader:          { padding: 12, backgroundColor: '#27272a', borderBottomWidth: 1, borderBottomColor: '#27272a' },
  tableHeaderText:      { fontSize: 12, fontWeight: '600', color: '#e4e4e7' },
  tableHeaderCount:     { fontSize: 11, color: '#71717a' },
  tableScroll:          { maxHeight: 400 },
  tableHeaderRow:       { flexDirection: 'row', backgroundColor: '#3f3f46', padding: 12 },
  tableHeaderCell:      { fontSize: 12, fontWeight: '600', color: '#fff' },
  col35:                { width: '35%' },
  col30:                { width: '30%' },
  tableRow:             { flexDirection: 'row', padding: 12, alignItems: 'center' },
  tableRowAlt:          { backgroundColor: '#0a0a0b' },
  tableCell:            { fontSize: 12, color: '#d4d4d8' },
  tableCellSmall:       { fontSize: 10, color: '#d4d4d8', lineHeight: 14 },
  loadingContainer:     { padding: 32, alignItems: 'center' },
  loadingText:          { color: '#a1a1aa', marginTop: 12, fontSize: 14 },
  emptyContainer:       { padding: 32, alignItems: 'center' },
  emptyText:            { fontSize: 12, color: '#71717a', textAlign: 'center' },
});