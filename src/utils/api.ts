import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

// Base URL strategy:
// - Prefer explicit VITE_API_URL everywhere.
// - Otherwise use the current origin if running in a browser.
// - Final fallback is the deployed production API URL.
const VITE_ENV: any = (import.meta as any).env || {};
const DEFAULT_API_URL = 'https://testing.careerredefine.com';
const API_URL: string =
  VITE_ENV?.VITE_API_URL
  || (typeof window !== 'undefined' && window.location?.origin)
  || DEFAULT_API_URL;

interface FailedRequest {
  resolve: (value: unknown) => void;
  reject: (reason?: any) => void;
}

let isRefreshing = false;
let failedQueue: FailedRequest[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
  // Prevent very long hangs; adjust as needed per environment
  timeout: 15000,
});

// Request interceptor to add auth token to requests
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle errors and token refresh
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Only handle 401 errors for API endpoints, not for auth endpoints
    if (error.response?.status === 401 && !originalRequest.url?.includes('/auth/')) {
      // If we've already tried to refresh, or this is a refresh token request, reject
      if (originalRequest._retry) {
        return Promise.reject(error);
      }

      // If we're already refreshing, add to queue
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      // Mark that we're refreshing the token
      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Get the new token
        const response = await axios.post(`${API_URL}/api/v1/auth/refresh-token`, {
          token: localStorage.getItem('token') || undefined
        }, {
          withCredentials: true,
          headers: {
            'Content-Type': 'application/json',
          },
        });

        // Support both { token, data: { user } } and { data: { token, user } }
        const newToken = (response.data as any)?.data?.token ?? (response.data as any)?.token;
        
        // Update token in localStorage and axios defaults
        localStorage.setItem('token', newToken);
        api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
        
        // Process queued requests
        processQueue(null, newToken);
        
        // Retry the original request
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // If refresh fails, do NOT auto-logout or redirect. Let callers handle it.
        processQueue(refreshError, null);
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
