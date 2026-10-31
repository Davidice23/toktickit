import { ActionStatus, Prisma, TicketStatus } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { Router, type Request, type Response } from "express";
import {
  AuthenticatedRequest,
  errorBody,
  requireNormalSession,
  requireRoles,
  requireSession,
} from "./auth.js";
import { getPrisma } from "./prisma.js";

export const lab4DashboardRouter = Router();

export const dashboardOpenStatuses = [
  TicketStatus.NEW,
  TicketStatus.OPEN,
  TicketStatus.IN_PROGRESS,
  TicketStatus.WAITING_FOR_REQUESTER,
  TicketStatus.REOPENED,
] as const;

const recentWindowMs = 14 * 24 * 60 * 60 * 1000;
const dashboardListLimit = 5;

export function dashboardWindowStart(asOf: Date): Date {
  return new Date(asOf.getTime() - recentWindowMs);
}

export function parseDashboardAsOf(value: unknown): Date | null {
  if (value === undefined) return new Date();
  if (typeof value !== "string") return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value ? null : parsed;
}

const requesterTicketRow = {
  id: true,
  ticketNumber: true,
  summary: true,
  currentStatus: true,
  requestedPriority: true,
  itPriority: true,
  createdAt: true,
  updatedAt: true,
  resolvedAt: true,
} satisfies Prisma.TicketSelect;

const staffTicketRow = {
  id: true,
  ticketNumber: true,
  summary: true,
  currentStatus: true,
  requestedPriority: true,
  itPriority: true,
  ownerId: true,
  createdAt: true,
  updatedAt: true,
  requester: { select: { id: true, name: true } },
  owner: { select: { id: true, name: true } },
} satisfies Prisma.TicketSelect;

const dashboardActionRow = {
  id: true,
  ticketId: true,
  status: true,
  description: true,
  actionAt: true,
  updatedAt: true,
  ticket: { select: { id: true, ticketNumber: true, summary: true } },
} satisfies Prisma.ActionTakenSelect;

function sendInternalError(res: Response, message: string, operation: string) {
  const correlationId = randomUUID();
  console.error(`[${correlationId}] Lab 4 dashboard ${operation} failed`);
  return res.status(500).json(errorBody("INTERNAL_ERROR", message, undefined, correlationId));
}

lab4DashboardRouter.get(
  "/api/dashboard/requester",
  requireSession,
  requireNormalSession,
  requireRoles("REQUESTER"),
  async (req: Request, res: Response) => {
    const requesterId = (req as AuthenticatedRequest).auth?.user.id;
    if (!requesterId) return res.status(401).json(errorBody("UNAUTHENTICATED", "Authentication is required"));

    const asOf = new Date();
    const start = dashboardWindowStart(asOf);
    const asOfQuery = encodeURIComponent(asOf.toISOString());
    const openWhere = { requesterId, currentStatus: { in: [...dashboardOpenStatuses] } } satisfies Prisma.TicketWhereInput;
    const attentionWhere = { requesterId, currentStatus: TicketStatus.WAITING_FOR_REQUESTER } satisfies Prisma.TicketWhereInput;
    const updatedWhere = { requesterId, updatedAt: { gte: start, lt: asOf } } satisfies Prisma.TicketWhereInput;
    const resolvedWhere = {
      requesterId,
      currentStatus: { in: [TicketStatus.RESOLVED, TicketStatus.CLOSED] },
      resolvedAt: { gte: start, lt: asOf },
    } satisfies Prisma.TicketWhereInput;

    try {
      const data = await getPrisma().$transaction(async (tx) => {
        const [openTickets, waitingForRequester, recentlyUpdated, recentlyResolved,
          attentionTickets, recentlyUpdatedTickets, recentlyResolvedTickets] = await Promise.all([
          tx.ticket.count({ where: openWhere }),
          tx.ticket.count({ where: attentionWhere }),
          tx.ticket.count({ where: updatedWhere }),
          tx.ticket.count({ where: resolvedWhere }),
          tx.ticket.findMany({ where: attentionWhere, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], take: dashboardListLimit, select: requesterTicketRow }),
          tx.ticket.findMany({ where: updatedWhere, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], take: dashboardListLimit, select: requesterTicketRow }),
          tx.ticket.findMany({ where: resolvedWhere, orderBy: [{ resolvedAt: "desc" }, { id: "desc" }], take: dashboardListLimit, select: requesterTicketRow }),
        ]);

        return {
          asOf: asOf.toISOString(),
          metrics: { openTickets, waitingForRequester, recentlyUpdated, recentlyResolved },
          attentionTickets,
          recentlyUpdatedTickets,
          recentlyResolvedTickets,
          drillDown: {
            openTickets: "/my-tickets?scope=open",
            waitingForRequester: "/my-tickets?status=WAITING_FOR_REQUESTER",
            recentlyUpdated: `/my-tickets?scope=recently-updated&asOf=${asOfQuery}`,
            recentlyResolved: `/my-tickets?scope=recently-resolved&asOf=${asOfQuery}`,
          },
        };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });

      return res.status(200).json({ data });
    } catch {
      return sendInternalError(res, "Unable to load Requester dashboard", "requester");
    }
  },
);

lab4DashboardRouter.get(
  "/api/dashboard/staff",
  requireSession,
  requireNormalSession,
  requireRoles("IT_STAFF", "ADMINISTRATOR"),
  async (req: Request, res: Response) => {
    const auth = (req as AuthenticatedRequest).auth;
    if (!auth) return res.status(401).json(errorBody("UNAUTHENTICATED", "Authentication is required"));

    const userId = auth.user.id;
    const asOf = new Date();
    const start = dashboardWindowStart(asOf);
    const asOfQuery = encodeURIComponent(asOf.toISOString());
    const open = { in: [...dashboardOpenStatuses] };
    const urgent = {
      OR: [
        { itPriority: "URGENT" as const },
        { itPriority: null, requestedPriority: "URGENT" as const },
      ],
    } satisfies Prisma.TicketWhereInput;
    const activeActionWhere = { assigneeId: userId, status: { in: [ActionStatus.PLANNED, ActionStatus.IN_PROGRESS] } } satisfies Prisma.ActionTakenWhereInput;
    const completedActionWhere = {
      performedById: userId,
      status: ActionStatus.COMPLETED,
      actionAt: { gte: start, lt: asOf },
    } satisfies Prisma.ActionTakenWhereInput;
    const urgentOpenWhere = { currentStatus: open, ...urgent } satisfies Prisma.TicketWhereInput;
    const unassignedOpenWhere = { currentStatus: open, ownerId: null } satisfies Prisma.TicketWhereInput;
    const myOwnedOpenWhere = { currentStatus: open, ownerId: userId } satisfies Prisma.TicketWhereInput;
    const recentOrUrgentWhere = {
      OR: [
        { currentStatus: { in: [...dashboardOpenStatuses] }, updatedAt: { gte: start, lt: asOf } },
        urgentOpenWhere,
      ],
    } satisfies Prisma.TicketWhereInput;

    try {
      const data = await getPrisma().$transaction(async (tx) => {
        const [unassignedOpenTickets, myOwnedOpenTickets, myActiveActions, myRecentlyCompletedActions,
          urgentOpenTickets, myActiveActionRows, myRecentlyCompletedActionRows, recentOrUrgentTickets, roleCounts] = await Promise.all([
          tx.ticket.count({ where: unassignedOpenWhere }),
          tx.ticket.count({ where: myOwnedOpenWhere }),
          tx.actionTaken.count({ where: activeActionWhere }),
          tx.actionTaken.count({ where: completedActionWhere }),
          tx.ticket.count({ where: urgentOpenWhere }),
          tx.actionTaken.findMany({ where: activeActionWhere, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], take: dashboardListLimit, select: dashboardActionRow }),
          tx.actionTaken.findMany({ where: completedActionWhere, orderBy: [{ actionAt: "desc" }, { id: "desc" }], take: dashboardListLimit, select: dashboardActionRow }),
          tx.ticket.findMany({ where: recentOrUrgentWhere, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], take: dashboardListLimit, select: staffTicketRow }),
          auth.user.role === "ADMINISTRATOR"
            ? tx.requesterUser.groupBy({ by: ["role"], where: { isActive: true }, _count: { _all: true }, orderBy: { role: "asc" } })
            : Promise.resolve(null),
        ]);

        return {
          asOf: asOf.toISOString(),
          metrics: { unassignedOpenTickets, myOwnedOpenTickets, myActiveActions, myRecentlyCompletedActions, urgentOpenTickets },
          myActiveActions: myActiveActionRows,
          myRecentlyCompletedActions: myRecentlyCompletedActionRows,
          recentOrUrgentTickets,
          drillDown: {
            unassignedOpenTickets: "/staff-tickets?scope=unassigned-open",
            myOwnedOpenTickets: "/staff-tickets?scope=my-owned-open",
            myActiveActions: "/staff-tickets?scope=my-active-actions",
            myRecentlyCompletedActions: `/staff-tickets?scope=my-recently-completed-actions&asOf=${asOfQuery}`,
            urgentOpenTickets: "/staff-tickets?scope=urgent-open",
          },
          adminAccountSummary: roleCounts?.map(({ role, _count }) => ({ role, activeUsers: _count._all })) ?? null,
        };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });

      return res.status(200).json({ data });
    } catch {
      return sendInternalError(res, "Unable to load Staff dashboard", "staff");
    }
  },
);
