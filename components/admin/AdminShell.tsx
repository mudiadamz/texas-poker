"use client";

import {
  LayoutDashboard,
  LogOut,
  Settings as SettingsIcon,
  Spade,
} from "lucide-react";

import { cn } from "@/lib/cn";

export type AdminTab = "rooms" | "settings";

type Props = {
  tab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
  onLogout: () => void;
  children: React.ReactNode;
};

const NAV: Array<{
  key: AdminTab;
  label: string;
  description: string;
  icon: React.ReactNode;
}> = [
  {
    key: "rooms",
    label: "Rooms",
    description: "Tables & players",
    icon: <LayoutDashboard className="h-4 w-4" />,
  },
  {
    key: "settings",
    label: "Settings",
    description: "Game configuration",
    icon: <SettingsIcon className="h-4 w-4" />,
  },
];

/**
 * Modern admin chrome — soft slate background, white surfaces with
 * indigo accents. Topbar holds the brand mark + global actions, left
 * sidebar switches between sections on tablet+, bottom tab bar takes
 * over on phones.
 */
export function AdminShell({ tab, onTabChange, onLogout, children }: Props) {
  const active = NAV.find((n) => n.key === tab);

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-indigo-800 text-white shadow-sm">
              <Spade className="h-4 w-4" />
            </span>
            <div className="leading-tight">
              <h1 className="text-sm font-semibold tracking-tight text-slate-900">
                Texas Hold&apos;em
              </h1>
              <p className="text-[11px] text-slate-500">Admin console</p>
            </div>
          </div>

          {/* Section breadcrumb (visible on sm+) */}
          {active && (
            <div className="hidden items-center gap-2 text-xs text-slate-500 sm:flex">
              <span>Console</span>
              <span className="text-slate-300">/</span>
              <span className="font-medium text-slate-900">{active.label}</span>
            </div>
          )}

          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Logout</span>
          </button>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl">
        <aside className="hidden w-60 shrink-0 px-3 py-4 sm:block">
          <nav className="flex flex-col gap-1">
            {NAV.map((item) => (
              <NavItem
                key={item.key}
                icon={item.icon}
                label={item.label}
                description={item.description}
                active={tab === item.key}
                onClick={() => onTabChange(item.key)}
              />
            ))}
          </nav>
        </aside>

        {/* Mobile tab bar (sidebar is hidden < sm) */}
        <nav className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around border-t border-slate-200 bg-white/95 py-2 backdrop-blur sm:hidden">
          {NAV.map((item) => (
            <MobileTab
              key={item.key}
              icon={item.icon}
              label={item.label}
              active={tab === item.key}
              onClick={() => onTabChange(item.key)}
            />
          ))}
        </nav>

        <main className="min-w-0 flex-1 px-4 pb-24 pt-4 sm:px-6 sm:pb-10 sm:pt-6">
          {children}
        </main>
      </div>
    </div>
  );
}

function NavItem({
  icon,
  label,
  description,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex items-start gap-2.5 rounded-lg px-3 py-2 text-left transition",
        active
          ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
          : "text-slate-600 hover:bg-white/60 hover:text-slate-900",
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition",
          active
            ? "bg-indigo-600 text-white"
            : "bg-slate-200/70 text-slate-600 group-hover:bg-slate-200",
        )}
      >
        {icon}
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-sm font-semibold">{label}</span>
        <span className="text-[11px] text-slate-500">{description}</span>
      </span>
    </button>
  );
}

function MobileTab({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-0.5 rounded-md px-3 py-1 text-[11px] font-medium transition",
        active ? "text-indigo-600" : "text-slate-500",
      )}
    >
      <span className={cn("transition", active && "scale-110")}>{icon}</span>
      <span>{label}</span>
    </button>
  );
}
