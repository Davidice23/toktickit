import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "../../src/App.js";
import * as api from "../../src/api.js";

afterEach(() => vi.restoreAllMocks());

describe("Lab 4 CI foundation smoke", () => {
  it("renders the signed-out state after the current-session probe is denied", async () => {
    vi.spyOn(api, "fetchCurrentUser").mockRejectedValue(new Error("Unauthenticated"));

    render(<App />);

    expect(await screen.findByRole("heading", { name: "Sign in to TokTickIT" })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Primary navigation" })).not.toBeInTheDocument();
  });
});
