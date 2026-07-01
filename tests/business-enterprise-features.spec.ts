import { canUseBusinessFeatures, canUseEnterpriseFeatures } from '../lib/businessFeatures/planAccess';
import { calculateInvoiceTotals, invoicesToXeroCsv, xeroTaxTypeForVatRate } from '../lib/invoicing/invoiceService';
import { isMutatingBusinessMethod } from '../lib/businessFeatures/businessContext';
import { verifySignedPortalLink, createSignedPortalLink } from '../lib/portal/portalSignedLink';
import { hashPortalToken } from '../lib/portal/portalService';
import { test, expect } from '@playwright/test';

test('canUseBusinessFeatures gates business and enterprise only', () => {
  expect(canUseBusinessFeatures('pro')).toBe(false);
  expect(canUseBusinessFeatures('business')).toBe(true);
  expect(canUseBusinessFeatures('enterprise')).toBe(true);
});

test('canUseEnterpriseFeatures gates enterprise only', () => {
  expect(canUseEnterpriseFeatures('business')).toBe(false);
  expect(canUseEnterpriseFeatures('enterprise')).toBe(true);
});

test('business API write gate follows HTTP method', () => {
  expect(isMutatingBusinessMethod('GET')).toBe(false);
  expect(isMutatingBusinessMethod('POST')).toBe(true);
  expect(isMutatingBusinessMethod('PATCH')).toBe(true);
});

test('invoice VAT calculation', () => {
  const totals = calculateInvoiceTotals(100, 20);
  expect(totals.vatAmount).toBe(20);
  expect(totals.total).toBe(120);
});

test('Xero CSV uses each invoice stored VAT rate', () => {
  expect(xeroTaxTypeForVatRate(20)).toBe('20% (VAT on Income)');
  expect(xeroTaxTypeForVatRate(5)).toBe('5% (VAT on Income)');
  expect(xeroTaxTypeForVatRate(0)).toBe('Zero Rated Income');

  const csv = invoicesToXeroCsv([
    {
      number: 'INV-00001',
      issuedAt: new Date('2026-01-15'),
      dueAt: new Date('2026-01-29'),
      subtotal: { toString: () => '100' },
      vatRate: { toString: () => '5' },
      vatAmount: { toString: () => '5' },
      total: { toString: () => '105' },
      lineItems: [{ description: 'Flea treatment', quantity: 1, unitAmount: 100 }],
      customer: { name: 'Test Co' },
    },
  ]);
  expect(csv).toContain('5% (VAT on Income)');
  expect(csv).not.toContain('20% (VAT on Income)');
});

test('portal token hash is stable', () => {
  expect(hashPortalToken('abc')).toBe(hashPortalToken('abc'));
});

test('signed portal link verifies', () => {
  const companyId = 'company-1';
  const customerId = 'customer-1';
  const url = createSignedPortalLink(customerId, companyId, 1);
  const parsed = new URL(url);
  const exp = Number.parseInt(parsed.searchParams.get('exp') ?? '0', 10);
  const sig = parsed.searchParams.get('sig') ?? '';
  expect(verifySignedPortalLink(customerId, exp, sig, companyId)).toBe(true);
});
