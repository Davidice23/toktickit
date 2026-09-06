import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MyTickets from "../../src/MyTickets.js";
import * as api from "../../src/api.js";

afterEach(() => vi.restoreAllMocks());

describe("Lab 2 My Tickets controls", () => {
  it("loads filter references and sends search/filter/sort/page parameters", async () => {
    const fetchTickets = vi.spyOn(api, "fetchTickets").mockResolvedValue({ data: [], meta: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0, hasPreviousPage: false, hasNextPage: false } });
    vi.spyOn(api, "fetchCategories").mockResolvedValue([{ id: 2, name: "Hardware" }]);
    vi.spyOn(api, "fetchRelatedSystems").mockResolvedValue([{ id: 7, name: "Network", isActive: true }]);
    const user = userEvent.setup();
    render(<MyTickets requesterId={1} onOpen={() => undefined} />);
    await screen.findByRole("heading", { name: "My Tickets" });
    await user.type(screen.getByRole("textbox", { name: "Search tickets" }), "vpn");
    await user.selectOptions(screen.getByLabelText("Category"), "2");
    await user.selectOptions(screen.getByLabelText("Sort by"), "summary");
    await user.selectOptions(screen.getByLabelText("Direction"), "asc");
    await user.click(screen.getByRole("button", { name: "Apply Filters" }));
    const params = fetchTickets.mock.lastCall?.[1];
    expect(params?.get("search")).toBe("vpn");
    expect(params?.get("categoryId")).toBe("2");
    expect(params?.get("sortBy")).toBe("summary");
    expect(params?.get("sortDirection")).toBe("asc");
  });
});
