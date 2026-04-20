import axios from 'axios';
import * as Sentry from '@sentry/react';

/**
 * src/lib/api.js
 * Centralised axios instance.
 * All API calls go through here — never use fetch() directly.
 */

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000',
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request interceptor — attach Bearer token ─────────────────────────────────
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('vm_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (err) => Promise.reject(err),
);

// ── Response interceptor — unwrap + handle errors ────────────────────────────
api.interceptors.response.use(
  (response) => response.data,   // Unwrap: callers receive data directly
  (err) => {
    const status = err.response?.status;

    if (status === 401) {
      // Token expired or invalid — force logout
      localStorage.removeItem('vm_token');
      localStorage.removeItem('vm_user');
      window.dispatchEvent(new Event('auth:logout'));
    }

    if (status >= 500) {
      Sentry.captureException(err, {
        extra: {
          url:    err.config?.url,
          method: err.config?.method,
          status,
        },
      });
    }

    // Preserve the server error message for UI display
    const message = err.response?.data?.message
      || err.response?.data?.error
      || err.message
      || 'An unexpected error occurred';

    return Promise.reject(Object.assign(new Error(message), {
      status,
      code: err.response?.data?.code,
    }));
  },
);

export default api;
