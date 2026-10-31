import { TicketStatus } from "@prisma/client";

// BR-13 / BR-16: only the listed directed edges are allowed. Authorization,
// reason/confirmation, owner, and resolution checks are separate gates.
export const TICKET_TRANSITIONS: Readonly<Record<TicketStatus, readonly TicketStatus[]>> = {
  NEW: [TicketStatus.OPEN, TicketStatus.CANCELLED],
  OPEN: [TicketStatus.IN_PROGRESS, TicketStatus.WAITING_FOR_REQUESTER, TicketStatus.CANCELLED],
  IN_PROGRESS: [TicketStatus.WAITING_FOR_REQUESTER, TicketStatus.RESOLVED, TicketStatus.CANCELLED],
  WAITING_FOR_REQUESTER: [TicketStatus.IN_PROGRESS, TicketStatus.RESOLVED, TicketStatus.CANCELLED],
  RESOLVED: [TicketStatus.CLOSED, TicketStatus.REOPENED],
  CLOSED: [TicketStatus.REOPENED],
  REOPENED: [TicketStatus.IN_PROGRESS, TicketStatus.CANCELLED],
  CANCELLED: [TicketStatus.REOPENED],
};

export function isTicketTransitionAllowed(from: TicketStatus, to: TicketStatus): boolean {
  return TICKET_TRANSITIONS[from].includes(to);
}

export type ResolutionGateInput = {
  ownerIsActiveOperational: boolean;
  completedActionsWithResult: number;
  activeActions: number;
};

// BR-15: requester advisory is intentionally not part of this input.
export function resolutionGateFailures(input: ResolutionGateInput): Record<string, string> {
  const fields: Record<string, string> = {};
  if (!input.ownerIsActiveOperational) fields.ownerId = "An active IT Staff or Administrator owner is required";
  if (input.completedActionsWithResult < 1) fields.completedAction = "At least one completed Action with a non-blank result is required";
  if (input.activeActions > 0) fields.activeActions = "Complete or cancel all planned and in-progress Actions first";
  return fields;
}
