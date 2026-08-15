-- Required before the GIN trigram index on Member.displayName can be created.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateEnum
CREATE TYPE "FamilyRole" AS ENUM ('OWNER', 'ADMIN', 'CONTRIBUTOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "LivingStatus" AS ENUM ('LIVING', 'DECEASED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "DateQualifier" AS ENUM ('EXACT', 'ABOUT', 'BEFORE', 'AFTER', 'RANGE');

-- CreateEnum
CREATE TYPE "ParentRelationType" AS ENUM ('BIOLOGICAL', 'ADOPTIVE', 'STEP', 'FOSTER', 'GUARDIAN');

-- CreateEnum
CREATE TYPE "Certainty" AS ENUM ('CONFIRMED', 'PROBABLE', 'DISPUTED');

-- CreateEnum
CREATE TYPE "PartnershipType" AS ENUM ('MARRIAGE', 'PARTNERSHIP', 'UNION');

-- CreateEnum
CREATE TYPE "PartnershipStatus" AS ENUM ('ACTIVE', 'SEPARATED', 'DIVORCED', 'ENDED_BY_DEATH');

-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('FAMILY', 'ADMINS_ONLY');

-- CreateEnum
CREATE TYPE "ContentSource" AS ENUM ('HUMAN', 'AI_ASSISTED_DRAFT', 'AI_ASSISTED_APPROVED');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('BIRTH', 'DEATH', 'MARRIAGE', 'MIGRATION', 'EDUCATION', 'CAREER', 'MILITARY', 'ACHIEVEMENT', 'RELIGIOUS', 'OTHER');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('FAMILY_CREATED', 'FAMILY_UPDATED', 'FAMILY_EXPORTED', 'MEMBER_CREATED', 'MEMBER_UPDATED', 'MEMBER_DELETED', 'MEMBER_RESTORED', 'MEMBER_MARKED_DECEASED', 'MEMBER_DEATH_REVERTED', 'MEMBER_CLAIMED', 'RELATIONSHIP_CREATED', 'RELATIONSHIP_DELETED', 'PHOTO_UPLOADED', 'PHOTO_DELETED', 'PRIMARY_PHOTO_SET', 'STORY_CREATED', 'STORY_UPDATED', 'STORY_DELETED', 'EVENT_CREATED', 'EVENT_UPDATED', 'EVENT_DELETED', 'INVITATION_CREATED', 'INVITATION_ACCEPTED', 'INVITATION_REVOKED', 'ROLE_CHANGED', 'AI_STORY_DRAFTED');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "avatarUrl" TEXT,
    "passwordHash" TEXT,
    "emailVerifiedAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Family" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "hideLivingFromViewers" BOOLEAN NOT NULL DEFAULT true,
    "aiEnabled" BOOLEAN NOT NULL DEFAULT false,
    "coverPhotoId" UUID,
    "defaultRootMemberId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Family_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyMembership" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "role" "FamilyRole" NOT NULL DEFAULT 'VIEWER',
    "claimedMemberId" UUID,
    "invitedById" UUID,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FamilyMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Member" (
    "id" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "givenName" TEXT,
    "familyName" TEXT,
    "otherNames" TEXT,
    "displayName" TEXT NOT NULL,
    "maidenName" TEXT,
    "gender" TEXT,
    "livingStatus" "LivingStatus" NOT NULL DEFAULT 'UNKNOWN',
    "birthDate" DATE,
    "birthDateQualifier" "DateQualifier",
    "birthDateText" TEXT,
    "birthPlace" TEXT,
    "deathDate" DATE,
    "deathDateQualifier" "DateQualifier",
    "deathDateText" TEXT,
    "deathPlace" TEXT,
    "biography" TEXT,
    "occupation" TEXT,
    "notes" TEXT,
    "causeOfDeath" TEXT,
    "primaryPhotoId" UUID,
    "sortIndex" INTEGER NOT NULL DEFAULT 0,
    "createdById" UUID,
    "updatedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParentChild" (
    "id" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "parentId" UUID NOT NULL,
    "childId" UUID NOT NULL,
    "relationType" "ParentRelationType" NOT NULL DEFAULT 'BIOLOGICAL',
    "certainty" "Certainty" NOT NULL DEFAULT 'CONFIRMED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParentChild_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Partnership" (
    "id" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "memberAId" UUID NOT NULL,
    "memberBId" UUID NOT NULL,
    "type" "PartnershipType" NOT NULL DEFAULT 'MARRIAGE',
    "status" "PartnershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "startDate" DATE,
    "startDateQualifier" "DateQualifier",
    "startDateText" TEXT,
    "endDate" DATE,
    "endDateQualifier" "DateQualifier",
    "endDateText" TEXT,
    "place" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Partnership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Photo" (
    "id" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "storageProvider" TEXT NOT NULL DEFAULT 'cloudinary',
    "storageId" TEXT NOT NULL,
    "deliveryType" TEXT NOT NULL DEFAULT 'authenticated',
    "width" INTEGER,
    "height" INTEGER,
    "bytes" INTEGER,
    "format" TEXT,
    "blurhash" TEXT,
    "caption" TEXT,
    "takenDate" DATE,
    "takenDateQualifier" "DateQualifier",
    "takenDateText" TEXT,
    "takenPlace" TEXT,
    "uploadedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Photo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhotoSubject" (
    "photoId" UUID NOT NULL,
    "memberId" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhotoSubject_pkey" PRIMARY KEY ("photoId","memberId")
);

-- CreateTable
CREATE TABLE "Story" (
    "id" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "source" "ContentSource" NOT NULL DEFAULT 'HUMAN',
    "originalNotes" TEXT,
    "eventDate" DATE,
    "eventDateQualifier" "DateQualifier",
    "eventDateText" TEXT,
    "place" TEXT,
    "visibility" "Visibility" NOT NULL DEFAULT 'FAMILY',
    "authorUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Story_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StorySubject" (
    "storyId" UUID NOT NULL,
    "memberId" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StorySubject_pkey" PRIMARY KEY ("storyId","memberId")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "memberId" UUID NOT NULL,
    "type" "EventType" NOT NULL DEFAULT 'OTHER',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "date" DATE,
    "dateQualifier" "DateQualifier",
    "dateText" TEXT,
    "place" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "role" "FamilyRole" NOT NULL DEFAULT 'VIEWER',
    "tokenHash" TEXT NOT NULL,
    "invitedById" UUID,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "actorUserId" UUID,
    "action" "AuditAction" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" UUID,
    "summary" TEXT,
    "diff" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_deletedAt_idx" ON "User"("deletedAt");

-- CreateIndex
CREATE INDEX "Family_deletedAt_idx" ON "Family"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyMembership_claimedMemberId_key" ON "FamilyMembership"("claimedMemberId");

-- CreateIndex
CREATE INDEX "FamilyMembership_familyId_role_idx" ON "FamilyMembership"("familyId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyMembership_userId_familyId_key" ON "FamilyMembership"("userId", "familyId");

-- CreateIndex
CREATE INDEX "Member_familyId_deletedAt_idx" ON "Member"("familyId", "deletedAt");

-- CreateIndex
CREATE INDEX "Member_familyId_livingStatus_idx" ON "Member"("familyId", "livingStatus");

-- CreateIndex
CREATE INDEX "Member_displayName_idx" ON "Member" USING GIN ("displayName" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "ParentChild_childId_idx" ON "ParentChild"("childId");

-- CreateIndex
CREATE INDEX "ParentChild_parentId_idx" ON "ParentChild"("parentId");

-- CreateIndex
CREATE INDEX "ParentChild_familyId_idx" ON "ParentChild"("familyId");

-- CreateIndex
CREATE UNIQUE INDEX "ParentChild_parentId_childId_relationType_key" ON "ParentChild"("parentId", "childId", "relationType");

-- CreateIndex
CREATE INDEX "Partnership_memberAId_idx" ON "Partnership"("memberAId");

-- CreateIndex
CREATE INDEX "Partnership_memberBId_idx" ON "Partnership"("memberBId");

-- CreateIndex
CREATE INDEX "Partnership_familyId_idx" ON "Partnership"("familyId");

-- CreateIndex
CREATE UNIQUE INDEX "Partnership_memberAId_memberBId_startDate_key" ON "Partnership"("memberAId", "memberBId", "startDate");

-- CreateIndex
CREATE INDEX "Photo_familyId_deletedAt_idx" ON "Photo"("familyId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Photo_storageProvider_storageId_key" ON "Photo"("storageProvider", "storageId");

-- CreateIndex
CREATE INDEX "PhotoSubject_memberId_idx" ON "PhotoSubject"("memberId");

-- CreateIndex
CREATE INDEX "PhotoSubject_familyId_idx" ON "PhotoSubject"("familyId");

-- CreateIndex
CREATE INDEX "Story_familyId_deletedAt_idx" ON "Story"("familyId", "deletedAt");

-- CreateIndex
CREATE INDEX "Story_familyId_visibility_idx" ON "Story"("familyId", "visibility");

-- CreateIndex
CREATE INDEX "StorySubject_memberId_idx" ON "StorySubject"("memberId");

-- CreateIndex
CREATE INDEX "StorySubject_familyId_idx" ON "StorySubject"("familyId");

-- CreateIndex
CREATE INDEX "Event_familyId_deletedAt_idx" ON "Event"("familyId", "deletedAt");

-- CreateIndex
CREATE INDEX "Event_memberId_date_idx" ON "Event"("memberId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_tokenHash_key" ON "Invitation"("tokenHash");

-- CreateIndex
CREATE INDEX "Invitation_familyId_idx" ON "Invitation"("familyId");

-- CreateIndex
CREATE INDEX "Invitation_email_idx" ON "Invitation"("email");

-- CreateIndex
CREATE INDEX "AuditLog_familyId_createdAt_idx" ON "AuditLog"("familyId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "FamilyMembership" ADD CONSTRAINT "FamilyMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyMembership" ADD CONSTRAINT "FamilyMembership_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyMembership" ADD CONSTRAINT "FamilyMembership_claimedMemberId_fkey" FOREIGN KEY ("claimedMemberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentChild" ADD CONSTRAINT "ParentChild_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentChild" ADD CONSTRAINT "ParentChild_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentChild" ADD CONSTRAINT "ParentChild_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Partnership" ADD CONSTRAINT "Partnership_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Partnership" ADD CONSTRAINT "Partnership_memberAId_fkey" FOREIGN KEY ("memberAId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Partnership" ADD CONSTRAINT "Partnership_memberBId_fkey" FOREIGN KEY ("memberBId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotoSubject" ADD CONSTRAINT "PhotoSubject_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotoSubject" ADD CONSTRAINT "PhotoSubject_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotoSubject" ADD CONSTRAINT "PhotoSubject_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Story" ADD CONSTRAINT "Story_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Story" ADD CONSTRAINT "Story_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StorySubject" ADD CONSTRAINT "StorySubject_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StorySubject" ADD CONSTRAINT "StorySubject_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StorySubject" ADD CONSTRAINT "StorySubject_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- A person cannot be their own parent.
ALTER TABLE "ParentChild"
  ADD CONSTRAINT "parent_child_no_self_reference"
  CHECK ("parentId" <> "childId");

-- One canonical row per couple. Enforcing an ordered pair is what prevents two
-- rows for the same partnership drifting apart.
ALTER TABLE "Partnership"
  ADD CONSTRAINT "partnership_ordered_pair"
  CHECK ("memberAId" < "memberBId");