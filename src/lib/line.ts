import { SignJWT, jwtVerify, createRemoteJWKSet } from "jose";
import { randomUUID } from "node:crypto";

const LINE_AUTHORIZE = "https://access.line.me/oauth2/v2.1/authorize";
const LINE_TOKEN = "https://api.line.me/oauth2/v2.1/token";
const LINE_CERTS = "https://access.line.me/oauth2/v2.1/certs";
const LINE_PROFILE = "https://api.line.me/v2/profile";

const secret = new TextEncoder().encode(
  process.env.SESSION_SECRET ?? "dev-only-insecure-secret"
);

function lineEnv() {
  return {
    channelId: process.env.LINE_CHANNEL_ID ?? "",
    channelSecret: process.env.LINE_CHANNEL_SECRET ?? "",
    callbackUrl: process.env.LINE_CALLBACK_URL ?? "",
  };
}

export function isLineConfigured(): boolean {
  const env = lineEnv();
  return Boolean(env.channelId && env.channelSecret && env.callbackUrl);
}

/** 產生 state（內含 nonce，10 分鐘有效）供 LINE 授權使用 */
export async function createLineState(): Promise<{
  state: string;
  nonce: string;
}> {
  const nonce = randomUUID();
  const state = await new SignJWT({ nonce })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(secret);
  return { state, nonce };
}

export async function verifyLineState(state: string): Promise<string> {
  const { payload } = await jwtVerify(state, secret);
  return payload.nonce as string;
}

export function buildLineAuthorizeUrl(state: string, nonce: string): string {
  const env = lineEnv();
  const params = new URLSearchParams({
    response_type: "code",
    client_id: env.channelId,
    redirect_uri: env.callbackUrl,
    state,
    scope: "profile openid",
    nonce,
  });
  return `${LINE_AUTHORIZE}?${params.toString()}`;
}

type LineTokenResponse = {
  access_token: string;
  id_token: string;
  token_type?: string;
  expires_in?: number;
};

/** 用授權碼換取 access_token 與 id_token */
export async function exchangeLineCode(code: string): Promise<LineTokenResponse> {
  const env = lineEnv();
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: env.callbackUrl,
    client_id: env.channelId,
    client_secret: env.channelSecret,
  });
  const res = await fetch(LINE_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    throw new Error(`LINE token exchange failed: ${res.status}`);
  }
  return (await res.json()) as LineTokenResponse;
}

type LineIdTokenPayload = {
  sub: string; // LINE user id
  name?: string;
  picture?: string;
  nonce?: string;
  email?: string;
  iss?: string;
  aud?: string;
};

/** 驗證 id_token 簽章、issuer、audience 與 nonce */
export async function verifyLineIdToken(
  idToken: string,
  nonce: string
): Promise<LineIdTokenPayload> {
  const env = lineEnv();
  const jwks = createRemoteJWKSet(new URL(LINE_CERTS));
  const { payload } = await jwtVerify(idToken, jwks, {
    issuer: "https://access.line.me",
    audience: env.channelId,
  });
  if (payload.nonce !== nonce) {
    throw new Error("LINE nonce mismatch");
  }
  return payload as unknown as LineIdTokenPayload;
}

type LineProfile = {
  userId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
};

/** 取得 LINE 使用者顯示名稱與大頭貼（可選） */
export async function getLineProfile(
  accessToken: string
): Promise<LineProfile | null> {
  const res = await fetch(LINE_PROFILE, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  return (await res.json()) as LineProfile;
}
