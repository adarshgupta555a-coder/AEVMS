-- AlterTable
ALTER TABLE "User" ADD COLUMN     "invitationExpiresAt" TIMESTAMP(3),
ADD COLUMN     "invitationToken" TEXT;
