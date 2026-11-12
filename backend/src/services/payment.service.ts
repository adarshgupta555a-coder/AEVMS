import { prisma, Prisma } from "../lib/prisma.js";
import {
  NotFoundError,
  BadRequestError,
  ForbiddenError,
} from "../utils/errors.js";
import {
  USERROLE,
  PaymentStatus,
  InvoiceStatus,
} from "../generated/prisma/enums.js";
import { generatePaymentNumber } from "../utils/sequence.js";
import { round2, toDecimal } from "../utils/decimal.js";
import type { AuthenticatedUser } from "../types/auth.types.js";
import type {
  CreatePaymentInput,
  PaymentQueryInput,
} from "../validations/payment.validation.js";

export class PaymentService {
  /**
   * Record a client payment with optional multi-invoice allocations and automatic invoice status updates.
   */
  async recordPayment(data: CreatePaymentInput, userId: string) {
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

    if (data.proformaInvoiceId) {
      const proforma = await prisma.invoice.findUnique({
        where: { id: data.proformaInvoiceId },
      });
      if (!proforma) {
        throw new NotFoundError(
          `Proforma Invoice with ID '${data.proformaInvoiceId}' was not found.`
        );
      }
      if (proforma.clientId !== data.clientId) {
        throw new BadRequestError(
          "Proforma invoice does not belong to the specified client."
        );
      }
    }

    // Allocation validation
    const allocations = data.allocations || [];
    const totalAllocated = round2(
      allocations.reduce((acc, curr) => acc + Number(curr.amount), 0)
    );
    const paymentAmount = round2(data.amount);

    if (totalAllocated > paymentAmount) {
      throw new BadRequestError(
        `Total allocated amount (₹${totalAllocated}) cannot exceed total payment amount (₹${paymentAmount}).`
      );
    }

    // Pre-verify each invoice and remaining balances
    const invoiceBalanceMap = new Map<
      string,
      { invoiceNumber: string; totalAmount: number; currentPaid: number; balance: number }
    >();

    for (const alloc of allocations) {
      const invoice = await prisma.invoice.findUnique({
        where: { id: alloc.invoiceId },
        include: { paymentAllocations: true },
      });

      if (!invoice) {
        throw new NotFoundError(`Invoice with ID '${alloc.invoiceId}' was not found.`);
      }

      if (invoice.clientId !== data.clientId) {
        throw new BadRequestError(
          `Invoice '${invoice.invoiceNumber}' does not belong to the specified client.`
        );
      }

      if (invoice.status === InvoiceStatus.CANCELLED) {
        throw new BadRequestError(
          `Cannot allocate payment to CANCELLED invoice '${invoice.invoiceNumber}'.`
        );
      }

      const totalAmt = Number(invoice.totalAmount);
      const currentPaid = round2(
        invoice.paymentAllocations.reduce((acc, curr) => acc + Number(curr.amount), 0)
      );
      const balance = Math.max(0, round2(totalAmt - currentPaid));

      const allocAmount = round2(alloc.amount);
      if (allocAmount > balance) {
        throw new BadRequestError(
          `Allocation amount (₹${allocAmount}) exceeds remaining balance (₹${balance}) for invoice '${invoice.invoiceNumber}'.`
        );
      }

      invoiceBalanceMap.set(alloc.invoiceId, {
        invoiceNumber: invoice.invoiceNumber,
        totalAmount: totalAmt,
        currentPaid,
        balance,
      });
    }

    let paymentNumber = await generatePaymentNumber();
    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      try {
        return await prisma.$transaction(async (tx) => {
          // 1. Create Payment record
          const payment = await tx.payment.create({
            data: {
              paymentNumber,
              clientId: data.clientId,
              eventId: data.eventId || null,
              proformaInvoiceId: data.proformaInvoiceId || null,
              amount: toDecimal(paymentAmount),
              paymentType: data.paymentType,
              paymentMethod: data.paymentMethod,
              status: PaymentStatus.COMPLETED,
              transactionReference: data.transactionReference?.trim() || null,
              paymentDate: new Date(data.paymentDate),
              notes: data.notes?.trim() || null,
              recordedById: userId,
            },
          });

          // 2. Insert Allocations & update Invoices
          for (const alloc of allocations) {
            const allocAmt = round2(alloc.amount);
            await tx.paymentAllocation.create({
              data: {
                paymentId: payment.id,
                invoiceId: alloc.invoiceId,
                amount: toDecimal(allocAmt),
              },
            });

            const cached = invoiceBalanceMap.get(alloc.invoiceId)!;
            const newPaid = round2(cached.currentPaid + allocAmt);
            const newStatus =
              newPaid >= cached.totalAmount
                ? InvoiceStatus.PAID
                : newPaid > 0
                ? InvoiceStatus.PARTIALLY_PAID
                : InvoiceStatus.SENT;

            await tx.invoice.update({
              where: { id: alloc.invoiceId },
              data: { status: newStatus },
            });
          }

          // Return enriched payment
          return await tx.payment.findUnique({
            where: { id: payment.id },
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
                },
              },
              recordedBy: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  role: true,
                },
              },
              allocations: {
                include: {
                  invoice: {
                    select: {
                      id: true,
                      invoiceNumber: true,
                      totalAmount: true,
                      status: true,
                    },
                  },
                },
              },
              proformaInvoice: {
                select: {
                  id: true,
                  invoiceNumber: true,
                  totalAmount: true,
                },
              },
            },
          });
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          attempts++;
          paymentNumber = await generatePaymentNumber();
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
   * Get paginated payment history with RBAC scoping.
   */
  async getPayments(query: PaymentQueryInput, user: AuthenticatedUser) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (user.role === USERROLE.CLIENT) {
      if (!user.clientId) {
        return {
          payments: [],
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

    if (query.paymentType) {
      where.paymentType = query.paymentType;
    }

    if (query.paymentMethod) {
      where.paymentMethod = query.paymentMethod;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.search && query.search.trim() !== "") {
      const search = query.search.trim();
      where.OR = [
        { paymentNumber: { contains: search, mode: "insensitive" } },
        { transactionReference: { contains: search, mode: "insensitive" } },
      ];
    }

    if (query.from || query.to) {
      const dateFilter: Record<string, Date> = {};
      if (query.from) dateFilter.gte = new Date(query.from);
      if (query.to) dateFilter.lte = new Date(query.to);
      where.paymentDate = dateFilter;
    }

    const [total, payments] = await Promise.all([
      prisma.payment.count({ where }),
      prisma.payment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { paymentDate: "desc" },
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
            },
          },
          recordedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          allocations: {
            include: {
              invoice: {
                select: {
                  id: true,
                  invoiceNumber: true,
                  totalAmount: true,
                  status: true,
                },
              },
            },
          },
          proformaInvoice: {
            select: {
              id: true,
              invoiceNumber: true,
              totalAmount: true,
            },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      payments,
      meta: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  /**
   * Get single payment details.
   */
  async getPaymentById(id: string, user: AuthenticatedUser) {
    const payment = await prisma.payment.findUnique({
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
        recordedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        allocations: {
          include: {
            invoice: {
              select: {
                id: true,
                invoiceNumber: true,
                totalAmount: true,
                status: true,
              },
            },
          },
        },
        proformaInvoice: {
          select: {
            id: true,
            invoiceNumber: true,
            totalAmount: true,
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundError(`Payment with ID '${id}' was not found.`);
    }

    if (user.role === USERROLE.CLIENT && payment.clientId !== user.clientId) {
      throw new ForbiddenError(
        "Access denied. You can only view payments associated with your client account."
      );
    }

    return payment;
  }

  /**
   * Delete payment and recalculate affected invoice statuses (Admin only).
   */
  async deletePayment(id: string) {
    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        allocations: true,
      },
    });

    if (!payment) {
      throw new NotFoundError(`Payment with ID '${id}' was not found.`);
    }

    return await prisma.$transaction(async (tx) => {
      // 1. Delete allocations
      await tx.paymentAllocation.deleteMany({
        where: { paymentId: id },
      });

      // 2. Recalculate affected invoices
      for (const alloc of payment.allocations) {
        const remainingAllocs = await tx.paymentAllocation.findMany({
          where: { invoiceId: alloc.invoiceId },
        });

        const invoice = await tx.invoice.findUnique({
          where: { id: alloc.invoiceId },
        });

        if (invoice) {
          const totalPaid = round2(
            remainingAllocs.reduce((acc, curr) => acc + Number(curr.amount), 0)
          );
          const totalAmount = Number(invoice.totalAmount);
          const newStatus =
            totalPaid >= totalAmount
              ? InvoiceStatus.PAID
              : totalPaid > 0
              ? InvoiceStatus.PARTIALLY_PAID
              : InvoiceStatus.SENT;

          await tx.invoice.update({
            where: { id: alloc.invoiceId },
            data: { status: newStatus },
          });
        }
      }

      // 3. Delete Payment
      await tx.payment.delete({
        where: { id },
      });

      return { id, message: "Payment deleted and affected invoices updated successfully" };
    });
  }
}

export const paymentService = new PaymentService();
