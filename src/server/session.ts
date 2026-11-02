import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { User } from "@/lib/types";

export const SESSION_COOKIE = "sky_session";
const MAX_AGE_SEC = 60 * 60 * 24 * 14;

function secret(): Uint8Array {
  const value = process.env.SESSION_SECRET;
  if (!value) {
    if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET is not set");
    return new TextEncoder().encode("dev-only-insecure-session-secret");
  }
  return new TextEncoder().encode(value);
}

export async function createSessionToken(user: User): Promise<string> {
  return new SignJWT({ id: user.id, name: user.name, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SEC}s`)
    .sign(secret());
}

export async function readSession(token: string | undefined): Promise<User | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (typeof payload.id !== "string" || typeof payload.name !== "string" || typeof payload.role !== "number") {
      return null;
    }
    return { id: payload.id, name: payload.name, role: payload.role };
  } catch {
    return null;
  }
}

export async function currentUser(): Promise<User | null> {
  const store = await cookies();
  return readSession(store.get(SESSION_COOKIE)?.value);
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: MAX_AGE_SEC,
};
