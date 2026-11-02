"use client";

import { Loader2, X, type LucideIcon } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export function Card({ children, className = "", onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div
      className={`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden ${onClick ? "cursor-pointer hover:shadow-md transition-shadow" : ""} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

const BADGE_COLORS = {
  default: "bg-slate-100 text-slate-700",
  primary: "bg-blue-100 text-blue-700",
  success: "bg-emerald-100 text-emerald-700",
  warning: "bg-amber-100 text-amber-700",
};

export type BadgeType = keyof typeof BADGE_COLORS;

export function Badge({ children, type = "default" }: { children: ReactNode; type?: BadgeType }) {
  return <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${BADGE_COLORS[type]}`}>{children}</span>;
}

export function statusBadgeType(status: string): BadgeType {
  if (status === "契約済み") return "success";
  if (status === "提案中") return "warning";
  if (status === "契約進行中") return "primary";
  return "default";
}

const BUTTON_VARIANTS = {
  primary: "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500",
  secondary: "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 focus:ring-slate-500",
  danger: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500",
  ghost: "bg-transparent text-slate-600 hover:bg-slate-100 focus:ring-slate-400",
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof BUTTON_VARIANTS;
  icon?: LucideIcon;
  loading?: boolean;
};

export function Button({ children, variant = "primary", className = "", icon: IconCmp, loading = false, disabled = false, type = "button", ...props }: ButtonProps) {
  const isDisabled = loading || disabled;
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${BUTTON_VARIANTS[variant]} ${isDisabled ? "opacity-50 cursor-not-allowed" : ""} ${className}`}
      disabled={isDisabled}
      {...props}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : IconCmp && <IconCmp className="w-4 h-4" />}
      {children}
    </button>
  );
}

export function OverlayLoader({ active, text = "処理中..." }: { active: boolean; text?: string }) {
  if (!active) return null;
  return (
    <div className="fixed inset-0 bg-slate-900/40 flex flex-col items-center justify-center z-[100] backdrop-blur-sm">
      <div className="bg-white p-6 rounded-xl shadow-xl flex flex-col items-center">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-4" />
        <p className="font-medium text-slate-800">{text}</p>
      </div>
    </div>
  );
}

export function FullScreenLoader({ text }: { text: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white/80">
      <div className="w-10 h-10 rounded-full border-4 border-slate-200 border-l-blue-600 animate-spin mb-4" />
      <div className="text-slate-600 font-medium">{text}</div>
    </div>
  );
}

export function Modal({
  title,
  icon: IconCmp,
  onClose,
  children,
  footer,
  disabled,
}: {
  title: string;
  icon?: LucideIcon;
  onClose: () => void;
  children: ReactNode;
  footer: ReactNode;
  disabled?: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-5 sm:p-6 border-b border-slate-100 flex justify-between items-center bg-white">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            {IconCmp && <IconCmp className="w-5 h-5 text-blue-500" />}
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={disabled}
            aria-label="閉じる"
            className="text-slate-400 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-full p-2 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 sm:p-6 overflow-y-auto bg-slate-50/50">{children}</div>
        <div className="p-5 sm:p-6 border-t border-slate-100 bg-white flex justify-end gap-3">{footer}</div>
      </div>
    </div>
  );
}

export const inputClass =
  "w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow shadow-sm bg-white";

export function Field({ label, required, children, className = "" }: { label: string; required?: boolean; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-sm font-bold text-slate-700 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {children}
    </label>
  );
}
