// BhoomiRakshak Offline Storage & Queue Service
// Utilizes browser IndexedDB to persist field and citizen reports in zero-connectivity terrain.
// Automatically reconciles and synchronizes with the backend once telemetry/network pings return.
import { BASE_URL } from '../api';


const DB_NAME = 'BhoomiRakshakOfflineDB';
const DB_VERSION = 1;
const STORE_NAME = 'reports_queue';

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'idempotency_key' });
        store.createIndex('created_at', 'created_at', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Save an observation report to the offline queue
export async function queueOfflineReport(reportData) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    const queuedItem = {
      ...reportData,
      idempotency_key: reportData.idempotency_key || crypto.randomUUID(),
      created_offline: true,
      client_created_at: new Date().toISOString()
    };

    const req = store.put(queuedItem);
    req.onsuccess = () => resolve(queuedItem);
    req.onerror = () => reject(req.error);
  });
}

// Get all pending reports in the offline queue
export async function getPendingOfflineReports() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

// Remove an item after successful sync
export async function removeSyncedReport(idempotency_key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(idempotency_key);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

// Synchronize all pending offline items to the server
export async function syncOfflineQueue(token) {
  const pending = await getPendingOfflineReports();
  if (pending.length === 0) return { synced: 0, failed: 0 };

  let syncedCount = 0;
  let failedCount = 0;

  for (const item of pending) {
    try {
      const formData = new FormData();
      formData.append('region_id', item.region_id);
      formData.append('report_type', item.report_type);
      formData.append('severity', item.severity);
      formData.append('description', item.description || '');
      formData.append('latitude', item.latitude);
      formData.append('longitude', item.longitude);
      formData.append('idempotency_key', item.idempotency_key);
      formData.append('created_offline', 'true');
      formData.append('client_created_at', item.client_created_at);

      if (item.mediaFile) {
        formData.append('media', item.mediaFile);
      } else if (item.media_url) {
        formData.append('media_url', item.media_url);
      }

      const headers = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(`${BASE_URL}/reports`, {
        method: 'POST',
        headers,
        body: formData
      });

      if (res.ok) {
        await removeSyncedReport(item.idempotency_key);
        syncedCount++;
      } else {
        failedCount++;
      }
    } catch (err) {
      console.warn('Network sync interrupted:', err.message);
      failedCount++;
    }
  }

  return { synced: syncedCount, failed: failedCount };
}
