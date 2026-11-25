import bcrypt from "bcryptjs";
import { randomInt } from "crypto";
import { backend, type Cell, type Row } from "./backend";
import { getSettings, UserError, withLock } from "./portal";
import { ROLE_ADMIN, ROLE_SALES, type Account, type User } from "@/lib/types";

const str = (v: Cell | undefined) => (v === undefined || v === null ? "" : String(v));
const isHash = (v: string) => /^\$2[aby]\$/.test(v);
const TEMP = "temp";

function nowString(): string {
  const d = new Date(Date.now() + 9 * 3600 * 1000);
  return d.toISOString().replace("T", " ").slice(0, 19).replace(/-/g, "/");
}

function toAccount(r: Row): Account {
  const role = parseInt(str(r.role), 10);
  return {
    id: str(r.id),
    name: str(r.name) || str(r.id),
    role: Number.isFinite(role) ? role : ROLE_SALES,
    team: str(r.team).trim(),
    pending: str(r.status) === TEMP,
    updatedAt: str(r.updatedAt),
  };
}

function tempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  return Array.from({ length: 10 }, () => chars[randomInt(chars.length)]).join("");
}

const hash = (pw: string) => bcrypt.hash(pw, 10);

/** Verifies the password; plain-text passwords from older sheets are upgraded to a hash on first login. */
export async function login(userId: string, password: string): Promise<User | null> {
  const { Accounts } = await backend().readMany(["Accounts"]);
  const row = Accounts.rows.find((a) => str(a.id) === userId);
  if (!row) return null;
  const stored = str(row.password);
  if (!stored) return null;
  const okPw = isHash(stored) ? await bcrypt.compare(password, stored) : stored === password;
  if (!okPw) return null;
  if (!isHash(stored)) {
    await withLock(async () => backend().updateCells("Accounts", row._row, { password: await hash(password), updatedAt: nowString() }));
  }
  const a = toAccount(row);
  return { id: a.id, name: a.name, role: a.role, team: a.team, ...(a.pending ? { mustSetPassword: true } : {}) };
}

export async function listAccounts(): Promise<Account[]> {
  const { Accounts } = await backend().readMany(["Accounts"]);
  return Accounts.rows.filter((r) => str(r.id)).map(toAccount);
}

async function cleanTeam(v: unknown): Promise<string> {
  const team = typeof v === "string" ? v.trim().slice(0, 50) : "";
  if (!team) return "";
  const { teams } = await getSettings();
  if (!teams.includes(team)) throw new UserError("チームは管理者設定の「チーム」で登録したものから選んでください。");
  return team;
}

function cleanRole(v: unknown): number {
  return Number(v) === ROLE_ADMIN ? ROLE_ADMIN : ROLE_SALES;
}

function cleanName(v: unknown): string {
  const name = typeof v === "string" ? v.trim().slice(0, 50) : "";
  if (!name) throw new UserError("名前を入力してください。");
  return name;
}

/** Issues a temporary account; the user sets the real password on first login. */
export async function createAccount(input: Record<string, unknown>): Promise<{ account: Account; tempPassword: string }> {
  const name = cleanName(input.name);
  const team = await cleanTeam(input.team);
  const role = cleanRole(input.role);
  const pw = tempPassword();
  const hashed = await hash(pw);
  return withLock(async () => {
    const { Accounts } = await backend().readMany(["Accounts"]);
    const maxNo = Accounts.rows.reduce((max, r) => {
      const m = /^u(\d+)$/.exec(str(r.id));
      return m ? Math.max(max, parseInt(m[1], 10)) : max;
    }, 0);
    const id = `u${String(maxNo + 1).padStart(3, "0")}`;
    const now = nowString();
    await backend().append("Accounts", { id, password: hashed, team, name, role, status: TEMP, updatedAt: now });
    return { account: { id, name, team, role, pending: true, updatedAt: now }, tempPassword: pw };
  });
}

export async function updateAccount(input: Record<string, unknown>, admin: User): Promise<Account> {
  const id = typeof input.id === "string" ? input.id : "";
  const name = cleanName(input.name);
  const team = await cleanTeam(input.team);
  const role = cleanRole(input.role);
  if (id === admin.id && role !== ROLE_ADMIN) throw new UserError("自分自身の管理者権限は外せません。");
  return withLock(async () => {
    const { Accounts } = await backend().readMany(["Accounts"]);
    const row = Accounts.rows.find((r) => str(r.id) === id);
    if (!row) throw new UserError("アカウントが見つかりません。");
    const now = nowString();
    await backend().updateCells("Accounts", row._row, { name, team, role, updatedAt: now });
    return { ...toAccount(row), name, team, role, updatedAt: now };
  });
}

export async function resetPassword(input: Record<string, unknown>): Promise<{ account: Account; tempPassword: string }> {
  const id = typeof input.id === "string" ? input.id : "";
  const pw = tempPassword();
  const hashed = await hash(pw);
  return withLock(async () => {
    const { Accounts } = await backend().readMany(["Accounts"]);
    const row = Accounts.rows.find((r) => str(r.id) === id);
    if (!row) throw new UserError("アカウントが見つかりません。");
    const now = nowString();
    await backend().updateCells("Accounts", row._row, { password: hashed, status: TEMP, updatedAt: now });
    return { account: { ...toAccount(row), pending: true, updatedAt: now }, tempPassword: pw };
  });
}

/** Completes registration: replaces the temporary password with the user's own. */
export async function setOwnPassword(user: User, password: unknown): Promise<User> {
  const pw = typeof password === "string" ? password : "";
  if (pw.length < 8 || pw.length > 72) throw new UserError("パスワードは8文字以上72文字以内で入力してください。");
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) throw new UserError("パスワードには英字と数字の両方を含めてください。");
  const hashed = await hash(pw);
  return withLock(async () => {
    const { Accounts } = await backend().readMany(["Accounts"]);
    const row = Accounts.rows.find((r) => str(r.id) === user.id);
    if (!row) throw new UserError("アカウントが見つかりません。");
    await backend().updateCells("Accounts", row._row, { password: hashed, status: "active", updatedAt: nowString() });
    const a = toAccount(row);
    return { id: a.id, name: a.name, role: a.role, team: a.team };
  });
}
