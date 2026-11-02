"use client";

import { ArrowLeft, Plus, Printer, Trash2 } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { formatDate, yen } from "@/lib/format";
import {
  adjustRange,
  itemToLine,
  lineSubtotal,
  PRICE_GROUP_LABEL,
  sumLines,
  VERDICT_LABEL,
  withTax,
  type ContractData,
  type EstimateConfig,
  type EstimateData,
  type Line,
  type Verdict,
} from "@/lib/estimate";
import type { CustomerBase } from "@/lib/types";
import { Button, inputClass } from "./ui";

const VERDICT_STYLE: Record<Verdict, string> = {
  ok: "bg-emerald-100 text-emerald-800 border-emerald-300",
  permit: "bg-amber-100 text-amber-800 border-amber-300",
  ng: "bg-red-100 text-red-800 border-red-300",
};

export function VerdictBadge({ verdict, large }: { verdict: Verdict; large?: boolean }) {
  return (
    <span className={`inline-block border rounded-full font-bold whitespace-nowrap ${VERDICT_STYLE[verdict]} ${large ? "px-4 py-1.5 text-base" : "px-2.5 py-0.5 text-xs"}`}>
      {VERDICT_LABEL[verdict]}
    </span>
  );
}

const smallInput = "w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none";

/**
 * Editable list of estimate lines.
 * mode "sales": catalog items keep their name and the unit price is limited to the allowed range.
 * mode "admin": everything is editable and discount lines can be added.
 */
export function LineEditor({
  lines,
  onChange,
  config,
  mode,
  disabled,
}: {
  lines: Line[];
  onChange: (lines: Line[]) => void;
  config: EstimateConfig;
  mode: "sales" | "admin";
  disabled?: boolean;
}) {
  const [pick, setPick] = useState("");
  const catalog = new Map(config.priceItems.map((i) => [i.id, i]));
  const set = (idx: number, patch: Partial<Line>) => onChange(lines.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  const remove = (idx: number) => onChange(lines.filter((_, i) => i !== idx));
  const addCatalog = () => {
    const item = catalog.get(pick);
    if (item) onChange([...lines, itemToLine(item, item.defaultQty || 1)]);
    setPick("");
  };
  const addPercentDiscount = () => {
    const pct = Number(prompt("値引率（％）を入力してください", "10"));
    if (!Number.isFinite(pct) || pct <= 0) return;
    const base = sumLines(lines.filter((l) => !l.discount));
    onChange([...lines, { name: `お値引き（${pct}%）`, unitPrice: Math.round((base * pct) / 100), qty: 1, unit: "式", discount: true }]);
  };

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="border-b-2 border-slate-300 text-slate-600">
              <th className="text-left py-2 font-bold">項目</th>
              <th className="text-right py-2 font-bold w-36">単価</th>
              <th className="text-right py-2 font-bold w-20">数量</th>
              <th className="text-left py-2 font-bold w-16 pl-2">単位</th>
              <th className="text-right py-2 font-bold w-28">金額</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lines.map((l, idx) => {
              const item = l.itemId ? catalog.get(l.itemId) : undefined;
              const range = mode === "sales" && item ? adjustRange(item.unitPrice, config.salesAdjustPct) : null;
              const out = range && (l.unitPrice < range[0] || l.unitPrice > range[1]);
              const lockName = mode === "sales" && !!item;
              return (
                <tr key={idx} className={l.discount ? "bg-red-50/40" : ""}>
                  <td className="py-2 pr-2">
                    {lockName ? (
                      <span className="font-medium text-slate-800">{l.name}</span>
                    ) : (
                      <input className={smallInput} value={l.name} onChange={(e) => set(idx, { name: e.target.value })} disabled={disabled} />
                    )}
                    {l.discount && <span className="text-xs text-red-600 font-bold">値引き</span>}
                  </td>
                  <td className="py-2 pl-2 text-right align-top">
                    <input
                      type="number"
                      min={range ? range[0] : 0}
                      max={range ? range[1] : undefined}
                      className={`${smallInput} text-right ${out ? "border-red-500 bg-red-50" : ""}`}
                      value={l.unitPrice}
                      onChange={(e) => set(idx, { unitPrice: Math.max(0, Math.round(Number(e.target.value) || 0)) })}
                      disabled={disabled}
                    />
                    {range && (
                      <div className={`text-[11px] mt-0.5 ${out ? "text-red-600 font-bold" : "text-slate-400"}`}>
                        基準 {yen(item!.unitPrice)}（{yen(range[0])}〜{yen(range[1])}）
                      </div>
                    )}
                    {mode === "admin" && item && l.unitPrice !== item.unitPrice && <div className="text-[11px] text-slate-400 mt-0.5">基準 {yen(item.unitPrice)}</div>}
                  </td>
                  <td className="py-2 pl-2 align-top">
                    <input
                      type="number"
                      min={0}
                      step="any"
                      className={`${smallInput} text-right`}
                      value={l.qty}
                      onChange={(e) => set(idx, { qty: Math.max(0, Number(e.target.value) || 0) })}
                      disabled={disabled}
                    />
                  </td>
                  <td className="py-2 pl-2 align-top">
                    <input className={smallInput} value={l.unit} onChange={(e) => set(idx, { unit: e.target.value })} disabled={disabled || lockName} />
                  </td>
                  <td className={`py-2 text-right font-bold whitespace-nowrap align-top pt-3.5 ${l.discount ? "text-red-600" : "text-slate-800"}`}>{yen(lineSubtotal(l))}</td>
                  <td className="py-2 text-right align-top">
                    <button type="button" onClick={() => remove(idx)} disabled={disabled} className="p-2 text-slate-400 hover:text-red-600" aria-label="削除">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
            {lines.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-slate-400">
                  項目がありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {!disabled && (
        <div className="flex flex-wrap gap-2 items-center">
          <select className={`${smallInput} !w-auto`} value={pick} onChange={(e) => setPick(e.target.value)}>
            <option value="">料金表から項目を選ぶ...</option>
            {(Object.keys(PRICE_GROUP_LABEL) as (keyof typeof PRICE_GROUP_LABEL)[]).map((g) => (
              <optgroup key={g} label={PRICE_GROUP_LABEL[g]}>
                {config.priceItems
                  .filter((i) => i.group === g)
                  .map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}（{yen(i.unitPrice)}/{i.unit}）
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
          <Button variant="secondary" icon={Plus} onClick={addCatalog} disabled={!pick}>
            追加
          </Button>
          <Button variant="secondary" icon={Plus} onClick={() => onChange([...lines, { name: "", unitPrice: 0, qty: 1, unit: "式" }])}>
            自由項目
          </Button>
          {mode === "admin" && (
            <>
              <Button variant="secondary" icon={Plus} onClick={() => onChange([...lines, { name: "お値引き", unitPrice: 0, qty: 1, unit: "式", discount: true }])}>
                値引き（金額）
              </Button>
              <Button variant="secondary" icon={Plus} onClick={addPercentDiscount}>
                値引き（％）
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function Totals({ lines, taxRate }: { lines: Line[]; taxRate: number }) {
  const subtotal = sumLines(lines);
  const { tax, total } = withTax(subtotal, taxRate);
  return (
    <div className="bg-slate-50 rounded-lg p-4 space-y-1.5">
      <div className="flex justify-between text-sm">
        <span className="text-slate-500 font-bold">小計（税抜）</span>
        <span className="font-bold text-slate-700">{yen(subtotal)}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-slate-500 font-bold">消費税（{Math.round(taxRate * 100)}%）</span>
        <span className="font-bold text-slate-700">{yen(tax)}</span>
      </div>
      <div className="flex justify-between items-end border-t-2 border-slate-800 pt-2">
        <span className="font-bold text-slate-800">合計（税込）</span>
        <span className="text-2xl font-black text-blue-700">{yen(total)}</span>
      </div>
    </div>
  );
}

export function PageHeader({ onBack, title, children }: { onBack: () => void; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
      <div className="flex items-center gap-4 min-w-0">
        <button onClick={onBack} className="flex items-center text-slate-500 hover:text-blue-600 transition-colors font-medium shrink-0">
          <ArrowLeft className="w-4 h-4 mr-1" /> 戻る
        </button>
        <h2 className="text-lg sm:text-xl font-bold text-slate-800 min-w-0 break-all">{title}</h2>
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

// ---------- printable documents ----------

export type PrintDoc =
  | { kind: "provisional" | "final"; docNo: string; date: string; title: string; data: EstimateData }
  | { kind: "contract"; docNo: string; date: string; title: string; data: ContractData; confirmed: boolean; confirmedAt: string };

const DOC_TITLE = { provisional: "仮見積書", final: "御見積書", contract: "業務委託契約書" };

function LinesTable({ lines }: { lines: Line[] }) {
  return (
    <table className="w-full text-[13px] border-collapse">
      <thead>
        <tr className="bg-slate-100">
          <th className="border border-slate-400 px-2 py-1.5 text-left">品目</th>
          <th className="border border-slate-400 px-2 py-1.5 text-right w-16">数量</th>
          <th className="border border-slate-400 px-2 py-1.5 w-12">単位</th>
          <th className="border border-slate-400 px-2 py-1.5 text-right w-24">単価</th>
          <th className="border border-slate-400 px-2 py-1.5 text-right w-28">金額</th>
        </tr>
      </thead>
      <tbody>
        {lines.map((l, i) => (
          <tr key={i} className="print-avoid-break">
            <td className="border border-slate-300 px-2 py-1.5">{l.name}</td>
            <td className="border border-slate-300 px-2 py-1.5 text-right">{l.qty}</td>
            <td className="border border-slate-300 px-2 py-1.5 text-center">{l.unit}</td>
            <td className="border border-slate-300 px-2 py-1.5 text-right">{l.discount ? `-${yen(l.unitPrice)}` : yen(l.unitPrice)}</td>
            <td className="border border-slate-300 px-2 py-1.5 text-right">{yen(lineSubtotal(l))}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <tr className="print-avoid-break">
      <th className="border border-slate-300 bg-slate-50 px-3 py-1.5 text-left w-32 align-top font-bold">{label}</th>
      <td className="border border-slate-300 px-3 py-1.5 whitespace-pre-wrap">{children || "—"}</td>
    </tr>
  );
}

/** Full-screen A4 preview rendered at <body> level so that only the document is printed. */
export function DocumentPreview({ doc, customer, config, onClose }: { doc: PrintDoc; customer: CustomerBase; config: EstimateConfig; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);
  if (!mounted) return null;

  const lines = doc.data.lines;
  const subtotal = sumLines(lines);
  const { tax, total } = withTax(subtotal, config.taxRate);
  const isContract = doc.kind === "contract";

  return createPortal(
    <div className="print-root fixed inset-0 z-[90] bg-slate-500/80 overflow-auto">
      <div className="no-print sticky top-0 z-10 bg-slate-900 text-white px-4 py-3 flex items-center justify-between gap-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <button onClick={onClose} className="flex items-center gap-1 text-sm font-medium hover:text-blue-300">
          <ArrowLeft className="w-4 h-4" /> 閉じる
        </button>
        <span className="text-sm font-bold">{DOC_TITLE[doc.kind]}（{isContract ? "契約書" : "お客様用"}）</span>
        <Button icon={Printer} onClick={() => window.print()}>
          印刷 / PDF保存
        </Button>
      </div>

      <div className="print-sheet bg-white text-slate-900 mx-auto my-6 shadow-2xl w-[210mm] max-w-full min-h-[297mm] p-[14mm] relative">
        {isContract && !doc.confirmed && (
          <div className="absolute top-6 right-6 border-2 border-red-500 text-red-500 font-black px-3 py-1 rotate-6 text-lg">下書き</div>
        )}
        <h1 className="text-center text-2xl font-black tracking-[0.4em] border-b-4 border-double border-slate-800 pb-3 mb-6">{DOC_TITLE[doc.kind]}</h1>

        <div className="flex justify-between gap-6 mb-6 text-sm">
          <div className="min-w-0">
            <p className="text-lg font-bold border-b border-slate-800 pb-1 mb-2 break-all">{customer.name} 御中</p>
            {customer.contactPerson && <p>{customer.contactPerson} 様</p>}
            {customer.address && <p className="text-xs text-slate-600 mt-1">{customer.address}</p>}
          </div>
          <div className="text-right shrink-0 max-w-[45%]">
            <p className="text-xs text-slate-600">No. {doc.docNo}</p>
            <p className="text-xs text-slate-600 mb-3">{isContract ? "契約日" : "発行日"}：{formatDate(doc.date)}</p>
            <p className="font-bold">{config.companyName}</p>
            <p className="text-xs text-slate-600 whitespace-pre-wrap">{config.companyInfo}</p>
          </div>
        </div>

        {!isContract && (
          <p className="text-sm mb-3">
            件名：<span className="font-bold">{doc.title}</span>
            <br />
            下記のとおり{doc.kind === "provisional" ? "概算" : ""}お見積り申し上げます。
          </p>
        )}
        {isContract && (
          <p className="text-sm mb-4 leading-relaxed">
            {customer.name}（以下「委託者」という）と{config.companyName}（以下「受託者」という）は、以下の業務について次のとおり契約を締結する。
          </p>
        )}

        <div className="flex items-end justify-between border-2 border-slate-800 px-4 py-3 mb-5">
          <span className="font-bold">{isContract ? "契約金額（税込）" : doc.kind === "provisional" ? "概算金額（税込）" : "御見積金額（税込）"}</span>
          <span className="text-2xl font-black">{yen(total)}</span>
        </div>

        {doc.kind === "contract" && (
          <table className="w-full text-[13px] border-collapse mb-5">
            <tbody>
              <Row label="業務内容">{doc.title}</Row>
              <Row label="作業日">{doc.data.workDate}</Row>
              <Row label="作業場所">{doc.data.workPlace}</Row>
              <Row label="成果物">{doc.data.deliverables}</Row>
              <Row label="支払期日">{formatDate(doc.data.paymentDue)}</Row>
              <Row label="支払方法">{doc.data.paymentMethod}</Row>
            </tbody>
          </table>
        )}
        {doc.kind !== "contract" && (doc.data.location || doc.data.workDate || doc.data.validUntil) && (
          <table className="w-full text-[13px] border-collapse mb-5">
            <tbody>
              {doc.data.location && <Row label="飛行場所">{doc.data.location}</Row>}
              {doc.data.workDate && <Row label="実施予定日">{doc.data.workDate}</Row>}
              {doc.data.validUntil && <Row label="有効期限">{formatDate(doc.data.validUntil)}</Row>}
            </tbody>
          </table>
        )}

        <LinesTable lines={lines} />
        <div className="flex justify-end mt-2 mb-5">
          <table className="text-[13px] border-collapse w-64">
            <tbody>
              <tr>
                <th className="border border-slate-300 bg-slate-50 px-2 py-1 text-left">小計</th>
                <td className="border border-slate-300 px-2 py-1 text-right">{yen(subtotal)}</td>
              </tr>
              <tr>
                <th className="border border-slate-300 bg-slate-50 px-2 py-1 text-left">消費税（{Math.round(config.taxRate * 100)}%）</th>
                <td className="border border-slate-300 px-2 py-1 text-right">{yen(tax)}</td>
              </tr>
              <tr>
                <th className="border border-slate-400 bg-slate-100 px-2 py-1 text-left">合計</th>
                <td className="border border-slate-400 px-2 py-1 text-right font-bold">{yen(total)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {doc.kind !== "contract" && doc.data.answers && doc.data.answers.length > 0 && (
          <div className="mb-5 print-avoid-break">
            <h2 className="font-bold text-sm border-l-4 border-slate-800 pl-2 mb-2 flex items-center gap-3">
              飛行条件の確認結果 {doc.data.verdict && <VerdictBadge verdict={doc.data.verdict} />}
            </h2>
            <table className="w-full text-[12px] border-collapse">
              <tbody>
                {doc.data.answers.map((a, i) => (
                  <Row key={i} label={a.category || "条件"}>
                    {a.answer}
                    {a.note && <span className="block text-slate-600">{a.note}</span>}
                  </Row>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {doc.kind === "final" && doc.data.judgeMemo && (
          <div className="mb-5 text-[13px] print-avoid-break">
            <h2 className="font-bold text-sm border-l-4 border-slate-800 pl-2 mb-2">運航上の確認事項</h2>
            <p className="whitespace-pre-wrap">{doc.data.judgeMemo}</p>
          </div>
        )}

        {doc.kind === "contract" && (
          <>
            {doc.data.terms && (
              <div className="mb-5 text-[12px] leading-relaxed">
                <h2 className="font-bold text-sm border-l-4 border-slate-800 pl-2 mb-2">契約条項</h2>
                <p className="whitespace-pre-wrap">{doc.data.terms}</p>
              </div>
            )}
            {doc.data.notes && (
              <div className="mb-5 text-[12px] print-avoid-break">
                <h2 className="font-bold text-sm border-l-4 border-slate-800 pl-2 mb-2">特記事項</h2>
                <p className="whitespace-pre-wrap">{doc.data.notes}</p>
              </div>
            )}
            <p className="text-[12px] mb-4">本契約の成立を証するため本書2通を作成し、双方記名押印のうえ各1通を保有する。</p>
            <div className="grid grid-cols-2 gap-6 text-[13px] print-avoid-break">
              {[
                ["委託者", customer.name],
                ["受託者", config.companyName],
              ].map(([role, name]) => (
                <div key={role} className="border border-slate-400 p-3 h-32 relative">
                  <p className="font-bold">{role}</p>
                  <p className="mt-2 break-all">{name}</p>
                  <span className="absolute right-3 bottom-3 w-14 h-14 border border-dashed border-slate-400 rounded-full flex items-center justify-center text-[10px] text-slate-400">印</span>
                </div>
              ))}
            </div>
            {doc.confirmed && <p className="text-right text-[11px] text-slate-500 mt-3">契約確定日時：{doc.confirmedAt}</p>}
          </>
        )}

        {doc.kind !== "contract" && (config.estimateNotes || doc.data.memo) && (
          <div className="text-[12px] text-slate-700 whitespace-pre-wrap border-t border-slate-300 pt-3 print-avoid-break">
            {doc.kind === "final" && doc.data.memo ? `${doc.data.memo}\n` : ""}
            {config.estimateNotes}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

export const textareaClass = `${inputClass} min-h-[90px]`;
