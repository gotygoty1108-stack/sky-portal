"use client";

import { ArrowLeft, Calculator, Calendar, Eye, FileCheck, FileText, Info, Mail, MapPin, Pencil, Phone, Plus, Settings, User as UserIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { formatDate, yen } from "@/lib/format";
import { withTax, type ContractData, type EstimateConfig } from "@/lib/estimate";
import { ROLE_ADMIN, type Contract, type Customer, type Estimate, type User } from "@/lib/types";
import { DocumentPreview, VerdictBadge, type PrintDoc } from "./estimate-ui";
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

function contractDoc(c: Contract): PrintDoc {
  const data: ContractData = c.data || {
    lines: [{ name: c.title, unitPrice: c.amount, qty: 1, unit: "式" }],
    paymentDue: "",
    paymentMethod: "",
    workDate: "",
    workPlace: "",
    deliverables: "",
    terms: "",
    notes: "",
  };
  return { kind: "contract", docNo: c.id, date: c.date, title: c.title, data, confirmed: c.status === "confirmed", confirmedAt: c.confirmedAt };
}

function estimateDoc(e: Estimate): PrintDoc {
  return { kind: e.type === "本見積" ? "final" : "provisional", docNo: e.id, date: e.date, title: e.title, data: e.data };
}

function SmallAction({ onClick, children, disabled, color = "text-blue-600" }: { onClick: () => void; children: ReactNode; disabled?: boolean; color?: string }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`text-xs font-bold ${color} hover:underline disabled:opacity-40 disabled:no-underline flex items-center gap-1`}
    >
      {children}
    </button>
  );
}

function EstimateCard({
  est,
  taxRate,
  actions,
}: {
  est: Estimate;
  taxRate: number;
  actions: ReactNode;
}) {
  const { total } = withTax(est.amount, taxRate);
  return (
    <Card className={`p-4 ${est.type === "本見積" ? "border-l-4 border-l-blue-500" : ""}`}>
      <div className="flex justify-between items-start gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <Badge type={est.type === "本見積" ? "primary" : "default"}>{est.type || "見積"}</Badge>
          {est.data.verdict && <VerdictBadge verdict={est.data.verdict} />}
          <span className="font-bold text-slate-800 truncate">{est.title}</span>
        </div>
      </div>
      <div className="flex justify-between items-end mt-2">
        <span className="text-xs text-slate-400 font-mono flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          {formatDate(est.date)}・{est.id}
        </span>
        <span className="font-bold text-slate-800 text-lg">
          {yen(total)}
          <span className="text-xs text-slate-400 font-normal ml-1">(税込)</span>
        </span>
      </div>
      {est.sourceId && <div className="text-[11px] text-slate-400 mt-1">元の仮見積：{est.sourceId}</div>}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 pt-3 border-t border-slate-100">{actions}</div>
    </Card>
  );
}

export function CustomerDetailView({
  user,
  customer,
  readOnly,
  config,
  onBack,
  onEditCustomer,
  onAddRecord,
  onOpenProvisional,
  onOpenFinal,
  onOpenContract,
}: {
  user: User;
  customer: Customer;
  readOnly: boolean;
  config: EstimateConfig;
  onBack: () => void;
  onEditCustomer: () => void;
  onAddRecord: () => void;
  onOpenProvisional: (id: string | null) => void;
  onOpenFinal: (target: { id?: string; sourceId?: string }) => void;
  onOpenContract: (target: { id?: string; sourceId?: string }) => void;
}) {
  const [activeTab, setActiveTab] = useState<Tab>("info");
  const [printing, setPrinting] = useState<PrintDoc | null>(null);
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
          <Button icon={Calculator} onClick={() => onOpenProvisional(null)} disabled={readOnly}>
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
                  <Button variant="ghost" className="text-blue-600 !px-2 !py-1" onClick={() => onOpenFinal({})} disabled={readOnly}>
                    ＋ 本見積（白紙から）
                  </Button>
                )}
              </div>
              <div className="space-y-3">
                {customer.estimates.length === 0 ? (
                  <div className="text-center p-6 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                    <p className="text-slate-500 text-sm">見積履歴はありません。</p>
                  </div>
                ) : (
                  customer.estimates.map((est) => (
                    <EstimateCard
                      key={est.id}
                      est={est}
                      taxRate={config.taxRate}
                      actions={
                        <>
                          <SmallAction onClick={() => setPrinting(estimateDoc(est))}>
                            <Eye className="w-3.5 h-3.5" /> {est.type === "本見積" ? "見積書" : "お客様用"}表示・印刷
                          </SmallAction>
                          {(est.type !== "本見積" || isAdmin) && (
                            <SmallAction
                              disabled={readOnly}
                              onClick={() => (est.type === "本見積" ? onOpenFinal({ id: est.id }) : onOpenProvisional(est.id))}
                            >
                              <Pencil className="w-3.5 h-3.5" /> 編集
                            </SmallAction>
                          )}
                          {isAdmin && est.type === "仮見積" && (
                            <SmallAction disabled={readOnly} onClick={() => onOpenFinal({ sourceId: est.id })} color="text-indigo-600">
                              <FileText className="w-3.5 h-3.5" /> この仮見積から本見積を作成
                            </SmallAction>
                          )}
                          {isAdmin && est.type === "本見積" && (
                            <SmallAction disabled={readOnly} onClick={() => onOpenContract({ sourceId: est.id })} color="text-emerald-600">
                              <FileCheck className="w-3.5 h-3.5" /> この本見積で契約を作成
                            </SmallAction>
                          )}
                        </>
                      }
                    />
                  ))
                )}
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-4 bg-white p-3 rounded-lg shadow-sm border border-slate-200">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <FileCheck className="w-5 h-5 text-emerald-500" /> 契約履歴
                </h3>
              </div>
              <div className="space-y-3">
                {customer.contracts.length === 0 ? (
                  <div className="text-center p-6 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                    <p className="text-slate-500 text-sm">契約履歴はありません。</p>
                    <p className="text-slate-400 text-xs mt-1">契約は本見積の「この本見積で契約を作成」から作成します。</p>
                  </div>
                ) : (
                  customer.contracts.map((contract) => (
                    <Card key={contract.id} className="p-4 bg-emerald-50/30 border-emerald-100">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <Badge type={contract.status === "confirmed" ? "success" : "warning"}>{contract.status === "confirmed" ? "契約確定" : "下書き"}</Badge>
                        <span className="font-bold text-slate-800 break-all">{contract.title}</span>
                      </div>
                      <div className="flex justify-between items-end mt-2">
                        <span className="text-xs text-slate-400 font-mono flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(contract.date)}・{contract.id}
                        </span>
                        <span className="font-bold text-emerald-700 text-lg">
                          {yen(withTax(contract.amount, config.taxRate).total)}
                          <span className="text-xs text-slate-400 font-normal ml-1">(税込)</span>
                        </span>
                      </div>
                      {contract.data?.paymentDue && <div className="text-xs text-slate-500 mt-1">入金期日：{formatDate(contract.data.paymentDue)}</div>}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 pt-3 border-t border-emerald-100">
                        <SmallAction onClick={() => setPrinting(contractDoc(contract))} color="text-emerald-700">
                          <Eye className="w-3.5 h-3.5" /> 契約書を表示・印刷
                        </SmallAction>
                        {isAdmin && (
                          <SmallAction onClick={() => onOpenContract({ id: contract.id })} color="text-emerald-700" disabled={readOnly && contract.status !== "confirmed"}>
                            <Pencil className="w-3.5 h-3.5" /> {contract.status === "confirmed" ? "詳細" : "編集・契約確定"}
                          </SmallAction>
                        )}
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {printing && <DocumentPreview doc={printing} customer={customer} config={config} onClose={() => setPrinting(null)} />}
      {printing && <DocumentPreview doc={printing} customer={customer} config={config} onClose={() => setPrinting(null)} />}
    </div>
  );
}
