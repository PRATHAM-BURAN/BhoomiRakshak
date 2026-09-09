import React, { useState } from 'react';
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
  AlertCircle
} from 'lucide-react';
import SeverityChip from '../components/SeverityChip';
import EmptyState from '../components/EmptyState';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';

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
          {filteredReports.map(rep => (
            <div
              key={rep.id}
              className="bg-white rounded border border-outline-variant/40 shadow-sm overflow-hidden flex flex-col justify-between hover:border-primary/50 transition-colors"
            >
              <div>
                {/* Photo Thumbnail if present */}
                {rep.media_url ? (
                  <div className="relative h-44 w-full bg-slate-900 overflow-hidden border-b border-outline-variant/30">
                    <img
                      src={rep.media_url}
                      alt="Field evidence"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2 left-2">
                      <SeverityChip severity={rep.severity} />
                    </div>
                    {rep.created_offline && (
                      <div className="absolute top-2 right-2 bg-amber-900/90 text-white text-[9px] font-mono px-2 py-0.5 rounded flex items-center gap-1">
                        <WifiOff className="w-3 h-3" />
                        <span>OFFLINE CAPTURE</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3 bg-surface-container-low border-b border-outline-variant/30 flex items-center justify-between">
                    <SeverityChip severity={rep.severity} />
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
          ))}
        </div>
      )}

      {/* Inspection & Triage Modal */}
      {selectedReport && (
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
              {/* Media image */}
              {selectedReport.media_url && (
                <div>
                  <h4 className="font-bold text-xs uppercase text-on-surface-variant mb-1.5">
                    Field Photo Telemetry
                  </h4>
                  <img
                    src={selectedReport.media_url}
                    alt="Inspection target"
                    className="w-full max-h-72 object-cover rounded border border-outline-variant/40 shadow-inner"
                  />
                </div>
              )}

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
      )}
    </div>
  );
}
