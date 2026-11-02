"use client";

import { LogOut, PlaneTakeoff, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { byNewest } from "@/lib/format";
import {
  ROLE_ADMIN,
  type Contract,
  type Customer,
  type CustomerBase,
  type CustomerFields,
  type CustomerRecord,
  type Estimate,
  type EstimateDetail,
  type User,
} from "@/lib/types";
import { CustomerDetailView } from "./CustomerDetailView";
import { DashboardView } from "./DashboardView";
import { EstimateBuilderView } from "./EstimateBuilderView";
import { CustomerFormModal, DocumentFormModal, RecordFormModal } from "./FormModals";
import { LoginView } from "./LoginView";
import { InstallButton, OfflineBanner, useOnline, useServiceWorker } from "./pwa";
import { FullScreenLoader, OverlayLoader } from "./ui";

type View = "dashboard" | "detail" | "estimate";
type NavState = { view: View; customerId: string | null };
type ModalState =
  | { kind: "customer"; editing: Customer | null }
  | { kind: "record" }
  | { kind: "finalEstimate" }
  | { kind: "contract" }
  | null;

const CACHE_KEY = "sky-portal-cache-v1";
type Cache = { user: User; customers: Customer[]; savedAt: string };

function readCache(): Cache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as Cache) : null;
  } catch {
    return null;
  }
}

function writeCache(user: User, customers: Customer[]) {
  try {
    const d = new Date();
    const savedAt = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    localStorage.setItem(CACHE_KEY, JSON.stringify({ user, customers, savedAt } satisfies Cache));
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
      setCustomers(data);
      setCachedAt(null);
      writeCache(u, data);
    } catch (err) {
      const cache = readCache();
      if (err instanceof ApiError && err.status === 401) throw err;
      if (cache && cache.user.id === u.id) {
        setCustomers(cache.customers);
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
        } else if (cache) {
          setUser(cache.user);
          setCustomers(cache.customers);
          setCachedAt(cache.savedAt);
        } else {
          setLoginError(err instanceof Error ? err.message : "読み込みに失敗しました。");
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

  const navigateTo = (view: View, customerId: string | null = nav.customerId) => {
    const next = { view, customerId };
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

  const updateCustomer = (id: string, fn: (c: Customer) => Customer) => setCustomers((prev) => prev.map((c) => (c.id === id ? fn(c) : c)));

  useEffect(() => {
    if (user && !cachedAt) writeCache(user, customers);
  }, [user, customers, cachedAt]);

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

  const handleSaveEstimate = async (data: { customerId: string; title: string; amount: number; type: "仮見積" | "本見積"; details: EstimateDetail[]; date?: string }) => {
    try {
      const est = await api<Estimate>("/api/estimates", { body: data });
      updateCustomer(est.customerId, (c) => ({ ...c, estimates: [est, ...c.estimates].sort(byNewest) }));
      return est;
    } catch (err) {
      handleError(err, "保存に失敗しました");
      return null;
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

  const handleAddContract = async (data: { date: string; title: string; amount: number }) => {
    if (!selected) return;
    try {
      const con = await api<Contract>("/api/contracts", { body: { ...data, customerId: selected.id } });
      updateCustomer(con.customerId, (c) => ({ ...c, contracts: [con, ...c.contracts].sort(byNewest) }));
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

  const view = nav.view !== "dashboard" && !selected ? "dashboard" : nav.view;

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
            onBack={() => goBack("dashboard")}
            onCreateEstimate={() => navigateTo("estimate", selected.id)}
            onEditCustomer={() => setModal({ kind: "customer", editing: selected })}
            onAddRecord={() => setModal({ kind: "record" })}
            onAddFinalEstimate={() => setModal({ kind: "finalEstimate" })}
            onAddContract={() => setModal({ kind: "contract" })}
          />
        )}

        {view === "estimate" && selected && (
          <EstimateBuilderView
            customer={selected}
            readOnly={readOnly}
            onBack={() => goBack("detail")}
            onSave={async (data) => {
              const est = await handleSaveEstimate(data);
              if (est) {
                alert("仮見積もりを保存しました。");
                goBack("detail");
              }
            }}
          />
        )}
      </main>

      {modal?.kind === "customer" && <CustomerFormModal
          initialData={modal.editing}
          isAdmin={user.role === ROLE_ADMIN}
          teams={[...new Set(customers.map((c) => c.team).filter(Boolean))].sort()}
          onClose={() => setModal(null)} onSave={handleSaveCustomer} />}
      {modal?.kind === "record" && <RecordFormModal onClose={() => setModal(null)} onSave={handleAddRecord} />}
      {modal?.kind === "finalEstimate" && selected && (
        <DocumentFormModal
          kind="estimate"
          onClose={() => setModal(null)}
          onSave={async (d) => {
            const est = await handleSaveEstimate({ customerId: selected.id, type: "本見積", details: [], ...d });
            if (est) setModal(null);
          }}
        />
      )}
      {modal?.kind === "contract" && <DocumentFormModal kind="contract" onClose={() => setModal(null)} onSave={handleAddContract} />}
    </div>
  );
}
