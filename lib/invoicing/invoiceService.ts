import { Prisma, type PrismaClient } from '@prisma/client';
import { NotFoundError, ValidationError } from '../scheduling/validation';

export type InvoiceLineItem = {
  description: string;
  quantity: number;
  unitAmount: number;
};

export function calculateInvoiceTotals(subtotal: number, vatRate: number) {
  const vatAmount = Math.round(subtotal * (vatRate / 100) * 100) / 100;
  const total = Math.round((subtotal + vatAmount) * 100) / 100;
  return { subtotal, vatRate, vatAmount, total };
}

async function nextInvoiceNumber(prisma: PrismaClient, companyId: string): Promise<string> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { invoicePrefix: true, nextInvoiceNumber: true },
  });
  const prefix = company?.invoicePrefix?.trim() || 'INV';
  const num = company?.nextInvoiceNumber ?? 1;
  await prisma.company.update({
    where: { id: companyId },
    data: { nextInvoiceNumber: num + 1 },
  });
  return `${prefix}-${String(num).padStart(5, '0')}`;
}

export async function createInvoiceFromLogbookEntry(
  prisma: PrismaClient,
  companyId: string,
  logbookEntryId: string,
) {
  const entry = await prisma.logbookEntry.findFirst({
    where: { id: logbookEntryId, companyId },
    include: { customer: true, site: true },
  });
  if (!entry) throw new NotFoundError('Logbook entry not found');
  if ((entry.status ?? '').toLowerCase() !== 'completed') {
    throw new ValidationError('Invoice can only be created from completed jobs');
  }
  if (!entry.customerId) {
    throw new ValidationError('Link this job to a customer before invoicing');
  }

  const existing = await prisma.invoice.findFirst({
    where: { companyId, logbookEntryId },
  });
  if (existing) return existing;

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { defaultVatRate: true },
  });
  const vatRate = company?.defaultVatRate ? Number(company.defaultVatRate) : 20;
  const unitAmount = entry.price ? Number(entry.price) : 0;
  const lineItems: InvoiceLineItem[] = [
    {
      description: entry.treatment + (entry.productAmount ? ` (${entry.productAmount})` : ''),
      quantity: 1,
      unitAmount,
    },
  ];
  const subtotal = unitAmount;
  const totals = calculateInvoiceTotals(subtotal, vatRate);
  const number = await nextInvoiceNumber(prisma, companyId);
  const issuedAt = new Date();
  const dueAt = new Date(issuedAt);
  dueAt.setDate(dueAt.getDate() + 14);

  return prisma.invoice.create({
    data: {
      companyId,
      customerId: entry.customerId,
      siteId: entry.siteId,
      logbookEntryId: entry.id,
      number,
      status: 'draft',
      issuedAt,
      dueAt,
      subtotal: new Prisma.Decimal(totals.subtotal),
      vatRate: new Prisma.Decimal(totals.vatRate),
      vatAmount: new Prisma.Decimal(totals.vatAmount),
      total: new Prisma.Decimal(totals.total),
      lineItems: lineItems as unknown as Prisma.InputJsonValue,
    },
    include: { customer: true, site: true },
  });
}

export async function listInvoices(prisma: PrismaClient, companyId: string) {
  return prisma.invoice.findMany({
    where: { companyId },
    orderBy: { issuedAt: 'desc' },
    select: {
      id: true,
      number: true,
      status: true,
      issuedAt: true,
      dueAt: true,
      subtotal: true,
      vatRate: true,
      vatAmount: true,
      total: true,
      lineItems: true,
      customer: { select: { id: true, name: true, email: true } },
      site: { select: { id: true, address: true, postcode: true } },
    },
  });
}

export async function getInvoice(prisma: PrismaClient, companyId: string, invoiceId: string) {
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, companyId },
    include: {
      customer: true,
      site: true,
      logbookEntry: true,
      company: { select: { name: true, address: true, vatNumber: true, email: true, phone: true } },
    },
  });
  if (!invoice) throw new NotFoundError('Invoice not found');
  return invoice;
}

export async function updateInvoiceStatus(
  prisma: PrismaClient,
  companyId: string,
  invoiceId: string,
  status: 'draft' | 'sent' | 'paid',
) {
  await getInvoice(prisma, companyId, invoiceId);
  return prisma.invoice.update({
    where: { id: invoiceId },
    data: { status },
  });
}

/**
 * Maps stored VAT % to Xero manual-import TaxType labels (UK org defaults).
 * AccountCode 200 = sales; adjust in Xero if your chart differs.
 */
export function xeroTaxTypeForVatRate(vatRate: number): string {
  const rate = Math.round(vatRate * 100) / 100;
  if (rate === 20) return '20% (VAT on Income)';
  if (rate === 5) return '5% (VAT on Income)';
  if (rate === 0) return 'Zero Rated Income';
  return `${rate}% (VAT on Income)`;
}

export function invoicesToXeroCsv(
  invoices: Array<{
    number: string;
    issuedAt: Date;
    dueAt: Date | null;
    subtotal: { toString(): string };
    vatRate: { toString(): string };
    vatAmount: { toString(): string };
    total: { toString(): string };
    lineItems: unknown;
    customer: { name: string };
  }>,
): string {
  const header = 'ContactName,InvoiceNumber,InvoiceDate,DueDate,Description,Quantity,UnitAmount,TaxType,AccountCode';
  const rows = invoices.flatMap((inv) => {
    const items = Array.isArray(inv.lineItems) ? (inv.lineItems as InvoiceLineItem[]) : [];
    const taxType = xeroTaxTypeForVatRate(Number(inv.vatRate));
    return items.map((item, idx) => {
      const cols = [
        `"${inv.customer.name.replace(/"/g, '""')}"`,
        `"${inv.number}"`,
        inv.issuedAt.toISOString().slice(0, 10),
        inv.dueAt ? inv.dueAt.toISOString().slice(0, 10) : '',
        `"${item.description.replace(/"/g, '""')}"`,
        String(item.quantity),
        item.unitAmount.toFixed(2),
        idx === 0 ? taxType : '',
        '200',
      ];
      return cols.join(',');
    });
  });
  return [header, ...rows].join('\n');
}
