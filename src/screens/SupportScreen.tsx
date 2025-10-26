// src/screens/SupportScreen.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export const SupportScreen: React.FC = () => {
  return (
    <View style={styles.supportContainer}>
      <Text style={styles.supportTitle}>Support</Text>
      <View style={styles.supportCard}>
        <Text style={styles.supportText}>
          Need help? Contact support@shudhvayu.app
        </Text>
      </View>
    </View>
  );
};

// Styles copied from App.tsx
const styles = StyleSheet.create({
  supportContainer: {
    padding: 24,
  },
  supportTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  supportCard: {
    backgroundColor: '#27272a',
    borderWidth: 1,
    borderColor: '#3f3f46',
    borderRadius: 8,
    padding: 16,
  },
  supportText: {
    fontSize: 14,
    color: '#e4e4e7',
  },
});