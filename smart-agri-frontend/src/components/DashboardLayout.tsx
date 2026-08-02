// src/components/DashboardLayout.tsx
'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Sprout, LayoutDashboard, Bot, ChevronRight, Wifi, CloudSun, FlaskConical, Sliders
} from 'lucide-react';
import NotificationBell from './NotificationBell';
import AccountManagement from './AccountManagement';
import { toast } from 'sonner';

type NavItem = {
  href?: string;
  icon: any;
  label: string;
  children?: { href: string; label: string }[];
};

const navItems: NavItem[] = [
  { href: '/dashboard',      icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/wireless-soil-sensor', icon: Wifi,        label: 'Wireless Soil Sensor' },
  { 
    icon: FlaskConical,     
    label: 'Data Analytics',
    children: [
      { href: '/field-data-analysis', label: 'Field Data Analytics' },
      { href: '/wireless-soil-sensor/analyze', label: 'Wireless Sensor Soil Analysis' }
    ]
  },
  { href: '/local-weather',  icon: CloudSun,         label: 'Local Weather' },
  { href: '/system-control', icon: Sliders,          label: 'System Control' },
  { href: '/ai-assistant',   icon: Bot,              label: 'AI Assistant' },
];

const pageTitles: Record<string, string> = {
  '/dashboard':         'Farm Overview',
  '/local-weather':     'Local Weather Station',
  '/field-data-analysis': 'Field Data Analysis',
  '/ai-assistant':      'AI Assistant',
  '/wireless-soil-sensor': 'Wireless Soil Sensor',
  '/system-control':    'System Control Center',
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    if (pathname === '/' || pathname === '/login') {
      setTimeout(() => setIsAuthorized(true), 0);
      return;
    }

    const checkSession = () => {
      const stored = localStorage.getItem('userAccount');
      if (!stored) {
        setIsAuthorized(false);
        router.replace('/login');
        return;
      }
      try {
        const user = JSON.parse(stored);
        if (user.sessionExpiresAt && Date.now() > user.sessionExpiresAt) {
          localStorage.removeItem('userAccount');
          setIsAuthorized(false);
          toast.error('Your session has expired for security reasons. Please log in again.');
          router.replace('/login');
          return;
        }
        setIsAuthorized(true);
      } catch (err) {
        localStorage.removeItem('userAccount');
        setIsAuthorized(false);
        router.replace('/login');
      }
    };

    checkSession();
    const interval = setInterval(checkSession, 60000); // Verify session validity every minute
    return () => clearInterval(interval);
  }, [pathname, router]);

  // Bypass dashboard layout for the welcome page and login page
  if (pathname === '/' || pathname === '/login') {
    return <>{children}</>;
  }

  // Prevent rendering protected content until session verification passes
  if (!isAuthorized) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-950 text-white font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-slate-400 font-medium">Verifying session security...</p>
        </div>
      </div>
    );
  }

  const pageTitle = pageTitles[pathname] ?? 'SmartAgri';

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--background)' }}>

      {/* ── Sidebar ───────────────────────────────────────────────────────── */}
      <aside
        className="w-64 flex-shrink-0 flex flex-col"
        style={{
          background: 'var(--sidebar)',
          borderRight: '1px solid var(--sidebar-border)',
        }}
      >
        {/* Logo */}
        <div
          className="h-16 flex items-center px-5 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--sidebar-border)' }}
        >
          <div
            className="flex items-center justify-center w-10 h-10 rounded-xl mr-3 flex-shrink-0 overflow-hidden bg-white"
          >
            <img src="/logo.jpg" alt="AgriBot Logo" className="w-full h-full object-contain p-0.5" />
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="font-bold text-base leading-none truncate" style={{ color: 'hsl(140, 15%, 92%)' }}>
              AgriBot
            </span>
            <p className="text-[10px] mt-1 font-medium uppercase truncate" style={{ color: 'var(--sidebar-foreground)' }}>
              Smart Agriculture System
            </p>
          </div>
        </div>

        {/* Section label */}
        <div className="px-5 pt-6 pb-2">
          <span
            className="text-[10px] font-semibold uppercase tracking-widest"
            style={{ color: 'hsl(140, 10%, 45%)' }}
          >
            Main Menu
          </span>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto pb-4">
          {navItems.map((item) => {
            if (item.children) {
              const isActive = item.children.some(child => pathname === child.href);
              return (
                <div key={item.label} className="group relative">
                  <div
                    className="flex items-center px-3 py-3 rounded-xl text-sm font-medium transition-all duration-200 cursor-default"
                    style={{
                      color: isActive ? 'white' : 'var(--sidebar-foreground)',
                      background: isActive ? 'hsl(142, 58%, 28%)' : 'transparent',
                      boxShadow: isActive ? 'var(--shadow-sidebar-active)' : 'none',
                    }}
                    onMouseEnter={e => {
                      if (!isActive) {
                        (e.currentTarget as HTMLElement).style.background = 'var(--sidebar-accent)';
                        (e.currentTarget as HTMLElement).style.color = 'var(--sidebar-accent-foreground)';
                      }
                    }}
                    onMouseLeave={e => {
                      if (!isActive) {
                        (e.currentTarget as HTMLElement).style.background = 'transparent';
                        (e.currentTarget as HTMLElement).style.color = 'var(--sidebar-foreground)';
                      }
                    }}
                  >
                    <item.icon
                      className="w-4 h-4 mr-3 flex-shrink-0"
                      style={{ color: isActive ? 'hsl(142, 70%, 75%)' : 'inherit', opacity: isActive ? 1 : 0.7 }}
                    />
                    <span className="flex-1">{item.label}</span>
                    <ChevronRight className="w-3.5 h-3.5 opacity-60 group-hover:rotate-90 transition-transform" />
                  </div>
                  
                  {/* Hover dropdown (Accordion) */}
                  <div className="max-h-0 overflow-hidden transition-all duration-300 ease-in-out group-hover:max-h-40">
                    <div className="flex flex-col gap-1 py-1.5 pl-10 pr-2">
                      {item.children.map(child => {
                        const isChildActive = pathname === child.href;
                        return (
                          <Link 
                            key={child.href}
                            href={child.href}
                            className="px-3 py-2 text-xs font-medium rounded-lg transition-colors"
                            style={{ 
                              color: isChildActive ? 'white' : 'var(--sidebar-foreground)',
                              background: isChildActive ? 'rgba(255,255,255,0.1)' : 'transparent'
                            }}
                            onMouseEnter={e => {
                              if (!isChildActive) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)';
                            }}
                            onMouseLeave={e => {
                              if (!isChildActive) (e.currentTarget as HTMLElement).style.background = 'transparent';
                            }}
                          >
                            {child.label}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            }

            // Normal link
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href!}
                className="group flex items-center px-3 py-3 rounded-xl text-sm font-medium transition-all duration-200 relative"
                style={{
                  color: isActive ? 'white' : 'var(--sidebar-foreground)',
                  background: isActive ? 'hsl(142, 58%, 28%)' : 'transparent',
                  boxShadow: isActive ? 'var(--shadow-sidebar-active)' : 'none',
                }}
                onMouseEnter={e => {
                  if (!isActive) {
                    (e.currentTarget as HTMLElement).style.background = 'var(--sidebar-accent)';
                    (e.currentTarget as HTMLElement).style.color = 'var(--sidebar-accent-foreground)';
                  }
                }}
                onMouseLeave={e => {
                  if (!isActive) {
                    (e.currentTarget as HTMLElement).style.background = 'transparent';
                    (e.currentTarget as HTMLElement).style.color = 'var(--sidebar-foreground)';
                  }
                }}
              >
                <item.icon
                  className="w-4 h-4 mr-3 flex-shrink-0"
                  style={{ color: isActive ? 'hsl(142, 70%, 75%)' : 'inherit', opacity: isActive ? 1 : 0.7 }}
                />
                <span className="flex-1">{item.label}</span>
                {isActive && (
                  <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom system status */}
        <div
          className="flex-shrink-0 px-5 py-4 mx-3 mb-4 rounded-xl"
          style={{ background: 'var(--sidebar-accent)' }}
        >
          <div className="flex items-center gap-2 mb-1">
            <div className="status-dot-green" style={{ background: 'hsl(142, 65%, 45%)', boxShadow: 'none', width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0 }} />
            <span className="text-xs font-semibold" style={{ color: 'hsl(142, 50%, 70%)' }}>System Online</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Wifi className="w-3 h-3" style={{ color: 'hsl(140, 10%, 50%)' }} />
            <span className="text-[10px]" style={{ color: 'hsl(140, 10%, 50%)' }}>Sensor Network Active</span>
          </div>
        </div>
      </aside>

      {/* ── Main Content Area ─────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col overflow-hidden">

        {/* Top Header */}
        <header
          className="h-16 flex-shrink-0 flex items-center px-8 justify-between"
          style={{
            background: 'var(--card)',
            borderBottom: '1px solid var(--border)',
            boxShadow: '0 1px 0 rgba(0,0,0,0.04)',
          }}
        >
          {/* Left: Breadcrumb */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--muted-foreground)' }}>
              <Sprout className="w-3.5 h-3.5" />
              <span>SmartAgri</span>
              <ChevronRight className="w-3.5 h-3.5 opacity-50" />
            </div>
            <h1 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
              {pageTitle}
            </h1>
          </div>

          {/* Right: Controls */}
          <div className="flex items-center gap-3">
            <NotificationBell />
            {/* Account Management Modal Trigger & Dialog */}
            <AccountManagement />
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-auto p-8">
          {children}
        </div>
      </main>
    </div>
  );
}