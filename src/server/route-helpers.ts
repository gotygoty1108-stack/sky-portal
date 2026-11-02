import { NextResponse } from "next/server";
import { currentUser } from "./session";
import { UserError } from "./portal";
import type { User } from "@/lib/types";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ status: "success", data }, init);
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ status: "error", message }, { status });
}

type Handler = (user: User, body: Record<string, unknown>) => Promise<NextResponse>;

export function authed(handler: Handler, opts: { role?: number } = {}) {
  return async (req: Request) => {
    const user = await currentUser();
    if (!user) return fail("ログインしてください。", 401);
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
    try {
      return await handler(user, body);
    } catch (e) {
      if (e instanceof UserError) return fail(e.message);
      console.error(e);
      return fail("サーバーでエラーが発生しました。時間をおいて再度お試しください。", 500);
    }
  };
}
