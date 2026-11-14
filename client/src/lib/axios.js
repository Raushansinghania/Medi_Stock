import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor
api.interceptors.request.use(
  (config) => {
    // If a token is stored in localStorage as fallback, attach it
    const token = localStorage.getItem('medistock_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor
api.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error) => {
    const errorResponse = error.response?.data || {
      success: false,
      message: error.message || 'An unexpected network error occurred.',
    };

    if (error.response?.status === 401) {
      // Unauthorized: could dispatch logout or clear local session
      localStorage.removeItem('medistock_token');
      localStorage.removeItem('medistock_user');
    }

    return Promise.reject(errorResponse);
  }
);

export default api;
