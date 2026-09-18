import "@testing-library/jest-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "../../src/App.js";
import * as api from "../../src/api.js";

const requester = { user: { id: 1, name: "Requester", email: "requester@example.com", role: "REQUESTER" as const, isActive: true, mustChangePassword: false }, mustChangePassword: false, csrfToken: "csrf" };
const staff = { user: { id: 7, name: "Staff", email: "staff@example.com", role: "IT_STAFF" as const, isActive: true, mustChangePassword: false }, mustChangePassword: false, csrfToken: "csrf" };
const emptyQueue = { data: [], meta: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0, hasPreviousPage: false, hasNextPage: false } };
const emptyTickets = { data: [], meta: { page: 1, pageSize: 10, totalItems: 0, totalPages: 1, hasPreviousPage: false, hasNextPage: false } };

afterEach(() => vi.restoreAllMocks());

describe("Lab 3 role-specific navigation", () => {
  it("shows Staff Queue and hides Requester actions for IT Staff", async () => {
    vi.spyOn(api, "fetchCurrentUser").mockResolvedValue(staff);
    vi.spyOn(api, "fetchStaffTickets").mockResolvedValue(emptyQueue);
    render(<App />);
    expect(await screen.findByRole("link", { name: "Staff Queue" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Create Ticket" })).not.toBeInTheDocument();
  });

  it("keeps Requester navigation separate from Staff Queue", async () => {
    vi.spyOn(api, "fetchCurrentUser").mockResolvedValue(requester);
    vi.spyOn(api, "fetchTickets").mockResolvedValue(emptyTickets);
    render(<App />);
    expect(await screen.findByRole("link", { name: "My Tickets" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Create Ticket" }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: "Staff Queue" })).not.toBeInTheDocument();
  });
});
