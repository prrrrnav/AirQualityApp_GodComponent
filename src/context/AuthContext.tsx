// src/context/AuthContext.tsx
import React, { createContext, useContext, useState, ReactNode } from 'react';

// Define what your user object will look like
interface User {
  name: string;
  email: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  currentUser: User | null;
  login: (email: string, pass: string) => Promise<void>;
  signup: (name: string, email: string, pass: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>(null!);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  console.log('[AUTH] AuthProvider rendering'); // <-- ADD THIS
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const login = async (email: string, pass: string) => {
    // --- Simulate API call ---
    console.log('Logging in with', email);
    const user = { name: email.split('@')[0], email: email };
    setCurrentUser(user);
    setIsAuthenticated(true);
    // TODO: Save user to AsyncStorage
  };

  const signup = async (name: string, email: string, pass: string) => {
    // --- Simulate API call ---
    console.log('Signing up with', name, email);
    const user = { name: name, email: email };
    setCurrentUser(user);
    setIsAuthenticated(true);
    // TODO: Save user to AsyncStorage
  };
  
  const logout = () => {
    console.log('Logging out');
    setCurrentUser(null);
    setIsAuthenticated(false);
    // TODO: Clear user from AsyncStorage
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, currentUser, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);