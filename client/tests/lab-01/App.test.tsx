import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App.js";
import * as api from "../../src/api.js";

describe("App", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // WORKED EXAMPLE — provided for you.
  it("renders the TokTickIT heading", () => {
    render(<App />);
    expect(screen.getByText(/TokTickIT/i)).toBeInTheDocument();
  });

  it("shows a loading state while checking the system", async () => {
    vi.spyOn(api, "checkSystem").mockReturnValue(new Promise(() => undefined));
    const user = userEvent.setup();

    render(<App />);
    await user.click(screen.getByRole("button", { name: /check system/i }));

    expect(screen.getByRole("status")).toHaveTextContent(/checking TokTickIT API/i);
    expect(screen.getByRole("button", { name: /loading/i })).toBeDisabled();
  });

  it("shows an Offline error message when the API is unavailable", async () => {
    vi.spyOn(api, "checkSystem").mockRejectedValue(new Error("Network error"));
    const user = userEvent.setup();

    render(<App />);
    await user.click(screen.getByRole("button", { name: /check system/i }));

    expect(await screen.findByText(/system status:/i)).toBeInTheDocument();
    expect(screen.getByText("Offline")).toBeInTheDocument();
    expect(screen.getByText(/unable to connect to TokTickIT API/i)).toBeInTheDocument();
  });

  it("shows Online and the seeded categories on success", async () => {
    vi.spyOn(api, "checkSystem").mockResolvedValue({
      online: true,
      categories: [
        { id: 1, name: "Account and Access" },
        { id: 2, name: "Hardware" },
        { id: 3, name: "Software" },
        { id: 4, name: "Network" },
      ],
    });
    const user = userEvent.setup();

    render(<App />);
    await user.click(screen.getByRole("button", { name: /check system/i }));

    expect(await screen.findByText("Online")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /IT request categories/i })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "Account and Access",
      "Hardware",
      "Software",
      "Network",
    ]);
  });
});
