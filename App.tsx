import { AuthProvider, useAuth } from './src/context/AuthContext';
import { LoginScreen } from './src/screens/LoginScreen';
import BluetoothIcon from './src/components/BluetoothIcon';
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

import { LiveFeedScreen } from './src/screens/LiveFeedScreen';
import { AqiReportScreen } from './src/screens/AqiReportScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { SupportScreen } from './src/screens/SupportScreen';

import { Icon } from './src/components/Icon';
import { Reading, BucketedReading } from './src/utils';
import { storageService } from './src/services/storage';
import { apiService } from './src/services/api';

// BLE Service and Characteristic UUIDs
const SERVICE_UUID = '0000FFE0-0000-1000-8000-00805F9B34FB';
const CHARACTERISTIC_UUID = '0000FFE1-0000-1000-8000-00805F9B34FB';

function MainApp() {
  const { logout, token } = useAuth();

  const IS_MOCK_MODE = false; // Toggle this to false when connecting to the actual device
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
  const readingsBufferRef = useRef<Reading[]>([]);

  // Accumulates raw readings within the current 5-minute window
  const currentBucketRef = useRef<{
    bucketStart: Date;
    readings: number[];
  } | null>(null);

  // FIX C1: Refs that mirror state so the flush interval (set up once) always reads
  // the latest values without needing to be torn down and recreated.
  const connectedDeviceRef = useRef<any>(null);
  const tokenRef = useRef<string | null>(null);


  useEffect(() => {
    if (!IS_MOCK_MODE) return;

    setBtStatus('connected');
    setConnectedDevice({
      id: '90:15:06:7C:2D:8A',
      name: 'Shudhvayu Mock Device'
    });

    // Initialize the first bucket if it doesn't exist
    if (!currentBucketRef.current) {
      const now = new Date();
      const intervalMs = 5 * 60 * 1000;
      const bucketTime = Math.floor(now.getTime() / intervalMs) * intervalMs;
      currentBucketRef.current = {
        bucketStart: new Date(bucketTime),
        readings: []
      };
    }

    const mockInterval = setInterval(async () => { // Marked as async to allow 'await'
      const now = new Date();
      const mockValue = parseFloat((Math.random() * 30 + 15).toFixed(1));

      // 1. Reset Watchdog
      lastDataTimeRef.current = now;
      setLastDataTime(now);
      noDataAlertShownRef.current = false;

      // 2. Update Live UI Buffer
      readingsBufferRef.current.unshift({ ts: now, value: mockValue });
      if (readingsBufferRef.current.length > 200) {
        readingsBufferRef.current.pop();
      }

      // --- 3. THE INGESTION LOGIC ---
      const intervalMs = 5 * 60 * 1000;
      const bucketTime = Math.floor(now.getTime() / intervalMs) * intervalMs;

      // Check if the 5-minute window has crossed
      if (currentBucketRef.current && currentBucketRef.current.bucketStart.getTime() !== bucketTime) {
        const oldBucket = currentBucketRef.current;

        // Calculate average for the window
        const averageValue = oldBucket.readings.length > 0
          ? oldBucket.readings.reduce((a, b) => a + b, 0) / oldBucket.readings.length
          : mockValue;

        try {
          console.log(`[Ingestion] Syncing 5-min bucket for: ${oldBucket.bucketStart.toLocaleTimeString()}`);

          const response = await fetch('https://air.shudhvayu.com/api/v1/data/ingest', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${tokenRef.current}`
            },
            body: JSON.stringify({
              macAddress: '90:15:06:7C:2D:8A',
              timestamp: oldBucket.bucketStart.toISOString(),
              measurementType: 'PM2.5',
              value: parseFloat(averageValue.toFixed(2)),
              unit: 'ug/m3'
            }),
          });

          const responseText = await response.text();
          try {
            const result = JSON.parse(responseText);
            if (response.ok) {
              console.log(`[Ingestion] SUCCESS:`, result);

              // ✅ Only create new bucket AFTER successful API call
              currentBucketRef.current = {
                bucketStart: new Date(bucketTime),
                readings: [mockValue]
              };
            } else {
              console.warn(`[Ingestion] REJECTED:`, result.message);
              // ✅ Keep old bucket by NOT creating a new one
            }
          } catch (parseError) {
            console.error("[Ingestion] Server returned HTML/Error instead of JSON:");
            console.log(responseText);
            // ✅ Keep old bucket - don't create new one
          }
        } catch (networkError) {
          console.error(`[Ingestion] NETWORK ERROR:`, networkError);
          // ✅ Keep old bucket - don't create new one
        }


      } else {
        // Still inside the same 5-minute window, just collect data
        if (currentBucketRef.current) {
          currentBucketRef.current.readings.push(mockValue);
        }
      }
    }, 1000);
    return () => clearInterval(mockInterval);
  }, []);

  // Keep refs in sync whenever state changes
  useEffect(() => {
    connectedDeviceRef.current = connectedDevice;
  }, [connectedDevice]);

  useEffect(() => {
    tokenRef.current = token;
    if (token) {
      console.log("[Ingestion] ✅ Token sync successful. Ready to ingest.", tokenRef.current);
    } else {
      console.log("[Ingestion] ❌ Waiting for token... Log in again if this persists.");
    }
  }, [token]);

  // Ref that always holds the latest parseData function so that BLE/Classic
  // callbacks (set up once at connection time) always invoke the freshest logic
  const parseDataRef = useRef<(rawData: string) => boolean>(() => false);

  // Accumulates partial BLE/Classic serial chunks until a full message is assembled
  const dataBufferRef = useRef<string>('');

  // Prevents the "no data" alert from firing repeatedly while data is stalled
  const noDataAlertShownRef = useRef<boolean>(false);

  // Mirrors lastDataTime in a ref so dataCheckInterval can read it without
  // being a dependency (which would cause constant interval teardown/recreation)
  const lastDataTimeRef = useRef<Date | null>(null);
  useEffect(() => {
    lastDataTimeRef.current = lastDataTime;
  }, [lastDataTime]);

  // Initialises BLE manager and requests OS permissions on mount
  useEffect(() => {
    const initBluetooth = async () => {
      try {
        // console.log('[BLE] Initializing Bluetooth...');
        await requestPermissions();

        if (!bleManagerRef.current) {
          bleManagerRef.current = new BleManager();
          // console.log('[BLE] BLE Manager created');
        }

        // Listen for system Bluetooth on/off changes
        stateSubscriptionRef.current = bleManagerRef.current.onStateChange((state) => {
          // console.log('[BLE] State changed:', state);
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
                { text: 'Cancel', style: 'cancel' },
              ]
            );
          }
        }, true);

        // console.log('[BLE] Initialization complete');
      } catch (error) {
        console.error('[BLE] Initialization error:', error);
      }
    };

    initBluetooth();

    // Cleanup all active subscriptions and timers on unmount
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

  // Requests the Android permissions required for Bluetooth scanning
  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      try {
        const apiLevel = Platform.Version;
        // console.log('[Permissions] Android API Level:', apiLevel);

        if (apiLevel >= 31) {
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
          const granted = await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          ]);
          if (granted[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] !== PermissionsAndroid.RESULTS.GRANTED) {
            Alert.alert('Permission Required', 'Location permission is required to scan for Bluetooth devices');
          } else {
            console.log('[Permissions] Location permission granted');
          }
        }
      } catch (err) {
        console.error('[Permissions] Error:', err);
      }
    }
  };

  // Animates the pulse ring around the Bluetooth icon while connected
  useEffect(() => {
    if (btStatus === 'connected') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.3, duration: 1000, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [btStatus, pulseAnim]);

  // Auto-scrolls the live feed table to the newest row when readings change
  // useEffect(() => {
  //   if (scrollViewRef.current && readings.length > 0) {
  //     setTimeout(() => {
  //       scrollViewRef.current?.scrollToEnd({ animated: true });
  //     }, 100);
  //   }
  // }, [readings]);

  // Watchdog: alerts once if no data has arrived for >15 s while connected.
  // Reads lastDataTime from a ref (not state) so this effect only mounts/unmounts
  // on btStatus change — not on every single reading.
  useEffect(() => {
    if (btStatus === 'connected') {
      dataCheckInterval.current = setInterval(() => {
        const currentLastDataTime = lastDataTimeRef.current;
        if (currentLastDataTime) {
          const timeSinceLastData = (Date.now() - currentLastDataTime.getTime()) / 1000;
          if (timeSinceLastData > 30 && !noDataAlertShownRef.current) {
            noDataAlertShownRef.current = true; // lock until fresh data arrives
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
        dataCheckInterval.current = null;
      }
    };
  }, [btStatus]); // only btStatus — lastDataTime read via ref

  // Registers the device with the backend so it can receive ingested data
  const registerDeviceWithBackend = async (deviceId: string) => {
    if (!token) {
      console.log('[Device Registration] No token available');
      return;
    }
    try {
      console.log('[Device Registration] Registering device:', deviceId);
      const result = await apiService.registerDevice(deviceId, token);
      console.log('[Device Registration] Success:', result);
      return result;
    } catch (error: any) {
      console.error('[Device Registration] Error:', error.message);
      // Non-blocking — connection proceeds even if registration fails
    }
  };

  // Periodically checks whether the current bucket is older than 1 minutes.
  // When it is, the bucket is flushed to local storage and the backend.
  //
  // FIX C1: This effect now runs once on mount and stays alive. It reads
  //         connectedDevice and token from REFS, not state, so it never goes
  //         stale and never needs to be torn down/recreated.
  // FIX C3: The bucket ref is only nulled AFTER the API call succeeds.
  //         If the call fails the bucket stays intact for the next 30-s check.
  useEffect(() => {
    const flushInterval = setInterval(async () => {
      // Read current values from refs — always fresh, no stale closure
      const device = connectedDeviceRef.current;
      const tok = tokenRef.current;

      // Skip if not connected or not authenticated
      if (!device || !tok) return;

      const bucket = currentBucketRef.current;
      if (!bucket || bucket.readings.length === 0) return;

      const intervalMs = 5 * 60 * 1000; // 1 minutes debugging-1
      const bucketAge = Date.now() - bucket.bucketStart.getTime();

      // Only flush once the full 5-minute window has elapsed
      if (bucketAge < intervalMs) return;

      console.log('[Bucket Flush] Flushing bucket with', bucket.readings.length, 'readings');

      const avgValue = bucket.readings.reduce((a, b) => a + b, 0) / bucket.readings.length;

      const bucketedReading: BucketedReading = {
        bucketStart: bucket.bucketStart,
        bucketEnd: new Date(bucket.bucketStart.getTime() + intervalMs),
        avgValue,
        minValue: Math.min(...bucket.readings),
        maxValue: Math.max(...bucket.readings),
        count: bucket.readings.length,
        readings: bucket.readings,
      };

      // 1. Persist to local storage (best-effort, non-blocking)
      storageService.appendReading(bucketedReading).catch(err =>
        console.error('[Storage] Error saving bucket:', err)
      );

      // 2. Send to backend
      try {
        await apiService.ingestData({
          macAddress: device.id,
          timestamp: bucketedReading.bucketStart.toISOString(),
          measurementType: 'PM2.5(ATM)',
          value: avgValue,
          unit: 'ug/m3',
        }, tok);

        console.log('[Bucket Flush] Successfully sent to backend');

        // FIX C3: Only clear the bucket AFTER the API call succeeds.
        // If ingestData threw, we skip this line and the bucket survives
        // for the next flush check 30 s later — automatic retry.
        currentBucketRef.current = null;
      } catch (err) {
        console.error('[API] Ingest error (bucket preserved for retry):', err);
        // Bucket is NOT nulled — it will be retried on the next interval tick
      }
    }, 30000); // check every 30 s

    return () => clearInterval(flushInterval);
  }, []); // empty deps — runs once, reads everything via refs


  // Scans for both BLE and Classic Bluetooth devices and populates the picker list
  const scanForDevices = async () => {
    if (!bleManagerRef.current) {
      Alert.alert('Error', 'Bluetooth not initialized');
      return;
    }

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
          { text: 'Cancel', style: 'cancel' },
        ]
      );
      return;
    }

    console.log('[BLE] Starting device scan...');
    setScanning(true);
    setDevices([]);
    const foundDevices = new Map();

    try {
      // BLE scan — callback fires per advertisement received
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
            id: device.id, name: device.name, type: 'BLE', rawDevice: device,
          });
          setDevices(Array.from(foundDevices.values()));
        }
      });

      // Also list already-paired Classic Bluetooth devices
      try {
        const paired = await RNBluetoothClassic.getBondedDevices();
        console.log('[Classic BT] Found', paired.length, 'paired devices');
        paired.forEach((device) => {
          if (!foundDevices.has(device.address)) {
            foundDevices.set(device.address, {
              id: device.address, name: device.name || 'Unknown Device', type: 'Classic', rawDevice: device,
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

    // Auto-stop after 10 s to conserve battery
    setTimeout(() => {
      if (bleManagerRef.current) {
        bleManagerRef.current.stopDeviceScan();
        console.log('[BLE] Scan stopped');
      }
      setScanning(false);
    }, 10000);
  };

  // Connects to a BLE or Classic device and starts the data stream
  const connectToDevice = async (deviceInfo: any) => {
    if (!bleManagerRef.current) {
      Alert.alert('Error', 'Bluetooth not initialized');
      return;
    }

    try {
      setBtStatus('connecting');
      bleManagerRef.current.stopDeviceScan();

      const now = new Date(); // Initial timestamp for both types

      if (deviceInfo.type === 'BLE') {
        // ---- BLE CONNECTION ----
        const device = await bleManagerRef.current.connectToDevice(deviceInfo.rawDevice.id);
        await device.discoverAllServicesAndCharacteristics();

        setConnectedDevice(device);
        connectedDeviceType.current = 'BLE';
        setBtStatus('connected');
        setDeviceModalVisible(false);

        // FIX: Synchronize State and Ref immediately on connection
        setLastDataTime(now);
        lastDataTimeRef.current = now;

        await registerDeviceWithBackend(device.id);

        bleSubscription.current = device.monitorCharacteristicForService(
          SERVICE_UUID,
          CHARACTERISTIC_UUID,
          (error, characteristic) => {
            if (error) return;
            if (characteristic?.value) {
              const rawData = Buffer.from(characteristic.value, 'base64').toString('utf-8');

              const success = parseDataRef.current(rawData);
              if (success) {
                const nowData = new Date();
                // FIX: Update Ref inside the callback to satisfy Watchdog
                setLastDataTime(nowData);
                lastDataTimeRef.current = nowData;
              }
            }
          }
        );

        Alert.alert('Success', `Connected to ${deviceInfo.name}`);

      } else {
        // ---- CLASSIC BLUETOOTH CONNECTION ----
        const device = await RNBluetoothClassic.connectToDevice(deviceInfo.rawDevice.address);

        setConnectedDevice(device);
        connectedDeviceType.current = 'Classic';
        setBtStatus('connected');
        setDeviceModalVisible(false);

        // FIX: Synchronize State and Ref immediately on connection
        setLastDataTime(now);
        lastDataTimeRef.current = now;

        // Poll Classic BT every 500ms — faster polling prevents buffer overflow
        classicReadInterval.current = setInterval(async () => {
          try {
            const available = await device.available();
            if (available > 0) {
              const data = await device.read();
              const success = parseDataRef.current(data);
              if (success) {
                const nowData = new Date();
                // FIX: Update Ref inside the callback to satisfy Watchdog
                setLastDataTime(nowData);
                lastDataTimeRef.current = nowData;
              }
            }
          } catch (error) { }
        }, 500);

        Alert.alert('Success', `Connected to ${deviceInfo.name}`);
      }
    } catch (error: any) {
      setBtStatus('disconnected');
      Alert.alert('Connection Failed', error.message || 'Could not connect to device');
    }
  };

  // Disconnects the active device, flushes any pending bucket, and tears down subscriptions
  const disconnectDevice = async () => {
    if (connectedDevice) {
      try {
        console.log('[Disconnect] Disconnecting...');

        // Save any partially-filled bucket so no data is lost on disconnect
        if (currentBucketRef.current && currentBucketRef.current.readings.length > 0) {
          const intervalMs = 5 * 60 * 1000;
          const prevBucket = currentBucketRef.current;
          const avgValue = prevBucket.readings.reduce((a, b) => a + b, 0) / prevBucket.readings.length;

          const bucketedReading: BucketedReading = {
            bucketStart: prevBucket.bucketStart,
            bucketEnd: new Date(prevBucket.bucketStart.getTime() + intervalMs),
            avgValue,
            minValue: Math.min(...prevBucket.readings),
            maxValue: Math.max(...prevBucket.readings),
            count: prevBucket.readings.length,
            readings: prevBucket.readings,
          };

          await storageService.appendReading(bucketedReading);
          console.log('[Disconnect] Saved pending bucket to local storage');
        }

        currentBucketRef.current = null;
        noDataAlertShownRef.current = false;

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

  // Parses a raw serial chunk, extracts the PM2.5 value, and accumulates it into
  // the current 5-minute bucket.  Returns true on successful extraction.
  //
  // FIX C2: This function no longer sends completed buckets to the backend.
  //         That responsibility belongs exclusively to the flushInterval above,
  //         eliminating the duplicate-send race condition.


  // const parseData = (rawData: string): boolean => {
  //   dataBufferRef.current += rawData;

  //   console.log('[Data] 🔥 Raw received:', rawData);
  //   console.log('[Data] 📦 Buffer:', dataBufferRef.current);

  //   let val: number | null = null;
  //   let match: RegExpMatchArray | null = null;

  //   // Pattern 1 (most specific): "PM2.5(ATM): 123.45 ug/m3"
  //   match = dataBufferRef.current.match(/PM2\.5\(ATM\):\s*([\d.]+)\s*ug\/m3/i);
  //   if (match) {
  //     val = parseFloat(match[1]);
  //     console.log('[Data] ✅ Pattern 1 matched (Full format)');
  //   }

  //   // Pattern 2: "PM2.5: 123.45"
  //   if (val === null) {
  //     match = dataBufferRef.current.match(/PM2\.5\s*:\s*([\d.]+)/i);
  //     if (match) {
  //       val = parseFloat(match[1]);
  //       console.log('[Data] ✅ Pattern 2 matched (PM2.5: XXX)');
  //     }
  //   }

  //   // Pattern 3: "PM25: 123.45"
  //   if (val === null) {
  //     match = dataBufferRef.current.match(/PM25\s*:\s*([\d.]+)/i);
  //     if (match) {
  //       val = parseFloat(match[1]);
  //       console.log('[Data] ✅ Pattern 3 matched (PM25: XXX)');
  //     }
  //   }

  //   // Pattern 4 (least specific): bare number — only if buffer has no letters
  //   // (guards against parseFloat greedily extracting a number from a partial named message)
  //   if (val === null) {
  //     const trimmed = dataBufferRef.current.trim();
  //     if (!/[a-zA-Z]/.test(trimmed)) {
  //       const numValue = parseFloat(trimmed);
  //       if (!isNaN(numValue) && numValue >= 0 && numValue < 1000) {
  //         val = numValue;
  //         console.log('[Data] ✅ Pattern 4 matched (Number only)');
  //       }
  //     }
  //   }

  //   if (val !== null && !isNaN(val)) {
  //     const parsedValue: number = val; // narrow type for use inside closures
  //     console.log('[Data] ✅✅✅ SUCCESS! Parsed value:', parsedValue);
  //     const now = new Date();
  //     dataBufferRef.current = ''; // message fully consumed

  //     // Fresh data arrived — reset the "no data" alert lock
  //     noDataAlertShownRef.current = false;

  //     // --- 5-minute bucket accumulation ---
  //     const intervalMs = 1 * 60 * 1000; //debugging-1
  //     const bucketTime = Math.floor(now.getTime() / intervalMs) * intervalMs;
  //     const bucketStart = new Date(bucketTime);

  //     if (!currentBucketRef.current || currentBucketRef.current.bucketStart.getTime() !== bucketTime) {
  //       // We've crossed into a new 5-min window.
  //       // FIX C2: Do NOT send the previous bucket here.  The flushInterval handles all sends.
  //       if (currentBucketRef.current && currentBucketRef.current.readings.length > 0) {
  //         console.log('[Bucket] Boundary crossed. Previous bucket has',
  //           currentBucketRef.current.readings.length,
  //           'readings — flushInterval will send it.');
  //       }

  //       // Start a fresh bucket for the new window
  //       currentBucketRef.current = {
  //         bucketStart,
  //         readings: [parsedValue],
  //       };
  //       console.log('[Bucket] Created new bucket at', bucketStart.toISOString());
  //     } else {
  //       // Same window — just append
  //       currentBucketRef.current.readings.push(parsedValue);
  //       console.log('[Bucket] Added reading. Total in bucket:', currentBucketRef.current.readings.length);
  //     }

  //     // Push to the live UI (capped at 500 rows)
  //     setReadings((prev) => {
  //       const next = [...prev, { ts: now, value: parsedValue }];
  //       const limited = next.length > 500 ? next.slice(-500) : next;
  //       console.log('[UI] ✅✅✅ Added to live feed. Total:', limited.length);
  //       return limited;
  //     });

  //     return true;
  //   } else {
  //     console.log('[Data] ❌ NO MATCH. Buffer:', dataBufferRef.current);
  //     console.log('[Data] Buffer hex:', Buffer.from(dataBufferRef.current).toString('hex'));
  //   }

  //   // Safety valve: corrupt buffer cleared after 200 chars
  //   if (dataBufferRef.current.length > 200) {
  //     console.log('[Data] ⚠️ Buffer overflow, clearing');
  //     dataBufferRef.current = '';
  //   }

  //   return false;
  // };
  // const parseData = (rawData: string): boolean => {
  //   dataBufferRef.current += rawData;

  //   // 1. Loose regex to find the number and ignore label clutter
  //   const match = dataBufferRef.current.match(/(\d+\.?\d*)/);

  //   if (match) {
  //     const val = parseFloat(match[1]);
  //     if (!isNaN(val) && val >= 0 && val < 1000) {
  //       const now = new Date();

  //       // 2. CRITICAL: Reset the watchdog timer immediately
  //       setLastDataTime(now); 
  //       noDataAlertShownRef.current = false;
  //       dataBufferRef.current = ''; 

  //       // 3. 1-Minute Ingestion Logic for debugging
  //       const intervalMs = 1 * 60 * 1000; 
  //       const bucketTime = Math.floor(now.getTime() / intervalMs) * intervalMs;
  //       const bucketStart = new Date(bucketTime);

  //       if (!currentBucketRef.current || currentBucketRef.current.bucketStart.getTime() !== bucketTime) {
  //         currentBucketRef.current = { bucketStart, readings: [val] };
  //       } else {
  //         currentBucketRef.current.readings.push(val);
  //       }

  //       // 4. Constant Flow: Maintain 500 readings for the live feed
  //       setReadings((prev) => {
  //         const next = [...prev, { ts: now, value: val }];
  //         // Automatically discards old rows to keep the feed moving constantly
  //         return next.length > 200 ? next.slice(-200) : next; 
  //       });

  //       return true;
  //     }
  //   }

  //   // 5. Clutter Control: Clear buffer quickly if no number is found
  //   if (dataBufferRef.current.length > 20) {
  //     dataBufferRef.current = '';
  //   }

  //   return false;
  // };

  const [debugLogs, setDebugLogs] = useState<string[]>([]);

  // Using a functional update to ensure we never lose logs during rapid data bursts
  const addDebugLog = (msg: string) => {
    const time = new Date().toLocaleTimeString().split(' ')[0]; // HH:MM:SS
    setDebugLogs(prev => [`[${time}] ${msg}`, ...prev].slice(0, 8)); // Keep last 8 logs
  };

  const parseData = (rawData: string): boolean => {
    dataBufferRef.current += rawData;
    addDebugLog(`Raw: ${rawData.slice(0, 20)}...`);

    // Resilient matching
    const match = dataBufferRef.current.match(/(?:PM2\.5|PM25|ATM)[:\s]+([\d.]+)/i)
      || dataBufferRef.current.match(/(\d+\.?\d*)/);

    if (match) {
      const val = parseFloat(match[1]);
      if (!isNaN(val) && val >= 0 && val < 1000) {
        const now = new Date();
        addDebugLog(`✅ Parsed: ${val}`);

        // 1. Update Watchdog (Prevent "No Data" Alert)
        lastDataTimeRef.current = now;
        setLastDataTime(now);
        noDataAlertShownRef.current = false;
        dataBufferRef.current = ''; // Clear buffer after successful parse

        // 2. Update Live UI Buffer (Non-blocking)
        readingsBufferRef.current.unshift({ ts: now, value: val });
        if (readingsBufferRef.current.length > 200) {
          readingsBufferRef.current.pop();
        }

        // --- 3. THE BUCKET INGESTION LOGIC (SAME AS MOCK MODE) ---
        const intervalMs = 5 * 60 * 1000; // 5 minutes
        const bucketTime = Math.floor(now.getTime() / intervalMs) * intervalMs;

        // Check if we've crossed into a new 5-minute window
        if (!currentBucketRef.current || currentBucketRef.current.bucketStart.getTime() !== bucketTime) {

          // If there's an old bucket with data, send it to the backend
          if (currentBucketRef.current && currentBucketRef.current.readings.length > 0) {
            const oldBucket = currentBucketRef.current;
            const averageValue = oldBucket.readings.reduce((a, b) => a + b, 0) / oldBucket.readings.length;

            // Send to backend asynchronously (don't block data parsing)
            (async () => {
              try {
                console.log(`[BT Ingestion] Syncing 5-min bucket for: ${oldBucket.bucketStart.toLocaleTimeString()}`);

                const response = await fetch('https://air.shudhvayu.com/api/v1/data/ingest', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${tokenRef.current}`
                  },
                  body: JSON.stringify({
                    macAddress: connectedDeviceRef.current?.id || 'UNKNOWN',
                    timestamp: oldBucket.bucketStart.toISOString(),
                    measurementType: 'PM2.5',
                    value: parseFloat(averageValue.toFixed(2)),
                    unit: 'ug/m3'
                  }),
                });

                const responseText = await response.text();

                try {
                  const result = JSON.parse(responseText);
                  if (response.ok) {
                    console.log(`[BT Ingestion] SUCCESS:`, result);
                  } else {
                    console.warn(`[BT Ingestion] REJECTED:`, result.message);
                  }
                } catch (parseError) {
                  console.error("[BT Ingestion] Server returned HTML/Error instead of JSON:");
                  console.log(responseText);
                }
              } catch (networkError) {
                console.error(`[BT Ingestion] NETWORK ERROR:`, networkError);
              }
            })();
          }

          // Start a new bucket for the new window
          currentBucketRef.current = {
            bucketStart: new Date(bucketTime),
            readings: [val]
          };
          console.log('[BT Bucket] Created new bucket at', new Date(bucketTime).toISOString());
        } else {
          // Still inside the same 5-minute window, just accumulate
          currentBucketRef.current.readings.push(val);
          console.log('[BT Bucket] Added reading. Total in bucket:', currentBucketRef.current.readings.length);
        }

        return true;
      }
    }

    // Safety: Clear buffer if it gets too large
    if (dataBufferRef.current.length > 50) {
      addDebugLog(`⚠️ Buffer overflow, cleared`);
      dataBufferRef.current = '';
    }

    return false;
  };

  // 3. Add this Effect to Sync the UI every 1 second
  useEffect(() => {
    const uiSyncInterval = setInterval(() => {
      // ONLY sync state if we are actually looking at the 'live' tab
      // This stops the background "noise" from re-rendering the AQI screen
      if (btStatus === 'connected' && activeTab === 'live' && readingsBufferRef.current.length > 0) {
        setReadings([...readingsBufferRef.current]);
      }
    }, 1000);

    return () => clearInterval(uiSyncInterval);
  }, [btStatus]);


  // Keep the ref in sync so BLE/Classic callbacks always call the current version
  parseDataRef.current = parseData;

  // Opens the device modal or prompts to disconnect if already connected
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

  const renderDeviceItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.deviceItem}
      onPress={() => connectToDevice(item)}
    >
      <View style={styles.deviceInfo}>
        <Text style={styles.deviceName}>{item.name}</Text>
        <Text style={styles.deviceId}>{item.id}</Text>
      </View>
      <View style={styles.deviceTypeBadge}>
        <Text style={styles.deviceTypeText}>{item.type}</Text>
      </View>
    </TouchableOpacity>
  );

  // Badge colours and labels driven by connection state
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
        <BluetoothIcon isActive={btStatus === 'connected'} size={40} onPress={openDeviceModal} />
      </View>

      {/* Tab Selector */}
      {(activeTab === 'live' || activeTab === 'aqi') && (
        <View style={styles.tabContainer}>
          <View style={styles.tabInner}>
            <TouchableOpacity onPress={() => setActiveTab('live')} style={[styles.tab, activeTab === 'live' && styles.tabActive]}>
              <Text style={[styles.tabText, activeTab === 'live' && styles.tabTextActive]}>Live PM2.5</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setActiveTab('aqi')} style={[styles.tab, activeTab === 'aqi' && styles.tabActive]}>
              <Text style={[styles.tabText, activeTab === 'aqi' && styles.tabTextActive]}>AQI Report</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Side Menu */}
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
              <TouchableOpacity style={styles.menuItem} onPress={() => { setActiveTab('profile'); setMenuOpen(false); }}>
                <Text style={styles.menuItemText}>Profile</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuItem} onPress={() => Linking.openURL('https://shudhvayu.com/about')}>
                <Text style={styles.menuItemText}>About Us</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuItem} onPress={() => Linking.openURL('https://shudhvayu.com/privacy')}>
                <Text style={styles.menuItemText}>Privacy & Security</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuItem} onPress={() => { setActiveTab('support'); setMenuOpen(false); }}>
                <Text style={styles.menuItemText}>Support</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuItem} onPress={() => Linking.openURL('https://shudhvayu.com/terms')}>
                <Text style={styles.menuItemText}>Terms of Services</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.menuItem, styles.logoutItem]} onPress={logout}>
                <Text style={styles.logoutText}>Logout</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Device Selection Bottom Sheet */}
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
                  renderItem={renderDeviceItem}
                  keyExtractor={(item) => item.id} // ✅ Fixed: Use unique device ID
                // ❌ REMOVED: Wrong headers for device list
                // ❌ REMOVED: stickyHeaderIndices - not needed here
                />
              )}
            </View>
            <TouchableOpacity style={styles.refreshBtn} onPress={scanForDevices} disabled={scanning}>
              <Text style={styles.refreshBtnText}>{scanning ? 'Scanning...' : '🔄 Refresh'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.closeBtn} onPress={() => {
              if (bleManagerRef.current) bleManagerRef.current.stopDeviceScan();
              setDeviceModalVisible(false);
            }}>
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Main Content */}
      <View style={styles.content}>
        {activeTab === 'live' && (
          <LiveFeedScreen
            btStatus={btStatus}
            readings={readings} // This state is updated by your mock effect every 1 second
            latest={latest}
            isConnected={isConnected}
            btBadge={btBadge}
            pulseAnim={pulseAnim}
            connectedDeviceId={connectedDevice?.id}
            debugLogs={debugLogs}
          />
        )}

        {/* Dummy device id for fallback  */}
        {activeTab === 'aqi' && (
          <AqiReportScreen
            readings={readings}
            deviceId={connectedDevice?.id || '90:15:06:7C:2D:8A'}
          // deviceId={connectedDevice?.id || '6943fa46f429c94f71aa8df4'} // for checking dummy data
          />
        )}
        {activeTab === 'profile' && (
          <ProfileScreen onBackPress={() => setActiveTab('live')} />
        )}
        {activeTab === 'support' && (
          <SupportScreen onBackPress={() => setActiveTab('live')} />
        )}
      </View>
    </SafeAreaView>
  );
}


// Root wrapper — provides auth context to the whole tree
export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

// Renders LoginScreen or MainApp based on authentication state
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#18181b' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#18181b' },
  loadingText: { color: '#fff', marginTop: 16, fontSize: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#27272a' },
  headerButton: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  tabContainer: { alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#27272a' },
  tabInner: { flexDirection: 'row', backgroundColor: '#27272a', padding: 4, borderRadius: 24, borderWidth: 1, borderColor: '#3f3f46' },
  tab: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginHorizontal: 2 },
  tabActive: { backgroundColor: '#fff' },
  tabText: { fontSize: 14, fontWeight: '500', color: '#d4d4d8', marginLeft: 8 },
  tabTextActive: { color: '#18181b' },
  modalOverlay: { flex: 1 },
  modalBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' },
  menu: { position: 'absolute', top: 0, left: 0, bottom: 0, width: 280, backgroundColor: '#27272a' },
  menuHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#3f3f46' },
  menuTitle: { fontSize: 20, fontWeight: '600', color: '#fff' },
  menuSubtitle: { fontSize: 14, color: '#a1a1aa', marginTop: 4 },
  menuItems: { flex: 1 },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#3f3f46' },
  menuItemText: { fontSize: 14, fontWeight: '500', color: '#d4d4d8', marginLeft: 12 },
  logoutItem: { borderTopWidth: 1, borderTopColor: '#3f3f46' },
  logoutText: { fontSize: 14, fontWeight: '500', color: '#f87171', marginLeft: 12 },
  content: { flex: 1, backgroundColor: '#18181b' },
  deviceModalContent: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#27272a', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '80%' },
  deviceModalTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff', marginBottom: 16, textAlign: 'center' },
  deviceListContainer: { maxHeight: 300, marginBottom: 16 },
  scanningContainer: { alignItems: 'center', padding: 20 },
  scanningText: { textAlign: 'center', fontSize: 14, color: '#a1a1aa', marginTop: 12 },
  noDevicesText: { textAlign: 'center', fontSize: 14, color: '#71717a', padding: 20 },
  deviceItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#3f3f46', backgroundColor: '#18181b', marginBottom: 8, borderRadius: 8 },
  deviceInfo: { flex: 1 },
  deviceName: { fontSize: 16, fontWeight: '600', color: '#fff', marginBottom: 4 },
  deviceId: { fontSize: 12, color: '#a1a1aa' },
  deviceTypeBadge: { backgroundColor: '#3b82f6', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  deviceTypeText: { fontSize: 11, color: '#fff', fontWeight: '600' },
  refreshBtn: { backgroundColor: '#22c55e', padding: 14, borderRadius: 8, marginBottom: 10 },
  refreshBtnText: { color: '#fff', fontSize: 16, fontWeight: '600', textAlign: 'center' },
  closeBtn: { backgroundColor: '#3f3f46', padding: 14, borderRadius: 8 },
  closeBtnText: { color: '#e4e4e7', fontSize: 16, fontWeight: '500', textAlign: 'center' },
  tableScroll: {
    height: 400, // Fixed height is safer than maxHeight for live feeds
  },

  // 2. Table Header Row (The sticky Date/Time/Value labels)
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#3f3f46',
    padding: 12,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },

  // 3. Header Text Styles
  tableHeaderCell: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },

  // 4. Column Widths (Must match between Header and Data Rows)
  col35: {
    width: '35%',
  },
  col30: {
    width: '30%',
  },

  // 5. Data Row Styles
  tableRow: {
    flexDirection: 'row',
    padding: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#27272a',
  },
  tableRowAlt: {
    backgroundColor: '#111113', // Zebra striping for readability
  },

  // 6. Data Cell Text
  tableCell: {
    fontSize: 12,
    color: '#d4d4d8',
  },


});