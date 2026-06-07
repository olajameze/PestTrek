import { expect, test } from '@playwright/test';
import { buildActivationEvents } from '../lib/activation/companyActivation';

test.describe('activation event timestamps', () => {
  test('buildActivationEvents exposes ISO timestamps', () => {
    const customerAt = new Date('2026-06-01T10:00:00.000Z');
    const reportAt = new Date('2026-06-05T12:00:00.000Z');
    const events = buildActivationEvents({
      firstCustomerCreatedAt: customerAt,
      firstSiteCreatedAt: null,
      firstJobCompletedAt: null,
      firstPhotoUploadedAt: null,
      firstReportGeneratedAt: reportAt,
    });

    expect(events.first_customer_created).toBe(customerAt.toISOString());
    expect(events.first_site_created).toBeNull();
    expect(events.first_report_generated).toBe(reportAt.toISOString());
  });
});
