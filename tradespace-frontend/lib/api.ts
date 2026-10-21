import axios from 'axios';

const SERVER_ERROR_MESSAGE =
  'Sorry, something went wrong on our side. Please try again later or contact support.';
const UNAVAILABLE_MESSAGE =
  'Sorry, TradeSpace is unavailable right now. Please check your connection and try again later.';

const API = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api',
  timeout: 30000,
});

API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Never show raw errors to users
API.interceptors.response.use(
  (response) => response,
  (error) => {
    // No response at all: server down, no internet, timeout or CORS block
    if (!error.response) {
      error.response = { status: 0, data: { error: UNAVAILABLE_MESSAGE } };
      return Promise.reject(error);
    }

    // Server errors that did not come with our own friendly message (for example Railway's error page)
    const data = error.response.data;
    const hasMessage = data && typeof data === 'object' && typeof data.error === 'string';
    if (error.response.status >= 500 && !hasMessage) {
      error.response.data = { error: SERVER_ERROR_MESSAGE };
    }

    return Promise.reject(error);
  }
);

export const authAPI = {
  register: (data) => API.post('/auth/register', data),
  login: (data) => API.post('/auth/login', data),
  getMe: () => API.get('/auth/me'),
};

export default API;