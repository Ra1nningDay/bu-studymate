import { NextResponse } from "next/server";
import { env } from "@/src/config/env";
import { adminAuthService, adminCookieName, adminSessionSeconds } from "@/src/services/admin-auth.service";

export function getPublicOrigin(request: Request) {
  const url = new URL(request.url);
  const host = request.headers.get("host") ?? url.host;
  const protocol = request.headers.get("x-forwarded-proto")?.split(",")[0].trim() ?? url.protocol.slice(0, -1);
  return `${protocol}://${host}`;
}

export function isSameOrigin(request: Request) {
  return request.headers.get("origin") === getPublicOrigin(request);
}

export class AdminAuthController {
  constructor(private auth = adminAuthService) {}

  async login(request: Request) {
    if (!isSameOrigin(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    let form: FormData;
    try { form = await request.formData(); }
    catch { return NextResponse.json({ error: "Invalid form" }, { status: 400 }); }
    const password = form.get("password");
    const username = form.get("username");
    const token = typeof password === "string" && password.length <= 1024
      ? this.auth.createSession(
          password,
          typeof username === "string" && username.trim().length <= 256 ? username.trim() : undefined
        )
      : null;
    const response = NextResponse.redirect(new URL(token ? "/admin" : "/login?login=failed", getPublicOrigin(request)), 303);
    response.headers.set("Cache-Control", "private, no-store");
    if (token) response.cookies.set(adminCookieName, token, {
      httpOnly: true, secure: env.NODE_ENV === "production", sameSite: "strict",
      path: "/", maxAge: adminSessionSeconds
    });
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
