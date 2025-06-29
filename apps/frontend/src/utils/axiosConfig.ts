// utils/axiosConfig.ts
import axios from 'axios';
import { getAuth } from 'firebase/auth';

// Create axios instance
const apiClient = axios.create({
  baseURL: '/api/v1',
  withCredentials: false, // Important for cookies
});

// Request interceptor to add Firebase token to headers
apiClient.interceptors.request.use(
  async config => {
    try {
      const auth = getAuth();
      const user = auth.currentUser;

      if (user) {
        // Get fresh token
        const token = await user.getIdToken();
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('Error getting Firebase token:', error);
    }

    return config;
  },
  error => {
    return Promise.reject(error);
  },
);

// Response interceptor to handle token expiration
apiClient.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const auth = getAuth();
        const user = auth.currentUser;

        if (user) {
          // Force refresh token
          const newToken = await user.getIdToken(true);
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return apiClient(originalRequest);
        }
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
        // Redirect to login or handle logout
        window.location.href = '/auth';
      }
    }

    return Promise.reject(error);
  },
);

export default apiClient;
