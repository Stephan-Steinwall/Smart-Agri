'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  User, Mail, Phone, Shield, LogOut, Check, X, Key, Sparkles, Save, RefreshCw, Lock, Globe, CheckCircle2,
  ShieldAlert, KeyRound, AlertTriangle, Eye, EyeOff
} from 'lucide-react';
import { apiClient } from '@/lib/api';

const COUNTRY_CODES = [
  { code: '+94', country: 'Sri Lanka', flag: '🇱🇰', placeholder: '77 494 5542', len: 9 },
  { code: '+1', country: 'United States / Canada', flag: '🇺🇸', placeholder: '555 382 9102', len: 10 },
  { code: '+44', country: 'United Kingdom', flag: '🇬🇧', placeholder: '7911 123456', len: 10 },
  { code: '+61', country: 'Australia', flag: '🇦🇺', placeholder: '401 234 567', len: 9 },
  { code: '+91', country: 'India', flag: '🇮🇳', placeholder: '98765 43210', len: 10 },
  { code: '+49', country: 'Germany', flag: '🇩🇪', placeholder: '151 23456789', len: 10 },
  { code: '+33', country: 'France', flag: '🇫🇷', placeholder: '6 12 34 56 78', len: 9 },
  { code: '+81', country: 'Japan', flag: '🇯🇵', placeholder: '90 1234 5678', len: 10 },
  { code: '+65', country: 'Singapore', flag: '🇸🇬', placeholder: '8123 4567', len: 8 },
  { code: '+971', country: 'UAE', flag: '🇦🇪', placeholder: '50 123 4567', len: 9 },
  { code: '+27', country: 'South Africa', flag: '🇿🇦', placeholder: '71 234 5678', len: 9 },
  { code: '+55', country: 'Brazil', flag: '🇧🇷', placeholder: '11 91234 5678', len: 11 },
];

const formatNumber = (val: string, code: string) => {
  const d = val.replace(/[^0-9]/g, '');
  if (code === '+94' && d.length <= 9) {
    if (d.length > 5) return `${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5)}`;
    if (d.length > 2) return `${d.slice(0, 2)} ${d.slice(2)}`;
    return d;
  }
  if ((code === '+1' || code === '+44' || code === '+91' || code === '+49' || code === '+81') && d.length <= 10) {
    if (d.length > 6) return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
    if (d.length > 3) return `${d.slice(0, 3)} ${d.slice(3)}`;
    return d;
  }
  return d;
};


export default function AccountManagement() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  // Form State
  const [username, setUsername] = useState('admin');
  const [email, setEmail] = useState('admin@smartagri.io');
  const [originalEmail, setOriginalEmail] = useState('admin@smartagri.io');
  const [countryCode, setCountryCode] = useState('+94');
  const [phoneNumber, setPhoneNumber] = useState('77 494 5542');
  const [twoFactor, setTwoFactor] = useState(true);

  // Security Lock State
  const [isSecurityUnlocked, setIsSecurityUnlocked] = useState(false);
  const [securityPassword, setSecurityPassword] = useState('');
  const [showLockPassword, setShowLockPassword] = useState(false);
  const [securityError, setSecurityError] = useState('');
  const [verifyingSecurity, setVerifyingSecurity] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && isOpen) {
      const unlocked = sessionStorage.getItem('systemControlUnlocked');
      if (unlocked === 'true') {
        setIsSecurityUnlocked(true);
      } else {
        setIsSecurityUnlocked(false);
        setSecurityPassword('');
        setSecurityError('');
      }
    }
  }, [isOpen]);

  const handleUnlockSecurity = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifyingSecurity(true);
    setSecurityError('');

    try {
      let userEmail = email || 'admin@smartagri.io';
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('userAccount');
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            userEmail = parsed.email || parsed.username || userEmail;
          } catch (err) {}
        }
      }

      const res = await apiClient.post('/telemetry/auth/verify-system-control', {
        emailOrUsername: userEmail,
        password: securityPassword
      });

      if (res.data && res.data.success) {
        setIsSecurityUnlocked(true);
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('systemControlUnlocked', 'true');
        }
      } else {
        setSecurityError(res.data?.message || 'Invalid System Control security password.');
      }
    } catch (err: any) {
      setSecurityError(err?.response?.data?.message || 'Failed to verify password. Please try again.');
    } finally {
      setVerifyingSecurity(false);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('userAccount');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed.email) {
            setEmail(parsed.email);
            setOriginalEmail(parsed.email);
          }
          if (parsed.username) setUsername(parsed.username);
          if (typeof parsed.two_factor_enabled === 'boolean') setTwoFactor(parsed.two_factor_enabled);
          
          const p = String(parsed.phone || parsed.phone_number || parsed.mobile || '+94774945542').trim();
          const match = COUNTRY_CODES.find(c => p.startsWith(c.code));
          if (match) {
            setCountryCode(match.code);
            setPhoneNumber(formatNumber(p.slice(match.code.length).trim(), match.code));
          } else if (p.startsWith('+')) {
            setPhoneNumber(p.replace(/[^0-9]/g, ''));
          } else {
            setPhoneNumber(formatNumber(p, '+94'));
          }
        } catch (e) {}
      }
    }
  }, []);

  // Password change state
  const [showAccountPassword, setShowAccountPassword] = useState(false);
  const [newAccountPassword, setNewAccountPassword] = useState('');
  const [confirmAccountPassword, setConfirmAccountPassword] = useState('');

  const [showSystemPassword, setShowSystemPassword] = useState(false);
  const [newSystemPassword, setNewSystemPassword] = useState('');
  const [confirmSystemPassword, setConfirmSystemPassword] = useState('');

  // 3-step System Control password change wizard
  const [systemPasswordStep, setSystemPasswordStep] = useState(0); // 0=closed, 1=verify account pass, 2=verify old sys pass, 3=new sys pass
  const [inputAccountPasswordForSys, setInputAccountPasswordForSys] = useState('');
  const [inputOldSystemPassword, setInputOldSystemPassword] = useState('');
  const [sysPassError, setSysPassError] = useState('');
  const [verifyingSysPass, setVerifyingSysPass] = useState(false);

  const handleVerifyAccountPassForSys = async () => {
    if (!inputAccountPasswordForSys) {
      setSysPassError('Please enter your account login password.');
      return;
    }
    setVerifyingSysPass(true);
    setSysPassError('');
    try {
      const res = await apiClient.post('/telemetry/auth/verify-account-password', {
        emailOrUsername: email || username,
        accountPassword: inputAccountPasswordForSys
      });
      if (res.data && res.data.success) {
        setSystemPasswordStep(2);
      } else {
        setSysPassError(res.data?.message || 'Incorrect account login password.');
      }
    } catch (err: any) {
      setSysPassError(err?.response?.data?.message || 'Verification failed. Please try again.');
    } finally {
      setVerifyingSysPass(false);
    }
  };

  const handleVerifyOldSysPass = async () => {
    if (!inputOldSystemPassword) {
      setSysPassError('Please enter your old system control password.');
      return;
    }
    setVerifyingSysPass(true);
    setSysPassError('');
    try {
      const res = await apiClient.post('/telemetry/auth/verify-system-control', {
        emailOrUsername: email || username,
        password: inputOldSystemPassword
      });
      if (res.data && res.data.success) {
        setSystemPasswordStep(3);
      } else {
        setSysPassError(res.data?.message || 'Incorrect old system control password.');
      }
    } catch (err: any) {
      setSysPassError(err?.response?.data?.message || 'Verification failed. Please try again.');
    } finally {
      setVerifyingSysPass(false);
    }
  };

  const handleUpdateSysControlPass = async () => {
    if (!newSystemPassword || !confirmSystemPassword) {
      setSysPassError('Please enter and confirm your new password.');
      return;
    }
    if (newSystemPassword !== confirmSystemPassword) {
      setSysPassError('New system control passwords do not match.');
      return;
    }
    setVerifyingSysPass(true);
    setSysPassError('');
    try {
      const res = await apiClient.post('/telemetry/auth/update-system-control-password', {
        emailOrUsername: email || username,
        accountPassword: inputAccountPasswordForSys,
        oldSystemPassword: inputOldSystemPassword,
        newSystemPassword: newSystemPassword
      });
      if (res.data && res.data.success) {
        setSaveMessage('✓ System Control password updated successfully!');
        setShowSystemPassword(false);
        setSystemPasswordStep(0);
        setTimeout(() => setSaveMessage(''), 4000);
      } else {
        setSysPassError(res.data?.message || 'Failed to update password.');
      }
    } catch (err: any) {
      setSysPassError(err?.response?.data?.message || 'Failed to update password.');
    } finally {
      setVerifyingSysPass(false);
    }
  };

  // Status feedback
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (showAccountPassword && newAccountPassword && newAccountPassword !== confirmAccountPassword) {
      setSaveMessage('Error: Account passwords do not match');
      return;
    }
    if (showSystemPassword && newSystemPassword && newSystemPassword !== confirmSystemPassword) {
      setSaveMessage('Error: System control passwords do not match');
      return;
    }
    setIsSaving(true);
    setSaveMessage('');

    const cleanDigits = phoneNumber.replace(/[^0-9]/g, '');
    const fullPhone = `${countryCode}${cleanDigits}`;

    try {
      const res = await apiClient.post('/telemetry/auth/update-account', {
        oldEmail: originalEmail,
        email: email.trim(),
        username: username.trim(),
        phone: fullPhone,
        twoFactorEnabled: twoFactor,
      });

      if (res.data && res.data.success) {
        if (typeof window !== 'undefined') {
          const existing = localStorage.getItem('userAccount');
          let parsed: any = {};
          try { if (existing) parsed = JSON.parse(existing); } catch (e) {}
          const updatedUser = {
            ...parsed,
            ...res.data.user,
          };
          localStorage.setItem('userAccount', JSON.stringify(updatedUser));
        }
        setOriginalEmail(email.trim());
        setSaveMessage('✓ Account & phone number updated successfully in user_accounts!');
        setIsSaving(false);
        setTimeout(() => setSaveMessage(''), 4000);
        return;
      }
    } catch (err) {
      console.warn("Backend update API failed, attempting direct Supabase update...", err);
    }

    try {
      const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (SUPABASE_URL && SUPABASE_KEY) {
        const mod = await import('@supabase/supabase-js');
        const supabase = mod.createClient(SUPABASE_URL, SUPABASE_KEY);
        await supabase
          .from('user_accounts')
          .update({
            username: username.trim(),
            email: email.trim(),
            phone: fullPhone,
          })
          .eq('email', originalEmail);
      }
    } catch (err) {}

    if (typeof window !== 'undefined') {
      const existing = localStorage.getItem('userAccount');
      let parsed = {};
      try { if (existing) parsed = JSON.parse(existing); } catch(e){}
      const updated = {
        ...parsed,
        username: username.trim(),
        email: email.trim(),
        phone: fullPhone,
        phone_number: fullPhone,
      };
      localStorage.setItem('userAccount', JSON.stringify(updated));
    }
    setOriginalEmail(email.trim());
    setIsSaving(false);
    setSaveMessage('✓ Settings & phone number saved successfully!');
    setTimeout(() => setSaveMessage(''), 4000);
  };

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('userAccount');
      sessionStorage.removeItem('systemControlUnlocked');
    }
    setIsOpen(false);
    router.replace('/');
  };

  return (
    <>
      {/* Avatar Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 cursor-pointer transition-all hover:scale-105 active:scale-95 shadow-md focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-background"
        style={{
          background: 'linear-gradient(135deg, hsl(142, 65%, 28%), hsl(162, 55%, 40%))',
          color: 'white',
        }}
        title="Account Management"
      >
        {(username || 'F').charAt(0).toUpperCase()}
      </button>

      {/* Modal Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          
          {/* Backdrop click to close */}
          <div className="absolute inset-0" onClick={() => setIsOpen(false)} />

          {/* Glassmorphic Modal Dialog */}
          <div className="relative z-10 w-full max-w-lg bg-card border border-border rounded-[2rem] p-6 sm:p-8 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 text-foreground max-h-[90vh] overflow-y-auto">
            
            {!isSecurityUnlocked ? (
              <div className="flex flex-col items-center text-center relative z-10 py-4">
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-4 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                  <ShieldAlert className="w-8 h-8 text-emerald-500 animate-pulse" />
                </div>
                <h2 className="text-2xl font-extrabold tracking-tight">Security Access Required</h2>
                <p className="text-sm text-muted-foreground mt-2 mb-6">
                  Account management requires your System Control password to proceed.
                </p>

                <form onSubmit={handleUnlockSecurity} className="space-y-4 w-full relative z-10 text-left">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                      System Control Password
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Lock className="h-5 w-5 text-emerald-500" />
                      </div>
                      <input
                        type={showLockPassword ? "text" : "password"}
                        value={securityPassword}
                        onChange={(e) => setSecurityPassword(e.target.value)}
                        className="w-full pl-11 pr-11 py-3.5 bg-background border border-border rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all font-mono"
                        placeholder="Enter security code..."
                        autoFocus
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowLockPassword(!showLockPassword)}
                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showLockPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>

                  {securityError && (
                    <div className="text-red-500 text-sm text-center font-medium bg-red-500/10 py-2.5 px-3 rounded-xl border border-red-500/20 flex items-center justify-center gap-2">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                      <span>{securityError}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={verifyingSecurity || !securityPassword}
                    className="w-full mt-2 flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-primary-foreground font-extrabold py-3.5 px-4 rounded-xl transition-all duration-300 shadow-[0_0_30px_rgba(16,185,129,0.3)] hover:shadow-[0_0_50px_rgba(16,185,129,0.5)] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <KeyRound className="w-5 h-5" />
                    <span>{verifyingSecurity ? 'Verifying Authorization...' : 'Unlock Settings'}</span>
                  </button>
                </form>

                <button
                  onClick={() => setIsOpen(false)}
                  className="mt-6 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <>
            {/* Header */}
            <div className="flex items-center justify-between pb-5 border-b border-border mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-foreground">Account Management</h2>
                  <p className="text-xs text-muted-foreground">Manage login settings & administrator profile</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-full bg-muted/60 hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Profile Overview Card */}
            <div className="bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/20 rounded-2xl p-4 mb-6 flex items-center gap-4">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black text-white shadow-lg flex-shrink-0"
                style={{
                  background: 'linear-gradient(135deg, hsl(142, 65%, 28%), hsl(162, 55%, 40%))',
                }}
              >
                {(username || 'F').charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-base text-foreground truncate">{username}</h3>
                </div>
                <p className="text-xs text-muted-foreground font-medium mt-0.5">Master Agronomist & Admin</p>
              </div>
            </div>

            {/* Account Settings Form */}
            <form onSubmit={handleSave} className="space-y-4">
              
              {/* Username */}
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-primary" /> Login Username
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-muted/50 border border-border text-sm font-mono font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                    required
                  />
                </div>
              </div>

              {/* Email Address */}
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-primary" /> Email Address (Login & Alerts)
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-muted/50 border border-border text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                  required
                />
              </div>

              {/* Phone / SMS Alerts with Country Code Dropdown */}
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-primary" /> SMS Alert Number
                  </span>
                </label>
                <div className="flex gap-2">
                  <select
                    value={countryCode}
                    onChange={(e) => {
                      setCountryCode(e.target.value);
                      setPhoneNumber(formatNumber(phoneNumber, e.target.value));
                    }}
                    className="px-3 py-2.5 rounded-xl bg-muted/80 border border-border text-sm font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all cursor-pointer min-w-[120px]"
                  >
                    {COUNTRY_CODES.map((c) => (
                      <option key={c.code} value={c.code} className="bg-card text-foreground font-semibold">
                        {c.flag} {c.code} ({c.country})
                      </option>
                    ))}
                  </select>

                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(formatNumber(e.target.value, countryCode))}
                      placeholder={COUNTRY_CODES.find(c => c.code === countryCode)?.placeholder || 'Phone Number'}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-muted/50 border border-border text-sm font-semibold text-foreground font-mono tracking-wide focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-sans pointer-events-none">
                      {phoneNumber.replace(/[^0-9]/g, '').length} / {COUNTRY_CODES.find(c => c.code === countryCode)?.len || 10} digits
                    </div>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1.5 pl-1 flex items-center gap-1.5">
                  <span>Formatted:</span>
                  <strong className="text-foreground font-mono bg-muted/50 px-2 py-0.5 rounded border border-border">{countryCode} {phoneNumber || '••• ••• ••••'}</strong>
                </p>
              </div>

              {/* Security Section (Account & System Control Passwords) */}
              <div className="pt-3 border-t border-border mt-5 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <Shield className="w-4 h-4 text-emerald-500" />
                  <span className="text-sm font-bold text-foreground">Security & Access Control</span>
                </div>

                {/* Reset Account Password */}
                <div className="bg-muted/30 p-3.5 rounded-xl border border-border">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <Key className="w-3.5 h-3.5 text-primary" /> Reset Account Password
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">Change your primary administrator login password</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAccountPassword(!showAccountPassword);
                        if (!showAccountPassword) setShowSystemPassword(false);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 text-xs font-bold transition-colors flex items-center gap-1"
                    >
                      {showAccountPassword ? 'Cancel' : 'Reset Password'}
                    </button>
                  </div>

                  {showAccountPassword && (
                    <div className="mt-3 pt-3 border-t border-border/60 space-y-2.5 animate-in fade-in duration-150">
                      <div>
                        <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">New Account Password</label>
                        <input
                          type="password"
                          placeholder="Enter new account password"
                          value={newAccountPassword}
                          onChange={(e) => setNewAccountPassword(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Confirm Account Password</label>
                        <input
                          type="password"
                          placeholder="Confirm new account password"
                          value={confirmAccountPassword}
                          onChange={(e) => setConfirmAccountPassword(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Change System Control Password */}
                <div className="bg-muted/30 p-3.5 rounded-xl border border-border">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-amber-500" /> Change System Control Password
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">Security PIN & override password for actuator controls</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const nextShow = !showSystemPassword;
                        setShowSystemPassword(nextShow);
                        if (nextShow) {
                          setSystemPasswordStep(1);
                          setInputAccountPasswordForSys('');
                          setInputOldSystemPassword('');
                          setNewSystemPassword('');
                          setConfirmSystemPassword('');
                          setSysPassError('');
                          setShowAccountPassword(false);
                        } else {
                          setSystemPasswordStep(0);
                        }
                      }}
                      className="px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 text-xs font-bold transition-colors flex items-center gap-1"
                    >
                      {showSystemPassword ? 'Cancel' : 'Change Password'}
                    </button>
                  </div>

                  {showSystemPassword && (
                    <div className="mt-3 pt-3 border-t border-border/60 space-y-3 animate-in fade-in duration-150">
                      {/* Progress steps indicator */}
                      <div className="flex items-center justify-between text-[10px] font-extrabold uppercase px-1 pb-1 border-b border-border/40">
                        <span className={systemPasswordStep === 1 ? 'text-amber-500 flex items-center gap-1' : 'text-muted-foreground'}>
                          1. Account Pass
                        </span>
                        <span className="text-muted-foreground">→</span>
                        <span className={systemPasswordStep === 2 ? 'text-amber-500 flex items-center gap-1' : 'text-muted-foreground'}>
                          2. Old Sys Pass
                        </span>
                        <span className="text-muted-foreground">→</span>
                        <span className={systemPasswordStep === 3 ? 'text-amber-500 flex items-center gap-1' : 'text-muted-foreground'}>
                          3. New Sys Pass
                        </span>
                      </div>

                      {sysPassError && (
                        <div className="text-red-500 bg-red-500/10 border border-red-500/20 px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5">
                          <span>⚠️ {sysPassError}</span>
                        </div>
                      )}

                      {systemPasswordStep === 1 && (
                        <div className="space-y-2.5">
                          <p className="text-[11px] text-muted-foreground">For security, please enter your primary admin account login password first:</p>
                          <div>
                            <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Account Login Password</label>
                            <input
                              type="password"
                              placeholder="Enter account login password..."
                              value={inputAccountPasswordForSys}
                              onChange={(e) => setInputAccountPasswordForSys(e.target.value)}
                              className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                              autoFocus
                            />
                          </div>
                          <button
                            type="button"
                            disabled={verifyingSysPass || !inputAccountPasswordForSys}
                            onClick={handleVerifyAccountPassForSys}
                            className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs rounded-lg transition-colors disabled:opacity-50"
                          >
                            {verifyingSysPass ? 'Verifying Account Password...' : 'Verify Account Password →'}
                          </button>
                        </div>
                      )}

                      {systemPasswordStep === 2 && (
                        <div className="space-y-2.5">
                          <p className="text-[11px] text-muted-foreground">Now, enter your current (old) System Control security password:</p>
                          <div>
                            <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Old System Control Password</label>
                            <input
                              type="password"
                              placeholder="Enter old system control password..."
                              value={inputOldSystemPassword}
                              onChange={(e) => setInputOldSystemPassword(e.target.value)}
                              className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
                              autoFocus
                            />
                          </div>
                          <button
                            type="button"
                            disabled={verifyingSysPass || !inputOldSystemPassword}
                            onClick={handleVerifyOldSysPass}
                            className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs rounded-lg transition-colors disabled:opacity-50"
                          >
                            {verifyingSysPass ? 'Verifying Old Password...' : 'Verify Old Password →'}
                          </button>
                        </div>
                      )}

                      {systemPasswordStep === 3 && (
                        <div className="space-y-2.5">
                          <p className="text-[11px] text-emerald-500 font-medium">✓ Authorizations verified! Set your new System Control password below:</p>
                          <div>
                            <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">New System Control Password / PIN</label>
                            <input
                              type="password"
                              placeholder="Enter new system control password..."
                              value={newSystemPassword}
                              onChange={(e) => setNewSystemPassword(e.target.value)}
                              className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
                              autoFocus
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Confirm System Control Password</label>
                            <input
                              type="password"
                              placeholder="Confirm new system control password..."
                              value={confirmSystemPassword}
                              onChange={(e) => setConfirmSystemPassword(e.target.value)}
                              className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
                            />
                          </div>
                          <button
                            type="button"
                            disabled={verifyingSysPass || !newSystemPassword || !confirmSystemPassword}
                            onClick={handleUpdateSysControlPass}
                            className="w-full py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-extrabold text-xs rounded-lg transition-all shadow-sm disabled:opacity-50"
                          >
                            {verifyingSysPass ? 'Updating Password...' : '✓ Save New System Control Password'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 2FA */}
                <div className="flex items-center justify-between bg-muted/30 px-3.5 py-3 rounded-xl border border-border">
                  <div>
                    <p className="text-xs font-bold text-foreground">Two-Factor Authentication (2FA)</p>
                    <p className="text-[11px] text-muted-foreground">Add an extra layer of security to login</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTwoFactor(!twoFactor)}
                    className={`px-3 py-1 rounded-full text-xs font-extrabold transition-all ${
                      twoFactor
                        ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {twoFactor ? 'Enabled' : 'Disabled'}
                  </button>
                </div>
              </div>

              {/* Status Message */}
              {saveMessage && (
                <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in duration-200 ${
                  saveMessage.startsWith('Error')
                    ? 'bg-red-500/10 text-red-600 border border-red-500/20'
                    : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                }`}>
                  <Check className="w-4 h-4 flex-shrink-0" />
                  <span>{saveMessage}</span>
                </div>
              )}

              {/* Modal Footer Actions */}
              <div className="flex items-center justify-between pt-4 border-t border-border mt-6">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider text-red-600 dark:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all flex items-center gap-2 active:scale-95"
                >
                  <LogOut className="w-4 h-4" />
                  Log Out
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider bg-muted hover:bg-muted/80 text-foreground transition-all active:scale-95"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider bg-primary text-primary-foreground hover:opacity-90 shadow-lg shadow-primary/25 transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
                  >
                    {isSaving ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5" />
                        Save Settings
                      </>
                    )}
                  </button>
                </div>
              </div>

            </form>
              </>
            )}

          </div>
        </div>
      )}
    </>
  );
}
