// src/services/api.ts

const API_BASE_URL = 'https://air.shudhvayu.com';

// TEST CONSTANT: Change this to a MAC ID that actually exists in your DB
const DEBUG_DEVICE_ID = '6943fa46f429c94f71aa8df4';

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

export interface HistoryQueryParams {
  deviceId: string;
  from?: string;
  to?: string;
  limit?: number;
}

class ApiService {
  private baseUrl: string;
  private authToken: string | null = null;
  private readonly DEFAULT_TIMEOUT = 10000; // 10 seconds

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  setToken(token: string | null) {
    this.authToken = token;
    console.log('[API] Token updated:', token ? 'Token set' : 'Token cleared');
  }

  getToken(): string | null {
    return this.authToken;
  }

  private async fetchWithTimeout(url: string, options: RequestInit, timeout: number = this.DEFAULT_TIMEOUT): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after ${timeout / 1000} seconds`);
      }
      throw error;
    }
  }

  async signup(data: SignupData): Promise<AuthResponse> {
    try {
      const response = await this.fetchWithTimeout(
        `${this.baseUrl}/api/v1/auth/signup`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        },
        15000
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || result.message || 'Signup failed');
      
      const userData = result.data || result.user || {};
      return {
        success: true,
        token: result.token,
        user: {
          id: userData._id || userData.id || 'unknown',
          name: userData.name || data.name,
          email: userData.email || data.email,
        },
        message: result.message,
      };
    } catch (error: any) {
      console.error('[API] Signup error:', error);
      throw error;
    }
  }

  async login(data: LoginData): Promise<AuthResponse> {
    try {
      const response = await this.fetchWithTimeout(
        `${this.baseUrl}/api/v1/auth/login`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        },
        15000
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || result.error || 'Login failed');

      const userData = result.data || result.user || {};
      return {
        success: true,
        token: result.token,
        user: {
          id: userData._id || userData.id || 'decoded-from-token',
          name: userData.name || data.email.split('@')[0],
          email: userData.email || data.email,
        },
        message: result.message,
      };
    } catch (error: any) {
      console.error('[API] Login error:', error);
      throw new Error(error.message || 'Network error during login');
    }
  }

  async registerDevice(macId: string, token?: string) {
    try {
      const authToken = token || this.authToken;
      if (!authToken) throw new Error('No authentication token available');

      const response = await this.fetchWithTimeout(
        `${this.baseUrl}/api/v1/data/devices`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
          },
          body: JSON.stringify({ macId }),
        }
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || result.error || 'Device registration failed');
      return result;
    } catch (error: any) {
      console.error('[API] Register device error:', error);
      throw new Error(error.message || 'Network error');
    }
  }

  /**
   * MODIFIED: Added Emulator/Debug Bypass for Device ID
   */
  async getHistory(params: HistoryQueryParams, token?: string) {
    try {
      const authToken = token || this.authToken;
      if (!authToken) throw new Error('No authentication token available');

      // 1. BYPASS LOGIC: If no deviceId is provided (emulator), use the DEBUG_DEVICE_ID
      const effectiveDeviceId = (params.deviceId && params.deviceId !== '') 
        ? params.deviceId 
        : DEBUG_DEVICE_ID;

      console.log(`[API] Fetching history for Device: ${effectiveDeviceId} ${!params.deviceId ? '(Using Emulator Fallback)' : ''}`);

      const queryParams = new URLSearchParams();
      queryParams.append('deviceId', effectiveDeviceId);
      
      if (params.from) queryParams.append('from', params.from);
      if (params.to) queryParams.append('to', params.to);
      if (params.limit) queryParams.append('limit', params.limit.toString());

      const url = `${this.baseUrl}/api/v1/data/history?${queryParams.toString()}`;
      console.log('[API] Request URL:', url);

      const response = await this.fetchWithTimeout(
        url,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
        },
        20000 
      );

      const result = await response.json();
      if (!response.ok) throw new Error(result.message || result.error || 'Failed to fetch history');

      return result.data || [];
    } catch (error: any) {
      console.error('[API] Get history error:', error);
      throw error;
    }
  }

  async ingestData(data: any) {
    try {
      const response = await this.fetchWithTimeout(
        `${this.baseUrl}/api/v1/data/ingest`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        }
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || result.error || 'Data ingestion failed');
      return result;
    } catch (error: any) {
      console.error('[API] Ingest data error:', error);
      throw new Error(error.message || 'Network error');
    }
  }
}

export const apiService = new ApiService(API_BASE_URL);