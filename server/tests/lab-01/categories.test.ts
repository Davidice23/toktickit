import { afterAll, afterEach, describe, it, expect, vi } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import * as prismaModule from "../../src/prisma.js";

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await prismaModule.getPrisma().$disconnect();
});

describe("GET /api/categories", () => {
  it("returns the four seeded categories in id order", async () => {
    const res = await request(app).get("/api/categories");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(4);
    expect(res.body.map((category: { name: string }) => category.name)).toEqual([
      "Account and Access",
      "Hardware",
      "Software",
      "Network",
    ]);
    expect(res.body.every((category: { id: unknown }) => typeof category.id === "number")).toBe(true);
    expect(res.body.map((category: { id: number }) => category.id)).toEqual(
      [...res.body.map((category: { id: number }) => category.id)].sort((a, b) => a - b),
    );
  });

  it("returns a safe error message when the database is unavailable", async () => {
    vi.spyOn(prismaModule, "getPrisma").mockReturnValue({
      category: {
        findMany: vi.fn().mockRejectedValue(new Error("sensitive database details")),
      },
    } as unknown as ReturnType<typeof prismaModule.getPrisma>);

    const res = await request(app).get("/api/categories");

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Unable to load IT request categories" });
    expect(JSON.stringify(res.body)).not.toContain("sensitive database details");
  });
});
