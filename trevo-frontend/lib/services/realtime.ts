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

const BACKEND_URL =
  process.env.NEXT_PUBLIC_FRAPPE_BASE_URL ??
  process.env.FRAPPE_BACKEND_URL ??
  "http://localhost:8000";

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

/** Read the Frappe `sid` cookie (set by /api/auth/login via the BFF). */
function getSid(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)sid=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function getSocketHost(): string {
  // Frappe serves socket.io on the backend host. Try to derive it from the
  // backend URL (strip any path).
  try {
    const u = new URL(BACKEND_URL);
    return `${u.protocol}//${u.host}`;
  } catch {
    return "http://localhost:8000";
  }
}

export function getRealtimeSocket(): Socket {
  if (socket) return socket;

  const sid = getSid();
  socket = io(getSocketHost(), {
    path: "/socket.io",
    transports: ["websocket", "polling"],
    withCredentials: true,
    query: sid ? { sid } : {},
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
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
  if (typeof window === "undefined") return;
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

