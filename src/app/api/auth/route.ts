import { NextResponse } from "next/server";
import { login } from "@/server/accounts";
import { clearLoginFailures, isLoginLocked, recordLoginFailure } from "@/server/login-limit";
import { createSessionToken, currentUser, SESSION_COOKIE, sessionCookieOptions } from "@/server/session";
import { fail, ok } from "@/server/route-helpers";
import { SetupError } from "@/server/backend";
import { writeLog } from "@/server/audit-log";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return ok(await currentUser());
  } catch (e) {
    console.error(e);
    return fail(e instanceof SetupError ? e.message : "サーバーでエラーが発生しました。時間をおいて再度お試しください。", 500);
  }
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
  if (isLoginLocked(key)) {
    writeLog({ userId, action: "ログイン", detail: ip, result: "失敗：ロック中" });
    return fail("ログインに続けて失敗したため、しばらく時間をおいてから再度お試しください。", 429);
  }

  try {
    const result = await login(userId, password);
    if (!result) {
      recordLoginFailure(key);
      writeLog({ userId, action: "ログイン", detail: ip, result: "失敗：IDまたはパスワード違い" });
      return fail("IDまたはパスワードが間違っています。", 401);
    }
    clearLoginFailures(key);
    writeLog({ userId: result.user.id, userName: result.user.name, action: "ログイン", detail: ip, result: result.user.mustSetPassword ? "成功（仮パスワード）" : "成功" });
    const res = ok(result.user);
    res.cookies.set(SESSION_COOKIE, await createSessionToken(result.user, result.v), sessionCookieOptions);
    return res;
  } catch (e) {
    console.error(e);
    if (e instanceof SetupError) return fail(e.message, 500);
    return fail("サーバーでエラーが発生しました。時間をおいて再度お試しください。", 500);
  }
}

export async function DELETE() {
  const user = await currentUser().catch(() => null);
  if (user) writeLog({ userId: user.id, userName: user.name, action: "ログアウト", result: "成功" });
  const res = NextResponse.json({ status: "success", data: null });
  res.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions, maxAge: 0 });
  return res;
}
