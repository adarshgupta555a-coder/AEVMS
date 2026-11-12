import type { Request, Response, NextFunction } from "express";
import { calendarService } from "../services/calendar.service.js";
import { sendSuccess } from "../utils/response.js";
import { assertClientOwnership } from "../utils/ownership.js";

export class CalendarController {
  async createEntry(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientIdParam = req.params.clientId || req.params.id;
      const data = {
        ...req.body,
        ...(clientIdParam ? { clientId: clientIdParam } : {}),
      };

      const entry = await calendarService.createEntry(data, req.user!.id);
      sendSuccess(res, entry, "Calendar entry created successfully", 201);
    } catch (error) {
      next(error);
    }
  }

  async getEntries(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { entries, meta } = await calendarService.getEntries(req.query as any, req.user!);
      sendSuccess(res, entries, "Calendar entries retrieved successfully", 200, meta);
    } catch (error) {
      next(error);
    }
  }

  async getEntryById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const entry = await calendarService.getEntryById(id, req.user!);
      sendSuccess(res, entry, "Calendar entry retrieved successfully", 200);
    } catch (error) {
      next(error);
    }
  }

  async updateEntry(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const entry = await calendarService.updateEntry(id, req.body);
      sendSuccess(res, entry, "Calendar entry updated successfully", 200);
    } catch (error) {
      next(error);
    }
  }

  async deleteEntry(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      await calendarService.deleteEntry(id);
      sendSuccess(res, null, "Calendar entry deleted successfully", 200);
    } catch (error) {
      next(error);
    }
  }

  async getClientActivities(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = (req.params.clientId || req.params.id) as string;
      assertClientOwnership(req, clientId);

      const { activities, meta } = await calendarService.getClientActivities(
        clientId,
        req.query as any
      );
      sendSuccess(res, activities, "Client activities retrieved successfully", 200, meta);
    } catch (error) {
      next(error);
    }
  }
}

export const calendarController = new CalendarController();
