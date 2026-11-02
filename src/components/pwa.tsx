"use client";

import { Download, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function useServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch((err) => console.warn("Service worker registration failed", err));
  }, []);
}

export function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}

export function InstallButton() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setDeferred(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!deferred) return null;
  return (
    <button
      onClick={async () => {
        await deferred.prompt();
        await deferred.userChoice;
        setDeferred(null);
      }}
      className="flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
    >
      <Download className="w-4 h-4" />
      <span className="hidden sm:inline">アプリをインストール</span>
    </button>
  );
}

export function OfflineBanner({ online, cachedAt }: { online: boolean; cachedAt: string | null }) {
  if (online && !cachedAt) return null;
  return (
    <div className="bg-amber-100 text-amber-900 text-sm px-4 py-2 flex items-center justify-center gap-2 text-center">
      <WifiOff className="w-4 h-4 shrink-0" />
      {online
        ? `サーバーに接続できないため、${cachedAt}時点の保存データを表示しています（閲覧のみ）。`
        : `オフラインです。${cachedAt ? `${cachedAt}時点の保存データを表示しています（閲覧のみ）。` : "電波の良い場所で再度お試しください。"}`}
    </div>
  );
}
