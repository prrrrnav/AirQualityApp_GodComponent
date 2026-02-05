// src/screens/AqiReportScreen.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Alert,
  FlatList,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Reading, BucketedReading, fmtDate, fmtTime } from '../utils';
import { apiService } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface Props {
  readings: Reading[];
  deviceId?: string;
}

export const AqiReportScreen: React.FC<Props> = ({ deviceId }) => {
  const { token } = useAuth();

  const isPickingRef = useRef(false);
  // 1. Selection State (Temp dates used by the pickers)
  const [startSelection, setStartSelection] = useState<Date | null>(null);
  const [endSelection, setEndSelection] = useState<Date | null>(null);

  // 2. Applied State (Actual dates used for the API request)
  const [appliedStart, setAppliedStart] = useState<Date | null>(null);
  const [appliedEnd, setAppliedEnd] = useState<Date | null>(null);

  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [bucketedData, setBucketedData] = useState<BucketedReading[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const loadBucketedData = useCallback(async (forcedStart?: Date | null, forcedEnd?: Date | null) => {
    if (!token || !deviceId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Use forced values (for Clear action) or the applied state
      const targetStart = forcedStart !== undefined ? forcedStart : appliedStart;
      const targetEnd = forcedEnd !== undefined ? forcedEnd : appliedEnd;

      const formatStartDate = (date: Date): string => {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        return d.toISOString();
      };

      const formatEndDate = (date: Date): string => {
        const d = new Date(date);
        d.setHours(23, 59, 59, 999);
        return d.toISOString();
      };

      const startISO = targetStart ? formatStartDate(targetStart) : undefined;
      const endISO = targetEnd ? formatEndDate(targetEnd) : undefined;

      const response = await apiService.getHistory(deviceId, token, startISO, endISO);

      const rawData = Array.isArray(response) ? response : (response?.data || []);

      if (rawData.length === 0) {
        setBucketedData([]);
        return;
      }

      const processedData = rawData.map((item: any) => ({
        ...item,
        bucketStart: new Date(item.timestamp || item.bucketStart),
        avgValue: Number(item.average || item.avg || 0),
      })).reverse();

      setBucketedData(processedData);
    } catch (error: any) {
      Alert.alert('Error', `Failed to fetch data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [deviceId, token, appliedStart, appliedEnd]);

  // Initial load and periodic refresh
  useEffect(() => {
    loadBucketedData();
    const interval = setInterval(() => loadBucketedData(), 30000);
    return () => clearInterval(interval);
  }, [loadBucketedData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadBucketedData();
    setRefreshing(false);
  };

  const applyFilter = () => {
    // Only update the applied state when button is clicked
    setAppliedStart(startSelection);
    setAppliedEnd(endSelection);
  };

  const clearFilter = () => {
    setStartSelection(null);
    setEndSelection(null);
    setAppliedStart(null);
    setAppliedEnd(null);
    // Force a reload with null values immediately
    loadBucketedData(null, null);
  };

  const renderItem = ({ item, index }: { item: BucketedReading; index: number }) => (
    <View style={[styles.tableRow, index % 2 === 1 && styles.tableRowAlt]}>
      <Text style={[styles.tableCell, styles.col35]}>{fmtDate(item.bucketStart)}</Text>
      <Text style={[styles.tableCell, styles.col35]}>{fmtTime(item.bucketStart)}</Text>
      <Text style={[styles.tableCell, styles.col30]}>{Number(item.avgValue).toFixed(2)}</Text>
    </View>
  );

  const onStartChange = (event: any, d?: Date) => {
    if (Platform.OS === 'android') setShowStartPicker(false);
    
    if (event.type === 'set' && d) {
      setStartSelection(d);
      isPickingRef.current = false; // Release the lock
    } else {
      setShowStartPicker(false);
      isPickingRef.current = false;
    }
  };

  // HANDLER: Optimized End Date
  const onEndChange = (event: any, d?: Date) => {
    if (Platform.OS === 'android') setShowEndPicker(false);
    
    if (event.type === 'set' && d) {
      setEndSelection(d);
      isPickingRef.current = false;
    } else {
      setShowEndPicker(false);
      isPickingRef.current = false;
    }
  };
  
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
              <TouchableOpacity 
                style={styles.dateButton} 
                onPress={() => {
                  // Explicitly set focus lock before showing picker
                  setShowStartPicker(true);
                }}
              >
                <Text style={styles.dateButtonText}>
                  {startSelection ? fmtDate(startSelection) : 'Select Start'}
                </Text>
              </TouchableOpacity>

              {showStartPicker && (
                <DateTimePicker
                  // Tie value strictly to startSelection state or fallback to today once
                  value={startSelection || new Date()}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  maximumDate={new Date()} 
                  onChange={(event, d) => {
                    // Close picker first on Android to avoid UI collision
                    if (Platform.OS === 'android') setShowStartPicker(false);

                    if (event.type === 'set' && d) {
                      setStartSelection(d);
                    } else if (event.type === 'dismissed') {
                      setShowStartPicker(false);
                    }
                  }}
                />
              )}
            </View>

            <View style={styles.filterGroup}>
              <Text style={styles.filterLabel}>END DATE</Text>
              <TouchableOpacity 
                style={styles.dateButton} 
                onPress={() => {
                  setShowEndPicker(true);
                }}
              >
                <Text style={styles.dateButtonText}>
                  {endSelection ? fmtDate(endSelection) : 'Select End'}
                </Text>
              </TouchableOpacity>

              {showEndPicker && (
                <DateTimePicker
                  value={endSelection || new Date()}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  maximumDate={new Date()}
                  onChange={(event, d) => {
                    if (Platform.OS === 'android') setShowEndPicker(false);

                    if (event.type === 'set' && d) {
                      setEndSelection(d);
                    } else if (event.type === 'dismissed') {
                      setShowEndPicker(false);
                    }
                  }}
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
          <Text style={styles.tableHeaderText}>History (5-Minute Avg)</Text>
          <Text style={styles.tableHeaderCount}>({bucketedData.length} records)</Text>
        </View>

        <FlatList
          data={bucketedData}
          renderItem={renderItem}
          keyExtractor={(item, index) => index.toString()}
          style={styles.tableScroll}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          // Optimization: Headers stay at the top of the table
          ListHeaderComponent={() => (
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.tableHeaderCell, styles.col35]}>Date</Text>
              <Text style={[styles.tableHeaderCell, styles.col35]}>Time</Text>
              <Text style={[styles.tableHeaderCell, styles.col30]}>Avg PM2.5</Text>
            </View>
          )}
          stickyHeaderIndices={[0]} // Ensure columns stay visible while scrolling
          ListEmptyComponent={() => (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {loading ? 'Fetching history...' : 'No records found for this range.'}
              </Text>
            </View>
          )}
        />
      </View>
    </View>
  );};

const styles = StyleSheet.create({
  pageContainer: { padding: 16 },
  aqiHeaderContainer: { marginBottom: 12 },
  aqiTitle: { marginBottom: 8 },
  aqiTitleText: { fontSize: 18, fontWeight: '600', color: '#fff' },
  deviceSubText: { fontSize: 10, color: '#3b82f6', marginTop: 2 },
  filterContainer: { backgroundColor: '#27272a', borderWidth: 1, borderColor: '#3f3f46', borderRadius: 8, padding: 12 },
  filterRow: { flexDirection: 'row', marginBottom: 8 },
  filterGroup: { flex: 1, marginHorizontal: 4 },
  filterLabel: { fontSize: 10, color: '#a1a1aa', marginBottom: 4 },
  dateButton: { backgroundColor: '#18181b', borderWidth: 1, borderColor: '#3f3f46', borderRadius: 6, padding: 10, alignItems: 'center' },
  dateButtonText: { color: '#fff', fontSize: 14 },
  filterButtons: { flexDirection: 'row', justifyContent: 'space-between' },
  applyButton: { flex: 1, backgroundColor: '#fff', padding: 10, borderRadius: 6, alignItems: 'center', marginHorizontal: 4 },
  applyButtonText: { color: '#18181b', fontSize: 14, fontWeight: '500' },
  clearButton: { flex: 1, borderWidth: 1, borderColor: '#52525b', padding: 10, borderRadius: 6, alignItems: 'center', marginHorizontal: 4 },
  clearButtonText: { color: '#e4e4e7', fontSize: 14 },
  tableContainer: { backgroundColor: '#18181b', borderWidth: 1, borderColor: '#27272a', borderRadius: 8, overflow: 'hidden', height: 400 },
  tableHeader: { padding: 12, backgroundColor: '#27272a', borderBottomWidth: 1, borderBottomColor: '#27272a' },
  tableHeaderText: { fontSize: 12, fontWeight: '600', color: '#e4e4e7' },
  tableHeaderCount: { fontSize: 11, color: '#71717a' },
  tableScroll: { flex: 1 },
  tableHeaderRow: { flexDirection: 'row', backgroundColor: '#3f3f46', padding: 12 },
  tableHeaderCell: { fontSize: 12, fontWeight: '600', color: '#fff' },
  col35: { width: '35%' },
  col30: { width: '30%' },
  tableRow: { flexDirection: 'row', padding: 12, alignItems: 'center' },
  tableRowAlt: { backgroundColor: '#0a0a0b' },
  tableCell: { fontSize: 12, color: '#d4d4d8' },
  emptyContainer: { padding: 32, alignItems: 'center' },
  emptyText: { fontSize: 12, color: '#71717a' },
});