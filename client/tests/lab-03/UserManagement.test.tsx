import "@testing-library/jest-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import UserManagement from "../../src/UserManagement.js";
import * as api from "../../src/api.js";

const adminUser = {
  id: 1,
  name: "Alice Admin",
  email: "alice@example.com",
  role: "ADMINISTRATOR" as const,
  isActive: true,
  mustChangePassword: false,
};
const requesterUser = {
  id: 2,
  name: "Bob Requester",
  email: "bob@example.com",
  role: "REQUESTER" as const,
  isActive: true,
  mustChangePassword: true,
};
const list = { data: [adminUser, requesterUser], meta: { totalItems: 2 } };

afterEach(() => vi.restoreAllMocks());

describe("Lab 3 Administrator User Management", () => {
  it("loads users and exposes search, role filter, and safe actions", async () => {
    vi.spyOn(api, "fetchAdminUsers").mockResolvedValue(list);
    render(<UserManagement currentUserId={adminUser.id} />);

    expect(await screen.findByRole("heading", { name: "User Management" })).toBeInTheDocument();
    expect(screen.getByText("Alice Admin")).toBeInTheDocument();
    expect(screen.getByText("Password change required")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Search users" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Role filter" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Edit" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Reset password" })).toHaveLength(2);
  });

  it("creates a user without displaying the plaintext password", async () => {
    const fetchUsers = vi.spyOn(api, "fetchAdminUsers").mockResolvedValue(list);
    const createUser = vi.spyOn(api, "createAdminUser").mockResolvedValue({
      id: 3,
      name: "New Staff",
      email: "new.staff@example.com",
      role: "IT_STAFF",
      isActive: true,
      mustChangePassword: true,
    });

    render(<UserManagement currentUserId={adminUser.id} />);
    await screen.findByRole("heading", { name: "User Management" });
    await userEvent.click(screen.getByRole("button", { name: "Create User" }));

    await userEvent.type(screen.getByLabelText("Name"), "New Staff");
    await userEvent.type(screen.getByLabelText("Email"), "new.staff@example.com");
    await userEvent.selectOptions(screen.getByLabelText("Role"), "IT_STAFF");
    await userEvent.type(screen.getByLabelText("Initial password"), "safe-local-password");
    await userEvent.click(screen.getAllByRole("button", { name: "Create User" })[1]);

    expect(createUser).toHaveBeenCalledWith({
      name: "New Staff",
      email: "new.staff@example.com",
      role: "IT_STAFF",
      isActive: true,
      initialPassword: "safe-local-password",
    });
    expect(await screen.findByText(/User created/)).toBeInTheDocument();
    expect(screen.queryByText("safe-local-password")).not.toBeInTheDocument();
    expect(fetchUsers).toHaveBeenCalledTimes(2);
  });

  it("explains and prevents deactivating the only active Administrator", async () => {
    vi.spyOn(api, "fetchAdminUsers").mockResolvedValue({ data: [adminUser], meta: { totalItems: 1 } });
    const updateUser = vi.spyOn(api, "updateAdminUser");

    render(<UserManagement currentUserId={adminUser.id} />);
    await screen.findByRole("heading", { name: "User Management" });
    await userEvent.click(screen.getByRole("button", { name: "Edit" }));

    expect(screen.getByText(/last active Administrator protection/)).toBeInTheDocument();
    expect(screen.getByLabelText("Active account")).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Role" })).toBeDisabled();
    expect(updateUser).not.toHaveBeenCalled();
  });
});
