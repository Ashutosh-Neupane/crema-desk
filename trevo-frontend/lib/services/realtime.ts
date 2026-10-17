"use client";

/**
 * Frappe Realtime (Socket.io) client.
 *
 * Connects to the Frappe backend's socket.io endpoint using the user's `sid`
 * session cookie, and exposes typed subscription helpers for the events Trevo
 * cares about:
 *   - `doc_update`     — document saved/changed
 *   - `docinfo_update` — docinfo (comments/attachments/versions) changed
 *   - `list_update`    — list view data changed (create/delete/etc.)
 *   - `new_comment`    — a comment was added to a document
 *   - `version`        — a new version was created
 *   - `notification`   — a new notification was created
 *   - `msgprint`       — a server-side message was printed
 *
 * The socket is a module-level singleton so multiple hooks/views share one
 * connection.
 */

import React from "react";
import { io, type Socket } from "socket.io-client";

/**
 * Frappe's socket.io server (the bench's `socketio` process, port 9000 by
 * default) and the site namespace it serves. Realtime is off — no connection
 * attempts, no console noise — unless NEXT_PUBLIC_SOCKETIO_URL is set.
 */
const SOCKETIO_URL = process.env.NEXT_PUBLIC_SOCKETIO_URL ?? "";
const SITE_NAME = process.env.NEXT_PUBLIC_FRAPPE_SITE_NAME ?? "";
export const REALTIME_ENABLED = !!SOCKETIO_URL;

let socket: Socket | null = null;
let connecting = false;
let pendingHandlers = 0;

type RealtimeStatus = "disconnected" | "connecting" | "connected" | "reconnecting";
let currentStatus: RealtimeStatus = "disconnected";
/** Only a connection we actually had can be "reconnecting"; a bench without
 *  socket.io (no `socketio` process) just stays quietly disconnected, like Desk. */
let everConnected = false;
const lost = (): RealtimeStatus => (everConnected ? "reconnecting" : "disconnected");
const statusListeners = new Set<(status: RealtimeStatus) => void>();

function setStatus(status: RealtimeStatus) {
  currentStatus = status;
  statusListeners.forEach((fn) => fn(status));
}

export function useRealtimeStatus() {
  // External store subscription — no effect/setState dance needed
  return React.useSyncExternalStore<RealtimeStatus>(
    (onStoreChange) => {
      const handler = (_s: RealtimeStatus) => onStoreChange();
      statusListeners.add(handler);
      return () => {
        statusListeners.delete(handler);
      };
    },
    () => currentStatus,
    () => "disconnected",
  );
}

function getSocketUrl(): string {
  // v15+: one namespace per site — io("<socketio>/<site>")
  const base = SOCKETIO_URL.replace(/\/$/, "");
  const site = SITE_NAME || (() => {
    try {
      return new URL(base).hostname;
    } catch {
      return "";
    }
  })();
  return site ? `${base}/${site}` : base;
}

export function getRealtimeSocket(): Socket {
  if (socket) return socket;

  // Auth is the `sid` cookie (same hostname, so the browser sends it to the socket port too)
  socket = io(getSocketUrl(), {
    path: "/socket.io",
    transports: ["websocket", "polling"],
    withCredentials: true,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 30000,
  });

  socket.on("connect", () => {
    connecting = false;
    everConnected = true;
    setStatus("connected");
    console.debug("[realtime] connected to Frappe socket.io");
  });

  socket.on("disconnect", (reason) => {
    console.debug("[realtime] disconnected:", reason);
    if (reason === "io server disconnect") {
      setStatus("disconnected");
    } else {
      setStatus(lost());
    }
  });

  socket.on("connect_error", (err) => {
    // If we get a 401/403, the session is dead — clear auth and redirect.
    const status = (err as Error & { statusCode?: number }).statusCode;
    if (status === 401 || status === 403) {
      console.warn("[realtime] auth error — clearing session and redirecting to login");
      if (typeof document !== "undefined") {
        document.cookie.split(";").forEach((c) => {
          const name = c.trim().split("=")[0];
          if (name === "sid" || name === "user_id" || name === "full_name") {
            document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
          }
        });
      }
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
      return;
    }
    console.debug("[realtime] connect error:", err.message);
    setStatus(lost());
  });

  socket.on("reconnect", () => {
    setStatus("connected");
    console.debug("[realtime] reconnected");
  });

  socket.on("reconnect_attempt", () => {
    setStatus(lost());
  });

  return socket;
}

export function connectRealtime(): void {
  if (typeof window === "undefined" || !REALTIME_ENABLED) return;
  if (socket || connecting) return;
  connecting = true;
  setStatus("connecting");
  try {
    const s = getRealtimeSocket();
    if (s.connected) {
      connecting = false;
      setStatus("connected");
    }
  } catch {
    connecting = false;
    setStatus("disconnected");
  }
}

export function disconnectRealtime(): void {
  if (!socket) return;
  socket.disconnect();
  socket = null;
  connecting = false;
  setStatus("disconnected");
}

/** Subscribe to a Frappe realtime event. Returns an unsubscribe function. */
export function subscribeToRealtime<T = unknown>(
  event: string,
  handler: (data: T) => void,
): () => void {
  if (!REALTIME_ENABLED || typeof window === "undefined") return () => {};
  const s = getRealtimeSocket();
  pendingHandlers += 1;
  s.on(event, handler as (...args: unknown[]) => void);
  return () => {
    pendingHandlers -= 1;
    s.off(event, handler as (...args: unknown[]) => void);
    if (pendingHandlers <= 0) {
      pendingHandlers = 0;
    }
  };
}

// ---------------------------------------------------------------------------
// Typed helpers for the specific Frappe realtime events Trevo consumes
// ---------------------------------------------------------------------------

export interface DocUpdateEvent {
  doctype: string;
  docname: string;
  name?: string;
  modified?: string;
  [key: string]: unknown;
}

export interface DocInfoUpdateEvent {
  doctype: string;
  docname: string;
  [key: string]: unknown;
}

export interface ListUpdateEvent {
  doctype: string;
  name: string;
  modified?: string;
  [key: string]: unknown;
}

export interface NewCommentEvent {
  doctype: string;
  docname: string;
  comment_by?: string;
  content?: string;
  creation?: string;
  [key: string]: unknown;
}

export interface VersionEvent {
  doctype: string;
  docname: string;
  version_name?: string;
  [key: string]: unknown;
}

export interface NotificationEvent {
  subject?: string;
  seen?: number;
  [key: string]: unknown;
}

export interface MsgprintEvent {
  message?: string;
  title?: string;
  indicator?: string;
  [key: string]: unknown;
}

export function subscribeDocUpdate(handler: (data: DocUpdateEvent) => void) {
  return subscribeToRealtime<DocUpdateEvent>("doc_update", handler);
}

export function subscribeDocInfoUpdate(handler: (data: DocInfoUpdateEvent) => void) {
  return subscribeToRealtime<DocInfoUpdateEvent>("docinfo_update", handler);
}

export function subscribeListUpdate(handler: (data: ListUpdateEvent) => void) {
  return subscribeToRealtime<ListUpdateEvent>("list_update", handler);
}

export function subscribeNewComment(handler: (data: NewCommentEvent) => void) {
  return subscribeToRealtime<NewCommentEvent>("new_comment", handler);
}

export function subscribeVersion(handler: (data: VersionEvent) => void) {
  return subscribeToRealtime<VersionEvent>("version", handler);
}

export function subscribeNotification(handler: (data: NotificationEvent) => void) {
  return subscribeToRealtime<NotificationEvent>("notification", handler);
}

export function subscribeMsgprint(handler: (data: MsgprintEvent) => void) {
  return subscribeToRealtime<MsgprintEvent>("msgprint", handler);
}


// ---------------------------------------------------------------------------
// Rooms (Desk: socketio_client.js) — the server only sends list_update / doc_update /
// doc_viewers to sockets that joined the doctype or document room. Re-joined on reconnect.
// ---------------------------------------------------------------------------

function joinRoom(join: () => void, leave: () => void): () => void {
  if (!REALTIME_ENABLED || typeof window === "undefined") return () => {};
  const s = getRealtimeSocket();
  if (s.connected) join();
  s.on("connect", join);
  return () => {
    s.off("connect", join);
    if (s.connected) leave();
  };
}

/** List views: refresh when any document of the DocType changes (list_update). */
export function useListRealtime(doctype: string | undefined, onUpdate: (e: ListUpdateEvent) => void) {
  const cb = React.useRef(onUpdate);
  React.useEffect(() => {
    cb.current = onUpdate;
  });
  React.useEffect(() => {
    if (!doctype) return;
    const s = REALTIME_ENABLED && typeof window !== "undefined" ? getRealtimeSocket() : null;
    const leave = joinRoom(() => s?.emit("doctype_subscribe", doctype), () => s?.emit("doctype_unsubscribe", doctype));
    const off = subscribeToRealtime<ListUpdateEvent>("list_update", (e) => e?.doctype === doctype && cb.current(e));
    return () => {
      off();
      leave();
    };
  }, [doctype]);
}

export interface DocViewersEvent {
  doctype: string;
  docname: string;
  users: string[];
}

/** Forms: doc_update (someone saved) and doc_viewers (who has it open). */
export function useDocRealtime(
  doctype: string | undefined,
  name: string | undefined,
  handlers: { onUpdate?: (e: DocUpdateEvent) => void; onViewers?: (users: string[]) => void },
) {
  const cb = React.useRef(handlers);
  React.useEffect(() => {
    cb.current = handlers;
  });
  React.useEffect(() => {
    if (!doctype || !name) return;
    const s = REALTIME_ENABLED && typeof window !== "undefined" ? getRealtimeSocket() : null;
    const leave = joinRoom(
      () => {
        s?.emit("doc_subscribe", doctype, name);
        s?.emit("doc_open", doctype, name);
      },
      () => {
        s?.emit("doc_close", doctype, name);
        s?.emit("doc_unsubscribe", doctype, name);
      },
    );
    const offUpdate = subscribeToRealtime<DocUpdateEvent>("doc_update", (e) => e?.doctype === doctype && e?.name === name && cb.current.onUpdate?.(e));
    const offViewers = subscribeToRealtime<DocViewersEvent>("doc_viewers", (e) => e?.doctype === doctype && e?.docname === name && cb.current.onViewers?.(e.users ?? []));
    return () => {
      offUpdate();
      offViewers();
      leave();
    };
  }, [doctype, name]);
}
