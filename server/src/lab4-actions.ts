import { ActionStatus, Prisma, TicketStatus } from "@prisma/client";
import { createHash, randomUUID } from "node:crypto";
import { Router, type Request, type Response } from "express";
import {
  AuthenticatedRequest,
  errorBody,
  requireCsrf,
  requireNormalSession,
  requireRoles,
  requireSession,
} from "./auth.js";
import { getPrisma } from "./prisma.js";

const router = Router();
const operationalRoles = ["IT_STAFF", "ADMINISTRATOR"] as const;
const actionSelect = {
  id: true,
  ticketId: true,
  status: true,
  description: true,
  result: true,
  followUpRequired: true,
  followUpNote: true,
  attachmentNotes: true,
  actionAt: true,
  cancelledAt: true,
  cancellationReason: true,
  version: true,
  createdAt: true,
  updatedAt: true,
  assignee: { select: { id: true, name: true, role: true, isActive: true } },
  performedBy: { select: { id: true, name: true, role: true, isActive: true } },
} satisfies Prisma.ActionTakenSelect;

// Requesters need names for shared work, not internal account role/activity.
const requesterActionSelect = {
  ...actionSelect,
  assignee: { select: { id: true, name: true } },
  performedBy: { select: { id: true, name: true } },
} satisfies Prisma.ActionTakenSelect;

type SafeAction = Prisma.ActionTakenGetPayload<{ select: typeof actionSelect }>;
type LockedTicket = {
  id: number;
  requesterId: number;
  workflowVersion: number;
  currentStatus: TicketStatus;
};
type NullableJson = Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;

class ApiFailure extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
  }
}

function bodyRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function positiveInteger(value: unknown): number | null {
  if (typeof value === "number") return Number.isSafeInteger(value) && value > 0 ? value : null;
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function trimmed(value: unknown): string | null {
  return typeof value === "string" ? value.trim() : null;
}

function validation(fields: Record<string, string>): ApiFailure {
  return new ApiFailure(400, "VALIDATION_ERROR", "Check the highlighted values and try again.", fields);
}

function rejectUnknownFields(body: Record<string, unknown>, allowed: readonly string[]) {
  const unsupported = Object.keys(body).filter((key) => !allowed.includes(key));
  if (unsupported.length) throw validation(Object.fromEntries(unsupported.map((key) => [key, "This field is not accepted"])));
}

function correlationId() {
  return randomUUID();
}

function sendFailure(res: Response, error: unknown, operation: string) {
  if (error instanceof ApiFailure) {
    return res.status(error.status).json(errorBody(error.code, error.message, error.fields));
  }
  const id = correlationId();
  console.error(`[${id}] Lab 4 Action API ${operation} failed`);
  return res.status(500).json(errorBody("INTERNAL_ERROR", "Unable to complete the Action request", undefined, id));
}

async function lockTicket(tx: Prisma.TransactionClient, ticketId: number): Promise<LockedTicket | null> {
  const rows = await tx.$queryRaw<LockedTicket[]>(Prisma.sql`
    SELECT "id", "requesterId", "workflowVersion", "currentStatus"
    FROM "Ticket"
    WHERE "id" = ${ticketId}
    FOR UPDATE
  `);
  return rows[0] ?? null;
}

async function lockActiveOperationalUser(tx: Prisma.TransactionClient, userId: number): Promise<boolean> {
  const actors = await tx.$queryRaw<Array<{ id: number }>>(Prisma.sql`
    SELECT "id" FROM "User"
    WHERE "id" = ${userId}
      AND "isActive" = true
      AND "role" IN ('IT_STAFF', 'ADMINISTRATOR')
    FOR SHARE
  `);
  return actors.length > 0;
}

async function lockOperationalActor(tx: Prisma.TransactionClient, actorId: number): Promise<void> {
  const actors = await lockActiveOperationalUser(tx, actorId);
  if (!actors) throw new ApiFailure(403, "FORBIDDEN", "An active operational account is required");
}

function ticketBlocksActionWrites(status: TicketStatus): boolean {
  return status === TicketStatus.RESOLVED || status === TicketStatus.CLOSED || status === TicketStatus.CANCELLED;
}

function requireExpectedTicketVersion(body: Record<string, unknown>): number {
  const version = positiveInteger(body.expectedTicketVersion);
  if (!version) throw validation({ expectedTicketVersion: "A positive expected Ticket workflow version is required" });
  return version;
}

function parsePagination(req: Request, history = false) {
  const unknown = Object.keys(req.query).filter((key) => key !== "page" && key !== "pageSize");
  if (unknown.length) throw validation({ query: "Only page and pageSize query parameters are supported" });
  const page = req.query.page === undefined ? 1 : positiveInteger(req.query.page);
  const pageSize = req.query.pageSize === undefined ? 20 : positiveInteger(req.query.pageSize);
  const fields: Record<string, string> = {};
  if (!page) fields.page = "Page must be a positive integer";
  if (!pageSize || ![10, 20, 50].includes(pageSize)) fields.pageSize = "Page size must be 10, 20, or 50";
  // Prisma skip is signed 32-bit; the parameterized history SQL uses bigint
  // offsets and must remain exactly representable as a JavaScript integer.
  const maximumOffset = history ? Number.MAX_SAFE_INTEGER : 2147483647;
  if (page && pageSize && page > Math.floor(maximumOffset / pageSize) + 1) fields.page = "Page exceeds the supported offset range";
  if (Object.keys(fields).length) throw validation(fields);
  return { page: page as number, pageSize: pageSize as number };
}

function pageMeta(page: number, pageSize: number, totalItems: number) {
  const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize);
  return { page, pageSize, totalItems, totalPages, hasPreviousPage: page > 1, hasNextPage: page < totalPages };
}

function ensureTicketVersion(actual: number, expected: number) {
  if (actual !== expected) throw new ApiFailure(409, "STALE_VERSION", "Ticket changed; reload before updating");
}

function ensureWritableTicket(ticket: LockedTicket) {
  if (ticketBlocksActionWrites(ticket.currentStatus)) {
    throw new ApiFailure(409, "TICKET_TERMINAL", "Reopen the Ticket before changing its Actions");
  }
}

async function bumpTicketVersion(tx: Prisma.TransactionClient, ticketId: number, currentVersion: number) {
  const changed = await tx.ticket.updateMany({
    where: { id: ticketId, workflowVersion: currentVersion },
    data: { workflowVersion: { increment: 1 } },
  });
  if (changed.count !== 1) throw new ApiFailure(409, "STALE_VERSION", "Ticket changed; reload before updating");
  return currentVersion + 1;
}

function fingerprint(value: Record<string, unknown>): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function jsonValue(value: string | number | boolean | null): NullableJson {
  return value === null ? Prisma.JsonNull : value;
}

async function safeAction(tx: Prisma.TransactionClient, id: number): Promise<SafeAction> {
  return tx.actionTaken.findUniqueOrThrow({ where: { id }, select: actionSelect });
}

function versionMeta(ticketVersion: number) {
  return { ticketVersion };
}

router.get("/api/tickets/:ticketId/actions", requireSession, requireNormalSession, requireRoles("REQUESTER"), async (req: Request, res: Response) => {
  const ticketId = positiveInteger(req.params.ticketId);
  const auth = (req as AuthenticatedRequest).auth;
  if (!ticketId || !auth) return res.status(404).json(errorBody("TICKET_NOT_FOUND", "Ticket not found"));
  try {
    const { page, pageSize } = parsePagination(req);
    const { totalItems, data } = await getPrisma().$transaction(async (tx) => {
      const ticket = await tx.ticket.findFirst({ where: { id: ticketId, requesterId: auth.user.id }, select: { id: true } });
      if (!ticket) throw new ApiFailure(404, "TICKET_NOT_FOUND", "Ticket not found");
      const [totalItems, data] = await Promise.all([
        tx.actionTaken.count({ where: { ticketId } }),
        tx.actionTaken.findMany({ where: { ticketId }, select: requesterActionSelect, orderBy: [{ createdAt: "asc" }, { id: "asc" }], skip: (page - 1) * pageSize, take: pageSize }),
      ]);
      return { totalItems, data };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
    return res.status(200).json({ data, meta: pageMeta(page, pageSize, totalItems) });
  } catch (error) {
    return sendFailure(res, error, "requester list");
  }
});

router.get("/api/staff/operational-users", requireSession, requireNormalSession, requireRoles(...operationalRoles), async (req: Request, res: Response) => {
  const unknown = Object.keys(req.query).filter((key) => !["search", "page", "pageSize"].includes(key));
  const fields: Record<string, string> = {};
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  if (unknown.length) fields.query = "Only search, page, and pageSize are supported";
  if (req.query.search !== undefined && typeof req.query.search !== "string") fields.search = "Search must be text";
  if (search.length > 120) fields.search = "Search must contain at most 120 characters";
  const page = req.query.page === undefined ? 1 : positiveInteger(req.query.page);
  const pageSize = req.query.pageSize === undefined ? 20 : positiveInteger(req.query.pageSize);
  if (!page) fields.page = "Page must be a positive integer";
  if (!pageSize || ![10, 20, 50].includes(pageSize)) fields.pageSize = "Page size must be 10, 20, or 50";
  if (page && pageSize && page > Math.floor(2147483647 / pageSize) + 1) fields.page = "Page exceeds the supported offset range";
  if (Object.keys(fields).length) return res.status(400).json(errorBody("VALIDATION_ERROR", "Check the highlighted values and try again.", fields));

  const validPage = page as number;
  const validPageSize = pageSize as number;
  const where: Prisma.RequesterUserWhereInput = {
    isActive: true,
    role: { in: [...operationalRoles] },
    ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
  };
  try {
    const prisma = getPrisma();
    const [totalItems, data] = await Promise.all([
      prisma.requesterUser.count({ where }),
      prisma.requesterUser.findMany({
        where,
        orderBy: [{ name: "asc" }, { id: "asc" }],
        skip: (validPage - 1) * validPageSize,
        take: validPageSize,
        select: { id: true, name: true, role: true },
      }),
    ]);
    return res.status(200).json({ data, meta: pageMeta(validPage, validPageSize, totalItems) });
  } catch (error) {
    return sendFailure(res, error, "operational user directory");
  }
});

router.get("/api/staff/tickets/:ticketId/actions", requireSession, requireNormalSession, requireRoles(...operationalRoles), async (req: Request, res: Response) => {
  const ticketId = positiveInteger(req.params.ticketId);
  if (!ticketId) return res.status(404).json(errorBody("TICKET_NOT_FOUND", "Ticket not found"));
  try {
    const { page, pageSize } = parsePagination(req);
    const { totalItems, data } = await getPrisma().$transaction(async (tx) => {
      const ticket = await tx.ticket.findUnique({ where: { id: ticketId }, select: { id: true } });
      if (!ticket) throw new ApiFailure(404, "TICKET_NOT_FOUND", "Ticket not found");
      const [totalItems, data] = await Promise.all([
        tx.actionTaken.count({ where: { ticketId } }),
        tx.actionTaken.findMany({ where: { ticketId }, select: actionSelect, orderBy: [{ createdAt: "asc" }, { id: "asc" }], skip: (page - 1) * pageSize, take: pageSize }),
      ]);
      return { totalItems, data };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
    return res.status(200).json({ data, meta: pageMeta(page, pageSize, totalItems) });
  } catch (error) {
    return sendFailure(res, error, "staff list");
  }
});

router.get("/api/staff/tickets/:ticketId/history", requireSession, requireNormalSession, requireRoles(...operationalRoles), async (req: Request, res: Response) => {
  const ticketId = positiveInteger(req.params.ticketId);
  if (!ticketId) return res.status(404).json(errorBody("TICKET_NOT_FOUND", "Ticket not found"));
  try {
    const { page, pageSize } = parsePagination(req, true);
    type HistoryRow = {
      eventId: number; source: "ACTION" | "TICKET"; actionId: number | null; kind: string;
      fromStatus: string | null; toStatus: string | null; fieldName: string | null;
      oldValue: Prisma.JsonValue | null; newValue: Prisma.JsonValue | null; reason: string | null;
      confirmation: boolean | null; createdAt: Date; actorId: number; actorName: string; actorRole: string;
    };
    const { totalItems, rows } = await getPrisma().$transaction(async (tx) => {
      const ticket = await tx.ticket.findUnique({ where: { id: ticketId }, select: { id: true } });
      if (!ticket) throw new ApiFailure(404, "TICKET_NOT_FOUND", "Ticket not found");
      const [actionCount, workflowCount] = await Promise.all([
        tx.actionTakenEvent.count({ where: { action: { ticketId } } }),
        tx.ticketWorkflowEvent.count({ where: { ticketId } }),
      ]);
      // Query the merged page in PostgreSQL, rather than fetching all previous
      // pages into application memory. All values are parameterized.
      const rows = await tx.$queryRaw<HistoryRow[]>(Prisma.sql`
        WITH event_rows AS (
          SELECT e."id" AS "eventId", 0 AS "sourceRank", 'ACTION'::text AS "source",
            e."actionId", e."kind"::text AS "kind", e."fromStatus"::text AS "fromStatus",
            e."toStatus"::text AS "toStatus", e."fieldName", e."oldValue", e."newValue",
            e."reason", NULL::boolean AS "confirmation", e."createdAt",
            u."id" AS "actorId", u."name" AS "actorName", u."role"::text AS "actorRole"
          FROM "ActionTakenEvent" e
          JOIN "ActionTaken" a ON a."id" = e."actionId"
          JOIN "User" u ON u."id" = e."actorId"
          WHERE a."ticketId" = ${ticketId}
          UNION ALL
          SELECT w."id", 1, 'TICKET'::text, NULL::integer, 'STATUS_CHANGED'::text,
            w."previousStatus"::text, w."currentStatus"::text, NULL::text,
            NULL::jsonb, NULL::jsonb, w."reason", w."confirmation", w."createdAt",
            u."id", u."name", u."role"::text
          FROM "TicketWorkflowEvent" w
          JOIN "User" u ON u."id" = w."actorId"
          WHERE w."ticketId" = ${ticketId}
        )
        SELECT * FROM event_rows
        ORDER BY "createdAt" ASC, "sourceRank" ASC, "eventId" ASC
        LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
      `);
      return { totalItems: actionCount + workflowCount, rows };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
    const data = rows.map((row) => ({
      id: `${row.source === "ACTION" ? "action" : "ticket"}:${row.eventId}`,
      source: row.source, actionId: row.actionId, kind: row.kind,
      fromStatus: row.fromStatus, toStatus: row.toStatus, fieldName: row.fieldName,
      oldValue: row.oldValue, newValue: row.newValue, reason: row.reason,
      confirmation: row.confirmation, actor: { id: row.actorId, name: row.actorName, role: row.actorRole }, createdAt: row.createdAt,
    }));
    return res.status(200).json({ data, meta: pageMeta(page, pageSize, totalItems) });
  } catch (error) {
    return sendFailure(res, error, "history");
  }
});

router.post("/api/staff/tickets/:ticketId/actions", requireSession, requireNormalSession, requireRoles(...operationalRoles), requireCsrf, async (req: Request, res: Response) => {
  const ticketId = positiveInteger(req.params.ticketId);
  const auth = (req as AuthenticatedRequest).auth;
  const body = bodyRecord(req.body);
  if (!ticketId) return res.status(404).json(errorBody("TICKET_NOT_FOUND", "Ticket not found"));
  if (!auth) return res.status(401).json(errorBody("UNAUTHENTICATED", "Authentication is required"));
  if (!body) return sendFailure(res, validation({ body: "A JSON object is required" }), "create");

  try {
    rejectUnknownFields(body, ["expectedTicketVersion", "assigneeId", "description", "followUpRequired", "followUpNote", "attachmentNotes"]);
    const expectedTicketVersion = requireExpectedTicketVersion(body);
    const assigneeId = positiveInteger(body.assigneeId);
    const description = trimmed(body.description);
    const followUpRequired = body.followUpRequired === undefined ? false : body.followUpRequired;
    const followUpNote = body.followUpNote === undefined ? null : trimmed(body.followUpNote);
    const attachmentNotes = body.attachmentNotes === undefined || body.attachmentNotes === null ? null : trimmed(body.attachmentNotes);
    const fields: Record<string, string> = {};
    if (!assigneeId) fields.assigneeId = "An active operational assignee is required";
    if (!description || description.length > 2000) fields.description = "Description must contain 1-2,000 characters";
    if (typeof followUpRequired !== "boolean") fields.followUpRequired = "Follow-up required must be true or false";
    if (body.followUpNote !== undefined && body.followUpNote !== null && typeof body.followUpNote !== "string") fields.followUpNote = "Follow-up note must be text or null";
    else if (typeof body.followUpNote === "string" && !followUpNote) fields.followUpNote = "Follow-up note must not be blank";
    else if (followUpRequired === true && !followUpNote) fields.followUpNote = "A note is required when follow-up is selected";
    else if (followUpRequired === false && followUpNote) fields.followUpNote = "A follow-up note cannot be set when follow-up is turned off";
    if (followUpNote && followUpNote.length > 2000) fields.followUpNote = "Follow-up note must contain at most 2,000 characters";
    if (body.attachmentNotes !== undefined && body.attachmentNotes !== null && typeof body.attachmentNotes !== "string") fields.attachmentNotes = "Attachment notes must be text or null";
    else if (attachmentNotes !== null && attachmentNotes.length > 2000) fields.attachmentNotes = "Attachment notes must contain at most 2,000 characters";
    const idempotencyKey = trimmed(req.header("Idempotency-Key"));
    if (!idempotencyKey || idempotencyKey.length > 200) fields.idempotencyKey = "Idempotency-Key must contain 1-200 characters";
    if (Object.keys(fields).length) throw validation(fields);

    const normalized = {
      assigneeId: assigneeId as number,
      description: description as string,
      followUpRequired: followUpRequired as boolean,
      followUpNote: (followUpRequired ? followUpNote : null) as string | null,
      attachmentNotes: attachmentNotes || null,
    };
    const requestFingerprint = fingerprint(normalized);
    const result = await getPrisma().$transaction(async (tx) => {
      const ticket = await lockTicket(tx, ticketId);
      if (!ticket) throw new ApiFailure(404, "TICKET_NOT_FOUND", "Ticket not found");
      await lockOperationalActor(tx, auth.user.id);
      const prior = await tx.actionTaken.findUnique({
        where: { ticketId_createdById_idempotencyKey: { ticketId, createdById: auth.user.id, idempotencyKey: idempotencyKey as string } },
        select: { id: true, requestFingerprint: true, createReceipt: { select: { response: true } } },
      });
      if (prior) {
        if (prior.requestFingerprint !== requestFingerprint) throw new ApiFailure(409, "IDEMPOTENCY_KEY_REUSED", "This Idempotency-Key was already used for a different Action request");
        if (!prior.createReceipt) throw new ApiFailure(409, "IDEMPOTENCY_RECEIPT_UNAVAILABLE", "The original response for this historical Action is unavailable; do not retry with a new key without checking the existing Action");
        return { response: prior.createReceipt.response, replay: true };
      }
      ensureWritableTicket(ticket);
      ensureTicketVersion(ticket.workflowVersion, expectedTicketVersion);
      if (!await lockActiveOperationalUser(tx, assigneeId as number)) throw validation({ assigneeId: "Assignee must be an active IT Staff member or Administrator" });

      const action = await tx.actionTaken.create({
        data: {
          ticketId,
          assigneeId: assigneeId as number,
          createdById: auth.user.id,
          status: ActionStatus.PLANNED,
          description: normalized.description,
          followUpRequired: normalized.followUpRequired,
          followUpNote: normalized.followUpNote,
          attachmentNotes: normalized.attachmentNotes,
          idempotencyKey: idempotencyKey as string,
          requestFingerprint,
          events: { create: { actorId: auth.user.id, kind: "CREATED", toStatus: ActionStatus.PLANNED } },
        },
        select: { id: true },
      });
      const ticketVersion = await bumpTicketVersion(tx, ticketId, ticket.workflowVersion);
      // Persist the exact public JSON response in the same transaction. Dates
      // are converted to RFC 3339 strings just as Express would serialize them.
      const response = JSON.parse(JSON.stringify({ data: await safeAction(tx, action.id), meta: versionMeta(ticketVersion) })) as Prisma.InputJsonValue;
      await tx.actionCreateReceipt.create({ data: { actionId: action.id, response } });
      return { response, replay: false };
    });
    return res.status(result.replay ? 200 : 201).json(result.response);
  } catch (error) {
    return sendFailure(res, error, "create");
  }
});

router.patch("/api/staff/tickets/:ticketId/actions/:actionId", requireSession, requireNormalSession, requireRoles(...operationalRoles), requireCsrf, async (req: Request, res: Response) => {
  const ticketId = positiveInteger(req.params.ticketId);
  const actionId = positiveInteger(req.params.actionId);
  const auth = (req as AuthenticatedRequest).auth;
  const body = bodyRecord(req.body);
  if (!ticketId || !actionId) return res.status(404).json(errorBody("ACTION_NOT_FOUND", "Action not found"));
  if (!auth) return res.status(401).json(errorBody("UNAUTHENTICATED", "Authentication is required"));
  if (!body) return sendFailure(res, validation({ body: "A JSON object is required" }), "edit");

  try {
    rejectUnknownFields(body, ["expectedTicketVersion", "expectedActionVersion", "assigneeId", "description", "followUpRequired", "followUpNote", "attachmentNotes"]);
    const expectedTicketVersion = requireExpectedTicketVersion(body);
    const expectedActionVersion = positiveInteger(body.expectedActionVersion);
    const fields: Record<string, string> = {};
    if (!expectedActionVersion) fields.expectedActionVersion = "A positive expected Action version is required";
    const mutable = ["assigneeId", "description", "followUpRequired", "followUpNote", "attachmentNotes"];
    if (!mutable.some((key) => Object.prototype.hasOwnProperty.call(body, key))) fields.body = "At least one mutable Action field is required";

    const patch: { assigneeId?: number; description?: string; followUpRequired?: boolean; followUpNote?: string | null; attachmentNotes?: string | null } = {};
    if (Object.prototype.hasOwnProperty.call(body, "assigneeId")) {
      const assigneeId = positiveInteger(body.assigneeId);
      if (!assigneeId) fields.assigneeId = "Assignee must be a positive User ID";
      else patch.assigneeId = assigneeId;
    }
    if (Object.prototype.hasOwnProperty.call(body, "description")) {
      const description = trimmed(body.description);
      if (!description || description.length > 2000) fields.description = "Description must contain 1-2,000 characters";
      else patch.description = description;
    }
    if (Object.prototype.hasOwnProperty.call(body, "followUpRequired")) {
      if (typeof body.followUpRequired !== "boolean") fields.followUpRequired = "Follow-up required must be true or false";
      else patch.followUpRequired = body.followUpRequired;
    }
    if (Object.prototype.hasOwnProperty.call(body, "followUpNote")) {
      const note = body.followUpNote === null ? null : trimmed(body.followUpNote);
      if (body.followUpNote !== null && typeof body.followUpNote !== "string") fields.followUpNote = "Follow-up note must be text or null";
      else if (note !== null && (!note || note.length > 2000)) fields.followUpNote = "Follow-up note must contain 1-2,000 characters or be null";
      else patch.followUpNote = note;
    }
    if (Object.prototype.hasOwnProperty.call(body, "attachmentNotes")) {
      const notes = body.attachmentNotes === null ? null : trimmed(body.attachmentNotes);
      if (body.attachmentNotes !== null && typeof body.attachmentNotes !== "string") fields.attachmentNotes = "Attachment notes must be text or null";
      else if (notes !== null && notes.length > 2000) fields.attachmentNotes = "Attachment notes must contain at most 2,000 characters";
      else patch.attachmentNotes = notes || null;
    }
    if (Object.keys(fields).length) throw validation(fields);

    const result = await getPrisma().$transaction(async (tx) => {
      const ticket = await lockTicket(tx, ticketId);
      if (!ticket) throw new ApiFailure(404, "TICKET_NOT_FOUND", "Ticket not found");
      await lockOperationalActor(tx, auth.user.id);
      const action = await tx.actionTaken.findFirst({ where: { id: actionId, ticketId }, select: actionSelect });
      if (!action) throw new ApiFailure(404, "ACTION_NOT_FOUND", "Action not found");
      ensureWritableTicket(ticket);
      ensureTicketVersion(ticket.workflowVersion, expectedTicketVersion);
      if (action.version !== expectedActionVersion) throw new ApiFailure(409, "STALE_VERSION", "Action changed; reload before updating");
      if (action.status === ActionStatus.COMPLETED || action.status === ActionStatus.CANCELLED) throw new ApiFailure(409, "ACTION_TERMINAL", "A completed or cancelled Action cannot be edited");
      const updates: Prisma.ActionTakenUpdateInput = {};
      const eventChanges: Array<{ fieldName: string; oldValue: NullableJson; newValue: NullableJson; kind: "EDITED" | "ASSIGNED" }> = [];
      if (patch.description !== undefined && patch.description !== action.description) {
        updates.description = patch.description;
        eventChanges.push({ fieldName: "description", oldValue: action.description, newValue: patch.description, kind: "EDITED" });
      }
      if (patch.assigneeId !== undefined && patch.assigneeId !== action.assignee.id) {
        if (!await lockActiveOperationalUser(tx, patch.assigneeId)) throw validation({ assigneeId: "Assignee must be an active IT Staff member or Administrator" });
        updates.assignee = { connect: { id: patch.assigneeId } };
        eventChanges.push({ fieldName: "assigneeId", oldValue: action.assignee.id, newValue: patch.assigneeId, kind: "ASSIGNED" });
      }
      const nextFollowUpRequired = patch.followUpRequired ?? action.followUpRequired;
      if (!nextFollowUpRequired && patch.followUpNote) throw validation({ followUpNote: "A follow-up note cannot be set when follow-up is turned off" });
      const nextFollowUpNote = patch.followUpRequired === false
        ? null
        : patch.followUpNote === undefined ? action.followUpNote : patch.followUpNote;
      if (nextFollowUpRequired && !nextFollowUpNote) throw validation({ followUpNote: "A note is required when follow-up is selected" });
      if (!nextFollowUpRequired && nextFollowUpNote) throw validation({ followUpNote: "Clear the existing note explicitly or enable follow-up before updating" });
      if (nextFollowUpRequired !== action.followUpRequired) {
        updates.followUpRequired = nextFollowUpRequired;
        eventChanges.push({ fieldName: "followUpRequired", oldValue: action.followUpRequired, newValue: nextFollowUpRequired, kind: "EDITED" });
      }
      if (nextFollowUpNote !== action.followUpNote) {
        updates.followUpNote = nextFollowUpNote;
        eventChanges.push({ fieldName: "followUpNote", oldValue: jsonValue(action.followUpNote), newValue: jsonValue(nextFollowUpNote), kind: "EDITED" });
      }
      if (patch.attachmentNotes !== undefined && patch.attachmentNotes !== action.attachmentNotes) {
        updates.attachmentNotes = patch.attachmentNotes;
        eventChanges.push({ fieldName: "attachmentNotes", oldValue: jsonValue(action.attachmentNotes), newValue: jsonValue(patch.attachmentNotes), kind: "EDITED" });
      }
      if (eventChanges.length === 0) throw validation({ body: "No Action values changed" });

      await tx.actionTaken.update({ where: { id: actionId }, data: { ...updates, version: { increment: 1 } } });
      await tx.actionTakenEvent.createMany({
        data: eventChanges.map((change) => ({ actionId, actorId: auth.user.id, kind: change.kind, fieldName: change.fieldName, oldValue: change.oldValue, newValue: change.newValue })),
      });
      const ticketVersion = await bumpTicketVersion(tx, ticketId, ticket.workflowVersion);
      return { action: await safeAction(tx, actionId), ticketVersion };
    });
    return res.status(200).json({ data: result.action, meta: versionMeta(result.ticketVersion) });
  } catch (error) {
    return sendFailure(res, error, "edit");
  }
});

router.patch("/api/staff/tickets/:ticketId/actions/:actionId/status", requireSession, requireNormalSession, requireRoles(...operationalRoles), requireCsrf, async (req: Request, res: Response) => {
  const ticketId = positiveInteger(req.params.ticketId);
  const actionId = positiveInteger(req.params.actionId);
  const auth = (req as AuthenticatedRequest).auth;
  const body = bodyRecord(req.body);
  if (!ticketId || !actionId) return res.status(404).json(errorBody("ACTION_NOT_FOUND", "Action not found"));
  if (!auth) return res.status(401).json(errorBody("UNAUTHENTICATED", "Authentication is required"));
  if (!body) return sendFailure(res, validation({ body: "A JSON object is required" }), "status transition");

  try {
    rejectUnknownFields(body, ["expectedTicketVersion", "expectedActionVersion", "status", "result", "followUpRequired", "followUpNote", "cancellationReason"]);
    const expectedTicketVersion = requireExpectedTicketVersion(body);
    const expectedActionVersion = positiveInteger(body.expectedActionVersion);
    const nextStatus = body.status;
    const fields: Record<string, string> = {};
    if (!expectedActionVersion) fields.expectedActionVersion = "A positive expected Action version is required";
    if (typeof nextStatus !== "string" || !Object.values(ActionStatus).includes(nextStatus as ActionStatus)) fields.status = "Unsupported Action status";
    if (Object.keys(fields).length) throw validation(fields);
    const requestedStatus = nextStatus as ActionStatus;
    if (requestedStatus === ActionStatus.IN_PROGRESS) rejectUnknownFields(body, ["expectedTicketVersion", "expectedActionVersion", "status"]);
    if (requestedStatus === ActionStatus.COMPLETED) rejectUnknownFields(body, ["expectedTicketVersion", "expectedActionVersion", "status", "result", "followUpRequired", "followUpNote"]);
    if (requestedStatus === ActionStatus.CANCELLED) rejectUnknownFields(body, ["expectedTicketVersion", "expectedActionVersion", "status", "cancellationReason"]);
    const resultText = body.result === undefined ? null : trimmed(body.result);
    const cancellationReason = body.cancellationReason === undefined ? null : trimmed(body.cancellationReason);
    const followUpRequired = body.followUpRequired === undefined ? undefined : body.followUpRequired;
    const followUpNote = body.followUpNote === undefined ? undefined : trimmed(body.followUpNote);
    const validationFields: Record<string, string> = {};
    if (requestedStatus === ActionStatus.COMPLETED && (!resultText || resultText.length > 2000)) validationFields.result = "Result must contain 1-2,000 characters";
    if (requestedStatus === ActionStatus.CANCELLED && (!cancellationReason || cancellationReason.length > 1000)) validationFields.cancellationReason = "Cancellation reason must contain 1-1,000 characters";
    if (followUpRequired !== undefined && typeof followUpRequired !== "boolean") validationFields.followUpRequired = "Follow-up required must be true or false";
    if (body.followUpNote !== undefined && body.followUpNote !== null && (typeof body.followUpNote !== "string" || !followUpNote || followUpNote.length > 2000)) validationFields.followUpNote = "Follow-up note must contain 1-2,000 characters or be null";
    if (Object.keys(validationFields).length) throw validation(validationFields);

    const result = await getPrisma().$transaction(async (tx) => {
      const ticket = await lockTicket(tx, ticketId);
      if (!ticket) throw new ApiFailure(404, "TICKET_NOT_FOUND", "Ticket not found");
      await lockOperationalActor(tx, auth.user.id);
      const action = await tx.actionTaken.findFirst({ where: { id: actionId, ticketId }, select: actionSelect });
      if (!action) throw new ApiFailure(404, "ACTION_NOT_FOUND", "Action not found");
      ensureWritableTicket(ticket);
      ensureTicketVersion(ticket.workflowVersion, expectedTicketVersion);
      if (action.version !== expectedActionVersion) throw new ApiFailure(409, "STALE_VERSION", "Action changed; reload before updating");
      const allowed: Record<ActionStatus, ActionStatus[]> = {
        PLANNED: [ActionStatus.IN_PROGRESS, ActionStatus.COMPLETED, ActionStatus.CANCELLED],
        IN_PROGRESS: [ActionStatus.COMPLETED, ActionStatus.CANCELLED],
        COMPLETED: [],
        CANCELLED: [],
      };
      if (!allowed[action.status].includes(requestedStatus)) throw new ApiFailure(409, "INVALID_TRANSITION", "Action status transition is not allowed");

      const data: Prisma.ActionTakenUpdateInput = { status: requestedStatus, version: { increment: 1 } };
      const eventKind = requestedStatus === ActionStatus.COMPLETED ? "COMPLETED" : requestedStatus === ActionStatus.CANCELLED ? "CANCELLED" : "STATUS_CHANGED";
      if (requestedStatus === ActionStatus.COMPLETED) {
        const follow = followUpRequired ?? action.followUpRequired;
        const note = followUpNote === undefined ? (follow ? action.followUpNote : null) : followUpNote;
        if (follow && !note) throw validation({ followUpNote: "A note is required when follow-up is selected" });
        if (!follow && followUpNote) throw validation({ followUpNote: "A follow-up note cannot be set when follow-up is turned off" });
        if (!follow && action.followUpNote && followUpRequired !== false && followUpNote !== null) throw validation({ followUpNote: "Clear the existing note explicitly or enable follow-up before completing" });
        data.result = resultText as string;
        data.followUpRequired = follow;
        data.followUpNote = follow ? note : null;
        data.performedBy = { connect: { id: auth.user.id } };
        data.actionAt = new Date();
      } else if (requestedStatus === ActionStatus.CANCELLED) {
        data.cancellationReason = cancellationReason as string;
        data.cancelledAt = new Date();
      }

      await tx.actionTaken.update({ where: { id: actionId }, data });
      await tx.actionTakenEvent.create({
        data: {
          actionId,
          actorId: auth.user.id,
          kind: eventKind,
          fromStatus: action.status,
          toStatus: requestedStatus,
          ...(requestedStatus === ActionStatus.COMPLETED ? { reason: resultText as string } : {}),
          ...(requestedStatus === ActionStatus.CANCELLED ? { reason: cancellationReason as string } : {}),
        },
      });
      const ticketVersion = await bumpTicketVersion(tx, ticketId, ticket.workflowVersion);
      return { action: await safeAction(tx, actionId), ticketVersion };
    });
    return res.status(200).json({ data: result.action, meta: versionMeta(result.ticketVersion) });
  } catch (error) {
    return sendFailure(res, error, "status transition");
  }
});

export { router as lab4ActionsRouter };
