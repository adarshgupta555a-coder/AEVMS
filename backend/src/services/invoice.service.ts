import { prisma, Prisma } from "../lib/prisma.js";
import {
  NotFoundError,
  BadRequestError,
  ForbiddenError,
} from "../utils/errors.js";
import {
  USERROLE,
  InvoiceStatus,
  InvoiceType,
  DiscountType,
} from "../generated/prisma/enums.js";
import { generateInvoiceNumber } from "../utils/sequence.js";
import { round2, toDecimal, calculateTotals } from "../utils/decimal.js";
import type { AuthenticatedUser } from "../types/auth.types.js";
import type {
  CreateInvoiceInput,
  UpdateInvoiceInput,
  UpdateInvoiceStatusInput,
  InvoiceQueryInput,
  InvoiceItemInput,
} from "../validations/invoice.validation.js";

const ALLOWED_INVOICE_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  [InvoiceStatus.DRAFT]: [InvoiceStatus.SENT, InvoiceStatus.CANCELLED],
  [InvoiceStatus.SENT]: [
    InvoiceStatus.OVERDUE,
    InvoiceStatus.CANCELLED,
    InvoiceStatus.PARTIALLY_PAID,
    InvoiceStatus.PAID,
  ],
  [InvoiceStatus.OVERDUE]: [
    InvoiceStatus.PARTIALLY_PAID,
    InvoiceStatus.PAID,
    InvoiceStatus.CANCELLED,
  ],
  [InvoiceStatus.PARTIALLY_PAID]: [
    InvoiceStatus.PAID,
    InvoiceStatus.OVERDUE,
    InvoiceStatus.CANCELLED,
  ],
  [InvoiceStatus.PAID]: [], // Terminal state
  [InvoiceStatus.CANCELLED]: [], // Terminal state
};

export interface CalculatedInvoiceItem {
  itemName: string;
  description: string | null;
  quantity: number;
  unit: string | null;
  unitPrice: number;
  totalPrice: number;
  sortOrder: number;
  type: InvoiceType;
  quotationId: string | null;
  advanceAdjusted: number;
}

export function computeInvoiceItemTotals(items: InvoiceItemInput[]): {
  calculatedItems: CalculatedInvoiceItem[];
  subtotal: number;
} {
  const calculatedItems: CalculatedInvoiceItem[] = items.map((item, index) => {
    const qty = Math.max(0, Number(item.quantity) || 0);
    const unitPrice = Math.max(0, Number(item.unitPrice) || 0);
    const totalPrice = round2(qty * unitPrice);
    const advanceAdjusted = Math.max(0, Number(item.advanceAdjusted) || 0);

    return {
      itemName: item.itemName.trim(),
      description: item.description?.trim() || null,
      quantity: qty,
      unit: item.unit?.trim() || null,
      unitPrice,
      totalPrice,
      sortOrder: item.sortOrder !== undefined ? Number(item.sortOrder) : index,
      type: item.type,
      quotationId: item.quotationId || null,
      advanceAdjusted,
    };
  });

  const subtotal = round2(
    calculatedItems.reduce((acc, curr) => acc + curr.totalPrice, 0)
  );

  return { calculatedItems, subtotal };
}

export class InvoiceService {
  /**
   * Create a new itemized Invoice with safe sequential numbering and precision totals.
   */
  async createInvoice(data: CreateInvoiceInput, userId: string) {
    const client = await prisma.client.findUnique({
      where: { id: data.clientId },
    });
    if (!client) {
      throw new NotFoundError(`Client with ID '${data.clientId}' was not found.`);
    }

    if (data.eventId) {
      const event = await prisma.event.findUnique({
        where: { id: data.eventId },
      });
      if (!event) {
        throw new NotFoundError(`Event with ID '${data.eventId}' was not found.`);
      }
      if (event.clientId !== data.clientId) {
        throw new BadRequestError("Event does not belong to the specified client.");
      }
    }

    const { calculatedItems, subtotal } = computeInvoiceItemTotals(data.items);
    const totals = calculateTotals(
      subtotal,
      data.discountType,
      data.discountValue,
      data.taxRate
    );

    let invoiceNumber = await generateInvoiceNumber();
    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      try {
        return await prisma.$transaction(async (tx) => {
          const invoice = await tx.invoice.create({
            data: {
              invoiceNumber,
              clientId: data.clientId,
              eventId: data.eventId || null,
              title: data.title.trim(),
              invoiceDate: new Date(data.invoiceDate),
              dueDate: data.dueDate ? new Date(data.dueDate) : null,
              subtotal: toDecimal(totals.subtotal),
              discountType: data.discountType || null,
              discountValue: toDecimal(data.discountValue || 0),
              taxRate: toDecimal(totals.taxRate),
              taxAmount: toDecimal(totals.taxAmount),
              totalAmount: toDecimal(totals.totalAmount),
              status: InvoiceStatus.DRAFT,
              notes: data.notes?.trim() || null,
              terms: data.terms?.trim() || null,
              createdById: userId,
              items: {
                create: calculatedItems.map((item) => ({
                  itemName: item.itemName,
                  description: item.description,
                  quantity: toDecimal(item.quantity),
                  unit: item.unit,
                  unitPrice: toDecimal(item.unitPrice),
                  totalPrice: toDecimal(item.totalPrice),
                  sortOrder: item.sortOrder,
                  type: item.type,
                  quotationId: item.quotationId,
                  advanceAdjusted: toDecimal(item.advanceAdjusted),
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
              event: {
                select: {
                  id: true,
                  eventNumber: true,
                  title: true,
                  status: true,
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
              paymentAllocations: true,
            },
          });

          return {
            ...invoice,
            paidAmount: 0,
            balanceAmount: Number(invoice.totalAmount),
          };
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          attempts++;
          invoiceNumber = await generateInvoiceNumber();
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
   * Get paginated invoices with RBAC scoping:
   * - Admin: sees all invoices, can filter by clientId or eventId
   * - Client: sees ONLY their own client invoices
   */
  async getInvoices(query: InvoiceQueryInput, user: AuthenticatedUser) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (user.role === USERROLE.CLIENT) {
      if (!user.clientId) {
        return {
          invoices: [],
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

    if (query.eventId) {
      where.eventId = query.eventId;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.search && query.search.trim() !== "") {
      const search = query.search.trim();
      where.OR = [
        { invoiceNumber: { contains: search, mode: "insensitive" } },
        { title: { contains: search, mode: "insensitive" } },
      ];
    }

    if (query.from || query.to) {
      const dateFilter: Record<string, Date> = {};
      if (query.from) dateFilter.gte = new Date(query.from);
      if (query.to) dateFilter.lte = new Date(query.to);
      where.invoiceDate = dateFilter;
    }

    const [total, rawInvoices] = await Promise.all([
      prisma.invoice.count({ where }),
      prisma.invoice.findMany({
        where,
        skip,
        take: limit,
        orderBy: { invoiceDate: "desc" },
        include: {
          client: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
          event: {
            select: {
              id: true,
              eventNumber: true,
              title: true,
              status: true,
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
          paymentAllocations: {
            select: {
              id: true,
              amount: true,
              allocatedAt: true,
              paymentId: true,
            },
          },
          _count: {
            select: {
              items: true,
              paymentAllocations: true,
            },
          },
        },
      }),
    ]);

    const invoices = rawInvoices.map((inv) => {
      const paidAmount = round2(
        inv.paymentAllocations.reduce((acc, curr) => acc + Number(curr.amount), 0)
      );
      const totalAmount = Number(inv.totalAmount);
      const balanceAmount = Math.max(0, round2(totalAmount - paidAmount));
      return {
        ...inv,
        paidAmount,
        balanceAmount,
      };
    });

    const totalPages = Math.ceil(total / limit) || 1;

    return {
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
   * Get single invoice details with items and payment allocation history.
   */
  async getInvoiceById(id: string, user: AuthenticatedUser) {
    const invoice = await prisma.invoice.findUnique({
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
        event: {
          select: {
            id: true,
            eventNumber: true,
            title: true,
            status: true,
            eventDate: true,
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
        paymentAllocations: {
          include: {
            payment: {
              select: {
                id: true,
                paymentNumber: true,
                paymentDate: true,
                paymentMethod: true,
                paymentType: true,
                transactionReference: true,
              },
            },
          },
          orderBy: {
            allocatedAt: "desc",
          },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundError(`Invoice with ID '${id}' was not found.`);
    }

    if (user.role === USERROLE.CLIENT && invoice.clientId !== user.clientId) {
      throw new ForbiddenError(
        "Access denied. You can only view invoices associated with your client account."
      );
    }

    const paidAmount = round2(
      invoice.paymentAllocations.reduce(
        (acc, curr) => acc + Number(curr.amount),
        0
      )
    );
    const totalAmount = Number(invoice.totalAmount);
    const balanceAmount = Math.max(0, round2(totalAmount - paidAmount));

    return {
      ...invoice,
      paidAmount,
      balanceAmount,
    };
  }

  /**
   * Update invoice details and line items (Admin only).
   */
  async updateInvoice(id: string, data: UpdateInvoiceInput, _userId: string) {
    const existing = await prisma.invoice.findUnique({
      where: { id },
      include: {
        items: true,
        paymentAllocations: true,
      },
    });

    if (!existing) {
      throw new NotFoundError(`Invoice with ID '${id}' was not found.`);
    }

    if (
      existing.status === InvoiceStatus.PAID ||
      existing.status === InvoiceStatus.CANCELLED
    ) {
      throw new BadRequestError(
        `Cannot edit an invoice in status '${existing.status}'.`
      );
    }

    if (existing.paymentAllocations.length > 0) {
      throw new BadRequestError(
        "Cannot edit invoice line items or totals because payments have already been allocated to this invoice."
      );
    }

    const itemsToCompute = data.items
      ? data.items
      : existing.items.map((i) => ({
          itemName: i.itemName,
          description: i.description,
          quantity: Number(i.quantity),
          unit: i.unit,
          unitPrice: Number(i.unitPrice),
          sortOrder: i.sortOrder,
          type: i.type,
          quotationId: i.quotationId,
          advanceAdjusted: Number(i.advanceAdjusted),
        }));

    const { calculatedItems, subtotal } = computeInvoiceItemTotals(itemsToCompute);

    const discountType =
      data.discountType !== undefined ? data.discountType : existing.discountType;
    const discountValue =
      data.discountValue !== undefined
        ? data.discountValue
        : Number(existing.discountValue);
    const taxRate =
      data.taxRate !== undefined ? data.taxRate : Number(existing.taxRate);

    const totals = calculateTotals(subtotal, discountType, discountValue, taxRate);

    return await prisma.$transaction(async (tx) => {
      if (data.items) {
        await tx.invoiceItem.deleteMany({
          where: { invoiceId: id },
        });

        await tx.invoiceItem.createMany({
          data: calculatedItems.map((item) => ({
            invoiceId: id,
            itemName: item.itemName,
            description: item.description,
            quantity: toDecimal(item.quantity),
            unit: item.unit,
            unitPrice: toDecimal(item.unitPrice),
            totalPrice: toDecimal(item.totalPrice),
            sortOrder: item.sortOrder,
            type: item.type,
            quotationId: item.quotationId,
            advanceAdjusted: toDecimal(item.advanceAdjusted),
          })),
        });
      }

      const updated = await tx.invoice.update({
        where: { id },
        data: {
          ...(data.title !== undefined ? { title: data.title.trim() } : {}),
          ...(data.invoiceDate !== undefined
            ? { invoiceDate: new Date(data.invoiceDate) }
            : {}),
          ...(data.dueDate !== undefined
            ? { dueDate: data.dueDate ? new Date(data.dueDate) : null }
            : {}),
          ...(data.discountType !== undefined ? { discountType: data.discountType } : {}),
          ...(data.discountValue !== undefined
            ? { discountValue: toDecimal(data.discountValue) }
            : {}),
          ...(data.taxRate !== undefined ? { taxRate: toDecimal(totals.taxRate) } : {}),
          subtotal: toDecimal(totals.subtotal),
          taxAmount: toDecimal(totals.taxAmount),
          totalAmount: toDecimal(totals.totalAmount),
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
          event: {
            select: {
              id: true,
              eventNumber: true,
              title: true,
              status: true,
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
          paymentAllocations: true,
        },
      });

      return {
        ...updated,
        paidAmount: 0,
        balanceAmount: Number(updated.totalAmount),
      };
    });
  }

  /**
   * Update invoice status with transition validation and lifecycle timestamps.
   */
  async updateStatus(
    id: string,
    data: UpdateInvoiceStatusInput,
    user: AuthenticatedUser
  ) {
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        paymentAllocations: true,
      },
    });

    if (!invoice) {
      throw new NotFoundError(`Invoice with ID '${id}' was not found.`);
    }

    if (invoice.status === data.status) {
      const paidAmount = round2(
        invoice.paymentAllocations.reduce((acc, curr) => acc + Number(curr.amount), 0)
      );
      return {
        ...invoice,
        paidAmount,
        balanceAmount: Math.max(0, round2(Number(invoice.totalAmount) - paidAmount)),
      };
    }

    // Cancellation guard
    if (data.status === InvoiceStatus.CANCELLED && invoice.paymentAllocations.length > 0) {
      throw new BadRequestError(
        "Cannot cancel an invoice with active payment allocations. Please refund or deallocate payments first."
      );
    }

    const allowed = ALLOWED_INVOICE_TRANSITIONS[invoice.status] || [];
    if (!allowed.includes(data.status)) {
      throw new BadRequestError(
        `Invalid status transition from '${invoice.status}' to '${data.status}'. Allowed transitions: [${allowed.join(
          ", "
        )}]`
      );
    }

    const updatePayload: Record<string, unknown> = {
      status: data.status,
    };

    const now = new Date();
    if (data.status === InvoiceStatus.SENT && !invoice.sentAt) {
      updatePayload.sentAt = now;
    } else if (data.status === InvoiceStatus.CANCELLED && !invoice.cancelledAt) {
      updatePayload.cancelledAt = now;
    }

    if (data.notes && data.notes.trim() !== "") {
      const noteEntry = `[${now.toISOString()}] Status transitioned to ${data.status} by ${user.role}: ${data.notes.trim()}`;
      updatePayload.notes = invoice.notes
        ? `${invoice.notes}\n${noteEntry}`
        : noteEntry;
    }

    const updated = await prisma.invoice.update({
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
        event: {
          select: {
            id: true,
            eventNumber: true,
            title: true,
            status: true,
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
        paymentAllocations: true,
      },
    });

    const paidAmount = round2(
      updated.paymentAllocations.reduce((acc, curr) => acc + Number(curr.amount), 0)
    );

    return {
      ...updated,
      paidAmount,
      balanceAmount: Math.max(0, round2(Number(updated.totalAmount) - paidAmount)),
    };
  }

  /**
   * Delete invoice (Admin only).
   */
  async deleteInvoice(id: string) {
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        paymentAllocations: true,
        proformaPayments: true,
      },
    });

    if (!invoice) {
      throw new NotFoundError(`Invoice with ID '${id}' was not found.`);
    }

    if (invoice.paymentAllocations.length > 0 || invoice.proformaPayments.length > 0) {
      throw new BadRequestError(
        "Cannot delete invoice linked to payment records or proforma advances."
      );
    }

    await prisma.invoice.delete({
      where: { id },
    });

    return { id, message: "Invoice deleted successfully" };
  }

  /**
   * Calculate live invoice balance.
   */
  async calculateBalance(invoiceId: string) {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        paymentAllocations: true,
      },
    });

    if (!invoice) {
      throw new NotFoundError(`Invoice with ID '${invoiceId}' was not found.`);
    }

    const totalAmount = Number(invoice.totalAmount);
    const paidAmount = round2(
      invoice.paymentAllocations.reduce((acc, curr) => acc + Number(curr.amount), 0)
    );
    const balanceAmount = Math.max(0, round2(totalAmount - paidAmount));

    return {
      invoiceId,
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      totalAmount,
      paidAmount,
      balanceAmount,
    };
  }
}

export const invoiceService = new InvoiceService();
