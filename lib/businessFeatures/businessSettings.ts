type JsonRecord = Record<string, unknown>;

export type BusinessNotificationSettings = {
  jobCompleteEmailToOwner: boolean;
  jobCompleteEmailToCustomer: boolean;
};

const DEFAULT_BUSINESS: BusinessNotificationSettings = {
  jobCompleteEmailToOwner: true,
  jobCompleteEmailToCustomer: false,
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null;
}

export function parseBusinessSettings(notificationPreferences: unknown): BusinessNotificationSettings {
  if (!isRecord(notificationPreferences)) return DEFAULT_BUSINESS;
  const raw = notificationPreferences.business;
  if (!isRecord(raw)) return DEFAULT_BUSINESS;
  return {
    jobCompleteEmailToOwner:
      typeof raw.jobCompleteEmailToOwner === 'boolean'
        ? raw.jobCompleteEmailToOwner
        : DEFAULT_BUSINESS.jobCompleteEmailToOwner,
    jobCompleteEmailToCustomer:
      typeof raw.jobCompleteEmailToCustomer === 'boolean'
        ? raw.jobCompleteEmailToCustomer
        : DEFAULT_BUSINESS.jobCompleteEmailToCustomer,
  };
}

export function mergeBusinessSettings(
  notificationPreferences: unknown,
  business: BusinessNotificationSettings,
): JsonRecord {
  const base = isRecord(notificationPreferences) ? notificationPreferences : {};
  return {
    ...base,
    business: {
      jobCompleteEmailToOwner: business.jobCompleteEmailToOwner,
      jobCompleteEmailToCustomer: business.jobCompleteEmailToCustomer,
    },
  };
}
