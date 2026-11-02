"use client";

import { ClipboardList, Eye, FileText, Save, ShieldCheck } from "lucide-react";
import { useState, type ReactNode } from "react";
import { addDaysInput, todayInput, toInputDate } from "@/lib/format";
import { VERDICT_LABEL, type EstimateConfig, type EstimateData, type Line, type Verdict } from "@/lib/estimate";
import type { Customer, Estimate } from "@/lib/types";
import { DocumentPreview, LineEditor, PageHeader, Totals, VerdictBadge, textareaClass } from "./estimate-ui";
import type { EstimatePayload } from "./ProvisionalEstimateView";
import { Button, Card, Field, inputClass } from "./ui";

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <Card className="p-5 sm:p-6">
      <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 border-b pb-3 mb-5">
        <span className="text-slate-400">{icon}</span> {title}
      </h3>
      {children}
    </Card>
  );
}

export function FinalEstimateView({
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
  /** Existing 本見積 being edited. */
  initial: Estimate | null;
  /** 仮見積 this 本見積 is based on. */
  source: Estimate | null;
  readOnly: boolean;
  onBack: () => void;
  onSave: (payload: EstimatePayload) => Promise<Estimate | null>;
}) {
  const base = initial?.data || source?.data;
  const answers = initial?.data.answers?.length ? initial.data.answers : source?.data.answers || [];
  const [lines, setLines] = useState<Line[]>(() => (base?.lines || []).map((l) => ({ ...l })));
  const [verdict, setVerdict] = useState<Verdict>(initial?.data.verdict || source?.data.verdict || "ok");
  const [judgeMemo, setJudgeMemo] = useState(initial?.data.judgeMemo || "");
  const [title, setTitle] = useState(initial?.title || (source ? source.title.replace("仮見積書", "御見積書") : "ドローン業務 御見積書"));
  const [date, setDate] = useState(initial ? toInputDate(initial.date) : todayInput());
  const [validUntil, setValidUntil] = useState(initial?.data.validUntil ? toInputDate(initial.data.validUntil) : addDaysInput(30));
  const [location, setLocation] = useState(base?.location || "");
  const [workDate, setWorkDate] = useState(base?.workDate || "");
  const [memo, setMemo] = useState(initial?.data.memo || "");
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);
  const [savedId, setSavedId] = useState(initial?.id || "");
  const sourceId = initial?.sourceId || source?.id || "";

  const data: EstimateData = { answers, verdict, planId: base?.planId || "", lines, location, workDate, validUntil, memo, judgeMemo };

  const handleSave = async () => {
    if (verdict === "ng" && !confirm("飛行判定が「飛行不可」のままです。保存しますか？")) return;
    setSaving(true);
    try {
      const est = await onSave({ id: savedId || undefined, customerId: customer.id, type: "本見積", title, date, sourceId, data });
      if (est) {
        setSavedId(est.id);
        alert("本見積を保存しました。");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-20">
      <PageHeader
        onBack={onBack}
        title={
          <span className="flex items-center gap-2">
            <FileText className="w-6 h-6 text-blue-600 shrink-0" /> 本見積{savedId ? "の編集" : "作成"}：<span className="text-blue-600">{customer.name}</span> 様
          </span>
        }
      />

      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          <Section icon={<ShieldCheck className="w-5 h-5" />} title="1. 飛行可否の判断（運航管理者・パイロット）">
            {answers.length > 0 ? (
              <div className="mb-4">
                <div className="text-xs font-bold text-slate-400 mb-2">仮見積時の条件チェック{sourceId && `（${sourceId}）`}</div>
                <ul className="space-y-1.5">
                  {answers.map((a, i) => (
                    <li key={i} className="text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                      <span className="text-slate-500">{a.category}：</span>
                      <span className="font-bold text-slate-800">{a.answer}</span> <VerdictBadge verdict={a.verdict} />
                      {a.note && <div className="text-xs text-slate-600 mt-0.5">{a.note}</div>}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-slate-500 mb-4">仮見積の条件チェック結果はありません。</p>
            )}
            <div className="text-sm font-bold text-slate-700 mb-2">最終判断</div>
            <div className="flex flex-wrap gap-2 mb-4">
              {(Object.keys(VERDICT_LABEL) as Verdict[]).map((v) => (
                <button
                  key={v}
                  type="button"
                  disabled={readOnly}
                  onClick={() => setVerdict(v)}
                  className={`rounded-full border-2 px-1 py-0.5 transition-all ${verdict === v ? "border-blue-600 shadow" : "border-transparent opacity-60 hover:opacity-100"}`}
                >
                  <VerdictBadge verdict={v} large />
                </button>
              ))}
            </div>
            <Field label="運航上の確認事項（見積書に記載されます）">
              <textarea
                className={textareaClass}
                value={judgeMemo}
                onChange={(e) => setJudgeMemo(e.target.value)}
                placeholder="例: DID上空のため包括許可で対応。補助者2名を配置。"
                disabled={readOnly}
              />
            </Field>
          </Section>

          <Section icon={<ClipboardList className="w-5 h-5" />} title="2. 見積項目（自由に追加・編集・値引きできます）">
            <LineEditor lines={lines} onChange={setLines} config={config} mode="admin" disabled={readOnly} />
          </Section>

          <Section icon={<ClipboardList className="w-5 h-5" />} title="3. 見積書の情報">
            <div className="grid md:grid-cols-2 gap-4">
              <Field label="件名" className="md:col-span-2">
                <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} disabled={readOnly} />
              </Field>
              <Field label="発行日">
                <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} disabled={readOnly} />
              </Field>
              <Field label="有効期限">
                <input type="date" className={inputClass} value={validUntil} onChange={(e) => setValidUntil(e.target.value)} disabled={readOnly} />
              </Field>
              <Field label="実施予定日">
                <input className={inputClass} value={workDate} onChange={(e) => setWorkDate(e.target.value)} disabled={readOnly} />
              </Field>
              <Field label="飛行場所">
                <input className={inputClass} value={location} onChange={(e) => setLocation(e.target.value)} disabled={readOnly} />
              </Field>
              <Field label="備考（見積書に記載されます）" className="md:col-span-2">
                <textarea className={textareaClass} value={memo} onChange={(e) => setMemo(e.target.value)} disabled={readOnly} />
              </Field>
            </div>
          </Section>
        </div>

        <div className="lg:col-span-4">
          <div className="lg:sticky lg:top-20">
            <Card className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700">飛行判定</span>
                <VerdictBadge verdict={verdict} />
              </div>
              <Totals lines={lines} taxRate={config.taxRate} />
              <Button variant="secondary" className="w-full" icon={Eye} onClick={() => setPreview(true)}>
                見積書を表示・印刷
              </Button>
              <Button className="w-full py-3" icon={Save} onClick={handleSave} loading={saving} disabled={readOnly || lines.length === 0}>
                {savedId ? "変更を保存" : "本見積を保存"}
              </Button>
            </Card>
          </div>
        </div>
      </div>

      {preview && (
        <DocumentPreview doc={{ kind: "final", docNo: savedId || "（未保存）", date, title, data }} customer={customer} config={config} onClose={() => setPreview(false)} />
      )}
    </div>
  );
}
