// BhoomiRakshak Centralized API Client

const BASE_URL = '/api';

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

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers
  });

  const contentType = response.headers.get('content-type');
  const isJson = contentType && contentType.includes('application/json');
  const data = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const errorMsg = data && data.error ? data.error : `HTTP ${response.status}: ${response.statusText}`;
    throw new Error(errorMsg);
  }

  return data;
}

export const api = {
  // Auth
  login: (identifier, password) => apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier, password })
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
  createReport: (formData) => apiRequest('/reports', {
    method: 'POST',
    body: formData
  }),
  updateReportStatus: (id, status, review_notes) => apiRequest(`/reports/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, review_notes })
  }),

  // OTP & Notification Preferences
  sendOtp: (phone) => apiRequest('/auth/send-otp', {
    method: 'POST',
    body: JSON.stringify({ phone })
  }),
  verifyOtp: (phone, otp) => apiRequest('/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ phone, otp })
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
  ingestPipelineData: () => apiRequest('/data-pipeline/ingest', { method: 'POST' }),
  trainMLModel: () => apiRequest('/data-pipeline/train-ml', { method: 'POST' }),
  // Database Live Explorer & Telemetry
  getDatabaseSummary: () => apiRequest('/database/summary'),
  getDatabaseTable: (tableName) => apiRequest(`/database/table/${tableName}`),
  resyncCommanders: () => apiRequest('/database/seed-commanders', { method: 'POST' })
};

