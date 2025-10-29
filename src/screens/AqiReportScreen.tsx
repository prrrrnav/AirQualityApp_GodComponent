// src/screens/AqiReportScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Icon } from '../components/Icon';
import {
  Reading,
  BucketedReading,
  filterReadings,
  filterBucketedReadings,
  fmtDate,
  fmtTime,
} from '../utils';
import { storageService } from '../services/storage';

// Define the props
interface Props {
  readings: Reading[];
}

type ViewMode = 'raw' | 'bucketed';

export const AqiReportScreen: React.FC<Props> = ({ readings }) => {
  // State
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [filtered, setFiltered] = useState<Reading[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('bucketed');
  const [bucketedData, setBucketedData] = useState<BucketedReading[]>([]);
  const [filteredBucketed, setFilteredBucketed] = useState<BucketedReading[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [storageStats, setStorageStats] = useState<{
    totalBuckets: number;
    oldestReading: Date | null;
    newestReading: Date | null;
  } | null>(null);

  // Load bucketed data on mount
  useEffect(() => {
    loadBucketedData();
  }, []);

  // Auto-refresh bucketed data every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadBucketedData();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, []);

  const loadBucketedData = async () => {
    try {
      setLoading(true);
      const stored = await storageService.loadReadings();
      setBucketedData(stored);
      setFilteredBucketed(
        filterBucketedReadings(stored, startDate || null, endDate || null)
      );

      // Load storage stats
      const stats = await storageService.getStorageStats();
      setStorageStats(stats);

      console.log('[AQI Report] Loaded', stored.length, 'bucketed readings');
    } catch (error) {
      console.error('[AQI Report] Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadBucketedData();
    setRefreshing(false);
  };

  // Apply filter based on current view mode
  const applyFilter = () => {
    if (viewMode === 'bucketed') {
      setFilteredBucketed(
        filterBucketedReadings(bucketedData, startDate || null, endDate || null)
      );
    } else {
      setFiltered(filterReadings(readings, startDate || null, endDate || null));
    }
  };

  const clearFilter = () => {
    setStartDate('');
    setEndDate('');
    if (viewMode === 'bucketed') {
      setFilteredBucketed(filterBucketedReadings(bucketedData, null, null));
    } else {
      setFiltered(filterReadings(readings, null, null));
    }
  };

  // Auto-filter when dates change
  useEffect(() => {
    if (!startDate && !endDate) {
      if (viewMode === 'bucketed') {
        setFilteredBucketed(filterBucketedReadings(bucketedData, null, null));
      } else {
        setFiltered(filterReadings(readings, null, null));
      }
    }
  }, [readings, bucketedData, startDate, endDate, viewMode]);

  // Switch view mode
  const switchViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    if (mode === 'bucketed') {
      setFilteredBucketed(
        filterBucketedReadings(bucketedData, startDate || null, endDate || null)
      );
    } else {
      setFiltered(filterReadings(readings, startDate || null, endDate || null));
    }
  };

  const dataToDisplay = viewMode === 'bucketed' ? filteredBucketed : filtered;
  const dataCount = viewMode === 'bucketed' ? filteredBucketed.length : filtered.length;

  return (
    <View style={styles.pageContainer}>
      {/* AQI Header with Filters */}
      <View style={styles.aqiHeaderContainer}>
        <View style={styles.aqiTitle}>
          <Icon name="wind" size={20} color="#fff" />
          <Text style={styles.aqiTitleText}>AQI Report</Text>
        </View>

        {/* Storage Stats */}
        {storageStats && (
          <View style={styles.statsContainer}>
            <Text style={styles.statsText}>
              📊 {storageStats.totalBuckets} buckets stored
              {storageStats.oldestReading && storageStats.newestReading && (
                <Text style={styles.statsTextSub}>
                  {' '}
                  • {fmtDate(storageStats.oldestReading)} to{' '}
                  {fmtDate(storageStats.newestReading)}
                </Text>
              )}
            </Text>
          </View>
        )}

        {/* View Mode Toggle */}
        <View style={styles.viewModeContainer}>
          <TouchableOpacity
            style={[
              styles.modeButton,
              viewMode === 'raw' && styles.modeButtonActive,
            ]}
            onPress={() => switchViewMode('raw')}>
            <Text
              style={[
                styles.modeButtonText,
                viewMode === 'raw' && styles.modeButtonTextActive,
              ]}>
              Raw Data
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.modeButton,
              viewMode === 'bucketed' && styles.modeButtonActive,
            ]}
            onPress={() => switchViewMode('bucketed')}>
            <Text
              style={[
                styles.modeButtonText,
                viewMode === 'bucketed' && styles.modeButtonTextActive,
              ]}>
              5-Min Averages
            </Text>
          </TouchableOpacity>
        </View>

        {/* Filter Inputs */}
        <View style={styles.filterContainer}>
          <View style={styles.filterRow}>
            <View style={styles.filterGroup}>
              <Text style={styles.filterLabel}>START DATE</Text>
              <TextInput
                style={styles.dateInput}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#71717a"
                value={startDate}
                onChangeText={setStartDate}
              />
            </View>

            <View style={styles.filterGroup}>
              <Text style={styles.filterLabel}>END DATE</Text>
              <TextInput
                style={styles.dateInput}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#71717a"
                value={endDate}
                onChangeText={setEndDate}
              />
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

      {/* Results Table */}
      <View style={styles.tableContainer}>
        <View style={styles.tableHeader}>
          <Icon name="activity" size={16} color="#e4e4e7" />
          <Text style={styles.tableHeaderText}>
            {viewMode === 'bucketed' ? 'Bucketed Data (5-min avg)' : 'Raw Data'}
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
            {viewMode === 'bucketed' ? (
              <>
                <View style={styles.tableHeaderRow}>
                  <Text style={[styles.tableHeaderCell, styles.col25]}>Date</Text>
                  <Text style={[styles.tableHeaderCell, styles.col25]}>Time</Text>
                  <Text style={[styles.tableHeaderCell, styles.col25]}>Avg PM2.5</Text>
                  <Text style={[styles.tableHeaderCell, styles.col25]}>Min/Max</Text>
                </View>
                {filteredBucketed.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>
                      No data for selected range.
                    </Text>
                  </View>
                ) : (
                  filteredBucketed.map((bucket, i) => (
                    <View
                      key={i}
                      style={[
                        styles.tableRow,
                        i % 2 === 1 && styles.tableRowAlt,
                      ]}>
                      <Text style={[styles.tableCell, styles.col25]}>
                        {fmtDate(bucket.bucketStart)}
                      </Text>
                      <Text style={[styles.tableCell, styles.col25]}>
                        {fmtTime(bucket.bucketStart)}
                      </Text>
                      <Text style={[styles.tableCell, styles.col25]}>
                        {bucket.avgValue.toFixed(2)}
                      </Text>
                      <Text style={[styles.tableCellSmall, styles.col25]}>
                        {bucket.minValue.toFixed(1)}/{bucket.maxValue.toFixed(1)}
                        {'\n'}(n={bucket.count})
                      </Text>
                    </View>
                  ))
                )}
              </>
            ) : (
              <>
                <View style={styles.tableHeaderRow}>
                  <Text style={[styles.tableHeaderCell, styles.col35]}>Date</Text>
                  <Text style={[styles.tableHeaderCell, styles.col35]}>Time</Text>
                  <Text style={[styles.tableHeaderCell, styles.col30]}>
                    PM2.5(ATM)
                  </Text>
                </View>
                {filtered.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>
                      No data for selected range.
                    </Text>
                  </View>
                ) : (
                  filtered.map((r, i) => (
                    <View
                      key={i}
                      style={[
                        styles.tableRow,
                        i % 2 === 1 && styles.tableRowAlt,
                      ]}>
                      <Text style={[styles.tableCell, styles.col35]}>
                        {fmtDate(r.ts)}
                      </Text>
                      <Text style={[styles.tableCell, styles.col35]}>
                        {fmtTime(r.ts)}
                      </Text>
                      <Text style={[styles.tableCell, styles.col30]}>
                        {r.value} ug/m3
                      </Text>
                    </View>
                  ))
                )}
              </>
            )}
          </ScrollView>
        )}
      </View>
    </View>
  );
};

// Styles
const styles = StyleSheet.create({
  pageContainer: {
    padding: 16,
  },
  aqiHeaderContainer: {
    marginBottom: 12,
  },
  aqiTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  aqiTitleText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
  },
  statsContainer: {
    backgroundColor: '#27272a',
    padding: 8,
    borderRadius: 6,
    marginBottom: 8,
  },
  statsText: {
    fontSize: 12,
    color: '#a1a1aa',
  },
  statsTextSub: {
    fontSize: 11,
    color: '#71717a',
  },
  viewModeContainer: {
    flexDirection: 'row',
    backgroundColor: '#27272a',
    borderRadius: 8,
    padding: 4,
    marginBottom: 8,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  modeButtonActive: {
    backgroundColor: '#3b82f6',
  },
  modeButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#a1a1aa',
  },
  modeButtonTextActive: {
    color: '#fff',
  },
  filterContainer: {
    backgroundColor: '#27272a',
    borderWidth: 1,
    borderColor: '#3f3f46',
    borderRadius: 8,
    padding: 12,
  },
  filterRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  filterGroup: {
    flex: 1,
    marginHorizontal: 4,
  },
  filterLabel: {
    fontSize: 10,
    color: '#a1a1aa',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  dateInput: {
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#3f3f46',
    borderRadius: 6,
    padding: 8,
    color: '#fff',
    fontSize: 14,
  },
  filterButtons: {
    flexDirection: 'row',
  },
  applyButton: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 6,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  applyButtonText: {
    color: '#18181b',
    fontSize: 14,
    fontWeight: '500',
  },
  clearButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#52525b',
    padding: 10,
    borderRadius: 6,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  clearButtonText: {
    color: '#e4e4e7',
    fontSize: 14,
  },
  tableContainer: {
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 8,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#27272a',
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
  },
  tableHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#e4e4e7',
    marginLeft: 8,
  },
  tableHeaderCount: {
    fontSize: 11,
    color: '#71717a',
    marginLeft: 4,
  },
  tableScroll: {
    maxHeight: 400,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#3f3f46',
    padding: 12,
  },
  tableHeaderCell: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  col25: {
    width: '25%',
  },
  col30: {
    width: '30%',
  },
  col35: {
    width: '35%',
  },
  tableRow: {
    flexDirection: 'row',
    padding: 12,
    alignItems: 'center',
  },
  tableRowAlt: {
    backgroundColor: '#0a0a0b',
  },
  tableCell: {
    fontSize: 12,
    color: '#d4d4d8',
  },
  tableCellSmall: {
    fontSize: 10,
    color: '#d4d4d8',
    lineHeight: 14,
  },
  loadingContainer: {
    padding: 32,
    alignItems: 'center',
  },
  loadingText: {
    color: '#a1a1aa',
    marginTop: 12,
    fontSize: 14,
  },
  emptyContainer: {
    padding: 16,
  },
  emptyText: {
    fontSize: 12,
    color: '#71717a',
  },
});