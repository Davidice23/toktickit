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
    errorBody: (code: string, message: string, fields?: Record<string, string>, correlationId?: string) => ({ error: { code, message, ...(fields ? { fields } : {}), ...(correlationId ? { correlationId } : {}) } }),
    requireSession: authorize, requireNormalSession: pass, requireRoles: () => pass, requireCsrf: pass,
  };
});
vi.mock("../../src/prisma.js", () => ({ getPrisma: fixtures.getPrisma }));

import { lab4TicketWorkflowRouter } from "../../src/lab4-ticket-workflow.js";
const app = express();
app.use(express.json());
app.use(lab4TicketWorkflowRouter);

function transactionFixture(status: string, version: number, ownerId: number | null = 1, completed = false, activeActions = 0) {
  const locks = vi.fn().mockResolvedValueOnce([{ id: 4, currentStatus: status, ownerId, workflowVersion: version }]).mockResolvedValueOnce([{ id: 1 }]);
  if (ownerId !== null) locks.mockResolvedValueOnce([{ id: ownerId }]);
  locks.mockResolvedValueOnce([{ exists: completed }]);
  const update = vi.fn().mockResolvedValue({ id: 4, currentStatus: "RESOLVED", workflowVersion: version + 1, resolvedAt: "2026-10-31T00:00:00.000Z" });
  const event = vi.fn().mockResolvedValue({ id: 1 });
  const tx = { $queryRaw: locks, ticket: { update }, ticketWorkflowEvent: { create: event }, actionTaken: { count: vi.fn().mockResolvedValue(activeActions) } };
  fixtures.getPrisma.mockReturnValue({ $transaction: async (fn: (value: unknown) => Promise<unknown>) => fn(tx) });
  return { update, event, locks };
}

beforeEach(() => fixtures.getPrisma.mockReset());

describe("Lab 4 Ticket workflow HTTP boundary (mocked database)", () => {
  it("requires an expected workflow version before touching the database", async () => {
    const response = await request(app).patch("/api/staff/tickets/4/status").send({ status: "OPEN" });
    expect(response.status).toBe(400);
    expect(response.body.error.fields.expectedTicketVersion).toBeTruthy();
    expect(fixtures.getPrisma).not.toHaveBeenCalled();
  });

  it("rejects a stale version without changing Ticket or history", async () => {
    const { update, event } = transactionFixture("NEW", 2);
    const response = await request(app).patch("/api/staff/tickets/4/status").send({ status: "OPEN", expectedTicketVersion: 1 });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("STALE_VERSION");
    expect(update).not.toHaveBeenCalled();
    expect(event).not.toHaveBeenCalled();
  });

  it("rejects resolution without a completed Action or with active Actions", async () => {
    const { update, event } = transactionFixture("IN_PROGRESS", 1, 1, false, 1);
    const response = await request(app).patch("/api/staff/tickets/4/status").send({ status: "RESOLVED", expectedTicketVersion: 1 });
    expect(response.status).toBe(422);
    expect(response.body.error).toMatchObject({ code: "RESOLUTION_GATE_FAILED", fields: { completedAction: expect.any(String), activeActions: expect.any(String) } });
    expect(update).not.toHaveBeenCalled();
    expect(event).not.toHaveBeenCalled();
  });

  it("resolves with the required Action and owner without a requester advisory", async () => {
    const { update, event } = transactionFixture("IN_PROGRESS", 1, 1, true, 0);
    const response = await request(app).patch("/api/staff/tickets/4/status").send({ status: "RESOLVED", expectedTicketVersion: 1 });
    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ currentStatus: "RESOLVED", workflowVersion: { increment: 1 }, resolvedAt: expect.any(Date) }) }));
    expect(event).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ ticketId: 4, actorId: 1, previousStatus: "IN_PROGRESS", currentStatus: "RESOLVED" }) }));
  });

  it("rejects prohibited transitions even when the request bypasses the UI", async () => {
    const { update, event } = transactionFixture("NEW", 1);
    const response = await request(app).patch("/api/staff/tickets/4/status").send({ status: "CLOSED", expectedTicketVersion: 1, confirmation: true });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("INVALID_TRANSITION");
    expect(update).not.toHaveBeenCalled();
    expect(event).not.toHaveBeenCalled();
  });
});
