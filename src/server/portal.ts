import { backend, type Cell, type Row } from "./backend";
import {
  CUSTOMER_STATUSES,
  ESTIMATE_TYPES,
  ROLE_ADMIN,
  type Contract,
  type Customer,
  type CustomerBase,
  type CustomerFields,
  type CustomerRecord,
  type Estimate,
  type EstimateDetail,
  type User,
} from "@/lib/types";
import { byNewest } from "@/lib/format";

export class UserError extends Error {}

let queue: Promise<unknown> = Promise.resolve();
// Serializes writes inside this process so ID numbering does not collide.
function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
}

const str = (v: Cell | undefined) => (v === undefined || v === null ? "" : String(v));
const num = (v: Cell | undefined) => {
  const n = Number(typeof v === "string" ? v.replace(/[¥,\s]/g, "") : v);
  return Number.isFinite(n) ? n : 0;
};

function nowString(): string {
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value || "00";
  return `${get("year")}/${get("month")}/${get("day")} ${get("hour")}:${get("minute")}:${get("second")}`;
}

function cleanText(v: unknown, max = 200): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function cleanDate(v: unknown): string {
  const s = cleanText(v, 40);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return `${m[1]}/${m[2]}/${m[3]}`;
  if (/^\d{4}\/\d{2}\/\d{2}/.test(s)) return s;
  return nowString().slice(0, 10);
}

function cleanAmount(v: unknown): number {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n) || n < 0 || n > 10_000_000_000) throw new UserError("金額が正しくありません。");
  return n;
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, "0")}`;
}

function toCustomerBase(r: Row): CustomerBase {
  return {
    id: str(r.id),
    name: str(r.name),
    kana: str(r.kana),
    contactPerson: str(r.contactPerson),
    email: str(r.email),
    phone: str(r.phone),
    address: str(r.address),
    status: str(r.status),
    createdAt: str(r.createdAt),
    updatedAt: str(r.updatedAt),
    team: str(r.team),
  };
}

const isAdmin = (user: User) => user.role === ROLE_ADMIN;
// Sales accounts only see customers of their own team; admins see everything.
const canAccess = (r: Row, user: User) => isAdmin(user) || str(r.team).trim() === user.team;

function parseDetails(v: Cell | undefined): EstimateDetail[] {
  try {
    const parsed = JSON.parse(str(v) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ---------- login ----------

export async function login(userId: string, password: string): Promise<User | null> {
  const { Accounts } = await backend().readMany(["Accounts"]);
  const account = Accounts.rows.find((a) => str(a.id) === userId && str(a.password) === password);
  if (!account) return null;
  const role = parseInt(str(account.role), 10);
  return {
    id: str(account.id),
    name: str(account.name) || str(account.id),
    role: Number.isFinite(role) ? role : 1,
    team: str(account.team).trim(),
  };
}

// ---------- read ----------

export async function getInitialData(user: User): Promise<Customer[]> {
  const t = await backend().readMany(["Customers", "Records", "Estimates", "Contracts"]);
  const group = <T extends { customerId: string; date: string; createdAt: string }>(items: T[]) => {
    const map = new Map<string, T[]>();
    for (const it of items) {
      const list = map.get(it.customerId) || [];
      list.push(it);
      map.set(it.customerId, list);
    }
    for (const list of map.values()) list.sort(byNewest);
    return map;
  };

  const records = group<CustomerRecord>(
    t.Records.rows.map((r) => ({
      id: str(r.id),
      customerId: str(r.customerId),
      date: str(r.date),
      title: str(r.title),
      content: str(r.content),
      createdAt: str(r.createdAt),
    })),
  );
  const estimates = group<Estimate>(
    t.Estimates.rows.map((r) => ({
      id: str(r.id),
      customerId: str(r.customerId),
      date: str(r.date),
      title: str(r.title),
      amount: num(r.amount),
      type: str(r.type),
      details: parseDetails(r.details),
      createdAt: str(r.createdAt),
    })),
  );
  const contracts = group<Contract>(
    t.Contracts.rows.map((r) => ({
      id: str(r.id),
      customerId: str(r.customerId),
      date: str(r.date),
      title: str(r.title),
      amount: num(r.amount),
      createdAt: str(r.createdAt),
    })),
  );

  return t.Customers.rows
    .filter((r) => str(r.id) && canAccess(r, user))
    .map((r) => {
      const c = toCustomerBase(r);
      return {
        ...c,
        records: records.get(c.id) || [],
        estimates: estimates.get(c.id) || [],
        contracts: contracts.get(c.id) || [],
      };
    })
    .reverse();
}

// ---------- write ----------

function cleanCustomerFields(input: Record<string, unknown>, user: User): CustomerFields {
  const fields: CustomerFields = {
    name: cleanText(input.name),
    kana: cleanText(input.kana),
    contactPerson: cleanText(input.contactPerson),
    email: cleanText(input.email),
    phone: cleanText(input.phone, 50),
    address: cleanText(input.address, 300),
    status: cleanText(input.status, 20),
    team: isAdmin(user) ? cleanText(input.team, 50) : user.team,
  };
  if (!fields.name) throw new UserError("企業名を入力してください。");
  if (!fields.contactPerson) throw new UserError("担当者名を入力してください。");
  if (!(CUSTOMER_STATUSES as readonly string[]).includes(fields.status)) fields.status = CUSTOMER_STATUSES[0];
  return fields;
}

export function saveCustomer(input: Record<string, unknown>, user: User): Promise<{ customer: CustomerBase; isNew: boolean }> {
  const fields = cleanCustomerFields(input, user);
  const id = cleanText(input.id, 50);
  return withLock(async () => {
    const { Customers } = await backend().readMany(["Customers"]);
    const now = nowString();
    if (!id) {
      const maxNo = Customers.rows.reduce((max, r) => {
        const m = /^C-(\d+)$/.exec(str(r.id));
        return m ? Math.max(max, parseInt(m[1], 10)) : max;
      }, 0);
      const customer: CustomerBase = {
        id: `C-${String(maxNo + 1).padStart(3, "0")}`,
        ...fields,
        createdAt: now,
        updatedAt: now,
      };
      await backend().append("Customers", customer);
      return { customer, isNew: true };
    }
    const row = Customers.rows.find((r) => str(r.id) === id);
    if (!row || !canAccess(row, user)) throw new UserError("対象の顧客データが見つかりません。");
    await backend().updateCells("Customers", row._row, { ...fields, updatedAt: now });
    return { customer: { ...toCustomerBase(row), ...fields, updatedAt: now }, isNew: false };
  });
}

async function assertCustomer(customerId: string, user: User) {
  const { Customers } = await backend().readMany(["Customers"]);
  if (!Customers.rows.some((r) => str(r.id) === customerId && canAccess(r, user))) throw new UserError("対象の顧客データが見つかりません。");
}

export async function addRecord(input: Record<string, unknown>, user: User): Promise<CustomerRecord> {
  const customerId = cleanText(input.customerId, 50);
  const title = cleanText(input.title);
  const content = cleanText(input.content, 5000);
  if (!title) throw new UserError("件名を入力してください。");
  await assertCustomer(customerId, user);
  const record: CustomerRecord = {
    id: newId("R"),
    customerId,
    date: cleanDate(input.date),
    title,
    content,
    createdAt: nowString(),
  };
  await withLock(() => backend().append("Records", record));
  return record;
}

function cleanDetails(v: unknown): EstimateDetail[] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, 50).map((d) => ({
    name: cleanText(d?.name),
    amount: typeof d?.amount === "number" ? d.amount : cleanText(d?.amount, 20),
    qty: Number(d?.qty) || 0,
    unit: cleanText(d?.unit, 10),
    subtotal: Number(d?.subtotal) || 0,
  }));
}

export async function saveEstimate(input: Record<string, unknown>, user: User): Promise<Estimate> {
  const customerId = cleanText(input.customerId, 50);
  const type = cleanText(input.type, 10);
  if (!(ESTIMATE_TYPES as readonly string[]).includes(type)) throw new UserError("見積の種類が正しくありません。");
  if (type === "本見積" && user.role !== ROLE_ADMIN) throw new UserError("本見積の登録は管理者のみ可能です。");
  const title = cleanText(input.title) || (type === "仮見積" ? "空撮業務 仮見積もり" : "");
  if (!title) throw new UserError("件名を入力してください。");
  await assertCustomer(customerId, user);
  const estimate: Estimate = {
    id: newId("E"),
    customerId,
    date: cleanDate(input.date),
    title,
    amount: cleanAmount(input.amount),
    type,
    details: cleanDetails(input.details),
    createdAt: nowString(),
  };
  await withLock(() => backend().append("Estimates", { ...estimate, details: JSON.stringify(estimate.details) }));
  return estimate;
}

export async function saveContract(input: Record<string, unknown>, user: User): Promise<Contract> {
  const customerId = cleanText(input.customerId, 50);
  const title = cleanText(input.title);
  if (!title) throw new UserError("件名を入力してください。");
  await assertCustomer(customerId, user);
  const contract: Contract = {
    id: newId("K"),
    customerId,
    date: cleanDate(input.date),
    title,
    amount: cleanAmount(input.amount),
    createdAt: nowString(),
  };
  await withLock(() => backend().append("Contracts", contract));
  return contract;
}
