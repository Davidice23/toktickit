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

  it("shows Online when the health check succeeds", async () => {
    vi.spyOn(api, "checkSystem").mockResolvedValue({ online: true, categories: [] });
    const user = userEvent.setup();

    render(<App />);
    await user.click(screen.getByRole("button", { name: /check system/i }));

    expect(await screen.findByText(/system status:/i)).toBeInTheDocument();
    expect(screen.getByText("Online")).toBeInTheDocument();
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

  // Issue 4 will verify that the seeded categories appear after success.
  it.todo("shows Online and the seeded categories on success");
});
