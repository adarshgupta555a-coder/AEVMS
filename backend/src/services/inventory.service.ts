import { prisma, Prisma } from "../lib/prisma.js";
import { InventoryMovementType, InventoryUsageType } from "../generated/prisma/enums.js";
import { BadRequestError, NotFoundError, ConflictError } from "../utils/errors.js";
import { round2, toDecimal } from "../utils/decimal.js";
import type {
  CreateCategoryInput,
  UpdateCategoryInput,
  CreateInventoryItemInput,
  UpdateInventoryItemInput,
  InventoryItemQueryInput,
  PurchaseMovementInput,
  AdjustmentMovementInput,
  DamageLossMovementInput,
  MovementQueryInput,
  AllocateEventItemsInput,
  UpdateEventItemInput,
  IssueEventItemsInput,
  ReturnEventItemsInput,
} from "../validations/inventory.validation.js";

export class InventoryService {
  // ==========================================
  // CATEGORIES
  // ==========================================

  async createCategory(data: CreateCategoryInput) {
    const existing = await prisma.inventoryCategory.findUnique({
      where: { name: data.name },
    });
    if (existing) {
      throw new ConflictError(`Category with name '${data.name}' already exists.`);
    }

    return prisma.inventoryCategory.create({
      data: {
        name: data.name,
        description: data.description ?? null,
      },
      include: {
        _count: {
          select: { items: true },
        },
      },
    });
  }

  async getCategories() {
    return prisma.inventoryCategory.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: { items: true },
        },
      },
    });
  }

  async getCategoryById(id: string) {
    const category = await prisma.inventoryCategory.findUnique({
      where: { id },
      include: {
        _count: {
          select: { items: true },
        },
      },
    });
    if (!category) {
      throw new NotFoundError(`Inventory category with ID '${id}' not found.`);
    }
    return category;
  }

  async updateCategory(id: string, data: UpdateCategoryInput) {
    await this.getCategoryById(id);

    if (data.name) {
      const duplicate = await prisma.inventoryCategory.findFirst({
        where: {
          name: data.name,
          NOT: { id },
        },
      });
      if (duplicate) {
        throw new ConflictError(`Another category with name '${data.name}' already exists.`);
      }
    }

    return prisma.inventoryCategory.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
      },
      include: {
        _count: {
          select: { items: true },
        },
      },
    });
  }

  async deleteCategory(id: string) {
    await this.getCategoryById(id);

    const itemCount = await prisma.inventoryItem.count({
      where: { categoryId: id },
    });
    if (itemCount > 0) {
      throw new BadRequestError(
        `Cannot delete category with ${itemCount} associated inventory item(s). Reassign or delete the items first.`
      );
    }

    await prisma.inventoryCategory.delete({
      where: { id },
    });

    return { message: "Inventory category deleted successfully." };
  }

  // ==========================================
  // INVENTORY ITEMS
  // ==========================================

  async createItem(data: CreateInventoryItemInput) {
    await this.getCategoryById(data.categoryId);

    if (data.sku) {
      const existingSku = await prisma.inventoryItem.findUnique({
        where: { sku: data.sku },
      });
      if (existingSku) {
        throw new ConflictError(`Inventory item with SKU '${data.sku}' already exists.`);
      }
    }

    const initialStock = Number(data.initialStock) || 0;
    const initialPrice = data.purchasePrice !== undefined && data.purchasePrice !== null ? toDecimal(data.purchasePrice) : null;

    return prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.create({
        data: {
          name: data.name,
          description: data.description ?? null,
          categoryId: data.categoryId,
          itemType: data.itemType,
          sku: data.sku ?? null,
          unit: data.unit,
          minimumStock: toDecimal(data.minimumStock),
          purchasePrice: initialPrice,
          currentStock: toDecimal(initialStock),
          isActive: data.isActive,
        },
        include: {
          category: true,
        },
      });

      if (initialStock > 0) {
        await tx.inventoryMovement.create({
          data: {
            inventoryItemId: item.id,
            movementType: InventoryMovementType.PURCHASE,
            quantity: toDecimal(initialStock),
            unitCost: initialPrice,
            referenceNumber: "INITIAL_STOCK",
            notes: "Opening inventory stock initialization",
          },
        });
      }

      return item;
    });
  }

  async getItems(query: InventoryItemQueryInput) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const { categoryId, itemType, lowStock, isActive, search } = query;

    const where: Prisma.InventoryItemWhereInput = {};

    if (categoryId) {
      where.categoryId = categoryId;
    }
    if (itemType) {
      where.itemType = itemType;
    }
    if (isActive !== undefined) {
      where.isActive = isActive;
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { sku: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    if (lowStock === true) {
      // Find IDs where currentStock <= minimumStock
      const lowStockRows = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM "InventoryItem" WHERE "currentStock" <= "minimumStock"
      `;
      const ids = lowStockRows.map((r) => r.id);
      where.id = { in: ids };
    }

    const [items, total] = await Promise.all([
      prisma.inventoryItem.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ name: "asc" }],
        include: {
          category: true,
        },
      }),
      prisma.inventoryItem.count({ where }),
    ]);

    const itemsWithStatus = items.map((item) => ({
      ...item,
      isLowStock: Number(item.currentStock) <= Number(item.minimumStock),
    }));

    return {
      items: itemsWithStatus,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async getItemById(id: string) {
    const item = await prisma.inventoryItem.findUnique({
      where: { id },
      include: {
        category: true,
        movements: {
          take: 10,
          orderBy: [{ movementDate: "desc" }, { createdAt: "desc" }],
          include: {
            eventInventory: {
              include: {
                event: {
                  select: { id: true, eventNumber: true, title: true },
                },
              },
            },
          },
        },
        eventAllocations: {
          take: 10,
          orderBy: { createdAt: "desc" },
          include: {
            event: {
              select: { id: true, eventNumber: true, title: true, status: true, eventDate: true },
            },
          },
        },
      },
    });

    if (!item) {
      throw new NotFoundError(`Inventory item with ID '${id}' not found.`);
    }

    const totalIssued = item.eventAllocations.reduce((sum, alloc) => sum + Number(alloc.issuedQuantity), 0);
    const totalReturned = item.eventAllocations.reduce((sum, alloc) => sum + Number(alloc.returnedQuantity), 0);
    const totalDamaged = item.eventAllocations.reduce((sum, alloc) => sum + Number(alloc.damagedQuantity), 0);
    const currentlyAllocated = Math.max(0, totalIssued - (totalReturned + totalDamaged));

    return {
      ...item,
      isLowStock: Number(item.currentStock) <= Number(item.minimumStock),
      metrics: {
        currentlyAllocatedToEvents: round2(currentlyAllocated),
        totalEventIssued: round2(totalIssued),
        totalEventReturned: round2(totalReturned),
        totalEventDamaged: round2(totalDamaged),
      },
    };
  }

  async updateItem(id: string, data: UpdateInventoryItemInput) {
    const existing = await prisma.inventoryItem.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundError(`Inventory item with ID '${id}' not found.`);
    }

    if (data.categoryId) {
      await this.getCategoryById(data.categoryId);
    }

    if (data.sku && data.sku !== existing.sku) {
      const duplicateSku = await prisma.inventoryItem.findFirst({
        where: {
          sku: data.sku,
          NOT: { id },
        },
      });
      if (duplicateSku) {
        throw new ConflictError(`Another item with SKU '${data.sku}' already exists.`);
      }
    }

    return prisma.inventoryItem.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
        ...(data.itemType !== undefined && { itemType: data.itemType }),
        ...(data.sku !== undefined && { sku: data.sku }),
        ...(data.unit !== undefined && { unit: data.unit }),
        ...(data.minimumStock !== undefined && { minimumStock: toDecimal(data.minimumStock) }),
        ...(data.purchasePrice !== undefined && {
          purchasePrice: data.purchasePrice !== null ? toDecimal(data.purchasePrice) : null,
        }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
      include: {
        category: true,
      },
    });
  }

  async deleteItem(id: string) {
    const item = await prisma.inventoryItem.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            movements: true,
            eventAllocations: true,
          },
        },
      },
    });

    if (!item) {
      throw new NotFoundError(`Inventory item with ID '${id}' not found.`);
    }

    if (item._count.movements > 0 || item._count.eventAllocations > 0) {
      throw new BadRequestError(
        `Cannot permanently delete item '${item.name}' with existing stock movements (${item._count.movements}) or event allocations (${item._count.eventAllocations}). Deactivate item (isActive: false) instead.`
      );
    }

    await prisma.inventoryItem.delete({
      where: { id },
    });

    return { message: `Inventory item '${item.name}' deleted successfully.` };
  }

  // ==========================================
  // STOCK MOVEMENTS (PURCHASE, ADJUSTMENT, LOSS)
  // ==========================================

  async recordPurchase(input: PurchaseMovementInput) {
    const item = await prisma.inventoryItem.findUnique({
      where: { id: input.inventoryItemId },
    });
    if (!item) {
      throw new NotFoundError(`Inventory item with ID '${input.inventoryItemId}' not found.`);
    }

    const qty = round2(input.quantity);
    const unitCost = input.unitCost !== undefined && input.unitCost !== null ? toDecimal(input.unitCost) : null;
    const movementDate = input.movementDate ?? new Date();

    return prisma.$transaction(async (tx) => {
      const updatedItem = await tx.inventoryItem.update({
        where: { id: item.id },
        data: {
          currentStock: { increment: toDecimal(qty) },
          ...(unitCost !== null && { purchasePrice: unitCost }),
        },
      });

      const movement = await tx.inventoryMovement.create({
        data: {
          inventoryItemId: item.id,
          movementType: InventoryMovementType.PURCHASE,
          quantity: toDecimal(qty),
          unitCost,
          referenceNumber: input.referenceNumber ?? null,
          notes: input.notes ?? null,
          movementDate,
        },
      });

      return {
        movement,
        item: {
          id: updatedItem.id,
          name: updatedItem.name,
          currentStock: Number(updatedItem.currentStock),
          purchasePrice: updatedItem.purchasePrice ? Number(updatedItem.purchasePrice) : null,
        },
      };
    });
  }

  async recordAdjustment(input: AdjustmentMovementInput) {
    const item = await prisma.inventoryItem.findUnique({
      where: { id: input.inventoryItemId },
    });
    if (!item) {
      throw new NotFoundError(`Inventory item with ID '${input.inventoryItemId}' not found.`);
    }

    const qty = round2(input.quantity);
    const currentStock = Number(item.currentStock);

    if (input.movementType === InventoryMovementType.ADJUSTMENT_OUT && currentStock < qty) {
      throw new BadRequestError(
        `Insufficient stock for adjustment out. Current stock is ${currentStock}, requested adjustment is ${qty}.`
      );
    }

    const movementDate = input.movementDate ?? new Date();

    return prisma.$transaction(async (tx) => {
      const updatedItem = await tx.inventoryItem.update({
        where: { id: item.id },
        data: {
          currentStock:
            input.movementType === InventoryMovementType.ADJUSTMENT_IN
              ? { increment: toDecimal(qty) }
              : { decrement: toDecimal(qty) },
        },
      });

      const movement = await tx.inventoryMovement.create({
        data: {
          inventoryItemId: item.id,
          movementType: input.movementType,
          quantity: toDecimal(qty),
          referenceNumber: input.referenceNumber ?? null,
          notes: input.notes,
          movementDate,
        },
      });

      return {
        movement,
        item: {
          id: updatedItem.id,
          name: updatedItem.name,
          currentStock: Number(updatedItem.currentStock),
        },
      };
    });
  }

  async recordDamageLoss(input: DamageLossMovementInput) {
    const item = await prisma.inventoryItem.findUnique({
      where: { id: input.inventoryItemId },
    });
    if (!item) {
      throw new NotFoundError(`Inventory item with ID '${input.inventoryItemId}' not found.`);
    }

    const qty = round2(input.quantity);
    const currentStock = Number(item.currentStock);

    if (currentStock < qty) {
      throw new BadRequestError(
        `Insufficient stock to record ${input.movementType.toLowerCase()}. Current stock is ${currentStock}, attempted write-off is ${qty}.`
      );
    }

    const movementDate = input.movementDate ?? new Date();

    return prisma.$transaction(async (tx) => {
      const updatedItem = await tx.inventoryItem.update({
        where: { id: item.id },
        data: {
          currentStock: { decrement: toDecimal(qty) },
        },
      });

      const movement = await tx.inventoryMovement.create({
        data: {
          inventoryItemId: item.id,
          movementType: input.movementType,
          quantity: toDecimal(qty),
          notes: input.notes,
          movementDate,
        },
      });

      return {
        movement,
        item: {
          id: updatedItem.id,
          name: updatedItem.name,
          currentStock: Number(updatedItem.currentStock),
        },
      };
    });
  }

  async getMovements(query: MovementQueryInput) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const { inventoryItemId, eventId, movementType, startDate, endDate } = query;

    const where: Prisma.InventoryMovementWhereInput = {};

    if (inventoryItemId) {
      where.inventoryItemId = inventoryItemId;
    }
    if (movementType) {
      where.movementType = movementType;
    }
    if (eventId) {
      where.eventInventory = { eventId };
    }
    if (startDate || endDate) {
      where.movementDate = {};
      if (startDate) {
        where.movementDate.gte = startDate;
      }
      if (endDate) {
        where.movementDate.lte = endDate;
      }
    }

    const [movements, total] = await Promise.all([
      prisma.inventoryMovement.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ movementDate: "desc" }, { createdAt: "desc" }],
        include: {
          inventoryItem: {
            select: { id: true, name: true, sku: true, unit: true, itemType: true },
          },
          eventInventory: {
            include: {
              event: {
                select: { id: true, eventNumber: true, title: true, status: true },
              },
            },
          },
        },
      }),
      prisma.inventoryMovement.count({ where }),
    ]);

    return {
      movements,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async auditItemStock(itemId: string) {
    const item = await prisma.inventoryItem.findUnique({
      where: { id: itemId },
      include: { category: true },
    });
    if (!item) {
      throw new NotFoundError(`Inventory item with ID '${itemId}' not found.`);
    }

    const movements = await prisma.inventoryMovement.findMany({
      where: { inventoryItemId: itemId },
    });

    let totalPurchased = 0;
    let totalAdjustedIn = 0;
    let totalEventReturned = 0;
    let totalEventIssued = 0;
    let totalWarehouseDamaged = 0;
    let totalEventDamaged = 0;
    let totalWarehouseLost = 0;
    let totalAdjustedOut = 0;

    for (const m of movements) {
      const q = Number(m.quantity);
      switch (m.movementType) {
        case InventoryMovementType.PURCHASE:
          totalPurchased += q;
          break;
        case InventoryMovementType.ADJUSTMENT_IN:
          totalAdjustedIn += q;
          break;
        case InventoryMovementType.EVENT_RETURN:
          totalEventReturned += q;
          break;
        case InventoryMovementType.EVENT_ISSUE:
          totalEventIssued += q;
          break;
        case InventoryMovementType.DAMAGE:
          if (m.eventInventoryId) {
            totalEventDamaged += q;
          } else {
            totalWarehouseDamaged += q;
          }
          break;
        case InventoryMovementType.LOSS:
          totalWarehouseLost += q;
          break;
        case InventoryMovementType.ADJUSTMENT_OUT:
          totalAdjustedOut += q;
          break;
      }
    }

    const totalIncrements = round2(totalPurchased + totalAdjustedIn + totalEventReturned);
    const totalDecrements = round2(totalEventIssued + totalWarehouseDamaged + totalWarehouseLost + totalAdjustedOut);
    const expectedStock = round2(totalIncrements - totalDecrements);
    const currentStock = round2(item.currentStock);
    const discrepancy = round2(currentStock - expectedStock);

    return {
      item: {
        id: item.id,
        name: item.name,
        sku: item.sku,
        unit: item.unit,
        currentStock,
        minimumStock: Number(item.minimumStock),
      },
      audit: {
        isReconciled: Math.abs(discrepancy) < 0.001,
        discrepancy,
        expectedStock,
        currentStock,
        breakdown: {
          inflows: {
            totalPurchased: round2(totalPurchased),
            totalAdjustedIn: round2(totalAdjustedIn),
            totalEventReturned: round2(totalEventReturned),
            totalIncrements,
          },
          outflows: {
            totalEventIssued: round2(totalEventIssued),
            totalWarehouseDamaged: round2(totalWarehouseDamaged),
            totalEventDamaged: round2(totalEventDamaged),
            totalWarehouseLost: round2(totalWarehouseLost),
            totalAdjustedOut: round2(totalAdjustedOut),
            totalDecrements,
          },
        },
      },
    };
  }

  // ==========================================
  // EVENT INVENTORY ALLOCATION & MOVEMENT
  // ==========================================

  async getEventInventory(eventId: string) {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, eventNumber: true, title: true, status: true, eventDate: true },
    });
    if (!event) {
      throw new NotFoundError(`Event with ID '${eventId}' not found.`);
    }

    const allocations = await prisma.eventInventory.findMany({
      where: { eventId },
      include: {
        inventoryItem: {
          include: { category: true },
        },
        movements: {
          orderBy: { movementDate: "desc" },
          take: 5,
        },
      },
      orderBy: { createdAt: "asc" },
    });

    let totalRentalCost = 0;
    let ownedItemsCount = 0;
    let rentedItemsCount = 0;
    let totalOutstandingQuantity = 0;

    const itemsWithMetrics = allocations.map((alloc) => {
      const issued = Number(alloc.issuedQuantity);
      const returned = Number(alloc.returnedQuantity);
      const damaged = Number(alloc.damagedQuantity);
      const outstanding = Math.max(0, round2(issued - (returned + damaged)));
      totalOutstandingQuantity = round2(totalOutstandingQuantity + outstanding);

      const isRented = alloc.usageType === InventoryUsageType.RENTED;
      if (isRented) {
        rentedItemsCount += 1;
        if (alloc.totalRent) {
          totalRentalCost = round2(totalRentalCost + Number(alloc.totalRent));
        }
      } else {
        ownedItemsCount += 1;
      }

      return {
        ...alloc,
        usageType: alloc.usageType,
        rentalStartDate: alloc.rentalStartDate,
        rentalEndDate: alloc.rentalEndDate,
        actualReturnDate: alloc.actualReturnDate,
        rentalDays: alloc.rentalDays,
        rentPerUnit: alloc.rentPerUnit ? Number(alloc.rentPerUnit) : null,
        totalRent: alloc.totalRent ? Number(alloc.totalRent) : null,
        requiredQuantity: Number(alloc.requiredQuantity),
        issuedQuantity: issued,
        returnedQuantity: returned,
        damagedQuantity: damaged,
        outstandingQuantity: outstanding,
      };
    });

    return {
      event,
      summary: {
        totalAllocatedItems: allocations.length,
        ownedItemsCount,
        rentedItemsCount,
        totalRentalCost: round2(totalRentalCost),
        totalOutstandingQuantity: round2(totalOutstandingQuantity),
      },
      allocations: itemsWithMetrics,
    };
  }

  async allocateEventItems(eventId: string, input: AllocateEventItemsInput) {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
    });
    if (!event) {
      throw new NotFoundError(`Event with ID '${eventId}' not found.`);
    }

    return prisma.$transaction(async (tx) => {
      const results = [];
      for (const itemInput of input.items) {
        const item = await tx.inventoryItem.findUnique({
          where: { id: itemInput.inventoryItemId },
        });
        if (!item) {
          throw new NotFoundError(`Inventory item with ID '${itemInput.inventoryItemId}' not found.`);
        }

        const usageType = itemInput.usageType ?? InventoryUsageType.OWNED;

        // Rental days calculation if dates are provided and rentalDays omitted
        let rentalDays = itemInput.rentalDays ?? null;
        if (rentalDays == null && itemInput.rentalStartDate && itemInput.rentalEndDate) {
          const start = new Date(itemInput.rentalStartDate).getTime();
          const end = new Date(itemInput.rentalEndDate).getTime();
          if (end >= start) {
            rentalDays = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
          }
        }

        // Rental cost calculation if rentPerUnit provided and totalRent omitted
        let totalRent = itemInput.totalRent ?? null;
        if (totalRent == null && itemInput.rentPerUnit != null) {
          const days = rentalDays && rentalDays > 0 ? rentalDays : 1;
          totalRent = round2(itemInput.requiredQuantity * itemInput.rentPerUnit * days);
        }

        const allocation = await tx.eventInventory.upsert({
          where: {
            eventId_inventoryItemId: {
              eventId,
              inventoryItemId: itemInput.inventoryItemId,
            },
          },
          update: {
            requiredQuantity: toDecimal(itemInput.requiredQuantity),
            usageType,
            ...(itemInput.rentalStartDate !== undefined && { rentalStartDate: itemInput.rentalStartDate }),
            ...(itemInput.rentalEndDate !== undefined && { rentalEndDate: itemInput.rentalEndDate }),
            ...(itemInput.actualReturnDate !== undefined && { actualReturnDate: itemInput.actualReturnDate }),
            ...(rentalDays !== null && { rentalDays }),
            ...(itemInput.rentPerUnit !== undefined && {
              rentPerUnit: itemInput.rentPerUnit != null ? toDecimal(itemInput.rentPerUnit) : null,
            }),
            ...(totalRent !== null && {
              totalRent: toDecimal(totalRent),
            }),
            notes: itemInput.notes ?? null,
          },
          create: {
            eventId,
            inventoryItemId: itemInput.inventoryItemId,
            requiredQuantity: toDecimal(itemInput.requiredQuantity),
            usageType,
            rentalStartDate: itemInput.rentalStartDate ?? null,
            rentalEndDate: itemInput.rentalEndDate ?? null,
            actualReturnDate: itemInput.actualReturnDate ?? null,
            rentalDays,
            rentPerUnit: itemInput.rentPerUnit != null ? toDecimal(itemInput.rentPerUnit) : null,
            totalRent: totalRent != null ? toDecimal(totalRent) : null,
            notes: itemInput.notes ?? null,
          },
          include: {
            inventoryItem: true,
          },
        });

        results.push(allocation);
      }
      return results;
    });
  }

  async updateEventItem(eventId: string, inventoryItemId: string, input: UpdateEventItemInput) {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
    });
    if (!event) {
      throw new NotFoundError(`Event with ID '${eventId}' not found.`);
    }

    const existing = await prisma.eventInventory.findUnique({
      where: {
        eventId_inventoryItemId: {
          eventId,
          inventoryItemId,
        },
      },
      include: {
        inventoryItem: true,
      },
    });
    if (!existing) {
      throw new NotFoundError(
        `Event inventory allocation for item ID '${inventoryItemId}' not found in event ${event.eventNumber}.`
      );
    }

    const usageType = input.usageType ?? existing.usageType;
    const requiredQuantity = input.requiredQuantity ?? Number(existing.requiredQuantity);
    const rentalStartDate = input.rentalStartDate !== undefined ? input.rentalStartDate : existing.rentalStartDate;
    const rentalEndDate = input.rentalEndDate !== undefined ? input.rentalEndDate : existing.rentalEndDate;

    let rentalDays = input.rentalDays !== undefined ? input.rentalDays : existing.rentalDays;
    if (rentalDays == null && rentalStartDate && rentalEndDate) {
      const start = new Date(rentalStartDate).getTime();
      const end = new Date(rentalEndDate).getTime();
      if (end >= start) {
        rentalDays = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
      }
    }

    const rentPerUnit =
      input.rentPerUnit !== undefined
        ? input.rentPerUnit
        : existing.rentPerUnit != null
        ? Number(existing.rentPerUnit)
        : null;

    let totalRent =
      input.totalRent !== undefined
        ? input.totalRent
        : existing.totalRent != null
        ? Number(existing.totalRent)
        : null;

    if (
      input.totalRent === undefined &&
      (input.rentPerUnit !== undefined ||
        input.rentalDays !== undefined ||
        input.rentalStartDate !== undefined ||
        input.rentalEndDate !== undefined ||
        input.requiredQuantity !== undefined)
    ) {
      if (rentPerUnit != null) {
        const days = rentalDays && rentalDays > 0 ? rentalDays : 1;
        totalRent = round2(requiredQuantity * rentPerUnit * days);
      }
    }

    const updated = await prisma.eventInventory.update({
      where: { id: existing.id },
      data: {
        usageType,
        requiredQuantity: toDecimal(requiredQuantity),
        rentalStartDate: rentalStartDate ?? null,
        rentalEndDate: rentalEndDate ?? null,
        actualReturnDate: input.actualReturnDate !== undefined ? input.actualReturnDate : existing.actualReturnDate,
        rentalDays: rentalDays ?? null,
        rentPerUnit: rentPerUnit != null ? toDecimal(rentPerUnit) : null,
        totalRent: totalRent != null ? toDecimal(totalRent) : null,
        ...(input.notes !== undefined && { notes: input.notes }),
      },
      include: {
        inventoryItem: true,
      },
    });

    const issued = Number(updated.issuedQuantity);
    const returned = Number(updated.returnedQuantity);
    const damaged = Number(updated.damagedQuantity);
    const outstanding = Math.max(0, round2(issued - (returned + damaged)));

    return {
      ...updated,
      usageType: updated.usageType,
      rentalDays: updated.rentalDays,
      rentPerUnit: updated.rentPerUnit ? Number(updated.rentPerUnit) : null,
      totalRent: updated.totalRent ? Number(updated.totalRent) : null,
      requiredQuantity: Number(updated.requiredQuantity),
      issuedQuantity: issued,
      returnedQuantity: returned,
      damagedQuantity: damaged,
      outstandingQuantity: outstanding,
    };
  }

  async issueEventItems(eventId: string, input: IssueEventItemsInput) {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
    });
    if (!event) {
      throw new NotFoundError(`Event with ID '${eventId}' not found.`);
    }

    return prisma.$transaction(async (tx) => {
      const issuedResults = [];

      for (const itemInput of input.items) {
        const item = await tx.inventoryItem.findUnique({
          where: { id: itemInput.inventoryItemId },
        });
        if (!item) {
          throw new NotFoundError(`Inventory item with ID '${itemInput.inventoryItemId}' not found.`);
        }

        if (!item.isActive) {
          throw new BadRequestError(`Cannot issue inactive inventory item '${item.name}'.`);
        }

        const qty = round2(itemInput.quantity);
        const currentStock = Number(item.currentStock);

        // Check if allocation exists to get usageType (or take from input, default OWNED)
        const existingAlloc = await tx.eventInventory.findUnique({
          where: {
            eventId_inventoryItemId: {
              eventId,
              inventoryItemId: item.id,
            },
          },
        });

        const effectiveUsageType = itemInput.usageType ?? existingAlloc?.usageType ?? InventoryUsageType.OWNED;
        const isRented = effectiveUsageType === InventoryUsageType.RENTED;

        // 1. If OWNED: decrement warehouse stock with stock availability check
        //    If RENTED: equipment is from external rental vendor, warehouse stock remains untouched
        let remainingStock = currentStock;
        if (!isRented) {
          if (currentStock < qty) {
            throw new BadRequestError(
              `Insufficient stock for item '${item.name}' (SKU: ${item.sku ?? "N/A"}). Available: ${currentStock}, Requested: ${qty}.`
            );
          }

          await tx.inventoryItem.update({
            where: { id: item.id },
            data: {
              currentStock: { decrement: toDecimal(qty) },
            },
          });
          remainingStock = round2(currentStock - qty);
        }

        // 2. Upsert EventInventory allocation with incremented issuedQuantity
        const eventInventory = await tx.eventInventory.upsert({
          where: {
            eventId_inventoryItemId: {
              eventId,
              inventoryItemId: item.id,
            },
          },
          update: {
            issuedQuantity: { increment: toDecimal(qty) },
            ...(itemInput.usageType !== undefined && { usageType: itemInput.usageType }),
            ...(itemInput.notes && { notes: itemInput.notes }),
          },
          create: {
            eventId,
            inventoryItemId: item.id,
            requiredQuantity: toDecimal(qty),
            issuedQuantity: toDecimal(qty),
            usageType: effectiveUsageType,
            notes: itemInput.notes ?? null,
          },
        });

        // 3. Create movement log
        const movement = await tx.inventoryMovement.create({
          data: {
            inventoryItemId: item.id,
            eventInventoryId: eventInventory.id,
            movementType: InventoryMovementType.EVENT_ISSUE,
            quantity: toDecimal(qty),
            referenceNumber: event.eventNumber,
            notes:
              itemInput.notes ??
              (isRented
                ? `Rented item issued/received on-site for event ${event.eventNumber} (${event.title})`
                : `Issued to event ${event.eventNumber} (${event.title})`),
          },
        });

        issuedResults.push({
          itemId: item.id,
          itemName: item.name,
          usageType: eventInventory.usageType,
          issuedQuantity: qty,
          remainingWarehouseStock: remainingStock,
          movementId: movement.id,
        });
      }

      return issuedResults;
    });
  }

  async returnEventItems(eventId: string, input: ReturnEventItemsInput) {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
    });
    if (!event) {
      throw new NotFoundError(`Event with ID '${eventId}' not found.`);
    }

    return prisma.$transaction(async (tx) => {
      const returnResults = [];

      for (const itemInput of input.items) {
        const eventInventory = await tx.eventInventory.findUnique({
          where: {
            eventId_inventoryItemId: {
              eventId,
              inventoryItemId: itemInput.inventoryItemId,
            },
          },
          include: {
            inventoryItem: true,
          },
        });

        if (!eventInventory) {
          throw new NotFoundError(
            `No event inventory record found for item ID '${itemInput.inventoryItemId}' in event ${event.eventNumber}.`
          );
        }

        const returnedQty = round2(itemInput.returnedQuantity);
        const damagedQty = round2(itemInput.damagedQuantity);
        const totalReturning = round2(returnedQty + damagedQty);

        const totalIssued = Number(eventInventory.issuedQuantity);
        const alreadyReturnedOrDamaged = round2(
          Number(eventInventory.returnedQuantity) + Number(eventInventory.damagedQuantity)
        );
        const outstanding = round2(totalIssued - alreadyReturnedOrDamaged);

        if (totalReturning > outstanding) {
          throw new BadRequestError(
            `Cannot process return for '${eventInventory.inventoryItem.name}'. Outstanding unreturned quantity is ${outstanding}, but attempted to process ${totalReturning} (${returnedQty} returned + ${damagedQty} damaged).`
          );
        }

        const isRented = eventInventory.usageType === InventoryUsageType.RENTED;

        // 1. If undamaged items returned:
        //    - OWNED: add back to warehouse currentStock
        //    - RENTED: returned to vendor, warehouse currentStock untouched
        if (returnedQty > 0) {
          if (!isRented) {
            await tx.inventoryItem.update({
              where: { id: eventInventory.inventoryItemId },
              data: {
                currentStock: { increment: toDecimal(returnedQty) },
              },
            });
          }

          await tx.inventoryMovement.create({
            data: {
              inventoryItemId: eventInventory.inventoryItemId,
              eventInventoryId: eventInventory.id,
              movementType: InventoryMovementType.EVENT_RETURN,
              quantity: toDecimal(returnedQty),
              referenceNumber: event.eventNumber,
              notes:
                itemInput.notes ??
                (isRented
                  ? `Rented item returned in good condition to vendor for event ${event.eventNumber}`
                  : `Returned in good condition from event ${event.eventNumber}`),
            },
          });
        }

        // 2. If damaged items reported:
        //    - Neither OWNED nor RENTED adds back to warehouse stock.
        //    - For RENTED, records vendor liability tracking.
        if (damagedQty > 0) {
          await tx.inventoryMovement.create({
            data: {
              inventoryItemId: eventInventory.inventoryItemId,
              eventInventoryId: eventInventory.id,
              movementType: InventoryMovementType.DAMAGE,
              quantity: toDecimal(damagedQty),
              referenceNumber: event.eventNumber,
              notes:
                itemInput.notes ??
                (isRented
                  ? `Rented item damaged during event ${event.eventNumber} (vendor liability)`
                  : `Damaged during event ${event.eventNumber}`),
            },
          });
        }

        // 3. Update EventInventory record counts and actualReturnDate if specified
        const returnDateToSet =
          itemInput.actualReturnDate !== undefined
            ? itemInput.actualReturnDate
            : totalReturning === outstanding
            ? new Date()
            : undefined;

        const updatedAlloc = await tx.eventInventory.update({
          where: { id: eventInventory.id },
          data: {
            returnedQuantity: { increment: toDecimal(returnedQty) },
            damagedQuantity: { increment: toDecimal(damagedQty) },
            ...(returnDateToSet !== undefined && { actualReturnDate: returnDateToSet }),
          },
          include: {
            inventoryItem: true,
          },
        });

        const newOutstanding = round2(
          Number(updatedAlloc.issuedQuantity) -
            (Number(updatedAlloc.returnedQuantity) + Number(updatedAlloc.damagedQuantity))
        );

        returnResults.push({
          itemId: updatedAlloc.inventoryItemId,
          itemName: updatedAlloc.inventoryItem.name,
          usageType: updatedAlloc.usageType,
          returnedQuantity: returnedQty,
          damagedQuantity: damagedQty,
          actualReturnDate: updatedAlloc.actualReturnDate,
          remainingOutstandingForEvent: newOutstanding,
        });
      }

      return returnResults;
    });
  }
}

export const inventoryService = new InventoryService();
