export const ROLE_SALES = 1;
export const ROLE_ADMIN = 2;

import type { ContractData, EstimateData } from "./estimate";

export type User = { id: string; name: string; role: number; team: string };

export const CUSTOMER_STATUSES = ["提案中", "契約進行中", "契約済み"] as const;
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
