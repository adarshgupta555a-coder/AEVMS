import type { Request, Response, NextFunction } from "express";
import { eventService } from "../services/event.service.js";
import { sendSuccess } from "../utils/response.js";

export class EventController {
  async createEvent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const event = await eventService.createEvent(req.body, req.user!.id);
      sendSuccess(res, event, "Event created successfully in DRAFT status", 201);
    } catch (error) {
      next(error);
    }
  }

  async getEvents(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { events, meta } = await eventService.getEvents(req.query as any, req.user!);
      sendSuccess(res, events, "Events retrieved successfully", 200, meta);
    } catch (error) {
      next(error);
    }
  }

  async getEventById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const event = await eventService.getEventById(req.params.id as string, req.user!);
      sendSuccess(res, event, "Event details retrieved successfully", 200);
    } catch (error) {
      next(error);
    }
  }

  async updateEvent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const event = await eventService.updateEvent(req.params.id as string, req.body);
      sendSuccess(res, event, "Event updated successfully", 200);
    } catch (error) {
      next(error);
    }
  }

  async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status, reason } = req.body;
      const event = await eventService.updateStatus(req.params.id as string, status, reason);
      sendSuccess(res, event, `Event status transitioned to ${status} successfully`, 200);
    } catch (error) {
      next(error);
    }
  }

  async deleteEvent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await eventService.deleteEvent(req.params.id as string);
      sendSuccess(res, null, "Event deleted successfully", 200);
    } catch (error) {
      next(error);
    }
  }

  async getEventSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const summary = await eventService.getEventSummary(req.params.id as string);
      sendSuccess(res, summary, "Event financial summary retrieved successfully", 200);
    } catch (error) {
      next(error);
    }
  }

  // Tasks
  async createTask(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const task = await eventService.createTask(req.params.eventId as string, req.body);
      sendSuccess(res, task, "Event task created successfully", 201);
    } catch (error) {
      next(error);
    }
  }

  async getTasks(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tasks = await eventService.getTasks(req.params.eventId as string);
      sendSuccess(res, tasks, "Event tasks retrieved successfully", 200);
    } catch (error) {
      next(error);
    }
  }

  async updateTask(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const task = await eventService.updateTask(req.params.taskId as string, req.body);
      sendSuccess(res, task, "Event task updated successfully", 200);
    } catch (error) {
      next(error);
    }
  }

  async deleteTask(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await eventService.deleteTask(req.params.taskId as string);
      sendSuccess(res, null, "Event task deleted successfully", 200);
    } catch (error) {
      next(error);
    }
  }

  // Schedules
  async createSchedule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schedule = await eventService.createSchedule(req.params.eventId as string, req.body);
      sendSuccess(res, schedule, "Event schedule created successfully", 201);
    } catch (error) {
      next(error);
    }
  }

  async getSchedules(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schedules = await eventService.getSchedules(req.params.eventId as string);
      sendSuccess(res, schedules, "Event schedules retrieved successfully", 200);
    } catch (error) {
      next(error);
    }
  }

  async updateSchedule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schedule = await eventService.updateSchedule(req.params.scheduleId as string, req.body);
      sendSuccess(res, schedule, "Event schedule updated successfully", 200);
    } catch (error) {
      next(error);
    }
  }

  async deleteSchedule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await eventService.deleteSchedule(req.params.scheduleId as string);
      sendSuccess(res, null, "Event schedule deleted successfully", 200);
    } catch (error) {
      next(error);
    }
  }
}

export const eventController = new EventController();
