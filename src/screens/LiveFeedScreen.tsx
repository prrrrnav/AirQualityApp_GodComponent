// src/screens/LiveFeedScreen.tsx
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  FlatList,
} from 'react-native';
import { Icon } from '../components/Icon';
import { Reading, fmtDate, fmtTime } from '../utils';

// Define the props this screen will receive
interface Props {
  btStatus: 'connected' | 'connecting' | 'disconnected';
  readings: Reading[];
  latest: Reading | undefined;
  isConnected: boolean;
  btBadge: { liveText: string; dotColor: string };
  pulseAnim: Animated.Value;
  scrollViewRef?: React.RefObject<any>; // Still kept for compatibility with App.tsx
  connectedDeviceId?: string;
}

export const LiveFeedScreen: React.FC<Props> = ({
  btStatus,
  readings,
  latest,
  isConnected,
  btBadge,
  pulseAnim,
  connectedDeviceId,
}) => {

  // Optimized Render Item for production performance
  const renderItem = ({ item, index }: { item: Reading; index: number }) => (
    <View style={[styles.tableRow, index % 2 === 1 && styles.tableRowAlt]}>
      <Text style={[styles.tableCell, styles.col35]}>
        {fmtDate(item.ts)}
      </Text>
      <Text style={[styles.tableCell, styles.col35]}>
        {fmtTime(item.ts)}
      </Text>
      <Text style={[styles.tableCell, styles.col30]}>
        {item.value} µg/m³
      </Text>
    </View>
  );

  return (
    <View style={styles.pageContainer}>
      {/* Live Header */}
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

        {/* Device Info - Show when connected */}
        {isConnected && connectedDeviceId && (
          <View style={styles.deviceInfoBanner}>
            <Text style={styles.deviceInfoText}>
              Device: {connectedDeviceId}
            </Text>
          </View>
        )}
      </View>

      {/* Live Feed Table converted to FlatList for Production Efficiency */}
      <View style={styles.tableContainer}>
        <View style={styles.tableHeader}>
          <View style={styles.tableHeaderContent}>
            <Text style={styles.tableHeaderText}>Live Feed - PM2.5</Text>
            {connectedDeviceId && (
              <Text style={styles.deviceMacText}>Device: {connectedDeviceId}</Text>
            )}
          </View>
          <Text style={styles.tableHeaderCount}>({readings.length} readings)</Text>
        </View>

        {btStatus === 'disconnected' ? (
          <View style={styles.disconnectedContainer}>
            <View style={styles.disconnectedIcons}>
              <Icon name="bluetooth" size={32} color="#fbbf24" />
            </View>
            <Text style={styles.disconnectedTitle}>Bluetooth Disconnected</Text>
            <Text style={styles.disconnectedText}>
              Tap the <Text style={styles.bold}>Bluetooth icon</Text> to connect
              your Shudhvayu device.
            </Text>
          </View>
        ) : readings.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {btStatus === 'connecting'
                ? 'Connecting...'
                : 'Waiting for data...'}
            </Text>
          </View>
        ) : (
          /* FlatList replaces ScrollView + Map for better memory management */
          <FlatList
            data={[...readings].reverse()} // Shows newest readings at the top
            renderItem={renderItem}
            keyExtractor={(item, index) => `${item.ts.getTime()}-${index}`}
            style={styles.tableScroll}
            initialNumToRender={20}
            maxToRenderPerBatch={10}
            windowSize={5}
            removeClippedSubviews={true}
            ListHeaderComponent={() => (
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.tableHeaderCell, styles.col35]}>Date</Text>
                <Text style={[styles.tableHeaderCell, styles.col35]}>Time</Text>
                <Text style={[styles.tableHeaderCell, styles.col30]}>PM2.5(ATM)</Text>
              </View>
            )}
          />
        )}
      </View>
    </View>
  );
};

// Styles (Preserved exactly from your original code)
const styles = StyleSheet.create({
  pageContainer: { padding: 16 },
  liveHeaderContainer: { marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#27272a' },
  tableHeaderContent: { flex: 1, marginLeft: 8 },
  deviceMacText: { fontSize: 10, color: '#a1a1aa', marginTop: 2 },
  liveHeaderTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  liveTitle: { flexDirection: 'row', alignItems: 'center' },
  liveTitleText: { fontSize: 18, fontWeight: '600', color: '#fff', marginLeft: 8 },
  liveValue: { backgroundColor: '#fff', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, marginLeft: 8 },
  liveValueText: { fontSize: 12, fontWeight: '600', color: '#18181b' },
  liveStatus: { flexDirection: 'row', alignItems: 'center' },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  statusText: { fontSize: 11, color: '#d4d4d8' },
  deviceInfoBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#065f46', padding: 8, borderRadius: 6, borderWidth: 1, borderColor: '#10b981' },
  deviceInfoText: { fontSize: 11, color: '#6ee7b7', marginLeft: 6, flex: 1, fontWeight: '600' },
  tableContainer: { backgroundColor: '#18181b', borderWidth: 1, borderColor: '#27272a', borderRadius: 8, overflow: 'hidden' },
  tableHeader: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#27272a', borderBottomWidth: 1, borderBottomColor: '#27272a' },
  tableHeaderText: { fontSize: 12, fontWeight: '600', color: '#e4e4e7', marginLeft: 8 },
  tableHeaderCount: { fontSize: 11, color: '#71717a', marginLeft: 4 },
  tableScroll: { maxHeight: 400 },
  tableHeaderRow: { flexDirection: 'row', backgroundColor: '#3f3f46', padding: 12 },
  tableHeaderCell: { fontSize: 14, fontWeight: '600', color: '#fff' },
  col35: { width: '35%' },
  col30: { width: '30%' },
  tableRow: { flexDirection: 'row', padding: 12 },
  tableRowAlt: { backgroundColor: '#0a0a0b' },
  tableCell: { fontSize: 13, color: '#d4d4d8' },
  disconnectedContainer: { padding: 32, alignItems: 'center' },
  disconnectedIcons: { flexDirection: 'row', marginBottom: 16 },
  disconnectedTitle: { fontSize: 18, fontWeight: 'bold', color: '#fcd34d', marginBottom: 8 },
  disconnectedText: { fontSize: 14, color: '#fde68a', textAlign: 'center' },
  bold: { fontWeight: 'bold' },
  emptyContainer: { padding: 16 },
  emptyText: { fontSize: 12, color: '#71717a' },
});