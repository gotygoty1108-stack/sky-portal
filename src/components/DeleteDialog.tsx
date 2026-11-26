"use client";

import { ShieldAlert, Trash2 } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/api";
import { Button, Field, inputClass, Modal } from "./ui";

export type DeleteTarget = { kind: "customer" | "estimate" | "contract" | "record"; id: string; label: string };

/** 権限チェック: an admin must sign in again before the item is deleted. */
export function DeleteDialog({ target, onClose, onDeleted }: { target: DeleteTarget; onClose: () => void; onDeleted: (t: DeleteTarget) => void }) {
  const [adminId, setAdminId] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      await api("/api/delete", { body: { kind: target.kind, id: target.id, adminId: adminId.trim(), adminPassword: password } });
      onDeleted(target);
    } catch (e) {
      setError(e instanceof Error ? e.message : "削除に失敗しました。");
      setBusy(false);
    }
  };

  return (
    <Modal
      title="権限チェック"
      icon={ShieldAlert}
      onClose={onClose}
      disabled={busy}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            キャンセル
          </Button>
          <Button variant="danger" icon={Trash2} onClick={submit} loading={busy} disabled={!adminId.trim() || !password}>
            削除する
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (adminId.trim() && password && !busy) void submit();
        }}
      >
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <div className="font-bold">「{target.label}」を削除します。元に戻せません。</div>
          {target.kind === "customer" && <div className="mt-1">この顧客の見積・契約・業務請負記録もすべて削除されます。</div>}
        </div>
        <p className="text-sm text-slate-600">続けるには、管理者のIDとパスワードを入力してください。</p>
        <Field label="管理者ID" required>
          <input className={inputClass} value={adminId} onChange={(e) => setAdminId(e.target.value)} autoComplete="off" autoFocus />
        </Field>
        <Field label="パスワード" required>
          <input className={inputClass} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="off" />
        </Field>
        {error && <div className="text-sm font-bold text-red-600">{error}</div>}
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}
