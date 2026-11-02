"use client";

import { ArrowLeft, Calculator, Camera, Clock, FileText, Save, ShieldAlert } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { calcEstimate, DEFAULT_ESTIMATE_FORM, PRICING, withTax, type EstimateForm } from "@/lib/pricing";
import { yen } from "@/lib/format";
import type { Customer } from "@/lib/types";
import { Button, Card } from "./ui";

function Counter({ label, value, onChange, min = 0, max = 99 }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <div className="flex items-center border border-slate-300 rounded-lg overflow-hidden bg-white shadow-sm">
        <button
          type="button"
          aria-label={`${label}を減らす`}
          className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 disabled:opacity-30 transition-colors border-r border-slate-200"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
        >
          −
        </button>
        <span className="w-12 text-center text-sm font-bold text-slate-800">{value}</span>
        <button
          type="button"
          aria-label={`${label}を増やす`}
          className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 disabled:opacity-30 transition-colors border-l border-slate-200"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
        >
          ＋
        </button>
      </div>
    </div>
  );
}

function Toggle({ label, description, checked, onChange, price }: { label: string; description?: string; checked: boolean; onChange: (v: boolean) => void; price?: number }) {
  return (
    <label
      className={`flex items-start p-4 border rounded-xl cursor-pointer transition-all duration-200 ${checked ? "bg-blue-50/50 border-blue-300 shadow-sm" : "bg-white border-slate-200 hover:bg-slate-50"}`}
    >
      <div className="flex-1 pr-4">
        <div className={`font-bold text-sm ${checked ? "text-blue-900" : "text-slate-800"}`}>{label}</div>
        {description && <div className="text-xs text-slate-500 mt-1 leading-relaxed">{description}</div>}
      </div>
      <div className="flex items-center gap-3">
        {price !== undefined && (
          <span className="text-sm font-bold text-slate-600 bg-white px-2 py-1 rounded shadow-sm border border-slate-100 whitespace-nowrap">{yen(price)}</span>
        )}
        <div className={`w-10 h-6 rounded-full p-1 transition-colors duration-200 flex shrink-0 ${checked ? "bg-blue-600 justify-end" : "bg-slate-300 justify-start"}`}>
          <div className="w-4 h-4 bg-white rounded-full shadow-md" />
        </div>
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only" />
      </div>
    </label>
  );
}

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <Card className="p-6">
      <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2 border-b pb-3">
        <span className="text-slate-400">{icon}</span> {title}
      </h3>
      {children}
    </Card>
  );
}

export function EstimateBuilderView({
  customer,
  readOnly,
  onBack,
  onSave,
}: {
  customer: Customer;
  readOnly: boolean;
  onBack: () => void;
  onSave: (data: { customerId: string; title: string; amount: number; type: "仮見積"; details: ReturnType<typeof calcEstimate>["details"] }) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<EstimateForm>(DEFAULT_ESTIMATE_FORM);
  const update = <K extends keyof EstimateForm>(key: K, value: EstimateForm[K]) => setForm((prev) => ({ ...prev, [key]: value }));

  const estimate = useMemo(() => calcEstimate(form), [form]);
  const { tax, total } = withTax(estimate.total);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ customerId: customer.id, title: "空撮業務 仮見積もり", amount: estimate.total, type: "仮見積", details: estimate.details });
    } finally {
      setSaving(false);
    }
  };

  const planCard = (plan: 3 | 7, title: string, sub: string) => (
    <label
      className={`border-2 p-5 rounded-xl cursor-pointer text-center transition-all ${form.plan === plan ? "bg-blue-50 border-blue-500 shadow-md" : "bg-white border-slate-200 hover:bg-slate-50"}`}
    >
      <input type="radio" name="plan" checked={form.plan === plan} onChange={() => update("plan", plan)} className="sr-only" />
      <div className={`font-bold text-lg sm:text-xl mb-1 ${form.plan === plan ? "text-blue-700" : "text-slate-700"}`}>{title}</div>
      <div className="text-xs text-slate-500">{sub}</div>
    </label>
  );

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <button onClick={onBack} className="flex items-center text-slate-500 hover:text-blue-600 transition-colors font-medium">
          <ArrowLeft className="w-4 h-4 mr-1" /> 戻る
        </button>
        <h2 className="text-lg sm:text-xl font-bold text-slate-800 flex items-center gap-2">
          <Calculator className="w-6 h-6 text-blue-600 shrink-0" /> 仮見積作成: <span className="text-blue-600 break-all">{customer.name}</span> 様
        </h2>
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-6">
          <Section icon={<Clock className="w-5 h-5" />} title="1. 基本プランと人員構成">
            <div className="grid grid-cols-2 gap-4 mb-6">
              {planCard(3, "3時間プラン", "半日程度の撮影に")}
              {planCard(7, "7時間プラン", "1日がかりの撮影に")}
            </div>
            <div className="space-y-3 border-t border-slate-100 pt-4 bg-slate-50/50 p-4 rounded-lg">
              <Counter label="操縦士" value={form.pilotCount} onChange={(v) => update("pilotCount", v)} min={1} />
              <Counter label="安全管理者" value={form.managerCount} onChange={(v) => update("managerCount", v)} />
              <Counter label="安全管理補助者" value={form.assistantCount} onChange={(v) => update("assistantCount", v)} />
              <Counter label="機材: DJI Mini 5 Pro" value={form.droneMini5} onChange={(v) => update("droneMini5", v)} />
              <div className="pt-2">
                <Toggle label="その他機材を使用 (要別途見積)" checked={form.droneOther} onChange={(v) => update("droneOther", v)} />
              </div>
            </div>
          </Section>

          <Section icon={<ShieldAlert className="w-5 h-5" />} title="2. 運行管理・特殊申請・環境リスク">
            <div className="space-y-4">
              <Toggle label="基本運航・安全管理計画費" description="机上ロケハン、飛行計画通報、飛行日誌作成など" price={PRICING.operation.plan} checked={form.flightPlan} onChange={(v) => update("flightPlan", v)} />
              <Toggle label="特殊飛行申請費" description="イベント上空、空港周辺、高度150m以上など" price={PRICING.operation.specialPermit} checked={form.specialPermit} onChange={(v) => update("specialPermit", v)} />
              <Toggle label="特殊環境加算 (低リスク)" description="夜間飛行、目視外飛行、屋内飛行" price={PRICING.risk.low} checked={form.envLowRisk} onChange={(v) => update("envLowRisk", v)} />
              <Toggle label="特殊環境加算 (高リスク)" description="水上、海上、山間部、森林" price={PRICING.risk.high} checked={form.envHighRisk} onChange={(v) => update("envHighRisk", v)} />
            </div>
          </Section>

          <Section icon={<Camera className="w-5 h-5" />} title="3. オプション">
            <div className="space-y-4">
              <Toggle label="簡易写真編集" description="ベストショットのセレクト、トリミング、色調補正" price={PRICING.options.photoEdit} checked={form.editPhoto} onChange={(v) => update("editPhoto", v)} />
              <Toggle label="簡易動画編集" description="不要部分のカット、色調補正" price={PRICING.options.videoEdit} checked={form.editVideo} onChange={(v) => update("editVideo", v)} />
              <Toggle label="予備日確保費" description="天候不良による順延に備えたスケジュールキープ" price={PRICING.options.reserveDay} checked={form.reserveDay} onChange={(v) => update("reserveDay", v)} />
            </div>
          </Section>
        </div>

        <div className="lg:col-span-5">
          <div className="lg:sticky lg:top-20">
            <Card className="overflow-hidden shadow-xl border-slate-300">
              <div className="bg-slate-900 text-white p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <FileText className="w-24 h-24" />
                </div>
                <h3 className="text-xl font-bold mb-1 relative z-10">仮見積書 (プレビュー)</h3>
                <p className="text-slate-300 text-sm relative z-10">{customer.name} 御中</p>
              </div>

              <div className="p-6 bg-white">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm mb-6">
                    <thead>
                      <tr className="border-b-2 border-slate-800">
                        <th className="text-left py-2 font-bold text-slate-700">内容</th>
                        <th className="text-right py-2 font-bold text-slate-700 w-16">数量</th>
                        <th className="text-right py-2 font-bold text-slate-700 w-24">金額</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {estimate.details.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3 pr-2 text-slate-700 font-medium">
                            {item.name}
                            <div className="text-xs text-slate-400 mt-0.5 font-mono">@{typeof item.amount === "number" ? yen(item.amount) : item.amount}</div>
                          </td>
                          <td className="py-3 text-right text-slate-600 whitespace-nowrap">
                            {item.qty} {item.unit}
                          </td>
                          <td className="py-3 text-right font-bold text-slate-800 whitespace-nowrap">{item.subtotal > 0 ? yen(item.subtotal) : "要見積"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="bg-slate-50 rounded-lg p-5 mt-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-bold text-slate-500">小計</span>
                    <span className="text-lg font-bold text-slate-700">{yen(estimate.total)}</span>
                  </div>
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-sm font-bold text-slate-500">消費税 (10%)</span>
                    <span className="text-lg font-bold text-slate-700">{yen(tax)}</span>
                  </div>
                  <div className="flex justify-between items-end border-t-2 border-slate-800 pt-4">
                    <span className="font-bold text-slate-800 text-lg">概算合計</span>
                    <span className="text-3xl sm:text-4xl font-black text-blue-700 tracking-tight">{yen(total)}</span>
                  </div>
                </div>
                <div className="text-right text-xs text-slate-400 mt-4">※別途、交通費等の実費がかかる場合があります。</div>
              </div>
              <div className="bg-white p-5 border-t border-slate-200">
                <Button className="w-full py-4 text-lg shadow-lg" icon={Save} onClick={handleSave} loading={saving} disabled={readOnly}>
                  この内容でシートに保存する
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
