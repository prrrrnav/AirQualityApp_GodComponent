// // src/screens/LiveFeedScreen.tsx
// import React from 'react';
// import {
//   View,
//   Text,
//   StyleSheet,
//   Animated,
//   FlatList,
// } from 'react-native';
// import { Icon } from '../components/Icon';
// import { Reading, fmtDate, fmtTime } from '../utils';

// // Define the props this screen will receive
// interface Props {
//   btStatus: 'connected' | 'connecting' | 'disconnected';
//   readings: Reading[];
//   latest: Reading | undefined;
//   isConnected: boolean;
//   btBadge: { liveText: string; dotColor: string };
//   pulseAnim: Animated.Value;
//   scrollViewRef?: React.RefObject<any>; // Still kept for compatibility with App.tsx
//   connectedDeviceId?: string;
//   debugLogs={debugLogs}
// }

// export const LiveFeedScreen: React.FC<Props> = ({
//   btStatus,
//   readings,
//   latest,
//   isConnected,
//   btBadge,
//   pulseAnim,
//   connectedDeviceId,
//   debugLogs = [],
// }) => {

//   // Optimized Render Item for production performance
//   const renderItem = ({ item, index }: { item: Reading; index: number }) => (
//     <View style={[styles.tableRow, index % 2 === 1 && styles.tableRowAlt]}>
//       <Text style={[styles.tableCell, styles.col35]}>
//         {fmtDate(item.ts)}
//       </Text>
//       <Text style={[styles.tableCell, styles.col35]}>
//         {fmtTime(item.ts)}
//       </Text>
//       <Text style={[styles.tableCell, styles.col30]}>
//         {item.value} µg/m³
//       </Text>
//     </View>
//   );

//   return (
//     <View style={styles.pageContainer}>
//       {/* Live Header */}
//       <View style={styles.liveHeaderContainer}>
//         <View style={styles.liveHeaderTop}>
//           <View style={styles.liveTitle}>
//             <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
//               <View style={[styles.statusDot, { backgroundColor: btBadge.dotColor }]} />
//             </Animated.View>
//             <Text style={styles.liveTitleText}>Live PM2.5</Text>
//             <View style={styles.liveValue}>
//               <Text style={styles.liveValueText}>
//                 {isConnected && latest ? `${latest.value} µg/m³` : '—'}
//               </Text>
//             </View>
//           </View>
//           <View style={styles.liveStatus}>
//             <Text style={styles.statusText}>{btBadge.liveText}</Text>
//           </View>
//         </View>

//         {/* Device Info - Show when connected */}
//         {isConnected && connectedDeviceId && (
//           <View style={styles.deviceInfoBanner}>
//             <Text style={styles.deviceInfoText}>
//               Device: {connectedDeviceId}
//             </Text>
//           </View>
//         )}
//       </View>

//       {/* Live Feed Table converted to FlatList for Production Efficiency */}
//       <View style={styles.tableContainer}>
//         <View style={styles.tableHeader}>
//           <View style={styles.tableHeaderContent}>
//             <Text style={styles.tableHeaderText}>Live Feed - PM2.5</Text>
//             {connectedDeviceId && (
//               <Text style={styles.deviceMacText}>Device: {connectedDeviceId}</Text>
//             )}
//           </View>
//           <Text style={styles.tableHeaderCount}>({readings.length} readings)</Text>
//         </View>

//         {btStatus === 'disconnected' ? (
//           <View style={styles.disconnectedContainer}>
//             <View style={styles.disconnectedIcons}>
//               <Icon name="bluetooth" size={32} color="#fbbf24" />
//             </View>
//             <Text style={styles.disconnectedTitle}>Bluetooth Disconnected</Text>
//             <Text style={styles.disconnectedText}>
//               Tap the <Text style={styles.bold}>Bluetooth icon</Text> to connect
//               your Shudhvayu device.
//             </Text>
//           </View>
//         ) : readings.length === 0 ? (
//           <View style={styles.emptyContainer}>
//             <Text style={styles.emptyText}>
//               {btStatus === 'connecting'
//                 ? 'Connecting...'
//                 : 'Waiting for data...'}
//             </Text>
//           </View>
//         ) : (
//           /* FlatList replaces ScrollView + Map for better memory management */
//           <FlatList
//             data={readings} // Use original array (no .reverse() math here)
//             renderItem={renderItem}
//             keyExtractor={(item, index) => `${item.ts.getTime()}-${index}`}
//             style={styles.tableScroll}
//             inverted // This puts newest data at the top automatically and efficiently
//             initialNumToRender={10}
//             maxToRenderPerBatch={5}
//             windowSize={3} // Reduces memory by keeping fewer rows "active"
//             removeClippedSubviews={true}
//             getItemLayout={(data, index) => (
//               // Hardcoding row height (12px padding * 2 + text height ~ 45px) 
//               // helps FlatList skip expensive height calculations
//               { length: 45, offset: 45 * index, index }
//             )}
//             ListFooterComponent={() => ( // Since we are 'inverted', the header is now the footer
//               <View style={styles.tableHeaderRow}>
//                 <Text style={[styles.tableHeaderCell, styles.col35]}>Date</Text>
//                 <Text style={[styles.tableHeaderCell, styles.col35]}>Time</Text>
//                 <Text style={[styles.tableHeaderCell, styles.col30]}>PM2.5(ATM)</Text>
//               </View>
//             )}
//           />
//         )}
//       </View>
//     </View>
//   );
// };

// // Styles (Preserved exactly from your original code)
// const styles = StyleSheet.create({
//   pageContainer: { padding: 16 },
//   liveHeaderContainer: { marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#27272a' },
//   tableHeaderContent: { flex: 1, marginLeft: 8 },
//   deviceMacText: { fontSize: 10, color: '#a1a1aa', marginTop: 2 },
//   liveHeaderTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
//   liveTitle: { flexDirection: 'row', alignItems: 'center' },
//   liveTitleText: { fontSize: 18, fontWeight: '600', color: '#fff', marginLeft: 8 },
//   liveValue: { backgroundColor: '#fff', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, marginLeft: 8 },
//   liveValueText: { fontSize: 12, fontWeight: '600', color: '#18181b' },
//   liveStatus: { flexDirection: 'row', alignItems: 'center' },
//   statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
//   statusText: { fontSize: 11, color: '#d4d4d8' },
//   deviceInfoBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#065f46', padding: 8, borderRadius: 6, borderWidth: 1, borderColor: '#10b981' },
//   deviceInfoText: { fontSize: 11, color: '#6ee7b7', marginLeft: 6, flex: 1, fontWeight: '600' },
//   tableContainer: { backgroundColor: '#18181b', borderWidth: 1, borderColor: '#27272a', borderRadius: 8, overflow: 'hidden' },
//   tableHeader: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#27272a', borderBottomWidth: 1, borderBottomColor: '#27272a' },
//   tableHeaderText: { fontSize: 12, fontWeight: '600', color: '#e4e4e7', marginLeft: 8 },
//   tableHeaderCount: { fontSize: 11, color: '#71717a', marginLeft: 4 },
//   tableScroll: { maxHeight: 400 },
//   tableHeaderRow: { flexDirection: 'row', backgroundColor: '#3f3f46', padding: 12 },
//   tableHeaderCell: { fontSize: 14, fontWeight: '600', color: '#fff' },
//   col35: { width: '35%' },
//   col30: { width: '30%' },
//   tableRow: { flexDirection: 'row', padding: 12 },
//   tableRowAlt: { backgroundColor: '#0a0a0b' },
//   tableCell: { fontSize: 13, color: '#d4d4d8' },
//   disconnectedContainer: { padding: 32, alignItems: 'center' },
//   disconnectedIcons: { flexDirection: 'row', marginBottom: 16 },
//   disconnectedTitle: { fontSize: 18, fontWeight: 'bold', color: '#fcd34d', marginBottom: 8 },
//   disconnectedText: { fontSize: 14, color: '#fde68a', textAlign: 'center' },
//   bold: { fontWeight: 'bold' },
//   emptyContainer: { padding: 16 },
//   emptyText: { fontSize: 12, color: '#71717a' },
// });

// src/screens/LiveFeedScreen.tsx — OPTIMIZED VERSION
import React, { memo } from 'react';
import { View, Text, StyleSheet, Animated, FlatList } from 'react-native';
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

        {/* 2. Debug Log Strip (Very helpful to see if raw data is still moving) */}
        {isConnected && debugLogs.length > 0 && (
          <View style={styles.debugStrip}>
            <Text style={styles.debugText} numberOfLines={1}>
              Last Log: {debugLogs[0]}
            </Text>
          </View>
        )}
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
            data={readings} // App.tsx is already unshifting to front
            renderItem={({ item, index }) => <DataRow item={item} index={index} />}
            keyExtractor={(item, index) => `${item.ts.getTime()}-${index}`}

            // FIX: Remove tableScroll style from here and use contentContainerStyle for height control
            contentContainerStyle={{ flexGrow: 1 }}
            style={{ height: 400 }} // Use a fixed height instead of maxHeight for stability

            // Header Logic
            ListHeaderComponent={() => (
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.tableHeaderCell, styles.col35]}>Date</Text>
                <Text style={[styles.tableHeaderCell, styles.col35]}>Time</Text>
                <Text style={[styles.tableHeaderCell, styles.col30]}>Value</Text>
              </View>
            )}
            stickyHeaderIndices={[0]} // This keeps the Date/Time/Value row permanently visible

            // Remove inverted completely
            initialNumToRender={15}
            maxToRenderPerBatch={10}
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  pageContainer: { padding: 16 },
  liveHeaderContainer: { marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#27272a' },
  liveHeaderTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  liveTitle: { flexDirection: 'row', alignItems: 'center' },
  liveTitleText: { fontSize: 18, fontWeight: '600', color: '#fff', marginLeft: 8 },
  liveValue: { backgroundColor: '#fff', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, marginLeft: 8 },
  liveValueText: { fontSize: 12, fontWeight: '600', color: '#18181b' },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  liveStatus: { flexDirection: 'row', alignItems: 'center' },
  statusText: { fontSize: 11, color: '#d4d4d8' },
  debugStrip: { marginTop: 8, backgroundColor: '#000', padding: 4, borderRadius: 4 },
  debugText: { fontSize: 9, color: '#22c55e', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  // tableContainer: { backgroundColor: '#18181b', borderRadius: 8, borderWidth: 1, borderColor: '#27272a', overflow: 'hidden' },
  tableHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 12, backgroundColor: '#27272a' },
  tableHeaderContent: { flex: 1 },
  tableHeaderText: { fontSize: 12, fontWeight: 'bold', color: '#fff' },
  deviceMacText: { fontSize: 10, color: '#71717a' },
  tableHeaderCount: { fontSize: 11, color: '#71717a' },
  tableScroll: { maxHeight: 450 },
  // tableHeaderRow: { flexDirection: 'row', backgroundColor: '#3f3f46', padding: 12 },
  tableHeaderCell: { fontSize: 12, fontWeight: 'bold', color: '#fff' },
  tableRow: { flexDirection: 'row', padding: 12, borderBottomWidth: 0.5, borderBottomColor: '#27272a' },
  tableRowAlt: { backgroundColor: '#111113' },
  tableCell: { fontSize: 12, color: '#d4d4d8' },
  col35: { width: '35%' },
  col30: { width: '30%' },
  disconnectedContainer: { padding: 40, alignItems: 'center' },
  disconnectedTitle: { color: '#71717a', marginTop: 10 },
  tableContainer: {
    backgroundColor: '#18181b',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#27272a',
    overflow: 'hidden',
    height: 450, // Force the container to a specific height
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#3f3f46',
    padding: 12,
    zIndex: 10, // Ensure it stays above rows
  },

});