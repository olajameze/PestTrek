import { jsPDF } from 'jspdf';
import type { InvoiceLineItem } from './invoiceService';

export type InvoicePdfInput = {
  companyName: string;
  companyAddress?: string | null;
  companyEmail?: string | null;
  companyPhone?: string | null;
  vatNumber?: string | null;
  invoiceNumber: string;
  issuedAt: Date;
  dueAt: Date | null;
  customerName: string;
  customerEmail?: string | null;
  siteAddress?: string | null;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  total: number;
  primaryColor?: string;
  footerText?: string;
};

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  if (h.length !== 6) return [37, 99, 235];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function buildInvoicePdf(input: InvoicePdfInput): Buffer {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const [r, g, b] = hexToRgb(input.primaryColor ?? '#2563EB');
  doc.setFillColor(r, g, b);
  doc.rect(0, 0, 210, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.text(input.companyName || 'Invoice', 14, 16);
  doc.setFontSize(10);
  doc.text('INVOICE', 170, 16);

  doc.setTextColor(30, 41, 59);
  doc.setFontSize(10);
  let y = 38;
  doc.text(`Invoice #: ${input.invoiceNumber}`, 14, y);
  y += 6;
  doc.text(`Issued: ${input.issuedAt.toLocaleDateString('en-GB')}`, 14, y);
  if (input.dueAt) {
    y += 6;
    doc.text(`Due: ${input.dueAt.toLocaleDateString('en-GB')}`, 14, y);
  }
  y += 10;
  doc.text(`Bill to: ${input.customerName}`, 14, y);
  if (input.siteAddress) {
    y += 5;
    doc.text(input.siteAddress, 14, y);
  }
  y += 12;
  doc.setFillColor(248, 250, 252);
  doc.rect(14, y - 5, 182, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.text('Description', 16, y);
  doc.text('Qty', 130, y);
  doc.text('Amount', 170, y);
  doc.setFont('helvetica', 'normal');
  y += 8;
  for (const item of input.lineItems) {
    doc.text(item.description.slice(0, 60), 16, y);
    doc.text(String(item.quantity), 130, y);
    doc.text(`£${item.unitAmount.toFixed(2)}`, 170, y);
    y += 7;
  }
  y += 6;
  doc.text(`Subtotal: £${input.subtotal.toFixed(2)}`, 140, y);
  y += 6;
  doc.text(`VAT (${input.vatRate}%): £${input.vatAmount.toFixed(2)}`, 140, y);
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.text(`Total: £${input.total.toFixed(2)}`, 140, y);
  if (input.vatNumber) {
    y += 10;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`VAT No: ${input.vatNumber}`, 14, y);
  }
  const footer = input.footerText ?? 'Thank you for your business.';
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(footer, 14, 285);
  return Buffer.from(doc.output('arraybuffer'));
}
