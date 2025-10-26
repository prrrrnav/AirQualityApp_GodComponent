// App.tsx - COMPLETE VERSION WITH ALL STYLES

import { AuthProvider, useAuth } from './src/context/AuthContext';
import { LoginScreen } from './src/screens/LoginScreen';
import React, { useEffect, useRef, useState } from 'react';
import { Buffer } from 'buffer';
global.Buffer = Buffer;
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  Linking,
  StatusBar,
  Animated,
  Platform,
  PermissionsAndroid,
  Alert,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { BleManager, State } from 'react-native-ble-plx';
import RNBluetoothClassic from 'react-native-bluetooth-classic';

// Import our new screens
import { LiveFeedScreen } from './src/screens/LiveFeedScreen';
import { AqiReportScreen } from './src/screens/AqiReportScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { SupportScreen } from './src/screens/SupportScreen';

// Import our shared components
import { Icon } from './src/components/Icon';
import { Reading } from './src/utils';

// BLE Service and Characteristic UUIDs
const SERVICE_UUID = '0000FFE0-0000-1000-8000-00805F9B34FB';
const CHARACTERISTIC_UUID = '0000FFE1-0000-1000-8000-00805F9B34FB';

function MainApp() {
  const { logout } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('live');
  const [menuOpen, setMenuOpen] = useState<boolean>(false);
  const [btStatus, setBtStatus] = useState<'connected' | 'connecting' | 'disconnected'>('disconnected');
  const [readings, setReadings] = useState<Reading[]>([]);
  const [deviceModalVisible, setDeviceModalVisible] = useState<boolean>(false);
  const [devices, setDevices] = useState<any[]>([]);
  const [scanning, setScanning] = useState<boolean>(false);
  const [connectedDevice, setConnectedDevice] = useState<any>(null);
  const [lastDataTime, setLastDataTime] = useState<Date | null>(null);
  const [bleState, setBleState] = useState<State>(State.Unknown);

  const scrollViewRef = useRef<ScrollView>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const bleSubscription = useRef<any>(null);
  const classicReadInterval = useRef<any>(null);
  const dataCheckInterval = useRef<any>(null);
  const connectedDeviceType = useRef<'BLE' | 'Classic' | null>(null);
  const bleManagerRef = useRef<BleManager | null>(null);
  const stateSubscriptionRef = useRef<any>(null);

  // Initialize Bluetooth and request permissions
  useEffect(() => {
    const initBluetooth = async () => {
      try {
        console.log('[BLE] Initializing Bluetooth...');
        
        // Request permissions first
        await requestPermissions();

        // Initialize BLE Manager only once
        if (!bleManagerRef.current) {
          bleManagerRef.current = new BleManager();
          console.log('[BLE] BLE Manager created');
        }

        // Subscribe to BLE state changes
        stateSubscriptionRef.current = bleManagerRef.current.onStateChange((state) => {
          console.log('[BLE] State changed:', state);
          setBleState(state);

          if (state === State.PoweredOff) {
            Alert.alert(
              'Bluetooth is Off',
              'Please turn on Bluetooth to connect to your device',
              [
                {
                  text: 'Enable Bluetooth',
                  onPress: () => {
                    if (Platform.OS === 'android') {
                      bleManagerRef.current?.enable().catch((error) => {
                        console.log('[BLE] Failed to enable Bluetooth:', error);
                      });
                    }
                  },
                },
                {
                  text: 'Cancel',
                  style: 'cancel',
                },
              ]
            );
          }
        }, true);

        console.log('[BLE] Initialization complete');
      } catch (error) {
        console.error('[BLE] Initialization error:', error);
      }
    };

    initBluetooth();

    // Cleanup
    return () => {
      console.log('[BLE] Cleaning up...');
      
      if (bleSubscription.current) {
        bleSubscription.current.remove();
        bleSubscription.current = null;
      }
      if (classicReadInterval.current) {
        clearInterval(classicReadInterval.current);
        classicReadInterval.current = null;
      }
      if (dataCheckInterval.current) {
        clearInterval(dataCheckInterval.current);
        dataCheckInterval.current = null;
      }
      if (stateSubscriptionRef.current) {
        stateSubscriptionRef.current.remove();
        stateSubscriptionRef.current = null;
      }
    };
  }, []);

  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      try {
        const apiLevel = Platform.Version;
        console.log('[Permissions] Android API Level:', apiLevel);

        if (apiLevel >= 31) {
          // Android 12+ (API 31+)
          const granted = await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          ]);

          const allGranted = Object.values(granted).every(
            (status) => status === PermissionsAndroid.RESULTS.GRANTED
          );

          if (!allGranted) {
            Alert.alert(
              'Permissions Required',
              'Bluetooth and Location permissions are required to scan for devices'
            );
          } else {
            console.log('[Permissions] All permissions granted');
          }
        } else {
          // Android 11 and below
          const granted = await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          ]);

          if (granted[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] !== PermissionsAndroid.RESULTS.GRANTED) {
            Alert.alert(
              'Permission Required',
              'Location permission is required to scan for Bluetooth devices'
            );
          } else {
            console.log('[Permissions] Location permission granted');
          }
        }
      } catch (err) {
        console.error('[Permissions] Error:', err);
      }
    }
  };

  // Pulse animation
  useEffect(() => {
    if (btStatus === 'connected') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.3,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [btStatus, pulseAnim]);

  // Auto-scroll
  useEffect(() => {
    if (scrollViewRef.current && readings.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [readings]);

  // Data check interval
  useEffect(() => {
    if (btStatus === 'connected') {
      dataCheckInterval.current = setInterval(() => {
        if (lastDataTime) {
          const now = new Date();
          const timeSinceLastData = (now.getTime() - lastDataTime.getTime()) / 1000;

          if (timeSinceLastData > 15) {
            Alert.alert(
              'No Data Received',
              'No data received from device in the last 15 seconds. Connection may be lost.',
              [{ text: 'OK' }]
            );
          }
        }
      }, 10000);
    } else {
      if (dataCheckInterval.current) {
        clearInterval(dataCheckInterval.current);
        dataCheckInterval.current = null;
      }
    }

    return () => {
      if (dataCheckInterval.current) {
        clearInterval(dataCheckInterval.current);
      }
    };
  }, [btStatus, lastDataTime]);

  const scanForDevices = async () => {
    if (!bleManagerRef.current) {
      Alert.alert('Error', 'Bluetooth not initialized');
      return;
    }

    // Check if Bluetooth is powered on
    if (bleState !== State.PoweredOn) {
      Alert.alert(
        'Bluetooth Unavailable',
        'Please turn on Bluetooth and try again',
        [
          {
            text: 'Enable Bluetooth',
            onPress: () => {
              if (Platform.OS === 'android') {
                bleManagerRef.current?.enable().catch((error) => {
                  console.log('[BLE] Failed to enable Bluetooth:', error);
                });
              }
            },
          },
          {
            text: 'Cancel',
            style: 'cancel',
          },
        ]
      );
      return;
    }

    console.log('[BLE] Starting device scan...');
    setScanning(true);
    setDevices([]);
    const foundDevices = new Map();

    try {
      // Scan for BLE devices
      bleManagerRef.current.startDeviceScan(null, null, (error, device) => {
        if (error) {
          console.log('[BLE] Scan Error:', error.message);
          if (error.errorCode === 102) {
            Alert.alert('Bluetooth Error', 'Please enable Bluetooth');
          }
          return;
        }
        if (device && device.name && !foundDevices.has(device.id)) {
          console.log('[BLE] Found device:', device.name, device.id);
          foundDevices.set(device.id, {
            id: device.id,
            name: device.name,
            type: 'BLE',
            rawDevice: device,
          });
          setDevices(Array.from(foundDevices.values()));
        }
      });

      // Scan for Classic Bluetooth devices
      try {
        const paired = await RNBluetoothClassic.getBondedDevices();
        console.log('[Classic BT] Found', paired.length, 'paired devices');
        paired.forEach((device) => {
          if (!foundDevices.has(device.address)) {
            foundDevices.set(device.address, {
              id: device.address,
              name: device.name || 'Unknown Device',
              type: 'Classic',
              rawDevice: device,
            });
          }
        });
        setDevices(Array.from(foundDevices.values()));
      } catch (error) {
        console.log('[Classic BT] Error:', error);
      }
    } catch (error) {
      console.log('[Scan] Error:', error);
      Alert.alert('Scan Failed', 'Could not scan for devices');
    }

    // Stop scanning after 10 seconds
    setTimeout(() => {
      if (bleManagerRef.current) {
        bleManagerRef.current.stopDeviceScan();
        console.log('[BLE] Scan stopped');
      }
      setScanning(false);
    }, 10000);
  };

  const connectToDevice = async (deviceInfo: any) => {
    if (!bleManagerRef.current) {
      Alert.alert('Error', 'Bluetooth not initialized');
      return;
    }

    try {
      console.log('[Connect] Connecting to:', deviceInfo.name, deviceInfo.type);
      setBtStatus('connecting');
      bleManagerRef.current.stopDeviceScan();

      if (deviceInfo.type === 'BLE') {
        // Connect to BLE device
        const device = await bleManagerRef.current.connectToDevice(deviceInfo.rawDevice.id);
        console.log('[BLE] Connected to device');
        
        await device.discoverAllServicesAndCharacteristics();
        console.log('[BLE] Services discovered');

        setConnectedDevice(device);
        connectedDeviceType.current = 'BLE';
        setBtStatus('connected');
        setDeviceModalVisible(false);
        setLastDataTime(new Date());

        bleSubscription.current = device.monitorCharacteristicForService(
          SERVICE_UUID,
          CHARACTERISTIC_UUID,
          (error, characteristic) => {
            if (error) {
              console.log('[BLE] Monitor Error:', error.message);
              return;
            }
            if (characteristic?.value) {
              const rawData = Buffer.from(characteristic.value, 'base64').toString('utf-8');
              parseData(rawData);
              setLastDataTime(new Date());
            }
          }
        );

        Alert.alert('Success', `Connected to ${deviceInfo.name} (BLE)`);
      } else {
        // Connect to Classic Bluetooth device
        const device = await RNBluetoothClassic.connectToDevice(deviceInfo.rawDevice.address);
        console.log('[Classic BT] Connected to device');

        setConnectedDevice(device);
        connectedDeviceType.current = 'Classic';
        setBtStatus('connected');
        setDeviceModalVisible(false);
        setLastDataTime(new Date());

        // Read data periodically from Classic Bluetooth
        classicReadInterval.current = setInterval(async () => {
          try {
            const available = await device.available();
            if (available > 0) {
              const data = await device.read();
              parseData(data);
              setLastDataTime(new Date());
            }
          } catch (error) {
            console.log('[Classic BT] Read Error:', error);
          }
        }, 1000);

        Alert.alert('Success', `Connected to ${deviceInfo.name} (Classic)`);
      }
    } catch (error: any) {
      console.error('[Connect] Error:', error);
      setBtStatus('disconnected');

      let errorMessage = 'Could not connect to device';
      if (error.message) {
        errorMessage = error.message;
      }

      Alert.alert('Connection Failed', errorMessage);
    }
  };

  const disconnectDevice = async () => {
    if (connectedDevice) {
      try {
        console.log('[Disconnect] Disconnecting...');
        
        if (bleSubscription.current) {
          bleSubscription.current.remove();
          bleSubscription.current = null;
        }
        if (classicReadInterval.current) {
          clearInterval(classicReadInterval.current);
          classicReadInterval.current = null;
        }
        if (dataCheckInterval.current) {
          clearInterval(dataCheckInterval.current);
          dataCheckInterval.current = null;
        }

        if (connectedDeviceType.current === 'BLE') {
          await connectedDevice.cancelConnection();
        } else if (connectedDeviceType.current === 'Classic') {
          await connectedDevice.disconnect();
        }

        setConnectedDevice(null);
        connectedDeviceType.current = null;
        setBtStatus('disconnected');
        setLastDataTime(null);
        
        console.log('[Disconnect] Disconnected successfully');
        Alert.alert('Disconnected', 'Device disconnected successfully');
      } catch (error) {
        console.error('[Disconnect] Error:', error);
      }
    }
  };

  const parseData = (rawData: string) => {
    const match = rawData.match(/PM2\.5\(ATM\):\s*([\d.]+)\s*ug\/m3/);
    if (match) {
      const val = parseFloat(match[1]);
      console.log('[Data] Received PM2.5:', val);
      setReadings((prev) => {
        const next = [...prev, { ts: new Date(), value: val }];
        return next.length > 500 ? next.slice(-500) : next;
      });
    }
  };

  const openDeviceModal = () => {
    if (btStatus === 'connected') {
      Alert.alert(
        'Bluetooth Connected',
        'Do you want to disconnect from the current device?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Disconnect', onPress: disconnectDevice, style: 'destructive' },
        ]
      );
    } else {
      setDeviceModalVisible(true);
      scanForDevices();
    }
  };

  const latest = readings.length ? readings[readings.length - 1] : undefined;
  const isConnected = btStatus === 'connected';

  const btBadge = {
    text: btStatus === 'connected' ? 'Connected' : btStatus === 'connecting' ? 'Connecting' : 'Disconnected',
    color: btStatus === 'connected' ? '#22c55e' : btStatus === 'connecting' ? '#eab308' : '#ef4444',
    dotColor: btStatus === 'connected' ? '#4ade80' : btStatus === 'connecting' ? '#facc15' : '#71717a',
    liveText: btStatus === 'connected' ? 'Receiving' : btStatus === 'connecting' ? 'Connecting...' : 'Idle',
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#18181b" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setMenuOpen(true)} style={styles.headerButton}>
          <Icon name="menu" size={24} color="#a1a1aa" />
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setActiveTab('live')}>
          <Text style={styles.headerTitle}>Shudhvayu</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={openDeviceModal} style={styles.btButton}>
          <View style={[styles.btCircle, { backgroundColor: isConnected ? '#27272a' : '#3f3f46' }]}>
            <Icon name="bluetooth" size={20} color={btStatus === 'connected' ? '#3b82f6' : '#a1a1aa'} />
          </View>
          <View style={[styles.btBadge, { backgroundColor: btBadge.color }]}>
            <Text style={styles.btBadgeText}>{btBadge.text}</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Tab Selector */}
      <View style={styles.tabContainer}>
        <View style={styles.tabInner}>
          <TouchableOpacity
            onPress={() => setActiveTab('live')}
            style={[styles.tab, activeTab === 'live' && styles.tabActive]}>
            <Icon name="activity" size={16} color={activeTab === 'live' ? '#18181b' : '#d4d4d8'} />
            <Text style={[styles.tabText, activeTab === 'live' && styles.tabTextActive]}>Live PM2.5</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab('aqi')}
            style={[styles.tab, activeTab === 'aqi' && styles.tabActive]}>
            <Icon name="wind" size={16} color={activeTab === 'aqi' ? '#18181b' : '#d4d4d8'} />
            <Text style={[styles.tabText, activeTab === 'aqi' && styles.tabTextActive]}>AQI Report</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Menu Modal */}
      <Modal visible={menuOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setMenuOpen(false)} />
          <View style={styles.menu}>
            <View style={styles.menuHeader}>
              <View>
                <Text style={styles.menuTitle}>Hi, Partner</Text>
                <Text style={styles.menuSubtitle}>Shudhvayu</Text>
              </View>
              <TouchableOpacity onPress={() => setMenuOpen(false)}>
                <Icon name="x" size={24} color="#a1a1aa" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.menuItems}>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setActiveTab('profile');
                  setMenuOpen(false);
                }}>
                <Icon name="user" size={20} color="#d4d4d8" />
                <Text style={styles.menuItemText}>Profile</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem} onPress={() => Linking.openURL('https://shudhvayu.com/about')}>
                <Icon name="info" size={20} color="#d4d4d8" />
                <Text style={styles.menuItemText}>About Us</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem} onPress={() => Linking.openURL('https://shudhvayu.com/privacy')}>
                <Icon name="shield" size={20} color="#d4d4d8" />
                <Text style={styles.menuItemText}>Privacy & Security</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setActiveTab('support');
                  setMenuOpen(false);
                }}>
                <Icon name="bell" size={20} color="#d4d4d8" />
                <Text style={styles.menuItemText}>Support</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem} onPress={() => Linking.openURL('https://shudhvayu.com/terms')}>
                <Icon name="info" size={20} color="#d4d4d8" />
                <Text style={styles.menuItemText}>Terms of Services</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.menuItem, styles.logoutItem]} onPress={logout}>
                <Icon name="logout" size={20} color="#f87171" />
                <Text style={styles.logoutText}>Logout</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Device Selection Modal */}
      <Modal visible={deviceModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.deviceModalContent}>
            <Text style={styles.deviceModalTitle}>Select Bluetooth Device</Text>

            <View style={styles.deviceListContainer}>
              {scanning ? (
                <View style={styles.scanningContainer}>
                  <ActivityIndicator size="large" color="#3b82f6" />
                  <Text style={styles.scanningText}>Scanning for devices...</Text>
                </View>
              ) : devices.length === 0 ? (
                <Text style={styles.noDevicesText}>No devices found. Tap Refresh to scan again.</Text>
              ) : (
                <FlatList
                  data={devices}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                    <TouchableOpacity style={styles.deviceItem} onPress={() => connectToDevice(item)}>
                      <View style={styles.deviceInfo}>
                        <Text style={styles.deviceName}>{item.name}</Text>
                        <Text style={styles.deviceId}>{item.id}</Text>
                      </View>
                      <View style={styles.deviceTypeBadge}>
                        <Text style={styles.deviceTypeText}>{item.type}</Text>
                      </View>
                    </TouchableOpacity>
                  )}
                />
              )}
            </View>

            <TouchableOpacity style={styles.refreshBtn} onPress={scanForDevices} disabled={scanning}>
              <Text style={styles.refreshBtnText}>{scanning ? 'Scanning...' : '🔄 Refresh'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => {
                if (bleManagerRef.current) {
                  bleManagerRef.current.stopDeviceScan();
                }
                setDeviceModalVisible(false);
              }}>
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Content */}
      <ScrollView style={styles.content}>
        {activeTab === 'live' && (
          <LiveFeedScreen
            btStatus={btStatus}
            readings={readings}
            latest={latest}
            isConnected={isConnected}
            btBadge={btBadge}
            pulseAnim={pulseAnim}
            scrollViewRef={scrollViewRef}
          />
        )}

        {activeTab === 'aqi' && <AqiReportScreen readings={readings} />}

        {activeTab === 'profile' && <ProfileScreen />}

        {activeTab === 'support' && <SupportScreen />}
      </ScrollView>
    </SafeAreaView>
  );
}

// Root components that handle auth
export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

function AppContent() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return <MainApp />;
}

// COMPLETE STYLES
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#18181b',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#18181b',
  },
  loadingText: {
    color: '#fff',
    marginTop: 16,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
  },
  headerButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  btButton: {
    position: 'relative',
  },
  btCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  btBadgeText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '600',
  },
  tabContainer: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
  },
  tabInner: {
    flexDirection: 'row',
    backgroundColor: '#27272a',
    padding: 4,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#3f3f46',
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginHorizontal: 2,
  },
  tabActive: {
    backgroundColor: '#fff',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#d4d4d8',
    marginLeft: 8,
  },
  tabTextActive: {
    color: '#18181b',
  },
  modalOverlay: {
    flex: 1,
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  menu: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: 280,
    backgroundColor: '#27272a',
  },
  menuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#3f3f46',
  },
  menuTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
  },
  menuSubtitle: {
    fontSize: 14,
    color: '#a1a1aa',
    marginTop: 4,
  },
  menuItems: {
    flex: 1,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#3f3f46',
  },
  menuItemText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#d4d4d8',
    marginLeft: 12,
  },
  logoutItem: {
    borderTopWidth: 1,
    borderTopColor: '#3f3f46',
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#f87171',
    marginLeft: 12,
  },
  content: {
    flex: 1,
  },
  // Device Modal Styles
  deviceModalContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#27272a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  deviceModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
    textAlign: 'center',
  },
  deviceListContainer: {
    maxHeight: 300,
    marginBottom: 16,
  },
  scanningContainer: {
    alignItems: 'center',
    padding: 20,
  },
  scanningText: {
    textAlign: 'center',
    fontSize: 14,
    color: '#a1a1aa',
    marginTop: 12,
  },
  noDevicesText: {
    textAlign: 'center',
    fontSize: 14,
    color: '#71717a',
    padding: 20,
  },
  deviceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#3f3f46',
    backgroundColor: '#18181b',
    marginBottom: 8,
    borderRadius: 8,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  deviceId: {
    fontSize: 12,
    color: '#a1a1aa',
  },
  deviceTypeBadge: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  deviceTypeText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '600',
  },
  refreshBtn: {
    backgroundColor: '#22c55e',
    padding: 14,
    borderRadius: 8,
    marginBottom: 10,
  },
  refreshBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  closeBtn: {
    backgroundColor: '#3f3f46',
    padding: 14,
    borderRadius: 8,
  },
  closeBtnText: {
    color: '#e4e4e7',
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
});