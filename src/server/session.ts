import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { User } from "@/lib/types";
import { refreshUser } from "./accounts";

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

/** `v` ties the session to the current password hash, so resets and password changes end older sessions. */
export async function createSessionToken(user: User, v: string): Promise<string> {
  return new SignJWT({ id: user.id, v })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SEC}s`)
    .sign(secret());
}

async function readSession(token: string | undefined): Promise<{ id: string; v: string } | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (typeof payload.id !== "string" || typeof payload.v !== "string") return null;
    return { id: payload.id, v: payload.v };
  } catch {
    return null;
  }
}

export async function currentUser(): Promise<User | null> {
  const store = await cookies();
  const s = await readSession(store.get(SESSION_COOKIE)?.value);
  // Role, team and registration state are re-read from Accounts so admin changes apply immediately.
  return s ? refreshUser(s.id, s.v) : null;
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: MAX_AGE_SEC,
};
