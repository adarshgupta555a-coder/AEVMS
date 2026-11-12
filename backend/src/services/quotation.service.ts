import { prisma, Prisma } from "../lib/prisma.js";
import {
  NotFoundError,
  BadRequestError,
  ForbiddenError,
} from "../utils/errors.js";
import {
  USERROLE,
  QuotationStatus,
  DiscountType,
  EventStatus,
} from "../generated/prisma/enums.js";
import { generateQuotationNumber, generateEventNumber } from "../utils/sequence.js";
import type { AuthenticatedUser } from "../types/auth.types.js";
import type {
  CreateQuotationInput,
  UpdateQuotationInput,
  UpdateQuotationStatusInput,
  QuotationQueryInput,
  ConvertToEventInput,
  QuotationItemInput,
} from "../validations/quotation.validation.js";

const ALLOWED_QUOTATION_TRANSITIONS: Record<QuotationStatus, QuotationStatus[]> = {
  [QuotationStatus.DRAFT]: [QuotationStatus.SENT, QuotationStatus.CANCELLED],
  [QuotationStatus.SENT]: [
    QuotationStatus.VIEWED,
    QuotationStatus.ACCEPTED,
    QuotationStatus.REJECTED,
    QuotationStatus.EXPIRED,
    QuotationStatus.CANCELLED,
  ],
  [QuotationStatus.VIEWED]: [
    QuotationStatus.ACCEPTED,
    QuotationStatus.REJECTED,
    QuotationStatus.EXPIRED,
    QuotationStatus.CANCELLED,
  ],
  [QuotationStatus.ACCEPTED]: [QuotationStatus.CANCELLED],
  [QuotationStatus.REJECTED]: [QuotationStatus.DRAFT, QuotationStatus.CANCELLED],
  [QuotationStatus.EXPIRED]: [QuotationStatus.DRAFT, QuotationStatus.CANCELLED],
  [QuotationStatus.CANCELLED]: [], // Terminal state
};

export interface CalculatedItem {
  itemName: string;
  description: string | null;
  quantity: number;
  unit: string | null;
  unitPrice: number;
  totalPrice: number;
  sortOrder: number;
}

export interface CalculatedQuotationTotals {
  calculatedItems: CalculatedItem[];
  subtotal: number;
  discountAmount: number;
  amountAfterDiscount: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
}

export function computeQuotationTotals(
  items: QuotationItemInput[],
  discountType?: DiscountType | null,
  discountValue = 0,
  taxRate = 0
): CalculatedQuotationTotals {
  const calculatedItems: CalculatedItem[] = items.map((item, index) => {
    const qty = Math.max(0, Number(item.quantity) || 0);
    const unitPrice = Math.max(0, Number(item.unitPrice) || 0);
    const totalPrice = Math.round(qty * unitPrice * 100) / 100;
    return {
      itemName: item.itemName.trim(),
      description: item.description?.trim() || null,
      quantity: qty,
      unit: item.unit?.trim() || null,
      unitPrice,
      totalPrice,
      sortOrder: item.sortOrder !== undefined ? Number(item.sortOrder) : index,
    };
  });

  const subtotalRaw = calculatedItems.reduce((acc, curr) => acc + curr.totalPrice, 0);
  const subtotal = Math.round(subtotalRaw * 100) / 100;

  let discountAmount = 0;
  if (discountType === DiscountType.PERCENTAGE) {
    const rate = Math.max(0, Math.min(100, Number(discountValue) || 0));
    discountAmount = Math.round(((subtotal * rate) / 100) * 100) / 100;
  } else if (discountType === DiscountType.FIXED) {
    const fixedVal = Math.max(0, Number(discountValue) || 0);
    discountAmount = Math.round(Math.min(subtotal, fixedVal) * 100) / 100;
  }

  const amountAfterDiscount = Math.max(0, Math.round((subtotal - discountAmount) * 100) / 100);

  const safeTaxRate = Math.max(0, Math.min(100, Number(taxRate) || 0));
  const taxAmount = Math.round(((amountAfterDiscount * safeTaxRate) / 100) * 100) / 100;

  const totalAmount = Math.round((amountAfterDiscount + taxAmount) * 100) / 100;

  return {
    calculatedItems,
    subtotal,
    discountAmount,
    amountAfterDiscount,
    taxRate: safeTaxRate,
    taxAmount,
    totalAmount,
  };
}

export class QuotationService {
  /**
   * Create a new Quotation with calculated line item totals, subtotal, tax and totalAmount.
   */
  async createQuotation(data: CreateQuotationInput, userId: string) {
    const client = await prisma.client.findUnique({
      where: { id: data.clientId },
    });
    if (!client) {
      throw new NotFoundError(`Client with ID '${data.clientId}' was not found.`);
    }

    const {
      calculatedItems,
      subtotal,
      discountAmount,
      taxAmount,
      totalAmount,
    } = computeQuotationTotals(
      data.items,
      data.discountType,
      data.discountValue,
      data.taxRate
    );

    let quotationNumber = await generateQuotationNumber();
    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      try {
        return await prisma.$transaction(async (tx) => {
          const quotation = await tx.quotation.create({
            data: {
              quotationNumber,
              clientId: data.clientId,
              title: data.title.trim(),
              eventType: data.eventType.trim(),
              eventDate: data.eventDate ? new Date(data.eventDate) : null,
              venue: data.venue?.trim() || null,
              guestCount: data.guestCount ?? null,
              subtotal: new Prisma.Decimal(subtotal.toFixed(2)),
              discountType: data.discountType || null,
              discountValue: new Prisma.Decimal(
                (data.discountValue !== undefined ? Number(data.discountValue) : 0).toFixed(2)
              ),
              taxRate: new Prisma.Decimal((data.taxRate !== undefined ? Number(data.taxRate) : 0).toFixed(2)),
              taxAmount: new Prisma.Decimal(taxAmount.toFixed(2)),
              totalAmount: new Prisma.Decimal(totalAmount.toFixed(2)),
              validUntil: data.validUntil ? new Date(data.validUntil) : null,
              status: QuotationStatus.DRAFT,
              notes: data.notes?.trim() || null,
              terms: data.terms?.trim() || null,
              createdById: userId,
              items: {
                create: calculatedItems.map((item) => ({
                  itemName: item.itemName,
                  description: item.description,
                  quantity: new Prisma.Decimal(item.quantity.toFixed(2)),
                  unit: item.unit,
                  unitPrice: new Prisma.Decimal(item.unitPrice.toFixed(2)),
                  totalPrice: new Prisma.Decimal(item.totalPrice.toFixed(2)),
                  sortOrder: item.sortOrder,
                })),
              },
            },
            include: {
              client: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  phone: true,
                },
              },
              createdBy: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  role: true,
                },
              },
              items: {
                orderBy: {
                  sortOrder: "asc",
                },
              },
              event: {
                select: {
                  id: true,
                  eventNumber: true,
                  status: true,
                },
              },
            },
          });

          return quotation;
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          attempts++;
          quotationNumber = await generateQuotationNumber();
          if (attempts >= maxAttempts) {
            throw error;
          }
        } else {
          throw error;
        }
      }
    }
  }

  /**
   * Get paginated quotations with RBAC scoping:
   * - Admin: sees all quotations across clients, can filter by clientId
   * - Client: sees ONLY their own client quotations
   */
  async getQuotations(query: QuotationQueryInput, user: AuthenticatedUser) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (user.role === USERROLE.CLIENT) {
      if (!user.clientId) {
        return {
          quotations: [],
          meta: {
            page,
            limit,
            total: 0,
            totalPages: 0,
          },
        };
      }
      where.clientId = user.clientId;
    } else if (user.role === USERROLE.ADMIN && query.clientId) {
      where.clientId = query.clientId;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.search && query.search.trim() !== "") {
      const search = query.search.trim();
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { quotationNumber: { contains: search, mode: "insensitive" } },
        { eventType: { contains: search, mode: "insensitive" } },
        { venue: { contains: search, mode: "insensitive" } },
      ];
    }

    if (query.from || query.to) {
      const dateFilter: Record<string, Date> = {};
      if (query.from) dateFilter.gte = new Date(query.from);
      if (query.to) dateFilter.lte = new Date(query.to);
      where.createdAt = dateFilter;
    }

    const [total, quotations] = await Promise.all([
      prisma.quotation.count({ where }),
      prisma.quotation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          client: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          items: {
            orderBy: {
              sortOrder: "asc",
            },
          },
          event: {
            select: {
              id: true,
              eventNumber: true,
              status: true,
            },
          },
          _count: {
            select: {
              items: true,
              event: true,
              invoiceItems: true,
            },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
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
   * Get a single quotation by ID.
   * Scoped to client for Client users.
   * Automatically transitions status to VIEWED if client views a SENT quotation.
   */
  async getQuotationById(id: string, user: AuthenticatedUser) {
    const quotation = await prisma.quotation.findUnique({
      where: { id },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            address: true,
            city: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        items: {
          orderBy: {
            sortOrder: "asc",
          },
        },
        event: {
          select: {
            id: true,
            eventNumber: true,
            title: true,
            status: true,
            eventDate: true,
          },
        },
      },
    });

    if (!quotation) {
      throw new NotFoundError(`Quotation with ID '${id}' was not found.`);
    }

    if (user.role === USERROLE.CLIENT) {
      if (quotation.clientId !== user.clientId) {
        throw new ForbiddenError(
          "Access denied. You can only view quotations associated with your client account."
        );
      }

      // Real-time CRM hook: Auto-mark as VIEWED when opened by client if status is SENT
      if (quotation.status === QuotationStatus.SENT) {
        const updated = await prisma.quotation.update({
          where: { id },
          data: { status: QuotationStatus.VIEWED },
          include: {
            client: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                address: true,
                city: true,
              },
            },
            createdBy: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
              },
            },
            items: {
              orderBy: {
                sortOrder: "asc",
              },
            },
            event: {
              select: {
                id: true,
                eventNumber: true,
                title: true,
                status: true,
                eventDate: true,
              },
            },
          },
        });
        return updated;
      }
    }

    return quotation;
  }

  /**
   * Update quotation details and line items (Admin only).
   */
  async updateQuotation(id: string, data: UpdateQuotationInput, _userId: string) {
    const existing = await prisma.quotation.findUnique({
      where: { id },
      include: {
        items: true,
        event: true,
      },
    });

    if (!existing) {
      throw new NotFoundError(`Quotation with ID '${id}' was not found.`);
    }

    if (
      existing.status === QuotationStatus.ACCEPTED ||
      existing.status === QuotationStatus.CANCELLED
    ) {
      throw new BadRequestError(
        `Cannot edit a quotation in status '${existing.status}'.`
      );
    }

    if (existing.event && existing.event.length > 0) {
      throw new BadRequestError(
        "Cannot edit a quotation that has already been converted to an event."
      );
    }

    // Determine items and totals
    const itemsToCompute = data.items
      ? data.items
      : existing.items.map((i) => ({
          itemName: i.itemName,
          description: i.description,
          quantity: Number(i.quantity),
          unit: i.unit,
          unitPrice: Number(i.unitPrice),
          sortOrder: i.sortOrder,
        }));

    const discountType =
      data.discountType !== undefined ? data.discountType : existing.discountType;
    const discountValue =
      data.discountValue !== undefined
        ? data.discountValue
        : Number(existing.discountValue);
    const taxRate =
      data.taxRate !== undefined ? data.taxRate : Number(existing.taxRate);

    const {
      calculatedItems,
      subtotal,
      taxAmount,
      totalAmount,
    } = computeQuotationTotals(itemsToCompute, discountType, discountValue, taxRate);

    return await prisma.$transaction(async (tx) => {
      // If new items were explicitly supplied, replace existing items
      if (data.items) {
        await tx.quotationItem.deleteMany({
          where: { quotationId: id },
        });

        await tx.quotationItem.createMany({
          data: calculatedItems.map((item) => ({
            quotationId: id,
            itemName: item.itemName,
            description: item.description,
            quantity: new Prisma.Decimal(item.quantity.toFixed(2)),
            unit: item.unit,
            unitPrice: new Prisma.Decimal(item.unitPrice.toFixed(2)),
            totalPrice: new Prisma.Decimal(item.totalPrice.toFixed(2)),
            sortOrder: item.sortOrder,
          })),
        });
      }

      const updated = await tx.quotation.update({
        where: { id },
        data: {
          ...(data.title !== undefined ? { title: data.title.trim() } : {}),
          ...(data.eventType !== undefined ? { eventType: data.eventType.trim() } : {}),
          ...(data.eventDate !== undefined
            ? { eventDate: data.eventDate ? new Date(data.eventDate) : null }
            : {}),
          ...(data.venue !== undefined ? { venue: data.venue?.trim() || null } : {}),
          ...(data.guestCount !== undefined ? { guestCount: data.guestCount } : {}),
          ...(data.discountType !== undefined ? { discountType: data.discountType } : {}),
          ...(data.discountValue !== undefined
            ? { discountValue: new Prisma.Decimal(Number(data.discountValue).toFixed(2)) }
            : {}),
          ...(data.taxRate !== undefined
            ? { taxRate: new Prisma.Decimal(Number(data.taxRate).toFixed(2)) }
            : {}),
          subtotal: new Prisma.Decimal(subtotal.toFixed(2)),
          taxAmount: new Prisma.Decimal(taxAmount.toFixed(2)),
          totalAmount: new Prisma.Decimal(totalAmount.toFixed(2)),
          ...(data.validUntil !== undefined
            ? { validUntil: data.validUntil ? new Date(data.validUntil) : null }
            : {}),
          ...(data.notes !== undefined ? { notes: data.notes?.trim() || null } : {}),
          ...(data.terms !== undefined ? { terms: data.terms?.trim() || null } : {}),
        },
        include: {
          client: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          items: {
            orderBy: {
              sortOrder: "asc",
            },
          },
          event: {
            select: {
              id: true,
              eventNumber: true,
              status: true,
            },
          },
        },
      });

      return updated;
    });
  }

  /**
   * Update quotation status with lifecycle tracking:
   * - Admin can execute any allowed transition
   * - Client can only ACCEPT or REJECT their own quotation when it is SENT or VIEWED
   */
  async updateStatus(
    id: string,
    data: UpdateQuotationStatusInput,
    user: AuthenticatedUser
  ) {
    const quotation = await prisma.quotation.findUnique({
      where: { id },
      include: {
        event: true,
        client: true,
      },
    });

    if (!quotation) {
      throw new NotFoundError(`Quotation with ID '${id}' was not found.`);
    }

    // Client role enforcement
    if (user.role === USERROLE.CLIENT) {
      if (quotation.clientId !== user.clientId) {
        throw new ForbiddenError(
          "Access denied. You can only update quotations associated with your client account."
        );
      }

      if (
        data.status !== QuotationStatus.ACCEPTED &&
        data.status !== QuotationStatus.REJECTED
      ) {
        throw new ForbiddenError(
          "Client users can only ACCEPT or REJECT quotations."
        );
      }

      if (
        quotation.status !== QuotationStatus.SENT &&
        quotation.status !== QuotationStatus.VIEWED
      ) {
        throw new BadRequestError(
          `Cannot respond to quotation in status '${quotation.status}'. Only SENT or VIEWED quotations can be responded to.`
        );
      }
    }

    // Idempotent: same status succeeds as no-op
    if (quotation.status === data.status) {
      return quotation;
    }

    // Allowed transition check
    const allowed = ALLOWED_QUOTATION_TRANSITIONS[quotation.status] || [];
    if (!allowed.includes(data.status)) {
      throw new BadRequestError(
        `Invalid status transition from '${quotation.status}' to '${data.status}'. Allowed transitions: [${allowed.join(
          ", "
        )}]`
      );
    }

    const updatePayload: Record<string, unknown> = {
      status: data.status,
    };

    const now = new Date();
    if (data.status === QuotationStatus.SENT && !quotation.sentAt) {
      updatePayload.sentAt = now;
    } else if (data.status === QuotationStatus.ACCEPTED && !quotation.acceptedAt) {
      updatePayload.acceptedAt = now;
    } else if (data.status === QuotationStatus.REJECTED && !quotation.rejectedAt) {
      updatePayload.rejectedAt = now;
    }

    if (data.notes && data.notes.trim() !== "") {
      const noteEntry = `[${now.toISOString()}] Status changed to ${data.status} by ${user.role}: ${data.notes.trim()}`;
      updatePayload.notes = quotation.notes
        ? `${quotation.notes}\n${noteEntry}`
        : noteEntry;
    }

    const updated = await prisma.quotation.update({
      where: { id },
      data: updatePayload,
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        items: {
          orderBy: {
            sortOrder: "asc",
          },
        },
        event: {
          select: {
            id: true,
            eventNumber: true,
            status: true,
          },
        },
      },
    });

    return updated;
  }

  /**
   * Delete quotation (Admin only).
   * Rejects deletion if quotation is linked to an Event or Invoice.
   */
  async deleteQuotation(id: string) {
    const quotation = await prisma.quotation.findUnique({
      where: { id },
      include: {
        event: true,
        invoiceItems: true,
      },
    });

    if (!quotation) {
      throw new NotFoundError(`Quotation with ID '${id}' was not found.`);
    }

    if (quotation.event && quotation.event.length > 0) {
      throw new BadRequestError(
        `Cannot delete quotation linked to existing event '${quotation.event[0]?.eventNumber}'. Please remove or unlink the event first.`
      );
    }

    if (quotation.invoiceItems && quotation.invoiceItems.length > 0) {
      throw new BadRequestError(
        "Cannot delete quotation linked to active invoices."
      );
    }

    await prisma.quotation.delete({
      where: { id },
    });

    return { id, message: "Quotation deleted successfully" };
  }

  /**
   * Convert an accepted quotation directly into an Event.
   * Auto-sets quotation status to ACCEPTED, generates eventNumber, and links via Event.quotationId.
   */
  async convertToEvent(
    id: string,
    eventData: ConvertToEventInput,
    userId: string
  ) {
    const quotation = await prisma.quotation.findUnique({
      where: { id },
      include: {
        event: true,
        client: true,
      },
    });

    if (!quotation) {
      throw new NotFoundError(`Quotation with ID '${id}' was not found.`);
    }

    if (quotation.event && quotation.event.length > 0) {
      throw new BadRequestError(
        `Quotation has already been converted to event '${quotation.event[0]?.eventNumber}'.`
      );
    }

    if (quotation.status === QuotationStatus.CANCELLED) {
      throw new BadRequestError("Cannot convert a CANCELLED quotation to an event.");
    }

    if (quotation.status === QuotationStatus.REJECTED) {
      throw new BadRequestError("Cannot convert a REJECTED quotation to an event.");
    }

    if (quotation.status === QuotationStatus.EXPIRED) {
      throw new BadRequestError("Cannot convert an EXPIRED quotation to an event.");
    }

    let eventNumber = await generateEventNumber();
    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      try {
        return await prisma.$transaction(async (tx) => {
          // Transition quotation to ACCEPTED if not already accepted
          const now = new Date();
          const updatedQuotation = await tx.quotation.update({
            where: { id },
            data: {
              status: QuotationStatus.ACCEPTED,
              acceptedAt: quotation.acceptedAt || now,
            },
          });

          // Create the confirmed Event
          const event = await tx.event.create({
            data: {
              eventNumber,
              clientId: quotation.clientId,
              quotationId: quotation.id,
              title: eventData.title?.trim() || quotation.title,
              eventType: eventData.eventType?.trim() || quotation.eventType,
              description:
                eventData.notes?.trim() || quotation.notes || null,
              eventDate: eventData.eventDate
                ? new Date(eventData.eventDate)
                : quotation.eventDate || new Date(),
              startTime: eventData.startTime ? new Date(eventData.startTime) : null,
              endTime: eventData.endTime ? new Date(eventData.endTime) : null,
              venueName: eventData.venueName?.trim() || quotation.venue || null,
              venueAddress: eventData.venueAddress?.trim() || null,
              guestCount:
                eventData.guestCount !== undefined && eventData.guestCount !== null
                  ? eventData.guestCount
                  : quotation.guestCount ?? null,
              budget:
                eventData.budget !== undefined && eventData.budget !== null
                  ? new Prisma.Decimal(eventData.budget)
                  : quotation.totalAmount,
              status: EventStatus.CONFIRMED,
              notes:
                eventData.notes?.trim() ||
                `Converted from Quotation ${quotation.quotationNumber}`,
              createdById: userId,
            },
            include: {
              client: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  phone: true,
                },
              },
              createdBy: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  role: true,
                },
              },
            },
          });

          return {
            quotation: updatedQuotation,
            event,
          };
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          attempts++;
          eventNumber = await generateEventNumber();
          if (attempts >= maxAttempts) {
            throw error;
          }
        } else {
          throw error;
        }
      }
    }
  }
}

export const quotationService = new QuotationService();
