"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  Coins,
  ExternalLink,
  Loader2,
  Megaphone,
  Pencil,
  Plus,
  RefreshCcw,
  Search,
  Trash2,
  TrendingUp,
  Users,
} from "lucide-react";

import { cn } from "@/lib/cn";

export type AdminPlayer = {
  id: string;
  name: string;
  chips: number;
  bet_street: number;
  folded: boolean;
  all_in: boolean;
  last_seen: string;
  joined_at: string;
  active: boolean;
};

export type AdminRoom = {
  id: string;
  name: string | null;
  phase: string;
  community_cards: string[];
  pot: number;
  current_bet: number;
  small_blind: number;
  big_blind: number;
  created_at: string;
  players: AdminPlayer[];
  total_count: number;
  active_count: number;
};

type Props = {
  rooms: AdminRoom[];
  loading: boolean;
  pending: Record<string, boolean>;
  onRefresh: () => void;
  onCreate: () => void;
  onRename: (room: AdminRoom) => void;
  onDelete: (room: AdminRoom) => void;
  onBroadcast: (room: AdminRoom) => void;
};

const PHASE_COLORS: Record<string, string> = {
  waiting: "bg-slate-100 text-slate-700",
  preflop: "bg-amber-100 text-amber-700",
  flop: "bg-amber-100 text-amber-700",
  turn: "bg-amber-100 text-amber-700",
  river: "bg-amber-100 text-amber-700",
  showdown: "bg-emerald-100 text-emerald-700",
};

export function RoomsList({
  rooms,
  loading,
  pending,
  onRefresh,
  onCreate,
  onRename,
  onDelete,
  onBroadcast,
}: Props) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rooms;
    return rooms.filter(
      (r) =>
        r.id.toLowerCase().includes(q) ||
        (r.name ?? "").toLowerCase().includes(q) ||
        r.players.some((p) => p.name.toLowerCase().includes(q)),
    );
  }, [rooms, query]);

  const stats = useMemo(() => {
    const totalRooms = rooms.length;
    const activeRooms = rooms.filter((r) => r.active_count > 0).length;
    const inHandRooms = rooms.filter((r) => r.phase !== "waiting").length;
    let totalPlayers = 0;
    let activePlayers = 0;
    let totalChips = 0;
    let totalPot = 0;
    for (const r of rooms) {
      totalPlayers += r.total_count;
      activePlayers += r.active_count;
      totalPot += r.pot;
      for (const p of r.players) totalChips += p.chips;
    }
    return {
      totalRooms,
      activeRooms,
      inHandRooms,
      totalPlayers,
      activePlayers,
      totalChips,
      totalPot,
    };
  }, [rooms]);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Rooms
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Live tables · auto-refresh every 10 seconds
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCcw
              className={cn("h-3.5 w-3.5", loading && "animate-spin")}
            />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={onCreate}
            className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-indigo-700"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Create table</span>
          </button>
        </div>
      </header>

      {/* Stats overview cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Active rooms"
          value={stats.activeRooms}
          subtext={`of ${stats.totalRooms} total`}
          icon={<Activity className="h-4 w-4" />}
          tone="indigo"
        />
        <StatCard
          label="Online players"
          value={stats.activePlayers}
          subtext={`of ${stats.totalPlayers} seated`}
          icon={<Users className="h-4 w-4" />}
          tone="emerald"
        />
        <StatCard
          label="Hands in play"
          value={stats.inHandRooms}
          subtext={`${stats.totalPot.toLocaleString()} chips in pots`}
          icon={<TrendingUp className="h-4 w-4" />}
          tone="amber"
        />
        <StatCard
          label="Total chips"
          value={stats.totalChips.toLocaleString()}
          subtext="across all stacks"
          icon={<Coins className="h-4 w-4" />}
          tone="slate"
        />
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by room name, ID, or player…"
          className="w-full rounded-md border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <Users className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-medium text-slate-900">
              {rooms.length === 0 ? "No active rooms yet" : "No rooms match your search"}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              {rooms.length === 0
                ? "Rooms appear here as soon as someone creates one."
                : "Try a different name, ID, or player."}
            </p>
          </div>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {filtered.map((room) => (
            <RoomRow
              key={room.id}
              room={room}
              pending={pending}
              onRename={() => onRename(room)}
              onDelete={() => onDelete(room)}
              onBroadcast={() => onBroadcast(room)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  subtext,
  icon,
  tone,
}: {
  label: string;
  value: number | string;
  subtext: string;
  icon: React.ReactNode;
  tone: "indigo" | "emerald" | "amber" | "slate";
}) {
  const toneClass = {
    indigo: "bg-indigo-50 text-indigo-600",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    slate: "bg-slate-100 text-slate-600",
  }[tone];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          {label}
        </p>
        <span
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-md",
            toneClass,
          )}
        >
          {icon}
        </span>
      </div>
      <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
        {value}
      </p>
      <p className="mt-0.5 text-[11px] text-slate-500">{subtext}</p>
    </div>
  );
}

function RoomRow({
  room,
  pending,
  onRename,
  onDelete,
  onBroadcast,
}: {
  room: AdminRoom;
  pending: Record<string, boolean>;
  onRename: () => void;
  onDelete: () => void;
  onBroadcast: () => void;
}) {
  const renaming = !!pending[`rename:${room.id}`];
  const deleting = !!pending[`delete:${room.id}`];
  const hasActive = room.active_count > 0;
  const phaseClass = PHASE_COLORS[room.phase] ?? PHASE_COLORS.waiting;

  return (
    <li className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "h-2 w-2 rounded-full transition",
                hasActive
                  ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]"
                  : "bg-slate-300",
              )}
              title={hasActive ? "Active" : "Idle"}
            />
            <h3 className="truncate text-base font-bold text-slate-900">
              {room.name || "Untitled room"}
            </h3>
            <span
              className={cn(
                "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                phaseClass,
              )}
            >
              {room.phase}
            </span>
            {room.pot > 0 && (
              <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-700">
                <Coins className="h-3 w-3" />
                {room.pot.toLocaleString()}
              </span>
            )}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 font-mono text-[11px] text-slate-500">
            <span>{room.id}</span>
            <span className="text-slate-300">·</span>
            <span className="inline-flex items-center gap-1 text-slate-600">
              <Users className="h-3 w-3" />
              {room.active_count}/{room.total_count}
            </span>
            <span className="text-slate-300">·</span>
            <span className="text-slate-600">
              Blinds {room.small_blind.toLocaleString()}/
              {room.big_blind.toLocaleString()}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <a
            href={`/room/${room.id}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
            title="Open room"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Open</span>
          </a>
          <button
            type="button"
            onClick={onBroadcast}
            className="inline-flex items-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-xs font-medium text-indigo-700 transition hover:border-indigo-300 hover:bg-indigo-100"
          >
            <Megaphone className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Broadcast</span>
          </button>
          <button
            type="button"
            onClick={onRename}
            disabled={renaming}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
          >
            {renaming ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Pencil className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">Rename</span>
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700 transition hover:border-red-300 hover:bg-red-100 disabled:opacity-50"
          >
            {deleting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">Delete</span>
          </button>
        </div>
      </header>

      {room.players.length === 0 ? (
        <p className="px-4 py-3 text-xs text-slate-500 sm:px-5">No players seated.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {room.players.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm sm:px-5"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    p.active ? "bg-emerald-500" : "bg-slate-300",
                  )}
                />
                <span className="truncate text-slate-900">{p.name}</span>
                {p.folded && (
                  <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700">
                    folded
                  </span>
                )}
                {p.all_in && (
                  <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                    all-in
                  </span>
                )}
                {p.chips === 0 && !p.all_in && !p.folded && (
                  <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                    bust
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 font-mono text-[11px] text-slate-500">
                <span className="inline-flex items-center gap-1 text-slate-700">
                  <Coins className="h-3 w-3" />
                  {p.chips.toLocaleString()}
                </span>
                <span className="text-slate-400">
                  {p.active ? "online" : relativeTimeShort(p.last_seen)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function relativeTimeShort(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(diff) || diff < 0) return "—";
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
}
