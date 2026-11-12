import PDFDocument from "pdfkit";
import type { Prisma } from "../lib/prisma.js";

export interface InvoicePdfData {
  invoiceNumber: string;
  title: string;
  invoiceDate: Date;
  dueDate: Date | null;
  status: string;
  subtotal: number | Prisma.Decimal | string;
  discountType?: string | null;
  discountValue?: number | Prisma.Decimal | string;
  taxRate: number | Prisma.Decimal | string;
  taxAmount: number | Prisma.Decimal | string;
  totalAmount: number | Prisma.Decimal | string;
  paidAmount?: number;
  balanceAmount?: number;
  notes?: string | null;
  terms?: string | null;
  client: {
    name: string;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    city?: string | null;
  };
  event?: {
    eventNumber: string;
    title: string;
    eventDate?: Date | null;
  } | null;
  items: Array<{
    itemName: string;
    description?: string | null;
    quantity: number | Prisma.Decimal | string;
    unit?: string | null;
    unitPrice: number | Prisma.Decimal | string;
    totalPrice: number | Prisma.Decimal | string;
    type?: string;
  }>;
}

export class PdfService {
  /**
   * Generates a professional tax invoice PDF as a Buffer.
   * Can be served via Express response or attached to Nodemailer emails.
   */
  async generateInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: "A4" });
      const buffers: Buffer[] = [];

      doc.on("data", (chunk: Buffer) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", reject);

      const primaryColor = "#1e3a8a"; // Deep Indigo
      const secondaryColor = "#4b5563"; // Slate Gray
      const lightBg = "#f3f4f6";

      // -----------------------------------------------------------------------
      // Header / Brand
      // -----------------------------------------------------------------------
      doc
        .fillColor(primaryColor)
        .fontSize(22)
        .text("EVENT MANAGEMENT SYSTEM", 40, 40, { bold: true } as any);

      doc
        .fillColor(secondaryColor)
        .fontSize(9)
        .text("Premier Event Planning, Production & Operations", 40, 68);

      // Invoice Badge / Title
      doc
        .fillColor(primaryColor)
        .fontSize(20)
        .text("TAX INVOICE", 400, 40, { align: "right", bold: true } as any);

      doc
        .fillColor(secondaryColor)
        .fontSize(10)
        .text(`Invoice #: ${data.invoiceNumber}`, 400, 65, { align: "right" })
        .text(`Date: ${new Date(data.invoiceDate).toLocaleDateString("en-IN")}`, 400, 78, { align: "right" })
        .text(`Status: ${data.status}`, 400, 91, { align: "right" });

      if (data.dueDate) {
        doc.text(`Due Date: ${new Date(data.dueDate).toLocaleDateString("en-IN")}`, 400, 104, { align: "right" });
      }

      // Horizontal Divider
      doc
        .strokeColor("#e5e7eb")
        .lineWidth(1)
        .moveTo(40, 120)
        .lineTo(555, 120)
        .stroke();

      // -----------------------------------------------------------------------
      // Client & Event Details
      // -----------------------------------------------------------------------
      const startInfoY = 130;
      doc
        .fillColor(primaryColor)
        .fontSize(11)
        .text("BILLED TO:", 40, startInfoY, { bold: true } as any);

      doc
        .fillColor("#111827")
        .fontSize(10)
        .text(data.client.name, 40, startInfoY + 16, { bold: true } as any);

      let clientDetailsY = startInfoY + 30;
      if (data.client.phone) {
        doc.fillColor(secondaryColor).fontSize(9).text(`Phone: ${data.client.phone}`, 40, clientDetailsY);
        clientDetailsY += 13;
      }
      if (data.client.email) {
        doc.fillColor(secondaryColor).fontSize(9).text(`Email: ${data.client.email}`, 40, clientDetailsY);
        clientDetailsY += 13;
      }
      if (data.client.address || data.client.city) {
        const addr = [data.client.address, data.client.city].filter(Boolean).join(", ");
        doc.fillColor(secondaryColor).fontSize(9).text(`Address: ${addr}`, 40, clientDetailsY);
        clientDetailsY += 13;
      }

      if (data.event) {
        doc
          .fillColor(primaryColor)
          .fontSize(11)
          .text("EVENT DETAILS:", 340, startInfoY, { bold: true } as any);

        doc
          .fillColor("#111827")
          .fontSize(10)
          .text(data.event.title, 340, startInfoY + 16, { bold: true } as any);

        let eventDetailsY = startInfoY + 30;
        doc.fillColor(secondaryColor).fontSize(9).text(`Event #: ${data.event.eventNumber}`, 340, eventDetailsY);
        eventDetailsY += 13;
        if (data.event.eventDate) {
          doc
            .fillColor(secondaryColor)
            .fontSize(9)
            .text(`Date: ${new Date(data.event.eventDate).toLocaleDateString("en-IN")}`, 340, eventDetailsY);
        }
      }

      // -----------------------------------------------------------------------
      // Line Items Table Header
      // -----------------------------------------------------------------------
      const tableTopY = Math.max(clientDetailsY + 15, 215);

      // Table Header Background
      doc.rect(40, tableTopY, 515, 22).fill(lightBg);

      doc
        .fillColor(primaryColor)
        .fontSize(9)
        .text("#", 45, tableTopY + 6, { bold: true } as any)
        .text("ITEM / SERVICE DESCRIPTION", 65, tableTopY + 6, { bold: true } as any)
        .text("QTY", 330, tableTopY + 6, { width: 40, align: "right", bold: true } as any)
        .text("UNIT PRICE (INR)", 380, tableTopY + 6, { width: 85, align: "right", bold: true } as any)
        .text("TOTAL (INR)", 475, tableTopY + 6, { width: 75, align: "right", bold: true } as any);

      // -----------------------------------------------------------------------
      // Line Items Rows
      // -----------------------------------------------------------------------
      let rowY = tableTopY + 28;

      data.items.forEach((item, index) => {
        const qty = Number(item.quantity);
        const price = Number(item.unitPrice);
        const total = Number(item.totalPrice);

        doc
          .fillColor("#374151")
          .fontSize(9)
          .text(`${index + 1}`, 45, rowY)
          .text(item.itemName, 65, rowY, { bold: true, width: 250 } as any);

        if (item.description) {
          doc
            .fillColor("#6b7280")
            .fontSize(8)
            .text(item.description, 65, rowY + 12, { width: 250 });
        }

        const unitText = item.unit ? ` ${item.unit}` : "";
        doc
          .fillColor("#374151")
          .fontSize(9)
          .text(`${qty}${unitText}`, 330, rowY, { width: 40, align: "right" })
          .text(`₹${price.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, 380, rowY, {
            width: 85,
            align: "right",
          })
          .text(`₹${total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, 475, rowY, {
            width: 75,
            align: "right",
          });

        const rowHeight = item.description ? 26 : 18;
        rowY += rowHeight;

        // Subtle row separator
        doc
          .strokeColor("#f3f4f6")
          .lineWidth(0.5)
          .moveTo(40, rowY - 2)
          .lineTo(555, rowY - 2)
          .stroke();
      });

      // -----------------------------------------------------------------------
      // Financial Totals Summary
      // -----------------------------------------------------------------------
      const summaryY = Math.max(rowY + 15, 450);

      const subtotalNum = Number(data.subtotal);
      const taxRateNum = Number(data.taxRate);
      const taxAmtNum = Number(data.taxAmount);
      const totalNum = Number(data.totalAmount);
      const paidNum = Number(data.paidAmount || 0);
      const balanceNum = data.balanceAmount !== undefined ? Number(data.balanceAmount) : Math.max(0, totalNum - paidNum);

      let totalsY = summaryY;

      // Subtotal
      doc
        .fillColor(secondaryColor)
        .fontSize(9)
        .text("Subtotal:", 350, totalsY, { width: 110, align: "right" })
        .text(`₹${subtotalNum.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, 465, totalsY, {
          width: 85,
          align: "right",
        });
      totalsY += 15;

      // Discount (if any)
      if (data.discountValue && Number(data.discountValue) > 0) {
        const discountLabel =
          data.discountType === "PERCENTAGE"
            ? `Discount (${data.discountValue}%):`
            : "Discount (Fixed):";
        doc
          .fillColor("#059669")
          .fontSize(9)
          .text(discountLabel, 350, totalsY, { width: 110, align: "right" })
          .text(`- ₹${Number(data.discountValue).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, 465, totalsY, {
            width: 85,
            align: "right",
          });
        totalsY += 15;
      }

      // Tax
      if (taxRateNum > 0) {
        doc
          .fillColor(secondaryColor)
          .fontSize(9)
          .text(`Tax / GST (${taxRateNum}%):`, 350, totalsY, { width: 110, align: "right" })
          .text(`₹${taxAmtNum.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, 465, totalsY, {
            width: 85,
            align: "right",
          });
        totalsY += 15;
      }

      // Total Line
      doc
        .strokeColor("#e5e7eb")
        .lineWidth(1)
        .moveTo(350, totalsY)
        .lineTo(555, totalsY)
        .stroke();
      totalsY += 4;

      doc
        .fillColor(primaryColor)
        .fontSize(11)
        .text("Total Amount:", 350, totalsY, { width: 110, align: "right", bold: true } as any)
        .text(`₹${totalNum.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, 465, totalsY, {
          width: 85,
          align: "right",
          bold: true,
        } as any);
      totalsY += 18;

      // Paid & Balance
      doc
        .fillColor("#059669")
        .fontSize(9)
        .text("Paid Amount:", 350, totalsY, { width: 110, align: "right" })
        .text(`₹${paidNum.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, 465, totalsY, {
          width: 85,
          align: "right",
        });
      totalsY += 14;

      doc
        .fillColor(balanceNum > 0 ? "#dc2626" : "#059669")
        .fontSize(10)
        .text("Balance Due:", 350, totalsY, { width: 110, align: "right", bold: true } as any)
        .text(`₹${balanceNum.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, 465, totalsY, {
          width: 85,
          align: "right",
          bold: true,
        } as any);

      // -----------------------------------------------------------------------
      // Notes & Terms (Left column)
      // -----------------------------------------------------------------------
      let notesY = summaryY;
      if (data.notes) {
        doc.fillColor(primaryColor).fontSize(9).text("Notes & Payment Instructions:", 40, notesY, { bold: true } as any);
        doc.fillColor(secondaryColor).fontSize(8).text(data.notes, 40, notesY + 12, { width: 280 });
        notesY += 40;
      }

      if (data.terms) {
        doc.fillColor(primaryColor).fontSize(9).text("Terms & Conditions:", 40, notesY, { bold: true } as any);
        doc.fillColor(secondaryColor).fontSize(8).text(data.terms, 40, notesY + 12, { width: 280 });
      }

      // -----------------------------------------------------------------------
      // Footer
      // -----------------------------------------------------------------------
      doc
        .strokeColor("#e5e7eb")
        .lineWidth(1)
        .moveTo(40, 750)
        .lineTo(555, 750)
        .stroke();

      doc
        .fillColor(secondaryColor)
        .fontSize(8)
        .text(
          "Thank you for choosing our event management services! This is a system-generated electronic tax invoice.",
          40,
          758,
          { align: "center", width: 515 }
        );

      doc.end();
    });
  }
}

export const pdfService = new PdfService();
