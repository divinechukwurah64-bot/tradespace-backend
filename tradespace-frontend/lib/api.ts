import axios from 'axios';

const SERVER_ERROR_MESSAGE =
  'Sorry, something went wrong on our side. Please try again later or contact support.';
const UNAVAILABLE_MESSAGE =
  'Sorry, TradeSpace is unavailable right now. Please check your connection and try again later.';

// A 401 on these is a normal answer (wrong password, bad reset link), not an expired session
const NO_AUTO_LOGOUT_PATHS = [
  '/auth/login',
  '/auth/register',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/admin/me',
];

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

// Clears the saved login and sends the person to the login page
const forceLogout = () => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  if (!window.location.pathname.startsWith('/login')) {
    window.location.href = '/login?expired=1';
  }
};

// Never show raw errors to users
API.interceptors.response.use(
  (response) => response,
  (error) => {
    // No response at all: server down, no internet, timeout or CORS block
    if (!error.response) {
      error.response = { status: 0, data: { error: UNAVAILABLE_MESSAGE } };
      return Promise.reject(error);
    }

    // Expired token, or the password was changed on another device.
    // Only when this request carried a token, so guests are never redirected.
    if (error.response.status === 401) {
      const url = String((error.config && error.config.url) || '');
      const hadToken = !!(error.config && error.config.headers && error.config.headers.Authorization);
      const skip = NO_AUTO_LOGOUT_PATHS.some((path) => url.includes(path));
      if (hadToken && !skip) {
        forceLogout();
      }
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
  // The server never reveals admin status to normal pages. Only the admin page asks
  // the admin-only check below, and anyone who is not an admin is refused.
  getMe: async () => {
    const response = await API.get('/auth/me');
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')) {
      try {
        const adminCheck = await API.get('/admin/me');
        response.data = { ...response.data, role: adminCheck.data.role };
      } catch (err) {
        // not an admin, so no role is added
      }
    }
    return response;
  },
};

export default API;