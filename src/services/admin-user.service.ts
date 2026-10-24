import { randomBytes } from "node:crypto";
import { adminUserRepository, type AdminRole, type AdminUserRepository } from "@/src/repositories/admin-user.repository";
import { hashPassword } from "@/src/services/password";

const newPassword = () => randomBytes(18).toString("base64url");

export class AdminUserService {
  constructor(private users: Pick<AdminUserRepository, "findByEmail" | "upsertWithRole" | "setPasswordHash"> = adminUserRepository) {}

  /** New user, or an existing one with no password yet, gets a random password returned once; otherwise the password is untouched. */
  async provision(email: string, role: AdminRole): Promise<{ password: string | null }> {
    if (role !== "admin" && role !== "viewer") throw new Error("Role must be admin or viewer");
    const normalized = email.trim().toLowerCase();
    const existing = await this.users.findByEmail(normalized);
    const password = existing?.passwordHash ? null : newPassword();
    await this.users.upsertWithRole(normalized, role, password && (await hashPassword(password)));
    return { password };
  }

  async resetPassword(email: string): Promise<{ password: string }> {
    const normalized = email.trim().toLowerCase();
    const user = await this.users.findByEmail(normalized);
    if (!user?.roles.some((r) => r === "admin" || r === "viewer")) throw new Error("User not found");
    const password = newPassword();
    await this.users.setPasswordHash(normalized, await hashPassword(password));
    return { password };
  }
}

export const adminUserService = new AdminUserService();
