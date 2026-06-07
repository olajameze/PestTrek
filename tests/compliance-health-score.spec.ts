import { expect, test } from '@playwright/test';
import { computeComplianceHealthScore } from '../lib/compliance/healthScore';
import { getQualificationAlertThreshold } from '../lib/compliance/qualificationAlerts';

test.describe('compliance health score', () => {
  test('returns 100 for compliant dataset', () => {
    const result = computeComplianceHealthScore(
      [
        {
          status: 'completed',
          signature: 'data:image/png;base64,abc',
          photoUrl: 'path/photo.jpg',
          photos: [],
          followUpDate: null,
        },
      ],
      [{ expiryDate: new Date(Date.now() + 30 * 86400000) }],
      { requireSignature: true, requirePhotos: true },
    );
    expect(result.score).toBeGreaterThanOrEqual(85);
    expect(result.warnings).toHaveLength(0);
  });

  test('penalizes expired qualifications', () => {
    const result = computeComplianceHealthScore(
      [],
      [{ expiryDate: new Date(Date.now() - 86400000) }],
      { requireSignature: false, requirePhotos: false },
    );
    expect(result.score).toBeLessThan(100);
    expect(result.warnings.some((w) => w.code === 'expired_qualifications')).toBe(true);
  });
});

test.describe('qualification alert thresholds', () => {
  test('matches exact day thresholds', () => {
    const now = new Date('2026-06-01T12:00:00.000Z');
    const in30 = new Date('2026-07-01T12:00:00.000Z');
    expect(getQualificationAlertThreshold(in30, now)).toBe(30);
    const expired = new Date('2026-05-30T12:00:00.000Z');
    expect(getQualificationAlertThreshold(expired, now)).toBe('expired');
  });
});
