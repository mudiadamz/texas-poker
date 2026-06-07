"use client";

import { useEffect, useState } from "react";
import {
  Check,
  Clock,
  Coins,
  Loader2,
  Save,
  Sparkles,
} from "lucide-react";

import { cn } from "@/lib/cn";
import { APP_SETTING_LIMITS, type AppSettings } from "@/lib/types";

type Props = {
  initial: AppSettings | null;
  busy?: boolean;
  error?: string | null;
  okMessage?: string | null;
  onSubmit: (settings: AppSettings) => Promise<void> | void;
};

type GroupKey = "game" | "timing";

type Field = {
  key: keyof AppSettings;
  label: string;
  hint: string;
  unit: string;
  group: GroupKey;
};

const FIELDS: Field[] = [
  {
    key: "buy_in_bb",
    label: "Max buy-in (×BB)",
    hint: "Max big blinds a player sits with (min is fixed at 20×BB). Players bring min(balance, this).",
    unit: "× BB",
    group: "game",
  },
  {
    key: "action_timeout_seconds",
    label: "Action timer",
    hint: "Seconds each player has to act per turn before auto-fold.",
    unit: "s",
    group: "timing",
  },
  {
    key: "between_hand_seconds",
    label: "Between hands",
    hint: "Cool-down after a hand ends before the next deal.",
    unit: "s",
    group: "timing",
  },
  {
    key: "showdown_seconds",
    label: "Showdown display",
    hint: "How long the winner banner stays before resetting.",
    unit: "s",
    group: "timing",
  },
  {
    key: "reveal_seconds",
    label: "All-in reveal pause",
    hint: "Pause between auto-revealed streets when no one can act.",
    unit: "s",
    group: "timing",
  },
];

const GROUPS: Array<{
  key: GroupKey;
  label: string;
  icon: React.ReactNode;
  description: string;
}> = [
  {
    key: "game",
    label: "Game",
    icon: <Coins className="h-4 w-4" />,
    description: "Buy-in cost shared by every table.",
  },
  {
    key: "timing",
    label: "Timing",
    icon: <Clock className="h-4 w-4" />,
    description: "Phase durations and pauses.",
  },
];

export function AppSettingsForm({
  initial,
  busy,
  error,
  okMessage,
  onSubmit,
}: Props) {
  const [values, setValues] = useState<AppSettings | null>(initial);

  useEffect(() => {
    setValues(initial);
  }, [initial]);

  if (!values) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading settings…
      </div>
    );
  }

  function clamped(key: keyof AppSettings, v: AppSettings): number {
    const limits = APP_SETTING_LIMITS[key];
    const value = v[key];
    if (typeof value !== "number" || !Number.isFinite(value)) return limits.min;
    return Math.min(Math.max(Math.round(value), limits.min), limits.max);
  }

  function localError(_v: AppSettings): string | null {
    return null;
  }

  function setField(key: keyof AppSettings, raw: number) {
    setValues((prev) => (prev ? { ...prev, [key]: raw } : prev));
  }

  const localErr = localError(values);
  const dirty =
    !!initial &&
    FIELDS.some((f) => clamped(f.key, values) !== initial[f.key]);

  async function handleSave() {
    if (!values || localErr || busy) return;
    await onSubmit({
      action_timeout_seconds: clamped("action_timeout_seconds", values),
      between_hand_seconds: clamped("between_hand_seconds", values),
      showdown_seconds: clamped("showdown_seconds", values),
      reveal_seconds: clamped("reveal_seconds", values),
      buy_in_bb: clamped("buy_in_bb", values),
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <header>
        <div className="flex items-center gap-2 text-indigo-600">
          <Sparkles className="h-3.5 w-3.5" />
          <span className="text-[11px] font-bold uppercase tracking-wider">
            Global
          </span>
        </div>
        <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
          Game settings
        </h2>
        <p className="mt-0.5 text-sm text-slate-500">
          Applies to every room. Buy-in changes apply to the next seat
          taken; timing changes apply on the next hand.
        </p>
      </header>

      {GROUPS.map((group) => (
        <section
          key={group.key}
          className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
        >
          <header className="flex items-start gap-3 border-b border-slate-100 px-5 py-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-indigo-50 text-indigo-600">
              {group.icon}
            </span>
            <div className="leading-tight">
              <h3 className="text-sm font-semibold text-slate-900">
                {group.label}
              </h3>
              <p className="text-[11px] text-slate-500">{group.description}</p>
            </div>
          </header>
          <div className="grid grid-cols-1 gap-px bg-slate-100 sm:grid-cols-2">
            {FIELDS.filter((f) => f.group === group.key).map((f) => {
              const limits = APP_SETTING_LIMITS[f.key];
              const current = values[f.key];
              const changed = !!initial && initial[f.key] !== current;
              return (
                <label
                  key={f.key}
                  className="flex flex-col gap-1.5 bg-white px-5 py-4 transition hover:bg-slate-50/60"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                      {f.label}
                      {changed && (
                        <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-indigo-500 align-middle" />
                      )}
                    </span>
                    <span className="font-mono text-[10px] text-slate-400">
                      {limits.min}–{limits.max}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={current}
                      min={limits.min}
                      max={limits.max}
                      onChange={(e) =>
                        setField(f.key, Number(e.target.value))
                      }
                      disabled={busy}
                      className={cn(
                        "w-full rounded-md border bg-white px-2.5 py-1.5 text-right font-mono text-sm font-medium tabular-nums outline-none transition focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-50",
                        changed
                          ? "border-indigo-400 text-indigo-900 focus:border-indigo-500 focus:ring-indigo-100"
                          : "border-slate-200 text-slate-900 focus:border-indigo-500 focus:ring-indigo-100",
                      )}
                    />
                    <span className="w-12 shrink-0 text-xs text-slate-500">
                      {f.unit}
                    </span>
                  </div>
                  <p className="text-[11px] leading-tight text-slate-500">
                    {f.hint}
                  </p>
                </label>
              );
            })}
          </div>
        </section>
      ))}

      {(localErr || error) && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {localErr ?? error}
        </p>
      )}
      {okMessage && !error && (
        <p className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          <Check className="h-4 w-4" />
          {okMessage}
        </p>
      )}

      <div className="flex items-center justify-between border-t border-slate-200 pt-4">
        <p className="text-xs text-slate-500">
          {dirty
            ? "You have unsaved changes."
            : "All settings are up to date."}
        </p>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={!!localErr || !dirty || busy}
          className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save settings
        </button>
      </div>
    </div>
  );
}
