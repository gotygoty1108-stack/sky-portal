"use client";

import { LogOut, PlaneTakeoff, RefreshCw, Settings } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { byNewest } from "@/lib/format";
import {
  ROLE_ADMIN,
  computeStatus,
  type Contract,
  type Customer,
  type CustomerBase,
  type CustomerFields,
  type CustomerRecord,
  type Estimate,
  type User,
} from "@/lib/types";
import { DEFAULT_CONFIG, parseConfig, type EstimateConfig } from "@/lib/estimate";
import { AdminSettingsView } from "./AdminSettingsView";
import { ContractView, type ContractPayload } from "./ContractView";
import { FinalEstimateView } from "./FinalEstimateView";
import { ProvisionalEstimateView, type EstimatePayload } from "./ProvisionalEstimateView";
import { CustomerDetailView } from "./CustomerDetailView";
import { DashboardView } from "./DashboardView";
import { CustomerFormModal, RecordFormModal } from "./FormModals";
import { LoginView } from "./LoginView";
import { InstallButton, OfflineBanner, useOnline, useServiceWorker } from "./pwa";
import { FullScreenLoader, OverlayLoader } from "./ui";

type View = "dashboard" | "detail" | "provisional" | "final" | "contract" | "admin";
/** docId: document being edited, sourceId: document a new one is based on. */
type NavState = { view: View; customerId: string | null; docId?: string | null; sourceId?: string | null };
type ModalState = { kind: "customer"; editing: Customer | null } | { kind: "record" } | null;

const CACHE_KEY = "sky-portal-cache-v2";
type Cache = { user: User; customers: Customer[]; config?: EstimateConfig; savedAt: string };

function readCache(): Cache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as Cache) : null;
  } catch {
    return null;
  }
}

function writeCache(user: User, customers: Customer[], config: EstimateConfig) {
  try {
    const d = new Date();
    const savedAt = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    localStorage.setItem(CACHE_KEY, JSON.stringify({ user, customers, config, savedAt } satisfies Cache));
  } catch {
    // storage full or unavailable: offline view simply won't be available
  }
}

export default function DronePortal() {
  useServiceWorker();
  const online = useOnline();

  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [config, setConfig] = useState<EstimateConfig>(DEFAULT_CONFIG);
  const [nav, setNav] = useState<NavState>({ view: "dashboard", customerId: null });
  const [modal, setModal] = useState<ModalState>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [loginError, setLoginError] = useState("");
  const [cachedAt, setCachedAt] = useState<string | null>(null);

  const readOnly = !online || cachedAt !== null;
  const selected = nav.customerId ? customers.find((c) => c.id === nav.customerId) || null : null;

  const resetToLogin = useCallback((message = "") => {
    localStorage.removeItem(CACHE_KEY);
    setUser(null);
    setCustomers([]);
    setCachedAt(null);
    setModal(null);
    setNav({ view: "dashboard", customerId: null });
    setLoginError(message);
  }, []);

  const handleError = useCallback(
    (err: unknown, prefix: string) => {
      if (err instanceof ApiError && err.status === 401) {
        resetToLogin("ログインの有効期限が切れました。もう一度ログインしてください。");
        return;
      }
      alert(`${prefix}: ${err instanceof Error ? err.message : String(err)}`);
    },
    [resetToLogin],
  );

  const loadData = useCallback(async (u: User) => {
    try {
      const data = await api<Customer[]>("/api/data");
      let cfg = readCache()?.config;
      try {
        cfg = await api<EstimateConfig>("/api/settings");
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) throw err;
        alert(`見積設定の読み込みに失敗しました（初期設定で表示します）: ${err instanceof Error ? err.message : String(err)}`);
      }
      setCustomers(data);
      setConfig(parseConfig(cfg));
      setCachedAt(null);
      writeCache(u, data, parseConfig(cfg));
    } catch (err) {
      const cache = readCache();
      // Fall back to cached data only when the server is unreachable; show real server errors.
      if (!(err instanceof ApiError && err.status === 0)) throw err;
      if (cache && cache.user.id === u.id) {
        setCustomers(cache.customers);
        setConfig(parseConfig(cache.config));
        setCachedAt(cache.savedAt);
      } else {
        throw err;
      }
    }
  }, []);

  // Restore session on first load (works offline using the last cached data).
  useEffect(() => {
    (async () => {
      try {
        const me = await api<User | null>("/api/auth");
        if (me) {
          setUser(me);
          await loadData(me);
        }
      } catch (err) {
        const cache = readCache();
        if (err instanceof ApiError && err.status === 401) {
          resetToLogin();
        } else if (cache && err instanceof ApiError && err.status === 0) {
          setUser(cache.user);
          setCustomers(cache.customers);
          setConfig(parseConfig(cache.config));
          setCachedAt(cache.savedAt);
        } else {
          resetToLogin(`読み込みに失敗しました: ${err instanceof Error ? err.message : String(err)}`);
        }
      } finally {
        setBooting(false);
      }
    })();
  }, [loadData, resetToLogin]);

  // Browser / Android back button moves between screens instead of leaving the app.
  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const state = e.state as NavState | null;
      setModal(null);
      setNav(state?.view ? state : { view: "dashboard", customerId: null });
    };
    history.replaceState({ ...history.state, view: "dashboard", customerId: null } satisfies NavState, "");
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const navigateTo = (view: View, customerId: string | null = nav.customerId, extra: { docId?: string | null; sourceId?: string | null } = {}) => {
    const next: NavState = { view, customerId, docId: extra.docId ?? null, sourceId: extra.sourceId ?? null };
    if (view === "dashboard") {
      history.replaceState({ ...history.state, ...next }, "");
    } else {
      history.pushState({ ...history.state, ...next }, "");
    }
    setNav(next);
    window.scrollTo(0, 0);
  };

  const goBack = (fallback: View) => {
    if (history.state?.view && history.state.view !== "dashboard") history.back();
    else navigateTo(fallback);
  };

  const updateCustomer = (id: string, fn: (c: Customer) => Customer) =>
    setCustomers((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const next = fn(c);
        return { ...next, status: computeStatus(next) };
      }),
    );

  useEffect(() => {
    if (user && !cachedAt) writeCache(user, customers, config);
  }, [user, customers, config, cachedAt]);

  const handleLogin = async (userId: string, password: string) => {
    setBusy("ログイン中...");
    setLoginError("");
    try {
      const u = await api<User>("/api/auth", { body: { userId, password } });
      setUser(u);
      setBusy("データを読み込んでいます...");
      await loadData(u);
      setNav({ view: "dashboard", customerId: null });
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  const handleLogout = async () => {
    try {
      await api("/api/auth", { method: "DELETE" });
    } catch {
      // cookie will expire anyway; clear local state regardless
    }
    resetToLogin();
  };

  const handleRefresh = async () => {
    if (!user) return;
    setBusy("最新データを読み込んでいます...");
    try {
      await loadData(user);
    } catch (err) {
      handleError(err, "データの読み込みに失敗しました");
    } finally {
      setBusy(null);
    }
  };

  const handleSaveCustomer = async (form: CustomerFields & { id?: string }) => {
    try {
      const res = await api<{ customer: CustomerBase; isNew: boolean }>("/api/customers", { body: form });
      if (res.isNew) {
        setCustomers((prev) => [{ ...res.customer, records: [], estimates: [], contracts: [] }, ...prev]);
      } else {
        updateCustomer(res.customer.id, (c) => ({ ...c, ...res.customer }));
      }
      setModal(null);
    } catch (err) {
      handleError(err, "保存に失敗しました");
    }
  };

  const upsert = <T extends { id: string; date: string; createdAt: string }>(list: T[], item: T) => (list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [item, ...list]).sort(byNewest);

  const handleSaveEstimate = async (payload: EstimatePayload) => {
    try {
      const est = await api<Estimate>("/api/estimates", { body: payload });
      updateCustomer(est.customerId, (c) => ({ ...c, estimates: upsert(c.estimates, est) }));
      return est;
    } catch (err) {
      handleError(err, "保存に失敗しました");
      return null;
    }
  };

  const handleSaveContract = async (payload: ContractPayload) => {
    try {
      const con = await api<Contract>("/api/contracts", { body: payload });
      updateCustomer(con.customerId, (c) => ({
        ...c,
        contracts: upsert(c.contracts, con),
      }));
      return con;
    } catch (err) {
      handleError(err, "保存に失敗しました");
      return null;
    }
  };

  const handleSaveSettings = async (next: EstimateConfig) => {
    try {
      const saved = await api<EstimateConfig>("/api/settings", { body: next });
      setConfig(parseConfig(saved));
      return true;
    } catch (err) {
      handleError(err, "設定の保存に失敗しました");
      return false;
    }
  };

  const handleAddRecord = async (data: { date: string; title: string; content: string }) => {
    if (!selected) return;
    try {
      const rec = await api<CustomerRecord>("/api/records", { body: { ...data, customerId: selected.id } });
      updateCustomer(rec.customerId, (c) => ({ ...c, records: [rec, ...c.records].sort(byNewest) }));
      setModal(null);
    } catch (err) {
      handleError(err, "保存に失敗しました");
    }
  };

  if (booting) return <FullScreenLoader text="アプリケーションを読み込んでいます..." />;

  if (!user) {
    return (
      <>
        <OfflineBanner online={online} cachedAt={null} />
        <LoginView onLogin={handleLogin} loading={busy !== null} error={loginError} />
      </>
    );
  }

  const isAdmin = user.role === ROLE_ADMIN;
  const view = nav.view === "admin" ? (isAdmin ? "admin" : "dashboard") : nav.view !== "dashboard" && !selected ? "dashboard" : nav.view;
  const findEstimate = (id: string | null | undefined) => (id && selected?.estimates.find((e) => e.id === id)) || null;

  return (
    <div className="min-h-screen flex flex-col">
      <OverlayLoader active={busy !== null} text={busy || undefined} />

      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm pt-[env(safe-area-inset-top)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
          <button className="flex items-center gap-3 group" onClick={() => navigateTo("dashboard", null)}>
            <span className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-md group-hover:bg-blue-700 transition-colors">
              <PlaneTakeoff className="w-6 h-6" />
            </span>
            <span className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">SKY-PORTAL</span>
          </button>

          <div className="flex items-center gap-3 sm:gap-6">
            <InstallButton />
            {isAdmin && (
              <button
                onClick={() => navigateTo("admin", null)}
                className="flex items-center gap-1.5 text-sm font-medium text-purple-600 hover:text-purple-800 transition-colors"
                aria-label="管理者設定"
                title="管理者設定（仮見積システム）"
              >
                <Settings className="w-4 h-4" />
                <span className="hidden md:inline">管理者設定</span>
              </button>
            )}
            <button
              onClick={handleRefresh}
              disabled={!online}
              className="text-slate-500 hover:text-slate-800 transition-colors disabled:opacity-40"
              aria-label="最新データに更新"
              title="最新データに更新"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-full">
              <span
                className={`w-2.5 h-2.5 rounded-full ${user.role === ROLE_ADMIN ? "bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.8)]" : "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]"}`}
              />
              <span className="font-bold text-sm text-slate-700">{user.name}</span>
            </div>
            <button onClick={handleLogout} className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors" aria-label="ログアウト">
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">ログアウト</span>
            </button>
          </div>
        </div>
      </header>

      <OfflineBanner online={online} cachedAt={cachedAt} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pb-[calc(2rem+env(safe-area-inset-bottom))]">
        {view === "dashboard" && (
          <DashboardView
            user={user}
            customers={customers}
            readOnly={readOnly}
            onSelectCustomer={(c) => navigateTo("detail", c.id)}
            onCreateCustomer={() => setModal({ kind: "customer", editing: null })}
          />
        )}

        {view === "detail" && selected && (
          <CustomerDetailView
            user={user}
            customer={selected}
            readOnly={readOnly}
            config={config}
            onBack={() => goBack("dashboard")}
            onEditCustomer={() => setModal({ kind: "customer", editing: selected })}
            onAddRecord={() => setModal({ kind: "record" })}
            onOpenProvisional={(id) => navigateTo("provisional", selected.id, { docId: id })}
            onOpenFinal={(t) => navigateTo("final", selected.id, { docId: t.id, sourceId: t.sourceId })}
            onOpenContract={(t) => navigateTo("contract", selected.id, { docId: t.id, sourceId: t.sourceId })}
          />
        )}

        {view === "provisional" && selected && (
          <ProvisionalEstimateView
            key={nav.docId || "new"}
            user={user}
            customer={selected}
            config={config}
            initial={findEstimate(nav.docId)}
            readOnly={readOnly}
            onBack={() => goBack("detail")}
            onSave={handleSaveEstimate}
          />
        )}

        {view === "final" && selected && isAdmin && (
          <FinalEstimateView
            key={nav.docId || nav.sourceId || "new"}
            customer={selected}
            config={config}
            initial={findEstimate(nav.docId)}
            source={findEstimate(nav.sourceId)}
            readOnly={readOnly}
            onBack={() => goBack("detail")}
            onSave={handleSaveEstimate}
          />
        )}

        {view === "contract" && selected && isAdmin && (
          <ContractView
            key={nav.docId || nav.sourceId || "new"}
            customer={selected}
            config={config}
            initial={(nav.docId && selected.contracts.find((c) => c.id === nav.docId)) || null}
            source={findEstimate(nav.sourceId)}
            readOnly={readOnly}
            onBack={() => goBack("detail")}
            onSave={handleSaveContract}
          />
        )}

        {view === "admin" && <AdminSettingsView key={JSON.stringify(config).length} config={config} readOnly={readOnly} onBack={() => goBack("dashboard")} onSave={handleSaveSettings} />}
      </main>

      {modal?.kind === "customer" && <CustomerFormModal
          initialData={modal.editing}
          isAdmin={user.role === ROLE_ADMIN}
          teams={[...new Set(customers.map((c) => c.team).filter(Boolean))].sort()}
          onClose={() => setModal(null)} onSave={handleSaveCustomer} />}
      {modal?.kind === "record" && <RecordFormModal onClose={() => setModal(null)} onSave={handleAddRecord} />}
    </div>
  );
}
