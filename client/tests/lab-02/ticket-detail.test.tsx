import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TicketDetail from "../../src/TicketDetail.js";
import * as api from "../../src/api.js";

afterEach(() => vi.restoreAllMocks());

describe("Lab 2 owned Ticket detail", () => {
  it("shows read-only detail and returns to the list", async () => {
    vi.spyOn(api, "fetchTicketDetail").mockResolvedValue({ id: 9, ticketNumber: "TKT-000009", requesterId: 1, categoryId: 2, relatedSystemId: 3, summary: "VPN access issue", description: "Cannot connect from campus.", requestedPriority: "HIGH", currentStatus: "NEW", itPriority: null, createdAt: "2026-09-05T00:00:00Z", updatedAt: "2026-09-05T00:00:00Z", requester: { id: 1, name: "Anan Chaiya", email: "anan@example.com" }, category: { id: 2, name: "Network" }, relatedSystem: { id: 3, name: "VPN" }, attachments: [] });
    const onBack = vi.fn();
    render(<TicketDetail requesterId={1} ticketId={9} onBack={onBack} />);
    expect(await screen.findByRole("heading", { name: "TKT-000009" })).toBeInTheDocument();
    expect(screen.getByText("Cannot connect from campus.")).toBeInTheDocument();
    expect(screen.getByText("No attachments.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Back to My Tickets" }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it("shows an ownership-safe unavailable state", async () => {
    vi.spyOn(api, "fetchTicketDetail").mockRejectedValue(new Error("Ticket not found"));
    render(<TicketDetail requesterId={2} ticketId={9} onBack={() => undefined} />);
    expect(await screen.findByText("Ticket not found or unavailable.")).toBeInTheDocument();
  });
});
