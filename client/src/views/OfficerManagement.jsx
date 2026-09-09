import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserPlus, 
  ShieldCheck, 
  MapPin, 
  CheckCircle, 
  XCircle, 
  AlertCircle 
} from 'lucide-react';
import EmptyState from '../components/EmptyState';
import { api } from '../api';

export default function OfficerManagement({ regions = [] }) {
  const [officers, setOfficers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [regionId, setRegionId] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchOfficers = async () => {
    setLoading(true);
    try {
      const res = await api.getOfficers();
      setOfficers(res.officers || []);
    } catch (err) {
      console.error('Failed to fetch officers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOfficers();
  }, []);

  const handleCreateOfficer = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!regionId) {
      setErrorMsg('A Field Officer must be assigned to exactly one monitored district.');
      return;
    }

    setSubmitting(true);
    try {
      await api.createOfficer({
        name,
        email,
        phone,
        password,
        region_id: regionId
      });

      setSuccessMsg('Field Officer deployed and linked to assigned district.');
      setName('');
      setEmail('');
      setPhone('');
      setPassword('');
      setRegionId('');
      fetchOfficers();
      setTimeout(() => setShowModal(false), 800);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to deploy officer.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (officer) => {
    try {
      await api.toggleOfficerStatus(officer.id, !officer.is_active);
      fetchOfficers();
    } catch (err) {
      alert(`Status update failed: ${err.message}`);
    }
  };

  return (
    <div className="p-4 md:p-6 flex flex-col gap-6 max-w-7xl mx-auto pb-16">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-outline-variant/30 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-on-surface-variant">
              Personnel Deployment & Access Control
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
            <span className="text-[10px] font-mono text-secondary font-bold">ADMIN CLEARANCE</span>
          </div>
          <h1 className="text-xl font-bold text-on-surface tracking-tight">
            Field Officer Registry & District Assignments
          </h1>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-primary hover:bg-primary-container text-white text-xs font-bold rounded flex items-center gap-2 transition-colors shadow-sm self-start md:self-auto"
        >
          <UserPlus className="w-4 h-4 text-emerald-400" />
          <span>Deploy New Field Officer</span>
        </button>
      </div>

      {/* Officers Table */}
      <div className="bg-white rounded border border-outline-variant/40 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-outline-variant/30 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface">
            Active Field Personnel Roster ({officers.length})
          </h3>
          <span className="text-xs text-on-surface-variant">
            Each officer is strictly scoped to one district
          </span>
        </div>

        {officers.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No Field Officers Deployed Yet"
            description="No field officers have been created. Only administrators can provision officer accounts to verify ground truth in hazardous sectors."
            actionLabel="Deploy First Officer"
            onAction={() => setShowModal(true)}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-container-low text-on-surface-variant uppercase font-mono text-[10px] font-bold border-b border-outline-variant/30">
                <tr>
                  <th className="p-3">Officer Name</th>
                  <th className="p-3">Contact (Email & Phone)</th>
                  <th className="p-3">Assigned Monitored District</th>
                  <th className="p-3">Account Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20">
                {officers.map(off => (
                  <tr key={off.id} className="hover:bg-surface-container-lowest/70 transition-colors">
                    <td className="p-3 font-bold text-on-surface">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-white text-[10px] font-mono">
                          {off.name.charAt(0).toUpperCase()}
                        </div>
                        <span>{off.name}</span>
                      </div>
                    </td>
                    <td className="p-3 font-mono text-on-surface-variant">
                      <div>{off.email}</div>
                      <div className="text-[11px] text-gray-500">{off.phone || 'No phone registered'}</div>
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <span className="font-bold text-primary flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-secondary shrink-0" />
                        <span>{off.region_name}</span>
                      </span>
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                        off.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {off.is_active ? (
                          <>
                            <CheckCircle className="w-3 h-3 text-emerald-600" />
                            <span>Active Field Status</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3 text-rose-600" />
                            <span>Deactivated</span>
                          </>
                        )}
                      </span>
                    </td>
                    <td className="p-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => handleToggleStatus(off)}
                        className={`px-3 py-1 rounded text-xs font-bold transition-colors border ${
                          off.is_active
                            ? 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
                            : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                        }`}
                      >
                        {off.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Deploy Officer Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-primary/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl border border-outline-variant/40 max-w-md w-full p-5 flex flex-col gap-4 text-xs animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-outline-variant/30 pb-3">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-primary" />
                <h3 className="font-bold text-sm uppercase tracking-wider text-on-surface">
                  Deploy Field Officer
                </h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-on-surface-variant hover:text-on-surface font-bold text-sm"
              >
                ✕
              </button>
            </div>

            {errorMsg && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded font-semibold">
                {errorMsg}
              </div>
            )}
            {successMsg && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded font-semibold">
                {successMsg}
              </div>
            )}

            <form onSubmit={handleCreateOfficer} className="flex flex-col gap-3">
              <div>
                <label className="font-bold text-on-surface mb-1 block">Full Officer Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Inspector R. Lyngdoh"
                  className="w-full h-9 px-3 bg-surface-container-low border border-outline-variant/40 rounded focus:outline-none focus:border-primary"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-on-surface mb-1 block">Institutional Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="r.lyngdoh@sdrf.gov.in"
                  className="w-full h-9 px-3 bg-surface-container-low border border-outline-variant/40 rounded focus:outline-none focus:border-primary"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-on-surface mb-1 block">Emergency Mobile Phone</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full h-9 px-3 bg-surface-container-low border border-outline-variant/40 rounded focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="font-bold text-on-surface mb-1 block">Initial Access Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-9 px-3 bg-surface-container-low border border-outline-variant/40 rounded focus:outline-none focus:border-primary"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-on-surface mb-1 block">
                  Assigned District Sector (Strictly Single FK) <span className="text-rose-600">*</span>
                </label>
                <select
                  value={regionId}
                  onChange={e => setRegionId(e.target.value)}
                  className="w-full h-9 px-3 bg-surface-container-low border border-outline-variant/40 rounded font-semibold focus:outline-none focus:border-primary"
                  required
                >
                  <option value="">-- Choose Assigned Sector --</option>
                  {regions.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.district}, {r.state}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-outline-variant/30">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3 py-1.5 rounded text-on-surface-variant hover:bg-surface-container text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-primary hover:bg-primary-container text-white rounded text-xs font-bold shadow-sm transition-colors"
                >
                  {submitting ? 'Provisioning...' : 'Provision Officer Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
