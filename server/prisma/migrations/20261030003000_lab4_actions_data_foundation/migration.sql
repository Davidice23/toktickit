-- Lab 4 data foundation. This migration is additive: no Lab 1-3 table,
-- foreign key, identifier, or attachment metadata is removed or rewritten.

CREATE TYPE "ActionStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
CREATE TYPE "ActionTakenEventKind" AS ENUM ('CREATED', 'EDITED', 'ASSIGNED', 'STATUS_CHANGED', 'COMPLETED', 'CANCELLED');

ALTER TABLE "Ticket"
  ADD COLUMN "workflowVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "resolvedAt" TIMESTAMP(3);

CREATE TABLE "ActionTaken" (
  "id" SERIAL NOT NULL,
  "ticketId" INTEGER NOT NULL,
  "assigneeId" INTEGER NOT NULL,
  "createdById" INTEGER NOT NULL,
  "performedById" INTEGER,
  "status" "ActionStatus" NOT NULL DEFAULT 'PLANNED',
  "description" TEXT NOT NULL,
  "result" TEXT,
  "followUpRequired" BOOLEAN NOT NULL DEFAULT false,
  "followUpNote" TEXT,
  "attachmentNotes" TEXT,
  "actionAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "cancellationReason" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "requestFingerprint" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ActionTaken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ActionTakenEvent" (
  "id" SERIAL NOT NULL,
  "actionId" INTEGER NOT NULL,
  "actorId" INTEGER NOT NULL,
  "kind" "ActionTakenEventKind" NOT NULL,
  "fromStatus" "ActionStatus",
  "toStatus" "ActionStatus",
  "fieldName" TEXT,
  "oldValue" JSONB,
  "newValue" JSONB,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ActionTakenEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TicketWorkflowEvent" (
  "id" SERIAL NOT NULL,
  "ticketId" INTEGER NOT NULL,
  "actorId" INTEGER NOT NULL,
  "previousStatus" "TicketStatus",
  "currentStatus" "TicketStatus" NOT NULL,
  "reason" TEXT,
  "confirmation" BOOLEAN,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TicketWorkflowEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ActionTaken_ticketId_createdById_idempotencyKey_key"
  ON "ActionTaken"("ticketId", "createdById", "idempotencyKey");
CREATE INDEX "ActionTaken_ticketId_status_id_idx" ON "ActionTaken"("ticketId", "status", "id");
CREATE INDEX "ActionTaken_assigneeId_status_updatedAt_idx" ON "ActionTaken"("assigneeId", "status", "updatedAt");
CREATE INDEX "ActionTaken_performedById_actionAt_idx" ON "ActionTaken"("performedById", "actionAt");
CREATE INDEX "ActionTaken_ticketId_createdAt_id_idx" ON "ActionTaken"("ticketId", "createdAt", "id");
CREATE INDEX "ActionTakenEvent_actionId_createdAt_id_idx" ON "ActionTakenEvent"("actionId", "createdAt", "id");
CREATE INDEX "ActionTakenEvent_actorId_createdAt_idx" ON "ActionTakenEvent"("actorId", "createdAt");
CREATE INDEX "TicketWorkflowEvent_ticketId_createdAt_id_idx" ON "TicketWorkflowEvent"("ticketId", "createdAt", "id");
CREATE INDEX "TicketWorkflowEvent_actorId_createdAt_idx" ON "TicketWorkflowEvent"("actorId", "createdAt");
CREATE INDEX "Ticket_currentStatus_ownerId_updatedAt_idx" ON "Ticket"("currentStatus", "ownerId", "updatedAt");
CREATE INDEX "Ticket_resolvedAt_requesterId_idx" ON "Ticket"("resolvedAt", "requesterId");

ALTER TABLE "ActionTaken" ADD CONSTRAINT "ActionTaken_ticketId_fkey"
  FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActionTaken" ADD CONSTRAINT "ActionTaken_assigneeId_fkey"
  FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActionTaken" ADD CONSTRAINT "ActionTaken_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActionTaken" ADD CONSTRAINT "ActionTaken_performedById_fkey"
  FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActionTakenEvent" ADD CONSTRAINT "ActionTakenEvent_actionId_fkey"
  FOREIGN KEY ("actionId") REFERENCES "ActionTaken"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActionTakenEvent" ADD CONSTRAINT "ActionTakenEvent_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TicketWorkflowEvent" ADD CONSTRAINT "TicketWorkflowEvent_ticketId_fkey"
  FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TicketWorkflowEvent" ADD CONSTRAINT "TicketWorkflowEvent_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
