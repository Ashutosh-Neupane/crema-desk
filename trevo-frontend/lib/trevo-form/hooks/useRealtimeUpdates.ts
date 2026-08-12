"use client";

import { useEffect, useRef } from "react";
import {
  connectRealtime,
  subscribeDocUpdate,
  subscribeDocInfoUpdate,
  subscribeNewComment,
  subscribeVersion,
  type DocUpdateEvent,
  type DocInfoUpdateEvent,
  type NewCommentEvent,
  type VersionEvent,
} from "@/lib/services/realtime";

/**
 * Real-time updates hook — subscribes to Frappe realtime (socket.io) events
 * for a given document, and fires the provided callbacks.
 *
 * - `onUpdate`  → `doc_update` / `docinfo_update` for this doc
 * - `onComment` → `new_comment` for this doc
 * - `onVersion` → `version` for this doc
 *
 * The shared socket connection is established on first use and persists for
 * the app lifetime. This hook only unsubscribes its own handlers on cleanup
 * (it does NOT tear down the shared socket).
 */
export function useRealtimeUpdates({
  doctype,
  docname,
  onUpdate,
  onComment,
  onVersion,
}: {
  doctype?: string;
  docname?: string;
  onUpdate?: (data: DocUpdateEvent | DocInfoUpdateEvent) => void;
  onComment?: (data: NewCommentEvent) => void;
  onVersion?: (data: VersionEvent) => void;
}) {
  // Keep latest callbacks in refs so subscriptions don't churn on every render.
  const onUpdateRef = useRef(onUpdate);
  const onCommentRef = useRef(onComment);
  const onVersionRef = useRef(onVersion);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
    onCommentRef.current = onComment;
    onVersionRef.current = onVersion;
  }, [onUpdate, onComment, onVersion]);

  useEffect(() => {
    if (!doctype || !docname) return;
    connectRealtime();

    const unsubDoc = subscribeDocUpdate((data) => {
      if (data.doctype === doctype && (data.docname === docname || data.name === docname)) {
        onUpdateRef.current?.(data);
      }
    });

    const unsubDocInfo = subscribeDocInfoUpdate((data) => {
      if (data.doctype === doctype && data.docname === docname) {
        onUpdateRef.current?.(data);
      }
    });

    const unsubComment = subscribeNewComment((data) => {
      if (data.doctype === doctype && data.docname === docname) {
        onCommentRef.current?.(data);
      }
    });

    const unsubVersion = subscribeVersion((data) => {
      if (data.doctype === doctype && data.docname === docname) {
        onVersionRef.current?.(data);
      }
    });

    return () => {
      unsubDoc();
      unsubDocInfo();
      unsubComment();
      unsubVersion();
      // Do NOT call disconnectRealtime() here — the socket is shared.
    };
  }, [doctype, docname]);
}

