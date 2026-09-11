import React, { useState } from 'react';
import { 
  Radio, 
  MapPin, 
  Camera, 
  Send, 
  WifiOff, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  Navigation, 
  FileText,
  Shield
} from 'lucide-react';
import SeverityChip from '../components/SeverityChip';
import { useAuth } from '../context/AuthContext';
import { useWebSocket } from '../context/WebSocketContext';
import { queueOfflineReport } from '../utils/offlineQueue';
import { compressImageToDataUrl } from '../utils/imageUtils';
import { api } from '../api';
import SmsVerificationCard from '../components/SmsVerificationCard';

export default function FieldOfficerApp({ regions = [], alerts = [], onReportSubmitted }) {
  const { user } = useAuth();
  const { isOnline, pendingSyncCount, triggerSync, refreshPendingCount } = useWebSocket();

  // Officer assigned region
  const assignedRegion = regions.find(r => r.id === user?.region_id) || regions[0] || null;

  // Filter alerts relevant to this field commander's sector
  const officerAlerts = alerts.filter(a => 
    !assignedRegion || 
    a.region_id === assignedRegion.id || 
    (Array.isArray(a.region_ids) && a.region_ids.includes(assignedRegion.id)) ||
    a.severity === 'CRITICAL' ||
    a.severity === 'HIGH'
  );

  // Form state
  const [reportType, setReportType] = useState('slope_movement');
  const [severity, setSeverity] = useState('HIGH');
  const [description, setDescription] = useState('');
  const [coords, setCoords] = useState(null);
  const [locating, setLocating] = useState(false);
  const [mediaFile, setMediaFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState('');

  const handleCaptureGPS = () => {
    if (!navigator.geolocation) {
      alert('GPS is not supported by your device browser.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          latitude: Number(pos.coords.latitude.toFixed(5)),
          longitude: Number(pos.coords.longitude.toFixed(5))
        });
        setLocating(false);
      },
      (err) => {
        console.warn('GPS error:', err);
        setCoords({ latitude: 25.5788, longitude: 91.8933 }); // Fallback to Shillong/NER
        setLocating(false);
      },
      { timeout: 7000 }
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatusFeedback('');

    if (!assignedRegion) {
      alert('No monitored region assigned to your profile.');
      return;
    }

    const lat = coords ? coords.latitude : 25.5788;
    const lon = coords ? coords.longitude : 91.8933;

    setSubmitting(true);

    // Compress image client-side to self-contained Base64 Data URL
    let mediaDataUrl = null;
    if (mediaFile) {
      try {
        mediaDataUrl = await compressImageToDataUrl(mediaFile);
      } catch (cErr) {
        console.warn('[IMAGE COMPRESSION FAILED, PROCEEDING]:', cErr.message);
      }
    }

    const reportData = {
      region_id: assignedRegion.id,
      report_type: reportType,
      severity,
      description,
      latitude: lat,
      longitude: lon,
      idempotency_key: crypto.randomUUID(),
      reporter_name: user ? user.name : 'Field Officer',
      media_data_url: mediaDataUrl
    };

    // If offline, save into IndexedDB queue
    if (!navigator.onLine) {
      try {
        await queueOfflineReport({ ...reportData, mediaFile, media_data_url: mediaDataUrl });
        setStatusFeedback('Offline Mode: Report stored securely in local IndexedDB queue.');
        refreshPendingCount();
        setDescription('');
        setMediaFile(null);
      } catch (err) {
        setStatusFeedback(`Offline store error: ${err.message}`);
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // Online submission via REST API
    try {
      const formData = new FormData();
      formData.append('region_id', assignedRegion.id);
      formData.append('report_type', reportType);
      formData.append('severity', severity);
      formData.append('description', description);
      formData.append('latitude', lat);
      formData.append('longitude', lon);
      formData.append('idempotency_key', reportData.idempotency_key);
      if (mediaDataUrl) {
        formData.append('media_data_url', mediaDataUrl);
      }
      if (mediaFile) {
        formData.append('media', mediaFile);
      }

      const res = await api.createReport(formData);
      setStatusFeedback('Report verified and synchronized to the Central Disaster Command Desk.');
      setDescription('');
      setMediaFile(null);
      if (onReportSubmitted) {
        onReportSubmitted(res.report);
      }
    } catch (err) {
      // Fallback to offline queue on network hiccup
      await queueOfflineReport({ ...reportData, mediaFile, media_data_url: mediaDataUrl });
      setStatusFeedback('Transmission interrupted. Queued in IndexedDB for auto-sync.');
      refreshPendingCount();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto flex flex-col gap-5 pb-20">
      {/* Officer Header Card */}
      <div className="bg-primary text-white p-4 rounded border border-primary-container shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded bg-primary-container flex items-center justify-center text-emerald-400">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase tracking-wider">
              Tactical Field Console • {user?.name || 'Field Officer'}
            </span>
            <h1 className="text-base font-bold text-white tracking-tight">
              Assigned District: {assignedRegion ? `${assignedRegion.district}, ${assignedRegion.state}` : 'Pending Assignment'}
            </h1>
          </div>
        </div>

        <div className="flex flex-col items-end">
          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded flex items-center gap-1 ${
            isOnline ? 'bg-emerald-900 text-emerald-300' : 'bg-amber-900 text-amber-200'
          }`}>
            {!isOnline && <WifiOff className="w-3 h-3" />}
            <span>{isOnline ? 'ONLINE' : 'OFFLINE'}</span>
          </span>
          {pendingSyncCount > 0 && (
            <button
              onClick={triggerSync}
              className="mt-1 text-[10px] font-mono text-emerald-300 underline flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span>Sync {pendingSyncCount} queued</span>
            </button>
          )}
        </div>
      </div>

      {/* Active Sector Hazard Alerts (Live Real-Time Stream) */}
      <div className="bg-white rounded border border-outline-variant/40 p-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-outline-variant/30 pb-2.5 mb-3">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-rose-600 animate-pulse" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-on-surface">
              Sector Emergency Broadcasts ({officerAlerts.length})
            </h2>
          </div>
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-surface-container text-on-surface-variant">
            Live Stream
          </span>
        </div>

        {officerAlerts.length === 0 ? (
          <div className="p-3 text-center text-xs text-on-surface-variant bg-surface-container-low rounded border border-outline-variant/20 italic">
            No active emergency alerts for this operational sector.
          </div>
        ) : (
          <div className="flex flex-col gap-2.5 max-h-56 overflow-y-auto">
            {officerAlerts.map(alert => (
              <div
                key={alert.id}
                className="p-3 bg-rose-50/70 border border-rose-200 rounded flex flex-col gap-1.5"
              >
                <div className="flex items-center justify-between">
                  <SeverityChip severity={alert.severity} />
                  <span className="text-[10px] font-mono text-on-surface-variant">
                    {new Date(alert.created_at).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-xs font-bold text-rose-950 leading-snug">
                  {alert.message}
                </p>
                {alert.action_recommendation && (
                  <div className="text-[11px] font-semibold text-rose-800 flex items-center gap-1 mt-0.5">
                    <span className="font-bold">Protocol:</span>
                    <span>{alert.action_recommendation}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Officer Emergency SMS Registration & Verification Gateway */}
      <SmsVerificationCard />

      {/* Field Report Submission Form */}
      <div className="bg-white rounded border border-outline-variant/40 p-5 shadow-sm">
        <div className="border-b border-outline-variant/30 pb-3 mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-on-surface">
              Log Tactical Field Observation
            </h2>
          </div>
          <span className="text-[10px] font-mono text-on-surface-variant">
            Zero-Data Resilient
          </span>
        </div>

        {statusFeedback && (
          <div className="mb-4 p-3 bg-primary-container text-white rounded text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{statusFeedback}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-xs">
          {/* Observation Classification */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-on-surface mb-1 block">Anomaly Type</label>
              <select
                value={reportType}
                onChange={e => setReportType(e.target.value)}
                className="w-full h-9 px-3 bg-surface-container-low border border-outline-variant/40 rounded font-semibold focus:outline-none focus:border-primary"
              >
                <option value="crack">Tension Fissure / Crack</option>
                <option value="slope_movement">Slope Deformation / Slide</option>
                <option value="road_blockage">Highway Arterial Blockage</option>
              </select>
            </div>

            <div>
              <label className="font-bold text-on-surface mb-1 block">Threat Severity</label>
              <select
                value={severity}
                onChange={e => setSeverity(e.target.value)}
                className="w-full h-9 px-3 bg-surface-container-low border border-outline-variant/40 rounded font-semibold focus:outline-none focus:border-primary"
              >
                <option value="LOW">LOW - Surface Saturation</option>
                <option value="MODERATE">MODERATE - Noticeable Creep</option>
                <option value="HIGH">HIGH - Slope Failure Imminent</option>
                <option value="CRITICAL">CRITICAL - Catastrophic / Road Severed</option>
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="font-bold text-on-surface mb-1 block">Technical Assessment / Remarks</label>
            <textarea
              rows={3}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="e.g. Scarp displacement measuring ~15cm along downhill flank. Groundwater discharge increasing."
              className="w-full p-3 bg-surface-container-low border border-outline-variant/40 rounded focus:outline-none focus:border-primary leading-relaxed"
              required
            />
          </div>

          {/* GPS Coordinates & Photo Capture */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center p-3 bg-surface-container-low rounded border border-outline-variant/30">
            <div>
              <label className="font-bold text-on-surface mb-1 block">Geo-Tagged Coordinates</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCaptureGPS}
                  disabled={locating}
                  className="px-3 py-1.5 bg-primary text-white rounded text-xs font-bold flex items-center gap-1.5 transition-colors"
                >
                  <Navigation className={`w-3.5 h-3.5 ${locating ? 'animate-spin' : ''}`} />
                  <span>{locating ? 'Capturing...' : 'Capture GPS'}</span>
                </button>
                <span className="font-mono text-[11px] text-on-surface-variant font-bold">
                  {coords ? `${coords.latitude}, ${coords.longitude}` : 'Awaiting GPS'}
                </span>
              </div>
            </div>

            <div>
              <label className="font-bold text-on-surface mb-1 block">Field Camera Evidence</label>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={e => setMediaFile(e.target.files[0])}
                className="text-xs file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-xs file:font-bold file:bg-primary file:text-white cursor-pointer"
              />
            </div>
          </div>

          {/* Submit */}
          <div className="pt-2 flex items-center justify-between border-t border-outline-variant/30">
            <span className="text-[11px] text-on-surface-variant font-mono">
              Idempotency Protected • Auto-Replay
            </span>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2 bg-secondary hover:bg-secondary/90 text-white font-bold rounded flex items-center gap-1.5 shadow-sm transition-colors text-xs"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{submitting ? 'Transmitting...' : 'Transmit Field Report'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
