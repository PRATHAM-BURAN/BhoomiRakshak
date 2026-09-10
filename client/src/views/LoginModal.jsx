import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShieldAlert, 
  LogIn, 
  UserPlus, 
  X, 
  Lock, 
  Mail, 
  Phone, 
  User, 
  MapPin, 
  CheckCircle2, 
  KeyRound,
  ArrowRight,
  ChevronDown,
  Send
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';

// Default 8 Northeast Indian corridors guaranteed to be available even if backend load is delayed
const DEFAULT_NER_REGIONS = [
  { id: "ad2a2d14-f0c0-42eb-ac4a-23a7a42abcf5", district: "Dima Hasao", state: "Assam", name: "Lumding-Haflong-Badarpur NH-27 Corridor" },
  { id: "b0000002-0000-0000-0000-000000000002", district: "Papum Pare", state: "Arunachal Pradesh", name: "Papum Pare Foothills NH-415 Corridor" },
  { id: "b0000003-0000-0000-0000-000000000003", district: "North Sikkim", state: "Sikkim", name: "Mangan-Gangtok Teesta Valley NH-10 Corridor" },
  { id: "b0000004-0000-0000-0000-000000000004", district: "East Khasi Hills", state: "Meghalaya", name: "Shillong-Cherrapunji Escarpment NH-6 Corridor" },
  { id: "b0000005-0000-0000-0000-000000000005", district: "Aizawl", state: "Mizoram", name: "Aizawl North - Durtlang Ridge NH-54 Corridor" },
  { id: "b0000006-0000-0000-0000-000000000006", district: "Kohima", state: "Nagaland", name: "Dimapur-Kohima Range NH-29 Corridor" },
  { id: "b0000007-0000-0000-0000-000000000007", district: "Senapati", state: "Manipur", name: "Senapati-Imphal Valley NH-2 Corridor" },
  { id: "b0000008-0000-0000-0000-000000000008", district: "Dhalai", state: "Tripura", name: "Ambassa-Manu Hill Ranges NH-8 Corridor" }
];

export default function LoginModal({ isOpen, onClose, regions = [] }) {
  const { login, loginOtp, setupAdmin, registerCitizen } = useAuth();
  const [activeTab, setActiveTab] = useState('login'); // 'login' | 'setup-admin' | 'citizen-register'
  const [loginMode, setLoginMode] = useState('password'); // 'password' | 'otp'

  // Determine active region list (fallback to standard 8 NER regions if regions prop is empty)
  const availableRegions = useMemo(() => {
    return (regions && regions.length > 0) ? regions : DEFAULT_NER_REGIONS;
  }, [regions]);

  // Login inputs (Password)
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  // Login inputs (OTP)
  const [otpPhone, setOtpPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0);

  // Setup / Register inputs
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');
  
  // District selector states
  const [selectedDropdown, setSelectedDropdown] = useState('ALL');
  const [selectedRegionIds, setSelectedRegionIds] = useState(() => availableRegions.map(r => r.id));

  const toggleRegion = (id) => {
    setSelectedRegionIds(prev => {
      const next = prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id];
      if (next.length === availableRegions.length) {
        setSelectedDropdown('ALL');
      } else if (next.length === 1) {
        setSelectedDropdown(next[0]);
      } else {
        setSelectedDropdown('CUSTOM');
      }
      return next;
    });
  };

  const handleDropdownChange = (val) => {
    setSelectedDropdown(val);
    if (val === 'ALL') {
      setSelectedRegionIds(availableRegions.map(r => r.id));
    } else {
      setSelectedRegionIds([val]);
    }
  };

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (otpCooldown > 0) {
      const timer = setTimeout(() => setOtpCooldown(prev => prev - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [otpCooldown]);

  const handleSendLoginOtp = async (e) => {
    if (e) e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    const raw = otpPhone.replace(/\D/g, '');
    if (raw.length < 10) {
      setErrorMsg('Please enter a valid 10-digit mobile number.');
      return;
    }
    setLoading(true);
    try {
      const res = await api.sendOtp(otpPhone);
      setOtpSent(true);
      setOtpCooldown(60);
      setSuccessMsg(`OTP sent to +${res.phone || otpPhone}. Valid for 5 minutes.`);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to dispatch verification OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyLoginOtp = async (e) => {
    if (e) e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    if (!otpCode || otpCode.trim().length !== 6) {
      setErrorMsg('Please enter the complete 6-digit OTP code.');
      return;
    }
    setLoading(true);
    try {
      await loginOtp(otpPhone, otpCode.trim());
      setSuccessMsg('Authentication successful!');
      setTimeout(() => onClose(), 400);
    } catch (err) {
      setErrorMsg(err.message || 'Verification failed. Please check the OTP code.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);
    try {
      await login(identifier.trim(), password);
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Authentication failed. Please check your credentials.');
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
        email: email.trim(),
        phone: phone.trim() || undefined,
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

    // Fallback: If no districts selected, default to all available NER districts
    const finalRegions = selectedRegionIds.length > 0 ? selectedRegionIds : availableRegions.map(r => r.id);

    setLoading(true);
    try {
      await registerCitizen({
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        password: newPassword,
        region_ids: finalRegions,
        region_id: finalRegions[0]
      });
      setSuccessMsg(`Citizen account created with ${finalRegions.length} monitored district(s).`);
      setTimeout(() => onClose(), 700);
    } catch (err) {
      setErrorMsg(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  // Helper to prefill official administrator credentials
  const fillAdminCredentials = () => {
    setIdentifier('admin@bhoomirakshak.gov.in');
    setPassword('AdminPassword2026!');
    setErrorMsg('');
  };

  return (
    <div className="fixed inset-0 bg-primary/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl border border-outline-variant/40 max-w-md w-full overflow-hidden flex flex-col text-xs animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 bg-primary text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-emerald-400" />
            <div>
              <div className="font-bold text-sm tracking-tight leading-none">
                BhoomiRakshak Identity Gateway
              </div>
              <div className="text-[10px] text-white/75 mt-0.5 font-medium">
                National Landslide Early Warning & Disaster Defense System
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/10 rounded transition-colors text-white"
            title="Close"
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
            Administrator
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4 max-h-[82vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded font-semibold leading-relaxed text-xs">
              <div>{errorMsg}</div>
              {errorMsg.toLowerCase().includes('already registered') && (
                <button
                  type="button"
                  onClick={() => { setActiveTab('login'); setErrorMsg(''); }}
                  className="mt-1.5 text-[11px] font-bold text-primary underline flex items-center gap-1 hover:text-primary-container"
                >
                  <span>Click here to sign in with this account</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* TAB 1: LOGIN */}
          {activeTab === 'login' && (
            <div className="flex flex-col gap-3">
              {/* Method Switcher: Password vs SMS OTP */}
              <div className="flex bg-surface-container-low p-1 rounded border border-outline-variant/30 text-xs">
                <button
                  type="button"
                  onClick={() => { setLoginMode('password'); setErrorMsg(''); setSuccessMsg(''); }}
                  className={`flex-1 py-1 text-center font-bold rounded transition-colors ${loginMode === 'password' ? 'bg-white text-primary shadow-xs' : 'text-on-surface-variant hover:text-on-surface'}`}
                >
                  Password Login
                </button>
                <button
                  type="button"
                  onClick={() => { setLoginMode('otp'); setErrorMsg(''); setSuccessMsg(''); }}
                  className={`flex-1 py-1 text-center font-bold rounded transition-colors ${loginMode === 'otp' ? 'bg-white text-primary shadow-xs' : 'text-on-surface-variant hover:text-on-surface'}`}
                >
                  Mobile SMS OTP
                </button>
              </div>

              {loginMode === 'password' ? (
                <form onSubmit={handleLoginSubmit} className="flex flex-col gap-3">
                  <div>
                    <label className="font-bold text-on-surface mb-1 block">Email or Mobile Number</label>
                    <div className="relative flex items-center">
                      <Mail className="w-3.5 h-3.5 absolute left-3 text-on-surface-variant" />
                      <input
                        type="text"
                        value={identifier}
                        onChange={e => setIdentifier(e.target.value)}
                        placeholder="admin@bhoomirakshak.gov.in or 9876543210"
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
                    className="w-full mt-1 h-9 bg-primary hover:bg-primary-container text-white font-bold rounded flex items-center justify-center gap-1.5 transition-colors shadow-sm text-xs"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>{loading ? 'Authenticating...' : 'Sign In to BhoomiRakshak'}</span>
                  </button>

                  {/* Quick Fill Demo Admin Button */}
                  <div className="mt-1 p-2.5 bg-surface-container-low border border-outline-variant/30 rounded flex items-center justify-between">
                    <div>
                      <div className="font-bold text-[11px] text-on-surface flex items-center gap-1">
                        <KeyRound className="w-3 h-3 text-primary" />
                        <span>Testing / Demo Clearance</span>
                      </div>
                      <div className="text-[10px] text-on-surface-variant">
                        Master Administrator Account (Pre-configured)
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={fillAdminCredentials}
                      className="px-2.5 py-1 bg-white border border-outline-variant/40 hover:border-primary text-primary font-bold rounded text-[11px] transition-colors shadow-xs"
                    >
                      Quick Fill Admin
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex flex-col gap-3">
                  <div>
                    <label className="font-bold text-on-surface mb-1 block">Mobile Number (India / NER)</label>
                    <div className="relative flex items-center">
                      <Phone className="w-3.5 h-3.5 absolute left-3 text-on-surface-variant" />
                      <input
                        type="tel"
                        value={otpPhone}
                        onChange={e => setOtpPhone(e.target.value)}
                        placeholder="e.g. 9021158105"
                        className="w-full h-9 pl-9 pr-3 bg-surface-container-low border border-outline-variant/40 rounded focus:outline-none focus:border-primary font-mono text-xs"
                        required
                      />
                    </div>
                  </div>

                  {!otpSent ? (
                    <button
                      type="button"
                      onClick={handleSendLoginOtp}
                      disabled={loading}
                      className="w-full h-9 bg-primary hover:bg-primary-container text-white font-bold rounded flex items-center justify-center gap-1.5 transition-colors shadow-sm text-xs"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{loading ? 'Dispatching OTP...' : 'Send 6-Digit Verification Code'}</span>
                    </button>
                  ) : (
                    <div className="flex flex-col gap-2.5">
                      <div>
                        <label className="font-bold text-on-surface mb-1 block">Enter 6-Digit OTP</label>
                        <input
                          type="text"
                          maxLength={6}
                          value={otpCode}
                          onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))}
                          placeholder="123456"
                          className="w-full h-9 px-3 bg-surface-container-low border border-outline-variant/40 rounded focus:outline-none focus:border-primary font-mono text-center tracking-widest text-sm font-bold"
                          autoFocus
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleVerifyLoginOtp}
                          disabled={loading || otpCode.length !== 6}
                          className="flex-1 h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded flex items-center justify-center gap-1.5 transition-colors text-xs disabled:opacity-50"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{loading ? 'Verifying...' : 'Verify OTP & Sign In'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleSendLoginOtp}
                          disabled={loading || otpCooldown > 0}
                          className="px-3 h-9 bg-white border border-outline-variant/40 hover:border-primary text-primary font-bold rounded text-xs transition-colors disabled:opacity-50"
                        >
                          {otpCooldown > 0 ? `${otpCooldown}s` : 'Resend'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* QA Test Mode Quick Fill Numbers */}
                  <div className="mt-1 p-2.5 bg-amber-50 border border-amber-200 rounded flex flex-col gap-1.5">
                    <div className="font-bold text-[11px] text-amber-900 flex items-center gap-1">
                      <KeyRound className="w-3 h-3 text-amber-700" />
                      <span>QA Test Numbers (Real Device Verification)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => { setOtpPhone('9021158105'); setOtpSent(false); setOtpCode(''); }}
                        className="flex-1 py-1 bg-white border border-amber-300 hover:bg-amber-100 text-amber-950 font-bold rounded text-[10px] transition-colors"
                      >
                        Admin: 9021158105
                      </button>
                      <button
                        type="button"
                        onClick={() => { setOtpPhone('9067372943'); setOtpSent(false); setOtpCode(''); }}
                        className="flex-1 py-1 bg-white border border-amber-300 hover:bg-amber-100 text-amber-950 font-bold rounded text-[10px] transition-colors"
                      >
                        Officer: 9067372943
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
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
                  placeholder="e.g. Kailas Sharma"
                  className="w-full h-9 px-3 bg-surface-container-low border border-outline-variant/40 rounded focus:outline-none focus:border-primary text-xs"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-on-surface mb-1 block">Mobile Phone Number (for SMS Early Warnings)</label>
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

              {/* District Dropdown & Multi-Select Option */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-on-surface flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-primary" />
                    <span>Home District / Alert Corridor</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedRegionIds.length === availableRegions.length) {
                        setSelectedRegionIds([availableRegions[0].id]);
                        setSelectedDropdown(availableRegions[0].id);
                      } else {
                        setSelectedRegionIds(availableRegions.map(r => r.id));
                        setSelectedDropdown('ALL');
                      }
                    }}
                    className="text-[10px] text-primary font-bold hover:underline"
                  >
                    {selectedRegionIds.length === availableRegions.length ? 'Single District' : 'Select All 8 States'}
                  </button>
                </div>

                {/* Dropdown Select (Requested: Add drop list option) */}
                <div className="relative">
                  <select
                    value={selectedDropdown}
                    onChange={(e) => handleDropdownChange(e.target.value)}
                    className="w-full h-9 pl-3 pr-8 bg-surface-container-low border border-outline-variant/40 rounded focus:outline-none focus:border-primary text-xs font-medium text-on-surface cursor-pointer appearance-none"
                  >
                    <option value="ALL">🌐 All 8 Northeast States (Full Regional Coverage — Recommended)</option>
                    {availableRegions.map(r => (
                      <option key={r.id} value={r.id}>
                        📍 {r.district} ({r.state}) — {r.name || 'Hazard Corridor'}
                      </option>
                    ))}
                    {selectedDropdown === 'CUSTOM' && (
                      <option value="CUSTOM">Custom Multi-District Selection ({selectedRegionIds.length} districts)</option>
                    )}
                  </select>
                  <ChevronDown className="w-4 h-4 absolute right-2.5 top-2.5 text-on-surface-variant pointer-events-none" />
                </div>

                {/* District Badges for quick custom toggles */}
                <div className="mt-2 flex flex-wrap gap-1 max-h-24 overflow-y-auto p-1.5 bg-surface-container-low border border-outline-variant/30 rounded">
                  {availableRegions.map(r => {
                    const isSelected = selectedRegionIds.includes(r.id);
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => toggleRegion(r.id)}
                        className={`px-2 py-1 rounded text-[10px] font-semibold transition-all border flex items-center gap-1 ${
                          isSelected
                            ? 'bg-primary text-white border-primary shadow-xs'
                            : 'bg-white text-on-surface-variant border-outline-variant/30 hover:border-primary/40'
                        }`}
                      >
                        <span>{r.district}</span>
                        <span className="text-[8px] opacity-75 font-mono">({r.state.slice(0, 3)})</span>
                      </button>
                    );
                  })}
                </div>
                <div className="text-[10px] text-on-surface-variant mt-1 font-medium flex items-center justify-between">
                  <span>✅ {selectedRegionIds.length} district corridor(s) actively monitored</span>
                  <span className="text-emerald-700 font-semibold text-[9px]">Early Warning Active</span>
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

          {/* TAB 3: ADMINISTRATOR STATUS & SETUP */}
          {activeTab === 'setup-admin' && (
            <div className="flex flex-col gap-3">
              {/* Administrator Status Card */}
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-emerald-900 leading-snug flex flex-col gap-2">
                <div className="flex items-center gap-1.5 font-bold text-xs text-emerald-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Administrator Account Is Active</span>
                </div>
                <p className="text-[11px] text-emerald-800">
                  The primary central administrator is already provisioned and operational in the system database under the singleton security policy.
                </p>
                <div className="bg-white/80 p-2 rounded border border-emerald-200/80 font-mono text-[11px] space-y-1">
                  <div><strong className="text-emerald-950 font-sans">Official Email:</strong> admin@bhoomirakshak.gov.in</div>
                  <div><strong className="text-emerald-950 font-sans">Clearance:</strong> Full Command Deck & AI Sentinel</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    fillAdminCredentials();
                    setActiveTab('login');
                  }}
                  className="mt-1 h-8 bg-primary hover:bg-primary-container text-white font-bold rounded flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Go to Account Login (Auto-Fill Admin)</span>
                </button>
              </div>

              <div className="border-t border-outline-variant/30 pt-3">
                <details className="text-[11px] text-on-surface-variant cursor-pointer group">
                  <summary className="font-bold text-on-surface hover:text-primary transition-colors select-none">
                    Initial Bootstrap Settings (Advanced)
                  </summary>
                  <form onSubmit={handleSetupAdminSubmit} className="flex flex-col gap-2.5 mt-2.5">
                    <div>
                      <label className="font-bold text-on-surface mb-0.5 block">Administrator Name</label>
                      <input
                        type="text"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="Dr. P. Sharma (Chief Hydro-Geologist)"
                        className="w-full h-8 px-2.5 bg-surface-container-low border border-outline-variant/40 rounded focus:outline-none focus:border-primary text-xs"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-on-surface mb-0.5 block">Official Admin Email</label>
                      <input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="admin@bhoomirakshak.gov.in"
                        className="w-full h-8 px-2.5 bg-surface-container-low border border-outline-variant/40 rounded focus:outline-none focus:border-primary text-xs"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-on-surface mb-0.5 block">Official Phone</label>
                      <input
                        type="tel"
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        placeholder="+91 98765 00000"
                        className="w-full h-8 px-2.5 bg-surface-container-low border border-outline-variant/40 rounded focus:outline-none focus:border-primary font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-on-surface mb-0.5 block">Admin Master Password</label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full h-8 px-2.5 bg-surface-container-low border border-outline-variant/40 rounded focus:outline-none focus:border-primary text-xs"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full mt-1 h-8 bg-rose-700 hover:bg-rose-800 text-white font-bold rounded flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                    >
                      <ShieldAlert className="w-3.5 h-3.5" />
                      <span>{loading ? 'Provisioning...' : 'Provision Administrator'}</span>
                    </button>
                  </form>
                </details>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
