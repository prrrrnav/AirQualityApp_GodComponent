// src/screens/AqiReportScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Icon } from '../components/Icon';
import { Reading } from '../utils';

// Helper functions (moved from App.tsx)
function fmtDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function fmtTime(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mi}:${ss}`;
}

function filterReadings(
  readings: Reading[],
  startDateISO?: string | null,
  endDateISO?: string | null,
): Reading[] {
  let start: Date | null = null;
  let end: Date | null = null;
  if (startDateISO && startDateISO.trim())
    start = new Date(startDateISO + 'T00:00:00');
  if (endDateISO && endDateISO.trim())
    end = new Date(endDateISO + 'T23:59:59');

  if (!start && !end) {
    const now = new Date();
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  }

  return readings.filter((r: Reading) => {
    const afterStart = start ? r.ts >= start : true;
    const beforeEnd = end ? r.ts <= end : true;
    return afterStart && beforeEnd;
  });
}

// Define the props
interface Props {
  readings: Reading[];
}

export const AqiReportScreen: React.FC<Props> = ({ readings }) => {
  // State for this screen is now MOVED from App.tsx
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [filtered, setFiltered] = useState<Reading[]>([]);

  // Functions are also MOVED from App.tsx
  const applyFilter = () => {
    setFiltered(filterReadings(readings, startDate || null, endDate || null));
  };

  const clearFilter = () => {
    setStartDate('');
    setEndDate('');
    setFiltered(filterReadings(readings, null, null));
  };

  // Filter effect (moved from App.tsx)
  useEffect(() => {
    if (!startDate && !endDate) {
      setFiltered(filterReadings(readings, null, null));
    }
  }, [readings, startDate, endDate]);

  return (
    <View style={styles.pageContainer}>
      {/* AQI Header with Filters */}
      <View style={styles.aqiHeaderContainer}>
        <View style={styles.aqiTitle}>
          <Icon name="wind" size={20} color="#fff" />
          <Text style={styles.aqiTitleText}>AQI Report</Text>
        </View>

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
          <Text style={styles.tableHeaderText}>Recorded data</Text>
        </View>

        <ScrollView style={styles.tableScroll} nestedScrollEnabled>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.tableHeaderCell, styles.col35]}>Date</Text>
            <Text style={[styles.tableHeaderCell, styles.col35]}>Time</Text>
            <Text style={[styles.tableHeaderCell, styles.col30]}>
              PM2.5(ATM)
            </Text>
          </View>
          {filtered.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No data for selected range.</Text>
            </View>
          ) : (
            filtered.map((r, i) => (
              <View
                key={i}
                style={[styles.tableRow, i % 2 === 1 && styles.tableRowAlt]}>
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
        </ScrollView>
      </View>
    </View>
  );
};

// Styles copied from App.tsx
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
    marginBottom: 12,
  },
  aqiTitleText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
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
  tableScroll: {
    maxHeight: 400,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#3f3f46',
    padding: 12,
  },
  tableHeaderCell: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  col35: {
    width: '35%',
  },
  col30: {
    width: '30%',
  },
  tableRow: {
    flexDirection: 'row',
    padding: 12,
  },
  tableRowAlt: {
    backgroundColor: '#0a0a0b',
  },
  tableCell: {
    fontSize: 13,
    color: '#d4d4d8',
  },
  emptyContainer: {
    padding: 16,
  },
  emptyText: {
    fontSize: 12,
    color: '#71717a',
  },
});