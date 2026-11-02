export const ROLE_SALES = 1;
export const ROLE_ADMIN = 2;

import type { ContractData, EstimateData } from "./estimate";

export type User = { id: string; name: string; role: number; team: string };

// Customer status is derived from the documents; it is never edited by hand.
export const CUSTOMER_STATUSES = ["顧客情報登録済み", "仮見積作成済み", "本見積作成済み", "契約済み", "業務請負記録済み"] as const;

export function computeStatus(c: {
  estimates: { type: string }[];
  contracts: { status: string; confirmedAt: string }[];
  records: { createdAt: string }[];
}): string {
  const confirmed = c.contracts.filter((k) => k.status === "confirmed").map((k) => k.confirmedAt).sort();
  const contracted = confirmed.length > 0;
  // Only records added after the contract count (pre-contract meeting notes don't). Timestamps are "YYYY/MM/DD HH:MM:SS".
  if (contracted && c.records.some((r) => r.createdAt >= confirmed[0])) return "業務請負記録済み";
  if (contracted) return "契約済み";
  if (c.estimates.some((e) => e.type === "本見積")) return "本見積作成済み";
  if (c.estimates.some((e) => e.type === "仮見積")) return "仮見積作成済み";
  return "顧客情報登録済み";
}
export const ESTIMATE_TYPES = ["仮見積", "本見積"] as const;

export type EstimateType = (typeof ESTIMATE_TYPES)[number];

export type EstimateDetail = {
  name: string;
  amount: number | string;
  qty: number;
  unit: string;
  subtotal: number;
};

export type CustomerRecord = {
  id: string;
  customerId: string;
  date: string;
  title: string;
  content: string;
  createdAt: string;
};

export type Estimate = {
  id: string;
  customerId: string;
  date: string;
  title: string;
  amount: number;
  type: string;
  details: EstimateDetail[];
  /** Source estimate (仮見積 → 本見積). */
  sourceId: string;
  data: EstimateData;
  createdAt: string;
  updatedAt: string;
};

export type Contract = {
  id: string;
  customerId: string;
  date: string;
  title: string;
  amount: number;
  estimateId: string;
  status: ContractStatus;
  data: ContractData | null;
  createdAt: string;
  updatedAt: string;
  confirmedAt: string;
};

export type ContractStatus = "draft" | "confirmed";

export type CustomerFields = {
  name: string;
  kana: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  status: string;
  team: string;
};

export type CustomerBase = CustomerFields & {
  id: string;
  createdAt: string;
  updatedAt: string;
};

export type Customer = CustomerBase & {
  records: CustomerRecord[];
  estimates: Estimate[];
  contracts: Contract[];
};

export type ApiResult<T> = { status: "success"; data: T } | { status: "error"; message: string };
