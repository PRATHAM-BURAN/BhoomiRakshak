// BhoomiRakshak Centralized API Client

export const BASE_URL = import.meta.env.VITE_API_URL || '/api';


export function getAuthToken() {
  return localStorage.getItem('bhoomi_token');
}

export function setAuthToken(token) {
  if (token) {
    localStorage.setItem('bhoomi_token', token);
  } else {
    localStorage.removeItem('bhoomi_token');
  }
}

export async function apiRequest(endpoint, options = {}) {
  const token = getAuthToken();
  const headers = {
    ...(options.headers || {})
  };

  // If body is not FormData, default to JSON
  if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // AbortController timeout (default 15s) to guarantee network calls never hang indefinitely
  const controller = new AbortController();
  const timeoutMs = options.timeout || 15000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      signal: options.signal || controller.signal,
      headers
    });
    clearTimeout(timeoutId);

    const contentType = response.headers.get('content-type');
    const isJson = contentType && contentType.includes('application/json');
    const data = isJson ? await response.json() : await response.text();

    if (!response.ok) {
      let errorMsg = `HTTP ${response.status}: ${response.statusText}`;
      if (data && typeof data === 'object' && data.error) {
        errorMsg = data.error;
      } else if (typeof data === 'string' && !data.includes('<!DOCTYPE') && !data.includes('<html') && data.trim().length > 0) {
        errorMsg = data;
      }
      throw new Error(errorMsg);
    }

    if (typeof data === 'string' && (data.includes('<!DOCTYPE') || data.includes('<html'))) {
      throw new Error('Server returned HTML instead of API data. Please ensure the backend is running and reachable.');
    }

    return data;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs / 1000}s. Please check network connection.`);
    }
    throw err;
  }
}

export const api = {
  // Auth
  login: (identifier, password) => apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier, password })
  }),
  loginOtp: (phone, otp) => apiRequest('/auth/login-otp', {
    method: 'POST',
    body: JSON.stringify({ phone, otp })
  }),
  setupAdmin: (payload) => apiRequest('/auth/setup-admin', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),
  registerCitizen: (payload) => apiRequest('/auth/register-citizen', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),
  getMe: () => apiRequest('/auth/me'),
  getOfficers: () => apiRequest('/auth/officers'),
  createOfficer: (payload) => apiRequest('/auth/officers', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),
  toggleOfficerStatus: (id, is_active) => apiRequest(`/auth/officers/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ is_active })
  }),

  // Regions
  getRegions: () => apiRequest('/regions'),
  createRegion: (payload) => apiRequest('/regions', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),

  // Risk Zones
  getRiskZones: (params = '') => apiRequest(`/risk-zones${params ? '?' + params : ''}`),

  // Field Reports
  getReports: () => apiRequest('/reports'),
  createReport: (data) => {
    if (data instanceof FormData) {
      return apiRequest('/reports', {
        method: 'POST',
        body: data
      });
    }
    return apiRequest('/reports', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },
  updateReportStatus: (id, status, review_notes) => apiRequest(`/reports/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, review_notes })
  }),

  // OTP & Notification Preferences (Option A: Direct Mobile Registration)
  updatePhone: (phone) => apiRequest('/auth/update-phone', {
    method: 'PATCH',
    body: JSON.stringify({ phone })
  }),
  sendOtp: (phone) => apiRequest('/auth/send-otp', {
    method: 'POST',
    body: JSON.stringify({ phone })
  }),
  verifyOtp: (phone, otp) => apiRequest('/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ phone, otp: otp || '123456' })
  }),
  updateNotificationPreferences: (payload) => apiRequest('/auth/notification-preferences', {
    method: 'PATCH',
    body: JSON.stringify(payload)
  }),

  // Alerts
  getAlerts: () => apiRequest('/alerts'),
  broadcastAlert: (payload) => apiRequest('/alerts', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),
  deleteAlert: (alertId) => apiRequest(`/alerts?id=${encodeURIComponent(alertId)}`, {
    method: 'DELETE',
    body: JSON.stringify({ id: alertId })
  }),
  clearAllAlerts: () => apiRequest('/alerts', {
    method: 'DELETE'
  }),
  subscribeAlerts: (payload) => apiRequest('/alerts/subscribe', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),
  getSubscriptions: () => apiRequest('/alerts/subscriptions'),
  getSubscribersCount: () => apiRequest('/alerts/subscribers-count'),
  acknowledgeAlert: (alertId) => apiRequest(`/alerts/${alertId}/acknowledge`, {
    method: 'POST'
  }),
  getUnacknowledgedAlerts: (hours = 24) => apiRequest(`/alerts/unacknowledged?hours=${hours}`),

  // Weather Sync
  syncWeather: () => apiRequest('/weather/sync', { method: 'POST' }),
  getLatestWeather: () => apiRequest('/weather/latest'),

  // Analytics & Health
  getAnalytics: () => apiRequest('/analytics'),
  getStatus: () => apiRequest('/status'),

  // NASA & SRTM Ground Truth Data Pipeline
  getPipelineStatus: () => apiRequest('/data-pipeline/status'),
  getHistoricalLandslides: () => apiRequest('/data-pipeline/historical-landslides'),
  ingestPipelineData: () => apiRequest('/data-pipeline/ingest', { method: 'POST' }),
  trainMLModel: () => apiRequest('/data-pipeline/train-ml', { method: 'POST' }),
  // Database Live Explorer & Telemetry
  getDatabaseSummary: () => apiRequest('/database/summary'),
  getDatabaseTable: (tableName) => apiRequest(`/database/table/${tableName}`),
  resyncCommanders: () => apiRequest('/database/seed-commanders', { method: 'POST' })
};

