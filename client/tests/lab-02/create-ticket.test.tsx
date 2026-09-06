import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App.js";
import * as api from "../../src/api.js";

afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });

describe("Lab 2 Create Ticket", () => {
  it("loads reference data, validates fields, and shows the created Ticket", async () => {
    vi.spyOn(api, "fetchRequesters").mockResolvedValue([{ id: 1, name: "Anan Chaiya", isActive: true }]);
    vi.spyOn(api, "fetchCategories").mockResolvedValue([{ id: 2, name: "Hardware" }]);
    vi.spyOn(api, "fetchRelatedSystems").mockResolvedValue([{ id: 7, name: "Network and VPN", isActive: true }]);
    vi.spyOn(api, "createTicket").mockResolvedValue({ id: 1, ticketNumber: "TKT-000001", requesterId: 1, summary: "Printer issue", currentStatus: "NEW", createdAt: "2026-09-05T00:00:00Z" });
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Choose Requester" }));
    await user.selectOptions(await screen.findByLabelText("Development Requester"), "1");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(within(screen.getByRole("navigation", { name: /primary navigation/i })).getByRole("link", { name: "Create Ticket" }));
    await screen.findByRole("heading", { name: "Create Ticket" });

    await user.click(screen.getByRole("button", { name: "Submit Ticket" }));
    expect(await screen.findByText("Summary must contain 5-120 characters")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Category"), "2");
    await user.selectOptions(screen.getByLabelText("Related System"), "7");
    await user.selectOptions(screen.getByLabelText("Requested Priority"), "MEDIUM");
    await user.type(screen.getByLabelText(/Summary/), "Printer issue");
    await user.type(screen.getByLabelText(/Description/), "The office printer cannot connect to the network.");
    await user.click(screen.getByRole("button", { name: "Submit Ticket" }));
    expect(await screen.findByText("Ticket created:")).toBeInTheDocument();
    expect(screen.getByText("TKT-000001")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View Ticket" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "My Tickets" })).toBeInTheDocument();
  });

  it("validates and uploads permitted attachments after Ticket creation", async () => {
    vi.spyOn(api, "fetchRequesters").mockResolvedValue([{ id: 1, name: "Anan Chaiya", isActive: true }]);
    vi.spyOn(api, "fetchCategories").mockResolvedValue([{ id: 2, name: "Hardware" }]);
    vi.spyOn(api, "fetchRelatedSystems").mockResolvedValue([{ id: 7, name: "Network and VPN", isActive: true }]);
    vi.spyOn(api, "createTicket").mockResolvedValue({ id: 4, ticketNumber: "TKT-000004", requesterId: 1, summary: "VPN issue", currentStatus: "NEW", createdAt: "2026-09-05T00:00:00Z" });
    const upload = vi.spyOn(api, "uploadAttachments").mockResolvedValue();
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Choose Requester" }));
    await user.selectOptions(await screen.findByLabelText("Development Requester"), "1");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(within(screen.getByRole("navigation", { name: /primary navigation/i })).getByRole("link", { name: "Create Ticket" }));
    await screen.findByRole("heading", { name: "Create Ticket" });
    await user.selectOptions(screen.getByLabelText("Category"), "2");
    await user.selectOptions(screen.getByLabelText("Related System"), "7");
    await user.selectOptions(screen.getByLabelText("Requested Priority"), "MEDIUM");
    await user.type(screen.getByLabelText(/Summary/), "VPN issue");
    await user.type(screen.getByLabelText(/Description/), "VPN cannot connect from the campus network.");
    const file = new File(["%PDF-1.4 evidence"], "evidence.pdf", { type: "application/pdf" });
    await user.upload(screen.getByLabelText(/Attachments/), file);
    await user.click(screen.getByRole("button", { name: "Submit Ticket" }));
    expect(await screen.findByText("Ticket created:")).toBeInTheDocument();
    expect(upload).toHaveBeenCalledWith(1, 4, [file]);
  });
});
