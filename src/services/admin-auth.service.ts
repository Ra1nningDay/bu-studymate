import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "@/src/config/env";

export const adminCookieName = "studymate-admin";
export const adminSessionSeconds = 8 * 60 * 60;

export class AdminAuthService {
  constructor(
    private password: string | undefined = env.ADMIN_PASSWORD,
    private username: string = env.ADMIN_USERNAME ?? "admin"
  ) {}

  get configured() {
    return Boolean(this.password);
  }

  private sign(value: string) {
    return createHmac("sha256", this.password!).update(`admin:${value}`).digest("hex");
  }

  createSession(submittedPassword: string, now?: number): string | null;
  createSession(submittedPassword: string, submittedUsername?: string, now?: number): string | null;
  createSession(submittedPassword: string, usernameOrNow?: string | number, now?: number): string | null {
    if (!this.password) return null;
    const timestamp = typeof usernameOrNow === "number" ? usernameOrNow : (now ?? Date.now());
    const submittedUsername = typeof usernameOrNow === "string" ? usernameOrNow : undefined;
    if (submittedUsername !== undefined) {
      const expectedUser = Buffer.from(this.username.trim().toLowerCase());
      const actualUser = Buffer.from(submittedUsername.trim().toLowerCase());
      if (expectedUser.length !== actualUser.length || !timingSafeEqual(expectedUser, actualUser)) {
        return null;
      }
    }
    const expected = Buffer.from(this.password);
    const actual = Buffer.from(submittedPassword);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
    const value = `${timestamp + adminSessionSeconds * 1000}.${randomBytes(16).toString("hex")}`;
    return `${value}.${this.sign(value)}`;
  }

  isAuthenticated(token: string | undefined, now = Date.now()) {
    if (!this.password || !token) return false;
    const match = /^(\d{13})\.([0-9a-f]{32})\.([0-9a-f]{64})$/.exec(token);
    if (!match || Number(match[1]) <= now) return false;
    const signature = Buffer.from(match[3], "hex");
    return timingSafeEqual(signature, Buffer.from(this.sign(`${match[1]}.${match[2]}`), "hex"));
  }

  isRequestAuthenticated(request: Request) {
    const cookie = request.headers.get("cookie")?.split(";")
      .map((part) => part.trim()).find((part) => part.startsWith(`${adminCookieName}=`));
    return this.isAuthenticated(cookie?.slice(adminCookieName.length + 1));
  }
}

export const adminAuthService = new AdminAuthService();
