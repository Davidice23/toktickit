import { ActionStatus, ITPriority, Prisma, TicketStatus } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { Router, type Request, type Response } from "express";
import { type AuthenticatedRequest, errorBody, requireCsrf, requireNormalSession, requireRoles, requireSession } from "./auth.js";
import { getPrisma } from "./prisma.js";
import { isTicketTransitionAllowed, resolutionGateFailures } from "./lab4-ticket-rules.js";

const router = Router();
const operationalRoles = ["IT_STAFF", "ADMINISTRATOR"] as const;
const middleware = [requireSession, requireNormalSession, requireRoles(...operationalRoles), requireCsrf] as const;
const ownerSelect = { id: true, name: true, email: true, role: true, isActive: true } as const;
type LockedTicket = { id: number; currentStatus: TicketStatus; ownerId: number | null; workflowVersion: number };

class WorkflowFailure extends Error {
  constructor(readonly status: number, readonly code: string, message: string, readonly fields?: Record<string, string>) { super(message); }
}

function positiveInteger(value: unknown): number | null {
  if (typeof value === "number") return Number.isSafeInteger(value) && value > 0 && value <= 2147483647 ? value : null;
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 && number <= 2147483647 ? number : null;
}

function validation(fields: Record<string, string>): WorkflowFailure {
  return new WorkflowFailure(400, "VALIDATION_ERROR", "Check the highlighted values and try again.", fields);
}

function parseInput(req: Request, allowed: readonly string[]): { ticketId: number; actorId: number; version: number; body: Record<string, unknown> } {
  const ticketId = positiveInteger(req.params.ticketId);
  if (!ticketId) throw new WorkflowFailure(404, "NOT_FOUND", "Ticket not found");
  const auth = (req as AuthenticatedRequest).auth;
  if (!auth) throw new WorkflowFailure(401, "UNAUTHENTICATED", "Authentication is required");
  const body = req.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) throw validation({ body: "A JSON object is required" });
  const unknown = Object.keys(body).filter((key) => !allowed.includes(key));
  if (unknown.length) throw validation(Object.fromEntries(unknown.map((key) => [key, "This field is not accepted"])));
  const version = positiveInteger(body.expectedTicketVersion);
  if (!version) throw validation({ expectedTicketVersion: "A positive expected Ticket workflow version is required" });
  return { ticketId, actorId: auth.user.id, version, body };
}

function failure(res: Response, error: unknown, operation: string) {
  if (error instanceof WorkflowFailure) return res.status(error.status).json(errorBody(error.code, error.message, error.fields));
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
    return res.status(409).json(errorBody("WRITE_CONFLICT", "Concurrent update conflicted; reload and retry"));
  }
  const correlationId = randomUUID();
  console.error(`[${correlationId}] Lab 4 Ticket workflow ${operation} failed`);
  return res.status(500).json(errorBody("INTERNAL_ERROR", "Unable to update the Ticket", undefined, correlationId));
}

async function lockTicket(tx: Prisma.TransactionClient, ticketId: number): Promise<LockedTicket> {
  const rows = await tx.$queryRaw<LockedTicket[]>(Prisma.sql`
    SELECT "id", "currentStatus", "ownerId", "workflowVersion"
    FROM "Ticket" WHERE "id" = ${ticketId} FOR UPDATE
  `);
  if (!rows[0]) throw new WorkflowFailure(404, "NOT_FOUND", "Ticket not found");
  return rows[0];
}

async function lockActiveOperationalUser(tx: Prisma.TransactionClient, userId: number): Promise<boolean> {
  const rows = await tx.$queryRaw<Array<{ id: number }>>(Prisma.sql`
    SELECT "id" FROM "User" WHERE "id" = ${userId}
      AND "isActive" = true AND "role" IN ('IT_STAFF', 'ADMINISTRATOR') FOR SHARE
  `);
  return rows.length > 0;
}

async function authorizeAndCheckVersion(tx: Prisma.TransactionClient, input: { ticketId: number; actorId: number; version: number }): Promise<LockedTicket> {
  // Same order as Action mutations: Ticket, actor, then owner/assignee.
  const ticket = await lockTicket(tx, input.ticketId);
  if (!await lockActiveOperationalUser(tx, input.actorId)) throw new WorkflowFailure(403, "FORBIDDEN", "An active operational account is required");
  if (ticket.workflowVersion !== input.version) throw new WorkflowFailure(409, "STALE_VERSION", "Ticket changed; reload before updating");
  return ticket;
}

router.post("/api/staff/tickets/:ticketId/claim", ...middleware, async (req: Request, res: Response) => {
  try {
    const input = parseInput(req, ["expectedTicketVersion"]);
    const data = await getPrisma().$transaction(async (tx) => {
      const ticket = await authorizeAndCheckVersion(tx, input);
      if (ticket.ownerId !== null) throw new WorkflowFailure(409, "CLAIM_CONFLICT", "Ticket is already owned");
      return tx.ticket.update({ where: { id: ticket.id }, data: { ownerId: input.actorId, workflowVersion: { increment: 1 } }, select: { owner: { select: ownerSelect }, workflowVersion: true } });
    });
    return res.status(200).json({ data });
  } catch (error) { return failure(res, error, "claim"); }
});

router.patch("/api/staff/tickets/:ticketId/assignment", ...middleware, async (req: Request, res: Response) => {
  try {
    const input = parseInput(req, ["expectedTicketVersion", "ownerId"]);
    if (!Object.prototype.hasOwnProperty.call(input.body, "ownerId")) throw validation({ ownerId: "ownerId is required" });
    const ownerId = input.body.ownerId === null ? null : positiveInteger(input.body.ownerId);
    if (input.body.ownerId !== null && !ownerId) throw validation({ ownerId: "Owner must be null or a positive User ID" });
    const data = await getPrisma().$transaction(async (tx) => {
      const ticket = await authorizeAndCheckVersion(tx, input);
      if (ticket.ownerId === null && ownerId !== null) throw new WorkflowFailure(409, "CLAIM_REQUIRED", "Use the claim endpoint for an unassigned Ticket");
      if (ownerId === null && ticket.currentStatus !== TicketStatus.NEW && ticket.currentStatus !== TicketStatus.OPEN) throw new WorkflowFailure(409, "OWNER_REQUIRED", "Tickets may only be unassigned while New or Open");
      if (ownerId !== null && !await lockActiveOperationalUser(tx, ownerId)) throw new WorkflowFailure(400, "INVALID_OWNER", "Owner must be an active IT Staff member or Administrator", { ownerId: "Select an active operational owner" });
      return tx.ticket.update({ where: { id: ticket.id }, data: { ownerId, workflowVersion: { increment: 1 } }, select: { owner: { select: ownerSelect }, workflowVersion: true } });
    });
    return res.status(200).json({ data });
  } catch (error) { return failure(res, error, "assignment"); }
});

router.patch("/api/staff/tickets/:ticketId/priority", ...middleware, async (req: Request, res: Response) => {
  try {
    const input = parseInput(req, ["expectedTicketVersion", "itPriority"]);
    const value = input.body.itPriority;
    if (typeof value !== "string" || !Object.values(ITPriority).includes(value as ITPriority)) throw validation({ itPriority: "IT Priority must be LOW, MEDIUM, HIGH, or URGENT" });
    const data = await getPrisma().$transaction(async (tx) => {
      const ticket = await authorizeAndCheckVersion(tx, input);
      return tx.ticket.update({ where: { id: ticket.id }, data: { itPriority: value as ITPriority, workflowVersion: { increment: 1 } }, select: { id: true, itPriority: true, workflowVersion: true } });
    });
    return res.status(200).json({ data });
  } catch (error) { return failure(res, error, "priority"); }
});

router.patch("/api/staff/tickets/:ticketId/status", ...middleware, async (req: Request, res: Response) => {
  try {
    const input = parseInput(req, ["expectedTicketVersion", "status", "confirmation", "reason"]);
    const status = input.body.status;
    const fields: Record<string, string> = {};
    if (typeof status !== "string" || !Object.values(TicketStatus).includes(status as TicketStatus)) fields.status = "Unsupported status";
    if (input.body.confirmation !== undefined && typeof input.body.confirmation !== "boolean") fields.confirmation = "Confirmation must be true or false";
    if (input.body.reason !== undefined && (typeof input.body.reason !== "string" || input.body.reason.trim().length > 2000)) fields.reason = "Reason must be text of at most 2,000 characters";
    if (Object.keys(fields).length) throw validation(fields);
    const nextStatus = status as TicketStatus;
    const reason = typeof input.body.reason === "string" ? input.body.reason.trim() : "";
    if ((nextStatus === TicketStatus.CANCELLED || nextStatus === TicketStatus.REOPENED) && !reason) fields.reason = "A reason is required for cancellation or reopening";
    if ((nextStatus === TicketStatus.CANCELLED || nextStatus === TicketStatus.CLOSED) && input.body.confirmation !== true) fields.confirmation = "Confirmation is required for cancellation or closure";
    if (Object.keys(fields).length) throw validation(fields);

    const data = await getPrisma().$transaction(async (tx) => {
      const ticket = await authorizeAndCheckVersion(tx, input);
      if (!isTicketTransitionAllowed(ticket.currentStatus, nextStatus)) throw new WorkflowFailure(409, "INVALID_TRANSITION", "Status transition is not allowed");
      let ownerActive = false;
      if ((nextStatus === TicketStatus.IN_PROGRESS || nextStatus === TicketStatus.RESOLVED || nextStatus === TicketStatus.CLOSED) && ticket.ownerId !== null) {
        ownerActive = await lockActiveOperationalUser(tx, ticket.ownerId);
      }
      if ((nextStatus === TicketStatus.IN_PROGRESS || nextStatus === TicketStatus.CLOSED) && !ownerActive) throw validation({ ownerId: "An active operational owner is required" });
      if (nextStatus === TicketStatus.RESOLVED) {
        const [completed] = await tx.$queryRaw<Array<{ exists: boolean }>>(Prisma.sql`
          SELECT EXISTS (SELECT 1 FROM "ActionTaken" WHERE "ticketId" = ${ticket.id}
            AND "status" = 'COMPLETED' AND NULLIF(BTRIM("result"), '') IS NOT NULL) AS "exists"
        `);
        const activeActions = await tx.actionTaken.count({ where: { ticketId: ticket.id, status: { in: [ActionStatus.PLANNED, ActionStatus.IN_PROGRESS] } } });
        const failures = resolutionGateFailures({ ownerIsActiveOperational: ownerActive, completedActionsWithResult: completed?.exists ? 1 : 0, activeActions });
        if (Object.keys(failures).length) throw new WorkflowFailure(422, "RESOLUTION_GATE_FAILED", "Ticket cannot be resolved until all prerequisites are satisfied", failures);
      }
      const result = await tx.ticket.update({
        where: { id: ticket.id },
        data: { currentStatus: nextStatus, workflowVersion: { increment: 1 }, ...(nextStatus === TicketStatus.RESOLVED ? { resolvedAt: new Date() } : {}), ...(nextStatus === TicketStatus.REOPENED ? { resolvedAt: null } : {}) },
        select: { id: true, currentStatus: true, workflowVersion: true, resolvedAt: true },
      });
      await tx.ticketWorkflowEvent.create({ data: { ticketId: ticket.id, actorId: input.actorId, previousStatus: ticket.currentStatus, currentStatus: nextStatus, reason: reason || null, confirmation: typeof input.body.confirmation === "boolean" ? input.body.confirmation : null } });
      return result;
    });
    return res.status(200).json({ data });
  } catch (error) { return failure(res, error, "status transition"); }
});

export { router as lab4TicketWorkflowRouter };
