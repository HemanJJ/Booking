import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

const secret = new TextEncoder().encode(
  process.env.SESSION_SECRET ?? "dev-only-insecure-secret"
);

export const SESSION_COOKIE = "difly_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7; // 7 天

export type SessionMember = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
  lineName: string | null;
  linePictureUrl: string | null;
};

export function sessionCookieOptions(): {
  httpOnly: boolean;
  sameSite: "lax";
  secure: boolean;
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  };
}

/** 簽署 session token（不寫入 cookie，供 route handler 自行掛載） */
export async function signSessionToken(memberId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(memberId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(secret);
}

/** 建立登入 session（寫入 httpOnly cookie，供 Server Action 使用） */
export async function createSession(memberId: string): Promise<void> {
  const token = await signSessionToken(memberId);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, sessionCookieOptions());
}

/** 清除登入 session */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

/** 讀取目前 session 的會員 id（無效或過期回傳 null） */
export async function getSessionMemberId(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return (payload.sub as string) ?? null;
  } catch {
    return null;
  }
}

/** 讀取目前登入會員（未登入回傳 null） */
export async function getCurrentMember(): Promise<SessionMember | null> {
  const id = await getSessionMemberId();
  if (!id) return null;
  return prisma.member.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      lineName: true,
      linePictureUrl: true,
    },
  });
}

/** 讀取目前登入會員（未登入回傳 null；含 role） */
export async function isAdmin(): Promise<boolean> {
  const member = await getCurrentMember();
  return member?.role === "admin";
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export function verifyPassword(
  password: string,
  passwordHash: string
): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}
