"use client";

/**
 * In-app replacement for `window.alert` / `window.confirm`.
 *
 * Components call `showAlert` / `showConfirm` imperatively from any
 * code path (hooks, effects, callbacks) and `await` the result. The
 * UI is rendered by `<DialogHost />` mounted at the app root, which
 * subscribes to a shared queue.
 */

export type DialogTone = "default" | "danger" | "warning" | "info";

export type DialogRequest = {
  id: number;
  kind: "alert" | "confirm";
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: DialogTone;
  resolve: (ok: boolean) => void;
};

let nextId = 1;
let queue: DialogRequest[] = [];
const listeners = new Set<(reqs: DialogRequest[]) => void>();

function emit() {
  const snapshot = [...queue];
  for (const l of listeners) l(snapshot);
}

/** Subscribe to queue changes. Returns an unsubscribe function. */
export function subscribeDialogs(
  fn: (reqs: DialogRequest[]) => void,
): () => void {
  listeners.add(fn);
  fn([...queue]);
  return () => {
    listeners.delete(fn);
  };
}

/** Resolve and remove a queued dialog. Called by the host UI. */
export function resolveDialog(id: number, ok: boolean): void {
  const req = queue.find((r) => r.id === id);
  if (!req) return;
  queue = queue.filter((r) => r.id !== id);
  emit();
  req.resolve(ok);
}

type AlertParams = {
  title: string;
  description?: string;
  confirmLabel?: string;
  tone?: DialogTone;
};

type ConfirmParams = AlertParams & {
  cancelLabel?: string;
};

/** Show an info dialog. Resolves once the user dismisses it. */
export function showAlert(params: AlertParams): Promise<void> {
  return new Promise((resolve) => {
    const req: DialogRequest = {
      id: nextId++,
      kind: "alert",
      title: params.title,
      description: params.description,
      confirmLabel: params.confirmLabel ?? "OK",
      tone: params.tone ?? "default",
      resolve: () => resolve(),
    };
    queue = [...queue, req];
    emit();
  });
}

/** Show a confirmation dialog. Resolves with true if confirmed. */
export function showConfirm(params: ConfirmParams): Promise<boolean> {
  return new Promise((resolve) => {
    const req: DialogRequest = {
      id: nextId++,
      kind: "confirm",
      title: params.title,
      description: params.description,
      confirmLabel: params.confirmLabel ?? "Confirm",
      cancelLabel: params.cancelLabel ?? "Cancel",
      tone: params.tone ?? "default",
      resolve,
    };
    queue = [...queue, req];
    emit();
  });
}
