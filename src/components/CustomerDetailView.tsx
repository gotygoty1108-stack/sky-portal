"use client";

import { ArrowLeft, Calculator, Calendar, ChevronDown, FileCheck, FileText, Info, Mail, MapPin, Phone, Plus, Settings, User as UserIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { formatDate, yen } from "@/lib/format";
import { withTax } from "@/lib/pricing";
import { ROLE_ADMIN, type Customer, type Estimate, type User } from "@/lib/types";
import { Badge, Button, Card, statusBadgeType } from "./ui";

type Tab = "info" | "records" | "documents";
const TABS: { key: Tab; label: string }[] = [
  { key: "info", label: "基本情報" },
  { key: "records", label: "業務請負記録" },
  { key: "documents", label: "見積・契約管理" },
];

function InfoItem({ label, icon, children, wide }: { label: string; icon: ReactNode; children: ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "md:col-span-2" : ""}>
      <div className="block text-xs font-bold text-slate-400 mb-1 tracking-wider">{label}</div>
      <div className="flex items-center text-slate-800 bg-slate-50 p-3 rounded-lg border border-slate-100 break-all">
        <span className="text-slate-400 mr-3 shrink-0">{icon}</span>
        {children}
      </div>
    </div>
  );
}

function EstimateCard({ est }: { est: Estimate }) {
  const [open, setOpen] = useState(false);
  const hasDetails = est.details.length > 0;
  const { tax, total } = withTax(est.amount);
  return (
    <Card className="p-4 hover:border-blue-300 group" onClick={hasDetails ? () => setOpen((v) => !v) : undefined}>
      <div className="flex justify-between items-start gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <Badge type={est.type === "本見積" ? "primary" : "default"}>{est.type || "見積"}</Badge>
          <span className="font-bold text-slate-800 group-hover:text-blue-700 transition-colors truncate">{est.title}</span>
        </div>
        {hasDetails && <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />}
      </div>
      <div className="flex justify-between items-end mt-2">
        <span className="text-xs text-slate-400 font-mono flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          {formatDate(est.date)}
        </span>
        <span className="font-bold text-slate-800 text-lg">
          {yen(est.amount)}
          <span className="text-xs text-slate-400 font-normal ml-1">(税抜)</span>
        </span>
      </div>
      {open && (
        <div className="mt-3 pt-3 border-t border-slate-100 text-sm">
          <table className="w-full">
            <tbody className="divide-y divide-slate-100">
              {est.details.map((d, i) => (
                <tr key={i}>
                  <td className="py-1.5 pr-2 text-slate-700">{d.name}</td>
                  <td className="py-1.5 text-right text-slate-500 whitespace-nowrap">
                    {d.qty} {d.unit}
                  </td>
                  <td className="py-1.5 pl-2 text-right font-medium whitespace-nowrap">{d.subtotal > 0 ? yen(d.subtotal) : "要見積"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex justify-between mt-2 text-slate-500">
            <span>消費税(10%)</span>
            <span>{yen(tax)}</span>
          </div>
          <div className="flex justify-between font-bold text-slate-800">
            <span>税込合計</span>
            <span>{yen(total)}</span>
          </div>
        </div>
      )}
    </Card>
  );
}

export function CustomerDetailView({
  user,
  customer,
  readOnly,
  onBack,
  onCreateEstimate,
  onEditCustomer,
  onAddRecord,
  onAddFinalEstimate,
  onAddContract,
}: {
  user: User;
  customer: Customer;
  readOnly: boolean;
  onBack: () => void;
  onCreateEstimate: () => void;
  onEditCustomer: () => void;
  onAddRecord: () => void;
  onAddFinalEstimate: () => void;
  onAddContract: () => void;
}) {
  const [activeTab, setActiveTab] = useState<Tab>("info");
  const isAdmin = user.role === ROLE_ADMIN;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <button onClick={onBack} className="flex items-center text-slate-500 hover:text-blue-600 transition-colors font-medium">
        <ArrowLeft className="w-4 h-4 mr-1" /> 顧客一覧へ戻る
      </button>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 break-all">{customer.name}</h2>
            <Badge type={statusBadgeType(customer.status)}>{customer.status || "未設定"}</Badge>
          </div>
          <p className="text-slate-500 font-mono text-sm">{customer.id}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" icon={Settings} onClick={onEditCustomer} disabled={readOnly}>
            編集
          </Button>
          <Button icon={Calculator} onClick={onCreateEstimate} disabled={readOnly}>
            仮見積もり作成
          </Button>
        </div>
      </div>

      <div className="border-b border-slate-200 bg-white rounded-t-xl px-2 overflow-x-auto">
        <nav className="-mb-px flex space-x-6 sm:space-x-8">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`whitespace-nowrap py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.key ? "border-blue-500 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="py-2">
        {activeTab === "info" && (
          <Card className="p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
              <Info className="w-5 h-5 text-blue-500" /> 連絡先・企業情報
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <InfoItem label="担当者名" icon={<UserIcon className="w-5 h-5" />}>
                {customer.contactPerson || "-"}
              </InfoItem>
              <InfoItem label="フリガナ" icon={<span className="font-bold text-xl leading-none w-5 text-center inline-block">ア</span>}>
                {customer.kana || "-"}
              </InfoItem>
              <InfoItem label="電話番号" icon={<Phone className="w-5 h-5" />}>
                {customer.phone ? (
                  <a href={`tel:${customer.phone}`} className="text-blue-600 hover:underline">
                    {customer.phone}
                  </a>
                ) : (
                  "-"
                )}
              </InfoItem>
              <InfoItem label="メールアドレス" icon={<Mail className="w-5 h-5" />}>
                {customer.email ? (
                  <a href={`mailto:${customer.email}`} className="text-blue-600 hover:underline">
                    {customer.email}
                  </a>
                ) : (
                  "-"
                )}
              </InfoItem>
              <InfoItem label="所在地" icon={<MapPin className="w-5 h-5" />} wide>
                {customer.address || "-"}
              </InfoItem>
            </div>
          </Card>
        )}

        {activeTab === "records" && (
          <div className="space-y-4">
            {isAdmin && (
              <div className="flex justify-end">
                <Button variant="secondary" icon={Plus} onClick={onAddRecord} disabled={readOnly}>
                  記録を追加
                </Button>
              </div>
            )}
            {customer.records.length === 0 ? (
              <Card className="py-12 text-center border-dashed">
                <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">記録がありません。</p>
              </Card>
            ) : (
              customer.records.map((record) => (
                <Card key={record.id} className="p-5 border-l-4 border-l-blue-500">
                  <div className="flex justify-between items-start gap-3 mb-3">
                    <h4 className="font-bold text-slate-800 text-lg break-all">{record.title}</h4>
                    <span className="text-sm bg-slate-100 px-2 py-1 rounded text-slate-600 font-mono whitespace-nowrap">{formatDate(record.date)}</span>
                  </div>
                  {record.content && <p className="text-slate-600 text-sm whitespace-pre-wrap leading-relaxed bg-slate-50 p-3 rounded break-all">{record.content}</p>}
                </Card>
              ))
            )}
          </div>
        )}

        {activeTab === "documents" && (
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <div className="flex justify-between items-center mb-4 bg-white p-3 rounded-lg shadow-sm border border-slate-200">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-500" /> 見積履歴
                </h3>
                {isAdmin && (
                  <Button variant="ghost" className="text-blue-600 !px-2 !py-1" onClick={onAddFinalEstimate} disabled={readOnly}>
                    ＋ 本見積登録
                  </Button>
                )}
              </div>
              <div className="space-y-3">
                {customer.estimates.length === 0 ? (
                  <div className="text-center p-6 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                    <p className="text-slate-500 text-sm">見積履歴はありません。</p>
                  </div>
                ) : (
                  customer.estimates.map((est) => <EstimateCard key={est.id} est={est} />)
                )}
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-4 bg-white p-3 rounded-lg shadow-sm border border-slate-200">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <FileCheck className="w-5 h-5 text-emerald-500" /> 契約履歴
                </h3>
                {isAdmin && (
                  <Button variant="ghost" className="text-emerald-600 !px-2 !py-1" onClick={onAddContract} disabled={readOnly}>
                    ＋ 契約登録
                  </Button>
                )}
              </div>
              <div className="space-y-3">
                {customer.contracts.length === 0 ? (
                  <div className="text-center p-6 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                    <p className="text-slate-500 text-sm">契約履歴はありません。</p>
                  </div>
                ) : (
                  customer.contracts.map((contract) => (
                    <Card key={contract.id} className="p-4 bg-emerald-50/30 border-emerald-100 hover:border-emerald-300">
                      <div className="font-bold text-slate-800 mb-2 break-all">{contract.title}</div>
                      <div className="flex justify-between items-end mt-2">
                        <span className="text-xs text-slate-400 font-mono flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(contract.date)}
                        </span>
                        <span className="font-bold text-emerald-700 text-lg">{yen(contract.amount)}</span>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
