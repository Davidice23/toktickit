import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App.js";
import * as api from "../../src/api.js";

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

beforeEach(() => {
  vi.spyOn(api, "fetchCategories").mockResolvedValue([]);
  vi.spyOn(api, "fetchRelatedSystems").mockResolvedValue([]);
  vi.spyOn(api, "fetchTickets").mockResolvedValue({ data: [], meta: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0, hasPreviousPage: false, hasNextPage: false } });
});

describe("Lab 2 Development Requester context", () => {
  it("loads active requesters and persists the selected requester", async () => {
    vi.spyOn(api, "fetchRequesters").mockResolvedValue([
      { id: 1, name: "Anan Chaiya", isActive: true },
      { id: 2, name: "Kanya Prasert", isActive: true },
    ]);
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Choose Requester" }));
    await user.selectOptions(await screen.findByLabelText("Development Requester"), "2");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(localStorage.getItem("toktickit.devRequesterId")).toBe("2");
    expect(screen.getByLabelText("Current Requester")).toHaveTextContent("Kanya Prasert");
  });

  it("shows a safe failure with Retry", async () => {
    vi.spyOn(api, "fetchRequesters").mockRejectedValue(new Error("database details"));
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Choose Requester" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/unable to load requesters/i);
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).not.toHaveTextContent("database details");
  });

  it("restores a valid requester from localStorage", async () => {
    localStorage.setItem("toktickit.devRequesterId", "1");
    vi.spyOn(api, "fetchRequesters").mockResolvedValue([
      { id: 1, name: "Anan Chaiya", isActive: true },
    ]);

    render(<App />);

    expect(await screen.findByLabelText("Current Requester")).toHaveTextContent("Anan Chaiya");
    expect(screen.queryByRole("heading", { name: "Select Development Requester" })).not.toBeInTheDocument();
  });
});
