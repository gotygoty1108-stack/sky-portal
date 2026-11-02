import { NextResponse } from "next/server";
import { login } from "@/server/portal";
import { clearLoginFailures, isLoginLocked, recordLoginFailure } from "@/server/login-limit";
import { createSessionToken, currentUser, SESSION_COOKIE, sessionCookieOptions } from "@/server/session";
import { fail, ok } from "@/server/route-helpers";
import { SetupError } from "@/server/backend";

export const dynamic = "force-dynamic";

export async function GET() {
  return ok(await currentUser());
}

export async function POST(req: Request) {
  let userId = "";
  let password = "";
  try {
    const body = await req.json();
    userId = typeof body?.userId === "string" ? body.userId.trim() : "";
    password = typeof body?.password === "string" ? body.password : "";
  } catch {
    return fail("リクエストが正しくありません。");
  }
  if (!userId || !password) return fail("IDとパスワードを入力してください。");

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  const key = `${ip}:${userId}`;
  if (isLoginLocked(key)) return fail("ログインに続けて失敗したため、しばらく時間をおいてから再度お試しください。", 429);

  try {
    const user = await login(userId, password);
    if (!user) {
      recordLoginFailure(key);
      return fail("IDまたはパスワードが間違っています。", 401);
    }
    clearLoginFailures(key);
    const res = ok(user);
    res.cookies.set(SESSION_COOKIE, await createSessionToken(user), sessionCookieOptions);
    return res;
  } catch (e) {
    console.error(e);
    if (e instanceof SetupError) return fail(e.message, 500);
    return fail("サーバーでエラーが発生しました。時間をおいて再度お試しください。", 500);
  }
}

export async function DELETE() {
  const res = NextResponse.json({ status: "success", data: null });
  res.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions, maxAge: 0 });
  return res;
}
