import type { NextApiRequest } from 'next';

type JsonRecord = Record<string, unknown>;

export type NpsResponse = {
  score: number;
  comment?: string;
  submittedAt: string;
};

export type EnterpriseSecurityConfig = {
  ipAllowlistEnabled: boolean;
  allowedIps: string[];
  requireVerifiedEmail: boolean;
};

export type EnterpriseAccountManager = {
  name: string;
  email: string;
  phone: string;
};

export type EnterpriseBrandingConfig = {
  logoUrl: string;
  primaryColor: string;
  footerText: string;
  portalWelcomeText: string;
};

export type EnterpriseSettings = {
  accountManager: EnterpriseAccountManager;
  security: EnterpriseSecurityConfig;
  npsResponses: NpsResponse[];
  branding: EnterpriseBrandingConfig;
};

const DEFAULT_BRANDING: EnterpriseBrandingConfig = {
  logoUrl: '',
  primaryColor: '#2563EB',
  footerText: '',
  portalWelcomeText: 'View your service history and download reports.',
};

const DEFAULT_SETTINGS: EnterpriseSettings = {
  accountManager: {
    name: '',
    email: '',
    phone: '',
  },
  security: {
    ipAllowlistEnabled: false,
    allowedIps: [],
    requireVerifiedEmail: true,
  },
  npsResponses: [],
  branding: DEFAULT_BRANDING,
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null;
}

export function parseEnterpriseSettings(notificationPreferences: unknown): EnterpriseSettings {
  if (!isRecord(notificationPreferences)) return DEFAULT_SETTINGS;
  const enterpriseRaw = notificationPreferences.enterprise;
  if (!isRecord(enterpriseRaw)) return DEFAULT_SETTINGS;

  const accountManagerRaw = isRecord(enterpriseRaw.accountManager) ? enterpriseRaw.accountManager : {};
  const securityRaw = isRecord(enterpriseRaw.security) ? enterpriseRaw.security : {};
  const brandingRaw = isRecord(enterpriseRaw.branding) ? enterpriseRaw.branding : {};
  const npsResponsesRaw = Array.isArray(enterpriseRaw.npsResponses) ? enterpriseRaw.npsResponses : [];

  const npsResponses = npsResponsesRaw
    .filter((value): value is JsonRecord => isRecord(value))
    .map((item) => ({
      score: typeof item.score === 'number' ? item.score : Number(item.score),
      comment: typeof item.comment === 'string' ? item.comment : undefined,
      submittedAt:
        typeof item.submittedAt === 'string' && item.submittedAt
          ? item.submittedAt
          : new Date().toISOString(),
    }))
    .filter((item) => Number.isFinite(item.score) && item.score >= 0 && item.score <= 10)
    .sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime());

  return {
    accountManager: {
      name: typeof accountManagerRaw.name === 'string' ? accountManagerRaw.name : '',
      email: typeof accountManagerRaw.email === 'string' ? accountManagerRaw.email : '',
      phone: typeof accountManagerRaw.phone === 'string' ? accountManagerRaw.phone : '',
    },
    security: {
      ipAllowlistEnabled: Boolean(securityRaw.ipAllowlistEnabled),
      allowedIps: Array.isArray(securityRaw.allowedIps)
        ? securityRaw.allowedIps.filter((ip): ip is string => typeof ip === 'string' && ip.trim().length > 0)
        : [],
      requireVerifiedEmail:
        typeof securityRaw.requireVerifiedEmail === 'boolean'
          ? securityRaw.requireVerifiedEmail
          : true,
    },
    npsResponses,
    branding: {
      logoUrl: typeof brandingRaw.logoUrl === 'string' ? brandingRaw.logoUrl : DEFAULT_BRANDING.logoUrl,
      primaryColor:
        typeof brandingRaw.primaryColor === 'string' && brandingRaw.primaryColor.trim()
          ? brandingRaw.primaryColor.trim()
          : DEFAULT_BRANDING.primaryColor,
      footerText: typeof brandingRaw.footerText === 'string' ? brandingRaw.footerText : DEFAULT_BRANDING.footerText,
      portalWelcomeText:
        typeof brandingRaw.portalWelcomeText === 'string' && brandingRaw.portalWelcomeText.trim()
          ? brandingRaw.portalWelcomeText.trim()
          : DEFAULT_BRANDING.portalWelcomeText,
    },
  };
}

export function mergeEnterpriseSettings(
  notificationPreferences: unknown,
  enterpriseSettings: EnterpriseSettings,
): JsonRecord {
  const base = isRecord(notificationPreferences) ? notificationPreferences : {};
  return {
    ...base,
    enterprise: {
      accountManager: enterpriseSettings.accountManager,
      security: enterpriseSettings.security,
      npsResponses: enterpriseSettings.npsResponses.slice(-200),
      branding: enterpriseSettings.branding,
    },
  };
}

export function getRequestIp(req: NextApiRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim().length > 0) {
    return forwarded.split(',')[0]?.trim() || '';
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0]?.split(',')[0]?.trim() || '';
  }
  const socketAddress = req.socket.remoteAddress || '';
  return socketAddress.replace('::ffff:', '');
}

export function isIpAllowed(ip: string, allowedIps: string[]): boolean {
  if (!ip) return false;
  const normalized = ip.replace('::ffff:', '');
  return allowedIps.some((allowed) => allowed.trim() === normalized);
}

