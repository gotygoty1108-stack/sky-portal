"use client";

import { Lock, LogIn, PlaneTakeoff, User } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button, Card } from "./ui";

export function LoginView({ onLogin, loading, error }: { onLogin: (id: string, pw: string) => void; loading: boolean; error: string }) {
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onLogin(userId, password);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-50 to-blue-50">
      <Card className="w-full max-w-md p-8 shadow-xl border-t-4 border-t-blue-600">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 text-blue-600 mb-4">
            <PlaneTakeoff className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">SKY-PORTAL</h1>
          <p className="text-sm text-slate-500 mt-2">業務用ドローン 業務管理システム</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <label className="block">
            <span className="block text-sm font-bold text-slate-700 mb-1.5">ログインID</span>
            <span className="relative block">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User className="text-slate-400 w-5 h-5" />
              </span>
              <input
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                required
                autoComplete="username"
                autoCapitalize="none"
                className="block w-full pl-10 pr-3 py-3 border border-slate-300 rounded-xl bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                placeholder="IDを入力"
              />
            </span>
          </label>

          <label className="block">
            <span className="block text-sm font-bold text-slate-700 mb-1.5">パスワード</span>
            <span className="relative block">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="text-slate-400 w-5 h-5" />
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="block w-full pl-10 pr-3 py-3 border border-slate-300 rounded-xl bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                placeholder="パスワードを入力"
              />
            </span>
          </label>

          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-3">{error}</p>}

          <Button type="submit" className="w-full py-3" loading={loading} icon={LogIn}>
            ログイン
          </Button>
        </form>
      </Card>
    </div>
  );
}
