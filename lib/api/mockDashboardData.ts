export type DashboardDateRangeOption = '7' | '30' | '90';

export interface Appointment {
  id: string;
  clientName: string;
  address: string;
  time: string;
  status: 'completed' | 'pending';
  technician: string;
  locationLabel: string;
  lat: number;
  lng: number;
}

export interface TechnicianLocation {
  label: string;
  status: 'completed' | 'pending';
  xPercent: number;
  yPercent: number;
}

export interface CompliancePoint {
  date: string;
  rate: number;
}

export interface ComplianceAction {
  id: string;
  title: string;
  area: string;
  dueDate: string;
}

export interface ChemicalUsage {
  id: string;
  chemical: string;
  volumeMl: number;
  status: 'compliant' | 'non-compliant';
  stockRemaining: number;
}

export interface UrgentAlert {
  id: string;
  title: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  action?: {
    type: 'open_reports' | 'open_technicians';
    search?: string;
    followUpOnly?: boolean;
  };
}

export interface NextBestAction {
  id: string;
  title: string;
  description: string;
  action: {
    type: 'open_reports' | 'open_technicians';
    search?: string;
    followUpOnly?: boolean;
  };
}

export interface CustomerValue {
  clv: number;
  cac: number;
  trend: number[];
}

export interface RetentionData {
  retentionRate: number;
  reasons: Array<{ reason: string; count: number }>;
}

export interface CSATData {
  average: number;
  nps: number;
  trend: number[];
}

export interface ComplianceHealthWarning {
  code: string;
  title: string;
  count: number;
  severity: 'high' | 'medium' | 'low';
}

export interface AuditReadinessSummary {
  reportCount: number;
  missingSignatures: number;
  expiringQualifications: number;
  openComplianceIssues: number;
}

export interface DashboardData {
  todaySchedule: {
    appointments: Appointment[];
    completed: number;
    scheduled: number;
    percentComplete: number;
    locations: TechnicianLocation[];
  };
  compliance: {
    series: CompliancePoint[];
    openActions: ComplianceAction[];
    currentRate: number;
    healthScore?: number;
    warnings?: ComplianceHealthWarning[];
  };
  auditReadiness?: AuditReadinessSummary;
  chemicalLog: ChemicalUsage[];
  urgentAlerts: UrgentAlert[];
  nextBestActions: NextBestAction[];
  customerValue: CustomerValue;
  retention: RetentionData;
  csat: CSATData;
}

/** @deprecated Dashboard UI uses `/api/dashboard-insights` via `fetchDashboardInsights`. Kept for local fixtures / tests. */
export async function fetchDashboardData(range: DashboardDateRangeOption): Promise<DashboardData> {
  await new Promise((resolve) => setTimeout(resolve, 220));

  const todaySchedule: DashboardData['todaySchedule'] = {
    appointments: [
      { id: 'job-1', clientName: 'Harper Farm', address: '16 Manor Rd, Bristol', time: '08:30', status: 'completed', technician: 'Jamie', locationLabel: 'North Site', lat: 51.45, lng: -2.59 },
      { id: 'job-2', clientName: 'Green & Sons', address: '4 Chapel St, Bath', time: '11:00', status: 'pending', technician: 'Priya', locationLabel: 'West Site', lat: 51.377, lng: -2.36 },
      { id: 'job-3', clientName: 'Elm House', address: '22 Summer Ln, Bristol', time: '14:15', status: 'pending', technician: 'Noah', locationLabel: 'South Site', lat: 51.45, lng: -2.58 },
    ],
    completed: 1,
    scheduled: 3,
    percentComplete: 33,
    locations: [
      { label: 'North Site', status: 'completed', xPercent: 24, yPercent: 22 },
      { label: 'West Site', status: 'pending', xPercent: 68, yPercent: 30 },
      { label: 'South Site', status: 'pending', xPercent: 50, yPercent: 72 },
    ],
  };

  const compliance: DashboardData['compliance'] = {
    currentRate: range === '7' ? 88 : range === '30' ? 92 : 90,
    series: Array.from({ length: 6 }).map((_, index) => ({
      date: `${index * (range === '90' ? 5 : range === '30' ? 6 : 1)}d`,
      rate: Math.min(100, 82 + index * 3 + (range === '7' ? 2 : 0)),
    })),
    openActions: [
      { id: 'a1', title: 'Ongoing rodent follow-up', area: 'Warehouse A', dueDate: 'Today' },
      { id: 'a2', title: 'Blocked access inspection', area: 'Site 4', dueDate: 'Tomorrow' },
      { id: 'a3', title: 'Safety signage update', area: 'Head Office', dueDate: 'In 2 days' },
    ],
  };

  const chemicalLog: DashboardData['chemicalLog'] = [
    { id: 'c1', chemical: 'Fipronil', volumeMl: 180, status: 'compliant', stockRemaining: 42 },
    { id: 'c2', chemical: 'Imidacloprid', volumeMl: 120, status: 'compliant', stockRemaining: 18 },
    { id: 'c3', chemical: 'Bendiocarb', volumeMl: 90, status: 'non-compliant', stockRemaining: 5 },
    { id: 'c4', chemical: 'Permethrin', volumeMl: 210, status: 'compliant', stockRemaining: 12 },
  ];

  const urgentAlerts: DashboardData['urgentAlerts'] = [
    { id: 'u1', title: 'Overdue compliance inspection', description: 'Site 12 has not been inspected in 7 days.', severity: 'high' },
    { id: 'u2', title: 'Missed callback', description: 'Customer callback for Elm House is overdue.', severity: 'medium' },
    { id: 'u3', title: 'Inventory low', description: 'Permethrin stock is below the 15% safety threshold.', severity: 'low' },
  ];
  const nextBestActions: DashboardData['nextBestActions'] = [
    {
      id: 'nba-1',
      title: 'Resolve overdue follow-ups',
      description: 'Open reports with follow-up filters to close overdue jobs first.',
      action: { type: 'open_reports', followUpOnly: true },
    },
    {
      id: 'nba-2',
      title: 'Review expiring certifications',
      description: 'Open technicians to renew certifications that may block scheduling.',
      action: { type: 'open_technicians' },
    },
  ];

  const customerValue: DashboardData['customerValue'] = {
    clv: 12450,
    cac: 820,
    trend: [11000, 11500, 12000, 12300, 12450],
  };

  const retention: DashboardData['retention'] = {
    retentionRate: 87,
    reasons: [
      { reason: 'Service timing', count: 8 },
      { reason: 'Invoice clarity', count: 5 },
      { reason: 'Competitor offer', count: 3 },
    ],
  };

  const csat: DashboardData['csat'] = {
    average: 4.8,
    nps: 54,
    trend: [4.6, 4.7, 4.8, 4.8, 4.9],
  };

  return {
    todaySchedule,
    compliance,
    chemicalLog,
    urgentAlerts,
    nextBestActions,
    customerValue,
    retention,
    csat,
  };
}
