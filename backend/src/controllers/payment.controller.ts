import type { Request, Response, NextFunction } from "express";
import { paymentService } from "../services/payment.service.js";
import { razorpayService } from "../services/razorpay.service.js";
import { sendSuccess } from "../utils/response.js";
import type {
  CreatePaymentInput,
  PaymentQueryInput,
  CreateRazorpayOrderInput,
  VerifyRazorpayPaymentInput,
} from "../validations/payment.validation.js";

export class PaymentController {
  async recordPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const payment = await paymentService.recordPayment(
        req.body as CreatePaymentInput,
        req.user!.id
      );
      sendSuccess(res, payment, "Payment recorded successfully", 201);
    } catch (error) {
      next(error);
    }
  }

  async getPayments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { payments, meta } = await paymentService.getPayments(
        req.query as unknown as PaymentQueryInput,
        req.user!
      );
      sendSuccess(res, payments, "Payments retrieved successfully", 200, meta);
    } catch (error) {
      next(error);
    }
  }

  async getPaymentById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const payment = await paymentService.getPaymentById(
        req.params.id as string,
        req.user!
      );
      sendSuccess(res, payment, "Payment details retrieved successfully", 200);
    } catch (error) {
      next(error);
    }
  }

  async deletePayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await paymentService.deletePayment(req.params.id as string);
      sendSuccess(res, result, "Payment deleted successfully", 200);
    } catch (error) {
      next(error);
    }
  }

  async createRazorpayOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const order = await razorpayService.createOrder(
        req.body as CreateRazorpayOrderInput,
        req.user!
      );
      sendSuccess(res, order, "Razorpay payment order created successfully", 201);
    } catch (error) {
      next(error);
    }
  }

  async verifyRazorpayPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await razorpayService.verifyPayment(
        req.body as VerifyRazorpayPaymentInput,
        req.user!
      );
      sendSuccess(res, result, result.message, 200);
    } catch (error) {
      next(error);
    }
  }
}

export const paymentController = new PaymentController();
