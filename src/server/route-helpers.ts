import { NextResponse } from "next/server";
import { currentUser } from "./session";
import { UserError } from "./portal";
import { SetupError } from "./backend";
import type { User } from "@/lib/types";
import { describeRequest, writeLog } from "./audit-log";

async function responseId(res: NextResponse): Promise<string> {
  try {
    const j = await res.clone().json();
    const d = j?.data;
    return String(d?.id || d?.customer?.id || d?.account?.id || "");
  } catch {
    return "";
  }
}

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ status: "success", data }, init);
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ status: "error", message }, { status });
}

type Handler = (user: User, body: Record<string, unknown>) => Promise<NextResponse>;

export function authed(handler: Handler, opts: { role?: number; allowPending?: boolean } = {}) {
  return async (req: Request) => {
    let user: User | null;
    try {
      user = await currentUser();
    } catch (e) {
      console.error(e);
      return fail(e instanceof SetupError ? e.message : "サーバーでエラーが発生しました。時間をおいて再度お試しください。", 500);
    }
    if (!user) return fail("ログインしてください。", 401);
    if (user.mustSetPassword && !opts.allowPending) return fail("パスワードの本登録を完了してください。", 403);
    if (opts.role !== undefined && user.role !== opts.role) return fail("この操作の権限がありません。", 403);
    let body: Record<string, unknown> = {};
    if (req.method !== "GET") {
      try {
        const parsed = await req.json();
        if (parsed && typeof parsed === "object") body = parsed;
      } catch {
        return fail("リクエストが正しくありません。");
      }
    }
    const log = req.method === "GET" ? null : describeRequest(new URL(req.url).pathname, body);
    const record = (result: string, target = "") =>
      log && writeLog({ userId: user.id, userName: user.name, action: log.action, target: target || log.target, detail: log.detail, result });
    try {
      const res = await handler(user, body);
      record("成功", await responseId(res));
      return res;
    } catch (e) {
      record(`失敗：${e instanceof UserError || e instanceof SetupError ? e.message : "サーバーエラー"}`);
      if (e instanceof UserError) return fail(e.message);
      if (e instanceof SetupError) {
        console.error(e);
        return fail(e.message, 500);
      }
      console.error(e);
      return fail("サーバーでエラーが発生しました。時間をおいて再度お試しください。", 500);
    }
  };
}
