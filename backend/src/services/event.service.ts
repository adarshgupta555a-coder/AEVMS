import { prisma, Prisma } from "../lib/prisma.js";
import {
  NotFoundError,
  BadRequestError,
  ConflictError,
  ForbiddenError,
} from "../utils/errors.js";
import { USERROLE, EventStatus, TaskStatus } from "../generated/prisma/enums.js";
import { generateEventNumber } from "../utils/sequence.js";
import type {
  CreateEventInput,
  UpdateEventInput,
  EventQueryInput,
  CreateEventTaskInput,
  UpdateEventTaskInput,
  CreateEventScheduleInput,
  UpdateEventScheduleInput,
} from "../validations/event.validation.js";

const ALLOWED_TRANSITIONS: Record<EventStatus, EventStatus[]> = {
  [EventStatus.DRAFT]: [EventStatus.CONFIRMED, EventStatus.CANCELLED],
  [EventStatus.CONFIRMED]: [EventStatus.PLANNING, EventStatus.CANCELLED],
  [EventStatus.PLANNING]: [EventStatus.IN_PROGRESS, EventStatus.CANCELLED],
  [EventStatus.IN_PROGRESS]: [EventStatus.COMPLETED, EventStatus.CANCELLED],
  [EventStatus.COMPLETED]: [], // Terminal state
  [EventStatus.CANCELLED]: [], // Terminal state
};

export class EventService {
  /**
   * Create a new event in DRAFT status with safe sequence number
   */
  async createEvent(data: CreateEventInput, userId: string) {
    const client = await prisma.client.findUnique({
      where: { id: data.clientId },
    });
    if (!client) {
      throw new NotFoundError(`Client with ID '${data.clientId}' was not found.`);
    }

    if (data.quotationId) {
      const quotation = await prisma.quotation.findUnique({
        where: { id: data.quotationId },
      });
      if (!quotation) {
        throw new NotFoundError(`Quotation with ID '${data.quotationId}' was not found.`);
      }
      if (quotation.clientId !== data.clientId) {
        throw new BadRequestError("Quotation does not belong to the specified client.");
      }
      const existingLink = await prisma.event.findUnique({
        where: { quotationId: data.quotationId },
      });
      if (existingLink) {
        throw new ConflictError("The specified quotation is already linked to another event.");
      }
    }

    let eventNumber = await generateEventNumber();

    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        return await prisma.event.create({
          data: {
            eventNumber,
            clientId: data.clientId,
            quotationId: data.quotationId || null,
            title: data.title.trim(),
            eventType: data.eventType.trim(),
            description: data.description?.trim() || null,
            eventDate: data.eventDate,
            startTime: data.startTime || null,
            endTime: data.endTime || null,
            venueName: data.venueName?.trim() || null,
            venueAddress: data.venueAddress?.trim() || null,
            guestCount: data.guestCount ?? null,
            budget:
              data.budget !== undefined && data.budget !== null
                ? new Prisma.Decimal(data.budget)
                : null,
            notes: data.notes?.trim() || null,
            status: EventStatus.DRAFT,
            createdById: userId,
          },
          include: {
            client: {
              select: { id: true, name: true, email: true, phone: true },
            },
            quotation: {
              select: { id: true, quotationNumber: true, totalAmount: true },
            },
            createdBy: {
              select: { id: true, name: true, email: true, role: true },
            },
            _count: {
              select: {
                tasks: true,
                schedules: true,
                invoice: true,
                payments: true,
                calendar: true,
              },
            },
          },
        });
      } catch (err: any) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          const year = new Date().getFullYear();
          const prefix = `EVT-${year}-`;
          const parts = eventNumber.split("-");
          const nextNum = parseInt(parts[2] || "0", 10) + 1;
          eventNumber = `${prefix}${String(nextNum).padStart(4, "0")}`;
          continue;
        }
        throw err;
      }
    }

    throw new ConflictError("Could not generate a unique event number after multiple attempts.");
  }

  /**
   * List events with filters, pagination, and RBAC ownership scoping
   */
  async getEvents(
    query: EventQueryInput,
    user: { id: string; role: USERROLE; clientId: string | null }
  ) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    // RBAC Scoping
    if (user.role === USERROLE.CLIENT) {
      if (!user.clientId) {
        return {
          events: [],
          meta: { page: 1, limit, total: 0, totalPages: 1 },
        };
      }
      where.clientId = user.clientId;
    } else if (query.clientId) {
      where.clientId = query.clientId;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.from || query.to) {
      const dateFilter: Record<string, unknown> = {};
      if (query.from) dateFilter.gte = query.from;
      if (query.to) dateFilter.lte = query.to;
      where.eventDate = dateFilter;
    }

    if (query.search && query.search.trim() !== "") {
      const s = query.search.trim();
      where.OR = [
        { title: { contains: s, mode: "insensitive" } },
        { eventNumber: { contains: s, mode: "insensitive" } },
        { venueName: { contains: s, mode: "insensitive" } },
        { eventType: { contains: s, mode: "insensitive" } },
      ];
    }

    const [total, events] = await Promise.all([
      prisma.event.count({ where }),
      prisma.event.findMany({
        where,
        skip,
        take: limit,
        orderBy: { eventDate: "desc" },
        include: {
          client: {
            select: { id: true, name: true, email: true, phone: true },
          },
          quotation: {
            select: { id: true, quotationNumber: true, totalAmount: true },
          },
          createdBy: {
            select: { id: true, name: true, email: true, role: true },
          },
          _count: {
            select: {
              tasks: true,
              schedules: true,
              invoice: true,
              payments: true,
            },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
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
   * Get event by ID with RBAC ownership check and nested timelines
   */
  async getEventById(
    id: string,
    user: { id: string; role: USERROLE; clientId: string | null }
  ) {
    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        client: {
          select: { id: true, name: true, email: true, phone: true, city: true },
        },
        quotation: {
          select: {
            id: true,
            quotationNumber: true,
            title: true,
            totalAmount: true,
            status: true,
          },
        },
        createdBy: {
          select: { id: true, name: true, email: true, role: true },
        },
        tasks: {
          orderBy: { createdAt: "asc" },
        },
        schedules: {
          orderBy: { startAt: "asc" },
        },
        calendar: {
          select: {
            id: true,
            title: true,
            type: true,
            startAt: true,
            endAt: true,
            location: true,
          },
          orderBy: { startAt: "asc" },
        },
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            title: true,
            invoiceDate: true,
            totalAmount: true,
            status: true,
          },
          orderBy: { invoiceDate: "desc" },
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
          orderBy: { paymentDate: "desc" },
        },
      },
    });

    if (!event) {
      throw new NotFoundError(`Event with ID '${id}' was not found.`);
    }

    if (user.role === USERROLE.CLIENT && user.clientId !== event.clientId) {
      throw new ForbiddenError("You are not authorized to access this event.");
    }

    return event;
  }

  /**
   * Update event planning details and budget
   */
  async updateEvent(id: string, data: UpdateEventInput) {
    const existing = await prisma.event.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundError(`Event with ID '${id}' was not found.`);
    }

    if (data.quotationId && data.quotationId !== existing.quotationId) {
      const quotation = await prisma.quotation.findUnique({
        where: { id: data.quotationId },
      });
      if (!quotation) {
        throw new NotFoundError(`Quotation with ID '${data.quotationId}' was not found.`);
      }
      if (quotation.clientId !== existing.clientId) {
        throw new BadRequestError("Quotation does not belong to the event's client.");
      }
      const existingLink = await prisma.event.findUnique({
        where: { quotationId: data.quotationId },
      });
      if (existingLink && existingLink.id !== id) {
        throw new ConflictError("Quotation is already linked to another event.");
      }
    }

    return prisma.event.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title.trim() } : {}),
        ...(data.eventType !== undefined ? { eventType: data.eventType.trim() } : {}),
        ...(data.description !== undefined ? { description: data.description?.trim() || null } : {}),
        ...(data.eventDate !== undefined ? { eventDate: data.eventDate } : {}),
        ...(data.startTime !== undefined ? { startTime: data.startTime || null } : {}),
        ...(data.endTime !== undefined ? { endTime: data.endTime || null } : {}),
        ...(data.venueName !== undefined ? { venueName: data.venueName?.trim() || null } : {}),
        ...(data.venueAddress !== undefined ? { venueAddress: data.venueAddress?.trim() || null } : {}),
        ...(data.guestCount !== undefined ? { guestCount: data.guestCount ?? null } : {}),
        ...(data.budget !== undefined
          ? { budget: data.budget !== null ? new Prisma.Decimal(data.budget) : null }
          : {}),
        ...(data.notes !== undefined ? { notes: data.notes?.trim() || null } : {}),
        ...(data.quotationId !== undefined ? { quotationId: data.quotationId || null } : {}),
      },
      include: {
        client: {
          select: { id: true, name: true, email: true, phone: true },
        },
        quotation: {
          select: { id: true, quotationNumber: true, totalAmount: true },
        },
        createdBy: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });
  }

  /**
   * Event State Machine transition
   * DRAFT -> CONFIRMED -> PLANNING -> IN_PROGRESS -> COMPLETED (or CANCELLED)
   */
  async updateStatus(id: string, newStatus: EventStatus, reason?: string) {
    const event = await prisma.event.findUnique({
      where: { id },
    });
    if (!event) {
      throw new NotFoundError(`Event with ID '${id}' was not found.`);
    }

    if (event.status === newStatus) {
      return event;
    }

    const allowedNext = ALLOWED_TRANSITIONS[event.status];
    if (!allowedNext.includes(newStatus)) {
      const allowedStr =
        allowedNext.length > 0 ? allowedNext.join(", ") : "None (terminal state)";
      throw new BadRequestError(
        `Cannot transition event from status '${event.status}' to '${newStatus}'. Allowed transitions: ${allowedStr}.`
      );
    }

    let updatedNotes = event.notes;
    if (reason && reason.trim() !== "") {
      const timestamp = new Date().toISOString();
      const log = `[Status transitioned from ${event.status} to ${newStatus} on ${timestamp}: ${reason.trim()}]`;
      updatedNotes = event.notes ? `${event.notes}\n${log}` : log;
    }

    return prisma.event.update({
      where: { id },
      data: {
        status: newStatus,
        notes: updatedNotes,
      },
      include: {
        client: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  }

  /**
   * Delete event (protected against active financial records)
   */
  async deleteEvent(id: string) {
    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            invoice: true,
            payments: true,
            expense: true,
          },
        },
      },
    });

    if (!event) {
      throw new NotFoundError(`Event with ID '${id}' was not found.`);
    }

    if (event._count.invoice > 0 || event._count.payments > 0 || event._count.expense > 0) {
      throw new BadRequestError(
        "Cannot delete event with linked invoices, payments, or recorded expenses. Cancel the event instead to preserve financial records."
      );
    }

    return prisma.$transaction(async (tx) => {
      await tx.eventSchedule.deleteMany({ where: { eventId: id } });
      await tx.eventTask.deleteMany({ where: { eventId: id } });
      await tx.calendarEntry.deleteMany({ where: { eventId: id } });
      await tx.eventInventory.deleteMany({ where: { eventId: id } });
      return tx.event.delete({ where: { id } });
    });
  }

  /**
   * Calculate comprehensive event financial summary
   */
  async getEventSummary(id: string) {
    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, name: true, email: true } },
        invoice: {
          where: { status: { not: "CANCELLED" } },
          select: { totalAmount: true, status: true },
        },
        payments: {
          where: { status: "COMPLETED" },
          select: { amount: true },
        },
        expense: {
          select: { amount: true },
        },
        _count: {
          select: {
            tasks: true,
            schedules: true,
            invoice: true,
            payments: true,
            expense: true,
          },
        },
      },
    });

    if (!event) {
      throw new NotFoundError(`Event with ID '${id}' was not found.`);
    }

    const budget = event.budget ? Number(event.budget) : 0;

    const totalInvoiced = event.invoice.reduce(
      (sum: number, inv: { totalAmount: unknown }) => sum + Number(inv.totalAmount),
      0
    );

    const totalPaid = event.payments.reduce(
      (sum: number, pay: { amount: unknown }) => sum + Number(pay.amount),
      0
    );

    const totalExpenses = event.expense.reduce(
      (sum: number, exp: { amount: unknown }) => sum + Number(exp.amount),
      0
    );

    const balanceReceivable = totalInvoiced - totalPaid;
    const profitMargin = totalInvoiced - totalExpenses;

    return {
      event: {
        id: event.id,
        eventNumber: event.eventNumber,
        title: event.title,
        status: event.status,
        eventDate: event.eventDate,
        client: event.client,
      },
      financials: {
        budget,
        totalInvoiced,
        totalPaid,
        totalExpenses,
        balanceReceivable,
        profitMargin,
      },
      counts: event._count,
    };
  }

  // ===========================================================================
  // OPERATIONAL TASKS
  // ===========================================================================

  async createTask(eventId: string, data: CreateEventTaskInput) {
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      throw new NotFoundError(`Event with ID '${eventId}' was not found.`);
    }

    return prisma.eventTask.create({
      data: {
        eventId,
        title: data.title.trim(),
        description: data.description?.trim() || null,
        dueDate: data.dueDate || null,
        priority: data.priority,
        status: data.status,
      },
    });
  }

  async getTasks(eventId: string) {
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      throw new NotFoundError(`Event with ID '${eventId}' was not found.`);
    }

    return prisma.eventTask.findMany({
      where: { eventId },
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
    });
  }

  async updateTask(taskId: string, data: UpdateEventTaskInput) {
    const task = await prisma.eventTask.findUnique({ where: { id: taskId } });
    if (!task) {
      throw new NotFoundError(`Task with ID '${taskId}' was not found.`);
    }

    let completedAt = task.completedAt;
    if (data.status === TaskStatus.COMPLETED) {
      completedAt = new Date();
    } else if (data.status !== undefined) {
      completedAt = null;
    }

    return prisma.eventTask.update({
      where: { id: taskId },
      data: {
        ...(data.title !== undefined ? { title: data.title.trim() } : {}),
        ...(data.description !== undefined ? { description: data.description?.trim() || null } : {}),
        ...(data.dueDate !== undefined ? { dueDate: data.dueDate || null } : {}),
        ...(data.priority !== undefined ? { priority: data.priority } : {}),
        ...(data.status !== undefined ? { status: data.status, completedAt } : {}),
      },
    });
  }

  async deleteTask(taskId: string) {
    const task = await prisma.eventTask.findUnique({ where: { id: taskId } });
    if (!task) {
      throw new NotFoundError(`Task with ID '${taskId}' was not found.`);
    }

    return prisma.eventTask.delete({ where: { id: taskId } });
  }

  // ===========================================================================
  // OPERATIONAL SCHEDULES
  // ===========================================================================

  async createSchedule(eventId: string, data: CreateEventScheduleInput) {
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      throw new NotFoundError(`Event with ID '${eventId}' was not found.`);
    }

    return prisma.eventSchedule.create({
      data: {
        eventId,
        title: data.title.trim(),
        description: data.description?.trim() || null,
        startAt: data.startAt,
        endAt: data.endAt || null,
      },
    });
  }

  async getSchedules(eventId: string) {
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      throw new NotFoundError(`Event with ID '${eventId}' was not found.`);
    }

    return prisma.eventSchedule.findMany({
      where: { eventId },
      orderBy: { startAt: "asc" },
    });
  }

  async updateSchedule(scheduleId: string, data: UpdateEventScheduleInput) {
    const schedule = await prisma.eventSchedule.findUnique({ where: { id: scheduleId } });
    if (!schedule) {
      throw new NotFoundError(`Schedule with ID '${scheduleId}' was not found.`);
    }

    const startAt = data.startAt ?? schedule.startAt;
    const endAt = data.endAt !== undefined ? data.endAt : schedule.endAt;

    if (endAt && startAt && endAt < startAt) {
      throw new BadRequestError("endAt cannot be earlier than startAt");
    }

    return prisma.eventSchedule.update({
      where: { id: scheduleId },
      data: {
        ...(data.title !== undefined ? { title: data.title.trim() } : {}),
        ...(data.description !== undefined ? { description: data.description?.trim() || null } : {}),
        ...(data.startAt !== undefined ? { startAt: data.startAt } : {}),
        ...(data.endAt !== undefined ? { endAt: data.endAt || null } : {}),
      },
    });
  }

  async deleteSchedule(scheduleId: string) {
    const schedule = await prisma.eventSchedule.findUnique({ where: { id: scheduleId } });
    if (!schedule) {
      throw new NotFoundError(`Schedule with ID '${scheduleId}' was not found.`);
    }

    return prisma.eventSchedule.delete({ where: { id: scheduleId } });
  }
}

export const eventService = new EventService();
