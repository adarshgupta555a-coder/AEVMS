import { prisma, Prisma } from "../lib/prisma.js";
import { InventoryMovementType } from "../generated/prisma/enums.js";
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

    const itemsWithMetrics = allocations.map((alloc) => {
      const issued = Number(alloc.issuedQuantity);
      const returned = Number(alloc.returnedQuantity);
      const damaged = Number(alloc.damagedQuantity);
      const outstanding = Math.max(0, round2(issued - (returned + damaged)));

      return {
        ...alloc,
        requiredQuantity: Number(alloc.requiredQuantity),
        issuedQuantity: issued,
        returnedQuantity: returned,
        damagedQuantity: damaged,
        outstandingQuantity: outstanding,
      };
    });

    return {
      event,
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

        const allocation = await tx.eventInventory.upsert({
          where: {
            eventId_inventoryItemId: {
              eventId,
              inventoryItemId: itemInput.inventoryItemId,
            },
          },
          update: {
            requiredQuantity: toDecimal(itemInput.requiredQuantity),
            notes: itemInput.notes ?? null,
          },
          create: {
            eventId,
            inventoryItemId: itemInput.inventoryItemId,
            requiredQuantity: toDecimal(itemInput.requiredQuantity),
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

        if (currentStock < qty) {
          throw new BadRequestError(
            `Insufficient stock for item '${item.name}' (SKU: ${item.sku ?? "N/A"}). Available: ${currentStock}, Requested: ${qty}.`
          );
        }

        // 1. Decrement warehouse stock
        await tx.inventoryItem.update({
          where: { id: item.id },
          data: {
            currentStock: { decrement: toDecimal(qty) },
          },
        });

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
            ...(itemInput.notes && { notes: itemInput.notes }),
          },
          create: {
            eventId,
            inventoryItemId: item.id,
            requiredQuantity: toDecimal(qty),
            issuedQuantity: toDecimal(qty),
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
            notes: itemInput.notes ?? `Issued to event ${event.eventNumber} (${event.title})`,
          },
        });

        issuedResults.push({
          itemId: item.id,
          itemName: item.name,
          issuedQuantity: qty,
          remainingWarehouseStock: round2(currentStock - qty),
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

        // 1. If undamaged items returned, add them back to warehouse currentStock
        if (returnedQty > 0) {
          await tx.inventoryItem.update({
            where: { id: eventInventory.inventoryItemId },
            data: {
              currentStock: { increment: toDecimal(returnedQty) },
            },
          });

          await tx.inventoryMovement.create({
            data: {
              inventoryItemId: eventInventory.inventoryItemId,
              eventInventoryId: eventInventory.id,
              movementType: InventoryMovementType.EVENT_RETURN,
              quantity: toDecimal(returnedQty),
              referenceNumber: event.eventNumber,
              notes: itemInput.notes ?? `Returned in good condition from event ${event.eventNumber}`,
            },
          });
        }

        // 2. If damaged items reported, do NOT add back to currentStock (they are broken/lost)
        if (damagedQty > 0) {
          await tx.inventoryMovement.create({
            data: {
              inventoryItemId: eventInventory.inventoryItemId,
              eventInventoryId: eventInventory.id,
              movementType: InventoryMovementType.DAMAGE,
              quantity: toDecimal(damagedQty),
              referenceNumber: event.eventNumber,
              notes: itemInput.notes ?? `Damaged during event ${event.eventNumber}`,
            },
          });
        }

        // 3. Update EventInventory record counts
        const updatedAlloc = await tx.eventInventory.update({
          where: { id: eventInventory.id },
          data: {
            returnedQuantity: { increment: toDecimal(returnedQty) },
            damagedQuantity: { increment: toDecimal(damagedQty) },
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
          returnedQuantity: returnedQty,
          damagedQuantity: damagedQty,
          remainingOutstandingForEvent: newOutstanding,
        });
      }

      return returnResults;
    });
  }
}

export const inventoryService = new InventoryService();
