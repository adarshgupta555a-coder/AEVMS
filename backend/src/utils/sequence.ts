import { prisma } from "../lib/prisma.js";

/**
 * Thread-safe sequence generator for business entity numbers
 * Format: PREFIX-YYYY-XXXX (e.g. EVT-2026-0001, QUO-2026-0001, INV-2026-0001)
 */
export async function generateEventNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `EVT-${year}-`;

  const events = await prisma.event.findMany({
    where: {
      eventNumber: {
        startsWith: prefix,
      },
    },
    select: {
      eventNumber: true,
    },
  });

  let maxSeq = 0;
  for (const e of events) {
    const parts = e.eventNumber.split("-");
    const num = parseInt(parts[2] || "0", 10);
    if (!isNaN(num) && num > maxSeq) {
      maxSeq = num;
    }
  }

  const nextSeq = String(maxSeq + 1).padStart(4, "0");
  return `${prefix}${nextSeq}`;
}

export async function generateQuotationNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `QUO-${year}-`;

  const quotations = await prisma.quotation.findMany({
    where: {
      quotationNumber: {
        startsWith: prefix,
      },
    },
    select: {
      quotationNumber: true,
    },
  });

  let maxSeq = 0;
  for (const q of quotations) {
    const parts = q.quotationNumber.split("-");
    const num = parseInt(parts[2] || "0", 10);
    if (!isNaN(num) && num > maxSeq) {
      maxSeq = num;
    }
  }

  const nextSeq = String(maxSeq + 1).padStart(4, "0");
  return `${prefix}${nextSeq}`;
}

export async function generateInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;

  const invoices = await prisma.invoice.findMany({
    where: {
      invoiceNumber: {
        startsWith: prefix,
      },
    },
    select: {
      invoiceNumber: true,
    },
  });

  let maxSeq = 0;
  for (const inv of invoices) {
    const parts = inv.invoiceNumber.split("-");
    const num = parseInt(parts[2] || "0", 10);
    if (!isNaN(num) && num > maxSeq) {
      maxSeq = num;
    }
  }

  const nextSeq = String(maxSeq + 1).padStart(4, "0");
  return `${prefix}${nextSeq}`;
}

export async function generatePaymentNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `PAY-${year}-`;

  const payments = await prisma.payment.findMany({
    where: {
      paymentNumber: {
        startsWith: prefix,
      },
    },
    select: {
      paymentNumber: true,
    },
  });

  let maxSeq = 0;
  for (const pay of payments) {
    const parts = pay.paymentNumber.split("-");
    const num = parseInt(parts[2] || "0", 10);
    if (!isNaN(num) && num > maxSeq) {
      maxSeq = num;
    }
  }

  const nextSeq = String(maxSeq + 1).padStart(4, "0");
  return `${prefix}${nextSeq}`;
}
