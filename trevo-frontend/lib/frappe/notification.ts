/**
 * Notification log fetching — same calls as Desk's notifications dropdown
 * (frappe/public/js/frappe/ui/notifications/notifications.js), available v14+.
 */
import type { NotificationLog } from "./types";
import { frappeMethod } from "./client";

const NL = "frappe.desk.doctype.notification_log.notification_log";

export async function fetchNotifications(limit = 20): Promise<NotificationLog[]> {
  const result = await frappeMethod<{ notification_logs?: NotificationLog[] }>(`${NL}.get_notification_logs`, { limit });
  return Array.isArray(result?.notification_logs) ? result.notification_logs : [];
}

export async function markNotificationRead(name: string): Promise<void> {
  await frappeMethod(`${NL}.mark_as_read`, { docname: name });
}

export async function markAllNotificationsRead(): Promise<void> {
  await frappeMethod(`${NL}.mark_all_as_read`);
}
