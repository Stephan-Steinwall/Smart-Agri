// src/components/DashboardLayout.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Sprout, LayoutDashboard, Settings, MapIcon, Bot,
  Power, MapPin, Download, ChevronRight, Wifi
} from 'lucide-react';
import NotificationBell from './NotificationBell';
import FieldSelector from './FieldSelector';

const navItems = [
  { href: '/',               icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/map',            icon: MapIcon,          label: 'Field Map' },
  { href: '/ai-assistant',   icon: Bot,              label: 'AI Assistant' },
  { href: '/automation',     icon: Power,            label: 'Automation' },
  { href: '/portable',       icon: MapPin,           label: 'Portable Readings' },
  { href: '/reports',        icon: Download,         label: 'Data Reports' },
  { href: '/settings',       icon: Settings,         label: 'Device Config' },
];

const pageTitles: Record<string, string> = {
  '/':             'Farm Overview',
  '/map':          'Field Map',
  '/ai-assistant': 'AI Assistant',
  '/automation':   'Automation Control',
  '/portable':     'Portable Readings',
  '/reports':      'Data Reports',
  '/settings':     'Device Config',
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
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
            className="flex items-center justify-center w-9 h-9 rounded-xl mr-3 flex-shrink-0"
            style={{ background: 'hsl(142, 65%, 28%)' }}
          >
            <Sprout className="w-5 h-5" style={{ color: 'white' }} />
          </div>
          <div>
            <span className="font-bold text-base leading-none" style={{ color: 'hsl(140, 15%, 92%)' }}>
              SmartAgri
            </span>
            <p className="text-[10px] mt-0.5 font-medium tracking-widest uppercase" style={{ color: 'var(--sidebar-foreground)' }}>
              AI Platform
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
          {navItems.map(({ href, icon: Icon, label }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
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
                {/* Active left accent bar */}
                {isActive && (
                  <span
                    className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full"
                    style={{ background: 'hsl(142, 70%, 65%)' }}
                  />
                )}
                <Icon
                  className="w-4 h-4 mr-3 flex-shrink-0"
                  style={{ color: isActive ? 'hsl(142, 70%, 75%)' : 'inherit', opacity: isActive ? 1 : 0.7 }}
                />
                <span className="flex-1">{label}</span>
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
            <FieldSelector />
            <div style={{ width: '1px', height: '24px', background: 'var(--border)' }} />
            <NotificationBell />
            {/* Avatar */}
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 cursor-pointer transition-opacity hover:opacity-90"
              style={{
                background: 'linear-gradient(135deg, hsl(142, 65%, 28%), hsl(162, 55%, 40%))',
                color: 'white',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              }}
              title="Farmer Profile"
            >
              F
            </div>
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