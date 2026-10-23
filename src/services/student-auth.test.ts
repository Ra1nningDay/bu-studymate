import assert from "node:assert/strict";
import { before, describe, test } from "node:test";

const secret = "fixture-student-secret-0123456789abcdef";
const now = 1_800_000_000_000;
let signToken: typeof import("./signed-token").signToken;
let verifyToken: typeof import("./signed-token").verifyToken;
let Service: typeof import("./student-auth.service").StudentAuthService;
let Controller: typeof import("@/src/controllers/student-auth.controller").StudentAuthController;
let LineController: typeof import("@/src/controllers/line-webhook.controller").LineWebhookController;
let LinePresenter: typeof import("@/src/presenters/line-flex.presenter").LineFlexPresenter;
let Repository: typeof import("@/src/repositories/student-account.repository").StudentAccountRepository;

before(async () => {
  process.env.DATABASE_URL ??= "postgresql://fixture:fixture@localhost:5432/fixture_unused";
  process.env.LINE_CHANNEL_ACCESS_TOKEN ??= "fixture-line-token";
  ({ signToken, verifyToken } = await import("./signed-token"));
  ({ StudentAuthService: Service } = await import("./student-auth.service"));
  ({ StudentAuthController: Controller } = await import("@/src/controllers/student-auth.controller"));
  ({ LineWebhookController: LineController } = await import("@/src/controllers/line-webhook.controller"));
  ({ LineFlexPresenter: LinePresenter } = await import("@/src/presenters/line-flex.presenter"));
  ({ StudentAccountRepository: Repository } = await import("@/src/repositories/student-account.repository"));
});

describe("signed token", () => {
  test("signed token round-trips", () => {
    const token = signToken({ typ: "link", lineUserId: "U1" }, secret, 600, now);
    const payload = verifyToken<{ typ: "link"; lineUserId: string }>(token, secret, "link", now + 1000);
    assert.equal(payload?.lineUserId, "U1");
  });

  test("rejects tampered payload", () => {
    const token = signToken({ typ: "link", lineUserId: "U1" }, secret, 600, now);
    const [, signature] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ typ: "link", lineUserId: "U2", exp: now + 600_000 })).toString("base64url");
    assert.equal(verifyToken(`${forged}.${signature}`, secret, "link", now), null);
  });

  test("rejects tampered signature", () => {
    const token = signToken({ typ: "link" }, secret, 600, now);
    const flipped = token.slice(0, -1) + (token.endsWith("A") ? "B" : "A");
    assert.equal(verifyToken(flipped, secret, "link", now), null);
  });

  test("rejects expired token", () => {
    const token = signToken({ typ: "link" }, secret, 600, now);
    assert.equal(verifyToken(token, secret, "link", now + 600_001), null);
  });

  test("rejects wrong typ", () => {
    const token = signToken({ typ: "session" }, secret, 600, now);
    assert.equal(verifyToken(token, secret, "link", now), null);
  });

  test("rejects wrong secret", () => {
    const token = signToken({ typ: "link" }, secret, 600, now);
    assert.equal(verifyToken(token, `${secret}-other`, "link", now), null);
  });

  test("rejects a repeated query value (string array)", () => {
    assert.equal(verifyToken(["a", "b"] as unknown as string, secret, "link", now), null);
  });

  test("rejects undefined and malformed input", () => {
    for (const input of [undefined, "", "abc", "a.b.c", ".", "!!!.???"]) {
      assert.equal(verifyToken(input, secret, "link", now), null);
    }
  });
});

function fakeDb() {
  const rows: { id: string; lineUserId: string; email: string }[] = [];
  const studentAccount = {
    findUnique: async ({ where }: { where: { lineUserId?: string; email?: string } }) =>
      rows.find((row) => (where.lineUserId ? row.lineUserId === where.lineUserId : row.email === where.email)) ?? null,
    create: async ({ data }: { data: { lineUserId: string; email: string } }) => {
      rows.push({ id: String(rows.length + 1), ...data });
    }
  };
  const db = { studentAccount, $transaction: async (fn: (tx: unknown) => unknown) => fn({ studentAccount }) };
  return { rows, repo: new Repository(db as never) };
}

describe("student account repository", () => {
  test("bind new pair returns bound", async () => {
    const { rows, repo } = fakeDb();
    assert.equal(await repo.bind({ lineUserId: "U1", email: "a@bumail.net" }), "bound");
    assert.equal(rows.length, 1);
  });

  test("same pair again returns unchanged", async () => {
    const { rows, repo } = fakeDb();
    await repo.bind({ lineUserId: "U1", email: "a@bumail.net" });
    assert.equal(await repo.bind({ lineUserId: "U1", email: "a@bumail.net" }), "unchanged");
    assert.equal(rows.length, 1);
  });

  test("same email from another LINE user returns email_taken and writes nothing", async () => {
    const { rows, repo } = fakeDb();
    await repo.bind({ lineUserId: "U1", email: "a@bumail.net" });
    assert.equal(await repo.bind({ lineUserId: "U2", email: "a@bumail.net" }), "email_taken");
    assert.deepEqual(rows.map((row) => row.lineUserId), ["U1"]);
  });

  test("same LINE user with another email returns line_taken and writes nothing", async () => {
    const { rows, repo } = fakeDb();
    await repo.bind({ lineUserId: "U1", email: "a@bumail.net" });
    assert.equal(await repo.bind({ lineUserId: "U1", email: "b@bumail.net" }), "line_taken");
    assert.deepEqual(rows.map((row) => row.email), ["a@bumail.net"]);
  });

  test("findByLineUserId returns the binding or null", async () => {
    const { repo } = fakeDb();
    await repo.bind({ lineUserId: "U1", email: "a@bumail.net" });
    assert.equal((await repo.findByLineUserId("U1"))?.email, "a@bumail.net");
    assert.equal(await repo.findByLineUserId("U9"), null);
  });
});

const appUrl = "https://app.test";

function flow(options: { claims?: Partial<import("@/lib/google-oidc").GoogleIdClaims>; bind?: string; exchangeFails?: boolean } = {}) {
  const binds: { lineUserId: string; email: string }[] = [];
  const state = { nonce: "" };
  const service = new Service({
    secret, clientId: "client-1", clientSecret: "secret-1", domain: "bumail.net", appUrl,
    repo: { bind: async (input: { lineUserId: string; email: string }) => { binds.push(input); return (options.bind ?? "bound") as never; } },
    google: {
      exchange: async () => {
        if (options.exchangeFails) throw new Error("boom");
        return {
          iss: "https://accounts.google.com", aud: "client-1", exp: Date.now() / 1000 + 600,
          nonce: state.nonce, email: "somchai.s@bumail.net", email_verified: true, hd: "bumail.net",
          ...options.claims
        };
      }
    }
  });
  const link = new URL(service.createLinkUrl("U1")).searchParams.get("link")!;
  const start = service.startGoogleSignIn(link)!;
  const google = new URL(start.redirectUrl);
  state.nonce = google.searchParams.get("nonce")!;
  return { service, binds, link, start, stateParam: google.searchParams.get("state")!, state };
}

const complete = (f: ReturnType<typeof flow>, extra: Record<string, string | undefined> = {}) =>
  f.service.completeGoogleSignIn({ code: "c", state: f.stateParam, stateCookie: f.start.stateCookie, ...extra });

describe("student auth service", () => {
  test("createLinkUrl points at the login page with a valid link token", () => {
    const { service, link } = flow();
    assert.ok(service.createLinkUrl("U1").startsWith(`${appUrl}/login?link=`));
    assert.equal(service.isValidLink(link), true);
    assert.equal(service.isValidLink(`${link}x`), false);
    assert.equal(service.isValidLink(undefined), false);
  });

  test("createLinkUrl asks LINE to open the system browser", () => {
    const { service } = flow();
    assert.equal(new URL(service.createLinkUrl("U1")).searchParams.get("openExternalBrowser"), "1");
  });

  test("startGoogleSignIn sends the Google redirect URI and bumail hd", () => {
    const { start } = flow();
    const url = new URL(start.redirectUrl);
    assert.equal(url.origin, "https://accounts.google.com");
    assert.equal(url.searchParams.get("redirect_uri"), `${appUrl}/api/student/auth/google/callback`);
    assert.equal(url.searchParams.get("hd"), "bumail.net");
  });

  test("startGoogleSignIn returns null for a tampered or expired link", () => {
    const { service, link } = flow();
    assert.equal(service.startGoogleSignIn(`${link}x`), null);
    assert.equal(service.startGoogleSignIn(link, Date.now() + 11 * 60_000), null);
  });

  test("happy path returns a session that readSession accepts", async () => {
    const f = flow();
    const result = await complete(f);
    assert.ok(result.ok);
    assert.equal(result.ok && result.email, "somchai.s@bumail.net");
    assert.deepEqual(f.binds, [{ lineUserId: "U1", email: "somchai.s@bumail.net" }]);
    assert.deepEqual(f.service.readSession(result.ok ? result.sessionToken : undefined), { lineUserId: "U1", email: "somchai.s@bumail.net" });
  });

  test("rejects wrong state", async () => {
    const f = flow();
    assert.equal((await complete(f, { state: "other" })).ok, false);
    assert.equal(f.binds.length, 0);
  });

  test("rejects missing, tampered or expired state cookie", async () => {
    const f = flow();
    assert.equal((await complete(f, { stateCookie: undefined })).ok, false);
    assert.equal((await complete(f, { stateCookie: `${f.start.stateCookie}x` })).ok, false);
    const later = await f.service.completeGoogleSignIn(
      { code: "c", state: f.stateParam, stateCookie: f.start.stateCookie }, Date.now() + 11 * 60_000
    );
    assert.equal(later.ok, false);
  });

  test("rejects Google error and missing code", async () => {
    const f = flow();
    assert.equal((await complete(f, { error: "access_denied" })).ok, false);
    assert.equal((await complete(f, { code: undefined })).ok, false);
  });

  test("rejects nonce mismatch, non-bumail email, unverified email and failed exchange without binding", async () => {
    for (const options of [
      { claims: { nonce: "other" } },
      { claims: { email: "a@gmail.com", hd: undefined } },
      { claims: { email_verified: false } },
      { exchangeFails: true }
    ]) {
      const f = flow(options);
      assert.equal((await complete(f)).ok, false);
      assert.equal(f.binds.length, 0);
    }
  });

  test("rejects line_taken and email_taken bindings", async () => {
    for (const bind of ["line_taken", "email_taken"]) {
      assert.equal((await complete(flow({ bind }))).ok, false);
    }
  });

  test("readSession rejects an oauth-typed token and missing token", () => {
    const { service, start } = flow();
    assert.equal(service.readSession(start.stateCookie), null);
    assert.equal(service.readSession(undefined), null);
  });

  test("unconfigured service starts nothing", () => {
    const service = new Service({ secret: undefined, appUrl });
    assert.equal(service.startGoogleSignIn("anything"), null);
  });
});

describe("student auth controller", () => {
  const origin = "https://app.test";
  const callbackUrl = (query: string) => `${origin}/api/student/auth/google/callback?${query}`;

  test("start redirects to Google and sets a lax state cookie", async () => {
    const { service, link } = flow();
    const response = await new Controller(service).start(new Request(`${origin}/api/student/auth/google/start?t=${link}`));
    assert.equal(response.status, 302);
    assert.ok(response.headers.get("location")?.startsWith("https://accounts.google.com/"));
    const cookie = response.headers.get("set-cookie") ?? "";
    assert.match(cookie, /studymate-student-oauth=/);
    assert.match(cookie, /SameSite=lax/i);
    assert.match(cookie, /HttpOnly/i);
  });

  test("start with a bad link redirects to the failure page", async () => {
    const { service } = flow();
    const response = await new Controller(service).start(new Request(`${origin}/api/student/auth/google/start?t=bad`));
    assert.equal(response.headers.get("location"), `${origin}/login?student=failed`);
    assert.equal(response.headers.get("set-cookie") ?? "", "");
  });

  test("callback success sets the session cookie and redirects to /student", async () => {
    const f = flow();
    const response = await new Controller(f.service).callback(new Request(callbackUrl(`code=c&state=${f.stateParam}`), {
      headers: { cookie: `studymate-student-oauth=${f.start.stateCookie}` }
    }));
    assert.equal(response.status, 303);
    assert.equal(response.headers.get("location"), `${origin}/student`);
    assert.match(response.headers.get("set-cookie") ?? "", /studymate-student=[^;]+/);
  });

  test("callback failure redirects to the failure page without a session cookie", async () => {
    const f = flow();
    for (const query of ["error=access_denied", "", `code=c&state=wrong`]) {
      const response = await new Controller(f.service).callback(new Request(callbackUrl(query), {
        headers: { cookie: `studymate-student-oauth=${f.start.stateCookie}` }
      }));
      assert.equal(response.headers.get("location"), `${origin}/login?student=failed`);
      assert.doesNotMatch(response.headers.get("set-cookie") ?? "", /studymate-student=[^;]/);
    }
  });
});

describe("LINE student link trigger", () => {
  function lineFixture() {
    const sent: { messages: { template?: { actions: { uri: string }[] }; text?: string }[] }[] = [];
    const botCalls: string[] = [];
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async (_url: string, init: { body: string }) => {
      sent.push(JSON.parse(init.body));
      return { ok: true, text: async () => "" };
    }) as unknown as typeof fetch;
    const { service } = flow();
    const controller = new LineController(
      { createBotReply: async ({ message }: { message: string }) => { botCalls.push(message); return { text: "bot" }; } } as never,
      new LinePresenter(),
      { consume: async () => ({ allowed: true }) } as never,
      service
    );
    const send = (text: string) =>
      controller["handleTextMessage"]({ replyToken: "r1", source: { userId: "U1" }, message: { text } } as never);
    return { sent, botCalls, send, restore: () => { globalThis.fetch = realFetch; } };
  }

  test("ยืนยันนักศึกษา replies with a login link button and skips the chat bot", async () => {
    const f = lineFixture();
    try {
      await f.send("  ยืนยันนักศึกษา ");
      assert.deepEqual(f.botCalls, []);
      const message = f.sent[0].messages[0] as { altText?: string; template?: { actions: { type: string; uri: string }[] } };
      assert.equal(message.altText, "ยืนยันนักศึกษา BU");
      assert.equal(message.template?.actions[0].type, "uri");
      assert.ok(message.template?.actions[0].uri.startsWith(`${appUrl}/login?link=`));
    } finally {
      f.restore();
    }
  });

  test("other text still reaches the chat bot", async () => {
    const f = lineFixture();
    try {
      await f.send("สวัสดี");
      assert.deepEqual(f.botCalls, ["สวัสดี"]);
    } finally {
      f.restore();
    }
  });
});
