"use client";

import { FileCheck, FileText, Inbox, MapPin, Plus, Search, User as UserIcon } from "lucide-react";
import { useState } from "react";
import { ROLE_ADMIN, type Customer, type User } from "@/lib/types";
import { Badge, Button, Card, statusBadgeType } from "./ui";

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
  const q = searchTerm.trim().toLowerCase();
  const filtered = q
    ? customers.filter((c) => [c.name, c.kana, c.contactPerson, c.id, c.team].some((v) => v && v.toLowerCase().includes(q)))
    : customers;

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

      <div className="relative">
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((customer) => (
          <Card key={customer.id} onClick={() => onSelectCustomer(customer)} className="hover:border-blue-400 group">
            <div className="p-5">
              <div className="flex justify-between items-start mb-3">
                <Badge type={statusBadgeType(customer.status)}>{customer.status || "未設定"}</Badge>
                <span className="text-xs text-slate-400 font-mono">
                  {customer.team && <span className="mr-2 font-sans">team: {customer.team}</span>}
                  {customer.id}
                </span>
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-1 group-hover:text-blue-700 transition-colors break-all">{customer.name}</h3>
              <div className="space-y-1.5 mt-3">
                <p className="text-sm text-slate-600 flex items-center gap-2">
                  <UserIcon className="w-4 h-4 text-slate-400 shrink-0" /> {customer.contactPerson || "未設定"}
                </p>
                <p className="text-sm text-slate-600 flex items-center gap-2 truncate" title={customer.address}>
                  <MapPin className="w-4 h-4 text-slate-400 shrink-0" /> {customer.address || "未設定"}
                </p>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-100 flex gap-6 text-sm bg-slate-50 -mx-5 -mb-5 p-5">
                <div className="flex flex-col">
                  <span className="text-slate-400 text-xs mb-0.5">記録</span>
                  <span className="font-medium text-slate-700 flex items-center gap-1">
                    <FileText className="w-3 h-3" /> {customer.records.length}件
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-slate-400 text-xs mb-0.5">見積/契約</span>
                  <span className="font-medium text-slate-700 flex items-center gap-1">
                    <FileCheck className="w-3 h-3" /> {customer.estimates.length + customer.contracts.length}件
                  </span>
                </div>
              </div>
            </div>
          </Card>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full py-12 text-center text-slate-500 bg-white rounded-xl border border-dashed border-slate-300">
            <Inbox className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p>{customers.length === 0 ? "顧客が登録されていません" : "該当する顧客が見つかりません"}</p>
          </div>
        )}
      </div>
    </div>
  );
}
