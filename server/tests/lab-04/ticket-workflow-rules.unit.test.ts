import { TicketStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { isTicketTransitionAllowed, resolutionGateFailures } from "../../src/lab4-ticket-rules.js";

const expected: Record<TicketStatus, readonly TicketStatus[]> = {
  NEW: ["OPEN", "CANCELLED"],
  OPEN: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "CANCELLED"],
  IN_PROGRESS: ["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  WAITING_FOR_REQUESTER: ["IN_PROGRESS", "RESOLVED", "CANCELLED"],
  RESOLVED: ["CLOSED", "REOPENED"],
  CLOSED: ["REOPENED"],
  REOPENED: ["IN_PROGRESS", "CANCELLED"],
  CANCELLED: ["REOPENED"],
};

describe("Lab 4 Ticket workflow rules", () => {
  it("matches every permitted and forbidden edge of the eight-status matrix", () => {
    for (const from of Object.values(TicketStatus)) {
      for (const to of Object.values(TicketStatus)) {
        expect(isTicketTransitionAllowed(from, to), `${from} -> ${to}`).toBe(expected[from].includes(to));
      }
    }
  });

  it("reports every missing resolution prerequisite", () => {
    expect(resolutionGateFailures({ ownerIsActiveOperational: false, completedActionsWithResult: 0, activeActions: 1 })).toEqual({
      ownerId: expect.any(String), completedAction: expect.any(String), activeActions: expect.any(String),
    });
  });

  it.each([
    [{ ownerIsActiveOperational: false, completedActionsWithResult: 1, activeActions: 0 }, "ownerId"],
    [{ ownerIsActiveOperational: true, completedActionsWithResult: 0, activeActions: 0 }, "completedAction"],
    [{ ownerIsActiveOperational: true, completedActionsWithResult: 1, activeActions: 1 }, "activeActions"],
  ] as const)("rejects each missing gate independently", (input, field) => {
    expect(Object.keys(resolutionGateFailures(input))).toEqual([field]);
  });

  it("passes when all three prerequisites hold, without a requester-advisory input", () => {
    expect(resolutionGateFailures({ ownerIsActiveOperational: true, completedActionsWithResult: 1, activeActions: 0 })).toEqual({});
  });
});
