// src/services/api.ts

const API_BASE_URL = 'http://air.shudhvayu.com'; // Your VPS

export interface SignupData {
  name: string;
  email: string;
  password: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  token?: string;
  user?: {
    id: string;
    name: string;
    email: string;
  };
  message?: string;
  data?: any;
}

class ApiService {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  // Authentication endpoints
  // src/services/api.ts - Update the signup function

  async signup(data: SignupData): Promise<AuthResponse> {
    try {
      console.log('[API] Signup request to:', `${this.baseUrl}/api/v1/auth/signup`);
      console.log('[API] Signup data:', { ...data, password: '***' });

      const response = await fetch(`${this.baseUrl}/api/v1/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();
      console.log('[API] Signup response:', JSON.stringify(result, null, 2));

      if (!response.ok) {
        // Extract error message from backend
        const errorMessage = result.error || result.message || 'Signup failed';
        throw new Error(errorMessage);
      }

      // Check if we have a token
      if (!result.token) {
        throw new Error('No token received from server');
      }

      // Parse the response
      const userData = result.data || result.user || {};

      const user = {
        id: userData._id || userData.id || 'unknown',
        name: userData.name || data.name,
        email: userData.email || data.email,
      };

      console.log('[API] Parsed user:', user);

      return {
        success: result.success || response.ok,
        token: result.token,
        user: user,
        message: result.message,
      };
    } catch (error: any) {
      console.error('[API] Signup error:', error);
      throw error; // Re-throw the error so LoginScreen can handle it
    }
  }

  async login(data: LoginData): Promise<AuthResponse> {
    try {
      console.log('[API] Login request to:', `${this.baseUrl}/api/v1/auth/login`);
      console.log('[API] Login data:', { email: data.email, password: '***' });

      const response = await fetch(`${this.baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();
      console.log('[API] Login response:', JSON.stringify(result, null, 2));

      if (!response.ok) {
        throw new Error(result.message || result.error || 'Login failed');
      }

      // Check if we have a token
      if (!result.token) {
        throw new Error('No token received from server');
      }

      // Parse the response - your backend might return user data differently
      // The user data could be in result.data, result.user, or directly in result
      const userData = result.data || result.user || {};

      // If no user data in response, decode from token or use email
      const user = {
        id: userData._id || userData.id || 'decoded-from-token',
        name: userData.name || data.email.split('@')[0],
        email: userData.email || data.email,
      };

      console.log('[API] Parsed user:', user);

      return {
        success: result.success || response.ok,
        token: result.token,
        user: user,
        message: result.message,
      };
    } catch (error: any) {
      console.error('[API] Login error:', error);
      throw new Error(error.message || 'Network error during login');
    }
  }

  // Data endpoints
  async registerDevice(macId: string, token: string) {
    try {
      console.log('[API] Register device request');

      const response = await fetch(`${this.baseUrl}/api/v1/data/devices`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ macId }),
      });

      const result = await response.json();
      console.log('[API] Register device response:', result);

      if (!response.ok) {
        throw new Error(result.message || result.error || 'Device registration failed');
      }

      return result;
    } catch (error: any) {
      console.error('[API] Register device error:', error);
      throw new Error(error.message || 'Network error');
    }
  }

  async getHistory(deviceId: string, token: string) {
    try {
      console.log('[API] Get history request for device:', deviceId);

      const response = await fetch(
        `${this.baseUrl}/api/v1/data/history?deviceId=${deviceId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      const result = await response.json();
      console.log('[API] Get history response:', result);

      if (!response.ok) {
        throw new Error(result.message || result.error || 'Failed to fetch history');
      }

      return result;
    } catch (error: any) {
      console.error('[API] Get history error:', error);
      throw new Error(error.message || 'Network error');
    }
  }

  async ingestData(data: any) {
    try {
      console.log('[API] Ingest data request');

      const response = await fetch(`${this.baseUrl}/api/v1/data/ingest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();
      console.log('[API] Ingest data response:', result);

      if (!response.ok) {
        throw new Error(result.message || result.error || 'Data ingestion failed');
      }

      return result;
    } catch (error: any) {
      console.error('[API] Ingest data error:', error);
      throw new Error(error.message || 'Network error');
    }
  }
}

export const apiService = new ApiService(API_BASE_URL);