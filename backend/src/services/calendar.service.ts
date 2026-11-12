import { prisma } from "../lib/prisma.js";
import {
  NotFoundError,
  BadRequestError,
  ForbiddenError,
  ValidationError,
} from "../utils/errors.js";
import { USERROLE, CalendarEntryType } from "../generated/prisma/enums.js";
import type {
  CreateCalendarEntryInput,
  UpdateCalendarEntryInput,
  CalendarQueryInput,
} from "../validations/calendar.validation.js";

export class CalendarService {
  /**
   * Create a new calendar entry / activity
   */
  async createEntry(data: CreateCalendarEntryInput, userId: string) {
    if (!data.clientId) {
      throw new BadRequestError("clientId is required to create a calendar activity.");
    }

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
        throw new BadRequestError("The specified event does not belong to this client.");
      }
    }

    return prisma.calendarEntry.create({
      data: {
        title: data.title.trim(),
        description: data.description?.trim() || null,
        type: data.type || CalendarEntryType.OTHER,
        startAt: data.startAt,
        endAt: data.endAt || null,
        allDay: data.allDay || false,
        location: data.location?.trim() || null,
        clientId: data.clientId,
        eventId: data.eventId || null,
        createdById: userId,
      },
      include: {
        client: {
          select: { id: true, name: true, email: true, phone: true },
        },
        event: {
          select: { id: true, eventNumber: true, title: true, eventDate: true },
        },
        createdBy: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });
  }

  /**
   * List calendar entries with filters and RBAC scoping
   */
  async getEntries(
    query: CalendarQueryInput,
    user: { id: string; role: USERROLE; clientId: string | null }
  ) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    // Ownership Scoping: Client role can only view their own activities
    if (user.role === USERROLE.CLIENT) {
      if (!user.clientId) {
        return {
          entries: [],
          meta: { page: 1, limit, total: 0, totalPages: 1 },
        };
      }
      where.clientId = user.clientId;
    } else if (query.clientId) {
      where.clientId = query.clientId;
    }

    if (query.eventId) {
      where.eventId = query.eventId;
    }

    if (query.type) {
      where.type = query.type;
    }

    if (query.from || query.to) {
      const startAtFilter: Record<string, unknown> = {};
      if (query.from) startAtFilter.gte = query.from;
      if (query.to) startAtFilter.lte = query.to;
      where.startAt = startAtFilter;
    }

    if (query.search && query.search.trim() !== "") {
      const s = query.search.trim();
      where.OR = [
        { title: { contains: s, mode: "insensitive" } },
        { description: { contains: s, mode: "insensitive" } },
        { location: { contains: s, mode: "insensitive" } },
      ];
    }

    const [total, entries] = await Promise.all([
      prisma.calendarEntry.count({ where }),
      prisma.calendarEntry.findMany({
        where,
        skip,
        take: limit,
        orderBy: { startAt: "asc" },
        include: {
          client: {
            select: { id: true, name: true, email: true, phone: true },
          },
          event: {
            select: { id: true, eventNumber: true, title: true, eventDate: true },
          },
          createdBy: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      entries,
      meta: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  /**
   * Get single calendar entry details
   */
  async getEntryById(
    id: string,
    user: { id: string; role: USERROLE; clientId: string | null }
  ) {
    const entry = await prisma.calendarEntry.findUnique({
      where: { id },
      include: {
        client: {
          select: { id: true, name: true, email: true, phone: true },
        },
        event: {
          select: { id: true, eventNumber: true, title: true, eventDate: true },
        },
        createdBy: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });

    if (!entry) {
      throw new NotFoundError(`Calendar entry with ID '${id}' was not found.`);
    }

    if (user.role === USERROLE.CLIENT && user.clientId !== entry.clientId) {
      throw new ForbiddenError("You are not authorized to access this activity entry.");
    }

    return entry;
  }

  /**
   * Update calendar entry
   */
  async updateEntry(id: string, data: UpdateCalendarEntryInput) {
    const existing = await prisma.calendarEntry.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundError(`Calendar entry with ID '${id}' was not found.`);
    }

    const effectiveStartAt = data.startAt !== undefined ? data.startAt : existing.startAt;
    const effectiveEndAt = data.endAt !== undefined ? data.endAt : existing.endAt;

    if (effectiveStartAt && effectiveEndAt && effectiveEndAt < effectiveStartAt) {
      throw new ValidationError("endAt cannot be earlier than startAt");
    }

    if (data.eventId) {
      const event = await prisma.event.findUnique({
        where: { id: data.eventId },
      });
      if (!event) {
        throw new NotFoundError(`Event with ID '${data.eventId}' was not found.`);
      }
      if (event.clientId !== existing.clientId) {
        throw new BadRequestError("The specified event does not belong to this client.");
      }
    }

    return prisma.calendarEntry.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title.trim() } : {}),
        ...(data.description !== undefined ? { description: data.description?.trim() || null } : {}),
        ...(data.type !== undefined ? { type: data.type } : {}),
        ...(data.startAt !== undefined ? { startAt: data.startAt } : {}),
        ...(data.endAt !== undefined ? { endAt: data.endAt || null } : {}),
        ...(data.allDay !== undefined ? { allDay: data.allDay } : {}),
        ...(data.location !== undefined ? { location: data.location?.trim() || null } : {}),
        ...(data.eventId !== undefined ? { eventId: data.eventId || null } : {}),
      },
      include: {
        client: {
          select: { id: true, name: true, email: true, phone: true },
        },
        event: {
          select: { id: true, eventNumber: true, title: true, eventDate: true },
        },
        createdBy: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });
  }

  /**
   * Delete calendar entry
   */
  async deleteEntry(id: string) {
    const existing = await prisma.calendarEntry.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundError(`Calendar entry with ID '${id}' was not found.`);
    }

    return prisma.calendarEntry.delete({
      where: { id },
    });
  }

  /**
   * Get client activities directly
   */
  async getClientActivities(clientId: string, query: CalendarQueryInput = { page: 1, limit: 20 }) {
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
    if (query.type) {
      where.type = query.type;
    }

    const [total, activities] = await Promise.all([
      prisma.calendarEntry.count({ where }),
      prisma.calendarEntry.findMany({
        where,
        skip,
        take: limit,
        orderBy: { startAt: "desc" },
        include: {
          event: {
            select: { id: true, eventNumber: true, title: true, eventDate: true },
          },
          createdBy: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      client,
      activities,
      meta: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }
}

export const calendarService = new CalendarService();
