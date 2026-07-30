'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Lock, User, Mail, ShieldCheck, Key, ArrowLeft, CheckCircle2, Bell, RefreshCw, Phone, Smartphone, MessageSquare } from 'lucide-react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';

const maskPhone = (phone: string) => {
  if (!phone) return '•••• ••• ••••';
  const clean = String(phone).trim();
  if (clean.length <= 4) return '••••';
  const last4 = clean.slice(-4);
  const start = clean.startsWith('+') ? clean.slice(0, 3) : '';
  return `${start} ••• ••• ${last4}`.trim();
};

export default function LoginPage() {
  const router = useRouter();
  
  // Navigation steps: 'credentials' -> '2fa'
  const [step, setStep] = useState<'credentials' | '2fa'>('credentials');
  
  // Credentials state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  // 2FA state
  const [otpCode, setOtpCode] = useState('');
  const [pendingUser, setPendingUser] = useState<any>(null);
  const [resendTimer, setResendTimer] = useState(0);
  const [successMsg, setSuccessMsg] = useState('');
  
  // UI state
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const startTwoStepVerification = (user: any) => {
    setPendingUser(user);
    setOtpCode('');
    setError('');
    setSuccessMsg('');
    setStep('2fa');
    setLoading(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // 1. Strictly route through secure backend API (enforces rate limits & generates server-side OTP)
      const res = await apiClient.post('/telemetry/auth/login', {
        username: username.trim(),
        password: password,
      });

      if (res.data && res.data.success && res.data.user) {
        startTwoStepVerification(res.data.user);
        return;
      } else if (res.data && !res.data.success && res.data.message) {
        setError(res.data.message);
        setLoading(false);
        return;
      }
    } catch (backendErr: any) {
      console.error("Backend auth API check failed:", backendErr);
      setError('Unable to connect to authentication server. Please check your network connection.');
      setLoading(false);
      return;
    }

    setError('Invalid email/username or credentials.');
    setLoading(false);
  };

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      const targetIdentifier = pendingUser?.email || pendingUser?.username || username;
      const res = await apiClient.post('/telemetry/auth/verify-otp', {
        emailOrUsername: targetIdentifier,
        code: otpCode.trim()
      });

      if (res.data && res.data.success && res.data.user) {
        if (typeof window !== 'undefined') {
          // Store session with secure token and 24h expiration timestamp
          const sessionData = {
            ...res.data.user,
            token: res.data.token,
            sessionExpiresAt: res.data.sessionExpiresAt || (Date.now() + 24 * 60 * 60 * 1000)
          };
          localStorage.setItem('userAccount', JSON.stringify(sessionData));
        }
        router.push('/dashboard');
        return;
      } else {
        setError(res.data?.message || 'Invalid verification code.');
        setLoading(false);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Verification failed. Please try again.');
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (resendTimer > 0) return;
    setError('');
    setSuccessMsg('');
    setResendTimer(30);

    const interval = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    try {
      const targetIdentifier = pendingUser?.email || pendingUser?.username || username;
      const res = await apiClient.post('/telemetry/auth/resend-otp', {
        emailOrUsername: targetIdentifier
      });

      if (res.data && res.data.success) {
        setSuccessMsg(res.data.message || 'New code sent to WhatsApp / SMS!');
      } else {
        setError(res.data?.message || 'Failed to resend code.');
      }
    } catch (err: any) {
      setError('Unable to resend code. Please check your connection.');
    }
  };

  return (
    <div className="relative flex h-screen w-full items-center justify-center overflow-hidden font-sans">
      
      {/* Background Image */}
      <img 
        src="/welcome-banner.png" 
        alt="Smart Agriculture" 
        className="absolute inset-0 w-full h-full object-cover scale-105 filter blur-sm"
      />

      {/* Deep Gradient Overlays */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" />

      {/* Login Card */}
      <div className="relative z-10 w-full max-w-md px-8 py-10 mx-4 rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.36)] flex flex-col animate-fade-in">
        
        {step === 'credentials' ? (
          /* STEP 1: CREDENTIALS */
          <>
            <div className="flex flex-col items-center mb-10">
              <Link href="/">
                <div className="w-16 h-16 rounded-2xl shadow-[0_0_20px_rgba(255,255,255,0.1)] bg-white p-1 mb-6 ring-1 ring-white/20 transition-transform hover:scale-105 cursor-pointer">
                  <img src="/logo.jpg" alt="AgriBot Logo" className="w-full h-full object-contain rounded-xl" />
                </div>
              </Link>
              <h1 className="text-2xl font-bold text-white tracking-tight">Welcome Back</h1>
              <p className="text-sm text-slate-300 mt-2">Log in to your AgriBot dashboard</p>
            </div>

            <form onSubmit={handleLogin} className="flex flex-col gap-5">
              <div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full pl-11 pr-4 py-3.5 bg-black/20 border border-white/10 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50 transition-all"
                    placeholder="Email Address or Username"
                    required
                  />
                </div>
              </div>

              <div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-11 pr-4 py-3.5 bg-black/20 border border-white/10 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50 transition-all"
                    placeholder="Password"
                    required
                  />
                </div>
              </div>

              {error && (
                <div className="text-red-400 text-sm text-center font-medium bg-red-400/10 py-2.5 px-3 rounded-lg border border-red-400/20">
                  {error}
                </div>
              )}

              <button 
                type="submit" 
                disabled={loading}
                className="group w-full mt-2 flex items-center justify-center gap-2 bg-green-500 hover:bg-green-400 text-slate-900 font-bold py-3.5 px-4 rounded-xl transition-all duration-300 shadow-[0_0_30px_rgba(34,197,94,0.3)] hover:shadow-[0_0_50px_rgba(34,197,94,0.5)] disabled:opacity-70 disabled:cursor-not-allowed"
              >
                <span>{loading ? 'Verifying Credentials...' : 'Sign In'}</span>
                {!loading && <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />}
              </button>
            </form>

            <div className="mt-8 text-center text-xs text-white/40 bg-white/5 p-3 rounded-xl border border-white/5">
              Secure database authentication via <strong>user_accounts</strong> table.<br/>
              Protected with Two-Step Verification.
            </div>
          </>
        ) : (
          /* STEP 2: TWO-STEP VERIFICATION (2FA) */
          <>
            <div className="flex flex-col items-center mb-6">
              <div className="w-16 h-16 rounded-2xl bg-green-500/10 border border-green-500/30 flex items-center justify-center mb-4 shadow-[0_0_30px_rgba(34,197,94,0.2)]">
                <Smartphone className="w-8 h-8 text-green-400 animate-pulse" />
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Two-Step Verification</h1>
              <p className="text-sm text-slate-300 mt-2 text-center">
                We dispatched a WhatsApp / SMS security code to your registered mobile phone: <strong className="text-green-400 font-medium block mt-0.5">{maskPhone(pendingUser?.phone || pendingUser?.phone_number || '+1 (555) 382-9102')}</strong>
              </p>
            </div>

            {/* VIRTUAL SMARTPHONE WHATSAPP / SMS NOTIFICATION BANNER */}
            <div className="mb-6 p-4 bg-slate-900/90 border border-green-500/40 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.5)] flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs text-slate-400 border-b border-white/10 pb-2">
                <div className="flex items-center gap-1.5 text-green-400 font-semibold uppercase tracking-wider text-[11px]">
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>WHATSAPP & SMS • JUST NOW ({maskPhone(pendingUser?.phone || pendingUser?.phone_number || '+1 (555) 382-9102')})</span>
                </div>
                <span className="text-[10px] bg-green-500/20 text-green-300 px-2 py-0.5 rounded-full font-medium">Delivered</span>
              </div>
              <div className="text-xs text-slate-200 pl-0.5 font-sans leading-relaxed">
                <span className="font-bold text-white">AgriBot Security:</span> A 6-digit verification code has been dispatched to your mobile device via <strong className="text-green-400 font-medium">WhatsApp / SMS</strong>. Please open your messaging app to retrieve your code.
              </div>
            </div>

            <form onSubmit={handleVerify2FA} className="flex flex-col gap-5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 text-center">
                  Enter 6-Digit Code
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Key className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                    className="w-full pl-11 pr-4 py-3.5 bg-black/30 border border-white/20 rounded-xl text-white font-mono text-xl tracking-[0.4em] text-center placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500 transition-all"
                    placeholder="••••••"
                    autoFocus
                    required
                  />
                </div>
              </div>

              {error && (
                <div className="text-red-400 text-sm text-center font-medium bg-red-400/10 py-2.5 px-3 rounded-lg border border-red-400/20">
                  {error}
                </div>
              )}

              {successMsg && (
                <div className="text-green-400 text-sm text-center font-medium bg-green-400/10 py-2.5 px-3 rounded-lg border border-green-400/20">
                  {successMsg}
                </div>
              )}

              <button 
                type="submit" 
                disabled={loading || otpCode.length < 6}
                className="group w-full mt-2 flex items-center justify-center gap-2 bg-green-500 hover:bg-green-400 text-slate-900 font-bold py-3.5 px-4 rounded-xl transition-all duration-300 shadow-[0_0_30px_rgba(34,197,94,0.3)] hover:shadow-[0_0_50px_rgba(34,197,94,0.5)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>{loading ? 'Verifying Code...' : 'Verify & Access Dashboard'}</span>
                {!loading && <CheckCircle2 className="w-5 h-5 transition-transform group-hover:scale-110" />}
              </button>
            </form>

            <div className="mt-6 flex items-center justify-between text-xs text-slate-400 px-1">
              <button
                type="button"
                onClick={() => { setStep('credentials'); setError(''); }}
                className="flex items-center gap-1.5 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Sign In</span>
              </button>

              <button
                type="button"
                onClick={handleResendCode}
                disabled={resendTimer > 0}
                className="flex items-center gap-1.5 text-green-400 hover:text-green-300 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${resendTimer > 0 ? 'animate-spin' : ''}`} />
                <span>{resendTimer > 0 ? `Resend Code (${resendTimer}s)` : 'Resend Code'}</span>
              </button>
            </div>
          </>
        )}

      </div>

    </div>
  );
}
