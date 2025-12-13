// src/screens/SupportScreen.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Icon } from '../components/Icon';

interface SupportScreenProps {
  onBackPress?: () => void;
}

export const SupportScreen: React.FC<SupportScreenProps> = ({ onBackPress }) => {
  return (
    <View style={styles.supportContainer}>
      <View style={styles.supportHeader}>
        {onBackPress && (
          <TouchableOpacity 
            style={styles.homeButton}
            onPress={onBackPress}>
            <Icon name="home" size={24} color="#3b82f6" />
          </TouchableOpacity>
        )}
        <Text style={styles.supportTitle}>Support</Text>
      </View>
      <View style={styles.supportCard}>
        <Text style={styles.supportText}>
          Need help? Contact support@shudhvayu.app
        </Text>
      </View>
    </View>
  );
};

// Styles
const styles = StyleSheet.create({
  supportContainer: {
    padding: 16,
  },
  supportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  homeButton: {
    width: 44,
    height: 44,
    backgroundColor: '#27272a',
    borderWidth: 1,
    borderColor: '#3f3f46',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  supportTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
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