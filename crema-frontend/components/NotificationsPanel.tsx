"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, ExternalLink, Clock } from "lucide-react";
import { useNotifications } from "@/lib/hooks/useNotifications";
import { useMarkNotificationRead, useMarkAllNotificationsRead } from "@/lib/hooks/useNotifications";
import { subscribeNotification, subscribeMsgprint } from "@/lib/services/realtime";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

export default function NotificationsPanel() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const { data: notifications, isLoading } = useNotifications();
  const markReadMutation = useMarkNotificationRead();
  const markAllMutation = useMarkAllNotificationsRead();
  const queryClient = useQueryClient();

  const unreadCount = notifications?.filter((n) => !n.read).length ?? 0;

  useEffect(() => {
    const unsubNotif = subscribeNotification(() => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    });

    const unsubMsg = subscribeMsgprint((data) => {
      toast[data.indicator === "red" || data.indicator === "error" ? "error" : "info"](
        data.title || data.message || "Message",
        { description: data.message || data.title },
      );
    });

    return () => {
      unsubNotif();
      unsubMsg();
    };
  }, [queryClient]);

  const handleMarkRead = (name: string) => {
    markReadMutation.mutate(name);
  };

  const handleMarkAllRead = () => {
    markAllMutation.mutate();
  };

  return (
    <>
      {/* Notification bell trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative rounded-lg p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
      >
        <Bell className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Notifications dropdown */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
            onKeyDown={(e) => { if (e.key === "Escape") setIsOpen(false); }}
          />
          <div className="absolute right-0 top-14 z-50 w-96 rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Notifications</h3>
                {unreadCount > 0 && (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
                    {unreadCount} unread
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center p-8">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900" />
                </div>
              ) : notifications && notifications.length > 0 ? (
                <div className="divide-y divide-zinc-200 dark:divide-zinc-700">
                  {notifications.map((notification) => (
                    <div
                      key={notification.name}
                      role="button"
                      tabIndex={0}
                      onClick={() => notification.name && handleMarkRead(notification.name)}
                      onKeyDown={(e) => {
                        if ((e.key === "Enter" || e.key === " ") && notification.name) {
                          e.preventDefault();
                          handleMarkRead(notification.name);
                        }
                      }}
                      className={[
                        "cursor-pointer px-4 py-3 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800",
                        !notification.read && "bg-blue-50/50 dark:bg-blue-900/10",
                      ].join(" ")}
                    >
                      <div className="flex items-start gap-3">
                        <div className={[
                          "mt-0.5 h-2 w-2 shrink-0 rounded-full",
                          notification.type === "error" && "bg-red-500",
                          notification.type === "warning" && "bg-yellow-500",
                          notification.type === "success" && "bg-green-500",
                          !notification.type || notification.type === "info" && "bg-blue-500",
                        ].join(" ")} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-zinc-900 dark:text-zinc-100">
                            {notification.subject}
                          </p>
                          <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                            <Clock className="h-3 w-3" />
                            {formatTimeAgo(notification.creation)}
                          </div>
                        </div>
                        {!notification.read && (
                          <div className="h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-2 p-8 text-center">
                  <Bell className="h-8 w-8 text-zinc-300 dark:text-zinc-600" />
                  <p className="text-sm text-zinc-500">No notifications</p>
                </div>
              )}
            </div>

            {notifications && notifications.length > 0 && (
              <div className="border-t border-zinc-200 px-4 py-2 dark:border-zinc-700">
                <button
                  onClick={() => {
                    setIsOpen(false);
                    router.push("/desk/notifications");
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-lg py-2 text-sm text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  View all notifications
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
