import { after } from "next/server";
import { logBackend } from "./backend";
import { nowString } from "./portal";

export type LogEntry = { userId: string; userName?: string; action: string; target?: string; detail?: string; result: string };

/** Appends to the log spreadsheet after the response is sent; failures never affect the request. */
export function writeLog(entry: LogEntry) {
  const b = logBackend();
  if (!b) return;
  const values = { at: nowString(), userName: "", target: "", detail: "", ...entry };
  after(async () => {
    try {
      await b.append("Logs", values);
    } catch (e) {
      console.error("log write failed", e);
    }
  });
}

const ACTIONS: Record<string, string> = {
  "/api/customers": "顧客情報保存",
  "/api/records": "業務請負記録保存",
  "/api/estimates": "見積保存",
  "/api/contracts": "契約保存",
  "/api/settings": "管理者設定保存",
  "/api/accounts": "アカウント操作",
  "/api/auth/password": "パスワード登録",
};

const ACCOUNT_ACTIONS: Record<string, string> = { create: "アカウント作成", update: "アカウント編集", reset: "パスワード初期化" };

const s = (v: unknown) => (typeof v === "string" || typeof v === "number" ? String(v) : "");

export function describeRequest(pathname: string, body: Record<string, unknown>): { action: string; target: string; detail: string } {
  let action = ACTIONS[pathname] || pathname;
  if (pathname === "/api/accounts") action = ACCOUNT_ACTIONS[s(body.action)] || action;
  if (pathname === "/api/estimates" && body.type) action = `${s(body.type)}保存`;
  if (pathname === "/api/contracts" && body.confirm) action = "契約確定";
  const target = s(body.id) || s(body.newId) || s(body.customerId);
  const [oldId, newId] = [s(body.id).trim(), s(body.newId).trim()];
  const renamed = newId && newId !== oldId ? `ID変更：${oldId}→${newId}` : "";
  const detail = [renamed, s(body.name), s(body.title)].filter(Boolean).join(" / ").slice(0, 200);
  return { action, target, detail };
}
