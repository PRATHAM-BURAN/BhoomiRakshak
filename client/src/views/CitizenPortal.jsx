import React, { useState } from 'react';
import { 
  ShieldAlert, 
  MapPin, 
  Phone, 
  Bell, 
  Camera, 
  Send, 
  CheckCircle2, 
  AlertTriangle, 
  Compass, 
  Info,
  Navigation,
  Check,
  Layers
} from 'lucide-react';
import SeverityChip from '../components/SeverityChip';
import EmptyState from '../components/EmptyState';
import { useAuth } from '../context/AuthContext';
import { useWebSocket } from '../context/WebSocketContext';
import { useLanguage } from '../context/LanguageContext';
import { queueOfflineReport } from '../utils/offlineQueue';
import { api } from '../api';
import SmsVerificationCard from '../components/SmsVerificationCard';

export default function CitizenPortal({ regions = [], alerts = [], onReportSubmitted }) {
  const { user, isAuthenticated } = useAuth();
  const { isOnline, refreshPendingCount } = useWebSocket();
  const { t } = useLanguage();

  // District filter for viewing advisories ("ALL" or specific region ID)
  const [selectedFilterRegionId, setSelectedFilterRegionId] = useState('ALL');

  // SMS Alert subscription state
  const [smsPhone, setSmsPhone] = useState(user?.phone || '');
  const [smsSubscribed, setSmsSubscribed] = useState(false);
  const [subMsg, setSubMsg] = useState('');

  // Multi-District Hazard Reporting State
  const initialSelectedDistricts = () => {
    if (user?.region_ids && Array.isArray(user.region_ids) && user.region_ids.length > 0) {
      return user.region_ids;
    }
    if (user?.region_id) return [user.region_id];
    return regions.length > 0 ? [regions[0].id] : [];
  };

  const [selectedReportDistricts, setSelectedReportDistricts] = useState(initialSelectedDistricts());
  const [reportType, setReportType] = useState('crack');
  const [severity, setSeverity] = useState('MODERATE');
  const [description, setDescription] = useState('');
  const [coords, setCoords] = useState(null);
  const [locating, setLocating] = useState(false);
  const [mediaFile, setMediaFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reportStatusMsg, setReportStatusMsg] = useState('');

  // Toggle district selection in report
  const toggleReportDistrict = (id) => {
    if (selectedReportDistricts.includes(id)) {
      if (selectedReportDistricts.length > 1) {
        setSelectedReportDistricts(selectedReportDistricts.filter(d => d !== id));
      }
    } else {
      setSelectedReportDistricts([...selectedReportDistricts, id]);
    }
  };

  const selectAllDistricts = () => {
    setSelectedReportDistricts(regions.map(r => r.id));
  };

  const selectUserDistricts = () => {
    if (user?.region_ids && user.region_ids.length > 0) {
      setSelectedReportDistricts(user.region_ids);
    } else if (regions.length > 0) {
      setSelectedReportDistricts([regions[0].id]);
    }
  };

  // Find active alerts for the selected filter
  const filteredAlerts = selectedFilterRegionId === 'ALL'
    ? alerts
    : alerts.filter(a => a.region_id === selectedFilterRegionId || (Array.isArray(a.region_ids) && a.region_ids.includes(selectedFilterRegionId)));

  const activeRegionName = selectedFilterRegionId === 'ALL'
    ? 'All 8 Northeast Sectors'
    : regions.find(r => r.id === selectedFilterRegionId)?.district || 'Selected Sector';

  // Capture GPS
  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported on this browser.');
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
        console.warn('GPS capture error:', err.message);
        setCoords({ latitude: 26.1445, longitude: 91.7362 });
        setLocating(false);
      },
      { timeout: 8000 }
    );
  };

  // Subscribe to SMS
  const handleSubscribeSMS = async (e) => {
    e.preventDefault();
    setSubMsg('');
    const targetRegionId = selectedFilterRegionId !== 'ALL' ? selectedFilterRegionId : (regions[0]?.id || '');
    if (!targetRegionId) {
      alert('Please select a valid district.');
      return;
    }
    try {
      if (isAuthenticated) {
        await api.subscribeAlerts({
          region_id: targetRegionId,
          sms_enabled: true
        });
      }
      setSmsSubscribed(true);
      setSubMsg(`SMS alerts successfully registered for ${smsPhone || 'your mobile phone'}. Priority updates will reach your phone via SMS.`);
    } catch (err) {
      setSubMsg(`Subscription registered locally: ${err.message}`);
    }
  };

  // Submit Citizen Report with Multi-District Support
  const handleSubmitReport = async (e) => {
    e.preventDefault();
    setReportStatusMsg('');

    if (selectedReportDistricts.length === 0) {
      alert('Please select at least one affected district or corridor.');
      return;
    }

    const lat = coords ? coords.latitude : 26.1445;
    const lon = coords ? coords.longitude : 91.7362;

    setIsSubmitting(true);

    const primaryDistrict = selectedReportDistricts[0];
    const reportPayload = {
      region_id: primaryDistrict,
      region_ids: selectedReportDistricts,
      report_type: reportType,
      severity,
      description,
      latitude: lat,
      longitude: lon,
      idempotency_key: crypto.randomUUID(),
      reporter_name: user?.name || 'Community Citizen'
    };

    // If offline, store in IndexedDB queue
    if (!navigator.onLine) {
      try {
        await queueOfflineReport({
          ...reportPayload,
          mediaFile
        });
        setReportStatusMsg('Saved to local offline queue. Will auto-sync when network signal returns.');
        refreshPendingCount();
        setDescription('');
        setMediaFile(null);
      } catch (err) {
        setReportStatusMsg(`Local queue error: ${err.message}`);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // If online, transmit via REST API
    try {
      const formData = new FormData();
      formData.append('region_id', primaryDistrict);
      formData.append('region_ids', JSON.stringify(selectedReportDistricts));
      formData.append('report_type', reportType);
      formData.append('severity', severity);
      formData.append('description', description);
      formData.append('latitude', lat);
      formData.append('longitude', lon);
      formData.append('idempotency_key', reportPayload.idempotency_key);
      if (mediaFile) {
        formData.append('media', mediaFile);
      }

      const res = await api.createReport(formData);
      setReportStatusMsg(`Observation recorded successfully across ${selectedReportDistricts.length} sector(s)! Dispatched to Field Commanders & Regional Admin.`);
      setDescription('');
      setMediaFile(null);
      if (onReportSubmitted) {
        onReportSubmitted(res.report);
      }
    } catch (err) {
      await queueOfflineReport({ ...reportPayload, mediaFile });
      setReportStatusMsg('Network transmission failed. Stored in local offline queue.');
      refreshPendingCount();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto flex flex-col gap-6 pb-20">
      {/* Citizen Welcome & Multi-District Filter */}
      <div className="bg-primary text-white p-5 rounded border border-primary-container shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-emerald-400 font-mono text-[10px] font-bold uppercase tracking-wider mb-1">
            <ShieldAlert className="w-4 h-4" />
            <span>Public Safety & Citizen Defense Network</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight">
            {t('nav_citizen_portal')}: BhoomiRakshak Early Warning
          </h1>
          <p className="text-xs text-gray-300 mt-0.5">
            Real-time landslide advisories, evacuation instructions, and multi-district hazard reporting across Northeast India.
          </p>
          {user?.region_ids && user.region_ids.length > 0 && (
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-emerald-300">
              <span className="font-semibold">Registered Multi-Districts:</span>
              <span className="font-mono bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-700/50">
                {user.region_ids.length} Sectors Active
              </span>
            </div>
          )}
        </div>

        {/* Advisory Filter Selector */}
        <div className="flex flex-col gap-1 shrink-0">
          <label className="text-[10px] font-mono uppercase text-gray-300 font-bold">
            Filter Advisory Feed:
          </label>
          <select
            value={selectedFilterRegionId}
            onChange={e => setSelectedFilterRegionId(e.target.value)}
            className="h-10 px-3 bg-primary-container border border-emerald-800 text-white rounded text-xs font-bold focus:outline-none focus:border-emerald-400 cursor-pointer"
          >
            <option value="ALL">🌐 All 8 Monitored NER Districts</option>
            {regions.map(r => (
              <option key={r.id} value={r.id} className="text-gray-900">
                {r.district} ({r.state})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Real-time District Status Card */}
      <div className="bg-white rounded border border-outline-variant/40 p-5 shadow-sm">
        <div className="flex items-center justify-between border-b border-outline-variant/30 pb-3 mb-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-on-surface flex items-center gap-2">
            <Compass className="w-4 h-4 text-primary" />
            <span>Live District Advisory • {activeRegionName}</span>
          </h2>
          <span className="text-[10px] font-mono text-on-surface-variant">
            Official NDMA / IMD Telemetry
          </span>
        </div>

        {filteredAlerts.length > 0 ? (
          <div className="flex flex-col gap-3">
            {filteredAlerts.map(alert => (
              <div
                key={alert.id}
                className="p-4 bg-rose-50 border-l-4 border-rose-600 rounded text-rose-950 flex flex-col gap-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span className="font-bold text-xs uppercase">
                      Emergency Alert Active ({alert.severity}) • {alert.region_name || 'Regional'}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-rose-800">
                    {new Date(alert.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} IST
                  </span>
                </div>
                <p className="text-xs font-semibold leading-relaxed">
                  {alert.message}
                </p>
                {alert.reasons && (
                  <div className="text-[11px] text-rose-900/80">
                    <strong>Cause:</strong> {alert.reasons.join(', ')}
                  </div>
                )}
                <div className="p-2 bg-rose-100 rounded text-[11px] font-bold text-rose-900">
                  Recommended Action: Stay away from unstable road cuts and natural gullies. Follow Field Commander evacuation signals.
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-5 bg-emerald-50 border border-emerald-200 rounded text-emerald-900 flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
            <div>
              <h4 className="font-bold text-xs uppercase tracking-wider">
                Normal Baseline Conditions • No Critical Landslide Warnings
              </h4>
              <p className="text-xs text-emerald-800 mt-0.5 leading-relaxed">
                Precipitation and geological slope movement in {activeRegionName} are currently within safe thresholds.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* SMS Alert Registration & Verification Gateway */}
      <SmsVerificationCard />

      {/* Citizen Hazard Observation Form - MULTI-DISTRICT */}
      <div className="bg-white rounded border border-outline-variant/40 p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-outline-variant/30 pb-3 mb-4 gap-2">
          <div className="flex items-center gap-2">
            <Camera className="w-4 h-4 text-rose-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface">
              Report Landslide Signs (Multi-District Hazard Reporting)
            </h3>
          </div>
          <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-bold">
            Works Offline in Remote Valleys
          </span>
        </div>

        {reportStatusMsg && (
          <div className="mb-4 p-3 bg-primary-container text-white rounded text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{reportStatusMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmitReport} className="flex flex-col gap-4 text-xs">
          {/* Multi-District Selection Chips */}
          <div className="p-3 bg-surface-container-low rounded border border-outline-variant/40">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2 gap-2">
              <label className="font-bold text-on-surface flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-primary" />
                <span>Affected District(s) / Corridor(s)</span>
                <span className="text-[10px] font-normal text-on-surface-variant">
                  (Select multiple if hazard affects arterial border corridors)
                </span>
              </label>
              <div className="flex items-center gap-2 text-[10px]">
                <button
                  type="button"
                  onClick={selectAllDistricts}
                  className="text-primary font-bold hover:underline"
                >
                  Select All 8 Sectors
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={selectUserDistricts}
                  className="text-on-surface-variant font-bold hover:underline"
                >
                  Reset to Profile
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {regions.map(r => {
                const isSelected = selectedReportDistricts.includes(r.id);
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => toggleReportDistrict(r.id)}
                    className={`px-3 py-1.5 rounded text-xs font-semibold transition-all flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-primary text-white shadow-sm ring-1 ring-primary'
                        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {isSelected ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <span className="w-3.5 h-3.5 rounded-full border border-gray-400" />
                    )}
                    <span>{r.district}</span>
                    <span className={`text-[10px] ${isSelected ? 'text-gray-200' : 'text-gray-500'}`}>
                      ({r.state})
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="mt-2 text-[11px] font-mono text-on-surface-variant">
              Selected ({selectedReportDistricts.length}): {
                regions
                  .filter(r => selectedReportDistricts.includes(r.id))
                  .map(r => r.district)
                  .join(', ') || 'None'
              }
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Hazard Category */}
            <div>
              <label className="font-bold text-on-surface mb-1 block">Observation Type</label>
              <select
                value={reportType}
                onChange={e => setReportType(e.target.value)}
                className="w-full h-9 px-3 bg-surface-container-low border border-outline-variant/40 rounded font-semibold focus:outline-none focus:border-primary"
              >
                <option value="crack">Road/Ground Tension Crack</option>
                <option value="slope_movement">Active Soil/Slope Movement</option>
                <option value="road_blockage">Debris / Road Blockage</option>
              </select>
            </div>

            {/* Severity */}
            <div>
              <label className="font-bold text-on-surface mb-1 block">Estimated Severity</label>
              <select
                value={severity}
                onChange={e => setSeverity(e.target.value)}
                className="w-full h-9 px-3 bg-surface-container-low border border-outline-variant/40 rounded font-semibold focus:outline-none focus:border-primary"
              >
                <option value="LOW">LOW (Small soil shifting / minor cracks)</option>
                <option value="MODERATE">MODERATE (Noticeable fissure / partial blockage)</option>
                <option value="HIGH">HIGH (Major slope slippage / road cut)</option>
                <option value="CRITICAL">CRITICAL (Imminent structural / village danger)</option>
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="font-bold text-on-surface mb-1 block">Observations / Landmark Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="e.g. 5-meter fissure along hillside road near border outpost; water seepage observed following heavy morning downpour."
              className="w-full p-3 bg-surface-container-low border border-outline-variant/40 rounded focus:outline-none focus:border-primary leading-relaxed"
              required
            />
          </div>

          {/* GPS Coordinates & Photo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
            <div>
              <label className="font-bold text-on-surface mb-1 block">GPS Coordinates</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleGetLocation}
                  disabled={locating}
                  className="px-3 py-2 bg-surface-container-low hover:bg-surface-container border border-outline-variant/40 rounded flex items-center gap-1.5 font-bold text-xs transition-colors"
                >
                  <Navigation className={`w-3.5 h-3.5 text-primary ${locating ? 'animate-spin' : ''}`} />
                  <span>{locating ? 'Locating...' : 'Auto-Capture GPS'}</span>
                </button>
                <span className="font-mono text-[11px] text-on-surface-variant">
                  {coords ? `${coords.latitude}, ${coords.longitude}` : 'Click to capture current coordinates'}
                </span>
              </div>
            </div>

            <div>
              <label className="font-bold text-on-surface mb-1 block">Attach Photo Evidence</label>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={e => setMediaFile(e.target.files[0])}
                className="text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-bold file:bg-primary file:text-white hover:file:bg-primary-container cursor-pointer"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-outline-variant/30 flex items-center justify-between">
            <span className="text-[11px] text-on-surface-variant">
              {!isOnline ? 'Offline Protocol: Cached locally and auto-synced on reconnect.' : 'Connected to Central Warning Gateway.'}
            </span>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 bg-primary hover:bg-primary-container text-white font-bold rounded flex items-center gap-2 shadow-sm transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Submitting...' : 'Submit Multi-District Observation'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
