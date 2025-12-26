import React, { useState, useEffect } from 'react';
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
import { storageService } from '../services/storage';
import { apiService } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface Props {
  readings: Reading[];
  deviceId?: string;
}

export const AqiReportScreen: React.FC<Props> = ({ readings, deviceId = '' }) => {
  const { token } = useAuth();
  
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [bucketedData, setBucketedData] = useState<BucketedReading[]>([]);
  const [filteredBucketed, setFilteredBucketed] = useState<BucketedReading[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [dataSource, setDataSource] = useState<'local' | 'backend'>('local');

  useEffect(() => {
    loadBucketedData();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      loadBucketedData();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Convert backend readings to bucketed format
  const convertBackendReadingsToBucketed = (backendReadings: any[]): BucketedReading[] => {
    console.log('[AQI Report] Converting', backendReadings.length, 'backend readings');
    
    return backendReadings.map(reading => {
      const timestamp = new Date(reading.timestamp);
      const value = reading.value || reading.average || 0;
      
      return {
        bucketStart: timestamp,
        bucketEnd: new Date(timestamp.getTime() + 5 * 60 * 1000),
        avgValue: value,
        minValue: reading.metadata?.min || value,
        maxValue: reading.metadata?.max || value,
        count: reading.metadata?.count || reading.count || 1,
        readings: [value],
      };
    });
  };

  // Merge local and backend readings
  const mergeReadings = (
    local: BucketedReading[], 
    backend: BucketedReading[]
  ): BucketedReading[] => {
    const merged = new Map<number, BucketedReading>();
    
    local.forEach(reading => {
      const key = reading.bucketStart.getTime();
      merged.set(key, reading);
    });
    
    backend.forEach(reading => {
      const key = reading.bucketStart.getTime();
      merged.set(key, reading);
    });
    
    return Array.from(merged.values()).sort(
      (a, b) => a.bucketStart.getTime() - b.bucketStart.getTime()
    );
  };

  const getStartOfDay = (date: Date): Date => {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    return start;
  };

  const getEndOfDay = (date: Date): Date => {
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    return end;
  };

  const loadBucketedData = async () => {
    try {
      setLoading(true);
      
      const localData = await storageService.loadReadings();
      console.log('[AQI Report] ===== DATA FETCH DEBUG =====');
      console.log('[AQI Report] Local data count:', localData.length);
      console.log('[AQI Report] Token available:', !!token);
      console.log('[AQI Report] Device ID:', deviceId);
      console.log('[AQI Report] Start date:', startDate?.toISOString());
      console.log('[AQI Report] End date:', endDate?.toISOString());
      
      if (token && startDate && endDate && deviceId) {
        try {
          const fromISO = getStartOfDay(startDate).toISOString();
          const toISO = getEndOfDay(endDate).toISOString();
          
          console.log('[AQI Report] 🔵 Fetching from backend...');
          console.log('[AQI Report] Query params:', {
            deviceId,
            from: fromISO,
            to: toISO,
          });
          
          const backendReadings = await apiService.getHistory(
            {
              deviceId: deviceId,
              from: fromISO,
              to: toISO,
            },
            token
          );
          
          console.log('[AQI Report] ✅ Backend response:', backendReadings.length, 'readings');
          console.log('[AQI Report] First reading sample:', JSON.stringify(backendReadings[0], null, 2));
          
          if (backendReadings.length > 0) {
            const backendBucketed = convertBackendReadingsToBucketed(backendReadings);
            console.log('[AQI Report] Converted to', backendBucketed.length, 'bucketed readings');
            
            const mergedData = mergeReadings(localData, backendBucketed);
            console.log('[AQI Report] Merged data total:', mergedData.length, 'readings');
            
            setBucketedData(mergedData);
            setDataSource('backend');
            
            const startISO = formatDateToISO(startDate);
            const endISO = formatDateToISO(endDate);
            const filtered = filterBucketedReadings(mergedData, startISO, endISO);
            console.log('[AQI Report] After filter:', filtered.length, 'readings');
            setFilteredBucketed(filtered);
          } else {
            console.log('[AQI Report] ⚠️ Backend returned 0 readings');
            setBucketedData(localData);
            setDataSource('local');
            
            const startISO = formatDateToISO(startDate);
            const endISO = formatDateToISO(endDate);
            setFilteredBucketed(
              filterBucketedReadings(localData, startISO, endISO)
            );
          }
        } catch (apiError: any) {
          console.error('[AQI Report] ❌ Backend error:', apiError.message);
          console.error('[AQI Report] Full error:', apiError);
          setBucketedData(localData);
          setDataSource('local');
          
          if (startDate && endDate) {
            const startISO = formatDateToISO(startDate);
            const endISO = formatDateToISO(endDate);
            setFilteredBucketed(
              filterBucketedReadings(localData, startISO, endISO)
            );
          } else {
            setFilteredBucketed(
              filterBucketedReadings(localData, null, null)
            );
          }
        }
      } else {
        console.log('[AQI Report] ℹ️ Using local data only');
        console.log('[AQI Report] Reason:', {
          hasToken: !!token,
          hasStartDate: !!startDate,
          hasEndDate: !!endDate,
          hasDeviceId: !!deviceId,
        });
        
        setBucketedData(localData);
        setDataSource('local');
        
        const startISO = startDate ? formatDateToISO(startDate) : null;
        const endISO = endDate ? formatDateToISO(endDate) : null;
        setFilteredBucketed(
          filterBucketedReadings(localData, startISO, endISO)
        );
      }
      
      console.log('[AQI Report] ===== END DEBUG =====');
    } catch (error) {
      console.error('[AQI Report] Error:', error);
      Alert.alert('Error', 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadBucketedData();
    setRefreshing(false);
  };

  const formatDateToISO = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatDateForDisplay = (date: Date | null): string => {
    if (!date) return 'Select Date';
    return fmtDate(date);
  };

  const onStartDateChange = (event: any, selectedDate?: Date) => {
    setShowStartPicker(Platform.OS === 'ios');
    if (selectedDate) {
      setStartDate(selectedDate);
    }
  };

  const onEndDateChange = (event: any, selectedDate?: Date) => {
    setShowEndPicker(Platform.OS === 'ios');
    if (selectedDate) {
      setEndDate(selectedDate);
    }
  };

  // New function to apply filter and fetch data
  const applyDateFilter = async () => {
    if (!startDate || !endDate) {
      Alert.alert('Error', 'Please select both FROM and TO dates');
      return;
    }
    
    if (startDate > endDate) {
      Alert.alert('Error', 'FROM date must be before TO date');
      return;
    }
    
    await loadBucketedData();
  };

  const clearFilter = () => {
    setStartDate(null);
    setEndDate(null);
    setFilteredBucketed(filterBucketedReadings(bucketedData, null, null));
    loadBucketedData();
  };

  const fetchLastWeek = async () => {
    if (!token || !deviceId) {
      Alert.alert('Error', 'Please connect to a device first');
      return;
    }
    
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    setStartDate(weekAgo);
    setEndDate(now);
    
    setTimeout(() => {
      loadBucketedData();
    }, 100);
  };

  const dataCount = filteredBucketed.length;

  return (
    <View style={styles.pageContainer}>
      <View style={styles.aqiHeaderContainer}>
        <View style={styles.aqiTitleRow}>
          <Text style={styles.aqiTitleText}>AQI Report</Text>
        </View>

        <View style={styles.filterContainer}>
          <View style={styles.filterRow}>
            <View style={styles.filterGroup}>
              <Text style={styles.filterLabel}>FROM DATE</Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowStartPicker(true)}>
                <Text style={styles.dateButtonText}>
                  {formatDateForDisplay(startDate)}
                </Text>
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
              <Text style={styles.filterLabel}>TO DATE</Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowEndPicker(true)}>
                <Text style={styles.dateButtonText}>
                  {formatDateForDisplay(endDate)}
                </Text>
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
            <TouchableOpacity 
              style={[styles.applyButton, (!startDate || !endDate) && styles.applyButtonDisabled]} 
              onPress={applyDateFilter}
              disabled={!startDate || !endDate}>
              <Text style={styles.applyButtonText}>Apply Filter</Text>
            </TouchableOpacity>
            
            {(startDate || endDate) && (
              <TouchableOpacity style={styles.clearButton} onPress={clearFilter}>
                <Text style={styles.clearButtonText}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      <View style={styles.tableContainer}>
        <View style={styles.tableHeader}>
          <Text style={styles.tableHeaderText}>
            AQI Report (5-Minute Interval)
          </Text>
          <Text style={styles.tableHeaderCount}>({dataCount} records)</Text>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={styles.loadingText}>Loading data...</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.tableScroll}
            nestedScrollEnabled
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#3b82f6"
              />
            }>
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.tableHeaderCell, styles.col33]}>Date</Text>
              <Text style={[styles.tableHeaderCell, styles.col33]}>Time</Text>
              <Text style={[styles.tableHeaderCell, styles.col33]}>Avg PM2.5</Text>
            </View>
            {filteredBucketed.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  {startDate || endDate 
                    ? 'No data for selected date range.' 
                    : 'No data available. Connect your device to start collecting data.'}
                </Text>
                {token && !deviceId && (
                  <Text style={styles.emptySubtext}>
                    Tip: Connect to your Bluetooth device first
                  </Text>
                )}
              </View>
            ) : (
              filteredBucketed.map((bucket, i) => (
                <View
                  key={i}
                  style={[
                    styles.tableRow,
                    i % 2 === 1 && styles.tableRowAlt,
                  ]}>
                  <Text style={[styles.tableCell, styles.col33]}>
                    {fmtDate(bucket.bucketStart)}
                  </Text>
                  <Text style={[styles.tableCell, styles.col33]}>
                    {fmtTime(bucket.bucketStart)}
                  </Text>
                  <Text style={[styles.tableCell, styles.col33]}>
                    {bucket.avgValue.toFixed(2)} µg/m³
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
  pageContainer: { padding: 16 },
  aqiHeaderContainer: { marginBottom: 12 },
  aqiTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  aqiTitleText: { fontSize: 18, fontWeight: '600', color: '#fff' },
  dataSourceBadge: { backgroundColor: '#27272a', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: '#3f3f46' },
  dataSourceText: { fontSize: 11, color: '#a1a1aa', fontWeight: '600' },
  filterContainer: { backgroundColor: '#27272a', borderWidth: 1, borderColor: '#3f3f46', borderRadius: 8, padding: 12 },
  filterRow: { flexDirection: 'row', marginBottom: 0 },
  filterGroup: { flex: 1, marginHorizontal: 4 },
  filterLabel: { fontSize: 10, color: '#a1a1aa', marginBottom: 4, letterSpacing: 0.5, fontWeight: '600' },
  dateButton: { backgroundColor: '#18181b', borderWidth: 1, borderColor: '#3f3f46', borderRadius: 6, padding: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  dateButtonText: { color: '#fff', fontSize: 14 },
  filterButtons: { flexDirection: 'row', marginTop: 8, gap: 8 },
  applyButton: { flex: 1, backgroundColor: '#3b82f6', padding: 12, borderRadius: 6, alignItems: 'center' },
  applyButtonDisabled: { backgroundColor: '#52525b', opacity: 0.5 },
  applyButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  clearButton: { flex: 1, borderWidth: 1, borderColor: '#52525b', padding: 12, borderRadius: 6, alignItems: 'center' },
  clearButtonText: { color: '#e4e4e7', fontSize: 14 },
  tableContainer: { backgroundColor: '#18181b', borderWidth: 1, borderColor: '#27272a', borderRadius: 8, overflow: 'hidden' },
  tableHeader: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#27272a', borderBottomWidth: 1, borderBottomColor: '#27272a' },
  tableHeaderText: { fontSize: 12, fontWeight: '600', color: '#e4e4e7' },
  tableHeaderCount: { fontSize: 11, color: '#71717a', marginLeft: 4 },
  tableScroll: { maxHeight: 400 },
  tableHeaderRow: { flexDirection: 'row', backgroundColor: '#3f3f46', padding: 12 },
  tableHeaderCell: { fontSize: 12, fontWeight: '600', color: '#fff' },
  col33: { width: '33.33%' },
  tableRow: { flexDirection: 'row', padding: 12, alignItems: 'center' },
  tableRowAlt: { backgroundColor: '#0a0a0b' },
  tableCell: { fontSize: 12, color: '#d4d4d8' },
  tableCellSmall: { fontSize: 10, color: '#d4d4d8', lineHeight: 14 },
  loadingContainer: { padding: 32, alignItems: 'center' },
  loadingText: { color: '#a1a1aa', marginTop: 12, fontSize: 14 },
  emptyContainer: { padding: 16 },
  emptyText: { fontSize: 12, color: '#71717a' },
  emptySubtext: { fontSize: 11, color: '#52525b', marginTop: 8, fontStyle: 'italic' },
});