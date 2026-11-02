import type { ApiResult } from "./types";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: init?.method || (init?.body ? "POST" : "GET"),
      headers: init?.body ? { "Content-Type": "application/json" } : undefined,
      body: init?.body ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
      credentials: "same-origin",
    });
  } catch {
    throw new ApiError("通信できませんでした。電波状況を確認してください。", 0);
  }
  let json: ApiResult<T> | null = null;
  try {
    json = (await res.json()) as ApiResult<T>;
  } catch {
    // non-JSON (e.g. offline fallback page)
  }
  if (!json) throw new ApiError("サーバーから正しい応答がありませんでした。", res.status);
  if (json.status !== "success") throw new ApiError(json.message, res.status);
  return json.data;
}
