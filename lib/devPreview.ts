import type { ParsedUrlQuery } from 'querystring';
import type { AppointmentDTO } from './scheduling/types';

/** Dev-only: browse the app without Supabase sign-in via `?preview=1`. */
export function isDevPreviewMode(query: ParsedUrlQuery): boolean {
  return process.env.NODE_ENV === 'development' && query.preview === '1';
}

export function previewHref(path: string): string {
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}preview=1`;
}

export const PREVIEW_COMPANY = {
  id: 'preview-company',
  name: 'Pest Trace Preview Co.',
  email: 'owner@preview.local',
  plan: 'enterprise' as const,
  subscriptionStatus: 'active' as const,
  trialEndsAt: null as string | null,
  paymentGraceEndsAt: null as string | null,
  requireSignature: true,
  requirePhotos: true,
  notificationPreferences: {
    trialExpiry: true,
    renewal: true,
    certificationExpiry: true,
    business: {
      jobCompleteEmailToOwner: true,
      jobCompleteEmailToCustomer: true,
    },
    enterprise: {
      branding: {
        primaryColor: '#2563EB',
        footerText: 'Pest Trace Preview Co. — demo data only',
        portalWelcomeText: 'Welcome to your service portal.',
      },
    },
  },
};

export const PREVIEW_TECHNICIANS = [
  { id: 'tech-1', name: 'John Smith', email: 'john@preview.local' },
  { id: 'tech-2', name: 'Sarah Johnson', email: 'sarah@preview.local' },
];

export const PREVIEW_CUSTOMERS = [
  {
    id: 'cust-1',
    name: 'Riverside Hotel Group',
    email: 'facilities@riverside.demo',
    phone: '020 7946 0958',
    portalEnabled: true,
    sites: [
      { id: 'site-1', label: 'Main kitchen', address: '12 Thames Walk', postcode: 'SE1 2AA' },
      { id: 'site-2', label: 'Annex', address: '14 Thames Walk', postcode: 'SE1 2AA' },
    ],
    _count: { logbookEntries: 18, invoices: 3 },
  },
  {
    id: 'cust-2',
    name: 'Oakwood Care Home',
    email: 'manager@oakwood.demo',
    phone: '0161 496 0123',
    portalEnabled: false,
    sites: [{ id: 'site-3', label: null, address: '88 Oak Lane', postcode: 'M1 4BT' }],
    _count: { logbookEntries: 9, invoices: 1 },
  },
  {
    id: 'cust-3',
    name: 'Greenfield Offices',
    email: 'ops@greenfield.demo',
    phone: null,
    portalEnabled: false,
    sites: [{ id: 'site-4', label: 'Floor 2', address: 'Unit 4 Business Park', postcode: 'B1 1AA' }],
    _count: { logbookEntries: 4, invoices: 0 },
  },
];

export const PREVIEW_INVOICES = [
  {
    id: 'inv-1',
    number: 'INV-1001',
    status: 'sent',
    total: '294.00',
    issuedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    customer: { name: 'Riverside Hotel Group' },
  },
  {
    id: 'inv-2',
    number: 'INV-1002',
    status: 'paid',
    total: '180.00',
    issuedAt: new Date(Date.now() - 12 * 86400000).toISOString(),
    customer: { name: 'Oakwood Care Home' },
  },
  {
    id: 'inv-3',
    number: 'INV-1003',
    status: 'draft',
    total: '245.00',
    issuedAt: new Date().toISOString(),
    customer: { name: 'Riverside Hotel Group' },
  },
];

export const PREVIEW_COMPLIANCE_ALERTS = [
  {
    id: 'alert-1',
    type: 'missed_recurring_visit',
    message: 'Missed weekly visit for Riverside Hotel Group — Main kitchen (due 3 days ago)',
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    id: 'alert-2',
    type: 'overdue_follow_up',
    message: 'Follow-up overdue for Oakwood Care Home — rat treatment',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
];

export const PREVIEW_PORTAL = {
  customer: { name: 'Riverside Hotel Group', companyName: 'Pest Trace Preview Co.' },
  sites: PREVIEW_CUSTOMERS[0].sites,
  upcoming: [
    {
      id: 'appt-1',
      scheduledStart: new Date(Date.now() + 3 * 86400000).toISOString(),
      address: '12 Thames Walk',
      treatment: 'Routine rodent inspection',
    },
  ],
  jobs: [
    {
      id: 'job-1',
      date: new Date(Date.now() - 7 * 86400000).toISOString(),
      treatment: 'Cockroach treatment',
      address: '12 Thames Walk',
      postcode: 'SE1 2AA',
    },
    {
      id: 'job-2',
      date: new Date(Date.now() - 21 * 86400000).toISOString(),
      treatment: 'Fly control',
      address: '14 Thames Walk',
      postcode: 'SE1 2AA',
    },
  ],
};

function atHour(daysFromNow: number, hour: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

export function buildPreviewAppointments(): AppointmentDTO[] {
  const companyId = PREVIEW_COMPANY.id;
  const base = (id: string, clientName: string, address: string, start: string, end: string, status: AppointmentDTO['status']): AppointmentDTO => ({
    id,
    companyId,
    logbookEntryId: status === 'completed' ? `log-${id}` : null,
    recurringAppointmentId: id === 'appt-rec-1' ? 'rec-1' : null,
    clientName,
    address,
    postcode: 'SE1 2AA',
    treatment: 'Rodent inspection',
    notes: 'Preview appointment',
    scheduledStart: start,
    scheduledEnd: end,
    status,
    technicians: [PREVIEW_TECHNICIANS[0]],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  return [
    base('appt-1', 'Riverside Hotel Group', '12 Thames Walk', atHour(0, 9), atHour(0, 10), 'scheduled'),
    base('appt-2', 'Oakwood Care Home', '88 Oak Lane', atHour(1, 14), atHour(1, 15), 'scheduled'),
    base('appt-3', 'Greenfield Offices', 'Unit 4 Business Park', atHour(-1, 11), atHour(-1, 12), 'completed'),
    base('appt-rec-1', 'Riverside Hotel Group', '14 Thames Walk', atHour(7, 10), atHour(7, 11), 'scheduled'),
  ];
}

export const PREVIEW_PORTAL_URL = '/portal/demo?preview=1';
