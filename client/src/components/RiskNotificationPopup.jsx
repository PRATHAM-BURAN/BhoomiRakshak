import React from 'react';
import { 
  AlertTriangle, 
  ShieldAlert, 
  Volume2, 
  VolumeX, 
  MapPin, 
  Check, 
  ArrowRight, 
  Radio, 
  Sparkles, 
  Building2, 
  Layers, 
  Clock,
  Compass,
  AlertCircle
} from 'lucide-react';
import { useAlertModal } from '../context/AlertModalContext';

export function RiskNotificationPopup({ onNavigateToMap }) {
  const { 
    currentAlert, 
    queueLength, 
    soundEnabled, 
    toggleSound, 
    acknowledgeCurrentAlert, 
    viewCurrentAlertOnMap 
  } = useAlertModal();

  if (!currentAlert) return null;

  const severity = (currentAlert.severity || 'HIGH').toUpperCase();
  const isCritical = severity === 'CRITICAL';
  const isHigh = severity === 'HIGH';

  // Severity-dependent styling (Yellow / Orange / Red / Dark Red per Stitch design system)
  const getSeverityStyle = () => {
    switch (severity) {
      case 'CRITICAL':
        return {
          cardBorder: 'border-2 border-rose-500 shadow-2xl shadow-rose-950/80 animate-pulse',
          headerBg: 'bg-gradient-to-r from-rose-950 via-rose-900 to-rose-950 border-b border-rose-700/60',
          badgeBg: 'bg-rose-600 text-white border-rose-400',
          pingColor: 'bg-rose-400',
          accentColor: 'text-rose-400',
          boxBg: 'bg-rose-950/30 border-rose-500/30 text-rose-100',
          label: 'CRITICAL EMERGENCY WARNING'
        };
      case 'HIGH':
        return {
          cardBorder: 'border-2 border-amber-600 shadow-2xl shadow-amber-950/60',
          headerBg: 'bg-gradient-to-r from-amber-950 via-amber-900 to-amber-950 border-b border-amber-700/60',
          badgeBg: 'bg-amber-600 text-white border-amber-400',
          pingColor: 'bg-amber-400',
          accentColor: 'text-amber-400',
          boxBg: 'bg-amber-950/30 border-amber-500/30 text-amber-100',
          label: 'HIGH THREAT ADVISORY'
        };
      case 'MODERATE':
        return {
          cardBorder: 'border-2 border-yellow-500 shadow-xl shadow-yellow-950/40',
          headerBg: 'bg-gradient-to-r from-yellow-950 via-yellow-900 to-yellow-950 border-b border-yellow-700/60',
          badgeBg: 'bg-yellow-600 text-white border-yellow-300',
          pingColor: 'bg-yellow-400',
          accentColor: 'text-yellow-400',
          boxBg: 'bg-yellow-950/30 border-yellow-500/30 text-yellow-100',
          label: 'MODERATE RISK NOTICE'
        };
      default:
        return {
          cardBorder: 'border border-blue-500 shadow-xl',
          headerBg: 'bg-slate-900 border-b border-slate-700',
          badgeBg: 'bg-blue-600 text-white',
          pingColor: 'bg-blue-400',
          accentColor: 'text-blue-400',
          boxBg: 'bg-slate-900/30 border-slate-700 text-slate-100',
          label: 'GEOLOGICAL ADVISORY'
        };
    }
  };

  const style = getSeverityStyle();

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div 
        className={`bg-slate-900 rounded-xl overflow-hidden max-w-lg w-full text-white shadow-2xl transition-all ${style.cardBorder}`}
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className={`p-4 flex items-center justify-between ${style.headerBg}`}>
          <div className="flex items-center gap-3">
            <span className="relative flex h-3.5 w-3.5">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-80 ${style.pingColor}`} />
              <span className={`relative inline-flex rounded-full h-3.5 w-3.5 ${style.pingColor}`} />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-300 shrink-0" />
                <span className="text-xs font-bold tracking-wider uppercase font-mono">
                  {style.label}
                </span>
              </div>
              <p className="text-[10px] text-slate-300 font-mono mt-0.5">
                BhoomiRakshak National Disaster Sentinel Early Warning
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {queueLength > 1 && (
              <span className="text-[10px] font-mono font-bold bg-white/10 px-2 py-0.5 rounded text-sky-200 border border-white/10">
                Alert 1 of {queueLength}
              </span>
            )}
            {/* Audio chime toggle with user click */}
            <button
              onClick={toggleSound}
              title={soundEnabled ? "Audio alerts enabled (Click to mute)" : "Click to enable audio chime on alerts"}
              className={`p-1.5 rounded transition-colors flex items-center gap-1 text-[11px] font-semibold border ${
                soundEnabled 
                  ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-300' 
                  : 'bg-white/10 border-white/20 text-slate-300 hover:text-white'
              }`}
            >
              {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              <span className="text-[10px] hidden sm:inline">{soundEnabled ? 'Tone On' : 'Tone Off'}</span>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          {/* Affected District & Severity Chip */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-white/10">
            <div className="flex items-center gap-1.5 text-xs">
              <MapPin className="w-4 h-4 text-sky-400 shrink-0" />
              <span className="text-slate-400 font-medium">Affected Sector:</span>
              <span className="font-bold text-sky-300 text-sm">
                {currentAlert.region_name || currentAlert.region_id || 'Northeast India Monitored Corridor'}
              </span>
            </div>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold uppercase border font-mono ${style.badgeBg}`}>
              {severity} SEVERITY
            </span>
          </div>

          {/* Plain-Language Message */}
          <div className="p-3.5 bg-black/40 rounded-lg border border-white/10">
            <h4 className="text-xs font-mono uppercase text-slate-400 mb-1 font-semibold">
              Emergency Warning Directive:
            </h4>
            <p className="text-sm text-slate-100 font-medium leading-relaxed">
              {currentAlert.message}
            </p>
          </div>

          {/* Action Recommendation */}
          {currentAlert.action_recommendation && (
            <div className={`p-3 rounded-lg border flex items-start gap-2.5 text-xs ${style.boxBg}`}>
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold uppercase block text-[11px]">Recommended Emergency Protocol:</span>
                <span className="font-semibold text-slate-200 mt-0.5 block">
                  {currentAlert.action_recommendation}
                </span>
              </div>
            </div>
          )}

          {/* Trigger Reasons / Scientific Causes */}
          {currentAlert.reasons && Array.isArray(currentAlert.reasons) && currentAlert.reasons.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <span className="text-[11px] font-mono text-slate-400 uppercase font-semibold block">
                Trigger Telemetry / Diagnostic Factors:
              </span>
              <div className="space-y-1">
                {currentAlert.reasons.map((reason, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-xs text-slate-300 bg-white/5 p-2 rounded">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400 mt-1.5 shrink-0" />
                    <span>{reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Multi-Channel Broadcast Status Indicator */}
          <div className="p-2.5 bg-black/20 rounded border border-white/5 text-[10px] font-mono text-slate-400 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <Radio className="w-3 h-3 text-emerald-400" />
              <span>Multi-Channel SMS & Realtime Alert Dispatched</span>
            </div>
            <div className="flex items-center gap-1 text-slate-400">
              <Clock className="w-3 h-3" />
              <span>
                {currentAlert.created_at 
                  ? new Date(currentAlert.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' IST'
                  : 'Live Now'}
              </span>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="p-4 bg-slate-950/70 border-t border-white/10 flex flex-col sm:flex-row items-center gap-3">
          {/* Action 1: View on Map */}
          <button
            onClick={() => {
              if (onNavigateToMap) {
                onNavigateToMap(currentAlert);
              } else {
                viewCurrentAlertOnMap();
              }
            }}
            className="w-full sm:flex-1 py-2.5 px-4 bg-white text-slate-950 hover:bg-slate-200 font-bold rounded-lg text-xs flex items-center justify-center gap-2 transition-all shadow-md"
          >
            <Compass className="w-4 h-4 text-slate-950" />
            <span>View Affected Zone on GIS Map</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          {/* Action 2: Acknowledge */}
          <button
            onClick={acknowledgeCurrentAlert}
            className="w-full sm:w-auto py-2.5 px-6 bg-rose-700 hover:bg-rose-800 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shrink-0"
          >
            <Check className="w-4 h-4" />
            <span>Acknowledge Alert</span>
          </button>
        </div>
      </div>
    </div>
  );
}
