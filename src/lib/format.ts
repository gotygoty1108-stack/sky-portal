const YMD = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;

export function toTime(value: string | undefined | null): number {
  if (!value) return 0;
  const m = YMD.exec(value.trim());
  if (m) {
    const [, y, mo, d, h = "0", mi = "0", s = "0"] = m;
    return new Date(+y, +mo - 1, +d, +h, +mi, +s).getTime();
  }
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? 0 : t;
}

export function formatDate(value: string | undefined | null): string {
  const t = toTime(value);
  if (!t) return value || "";
  const d = new Date(t);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

export function yen(value: number | string | undefined | null): string {
  const n = Number(value);
  return Number.isFinite(n) ? `¥${n.toLocaleString("ja-JP")}` : "¥0";
}

export function todayInput(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function byNewest<T extends { date?: string; createdAt?: string }>(a: T, b: T): number {
  return toTime(b.date) - toTime(a.date) || toTime(b.createdAt) - toTime(a.createdAt);
}

/** "2026/10/05" or "2026-10-05 10:00" → "2026-10-05" for <input type="date">. */
export function toInputDate(value: string | undefined | null): string {
  const t = toTime(value);
  if (!t) return "";
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function addDaysInput(days: number): string {
  const d = new Date(Date.now() + days * 86400000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
