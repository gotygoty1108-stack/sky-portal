import { backend, type SheetName } from "./backend";
import { login } from "./accounts";
import { clearLoginFailures, isLoginLocked, recordLoginFailure } from "./login-limit";
import { UserError, withLock } from "./portal";
import { ROLE_ADMIN, type User } from "@/lib/types";

export const DELETE_KINDS = { customer: "顧客", estimate: "見積", contract: "契約", record: "業務請負記録" } as const;
export type DeleteKind = keyof typeof DELETE_KINDS;

const SHEET: Record<DeleteKind, SheetName> = { customer: "Customers", estimate: "Estimates", contract: "Contracts", record: "Records" };
const s = (v: unknown) => (typeof v === "string" || typeof v === "number" ? String(v).trim() : "");

/** Re-authenticates an admin (権限チェック), then deletes the item. Deleting a customer removes all of its documents. */
export async function deleteItem(input: Record<string, unknown>, user: User): Promise<{ deleted: number }> {
  const kind = s(input.kind) as DeleteKind;
  const id = s(input.id);
  if (!(kind in DELETE_KINDS) || !id) throw new UserError("削除する項目が正しくありません。");

  const lockKey = `reauth:${user.id}`;
  if (isLoginLocked(lockKey)) throw new UserError("権限チェックに続けて失敗したため、しばらく時間をおいてから再度お試しください。");
  const auth = await login(s(input.adminId), typeof input.adminPassword === "string" ? input.adminPassword : "");
  if (!auth || auth.user.role !== ROLE_ADMIN || auth.user.mustSetPassword) {
    recordLoginFailure(lockKey);
    throw new UserError("権限チェックに失敗しました。管理者のIDとパスワードを入力してください。");
  }
  clearLoginFailures(lockKey);

  return withLock(async () => {
    const t = await backend().readMany(["Customers", "Estimates", "Contracts", "Records"]);
    const target = t[SHEET[kind]].rows.find((r) => s(r.id) === id);
    if (!target) throw new UserError("削除する項目が見つかりません。");

    const plan: [SheetName, number[]][] = [];
    if (kind === "customer") {
      for (const n of ["Estimates", "Contracts", "Records"] as const) {
        plan.push([n, t[n].rows.filter((r) => s(r.customerId) === id).map((r) => r._row)]);
      }
    } else if (kind === "estimate") {
      if (t.Estimates.rows.some((r) => s(r.sourceId) === id)) throw new UserError("この見積から作成した本見積があるため削除できません。先に本見積を削除してください。");
      if (t.Contracts.rows.some((r) => s(r.estimateId) === id)) throw new UserError("この見積から作成した契約があるため削除できません。先に契約を削除してください。");
    } else if (kind === "contract") {
      if (t.Records.rows.some((r) => s(r.contractId) === id)) throw new UserError("この契約から作成した業務請負記録があるため削除できません。先に業務請負記録を削除してください。");
    }
    plan.push([SHEET[kind], [target._row]]);

    let deleted = 0;
    for (const [name, rows] of plan) {
      await backend().deleteRows(name, rows);
      deleted += rows.length;
    }
    return { deleted };
  });
}
