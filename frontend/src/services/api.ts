import axios from 'axios';

/**
 * Global Axios HTTP client configured for Medivra backend REST APIs.
 *
 * Interceptors:
 * - Request: Attaches JWT Bearer token from localStorage to every outgoing API request.
 * - Response: Propagates backend errors or handles auth expiration.
 */
export const getBaseURL = () => {
  // If running inside native Capacitor on Android
  if (typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.()) {
    const envUrl = import.meta.env.VITE_API_URL;
    if (envUrl && !envUrl.includes('medivra.in')) {
      return envUrl.endsWith('/api') ? envUrl : `${envUrl.replace(/\/$/, '')}/api`;
    }
    return 'http://10.0.2.2:8080/api';
  }
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) {
    return envUrl.endsWith('/api') ? envUrl : `${envUrl.replace(/\/$/, '')}/api`;
  }
  return '/api';
};

export const getWsURL = () => {
  // If running inside native Capacitor on Android
  if (typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.()) {
    const envUrl = import.meta.env.VITE_API_URL;
    if (envUrl && !envUrl.includes('medivra.in')) {
      const origin = envUrl.replace(/\/api\/?$/, '').replace(/\/$/, '');
      return `${origin}/ws`;
    }
    return 'http://10.0.2.2:8080/ws';
  }
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) {
    const origin = envUrl.replace(/\/api\/?$/, '').replace(/\/$/, '');
    return `${origin}/ws`;
  }
  return '/ws';
};

const api = axios.create({
  baseURL: getBaseURL(),
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Gracefully handle 401 Unauthorized (session expired)
    if (error.response && error.response.status === 401) {
      const isAuthRoute = window.location.pathname.startsWith('/login') || window.location.pathname.startsWith('/signup');
      if (!isAuthRoute) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        // Let page refresh / route guard redirect to login
      }
    }
    return Promise.reject(error);
  }
);

export default api;
