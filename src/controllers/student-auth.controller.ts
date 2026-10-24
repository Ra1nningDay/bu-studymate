import { NextResponse } from "next/server";
import { env } from "@/src/config/env";
import {
  studentAuthService, studentCookieName, studentOauthCookieName, studentOauthSeconds, studentSessionSeconds
} from "@/src/services/student-auth.service";
import { getPublicOrigin } from "./admin-auth.controller";

function readCookie(request: Request, name: string) {
  const part = request.headers.get("cookie")?.split(";").map((item) => item.trim()).find((item) => item.startsWith(`${name}=`));
  return part?.slice(name.length + 1);
}

function setCookie(response: NextResponse, name: string, value: string, maxAge: number) {
  // lax, not strict: the callback is a cross-site redirect from Google and strict cookies are not sent on it.
  response.cookies.set(name, value, {
    httpOnly: true, secure: env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge
  });
}

export class StudentAuthController {
  constructor(private auth = studentAuthService) {}

  private redirect(request: Request, location: string, status: number) {
    const response = NextResponse.redirect(new URL(location, getPublicOrigin(request)), status);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }

  async start(request: Request) {
    const started = this.auth.startGoogleSignIn(new URL(request.url).searchParams.get("t") ?? undefined);
    if (!started) return this.redirect(request, "/student/login?student=failed", 303);
    const response = NextResponse.redirect(started.redirectUrl, 302);
    response.headers.set("Cache-Control", "private, no-store");
    setCookie(response, studentOauthCookieName, started.stateCookie, studentOauthSeconds);
    return response;
  }

  async callback(request: Request) {
    const params = new URL(request.url).searchParams;
    const result = await this.auth.completeGoogleSignIn({
      code: params.get("code") ?? undefined,
      state: params.get("state") ?? undefined,
      error: params.get("error") ?? undefined,
      stateCookie: readCookie(request, studentOauthCookieName)
    });
    const response = this.redirect(request, result.ok ? "/student" : "/student/login?student=failed", 303);
    response.cookies.set(studentOauthCookieName, "", { path: "/", maxAge: 0 });
    if (result.ok) setCookie(response, studentCookieName, result.sessionToken, studentSessionSeconds);
    return response;
  }
}

export const studentAuthController = new StudentAuthController();
