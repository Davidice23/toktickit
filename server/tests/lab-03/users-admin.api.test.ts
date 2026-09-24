import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { getPrisma } from "../../src/prisma.js";
import { loginAsAdministrator, loginAsStaff } from "./auth-fixtures.js";

const prisma = getPrisma();
let admin: Awaited<ReturnType<typeof loginAsAdministrator>>;
let staff: Awaited<ReturnType<typeof loginAsStaff>>;
let createdUserId = 0;
const email = `lab3-admin-${randomUUID()}@example.test`;

beforeAll(async () => {
  admin = await loginAsAdministrator();
  staff = await loginAsStaff();
});

afterAll(async () => {
  if (createdUserId) {
    await prisma.session.deleteMany({ where: { userId: createdUserId } });
    await prisma.requesterUser.delete({ where: { id: createdUserId } }).catch(() => undefined);
  }
  await prisma.$disconnect();
});

describe.sequential("Lab 3 Administrator User Management API", () => {
  it("denies User Management to non-Administrators", async () => {
    const response = await staff.agent.get("/api/admin/users");
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });

  it("lists users and creates a safe user without password material", async () => {
    const list = await admin.agent.get("/api/admin/users").query({ role: "REQUESTER", search: "" });
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body.data)).toBe(true);
    expect(list.body.data[0]).not.toHaveProperty("passwordHash");

    const response = await admin.agent.post("/api/admin/users").set("X-CSRF-Token", admin.csrfToken).send({ name: "Lab 3 Managed User", email, role: "REQUESTER", isActive: true, initialPassword: "local-only-password" });
    expect(response.status).toBe(201);
    expect(response.body.data.email).toBe(email);
    expect(response.body.data.mustChangePassword).toBe(true);
    expect(response.body.data).not.toHaveProperty("passwordHash");
    createdUserId = response.body.data.id;
  });

  it("rejects duplicate emails and validates mutations", async () => {
    const duplicate = await admin.agent.post("/api/admin/users").set("X-CSRF-Token", admin.csrfToken).send({ name: "Duplicate", email, role: "REQUESTER", initialPassword: "local-only-password" });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe("DUPLICATE_EMAIL");

    const invalidPassword = await admin.agent.post("/api/admin/users").set("X-CSRF-Token", admin.csrfToken).send({ name: "Invalid", email: `invalid-${randomUUID()}@example.test`, role: "REQUESTER", initialPassword: "short" });
    expect(invalidPassword.status).toBe(400);
    expect(invalidPassword.body.error.fields.initialPassword).toBeDefined();

    const invalidRole = await admin.agent.post("/api/admin/users").set("X-CSRF-Token", admin.csrfToken).send({ name: "Invalid", email: `invalid-role-${randomUUID()}@example.test`, role: "SUPERUSER", initialPassword: "local-only-password" });
    expect(invalidRole.status).toBe(400);
    expect(invalidRole.body.error.fields.role).toBeDefined();

    const invalidActive = await admin.agent.post("/api/admin/users").set("X-CSRF-Token", admin.csrfToken).send({ name: "Invalid", email: `invalid-active-${randomUUID()}@example.test`, role: "REQUESTER", isActive: "false", initialPassword: "local-only-password" });
    expect(invalidActive.status).toBe(400);
    expect(invalidActive.body.error.fields.isActive).toBeDefined();
  });

  it("prevents self-deactivation and removal of the last active Administrator", async () => {
    const self = await admin.agent.patch(`/api/admin/users/${admin.userId}`).set("X-CSRF-Token", admin.csrfToken).send({ isActive: false });
    expect(self.status).toBe(409);
    expect(self.body.error.code).toBe("SELF_DEACTIVATION");

    const last = await admin.agent.patch(`/api/admin/users/${admin.userId}`).set("X-CSRF-Token", admin.csrfToken).send({ role: "REQUESTER" });
    expect(last.status).toBe(409);
    expect(last.body.error.code).toBe("LAST_ADMIN");
  });

  it("updates activation and revokes/reset sessions without exposing passwords", async () => {
    const update = await admin.agent.patch(`/api/admin/users/${createdUserId}`).set("X-CSRF-Token", admin.csrfToken).send({ name: "Updated Lab 3 User", isActive: false });
    expect(update.status).toBe(200);
    expect(update.body.data.name).toBe("Updated Lab 3 User");
    expect(update.body.data.isActive).toBe(false);

    const reset = await admin.agent.post(`/api/admin/users/${createdUserId}/initial-password`).set("X-CSRF-Token", admin.csrfToken).send({ initialPassword: "another-local-password" });
    expect(reset.status).toBe(200);
    expect(reset.body.data.mustChangePassword).toBe(true);
    expect(reset.body.data).not.toHaveProperty("passwordHash");
  });
});
