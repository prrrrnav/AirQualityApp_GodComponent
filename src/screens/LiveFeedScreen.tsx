// src/screens/LiveFeedScreen.tsx – FIXED VERSION
import React, { memo } from 'react';
import { View, Text, StyleSheet, Animated, FlatList, Platform } from 'react-native';
import { Icon } from '../components/Icon';
import { Reading, fmtDate, fmtTime } from '../utils';

interface Props {
  btStatus: 'connected' | 'connecting' | 'disconnected';
  readings: Reading[];
  latest: Reading | undefined;
  isConnected: boolean;
  btBadge: { liveText: string; dotColor: string };
  pulseAnim: Animated.Value;
  connectedDeviceId?: string;
  debugLogs: string[];
}

// Memoize the row to prevent unnecessary re-renders of old data
const DataRow = memo(({ item, index }: { item: Reading; index: number }) => (
  <View style={[styles.tableRow, index % 2 === 1 && styles.tableRowAlt]}>
    <Text style={[styles.tableCell, styles.col35]}>{fmtDate(item.ts)}</Text>
    <Text style={[styles.tableCell, styles.col35]}>{fmtTime(item.ts)}</Text>
    <Text style={[styles.tableCell, styles.col30]}>{item.value} µg/m³</Text>
  </View>
));


//  {/* 2. Debug Log Strip */}
//  {isConnected && debugLogs.length > 0 && (<View style={styles.debugStrip}><Text style={styles.debugText} numberOfLines={1}>
//   {/* Last Log: {debugLogs[0]} */}</Text></View>)}
export const LiveFeedScreen: React.FC<Props> = ({
  btStatus,
  readings,
  latest,
  isConnected,
  btBadge,
  pulseAnim,
  connectedDeviceId,
  debugLogs = [],
}) => {
  return (
    <View style={styles.pageContainer}>
      {/* 1. Header Section */}
      <View style={styles.liveHeaderContainer}>
        <View style={styles.liveHeaderTop}>
          <View style={styles.liveTitle}>
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <View style={[styles.statusDot, { backgroundColor: btBadge.dotColor }]} />
            </Animated.View>
            <Text style={styles.liveTitleText}>Live PM2.5</Text>
            <View style={styles.liveValue}>
              <Text style={styles.liveValueText}>
                {isConnected && latest ? `${latest.value} µg/m³` : '—'}
              </Text>
            </View>
          </View>
          <View style={styles.liveStatus}>
            <Text style={styles.statusText}>{btBadge.liveText}</Text>
          </View>
        </View>

       
      </View>

      {/* 3. The Table */}
      <View style={styles.tableContainer}>
        <View style={styles.tableHeader}>
          <View style={styles.tableHeaderContent}>
            <Text style={styles.tableHeaderText}>Live Feed - PM2.5</Text>
            {connectedDeviceId && <Text style={styles.deviceMacText}>{connectedDeviceId}</Text>}
          </View>
          <Text style={styles.tableHeaderCount}>{readings.length} items</Text>
        </View>

        {btStatus === 'disconnected' ? (
          <View style={styles.disconnectedContainer}>
            <Icon name="bluetooth" size={32} color="#fbbf24" />
            <Text style={styles.disconnectedTitle}>Disconnected</Text>
          </View>
        ) : (
          <FlatList
            data={readings}
            renderItem={({ item, index }) => <DataRow item={item} index={index} />}
            keyExtractor={(item, index) => `${item.ts.getTime()}-${index}`}
            
            // Fixed styling - remove conflicting styles
            style={styles.tableScroll}
            contentContainerStyle={styles.tableContent}

            // Header Logic
            ListHeaderComponent={() => (
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.tableHeaderCell, styles.col35]}>Date</Text>
                <Text style={[styles.tableHeaderCell, styles.col35]}>Time</Text>
                <Text style={[styles.tableHeaderCell, styles.col30]}>Value</Text>
              </View>
            )}
            stickyHeaderIndices={[0]}

            // Performance optimizations
            initialNumToRender={15}
            maxToRenderPerBatch={10}
            updateCellsBatchingPeriod={50}
            windowSize={10}
            removeClippedSubviews={Platform.OS === 'android'}
            
            // Empty state
            ListEmptyComponent={() => (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  {btStatus === 'connecting' ? 'Connecting...' : 'No data received yet'}
                </Text>
              </View>
            )}
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  pageContainer: { 
    padding: 16,
    flex: 1,
  },
  liveHeaderContainer: { 
    marginBottom: 12, 
    paddingBottom: 12, 
    borderBottomWidth: 1, 
    borderBottomColor: '#27272a' 
  },
  liveHeaderTop: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center' 
  },
  liveTitle: { 
    flexDirection: 'row', 
    alignItems: 'center' 
  },
  liveTitleText: { 
    fontSize: 18, 
    fontWeight: '600', 
    color: '#fff', 
    marginLeft: 8 
  },
  liveValue: { 
    backgroundColor: '#fff', 
    paddingHorizontal: 8, 
    paddingVertical: 4, 
    borderRadius: 12, 
    marginLeft: 8 
  },
  liveValueText: { 
    fontSize: 12, 
    fontWeight: '600', 
    color: '#18181b' 
  },
  statusDot: { 
    width: 10, 
    height: 10, 
    borderRadius: 5 
  },
  liveStatus: { 
    flexDirection: 'row', 
    alignItems: 'center' 
  },
  statusText: { 
    fontSize: 11, 
    color: '#d4d4d8' 
  },
  debugStrip: { 
    marginTop: 8, 
    backgroundColor: '#000', 
    padding: 4, 
    borderRadius: 4 
  },
  debugText: { 
    fontSize: 9, 
    color: '#22c55e', 
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' 
  },
  tableContainer: {
    backgroundColor: '#18181b',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#27272a',
    overflow: 'hidden',
    height: 450, // Fixed height for stability
  },
  tableHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    padding: 12, 
    backgroundColor: '#27272a' 
  },
  tableHeaderContent: { 
    flex: 1 
  },
  tableHeaderText: { 
    fontSize: 12, 
    fontWeight: 'bold', 
    color: '#fff' 
  },
  deviceMacText: { 
    fontSize: 10, 
    color: '#71717a' 
  },
  tableHeaderCount: { 
    fontSize: 11, 
    color: '#71717a' 
  },
  tableScroll: { 
    flex: 1,
  },
  tableContent: {
    flexGrow: 1,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#3f3f46',
    padding: 12,
  },
  tableHeaderCell: { 
    fontSize: 12, 
    fontWeight: 'bold', 
    color: '#fff' 
  },
  tableRow: { 
    flexDirection: 'row', 
    padding: 12, 
    borderBottomWidth: 0.5, 
    borderBottomColor: '#27272a' 
  },
  tableRowAlt: { 
    backgroundColor: '#111113' 
  },
  tableCell: { 
    fontSize: 12, 
    color: '#d4d4d8' 
  },
  col35: { 
    width: '35%' 
  },
  col30: { 
    width: '30%' 
  },
  disconnectedContainer: { 
    padding: 40, 
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  disconnectedTitle: { 
    color: '#71717a', 
    marginTop: 10 
  },
  emptyContainer: { 
    padding: 40, 
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  emptyText: { 
    fontSize: 12, 
    color: '#71717a' 
  },
});




