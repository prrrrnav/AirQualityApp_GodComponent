// src/screens/ProfileScreen.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Icon } from '../components/Icon';
import { useAuth } from '../context/AuthContext'; // Import useAuth

export const ProfileScreen: React.FC = () => {
  // Get user and logout function from context
  const { currentUser, logout } = useAuth();

  return (
    <View style={styles.profileContainer}>
      <View style={styles.profileHeader}>
        <Text style={styles.profileTitle}>Profile</Text>
        <TouchableOpacity style={styles.editButton}>
          <Icon name="edit" size={20} color="#d4d4d8" />
        </TouchableOpacity>
      </View>

      <View style={styles.profileCard}>
        <View style={styles.profileTop}>
          <View style={styles.avatar}>
            <Icon name="user" size={40} color="#fff" />
          </View>
          <View>
            {/* Use dynamic data */}
            <Text style={styles.profileName}>
              {currentUser?.name || 'Partner Account'}
            </Text>
            <Text style={styles.profileSubtitle}>
              {currentUser?.email || 'Shudhvayu Partner'}
            </Text>
          </View>
        </View>

        <View style={styles.profileDetails}>
          <View style={styles.profileRow}>
            <Text style={styles.profileLabel}>User Name</Text>
            {/* Use dynamic data */}
            <Text style={styles.profileValue}>
              {currentUser?.name || 'Partner'}
            </Text>
          </View>
          <View style={styles.profileRow}>
            <Text style={styles.profileLabel}>Organization Name</Text>
            <Text style={styles.profileValue}>Shudhvayu</Text>
          </View>
          <View style={styles.profileRow}>
            <Text style={styles.profileLabel}>Email</Text>
            {/* Use dynamic data */}
            <Text style={styles.profileValue}>
              {currentUser?.email || 'partner@shudhvayu.app'}
            </Text>
          </View>
          <View style={[styles.profileRow, styles.profileRowLast]}>
            <Text style={styles.profileLabel}>Password</Text>
            <Text style={styles.profileValue}>••••••••</Text>
          </View>
        </View>
      </View>

      {/* Logout button uses the function from context */}
      <TouchableOpacity style={styles.logoutButton} onPress={logout}>
        <Icon name="logout" size={20} color="#f87171" />
        <Text style={styles.logoutButtonText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
};

// Styles copied from App.tsx
const styles = StyleSheet.create({
  profileContainer: {
    padding: 16,
  },
  profileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  profileTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  editButton: {
    padding: 8,
    backgroundColor: '#27272a',
    borderWidth: 1,
    borderColor: '#3f3f46',
    borderRadius: 8,
  },
  profileCard: {
    backgroundColor: '#27272a',
    borderWidth: 1,
    borderColor: '#3f3f46',
    borderRadius: 8,
    padding: 24,
    marginBottom: 24,
  },
  profileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f97316',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
  },
  profileSubtitle: {
    fontSize: 14,
    color: '#a1a1aa',
    marginTop: 4,
  },
  profileDetails: {
    gap: 0,
  },
  profileRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#3f3f46',
  },
  profileRowLast: {
    borderBottomWidth: 0,
  },
  profileLabel: {
    fontSize: 14,
    color: '#a1a1aa',
  },
  profileValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#fff',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 8,
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#f87171',
    marginLeft: 12,
  },
});