// Estimate workflow: flight-condition flow, price catalog and line calculations.
// The config is editable from the admin screen and stored in the Settings sheet.

export type Verdict = "ok" | "permit" | "ng";

export const VERDICT_LABEL: Record<Verdict, string> = {
  ok: "飛行可能",
  permit: "許可・承認申請が必要",
  ng: "飛行不可",
};

export const VERDICT_RANK: Record<Verdict, number> = { ok: 0, permit: 1, ng: 2 };

export const FLOW_CATEGORIES = { method: "飛行方法", place: "場所", airspace: "空域", other: "その他" } as const;
export type FlowCategory = keyof typeof FLOW_CATEGORIES;

export type FlowOption = {
  id: string;
  label: string;
  description: string;
  verdict: Verdict;
  /** Flight category 1-3 (カテゴリーⅠ〜Ⅲ); 0 = not applicable. */
  flightCategory: number;
  note: string;
  /** Price item ids added to the estimate when this option is chosen. */
  addItems: string[];
  /** Next question id. "" = the next question in list order, "end" = finish the check. */
  next: string;
  /** Customer tier id applied when this option is chosen (switches prices and printed terms). */
  tier?: string;
};

export type FlowQuestion = {
  id: string;
  category: FlowCategory;
  title: string;
  help: string;
  /** Shown only when an option jumps to it via `next` (e.g. follow-up questions). */
  branchOnly?: boolean;
  /** Several options can be chosen at once. */
  multiple?: boolean;
  /** Shown only when the category so far is one of these (empty = always). */
  showCategories?: number[];
  /** Shown only when one of these earlier choices ("questionId:optionId") was made (empty = always). */
  showIfAny?: string[];
  options: FlowOption[];
};

/** Customer tier (e.g. 通常・法人 / 教育・非営利) with its own prices and printed special terms. */
export type Tier = { id: string; label: string; note: string };

export type PriceGroup = "base" | "option" | "flow";
export const PRICE_GROUP_LABEL: Record<PriceGroup, string> = {
  base: "基本項目（人員・機材）",
  option: "オプション",
  flow: "飛行条件で自動追加",
};

export type PriceItem = {
  id: string;
  name: string;
  description: string;
  unitPrice: number;
  unit: string;
  defaultQty: number;
  group: PriceGroup;
  /** Plan id this item belongs to; "" = all plans. */
  plan: string;
  /** Unit price per customer tier id; missing = unitPrice. */
  tierPrices?: Record<string, number>;
};

export type Plan = { id: string; label: string; description: string };

export type EstimateConfig = {
  companyName: string;
  companyInfo: string;
  taxRate: number;
  /** Sales accounts may change catalog unit prices within ±this percent. */
  salesAdjustPct: number;
  /** Sales may lower catalog prices by up to this percent. */
  salesDiscountPct: number;
  /** Sales may raise catalog prices by up to this percent. */
  salesMarkupPct: number;
  tiers: Tier[];
  estimateNotes: string;
  contractTerms: string;
  plans: Plan[];
  priceItems: PriceItem[];
  questions: FlowQuestion[];
  /** Team names selectable for customers and accounts. */
  teams: string[];
};

export type Line = {
  itemId?: string;
  name: string;
  basePrice?: number;
  unitPrice: number;
  qty: number;
  unit: string;
  discount?: boolean;
};

export type FlowAnswer = {
  questionId: string;
  optionId: string;
  category: string;
  question: string;
  answer: string;
  verdict: Verdict;
  flightCategory?: number;
  note: string;
};

export type EstimateData = {
  answers?: FlowAnswer[];
  verdict?: Verdict;
  flightCategory?: number;
  planId?: string;
  tier?: string;
  lines: Line[];
  location?: string;
  workDate?: string;
  validUntil?: string;
  memo?: string;
  judgeMemo?: string;
};

export type ContractData = {
  lines: Line[];
  paymentDue: string;
  paymentMethod: string;
  workDate: string;
  workPlace: string;
  deliverables: string;
  terms: string;
  notes: string;
};

const opt = (id: string, label: string, verdict: Verdict, extra: Partial<FlowOption> = {}): FlowOption => ({
  id,
  label,
  description: "",
  verdict,
  flightCategory: defaultCategory(verdict),
  note: "",
  addItems: [],
  next: "",
  ...extra,
});

function defaultCategory(verdict: Verdict): number {
  return verdict === "permit" ? 2 : verdict === "ok" ? 1 : 0;
}

export const CATEGORY_LABEL: Record<number, string> = { 1: "カテゴリーⅠ", 2: "カテゴリーⅡ", 3: "カテゴリーⅢ" };

/** The flight's category is the highest category among the chosen options. */
export function maxCategory(answers: { flightCategory?: number }[]): number {
  return answers.reduce((m, a) => Math.max(m, a.flightCategory || 0), 0);
}

/** Display order of answers: 飛行方法 → 場所 → 空域 → その他 (stable within a category). */
export function sortAnswers<T extends { category: string }>(answers: T[]): T[] {
  const order: string[] = Object.values(FLOW_CATEGORIES);
  const rank = (c: string) => (order.includes(c) ? order.indexOf(c) : order.length);
  return answers.map((a, i) => ({ a, i })).sort((x, y) => rank(x.a.category) - rank(y.a.category) || x.i - y.i).map((x) => x.a);
}

export const DEFAULT_CONFIG: EstimateConfig = {
  companyName: "SKY-PORTAL ドローン事業部",
  companyInfo: "〒000-0000 住所を管理者画面で設定してください\nTEL 00-0000-0000",
  taxRate: 0.1,
  salesAdjustPct: 10,
  salesDiscountPct: 10,
  salesMarkupPct: 10,
  tiers: [],
  estimateNotes: "※本書は概算です。飛行条件の確認後、正式なお見積り（本見積）をお送りします。\n※交通費・宿泊費等の実費は別途ご請求となる場合があります。",
  contractTerms: [
    "第1条（業務内容） 受託者は、本契約書記載の業務を誠実に遂行する。",
    "第2条（代金の支払） 委託者は、契約金額を支払期日までに指定の方法で支払う。",
    "第3条（天候等による延期） 天候不良その他安全上の理由により飛行が困難な場合、受託者は業務を延期できる。延期に伴う追加費用は別途協議する。",
    "第4条（成果物の権利） 成果物の著作権は、代金の完済をもって委託者に移転する。",
    "第5条（損害賠償） 受託者の責めに帰すべき事由により委託者に損害が生じた場合、契約金額を上限として賠償する。",
    "第6条（協議） 本契約に定めのない事項は、双方誠意をもって協議し解決する。",
  ].join("\n"),
  plans: [
    { id: "3h", label: "3時間プラン", description: "半日程度の撮影に" },
    { id: "7h", label: "7時間プラン", description: "1日がかりの撮影に" },
  ],
  priceItems: [
    { id: "pilot3", name: "基本飛行費（操縦士）3時間", description: "", unitPrice: 30000, unit: "名", defaultQty: 1, group: "base", plan: "3h" },
    { id: "manager3", name: "安全管理費（安全管理者）3時間", description: "", unitPrice: 20000, unit: "名", defaultQty: 1, group: "base", plan: "3h" },
    { id: "assistant3", name: "安全管理費（安全管理補助者）3時間", description: "", unitPrice: 15000, unit: "名", defaultQty: 0, group: "base", plan: "3h" },
    { id: "mini5_3", name: "機体使用料（DJI Mini 5 Pro）3時間", description: "", unitPrice: 15000, unit: "台", defaultQty: 1, group: "base", plan: "3h" },
    { id: "pilot7", name: "基本飛行費（操縦士）7時間", description: "", unitPrice: 20000, unit: "名", defaultQty: 1, group: "base", plan: "7h" },
    { id: "manager7", name: "安全管理費（安全管理者）7時間", description: "", unitPrice: 10000, unit: "名", defaultQty: 1, group: "base", plan: "7h" },
    { id: "assistant7", name: "安全管理費（安全管理補助者）7時間", description: "", unitPrice: 5000, unit: "名", defaultQty: 0, group: "base", plan: "7h" },
    { id: "mini5_7", name: "機体使用料（DJI Mini 5 Pro）7時間", description: "", unitPrice: 10000, unit: "台", defaultQty: 1, group: "base", plan: "7h" },
    { id: "plan", name: "基本運航・安全管理計画費", description: "机上ロケハン、飛行計画通報、飛行日誌作成など", unitPrice: 15000, unit: "式", defaultQty: 1, group: "base", plan: "" },
    { id: "photoEdit", name: "簡易写真編集", description: "ベストショットのセレクト、トリミング、色調補正", unitPrice: 5000, unit: "式", defaultQty: 1, group: "option", plan: "" },
    { id: "videoEdit", name: "簡易動画編集", description: "不要部分のカット、色調補正", unitPrice: 25000, unit: "式", defaultQty: 1, group: "option", plan: "" },
    { id: "reserveDay", name: "予備日確保費", description: "天候不良による順延に備えたスケジュールキープ", unitPrice: 15000, unit: "式", defaultQty: 1, group: "option", plan: "" },
    { id: "specialPermit", name: "特殊飛行申請費", description: "国土交通省への許可・承認申請", unitPrice: 30000, unit: "式", defaultQty: 1, group: "flow", plan: "" },
    { id: "riskLow", name: "特殊環境加算（低リスク）", description: "夜間・目視外・屋内など", unitPrice: 5000, unit: "式", defaultQty: 1, group: "flow", plan: "" },
    { id: "riskHigh", name: "特殊環境加算（高リスク）", description: "水上・海上・山間部・森林など", unitPrice: 10000, unit: "式", defaultQty: 1, group: "flow", plan: "" },
    { id: "localPermit", name: "土地管理者等との調整費", description: "公園・河川・道路管理者等への許可申請", unitPrice: 10000, unit: "式", defaultQty: 1, group: "flow", plan: "" },
  ],
  teams: [],
  questions: [
    {
      id: "method",
      category: "method",
      title: "どのような方法で飛行しますか？",
      help: "最も条件の厳しいものを選んでください。",
      options: [
        opt("day", "日中・目視内の通常飛行", "ok"),
        opt("night", "夜間飛行（日没後〜日出前）", "permit", { addItems: ["specialPermit", "riskLow"], note: "夜間飛行の承認が必要です。" }),
        opt("bvlos", "目視外飛行（モニターを見ながら等）", "permit", { addItems: ["specialPermit", "riskLow"], next: "bvlosAssist" }),
        opt("near", "人・建物・車両から30m未満", "permit", { addItems: ["specialPermit"], note: "30m未満飛行の承認が必要です。" }),
        opt("third", "第三者上空（立入管理措置なし）", "permit", {
          addItems: ["specialPermit"],
          flightCategory: 3,
          note: "カテゴリーⅢ飛行です。一等無人航空機操縦士と第一種機体認証、飛行ごとの許可・承認が必要です。",
        }),
        opt("drop", "物件投下・危険物輸送", "permit", { addItems: ["specialPermit"], note: "物件投下・危険物輸送の承認が必要です。" }),
      ],
    },
    {
      id: "bvlosAssist",
      category: "method",
      branchOnly: true,
      title: "目視外飛行で補助者を配置できますか？",
      help: "",
      options: [
        opt("yes", "補助者を配置できる", "permit", { note: "目視外飛行の承認が必要です（補助者配置）。", next: "place" }),
        opt("no", "補助者を配置できない", "permit", { note: "補助者なし目視外飛行は高度な体制が必要です。本見積時に要確認。", next: "place" }),
      ],
    },
    {
      id: "place",
      category: "place",
      title: "どこで飛行しますか？",
      help: "",
      options: [
        opt("private", "私有地・自社敷地（所有者の許可あり）", "ok"),
        opt("park", "公園・河川敷・海岸", "permit", { flightCategory: 1, addItems: ["localPermit"], note: "土地管理者（自治体等）の許可が必要な場合があります。" }),
        opt("event", "イベント会場（催し場所の上空）", "permit", { addItems: ["specialPermit"], note: "催し場所上空飛行の承認が必要です。" }),
        opt("water", "水上・海上", "ok", { addItems: ["riskHigh"] }),
        opt("mountain", "山間部・森林", "ok", { addItems: ["riskHigh"] }),
        opt("road", "道路・線路の上空", "permit", { flightCategory: 1, addItems: ["localPermit"], note: "道路使用許可・管理者との協議が必要です。" }),
        opt("indoor", "屋内（四方・上部が囲まれた場所）", "ok", { flightCategory: 0, addItems: ["riskLow"], note: "屋内は航空法の対象外です。", next: "end" }),
        opt("restricted", "国の重要施設・防衛関係施設・原子力発電所の周辺", "ng", { note: "小型無人機等飛行禁止法により原則飛行できません。" }),
      ],
    },
    {
      id: "airspace",
      category: "airspace",
      title: "飛行する空域を選んでください",
      help: "地理院地図等で人口集中地区（DID）・空港周辺を確認してください。",
      options: [
        opt("normal", "人口集中地区外・高度150m未満", "ok"),
        opt("did", "人口集中地区（DID）内", "permit", { addItems: ["specialPermit"], note: "DID上空飛行の許可が必要です。" }),
        opt("airport", "空港等の周辺（進入表面等）", "permit", { addItems: ["specialPermit"], note: "空港周辺飛行の許可と空港管理者との調整が必要です。" }),
        opt("high", "地表・水面から150m以上", "permit", { addItems: ["specialPermit"], note: "150m以上の飛行許可が必要です。" }),
        opt("emergency", "緊急用務空域（災害時等に指定）", "ng", { note: "緊急用務空域が指定されている間は飛行できません。" }),
      ],
    },
  ],
};

export function parseConfig(raw: unknown): EstimateConfig {
  if (!raw || typeof raw !== "object") return DEFAULT_CONFIG;
  const c = raw as Partial<EstimateConfig>;
  return {
    ...DEFAULT_CONFIG,
    ...c,
    plans: Array.isArray(c.plans) ? c.plans : DEFAULT_CONFIG.plans,
    priceItems: Array.isArray(c.priceItems) ? c.priceItems : DEFAULT_CONFIG.priceItems,
    questions: (Array.isArray(c.questions) ? c.questions : DEFAULT_CONFIG.questions).map((q) => ({
      ...q,
      options: q.options.map((o) => ({ ...o, flightCategory: typeof o.flightCategory === "number" ? o.flightCategory : defaultCategory(o.verdict) })),
    })),
    teams: Array.isArray(c.teams) ? c.teams : [],
    tiers: Array.isArray(c.tiers) ? c.tiers : [],
    salesDiscountPct: typeof c.salesDiscountPct === "number" ? c.salesDiscountPct : (c.salesAdjustPct ?? DEFAULT_CONFIG.salesAdjustPct),
    salesMarkupPct: typeof c.salesMarkupPct === "number" ? c.salesMarkupPct : (c.salesAdjustPct ?? DEFAULT_CONFIG.salesAdjustPct),
  };
}

const answerKey = (questionId: string, optionId: string) => `${questionId}:${optionId}`;

/** Whether a question's display conditions hold for the answers so far. */
export function questionVisible(q: FlowQuestion, answers: FlowAnswer[]): boolean {
  if (q.showCategories?.length && !q.showCategories.includes(maxCategory(answers))) return false;
  if (q.showIfAny?.length) {
    const chosen = new Set(answers.map((a) => answerKey(a.questionId, a.optionId)));
    if (!q.showIfAny.some((k) => chosen.has(k))) return false;
  }
  return true;
}

function firstVisibleFrom(config: EstimateConfig, start: number, answers: FlowAnswer[], allowBranch: boolean): FlowQuestion | null {
  for (let i = start; i < config.questions.length; i++) {
    const q = config.questions[i];
    if ((allowBranch && i === start) || !q.branchOnly) {
      if (questionVisible(q, answers)) return q;
    }
  }
  return null;
}

export function firstQuestion(config: EstimateConfig): FlowQuestion | null {
  return firstVisibleFrom(config, 0, [], false);
}

/** Options chosen for the last answered question (a multi-select question yields several). */
export function lastChoice(config: EstimateConfig, answers: FlowAnswer[]): { question: FlowQuestion; options: FlowOption[] } | null {
  const last = answers[answers.length - 1];
  const question = last && config.questions.find((q) => q.id === last.questionId);
  if (!question) return null;
  const ids = new Set(answers.slice(answers.findIndex((a) => a.questionId === last.questionId)).map((a) => a.optionId));
  const options = question.options.filter((o) => ids.has(o.id));
  return options.length ? { question, options } : null;
}

/** Longest prefix of answers that follows the configured flow (order, visibility, single/multi choice). */
export function validAnswerPrefix(config: EstimateConfig, answers: FlowAnswer[]): FlowAnswer[] {
  let expected = firstQuestion(config);
  let i = 0;
  while (expected && i < answers.length) {
    const q = expected;
    let j = i;
    while (j < answers.length && answers[j].questionId === q.id) j++;
    const group = answers.slice(i, j);
    const options = group.map((a) => q.options.find((o) => o.id === a.optionId));
    if (group.length === 0 || (!q.multiple && group.length > 1) || options.some((o) => !o) || new Set(group.map((a) => a.optionId)).size !== group.length) break;
    i = j;
    expected = nextQuestion(config, q, options as FlowOption[], answers.slice(0, i));
  }
  return answers.slice(0, i);
}

/** The tier set by the latest answer that sets one ("" = none). */
export function currentTier(config: EstimateConfig, answers: FlowAnswer[]): string {
  let tier = "";
  for (const a of answers) {
    const o = config.questions.find((q) => q.id === a.questionId)?.options.find((op) => op.id === a.optionId);
    if (o?.tier) tier = o.tier;
  }
  return tier;
}

export function tierPrice(item: PriceItem, tier: string | undefined): number {
  const p = tier ? item.tierPrices?.[tier] : undefined;
  return typeof p === "number" ? p : item.unitPrice;
}

/** Next question after choosing `option` on `question`, or null when the check is finished. */
export function nextQuestion(config: EstimateConfig, question: FlowQuestion, chosen: FlowOption[], answers: FlowAnswer[]): FlowQuestion | null {
  if (chosen.some((o) => o.verdict === "ng" || o.next === "end")) return null;
  const jump = chosen.find((o) => o.next)?.next;
  const target = jump ? config.questions.findIndex((q) => q.id === jump) : -1;
  if (target >= 0) return firstVisibleFrom(config, target, answers, true);
  const idx = config.questions.findIndex((q) => q.id === question.id);
  return firstVisibleFrom(config, idx + 1, answers, false);
}

export function worstVerdict(answers: { verdict: Verdict }[]): Verdict {
  return answers.reduce<Verdict>((w, a) => (VERDICT_RANK[a.verdict] > VERDICT_RANK[w] ? a.verdict : w), "ok");
}

export const lineSubtotal = (l: Line) => (l.discount ? -1 : 1) * Math.round(l.unitPrice * l.qty);

export function sumLines(lines: Line[]): number {
  return lines.reduce((s, l) => s + lineSubtotal(l), 0);
}

export function withTax(subtotal: number, rate = 0.1) {
  const tax = Math.floor(Math.max(0, subtotal) * rate);
  return { tax, total: subtotal + tax };
}

export function adjustRange(basePrice: number, downPct: number, upPct: number): [number, number] {
  return [Math.ceil(basePrice * (1 - downPct / 100)), Math.floor(basePrice * (1 + upPct / 100))];
}

export function itemToLine(item: PriceItem, qty = item.defaultQty, tier?: string): Line {
  const price = tierPrice(item, tier);
  return { itemId: item.id, name: item.name, basePrice: price, unitPrice: price, qty, unit: item.unit };
}

export const newKey = () => Math.random().toString(36).slice(2, 8);
