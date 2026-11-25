"use client";

import { ArrowUpDown, ChevronRight, FileCheck, FileText, Inbox, MapPin, Phone, Plus, Search, User as UserIcon } from "lucide-react";
import { useState } from "react";
import { toTime } from "@/lib/format";
import { CUSTOMER_STATUSES, ROLE_ADMIN, type Customer, type User } from "@/lib/types";
import { Badge, Button, Card, statusBadgeType } from "./ui";

const SORTS = {
  updatedDesc: { label: "更新日が新しい順", fn: (a: Customer, b: Customer) => toTime(b.updatedAt) - toTime(a.updatedAt) },
  createdDesc: { label: "登録日が新しい順", fn: (a: Customer, b: Customer) => toTime(b.createdAt) - toTime(a.createdAt) },
  createdAsc: { label: "登録日が古い順", fn: (a: Customer, b: Customer) => toTime(a.createdAt) - toTime(b.createdAt) },
  kana: { label: "企業名（フリガナ）順", fn: (a: Customer, b: Customer) => (a.kana || a.name).localeCompare(b.kana || b.name, "ja") },
  status: {
    label: "ステータス順（進んでいる順）",
    fn: (a: Customer, b: Customer) => (CUSTOMER_STATUSES as readonly string[]).indexOf(b.status) - (CUSTOMER_STATUSES as readonly string[]).indexOf(a.status),
  },
  id: { label: "顧客ID順", fn: (a: Customer, b: Customer) => a.id.localeCompare(b.id, "ja", { numeric: true }) },
} as const;
type SortKey = keyof typeof SORTS;

export function DashboardView({
  user,
  customers,
  onSelectCustomer,
  onCreateCustomer,
  readOnly,
}: {
  user: User;
  customers: Customer[];
  onSelectCustomer: (c: Customer) => void;
  onCreateCustomer: () => void;
  readOnly: boolean;
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sort, setSort] = useState<SortKey>("updatedDesc");
  const q = searchTerm.trim().toLowerCase();
  // `customers` is already limited to the account's team by the server, so search never reaches other teams.
  const filtered = (q ? customers.filter((c) => [c.name, c.kana, c.contactPerson, c.id, c.team].some((v) => v && v.toLowerCase().includes(q))) : customers)
    .slice()
    .sort((a, b) => SORTS[sort].fn(a, b) || a.id.localeCompare(b.id, "ja", { numeric: true }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">顧客データベース</h2>
          <p className="text-slate-500 text-sm mt-1">
            {user.role === ROLE_ADMIN
              ? "顧客情報の管理・記録、見積・契約の登録を行います。"
              : "顧客情報の検索・閲覧・登録・編集、仮見積もりの作成が可能です。"}
          </p>
        </div>
        <Button icon={Plus} onClick={onCreateCustomer} disabled={readOnly}>
          新規顧客登録
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
      <div className="relative flex-1">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="w-5 h-5 text-slate-400" />
        </div>
        <input
          type="search"
          className="block w-full pl-10 pr-3 py-3 border border-slate-300 rounded-xl bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
          placeholder="企業名、担当者名、フリガナ、顧客IDで検索..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      <label className="relative sm:w-64">
        <ArrowUpDown className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <select
          className="block w-full pl-9 pr-3 py-3 border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          aria-label="並び替え"
        >
          {(Object.keys(SORTS) as SortKey[]).map((k) => (
            <option key={k} value={k}>
              {SORTS[k].label}
            </option>
          ))}
        </select>
      </label>
      </div>
      <p className="text-xs text-slate-500 -mt-3">
        {filtered.length}件{q && `（全${customers.length}件中）`}
      </p>

      <div className="space-y-3">
        {filtered.map((customer) => (
          <Card key={customer.id} onClick={() => onSelectCustomer(customer)} className="hover:border-blue-400 group">
            <div className="p-4 sm:px-5 flex flex-col md:flex-row md:items-center gap-3 md:gap-6">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <Badge type={statusBadgeType(customer.status)}>{customer.status || "未設定"}</Badge>
                  <span className="text-xs text-slate-400 font-mono">{customer.id}</span>
                  {customer.team && <span className="text-xs bg-slate-100 text-slate-600 rounded px-1.5 py-0.5">チーム: {customer.team}</span>}
                </div>
                <h3 className="text-lg font-bold text-slate-800 group-hover:text-blue-700 transition-colors truncate">{customer.name}</h3>
                {customer.kana && <p className="text-xs text-slate-400 truncate">{customer.kana}</p>}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 md:w-[46%] gap-x-4 gap-y-1 text-sm text-slate-600">
                <p className="flex items-center gap-1.5 truncate">
                  <UserIcon className="w-4 h-4 text-slate-400 shrink-0" /> {customer.contactPerson || "未設定"}
                </p>
                <p className="flex items-center gap-1.5 truncate">
                  <Phone className="w-4 h-4 text-slate-400 shrink-0" /> {customer.phone || "未設定"}
                </p>
                <p className="flex items-center gap-1.5 truncate" title={customer.address}>
                  <MapPin className="w-4 h-4 text-slate-400 shrink-0" /> {customer.address || "未設定"}
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-500 shrink-0">
                <span className="flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5" /> 記録 {customer.records.length}
                </span>
                <span className="flex items-center gap-1">
                  <FileCheck className="w-3.5 h-3.5" /> 見積/契約 {customer.estimates.length + customer.contracts.length}
                </span>
                <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-500 hidden md:block" />
              </div>
            </div>
          </Card>
        ))}
        {filtered.length === 0 && (
          <div className="py-12 text-center text-slate-500 bg-white rounded-xl border border-dashed border-slate-300">
            <Inbox className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p>{customers.length === 0 ? "顧客が登録されていません" : "該当する顧客が見つかりません"}</p>
          </div>
        )}
      </div>
    </div>
  );
}
