import React, { useState, useEffect } from 'react';
import { 
  Phone, 
  ShieldCheck, 
  AlertCircle, 
  CheckCircle2, 
  Send, 
  KeyRound, 
  Bell, 
  BellOff, 
  RefreshCw, 
  Check, 
  Sparkles,
  Smartphone
} from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

export default function SmsVerificationCard({ onStatusChange }) {
  const { user } = useAuth();

  const [phone, setPhone] = useState(user?.phone || '');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [isVerified, setIsVerified] = useState(Boolean(user?.phone_verified));
  const [smsEnabled, setSmsEnabled] = useState(Boolean(user?.sms_enabled));

  // Sync with auth user updates
  useEffect(() => {
    if (user) {
      if (user.phone && !phone) setPhone(user.phone);
      setIsVerified(Boolean(user.phone_verified));
      setSmsEnabled(Boolean(user.sms_enabled));
    }
  }, [user]);

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown(c => Math.max(0, c - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Compute honest status
  const getStatusBadge = () => {
    if (!phone && !isVerified) {
      return {
        label: 'Not registered',
        className: 'bg-slate-100 text-slate-700 border-slate-300'
      };
    }
    if (phone && !isVerified) {
      return {
        label: 'Pending verification',
        className: 'bg-amber-50 text-amber-800 border-amber-300'
      };
    }
    if (isVerified && smsEnabled) {
      return {
        label: 'Active — SMS alerts on',
        className: 'bg-emerald-50 text-emerald-800 border-emerald-300'
      };
    }
    if (isVerified && !smsEnabled) {
      return {
        label: 'Verified but paused',
        className: 'bg-sky-50 text-sky-800 border-sky-300'
      };
    }
    return {
      label: 'Not registered',
      className: 'bg-slate-100 text-slate-700 border-slate-300'
    };
  };

  const statusInfo = getStatusBadge();

  // Send 6-digit OTP via MSG91
  const handleSendOtp = async (e) => {
    if (e) e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!phone || phone.replace(/\D/g, '').length < 10) {
      setErrorMsg('Please enter a valid 10-digit mobile phone number.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.sendOtp(phone);
      setOtpSent(true);
      setCooldown(60); // 60-second cooldown before resend
      if (res.dev_otp) {
        setOtp(res.dev_otp);
        setSuccessMsg(`OTP sent to +${res.phone || phone}. [Auto-filled Code: ${res.dev_otp}]`);
      } else {
        setSuccessMsg(`OTP sent successfully to ${res.phone || phone}. Please enter the 6-digit code.`);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to send verification OTP.');
    } finally {
      setLoading(false);
    }
  };

  // Verify entered OTP
  const handleVerifyOtp = async (e) => {
    if (e) e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!otp || otp.trim().length !== 6) {
      setErrorMsg('Please enter the complete 6-digit OTP code.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.verifyOtp(phone, otp.trim());
      setIsVerified(true);
      setSmsEnabled(true);
      setOtpSent(false);
      setOtp('');
      setSuccessMsg(res.message || `SMS alerts enabled for +${res.phone || phone}`);
      if (onStatusChange) onStatusChange({ verified: true, sms_enabled: true });
    } catch (err) {
      setErrorMsg(err.message || 'Verification failed. Please check the code.');
    } finally {
      setLoading(false);
    }
  };

  // Toggle SMS subscription after verification
  const handleToggleSms = async () => {
    if (!isVerified) {
      setErrorMsg('Phone verification is required before SMS alerts can be activated.');
      return;
    }

    setErrorMsg('');
    setSuccessMsg('');
    setToggling(true);

    const nextState = !smsEnabled;
    try {
      const res = await api.updateNotificationPreferences({ sms_enabled: nextState });
      setSmsEnabled(nextState);
      setSuccessMsg(
        nextState 
          ? `Emergency SMS alerts resumed for +${phone}` 
          : 'Emergency SMS alerts paused. You can resume anytime without re-verifying.'
      );
      if (onStatusChange) onStatusChange({ verified: true, sms_enabled: nextState });
    } catch (err) {
      setErrorMsg(err.message || 'Failed to update alert preferences.');
    } finally {
      setToggling(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-outline-variant/40 p-5 shadow-sm">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-outline-variant/30 pb-3 mb-4 gap-2">
        <div className="flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-primary" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface">
            Emergency SMS Dispatch Gateway
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-on-surface-variant font-medium">Status:</span>
          <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${statusInfo.className}`}>
            {statusInfo.label}
          </span>
        </div>
      </div>

      <p className="text-xs text-on-surface-variant mb-4 leading-relaxed">
        Disaster sentinel broadcasts critical landslide warnings, rainfall saturation alerts, and evacuation protocols directly to your verified phone number via MSG91 priority carrier routing.
      </p>

      {/* Error & Success Feedback alerts */}
      {errorMsg && (
        <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded font-medium flex items-center gap-2 animate-in fade-in duration-200">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded font-medium flex items-center gap-2 animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Case 1: Phone is verified -> Show registered phone + toggle */}
      {isVerified ? (
        <div className="space-y-4">
          <div className="p-3.5 bg-surface-container-low rounded-lg border border-outline-variant/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-on-surface">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Verified Mobile:</span>
                <span className="font-mono text-emerald-900 bg-emerald-100/70 px-2 py-0.5 rounded">
                  +{phone}
                </span>
              </div>
              <p className="text-[11px] text-on-surface-variant mt-1">
                {smsEnabled 
                  ? 'Your number is active in the district emergency broadcast directory.' 
                  : 'Alerts are currently paused. Click resume to restore live SMS warnings.'}
              </p>
            </div>

            {/* Toggle button */}
            <button
              onClick={handleToggleSms}
              disabled={toggling}
              className={`px-4 py-2 rounded text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm shrink-0 ${
                smsEnabled
                  ? 'bg-amber-600 hover:bg-amber-700 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              {toggling ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : smsEnabled ? (
                <BellOff className="w-3.5 h-3.5" />
              ) : (
                <Bell className="w-3.5 h-3.5" />
              )}
              <span>{smsEnabled ? 'Pause SMS Alerts' : 'Resume SMS Alerts'}</span>
            </button>
          </div>

          <div className="flex items-center justify-between text-[11px] text-on-surface-variant pt-1 border-t border-outline-variant/20">
            <span>Want to link a different mobile number?</span>
            <button
              onClick={() => {
                setIsVerified(false);
                setOtpSent(false);
                setOtp('');
              }}
              className="text-primary hover:underline font-semibold"
            >
              Update Phone Number
            </button>
          </div>
        </div>
      ) : (
        /* Case 2: Not verified yet -> Phone input + OTP flow */
        <div className="space-y-3">
          <form onSubmit={handleSendOtp} className="flex flex-col sm:flex-row items-center gap-2.5">
            <div className="relative w-full sm:flex-1">
              <Phone className="w-4 h-4 text-on-surface-variant absolute left-3 top-3" />
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                disabled={otpSent && cooldown > 0}
                className="h-10 pl-9 pr-3 bg-surface-container-low border border-outline-variant/40 rounded text-xs w-full focus:outline-none focus:border-primary font-mono"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading || (otpSent && cooldown > 0)}
              className="w-full sm:w-auto h-10 px-4 bg-primary hover:bg-primary-container text-white text-xs font-bold rounded flex items-center justify-center gap-1.5 shadow-sm transition-colors shrink-0 disabled:opacity-50"
            >
              {loading && !otpSent ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              <span>
                {otpSent 
                  ? (cooldown > 0 ? `Resend OTP (${cooldown}s)` : 'Resend OTP') 
                  : 'Send OTP'}
              </span>
            </button>
          </form>

          {/* 6-digit OTP verification box */}
          {otpSent && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg animate-in slide-in-from-top-2 duration-200 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                <KeyRound className="w-4 h-4 text-primary" />
                <span>Enter 6-Digit SMS Verification Code:</span>
              </div>

              <form onSubmit={handleVerifyOtp} className="flex flex-col sm:flex-row items-center gap-2.5">
                <input
                  type="text"
                  maxLength={6}
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  className="h-10 px-4 text-center tracking-widest text-base font-bold font-mono bg-white border border-slate-300 rounded w-full sm:w-48 focus:outline-none focus:border-primary"
                  required
                  autoFocus
                />

                <button
                  type="submit"
                  disabled={loading || otp.length !== 6}
                  className="w-full sm:w-auto h-10 px-5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded flex items-center justify-center gap-1.5 shadow-sm transition-colors disabled:opacity-50 shrink-0"
                >
                  {loading ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  <span>Verify & Activate SMS Alerts</span>
                </button>
              </form>

              <div className="text-[11px] text-slate-500 flex items-center justify-between">
                <span>Didn't receive SMS? Carrier routing may take up to 30 seconds.</span>
                {cooldown > 0 && (
                  <span className="font-mono text-slate-600 font-semibold">
                    Resend available in {cooldown}s
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
