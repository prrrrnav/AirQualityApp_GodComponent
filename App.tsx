  import { AuthProvider, useAuth } from './src/context/AuthContext';
  import { LoginScreen } from './src/screens/LoginScreen';
  import BluetoothIcon from './src/components/BluetoothIcon';
  import React, { useEffect, useCallback, useRef, useState } from 'react';
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
    AppState, // ✅ Added AppState import
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
  import { requestBluetoothPermissions, checkBluetoothPermissions } from './src/utils/BluetoothPermissions';
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

    // ✅ ADDED: Refs needed for parseData
    const parseDataRef = useRef<(rawData: string) => boolean>(() => false);
    const dataBufferRef = useRef<string>('');
    const noDataAlertShownRef = useRef<boolean>(false);
    const lastDataTimeRef = useRef<Date | null>(null);

    // ============================================
    // MOCK MODE EFFECT
    // ============================================
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

      const mockInterval = setInterval(async () => {
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

    // ============================================
    // SYNC REFS WITH STATE
    // ============================================
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

    useEffect(() => {
      lastDataTimeRef.current = lastDataTime;
    }, [lastDataTime]);

    // ============================================
    // BLUETOOTH INITIALIZATION
    // ============================================
    const requestPermissions = async (): Promise<boolean> => {
      // Use the new unified permission handler
      const granted = await requestBluetoothPermissions();
      
      if (!granted) {
        Alert.alert(
          'Permissions Required', 
          'Bluetooth permissions are required to connect to devices. Please enable them in Settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() }
          ]
        );
      }
      
      return granted;
    };

    const initBluetooth = useCallback(async () => {
      console.log('[BT] Initializing Bluetooth...');
    
      // Check permissions first (faster than requesting)
      let hasPermissions = await checkBluetoothPermissions();
      
      // If not granted, request them
      if (!hasPermissions) {
        hasPermissions = await requestPermissions();
        if (!hasPermissions) {
          console.log('[BT] Permissions denied');
          Alert.alert(
            'Cannot Initialize Bluetooth',
            'Bluetooth permissions are required. Please grant them in Settings.'
          );
          return;
        }
      }
    
      console.log('[BT] Permissions granted - initializing BLE manager');
    
      const manager = new BleManager();
      bleManagerRef.current = manager;
    
      const subscription = manager.onStateChange(state => {
        console.log('[BT] State changed:', state);
        setBleState(state);
        
        if (state === State.PoweredOn) {
          console.log('[BT] ✅ Bluetooth is powered on and ready');
        } else if (state === State.PoweredOff) {
          Alert.alert(
            'Bluetooth Disabled',
            'Please enable Bluetooth to connect to your air quality sensor.'
          );
        } else if (state === State.Unauthorized) {
          Alert.alert(
            'Bluetooth Permission Denied',
            'Please grant Bluetooth permissions in Settings.'
          );
        }
      }, true);
    
      stateSubscriptionRef.current = subscription;
    }, []);

    // Initialize Bluetooth on mount
    useEffect(() => {
      initBluetooth();
      
      return () => {
        if (stateSubscriptionRef.current) {
          stateSubscriptionRef.current.remove();
        }
      };
    }, [initBluetooth]);

    // ============================================
    // APP STATE MONITORING (Foreground/Background)
    // ============================================
    useEffect(() => {
      const subscription = AppState.addEventListener('change', async (nextAppState) => {
        if (nextAppState === 'active') {
          console.log('[BT] App became active - checking permissions');
          
          const hasPerms = await checkBluetoothPermissions();
          if (!hasPerms) {
            console.log('[BT] ⚠️ Permissions lost - user may have disabled them');
            
            // Try to reconnect if we were connected
            if (connectedDevice) {
              const granted = await requestPermissions();
              if (granted && bleManagerRef.current) {
                console.log('[BT] Permissions re-granted - attempting reconnect');
                // The device will auto-reconnect through your existing logic
              }
            }
          }
        }
      });
    
      return () => subscription.remove();
    }, [connectedDevice]);


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

    
    // Scans for both BLE and Classic Bluetooth devices and populates the picker list
    const scanForDevices = async () => {
      if (!bleManagerRef.current) {
        Alert.alert('Error', 'Bluetooth not initialized');
        return;
      }

      if (bleState !== State.PoweredOn) {
        // ... (Keep your existing PoweredOn check)
        return;
      }

      console.log('[BLE] Starting device scan...');
      setScanning(true);
      setDevices([]);
      
      // We use a local variable to track discovery within this specific scan session
      const foundDevices = new Map();

      try {
        // 1. Start BLE Scan
        bleManagerRef.current.startDeviceScan(null, null, (error, device) => {
          if (error) {
            console.log('[BLE] Scan Error:', error.message);
            return;
          }
          if (device && (device.name || device.localName)) {
            const name = device.name || device.localName || 'Unknown BLE Device';
            if (!foundDevices.has(device.id)) {
              foundDevices.set(device.id, {
                id: device.id, 
                name: name, 
                type: 'BLE', 
                rawDevice: device,
              });
              // Update UI state with the combined list
              setDevices(Array.from(foundDevices.values()));
            }
          }
        });

        // 2. Get Paired Classic Devices immediately
        try {
          const paired = await RNBluetoothClassic.getBondedDevices();
          paired.forEach((device) => {
            if (!foundDevices.has(device.address)) {
              foundDevices.set(device.address, {
                id: device.address, 
                name: device.name || 'Paired Device', 
                type: 'Classic', 
                rawDevice: device,
              });
            }
          });
          setDevices(Array.from(foundDevices.values()));
        } catch (error) {
          console.log('[Classic BT] Error fetching bonded:', error);
        }

        // 3. The 20-second timeout logic
        setTimeout(() => {
          if (bleManagerRef.current) {
            bleManagerRef.current.stopDeviceScan();
            console.log('[BLE] Scan stopped');
          }
          
          setScanning(false);
          
          // Final check: if the Map we've been filling is still empty
          if (foundDevices.size === 0) {
            Alert.alert(
              'No Devices Found',
              'No Bluetooth devices were discovered. Please ensure:\n\n• Device is powered on\n• Device is in pairing mode\n• Bluetooth is enabled\n• Location permission is granted',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Retry', onPress: () => scanForDevices() }
              ]
            );
          }
        }, 20000); // 20 seconds as requested

      } catch (error) {
        console.log('[Scan] Critical Error:', error);
        setScanning(false);
      }
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
          console.log('[BLE] Attempting to connect to:', deviceInfo.name);
          const device = await bleManagerRef.current.connectToDevice(deviceInfo.rawDevice.id, {
            timeout: 15000 // 15 second connection timeout
          });
          
          console.log('[BLE] Connected, discovering services...');
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
              if (error) {
                console.error('[BLE] Monitor error:', error);
                // Handle disconnection
                if (error.message.includes('disconnected') || error.message.includes('Device is not connected')) {
                  console.log('[BLE] Device disconnected, attempting reconnection...');
                  setBtStatus('disconnected');
                  Alert.alert(
                    'Connection Lost',
                    'The Bluetooth device was disconnected. Would you like to reconnect?',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Reconnect', onPress: () => connectToDevice(deviceInfo) }
                    ]
                  );
                }
                return;
              }
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
        let errorMessage = 'Could not connect to device';
        if (error.message) {
          if (error.message.includes('timeout')) {
            errorMessage = 'Connection timeout. Device may be out of range or turned off.';
          } else if (error.message.includes('already connected')) {
            errorMessage = 'Device is already connected to another app. Please disconnect and try again.';
          } else if (error.message.includes('service')) {
            errorMessage = 'Device connected but required services not found. This device may not be compatible.';
          } else {
            errorMessage = error.message;
          }
        }
        
        Alert.alert('Connection Failed',errorMessage + 'Troubleshooting:• Ensure device is powered on• Check if device is paired in Settings• Try turning Bluetooth off and on• Restart the app',
          [
            { text: 'OK', style: 'cancel' },
            { text: 'Retry', onPress: () => connectToDevice(deviceInfo) }
          ]
        );
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

    const [debugLogs, setDebugLogs] = useState<string[]>([]);

    // Using a functional update to ensure we never lose logs during rapid data bursts
    const addDebugLog = (msg: string) => {
      const time = new Date().toLocaleTimeString().split(' ')[0]; // HH:MM:SS
      setDebugLogs(prev => [`[${time}] ${msg}`, ...prev].slice(0, 8)); // Keep last 8 logs
    };

    const parseData = (rawData: string): boolean => {
      dataBufferRef.current += rawData;
      addDebugLog(`Raw: ${rawData.slice(0, 20)}...`);
    
      // --- START OF IMPROVED PATTERN MATCHING ---
      
      // Pattern 1 - Most specific: "PM2.5(ATM): 45.6 ug/m3"
      let match = dataBufferRef.current.match(/PM2\.5\(ATM\)\s*:\s*([\d.]+)\s*ug\/m3/i);
    
      // Pattern 2: "PM2.5: 45.6 ug/m3" (with unit)
      if (!match) {
        match = dataBufferRef.current.match(/PM2\.5\s*:\s*([\d.]+)\s*ug\/m3/i);
      }
    
      // Pattern 3: "PM25: 45.6 ug/m3" (with unit)
      if (!match) {
        match = dataBufferRef.current.match(/PM25\s*:\s*([\d.]+)\s*ug\/m3/i);
      }
    
      // Pattern 4: "PM2.5(ATM): 45.6" (without unit, but with label)
      if (!match) {
        match = dataBufferRef.current.match(/PM2\.5\(ATM\)\s*:\s*([\d.]+)/i);
      }
    
      // Pattern 5: "PM2.5: 45.6" (without unit, but with label)
      if (!match) {
        match = dataBufferRef.current.match(/PM2\.5\s*:\s*([\d.]+)/i);
      }
    
      // Pattern 6: Last resort - bare number ONLY if buffer has newline or is short
      if (!match) {
        const trimmed = dataBufferRef.current.trim();
        // 1. No "PM" text in buffer (prevents matching the '2.5' in the label)
        // 2. Buffer contains newline (message complete) OR buffer is short
        if (!/PM/i.test(trimmed) && (trimmed.includes('\n') || trimmed.length < 10)) {
          const lines = trimmed.split('\n');
          const lastLine = lines[lines.length - 1].trim();
          const numValue = parseFloat(lastLine);
          if (!isNaN(numValue) && numValue >= 0 && numValue < 1000) {
            match = [lastLine, String(numValue)]; // Fake match array for consistency
          }
        }
      }
    
      // --- END OF IMPROVED PATTERN MATCHING ---
    
      if (match && match[1]) {
        const val = parseFloat(match[1]);
        if (!isNaN(val) && val >= 0 && val < 1000) {
          const now = new Date();
          addDebugLog(`✅ Parsed: ${val}`);
    
          // 1. Update Watchdog
          lastDataTimeRef.current = now;
          setLastDataTime(now);
          noDataAlertShownRef.current = false;
          dataBufferRef.current = ''; // Clear buffer after successful parse
    
          // 2. Update Live UI Buffer
          readingsBufferRef.current.unshift({ ts: now, value: val });
          if (readingsBufferRef.current.length > 200) {
            readingsBufferRef.current.pop();
          }
    
          // 3. THE BUCKET INGESTION LOGIC
          const intervalMs = 5 * 60 * 1000;
          const bucketTime = Math.floor(now.getTime() / intervalMs) * intervalMs;
    
          if (!currentBucketRef.current || currentBucketRef.current.bucketStart.getTime() !== bucketTime) {
            if (currentBucketRef.current && currentBucketRef.current.readings.length > 0) {
              const oldBucket = currentBucketRef.current;
              const averageValue = oldBucket.readings.reduce((a, b) => a + b, 0) / oldBucket.readings.length;
    
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
    
            currentBucketRef.current = {
              bucketStart: new Date(bucketTime),
              readings: [val]
            };
            console.log('[BT Bucket] Created new bucket at', new Date(bucketTime).toISOString());
          } else {
            currentBucketRef.current.readings.push(val);
            console.log('[BT Bucket] Added reading. Total in bucket:', currentBucketRef.current.readings.length);
          }
    
          return true;
        }
      }
    
      // Safety: Clear buffer if it gets too large (increased for longer descriptive strings)
      if (dataBufferRef.current.length > 150) {
        addDebugLog(`⚠️ Buffer overflow, cleared`);
        dataBufferRef.current = '';
      }
    
      return false;
    };

    // 3. Sync UI every 1 second - ALWAYS update to prevent freezing
    useEffect(() => {
      const uiSyncInterval = setInterval(() => {
        // ✅ FIXED: Update regardless of tab to prevent freezing
        if (btStatus === 'connected' && readingsBufferRef.current.length > 0) {
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