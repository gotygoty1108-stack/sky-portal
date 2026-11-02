import { promises as fs } from "fs";
import path from "path";
import { JWT } from "google-auth-library";

export type Cell = string | number | boolean;
export type Row = Record<string, Cell> & { _row: number };
export type Table = { headers: string[]; rows: Row[] };

export const SHEET_HEADERS = {
  Accounts: ["id", "password", "team", "name", "role"],
  Customers: ["id", "name", "kana", "contactPerson", "email", "phone", "address", "status", "createdAt", "updatedAt", "team"],
  Records: ["id", "customerId", "date", "title", "content", "createdAt"],
  Estimates: ["id", "customerId", "date", "title", "amount", "type", "details", "createdAt"],
  Contracts: ["id", "customerId", "date", "title", "amount", "createdAt"],
} as const;

export type SheetName = keyof typeof SHEET_HEADERS;

// Misconfiguration of the spreadsheet; the message is shown to the user as-is.
export class SetupError extends Error {}

export interface Backend {
  readMany(names: SheetName[]): Promise<Record<string, Table>>;
  append(name: SheetName, values: Record<string, Cell>): Promise<void>;
  updateCells(name: SheetName, row: number, values: Record<string, Cell>): Promise<void>;
}

function toTable(grid: Cell[][]): Table {
  const headers = (grid[0] || []).map((h) => String(h).trim());
  const rows: Row[] = [];
  for (let i = 1; i < grid.length; i++) {
    const src = grid[i] || [];
    if (src.every((v) => v === "" || v === undefined || v === null)) continue;
    const row = { _row: i + 1 } as Row;
    headers.forEach((h, j) => {
      if (h) row[h] = src[j] ?? "";
    });
    rows.push(row);
  }
  return { headers, rows };
}

function colLetter(index: number): string {
  let n = index + 1;
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

const quote = (title: string) => `'${title.replace(/'/g, "''")}'`;

// ---------- Google Sheets ----------

const API = "https://sheets.googleapis.com/v4/spreadsheets";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

class SheetsBackend implements Backend {
  private jwt: JWT | null = null;
  private ready: Promise<void> | null = null;
  private headerCache = new Map<string, string[]>();

  private get id(): string {
    const id = process.env.SPREADSHEET_ID;
    if (!id) throw new Error("SPREADSHEET_ID is not set");
    return id;
  }

  private client(): JWT {
    if (this.jwt) return this.jwt;
    const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not set");
    const creds = JSON.parse(raw) as { client_email: string; private_key: string };
    this.jwt = new JWT({
      email: creds.client_email,
      key: creds.private_key,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    return this.jwt;
  }

  // Retries rate-limit (429) and transient 5xx responses with exponential backoff.
  private async api<T>(pathAndQuery: string, init?: RequestInit): Promise<T> {
    for (let attempt = 1; ; attempt++) {
      const { token } = await this.client().getAccessToken();
      const res = await fetch(`${API}/${this.id}${pathAndQuery}`, {
        ...init,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        cache: "no-store",
      });
      if (res.ok) return (await res.json()) as T;
      if (res.status === 403) {
        throw new SetupError("スプレッドシートを編集する権限がありません。サービスアカウントのメールアドレスを「編集者」として共有してください。");
      }
      if (res.status === 404) throw new SetupError("スプレッドシートが見つかりません。SPREADSHEET_ID を確認してください。");
      const retryable = res.status === 429 || res.status >= 500;
      if (!retryable || attempt >= 4) throw new Error(`Sheets API ${res.status}: ${await res.text()}`);
      await res.body?.cancel();
      await sleep(1000 * 2 ** (attempt - 1) + Math.random() * 300);
    }
  }

  // Equivalent of setupSheets() in the GAS version: create missing sheets with header rows.
  private ensureSheets(): Promise<void> {
    if (!this.ready) {
      this.ready = (async () => {
        const meta = await this.api<{ sheets: { properties: { title: string } }[] }>("?fields=sheets.properties.title");
        const existing = new Set(meta.sheets.map((s) => s.properties.title));
        const missing = (Object.keys(SHEET_HEADERS) as SheetName[]).filter((n) => !existing.has(n));
        if (missing.length === 0) return;
        await this.api(":batchUpdate", {
          method: "POST",
          body: JSON.stringify({
            requests: missing.map((title) => ({
              addSheet: { properties: { title, gridProperties: { frozenRowCount: 1 } } },
            })),
          }),
        });
        await this.api("/values:batchUpdate", {
          method: "POST",
          body: JSON.stringify({
            valueInputOption: "RAW",
            data: missing.map((n) => ({ range: `${quote(n)}!A1`, values: [SHEET_HEADERS[n]] })),
          }),
        });
      })().catch((e) => {
        this.ready = null;
        throw e;
      });
    }
    return this.ready;
  }

  async readMany(names: SheetName[]): Promise<Record<string, Table>> {
    await this.ensureSheets();
    const params = new URLSearchParams({
      valueRenderOption: "UNFORMATTED_VALUE",
      dateTimeRenderOption: "FORMATTED_STRING",
      majorDimension: "ROWS",
    });
    names.forEach((n) => params.append("ranges", quote(n)));
    const data = await this.api<{ valueRanges: { values?: Cell[][] }[] }>(`/values:batchGet?${params}`);
    const out: Record<string, Table> = {};
    for (const [i, n] of names.entries()) {
      const table = toTable(data.valueRanges[i]?.values || []);
      table.headers = await this.ensureHeaders(n, table.headers);
      out[n] = table;
      this.headerCache.set(n, table.headers);
    }
    return out;
  }

  // Sheets created by hand may have an empty first row or lack newer columns (e.g. team).
  // Without the header row, values could not be mapped to columns and appends would write blank rows.
  private async ensureHeaders(name: SheetName, headers: string[]): Promise<string[]> {
    const expected: readonly string[] = SHEET_HEADERS[name];
    const used = headers.filter(Boolean);
    if (used.length > 0 && !used.includes("id")) {
      throw new SetupError(`「${name}」シートの1行目に見出し（${expected.join(", ")}）がありません。1行目に見出しを入力してください。`);
    }
    const missing = expected.filter((h) => !used.includes(h));
    if (missing.length === 0) return headers;
    const start = used.length === 0 ? 0 : headers.length;
    await this.api("/values:batchUpdate", {
      method: "POST",
      body: JSON.stringify({
        valueInputOption: "RAW",
        data: [{ range: `${quote(name)}!${colLetter(start)}1`, values: [missing] }],
      }),
    });
    return [...headers.slice(0, start), ...missing];
  }

  private async headers(name: SheetName): Promise<string[]> {
    const cached = this.headerCache.get(name);
    if (cached && cached.length) return cached;
    const t = await this.readMany([name]);
    return t[name].headers;
  }

  async append(name: SheetName, values: Record<string, Cell>): Promise<void> {
    await this.ensureSheets();
    const headers = await this.headers(name);
    const row = headers.map((h) => values[h] ?? "");
    await this.api(
      `/values/${encodeURIComponent(`${quote(name)}!A1`)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      { method: "POST", body: JSON.stringify({ values: [row] }) },
    );
  }

  async updateCells(name: SheetName, row: number, values: Record<string, Cell>): Promise<void> {
    const headers = await this.headers(name);
    const data = Object.entries(values)
      .map(([k, v]) => ({ col: headers.indexOf(k), v }))
      .filter(({ col }) => col >= 0)
      .map(({ col, v }) => ({ range: `${quote(name)}!${colLetter(col)}${row}`, values: [[v]] }));
    if (data.length === 0) return;
    await this.api("/values:batchUpdate", {
      method: "POST",
      body: JSON.stringify({ valueInputOption: "RAW", data }),
    });
  }
}

// ---------- Local mock (development only) ----------

const MOCK_FILE = path.join(process.cwd(), ".data", "mock-db.json");

function mockSeed(): Record<string, Cell[][]> {
  return {
    Accounts: [[...SHEET_HEADERS.Accounts], ["admin", "admin123", "", "システム管理者", 2], ["sales", "sales123", "A", "営業担当者", 1], ["sales2", "sales123", "B", "営業担当者B", 1]],
    Customers: [
      [...SHEET_HEADERS.Customers],
      ["C-001", "モック株式会社", "モックカブシキガイシャ", "テスト 太郎", "test@example.com", "03-1234-5678", "東京都新宿区", "提案中", "2026/10/01 10:00", "2026/10/01 10:00", "A"],
    ],
    Records: [[...SHEET_HEADERS.Records], ["R-1", "C-001", "2026/10/05", "初回打ち合わせ", "空撮の要望をヒアリング。", "2026/10/05 15:00"]],
    Estimates: [[...SHEET_HEADERS.Estimates]],
    Contracts: [[...SHEET_HEADERS.Contracts]],
  };
}

class MockBackend implements Backend {
  private db: Record<string, Cell[][]> | null = null;

  private async load(): Promise<Record<string, Cell[][]>> {
    if (this.db) return this.db;
    try {
      this.db = JSON.parse(await fs.readFile(MOCK_FILE, "utf8"));
    } catch {
      this.db = mockSeed();
    }
    return this.db!;
  }

  private async save() {
    await fs.mkdir(path.dirname(MOCK_FILE), { recursive: true });
    await fs.writeFile(MOCK_FILE, JSON.stringify(this.db, null, 2));
  }

  async readMany(names: SheetName[]) {
    const db = await this.load();
    const out: Record<string, Table> = {};
    for (const n of names) out[n] = toTable(db[n] || [[...SHEET_HEADERS[n]]]);
    return out;
  }

  async append(name: SheetName, values: Record<string, Cell>) {
    const db = await this.load();
    db[name] ||= [[...SHEET_HEADERS[name]]];
    db[name].push(db[name][0].map((h) => values[String(h)] ?? ""));
    await this.save();
  }

  async updateCells(name: SheetName, row: number, values: Record<string, Cell>) {
    const db = await this.load();
    const grid = db[name];
    const headers = grid[0].map(String);
    for (const [k, v] of Object.entries(values)) {
      const col = headers.indexOf(k);
      if (col >= 0 && grid[row - 1]) grid[row - 1][col] = v;
    }
    await this.save();
  }
}

let instance: Backend | null = null;

export function backend(): Backend {
  if (!instance) {
    if (process.env.USE_MOCK_DATA === "1") {
      if (process.env.VERCEL_ENV === "production") throw new Error("USE_MOCK_DATA must not be set in production");
      instance = new MockBackend();
    } else {
      instance = new SheetsBackend();
    }
  }
  return instance;
}
