import { NextResponse } from "next/server";
import { env } from "@/src/config/env";
import { adminLoginRateLimitConfig, rateLimitService, type RateLimitService } from "@/src/services/rate-limit.service";
import { adminAuthService, adminCookieName, adminSessionSeconds } from "@/src/services/admin-auth.service";
import { adminUserService, passwordLength, type AdminUserService } from "@/src/services/admin-user.service";

export function getPublicOrigin(request: Request) {
  const url = new URL(request.url);
  const host = request.headers.get("host") ?? url.host;
  const protocol = request.headers.get("x-forwarded-proto")?.split(",")[0].trim() ?? url.protocol.slice(0, -1);
  return `${protocol}://${host}`;
}

export function isSameOrigin(request: Request) {
  return request.headers.get("origin") === getPublicOrigin(request);
}

/** Body and status for a non-"ok" authorize() result. */
export function accessDenied(access: "unauthenticated" | "forbidden") {
  return access === "forbidden" ? { error: "Forbidden", status: 403 } : { error: "Unauthorized", status: 401 };
}

// shortcut: keyed per client IP only, so an attacker rotating IPs is not slowed; upgrade to a per-username or global bucket if abused.
export function clientKey(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
}

export class AdminAuthController {
  constructor(
    private auth = adminAuthService,
    private limits: Pick<RateLimitService, "consume"> = rateLimitService,
    private users: Pick<AdminUserService, "changePassword"> = adminUserService
  ) {}

  async login(request: Request) {
    if (!isSameOrigin(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    try {
      const limit = await this.limits.consume({ lineUserId: clientKey(request), ...adminLoginRateLimitConfig });
      if (!limit.allowed) {
        return NextResponse.json({ error: "Too many attempts" }, {
          status: 429,
          headers: { "Retry-After": String(limit.retryAfterSeconds ?? 60), "Cache-Control": "private, no-store" }
        });
      }
    } catch (error) {
      console.error("admin login rate limit unavailable", error); // fail open: the limit is defense in depth
    }
    let form: FormData;
    try { form = await request.formData(); }
    catch { return NextResponse.json({ error: "Invalid form" }, { status: 400 }); }
    const email = form.get("email");
    const password = form.get("password");
    const token = typeof email === "string" && email.length <= 256 && typeof password === "string" && password.length <= 1024
      ? await this.auth.login(email, password)
      : null;
    const response = NextResponse.redirect(new URL(token ? "/admin" : "/login?login=failed", getPublicOrigin(request)), 303);
    response.headers.set("Cache-Control", "private, no-store");
    if (token) response.cookies.set(adminCookieName, token, {
      httpOnly: true, secure: env.NODE_ENV === "production", sameSite: "strict",
      path: "/", maxAge: adminSessionSeconds
    });
    return response;
  }

  async changePassword(request: Request) {
    if (!isSameOrigin(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const session = await this.auth.authenticate(request);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    try {
      const limit = await this.limits.consume({ lineUserId: `pw-change:${session.userId}`, ...adminLoginRateLimitConfig });
      if (!limit.allowed) {
        return NextResponse.json({ error: "Too many attempts" }, {
          status: 429,
          headers: { "Retry-After": String(limit.retryAfterSeconds ?? 60), "Cache-Control": "private, no-store" }
        });
      }
    } catch (error) {
      console.error("admin password change rate limit unavailable", error); // fail open, like login
    }
    let form: FormData;
    try { form = await request.formData(); }
    catch { return NextResponse.json({ error: "Invalid form" }, { status: 400 }); }
    const field = (name: string) => {
      const value = form.get(name);
      return typeof value === "string" && value.length <= passwordLength.max ? value : "";
    };
    const [current, next, confirm] = [field("currentPassword"), field("newPassword"), field("confirmPassword")];
    const outcome = !current ? "wrong_password" : next !== confirm ? "mismatch" : await this.users.changePassword(session.email, current, next);
    const response = NextResponse.redirect(new URL(`/admin/profile?password=${outcome}`, getPublicOrigin(request)), 303);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }

  async logout(request: Request) {
    if (!isSameOrigin(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const response = NextResponse.redirect(new URL("/login", getPublicOrigin(request)), 303);
    response.cookies.set(adminCookieName, "", { path: "/", maxAge: 0 });
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
}

export const adminAuthController = new AdminAuthController();
