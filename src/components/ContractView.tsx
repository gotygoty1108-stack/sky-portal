"use client";

import { Eye, FileCheck, Lock, Save, Stamp } from "lucide-react";
import { useState, type ReactNode } from "react";
import { addDaysInput, todayInput, toInputDate, yen } from "@/lib/format";
import { lineSubtotal, type ContractData, type EstimateConfig } from "@/lib/estimate";
import type { Contract, Customer, Estimate } from "@/lib/types";
import { DocumentPreview, PageHeader, Totals, textareaClass } from "./estimate-ui";
import { Button, Card, Field, inputClass } from "./ui";

export type ContractPayload = { id?: string; customerId: string; estimateId: string; title: string; date: string; data: ContractData; confirm: boolean };

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="p-5 sm:p-6">
      <h3 className="text-lg font-bold text-slate-800 border-b pb-3 mb-5">{title}</h3>
      {children}
    </Card>
  );
}

export function ContractView({
  customer,
  config,
  initial,
  source,
  readOnly,
  onBack,
  onSave,
}: {
  customer: Customer;
  config: EstimateConfig;
  initial: Contract | null;
  /** 本見積 the contract is based on. */
  source: Estimate | null;
  readOnly: boolean;
  onBack: () => void;
  onSave: (payload: ContractPayload) => Promise<Contract | null>;
}) {
  const [contract, setContract] = useState<Contract | null>(initial);
  const confirmed = contract?.status === "confirmed";
  const lines = initial?.data?.lines || source?.data.lines || (initial ? [{ name: initial.title, unitPrice: initial.amount, qty: 1, unit: "式" }] : []);
  const d = initial?.data;
  const [title, setTitle] = useState(initial?.title || (source ? source.title.replace(/御見積書|見積書/, "業務委託契約") : "ドローン業務委託契約"));
  const [date, setDate] = useState(initial ? toInputDate(initial.date) : todayInput());
  const [paymentDue, setPaymentDue] = useState(d?.paymentDue || addDaysInput(30));
  const [paymentMethod, setPaymentMethod] = useState(d?.paymentMethod || "銀行振込（振込手数料は委託者負担）");
  const [workDate, setWorkDate] = useState(d?.workDate ?? source?.data.workDate ?? "");
  const [workPlace, setWorkPlace] = useState(d?.workPlace ?? source?.data.location ?? "");
  const [deliverables, setDeliverables] = useState(d?.deliverables || "");
  const [terms, setTerms] = useState(d?.terms || config.contractTerms);
  const [notes, setNotes] = useState(d?.notes || "");
  const [saving, setSaving] = useState<"draft" | "confirm" | null>(null);
  const [preview, setPreview] = useState(false);
  const estimateId = initial?.estimateId || source?.id || "";
  const locked = readOnly || confirmed;

  const data: ContractData = { lines, paymentDue, paymentMethod, workDate, workPlace, deliverables, terms, notes };

  const save = async (confirmIt: boolean) => {
    if (confirmIt) {
      if (!paymentDue) return alert("入金期日を入力してください。");
      if (!confirm("この内容で契約を確定します。確定後は編集できません。よろしいですか？")) return;
    }
    setSaving(confirmIt ? "confirm" : "draft");
    try {
      const saved = await onSave({ id: contract?.id, customerId: customer.id, estimateId, title, date, data, confirm: confirmIt });
      if (saved) {
        setContract(saved);
        if (confirmIt) setPreview(true);
        else alert("下書きを保存しました。");
      }
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-4 max-w-6xl mx-auto pb-20">
      <PageHeader
        onBack={onBack}
        title={
          <span className="flex items-center gap-2">
            <FileCheck className="w-6 h-6 text-emerald-600 shrink-0" /> 契約{confirmed ? "（確定済み）" : contract ? "の編集" : "作成"}：<span className="text-emerald-700">{customer.name}</span> 様
          </span>
        }
      />

      {confirmed && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm text-emerald-800 flex items-center gap-2">
          <Lock className="w-4 h-4" /> この契約は {contract?.confirmedAt} に確定済みです。内容は変更できません。
        </div>
      )}

      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          <Section title={`1. 契約内容（本見積${estimateId ? ` ${estimateId}` : ""} の内容で確定）`}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[480px]">
                <thead>
                  <tr className="border-b-2 border-slate-300 text-slate-600">
                    <th className="text-left py-2">項目</th>
                    <th className="text-right py-2 w-28">単価</th>
                    <th className="text-right py-2 w-20">数量</th>
                    <th className="text-right py-2 w-28">金額</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lines.map((l, i) => (
                    <tr key={i}>
                      <td className="py-2">{l.name}</td>
                      <td className="py-2 text-right">{yen(l.unitPrice)}</td>
                      <td className="py-2 text-right">
                        {l.qty} {l.unit}
                      </td>
                      <td className={`py-2 text-right font-bold ${l.discount ? "text-red-600" : ""}`}>{yen(lineSubtotal(l))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-500 mt-3">金額を変更する場合は、本見積を修正してから契約を作成し直してください。</p>
          </Section>

          <Section title="2. 契約条件">
            <div className="grid md:grid-cols-2 gap-4">
              <Field label="業務内容（件名）" className="md:col-span-2" required>
                <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} disabled={locked} />
              </Field>
              <Field label="契約日">
                <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} disabled={locked} />
              </Field>
              <Field label="入金期日" required>
                <input type="date" className={inputClass} value={paymentDue} onChange={(e) => setPaymentDue(e.target.value)} disabled={locked} />
              </Field>
              <Field label="支払方法" className="md:col-span-2">
                <input className={inputClass} value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} disabled={locked} />
              </Field>
              <Field label="作業日">
                <input className={inputClass} value={workDate} onChange={(e) => setWorkDate(e.target.value)} disabled={locked} />
              </Field>
              <Field label="作業場所">
                <input className={inputClass} value={workPlace} onChange={(e) => setWorkPlace(e.target.value)} disabled={locked} />
              </Field>
              <Field label="成果物・納品方法" className="md:col-span-2">
                <textarea className={textareaClass} value={deliverables} onChange={(e) => setDeliverables(e.target.value)} placeholder="例: 写真データ（JPEG）50枚、動画（MP4）1本をオンラインで納品" disabled={locked} />
              </Field>
              <Field label="契約条項" className="md:col-span-2">
                <textarea className={`${textareaClass} min-h-[220px] text-sm`} value={terms} onChange={(e) => setTerms(e.target.value)} disabled={locked} />
              </Field>
              <Field label="特記事項" className="md:col-span-2">
                <textarea className={textareaClass} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={locked} />
              </Field>
            </div>
          </Section>
        </div>

        <div className="lg:col-span-4">
          <div className="lg:sticky lg:top-20">
            <Card className="p-5 space-y-4">
              <Totals lines={lines} taxRate={config.taxRate} />
              <Button variant="secondary" className="w-full" icon={Eye} onClick={() => setPreview(true)}>
                契約書を表示・印刷
              </Button>
              {!confirmed && (
                <>
                  <Button variant="secondary" className="w-full" icon={Save} onClick={() => save(false)} loading={saving === "draft"} disabled={locked || saving !== null}>
                    下書き保存
                  </Button>
                  <Button className="w-full py-3 !bg-emerald-600 hover:!bg-emerald-700" icon={Stamp} onClick={() => save(true)} loading={saving === "confirm"} disabled={locked || saving !== null}>
                    契約（確定する）
                  </Button>
                </>
              )}
            </Card>
          </div>
        </div>
      </div>

      {preview && (
        <DocumentPreview
          doc={{ kind: "contract", docNo: contract?.id || "（未保存）", date, title, data, confirmed, confirmedAt: contract?.confirmedAt || "" }}
          customer={customer}
          config={config}
          onClose={() => setPreview(false)}
        />
      )}
    </div>
  );
}
