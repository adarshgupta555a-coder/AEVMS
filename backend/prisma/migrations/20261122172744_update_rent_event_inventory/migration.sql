-- CreateEnum
CREATE TYPE "InventoryUsageType" AS ENUM ('OWNED', 'RENTED');

-- AlterEnum
ALTER TYPE "USERROLE" ADD VALUE 'SUPER_ADMIN';

-- AlterTable
ALTER TABLE "EventInventory" ADD COLUMN     "actualReturnDate" TIMESTAMP(3),
ADD COLUMN     "rentPerUnit" DECIMAL(12,2),
ADD COLUMN     "rentalDays" INTEGER,
ADD COLUMN     "rentalEndDate" TIMESTAMP(3),
ADD COLUMN     "rentalStartDate" TIMESTAMP(3),
ADD COLUMN     "totalRent" DECIMAL(12,2),
ADD COLUMN     "usageType" "InventoryUsageType" NOT NULL DEFAULT 'OWNED';

-- DropEnum
DROP TYPE "UserRole";
