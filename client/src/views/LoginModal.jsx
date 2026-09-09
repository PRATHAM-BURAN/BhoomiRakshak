import React, { useState } from 'react';
import { ShieldAlert, LogIn, UserPlus, X, Lock, Mail, Phone, User, MapPin } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function LoginModal({ isOpen, onClose, regions = [] }) {
  const { login, setupAdmin, registerCitizen } = useAuth();
  const [activeTab, setActiveTab] = useState('login'); // 'login' | 'setup-admin' | 'citizen-register'

  // Login inputs
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  // Setup / Register inputs
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [selectedRegionIds, setSelectedRegionIds] = useState([]);

  const toggleRegion = (id) => {
    setSelectedRegionIds(prev => 
      prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
    );
  };

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');



  if (!isOpen) return null;

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);
    try {
      await login(identifier, password);
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSetupAdminSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);
    try {
      await setupAdmin({
        name,
        email,
        phone,
        password: newPassword
      });
      setSuccessMsg('Administrator successfully provisioned.');
      setTimeout(() => onClose(), 600);
    } catch (err) {
      setErrorMsg(err.message || 'Admin setup failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleCitizenRegisterSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (selectedRegionIds.length === 0) {
      setErrorMsg('Please select at least one home district/corridor to receive regional early warning alerts.');
      return;
    }
    setLoading(true);
    try {
      await registerCitizen({
        name,
        email: email || undefined,
        phone: phone || undefined,
        password: newPassword,
        region_ids: selectedRegionIds,
        region_id: selectedRegionIds[0] || undefined
      });
      setSuccessMsg(`Citizen account created with ${selectedRegionIds.length} monitored district(s).`);
      setTimeout(() => onClose(), 600);
    } catch (err) {
      setErrorMsg(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-primary/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl border border-outline-variant/40 max-w-md w-full overflow-hidden flex flex-col text-xs animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 bg-primary text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-emerald-400" />
            <span className="font-bold text-sm tracking-tight">
              BhoomiRakshak Identity Gateway
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/10 rounded transition-colors text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-outline-variant/30 bg-surface-container-low font-semibold text-center">
          <button
            onClick={() => { setActiveTab('login'); setErrorMsg(''); }}
            className={`flex-1 py-2.5 transition-colors ${
              activeTab === 'login'
                ? 'bg-white text-primary border-b-2 border-primary font-bold'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Account Login
          </button>
          <button
            onClick={() => { setActiveTab('citizen-register'); setErrorMsg(''); }}
            className={`flex-1 py-2.5 transition-colors ${
              activeTab === 'citizen-register'
                ? 'bg-white text-primary border-b-2 border-primary font-bold'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Citizen Sign-Up
          </button>
          <button
            onClick={() => { setActiveTab('setup-admin'); setErrorMsg(''); }}
            className={`flex-1 py-2.5 transition-colors ${
              activeTab === 'setup-admin'
                ? 'bg-white text-primary border-b-2 border-primary font-bold'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Initial Admin Setup
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded font-semibold leading-relaxed">
              {errorMsg}
            </div>
          )}
          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded font-semibold">
              {successMsg}
            </div>
          )}

          {/* TAB 1: LOGIN */}
          {activeTab === 'login' && (
            <form onSubmit={handleLoginSubmit} className="flex flex-col gap-3">
              <div>
                <label className="font-bold text-on-surface mb-1 block">Email or Phone Number</label>
                <div className="relative flex items-center">
                  <Mail className="w-3.5 h-3.5 absolute left-3 text-on-surface-variant" />
                  <input
                    type="text"
                    value={identifier}
                    onChange={e => setIdentifier(e.target.value)}
                    placeholder="user@disaster.gov.in or +91 9876543210"
                    className="w-full h-9 pl-9 pr-3 bg-surface-container-low border border-outline-variant/40 rounded focus:outline-none focus:border-primary font-mono text-xs"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-on-surface mb-1 block">Password</label>
                <div className="relative flex items-center">
                  <Lock className="w-3.5 h-3.5 absolute left-3 text-on-surface-variant" />
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-9 pl-9 pr-3 bg-surface-container-low border border-outline-variant/40 rounded focus:outline-none focus:border-primary text-xs"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 h-9 bg-primary hover:bg-primary-container text-white font-bold rounded flex items-center justify-center gap-1.5 transition-colors shadow-sm"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>{loading ? 'Authenticating...' : 'Sign In to BhoomiRakshak'}</span>
              </button>

              <p className="text-[11px] text-center text-on-surface-variant mt-2">
                Authorized NDMA & Field Commander accounts are configured via institutional deployment.
              </p>
            </form>
          )}

          {/* TAB 2: CITIZEN REGISTER */}
          {activeTab === 'citizen-register' && (
            <form onSubmit={handleCitizenRegisterSubmit} className="flex flex-col gap-3">
              <div>
                <label className="font-bold text-on-surface mb-1 block">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Anupam Barman"
                  className="w-full h-9 px-3 bg-surface-container-low border border-outline-variant/40 rounded focus:outline-none focus:border-primary text-xs"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-on-surface mb-1 block">Mobile Phone Number (for SMS warnings)</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full h-9 px-3 bg-surface-container-low border border-outline-variant/40 rounded focus:outline-none focus:border-primary font-mono text-xs"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-on-surface mb-1 block">Email Address (Optional)</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="name@gmail.com"
                  className="w-full h-9 px-3 bg-surface-container-low border border-outline-variant/40 rounded focus:outline-none focus:border-primary text-xs"
                />
              </div>

              {/* Multi-District Selector */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-on-surface">
                    Monitored Districts (Multi-Select Allowed)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedRegionIds.length === regions.length) {
                        setSelectedRegionIds([]);
                      } else {
                        setSelectedRegionIds(regions.map(r => r.id));
                      }
                    }}
                    className="text-[10px] text-primary font-bold hover:underline"
                  >
                    {selectedRegionIds.length === regions.length ? 'Clear All' : 'Select All 8 States'}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-1.5 p-2 bg-surface-container-low border border-outline-variant/40 rounded max-h-36 overflow-y-auto">
                  {regions.map(r => {
                    const isSelected = selectedRegionIds.includes(r.id);
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => toggleRegion(r.id)}
                        className={`px-2 py-1.5 rounded text-[10px] font-semibold text-left transition-all border flex items-center justify-between ${
                          isSelected 
                            ? 'bg-primary text-white border-primary shadow-xs' 
                            : 'bg-white text-on-surface border-outline-variant/30 hover:border-primary/50'
                        }`}
                      >
                        <span className="truncate">{r.district}</span>
                        <span className="text-[9px] opacity-75 ml-1 uppercase truncate font-mono">({r.state.slice(0, 3)})</span>
                      </button>
                    );
                  })}
                </div>
                <div className="text-[10px] text-on-surface-variant mt-1 font-medium">
                  {selectedRegionIds.length === 0 ? '⚠️ Please select at least one district' : `✅ ${selectedRegionIds.length} district(s) selected for SMS & hazard alerts`}
                </div>
              </div>

              <div>
                <label className="font-bold text-on-surface mb-1 block">Create Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-9 px-3 bg-surface-container-low border border-outline-variant/40 rounded focus:outline-none focus:border-primary text-xs"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 h-9 bg-primary hover:bg-primary-container text-white font-bold rounded flex items-center justify-center gap-1.5 transition-colors shadow-sm"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>{loading ? 'Creating Account...' : 'Register Citizen Account'}</span>
              </button>
            </form>
          )}

          {/* TAB 3: INITIAL ADMIN SETUP */}
          {activeTab === 'setup-admin' && (
            <form onSubmit={handleSetupAdminSubmit} className="flex flex-col gap-3">
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded text-amber-900 leading-snug">
                <strong>Enforced Singleton Policy:</strong> Exactly one active Administrator account is permitted in BhoomiRakshak. If an admin already exists, this creation will be rejected.
              </div>

              <div>
                <label className="font-bold text-on-surface mb-1 block">Administrator Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Dr. P. Sharma (Chief Hydro-Geologist)"
                  className="w-full h-9 px-3 bg-surface-container-low border border-outline-variant/40 rounded focus:outline-none focus:border-primary text-xs"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-on-surface mb-1 block">Official Admin Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="admin@bhoomirakshak.gov.in"
                  className="w-full h-9 px-3 bg-surface-container-low border border-outline-variant/40 rounded focus:outline-none focus:border-primary text-xs"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-on-surface mb-1 block">Official Phone</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+91 98765 00000"
                  className="w-full h-9 px-3 bg-surface-container-low border border-outline-variant/40 rounded focus:outline-none focus:border-primary font-mono text-xs"
                />
              </div>

              <div>
                <label className="font-bold text-on-surface mb-1 block">Admin Master Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-9 px-3 bg-surface-container-low border border-outline-variant/40 rounded focus:outline-none focus:border-primary text-xs"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 h-9 bg-rose-700 hover:bg-rose-800 text-white font-bold rounded flex items-center justify-center gap-1.5 transition-colors shadow-sm"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>{loading ? 'Provisioning...' : 'Bootstrap Administrator Account'}</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
