export const COMPLIANCE_PAGE_TITLE = 'Pest Control Compliance & Audit Records';
export const COMPLIANCE_PAGE_DESCRIPTION =
  'How PestTrace supports rodenticide stewardship-style records, technician qualifications, follow-ups, and audit pack exports for UK pest control businesses.';

export const complianceHero = {
  title: 'Compliance records that match how pest control jobs actually run',
  subtitle:
    'From bait station checks to client signatures — PestTrace captures structured job evidence in the field and packages it for reports, tenders, and audit folders.',
};

export const complianceWorkflow = {
  title: 'What gets recorded on every job',
  intro:
    'Technicians and owners log the same core fields your team already tracks — but in one searchable system instead of paper folders.',
  fieldGroups: [
    {
      title: 'Job identity & site',
      fields: [
        'Date, client name, address, and postcode',
        'Property type (residential, commercial, agricultural, and other)',
        'Treatment type, including rodent, insect, bird, and specialist treatments',
      ],
    },
    {
      title: 'Treatment & chemical evidence',
      fields: [
        'Treatment notes and room-level observations',
        'Poison / product used and bait boxes placed',
        'Structured bait station records (station ID, location, bait type, amount) on owner forms',
        'Product amount for billing and audit cross-reference',
      ],
    },
    {
      title: 'Proof & accountability',
      fields: [
        'Up to four site photos per job',
        'Customer e-signature on canvas',
        'Follow-up date for revisits and callback scheduling',
        'Job status: open, completed, or cancelled with reason',
      ],
    },
    {
      title: 'Team & qualifications',
      fields: [
        'Technician assignment per job',
        'Certification uploads with expiry dates',
        'Qualification alerts at 90, 60, 30, and 7 days before expiry',
      ],
    },
  ],
};

export const complianceRules = {
  title: 'Your company compliance rules — enforced in the app',
  body: 'Owners configure what “complete” means for your business:',
  rules: [
    'Require signature on reports — jobs without a signature flag in audit readiness',
    'Require photos on reports — missing photo evidence counted in compliance health',
    'Default report date range for exports and dashboard views',
  ],
  footnote:
    'These settings drive the compliance health score and what appears in your audit readiness centre — not a generic checklist bolted on after the fact.',
};

export const complianceAuditPack = {
  title: 'Audit pack export (Business & Enterprise)',
  intro:
    'When an auditor, client, or tender asks for evidence, export a ZIP for a date range instead of rebuilding folders manually.',
  contents: [
    'jobs.csv and jobs.json — date, client, address, postcode, treatment, status, notes, signature flag, photo count, technician names',
    'photos-manifest.json — signed links to job evidence images',
    'qualifications.json — technician certification files and expiry dates',
    'report-summary.pdf — compliance score, completed jobs, missing signatures, expiring qualifications, open issues, and recent chemical usage',
    'signatures/ — up to 100 job signature images as PNG files',
    'Enterprise: per-site folders and multi-site index PDF for commercial clients',
  ],
  cta: 'See pricing for Business & Enterprise',
  ctaHref: '/pricing',
};

export const complianceDashboard = {
  title: 'Audit readiness before the export',
  items: [
    {
      title: 'Audit Readiness Centre',
      body: 'Last 90 days at a glance: completed jobs, missing signatures, qualifications expiring within 90 days, and open compliance issues.',
    },
    {
      title: 'Compliance health score (0–100)',
      body: 'Weighted score penalising missing signatures, expired qualifications, jobs with compliance gaps, and overdue follow-ups — based on your company rules.',
    },
    {
      title: 'Follow-up queue',
      body: 'Overdue, today, and upcoming follow-ups from follow-up dates and notes — so revisits do not slip through.',
    },
    {
      title: 'Compliance alerts (Business+)',
      body: 'Missed recurring visits, overdue follow-ups, and contract gaps when active sites have not had a completed visit in 45 days.',
    },
  ],
};

export const complianceStewardship = {
  title: 'Rodenticide stewardship & professional standards',
  paragraphs: [
    'UK rodenticide stewardship expects pest controllers to maintain accurate, retrievable records of bait use, site assessments, and follow-ups. Paper logs are easy to lose and painful to assemble under time pressure.',
    'PestTrace does not replace your professional judgement or statutory obligations. It gives you structured digital records — treatment, bait use, photos, signatures, follow-ups, and technician qualifications — that you can search, filter, and export when proof is required.',
  ],
  disclaimer:
    'PestTrace is not affiliated with or endorsed by CRRU, BPCA, or HSE. Always follow your product labels, qualifications, and local regulatory requirements.',
};

export const complianceReports = {
  title: 'Reports & PDF exports (all paid plans)',
  body: 'Beyond the audit pack, the Reports page lets you filter jobs, bulk-update status, and export PDF or CSV with treatment details, rooms, bait boxes, poison used, photos, signatures, and certification sections — suitable for client handover and internal QA.',
};
