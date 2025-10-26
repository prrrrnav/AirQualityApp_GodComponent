// src/screens/LoginScreen.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { Icon } from '../components/Icon';

type AuthMode = 'login' | 'signup' | 'forgot';

export const LoginScreen = () => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { login, signup } = useAuth();

  const validateEmail = (email: string) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  };

  const handleSubmit = async () => {
    // Validation
    if (!email || !email.trim()) {
      Alert.alert('Error', 'Please enter your email');
      return;
    }

    if (!validateEmail(email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    if (mode === 'forgot') {
      handleForgotPassword();
      return;
    }

    if (!password || password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    if (mode === 'signup') {
      if (!name || !name.trim()) {
        Alert.alert('Error', 'Please enter your name');
        return;
      }

      if (password !== confirmPassword) {
        Alert.alert('Error', 'Passwords do not match');
        return;
      }
    }

    try {
      setLoading(true);

      if (mode === 'login') {
        await login(email, password);
      } else if (mode === 'signup') {
        await signup(name, email, password);
      }
    } catch (error: any) {
      Alert.alert(
        mode === 'login' ? 'Login Failed' : 'Signup Failed',
        error.message || 'Please try again'
      );
      console.error('Auth error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    // TODO: Implement forgot password API call when backend endpoint is ready
    Alert.alert(
      'Password Reset',
      'A password reset link has been sent to your email (Feature coming soon)',
      [
        {
          text: 'OK',
          onPress: () => setMode('login'),
        },
      ]
    );
  };

  const resetForm = () => {
    setName('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
  };

  const switchMode = (newMode: AuthMode) => {
    resetForm();
    setMode(newMode);
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled">
          <View style={styles.authBox}>
            {/* Logo/Title */}
            <View style={styles.header}>
              <Icon name="wind" size={48} color="#3b82f6" />
              <Text style={styles.appTitle}>Shudhvayu</Text>
              <Text style={styles.appSubtitle}>Air Quality Monitor</Text>
            </View>

            {/* Tab Selector */}
            <View style={styles.tabContainer}>
              <TouchableOpacity
                style={[styles.tab, mode === 'login' && styles.tabActive]}
                onPress={() => switchMode('login')}
                disabled={loading}>
                <Text style={[styles.tabText, mode === 'login' && styles.tabTextActive]}>
                  Login
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, mode === 'signup' && styles.tabActive]}
                onPress={() => switchMode('signup')}
                disabled={loading}>
                <Text style={[styles.tabText, mode === 'signup' && styles.tabTextActive]}>
                  Sign Up
                </Text>
              </TouchableOpacity>
            </View>

            {/* Title */}
            <Text style={styles.authTitle}>
              {mode === 'login'
                ? 'Welcome Back'
                : mode === 'signup'
                ? 'Create Account'
                : 'Reset Password'}
            </Text>

            {/* Name Field (Signup only) */}
            {mode === 'signup' && (
              <View style={styles.inputContainer}>
                <Icon name="user" size={20} color="#71717a" />
                <TextInput
                  style={styles.authInput}
                  placeholder="Full Name"
                  placeholderTextColor="#71717a"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  editable={!loading}
                />
              </View>
            )}

            {/* Email Field */}
            <View style={styles.inputContainer}>
              <Icon name="info" size={20} color="#71717a" />
              <TextInput
                style={styles.authInput}
                placeholder="Email"
                placeholderTextColor="#71717a"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                editable={!loading}
                autoComplete="email"
              />
            </View>

            {/* Password Field */}
            {mode !== 'forgot' && (
              <View style={styles.inputContainer}>
                <Icon name="shield" size={20} color="#71717a" />
                <TextInput
                  style={styles.authInput}
                  placeholder="Password"
                  placeholderTextColor="#71717a"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  editable={!loading}
                  autoComplete="password"
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeIcon}>
                  <Text style={styles.eyeText}>{showPassword ? '👁️' : '👁️‍🗨️'}</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Confirm Password Field (Signup only) */}
            {mode === 'signup' && (
              <View style={styles.inputContainer}>
                <Icon name="shield" size={20} color="#71717a" />
                <TextInput
                  style={styles.authInput}
                  placeholder="Confirm Password"
                  placeholderTextColor="#71717a"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showPassword}
                  editable={!loading}
                />
              </View>
            )}

            {/* Forgot Password Link (Login only) */}
            {mode === 'login' && (
              <TouchableOpacity
                style={styles.forgotContainer}
                onPress={() => switchMode('forgot')}
                disabled={loading}>
                <Text style={styles.forgotText}>Forgot Password?</Text>
              </TouchableOpacity>
            )}

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.authButton, loading && styles.authButtonDisabled]}
              onPress={handleSubmit}
              disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#18181b" />
              ) : (
                <Text style={styles.authButtonText}>
                  {mode === 'login'
                    ? 'Sign In'
                    : mode === 'signup'
                    ? 'Create Account'
                    : 'Send Reset Link'}
                </Text>
              )}
            </TouchableOpacity>

            {/* Back to Login (Forgot Password only) */}
            {mode === 'forgot' && (
              <TouchableOpacity
                style={styles.backToLogin}
                onPress={() => switchMode('login')}
                disabled={loading}>
                <Text style={styles.backToLoginText}>← Back to Login</Text>
              </TouchableOpacity>
            )}

            {/* Footer Text */}
            {mode !== 'forgot' && (
              <View style={styles.footer}>
                <Text style={styles.footerText}>
                  {mode === 'login'
                    ? "Don't have an account? "
                    : 'Already have an account? '}
                </Text>
                <TouchableOpacity
                  onPress={() => switchMode(mode === 'login' ? 'signup' : 'login')}
                  disabled={loading}>
                  <Text style={styles.footerLink}>
                    {mode === 'login' ? 'Sign Up' : 'Login'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#18181b',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  authBox: {
    padding: 24,
    backgroundColor: '#27272a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3f3f46',
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  appTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 12,
  },
  appSubtitle: {
    fontSize: 14,
    color: '#a1a1aa',
    marginTop: 4,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#18181b',
    borderRadius: 8,
    padding: 4,
    marginBottom: 24,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 6,
  },
  tabActive: {
    backgroundColor: '#3b82f6',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#a1a1aa',
  },
  tabTextActive: {
    color: '#fff',
  },
  authTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#3f3f46',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  authInput: {
    flex: 1,
    padding: 12,
    color: '#fff',
    fontSize: 16,
  },
  eyeIcon: {
    padding: 8,
  },
  eyeText: {
    fontSize: 20,
  },
  forgotContainer: {
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  forgotText: {
    color: '#3b82f6',
    fontSize: 14,
    fontWeight: '500',
  },
  authButton: {
    backgroundColor: '#3b82f6',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  authButtonDisabled: {
    opacity: 0.6,
  },
  authButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  backToLogin: {
    alignItems: 'center',
    marginTop: 16,
  },
  backToLoginText: {
    color: '#3b82f6',
    fontSize: 14,
    fontWeight: '500',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  footerText: {
    color: '#a1a1aa',
    fontSize: 14,
  },
  footerLink: {
    color: '#3b82f6',
    fontSize: 14,
    fontWeight: '600',
  },
});