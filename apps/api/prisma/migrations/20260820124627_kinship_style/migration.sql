-- CreateEnum
CREATE TYPE "KinshipStyle" AS ENUM ('WESTERN', 'CLASSIFICATORY');

-- AlterTable
ALTER TABLE "Family" ADD COLUMN     "kinshipStyle" "KinshipStyle" NOT NULL DEFAULT 'WESTERN';
