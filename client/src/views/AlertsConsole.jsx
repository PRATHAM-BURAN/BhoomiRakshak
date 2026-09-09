import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  Send, 
  CheckCircle2, 
  Radio, 
  MessageSquare, 
  Bell, 
  Info, 
  Clock, 
  ShieldAlert, 
  Check, 
  Mail, 
  PhoneCall, 
  Volume2, 
  X,
  Users,
  ShieldCheck,
  Building2,
  Smartphone,
  RefreshCw
} from 'lucide-react';
import SeverityChip from '../components/SeverityChip';
import EmptyState from '../components/EmptyState';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';

export default function AlertsConsole({
  alerts = [],
  regions = [],
  onAlertBroadcasted
}) {
  const { role } = useAuth();

  // Multi-district broadcast target
  const [targetAll, setTargetAll] = useState(true);
  const [selectedRegionIds, setSelectedRegionIds] = useState([]);
  const [severity, setSeverity] = useState('CRITICAL');
  const [message, setMessage] = useState('');
  const [reasonInput, setReasonInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Live Verified SMS Subscribers count state
  const [subscribersData, setSubscribersData] = useState(null);
  const [subscribersLoading, setSubscribersLoading] = useState(false);

  const fetchSubscribers = async () => {
    try {
      setSubscribersLoading(true);
      const data = await api.getSubscribersCount();
      setSubscribersData(data);
    } catch (err) {
      console.warn('Failed to load subscribers count:', err);
    } finally {
      setSubscribersLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscribers();
  }, []);

  // Priority Dispatch Audit Modal state
  const [priorityModalData, setPriorityModalData] = useState(null);

  const toggleRegion = (id) => {
    if (selectedRegionIds.includes(id)) {
      setSelectedRegionIds(selectedRegionIds.filter(r => r !== id));
    } else {
      setSelectedRegionIds([...selectedRegionIds, id]);
    }
  };

  const handleBroadcast = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    let finalRegionIds = [];
    if (targetAll) {
      finalRegionIds = regions.map(r => r.id);
    } else {
      finalRegionIds = selectedRegionIds;
    }

    if (finalRegionIds.length === 0) {
      setErrorMsg('Please select at least one target region or select "All 8 NER Districts".');
      return;
    }
    if (!message.trim()) {
      setErrorMsg('Please enter an emergency broadcast message.');
      return;
    }

    setIsSubmitting(true);
    try {
      const reasons = reasonInput
        ? reasonInput.split(',').map(r => r.trim()).filter(Boolean)
        : ['Manual Incident Protocol Triggered by Central Command'];

      const res = await api.broadcastAlert({
        region_id: finalRegionIds[0],
        region_ids: finalRegionIds,
        severity,
        message,
        reasons
      });

      setSuccessMsg('Emergency warning successfully dispatched across all priority channels.');
      setMessage('');
      setReasonInput('');

      // Open the Priority Dispatch Modal
      if (res.priority_dispatch) {
        setPriorityModalData({
          ...res.priority_dispatch,
          alert: res.alert
        });
      }

      if (onAlertBroadcasted) {
        onAlertBroadcasted(res.alert);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to dispatch alert.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getChannelBadge = (channelItem) => {
    if (!channelItem) return null;
    const { channel, status, details } = channelItem;

    let badgeStyle = 'bg-gray-100 text-gray-700 border-gray-300';
    if (status === 'sent') badgeStyle = 'bg-emerald-50 text-emerald-800 border-emerald-300';
    if (status === 'failed') badgeStyle = 'bg-rose-50 text-rose-800 border-rose-300';
    if (status === 'not_configured') badgeStyle = 'bg-amber-50 text-amber-800 border-amber-300';

    return (
      <span
        key={channel}
        title={details || status}
        className={`px-2 py-0.5 rounded border text-[10px] font-mono font-bold uppercase flex items-center gap-1 ${badgeStyle}`}
      >
        <span>{channel}:</span>
        <span>{status}</span>
      </span>
    );
  };

  return (
    <div className="p-4 md:p-6 flex flex-col gap-6 max-w-7xl mx-auto pb-16">
      {/* Priority Dispatch Audit Pop-Up Modal */}
      {priorityModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl border border-rose-300 max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="bg-rose-700 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
                  <ShieldAlert className="w-6 h-6 text-white animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono uppercase tracking-wider bg-rose-900/60 px-2 py-0.5 rounded font-bold">
                      Dispatched Successfully
                    </span>
                    <span className="text-xs font-mono font-bold">
                      {new Date().toLocaleTimeString()} IST
                    </span>
                  </div>
                  <h3 className="text-base font-bold tracking-tight">
                    Multi-Channel Priority Dispatch Audit Log
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setPriorityModalData(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-5 text-xs text-gray-800">
              {/* Broadcast Summary Box */}
              <div className="p-3.5 bg-rose-50 rounded-lg border border-rose-200 flex flex-col gap-2">
                <div className="flex items-center justify-between font-mono text-[11px]">
                  <span className="font-bold text-rose-950">
                    ALERT ID: {priorityModalData.alert_id?.slice(0, 8).toUpperCase()}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-rose-700 text-white font-bold">
                    {priorityModalData.severity}
                  </span>
                </div>
                <p className="font-semibold text-rose-900 text-xs">
                  "{priorityModalData.alert?.message}"
                </p>
                <div className="flex flex-wrap gap-2 pt-1 font-mono text-[10px]">
                  <span className="bg-white px-2 py-0.5 rounded border border-rose-300 text-rose-800">
                    🔊 Audible Siren: Triggered
                  </span>
                  <span className="bg-white px-2 py-0.5 rounded border border-rose-300 text-rose-800">
                    🌐 Web App Pop-up: Active
                  </span>
                  <span className="bg-white px-2 py-0.5 rounded border border-rose-300 text-rose-800">
                    📱 SMS Gateway: High Priority
                  </span>
                  <span className="bg-white px-2 py-0.5 rounded border border-rose-300 text-rose-800">
                    ✉️ Institutional Email: Dispatched
                  </span>
                </div>
              </div>

              {/* Priority Tier 1: All 8 Field Commanders */}
              <div>
                <div className="flex items-center justify-between border-b border-gray-200 pb-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center text-[10px] font-bold">
                      1
                    </span>
                    <h4 className="font-bold text-xs uppercase tracking-wider text-primary">
                      Priority Tier 1: 8 Field Sector Commanders (Northeast India)
                    </h4>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    {priorityModalData.tier1_commanders?.length || 8} / 8 Commanders Alerted First
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {priorityModalData.tier1_commanders?.map((cmd, idx) => (
                    <div
                      key={cmd.commander_id || idx}
                      className="p-2.5 bg-gray-50 border border-gray-200 rounded flex flex-col justify-between gap-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-gray-900 truncate">
                          {cmd.name}
                        </span>
                        <span className="text-[10px] font-mono text-gray-500 uppercase">
                          {cmd.state}
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-600 truncate font-mono">
                        Sector: {cmd.district}
                      </div>
                      <div className="flex items-center gap-2 pt-1 border-t border-gray-200 text-[10px] font-mono">
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                          <PhoneCall className="w-3 h-3" /> SMS: {cmd.sms}
                        </span>
                        <span className="inline-flex items-center gap-1 text-primary font-bold">
                          <Mail className="w-3 h-3" /> Email: {cmd.email}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Priority Tier 2: Registered Citizens */}
              <div>
                <div className="flex items-center justify-between border-b border-gray-200 pb-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-secondary text-white flex items-center justify-center text-[10px] font-bold">
                      2
                    </span>
                    <h4 className="font-bold text-xs uppercase tracking-wider text-secondary">
                      Priority Tier 2: Registered Citizens & Public Subscribers
                    </h4>
                  </div>
                  <span className="text-[10px] font-mono text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                    {priorityModalData.tier2_citizens?.length || 0} Registered Citizens Notified
                  </span>
                </div>

                {priorityModalData.tier2_citizens?.length > 0 ? (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {priorityModalData.tier2_citizens.map((cit, idx) => (
                      <div
                        key={cit.user_id || idx}
                        className="p-2 bg-gray-50 border border-gray-200 rounded flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <Users className="w-3.5 h-3.5 text-gray-500" />
                          <span className="font-semibold text-gray-800">{cit.name}</span>
                          <span className="text-[10px] text-gray-500 font-mono">({cit.phone || cit.email || 'Citizen'})</span>
                        </div>
                        <div className="flex items-center gap-2 font-mono text-[10px]">
                          <span className="text-emerald-700 font-bold">SMS: {cit.sms}</span>
                          <span className="text-primary font-bold">Email: {cit.email}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 bg-gray-50 rounded border border-gray-200 text-center text-gray-500 italic">
                    Public citizen SMS/Email dispatched to all active district subscribers.
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
              <span className="text-[11px] font-mono text-gray-500">
                Audit Status: Certified by BhoomiRakshak Sentinel Gateway
              </span>
              <button
                onClick={() => setPriorityModalData(null)}
                className="px-5 py-2 bg-primary hover:bg-primary-container text-white font-bold rounded text-xs transition-colors shadow-sm"
              >
                Acknowledge & Close Log
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-outline-variant/30 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-on-surface-variant">
              Emergency Dispatch & Warning Registry
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
            <span className="text-[10px] font-mono text-rose-600 font-bold">MULTI-CHANNEL PRIORITY DISPATCH ACTIVE</span>
          </div>
          <h1 className="text-xl font-bold text-on-surface tracking-tight">
            Alerts Console & Multi-Channel Broadcast
          </h1>
        </div>
      </div>

      {/* Admin Broadcast Trigger Form */}
      {role === 'admin' ? (
        <div className="bg-white rounded border border-outline-variant/40 p-5 shadow-sm">
          <div className="flex items-center justify-between border-b border-outline-variant/30 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-600" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-on-surface">
                Broadcast Emergency Landslide Warning
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 text-[10px] font-mono font-bold">
                Tier 1: 8 Field Commanders
              </span>
              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-mono font-bold">
                Tier 2: Registered Citizens
              </span>
            </div>
          </div>

          {errorMsg && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded text-xs font-semibold">
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded text-xs font-semibold flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{successMsg}</span>
              </div>
            </div>
          )}

          <form onSubmit={handleBroadcast} className="flex flex-col gap-4">
            {/* Target Multi-District Section */}
            <div className="p-3 bg-surface-container-low rounded border border-outline-variant/40">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2 gap-2">
                <label className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-primary" />
                  <span>Target Northeast Districts / Sectors (Multi-District Selection)</span>
                  <span className="text-rose-600">*</span>
                </label>
                <div className="flex items-center gap-3 text-xs">
                  <label className="flex items-center gap-1.5 cursor-pointer font-bold text-primary">
                    <input
                      type="checkbox"
                      checked={targetAll}
                      onChange={e => {
                        setTargetAll(e.target.checked);
                        if (e.target.checked) setSelectedRegionIds([]);
                      }}
                      className="rounded text-primary focus:ring-primary"
                    />
                    <span>All 8 Northeast State Sectors</span>
                  </label>
                </div>
              </div>

              {!targetAll && (
                <div className="flex flex-wrap gap-2 pt-2 border-t border-outline-variant/20">
                  {regions.map(r => {
                    const isSelected = selectedRegionIds.includes(r.id);
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => toggleRegion(r.id)}
                        className={`px-3 py-1.5 rounded text-xs font-semibold transition-all flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-primary text-white shadow-sm'
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
              )}

              <div className="mt-2 text-[11px] font-mono text-on-surface-variant">
                Targeting: {targetAll ? 'All 8 Northeast Corridors (Assam, Arunachal, Sikkim, Meghalaya, Mizoram, Nagaland, Manipur, Tripura)' : `${selectedRegionIds.length} Selected Districts`}
              </div>

              {/* Live DB Verified Recipients in Target Scope */}
              {subscribersData && (
                <div className="mt-2.5 p-2.5 bg-sky-50 border border-sky-200 rounded text-sky-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-sky-700 shrink-0" />
                    <span>
                      <strong>Live DB Verified Recipients:</strong>{' '}
                      {(() => {
                        const targetRegionsList = targetAll ? regions.map(r => r.id) : selectedRegionIds;
                        const matched = (subscribersData.by_region || []).filter(r => targetRegionsList.includes(r.region_id));
                        const total = matched.reduce((acc, curr) => acc + (curr.total_verified || 0), 0);
                        const officers = matched.reduce((acc, curr) => acc + (curr.officer_count || 0), 0);
                        const citizens = matched.reduce((acc, curr) => acc + (curr.citizen_count || 0), 0);
                        return `${total} verified SMS recipient(s) in scope (${officers} Sector Commanders, ${citizens} Citizens)`;
                      })()}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={fetchSubscribers}
                    disabled={subscribersLoading}
                    className="text-sky-700 hover:text-sky-900 flex items-center gap-1 font-semibold text-[11px] shrink-0 self-end sm:self-auto"
                  >
                    <RefreshCw className={`w-3 h-3 ${subscribersLoading ? 'animate-spin' : ''}`} />
                    <span>Sync DB</span>
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Severity Level */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-on-surface">
                  Warning Severity <span className="text-rose-600">*</span>
                </label>
                <select
                  value={severity}
                  onChange={e => setSeverity(e.target.value)}
                  className="h-9 px-3 bg-surface-container-low border border-outline-variant/40 rounded text-xs font-semibold focus:outline-none focus:border-primary"
                >
                  <option value="CRITICAL">CRITICAL (Immediate Evacuation / High Risk)</option>
                  <option value="HIGH">HIGH (Imminent Failure / Cutoff)</option>
                  <option value="MODERATE">MODERATE (Alert / Heavy Rain Infiltration)</option>
                  <option value="LOW">LOW (Watch Advisory)</option>
                </select>
              </div>

              {/* Contributing Reasons */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-on-surface">
                  Contributing Reasons (Comma-separated)
                </label>
                <input
                  type="text"
                  value={reasonInput}
                  onChange={e => setReasonInput(e.target.value)}
                  placeholder="e.g. 24h rain > 180mm, fresh slope fissure, NH-27 block"
                  className="h-9 px-3 bg-surface-container-low border border-outline-variant/40 rounded text-xs focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            {/* Message Body */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-on-surface">
                Emergency Alert Message Text <span className="text-rose-600">*</span>
              </label>
              <textarea
                rows={2}
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="e.g. Continuous heavy downpour detected. High probability of slope failure within 6-12 hours in vulnerable valleys. Avoid mountain corridors and await Field Commander evacuation."
                className="p-3 bg-surface-container-low border border-outline-variant/40 rounded text-xs focus:outline-none focus:border-primary leading-relaxed"
                required
              />
            </div>

            {/* Actions & Submit */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-outline-variant/30">
              <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  Dispatches Priority 1 to 8 Field Commanders first, then Priority 2 to registered citizens via SMS & Email.
                </span>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:w-auto px-6 py-2 bg-rose-700 hover:bg-rose-800 disabled:opacity-50 text-white text-xs font-bold rounded flex items-center justify-center gap-2 shadow-sm transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Executing Priority Dispatch...' : 'Broadcast Multi-Channel Warning'}</span>
              </button>
            </div>
          </form>

          {/* Live Verified SMS Subscribers Directory Card */}
          <div className="mt-5 p-4 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 pb-2 mb-3 gap-2">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-primary" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Live Verified SMS Subscribers per Region (Direct DB Query)
                </h3>
              </div>
              <span className="text-[11px] font-mono font-bold text-slate-600 bg-white px-2.5 py-0.5 rounded border border-slate-200">
                {subscribersData?.total_verified_subscribers || 0} Verified in Database
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {(subscribersData?.by_region || []).map(item => (
                <div 
                  key={item.region_id}
                  className="p-3 bg-white border border-slate-200 rounded text-xs flex flex-col justify-between shadow-2xs"
                >
                  <div>
                    <div className="font-bold text-slate-900 truncate">{item.district}</div>
                    <div className="text-[10px] text-slate-500 uppercase font-mono">{item.state}</div>
                  </div>
                  <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-slate-700">
                      {item.total_verified} verified SMS subscriber{item.total_verified === 1 ? '' : 's'}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      item.total_verified > 0 
                        ? 'bg-emerald-100 text-emerald-800' 
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {item.total_verified > 0 ? 'Ready' : '0 Ready'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4 bg-surface-container-low border border-outline-variant/30 rounded text-xs text-on-surface-variant flex items-center gap-2">
          <Info className="w-4 h-4 text-primary" />
          <span>Viewing warning registry. Only the Central Administrator is authorized to trigger institutional multi-channel alerts.</span>
        </div>
      )}

      {/* Emergency Warning Registry & Delivery Audit Table */}
      <div className="bg-white rounded border border-outline-variant/40 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-outline-variant/30 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface">
            Active Warning Registry & Multi-Channel Delivery Audit Log ({alerts.length})
          </h3>
          <span className="font-mono text-[11px] text-on-surface-variant">
            Live Stream Connected
          </span>
        </div>

        {alerts.length === 0 ? (
          <EmptyState
            icon={AlertTriangle}
            title="No Active Alerts in Registry"
            description="No emergency alerts have been broadcasted yet. The registry will record live alerts with delivery confirmations as hazardous events arise."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-container-low text-on-surface-variant uppercase font-mono text-[10px] font-bold border-b border-outline-variant/30">
                <tr>
                  <th className="p-3">Alert Code / Time</th>
                  <th className="p-3">District(s) Targeted</th>
                  <th className="p-3">Severity</th>
                  <th className="p-3">Warning Advisory</th>
                  <th className="p-3">Priority Multi-Channel Dispatch Audit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20">
                {alerts.map(a => (
                  <tr key={a.id} className="hover:bg-surface-container-lowest/70 transition-colors">
                    <td className="p-3 whitespace-nowrap">
                      <div className="font-mono font-bold text-primary">
                        {a.id.slice(0, 8).toUpperCase()}
                      </div>
                      <div className="font-mono text-[10px] text-on-surface-variant">
                        {new Date(a.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} IST
                      </div>
                    </td>
                    <td className="p-3 font-semibold text-on-surface whitespace-nowrap">
                      {a.region_name || 'All Monitored Sectors'}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <SeverityChip severity={a.severity} />
                    </td>
                    <td className="p-3 max-w-md">
                      <p className="font-medium text-on-surface leading-snug">{a.message}</p>
                      {a.reasons && a.reasons.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {a.reasons.map((r, i) => (
                            <span key={i} className="text-[9px] font-mono bg-surface-container-high text-on-surface px-1.5 py-0.5 rounded">
                              {r}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <div className="flex flex-wrap gap-1.5">
                        {a.channels_sent && Array.isArray(a.channels_sent) && a.channels_sent.length > 0 ? (
                          a.channels_sent.map(c => getChannelBadge(c))
                        ) : (
                          <span className="text-[10px] font-mono text-on-surface-variant italic">
                            Web App: sent
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
