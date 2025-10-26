// src/services/api.ts

// IMPORTANT: Update this URL based on where your backend is running
// For local development on physical device, use your computer's IP address
// For Android emulator, use 10.0.2.2
const API_BASE_URL = 'http://10.0.2.2:5000'; // Change 5000 to your PORT if different

// If testing on a physical device, use your computer's local IP:
// const API_BASE_URL = 'http://192.168.1.XXX:5000'; // Replace XXX with your IP

// For production:
// const API_BASE_URL = 'https://your-deployed-backend.com';

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
  async signup(data: SignupData): Promise<AuthResponse> {
    try {
      console.log('[API] Signup request to:', `${this.baseUrl}/api/v1/auth/signup`);
      
      const response = await fetch(`${this.baseUrl}/api/v1/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();
      console.log('[API] Signup response:', result);
      
      if (!response.ok) {
        throw new Error(result.message || result.error || 'Signup failed');
      }

      // Transform backend response to match our interface
      return {
        success: result.success,
        token: result.token,
        user: result.data ? {
          id: result.data._id || result.data.id,
          name: result.data.name,
          email: result.data.email,
        } : undefined,
        message: result.message,
      };
    } catch (error: any) {
      console.error('[API] Signup error:', error);
      throw new Error(error.message || 'Network error during signup');
    }
  }

  async login(data: LoginData): Promise<AuthResponse> {
    try {
      console.log('[API] Login request to:', `${this.baseUrl}/api/v1/auth/login`);
      
      const response = await fetch(`${this.baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();
      console.log('[API] Login response:', result);
      
      if (!response.ok) {
        throw new Error(result.message || result.error || 'Login failed');
      }

      // Transform backend response to match our interface
      return {
        success: result.success,
        token: result.token,
        user: result.data ? {
          id: result.data._id || result.data.id,
          name: result.data.name,
          email: result.data.email,
        } : undefined,
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