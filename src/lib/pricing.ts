import type { EstimateDetail } from "./types";

// 料金体系.pdf 準拠
export const PRICING = {
  basic: {
    3: { pilot: 30000, manager: 20000, assistant: 15000, mini5: 15000 },
    7: { pilot: 20000, manager: 10000, assistant: 5000, mini5: 10000 },
  },
  operation: { plan: 15000, specialPermit: 30000 },
  risk: { low: 5000, high: 10000 },
  options: { photoEdit: 5000, videoEdit: 25000, reserveDay: 15000 },
} as const;

export const TAX_RATE = 0.1;

export type EstimateForm = {
  plan: 3 | 7;
  pilotCount: number;
  managerCount: number;
  assistantCount: number;
  droneMini5: number;
  droneOther: boolean;
  flightPlan: boolean;
  specialPermit: boolean;
  envLowRisk: boolean;
  envHighRisk: boolean;
  editPhoto: boolean;
  editVideo: boolean;
  reserveDay: boolean;
};

export const DEFAULT_ESTIMATE_FORM: EstimateForm = {
  plan: 3,
  pilotCount: 1,
  managerCount: 1,
  assistantCount: 0,
  droneMini5: 1,
  droneOther: false,
  flightPlan: true,
  specialPermit: false,
  envLowRisk: false,
  envHighRisk: false,
  editPhoto: false,
  editVideo: false,
  reserveDay: false,
};

export function calcEstimate(form: EstimateForm): { details: EstimateDetail[]; total: number } {
  const details: EstimateDetail[] = [];
  let total = 0;
  const p = PRICING.basic[form.plan];

  const addRow = (name: string, amount: number, qty = 1, unit = "式") => {
    if (qty <= 0) return;
    const subtotal = amount * qty;
    details.push({ name, amount, qty, unit, subtotal });
    total += subtotal;
  };

  addRow(`基本飛行費(操縦士) ${form.plan}時間`, p.pilot, form.pilotCount, "名");
  addRow(`安全管理費(安全管理者) ${form.plan}時間`, p.manager, form.managerCount, "名");
  addRow(`安全管理費(安全管理補助者) ${form.plan}時間`, p.assistant, form.assistantCount, "名");
  addRow("機体使用料(DJI Mini 5 Pro)", p.mini5, form.droneMini5, "台");
  if (form.droneOther) details.push({ name: "機体使用料(その他機体)", amount: "要見積", qty: 1, unit: "式", subtotal: 0 });
  if (form.flightPlan) addRow("基本運航・安全管理計画費", PRICING.operation.plan);
  if (form.specialPermit) addRow("特殊飛行申請費", PRICING.operation.specialPermit);
  if (form.envLowRisk) addRow("特殊環境加算(低リスク)", PRICING.risk.low);
  if (form.envHighRisk) addRow("特殊環境加算(高リスク)", PRICING.risk.high);
  if (form.editPhoto) addRow("簡易写真編集", PRICING.options.photoEdit);
  if (form.editVideo) addRow("簡易動画編集", PRICING.options.videoEdit);
  if (form.reserveDay) addRow("予備日確保費", PRICING.options.reserveDay);

  return { details, total };
}

export function withTax(subtotal: number) {
  const tax = Math.floor(subtotal * TAX_RATE);
  return { tax, total: subtotal + tax };
}
