import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import Button from './ui/Button';
import { DashboardIcon, LogbookIcon, ReportsIcon, SettingsIcon, CalendarIcon, TechniciansIcon } from './icons';

interface SidebarProps {
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  onSignOut?: () => void;
  role?: 'owner' | 'technician';
  /** Shown under Compliance Suite — defaults from role when omitted. */
  workspaceLabel?: string;
  /** When true (dev preview mode) appends &preview=1 to all internal nav links. */
  previewMode?: boolean;
}

export default function Sidebar({
  activeTab = 'technicians',
  onTabChange,
  onSignOut,
  role = 'owner',
  workspaceLabel,
  previewMode = false,
}: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileNavRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!mobileOpen) return undefined;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false);
    };
    const firstFocusable = mobileNavRef.current?.querySelector<HTMLElement>('button, a, [tabindex]:not([tabindex="-1"])');
    firstFocusable?.focus();
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [mobileOpen]);

  const pq = previewMode ? '&preview=1' : '';
  const ownerTabs = [
    { id: 'technicians', label: 'Dashboard', href: `/dashboard?tab=technicians${pq}`, icon: DashboardIcon },
    { id: 'logbook', label: 'Logbook', href: `/dashboard?tab=logbook${pq}`, icon: LogbookIcon },
    { id: 'scheduling', label: 'Scheduling', href: `/scheduling${previewMode ? '?preview=1' : ''}`, icon: CalendarIcon },
    { id: 'customers', label: 'Customers', href: `/customers${previewMode ? '?preview=1' : ''}`, icon: TechniciansIcon },
    { id: 'invoices', label: 'Invoices', href: `/invoices${previewMode ? '?preview=1' : ''}`, icon: ReportsIcon },
    { id: 'reports', label: 'Reports', href: `/reports${previewMode ? '?preview=1' : ''}`, icon: ReportsIcon },
    { id: 'settings', label: 'Settings', href: `/dashboard?tab=settings${pq}`, icon: SettingsIcon },
  ];
  const technicianTabs = [
    { id: 'logbook', label: 'Logbook', href: `/technician${previewMode ? '?preview=1' : ''}`, icon: LogbookIcon },
    { id: 'scheduling', label: 'Scheduling', href: `/scheduling${previewMode ? '?preview=1' : ''}`, icon: CalendarIcon },
    { id: 'reports', label: 'Reports', href: `/reports${previewMode ? '?preview=1' : ''}`, icon: ReportsIcon },
  ];
  const tabs = role === 'technician' ? technicianTabs : ownerTabs;
  const resolvedWorkspaceLabel =
    workspaceLabel ?? (role === 'technician' ? 'Technician' : 'Business admin');

  const isActive = (id: string) => activeTab === id;

  return (
    <>
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed left-4 top-4 z-40 rounded-lg border border-zinc-200 bg-white p-3 shadow-lg lg:hidden"
        aria-label="Open navigation menu"
        aria-expanded={mobileOpen}
        aria-controls="app-sidebar"
      >
        ☰
      </button>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-[39] bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        aria-label="Main navigation"
        className={`fixed inset-y-0 left-0 z-50 w-64 border-r border-zinc-200 bg-white transform transition-transform ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 lg:sticky lg:top-0 lg:h-screen`}
      >
        <div className="flex h-full flex-col justify-between">
          <div>
            <div className="border-b border-zinc-200 px-5 py-5">
              <div className="flex min-w-0 items-center gap-2">
                  <Image
                    src="/pest-trace.png"
                    alt="Pest Trace logo"
                    width={36}
                    height={36}
                    className="h-9 w-9 object-contain"
                    priority
                  />
                  <h2 className="truncate text-2xl font-semibold leading-tight text-navy">Pest Trace</h2>
              </div>
              <p className="mt-1 text-sm text-zinc-500">Compliance Suite</p>
              <span className="mt-2 inline-flex rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600">
                {resolvedWorkspaceLabel}
              </span>
              <button
                onClick={() => setMobileOpen(false)}
                className="mt-3 rounded-lg p-2 hover:bg-zinc-100 lg:hidden"
                aria-label="Close navigation menu"
              >
                ✕
              </button>
            </div>

            <nav id="app-sidebar" ref={mobileNavRef} className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-3">
              {tabs.map((tab) => (
                <Link
                  key={tab.id}
                  href={tab.href}
                  onClick={() => {
                    onTabChange?.(tab.id);
                    setMobileOpen(false);
                  }}
                  className={`flex items-center gap-3 rounded-lg px-4 py-3 text-base font-medium transition ${
                    isActive(tab.id)
                      ? 'bg-primary-500 text-white'
                      : 'text-zinc-700 hover:bg-zinc-100 hover:text-navy'
                  }`}
                  aria-current={isActive(tab.id) ? 'page' : undefined}
                >
                  <tab.icon size={18} className={isActive(tab.id) ? 'text-white' : 'text-slate-500'} />
                  {tab.label}
                </Link>
              ))}
              <Button
                variant="danger"
                size="sm"
                onClick={onSignOut}
                className="mt-2 self-start"
                data-testid="sidebar-signout-top"
              >
                Sign Out
              </Button>
            </nav>
          </div>

          <div className="border-t border-zinc-200 p-4" />
        </div>
      </aside>
    </>
  );
}

