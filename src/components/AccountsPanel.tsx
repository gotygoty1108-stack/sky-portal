"use client";

import { KeyRound, Pencil, Plus, Save, UserPlus, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ROLE_ADMIN, ROLE_SALES, type Account } from "@/lib/types";
import { Badge, Button, Card } from "./ui";

const cell = "w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none";
const ROLE_LABEL: Record<number, string> = { [ROLE_SALES]: "1：営業", [ROLE_ADMIN]: "2：管理者" };

type Draft = { name: string; team: string; role: number; newId?: string };
type Issued = { id: string; name: string; tempPassword: string; reset: boolean };

function TeamSelect({ value, teams, onChange }: { value: string; teams: string[]; onChange: (v: string) => void }) {
  return (
    <select className={cell} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">（なし）</option>
      {[...new Set([...teams, ...(value ? [value] : [])])].map((t) => (
        <option key={t} value={t}>
          {t}
        </option>
      ))}
    </select>
  );
}

function RoleSelect({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <select className={cell} value={value} onChange={(e) => onChange(Number(e.target.value))}>
      {[ROLE_SALES, ROLE_ADMIN].map((r) => (
        <option key={r} value={r}>
          {ROLE_LABEL[r]}
        </option>
      ))}
    </select>
  );
}

export function AccountsPanel({ teams, currentUserId, readOnly }: { teams: string[]; currentUserId: string; readOnly: boolean }) {
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>({ name: "", team: "", role: ROLE_SALES });
  const [creating, setCreating] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState<Issued | null>(null);

  const load = useCallback(async () => {
    try {
      setAccounts(await api<Account[]>("/api/accounts"));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const run = async <T,>(fn: () => Promise<T>) => {
    setBusy(true);
    try {
      return await fn();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
      return null;
    } finally {
      setBusy(false);
    }
  };

  const create = async () => {
    if (!creating) return;
    const res = await run(() => api<{ account: Account; tempPassword: string }>("/api/accounts", { body: { action: "create", ...creating } }));
    if (res) {
      setAccounts((prev) => [...(prev || []), res.account]);
      setIssued({ id: res.account.id, name: res.account.name, tempPassword: res.tempPassword, reset: false });
      setCreating(null);
    }
  };

  const update = async (id: string) => {
    const res = await run(() => api<Account>("/api/accounts", { body: { action: "update", id, ...draft } }));
    if (res) {
      if (id === currentUserId && res.id !== id) {
        alert(`IDを「${res.id}」に変更しました。新しいIDでログインし直してください。`);
        location.reload();
        return;
      }
      setAccounts((prev) => (prev || []).map((a) => (a.id === id ? res : a)));
      setEditing(null);
    }
  };

  const reset = async (a: Account) => {
    if (!confirm(`${a.name}（${a.id}）のパスワードを初期化して、仮パスワードを発行しますか？`)) return;
    const res = await run(() => api<{ account: Account; tempPassword: string }>("/api/accounts", { body: { action: "reset", id: a.id } }));
    if (res) {
      setAccounts((prev) => (prev || []).map((x) => (x.id === a.id ? res.account : x)));
      setIssued({ id: a.id, name: a.name, tempPassword: res.tempPassword, reset: true });
    }
  };

  return (
    <div className="space-y-4">
      {issued && (
        <Card className="p-5 border-2 border-amber-300 bg-amber-50">
          <div className="flex justify-between items-start gap-3">
            <div>
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-amber-600" /> {issued.reset ? "仮パスワードを再発行しました" : "仮アカウントを発行しました"}
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                {issued.name} さんに伝えてください。このパスワードは閉じると二度と表示できません。ログインすると、パスワードの本登録画面に進みます。
              </p>
              <div className="mt-3 grid sm:grid-cols-2 gap-3 text-sm">
                <div className="bg-white rounded-lg border p-3">
                  <div className="text-xs text-slate-500">ログインID</div>
                  <div className="font-mono font-bold text-lg select-all">{issued.id}</div>
                </div>
                <div className="bg-white rounded-lg border p-3">
                  <div className="text-xs text-slate-500">仮パスワード</div>
                  <div className="font-mono font-bold text-lg select-all">{issued.tempPassword}</div>
                </div>
              </div>
            </div>
            <button onClick={() => setIssued(null)} className="p-2 text-slate-500 hover:text-slate-800" aria-label="閉じる">
              <X className="w-5 h-5" />
            </button>
          </div>
        </Card>
      )}

      <Card className="p-4">
        <div className="flex justify-between items-center mb-3">
          <p className="text-sm text-slate-600">パスワードは暗号化して保存されるため、管理者にも見えません。忘れた場合は「パスワード初期化」を使ってください。</p>
          {!creating && (
            <Button icon={UserPlus} onClick={() => setCreating({ name: "", team: "", role: ROLE_SALES })} disabled={readOnly || busy}>
              アカウント作成
            </Button>
          )}
        </div>
        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="text-slate-600 border-b-2 border-slate-300">
                <th className="text-left py-2 w-24">ID</th>
                <th className="text-left py-2">名前</th>
                <th className="text-left py-2 w-40">チーム</th>
                <th className="text-left py-2 w-32">権限レベル</th>
                <th className="text-left py-2 w-32">状態</th>
                <th className="w-56" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {creating && (
                <tr className="bg-blue-50/50">
                  <td className="py-2 text-xs text-slate-500">自動で発行</td>
                  <td className="py-2 pr-2">
                    <input className={cell} value={creating.name} onChange={(e) => setCreating({ ...creating, name: e.target.value })} placeholder="名前" autoFocus />
                  </td>
                  <td className="py-2 pr-2">
                    <TeamSelect value={creating.team} teams={teams} onChange={(team) => setCreating({ ...creating, team })} />
                  </td>
                  <td className="py-2 pr-2">
                    <RoleSelect value={creating.role} onChange={(role) => setCreating({ ...creating, role })} />
                  </td>
                  <td />
                  <td className="py-2 text-right space-x-2 whitespace-nowrap">
                    <Button icon={Plus} onClick={create} loading={busy} disabled={!creating.name.trim()}>
                      発行
                    </Button>
                    <Button variant="ghost" onClick={() => setCreating(null)} disabled={busy}>
                      取消
                    </Button>
                  </td>
                </tr>
              )}
              {(accounts || []).map((a) =>
                editing === a.id ? (
                  <tr key={a.id} className="bg-blue-50/50">
                    <td className="py-2 pr-2">
                      <input className={`${cell} font-mono`} value={draft.newId ?? a.id} onChange={(e) => setDraft({ ...draft, newId: e.target.value })} aria-label="ID" />
                    </td>
                    <td className="py-2 pr-2">
                      <input className={cell} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                    </td>
                    <td className="py-2 pr-2">
                      <TeamSelect value={draft.team} teams={teams} onChange={(team) => setDraft({ ...draft, team })} />
                    </td>
                    <td className="py-2 pr-2">
                      <RoleSelect value={draft.role} onChange={(role) => setDraft({ ...draft, role })} />
                    </td>
                    <td />
                    <td className="py-2 text-right space-x-2 whitespace-nowrap">
                      <Button icon={Save} onClick={() => update(a.id)} loading={busy}>
                        保存
                      </Button>
                      <Button variant="ghost" onClick={() => setEditing(null)} disabled={busy}>
                        取消
                      </Button>
                    </td>
                  </tr>
                ) : (
                  <tr key={a.id}>
                    <td className="py-2 font-mono">{a.id}</td>
                    <td className="py-2">
                      {a.name}
                      {a.id === currentUserId && <span className="ml-2 text-xs text-slate-400">（自分）</span>}
                    </td>
                    <td className="py-2">{a.team || <span className="text-slate-400">なし</span>}</td>
                    <td className="py-2">{ROLE_LABEL[a.role] || a.role}</td>
                    <td className="py-2">{a.pending ? <Badge type="warning">仮パスワード発行中</Badge> : <Badge type="success">本登録済み</Badge>}</td>
                    <td className="py-2 text-right whitespace-nowrap space-x-3">
                      <button
                        className="text-xs font-bold text-blue-600 hover:underline disabled:opacity-40"
                        disabled={readOnly || busy}
                        onClick={() => {
                          setEditing(a.id);
                          setDraft({ name: a.name, team: a.team, role: a.role });
                        }}
                      >
                        <Pencil className="w-3.5 h-3.5 inline" /> 編集
                      </button>
                      <button className="text-xs font-bold text-amber-700 hover:underline disabled:opacity-40" disabled={readOnly || busy} onClick={() => reset(a)}>
                        <KeyRound className="w-3.5 h-3.5 inline" /> パスワード初期化
                      </button>
                    </td>
                  </tr>
                ),
              )}
              {accounts === null && !error && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400">
                    読み込み中...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
