import type { Request, Response, NextFunction } from "express";
import { quotationService } from "../services/quotation.service.js";
import { sendSuccess } from "../utils/response.js";
import type {
  CreateQuotationInput,
  UpdateQuotationInput,
  UpdateQuotationStatusInput,
  QuotationQueryInput,
  ConvertToEventInput,
} from "../validations/quotation.validation.js";

export class QuotationController {
  async createQuotation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const quotation = await quotationService.createQuotation(
        req.body as CreateQuotationInput,
        req.user!.id
      );
      sendSuccess(res, quotation, "Quotation created successfully", 201);
    } catch (error) {
      next(error);
    }
  }

  async getQuotations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { quotations, meta } = await quotationService.getQuotations(
        req.query as unknown as QuotationQueryInput,
        req.user!
      );
      sendSuccess(res, quotations, "Quotations retrieved successfully", 200, meta);
    } catch (error) {
      next(error);
    }
  }

  async getQuotationById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const quotation = await quotationService.getQuotationById(
        req.params.id as string,
        req.user!
      );
      sendSuccess(res, quotation, "Quotation retrieved successfully", 200);
    } catch (error) {
      next(error);
    }
  }

  async updateQuotation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const quotation = await quotationService.updateQuotation(
        req.params.id as string,
        req.body as UpdateQuotationInput,
        req.user!.id
      );
      sendSuccess(res, quotation, "Quotation updated successfully", 200);
    } catch (error) {
      next(error);
    }
  }

  async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const quotation = await quotationService.updateStatus(
        req.params.id as string,
        req.body as UpdateQuotationStatusInput,
        req.user!
      );
      sendSuccess(
        res,
        quotation,
        `Quotation status transitioned to ${req.body.status} successfully`,
        200
      );
    } catch (error) {
      next(error);
    }
  }

  async convertToEvent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await quotationService.convertToEvent(
        req.params.id as string,
        req.body as ConvertToEventInput,
        req.user!.id
      );
      sendSuccess(res, result, "Quotation converted to Event successfully", 201);
    } catch (error) {
      next(error);
    }
  }

  async deleteQuotation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await quotationService.deleteQuotation(req.params.id as string);
      sendSuccess(res, result, "Quotation deleted successfully", 200);
    } catch (error) {
      next(error);
    }
  }
}

export const quotationController = new QuotationController();
