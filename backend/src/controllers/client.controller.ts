import type { Request, Response, NextFunction } from "express";
import { clientService } from "../services/client.service.js";
import { sendSuccess } from "../utils/response.js";
import { assertClientOwnership } from "../utils/ownership.js";
import { USERROLE } from "../generated/prisma/enums.js";

export class ClientController {
  async createClient(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const client = await clientService.createClient(req.body);
      sendSuccess(res, client, "Client created successfully", 201);
    } catch (error) {
      next(error);
    }
  }

  async getClients(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { clients, meta } = await clientService.getClients(req.query as any);
      sendSuccess(res, clients, "Clients retrieved successfully", 200, meta);
    } catch (error) {
      next(error);
    }
  }

  async getClientById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = req.params.id as string;

      // Ownership enforcement: Admin can access any client; Client can only access own profile
      assertClientOwnership(req, clientId);

      const includeHistory = req.user?.role === USERROLE.ADMIN;
      const client = await clientService.getClientById(clientId, includeHistory);

      sendSuccess(res, client, "Client profile retrieved", 200);
    } catch (error) {
      next(error);
    }
  }

  async updateClient(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = req.params.id as string;
      const client = await clientService.updateClient(clientId, req.body);
      sendSuccess(res, client, "Client updated successfully", 200);
    } catch (error) {
      next(error);
    }
  }

  async deleteClient(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = req.params.id as string;
      await clientService.deleteClient(clientId);
      sendSuccess(res, null, "Client deleted successfully", 200);
    } catch (error) {
      next(error);
    }
  }

  async linkUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = req.params.id as string;
      const { userId } = req.body;
      const updatedUser = await clientService.linkUserAccount(clientId, userId);
      sendSuccess(res, updatedUser, "User account successfully linked to client", 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Admin API to assign portal access to an existing client
   */
  async assignPortal(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = req.params.id as string;
      const expiresInHours = req.body?.expiresInHours ? Number(req.body.expiresInHours) : 24;
      const result = await clientService.assignPortal(clientId, expiresInHours);
      sendSuccess(res, result, "Client portal assigned and invitation generated successfully", 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Admin API to inspect portal assignment and activation status
   */
  async getPortalStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = req.params.id as string;
      const result = await clientService.getPortalStatus(clientId);
      sendSuccess(res, result, "Client portal status retrieved", 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Admin API to resend portal activation invitation
   */
  async resendInvite(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = (req.params.clientId || req.params.id) as string;
      const expiresInHours = req.body?.expiresInHours ? Number(req.body.expiresInHours) : 24;
      const result = await clientService.resendInvite(clientId, expiresInHours);
      sendSuccess(res, result, "Client portal invitation resent successfully", 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Admin API to activate or deactivate client portal access
   */
  async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = (req.params.clientId || req.params.id) as string;
      const { isActive, reason } = req.body;
      const result = await clientService.updateClientStatus(clientId, isActive, reason);
      sendSuccess(res, result, `Client status updated to ${isActive ? "active" : "inactive"} successfully`, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get client's event history (Admin or matching Client)
   */
  async getEvents(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = (req.params.clientId || req.params.id) as string;
      assertClientOwnership(req, clientId);
      const { client, events, meta } = await clientService.getClientEvents(clientId, req.query as any);
      sendSuccess(res, { client, events }, "Client events retrieved successfully", 200, meta);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get client's quotation history (Admin or matching Client)
   */
  async getQuotations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = (req.params.clientId || req.params.id) as string;
      assertClientOwnership(req, clientId);
      const { client, quotations, meta } = await clientService.getClientQuotations(clientId, req.query as any);
      sendSuccess(res, { client, quotations }, "Client quotations retrieved successfully", 200, meta);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get client's invoices (Admin or matching Client)
   */
  async getInvoices(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = (req.params.clientId || req.params.id) as string;
      assertClientOwnership(req, clientId);
      const { client, invoices, meta } = await clientService.getClientInvoices(clientId, req.query as any);
      sendSuccess(res, { client, invoices }, "Client invoices retrieved successfully", 200, meta);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get client's payment history (Admin or matching Client)
   */
  async getPayments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = (req.params.clientId || req.params.id) as string;
      assertClientOwnership(req, clientId);
      const { client, payments, meta } = await clientService.getClientPayments(clientId, req.query as any);
      sendSuccess(res, { client, payments }, "Client payments retrieved successfully", 200, meta);
    } catch (error) {
      next(error);
    }
  }
}

export const clientController = new ClientController();
