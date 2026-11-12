import type { Request, Response, NextFunction } from "express";
import { invoiceService } from "../services/invoice.service.js";
import { pdfService } from "../services/pdf.service.js";
import { sendSuccess } from "../utils/response.js";
import type {
  CreateInvoiceInput,
  UpdateInvoiceInput,
  UpdateInvoiceStatusInput,
  InvoiceQueryInput,
} from "../validations/invoice.validation.js";

export class InvoiceController {
  async createInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const invoice = await invoiceService.createInvoice(
        req.body as CreateInvoiceInput,
        req.user!.id
      );
      sendSuccess(res, invoice, "Invoice created successfully", 201);
    } catch (error) {
      next(error);
    }
  }

  async getInvoices(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { invoices, meta } = await invoiceService.getInvoices(
        req.query as unknown as InvoiceQueryInput,
        req.user!
      );
      sendSuccess(res, invoices, "Invoices retrieved successfully", 200, meta);
    } catch (error) {
      next(error);
    }
  }

  async getInvoiceById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const invoice = await invoiceService.getInvoiceById(
        req.params.id as string,
        req.user!
      );
      sendSuccess(res, invoice, "Invoice details retrieved successfully", 200);
    } catch (error) {
      next(error);
    }
  }

  async updateInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const invoice = await invoiceService.updateInvoice(
        req.params.id as string,
        req.body as UpdateInvoiceInput,
        req.user!.id
      );
      sendSuccess(res, invoice, "Invoice updated successfully", 200);
    } catch (error) {
      next(error);
    }
  }

  async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const invoice = await invoiceService.updateStatus(
        req.params.id as string,
        req.body as UpdateInvoiceStatusInput,
        req.user!
      );
      sendSuccess(
        res,
        invoice,
        `Invoice status transitioned to ${req.body.status} successfully`,
        200
      );
    } catch (error) {
      next(error);
    }
  }

  async deleteInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await invoiceService.deleteInvoice(req.params.id as string);
      sendSuccess(res, result, "Invoice deleted successfully", 200);
    } catch (error) {
      next(error);
    }
  }

  async calculateBalance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await invoiceService.calculateBalance(req.params.id as string);
      sendSuccess(res, result, "Invoice balance calculated successfully", 200);
    } catch (error) {
      next(error);
    }
  }

  async downloadInvoicePdf(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const invoice = await invoiceService.getInvoiceById(
        req.params.id as string,
        req.user!
      );
      const pdfBuffer = await pdfService.generateInvoicePdf(invoice as any);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `inline; filename="${invoice.invoiceNumber}.pdf"`
      );
      res.setHeader("Content-Length", pdfBuffer.length);
      res.end(pdfBuffer);
    } catch (error) {
      next(error);
    }
  }
}

export const invoiceController = new InvoiceController();
