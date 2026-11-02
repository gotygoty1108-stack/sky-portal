"use client";

import { ArrowDown, ArrowUp, Plus, RotateCcw, Save, Settings, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import {
  DEFAULT_CONFIG,
  FLOW_CATEGORIES,
  newKey,
  PRICE_GROUP_LABEL,
  VERDICT_LABEL,
  type EstimateConfig,
  type FlowCategory,
  type FlowOption,
  type FlowQuestion,
  type PriceGroup,
  type PriceItem,
  type Verdict,
} from "@/lib/estimate";
import { PageHeader, textareaClass } from "./estimate-ui";
import { Button, Card, Field, inputClass } from "./ui";

type Tab = "flow" | "prices" | "plans" | "general";
const TABS: { key: Tab; label: string }[] = [
  { key: "flow", label: "飛行条件チェック" },
  { key: "prices", label: "料金表" },
  { key: "plans", label: "プラン" },
  { key: "general", label: "営業・書類設定" },
];

const cell = "w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none";

function move<T>(arr: T[], idx: number, dir: -1 | 1): T[] {
  const j = idx + dir;
  if (j < 0 || j >= arr.length) return arr;
  const copy = [...arr];
  [copy[idx], copy[j]] = [copy[j], copy[idx]];
  return copy;
}

function IconBtn({ onClick, label, children, danger }: { onClick: () => void; label: string; children: ReactNode; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className={`p-1.5 rounded hover:bg-slate-100 ${danger ? "text-slate-400 hover:text-red-600" : "text-slate-500"}`}>
      {children}
    </button>
  );
}

function OptionEditor({
  option,
  config,
  onChange,
  onRemove,
  onMove,
}: {
  option: FlowOption;
  config: EstimateConfig;
  onChange: (o: FlowOption) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const set = (patch: Partial<FlowOption>) => onChange({ ...option, ...patch });
  const toggleItem = (id: string, on: boolean) => set({ addItems: on ? [...option.addItems, id] : option.addItems.filter((x) => x !== id) });
  return (
    <div className="border border-slate-200 rounded-lg p-3 bg-white space-y-2">
      <div className="flex gap-2 items-start">
        <div className="grid sm:grid-cols-2 gap-2 flex-1">
          <input className={cell} value={option.label} onChange={(e) => set({ label: e.target.value })} placeholder="選択肢の名前" />
          <input className={cell} value={option.description} onChange={(e) => set({ description: e.target.value })} placeholder="補足説明（任意）" />
          <label className="text-xs text-slate-500">
            判定
            <select className={cell} value={option.verdict} onChange={(e) => set({ verdict: e.target.value as Verdict })}>
              {(Object.keys(VERDICT_LABEL) as Verdict[]).map((v) => (
                <option key={v} value={v}>
                  {VERDICT_LABEL[v]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-500">
            次に進む質問
            <select className={cell} value={option.next} onChange={(e) => set({ next: e.target.value })} disabled={option.verdict === "ng"}>
              <option value="">（順番どおり次の質問へ）</option>
              {config.questions.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.title}
                </option>
              ))}
              <option value="end">ここでチェック終了</option>
            </select>
          </label>
          <input className={`${cell} sm:col-span-2`} value={option.note} onChange={(e) => set({ note: e.target.value })} placeholder="判定メモ（見積書に表示されます。例: DID上空飛行の許可が必要です）" />
        </div>
        <div className="flex flex-col">
          <IconBtn onClick={() => onMove(-1)} label="上へ">
            <ArrowUp className="w-4 h-4" />
          </IconBtn>
          <IconBtn onClick={() => onMove(1)} label="下へ">
            <ArrowDown className="w-4 h-4" />
          </IconBtn>
          <IconBtn onClick={onRemove} label="削除" danger>
            <Trash2 className="w-4 h-4" />
          </IconBtn>
        </div>
      </div>
      <details className="text-xs">
        <summary className="cursor-pointer text-blue-600 font-bold">
          選んだときに見積へ追加する項目（{option.addItems.length}件）
        </summary>
        <div className="grid sm:grid-cols-2 gap-1 mt-2">
          {config.priceItems.map((i) => (
            <label key={i.id} className="flex items-center gap-2">
              <input type="checkbox" checked={option.addItems.includes(i.id)} onChange={(e) => toggleItem(i.id, e.target.checked)} />
              {i.name}
            </label>
          ))}
        </div>
      </details>
    </div>
  );
}

function QuestionEditor({
  q,
  index,
  config,
  onChange,
  onRemove,
  onMove,
}: {
  q: FlowQuestion;
  index: number;
  config: EstimateConfig;
  onChange: (q: FlowQuestion) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const set = (patch: Partial<FlowQuestion>) => onChange({ ...q, ...patch });
  const setOption = (i: number, o: FlowOption) => set({ options: q.options.map((x, j) => (j === i ? o : x)) });
  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start gap-2">
        <span className="bg-blue-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center shrink-0 mt-1.5">{index + 1}</span>
        <div className="grid sm:grid-cols-4 gap-2 flex-1">
          <select className={cell} value={q.category} onChange={(e) => set({ category: e.target.value as FlowCategory })}>
            {(Object.keys(FLOW_CATEGORIES) as FlowCategory[]).map((c) => (
              <option key={c} value={c}>
                {FLOW_CATEGORIES[c]}
              </option>
            ))}
          </select>
          <input className={`${cell} sm:col-span-3 font-bold`} value={q.title} onChange={(e) => set({ title: e.target.value })} placeholder="質問文" />
          <input className={`${cell} sm:col-span-3`} value={q.help} onChange={(e) => set({ help: e.target.value })} placeholder="補足説明（任意）" />
          <label className="flex items-center gap-1.5 text-xs text-slate-600">
            <input type="checkbox" checked={!!q.branchOnly} onChange={(e) => set({ branchOnly: e.target.checked })} />
            分岐で指定されたときだけ表示
          </label>
        </div>
        <div className="flex">
          <IconBtn onClick={() => onMove(-1)} label="上へ">
            <ArrowUp className="w-4 h-4" />
          </IconBtn>
          <IconBtn onClick={() => onMove(1)} label="下へ">
            <ArrowDown className="w-4 h-4" />
          </IconBtn>
          <IconBtn onClick={onRemove} label="質問を削除" danger>
            <Trash2 className="w-4 h-4" />
          </IconBtn>
        </div>
      </div>
      <div className="space-y-2 pl-8">
        {q.options.map((o, i) => (
          <OptionEditor
            key={o.id}
            option={o}
            config={config}
            onChange={(next) => setOption(i, next)}
            onRemove={() => set({ options: q.options.filter((_, j) => j !== i) })}
            onMove={(dir) => set({ options: move(q.options, i, dir) })}
          />
        ))}
        <Button
          variant="ghost"
          icon={Plus}
          className="text-blue-600"
          onClick={() => set({ options: [...q.options, { id: `o${newKey()}`, label: "", description: "", verdict: "ok", note: "", addItems: [], next: "" }] })}
        >
          選択肢を追加
        </Button>
      </div>
    </Card>
  );
}

export function AdminSettingsView({
  config,
  readOnly,
  onBack,
  onSave,
}: {
  config: EstimateConfig;
  readOnly: boolean;
  onBack: () => void;
  onSave: (config: EstimateConfig) => Promise<boolean>;
}) {
  const [tab, setTab] = useState<Tab>("flow");
  const [draft, setDraft] = useState<EstimateConfig>(() => structuredClone(config));
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<EstimateConfig>) => setDraft((d) => ({ ...d, ...patch }));
  const setQuestion = (i: number, q: FlowQuestion) => set({ questions: draft.questions.map((x, j) => (j === i ? q : x)) });
  const setItem = (i: number, patch: Partial<PriceItem>) => set({ priceItems: draft.priceItems.map((x, j) => (j === i ? { ...x, ...patch } : x)) });

  const removeQuestion = (i: number) => {
    const id = draft.questions[i].id;
    if (!confirm(`「${draft.questions[i].title}」を削除しますか？`)) return;
    set({
      questions: draft.questions
        .filter((_, j) => j !== i)
        .map((q) => ({ ...q, options: q.options.map((o) => (o.next === id ? { ...o, next: "" } : o)) })),
    });
  };

  const removeItem = (i: number) => {
    const id = draft.priceItems[i].id;
    set({
      priceItems: draft.priceItems.filter((_, j) => j !== i),
      questions: draft.questions.map((q) => ({ ...q, options: q.options.map((o) => ({ ...o, addItems: o.addItems.filter((x) => x !== id) })) })),
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (await onSave(draft)) alert("設定を保存しました。");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 max-w-6xl mx-auto pb-24">
      <PageHeader
        onBack={onBack}
        title={
          <span className="flex items-center gap-2">
            <Settings className="w-6 h-6 text-purple-600" /> 管理者設定（仮見積システム）
          </span>
        }
      >
        <Button
          variant="secondary"
          icon={RotateCcw}
          onClick={() => confirm("初期設定の内容に戻しますか？（保存するまで反映されません）") && setDraft(structuredClone(DEFAULT_CONFIG))}
          disabled={readOnly}
        >
          初期設定に戻す
        </Button>
        <Button icon={Save} onClick={handleSave} loading={saving} disabled={readOnly}>
          保存
        </Button>
      </PageHeader>

      <div className="border-b border-slate-200 bg-white rounded-t-xl px-2 overflow-x-auto">
        <nav className="-mb-px flex space-x-6">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`whitespace-nowrap py-4 px-2 border-b-2 font-medium text-sm ${tab === t.key ? "border-purple-500 text-purple-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {tab === "flow" && (
        <div className="space-y-4">
          <p className="text-sm text-slate-600 bg-white border border-slate-200 rounded-lg p-3">
            仮見積では、上から順に質問が表示されます。選択肢ごとに「判定」「次に進む質問」「見積に追加する項目」を設定できます。
            「飛行不可」を選ぶと、その時点でチェックが終了し、仮見積は作成できません。「分岐で指定されたときだけ表示」にした質問は、ほかの選択肢の「次に進む質問」で指定されたときだけ表示されます（追加質問用）。
          </p>
          {draft.questions.map((q, i) => (
            <QuestionEditor
              key={q.id}
              q={q}
              index={i}
              config={draft}
              onChange={(next) => setQuestion(i, next)}
              onRemove={() => removeQuestion(i)}
              onMove={(dir) => set({ questions: move(draft.questions, i, dir) })}
            />
          ))}
          <Button
            variant="secondary"
            icon={Plus}
            onClick={() => set({ questions: [...draft.questions, { id: `q${newKey()}`, category: "other", title: "", help: "", options: [] }] })}
          >
            質問を追加
          </Button>
        </div>
      )}

      {tab === "prices" && (
        <Card className="p-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead>
                <tr className="text-slate-600 border-b-2 border-slate-300">
                  <th className="text-left py-2">項目名 / 説明</th>
                  <th className="text-right py-2 w-28">単価（円）</th>
                  <th className="py-2 w-16">単位</th>
                  <th className="py-2 w-20">初期数量</th>
                  <th className="py-2 w-40">区分</th>
                  <th className="py-2 w-32">プラン</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {draft.priceItems.map((it, i) => (
                  <tr key={it.id}>
                    <td className="py-2 pr-2 space-y-1">
                      <input className={cell} value={it.name} onChange={(e) => setItem(i, { name: e.target.value })} placeholder="項目名" />
                      <input className={`${cell} text-xs`} value={it.description} onChange={(e) => setItem(i, { description: e.target.value })} placeholder="説明（任意）" />
                    </td>
                    <td className="py-2 px-1">
                      <input type="number" min={0} className={`${cell} text-right`} value={it.unitPrice} onChange={(e) => setItem(i, { unitPrice: Math.max(0, Number(e.target.value) || 0) })} />
                    </td>
                    <td className="py-2 px-1">
                      <input className={cell} value={it.unit} onChange={(e) => setItem(i, { unit: e.target.value })} />
                    </td>
                    <td className="py-2 px-1">
                      <input type="number" min={0} className={`${cell} text-right`} value={it.defaultQty} onChange={(e) => setItem(i, { defaultQty: Math.max(0, Number(e.target.value) || 0) })} />
                    </td>
                    <td className="py-2 px-1">
                      <select className={cell} value={it.group} onChange={(e) => setItem(i, { group: e.target.value as PriceGroup })}>
                        {(Object.keys(PRICE_GROUP_LABEL) as PriceGroup[]).map((g) => (
                          <option key={g} value={g}>
                            {PRICE_GROUP_LABEL[g]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 px-1">
                      <select className={cell} value={it.plan} onChange={(e) => setItem(i, { plan: e.target.value })}>
                        <option value="">全プラン共通</option>
                        {draft.plans.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 text-right">
                      <IconBtn onClick={() => removeItem(i)} label="削除" danger>
                        <Trash2 className="w-4 h-4" />
                      </IconBtn>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500 mt-3">
            区分：「基本項目」は仮見積の最初から入ります（プラン指定時はそのプランを選んだときだけ）。「オプション」はチェックで追加。「飛行条件で自動追加」は質問の選択肢で追加されます。
          </p>
          <Button
            variant="secondary"
            icon={Plus}
            className="mt-3"
            onClick={() => set({ priceItems: [...draft.priceItems, { id: `i${newKey()}`, name: "", description: "", unitPrice: 0, unit: "式", defaultQty: 1, group: "option", plan: "" }] })}
          >
            項目を追加
          </Button>
        </Card>
      )}

      {tab === "plans" && (
        <Card className="p-4 space-y-2">
          {draft.plans.map((p, i) => (
            <div key={p.id} className="flex gap-2 items-center">
              <input className={cell} value={p.label} onChange={(e) => set({ plans: draft.plans.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} placeholder="プラン名" />
              <input
                className={cell}
                value={p.description}
                onChange={(e) => set({ plans: draft.plans.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)) })}
                placeholder="説明"
              />
              <IconBtn onClick={() => set({ plans: move(draft.plans, i, -1) })} label="上へ">
                <ArrowUp className="w-4 h-4" />
              </IconBtn>
              <IconBtn
                onClick={() => set({ plans: draft.plans.filter((_, j) => j !== i), priceItems: draft.priceItems.map((it) => (it.plan === p.id ? { ...it, plan: "" } : it)) })}
                label="削除"
                danger
              >
                <Trash2 className="w-4 h-4" />
              </IconBtn>
            </div>
          ))}
          <Button variant="secondary" icon={Plus} onClick={() => set({ plans: [...draft.plans, { id: `p${newKey()}`, label: "", description: "" }] })}>
            プランを追加
          </Button>
        </Card>
      )}

      {tab === "general" && (
        <Card className="p-5 grid md:grid-cols-2 gap-4">
          <Field label="営業担当者の値段調整幅（±％）">
            <input type="number" min={0} max={100} className={inputClass} value={draft.salesAdjustPct} onChange={(e) => set({ salesAdjustPct: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })} />
            <span className="text-xs text-slate-500">営業担当者は、料金表の単価からこの範囲内で単価を変更できます。値引き行の追加は管理者のみです。</span>
          </Field>
          <Field label="消費税率（％）">
            <input type="number" min={0} max={50} className={inputClass} value={Math.round(draft.taxRate * 100)} onChange={(e) => set({ taxRate: Math.max(0, Math.min(50, Number(e.target.value) || 0)) / 100 })} />
          </Field>
          <Field label="会社名（書類に表示）">
            <input className={inputClass} value={draft.companyName} onChange={(e) => set({ companyName: e.target.value })} />
          </Field>
          <Field label="会社住所・連絡先（書類に表示）">
            <textarea className={textareaClass} value={draft.companyInfo} onChange={(e) => set({ companyInfo: e.target.value })} />
          </Field>
          <Field label="見積書の注意書き" className="md:col-span-2">
            <textarea className={textareaClass} value={draft.estimateNotes} onChange={(e) => set({ estimateNotes: e.target.value })} />
          </Field>
          <Field label="契約条項のひな形（契約作成時の初期値）" className="md:col-span-2">
            <textarea className={`${textareaClass} min-h-[240px] text-sm`} value={draft.contractTerms} onChange={(e) => set({ contractTerms: e.target.value })} />
          </Field>
        </Card>
      )}
    </div>
  );
}
