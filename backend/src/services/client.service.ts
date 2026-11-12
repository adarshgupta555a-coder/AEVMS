import crypto from "node:crypto";
import { prisma } from "../lib/prisma.js";
import {
  NotFoundError,
  ConflictError,
  BadRequestError,
} from "../utils/errors.js";
import { USERROLE } from "../generated/prisma/enums.js";
import { env } from "../config/env.js";
import { emailService } from "./email.service.js";
import type {
  CreateClientInput,
  UpdateClientInput,
  ClientQueryInput,
  UpdateClientStatusInput,
  ClientHistoryQueryInput,
} from "../validations/client.validation.js";

export class ClientService {
  /**
   * 1. Admin creates a Client:
   * - Create ONLY the client profile/record.
   * - Do NOT create a User account.
   * - Do NOT send any login credentials or invitation email.
   * - Client exists independently without portal access.
   */
  async createClient(data: CreateClientInput) {
    const email = data.email && data.email.trim() !== "" ? data.email.toLowerCase().trim() : null;

    if (email) {
      const existing = await prisma.client.findFirst({
        where: { email },
      });
      if (existing) {
        throw new ConflictError(`A client with email '${email}' already exists.`);
      }
    }

    return prisma.client.create({
      data: {
        name: data.name.trim(),
        phone: data.phone.trim(),
        email,
        address: data.address?.trim() || null,
        city: data.city?.trim() || null,
        notes: data.notes?.trim() || null,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            isActive: true,
          },
        },
        _count: {
          select: {
            event: true,
            invoice: true,
            quotations: true,
            payments: true,
          },
        },
      },
    });
  }

  /**
   * 2. Admin assigns Client Portal:
   * - Creates a new User account with role CLIENT linked to existing client.
   * - Uses email already stored in Client record.
   * - Prevents duplicate portal accounts.
   * - Generates secure, single-use, expiring invitation token.
   * - Sends activation email to client's registered email.
   */
  async assignPortal(clientId: string, expiresInHours = 24) {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      include: { user: true },
    });

    if (!client) {
      throw new NotFoundError(`Client with ID '${clientId}' was not found.`);
    }

    if (!client.email) {
      throw new BadRequestError(
        "Client must have an email address to assign portal access. Please update client profile with an email address first."
      );
    }

    // Prevent duplicate portal assignment (both active and pending invitation)
    if (client.user) {
      if (client.user.isActive) {
        throw new ConflictError(
          `Client '${client.name}' already has an active portal account (${client.user.email}).`
        );
      }
      throw new ConflictError(
        `Client '${client.name}' already has a portal account assigned with pending invitation (${client.user.email}). Use resend-invite to send a new invitation.`
      );
    }

    // Verify email is not already taken by another user
    const existingUser = await prisma.user.findUnique({
      where: { email: client.email },
    });
    if (existingUser) {
      throw new ConflictError(
        `A user account with email '${client.email}' is already registered for another account.`
      );
    }

    // Generate secure single-use expiring token (32 bytes hex)
    const rawToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

    // Persist user account with inactive status and invitation token
    const portalUser = await prisma.user.create({
      data: {
        name: client.name,
        email: client.email!,
        role: USERROLE.CLIENT,
        isActive: false,
        passwordHash: "$locked_pending_activation$",
        clientId: client.id,
        invitationToken: rawToken,
        invitationExpiresAt: expiresAt,
      },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        invitationExpiresAt: true,
      },
    });

    const activationUrl = `${env.CORS_ORIGIN}/activate-portal?token=${rawToken}`;

    // Safely deliver invitation email
    await emailService.sendPortalInvitation({
      to: client.email,
      clientName: client.name,
      activationUrl,
      expiresInHours,
    });

    return {
      client: {
        id: client.id,
        name: client.name,
        email: client.email,
      },
      user: portalUser,
      portalStatus: "INVITATION_PENDING",
      invitationToken: rawToken,
      invitationExpiresAt: expiresAt,
      activationUrl,
    };
  }

  /**
   * Check portal assignment and activation status for an existing client
   */
  async getPortalStatus(clientId: string) {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            isActive: true,
            invitationExpiresAt: true,
            createdAt: true,
          },
        },
      },
    });

    if (!client) {
      throw new NotFoundError(`Client with ID '${clientId}' was not found.`);
    }

    if (!client.user) {
      return {
        clientId: client.id,
        clientName: client.name,
        clientEmail: client.email,
        status: "NOT_ASSIGNED",
        canAssign: Boolean(client.email),
        message: client.email
          ? "Portal not yet assigned. Ready to assign."
          : "Portal cannot be assigned without client email.",
      };
    }

    if (client.user.isActive) {
      return {
        clientId: client.id,
        clientName: client.name,
        clientEmail: client.email,
        status: "ACTIVE",
        user: client.user,
        message: "Client portal is active and operational.",
      };
    }

    const isExpired =
      client.user.invitationExpiresAt &&
      new Date() > client.user.invitationExpiresAt;

    return {
      clientId: client.id,
      clientName: client.name,
      clientEmail: client.email,
      status: isExpired ? "INVITATION_EXPIRED" : "INVITATION_PENDING",
      user: client.user,
      canResend: true,
      message: isExpired
        ? "Invitation has expired. Admin can resend invitation."
        : "Invitation pending client activation.",
    };
  }

  /**
   * Resend an invitation token to an existing inactive client portal
   */
  async resendInvite(clientId: string, expiresInHours = 24) {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      include: { user: true },
    });

    if (!client) {
      throw new NotFoundError(`Client with ID '${clientId}' was not found.`);
    }

    if (!client.user) {
      throw new BadRequestError(
        "Client does not have a portal account assigned yet. Please assign portal first."
      );
    }

    if (client.user.isActive) {
      throw new BadRequestError(
        "Client portal account is already activated. Client can log in directly."
      );
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

    const updatedUser = await prisma.user.update({
      where: { id: client.user.id },
      data: {
        invitationToken: rawToken,
        invitationExpiresAt: expiresAt,
      },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        invitationExpiresAt: true,
      },
    });

    const activationUrl = `${env.CORS_ORIGIN}/activate-portal?token=${rawToken}`;

    await emailService.sendPortalInvitation({
      to: client.email!,
      clientName: client.name,
      activationUrl,
      expiresInHours,
    });

    return {
      clientId: client.id,
      user: updatedUser,
      portalStatus: "INVITATION_PENDING",
      invitationToken: rawToken,
      invitationExpiresAt: expiresAt,
      activationUrl,
    };
  }

  async getClients(query: ClientQueryInput) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (query.search && query.search.trim() !== "") {
      const s = query.search.trim();
      where.OR = [
        { name: { contains: s, mode: "insensitive" } },
        { phone: { contains: s } },
        { email: { contains: s, mode: "insensitive" } },
        { city: { contains: s, mode: "insensitive" } },
      ];
    }

    const [total, clients] = await Promise.all([
      prisma.client.count({ where }),
      prisma.client.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              role: true,
              isActive: true,
            },
          },
          _count: {
            select: {
              event: true,
              invoice: true,
              quotations: true,
              payments: true,
            },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      clients,
      meta: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  async getClientById(id: string, includeFullHistory = false) {
    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            isActive: true,
            invitationExpiresAt: true,
            createdAt: true,
          },
        },
        _count: {
          select: {
            event: true,
            invoice: true,
            quotations: true,
            payments: true,
          },
        },
        ...(includeFullHistory
          ? {
              event: {
                select: {
                  id: true,
                  eventNumber: true,
                  title: true,
                  eventDate: true,
                  status: true,
                  budget: true,
                },
                orderBy: { eventDate: "desc" as const },
              },
              invoice: {
                select: {
                  id: true,
                  invoiceNumber: true,
                  invoiceDate: true,
                  totalAmount: true,
                  status: true,
                },
                orderBy: { invoiceDate: "desc" as const },
              },
              payments: {
                select: {
                  id: true,
                  paymentNumber: true,
                  paymentDate: true,
                  amount: true,
                  paymentMethod: true,
                  status: true,
                },
                orderBy: { paymentDate: "desc" as const },
              },
              quotations: {
                select: {
                  id: true,
                  quotationNumber: true,
                  title: true,
                  totalAmount: true,
                  status: true,
                },
                orderBy: { createdAt: "desc" as const },
              },
            }
          : {}),
      },
    });

    if (!client) {
      throw new NotFoundError(`Client with ID '${id}' was not found.`);
    }

    return client;
  }

  async updateClient(id: string, data: UpdateClientInput) {
    const existing = await prisma.client.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundError(`Client with ID '${id}' was not found.`);
    }

    const email =
      data.email !== undefined
        ? data.email && data.email.trim() !== ""
          ? data.email.toLowerCase().trim()
          : null
        : existing.email;

    if (email && email !== existing.email) {
      const emailConflict = await prisma.client.findFirst({
        where: { email, id: { not: id } },
      });
      if (emailConflict) {
        throw new ConflictError(`Another client already uses email '${email}'.`);
      }
    }

    return prisma.client.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.phone !== undefined ? { phone: data.phone.trim() } : {}),
        ...(data.email !== undefined ? { email } : {}),
        ...(data.address !== undefined ? { address: data.address?.trim() || null } : {}),
        ...(data.city !== undefined ? { city: data.city?.trim() || null } : {}),
        ...(data.notes !== undefined ? { notes: data.notes?.trim() || null } : {}),
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            isActive: true,
          },
        },
        _count: {
          select: {
            event: true,
            invoice: true,
            quotations: true,
            payments: true,
          },
        },
      },
    });
  }

  async deleteClient(id: string) {
    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            event: true,
            invoice: true,
            quotations: true,
            payments: true,
          },
        },
        user: true,
      },
    });

    if (!client) {
      throw new NotFoundError(`Client with ID '${id}' was not found.`);
    }

    // Preserve financial and operational audit trail
    if (
      client._count.event > 0 ||
      client._count.invoice > 0 ||
      client._count.quotations > 0 ||
      client._count.payments > 0
    ) {
      throw new BadRequestError(
        "Cannot delete client with linked events, invoices, quotations, or payments. Deletion is restricted to preserve financial records."
      );
    }

    return prisma.$transaction(async (tx) => {
      // Delete client's calendar entries / activities
      await tx.calendarEntry.deleteMany({
        where: { clientId: id },
      });

      // If linked user exists, delete the user login account as well
      if (client.user) {
        await tx.user.delete({
          where: { id: client.user.id },
        });
      }

      return tx.client.delete({
        where: { id },
      });
    });
  }

  async linkUserAccount(clientId: string, userId: string) {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      include: { user: true },
    });

    if (!client) {
      throw new NotFoundError(`Client with ID '${clientId}' was not found.`);
    }

    if (client.user) {
      throw new ConflictError(
        `Client '${client.name}' is already linked to user account '${client.user.email}'.`
      );
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      throw new NotFoundError(`User with ID '${userId}' was not found.`);
    }

    if (targetUser.clientId) {
      throw new ConflictError(
        `User '${targetUser.email}' is already linked to another client (ID: ${targetUser.clientId}).`
      );
    }

    if (targetUser.role !== USERROLE.CLIENT) {
      throw new BadRequestError(
        `User role must be CLIENT to link to a client profile. Target user has role '${targetUser.role}'.`
      );
    }

    return prisma.user.update({
      where: { id: userId },
      data: { clientId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        clientId: true,
      },
    });
  }

  /**
   * Activate or deactivate client portal access
   */
  async updateClientStatus(clientId: string, isActive: boolean, reason?: string) {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            isActive: true,
          },
        },
      },
    });

    if (!client) {
      throw new NotFoundError(`Client with ID '${clientId}' was not found.`);
    }

    let updatedUser = client.user;

    if (client.user) {
      updatedUser = await prisma.user.update({
        where: { id: client.user.id },
        data: { isActive },
        select: {
          id: true,
          email: true,
          role: true,
          isActive: true,
        },
      });

      // If deactivated, revoke all active refresh tokens so user is immediately logged out
      if (!isActive) {
        await prisma.refreshToken.deleteMany({
          where: { userId: client.user.id },
        });
      }
    }

    // If reason is supplied, log it into client's audit notes
    if (reason && reason.trim() !== "") {
      const timestamp = new Date().toISOString();
      const tag = `[Status updated to ${isActive ? "ACTIVE" : "INACTIVE"} on ${timestamp}: ${reason.trim()}]`;
      const updatedNotes = client.notes ? `${client.notes}\n${tag}` : tag;
      await prisma.client.update({
        where: { id: clientId },
        data: { notes: updatedNotes },
      });
    }

    return {
      id: client.id,
      name: client.name,
      email: client.email,
      isActive,
      portalActive: client.user ? isActive : false,
      hasPortalAccount: Boolean(client.user),
      user: updatedUser,
      message: client.user
        ? `Client portal access successfully ${isActive ? "activated" : "deactivated"}.`
        : `Client marked as ${isActive ? "active" : "inactive"}. (No portal user account is linked to this client)`,
    };
  }

  /**
   * Get client's event history
   */
  async getClientEvents(clientId: string, query: ClientHistoryQueryInput = { page: 1, limit: 20 }) {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, name: true, email: true },
    });
    if (!client) {
      throw new NotFoundError(`Client with ID '${clientId}' was not found.`);
    }

    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { clientId };
    if (query.status && query.status.trim() !== "") {
      where.status = query.status.trim();
    }

    const [total, events] = await Promise.all([
      prisma.event.count({ where }),
      prisma.event.findMany({
        where,
        skip,
        take: limit,
        orderBy: { eventDate: "desc" },
      }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;
    return {
      client,
      events,
      meta: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  /**
   * Get client's quotations history
   */
  async getClientQuotations(clientId: string, query: ClientHistoryQueryInput = { page: 1, limit: 20 }) {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, name: true, email: true },
    });
    if (!client) {
      throw new NotFoundError(`Client with ID '${clientId}' was not found.`);
    }

    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { clientId };
    if (query.status && query.status.trim() !== "") {
      where.status = query.status.trim();
    }

    const [total, quotations] = await Promise.all([
      prisma.quotation.count({ where }),
      prisma.quotation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;
    return {
      client,
      quotations,
      meta: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  /**
   * Get client's invoices
   */
  async getClientInvoices(clientId: string, query: ClientHistoryQueryInput = { page: 1, limit: 20 }) {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, name: true, email: true },
    });
    if (!client) {
      throw new NotFoundError(`Client with ID '${clientId}' was not found.`);
    }

    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { clientId };
    if (query.status && query.status.trim() !== "") {
      where.status = query.status.trim();
    }

    const [total, invoices] = await Promise.all([
      prisma.invoice.count({ where }),
      prisma.invoice.findMany({
        where,
        skip,
        take: limit,
        orderBy: { invoiceDate: "desc" },
      }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;
    return {
      client,
      invoices,
      meta: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  /**
   * Get client's payment history
   */
  async getClientPayments(clientId: string, query: ClientHistoryQueryInput = { page: 1, limit: 20 }) {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, name: true, email: true },
    });
    if (!client) {
      throw new NotFoundError(`Client with ID '${clientId}' was not found.`);
    }

    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { clientId };
    if (query.status && query.status.trim() !== "") {
      where.status = query.status.trim();
    }

    const [total, payments] = await Promise.all([
      prisma.payment.count({ where }),
      prisma.payment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { paymentDate: "desc" },
      }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;
    return {
      client,
      payments,
      meta: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }
}

export const clientService = new ClientService();
