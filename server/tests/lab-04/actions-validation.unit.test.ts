import express, { type NextFunction, type Request, type Response } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fixtures = vi.hoisted(() => ({ getPrisma: vi.fn<() => unknown>() }));

vi.mock("../../src/auth.js", () => {
  const authorize = (req: Request, _res: Response, next: NextFunction) => {
    (req as Request & { auth: unknown }).auth = { user: { id: 1, role: "IT_STAFF" } };
    next();
  };
  const pass = (_req: Request, _res: Response, next: NextFunction) => next();
  return {
    errorBody: (code: string, message: string, fields?: Record<string, string>) => ({ error: { code, message, ...(fields ? { fields } : {}) } }),
    requireSession: authorize,
    requireNormalSession: pass,
    requireRoles: () => pass,
    requireCsrf: pass,
  };
});

vi.mock("../../src/prisma.js", () => ({
  getPrisma: fixtures.getPrisma,
}));

import { lab4ActionsRouter } from "../../src/lab4-actions.js";

const app = express();
app.use(express.json());
app.use(lab4ActionsRouter);

beforeEach(() => {
  fixtures.getPrisma.mockReset().mockImplementation(() => { throw new Error("Validation must not access the database"); });
});

describe("Lab 4 Action input validation without a database", () => {
  it.each([
    ["post", "/api/staff/tickets/1/actions"],
    ["patch", "/api/staff/tickets/1/actions/2"],
    ["patch", "/api/staff/tickets/1/actions/2/status"],
  ] as const)("rejects a non-object JSON body for %s %s", async (method, path) => {
    const response = await request(app)[method](path).set("Idempotency-Key", "test-key").send([]).timeout({ response: 500 });
    expect(response.status).toBe(400);
    expect(response.body.error).toMatchObject({ code: "VALIDATION_ERROR", fields: { body: expect.any(String) } });
  });

  it.each([
    ["followUpNote", 42],
    ["attachmentNotes", { path: "unexpected" }],
  ] as const)("rejects a non-string %s on creation", async (field, value) => {
    const response = await request(app).post("/api/staff/tickets/1/actions").set("Idempotency-Key", "test-key")
      .send({ expectedTicketVersion: 1, assigneeId: 1, description: "A valid action", [field]: value });
    expect(response.status).toBe(400);
    expect(response.body.error.fields[field]).toBeTruthy();
  });

  it.each([
    ["followUpNote", 42],
    ["attachmentNotes", { path: "unexpected" }],
  ] as const)("rejects a non-string %s on edit", async (field, value) => {
    const response = await request(app).patch("/api/staff/tickets/1/actions/2")
      .send({ expectedTicketVersion: 1, expectedActionVersion: 1, [field]: value });
    expect(response.status).toBe(400);
    expect(response.body.error.fields[field]).toBeTruthy();
  });

  it("rejects a follow-up note on creation when follow-up is disabled", async () => {
    const response = await request(app).post("/api/staff/tickets/1/actions").set("Idempotency-Key", "test-key")
      .send({ expectedTicketVersion: 1, assigneeId: 1, description: "A valid action", followUpRequired: false, followUpNote: "Unexpected note" });
    expect(response.status).toBe(400);
    expect(response.body.error.fields.followUpNote).toBeTruthy();
  });

  it.each(["post", "patch"] as const)("rejects a blank follow-up note consistently on %s", async (method) => {
    const path = method === "post" ? "/api/staff/tickets/1/actions" : "/api/staff/tickets/1/actions/2";
    const body = method === "post"
      ? { expectedTicketVersion: 1, assigneeId: 1, description: "A valid action", followUpNote: " " }
      : { expectedTicketVersion: 1, expectedActionVersion: 1, followUpNote: " " };
    const response = await request(app)[method](path).set("Idempotency-Key", "test-key").send(body);
    expect(response.status).toBe(400);
    expect(response.body.error.fields.followUpNote).toBeTruthy();
    expect(fixtures.getPrisma).not.toHaveBeenCalled();
  });

  it.each(["", "   "])("normalizes blank create attachment notes (%j) to null", async (attachmentNotes) => {
    const create = vi.fn().mockResolvedValue({ id: 2 });
    const tx = {
      $queryRaw: vi.fn().mockResolvedValueOnce([{ id: 1, requesterId: 1, workflowVersion: 1, currentStatus: "OPEN" }]).mockResolvedValueOnce([{ id: 1 }]).mockResolvedValueOnce([{ id: 1 }]),
      actionTaken: { findUnique: vi.fn().mockResolvedValue(null), create, findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 2, attachmentNotes: null }) },
      ticket: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      actionCreateReceipt: { create: vi.fn() },
    };
    fixtures.getPrisma.mockReturnValue({ $transaction: async (fn: (value: unknown) => Promise<unknown>) => fn(tx) });
    const response = await request(app).post("/api/staff/tickets/1/actions").set("Idempotency-Key", "test-key")
      .send({ expectedTicketVersion: 1, assigneeId: 1, description: "A valid action", attachmentNotes });
    expect(response.status).toBe(201);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ attachmentNotes: null }) }));
  });

  it.each(["/api/staff/tickets/1/actions/2", "/api/staff/tickets/1/actions/2/status"])("rejects adding a note when stored follow-up is disabled on %s", async (path) => {
    const update = vi.fn();
    const tx = {
      $queryRaw: vi.fn().mockResolvedValueOnce([{ id: 1, requesterId: 1, workflowVersion: 1, currentStatus: "OPEN" }]).mockResolvedValueOnce([{ id: 1 }]),
      actionTaken: { findFirst: vi.fn().mockResolvedValue({ id: 2, status: "PLANNED", version: 1, followUpRequired: false, followUpNote: null, assignee: { id: 1 } }), update },
    };
    fixtures.getPrisma.mockReturnValue({ $transaction: async (fn: (value: unknown) => Promise<unknown>) => fn(tx) });
    const statusFields = path.endsWith("/status") ? { status: "COMPLETED", result: "Done" } : {};
    const response = await request(app).patch(path).send({ expectedTicketVersion: 1, expectedActionVersion: 1, followUpNote: "Unexpected note", ...statusFields });
    expect(response.status).toBe(400);
    expect(response.body.error.fields.followUpNote).toBeTruthy();
    expect(update).not.toHaveBeenCalled();
  });

  it.each(["/api/staff/tickets/1/actions/2", "/api/staff/tickets/1/actions/2/status"])("does not silently erase an inconsistent legacy note on %s", async (path) => {
    const update = vi.fn();
    const tx = {
      $queryRaw: vi.fn().mockResolvedValueOnce([{ id: 1, requesterId: 1, workflowVersion: 1, currentStatus: "OPEN" }]).mockResolvedValueOnce([{ id: 1 }]),
      actionTaken: { findFirst: vi.fn().mockResolvedValue({ id: 2, status: "PLANNED", version: 1, description: "Original", followUpRequired: false, followUpNote: "Legacy note", assignee: { id: 1 } }), update },
    };
    fixtures.getPrisma.mockReturnValue({ $transaction: async (fn: (value: unknown) => Promise<unknown>) => fn(tx) });
    const changed = path.endsWith("/status") ? { status: "COMPLETED", result: "Done" } : { description: "New description" };
    const response = await request(app).patch(path).send({ expectedTicketVersion: 1, expectedActionVersion: 1, ...changed });
    expect(response.status).toBe(400);
    expect(response.body.error.fields.followUpNote).toBeTruthy();
    expect(update).not.toHaveBeenCalled();
  });
});

describe("Lab 4 pagination and idempotency without a database", () => {
  it("allows an owned Action list past page 100 with a bounded page size", async () => {
    const findMany = vi.fn().mockResolvedValue([{ id: 1001 }]);
    const tx = {
      ticket: { findFirst: vi.fn().mockResolvedValue({ id: 1 }) },
      actionTaken: { count: vi.fn().mockResolvedValue(1001), findMany },
    };
    const transaction = vi.fn(async (fn: (value: unknown) => Promise<unknown>) => fn(tx));
    fixtures.getPrisma.mockReturnValue({ $transaction: transaction });
    const response = await request(app).get("/api/tickets/1/actions?page=101&pageSize=10");
    expect(response.status).toBe(200);
    expect(response.body.meta).toMatchObject({ page: 101, pageSize: 10, totalItems: 1001, hasNextPage: false });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 1000, take: 10, where: { ticketId: 1 } }));
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ select: expect.objectContaining({ assignee: { select: { id: true, name: true } }, performedBy: { select: { id: true, name: true } } }) }));
    expect(transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "RepeatableRead" });
  });

  it("bounds invalid large offsets for both list and history", async () => {
    const list = await request(app).get("/api/tickets/1/actions?page=214748367&pageSize=10");
    expect(list.status).toBe(400);
    const history = await request(app).get("/api/staff/tickets/1/history?page=900719925474101&pageSize=10");
    expect(history.status).toBe(400);
    expect(fixtures.getPrisma).not.toHaveBeenCalled();
  });

  it("uses a bounded database query for history beyond page 100 and a uniform shape", async () => {
    const query = vi.fn().mockResolvedValue([{ eventId: 2, source: "ACTION", actionId: 9, kind: "CREATED", fromStatus: null, toStatus: "PLANNED", fieldName: null, oldValue: null, newValue: null, reason: null, confirmation: null, createdAt: new Date("2026-01-01T00:00:00Z"), actorId: 1, actorName: "Staff", actorRole: "IT_STAFF" }]);
    const tx = { ticket: { findUnique: vi.fn().mockResolvedValue({ id: 1 }) }, actionTakenEvent: { count: vi.fn().mockResolvedValue(1001) }, ticketWorkflowEvent: { count: vi.fn().mockResolvedValue(0) }, $queryRaw: query };
    fixtures.getPrisma.mockReturnValue({ $transaction: async (fn: (value: unknown) => Promise<unknown>) => fn(tx) });
    const response = await request(app).get("/api/staff/tickets/1/history?page=101&pageSize=10");
    expect(response.status).toBe(200);
    expect(response.body.meta).toMatchObject({ page: 101, totalItems: 1001 });
    expect(response.body.data[0]).toMatchObject({ id: "action:2", source: "ACTION", confirmation: null, actor: { id: 1 } });
    expect(query).toHaveBeenCalledOnce();
    const sql = query.mock.calls[0][0] as { strings: string[]; values: unknown[] };
    expect(sql.strings.join(" ")).toContain("UNION ALL");
    expect(sql.values).toEqual([1, 1, 10, 1000]);
  });

  it("returns the persisted original receipt without rewriting an Action on retry", async () => {
    const { createHash } = await import("node:crypto");
    const fingerprint = createHash("sha256").update(JSON.stringify({ assigneeId: 1, description: "Original", followUpRequired: false, followUpNote: null, attachmentNotes: null })).digest("hex");
    const original = { data: { id: 2, description: "Original", version: 1 }, meta: { ticketVersion: 2 } };
    const create = vi.fn();
    const tx = {
      $queryRaw: vi.fn().mockResolvedValueOnce([{ id: 1, requesterId: 1, workflowVersion: 4, currentStatus: "OPEN" }]).mockResolvedValueOnce([{ id: 1 }]),
      actionTaken: { findUnique: vi.fn().mockResolvedValue({ id: 2, requestFingerprint: fingerprint, createReceipt: { response: original } }), create },
    };
    fixtures.getPrisma.mockReturnValue({ $transaction: async (fn: (value: unknown) => Promise<unknown>) => fn(tx) });
    const response = await request(app).post("/api/staff/tickets/1/actions").set("Idempotency-Key", "existing")
      .send({ expectedTicketVersion: 1, assigneeId: 1, description: "Original" });
    expect(response.status).toBe(200);
    expect(response.body).toEqual(original);
    expect(create).not.toHaveBeenCalled();
  });

  it("fails closed when a matching historical Action lacks a receipt", async () => {
    const { createHash } = await import("node:crypto");
    const fingerprint = createHash("sha256").update(JSON.stringify({ assigneeId: 1, description: "Original", followUpRequired: false, followUpNote: null, attachmentNotes: null })).digest("hex");
    const tx = {
      $queryRaw: vi.fn().mockResolvedValueOnce([{ id: 1, requesterId: 1, workflowVersion: 4, currentStatus: "OPEN" }]).mockResolvedValueOnce([{ id: 1 }]),
      actionTaken: { findUnique: vi.fn().mockResolvedValue({ id: 2, requestFingerprint: fingerprint, createReceipt: null }) },
    };
    fixtures.getPrisma.mockReturnValue({ $transaction: async (fn: (value: unknown) => Promise<unknown>) => fn(tx) });
    const response = await request(app).post("/api/staff/tickets/1/actions").set("Idempotency-Key", "existing")
      .send({ expectedTicketVersion: 1, assigneeId: 1, description: "Original" });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("IDEMPOTENCY_RECEIPT_UNAVAILABLE");
  });
});
