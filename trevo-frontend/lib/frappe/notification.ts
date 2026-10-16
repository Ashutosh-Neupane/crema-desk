/**
 * Notification log fetching.
 */
import type { NotificationLog } from "./types";
import { frappeMethod } from "./client";

export async function fetchNotifications(): Promise<NotificationLog[]> {
  const result = await frappeMethod<NotificationLog[]>(
    "frappe.desk.notifications.get_notification_log",
  );
  return Array.isArray(result) ? result : [];
}

export async function markNotificationRead(name: string): Promise<void> {
  await frappeMethod("frappe.desk.notifications.mark_notification_as_read", { name });
}
