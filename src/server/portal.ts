import { backend, type Cell, type Row } from "./backend";
import {
  CUSTOMER_STATUSES,
  computeStatus,
  ESTIMATE_TYPES,
  ROLE_ADMIN,
  type Contract,
  type ContractStatus,
  type Customer,
  type CustomerBase,
  type CustomerFields,
  type CustomerRecord,
  type Estimate,
  type EstimateDetail,
  type Flight,
  type User,
} from "@/lib/types";
import { byNewest } from "@/lib/format";
import {
  adjustRange,
  FLOW_CATEGORIES,
  parseConfig,
  sumLines,
  worstVerdict,
  type ContractData,
  type EstimateConfig,
  type EstimateData,
  type FlowAnswer,
  type Line,
  type PriceGroup,
  type Verdict,
} from "@/lib/estimate";

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

function parseJson<T>(v: Cell | undefined): T | null {
  try {
    const parsed = JSON.parse(str(v));
    return parsed && typeof parsed === "object" ? (parsed as T) : null;
  } catch {
    return null;
  }
}

function toEstimate(r: Row): Estimate {
  const details = parseDetails(r.details);
  const data = parseJson<EstimateData>(r.data) || {
    // Estimates saved before the workflow existed only have `details`.
    lines: details.map((d) => ({
      name: d.name,
      unitPrice: typeof d.amount === "number" ? d.amount : 0,
      qty: d.qty,
      unit: d.unit,
    })),
  };
  return {
    id: str(r.id),
    customerId: str(r.customerId),
    date: str(r.date),
    title: str(r.title),
    amount: num(r.amount),
    type: str(r.type),
    details,
    sourceId: str(r.sourceId),
    data: { ...data, lines: Array.isArray(data.lines) ? data.lines : [] },
    createdAt: str(r.createdAt),
    updatedAt: str(r.updatedAt),
  };
}

function toRecord(r: Row): CustomerRecord {
  const data = parseJson<{ flights?: Flight[] }>(r.data);
  return {
    id: str(r.id),
    customerId: str(r.customerId),
    date: str(r.date),
    title: str(r.title),
    content: str(r.content),
    contractId: str(r.contractId),
    flights: Array.isArray(data?.flights) ? data.flights : [],
    createdAt: str(r.createdAt),
    updatedAt: str(r.updatedAt),
  };
}

function toContract(r: Row): Contract {
  return {
    id: str(r.id),
    customerId: str(r.customerId),
    date: str(r.date),
    title: str(r.title),
    amount: num(r.amount),
    estimateId: str(r.estimateId),
    status: str(r.status) === "confirmed" ? "confirmed" : "draft",
    data: parseJson<ContractData>(r.data),
    createdAt: str(r.createdAt),
    updatedAt: str(r.updatedAt),
    confirmedAt: str(r.confirmedAt),
  };
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

  const records = group<CustomerRecord>(t.Records.rows.filter((r) => str(r.id)).map(toRecord));
  const estimates = group<Estimate>(t.Estimates.rows.filter((r) => str(r.id)).map(toEstimate));
  const contracts = group<Contract>(t.Contracts.rows.filter((r) => str(r.id)).map(toContract));

  return t.Customers.rows
    .filter((r) => str(r.id) && canAccess(r, user))
    .map((r) => {
      const c = toCustomerBase(r);
      const docs = { records: records.get(c.id) || [], estimates: estimates.get(c.id) || [], contracts: contracts.get(c.id) || [] };
      return { ...c, ...docs, status: computeStatus(docs) };
    })
    .reverse();
}

// ---------- write ----------

// Keeps the status column in the sheet in sync with the documents (call inside withLock after a write).
async function refreshCustomerStatus(customerId: string) {
  const t = await backend().readMany(["Customers", "Records", "Estimates", "Contracts"]);
  const row = t.Customers.rows.find((r) => str(r.id) === customerId);
  if (!row) return;
  const of = (rows: Row[]) => rows.filter((r) => str(r.customerId) === customerId);
  const status = computeStatus({
    estimates: of(t.Estimates.rows).map((r) => ({ type: str(r.type) })),
    contracts: of(t.Contracts.rows).map((r) => ({ status: str(r.status), confirmedAt: str(r.confirmedAt) })),
    records: of(t.Records.rows).map((r) => ({ createdAt: str(r.createdAt) })),
  });
  if (str(row.status) !== status) await backend().updateCells("Customers", row._row, { status });
}

function cleanCustomerFields(input: Record<string, unknown>, user: User): CustomerFields {
  const fields: CustomerFields = {
    name: cleanText(input.name),
    kana: cleanText(input.kana),
    contactPerson: cleanText(input.contactPerson),
    email: cleanText(input.email),
    phone: cleanText(input.phone, 50),
    address: cleanText(input.address, 300),
    status: CUSTOMER_STATUSES[0],
    team: isAdmin(user) ? cleanText(input.team, 50) : user.team,
  };
  if (!fields.name) throw new UserError("企業名を入力してください。");
  if (!fields.contactPerson) throw new UserError("担当者名を入力してください。");
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
    const { status: _status, ...editable } = fields;
    void _status;
    await backend().updateCells("Customers", row._row, { ...editable, updatedAt: now });
    return { customer: { ...toCustomerBase(row), ...editable, updatedAt: now }, isNew: false };
  });
}

async function assertCustomer(customerId: string, user: User) {
  const { Customers } = await backend().readMany(["Customers"]);
  if (!Customers.rows.some((r) => str(r.id) === customerId && canAccess(r, user))) throw new UserError("対象の顧客データが見つかりません。");
}

function cleanFlights(v: unknown): Flight[] {
  if (!Array.isArray(v)) return [];
  return v
    .slice(0, 200)
    .filter((f) => f && typeof f === "object")
    .map((f) => {
      const time = (t: unknown) => (/^\d{1,2}:\d{2}$/.test(cleanText(t, 5)) ? cleanText(t, 5) : "");
      const minutes = Math.round(Number(f.minutes));
      return {
        date: cleanText(f.date, 20),
        place: cleanText(f.place, 300),
        startTime: time(f.startTime),
        endTime: time(f.endTime),
        minutes: Number.isFinite(minutes) ? Math.min(1440, Math.max(0, minutes)) : 0,
        content: cleanText(f.content, 2000),
      };
    });
}

export async function saveRecord(input: Record<string, unknown>, user: User): Promise<CustomerRecord> {
  const id = cleanText(input.id, 50);
  const title = cleanText(input.title);
  const content = cleanText(input.content, 10000);
  if (!title) throw new UserError("件名を入力してください。");
  const flights = cleanFlights(input.flights);
  const date = cleanDate(input.date);
  const now = nowString();
  return withLock(async () => {
    if (id) {
      const { Records } = await backend().readMany(["Records"]);
      const row = Records.rows.find((r) => str(r.id) === id);
      if (!row) throw new UserError("対象の記録が見つかりません。");
      const current = toRecord(row);
      await assertCustomer(current.customerId, user);
      await backend().updateCells("Records", row._row, { date, title, content, data: JSON.stringify({ flights }), updatedAt: now });
      return { ...current, date, title, content, flights, updatedAt: now };
    }
    const customerId = cleanText(input.customerId, 50);
    await assertCustomer(customerId, user);
    const record: CustomerRecord = {
      id: newId("R"),
      customerId,
      date,
      title,
      content,
      contractId: cleanText(input.contractId, 50),
      flights,
      createdAt: now,
      updatedAt: now,
    };
    await backend().append("Records", { ...record, flights: "", data: JSON.stringify({ flights }) });
    await refreshCustomerStatus(customerId);
    return record;
  });
}

// ---------- settings ----------

const CONFIG_KEY = "estimateConfig";

export async function getSettings(): Promise<EstimateConfig> {
  const { Settings } = await backend().readMany(["Settings"]);
  const row = Settings.rows.find((r) => str(r.key) === CONFIG_KEY);
  return parseConfig(row ? parseJson(row.value) : null);
}

const VERDICTS: Verdict[] = ["ok", "permit", "ng"];
const GROUPS: PriceGroup[] = ["base", "option", "flow"];
const cleanId = (v: unknown) => cleanText(v, 40).replace(/[^\w-]/g, "");
const cleanNum = (v: unknown, min: number, max: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
};
const list = (v: unknown, max: number): Record<string, unknown>[] =>
  Array.isArray(v) ? v.slice(0, max).filter((x) => x && typeof x === "object") : [];

function cleanConfig(input: Record<string, unknown>): EstimateConfig {
  const config: EstimateConfig = {
    companyName: cleanText(input.companyName, 100),
    companyInfo: cleanText(input.companyInfo, 500),
    taxRate: cleanNum(input.taxRate, 0, 0.5),
    salesAdjustPct: cleanNum(input.salesAdjustPct, 0, 100),
    estimateNotes: cleanText(input.estimateNotes, 2000),
    contractTerms: cleanText(input.contractTerms, 10000),
    plans: list(input.plans, 20)
      .map((p) => ({ id: cleanId(p.id), label: cleanText(p.label, 50), description: cleanText(p.description, 200) }))
      .filter((p) => p.id && p.label),
    priceItems: list(input.priceItems, 200)
      .map((i) => ({
        id: cleanId(i.id),
        name: cleanText(i.name, 100),
        description: cleanText(i.description, 300),
        unitPrice: Math.round(cleanNum(i.unitPrice, 0, 100_000_000)),
        unit: cleanText(i.unit, 10) || "式",
        defaultQty: cleanNum(i.defaultQty, 0, 999),
        group: GROUPS.includes(i.group as PriceGroup) ? (i.group as PriceGroup) : "option",
        plan: cleanId(i.plan),
      }))
      .filter((i) => i.id && i.name),
    questions: list(input.questions, 50)
      .map((q) => ({
        id: cleanId(q.id),
        category: (Object.keys(FLOW_CATEGORIES).includes(String(q.category)) ? q.category : "other") as keyof typeof FLOW_CATEGORIES,
        title: cleanText(q.title, 200),
        help: cleanText(q.help, 500),
        branchOnly: q.branchOnly === true,
        options: list(q.options, 30)
          .map((o) => ({
            id: cleanId(o.id),
            label: cleanText(o.label, 100),
            description: cleanText(o.description, 300),
            verdict: VERDICTS.includes(o.verdict as Verdict) ? (o.verdict as Verdict) : "ok",
            note: cleanText(o.note, 500),
            addItems: Array.isArray(o.addItems) ? o.addItems.slice(0, 20).map(cleanId).filter(Boolean) : [],
            next: cleanId(o.next),
          }))
          .filter((o) => o.id && o.label),
      }))
      .filter((q) => q.id && q.title),
  };
  if (config.questions.length === 0) throw new UserError("飛行条件の質問を1つ以上登録してください。");
  const ids = new Set(config.questions.map((q) => q.id));
  if (ids.size !== config.questions.length) throw new UserError("質問のIDが重複しています。");
  for (const q of config.questions) {
    if (q.options.length === 0) throw new UserError(`「${q.title}」に選択肢を登録してください。`);
    for (const o of q.options) {
      if (o.next && o.next !== "end" && !ids.has(o.next)) throw new UserError(`「${o.label}」の次の質問が見つかりません。`);
    }
  }
  return config;
}

export function saveSettings(input: Record<string, unknown>): Promise<EstimateConfig> {
  const config = cleanConfig(input);
  return withLock(async () => {
    const { Settings } = await backend().readMany(["Settings"]);
    const row = Settings.rows.find((r) => str(r.key) === CONFIG_KEY);
    const values = { key: CONFIG_KEY, value: JSON.stringify(config), updatedAt: nowString() };
    if (row) await backend().updateCells("Settings", row._row, values);
    else await backend().append("Settings", values);
    return config;
  });
}

// ---------- estimates / contracts ----------

function cleanLines(v: unknown): Line[] {
  return list(v, 100)
    .map((l) => ({
      ...(l.itemId ? { itemId: cleanId(l.itemId) } : {}),
      name: cleanText(l.name, 200),
      unitPrice: Math.round(cleanNum(l.unitPrice, 0, 1_000_000_000)),
      qty: cleanNum(l.qty, 0, 9999),
      unit: cleanText(l.unit, 10),
      ...(l.discount ? { discount: true } : {}),
    }))
    .filter((l) => l.name);
}

function cleanAnswers(v: unknown): FlowAnswer[] {
  return list(v, 50).map((a) => ({
    questionId: cleanId(a.questionId),
    optionId: cleanId(a.optionId),
    category: cleanText(a.category, 20),
    question: cleanText(a.question, 200),
    answer: cleanText(a.answer, 100),
    verdict: VERDICTS.includes(a.verdict as Verdict) ? (a.verdict as Verdict) : "ok",
    note: cleanText(a.note, 500),
  }));
}

// Sales accounts may only move catalog prices within the configured range.
function applyPriceRules(lines: Line[], config: EstimateConfig, user: User): Line[] {
  const catalog = new Map(config.priceItems.map((i) => [i.id, i]));
  return lines.map((l) => {
    const item = l.itemId ? catalog.get(l.itemId) : undefined;
    if (!item) {
      const { itemId: _drop, ...rest } = l;
      void _drop;
      if (!isAdmin(user) && rest.discount) throw new UserError("値引き行の追加は管理者のみ可能です。");
      return rest;
    }
    const line = { ...l, basePrice: item.unitPrice };
    if (!isAdmin(user)) {
      const [min, max] = adjustRange(item.unitPrice, config.salesAdjustPct);
      if (line.unitPrice < min || line.unitPrice > max) {
        throw new UserError(`「${item.name}」の単価は ${min.toLocaleString()}〜${max.toLocaleString()} 円の範囲で設定してください。`);
      }
      if (line.discount) throw new UserError("値引き行の追加は管理者のみ可能です。");
    }
    return line;
  });
}

async function loadCustomerRow(customerId: string, user: User) {
  const { Customers } = await backend().readMany(["Customers"]);
  const row = Customers.rows.find((r) => str(r.id) === customerId && canAccess(r, user));
  if (!row) throw new UserError("対象の顧客データが見つかりません。");
  return row;
}

const toDetails = (lines: Line[]): EstimateDetail[] =>
  lines.map((l) => ({ name: l.name, amount: l.unitPrice, qty: l.qty, unit: l.unit, subtotal: (l.discount ? -1 : 1) * Math.round(l.unitPrice * l.qty) }));

export async function saveEstimate(input: Record<string, unknown>, user: User): Promise<Estimate> {
  const id = cleanText(input.id, 50);
  const type = cleanText(input.type, 10);
  if (!(ESTIMATE_TYPES as readonly string[]).includes(type)) throw new UserError("見積の種類が正しくありません。");
  if (type === "本見積" && !isAdmin(user)) throw new UserError("本見積の作成・編集は管理者のみ可能です。");
  const title = cleanText(input.title) || (type === "仮見積" ? "ドローン業務 仮見積書" : "ドローン業務 御見積書");
  const raw = (input.data && typeof input.data === "object" ? input.data : {}) as Record<string, unknown>;
  const config = await getSettings();
  const lines = applyPriceRules(cleanLines(raw.lines), config, user);
  if (lines.length === 0) throw new UserError("見積項目を1つ以上入力してください。");
  const answers = cleanAnswers(raw.answers);
  const verdict: Verdict = type === "仮見積" ? worstVerdict(answers) : VERDICTS.includes(raw.verdict as Verdict) ? (raw.verdict as Verdict) : "ok";
  if (type === "仮見積" && verdict === "ng") throw new UserError("飛行不可の条件が含まれるため、仮見積を作成できません。");
  const data: EstimateData = {
    answers,
    verdict,
    planId: cleanId(raw.planId),
    lines,
    location: cleanText(raw.location, 300),
    workDate: cleanText(raw.workDate, 100),
    validUntil: cleanText(raw.validUntil, 20),
    memo: cleanText(raw.memo, 3000),
    judgeMemo: cleanText(raw.judgeMemo, 3000),
  };
  const amount = sumLines(lines);
  if (amount < 0) throw new UserError("合計金額がマイナスになっています。");
  const now = nowString();

  return withLock(async () => {
    if (id) {
      const { Estimates } = await backend().readMany(["Estimates"]);
      const row = Estimates.rows.find((r) => str(r.id) === id);
      if (!row) throw new UserError("対象の見積が見つかりません。");
      const current = toEstimate(row);
      await loadCustomerRow(current.customerId, user);
      if (current.type !== type) throw new UserError("見積の種類は変更できません。");
      const date = cleanDate(input.date);
      await backend().updateCells("Estimates", row._row, { date, title, amount, details: JSON.stringify(toDetails(lines)), data: JSON.stringify(data), updatedAt: now });
      return { ...current, date, title, amount, details: toDetails(lines), data, updatedAt: now };
    }
    const customerId = cleanText(input.customerId, 50);
    await loadCustomerRow(customerId, user);
    const estimate: Estimate = {
      id: newId("E"),
      customerId,
      date: cleanDate(input.date),
      title,
      amount,
      type,
      details: toDetails(lines),
      sourceId: cleanText(input.sourceId, 50),
      data,
      createdAt: now,
      updatedAt: now,
    };
    await backend().append("Estimates", { ...estimate, details: JSON.stringify(estimate.details), data: JSON.stringify(data) });
    await refreshCustomerStatus(customerId);
    return estimate;
  });
}

function cleanContractData(raw: Record<string, unknown>): ContractData {
  return {
    lines: cleanLines(raw.lines),
    paymentDue: cleanText(raw.paymentDue, 20),
    paymentMethod: cleanText(raw.paymentMethod, 200),
    workDate: cleanText(raw.workDate, 100),
    workPlace: cleanText(raw.workPlace, 300),
    deliverables: cleanText(raw.deliverables, 1000),
    terms: cleanText(raw.terms, 10000),
    notes: cleanText(raw.notes, 3000),
  };
}

export async function saveContract(input: Record<string, unknown>, user: User): Promise<Contract> {
  const id = cleanText(input.id, 50);
  const title = cleanText(input.title) || "ドローン業務委託契約書";
  const data = cleanContractData((input.data && typeof input.data === "object" ? input.data : {}) as Record<string, unknown>);
  if (data.lines.length === 0) throw new UserError("契約項目がありません。");
  const amount = sumLines(data.lines);
  if (amount < 0) throw new UserError("契約金額がマイナスになっています。");
  const confirm = input.confirm === true;
  if (confirm && !data.paymentDue) throw new UserError("入金期日を入力してください。");
  const status: ContractStatus = confirm ? "confirmed" : "draft";
  const now = nowString();
  const date = cleanDate(input.date);

  return withLock(async () => {
    let contract: Contract;
    if (id) {
      const { Contracts } = await backend().readMany(["Contracts"]);
      const row = Contracts.rows.find((r) => str(r.id) === id);
      if (!row) throw new UserError("対象の契約が見つかりません。");
      const current = toContract(row);
      await loadCustomerRow(current.customerId, user);
      if (current.status === "confirmed") throw new UserError("確定済みの契約は編集できません。");
      contract = { ...current, date, title, amount, data, status, updatedAt: now, confirmedAt: confirm ? now : "" };
      await backend().updateCells("Contracts", row._row, {
        date,
        title,
        amount,
        status,
        data: JSON.stringify(data),
        updatedAt: now,
        confirmedAt: contract.confirmedAt,
      });
    } else {
      const customerId = cleanText(input.customerId, 50);
      await loadCustomerRow(customerId, user);
      contract = {
        id: newId("K"),
        customerId,
        date,
        title,
        amount,
        estimateId: cleanText(input.estimateId, 50),
        status,
        data,
        createdAt: now,
        updatedAt: now,
        confirmedAt: confirm ? now : "",
      };
      await backend().append("Contracts", { ...contract, data: JSON.stringify(data) });
    }
    await refreshCustomerStatus(contract.customerId);
    return contract;
  });
}
