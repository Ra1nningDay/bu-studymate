import { randomBytes } from "node:crypto";
import { env } from "@/src/config/env";
import { bumailEmail, exchangeGoogleCode, googleAuthUrl } from "@/lib/google-oidc";
import { studentAccountRepository, type StudentAccountRepository } from "@/src/repositories/student-account.repository";
import { signToken, verifyToken } from "./signed-token";

export const studentCookieName = "studymate-student";
export const studentOauthCookieName = "studymate-student-oauth";
export const studentSessionSeconds = 8 * 60 * 60;
export const studentOauthSeconds = 10 * 60;
const linkSeconds = 10 * 60;

type LinkToken = { typ: "link"; lineUserId: string };
type OauthToken = { typ: "oauth"; lineUserId: string; state: string; nonce: string };
type SessionToken = { typ: "session"; lineUserId: string; email: string };

type Deps = {
  secret?: string;
  clientId?: string;
  clientSecret?: string;
  domain: string;
  appUrl: string;
  repo: Pick<StudentAccountRepository, "bind" | "findByLineUserId">;
  google: { exchange: typeof exchangeGoogleCode };
};

type SignInResult = { ok: true; sessionToken: string; email: string } | { ok: false; reason: string };

export class StudentAuthService {
  private deps: Deps;

  constructor(deps: Partial<Deps> = {}) {
    this.deps = {
      secret: env.STUDENT_AUTH_SECRET,
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      domain: env.STUDENT_EMAIL_DOMAIN,
      appUrl: (env.APP_URL ?? env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, ""),
      repo: studentAccountRepository,
      google: { exchange: exchangeGoogleCode },
      ...deps
    };
  }

  get configured() {
    const { secret, clientId, clientSecret, appUrl } = this.deps;
    return Boolean(secret && clientId && clientSecret && appUrl);
  }

  createLinkUrl(lineUserId: string, now?: number) {
    const token = signToken({ typ: "link", lineUserId }, this.deps.secret!, linkSeconds, now);
    // openExternalBrowser makes LINE leave its in-app WebView; Google rejects OAuth there (disallowed_useragent).
    return `${this.deps.appUrl}/login?link=${token}&openExternalBrowser=1`;
  }

  isValidLink(token: string | undefined, now?: number) {
    return this.configured && verifyToken<LinkToken>(token, this.deps.secret!, "link", now) !== null;
  }

  startGoogleSignIn(linkToken: string | undefined, now?: number) {
    if (!this.configured) return null;
    const link = verifyToken<LinkToken>(linkToken, this.deps.secret!, "link", now);
    if (!link) return null;
    const state = randomBytes(16).toString("hex");
    const nonce = randomBytes(16).toString("hex");
    return {
      redirectUrl: googleAuthUrl({
        clientId: this.deps.clientId!, redirectUri: this.redirectUri, state, nonce, hd: this.deps.domain
      }),
      stateCookie: signToken({ typ: "oauth", lineUserId: link.lineUserId, state, nonce }, this.deps.secret!, studentOauthSeconds, now)
    };
  }

  async completeGoogleSignIn(
    p: { code?: string; state?: string; error?: string; stateCookie?: string },
    now?: number
  ): Promise<SignInResult> {
    const fail = (reason: string) => ({ ok: false as const, reason });
    if (!this.configured) return fail("not_configured");
    if (p.error) return fail("google_error");
    if (!p.code || !p.state) return fail("missing_params");
    const oauth = verifyToken<OauthToken>(p.stateCookie, this.deps.secret!, "oauth", now);
    if (!oauth || oauth.state !== p.state) return fail("bad_state");
    try {
      const claims = await this.deps.google.exchange({
        code: p.code, clientId: this.deps.clientId!, clientSecret: this.deps.clientSecret!,
        redirectUri: this.redirectUri, now
      });
      if (claims.nonce !== oauth.nonce) return fail("bad_nonce");
      const email = bumailEmail(claims, this.deps.domain);
      if (!email) return fail("not_student_email");
      const bound = await this.deps.repo.bind({ lineUserId: oauth.lineUserId, email });
      if (bound !== "bound" && bound !== "unchanged") return fail(bound);
      const sessionToken = signToken(
        { typ: "session", lineUserId: oauth.lineUserId, email }, this.deps.secret!, studentSessionSeconds, now
      );
      return { ok: true, sessionToken, email };
    } catch {
      return fail("exchange_failed");
    }
  }

  async isVerified(lineUserId: string) {
    return (await this.deps.repo.findByLineUserId(lineUserId)) !== null;
  }

  readSession(token: string | undefined, now?: number) {
    if (!this.deps.secret) return null;
    const session = verifyToken<SessionToken>(token, this.deps.secret, "session", now);
    return session ? { lineUserId: session.lineUserId, email: session.email } : null;
  }

  private get redirectUri() {
    return `${this.deps.appUrl}/api/student/auth/google/callback`;
  }
}

export const studentAuthService = new StudentAuthService();
