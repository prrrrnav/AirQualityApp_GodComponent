// src/screens/LoginScreen.tsx
import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  
  ActivityIndicator,
  Alert
} from 'react-native';
import { useAuth } from '../context/AuthContext';

export const LoginScreen = () => {
  console.log('[LOGIN] LoginScreen rendering');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }

    try {
      setLoading(true);
      await login(email, password);
    } catch (error) {
      Alert.alert('Login Failed', 'Please try again');
      console.error('Login error:', error);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <SafeAreaView style={styles.authContainer}>
      <View style={styles.authBox}>
        <Text style={styles.authTitle}>Welcome to Shudhvayu</Text>
        <TextInput
          style={styles.authInput}
          placeholder="Email"
          placeholderTextColor="#71717a"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          editable={!loading}
        />
        <TextInput
          style={styles.authInput}
          placeholder="Password"
          placeholderTextColor="#71717a"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          editable={!loading}
        />
        <TouchableOpacity 
          style={[styles.authButton, loading && styles.authButtonDisabled]} 
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#18181b" />
          ) : (
            <Text style={styles.authButtonText}>Sign In</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  authContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    padding: 20, 
    backgroundColor: '#18181b' 
  },
  authBox: { 
    padding: 20, 
    backgroundColor: '#27272a', 
    borderRadius: 8 
  },
  authTitle: { 
    fontSize: 24, 
    fontWeight: 'bold', 
    color: '#fff', 
    marginBottom: 20, 
    textAlign: 'center' 
  },
  authInput: { 
    backgroundColor: '#18181b', 
    borderWidth: 1, 
    borderColor: '#3f3f46', 
    borderRadius: 6, 
    padding: 12, 
    color: '#fff', 
    fontSize: 16, 
    marginBottom: 12 
  },
  authButton: { 
    backgroundColor: '#fff', 
    padding: 14, 
    borderRadius: 6, 
    alignItems: 'center' 
  },
  authButtonDisabled: {
    opacity: 0.6,
  },
  authButtonText: { 
    color: '#18181b', 
    fontSize: 16, 
    fontWeight: '500' 
  },
});