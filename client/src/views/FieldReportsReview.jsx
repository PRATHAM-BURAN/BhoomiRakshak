import React, { useState, useEffect } from 'react';
import { 
  ClipboardCheck, 
  MapPin, 
  Check, 
  X, 
  Eye, 
  WifiOff, 
  Filter, 
  Camera, 
  ShieldCheck,
  AlertCircle,
  ZoomIn,
  Download
} from 'lucide-react';
import SeverityChip from '../components/SeverityChip';
import EmptyState from '../components/EmptyState';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { resolveMediaUrl } from '../utils/imageUtils';

export default function FieldReportsReview({
  reports = [],
  onReportUpdated,
  setCurrentView
}) {
  const { user, role } = useAuth();
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedReport, setSelectedReport] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [reviewNote, setReviewNote] = useState('');
  const [failedImages, setFailedImages] = useState({});
  const [modalImgFailed, setModalImgFailed] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null);

  useEffect(() => {
    setModalImgFailed(false);
  }, [selectedReport]);

  const markImageFailed = (reportId) => {
    setFailedImages(prev => ({ ...prev, [reportId]: true }));
  };

  const filteredReports = reports.filter(r => {
    if (statusFilter === 'all') return true;
    return r.status === statusFilter;
  });

  const handleUpdateStatus = async (newStatus) => {
    if (!selectedReport) return;
    setIsProcessing(true);
    try {
      const res = await api.updateReportStatus(selectedReport.id, newStatus, reviewNote);
      if (onReportUpdated) {
        onReportUpdated(res.report);
      }
      setSelectedReport(null);
      setReviewNote('');
    } catch (err) {
      alert(`Error updating report: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const isOfficerOrAdmin = role === 'admin' || role === 'field_officer';

  return (
    <div className="p-4 md:p-6 flex flex-col gap-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-outline-variant/30 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-on-surface-variant">
              Field Ground Truth & Observation Triage
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
            <span className="text-[10px] font-mono text-secondary font-bold">
              {role === 'field_officer' ? `District Officer View (${user?.region_name || 'Assigned'})` : 'Admin Central Triage'}
            </span>
          </div>
          <h1 className="text-xl font-bold text-on-surface tracking-tight">
            Field Reports Verification Desk
          </h1>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 bg-surface-container-low p-1 rounded border border-outline-variant/30 text-xs font-semibold">
          {['all', 'pending', 'verified', 'rejected'].map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1 rounded uppercase text-[10px] font-mono tracking-wider transition-colors ${
                statusFilter === st
                  ? 'bg-primary text-white font-bold shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {st} ({reports.filter(r => st === 'all' || r.status === st).length})
            </button>
          ))}
        </div>
      </div>

      {/* Reports Grid */}
      {filteredReports.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="No Field Reports in this View"
          description={
            reports.length === 0
              ? "Zero ground-truth observations have been submitted to the registry yet."
              : `No reports match the status filter '${statusFilter.toUpperCase()}'.`
          }
          actionLabel="Submit Observation Report"
          onAction={() => setCurrentView('field-officer')}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredReports.map(rep => {
            const rawUrl = rep.media_data_url || rep.media_url;
            const resolvedUrl = resolveMediaUrl(rawUrl);
            const isFailed = !resolvedUrl || failedImages[rep.id];

            return (
              <div
                key={rep.id}
                className="bg-white rounded border border-outline-variant/40 shadow-sm overflow-hidden flex flex-col justify-between hover:border-primary/50 transition-colors"
              >
                <div>
                  {/* Photo Thumbnail or Fallback Header */}
                  {!isFailed ? (
                    <div 
                      onClick={() => setLightboxImage(resolvedUrl)}
                      className="relative h-44 w-full bg-slate-950 overflow-hidden border-b border-outline-variant/30 cursor-pointer group"
                      title="Click to zoom inspection photo"
                    >
                      <img
                        src={resolvedUrl}
                        alt="Field evidence"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={() => markImageFailed(rep.id)}
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-xs font-bold gap-1">
                        <ZoomIn className="w-4 h-4" />
                        <span>Inspect High-Res</span>
                      </div>
                      <div className="absolute top-2 left-2 pointer-events-none">
                        <SeverityChip severity={rep.severity} />
                      </div>
                      {rep.created_offline && (
                        <div className="absolute top-2 right-2 bg-amber-900/90 text-white text-[9px] font-mono px-2 py-0.5 rounded flex items-center gap-1 shadow">
                          <WifiOff className="w-3 h-3" />
                          <span>OFFLINE CAPTURE</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-3 bg-surface-container-low border-b border-outline-variant/30 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <SeverityChip severity={rep.severity} />
                        <span className="text-[10px] font-mono text-on-surface-variant flex items-center gap-1">
                          <Camera className="w-3 h-3 text-primary/70" />
                          <span>GROUND TELEMETRY</span>
                        </span>
                      </div>
                      {rep.created_offline && (
                        <span className="text-[9px] font-mono bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded flex items-center gap-1 font-bold">
                          <WifiOff className="w-3 h-3" />
                          <span>OFFLINE</span>
                        </span>
                      )}
                    </div>
                  )}

                  {/* Report Content */}
                  <div className="p-4 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-sm text-on-surface capitalize">
                        {rep.report_type.replace('_', ' ')}
                      </h3>
                      <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded ${
                        rep.status === 'verified' ? 'bg-emerald-100 text-emerald-800' : (
                          rep.status === 'rejected' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                        )
                      }`}>
                        {rep.status}
                      </span>
                    </div>

                    <p className="text-xs text-on-surface-variant line-clamp-3 leading-relaxed">
                      {rep.description || 'No descriptive narrative provided.'}
                    </p>

                    <div className="pt-2 border-t border-outline-variant/20 flex flex-col gap-1 text-[11px] text-on-surface-variant font-mono">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-primary shrink-0" />
                        <span className="truncate">{rep.region_name}</span>
                      </div>
                      <div>Reporter: {rep.submitted_by_name || 'Ground Observer'}</div>
                      <div>Recorded: {new Date(rep.created_at).toLocaleString()}</div>
                    </div>
                  </div>
                </div>

                {/* Bottom Action Footer */}
                <div className="p-3 bg-surface-container-low border-t border-outline-variant/30 flex items-center justify-between">
                  <button
                    onClick={() => setSelectedReport(rep)}
                    className="px-3 py-1 bg-white hover:bg-surface-container-high text-on-surface text-xs font-bold rounded border border-outline-variant/40 flex items-center gap-1.5 transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Inspect Evidence</span>
                  </button>

                  {isOfficerOrAdmin && rep.status === 'pending' && (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => { setSelectedReport(rep); }}
                        className="px-2.5 py-1 bg-secondary text-white text-xs font-bold rounded hover:bg-secondary/90 transition-colors"
                      >
                        Triage
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Inspection & Triage Modal */}
      {selectedReport && (() => {
        const modalRawUrl = selectedReport.media_data_url || selectedReport.media_url;
        const modalResolvedUrl = resolveMediaUrl(modalRawUrl);
        const hasValidPhoto = modalResolvedUrl && !modalImgFailed;

        return (
          <div className="fixed inset-0 bg-primary/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-2xl border border-outline-variant/40 max-w-xl w-full max-h-[90vh] overflow-y-auto flex flex-col">
              <div className="p-4 bg-primary text-white flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  <span className="font-bold text-sm uppercase tracking-wider">
                    Ground-Truth Verification Inspection
                  </span>
                </div>
                <button
                  onClick={() => setSelectedReport(null)}
                  className="p-1 hover:bg-white/10 rounded transition-colors text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 flex flex-col gap-4 text-xs">
                {/* Media image or Fallback Inspection Banner */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <h4 className="font-bold text-xs uppercase text-on-surface-variant flex items-center gap-1.5">
                      <Camera className="w-3.5 h-3.5 text-primary" />
                      Field Photo Telemetry
                    </h4>
                    {hasValidPhoto && (
                      <button
                        type="button"
                        onClick={() => setLightboxImage(modalResolvedUrl)}
                        className="text-[11px] text-primary hover:underline flex items-center gap-1 font-bold"
                      >
                        <ZoomIn className="w-3 h-3" />
                        <span>Inspect Full-Res</span>
                      </button>
                    )}
                  </div>

                  {hasValidPhoto ? (
                    <div className="relative group rounded border border-outline-variant/40 overflow-hidden bg-slate-950 shadow-inner">
                      <img
                        src={modalResolvedUrl}
                        alt="Inspection target"
                        className="w-full max-h-72 object-contain mx-auto transition-transform cursor-zoom-in group-hover:scale-102"
                        onClick={() => setLightboxImage(modalResolvedUrl)}
                        onError={() => setModalImgFailed(true)}
                      />
                      <div className="p-1.5 bg-slate-900/90 text-slate-300 text-[10px] font-mono flex items-center justify-between px-3">
                        <span>Click photo to expand high-resolution inspection</span>
                        <span className="text-emerald-400 font-bold">VERIFIED ASSET</span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 rounded border border-dashed border-outline-variant/50 bg-surface-container-low flex flex-col items-center justify-center text-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center text-on-surface-variant">
                        <Camera className="w-5 h-5 text-on-surface-variant/70" />
                      </div>
                      <div>
                        <p className="font-bold text-xs text-on-surface">Field Observation Telemetry Logged</p>
                        <p className="text-[11px] text-on-surface-variant max-w-sm mt-0.5 leading-relaxed">
                          Field master logged coordinates at {selectedReport.geometry?.coordinates ? `[${selectedReport.geometry.coordinates.join(', ')}]` : 'target sector'}. Incident record is locked for triage.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Attributes */}
                <div className="grid grid-cols-2 gap-3 p-3 bg-surface-container-low rounded border border-outline-variant/30">
                  <div>
                    <span className="text-on-surface-variant font-medium">Type:</span>
                    <p className="font-bold capitalize">{selectedReport.report_type.replace('_', ' ')}</p>
                  </div>
                  <div>
                    <span className="text-on-surface-variant font-medium">Severity:</span>
                    <div><SeverityChip severity={selectedReport.severity} /></div>
                  </div>
                  <div>
                    <span className="text-on-surface-variant font-medium">District:</span>
                    <p className="font-bold">{selectedReport.region_name}</p>
                  </div>
                  <div>
                    <span className="text-on-surface-variant font-medium">Status:</span>
                    <p className="font-mono font-bold uppercase">{selectedReport.status}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-on-surface-variant font-medium">GPS Coordinates:</span>
                    <p className="font-mono font-bold text-primary">
                      {selectedReport.geometry?.coordinates ? selectedReport.geometry.coordinates.join(', ') : 'Not geocoded'}
                    </p>
                  </div>
                </div>

                <div>
                  <h4 className="font-bold text-xs uppercase text-on-surface-variant mb-1">
                    Observer Narrative:
                  </h4>
                  <p className="p-3 bg-surface-container-low rounded border border-outline-variant/30 text-on-surface leading-relaxed">
                    {selectedReport.description || 'No remarks entered.'}
                  </p>
                </div>

                {/* Triage action for field officers or admin */}
                {isOfficerOrAdmin && (
                  <div className="pt-3 border-t border-outline-variant/30 flex flex-col gap-2">
                    <label className="font-bold text-on-surface">Verification Review Remarks:</label>
                    <input
                      type="text"
                      value={reviewNote}
                      onChange={e => setReviewNote(e.target.value)}
                      placeholder="e.g. Geologist confirmed 4cm surface tension crack; road closed."
                      className="p-2 border border-outline-variant/40 rounded bg-surface-container-low text-xs focus:outline-none focus:border-primary"
                    />

                    <div className="flex items-center justify-end gap-2 pt-2">
                      <button
                        disabled={isProcessing}
                        onClick={() => handleUpdateStatus('rejected')}
                        className="px-4 py-2 bg-rose-50 text-rose-800 hover:bg-rose-100 font-bold rounded text-xs transition-colors"
                      >
                        Reject Report
                      </button>
                      <button
                        disabled={isProcessing}
                        onClick={() => handleUpdateStatus('verified')}
                        className="px-4 py-2 bg-secondary text-white hover:bg-secondary/90 font-bold rounded text-xs transition-colors flex items-center gap-1.5 shadow-sm"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Verify Ground Truth</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Lightbox High-Resolution Evidence Inspector Modal */}
      {lightboxImage && (
        <div 
          className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex flex-col items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setLightboxImage(null)}
        >
          <div 
            className="absolute top-4 right-4 flex items-center gap-3 z-10"
            onClick={e => e.stopPropagation()}
          >
            <a
              href={lightboxImage}
              download="ground-truth-evidence.jpg"
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-mono rounded flex items-center gap-1.5 transition-colors border border-white/20"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download High-Res</span>
            </a>
            <button
              onClick={() => setLightboxImage(null)}
              className="p-2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors border border-white/20"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="max-w-4xl max-h-[80vh] flex items-center justify-center p-2" onClick={e => e.stopPropagation()}>
            <img
              src={lightboxImage}
              alt="High-resolution ground evidence"
              className="max-w-full max-h-[80vh] object-contain rounded border border-white/10 shadow-2xl"
            />
          </div>
          <div className="mt-3 text-center text-white/70 text-xs font-mono">
            Ground-Truth Field Telemetry • High-Resolution Geological Evidence
          </div>
        </div>
      )}
    </div>
  );
}
