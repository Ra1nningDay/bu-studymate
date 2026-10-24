import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/src/config/env";
import { adminUserRepository, type AdminRole, type AdminSession, type AdminUserRepository } from "@/src/repositories/admin-user.repository";
import { hashPassword, verifyPassword } from "@/src/services/password";

export type { AdminRole, AdminSession };

export const adminCookieName = "studymate-admin";
export const adminSessionSeconds = 8 * 60 * 60;

// Verified against when the email is unknown so a miss costs the same as a wrong password.
const dummyHash = hashPassword("dummy-password-for-timing");

export class AdminAuthService {
  constructor(
    private secret: string | undefined = env.ADMIN_SESSION_SECRET,
    private users: Pick<AdminUserRepository, "findByEmail" | "findActiveById"> = adminUserRepository,
    private verify: typeof verifyPassword = verifyPassword
  ) {}

  get configured() {
    return Boolean(this.secret);
  }

  private sign(value: string) {
    return createHmac("sha256", this.secret!).update(`admin:${value}`).digest("hex");
  }

  async login(email: string, password: string, now = Date.now()): Promise<string | null> {
    if (!this.secret) return null;
    const user = await this.users.findByEmail(email);
    const matches = await this.verify(password, user?.passwordHash ?? (await dummyHash));
    if (!user?.passwordHash || !matches || user.disabledAt || !user.roles.some((r) => r === "admin" || r === "viewer")) return null;
    const value = `${now + adminSessionSeconds * 1000}.${user.id}`;
    return `${value}.${this.sign(value)}`;
  }

  async getSession(token: string | undefined, now = Date.now()): Promise<AdminSession | null> {
    if (!this.secret || !token) return null;
    const match = /^(\d{13})\.([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.([0-9a-f]{64})$/.exec(token);
    if (!match || Number(match[1]) <= now) return null;
    const signature = Buffer.from(match[3], "hex");
    if (!timingSafeEqual(signature, Buffer.from(this.sign(`${match[1]}.${match[2]}`), "hex"))) return null;
    return this.users.findActiveById(match[2]);
  }

  authenticate(request: Request) {
    const cookie = request.headers.get("cookie")?.split(";")
      .map((part) => part.trim()).find((part) => part.startsWith(`${adminCookieName}=`));
    return this.getSession(cookie?.slice(adminCookieName.length + 1));
  }

  async authorize(request: Request, need: "read" | "write"): Promise<"ok" | "unauthenticated" | "forbidden"> {
    const session = await this.authenticate(request);
    if (!session) return "unauthenticated";
    return need === "read" || session.roles.includes("admin") ? "ok" : "forbidden";
  }
}

export const adminAuthService = new AdminAuthService();
