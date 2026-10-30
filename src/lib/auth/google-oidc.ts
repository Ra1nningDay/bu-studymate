export type GoogleIdClaims = {
  iss: string;
  aud: string;
  exp: number;
  nonce?: string;
  email?: string;
  email_verified?: boolean;
  hd?: string;
};

const googleIssuers = ["accounts.google.com", "https://accounts.google.com"];

export function googleAuthUrl(p: { clientId: string; redirectUri: string; state: string; nonce: string; hd: string }) {
  const params = new URLSearchParams({
    client_id: p.clientId,
    redirect_uri: p.redirectUri,
    response_type: "code",
    scope: "openid email",
    prompt: "select_account",
    state: p.state,
    nonce: p.nonce,
    hd: p.hd
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function exchangeGoogleCode(p: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  fetchImpl?: typeof fetch;
  now?: number;
}): Promise<GoogleIdClaims> {
  const response = await (p.fetchImpl ?? fetch)("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: p.code,
      client_id: p.clientId,
      client_secret: p.clientSecret,
      redirect_uri: p.redirectUri,
      grant_type: "authorization_code"
    })
  });
  if (!response.ok) throw new Error("Google token exchange failed");
  const { id_token: idToken } = (await response.json()) as { id_token?: string };
  if (!idToken) throw new Error("Google response has no id_token");
  // The token came straight from Google's token endpoint over TLS, so per OIDC Core §3.1.3.7
  // its signature need not be verified; the claims below still are.
  const claims = JSON.parse(Buffer.from(idToken.split(".")[1] ?? "", "base64url").toString()) as GoogleIdClaims;
  if (!googleIssuers.includes(claims.iss)) throw new Error("Unexpected id_token issuer");
  if (claims.aud !== p.clientId) throw new Error("id_token audience mismatch");
  if (!(claims.exp * 1000 > (p.now ?? Date.now()))) throw new Error("id_token expired");
  return claims;
}

export function bumailEmail(claims: GoogleIdClaims, domain: string): string | null {
  const email = claims.email?.toLowerCase();
  const wanted = domain.toLowerCase();
  if (claims.email_verified !== true || claims.hd?.toLowerCase() !== wanted || !email) return null;
  const parts = email.split("@");
  return parts.length === 2 && parts[0] !== "" && parts[1] === wanted ? email : null;
}
