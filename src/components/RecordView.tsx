"use client";

import { ClipboardList, Plane, Plus, Save, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { formatDate, todayInput, toInputDate } from "@/lib/format";
import type { Contract, Customer, CustomerRecord, Flight } from "@/lib/types";
import { flightMinutes, formatMinutes } from "@/lib/types";
import { PageHeader, textareaClass } from "./estimate-ui";
import { Button, Card, Field, inputClass } from "./ui";

export type RecordPayload = { id?: string; customerId: string; contractId: string; date: string; title: string; content: string; flights: Flight[] };

const cell = "w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none";

function Section({ icon, title, children, right }: { icon: ReactNode; title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3 border-b pb-3 mb-5">
        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <span className="text-slate-400">{icon}</span> {title}
        </h3>
        {right}
      </div>
      {children}
    </Card>
  );
}

/** Base text for a work record, generated from a confirmed contract. */
function contentFromContract(c: Contract): string {
  const d = c.data;
  const lines = [`【契約】${c.id}（契約日 ${formatDate(c.date)}）`, `業務内容：${c.title}`];
  if (d?.workDate) lines.push(`作業日：${d.workDate}`);
  if (d?.workPlace) lines.push(`作業場所：${d.workPlace}`);
  if (d?.deliverables) lines.push(`成果物：${d.deliverables}`);
  if (d?.lines.length) {
    lines.push("業務項目：");
    d.lines.filter((l) => !l.discount).forEach((l) => lines.push(`・${l.name} ${l.qty}${l.unit}`));
  }
  if (d?.notes) lines.push(`特記事項：${d.notes}`);
  lines.push("", "【作業結果】", "");
  return lines.join("\n");
}

const emptyFlight = (place = ""): Flight => ({ date: todayInput(), place, startTime: "", endTime: "", minutes: 0, content: "" });

export function RecordView({
  customer,
  initial,
  source,
  readOnly,
  onBack,
  onSave,
}: {
  customer: Customer;
  initial: CustomerRecord | null;
  /** Confirmed contract the record is based on. */
  source: Contract | null;
  readOnly: boolean;
  onBack: () => void;
  onSave: (payload: RecordPayload) => Promise<CustomerRecord | null>;
}) {
  const [date, setDate] = useState(initial ? toInputDate(initial.date) : todayInput());
  const [title, setTitle] = useState(initial?.title || (source ? `${source.title} 業務記録` : ""));
  const [content, setContent] = useState(initial?.content ?? (source ? contentFromContract(source) : ""));
  const [flights, setFlights] = useState<Flight[]>(initial?.flights ?? [emptyFlight(source?.data?.workPlace || "")]);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState(initial?.id || "");
  const contractId = initial?.contractId || source?.id || "";

  const setFlight = (idx: number, patch: Partial<Flight>) =>
    setFlights((prev) =>
      prev.map((f, i) => {
        if (i !== idx) return f;
        const next = { ...f, ...patch };
        // Recalculate duration when the times change; it can still be edited by hand afterwards.
        if ("startTime" in patch || "endTime" in patch) {
          const m = flightMinutes(next.startTime, next.endTime);
          if (m !== null) next.minutes = m;
        }
        return next;
      }),
    );

  const total = flights.reduce((s, f) => s + (f.minutes || 0), 0);

  const handleSave = async () => {
    if (!title.trim()) return alert("件名を入力してください。");
    setSaving(true);
    try {
      const rec = await onSave({ id: savedId || undefined, customerId: customer.id, contractId, date, title, content, flights: flights.filter((f) => f.place || f.startTime || f.content || f.minutes) });
      if (rec) {
        setSavedId(rec.id);
        alert("業務請負記録を保存しました。");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 max-w-6xl mx-auto pb-20">
      <PageHeader
        onBack={onBack}
        title={
          <span className="flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-blue-600 shrink-0" /> 業務請負記録{savedId ? "の編集" : "の作成"}：<span className="text-blue-600">{customer.name}</span> 様
          </span>
        }
      >
        <Button icon={Save} onClick={handleSave} loading={saving} disabled={readOnly}>
          {savedId ? "変更を保存" : "記録を保存"}
        </Button>
      </PageHeader>

      <Section icon={<ClipboardList className="w-5 h-5" />} title="1. 業務内容" right={contractId && <span className="text-xs text-slate-500">元の契約：{contractId}</span>}>
        <div className="grid md:grid-cols-3 gap-4">
          <Field label="日付" required>
            <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} disabled={readOnly} />
          </Field>
          <Field label="件名" required className="md:col-span-2">
            <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例: 〇〇工場 空撮業務" disabled={readOnly} />
          </Field>
          <Field label="内容" className="md:col-span-3">
            <textarea className={`${textareaClass} min-h-[220px] text-sm`} value={content} onChange={(e) => setContent(e.target.value)} disabled={readOnly} />
          </Field>
        </div>
      </Section>

      <Section
        icon={<Plane className="w-5 h-5" />}
        title="2. 飛行記録"
        right={
          <span className="text-sm font-bold text-slate-600">
            {flights.length}回・合計 {formatMinutes(total)}
          </span>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[860px]">
            <thead>
              <tr className="border-b-2 border-slate-300 text-slate-600">
                <th className="text-left py-2 w-10">#</th>
                <th className="text-left py-2 w-36">飛行日</th>
                <th className="text-left py-2">飛行場所</th>
                <th className="text-left py-2 w-28">離陸時刻</th>
                <th className="text-left py-2 w-28">着陸時刻</th>
                <th className="text-left py-2 w-24">飛行時間(分)</th>
                <th className="text-left py-2">飛行内容</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {flights.map((f, i) => (
                <tr key={i} className="align-top">
                  <td className="py-2 pt-3.5 text-slate-400 font-bold">{i + 1}</td>
                  <td className="py-2 pr-1">
                    <input type="date" className={cell} value={f.date} onChange={(e) => setFlight(i, { date: e.target.value })} disabled={readOnly} />
                  </td>
                  <td className="py-2 px-1">
                    <input className={cell} value={f.place} onChange={(e) => setFlight(i, { place: e.target.value })} placeholder="例: 〇〇公園 北側広場" disabled={readOnly} />
                  </td>
                  <td className="py-2 px-1">
                    <input type="time" className={cell} value={f.startTime} onChange={(e) => setFlight(i, { startTime: e.target.value })} disabled={readOnly} />
                  </td>
                  <td className="py-2 px-1">
                    <input type="time" className={cell} value={f.endTime} onChange={(e) => setFlight(i, { endTime: e.target.value })} disabled={readOnly} />
                  </td>
                  <td className="py-2 px-1">
                    <input
                      type="number"
                      min={0}
                      className={`${cell} text-right`}
                      value={f.minutes}
                      onChange={(e) => setFlight(i, { minutes: Math.max(0, Math.round(Number(e.target.value) || 0)) })}
                      disabled={readOnly}
                    />
                  </td>
                  <td className="py-2 px-1">
                    <textarea className={`${cell} min-h-[38px]`} rows={1} value={f.content} onChange={(e) => setFlight(i, { content: e.target.value })} placeholder="例: 外観空撮（静止画）" disabled={readOnly} />
                  </td>
                  <td className="py-2 text-right">
                    <button type="button" onClick={() => setFlights((prev) => prev.filter((_, j) => j !== i))} disabled={readOnly} className="p-2 text-slate-400 hover:text-red-600" aria-label="削除">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {flights.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-slate-400">
                    飛行記録がありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {!readOnly && (
          <Button
            variant="secondary"
            icon={Plus}
            className="mt-3"
            onClick={() => setFlights((prev) => [...prev, { ...emptyFlight(prev[prev.length - 1]?.place || ""), date: prev[prev.length - 1]?.date || todayInput() }])}
          >
            飛行を追加
          </Button>
        )}
        <p className="text-xs text-slate-500 mt-2">離陸・着陸時刻を入れると飛行時間は自動で計算されます（手で直すこともできます）。</p>
      </Section>
    </div>
  );
}
