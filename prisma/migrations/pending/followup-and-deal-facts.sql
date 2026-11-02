-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "followUpQuietDays" INTEGER NOT NULL DEFAULT 14,
ADD COLUMN     "followUpQuoteDays" INTEGER NOT NULL DEFAULT 3;

-- CreateTable
CREATE TABLE "FollowUpAction" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "rule" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "snoozedUntil" TIMESTAMP(3),
    "handledAgainst" TIMESTAMP(3),
    "note" TEXT,
    "actedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FollowUpAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealFollowUp" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "contactId" TEXT,
    "rule" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "evidence" TEXT,
    "toAddress" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "edited" BOOLEAN NOT NULL DEFAULT false,
    "aiSource" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "sendClaimedAt" TIMESTAMP(3),
    "providerMessageId" TEXT,
    "simulated" BOOLEAN NOT NULL DEFAULT false,
    "failureReason" TEXT,
    "approvedBy" TEXT,
    "sentAt" TIMESTAMP(3),
    "repliedAt" TIMESTAMP(3),
    "replyEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DealFollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealFact" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUGGESTED',
    "sourceKind" TEXT NOT NULL,
    "evidence" TEXT,
    "correctedFrom" TEXT,
    "confirmedBy" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "lastVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DealFact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecoveryExclusion" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "note" TEXT,
    "excludedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecoveryExclusion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FollowUpAction_orgId_state_idx" ON "FollowUpAction"("orgId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "FollowUpAction_opportunityId_rule_key" ON "FollowUpAction"("opportunityId", "rule");

-- CreateIndex
CREATE UNIQUE INDEX "DealFollowUp_providerMessageId_key" ON "DealFollowUp"("providerMessageId");

-- CreateIndex
CREATE INDEX "DealFollowUp_orgId_status_idx" ON "DealFollowUp"("orgId", "status");

-- CreateIndex
CREATE INDEX "DealFollowUp_orgId_opportunityId_idx" ON "DealFollowUp"("orgId", "opportunityId");

-- CreateIndex
CREATE INDEX "DealFollowUp_orgId_sentAt_idx" ON "DealFollowUp"("orgId", "sentAt");

-- CreateIndex
CREATE INDEX "DealFact_orgId_opportunityId_idx" ON "DealFact"("orgId", "opportunityId");

-- CreateIndex
CREATE INDEX "DealFact_orgId_kind_idx" ON "DealFact"("orgId", "kind");

-- CreateIndex
CREATE INDEX "RecoveryExclusion_orgId_idx" ON "RecoveryExclusion"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "RecoveryExclusion_opportunityId_reason_key" ON "RecoveryExclusion"("opportunityId", "reason");

-- AddForeignKey
ALTER TABLE "FollowUpAction" ADD CONSTRAINT "FollowUpAction_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpAction" ADD CONSTRAINT "FollowUpAction_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealFollowUp" ADD CONSTRAINT "DealFollowUp_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealFollowUp" ADD CONSTRAINT "DealFollowUp_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealFollowUp" ADD CONSTRAINT "DealFollowUp_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Prospect"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealFact" ADD CONSTRAINT "DealFact_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealFact" ADD CONSTRAINT "DealFact_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecoveryExclusion" ADD CONSTRAINT "RecoveryExclusion_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecoveryExclusion" ADD CONSTRAINT "RecoveryExclusion_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

