// src/utils/BluetoothPermissions.ts
// ============================================
// ANDROID BLUETOOTH PERMISSIONS HANDLER
// ============================================
// This file handles all the complex Android BLE permission requirements
// that vary across different Android versions

import { Platform, PermissionsAndroid, Alert } from 'react-native';

/**
 * Request all necessary Bluetooth permissions for Android
 * Different Android versions require different permissions
 */
export async function requestBluetoothPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true; // iOS handles permissions differently
  }

  try {
    const androidVersion = Platform.Version;

    // Android 12+ (API 31+) - NEW permission model
    if (androidVersion >= 31) {
      const permissions = [
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      ];

      const granted = await PermissionsAndroid.requestMultiple(permissions);

      const scanGranted = granted['android.permission.BLUETOOTH_SCAN'] === 'granted';
      const connectGranted = granted['android.permission.BLUETOOTH_CONNECT'] === 'granted';

      if (!scanGranted || !connectGranted) {
        Alert.alert(
          'Bluetooth Permissions Required',
          'This app needs Bluetooth permissions to connect to your air quality sensor. Please enable them in Settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => {
              // You can use Linking.openSettings() here
            }},
          ]
        );
        return false;
      }

      return true;
    } 
    
    // Android 10-11 (API 29-30)
    else if (androidVersion >= 29) {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: 'Location Permission',
          message: 'Bluetooth Low Energy requires location permission to scan for devices.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        }
      );

      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
    
    // Android 6-9 (API 23-28)
    else {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
        {
          title: 'Location Permission',
          message: 'Bluetooth requires location permission on older Android versions.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        }
      );

      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
  } catch (error) {
    console.error('Permission error:', error);
    return false;
  }
}

/**
 * Check if all required permissions are already granted
 */
export async function checkBluetoothPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }

  try {
    const androidVersion = Platform.Version;

    if (androidVersion >= 31) {
      const scanGranted = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN
      );
      const connectGranted = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT
      );
      return scanGranted && connectGranted;
    } else if (androidVersion >= 29) {
      return await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
      );
    } else {
      return await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION
      );
    }
  } catch (error) {
    console.error('Permission check error:', error);
    return false;
  }
}