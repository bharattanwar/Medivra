import axios from 'axios';

/**
 * Global Axios HTTP client configured for Medivra backend REST APIs.
 *
 * Interceptors:
 * - Request: Attaches JWT Bearer token from localStorage to every outgoing API request.
 * - Response: Propagates backend errors or handles auth expiration.
 */
const api = axios.create({
  baseURL: '/api',
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
