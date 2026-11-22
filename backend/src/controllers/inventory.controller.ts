import type { Request, Response, NextFunction } from "express";
import { inventoryService } from "../services/inventory.service.js";
import { sendSuccess } from "../utils/response.js";

export class InventoryController {
  // ==========================================
  // CATEGORIES
  // ==========================================

  async createCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const category = await inventoryService.createCategory(req.body);
      return sendSuccess(res, category, "Inventory category created successfully.", 201);
    } catch (err) {
      next(err);
    }
  }

  async getCategories(_req: Request, res: Response, next: NextFunction) {
    try {
      const categories = await inventoryService.getCategories();
      return sendSuccess(res, categories, "Inventory categories retrieved successfully.");
    } catch (err) {
      next(err);
    }
  }

  async getCategoryById(req: Request, res: Response, next: NextFunction) {
    try {
      const category = await inventoryService.getCategoryById(req.params.id as string);
      return sendSuccess(res, category, "Category details retrieved successfully.");
    } catch (err) {
      next(err);
    }
  }

  async updateCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const category = await inventoryService.updateCategory(req.params.id as string, req.body);
      return sendSuccess(res, category, "Category updated successfully.");
    } catch (err) {
      next(err);
    }
  }

  async deleteCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await inventoryService.deleteCategory(req.params.id as string);
      return sendSuccess(res, result, "Category deleted successfully.");
    } catch (err) {
      next(err);
    }
  }

  // ==========================================
  // ITEMS
  // ==========================================

  async createItem(req: Request, res: Response, next: NextFunction) {
    try {
      const item = await inventoryService.createItem(req.body);
      return sendSuccess(res, item, "Inventory item created successfully.", 201);
    } catch (err) {
      next(err);
    }
  }

  async getItems(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await inventoryService.getItems(req.query as any);
      return sendSuccess(res, result.items, "Inventory items retrieved successfully.", 200, result.meta);
    } catch (err) {
      next(err);
    }
  }

  async getItemById(req: Request, res: Response, next: NextFunction) {
    try {
      const item = await inventoryService.getItemById(req.params.id as string);
      return sendSuccess(res, item, "Inventory item retrieved successfully.");
    } catch (err) {
      next(err);
    }
  }

  async updateItem(req: Request, res: Response, next: NextFunction) {
    try {
      const item = await inventoryService.updateItem(req.params.id as string, req.body);
      return sendSuccess(res, item, "Inventory item updated successfully.");
    } catch (err) {
      next(err);
    }
  }

  async deleteItem(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await inventoryService.deleteItem(req.params.id as string);
      return sendSuccess(res, result, "Inventory item deleted successfully.");
    } catch (err) {
      next(err);
    }
  }

  async auditItemStock(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await inventoryService.auditItemStock(req.params.id as string);
      return sendSuccess(res, result, "Inventory stock audit completed successfully.");
    } catch (err) {
      next(err);
    }
  }

  // ==========================================
  // STOCK MOVEMENTS
  // ==========================================

  async recordPurchase(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await inventoryService.recordPurchase(req.body);
      return sendSuccess(res, result, "Stock purchase recorded successfully.", 201);
    } catch (err) {
      next(err);
    }
  }

  async recordAdjustment(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await inventoryService.recordAdjustment(req.body);
      return sendSuccess(res, result, "Stock adjustment recorded successfully.");
    } catch (err) {
      next(err);
    }
  }

  async recordDamageLoss(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await inventoryService.recordDamageLoss(req.body);
      return sendSuccess(res, result, "Damage/loss recorded successfully.");
    } catch (err) {
      next(err);
    }
  }

  async getMovements(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await inventoryService.getMovements(req.query as any);
      return sendSuccess(res, result.movements, "Inventory movements retrieved successfully.", 200, result.meta);
    } catch (err) {
      next(err);
    }
  }

  // ==========================================
  // EVENT INVENTORY ALLOCATIONS & MOVEMENTS
  // ==========================================

  async getEventInventory(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await inventoryService.getEventInventory(req.params.eventId as string);
      return sendSuccess(res, result, "Event inventory allocations retrieved successfully.");
    } catch (err) {
      next(err);
    }
  }

  async allocateEventItems(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await inventoryService.allocateEventItems(req.params.eventId as string, req.body);
      return sendSuccess(res, result, "Event inventory items allocated successfully.");
    } catch (err) {
      next(err);
    }
  }

  async updateEventItem(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await inventoryService.updateEventItem(
        req.params.eventId as string,
        req.params.inventoryItemId as string,
        req.body
      );
      return sendSuccess(res, result, "Event inventory item updated successfully.");
    } catch (err) {
      next(err);
    }
  }

  async issueEventItems(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await inventoryService.issueEventItems(req.params.eventId as string, req.body);
      return sendSuccess(res, result, "Event inventory items issued successfully.");
    } catch (err) {
      next(err);
    }
  }

  async returnEventItems(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await inventoryService.returnEventItems(req.params.eventId as string, req.body);
      return sendSuccess(res, result, "Event inventory items return processed successfully.");
    } catch (err) {
      next(err);
    }
  }
}

export const inventoryController = new InventoryController();
