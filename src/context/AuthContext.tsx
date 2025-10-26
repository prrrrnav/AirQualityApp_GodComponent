// src/context/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService } from '../services/api';

interface User {
  id: string;
  name: string;
  email: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  currentUser: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>(null!);

interface AuthProviderProps {
  children: ReactNode;
}

const TOKEN_KEY = '@shudhvayu_token';
const USER_KEY = '@shudhvayu_user';

// Toggle this to switch between mock and real API
const USE_MOCK_AUTH = false; // Set to false to use real backend

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Check for stored auth on app load
  useEffect(() => {
    checkStoredAuth();
  }, []);

  const checkStoredAuth = async () => {
    try {
      console.log('[Auth] Checking stored auth...');
      const storedToken = await AsyncStorage.getItem(TOKEN_KEY);
      const storedUser = await AsyncStorage.getItem(USER_KEY);

      if (storedToken && storedUser) {
        setToken(storedToken);
        setCurrentUser(JSON.parse(storedUser));
        setIsAuthenticated(true);
        console.log('[Auth] Restored session');
      } else {
        console.log('[Auth] No stored session found');
      }
    } catch (error) {
      console.error('[Auth] Error loading auth:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      if (USE_MOCK_AUTH) {
        // MOCK LOGIN
        console.log('[Auth] Mock login for:', email);
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const mockUser: User = {
          id: 'mock-user-' + Date.now(),
          name: email.split('@')[0],
          email: email,
        };
        
        const mockToken = 'mock-token-' + Date.now();
        
        await AsyncStorage.setItem(TOKEN_KEY, mockToken);
        await AsyncStorage.setItem(USER_KEY, JSON.stringify(mockUser));

        setToken(mockToken);
        setCurrentUser(mockUser);
        setIsAuthenticated(true);
        
        console.log('[Auth] Mock login successful');
      } else {
        // REAL API LOGIN
        console.log('[Auth] Real API login for:', email);
        const response = await apiService.login({ email, password });
        
        if (response.success && response.token && response.user) {
          // Store token and user
          await AsyncStorage.setItem(TOKEN_KEY, response.token);
          await AsyncStorage.setItem(USER_KEY, JSON.stringify(response.user));

          setToken(response.token);
          setCurrentUser(response.user);
          setIsAuthenticated(true);
          
          console.log('[Auth] Login successful');
        } else {
          throw new Error(response.message || 'Login failed');
        }
      }
    } catch (error: any) {
      console.error('[Auth] Login error:', error);
      throw error;
    }
  };

  const signup = async (name: string, email: string, password: string) => {
    try {
      if (USE_MOCK_AUTH) {
        // MOCK SIGNUP
        console.log('[Auth] Mock signup for:', email);
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const mockUser: User = {
          id: 'mock-user-' + Date.now(),
          name: name,
          email: email,
        };
        
        const mockToken = 'mock-token-' + Date.now();
        
        await AsyncStorage.setItem(TOKEN_KEY, mockToken);
        await AsyncStorage.setItem(USER_KEY, JSON.stringify(mockUser));

        setToken(mockToken);
        setCurrentUser(mockUser);
        setIsAuthenticated(true);
        
        console.log('[Auth] Mock signup successful');
      } else {
        // REAL API SIGNUP
        console.log('[Auth] Real API signup for:', email);
        const response = await apiService.signup({ name, email, password });
        
        if (response.success && response.token && response.user) {
          // Store token and user
          await AsyncStorage.setItem(TOKEN_KEY, response.token);
          await AsyncStorage.setItem(USER_KEY, JSON.stringify(response.user));

          setToken(response.token);
          setCurrentUser(response.user);
          setIsAuthenticated(true);
          
          console.log('[Auth] Signup successful');
        } else {
          throw new Error(response.message || 'Signup failed');
        }
      }
    } catch (error: any) {
      console.error('[Auth] Signup error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      console.log('[Auth] Logging out');
      await AsyncStorage.removeItem(TOKEN_KEY);
      await AsyncStorage.removeItem(USER_KEY);

      setToken(null);
      setCurrentUser(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error('[Auth] Error logging out:', error);
    }
  };

  return (
    <AuthContext.Provider 
      value={{ 
        isAuthenticated, 
        currentUser, 
        token, 
        loading, 
        login, 
        signup, 
        logout 
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);