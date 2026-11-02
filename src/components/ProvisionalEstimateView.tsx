"use client";

import { Calculator, CheckCircle2, ClipboardList, Eye, RotateCcw, Save, ShieldAlert, XCircle } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { todayInput, toInputDate, yen } from "@/lib/format";
import {
  FLOW_CATEGORIES,
  itemToLine,
  nextQuestion,
  worstVerdict,
  type EstimateConfig,
  type EstimateData,
  type FlowAnswer,
  type FlowOption,
  type FlowQuestion,
  type Line,
} from "@/lib/estimate";
import type { Customer, Estimate, User } from "@/lib/types";
import { ROLE_ADMIN } from "@/lib/types";
import { DocumentPreview, LineEditor, PageHeader, Totals, VerdictBadge, textareaClass } from "./estimate-ui";
import { Button, Card, Field, inputClass } from "./ui";

export type EstimatePayload = { id?: string; customerId: string; type: "仮見積" | "本見積"; title: string; date: string; sourceId?: string; data: EstimateData };

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

function flowItemIds(config: EstimateConfig, answers: FlowAnswer[]): Set<string> {
  const ids = new Set<string>();
  for (const a of answers) {
    const o = config.questions.find((q) => q.id === a.questionId)?.options.find((op) => op.id === a.optionId);
    o?.addItems.forEach((id) => ids.add(id));
  }
  return ids;
}

export function ProvisionalEstimateView({
  user,
  customer,
  config,
  initial,
  readOnly,
  onBack,
  onSave,
}: {
  user: User;
  customer: Customer;
  config: EstimateConfig;
  initial: Estimate | null;
  readOnly: boolean;
  onBack: () => void;
  onSave: (payload: EstimatePayload) => Promise<Estimate | null>;
}) {
  const isAdmin = user.role === ROLE_ADMIN;
  const catalog = useMemo(() => new Map(config.priceItems.map((i) => [i.id, i])), [config]);
  const firstPlan = config.plans[0]?.id || "";

  const [answers, setAnswers] = useState<FlowAnswer[]>(initial?.data.answers || []);
  const [planId, setPlanId] = useState(initial?.data.planId ?? firstPlan);
  const [lines, setLines] = useState<Line[]>(
    () => initial?.data.lines || config.priceItems.filter((i) => i.group === "base" && (!i.plan || i.plan === firstPlan)).map((i) => itemToLine(i)),
  );
  const [title, setTitle] = useState(initial?.title || "ドローン業務 仮見積書");
  const [date, setDate] = useState(initial ? toInputDate(initial.date) : todayInput());
  const [location, setLocation] = useState(initial?.data.location || "");
  const [workDate, setWorkDate] = useState(initial?.data.workDate || "");
  const [memo, setMemo] = useState(initial?.data.memo || "");
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);
  const [savedId, setSavedId] = useState(initial?.id || "");

  const current: FlowQuestion | null = useMemo(() => {
    if (answers.length === 0) return config.questions[0] || null;
    const last = answers[answers.length - 1];
    const q = config.questions.find((x) => x.id === last.questionId);
    const o = q?.options.find((x) => x.id === last.optionId);
    return q && o ? nextQuestion(config, q, o) : null;
  }, [answers, config]);
  const finished = answers.length > 0 && current === null;
  const verdict = worstVerdict(answers);
  const canEstimate = finished && verdict !== "ng";

  const syncFlowLines = (prev: Line[], next: FlowAnswer[]) => {
    const want = flowItemIds(config, next);
    const kept = prev.filter((l) => !l.itemId || catalog.get(l.itemId)?.group !== "flow" || want.has(l.itemId));
    const have = new Set(kept.map((l) => l.itemId));
    const added = [...want].filter((id) => !have.has(id) && catalog.has(id)).map((id) => itemToLine(catalog.get(id)!, catalog.get(id)!.defaultQty || 1));
    return [...kept, ...added];
  };

  const choose = (q: FlowQuestion, o: FlowOption) => {
    const next = [
      ...answers,
      { questionId: q.id, optionId: o.id, category: FLOW_CATEGORIES[q.category], question: q.title, answer: o.label, verdict: o.verdict, note: o.note },
    ];
    setAnswers(next);
    setLines((prev) => syncFlowLines(prev, next));
  };

  const redoFrom = (idx: number) => {
    const next = answers.slice(0, idx);
    setAnswers(next);
    setLines((prev) => syncFlowLines(prev, next));
  };

  const choosePlan = (pid: string) => {
    setPlanId(pid);
    setLines((prev) => {
      const kept = prev.filter((l) => {
        const item = l.itemId ? catalog.get(l.itemId) : undefined;
        return !item || item.group !== "base" || !item.plan || item.plan === pid;
      });
      const have = new Set(kept.map((l) => l.itemId));
      const added = config.priceItems.filter((i) => i.group === "base" && i.plan === pid && !have.has(i.id)).map((i) => itemToLine(i));
      return [...kept, ...added];
    });
  };

  const toggleOption = (id: string, on: boolean) => {
    const item = catalog.get(id);
    if (!item) return;
    setLines((prev) => (on ? [...prev, itemToLine(item, item.defaultQty || 1)] : prev.filter((l) => l.itemId !== id)));
  };

  const data: EstimateData = { answers, verdict, planId, lines, location, workDate, memo };

  const handleSave = async () => {
    setSaving(true);
    try {
      const est = await onSave({ id: savedId || undefined, customerId: customer.id, type: "仮見積", title, date, data });
      if (est) {
        setSavedId(est.id);
        alert("仮見積を保存しました。");
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
            <Calculator className="w-6 h-6 text-blue-600 shrink-0" /> 仮見積{savedId ? "の編集" : "作成"}：<span className="text-blue-600">{customer.name}</span> 様
          </span>
        }
      />

      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          <Section icon={<ShieldAlert className="w-5 h-5" />} title="1. 簡易飛行条件チェック">
            <ol className="space-y-2 mb-4">
              {answers.map((a, i) => (
                <li key={i} className="flex items-start justify-between gap-3 bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-400">
                      {a.category}：{a.question}
                    </div>
                    <div className="font-bold text-slate-800 flex flex-wrap items-center gap-2">
                      {a.answer} <VerdictBadge verdict={a.verdict} />
                    </div>
                    {a.note && <div className="text-xs text-slate-600 mt-1">{a.note}</div>}
                  </div>
                  {!readOnly && (
                    <button onClick={() => redoFrom(i)} className="text-xs text-blue-600 hover:underline whitespace-nowrap flex items-center gap-1">
                      <RotateCcw className="w-3 h-3" /> ここから選び直す
                    </button>
                  )}
                </li>
              ))}
            </ol>

            {current && !readOnly && (
              <div className="border-2 border-blue-200 bg-blue-50/40 rounded-xl p-4">
                <div className="text-xs font-bold text-blue-600 mb-1">
                  STEP {answers.length + 1}・{FLOW_CATEGORIES[current.category]}
                </div>
                <div className="font-bold text-slate-800 text-lg mb-1">{current.title}</div>
                {current.help && <div className="text-xs text-slate-500 mb-3">{current.help}</div>}
                <div className="grid sm:grid-cols-2 gap-2 mt-3">
                  {current.options.map((o) => (
                    <button
                      key={o.id}
                      onClick={() => choose(current, o)}
                      className="text-left bg-white border border-slate-200 hover:border-blue-500 hover:shadow-md rounded-lg p-3 transition-all"
                    >
                      <div className="font-bold text-slate-800 text-sm">{o.label}</div>
                      {o.description && <div className="text-xs text-slate-500 mt-0.5">{o.description}</div>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {finished && (
              <div
                className={`rounded-xl p-4 flex items-start gap-3 border ${verdict === "ng" ? "bg-red-50 border-red-200" : verdict === "permit" ? "bg-amber-50 border-amber-200" : "bg-emerald-50 border-emerald-200"}`}
              >
                {verdict === "ng" ? <XCircle className="w-6 h-6 text-red-600 shrink-0" /> : <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />}
                <div>
                  <div className="font-bold text-slate-800 flex items-center gap-2">
                    判定結果：<VerdictBadge verdict={verdict} large />
                  </div>
                  <p className="text-sm text-slate-600 mt-1">
                    {verdict === "ng"
                      ? "この条件では飛行できないため、仮見積は作成できません。条件を選び直してください。"
                      : verdict === "permit"
                        ? "飛行には許可・承認申請等が必要です。必要な費用を見積に追加しました。"
                        : "通常の条件で飛行可能です。"}
                  </p>
                </div>
              </div>
            )}
          </Section>

          {canEstimate && (
            <>
              {config.plans.length > 0 && (
                <Section icon={<ClipboardList className="w-5 h-5" />} title="2. プラン">
                  <div className="grid grid-cols-2 gap-3">
                    {config.plans.map((p) => (
                      <label
                        key={p.id}
                        className={`border-2 p-4 rounded-xl cursor-pointer text-center transition-all ${planId === p.id ? "bg-blue-50 border-blue-500 shadow-md" : "bg-white border-slate-200 hover:bg-slate-50"}`}
                      >
                        <input type="radio" name="plan" checked={planId === p.id} onChange={() => choosePlan(p.id)} className="sr-only" disabled={readOnly} />
                        <div className={`font-bold text-lg ${planId === p.id ? "text-blue-700" : "text-slate-700"}`}>{p.label}</div>
                        <div className="text-xs text-slate-500">{p.description}</div>
                      </label>
                    ))}
                  </div>
                </Section>
              )}

              {config.priceItems.some((i) => i.group === "option") && (
                <Section icon={<ClipboardList className="w-5 h-5" />} title="3. オプション">
                  <div className="grid sm:grid-cols-2 gap-3">
                    {config.priceItems
                      .filter((i) => i.group === "option")
                      .map((i) => {
                        const on = lines.some((l) => l.itemId === i.id);
                        return (
                          <label
                            key={i.id}
                            className={`flex items-start gap-3 p-3 border rounded-xl cursor-pointer ${on ? "bg-blue-50/60 border-blue-300" : "bg-white border-slate-200 hover:bg-slate-50"}`}
                          >
                            <input type="checkbox" checked={on} onChange={(e) => toggleOption(i.id, e.target.checked)} className="mt-1" disabled={readOnly} />
                            <div className="flex-1 min-w-0">
                              <div className="font-bold text-sm text-slate-800">{i.name}</div>
                              {i.description && <div className="text-xs text-slate-500">{i.description}</div>}
                            </div>
                            <span className="text-sm font-bold text-slate-600 whitespace-nowrap">{yen(i.unitPrice)}</span>
                          </label>
                        );
                      })}
                  </div>
                </Section>
              )}

              <Section
                icon={<Calculator className="w-5 h-5" />}
                title="4. 見積内容・金額調整"
                right={!isAdmin && <span className="text-xs text-slate-500">単価の調整幅：±{config.salesAdjustPct}%</span>}
              >
                <LineEditor lines={lines} onChange={setLines} config={config} mode={isAdmin ? "admin" : "sales"} disabled={readOnly} />
              </Section>

              <Section icon={<ClipboardList className="w-5 h-5" />} title="5. 案件情報">
                <div className="grid md:grid-cols-2 gap-4">
                  <Field label="件名" className="md:col-span-2">
                    <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} disabled={readOnly} />
                  </Field>
                  <Field label="発行日">
                    <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} disabled={readOnly} />
                  </Field>
                  <Field label="実施予定日">
                    <input className={inputClass} value={workDate} onChange={(e) => setWorkDate(e.target.value)} placeholder="例: 2026年12月上旬" disabled={readOnly} />
                  </Field>
                  <Field label="飛行場所" className="md:col-span-2">
                    <input className={inputClass} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="例: 東京都〇〇市 〇〇公園" disabled={readOnly} />
                  </Field>
                  <Field label="社内メモ（お客様用の見積書には表示されません）" className="md:col-span-2">
                    <textarea className={textareaClass} value={memo} onChange={(e) => setMemo(e.target.value)} disabled={readOnly} />
                  </Field>
                </div>
              </Section>
            </>
          )}
        </div>

        <div className="lg:col-span-4">
          <div className="lg:sticky lg:top-20 space-y-4">
            <Card className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700">飛行判定</span>
                {answers.length > 0 ? <VerdictBadge verdict={verdict} /> : <span className="text-xs text-slate-400">未チェック</span>}
              </div>
              <Totals lines={canEstimate ? lines : []} taxRate={config.taxRate} />
              <Button variant="secondary" className="w-full" icon={Eye} onClick={() => setPreview(true)} disabled={!canEstimate}>
                お客様用の仮見積書を表示・印刷
              </Button>
              <Button className="w-full py-3" icon={Save} onClick={handleSave} loading={saving} disabled={readOnly || !canEstimate}>
                {savedId ? "変更を保存" : "仮見積を保存"}
              </Button>
              {!finished && <p className="text-xs text-slate-500">飛行条件チェックを最後まで進めると、見積を作成できます。</p>}
            </Card>
          </div>
        </div>
      </div>

      {preview && (
        <DocumentPreview
          doc={{ kind: "provisional", docNo: savedId || "（未保存）", date, title, data }}
          customer={customer}
          config={config}
          onClose={() => setPreview(false)}
        />
      )}
    </div>
  );
}
