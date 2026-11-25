"use client";

import { KeyRound, LogOut } from "lucide-react";
import { useState, type FormEvent } from "react";
import { api } from "@/lib/api";
import type { User } from "@/lib/types";
import { Button, Card, Field, inputClass } from "./ui";

export function PasswordSetupView({ user, onDone, onLogout }: { user: User; onDone: (u: User) => void; onLogout: () => void }) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (pw !== pw2) return setError("確認用のパスワードが一致しません。");
    setSaving(true);
    try {
      onDone(await api<User>("/api/auth/password", { body: { password: pw } }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-50 to-blue-50">
      <Card className="w-full max-w-md p-8 shadow-xl border-t-4 border-t-amber-500">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-amber-100 text-amber-600 mb-3">
            <KeyRound className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">アカウント本登録</h1>
          <p className="text-sm text-slate-500 mt-2">
            {user.name} さん（ID: {user.id}）
            <br />
            仮パスワードでログインしました。新しいパスワードを登録してください。
          </p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <Field label="新しいパスワード（8文字以上・英字と数字を含む）" required>
            <input type="password" autoComplete="new-password" className={inputClass} value={pw} onChange={(e) => setPw(e.target.value)} required />
          </Field>
          <Field label="新しいパスワード（確認）" required>
            <input type="password" autoComplete="new-password" className={inputClass} value={pw2} onChange={(e) => setPw2(e.target.value)} required />
          </Field>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full py-3" loading={saving}>
            パスワードを登録して始める
          </Button>
          <button type="button" onClick={onLogout} className="w-full text-sm text-slate-500 hover:text-slate-800 flex items-center justify-center gap-1">
            <LogOut className="w-4 h-4" /> ログアウト
          </button>
        </form>
      </Card>
    </div>
  );
}
