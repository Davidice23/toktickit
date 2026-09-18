import "@testing-library/jest-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App.js";
import * as api from "../../src/api.js";

const session = { user: { id: 7, name: "Staff User", email: "staff@example.com", role: "IT_STAFF" as const, isActive: true, mustChangePassword: false }, mustChangePassword: false, csrfToken: "csrf" };
const queue = { data: [{ id: 11, ticketNumber: "TKT-000011", requesterId: 2, summary: "VPN access", requestedPriority: "HIGH", itPriority: null, currentStatus: "OPEN", ownerId: null, createdAt: "2026-09-18T01:00:00.000Z", updatedAt: "2026-09-18T02:00:00.000Z", requester: { id: 2, name: "Requester User", email: "requester@example.com" }, owner: null, category: { id: 1, name: "Network" }, relatedSystem: { id: 1, name: "VPN" } }], meta: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1, hasPreviousPage: false, hasNextPage: false } };

afterEach(() => vi.restoreAllMocks());

describe("Lab 3 Staff Ticket Queue UI", () => {
  it("shows operational queue fields and filters for IT Staff", async () => {
    vi.spyOn(api, "fetchCurrentUser").mockResolvedValue(session);
    vi.spyOn(api, "fetchStaffTickets").mockResolvedValue(queue);
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Staff Ticket Queue" })).toBeInTheDocument();
    expect(screen.getByLabelText("Status")).toBeInTheDocument();
    expect(screen.getByLabelText("IT Priority")).toBeInTheDocument();
    expect(await screen.findByText("TKT-000011")).toBeInTheDocument();
    expect(screen.getAllByText("Unassigned").length).toBeGreaterThan(0);
  });

  it("submits search and documented ownership filters", async () => {
    vi.spyOn(api, "fetchCurrentUser").mockResolvedValue(session);
    const load = vi.spyOn(api, "fetchStaffTickets").mockResolvedValue(queue);
    const user = userEvent.setup();
    render(<App />);

    await screen.findByRole("heading", { name: "Staff Ticket Queue" });
    await user.type(screen.getByLabelText("Search"), "VPN");
    await user.selectOptions(screen.getByLabelText("Ownership"), "unassigned");
    await user.click(screen.getByRole("button", { name: "Search Queue" }));

    expect(load).toHaveBeenLastCalledWith(expect.objectContaining({ toString: expect.any(Function) }));
    const params = load.mock.calls.at(-1)?.[0] as URLSearchParams;
    expect(params.get("search")).toBe("VPN");
    expect(params.get("owner")).toBe("unassigned");
  });
});
